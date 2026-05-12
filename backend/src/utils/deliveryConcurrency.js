// Utilitários para gerenciar concorrência e validação de status de deliveries
// Previne race conditions e sobrescrita de dados

const mongoose = require('mongoose');

// Ordem de status - status nunca pode regredir para um nível inferior
const STATUS_ORDER = {
  'pending': 0,
  'AGENDADO': 1,
  'NO_PORTO_AGUARDANDO_MONTAGEM': 2,
  'CONTAINER_MONTADO': 3,
  'A_CAMINHO_DO_CLIENTE': 4,
  'AGUARDANDO_DESOVA': 5,
  'EM_DESOVA': 6,
  'DESOVA_FINALIZADA': 7,
  'AGUARDANDO_ANEXO': 8,
  'ANEXANDO_DOCUMENTOS_FINAIS': 9,
  'SAINDO_CLIENTE': 10,
  'RETORNANDO_PORTO': 11,
  'CHEGOU_PORTO': 12,
  'ENTREGUE': 13,
  'ENTREGUE_COM_PENDENCIA_CANHOTO': 13, // Mesmo nivel que ENTREGUE
  'FINALIZADO': 14,
  'CANCELADO': 15 // Cancelado pode ser aplicado a qualquer status
};

/**
 * Mapa de campos que devem ser limpos quando retrocede de um status
 * Usado para garantir integridade de dados ao retroceder
 */
const FIELDS_TO_CLEAR_ON_REGRESSION = {
  'AGENDADO': [],
  'NO_PORTO_AGUARDANDO_MONTAGEM': ['chegadaMontagemAt'],
  'CONTAINER_MONTADO': ['containerMontadoAt'],
  'A_CAMINHO_DO_CLIENTE': ['containerMontadoAt'],
  'AGUARDANDO_DESOVA': ['arrivedAt', 'horarioChegada'],
  'EM_DESOVA': ['arrivedAt', 'horarioChegada', 'horarioInicioDesova', 'desovaStartAt', 'desovaStartedAt'],
  'DESOVA_FINALIZADA': ['arrivedAt', 'horarioChegada', 'horarioInicioDesova', 'desovaStartAt', 'desovaStartedAt', 'horarioFimDesova', 'desovaEndAt', 'desovaEndedAt'],
  'AGUARDANDO_ANEXO': ['arrivedAt', 'horarioChegada', 'horarioInicioDesova', 'desovaStartAt', 'desovaStartedAt', 'horarioFimDesova', 'desovaEndAt', 'desovaEndedAt'],
  'ANEXANDO_DOCUMENTOS_FINAIS': ['arrivedAt', 'horarioChegada', 'horarioInicioDesova', 'desovaStartAt', 'desovaStartedAt', 'horarioFimDesova', 'desovaEndAt', 'desovaEndedAt', 'docsStartedAt'],
  'SAINDO_CLIENTE': ['arrivedAt', 'horarioChegada', 'horarioInicioDesova', 'desovaStartAt', 'desovaStartedAt', 'horarioFimDesova', 'desovaEndAt', 'desovaEndedAt', 'docsStartedAt', 'documentosFinaisAt', 'saidaClienteAt'],
  'RETORNANDO_PORTO': ['arrivedAt', 'horarioChegada', 'horarioInicioDesova', 'desovaStartAt', 'desovaStartedAt', 'horarioFimDesova', 'desovaEndAt', 'desovaEndedAt', 'docsStartedAt', 'documentosFinaisAt', 'saidaClienteAt'],
  'CHEGOU_PORTO': ['arrivedAt', 'horarioChegada', 'horarioInicioDesova', 'desovaStartAt', 'desovaStartedAt', 'horarioFimDesova', 'desovaEndAt', 'desovaEndedAt', 'docsStartedAt', 'documentosFinaisAt', 'saidaClienteAt', 'chegadaPortoAt'],
  'ENTREGUE': ['arrivedAt', 'horarioChegada', 'horarioInicioDesova', 'desovaStartAt', 'desovaStartedAt', 'horarioFimDesova', 'desovaEndAt', 'desovaEndedAt', 'docsStartedAt', 'documentosFinaisAt', 'saidaClienteAt', 'chegadaPortoAt', 'horarioDevolucaoVazio'],
  'ENTREGUE_COM_PENDENCIA_CANHOTO': ['arrivedAt', 'horarioChegada', 'horarioInicioDesova', 'desovaStartAt', 'desovaStartedAt', 'horarioFimDesova', 'desovaEndAt', 'desovaEndedAt', 'docsStartedAt', 'documentosFinaisAt', 'saidaClienteAt', 'chegadaPortoAt', 'horarioDevolucaoVazio'],
  'FINALIZADO': ['arrivedAt', 'horarioChegada', 'horarioInicioDesova', 'desovaStartAt', 'desovaStartedAt', 'horarioFimDesova', 'desovaEndAt', 'desovaEndedAt', 'docsStartedAt', 'documentosFinaisAt', 'saidaClienteAt', 'chegadaPortoAt', 'horarioDevolucaoVazio']
};

