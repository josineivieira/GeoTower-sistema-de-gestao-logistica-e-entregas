
import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import { FaCheckCircle, FaClock, FaFileAlt, FaPhone, FaUserCircle, FaCalendarAlt, FaMapMarkerAlt, FaInfoCircle, FaBook, FaHeadset } from 'react-icons/fa';

const Home = () => {

  const { user } = useAuth();
  // Mock de dados para exemplo. Substitua por dados reais do backend!
  const [stats, setStats] = useState({
    programadas: 3,
    concluidas: 1,
    pendentes: 2,
  });
  const proximaEntrega = {
    destino: 'Centro de Distribuição XYZ',
    horario: '14:30',
    cidade: 'Manaus',
    cliente: 'Cliente ABC',
    detalhes: 'Entrega de eletrônicos',
  };
  const avisos = [
    'Lembre-se de conferir os documentos antes de sair para a entrega.',
    'Atualize seu perfil caso haja mudança de telefone.',
  ];
  const documentosUteis = [
    { nome: 'Manual do Motorista', link: '#' },
    { nome: 'Política de Segurança', link: '#' },
  ];


  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-10 pb-20">
        {/* Perfil do Motorista */}
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <FaUserCircle className="text-white text-5xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                Olá, <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{user?.fullName || user?.name || 'Motorista'}</span>!
              </h1>
              <div className="flex items-center gap-2 text-gray-600">
                <FaPhone className="text-purple-600" />
                <span>{user?.phone || '(xx) xxxxx-xxxx'}</span>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col sm:items-end items-start gap-2">
            <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">Status: Ativo</span>
          </div>
        </div>

        {/* Resumo do Dia */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
            <FaCalendarAlt className="text-3xl text-purple-600 mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.programadas}</div>
            <div className="text-gray-600 text-sm">Entregas Programadas</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
            <FaCheckCircle className="text-3xl text-green-600 mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.concluidas}</div>
            <div className="text-gray-600 text-sm">Entregas Concluídas</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
            <FaClock className="text-3xl text-yellow-500 mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.pendentes}</div>
            <div className="text-gray-600 text-sm">Pendentes</div>
          </div>
        </div>

        {/* Próxima Entrega */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <FaMapMarkerAlt className="text-purple-600" /> Próxima Entrega
            </h2>
            <div className="text-gray-700 mb-1"><b>Destino:</b> {proximaEntrega.destino} ({proximaEntrega.cidade})</div>
            <div className="text-gray-700 mb-1"><b>Cliente:</b> {proximaEntrega.cliente}</div>
            <div className="text-gray-700 mb-1"><b>Horário:</b> {proximaEntrega.horario}</div>
            <div className="text-gray-700 mb-1"><b>Detalhes:</b> {proximaEntrega.detalhes}</div>
          </div>
          <div className="flex flex-col items-center">
            <button className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow hover:shadow-lg transition">Ver Detalhes</button>
          </div>
        </div>

        {/* Avisos Importantes */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-400 rounded-xl p-6 mb-10">
          <h3 className="text-lg font-bold text-purple-700 mb-2 flex items-center gap-2"><FaInfoCircle /> Avisos Importantes</h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            {avisos.map((aviso, idx) => <li key={idx}>{aviso}</li>)}
          </ul>
        </div>

        {/* Acesso Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <a href="#" className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center hover:border-purple-300 transition">
            <FaBook className="text-3xl text-purple-600 mb-2" />
            <div className="font-bold text-gray-900 mb-1">Documentos Úteis</div>
            <ul className="text-sm text-gray-600">
              {documentosUteis.map((doc, idx) => <li key={idx}><a href={doc.link} className="underline text-purple-700">{doc.nome}</a></li>)}
            </ul>
          </a>
          <a href="#" className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center hover:border-blue-300 transition">
            <FaHeadset className="text-3xl text-blue-600 mb-2" />
            <div className="font-bold text-gray-900 mb-1">Suporte</div>
            <div className="text-sm text-gray-600">Fale com o RH ou suporte técnico</div>
          </a>
        </div>

        {/* Dicas e Informações */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="text-2xl">💡</span> Dicas para melhor experiência
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span className="text-gray-700">Certifique-se de que todos os dados do container estão corretos antes de sair</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span className="text-gray-700">Se algo der errado, você pode tentar novamente sem perder os documentos salvos</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span className="text-gray-700">Use a área de entregas programadas para acompanhar o status de todos os seus registros</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );

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
