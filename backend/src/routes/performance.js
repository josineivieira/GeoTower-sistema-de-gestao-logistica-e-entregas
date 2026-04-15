const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const Delivery = require('../models/Delivery');
    const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');

    const [deliveries, programacoes] = await Promise.all([
      Delivery.find({}).lean().exec(),
      ProgramacaoEntrega.find({}).lean().exec()
    ]);

    const deliveryMap = {};
    deliveries.forEach(d => {
      const key = (d.deliveryNumber || '').toUpperCase().trim();
      if (key) deliveryMap[key] = d;
    });

    const enriched = programacoes.map(p => ({
      ...p,
      _entrega: 
        deliveryMap[(p.container || '').toUpperCase().trim()] ||
        deliveryMap[(p.processo || '').toUpperCase().trim()] ||
        null
    }));

    if (!enriched || enriched.length === 0) {
      return res.json({ success: true, data: { entregasPorDia: [], contratadosUtilizacao: [], tempoCliente: { tempoMedioHoras: 0 }, estatisticasGerais: { totalEntregas: 0 }, alertas: [] } });
    }

    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const deliveriesByDay = { 'Domingo': 0, 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0 };
    const contractorsMap = {};
    let totalHours = 0, countWithTime = 0;
    const faixas = { '2-4h': 0, '4-6h': 0, '+7h': 0 };

    enriched.forEach(item => {
      const agendDate = item.dataAgendamento || item.dtColeta;
      if (agendDate) {
        const d = new Date(agendDate);
        if (!isNaN(d)) deliveriesByDay[dayNames[d.getDay()]]++;
      }

      const contratado = (item.contratado || 'Sem contratado').trim();
      if (!contractorsMap[contratado]) contractorsMap[contratado] = { contratado, totalEntregas: 0, diasAtivos: new Set() };
      contractorsMap[contratado].totalEntregas++;

      const entrega = item._entrega;
      if (entrega && entrega.arrivedAt && entrega.desovaEndAt) {
        const a = new Date(entrega.arrivedAt);
        const o = new Date(entrega.desovaEndAt);
        if (!isNaN(a) && !isNaN(o)) {
          const h = (o - a) / (1000 * 60 * 60);
          totalHours += h;
          countWithTime++;
          if (h >= 2 && h < 4) faixas['2-4h']++;
          else if (h >= 4 && h < 6) faixas['4-6h']++;
          else if (h >= 7) faixas['+7h']++;
        }
      }
    });

    const deliveriesByDayArray = Object.entries(deliveriesByDay).map(([d, t]) => ({ dia: d, total: t }));
    const contractorsUsage = Object.values(contractorsMap).map(c => ({ contratado: c.contratado, totalEntregas: c.totalEntregas })).sort((a, b) => b.totalEntregas - a.totalEntregas);
    const tempoMedioHoras = countWithTime > 0 ? parseFloat((totalHours / countWithTime).toFixed(1)) : 0;
    const totalEntregas = enriched.length;
    const percentualAcima6h = Math.round((faixas['+7h'] / totalEntregas) * 100);

    res.json({
      success: true,
      data: {
        entregasPorDia: deliveriesByDayArray,
        contratadosUtilizacao: contractorsUsage,
        tempoCliente: { tempoMedioHoras, faixas },
        produtividadePorDia: deliveriesByDayArray,
        estatisticasGerais: { totalEntregas, tempoMedioHoras, percentualAcima6h, totalContratados: contractorsUsage.length },
        alertas: percentualAcima6h > 20?[{ tipo: 'alert', mensagem: 'Alta concentração acima 6h' }] : []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro', error: error.message });
  }
});

module.exports = router;
