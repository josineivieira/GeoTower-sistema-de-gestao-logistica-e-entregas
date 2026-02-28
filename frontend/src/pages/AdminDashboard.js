import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { exportToPDF, exportToExcel, formatMinutes as fmtMin } from '../services/exportService';
import {
  FiArrowLeft, FiPackage, FiTruck, FiAward, FiClock,
  FiTrendingUp, FiFilter, FiRefreshCw, FiCalendar,
  FiSearch, FiBarChart2, FiDownload, FiFileText, FiGrid
} from 'react-icons/fi';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';

/* ─── Paleta ─── */
const PALETTE = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'];

/* ─── Tooltip customizado ─── */
const CustomTooltip = ({ active, payload, label, formatter, labelFormatter }) => {
  if (!active || !payload?.length) return null;
  const displayLabel = labelFormatter ? labelFormatter(label) : label;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl px-4 py-3 text-sm min-w-[150px]">
      <p className="text-gray-400 font-medium mb-2 border-b border-gray-700 pb-1 text-xs uppercase tracking-wide">
        {displayLabel}
      </p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-white font-semibold">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─── Sparkline ─── */
const SparkLine = ({ data, color }) => (
  <ResponsiveContainer width="100%" height={48}>
    <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
      <defs>
        <linearGradient id={`sk-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2}
        fill={`url(#sk-${color.replace('#', '')})`} dot={false}
        isAnimationActive animationDuration={800} />
    </AreaChart>
  </ResponsiveContainer>
);

/* ─── KPI Card ─── */
const KpiCard = ({ title, value, subtitle, icon: Icon, color, sparkData, badge }) => {
  const map = {
    indigo:  { border: 'border-indigo-500',  text: 'text-indigo-500',  bg: 'bg-indigo-50',  spark: '#6366f1' },
    cyan:    { border: 'border-cyan-500',    text: 'text-cyan-500',    bg: 'bg-cyan-50',    spark: '#06b6d4' },
    amber:   { border: 'border-amber-500',   text: 'text-amber-500',   bg: 'bg-amber-50',   spark: '#f59e0b' },
    emerald: { border: 'border-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-50', spark: '#10b981' },
  };
  const s = map[color] ?? map.indigo;
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 border-l-4 ${s.border} p-5 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col gap-2`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 truncate">{title}</p>
          <p className={`text-3xl font-extrabold ${s.text} leading-none`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1.5 truncate">{subtitle}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.bg} ml-3 flex-shrink-0`}>
          <Icon size={20} className={s.text} />
        </div>
      </div>
      {sparkData?.length > 1 && <SparkLine data={sparkData} color={s.spark} />}
      {badge && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 w-fit px-2.5 py-1 rounded-full">
          <FiTrendingUp size={11} />
          {badge}
        </div>
      )}
    </div>
  );
};

