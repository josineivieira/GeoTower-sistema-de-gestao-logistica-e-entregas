import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/authService';
import { FaArrowLeft, FaPlus, FaEdit, FaTrash, FaFileDownload, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import '../styles/MotoristaManagement.css';

const ProgramacaoManagement = () => {
  const navigate = useNavigate();
  const [programacoes, setProgramacoes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

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

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportLoading(true);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);

      if (data.length === 0) {
        showToast('Planilha vazia', 'error');
        return;
      }

      // Mapear e validar dados
      const programacoesImport = data.map((row, index) => {
        const processo = String(row['Processo'] || '').trim();
        const recebedor = String(row['Recebedor'] || '').trim();
        const container = String(row['Container'] || '').trim();
        const dataStr = String(row['Data Agendamento'] || '').trim();
        const contratado = String(row['Contratado'] || 'GEO').trim();
        const motorista = String(row['Motorista'] || '').trim();
        const status = String(row['Status'] || 'AGENDADO').trim();
        const observacoes = String(row['Observações'] || '').trim();

        // Converter data do Excel para formato ISO
        let dataAgendamento = '';
        if (dataStr) {
          try {
            // Se for número (Excel date serial)
            if (!isNaN(dataStr)) {
              const excelDate = new Date((parseInt(dataStr) - 25569) * 86400 * 1000);
              dataAgendamento = excelDate.toISOString().slice(0, 16);
            } else {
              // Se for string, tenta parsear DD/MM/YYYY ou DD/MM/YYYY HH:MM
              const parts = dataStr.split(' ');
              const dateParts = parts[0].split('/');
              if (dateParts.length === 3) {
                const day = dateParts[0];
                const month = dateParts[1];
                const year = dateParts[2];
                const time = parts[1] || '00:00';
                const date = new Date(`${year}-${month}-${day}T${time}`);
                dataAgendamento = date.toISOString().slice(0, 16);
              }
            }
          } catch (err) {
            console.error(`Erro ao converter data na linha ${index + 2}:`, err);
          }
        }

        return {
          processo,
          recebedor,
          container,
          dataAgendamento,
          contratado: contratado || 'GEO',
          motorista,
          status: status || 'AGENDADO',
          observacoes
        };
      });

      // Validar campos obrigatórios
      const erros = [];
      programacoesImport.forEach((prog, index) => {
        if (!prog.processo) erros.push(`Linha ${index + 2}: Processo obrigatório`);
        if (!prog.recebedor) erros.push(`Linha ${index + 2}: Recebedor obrigatório`);
        if (!prog.dataAgendamento) erros.push(`Linha ${index + 2}: Data Agendamento obrigatória`);
        if (!prog.contratado) erros.push(`Linha ${index + 2}: Contratado obrigatório`);
      });

      if (erros.length > 0) {
        showToast(`Erros na planilha: ${erros.slice(0, 3).join(', ')}${erros.length > 3 ? '...' : ''}`, 'error');
        return;
      }

      // Enviar para o backend
      const response = await adminService.importProgramacoes(programacoesImport);
      showToast(`${response.data.importados} programações importadas com sucesso`);
      setShowImportModal(false);
      loadProgramacoes();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Erro ao importar arquivo', 'error');
    } finally {
      setImportLoading(false);
      event.target.value = '';
    }
  };

  const downloadTemplate = () => {
    try {
      const template = [
        {
          'Processo': 'CAB42196',
          'Recebedor': 'AMERICANA DIST. BEBIDAS',
          'Container': 'ECMU4814297',
          'Data Agendamento': '12/02/2026 10:00',
          'Contratado': 'GEO',
          'Motorista': 'JOÃO SILVA',
          'Status': 'AGENDADO',
          'Observações': ''
        }
      ];

      const ws = XLSX.utils.json_to_sheet(template);
      ws['!cols'] = [
        { wch: 15 },
        { wch: 30 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 30 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Programações');
      XLSX.writeFile(wb, 'template_programacoes.xlsx');
      showToast('Template baixado com sucesso');
    } catch (err) {
      showToast('Erro ao gerar template', 'error');
      console.error(err);
    }
  };

  return (
    <div className="motorista-management">
      <div className="motorista-header">
        <button onClick={() => navigate('/home')} className="back-button">
          <FaArrowLeft /> Voltar
        </button>
        <h1>📅 Programação de Entregas</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowImportModal(true)} className="create-button" style={{ backgroundColor: '#059669', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaFileExcel /> Importar Excel
          </button>
          <button onClick={() => handleOpen()} className="create-button">
            <FaPlus /> Nova Programação
          </button>
        </div>
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

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Importar Programações do Excel</h2>
              <button onClick={() => setShowImportModal(false)} className="close-button">
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '30px', textAlign: 'center' }}>
              <FaFileExcel style={{ fontSize: '48px', color: '#059669', marginBottom: '20px' }} />
              
              <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>Selecione um arquivo Excel</h3>
              
              <p style={{ marginBottom: '20px', color: '#6b7280', fontSize: '14px' }}>
                A planilha deve conter as colunas: <strong>Processo, Recebedor, Container, Data Agendamento, Contratado, Motorista, Status, Observações</strong>
              </p>

              <button
                onClick={downloadTemplate}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FaFileDownload /> Baixar Template
              </button>

              <label style={{
                display: 'block',
                padding: '20px',
                backgroundColor: '#f0fdf4',
                border: '2px dashed #059669',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportFile}
                  disabled={importLoading}
                  style={{ display: 'none' }}
                />
                <FaFileDownload style={{ fontSize: '32px', color: '#059669', marginBottom: '10px' }} />
                <div style={{ color: '#059669', fontWeight: '500' }}>
                  {importLoading ? 'Importando...' : 'Clique ou arraste o arquivo aqui'}
                </div>
              </label>

              <p style={{ marginTop: '20px', fontSize: '12px', color: '#9ca3af' }}>
                Formatos suportados: .xlsx, .xls, .csv
              </p>
            </div>

            <div className="modal-footer">
              <button 
                onClick={() => setShowImportModal(false)} 
                className="cancel-btn"
                disabled={importLoading}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramacaoManagement;
