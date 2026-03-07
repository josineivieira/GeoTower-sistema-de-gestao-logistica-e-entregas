const express = require("express");
const path = require("path");
const fs = require("fs");
const archiver = require('archiver');
const multer = require('multer');
const os = require('os');
const mockdb = require("../mockdb");
const auth = require("../middleware/auth");
const onlyAdminMiddleware = require("../middleware/adminOnly");
const managerOnly = require("../middleware/managerOnly");
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
  // Aceita ambos 'gestor' e 'manager' como sinônimos de Gerente
  if (role !== "admin" && role !== "gestor" && role !== "manager") {
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
 *  - period=today|yesterday|tomorrow (filtra por dataAgendamento)
 * 
 * Consolida automaticamente arquivos das duas pastas de uploads
 */
router.get("/deliveries", auth, onlyAdmin, async (req, res) => {
  try {
    const { status, q, startDate, endDate, period, periodDate } = req.query;
    console.log('📋 GET /admin/deliveries recebido com filtros:', { status, q, startDate, endDate, period, periodDate });
    
    // Buscar programações
    const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
    const programacoes = await ProgramacaoEntrega.find({});
    console.log('  ℹ️  Total de programações:', programacoes ? programacoes.length : 0);

    // Calcula effectiveDate se period/periodDate fornecidos
    let effectiveDate = '';
    if (periodDate && String(periodDate).trim()) {
      effectiveDate = String(periodDate).trim();
      console.log('🗓️  Usando periodDate do cliente:', effectiveDate);
    } else if (period && period !== 'general') {
      console.log('🗓️  Aplicando filtro de período:', period);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (period === 'yesterday') {
        today.setDate(today.getDate() - 1);
      } else if (period === 'tomorrow') {
        today.setDate(today.getDate() + 1);
      }
      effectiveDate = today.toLocaleDateString('pt-BR');
      console.log('   convertido para data efetiva:', effectiveDate);
    }

    // *** UNIFIED LOGIC BELOW ***
    // buscamos entregas iniciadas e também levamos em conta programações não iniciadas
    const db = await getDb(req);
    const allDeliveries = await db.find("deliveries", {});
    console.log('  ℹ️  Total de entregas na DB:', allDeliveries ? allDeliveries.length : 0);

    // Normaliza documentos para resposta
    const normalizedDeliveries = (allDeliveries || []).map(d => {
      try {
        return normalizeDeliveryForResponse(d);
      } catch (err) {
        console.error('Erro ao normalizar entrega:', err);
        return d;
      }
    });

    // Cruzar dados de programação (por container) e construir lista combinada
    let deliveriesWithProgramacao = normalizedDeliveries.map(delivery => {
      const prog = programacoes.find(p => 
        (p.container || '').toUpperCase() === (delivery.deliveryNumber || '').toUpperCase()
      );
      return {
        ...delivery,
        recebedor: prog ? prog.recebedor : '',
        dataAgendamento: prog ? prog.dataAgendamento : '',
        horarioChegada: delivery.arrivedAt || '',
        horarioInicioDesova: delivery.desovaStartAt || '',
        horarioFimDesova: delivery.desovaEndAt || '',
        status: delivery.status
      };
    });

    // adicionar programações que não têm entrega correspondente
    programacoes.forEach(prog => {
      const key = (prog.container || '').toUpperCase();
      const exists = normalizedDeliveries.find(d => (d.deliveryNumber || '').toUpperCase() === key);
      if (!exists) {
        deliveriesWithProgramacao.push({
          _id: prog._id,
          deliveryNumber: prog.container || prog.processo,
          userName: prog.contratado || '',
          driverName: prog.motorista || '-',
          recebedor: prog.recebedor || '',
          dataAgendamento: prog.dataAgendamento || '',
          status: prog.status || 'AGENDADO',
          documents: {},
          uploadedFiles: [],
          hasFiles: false,
          createdAt: prog.createdAt,
          observations: prog.observacoes || ''
        });
      }
    });

    console.log(`  ✓ Combinação total após incluir agendadas: ${deliveriesWithProgramacao.length}`);

    // se tem effectiveDate, filtramos a lista combinada por dataAgendamento
    if (effectiveDate) {
      console.log('📅 Aplicando filtro de período sobre lista combinada para data:', effectiveDate);
      const [edDay, edMonth, edYear] = effectiveDate.split('/').map(Number);
      deliveriesWithProgramacao = deliveriesWithProgramacao.filter(d => {
        if (!d.dataAgendamento) return false;
        const progDateStr = String(d.dataAgendamento).trim();
        let pd;
        if (/\d{2}\/\d{2}\/\d{4}/.test(progDateStr)) {
          const parts = progDateStr.split(' ')[0].split('/');
          pd = { day: Number(parts[0]), month: Number(parts[1]), year: Number(parts[2]) };
        } else if (/\d{4}-\d{2}-\d{2}/.test(progDateStr)) {
          const parts = progDateStr.split('T')[0].split('-');
          pd = { day: Number(parts[2]), month: Number(parts[1]), year: Number(parts[0]) };
        } else {
          const tmp = new Date(progDateStr);
          if (!isNaN(tmp)) {
            pd = { day: tmp.getDate(), month: tmp.getMonth()+1, year: tmp.getFullYear() };
          }
        }
        if (!pd) return false;
        const match = pd.day === edDay && pd.month === edMonth && pd.year === edYear;
        if (match) console.log(`   ✓ "${progDateStr}" corresponde a ${effectiveDate}`);
        return match;
      });
      console.log(`  ✓ ${deliveriesWithProgramacao.length} registros após filtro de data`);
    }

    // começa a trabalhar com o array já filtrado (ou não)
    let filtered = deliveriesWithProgramacao;

    if (status && status !== "all") {
      console.log('  ✓ Aplicando filtro de status:', status);
      filtered = filtered.filter(d => {
        if (status === 'OPERACAO_FINALIZADA') return d.status === 'ENTREGUE' || d.status === 'submitted';
        if (status === 'A CAMINHO DO CLIENTE') return d.status === 'pending' || d.status === 'PENDING';
        return d.status === status;
      });
    }

    if (q && q.trim()) {
      const text = q.trim();
      console.log('  ✓ Aplicando filtro de busca:', text);
      filtered = filtered.filter(d => 
        (d.deliveryNumber || '').toLowerCase().includes(text.toLowerCase()) ||
        (d.vehiclePlate || '').toLowerCase().includes(text.toLowerCase()) ||
        (d.userName || '').toLowerCase().includes(text.toLowerCase()) ||
        (d.driverName || '').toLowerCase().includes(text.toLowerCase()) ||
        (d.recebedor || '').toLowerCase().includes(text.toLowerCase())
      );
    }

    // Consolida arquivos de ambas as pastas
    const uploadsPath1 = path.join(__dirname, "../uploads");
    const uploadsPath2 = path.join(__dirname, "../src/uploads");
    const cities = ['manaus', 'itajai'];

    const deliveriesWithFiles = filtered.map(delivery => {
      const consolidatedFiles = {};
      [uploadsPath1, uploadsPath2].forEach(uploadsPath => {
        const deliveryPath = path.join(uploadsPath, delivery.deliveryNumber);
        if (fs.existsSync(deliveryPath)) {
          try {
            const files = fs.readdirSync(deliveryPath);
            files.forEach(file => { consolidatedFiles[file] = true; });
          } catch (err) {
            console.error(`Erro ao listar arquivos em ${deliveryPath}:`, err);
          }
        }
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
        uploadedFiles: Object.keys(consolidatedFiles),
        hasFiles: Object.keys(consolidatedFiles).length > 0
      };
    });

    console.log(`📤 Retornando ${deliveriesWithFiles.length} entregas`);
    return res.json({ deliveries: deliveriesWithFiles });
  } catch (err) {
    console.error('❌ Erro em /admin/deliveries:', err);
    return res.status(500).json({ message: "Erro ao listar entregas (admin)", error: err.message });
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
    
    // DEBUG: retorna entrega completa com documents raw
    console.log(`[DEBUG] Entrega ${req.params.id} encontrada:`, JSON.stringify(delivery, null, 2));
    console.log(`[DEBUG] Documents raw:`, delivery.documents);
    console.log(`[DEBUG] Documents normalized:`, normalizeDeliveryForResponse(delivery).documents);
    
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
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[DOWNLOAD] 🔴 ROTA ATINGIDA! id=${id}, documentType=${documentType}`);
    console.log(`[DOWNLOAD] query params:`, req.query);
    console.log(`${'='.repeat(80)}\n`);

    // Busca entrega
    const db = await getDb(req);
    const delivery = await db.findById("deliveries", id);
    if (!delivery) {
      console.error(`[DOWNLOAD] Entrega não encontrada: ${id}`);
      return res.status(404).json({ message: "Entrega não encontrada" });
    }

    // Verifica se o tipo de documento é conhecido para esta entrega
    const docs = delivery.documents || {};
    console.log(`[DOWNLOAD] delivery id=${id} city=${delivery.city || 'N/A'}`);
    console.log(`[DOWNLOAD] Documentos na entrega (keys):`, Object.keys(docs));
    console.log(`[DOWNLOAD] Buscando tipo: "${documentType}", valor:`, docs[documentType]);

    // Normalize delivery first to ensure documents are properly parsed
    let docArray = [];
    const entry = docs[documentType];
    
    if (entry) {
      // Parse como o ZIP faz: se for string JSON, parse; se falhar, trata como caminho simples
      if (typeof entry === 'string') {
        try {
          docArray = JSON.parse(entry);
          console.log(`[DOWNLOAD] Tipo "${documentType}" parseado de JSON`);
        } catch (e) {
          console.warn(`[DOWNLOAD] Falha ao fazer parse de "${documentType}":`, e.message);
          docArray = [{ path: entry }]; // Trata como caminho plano
        }
      } else if (Array.isArray(entry)) {
        docArray = entry;
      } else if (typeof entry === 'object') {
        docArray = [entry];
      }
      
      // Garante que é array
      if (!Array.isArray(docArray)) {
        docArray = [docArray];
      }
    }
    
    console.log(`[DOWNLOAD] docArray após processamento:`, JSON.stringify(docArray));
    
    const idx = parseInt(req.query.index || '0', 10);
    console.log(`[DOWNLOAD] Tentando acessar índice ${idx} de um array de ${docArray.length} itens`);
    
    if (docArray.length === 0) {
      console.error(`[DOWNLOAD] docArray vazio para tipo "${documentType}"`);
      return res.status(404).json({ message: 'Nenhum documento encontrado para este tipo' });
    }
    
    if (isNaN(idx) || idx < 0 || idx >= docArray.length) {
      console.error(`[DOWNLOAD] Índice inválido: ${idx}, tamanho do array: ${docArray.length}`);
      return res.status(400).json({ message: 'Índice de documento inválido' });
    }
    
    const docInfo = docArray[idx];
    console.log(`[DOWNLOAD] Informações do documento [${idx}]:`, JSON.stringify(docInfo));

    // Se tem URL do R2, redireciona
    if (docInfo && docInfo.url) {
      console.log(`[DOWNLOAD] Documento encontrado em R2: ${docInfo.url}`);
      const filename = docInfo.name || (delivery.deliveryNumber + '_' + documentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.redirect(docInfo.url);
    }
    // Se tem caminho local, serve do disco
    else if (docInfo && docInfo.path) {
      console.log(`[DOWNLOAD] Documento encontrado localmente: ${docInfo.path}`);
      try {
        // Tenta em ambos os locais (como faz o ZIP)
        const uploadsPath1 = path.join(__dirname, "../uploads");
        const uploadsPath2 = path.join(__dirname, "../src/uploads");
        const city = delivery.city || 'manaus';

        // Normalize docInfo.path and try multiple sensible variants to avoid
        // issues when the stored path already includes the city or not.
        const rawRel = String(docInfo.path || '').replace(/^\/+/, '');
        const relVariants = new Set();
        relVariants.add(rawRel);
        // If starts with city/, also try without the leading city
        if (rawRel.startsWith(city + path.sep)) {
          relVariants.add(rawRel.slice(city.length + 1));
        } else {
          // Try with city prefix
          relVariants.add(path.join(city, rawRel));
        }
        // Also try basename only
        relVariants.add(path.basename(rawRel));

        let filePath = null;
        const tried = [];
        for (const uploadsPath of [uploadsPath1, uploadsPath2]) {
          for (const rel of relVariants) {
            const candidate = path.join(uploadsPath, rel);
            tried.push(candidate);
            if (fs.existsSync(candidate)) {
              filePath = candidate;
              break;
            }
          }
          if (filePath) break;
        }

        console.log(`[DOWNLOAD] Testadas rotas: ${tried.join(', ')}`);
        console.log(`[DOWNLOAD] Caminho resolvido: ${filePath}`);

        if (!filePath) {
          console.error(`[DOWNLOAD] Arquivo não existe em nenhum local: ${docInfo.path}`);
          // Retorna também os caminhos testados para ajudar a debugar remotamente (remover depois)
          return res.status(404).json({ message: 'Arquivo não encontrado no servidor', triedPaths: tried });
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
    // Se não tem path mas tem name, tentamos localizar pelo nome em locais prováveis
    else if (docInfo && !docInfo.path && docInfo.name) {
      console.log(`[DOWNLOAD] Documento sem path mas com name: ${docInfo.name} — tentando localizar por nome`);
      try {
        const uploadsPath1 = path.join(__dirname, "../uploads");
        const uploadsPath2 = path.join(__dirname, "../src/uploads");
        const city = delivery.city || 'manaus';
        const name = String(docInfo.name || '').replace(/^\/+/, '');

        const candidates = [];
        // Common locations
        candidates.push(path.join(uploadsPath1, delivery.deliveryNumber, name));
        candidates.push(path.join(uploadsPath1, city, delivery.deliveryNumber, name));
        candidates.push(path.join(uploadsPath1, city, name));
        candidates.push(path.join(uploadsPath1, name));
        candidates.push(path.join(uploadsPath2, delivery.deliveryNumber, name));
        candidates.push(path.join(uploadsPath2, city, delivery.deliveryNumber, name));
        candidates.push(path.join(uploadsPath2, city, name));
        candidates.push(path.join(uploadsPath2, name));

        // Also try basename-only across delivery folder
        const basename = path.basename(name);
        candidates.push(path.join(uploadsPath1, delivery.deliveryNumber, basename));
        candidates.push(path.join(uploadsPath1, city, delivery.deliveryNumber, basename));
        candidates.push(path.join(uploadsPath2, delivery.deliveryNumber, basename));

        let filePathFound = null;
        const tried = [];
        for (const candidate of candidates) {
          tried.push(candidate);
          if (fs.existsSync(candidate)) { filePathFound = candidate; break; }
        }

        console.log(`[DOWNLOAD] Tentativas por nome: ${tried.join(', ')}`);

        if (!filePathFound) {
          console.error(`[DOWNLOAD] Não foi possível localizar arquivo pelo name: ${docInfo.name}`);
          return res.status(404).json({ message: 'Arquivo não encontrado no servidor', docInfo, triedPaths: tried });
        }

        const stat = fs.statSync(filePathFound);
        const filename = docInfo.name || path.basename(filePathFound);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', stat.size);
        const readStream = fs.createReadStream(filePathFound);
        readStream.on('error', (err) => {
          console.error(`[DOWNLOAD] Erro ao ler arquivo:`, err.message);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Erro ao ler arquivo', error: err.message });
          }
        });
        console.log(`[DOWNLOAD] ✓ Iniciando stream do arquivo localizado por nome: ${filename}`);
        readStream.pipe(res);
      } catch (err) {
        console.error(`[DOWNLOAD] ✗ Erro ao localizar/servir arquivo por name:`, err && err.message ? err.message : err);
        return res.status(500).json({ message: 'Erro ao localizar arquivo por nome', error: err && err.message ? err.message : err, docInfo });
      }
    }
    // Documento sem ID, path ou name
    else {
      console.error(`[DOWNLOAD] Documento sem ID, path ou name:`, docInfo);
      return res.status(404).json({ message: 'Documento inválido: sem ID, path ou name', docInfo });
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

    // Lista de arquivos faltando
    let missing = [];
    let addedCount = 0;

    for (const item of filesToAdd) {
      const { doc, docType, idx } = item;
      let added = false;

      // Tenta R2 primeiro (se tem URL)
      if (doc.url) {
        try {
          console.log(`[ZIP] Tentando adicionar do R2: ${docType}[${idx}] (URL: ${doc.url})`);
          
          // Faz download da URL e adiciona ao ZIP
          const https = require('https');
          const http = require('http');
          const protocol = doc.url.startsWith('https') ? https : http;
          
          const filename = doc.name || `${docType}_${idx}`;
          
          await new Promise((resolve, reject) => {
            protocol.get(doc.url, (res) => {
              if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
              }
              archive.append(res, { name: path.join(delivery.deliveryNumber, filename) });
              addedCount++;
              added = true;
              console.log(`[ZIP] ✓ Adicionado do R2: ${filename}`);
              resolve();
            }).on('error', reject);
          });
        } catch (err) {
          console.error(`[ZIP] ✗ Falha do R2 para ${docType}[${idx}]:`, err.message);
          missing.push(`${docType}[${idx}] (R2: ${doc.url})`);
        }
      }

      // Tenta arquivo local (se tem path)
      if (!added && doc.path) {
          try {
            console.log(`[ZIP] Tentando adicionar arquivo local: ${docType}[${idx}] (${doc.path})`);

            const rawRel = String(doc.path || '').replace(/^\/+/, '');
            const relVariants = new Set();
            relVariants.add(rawRel);
            if (rawRel.startsWith(city + path.sep)) {
              relVariants.add(rawRel.slice(city.length + 1));
            } else {
              relVariants.add(path.join(city, rawRel));
            }
            relVariants.add(path.basename(rawRel));

            let filePath = null;
            for (const rel of relVariants) {
              const candidateCity = path.join(__dirname, '..', 'uploads', rel);
              if (fs.existsSync(candidateCity)) { filePath = candidateCity; break; }
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

      if (!added && !doc.url && !doc.path) {
        console.warn(`[ZIP] Documento sem URL nem path: ${docType}[${idx}]`, doc);
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
router.get("/users", auth, async (req, res) => {
  try {
    // Permitir que gerentes, admins e GeoMar visualizem a lista de usuários.
    const role = req.user?.role;
    if (!role || (role !== 'manager' && role !== 'admin' && role !== 'geomar')) {
      return res.status(403).json({ message: "Sem permissão" });
    }
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
router.post("/users", auth, managerOnly, async (req, res) => {
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
    const allDrivers = await db.find('drivers', {}) || [];
    const existing = allDrivers.find(d => 
      String(d.username || '').toLowerCase() === normalizedUsername || 
      String(d.email || '').toLowerCase() === normalizedEmail
    );
    if (existing) {
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
    console.error('❌ Erro ao criar usuário:', err.message || err);
    console.error('Stack:', err.stack);
    return res.status(500).json({ message: "Erro ao criar usuário", error: err.message });
  }
});

/**
 * PUT /api/admin/users/:id
 * Atualizar usuário
 */
router.put("/users/:id", auth, managerOnly, async (req, res) => {
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
router.delete("/users/:id", auth, managerOnly, async (req, res) => {
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
  const requiredHeaders = ['Processo','Recebedor','FORNECEDOR','Destinatário','Navio','Nr. vi','Nº container','NF','CNTR','Dt. Agendamento','Observação destino','CONTRATADO','PROCESSO2','PERFORMANCE','Ocorrencia'];
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
      // Map 'Recebedor' column to 'recebedor' field (case-insensitive)
      const recebedor = r['Recebedor'] || r['recebedor'] || r['RECEBEDOR'] || '';
      // Preserve 'Dt. Agendamento' exactly as in CSV
      const dtAgendamento = r['Dt. Agendamento'] || r['dt. agendamento'] || r['DT. AGENDAMENTO'] || '';
      const program = await db.create('programs', Object.assign({}, r, { recebedor, dataAgendamento: dtAgendamento, createdAt: new Date().toISOString(), createdBy: req.user.id }));
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

// Google Drive test endpoint - verifies if Google Drive integration is working
router.get('/gdrive/test', auth, onlyAdmin, async (req, res) => {
  try {
    console.log('[GDRIVE-TEST] Iniciando teste...');
    
    const { uploadFileToDrive } = require('../storage/gdrive');
    
    // Test file (1KB of random data)
    const testBuffer = Buffer.from('GDRIVE_TEST_' + Date.now() + '_' + Math.random().toString(36).substring(7));
    const testFilename = `TEST_GDRIVE_${Date.now()}.txt`;
    
    console.log('[GDRIVE-TEST] Tentando fazer upload de teste:', testFilename);
    
    const result = await uploadFileToDrive(testBuffer, testFilename, 'text/plain');
    
    console.log('[GDRIVE-TEST] ✓ Sucesso! Arquivo ID:', result.id);
    
    return res.json({ 
      success: true, 
      message: 'Google Drive está funcionando!',
      fileId: result.id,
      fileName: testFilename,
      webViewLink: result.webViewLink,
      folderId: process.env.GDRIVE_FOLDER_ID,
      note: 'Arquivo de teste foi criado no Google Drive. Você pode deletá-lo manualmente.'
    });
  } catch (err) {
    console.error('[GDRIVE-TEST] ✗ Erro:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Google Drive NÃO está funcionando',
      error: err.message,
      troubleshooting: [
        '1. Verifique se GOOGLE_CREDENTIALS_JSON está setado no Render',
        '2. Verifique se GOOGLE_TOKEN_JSON está setado no Render',
        '3. Verifique se GDRIVE_FOLDER_ID está setado no Render',
        '4. Acesse https://drive.google.com/drive/folders/YOUR_FOLDER_ID para confirmar que você tem acesso'
      ]
    });
  }
});

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

// ========================
// MOTORISTA ROUTES
// ========================

/**
 * GET /api/admin/motoristas
 * Listar todos os motoristas
 */
router.get("/motoristas", auth, managerOnly, async (req, res) => {
  try {
    const Motorista = require("../models/Motorista");
    let motoristas = [];
    try {
      motoristas = await Promise.race([
        Motorista.find().sort({ createdAt: -1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
    } catch (mongoErr) {
      console.warn('[MOTORISTA] MongoDB não disponível, retornando array vazio');
      motoristas = [];
    }
    return res.json({ motoristas });
  } catch (err) {
    console.error('[MOTORISTA] ❌ Erro ao listar:', err);
    console.error(err.stack);
    return res.status(500).json({ message: "Erro ao listar motoristas", error: err.message });
  }
});

/**
 * POST /api/admin/motoristas
 * Criar novo motorista
 */
router.post("/motoristas", auth, managerOnly, async (req, res) => {
  try {
    const {
      transportadora,
      nome,
      cpf,
      vinculo,
      rastreador,
      expCadastroMotorista,
      cavalo,
      rastreadorCavalo,
      expCadastroCavalo,
      carreta,
      rastreadorCarreta,
      expCadastroCarreta,
      telefone,
      observacoes
    } = req.body;

    console.log('[MOTORISTA] Recebido:', { transportadora, nome, cpf, vinculo, telefone });

    if (!transportadora || !nome || !cpf || !vinculo || !telefone) {
      return res.status(400).json({ message: "Preencha todos os campos obrigatórios" });
    }

    const Motorista = require("../models/Motorista");
    
    // Check if motorista already exists (same transportadora + cpf)
    const existing = await Motorista.findOne({ transportadora, cpf });
    if (existing) {
      return res.status(400).json({ message: "Motorista já existe para esta transportadora" });
    }

    const newMotorista = new Motorista({
      transportadora,
      nome,
      cpf,
      vinculo,
      rastreador: rastreador || '-',
      expCadastroMotorista: expCadastroMotorista || null,
      cavalo: cavalo || '',
      rastreadorCavalo: rastreadorCavalo || '',
      expCadastroCavalo: expCadastroCavalo || null,
      carreta: carreta || '',
      rastreadorCarreta: rastreadorCarreta || '',
      expCadastroCarreta: expCadastroCarreta || null,
      telefone,
      observacoes: observacoes || '',
      ativo: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const saved = await newMotorista.save();
    console.log('[MOTORISTA] ✅ Novo motorista criado:', { _id: saved._id, nome: saved.nome, cpf: saved.cpf });

    return res.status(201).json({
      success: true,
      message: "Motorista criado com sucesso",
      motorista: saved
    });
  } catch (err) {
    console.error('[MOTORISTA] ❌ Erro ao criar:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Motorista já existe para esta transportadora" });
    }
    return res.status(500).json({ message: "Erro ao criar motorista", error: err.message });
  }
});

/**
 * PUT /api/admin/motoristas/:id
 * Atualizar motorista
 */
router.put("/motoristas/:id", auth, managerOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      transportadora,
      nome,
      cpf,
      vinculo,
      rastreador,
      expCadastroMotorista,
      cavalo,
      rastreadorCavalo,
      expCadastroCavalo,
      carreta,
      rastreadorCarreta,
      expCadastroCarreta,
      telefone,
      observacoes,
      ativo
    } = req.body;

    console.log('[MOTORISTA] Atualizando:', { id, transportadora, nome, cpf });

    if (!transportadora || !nome || !cpf || !vinculo || !telefone) {
      return res.status(400).json({ message: "Preencha todos os campos obrigatórios" });
    }

    const Motorista = require("../models/Motorista");
    let motorista = null;
    try {
      motorista = await Promise.race([
        Motorista.findById(id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
    } catch (mongoErr) {
      console.warn('[MOTORISTA] MongoDB timeout ao buscar motorista');
      return res.status(500).json({ message: "Serviço temporariamente indisponível" });
    }
    if (!motorista) {
      return res.status(404).json({ message: "Motorista não encontrado" });
    }

    // Check if CPF is being changed and if new CPF already exists
    if (cpf !== motorista.cpf) {
      let existing = null;
      try {
        existing = await Promise.race([
          Motorista.findOne({ cpf, transportadora, _id: { $ne: id } }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
      } catch (mongoErr) {
        console.warn('[MOTORISTA] MongoDB timeout ao verificar CPF');
      }
      if (existing) {
        return res.status(400).json({ message: "CPF já existe para esta transportadora" });
      }
    }

    motorista.transportadora = transportadora;
    motorista.nome = nome;
    motorista.cpf = cpf;
    motorista.vinculo = vinculo;
    motorista.rastreador = rastreador || '-';
    motorista.expCadastroMotorista = expCadastroMotorista || null;
    motorista.cavalo = cavalo || '';
    motorista.rastreadorCavalo = rastreadorCavalo || '';
    motorista.expCadastroCavalo = expCadastroCavalo || null;
    motorista.carreta = carreta || '';
    motorista.rastreadorCarreta = rastreadorCarreta || '';
    motorista.expCadastroCarreta = expCadastroCarreta || null;
    motorista.telefone = telefone;
    motorista.observacoes = observacoes || '';
    if (ativo !== undefined) motorista.ativo = ativo;
    motorista.updatedAt = new Date();

    const updated = await motorista.save();
    console.log('[MOTORISTA] ✏️ Motorista atualizado:', { _id: updated._id, nome: updated.nome });

    return res.json({
      success: true,
      message: "Motorista atualizado com sucesso",
      motorista: updated
    });
  } catch (err) {
    console.error('[MOTORISTA] ❌ Erro ao atualizar:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "CPF já existe para esta transportadora" });
    }
    return res.status(500).json({ message: "Erro ao atualizar motorista", error: err.message });
  }
});

/**
 * DELETE /api/admin/motoristas/:id
 * Deletar motorista
 */
router.delete("/motoristas/:id", auth, managerOnly, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[MOTORISTA] Deletando:', id);

    const Motorista = require("../models/Motorista");
    const motorista = await Motorista.findById(id);
    if (!motorista) {
      return res.status(404).json({ message: "Motorista não encontrado" });
    }

    await Motorista.findByIdAndDelete(id);
    console.log('[MOTORISTA] 🗑️ Motorista deletado:', { _id: id, nome: motorista.nome });

    return res.json({
      success: true,
      message: "Motorista deletado com sucesso"
    });
  } catch (err) {
    console.error('[MOTORISTA] ❌ Erro ao deletar:', err);
    return res.status(500).json({ message: "Erro ao deletar motorista", error: err.message });
  }
});

/**
 * GET /api/admin/programacoes
 * Listar todas as programações de entrega
 */
router.get("/programacoes", auth, async (req, res) => {
  try {
    console.log('[PROGRAMACAO] Listando programações de entrega');

    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
    const programacoes = await ProgramacaoEntrega.find().sort({ dataAgendamento: -1 });

    // também trazemos entregas para permitir associação com motoristas
    const db = await getDb(req);
    const allDeliveries = await db.find("deliveries", {});

    // vincular id de entrega correspondente (se existir)
    const enriched = (programacoes || []).map(p => {
      const obj = p.toObject ? p.toObject() : { ...p };
      // se já temos um vínculo gravado, mantenha
      if (obj.linkedDeliveryId) {
        // também copie eventual lista de documentos pendentes se disponível
        if (obj.linkedDeliveryId && obj.missingDocumentsAtSubmit === undefined) {
          const existing = allDeliveries.find(d => String(d._id) === String(obj.linkedDeliveryId));
          if (existing) {
            obj.missingDocumentsAtSubmit = existing.missingDocumentsAtSubmit || [];
          }
        }
        return obj;
      }
      // senão tente descobrir pela comparação de números
      const match = allDeliveries.find(d => {
        const num = String(d.deliveryNumber || '').trim().toUpperCase();
        const proc = String(p.processo || '').trim().toUpperCase();
        const cont = String(p.container || '').trim().toUpperCase();
        return (num && (num === proc || num === cont));
      });
      obj.linkedDeliveryId = match ? match._id : null;
      if (match) {
        obj.missingDocumentsAtSubmit = match.missingDocumentsAtSubmit || [];
      }
      return obj;
    });

    console.log('[PROGRAMACAO] ✅ Encontradas', enriched.length, 'programações');

    return res.json({
      success: true,
      programacoes: enriched
    });
  } catch (err) {
    console.error('[PROGRAMACAO] ❌ Erro ao listar:', err);
    return res.status(500).json({ message: "Erro ao listar programações", error: err.message });
  }
});

/**
 * POST /api/admin/programacoes
 * Criar nova programação de entrega
 */
router.post("/programacoes", auth, managerOnly, async (req, res) => {
  try {
    const { processo, recebedor, container, dataAgendamento, contratado, motorista, status, observacoes } = req.body;

    console.log('[PROGRAMACAO] Criando:', { processo, recebedor, contratado });

    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");

    const novaProgramacao = new ProgramacaoEntrega({
      processo,
      recebedor,
      container,
      dataAgendamento,
      contratado,
      motorista,
      status,
      observacoes
    });

    await novaProgramacao.save();
    console.log('[PROGRAMACAO] ✅ Criada:', { _id: novaProgramacao._id, processo });

    return res.status(201).json({
      success: true,
      message: "Programação criada com sucesso",
      programacao: novaProgramacao
    });
  } catch (err) {
    console.error('[PROGRAMACAO] ❌ Erro ao criar:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({ message: "Esse processo já existe" });
    }
    
    return res.status(500).json({ message: "Erro ao criar programação", error: err.message });
  }
});

/**
 * PUT /api/admin/programacoes/:id
 * Atualizar programação de entrega
 */
router.put("/programacoes/:id", auth, managerOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { processo, recebedor, container, dataAgendamento, contratado, motorista, status, observacoes } = req.body;
    // Get editor name from logged-in user
    const editorName = req.user?.name || req.user?.username || req.user?._id || 'Desconhecido';

    console.log('[PROGRAMACAO] Atualizando:', id);

    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
    
    const programacao = await ProgramacaoEntrega.findById(id);
    if (!programacao) {
      return res.status(404).json({ message: "Programação não encontrada" });
    }

    // Atualizar apenas os campos fornecidos
    if (processo !== undefined) programacao.processo = processo;
    if (recebedor !== undefined) programacao.recebedor = recebedor;
    if (container !== undefined) programacao.container = container;
    if (dataAgendamento !== undefined) programacao.dataAgendamento = dataAgendamento;
    if (contratado !== undefined) programacao.contratado = contratado;
    if (motorista !== undefined) programacao.motorista = motorista;
    if (status !== undefined) programacao.status = status;
    if (observacoes !== undefined) programacao.observacoes = observacoes;
    // Register editor and time
    programacao.editedBy = editorName;
    programacao.editedAt = new Date();

    try {
      await programacao.save();
      console.log('[PROGRAMACAO] ✅ Atualizada:', { _id: id, processo: programacao.processo });
      return res.json({
        success: true,
        message: "Programação atualizada com sucesso",
        programacao
      });
    } catch (saveErr) {
      console.error('[PROGRAMACAO] ❌ Erro ao salvar atualização:', saveErr);
      if (saveErr.code === 11000) {
        return res.status(400).json({ message: "Esse processo já existe" });
      }
      return res.status(500).json({ message: "Erro ao salvar atualização", error: saveErr.message });
    }
  } catch (err) {
    console.error('[PROGRAMACAO] ❌ Erro ao atualizar:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({ message: "Esse processo já existe" });
    }
    
    return res.status(500).json({ message: "Erro ao atualizar programação", error: err.message });
  }
});

/**
 * DELETE /api/admin/programacoes/:id
 * Deletar programação de entrega
 */
router.delete("/programacoes/:id", auth, managerOnly, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[PROGRAMACAO] Deletando:', id);

    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
    const programacao = await ProgramacaoEntrega.findById(id);
    if (!programacao) {
      return res.status(404).json({ message: "Programação não encontrada" });
    }

    await ProgramacaoEntrega.findByIdAndDelete(id);
    console.log('[PROGRAMACAO] 🗑️ Programação deletada:', { _id: id, processo: programacao.processo });

    return res.json({
      success: true,
      message: "Programação deletada com sucesso"
    });
  } catch (err) {
    console.error('[PROGRAMACAO] ❌ Erro ao deletar:', err);
    return res.status(500).json({ message: "Erro ao deletar programação", error: err.message });
  }
});

/**
 * POST /api/admin/programacoes/import
 * Importar múltiplas programações em batch
 */
router.post("/programacoes/import", auth, managerOnly, async (req, res) => {
  try {
    const programacoes = req.body;

    if (!Array.isArray(programacoes)) {
      return res.status(400).json({ message: "Body deve ser um array de programações" });
    }

    if (programacoes.length === 0) {
      return res.status(400).json({ message: "Nenhuma programação para importar" });
    }

    console.log('[PROGRAMACAO] Importando', programacoes.length, 'programações em batch');

    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
    
    const resultados = [];
    let importados = 0;
    let erros = 0;

    for (const prog of programacoes) {
      try {
        const { processo, container, dataAgendamento, contratado, motorista, status, observacoes } = prog;
        // Case-insensitive recebedor field
        const recebedorField = prog.recebedor || prog.Recebedor || prog.RECEBEDOR || '';

        // Validar campos obrigatórios
        if (!processo || !recebedorField || !dataAgendamento || !contratado) {
          erros++;
          resultados.push({
            processo: processo || 'N/A',
            sucesso: false,
            erro: 'Campos obrigatórios faltando: processo, recebedor, dataAgendamento, contratado'
          });
          continue;
        }

        // Tenta criar a programação
        const novaProgramacao = new ProgramacaoEntrega({
          processo,
          recebedor: recebedorField,
          container: container || '',
          dataAgendamento,
          contratado,
          motorista: motorista || '',
          status: status || 'AGENDADO',
          observacoes: observacoes || ''
        });

        await novaProgramacao.save();
        importados++;
        resultados.push({
          processo,
          sucesso: true,
          _id: novaProgramacao._id
        });
      } catch (err) {
        erros++;
        resultados.push({
          processo: prog.processo || 'N/A',
          sucesso: false,
          erro: err.code === 11000 ? 'Processo já existe' : err.message
        });
      }
    }

    console.log('[PROGRAMACAO] ✅ Import concluído:', { importados, erros, total: programacoes.length });

    return res.json({
      success: true,
      message: `${importados} programação(ões) importada(s) com sucesso${erros > 0 ? `, ${erros} erro(s)` : ''}`,
      importados,
      erros,
      resultados: erros > 0 ? resultados : undefined
    });
  } catch (err) {
    console.error('[PROGRAMACAO] ❌ Erro ao importar:', err);

    return res.status(500).json({ message: "Erro ao importar programações", error: err.message });
  }
});

/**
 * GET /api/admin/programacoes/sync/ycompany
 * Sincronizar dados do Ycompany para Programação de Entregas
 * Mapeia: Processo←processo, RECEBEDOR←destinatario, CONTAINER←containerNumero, STATUS=AGENDADO
 */
router.get("/programacoes/sync/ycompany", auth, managerOnly, async (req, res) => {
  try {
    console.log('[SYNC YCOMPANY] Iniciando sincronização');

    const { connectIfNeeded } = require("../db/mongo");
    await connectIfNeeded();

    const Ycompany = require("../models/Ycompany");
    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");

    // Buscar todos os registros do Ycompany
    const ycompanyRecords = await Ycompany.find({}).lean();
    console.log(`[SYNC YCOMPANY] Encontrados ${ycompanyRecords.length} registros no Ycompany`);

    // Buscar todos os processos já existentes para evitar duplicação
    const existingProcessos = await ProgramacaoEntrega.find({}).select('processo').lean();
    const existingProcessosSet = new Set(existingProcessos.map(p => String(p.processo || '').trim().toUpperCase()));

    console.log(`[SYNC YCOMPANY] ${existingProcessosSet.size} processos já existentes`);

    // Mapear dados do Ycompany para Programação de Entregas
    const novosRegistros = ycompanyRecords
      .filter(y => {
        // Filtrar registros que já existem
        const processo = String(y.processo || '').trim().toUpperCase();
        return processo && !existingProcessosSet.has(processo);
      })
      .map(y => {
        // Converter data mantendo o horário original (sem timezone conversion)
        let dataAgendamento = '';
        if (y.dtAgendamentoDescarga) {
          const dtStr = String(y.dtAgendamentoDescarga).trim();
          // Se é string formato "YYYY-MM-DD HH:MM:SS", converter para "YYYY-MM-DDTHH:MM"
          if (dtStr.includes(' ')) {
            const parts = dtStr.split(' ');
            dataAgendamento = parts[0] + 'T' + parts[1].substring(0, 5);
          } else if (dtStr.includes('T')) {
            // Se já é ISO string, manter formato
            dataAgendamento = dtStr.substring(0, 16);
          } else if (dtStr.includes('-')) {
            // Se é só data, adicionar hora padrão
            dataAgendamento = dtStr.substring(0, 10) + 'T00:00';
          }
        }
        
        if (!dataAgendamento) {
          dataAgendamento = new Date().toISOString().slice(0, 16);
        }
        
        return {
          processo: String(y.processo || '').trim(),
          recebedor: String(y.destinatario || '').trim() || 'N/A',
          container: String(y.containerNumero || '').trim() || '',
          dataAgendamento: dataAgendamento,
          contratado: String(y.contratado || '').trim() || 'OUTRO',
          motorista: String(y.motorista || '').trim() || '',
          // Mapear situação do Ycompany para AGENDADO (como solicitado)
          status: 'AGENDADO',
          observacoes: `Sincronizado do Ycompany - ${y.situacao || 'N/A'}`
        };
      });

    console.log(`[SYNC YCOMPANY] ${novosRegistros.length} novos registros para importar (sem duplicação)`);

    if (novosRegistros.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhum registro novo para sincronizar',
        sincronizados: 0,
        duplicados: ycompanyRecords.length,
        total: ycompanyRecords.length
      });
    }

    // Inserir novos registros
    const inserted = await ProgramacaoEntrega.insertMany(novosRegistros, { ordered: false });
    console.log(`[SYNC YCOMPANY] ✅ ${inserted.length} registros sincronizados com sucesso`);

    return res.json({
      success: true,
      message: `${inserted.length} registro(s) sincronizado(s) com sucesso do Ycompany`,
      sincronizados: inserted.length,
      duplicados: ycompanyRecords.length - novosRegistros.length,
      total: ycompanyRecords.length,
      registros: inserted
    });
  } catch (err) {
    console.error('[SYNC YCOMPANY] ❌ Erro ao sincronizar:', err);
    return res.status(500).json({ 
      success: false,
      message: "Erro ao sincronizar dados do Ycompany", 
      error: err.message 
    });
  }
});

module.exports = router;
