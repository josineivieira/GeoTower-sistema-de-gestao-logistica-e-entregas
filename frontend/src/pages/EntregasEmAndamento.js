import React, { useEffect, useState } from 'react';
import { deliveryService } from '../services/authService';
import { useAuth } from '../services/authContext';
import Toast from '../components/Toast';

export default function EntregasEmAndamento() {
  const { user } = useAuth();
  const [programacoes, setProgramacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadProgramacoes();
    // eslint-disable-next-line
  }, [user]);

  const loadProgramacoes = async () => {
    setLoading(true);
    try {
      const res = await deliveryService.getProgramacoesAssigned();
      const todas = res.data.programacoes || [];
      let nomeFiltro = '';
      if (user) {
        nomeFiltro = (user.username || user.name || '').trim().toUpperCase();
      }
      // Filtra entregas com status diferente de AGENDADO
      setProgramacoes(todas.filter(p => String(p.contratado).trim().toUpperCase() === nomeFiltro && p.status !== 'AGENDADO'));
    } catch (err) {
      setToast({ message: 'Erro ao carregar entregas em andamento', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h2 className="text-2xl font-bold mb-4">Entregas em Andamento</h2>
      {toast && <Toast message={toast.message} type={toast.type} />}
      {loading ? (
        <div>Carregando...</div>
      ) : programacoes.length === 0 ? (
        <div className="bg-white p-4 rounded shadow text-center">Nenhuma entrega em andamento encontrada</div>
      ) : (
        programacoes.map((p, idx) => (
          <div key={idx} className="bg-white p-4 rounded shadow mb-4">
            <div className="mb-2 font-semibold">Processo: {p.processo}</div>
            <div>Data Agendamento: {new Date(p.dataAgendamento).toLocaleString()}</div>
            <div>Recebedor: {p.recebedor}</div>
            <div>Container: {p.container}</div>
            <div>Status: <span className="font-bold text-blue-600">{p.status}</span></div>
            <div>Contratado: {p.contratado}</div>
            <div>Motorista: {p.motorista || '-'}</div>
          </div>
        ))
      )
    </div>
	);
}
