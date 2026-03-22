import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { useCity } from '../contexts/CityContext';
import {
  FiArrowLeft, FiTrendingUp, FiTrendingDown, FiPackage, FiTruck,
  FiClock, FiAlertTriangle, FiBarChart2, FiDownload, FiFileText, FiRefreshCw
} from 'react-icons/fi';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const KPIAnalytics = ({ onToggle }) => {
  const navigate = useNavigate();
  const { city } = useCity();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    driver: '',
    region: '',
    status: ''
  });

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await adminService.getDeliveries({});
      setDeliveries(res.data.deliveries || []);
    } catch (err) {
      if (err?.response?.status === 401) {
        setToast({ message: 'Sessão expirada. Faça login novamente.', type: 'error' });
        setTimeout(() => navigate('/login'), 1200);
      } else {
        setToast({ message: 'Erro ao carregar dados', type: 'error' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  // ═══ Helper Functions ═══
  const isCompletedStatus = (status) => {
    return ['Entregue', 'FINALIZADO', 'DOCUMENTOS ENTREGUES'].includes(status);
  };

  const getScheduledDate = (delivery) => {
    // Em Itajaí: dtColeta é a data agendada com cliente
    // Em Manaus: dtAgendamentoDescarga
    if (city === 'itajai') {
      return delivery.dtColeta;
    }
    return delivery.dtAgendamentoDescarga || delivery.dtColeta;
  };

  const getArrivalDate = (delivery) => {
    // Em Itajaí: arrivedAt é a data de chegada no cliente (Dt. chegada cliente)
    // Em Manaus: dtEntrega
    if (city === 'itajai') {
      return delivery.arrivedAt;
    }
    return delivery.dtEntrega;
  };

  const isLate = (delivery) => {
    const scheduled = getScheduledDate(delivery);
    const arrival = getArrivalDate(delivery);
    if (!scheduled || !arrival) return false;
    return new Date(arrival) > new Date(scheduled);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrar entregas
  const filteredDeliveries = useMemo(() => {
    let result = [...deliveries];

    if (filters.startDate) {
      const sd = new Date(filters.startDate);
      result = result.filter(d => {
        const dt = d.dtAgendamentoDescarga || d.dtColeta || d.createdAt;
        return new Date(dt) >= sd;
      });
    }

    if (filters.endDate) {
      const ed = new Date(filters.endDate);
      ed.setHours(23, 59, 59);
      result = result.filter(d => {
        const dt = d.dtAgendamentoDescarga || d.dtColeta || d.createdAt;
        return new Date(dt) <= ed;
      });
    }

    if (filters.driver) {
      result = result.filter(d => d.driverName?.includes(filters.driver));
    }

    if (filters.region) {
      result = result.filter(d => d.regiao?.includes(filters.region));
    }

    if (filters.status) {
      result = result.filter(d => d.status === filters.status);
    }

    return result;
  }, [deliveries, filters]);

  // ═══════════════════════════════════════════════════════════════
  // KPI 1: Taxa de Entregas no Prazo
  // ═══════════════════════════════════════════════════════════════
  const onTimeRate = useMemo(() => {
    if (filteredDeliveries.length === 0) return 0;
    const completed = filteredDeliveries.filter(d => isCompletedStatus(d.status));
    if (completed.length === 0) return 0;
    const onTime = completed.filter(d => !isLate(d)).length;
    return Math.round((onTime / completed.length) * 100);
  }, [filteredDeliveries, city]);

  // ═══════════════════════════════════════════════════════════════
  // KPI 2: Total de Entregas Realizadas
  // ═══════════════════════════════════════════════════════════════
  const totalDeliveries = filteredDeliveries.length;
  const completedDeliveries = filteredDeliveries.filter(d => isCompletedStatus(d.status)).length;

  // ═══════════════════════════════════════════════════════════════
  // KPI 3: Entregas Atrasadas
  // ═══════════════════════════════════════════════════════════════
  const lateDeliveries = useMemo(() => {
    const completed = filteredDeliveries.filter(d => isCompletedStatus(d.status));
    const late = completed.filter(d => isLate(d));
    const percentage = completed.length > 0 ? Math.round((late.length / completed.length) * 100) : 0;
    return { count: late.length, percentage };
  }, [filteredDeliveries, city]);

  // ═══════════════════════════════════════════════════════════════
  // KPI 4: Tempo Médio de Entrega
  // ═══════════════════════════════════════════════════════════════
  const averageDeliveryTime = useMemo(() => {
    const completed = filteredDeliveries.filter(d => isCompletedStatus(d.status));
    const times = completed
      .filter(d => d.dtSaida && getArrivalDate(d))
      .map(d => {
        const saida = new Date(d.dtSaida);
        const chegada = new Date(getArrivalDate(d));
        return (chegada - saida) / (1000 * 60 * 60); // horas
      });
    if (times.length === 0) return 0;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return avg.toFixed(1);
  }, [filteredDeliveries, city]);

  // ═══════════════════════════════════════════════════════════════
  // KPI 5: SLA de Entrega
  // ═══════════════════════════════════════════════════════════════
  const slaMetric = useMemo(() => {
    const completed = filteredDeliveries.filter(d => isCompletedStatus(d.status));
    const withDates = completed.filter(d => getScheduledDate(d) && getArrivalDate(d));
    if (withDates.length === 0) return { met: 0, total: 0, percentage: 0 };
    const met = withDates.filter(d => !isLate(d)).length;
    return {
      met,
      total: withDates.length,
      percentage: Math.round((met / withDates.length) * 100)
    };
  }, [filteredDeliveries]);

  // ═══════════════════════════════════════════════════════════════
  // KPI 6: Performance por Motorista
  // ═══════════════════════════════════════════════════════════════
  const driverPerformance = useMemo(() => {
    const drivers = {};
    filteredDeliveries.forEach(d => {
      if (!isCompletedStatus(d.status)) return; // Apenas entregas concluídas
      
      const name = d.driverName || 'Sem motorista';
      if (!drivers[name]) {
        drivers[name] = { total: 0, onTime: 0, late: 0 };
      }
      drivers[name].total++;

      if (isLate(d)) {
        drivers[name].late++;
      } else {
        drivers[name].onTime++;
      }
    });

    return Object.entries(drivers)
      .map(([name, data]) => ({
        name,
        total: data.total,
        onTimePercentage: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
        latePercentage: data.total > 0 ? Math.round((data.late / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredDeliveries, city]);

  // ═══════════════════════════════════════════════════════════════
  // KPI 7: Performance por Remetente (Itajaí) / Destinatário (Manaus)
  // ═══════════════════════════════════════════════════════════════
  const performanceByParty = useMemo(() => {
    const partyLabel = city === 'itajai' ? 'remetente' : 'destinatario';
    const parties = {};
    filteredDeliveries.forEach(d => {
      if (!isCompletedStatus(d.status)) return; // Apenas entregas concluídas

      const party = d[partyLabel] || (city === 'itajai' ? 'Sem remetente' : 'Sem destinatário');
      if (!parties[party]) {
        parties[party] = { total: 0, onTime: 0, late: 0, delays: [] };
      }
      parties[party].total++;

      const scheduled = getScheduledDate(d);
      const arrival = getArrivalDate(d);
      if (scheduled && arrival) {
        const delay = new Date(arrival) - new Date(scheduled);
        if (delay <= 0) {
          parties[party].onTime++;
        } else {
          parties[party].late++;
          parties[party].delays.push(delay / (1000 * 60)); // minutos
        }
      }
    });

    return Object.entries(parties)
      .map(([name, data]) => ({
        name,
        total: data.total,
        onTimePercentage: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
        latePercentage: data.total > 0 ? Math.round((data.late / data.total) * 100) : 0,
        avgDelayMinutes: data.delays.length > 0 ? Math.round(data.delays.reduce((a, b) => a + b) / data.delays.length) : 0
      }))
      .sort((a, b) => b.latePercentage - a.latePercentage);
  }, [filteredDeliveries, city]);

  // ═══════════════════════════════════════════════════════════════
  // KPI 8: Tendência de Entregas (últimos 7, 15 e 30 dias)
  // ═══════════════════════════════════════════════════════════════
  const deliveryTrend = useMemo(() => {
    const now = new Date();
    const trend = {
      last7: 0,
      last15: 0,
      last30: 0
    };

    filteredDeliveries.forEach(d => {
      const dt = d.dtEntrega || d.dtSaida || d.createdAt;
      if (!dt) return;
      const deliveryDate = new Date(dt);
      const diffDays = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24));

      if (diffDays <= 7) trend.last7++;
      if (diffDays <= 15) trend.last15++;
      if (diffDays <= 30) trend.last30++;
    });

    return trend;
  }, [filteredDeliveries]);

  // Dados para gráfico de linha (tendência)
  const trendChartData = useMemo(() => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit' });

      const count = filteredDeliveries.filter(d => {
        const dt = d.dtEntrega || d.dtSaida || d.createdAt;
        if (!dt) return false;
        const deliveryDate = new Date(dt);
        return deliveryDate.toDateString() === date.toDateString();
      }).length;

      data.push({ date: dateStr, entrega: count });
    }
    return data;
  }, [filteredDeliveries]);

  // Gráfico de status
  const statusChartData = useMemo(() => {
    const statuses = {};
    filteredDeliveries.forEach(d => {
      const status = d.status || 'Desconhecido';
      statuses[status] = (statuses[status] || 0) + 1;
    });
    return Object.entries(statuses).map(([status, count]) => ({ name: status, value: count }));
  }, [filteredDeliveries]);

  const COLORS = ['#34d399', '#fbbf24', '#fb7185', '#818cf8', '#22d3ee'];

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0d0b1e 0%, #111827 55%, #0a0d1a 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin"><FiRefreshCw size={32} className="text-indigo-400" /></div>
          <p className="text-slate-400">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d0b1e 0%, #111827 55%, #0a0d1a 100%)' }}>
      {/* HEADER */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl border-b border-white/10 flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/home')}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition"
              >
                <FiArrowLeft size={16} />
              </button>
              <div>
                <h1 className="text-lg font-bold">Análise de KPIs de Entregas</h1>
                <p className="text-xs text-slate-400">Dashboard com indicadores detalhados</p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition text-sm font-medium"
            >
              ← Voltar ao Dashboard
            </button>
          </div>

          {/* FILTROS */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Data Inicial</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Data Final</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Motorista</label>
              <input
                type="text"
                placeholder="Filtrar..."
                value={filters.driver}
                onChange={e => setFilters(f => ({ ...f, driver: e.target.value }))}
                className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Região</label>
              <input
                type="text"
                placeholder="Filtrar..."
                value={filters.region}
                onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}
                className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
              >
                <option value="">Todos</option>
                <option value="Entregue">Entregue</option>
                <option value="Pendente">Pendente</option>
                <option value="Em Rota">Em Rota</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-6 max-w-7xl mx-auto">
          {toast && <Toast {...toast} onClose={() => setToast(null)} />}

          {/* ════════ KPI CARDS ════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* On Time Rate */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase">Taxa no Prazo</p>
                <FiTrendingUp className="text-emerald-400" size={18} />
              </div>
              <p className="text-3xl font-bold text-emerald-400">{onTimeRate}%</p>
              <p className="text-xs text-slate-500 mt-1">Meta: 95%</p>
            </div>

            {/* Total Entregas */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase">Total Entregas</p>
                <FiPackage className="text-indigo-400" size={18} />
              </div>
              <p className="text-3xl font-bold text-indigo-400">{totalDeliveries}</p>
              <p className="text-xs text-slate-500 mt-1">{completedDeliveries} Entregues</p>
            </div>

            {/* Late Deliveries */}
            <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase">Atrasos</p>
                <FiTrendingDown className="text-red-400" size={18} />
              </div>
              <p className="text-3xl font-bold text-red-400">{lateDeliveries.count}</p>
              <p className="text-xs text-slate-500 mt-1">{lateDeliveries.percentage}% do total</p>
            </div>

            {/* Avg Time */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase">Tempo Médio</p>
                <FiClock className="text-cyan-400" size={18} />
              </div>
              <p className="text-3xl font-bold text-cyan-400">{averageDeliveryTime}h</p>
              <p className="text-xs text-slate-500 mt-1">Saída até Entrega</p>
            </div>
          </div>

          {/* ════════ SLA E TENDÊNCIA ════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <FiBarChart2 className="text-amber-400" />
                <h3 className="font-semibold text-slate-200">SLA de Entrega</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Cumpridos:</span>
                  <span className="font-bold text-amber-400">{slaMetric.met}/{slaMetric.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Taxa:</span>
                  <span className="font-bold text-amber-400">{slaMetric.percentage}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 mt-3">
                  <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${slaMetric.percentage}%` }} />
                </div>
              </div>
            </div>

            {/* Últimas 7, 15, 30 dias */}
            <div className="lg:col-span-2 bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-2xl p-5">
              <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <FiTrendingUp className="text-purple-400" /> Tendência de Entregas
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">Últimos 7 dias</p>
                  <p className="text-2xl font-bold text-purple-400">{deliveryTrend.last7}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">Últimos 15 dias</p>
                  <p className="text-2xl font-bold text-purple-400">{deliveryTrend.last15}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">Últimos 30 dias</p>
                  <p className="text-2xl font-bold text-purple-400">{deliveryTrend.last30}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ════════ GRÁFICOS ════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Linha: Tendência */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-semibold text-slate-200 mb-4">Tendência - Últimos 30 dias</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendChartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                  <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <Line type="monotone" dataKey="entrega" stroke="#22d3ee" dot={{ fill: '#22d3ee', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pizza: Status */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-semibold text-slate-200 mb-4">Distribuição por Status</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label>
                    {statusChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ════════ TABELAS ════════ */}
          {/* Performance por Motorista */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <FiTruck className="text-cyan-400" /> Performance por Motorista
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr className="text-slate-400 text-xs uppercase">
                    <th className="text-left py-3 px-4">Motorista</th>
                    <th className="text-center py-3 px-4">Total</th>
                    <th className="text-center py-3 px-4">% No Prazo</th>
                    <th className="text-center py-3 px-4">% Atrasado</th>
                  </tr>
                </thead>
                <tbody>
                  {driverPerformance.map((driver, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-3 px-4 text-slate-300">{driver.name}</td>
                      <td className="text-center py-3 px-4 text-slate-300">{driver.total}</td>
                      <td className="text-center py-3 px-4">
                        <span className={driver.onTimePercentage >= 90 ? 'text-emerald-400' : driver.onTimePercentage >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                          {driver.onTimePercentage}%
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 text-red-400">{driver.latePercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance por Remetente/Destinatário */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <FiAlertTriangle className="text-amber-400" />
              Performance por {city === 'itajai' ? 'Remetente' : 'Destinatário'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr className="text-slate-400 text-xs uppercase">
                    <th className="text-left py-3 px-4">{city === 'itajai' ? 'Remetente' : 'Destinatário'}</th>
                    <th className="text-center py-3 px-4">Total</th>
                    <th className="text-center py-3 px-4">% No Prazo</th>
                    <th className="text-center py-3 px-4">% Atrasado</th>
                    <th className="text-center py-3 px-4">Atraso Médio (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceByParty.map((party, i) => (
                    <tr key={i} className={`border-b border-white/5 transition ${party.latePercentage > 20 ? 'bg-red-500/10' : 'hover:bg-white/5'}`}>
                      <td className="py-3 px-4 text-slate-300">{party.name}</td>
                      <td className="text-center py-3 px-4 text-slate-300">{party.total}</td>
                      <td className="text-center py-3 px-4 text-emerald-400">{party.onTimePercentage}%</td>
                      <td className="text-center py-3 px-4 text-red-400">{party.latePercentage}%</td>
                      <td className="text-center py-3 px-4 text-amber-400">{party.avgDelayMinutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insights Automáticos */}
          {(onTimeRate < 80 || lateDeliveries.percentage > 20) && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
              <h3 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                <FiAlertTriangle /> Alertas
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {onTimeRate < 80 && <li>⚠️ Taxa de uma no prazo ({onTimeRate}%) está abaixo do ideal (95%). Investigar causas de atraso.</li>}
                {lateDeliveries.percentage > 20 && <li>⚠️ {lateDeliveries.percentage}% das entregas estão atrasadas ({lateDeliveries.count}). Revisar processos.</li>}
                {performanceByParty.some(p => p.latePercentage > 30) && (
                  <li>⚠️ {city === 'itajai' ? 'Remetentes críticos' : 'Destinatários críticos'} detectados: {performanceByParty.filter(p => p.latePercentage > 30).map(p => p.name).join(', ')} com atrasos acima de 30%.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KPIAnalytics;
