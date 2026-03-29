const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');

// Get all deliveries (admin only)
exports.getAllDeliveries = async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { driverId, startDate, endDate, searchTerm, status } = req.query;

    let query = { status: { $in: ['submitted', 'completed'] }, cityCode: city };

    if (driverId) {
      query.driverId = driverId;
    }

    if (searchTerm) {
      query.$or = [
        { deliveryNumber: { $regex: searchTerm, $options: 'i' } },
        { driverName: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      query.submittedAt = {};
      if (startDate) {
        query.submittedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.submittedAt.$lte = end;
      }
    }

    if (status) {
      query.status = status;
    }

    const deliveries = await Delivery.find(query)
      .populate('driverId', 'name username email')
      .sort({ submittedAt: -1 });

    res.json({ success: true, deliveries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Get delivery statistics
exports.getStatistics = async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { period = 'month', startDate, endDate } = req.query;

    let dateFilter = {};
    const now = new Date();

    // Se startDate/endDate foram passados, usar esses; senão usar period
    if (startDate || endDate) {
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
    } else if (period === 'day') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { $gte: startOfDay };
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { $gte: startOfWeek };
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { $gte: startOfMonth };
    }

    // Total deliveries
    const totalDeliveries = await Delivery.countDocuments({
      status: { $in: ['submitted', 'completed'] },
      cityCode: city,
      submittedAt: dateFilter
    });

    // Deliveries by driver — AGORA usando ProgramacaoEntrega para ser consistente com dailyDeliveries
    const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
    let progFilter = {};
    if (city === 'manaus') {
      progFilter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      progFilter.$or = [
        { origem: { $exists: false } },
        { origem: '' },
        { origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } }
      ];
    }

    // Aplicar filtro de data na programação (usando scheduleDate: dataAgendamento ou dtColeta)
    const scheduleFilter = {};
    if (Object.keys(dateFilter).length > 0) {
      Object.assign(scheduleFilter, dateFilter);
    }

    const deliveriesByDriver = await ProgramacaoEntrega.aggregate([
      {
        $match: {
          ...progFilter,
          ativo: { $ne: false }
        }
      },
      {
        $addFields: {
          scheduleDate: city === 'manaus' ? '$dataAgendamento' : '$dtColeta'
        }
      },
      {
        $match: {
          scheduleDate: { $ne: null, ...scheduleFilter }
        }
      },
      {
        $group: {
          _id: '$motorista', // ou o campo que identifica o motorista/contratado
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Daily deliveries (last 30 days) - PROGRAMAÇÕES por data de agendamento
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Query na tabela ProgramacaoEntrega para contar programações por dia
    let progDailyFilter = {};
    if (city === 'manaus') {
      progDailyFilter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      progDailyFilter.$or = [
        { origem: { $exists: false } },
        { origem: '' },
        { origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } }
      ];
    }

    const dailyDeliveries = await ProgramacaoEntrega.aggregate([
      {
        $match: {
          ...progDailyFilter,
          ativo: { $ne: false } // Só programações ativas
        }
      },
      {
        $addFields: {
          // Para Manaus: usa dataAgendamento, para Itajaí: usa dtColeta
          scheduleDate: city === 'manaus' ? '$dataAgendamento' : '$dtColeta'
        }
      },
      {
        $match: {
          scheduleDate: { $ne: null, $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$scheduleDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      statistics: {
        totalDeliveries,
        deliveriesByDriver,
        dailyDeliveries,
        period
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Get delivery details (admin)
exports.getDeliveryDetails = async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;

    const delivery = await Delivery.findById(id).populate('driverId', 'name username email phone');

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Entrega não encontrada' });
    }
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ success: false, message: 'Acesso negado - dados de outra cidade' });
    }

    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Download document
exports.downloadDocument = async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id, documentType } = req.params;

    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Entrega não encontrada' });
    }
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ success: false, message: 'Acesso negado - dados de outra cidade' });
    }

    const doc = delivery.documents[documentType];

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Documento não encontrado' });
    }

    res.download(doc.path);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Get driver details (admin)
exports.getDriverDetails = async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Motorista não encontrado' });
    }

    const deliveries = await Delivery.countDocuments({
      driverId,
      status: { $in: ['submitted', 'completed'] }
    });

    res.json({
      success: true,
      driver: driver.toJSON(),
      totalDeliveries: deliveries
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};
