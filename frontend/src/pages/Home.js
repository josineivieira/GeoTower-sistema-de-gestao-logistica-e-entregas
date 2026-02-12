import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { useAuth } from '../services/authContext';
import { deliveryService } from '../services/authService';
import {
  FaPlus,
  FaHistory,
  FaChartBar,
  FaCheckCircle,
  FaClock,
  FaFileAlt,
  FaUsers,
  FaTruck,
  FaDatabase
} from 'react-icons/fa';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Load basic stats if needed
  }, []);

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

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Nova Entrega Card */}
          <button
            onClick={() => navigate('/nova-entrega')}
            className="group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-purple-200 overflow-hidden text-left"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-purple-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />

            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                <FaPlus className="text-2xl text-white" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Nova Entrega</h2>
              <p className="text-gray-600 mb-4">
                Registre uma nova entrega e faça upload dos documentos necessários
              </p>

              <div className="flex items-center gap-2 text-purple-600 font-semibold">
                <span>Iniciar</span>
                <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                  →
                </span>
              </div>
            </div>
          </button>

          {/* Minhas Entregas Card */}
          <button
            onClick={() => navigate('/minhas-entregas')}
            className="group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-blue-200 overflow-hidden text-left"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full -mr-20 -mt-20" />

            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                <FaHistory className="text-2xl text-white" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Minhas Entregas</h2>
              <p className="text-gray-600 mb-4">
                Visualize o histórico, status e detalhes de suas entregas
              </p>

              <div className="flex items-center gap-2 text-blue-600 font-semibold">
                <span>Acessar</span>
                <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                  →
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Admin Dashboard Card - Conditional */}
        {user?.role === 'admin' && (
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
                  Dashboard Admin
                </h2>
                <p className="text-gray-600 mb-4">
                  Relatórios, estatísticas e gráficos detalhados
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
                  Acompanhe todas as entregas em tempo real com filtros e busca
                </p>

                <div className="flex items-center gap-2 text-red-600 font-semibold">
                  <span>Acessar</span>
                  <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                    →
                  </span>
                </div>
              </div>
            </button>

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
                    Criar, editar e definir perfis de usuários (motorista, gerente, admin) - Acesso exclusivo para Gerentes
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

            {user?.role === 'admin' && (
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
                    Gerencie motoristas, CPF, vínculo, rastreador e informações de contato - Apenas Admins
                  </p>

                  <div className="flex items-center gap-2 text-cyan-600 font-semibold">
                    <span>Acessar</span>
                    <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                      →
                    </span>
                  </div>
                </div>
              </button>
            )}

            {user?.role === 'admin' && (
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
                    Gerencie processo, recebedor, data, contratado e motorista das entregas - Apenas Admins
                  </p>

                  <div className="flex items-center gap-2 text-teal-600 font-semibold">
                    <span>Acessar</span>
                    <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">
                      →
                    </span>
                  </div>
                </div>
              </button>
            )}


          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <FaCheckCircle className="text-xl text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900">Fotos Claras</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Tire fotos bem iluminadas e legíveis dos documentos para melhor processamento
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FaFileAlt className="text-xl text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900">5 Documentos</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Todos os 5 documentos são obrigatórios para enviar a entrega com sucesso
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FaClock className="text-xl text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900">Salvo Automaticamente</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Suas entregas são salvas automaticamente, não perca documentos
            </p>
          </div>
        </div>

        {/* Tips Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="text-2xl">💡</span> Dicas para melhor experiência
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span className="text-gray-700">
                Certifique-se de que todos os dados do container estão corretos antes de salvar
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span className="text-gray-700">
                Se algo der errado, você pode tentar novamente sem perder os documentos salvos
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span className="text-gray-700">
                Use a aba &quot;Minhas Entregas&quot; para acompanhar o status de todos os seus registros
              </span>
            </li>
          </ul>
        </div>

        {/* Se você realmente usa Toast aqui, pode manter; se não usa, pode remover o import */}
        {/* {toast && <Toast ... />} */}
      </div>
    </div>
  );
};

export default Home;
