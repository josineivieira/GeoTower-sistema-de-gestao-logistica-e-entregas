import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Toast from '../components/Toast';
import { deliveryService } from '../services/authService';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Area, AreaChart,
} from 'recharts';
import {
  FaArrowLeft, FaEye, FaSearch, FaBoxOpen,
  FaCheckCircle, FaTimesCircle, FaHourglassHalf,
  FaSync, FaChartPie, FaList, FaTruck,
  FaCalendarAlt, FaArrowUp, FaArrowDown,
} from 'react-icons/fa';
import { MdLocalShipping, MdInventory2, MdTrendingUp } from 'react-icons/md';
import { useCity } from '../contexts/CityContext';
import { getRecebedorLabel } from '../utils/cityLabels';

/* ═══════════════════════════════════════════════════════
   CONSTANTS & HELPERS
═══════════════════════════════════════════════════════ */
const STATUS_CONFIG = {
  ENTREGUE:   { label: 'Entregue',   color: '#10b981', tailwind: 'emerald' },
  FINALIZADO: { label: 'Finalizado', color: '#3b82f6', tailwind: 'blue'    },
  CANCELADO:  { label: 'Cancelado',  color: '#ef4444', tailwind: 'red'     },
  AGENDADO:   { label: 'Agendado',   color: '#f59e0b', tailwind: 'amber'   },
  PENDENTE:   { label: 'Pendente',   color: '#f97316', tailwind: 'orange'  },
};

const getStatusCfg = (status) => {
  const key = String(status || '').toUpperCase();
  return STATUS_CONFIG[key] || STATUS_CONFIG.PENDENTE;
};

const badgeClass = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  blue:    'bg-blue-50    text-blue-700    ring-1 ring-blue-200',
  red:     'bg-red-50     text-red-700     ring-1 ring-red-200',
  amber:   'bg-amber-50   text-amber-700   ring-1 ring-amber-200',
  orange:  'bg-orange-50  text-orange-700  ring-1 ring-orange-200',
};

const dotClass = {
  emerald: 'bg-emerald-400',
  blue:    'bg-blue-400',
  red:     'bg-red-400',
  amber:   'bg-amber-400',
  orange:  'bg-orange-400',
};

const fmtDate = (d) => new Date(d).toLocaleString('pt-BR');
const fmtMonth = (d) => new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

/* ── build chart data from programacoes ── */
function buildChartData(list) {
  /* Status distribution */
  const statusCount = {};
  list.forEach((p) => {
    const key = String(p.status || 'PENDENTE').toUpperCase();
    statusCount[key] = (statusCount[key] || 0) + 1;
  });
  const pieData = Object.entries(statusCount).map(([k, v]) => ({
    name:  (STATUS_CONFIG[k] || STATUS_CONFIG.PENDENTE).label,
    value: v,
    color: (STATUS_CONFIG[k] || STATUS_CONFIG.PENDENTE).color,
  }));

  /* Deliveries per month */
  const monthMap = {};
  list.forEach((p) => {
    const key = fmtMonth(p.dataAgendamento);
    if (!monthMap[key]) monthMap[key] = { month: key, total: 0, entregues: 0, pendentes: 0, cancelados: 0 };
    monthMap[key].total++;
    const s = String(p.status || '').toUpperCase();
    if (['ENTREGUE', 'FINALIZADO'].includes(s)) monthMap[key].entregues++;
    else if (s === 'CANCELADO')                  monthMap[key].cancelados++;
    else                                          monthMap[key].pendentes++;
  });
  const barData = Object.values(monthMap).slice(-6); // last 6 months

  /* Weekly trend – deliveries per day-of-week */
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dayMap   = Object.fromEntries(dayNames.map((d) => [d, { day: d, entregas: 0 }]));
  list.forEach((p) => {
    const idx = new Date(p.dataAgendamento).getDay();
    dayMap[dayNames[idx]].entregas++;
  });
  const lineData = Object.values(dayMap);

  return { pieData, barData, lineData };
}

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════ */

