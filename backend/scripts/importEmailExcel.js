process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require("dotenv").config();

const XLSX = require("xlsx");
const { MongoClient } = require("mongodb");
const fs = require("fs");

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

  return new Date(yyyy, mm - 1, dd, hh, mi, ss);
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

// ---------- MAP ----------

function mapToEntrega(row) {
  const dtRetiraPDVal = toLocalDateTimeString(row["Dt. retirada P.D."] ?? row["Dt. Retirada porto"]);
  const dtColetaVal = toLocalDateTimeString(row["Dt. coleta"] ?? row["Data agendamento"] ?? row["Data Agendamento"]);
  const dtChegadaVal = toLocalDateTimeString(row["Dt. chegada planta"] ?? row["Dt. chegada cliente"]);
  const dtEntradaVal = toLocalDateTimeString(
    row["Dt. entrada planta"] ??
    row["Dt. devolução CNTR"] ??
    row["Dt. devolução container"] ??
    row["Dt devolução container"]
  );

  return {
    codigo: row["Código"] ?? null,
    processo: row["N° GeoMaritima"] ?? row["Nº GeoMaritima"] ?? row["Processo"] ?? null,

    // ✅ MUDANÇA 1
    "Dt. Retirada porto": toLocalDateTimeString(row["Dt. retirada porto"]),
    "Dt. entrada": toLocalDateTimeString(row["Dt. entrada"]),

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
    isValidDtInicioDescarga: !isEmpty(row["Dt.Início Descarga"]) ? "V" : "X",
    isValidDtFimDescarga: !isEmpty(row["Dt. fim descarga"]) ? "V" : "X",
    dtColeta: dtColetaVal,
    dtChegadaPlanta: dtChegadaVal,
    dtInicioCarregamento: toLocalDateTimeString(row["Dt início carregamento"]),
    dtFimCarregamento: toLocalDateTimeString(row["Dt fim carregamento"]),
    dtSaidaPlanta: toLocalDateTimeString(row["Dt saida planta"]),
    dtEntradaPlanta: dtEntradaVal,
    containerNumero: row["Número"] ?? null,
    tara: row["Tara"] ?? null,
    lacre: row["Lacre"] ?? null,
    payload: row["Payload"] ?? null,
    temperatura: row["Temperatura (C°)"] ?? null,
    nCTe: row["N° CT-e/NFS-e"] ?? null,
    nMDFE: row["N° MDFE"] ?? null,
    situacaoMDFE: row["Situação MDFE"] ?? null,
    dtRetiraPD: dtRetiraPDVal,
    dtDevolucaoCNTR: dtEntradaVal,
    isValidDtRetiraPD: dtRetiraPDVal ? "V" : "X",
    isValidDtDevolucaoCNTR: dtEntradaVal ? "V" : "X",
    
  };
}

// ---------- MAIN ----------

let importando = false;

async function importarExcel(origem = "manual/startup") {
  if (importando) {
    console.log("⏳ Importação já em andamento, ignorando novo disparo...");
    return;
  }

  importando = true;
  let mongo;

  try {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!MONGO_URI) {
      throw new Error("MONGO_URI ou MONGODB_URI não definido no .env");
    }

    console.log("==================================================");
    console.log(`🚀 Iniciando importação [origem=${origem}]`);
    console.log("📄 Excel:", EXCEL_PATH);
    console.log("🗄️ Banco: delivery-docs | Collection: icompany");

    mongo = new MongoClient(MONGO_URI);
    await mongo.connect();

    const db = mongo.db("delivery-docs");
    const col = db.collection("icompany");

    console.log("📊 Lendo Excel...");

    const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }).map(cleanRow);

    const docs = rows.map(mapToEntrega).filter((d) => d.processo);

    console.log("📦 Linhas válidas do Excel:", docs.length);

    const antes = await col.countDocuments({});
    console.log("📌 Documentos antes da limpeza:", antes);

    // ✅ MUDANÇA 2
    const processosExcel = docs.map(d => d.processo).filter(Boolean);

    const deleteResult = await col.deleteMany({
      processo: { $in: processosExcel }
    });

    console.log("🧹 Removidos da icompany:", deleteResult.deletedCount);

    if (docs.length > 0) {
      const agora = new Date();

      const docsToInsert = docs.map((d) => ({
        ...d,
        createdAt: agora,
        updatedAt: agora,
        _lastImportAt: agora,
        ativo: true,
        status: "AGENDADO",
        _source: "erp_excel",
      }));

      const insertResult = await col.insertMany(docsToInsert, { ordered: false });
      console.log("📥 Inseridos:", Object.keys(insertResult.insertedIds).length);
    } else {
      console.log("⚠️ Nenhum documento válido encontrado no Excel para inserir.");
    }

    const totalFinal = await col.countDocuments({});
    console.log("✅ Total final na icompany:", totalFinal);
    console.log("==================================================");
  } catch (error) {
    console.error("❌ Erro na importação:", error);
  } finally {
    if (mongo) {
      await mongo.close();
    }
    importando = false;
  }
}

// ---------- MONITOR ----------

console.log("👀 Monitorando Excel...");

let ultimaModificacao = 0;

if (fs.existsSync(EXCEL_PATH)) {
  try {
    ultimaModificacao = fs.statSync(EXCEL_PATH).mtimeMs;
  } catch (e) {
    console.error("❌ Erro ao ler data de modificação inicial do Excel:", e);
  }
}

importarExcel("startup").catch(console.error);

setInterval(() => {
  try {
    if (!fs.existsSync(EXCEL_PATH)) return;

    const stats = fs.statSync(EXCEL_PATH);

    if (stats.mtimeMs !== ultimaModificacao) {
      ultimaModificacao = stats.mtimeMs;
      console.log("📥 Excel atualizado pelo ERP");
      importarExcel("watcher").catch(console.error);
    }
  } catch (error) {
    console.error("❌ Erro no monitor:", error);
  }
}, 5000);