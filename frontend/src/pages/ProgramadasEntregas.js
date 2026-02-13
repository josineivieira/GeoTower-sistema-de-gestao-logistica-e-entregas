import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { deliveryService } from '../services/authService';
import { FaArrowLeft, FaCalendarAlt, FaSearch } from 'react-icons/fa';
import { useAuth } from '../services/authContext';

const ProgramadasEntregas = () => {
  const navigate = useNavigate();
  const [programacoes, setProgramacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    loadProgramacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProgramacoes = async () => {
    setLoading(true);
    try {
      const res = await deliveryService.getProgramacoesAssigned();
      setProgramacoes(res.data.programacoes || []);
    } catch (err) {
      console.error('Erro ao buscar programações:', err);
      setToast({ message: 'Erro ao carregar entregas programadas', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartDelivery = async (p) => {
    // Use container as deliveryNumber if available, fallback to processo
    const deliveryNumber = (p.container && p.container.trim()) || (p.processo && p.processo.trim());
    if (!deliveryNumber) {
      setToast({ message: 'Não foi possível iniciar: sem número de container/processo', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        deliveryNumber: deliveryNumber.toUpperCase(),
        vehiclePlate: '',
        observations: `Criada a partir da Programação ${p.processo || ''}`,
        driverName: user?.fullName || user?.name || ''
      };

      const res = await deliveryService.createDelivery(payload);
      const newDelivery = res.data.delivery;
      setToast({ message: 'Entrega iniciada', type: 'success' });
      // Redirect to new screen showing arrival button
      if (newDelivery && newDelivery._id) {
        navigate(`/entrega/${newDelivery._id}`);
      }
    } catch (err) {
      console.error('Erro ao iniciar entrega:', err);
      setToast({ message: err.response?.data?.message || 'Erro ao iniciar entrega', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100">
      <div className="max-w-6xl mx-auto p-4 pb-20">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-semibold mb-6 transition"
        >
          <FaArrowLeft />
          Voltar
        </button>

        <h2 className="text-3xl font-bold text-gray-800 mb-6">Entregas Programadas</h2>

        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto" />
          </div>
        ) : programacoes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 text-lg mb-4">Nenhuma entrega programada encontrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {programacoes.map((p) => (
              <div key={p._id} className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Processo: {p.processo}</h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-gray-500">Data Agendamento</p>
                        <p className="font-medium">{p.dataAgendamento ? new Date(p.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Recebedor</p>
                        <p className="font-medium">{p.recebedor || '-'}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Container</p>
                        <p className="font-medium">{p.container || '-'}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Status</p>
                        <p className="font-medium">{p.status || '-'}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Contratado</p>
                        <p className="font-medium">{p.contratado || '-'}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Motorista</p>
                        <p className="font-medium">{p.motorista || '-'}</p>
                      </div>
                    </div>
                  </div>

                    <div className="flex gap-2 ml-4">
                      
                      <button
                        onClick={() => handleStartDelivery(p)}
                        className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition font-semibold"
                        title="Iniciar Entrega"
                      >
                        Iniciar Entrega
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

export default ProgramadasEntregas;
