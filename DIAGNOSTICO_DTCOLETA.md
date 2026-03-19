# Problema: dtColeta não está preenchido

## Diagnóstico

Após adicionar logs de debug e verificar o console do navegador, descobrimos que:

**O campo `dtColeta` está `undefined` nas programações retornadas pela API.**

```javascript
[getProgramacaoDate] Itajaí selecionado mas dtColeta não encontrado: {
  city: 'itajaí',
  dtColeta: undefined,  ← AQUI ESTÁ O PROBLEMA
  dataAgendamento: '2026-03-19T17:03',
  processo: undefined
}
```

## Causa Raiz

1. **Frontend**: Todo o código está correto ✅
   - `getProgramacaoDate()` funciona corretamente
   - `useCity()` passa a cidade corretamente
   - Os componentes usam a função certa

2. **Backend API**: O endpoint retorna o campo `dtColeta`, mas está vazio ⚠️
   - Está no schema de `ProgramacaoEntrega`
   - Está sendo retornado nas respostas
   - Mas com valor `undefined` ou string vazia

3. **Banco de Dados**: `dtColeta` não foi populado quando criadas ❌
   - As programações existentes não têm `dtColeta` preenchido
   - É necessário preenchermos esses valores

## Solução

### Opção 1: Usar o script automático (RECOMENDADO)

```bash
cd backend
node scripts/populate-dtColeta.js
```

Este script vai:
- Encontrar todas as programações de Itajaí (aquelas sem `origem` MANAUS)
- Preencher `dtColeta` com o valor de `dataAgendamento` (que já está correto)
- Exibir progresso em tempo real

### Opção 2: Editar manualmente via "BaseDadosGeral"

Na aplicação:
1. Vá para **Painel Admin** → **Base de Dados Geral**
2. Para cada programação de Itajaí:
   - Clique em **Editar**
   - Na coluna "Data Agendamento", copie o valor
   - Cole o mesmo valor em um campo "Data Coleta" (se houver)
   - Salve

### Opção 3: Inserir via MongoDB CLI

```javascript
db.programacaoentregas.updateMany(
  {
    $or: [
      { origem: { $exists: false } },
      { origem: '' },
      { origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } }
    ],
    $or: [
      { dtColeta: { $exists: false } },
      { dtColeta: '' },
      { dtColeta: null }
    ]
  },
  [
    {
      $set: {
        dtColeta: {
          $cond: [
            { $ne: ['$dataAgendamento', null] },
            '$dataAgendamento',
            null
          ]
        }
      }
    }
  ]
);
```

## Próximas Entregas do Ycompany

⚠️ **IMPORTANTE**: Quando novas programações forem importadas do Ycompany via "Sincronizar Ycompany", precisamos garantir que o campo `dtColeta` seja preenchido CORRETAMENTE.

Atualmente, no endpoint de sync (`/api/admin/programacoes/sync/ycompany`), o `dtColeta` é mapeado de `y.dtColeta` do Ycompany. Verifique se:

1. Os dados do Ycompany estão trazendo `dtColeta` com valor ✅
2. Se não, usar `dataAgendamento` como fallback ✅

O código já está implementado para isso:

```javascript
// Em admin.js, linha 1858
const dtColeta = formatSyncDate(y.dtColeta);
```

Se in `y.dtColeta` estiver vazio no Ycompany, ele virá vazio. Nesse caso, considere usar `dataAgendamento` como fallback:

```javascript
const dtColeta = formatSyncDate(y.dtColeta) || formatSyncDate(y.dtAgendamentoDescarga);
```

## Status das Telas

Após essa correção, as seguintes telas mostrarão `dtColeta` CORRETAMENTE para Itajaí:

- ✅ **Monitor Entregas** - Kanban (card)
- ✅ **Monitor Entregas** - Tabela (coluna "Agendamento")
- ✅ **Monitor Entregas** - Modal (campo "Agendamento")
- ✅ **Base de Dados Geral** - Tabela (coluna "Data Agendamento")
- ✅ **Admin Dashboard** - Filtros de data
