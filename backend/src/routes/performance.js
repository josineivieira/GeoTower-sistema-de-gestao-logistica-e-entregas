// Análise de Produtividade e Capacidade
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// GET /api/admin/performance
router.get('/performance', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
    
    console.log('📊 [PERFORMANCE] Iniciando análise de performance');

    // Definir período: última semana por padrão
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dateStart = startDate ? new Date(startDate) : weekAgo;
    const dateEnd = endDate ? new Date(endDate) : now;
    
    console.log('📅 Período:', { dateStart: dateStart.toISOString(), dateEnd: dateEnd.toISOString() });

    // Buscar todas as programações no período (sem filtro de status para análise completa)
    const programacoes = await ProgramacaoEntrega.find({}).lean();
    console.log('✅ Total de programações carregadas:', programacoes.length);

    // Filtrar por data (dataAgendamento ou dtColeta)
    const filtered = programacoes.filter(p => {
      const dateField = p.dtColeta || p.dataAgendamento;
      if (!dateField) return false;
      
      let d;
      if (typeof dateField === 'string') {
        // Formato DD/MM/YYYY
        const parts = dateField.split('/');
        if (parts.length === 3) {
          d = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
        } else {
          d = new Date(dateField);
        }
      } else {
        d = new Date(dateField);
      }
      
      d.setHours(0, 0, 0, 0);
      return d >= dateStart && d <= dateEnd;
    });

    console.log('🔍 Programações no período:', filtered.length);

    // ═══════════════════════════════════════════════════════════
    // 1️⃣  ENTREGAS POR DIA DA SEMANA
    // ═══════════════════════════════════════════════════════════
    const deliveriesByDay = {};
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    dayNames.forEach((day, idx) => {
      deliveriesByDay[day] = 0;
    });

    filtered.forEach(p => {
      const dateField = p.dtColeta || p.dataAgendamento;
      let d;
      
      if (typeof dateField === 'string') {
        const parts = dateField.split('/');
        if (parts.length === 3) {
          d = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
        } else {
          d = new Date(dateField);
        }
      } else {
        d = new Date(dateField);
      }
      
      const dayOfWeek = dayNames[d.getDay()];
      deliveriesByDay[dayOfWeek]++;
    });

    const deliveriesByDayArray = Object.entries(deliveriesByDay).map(([dia, total]) => ({ dia, total }));
    console.log('📊 Entregas por dia:', deliveriesByDayArray);

    // ═══════════════════════════════════════════════════════════
    // 2️⃣  UTILIZAÇÃO DOS CONTRATADOS
    // ═══════════════════════════════════════════════════════════
    const contractorsMap = {};
    
    filtered.forEach(p => {
      const contratado = p.contratado || 'Sem contratado';
      if (!contractorsMap[contratado]) {
        contractorsMap[contratado] = {
          contratado,
          totalEntregas: 0,
          diasAtivos: new Set()
        };
      }
      
      contractorsMap[contratado].totalEntregas++;
      
      const dateField = p.dtColeta || p.dataAgendamento;
      if (dateField) {
        let d;
        if (typeof dateField === 'string') {
          const parts = dateField.split('/');
          if (parts.length === 3) {
            d = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
          } else {
            d = new Date(dateField);
          }
        } else {
          d = new Date(dateField);
        }
        contractorsMap[contratado].diasAtivos.add(d.toISOString().split('T')[0]);
      }
    });

    const contractorsUsage = Object.values(contractorsMap)
      .map(c => ({
        contratado: c.contratado,
        totalEntregas: c.totalEntregas,
        diasAtivos: c.diasAtivos.size,
        diasOciosos: Math.max(0, 7 - c.diasAtivos.size)
      }))
      .sort((a, b) => b.totalEntregas - a.totalEntregas);

    console.log('🚚 Contratados:', contractorsUsage.length);

    // ═══════════════════════════════════════════════════════════
    // 3️⃣  DISTRIBUIÇÃO DE TEMPO NO CLIENTE
    // ═══════════════════════════════════════════════════════════
    let totalHours = 0;
    let countWithTime = 0;
    const faixas = { '2-4h': 0, '4-6h': 0, '+7h': 0 };

    filtered.forEach(p => {
      if (p.dataChegadaCliente && p.dataSaidaCliente) {
        const arrival = new Date(p.dataChegadaCliente);
        const departure = new Date(p.dataSaidaCliente);
        const diffHours = (departure - arrival) / (1000 * 60 * 60);
        
        totalHours += diffHours;
        countWithTime++;
        
        if (diffHours >= 2 && diffHours < 4) faixas['2-4h']++;
        else if (diffHours >= 4 && diffHours < 6) faixas['4-6h']++;
        else if (diffHours >= 7) faixas['+7h']++;
      }
    });

    const tempoMedioHoras = countWithTime > 0 ? parseFloat((totalHours / countWithTime).toFixed(1)) : 0;
    console.log('⏱️  Tempo médio no cliente:', tempoMedioHoras, 'horas');

    // ═══════════════════════════════════════════════════════════
    // 4️⃣  ESTATÍSTICAS GERAIS
    // ═══════════════════════════════════════════════════════════
    const totalEntregas = filtered.length;
    const totalContratados = contractorsUsage.length;
    const percentualAcima6h = totalEntregas > 0 ? Math.round((faixas['+7h'] / totalEntregas) * 100) : 0;

    // ═══════════════════════════════════════════════════════════
    // 5️⃣  ALERTAS AUTOMÁTICOS
    // ═══════════════════════════════════════════════════════════
    const alertas = [];
    
    // Alerta 1: Concentração em segunda
    const secondayDeliveries = deliveriesByDay['Segunda'] || 0;
    const totalWeek = totalEntregas;
    if (totalWeek > 0 && secondayDeliveries > totalWeek * 0.3) {
      alertas.push({
        tipo: 'warning',
        mensagem: `⚠️  Alta concentração de entregas na segunda (${Math.round((secondayDeliveries / totalWeek) * 100)}%)`
      });
    }

    // Alerta 2: Contratados ociosos
    const idleContractors = contractorsUsage.filter(c => c.diasOciosos > 2);
    if (idleContractors.length > 0) {
      alertas.push({
        tipo: 'info',
        mensagem: `ℹ️  ${idleContractors.length} contratado(s) com mais de 2 dias ociosos`
      });
    }

    // Alerta 3: Entregas longas
    if (percentualAcima6h > 20) {
      alertas.push({
        tipo: 'alert',
        mensagem: `🔴 ${percentualAcima6h}% de entregas acima de 6 horas no cliente`
      });
    }

    console.log('🚨 Alertas gerados:', alertas.length);

    // ═══════════════════════════════════════════════════════════
    // RESPOSTA
    // ═══════════════════════════════════════════════════════════
    res.json({
      success: true,
      data: {
        entregasPorDia: deliveriesByDayArray,
        contratadosUtilizacao: contractorsUsage,
        tempoCliente: { tempoMedioHoras, faixas },
        produtividadePorDia: deliveriesByDayArray,
        estatisticasGerais: {
          totalEntregas,
          tempoMedioHoras,
          percentualAcima6h,
          totalContratados
        },
        alertas
      }
    });

  } catch (error) {
    console.error('❌ Erro na análise de performance:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;