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

            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Operações</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {/* Apenas Entregas Programadas mantida */}
            </div>

            {/* Entregas Programadas e Em Andamento - Apenas para motorista */}
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

                {/* Footer / Company Info */}
                <footer className="mt-12 md:mt-16 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 rounded-2xl overflow-hidden">
                  <div className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-12">
                    {/* Company Header */}
                    <div className="mb-10 md:mb-12">
                      <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
                        <img src="https://www.geotransportes.com.br/lovable-uploads/1370f489-a7bc-4d3b-a916-4e11a73378f0.png" alt="GeoTransportes" className="w-24 md:w-28 h-auto object-contain" />
                        <div>
                          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                            Geo<span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Transportes</span>
                          </h3>
                          <p className="text-base md:text-lg text-gray-700 font-medium">Logística Rodoviária</p>
                          <p className="text-sm md:text-base text-gray-600">Atendimento e suporte</p>
                        </div>
                      </div>

                      {/* Instagram Button */}
                      <div>
                        <p className="text-xs text-gray-600 mb-2 font-semibold uppercase tracking-wide">Redes Sociais</p>
                        <a href="https://www.instagram.com/_grupogeo/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-lg transition-all duration-300 hover:scale-105">
                          <img src="https://img.icons8.com/?size=100&id=32292&format=png&color=FFFFFF" alt="Instagram" className="h-4 w-4" />
                          <span className="text-xs font-semibold text-white">Instagram</span>
                        </a>
                      </div>
                    </div>

                    {/* Locations + Contacts Grid */}
                    <div className="grid grid-cols-2 gap-6 md:gap-10 md:gap-12 mb-8">
                      {/* Locations */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                          📍 Localidades
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <FaMapMarkerAlt className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Itajaí - SC</p>
                              <p className="text-xs text-gray-600">Av Itaipava</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <FaMapMarkerAlt className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Garuva - SC</p>
                              <p className="text-xs text-gray-600">BR101 Km 10</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <FaMapMarkerAlt className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Manaus - AM</p>
                              <p className="text-xs text-gray-600">Rua Gisele</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contacts */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                          💬 Contatos
                        </h4>
                        <div className="space-y-3">
                          <a href="https://wa.me/5592982760023" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-gray-700 hover:text-green-600 transition-colors">
                            <FaWhatsapp className="text-green-500 text-lg flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Gerência</p>
                              <p className="text-sm font-semibold text-gray-900">Igo Ferro</p>
                            </div>
                          </a>
                          <a href="https://wa.me/5592982410180" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-gray-700 hover:text-green-600 transition-colors">
                            <FaWhatsapp className="text-green-500 text-lg flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Operacional</p>
                              <p className="text-sm font-semibold text-gray-900">Daniela Pontes</p>
                            </div>
                          </a>
                          <a href="https://wa.me/5592982410138" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-gray-700 hover:text-green-600 transition-colors">
                            <FaWhatsapp className="text-green-500 text-lg flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Operacional</p>
                              <p className="text-sm font-semibold text-gray-900">Lia Lima</p>
                            </div>
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Copyright Bar */}
                    <div className="border-t-2 border-gray-200 pt-6 text-center">
                      <p className="text-xs text-gray-600">© {new Date().getFullYear()} <span className="font-bold text-gray-900">GeoTransportes</span> • Todos os direitos reservados</p>
                    </div>
                  </div>
                </footer>
              </div>
            )}
          </>
        )}

        {/* Admin Dashboard Section - Conditional */}
        {user?.role === 'admin' && (
          <>
            {/* MONITORAMENTO Section */}
            <div className="mb-6 mt-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Monitoramento & Analytics</h2>
            </div>
            
            <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={() => navigate('/admin')}
                className="group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-orange-200 overflow-hidden text-left"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-orange-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />

                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    <FaChartBar className="text-2xl text-white" />
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Dashboard Analytics
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Relatórios, estatísticas e gráficos detalhados de operações
                  </p>

                  <div className="flex items-center gap-2 text-orange-600 font-semibold">
                    <span>Acessar</span>
                    <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                      →
                    </span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/monitor-entregas')}
                className="group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-red-200 overflow-hidden text-left"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-red-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />

                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    <FaFileAlt className="text-2xl text-white" />
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Torre de Controle
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Acompanhe todas as entregas em tempo real com filtros e busca avançada
                  </p>

                  <div className="flex items-center gap-2 text-red-600 font-semibold">
                    <span>Acessar</span>
                    <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                      →
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* GERENCIAMENTO Section */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Gerenciamento & Configurações</h2>
            </div>

            <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              {(user?.role === 'manager' || user?.role === 'admin') && (
                <button
                  onClick={() => navigate('/usuarios')}
                  className="group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-purple-200 overflow-hidden text-left"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-purple-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />

                  <div className="relative z-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                      <FaUsers className="text-2xl text-white" />
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      Gerenciar Usuários
                    </h2>
                    <p className="text-gray-600 mb-4">
                      Criar, editar e controlar perfis de usuários (motorista, gerente, admin)
                    </p>

                    <div className="flex items-center gap-2 text-purple-600 font-semibold">
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
                className="group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-cyan-200 overflow-hidden text-left"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-cyan-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />

                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    <span className="text-2xl">👤</span>
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Cadastro de Motoristas
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Gerenciar motoristas, CPF, vínculo, rastreador, cavalo, carreta e contatos
                  </p>

                  <div className="flex items-center gap-2 text-cyan-600 font-semibold">
                    <span>Acessar</span>
                    <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                      →
                    </span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/programacoes')}
                className="group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-teal-200 overflow-hidden text-left"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-teal-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />

                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    <FaDatabase className="text-2xl text-white" />
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Programação de Entregas
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Gerenciar processo, recebedor, data, contratado, motorista das entregas
                  </p>

                  <div className="flex items-center gap-2 text-teal-600 font-semibold">
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
