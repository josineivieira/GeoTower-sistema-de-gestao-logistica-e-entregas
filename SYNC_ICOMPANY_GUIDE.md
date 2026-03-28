# Guia de Sincronização: Icompany → Programação de Entregas

## 📋 O que foi implementado

Sistema de sincronização automática de dados entre a tela **Icompany** e **Programação de Entregas**.

## 🔄 Mapeamento de Colunas

A sincronização mapeia os seguintes campos:

| Column em Programação | ← | Campo no Icompany |
|---|---|---|
| **Processo** | ← | `geomaritima` (N° GeoMarítima) |
| **Recebedor** | ← | `destinatario` (Destinatário) |
| **Container** | ← | `numero` (Número do Container) |
| **Contratado** | ← | `contratado` (Contratado) |
| **Motorista** | ← | `motorista` (Motorista) |
| **Status** | ← | `AGENDADO` (sempre, conforme solicitado) |
| **Data Agendamento** | ← | `dtAgendamentoDescarga` ou data atual |

## 🛡️ Proteção contra Duplicação

✅ Sistema verifica automaticamente os processos já existentes e **não importa duplicados**

- Busca todos os registros do Icompany
- Compara com os processos já cadastrados em Programação de Entregas
- Importa apenas registros novos

## 🚀 Como Usar

### No Frontend:

1. Acesse a tela **Programação de Entregas**
2. Clique no botão **"Sincronizar Icompany"** (botão verde com ícone de sincronização)
3. Aguarde a conclusão
4. Mensagem de sucesso mostrará:
   - Quantos registros foram sincronizados
   - Quantos foram ignorados por serem duplicados

### No Backend:

Endpoint: `GET /api/admin/programacoes/sync/icompany`

Resposta de sucesso:
```json
{
  "success": true,
  "message": "X registro(s) sincronizado(s) com sucesso do Icompany",
  "sincronizados": 5,
  "duplicados": 3,
  "total": 8,
  "registros": [...]
}
```

## 📝 Observações

- Todos os registros sincronizados têm status **AGENDADO** automaticamente
- A Data de Agendamento é preenchida com `dtAgendamentoDescarga` do Icompany, ou com a data atual se não disponível
- Campo "Observações" incluirá a situação original do Icompany para referência

## 🔐 Permissões

- Apenas usuários com role **manager** ou superior podem sincronizar
- Usuários com role **geomar** (visualização) não podem sincronizar

## 📊 Arquivos Alterados

- Backend: `src/routes/admin.js` - novo endpoint `/programacoes/sync/icompany`
- Frontend: `src/pages/ProgramacaoManagement.js` - novo botão e função
- Frontend: `src/services/authService.js` - novo método `syncProgramacoesIcompany()`

