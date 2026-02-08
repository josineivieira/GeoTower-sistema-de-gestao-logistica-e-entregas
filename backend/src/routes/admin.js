const express = require("express");
const path = require("path");
const fs = require("fs");
const archiver = require('archiver');
const multer = require('multer');
const os = require('os');
const mockdb = require("../mockdb");
const auth = require("../middleware/auth");
const { normalizeDeliveryForResponse } = require("../utils/storageUtils");

const router = express.Router();

// Helper to normalize db calls (sync mockdb or async mongo adapter)
async function getDb(req) {
  const db = req.mockdb || require('../mockdb');
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

function onlyAdmin(req, res, next) {
  const role = req.user?.role || "operacao";
  if (role !== "admin" && role !== "gestor") {
    return res.status(403).json({ message: "Sem permissão" });
  }
  next();
}

/**
 * GET /api/admin/statistics
 * Retorna estatísticas gerais
 */
router.get("/statistics", auth, onlyAdmin, async (req, res) => {
  try {
    const db = await getDb(req);
    const deliveries = await db.find("deliveries", {});
    
    const totalDeliveries = (deliveries || []).length;
    const submitted = (deliveries || []).filter(d => d.status === "submitted").length;
    const pending = (deliveries || []).filter(d => d.status === "pending").length;
    
    // Agrupa por transportadora (placa) - removendo espaços em branco
    // Agrupa por contratado (userName)
    const deliveriesByContratado = {};
    deliveries.forEach(d => {
      const contratado = (d.userName || "Sem Contratado").trim();
      if (!deliveriesByContratado[contratado]) {
        deliveriesByContratado[contratado] = 0;
      }
      deliveriesByContratado[contratado]++;
    });

    const dailyDeliveries = [];
    const daysMap = {};
    
    deliveries.forEach(d => {
      // Agrupa pela data local (fuso de São Paulo) para evitar deslocamentos por UTC
      const dt = new Date(d.createdAt);
      const date = dt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
      if (!daysMap[date]) {
        daysMap[date] = 0;
      }
      daysMap[date]++;
    });

    Object.entries(daysMap).forEach(([date, count]) => {
      dailyDeliveries.push({ _id: date, count });
    });

    const statistics = {
      totalDeliveries,
      submitted,
      pending,
      deliveriesByDriver: Object.entries(deliveriesByContratado).map(([contratado, count]) => ({ _id: contratado, count })),
      dailyDeliveries: dailyDeliveries.sort((a, b) => new Date(a._id) - new Date(b._id))
    };

    return res.json({ statistics });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return res.status(500).json({ message: "Erro ao buscar estatísticas" });
  }
});

/**
 * GET /api/admin/deliveries
 * Lista todas entregas (admin/gestor)
 * filtros:
 *  - status=draft|submitted|all
 *  - q=texto
 * 
 * Consolida automaticamente arquivos das duas pastas de uploads
 */
router.get("/deliveries", auth, onlyAdmin, async (req, res) => {
  try {
    const { status, q, startDate, endDate } = req.query;
    console.log('📋 GET /admin/deliveries recebido com filtros:', { status, q, startDate, endDate });
    
    // Debug: mostra total de entregas disponíveis (deve usar db com await, não mockdb direto)
    const db = await getDb(req);
    const allDeliveries = await db.find("deliveries", {});
    console.log('  ℹ️  Total de entregas na DB:', allDeliveries ? allDeliveries.length : 0);
    
    const filter = {};

    if (status && status !== "all") {
      console.log('  ✓ Aplicando filtro de status:', status);
      filter.status = status;
    }

    if (q && q.trim()) {
      const text = q.trim();
      console.log('  ✓ Aplicando filtro de busca:', text);
      filter.$or = [
        { deliveryNumber: { $regex: text, $options: "i" } },
        { vehiclePlate: { $regex: text, $options: "i" } },
        { userName: { $regex: text, $options: "i" } },
        { driverName: { $regex: text, $options: "i" } }
      ];
    }

    // Busca inicialmente usando o db (mockdb ou mongo adapter)
    // db já foi obtido no debug acima, não precisa obter novamente
    let deliveries = await db.find("deliveries", filter) || [];
    deliveries = deliveries.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    console.log('  → Após db.find com filter:', JSON.stringify(filter), '- Retornou', deliveries.length, 'entregas');

    // Filtra por intervalo de datas se fornecido (formato YYYY-MM-DD)
    if (startDate || endDate) {
      console.log('  ✓ Aplicando filtro de datas:', { startDate, endDate });
      const start = startDate ? new Date(startDate + 'T00:00:00Z') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59Z') : null;
      console.log('  → Datas parseadas:', { start: start?.toISOString(), end: end?.toISOString() });
      
      const deliveriesBefore = deliveries.length;
      deliveries = deliveries.filter(d => {
        const created = new Date(d.createdAt);
        console.log(`    Verificando ${d.deliveryNumber}: createdAt=${created.toISOString()}`);
        if (start && created < start) {
          console.log(`      ✗ Antes da data inicial`);
          return false;
        }
        if (end && created > end) {
          console.log(`      ✗ Depois da data final`);
          return false;
        }
        console.log(`      ✓ Dentro do intervalo`);
        return true;
      });
      console.log('  → Após filtro de datas:', deliveriesBefore, '→', deliveries.length, 'entregas');
    }
    
    console.log('✅ Retornando', deliveries.length, 'entregas');
    
    // Normaliza documentos para resposta (desserializa JSON strings)
    const normalizedDeliveries = deliveries.map(d => normalizeDeliveryForResponse(d));
    
    // Consolida arquivos de ambas as pastas (inclui subpastas por cidade) para cada entrega
    const uploadsPath1 = path.join(__dirname, "../uploads");
    const uploadsPath2 = path.join(__dirname, "../src/uploads");
    const cities = ['manaus', 'itajai'];
    
    const deliveriesWithFiles = normalizedDeliveries.map(delivery => {
      const consolidatedFiles = {};
      
      // Busca arquivos nas duas pastas e em subpastas por cidade
      [uploadsPath1, uploadsPath2].forEach(uploadsPath => {
        // Verifica local direto
        const deliveryPath = path.join(uploadsPath, delivery.deliveryNumber);
        if (fs.existsSync(deliveryPath)) {
          try {
            const files = fs.readdirSync(deliveryPath);
            files.forEach(file => { consolidatedFiles[file] = true; });
          } catch (err) {
            console.error(`Erro ao listar arquivos em ${deliveryPath}:`, err);
          }
        }

        // Verifica subpastas de cidades
        cities.forEach(city => {
          const cPath = path.join(uploadsPath, city, delivery.deliveryNumber);
          if (fs.existsSync(cPath)) {
            try {
              const files = fs.readdirSync(cPath);
              files.forEach(file => { consolidatedFiles[file] = true; });
            } catch (err) {
              console.error(`Erro ao listar arquivos em ${cPath}:`, err);
            }
          }
        });
      });
      
      return {
        ...delivery,
        uploadedFiles: Object.keys(consolidatedFiles), // Lista de arquivos consolidados
        hasFiles: Object.keys(consolidatedFiles).length > 0
      };
    });
    
    return res.json({ deliveries: deliveriesWithFiles });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao listar entregas (admin)" });
  }
});

/**
 * GET /api/admin/deliveries/:id
 */
router.get("/deliveries/:id", auth, onlyAdmin, async (req, res) => {
  try {
    const db = await getDb(req);
    const delivery = await db.findById("deliveries", req.params.id);
    if (!delivery) return res.status(404).json({ message: "Entrega não encontrada" });
    return res.json({ delivery });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao buscar entrega (admin)" });
  }
});

/**
 * GET /api/admin/deliveries/:id/documents/:documentType/download
 * Download de documento específico
 */
router.get("/deliveries/:id/documents/:documentType/download", auth, onlyAdmin, async (req, res) => {
  try {
    const { id, documentType } = req.params;
    console.log(`[DOWNLOAD] Iniciando download: entrega=${id}, tipo=${documentType}, index=${req.query.index || 0}`);

    // Busca entrega
    const db = await getDb(req);
    const delivery = await db.findById("deliveries", id);
    if (!delivery) {
      console.error(`[DOWNLOAD] Entrega não encontrada: ${id}`);
      return res.status(404).json({ message: "Entrega não encontrada" });
    }

    // Verifica se o tipo de documento é conhecido para esta entrega
    const docs = delivery.documents || {};
    console.log(`[DOWNLOAD] Documentos na entrega:`, Object.keys(docs));
    
    if (!Object.prototype.hasOwnProperty.call(docs, documentType) || !docs[documentType]) {
      console.error(`[DOWNLOAD] Tipo de documento não encontrado: ${documentType}`);
      return res.status(404).json({ message: "Documento não encontrado para esta entrega" });
    }

    // Normalize delivery first to ensure documents are properly parsed
    const normalized = normalizeDeliveryForResponse(delivery);
    console.log(`[DOWNLOAD] Entrega normalizada, docs keys:`, Object.keys(normalized.documents || {}));
    const normalizedEntry = normalized.documents[documentType];
    console.log(`[DOWNLOAD] Entry para tipo "${documentType}":`, JSON.stringify(normalizedEntry));
    
    let docArray = Array.isArray(normalizedEntry) ? normalizedEntry : (normalizedEntry ? [normalizedEntry] : []);
    console.log(`[DOWNLOAD] Array antes de processar:`, JSON.stringify(docArray));
    
    // Converte elementos simples (string paths) em objetos { path }
    docArray = docArray.map((el, i) => {
      if (!el) return el;
      if (typeof el === 'string') {
        console.log(`[DOWNLOAD] Convertendo string [${i}] em objeto path: ${el}`);
        return { path: el };
      }
      if (typeof el === 'object' && !el.path && !el.id && el.name) {
        console.log(`[DOWNLOAD] Adicionando path a objeto [${i}] com name: ${el.name}`);
        return { ...el, path: el.name };
      }
      return el;
    });
    console.log(`[DOWNLOAD] Documentos após processar:`, JSON.stringify(docArray));
    
    const idx = parseInt(req.query.index || '0', 10);
    if (isNaN(idx) || idx < 0 || idx >= docArray.length) {
      console.error(`[DOWNLOAD] Índice inválido: ${idx}, tamanho do array: ${docArray.length}`);
      return res.status(400).json({ message: 'Índice de documento inválido' });
    }
    
    const docInfo = docArray[idx];
    console.log(`[DOWNLOAD] Informações do documento [${idx}]:`, JSON.stringify(docInfo));

    // Se docInfo é uma string simples, trata como path direto
    if (typeof docInfo === 'string') {
      console.log(`[DOWNLOAD] docInfo é string simples, tratando como path: ${docInfo}`);
      const simpleDocInfo = { path: docInfo };
      
      // Trata como arquivo local
      const uploadsPath1 = path.join(__dirname, "../uploads");
      const uploadsPath2 = path.join(__dirname, "../src/uploads");
      const city = delivery.city || 'manaus';
      
      let filePath = null;
      const candidate1 = path.join(uploadsPath1, simpleDocInfo.path);
      const candidate2 = path.join(uploadsPath2, simpleDocInfo.path);
      const candidate3 = path.join(uploadsPath1, city, simpleDocInfo.path);
      const candidate4 = path.join(uploadsPath2, city, simpleDocInfo.path);
      
      if (fs.existsSync(candidate1)) filePath = candidate1;
      else if (fs.existsSync(candidate2)) filePath = candidate2;
      else if (fs.existsSync(candidate3)) filePath = candidate3;
      else if (fs.existsSync(candidate4)) filePath = candidate4;
      
      console.log(`[DOWNLOAD] Testadas rotas para string: ${candidate1}, ${candidate2}, ${candidate3}, ${candidate4}`);
      
      if (!filePath) {
        console.error(`[DOWNLOAD] Arquivo não encontrado: ${simpleDocInfo.path}`);
        return res.status(404).json({ message: 'Arquivo não encontrado no servidor' });
      }
      
      try {
        const stat = fs.statSync(filePath);
        const filename = path.basename(filePath);
        console.log(`[DOWNLOAD] Arquivo encontrado, tamanho: ${stat.size} bytes`);
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', stat.size);
        
        const readStream = fs.createReadStream(filePath);
        readStream.on('error', (err) => {
          console.error(`[DOWNLOAD] Erro ao ler arquivo:`, err.message);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Erro ao ler arquivo' });
          }
        });
        
        console.log(`[DOWNLOAD] ✓ Iniciando stream do arquivo local: ${filename}`);
        return readStream.pipe(res);
      } catch (err) {
        console.error(`[DOWNLOAD] ✗ Erro ao servir arquivo local:`, err && err.message ? err.message : err);
        return res.status(500).json({ message: 'Erro ao servir arquivo' });
      }
    }

    // Se tem ID do Google Drive, baixa de lá
    if (docInfo && docInfo.id) {
      console.log(`[DOWNLOAD] Documento encontrado no Google Drive: ${docInfo.id}`);
      try {
        const { google } = require('googleapis');
        const { getOAuth2Client } = require('../storage/gdrive');
        const drive = google.drive({ version: 'v3', auth: getOAuth2Client() });
        
        console.log(`[DOWNLOAD] Requisitando arquivo do Google Drive: ${docInfo.id}`);
        const driveRes = await drive.files.get({
          fileId: docInfo.id,
          alt: 'media'
        }, { responseType: 'stream' });
        
        const filename = docInfo.name || (delivery.deliveryNumber + '_' + documentType + '.jpg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        console.log(`[DOWNLOAD] ✓ Início do stream do Google Drive: ${filename}`);
        driveRes.data.pipe(res);
      } catch (err) {
        console.error(`[DOWNLOAD] ✗ Erro ao baixar do Google Drive:`, err && err.message ? err.message : err);
        return res.status(500).json({ message: 'Erro ao baixar do Google Drive' });
      }
    } 
    // Se tem caminho local, serve do disco
    else if (docInfo && docInfo.path) {
      console.log(`[DOWNLOAD] Documento encontrado localmente: ${docInfo.path}`);
      try {
        // Tenta em ambos os locais (como faz o ZIP)
        const uploadsPath1 = path.join(__dirname, "../uploads");
        const uploadsPath2 = path.join(__dirname, "../src/uploads");
        const city = delivery.city || 'manaus';
        
        let filePath = null;
        const candidate1 = path.join(uploadsPath1, docInfo.path);
        const candidate2 = path.join(uploadsPath2, docInfo.path);
        const candidate3 = path.join(uploadsPath1, city, docInfo.path);
        const candidate4 = path.join(uploadsPath2, city, docInfo.path);
        
        if (fs.existsSync(candidate1)) filePath = candidate1;
        else if (fs.existsSync(candidate2)) filePath = candidate2;
        else if (fs.existsSync(candidate3)) filePath = candidate3;
        else if (fs.existsSync(candidate4)) filePath = candidate4;
        
        console.log(`[DOWNLOAD] Testadas rotas: ${candidate1}, ${candidate2}, ${candidate3}, ${candidate4}`);
        console.log(`[DOWNLOAD] Caminho resolvido: ${filePath}`);
        
        if (!filePath) {
          console.error(`[DOWNLOAD] Arquivo não existe em nenhum local: ${docInfo.path}`);
          return res.status(404).json({ message: 'Arquivo não encontrado no servidor' });
        }
        
        const stat = fs.statSync(filePath);
        const filename = docInfo.name || path.basename(filePath);
        console.log(`[DOWNLOAD] Arquivo encontrado, tamanho: ${stat.size} bytes`);
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', stat.size);
        
        const readStream = fs.createReadStream(filePath);
        readStream.on('error', (err) => {
          console.error(`[DOWNLOAD] Erro ao ler arquivo:`, err.message);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Erro ao ler arquivo' });
          }
        });
        
        console.log(`[DOWNLOAD] ✓ Iniciando stream do arquivo local: ${filename}`);
        readStream.pipe(res);
      } catch (err) {
        console.error(`[DOWNLOAD] ✗ Erro ao servir arquivo local:`, err && err.message ? err.message : err);
        return res.status(500).json({ message: 'Erro ao servir arquivo' });
      }
    } 
    // Documento sem ID nem path
    else {
      console.error(`[DOWNLOAD] Documento sem ID ou path:`, docInfo);
      return res.status(404).json({ message: 'Documento inválido: sem ID ou caminho' });
    }
  } catch (err) {
    console.error(`[DOWNLOAD] Erro geral:`, err && err.message ? err.message : err);
    console.error(`[DOWNLOAD] Stack:`, err && err.stack ? err.stack : 'N/A');
    return res.status(500).json({ message: "Erro ao fazer download" });
  }
});


