process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require("dotenv").config();

const imaps = require("imap-simple");
const { simpleParser } = require("mailparser");
const XLSX = require("xlsx");
const { MongoClient } = require("mongodb");

// ---------- helpers ----------
function toLocalDateTimeString(v) {
  if (!v) return null;

  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function cleanRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (!k || String(k).startsWith("Unnamed")) continue;
    out[String(k).trim()] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

function isEmpty(v) {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function isAllowedAttachment(name) {
  const n = (name || "").toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".xlsm") || n.endsWith(".csv");
}

function mapToEntrega(row) {
  return {
    codigo: row["Código"] ?? null,
    processo: row["N° GeoMaritima"] ?? row["Nº GeoMaritima"] ?? row["Processo"] ?? null,

    dtInicio: toLocalDateTimeString(row["Dt. início"]),
    situacao: row["Situação"] ?? null,

    cliente: row["Cliente"] ?? null,
    remetente: row["Remetente"] ?? null,
    destinatario: row["Destinatário"] ?? null,
    contratado: row["Contratado"] ?? null,

    tipo: row["Tipo"] ?? null,
    dtSM: toLocalDateTimeString(row["Dt. SM"]),

    motorista: row["Motorista"] ?? null,
    tracao: row["Tração"] ?? null,
    reboque: row["Reboque"] ?? null,

    origem: row["Origem"] ?? null,
    ufColeta: row["UF coleta"] ?? null,
    destino: row["Destino"] ?? null,
    ufEntrega: row["UF entrega"] ?? null,

    pagamento: row["Pagamento"] ?? null,

    vlFreteProcesso: row["Vl. frete processo"] ?? null,
    vlPedagio: row["Vl. pedágio"] ?? null,
    vlFreteLista: row["Vl. frete lista"] ?? null,
    vlAbastecimento: row["Vl. abastecimento"] ?? null,

    dtAgendamentoDescarga: toLocalDateTimeString(row["Dt. agendamento descarga"]),
    dtChegada: toLocalDateTimeString(row["Dt. chegada"]),
    dtInicioDescarga: toLocalDateTimeString(row["Dt.Início Descarga"]),
    hrInicioDescarga: row["Hr.Inicio Descarga"] ?? null,
    dtFimDescarga: toLocalDateTimeString(row["Dt. fim descarga"]),

    containerNumero: row["Número"] ?? null,
    tara: row["Tara"] ?? null,
    lacre: row["Lacre"] ?? null,
    payload: row["Payload"] ?? null,
    temperatura: row["Temperatura (C°)"] ?? null,

    nCTe: row["N° CT-e/NFS-e"] ?? null,
    nMDFE: row["N° MDFE"] ?? null,
    situacaoMDFE: row["Situação MDFE"] ?? null
  };
}

// ✅ Só preenche campo vazio no banco
function pickOnlyMissingFields(existingDoc, incomingDoc) {
  const patch = {};
  for (const [k, newVal] of Object.entries(incomingDoc)) {
    if (k === "processo") continue;
    if (isEmpty(newVal)) continue;
    const oldVal = existingDoc ? existingDoc[k] : undefined;
    if (isEmpty(oldVal)) patch[k] = newVal;
  }
  return patch;
}

// ---------- mailbox ----------
async function openBestMailbox(connection) {
  const mailboxes = [
    "INBOX",
    "[Gmail]/Todos os e-mails",
    "[Gmail]/All Mail",
    "[Google Mail]/All Mail"
  ];

  for (const box of mailboxes) {
    try {
      await connection.openBox(box);
      console.log("📂 Mailbox aberta:", box);
      return box;
    } catch (e) {}
  }

  throw new Error("Não consegui abrir nenhuma mailbox (INBOX/All Mail).");
}

// ---------- main ----------
async function run() {
  const GMAIL_EMAIL = process.env.GMAIL_EMAIL;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  const MONGO_DB = process.env.MONGO_DB || "delivery-docs";
  const MONGO_COLLECTION = process.env.MONGO_COLLECTION || "programacaoentregas";

  const MAX_EMAILS = Number(process.env.MAX_EMAILS || 20);
  const SINCE_DAYS = Number(process.env.SINCE_DAYS || 2);

  console.log("EMAIL:", GMAIL_EMAIL);
  console.log("HAS_PASS:", !!GMAIL_APP_PASSWORD);
  console.log("HAS_MONGO:", !!MONGO_URI);

  if (!GMAIL_EMAIL || !GMAIL_APP_PASSWORD || !MONGO_URI) {
    throw new Error("Faltam variáveis no .env: GMAIL_EMAIL, GMAIL_APP_PASSWORD, MONGO_URI");
  }

  const imapConfig = {
    imap: {
      user: GMAIL_EMAIL,
      password: GMAIL_APP_PASSWORD,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      authTimeout: 20000,
      tlsOptions: {
        rejectUnauthorized: false
      }
    }
  };

  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const db = mongo.db(MONGO_DB);
  const col = db.collection(MONGO_COLLECTION);

  console.log(`🗄️ Mongo OK -> ${MONGO_DB}.${MONGO_COLLECTION}`);

  const connection = await imaps.connect(imapConfig);
  console.log("📩 Gmail conectado");

  await openBestMailbox(connection);

  const sinceDate = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000);
  const searchCriteria = [["SINCE", sinceDate]];
  const fetchOptions = { bodies: [""], struct: true };

  console.log(`⏱️ Buscando emails desde: ${sinceDate.toISOString()}`);

  const messages = await connection.search(searchCriteria, fetchOptions);
  const emails = messages.slice(-MAX_EMAILS);

  console.log(`📨 Emails encontrados (desde ${SINCE_DAYS} dias): ${messages.length} | Processando: ${emails.length}`);

  let anexosProcessados = 0;
  let processosCriados = 0;
  let processosAtualizados = 0;
  let processosSemMudanca = 0;

  for (const item of emails) {
    const all = item.parts.find((p) => p.which === "");
    if (!all) continue;

    const parsed = await simpleParser(all.body);
    const attachments = parsed.attachments || [];

    if (!attachments.length) continue;

    const allowedAtts = attachments.filter((a) => isAllowedAttachment(a.filename));
    if (!allowedAtts.length) continue;

    console.log(`🧾 Assunto: ${parsed.subject || "(sem assunto)"} | Anexos válidos: ${allowedAtts.length}`);

    for (const att of allowedAtts) {
      anexosProcessados++;
      console.log(`📎 Processando anexo: ${att.filename}`);

      const wb = XLSX.read(att.content, { type: "buffer", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }).map(cleanRow);

      const docs = rows.map(mapToEntrega).filter((d) => d.processo);

      if (!docs.length) {
        console.log("⚠️ Nenhuma linha com 'processo' encontrado no Excel.");
        continue;
      }

      const processos = [...new Set(docs.map((d) => d.processo))];
      const existentes = await col.find({ processo: { $in: processos } }).toArray();
      const mapExist = new Map(existentes.map((x) => [x.processo, x]));

      const ops = [];

      for (const d of docs) {
        const existing = mapExist.get(d.processo);

        if (!existing) {
          const toInsert = {};
          for (const [k, v] of Object.entries(d)) {
            if (!isEmpty(v)) toInsert[k] = v;
          }

          ops.push({
            insertOne: {
              document: {
                ...toInsert,
                processo: d.processo,
                createdAt: new Date(),
                updatedAt: new Date(),
                ativo: true,
                status: "AGENDADO",
                _source: "gmail_excel",
                _lastImportAt: new Date()
              }
            }
          });

          processosCriados++;
          continue;
        }

        const patch = pickOnlyMissingFields(existing, d);

        if (Object.keys(patch).length === 0) {
          processosSemMudanca++;
          continue;
        }

        ops.push({
          updateOne: {
            filter: { processo: d.processo },
            update: {
              $set: {
                ...patch,
                updatedAt: new Date(),
                _lastImportAt: new Date()
              }
            }
          }
        });

        processosAtualizados++;
      }

      if (ops.length) {
        await col.bulkWrite(ops, { ordered: false });
        console.log(`✅ BulkWrite OK | Ops: ${ops.length}`);
      } else {
        console.log("➖ Nada para gravar (tudo já preenchido).");
      }
    }
  }

  console.log(
    `🏁 Finalizado.\n` +
    `📎 Anexos processados: ${anexosProcessados}\n` +
    `🆕 Processos criados: ${processosCriados}\n` +
    `🧩 Processos atualizados (preencheu vazios): ${processosAtualizados}\n` +
    `➖ Processos sem mudança: ${processosSemMudanca}`
  );

  await connection.end();
  await mongo.close();
}

run().catch((e) => {
  console.error("❌ Erro:", e.message);
  process.exit(1);
});