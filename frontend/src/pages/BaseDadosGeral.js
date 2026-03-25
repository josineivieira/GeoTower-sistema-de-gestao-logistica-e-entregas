import React, { useEffect, useState, useRef, useCallback } from 'react';
import { adminService } from '../services/authService';
import {
  FaArrowLeft, FaFilter, FaSync, FaTimes,
  FaChevronLeft, FaChevronRight, FaEdit, FaTrash,
  FaDatabase, FaSearch, FaCheckCircle, FaExclamationCircle,
  FaCalendarAlt, FaTruck, FaBoxOpen, FaFileAlt, FaSave
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useCity } from '../contexts/CityContext';
import { getProgramacaoDate } from '../utils/programacaoDate';
import {
  getRecebedorLabel,
  getDesovaStepLabel
} from '../utils/cityLabels';
import Toast from '../components/Toast';

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
const fmtDate = (val) =>
  val ? new Date(val).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const toISO = (val) => {
  if (!val) return undefined;
  if (typeof val === 'string' && val.endsWith('Z')) return val;
  const d = new Date(val);
  return isNaN(d) ? val : d.toISOString();
};

const toDatetimeLocal = (val) => {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d)) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${date}T${hours}:${minutes}`;
};

/* ─────────────────────────────────────────
   Status helpers
───────────────────────────────────────── */
const STATUS_OPTIONS = [
  'ENTREGUE', 'submitted', 'FINALIZADO', 'pending', 'PENDING',
  'AGUARDANDO_DESOVA', 'EM_DESOVA', 'DESOVA_FINALIZADA',
  'ANEXANDO_DOCUMENTOS_FINAIS', 'CANCELADO',
  'CONTAINER_MONTADO', 'A_CAMINHO_DO_CLIENTE',
];

const formatStatus = (status) => {
  if (!status) return '—';
  if (status === 'ENTREGUE_COM_PENDENCIA_CANHOTO') status = 'FINALIZADO';
  if (status === 'FINALIZADO') return 'FINALIZADO';
  if (status === 'ENTREGUE' || status === 'submitted') return 'OPERAÇÃO FINALIZADA';
  if (status === 'pending' || status === 'PENDING') return 'A CAMINHO DO CLIENTE';
  return status.replace(/_/g, ' ');
};

const STATUS_COLOR = {
  'FINALIZADO': 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  'OPERAÇÃO FINALIZADA': 'bg-blue-100 text-blue-800 ring-blue-300',
  'A CAMINHO DO CLIENTE': 'bg-amber-100 text-amber-800 ring-amber-300',
  'AGUARDANDO DESOVA': 'bg-orange-100 text-orange-800 ring-orange-300',
  'EM DESOVA': 'bg-violet-100 text-violet-800 ring-violet-300',
  'DESOVA FINALIZADA': 'bg-teal-100 text-teal-800 ring-teal-300',
  'CANCELADO': 'bg-red-100 text-red-800 ring-red-300',
  'CONTAINER MONTADO': 'bg-cyan-100 text-cyan-800 ring-cyan-300',
  'ANEXANDO DOCUMENTOS FINAIS': 'bg-indigo-100 text-indigo-800 ring-indigo-300',
};
const statusBadge = (raw) => {
  const label = formatStatus(raw);
  return STATUS_COLOR[label] ?? 'bg-gray-100 text-gray-700 ring-gray-300';
};

const getDocumentsStatus = (delivery) => {
  if (!delivery) return { label: 'PENDENTE', complete: false };
  const required = ['canhotCTE', 'diarioBordo', 'canhotNF', 'devolucaoVazio'];
  const docs = delivery.documents || {};
  const allOk = required.every((d) => docs[d]);
  if (allOk) return { label: 'COMPLETO', complete: true };
  const names = required
    .filter((d) => !docs[d])
    .map((d) => ({ canhotCTE: 'CTE', canhotNF: 'NF', diarioBordo: 'DIÁRIO', devolucaoVazio: 'RIC' }[d] ?? d))
    .join(' + ');
  return { label: `FALTANDO ${names}`, complete: false };
};

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className={`flex items-center gap-3 bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-100 min-w-[160px]`}>
    <div className={`p-2 rounded-lg ${color}`}>
      <Icon size={18} className="text-white" />
    </div>
    <div>
      <p className="text-xs text-gray-500 leading-none mb-0.5">{label}</p>
      <p className="text-xl font-bold text-gray-800 leading-none">{value}</p>
    </div>
  </div>
);

/* Input / Textarea padronizados */
const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</label>
    {children}
  </div>
);

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition placeholder-gray-400';

/* ═══════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════ */
const BaseDadosGeral = () => {
  const navigate = useNavigate();
  const { city } = useCity();
  const tableRef = useRef(null);

  const [dados, setDados] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const [editForm, setEditForm] = useState({
    processo: '', recebedor: '', container: '',
    dataAgendamento: '', contratado: '', motorista: '',
    status: 'A CAMINHO DO CLIENTE',
    containerMontadoAt: '', horarioChegada: '',
    horarioInicioDesova: '', horarioFimDesova: '',
    horarioDevolucaoVazio: '', observations: '',
    submissionObservation: '', documentsJustification: '',
  });

  const [filters, setFilters] = useState({
    status: 'all', motorista: '', contratado: '', searchTerm: '',
  });

  /* ── Scroll arrows logic ── */
  const updateScrollButtons = useCallback(() => {
    const el = tableRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [filteredData, updateScrollButtons]);

  const scroll = (dir) => {
    tableRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  /* ── Data ── */
  const aplicarFiltros = useCallback(
    (src = dados) => {
      let f = src;
      if (filters.status !== 'all')
        f = f.filter((i) => i._entrega?.status === filters.status || i.status === filters.status);
      if (filters.motorista)
        f = f.filter((i) =>
          (i.motorista || '').toLowerCase().includes(filters.motorista.toLowerCase()) ||
          (i._entrega?.driverName || '').toLowerCase().includes(filters.motorista.toLowerCase())
        );
      if (filters.contratado)
        f = f.filter((i) => (i.contratado || '').toLowerCase().includes(filters.contratado.toLowerCase()));
      if (filters.searchTerm)
        f = f.filter((i) =>
          (i.processo || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          (i.recebedor || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          (i.container || '').toLowerCase().includes(filters.searchTerm.toLowerCase())
        );
      setFilteredData(f);
    },
    [dados, filters]
  );

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [progRes, entrRes] = await Promise.all([
        adminService.getProgramacoes(),
        adminService.getDeliveries({}),
      ]);
      const programacoes = progRes.data.programacoes || [];
      const entregas = entrRes.data.deliveries || [];
      const map = {};
      entregas.forEach((e) => {
        const k = (e.deliveryNumber || '').toUpperCase().trim();
        if (k) map[k] = e;
      });
      const enriched = programacoes.map((p) => ({
        ...p,
        _entrega:
          map[(p.container || '').toUpperCase().trim()] ||
          map[(p.processo || '').toUpperCase().trim()] ||
          null,
      }));
      setDados(enriched);
      aplicarFiltros(enriched);
    } catch {
      setToast({ message: 'Erro ao carregar dados', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);
  useEffect(() => { aplicarFiltros(); }, [filters]);

  /* ── Edit / Save / Delete ── */
  const handleEdit = (item) => {
    setEditingId(item._id);
    setEditForm({
      processo: item.processo,
      recebedor: item.recebedor,
      container: item.container,
      dataAgendamento:
        city === 'itajai'
          ? toDatetimeLocal(item.dtColeta || item.dataAgendamento)
          : toDatetimeLocal(item.dataAgendamento),
      contratado: item.contratado,
      motorista: item.motorista || '',
      status: item._entrega?.status || item.status || '',
      containerMontadoAt: toDatetimeLocal(item._entrega?.containerMontadoAt),
      horarioChegada: toDatetimeLocal(item._entrega?.horarioChegada || item._entrega?.arrivedAt),
      horarioInicioDesova: toDatetimeLocal(item._entrega?.horarioInicioDesova || item._entrega?.desovaStartAt),
      horarioFimDesova: toDatetimeLocal(item._entrega?.horarioFimDesova || item._entrega?.desovaEndAt),
      horarioDevolucaoVazio: toDatetimeLocal(item._entrega?.horarioDevolucaoVazio || item._entrega?.dtDevolucaoCNTR),
      observations: item._entrega?.observations || '',
      submissionObservation: item._entrega?.submissionObservation || '',
      documentsJustification: item._entrega?.documentsJustification || '',
    });
  };

  const handleSave = async () => {
    if (!editForm.processo || !editForm.recebedor || !editForm.dataAgendamento || !editForm.contratado) {
      setToast({ message: `Preencha: Processo, ${getRecebedorLabel(city)}, Data e Contratado`, type: 'error' });
      return;
    }
    try {
      const item = dados.find((d) => d._id === editingId);
      const progPayload = {
        processo: editForm.processo,
        recebedor: editForm.recebedor,
        container: editForm.container,
        contratado: editForm.contratado,
        motorista: editForm.motorista,
        dataAgendamento: toISO(editForm.dataAgendamento),
        ...(city === 'itajai' && { dtColeta: toISO(editForm.dataAgendamento) }),
      };
      console.log('[SAVE] Programacao payload:', progPayload);
      await adminService.updateProgramacao(editingId, progPayload);

      const delPayload = {
        status: editForm.status || undefined,
        containerMontadoAt: toISO(editForm.containerMontadoAt),
        horarioChegada: toISO(editForm.horarioChegada),
        horarioInicioDesova: toISO(editForm.horarioInicioDesova),
        horarioFimDesova: toISO(editForm.horarioFimDesova),
        horarioDevolucaoVazio: toISO(editForm.horarioDevolucaoVazio),
        observations: editForm.observations,
        submissionObservation: editForm.submissionObservation,
        documentsJustification: editForm.documentsJustification,
      };
      console.log('[SAVE] Delivery payload:', delPayload);
      const deliveryId = item?._entrega?._id;
      if (deliveryId) {
        try {
          console.log('[SAVE] Updating delivery:', deliveryId);
          await adminService.updateDelivery(deliveryId, delPayload);
          console.log('[SAVE] Delivery updated successfully');
        } catch (e) {
          console.warn('[SAVE] Delivery update error:', e);
          if (e?.response?.status !== 404) throw e;
        }
      } else {
        console.warn('[SAVE] No delivery ID found to update (skipping delivery update)');
      }

      setDados((prevDados) =>
        prevDados.map((d) => {
          if (d._id !== editingId) return d;
          return {
            ...d,
            _entrega: {
              ...(d._entrega || {}),
              containerMontadoAt: toISO(editForm.containerMontadoAt),
              horarioChegada: toISO(editForm.horarioChegada),
              horarioInicioDesova: toISO(editForm.horarioInicioDesova),
              horarioFimDesova: toISO(editForm.horarioFimDesova),
              horarioDevolucaoVazio: toISO(editForm.horarioDevolucaoVazio),
            }
          };
        })
      );

      setToast({ message: 'Registro atualizado com sucesso!', type: 'success' });
      setEditingId(null);
      // Aguarda um breve momento para garantir que o backend processou a atualização
      setTimeout(() => {
        carregarDados();
      }, 500);
    } catch (err) {
      console.error('[SAVE] Error:', err);
      setToast({ message: 'Erro ao salvar alterações', type: 'error' });
    }
  };

  const handleDelete = async (id, item) => {
    if (!window.confirm('Deseja excluir esta entrada? A entrega também será removida.')) return;
    try {
      await adminService.deleteProgramacao(id);
      if (item._entrega?._id) await adminService.deleteDelivery(item._entrega._id);
      setToast({ message: 'Excluído com sucesso', type: 'success' });
      carregarDados();
    } catch {
      setToast({ message: 'Erro ao excluir', type: 'error' });
    }
  };

  /* ── Stats ── */
  const totalFinalizado = dados.filter(
    (d) => ['FINALIZADO', 'ENTREGUE', 'submitted'].includes(d._entrega?.status || d.status)
  ).length;
  const totalPendente = dados.filter(
    (d) => ['pending', 'PENDING', 'A_CAMINHO_DO_CLIENTE'].includes(d._entrega?.status || d.status)
  ).length;

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">

      {/* ── TOP BAR ── */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/5 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <FaArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500 rounded-xl shadow-lg shadow-violet-500/40">
              <FaDatabase size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">Base de Dados Geral</h1>
              <p className="text-xs text-violet-300 mt-0.5">Gerenciamento de programações e entregas</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => { carregarDados(); setToast({ message: 'Dados recarregados!', type: 'success' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-violet-500/30"
        >
          <FaSync size={14} />
          Atualizar
        </button>
      </header>

      {/* ── STATS ── */}
      <div className="px-6 py-4 flex gap-3 flex-wrap">
        <StatCard icon={FaDatabase} label="Total" value={dados.length} color="bg-violet-500" />
        <StatCard icon={FaFilter} label="Filtrados" value={filteredData.length} color="bg-blue-500" />
        <StatCard icon={FaCheckCircle} label="Finalizados" value={totalFinalizado} color="bg-emerald-500" />
        <StatCard icon={FaTruck} label="Em rota" value={totalPendente} color="bg-amber-500" />
      </div>

      {/* ── FILTER BAR ── */}
      <div className="px-6 pb-4">
        <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                showFilters ? 'bg-violet-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <FaFilter size={13} />
              Filtros
            </button>
            <div className="flex-1 relative">
              <FaSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300" />
              <input
                type="text"
                placeholder={`Buscar processo, ${getRecebedorLabel(city).toLowerCase()}, container…`}
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                className="w-full pl-9 pr-4 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white placeholder-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white/15 transition"
              />
            </div>
          </div>

          {showFilters && (
            <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/10 pt-4">
              <div>
                <label className="block text-xs font-semibold text-violet-300 uppercase tracking-wide mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="all" className="text-gray-800">Todos</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} className="text-gray-800">{formatStatus(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-violet-300 uppercase tracking-wide mb-1">Motorista</label>
                <input
                  type="text"
                  placeholder="Nome do motorista…"
                  value={filters.motorista}
                  onChange={(e) => setFilters({ ...filters, motorista: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white placeholder-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-violet-300 uppercase tracking-wide mb-1">Contratado</label>
                <input
                  type="text"
                  placeholder="Nome do contratado…"
                  value={filters.contratado}
                  onChange={(e) => setFilters({ ...filters, contratado: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white placeholder-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <button
                  onClick={() => setFilters({ status: 'all', motorista: '', contratado: '', searchTerm: '' })}
                  className="px-4 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition font-semibold"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── TABLE AREA ── */}
      <div className="flex-1 px-6 pb-6 flex flex-col min-h-0">
        <div className="relative flex-1 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Scroll arrows */}
          {canScrollLeft && (
            <button
              onClick={() => scroll(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 flex items-center justify-center bg-violet-600 hover:bg-violet-500 text-white rounded-full shadow-xl transition"
            >
              <FaChevronLeft size={16} />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scroll(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 flex items-center justify-center bg-violet-600 hover:bg-violet-500 text-white rounded-full shadow-xl transition"
            >
              <FaChevronRight size={16} />
            </button>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
              <p className="text-gray-500 font-medium">Carregando registros…</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
              <FaDatabase size={40} className="opacity-30" />
              <p className="font-medium">Nenhum registro encontrado</p>
            </div>
          ) : (
            <div
              ref={tableRef}
              className="overflow-x-auto overflow-y-auto flex-1 scroll-smooth"
              style={{ scrollbarWidth: 'thin' }}
            >
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-violet-700 to-violet-800 text-white">
                    {[
                      'Ações',
                      'Processo',
                      getRecebedorLabel(city),
                      'Container',
                      'Agendamento',
                      'Contratado',
                      'Motorista',
                      'Status',
                      'Retirada Cheio',
                      'Chegada',
                      `Início ${getDesovaStepLabel(city)}`,
                      `Fim ${getDesovaStepLabel(city)}`,
                      'Entrega CNTR Porto',
                      'Documentos',
                      'Observações',
                    ].map((col, idx) => (
                      <th
                        key={col}
                        className={`px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b border-violet-600 ${
                          col === 'Ações'
                            ? 'text-center pl-4'
                            : 'text-left' + (idx === 1 ? ' pl-6' : '')
                        }`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((item, idx) => {
                    const docStatus = getDocumentsStatus(item._entrega);
                    const rawStatus = item._entrega?.status || item.status;
                    return (
                      <tr
                        key={item._id}
                        className={`group transition-colors duration-150 hover:bg-violet-50 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                        }`}
                      >
                        {/* Ações */}
                        <td className="px-4 py-3 whitespace-nowrap text-center sticky left-0 bg-white group-hover:bg-violet-50 shadow-[4px_0_8px_rgba(0,0,0,0.05)] z-10">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              title="Editar"
                              className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm"
                            >
                              <FaEdit size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(item._id, item)}
                              title="Excluir"
                              className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition shadow-sm"
                            >
                              <FaTrash size={13} />
                            </button>
                          </div>
                        </td>
                        {/* Processo */}
                        <td className="px-4 py-3 first:pl-6 whitespace-nowrap">
                          <span className="font-semibold text-violet-700 text-xs">{item.processo}</span>
                        </td>
                        {/* Recebedor */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{item.recebedor}</td>
                        {/* Container */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-600">{item.container || '—'}</td>
                        {/* Data Agendamento */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <FaCalendarAlt size={10} className="text-violet-400" />
                            {getProgramacaoDate(item, city) ? fmtDate(getProgramacaoDate(item, city)) : '—'}
                          </span>
                        </td>
                        {/* Contratado */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{item.contratado}</td>
                        {/* Motorista */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">
                          <span className="flex items-center gap-1">
                            <FaTruck size={10} className="text-gray-400" />
                            {item.motorista || item._entrega?.driverName || '—'}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${statusBadge(rawStatus)}`}>
                            {formatStatus(rawStatus)}
                          </span>
                        </td>
                        {/* Retirada */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{fmtDate(item._entrega?.containerMontadoAt)}</td>
                        {/* Chegada */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {fmtDate(item._entrega?.horarioChegada || item._entrega?.arrivedAt)}
                        </td>
                        {/* Início Desova */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {fmtDate(item._entrega?.horarioInicioDesova || item._entrega?.desovaStartAt)}
                        </td>
                        {/* Fim Desova */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {fmtDate(item._entrega?.horarioFimDesova || item._entrega?.desovaEndAt)}
                        </td>
                        {/* Devolução */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {fmtDate(item._entrega?.horarioDevolucaoVazio || item._entrega?.dtDevolucaoCNTR)}
                        </td>
                        {/* Docs */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${
                            docStatus.complete
                              ? 'bg-emerald-100 text-emerald-700 ring-emerald-300'
                              : 'bg-rose-100 text-rose-700 ring-rose-300'
                          }`}>
                            {docStatus.complete
                              ? <FaCheckCircle size={9} />
                              : <FaExclamationCircle size={9} />}
                            {docStatus.label}
                          </span>
                        </td>
                        {/* Obs */}
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate" title={item._entrega?.observations}>
                          {item._entrega?.observations || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          MODAL DE EDIÇÃO
      ═══════════════════════════════════════ */}
      {editingId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-700 to-violet-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <FaEdit size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white leading-none">Editar Registro</h2>
                  <p className="text-xs text-violet-200 mt-0.5">Programação e dados de entrega</p>
                </div>
              </div>
              <button
                onClick={() => setEditingId(null)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* ─ Seção Programação ─ */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-violet-100 rounded-lg">
                      <FaFileAlt size={14} className="text-violet-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">Programação</h3>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="space-y-3">
                    <Field label="Processo *">
                      <input className={inputCls} value={editForm.processo}
                        onChange={(e) => setEditForm({ ...editForm, processo: e.target.value })} />
                    </Field>
                    <Field label={`${getRecebedorLabel(city)} *`}>
                      <input className={inputCls} value={editForm.recebedor}
                        onChange={(e) => setEditForm({ ...editForm, recebedor: e.target.value })} />
                    </Field>
                    <Field label="Container">
                      <input className={inputCls} value={editForm.container}
                        onChange={(e) => setEditForm({ ...editForm, container: e.target.value })} />
                    </Field>
                    <Field label="Data Agendamento *">
                      <input type="datetime-local" className={inputCls} value={editForm.dataAgendamento}
                        onChange={(e) => setEditForm({ ...editForm, dataAgendamento: e.target.value })} />
                    </Field>
                    <Field label="Contratado *">
                      <input className={inputCls} value={editForm.contratado}
                        onChange={(e) => setEditForm({ ...editForm, contratado: e.target.value })} />
                    </Field>
                    <Field label="Motorista">
                      <input className={inputCls} value={editForm.motorista}
                        onChange={(e) => setEditForm({ ...editForm, motorista: e.target.value })} />
                    </Field>
                    <Field label="Status">
                      <select className={inputCls} value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                        <option value="">Selecione…</option>
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{formatStatus(s)}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>

                {/* ─ Seção Entrega ─ */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <FaBoxOpen size={14} className="text-blue-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">Entrega</h3>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="space-y-3">
                    <Field label="Data Retirada Cheio">
                      <input type="datetime-local" className={inputCls} value={editForm.containerMontadoAt}
                        onChange={(e) => setEditForm({ ...editForm, containerMontadoAt: e.target.value })} />
                    </Field>
                    <Field label="Horário Chegada">
                      <input type="datetime-local" className={inputCls} value={editForm.horarioChegada}
                        onChange={(e) => setEditForm({ ...editForm, horarioChegada: e.target.value })} />
                    </Field>
                    <Field label={`Início ${getDesovaStepLabel(city)}`}>
                      <input type="datetime-local" className={inputCls} value={editForm.horarioInicioDesova}
                        onChange={(e) => setEditForm({ ...editForm, horarioInicioDesova: e.target.value })} />
                    </Field>
                    <Field label={`Fim ${getDesovaStepLabel(city)}`}>
                      <input type="datetime-local" className={inputCls} value={editForm.horarioFimDesova}
                        onChange={(e) => setEditForm({ ...editForm, horarioFimDesova: e.target.value })} />
                    </Field>
                    <Field label="Entrega CNTR Porto">
                      <input type="datetime-local" className={inputCls} value={editForm.horarioDevolucaoVazio}
                        onChange={(e) => setEditForm({ ...editForm, horarioDevolucaoVazio: e.target.value })} />
                    </Field>
                    <Field label="Observações">
                      <textarea rows={2} className={inputCls} value={editForm.observations}
                        onChange={(e) => setEditForm({ ...editForm, observations: e.target.value })} />
                    </Field>
                    <Field label="Obs. Submissão">
                      <textarea rows={2} className={inputCls} value={editForm.submissionObservation}
                        onChange={(e) => setEditForm({ ...editForm, submissionObservation: e.target.value })} />
                    </Field>
                    <Field label="Justificativa Docs">
                      <textarea rows={2} className={inputCls} value={editForm.documentsJustification}
                        onChange={(e) => setEditForm({ ...editForm, documentsJustification: e.target.value })} />
                    </Field>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition shadow-lg shadow-violet-500/30"
              >
                <FaSave size={15} />
                Salvar Alterações
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition"
              >
                <FaTimes size={15} />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default BaseDadosGeral;