/**
 * GET /api/admin/deliveries/:id/documents/zip
 * Cria um ZIP com todos os documentos da entrega e envia em streaming
 */
router.get('/deliveries/:id/documents/zip', auth, onlyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[ZIP] Iniciando geração de ZIP para entrega: ${id}`);
    
    const db = await getDb(req);
    const delivery = await db.findById('deliveries', id);
    if (!delivery) {
      console.error(`[ZIP] Entrega não encontrada: ${id}`);
      return res.status(404).json({ message: 'Entrega não encontrada' });
    }

    const docs = delivery.documents || {};
    const filesToAdd = [];
    const city = delivery.city || req.city || 'manaus';
    
    console.log(`[ZIP] Documentos na entrega:`, Object.keys(docs));

    // Parse e coleta todos os documentos
    Object.entries(docs).forEach(([docType, entry]) => {
      if (!entry) {
        console.log(`[ZIP] Tipo "${docType}" vazio, ignorando`);
        return;
      }
      
      // Parse se for string JSON
      let docArray = entry;
      if (typeof entry === 'string') {
        try {
          docArray = JSON.parse(entry);
          console.log(`[ZIP] Tipo "${docType}" parseado de JSON`);
        } catch (e) {
          console.warn(`[ZIP] Falha ao fazer parse de "${docType}":`, e.message);
          docArray = [{ path: entry }]; // Trata como caminho plano
        }
      }
      
      // Garante que é array
      if (!Array.isArray(docArray)) {
        docArray = [docArray];
      }
      
      docArray.forEach((doc, idx) => {
        if (doc) {
          filesToAdd.push({ doc, docType, idx });
          console.log(`[ZIP] Documento encontrado: ${docType}[${idx}]`, doc);
        }
      });
    });

    // Se não houver arquivos, retorna 404
    if (filesToAdd.length === 0) {
      console.warn(`[ZIP] Nenhum documento encontrado para entrega: ${id}`);
      return res.status(404).json({ message: 'Nenhum documento encontrado para esta entrega' });
    }

    console.log(`[ZIP] Total de documentos a empacotar: ${filesToAdd.length}`);

    // Prepara o archiver
    res.attachment(`${delivery.deliveryNumber}_documents.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error(`[ZIP] Erro no archiver:`, err.message);
      throw err;
    });
    archive.pipe(res);

    const { google } = require('googleapis');
    const { getOAuth2Client } = require('../storage/gdrive');
    let driveClient = null;

    // Lista de arquivos faltando
    let missing = [];
    let addedCount = 0;

    for (const item of filesToAdd) {
      const { doc, docType, idx } = item;
      let added = false;

      // Tenta Google Drive primeiro (se tem ID)
      if (doc.id) {
        try {
          console.log(`[ZIP] Tentando adicionar do Google Drive: ${docType}[${idx}] (ID: ${doc.id})`);
          
          if (!driveClient) {
            driveClient = google.drive({ version: 'v3', auth: getOAuth2Client() });
          }
          
          const driveRes = await driveClient.files.get({
            fileId: doc.id,
            alt: 'media'
          }, { responseType: 'stream' });
          
          const filename = doc.name || `${docType}_${idx}`;
          archive.append(driveRes.data, { name: path.join(delivery.deliveryNumber, filename) });
          addedCount++;
          added = true;
          console.log(`[ZIP] ✓ Adicionado do Google Drive: ${filename}`);
        } catch (err) {
          console.error(`[ZIP] ✗ Falha do Google Drive para ${docType}[${idx}]:`, err.message);
          missing.push(`${docType}[${idx}] (Google Drive: ${doc.id})`);
        }
      }

      // Tenta arquivo local (se tem path)
      if (!added && doc.path) {
        try {
          console.log(`[ZIP] Tentando adicionar arquivo local: ${docType}[${idx}] (${doc.path})`);
          
          const candidateCity = path.join(__dirname, '..', 'uploads', city, doc.path);
          const candidateRoot = path.join(__dirname, '..', 'uploads', doc.path);
          let filePath = null;

          if (fs.existsSync(candidateCity)) {
            filePath = candidateCity;
          } else if (fs.existsSync(candidateRoot)) {
            filePath = candidateRoot;
          }

          if (filePath) {
            const stat = fs.statSync(filePath);
            const filename = doc.name || path.basename(filePath);
            archive.file(filePath, { name: path.join(delivery.deliveryNumber, filename) });
            addedCount++;
            added = true;
            console.log(`[ZIP] ✓ Adicionado arquivo local: ${filename} (${stat.size} bytes)`);
          } else {
            console.warn(`[ZIP] Arquivo local não encontrado: ${doc.path}`);
            missing.push(`${docType}[${idx}] (Local: ${doc.path})`);
          }
        } catch (err) {
          console.error(`[ZIP] ✗ Falha ao adicionar arquivo local ${docType}[${idx}]:`, err.message);
          missing.push(`${docType}[${idx}] (Erro: ${err.message})`);
        }
      }

      if (!added && !doc.id && !doc.path) {
        console.warn(`[ZIP] Documento sem ID nem path: ${docType}[${idx}]`, doc);
        missing.push(`${docType}[${idx}] (Sem dados)`);
      }
    }

    if (missing.length) {
      console.log(`[ZIP] Adicionando arquivo de documentos faltando (${missing.length} itens)`);
      archive.append('Arquivos não encontrados:\n' + missing.join('\n'), { name: 'MISSING_FILES.txt' });
    }

    console.log(`[ZIP] Finalizando arquivo (${addedCount} arquivos adicionados)`);
    await archive.finalize();
    console.log(`[ZIP] ✓ ZIP gerado com sucesso`);
  } catch (err) {
    console.error(`[ZIP] ✗ Erro ao gerar ZIP:`, err && err.message ? err.message : err);
    console.error(`[ZIP] Stack:`, err && err.stack ? err.stack : 'N/A');
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Erro ao gerar ZIP', error: err && err.message ? err.message : err });
    }
  }
});

