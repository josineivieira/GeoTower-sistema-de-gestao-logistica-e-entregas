# API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Adicione o token no header de todas as requisições autenticadas:
```
Authorization: Bearer {token}
```

---

## Auth Routes

### POST /auth/register
Registrar novo motorista

**Request:**
```json
{
  "name": "João Silva",
  "username": "joao.silva",
  "email": "joao@example.com",
  "password": "senha123",
  "phone": "(11) 98765-4321"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "driver": {
    "_id": "...",
    "name": "João Silva",
    "username": "joao.silva",
    "email": "joao@example.com",
    "role": "driver"
  }
}
```

---

### POST /auth/login
Login motorista

**Request:**
```json
{
  "username": "joao.silva",
  "password": "senha123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "driver": { ... }
}
```

---

### GET /auth/me
Obter dados do motorista atual

**Response:**
```json
{
  "success": true,
  "driver": { ... }
}
```

---

### PUT /auth/me
Atualizar perfil motorista

**Request:**
```json
{
  "name": "João Silva",
  "email": "joao.novo@example.com",
  "phone": "(11) 98765-4321"
}
```

---

### PUT /auth/change-password
Alterar senha

**Request:**
```json
{
  "currentPassword": "senha123",
  "newPassword": "nova_senha"
}
```

---

## Delivery Routes

### POST /deliveries
Criar nova entrega

**Request:**
```json
{
  "deliveryNumber": "PED-12345",
  "vehiclePlate": "ABC-1234",
  "observations": "Cliente não estava disponível"
}
```

**Response:**
```json
{
  "success": true,
  "delivery": {
    "_id": "...",
    "deliveryNumber": "PED-12345",
    "driverId": "...",
    "driverName": "João Silva",
    "vehiclePlate": "ABC-1234",
    "observations": "...",
    "status": "draft",
    "documents": {}
  }
}
```

---

### GET /deliveries
Listar entregas do motorista

**Query Parameters:**
- `status`: "draft", "submitted", "completed"
- `searchTerm`: buscar por número de entrega

**Response:**
```json
{
  "success": true,
  "deliveries": [ ... ]
}
```

---

### GET /deliveries/:id
Obter detalhes de uma entrega

---

### POST /deliveries/:id/documents/:documentType
Upload de documento (aceita múltiplos arquivos)

**documentType:** canhotNF, canhotCTE, diarioBordo, devolucaoVazio, retiradaCheio

**Form Data:**
- `file`: imagem do documento (JPEG, PNG, GIF, WebP). Pode enviar múltiplos campos `file` para anexar várias fotos de uma vez.

**Response:**
```json
{
  "success": true,
  "delivery": { ... }
}
```

**Nota:** Para tipos que aceitam múltiplas imagens (por exemplo `canhotNF`, `diarioBordo`, `canhotCTE`), o campo `delivery.documents.<type>` retornado será um array de caminhos. Para remover uma imagem do documento, use o endpoint DELETE correspondente.

---

### POST /deliveries/:id/submit
Enviar entrega (todos os 5 documentos obrigatórios)

**Response:**
```json
{
  "success": true,
  "delivery": {
    ...
    "status": "submitted",
    "submittedAt": "2024-01-19T10:30:00Z"
  }
}
```

---

### DELETE /deliveries/:id/documents/:documentType/:index
Remover um arquivo anexado ao documento (por índice). Para tipos com múltiplos arquivos, informe o índice (0-based) a ser removido.

**Resposta:**
```json
{
  "success": true,
  "delivery": { ... }
}
```

---

### DELETE /deliveries/:id
Deletar entrega (apenas rascunho)

---

## Admin Routes
Requer autenticação e role `admin`

### GET /admin/deliveries
Listar todas as entregas enviadas

**Query Parameters:**
- `driverId`: filtrar por motorista
- `startDate`: data inicial (YYYY-MM-DD)
- `endDate`: data final (YYYY-MM-DD)
- `searchTerm`: buscar por nº entrega ou motorista
- `status`: status da entrega

---

### GET /admin/statistics
Obter estatísticas

**Query Parameters:**
- `period`: "day", "week", "month"

**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalDeliveries": 42,
    "deliveriesByDriver": [
      { "_id": "João Silva", "count": 15 },
      { "_id": "Maria Santos", "count": 12 }
    ],
    "dailyDeliveries": [
      { "_id": "2024-01-19", "count": 5 },
      { "_id": "2024-01-18", "count": 7 }
    ]
  }
}
```

---

### GET /admin/deliveries/:id
Obter detalhes da entrega (admin)

---

### GET /admin/deliveries/:id/documents/:documentType/download
Download documento

---

### GET /admin/drivers/:driverId
Obter detalhes motorista (admin)

---

## Manager Routes (User Management)
Requer autenticação e role `manager` ou `admin`

### GET /admin/users
Listar todos os usuários

**Response:**
```json
{
  "users": [
    {
      "_id": "user_id",
      "username": "gerente",
      "email": "gerente@test.com",
      "name": "Gerente da Entrega",
      "role": "manager"
    }
  ]
}
```

---

### POST /admin/users
Criar novo usuário

**Request:**
```json
{
  "username": "novo_usuario",
  "email": "novo@test.com",
  "name": "Novo Usuário",
  "password": "senha123",
  "role": "driver"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Usuário criado com sucesso",
  "user": { ... }
}
```

---

### PUT /admin/users/:id
Atualizar usuário

**Request:**
```json
{
  "email": "novo@email.com",
  "name": "Nome Atualizado",
  "role": "manager"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Usuário atualizado com sucesso"
}
```

---

### DELETE /admin/users/:id
Deletar usuário

**Response:**
```json
{
  "success": true,
  "message": "Usuário deletado com sucesso"
}
```

---

## Error Responses

```json
{
  "success": false,
  "message": "Descrição do erro"
}
```

### Common Status Codes
- `200`: OK
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error
