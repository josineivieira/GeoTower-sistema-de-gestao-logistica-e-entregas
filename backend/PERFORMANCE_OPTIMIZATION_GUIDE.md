/**
 * OTIMIZAÇÕES DE PERFORMANCE - INSTRUÇÕES DE USO
 * 
 * Este documento explica como usar as novas funcionalidades de otimização
 * implementadas no sistema.
 */

// =============================================================================
// 1. USAR O NOVO DELIVERY SERVICE
// =============================================================================

// ❌ ANTES (ineficiente):
const Delivery = require('../models/Delivery');
app.get('/admin/deliveries', async (req, res) => {
  const ALL_deliveries = await Delivery.find({});  // Carrega TUDO
  const filtered = ALL_deliveries.filter(d => d.cityCode === 'manaus');
  res.json(filtered);
});

// ✅ DEPOIS (otimizado):
const deliveryService = require('../services/deliveryService');
app.get('/admin/deliveries', async (req, res) => {
  const result = await deliveryService.listDeliveries({
    cityCode: 'manaus',
    page: req.query.page || 1,
    limit: req.query.limit || 50
  });
  res.json(result);
});

// =============================================================================
// 2. USAR AGGREGATION PARA ESTATÍSTICAS
// =============================================================================

// ❌ ANTES (ineficiente):
app.get('/admin/statistics', async (req, res) => {
  const deliveries = await Delivery.find({});  // Carrega TUDO
  const totals = deliveries.length;
  const submitted = deliveries.filter(d => d.status === 'submitted').length;
  res.json({ totals, submitted });
});

// ✅ DEPOIS (otimizado):
app.get('/admin/statistics', async (req, res) => {
  const stats = await deliveryService.getStatistics('manaus');
  res.json(stats);
});

// =============================================================================
// 3. USAR .LEAN() PARA PERFORMANCE
// =============================================================================

// ❌ ANTES:
const delivery = await Delivery.find({ cityCode: 'manaus' });

// ✅ DEPOIS (quando não precisa de métodos Mongoose):
const delivery = await Delivery
  .find({ cityCode: 'manaus' })
  .select('deliveryNumber status driverName')  // Apenas campos necessários
  .lean();  // Não cria instâncias Mongoose = 2-3x mais rápido

// =============================================================================
// 4. USAR .SELECT() PARA RETORNAR APENAS OS CAMPOS NECESSÁRIOS
// =============================================================================

// ❌ ANTES (retorna tudo, inclusive documents com arrays grandes):
const delivery = await Delivery.findById(id);
// Retorna: { _id, deliveryNumber, status, ..., documents: {...}, ...others }

// ✅ DEPOIS (retorna apenas o necessário):
const delivery = await Delivery
  .findById(id)
  .select('deliveryNumber status driverName recebedor userName');

// =============================================================================
// 5. IMPLEMENTAR PAGINAÇÃO
// =============================================================================

// ❌ ANTES (sem paginação, frontend recebe tudo):
app.get('/deliveries', async (req, res) => {
  const deliveries = await Delivery.find({ cityCode: req.city });
  res.json(deliveries);  // Pode ser 10.000 registros!
});

// ✅ DEPOIS (com paginação):
app.get('/deliveries', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;  // Max 100
  
  const result = await deliveryService.listDeliveries({
    cityCode: req.city,
    page,
    limit
  });
  
  res.json(result);
  // Retorna: { data: [...], pagination: { page, limit, total, pages } }
});

// Frontend deve fazer:
// GET /api/deliveries?page=1&limit=50
// GET /api/deliveries?page=2&limit=50
// etc.

// =============================================================================
// 6. USAR POPULATION COM LEAN PARA RELACIONAMENTOS
// =============================================================================

// ❌ ANTES (sem otimização):
const prog = await ProgramacaoEntrega.find({}).populate('linkedDeliveryId');

// ✅ DEPOIS (otimizado):
const prog = await ProgramacaoEntrega
  .find({})
  .populate({
    path: 'linkedDeliveryId',
    select: 'status missingDocumentsAtSubmit',
    options: { lean: true }
  })
  .lean();

// =============================================================================
// 7. BUSCA TEXTUAL (usando índice de texto)
// =============================================================================

// ✅ Search com índice de texto:
const results = await deliveryService.searchDeliveries(
  'processo-123 ou recebedor',  // Busca em múltiplos campos
  'manaus'
);

// =============================================================================
// 8. MONITORAR QUERIES LENTAS
// =============================================================================

