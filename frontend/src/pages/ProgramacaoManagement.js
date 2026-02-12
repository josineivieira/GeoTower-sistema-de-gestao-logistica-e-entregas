import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/authService';
import { FaArrowLeft, FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import '../styles/MotoristaManagement.css';

const ProgramacaoManagement = () => {
  const navigate = useNavigate();
  const [programacoes, setProgramacoes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    processo: '',
    recebedor: '',
    container: '',
    dataAgendamento: '',
    contratado: 'GEO',
    motorista: '',
    status: 'AGENDADO',
    observacoes: ''
  });

  useEffect(() => {
    loadProgramacoes();
  }, []);

  const loadProgramacoes = async () => {
    try {
      setLoading(true);
      const response = await adminService.getProgramacoes();
      setProgramacoes(response.data.programacoes || []);
    } catch (err) {
      showToast('Erro ao carregar programações', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setFormData({
      processo: '',
      recebedor: '',
      container: '',
      dataAgendamento: '',
      contratado: 'GEO',
      motorista: '',
      status: 'AGENDADO',
      observacoes: ''
    });
    setEditingId(null);
  };

  const handleOpen = (programacao = null) => {
    if (programacao) {
      setEditingId(programacao._id);
      setFormData({
        processo: programacao.processo,
        recebedor: programacao.recebedor,
        container: programacao.container || '',
        dataAgendamento: programacao.dataAgendamento ? programacao.dataAgendamento.split('T')[0] : '',
        contratado: programacao.contratado,
        motorista: programacao.motorista || '',
        status: programacao.status,
        observacoes: programacao.observacoes || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.processo || !formData.recebedor || !formData.dataAgendamento || !formData.contratado) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
      }

      if (editingId) {
        await adminService.updateProgramacao(editingId, formData);
        showToast('Programação atualizada com sucesso');
      } else {
        await adminService.createProgramacao(formData);
        showToast('Programação criada com sucesso');
      }

      setShowModal(false);
      resetForm();
      loadProgramacoes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Erro ao salvar', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar esta programação?')) {
      try {
        await adminService.deleteProgramacao(id);
        showToast('Programação deletada com sucesso');
        loadProgramacoes();
      } catch (err) {
        showToast('Erro ao deletar', 'error');
      }
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      AGENDADO: '#3b82f6',
      EM_ROTA: '#f59e0b',
      ENTREGUE: '#10b981',
      CANCELADO: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getContratadoColor = (contratado) => {
    const colors = {
      GEO: '#8b5cf6',
      MACHADO: '#ec4899',
      BANDEIRA: '#14b8a6',
      TRANSCAVALCANTE: '#f97316',
      OUTRO: '#6b7280'
    };
    return colors[contratado] || '#6b7280';
  };

  return (
    <div className="motorista-management">
      <div className="motorista-header">
        <button onClick={() => navigate('/home')} className="back-button">
          <FaArrowLeft /> Voltar
        </button>
        <h1>📅 Programação de Entregas</h1>
        <button onClick={() => handleOpen()} className="create-button">
          <FaPlus /> Nova Programação
        </button>
      </div>

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="loading">Carregando programações...</div>
      ) : (
        <div className="table-container">
          <table className="motorista-table">
            <thead>
              <tr>
                <th>Processo</th>
                <th>Recebedor</th>
                <th>Container</th>
                <th>Data</th>
                <th>Contratado</th>
                <th>Motorista</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {programacoes.map((prog) => (
                <tr key={prog._id}>
                  <td className="processo">{prog.processo}</td>
                  <td>{prog.recebedor}</td>
                  <td>{prog.container}</td>
                  <td>
                    {new Date(prog.dataAgendamento).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{ backgroundColor: getContratadoColor(prog.contratado) }}
                    >
                      {prog.contratado}
                    </span>
                  </td>
                  <td>{prog.motorista}</td>
                  <td>
                    <span
                      className="badge"
                      style={{ backgroundColor: getStatusColor(prog.status) }}
                    >
                      {prog.status}
                    </span>
                  </td>
                  <td className="actions">
                    <button
                      onClick={() => handleOpen(prog)}
                      className="edit-btn"
                      title="Editar"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(prog._id)}
                      className="delete-btn"
                      title="Deletar"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Editar Programação' : 'Nova Programação'}</h2>
              <button onClick={() => setShowModal(false)} className="close-button">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Processo *</label>
                <input
                  type="text"
                  value={formData.processo}
                  onChange={(e) => setFormData({ ...formData, processo: e.target.value })}
                  placeholder="CAB42196"
                />
              </div>

              <div className="form-group">
                <label>Recebedor *</label>
                <input
                  type="text"
                  value={formData.recebedor}
                  onChange={(e) => setFormData({ ...formData, recebedor: e.target.value })}
                  placeholder="Nome do recebedor"
                />
              </div>

              <div className="form-group">
                <label>Container</label>
                <input
                  type="text"
                  value={formData.container}
                  onChange={(e) => setFormData({ ...formData, container: e.target.value })}
                  placeholder="Ex: UETU6510024"
                />
              </div>

              <div className="form-group">
                <label>Data Agendamento *</label>
                <input
                  type="datetime-local"
                  value={formData.dataAgendamento}
                  onChange={(e) => setFormData({ ...formData, dataAgendamento: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Contratado *</label>
                <select
                  value={formData.contratado}
                  onChange={(e) => setFormData({ ...formData, contratado: e.target.value })}
                >
                  <option value="GEO">GEO</option>
                  <option value="MACHADO">MACHADO</option>
                  <option value="BANDEIRA">BANDEIRA</option>
                  <option value="TRANSCAVALCANTE">TRANSCAVALCANTE</option>
                  <option value="OUTRO">OUTRO</option>
                </select>
              </div>

              <div className="form-group">
                <label>Motorista</label>
                <input
                  type="text"
                  value={formData.motorista}
                  onChange={(e) => setFormData({ ...formData, motorista: e.target.value })}
                  placeholder="Nome do motorista"
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="AGENDADO">AGENDADO</option>
                  <option value="EM_ROTA">EM_ROTA</option>
                  <option value="ENTREGUE">ENTREGUE</option>
                  <option value="CANCELADO">CANCELADO</option>
                </select>
              </div>

              <div className="form-group">
                <label>Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Anotações adicionais..."
                  rows="3"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="cancel-btn">
                Cancelar
              </button>
              <button onClick={handleSave} className="save-btn">
                {editingId ? 'Atualizar' : 'Criar'} Programação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramacaoManagement;
