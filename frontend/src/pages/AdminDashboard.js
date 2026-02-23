import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import Footer from '../components/Footer';
import { adminService } from '../services/authService';
import { FaArrowLeft, FaDownload, FaEye, FaTrash } from 'react-icons/fa';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
  Cell
} from 'recharts';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [filters, setFilters] = useState({
    searchTerm: '',
    startDate: '',
    endDate: ''
  });



  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [programForm, setProgramForm] = useState({
    processo: '', cliente: '', fornecedor: '', destinatario: '', navio: '', nrVi: '', numeroContainer: '', nf: '', cntr: '', dataAgendamento: '', observacaoDestino: '', contratado: '', processo2: '', performance: '', ocorrencia: ''
  });
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    loadData();
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [delivRes, statsRes] = await Promise.all([
        adminService.getDeliveries(filters),
        adminService.getStatistics({ period })
      ]);
      setDeliveries(delivRes.data.deliveries);
      setStatistics(statsRes.data.statistics);
    } catch (error) {
      setToast({ message: 'Erro ao carregar dados', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadPrograms = async () => {
    try {
      const res = await adminService.getPrograms();
      setPrograms(res.data.programs || []);
    } catch (err) {
      // ignore
    }
  };

  const handleDownload = async (deliveryId, documentType, index) => {
    try {
      const response = await adminService.downloadDocument(deliveryId, documentType, index);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${documentType}${index !== undefined ? `_${index}` : ''}.jpg`);
      document.body.appendChild(link);
      link.click();
      link.parentElement.removeChild(link);
    } catch (error) {
      setToast({ message: 'Erro ao baixar arquivo', type: 'error' });
    }
  };

  const handleDelete = async (deliveryId) => {
    if (window.confirm('Tem certeza que deseja deletar esta entrega? Esta ação não pode ser desfeita.')) {
      try {
        await adminService.deleteDelivery(deliveryId);
        setToast({ message: 'Entrega deletada com sucesso', type: 'success' });
        setSelectedDelivery(null);
        loadData(); // Recarrega a tabela
      } catch (error) {
        setToast({ message: 'Erro ao deletar entrega', type: 'error' });
      }
    }
  };

  const documentLabels = {
    canhotNF: '📄 Canhoto NF',
    canhotCTE: '📦 Canhoto CTE',
    diarioBordo: '📓 Diário de Bordo',
    devolucaoVazio: '🚛 Devolução Vazio',
    retiradaCheio: '🚚 Retirada Cheio'
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto p-4 pb-20">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-semibold mb-6 transition"
        >
          <FaArrowLeft />
          Voltar
        </button>

        <h2 className="text-3xl font-bold text-gray-800 mb-8">📊 Painel Administrativo</h2>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-gray-600 font-semibold mb-2">Total de Entregas</h3>
              <p className="text-4xl font-bold text-purple-600">{statistics.totalDeliveries}</p>
              <p className="text-sm text-gray-500 mt-2">
                Período:{' '}
                {period === 'day' ? 'Hoje' : period === 'week' ? 'Esta semana' : 'Este mês'}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-gray-600 font-semibold mb-2">Motoristas Ativos</h3>
              <p className="text-4xl font-bold text-green-600">
                {statistics.deliveriesByDriver.length}
              </p>
            </div>
          </div>
        )}

        {/* Charts */}
        {statistics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Daily deliveries */}
            {statistics.dailyDeliveries.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Entregas por Dia (últimos 30 dias)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={statistics.dailyDeliveries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="_id" 
                      tickFormatter={(date) => {
                        // Interpreta a string YYYY-MM-DD como data local (evita parse como UTC que causa -1 dia)
                        const parts = String(date).split('-');
                        if (parts.length === 3) {
                          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                          return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        }
                        return date;
                      }}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => value} labelFormatter={(label) => {
                      const parts = String(label).split('-');
                      if (parts.length === 3) {
                        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                        return d.toLocaleDateString('pt-BR');
                      }
                      return label;
                    }} />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Deliveries by transport */}
            {statistics.deliveriesByDriver.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Entregas por Contratado</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={statistics.deliveriesByDriver} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="_id" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value} entrega(s)`} />
                    <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]}>
                      {statistics.deliveriesByDriver.map((entry, index) => (
                        <Label 
                          key={index}
                          dataKey="count" 
                          position="top"
                          offset={5}
                          fill="#1f2937"
                          fontSize={12}
                          fontWeight="bold"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Período</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none"
              >
                <option value="day">Hoje</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mês</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar</label>
              <input
                type="text"
                placeholder="Nº entrega ou motorista"
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">De</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Até</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Montar Programação */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">Programações</h3>
            <button
              onClick={() => setProgramModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
            >
              🗂️ Montar Programação
            </button>
          </div>

          {programs && programs.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm text-gray-600 mb-2">Últimas programações</h4>
              <div className="grid grid-cols-1 gap-2">
                {programs.slice(0,5).map((p) => (
                  <div key={p._id} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <strong>{p.processo || '-'}:</strong> {p.cliente || '-'} — <span className="text-gray-500">{p.numeroContainer || p.nf || ''}</span>
                    <div className="text-xs text-gray-400">{p.dataAgendamento ? new Date(p.dataAgendamento).toLocaleString('pt-BR') : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Deliveries Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-800">
              Entregas Enviadas ({deliveries.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center text-gray-600">Nenhuma entrega encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Nº Entrega
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Motorista
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery._id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {delivery.deliveryNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{delivery.driverName}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {delivery.submittedAt ? new Date(delivery.submittedAt).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-sm rounded-full bg-green-100 text-green-800">
                          Enviada
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedDelivery(delivery)}
                          className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition flex items-center gap-1"
                        >
                          <FaEye /> Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Details */}
        {selectedDelivery && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">
                  Container: {selectedDelivery.deliveryNumber}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(selectedDelivery._id)}
                    className="text-red-600 hover:text-red-800 text-lg p-2 hover:bg-red-50 rounded-lg transition"
                    title="Deletar entrega"
                  >
                    <FaTrash />
                  </button>
                  <button
                    onClick={() => setSelectedDelivery(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Info */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-3">Informações</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Motorista</p>
                      <p className="font-medium">{selectedDelivery.driverName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Data de Envio</p>
                      <p className="font-medium">
                        {new Date(selectedDelivery.submittedAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {selectedDelivery.vehiclePlate && (
                      <div>
                        <p className="text-gray-600">Transportadora</p>
                        <p className="font-medium">{selectedDelivery.vehiclePlate}</p>
                      </div>
                    )}

                    {selectedDelivery.containerMontadoAt && (
                      <div>
                        <p className="text-gray-600">DT Montagem do Container</p>
                        <p className="font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">{new Date(selectedDelivery.containerMontadoAt).toLocaleString('pt-BR')}</p>
                      </div>
                    )}

                    {selectedDelivery.status === 'scheduled' && selectedDelivery.scheduledAt && (
                      <div>
                        <p className="text-gray-600">Agendada para</p>
                        <p className="font-medium">{new Date(selectedDelivery.scheduledAt).toLocaleString('pt-BR')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-3">Documentos</h4>
                  <div className="space-y-2">
                    {Object.entries(documentLabels).map(([key, label]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="font-medium text-gray-800">{label}</span>
                        {selectedDelivery.documents?.[key] ? (
                          Array.isArray(selectedDelivery.documents[key]) ? (
                            <div className="flex items-center gap-2">
                              {selectedDelivery.documents[key].map((d, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleDownload(selectedDelivery._id, key, i)}
                                  className="flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition text-sm"
                                >
                                  <FaDownload /> #{i + 1}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDownload(selectedDelivery._id, key)}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition text-sm"
                            >
                              <FaDownload /> Download
                            </button>
                          )
                        ) : (
                          <span className="text-gray-400 text-sm">Não anexado</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Observations (all) */}
                {(
                  selectedDelivery.observations ||
                  selectedDelivery.documentsJustification ||
                  selectedDelivery.submissionObservation
                ) && (
                  <div>
                    <h4 className="font-bold text-gray-800 mb-2">Observações do Fluxo</h4>
                    <div className="text-gray-700 space-y-2">
                      {selectedDelivery.observations && (
                        <div className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{selectedDelivery.observations}</div>
                      )}
                      {selectedDelivery.documentsJustification && (
                        <div className="whitespace-pre-wrap bg-yellow-50 p-3 rounded">{`Justificativa de documentos: ${selectedDelivery.documentsJustification}`}</div>
                      )}
                      {selectedDelivery.submissionObservation && (
                        <div className="whitespace-pre-wrap bg-blue-50 p-3 rounded">{selectedDelivery.submissionObservation}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


      {programModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Montar Programação</h3>
              <button onClick={() => setProgramModalOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Processo</label>
                  <input type="text" value={programForm.processo} onChange={(e) => setProgramForm({ ...programForm, processo: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">cliente</label>
                  <input type="text" value={programForm.cliente} onChange={(e) => setProgramForm({ ...programForm, cliente: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">FORNECEDOR</label>
                  <input type="text" value={programForm.fornecedor} onChange={(e) => setProgramForm({ ...programForm, fornecedor: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Destinatário</label>
                  <input type="text" value={programForm.destinatario} onChange={(e) => setProgramForm({ ...programForm, destinatario: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Navio</label>
                  <input type="text" value={programForm.navio} onChange={(e) => setProgramForm({ ...programForm, navio: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nr. vi</label>
                  <input type="text" value={programForm.nrVi} onChange={(e) => setProgramForm({ ...programForm, nrVi: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nº container</label>
                  <input type="text" value={programForm.numeroContainer} onChange={(e) => setProgramForm({ ...programForm, numeroContainer: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">NF</label>
                  <input type="text" value={programForm.nf} onChange={(e) => setProgramForm({ ...programForm, nf: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">CNTR</label>
                  <input type="text" value={programForm.cntr} onChange={(e) => setProgramForm({ ...programForm, cntr: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Dt. Agendamento</label>
                  <input type="datetime-local" value={programForm.dataAgendamento} onChange={(e) => setProgramForm({ ...programForm, dataAgendamento: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Observação destino</label>
                  <input type="text" value={programForm.observacaoDestino} onChange={(e) => setProgramForm({ ...programForm, observacaoDestino: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">CONTRATADO</label>
                  <input type="text" value={programForm.contratado} onChange={(e) => setProgramForm({ ...programForm, contratado: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">PROCESSO2</label>
                  <input type="text" value={programForm.processo2} onChange={(e) => setProgramForm({ ...programForm, processo2: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">PERFORMANCE</label>
                  <input type="text" value={programForm.performance} onChange={(e) => setProgramForm({ ...programForm, performance: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ocorrencia</label>
                  <input type="text" value={programForm.ocorrencia} onChange={(e) => setProgramForm({ ...programForm, ocorrencia: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setProgramModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
                <button
                  onClick={async () => {
                    try {
                      const res = await adminService.createProgram(programForm);
                      setToast({ message: res.data?.message || 'Programação salva', type: 'success' });
                      setProgramModalOpen(false);
                      setProgramForm({ processo: '', cliente: '', fornecedor: '', destinatario: '', navio: '', nrVi: '', numeroContainer: '', nf: '', cntr: '', dataAgendamento: '', observacaoDestino: '', contratado: '', processo2: '', performance: '', ocorrencia: '' });
                      loadPrograms();
                    } catch (err) {
                      setToast({ message: err.response?.data?.message || 'Erro ao salvar programação', type: 'error' });
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                >
                  Salvar Programação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Footer */}
      <Footer />
    </div>
  </div>
  );
};

export default AdminDashboard;