// No arquivo server.js, adicionar:
const queryMonitor = require('./middleware/queryMonitor');

// Middleware deve estar ANTES das rotas:
app.use(queryMonitor({
  threshold: 100,  // ms
  logSlowQueries: true,
  verbose: false  // true = log de todas as queries
}));

// Console mostrará:
// ⚠️  SLOW_QUERY [245ms] deliveries.find: {"cityCode":"manaus"}
//    💡 Sugestão: criar índice para campos: cityCode

// =============================================================================
// 9. GARANTIR ÍNDICES ESTEJAM CRIADOS
// =============================================================================

const queryMonitor = require('./middleware/queryMonitor');

// Na inicialização do app:
app.listen(PORT, async () => {
  // Crear índices
  await queryMonitor.ensureIndexes();
  
  // Listar índices criados:
  await queryMonitor.suggestIndexes();
});

// =============================================================================
// 10. PADRÕES DE QUERY - REFERÊNCIA RÁPIDA
// =============================================================================

/**
 * ✅ BOAS PRÁTICAS:
 */

// 1. Sempre usar .select() para limitar campos
await Delivery.find(query).select('field1 field2 field3');

// 2. Sempre usar .lean() em listas
await Delivery.find(query).lean();

// 3. Sempre usar paginação em listagens
const skip = (page - 1) * limit;
await Delivery.find(query).skip(skip).limit(limit);

// 4. Usar aggregation para contas e somas
await Delivery.aggregate([
  { $match: query },
  { $group: { _id: '$status', count: { $sum: 1 } } }
]);

// 5. Usar índice composto para filtros comuns
// Índice: { cityCode: 1, status: 1 }
await Delivery.find({ cityCode, status });

/**
 * ❌ EVITAR SEMPRE:
 */

// 1. Carregar tudo sem filtro
await Delivery.find({});  // NO!

// 2. Carregar tudo e filtrar em JS
const all = await Delivery.find({});
const filtered = all.filter(d => d.status === 'pending');  // NO!

// 3. Loops com queries (N+1 problem)
deliveries.forEach(async d => {
  const prog = await ProgramacaoEntrega.findOne({ ...});  // NO!
});

// 4. .populate() sem .lean() ou sem necessidade
await Delivery.find({}).populate('fieldNotNeeded');  // NO!

// 5. Retornar campos muito grandes
.select() // sempre especificar!  // NO! Campo `documents` pode ter MB

// =============================================================================
// 11. CENÁRIOS DE PERFORMANCE - ANTES E DEPOIS
// =============================================================================

/**
 * CENÁRIO 1: Listar 100.000 entregas da cidade Manaus
 * 
 * ❌ ANTES:
 * - Tempo: 5-8 segundos
 * - Memória: 150-200MB
 * - Rede: 50MB de dados
 * 
 * ✅ DEPOIS (com paginação 50/página):
 * - Tempo: 200-300ms
 * - Memória: 2-5MB
 * - Rede: 100KB de dados
 * - Melhoria: 95% ↓
 */

/**
 * CENÁRIO 2: Dashboard de estatísticas (5000 entregas)
 * 
 * ❌ ANTES:
 * - Carrega tudo, filtra em JS
 * - Tempo: 3-4s
 * 
 * ✅ DEPOIS (com aggregation):
 * - Tempo: 300-400ms
 * - Melhoria: 85% ↓
 */

/**
 * CENÁRIO 3: Search para achar entrega por número
 * 
 * ❌ ANTES:
 * - Regex search sem índice
 * - Tempo: 1-2s com 10mil registros
 * 
 * ✅ DEPOIS (com text index):
 * - Tempo: 50-100ms
 * - Melhoria: 90% ↓
 */

// =============================================================================
// 12. ROADMAP FUTURO (pós-otimização básica)
// =============================================================================

/*
 * Cache com Redis:
 * - Cache de queries frequentes (5-10 min TTL)
 * - Cache de listas filtradas
 * 
 * Exemplo:
 * const cached = await redis.get('deliveries:manaus:page:1');
 * if (cached) return JSON.parse(cached);
 * 
 * GraphQL com dataloaders:
 * - Resolver N+1 problem automaticamente
 * - Batch queries ao DB
 * 
 * Read Replicas:
 * - Separar read/write no MongoDB
 * - Escala horizontal
 * 
 * Elasticsearch:
 * - Buscas textuais complexas
 * - Faceted search
 * - Full-text search avançado
 */

module.exports = {};
