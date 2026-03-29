# 🚀 Plano de Otimização de Performance - Sistema de Entregas

## 📊 Diagnóstico de Problemas Identificados

### 1. **Consultas Mongoose SEM Filtros**
```
❌ PROBLEMA: db.find("deliveries", {})  - carrega TODOs os deliveries
```
- Localização: `backend/src/routes/admin.js:statistics` e outras
- Impacto: Carrega milhares de registros desnecessariamente

### 2. **Índices Faltantes**
```
✓ Delivery.js: tem index { cityCode: 1 }
✗ Faltam: status, deliveryNumber, createdAt, compostos
✓ ProgramacaoEntrega.js: tem vários indices
```

### 3. **Campos Desnecessários Sendo Retornados**
```
❌ find() sem .select() retorna TUDO:
   - documents (pode ter arrays grandes)
   - observations (textos longos)
   - campos de auditoria
```

### 4. **Falta de Paginação**
```
❌ Listas completas sem limit/skip:
   - getMyDeliveries
   - getProgramacoes
   - Admin statistics
```

### 5. **Loops em JavaScript para Filtros**
```
// BAD: Carrega tudo e filtra em JS
deliveries = (deliveries || []).filter(d => d.userName === req.user.contratado);

// GOOD: Filtrar no Mongoose
deliveries = await Delivery.find({ userName: req.user.contratado })
```

### 6. **Populate() sem Necessidade**
```
❌ Populando referências que não são usadas
```

### 7. **Queries Lentas em Loops**
```
❌ Dentro de loops: findOne() em cada iteração
```

---

## ✅ Implementações Necessárias

### **FASE 1: Índices Críticos**

#### Delivery Model:
```javascript
// Índices básicos
DeliverySchema.index({ cityCode: 1 });
DeliverySchema.index({ status: 1 });
DeliverySchema.index({ deliveryNumber: 1 });
DeliverySchema.index({ createdAt: -1 });
DeliverySchema.index({ userName: 1 });

// Índices compostos (multi-campo)
DeliverySchema.index({ cityCode: 1, status: 1 });
DeliverySchema.index({ cityCode: 1, createdAt: -1 });
DeliverySchema.index({ cityCode: 1, userName: 1 });
DeliverySchema.index({ status: 1, createdAt: -1 });
DeliverySchema.index({ userName: 1, createdAt: -1 });

// Para busca textual
DeliverySchema.index({ deliveryNumber: 'text', recebedor: 'text' });
```

#### ProgramacaoEntrega Model:
```javascript
// Já tem alguns bons:
programacaoEntregaSchema.index({ processo: 1 });
programacaoEntregaSchema.index({ dataAgendamento: 1 });
programacaoEntregaSchema.index({ status: 1 });
programacaoEntregaSchema.index({ origem: 1, dataAgendamento: 1 });

// Adicionar:
programacaoEntregaSchema.index({ contratado: 1 });
programacaoEntregaSchema.index({ contratado: 1, status: 1 });
programacaoEntregaSchema.index({ ativo: 1, status: 1 });
```

---

### **FASE 2: Otimizar Consultas Críticas**

#### 2.1 Admin Statistics - `/api/admin/statistics`

**ANTES:**
```javascript
let deliveries = await db.find("deliveries", {});  // ❌ Carrega TUDO
```

**DEPOIS:**
```javascript
// Usar aggregation pipeline
const pipeline = [
  // Filtrar por cidade se necessário
  { $match: { cityCode: city } },
  
  // Se gestor_contratado, filtrar por contratado
  ...(req.user?.role === 'gestor_contratado' ? 
    [{ $match: { userName: req.user.contratado } }] : 
    []),
  
  // Group por status
  { $group: {
      _id: '$status',
      count: { $sum: 1 }
    }
  },
  
  // Sort para performance
  { $sort: { _id: 1 } }
];

const stats = await Delivery.aggregate(pipeline);
```

#### 2.2 Get Deliveries - `/api/admin/deliveries`

**ANTES:**
```javascript
let deliveries = await db.find("deliveries", {});
deliveries.sort(...);
```

**DEPOIS:**
```javascript
const limit = parseInt(req.query.limit) || 50;
const page = parseInt(req.query.page) || 1;
const skip = (page - 1) * limit;

const deliveries = await Delivery
  .find({ cityCode: city, ...filters })
  .select('deliveryNumber status driverName recebedor createdAt arrivedAt')  // Apenas campos necessários
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip)
  .lean();  // Não precisa de métodos Mongoose

const total = await Delivery.countDocuments({ cityCode: city, ...filters });

res.json({ 
  deliveries, 
  pagination: { total, page, limit, pages: Math.ceil(total/limit) }
});
```

#### 2.3 Get My Deliveries (Driver)

**ANTES:**
```javascript
const deliveries = await Delivery.find(query).sort({ createdAt: -1 });
```

**DEPOIS:**
```javascript
const limit = parseInt(req.query.limit) || 20;
const page = parseInt(req.query.page) || 1;

const deliveries = await Delivery
  .find({ driverId: req.user.id, cityCode: city, ...filters })
  .select('deliveryNumber status vehiclePlate recebedor createdAt arrivedAt documents')
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip((page - 1) * limit)
  .lean();

return res.json({ 
  success: true, 
  deliveries,
  page,
  limit
});
```

