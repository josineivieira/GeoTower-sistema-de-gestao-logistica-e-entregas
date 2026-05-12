const express = require("express");
const router = express.Router();

const applyProgramacaoCityFilter = (filter, city) => {
  if (city === 'manaus') {
    filter.$or = [
      { estab: 'LAM' },
      { estab: { $exists: false }, origem: { $in: ['MANAUS', 'MANAUS - COELTA BALY'] } },
      { estab: '', origem: { $in: ['MANAUS', 'MANAUS - COELTA BALY'] } },
    ];
  } else if (city === 'itajai') {
    filter.$or = [
      { estab: 'LSC' },
      { estab: { $exists: false }, origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } },
      { estab: '', origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } },
      { origem: 'ITAJAI' },
    ];
  }
  return filter;
};
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const NotificationService = require("../services/notificationService");
const { updateDeliveryAtomic, updateDeliveryStatus } = require("../utils/deliveryConcurrency");
const { enqueueR2Retry } = require("../utils/r2RetryQueue");
const { getUploadsBaseDir } = require("../utils/uploadPaths");

const verificationListCache = new Map();
const VERIFICATION_LIST_CACHE_MS = 25000;
const programacoesMineCache = new Map();
const PROGRAMACOES_MINE_CACHE_MS = 15000;

const clearVerificationListCache = (city) => {
  for (const key of verificationListCache.keys()) {
    if (key.startsWith(`${city}:`)) verificationListCache.delete(key);
  }
};

const clearProgramacoesMineCache = (city) => {
  for (const key of programacoesMineCache.keys()) {
    if (!city || key.includes(`:${city}:`)) programacoesMineCache.delete(key);
  }
};

