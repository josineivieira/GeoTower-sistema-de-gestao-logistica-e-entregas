import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { FaArrowLeft, FaEdit, FaTrash, FaPlus, FaTruck } from 'react-icons/fa';

const MotoristaManagement = () => {
  const navigate = useNavigate();
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMotorista, setEditingMotorista] = useState(null);
  const [formData, setFormData] = useState({
    transportadora: '',
    nome: '',
    cpf: '',
    vinculo: 'AGREGADO',
    rastreador: '',
    expCadastroMotorista: '',
    cavalo: '',
    rastreadorCavalo: '',
    expCadastroCavalo: '',
    carreta: '',
    rastreadorCarreta: '',
    expCadastroCarreta: '',
    telefone: '',
    observacoes: ''
  });

  useEffect(() => {
    loadMotoristas();
  }, []);

  const loadMotoristas = async () => {
    try {
      setLoading(true);
      const response = await adminService.getMotoristas();
      const data = response.data.motoristas || [];
      const computeStatus = (exp) => {
        if (!exp) return '';
        const d = new Date(exp);
        return d >= new Date() ? 'A VENCER' : 'VENCIDO';
      };
      const enriched = data.map(m => ({
        ...m,
        statusMotorista: computeStatus(m.expCadastroMotorista),
        statusCavalo: computeStatus(m.expCadastroCavalo),
        statusCarreta: computeStatus(m.expCadastroCarreta)
      }));
      setMotoristas(enriched);
    } catch (error) {
      setToast({ message: 'Erro ao carregar motoristas', type: 'error' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.transportadora || !formData.nome || !formData.cpf || !formData.vinculo || !formData.telefone) {
      setToast({ message: 'Preencha todos os campos obrigatórios', type: 'error' });
      return;
    }

    try {
      if (editingMotorista) {
        await adminService.updateMotorista(editingMotorista._id, formData);
        setToast({ message: 'Motorista atualizado com sucesso', type: 'success' });
      } else {
        await adminService.createMotorista(formData);
        setToast({ message: 'Motorista criado com sucesso', type: 'success' });
      }
      setFormData({
        transportadora: '',
        nome: '',
        cpf: '',
        vinculo: 'AGREGADO',
        rastreador: '',
        expCadastroMotorista: '',
        cavalo: '',
        rastreadorCavalo: '',
        expCadastroCavalo: '',
        carreta: '',
        rastreadorCarreta: '',
        expCadastroCarreta: '',
        telefone: '',
        observacoes: ''
      });
      setEditingMotorista(null);
      setShowForm(false);
      loadMotoristas();
    } catch (error) {
      setToast({ message: error.response?.data?.message || 'Erro ao salvar motorista', type: 'error' });
    }
  };

  const handleEdit = (motorista) => {
    setEditingMotorista(motorista);
    setFormData({
      transportadora: motorista.transportadora,
      nome: motorista.nome,
      cpf: motorista.cpf,
      vinculo: motorista.vinculo,
      rastreador: motorista.rastreador || '',
      expCadastroMotorista: motorista.expCadastroMotorista ? motorista.expCadastroMotorista.split('T')[0] : '',
      cavalo: motorista.cavalo || '',
      rastreadorCavalo: motorista.rastreadorCavalo || '',
      expCadastroCavalo: motorista.expCadastroCavalo ? motorista.expCadastroCavalo.split('T')[0] : '',
      carreta: motorista.carreta || '',
      rastreadorCarreta: motorista.rastreadorCarreta || '',
      expCadastroCarreta: motorista.expCadastroCarreta ? motorista.expCadastroCarreta.split('T')[0] : '',
      telefone: motorista.telefone,
      observacoes: motorista.observacoes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (motoristaId) => {
    if (window.confirm('Tem certeza que deseja deletar este motorista?')) {
      try {
        await adminService.deleteMotorista(motoristaId);
        setToast({ message: 'Motorista deletado com sucesso', type: 'success' });
        loadMotoristas();
      } catch (error) {
        setToast({ message: 'Erro ao deletar motorista', type: 'error' });
      }
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingMotorista(null);
    setFormData({
      transportadora: '',
      nome: '',
      cpf: '',
      vinculo: 'AGREGADO',
      rastreador: '',
      expCadastroMotorista: '',
      cavalo: '',
      rastreadorCavalo: '',
      expCadastroCavalo: '',
      carreta: '',
      rastreadorCarreta: '',
      expCadastroCarreta: '',
      telefone: '',
      observacoes: ''
    });
  };

  const formatCPF = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/home')}
              className="p-2 hover:bg-gray-200 rounded-lg transition"
              title="Voltar"
            >
              <FaArrowLeft className="text-xl text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <FaTruck className="text-blue-600" />
                Cadastro de Motoristas
              </h1>
              <p className="text-gray-600 mt-1">Gerencie os motoristas da sua frota</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            <FaPlus /> Novo Motorista
          </button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingMotorista ? 'Editar Motorista' : 'Novo Motorista'}
                </h2>
                <button
                  onClick={handleCloseForm}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Transportadora *
                    </label>
                    <input
                      type="text"
                      value={formData.transportadora}
                      onChange={(e) => setFormData({ ...formData, transportadora: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: GEO TRANSPORTES"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nome do Motorista *
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: João Silva"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      CPF *
                    </label>
                    <input
                      type="text"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="000.000.000-00"
                      maxLength="14"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Vínculo *
                    </label>
                    <select
                      value={formData.vinculo}
                      onChange={(e) => setFormData({ ...formData, vinculo: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PRÓPRIO">PRÓPRIO</option>
                      <option value="AGREGADO">AGREGADO</option>
                      <option value="TERCEIRO">TERCEIRO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Rastreador
                    </label>
                    <input
                      type="text"
                      value={formData.rastreador}
                      onChange={(e) => setFormData({ ...formData, rastreador: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: SASCAR"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Exp. cadastro motorista
                    </label>
                    <input
                      type="date"
                      value={formData.expCadastroMotorista}
                      onChange={(e) => setFormData({ ...formData, expCadastroMotorista: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cavalo
                    </label>
                    <input
                      type="text"
                      value={formData.cavalo}
                      onChange={(e) => setFormData({ ...formData, cavalo: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Rastreador do cavalo
                    </label>
                    <input
                      type="text"
                      value={formData.rastreadorCavalo}
                      onChange={(e) => setFormData({ ...formData, rastreadorCavalo: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Exp. cadastro cavalo
                    </label>
                    <input
                      type="date"
                      value={formData.expCadastroCavalo}
                      onChange={(e) => setFormData({ ...formData, expCadastroCavalo: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Carreta
                    </label>
                    <input
                      type="text"
                      value={formData.carreta}
                      onChange={(e) => setFormData({ ...formData, carreta: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Rastreador da carreta
                    </label>
                    <input
                      type="text"
                      value={formData.rastreadorCarreta}
                      onChange={(e) => setFormData({ ...formData, rastreadorCarreta: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Exp. cadastro carreta
                    </label>
                    <input
                      type="date"
                      value={formData.expCadastroCarreta}
                      onChange={(e) => setFormData({ ...formData, expCadastroCarreta: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Telefone *
                    </label>
                    <input
                      type="text"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(92) 98765-4321"
                      maxLength="15"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows="3"
                    placeholder="Digite observações adicionais..."
                  />
                </div>

                <div className="flex gap-4 pt-4 border-t">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    {editingMotorista ? 'Atualizar' : 'Criar'} Motorista
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="flex-1 px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Motoristas Table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-gray-600 mt-4">Carregando motoristas...</p>
          </div>
        ) : motoristas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <FaTruck className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhum motorista cadastrado</h3>
            <p className="text-gray-600">Clique em "Novo Motorista" para começar</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Transportadora</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Motorista</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">CPF</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Vínculo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Rastreador</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Exp. cadastro</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Cavalo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Rastreador Cav.</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Exp. cadastro Cavalo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Carreta</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Rastreador Carreta</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Exp. cadastro Carreta</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Telefone</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {motoristas.map((motorista) => (
                    <tr key={motorista._id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{motorista.transportadora}</td>
                      <td className="px-6 py-3 text-gray-700">{motorista.nome}</td>
                      <td className="px-6 py-3 text-gray-700">{motorista.cpf}</td>
                      <td className="px-6 py-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          motorista.vinculo === 'PRÓPRIO'
                            ? 'bg-green-100 text-green-800'
                            : motorista.vinculo === 'AGREGADO'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {motorista.vinculo}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-700">{motorista.rastreador || '-'}</td>
                      <td className="px-6 py-3 text-gray-700">
                        {motorista.expCadastroMotorista
                          ? new Date(motorista.expCadastroMotorista).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          motorista.statusMotorista === 'VENCIDO'
                            ? 'bg-red-100 text-red-800'
                            : motorista.statusMotorista === 'A VENCER'
                            ? 'bg-yellow-100 text-yellow-800'
                            : ''
                        }`}>
                          {motorista.statusMotorista || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-700">{motorista.cavalo || '-'}</td>
                      <td className="px-6 py-3 text-gray-700">{motorista.rastreadorCavalo || '-'}</td>
                      <td className="px-6 py-3 text-gray-700">
                        {motorista.expCadastroCavalo
                          ? new Date(motorista.expCadastroCavalo).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          motorista.statusCavalo === 'VENCIDO'
                            ? 'bg-red-100 text-red-800'
                            : motorista.statusCavalo === 'A VENCER'
                            ? 'bg-yellow-100 text-yellow-800'
                            : ''
                        }`}>
                          {motorista.statusCavalo || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-700">{motorista.carreta || '-'}</td>
                      <td className="px-6 py-3 text-gray-700">{motorista.rastreadorCarreta || '-'}</td>
                      <td className="px-6 py-3 text-gray-700">
                        {motorista.expCadastroCarreta
                          ? new Date(motorista.expCadastroCarreta).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          motorista.statusCarreta === 'VENCIDO'
                            ? 'bg-red-100 text-red-800'
                            : motorista.statusCarreta === 'A VENCER'
                            ? 'bg-yellow-100 text-yellow-800'
                            : ''
                        }`}>
                          {motorista.statusCarreta || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-700">{motorista.telefone}</td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleEdit(motorista)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition mr-2"
                        >
                          <FaEdit /> Editar
                        </button>
                        <button
                          onClick={() => handleDelete(motorista._id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
                        >
                          <FaTrash /> Deletar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default MotoristaManagement;
