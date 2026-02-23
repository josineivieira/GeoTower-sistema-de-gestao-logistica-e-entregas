import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { deliveryService } from '../services/authService';
import Footer from '../components/Footer';
import {
  FaChartBar,
  FaFileAlt,
  FaUsers,
  FaDatabase,
  FaCalendarAlt,
  FaCheckCircle,
  FaBoxes,
  FaWhatsapp,
  FaMapMarkerAlt
} from 'react-icons/fa';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statsTodayTab, setStatsTodayTab] = useState('today');

  // Funções para controlar permissões por perfil
  const hasAccess = (requiredRoles) => {
    if (!user?.role) return false;
    return requiredRoles.includes(user.role);
  };

  const canEdit = () => {
    // Gerente e Admin podem editar
    return hasAccess(['manager', 'admin']);
  };

  const isViewOnly = () => {
    // GeoMar tem acesso visual apenas
    return user?.role === 'geomar';
  };

  const canAccessAdminPanel = () => {
    // Gerente, Admin e GeoMar
    return hasAccess(['manager', 'admin', 'geomar']);
  };
  const [statsToday, setStatsToday] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    onTimePercentage: 100
  });
  const [statsGeneral, setStatsGeneral] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    onTimePercentage: 100
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'driver') {
      loadDeliveryStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadDeliveryStats = async () => {
    setLoading(true);
    try {
      const res = await deliveryService.getProgramacoesAssigned();
      const programacoes = res.data.programacoes || [];
      
      // Filtrar entregas do motorista logado
      const nomeFiltro = (user?.username || user?.name || '').trim().toUpperCase();
      const minhasEntregas = programacoes.filter(
        p => String(p.contratado).trim().toUpperCase() === nomeFiltro
      );

      // Calcular estatísticas GERAL (todas as entregas)
      const calcularStats = (entregas) => {
        const total = entregas.length;
        const completed = entregas.filter(e => 
          String(e.status).toUpperCase() === 'ENTREGUE'
        ).length;
        const inProgress = entregas.filter(e => 
          String(e.status).toUpperCase() === 'EM_ROTA'
        ).length;
        const pending = entregas.filter(e => 
          !['ENTREGUE', 'EM_ROTA'].includes(String(e.status).toUpperCase())
        ).length;

        let onTimeCount = 0;
        entregas.forEach(entrega => {
          if (String(entrega.status).toUpperCase() === 'ENTREGUE') {
            onTimeCount++;
          }
        });
        const onTimePercentage = completed > 0 ? Math.round((onTimeCount / completed) * 100) : 100;

        return {
          total,
          completed,
          inProgress,
          pending,
          onTimePercentage
        };
      };

      // Filtrar apenas entregas de HOJE
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const entregasHoje = minhasEntregas.filter(entrega => {
        const dataEntrega = new Date(entrega.data);
        dataEntrega.setHours(0, 0, 0, 0);
        return dataEntrega.getTime() === today.getTime();
      });

      const statsHoje = calcularStats(entregasHoje);
      const statsGeral = calcularStats(minhasEntregas);

      setStatsToday(statsHoje);
      setStatsGeneral(statsGeral);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      setStatsToday({
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        onTimePercentage: 100
      });
      setStatsGeneral({
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        onTimePercentage: 100
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    // ✅ Não use min-h-screen aqui (quem controla altura/scroll agora é o AppLayout)
    <div className="bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-10 pb-20">
        {/* Welcome Section */}
        <div className="mb-10">
          <p className="text-purple-600 font-semibold text-sm uppercase tracking-wide mb-2">
            Bem-vindo ao Sistema GeoLog
          </p>

          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
            Olá,{' '}
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {user?.fullName || user?.name || 'Usuário'}
            </span>
            ! 👋
          </h1>

          <p className="text-gray-600 text-base sm:text-lg">
            Gerenciamento Logistico de Entregas da GeoLog
          </p>
        </div>

        {/* Driver Operations Cards - Hidden for Admins */}
        {user?.role !== 'admin' && (
          <>
            {/* DASHBOARD STATS - Para Drivers */}
            {user?.role === 'driver' && (
              <div className="mb-10">
                {/* Tabs para alternar entre Hoje e Geral */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">📊 Seu Desempenho</h2>
                  <div className="flex gap-2 bg-gray-200 rounded-lg p-1">
                    <button
                      onClick={() => setStatsTodayTab('today')}
                      className={`px-4 py-2 rounded-md font-semibold text-sm transition-all ${
                        statsTodayTab === 'today'
                          ? 'bg-white text-purple-600 shadow-md'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📅 Hoje
                    </button>
                    <button
                      onClick={() => setStatsTodayTab('general')}
                      className={`px-4 py-2 rounded-md font-semibold text-sm transition-all ${
                        statsTodayTab === 'general'
                          ? 'bg-white text-purple-600 shadow-md'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📈 Geral
                    </button>
                  </div>
                </div>

                {/* Cards Com Dados Dinâmicos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card Entregas Programadas */}
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">📅 Programadas</p>
                        <p className="text-3xl font-bold text-indigo-600">
                          {statsTodayTab === 'today' ? statsToday.total : statsGeneral.total}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Entregas agendadas</p>
                      </div>
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <FaCalendarAlt className="text-indigo-600 text-lg" />
                      </div>
                    </div>
                  </div>

                  {/* Card Concluídas */}
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">✅ Concluídas</p>
                        <p className="text-3xl font-bold text-emerald-600">
                          {statsTodayTab === 'today' ? statsToday.completed : statsGeneral.completed}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Expedidas com sucesso</p>
                      </div>
                      <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <FaCheckCircle className="text-emerald-600 text-lg" />
                      </div>
                    </div>
                  </div>

                  {/* Card Performance de Pontualidade */}
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">⏱️ Pontualidade</p>
                        <p className="text-3xl font-bold text-green-600">
                          {statsTodayTab === 'today' ? statsToday.onTimePercentage : statsGeneral.onTimePercentage}%
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Taxa de entregas no prazo</p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">📈</span>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          (statsTodayTab === 'today' ? statsToday.onTimePercentage : statsGeneral.onTimePercentage) >= 90 ? 'bg-green-500' :
                          (statsTodayTab === 'today' ? statsToday.onTimePercentage : statsGeneral.onTimePercentage) >= 80 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${statsTodayTab === 'today' ? statsToday.onTimePercentage : statsGeneral.onTimePercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Card Em Rota */}
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">🚚 Em Rota</p>
                        <p className="text-3xl font-bold text-blue-600">
                          {statsTodayTab === 'today' ? statsToday.inProgress : statsGeneral.inProgress}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Entregas em andamento</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-xl">🚛</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {user?.role === 'driver' && (
              <div className="mb-12">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6">🎯 Ações Rápidas</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Card Entregas Programadas */}
                  <button
                    onClick={() => navigate('/entregas-programadas')}
                    className="group relative bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-indigo-200 hover:border-indigo-400 overflow-hidden text-left hover:scale-105"
                  >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-indigo-300 to-transparent opacity-20 group-hover:opacity-40 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />
                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <FaCalendarAlt className="text-2xl text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Entregas Programadas</h3>
                      <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                        Veja todas as entregas agendadas vinculadas à sua transportadora
                      </p>
                      <div className="flex items-center gap-2 text-indigo-600 font-bold">
                        <span>Acessar</span>
                        <span className="text-lg group-hover:translate-x-2 transition-transform duration-300">→</span>
                      </div>
                    </div>
                  </button>

                  {/* Card Minhas Entregas */}
                  <button
                    onClick={() => navigate('/minhas-entregas')}
                    className="group relative bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-emerald-200 hover:border-emerald-400 overflow-hidden text-left hover:scale-105"
                  >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-300 to-transparent opacity-20 group-hover:opacity-40 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />
                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <FaBoxes className="text-2xl text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Minhas Entregas</h3>
                      <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                        Acompanhe todas as suas entregas em tempo real e histórico completo
                      </p>
                      <div className="flex items-center gap-2 text-emerald-600 font-bold">
                        <span>Acessar</span>
                        <span className="text-lg group-hover:translate-x-2 transition-transform duration-300">→</span>
                      </div>
                    </div>
                  </button>


                </div>
              </div>
            )}
          </>
        )}

        {/* Admin Dashboard Section - Conditional */}
        {canAccessAdminPanel() && (
          <>
            {/* MONITORAMENTO & ANALYTICS - Titulo unificado com melhor espaço */}
            <div className="mb-8 mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">📊 Monitoramento & Relatórios</h2>
              <p className="text-gray-500 text-sm">Acompanhe em tempo real todas as operações e entregas</p>
            </div>
            
            <div className="mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              <button
                onClick={() => navigate('/admin')}
                disabled={isViewOnly()}
                className={`group relative bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-10 border-2 border-orange-200 hover:border-orange-400 overflow-hidden text-left ${isViewOnly() ? 'opacity-60 cursor-not-allowed' : 'hover:scale-102'}`}
                title={isViewOnly() ? 'Apenas visualização (sem edição)' : ''}
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-orange-300 to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-300 rounded-full -mr-24 -mt-24" />

                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl mb-5 group-hover:scale-125 transition-transform duration-300 shadow-lg">
                    <FaChartBar className="text-3xl text-white" />
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    📈 Dashboard Analytics
                  </h2>
                  <p className="text-gray-700 mb-5 text-base leading-relaxed">
                    Análise completa com estatísticas, gráficos e relatórios detalhados sobre todas as operações
                  </p>
                  {isViewOnly() && <p className="text-xs text-amber-600 font-semibold mb-3">👁️ Apenas Visualização</p>}

                  <div className="flex items-center gap-2 text-orange-600 font-bold text-lg">
                    <span>Acessar</span>
                    <span className="text-xl group-hover:translate-x-2 transition-transform duration-300">
                      →
                    </span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/monitor-entregas')}
                disabled={isViewOnly()}
                className={`group relative bg-gradient-to-br from-red-50 to-red-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-10 border-2 border-red-200 hover:border-red-400 overflow-hidden text-left ${isViewOnly() ? 'opacity-60 cursor-not-allowed' : 'hover:scale-102'}`}
                title={isViewOnly() ? 'Apenas visualização (sem edição)' : ''}
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-red-300 to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-300 rounded-full -mr-24 -mt-24" />

                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl mb-5 group-hover:scale-125 transition-transform duration-300 shadow-lg">
                    <FaFileAlt className="text-3xl text-white" />
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    🎯 Torre de Controle
                  </h2>
                  <p className="text-gray-700 mb-5 text-base leading-relaxed">
                    Monitore todas as entregas em tempo real com filtros avançados, busca e rastreamento completo
                  </p>
                  {isViewOnly() && <p className="text-xs text-amber-600 font-semibold mb-3">👁️ Apenas Visualização</p>}

                  <div className="flex items-center gap-2 text-red-600 font-bold text-lg">
                    <span>Acessar</span>
                    <span className="text-xl group-hover:translate-x-2 transition-transform duration-300">
                      →
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* GERENCIAMENTO & CONFIGURAÇÕES - Novo layout com 4 cards */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">⚙️ Gerenciamento & Configurações</h2>
              <p className="text-gray-500 text-sm">Controle total sobre usuários, motoristas e programações</p>
            </div>

            <div className="mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Gerenciar Usuários - Apenas Gerente */}
              {hasAccess(['manager']) && (
                <button
                  onClick={() => navigate('/usuarios')}
                  className="group relative bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 border-2 border-purple-200 hover:border-purple-400 overflow-hidden text-left hover:scale-105"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-purple-300 to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />

                  <div className="relative z-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-4 group-hover:scale-120 transition-transform duration-300 shadow-lg">
                      <FaUsers className="text-2xl text-white" />
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      👥 Gerenciar Usuários
                    </h2>
                    <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                      Criar, editar e controlar perfis de todos os usuários do sistema
                    </p>

                    <div className="flex items-center gap-2 text-purple-600 font-bold">
                      <span>Acessar</span>
                      <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                        →
                      </span>
                    </div>
                  </div>
                </button>
              )}

              <button
                onClick={() => navigate('/motoristas')}
                disabled={isViewOnly()}
                className={`group relative bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 border-2 border-cyan-200 hover:border-cyan-400 overflow-hidden text-left ${isViewOnly() ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'}`}
                title={isViewOnly() ? 'Apenas visualização (sem edição)' : ''}
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-cyan-300 to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />

                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl mb-4 group-hover:scale-120 transition-transform duration-300 shadow-lg">
                    <span className="text-2xl">👤</span>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    👨‍🚗 Motoristas
                  </h2>
                  <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                    Gerenciar motoristas, dados, rastreadores e contatos
                  </p>
                  {isViewOnly() && <p className="text-xs text-amber-600 font-semibold mb-2">👁️ Apenas Visualização</p>}

                  <div className="flex items-center gap-2 text-cyan-600 font-bold">
                    <span>Acessar</span>
                    <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                      →
                    </span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/programacoes')}
                disabled={isViewOnly()}
                className={`group relative bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 border-2 border-teal-200 hover:border-teal-400 overflow-hidden text-left ${isViewOnly() ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'}`}
                title={isViewOnly() ? 'Apenas visualização (sem edição)' : ''}
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-teal-300 to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />

                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl mb-4 group-hover:scale-120 transition-transform duration-300 shadow-lg">
                    <FaDatabase className="text-2xl text-white" />
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    📦 Programações
                  </h2>
                  <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                    Gerenciar programações de entregas com todos os detalhes
                  </p>
                  {isViewOnly() && <p className="text-xs text-amber-600 font-semibold mb-2">👁️ Apenas Visualização</p>}

                  <div className="flex items-center gap-2 text-teal-600 font-bold">
                    <span>Acessar</span>
                    <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                      →
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Info Cards */}




        {/* Se você realmente usa Toast aqui, pode manter; se não usa, pode remover o import */}
        {/* {toast && <Toast ... />} */}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Home;
