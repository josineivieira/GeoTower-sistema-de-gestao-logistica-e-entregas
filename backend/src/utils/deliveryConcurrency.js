// Utilitários para gerenciar concorrência e validação de status de deliveries
// Previne race conditions e sobrescrita de dados

const mongoose = require('mongoose');

// Ordem de status - status nunca pode regredir para um nível inferior
const STATUS_ORDER = {
  'pending': 0,
  'AGENDADO': 1,
  'CONTAINER_MONTADO': 2,
  'A_CAMINHO_DO_CLIENTE': 3,
  'AGUARDANDO_DESOVA': 4,
  'EM_DESOVA': 5,
  'AGUARDANDO_ANEXO': 6,
  'ANEXANDO_DOCUMENTOS_FINAIS': 7,
  'ENTREGUE': 8,
  'ENTREGUE_COM_PENDENCIA_CANHOTO': 8, // Mesmo nível que ENTREGUE
  'FINALIZADO': 9,
  'CANCELADO': 10 // Cancelado pode ser aplicado a qualquer status
};

/**
 * Valida se um status pode ser atualizado para outro
 * @param {string} currentStatus - Status atual
 * @param {string} newStatus - Novo status desejado
 * @returns {boolean} - True se a transição é permitida
 */
function canUpdateStatus(currentStatus, newStatus) {
  // Cancelado pode ser aplicado a qualquer status
  if (newStatus === 'CANCELADO') return true;

  // Status atual não pode ser inferior ao novo (exceto cancelado)
  const currentLevel = STATUS_ORDER[currentStatus] || 0;
  const newLevel = STATUS_ORDER[newStatus] || 0;

  return newLevel >= currentLevel;
}

/**
 * Atualiza uma delivery de forma atômica usando updateOne
 * @param {string} deliveryId - ID da delivery
 * @param {object} updates - Campos a atualizar
 * @param {object} options - Opções adicionais (condition, etc.)
 * @returns {object} - Resultado da operação
 */
async function updateDeliveryAtomic(deliveryId, updates, options = {}) {
  try {
    const Delivery = mongoose.model('Delivery');

    // Sempre atualizar updatedAt
    updates.updatedAt = new Date();

    // Construir query de atualização
    const updateQuery = {};

    // Usar $set para campos diretos
    if (Object.keys(updates).length > 0) {
      updateQuery.$set = updates;
    }

    // Adicionar condições se especificadas
    const filter = { _id: deliveryId, ...options.condition };

    // Usar findOneAndUpdate para atomicidade e retorno do documento atualizado
    const result = await Delivery.findOneAndUpdate(
      filter,
      updateQuery,
      {
        new: true, // Retorna o documento atualizado
        runValidators: true, // Executa validações do schema
        ...options
      }
    );

    if (!result) {
      throw new Error('Delivery não encontrada ou condição não atendida');
    }

    return result;
  } catch (error) {
    console.error('Erro ao atualizar delivery atomicamente:', error);
    throw error;
  }
}

/**
 * Atualiza status de delivery com validação de ordem
 * @param {string} deliveryId - ID da delivery
 * @param {string} newStatus - Novo status
 * @param {object} additionalUpdates - Outros campos a atualizar
 * @returns {object} - Delivery atualizada
 */
async function updateDeliveryStatus(deliveryId, newStatus, additionalUpdates = {}) {
  try {
    const Delivery = mongoose.model('Delivery');

    // Buscar status atual
    const currentDelivery = await Delivery.findById(deliveryId).select('status');
    if (!currentDelivery) {
      throw new Error('Delivery não encontrada');
    }

    // Validar se a transição é permitida
    if (!canUpdateStatus(currentDelivery.status, newStatus)) {
      throw new Error(`Transição de status não permitida: ${currentDelivery.status} -> ${newStatus}`);
    }

    // Preparar updates
    const updates = {
      status: newStatus,
      ...additionalUpdates
    };

    // Atualizar atomicamente
    return await updateDeliveryAtomic(deliveryId, updates);
  } catch (error) {
    console.error('Erro ao atualizar status da delivery:', error);
    throw error;
  }
}

/**
 * Adiciona documento a uma delivery de forma atômica
 * @param {string} deliveryId - ID da delivery
 * @param {string} documentType - Tipo do documento
 * @param {object} documentData - Dados do documento
 * @returns {object} - Delivery atualizada
 */
async function addDocumentToDelivery(deliveryId, documentType, documentData) {
  try {
    const Delivery = mongoose.model('Delivery');

    // Usar $push para adicionar ao array de documentos
    const updateQuery = {
      $push: {
        [`documents.${documentType}`]: documentData
      },
      $unset: {
        [`documents.${documentType}.$`]: null // Remove null se existir
      }
    };

    return await updateDeliveryAtomic(deliveryId, {}, { updateQuery });
  } catch (error) {
    console.error('Erro ao adicionar documento:', error);
    throw error;
  }
}

/**
 * Atualiza campo específico de uma delivery
 * @param {string} deliveryId - ID da delivery
 * @param {string} field - Campo a atualizar
 * @param {any} value - Novo valor
 * @returns {object} - Delivery atualizada
 */
async function updateDeliveryField(deliveryId, field, value) {
  try {
    const updates = {};
    updates[field] = value;
    return await updateDeliveryAtomic(deliveryId, updates);
  } catch (error) {
    console.error(`Erro ao atualizar campo ${field}:`, error);
    throw error;
  }
}

module.exports = {
  STATUS_ORDER,
  canUpdateStatus,
  updateDeliveryAtomic,
  updateDeliveryStatus,
  addDocumentToDelivery,
  updateDeliveryField
};