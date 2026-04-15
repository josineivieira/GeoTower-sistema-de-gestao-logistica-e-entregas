# ⚡ Quick Start - Análise de Produtividade

## 🎯 Em 2 Minutos

### 1️⃣ Acesso Rápido
```
URL: https://seu-app.com/admin/performance
Role necessário: admin, manager ou geomar
Dados: Última semana por padrão
```

### 2️⃣ O que você vê?

**4 Cards com Métricas:**
```
📦 Total Entregas     → Soma de todas entregas
⏱️  Tempo Médio       → Média de horas no cliente
⚠️  Entregas >6h     → % de entrega acima de 6h
🚚 Contratados Ativos → Quantidade de contratados
```

**3 Gráficos:**
```
📊 Entrega/Dia       → Bar Chart (mostra picos)
🚚 Dias Ativos/Ociosos → Stacked (desbalance)
⏱️  Faixas de Tempo   → Pie Chart (distribuição)
```

**1 Tabela:**
```
Detalhes de cada contratado (entregas, dias ativos, ociosos)
```

**🚨 Alertas Automáticos:**
```
- Alta concentração segundas?
- Contratados com muitos dias ociosos?
- Tempo excessivo no cliente (>6h)?
```

### 3️⃣ Filtros
```
Data Inicial: [___/___/____]
Data Final:   [___/___/____]
[Aplicar] [Limpar]
```

---

## 🔧 Para Desenvolvedores

### Backend
**Arquivo**: `backend/src/routes/admin.js` - Linhas 2445-2732

```javascript
router.get("/performance", auth, onlyAdmin, async (req, res) => {
  // MongoDB aggregation $facet com 5 pipelines
  // Retorna: entregasPorDia, contratadosUtilizacao, tempoCliente, etc
})
```

### Frontend
**Arquivos**:
- `frontend/src/pages/PerformanceAnalysis.js` - Componente principal
- `frontend/src/services/performanceService.js` - API service
- `frontend/src/App.js` - Rota em `/admin/performance`

### API Endpoint
```
GET /api/admin/performance
Authorization: Bearer TOKEN
X-City: manaus (ou itajai)

Query Params:
  ?startDate=2024-01-15&endDate=2024-01-21
```

---

## 📈 Exemplo de Uso Real

### Cenário: Cliente com agendamentos desbalanceados

**Você vê:**
- Segunda: 120 entregas (45% da semana)
- Terça: 80 entregas
- Quarta: 60 entregas
- ...
- Alerta: "Alta concentração de entregas no início da semana"

**Ação:**
"Veja este relatório - 45% das entregas acontecem numa só terça! Isso prejudica os contratados. Podemos distribuir melhor?"

**Resultado:** Cliente ajusta agendamentos → Operação melhor equilibrada

---

## 🚀 Stack Técnico

```
Backend:   Node.js + Express + MongoDB
Frontend:  React + Recharts + Tailwind CSS
Auth:      JWT Bearer Token
Status:    ✅ Pronto para produção
```

---

## ✨ Diferencial

→ Dados em **tempo real** direto do MongoDB
→ **Sem loops** em JavaScript (puro aggregation)
→ **Alertas automáticos** com regras configurable
→ **Responsivo** em mobile (Tailwind CSS)
→ **Seguro** com auth + role-based access

---

## 🐛 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| "Sem permissão" | Verifique role (admin/manager/geomar) |
| "Erro de conexão" | Backend rodando? API URL certa? |
| Sem dados | Período tem entregas? |
| Gráficos vazios | Console mostra erro? |

---

## 📞 Documentação Completa

→ [PERFORMANCE_ANALYSIS_GUIDE.md](./PERFORMANCE_ANALYSIS_GUIDE.md)
→ [PERFORMANCE_IMPLEMENTATION_DETAILS.md](./PERFORMANCE_IMPLEMENTATION_DETAILS.md)

---

**Status**: ✅ 100% Implementado
**Última atualização**: Abril 2024
**Autor**: GitHub Copilot
