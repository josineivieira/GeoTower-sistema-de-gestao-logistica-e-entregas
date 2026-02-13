import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { deliveryService } from '../services/authService';

const EntregaEmRota = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadDelivery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadDelivery = async () => {
    setLoading(true);
    try {
      const res = await deliveryService.getDelivery(id);
      setDelivery(res.data.delivery);
    } catch (err) {
      console.error('Erro ao buscar entrega', err);
      setToast({ message: 'Erro ao carregar entrega', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleArrival = async () => {
    if (!delivery) return;
    setSubmitting(true);
    try {
      const payload = {
        arrivedAt: new Date().toISOString()
        // we could also update status here if desired
      };
      await deliveryService.updateDelivery(id, payload);
      setToast({ message: 'Hora de chegada registrada', type: 'success' });
      // refresh data or navigate away
      navigate('/minhas-entregas');
    } catch (err) {
      console.error('Erro ao registrar chegada', err);
      setToast({ message: 'Erro ao registrar chegada', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto" />
      </div>
    );
  }

  if (!delivery) {
    return <p>Entrega não encontrada.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Entrega em andamento</h1>
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <p><strong>Container / Número:</strong> {delivery.deliveryNumber}</p>
        <p><strong>Observações:</strong> {delivery.observations || '-'}</p>
        {delivery.arrivedAt && (
          <p><strong>Chegada registrada:</strong>{' '}{new Date(delivery.arrivedAt).toLocaleString('pt-BR')}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleArrival}
          disabled={submitting || !!delivery.arrivedAt}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {delivery.arrivedAt ? 'Já marcou chegada' : 'Chegada no cliente'}
        </button>
        <button
          onClick={() => navigate(`/nova-entrega/${id}`)}
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
        >
          Ver / editar entrega
        </button>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default EntregaEmRota;
