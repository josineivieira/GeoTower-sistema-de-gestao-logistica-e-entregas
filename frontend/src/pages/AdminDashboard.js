import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { FaArrowLeft } from 'react-icons/fa';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({
    searchTerm: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [delivRes, statsRes] = await Promise.all([
        adminService.getDeliveries(filters),
        adminService.getStatistics({ period })
      ]);
      setDeliveries(delivRes.data.deliveries);
      setStatistics(statsRes.data.statistics);
    } catch (error) {
      setToast({ message: 'Erro ao carregar dados', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // helper para calcular tempo CLI
  const getCliMinutes = (delivery) => {
    if (!delivery.horarioChegada) return null;
    const chegada = new Date(delivery.horarioChegada);
    const referencia = delivery.horarioFimDesova ? new Date(delivery.horarioFimDesova) : new Date();
    const diff = referencia - chegada;
    if (diff < 0) return null;
    return diff / 60000; // minutes
  };

  // calcula top 5 recebedores com contagem
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

  // calcula média de tempo CLI por recebedor
  const avgCliByRecebedor = React.useMemo(() => {
    const sums = {};
    const counts = {};
    deliveries.forEach(d => {
      const key = d.recebedor || '-';
      const mins = getCliMinutes(d);
      if (mins != null) {
        sums[key] = (sums[key] || 0) + mins;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    const res = {};
    Object.keys(sums).forEach(k => {
      res[k] = sums[k] / counts[k];
    });
    return res;
  }, [deliveries]);

  // dados para gráficos
  const recebedorCountData = React.useMemo(() => {
    return topRecebedores.map(r => ({ name: r.recebedor, count: r.count }));
  }, [topRecebedores]);

  const recebedorAvgData = React.useMemo(() => {
    return Object.entries(avgCliByRecebedor)
      .map(([recebedor, avg]) => ({ name: recebedor, avg }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [avgCliByRecebedor]);

  const formatMinutes = (m) => {
    if (m == null) return '-';
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    if (h > 0) return `${h}h ${min}m`;
    return `${min}m`;
  };

  const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-900 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/home')}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition"
              >
                <FaArrowLeft className="text-lg" />
              </button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard de Indicadores</h1>
                <p className="text-purple-200 text-sm mt-1">Análise em tempo real das entregas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 pb-20">
        {/* Filtros Gerais */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-l-4 border-purple-600">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Filtros Gerais</h3>
            <button
              onClick={() => {
                setPeriod('month');
                setFilters({ searchTerm: '', startDate: '', endDate: '' });
              }}
              className="text-sm px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition"
            >
              Limpar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Período</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-300 focus:border-purple-600 focus:outline-none font-medium"
              >
                <option value="day">Hoje</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mês</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Buscar</label>
              <input
                type="text"
                placeholder="Nº entrega ou motorista"
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-300 focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">De</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-300 focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Até</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-300 focus:border-purple-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        {statistics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-blue-500 hover:shadow-xl transition transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold uppercase">Total de Entregas</p>
                  <p className="text-4xl font-bold text-blue-600 mt-2">{statistics.totalDeliveries}</p>
                </div>
                <div className="text-5xl text-blue-200">📦</div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                {period === 'day' ? 'Hoje' : period === 'week' ? 'Esta semana' : 'Este mês'}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-green-500 hover:shadow-xl transition transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold uppercase">Motoristas Ativos</p>
                  <p className="text-4xl font-bold text-green-600 mt-2">{statistics.deliveriesByDriver.length}</p>
                </div>
                <div className="text-5xl text-green-200">🚗</div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-orange-500 hover:shadow-xl transition transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold uppercase">Top Recebedor</p>
                  <p className="text-2xl font-bold text-orange-600 mt-2">{topRecebedores.length > 0 ? topRecebedores[0].count : '0'}</p>
                </div>
                <div className="text-5xl text-orange-200">👑</div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-purple-500 hover:shadow-xl transition transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold uppercase">Taxa Finalização</p>
                  <p className="text-4xl font-bold text-purple-600 mt-2">100%</p>
                </div>
                <div className="text-5xl text-purple-200">✅</div>
              </div>
            </div>
          </div>
        )}

        {/* Gráficos principais */}
        {statistics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Entregas por dia */}
            {statistics.dailyDeliveries.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  Entregas por Dia
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={statistics.dailyDeliveries} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                    <defs>
                      <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="_id" 
                      stroke="#6b7280"
                      tickFormatter={(date) => {
                        const parts = String(date).split('-');
                        if (parts.length === 3) {
                          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                          return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        }
                        return date;
                      }}
                    />
                    <YAxis stroke="#6b7280" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                      labelFormatter={(label) => {
                        const parts = String(label).split('-');
                        if (parts.length === 3) {
                          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                          return d.toLocaleDateString('pt-BR');
                        }
                        return label;
                      }}
                    />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Entregas por contratado */}
            {statistics.deliveriesByDriver.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  Entregas por Contratado
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={statistics.deliveriesByDriver} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="_id" 
                      stroke="#6b7280"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} formatter={(value) => `${value} entrega(s)`} />
                    <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]}>
                      {statistics.deliveriesByDriver.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Gráficos de recebedores */}
        {deliveries.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                Entregas por Recebedor
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={recebedorCountData} layout="vertical" margin={{ top: 10, right: 20, left: 150, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" />
                  <YAxis type="category" dataKey="name" stroke="#6b7280" width={140} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} formatter={(value) => `${value} entrega(s)`} />
                  <Bar dataKey="count" fill="#06b6d4" radius={[0, 8, 8, 0]}>
                    {recebedorCountData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                Tempo Médio no Cliente
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={recebedorAvgData} layout="vertical" margin={{ top: 10, right: 20, left: 150, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" tickFormatter={(v) => formatMinutes(v)} />
                  <YAxis type="category" dataKey="name" stroke="#6b7280" width={140} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => formatMinutes(value)} 
                  />
                  <Bar dataKey="avg" fill="#10b981" radius={[0, 8, 8, 0]}>
                    {recebedorAvgData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default AdminDashboard;
