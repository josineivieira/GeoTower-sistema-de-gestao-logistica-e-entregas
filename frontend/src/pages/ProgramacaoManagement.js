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
  const [motoristasList, setMotoristasList] = useState([]);
  // compute contrato options by merging fixed options with transportadoras from motoristas
  const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, '').trim();

  const getContratadosOptions = () => {
    const fixed = ['GEO', 'MACHADO', 'BANDEIRA', 'TRANSCAVALCANTE', 'OUTRO'];
    const fromMotoristas = Array.from(new Set((motoristasList || []).map(m => (m.transportadora || '').trim()).filter(Boolean)));
    // Merge preserving fixed first, then others (excluding duplicates case-insensitively)
    const merged = [...fixed];
    fromMotoristas.forEach((t) => {
      if (!merged.some(x => normalize(x) === normalize(t))) merged.push(t);
    });
    return merged;
  };

  useEffect(() => {
    loadProgramacoes();
    loadAllMotoristas();
  }, []);

  const loadAllMotoristas = async () => {
    try {
      const res = await adminService.getMotoristas();
      const list = res.data.motoristas || [];
      setMotoristasList(list);
    } catch (err) {
      console.error('Erro ao carregar motoristas', err);
    }
  };

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

      console.log('📋 Colunas encontradas na planilha:', Object.keys(data[0]));

      // Função para normalizar nomes de colunas (remove acentos, maiúsculas, espaços)
      const normalizeColumnName = (name) => {
        if (!name) return '';
        return String(name)
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/[^\w\s]/g, '') // Remove caracteres especiais
          .replace(/\s+/g, ''); // Remove espaços
      };

      // Mapeamento com variações de nomes de colunas esperadas
      const columnMapping = {
        processo: ['processo', 'process'],
        recebedor: ['recebedor', 'receiver'], // APENAS recebedor, não cliente!
        container: ['container', 'ncontainer', 'nrcontainer', 'nmcontainer', 'nrvi'],
        dataAgendamento: ['dtagendamento', 'dataagendamento', 'agendamento', 'data', 'dtagen', 'datasched'],
        contratado: ['contratado', 'transportadora', 'empresa', 'carrier'],
        motorista: ['motorista', 'driver', 'motoristaviagem', 'nombremotorista'],
        status: ['status', 'situacao', 'situation']
      };

      // Encontrar mapeamento de colunas mais inteligentemente
      const firstRow = data[0];
      const actualColumns = {};
      const availableColumns = Object.keys(firstRow);

      console.log('🔍 Iniciando busca inteligente de colunas...');

      Object.keys(columnMapping).forEach((expectedCol) => {
        let found = false;

        // Procura 1: Match exato normalizado
        for (const key of availableColumns) {
          const normalizedKey = normalizeColumnName(key);
          if (columnMapping[expectedCol].includes(normalizedKey)) {
            actualColumns[expectedCol] = key;
            console.log(`  ✓ ${expectedCol} encontrado: "${key}" (match exato)`);
            found = true;
            break;
          }
        }

        // Procura 2: Substring normalizadas
        if (!found) {
          for (const key of availableColumns) {
            const normalizedKey = normalizeColumnName(key);
            for (const variation of columnMapping[expectedCol]) {
              if (normalizedKey.includes(variation) || variation.includes(normalizedKey)) {
                actualColumns[expectedCol] = key;
                console.log(`  ✓ ${expectedCol} encontrado: "${key}" (substring match)`);
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }

        if (!found) {
          console.log(`  ✗ ${expectedCol} NÃO encontrado (coluna obrigatória)`);
        }
      });

      console.log('📊 Mapeamento final:', actualColumns);

      // Função para mapear contratado - aceita qualquer contratado com busca case-insensitive
      const mapearContratado = (valor) => {
        const raw = String(valor || '').trim();
        if (!raw) return 'OUTRO';

        const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, '').trim();
        const target = normalize(raw);

        // Try to find a matching transportadora from motoristas list (best effort)
        try {
          const options = Array.from(new Set((motoristasList || []).map(m => (m.transportadora || '').trim()).filter(Boolean)));
          for (const opt of options) {
            const on = normalize(opt);
            if (!on) continue;
            if (on === target || on.includes(target) || target.includes(on)) {
              console.log(`  Contratado mapeado via motoristas: "${valor}" → "${opt}"`);
              return opt;
            }
            // token overlap
            const ot = on.split(/\s+/).filter(Boolean);
            const tt = target.split(/\s+/).filter(Boolean);
            if (ot.some(tok => tt.includes(tok)) || tt.some(tok => ot.includes(tok))) {
              console.log(`  Contratado mapeado via token overlap: "${valor}" → "${opt}"`);
              return opt;
            }
          }
        } catch (e) {
          console.warn('Erro ao mapear contratado via motoristas:', e);
        }

        // Valores fixos conhecidos (legacy)
        const valoresValidos = ['GEO', 'MACHADO', 'BANDEIRA', 'TRANSCAVALCANTE'];
        const up = raw.toUpperCase();
        for (const valido of valoresValidos) {
          if (up.includes(valido)) {
            console.log(`  Contratado mapeado legacy: "${valor}" → "${valido}"`);
            return valido;
          }
        }

        // Se não encontrou correspondência, aceita o valor como está (case-insensitive preservando o original)
        console.log(`  Contratado aceito como está: "${valor}"`);
        return raw.toUpperCase();
      };

      // Função para parsear data DD/MM/YYYY HH:MM corretamente (sem timezone issues)
      const parseDateString = (dataStr) => {
        if (!dataStr) return '';
        
        try {
          const strValue = String(dataStr).trim();
          
          // Se for número (Excel date serial) - pode conter fração para hora
          if (!isNaN(strValue) && strValue !== '') {
            const excelNum = Number(strValue);
            
            // Excel serial date começa em 1900-01-01 (número 1)
            // Fórmula: (excelNum - 1) * 86400000 ms, mas precisa ajustar para timezone
            // Usa 25569 como offset para o epoch de 1970-01-01
            const date = new Date((excelNum - 25569) * 86400 * 1000);
            
            // Extrai componentes diretamente sem considerar timezone
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            
            console.log(`[DEBUG] Excel serial: ${excelNum} → ${year}-${month}-${day}T${hours}:${minutes}`);
            return `${year}-${month}-${day}T${hours}:${minutes}`;
          } else {
            // Parse string DD/MM/YYYY ou DD/MM/YYYY HH:MM
            const parts = strValue.split(' ');
            const dateParts = parts[0].split('/');

            if (dateParts.length === 3) {
              const day = dateParts[0].padStart(2, '0');
              const month = dateParts[1].padStart(2, '0');
              const year = dateParts[2];
              
              // Extrai HH:MM se existir (pode vir como "14:00" ou "14:00:00")
              let time = '00:00';
              if (parts.length > 1) {
                const timeParts = parts[1].split(':');
                const hh = timeParts[0].padStart(2, '0');
                const mm = timeParts[1] ? timeParts[1].padStart(2, '0') : '00';
                time = `${hh}:${mm}`;
              }

              console.log(`[DEBUG] String date: "${strValue}" → ${year}-${month}-${day}T${time}`);
              // Retorna em formato ISO sem timezone
              return `${year}-${month}-${day}T${time}`;
            }
          }
        } catch (err) {
          console.error(`Erro ao converter data "${dataStr}":`, err);
        }
        
        return '';
      };

      // Mapear e validar dados - EXTRAIR APENAS AS COLUNAS RELEVANTES
      const programacoesImport = data.map((row, index) => {
        // Busca case-insensitive para Recebedor
        const recebedorRaw = String(row[actualColumns.recebedor] || '').trim();
        const recebedor = recebedorRaw; // Preserva exatamente como veio (caso de negócio)

        // Extrai processo
        const processo = String(row[actualColumns.processo] || '').trim();
        
        // Extrai container
        const container = String(row[actualColumns.container] || '').trim();
        
        // Extrai e parseia data corretamente preservando hora
        const dataStr = String(row[actualColumns.dataAgendamento] || '').trim();
        
        // Extrai contratado
        const contratadoRaw = String(row[actualColumns.contratado] || '').trim();
        
        // Extrai motorista (opcional)
        const motorista = actualColumns.motorista ? String(row[actualColumns.motorista] || '').trim() : '';
        
        // Extrai status (opcional, default AGENDADO)
        const status = actualColumns.status ? String(row[actualColumns.status] || 'AGENDADO').trim() : 'AGENDADO';

        // Parse data preservando hora exatamente como no Excel
        const dataAgendamento = parseDateString(dataStr);
        
        // Map contratado com suporte case-insensitive
        const contratado = mapearContratado(contratadoRaw);

        console.log(`Linha ${index + 2}: processo="${processo}", recebedor="${recebedor}", dataAgendamento="${dataAgendamento}"`);

        return {
          processo,
          recebedor,
          container,
          dataAgendamento,
          contratado,
          motorista,
          status: status || 'AGENDADO'
        };
      });

        const dataAgendamento = parseDateString(dataStr);
        const contratado = mapearContratado(contratadoRaw);

        return {
          processo,
          recebedor,
          container,
          dataAgendamento,
          contratado,
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
                  onChange={(e) => {
                    const novo = e.target.value;
                    setFormData({ ...formData, contratado: novo, motorista: '' });
                  }}
                >
                  {getContratadosOptions().map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Motorista</label>
                <select
                  value={formData.motorista}
                  onChange={(e) => setFormData({ ...formData, motorista: e.target.value })}
                >
                  <option value="">-- Selecionar motorista --</option>
                  {motoristasList
                    .filter((m) => {
                      const t = m.transportadora || '';
                      const c = formData.contratado || '';
                      if (!c) return true;
                      const tn = normalize(t);
                      const cn = normalize(c);
                      // match if either contains the other or tokens overlap
                      if (tn.includes(cn) || cn.includes(tn)) return true;
                      const tTokens = tn.split(/\s+/).filter(Boolean);
                      const cTokens = cn.split(/\s+/).filter(Boolean);
                      return tTokens.some(tok => cTokens.includes(tok)) || cTokens.some(tok => tTokens.includes(tok));
                    })
                    .map((m) => (
                      <option key={m._id} value={m.nome}>{m.nome} {m.cpf ? `(${m.cpf})` : ''}</option>
                    ))}
                </select>
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
                A planilha deve conter as colunas obrigatórias. O sistema reconhece várias variações de nomes:
              </p>

              <div style={{
                backgroundColor: '#f3f4f6',
                padding: '15px',
                borderRadius: '6px',
                marginBottom: '20px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#4b5563'
              }}>
                <div><strong>Processo:</strong> "Processo"</div>
                <div><strong>Recebedor:</strong> "Recebedor" (apenas coluna Recebedor, maiúsculas/minúsculas/pontuação flexível)</div>
                <div><strong>Container:</strong> "Container", "Nº container", "N° container"</div>
                <div><strong>Data Agendamento:</strong> "Data Agendamento", "Dt. Agendamento", "Dta gendamento", "Data"</div>
                <div><strong>Contratado:</strong> "Contratado", "Transportadora", "Empresa" (qualquer contratado é aceito)</div>
                <div><strong>Motorista:</strong> "Motorista" (opcional)</div>
                <div><strong>Status:</strong> "Status" (opcional - AGENDADO, EM_ROTA, ENTREGUE, CANCELADO)</div>
                <div><strong>Observações:</strong> "Observações", "Observação", "Notas" (opcional)</div>
              </div>

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
