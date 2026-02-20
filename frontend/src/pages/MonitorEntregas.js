import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../services/authContext';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { FaArrowLeft, FaEye, FaDownload, FaSync, FaFilter, FaTimes, FaTrash, FaEdit, FaEllipsisV, FaExclamationTriangle } from 'react-icons/fa';
import manaConfig from '../config/cities/manaus.json';
import itajaiConfig from '../config/cities/itajai.json';

const MonitorEntregas = () => {
  const { user } = useAuth();
  // Modal para visualizar fotos do fluxo
  const [modalFotos, setModalFotos] = useState(null);
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [alertInfo, setAlertInfo] = useState(null); // Para tooltip/modal de alerta
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
    recebedor: '',
    status: '',
    dataAgendamento: '',
    horarioChegada: '',
    horarioInicioDesova: '',
    horarioFimDesova: '',
    observations: ''
  });
  
  // Filtros
  const [filters, setFilters] = useState({
    status: 'all',
    searchTerm: '',
    startDate: '',
    endDate: ''
  });

  // Mapeamento dos status amigáveis para os valores do backend
  const statusMapToBackend = {
    OPERACAO_FINALIZADA: ['ENTREGUE', 'submitted'],
    'A CAMINHO DO CLIENTE': ['pending', 'PENDING'],
    AGUARDANDO_DESOVA: ['AGUARDANDO_DESOVA'],
    EM_DESOVA: ['EM_DESOVA'],
    DESOVA_FINALIZADA: ['DESOVA_FINALIZADA'],
    ANEXANDO_DOCUMENTOS_FINAIS: ['ANEXANDO_DOCUMENTOS_FINAIS'],
    CANCELADO: ['CANCELADO']
  };
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
      // Monta filtros para o backend
      let backendFilters = { ...filters };
      if (filters.status && filters.status !== 'all') {
        // Envia o valor original esperado pelo backend
        const backendStatus = statusMapToBackend[filters.status];
        if (backendStatus) {
          // Se for um array, pega o primeiro (ou pode adaptar para enviar múltiplos se backend aceitar)
          backendFilters.status = backendStatus[0];
        }
      }
      // Log para debug: mostrar quais filtros estão sendo enviados
      console.log('🔍 Enviando filtros ao backend:', backendFilters);
      const response = await adminService.getDeliveries(backendFilters);
      const data = response.data.deliveries || [];
      console.log('📥 Resposta do backend:', data.length, 'entregas');
      setDeliveries(data);
      
      // Calcula stats
      const submitted = data.filter(d => d.status === 'ENTREGUE' || d.status === 'submitted').length;
      const pending = data.filter(d => d.status !== 'ENTREGUE' && d.status !== 'submitted' && d.status !== 'CANCELADO').length;
      // Corrige indicador de motoristas: conta motoristas distintos
      const motoristaSet = new Set(data.map(d => d.driverName).filter(Boolean));
      setStats({
        total: data.length,
        submitted,
        pending,
        byDriver: motoristaSet.size
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

    // Filtro de status customizado
    let filtered = result;
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(d => {
        if (filters.status === 'OPERACAO_FINALIZADA') return d.status === 'ENTREGUE' || d.status === 'submitted';
        if (filters.status === 'A CAMINHO DO CLIENTE') return d.status === 'pending' || d.status === 'PENDING';
        return d.status === filters.status;
      });
    }
    setFilteredDeliveries(filtered);
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
      recebedor: delivery.recebedor || '',
      status: delivery.status || '',
      dataAgendamento: delivery.dataAgendamento ? delivery.dataAgendamento.slice(0, 16) : '',
      horarioChegada: delivery.horarioChegada ? delivery.horarioChegada.slice(0, 16) : '',
      horarioInicioDesova: delivery.horarioInicioDesova ? delivery.horarioInicioDesova.slice(0, 16) : '',
      horarioFimDesova: delivery.horarioFimDesova ? delivery.horarioFimDesova.slice(0, 16) : '',
      observations: delivery.observations || ''
    });
  };

  const handleEditSave = async () => {
    if (!editForm.observations || editForm.observations.trim() === '') {
      setToast({ message: 'Motivo da edição é obrigatório', type: 'error' });
      return;
    }

    // Adiciona info do editor
    const editPayload = {
      ...editForm,
      editedBy: user?.name || user?.username || user?.email || 'Desconhecido',
      editedAt: new Date().toISOString()
    };

    console.log('📝 Salvando edição:', { id: editingDelivery, data: editPayload });

    try {
      const response = await adminService.updateDelivery(editingDelivery, editPayload);
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
      OPERACAO_FINALIZADA: 'bg-green-100 text-green-800 border border-green-400 font-bold',
      'A CAMINHO DO CLIENTE': 'bg-yellow-100 text-yellow-800 border border-yellow-400 font-bold',
      AGUARDANDO_DESOVA: 'bg-orange-100 text-orange-800 border border-orange-400 font-bold',
      EM_DESOVA: 'bg-purple-100 text-purple-800 border border-purple-400 font-bold',
      DESOVA_FINALIZADA: 'bg-blue-100 text-blue-800 border border-blue-400 font-bold',
      ANEXANDO_DOCUMENTOS_FINAIS: 'bg-pink-100 text-pink-800 border border-pink-400 font-bold',
      CANCELADO: 'bg-gray-200 text-gray-700 border border-gray-400 font-bold'
    };
    return badges[status] || 'bg-gray-100 text-gray-800 font-bold';
  };

  // Função para exibir status sem underline
  const formatStatus = (status) => {
    if (!status) return '-';
    if (status === 'ENTREGUE' || status === 'submitted') return 'OPERAÇÃO FINALIZADA';
    if (status === 'pending' || status === 'PENDING') return 'A CAMINHO DO CLIENTE';
    return status.replace(/_/g, ' ');
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
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen pb-20">
      <div className="max-w-full mx-auto p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 lg:mb-8">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-purple-700 hover:text-purple-900 font-extrabold text-lg tracking-widest uppercase transition"
          >
            <FaArrowLeft /> VOLTAR
          </button>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-widest uppercase flex items-center gap-3 drop-shadow-sm">
            <span role="img" aria-label="Gráfico">📊</span> TORRE DE CONTROLE
          </h1>
          <button
            onClick={loadDeliveries}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 lg:py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-xl shadow-lg hover:from-purple-600 hover:to-purple-800 disabled:opacity-50 font-bold text-lg transition"
          >
            <FaSync className={loading ? 'animate-spin' : ''} />
            {loading ? 'ATUALIZANDO...' : 'ATUALIZAR'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
          <div className="bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl shadow-lg p-4 lg:p-6 border-l-8 border-blue-600 flex flex-col items-center">
            <p className="text-blue-900 text-xs lg:text-base font-extrabold uppercase tracking-widest mb-1">TOTAL</p>
            <p className="text-2xl lg:text-4xl font-extrabold text-blue-700 drop-shadow">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-r from-green-100 to-green-200 rounded-xl shadow-lg p-4 lg:p-6 border-l-8 border-green-600 flex flex-col items-center">
            <p className="text-green-900 text-xs lg:text-base font-extrabold uppercase tracking-widest mb-1">ENTREGUES</p>
            <p className="text-2xl lg:text-4xl font-extrabold text-green-700 drop-shadow">{stats.submitted}</p>
          </div>
          <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl shadow-lg p-4 lg:p-6 border-l-8 border-yellow-500 flex flex-col items-center">
            <p className="text-yellow-900 text-xs lg:text-base font-extrabold uppercase tracking-widest mb-1">PENDENTE</p>
            <p className="text-2xl lg:text-4xl font-extrabold text-yellow-600 drop-shadow">{stats.pending}</p>
          </div>
          <div className="bg-gradient-to-r from-purple-100 to-purple-200 rounded-xl shadow-lg p-4 lg:p-6 border-l-8 border-purple-600 flex flex-col items-center">
            <p className="text-purple-900 text-xs lg:text-base font-extrabold uppercase tracking-widest mb-1">MOTORISTAS</p>
            <p className="text-2xl lg:text-4xl font-extrabold text-purple-700 drop-shadow">{stats.byDriver}</p>
          </div>
        </div>

        {/* Auto Refresh Control */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
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
        <div className="bg-white rounded-xl shadow-lg mb-8 border border-gray-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              <FaFilter className="text-purple-700 text-xl" />
              <span className="font-extrabold text-gray-900 uppercase tracking-widest">FILTROS</span>
            </div>
            <span className="text-gray-700 font-bold text-lg">{showFilters ? '▼' : '▶'}</span>
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
                  <option value="OPERACAO_FINALIZADA">Operação Finalizada</option>
                  <option value="A CAMINHO DO CLIENTE">A Caminho do Cliente</option>
                  <option value="AGUARDANDO_DESOVA">Aguardando Desova</option>
                  <option value="EM_DESOVA">Em Desova</option>
                  <option value="DESOVA_FINALIZADA">Desova Finalizada</option>
                  <option value="ANEXANDO_DOCUMENTOS_FINAIS">Anexando Documentos Finais</option>
                  <option value="CANCELADO">Cancelado</option>
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
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-purple-100 to-purple-200 border-b-2 border-purple-400 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">Nº</th>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">CONTRATADO</th>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">MOTORISTA</th>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">RECEBEDOR</th>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">STATUS</th>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">AGENDAMENTO</th>
                    <th className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">CHEGADA</th>
                    <th className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">INÍCIO</th>
                    <th className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">FIM</th>
                    <th className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">DOCS</th>
                    <th className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">AÇÕES</th>
                  </tr>
                </thead>
              <tbody>
                {filteredDeliveries.map((delivery, index) => (
                  <tr
                    key={delivery._id}
                    className={`border-b border-gray-200 hover:bg-purple-50 transition ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-2 py-2 font-semibold text-gray-800 whitespace-nowrap">{delivery.deliveryNumber}</td>
                    <td className="px-2 py-2 text-gray-700 truncate">{delivery.userName}</td>
                    <td className="px-2 py-2 text-gray-700 truncate">{delivery.driverName || '-'}</td>
                    <td className="px-2 py-2 text-gray-700 truncate">{delivery.recebedor || '-'}</td>
                    <td className="px-2 py-2">
                      <span className={`px-2 py-1 rounded-full font-bold uppercase tracking-tight text-xs whitespace-nowrap inline-flex items-center justify-center ${getStatusBadge(delivery.status)}`}>
                        {formatStatus(delivery.status)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-gray-600 whitespace-nowrap text-center">
                      {delivery.dataAgendamento ? new Date(delivery.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </td>
                    <td className="px-2 py-2 text-gray-700 whitespace-nowrap text-center">
                      {delivery.horarioChegada ? new Date(delivery.horarioChegada).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                          {/* Modal/Tooltip de alerta */}
                          {alertInfo && (
                            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
                              <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full flex flex-col items-center">
                                <FaExclamationTriangle className="text-yellow-500 text-4xl mb-2" />
                                <p className="text-gray-800 text-center font-semibold mb-4">{alertInfo.message}</p>
                                <button
                                  onClick={() => setAlertInfo(null)}
                                  className="mt-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
                                >
                                  Fechar
                                </button>
                              </div>
                            </div>
                          )}
                    <td className="px-2 py-2 text-gray-700 whitespace-nowrap text-center">{delivery.horarioInicioDesova ? new Date(delivery.horarioInicioDesova).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-2 py-2 text-gray-700 whitespace-nowrap text-center">{delivery.horarioFimDesova ? new Date(delivery.horarioFimDesova).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {Object.keys(delivery.documents || {})
                          .filter(key => delivery.documents[key])
                          .map(docKey => {
                            const labels = getLabelsForDelivery(delivery);
                            return (
                              <span
                                key={docKey}
                                title={labels[docKey] || docKey}
                                className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded"
                              >
                                ✓
                              </span>
                            );
                          })}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
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
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 text-gray-600 transition text-sm"
                            aria-haspopup="true"
                            aria-expanded={openMenuId === delivery._id}
                            title="Ações"
                          >
                            <FaEllipsisV />
                          </button>

                          {openMenuId === delivery._id && (
                            <div className={`${openMenuUp ? 'origin-bottom-right absolute right-0 mb-2 bottom-full' : 'origin-top-right absolute right-0 mt-2'} w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50`}>
                              <div className="py-1 text-xs">
                                <button
                                  onClick={() => { setSelectedDelivery(delivery); setOpenMenuId(null); }}
                                  className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <FaEye className="text-xs" /> Visualizar
                                </button>
                                <button
                                  onClick={() => { handleEditStart(delivery); setOpenMenuId(null); }}
                                  className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  title="Editar entrega"
                                >
                                  <FaEdit className="text-xs" /> Editar
                                </button>
                                <button
                                  onClick={() => { handleDelete(delivery._id); setOpenMenuId(null); }}
                                  className="w-full text-left px-3 py-2 text-red-600 hover:bg-gray-50 flex items-center gap-2"
                                  title="Deletar entrega"
                                >
                                  <FaTrash className="text-xs" /> Deletar
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
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-purple-700 to-purple-500 text-white p-4 flex items-center justify-between rounded-t-lg">
              <h2 className="text-2xl font-bold tracking-widest">
                Entrega <span className="text-yellow-200">#{selectedDelivery.deliveryNumber}</span>
              </h2>
              <button
                onClick={() => setSelectedDelivery(null)}
                className="text-2xl hover:text-gray-200 transition"
                title="Fechar"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Contratado</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedDelivery.userName}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Motorista</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedDelivery.driverName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusBadge(selectedDelivery.status)}`}>{formatStatus(selectedDelivery.status)}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Agendamento</p>
                  <p className="text-base text-gray-700">{selectedDelivery.dataAgendamento ? new Date(selectedDelivery.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Chegada</p>
                  <p className="text-base text-gray-700">{selectedDelivery.horarioChegada ? new Date(selectedDelivery.horarioChegada).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Início Desova</p>
                  <p className="text-base text-gray-700">{selectedDelivery.horarioInicioDesova ? new Date(selectedDelivery.horarioInicioDesova).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Fim Desova</p>
                  <p className="text-base text-gray-700">{selectedDelivery.horarioFimDesova ? new Date(selectedDelivery.horarioFimDesova).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                </div>
              </div>

              {selectedDelivery.observations && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-sm">
                  <p className="text-xs font-bold text-yellow-800 uppercase mb-1">Observação</p>
                  <p className="text-gray-800 text-base">{selectedDelivery.observations}</p>
                </div>
              )}

              {/* Documentos e Fotos do Fluxo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Documentos e Fotos do Fluxo</p>
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
                    // Documentos normais (sem duplicar campos de fotos)
                    const docRows = Object.keys(selectedDelivery.documents || {})
                      .filter(docKey => !['chegadaCliente', 'inicioDesova', 'fimDesova'].includes(docKey))
                      .map(docKey => (
                        <div key={docKey}>
                          {selectedDelivery.documents[docKey] ? (
                            <div className="bg-gray-50 p-3 rounded flex items-center justify-between">
                              <span className="font-semibold text-gray-800">{labels[docKey] || docKey}</span>
                              <button
                                onClick={() => handleDownload(selectedDelivery._id, docKey)}
                                className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition"
                              >
                                <FaDownload /> Baixar
                              </button>
                            </div>
                          ) : (
                            <div className="bg-gray-100 p-3 rounded text-gray-500 text-sm">{labels[docKey] || docKey} - Não anexado</div>
                          )}
                        </div>
                      ));
                    // Fotos do fluxo: chegada, início, fim desova (sem duplicar)
                    const fotosCampos = [
                      { key: 'chegadaCliente', label: 'Chegada no Cliente' },
                      { key: 'inicioDesova', label: 'Início da Desova' },
                      { key: 'fimDesova', label: 'Finalização da Desova' }
                    ];
                    const fotosRows = fotosCampos.map((f, idx) => {
                      const files = Array.isArray(selectedDelivery.documents?.[f.key]) ? selectedDelivery.documents[f.key] : [];
                      return files.length > 0 ? (
                        <div key={f.label + idx} className="bg-gray-50 p-3 rounded flex items-center justify-between">
                          <span className="font-semibold text-gray-800">{f.label}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setModalFotos({ label: f.label, files })}
                              className="flex items-center gap-2 px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 transition"
                            >
                              Visualizar Fotos
                            </button>
                            <button
                              onClick={() => {
                                files.forEach((url, i) => {
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.setAttribute('download', `${f.label.replace(/\s+/g, '_')}_${i+1}.jpg`);
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                });
                              }}
                              className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition"
                            >
                              <FaDownload /> Baixar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={f.label + idx} className="bg-gray-100 p-3 rounded text-gray-500 text-sm">{f.label} - Não anexado</div>
                      );
                    });
                    return [
                      ...docRows,
                      ...fotosRows
                    ];
                  })()}
                </div>
              </div>
      {/* Modal para visualizar fotos do fluxo */}
      {modalFotos && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{modalFotos.label}</h2>
              <button onClick={() => setModalFotos(null)} className="text-2xl hover:text-gray-400 transition"><FaTimes /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {modalFotos.files.map((url, idx) => (
                <img key={idx} src={url} alt={`Foto ${idx + 1}`} className="w-full h-40 object-cover rounded shadow" />
              ))}
            </div>
          </div>
        </div>
      )}

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
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Editar Entrega</h2>
              <button
                onClick={() => setEditingDelivery(null)}
                className="text-2xl hover:text-gray-200 transition"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Número do Container</label>
                <input type="text" value={editForm.deliveryNumber} onChange={e => setEditForm({ ...editForm, deliveryNumber: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ex: CGMU5575947" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Contratado</label>
                <input type="text" value={editForm.userName} onChange={e => setEditForm({ ...editForm, userName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ex: Josinei vieira" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Motorista</label>
                <input type="text" value={editForm.driverName} onChange={e => setEditForm({ ...editForm, driverName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ex: ALAN" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Placa do Veículo</label>
                <input type="text" value={editForm.vehiclePlate} onChange={e => setEditForm({ ...editForm, vehiclePlate: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ex: ABC1D23" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Recebedor</label>
                <input type="text" value={editForm.recebedor} onChange={e => setEditForm({ ...editForm, recebedor: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Nome do recebedor" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">Selecione...</option>
                  <option value="ENTREGUE">Operação Finalizada</option>
                  <option value="pending">A Caminho do Cliente</option>
                  <option value="AGUARDANDO_DESOVA">Aguardando Desova</option>
                  <option value="EM_DESOVA">Em Desova</option>
                  <option value="DESOVA_FINALIZADA">Desova Finalizada</option>
                  <option value="ANEXANDO_DOCUMENTOS_FINAIS">Anexando Documentos Finais</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Data Agendamento</label>
                <input type="datetime-local" value={editForm.dataAgendamento} onChange={e => setEditForm({ ...editForm, dataAgendamento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Horário Chegada</label>
                <input type="datetime-local" value={editForm.horarioChegada} onChange={e => setEditForm({ ...editForm, horarioChegada: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Início Desova</label>
                <input type="datetime-local" value={editForm.horarioInicioDesova} onChange={e => setEditForm({ ...editForm, horarioInicioDesova: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Fim Desova</label>
                <input type="datetime-local" value={editForm.horarioFimDesova} onChange={e => setEditForm({ ...editForm, horarioFimDesova: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo da Edição *</label>
                <textarea value={editForm.observations} onChange={e => setEditForm({ ...editForm, observations: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Explique por que está editando (obrigatório)" rows="2" required />
              </div>
              <div className="flex gap-2">
                <button onClick={handleEditSave} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold">Salvar</button>
                <button onClick={() => setEditingDelivery(null)} className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitorEntregas;
