import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { FaArrowLeft, FaEye, FaDownload, FaSync, FaFilter, FaTimes, FaTrash, FaEdit, FaEllipsisV } from 'react-icons/fa';
import manaConfig from '../config/cities/manaus.json';
import itajaiConfig from '../config/cities/itajai.json';

const MonitorEntregas = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openMenuUp, setOpenMenuUp] = useState(false);
  const menuRef = useRef(null);
  const [sortBy, setSortBy] = useState(null); // e.g. 'deliveryNumber' or 'createdAt'
  const [sortDir, setSortDir] = useState('asc');
  const [editForm, setEditForm] = useState({
    deliveryNumber: '',
    userName: '',
    driverName: '',
    vehiclePlate: '',
    observations: ''
  });
  
  // Filtros
  const [filters, setFilters] = useState({
    status: 'all',
    searchTerm: '',
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Stats rápidas
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    pending: 0,
    byDriver: []
  });

  // Carrega entregas
  const loadDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      // Log para debug: mostrar quais filtros estão sendo enviados
      console.log('🔍 Enviando filtros ao backend:', filters);
      const response = await adminService.getDeliveries(filters);
      const data = response.data.deliveries || [];
      console.log('📥 Resposta do backend:', data.length, 'entregas');
      setDeliveries(data);
      
      // Calcula stats
      const submitted = data.filter(d => d.status === 'submitted').length;
      const pending = data.filter(d => d.status === 'pending').length;
      setStats({
        total: data.length,
        submitted,
        pending,
        byDriver: [...new Set(data.map(d => d.userName))].length
      });

      setToast({ message: `Carregadas ${data.length} entregas`, type: 'success' });
    } catch (error) {
      console.error('Erro ao carregar:', error);
      setToast({ message: 'Erro ao carregar entregas', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Auto refresh
  useEffect(() => {
    loadDeliveries();
    
    if (autoRefresh) {
      const interval = setInterval(loadDeliveries, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [loadDeliveries, autoRefresh, refreshInterval]);

  // Aplica filtros locais + ordenação
  useEffect(() => {
    let result = [...deliveries];

    // Client-side sorting
    if (sortBy) {
      result.sort((a, b) => {
        const va = a[sortBy];
        const vb = b[sortBy];
        if (sortBy === 'createdAt') {
          const da = new Date(va);
          const db = new Date(vb);
          return sortDir === 'asc' ? da - db : db - da;
        }
        // string fallback
        const sa = String(va || '').toLowerCase();
        const sb = String(vb || '').toLowerCase();
        if (sa < sb) return sortDir === 'asc' ? -1 : 1;
        if (sa > sb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredDeliveries(result);
  }, [deliveries, filters, sortBy, sortDir]);

  // Fecha dropdown de ações ao clicar fora
  useEffect(() => {
    const handleDocClick = (e) => {
      if (openMenuId && menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [openMenuId]);

  const handleDownload = async (deliveryId, documentType) => {
    try {
      const response = await adminService.downloadDocument(deliveryId, documentType);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'image/jpeg' }));
      const link = document.createElement('a');
      link.href = url;
      const delivery = deliveries.find(d => d._id === deliveryId);
      link.setAttribute('download', `${delivery?.deliveryNumber || 'doc'}_${documentType}.jpg`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setToast({ message: 'Documento baixado com sucesso', type: 'success' });
    } catch (error) {
      console.error('Erro ao baixar:', error);
      setToast({ message: 'Erro ao baixar arquivo: ' + (error.response?.data?.message || error.message), type: 'error' });
    }
  };

  const handleDownloadAll = async (deliveryId) => {
    try {
      const response = await adminService.downloadAllDocuments(deliveryId);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      const delivery = deliveries.find(d => d._id === deliveryId);
      link.setAttribute('download', `${delivery?.deliveryNumber || 'documents'}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setToast({ message: 'ZIP baixado com sucesso', type: 'success' });
    } catch (error) {
      console.error('Erro ao baixar ZIP:', error);
      setToast({ message: 'Erro ao baixar ZIP: ' + (error.response?.data?.message || error.message), type: 'error' });
    }
  };

  const handleDelete = async (deliveryId) => {
    if (window.confirm('Tem certeza que deseja deletar esta entrega? Esta ação não pode ser desfeita.')) {
      try {
        await adminService.deleteDelivery(deliveryId);
        setToast({ message: 'Entrega deletada com sucesso', type: 'success' });
        setSelectedDelivery(null);
        loadDeliveries(); // Recarrega a tabela
      } catch (error) {
        setToast({ message: 'Erro ao deletar entrega', type: 'error' });
      }
    }
  };

  const handleEditStart = (delivery) => {
    setEditingDelivery(delivery._id);
    setEditForm({
      deliveryNumber: delivery.deliveryNumber || '',
      userName: delivery.userName || '',
      driverName: delivery.driverName || '',
      vehiclePlate: delivery.vehiclePlate || '',
      observations: delivery.observations || ''
    });
  };

  const handleEditSave = async () => {
    if (!editForm.observations || editForm.observations.trim() === '') {
      setToast({ message: 'Motivo da edição é obrigatório', type: 'error' });
      return;
    }

    console.log('📝 Salvando edição:', { id: editingDelivery, data: editForm });

    try {
      const response = await adminService.updateDelivery(editingDelivery, editForm);
      console.log('✅ Resposta do servidor:', response);
      setToast({ message: 'Entrega atualizada com sucesso', type: 'success' });
      setEditingDelivery(null);
      loadDeliveries();
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
      setToast({ message: 'Erro ao atualizar entrega: ' + (error.response?.data?.message || error.message), type: 'error' });
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      submitted: 'bg-green-100 text-green-800 border border-green-300',
      pending: 'bg-yellow-100 text-yellow-800 border border-yellow-300'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  // Default labels for Manaus; we will pick per-delivery labels when showing modal
  const defaultDocumentLabels = manaConfig.documents || {
    canhotNF: '📄 NF',
    canhotCTE: '📦 CTE',
    diarioBordo: '📓 Diário',
    devolucaoVazio: '🚛 Vazio',
    retiradaCheio: '🚚 Cheio'
  };

  const getLabelsForDelivery = (delivery) => {
    if (!delivery) return defaultDocumentLabels;
    const city = (delivery.city || '').toLowerCase();
    if (city === 'itajai') return itajaiConfig.documents || {};
    return defaultDocumentLabels;
  };

  // Later, when rendering, use const labels = getLabelsForDelivery(selectedDelivery) and use labels[docKey] || docKey


  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-semibold transition"
          >
            <FaArrowLeft /> Voltar
          </button>
          <h1 className="text-3xl font-bold text-gray-800">📊 Monitor de Entregas</h1>
          <button
            onClick={loadDeliveries}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
          >
            <FaSync className={loading ? 'animate-spin' : ''} />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-semibold">Total</p>
            <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-semibold">Entregues</p>
            <p className="text-3xl font-bold text-green-600">{stats.submitted}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
            <p className="text-gray-600 text-sm font-semibold">Pendente</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm font-semibold">Motoristas</p>
            <p className="text-3xl font-bold text-purple-600">{stats.byDriver}</p>
          </div>
        </div>

        {/* Auto Refresh Control */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-gray-700 font-semibold">Auto Atualizar</span>
            </label>
            
            {autoRefresh && (
              <div className="flex items-center gap-2">
                <label className="text-gray-600 text-sm">A cada</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  step="5"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="w-16 px-2 py-1 border border-gray-300 rounded"
                />
                <span className="text-gray-600 text-sm">segundos</span>
              </div>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              <FaFilter className="text-purple-600" />
              <span className="font-semibold text-gray-800">Filtros</span>
            </div>
            <span className="text-gray-500">{showFilters ? '▼' : '▶'}</span>
          </button>

          {showFilters && (
            <div className="border-t border-gray-200 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Todos</option>
                  <option value="submitted">Entregues</option>
                  <option value="pending">Pendente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Buscar
                </label>
                <input
                  type="text"
                  placeholder="Número, motorista, placa..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data Final
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tabela de Entregas */}
        {filteredDeliveries.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 text-lg">Nenhuma entrega encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow-md">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Número</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Contratado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Motorista</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Recebedor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data Agendamento</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Chegada Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Início Desova</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fim Desova</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Documentos</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map((delivery, index) => (
                  <tr
                    key={delivery._id}
                    className={`border-b border-gray-200 hover:bg-gray-50 transition ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-800">{delivery.deliveryNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{delivery.userName}</td>
                    <td className="px-4 py-3 text-gray-700">{delivery.driverName || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{delivery.recebedor || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(delivery.status)}`}>
                        {delivery.status || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{delivery.dataAgendamento ? new Date(delivery.dataAgendamento).toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{delivery.horarioChegada ? new Date(delivery.horarioChegada).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{delivery.horarioInicioDesova ? new Date(delivery.horarioInicioDesova).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{delivery.horarioFimDesova ? new Date(delivery.horarioFimDesova).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {Object.keys(delivery.documents || {})
                          .filter(key => delivery.documents[key])
                          .map(docKey => {
                            const labels = getLabelsForDelivery(delivery);
                            return (
                              <span
                                key={docKey}
                                title={labels[docKey] || docKey}
                                className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                              >
                                ✓
                              </span>
                            );
                          })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <div className="relative inline-block text-left" ref={openMenuId === delivery._id ? menuRef : null}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const btnRect = e.currentTarget.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - btnRect.bottom;
                              const openUp = spaceBelow < 180; // arbitrary threshold
                              setOpenMenuUp(openUp);
                              setOpenMenuId(openMenuId === delivery._id ? null : delivery._id);
                            }}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 text-gray-700 transition"
                            aria-haspopup="true"
                            aria-expanded={openMenuId === delivery._id}
                            title="Ações"
                          >
                            <FaEllipsisV />
                          </button>

                          {openMenuId === delivery._id && (
                            <div className={`${openMenuUp ? 'origin-bottom-right absolute right-0 mb-2 bottom-full' : 'origin-top-right absolute right-0 mt-2'} w-44 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50`}>
                              <div className="py-1">
                                <button
                                  onClick={() => { setSelectedDelivery(delivery); setOpenMenuId(null); }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <FaEye /> Visualizar
                                </button>
                                <button
                                  onClick={() => { handleEditStart(delivery); setOpenMenuId(null); }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  title="Editar entrega"
                                >
                                  <FaEdit /> Editar
                                </button>
                                <button
                                  onClick={() => { handleDelete(delivery._id); setOpenMenuId(null); }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2"
                                  title="Deletar entrega"
                                >
                                  <FaTrash /> Deletar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>

      {/* Modal Detalhes */}
      {selectedDelivery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-800 text-white p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Entrega #{selectedDelivery.deliveryNumber}
              </h2>
              <button
                onClick={() => setSelectedDelivery(null)}
                className="text-2xl hover:text-gray-200 transition"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Contratado</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {selectedDelivery.userName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Nome do Motorista</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {selectedDelivery.driverName || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Email</p>
                  <p className="text-sm text-gray-700">{selectedDelivery.userEmail}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(
                      selectedDelivery.status
                    )}`}
                  >
                    {selectedDelivery.status === 'submitted' ? '✓ Entregue' : '⏳ Pendente'}
                  </span>
                </div>
              </div>

              {selectedDelivery.observations && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Observações
                  </p>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded">
                    {selectedDelivery.observations}
                  </p>
                </div>
              )}

              {/* Documentos */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
                    Documentos Anexados
                  </p>
                  <button
                    onClick={() => handleDownloadAll(selectedDelivery._id)}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition"
                  >
                    <FaDownload /> Baixar pasta (ZIP)
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    const labels = getLabelsForDelivery(selectedDelivery);
                    return Object.keys(selectedDelivery.documents || {}).map(docKey => (
                      <div key={docKey}>
                        {selectedDelivery.documents[docKey] ? (
                          <div className="bg-gray-50 p-3 rounded flex items-center justify-between">
                            <span className="font-semibold text-gray-800">
                              {labels[docKey] || docKey}
                            </span>
                            <button
                              onClick={() =>
                                handleDownload(selectedDelivery._id, docKey)
                              }
                              className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition"
                            >
                              <FaDownload /> Baixar
                            </button>
                          </div>
                        ) : (
                          <div className="bg-gray-100 p-3 rounded text-gray-500 text-sm">
                            {labels[docKey] || docKey} - Não anexado
                          </div>
                        )}
                      </div>
                    ));
                  })()} 
                </div>
              </div>

              {selectedDelivery.submissionObservation && (
                <div className="bg-yellow-50 border-l-4 border-yellow-300 p-3 rounded mb-3">
                  <p className="text-sm font-semibold text-yellow-800">Observação de Envio{selectedDelivery.submissionForce ? ' (Envio Forçado)' : ''}</p>
                  <p className="text-sm text-yellow-700">{selectedDelivery.submissionObservation}</p>
                </div>
              )}

              <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                <p>
                  Criado em:{' '}
                  {new Date(selectedDelivery.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editingDelivery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Editar Entrega</h2>
              <button
                onClick={() => setEditingDelivery(null)}
                className="text-2xl hover:text-gray-200 transition"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Número do Container
                </label>
                <input
                  type="text"
                  value={editForm.deliveryNumber}
                  onChange={(e) => setEditForm({ ...editForm, deliveryNumber: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: CGMU5575947"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contratado
                </label>
                <input
                  type="text"
                  value={editForm.userName}
                  onChange={(e) => setEditForm({ ...editForm, userName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: Josinei vieira"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome do Motorista
                </label>
                <input
                  type="text"
                  value={editForm.driverName}
                  onChange={(e) => setEditForm({ ...editForm, driverName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: ALAN"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Motivo da Edição *
                </label>
                <textarea
                  value={editForm.observations}
                  onChange={(e) => setEditForm({ ...editForm, observations: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Explique por que está editando (obrigatório)"
                  rows="2"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleEditSave}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingDelivery(null)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitorEntregas;
