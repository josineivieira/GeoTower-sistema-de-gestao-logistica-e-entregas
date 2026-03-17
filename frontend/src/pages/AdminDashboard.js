import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { exportToPDF, exportToExcel, formatMinutes as fmtMin } from '../services/exportService';
import {
  FiArrowLeft, FiPackage, FiTruck, FiAward, FiClock,
  FiTrendingUp, FiFilter, FiRefreshCw, FiCalendar,
  FiSearch, FiBarChart2, FiDownload, FiFileText, FiGrid, FiSettings
} from 'react-icons/fi';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';

/* ─── Paleta ─── */
const PALETTE = ['#818cf8', '#22d3ee', '#34d399', '#fbbf24', '#fb7185'];

/* ─── Tooltip customizado ─── */
const CustomTooltip = ({ active, payload, label, formatter, labelFormatter }) => {
  if (!active || !payload?.length) return null;
  const displayLabel = labelFormatter ? labelFormatter(label) : label;
  return (
    <div className="bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl px-4 py-3 text-sm min-w-[150px] backdrop-blur-xl">
      <p className="text-slate-400 font-medium mb-2 border-b border-white/10 pb-1 text-xs uppercase tracking-wide">
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
          <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey="count"
        stroke={color}
        strokeWidth={2}
        fill={`url(#sk-${color.replace('#', '')})`}
        dot={false}
        isAnimationActive
        animationDuration={800}
      />
    </AreaChart>
  </ResponsiveContainer>
);

/* ─── KPI Card ─── */
const KpiCard = ({ title, value, subtitle, icon: Icon, color, sparkData, badge }) => {
  const map = {
    indigo:  { border: 'border-indigo-500',  text: 'text-indigo-400',  bg: 'bg-indigo-500/15',  glow: 'hover:shadow-indigo-500/10',  spark: '#818cf8' },
    cyan:    { border: 'border-cyan-400',    text: 'text-cyan-400',    bg: 'bg-cyan-500/15',    glow: 'hover:shadow-cyan-500/10',    spark: '#22d3ee' },
    amber:   { border: 'border-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-500/15',   glow: 'hover:shadow-amber-500/10',   spark: '#fbbf24' },
    emerald: { border: 'border-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/15', glow: 'hover:shadow-emerald-500/10', spark: '#34d399' },
  };
  const s = map[color] ?? map.indigo;
  return (
    <div className={`
      bg-white/[0.06] backdrop-blur-xl rounded-2xl shadow-xl
      border border-white/[0.08] border-l-4 ${s.border}
      p-5 hover:shadow-2xl ${s.glow}
      transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.09]
      flex flex-col gap-2
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 truncate">
            {title}
          </p>
          <p className={`text-3xl font-extrabold ${s.text} leading-none`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1.5 truncate">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.bg} ml-3 flex-shrink-0 shadow-inner`}>
          <Icon size={22} className={s.text} />
        </div>
      </div>
      {sparkData?.length > 1 && <SparkLine data={sparkData} color={s.spark} />}
      {badge && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 w-fit px-2.5 py-1 rounded-full border border-emerald-500/20">
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
    <div
      className="mt-1.5 w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
      style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}80` }}
    />
    <div>
      <h3 className="text-sm font-bold text-white leading-tight">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

/* ─── Skeleton ─── */
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gradient-to-r from-slate-800 via-slate-700/50 to-slate-800 rounded-xl ${className}`} />
);

/* ─── Export Button ─── */
const ExportButton = ({ onClick, loading, icon: Icon, label, colorClass, disabled }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border 
      ${loading || disabled
        ? 'opacity-50 cursor-not-allowed bg-white/5 border-white/10 text-slate-500'
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
  const [searchTerm,  setSearchTerm]  = useState('');

  const searchTimerRef = React.useRef(null);
  const chartRefs = {
    area:        useRef(null),
    barDriver:   useRef(null),
    barReceiver: useRef(null),
    barCli:      useRef(null),
  };

  // Cleanup search timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchTerm]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [delivRes, statsRes] = await Promise.all([
        adminService.getDeliveries({ searchTerm }),
        adminService.getStatistics({ period }),
      ]);
      setDeliveries(delivRes.data.deliveries);
      setStatistics(statsRes.data.statistics);
    } catch (err) {
      // Attempt to provide a clearer message when session expired or network error
      // If we can detect 401 from the response, ask user to login again
      if (err && err.response && err.response.status === 401) {
        setToast({ message: 'Sessão expirada. Faça login novamente.', type: 'error' });
        setTimeout(() => navigate('/login'), 1200);
      } else {
        setToast({ message: 'Erro ao carregar dados. Se o problema persistir, faça login novamente.', type: 'error' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, searchTerm]);

  // Debounced search input
  const handleSearchChange = (value) => {
    const trimmed = value.trim();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchTerm(trimmed);
      searchTimerRef.current = null;
    }, 700);
  };

  // whenever searchTerm or period change we reload data
  useEffect(() => { 
    loadData(); 
  }, [loadData]);

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

  const exportPayload = () => ({
    statistics, deliveries, topRecebedores, avgCliByRecebedor,
    recebedorCountData, recebedorAvgData, period, fmtMin,
  });

  const handleExportPDF = async () => {
    if (!statistics) return;
    setExporting(e => ({ ...e, pdf: true }));
    try {
      await exportToPDF({ ...exportPayload(), chartRefs });
      setToast({ message: 'PDF exportado com sucesso', type: 'success' });
    } catch {
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
    } catch {
      setToast({ message: 'Erro ao exportar Excel', type: 'error' });
    } finally {
      setExporting(e => ({ ...e, excel: false }));
    }
  };

  /* ── Skeleton loading ── */
  if (loading) {
    return (
      <div
        className="w-screen h-screen flex flex-col overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d0b1e 0%, #111827 55%, #0a0d1a 100%)' }}
      >
        <div className="h-[68px] bg-gradient-to-r from-slate-900 to-slate-800 flex-shrink-0 border-b border-white/5" />
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

  /* ── Constantes de estilo dos charts ── */
  const gridStroke   = 'rgba(255,255,255,0.05)';
  const axisStroke   = '#334155';
  const tickFill     = '#64748b';

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden font-sans"
      style={{ background: 'linear-gradient(135deg, #0d0b1e 0%, #111827 55%, #0a0d1a 100%)' }}
    >

      {/* ══════ HEADER ══════ */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl flex-shrink-0 border-b border-white/[0.07]">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
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

            <div className="flex items-center gap-2 flex-wrap">
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

              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <FiRefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                Atualizar
              </button>

              <div className="w-px h-6 bg-white/20" />

              <div className="relative flex items-center">
                <FiSearch className="absolute left-3 text-slate-500" size={14} />
                <input
                  type="text"
                  placeholder="Buscar entrega ou motorista..."
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs text-slate-100 placeholder-slate-500 transition"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ══════ CONTEÚDO SCROLLÁVEL ══════ */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-6 max-w-[1600px] mx-auto">

          {/* ══════ KPI CARDS ══════ */}
          {statistics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
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
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

              {/* Área — Evolução Diária */}
              {statistics.dailyDeliveries.length > 0 && (
                <div
                  ref={chartRefs.area}
                  className="xl:col-span-3 bg-gradient-to-br from-indigo-500/[0.10] via-white/[0.03] to-transparent backdrop-blur-xl rounded-2xl shadow-xl border border-white/[0.08] p-6 hover:border-indigo-500/30 hover:shadow-indigo-500/10 transition-all duration-300"
                >
                  <ChartHeader
                    title="Evolução Diária de Entregas"
                    subtitle={`Distribuição no período: ${periodLbl}`}
                    dotColor="#818cf8"
                  />
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={statistics.dailyDeliveries}
                      margin={{ top: 10, right: 10, left: -10, bottom: 30 }}
                    >
                      <defs>
                        <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.30} />
                          <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis
                        dataKey="_id"
                        stroke={axisStroke}
                        tick={{ fontSize: 11, fill: tickFill }}
                        tickFormatter={fmtDate}
                        axisLine={false}
                        tickLine={false}
                        angle={-35}
                        textAnchor="end"
                        height={55}
                      />
                      <YAxis
                        stroke={axisStroke}
                        tick={{ fontSize: 11, fill: tickFill }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        content={<CustomTooltip labelFormatter={fmtDate} />}
                        cursor={{ stroke: '#818cf8', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                      />
                      <ReferenceLine
                        y={statistics.dailyDeliveries.reduce((s, d) => s + d.count, 0) / statistics.dailyDeliveries.length}
                        stroke="#818cf8"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        label={{ value: 'Média', position: 'insideTopRight', fontSize: 10, fill: '#818cf8' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#818cf8"
                        strokeWidth={2.5}
                        fill="url(#gradArea)"
                        dot={{ fill: '#818cf8', r: 4, strokeWidth: 2, stroke: '#1e1b4b' }}
                        activeDot={{ r: 6, fill: '#818cf8', stroke: '#1e1b4b', strokeWidth: 2 }}
                        isAnimationActive
                        animationDuration={800}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Bar — Por Contratado */}
              {statistics.deliveriesByDriver.length > 0 && (
                <div
                  ref={chartRefs.barDriver}
                  className="xl:col-span-2 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.03] to-transparent backdrop-blur-xl rounded-2xl shadow-xl border border-white/[0.08] p-6 hover:border-emerald-500/30 hover:shadow-emerald-500/10 transition-all duration-300"
                >
                  <ChartHeader
                    title="Entregas por Contratado"
                    subtitle="Ranking de volume no período"
                    dotColor="#34d399"
                  />
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={statistics.deliveriesByDriver}
                      margin={{ top: 10, right: 10, left: -10, bottom: 50 }}
                      onMouseLeave={() => setActiveBar(null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis
                        dataKey="_id"
                        stroke={axisStroke}
                        tick={{ fontSize: 10, fill: tickFill }}
                        axisLine={false}
                        tickLine={false}
                        angle={-40}
                        textAnchor="end"
                        height={65}
                      />
                      <YAxis
                        stroke={axisStroke}
                        tick={{ fontSize: 11, fill: tickFill }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        content={<CustomTooltip formatter={v => `${v} entrega(s)`} />}
                        cursor={{ fill: 'rgba(129,140,248,0.06)' }}
                      />
                      <Bar
                        dataKey="count"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                        onMouseEnter={(_, idx) => setActiveBar(idx)}
                        isAnimationActive
                        animationDuration={700}
                      >
                        {statistics.deliveriesByDriver.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PALETTE[i % PALETTE.length]}
                            opacity={activeBar === null || activeBar === i ? 1 : 0.25}
                          />
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

              {/* Bar — Por Recebedor */}
              <div
                ref={chartRefs.barReceiver}
                className="bg-gradient-to-br from-cyan-500/[0.10] via-white/[0.03] to-transparent backdrop-blur-xl rounded-2xl shadow-xl border border-white/[0.08] p-6 hover:border-cyan-500/30 hover:shadow-cyan-500/10 transition-all duration-300"
              >
                <ChartHeader
                  title="Entregas por Recebedor"
                  subtitle="Top 5 recebedores no período"
                  dotColor="#22d3ee"
                />
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={recebedorCountData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                    <XAxis
                      type="number"
                      stroke={axisStroke}
                      tick={{ fontSize: 11, fill: tickFill }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={axisStroke}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={130}
                    />
                    <Tooltip
                      content={<CustomTooltip formatter={v => `${v} entrega(s)`} />}
                      cursor={{ fill: 'rgba(34,211,238,0.06)' }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={32}
                      background={{ fill: 'rgba(255,255,255,0.03)', radius: [0, 6, 6, 0] }}
                      isAnimationActive
                      animationDuration={700}
                    >
                      {recebedorCountData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Bar — Tempo Médio CLI */}
              <div
                ref={chartRefs.barCli}
                className="bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.03] to-transparent backdrop-blur-xl rounded-2xl shadow-xl border border-white/[0.08] p-6 hover:border-emerald-500/30 hover:shadow-emerald-500/10 transition-all duration-300"
              >
                <ChartHeader
                  title="Tempo Médio no Cliente"
                  subtitle="Duração média: chegada → fim desova"
                  dotColor="#34d399"
                />
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={recebedorAvgData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                    <XAxis
                      type="number"
                      stroke={axisStroke}
                      tick={{ fontSize: 11, fill: tickFill }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={fmtMin}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={axisStroke}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={130}
                    />
                    <Tooltip
                      content={<CustomTooltip formatter={fmtMin} />}
                      cursor={{ fill: 'rgba(52,211,153,0.06)' }}
                    />
                    <Bar
                      dataKey="avg"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={32}
                      background={{ fill: 'rgba(255,255,255,0.03)', radius: [0, 6, 6, 0] }}
                      isAnimationActive
                      animationDuration={700}
                    >
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
            <div className="bg-gradient-to-br from-amber-500/[0.07] via-white/[0.03] to-transparent backdrop-blur-xl rounded-2xl shadow-xl border border-white/[0.08] p-6 hover:border-amber-500/20 transition-all duration-300">
              <div className="flex items-start justify-between mb-5">
                <ChartHeader
                  title="Ranking de Recebedores"
                  subtitle="Desempenho detalhado por recebedor no período"
                  dotColor="#fbbf24"
                />
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white/[0.05] border border-white/[0.08] px-2.5 py-1.5 rounded-lg">
                  <FiDownload size={11} />
                  Disponível no PDF e Excel
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      {['Pos.', 'Recebedor', 'Entregas', 'Tempo Médio CLI', 'Participação'].map(h => (
                        <th
                          key={h}
                          className="text-left pb-3 pt-1 text-xs font-bold text-slate-500 uppercase tracking-widest first:w-12"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {topRecebedores.map((rec, i) => {
                      const total = topRecebedores.reduce((s, r) => s + r.count, 0);
                      const pct   = total > 0 ? ((rec.count / total) * 100).toFixed(1) : 0;
                      const avgMin = avgCliByRecebedor[rec.recebedor];
                      const medals = ['bg-amber-500', 'bg-slate-500', 'bg-orange-700'];
                      return (
                        <tr key={i} className="hover:bg-white/[0.04] transition-colors duration-150">
                          <td className="py-3.5 pr-4">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white ${medals[i] ?? 'bg-slate-700 !text-slate-300'}`}
                            >
                              {i + 1}
                            </div>
                          </td>
                          <td className="py-3.5">
                            <span className="font-semibold text-white">{rec.recebedor}</span>
                          </td>
                          <td className="py-3.5">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                              {rec.count}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                              <FiClock size={11} className="text-slate-500" />
                              {fmtMin(avgMin)}
                            </span>
                          </td>
                          <td className="py-3.5 w-52">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: PALETTE[i % PALETTE.length],
                                    boxShadow: `0 0 8px ${PALETTE[i % PALETTE.length]}60`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-500 w-10 text-right">{pct}%</span>
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
