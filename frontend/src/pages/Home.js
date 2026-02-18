import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import {
  FaPlus,
  FaHistory,
  FaChartBar,
  FaFileAlt,
  FaUsers,
  FaTruck,
  FaDatabase,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaBoxes,
  FaRoad,
  FaStar,
  FaTasks
} from 'react-icons/fa';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    // ✅ Não use min-h-screen aqui (quem controla altura/scroll agora é o AppLayout)
    <div className="bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-10 pb-20">
        {/* Welcome Section */}
        <div className="mb-10">
          <p className="text-purple-600 font-semibold text-sm uppercase tracking-wide mb-2">
            Bem-vindo ao sistema
          </p>

          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
            Olá,{' '}
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {user?.fullName || user?.name || 'Usuário'}
            </span>
            ! 👋
          </h1>

          <p className="text-gray-600 text-base sm:text-lg">
            Gerencie suas entregas de forma simples e segura
          </p>
        </div>

        {/* Driver Operations Cards - Hidden for Admins */}
        {user?.role !== 'admin' && (
          <>
            {/* DASHBOARD STATS - Para Drivers */}
            {user?.role === 'driver' && (
              <div className="mb-10">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6">📊 Seu Desempenho Hoje</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card Entregas Programadas */}
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">📅 Programadas</p>
                        <p className="text-3xl font-bold text-indigo-600">-</p>
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
                        <p className="text-3xl font-bold text-emerald-600">-</p>
                        <p className="text-xs text-gray-400 mt-1">Expedidas com sucesso</p>
                      </div>
                      <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <FaCheckCircle className="text-emerald-600 text-lg" />
                      </div>
                    </div>
                  </div>

                  {/* Card Em Andamento */}
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">🚀 Em Andamento</p>
                        <p className="text-3xl font-bold text-blue-600">-</p>
                        <p className="text-xs text-gray-400 mt-1">Na rota agora</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FaRoad className="text-blue-600 text-lg" />
                      </div>
                    </div>
                  </div>

                  {/* Card Pendentes */}
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">⏳ Pendentes</p>
                        <p className="text-3xl font-bold text-amber-600">-</p>
                        <p className="text-xs text-gray-400 mt-1">Aguardando processamento</p>
                      </div>
                      <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                        <FaClock className="text-amber-600 text-lg" />
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

                  {/* Card Entregas em Rota */}
                  <button
                    onClick={() => navigate('/entregas-em-rota')}
                    className="group relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-blue-200 hover:border-blue-400 overflow-hidden text-left hover:scale-105"
                  >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-300 to-transparent opacity-20 group-hover:opacity-40 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />
                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <FaRoad className="text-2xl text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Entregas em Rota</h3>
                      <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                        Gerencie entregas em andamento e atualize status em tempo real
                      </p>
                      <div className="flex items-center gap-2 text-blue-600 font-bold">
                        <span>Acessar</span>
                        <span className="text-lg group-hover:translate-x-2 transition-transform duration-300">→</span>
                      </div>
                    </div>
                  </button>

                  {/* Card Entrega em Andamento */}
                  <button
                    onClick={() => navigate('/entrega-em-andamento')}
                    className="group relative bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-orange-200 hover:border-orange-400 overflow-hidden text-left hover:scale-105"
                  >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-orange-300 to-transparent opacity-20 group-hover:opacity-40 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />
                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <FaTasks className="text-2xl text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Entrega em Andamento</h3>
                      <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                        Monitore a entrega atual que você está realizando neste momento
                      </p>
                      <div className="flex items-center gap-2 text-orange-600 font-bold">
                        <span>Acessar</span>
                        <span className="text-lg group-hover:translate-x-2 transition-transform duration-300">→</span>
                      </div>
                    </div>
                  </button>

                  {/* Card Reconciliação */}
                  <button
                    onClick={() => navigate('/reconciliation')}
                    className="group relative bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-pink-200 hover:border-pink-400 overflow-hidden text-left hover:scale-105"
                  >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-pink-300 to-transparent opacity-20 group-hover:opacity-40 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />
                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <FaChartBar className="text-2xl text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Reconciliação</h3>
                      <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                        Concilie dados de entregas e valide informações de operações
                      </p>
                      <div className="flex items-center gap-2 text-pink-600 font-bold">
                        <span>Acessar</span>
                        <span className="text-lg group-hover:translate-x-2 transition-transform duration-300">→</span>
                      </div>
                    </div>
                  </button>

                  {/* Card Perfil */}
                  <button
                    onClick={() => navigate('/profile')}
                    className="group relative bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-purple-200 hover:border-purple-400 overflow-hidden text-left hover:scale-105"
                  >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-purple-300 to-transparent opacity-20 group-hover:opacity-40 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />
                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <FaStar className="text-2xl text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Meu Perfil</h3>
                      <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                        Gerencie suas informações pessoais, documentos e preferências
                      </p>
                      <div className="flex items-center gap-2 text-purple-600 font-bold">
                        <span>Acessar</span>
                        <span className="text-lg group-hover:translate-x-2 transition-transform duration-300">→</span>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Dica / Info Box */}
                <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-indigo-600 rounded-lg">
                  <p className="text-indigo-900 font-semibold flex items-center gap-2">
                    💡 <span>Dica: Comece acessando suas entregas programadas para ver o que tem agendado!</span>
                  </p>
                </div>
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
                    Monitor de Entregas
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
                    <FaTruck className="text-2xl text-white" />
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
    </div>
  );
};

export default Home;
