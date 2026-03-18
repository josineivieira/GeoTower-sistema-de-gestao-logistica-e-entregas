process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require("dotenv").config();

const XLSX = require("xlsx");
const { MongoClient } = require("mongodb");
const fs = require("fs");

// caminho do excel exportado pelo ERP
const EXCEL_PATH = "C:/Icompany/IcompanyErpGeoLogisticaNuvem/data/ic_uldPx00200.xls";


// ---------- helpers ----------

function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function excelSerialToDate(serial) {

  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);

  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  let totalSeconds = Math.floor(86400 * fractionalDay);

  const seconds = totalSeconds % 60;
  totalSeconds -= seconds;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds - hours * 3600) / 60);

  return new Date(
    dateInfo.getUTCFullYear(),
    dateInfo.getUTCMonth(),
    dateInfo.getUTCDate(),
    hours,
    minutes,
    seconds
  );
}

function parseBrazilianDateTimeString(value) {

  if (!value || typeof value !== "string") return null;

  const text = value.trim();

  const match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (!match) return null;

  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = match;

  const day = Number(dd);
  const month = Number(mm) - 1;
  const year = Number(yyyy);
  const hour = Number(hh);
  const minute = Number(mi);
  const second = Number(ss);

  const d = new Date(year, month, day, hour, minute, second);

  return d;
}

function toLocalDateTimeString(value) {

  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return formatDateLocal(value);
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    const d = excelSerialToDate(value);
    if (!isNaN(d.getTime())) return formatDateLocal(d);
  }

  if (typeof value === "string") {

    const brDate = parseBrazilianDateTimeString(value);
    if (brDate) return formatDateLocal(brDate);

    const d = new Date(value);
    if (!isNaN(d.getTime())) return formatDateLocal(d);
  }

  return null;
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


// ---------- main ----------

async function importarExcel() {

  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  const MONGO_DB = process.env.MONGO_DB || "delivery-docs";
  const MONGO_COLLECTION = process.env.MONGO_COLLECTION || "programacaoentregas";

  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();

  const db = mongo.db(MONGO_DB);
  const col = db.collection(MONGO_COLLECTION);

  console.log("📊 Lendo Excel...");

  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });

  const sheet = wb.Sheets[wb.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }).map(cleanRow);

  const docs = rows.map(mapToEntrega).filter((d) => d.processo);

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
            _source: "erp_excel",
            _lastImportAt: new Date()
          }
        }
      });

      continue;
    }

    const patch = pickOnlyMissingFields(existing, d);

    if (Object.keys(patch).length === 0) continue;

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
  }

  if (ops.length) {

    await col.bulkWrite(ops, { ordered: false });

    console.log("✅ Mongo atualizado:", ops.length);

  } else {

    console.log("➖ Nenhuma atualização necessária");

  }

  await mongo.close();
}


// ---------- monitor ----------

console.log("👀 Monitorando Excel...");

let ultimaModificacao = 0;

setInterval(() => {

  if (!fs.existsSync(EXCEL_PATH)) return;

  const stats = fs.statSync(EXCEL_PATH);

  if (stats.mtimeMs !== ultimaModificacao) {

    ultimaModificacao = stats.mtimeMs;

    console.log("📥 Excel atualizado pelo ERP");

    importarExcel().catch(console.error);

  }

}, 5000);