# DELIVERY MODEL - REFERÊNCIA COMPLETA

**Data:** March 18, 2026  
**Escopo:** Todas as rotas, controllers, queries e relacionamentos do modelo Delivery

---

## 1️⃣ MODELO/SCHEMA

### Definição
**Arquivo:** [backend/src/models/Delivery.js](backend/src/models/Delivery.js) (63 linhas)

```javascript
const DeliverySchema = new mongoose.Schema({
  deliveryNumber: { type: String, required: true },
  vehiclePlate: { type: String, default: "" },
  observations: { type: String, default: "" },
  driverName: { type: String, default: "" },
  status: { 
    type: String, 
    enum: ['pending', 'submitted', 'AGENDADO', 'CONTAINER_MONTADO', 'AGUARDANDO_DESOVA',
           'EM_DESOVA', 'AGUARDANDO_ANEXO', 'ANEXANDO_DOCUMENTOS_FINAIS', 'EM_ROTA',
           'ENTREGUE', 'CANCELADO', 'A_CAMINHO_DO_CLIENTE', 'ENTREGUE_COM_PENDENCIA_CANHOTO',
           'FINALIZADO'],
    default: 'pending' 
  },
  arrivedAt: { type: Date },
  containerMontadoAt: { type: Date },
  desovaStartAt: { type: Date },
  desovaEndAt: { type: Date },
  horarioDevolucaoVazio: { type: Date },
  recebedor: { type: String, default: "" },
  submissionObservation: { type: String, default: "" },
  submissionForce: { type: Boolean, default: false },
  missingDocumentsAtSubmit: { type: [String], default: [] },
  documentsJustification: { type: String, default: "" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userName: { type: String, default: "" },
  userEmail: { type: String, default: "" },
  deliveryDate: { type: Date, default: Date.now },
  documents: {
    canhotNF: { type: String, default: null },
    canhotCTE: { type: String, default: null },
    diarioBordo: { type: String, default: null },
    devolucaoVazio: { type: String, default: null },
    retiradaCheio: { type: String, default: null },
    chegadaCliente: { type: String, default: null },
    inicioDesova: { type: String, default: null },
    fimDesova: { type: String, default: null },
  }
}, { timestamps: true });
```

---

## 2️⃣ ROTAS HTTP

### A. DRIVER/USER ROUTES

**Arquivo Base:** [backend/src/routes/delivery.js](backend/src/routes/delivery.js) (755+ linhas)

#### 1. POST /api/deliveries - Criar Entrega
- **Linha:** 56
- **Auth:** `auth` middleware
- **Request Body:**
  ```javascript
  {
    deliveryNumber: String (obrigatório),
    vehiclePlate: String,
    observations: String,
    driverName: String,
    containerMontadoAt: Date,
    status: String
  }
  ```
- **Responsabilidades:**
  - Cria delivery (linha 72)
  - Sincroniza com ProgramacaoEntrega (linha 91-104)
  - Sincroniza com Icompany (linha 110-147)
- **Response:** `{ delivery }`
- **Errors:** 400 se sem deliveryNumber

#### 2. GET /api/deliveries - Listar Entregas do Driver
- **Linha:** 157
- **Auth:** `auth` middleware
- **Query Params:**
  - `q`: Search term (deliveryNumber, driverName, vehiclePlate)
- **Filtros:** (linha 169-178)
  - deliveryNumber (regex)
  - driverName
  - vehiclePlate
- **Sort:** Por createdAt descendente (linha 181)
- **Response:** `{ deliveries: [] }`

#### 3. GET /api/deliveries/:id - Buscar Entrega
- **Linha:** 193
- **Auth:** `auth` middleware
- **Validação:** (linha 201)
  - Drivers só podem ver suas próprias
  - Admins veem todas
- **Response:** `{ delivery: {...} }`
- **Errors:** 404 se não encontrada

