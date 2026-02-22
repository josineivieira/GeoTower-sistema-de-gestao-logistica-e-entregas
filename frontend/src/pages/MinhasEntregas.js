import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { deliveryService } from '../services/authService';
import { FaArrowLeft, FaEye, FaTrash, FaPlus } from 'react-icons/fa';

const MinhasEntregas = () => {
  const navigate = useNavigate();
  const [allProgramacoes, setAllProgramacoes] = useState([]);
  const [displayedProgramacoes, setDisplayedProgramacoes] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // Load programações on mount
  useEffect(() => {
    loadProgramacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter programações when filter or search changes
  useEffect(() => {
    filterProgramacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debouncedSearch, allProgramacoes]);

  const loadProgramacoes = async () => {
    setLoading(true);
    try {
      const response = await deliveryService.getProgramacoesAssigned();
      const todas = response.data.programacoes || [];
      setAllProgramacoes(todas);
    } catch (error) {
      setToast({ message: 'Erro ao carregar entregas programadas', type: 'error' });
      setAllProgramacoes([]);
    } finally {
      setLoading(false);
    }
  };

  const filterProgramacoes = () => {
    let filtered = allProgramacoes;

    // Filter by status
    if (filter === 'pendentes') {
      // Pendentes: não ENTREGUE e não CANCELADO
      filtered = filtered.filter(
        p => !['ENTREGUE', 'CANCELADO'].includes(String(p.status || '').toUpperCase())
      );
    } else if (filter === 'enviadas') {
      // Enviadas: ENTREGUE ou CANCELADO
      filtered = filtered.filter(
        p => ['ENTREGUE', 'CANCELADO'].includes(String(p.status || '').toUpperCase())
      );
    }

    // Filter by search term (processo, container, recebedor, motorista)
    if (debouncedSearch && debouncedSearch.trim() !== '') {
      const term = debouncedSearch.trim().toUpperCase();
      filtered = filtered.filter(p =>
        String(p.processo || '').toUpperCase().includes(term) ||
        String(p.container || '').toUpperCase().includes(term) ||
        String(p.recebedor || '').toUpperCase().includes(term) ||
        String(p.motorista || '').toUpperCase().includes(term)
      );
    }

    setDisplayedProgramacoes(filtered);
  };

  const handleDelete = async (id) => {
    // MinhasEntregas agora usa ProgramacaoEntrega, não Delivery
    // Desabilitar delete para now (programações não devem ser deletadas pela driver)
    setToast({ message: 'Ação não disponível para programações', type: 'info' });
  };

  return (
    // ✅ sem min-h-screen e sem Header: AppLayout já cuida disso
    <div className="bg-gray-100">
      <div className="max-w-6xl mx-auto p-4 pb-20">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-semibold mb-6 transition"
        >
          <FaArrowLeft />
          Voltar
        </button>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Minhas Entregas</h2>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex gap-2">
              {[
                { label: 'Todas', value: 'all' },
                { label: 'Pendentes', value: 'pendentes' },
                { label: 'Enviadas', value: 'enviadas' }
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    filter === f.value
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="ml-auto w-full sm:w-64">
              <input
                type="text"
                placeholder="Pesquisar por processo, container, recebedor ou motorista"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Entregas List */}
        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto" />
          </div>
        ) : displayedProgramacoes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 text-lg mb-4">Nenhuma entrega encontrada</p>
            <button
              onClick={() => loadProgramacoes()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-2 px-6 rounded-lg transition shadow-md"
            >
              Recarregar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedProgramacoes.map((prog) => (
              <div
                key={prog._id}
                className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                      Processo: {prog.processo}
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-gray-500">Data Agendamento</p>
                        <p className="font-medium">
                          {new Date(prog.dataAgendamento).toLocaleString('pt-BR')}
                        </p>
                      </div>

                      {prog.container && (
                        <div>
                          <p className="text-gray-500">Container</p>
                          <p className="font-medium">{prog.container}</p>
                        </div>
                      )}

                      {prog.motorista && prog.motorista !== '-' && (
                        <div>
                          <p className="text-gray-500">Motorista</p>
                          <p className="font-medium">{prog.motorista}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-gray-500">Status</p>
                        <p
                          className={`font-medium ${
                            prog.status === 'ENTREGUE'
                              ? 'text-green-600'
                              : prog.status === 'CANCELADO'
                              ? 'text-red-600'
                              : 'text-orange-600'
                          }`}
                        >
                          {prog.status || 'AGENDADO'}
                        </p>
                      </div>

                      {prog.recebedor && (
                        <div>
                          <p className="text-gray-500">Recebedor</p>
                          <p className="font-medium text-xs">{prog.recebedor}</p>
                        </div>
                      )}

                      {prog.contratado && (
                        <div>
                          <p className="text-gray-500">Contratado</p>
                          <p className="font-medium">{prog.contratado}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => navigate(`/programacoes`)}
                      className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition"
                      title="Ver Programações"
                    >
                      <FaEye />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default MinhasEntregas;