/* KPI Card */
const KpiCard = ({ icon: Icon, label, value, sub, gradient, delta }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg ${gradient}`}>
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-75 mb-1">{label}</p>
        <p className="text-4xl font-black leading-none">{value}</p>
        {sub && <p className="text-xs opacity-70 mt-1.5">{sub}</p>}
        {delta !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${delta >= 0 ? 'text-green-200' : 'text-red-200'}`}>
            {delta >= 0 ? <FaArrowUp /> : <FaArrowDown />}
            {Math.abs(delta)}% vs mês anterior
          </div>
        )}
      </div>
      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0 ml-3">
        <Icon className="text-2xl text-white" />
      </div>
    </div>
    <div className="absolute -bottom-5 -right-5 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
    <div className="absolute -top-5 -left-5  w-20 h-20 rounded-full bg-white/5  pointer-events-none" />
  </div>
);

/* Skeleton Card */
const Skeleton = () => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
    <div className="h-5 bg-gray-200 rounded-full w-48 mb-4" />
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i}>
          <div className="h-3 bg-gray-200 rounded-full w-20 mb-2" />
          <div className="h-4 bg-gray-200 rounded-full w-28" />
        </div>
      ))}
    </div>
  </div>
);

/* Field Item */
const Field = ({ label, value, small }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
    <span className={`font-semibold text-gray-700 ${small ? 'text-xs' : 'text-sm'}`}>{value}</span>
  </div>
);

