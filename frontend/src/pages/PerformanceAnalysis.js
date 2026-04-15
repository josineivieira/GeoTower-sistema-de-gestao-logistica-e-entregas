import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { performanceService } from '../services/performanceService';

const PerformanceAnalysis = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const response = await performanceService.getPerformanceData(filters);
      if (response.success) {
        setData(response.data);
        setError(null);
      } else {
        setError('Erro ao carregar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar performance:', err);
      setError(err.response?.data?.message || 'Erro de conexão com o servidor');
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    fetchData(true);
  };

  const handleClearFilters = () => {
    setFilters({ startDate: '', endDate: '' });
    // Fetch sem filtros
    const tempFilters = { startDate: '', endDate: '' };
    performanceService.getPerformanceData(tempFilters).then(response => {
      if (response.success) {
        setData(response.data);
        setError(null);
      }
    }).catch(err => {
      setError('Erro ao limpar filtros');
    }).finally(() => setRefreshing(false));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando análise de performance...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded mb-6">
        <h3 className="font-bold mb-2">Erro ao carregar dados</h3>
        <p>{error}</p>
        <button 
          onClick={() => fetchData()}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Preparar dados para gráficos
  const dayData = data.entregasPorDia?.map(item => ({
    dia: item.dia,
    entregas: item.total
  })) || [];

  const contractorData = data.contratadosUtilizacao?.map(item => ({
    contratado: item.contratado,
    ativos: item.diasAtivos,
    ociosos: item.diasOciosos,
    totalEntregas: item.totalEntregas
  })) || [];

  // Converter faixas de objeto para array
  const faixasObj = data.tempoCliente?.faixas || { '2-4h': 0, '4-6h': 0, '+7h': 0 };
  const timeData = Object.entries(faixasObj).map(([nome, total]) => ({
    name: nome,
    value: total || 0
  })) || [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-gray-900">📊 Análise de Produtividade e Capacidade</h1>
        <p className="text-gray-600">Visualize dados analíticos de sua operação logística</p>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data Inicial</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data Final</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApplyFilters}
              disabled={refreshing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-semibold transition"
            >
              {refreshing ? 'Carregando...' : 'Aplicar'}
            </button>
            <button
              onClick={handleClearFilters}
              disabled={refreshing}
              className="flex-1 bg-gray-400 hover:bg-gray-500 disabled:opacity-50 text-white px-4 py-2 rounded-md font-semibold transition"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {data.alertas && data.alertas.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>🚨</span>
            Alertas Automáticos
          </h2>
          <div className="space-y-2">
            {data.alertas.map((alert, index) => {
              const mensagem = typeof alert === 'string' ? alert : alert.mensagem;
              return (
                <div key={index} className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded">
                  <p className="font-semibold">{mensagem}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase">Total Entregas</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">{data.estatisticasGerais?.totalEntregas || 0}</p>
            </div>
            <span className="text-4xl text-blue-200">📦</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase">Tempo Médio</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">{data.tempoCliente?.tempoMedioHoras?.toFixed(1) || 0}h</p>
            </div>
            <span className="text-4xl text-green-200">⏱️</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase">Entregas &gt;6h</h3>
              <p className="text-3xl font-bold text-red-600 mt-2">{data.estatisticasGerais?.percentualAcima6h?.toFixed(1) || 0}%</p>
            </div>
            <span className="text-4xl text-red-200">⚠️</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase">Contratados</h3>
              <p className="text-3xl font-bold text-purple-600 mt-2">{data.estatisticasGerais?.totalContratados || 0}</p>
            </div>
            <span className="text-4xl text-purple-200">🚚</span>
          </div>
        </div>
      </div>

      {/* Gráfico 1: Entregas por dia */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <span>📊</span>
          Entregas por Dia da Semana
        </h2>
        {dayData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="entregas" fill="#8884d8" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-500">Sem dados disponíveis</p>
        )}
      </div>

      {/* Gráfico 2: Utilização dos contratados */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <span>🚚</span>
          Utilização dos Contratados
        </h2>
        {contractorData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={contractorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="contratado" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="ativos" stackId="a" fill="#82ca9d" name="Dias Ativos" radius={[8, 8, 0, 0]} />
              <Bar dataKey="ociosos" stackId="a" fill="#ffc658" name="Dias Ociosos" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-500">Sem dados disponíveis</p>
        )}
      </div>

      {/* Gráfico 3: Faixas de tempo */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <span>⏱️</span>
          Distribuição de Tempo no Cliente
        </h2>
        {timeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={timeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {timeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-500">Sem dados disponíveis</p>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <span>📋</span>
          Detalhes dos Contratados
        </h2>
        {contractorData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Contratado</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Total Entregas</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Dias Ativos</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Dias Ociosos</th>
                </tr>
              </thead>
              <tbody>
                {contractorData.map((contractor, index) => (
                  <tr key={index} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{contractor.contratado}</td>
                    <td className="px-4 py-3 text-blue-600 font-semibold">{contractor.totalEntregas}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                        {contractor.ativos}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-semibold">
                        {contractor.ociosos}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500">Sem dados de contratados disponíveis</p>
        )}
      </div>
    </div>
  );
};

export default PerformanceAnalysis;