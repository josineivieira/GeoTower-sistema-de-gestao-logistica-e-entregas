const express = require("express");
const path = require("path");
const fs = require("fs");
const archiver = require('archiver');
const multer = require('multer');
const os = require('os');
const mockdb = require("../mockdb");
const auth = require("../middleware/auth");
const onlyAdminMiddleware = require("../middleware/adminOnly");
const managerOnly = require("../middleware/managerOnly");
const { normalizeDeliveryForResponse } = require("../utils/storageUtils");

const router = express.Router();

// Helper to normalize db calls (sync mockdb or async mongo adapter)
async function getDb(req) {
  const db = req.mockdb || require('../mockdb');
  const wrapper = {};
  const methods = ['find','findOne','findById','create','updateOne','deleteOne'];
  methods.forEach(m => {
    if (typeof db[m] === 'function') {
      wrapper[m] = async (...args) => {
        const res = db[m](...args);
        if (res && typeof res.then === 'function') return await res;
        return res;
      };
    }
  });
  return wrapper;
}

function onlyAdmin(req, res, next) {
  const role = req.user?.role || "operacao";
  // Libera acesso para admin, gestor, manager, geomar e gestor_contratado
  if (role !== "admin" && role !== "gestor" && role !== "manager" && role !== "geomar" && role !== "gestor_contratado") {
    return res.status(403).json({ message: "Sem permissão" });
  }
  next();
}

const cleanLookupKey = (value) => {
  if (value === null || value === undefined) return '';
  return value.toString().replace(/^#/, '').trim().toUpperCase();
};

const addLookupKey = (set, value) => {
  const key = cleanLookupKey(value);
  if (key) set.add(key);
};

const getClienteBySentido = (record) => {
  const sentidoValue = String(record?.sentido || record?.SENTIDO || '').trim().toUpperCase();
  const remetenteValue = String(record?.remetente || '').trim();
  const destinatarioValue = String(record?.destinatario || record?.recebedor || '').trim();
  if (sentidoValue === 'ORIGEM') return remetenteValue || destinatarioValue;
  if (sentidoValue === 'DESTINO') return destinatarioValue || remetenteValue;
  return destinatarioValue || remetenteValue;
};
const addRecordToLookupMap = (map, key, record) => {
  const cleanKey = cleanLookupKey(key);
  if (!cleanKey) return;
  if (!map.has(cleanKey)) map.set(cleanKey, []);
  map.get(cleanKey).push(record);
};

const getRecordsByLookupKeys = (map, keys) => {
  for (const key of keys) {
    const records = map.get(cleanLookupKey(key));
    if (records && records.length) return records;
  }
  return [];
};

const cityConfigFromRequest = (city) => {
  if (city === 'itajai') {
    return { estab: 'LSC', origem: 'ITAJAI', uf: 'SC' };
  }
  return { estab: 'LAM', origem: 'MANAUS', uf: 'AM' };
};

const applyProgramacaoCityFilter = (filter, city) => {
  const cfg = cityConfigFromRequest(city);
  if (city === 'manaus') {
    filter.$or = [
      { estab: cfg.estab },
      { estab: { $exists: false }, origem: { $in: ['MANAUS', 'MANAUS - COELTA BALY'] } },
      { estab: '', origem: { $in: ['MANAUS', 'MANAUS - COELTA BALY'] } },
    ];
  } else if (city === 'itajai') {
    filter.$or = [
      { estab: cfg.estab },
      { estab: { $exists: false }, origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } },
      { estab: '', origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } },
      { origem: 'ITAJAI' },
    ];
  }
  return filter;
};

const userCanAccessProgramacaoCity = (programacao, city) => {
  const cfg = cityConfigFromRequest(city);
  if (programacao.estab) return programacao.estab === cfg.estab;
  if (city === 'manaus') return !programacao.origem || ['MANAUS', 'MANAUS - COELTA BALY'].includes(programacao.origem);
  return !['MANAUS', 'MANAUS - COELTA BALY'].includes(programacao.origem || '');
};

const applyIcompanyEstabFilter = (filter, city) => {
  filter.estab = cityConfigFromRequest(city).estab;
  return filter;
};

/**
 * GET /api/admin/statistics
 * Retorna estatísticas gerais
 * ✅ OTIMIZADO: Usa deliveryService com aggregation pipeline
 */
router.get("/statistics", auth, onlyAdmin, async (req, res) => {
  try {
    const deliveryService = require('../services/deliveryService');
    const city = req.city || 'manaus';
    const { startDate, endDate } = req.query;

    // Determinar filtro de contratado se user é gestor_contratado
    const contratadobFilter = req.user?.role === 'gestor_contratado'
      ? req.user.contratado
      : null;

    console.log(`⚡ GET /admin/statistics [OTIMIZADO] city=${city} contratado=${contratadobFilter || 'all'} startDate=${startDate} endDate=${endDate}`);

    // Usar serviço otimizado com aggregation pipeline
    const stats = await deliveryService.getStatistics(city, contratadobFilter, startDate, endDate);

    // Converter para formato compatível com frontend
    const statistics = {
      totalDeliveries: stats.total,
      submitted: stats.submitted,
      pending: stats.pending,
      finalized: stats.finalized,
      deliveriesByDriver: stats.byContratado || [],
      dailyDeliveries: stats.dailyDeliveries || []
    };

    return res.json({ statistics });
  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error);
    return res.status(500).json({ message: "Erro ao buscar estatísticas" });
  }
});

/**
 * GET /api/admin/deliveries
 * Lista todas entregas (admin/gestor)
 * filtros:
 *  - status=draft|submitted|all
 *  - q=texto
 *  - period=today|yesterday|tomorrow (filtra por dataAgendamento)
 * 
 * Consolida automaticamente arquivos das duas pastas de uploads
 */
