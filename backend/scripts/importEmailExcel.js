process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const XLSX = require("xlsx");
const { MongoClient } = require("mongodb");
const fs = require("fs");

const EXCEL_PATH =
  process.env.ICOMPANY_EXCEL_PATH ||
  "C:/Icompany/IcompanyErpGeoLogisticaNuvem/data/ic_uldConsulta_PX90016.xls";

const DB_NAME = process.env.MONGO_DB || "delivery-docs";
const COLLECTION_NAME = process.env.MONGO_COLLECTION || "icompany";
const DEFAULT_CITY = process.env.ICOMPANY_DEFAULT_CITY || "manaus";
const DEFAULT_ORIGEM = process.env.ICOMPANY_DEFAULT_ORIGEM || "MANAUS";
const DEFAULT_UF = process.env.ICOMPANY_DEFAULT_UF || "AM";
const WATCH_INTERVAL_MS = Number(process.env.ICOMPANY_WATCH_INTERVAL_MS || 5000);

const DRY_RUN = process.argv.includes("--dry-run");
const RUN_ONCE = process.argv.includes("--once") || DRY_RUN;

function firstValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

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
  return new Date(yyyy, Number(mm) - 1, dd, hh, mi, ss);
}

function toLocalDateTimeString(value) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateLocal(value);
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    const date = excelSerialToDate(value);
    if (!Number.isNaN(date.getTime())) return formatDateLocal(date);
  }

  if (typeof value === "string") {
    const brDate = parseBrazilianDateTimeString(value);
    if (brDate && !Number.isNaN(brDate.getTime())) return formatDateLocal(brDate);

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return formatDateLocal(date);
  }

  return null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;

  const text = String(value).trim();
  if (!text) return null;

  const normalized = text.includes(",") && text.includes(".")
    ? text.replace(/,/g, "")
    : text.replace(",", ".");

  const number = Number(normalized);
  return Number.isNaN(number) ? null : number;
}

function cleanRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = String(key || "").trim();
    if (!cleanKey || cleanKey.startsWith("Unnamed")) continue;
    out[cleanKey] = typeof value === "string" ? value.trim() : value;
  }
  return out;
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function getCityFromEstab(estab) {
  const value = normalizeText(estab)?.toUpperCase();

  if (value === "LAM") {
    return { city: "manaus", origem: "MANAUS", destino: "MANAUS", uf: "AM" };
  }

  if (value === "LSC") {
    return { city: "itajai", origem: "ITAJAI", destino: "ITAJAI", uf: "SC" };
  }

  return {
    city: DEFAULT_CITY,
    origem: DEFAULT_ORIGEM,
    destino: DEFAULT_ORIGEM,
    uf: DEFAULT_UF,
  };
}

