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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgramacoes = async () => {
      setLoading(true);
      try {
        const res = await adminService.getProgramacoes();
        setDados(res.data.programacoes || []);
      } catch (err) {
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
                  <td className="border px-2 py-1">{item.dataAgendamento}</td>
                  <td className="border px-2 py-1">{item.contratado}</td>
                  <td className="border px-2 py-1">{item.motorista}</td>
                  <td className="border px-2 py-1">{item.status}</td>
                  <td className="border px-2 py-1">{/* Data Retirada Cheio */}</td>
                  <td className="border px-2 py-1">{/* Chegada no Cliente */}</td>
                  <td className="border px-2 py-1">{/* Inicio */}</td>
                  <td className="border px-2 py-1">{/* Fim */}</td>
                  <td className="border px-2 py-1">{/* Docs */}</td>
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
