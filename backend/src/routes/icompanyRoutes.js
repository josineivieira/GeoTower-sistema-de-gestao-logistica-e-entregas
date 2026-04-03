const express = require("express");
const router = express.Router();
const icompanyController = require("../controllers/icompanyController");
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI; // ⚠️ no Render tem que ser esse nome
const DB_NAME = process.env.MONGO_DB || "delivery-docs";
// default collection should match a primary data source, but também admite vários como fallback
const PRIMARY_COLLECTION = process.env.MONGO_COLLECTION || "icompany";
const FALLBACK_COLLECTIONS = Array.from(new Set([PRIMARY_COLLECTION, 'icompany', 'basegeomars', 'ycompany']));

let _client, _col;
async function col() {
  if (_col) return _col;
  _client = new MongoClient(MONGODB_URI);
  await _client.connect();
  _col = _client.db(DB_NAME).collection(PRIMARY_COLLECTION);
  return _col;
}

async function findInCollections(query) {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  for (const collectionName of FALLBACK_COLLECTIONS) {
    const collection = db.collection(collectionName);
    const docs = await collection.find(query).toArray();
    if (docs && docs.length > 0) {
      await client.close();
      return { collection: collectionName, docs };
    }
  }

  await client.close();
  return { collection: null, docs: [] };
}

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (v instanceof Date) return false; // Datas preenchidas são válidas
  return false;
}

// --- new endpoints for the React Icompany page ------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const c = await col();
    
    // Construir filtro baseado na cidade do usuário
    let filter = {};
    const city = req.city || 'manaus'; // req.city vem do middleware city.js
    
    if (city === 'manaus') {
      // Manaus: mostra apenas dados de MANAUS e MANAUS - COELTA BALY
      filter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      // Itajaí: mostra todos os dados que NÃO sejam de Manaus
      filter.origem = { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] };
    }
    
    let data = await c.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(2000)
      .toArray();

    let collectionUsed = PRIMARY_COLLECTION;
    if (!data.length) {
      const fall = await findInCollections(filter);
      if (fall.docs && fall.docs.length > 0) {
        data = fall.docs;
        collectionUsed = fall.collection;
      }
    }

    // Serializar datas para ISO string
    const serialized = data.map(doc => {
      const obj = { ...doc };
      if (obj.dtInicioRota && obj.dtInicioRota instanceof Date) obj.dtInicioRota = obj.dtInicioRota.toISOString();
      if (obj.dtInicioDescarga && obj.dtInicioDescarga instanceof Date) obj.dtInicioDescarga = obj.dtInicioDescarga.toISOString();
      if (obj.dtFimDescarga && obj.dtFimDescarga instanceof Date) obj.dtFimDescarga = obj.dtFimDescarga.toISOString();
      if (obj.dtRetiraPD && obj.dtRetiraPD instanceof Date) obj.dtRetiraPD = obj.dtRetiraPD.toISOString();
      if (obj.dtDevolucaoCNTR && obj.dtDevolucaoCNTR instanceof Date) obj.dtDevolucaoCNTR = obj.dtDevolucaoCNTR.toISOString();
      if (obj.arrivedAt && obj.arrivedAt instanceof Date) obj.arrivedAt = obj.arrivedAt.toISOString();
      return obj;
    });
    res.json({ ok: true, success: true, collection: collectionUsed, count: serialized.length, data: serialized, city: city });
  } catch (e) {
    console.error('Icompany GET / error:', e);
    res.status(500).json({ ok: false, error: 'Erro ao buscar dados' });
  }
});