router.get("/deliveries", auth, onlyAdmin, async (req, res) => {
  try {
    const { status, q, startDate, endDate, period, periodDate, processo, container, recebedor, sentido, pontualidade, horaStatusStart, horaStatusEnd, agendamentoStart, agendamentoEnd, tempoStatusMin, tempoStatusMax } = req.query;
    const city = req.city || 'manaus';
    console.log('📋 GET /admin/deliveries recebido com filtros:', { status, q, processo, container, recebedor, pontualidade, horaStatusStart, horaStatusEnd, agendamentoStart, agendamentoEnd, tempoStatusMin, tempoStatusMax, sentido, startDate, endDate, period, periodDate, city });
    
    // Buscar programações filtradas por cidade
    const ProgramacaoEntrega = require('../models/ProgramacaoEntrega');
    let progFilter = {};
    applyProgramacaoCityFilter(progFilter, city);
    if (sentido && sentido !== 'all') progFilter.sentido = String(sentido || '').trim().toUpperCase();
    const programacoes = await ProgramacaoEntrega.find(progFilter)
      .select('processo processoLog recebedor remetente destinatario container dataAgendamento dtColeta contratado motorista status createdAt observacoes origem estab sentido')
      .lean();
    console.log('  ℹ️  Total de programações (' + city + '):', programacoes ? programacoes.length : 0);

    // Calcula effectiveDate se period/periodDate fornecidos
    let effectiveDate = '';
    if (periodDate && String(periodDate).trim()) {
      effectiveDate = String(periodDate).trim();
      console.log('🗓️  Usando periodDate do cliente:', effectiveDate);
    } else if (period && period !== 'general') {
      console.log('🗓️  Aplicando filtro de período:', period);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (period === 'yesterday') {
        today.setDate(today.getDate() - 1);
      } else if (period === 'tomorrow') {
        today.setDate(today.getDate() + 1);
      }
      effectiveDate = today.toLocaleDateString('pt-BR');
      console.log('   convertido para data efetiva:', effectiveDate);
    }

    // *** UNIFIED LOGIC BELOW ***
    // buscamos entregas iniciadas e também levamos em conta programações não iniciadas
    const db = await getDb(req);

    // antes de cruzar, carregar dados do Icompany para termos placas (tracao)
    const Icompany = require('../models/Icompany');
    const icompanyRecords = await Icompany.find({})
      .select('geomaritima processo codigo numero NUMERO NÚMERO container containerNumero tracao contratado entradaDistrito dtColeta remetente dtChegadaPlanta dtDevolucaoCNTR dtAgendamentoDescarga destinatario dtRetiraPD dtInicioDescarga dtFimDescarga sentido SENTIDO')
      .lean();
    const ycByProcess = new Map();  // processo -> [array de registros yc]
    const ycByContainer = new Map(); // container -> [array de registros yc]
    icompanyRecords.forEach(y => {
      const proc = String(y.processo || '').trim().toUpperCase();
      if (proc) {
        if (!ycByProcess.has(proc)) ycByProcess.set(proc, []);
        ycByProcess.get(proc).push(y);
      }
      // container pode estar em `numero` ou `containerNumero`
      const cont = String(y.numero || y.NUMERO || y['NÚMERO'] || y.containerNumero || '').trim().toUpperCase();
      if (cont) {
        if (!ycByContainer.has(cont)) ycByContainer.set(cont, []);
        ycByContainer.get(cont).push(y);
      }
    });

    // Cruzar dados de programação (por container) e construir lista combinada
    const deliveryFilter = { cityCode: city };
    if (status && status !== 'all') {
      if (status === 'CANCELADO') {
        deliveryFilter.status = 'CANCELADO';
      } else {
        deliveryFilter.status = status;
        deliveryFilter.isCanceled = { $ne: true };
      }
    } else {
      deliveryFilter.isCanceled = { $ne: true };
    }

    const allDeliveries = await db.find("deliveries", deliveryFilter);
    console.log('  ℹ️  Total de entregas na DB (' + city + '):', allDeliveries ? allDeliveries.length : 0);

    // Normaliza documentos para resposta
    const normalizedDeliveries = (allDeliveries || []).map(d => {
      try {
        return normalizeDeliveryForResponse(d);
      } catch (err) {
        console.error('Erro ao normalizar entrega:', err);
        return d;
      }
    });

    const programacoesByLookup = new Map();
    const programacoesById = new Map();
    const addProgramacaoLookup = (prog, value) => {
      const key = cleanLookupKey(value);
      if (key && !programacoesByLookup.has(key)) programacoesByLookup.set(key, prog);
    };
    programacoes.forEach((prog) => {
      if (prog._id) programacoesById.set(String(prog._id), prog);
      addProgramacaoLookup(prog, prog.processoLog);
      addProgramacaoLookup(prog, prog.processo);
      addProgramacaoLookup(prog, prog.container);
    });

    const findProgramacaoForDelivery = (delivery) => {
      const linkedId = delivery.programacaoId || delivery.linkedProgramacaoId;
      if (linkedId && programacoesById.has(String(linkedId))) return programacoesById.get(String(linkedId));
      return programacoesByLookup.get(cleanLookupKey(delivery.deliveryNumber)) || null;
    };

    const deliveryNumbers = new Set();
    normalizedDeliveries.forEach((delivery) => addLookupKey(deliveryNumbers, delivery.deliveryNumber));

    let deliveriesWithProgramacao = normalizedDeliveries.map(delivery => {
      const prog = findProgramacaoForDelivery(delivery);
      const keyProc = cleanLookupKey(prog?.processo || delivery.processoCAB || delivery.deliveryNumber);
      const keyCont = cleanLookupKey(prog?.container || delivery.container || delivery.deliveryNumber);
      const yrecArray = ycByProcess.get(keyProc) || ycByContainer.get(keyCont) || [];
      const yrec = Array.isArray(yrecArray) ? yrecArray[0] : yrecArray;  // pega o primeiro para placa
      const placaY = yrec ? (yrec.tracao || '') : '';
      const containerNumeros = Array.isArray(yrecArray) 
        ? [...new Set(yrecArray.map(y => y.numero || y.containerNumero).filter(Boolean))]
        : [];

      return {
        ...delivery,
        // incluir número de processo CAB quando houver programação
        processoCAB: prog ? prog.processo || '' : delivery.processoCAB || '',
        processoLog: prog ? prog.processoLog || '' : delivery.processoLog || '',
        sentido: prog ? prog.sentido || '' : delivery.sentido || '',
        placaIcompany: placaY,
        container: prog ? prog.container || delivery.container || '' : delivery.container || '',
        containerNumero: containerNumeros.length > 0 ? containerNumeros : (prog?.container ? [prog.container] : undefined),  // Array de containers
        recebedor: prog ? prog.recebedor : delivery.recebedor || '',
        remetente: prog ? prog.remetente || '' : delivery.remetente || '',
        destinatario: prog ? prog.destinatario || '' : delivery.destinatario || '',
        dataAgendamento: prog ? prog.dataAgendamento : delivery.dataAgendamento || '',
        dtColeta: prog ? prog.dtColeta : delivery.dtColeta || '',  // Itajaí: data de coleta
        horarioChegada: delivery.arrivedAt || '',
        horarioSaidaCliente: delivery.saidaClienteAt || '',
        horarioChegadaPorto: delivery.chegadaPortoAt || '',
        horarioDevolucaoVazio: delivery.horarioDevolucaoVazio || '',
        horarioInicioDesova: delivery.desovaStartAt || '',
        horarioFimDesova: delivery.desovaEndAt || '',
        status: delivery.status
      };
    });

    // adicionar programações que não têm entrega correspondente
    programacoes.forEach(prog => {
      const programacaoKeys = [prog.processoLog, prog.processo, prog.container].map(cleanLookupKey).filter(Boolean);
      const exists = programacaoKeys.some(key => deliveryNumbers.has(key));
      if (!exists) {
        // também incluir placaIcompany se existir
        const keyProc = (prog.processo || '').toUpperCase();
        const keyCont = (prog.container || '').toUpperCase();
        const yrecArray2 = ycByProcess.get(keyProc) || ycByContainer.get(keyCont) || [];
        const yrec2 = Array.isArray(yrecArray2) ? yrecArray2[0] : yrecArray2;
        const placaY2 = yrec2 ? (yrec2.tracao || '') : '';
        
        // Extrair todos os containers únicos
        const containerNumeros2 = Array.isArray(yrecArray2) 
          ? [...new Set(yrecArray2.map(y => y.numero || y.containerNumero).filter(Boolean))]
          : [];

        deliveriesWithProgramacao.push({
          _id: prog._id,
          deliveryNumber: prog.container || prog.processo,
          processoCAB: prog.processo || '',
          processoLog: prog.processoLog || '',
          sentido: prog.sentido || '',
          placaIcompany: placaY2,
          container: prog.container || '',
          containerNumero: containerNumeros2.length > 0 ? containerNumeros2 : (prog.container ? [prog.container] : undefined),  // Array de containers
          userName: prog.contratado || '',
          driverName: prog.motorista || '-',
          recebedor: prog.recebedor || '',
          remetente: prog.remetente || '',
          destinatario: prog.destinatario || '',
          dataAgendamento: prog.dataAgendamento || '',
          dtColeta: prog.dtColeta || '',  // Itajaí: data de coleta
          status: prog.status || 'AGENDADO',
          documents: {},
          uploadedFiles: [],
          hasFiles: false,
          createdAt: prog.createdAt,
          observations: prog.observacoes || '',
          cityCode: city  // ← ADICIONADO: identificar a cidade desta programação
        });
      }
    });

    console.log(`  ✓ Combinação total após incluir agendadas: ${deliveriesWithProgramacao.length}`);

    // HELPER: Parse data string para objeto {day, month, year}
    const parseStringDate = (dateStr) => {
      if (!dateStr) return null;
      const progDateStr = String(dateStr).trim();
      let pd;
      if (/\d{2}\/\d{2}\/\d{4}/.test(progDateStr)) {
        const parts = progDateStr.split(' ')[0].split('/');
        pd = { day: Number(parts[0]), month: Number(parts[1]), year: Number(parts[2]) };
      } else if (/\d{4}-\d{2}-\d{2}/.test(progDateStr)) {
        const parts = progDateStr.split('T')[0].split('-');
        pd = { day: Number(parts[2]), month: Number(parts[1]), year: Number(parts[0]) };
      } else {
        const tmp = new Date(progDateStr);
        if (!isNaN(tmp)) {
          pd = { day: tmp.getDate(), month: tmp.getMonth()+1, year: tmp.getFullYear() };
        }
      }
      return pd;
    };

    // HELPER: Comparar datas {day, month, year}
    const compareDates = (d1, d2) => {
      if (!d1 || !d2) return null;
      if (d1.year !== d2.year) return d1.year - d2.year;
      if (d1.month !== d2.month) return d1.month - d2.month;
      return d1.day - d2.day;
    };

    const parseDateTime = (value) => {
      if (!value) return null;
      let raw = String(value).trim();
      raw = raw.replace(' ', 'T');
      if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
        const [datePart, timePart] = raw.split('T');
        const [day, month, year] = datePart.split('/').map(Number);
        const time = timePart || '00:00:00';
        return new Date(`${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${time}`);
      }
      const date = new Date(raw);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const getProgramacaoDateString = (delivery, cityCode) => {
      if (cityCode === 'itajai' && delivery.dtColeta) return delivery.dtColeta;
      return delivery.dataAgendamento || delivery.dtColeta || delivery.data || '';
    };

    const getStatusEntryTime = (delivery, cityCode) => {
      const statusKey = (delivery.status || '').toString().replace(/_/g, ' ').toUpperCase().trim();
      if (statusKey === 'AGENDADO') {
        return getProgramacaoDateString(delivery, cityCode) || delivery.scheduledAt || delivery.createdAt;
      }
      if (statusKey === 'CONTAINER MONTADO') return delivery.containerMontadoAt || delivery.createdAt;
      if (statusKey === 'A CAMINHO DO CLIENTE' || statusKey === 'PENDING') return delivery.tripStartedAt || delivery.createdAt;
      if (statusKey === 'AGUARDANDO DESOVA') return delivery.arrivedAt || delivery.horarioChegada || delivery.createdAt;
      if (statusKey === 'EM DESOVA') return delivery.desovaStartedAt || delivery.horarioInicioDesova || delivery.createdAt;
      if (statusKey === 'ANEXANDO DOCUMENTOS FINAIS') return delivery.docsStartedAt || delivery.horarioFimDesova || delivery.createdAt;
      if (['FINALIZADO', 'ENTREGUE', 'DOCUMENTOS ENTREGUES'].includes(statusKey)) return delivery.finalizedAt || delivery.horarioFimDesova || delivery.horarioChegada || delivery.createdAt;
      if (statusKey === 'CANCELADO') return delivery.cancelledAt || delivery.createdAt;
      return delivery.createdAt || delivery.horarioChegada || delivery.horarioInicioDesova || delivery.horarioFimDesova;
    };

    const getPunctualityType = (delivery, cityCode) => {
      const scheduledStr = getProgramacaoDateString(delivery, cityCode);
      const scheduled = parseDateTime(scheduledStr);
      if (!scheduled) return 'sem_agendamento';
      const arrival = parseDateTime(delivery.horarioChegada || delivery.arrivedAt || '');
      const start = parseDateTime(delivery.createdAt || '');
      const now = new Date();
      if (arrival) {
        return arrival.getTime() <= scheduled.getTime() ? 'ok' : 'late';
      }
      if (!start) return 'no_start';
      if (now.getTime() >= scheduled.getTime()) return 'possible';
      return 'unknown';
    };

    // NOVO: Se tem startDate/endDate, filtrar por range
    if (startDate || endDate) {
      console.log('📅 Aplicando filtro de range de datas:', { startDate, endDate }, '(cidade:', city, ')');
      const sd = startDate ? parseStringDate(startDate) : null;
      const ed = endDate ? parseStringDate(endDate) : null;
      
      deliveriesWithProgramacao = deliveriesWithProgramacao.filter(d => {
        // Para Itajaí, usar dtColeta; para Manaus, usar dataAgendamento
        const dateField = city === 'itajai' && d.dtColeta ? d.dtColeta : d.dataAgendamento;
        if (!dateField) return false;
        const pd = parseStringDate(dateField);
        if (!pd) return false;
        
        let inRange = true;
        if (sd) inRange = inRange && compareDates(pd, sd) >= 0;  // pd >= startDate
        if (ed) inRange = inRange && compareDates(pd, ed) <= 0;  // pd <= endDate
        
        return inRange;
      });
      console.log(`  ✓ ${deliveriesWithProgramacao.length} registros após filtro de range de datas`);
    }
    // se não tem startDate/endDate mas tem effectiveDate, usa período único
    else if (effectiveDate) {
      console.log('📅 Aplicando filtro de período sobre lista combinada para data:', effectiveDate, '(cidade:', city, ')');
      const [edDay, edMonth, edYear] = effectiveDate.split('/').map(Number);
      deliveriesWithProgramacao = deliveriesWithProgramacao.filter(d => {
        // Para Itajaí, usar dtColeta; para Manaus, usar dataAgendamento
        const dateField = city === 'itajai' && d.dtColeta ? d.dtColeta : d.dataAgendamento;
        if (!dateField) return false;
        const pd = parseStringDate(dateField);
        if (!pd) return false;
        const match = pd.day === edDay && pd.month === edMonth && pd.year === edYear;
        if (match) console.log(`   ✓ "${dateField}" corresponde a ${effectiveDate}`);
        return match;
      });
      console.log(`  ✓ ${deliveriesWithProgramacao.length} registros após filtro de data`);
    }

    // começa a trabalhar com o array já filtrado (ou não)
    let filtered = deliveriesWithProgramacao;

    if (status && status !== "all") {
      console.log('  ✓ Aplicando filtro de status:', status);
      filtered = filtered.filter(d => {
        if (status === 'OPERACAO_FINALIZADA') return d.status === 'ENTREGUE' || d.status === 'submitted' || d.status === 'FINALIZADO' || d.status === 'SAINDO_CLIENTE';
        if (status === 'RETORNO') return d.status === 'RETORNANDO_PORTO' || d.status === 'CHEGOU_PORTO';
        if (status === 'A CAMINHO DO CLIENTE') return d.status === 'A_CAMINHO_DO_CLIENTE' || d.status === 'pending' || d.status === 'PENDING';
        return d.status === status;
      });
    }

    // NOVO: Se gestor_contratado, filtrar por contratado
    if (req.user && req.user.role === 'gestor_contratado' && req.user.contratado) {
      console.log('  ✓ Aplicando filtro de contratado para gestor:', req.user.contratado);
      filtered = filtered.filter(d => d.userName === req.user.contratado);
    }

    if (processo && processo.trim()) {
      const text = processo.trim().toLowerCase();
      filtered = filtered.filter(d => [
        d.processoCAB,
        d.processo,
        d.deliveryNumber,
        d.processNumber
      ].some(v => String(v || '').toLowerCase().includes(text)));
      console.log(`  ✓ Aplicando filtro de processo: ${processo}`);
    }

    if (container && container.trim()) {
      const text = container.trim().toLowerCase();
      filtered = filtered.filter(d => {
        const containerText = Array.isArray(d.containerNumero)
          ? d.containerNumero.join(' ')
          : d.containerNumero || '';
        return [containerText, d.container, d.deliveryNumber].some(v => String(v || '').toLowerCase().includes(text));
      });
      console.log(`  ✓ Aplicando filtro de container: ${container}`);
    }

    if (sentido && sentido !== 'all') {
      const sentidoFilter = String(sentido || '').trim().toUpperCase();
      filtered = filtered.filter(d => String(d.sentido || '').trim().toUpperCase() === sentidoFilter);
      console.log(`  ? Aplicando filtro de sentido: ${sentidoFilter}`);
    }
    if (recebedor && recebedor.trim()) {
      const text = recebedor.trim().toLowerCase();
      filtered = filtered.filter(d => String(d.recebedor || '').toLowerCase().includes(text));
      console.log(`  ✓ Aplicando filtro de recebedor: ${recebedor}`);
    }

    if (agendamentoStart || agendamentoEnd) {
      const sd = agendamentoStart ? parseDateTime(agendamentoStart) : null;
      let ed = agendamentoEnd ? parseDateTime(agendamentoEnd) : null;
      const isDateOnly = (value) => typeof value === 'string' && (
        /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ||
        /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())
      );
      if (ed && isDateOnly(agendamentoEnd)) {
        ed = new Date(ed.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
      filtered = filtered.filter(d => {
        const scheduleStr = getProgramacaoDateString(d, city);
        const scheduleDate = parseDateTime(scheduleStr);
        if (!scheduleDate) return false;
        if (sd && scheduleDate < sd) return false;
        if (ed && scheduleDate > ed) return false;
        return true;
      });
      console.log(`  ✓ Aplicando filtro de agendamento: ${agendamentoStart || '∞'} → ${agendamentoEnd || '∞'}`);
    }

    if (horaStatusStart || horaStatusEnd) {
      const sd = horaStatusStart ? parseDateTime(horaStatusStart) : null;
      const ed = horaStatusEnd ? parseDateTime(horaStatusEnd) : null;
      filtered = filtered.filter(d => {
        const entryTime = parseDateTime(getStatusEntryTime(d, city));
        if (!entryTime) return false;
        if (sd && entryTime < sd) return false;
        if (ed && entryTime > ed) return false;
        return true;
      });
      console.log(`  ✓ Aplicando filtro de hora de status: ${horaStatusStart || '∞'} → ${horaStatusEnd || '∞'}`);
    }

    if (pontualidade && pontualidade !== 'all') {
      filtered = filtered.filter(d => getPunctualityType(d, city) === pontualidade);
      console.log(`  ✓ Aplicando filtro de pontualidade: ${pontualidade}`);
    }

    if ((tempoStatusMin && tempoStatusMin !== '') || (tempoStatusMax && tempoStatusMax !== '')) {
      const minMinutes = tempoStatusMin ? Number(tempoStatusMin) : null;
      const maxMinutes = tempoStatusMax ? Number(tempoStatusMax) : null;
      const now = new Date();
      filtered = filtered.filter(d => {
        const entryTime = parseDateTime(getStatusEntryTime(d, city));
        if (!entryTime) return false;
        const diffMinutes = Math.floor((now.getTime() - entryTime.getTime()) / 60000);
        if (minMinutes !== null && diffMinutes < minMinutes) return false;
        if (maxMinutes !== null && diffMinutes > maxMinutes) return false;
        return true;
      });
      console.log(`  ✓ Aplicando filtro de tempo de status: ${tempoStatusMin || '0'} → ${tempoStatusMax || '∞'} minutos`);
    }

    if (q && q.trim()) {
      const text = q.trim();
      console.log('  ✓ Aplicando filtro de busca:', text);
      filtered = filtered.filter(d => {
        const containerText = Array.isArray(d.containerNumero)
          ? d.containerNumero.join(' ')
          : d.containerNumero || '';

        return (
          (d.deliveryNumber || '').toLowerCase().includes(text.toLowerCase()) ||
          (d.vehiclePlate || '').toLowerCase().includes(text.toLowerCase()) ||
          (d.userName || '').toLowerCase().includes(text.toLowerCase()) ||
          (d.driverName || '').toLowerCase().includes(text.toLowerCase()) ||
          (d.recebedor || '').toLowerCase().includes(text.toLowerCase()) ||
          (d.processoCAB || '').toLowerCase().includes(text.toLowerCase()) ||
          (d.processo || '').toLowerCase().includes(text.toLowerCase()) ||
          containerText.toLowerCase().includes(text.toLowerCase()) ||
          (d.container || '').toLowerCase().includes(text.toLowerCase()) ||
          (d.processNumber || '').toLowerCase().includes(text.toLowerCase())
        );
      });
    }

    const deliveriesWithFiles = filtered.map(delivery => {
      const uploadedFiles = Object.entries(delivery.documents || {})
        .filter(([, value]) => {
          if (Array.isArray(value)) return value.length > 0;
          return !!value;
        })
        .map(([key]) => key);

      return {
        ...delivery,
        uploadedFiles,
        hasFiles: uploadedFiles.length > 0
      };
    });

    // NOVO: Carregar dados de controle de protocolos para comparações
    let controleProtocolosData = [];
    try {
      const mongoose = require('mongoose');
      const controleKeys = new Set();
      deliveriesWithFiles.forEach((delivery) => {
        addLookupKey(controleKeys, delivery.processoCAB);
        addLookupKey(controleKeys, delivery.deliveryNumber);
        addLookupKey(controleKeys, delivery.processo);
        addLookupKey(controleKeys, delivery.container);
      });

      if (controleKeys.size > 0) {
        const keys = Array.from(controleKeys);
        controleProtocolosData = await mongoose.connection
          .collection("controle_protocolos")
          .find({
            $or: [
              { processo: { $in: keys } },
              { container: { $in: keys } },
              { destinatario: { $in: keys } },
              { embarcador: { $in: keys } }
            ]
          })
          .collation({ locale: 'pt', strength: 2 })
          .toArray();
      }
      console.log(`📋 Carregados ${controleProtocolosData.length} registros de controle de protocolos`);
    } catch (error) {
      console.error('Erro ao carregar controle de protocolos:', error);
    }

    // HELPER FUNCTIONS para comparações
    const controleProtocolosDocumentMap = {
      retiradaCheio: 'RIC PORTO DESTINO',
      canhotCTE: 'COMPROVANTE DE DESOVA',
      diarioBordo: 'DIARIO DE BORDO',
      canhotNF: 'CANHOTO DE DANFE',
      devolucaoVazio: 'RIC DEPOT DESTINO'
    };

    const isControleDocumentoPresent = (value) => {
      return value === true;
    };

    const parseDateValue = (val) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    };

    const normalizeValue = (val) => {
      if (val === null || val === undefined || val === '') return '';
      const date = parseDateValue(val);
      if (date) return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
      return val.toString().trim().toUpperCase();
    };

    const compareDateOnly = (a, b) => {
      const da = parseDateValue(a);
      const db = parseDateValue(b);
      if (!da || !db) return false;
      return da.getFullYear() === db.getFullYear()
        && da.getMonth() === db.getMonth()
        && da.getDate() === db.getDate();
    };

    const controleProtocolosByAny = new Map();
    controleProtocolosData.forEach((record) => {
      ['processo', 'container', 'destinatario', 'embarcador'].forEach((key) => {
        addRecordToLookupMap(controleProtocolosByAny, record[key], record);
      });
    });

    const findControleProtocolosRecord = (delivery) => {
      if (!delivery || !controleProtocolosData.length) return null;

      const records = getRecordsByLookupKeys(controleProtocolosByAny, [
        delivery.processoCAB,
        delivery.deliveryNumber,
        delivery.processo,
        delivery.container
      ]);
      return records[0] || null;
    };

    const getControleProtocolosMismatchCount = (delivery) => {
      if (!delivery) return 0;
      if (!controleProtocolosData.length) return 0;

      const controleRecord = findControleProtocolosRecord(delivery);
      if (!controleRecord) return 1;
      if (!controleRecord.documentos) return 1;

      return Object.entries(controleProtocolosDocumentMap).reduce((count, [deliveryKey, protocoloKey]) => {
        const deliveryPresent = !!delivery.documents?.[deliveryKey];
        const controlePresent = isControleDocumentoPresent(controleRecord.documentos[protocoloKey]);
        return count + (deliveryPresent !== controlePresent ? 1 : 0);
      }, 0);
    };

    const findIcompanyRecord = (delivery, icompanyRecords) => {
      if (!delivery || !icompanyRecords.length) return null;

      const getClean = (value) => {
        if (value === null || value === undefined) return '';
        return value.toString().replace(/^#/, '').trim().toUpperCase();
      };

      const target = getClean(delivery.processoCAB || delivery.deliveryNumber || delivery.processo || delivery.container || '');
      if (!target) return null;

      const lookupKeys = ['geomaritima', 'processo', 'codigo', 'numero', 'NUMERO', 'NÚMERO', 'container', 'containerNumero'];

      return icompanyRecords.find((record) => {
        return lookupKeys.some((key) => {
          const v = getClean(record[key]);
          return v && v === target;
        });
      }) || null;
    };

    const getIcompanyMismatchCount = (delivery, icompanyRecords, city) => {
      if (!delivery) return 0;
      if (!icompanyRecords.length) return 0;

      const icompanyRecord = findIcompanyRecord(delivery, icompanyRecords);
      if (!icompanyRecord) return 1;

      // Mapeamento dos campos conforme o modelo Icompany
      const isItajai = city.toLowerCase() === 'itajai';
      const fieldMapping = isItajai ? {
        'Contratado': { deliveryField: 'userName', icompanyField: 'contratado' },
        'Entrega CNTR Porto': { deliveryField: 'horarioDevolucaoVazio', icompanyField: 'entradaDistrito' },
        'Agendamento': { deliveryField: 'dataAgendamento', icompanyField: 'dtColeta' },
        'Recebedor': { deliveryField: 'recebedor', icompanyField: 'clientePorSentido' },
        'Montagem Container': { deliveryField: 'containerMontadoAt', icompanyField: 'dtRetiraPD' },
        'Chegada': { deliveryField: 'horarioChegada', icompanyField: 'dtChegadaPlanta' },
        'Fim Desova': { deliveryField: 'horarioFimDesova', icompanyField: 'dtFimDescarga' }
      } : {
        'Contratado': { deliveryField: 'userName', icompanyField: 'contratado' },
        'Entrega CNTR Porto': { deliveryField: 'horarioDevolucaoVazio', icompanyField: 'dtDevolucaoCNTR' },
        'Agendamento': { deliveryField: 'dataAgendamento', icompanyField: 'dtAgendamentoDescarga' },
        'Recebedor': { deliveryField: 'recebedor', icompanyField: 'clientePorSentido' },
        'Montagem Container': { deliveryField: 'containerMontadoAt', icompanyField: 'dtRetiraPD' },
        'Chegada': { deliveryField: 'horarioChegada', icompanyField: 'dtInicioDescarga' },
        'Fim Desova': { deliveryField: 'horarioFimDesova', icompanyField: 'dtFimDescarga' }
      };

      let mismatchCount = 0;

      Object.entries(fieldMapping).forEach(([displayName, mapping]) => {
        const deliveryValue = mapping.icompanyField === 'clientePorSentido'
          ? getClienteBySentido(delivery)
          : delivery[mapping.deliveryField];
        const icompanyValue = mapping.icompanyField === 'clientePorSentido'
          ? getClienteBySentido(icompanyRecord)
          : icompanyRecord[mapping.icompanyField];

        const normalizedDelivery = normalizeValue(deliveryValue);
        const normalizedIcompany = normalizeValue(icompanyValue);

        let isInconsistent = false;
        if (displayName === 'Montagem Container' || displayName === 'Entrega CNTR Porto') {
          isInconsistent = !compareDateOnly(deliveryValue, icompanyValue) && (deliveryValue || icompanyValue);
        } else {
          isInconsistent = normalizedDelivery !== normalizedIcompany && (normalizedDelivery || normalizedIcompany);
        }

        if (isInconsistent) mismatchCount++;
      });

      return mismatchCount;
    };

    // Adicionar comparações a cada entrega
    const deliveriesWithComparisons = deliveriesWithFiles.map(delivery => {
      const icompanyMismatchCount = getIcompanyMismatchCount(delivery, icompanyRecords, city);
      const controleMismatchCount = getControleProtocolosMismatchCount(delivery);

      return {
        ...delivery,
        docsComparison: {
          total: icompanyMismatchCount + controleMismatchCount,
          icompanyMismatchCount,
          controleMismatchCount
        }
      };
    });

    console.log(`📤 Retornando ${deliveriesWithComparisons.length} entregas`);
    return res.json({ deliveries: deliveriesWithComparisons });
  } catch (err) {
    console.error('❌ Erro em /admin/deliveries:', err);
    return res.status(500).json({ message: "Erro ao listar entregas (admin)", error: err.message });
  }
});

/**
 * GET /api/admin/deliveries/:id
 */
router.get("/deliveries/:id", auth, onlyAdmin, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const db = await getDb(req);
    let delivery = await db.findById("deliveries", req.params.id);
    // Fallback: em alguns casos usamos deliveryNumber como identificador
    if (!delivery) {
      delivery = await db.findOne("deliveries", { deliveryNumber: req.params.id });
    }
    if (!delivery) return res.status(404).json({ message: "Entrega não encontrada" });
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }
    
    // DEBUG: retorna entrega completa com documents raw
    console.log(`[DEBUG] Entrega ${req.params.id} encontrada:`, JSON.stringify(delivery, null, 2));
    console.log(`[DEBUG] Documents raw:`, delivery.documents);
    console.log(`[DEBUG] Documents normalized:`, normalizeDeliveryForResponse(delivery).documents);
    
    return res.json({ delivery });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao buscar entrega (admin)" });
  }
});