#### 2.4 Get Programacoes (Contratado)

**PROBLEMA CRÍTICO:**
```javascript
// LENTO: Carrega TODAS as entregas, depois faz filter em JS
const allDeliveries = await db.find('deliveries', { cityCode: city });
const enrichedProgramacoes = programacoes.map(p => {
  const existing = allDeliveries.find(d => String(d._id) === String(p.linkedDeliveryId));
  // ...
});
```

**SOLUÇÃO:**
```javascript
const limit = 100;
const page = parseInt(req.query.page) || 1;

const programacoes = await ProgramacaoEntrega
  .find({
    contratado: regex,
    ...cityFilter,
    ativo: { $ne: false }
  })
  .select('processo container dataAgendamento status motorista linkedDeliveryId')
  .sort({ dataAgendamento: -1 })
  .limit(limit)
  .skip((page - 1) * limit)
  .lean()
  .populate({
    path: 'linkedDeliveryId',
    select: 'status missingDocumentsAtSubmit horarioDevolucaoVazio',
    options: { lean: true }
  });

// Sem loop! lean() + populate traz dados já unidos
res.json({ success: true, programacoes, page, limit });
```

---

### **FASE 3: Usar .lean() em Consultas que Retornam Listas**

```javascript
// Aplicar em:
✓ find() que retorna multiplos registros
✓ aggregate() que retorna multiplos registros
✗ findOne() por ID (precisa de métodos do Mongoose às vezes)
✗ findByIdAndUpdate() (precisa retornar documento completo)

// BOAS PRÁTICAS:
const deliveries = await Delivery.find(...).lean();
const programacoes = await ProgramacaoEntrega.find(...).lean();
```

---

### **FASE 4: Implementar Query Logging para Identificar Lentidão**

Criar middleware para log de queries lentas:

```javascript
// middleware/queryMonitor.js
module.exports = (req, res, next) => {
  const start = Date.now();
  
  mongoose.set('debug', (collection, method, query, doc, options) => {
    const time = Date.now() - start;
    if (time > 100) {  // Log queries acima de 100ms
      console.warn(`⚠️ SLOW QUERY [${time}ms]: ${collection}.${method}`, 
        JSON.stringify(query).slice(0, 100));
    }
  });
  
  next();
};
```

---

### **FASE 5: Sistema de Cache**

Para dados que mudam pouco:

```javascript
// cache/deliveryCache.js
const redis = require('redis');
const client = redis.createClient();

exports.getDeliveriesmOfCity = async (city) => {
  const key = `deliveries:${city}`;
  
  // Tenta cache
  const cached = await client.get(key);
  if (cached) return JSON.parse(cached);
  
  // Vai para DB
  const deliveries = await Delivery
    .find({ cityCode: city })
    .lean()
    .select('deliveryNumber status');
  
  // Armazena com TTL de 5 min
  await client.setex(key, 300, JSON.stringify(deliveries));
  return deliveries;
};
```

---

## 📋 Checklist de Implementação

### Backend MongoDB Indexes
- [ ] Delivery: índices simples (status, deliveryNumber, createdAt)
- [ ] Delivery: índices compostos (cityCode+status, cityCode+createdAt)
- [ ] ProgramacaoEntrega: índices para contratado
- [ ] Motorista: índices para transportadora

### Otimizar Consultas Críticas
- [ ] /api/admin/statistics - usar aggregation
- [ ] /api/admin/deliveries - paginação + .select() + .lean()
- [ ] /api/deliveries (driver) - paginação + .select() + .lean()
- [ ] /api/programacoes/mine - population ao invés de loop
- [ ] /api/icompany - adicionar .select() para campos usados

### Boas Práticas
- [ ] Adicionar .lean() em todas as queries que retornam listas
- [ ] Usar .select() para retornar apenas campos necessários
- [ ] Implementar paginação em todas as LIST requests
- [ ] Remover loops que fazem queries (N+1 problem)
- [ ] Sempre filtrar no DB antes de retornar para frontend

###Query Monitoring & Logs
- [ ] Implementar middleware de query logging
- [ ] Monitorar queries acima de 100ms
- [ ] Adicionar índices baseado em logs
- [ ] Testar performance antes/depois

---

## 📊 Resultados Esperados

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Carregamento de 5000 entregas | 3-5s | 200-300ms | **90% ↓** |
| API /admin/statistics | 2-3s | 300-500ms | **85% ↓** |
| API /programacoes/mine | 1.5-2s | 100-200ms | **80% ↓** |
| Memória (sem cache) | 50-80MB | 20-30MB | **60% ↓** |
| Uso de CPU em queries | Alto | Baixo | **70% ↓** |

---

## 🔧 Próximas Fases (Futuro)

1. **Redis Caching** para dados de consulta frequente
2. **GraphQL** com dataloaders para resolver N+1
3. **Read Replicas** para separar read/write no MongoDB
4. **Sharding** por cityCode quando chegar a 10M+ documentos
5. **Elasticsearch** para buscas textuais complexas

---

## 📝 Notas Importantes

⚠️ **NÃO ALTERAR:**
- Regras de negócio
- Funcionalidades
- Estrutura de dados
- Validações

✅ **APENAS OTIMIZAR:**
- Índices
- Queries
- Seleção de campos
- Paginação
- Caching