// Compare Icompany (GEO TOWER) vs programacaoentregas (ICOMPANY - Excel)
// 4 colunas específicas: dtRetiraPD, dtInicioDescarga, dtFimDescarga, dtDevolucaoCNTR
router.get('/compare', async (req, res) => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    const icompanyCol = db.collection('icompany');
    const excelCol = db.collection('programacaoentregas');
    
    // Construir filtro baseado na cidade do usuário
    let filter = {};
    const city = req.city || 'manaus';
    
    if (city === 'manaus') {
      // Manaus: mostra apenas dados de MANAUS e MANAUS - COELTA BALY
      filter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      // Itajaí: mostra todos os dados que NÃO sejam de Manaus
      filter.origem = { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] };
    }
    
    // Mapeamento dos 4 campos para comparação
    // [fieldNameInGeoTower, fieldNameInIcompany, displayName]
    const COMPARE_FIELDS = [
      ['dtRetiraPD', 'dtRetiraPD', 'Dt. Retirada P.D.'],
      ['dtInicioDescarga', 'dtInicioDescarga', 'Dt. Início Descarga'],
      ['dtFimDescarga', 'dtFimDescarga', 'Dt. Fim Descarga'],
      ['dtDevolucaoCNTR', 'dtDevolucaoCNTR', 'Dt. Devolução CNTR']
    ];
    
    const icompanyRecords = await icompanyCol.find(filter).toArray();
    const comparison = [];
    
    for (const yRecord of icompanyRecords) {
      // Procurar por processo usando múltiplos campos possíveis
      let excelRecord = null;
      const processoProcurar = yRecord.geomaritima || yRecord.processo || yRecord.codigo;
      
      if (processoProcurar && processoProcurar.trim() !== '') {
        const cleanedProc = processoProcurar.trim().toUpperCase();
        excelRecord = await excelCol.findOne({ 
          $or: [
            { processo: { $regex: `^${cleanedProc}$`, $options: 'i' } },
            { codigo: { $regex: `^${cleanedProc}$`, $options: 'i' } },
            { geomaritima: { $regex: `^${cleanedProc}$`, $options: 'i' } }
          ]
        });
      }
      
      const record = {
        processo: yRecord.geomaritima || yRecord.processo || yRecord.codigo,
        cliente: yRecord.cliente,
        containerNumero: yRecord.containerNumero,
        analysis: {},
        _debug: {
          processoBuscado: processoProcurar,
          encontrado: !!excelRecord
        }
      };
      
      // Comparar os 4 campos específicos - retornar os valores reais também
      COMPARE_FIELDS.forEach(([geoTowerField, icompanyField, displayName]) => {
        const geoTowerValue = yRecord[geoTowerField];
        const icompanyValue = excelRecord ? excelRecord[icompanyField] : null;
        
        const hasInGeoTower = !isEmpty(geoTowerValue);
        const hasInIcompany = !isEmpty(icompanyValue);
        
        record.analysis[displayName] = {
          geoTower: hasInGeoTower ? 'V' : 'X',
          icompany: hasInIcompany ? 'V' : 'X',
          hasInGeoTower,
          hasInIcompany,
          geoTowerValue: geoTowerValue || null,
          icompanyValue: icompanyValue || null,
          debug: {
            geoTowerType: typeof geoTowerValue,
            icompanyType: icompanyValue ? typeof icompanyValue : 'null',
            geoTowerIsDate: geoTowerValue instanceof Date,
            icompanyIsDate: icompanyValue instanceof Date
          }
        };
      });
      
      comparison.push(record);
    }
    
    await client.close();
    
    res.json({
      ok: true,
      count: comparison.length,
      data: comparison,
      city: city
    });
  } catch (e) {
    console.error('Icompany compare error:', e);
    res.status(500).json({ ok: false, error: 'Erro ao comparar dados' });
  }
});

// Search endpoint: permite busca por número/código/processo mesmo sem filtro de cidade
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ ok: false, success: false, message: 'Query q é obrigatória' });

    const cleaned = q.replace(/^#/, '').trim();
    const safe = cleaned.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`^${safe}$`, 'i');

    const searchQuery = {
      $or: [
        { numero: regex },
        { NUMERO: regex },
        { 'NÚMERO': regex },
        { codigo: regex },
        { processo: regex },
        { geomaritima: regex },
        { container: regex }
      ]
    };

    const { collection, docs } = await findInCollections(searchQuery);

    res.json({
      ok: true,
      success: true,
      collection: collection || PRIMARY_COLLECTION,
      count: docs.length,
      data: docs
    });
  } catch (e) {
    console.error('Icompany search error:', e);
    res.status(500).json({ ok: false, success: false, error: 'Erro ao buscar Icompany' });
  }
});