#### 4. PUT /api/deliveries/:id - Atualizar Entrega
- **Linha:** 213
- **Auth:** `auth` middleware
- **Request Body:** Qualquer campo
- **Processamento:**
  1. Busca delivery (linha 220)
  2. Atualiza campos (linha 223-340)
  3. Sincroniza com ProgramacaoEntrega (linha 233-260)
  4. Sincroniza com Icompany (linha 270-320)
- **Response:** `{ delivery: {...} }`
- **Errors:** 404 se não encontrada

#### 5. POST /api/deliveries/:id/documents/:type - Upload Documento
- **Linha:** 417
- **Auth:** `auth` middleware
- **Tipos de Documento:**
  - canhotNF, canhotCTE, diarioBordo, devolucaoVazio
  - retiradaCheio, chegadaCliente, inicioDesova, fimDesova
- **Storage:**
  - Disk: `uploads/<city>/<deliveryNumber>/`
  - S3: `uploads/<deliveryNumber>/<filename>`
- **Processamento:** (linha 425-561)
  1. Encontra delivery
  2. Processa múltiplos arquivos
  3. Salva em S3 ou disk
  4. Atualiza delivery.documents
- **Response:** `{ delivery: {...} }`

#### 6. DELETE /api/deliveries/:id/documents/:type/:index - Remover Documento
- **Linha:** 580
- **Auth:** `auth` middleware
- **Processamento:** (linha 586-644)
  1. Encontra delivery
  2. Remove arquivo do S3 ou disk
  3. Atualiza array de docs
- **Response:** `{ delivery: {...} }`

#### 7. POST /api/deliveries/:id/submit - Submeter Entrega
- **Linha:** 655
- **Auth:** `auth` middleware
- **Request Body:**
  ```javascript
  {
    force: Boolean (opcional),
    observation: String (opcional)
  }
  ```
- **Validação:** (linha 702)
  - Verifica documentos obrigatórios
  - Se `force=true`, ignora faltantes
- **Processamento:** (linha 715-726)
  1. Registra missingDocumentsAtSubmit
  2. Muda status para 'submitted'
- **Response:** `{ success, message, delivery }`

#### 8. DELETE /api/deliveries/:id - Deletar Entrega
- **Linha:** 735
- **Auth:** `auth` middleware
- **Validação:** Só deleta se status='pending' (linha 745)
- **Limpeza:**
  - Remove arquivos via deleteDeliveryFiles() (linha 751)
  - Deleta registro do DB (linha 757)
- **Response:** `{ message, delivery }`

---

### B. ADMIN ROUTES

**Arquivo Base:** [backend/src/routes/admin.js](backend/src/routes/admin.js) (1500+ linhas)

#### 1. GET /api/admin/statistics - Estatísticas Gerais
- **Linha:** 45
- **Auth:** `auth` + `onlyAdmin`
- **Dados Retornados:**
  - `totalDeliveries`: total de entregas
  - `submitted`: count status='submitted'
  - `pending`: count status='pending'
  - `deliveriesByDriver`: agrupado por userName
  - `dailyDeliveries`: agrupado por data
- **Response:** `{ totalDeliveries, submitted, pending, deliveriesByDriver, dailyDeliveries }`

#### 2. GET /api/admin/deliveries - Listar Entregas com Programações
- **Linha:** 107
- **Auth:** `auth` + `onlyAdmin`
- **Query Params:**
  - `status`: delivery status
  - `q`: search term
  - `startDate`, `endDate`: range
  - `period`: day/week/month
  - `periodDate`: data para período
- **Processamento:** (linha 110-310)
  1. Busca todas entregas (linha 138)
  2. Normaliza para resposta (linha 142-144)
  3. Junta com ProgramacaoEntrega (linha 165-220)
  4. Aplica filtros (linha 226-276)
  5. Adiciona info de arquivos (linha 279-304)
- **Response:** `{ deliveries: [...] }`

