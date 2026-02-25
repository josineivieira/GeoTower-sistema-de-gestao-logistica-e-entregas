import React, { useEffect, useState } from 'react';
import { adminService } from '../services/authService';

const colunas = [
  'Processo',
  'Recebedor',
  'Container',
  'Data Agendamento',
  'Contratado',
  'Motorista',
  'Status',
  'Data Retirada Cheio',
  'Chegada no Cliente',
  'Inicio',
  'Fim',
  'Docs',
  'Ações'
];

const BaseDadosGeral = () => {
  const [dados, setDados] = useState([]);
  const [deliveriesMap, setDeliveriesMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgramacoes = async () => {
      setLoading(true);
      try {
        // Buscar programações
        const progRes = await adminService.getProgramacoes();
        const programacoes = progRes.data.programacoes || [];
        
        // Buscar TODAS as entregas (via admin)
        const entrRes = await adminService.getDeliveries({});
        const entregas = entrRes.data.deliveries || [];
        
        // Mapear entregas por deliveryNumber (case-insensitive)
        const mapEntregas = {};
        entregas.forEach(e => {
          const key = (e.deliveryNumber || '').toUpperCase().trim();
          if (key) {
            mapEntregas[key] = e;
          }
        });
        
        // Enriquecer programações com dados de entregas
        const dadosEnriquecidos = programacoes.map(prog => {
          // Tenta encontrar a entrega por container ou processo
          const chaveContainer = (prog.container || '').toUpperCase().trim();
          const chaveProcesso = (prog.processo || '').toUpperCase().trim();
          
          const entrega = mapEntregas[chaveContainer] || mapEntregas[chaveProcesso];
          
          return {
            ...prog,
            _entrega: entrega || null
          };
        });
        
        setDados(dadosEnriquecidos);
        setDeliveriesMap(mapEntregas);
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
        setDados([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProgramacoes();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded shadow mt-8">
      <h1 className="text-2xl font-bold mb-6">Base de Dados Geral</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-xs">
          <thead>
            <tr>
              {colunas.map(col => (
                <th key={col} className="px-2 py-2 border-b bg-slate-100 text-left font-semibold">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colunas.length} className="text-center py-6">Carregando...</td></tr>
            ) : (
              dados.map((item, idx) => (
                <tr key={item._id || idx} className="hover:bg-slate-50">
                  <td className="border px-2 py-1">{item.processo}</td>
                  <td className="border px-2 py-1">{item.recebedor}</td>
                  <td className="border px-2 py-1">{item.container}</td>
                  <td className="border px-2 py-1">{item.dataAgendamento ? new Date(item.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                  <td className="border px-2 py-1">{item.contratado}</td>
                  <td className="border px-2 py-1">{item.motorista || (item._entrega?.driverName) || '-'}</td>
                  <td className="border px-2 py-1">{item.status}</td>
                  <td className="border px-2 py-1 text-xs">{item._entrega?.containerMontadoAt ? new Date(item._entrega.containerMontadoAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                  <td className="border px-2 py-1 text-xs">{item._entrega?.horarioChegada ? new Date(item._entrega.horarioChegada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : (item._entrega?.arrivedAt ? new Date(item._entrega.arrivedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-')}</td>
                  <td className="border px-2 py-1 text-xs">{item._entrega?.horarioInicioDesova ? new Date(item._entrega.horarioInicioDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : (item._entrega?.desovaStartAt ? new Date(item._entrega.desovaStartAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-')}</td>
                  <td className="border px-2 py-1 text-xs">{item._entrega?.horarioFimDesova ? new Date(item._entrega.horarioFimDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : (item._entrega?.desovaEndAt ? new Date(item._entrega.desovaEndAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-')}</td>
                  <td className="border px-2 py-1 text-xs">{item._entrega?.documentsJustification || '-'}</td>
                  <td className="border px-2 py-1">{/* Ações */}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BaseDadosGeral;