function mapToIcompany(row, index = 0) {
  let codigo = normalizeText(firstValue(row, ["Codigo do processo", "Código do processo", "Codigo", "Código"]));
  const processo = normalizeText(firstValue(row, [
    "Cod. processo integracao",
    "Cód. processo integração",
    "N° GeoMaritima",
    "Nº GeoMaritima",
    "N° GeoMarítima",
    "Processo",
    "Nr. do processo",
  ]));
  const nrProcesso = normalizeText(firstValue(row, ["Nr. do processo"]));
  const container = normalizeText(firstValue(row, ["Nº Container", "Numero", "Número", "Container"]));
  const estab = normalizeText(firstValue(row, ["Estab."]));
  const cityInfo = getCityFromEstab(estab);
  if (!codigo) {
    const fallback = processo || nrProcesso || container || "SEM-IDENTIFICADOR";
    codigo = `AUTO-${estab || "SEM"}-${fallback}-${index + 2}`;
  }

  const dtRetiraPD = toLocalDateTimeString(firstValue(row, [
    "Dt. retirada P.D.",
    "Dt. retirada CNTR vazio",
    "Dt. Retirada porto",
  ]));
  const dtInicioDescarga = toLocalDateTimeString(firstValue(row, [
    "Dt. inicio descarga",
    "Dt. início descarga",
    "Dt.Início Descarga",
    "Dt. Início Descarga",
  ]));
  const dtFimDescarga = toLocalDateTimeString(firstValue(row, ["Dt. fim descarga", "Dt. Fim Descarga"]));
  const dtDevolucaoCNTR = toLocalDateTimeString(firstValue(row, [
    "Dt. devolução CNTR",
    "Dt. devolucao CNTR",
    "Dt Entrega CNTR Porto",
  ]));

  return {
    codigo,
    processo,
    geomaritima: processo,
    nrProcesso,
    estab,
    sentido: normalizeText(firstValue(row, ["Sentido"])),
    dtInicio: toLocalDateTimeString(firstValue(row, ["Dt. criado", "Dt. início", "Dt. Inicio"])),
    situacao: normalizeText(firstValue(row, ["Situação", "Situacao"])),
    status: normalizeText(firstValue(row, ["Status", "Situação", "Situacao"])) || "AGENDADO",
    cliente: normalizeText(firstValue(row, ["Cliente"])),
    remetente: normalizeText(firstValue(row, ["Remetente"])),
    destinatario: normalizeText(firstValue(row, ["Destinatário", "Destinatario"])),
    contratado: normalizeText(firstValue(row, ["Contratado"])),
    tipo: normalizeText(firstValue(row, ["Tipo frota", "Tipo"])),
    motorista: normalizeText(firstValue(row, ["Motorista"])),
    tracao: normalizeText(firstValue(row, ["Placa tracao", "Placa tração", "Tração", "Tracao"])),
    reboque: normalizeText(firstValue(row, ["Reboque"])),
    origem: normalizeText(firstValue(row, ["Origem"])) || cityInfo.origem,
    ufColeta: normalizeText(firstValue(row, ["UF coleta"])) || cityInfo.uf,
    destino: normalizeText(firstValue(row, ["Destino"])) || cityInfo.destino,
    ufEntrega: normalizeText(firstValue(row, ["UF entrega"])) || cityInfo.uf,
    dtColeta: toLocalDateTimeString(firstValue(row, ["Dt. coleta", "Data agendamento", "Data Agendamento"])),
    dtChegadaPlanta: toLocalDateTimeString(firstValue(row, ["Dt. chegada planta", "Dt. chegada cliente"])),
    dtRetiradaCNTRVazio: toLocalDateTimeString(firstValue(row, ["Dt. retirada CNTR vazio"])),
    dtInicioCarregamento: toLocalDateTimeString(firstValue(row, ["Dt. início carregamento", "Dt. inicio carregamento"])),
    dtFimCarregamento: toLocalDateTimeString(firstValue(row, ["Dt. fim carregamento"])),
    dtSaidaPlanta: toLocalDateTimeString(firstValue(row, ["Dt. saída planta", "Dt. saida planta"])),
    dtFimAgendamento: toLocalDateTimeString(firstValue(row, ["Dt. fim agendamento"])),
    dtAgendamentoDescarga: toLocalDateTimeString(firstValue(row, ["Dt. agendamento descarga", "Dt. Agendamento Descarga"])),
    dtRetiraPD,
    dtInicioDescarga,
    hrInicioDescarga: dtInicioDescarga ? dtInicioDescarga.slice(11, 16) : null,
    dtFimDescarga,
    dtDevolucaoCNTR,
    arrivedAt: dtInicioDescarga,
    entradaDistrito: dtDevolucaoCNTR,
    containerNumero: container,
    numero: container,
    observacao: normalizeText(firstValue(row, ["Observação", "Observacao"])),
    codProcessoIntegracao: normalizeText(firstValue(row, ["Cód. processo integração", "Cod. processo integracao"])),
    ricAbastecimento: toNumber(firstValue(row, ["RIC DE ABASTECIMENTO"])),
    ricPortoDestino: toNumber(firstValue(row, ["RIC PORTO DESTINO"])),
    comprovanteDesova: toNumber(firstValue(row, ["COMPROVANTE DE DESOVA"])),
    ricDepot: toNumber(firstValue(row, ["RIC DEPOT"])),
    diarioBordo: toNumber(firstValue(row, ["DIARIO DE BORDO"])),
    solicitacaoMonitoramento: toNumber(firstValue(row, ["SOLICITAÇÃO DE MONITORAMENTO", "SOLICITACAO DE MONITORAMENTO"])),
    ricPorto: toNumber(firstValue(row, ["RIC PORTO"])),
    discoTacografo: toNumber(firstValue(row, ["DISCO/ARQUIVO TACOGRAFO"])),
    canhotoDanfe: toNumber(firstValue(row, ["CANHOTO DE DANFE"])),
    valePallet: toNumber(firstValue(row, ["VALE PALLET"])),
    noshow: toNumber(firstValue(row, ["NOSHOW"])),
    ricDepotDestino: toNumber(firstValue(row, ["RIC DEPOT DESTINO"])),
    fotos: toNumber(firstValue(row, ["FOTOS"])),
    ricRetroarea: toNumber(firstValue(row, ["RIC RETROAREA"])),
    city: cityInfo.city,
    ativo: true,
    _source: "erp_consulta_px90016",
  };
}

