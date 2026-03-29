/**
 * deliveryService.js
 * Serviço otimizado para consultas de entregas com Mongoose
 * Implementa boas práticas:
 * - Usar .lean() para performance
 * - Usar .select() para apenas campos necessários
 * - Usar índices compostos
 * - Implementar paginação
 * - Usar aggregation pipeline quando apropriado
 */

const Delivery = require('../models/Delivery');
const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
const Icompany = require('../models/Icompany');

/**
 * Obter estatísticas de entregas com performance otimizada
 * Usa aggregation pipeline ao invés de carregar tudo em memória
 */
exports.getStatistics = async (cityCode = 'manaus', contratadobFilter = null) => {
  try {
    const match = { cityCode };
    
    // Se houver filtro de contratado (gestor_contratado), adicionar
    if (contratadobFilter) {
      match.userName = contratadobFilter;
    }

    // Usar aggregation pipeline para performance
    const pipeline = [
      { $match: match },
      
      // Group por status
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      
      { $sort: { _id: 1 } }
    ];

    const statusCounts = await Delivery.aggregate(pipeline);

    // Contar totais por categoria
    const totalMatch = Delivery.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          submitted: {
            $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          finalized: {
            $sum: {
              $cond: [
                {
                  $in: ['$status', ['ENTREGUE', 'FINALIZADO', 'ENTREGUE_COM_PENDENCIA_CANHOTO']]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const [totals] = await totalMatch;

    // Contar por contratado
    const byContratado = await Delivery.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$userName',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const dailyDeliveries = await Delivery.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'America/Sao_Paulo'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    return {
      total: totals?.total || 0,
      submitted: totals?.submitted || 0,
      pending: totals?.pending || 0,
      finalized: totals?.finalized || 0,
      statusCounts,
      byContratado,
      dailyDeliveries
    };
  } catch (error) {
    console.error('❌ Erro em getStatistics:', error);
    throw error;
  }
};

/**
 * Listar entregas com paginação e seleção de campos
 */
exports.listDeliveries = async (options = {}) => {
  const {
    cityCode = 'manaus',
    status = null,
    userName = null,
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    order = -1
  } = options;

  try {
    const skip = (page - 1) * limit;
    const query = { cityCode };

    // Aplicar filtros
    if (status) {
      query.status = status;
    }
    if (userName) {
      query.userName = userName;
    }

    // Selecionar apenas campos necessários - reduz memória e rede
    const fields = 'deliveryNumber status driverName recebedor userName createdAt arrivedAt cityCode';

    // Usar .lean() para não criar documentos Mongoose = mais rápido
    const deliveries = await Delivery
      .find(query)
      .select(fields)
      .sort({ [sortBy]: order })
      .skip(skip)
      .limit(limit)
      .lean();

    // Contar total para paginação
    const total = await Delivery.countDocuments(query);

    return {
      data: deliveries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('❌ Erro em listDeliveries:', error);
    throw error;
  }
};

/**
 * Obter entrega com programação vinculada (população otimizada)
 */
exports.getDeliveryWithProgramacao = async (deliveryId) => {
  try {
    const delivery = await Delivery
      .findById(deliveryId)
      .select('_id deliveryNumber status driverName recebedor userName createdAt arrivedAt linkedProgramacaoId')
      .populate({
        path: 'linkedProgramacaoId',
        model: 'ProgramacaoEntrega',
        select: 'processo container dataAgendamento status dtColeta',
        options: { lean: true }
      })
      .lean();

    return delivery;
  } catch (error) {
    console.error('❌ Erro em getDeliveryWithProgramacao:', error);
    throw error;
  }
};

/**
 * Listar programações com entregas vinculadas (paginado)
 */
exports.listProgramacoesWithDeliveries = async (options = {}) => {
  const {
    cityCode = 'manaus',
    contratado = null,
    status = null,
    page = 1,
    limit = 100
  } = options;

  try {
    const skip = (page - 1) * limit;
    const query = { ativo: { $ne: false } };

    // Filtro de cidade
    if (cityCode === 'manaus') {
      query.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (cityCode === 'itajai') {
      query.$or = [
        { origem: { $exists: false } },
        { origem: '' },
        { origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } }
      ];
    }

    // Filtro de contratado (se houver)
    if (contratado) {
      query.contratado = new RegExp(`^${contratado}$`, 'i');
    }

    // Filtro de status (se houver)
    if (status) {
      query.status = status;
    }

    // Listar com paginação e population
    const programacoes = await ProgramacaoEntrega
      .find(query)
      .select('_id processo container dataAgendamento status motorista contratado linkedDeliveryId')
      .sort({ dataAgendamento: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'linkedDeliveryId',
        select: 'status missingDocumentsAtSubmit horarioDevolucaoVazio',
        options: { lean: true }
      })
      .lean();

    // Contar total
    const total = await ProgramacaoEntrega.countDocuments(query);

    return {
      data: programacoes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('❌ Erro em listProgramacoesWithDeliveries:', error);
    throw error;
  }
};

/**
 * Buscar entreg as por texto (usando índice de texto)
 */
exports.searchDeliveries = async (searchTerm, cityCode = 'manaus', options = {}) => {
  const { page = 1, limit = 20 } = options;

  try {
    const skip = (page - 1) * limit;
    const query = {
      cityCode,
      $text: { $search: searchTerm }
    };

    const deliveries = await Delivery
      .find(query, { score: { $meta: 'textScore' } })
      .select('deliveryNumber status driverName recebedor userName createdAt')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Delivery.countDocuments(query);

    return {
      data: deliveries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  } catch (error) {
    console.error('❌ Erro em searchDeliveries:', error);
    throw error;
  }
};

/**
 * Obter entregas por período com aggregation
 * Agrupa por data para dashboard
 */
exports.getDeliveriesByPeriod = async (startDate, endDate, cityCode = 'manaus') => {
  try {
    const pipeline = [
      {
        $match: {
          cityCode,
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          finalizado: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    ['ENTREGUE', 'FINALIZADO', 'ENTREGUE_COM_PENDENCIA_CANHOTO']
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ];

    return await Delivery.aggregate(pipeline);
  } catch (error) {
    console.error('❌ Erro em getDeliveriesByPeriod:', error);
    throw error;
  }
};

/**
 * Contar entregas por status (rápido com aggregation)
 */
exports.countByStatus = async (cityCode = 'manaus', userName = null) => {
  try {
    const match = { cityCode };
    if (userName) {
      match.userName = userName;
    }

    const result = await Delivery.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Converter array em objeto
    const counts = {};
    result.forEach(item => {
      counts[item._id] = item.count;
    });

    return counts;
  } catch (error) {
    console.error('❌ Erro em countByStatus:', error);
    throw error;
  }
};

/**
 * Query logging para identificar queries lentas
 */
exports.enableQueryLogging = () => {
  const mongoose = require('mongoose');
  
  mongoose.set('debug', (collection, method, query, doc, options) => {
    const time = options._timing ? options._timing.toString() : 'unknown';
    if (parseInt(time) > 100) {  // Alert für queries über 100ms
      console.warn(`⚠️  SLOW QUERY [${time}ms]: ${collection}.${method}`, 
        JSON.stringify(query).slice(0, 100));
    }
  });
};

module.exports = exports;
