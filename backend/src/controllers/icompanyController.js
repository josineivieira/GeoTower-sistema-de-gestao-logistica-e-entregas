const Icompany = require('../models/Icompany');

// GET all Icompany records
exports.getAll = async (req, res) => {
  try {
    // Filtrar por cidade do usuário
    const city = req.city || 'manaus';
    const filter = {};
    
    if (city === 'manaus') {
      filter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      filter.origem = { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] };
    }
    
    const records = await Icompany.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: records.length,
      data: records,
      city: city
    });
  } catch (error) {
    console.error('Erro ao buscar registros Icompany:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar registros',
      error: error.message,
    });
  }
};

// GET by ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Icompany.findById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Registro não encontrado',
      });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('Erro ao buscar registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar registro',
      error: error.message,
    });
  }
};

// POST create new record
exports.create = async (req, res) => {
  try {
    const { codigo } = req.body;
    
    // Usar city do body, ou do middleware como fallback
    const city = req.body.city || req.city || 'manaus';

    // Validar campos obrigatórios
    if (!codigo) {
      return res.status(400).json({
        success: false,
        message: 'Código é obrigatório',
      });
    }

    // Verificar se código já existe
    const existing = await Icompany.findOne({ codigo, city });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Código já existe nesta cidade',
      });
    }

    const newRecord = new Icompany({
      ...req.body,
      city,
      createdBy: req.user?.id,
    });

    const saved = await newRecord.save();

    res.status(201).json({
      success: true,
      message: 'Registro criado com sucesso',
      data: saved,
    });
  } catch (error) {
    console.error('Erro ao criar registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar registro',
      error: error.message,
    });
  }
};

// PUT update record
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Icompany.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Registro não encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Registro atualizado com sucesso',
      data: updated,
    });
  } catch (error) {
    console.error('Erro ao atualizar registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar registro',
      error: error.message,
    });
  }
};

// DELETE record
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Icompany.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Registro não encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Registro deletado com sucesso',
      data: deleted,
    });
  } catch (error) {
    console.error('Erro ao deletar registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar registro',
      error: error.message,
    });
  }
};

// Search and filter
exports.search = async (req, res) => {
  try {
    const { q, situacao, cliente, limit = 100, skip = 0 } = req.query;
    const city = req.city || 'manaus';

    const filter = {};
    
    // Filtro por cidade
    if (city === 'manaus') {
      filter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      filter.origem = { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] };
    }

    if (q) {
      filter.$or = [
        { codigo: { $regex: q, $options: 'i' } },
        { geomaritima: { $regex: q, $options: 'i' } },
        { cliente: { $regex: q, $options: 'i' } },
        { remetente: { $regex: q, $options: 'i' } },
        { destinatario: { $regex: q, $options: 'i' } },
        { navio: { $regex: q, $options: 'i' } },
        { numero: { $regex: q, $options: 'i' } },
      ];
    }

    if (situacao) {
      filter.situacao = situacao;
    }

    if (cliente) {
      filter.cliente = { $regex: cliente, $options: 'i' };
    }

    const records = await Icompany.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Icompany.countDocuments(filter);

    res.json({
      success: true,
      count: records.length,
      total,
      skip: parseInt(skip),
      limit: parseInt(limit),
      data: records,
      city: city
    });
  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar registros',
      error: error.message,
    });
  }
};

// Bulk import
exports.bulkImport = async (req, res) => {
  try {
    const { records } = req.body;
    
    // Usar city do body, ou do middleware como fallback
    const city = req.body.city || req.city || 'manaus';

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Deve fornecer um array de registros',
      });
    }

    const withCity = records.map(r => ({
      ...r,
      city,
      createdBy: req.user?.id,
    }));

    const inserted = await Icompany.insertMany(withCity, { ordered: false });

    res.status(201).json({
      success: true,
      message: `${inserted.length} registros importados com sucesso`,
      data: inserted,
    });
  } catch (error) {
    console.error('Erro ao importar registros:', error);
    
    // Lidar com erros de duplicação
    const duplicateErrors = error.writeErrors?.filter(e => e.code === 11000) || [];
    
    res.status(400).json({
      success: false,
      message: 'Erro ao importar registros',
      duplicateErrors: duplicateErrors.length,
      error: error.message,
    });
  }
};

// Export dados
exports.export = async (req, res) => {
  try {
    // Exporta TODOS os registros
    const records = await Icompany.find({}).lean();

    // Converter para CSV simples
    if (!records.length) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum registro para exportar',
      });
    }

    const keys = Object.keys(records[0]);
    const csv = [
      keys.join(','),
      ...records.map(r => keys.map(k => `"${r[k] || ''}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=icompany.csv');
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar dados',
      error: error.message,
    });
  }
};

// Statistics
exports.stats = async (req, res) => {
  try {
    // Estatísticas de TODOS os registros
    const stats = await Icompany.aggregate([
      {
        $group: {
          _id: '$situacao',
          count: { $sum: 1 },
          avgFrete: { $avg: '$vlFreteProcesso' },
          totalFrete: { $sum: '$vlFreteProcesso' },
        },
      },
    ]);

    const total = await Icompany.countDocuments({});

    res.json({
      success: true,
      total,
      byStatus: stats,
    });
  } catch (error) {
    console.error('Erro ao gerar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar estatísticas',
      error: error.message,
    });
  }
};
