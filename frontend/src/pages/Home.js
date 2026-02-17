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
  FaDatabase
} from 'react-icons/fa';
import { FaCalendarAlt } from 'react-icons/fa';

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
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Operações</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {/* Apenas Entregas Programadas mantida */}
            </div>

            {/* Entregas Programadas e Em Andamento - Apenas para motorista */}
            {user?.role === 'driver' && (
              <div className="grid grid-cols-1 gap-6 mb-12">
                <button
                  onClick={() => navigate('/entregas-programadas')}
                  className="group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-indigo-200 overflow-hidden text-left"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-indigo-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />
                  <div className="relative z-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                      <FaCalendarAlt className="text-2xl text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Entregas Programadas</h2>
                    <p className="text-gray-600 mb-4">
                      Veja as entregas agendadas vinculadas à sua transportadora (contratado)
                    </p>
                    <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                      <span>Acessar</span>
                      <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                        →
                      </span>
                    </div>
                  </div>
                </button>
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
