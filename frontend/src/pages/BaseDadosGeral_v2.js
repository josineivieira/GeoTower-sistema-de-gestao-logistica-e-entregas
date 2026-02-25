import React, { useEffect, useState } from 'react';
import { adminService } from '../services/authService';
import { FaEdit, FaTrash, FaTimes, FaPlus } from 'react-icons/fa';
import Toast from '../components/Toast';

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
  'Observações',
  'Obs Submissão',
  'Ações'
];

const BaseDadosGeral = () => {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    processo: '',
    recebedor: '',
    container: '',
    dataAgendamento: '',
    contratado: '',
    motorista: '',
    status: 'AGENDADO'
  });

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
        if (key) {
          mapEntregas[key] = e;
        }
      });
      
      const dadosEnriquecidos = programacoes.map(prog => {
        const chaveContainer = (prog.container || '').toUpperCase().trim();
        const chaveProcesso = (prog.processo || '').toUpperCase().trim();
        const entrega = mapEntregas[chaveContainer] || mapEntregas[chaveProcesso];
        
        return { ...prog, _entrega: entrega || null };
      });
      
      setDados(dadosEnriquecidos);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setToast({ message: 'Erro ao carregar dados', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleEdit = (item) => {
    setEditingId(item._id);
    setFormData({
      processo: item.processo,
      recebedor: item.recebedor,
      container: item.container,
      dataAgendamento: item.dataAgendamento || '',
      contratado: item.contratado,
      motorista: item.motorista || '',
      status: item.status
    });
  };

  const handleSave = async () => {
    if (!formData.processo || !formData.recebedor || !formData.dataAgendamento || !formData.contratado) {
      setToast({ message: 'Preencha os campos obrigatórios', type: 'error' });
      return;
    }

    try {
      await adminService.updateProgramacao(editingId, formData);
      setToast({ message: 'Programação atualizada com sucesso', type: 'success' });
      setEditingId(null);
      carregarDados();
    } catch (err) {
      setToast({ message: 'Erro ao atualizar', type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar esta programação?')) {
      try {
        await adminService.deleteProgramacao(id);
        setToast({ message: 'Programação deletada com sucesso', type: 'success' });
        carregarDados();
      } catch (err) {
        setToast({ message: 'Erro ao deletar', type: 'error' });
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      processo: '',
      recebedor: '',
      container: '',
      dataAgendamento: '',
      contratado: '',
      motorista: '',
      status: 'AGENDADO'
    });
  };

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
            ) : dados.length === 0 ? (
              <tr><td colSpan={colunas.length} className="text-center py-6 text-gray-500">Nenhuma programação encontrada</td></tr>
            ) : (
              dados.map((item) => (
                <tr key={item._id} className="hover:bg-slate-50 border-b">
                  <td className="border px-2 py-1">{item.processo}</td>
                  <td className="border px-2 py-1">{item.recebedor}</td>
                  <td className="border px-2 py-1">{item.container || '-'}</td>
                  <td className="border px-2 py-1 text-xs">{item.dataAgendamento ? new Date(item.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                  <td className="border px-2 py-1">{item.contratado}</td>
                  <td className="border px-2 py-1">{item.motorista || (item._entrega?.driverName) || '-'}</td>
                  <td className="border px-2 py-1">{item.status}</td>
                  <td className="border px-2 py-1 text-xs">{item._entrega?.containerMontadoAt ? new Date(item._entrega.containerMontadoAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                  <td className="border px-2 py-1 text-xs">{item._entrega?.horarioChegada ? new Date(item._entrega.horarioChegada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : (item._entrega?.arrivedAt ? new Date(item._entrega.arrivedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-')}</td>
                  <td className="border px-2 py-1 text-xs">{item._entrega?.horarioInicioDesova ? new Date(item._entrega.horarioInicioDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : (item._entrega?.desovaStartAt ? new Date(item._entrega.desovaStartAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-')}</td>
                  <td className="border px-2 py-1 text-xs">{item._entrega?.horarioFimDesova ? new Date(item._entrega.horarioFimDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : (item._entrega?.desovaEndAt ? new Date(item._entrega.desovaEndAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-')}</td>
                  <td className="border px-2 py-1 text-xs">{item._entrega?.documentsJustification || '-'}</td>
                  <td className="border px-2 py-1 text-xs max-w-xs truncate" title={item._entrega?.observations}>{item._entrega?.observations || '-'}</td>
                  <td className="border px-2 py-1 text-xs max-w-xs truncate" title={item._entrega?.submissionObservation}>{item._entrega?.submissionObservation || '-'}</td>
                  <td className="border px-2 py-1 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800" title="Editar">
                        <FaEdit />
                      </button>
                      <button onClick={() => handleDelete(item._id)} className="text-red-600 hover:text-red-800" title="Deletar">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Edição */}
      {editingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Editar Programação</h2>
              <button onClick={handleCancel} className="text-gray-500 hover:text-gray-800">
                <FaTimes size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Processo *</label>
                <input type="text" value={formData.processo} onChange={(e) => setFormData({...formData, processo: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Recebedor *</label>
                <input type="text" value={formData.recebedor} onChange={(e) => setFormData({...formData, recebedor: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Container</label>
                <input type="text" value={formData.container} onChange={(e) => setFormData({...formData, container: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Data Agendamento *</label>
                <input type="datetime-local" value={formData.dataAgendamento} onChange={(e) => setFormData({...formData, dataAgendamento: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Contratado *</label>
                <input type="text" value={formData.contratado} onChange={(e) => setFormData({...formData, contratado: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Motorista</label>
                <input type="text" value={formData.motorista} onChange={(e) => setFormData({...formData, motorista: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="AGENDADO">AGENDADO</option>
                  <option value="EM_ROTA">EM_ROTA</option>
                  <option value="ENTREGUE">ENTREGUE</option>
                  <option value="CANCELADO">CANCELADO</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
                Salvar
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
