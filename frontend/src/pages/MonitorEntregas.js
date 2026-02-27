import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { FaArrowLeft, FaEye, FaDownload, FaSync, FaFilter, FaTimes, FaTrash, FaEdit, FaExclamationTriangle, FaShareAlt, FaCalendarAlt, FaClock, FaBox, FaTruck, FaCheckCircle, FaTimesCircle, FaFilePdf, FaUsers, FaDolly } from 'react-icons/fa';
import manaConfig from '../config/cities/manaus.json';
import itajaiConfig from '../config/cities/itajai.json';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const MonitorEntregas = () => {
  const { user } = useAuth();
  
  // Funções para verificar permissões
  const isGeoMar = () => user?.role === 'geomar';
  
  const canEdit = () => {
    return !isGeoMar();
  };
  
  // Modal para visualizar fotos do fluxo
  const [viewingDocument, setViewingDocument] = useState(null); // Para visualizar documento
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
    OPERACAO_FINALIZADA: ['ENTREGUE', 'submitted', 'ENTREGUE_COM_PENDENCIA_CANHOTO'],
    'A CAMINHO DO CLIENTE': ['pending', 'PENDING'],
    AGUARDANDO_DESOVA: ['AGUARDANDO_DESOVA'],
    EM_DESOVA: ['EM_DESOVA'],
    DESOVA_FINALIZADA: ['DESOVA_FINALIZADA'],
    ANEXANDO_DOCUMENTOS_FINAIS: ['ANEXANDO_DOCUMENTOS_FINAIS'],
    AGENDADO: ['AGENDADO'],
    CANCELADO: ['CANCELADO']
  };
  const [showFilters, setShowFilters] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for live timer
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Period filter for stats
  const [statsPeriod, setStatsPeriod] = useState('today'); // 'today', 'yesterday', 'tomorrow'

  // Calcular tempo decorrido no cliente (chegada até agora ou até fim desova)
  const calculateCliTime = (delivery, now = new Date()) => {
    if (!delivery.horarioChegada) return { tempo: null, isActive: false };
    const chegada = new Date(delivery.horarioChegada);
    
    // Se já finalizou (tem data de fim desova), usa aquela e marca como inativo
    // Senão, usa tempo atual (contador live) e marca como ativo
    const isActive = !delivery.horarioFimDesova;
    const referencia = isActive ? now : new Date(delivery.horarioFimDesova);
    const diffMs = referencia - chegada;
    if (diffMs < 0) return { tempo: null, isActive };
    const totalMinutos = Math.floor(diffMs / 60000);
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    let tempo;
    if (horas > 0) tempo = `${horas}h ${minutos}m`;
    else tempo = `${minutos}m`;
    return { tempo, isActive };
  };

  // Gera um histórico ordenado das principais etapas do fluxo
  const getFlowHistory = (delivery) => {
    const events = [];
    if (delivery.containerMontadoAt) {
      events.push({
        label: 'Montagem do container finalizada',
        date: delivery.containerMontadoAt
      });
    }
    if (delivery.horarioChegada) {
      events.push({
        label: 'Chegada',
        date: delivery.horarioChegada
      });
    }
    if (delivery.horarioInicioDesova) {
      events.push({
        label: 'Início da desova',
        date: delivery.horarioInicioDesova
      });
    }
    if (delivery.horarioFimDesova) {
      events.push({
        label: 'Fim da desova',
        date: delivery.horarioFimDesova
      });
    }
    // ordena cronologicamente
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    return events;
  };

  // Stats rápidas
  // total = número de programações retornadas (agendadas)
  // statusCounts = mapa de cada status para sua contagem
  // byDriver = quantidade de motoristas distintos
  const [stats, setStats] = useState({
    total: 0,
    statusCounts: {},
    byDriver: 0
  });

  // Quando existe uma entrega selecionada, fornece o histórico de etapas para renderizar
  const flowHistory = selectedDelivery ? getFlowHistory(selectedDelivery) : [];

  // Semantic color map for dashboard visibility - Elegant & Subtle Professional Palette
  const cardColors = {
    // All cards using uniform gray gradient
    PROGRAMADAS: 'from-slate-300 to-slate-500 text-white border-slate-600',
    AGENDADO: 'from-slate-300 to-slate-500 text-white border-slate-600',
    'A CAMINHO DO CLIENTE': 'from-slate-300 to-slate-500 text-white border-slate-600',
    'CONTAINER MONTADO': 'from-slate-300 to-slate-500 text-white border-slate-600',
    'EM DESOVA': 'from-slate-300 to-slate-500 text-white border-slate-600',
    'AGUARDANDO DESOVA': 'from-slate-300 to-slate-500 text-white border-slate-600',
    'ENTREGUE COM PENDENCIA CANHOTO': 'from-slate-300 to-slate-500 text-white border-slate-600',
    'ANEXANDO DOCUMENTOS FINAIS': 'from-slate-300 to-slate-500 text-white border-slate-600',
    ENTREGUE: 'from-slate-300 to-slate-500 text-white border-slate-600',
    CANCELADO: 'from-slate-300 to-slate-500 text-white border-slate-600',
    MOTORISTAS: 'from-slate-300 to-slate-500 text-white border-slate-600',
    default: 'from-slate-300 to-slate-500 text-white border-slate-600'
  };

  // Icon map for each status
  const statusIcons = {
    PROGRAMADAS: <FaCalendarAlt className="text-2xl lg:text-3xl" />,
    AGENDADO: <FaClock className="text-2xl lg:text-3xl" />,
    'A CAMINHO DO CLIENTE': <FaTruck className="text-2xl lg:text-3xl" />,
    'CONTAINER MONTADO': <FaBox className="text-2xl lg:text-3xl" />,
    'EM DESOVA': <FaDolly className="text-2xl lg:text-3xl" />,
    'AGUARDANDO DESOVA': <FaExclamationTriangle className="text-2xl lg:text-3xl" />,
    'ENTREGUE COM PENDENCIA CANHOTO': <FaExclamationTriangle className="text-2xl lg:text-3xl" />,
    'ANEXANDO DOCUMENTOS FINAIS': <FaFilePdf className="text-2xl lg:text-3xl" />,
    ENTREGUE: <FaCheckCircle className="text-2xl lg:text-3xl" />,
    CANCELADO: <FaTimesCircle className="text-2xl lg:text-3xl" />,
    MOTORISTAS: <FaUsers className="text-2xl lg:text-3xl" />
  };

  // (icons removed - only colors used now)
  // previously used an emoji map; cards will display color only.

  const getCardClasses = (status) => {
    return cardColors[status] || cardColors.default;
  };

  // fullscreen helpers - keyboard shortcut Ctrl+Shift+F
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (e) {
        console.error('Failed to enter fullscreen', e);
      }
    } else {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const escHandler = (e) => {
      if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
      }
      // Ctrl+Shift+F para fullscreen
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', escHandler);
    return () => {
      window.removeEventListener('keydown', escHandler);
    };
  }, []);

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
      // compute periodDate string if needed (DD/MM/YYYY)
      let periodDate = '';
      if (statsPeriod && statsPeriod !== 'general') {
        const today = new Date();
        today.setHours(0,0,0,0);
        if (statsPeriod === 'yesterday') {
          today.setDate(today.getDate() - 1);
        } else if (statsPeriod === 'tomorrow') {
          today.setDate(today.getDate() + 1);
        }
        periodDate = today.toLocaleDateString('pt-BR');
      }
      console.log('Enviando filtros ao backend:', backendFilters, 'período:', statsPeriod, 'data:', periodDate);
      const response = await adminService.getDeliveries(backendFilters, statsPeriod, periodDate);
      const data = response.data.deliveries || [];
      console.log('Resposta do backend:', data.length, 'entregas');
      setDeliveries(data);
      
      // Calcula stats com base nos dados retornados
      // construímos um mapa de status
      const statusCounts = {};
      data.forEach(d => {
        const s = d.status || 'UNKNOWN';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });
      const motoristaSet = new Set(data.map(d => d.driverName).filter(Boolean));
      setStats({
        total: data.length,
        statusCounts,
        byDriver: motoristaSet.size
      });

      setToast({ message: `Carregadas ${data.length} entregas`, type: 'success' });
    } catch (error) {
      console.error('Erro ao carregar:', error);
      setToast({ message: 'Erro ao carregar entregas', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filters, statsPeriod]);

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

    // Filtro de status customizado - IGNORADO quando período específico é selecionado
    let filtered = result;
    if (statsPeriod === 'general') {
      // Apenas aplica filtro de status quando no modo 'general'
      if (filters.status && filters.status !== 'all') {
        filtered = filtered.filter(d => {
          if (filters.status === 'OPERACAO_FINALIZADA') return d.status === 'ENTREGUE' || d.status === 'submitted';
          if (filters.status === 'A CAMINHO DO CLIENTE') return d.status === 'pending' || d.status === 'PENDING';
          if (filters.status === 'AGENDADO') return d.status === 'AGENDADO';
          return d.status === filters.status;
        });
      }
    }

    // Filtro de texto (Busca)
    if (filters.searchTerm && filters.searchTerm.trim() !== '') {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(d => 
        (d.deliveryNumber || '').toLowerCase().includes(searchLower) ||
        (d.driverName || '').toLowerCase().includes(searchLower) ||
        (d.userName || '').toLowerCase().includes(searchLower) ||
        (d.recebedor || '').toLowerCase().includes(searchLower) ||
        (d.vehiclePlate || '').toLowerCase().includes(searchLower)
      );
    }

    // Filtro de data - AGENDAMENTO
    // apply explicit date bounds if user set filters
    if (filters.startDate && filters.startDate.trim() !== '') {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(d => {
        if (!d.dataAgendamento) return false;
        const deliveryDate = new Date(d.dataAgendamento);
        deliveryDate.setHours(0, 0, 0, 0);
        return deliveryDate >= startDate;
      });
    }

    if (filters.endDate && filters.endDate.trim() !== '') {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(d => {
        if (!d.dataAgendamento) return false;
        const deliveryDate = new Date(d.dataAgendamento);
        return deliveryDate <= endDate;
      });
    }

    // additional period-based filtering já é feito no backend
    // (quando statsPeriod é enviado, o backend filtra por ProgramacaoEntrega)

    setFilteredDeliveries(filtered);
  }, [deliveries, filters, sortBy, sortDir, statsPeriod]);

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

  // gera um PDF com informações da entrega para compartilhar/exportar
  const handleShareDelivery = async () => {
    console.debug('handleShareDelivery invoked', selectedDelivery);
    if (!selectedDelivery) {
      setToast({ type: 'error', message: 'Nenhuma entrega selecionada' });
      return;
    }

    try {
      const doc = new jsPDF({ unit: 'pt' });

      // tenta carregar logo da pasta pública
      const loadImage = (url) =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });

      const logoUrl = await loadImage('/images/geotransporteslogo.png');
      if (logoUrl) {
        // centraliza logo no topo com largura máxima de 100pt
        const imgProps = doc.getImageProperties(logoUrl);
        const w = 100;
        const h = (imgProps.height * w) / imgProps.width;
        const x = (doc.internal.pageSize.getWidth() - w) / 2;
        doc.addImage(logoUrl, 'PNG', x, 20, w, h);
      }

      doc.setFontSize(16);
      doc.text('Detalhes da Entrega', doc.internal.pageSize.getWidth() / 2, 60, { align: 'center' });

      const rows = [];
      const addRow = (label, value) => rows.push([label, value || '-']);

      addRow('Número', selectedDelivery.deliveryNumber);
      addRow('Contratado', selectedDelivery.userName);
      addRow('Motorista', selectedDelivery.driverName);
      addRow('Placa', selectedDelivery.vehiclePlate);
      addRow('Status', formatStatus(selectedDelivery.status));
      addRow('Agendamento', selectedDelivery.dataAgendamento ? new Date(selectedDelivery.dataAgendamento).toLocaleString('pt-BR') : '-');
      addRow('Montagem container', selectedDelivery.containerMontadoAt ? new Date(selectedDelivery.containerMontadoAt).toLocaleString('pt-BR') : '-');
      addRow('Chegada', selectedDelivery.horarioChegada ? new Date(selectedDelivery.horarioChegada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');
      addRow('Início desova', selectedDelivery.horarioInicioDesova ? new Date(selectedDelivery.horarioInicioDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');
      addRow('Fim desova', selectedDelivery.horarioFimDesova ? new Date(selectedDelivery.horarioFimDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

      const history = getFlowHistory(selectedDelivery);
      if (history.length > 0) {
        history.forEach(ev => addRow(ev.label, new Date(ev.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })));
      }

      if (selectedDelivery.observations) addRow('Observações', selectedDelivery.observations);
      if (selectedDelivery.observacoes) addRow('Observações (alt.)', selectedDelivery.observacoes);
      if (selectedDelivery.documentsJustification) addRow('Justificativa docs', selectedDelivery.documentsJustification);
      if (selectedDelivery.submissionObservation) addRow('Obs. submissão', selectedDelivery.submissionObservation);

      doc.autoTable({
        startY: logoUrl ? 100 : 80,
        head: [['Campo', 'Valor']],
        body: rows,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [60, 60, 60] }
      });

      doc.save(`Entrega_${selectedDelivery.deliveryNumber}.pdf`);
      setToast({ type: 'success', message: 'PDF gerado e baixado' });
    } catch (err) {
      console.error('Erro ao gerar PDF', err);
      setToast({ type: 'error', message: 'Falha ao gerar PDF: ' + err.message });
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
    if (isGeoMar()) {
      setToast({ type: 'error', message: '<FaEye/> Modo Visualização: você não pode editar entregas' });
      return;
    }
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
      observations: removeProgramacaoInfo(delivery.observations)
    });
  };

  const handleEditSave = async () => {
    if (!editForm.observations || editForm.observations.trim() === '') {
      setToast({ message: 'Motivo da edição é obrigatório', type: 'error' });
      return;
    }

    // Remove info 'Criada a partir da Programação ...' do campo motivo, adiciona ao campo observações
    let motivo = editForm.observations.replace(/Criada a partir da Programação [A-Z0-9]+/g, '').trim();
    let programacaoInfo = (editForm.observations.match(/Criada a partir da Programação [A-Z0-9]+/) || []).join(' ');
    let observacoes = motivo;
    if (programacaoInfo) {
      observacoes = motivo + '\n' + programacaoInfo;
    }

    const editPayload = {
      ...editForm,
      observations: observacoes,
      editedBy: user?.name || user?.username || user?.email || 'Desconhecido',
      editedAt: new Date().toISOString()
    };

    try {
      // Usa a rota correta para atualizar entrega
      const response = await adminService.updateDelivery(editingDelivery, editPayload);
      setToast({ message: 'Entrega atualizada com sucesso', type: 'success' });
      setEditingDelivery(null);
      loadDeliveries();
    } catch (error) {
      setToast({ message: 'Erro ao atualizar entrega', type: 'error' });
    }
  };

  const removeProgramacaoInfo = (obs) => {
    if (!obs) return '';
    return obs.replace(/Criada a partir da Programação [A-Z0-9]+/g, '').trim();
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
    if (status === 'ENTREGUE_COM_PENDENCIA_CANHOTO') return 'ENTREGUE (PENDÊNCIA)';
    if (status === 'pending' || status === 'PENDING') return 'A CAMINHO DO CLIENTE';
    return status.replace(/_/g, ' ');
  };

  // statuses which represent steps for progress bar (in order)
  const progressStatuses = [
    'AGENDADO',
    'CONTAINER MONTADO',
    'A CAMINHO DO CLIENTE',
    'AGUARDANDO DESOVA',
    'EM DESOVA',
    'ANEXANDO DOCUMENTOS FINAIS',
    'ENTREGUE'
  ];

  const normalizeStatusForProgress = (s) => {
    if (!s) return null;
    // unify format: replace underscores, make uppercase, trim
    const ux = String(s).replace(/_/g, ' ').toUpperCase().trim();
    // map aliases to canonical
    if (ux === 'ENTREGUE' || ux === 'SUBMITTED' || ux === 'FINALIZADO' || ux === 'ENTREGUE COM PENDENCIA CANHOTO') {
      return 'ENTREGUE';
    }
    if (ux === 'PENDING' || ux === 'A CAMINHO DO CLIENTE') return 'A CAMINHO DO CLIENTE';
    return ux;
  };

  const getProgress = (delivery) => {
    const status = normalizeStatusForProgress(delivery.status);
    if (status === 'CANCELADO' || !status) return 0;
    const idx = progressStatuses.indexOf(status);
    if (idx === -1) return 0;
    return Math.round((idx / (progressStatuses.length - 1)) * 100);
  };

  // Função para retornar o status dos documentos
  // retorna string como "COMPLETO" ou "PENDENTE CTE + NF"
  // usada na Torre de Controle para tooltip; a coluna agora exibe
  // apenas um círculo verde/vermelho tipo semáforo.
  const getDocumentsStatus = (delivery) => {
    if (!delivery) return 'PENDENTE';
    
    const requiredDocs = ['canhotCTE', 'diarioBordo', 'canhotNF', 'devolucaoVazio'];
    const docs = delivery.documents || {};
    
    const allAttached = requiredDocs.every(doc => docs[doc]);
    if (allAttached) return 'COMPLETO';
    
    // Verificar quais estão pendentes
    const pending = requiredDocs.filter(doc => !docs[doc]);
    const pendingNames = pending.map(doc => {
      if (doc === 'canhotCTE') return 'CTE';
      if (doc === 'canhotNF') return 'NF';
      if (doc === 'diarioBordo') return 'DIÁRIO';
      if (doc === 'devolucaoVazio') return 'RIC';
      return doc;
    }).join(' + ');
    
    return `PENDENTE ${pendingNames}`;
  };

  // Default labels for Manaus; we will pick per-delivery labels when showing modal
  const defaultDocumentLabels = manaConfig.documents || {
    canhotNF: 'NF',
    canhotCTE: 'CTE',
    diarioBordo: 'Diário',
    devolucaoVazio: 'Vazio',
    retiradaCheio: 'Cheio'
  };

  const getLabelsForDelivery = (delivery) => {
    if (!delivery) return defaultDocumentLabels;
    const city = (delivery.city || '').toLowerCase();
    if (city === 'itajai') return itajaiConfig.documents || {};
    return defaultDocumentLabels;
  };

  // Extrai URLs dos documentos (R2, local ou antigo formato)
  const getDocumentUrlsArray = (docData) => {
    if (!docData) return [];
    
    // Se for string, retorna array com a string
    if (typeof docData === 'string') {
      return [docData];
    }
    
    // Se for array, processa cada item
    if (Array.isArray(docData)) {
      return docData.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          // R2: tem propriedade url
          if (item.url) return item.url;
          // Local: tem propriedade path
          if (item.path) return `/uploads/${item.path}`;
          // Antigo Google Drive: tem propriedade link ou webViewLink
          if (item.link) return item.link;
          if (item.webViewLink) return item.webViewLink;
        }
        return null;
      }).filter(Boolean);
    }
    
    // Se for objeto (documento único)
    if (typeof docData === 'object') {
      if (docData.url) return [docData.url];
      if (docData.path) return [`/uploads/${docData.path}`];
      if (docData.link) return [docData.link];
      if (docData.webViewLink) return [docData.webViewLink];
    }
    
    return [];
  };

  // Later, when rendering, use const labels = getLabelsForDelivery(selectedDelivery) and use labels[docKey] || docKey


  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 h-screen flex flex-col">
      {/* outer padding removed; content will stretch */}
      <div className="w-full flex-grow overflow-auto p-4 lg:p-6">
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
            title="Atualizar dados"
            className="flex items-center gap-2 px-3 py-1 lg:px-4 lg:py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg shadow-sm hover:shadow-md disabled:opacity-50 font-semibold text-sm transition"
          >
            <FaSync className={loading ? 'animate-spin' : ''} size={16} />
          </button>
        </div>

        {/* Period Selector for Stats */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setStatsPeriod('general')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              statsPeriod === 'general'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📊 Geral
          </button>
          <button
            onClick={() => setStatsPeriod('yesterday')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              statsPeriod === 'yesterday'
                ? 'bg-gray-700 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <FaCalendarAlt className="inline mr-2" /> Ontem
          </button>
          <button
            onClick={() => setStatsPeriod('today')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              statsPeriod === 'today'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <FaClock className="inline mr-2" /> Hoje
          </button>
          <button
            onClick={() => setStatsPeriod('tomorrow')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              statsPeriod === 'tomorrow'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
<FaCalendarAlt className="inline mr-2" /> Amanhã
          </button>
        </div>

        {/* Stats Cards - Semantic Color Palette */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6 lg:mb-8">
          {/* programadas */}
          <div className={`bg-gradient-to-r rounded-2xl shadow-2xl p-6 lg:p-8 border-l-8 flex flex-col items-center justify-center hover:scale-105 transition-transform duration-300 ease-in-out cursor-pointer ring-4 ring-white ring-opacity-20 ${getCardClasses('PROGRAMADAS')}`}> 
            {statusIcons.PROGRAMADAS}
            <p className="text-xs lg:text-sm font-extrabold uppercase tracking-widest text-center mb-2">PROGRAMADAS</p>
            <p className="text-2xl lg:text-4xl font-extrabold drop-shadow">{stats.total}</p>
          </div>

          {/* status cards */}
          {(() => {
            const order = [
              'AGENDADO',
              'CONTAINER MONTADO',
              'A CAMINHO DO CLIENTE',
              'AGUARDANDO DESOVA',
              'EM DESOVA',
              'ANEXANDO DOCUMENTOS FINAIS',
              'ENTREGUE',
              'CANCELADO'
            ];
            const entries = Object.entries(stats.statusCounts);
            entries.sort(([a], [b]) => {
              const ia = order.indexOf(a);
              const ib = order.indexOf(b);
              if (ia !== -1 && ib !== -1) return ia - ib;
              if (ia !== -1) return -1;
              if (ib !== -1) return 1;
              return a.localeCompare(b);
            });
            return entries.map(([status, count]) => {
              const label = status.replace(/_/g, ' ');
              return (
                <div
                  key={status}
                  className={`bg-gradient-to-r rounded-xl shadow-xl p-3 lg:p-5 border-l-4 flex flex-col items-center justify-center hover:scale-110 transition-transform cursor-pointer ${getCardClasses(label || status)}`}
                >
                  {statusIcons[label] || statusIcons[status]}
                  <p className="text-xs lg:text-sm font-extrabold uppercase tracking-widest text-center mb-2 line-clamp-2">
                    {label.length > 18 ? label.substring(0, 15) + '...' : label}
                  </p>
                  <p className="text-2xl lg:text-4xl font-extrabold drop-shadow">
                    {count}
                  </p>
                </div>
              );
            });
          })()}

          {/* motoristas */}
          <div className={`bg-gradient-to-r rounded-2xl shadow-2xl p-6 lg:p-8 border-l-8 flex flex-col items-center justify-center hover:scale-105 transition-transform duration-300 ease-in-out cursor-pointer ring-4 ring-white ring-opacity-20 ${getCardClasses('MOTORISTAS')}`}>
            {statusIcons.MOTORISTAS}
            <p className="text-xs lg:text-sm font-extrabold uppercase tracking-widest text-center mb-2">MOTORISTAS</p>
            <p className="text-2xl lg:text-4xl font-extrabold drop-shadow">{stats.byDriver}</p>
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
                  <option value="AGENDADO">Agendado</option>
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
          <div className="overflow-x-auto overflow-visible bg-white rounded-lg shadow-md" style={{ position: 'relative' }}>
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-purple-100 to-purple-200 border-b-2 border-purple-400 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">Nº</th>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">CONTRATADO</th>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">MOTORISTA</th>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">RECEBEDOR</th>
                    <th className="px-2 py-2 text-left font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">STATUS</th>
                    <th title="progresso da entrega" className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">PROGRESSO</th>
                    <th className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">DT RETIRADA</th>
                    <th className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">AGENDAMENTO</th>
                    <th className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">CHEGADA</th>
                    <th className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">INÍCIO</th>
                    <th className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">FIM</th>
                    <th title="Tempo no cliente" className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap bg-amber-100">TEMPO CLI</th>
                    <th title="Status dos documentos" className="px-2 py-2 text-center font-extrabold text-gray-900 uppercase tracking-tight whitespace-nowrap">DOCS</th>
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
                    <td className="px-2 py-2 text-gray-700">{delivery.userName}</td>
                    <td className="px-2 py-2 text-gray-700">{delivery.driverName || '-'}</td>
                    <td className="px-2 py-2 text-gray-700">{delivery.recebedor || '-'}</td>
                    <td className="px-2 py-2">
                      <span className={`px-2 py-1 rounded-full font-bold uppercase tracking-tight text-xs whitespace-nowrap inline-flex items-center justify-center ${getStatusBadge(delivery.status)}`}>
                        {formatStatus(delivery.status)}
                      </span>
                      {delivery.status === 'CANCELADO' && (
                        <span className="ml-2 px-2 py-1 rounded bg-gray-200 text-gray-700 border border-gray-400 font-bold text-xs">CANCELADO</span>
                      )}
                    </td>
                    {/* progress cell */}
                    <td className="px-2 py-2 text-center">
                      {(() => {
                        const p = getProgress(delivery);
                        const totalStages = 7;
                        const filledDots = Math.ceil((p / 100) * totalStages);
                        const colorClass = p === 100 ? 'bg-green-500' : (p >= 66 ? 'bg-yellow-400' : (p >= 33 ? 'bg-indigo-500' : 'bg-gray-300'));
                        return (
                          <div className="flex items-center gap-1" title={`${p}%`}>
                            <span className="text-xs font-bold text-gray-600">{p}%</span>
                            <div className="flex gap-1">
                              {Array.from({ length: totalStages }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-3 h-3 rounded-full transition-all ${
                                    i < filledDots ? `${colorClass} ${p < 100 ? 'animate-pulse' : ''}` : 'bg-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-2 text-gray-600 whitespace-nowrap text-center font-semibold text-blue-600 bg-blue-50">
                      {delivery.containerMontadoAt ? new Date(delivery.containerMontadoAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </td>
                    <td className="px-2 py-2 text-gray-600 whitespace-nowrap text-center">
                      {delivery.dataAgendamento ? new Date(delivery.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </td>
                    <td className="px-2 py-2 text-gray-700 whitespace-nowrap text-center">
                      {delivery.horarioChegada
                        ? new Date(delivery.horarioChegada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                        : '-'}
                    </td>
                    <td className="px-2 py-2 text-gray-700 whitespace-nowrap text-center">
                      {delivery.horarioInicioDesova
                        ? new Date(delivery.horarioInicioDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                        : '-'}
                    </td>
                    <td className="px-2 py-2 text-gray-700 whitespace-nowrap text-center">
                      {delivery.horarioFimDesova
                        ? new Date(delivery.horarioFimDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                        : '-'}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold bg-amber-50">
                      {(() => {
                        const result = calculateCliTime(delivery, currentTime);
                        if (!result || !result.tempo) return <span className="text-gray-500">-</span>;
                        return (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-amber-700 font-bold">{result.tempo}</span>
                            {result.isActive && <span className="text-lg animate-pulse">⏱️</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {(() => {
                        const statusText = getDocumentsStatus(delivery);
                        const complete = statusText.includes('COMPLETO');
                        // traffic‑light circle with tooltip showing full status
                        return (
                          <div title={statusText} className="flex items-center justify-center">
                            <span
                              className={`w-3 h-3 rounded-full ${
                                complete ? 'bg-green-500' : 'bg-red-500'
                              }`}
                            />
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => setSelectedDelivery(delivery)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-purple-200 text-purple-600 transition text-sm hover:text-purple-800"
                        title="Visualizar"
                      >
                        <FaEye size={16} />
                      </button>
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
                  <p className="text-xs font-semibold text-gray-500 uppercase">DT Montagem Container</p>
                  <p className="text-base text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded">{selectedDelivery.containerMontadoAt ? new Date(selectedDelivery.containerMontadoAt).toLocaleString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Chegada</p>
                  <p className="text-base text-gray-700">
                    {selectedDelivery.horarioChegada
                      ? new Date(selectedDelivery.horarioChegada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Início Desova</p>
                  <p className="text-base text-gray-700">
                    {selectedDelivery.horarioInicioDesova
                      ? new Date(selectedDelivery.horarioInicioDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Fim Desova</p>
                  <p className="text-base text-gray-700">
                    {selectedDelivery.horarioFimDesova
                      ? new Date(selectedDelivery.horarioFimDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                      : '-'}
                  </p>
                </div>
              </div>

              {(selectedDelivery.observations || selectedDelivery.observacoes || selectedDelivery.documentsJustification || selectedDelivery.submissionObservation || flowHistory.length > 0) && (
                <div className="space-y-2">
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded shadow-sm">
                    <p className="text-xs font-bold text-blue-800 uppercase mb-1">📝 Observações do Fluxo</p>
                    {/* renderir histórico automático baseado nas timestamps */}
                    {flowHistory.map((ev, idx) => (
                      <p key={idx} className="text-gray-800 text-sm">
                        {ev.label} em {new Date(ev.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    ))}
                    {selectedDelivery.observations && (
                      <p className="text-gray-800 text-sm whitespace-pre-wrap">{selectedDelivery.observations}</p>
                    )}
                    {selectedDelivery.observacoes && (
                      <p className="text-gray-800 text-sm whitespace-pre-wrap">{selectedDelivery.observacoes}</p>
                    )}
                    {!selectedDelivery.observations && !selectedDelivery.observacoes && flowHistory.length === 0 && (
                      <p className="text-gray-600 text-sm">-</p>
                    )}
                  </div>

                  {selectedDelivery.documentsJustification && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-sm">
                      <p className="text-xs font-bold text-yellow-800 uppercase mb-1"><FaExclamationTriangle className="inline mr-2" />Justificativa de Documentos</p>
                      <p className="text-gray-800 text-sm whitespace-pre-wrap">{selectedDelivery.documentsJustification}</p>
                    </div>
                  )}

                  {selectedDelivery.submissionObservation && (
                    <div className="bg-indigo-50 border-l-4 border-indigo-300 p-4 rounded shadow-sm">
                      <p className="text-xs font-bold text-indigo-800 uppercase mb-1">ℹ️ Observação de Submissão</p>
                      <p className="text-gray-800 text-sm whitespace-pre-wrap">{selectedDelivery.submissionObservation}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Documentos e Fotos do Fluxo */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-gray-700 uppercase tracking-wide"><FaBox className="inline mr-2" />Documentos e Fotos do Fluxo</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleShareDelivery()}
                      className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition font-semibold flex items-center gap-2"
                    >
                      <FaShareAlt /> Compartilhar
                    </button>
                    <button
                      onClick={() => handleDownloadAll(selectedDelivery._id)}
                      className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition font-semibold flex items-center gap-2"
                    >
                      <FaDownload /> Baixar Pasta
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {(() => {
                    const labels = getLabelsForDelivery(selectedDelivery);
                    // Documentos normais (sem duplicar campos de fotos)
                    const docRows = Object.keys(selectedDelivery.documents || {})
                      .filter(docKey => !['chegadaCliente', 'inicioDesova', 'fimDesova'].includes(docKey))
                      .map(docKey => (
                        <div key={docKey}>
                          {selectedDelivery.documents[docKey] ? (
                            <div className="bg-white border border-gray-300 p-4 rounded-lg flex items-center justify-between hover:shadow-md transition">
                              <span className="font-semibold text-gray-700 text-sm">{labels[docKey] || docKey}</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const urls = getDocumentUrlsArray(selectedDelivery.documents[docKey]);
                                    setViewingDocument({ label: labels[docKey] || docKey, urls, type: 'document' });
                                  }}
                                  className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition title='Visualizar'"
                                  title="Visualizar"
                                >
                                  <FaEye size={16} />
                                </button>
                                <button
                                  onClick={() => handleDownload(selectedDelivery._id, docKey)}
                                  className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                                  title="Baixar"
                                >
                                  <FaDownload size={16} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-100 p-4 rounded-lg text-gray-500 text-sm border border-gray-200">{labels[docKey] || docKey} <span className="text-gray-400">- Não anexado</span></div>
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
                      const files = getDocumentUrlsArray(selectedDelivery.documents?.[f.key]);
                      return files.length > 0 ? (
                        <div key={f.label + idx} className="bg-white border border-gray-300 p-4 rounded-lg flex items-center justify-between hover:shadow-md transition">
                          <span className="font-semibold text-gray-700 text-sm">{f.label}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setModalFotos({ label: f.label, files })}
                              className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
                              title="Visualizar"
                            >
                              <FaEye size={16} />
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
                              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                              title="Baixar"
                            >
                              <FaDownload size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={f.label + idx} className="bg-gray-100 p-4 rounded-lg text-gray-500 text-sm border border-gray-200">{f.label} <span className="text-gray-400">- Não anexado</span></div>
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

      {/* Modal para visualizar documento */}
      {viewingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">{viewingDocument.label}</h2>
              <button onClick={() => setViewingDocument(null)} className="text-3xl hover:text-gray-400 transition font-light">
                <FaTimes />
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg overflow-auto max-h-[70vh]">
              {viewingDocument.urls && viewingDocument.urls.length > 0 ? (
                <div className="space-y-4">
                  {viewingDocument.urls.map((url, idx) => (
                    <div key={idx} className="border-b border-gray-200 pb-4 last:border-b-0">
                      {url && url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={url} alt={`${viewingDocument.label} ${idx + 1}`} className="w-full h-auto rounded" />
                      ) : (
                        <div className="p-6 text-center text-gray-600">
                          <p className="mb-4">{viewingDocument.label} {viewingDocument.urls.length > 1 ? `${idx + 1}` : ''}</p>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          >
                            <FaDownload /> Abrir em nova aba
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : viewingDocument.url ? (
                // Fallback para formato antigo com url singular
                viewingDocument.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img src={viewingDocument.url} alt={viewingDocument.label} className="w-full h-auto rounded" />
                ) : (
                  <div className="p-6 text-center text-gray-600">
                    <p className="mb-4">Documento: {viewingDocument.label}</p>
                    <a
                      href={viewingDocument.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <FaDownload /> Abrir em nova aba
                    </a>
                  </div>
                )
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <p>Nenhum documento disponível</p>
                </div>
              )}
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

            {isGeoMar() && (
              <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
                <p className="text-sm text-amber-800 font-semibold"><FaEye className="inline mr-2" />Modo Visualização</p>
                <p className="text-xs text-amber-700">Este formulário está bloqueado para visualização apenas</p>
              </div>
            )}

            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Número do Container</label>
                <input type="text" disabled={isGeoMar()} value={editForm.deliveryNumber} onChange={e => setEditForm({ ...editForm, deliveryNumber: e.target.value.toUpperCase() })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} placeholder="Ex: CGMU5575947" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Contratado</label>
                <input type="text" disabled={isGeoMar()} value={editForm.userName} onChange={e => setEditForm({ ...editForm, userName: e.target.value })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} placeholder="Ex: Josinei vieira" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Motorista</label>
                <input type="text" disabled={isGeoMar()} value={editForm.driverName} onChange={e => setEditForm({ ...editForm, driverName: e.target.value })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} placeholder="Ex: ALAN" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Placa do Veículo</label>
                <input type="text" disabled={isGeoMar()} value={editForm.vehiclePlate} onChange={e => setEditForm({ ...editForm, vehiclePlate: e.target.value.toUpperCase() })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} placeholder="Ex: ABC1D23" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Recebedor</label>
                <input type="text" disabled={isGeoMar()} value={editForm.recebedor} onChange={e => setEditForm({ ...editForm, recebedor: e.target.value })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} placeholder="Nome do recebedor" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select disabled={isGeoMar()} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}>
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
                <input type="datetime-local" disabled={isGeoMar()} value={editForm.dataAgendamento} onChange={e => setEditForm({ ...editForm, dataAgendamento: e.target.value })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Horário Chegada</label>
                <input type="datetime-local" disabled={isGeoMar()} value={editForm.horarioChegada} onChange={e => setEditForm({ ...editForm, horarioChegada: e.target.value })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Início Desova</label>
                <input type="datetime-local" disabled={isGeoMar()} value={editForm.horarioInicioDesova} onChange={e => setEditForm({ ...editForm, horarioInicioDesova: e.target.value })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Fim Desova</label>
                <input type="datetime-local" disabled={isGeoMar()} value={editForm.horarioFimDesova} onChange={e => setEditForm({ ...editForm, horarioFimDesova: e.target.value })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo da Edição *</label>
                <textarea disabled={isGeoMar()} value={editForm.observations} onChange={e => setEditForm({ ...editForm, observations: e.target.value })} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${isGeoMar() ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} placeholder="Explique por que está editando (obrigatório)" rows="2" required />
              </div>
              <div className="flex gap-2">
                <button disabled={isGeoMar()} onClick={handleEditSave} className={`flex-1 px-4 py-2 rounded-lg transition font-semibold ${isGeoMar() ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>Salvar</button>
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
