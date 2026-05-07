const fs = require('fs');
const path = require('path');

const Delivery = require('../models/Delivery');
const r2Storage = require('../storage/r2');
const { getLocalUploadPath } = require('./uploadPaths');

const queue = [];
let running = false;
let startupScanScheduled = false;

function normalizeDocumentEntries(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry.flatMap(normalizeDocumentEntries);
  if (typeof entry === 'string') {
    try {
      return normalizeDocumentEntries(JSON.parse(entry));
    } catch (_) {
      return [entry];
    }
  }
  return [entry];
}

function serializeDocumentEntries(entries) {
  return entries.length === 0 ? null : JSON.stringify(entries);
}

function entryMatchesPending(entry, pendingEntry) {
  if (!entry || typeof entry !== 'object') return false;
  if (pendingEntry.r2Key && entry.r2Key === pendingEntry.r2Key) return true;
  if (pendingEntry.path && entry.path === pendingEntry.path) return true;
  if (pendingEntry.name && entry.name === pendingEntry.name && entry.pendingR2) return true;
  return false;
}

async function migrateLocalEntryToR2(job) {
  const localPath = job.localFilePath || getLocalUploadPath(job.fileEntry.path);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Arquivo local pendente nao encontrado: ${localPath}`);
  }

  const fileBuffer = fs.readFileSync(localPath);
  const r2Key = job.fileEntry.r2Key || `uploads/${job.fileEntry.path.replace(/\\/g, '/')}`;
  const url = await r2Storage.uploadBuffer(fileBuffer, r2Key, job.fileEntry.mimetype || 'image/jpeg');

  const delivery = await Delivery.findById(job.deliveryId);
  if (!delivery) throw new Error(`Entrega nao encontrada para retry R2: ${job.deliveryId}`);

  const docs = delivery.documents || {};
  const entries = normalizeDocumentEntries(docs[job.documentType]);
  let replaced = false;

  const updatedEntries = entries.map(entry => {
    if (!entryMatchesPending(entry, job.fileEntry)) return entry;
    replaced = true;
    return {
      name: entry.name || job.fileEntry.name || path.basename(r2Key),
      url,
      storage: 'r2',
      key: r2Key,
      migratedFrom: entry.path || job.fileEntry.path || 'local'
    };
  });

  if (!replaced) {
    updatedEntries.push({
      name: job.fileEntry.name || path.basename(r2Key),
      url,
      storage: 'r2',
      key: r2Key,
      migratedFrom: job.fileEntry.path || 'local'
    });
  }

  delivery.documents = {
    ...docs,
    [job.documentType]: serializeDocumentEntries(updatedEntries)
  };
  await delivery.save();

  console.log(`[R2_RETRY] Upload pendente migrado para R2: delivery=${job.deliveryId} doc=${job.documentType} key=${r2Key}`);
}

function scheduleQueue() {
  if (running) return;
  running = true;
  setTimeout(processQueue, 1000);
}

async function processQueue() {
  const job = queue.shift();
  if (!job) {
    running = false;
    return;
  }

  try {
    await migrateLocalEntryToR2(job);
  } catch (err) {
    job.attempts = (job.attempts || 0) + 1;
    const maxAttempts = Number(process.env.R2_RETRY_MAX_ATTEMPTS || 8);
    if (job.attempts < maxAttempts) {
      const delayMs = Math.min(300000, 5000 * Math.pow(2, job.attempts - 1));
      console.warn(`[R2_RETRY] Falha tentativa ${job.attempts}/${maxAttempts}: ${err.message}. Nova tentativa em ${delayMs}ms`);
      setTimeout(() => {
        queue.push(job);
        scheduleQueue();
      }, delayMs);
    } else {
      console.error(`[R2_RETRY] Desistindo apos ${maxAttempts} tentativas:`, err.message);
    }
  } finally {
    setTimeout(processQueue, 250);
  }
}

function enqueueR2Retry(job) {
  if (!job?.deliveryId || !job?.documentType || !job?.fileEntry?.path) return;
  queue.push({ ...job, attempts: job.attempts || 0 });
  scheduleQueue();
}

async function scanPendingR2Uploads() {
  try {
    const deliveries = await Delivery.find({
      $or: [
        { 'documents.chegadaCliente': /"pendingR2":true/ },
        { 'documents.inicioDesova': /"pendingR2":true/ },
        { 'documents.fimDesova': /"pendingR2":true/ },
        { 'documents.saidaCliente': /"pendingR2":true/ },
        { 'documents.chegadaPorto': /"pendingR2":true/ },
        { 'documents.devolucaoVazio': /"pendingR2":true/ },
        { 'documents.retiradaCheio': /"pendingR2":true/ },
        { 'documents.canhotNF': /"pendingR2":true/ },
        { 'documents.canhotCTE': /"pendingR2":true/ },
        { 'documents.diarioBordo': /"pendingR2":true/ }
      ]
    }).lean();

    deliveries.forEach(delivery => {
      Object.entries(delivery.documents || {}).forEach(([documentType, entry]) => {
        normalizeDocumentEntries(entry)
          .filter(item => item && typeof item === 'object' && item.pendingR2 && item.path)
          .forEach(fileEntry => enqueueR2Retry({
            deliveryId: delivery._id,
            documentType,
            fileEntry
          }));
      });
    });

    if (deliveries.length > 0) {
      console.log(`[R2_RETRY] ${deliveries.length} entrega(s) com uploads pendentes refileiradas`);
    }
  } catch (err) {
    console.warn('[R2_RETRY] Falha ao varrer pendencias R2:', err.message);
  }
}

function scheduleStartupR2RetryScan() {
  if (startupScanScheduled) return;
  startupScanScheduled = true;
  setTimeout(scanPendingR2Uploads, Number(process.env.R2_RETRY_STARTUP_DELAY_MS || 15000));
}

module.exports = {
  enqueueR2Retry,
  scanPendingR2Uploads,
  scheduleStartupR2RetryScan
};
