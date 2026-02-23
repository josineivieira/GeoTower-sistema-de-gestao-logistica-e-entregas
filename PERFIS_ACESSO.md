# 🔐 Perfis de Acesso do Sistema

## Resumo dos Perfis

O sistema GeoTransportes possui 4 perfis de usuário com diferentes níveis de acesso:

---

## 1. 👨‍💼 **MOTORISTA** (driver)

### Acesso:
- ✅ Minhas Entregas
- ✅ Entregas Programadas
- ✅ Novo registro de entrega
- ✅ Dados de contatos (footer)

### Permissões:
- Visualizar e registrar suas entregas
- Enviar documentos
- Ver histórico pessoal

### Restrições:
- ❌ Sem acesso a painel administrativo
- ❌ Sem acesso a gestão de usuários
- ❌ Sem edições de dados gerais

---

## 2. 👔 **GERENTE** (manager)

### Acesso:
- ✅ Painel Administrativo (Dashboard Analytics)
- ✅ Torre de Controle
- ✅ **Gerenciar Usuários**
- ✅ Cadastro de Motoristas
- ✅ Programação de Entregas

### Permissões:
- **EDIÇÃO TOTAL** em todos os módulos
- Criar e editar usuários
- Gerenciar cadastro de motoristas
- Editar programação de entregas
- Visualizar relatórios e analytics

### Restrições:
- ❌ Nenhuma restrição significativa

---

## 3. 🛡️ **ADMIN** (admin)

### Acesso:
- ✅ Painel Administrativo (Dashboard Analytics)
- ✅ Torre de Controle
- ✅ Cadastro de Motoristas
- ✅ Programação de Entregas

### Permissões:
- **EDITAR** e **VISUALIZAR** em todos os módulos acessíveis
- Editar dados de motoristas
- Editar programação de entregas
- Visualizar relatórios e analytics

### Restrições:
- ❌ **NÃO pode** gerenciar usuários
- ❌ **NÃO pode** criar novos perfis

---

## 4. 🌐 **GEOMAR** (geomar) - *NOVO*

### Acesso:
- ✅ Painel Administrativo (Dashboard Analytics) - **Apenas visualização**
- ✅ Torre de Controle - **Apenas visualização**
- ✅ Cadastro de Motoristas - **Apenas visualização**
- ✅ Programação de Entregas - **Apenas visualização**

### Permissões:
- **VISUALIZAR APENAS** (Read-only)
- Consultar relatórios
- Ver dados de motoristas
- Acompanhar entregas
- Analisar analytics

### Restrições:
- ❌ **SEM EDIÇÃO** em nenhum campo
- ❌ Não pode criar ou modificar dados
- ❌ Sem acesso a gerenciar usuários
- ❌ Interface bloqueada para edição

---

## 📋 Tabela Comparativa

| Funcionalidade | Motorista | Gerente | Admin | GeoMar |
|---|:---:|:---:|:---:|:---:|
| **Painel Administrativo** | ❌ | ✅ Edit | ✅ Edit | 👁️ Visualizar |
| **Torre de Controle** | ❌ | ✅ Edit | ✅ Edit | 👁️ Visualizar |
| **Gerenciar Usuários** | ❌ | ✅ Edit | ❌ | ❌ |
| **Cadastro de Motoristas** | ❌ | ✅ Edit | ✅ Edit | 👁️ Visualizar |
| **Programação de Entregas** | ❌ | ✅ Edit | ✅ Edit | 👁️ Visualizar |
| **Minhas Entregas** | ✅ | ❌ | ❌ | ❌ |
| **Entregas Programadas** | ✅ | ❌ | ❌ | ❌ |

---

## 🔑 Como Usar na Home.js

### Funções Helper Disponíveis:

```javascript
// Verifica se o usuário tem um dos roles especificados
hasAccess(['manager', 'admin', 'geomar'])

// Verifica se pode editar (Gerente ou Admin)
canEdit()

// Verifica se tem acesso visual apenas (GeoMar)
isViewOnly()

// Verifica se pode acessar painel administrative
canAccessAdminPanel()
```

### Exemplo de Uso:

```jsx
{/* Botão que só aparece para Gerente */}
{hasAccess(['manager']) && (
  <button onClick={() => navigate('/usuarios')}>
    Gerenciar Usuários
  </button>
)}

{/* Botão com restrição de edição para GeoMar */}
<button 
  disabled={isViewOnly()}
  title={isViewOnly() ? 'Apenas visualização' : ''}
>
  Editar
</button>
```

---

## 🚀 Valores de Role Esperados

Ao criar/editar usuários, use um destes valores no campo `role`:

- `driver` - Motorista
- `manager` - Gerente
- `admin` - Admin
- `geomar` - GeoMar

---

## 📝 Notas Importantes

- Os botões para GeoMar aparecem **desabilitados e com menor opacidade** para indicar "apenas visualização"
- As páginas acessadas por GeoMar devem ter **campos bloqueados para edição**
- No futuro, pode-se expandir este sistema para permissões mais granulares

---

**Última atualização:** 22 de Fevereiro de 2026