/* ─── Chart Section Header ─── */
const ChartHeader = ({ title, subtitle, dotColor }) => (
  <div className="flex items-start gap-3 mb-4">
    <div className="mt-1.5 w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
    <div>
      <h3 className="text-sm font-bold text-gray-800 leading-tight">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

/* ─── Skeleton ─── */
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

/* ─── Export Button ─── */
const ExportButton = ({ onClick, loading, icon: Icon, label, colorClass, disabled }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border 
      ${loading || disabled
        ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
        : colorClass
      }`}
  >
    {loading ? (
      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    ) : (
      <Icon size={13} />
    )}
    {loading ? 'Gerando...' : label}
  </button>
);

/* ════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════ */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [deliveries,  setDeliveries]  = useState([]);
  const [statistics,  setStatistics]  = useState(null);
  const [period,      setPeriod]      = useState('month');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [exporting,   setExporting]   = useState({ pdf: false, excel: false });
  const [toast,       setToast]       = useState(null);
  const [activeBar,   setActiveBar]   = useState(null);
  const [filters, setFilters] = useState({ searchTerm: '', startDate: '', endDate: '' });

  /* ── Refs para captura de gráficos ── */
  const chartRefs = {
    area:        useRef(null),
    barDriver:   useRef(null),
    barReceiver: useRef(null),
    barCli:      useRef(null),
  };

  /* ── Data loading ── */
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [delivRes, statsRes] = await Promise.all([
        adminService.getDeliveries(filters),
        adminService.getStatistics({ period }),
      ]);
      setDeliveries(delivRes.data.deliveries);
      setStatistics(statsRes.data.statistics);
    } catch {
      setToast({ message: 'Erro ao carregar dados', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, filters]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Helpers ── */
  const getCliMinutes = (d) => {
    if (!d.horarioChegada) return null;
    const chegada = new Date(d.horarioChegada);
    const ref = d.horarioFimDesova ? new Date(d.horarioFimDesova) : new Date();
    const diff = ref - chegada;
    return diff < 0 ? null : diff / 60000;
  };

  const periodLbl = { day: 'Hoje', week: 'Esta semana', month: 'Este mês' }[period];
  const fmtDate   = (date) => {
    const p = String(date).split('-');
    if (p.length === 3) {
      const d = new Date(+p[0], +p[1] - 1, +p[2]);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
    return date;
  };

  /* ── Memos ── */
  const topRecebedores = React.useMemo(() => {
    const counts = {};
    deliveries.forEach(d => {
      const key = d.recebedor || '-';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([recebedor, count]) => ({ recebedor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [deliveries]);

  const avgCliByRecebedor = React.useMemo(() => {
    const sums = {}, cnts = {};
    deliveries.forEach(d => {
      const key = d.recebedor || '-';
      const mins = getCliMinutes(d);
      if (mins != null) {
        sums[key] = (sums[key] || 0) + mins;
        cnts[key] = (cnts[key] || 0) + 1;
      }
    });
    const res = {};
    Object.keys(sums).forEach(k => { res[k] = sums[k] / cnts[k]; });
    return res;
  }, [deliveries]);

  const recebedorCountData = React.useMemo(
    () => topRecebedores.map(r => ({ name: r.recebedor, count: r.count })),
    [topRecebedores]
  );

  const recebedorAvgData = React.useMemo(
    () => Object.entries(avgCliByRecebedor)
      .map(([recebedor, avg]) => ({ name: recebedor, avg: parseFloat(avg.toFixed(1)) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5),
    [avgCliByRecebedor]
  );

  const avgCliOverall = React.useMemo(() => {
    const vals = deliveries.map(d => getCliMinutes(d)).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [deliveries]);

  /* ── Payload compartilhado para exports ── */
  const exportPayload = () => ({
    statistics,
    deliveries,
    topRecebedores,
    avgCliByRecebedor,
    recebedorCountData,
    recebedorAvgData,
    period,
    fmtMin,
  });

  /* ── Export handlers ── */
  const handleExportPDF = async () => {
    if (!statistics) return;
    setExporting(e => ({ ...e, pdf: true }));
    try {
      await exportToPDF({ ...exportPayload(), chartRefs });
      setToast({ message: 'PDF exportado com sucesso', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao exportar PDF', type: 'error' });
    } finally {
      setExporting(e => ({ ...e, pdf: false }));
    }
  };

  const handleExportExcel = () => {
    if (!statistics) return;
    setExporting(e => ({ ...e, excel: true }));
    try {
      exportToExcel(exportPayload());
      setToast({ message: 'Excel exportado com sucesso', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao exportar Excel', type: 'error' });
    } finally {
      setExporting(e => ({ ...e, excel: false }));
    }
  };

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="w-screen h-screen bg-slate-50 flex flex-col overflow-hidden">
        <div className="h-[68px] bg-gradient-to-r from-slate-900 to-slate-800 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans">

      {/* ══════ HEADER ══════ */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl flex-shrink-0 border-b border-slate-700">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">

            {/* Left */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/home')}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all"
              >
                <FiArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <FiBarChart2 size={17} className="text-indigo-400" />
                  <h1 className="text-lg font-bold tracking-tight">Dashboard de Indicadores</h1>
                </div>
                <p className="text-slate-400 text-xs mt-0.5 pl-6">Análise em tempo real das operações</p>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Period toggle */}
              <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1 border border-white/10">
                {[
                  { val: 'day',   label: 'Hoje' },
                  { val: 'week',  label: 'Semana' },
                  { val: 'month', label: 'Mês' },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => setPeriod(val)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      period === val
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Refresh */}
              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <FiRefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                Atualizar
              </button>

              {/* Separator */}
              <div className="w-px h-6 bg-white/20" />

              {/* Export PDF */}
              <ExportButton
                onClick={handleExportPDF}
                loading={exporting.pdf}
                icon={FiFileText}
                label="Exportar PDF"
                disabled={!statistics}
                colorClass="bg-rose-500/90 hover:bg-rose-500 text-white border-rose-600/50 shadow-sm shadow-rose-500/20"
              />

              {/* Export Excel */}
              <ExportButton
                onClick={handleExportExcel}
                loading={exporting.excel}
                icon={FiGrid}
                label="Exportar Excel"
                disabled={!statistics}
                colorClass="bg-emerald-500/90 hover:bg-emerald-500 text-white border-emerald-600/50 shadow-sm shadow-emerald-500/20"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-5 max-w-[1600px] mx-auto">

          {/* ══════ FILTROS ══════ */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <FiFilter size={14} className="text-indigo-500" />
                Filtros
              </div>
              <button
                onClick={() => {
                  setPeriod('month');
                  setFilters({ searchTerm: '', startDate: '', endDate: '' });
                }}
                className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-600 transition"
              >
                Limpar
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar entrega ou motorista..."
                  value={filters.searchTerm}
                  onChange={e => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                />
              </div>
              <div className="relative">
                <FiCalendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                />
              </div>
              <div className="relative">
                <FiCalendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                />
              </div>
            </div>
          </div>

          {/* ══════ KPI CARDS ══════ */}
          {statistics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard
                title="Total de Entregas"
                value={statistics.totalDeliveries}
                subtitle={periodLbl}
                icon={FiPackage}
                color="indigo"
                sparkData={statistics.dailyDeliveries}
                badge={`${statistics.totalDeliveries} registros`}
              />
              <KpiCard
                title="Motoristas Ativos"
                value={statistics.deliveriesByDriver.length}
                subtitle="Contratados com entregas"
                icon={FiTruck}
                color="cyan"
                sparkData={statistics.dailyDeliveries}
              />
              <KpiCard
                title="Top Recebedor"
                value={topRecebedores[0]?.count ?? 0}
                subtitle={topRecebedores[0]?.recebedor ?? '-'}
                icon={FiAward}
                color="amber"
              />
              <KpiCard
                title="Tempo Médio CLI"
                value={fmtMin(avgCliOverall)}
                subtitle="Média chegada → fim desova"
                icon={FiClock}
                color="emerald"
                sparkData={statistics.dailyDeliveries}
              />
            </div>
          )}

          {/* ══════ GRÁFICOS SUPERIORES ══════ */}
          {statistics && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

              {/* Área — Evolução Diária */}
              {statistics.dailyDeliveries.length > 0 && (
                <div
                  ref={chartRefs.area}
                  className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow duration-300"
                >
                  <ChartHeader
                    title="Evolução Diária de Entregas"
                    subtitle={`Distribuição no período: ${periodLbl}`}
                    dotColor="#6366f1"
                  />
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={statistics.dailyDeliveries} margin={{ top: 10, right: 10, left: -10, bottom: 30 }}>
                      <defs>
                        <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="_id" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickFormatter={fmtDate} axisLine={false} tickLine={false}
                        angle={-35} textAnchor="end" height={55} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        content={<CustomTooltip labelFormatter={fmtDate} />}
                        cursor={{ stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                      />
                      <ReferenceLine
                        y={statistics.dailyDeliveries.length
                          ? statistics.dailyDeliveries.reduce((s, d) => s + d.count, 0) / statistics.dailyDeliveries.length
                          : 0}
                        stroke="#6366f1" strokeDasharray="4 4" strokeOpacity={0.4}
                        label={{ value: 'Média', position: 'insideTopRight', fontSize: 10, fill: '#6366f1' }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5}
                        fill="url(#gradArea)"
                        dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                        isAnimationActive animationDuration={800} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Bar — Por Contratado */}
              {statistics.deliveriesByDriver.length > 0 && (
                <div
                  ref={chartRefs.barDriver}
                  className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow duration-300"
                >
                  <ChartHeader
                    title="Entregas por Contratado"
                    subtitle="Ranking de volume no período"
                    dotColor="#10b981"
                  />
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={statistics.deliveriesByDriver}
                      margin={{ top: 10, right: 10, left: -10, bottom: 50 }}
                      onMouseLeave={() => setActiveBar(null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="_id" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false} tickLine={false} angle={-40} textAnchor="end" height={65} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        content={<CustomTooltip formatter={v => `${v} entrega(s)`} />}
                        cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}
                        onMouseEnter={(_, idx) => setActiveBar(idx)}
                        isAnimationActive animationDuration={700}>
                        {statistics.deliveriesByDriver.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]}
                            opacity={activeBar === null || activeBar === i ? 1 : 0.35} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ══════ GRÁFICOS INFERIORES ══════ */}
          {deliveries.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* Horizontal — Entregas por Recebedor */}
              <div
                ref={chartRefs.barReceiver}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow duration-300"
              >
                <ChartHeader title="Entregas por Recebedor" subtitle="Top 5 recebedores no período" dotColor="#06b6d4" />
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={recebedorCountData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8"
                      tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={130} />
                    <Tooltip content={<CustomTooltip formatter={v => `${v} entrega(s)`} />}
                      cursor={{ fill: 'rgba(6,182,212,0.05)' }} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={32}
                      background={{ fill: '#f8fafc', radius: [0, 6, 6, 0] }}
                      isAnimationActive animationDuration={700}>
                      {recebedorCountData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Horizontal — Tempo Médio CLI */}
              <div
                ref={chartRefs.barCli}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow duration-300"
              >
                <ChartHeader title="Tempo Médio no Cliente" subtitle="Duração média: chegada → fim desova" dotColor="#10b981" />
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={recebedorAvgData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false} tickLine={false} tickFormatter={fmtMin} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8"
                      tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={130} />
                    <Tooltip content={<CustomTooltip formatter={fmtMin} />}
                      cursor={{ fill: 'rgba(16,185,129,0.05)' }} />
                    <Bar dataKey="avg" radius={[0, 6, 6, 0]} maxBarSize={32}
                      background={{ fill: '#f8fafc', radius: [0, 6, 6, 0] }}
                      isAnimationActive animationDuration={700}>
                      {recebedorAvgData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ══════ RANKING TABLE ══════ */}
          {topRecebedores.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow duration-300">
              <div className="flex items-start justify-between mb-4">
                <ChartHeader title="Ranking de Recebedores"
                  subtitle="Desempenho detalhado por recebedor no período" dotColor="#f59e0b" />
                {/* Mini badge de export hint */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                  <FiDownload size={11} />
                  Disponível no PDF e Excel
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Pos.', 'Recebedor', 'Entregas', 'Tempo Médio CLI', 'Volume'].map(h => (
                        <th key={h} className="text-left pb-3 pt-1 text-xs font-bold text-slate-400 uppercase tracking-widest first:w-12">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {topRecebedores.map((rec, i) => {
                      const total = topRecebedores.reduce((s, r) => s + r.count, 0);
                      const pct = total > 0 ? ((rec.count / total) * 100).toFixed(1) : 0;
                      const avgMin = avgCliByRecebedor[rec.recebedor];
                      const medals = ['bg-amber-400', 'bg-slate-400', 'bg-orange-600'];
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors duration-150">
                          <td className="py-3 pr-4">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white ${medals[i] ?? 'bg-slate-200 !text-slate-500'}`}>
                              {i + 1}
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="font-semibold text-slate-800">{rec.recebedor}</span>
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                              {rec.count}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                              <FiClock size={11} className="text-slate-400" />
                              {fmtMin(avgMin)}
                            </span>
                          </td>
                          <td className="py-3 w-52">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-500 w-10 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="h-4" />
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AdminDashboard;
