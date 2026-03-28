# Novo Perfil: Gestor de Contratado

## Visão Geral
Um novo perfil de usuário que funciona como um "admin restrito" com acesso limitado a apenas **1 contratado específico**. Similar ao perfil **Geomar**, mas com permissões de gerenciamento.

---

## Especificação

### Nome do Perfil
**`gestor_contratado`** (ou `contractor_manager`)

### Estrutura de Dados

#### Campo no Driver (User Model)
```javascript
role: {
  type: String,
  enum: ['driver', 'manager', 'admin', 'geomar', 'gestor_contratado'],
  default: 'driver'
},
contratado: {
  type: String,  // EX: 'GEO', 'MACHADO', 'BANDEIRA', 'TRANSCAVALCANTE'
  trim: true,
  default: null
}
```

### Permissões

#### ✅ Telas que pode acessar (exatamente como GeoMar):
1. **AdminDashboard** (/admin) - Visualizar estatísticas do contratado
2. **MonitorEntregas** (/monitor-entregas) - Ver/editar entregas do contratado
3. **UserManagement** (/usuarios) - Visualizar usuários (acesso limitado conforme backend)
4. **MotoristaManagement** (/motoristas) - Gerenciar motoristas do contratado
5. **ProgramacaoManagement** (/programacoes) - Criar/editar programações do contratado
6. **BaseDadosGeral** (/base-dados-geral) - Ver dados gerais do contratado
7. **Icompany** (/icompany) - Dados Icompany filtrados do contratado
8. **RelatorioContratado** (/relatorio-contratado) - Relatórios do contratado

#### ❌ O que NÃO pode fazer:
1. Acessar dados de outros contratados
2. Criar/gerenciar usuários (sem acesso a botões de criar)
3. Gerenciar reconciliação (/reconciliacao)
4. Visualizar estatísticas globais do sistema
5. Acessar telas restritas apenas a admin/manager

---

## Implementação

### 1. Frontend - UserManagement.js

#### Atualizar ROLE_CONFIG:
```javascript
const ROLE_CONFIG = {
  admin:               { label: 'Admin',                color: 'red',      Icon: FaUserShield },
  manager:             { label: 'Gerente',              color: 'violet',   Icon: FaUserTie    },
  geomar:              { label: 'GeoMar',               color: 'teal',     Icon: FaGlobe      },
  gestor_contratado:   { label: 'Gestor Contratado',    color: 'amber',    Icon: FaBriefcase  },
  driver:              { label: 'Motorista',            color: 'blue',     Icon: FaCar        },
};
```

#### Atualizar formData com campo contratado:
```javascript
const [formData, setFormData] = useState({
  username: '',
  email: '',
  name: '',
  password: '',
  role: 'driver',
  contratado: null  // NOVO
});
```

#### Renderizar select de contratado no formulário:
- Mostrar dropdown de contratados apenas quando role === 'gestor_contratado'
- Preencher com lista de contratados disponíveis (GEO, MACHADO, BANDEIRA, etc)
- Obrigatório quando criando/editando gestor_contratado

### 2. Backend - Driver Model
```javascript
// Já existe, apenas confirmar:
contratado: {
  type: String,
  trim: true,
  default: null
}
```

### 3. Backend - Middleware (auth.js)

Adicionar middleware para verificar acesso por contratado:
```javascript
const restrictByContratado = (req, res, next) => {
  const user = req.user;
  
  // gestor_contratado só acessa dados do seu contratado
  if (user.role === 'gestor_contratado') {
    req.allowedContratado = user.contratado;
  } else if (user.role === 'manager') {
    // manager acessa todos
    req.allowedContratado = null;
  } else {
    // admin, geomar acesso total
    req.allowedContratado = null;
  }
  next();
};
```

### 4. Backend - Routes (admin.js)

#### Filtrar entregas por contratado:
```javascript
router.get("/deliveries", auth, restrictByContratado, async (req, res) => {
  // ... código existente ...
  
  // NOVO: Se gestor_contratado, filtrar por contratado
  if (req.user.role === 'gestor_contratado') {
    deliveries = deliveries.filter(d => 
      d.userName === req.user.contratado
    );
  }
});
```

