import React, { useEffect, useState } from 'react';
import { adminService, deliveryService } from '../services/authService';
import { FaArrowLeft, FaFilter, FaSync, FaEdit, FaTrash, FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';

const BaseDadosGeral = () => {
  const navigate = useNavigate();
  const [dados, setDados] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Estados para o modal
  const [editForm, setEditForm] = useState({
    processo: '',
    recebedor: '',
    container: '',
    dataAgendamento: '',
    contratado: '',
    motorista: '',
    status: 'A CAMINHO DO CLIENTE',
    // Campos da entrega
    containerMontadoAt: '',
    horarioChegada: '',
    horarioInicioDesova: '',
    horarioFimDesova: '',
    observations: '',
    submissionObservation: '',
    documentsJustification: ''
  });
  
  // Filtros
  const [filters, setFilters] = useState({
    status: 'all',
    motorista: '',
    contratado: '',
    searchTerm: ''
  });

  // Status disponíveis (mesmo da Torre de Controle)
  const statusOptions = [
    'ENTREGUE',
    'submitted',
    'ENTREGUE_COM_PENDENCIA_CANHOTO',
    'pending',
    'PENDING',
    'AGUARDANDO_DESOVA',
    'EM_DESOVA',
    'DESOVA_FINALIZADA',
    'ANEXANDO_DOCUMENTOS_FINAIS',
    'CANCELADO',
    'CONTAINER_MONTADO',
    'A_CAMINHO_DO_CLIENTE'
  ];

  // Função para formatar status (sincronizado com Torre de Controle)
  const formatStatus = (status) => {
    if (!status) return '-';
    if (status === 'ENTREGUE' || status === 'submitted') return 'OPERAÇÃO FINALIZADA';
    if (status === 'ENTREGUE_COM_PENDENCIA_CANHOTO') return 'ENTREGUE (PENDÊNCIA)';
    if (status === 'pending' || status === 'PENDING') return 'A CAMINHO DO CLIENTE';
    return status.replace(/_/g, ' ');
  };

  // Função para retornar o status dos documentos
  const getDocumentsStatus = (delivery) => {
    if (!delivery) return 'PENDENTE';
    const requiredDocs = ['canhotCTE', 'diarioBordo', 'canhotNF', 'devolucaoVazio'];
    const docs = delivery.documents || {};
    const allAttached = requiredDocs.every(doc => docs[doc]);
    if (allAttached) return 'COMPLETO';
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

  const carregarDados = async () => {
    setLoading(true);
    try {
      const progRes = await adminService.getProgramacoes();
      const programacoes = progRes.data.programacoes || [];
      const entrRes = await adminService.getDeliveries({});
      const entregas = entrRes.data.deliveries || [];
      
      const mapEntregas = {};
      entregas.forEach(e => {
        const key = (e.deliveryNumber || '').toUpperCase().trim();
        if (key) mapEntregas[key] = e;
      });
      
      const dadosEnriquecidos = programacoes.map(prog => {
        const chaveContainer = (prog.container || '').toUpperCase().trim();
        const chaveProcesso = (prog.processo || '').toUpperCase().trim();
        const entrega = mapEntregas[chaveContainer] || mapEntregas[chaveProcesso];
        return { ...prog, _entrega: entrega || null };
      });
      
      setDados(dadosEnriquecidos);
      aplicarFiltros(dadosEnriquecidos);
    } catch (err) {
      console.error('Erro:', err);
      setToast({ message: 'Erro ao carregar dados', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = (dataToFilter = dados) => {
    let filtered = dataToFilter;
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item._entrega?.status === filters.status || item.status === filters.status);
    }
    if (filters.motorista) {
      filtered = filtered.filter(item => 
        (item.motorista || '').toLowerCase().includes(filters.motorista.toLowerCase()) ||
        (item._entrega?.driverName || '').toLowerCase().includes(filters.motorista.toLowerCase())
      );
    }
    if (filters.contratado) {
      filtered = filtered.filter(item => 
        (item.contratado || '').toLowerCase().includes(filters.contratado.toLowerCase())
      );
    }
    if (filters.searchTerm) {
      filtered = filtered.filter(item =>
        (item.processo || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (item.recebedor || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (item.container || '').toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }
    
    setFilteredData(filtered);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    aplicarFiltros();
  }, [filters]);

  const handleEdit = (item) => {
    setEditingId(item._id);
    setEditForm({
      processo: item.processo,
      recebedor: item.recebedor,
      container: item.container,
      dataAgendamento: item.dataAgendamento || '',
      contratado: item.contratado,
      motorista: item.motorista || '',
      status: item._entrega?.status || item.status,
      containerMontadoAt: item._entrega?.containerMontadoAt || '',
      horarioChegada: item._entrega?.horarioChegada || '',
      horarioInicioDesova: item._entrega?.horarioInicioDesova || '',
      horarioFimDesova: item._entrega?.horarioFimDesova || '',
      observations: item._entrega?.observations || '',
      submissionObservation: item._entrega?.submissionObservation || '',
      documentsJustification: item._entrega?.documentsJustification || ''
    });
  };

  const toISOIfDate = (val) => {
    if (!val) return undefined;
    // If already ISO-like, return as-is
    if (typeof val === 'string' && val.endsWith('Z')) return val;
    const d = new Date(val);
    if (!isNaN(d)) return d.toISOString();
    return val;
  };

  const handleSave = async () => {
    if (!editForm.processo || !editForm.recebedor || !editForm.dataAgendamento || !editForm.contratado) {
      setToast({ message: 'Preencha os campos obrigatórios (Processo, Recebedor, Data, Contratado)', type: 'error' });
      return;
    }

    try {
      const item = dados.find(d => d._id === editingId);

      // Atualizar programação (sem status — status é da entrega)
      await adminService.updateProgramacao(editingId, {
        processo: editForm.processo,
        recebedor: editForm.recebedor,
        container: editForm.container,
        dataAgendamento: toISOIfDate(editForm.dataAgendamento),
        contratado: editForm.contratado,
        motorista: editForm.motorista
      });

      // Payload de entrega (normaliza datas)
      const deliveryPayload = {
        status: editForm.status || undefined,
        containerMontadoAt: toISOIfDate(editForm.containerMontadoAt),
        horarioChegada: toISOIfDate(editForm.horarioChegada),
        horarioInicioDesova: toISOIfDate(editForm.horarioInicioDesova),
        horarioFimDesova: toISOIfDate(editForm.horarioFimDesova),
        observations: editForm.observations,
        submissionObservation: editForm.submissionObservation,
        documentsJustification: editForm.documentsJustification
      };

      if (item?._entrega?._id) {
        await adminService.updateDelivery(item._entrega._id, deliveryPayload);
      } else {
        // Se não existir entrega, cria uma vinculada ao deliveryNumber (container ou processo)
        const deliveryNumber = (editForm.container || editForm.processo || '').toString().trim();
        if (deliveryNumber) {
          await deliveryService.createDelivery({ deliveryNumber, ...deliveryPayload });
        }
      }

      setToast({ message: 'Atualizado com sucesso', type: 'success' });
      setEditingId(null);
      carregarDados();
    } catch (err) {
      console.error('Erro:', err);
      setToast({ message: 'Erro ao atualizar', type: 'error' });
    }
  };

  const handleDelete = async (id, item) => {
    if (window.confirm('Deletar esta entrada (entrega também será removida da Torre de Controle)?')) {
      try {
        await adminService.deleteProgramacao(id);
        if (item._entrega && item._entrega._id) {
          await adminService.deleteDelivery(item._entrega._id);
        }
        setToast({ message: 'Deletado com sucesso', type: 'success' });
        carregarDados();
      } catch (err) {
        setToast({ message: 'Erro ao deletar', type: 'error' });
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      {/* Header */}
      <div className="w-full mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-200 rounded-full transition"
              title="Voltar"
            >
              <FaArrowLeft size={20} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Base de Dados Geral</h1>
              <p className="text-sm text-gray-600">Gerenciamento completo de programações e entregas</p>
            </div>
          </div>
          <button
            onClick={() => { carregarDados(); setToast({ message: 'Dados recarregados', type: 'success' }); }}
            className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition"
            title="Recarregar"
          >
            <FaSync size={20} />
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-4 mt-6 w-full">
          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
            >
              <FaFilter size={16} />
              Filtros
            </button>
            <span className="text-sm text-gray-600">
              Mostrando {filteredData.length} de {dados.length} registros
            </span>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Buscar</label>
                <input
                  type="text"
                  placeholder="Processo, Recebedor, Container..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Todos</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{formatStatus(status)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Motorista</label>
                <input
                  type="text"
                  placeholder="Nome do motorista..."
                  value={filters.motorista}
                  onChange={(e) => setFilters({...filters, motorista: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Contratado</label>
                <input
                  type="text"
                  placeholder="Nome do contratado..."
                  value={filters.contratado}
                  onChange={(e) => setFilters({...filters, contratado: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="md:col-span-4">
                <button
                  onClick={() => setFilters({ status: 'all', motorista: '', contratado: '', searchTerm: '' })}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition text-sm"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabela com Scroll Horizontal */}
      <div className="w-full">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col w-full h-[88vh]">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : filteredData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhum registro encontrado</div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-purple-400 scrollbar-track-gray-200">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gradient-to-r from-purple-600 to-purple-700 text-white sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Processo</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Recebedor</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Container</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Data Agendamento</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Contratado</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Motorista</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Data Retirada</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Chegada</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Início Desova</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Fim Desova</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Docs</th>
                    <th className="px-4 py-3 text-left font-semibold border border-purple-700 whitespace-nowrap">Obs</th>
                    <th className="px-4 py-3 text-center font-semibold border border-purple-700 whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, idx) => (
                    <tr key={item._id} className={`border-b transition ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">{item.processo}</td>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">{item.recebedor}</td>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">{item.container || '-'}</td>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">{item.dataAgendamento ? new Date(item.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">{item.contratado}</td>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">{item.motorista || item._entrega?.driverName || '-'}</td>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                          {formatStatus(item._entrega?.status || item.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">{item._entrega?.containerMontadoAt ? new Date(item._entrega.containerMontadoAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">{item._entrega?.horarioChegada ? new Date(item._entrega.horarioChegada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : (item._entrega?.arrivedAt ? new Date(item._entrega.arrivedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-')}</td>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">{item._entrega?.horarioInicioDesova ? new Date(item._entrega.horarioInicioDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : (item._entrega?.desovaStartAt ? new Date(item._entrega.desovaStartAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-')}</td>
                      <td className="px-4 py-3 border border-gray-200 text-xs whitespace-nowrap">{item._entrega?.horarioFimDesova ? new Date(item._entrega.horarioFimDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : (item._entrega?.desovaEndAt ? new Date(item._entrega.desovaEndAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-')}</td>
                      <td className="px-4 py-3 border border-gray-200 text-center whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          getDocumentsStatus(item._entrega).includes('COMPLETO') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {getDocumentsStatus(item._entrega)}
                        </span>
                      </td>
                      <td className="px-4 py-3 border border-gray-200 text-xs max-w-xs truncate" title={item._entrega?.observations}>{item._entrega?.observations || '-'}</td>
                      <td className="px-4 py-3 border border-gray-200 text-center whitespace-nowrap">
                        <div className="flex gap-2 justify-center">
                          <button 
                            onClick={() => handleEdit(item)}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-xs font-semibold"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDelete(item._id, item)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs font-semibold"
                          >
                            Deletar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição */}
      {editingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Editar Programação e Entrega</h2>
              <button onClick={handleCancel} className="text-white hover:text-gray-200 transition">
                <FaTimes size={24} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Programação */}
              <div className="border-r border-gray-200 pr-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Programação</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Processo *</label>
                    <input type="text" value={editForm.processo} onChange={(e) => setEditForm({...editForm, processo: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Recebedor *</label>
                    <input type="text" value={editForm.recebedor} onChange={(e) => setEditForm({...editForm, recebedor: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Container</label>
                    <input type="text" value={editForm.container} onChange={(e) => setEditForm({...editForm, container: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data Agendamento *</label>
                    <input type="datetime-local" value={editForm.dataAgendamento} onChange={(e) => setEditForm({...editForm, dataAgendamento: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Contratado *</label>
                    <input type="text" value={editForm.contratado} onChange={(e) => setEditForm({...editForm, contratado: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Motorista</label>
                    <input type="text" value={editForm.motorista} onChange={(e) => setEditForm({...editForm, motorista: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                    <select value={editForm.status} onChange={(e) => setEditForm({...editForm, status: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="">Selecione um status</option>
                      {statusOptions.map(status => (
                        <option key={status} value={status}>{formatStatus(status)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Entrega */}
              <div className="pl-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Entrega</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data Retirada Cheio</label>
                    <input type="datetime-local" value={editForm.containerMontadoAt} onChange={(e) => setEditForm({...editForm, containerMontadoAt: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Horário Chegada</label>
                    <input type="datetime-local" value={editForm.horarioChegada} onChange={(e) => setEditForm({...editForm, horarioChegada: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Horário Início Desova</label>
                    <input type="datetime-local" value={editForm.horarioInicioDesova} onChange={(e) => setEditForm({...editForm, horarioInicioDesova: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Horário Fim Desova</label>
                    <input type="datetime-local" value={editForm.horarioFimDesova} onChange={(e) => setEditForm({...editForm, horarioFimDesova: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Observações</label>
                    <textarea value={editForm.observations} onChange={(e) => setEditForm({...editForm, observations: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 h-16" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Obs. Submissão</label>
                    <textarea value={editForm.submissionObservation} onChange={(e) => setEditForm({...editForm, submissionObservation: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 h-16" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Justificativa Docs</label>
                    <textarea value={editForm.documentsJustification} onChange={(e) => setEditForm({...editForm, documentsJustification: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 h-16" />
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-100 px-6 py-4 flex gap-4 border-t border-gray-200">
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
                Salvar Alterações
              </button>
              <button onClick={handleCancel} className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default BaseDadosGeral;
