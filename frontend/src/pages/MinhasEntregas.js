import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { deliveryService } from '../services/authService';
import { FaArrowLeft, FaEye, FaTrash, FaPlus } from 'react-icons/fa';

const MinhasEntregas = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Debounce search input and reload when filter or debounced search change
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(id);
  }, [searchTerm]);

  useEffect(() => {
    loadDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debouncedSearch]);

  const loadDeliveries = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      if (debouncedSearch && debouncedSearch.trim() !== '') {
        params.q = debouncedSearch.trim();
      }
      const response = await deliveryService.getMyDeliveries(params);
      setDeliveries(response.data.deliveries);
    } catch (error) {
      setToast({ message: 'Erro ao carregar entregas', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja deletar esta entrega?')) return;

    try {
      await deliveryService.deleteDelivery(id);
      setToast({ message: 'Entrega deletada com sucesso', type: 'success' });
      loadDeliveries();
    } catch (error) {
      setToast({
        message: error.response?.data?.message || 'Erro ao deletar',
        type: 'error'
      });
    }
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
          <button
            onClick={() => navigate('/nova-entrega')}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-md"
          >
            <FaPlus />
            Nova Entrega
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex gap-2">
              {[
                { label: 'Todas', value: 'all' },
                { label: 'Pendente', value: 'pending' },
                { label: 'Enviadas', value: 'submitted' }
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
                placeholder="Pesquisar por número, motorista ou placa"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Deliveries List */}
        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 text-lg mb-4">Nenhuma entrega encontrada</p>
            <button
              onClick={() => navigate('/nova-entrega')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-2 px-6 rounded-lg transition shadow-md"
            >
              Criar Nova Entrega
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries.map((delivery) => (
              <div
                key={delivery._id}
                className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                      Container: {delivery.deliveryNumber}
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-gray-500">Data</p>
                        <p className="font-medium">
                          {new Date(delivery.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      {delivery.driverName && (
                        <div>
                          <p className="text-gray-500">Motorista</p>
                          <p className="font-medium">{delivery.driverName}</p>
                        </div>
                      )}

                      {delivery.vehiclePlate && (
                        <div>
                          <p className="text-gray-500">Transportadora</p>
                          <p className="font-medium">{delivery.vehiclePlate}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-gray-500">Status</p>
                        <p
                          className={`font-medium ${
                            delivery.status === 'submitted'
                              ? 'text-green-600'
                              : 'text-orange-600'
                          }`}
                        >
                          {delivery.status === 'submitted' ? '✅ Enviada' : '⏳ Pendente'}
                        </p>
                      </div>

                      {delivery.arrivedAt && (
                        <div>
                          <p className="text-gray-500">Chegada</p>
                          <p className="font-medium">
                            {new Date(delivery.arrivedAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-gray-500">Documentos</p>
                        <p className="font-medium">
                          {delivery.documents
                            ? Object.values(delivery.documents).filter((d) => d).length
                            : 0}
                          /5
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => navigate(`/nova-entrega/${delivery._id}`)}
                      className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition"
                      title="Visualizar/Editar"
                    >
                      <FaEye />
                    </button>

                    {delivery.status === 'pending' && (
                      <button
                        onClick={() => handleDelete(delivery._id)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition"
                        title="Deletar"
                      >
                        <FaTrash />
                      </button>
                    )}
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
