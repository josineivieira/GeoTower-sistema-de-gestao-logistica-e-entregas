import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { useAuth } from '../services/authContext';
import {
  FaArrowLeft,
  FaPlus,
  FaTruck,
  FaBox,
  FaMapMarkerAlt,
  FaClock,
  FaCheckCircle,
  FaFileAlt,
  FaUndo,
  FaShippingFast,
  FaSync
} from 'react-icons/fa';

/* ─── Status Columns Configuration ────────────────────────────────────── */
const STATUS_COLUMNS = [
  {
    key: 'NOVO_PROCESSO',
    title: 'Novo Processo',
    description: 'Processos sem motorista',
    icon: <FaPlus className="text-blue-400" />,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    filter: (p) => !p.motorista || p.motorista === '-' || p.motorista.trim() === ''
  },
  {
    key: 'PROGRAMADO',
    title: 'Processo Programado',
    description: 'Agendados com motorista',
    icon: <FaClock className="text-purple-400" />,
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    filter: (p) => p.status === 'AGENDADO' && p.motorista && p.motorista !== '-'
  },
  {
    key: 'CNTR_COLETADO',
    title: 'CNTR Coletado',
    description: 'Container montado',
    icon: <FaBox className="text-green-400" />,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    filter: (p) => p.status === 'CONTAINER_MONTADO'
  },
  {
    key: 'INICIAR_VIAGEM',
    title: 'Iniciar Viagem',
    description: 'A caminho do cliente',
    icon: <FaTruck className="text-orange-400" />,
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-800',
    filter: (p) => p.status === 'A_CAMINHO_DO_CLIENTE'
  },
  {
    key: 'CHEGADA_CLIENTE',
    title: 'Chegada ao Cliente',
    description: 'Aguardando desova',
    icon: <FaMapMarkerAlt className="text-yellow-400" />,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    filter: (p) => p.status === 'AGUARDANDO_DESOVA'
  },
  {
    key: 'OPERACAO_INICIADA',
    title: 'Operação Iniciada',
    description: 'Em desova',
    icon: <FaShippingFast className="text-red-400" />,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    filter: (p) => p.status === 'EM_DESOVA'
  },
  {
    key: 'OPERACAO_FINALIZADA',
    title: 'Operação Finalizada',
    description: 'Desova concluída',
    icon: <FaCheckCircle className="text-emerald-400" />,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-800',
    filter: (p) => p.status === 'FINALIZADO' || p.status === 'ENTREGUE'
  },
  {
    key: 'ANEXANDO_DOCUMENTOS',
    title: 'Anexando Documentos',
    description: 'Documentos finais',
    icon: <FaFileAlt className="text-indigo-400" />,
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-800',
    filter: (p) => p.status === 'ANEXANDO_DOCUMENTOS_FINAIS'
  },
  {
    key: 'VIAGEM_RETORNO',
    title: 'Viagem Retorno',
    description: 'Em rota de retorno',
    icon: <FaUndo className="text-cyan-400" />,
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    textColor: 'text-cyan-800',
    filter: (p) => p.status === 'EM_ROTA'
  },
  {
    key: 'CNTR_ENTREGUE',
    title: 'CNTR Entregue',
    description: 'Container devolvido',
    icon: <FaCheckCircle className="text-teal-400" />,
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-800',
    filter: (p) => p.status === 'ENTREGUE'
  }
];

/* ─── Main Component ─────────────────────────────────────────────────── */
const MonitorProcessos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [programacoes, setProgramacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (!['manager', 'admin', 'geomar'].includes(user.role)) {
      navigate('/home');
      return;
    }
    loadProgramacoes();
  }, [user, navigate]);

  const loadProgramacoes = async () => {
    try {
      setLoading(true);
      const response = await adminService.getProgramacoes();
      console.log('Response:', response);
      const programacoesData = response?.data?.programacoes || response?.data || [];
      console.log('Programacoes data:', programacoesData, 'isArray:', Array.isArray(programacoesData));
      if (Array.isArray(programacoesData)) {
        setProgramacoes(programacoesData);
      } else {
        console.error('Programacoes is not an array:', programacoesData);
        setProgramacoes([]);
        setToast({
          message: 'Erro: dados inválidos da API',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error loading programacoes:', error);
      setToast({
        message: 'Erro ao carregar programações: ' + (error.message || 'Erro desconhecido'),
        type: 'error'
      });
      setProgramacoes([]);
    } finally {
      setLoading(false);
    }
  };

  const getProcessesByStatus = (filterFn) => {
    if (!Array.isArray(programacoes)) {
      console.error('programacoes is not an array:', programacoes);
      return [];
    }
    if (typeof filterFn !== 'function') {
      console.error('filterFn is not a function:', filterFn);
      return [];
    }
    return programacoes.filter(filterFn);
  };

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSync className="animate-spin text-4xl text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">
            {!user ? 'Verificando permissões...' : 'Carregando processos...'}
          </p>
        </div>
      </div>
    );
  }

  if (!['manager', 'admin', 'geomar'].includes(user.role)) {
    navigate('/home');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Toast toast={toast} setToast={setToast} />

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Monitor de Processos
            </h1>
            <p className="text-gray-600 mt-2">
              Acompanhe o status dos processos de entrega
            </p>
          </div>
          <button
            onClick={loadProgramacoes}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <FaSync className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FaSync className="animate-spin text-4xl text-blue-500" />
            <span className="ml-4 text-lg text-gray-600">Carregando processos...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {STATUS_COLUMNS.map(column => {
              const processes = getProcessesByStatus(column.filter);
              return (
                <div key={column.key} className={`bg-white rounded-lg border ${column.borderColor} shadow-sm overflow-hidden`}>
                  <div className={`${column.bgColor} p-4 border-b ${column.borderColor}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          {column.icon}
                        </div>
                        <div>
                          <h3 className={`font-semibold ${column.textColor}`}>
                            {column.title}
                          </h3>
                          <p className="text-xs text-gray-600">
                            {column.description}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${column.bgColor} ${column.textColor} border ${column.borderColor}`}>
                        {processes.length}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 max-h-80 overflow-y-auto">
                    {processes.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <div className="text-3xl mb-2 opacity-50">{column.icon}</div>
                        <p className="text-sm">Nenhum processo</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {processes.slice(0, 3).map(process => (
                          <div key={process._id || process.processo} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-start justify-between mb-2">
                              <div className="font-medium text-gray-900 text-sm truncate">
                                {process.processo || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500 ml-2">
                                {process.container || 'N/A'}
                              </div>
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              <div><strong>Recebedor:</strong> {process.recebedor || 'N/A'}</div>
                              <div><strong>Contratado:</strong> {process.contratado || 'N/A'}</div>
                              {process.motorista && process.motorista !== '-' && (
                                <div><strong>Motorista:</strong> {process.motorista}</div>
                              )}
                            </div>
                          </div>
                        ))}
                        {processes.length > 3 && (
                          <div className="text-center text-xs text-gray-500 py-2 border-t">
                            +{processes.length - 3} mais...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          Total de processos: {programacoes.length}
        </div>
      </div>
    </div>
  );
};

export default MonitorProcessos;