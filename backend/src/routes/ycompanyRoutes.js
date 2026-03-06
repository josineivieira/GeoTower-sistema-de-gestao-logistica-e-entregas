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
router.get('/', ycompanyController.getAll);
router.get('/search', ycompanyController.search);
router.get('/export', ycompanyController.export);
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