// =======================
// Upload config (disk by default, memory for S3)
// =======================
const useS3 = !!process.env.S3_BUCKET;
let upload;
if (useS3) {
  console.log('âœ“ S3 configured: using memoryStorage for multer');
  upload = multer({ storage: multer.memoryStorage() });
} else {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // DinÃ¢mico por cidade
      const dir = path.join(getUploadsBaseDir(), req.city || 'manaus');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Garantir nome temporÃ¡rio Ãºnico para evitar sobrescrita de uploads mÃºltiplos
      const ext = path.extname(file.originalname) || '.jpg';
      const uniqueFilename = `${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, uniqueFilename);
    }
  });
  upload = multer({ storage });
}

const s3 = useS3 ? require('../storage/s3') : null;
const { normalizeDeliveryForResponse } = require('../utils/storageUtils');

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildProgramacaoLookupFilter(deliveryNumber, city, programacaoId) {
  if (programacaoId) return { _id: programacaoId };
  const safeDeliveryNumber = escapeRegExp(deliveryNumber);

  const baseFilter = {
    $or: [
      { processoLog: new RegExp(`^${safeDeliveryNumber}$`, 'i') },
      { processo: new RegExp(`^${safeDeliveryNumber}$`, 'i') },
      { container: new RegExp(`^${safeDeliveryNumber}$`, 'i') }
    ]
  };
  const cityFilter = {};
  applyProgramacaoCityFilter(cityFilter, city);
  return { $and: [baseFilter, cityFilter] };
}

function mergeDeliveryObservations(programacao, observations) {
  const baseObservation = String(programacao?.observacoes || '').trim();
  const flowObservation = String(observations || '').trim();
  const parts = [];

  if (baseObservation && !flowObservation.includes(baseObservation)) {
    parts.push(`Observação Icompany: ${baseObservation}`);
  }
  if (flowObservation) parts.push(flowObservation);

  return parts.join('\n');
}

function preserveIcompanyObservation(existingObservations, nextObservations) {
  const existing = String(existingObservations || '').trim();
  const next = String(nextObservations || '').trim();
  const marker = 'Observação Icompany:';

  if (!existing.includes(marker) || next.includes(marker)) return next;

  const start = existing.indexOf(marker);
  const candidateEnds = [
    existing.indexOf('\nCriada a partir', start),
    existing.indexOf('\nMontagem finalizada', start),
    existing.indexOf('\n[', start),
  ].filter((idx) => idx > start);
  const end = candidateEnds.length ? Math.min(...candidateEnds) : existing.length;
  const icompanyBlock = existing.slice(start, end).trim();

  return [icompanyBlock, next].filter(Boolean).join('\n');
}

function normalizeDocumentEntries(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) {
    return entry.flatMap(item => normalizeDocumentEntries(item));
  }
  if (typeof entry === 'string') {
    try {
      const parsed = JSON.parse(entry);
      return normalizeDocumentEntries(parsed);
    } catch (_) {
      return [entry];
    }
  }
  return [entry];
}

function getDocumentUniqueKey(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object') return entry.url || entry.path || entry.link || JSON.stringify(entry);
  return String(entry);
}

function getDocumentFileBaseName(documentType, city = 'manaus') {
  const labelsByCity = {
    manaus: {
      canhotNF: "CANHOTO_NF",
      canhotCTE: "CANHOTO_CTE",
      diarioBordo: "DIARIO_DE_BORDO",
      devolucaoVazio: "ENTREGA_CNTR_PORTO",
      chegadaMontagem: "CHEGADA_PORTO_MONTAGEM",
      retiradaCheio: "RETIRADA_CHEIO",
      chegadaCliente: "CHEGADA_NO_CLIENTE",
      inicioDesova: "INICIO_DA_DESOVA",
      fimDesova: "FINALIZACAO_DA_DESOVA",
      saidaCliente: "SAIDA_DO_CLIENTE",
      chegadaPorto: "CHEGADA_NO_PORTO",
    },
    itajai: {
      canhotNF: "TACOGRAFO_RIC_ABASTECIMENTO",
      canhotCTE: "CONTRATO",
      diarioBordo: "DIARIO_DE_BORDO",
      devolucaoVazio: "BAIXA_NO_PORTO",
      chegadaMontagem: "CHEGADA_PORTO_MONTAGEM",
      retiradaCheio: "RETIRADA_PORTO",
      chegadaCliente: "CHEGADA_NO_CLIENTE",
      inicioDesova: "INICIO_DA_OVACAO",
      fimDesova: "FINALIZACAO_DA_OVACAO",
      saidaCliente: "SAIDA_DO_CLIENTE",
      chegadaPorto: "CHEGADA_NO_PORTO",
    }
  };

  const cityKey = String(city || 'manaus').toLowerCase();
  return labelsByCity[cityKey]?.[documentType] || labelsByCity.manaus[documentType] || String(documentType || 'ARQUIVO').toUpperCase();
}

function normalizePartyName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function deliveryMatchesProgramacaoContext(delivery, programacao) {
  if (!delivery || !programacao) return false;

  const linkedToProgramacao = String(delivery.programacaoId || '') === String(programacao._id) ||
    String(delivery.linkedProgramacaoId || '') === String(programacao._id);
  if (linkedToProgramacao) return true;

  const deliveryNumber = String(delivery.deliveryNumber || '').trim().toUpperCase();
  const sameContainer = deliveryNumber === String(programacao.processoLog || '').trim().toUpperCase() ||
    deliveryNumber === String(programacao.container || '').trim().toUpperCase() ||
    deliveryNumber === String(programacao.processo || '').trim().toUpperCase();
  const deliveryParty = normalizePartyName(delivery.recebedor).toUpperCase();
  const programacaoParty = normalizePartyName(programacao.recebedor).toUpperCase();

  return sameContainer && !!deliveryParty && !!programacaoParty && deliveryParty === programacaoParty;
}

function hasDocumentValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (!value) return false;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function hasReturnProof(delivery) {
  return hasDocumentValue(delivery?.documents?.devolucaoVazio) ||
    hasDocumentValue(delivery?.documents?.devolucaoContainerVazio);
}

function hasReturnMarker(delivery) {
  const observations = String(delivery?.observations || '');
  return observations.includes('(CONTAINER_VAZIO_DEVOLVIDO)') ||
    observations.includes('(Baixa_Container)');
}

function isReturnedDelivery(delivery) {
  return !!delivery && (
    delivery.containerReturned === true ||
    !!delivery.horarioDevolucaoVazio ||
    hasReturnProof(delivery) ||
    hasReturnMarker(delivery)
  );
}

function deliveryNumberMatchesProgramacao(delivery, programacao) {
  const deliveryNumber = String(delivery?.deliveryNumber || '').trim().toUpperCase();
  if (!deliveryNumber || !programacao) return false;
  return [
    programacao.processoLog,
    programacao.processo,
    programacao.container
  ].some(value => deliveryNumber === String(value || '').trim().toUpperCase());
}

function deliveryDriverMatchesProgramacao(delivery, programacao) {
  const deliveryDriver = normalizePartyName(delivery?.driverName).toUpperCase();
  const programacaoDriver = normalizePartyName(programacao?.motorista).toUpperCase();
  return !!deliveryDriver && !!programacaoDriver && deliveryDriver === programacaoDriver;
}

function legacyDeliveryMatchesProgramacao(delivery, programacao) {
  if (deliveryMatchesProgramacaoContext(delivery, programacao)) return true;
  if (!deliveryNumberMatchesProgramacao(delivery, programacao)) return false;

  const deliveryParty = normalizePartyName(delivery.recebedor).toUpperCase();
  const programacaoParty = normalizePartyName(programacao.recebedor).toUpperCase();
  if (deliveryParty && programacaoParty) return deliveryParty === programacaoParty;

  return deliveryDriverMatchesProgramacao(delivery, programacao);
}

function safeStorageSegment(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function getDeliveryStorageFolder(delivery) {
  const container = safeStorageSegment(delivery?.deliveryNumber) || 'SEM_CONTAINER';
  const party = safeStorageSegment(delivery?.recebedor);
  if (party) return `${container}_${party}`;
  const fallbackId = safeStorageSegment(delivery?.programacaoId || delivery?.linkedProgramacaoId || delivery?._id);
  return fallbackId ? `${container}_${fallbackId}` : container;
}

// Helper to normalize db (works with sync mockdb or async mongo adapter)
async function getDb(req) {
  const db = req.mockdb;
  if (!db) return db;
  // If the db methods already return promises, wrap them to await; otherwise still behave synchronously
  const wrapper = {};
  const methods = ['find','findOne','findById','create','updateOne','deleteOne'];
  methods.forEach(m => {
    if (typeof db[m] === 'function') {
      wrapper[m] = async (...args) => {
        const res = db[m](...args);
        if (res && typeof res.then === 'function') return await res;
        return res;
      };
    }
  });
  return wrapper;
}

async function getRequesterRecord(req, db) {
  try {
    return await db.findById('drivers', req.user.id);
  } catch (_) {
    return null;
  }
}

function requesterNames(req, requesterRecord) {
  return [
    req.user?.name,
    req.user?.fullName,
    req.user?.username,
    requesterRecord?.name,
    requesterRecord?.fullName,
    requesterRecord?.username
  ].map(value => normalizePartyName(value).toUpperCase()).filter(Boolean);
}

function requesterNameRegexes(req, requesterRecord) {
  return requesterNames(req, requesterRecord).map(name => new RegExp(`^${escapeRegExp(name)}$`, 'i'));
}

function requesterContractors(req, requesterRecord) {
  return [
    req.user?.contratado,
    req.user?.transportadora,
    requesterRecord?.contratado,
    requesterRecord?.transportadora
  ].map(value => normalizePartyName(value).toUpperCase()).filter(Boolean);
}

function requesterContractorRegexes(req, requesterRecord) {
  return requesterContractors(req, requesterRecord).map(name => new RegExp(`^${escapeRegExp(name)}$`, 'i'));
}

async function canAccessDelivery(req, delivery, db) {
  if (!delivery || !req.user) return false;
  if (req.user.role === 'admin') return true;
  if (String(delivery.userId || '') === String(req.user.id)) return true;

  const requesterRecord = await getRequesterRecord(req, db);
  const names = requesterNames(req, requesterRecord);
  const contractors = requesterContractors(req, requesterRecord);
  const nameRegexes = requesterNameRegexes(req, requesterRecord);
  const contractorRegexes = requesterContractorRegexes(req, requesterRecord);
  const deliveryDriver = normalizePartyName(delivery.driverName).toUpperCase();
  const deliveryContractor = normalizePartyName(delivery.userName || delivery.vehiclePlate).toUpperCase();

  if (deliveryDriver && names.includes(deliveryDriver)) return true;
  if (deliveryContractor && contractors.includes(deliveryContractor)) return true;

  const requestedProgramacaoId = req.body?.programacaoId || req.body?.linkedProgramacaoId;
  const programacaoId = requestedProgramacaoId || delivery.programacaoId || delivery.linkedProgramacaoId;
  if (programacaoId) {
    try {
      const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
      const programacao = await ProgramacaoEntrega.findById(programacaoId).lean();
      if (programacao) {
        if (requestedProgramacaoId && !legacyDeliveryMatchesProgramacao(delivery, programacao)) return false;
        const programacaoDriver = normalizePartyName(programacao.motorista).toUpperCase();
        const programacaoContractor = normalizePartyName(programacao.contratado).toUpperCase();
        if (programacaoDriver && names.includes(programacaoDriver)) return true;
        if (programacaoContractor && contractors.includes(programacaoContractor)) return true;
      }
    } catch (_) {}
  }

  if (delivery.deliveryNumber && (nameRegexes.length > 0 || contractorRegexes.length > 0)) {
    try {
      const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
      const cityFilter = {};
      applyProgramacaoCityFilter(cityFilter, delivery.cityCode || req.city || 'manaus');
      const number = String(delivery.deliveryNumber || '').trim();
      const numberRegex = new RegExp(`^${escapeRegExp(number)}$`, 'i');
      const accessOr = [];
      if (nameRegexes.length > 0) accessOr.push({ motorista: { $in: nameRegexes } });
      if (contractorRegexes.length > 0) accessOr.push({ contratado: { $in: contractorRegexes } });

      const programacao = await ProgramacaoEntrega.findOne({
        ...cityFilter,
        ativo: { $ne: false },
        $and: [
          { $or: [{ processoLog: numberRegex }, { processo: numberRegex }, { container: numberRegex }] },
          { $or: accessOr }
        ]
      }).lean();

      if (programacao && legacyDeliveryMatchesProgramacao(delivery, programacao)) return true;
    } catch (_) {}
  }

  return false;
}

// =======================
// Criar entrega
// POST /api/deliveries
// =======================
router.post("/", auth, async (req, res) => {
  try {
    const db = await getDb(req);
    const city = req.city || 'manaus';
    const { deliveryNumber, vehiclePlate, observations, driverName, chegadaMontagemAt, containerMontadoAt, status, programacaoId, linkedProgramacaoId, recebedor } = req.body;

    console.log('ðŸ“¦ Recebido no backend:', { deliveryNumber, vehiclePlate, observations, driverName, containerMontadoAt, status, programacaoId, linkedProgramacaoId, city });

    if (!deliveryNumber) {
      return res.status(400).json({ message: "NÃºmero da entrega obrigatÃ³rio" });
    }

    const driver = await db.findById("drivers", req.user.id);
    let linkedProgramacao = null;
    try {
      const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
      linkedProgramacao = await ProgramacaoEntrega.findOne(
        buildProgramacaoLookupFilter(deliveryNumber, city, programacaoId || linkedProgramacaoId)
      );
    } catch (progErr) {
      console.warn('[DELIVERY] Falha ao buscar programacao para observacao:', progErr.message || progErr);
    }

    const programacaoKey = linkedProgramacao?._id || programacaoId || linkedProgramacaoId || undefined;
    const Delivery = require('../models/Delivery');
    const normalizedDeliveryNumber = String(deliveryNumber || '').trim().toUpperCase();
    const partyName = normalizePartyName(recebedor || linkedProgramacao?.recebedor);
    const baseDeliveryPayload = {
      deliveryNumber: normalizedDeliveryNumber,
      vehiclePlate,
      observations: mergeDeliveryObservations(linkedProgramacao, observations),
      driverName: driverName || "",
      recebedor: partyName,
      armador: String(linkedProgramacao?.armador || req.body?.armador || '').trim(),
      chegadaMontagemAt: chegadaMontagemAt ? new Date(chegadaMontagemAt) : null,
      containerMontadoAt: containerMontadoAt ? new Date(containerMontadoAt) : null,
      userId: req.user.id,
      userName: driver?.fullName || driver?.name || driver?.username || "Unknown",
      status: status || "pending",
      currentStep: 'welcome',
      documents: {},
      linkedProgramacaoId: programacaoKey,
      programacaoId: programacaoKey,
      city,
      cityCode: city
    };

    let delivery = null;
    if (programacaoKey) {
      const baseLookup = {
        cityCode: city,
        isCanceled: { $ne: true }
      };
      const programacaoLookup = {
        ...baseLookup,
        $or: [
          { programacaoId: programacaoKey },
          { linkedProgramacaoId: programacaoKey }
        ]
      };
      const samePartyLookup = partyName ? {
        ...baseLookup,
        deliveryNumber: normalizedDeliveryNumber,
        recebedor: new RegExp(`^${escapeRegExp(partyName)}$`, 'i')
      } : null;
      const sameDriverWithoutPartyLookup = driverName ? {
        ...baseLookup,
        deliveryNumber: normalizedDeliveryNumber,
        driverName: new RegExp(`^${escapeRegExp(driverName)}$`, 'i'),
        $or: [
          { recebedor: '' },
          { recebedor: { $exists: false } },
          { recebedor: null }
        ]
      } : null;

      const existing = await Delivery.findOne(programacaoLookup).lean() ||
        (samePartyLookup ? await Delivery.findOne(samePartyLookup).lean() : null) ||
        (sameDriverWithoutPartyLookup ? await Delivery.findOne(sameDriverWithoutPartyLookup).lean() : null);

      if (existing) {
        delivery = await Delivery.findByIdAndUpdate(
          existing._id,
          {
            $set: {
              updatedAt: new Date(),
              linkedProgramacaoId: existing.linkedProgramacaoId || programacaoKey,
              programacaoId: existing.programacaoId || programacaoKey,
              armador: existing.armador || String(linkedProgramacao?.armador || req.body?.armador || '').trim(),
              ...(partyName ? { recebedor: partyName } : {})
            }
          },
          { new: true }
        ).lean();
      } else {
        delivery = (await Delivery.create(baseDeliveryPayload)).toObject();
      }

      if (delivery && String(delivery.userId) !== String(req.user.id)) {
        console.warn('[DELIVERY] Programacao ja possuia delivery de outro usuario; reutilizando para evitar duplicidade:', {
          deliveryId: delivery._id,
          programacaoKey,
          owner: delivery.userId,
          requester: req.user.id
        });
      }
    } else {
      const lookup = {
        cityCode: city,
        isCanceled: { $ne: true },
        deliveryNumber: normalizedDeliveryNumber,
        ...(partyName ? { recebedor: new RegExp(`^${escapeRegExp(partyName)}$`, 'i') } : {}),
        userId: req.user.id
      };
      const existing = await Delivery.findOne(lookup).lean();
      if (existing) {
        delivery = await Delivery.findByIdAndUpdate(
          existing._id,
          { $set: { updatedAt: new Date(), ...(partyName ? { recebedor: partyName } : {}) } },
          { new: true }
        ).lean();
      } else {
        delivery = (await Delivery.create(baseDeliveryPayload)).toObject();
      }
    }

    // Attempt to update matching programacao to indicate it is now em rota
    try {
      const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
      // Filtrar pelo origem tambÃ©m para garantir que Ã© da mesma cidade
      const prog = linkedProgramacao || await ProgramacaoEntrega.findOne(
        buildProgramacaoLookupFilter(deliveryNumber, city, programacaoId || linkedProgramacaoId)
      );
      if (prog) {
        if (status === 'NO_PORTO_AGUARDANDO_MONTAGEM' || status === 'CONTAINER_MONTADO') {
          prog.status = status;
        }
        // gravar referÃªncia para futuras consultas
        prog.linkedDeliveryId = delivery._id;
        await prog.save();
        console.log('[DELIVERY] Programacao', prog._id, 'status atualizado para', prog.status);
      }
    } catch (syncErr) {
      console.warn('[DELIVERY] Falha ao sincronizar programacao:', syncErr.message || syncErr);
    }

    // DESABILITADO: SincronizaÃ§Ã£o com Icompany foi removida
    // try {
    //   const Icompany = require('../models/Icompany');
    //   // SincronizaÃ§Ã£o desabilitada por requisito do usuÃ¡rio
    // } catch (syncErr) {
    //   console.warn('[DELIVERY] erro sync Icompany:', syncErr.message || syncErr);
    // }

    clearProgramacoesMineCache(city);
    res.status(201).json({ delivery });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao criar entrega" });
  }
});

// =======================
// Minhas entregas
// GET /api/deliveries
// =======================
// âœ… OTIMIZADO: Usa deliveryService com .lean() e Ã­ndices
router.get("/", auth, async (req, res) => {
  try {
    const Delivery = require('../models/Delivery');
    const { status, q, page = 1, limit = 50 } = req.query;
    const city = req.city || 'manaus';
    
    console.log(`âš¡ GET /api/deliveries [OTIMIZADO] user=${req.user.id} city=${city} status=${status || 'all'} search=${q || 'none'}`);
    
    // Construir filtro otimizado - excluir canceladas por padrÃ£o
    const includeCanceled = req.query.includeCanceled === 'true' || req.query.includeCanceled === true;
    const filter = { userId: req.user.id, cityCode: city };
    if (!includeCanceled) {
      filter.isCanceled = { $ne: true };
    }

    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Text search se fornecido
    if (q && String(q).trim() !== '') {
      const term = String(q).trim();
      filter.$or = [
        { deliveryNumber: { $regex: term, $options: 'i' } },
        { driverName: { $regex: term, $options: 'i' } },
        { vehiclePlate: { $regex: term, $options: 'i' } }
      ];
    }
    
    // Query otimizada com .lean() + Ã­ndices existentes
    const skip = (parseInt(page) - 1) * Math.min(parseInt(limit), 100);
    const take = Math.min(parseInt(limit), 100);
    
    const [total, deliveries] = await Promise.all([
      Delivery.countDocuments(filter),
      Delivery
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean()
    ]);
    
    console.log(`âœ“ Found ${deliveries.length} deliveries (total: ${total})`);
    
    res.json({ 
      success: true,
      deliveries: deliveries.map(d => normalizeDeliveryForResponse(d)),
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) }
    });
  } catch (err) {
    console.error('Error fetching deliveries', err);
    res.status(500).json({ message: 'Erro ao buscar entregas' });
  }
});

// =======================
// Buscar entrega
// GET /api/deliveries/:id
// =======================
router.get("/:id", auth, async (req, res) => {
  try {
    const db = await getDb(req);
    const city = req.city || 'manaus';
    const delivery = await db.findById("deliveries", req.params.id);
    if (!delivery) return res.status(404).json({ message: "Entrega nÃ£o encontrada" });
    // Verificar se pertence Ã  cidade do usuÃ¡rio
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }
    // drivers should only access their own deliveries; admins may view all
    if (!(await canAccessDelivery(req, delivery, db))) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    res.json({ delivery: normalizeDeliveryForResponse(delivery) });
  } catch (err) {
    console.error('Error fetching delivery', err);
    res.status(500).json({ message: 'Erro ao buscar entrega' });
  }
});

// =======================
// Atualizar entrega (motorista sÃ³ pode alterar a prÃ³pria)
// PUT /api/deliveries/:id
// fields: status, arrivedAt, observations (other safe ones)
// =======================
router.put("/:id", auth, async (req, res) => {
  try {
    const db = await getDb(req);
    const city = req.city || 'manaus';
    const { id } = req.params;
    const delivery = await db.findById("deliveries", id);
    if (!delivery) return res.status(404).json({ message: "Entrega nÃ£o encontrada" });
    // Verificar se pertence Ã  cidade do usuÃ¡rio
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }
    if (!(await canAccessDelivery(req, delivery, db))) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const programacaoIdFromBody = req.body.programacaoId || req.body.linkedProgramacaoId;
    if (programacaoIdFromBody) {
      const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
      const programacao = await ProgramacaoEntrega.findById(programacaoIdFromBody).lean();
      if (!programacao) {
        return res.status(404).json({ message: 'Programação vinculada não encontrada' });
      }
      if (!deliveryMatchesProgramacaoContext(delivery, programacao)) {
        return res.status(409).json({
          message: 'Esta entrega pertence a outra programação/cliente deste container. Reabra a card correta.'
        });
      }
    }

    // ValidaÃ§Ã£o: verificar se o novo status requer documentos obrigatÃ³rios
    if (req.body.status) {
      const statusDocumentRequirements = {
        'A_CAMINHO_DO_CLIENTE': ['retiradaCheio']
        // 'FINALIZADO' nÃ£o exige devolucaoVazio aqui, pois este campo sÃ³ aparece depois dessa etapa
      };
      const requiredDocs = statusDocumentRequirements[req.body.status];
      if (requiredDocs) {
        for (const doc of requiredDocs) {
          const docs = delivery.documents || {};
          const docEntry = docs[doc];
          if (!docEntry) {
            return res.status(400).json({ message: `Documento obrigatÃ³rio nÃ£o encontrado para avanÃ§ar status: ${doc}` });
          }
          // Se for array, verificar se tem itens
          let parsed;
          if (typeof docEntry === 'string') {
            try {
              parsed = JSON.parse(docEntry);
            } catch (e) {
              parsed = [docEntry];
            }
          } else {
            parsed = docEntry;
          }
          if (!Array.isArray(parsed) || parsed.length === 0) {
            return res.status(400).json({ message: `Documento obrigatÃ³rio nÃ£o encontrado para avanÃ§ar status: ${doc}` });
          }
        }
      }
    }

    // Preparar updates
    const updates = {};
    // Se hÃ¡ mudanÃ§a de status, usar funÃ§Ã£o especializada com validaÃ§Ã£o de ordem
    if (req.body.status) {
      // Verificar se motorista estÃ¡ tentando fazer retrocesso
      const { STATUS_ORDER } = require("../utils/deliveryConcurrency");
      const currentLevel = STATUS_ORDER[delivery.status] || 0;
      const newLevel = STATUS_ORDER[req.body.status] || 0;
      
      if (newLevel < currentLevel && req.body.status !== 'CANCELADO') {
        return res.status(403).json({ message: 'Motorista nÃ£o pode fazer retrocesso de status. Apenas ADM/GERENTE podem.' });
      }

      // Usar updateDeliveryStatus para mudanÃ§a de status (com validaÃ§Ã£o de ordem)
      const statusUpdates = {};
      if (req.body.arrivedAt !== undefined) statusUpdates.arrivedAt = req.body.arrivedAt;
      if (req.body.chegadaMontagemAt !== undefined) statusUpdates.chegadaMontagemAt = req.body.chegadaMontagemAt ? new Date(req.body.chegadaMontagemAt) : null;
      if (req.body.containerMontadoAt !== undefined) statusUpdates.containerMontadoAt = req.body.containerMontadoAt ? new Date(req.body.containerMontadoAt) : null;
      if (req.body.currentStep !== undefined) statusUpdates.currentStep = req.body.currentStep;
      if (req.body.observations !== undefined) {
        statusUpdates.observations = preserveIcompanyObservation(delivery.observations, req.body.observations);
      }
      if (req.body.documentsJustification !== undefined) statusUpdates.documentsJustification = req.body.documentsJustification;
      if (req.body.desovaStartAt !== undefined) statusUpdates.desovaStartAt = req.body.desovaStartAt;
      if (req.body.desovaEndAt !== undefined) statusUpdates.desovaEndAt = req.body.desovaEndAt;
      if (req.body.saidaClienteAt !== undefined) statusUpdates.saidaClienteAt = req.body.saidaClienteAt;
      if (req.body.chegadaPortoAt !== undefined) statusUpdates.chegadaPortoAt = req.body.chegadaPortoAt;
      if (req.body.recebedor !== undefined) statusUpdates.recebedor = req.body.recebedor;
      if (programacaoIdFromBody !== undefined) {
        statusUpdates.programacaoId = programacaoIdFromBody;
        statusUpdates.linkedProgramacaoId = programacaoIdFromBody;
      }
      if (req.body.horarioDevolucaoVazio !== undefined) statusUpdates.horarioDevolucaoVazio = req.body.horarioDevolucaoVazio;

      const updated = await updateDeliveryStatus(delivery._id, req.body.status, statusUpdates, false);
      const shouldMarkReturned = updated.horarioDevolucaoVazio;
      const programacaoToUpdate = programacaoIdFromBody || updated.programacaoId || updated.linkedProgramacaoId;

      if (shouldMarkReturned && programacaoToUpdate) {
        try {
          const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
          console.log(`[CONTAINER_RETURN] Marcando containerReturned=true na programaÃ§Ã£o ${programacaoToUpdate}`);
          await ProgramacaoEntrega.findByIdAndUpdate(programacaoToUpdate, {
            containerReturned: true,
            status: 'FINALIZADO'
          });
          console.log(`[CONTAINER_RETURN] âœ… ProgramaÃ§Ã£o ${programacaoToUpdate} atualizada`);
        } catch (e) {
          console.error('[CONTAINER_RETURN] Erro ao atualizar programaÃ§Ã£o:', e.message);
        }
      }

      clearProgramacoesMineCache(city);
      return res.json({ delivery: normalizeDeliveryForResponse(updated) });
    }

    // Para updates sem mudanÃ§a de status, usar updateDeliveryAtomic
    if (req.body.arrivedAt !== undefined) updates.arrivedAt = req.body.arrivedAt;
    if (req.body.chegadaMontagemAt !== undefined) updates.chegadaMontagemAt = req.body.chegadaMontagemAt ? new Date(req.body.chegadaMontagemAt) : null;
    if (req.body.containerMontadoAt !== undefined) updates.containerMontadoAt = req.body.containerMontadoAt ? new Date(req.body.containerMontadoAt) : null;
    if (req.body.currentStep !== undefined) updates.currentStep = req.body.currentStep;
    if (req.body.observations !== undefined) {
      updates.observations = preserveIcompanyObservation(delivery.observations, req.body.observations);
    }
    if (req.body.documentsJustification !== undefined) updates.documentsJustification = req.body.documentsJustification;
    if (req.body.desovaStartAt !== undefined) updates.desovaStartAt = req.body.desovaStartAt;
    if (req.body.desovaEndAt !== undefined) updates.desovaEndAt = req.body.desovaEndAt;
    if (req.body.saidaClienteAt !== undefined) updates.saidaClienteAt = req.body.saidaClienteAt;
    if (req.body.chegadaPortoAt !== undefined) updates.chegadaPortoAt = req.body.chegadaPortoAt;
    if (req.body.recebedor !== undefined) updates.recebedor = req.body.recebedor;

    // Se programacaoId for fornecido, guardar (serÃ¡ usado para atualizar depois)
    if (programacaoIdFromBody !== undefined) {
      updates.programacaoId = programacaoIdFromBody;
      updates.linkedProgramacaoId = programacaoIdFromBody;
    }

    if (req.body.horarioDevolucaoVazio !== undefined) updates.horarioDevolucaoVazio = req.body.horarioDevolucaoVazio;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Nada para atualizar' });
    }

    const updated = await updateDeliveryAtomic(delivery._id, updates);

    // Se houver horÃ¡rio de devoluÃ§Ã£o vazio agora (seja de antes ou desta chamada),
    // marca containerReturned na programaÃ§Ã£o vinculada
    const shouldMarkReturned = updated.horarioDevolucaoVazio;
    const programacaoToUpdate = programacaoIdFromBody || updated.programacaoId || updated.linkedProgramacaoId;
    
    if (shouldMarkReturned && programacaoToUpdate) {
      try {
        const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
        console.log(`[CONTAINER_RETURN] Marcando containerReturned=true na programaÃ§Ã£o ${programacaoToUpdate}`);
        await ProgramacaoEntrega.findByIdAndUpdate(programacaoToUpdate, {
          containerReturned: true,
          status: 'FINALIZADO'
        });
        console.log(`[CONTAINER_RETURN] âœ… ProgramaÃ§Ã£o ${programacaoToUpdate} atualizada`);
      } catch (e) {
        console.error('[CONTAINER_RETURN] Erro ao atualizar programaÃ§Ã£o:', e.message);
      }
    }

    clearProgramacoesMineCache(city);
    res.json({ delivery: normalizeDeliveryForResponse(updated) });
  } catch (err) {
    console.error('Error updating delivery', err);
    res.status(500).json({ message: 'Erro ao atualizar entrega' });
  }
});

// =======================
// ProgramaÃ§Ãµes vinculadas ao contratado do usuÃ¡rio
// GET /api/programacoes/mine
// Retorna programaÃ§Ãµes pendentes vinculadas ao contratado do usuÃ¡rio autenticado
// =======================
router.get('/programacoes/mine', auth, async (req, res) => {
  try {
    console.log('[PROGRAMACAO] ðŸš€ OTIMIZADO - Buscando programaÃ§Ãµes do usuÃ¡rio:', req.user.id);
    const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
    const Delivery = require('../models/Delivery');

    // Obter contratado do usuÃ¡rio
    const db = await getDb(req);
    let driverRecord = null;
    try {
      driverRecord = await db.findById('drivers', req.user.id);
    } catch (e) {
      console.warn('[PROGRAMACAO] Aviso: falha ao buscar registro do usuÃ¡rio:', e?.message);
    }

    const contratadoRaw = (driverRecord && (driverRecord.contratado || driverRecord.transportadora || driverRecord.name || driverRecord.fullName)) || (req.user?.transportadora || req.user?.contratado) || '';
    const contratado = String(contratadoRaw || '').trim();

    if (!contratado) {
      return res.json({ success: true, programacoes: [] });
    }

    const city = req.city || 'manaus';
    const regex = new RegExp(`^${contratado}$`, 'i');
    const cacheKey = `${req.user.id}:${city}:${contratado.toUpperCase()}`;
    const cached = programacoesMineCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < PROGRAMACOES_MINE_CACHE_MS) {
      res.set('Cache-Control', 'private, max-age=10');
      return res.json(cached.payload);
    }
    
    let cityFilter = {};
    applyProgramacaoCityFilter(cityFilter, city);
    
    // âœ… OTIMIZADO: Query com Ã­ndices compostos
    const programacoes = await ProgramacaoEntrega.find({
      ...cityFilter,
      contratado: regex,
      ativo: { $ne: false },
      status: { $ne: 'CANCELADO' },
      containerReturned: { $ne: true }
    })
      .select('processo processoLog recebedor remetente destinatario container armador dataAgendamento dtColeta contratado motorista linkedDeliveryId status containerReturned observacoes origem estab sentido createdAt updatedAt')
      .sort({ dataAgendamento: -1 })
      .lean();  // .lean() = 60% mais rÃ¡pido
    
    console.log(`[PROGRAMACAO] âœ“ Encontradas ${programacoes.length} programaÃ§Ãµes para ${contratado}`);

    // âœ… OTIMIZADO: Ao invÃ©s de carregar TODAS as entregas em memÃ³ria,
    // usar apenas as linkedDeliveryId necessÃ¡rias
    const programacaoIds = (programacoes || [])
      .map(p => p._id)
      .filter(Boolean);

    const linkedIds = (programacoes || [])
      .map(p => p.linkedDeliveryId)
      .filter(Boolean);
    
    const deliveriesByLinkedId = new Map();
    const deliveriesByProgramacaoId = new Map();
    const deliverySelect = 'deliveryNumber status programacaoId linkedProgramacaoId linkedDeliveryId missingDocumentsAtSubmit chegadaMontagemAt horarioDevolucaoVazio containerReturned updatedAt createdAt recebedor userName driverName cityCode';
    if (linkedIds.length > 0) {
      const linkedDeliveries = await Delivery.find({ _id: { $in: linkedIds } }).select(deliverySelect).lean();
      linkedDeliveries.forEach(d => {
        deliveriesByLinkedId.set(String(d._id), d);
      });
    }

    if (programacaoIds.length > 0) {
      const programacaoDeliveries = await Delivery.find({
        $or: [
          { programacaoId: { $in: programacaoIds } },
          { linkedProgramacaoId: { $in: programacaoIds } }
        ],
        isCanceled: { $ne: true }
      }).select(deliverySelect).lean();

      programacaoDeliveries.forEach(d => {
        [d.programacaoId, d.linkedProgramacaoId].filter(Boolean).forEach(id => {
          const key = String(id);
          const existing = deliveriesByProgramacaoId.get(key);
          if (!existing || new Date(d.updatedAt || d.createdAt || 0) >= new Date(existing.updatedAt || existing.createdAt || 0)) {
            deliveriesByProgramacaoId.set(key, d);
          }
        });
      });
    }
    
    // Buscar por nÃºmero/processo tambÃ©m para validar linkedDeliveryId legado.
    // Programacoes com mesmo container e clientes diferentes nao podem herdar o mesmo delivery.
    const toMatch = programacoes;
    const matchedNumbers = [...new Set(
      toMatch.flatMap(p => [p.processoLog, p.processo, p.container])
        .map(value => String(value || '').trim())
        .filter(Boolean)
    )];
    
    const unmatchedDeliveries = matchedNumbers.length > 0 
      ? await Delivery.find({
        deliveryNumber: { $in: matchedNumbers.map(value => new RegExp(`^${escapeRegExp(value)}$`, 'i')) },
        cityCode: city,
        isCanceled: { $ne: true }
      }).select(deliverySelect).lean()
      : [];
    
    const deliveriesByNumber = new Map();
    unmatchedDeliveries.forEach(d => {
      const key = String(d.deliveryNumber || '').toUpperCase();
      if (!key) return;
      if (!deliveriesByNumber.has(key)) deliveriesByNumber.set(key, []);
      deliveriesByNumber.get(key).push(d);
    });

    // Enriquecer programaÃ§Ãµes e remover as que jÃ¡ tiveram devoluÃ§Ã£o confirmada
    const enrichedProgramacoes = (programacoes || []).map((p) => {
      const obj = { ...p };
      const deliveryMatchesProgramacao = (delivery) => deliveryMatchesProgramacaoContext(delivery, p);
      
      // Tentar buscar entrega vinculada
      let matchedDelivery = deliveriesByProgramacaoId.get(String(p._id)) ||
        deliveriesByLinkedId.get(String(p.linkedDeliveryId));
      if (matchedDelivery && !legacyDeliveryMatchesProgramacao(matchedDelivery, p)) {
        matchedDelivery = null;
      }
      
      if (!matchedDelivery) {
        const logKey = String(p.processoLog || '').toUpperCase();
        const procKey = String(p.processo || '').toUpperCase();
        const contKey = String(p.container || '').toUpperCase();
        const candidates = [
          ...(deliveriesByNumber.get(logKey) || []),
          ...(deliveriesByNumber.get(procKey) || []),
          ...(deliveriesByNumber.get(contKey) || [])
        ].filter(delivery => deliveryMatchesProgramacao(delivery) || legacyDeliveryMatchesProgramacao(delivery, p));
        matchedDelivery = candidates
          .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0];
      }
      
      if (matchedDelivery) {
        obj.linkedDeliveryId = matchedDelivery._id;
        obj.missingDocumentsAtSubmit = matchedDelivery.missingDocumentsAtSubmit || [];
        obj.status = matchedDelivery.status || obj.status;
        if (isReturnedDelivery(matchedDelivery)) {
          obj.horarioDevolucaoVazio = matchedDelivery.horarioDevolucaoVazio;
          obj.containerReturned = true;
          obj.status = 'FINALIZADO';
        }
      }
      
      return obj;
    }).filter(p => {
      const hasPendingDocuments = Array.isArray(p.missingDocumentsAtSubmit) && p.missingDocumentsAtSubmit.length > 0;
      return hasPendingDocuments || (p.containerReturned !== true && !p.horarioDevolucaoVazio);
    });

    const payload = { success: true, programacoes: enrichedProgramacoes || [] };
    programacoesMineCache.set(cacheKey, { createdAt: Date.now(), payload });
    res.set('Cache-Control', 'private, max-age=10');
    return res.json(payload);
  } catch (err) {
    console.error('[PROGRAMACAO] Erro:', err.message);
    return res.status(500).json({ message: 'Erro ao listar programaÃ§Ãµes', error: err.message });
  }
});

// =======================
// Upload documento (aceita mÃºltiplos arquivos)
// POST /api/deliveries/:id/documents/:type
// =======================
router.post("/:id/documents/:type", auth, upload.array("file"), async (req, res) => {
  try {
    const { id, type } = req.params;
    const city = req.city || 'manaus';
    console.log(`[UPLOAD] Iniciando upload para entrega ${id}, tipo ${type}, cidade ${city}`);
    console.log(`[UPLOAD] req.files:`, req.files);
    const db = await getDb(req);
    const delivery = await db.findById("deliveries", id);
    if (!delivery) {
      console.error(`[UPLOAD] Entrega nÃ£o encontrada: ${id}`);
      return res.status(404).json({ message: "Entrega nÃ£o encontrada" });
    }
    
    // ValidaÃ§Ã£o de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    if (!(await canAccessDelivery(req, delivery, db))) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const baseName = getDocumentFileBaseName(type, city);
    const containerFolder = getDeliveryStorageFolder(delivery);
    const containerDir = path.join(getUploadsBaseDir(), city, containerFolder);
    try {
      fs.mkdirSync(containerDir, { recursive: true });
    } catch (err) {
      console.error(`[UPLOAD] Falha ao criar pasta: ${containerDir}`, err);
      return res.status(500).json({ message: "Erro ao criar pasta de upload", error: err.message });
    }

    const docs = delivery.documents || {};
    const existing = normalizeDocumentEntries(docs[type]);

    const savedFiles = [];

    if (req.files && req.files.length) {
      for (let idx = 0; idx < req.files.length; idx++) {
        const file = req.files[idx];
        const originalExt = path.extname(file.originalname) || ".jpg";
        const finalFilename = `${baseName}_${delivery.deliveryNumber}_${Date.now()}_${idx}${originalExt}`;
        console.log(`[UPLOAD] Processando arquivo ${idx + 1}/${req.files.length}: ${file.originalname} -> ${finalFilename}`);
        
        let fileEntry = null;
        
        // Try R2 (Cloudflare) first
        try {
          console.log(`[UPLOAD] Tentando Cloudflare R2...`);
          const r2Storage = require('../storage/r2');
          const fileBuffer = file.buffer || fs.readFileSync(file.path);
          const r2Key = `uploads/${city}/${containerFolder}/${finalFilename}`;
          const r2Url = await r2Storage.uploadBuffer(fileBuffer, r2Key, file.mimetype);
          fileEntry = { name: finalFilename, url: r2Url, storage: 'r2', key: r2Key };
          console.log(`[UPLOAD] âœ“ R2 OK: ${finalFilename} (URL: ${r2Url})`);
        } catch (err) {
          console.warn(`[UPLOAD] âš ï¸ R2 FALHOU:`, err && err.message ? err.message : err);
          console.warn(`[UPLOAD] âš ï¸ Fazendo fallback para armazenamento local...`);
        }
        
        // If R2 failed, use local storage as fallback
        if (!fileEntry) {
          try {
            const dest = path.join(containerDir, finalFilename);
            const fileBuffer = file.buffer || fs.readFileSync(file.path);
            fs.writeFileSync(dest, fileBuffer);
            fileEntry = {
              name: finalFilename,
              path: path.join(city, containerFolder, finalFilename),
              storage: 'local',
              pendingR2: true,
              r2Key: `uploads/${city}/${containerFolder}/${finalFilename}`,
              mimetype: file.mimetype
            };
            console.log(`[UPLOAD] âœ“ Arquivo salvo LOCALMENTE (fallback): ${finalFilename}`);
          } catch (err) {
            console.error(`[UPLOAD] âœ— Local save falhou:`, err && err.message ? err.message : err);
            continue; // skip this file
          }
        }
        
        // Add the entry (either R2 or local)
        if (fileEntry) {
          savedFiles.push(fileEntry);
          console.log(`[UPLOAD] âœ… Arquivo ${idx + 1} adicionado. Total: ${savedFiles.length}`);
        }
      }
      
      console.log(`[UPLOAD] ===== RESUMO DO UPLOAD =====`);
      console.log(`[UPLOAD] Arquivos recebidos: ${req.files.length}`);
      console.log(`[UPLOAD] Arquivos salvos com sucesso: ${savedFiles.length}`);
      console.log(`[UPLOAD] Tipo de documento: ${type}`);
      console.log(`[UPLOAD] savedFiles:`, JSON.stringify(savedFiles));

      if (req.files.length > 0 && savedFiles.length === 0) {
        console.error('[UPLOAD] Nenhum arquivo foi salvo durante upload. Aborting.');
        return res.status(500).json({ message: 'Erro ao fazer upload: nenhum arquivo salvo (verifique configuraÃ§Ã£o de R2 ou armazenamento local)' });
      }

      // Combine existing docs and newly saved files
      const allFiles = [...existing, ...savedFiles];
      const deduped = [];
      const seen = new Set();
      
      console.log(`[UPLOAD] Antes dedup - existing: ${existing.length}, savedFiles: ${savedFiles.length}, total: ${allFiles.length}`);
      
      for (const item of allFiles) {
        if (!item) continue;
        // Use url (R2) or path (local) as unique key
        const uniqueKey = item.url || item.path || item.link || JSON.stringify(item);
        if (seen.has(uniqueKey)) {
          console.log(`[UPLOAD] Dedupe: pulando item duplicado (key: ${uniqueKey})`);
          continue;
        }
        seen.add(uniqueKey);
        deduped.push(item);
      }
      
      console.log(`[UPLOAD] Depois dedup: ${deduped.length} itens mantidos`);
      console.log(`[UPLOAD] deduped array:`, JSON.stringify(deduped));

      // normalize: store arrays as JSON string, single item as string/object as before
      const normalizedDocs = {};
      for (const [k, v] of Object.entries(docs)) {
        if (k === type) continue; // we'll set it below
        normalizedDocs[k] = Array.isArray(v) ? JSON.stringify(v) : v;
      }

      normalizedDocs[type] = deduped.length === 0 ? null : JSON.stringify(deduped);

      try {
        await db.updateOne("deliveries", { _id: id }, { documents: normalizedDocs });
      } catch (err) {
        console.error(`[UPLOAD] Falha ao atualizar documentos no banco:`, err);
        return res.status(500).json({ message: "Erro ao salvar documentos no banco", error: err.message });
      }

      // Atualizar missingDocumentsAtSubmit: remover este tipo se foi carregado com sucesso
      const updated = await db.findById("deliveries", id);
      if (updated.missingDocumentsAtSubmit && Array.isArray(updated.missingDocumentsAtSubmit) && updated.missingDocumentsAtSubmit.includes(type)) {
        const newMissing = updated.missingDocumentsAtSubmit.filter(d => d !== type);
        console.log(`[UPLOAD] Removendo "${type}" de missingDocumentsAtSubmit. PendÃªncias restantes:`, newMissing);
        
        // TambÃ©m limpar o log de correÃ§Ã£o para este documento especÃ­fico
        let newCorrectionLog = updated.documentCorrectionLog || [];
        if (Array.isArray(newCorrectionLog)) {
          newCorrectionLog = newCorrectionLog.filter(log => log.documentType !== type);
          console.log(`[UPLOAD] Limpando log de correÃ§Ã£o para "${type}". Logs restantes:`, newCorrectionLog.length);
        }
        
        await db.updateOne("deliveries", { _id: id }, { missingDocumentsAtSubmit: newMissing, documentCorrectionLog: newCorrectionLog });
      }
    } else {
      console.warn('[UPLOAD] Nenhum arquivo recebido no upload.');
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }
    const updated = await db.findById("deliveries", id);
    savedFiles
      .filter(file => file && file.pendingR2 && file.path)
      .forEach(fileEntry => enqueueR2Retry({
        deliveryId: updated._id || id,
        documentType: type,
        fileEntry,
        localFilePath: path.join(getUploadsBaseDir(), fileEntry.path)
      }));
    if (type === 'devolucaoVazio' || type === 'devolucaoContainerVazio') {
      try {
        const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
        const programacaoToUpdate = updated.programacaoId || updated.linkedProgramacaoId;
        if (programacaoToUpdate) {
          await ProgramacaoEntrega.findByIdAndUpdate(programacaoToUpdate, {
            containerReturned: true,
            status: 'FINALIZADO',
            updatedAt: new Date()
          });
        }
      } catch (progErr) {
        console.warn('[UPLOAD] Falha ao marcar devolucao na programacao:', progErr.message || progErr);
      }
    }
    res.json({ delivery: normalizeDeliveryForResponse(updated) });
  } catch (err) {
    console.error("[UPLOAD] Erro geral ao upload:", err);
    res.status(500).json({ message: "Erro ao fazer upload", error: err.message });
  }
});

// =======================
// Upload documento e atualizar status atomicamente
// POST /api/deliveries/:id/upload-and-update
// =======================
router.post("/:id/upload-and-update", auth, upload.array("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType, status, currentStep } = req.body;
    const city = req.city || 'manaus';
    console.log(`[UPLOAD-UPDATE] Iniciando upload e update para entrega ${id}, tipo ${documentType}, status ${status}, city ${city}`);
    
    const db = await getDb(req);
    const delivery = await db.findById("deliveries", id);
    if (!delivery) {
      console.error(`[UPLOAD-UPDATE] Entrega nÃ£o encontrada: ${id}`);
      return res.status(404).json({ message: "Entrega nÃ£o encontrada" });
    }
    
    // ValidaÃ§Ã£o de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    if (!(await canAccessDelivery(req, delivery, db))) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // First, upload the documents
    const docs = delivery.documents || {};
    const existing = normalizeDocumentEntries(docs[documentType]);

    const savedFiles = [];

    if (req.files && req.files.length) {
      const baseName = getDocumentFileBaseName(documentType, city);
      const containerFolder = getDeliveryStorageFolder(delivery);
      const containerDir = path.join(getUploadsBaseDir(), city, containerFolder);
      try {
        fs.mkdirSync(containerDir, { recursive: true });
      } catch (err) {
        console.error(`[UPLOAD-UPDATE] Falha ao criar pasta: ${containerDir}`, err);
        return res.status(500).json({ message: "Erro ao criar pasta de upload", error: err.message });
      }

      for (let idx = 0; idx < req.files.length; idx++) {
        const file = req.files[idx];
        const originalExt = path.extname(file.originalname) || ".jpg";
        const finalFilename = `${baseName}_${delivery.deliveryNumber}_${Date.now()}_${idx}${originalExt}`;
        console.log(`[UPLOAD-UPDATE] Processando arquivo ${idx + 1}/${req.files.length}: ${file.originalname} -> ${finalFilename}`);
        
        let fileEntry = null;
        
        // Try R2
        try {
          console.log(`[UPLOAD-UPDATE] Tentando Cloudflare R2...`);
          const r2Storage = require('../storage/r2');
          const fileBuffer = file.buffer || fs.readFileSync(file.path);
          const r2Key = `uploads/${city}/${containerFolder}/${finalFilename}`;
          const r2Url = await r2Storage.uploadBuffer(fileBuffer, r2Key, file.mimetype);
          fileEntry = { name: finalFilename, url: r2Url, storage: 'r2', key: r2Key };
          console.log(`[UPLOAD-UPDATE] âœ“ R2 OK: ${finalFilename} (URL: ${r2Url})`);
        } catch (err) {
          console.warn(`[UPLOAD-UPDATE] âš ï¸ R2 FALHOU:`, err && err.message ? err.message : err);
          // Fallback to local
          try {
            const dest = path.join(containerDir, finalFilename);
            const fileBuffer = file.buffer || fs.readFileSync(file.path);
            fs.writeFileSync(dest, fileBuffer);
            fileEntry = {
              name: finalFilename,
              path: path.join(city, containerFolder, finalFilename),
              storage: 'local',
              pendingR2: true,
              r2Key: `uploads/${city}/${containerFolder}/${finalFilename}`,
              mimetype: file.mimetype
            };
            console.log(`[UPLOAD-UPDATE] âœ“ Arquivo salvo LOCALMENTE: ${finalFilename}`);
          } catch (err) {
            console.error(`[UPLOAD-UPDATE] âœ— Local save falhou:`, err && err.message ? err.message : err);
            continue;
          }
        }
        
        if (fileEntry) {
          savedFiles.push(fileEntry);
        }
      }
      
      if (req.files.length > 0 && savedFiles.length === 0) {
        console.error('[UPLOAD-UPDATE] Nenhum arquivo foi salvo.');
        return res.status(500).json({ message: 'Erro ao fazer upload: nenhum arquivo salvo' });
      }

      // Update documents in DB
      const allFiles = [...existing, ...savedFiles];
      const deduped = [];
      const seen = new Set();
      
      for (const item of allFiles) {
        if (!item) continue;
        const uniqueKey = getDocumentUniqueKey(item);
        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);
        deduped.push(item);
      }
      
      const normalizedDocs = {};
      for (const [k, v] of Object.entries(docs)) {
        if (k === documentType) continue;
        normalizedDocs[k] = Array.isArray(v) ? JSON.stringify(v) : v;
      }
      normalizedDocs[documentType] = deduped.length === 0 ? null : JSON.stringify(deduped);

      const allowedFields = [
        "currentStep",
        "observations",
        "documentsJustification",
        "arrivedAt",
        "desovaStartAt",
        "desovaEndAt",
        "saidaClienteAt",
        "chegadaPortoAt",
        "recebedor",
        "horarioDevolucaoVazio",
        "containerMontadoAt"
      ];

      const safeUpdates = {};
      const dateFields = ["arrivedAt", "desovaStartAt", "desovaEndAt", "saidaClienteAt", "chegadaPortoAt", "horarioDevolucaoVazio", "containerMontadoAt"];
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          let value = req.body[field];
          // Converter campos de data para object Date se fornecido como string
          if (dateFields.includes(field) && value) {
            value = new Date(value);
          }
          safeUpdates[field] = value;
        }
      }
      const programacaoIdFromBody = req.body.programacaoId || req.body.linkedProgramacaoId;
      if (programacaoIdFromBody && !delivery.programacaoId && !delivery.linkedProgramacaoId) {
        safeUpdates.programacaoId = programacaoIdFromBody;
        safeUpdates.linkedProgramacaoId = programacaoIdFromBody;
      }

      // Now, update the delivery with documents and status
      const updates = { documents: normalizedDocs };
      if (status) {
        // Se hÃ¡ mudanÃ§a de status, usar funÃ§Ã£o especializada
        const statusUpdates = { documents: normalizedDocs };
        for (const [field, value] of Object.entries(safeUpdates)) {
          statusUpdates[field] = value;
        }
        const updated = await updateDeliveryStatus(delivery._id, status, statusUpdates);
        savedFiles
          .filter(file => file && file.pendingR2 && file.path)
          .forEach(fileEntry => enqueueR2Retry({
            deliveryId: updated._id || delivery._id,
            documentType,
            fileEntry,
            localFilePath: path.join(getUploadsBaseDir(), fileEntry.path)
          }));
        if (updated.horarioDevolucaoVazio) {
          const programacaoToUpdate = updated.programacaoId || updated.linkedProgramacaoId;
          if (programacaoToUpdate) {
            try {
              const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
              await ProgramacaoEntrega.findByIdAndUpdate(programacaoToUpdate, {
                containerReturned: true,
                status: 'FINALIZADO'
              });
            } catch (e) {
              console.error('[CONTAINER_RETURN] Erro ao atualizar programaÃ§Ã£o no upload-and-update:', e.message);
            }
          }
        }
        return res.json({ delivery: normalizeDeliveryForResponse(updated) });
      } else {
        // Sem mudanÃ§a de status, usar update atÃ´mico
        for (const [field, value] of Object.entries(safeUpdates)) {
          updates[field] = value;
        }

        const updated = await updateDeliveryAtomic(delivery._id, updates);
        savedFiles
          .filter(file => file && file.pendingR2 && file.path)
          .forEach(fileEntry => enqueueR2Retry({
            deliveryId: updated._id || delivery._id,
            documentType,
            fileEntry,
            localFilePath: path.join(getUploadsBaseDir(), fileEntry.path)
          }));
        return res.json({ delivery: normalizeDeliveryForResponse(updated) });
      }
    } else {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }
  } catch (err) {
    console.error("[UPLOAD-UPDATE] Erro geral:", err);
    res.status(500).json({ message: "Erro ao fazer upload e atualizar", error: err.message });
  }
});

// =======================
// Deletar um documento especÃ­fico por Ã­ndice
// DELETE /api/deliveries/:id/documents/:type/:index
// =======================
router.delete('/:id/documents/:type/:index', auth, async (req, res) => {
  try {
    const { id, type, index } = req.params;
    const city = req.city || 'manaus';
    const db = await getDb(req);
    const delivery = await db.findById('deliveries', id);
    if (!delivery) return res.status(404).json({ message: 'Entrega nÃ£o encontrada' });
    
    // ValidaÃ§Ã£o de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }
    
    const docs = delivery.documents || {};
    const docEntry = docs[type];

    if (!docEntry) return res.status(404).json({ message: 'Documento nÃ£o encontrado' });

    const idx = parseInt(index, 10);

    // Se for string simples, sÃ³ remove
    if (!Array.isArray(docEntry)) {
      const entry = docEntry;
      // If S3 URL, attempt to delete by key
      if (entry && entry.startsWith && entry.startsWith('http') && useS3) {
        try {
          // Expecting https://{bucket}.s3.{region}.amazonaws.com/{key}
          const url = new URL(entry);
          const key = url.pathname.replace(/^\//, '');
          await s3.deleteKey(key);
        } catch (err) {
          console.warn('Failed to delete from S3:', err.message);
        }
      } else {
        // remove file from disk
        const filePath = path.join(__dirname, '../uploads', city, entry);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      docs[type] = null;
      await db.updateOne('deliveries', { _id: id }, { documents: docs });

      // Restaurar na lista de pendÃªncias se era faltante
      const updated = await db.findById('deliveries', id);
      if (updated.missingDocumentsAtSubmit && Array.isArray(updated.missingDocumentsAtSubmit)) {
        if (!updated.missingDocumentsAtSubmit.includes(type)) {
          const newMissing = [...updated.missingDocumentsAtSubmit, type];
          console.log(`[DELETE] Documento removido (string), restaurando "${type}" em missingDocumentsAtSubmit:`, newMissing);
          await db.updateOne('deliveries', { _id: id }, { missingDocumentsAtSubmit: newMissing });
        }
      }

      const finalUpdated = await db.findById('deliveries', id);
      return res.json({ delivery: finalUpdated });
    }

    // Array: remove Ã­ndice
    if (idx < 0 || idx >= docEntry.length) return res.status(400).json({ message: 'Ãndice invÃ¡lido' });

    const removed = docEntry.splice(idx, 1)[0];

    if (removed && removed.startsWith && removed.startsWith('http') && useS3) {
      try {
        const url = new URL(removed);
        const key = url.pathname.replace(/^\//, '');
        await s3.deleteKey(key);
      } catch (err) {
        console.warn('Failed to delete from S3:', err.message);
      }
    } else {
      const filePath = path.join(__dirname, '../uploads', city, removed);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Normaliza: se ficar vazio, define null
    docs[type] = docEntry.length ? docEntry : null;
    await db.updateOne('deliveries', { _id: id }, { documents: docs });

    // Se deletou e ficou vazio, restaurar na lista de pendÃªncias se a entrega foi forÃ§ada (ItajaÃ­)
    const updated = await db.findById('deliveries', id);
    if (!docs[type] && updated.missingDocumentsAtSubmit && Array.isArray(updated.missingDocumentsAtSubmit)) {
      if (!updated.missingDocumentsAtSubmit.includes(type)) {
        const newMissing = [...updated.missingDocumentsAtSubmit, type];
        console.log(`[DELETE] Documento removido, restaurando "${type}" em missingDocumentsAtSubmit:`, newMissing);
        await db.updateOne('deliveries', { _id: id }, { missingDocumentsAtSubmit: newMissing });
      }
    }

    const finalUpdated = await db.findById('deliveries', id);
    res.json({ delivery: finalUpdated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao deletar documento' });
  }
});

// =======================
// Enviar entrega
// POST /api/deliveries/:id/submit
// =======================
router.post("/:id/submit", auth, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const db = await getDb(req);
    console.log('ðŸ“© Submit request', { id: req.params.id, body: req.body, cidade: city, headers: { 'x-city': req.header('x-city'), host: req.headers.host } });

    const delivery = await db.findById('deliveries', req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Entrega nÃ£o encontrada' });
    
    // ValidaÃ§Ã£o de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    // Check ownership: prefer driverId if present, else userId
    if (!(await canAccessDelivery(req, delivery, db))) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // Check if already submitted
    if (delivery.status === 'submitted') {
      return res.status(400).json({ success: false, message: 'Entrega jÃ¡ foi enviada' });
    }

    // Helper to determine if a document field has any files
    const docHasFiles = (val) => {
      if (!val) return false;
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === 'string') {
        // may be JSON string of array
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed.length > 0;
          return Boolean(parsed);
        } catch (e) {
          return Boolean(val && val.trim());
        }
      }
      if (typeof val === 'object') {
        return Object.keys(val).length > 0;
      }
      return Boolean(val);
    };

    // Determine required docs for city
    // devolucaoVazio Ã© opcional nesta etapa (feito separadamente)
    const requiredDocs = ['canhotNF', 'canhotCTE', 'diarioBordo', 'retiradaCheio'];

    const missingDocs = requiredDocs.filter(doc => !docHasFiles(delivery.documents && delivery.documents[doc]));

    const { force, observation } = req.body || {};
    console.log('  -> missingDocs:', missingDocs, 'force:', force, 'observation:', observation);

    if (missingDocs.length > 0) {
      // Manaus ainda exige forÃ§a/observaÃ§Ã£o para docs faltantes
      if (city !== 'itajai') {
        if (!force) {
          return res.status(400).json({ message: 'Documentos obrigatÃ³rios faltando: ' + missingDocs.join(', ') });
        }
        if (!observation || !String(observation || '').trim()) {
          return res.status(400).json({ message: 'ObservaÃ§Ã£o obrigatÃ³ria para finalizar com documentos faltando' });
        }
      }

      // For ItajaÃ­ aceita, mas registra pendÃªncia para o fluxo de canhotos pendentes
      const updates = {
        status: 'submitted',
        submittedAt: new Date(),
        missingDocumentsAtSubmit: missingDocs,
        submissionForce: true,
        submissionObservation: observation ? String(observation).trim() : '',
        pendenciaResponsavel: 'geolog',
        pendenciaStatus: 'AGUARDANDO_GEOLOG',
        pendenciaHistorico: [
          {
            from: 'motorista',
            to: 'geolog',
            by: req.user?.name || req.user?.username || req.user?.email || 'motorista',
            role: req.user?.role || 'driver',
            message: observation || 'Documentos obrigatorios nao anexados',
            action: 'pendencia_criada',
            createdAt: new Date()
          }
        ]
      };
      await db.updateOne('deliveries', { _id: req.params.id }, updates);

      // Criar notificaÃ§Ã£o para gestores/administradores sobre canhotos retidos
      try {
        await NotificationService.notifyCanhotoRetido(
          req.params.id,
          delivery.deliveryNumber || 'N/A',
          observation || 'Documentos obrigatÃ³rios nÃ£o anexados',
          city
        );
      } catch (notifError) {
        console.warn('Erro ao criar notificaÃ§Ã£o de canhoto retido:', notifError);
        // NÃ£o falha a operaÃ§Ã£o principal por causa da notificaÃ§Ã£o
      }

      const deliveryAfterUpdate = await db.findById('deliveries', req.params.id);
      return res.json({ message: 'Entrega enviada com sucesso (com pendÃªncias)', delivery: deliveryAfterUpdate });
    }

    // No missing docs, mark as submitted and limpar pendÃªncias
    await db.updateOne('deliveries', { _id: req.params.id }, {
      status: 'submitted',
      submittedAt: new Date(),
      missingDocumentsAtSubmit: [],
      pendenciaStatus: 'RESOLVIDA'
    });
    const deliveryAfterUpdate = await db.findById('deliveries', req.params.id);
    return res.json({ success: true, message: 'Entrega enviada com sucesso', delivery: deliveryAfterUpdate });
  } catch (err) {
    console.error('Erro no submit:', err);
    return res.status(500).json({ message: 'Erro ao enviar entrega', error: err.message });
  }
});

// =======================
// Deletar rascunho
// DELETE /api/deliveries/:id
// =======================
const { deleteDeliveryFiles, normalizeEntries } = require('../utils/storageUtils');

router.delete("/:id", auth, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const db = req.mockdb;
    const delivery = await db.findById("deliveries", req.params.id);
    if (!delivery) return res.status(404).json({ message: "Entrega nÃ£o encontrada" });
    
    // ValidaÃ§Ã£o de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    // NOVO: Se gestor_contratado, validar se Ã© do seu contratado
    if (req.user && req.user.role === 'gestor_contratado' && req.user.contratado) {
      if (delivery.userName !== req.user.contratado) {
        return res.status(403).json({ message: 'Acesso negado - entrega de outro contratado' });
      }
    }

    if (delivery.status !== "pending") {
      return res.status(400).json({ message: "Entrega enviada nÃ£o pode ser deletada" });
    }

    // Remove associated files from disk/S3
    try {
      const removed = await deleteDeliveryFiles(delivery);
      console.log('ðŸ—‘ï¸ Removed files for delivery', req.params.id, removed);
    } catch (err) {
      console.warn('âš ï¸ Error while removing delivery files:', err.message || err);
    }

    // CASCADE DELETE: Clear link from programaÃ§Ã£o if exists
    try {
      const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
      if (delivery.linkedProgramacaoId) {
        await ProgramacaoEntrega.findByIdAndUpdate(
          delivery.linkedProgramacaoId,
          { linkedDeliveryId: null }
        );
        console.log('ðŸ—‘ï¸ Cleared programaÃ§Ã£o link for driver delivery', req.params.id);
      }
    } catch (cascadeErr) {
      console.warn('âš ï¸ Cascade cleanup error (driver delete):', cascadeErr.message);
    }

    await db.deleteOne("deliveries", { _id: req.params.id });
    return res.json({ message: "Entrega deletada" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erro ao deletar entrega' });
  }
});

// =======================
// VERIFICAÃ‡ÃƒO DE ARQUIVOS (Arquivos Verificados / Icompany)
// =======================

// GET - Buscar status de verificaÃ§Ã£o de uma entrega
// GET /api/deliveries/:id/verification
router.get("/:id/verification", auth, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;

    // Importar modelo de verificaÃ§Ã£o
    const DeliveryVerification = require('../models/DeliveryVerification');

    // Buscar status de verificaÃ§Ã£o
    const verification = await DeliveryVerification.findOne({
      deliveryId: id,
      cityCode: city
    });

    // Retornar null se nÃ£o existir, ou o status se existir
    const result = verification ? {
      verified: verification.verified,
      verifiedBy: verification.verifiedBy,
      verifiedAt: verification.verifiedAt,
      notes: verification.notes
    } : null;

    res.json({ success: true, verification: result });
  } catch (err) {
    console.error('âŒ Erro ao buscar verificaÃ§Ã£o:', err);
    res.status(500).json({ success: false, message: 'Erro ao buscar verificaÃ§Ã£o' });
  }
});

// POST - Marcar entrega como verificada
// POST /api/deliveries/:id/verification
router.post("/:id/verification", auth, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;
    const { verified, notes } = req.body;
    const userName = req.user?.name || req.user?.fullName || req.user?.username || 'UsuÃ¡rio Desconhecido';

    const DeliveryVerification = require('../models/DeliveryVerification');
    const Delivery = require('../models/Delivery');

    // Validar que a entrega existe
    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Entrega nÃ£o encontrada' });
    }

    // Validar que Ã© da mesma cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ success: false, message: 'Aceso negado - dados de outra cidade' });
    }

    // Atualizar ou criar verificaÃ§Ã£o
    const verification = await DeliveryVerification.findOneAndUpdate(
      { deliveryId: id, cityCode: city },
      {
        deliveryId: id,
        deliveryNumber: delivery.deliveryNumber,
        verified: verified === true,
        verifiedBy: userName,
        verifiedAt: verified === true ? new Date() : null,
        notes: notes || '',
        cityCode: city
      },
      { upsert: true, new: true }
    );
    clearVerificationListCache(city);

    console.log(`âœ… Entrega ${delivery.deliveryNumber} marcada como ${verified ? 'verificada' : 'nÃ£o verificada'} por ${userName}`);

    res.json({
      success: true,
      message: `Entrega ${verified ? 'marcada' : 'desmarcada'} com sucesso`,
      verification: {
        verified: verification.verified,
        verifiedBy: verification.verifiedBy,
        verifiedAt: verification.verifiedAt,
        notes: verification.notes
      }
    });
  } catch (err) {
    console.error('âŒ Erro ao atualizar verificaÃ§Ã£o:', err);
    res.status(500).json({ success: false, message: 'Erro ao atualizar verificaÃ§Ã£o' });
  }
});

// GET - Listar todas as verificaÃ§Ãµes por cidade (para sincronizaÃ§Ã£o em massa)
// GET /api/deliveries/verifications/list
router.get("/verifications/list", auth, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { verified } = req.query; // filter por verified status se necessÃ¡rio

    const DeliveryVerification = require('../models/DeliveryVerification');

    const filter = { cityCode: city };
    if (verified !== undefined) {
      filter.verified = verified === 'true';
    }

    const cacheKey = `${city}:${verified ?? 'all'}`;
    const cached = verificationListCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < VERIFICATION_LIST_CACHE_MS) {
      res.set('Cache-Control', 'private, max-age=20');
      return res.json(cached.payload);
    }

    const verifications = await DeliveryVerification.find(filter)
      .select('deliveryId verified verifiedBy verifiedAt')
      .limit(10000)
      .lean();

    // Converter para Map para facilitar lookup no frontend
    const verificationMap = {};
    verifications.forEach(v => {
      verificationMap[v.deliveryId] = {
        verified: v.verified,
        verifiedBy: v.verifiedBy,
        verifiedAt: v.verifiedAt
      };
    });

    const payload = { success: true, data: verificationMap, count: verifications.length };
    verificationListCache.set(cacheKey, { createdAt: Date.now(), payload });
    res.set('Cache-Control', 'private, max-age=20');
    res.json(payload);
  } catch (err) {
    console.error('âŒ Erro ao listar verificaÃ§Ãµes:', err);
    res.status(500).json({ success: false, message: 'Erro ao listar verificaÃ§Ãµes' });
  }
});

module.exports = router;