#### 3. GET /api/admin/deliveries/:id - Detalhes da Entrega
- **Linha:** 321
- **Auth:** `auth` + `onlyAdmin`
- **Lookup:** Por `_id` ou `deliveryNumber` (linha 324-327)
- **Normalização:** Via normalizeDeliveryForResponse() (linha 334)
- **Response:** `{ delivery: {...} }`
- **Errors:** 404 se não encontrada

#### 4. GET /api/admin/deliveries/:id/documents/:documentType/download - Download Documento
- **Linha:** 347
- **Auth:** `auth` + `onlyAdmin`
- **Busca em Múltiplos Caminhos:** (linha 495-514)
  - `uploads/<deliveryNumber>/<filename>`
  - `uploads/<city>/<deliveryNumber>/<filename>`
  - S3 storage
- **Response:** Arquivo (blob)
- **Timeout:** 120 segundos

#### 5. GET /api/admin/deliveries/:id/documents/zip - Download ZIP
- **Linha:** 564
- **Auth:** `auth` + `onlyAdmin`
- **Conteúdo:**
  - Zipado: `deliveryNumber/filename` (linha 657, 694)
  - Todos os documentos
- **Response:** ZIP file
- **Filename:** `<deliveryNumber>_documents.zip` (linha 623)
- **Timeout:** 120 segundos

#### 6. PUT /api/admin/deliveries/:id - Atualizar Entrega (Admin)
- **Linha:** 735
- **Auth:** `auth` + `onlyAdmin`
- **Campos Suportados:**
  - deliveryNumber, userName, driverName, vehiclePlate
  - observations, status, todos os timestamps
- **Lookup:** Por `_id` ou `deliveryNumber` (linha 750-752)
- **Processamento:** (linha 740-805)
  1. Busca delivery
  2. Monta object de updates (linha 761-795)
  3. Atualiza DB (linha 799)
  4. Retorna resultado
- **Response:** `{ success, delivery, message }`
- **Errors:** 404 se não encontrada

#### 7. DELETE /api/admin/deliveries/:id - Deletar Entrega (Admin)
- **Linha:** 816
- **Auth:** `auth` + `onlyAdmin`
- **Processamento:** (linha 822-840)
  1. Busca delivery
  2. Remove arquivos via deleteDeliveryFiles() (linha 830)
  3. Deleta DB (linha 837)
- **Response:** `{ message, success, delivery }`
- **Errors:** 404 se não encontrada

---

## 3️⃣ QUERIES E FIND()

### A. Database Interface (db.js ou Mongoose)

**Arquivo:** [backend/src/db.js](backend/src/db.js)

| Método | Uso |
|--------|-----|
| `findDeliveryById(id)` | L141 - Busca por ID (SQLite) |
| `createDelivery(delivery)` | L145 - Insere entrega |
| `updateDelivery(id, updates)` | L155 - Atualiza campos |
| `deleteDelivery(id)` | L182 - Deleta entrega |
| `db.find("deliveries", {})` | Multiple - Busca todas |
| `db.findById("deliveries", id)` | Multiple - Busca por ID |
| `db.findOne("deliveries", query)` | Multiple - Busca primeira |
| `db.create("deliveries", data)` | Multiple - Cria |
| `db.updateOne(..., updates)` | Multiple - Atualiza |
| `db.deleteOne(..., query)` | Multiple - Deleta |

### B. Queries Específicas no Código