#### Filtrar programações por contratado:
```javascript
router.get("/programacoes", auth, restrictByContratado, async (req, res) => {
  // ... código existente ...
  
  // NOVO: Se gestor_contratado, filtrar por contratado
  if (req.user.role === 'gestor_contratado') {
    programacoes = programacoes.filter(p => 
      p.contratado === req.user.contratado
    );
  }
});
```

#### Verificação no DELETE /programacoes/:id:
```javascript
const programacao = await ProgramacaoEntrega.findById(id);

// NOVO: Se gestor_contratado, verificar se é do seu contratado
if (req.user.role === 'gestor_contratado') {
  if (programacao.contratado !== req.user.contratado) {
    return res.status(403).json({ 
      message: 'Acesso negado - programação de outro contratado' 
    });
  }
}
```

### 5. Backend - Statistics (admin.js)

Atualizar endpoint /statistics:
```javascript
router.get("/statistics", auth, onlyAdmin, async (req, res) => {
  // ... código existente ...
  
  let filteredDeliveries = deliveries;
  
  // NOVO: Se gestor_contratado
  if (req.user.role === 'gestor_contratado') {
    filteredDeliveries = deliveries.filter(d => 
      d.userName === req.user.contratado
    );
  }
  
  // Usar filteredDeliveries ao invés de deliveries
  const totalDeliveries = filteredDeliveries.length;
  // ... resto do código ...
});
```

### 6. Backend - onlyAdmin() Middleware

Atualizar para incluir gestor_contratado:
```javascript
function onlyAdmin(req, res, next) {
  const role = req.user?.role || "operacao";
  // Libera acesso para admin, gestor, manager, geomar E gestor_contratado
  if (!['admin', 'gestor', 'manager', 'geomar', 'gestor_contratado'].includes(role)) {
    return res.status(403).json({ message: "Sem permissão" });
  }
  next();
}
```

---

## Fluxo de Uso

### 1. Criar novo Gestor de Contratado
- **Quem:** Manager ou Admin
- **Onde:** Tela Gerenciamento de Usuários
- **Como:**
  1. Botão "Novo Usuário"
  2. Preencher: Username, Email, Nome, Senha
  3. Selecionar Perfil: "Gestor Contratado"
  4. **NOVO:** Selecionar Contratado: "GEO" / "MACHADO" / "BANDEIRA" / etc
  5. Salvar

### 2. Gestor Contratado acessa sistema
- Login normalmente
- Dashboard mostra apenas dados do contratado atribuído
- Pode criar/editar/deletar entregas e programações
- Pode exportar relatórios do seu contratado
- **Não pode:** acessar dados de outros contratados, gerenciar usuários, ver estatísticas globais

### 3. Manager/Admin muda acesso
- Editar usuário com perfil "Gestor Contratado"
- Mudar campo "Contratado" para outro valor
- Salvar
- Usuário agora só acessa novo contratado

---

## Considerações de Validação

1. **Ao criar gestor_contratado:** obrigatório escolher um contratado válido
2. **Ao editar gestor_contratado:** pode mudar contratado
3. **Contratado inválido:** mostrar erro se contratado não existir na lista

---

## Exemplo de Contratados (baseado no mockdb)
```
- GEO
- MACHADO
- BANDEIRA
- TRANSCAVALCANTE
- [Mais conforme cadastrados no sistema]
```

---

## Resumo das Mudanças

| Arquivo | Mudanças |
|---------|----------|
| frontend/src/pages/UserManagement.js | Adicionar role "gestor_contratado" em ROLE_CONFIG, campo contratado no form |
| backend/src/middleware/auth.js | Novo middleware restrictByContratado |
| backend/src/routes/admin.js | Filtros por contratado em /deliveries, /programacoes, /statistics, etc |
| backend/src/models/Driver.js | Já existente (contratado field) |