/**
 * PUT /api/admin/deliveries/:id
 * Atualiza dados de uma entrega (apenas admin)
 */
router.put("/deliveries/:id", auth, onlyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryNumber, userName, driverName, vehiclePlate, observations } = req.body;

    console.log('📝 Recebido PUT /deliveries/:id', { id, deliveryNumber, userName, driverName, vehiclePlate, observations });

    // Validar se motivo da edição foi fornecido
    if (!observations || observations.trim() === '') {
      console.log('❌ Motivo vazio');
      return res.status(400).json({ message: "Motivo da edição é obrigatório" });
    }

    // Busca entrega
    const db = await getDb(req);
    const delivery = await db.findById("deliveries", req.params.id);
    console.log('🔍 Entrega encontrada:', delivery?.deliveryNumber);
    if (!delivery) {
      return res.status(404).json({ message: "Entrega não encontrada" });
    }

    // Atualiza campos
    const updates = {};
    if (deliveryNumber !== undefined) updates.deliveryNumber = deliveryNumber.toUpperCase();
    if (userName !== undefined) updates.userName = userName;
    if (driverName !== undefined) updates.driverName = driverName;
    if (vehiclePlate !== undefined) updates.vehiclePlate = vehiclePlate.trim();
    if (observations !== undefined) updates.observations = observations;
    updates.editedAt = new Date().toISOString();
    updates.editReason = observations;

    console.log('🔄 Updates a fazer:', updates);

    const updated = await db.updateOne("deliveries", { _id: id }, updates);
    console.log('✅ Atualizado:', updated?.deliveryNumber);
    if (!updated) {
      return res.status(500).json({ message: "Erro ao atualizar entrega" });
    }

    return res.json({ success: true, delivery: updated, message: "Entrega atualizada com sucesso" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao atualizar entrega" });
  }
});