**Admin Routes (admin.js):**
- L48: `db.find("deliveries", {})` - Estatísticas
- L138: `db.find("deliveries", {})` - GET deliveries
- L324: `db.findById("deliveries", req.params.id)` - GET delivery/:id
- L327: `db.findOne("deliveries", { deliveryNumber: ... })` - Fallback por number
- L357: `db.findById("deliveries", id)` - Download doc
- L570: `db.findById('deliveries', id)` - Download ZIP
- L750: `db.findById("deliveries", req.params.id)` - PUT delivery/:id
- L752: `db.findOne("deliveries", { deliveryNumber: ... })` - Fallback lookup
- L799: `db.updateOne("deliveries", { _id: targetId }, updates)` - Update
- L822: `db.findById("deliveries", id)` - DELETE
- L837: `db.deleteOne("deliveries", { _id: id })` - Deleta
- L1099: `db.find('deliveries', {})` - Health check
- L1436: `db.find("deliveries", {})` - Sync com programação
- L1445: `.find(d => String(d._id) === ...)` - Busca em array

**Delivery Routes (delivery.js):**
- L72: `db.create("deliveries", {...})` - POST create
- L179: `db.find("deliveries", query)` - GET lista
- L198: `db.findById("deliveries", req.params.id)` - GET by ID
- L220: `db.findById("deliveries", id)` - PUT update
- L233: `db.findOne("deliveries", query)` - Busca por deliveryNumber
- L325,342: `db.updateOne("deliveries", ...)` - Update documents
- L425: `db.findById("deliveries", id)` - POST documents
- L561: `db.updateOne("deliveries", ...)` - Update docs
- L586: `db.findById('deliveries', id)` - DELETE document
- L662: `db.findById('deliveries', req.params.id)` - POST submit
- L717,724: `db.updateOne('deliveries', ...)` - Update status
- L742: `db.findById("deliveries", req.params.id)` - DELETE entrega
- L757: `db.deleteOne("deliveries", ...)` - Delete

**Reconciliation Routes (reconciliation.js):**
- L105: `.find(d => d.deliveryNumber === ...)` - Match delivery
- L176: `db.findOne('deliveries', { deliveryNumber: ... })` - Busca por number
- L178: `db.updateOne('deliveries', ...)` - Update status

### C. Queries em Scripts

**migrate_to_mongo.js:**
```javascript
const Delivery = require('../src/models/Delivery');
// Itera documentos de db.json e faz Delivery.create() para cada
```

**fix_delivery_userName.js (L21-23):**
```javascript
Delivery.find({ $or: [{ userName: { $in: ['', null] } }, { userName: 'Unknown' }] })
Delivery.updateOne({ _id }, { $set: { userName: newUserName } })
```

**sync-delivery-dates-to-icompany.js:**
```javascript
Delivery.findOneAndUpdate(...)
```

---

## 4️⃣ CONTROLLERS/HANDLERS UTILITÁRIOS

**Arquivo:** [backend/src/utils/storageUtils.js](backend/src/utils/storageUtils.js)

### deleteDeliveryFiles(delivery)
**Linha:** 16
```javascript
async function deleteDeliveryFiles(delivery) {
  const docs = delivery.documents || {};
  const city = delivery.city || 'manaus';
  
  // Remove arquivos S3 ou disk
  // Retorna { removed: [...] }
}
```

**Uso Em:**
- admin.js L830 - DELETE delivery
- delivery.js L751 - DELETE delivery

### normalizeDeliveryForResponse(delivery)
**Linha:** 53
```javascript
function normalizeDeliveryForResponse(delivery) {
  // Parse JSON strings
  // Estrutura filenames
  // Retorna delivery normalizado
}
```

**Uso Em:**
- admin.js L144, L334, L370, L804
- delivery.js L40, L183-184, L204, L364, L571

---

## 5️⃣ RELACIONAMENTOS

### 1. Delivery ↔ ProgramacaoEntrega

**Campos de Conexão:**
- `linkedDeliveryId` em ProgramacaoEntrega
- `deliveryNumber` em ambos (match case-insensitive)

**Sincronização Automática:**

**Arquivo:** [backend/src/routes/delivery.js](backend/src/routes/delivery.js)

