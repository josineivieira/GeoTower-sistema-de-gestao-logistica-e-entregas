# 📚 TROUBLESHOOTING GUIDE - SOLUÇÕES RÁPIDAS

## 🔴 ERRO: "Cannot find module '../services/deliveryService'"

### Sintoma
```
Error: Cannot find module '../services/deliveryService'
    at Function.Module._resolveFilename
```

### Causa
Arquivo não foi criado ou caminho incorreto

### Solução

```bash
# 1. Verificar se arquivo existe:
ls backend/src/services/deliveryService.js

# 2. Se não existir, recriá-lo:
# Copiar conteúdo de PERFORMANCE_OPTIMIZATION_GUIDE.md
# ou re-gerar do repositório

# 3. Se existir mas caminho errado:
# Verificar import no route está correto:
const deliveryService = require('../services/deliveryService');
# ^ Contagem correta de ../

# 4. Se em subfolder diferente:
const deliveryService = require('../../services/deliveryService');
# Adicionar ../ a mais
```

---

## 🔴 ERRO: "Schema hasn't been registered for model"

### Sintoma
```
SchemaTypeError: Unknown field when sorting
```

### Causa
Campo usado em sortBy não existe no schema

### Solução

```javascript
// ERRADO:
sortBy: 'invalid_field_name'

// CERTO (campos que existem):
sortBy: 'createdAt'        // ✓ Existe
sortBy: 'status'           // ✓ Existe
sortBy: 'deliveryNumber'   // ✓ Existe

// Ver todos os campos em backend/src/models/Delivery.js
```

---

## 🔴 ERRO: "Query timeout (1000ms exceeded)"

### Sintoma
```
MongooseError: Operation 'find' timed out after 1000ms
```

### Causa
Query sem índice em coleção grande, ou índice ainda não criado

### Solução

**Verificar Índices:**

```bash
# Terminal MongoDB
db.deliveries.getIndexes()

# Esperado output:
# _id_
# cityCode_1
# status_1
# createdAt_-1
# cityCode_1_status_1
# ... etc
```

**Se Índices não existem:**

```bash
# Opção A: Mongoose recria automaticamente
# No server.js:
await Delivery.syncIndexes();

# Opção B: Criar manual
db.deliveries.createIndex({ cityCode: 1 })
db.deliveries.createIndex({ status: 1 })
db.deliveries.createIndex({ createdAt: -1 })
```

**Se ainda timeout:**

```javascript
// Adicionar timeout customizado
const query = Delivery.find({ cityCode })
  .lean()
  .maxTimeMS(5000);  // 5 segundos ao invés de 1

const result = await query;
```

---

## 🟡 AVISO: "⚠️ SLOW_QUERY [234ms] find"

### Sintoma
```
⚠️ SLOW_QUERY [234ms] find (deliveries) with filter: { driverId: "..." }
```

### Causa Provável
Query sem índice appropriado ou filtro ineficiente

### Solução

```javascript
// Se é query sem índice composto, adicionar:
// Em backend/src/models/Delivery.js:

deliverySchema.index({ driverId: 1, cityCode: 1 });
// ou
deliverySchema.index({ driverId: 1, status: 1, createdAt: -1 });

// Depois sync:
await Delivery.syncIndexes();
```

---

## 🔴 ERRO: "Cannot read property 'map' of undefined"

### Sintoma
```
TypeError: Cannot read property 'map' of undefined
    at Object.<anonymous> (/backend/src/routes/admin.js:123)
```

### Causa
Retorno do serviço é diferente do esperado

### Solução

```javascript
// Verificar o que deliveryService retorna:
const result = await deliveryService.getStatistics(...);
console.log(result);  // Ver estrutura exata

// Esperado:
{
  total: 100,
  submitted: 20,
  pending: 30,
  ...
}

// Depois usar corretamente:
res.json({ statistics: result });
// E não:
res.json(result.map(...))  // ❌ result não é array
```