/**
 * Mapa de documentos que devem ser limpos quando retrocede de um status
 * Usado para remover documentos de etapas posteriores ao retroceder
 */
const DOCUMENTS_TO_CLEAR_ON_REGRESSION = {
  'AGENDADO': [],
  'NO_PORTO_AGUARDANDO_MONTAGEM': ['chegadaMontagem'],
  'CONTAINER_MONTADO': [],
  'A_CAMINHO_DO_CLIENTE': [],
  'AGUARDANDO_DESOVA': ['chegadaCliente'],
  'EM_DESOVA': ['chegadaCliente', 'inicioDesova'],
  'DESOVA_FINALIZADA': ['chegadaCliente', 'inicioDesova', 'fimDesova'],
  'AGUARDANDO_ANEXO': ['chegadaCliente', 'inicioDesova', 'fimDesova'],
  'ANEXANDO_DOCUMENTOS_FINAIS': ['chegadaCliente', 'inicioDesova', 'fimDesova'],
  'SAINDO_CLIENTE': ['chegadaCliente', 'inicioDesova', 'fimDesova', 'cnhotoNF', 'cnhotoCTE', 'diarioBordo', 'saidaCliente'],
  'RETORNANDO_PORTO': ['chegadaCliente', 'inicioDesova', 'fimDesova', 'cnhotoNF', 'cnhotoCTE', 'diarioBordo', 'saidaCliente'],
  'CHEGOU_PORTO': ['chegadaCliente', 'inicioDesova', 'fimDesova', 'cnhotoNF', 'cnhotoCTE', 'diarioBordo', 'saidaCliente', 'chegadaPorto'],
  'ENTREGUE': ['chegadaCliente', 'inicioDesova', 'fimDesova', 'cnhotoNF', 'cnhotoCTE', 'diarioBordo', 'saidaCliente', 'chegadaPorto'],
  'ENTREGUE_COM_PENDENCIA_CANHOTO': ['chegadaCliente', 'inicioDesova', 'fimDesova', 'cnhotoNF', 'cnhotoCTE', 'diarioBordo', 'saidaCliente', 'chegadaPorto'],
  'FINALIZADO': ['chegadaCliente', 'inicioDesova', 'fimDesova', 'cnhotoNF', 'cnhotoCTE', 'diarioBordo', 'saidaCliente', 'chegadaPorto', 'devolucaoVazio']
};

/**
 * Valida se um status pode ser atualizado para outro
 * Permite ADM/GERENTE fazer retrocesso de qualquer nível
 * @param {string} currentStatus - Status atual
 * @param {string} newStatus - Novo status desejado
 * @param {boolean} isAdminOrManager - Se é ADM ou GERENTE
 * @returns {boolean} - True se a transição é permitida
 */
