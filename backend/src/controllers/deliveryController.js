const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const fs = require('fs');
const path = require('path');
const { updateDeliveryAtomic, updateDeliveryStatus, addDocumentToDelivery } = require('../utils/deliveryConcurrency');

function getDocsForCity(city = 'manaus') {
  city = String(city || 'manaus').toLowerCase();
  // Itajaí: não bloqueia submissão por conta de docs, mas ainda registra pendências
  return ['canhotNF', 'canhotCTE', 'diarioBordo', 'devolucaoVazio', 'retiradaCheio'];
} 

// Create a new delivery
exports.createDelivery = async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { deliveryNumber, vehiclePlate, observations, containerMontadoAt } = req.body;
    const driverId = req.user.id;

    // Check if delivery number already exists for this driver
    const existingDelivery = await Delivery.findOne({ 
      deliveryNumber, 
      driverId,
      cityCode: city,
      status: { $in: ['draft', 'submitted'] }
    });

    if (existingDelivery) {
      return res.status(400).json({ 
        success: false, 
        message: 'Número de entrega já existe'
      });
    }

    const driver = await Driver.findById(driverId);

    const delivery = new Delivery({
      deliveryNumber,
      driverId,
      driverName: driver.name,
      vehiclePlate,
      observations,
      containerMontadoAt: containerMontadoAt ? new Date(containerMontadoAt) : null,
      cityCode: city,
      status: 'draft'
    });

    // Para criação, ainda usamos save() pois é um documento novo
    await delivery.save();

    res.status(201).json({
      success: true,
      message: 'Entrega criada com sucesso',
      delivery
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Get deliveries for current driver
exports.getMyDeliveries = async (req, res) => {
  try {
    const driverId = req.user.id;
    const city = req.city || 'manaus';
    const { status, searchTerm } = req.query;

    let query = { driverId, cityCode: city };
    
    if (status) {
      query.status = status;
    }

    if (searchTerm) {
      query.deliveryNumber = { $regex: searchTerm, $options: 'i' };
    }

    const deliveries = await Delivery.find(query).sort({ createdAt: -1 });

    res.json({ success: true, deliveries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Get delivery by ID
exports.getDeliveryById = async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;

    // Validar se é um ID MongoDB válido
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Entrega não encontrada' });
    }

    // Check if driver owns this delivery
    if (delivery.driverId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }
    
    // Check city
    if (delivery.cityCode !== city) {
      return res.status(403).json({ success: false, message: 'Acesso negado - dados de outra cidade' });
    }

    res.json({ success: true, delivery });
  } catch (error) {
    console.error('Erro ao buscar entrega:', error);
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Update delivery document
exports.updateDeliveryDocument = async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id, documentType } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Arquivo não enviado' });
    }

    // Validar se é um ID MongoDB válido
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Entrega não encontrada' });
    }

    // Check if driver owns this delivery
    if (delivery.driverId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }
    
    // Check city
    if (delivery.cityCode !== city) {
      return res.status(403).json({ success: false, message: 'Acesso negado - dados de outra cidade' });
    }

    // Check if delivery is submitted
    if (delivery.status === 'submitted') {
      return res.status(400).json({ success: false, message: 'Entrega já foi enviada' });
    }

    const validDocuments = getDocsForCity(city);
    if (!validDocuments.includes(documentType)) {
      return res.status(400).json({ success: false, message: 'Tipo de documento inválido para esta cidade' });
    }

    // Inicializar documents se não existir
    if (!delivery.documents) {
      delivery.documents = {};
    }

    // Move o arquivo para a pasta do container (padronizar comportamento com mock)
    const containerFolder = delivery.deliveryNumber || 'unknown';
    const containerDir = path.join(__dirname, '..', 'uploads', city, containerFolder);
    fs.mkdirSync(containerDir, { recursive: true });

    const originalExt = path.extname(req.file.originalname) || '.jpg';
    const finalFilename = `${documentType}_${Date.now()}${originalExt}`;
    const finalPath = path.join(containerDir, finalFilename);

    fs.renameSync(req.file.path, finalPath);

    // Salva caminho relativo (container/filename)
    const relativePath = path.join(containerFolder, finalFilename).replace(/\\/g, '/');

    // Preparar updates atômicos
    const updates = {
      [`documents.${documentType}`]: relativePath
    };

    // Remover documentType de missingDocumentsAtSubmit se estava lá
    if (delivery.missingDocumentsAtSubmit && Array.isArray(delivery.missingDocumentsAtSubmit)) {
      updates.missingDocumentsAtSubmit = delivery.missingDocumentsAtSubmit.filter(d => d !== documentType);
      console.log(`[UPLOAD] Removendo "${documentType}" de missingDocumentsAtSubmit. Pendências restantes:`, updates.missingDocumentsAtSubmit);
      
      // Também limpar o log de correção para este documento específico
      let newCorrectionLog = delivery.documentCorrectionLog || [];
      if (Array.isArray(newCorrectionLog)) {
        newCorrectionLog = newCorrectionLog.filter(log => log.documentType !== documentType);
        updates.documentCorrectionLog = newCorrectionLog;
        console.log(`[UPLOAD] Limpando log de correção para "${documentType}". Logs restantes:`, newCorrectionLog.length);
      }
    }

    // Atualizar atomicamente
    const updatedDelivery = await updateDeliveryAtomic(delivery._id, updates);

    res.json({
      success: true,
      message: 'Documento anexado com sucesso',
      delivery: updatedDelivery
    });
  } catch (error) {
    console.error('Erro ao atualizar documento:', error);
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Submit delivery (check all documents are attached)
exports.submitDelivery = async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;

    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Entrega não encontrada' });
    }

    // Check if driver owns this delivery
    if (delivery.driverId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }
    
    // Check city
    if (delivery.cityCode !== city) {
      return res.status(403).json({ success: false, message: 'Acesso negado - dados de outra cidade' });
    }

    // Check if already submitted
    if (delivery.status === 'submitted') {
      return res.status(400).json({ success: false, message: 'Entrega já foi enviada' });
    }

    // Check all documents are attached (city-specific)
    const requiredDocs = getDocsForCity(city);
    const missingDocs = requiredDocs.filter(doc => !delivery.documents || !delivery.documents[doc]);

    console.log('📩 submitDelivery received', { id, driverId: req.user.id, requiredDocs, missingDocs, body: req.body });

    // If there are missing docs, require force + observation
    const { force, observation } = req.body || {};

    // Preparar updates para submissão
    const submissionUpdates = {
      submittedAt: new Date()
    };

    if (missingDocs.length > 0) {
      if (city !== 'itajai') {
        if (!force) {
          return res.status(400).json({
            success: false,
            message: 'Documentos obrigatórios faltando: ' + missingDocs.join(', ')
          });
        }

        if (!observation || !String(observation || '').trim()) {
          return res.status(400).json({ success: false, message: 'Observação obrigatória para finalizar com documentos faltando' });
        }
      }

      submissionUpdates.submissionObservation = observation ? String(observation).trim() : '';
      submissionUpdates.submissionForce = true;
      submissionUpdates.missingDocumentsAtSubmit = missingDocs;
      submissionUpdates.pendenciaResponsavel = 'geolog';
      submissionUpdates.pendenciaStatus = 'AGUARDANDO_GEOLOG';
      submissionUpdates.pendenciaHistorico = [
        {
          from: 'motorista',
          to: 'geolog',
          by: req.user?.name || req.user?.username || req.user?.email || 'motorista',
          role: req.user?.role || 'driver',
          message: observation || 'Documentos obrigatorios nao anexados',
          action: 'pendencia_criada',
          createdAt: new Date()
        }
      ];
    } else {
      // Limpar possível pendência anterior
      submissionUpdates.missingDocumentsAtSubmit = [];
      submissionUpdates.submissionForce = false;
      submissionUpdates.submissionObservation = '';
      submissionUpdates.pendenciaStatus = 'RESOLVIDA';
    }

    // Atualizar status atomicamente com validação
    const updatedDelivery = await updateDeliveryStatus(delivery._id, 'submitted', submissionUpdates);

    res.json({
      success: true,
      message: 'Entrega enviada com sucesso',
      delivery: updatedDelivery
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Delete delivery (only if draft)
exports.deleteDelivery = async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;

    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Entrega não encontrada' });
    }

    // Check if driver owns this delivery
    if (delivery.driverId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }
    
    // Check city
    if (delivery.cityCode !== city) {
      return res.status(403).json({ success: false, message: 'Acesso negado - dados de outra cidade' });
    }

    // Only allow deletion of draft deliveries
    if (delivery.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Apenas entregas em rascunho podem ser deletadas' });
    }

    await Delivery.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Entrega deletada com sucesso'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};
