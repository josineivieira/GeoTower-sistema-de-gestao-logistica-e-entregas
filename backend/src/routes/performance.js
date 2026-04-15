// Análise de Produtividade e Capacidade
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// GET /api/admin/performance
router.get('/performance', auth, async (req, res) => {
  try {
    console.log('📊 [PERFORMANCE] Iniciando análise de performance');
    console.log('📊 [PERFORMANCE] Autenticação OK, usuário:', req.user?.username);

    const Delivery = require('../models/Delivery');
    const cityCode = req.city;

    // Buscar todas as entregas da collection deliveries;
    // se não houver cidade definida pelo middleware, não filtrar por cityCode.
    const filter = {};
    if (cityCode) filter.cityCode = cityCode;
    console.log('🔍 [PERFORMANCE] Buscando entregas na collection deliveries com filtro:', filter);
    const deliveries = await Delivery.find(filter).lean().exec();
    console.log('✅ [PERFORMANCE] Total de deliveries carregadas:', deliveries.length);

    if (!deliveries || deliveries.length === 0) {
      console.warn('⚠️  [PERFORMANCE] Nenhuma entrega encontrada na collection deliveries!');
      return res.json({
        success: true,
        data: {
          entregasPorDia: [],
          contratadosUtilizacao: [],
          tempoCliente: { tempoMedioHoras: 0, faixas: { '2-4h': 0, '4-6h': 0, '+7h': 0 } },
          produtividadePorDia: [],
          estatisticasGerais: {
            totalEntregas: 0,
            tempoMedioHoras: 0,
            percentualAcima6h: 0,
            totalContratados: 0
          },
          alertas: []
        }
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 1️⃣  ENTREGAS POR DIA DA SEMANA
    // ═══════════════════════════════════════════════════════════
    const deliveriesByDay = {
      'Domingo': 0,
      'Segunda': 0,
      'Terça': 0,
      'Quarta': 0,
      'Quinta': 0,
      'Sexta': 0,
      'Sábado': 0
    };
    
    deliveries.forEach(d => {
      const dateField = d.deliveryDate || d.createdAt;
      if (!dateField) return;
      
      let dateValue;
      if (typeof dateField === 'string') {
        const match = dateField.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
          dateValue = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        } else {
          dateValue = new Date(dateField);
        }
      } else {
        dateValue = new Date(dateField);
      }
      
      if (isNaN(dateValue)) return;
      
      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const dayOfWeek = dayNames[dateValue.getDay()];
      if (dayOfWeek) deliveriesByDay[dayOfWeek]++;
    });

    const deliveriesByDayArray = Object.entries(deliveriesByDay).map(([dia, total]) => ({ dia, total }));
    console.log('📊 [PERFORMANCE] Entregas por dia:', deliveriesByDayArray.filter(d => d.total > 0));

    // ═══════════════════════════════════════════════════════════
    // 2️⃣  UTILIZAÇÃO DOS CONTRATADOS
    // ═══════════════════════════════════════════════════════════
    const contractorsMap = {};
    
    deliveries.forEach(d => {
      const contratado = (d.driverName || d.userName || d.vehiclePlate || 'Sem contratado').trim();
      if (!contractorsMap[contratado]) {
        contractorsMap[contratado] = {
          contratado,
          totalEntregas: 0,
          diasAtivos: new Set()
        };
      }
      
      contractorsMap[contratado].totalEntregas++;
      
      const dateField = d.deliveryDate || d.createdAt;
      if (dateField) {
        let dateValue;
        if (typeof dateField === 'string') {
          const match = dateField.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (match) {
            dateValue = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
          } else {
            dateValue = new Date(dateField);
          }
        } else {
          dateValue = new Date(dateField);
        }
        
        if (!isNaN(dateValue)) {
          contractorsMap[contratado].diasAtivos.add(dateValue.toISOString().split('T')[0]);
        }
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

    console.log('🚚 [PERFORMANCE] Contratados únicos:', contractorsUsage.length);

    // ═══════════════════════════════════════════════════════════
    // 3️⃣  DISTRIBUIÇÃO DE TEMPO NO CLIENTE
    // ═══════════════════════════════════════════════════════════
    let totalHours = 0;
    let countWithTime = 0;
    const faixas = { '2-4h': 0, '4-6h': 0, '+7h': 0 };

    deliveries.forEach(d => {
      let arrival = d.arrivedAt ? new Date(d.arrivedAt) : null;
      let departure = d.desovaEndAt ? new Date(d.desovaEndAt) : null;

      if (arrival && departure && !isNaN(arrival) && !isNaN(departure)) {
        const diffHours = (departure - arrival) / (1000 * 60 * 60);
        totalHours += diffHours;
        countWithTime++;
        
        if (diffHours >= 2 && diffHours < 4) faixas['2-4h']++;
        else if (diffHours >= 4 && diffHours < 6) faixas['4-6h']++;
        else if (diffHours >= 7) faixas['+7h']++;
      }
    });

    const tempoMedioHoras = countWithTime > 0 ? parseFloat((totalHours / countWithTime).toFixed(1)) : 0;
    console.log('⏱️  [PERFORMANCE] Tempo médio no cliente:', tempoMedioHoras, 'horas');

    // ═══════════════════════════════════════════════════════════
    // 4️⃣  ESTATÍSTICAS GERAIS
    // ═══════════════════════════════════════════════════════════
    const totalEntregas = deliveries.length;
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

    console.log('🚨 [PERFORMANCE] Alertas gerados:', alertas.length);

    // ═══════════════════════════════════════════════════════════
    // RESPOSTA
    // ═══════════════════════════════════════════════════════════
    const responseData = {
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
    };

    console.log('✅ [PERFORMANCE] Resposta pronta:');
    console.log('   - Total Entregas:', totalEntregas);
    console.log('   - Tempo Médio:', tempoMedioHoras);
    console.log('   - % Acima 6h:', percentualAcima6h);
    console.log('   - Contratados:', totalContratados);
    console.log('   - Alertas:', alertas.length);

    res.json(responseData);

  } catch (error) {
    console.error('❌ [PERFORMANCE] Erro na análise de performance:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;