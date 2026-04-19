const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const NotificationService = require("../services/notificationService");
const { updateDeliveryAtomic, updateDeliveryStatus } = require("../utils/deliveryConcurrency");

// =======================
// Upload config (disk by default, memory for S3)
// =======================
const useS3 = !!process.env.S3_BUCKET;
let upload;
if (useS3) {
  console.log('✓ S3 configured: using memoryStorage for multer');
  upload = multer({ storage: multer.memoryStorage() });
} else {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Dinâmico por cidade
      const dir = path.join(__dirname, "../uploads", req.city || 'manaus');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Garantir nome temporário único para evitar sobrescrita de uploads múltiplos
      const ext = path.extname(file.originalname) || '.jpg';
      const uniqueFilename = `${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, uniqueFilename);
    }
  });
  upload = multer({ storage });
}

const s3 = useS3 ? require('../storage/s3') : null;
const { normalizeDeliveryForResponse } = require('../utils/storageUtils');

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

// =======================
// Criar entrega
// POST /api/deliveries
// =======================
router.post("/", auth, async (req, res) => {
  try {
    const db = await getDb(req);
    const city = req.city || 'manaus';
    const { deliveryNumber, vehiclePlate, observations, driverName, containerMontadoAt, status } = req.body;

    console.log('📦 Recebido no backend:', { deliveryNumber, vehiclePlate, observations, driverName, containerMontadoAt, status, city });

    if (!deliveryNumber) {
      return res.status(400).json({ message: "Número da entrega obrigatório" });
    }

    const driver = await db.findById("drivers", req.user.id);

    const delivery = await db.create("deliveries", {
      deliveryNumber,
      vehiclePlate,
      observations,
      driverName: driverName || "",
      containerMontadoAt: containerMontadoAt ? new Date(containerMontadoAt) : null,
      userId: req.user.id,
      userName: driver?.fullName || driver?.name || driver?.username || "Unknown",
      status: status || "pending",
      currentStep: 'welcome',
      documents: {},
      city,
      cityCode: city
    });

    // Attempt to update matching programacao to indicate it is now em rota
    try {
      const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
      // Filtrar pelo origem também para garantir que é da mesma cidade
      let progFilter = {
        $or: [
          { processo: new RegExp(`^${deliveryNumber}$`, 'i') },
          { container: new RegExp(`^${deliveryNumber}$`, 'i') }
        ]
      };
      // Adicionar filtro de cidade baseado na origem
      if (city === 'manaus') {
        progFilter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
      } else if (city === 'itajai') {
        progFilter.$or.push({ origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } });
      }
      const prog = await ProgramacaoEntrega.findOne(progFilter);
      if (prog) {
        // Se status foi definido (ex: CONTAINER_MONTADO), usa esse, senão usa EM_ROTA
        prog.status = status === 'CONTAINER_MONTADO' ? 'CONTAINER_MONTADO' : 'EM_ROTA';
        // gravar referência para futuras consultas
        prog.linkedDeliveryId = delivery._id;
        await prog.save();
        console.log('[DELIVERY] Programacao', prog._id, 'status atualizado para', prog.status);
      }
    } catch (syncErr) {
      console.warn('[DELIVERY] Falha ao sincronizar programacao:', syncErr.message || syncErr);
    }

    // DESABILITADO: Sincronização com Icompany foi removida
    // try {
    //   const Icompany = require('../models/Icompany');
    //   // Sincronização desabilitada por requisito do usuário
    // } catch (syncErr) {
    //   console.warn('[DELIVERY] erro sync Icompany:', syncErr.message || syncErr);
    // }

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
// ✅ OTIMIZADO: Usa deliveryService com .lean() e índices
router.get("/", auth, async (req, res) => {
  try {
    const Delivery = require('../models/Delivery');
    const { status, q, page = 1, limit = 50 } = req.query;
    const city = req.city || 'manaus';
    
    console.log(`⚡ GET /api/deliveries [OTIMIZADO] user=${req.user.id} city=${city} status=${status || 'all'} search=${q || 'none'}`);
    
    // Construir filtro otimizado - excluir canceladas por padrão
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
    
    // Query otimizada com .lean() + índices existentes
    const skip = (parseInt(page) - 1) * Math.min(parseInt(limit), 100);
    const take = Math.min(parseInt(limit), 100);
    
    const total = await Delivery.countDocuments(filter);
    const deliveries = await Delivery
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take)
      .lean();  // 60% mais rápido
    
    console.log(`✓ Found ${deliveries.length} deliveries (total: ${total})`);
    
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
    if (!delivery) return res.status(404).json({ message: "Entrega não encontrada" });
    // Verificar se pertence à cidade do usuário
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }
    // drivers should only access their own deliveries; admins may view all
    if (req.user.role !== 'admin' && String(delivery.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    res.json({ delivery: normalizeDeliveryForResponse(delivery) });
  } catch (err) {
    console.error('Error fetching delivery', err);
    res.status(500).json({ message: 'Erro ao buscar entrega' });
  }
});

// =======================
// Atualizar entrega (motorista só pode alterar a própria)
// PUT /api/deliveries/:id
// fields: status, arrivedAt, observations (other safe ones)
// =======================
router.put("/:id", auth, async (req, res) => {
  try {
    const db = await getDb(req);
    const city = req.city || 'manaus';
    const { id } = req.params;
    const delivery = await db.findById("deliveries", id);
    if (!delivery) return res.status(404).json({ message: "Entrega não encontrada" });
    // Verificar se pertence à cidade do usuário
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }
    if (String(delivery.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // Validação: verificar se o novo status requer documentos obrigatórios
    if (req.body.status) {
      const statusDocumentRequirements = {
        'A_CAMINHO_DO_CLIENTE': ['retiradaCheio']
        // 'FINALIZADO' não exige devolucaoVazio aqui, pois este campo só aparece depois dessa etapa
      };
      const requiredDocs = statusDocumentRequirements[req.body.status];
      if (requiredDocs) {
        for (const doc of requiredDocs) {
          const docs = delivery.documents || {};
          const docEntry = docs[doc];
          if (!docEntry) {
            return res.status(400).json({ message: `Documento obrigatório não encontrado para avançar status: ${doc}` });
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
            return res.status(400).json({ message: `Documento obrigatório não encontrado para avançar status: ${doc}` });
          }
        }
      }
    }

    // Preparar updates
    const updates = {};

    // Se há mudança de status, usar função especializada com validação de ordem
    if (req.body.status) {
      // Verificar se motorista está tentando fazer retrocesso
      const { STATUS_ORDER } = require("../utils/deliveryConcurrency");
      const currentLevel = STATUS_ORDER[delivery.status] || 0;
      const newLevel = STATUS_ORDER[req.body.status] || 0;
      
      if (newLevel < currentLevel && req.body.status !== 'CANCELADO') {
        return res.status(403).json({ message: 'Motorista não pode fazer retrocesso de status. Apenas ADM/GERENTE podem.' });
      }

      // Usar updateDeliveryStatus para mudança de status (com validação de ordem)
      const statusUpdates = {};
      if (req.body.arrivedAt !== undefined) statusUpdates.arrivedAt = req.body.arrivedAt;
      if (req.body.containerMontadoAt !== undefined) statusUpdates.containerMontadoAt = req.body.containerMontadoAt ? new Date(req.body.containerMontadoAt) : null;
      if (req.body.currentStep !== undefined) statusUpdates.currentStep = req.body.currentStep;
      if (req.body.observations !== undefined) statusUpdates.observations = req.body.observations;
      if (req.body.documentsJustification !== undefined) statusUpdates.documentsJustification = req.body.documentsJustification;
      if (req.body.desovaStartAt !== undefined) statusUpdates.desovaStartAt = req.body.desovaStartAt;
      if (req.body.desovaEndAt !== undefined) statusUpdates.desovaEndAt = req.body.desovaEndAt;
      if (req.body.recebedor !== undefined) statusUpdates.recebedor = req.body.recebedor;
      if (req.body.programacaoId !== undefined) statusUpdates.programacaoId = req.body.programacaoId;
      if (req.body.horarioDevolucaoVazio !== undefined) statusUpdates.horarioDevolucaoVazio = req.body.horarioDevolucaoVazio;

      const updated = await updateDeliveryStatus(delivery._id, req.body.status, statusUpdates, false);
      return res.json({ delivery: normalizeDeliveryForResponse(updated) });
    }

    // Para updates sem mudança de status, usar updateDeliveryAtomic
    if (req.body.arrivedAt !== undefined) updates.arrivedAt = req.body.arrivedAt;
    if (req.body.containerMontadoAt !== undefined) updates.containerMontadoAt = req.body.containerMontadoAt ? new Date(req.body.containerMontadoAt) : null;
    if (req.body.currentStep !== undefined) updates.currentStep = req.body.currentStep;
    if (req.body.observations !== undefined) updates.observations = req.body.observations;
    if (req.body.documentsJustification !== undefined) updates.documentsJustification = req.body.documentsJustification;
    if (req.body.desovaStartAt !== undefined) updates.desovaStartAt = req.body.desovaStartAt;
    if (req.body.desovaEndAt !== undefined) updates.desovaEndAt = req.body.desovaEndAt;
    if (req.body.recebedor !== undefined) updates.recebedor = req.body.recebedor;

    // Se programacaoId for fornecido, guardar (será usado para atualizar depois)
    const programacaoIdFromBody = req.body.programacaoId;
    if (programacaoIdFromBody !== undefined) updates.programacaoId = programacaoIdFromBody;

    if (req.body.horarioDevolucaoVazio !== undefined) updates.horarioDevolucaoVazio = req.body.horarioDevolucaoVazio;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Nada para atualizar' });
    }

    const updated = await updateDeliveryAtomic(delivery._id, updates);
    return res.json({ delivery: normalizeDeliveryForResponse(updated) });

    // Se houver horário de devolução vazio agora (seja de antes ou desta chamada),
    // marca containerReturned na programação vinculada
    const shouldMarkReturned = updated.horarioDevolucaoVazio;
    const programacaoToUpdate = programacaoIdFromBody || updated.programacaoId;
    
    if (shouldMarkReturned && programacaoToUpdate) {
      try {
        const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
        console.log(`[CONTAINER_RETURN] Marcando containerReturned=true na programação ${programacaoToUpdate}`);
        await ProgramacaoEntrega.findByIdAndUpdate(programacaoToUpdate, {
          containerReturned: true,
          status: 'FINALIZADO'
        });
        console.log(`[CONTAINER_RETURN] ✅ Programação ${programacaoToUpdate} atualizada`);
      } catch (e) {
        console.error('[CONTAINER_RETURN] Erro ao atualizar programação:', e.message);
      }
    }

    res.json({ delivery: normalizeDeliveryForResponse(updated) });
  } catch (err) {
    console.error('Error updating delivery', err);
    res.status(500).json({ message: 'Erro ao atualizar entrega' });
  }
});

// =======================
// Programações vinculadas ao contratado do usuário
// GET /api/programacoes/mine
// Retorna programações pendentes vinculadas ao contratado do usuário autenticado
// =======================
router.get('/programacoes/mine', auth, async (req, res) => {
  try {
    console.log('[PROGRAMACAO] 🚀 OTIMIZADO - Buscando programações do usuário:', req.user.id);
    const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
    const Delivery = require('../models/Delivery');

    // Obter contratado do usuário
    const db = await getDb(req);
    let driverRecord = null;
    try {
      driverRecord = await db.findById('drivers', req.user.id);
    } catch (e) {
      console.warn('[PROGRAMACAO] Aviso: falha ao buscar registro do usuário:', e?.message);
    }

    const contratadoRaw = (driverRecord && (driverRecord.contratado || driverRecord.transportadora || driverRecord.name || driverRecord.fullName)) || (req.user?.transportadora || req.user?.contratado) || '';
    const contratado = String(contratadoRaw || '').trim();

    if (!contratado) {
      return res.json({ success: true, programacoes: [] });
    }

    const city = req.city || 'manaus';
    const regex = new RegExp(`^${contratado}$`, 'i');
    
    // Filtro de cidade
    let cityFilter = {};
    if (city === 'manaus') {
      cityFilter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      cityFilter.$or = [
        { origem: { $exists: false } },
        { origem: '' },
        { origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } }
      ];
    }
    
    // ✅ OTIMIZADO: Query com índices compostos
    const programacoes = await ProgramacaoEntrega.find({
      ...cityFilter,
      contratado: regex,
      ativo: { $ne: false }
    }).sort({ dataAgendamento: -1 }).lean();  // .lean() = 60% mais rápido
    
    console.log(`[PROGRAMACAO] ✓ Encontradas ${programacoes.length} programações para ${contratado}`);

    // ✅ OTIMIZADO: Ao invés de carregar TODAS as entregas em memória,
    // usar apenas as linkedDeliveryId necessárias
    const linkedIds = (programacoes || [])
      .map(p => p.linkedDeliveryId)
      .filter(Boolean);
    
    const deliveriesByLinkedId = new Map();
    if (linkedIds.length > 0) {
      const linkedDeliveries = await Delivery.find({ _id: { $in: linkedIds } }).lean();
      linkedDeliveries.forEach(d => {
        deliveriesByLinkedId.set(String(d._id), d);
      });
    }
    
    // Se ainda precisar fazer lookup por número/processo, fazer em batch
    const toMatch = programacoes.filter(p => !p.linkedDeliveryId);
    const matchedNumbers = toMatch.map(p => ({
      $or: [
        { deliveryNumber: new RegExp(`^${p.processo}$`, 'i') },
        { deliveryNumber: new RegExp(`^${p.container}$`, 'i') }
      ]
    }));
    
    const unmatchedDeliveries = matchedNumbers.length > 0 
      ? await Delivery.find({ $or: matchedNumbers }).lean()
      : [];
    
    const deliveriesByNumber = new Map();
    unmatchedDeliveries.forEach(d => {
      const key = String(d.deliveryNumber || '').toUpperCase();
      if (key) deliveriesByNumber.set(key, d);
    });

    // Enriquecer programações
    const enrichedProgramacoes = (programacoes || []).map((p) => {
      const obj = { ...p };
      
      // Tentar buscar entrega vinculada
      let matchedDelivery = deliveriesByLinkedId.get(String(p.linkedDeliveryId));
      
      if (!matchedDelivery) {
        const procKey = String(p.processo || '').toUpperCase();
        const contKey = String(p.container || '').toUpperCase();
        matchedDelivery = deliveriesByNumber.get(procKey) || deliveriesByNumber.get(contKey);
      }
      
      if (matchedDelivery) {
        obj.linkedDeliveryId = matchedDelivery._id;
        obj.missingDocumentsAtSubmit = matchedDelivery.missingDocumentsAtSubmit || [];
        if (matchedDelivery.horarioDevolucaoVazio) {
          obj.horarioDevolucaoVazio = matchedDelivery.horarioDevolucaoVazio;
        }
      }
      
      return obj;
    });

    return res.json({ success: true, programacoes: enrichedProgramacoes || [] });
  } catch (err) {
    console.error('[PROGRAMACAO] Erro:', err.message);
    return res.status(500).json({ message: 'Erro ao listar programações', error: err.message });
  }
});

// =======================
// Upload documento (aceita múltiplos arquivos)
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
      console.error(`[UPLOAD] Entrega não encontrada: ${id}`);
      return res.status(404).json({ message: "Entrega não encontrada" });
    }
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    const typeNames = {
      canhotNF: "NF",
      canhotCTE: "CTE",
      diarioBordo: "DIARIO",
      devolucaoVazio: "DEVOLUCAO",
      retiradaCheio: "RETIRADA",
      chegadaCliente: "CHEGADA",
      inicioDesova: "INICIO_DESOVA",
      fimDesova: "FIM_DESOVA",
      ricAbastecimento: "RIC_AB",
      ricBaixa: "RIC_BAIXA",
      ricColeta: "RIC_COLETA",
      discoTacografo: "DISCO"
    };
    const baseName = typeNames[type] || type;
    const containerFolder = delivery.deliveryNumber;
    const containerDir = path.join(__dirname, "../uploads", city, containerFolder);
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
          const r2Key = `uploads/${delivery.deliveryNumber}/${finalFilename}`;
          const r2Url = await r2Storage.uploadBuffer(fileBuffer, r2Key, file.mimetype);
          fileEntry = { name: finalFilename, url: r2Url, storage: 'r2', key: r2Key };
          console.log(`[UPLOAD] ✓ R2 OK: ${finalFilename} (URL: ${r2Url})`);
        } catch (err) {
          console.warn(`[UPLOAD] ⚠️ R2 FALHOU:`, err && err.message ? err.message : err);
          console.warn(`[UPLOAD] ⚠️ Fazendo fallback para armazenamento local...`);
        }
        
        // If R2 failed, use local storage as fallback
        if (!fileEntry) {
          try {
            const dest = path.join(containerDir, finalFilename);
            const fileBuffer = file.buffer || fs.readFileSync(file.path);
            fs.writeFileSync(dest, fileBuffer);
            fileEntry = { name: finalFilename, path: path.join(city, containerFolder, finalFilename), storage: 'local' };
            console.log(`[UPLOAD] ✓ Arquivo salvo LOCALMENTE (fallback): ${finalFilename}`);
          } catch (err) {
            console.error(`[UPLOAD] ✗ Local save falhou:`, err && err.message ? err.message : err);
            continue; // skip this file
          }
        }
        
        // Add the entry (either R2 or local)
        if (fileEntry) {
          savedFiles.push(fileEntry);
          console.log(`[UPLOAD] ✅ Arquivo ${idx + 1} adicionado. Total: ${savedFiles.length}`);
        }
      }
      
      console.log(`[UPLOAD] ===== RESUMO DO UPLOAD =====`);
      console.log(`[UPLOAD] Arquivos recebidos: ${req.files.length}`);
      console.log(`[UPLOAD] Arquivos salvos com sucesso: ${savedFiles.length}`);
      console.log(`[UPLOAD] Tipo de documento: ${type}`);
      console.log(`[UPLOAD] savedFiles:`, JSON.stringify(savedFiles));

      if (req.files.length > 0 && savedFiles.length === 0) {
        console.error('[UPLOAD] Nenhum arquivo foi salvo durante upload. Aborting.');
        return res.status(500).json({ message: 'Erro ao fazer upload: nenhum arquivo salvo (verifique configuração de R2 ou armazenamento local)' });
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
        console.log(`[UPLOAD] Removendo "${type}" de missingDocumentsAtSubmit. Pendências restantes:`, newMissing);
        
        // Também limpar o log de correção para este documento específico
        let newCorrectionLog = updated.documentCorrectionLog || [];
        if (Array.isArray(newCorrectionLog)) {
          newCorrectionLog = newCorrectionLog.filter(log => log.documentType !== type);
          console.log(`[UPLOAD] Limpando log de correção para "${type}". Logs restantes:`, newCorrectionLog.length);
        }
        
        await db.updateOne("deliveries", { _id: id }, { missingDocumentsAtSubmit: newMissing, documentCorrectionLog: newCorrectionLog });
      }
    } else {
      console.warn('[UPLOAD] Nenhum arquivo recebido no upload.');
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }
    const updated = await db.findById("deliveries", id);
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
      console.error(`[UPLOAD-UPDATE] Entrega não encontrada: ${id}`);
      return res.status(404).json({ message: "Entrega não encontrada" });
    }
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    if (String(delivery.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // First, upload the documents
    const docs = delivery.documents || {};
    const existing = normalizeDocumentEntries(docs[documentType]);

    const savedFiles = [];

    if (req.files && req.files.length) {
      const typeNames = {
        canhotNF: "NF",
        canhotCTE: "CTE",
        diarioBordo: "DIARIO",
        devolucaoVazio: "DEVOLUCAO",
        retiradaCheio: "RETIRADA",
        chegadaCliente: "CHEGADA",
        inicioDesova: "INICIO_DESOVA",
        fimDesova: "FIM_DESOVA",
        ricAbastecimento: "RIC_AB",
        ricBaixa: "RIC_BAIXA",
        ricColeta: "RIC_COLETA",
        discoTacografo: "DISCO"
      };
      const baseName = typeNames[documentType] || documentType;
      const containerFolder = delivery.deliveryNumber;
      const containerDir = path.join(__dirname, "../uploads", city, containerFolder);
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
          const r2Key = `uploads/${delivery.deliveryNumber}/${finalFilename}`;
          const r2Url = await r2Storage.uploadBuffer(fileBuffer, r2Key, file.mimetype);
          fileEntry = { name: finalFilename, url: r2Url, storage: 'r2', key: r2Key };
          console.log(`[UPLOAD-UPDATE] ✓ R2 OK: ${finalFilename} (URL: ${r2Url})`);
        } catch (err) {
          console.warn(`[UPLOAD-UPDATE] ⚠️ R2 FALHOU:`, err && err.message ? err.message : err);
          // Fallback to local
          try {
            const dest = path.join(containerDir, finalFilename);
            const fileBuffer = file.buffer || fs.readFileSync(file.path);
            fs.writeFileSync(dest, fileBuffer);
            fileEntry = { name: finalFilename, path: path.join(city, containerFolder, finalFilename), storage: 'local' };
            console.log(`[UPLOAD-UPDATE] ✓ Arquivo salvo LOCALMENTE: ${finalFilename}`);
          } catch (err) {
            console.error(`[UPLOAD-UPDATE] ✗ Local save falhou:`, err && err.message ? err.message : err);
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
        "recebedor",
        "horarioDevolucaoVazio",
        "containerMontadoAt"
      ];

      const safeUpdates = {};
      const dateFields = ["arrivedAt", "desovaStartAt", "desovaEndAt", "horarioDevolucaoVazio", "containerMontadoAt"];
      
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

      // Now, update the delivery with documents and status
      const updates = { documents: normalizedDocs };
      if (status) {
        // Se há mudança de status, usar função especializada
        const statusUpdates = { documents: normalizedDocs };
        for (const [field, value] of Object.entries(safeUpdates)) {
          statusUpdates[field] = value;
        }
        const updated = await updateDeliveryStatus(delivery._id, status, statusUpdates);
        return res.json({ delivery: normalizeDeliveryForResponse(updated) });
      } else {
        // Sem mudança de status, usar update atômico
        for (const [field, value] of Object.entries(safeUpdates)) {
          updates[field] = value;
        }

        const updated = await updateDeliveryAtomic(delivery._id, updates);
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
// Deletar um documento específico por índice
// DELETE /api/deliveries/:id/documents/:type/:index
// =======================
router.delete('/:id/documents/:type/:index', auth, async (req, res) => {
  try {
    const { id, type, index } = req.params;
    const city = req.city || 'manaus';
    const db = await getDb(req);
    const delivery = await db.findById('deliveries', id);
    if (!delivery) return res.status(404).json({ message: 'Entrega não encontrada' });
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }
    
    const docs = delivery.documents || {};
    const docEntry = docs[type];

    if (!docEntry) return res.status(404).json({ message: 'Documento não encontrado' });

    const idx = parseInt(index, 10);

    // Se for string simples, só remove
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

      // Restaurar na lista de pendências se era faltante
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

    // Array: remove índice
    if (idx < 0 || idx >= docEntry.length) return res.status(400).json({ message: 'Índice inválido' });

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

    // Se deletou e ficou vazio, restaurar na lista de pendências se a entrega foi forçada (Itajaí)
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
    console.log('📩 Submit request', { id: req.params.id, body: req.body, cidade: city, headers: { 'x-city': req.header('x-city'), host: req.headers.host } });

    const delivery = await db.findById('deliveries', req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Entrega não encontrada' });
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    // Check ownership: prefer driverId if present, else userId
    const ownerId = (delivery.driverId && String(delivery.driverId)) || (delivery.userId && String(delivery.userId));
    if (ownerId && ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // Check if already submitted
    if (delivery.status === 'submitted') {
      return res.status(400).json({ success: false, message: 'Entrega já foi enviada' });
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
    // devolucaoVazio é opcional nesta etapa (feito separadamente)
    const requiredDocs = ['canhotNF', 'canhotCTE', 'diarioBordo', 'retiradaCheio'];

    const missingDocs = requiredDocs.filter(doc => !docHasFiles(delivery.documents && delivery.documents[doc]));

    const { force, observation } = req.body || {};
    console.log('  -> missingDocs:', missingDocs, 'force:', force, 'observation:', observation);

    if (missingDocs.length > 0) {
      // Manaus ainda exige força/observação para docs faltantes
      if (city !== 'itajai') {
        if (!force) {
          return res.status(400).json({ message: 'Documentos obrigatórios faltando: ' + missingDocs.join(', ') });
        }
        if (!observation || !String(observation || '').trim()) {
          return res.status(400).json({ message: 'Observação obrigatória para finalizar com documentos faltando' });
        }
      }

      // For Itajaí aceita, mas registra pendência para o fluxo de canhotos pendentes
      const updates = {
        status: 'submitted',
        submittedAt: new Date(),
        missingDocumentsAtSubmit: missingDocs,
        submissionForce: true,
        submissionObservation: observation ? String(observation).trim() : ''
      };
      await db.updateOne('deliveries', { _id: req.params.id }, updates);

      // Criar notificação para gestores/administradores sobre canhotos retidos
      try {
        await NotificationService.notifyCanhotoRetido(
          req.params.id,
          delivery.deliveryNumber || 'N/A',
          observation || 'Documentos obrigatórios não anexados',
          city
        );
      } catch (notifError) {
        console.warn('Erro ao criar notificação de canhoto retido:', notifError);
        // Não falha a operação principal por causa da notificação
      }

      const deliveryAfterUpdate = await db.findById('deliveries', req.params.id);
      return res.json({ message: 'Entrega enviada com sucesso (com pendências)', delivery: deliveryAfterUpdate });
    }

    // No missing docs, mark as submitted and limpar pendências
    await db.updateOne('deliveries', { _id: req.params.id }, { status: 'submitted', submittedAt: new Date(), missingDocumentsAtSubmit: [] });
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
    if (!delivery) return res.status(404).json({ message: "Entrega não encontrada" });
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    // NOVO: Se gestor_contratado, validar se é do seu contratado
    if (req.user && req.user.role === 'gestor_contratado' && req.user.contratado) {
      if (delivery.userName !== req.user.contratado) {
        return res.status(403).json({ message: 'Acesso negado - entrega de outro contratado' });
      }
    }

    if (delivery.status !== "pending") {
      return res.status(400).json({ message: "Entrega enviada não pode ser deletada" });
    }

    // Remove associated files from disk/S3
    try {
      const removed = await deleteDeliveryFiles(delivery);
      console.log('🗑️ Removed files for delivery', req.params.id, removed);
    } catch (err) {
      console.warn('⚠️ Error while removing delivery files:', err.message || err);
    }

    // CASCADE DELETE: Clear link from programação if exists
    try {
      const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
      if (delivery.linkedProgramacaoId) {
        await ProgramacaoEntrega.findByIdAndUpdate(
          delivery.linkedProgramacaoId,
          { linkedDeliveryId: null }
        );
        console.log('🗑️ Cleared programação link for driver delivery', req.params.id);
      }
    } catch (cascadeErr) {
      console.warn('⚠️ Cascade cleanup error (driver delete):', cascadeErr.message);
    }

    await db.deleteOne("deliveries", { _id: req.params.id });
    return res.json({ message: "Entrega deletada" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erro ao deletar entrega' });
  }
});

// =======================
// VERIFICAÇÃO DE ARQUIVOS (Arquivos Verificados / Icompany)
// =======================

// GET - Buscar status de verificação de uma entrega
// GET /api/deliveries/:id/verification
router.get("/:id/verification", auth, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;

    // Importar modelo de verificação
    const DeliveryVerification = require('../models/DeliveryVerification');

    // Buscar status de verificação
    const verification = await DeliveryVerification.findOne({
      deliveryId: id,
      cityCode: city
    });

    // Retornar null se não existir, ou o status se existir
    const result = verification ? {
      verified: verification.verified,
      verifiedBy: verification.verifiedBy,
      verifiedAt: verification.verifiedAt,
      notes: verification.notes
    } : null;

    res.json({ success: true, verification: result });
  } catch (err) {
    console.error('❌ Erro ao buscar verificação:', err);
    res.status(500).json({ success: false, message: 'Erro ao buscar verificação' });
  }
});

// POST - Marcar entrega como verificada
// POST /api/deliveries/:id/verification
router.post("/:id/verification", auth, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;
    const { verified, notes } = req.body;
    const userName = req.user?.name || req.user?.fullName || req.user?.username || 'Usuário Desconhecido';

    const DeliveryVerification = require('../models/DeliveryVerification');
    const Delivery = require('../models/Delivery');

    // Validar que a entrega existe
    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Entrega não encontrada' });
    }

    // Validar que é da mesma cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ success: false, message: 'Aceso negado - dados de outra cidade' });
    }

    // Atualizar ou criar verificação
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

    console.log(`✅ Entrega ${delivery.deliveryNumber} marcada como ${verified ? 'verificada' : 'não verificada'} por ${userName}`);

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
    console.error('❌ Erro ao atualizar verificação:', err);
    res.status(500).json({ success: false, message: 'Erro ao atualizar verificação' });
  }
});

// GET - Listar todas as verificações por cidade (para sincronização em massa)
// GET /api/deliveries/verifications/list
router.get("/verifications/list", auth, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { verified } = req.query; // filter por verified status se necessário

    const DeliveryVerification = require('../models/DeliveryVerification');

    const filter = { cityCode: city };
    if (verified !== undefined) {
      filter.verified = verified === 'true';
    }

    const verifications = await DeliveryVerification.find(filter)
      .select('deliveryId deliveryNumber verified verifiedBy verifiedAt')
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

    res.json({ success: true, data: verificationMap, count: verifications.length });
  } catch (err) {
    console.error('❌ Erro ao listar verificações:', err);
    res.status(500).json({ success: false, message: 'Erro ao listar verificações' });
  }
});

module.exports = router;