**Na Criação (POST /deliveries):**
- Linhas 91-104:
  ```javascript
  // Busca programação por deliveryNumber (processo ou container)
  const prog = await ProgramacaoEntrega.findOne({
    $or: [
      { processo: new RegExp(`^${deliveryNumber}$`, 'i') },
      { container: new RegExp(`^${deliveryNumber}$`, 'i') }
    ]
  });
  
  if (prog) {
    prog.status = status === 'CONTAINER_MONTADO' ? 'CONTAINER_MONTADO' : 'EM_ROTA';
    prog.linkedDeliveryId = delivery._id;
    await prog.save();
  }
  ```

**Na Atualização (PUT /deliveries):**
- Linhas 233-260:
  1. Busca programação por deliveryNumber
  2. Atualiza status da programação
  3. Sincroniza linkedDeliveryId

**Arquivo:** [backend/src/routes/admin.js](backend/src/routes/admin.js)
- Linhas 165-220: Combina entregas com programações
- Linhas 1436-1462: Sincronização de linkedDeliveryId

### 2. Delivery ↔ Icompany

**Campos de Conexão:**
- `linkedIcompanyId` em Delivery
- Múltiplos campos de match: processo, numero, containerNumero, geomaritima, codigo

**Sincronização Automática:**

**Arquivo:** [backend/src/routes/delivery.js](backend/src/routes/delivery.js)

**Na Criação (POST /deliveries):**
- Linhas 110-147:
  ```javascript
  // Busca Icompany por múltiplos campos
  const icompanyRecord = await Icompany.findOne({
    $or: [
      { processo: new RegExp(`^${deliveryNum}$`, 'i') },
      { numero: new RegExp(`^${deliveryNum}$`, 'i') },
      { containerNumero: new RegExp(`^${deliveryNum}$`, 'i') },
      { geomaritima: new RegExp(`^${deliveryNum}$`, 'i') },
      { codigo: new RegExp(`^${deliveryNum}$`, 'i') },
      ... (sem regex)
    ]
  });
  
  if (icompanyRecord) {
    // Mapear campos de delivery para Icompany
    const icompanyUpdates = {...};
    await Icompany.updateOne({ _id: icompanyRecord._id }, icompanyUpdates);
  }
  ```

**Na Atualização (PUT /deliveries):**
- Linhas 270-320: Mesmo padrão

### 3. Delivery ↔ Driver (User)

**Campos de Conexão:**
- `userId`: mongoose.Schema.Types.ObjectId, ref: "User"
- `userName`: String (cópia do fullName)

**Script de Sincronização:**
- [backend/scripts/fix_delivery_userName.js](backend/scripts/fix_delivery_userName.js)
  - L21-25: Busca deliveries com userName vazio/Unknown
  - L26-32: Busca Driver pelo userId
  - L33: Atualiza userName

---

## 6️⃣ SCRIPTS QUE USAM DELIVERY

**Diretório:** [backend/scripts/](backend/scripts/)

### 1. migrate_to_mongo.js
**Linha:** 1-50+
**Uso:** Migração de SQLite/JSON para MongoDB + S3
```bash
MONGO_URI="..." S3_BUCKET=... node scripts/migrate_to_mongo.js --dry-run
```
**Operações:**
- Lê JSON de `backend/data/<city>/db.json`
- Cria `Delivery` documents
- Faz upload de arquivos para S3

### 2. fix_delivery_userName.js
**Linha:** 1-50+
**Uso:** Corrige userName para "Unknown"
```bash
MONGODB_URI='...' node scripts/fix_delivery_userName.js
```
**Operações:**
- Busca deliveries com userName vazio
- Busca driver associado
- Atualiza com fullName do driver

### 3. migrate_container_returned.js
**Descrição:** Migra campo de devolução de container

### 4. sync-delivery-dates-to-icompany.js
**Descrição:** Sincroniza datas de delivery com Icompany
**Operações:**
- L26: `Icompany.findById(delivery.linkedIcompanyId)`
- L61: `Delivery.findByIdAndUpdate(..., { linkedIcompanyId })`

