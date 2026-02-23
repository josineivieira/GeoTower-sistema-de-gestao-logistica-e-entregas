const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mockdb = require('../mockdb');
const auth = require('../middleware/auth');

const router = express.Router();

// Helper to normalize db interface (sync mockdb or async mongo adapter)
async function getDb(req) {
  const db = req.mockdb;
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

// Config multer para upload
const upload = multer({ storage: multer.memoryStorage() });

// Middleware para verificar admin
function onlyAdmin(req, res, next) {
  const role = req.user?.role || 'operacao';
  // Aceita tanto 'gestor' quanto 'manager' como sinônimos de Gerente
  if (role !== 'admin' && role !== 'gestor' && role !== 'manager') {
    return res.status(403).json({ message: 'Sem permissão' });
  }
  next();
}

// Parseia CSV simples (sem dependências externas)
function parseCSV(buffer) {
  const text = buffer.toString('utf-8');
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) throw new Error('Arquivo vazio ou inválido');
  
  // Headers na primeira linha
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const deliveryNumberIdx = headers.findIndex(h => h.includes('numero') || h.includes('number') || h.includes('entrega'));
  const statusIdx = headers.findIndex(h => h.includes('status'));
  
  if (deliveryNumberIdx === -1 || statusIdx === -1) {
    throw new Error('Arquivo deve ter colunas: Número (ou número entrega) e Status');
  }
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim());
    if (cells[deliveryNumberIdx] && cells[statusIdx]) {
      rows.push({
        deliveryNumber: cells[deliveryNumberIdx].toUpperCase(),
        status: cells[statusIdx].toLowerCase()
      });
    }
  }
  
  return rows;
}

/**
 * POST /api/admin/reconciliation/upload
 * Upload e compara dados de uma planilha com entregas existentes
 */
router.post('/upload', auth, onlyAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Arquivo não fornecido' });
    }

    console.log('📤 Upload de reconciliação recebido:', req.file.originalname);

    // Parseia arquivo
    let uploadedData;
    try {
      uploadedData = parseCSV(req.file.buffer);
    } catch (parseErr) {
      return res.status(400).json({ message: 'Erro ao parsear arquivo: ' + parseErr.message });
    }

    console.log('✓ Arquivo parseado:', uploadedData.length, 'linhas');

    // Busca todas as entregas no sistema (usando DB da cidade selecionada)
    const db = await getDb(req);
    const systemDeliveries = await db.find('deliveries', {});

    // Comparação
    const results = {
      found: [],      // Encontradas no sistema
      notFound: [],   // Não encontradas
      statusDiff: [],   // Status diferente
      totalUploaded: uploadedData.length,
      totalSystem: (systemDeliveries || []).length
    };

    uploadedData.forEach(uploaded => {
      const system = (systemDeliveries || []).find(d => d.deliveryNumber === uploaded.deliveryNumber);
      
      if (!system) {
        results.notFound.push({
          deliveryNumber: uploaded.deliveryNumber,
          uploadedStatus: uploaded.status,
          action: 'NOT_FOUND'
        });
      } else {
        // Mapeia status: "entregue"/"delivered" → "submitted", "pendente"/"pending" → "pending"
        const normalizedUploadedStatus = 
          uploaded.status.includes('entregue') || uploaded.status.includes('delivered') ? 'submitted' :
          uploaded.status.includes('pendente') || uploaded.status.includes('pending') ? 'pending' : uploaded.status;

        if (system.status !== normalizedUploadedStatus) {
          results.statusDiff.push({
            deliveryNumber: uploaded.deliveryNumber,
            systemStatus: system.status,
            uploadedStatus: uploaded.status,
            normalizedStatus: normalizedUploadedStatus,
            action: 'UPDATE',
            userName: system.userName,
            driverName: system.driverName
          });
        } else {
          results.found.push({
            deliveryNumber: uploaded.deliveryNumber,
            status: system.status,
            action: 'OK'
          });
        }
      }
    });
    console.log('📊 Resultados:', { 
      found: results.found.length, 
      notFound: results.notFound.length, 
      statusDiff: results.statusDiff.length 
    });

    // Armazena na sessão (ou arquivo temporário) para aplicação posterior
    req.session = req.session || {};
    req.session.lastReconciliation = results;

    return res.json({
      success: true,
      message: 'Reconciliação realizada com sucesso',
      results
    });
  } catch (err) {
    console.error('Erro reconciliação:', err);
    return res.status(500).json({ message: 'Erro ao processar arquivo', error: err.message });
  }
});

/**
 * POST /api/admin/reconciliation/apply
 * Aplica as mudanças de status identificadas
 */
router.post('/apply', auth, onlyAdmin, async (req, res) => {
  try {
    const { updates } = req.body; // Array de { deliveryNumber, newStatus }

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ message: 'Updates array requerido' });
    }

    console.log('🔄 Aplicando', updates.length, 'atualizações de status');

    const results = [];
    const db = await getDb(req);
    for (const update of updates) {
      const delivery = await db.findOne('deliveries', { deliveryNumber: update.deliveryNumber });
      if (delivery) {
        const updated = await db.updateOne('deliveries', { _id: delivery._id }, {
          status: update.newStatus,
          reconciliationAppliedAt: new Date().toISOString(),
          reconciliationNote: 'Status atualizado via reconciliação de planilha'
        });
        results.push({
          deliveryNumber: update.deliveryNumber,
          success: !!updated,
          oldStatus: delivery.status,
          newStatus: update.newStatus
        });
        console.log(`  ✓ ${update.deliveryNumber}: ${delivery.status} → ${update.newStatus}`);
      } else {
        results.push({
          deliveryNumber: update.deliveryNumber,
          success: false,
          error: 'Entrega não encontrada'
        });
      }
    }

    return res.json({
      success: true,
      message: `${updates.length} entregas atualizadas`,
      results
    });
  } catch (err) {
    console.error('Erro ao aplicar atualizações:', err);
    return res.status(500).json({ message: 'Erro ao aplicar mudanças', error: err.message });
  }
});

module.exports = router;