/**
 * GET /api/admin/deliveries/:id/documents/:documentType/download
 * Download de documento específico
 */
router.get("/deliveries/:id/documents/:documentType/download", auth, onlyAdmin, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id, documentType } = req.params;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[DOWNLOAD] 🔴 ROTA ATINGIDA! id=${id}, documentType=${documentType}, city=${city}`);
    console.log(`[DOWNLOAD] query params:`, req.query);
    console.log(`${'='.repeat(80)}\n`);

    // Busca entrega
    const db = await getDb(req);
    const delivery = await db.findById("deliveries", id);
    if (!delivery) {
      console.error(`[DOWNLOAD] Entrega não encontrada: ${id}`);
      return res.status(404).json({ message: "Entrega não encontrada" });
    }
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    // Verifica se o tipo de documento é conhecido para esta entrega
    const docs = delivery.documents || {};
    console.log(`[DOWNLOAD] delivery id=${id} city=${delivery.city || 'N/A'}`);
    console.log(`[DOWNLOAD] Documentos na entrega (keys):`, Object.keys(docs));
    console.log(`[DOWNLOAD] Buscando tipo: "${documentType}", valor:`, docs[documentType]);

    // Normalize delivery first to ensure documents are properly parsed
    let docArray = [];
    const entry = docs[documentType];
    
    if (entry) {
      // Parse como o ZIP faz: se for string JSON, parse; se falhar, trata como caminho simples
      if (typeof entry === 'string') {
        try {
          docArray = JSON.parse(entry);
          console.log(`[DOWNLOAD] Tipo "${documentType}" parseado de JSON`);
        } catch (e) {
          console.warn(`[DOWNLOAD] Falha ao fazer parse de "${documentType}":`, e.message);
          docArray = [{ path: entry }]; // Trata como caminho plano
        }
      } else if (Array.isArray(entry)) {
        docArray = entry;
      } else if (typeof entry === 'object') {
        docArray = [entry];
      }
      
      // Garante que é array
      if (!Array.isArray(docArray)) {
        docArray = [docArray];
      }
    }
    
    console.log(`[DOWNLOAD] docArray após processamento:`, JSON.stringify(docArray));
    
    const idx = parseInt(req.query.index || '0', 10);
    console.log(`[DOWNLOAD] Tentando acessar índice ${idx} de um array de ${docArray.length} itens`);
    
    if (docArray.length === 0) {
      console.error(`[DOWNLOAD] docArray vazio para tipo "${documentType}"`);
      return res.status(404).json({ message: 'Nenhum documento encontrado para este tipo' });
    }
    
    if (isNaN(idx) || idx < 0 || idx >= docArray.length) {
      console.error(`[DOWNLOAD] Índice inválido: ${idx}, tamanho do array: ${docArray.length}`);
      return res.status(400).json({ message: 'Índice de documento inválido' });
    }
    
    const docInfo = docArray[idx];
    console.log(`[DOWNLOAD] Informações do documento [${idx}]:`, JSON.stringify(docInfo));

    // Se tem URL do R2, redireciona
    if (docInfo && docInfo.url) {
      console.log(`[DOWNLOAD] Documento encontrado em R2: ${docInfo.url}`);
      const filename = docInfo.name || (delivery.deliveryNumber + '_' + documentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.redirect(docInfo.url);
    }
    // Se tem caminho local, serve do disco
    else if (docInfo && docInfo.path) {
      console.log(`[DOWNLOAD] Documento encontrado localmente: ${docInfo.path}`);
      try {
        // Tenta em ambos os locais (como faz o ZIP)
        const uploadsPath1 = path.join(__dirname, "../uploads");
        const uploadsPath2 = path.join(__dirname, "../src/uploads");
        const city = delivery.city || 'manaus';

        // Normalize docInfo.path and try multiple sensible variants to avoid
        // issues when the stored path already includes the city or not.
        const rawRel = String(docInfo.path || '').replace(/^\/+/, '');
        const relVariants = new Set();
        relVariants.add(rawRel);
        // If starts with city/, also try without the leading city
        if (rawRel.startsWith(city + path.sep)) {
          relVariants.add(rawRel.slice(city.length + 1));
        } else {
          // Try with city prefix
          relVariants.add(path.join(city, rawRel));
        }
        // Also try basename only
        relVariants.add(path.basename(rawRel));

        let filePath = null;
        const tried = [];
        for (const uploadsPath of [uploadsPath1, uploadsPath2]) {
          for (const rel of relVariants) {
            const candidate = path.join(uploadsPath, rel);
            tried.push(candidate);
            if (fs.existsSync(candidate)) {
              filePath = candidate;
              break;
            }
          }
          if (filePath) break;
        }

        console.log(`[DOWNLOAD] Testadas rotas: ${tried.join(', ')}`);
        console.log(`[DOWNLOAD] Caminho resolvido: ${filePath}`);

        if (!filePath) {
          console.error(`[DOWNLOAD] Arquivo não existe em nenhum local: ${docInfo.path}`);
          // Retorna também os caminhos testados para ajudar a debugar remotamente (remover depois)
          return res.status(404).json({ message: 'Arquivo não encontrado no servidor', triedPaths: tried });
        }
        
        const stat = fs.statSync(filePath);
        const filename = docInfo.name || path.basename(filePath);
        console.log(`[DOWNLOAD] Arquivo encontrado, tamanho: ${stat.size} bytes`);
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', stat.size);
        
        const readStream = fs.createReadStream(filePath);
        readStream.on('error', (err) => {
          console.error(`[DOWNLOAD] Erro ao ler arquivo:`, err.message);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Erro ao ler arquivo' });
          }
        });
        
        console.log(`[DOWNLOAD] ✓ Iniciando stream do arquivo local: ${filename}`);
        readStream.pipe(res);
      } catch (err) {
        console.error(`[DOWNLOAD] ✗ Erro ao servir arquivo local:`, err && err.message ? err.message : err);
        return res.status(500).json({ message: 'Erro ao servir arquivo' });
      }
    } 
    // Se não tem path mas tem name, tentamos localizar pelo nome em locais prováveis
    else if (docInfo && !docInfo.path && docInfo.name) {
      console.log(`[DOWNLOAD] Documento sem path mas com name: ${docInfo.name} — tentando localizar por nome`);
      try {
        const uploadsPath1 = path.join(__dirname, "../uploads");
        const uploadsPath2 = path.join(__dirname, "../src/uploads");
        const city = delivery.city || 'manaus';
        const name = String(docInfo.name || '').replace(/^\/+/, '');

        const candidates = [];
        // Common locations
        candidates.push(path.join(uploadsPath1, delivery.deliveryNumber, name));
        candidates.push(path.join(uploadsPath1, city, delivery.deliveryNumber, name));
        candidates.push(path.join(uploadsPath1, city, name));
        candidates.push(path.join(uploadsPath1, name));
        candidates.push(path.join(uploadsPath2, delivery.deliveryNumber, name));
        candidates.push(path.join(uploadsPath2, city, delivery.deliveryNumber, name));
        candidates.push(path.join(uploadsPath2, city, name));
        candidates.push(path.join(uploadsPath2, name));

        // Also try basename-only across delivery folder
        const basename = path.basename(name);
        candidates.push(path.join(uploadsPath1, delivery.deliveryNumber, basename));
        candidates.push(path.join(uploadsPath1, city, delivery.deliveryNumber, basename));
        candidates.push(path.join(uploadsPath2, delivery.deliveryNumber, basename));

        let filePathFound = null;
        const tried = [];
        for (const candidate of candidates) {
          tried.push(candidate);
          if (fs.existsSync(candidate)) { filePathFound = candidate; break; }
        }

        console.log(`[DOWNLOAD] Tentativas por nome: ${tried.join(', ')}`);

        if (!filePathFound) {
          console.error(`[DOWNLOAD] Não foi possível localizar arquivo pelo name: ${docInfo.name}`);
          return res.status(404).json({ message: 'Arquivo não encontrado no servidor', docInfo, triedPaths: tried });
        }

        const stat = fs.statSync(filePathFound);
        const filename = docInfo.name || path.basename(filePathFound);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', stat.size);
        const readStream = fs.createReadStream(filePathFound);
        readStream.on('error', (err) => {
          console.error(`[DOWNLOAD] Erro ao ler arquivo:`, err.message);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Erro ao ler arquivo', error: err.message });
          }
        });
        console.log(`[DOWNLOAD] ✓ Iniciando stream do arquivo localizado por nome: ${filename}`);
        readStream.pipe(res);
      } catch (err) {
        console.error(`[DOWNLOAD] ✗ Erro ao localizar/servir arquivo por name:`, err && err.message ? err.message : err);
        return res.status(500).json({ message: 'Erro ao localizar arquivo por nome', error: err && err.message ? err.message : err, docInfo });
      }
    }
    // Documento sem ID, path ou name
    else {
      console.error(`[DOWNLOAD] Documento sem ID, path ou name:`, docInfo);
      return res.status(404).json({ message: 'Documento inválido: sem ID, path ou name', docInfo });
    }
  } catch (err) {
    console.error(`[DOWNLOAD] Erro geral:`, err && err.message ? err.message : err);
    console.error(`[DOWNLOAD] Stack:`, err && err.stack ? err.stack : 'N/A');
    return res.status(500).json({ message: "Erro ao fazer download" });
  }
});

router.post('/deliveries/:id/documents/:documentType/remove', auth, onlyAdmin, async (req, res) => {
  try {
    const { id, documentType } = req.params;
    const { reason } = req.body;
    const city = req.city || 'manaus';
    const db = await getDb(req);

    let delivery = await db.findById('deliveries', id);
    if (!delivery) {
      delivery = await db.findOne('deliveries', { deliveryNumber: id });
    }
    if (!delivery) return res.status(404).json({ message: 'Entrega não encontrada' });
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    const docs = delivery.documents || {};
    const docEntry = docs[documentType];
    if (!docEntry) {
      return res.status(404).json({ message: 'Documento não encontrado' });
    }

    const parseEntries = (entry) => {
      if (!entry) return [];
      if (Array.isArray(entry)) return entry;
      if (typeof entry === 'string') {
        try {
          const parsed = JSON.parse(entry);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch (_err) {
          return [entry];
        }
      }
      if (typeof entry === 'object') return [entry];
      return [entry];
    };

    const entries = parseEntries(docEntry);
    const uploadsRoot = path.join(__dirname, '..', 'uploads');

    for (const item of entries) {
      if (!item) continue;
      if (typeof item === 'string') {
        const normalized = String(item).replace(/^\/+/g, '');
        const candidate = path.join(uploadsRoot, normalized);
        if (fs.existsSync(candidate)) {
          try { fs.unlinkSync(candidate); } catch (e) { console.warn('Falha ao excluir arquivo local removendo documento:', e.message); }
        }
      } else if (item.path) {
        const normalized = String(item.path).replace(/^\/+/g, '');
        const candidate = path.join(uploadsRoot, normalized);
        if (fs.existsSync(candidate)) {
          try { fs.unlinkSync(candidate); } catch (e) { console.warn('Falha ao excluir arquivo local removendo documento:', e.message); }
        }
      }
    }

    docs[documentType] = null;

    const missingDocumentsAtSubmit = Array.isArray(delivery.missingDocumentsAtSubmit)
      ? [...new Set([...delivery.missingDocumentsAtSubmit, documentType])]
      : [documentType];

    const documentCorrectionLog = Array.isArray(delivery.documentCorrectionLog)
      ? [...delivery.documentCorrectionLog]
      : [];

    documentCorrectionLog.push({
      removedBy: req.user?.username || req.user?.name || req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
      documentType,
      reason: reason ? String(reason).trim() : 'Documento inválido removido pelo ADM',
      removedAt: new Date()
    });

    await db.updateOne('deliveries', { _id: delivery._id }, {
      documents: docs,
      missingDocumentsAtSubmit,
      documentCorrectionLog
    });

    const updated = await db.findById('deliveries', delivery._id);
    return res.json({ delivery: normalizeDeliveryForResponse(updated) });
  } catch (err) {
    console.error('Erro removendo documento manualmente:', err);
    return res.status(500).json({ message: 'Erro ao remover documento' });
  }
});


/**
 * GET /api/admin/deliveries/:id/documents/zip
 * Cria um ZIP com todos os documentos da entrega e envia em streaming
 */
router.get('/deliveries/:id/documents/zip', auth, onlyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[ZIP] Iniciando geração de ZIP para entrega: ${id}`);
    
    const db = await getDb(req);
    const delivery = await db.findById('deliveries', id);
    if (!delivery) {
      console.error(`[ZIP] Entrega não encontrada: ${id}`);
      return res.status(404).json({ message: 'Entrega não encontrada' });
    }

    const docs = delivery.documents || {};
    const filesToAdd = [];
    const city = delivery.city || req.city || 'manaus';
    
    console.log(`[ZIP] Documentos na entrega:`, Object.keys(docs));

    // Parse e coleta todos os documentos
    Object.entries(docs).forEach(([docType, entry]) => {
      if (!entry) {
        console.log(`[ZIP] Tipo "${docType}" vazio, ignorando`);
        return;
      }
      
      // Parse se for string JSON
      let docArray = entry;
      if (typeof entry === 'string') {
        try {
          docArray = JSON.parse(entry);
          console.log(`[ZIP] Tipo "${docType}" parseado de JSON`);
        } catch (e) {
          console.warn(`[ZIP] Falha ao fazer parse de "${docType}":`, e.message);
          docArray = [{ path: entry }]; // Trata como caminho plano
        }
      }
      
      // Garante que é array
      if (!Array.isArray(docArray)) {
        docArray = [docArray];
      }
      
      docArray.forEach((doc, idx) => {
        if (doc) {
          filesToAdd.push({ doc, docType, idx });
          console.log(`[ZIP] Documento encontrado: ${docType}[${idx}]`, doc);
        }
      });
    });

    // Se não houver arquivos, retorna 404
    if (filesToAdd.length === 0) {
      console.warn(`[ZIP] Nenhum documento encontrado para entrega: ${id}`);
      return res.status(404).json({ message: 'Nenhum documento encontrado para esta entrega' });
    }

    console.log(`[ZIP] Total de documentos a empacotar: ${filesToAdd.length}`);

    // Prepara o archiver
    res.attachment(`${delivery.deliveryNumber}_documents.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error(`[ZIP] Erro no archiver:`, err.message);
      throw err;
    });
    archive.pipe(res);

    // Lista de arquivos faltando
    let missing = [];
    let addedCount = 0;

    for (const item of filesToAdd) {
      const { doc, docType, idx } = item;
      let added = false;

      // Tenta R2 primeiro (se tem URL)
      if (doc.url) {
        try {
          console.log(`[ZIP] Tentando adicionar do R2: ${docType}[${idx}] (URL: ${doc.url})`);
          
          // Faz download da URL e adiciona ao ZIP
          const https = require('https');
          const http = require('http');
          const protocol = doc.url.startsWith('https') ? https : http;
          
          const filename = doc.name || `${docType}_${idx}`;
          
          await new Promise((resolve, reject) => {
            protocol.get(doc.url, (res) => {
              if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
              }
              archive.append(res, { name: path.join(delivery.deliveryNumber, filename) });
              addedCount++;
              added = true;
              console.log(`[ZIP] ✓ Adicionado do R2: ${filename}`);
              resolve();
            }).on('error', reject);
          });
        } catch (err) {
          console.error(`[ZIP] ✗ Falha do R2 para ${docType}[${idx}]:`, err.message);
          missing.push(`${docType}[${idx}] (R2: ${doc.url})`);
        }
      }

      // Tenta arquivo local (se tem path)
      if (!added && doc.path) {
          try {
            console.log(`[ZIP] Tentando adicionar arquivo local: ${docType}[${idx}] (${doc.path})`);

            const rawRel = String(doc.path || '').replace(/^\/+/, '');
            const relVariants = new Set();
            relVariants.add(rawRel);
            if (rawRel.startsWith(city + path.sep)) {
              relVariants.add(rawRel.slice(city.length + 1));
            } else {
              relVariants.add(path.join(city, rawRel));
            }
            relVariants.add(path.basename(rawRel));

            let filePath = null;
            for (const rel of relVariants) {
              const candidateCity = path.join(__dirname, '..', 'uploads', rel);
              if (fs.existsSync(candidateCity)) { filePath = candidateCity; break; }
            }

            if (filePath) {
              const stat = fs.statSync(filePath);
              const filename = doc.name || path.basename(filePath);
              archive.file(filePath, { name: path.join(delivery.deliveryNumber, filename) });
              addedCount++;
              added = true;
              console.log(`[ZIP] ✓ Adicionado arquivo local: ${filename} (${stat.size} bytes)`);
            } else {
              console.warn(`[ZIP] Arquivo local não encontrado: ${doc.path}`);
              missing.push(`${docType}[${idx}] (Local: ${doc.path})`);
            }
        } catch (err) {
          console.error(`[ZIP] ✗ Falha ao adicionar arquivo local ${docType}[${idx}]:`, err.message);
          missing.push(`${docType}[${idx}] (Erro: ${err.message})`);
        }
      }

      if (!added && !doc.url && !doc.path) {
        console.warn(`[ZIP] Documento sem URL nem path: ${docType}[${idx}]`, doc);
        missing.push(`${docType}[${idx}] (Sem dados)`);
      }
    }

    if (missing.length) {
      console.log(`[ZIP] Adicionando arquivo de documentos faltando (${missing.length} itens)`);
      archive.append('Arquivos não encontrados:\n' + missing.join('\n'), { name: 'MISSING_FILES.txt' });
    }

    console.log(`[ZIP] Finalizando arquivo (${addedCount} arquivos adicionados)`);
    await archive.finalize();
    console.log(`[ZIP] ✓ ZIP gerado com sucesso`);
  } catch (err) {
    console.error(`[ZIP] ✗ Erro ao gerar ZIP:`, err && err.message ? err.message : err);
    console.error(`[ZIP] Stack:`, err && err.stack ? err.stack : 'N/A');
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Erro ao gerar ZIP', error: err && err.message ? err.message : err });
    }
  }
});

/**
 * PUT /api/admin/deliveries/:id
 * Atualiza dados de uma entrega (apenas admin)
 */
router.put("/deliveries/:id", auth, onlyAdmin, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;
    const {
      deliveryNumber,
      userName,
      driverName,
      vehiclePlate,
      observations,
      submissionObservation,
      documentsJustification,
      dataAgendamento,
      horarioChegada,
      horarioDevolucaoVazio,
      horarioSaidaCliente,
      horarioChegadaPorto,
      horarioInicioDesova,
      horarioFimDesova,
      containerMontadoAt,
      status
    } = req.body;

    console.log('📝 Recebido PUT /deliveries/:id', { id, deliveryNumber, userName, driverName, vehiclePlate, observations, horarioDevolucaoVazio,
      horarioSaidaCliente,
      horarioChegadaPorto, city, status });

    // Validar se motivo da edição foi fornecido
    if (!observations || observations.trim() === '') {
      console.log('❌ Motivo vazio');
      return res.status(400).json({ message: "Motivo da edição é obrigatório" });
    }

    // Busca entrega (tenta por _id ou por deliveryNumber para suportar diferentes chaves de identificação)
    const db = await getDb(req);
    let delivery = await db.findById("deliveries", req.params.id);
    if (!delivery) {
      delivery = await db.findOne("deliveries", { deliveryNumber: req.params.id });
    }
    console.log('🔍 Entrega encontrada:', delivery?.deliveryNumber);
    if (!delivery) {
      return res.status(404).json({ message: "Entrega não encontrada" });
    }
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

    // Atualiza campos (exceto status)
    const updates = {};
    if (deliveryNumber !== undefined) updates.deliveryNumber = deliveryNumber.toUpperCase();
    if (userName !== undefined) updates.userName = userName;
    if (driverName !== undefined) updates.driverName = driverName;
    if (vehiclePlate !== undefined) updates.vehiclePlate = vehiclePlate.trim();
    if (observations !== undefined) updates.observations = observations;
    if (submissionObservation !== undefined) updates.submissionObservation = submissionObservation;
    if (documentsJustification !== undefined) updates.documentsJustification = documentsJustification;
    if (dataAgendamento !== undefined && dataAgendamento) updates.dataAgendamento = new Date(dataAgendamento);
    if (horarioChegada !== undefined && horarioChegada) updates.arrivedAt = new Date(horarioChegada);
    if (horarioDevolucaoVazio !== undefined && horarioDevolucaoVazio) updates.horarioDevolucaoVazio = new Date(horarioDevolucaoVazio);
    if (horarioSaidaCliente !== undefined && horarioSaidaCliente) updates.saidaClienteAt = new Date(horarioSaidaCliente);
    if (horarioChegadaPorto !== undefined && horarioChegadaPorto) updates.chegadaPortoAt = new Date(horarioChegadaPorto);
    if (horarioInicioDesova !== undefined && horarioInicioDesova) updates.desovaStartAt = new Date(horarioInicioDesova);
    if (horarioFimDesova !== undefined && horarioFimDesova) updates.desovaEndAt = new Date(horarioFimDesova);
    if (containerMontadoAt !== undefined && containerMontadoAt) updates.containerMontadoAt = new Date(containerMontadoAt);
    
    // Adicionar metadados de edição
    updates.editedAt = new Date().toISOString();
    updates.editReason = observations;

    console.log('🔄 Updates a fazer:', updates);

    // Se há mudança de status, usar updateDeliveryStatus (que valida e limpa campos)
    const targetId = delivery._id || req.params.id;
    let updated;

    if (status !== undefined) {
      const { updateDeliveryStatus } = require("../utils/deliveryConcurrency");
      
      // Admin pode fazer qualquer transição incluindo retrocesso
      updated = await updateDeliveryStatus(targetId, status, updates, true);
      console.log('✅ Status atualizado via updateDeliveryStatus:', updated?.status);
    } else {
      // Sem mudança de status, usar updateOne direto
      updated = await db.updateOne("deliveries", { _id: targetId }, updates);
      console.log('✅ Atualizado:', updated?.deliveryNumber);
    }

    if (!updated) {
      return res.status(500).json({ message: "Erro ao atualizar entrega" });
    }

    return res.json({ success: true, delivery: updated, message: "Entrega atualizada com sucesso" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao atualizar entrega" });
  }
});

/**
 * DELETE /api/admin/deliveries/:id
 * Deleta uma entrega (apenas admin)
 */
router.delete("/deliveries/:id", auth, onlyAdmin, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;

    // Busca entrega
    const db = await getDb(req);
    const delivery = await db.findById("deliveries", id);
    if (!delivery) {
      return res.status(404).json({ message: "Entrega não encontrada" });
    }
    
    // Validação de cidade
    if (delivery.cityCode !== city) {
      return res.status(403).json({ message: 'Acesso negado - dados de outra cidade' });
    }

      // Remove associated files from disk/S3 before deleting
    try {
      const { deleteDeliveryFiles } = require('../utils/storageUtils');
      const removed = await deleteDeliveryFiles(delivery);
      console.log('🗑️ Admin removed files for delivery', id, removed);
    } catch (err) {
      console.warn('⚠️ Error while removing files for delivery (admin):', err.message || err);
    }

    // CASCADE DELETE: Clear link from programação if exists
    try {
      const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
      await ProgramacaoEntrega.findByIdAndUpdate(
        { linkedDeliveryId: id },
        { linkedDeliveryId: null }
      );
      console.log('[DELIVERY] 🗑️ Cleared programação link for delivery', id);
    } catch (cascadeErr) {
      console.warn('[DELIVERY] ⚠️ Cascade cleanup error:', cascadeErr.message);
    }

    // Deleta entrega do banco
    const deleted = await db.deleteOne("deliveries", { _id: id });
    if (!deleted) {
      return res.status(500).json({ message: "Erro ao deletar entrega" });
    }

    return res.json({ success: true, message: "Entrega deletada com sucesso" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao deletar entrega (admin)" });
  }
});

/**
 * GET /api/admin/users
 * Lista todos os usuários
 */
router.get("/users", auth, async (req, res) => {
  try {
    // Permitir que gerentes, admins, GeoMar e Gestor Contratado visualizem a lista de usuários.
    const role = req.user?.role;
    if (!role || (role !== 'manager' && role !== 'admin' && role !== 'geomar' && role !== 'gestor_contratado')) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    const db = await getDb(req);
    const users = await db.find("drivers", {}) || [];
    const usersWithoutPasswords = users.map(u => ({
      _id: u._id,
      username: u.username,
      email: u.email,
      name: u.name || u.fullName,
      role: u.role,
      contratado: u.contratado || null,
      city: u.city || null
    }));
    return res.json({ users: usersWithoutPasswords });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao listar usuários" });
  }
});

/**
 * POST /api/admin/users
 * Criar novo usuário
 */
router.post("/users", auth, managerOnly, async (req, res) => {
  try {
    const { username, email, name, password, role, contratado, city } = req.body;

    if (!username || !email || !name || !password) {
      return res.status(400).json({ message: "Preencha todos os campos" });
    }
    if (role === 'gestor_contratado' && !contratado) {
      return res.status(400).json({ message: "Contratado é obrigatório para Gestor Contratado" });
    }
    if (role !== 'manager' && !city) {
      return res.status(400).json({ message: "Cidade é obrigatória para este perfil" });
    }

    // Normaliza username/email para minúsculas — login procura por username.toLowerCase()
    const normalizedUsername = String(username).toLowerCase();
    const normalizedEmail = String(email).toLowerCase();

    // Verifica se usuário existe (por username ou email)
    const db = await getDb(req);
    const allDrivers = await db.find('drivers', {}) || [];
    const existing = allDrivers.find(d => 
      String(d.username || '').toLowerCase() === normalizedUsername || 
      String(d.email || '').toLowerCase() === normalizedEmail
    );
    if (existing) {
      return res.status(400).json({ message: "Usuário já existe" });
    }

    const crypto = require('crypto');
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const newUser = {
      username: normalizedUsername,
      email: normalizedEmail,
      name,
      password: hashedPassword,
      role: role || 'driver',
      contratado: (role === 'gestor_contratado') ? contratado : null,
      city: (role !== 'manager') ? (city || 'manaus') : null,
      phone: '',
      isActive: true,
      createdAt: new Date()
    };

    // Use API do DB (mockdb or mongo adapter) to insert
    const created = await db.create('drivers', newUser);
    console.log('➕ Novo usuário criado:', { _id: created._id, username: created.username, email: created.email, role: created.role, city: created.city });

    return res.json({ 
      success: true, 
      message: "Usuário criado com sucesso",
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error('❌ Erro ao criar usuário:', err.message || err);
    console.error('Stack:', err.stack);
    return res.status(500).json({ message: "Erro ao criar usuário", error: err.message });
  }
});

/**
 * PUT /api/admin/users/:id
 * Atualizar usuário
 */
router.put("/users/:id", auth, managerOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, role, contratado, city } = req.body;

    const db = await getDb(req);
    const user = await db.findById("drivers", id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const updates = {};
    if (email) updates.email = email;
    if (name) {
      updates.name = name;
      updates.fullName = name;
    }
    if (role) {
      updates.role = role;
      // Validação: gestor_contratado precisa ter contratado
      if (role === 'gestor_contratado' && !contratado) {
        return res.status(400).json({ message: "Contratado é obrigatório para Gestor Contratado" });
      }
      // Atualizar contratado
      if (role === 'gestor_contratado' && contratado) {
        updates.contratado = contratado;
      } else if (role !== 'gestor_contratado') {
        updates.contratado = null;
      }
      // Atualizar city
      if (role === 'manager') {
        updates.city = null;
      } else if (city !== undefined) {
        updates.city = city;
      }
    } else if (city !== undefined) {
      // Se não mudou role mas mudou city: atualiza
      updates.city = city;
    }

    console.log('✏️ Atualizando usuário:', { userId: id, updates });

    await db.updateOne("drivers", { _id: id }, updates);

    return res.json({ 
      success: true, 
      message: "Usuário atualizado com sucesso"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao atualizar usuário" });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Deletar usuário
 */
router.delete("/users/:id", auth, managerOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb(req);
    const user = await db.findById("drivers", id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    await db.deleteOne("drivers", { _id: id });

    return res.json({ 
      success: true, 
      message: "Usuário deletado com sucesso"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao deletar usuário" });
  }
});

/**
 * GET /api/admin/programs
 * Lista programas criados
 */
router.get('/programs', auth, onlyAdmin, async (req, res) => {
  try {
    const db = req.mockdb;
    const programs = await db.find('programs', {});
    return res.json({ programs });
  } catch (err) {
    console.error('Erro ao listar programas:', err);
    return res.status(500).json({ message: 'Erro ao listar programas' });
  }
});

/**
 * POST /api/admin/programs
 * Salva uma programação (simples)
 */
router.post('/programs', auth, onlyAdmin, async (req, res) => {
  try {
    const db = await getDb(req);
    const payload = req.body || {};
    const program = await db.create('programs', Object.assign({}, payload, { createdAt: new Date().toISOString(), createdBy: req.user.id }));
    return res.json({ success: true, program });
  } catch (err) {
    console.error('Erro ao criar programação:', err);
    return res.status(500).json({ message: 'Erro ao criar programação' });
  }
});

// -------------------------
// Importar CSV de Programações
// POST /api/admin/programs/import
// Aceita multipart/form-data com campo 'file' (CSV) ou JSON { text: 'csv content' }
// -------------------------
const upload = multer({ dest: path.join(os.tmpdir(), 'geo_programs') });

function parseCsv(text) {
  const requiredHeaders = ['Processo','Recebedor','FORNECEDOR','Destinatário','Navio','Nr. vi','Nº container','NF','CNTR','Dt. Agendamento','Observação destino','CONTRATADO','PROCESSO2','PERFORMANCE','Ocorrencia'];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return { error: 'CSV vazio' };

  const header = lines[0].split(/,|\t/).map(h => h.trim());
  const missing = requiredHeaders.filter(h => !header.includes(h));
  if (missing.length) return { error: 'Cabeçalho inválido. Faltando colunas: ' + missing.join(', ') };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/,|\t/).map(c => c.trim());
    if (cols.length === 0 || cols.every(c => c === '')) continue;
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = cols[idx] || '';
    });
    rows.push(obj);
  }
  return { header, rows };
}

router.post('/programs/import', auth, onlyAdmin, upload.single('file'), async (req, res) => {
  try {
    const db = await getDb(req);

    let csvText = null;
    if (req.file && req.file.path) {
      csvText = fs.readFileSync(req.file.path, 'utf8');
      // remove temp file
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    } else if (req.body && req.body.text) {
      csvText = String(req.body.text || '');
    }

    if (!csvText) return res.status(400).json({ message: 'Nenhum CSV fornecido' });

    const parsed = parseCsv(csvText);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const created = [];
    for (const r of parsed.rows) {
      // Map 'Recebedor' column to 'recebedor' field (case-insensitive)
      const recebedor = r['Recebedor'] || r['recebedor'] || r['RECEBEDOR'] || '';
      // Preserve 'Dt. Agendamento' exactly as in CSV
      const dtAgendamento = r['Dt. Agendamento'] || r['dt. agendamento'] || r['DT. AGENDAMENTO'] || '';
      const program = await db.create('programs', Object.assign({}, r, { recebedor, dataAgendamento: dtAgendamento, createdAt: new Date().toISOString(), createdBy: req.user.id }));
      created.push(program);
    }

    return res.json({ success: true, created });
  } catch (err) {
    console.error('Erro ao importar programações:', err);
    return res.status(500).json({ message: 'Erro ao importar programações' });
  }
});

// Persistence test endpoint - verifies DB connectivity and uploads disk writability
router.get('/persistence/test', auth, onlyAdmin, async (req, res) => {
  try {
    const db = await getDb(req);
    const total = (await db.find('deliveries', {}))?.length || 0;

    // Attempt to write temp file to uploads dir
    const base = process.env.BACKEND_UPLOADS_DIR ? path.resolve(process.env.BACKEND_UPLOADS_DIR) : path.join(__dirname, '..', 'uploads');
    const testDir = path.join(base, 'persistence_test');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const testFile = path.join(testDir, `test-${Date.now()}.txt`);
    fs.writeFileSync(testFile, 'ok');
    const exists = fs.existsSync(testFile);
    // cleanup
    try { fs.unlinkSync(testFile); } catch(e){}

    return res.json({ success: true, mongodbConnected: !!process.env.MONGO_URI, deliveriesCount: total, uploadsWritable: !!exists, uploadsPath: base });
  } catch (err) {
    console.error('Persistence test error:', err);
    return res.status(500).json({ success: false, message: 'Persistence test failed', error: err.message });
  }
});

// Google Drive test endpoint - verifies if Google Drive integration is working
router.get('/gdrive/test', auth, onlyAdmin, async (req, res) => {
  try {
    console.log('[GDRIVE-TEST] Iniciando teste...');
    
    const { uploadFileToDrive } = require('../storage/gdrive');
    
    // Test file (1KB of random data)
    const testBuffer = Buffer.from('GDRIVE_TEST_' + Date.now() + '_' + Math.random().toString(36).substring(7));
    const testFilename = `TEST_GDRIVE_${Date.now()}.txt`;
    
    console.log('[GDRIVE-TEST] Tentando fazer upload de teste:', testFilename);
    
    const result = await uploadFileToDrive(testBuffer, testFilename, 'text/plain');
    
    console.log('[GDRIVE-TEST] ✓ Sucesso! Arquivo ID:', result.id);
    
    return res.json({ 
      success: true, 
      message: 'Google Drive está funcionando!',
      fileId: result.id,
      fileName: testFilename,
      webViewLink: result.webViewLink,
      folderId: process.env.GDRIVE_FOLDER_ID,
      note: 'Arquivo de teste foi criado no Google Drive. Você pode deletá-lo manualmente.'
    });
  } catch (err) {
    console.error('[GDRIVE-TEST] ✗ Erro:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Google Drive NÃO está funcionando',
      error: err.message,
      troubleshooting: [
        '1. Verifique se GOOGLE_CREDENTIALS_JSON está setado no Render',
        '2. Verifique se GOOGLE_TOKEN_JSON está setado no Render',
        '3. Verifique se GDRIVE_FOLDER_ID está setado no Render',
        '4. Acesse https://drive.google.com/drive/folders/YOUR_FOLDER_ID para confirmar que você tem acesso'
      ]
    });
  }
});

// DEBUG: export drivers to JSON file (admin only) - useful for backup
// Use: GET /api/admin/debug/export-drivers
router.get('/debug/export-drivers', auth, onlyAdmin, async (req, res) => {
  try {
    const db = await getDb(req);
    const drivers = await db.find('drivers', {});
    const exportDir = path.join(__dirname, '../data/exports');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const filename = `drivers-export-${Date.now()}.json`;
    const fullPath = path.join(exportDir, filename);
    fs.writeFileSync(fullPath, JSON.stringify({ drivers }, null, 2));
    return res.json({ success: true, message: 'Export realizado', path: fullPath });
  } catch (err) {
    console.error('Erro export drivers:', err);
    return res.status(500).json({ success: false, message: 'Erro ao exportar drivers' });
  }
});

// ========================
// MOTORISTA ROUTES
// ========================

/**
 * GET /api/admin/motoristas
 * Listar todos os motoristas
 */
router.get("/motoristas", auth, managerOnly, async (req, res) => {
  try {
    const Motorista = require("../models/Motorista");
    let motoristas = [];
    try {
      motoristas = await Promise.race([
        Motorista.find().sort({ createdAt: -1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
    } catch (mongoErr) {
      console.warn('[MOTORISTA] MongoDB não disponível, retornando array vazio');
      motoristas = [];
    }
    return res.json({ motoristas });
  } catch (err) {
    console.error('[MOTORISTA] ❌ Erro ao listar:', err);
    console.error(err.stack);
    return res.status(500).json({ message: "Erro ao listar motoristas", error: err.message });
  }
});

/**
 * GET /api/admin/contractors
 * Lista todos os contratados únicos (transportadoras)
 */
router.get("/contractors", auth, onlyAdmin, async (req, res) => {
  try {
    const Motorista = require("../models/Motorista");
    let motoristas = [];
    try {
      motoristas = await Motorista.find().select('transportadora').sort({ createdAt: -1 });
    } catch (mongoErr) {
      console.warn('[CONTRACTORS] MongoDB não disponível, retornando array vazio');
      motoristas = [];
    }
    
    // Extrair transportadoras únicas
    const contractors = [...new Set(
      (motoristas || [])
        .filter(m => m.transportadora && m.transportadora.trim())
        .map(m => m.transportadora.trim())
    )].sort();
    
    console.log('[CONTRACTORS] Retornando ', contractors.length, ' contratados únicos');
    return res.json({ contractors });
  } catch (err) {
    console.error('[CONTRACTORS] ❌ Erro ao listar:', err);
    return res.status(500).json({ message: "Erro ao listar contratados", error: err.message });
  }
});

/**
 * POST /api/admin/motoristas
 * Criar novo motorista
 */
router.post("/motoristas", auth, managerOnly, async (req, res) => {
  try {
    const {
      transportadora,
      nome,
      cpf,
      vinculo,
      rastreador,
      expCadastroMotorista,
      cavalo,
      rastreadorCavalo,
      expCadastroCavalo,
      carreta,
      rastreadorCarreta,
      expCadastroCarreta,
      telefone,
      observacoes
    } = req.body;

    console.log('[MOTORISTA] Recebido:', { transportadora, nome, cpf, vinculo, telefone });

    if (!transportadora || !nome || !cpf || !vinculo || !telefone) {
      return res.status(400).json({ message: "Preencha todos os campos obrigatórios" });
    }

    const Motorista = require("../models/Motorista");
    
    // Check if motorista already exists (same transportadora + cpf)
    const existing = await Motorista.findOne({ transportadora, cpf });
    if (existing) {
      return res.status(400).json({ message: "Motorista já existe para esta transportadora" });
    }

    const newMotorista = new Motorista({
      transportadora,
      nome,
      cpf,
      vinculo,
      rastreador: rastreador || '-',
      expCadastroMotorista: expCadastroMotorista || null,
      cavalo: cavalo || '',
      rastreadorCavalo: rastreadorCavalo || '',
      expCadastroCavalo: expCadastroCavalo || null,
      carreta: carreta || '',
      rastreadorCarreta: rastreadorCarreta || '',
      expCadastroCarreta: expCadastroCarreta || null,
      telefone,
      observacoes: observacoes || '',
      ativo: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const saved = await newMotorista.save();
    console.log('[MOTORISTA] ✅ Novo motorista criado:', { _id: saved._id, nome: saved.nome, cpf: saved.cpf });

    return res.status(201).json({
      success: true,
      message: "Motorista criado com sucesso",
      motorista: saved
    });
  } catch (err) {
    console.error('[MOTORISTA] ❌ Erro ao criar:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Motorista já existe para esta transportadora" });
    }
    return res.status(500).json({ message: "Erro ao criar motorista", error: err.message });
  }
});

/**
 * PUT /api/admin/motoristas/:id
 * Atualizar motorista
 */
router.put("/motoristas/:id", auth, managerOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      transportadora,
      nome,
      cpf,
      vinculo,
      rastreador,
      expCadastroMotorista,
      cavalo,
      rastreadorCavalo,
      expCadastroCavalo,
      carreta,
      rastreadorCarreta,
      expCadastroCarreta,
      telefone,
      observacoes,
      ativo
    } = req.body;

    console.log('[MOTORISTA] Atualizando:', { id, transportadora, nome, cpf });

    if (!transportadora || !nome || !cpf || !vinculo || !telefone) {
      return res.status(400).json({ message: "Preencha todos os campos obrigatórios" });
    }

    const Motorista = require("../models/Motorista");
    let motorista = null;
    try {
      motorista = await Promise.race([
        Motorista.findById(id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
    } catch (mongoErr) {
      console.warn('[MOTORISTA] MongoDB timeout ao buscar motorista');
      return res.status(500).json({ message: "Serviço temporariamente indisponível" });
    }
    if (!motorista) {
      return res.status(404).json({ message: "Motorista não encontrado" });
    }

    // Check if CPF is being changed and if new CPF already exists
    if (cpf !== motorista.cpf) {
      let existing = null;
      try {
        existing = await Promise.race([
          Motorista.findOne({ cpf, transportadora, _id: { $ne: id } }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
      } catch (mongoErr) {
        console.warn('[MOTORISTA] MongoDB timeout ao verificar CPF');
      }
      if (existing) {
        return res.status(400).json({ message: "CPF já existe para esta transportadora" });
      }
    }

    motorista.transportadora = transportadora;
    motorista.nome = nome;
    motorista.cpf = cpf;
    motorista.vinculo = vinculo;
    motorista.rastreador = rastreador || '-';
    motorista.expCadastroMotorista = expCadastroMotorista || null;
    motorista.cavalo = cavalo || '';
    motorista.rastreadorCavalo = rastreadorCavalo || '';
    motorista.expCadastroCavalo = expCadastroCavalo || null;
    motorista.carreta = carreta || '';
    motorista.rastreadorCarreta = rastreadorCarreta || '';
    motorista.expCadastroCarreta = expCadastroCarreta || null;
    motorista.telefone = telefone;
    motorista.observacoes = observacoes || '';
    if (ativo !== undefined) motorista.ativo = ativo;
    motorista.updatedAt = new Date();

    const updated = await motorista.save();
    console.log('[MOTORISTA] ✏️ Motorista atualizado:', { _id: updated._id, nome: updated.nome });

    return res.json({
      success: true,
      message: "Motorista atualizado com sucesso",
      motorista: updated
    });
  } catch (err) {
    console.error('[MOTORISTA] ❌ Erro ao atualizar:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "CPF já existe para esta transportadora" });
    }
    return res.status(500).json({ message: "Erro ao atualizar motorista", error: err.message });
  }
});

/**
 * DELETE /api/admin/motoristas/:id
 * Deletar motorista
 */
router.delete("/motoristas/:id", auth, managerOnly, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[MOTORISTA] Deletando:', id);

    const Motorista = require("../models/Motorista");
    const motorista = await Motorista.findById(id);
    if (!motorista) {
      return res.status(404).json({ message: "Motorista não encontrado" });
    }

    await Motorista.findByIdAndDelete(id);
    console.log('[MOTORISTA] 🗑️ Motorista deletado:', { _id: id, nome: motorista.nome });

    return res.json({
      success: true,
      message: "Motorista deletado com sucesso"
    });
  } catch (err) {
    console.error('[MOTORISTA] ❌ Erro ao deletar:', err);
    return res.status(500).json({ message: "Erro ao deletar motorista", error: err.message });
  }
});

/**
 * GET /api/admin/programacoes
 * Listar programações de entrega
 * Suporta filtro de período: ?period=today|yesterday|tomorrow&periodDate=DD/MM/YYYY
 */
router.get("/programacoes", auth, async (req, res) => {
  try {
    const { period, periodDate, startDate, endDate, page = 1, limit = 500 } = req.query;
    console.log('[PROGRAMACAO] Listando programações de entrega, filtros:', { period, periodDate, startDate, endDate, page, limit });

    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
    
    let cityFilter = {};
    const city = req.city || 'manaus';
    applyProgramacaoCityFilter(cityFilter, city);

    // Calcular o filtro de data para aplicar no DB sempre que possível
    let effectiveDate = '';
    let rangeStart = null;
    let rangeEnd = null;
    if (startDate) {
      rangeStart = new Date(startDate);
      rangeStart.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      rangeEnd = new Date(endDate);
      rangeEnd.setHours(23, 59, 59, 999);
    }

    if (periodDate && String(periodDate).trim()) {
      effectiveDate = String(periodDate).trim();
      console.log('🗓️  Usando periodDate do cliente:', effectiveDate);
    } else if (!startDate && !endDate && period && period !== 'general') {
      console.log('🗓️  Aplicando filtro de período:', period);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (period === 'yesterday') {
        today.setDate(today.getDate() - 1);
      } else if (period === 'tomorrow') {
        today.setDate(today.getDate() + 1);
      }
      effectiveDate = today.toLocaleDateString('pt-BR');
      console.log('   convertido para data efetiva:', effectiveDate);
    }

    const dbFilter = { ...cityFilter };
    if (effectiveDate) {
      if (city === 'itajai') {
        const cityOr = dbFilter.$or || [];
        delete dbFilter.$or;
        dbFilter.$and = [
          { $or: cityOr },
          {
            $or: [
              { dtColeta: effectiveDate },
              { dtColeta: { $in: [null, '', undefined] }, dataAgendamento: effectiveDate },
            ],
          },
        ];
      } else {
        dbFilter.dataAgendamento = effectiveDate;
      }
      console.log('📅 Aplicando filtro de data ao DB (data única):', dbFilter);
    }

    if (!effectiveDate && (rangeStart || rangeEnd)) {
      console.log('📅 Aplicando filtro de data por intervalo:', { rangeStart, rangeEnd });
      // dbFilter cannot reliably compare string dates, aplicamos filtro em memória abaixo
    }

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 500, 10), 1000);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const programacoes = await ProgramacaoEntrega.find(dbFilter)
      .sort({ dataAgendamento: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    let filtered = programacoes;

    // Fallback de refinamento em memória para formatos de data não padronizados
    if (effectiveDate) {
      const [edDay, edMonth, edYear] = effectiveDate.split('/').map(Number);
      filtered = filtered.filter(d => {
        const dateField = city === 'itajai' && d.dtColeta ? d.dtColeta : d.dataAgendamento;
        if (!dateField) return false;
        const progDateStr = String(dateField).trim();
        let pd;
        if (/\d{2}\/\d{2}\/\d{4}/.test(progDateStr)) {
          const parts = progDateStr.split(' ')[0].split('/');
          pd = { day: Number(parts[0]), month: Number(parts[1]), year: Number(parts[2]) };
        } else if (/\d{4}-\d{2}-\d{2}/.test(progDateStr)) {
          const parts = progDateStr.split('T')[0].split('-');
          pd = { day: Number(parts[2]), month: Number(parts[1]), year: Number(parts[0]) };
        } else {
          const tmp = new Date(progDateStr);
          if (!isNaN(tmp)) pd = { day: tmp.getDate(), month: tmp.getMonth() + 1, year: tmp.getFullYear() };
        }
        if (!pd) return false;
        return pd.day === edDay && pd.month === edMonth && pd.year === edYear;
      });
      console.log(`  ✓ ${filtered.length} programações após filtro de data única`);
    }

    if (!effectiveDate && (rangeStart || rangeEnd)) {
      filtered = filtered.filter(d => {
        const dateField = city === 'itajai' && d.dtColeta ? d.dtColeta : d.dataAgendamento;
        if (!dateField) return false;

        const progDateStr = String(dateField).trim();
        let progDate = null;

        if (/\d{2}\/\d{2}\/\d{4}/.test(progDateStr)) {
          const parts = progDateStr.split(' ')[0].split('/');
          progDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        } else if (/\d{4}-\d{2}-\d{2}/.test(progDateStr)) {
          const parts = progDateStr.split('T')[0].split('-');
          progDate = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        } else {
          const tmp = new Date(progDateStr);
          if (!isNaN(tmp)) progDate = tmp;
        }

        if (!progDate) return false;
        progDate.setHours(12, 0, 0, 0);

        if (rangeStart && progDate < rangeStart) return false;
        if (rangeEnd && progDate > rangeEnd) return false;
        return true;
      });
      console.log(`  ✓ ${filtered.length} programações após filtro por intervalo`);
    }

    // também trazemos entregas para permitir associação com motoristas (apenas da mesma cidade)
    // Otimizado: busca apenas entregas ativas/recentes para evitar timeout
    const db = await getDb(req);
    const allDeliveries = await db.find("deliveries", {
      cityCode: city,
      // Limita a entregas dos últimos 90 dias para performance
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    });

    // Cria mapas de entregas para lookup O(1)
    const deliveryNumberMap = new Map();
    const deliveryIdMap = new Map();
    allDeliveries.forEach(d => {
      const num = String(d.deliveryNumber || '').trim().toUpperCase();
      if (num) deliveryNumberMap.set(num, d);
      if (d._id) deliveryIdMap.set(String(d._id), d);
    });

    // vincular id de entrega correspondente (se existir) usando mapas otimizados
    const hasDocumentValue = (value) => Array.isArray(value) ? value.length > 0 : !!value;
    const enriched = (filtered || []).map(p => {
      const obj = p.toObject ? p.toObject() : { ...p };
      let match = null;

      if (obj.linkedDeliveryId) {
        match = deliveryIdMap.get(String(obj.linkedDeliveryId));
      }

      if (!match) {
        const num = String(p.processoLog || p.processo || p.container || '').trim().toUpperCase();
        match = num ? deliveryNumberMap.get(num) : null;
      }

      if (match) {
        obj.linkedDeliveryId = match._id;
        obj.status = match.status || obj.status;
        obj.missingDocumentsAtSubmit = match.missingDocumentsAtSubmit || [];
        const hasReturnProof = hasDocumentValue(match.documents?.devolucaoVazio) || hasDocumentValue(match.documents?.devolucaoContainerVazio);
        if (match.horarioDevolucaoVazio || hasReturnProof) {
          obj.horarioDevolucaoVazio = match.horarioDevolucaoVazio;
          obj.containerReturned = true;
          obj.status = 'FINALIZADO';
        }
        if (match.containerReturned !== undefined) {
          obj.containerReturned = match.containerReturned;
        }
      }

      return obj;
    });

    console.log('[PROGRAMACAO] ✅ Encontradas', enriched.length, 'programações');

    return res.json({
      success: true,
      programacoes: enriched,
      city: city
    });
  } catch (err) {
    console.error('[PROGRAMACAO] ❌ Erro ao listar:', err);
    return res.status(500).json({ message: "Erro ao listar programações", error: err.message });
  }
});

/**
 * POST /api/admin/programacoes
 * Criar nova programação de entrega
 */
router.post("/programacoes", auth, managerOnly, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const cfg = cityConfigFromRequest(city);
    const { processo, processoLog, recebedor, remetente, destinatario, container, dataAgendamento, dtColeta, contratado, motorista, status, observacoes, origem, estab, sentido } = req.body;

    console.log('[PROGRAMACAO] Criando:', { processo, recebedor, contratado, cidade: city, dtColeta });

    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");

    const novaProgramacao = new ProgramacaoEntrega({
      processo,
      processoLog: processoLog || '',
      recebedor,
      remetente: remetente || '',
      destinatario: destinatario || '',
      container,
      dataAgendamento,
      dtColeta: dtColeta || (city === 'itajai' ? dataAgendamento : ''),
      contratado,
      motorista,
      status,
      observacoes,
      origem: origem || cfg.origem,
      estab: estab || cfg.estab,
      sentido: String(sentido || '').trim().toUpperCase()
    });

    await novaProgramacao.save();
    console.log('[PROGRAMACAO] ✅ Criada:', { _id: novaProgramacao._id, processo, origem: novaProgramacao.origem });

    return res.status(201).json({
      success: true,
      message: "Programação criada com sucesso",
      programacao: novaProgramacao
    });
  } catch (err) {
    console.error('[PROGRAMACAO] ❌ Erro ao criar:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({ message: "Esse processo já existe" });
    }
    
    return res.status(500).json({ message: "Erro ao criar programação", error: err.message });
  }
});

/**
 * PUT /api/admin/programacoes/:id
 * Atualizar programação de entrega
 */
router.put("/programacoes/:id", auth, managerOnly, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;
    const { processo, processoLog, recebedor, remetente, destinatario, container, dataAgendamento, dtColeta, contratado, motorista, status, observacoes, containerReturned, origem, estab, sentido } = req.body;
    // Get editor name from logged-in user
    const editorName = req.user?.name || req.user?.username || req.user?._id || 'Desconhecido';

    console.log('[PROGRAMACAO] Atualizando:', { id, cidade: city, dtColeta });

    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
    
    const programacao = await ProgramacaoEntrega.findById(id);
    if (!programacao) {
      return res.status(404).json({ message: "Programação não encontrada" });
    }
    
    if (!userCanAccessProgramacaoCity(programacao, city)) {
      return res.status(403).json({ message: 'Acesso negado - programa��o de outra cidade' });
    }

    // Atualizar apenas os campos fornecidos
    if (processo !== undefined) programacao.processo = processo;
    if (processoLog !== undefined) programacao.processoLog = processoLog;
    if (recebedor !== undefined) programacao.recebedor = recebedor;
    if (remetente !== undefined) programacao.remetente = remetente;
    if (destinatario !== undefined) programacao.destinatario = destinatario;
    if (container !== undefined) programacao.container = container;
    if (dataAgendamento !== undefined) programacao.dataAgendamento = dataAgendamento;
    if (dtColeta !== undefined) programacao.dtColeta = dtColeta;
    if (contratado !== undefined) programacao.contratado = contratado;
    if (motorista !== undefined) programacao.motorista = motorista;
    if (status !== undefined) programacao.status = status;
    if (observacoes !== undefined) programacao.observacoes = observacoes;
    if (containerReturned !== undefined) programacao.containerReturned = containerReturned;
    if (origem !== undefined) programacao.origem = origem;
    if (estab !== undefined) programacao.estab = estab;
    if (sentido !== undefined) programacao.sentido = String(sentido || '').trim().toUpperCase();
    // Register editor and time
    programacao.editedBy = editorName;
    programacao.editedAt = new Date();

    try {
      await programacao.save();
      console.log('[PROGRAMACAO] ✅ Atualizada:', { _id: id, processo: programacao.processo, origem: programacao.origem });
      return res.json({
        success: true,
        message: "Programação atualizada com sucesso",
        programacao
      });
    } catch (saveErr) {
      console.error('[PROGRAMACAO] ❌ Erro ao salvar atualização:', saveErr);
      if (saveErr.code === 11000) {
        return res.status(400).json({ message: "Esse processo já existe" });
      }
      return res.status(500).json({ message: "Erro ao salvar atualização", error: saveErr.message });
    }
  } catch (err) {
    console.error('[PROGRAMACAO] ❌ Erro ao atualizar:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({ message: "Esse processo já existe" });
    }
    
    return res.status(500).json({ message: "Erro ao atualizar programação", error: err.message });
  }
});

/**
 * DELETE /api/admin/programacoes/:id
 * Deletar programação de entrega
 */
router.delete("/programacoes/:id", auth, managerOnly, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const { id } = req.params;

    console.log('[PROGRAMACAO] Deletando:', { id, cidade: city });

    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
    const programacao = await ProgramacaoEntrega.findById(id);
    if (!programacao) {
      return res.status(404).json({ message: "Programação não encontrada" });
    }
    
    if (!userCanAccessProgramacaoCity(programacao, city)) {
      return res.status(403).json({ message: 'Acesso negado - programa��o de outra cidade' });
    }

    // CASCADE DELETE: Remove linked delivery if exists
    if (programacao.linkedDeliveryId) {
      try {
        const Delivery = require("../models/Delivery");
        await Delivery.findByIdAndDelete(programacao.linkedDeliveryId);
        console.log('[PROGRAMACAO] 🗑️ Cascaded deletion: Delivery removed', { _id: programacao.linkedDeliveryId });
      } catch (cascadeErr) {
        console.warn('[PROGRAMACAO] ⚠️ Cascade delete error for delivery:', cascadeErr.message);
      }
    }

    await ProgramacaoEntrega.findByIdAndDelete(id);
    console.log('[PROGRAMACAO] 🗑️ Programação deletada:', { _id: id, processo: programacao.processo });

    return res.json({
      success: true,
      message: "Programação deletada com sucesso"
    });
  } catch (err) {
    console.error('[PROGRAMACAO] ❌ Erro ao deletar:', err);
    return res.status(500).json({ message: "Erro ao deletar programação", error: err.message });
  }
});

/**
 * POST /api/admin/programacoes/import
 * Importar múltiplas programações em batch
 */
router.post("/programacoes/import", auth, managerOnly, async (req, res) => {
  try {
    const city = req.city || 'manaus';
    const cfg = cityConfigFromRequest(city);
    const programacoes = req.body;

    if (!Array.isArray(programacoes)) {
      return res.status(400).json({ message: "Body deve ser um array de programações" });
    }

    if (programacoes.length === 0) {
      return res.status(400).json({ message: "Nenhuma programação para importar" });
    }

    console.log('[PROGRAMACAO] Importando', programacoes.length, 'programações em batch (cidade:', city, ')');

    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");
    
    const resultados = [];
    let importados = 0;
    let erros = 0;

    for (const prog of programacoes) {
      try {
        const { processo, processoLog, container, dataAgendamento, contratado, motorista, status, observacoes, origem, estab, sentido, remetente, destinatario } = prog;
        // Case-insensitive recebedor field
        const recebedorField = prog.recebedor || prog.Recebedor || prog.RECEBEDOR || '';

        // Validar campos obrigatórios
        if (!processo || !recebedorField || !dataAgendamento || !contratado) {
          erros++;
          resultados.push({
            processo: processo || 'N/A',
            sucesso: false,
            erro: 'Campos obrigatórios faltando: processo, recebedor, dataAgendamento, contratado'
          });
          continue;
        }

        // Tenta criar a programação
        const novaProgramacao = new ProgramacaoEntrega({
          processo,
          processoLog: processoLog || '',
          recebedor: recebedorField,
          remetente: remetente || '',
          destinatario: destinatario || '',
          container: container || '',
          dataAgendamento,
          contratado,
          motorista: motorista || '',
          status: status || 'AGENDADO',
          observacoes: observacoes || '',
          origem: origem || cfg.origem,
          estab: estab || cfg.estab,
          sentido: String(sentido || '').trim().toUpperCase()
        });

        await novaProgramacao.save();
        importados++;
        resultados.push({
          processo,
          sucesso: true,
          _id: novaProgramacao._id
        });
      } catch (err) {
        erros++;
        resultados.push({
          processo: prog.processo || 'N/A',
          sucesso: false,
          erro: err.code === 11000 ? 'Processo já existe' : err.message
        });
      }
    }

    console.log('[PROGRAMACAO] ✅ Import concluído:', { importados, erros, total: programacoes.length });

    return res.json({
      success: true,
      message: `${importados} programação(ões) importada(s) com sucesso${erros > 0 ? `, ${erros} erro(s)` : ''}`,
      importados,
      erros,
      resultados: erros > 0 ? resultados : undefined
    });
  } catch (err) {
    console.error('[PROGRAMACAO] ❌ Erro ao importar:', err);

    return res.status(500).json({ message: "Erro ao importar programações", error: err.message });
  }
});

/**
 * GET /api/admin/programacoes/sync/icompany
 * Sincronizar dados do Icompany para Programação de Entregas
 * Mapeia: Processo←processo, RECEBEDOR←destinatario, CONTAINER←containerNumero, STATUS=AGENDADO
 * Filtra dados baseado na cidade do usuário (Manaus vs Itajaí)
 */
router.get("/programacoes/sync/icompany", auth, managerOnly, async (req, res) => {
  try {
    console.log('[SYNC ICOMPANY] Iniciando sincronização');

    const { connectIfNeeded } = require("../db/mongo");
    await connectIfNeeded();

    const Icompany = require("../models/Icompany");
    const ProgramacaoEntrega = require("../models/ProgramacaoEntrega");

    const city = req.city || 'manaus';
    const cfg = cityConfigFromRequest(city);
    const cityFilter = {};
    applyIcompanyEstabFilter(cityFilter, city);
    
    console.log(`[SYNC ICOMPANY] Filtrando por cidade: ${city}`, cityFilter);

    const { startDate, endDate } = req.query;
    console.log('[SYNC ICOMPANY] Query params recebidos:', { startDate, endDate });

    // Primeiro, buscar registros do Icompany pela coluna Estab. da nova base.
    let icompanyRecords = await Icompany.find(cityFilter).lean();
    console.log(`[SYNC ICOMPANY] Encontrados ${icompanyRecords.length} registros no Icompany (antes de filtro de data)`);

    // Agora aplicar filtro de data se informado
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        const parsedStart = new Date(`${startDate}T00:00:00.000`);
        if (!isNaN(parsedStart.getTime())) dateFilter.$gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = new Date(`${endDate}T23:59:59.999`);
        if (!isNaN(parsedEnd.getTime())) dateFilter.$lte = parsedEnd;
      }
      if (Object.keys(dateFilter).length) {
        const scheduleFields = ['dtAgendamentoDescarga', 'dtColeta'];
        console.log('[SYNC ICOMPANY] Aplicando filtro de periodo:', { city, scheduleFields, startDate, endDate, dateFilter });

        // A cidade ja foi limitada pelo Estab. acima, entao ambas as cidades podem usar as duas datas sem misturar registros.
        icompanyRecords = icompanyRecords.filter(rec => {
          return scheduleFields.some((field) => {
            const dateVal = rec[field];
            if (!dateVal) return false;
            const dateObj = new Date(dateVal);
            if (isNaN(dateObj.getTime())) return false;
            if (dateFilter.$gte && dateObj < dateFilter.$gte) return false;
            if (dateFilter.$lte && dateObj > dateFilter.$lte) return false;
            return true;
          });
        });
        console.log(`[SYNC ICOMPANY] Apos filtro de data: ${icompanyRecords.length} registros`);
      }
    }

    // Buscar todos os processos já existentes para evitar duplicação e permitir atualização
    const existingFilter = {};
    applyProgramacaoCityFilter(existingFilter, city);
    const existingProgramacoes = await ProgramacaoEntrega.find(existingFilter).lean();
    const existingMap = new Map(existingProgramacoes.map(p => [String(p.processo || '').trim().toUpperCase(), p]));

    console.log(`[SYNC ICOMPANY] ${existingMap.size} processos já existentes`);

    // Converter função de data uma única vez
    const formatSyncDate = (raw) => {
      if (!raw) return '';
      const dtStr = String(raw).trim();
      if (!dtStr) return '';

      if (dtStr.includes(' ')) {
        const parts = dtStr.split(' ');
        return parts[0] + 'T' + parts[1].substring(0, 5);
      }
      if (dtStr.includes('T')) {
        return dtStr.substring(0, 16);
      }
      if (dtStr.includes('-')) {
        return dtStr.substring(0, 10) + 'T00:00';
      }
      return '';
    };


    const pickIcompanyValue = (record, fields) => {
      for (const field of fields) {
        const value = record?.[field];
        if (value !== undefined && value !== null && String(value).trim()) {
          return String(value).trim();
        }
      }
      return '';
    };
    let updatedCount = 0;
    let insertedCount = 0;
    const novosRegistros = [];

    for (const y of icompanyRecords) {
      const processoRaw = String(y.processo || '').trim();
      if (!processoRaw) continue;

      const processoKey = processoRaw.toUpperCase();
      const existing = existingMap.get(processoKey);

      let dataAgendamento = formatSyncDate(y.dtAgendamentoDescarga);
      if (!dataAgendamento) dataAgendamento = formatSyncDate(y.dtColeta);
      if (!dataAgendamento) dataAgendamento = new Date().toISOString().slice(0, 16);
      const dtColeta = formatSyncDate(y.dtColeta);
      const remetenteValue = String(y.remetente || '').trim();
      const destinatarioValue = String(y.destinatario || y.recebedor || '').trim();
      const recebedorValue = getClienteBySentido(y) || 'N/A';

      const observacaoIcompany = String(y.observacao || y.observacoes || '').trim();

      const mappedData = {
        processoLog: pickIcompanyValue(y, ['nrProcesso', 'Nr. do processo', 'Nr do processo', 'Nro. do processo', 'Numero do processo', 'N�mero do processo']),
        recebedor: recebedorValue,
        remetente: remetenteValue,
        destinatario: destinatarioValue,
        container: String(y.containerNumero || '').trim() || '',
        dataAgendamento,
        dtColeta,
        contratado: String(y.contratado || '').trim() || 'OUTRO',
        motorista: String(y.motorista || '').trim() || '',
        origem: String(y.origem || '').trim() || cfg.origem,
        estab: String(y.estab || '').trim() || cfg.estab,
        sentido: String(y.sentido || y.SENTIDO || '').trim().toUpperCase(),
        observacoes: observacaoIcompany || `Sincronizado do Icompany - ${y.situacao || 'N/A'}`
      };

      if (existing) {
        // Atualiza dados, mas mantém status atual
        await ProgramacaoEntrega.updateOne({ _id: existing._id }, { $set: mappedData });
        updatedCount++;
      } else {
        novosRegistros.push({
          processo: processoRaw,
          ...mappedData,
          status: 'AGENDADO'
        });
      }
    }

    console.log(`[SYNC ICOMPANY] ${updatedCount} registros existentes atualizados`);

    console.log(`[SYNC ICOMPANY] ${novosRegistros.length} novos registros para importar (sem duplicação)`);

    if (novosRegistros.length === 0) {
      return res.json({
        success: true,
        message: `${updatedCount} registro(s) atualizado(s) do Icompany`,
        atualizados: updatedCount,
        sincronizados: updatedCount,
        duplicados: icompanyRecords.length - updatedCount,
        total: icompanyRecords.length
      });
    }

    // Inserir novos registros
    const inserted = await ProgramacaoEntrega.insertMany(novosRegistros, { ordered: false });
    insertedCount = inserted.length;
    console.log(`[SYNC ICOMPANY] ✅ ${insertedCount} registros inseridos com sucesso`);

    const totalSynced = updatedCount + insertedCount;
    return res.json({
      success: true,
      message: `${insertedCount} novo(s) registro(s) sincronizado(s) do Icompany e ${updatedCount} existente(s) atualizado(s)`,
      sincronizados: totalSynced,
      atualizados: updatedCount,
      inseridos: insertedCount,
      duplicados: icompanyRecords.length - (updatedCount + insertedCount),
      total: icompanyRecords.length,
      registros: inserted
    });
  } catch (err) {
    console.error('[SYNC ICOMPANY] ❌ Erro ao sincronizar:', err);
    return res.status(500).json({ 
      success: false,
      message: "Erro ao sincronizar dados do Icompany", 
      error: err.message 
    });
  }
});

module.exports = router;