### 5. fix_driverId.js
**Descrição:** Corrige relacionamento userId com Driver

### Outros Scripts Relacionados:
- **cleanOrphans.js** - Limpa orphaned deliveries
- **analyzeUploads.js** - Analisa estrutura de uploads
- **checkIcompany.js** - Verifica sincronização Icompany
- **validate-documents.js** - Valida documentos

---

## 7️⃣ SERVIÇOS FRONTEND

**Arquivo:** [frontend/src/services/authService.js](frontend/src/services/authService.js)

### Admin Delivery Service
```javascript
// Linhas 20-45
const adminService = {
  getDeliveries: (filters, statsPeriod, periodDate) => 
    api.get('/admin/deliveries', { params }),       // L23, 30
  
  getDeliveryDetails: (id) => 
    api.get(`/admin/deliveries/${id}`),             // L33
  
  updateDelivery: (id, data) => 
    api.put(`/admin/deliveries/${id}`, data),       // L34
  
  downloadDocument: (deliveryId, documentType) => 
    api.get(`/admin/deliveries/${deliveryId}/documents/${documentType}/download`, {...}),  // L38
  
  downloadZip: (deliveryId) => 
    api.get(`/admin/deliveries/${deliveryId}/documents/zip`, {...}),  // L42
  
  deleteDelivery: (id) => 
    api.delete(`/admin/deliveries/${id}`)           // L45
};
```

### Driver Delivery Service
```javascript
// Linhas 86-105
const deliveryService = {
  createDelivery: (data) => 
    api.post('/deliveries', data),                  // L86
  
  getMyDeliveries: (params) => 
    api.get('/deliveries', { params }),             // L87
  
  getProgramacoesAssigned: () => 
    api.get('/deliveries/programacoes/mine'),       // L90
  
  getDelivery: (id) => 
    api.get(`/deliveries/${id}`),                   // L91
  
  uploadDocument: (deliveryId, documentType, formData) => 
    api.post(`/deliveries/${deliveryId}/documents/${documentType}`, formData),  // L99
  
  deleteDocument: (deliveryId, documentType, index) => 
    api.delete(`/deliveries/${deliveryId}/documents/${documentType}/${index}`),  // L102
  
  submitDelivery: (id, data) => 
    api.post(`/deliveries/${id}/submit`, data),     // L103
  
  deleteDelivery: (id) => 
    api.delete(`/deliveries/${id}`),                // L104
  
  updateDelivery: (id, data) => 
    api.put(`/deliveries/${id}`, data)              // L105
};
```

---

## 8️⃣ PÁGINAS FRONTEND USANDO DELIVERY

**Diretório:** [frontend/src/pages/](frontend/src/pages/)

| Página | Uso | Linhas |
|--------|-----|--------|
| [ProgramadasEntregas.js](frontend/src/pages/ProgramadasEntregas.js) | Entregas programadas | 241+ |
| [NovaEntrega.js](frontend/src/pages/NovaEntrega.js) | Criar nova entrega | 95, 126, 164, 190 |
| [MinhasEntregas.js](frontend/src/pages/MinhasEntregas.js) | Listar entrregasdriver | - |
| [EntregasEmAndamento.js](frontend/src/pages/EntregasEmAndamento.js) | Entregas em rota | 30-31 |
| [EntregasCanhotosPendentes.js](frontend/src/pages/EntregasCanhotosPendentes.js) | Canhotos pendentes | 162+ |
| [EntregaEmRota.js](frontend/src/pages/EntregaEmRota.js) | Detalhe de rota | 24+ |
| [BaseDadosGeral.js](frontend/src/pages/BaseDadosGeral.js) | Base geral (admin) | 96-97 |
| [AdminDashboard.js](frontend/src/pages/AdminDashboard.js) | Dashboard admin | stats, filters |

---

