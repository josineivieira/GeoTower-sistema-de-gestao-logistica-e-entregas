const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
      // Nome será ajustado no handler
      cb(null, file.originalname);
    }
  });
  upload = multer({ storage });
}

const s3 = useS3 ? require('../storage/s3') : null;
const { normalizeDeliveryForResponse } = require('../utils/storageUtils');

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
      city
    });

    // Tentar encontrar Ycompany correspondente e armazenar referência
    try {
      const Ycompany = require('../models/Ycompany');
      const ycompanyRecord = await Ycompany.findOne({
        $or: [
          { geomaritima: new RegExp(`^${deliveryNumber}$`, 'i') },
          { numero: new RegExp(`^${deliveryNumber}$`, 'i') },
          { containerNumero: new RegExp(`^${deliveryNumber}$`, 'i') },
          { processo: new RegExp(`^${deliveryNumber}$`, 'i') },
          { codigo: new RegExp(`^${deliveryNumber}$`, 'i') },
          { geomaritima: deliveryNumber },
          { numero: deliveryNumber },
          { containerNumero: deliveryNumber },
          { processo: deliveryNumber },
          { codigo: deliveryNumber }
        ]
      });

      if (ycompanyRecord) {
        console.log('[DELIVERY] ✅ Ycompany encontrado para delivery', deliveryNumber, '- ID:', ycompanyRecord._id);
        await db.updateOne('deliveries', { _id: delivery._id }, { linkedYcompanyId: ycompanyRecord._id });
        delivery.linkedYcompanyId = ycompanyRecord._id;
      } else {
        console.log('[DELIVERY] ❌ Ycompany não encontrado para delivery', deliveryNumber);
      }
    } catch (linkErr) {
      console.warn('[DELIVERY] Erro ao tentar linkar Ycompany:', linkErr.message);
    }

    // Attempt to update matching programacao to indicate it is now em rota
    try {
      const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
      const prog = await ProgramacaoEntrega.findOne({
        $or: [
          { processo: new RegExp(`^${deliveryNumber}$`, 'i') },
          { container: new RegExp(`^${deliveryNumber}$`, 'i') }
        ]
      });
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
router.get("/", auth, async (req, res) => {
  try {
    const db = await getDb(req);
    const { status, q } = req.query;
    const query = { userId: req.user.id };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    // Support free-text search across deliveryNumber, driverName and vehiclePlate
    if (q && String(q).trim() !== '') {
      const term = String(q).trim();
      query.$or = [
        { deliveryNumber: { $regex: term } },
        { driverName: { $regex: term } },
        { vehiclePlate: { $regex: term } }
      ];
    }
    
    let deliveries = await db.find("deliveries", query);
    // Ensure array and sort by createdAt desc
    deliveries = (deliveries || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // Normalize documents for response
    deliveries = deliveries.map(d => normalizeDeliveryForResponse(d));
    res.json({ deliveries });
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
    const delivery = await db.findById("deliveries", req.params.id);
    if (!delivery) return res.status(404).json({ message: "Entrega não encontrada" });
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
    const { id } = req.params;
    const delivery = await db.findById("deliveries", id);
    if (!delivery) return res.status(404).json({ message: "Entrega não encontrada" });
    if (String(delivery.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const updates = {};
    if (req.body.status) {
      updates.status = req.body.status;
      // mirror to programacao if exists - try multiple approaches
      try {
        const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
        let prog = null;
        const deliveryNum = String(delivery.deliveryNumber || '').trim().toUpperCase();
        
        // Approach 1: Exact match (case-insensitive)
        if (deliveryNum) {
          prog = await ProgramacaoEntrega.findOne({
            $or: [
              { processo: new RegExp(`^${deliveryNum}$`, 'i') },
              { container: new RegExp(`^${deliveryNum}$`, 'i') }
            ]
          });
        }
        
        // Approach 2: If not found, try substring match
        if (!prog && deliveryNum) {
          prog = await ProgramacaoEntrega.findOne({
            $or: [
              { processo: new RegExp(deliveryNum, 'i') },
              { container: new RegExp(deliveryNum, 'i') }
            ]
          });
        }
        
        if (prog) {
          prog.status = req.body.status;
          await prog.save();
          console.log('[DELIVERY] sincronizado status da programacao', prog._id, 'para', req.body.status);
        } else {
          console.log('[DELIVERY] programacao nao encontrada para deliveryNumber', deliveryNum);
        }
      } catch (syncErr) {
        console.warn('[DELIVERY] erro sync programacao:', syncErr.message || syncErr);
      }
    }

    // Sincronizar com Ycompany se aplicável
    try {
      const Ycompany = require('../models/Ycompany');
      const deliveryNum = String(delivery.deliveryNumber || '').trim().toUpperCase();
      let ycompanyRecord = null;

      console.log('[DELIVERY] 🔍 Tentando sincronizar Ycompany para deliveryNumber:', deliveryNum);
      console.log('[DELIVERY] 📝 Body recebido:', JSON.stringify(req.body, null, 2));

      if (deliveryNum) {
        // Primeiro tentar usar referência direta se existir
        if (delivery.linkedYcompanyId) {
          console.log('[DELIVERY] 🔗 Usando referência direta linkedYcompanyId:', delivery.linkedYcompanyId);
          ycompanyRecord = await Ycompany.findById(delivery.linkedYcompanyId);
          if (ycompanyRecord) {
            console.log('[DELIVERY] ✅ Ycompany encontrado via referência direta');
          }
        }

        // Se não encontrou via referência, buscar por campos
        if (!ycompanyRecord) {
          console.log('[DELIVERY] 🔍 Buscando Ycompany por campos...');
          // Buscar por processo ou container - tentar múltiplas possibilidades
          ycompanyRecord = await Ycompany.findOne({
            $or: [
              { geomaritima: new RegExp(`^${deliveryNum}$`, 'i') },
              { numero: new RegExp(`^${deliveryNum}$`, 'i') },
              { containerNumero: new RegExp(`^${deliveryNum}$`, 'i') },
              { processo: new RegExp(`^${deliveryNum}$`, 'i') },
              { codigo: new RegExp(`^${deliveryNum}$`, 'i') },
              { geomaritima: deliveryNum },
              { numero: deliveryNum },
              { containerNumero: deliveryNum },
              { processo: deliveryNum },
              { codigo: deliveryNum }
            ]
          });

          // Se não encontrou, tentar busca mais ampla
          if (!ycompanyRecord) {
            console.log('[DELIVERY] 🔍 Tentando busca mais ampla...');
            ycompanyRecord = await Ycompany.findOne({
              $or: [
                { geomaritima: new RegExp(deliveryNum, 'i') },
                { numero: new RegExp(deliveryNum, 'i') },
                { containerNumero: new RegExp(deliveryNum, 'i') },
                { processo: new RegExp(deliveryNum, 'i') },
                { codigo: new RegExp(deliveryNum, 'i') }
              ]
            });
          }
        }

        console.log('[DELIVERY] 📋 Ycompany encontrado:', ycompanyRecord ? `ID: ${ycompanyRecord._id}, codigo: ${ycompanyRecord.codigo}` : 'NÃO ENCONTRADO');
        if (ycompanyRecord) {
          console.log('[DELIVERY] 📋 Ycompany campos:', {
            processo: ycompanyRecord.processo,
            numero: ycompanyRecord.numero,
            containerNumero: ycompanyRecord.containerNumero,
            codigo: ycompanyRecord.codigo
          });
        }
      }

      if (ycompanyRecord) {
        const ycompanyUpdates = {};

        console.log('[DELIVERY] 🔄 Verificando campos para atualização...');

        // Mapear campos do delivery para Ycompany - sempre atualizar se o valor foi enviado
        if (req.body.status === 'A_CAMINHO_DO_CLIENTE') {
          ycompanyUpdates.dtInicioRota = new Date();
          console.log('[DELIVERY] ✅ Definindo dtInicioRota');
        }
        if (req.body.desovaStartAt !== undefined) {
          if (req.body.desovaStartAt) {
            ycompanyUpdates.dtInicioDescarga = new Date(req.body.desovaStartAt);
            console.log('[DELIVERY] ✅ Definindo dtInicioDescarga:', req.body.desovaStartAt);
          } else {
            console.log('[DELIVERY] ⚠️ desovaStartAt enviado mas vazio');
          }
        }
        if (req.body.desovaEndAt !== undefined) {
          if (req.body.desovaEndAt) {
            ycompanyUpdates.dtFimDescarga = new Date(req.body.desovaEndAt);
            console.log('[DELIVERY] ✅ Definindo dtFimDescarga:', req.body.desovaEndAt);
          } else {
            console.log('[DELIVERY] ⚠️ desovaEndAt enviado mas vazio');
          }
        }
        if (req.body.containerMontadoAt !== undefined) {
          if (req.body.containerMontadoAt) {
            ycompanyUpdates.dtRetiraPD = new Date(req.body.containerMontadoAt);
            console.log('[DELIVERY] ✅ Definindo dtRetiraPD:', req.body.containerMontadoAt);
          } else {
            console.log('[DELIVERY] ⚠️ containerMontadoAt enviado mas vazio');
          }
        }
        if (req.body.horarioDevolucaoVazio !== undefined) {
          if (req.body.horarioDevolucaoVazio) {
            ycompanyUpdates.dtDevolucaoCNTR = new Date(req.body.horarioDevolucaoVazio);
            console.log('[DELIVERY] ✅ Definindo dtDevolucaoCNTR via horarioDevolucaoVazio:', req.body.horarioDevolucaoVazio);
          } else {
            console.log('[DELIVERY] ⚠️ horarioDevolucaoVazio enviado mas vazio');
          }
        }
        // Verificar se observations contém CONTAINER_VAZIO_DEVOLVIDO
        if (req.body.observations !== undefined && req.body.observations && req.body.observations.includes('(CONTAINER_VAZIO_DEVOLVIDO)')) {
          ycompanyUpdates.dtDevolucaoCNTR = new Date();
          console.log('[DELIVERY] ✅ Definindo dtDevolucaoCNTR via observations');
        }

        console.log('[DELIVERY] 📝 Campos a atualizar no Ycompany:', Object.keys(ycompanyUpdates));

        if (Object.keys(ycompanyUpdates).length > 0) {
          const updateResult = await Ycompany.findByIdAndUpdate(ycompanyRecord._id, ycompanyUpdates, { new: true });
          console.log('[DELIVERY] ✅ Sincronizado campos do Ycompany', ycompanyRecord._id, Object.keys(ycompanyUpdates));
          console.log('[DELIVERY] 📊 Valores atualizados:', ycompanyUpdates);
        } else {
          console.log('[DELIVERY] ⚠️ Nenhum campo para atualizar no Ycompany');
        }
      } else {
        console.log('[DELIVERY] ❌ Registro Ycompany não encontrado para deliveryNumber:', deliveryNum);
      }
    } catch (syncErr) {
      console.error('[DELIVERY] ❌ Erro sync Ycompany:', syncErr.message || syncErr);
    }

    if (req.body.arrivedAt !== undefined) updates.arrivedAt = req.body.arrivedAt;
    if (req.body.containerMontadoAt !== undefined) updates.containerMontadoAt = req.body.containerMontadoAt ? new Date(req.body.containerMontadoAt) : null;
    if (req.body.currentStep !== undefined) updates.currentStep = req.body.currentStep;
    if (req.body.observations !== undefined) updates.observations = req.body.observations;
    if (req.body.documentsJustification !== undefined) updates.documentsJustification = req.body.documentsJustification;
    if (req.body.desovaStartAt !== undefined) updates.desovaStartAt = req.body.desovaStartAt;
    if (req.body.desovaEndAt !== undefined) updates.desovaEndAt = req.body.desovaEndAt;
    if (req.body.recebedor !== undefined) updates.recebedor = req.body.recebedor;
    if (req.body.horarioDevolucaoVazio !== undefined) updates.horarioDevolucaoVazio = req.body.horarioDevolucaoVazio;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Nada para atualizar' });
    }

    await db.updateOne("deliveries", { _id: id }, updates);
    const updated = await db.findById("deliveries", id);
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
    console.log('[PROGRAMACAO] Buscando programações vinculadas ao contratado do usuário. req.user.id=', req.user && req.user.id);
    const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');

    // Tentar derivar o contratado a partir do registro do usuário (busca no DB por id)
    const db = await getDb(req);
    let driverRecord = null;
    try {
      driverRecord = await db.findById('drivers', req.user.id);
    } catch (e) {
      console.warn('[PROGRAMACAO] Aviso: falha ao buscar registro do usuário no DB:', e && e.message ? e.message : e);
    }

    // Prioriza campos do registro do usuário: contratado > transportadora > name > fullName
    const contratadoRaw = (driverRecord && (driverRecord.contratado || driverRecord.transportadora || driverRecord.name || driverRecord.fullName)) || (req.user && (req.user.transportadora || req.user.contratado)) || '';
    const contratado = String(contratadoRaw || '').trim();

    // Se não houver contratado claro no usuário, retornar vazio
    if (!contratado) {
      return res.json({ success: true, programacoes: [] });
    }

    // Buscar todas as programações do contratado (case-insensitive), independente do status
    // Loga todas as programações encontradas
    const regex = new RegExp(`^${contratado}$`, 'i');
    const programacoes = await ProgramacaoEntrega.find({
      contratado: regex,
      ativo: { $ne: false }
    }).sort({ dataAgendamento: -1 });
    console.log('[PROGRAMACAO] Lista completa:', programacoes.map(p => ({ id: p._id, status: p.status, ativo: p.ativo })));
    console.log('[PROGRAMACAO] Encontradas', programacoes.length, 'programações para contratado', contratado);
    return res.json({ success: true, programacoes: programacoes || [] });
  } catch (err) {
    console.error('[PROGRAMACAO] Erro ao buscar programações do usuário', err);
    return res.status(500).json({ message: 'Erro ao listar programações do usuário', error: err.message });
  }
});

// =======================
// Upload documento (aceita múltiplos arquivos)
// POST /api/deliveries/:id/documents/:type
// =======================
router.post("/:id/documents/:type", auth, upload.array("file"), async (req, res) => {
  try {
    const { id, type } = req.params;
    console.log(`[UPLOAD] Iniciando upload para entrega ${id}, tipo ${type}`);
    console.log(`[UPLOAD] req.files:`, req.files);
    const db = await getDb(req);
    const delivery = await db.findById("deliveries", id);
    if (!delivery) {
      console.error(`[UPLOAD] Entrega não encontrada: ${id}`);
      return res.status(404).json({ message: "Entrega não encontrada" });
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
    const city = req.city || 'manaus';
    const containerDir = path.join(__dirname, "../uploads", city, containerFolder);
    try {
      fs.mkdirSync(containerDir, { recursive: true });
    } catch (err) {
      console.error(`[UPLOAD] Falha ao criar pasta: ${containerDir}`, err);
      return res.status(500).json({ message: "Erro ao criar pasta de upload", error: err.message });
    }

    const docs = delivery.documents || {};
    if (docs[type] && !Array.isArray(docs[type])) {
      docs[type] = [docs[type]];
    }

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

      // Merge existing docs and newly saved files
      let existing = docs[type];
      if (existing && typeof existing === 'string') {
        try {
          existing = JSON.parse(existing);
        } catch (e) {
          existing = [existing];
        }
      }
      existing = Array.isArray(existing) ? existing : (existing ? [existing] : []);

      // Combine and deduplicate by unique identifier (prefer url or path)
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
// Deletar um documento específico por índice
// DELETE /api/deliveries/:id/documents/:type/:index
// =======================
router.delete('/:id/documents/:type/:index', auth, async (req, res) => {
  try {
    const { id, type, index } = req.params;
    const db = await getDb(req);
    const delivery = await db.findById('deliveries', id);
    if (!delivery) return res.status(404).json({ message: 'Entrega não encontrada' });
    
    const docs = delivery.documents || {};
    const docEntry = docs[type];

    if (!docEntry) return res.status(404).json({ message: 'Documento não encontrado' });

    const idx = parseInt(index, 10);

    const city = req.city || 'manaus';

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
      const updated = await db.findById('deliveries', id);
      return res.json({ delivery: updated });
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

    const updated = await db.findById('deliveries', id);
    res.json({ delivery: updated });
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
    const db = await getDb(req);
    console.log('📩 Submit request', { id: req.params.id, body: req.body, headers: { 'x-city': req.header('x-city'), host: req.headers.host } });

    const delivery = await db.findById('deliveries', req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Entrega não encontrada' });

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
    const city = delivery.city || req.city || 'manaus';
    const requiredDocs = city === 'itajai'
      ? ['ricAbastecimento', 'diarioBordo', 'ricBaixa', 'ricColeta', 'discoTacografo']
       : ['canhotNF', 'canhotCTE', 'diarioBordo'];

    const missingDocs = requiredDocs.filter(doc => !docHasFiles(delivery.documents && delivery.documents[doc]));

    const { force, observation } = req.body || {};
    console.log('  -> missingDocs:', missingDocs, 'force:', force, 'observation:', observation);

    if (missingDocs.length > 0) {
      if (!force) {
        return res.status(400).json({ message: 'Documentos obrigatórios faltando: ' + missingDocs.join(', ') });
      }
      if (!observation || !String(observation || '').trim()) {
        return res.status(400).json({ message: 'Observação obrigatória para finalizar com documentos faltando' });
      }

      // Record that submit was forced
      const updates = { status: 'submitted', submittedAt: new Date(), submissionObservation: String(observation).trim(), submissionForce: true, missingDocumentsAtSubmit: missingDocs };
      await db.updateOne('deliveries', { _id: req.params.id }, updates);

      const deliveryAfterUpdate = await db.findById('deliveries', req.params.id);
      return res.json({ message: 'Entrega enviada com sucesso (forçada)', delivery: deliveryAfterUpdate });
    }

    // No missing docs, mark as submitted
    await db.updateOne('deliveries', { _id: req.params.id }, { status: 'submitted', submittedAt: new Date() });
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
    const db = req.mockdb;
    const delivery = await db.findById("deliveries", req.params.id);
    if (!delivery) return res.status(404).json({ message: "Entrega não encontrada" });

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

    await db.deleteOne("deliveries", { _id: req.params.id });
    return res.json({ message: "Entrega deletada" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erro ao deletar entrega' });
  }
});

module.exports = router;