---

## 🔴 ERRO: "MongoError: E11000 duplicate key error"

### Sintoma
```
MongoError E11000 duplicate key error collection: ... duplicate key: ...
```

### Causa
Tentou criar índice unique mas dados duplicados existem

### Solução

```bash
# 1. Identificar campo duplicado:
db.deliveries.aggregate([
  { $group: { _id: "$fieldName", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])

# 2. Remover duplicatas ou aceitar duplicatas:
db.deliveries.dropIndex("index_name")

# 3. Recriar índice SEM unique:
db.deliveries.createIndex({ fieldName: 1 })
# E não:
db.deliveries.createIndex({ fieldName: 1 }, { unique: true })
```

---

## 🟡 AVISO: "Memory usage 85%"

### Sintoma
```
⚠️ Memory usage: 85% (512MB / 600MB)
```

### Causa
Consultando muito dados com `find()` sem `.lean()` ou limite

### Solução

**Usar .lean():**

```javascript
// ANTES (usa muita memória):
const deliveries = await Delivery.find({ cityCode }).populate('driver');
// Cada doc = instância Mongoose

// DEPOIS (usa 60% menos memória):
const deliveries = await Delivery.find({ cityCode })
  .lean()  // ← Retorna plain objects
  .limit(100);
```

**Ou usar paginação:**

```javascript
// ANTES:
const all = await Delivery.find({ cityCode });  // 10k docs em memória

// DEPOIS:
const page1 = await Delivery.find({ cityCode })
  .lean()
  .limit(50)
  .skip(0);  // Apenas 50 por página
```

---

## 🟡 AVISO: "Response time 2.3s (expected < 500ms)"

### Sintoma
Rota otimizada ainda retorna lentamente

### Diagnóstico

```javascript
// No route, adicionar logging:
console.time('query');
const result = await deliveryService.getStatistics(...);
console.timeEnd('query');

// Output:
query: 234ms  // Se > 500ms, problema é no serviço
```

```bash
# Ou verificar MongoDB logs:
db.setProfilingLevel(1, { slowms: 100 })
# Depois rerun query e ver em:
db.system.profile.find().sort({ ts: -1 }).limit(5)
```

### Soluções

1. **Índice não criado:**
   ```bash
   db.deliveries.getIndexes()
   # Se falta, criar com syncIndexes()
   ```

2. **Filtro muito amplo:**
   ```javascript
   // RUIM: Traz todos, depois filtra em JS
   const docs = await Delivery.find({});
   const filtered = docs.filter(d => d.status === 'submitted');
   
   // BOM: Filtra no banco de dados
   const docs = await Delivery.find({ status: 'submitted' });
   ```

3. **Falta de .select():**
   ```javascript
   // RUIM: Retorna todos os campos (inclui data pesados)
   const docs = await Delivery.find({ cityCode });
   
   // BOM: Retorna apenas campos necessários
   const docs = await Delivery.find({ cityCode })
     .select('deliveryNumber status createdAt')
     .lean();
   ```

---

## 🔴 ERRO: "Frontend não recebe mais os dados"

### Sintoma
Frontend fazer request, recebe 200 OK mas dados estrutura mudou

### Causa
Novo formato de paginação não foi tratado no frontend

### Solução

**Verificar novo formato:**

```javascript
// OLD (retornava array direto):
{ 
  data: [...],
  status: "ok"
}

// NEW (retorna paginado):
{
  data: [...],
  pagination: {
    page: 1,
    pages: 5,
    total: 250,
    limit: 50
  }
}
```

**Atualizar frontend:**

```javascript
// ANTES:
const deliveries = response.data;

// DEPOIS:
const deliveries = response.data;
const { page, pages, total } = response.pagination;
```

---

## 🔴 ERRO: "401 Unauthorized after deployment"

### Sintoma
Admin consegue acessar em dev, mas retorna 401 em produção

