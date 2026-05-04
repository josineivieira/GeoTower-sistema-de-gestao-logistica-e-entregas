const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
const auth = require("../middleware/auth");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGO_DB || "delivery-docs";
const COLLECTION_NAME = "controle_protocolos";

// Função auxiliar para conectar ao MongoDB
async function getDatabase() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI não configurado");
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client.db(DB_NAME);
}

/**
 * GET /api/controle-protocolos
 * Lista todos os protocolos com filtro opcional por processo
 */
router.get("/", auth, async (req, res) => {
  let client;
  try {
    const { q: searchTerm } = req.query;
    console.log('📋 GET /controle-protocolos', { searchTerm });

    const mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Construir filtro
    let filter = {};
    if (searchTerm && searchTerm.trim()) {
      filter = {
        $or: [
          { processo: { $regex: searchTerm, $options: "i" } },
          { container: { $regex: searchTerm, $options: "i" } },
          { embarcador: { $regex: searchTerm, $options: "i" } },
          { destinatario: { $regex: searchTerm, $options: "i" } }
        ]
      };
    }

    // Buscar dados
    const protocolos = await collection
      .find(filter)
      .sort({ _id: -1 })
      .limit(1000)
      .toArray();

    await mongoClient.close();

    res.json({
      success: true,
      data: protocolos || [],
      count: protocolos.length
    });
  } catch (error) {
    console.error("❌ Erro ao buscar controle de protocolos:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar dados de protocolos",
      error: error.message
    });
  }
});

/**
 * GET /api/controle-protocolos/:id
 * Busca um protocolo específico por ID
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const protocolo = await collection.findOne({ _id: id });
    await mongoClient.close();

    if (!protocolo) {
      return res.status(404).json({
        success: false,
        message: "Protocolo não encontrado"
      });
    }

    res.json({
      success: true,
      data: protocolo
    });
  } catch (error) {
    console.error("❌ Erro ao buscar protocolo:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar protocolo",
      error: error.message
    });
  }
});

module.exports = router;