/* Chart wrapper card */
const ChartCard = ({ title, subtitle, children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 ${className}`}>
    <div className="mb-4">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

/* Custom tooltip for recharts */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl">
      {label && <p className="font-bold mb-1 opacity-70">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

/* Progress bar */
const ProgressBar = ({ label, value, max, color }) => {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold text-gray-700 w-10 text-right">{value}</span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   DASHBOARD VIEW
═══════════════════════════════════════════════════════ */
const DashboardView = ({ data }) => {
  const { pieData, barData, lineData } = buildChartData(data);

  const total     = data.length;
  const entregues = data.filter(p => ['ENTREGUE','FINALIZADO'].includes(String(p.status||'').toUpperCase())).length;
  const pendentes = data.filter(p => !['ENTREGUE','FINALIZADO','CANCELADO'].includes(String(p.status||'').toUpperCase())).length;
  const cancelados= data.filter(p => String(p.status||'').toUpperCase() === 'CANCELADO').length;
  const taxa      = total ? Math.round((entregues / total) * 100) : 0;

  /* próxima entrega */
  const now = Date.now();
  const proxima = data
    .filter(p => !['ENTREGUE','FINALIZADO','CANCELADO'].includes(String(p.status||'').toUpperCase()))
    .filter(p => new Date(p.dataAgendamento).getTime() >= now)
    .sort((a,b) => new Date(a.dataAgendamento) - new Date(b.dataAgendamento))[0];

  return (
    <div className="space-y-6">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={MdInventory2}
          label="Total"
          value={total}
          sub="Todas as programações"
          gradient="bg-gradient-to-br from-purple-600 to-indigo-700"
        />
        <KpiCard
          icon={FaCheckCircle}
          label="Entregues"
          value={entregues}
          sub={`${taxa}% de conclusão`}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          delta={12}
        />
        <KpiCard
          icon={FaHourglassHalf}
          label="Pendentes"
          value={pendentes}
          sub="Aguardando entrega"
          gradient="bg-gradient-to-br from-amber-400 to-orange-500"
        />
        <KpiCard
          icon={FaTimesCircle}
          label="Canceladas"
          value={cancelados}
          sub="Fora de operação"
          gradient="bg-gradient-to-br from-red-500 to-rose-600"
          delta={-5}
        />
      </div>

      {/* ── Taxa de Conclusão + Próxima Entrega ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Taxa */}
        <ChartCard title="Taxa de Conclusão" subtitle="Distribuição por status">
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 shrink-0">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="url(#grad)" strokeWidth="3"
                  strokeDasharray={`${taxa} ${100 - taxa}`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%"   stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-xl font-black text-gray-800">{taxa}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5">
              {[
                { label: 'Entregues',  value: entregues,  color: '#10b981' },
                { label: 'Pendentes',  value: pendentes,  color: '#f97316' },
                { label: 'Cancelados', value: cancelados, color: '#ef4444' },
              ].map((r) => (
                <ProgressBar key={r.label} {...r} max={total} />
              ))}
            </div>
          </div>
        </ChartCard>

        {/* Próxima Entrega */}
        <ChartCard
          title="Próxima Entrega"
          subtitle="Agendamento mais próximo"
          className="lg:col-span-2"
        >
          {proxima ? (
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center shrink-0">
                <MdLocalShipping className="text-2xl text-purple-600" />
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Processo</p>
                  <p className="text-sm font-extrabold text-gray-800">{proxima.processo}</p>
                </div>
                {proxima.container && (
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Container</p>
                    <p className="text-sm font-bold text-gray-700">{proxima.container}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Agendado para</p>
                  <p className="text-sm font-bold text-purple-600">{fmtDate(proxima.dataAgendamento)}</p>
                </div>
                {proxima.motorista && proxima.motorista !== '-' && (
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Motorista</p>
                    <p className="text-sm font-bold text-gray-700">{proxima.motorista}</p>
                  </div>
                )}
                {proxima.recebedor && (
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Recebedor</p>
                    <p className="text-xs font-bold text-gray-700">{proxima.recebedor}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-gray-400">
              <FaCalendarAlt className="text-3xl mb-2 opacity-30" />
              <p className="text-sm">Nenhuma entrega agendada</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Donut */}
        <ChartCard title="Distribuição por Status" subtitle="Total de programações">
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <RTooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-gray-600">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">
              Sem dados suficientes
            </div>
          )}
        </ChartCard>

        {/* Bar por mês */}
        <ChartCard title="Entregas por Mês" subtitle="Últimos 6 meses">
          {barData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barSize={14} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                <RTooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="entregues"  name="Entregues"  fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="pendentes"  name="Pendentes"  fill="#f97316" radius={[4,4,0,0]} />
                <Bar dataKey="cancelados" name="Cancelados" fill="#ef4444" radius={[4,4,0,0]} />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-gray-600">{v}</span>}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">
              Sem dados suficientes
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Area Chart: volume por dia da semana ── */}
      <ChartCard
        title="Volume por Dia da Semana"
        subtitle="Distribuição de entregas ao longo da semana"
      >
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={lineData}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
            <RTooltip content={<CustomTooltip />} />
            <Area
              type="monotone" dataKey="entregas" name="Entregas"
              stroke="#8b5cf6" strokeWidth={2.5}
              fill="url(#areaGrad)" dot={{ fill: '#8b5cf6', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#8b5cf6' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   LIST VIEW (unchanged logic, new style)
═══════════════════════════════════════════════════════ */
const ListView = ({ data, navigate }) => (
  data.length === 0 ? (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center mb-5">
        <FaBoxOpen className="text-3xl text-purple-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-700 mb-1">Nenhuma entrega encontrada</h3>
      <p className="text-sm text-gray-400 max-w-xs">Ajuste os filtros ou recarregue a página.</p>
    </div>
  ) : (
    <div className="space-y-3">
      {data.map((prog, idx) => {
        const sc  = getStatusCfg(prog.status);
        const bdg = badgeClass[sc.tailwind];
        const dot = dotClass[sc.tailwind];

        return (
          <div
            key={prog._id}
            style={{ animationDelay: `${idx * 40}ms` }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-purple-200 transition-all duration-300"
          >
            {/* header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                  <MdLocalShipping className="text-purple-600 text-lg" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Processo</p>
                  <p className="text-base font-extrabold text-gray-800">{prog.processo}</p>
                </div>
              </div>
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${bdg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dot} animate-pulse`} />
                {sc.label}
              </span>
            </div>

            {/* body */}
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                <Field label="Data Agendamento" value={fmtDate(prog.dataAgendamento)} />
                {prog.container  && <Field label="Container"  value={prog.container} />}
                {prog.motorista && prog.motorista !== '-' && <Field label="Motorista" value={prog.motorista} />}
                {prog.recebedor  && <Field label={getRecebedorLabel(city)}  value={prog.recebedor} small />}
                {prog.contratado && <Field label="Contratado" value={prog.contratado} />}
              </div>
            </div>

            {/* footer */}
            <div className="flex justify-end px-5 py-3 border-t border-gray-50 rounded-b-2xl bg-gray-50/40">
              <button
                onClick={() => navigate('/programacoes')}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl shadow-sm transition-all duration-200"
              >
                <FaEye /> Ver Detalhes
              </button>
            </div>
          </div>
        );
      })}
    </div>
  )
);

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
const MinhasEntregas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { city } = useCity();

  const [allProgramacoes,       setAllProgramacoes]       = useState([]);
  const [displayedProgramacoes, setDisplayedProgramacoes] = useState([]);
  const [filter,                setFilter]                = useState('all');
  const [searchTerm,            setSearchTerm]            = useState('');
  const [debouncedSearch,       setDebouncedSearch]       = useState('');
  const [loading,               setLoading]               = useState(true);
  const [toast,                 setToast]                 = useState(null);
  const [activeView,            setActiveView]            = useState('dashboard'); // 'dashboard' | 'list'

  /* ── Debounce ── */
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(id);
  }, [searchTerm]);

  /* ── Load ── */
  useEffect(() => {
    loadProgramacoes();
    if (location.state?.toast) {
      setToast(location.state.toast);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Filter ── */
  useEffect(() => {
    let filtered = allProgramacoes.filter(
      p => !(Array.isArray(p.missingDocumentsAtSubmit) && p.missingDocumentsAtSubmit.length > 0)
    );

    if (filter === 'pendentes') {
      filtered = filtered.filter(p => !['ENTREGUE','FINALIZADO','CANCELADO'].includes(String(p.status||'').toUpperCase()));
    } else if (filter === 'enviadas') {
      filtered = filtered.filter(p => ['ENTREGUE','FINALIZADO','CANCELADO'].includes(String(p.status||'').toUpperCase()));
    }

    if (debouncedSearch.trim()) {
      const term = debouncedSearch.trim().toUpperCase();
      filtered = filtered.filter(p =>
        String(p.processo  ||'').toUpperCase().includes(term) ||
        String(p.container ||'').toUpperCase().includes(term) ||
        String(p.recebedor ||'').toUpperCase().includes(term) ||
        String(p.motorista ||'').toUpperCase().includes(term)
      );
    }

    setDisplayedProgramacoes(filtered);
  }, [filter, debouncedSearch, allProgramacoes]);

  const loadProgramacoes = async () => {
    setLoading(true);
    try {
      const res = await deliveryService.getProgramacoesAssigned();
      setAllProgramacoes(res.data.programacoes || []);
      setToast(null);
    } catch {
      setToast({ message: 'Erro ao carregar entregas programadas', type: 'error' });
      setTimeout(() => setToast(null), 5000);
      setAllProgramacoes([]);
    } finally {
      setLoading(false);
    }
  };

  const FILTERS = useMemo(() => {
    const tot = allProgramacoes.length;
    const pen = allProgramacoes.filter(p => !['ENTREGUE','FINALIZADO','CANCELADO'].includes(String(p.status||'').toUpperCase())).length;
    return [
      { label: 'Todas',     value: 'all',      count: tot },
      { label: 'Pendentes', value: 'pendentes', count: pen },
      { label: 'Enviadas',  value: 'enviadas',  count: tot - pen },
    ];
  }, [allProgramacoes]);

  /* ──────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/40">
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24">

        {/* ── Top Bar ── */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/home')}
            className="w-10 h-10 rounded-xl bg-white shadow-sm border border-gray-200 flex items-center justify-center text-gray-500 hover:text-purple-600 hover:border-purple-300 hover:shadow-md transition-all"
          >
            <FaArrowLeft className="text-sm" />
          </button>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400 leading-none mb-0.5">
              Painel do Motorista
            </p>
            <h1 className="text-2xl font-extrabold text-gray-800 leading-tight">Minhas Entregas</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setActiveView('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all ${
                  activeView === 'dashboard'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-gray-500 hover:text-purple-600'
                }`}
              >
                <FaChartPie /> Dashboard
              </button>
              <button
                onClick={() => setActiveView('list')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all ${
                  activeView === 'list'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-gray-500 hover:text-purple-600'
                }`}
              >
                <FaList /> Lista
              </button>
            </div>

            {/* Reload */}
            <button
              onClick={loadProgramacoes}
              disabled={loading}
              className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-purple-600 hover:border-purple-300 hover:shadow-md disabled:opacity-50 transition-all"
            >
              <FaSync className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Search + Filter (only in list view) ── */}
        {activeView === 'list' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
            <div className="relative mb-3">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                placeholder={`Buscar por processo, container, ${city === 'itajai' ? 'remetente' : 'recebedor'} ou motorista…`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-gray-50 placeholder-gray-400 text-gray-700 transition-all"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                  ✕
                </button>
              )}
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    filter === f.value
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-purple-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filter === f.value ? 'bg-white/25 text-white' : 'bg-gray-300 text-gray-600'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-400 font-medium">
                {displayedProgramacoes.length} resultado{displayedProgramacoes.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : activeView === 'dashboard' ? (
          <DashboardView data={allProgramacoes} />
        ) : (
          <ListView data={displayedProgramacoes} navigate={navigate} />
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default MinhasEntregas;