### Causa
Token/Auth não funciona depois do deploy

### Solução

```bash
# 1. Verificar variáveis de ambiente:
# Em Render Dashboard → seu serviço → Environment
# Verificar se JWT_SECRET existe e está correto

# 2. Se JWT_SECRET mudou entre dev e prod:
# Tokens gerados em dev não funcionam em prod

# 3. Solução: Regenerar tokens em produção
# Ou usar mesmo JWT_SECRET em ambos

# 4. Se ainda erro, verificar logs:
# Render Dashboard → Logs → procurar por "auth" ou "401"
```

---

## 🟢 PERFORMANCE OK, MAS...

### Problema: Admin vê dados diferentes de Driver

### Solução: Verificar filtro de contratado

```javascript
// Verificar se está sendo aplicado:
const contratadobFilter = req.user?.role === 'gestor_contratado' 
  ? req.user.contratado 
  : null;

// Se null, vai retornar TUDO pro admin
// Se string, vai filtrar por contratado específico

// Isso é correto! ✓
```

### Problema: Busca de texto não funciona

### Solução: Habilitar search index

```bash
# No arquivo Delivery.js, deve ter:
deliverySchema.index({ 
  deliveryNumber: 'text',
  origin: 'text',
  destination: 'text'
});

# Depois sync:
await Delivery.syncIndexes();

# No route, usar:
const result = await Delivery
  .find({ $text: { $search: 'manaus' } })
  .lean();
```

---

## 📊 VERIFICAR SAÚDE DO SISTEMA

### Script de Check

```bash
#!/bin/bash

echo "🔍 Checando saúde do sistema..."

# 1. Servidor rodando?
curl -s http://localhost:5000/api/health | jq .
echo "✓ Servidor respondendo"

# 2. MongoDB conectado?
mongo --eval "db.adminCommand('ping')"
echo "✓ MongoDB respondendo"

# 3. Índices criados?
mongo app_database --eval "db.deliveries.getIndexes().length"
echo "✓ Índices criados"

# 4. Performance OK?
time curl -s http://localhost:5000/api/admin/statistics | jq .
echo "✓ Response < 1s"

echo "✅ Sistema OK!"
```

---

## 📈 MONITORAR CONTÍNUAMENTE

### Metrics Importantes

```javascript
// Em server.js, adicionar ao startup:
setInterval(() => {
  const used = process.memoryUsage();
  console.log(`
    📊 METRICS:
    Memory: ${Math.round(used.heapUsed / 1024 / 1024)}MB
    Uptime: ${(process.uptime() / 60).toFixed(1)} min
  `);
}, 60000);  // A cada minuto
```

---

## 🆘 PROBLEMA NÃO ESTÁ AQUI?

### Debug Step-by-Step

1. **Verificar logs completos:**
   ```bash
   # Em Render:
   Dashboard → Logs (todos)
   ```

2. **Testar em local primeiro:**
   ```bash
   npm run dev
   # Reproduzir erro localmente
   ```

3. **Isolate problema:**
   ```bash
   # Testar rota específica:
   curl http://localhost:5000/api/admin/statistics
   
   # Ver exato error:
   # Terminal do servidor vai mostrar stack trace
   ```

4. **Procurar em Google:**
   ```
   Copiar EXATO mensagem de erro
   + "mongoose" ou "mongodb"
   + "nodejs"
   ```

5. **Se não achar:**
   - Comentar linha suspeita
   - Testar novamente
   - Isolate qual linha quebra

---

## ✅ TUDO BEM? ÓTIMO!

Se nenhuma destes problemas, seu deployment foi sucesso! 🎉

Continue monitorando por 24-48 horas e depois:

1. ✅ Otimizar próximas 4 rotas (ver QUICK_START)
2. ✅ Re-testar com mais dados
3. ✅ Planejar Phase 2 (Redis, GraphQL)

---

**Boa sorte! 🚀**