/**
 * DELETE /api/admin/deliveries/:id
 * Deleta uma entrega (apenas admin)
 */
router.delete("/deliveries/:id", auth, onlyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Busca entrega
    const db = await getDb(req);
    const delivery = await db.findById("deliveries", id);
    if (!delivery) {
      return res.status(404).json({ message: "Entrega não encontrada" });
    }

      // Remove associated files from disk/S3 before deleting
    try {
      const { deleteDeliveryFiles } = require('../utils/storageUtils');
      const removed = await deleteDeliveryFiles(delivery);
      console.log('🗑️ Admin removed files for delivery', id, removed);
    } catch (err) {
      console.warn('⚠️ Error while removing files for delivery (admin):', err.message || err);
    }

    // Deleta entrega do banco
    const deleted = await db.deleteOne("deliveries", { _id: id });
    if (!deleted) {
      return res.status(500).json({ message: "Erro ao deletar entrega" });
    }

    return res.json({ success: true, message: "Entrega deletada com sucesso" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao deletar entrega (admin)" });
  }
});

/**
 * GET /api/admin/users
 * Lista todos os usuários
 */
router.get("/users", auth, onlyAdmin, async (req, res) => {
  try {
    const db = await getDb(req);
    const users = await db.find("drivers", {}) || [];
    const usersWithoutPasswords = users.map(u => ({
      _id: u._id,
      username: u.username,
      email: u.email,
      name: u.name || u.fullName,
      role: u.role
    }));
    return res.json({ users: usersWithoutPasswords });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao listar usuários" });
  }
});