// Debug endpoint: mostra exemplo de registros de ambas as coleções
router.get('/debug-comparison', async (req, res) => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    const icompanyCol = db.collection('icompany');
    const excelCol = db.collection('programacaoentregas');
    
    // Construir filtro baseado na cidade do usuário
    let filter = {};
    const city = req.city || 'manaus';
    
    if (city === 'manaus') {
      filter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      filter.origem = { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] };
    }
    
    // Get 3 records from each collection for detailed analysis
    const icompanyRecords = await icompanyCol.find(filter).limit(5).toArray();
    const excelRecords = await excelCol.find({}).limit(5).toArray();
    
    // Map to compare side by side
    const COMPARE_FIELDS = [
      ['dtRetiraPD', 'dtRetiraPD', 'Dt. Retirada P.D.'],
      ['dtInicioDescarga', 'dtInicioDescarga', 'Dt. Início Descarga'],
      ['dtFimDescarga', 'dtFimDescarga', 'Dt. Fim Descarga'],
      ['dtDevolucaoCNTR', 'dtDevolucaoCNTR', 'Dt. Devolução CNTR']
    ];
    
    const detailedComparison = icompanyRecords.map(yRecord => {
      const processoProcurar = yRecord.geomaritima || yRecord.processo || yRecord.codigo;
      
      // Find matching excel record
      let excelRecord = null;
      if (processoProcurar && processoProcurar.trim() !== '') {
        const cleanedProc = processoProcurar.trim().toUpperCase();
        excelRecord = excelRecords.find(e => {
          const eProc = (e.processo || e.codigo || e.geomaritima || '').trim().toUpperCase();
          return eProc === cleanedProc;
        });
      }
      
      const fields = {};
      COMPARE_FIELDS.forEach(([geoField, excelField, displayName]) => {
        const geoValue = yRecord[geoField];
        const excelValue = excelRecord ? excelRecord[excelField] : undefined;
        
        fields[displayName] = {
          geoTower: {
            value: geoValue,
            type: typeof geoValue,
            isDate: geoValue instanceof Date,
            isEmpty: isEmpty(geoValue)
          },
          icompany: {
            value: excelValue,
            type: typeof excelValue,
            isDate: excelValue instanceof Date,
            isEmpty: isEmpty(excelValue)
          }
        };
      });
      
      return {
        processo: processoProcurar,
        geoTowerId: yRecord._id,
        excelRecordFound: !!excelRecord,
        excelId: excelRecord?._id,
        fields
      };
    });
    
    await client.close();
    
    res.json({
      ok: true,
      totalGeoTower: icompanyRecords.length,
      totalExcel: excelRecords.length,
      detailedComparison,
      city: city
    });
  } catch (e) {
    console.error('Debug comparison error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});


router.get('/search', async (req, res) => {
  try {
    const c = await col();
    const { q, limit = '500' } = req.query;
    const filter = {};
    
    // Filtro por cidade
    const city = req.city || 'manaus';
    if (city === 'manaus') {
      filter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      filter.origem = { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] };
    }
    
    if (q && q.trim()) {
      filter.$or = [
        { codigo: { $regex: q.trim(), $options: 'i' } },
        { geomaritima: { $regex: q.trim(), $options: 'i' } },
        { cliente: { $regex: q.trim(), $options: 'i' } },
        { remetente: { $regex: q.trim(), $options: 'i' } },
        { destinatario: { $regex: q.trim(), $options: 'i' } },
        { navio: { $regex: q.trim(), $options: 'i' } },
      ];
    }
    
    const data = await c.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(Math.min(parseInt(limit, 10) || 500, 2000))
      .toArray();
    // Serializar datas para ISO string
    const serialized = data.map(doc => {
      const obj = { ...doc };
      if (obj.dtInicioRota && obj.dtInicioRota instanceof Date) obj.dtInicioRota = obj.dtInicioRota.toISOString();
      if (obj.dtInicioDescarga && obj.dtInicioDescarga instanceof Date) obj.dtInicioDescarga = obj.dtInicioDescarga.toISOString();
      if (obj.dtFimDescarga && obj.dtFimDescarga instanceof Date) obj.dtFimDescarga = obj.dtFimDescarga.toISOString();
      if (obj.dtRetiraPD && obj.dtRetiraPD instanceof Date) obj.dtRetiraPD = obj.dtRetiraPD.toISOString();
      if (obj.dtDevolucaoCNTR && obj.dtDevolucaoCNTR instanceof Date) obj.dtDevolucaoCNTR = obj.dtDevolucaoCNTR.toISOString();
      if (obj.arrivedAt && obj.arrivedAt instanceof Date) obj.arrivedAt = obj.arrivedAt.toISOString();
      return obj;
    });
    res.json({ ok: true, count: serialized.length, data: serialized, city: city });
  } catch (e) {
    console.error('Icompany search error:', e);
    res.status(500).json({ ok: false, error: 'Erro ao buscar dados' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const c = await col();
    
    // Filtro por cidade
    let filter = {};
    const city = req.city || 'manaus';
    if (city === 'manaus') {
      filter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      filter.origem = { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] };
    }
    
    const records = await c.find(filter).toArray();
    
    if (!records.length) {
      return res.status(404).json({ ok: false, error: 'Nenhum registro para exportar' });
    }
    
    const keys = Object.keys(records[0]);
    const csv = [
      keys.join(','),
      ...records.map(r => keys.map(k => `"${r[k] || ''}"`).join(',')),
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=icompany.csv');
    res.send(csv);
  } catch (e) {
    console.error('Icompany export error:', e);
    res.status(500).json({ ok: false, error: 'Erro ao exportar dados' });
  }
});
// --------------------------------------------------------------------------------------------


/**
 * GET /api/icompany/entregas?status=&q=&limit=
 * Lista geral para a tela ICompany
 */
router.get("/entregas", async (req, res) => {
  try {
    const c = await col();
    const { status, q, limit = "500" } = req.query;

    // Filtro por cidade
    let filter = {};
    const city = req.city || 'manaus';
    if (city === 'manaus') {
      filter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      filter.origem = { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] };
    }

    if (status) filter.status = status;

    if (q && q.trim()) {
      filter.$or = [
        { processo: { $regex: q.trim(), $options: "i" } },
        { cliente: { $regex: q.trim(), $options: "i" } },
        { destinatario: { $regex: q.trim(), $options: "i" } },
        { contratado: { $regex: q.trim(), $options: "i" } },
        { motoristaNome: { $regex: q.trim(), $options: "i" } },
        { containerNumero: { $regex: q.trim(), $options: "i" } }
      ];
    }

    const data = await c
      .find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(Math.min(parseInt(limit, 10) || 500, 2000))
      .toArray();

    res.json({ ok: true, total: data.length, data, city: city });
  } catch (e) {
    console.error("ICompany list error:", e);
    res.status(500).json({ ok: false, error: "Erro ao buscar entregas" });
  }
});

/**
 * PATCH /api/icompany/entregas/:processo
 * Admin pode editar qualquer campo (cuidado: aqui é “poder total”)
 */
router.patch("/entregas/:processo", async (req, res) => {
  try {
    const c = await col();
    const { processo } = req.params;

    // tudo que vier no body será setado (admin)
    const updates = { ...req.body, updatedAt: new Date() };

    await c.updateOne({ processo }, { $set: updates });
    const doc = await c.findOne({ processo });

    res.json({ ok: true, data: doc });
  } catch (e) {
    console.error("ICompany edit error:", e);
    res.status(500).json({ ok: false, error: "Erro ao editar entrega" });
  }
});

/**
 * PATCH /api/icompany/entregas/:processo/atribuir-motorista
 * Admin define motorista para a entrega
 * body: { motoristaId, motoristaNome }
 */
router.patch("/entregas/:processo/atribuir-motorista", async (req, res) => {
  try {
    const c = await col();
    const { processo } = req.params;
    const { motoristaId, motoristaNome } = req.body;

    if (isEmpty(motoristaId)) {
      return res.status(400).json({ ok: false, error: "motoristaId é obrigatório" });
    }

    await c.updateOne(
      { processo },
      {
        $set: {
          motoristaId,
          motoristaNome: motoristaNome || null,
          updatedAt: new Date()
        }
      }
    );

    const doc = await c.findOne({ processo });
    res.json({ ok: true, data: doc });
  } catch (e) {
    console.error("ICompany assign error:", e);
    res.status(500).json({ ok: false, error: "Erro ao atribuir motorista" });
  }
});

/**
 * GET /api/icompany/relatorio-contratado
 * Retorna TODOS os dados de icompany (sem filtro de data no backend)
 * O filtro será feito no FRONTEND
 */
router.get("/relatorio-contratado", async (req, res) => {
  try {
    const c = await col();
    
    // Filtro por cidade
    let filter = {};
    const city = req.city || 'manaus';
    if (city === 'manaus') {
      filter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      filter.origem = { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] };
    }
    
    // Buscar dados com filtro de cidade
    const dados = await c
      .find(filter)
      .sort({ dtAgendamentoDescarga: -1, dataAgendamento: -1, createdAt: -1, _id: -1 })
      .toArray();

    console.log('Total de registros encontrados:', dados.length);

    // Calcular sumário
    const totalEntregas = dados.length;
    const totalFrete = dados.reduce((sum, d) => sum + (d.vlFreteProcesso || 0), 0);
    const mediaFrete = totalEntregas > 0 ? totalFrete / totalEntregas : 0;

    // Agrupar por contratado para sumário
    const resumoPorContratado = {};
    dados.forEach(d => {
      const c = d.contratado || 'SEM CONTRATADO';
      if (!resumoPorContratado[c]) {
        resumoPorContratado[c] = { quantidade: 0, totalFrete: 0 };
      }
      resumoPorContratado[c].quantidade += 1;
      resumoPorContratado[c].totalFrete += d.vlFreteProcesso || 0;
    });

    res.json({
      ok: true,
      resumo: {
        totalEntregas,
        totalFrete,
        mediaFrete: parseFloat(mediaFrete.toFixed(2))
      },
      resumoPorContratado,
      dados,
      city: city
    });
  } catch (e) {
    console.error("ICompany relatório error:", e);
    res.status(500).json({ ok: false, error: "Erro ao gerar relatório", details: e.message });
  }
});

/**
 * GET /api/icompany/contratados-unicos
 * Retorna lista de contratados únicos para o filtro
 */
router.get("/contratados-unicos", async (req, res) => {
  try {
    const c = await col();
    
    // Filtro por cidade
    let filter = {};
    const city = req.city || 'manaus';
    if (city === 'manaus') {
      filter.origem = { $in: ['MANAUS', 'MANAUS - COELTA BALY'] };
    } else if (city === 'itajai') {
      filter.origem = { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] };
    }
    
    const contratados = await c.distinct("contratado", { ...filter, contratado: { $ne: null, $ne: "" } });
    res.json({ ok: true, contratados: contratados.sort(), city: city });
  } catch (e) {
    console.error("ICompany contratados error:", e);
    res.status(500).json({ ok: false, error: "Erro ao buscar contratados" });
  }
});

module.exports = router;