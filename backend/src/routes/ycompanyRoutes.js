const express = require("express");
const router = express.Router();
const ycompanyController = require("../controllers/ycompanyController");
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI; // ⚠️ no Render tem que ser esse nome
const DB_NAME = process.env.MONGO_DB || "delivery-docs";
const COLLECTION = process.env.MONGO_COLLECTION || "basegeomars";

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
    res.json({ ok: true, count: data.length, data });
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
    res.json({ ok: true, count: data.length, data });
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

module.exports = router;