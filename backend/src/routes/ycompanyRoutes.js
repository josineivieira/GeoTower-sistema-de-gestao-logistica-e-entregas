const express = require("express");
const router = express.Router();
const ycompanyController = require("../controllers/ycompanyController");
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI; // ⚠️ no Render tem que ser esse nome
const DB_NAME = process.env.MONGO_DB || "delivery-docs";
// default collection should match the mongoose model (ycompany) unless overridden by env
const COLLECTION = process.env.MONGO_COLLECTION || "ycompany";

let _client, _col;
async function col() {
  if (_col) return _col;
  _client = new MongoClient(MONGODB_URI);
  await _client.connect();
  _col = _client.db(DB_NAME).collection(COLLECTION);
  return _col;
}

function isEmpty(v) {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

// --- new endpoints for the React Ycompany page ------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const c = await col();
    const data = await c.find({})
      .sort({ updatedAt: -1, _id: -1 })
      .limit(2000)
      .toArray();
    // Serializar datas para ISO string
    const serialized = data.map(doc => {
      const obj = { ...doc };
      if (obj.dtInicioRota && obj.dtInicioRota instanceof Date) obj.dtInicioRota = obj.dtInicioRota.toISOString();
      if (obj.dtInicioDescarga && obj.dtInicioDescarga instanceof Date) obj.dtInicioDescarga = obj.dtInicioDescarga.toISOString();
      if (obj.dtFimDescarga && obj.dtFimDescarga instanceof Date) obj.dtFimDescarga = obj.dtFimDescarga.toISOString();
      if (obj.dtRetiraPD && obj.dtRetiraPD instanceof Date) obj.dtRetiraPD = obj.dtRetiraPD.toISOString();
      if (obj.dtDevolucaoCNTR && obj.dtDevolucaoCNTR instanceof Date) obj.dtDevolucaoCNTR = obj.dtDevolucaoCNTR.toISOString();
      return obj;
    });
    res.json({ ok: true, count: serialized.length, data: serialized });
  } catch (e) {
    console.error('Ycompany GET / error:', e);
    res.status(500).json({ ok: false, error: 'Erro ao buscar dados' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const c = await col();
    const { q, limit = '500' } = req.query;
    const filter = {};
    
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
      return obj;
    });
    res.json({ ok: true, count: serialized.length, data: serialized });
  } catch (e) {
    console.error('Ycompany search error:', e);
    res.status(500).json({ ok: false, error: 'Erro ao buscar dados' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const c = await col();
    const records = await c.find({}).toArray();
    
    if (!records.length) {
      return res.status(404).json({ ok: false, error: 'Nenhum registro para exportar' });
    }
    
    const keys = Object.keys(records[0]);
    const csv = [
      keys.join(','),
      ...records.map(r => keys.map(k => `"${r[k] || ''}"`).join(',')),
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=ycompany.csv');
    res.send(csv);
  } catch (e) {
    console.error('Ycompany export error:', e);
    res.status(500).json({ ok: false, error: 'Erro ao exportar dados' });
  }
});
// --------------------------------------------------------------------------------------------


/**
 * GET /api/ycompany/entregas?status=&q=&limit=
 * Lista geral para a tela YCompany
 */
router.get("/entregas", async (req, res) => {
  try {
    const c = await col();
    const { status, q, limit = "500" } = req.query;

    const filter = {};
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

    res.json({ ok: true, total: data.length, data });
  } catch (e) {
    console.error("YCompany list error:", e);
    res.status(500).json({ ok: false, error: "Erro ao buscar entregas" });
  }
});

/**
 * PATCH /api/ycompany/entregas/:processo
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
    console.error("YCompany edit error:", e);
    res.status(500).json({ ok: false, error: "Erro ao editar entrega" });
  }
});

/**
 * PATCH /api/ycompany/entregas/:processo/atribuir-motorista
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
    console.error("YCompany assign error:", e);
    res.status(500).json({ ok: false, error: "Erro ao atribuir motorista" });
  }
});

/**
 * GET /api/ycompany/relatorio-contratado
 * Retorna TODOS os dados de ycompany (sem filtro de data no backend)
 * O filtro será feito no FRONTEND
 */
router.get("/relatorio-contratado", async (req, res) => {
  try {
    const c = await col();
    
    // Buscar TODOS os dados sem filtro (filtragem será no frontend)
    const dados = await c
      .find({})
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
      dados
    });
  } catch (e) {
    console.error("YCompany relatório error:", e);
    res.status(500).json({ ok: false, error: "Erro ao gerar relatório", details: e.message });
  }
});

/**
 * GET /api/ycompany/contratados-unicos
 * Retorna lista de contratados únicos para o filtro
 */
router.get("/contratados-unicos", async (req, res) => {
  try {
    const c = await col();
    const contratados = await c.distinct("contratado", { contratado: { $ne: null, $ne: "" } });
    res.json({ ok: true, contratados: contratados.sort() });
  } catch (e) {
    console.error("YCompany contratados error:", e);
    res.status(500).json({ ok: false, error: "Erro ao buscar contratados" });
  }
});

module.exports = router;