function readExcel() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Planilha nao encontrada: ${EXCEL_PATH}`);
  }

  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }).map(cleanRow);

  return rows
    .map((row, index) => mapToIcompany(row, index))
    .filter((doc) => hasValue(doc.codigo) || hasValue(doc.processo) || hasValue(doc.containerNumero));
}

async function importarExcel(origem = "manual") {
  let mongo;

  try {
    const docs = readExcel();
    const now = new Date();
    const docsToInsert = docs.map((doc) => ({
      ...doc,
      createdAt: now,
      updatedAt: now,
      _lastImportAt: now,
    }));

    console.log("==================================================");
    console.log(`Importacao Icompany [origem=${origem}]`);
    console.log("Excel:", EXCEL_PATH);
    console.log("Banco:", DB_NAME, "| Collection:", COLLECTION_NAME);
    console.log("Linhas validas:", docsToInsert.length);

    if (DRY_RUN) {
      console.log("DRY RUN: nada sera gravado no MongoDB.");
      console.log("Amostra:", JSON.stringify(docsToInsert.slice(0, 3), null, 2));
      console.log("==================================================");
      return;
    }

    const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!MONGO_URI) {
      throw new Error("MONGODB_URI ou MONGO_URI nao definido no .env");
    }

    mongo = new MongoClient(MONGO_URI);
    await mongo.connect();

    const col = mongo.db(DB_NAME).collection(COLLECTION_NAME);
    const processos = docsToInsert.map((doc) => doc.processo).filter(Boolean);
    const codigos = docsToInsert.map((doc) => doc.codigo).filter(Boolean);
    const containers = docsToInsert.map((doc) => doc.containerNumero).filter(Boolean);

    const deleteResult = await col.deleteMany({
      $or: [
        { _source: "erp_consulta_px90016" },
        { _source: "erp_excel" },
        { processo: { $in: processos } },
        { codigo: { $in: codigos } },
        { containerNumero: { $in: containers } },
        { numero: { $in: containers } },
      ],
    });

    console.log("Removidos antes da nova carga:", deleteResult.deletedCount);

    if (docsToInsert.length > 0) {
      const insertResult = await col.insertMany(docsToInsert, { ordered: false });
      console.log("Inseridos:", Object.keys(insertResult.insertedIds).length);
    }

    const totalFinal = await col.countDocuments({});
    console.log("Total final na collection:", totalFinal);
    console.log("==================================================");
  } catch (error) {
    console.error("Erro na importacao Icompany:", error);
    process.exitCode = 1;
  } finally {
    if (mongo) await mongo.close();
  }
}

async function main() {
  await importarExcel("startup");

  if (RUN_ONCE) return;

  console.log("Monitorando Excel:", EXCEL_PATH);

  let ultimaModificacao = fs.existsSync(EXCEL_PATH) ? fs.statSync(EXCEL_PATH).mtimeMs : 0;

  setInterval(() => {
    try {
      if (!fs.existsSync(EXCEL_PATH)) return;

      const stats = fs.statSync(EXCEL_PATH);
      if (stats.mtimeMs !== ultimaModificacao) {
        ultimaModificacao = stats.mtimeMs;
        importarExcel("watcher").catch(console.error);
      }
    } catch (error) {
      console.error("Erro no monitor Icompany:", error);
    }
  }, WATCH_INTERVAL_MS);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  importarExcel,
  mapToIcompany,
  readExcel,
};