## 9️⃣ TABELA RESUMIDA DE CAMPOS

| Campo | Tipo | Req | Descrição |
|-------|------|-----|-----------|
| _id | ObjectId | ✓ | Identificador (mongo) |
| deliveryNumber | String | **✓** | Container/Processo |
| vehiclePlate | String | - | Placa transportadora |
| observations | String | - | Observações gerais |
| driverName | String | - | Nome motorista |
| status | Enum | - | Estado (13 opções) |
| arrivedAt | Date | - | Chegada cliente |
| containerMontadoAt | Date | - | Montagem container |
| desovaStartAt | Date | - | Início desova |
| desovaEndAt | Date | - | Fim desova |
| horarioDevolucaoVazio | Date | - | Devolução container |
| recebedor | String | - | Receptor |
| submissionObservation | String | - | Obs submissão |
| submissionForce | Boolean | - | Forçou submissão |
| missingDocumentsAtSubmit | [String] | - | Docs faltantes |
| documentsJustification | String | - | Justificativa docs |
| userId | ObjectId | - | Ref Driver/User |
| userName | String | - | Nome usuário |
| userEmail | String | - | Email usuário |
| deliveryDate | Date | - | Data entrega |
| documents | Object | - | URLs documentos |
| createdAt | Date | ✓ | Criação |
| updatedAt | Date | ✓ | Última edição |

---

## 🔟 RELACIONAMENTOS VISUAIS

```
┌─────────────────────────────────────────────────────────────┐
│                         DELIVERY                             │
│  _id, deliveryNumber, vehiclePlate, status, documents, ...  │
└────────┬──────────────────┬──────────────────┬──────────────┘
         │                  │                  │
         │ linkedDeliveryId │ linkedIcompanyId │ userId
         ↓                  ↓                  ↓
    ProgrmaacaoEntrega  Icompany         User/Driver
    (status, container) (processo)      (fullName)
```

---

## 📋 SUMÁRIO DE LINHAS

### Rotas Principais
| Rota | Arquivo | Linha |
|------|---------|-------|
| POST /api/deliveries | delivery.js | 56 |
| GET /api/deliveries | delivery.js | 157 |
| GET /api/deliveries/:id | delivery.js | 193 |
| PUT /api/deliveries/:id | delivery.js | 213 |
| POST /api/deliveries/:id/documents/:type | delivery.js | 417 |
| DELETE /api/deliveries/:id/documents/:type/:index | delivery.js | 580 |
| POST /api/deliveries/:id/submit | delivery.js | 655 |
| DELETE /api/deliveries/:id | delivery.js | 735 |
| GET /api/admin/deliveries | admin.js | 107 |
| GET /api/admin/deliveries/:id | admin.js | 321 |
| GET /api/admin/deliveries/:id/documents/:type/download | admin.js | 347 |
| GET /api/admin/deliveries/:id/documents/zip | admin.js | 564 |
| PUT /api/admin/deliveries/:id | admin.js | 735 |
| DELETE /api/admin/deliveries/:id | admin.js | 816 |

### Modelo
| Item | Arquivo | Linha |
|------|---------|-------|
| DeliverySchema | Delivery.js | 3 |

### Utils
| Função | Arquivo | Linha |
|--------|---------|-------|
| deleteDeliveryFiles | storageUtils.js | 16 |
| normalizeDeliveryForResponse | storageUtils.js | 53 |

### Scripts
| Script | Diretório | Uso |
|--------|-----------|-----|
| migrate_to_mongo.js | backend/scripts/ | JSON → MongoDB |
| fix_delivery_userName.js | backend/scripts/ | Corrige userName |
| sync-delivery-dates-to-icompany.js | backend/scripts/ | Sincroniza datas |
| fix_driverId.js | backend/scripts/ | Corrige userId |

---

**Gerado:** March 18, 2026
**Versão:** 1.0
**Status:** Completo e atualizado