function canUpdateStatus(currentStatus, newStatus, isAdminOrManager = false) {
  // Cancelado pode ser aplicado a qualquer status
  if (newStatus === 'CANCELADO') return true;

  // Status atual não pode ser inferior ao novo (exceto cancelado)
  const currentLevel = STATUS_ORDER[currentStatus] || 0;
  const newLevel = STATUS_ORDER[newStatus] || 0;

  // ADM/GERENTE pode fazer retrocesso; usuários normais só podem avançar
  if (newLevel < currentLevel) {
    return isAdminOrManager;
  }

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
 * Limpa campos automaticamente ao fazer retrocesso
 * @param {string} deliveryId - ID da delivery
 * @param {string} newStatus - Novo status
 * @param {object} additionalUpdates - Outros campos a atualizar
 * @param {boolean} isAdminOrManager - Se é ADM ou GERENTE (para permitir retrocesso)
 * @returns {object} - Delivery atualizada
 */
async function updateDeliveryStatus(deliveryId, newStatus, additionalUpdates = {}, isAdminOrManager = false) {
  try {
    const Delivery = mongoose.model('Delivery');

    // Buscar status atual
    const currentDelivery = await Delivery.findById(deliveryId).select('status');
    if (!currentDelivery) {
      throw new Error('Delivery não encontrada');
    }

    // Validar se a transição é permitida
    if (!canUpdateStatus(currentDelivery.status, newStatus, isAdminOrManager)) {
      throw new Error(`Transição de status não permitida: ${currentDelivery.status} -> ${newStatus}`);
    }

    // Preparar updates
    const updates = {
      status: newStatus,
      ...additionalUpdates
    };

    // Se estão fazendo retrocesso, limpar campos posteriores
    const currentLevel = STATUS_ORDER[currentDelivery.status] || 0;
    const newLevel = STATUS_ORDER[newStatus] || 0;
    
    if (newLevel < currentLevel) {
      // Retrocesso detectado - limpar campos do status anterior
      const fieldsToClear = FIELDS_TO_CLEAR_ON_REGRESSION[currentDelivery.status] || [];
      fieldsToClear.forEach(field => {
        updates[field] = null;
      });
      
      // Limpar documentos de etapas posteriores
      const documentsToClear = DOCUMENTS_TO_CLEAR_ON_REGRESSION[currentDelivery.status] || [];
      documentsToClear.forEach(docType => {
        updates[`documents.${docType}`] = null;
      });
    }

    // Se é CANCELADO, marcar como cancelado com soft delete
    if (newStatus === 'CANCELADO') {
      updates.canceledAt = new Date();
      updates.isCanceled = true;
      
      // Tentar cancelar programação associada se existir
      try {
        const delivery = await Delivery.findById(deliveryId).populate('linkedProgramacaoId');
        if (delivery && delivery.linkedProgramacaoId) {
          const ProgramacaoEntrega = mongoose.model('ProgramacaoEntrega');
          await ProgramacaoEntrega.findByIdAndUpdate(delivery.linkedProgramacaoId._id, { 
            status: 'CANCELADO',
            ativo: false 
          });
          console.log(`[STATUS_UPDATE] Programação ${delivery.linkedProgramacaoId._id} cancelada junto com entrega`);
        }
      } catch (progErr) {
        console.warn('[STATUS_UPDATE] Erro ao cancelar programação:', progErr.message);
      }
    } else if (currentDelivery.status === 'CANCELADO') {
      // Caso um cancelamento seja revertido, limpar flags de cancelamento
      updates.canceledAt = null;
      updates.isCanceled = false;
      
      // Tentar reativar programação associada se existir
      try {
        const delivery = await Delivery.findById(deliveryId).populate('linkedProgramacaoId');
        if (delivery && delivery.linkedProgramacaoId) {
          const ProgramacaoEntrega = mongoose.model('ProgramacaoEntrega');
          await ProgramacaoEntrega.findByIdAndUpdate(delivery.linkedProgramacaoId._id, { 
            status: 'AGENDADO',
            ativo: true 
          });
          console.log(`[STATUS_UPDATE] Programação ${delivery.linkedProgramacaoId._id} reativada após reverter cancelamento`);
        }
      } catch (progErr) {
        console.warn('[STATUS_UPDATE] Erro ao reativar programação:', progErr.message);
      }
    }

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
  FIELDS_TO_CLEAR_ON_REGRESSION,
  canUpdateStatus,
  updateDeliveryAtomic,
  updateDeliveryStatus,
  addDocumentToDelivery,
  updateDeliveryField
};