/**
 * POST /api/admin/users
 * Criar novo usuário
 */
router.post("/users", auth, onlyAdmin, async (req, res) => {
  try {
    const { username, email, name, password, role } = req.body;

    if (!username || !email || !name || !password) {
      return res.status(400).json({ message: "Preencha todos os campos" });
    }

    // Normaliza username/email para minúsculas — login procura por username.toLowerCase()
    const normalizedUsername = String(username).toLowerCase();
    const normalizedEmail = String(email).toLowerCase();

    // Verifica se usuário existe (por username ou email)
    const db = await getDb(req);
    const existing = await db.find('drivers', { $or: [{ username: normalizedUsername }, { email: normalizedEmail }] });
    if (existing && existing.length > 0) {
      return res.status(400).json({ message: "Usuário já existe" });
    }

    const crypto = require('crypto');
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const newUser = {
      _id: 'user_' + crypto.randomUUID(),
      username: normalizedUsername,
      email: normalizedEmail,
      name,
      fullName: name,
      password: hashedPassword,
      role: role || 'driver',
      phoneNumber: '',
      cnh: '',
      isActive: true,
      createdAt: new Date()
    };

    // Use API do DB (mockdb or mongo adapter) to insert
    const created = await db.create('drivers', newUser);
    console.log('➕ Novo usuário criado (sem senha no log):', { _id: created._id, username: created.username, email: created.email, role: created.role });

    return res.json({ 
      success: true, 
      message: "Usuário criado com sucesso",
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao criar usuário" });
  }
});

/**
 * PUT /api/admin/users/:id
 * Atualizar usuário
 */
router.put("/users/:id", auth, onlyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, role } = req.body;

    const db = await getDb(req);
    const user = await db.findById("drivers", id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const updates = {};
    if (email) updates.email = email;
    if (name) {
      updates.name = name;
      updates.fullName = name;
    }
    if (role) updates.role = role;

    await db.updateOne("drivers", { _id: id }, updates);

    return res.json({ 
      success: true, 
      message: "Usuário atualizado com sucesso"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao atualizar usuário" });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Deletar usuário
 */
router.delete("/users/:id", auth, onlyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb(req);
    const user = await db.findById("drivers", id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    await db.deleteOne("drivers", { _id: id });

    return res.json({ 
      success: true, 
      message: "Usuário deletado com sucesso"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao deletar usuário" });
  }
});

/**
 * GET /api/admin/programs
 * Lista programas criados
 */
router.get('/programs', auth, onlyAdmin, async (req, res) => {
  try {
    const db = req.mockdb;
    const programs = await db.find('programs', {});
    return res.json({ programs });
  } catch (err) {
    console.error('Erro ao listar programas:', err);
    return res.status(500).json({ message: 'Erro ao listar programas' });
  }
});

/**
 * POST /api/admin/programs
 * Salva uma programação (simples)
 */
router.post('/programs', auth, onlyAdmin, async (req, res) => {
  try {
    const db = await getDb(req);
    const payload = req.body || {};
    const program = await db.create('programs', Object.assign({}, payload, { createdAt: new Date().toISOString(), createdBy: req.user.id }));
    return res.json({ success: true, program });
  } catch (err) {
    console.error('Erro ao criar programação:', err);
    return res.status(500).json({ message: 'Erro ao criar programação' });
  }
});

// -------------------------
// Importar CSV de Programações
// POST /api/admin/programs/import
// Aceita multipart/form-data com campo 'file' (CSV) ou JSON { text: 'csv content' }
// -------------------------
const upload = multer({ dest: path.join(os.tmpdir(), 'geo_programs') });

function parseCsv(text) {
  const requiredHeaders = ['Processo','cliente','FORNECEDOR','Destinatário','Navio','Nr. vi','Nº container','NF','CNTR','Dt. Agendamento','Observação destino','CONTRATADO','PROCESSO2','PERFORMANCE','Ocorrencia'];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return { error: 'CSV vazio' };

  const header = lines[0].split(/,|\t/).map(h => h.trim());
  const missing = requiredHeaders.filter(h => !header.includes(h));
  if (missing.length) return { error: 'Cabeçalho inválido. Faltando colunas: ' + missing.join(', ') };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/,|\t/).map(c => c.trim());
    if (cols.length === 0 || cols.every(c => c === '')) continue;
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = cols[idx] || '';
    });
    rows.push(obj);
  }
  return { header, rows };
}

router.post('/programs/import', auth, onlyAdmin, upload.single('file'), async (req, res) => {
  try {
    const db = await getDb(req);

    let csvText = null;
    if (req.file && req.file.path) {
      csvText = fs.readFileSync(req.file.path, 'utf8');
      // remove temp file
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    } else if (req.body && req.body.text) {
      csvText = String(req.body.text || '');
    }

    if (!csvText) return res.status(400).json({ message: 'Nenhum CSV fornecido' });

    const parsed = parseCsv(csvText);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const created = [];
    for (const r of parsed.rows) {
      const program = await db.create('programs', Object.assign({}, r, { createdAt: new Date().toISOString(), createdBy: req.user.id }));
      created.push(program);
    }

    return res.json({ success: true, created });
  } catch (err) {
    console.error('Erro ao importar programações:', err);
    return res.status(500).json({ message: 'Erro ao importar programações' });
  }
});

// Persistence test endpoint - verifies DB connectivity and uploads disk writability
router.get('/persistence/test', auth, onlyAdmin, async (req, res) => {
  try {
    const db = await getDb(req);
    const total = (await db.find('deliveries', {}))?.length || 0;

    // Attempt to write temp file to uploads dir
    const base = process.env.BACKEND_UPLOADS_DIR ? path.resolve(process.env.BACKEND_UPLOADS_DIR) : path.join(__dirname, '..', 'uploads');
    const testDir = path.join(base, 'persistence_test');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const testFile = path.join(testDir, `test-${Date.now()}.txt`);
    fs.writeFileSync(testFile, 'ok');
    const exists = fs.existsSync(testFile);
    // cleanup
    try { fs.unlinkSync(testFile); } catch(e){}

    return res.json({ success: true, mongodbConnected: !!process.env.MONGO_URI, deliveriesCount: total, uploadsWritable: !!exists, uploadsPath: base });
  } catch (err) {
    console.error('Persistence test error:', err);
    return res.status(500).json({ success: false, message: 'Persistence test failed', error: err.message });
  }
});

module.exports = router;

// DEBUG: export drivers to JSON file (admin only) - useful for backup
// Use: GET /api/admin/debug/export-drivers
router.get('/debug/export-drivers', auth, onlyAdmin, async (req, res) => {
  try {
    const db = await getDb(req);
    const drivers = await db.find('drivers', {});
    const exportDir = path.join(__dirname, '../data/exports');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const filename = `drivers-export-${Date.now()}.json`;
    const fullPath = path.join(exportDir, filename);
    fs.writeFileSync(fullPath, JSON.stringify({ drivers }, null, 2));
    return res.json({ success: true, message: 'Export realizado', path: fullPath });
  } catch (err) {
    console.error('Erro export drivers:', err);
    return res.status(500).json({ success: false, message: 'Erro ao exportar drivers' });
  }
});
