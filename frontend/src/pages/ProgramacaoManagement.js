import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/authService';
import { useAuth } from '../services/authContext';
import { useCity } from '../contexts/CityContext';
import { getRecebedorLabel, getRecebedorPlaceholder, getRecebedorErrorMsg } from '../utils/cityLabels';
import {
  FaArrowLeft, FaPlus, FaEdit, FaTrash, FaFileDownload,
  FaFileExcel, FaSort, FaSortUp, FaSortDown, FaFilter,
  FaCalendarAlt, FaTimes, FaSearch, FaEye, FaSyncAlt
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import '../styles/MotoristaManagement.css';

const ProgramacaoManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { city } = useCity();

  const isGeoMar = () => false; // Libera edição para geomar
  const canEdit = () => true;

  const [programacoes, setProgramacoes] = useState([]);
  const [filteredProgramacoes, setFilteredProgramacoes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const [filters, setFilters] = useState({ search: '', status: 'all', startDate: '', endDate: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const [formData, setFormData] = useState({
    processo: '', recebedor: '', container: '', dataAgendamento: '',
    contratado: 'GEO', motorista: '', status: 'AGENDADO', observacoes: ''
  });
  const [motoristasList, setMotoristasList] = useState([]);

  const normalize = (s) =>
    String(s || '').toLowerCase().normalize('NFD')
      .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, '').trim();

  const getContratadosOptions = () => {
    const fixed = ['GEO', 'MACHADO', 'BANDEIRA', 'TRANSCAVALCANTE', 'OUTRO'];
    const fromMotoristas = Array.from(
      new Set((motoristasList || []).map(m => (m.transportadora || '').trim()).filter(Boolean))
    );
    const merged = [...fixed];
    fromMotoristas.forEach(t => {
      if (!merged.some(x => normalize(x) === normalize(t))) merged.push(t);
    });
    return merged;
  };

  useEffect(() => { loadProgramacoes(); loadAllMotoristas(); }, []);

  const loadAllMotoristas = async () => {
    try {
      const res = await adminService.getMotoristas();
      setMotoristasList(res.data.motoristas || []);
    } catch (err) { console.error('Erro ao carregar motoristas', err); }
  };

  const loadProgramacoes = async () => {
    try {
      setLoading(true);
      const response = await adminService.getProgramacoes();
      setProgramacoes(response.data.programacoes || []);
    } catch (err) {
      showToast('Erro ao carregar programações', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncYcompany = async () => {
    if (syncLoading) return;
    try {
      setSyncLoading(true);
      const response = await adminService.syncProgramacoesYcompany();
      
      if (response.data.success) {
        showToast(`✅ ${response.data.sincronizados} registro(s) sincronizado(s) do Ycompany` + 
                  (response.data.duplicados > 0 ? ` (${response.data.duplicados} duplicados ignorados)` : ''));
        loadProgramacoes();
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Erro ao sincronizar';
      showToast(message, 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  const getProgramacaoDate = (prog) => {
    // Itajaí should use dtColeta when available; otherwise fall back to the agendamento field
    if (city === 'itajai' && prog.dtColeta) return prog.dtColeta;
    return prog.dataAgendamento;
  };

  useEffect(() => {
    let data = [...programacoes];
    if (filters.search) {
      const term = filters.search.toLowerCase();
      data = data.filter(p =>
        (p.processo || '').toLowerCase().includes(term) ||
        (p.recebedor || '').toLowerCase().includes(term) ||
        (p.container || '').toLowerCase().includes(term) ||
        (p.motorista || '').toLowerCase().includes(term)
      );
    }
    if (filters.status && filters.status !== 'all')
      data = data.filter(p => p.status === filters.status);
    if (filters.startDate) {
      const sd = new Date(filters.startDate);
      data = data.filter(p => {
        const dateVal = getProgramacaoDate(p);
        return dateVal && new Date(dateVal) >= sd;
      });
    }
    if (filters.endDate) {
      const ed = new Date(filters.endDate);
      data = data.filter(p => {
        const dateVal = getProgramacaoDate(p);
        return dateVal && new Date(dateVal) <= ed;
      });
    }
    if (sortBy) {
      data.sort((a, b) => {
        let va = sortBy === 'dataAgendamento' ? getProgramacaoDate(a) : a[sortBy];
        let vb = sortBy === 'dataAgendamento' ? getProgramacaoDate(b) : b[sortBy];
        va = va || '';
        vb = vb || '';
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setFilteredProgramacoes(data);
  }, [programacoes, filters, sortBy, sortDir]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setFormData({ processo: '', recebedor: '', container: '', dataAgendamento: '', contratado: 'GEO', motorista: '', status: 'AGENDADO', observacoes: '' });
    setEditingId(null);
  };

  const handleOpen = (programacao = null) => {
    if (programacao) {
      // Libera edição para geomar
      setEditingId(programacao._id);
      let dataAgendamento = city === 'itajai' ? (programacao.dtColeta || programacao.dataAgendamento || '') : (programacao.dataAgendamento || '');
      if (dataAgendamento && dataAgendamento.includes('T')) {
        dataAgendamento = dataAgendamento.split('.')[0];
        if (dataAgendamento.length > 16) dataAgendamento = dataAgendamento.slice(0, 16);
      }
      setFormData({
        processo: programacao.processo, recebedor: programacao.recebedor,
        container: programacao.container || '', dataAgendamento,
        contratado: programacao.contratado, motorista: programacao.motorista || '',
        status: programacao.status, observacoes: programacao.observacoes || ''
      });
    } else { resetForm(); }
    setShowModal(true);
  };

  const handleSave = async () => {
    // Libera operação para geomar
    if (!formData.processo || !formData.recebedor || !formData.dataAgendamento || !formData.contratado) {
      showToast('Preencha todos os campos obrigatórios', 'error'); return;
    }
    try {
      let dataAgendamento = formData.dataAgendamento;
      if (dataAgendamento && dataAgendamento.length > 16) dataAgendamento = dataAgendamento.slice(0, 16);

      const payload = {
        ...formData,
        origem: city === 'itajai' ? 'ITAJAÍ' : formData.origem,
        motorista: formData.motorista || ''
      };

      if (city === 'itajai') {
        payload.dtColeta = dataAgendamento;
        payload.dataAgendamento = payload.dataAgendamento || '';
      } else {
        payload.dataAgendamento = dataAgendamento;
      }

      if (editingId) { await adminService.updateProgramacao(editingId, payload); showToast('Programação atualizada com sucesso'); }
      else { await adminService.createProgramacao(payload); showToast('Programação criada com sucesso'); }
      setShowModal(false); resetForm(); loadProgramacoes();
    } catch (err) { showToast(err.response?.data?.message || 'Erro ao salvar', 'error'); }
  };

  const handleDelete = async (id) => {
    // Libera exclusão para geomar
    if (window.confirm('Confirmar exclusão desta programação?')) {
      try { await adminService.deleteProgramacao(id); showToast('Programação excluída'); loadProgramacoes(); }
      catch (err) { showToast('Erro ao excluir', 'error'); }
    }
  };

  const statusConfig = {
    AGENDADO:   { color: '#3b82f6', bg: '#eff6ff', label: 'Agendado' },
    EM_ROTA:    { color: '#f59e0b', bg: '#fffbeb', label: 'Em Rota' },
    ENTREGUE:   { color: '#10b981', bg: '#f0fdf4', label: 'Entregue' },
    CANCELADO:  { color: '#ef4444', bg: '#fef2f2', label: 'Cancelado' },
  };

  const contratadoConfig = {
    GEO:            { color: '#7c3aed', bg: '#f5f3ff' },
    MACHADO:        { color: '#db2777', bg: '#fdf2f8' },
    BANDEIRA:       { color: '#0d9488', bg: '#f0fdfa' },
    TRANSCAVALCANTE:{ color: '#ea580c', bg: '#fff7ed' },
    OUTRO:          { color: '#6b7280', bg: '#f9fafb' },
  };

  const getStatusStyle = (s) => statusConfig[s] || { color: '#6b7280', bg: '#f9fafb', label: s };
  const getContratadoStyle = (c) => contratadoConfig[c] || { color: '#6b7280', bg: '#f9fafb' };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <FaSort style={{ opacity: 0.35, marginLeft: 4, fontSize: 11 }} />;
    return sortDir === 'asc'
      ? <FaSortUp style={{ color: '#6366f1', marginLeft: 4, fontSize: 11 }} />
      : <FaSortDown style={{ color: '#6366f1', marginLeft: 4, fontSize: 11 }} />;
  };

  // ─── Import handlers (unchanged logic) ───────────────────────────
  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImportLoading(true);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      if (data.length === 0) { showToast('Planilha vazia', 'error'); return; }

      const normalizeColumnName = (name) => !name ? '' : name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').replace(/\s+/g, '');
      const columnMapping = {
        processo: ['processo'], recebedor: ['recebedor'],
        container: ['container', 'ncontainer', 'numercontainer', 'nrcontainer'],
        dataAgendamento: ['dataagendamento', 'dtagendamento', 'dtgendamento', 'data', 'agendamento', 'dataagend', 'dtagend'],
        contratado: ['contratado', 'transportadora', 'empresa'],
        motorista: ['motorista', 'motoristaviagem', 'nomemuotorista'],
        status: ['status', 'situacao']
      };
      const firstRow = data[0];
      const actualColumns = {};
      Object.keys(columnMapping).forEach(expectedCol => {
        for (const key of Object.keys(firstRow)) {
          const n = normalizeColumnName(key);
          if (columnMapping[expectedCol].includes(n)) { actualColumns[expectedCol] = key; break; }
        }
        if (!actualColumns[expectedCol]) {
          for (const key of Object.keys(firstRow)) {
            const n = normalizeColumnName(key);
            for (const v of columnMapping[expectedCol]) {
              if (n.includes(v) || v.includes(n)) { actualColumns[expectedCol] = key; break; }
            }
            if (actualColumns[expectedCol]) break;
          }
        }
      });

      const mapearContratado = (valor) => {
        const raw = String(valor || '').trim();
        if (!raw) return 'OUTRO';
        const target = normalize(raw);
        try {
          const options = Array.from(new Set((motoristasList || []).map(m => (m.transportadora || '').trim()).filter(Boolean)));
          for (const opt of options) {
            const on = normalize(opt);
            if (!on) continue;
            if (on === target || on.includes(target) || target.includes(on)) return opt;
            const ot = on.split(/\s+/).filter(Boolean), tt = target.split(/\s+/).filter(Boolean);
            if (ot.some(tok => tt.includes(tok)) || tt.some(tok => ot.includes(tok))) return opt;
          }
        } catch (e) {}
        const valoresValidos = ['GEO', 'MACHADO', 'BANDEIRA', 'TRANSCAVALCANTE'];
        const up = raw.toUpperCase();
        for (const v of valoresValidos) { if (up.includes(v)) return v; }
        return raw.toUpperCase();
      };

      const parseDateString = (dataStr) => {
        if (dataStr === null || dataStr === undefined || dataStr === '') return '';
        if (dataStr instanceof Date) {
          const d = dataStr;
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        }
        try {
          const strValue = String(dataStr).trim();
          if (!isNaN(strValue) && strValue !== '') {
            const excelNum = Number(strValue);
            let days = Math.floor(excelNum);
            const fraction = excelNum - days;
            const baseDate = new Date(1899, 11, 31);
            if (days >= 60) days -= 1;
            const date = new Date(baseDate.getTime() + days * 86400000);
            const totalSeconds = Math.round(fraction * 86400);
            return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(Math.floor(totalSeconds/3600)).padStart(2,'0')}:${String(Math.floor((totalSeconds%3600)/60)).padStart(2,'0')}`;
          } else {
            const parts = strValue.split(' ');
            const dateParts = parts[0].split('/');
            if (dateParts.length === 3) {
              const [d, mo, y] = [dateParts[0].padStart(2,'0'), dateParts[1].padStart(2,'0'), dateParts[2]];
              let time = '00:00';
              if (parts.length > 1) {
                const tp = parts[1].split(':');
                time = `${tp[0].padStart(2,'0')}:${(tp[1]||'00').padStart(2,'0')}`;
              }
              return `${y}-${mo}-${d}T${time}`;
            }
          }
        } catch (err) {}
        return '';
      };

      const programacoesImport = data.map(row => ({
        processo: String(row[actualColumns.processo] || '').trim(),
        recebedor: String(row[actualColumns.recebedor] || '').trim(),
        container: String(row[actualColumns.container] || '').trim(),
        dataAgendamento: parseDateString(String(row[actualColumns.dataAgendamento] || '').trim()),
        contratado: mapearContratado(String(row[actualColumns.contratado] || '').trim()),
        motorista: String(row[actualColumns.motorista] || '').trim(),
        status: String(row[actualColumns.status] || 'AGENDADO').trim()
      }));

      const erros = [];
      programacoesImport.forEach((prog, i) => {
        if (!prog.processo) erros.push(`Linha ${i+2}: Processo obrigatório`);
        if (!prog.recebedor) erros.push(`Linha ${i+2}: ${getRecebedorErrorMsg(city)}`);
        if (!prog.dataAgendamento) erros.push(`Linha ${i+2}: Data obrigatória`);
        if (!prog.contratado) erros.push(`Linha ${i+2}: Contratado obrigatório`);
      });
      if (erros.length > 0) { showToast(`Erros: ${erros.slice(0,3).join(', ')}${erros.length>3?'...':''}`, 'error'); return; }

      const response = await adminService.importProgramacoes(programacoesImport);
      showToast(`${response.data.importados} programações importadas com sucesso`);
      setShowImportModal(false); loadProgramacoes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Erro ao importar arquivo', 'error');
    } finally { setImportLoading(false); event.target.value = ''; }
  };

  const downloadTemplate = () => {
    try {
      const template = [{ 'Processo': 'CAB42196', [getRecebedorLabel(city)]: 'AMERICANA DIST. BEBIDAS', 'Container': 'ECMU4814297', 'Data Agendamento': '12/02/2026 10:00', 'Contratado': 'GEO', 'Motorista': 'JOÃO SILVA', 'Status': 'AGENDADO', 'Observações': '' }];
      const ws = XLSX.utils.json_to_sheet(template);
      ws['!cols'] = [15,30,15,20,15,20,15,30].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Programações');
      XLSX.writeFile(wb, 'template_programacoes.xlsx');
      showToast('Template baixado com sucesso');
    } catch (err) { showToast('Erro ao gerar template', 'error'); }
  };

  // ─── Shared input style ───────────────────────────────────────────
  const inputStyle = (disabled) => ({
    width: '100%', padding: '10px 14px', fontSize: '14px',
    border: '1.5px solid #e5e7eb', borderRadius: '8px', outline: 'none',
    backgroundColor: disabled ? '#f9fafb' : '#fff',
    color: disabled ? '#9ca3af' : '#1f2937',
    cursor: disabled ? 'not-allowed' : 'text',
    transition: 'border-color .2s',
    boxSizing: 'border-box',
  });
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          padding: '14px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 500,
          boxShadow: '0 10px 40px rgba(0,0,0,.15)',
          backgroundColor: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
          color: toast.type === 'error' ? '#dc2626' : '#16a34a',
          border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          display: 'flex', alignItems: 'center', gap: 10, maxWidth: 400,
          animation: 'slideIn .25s ease'
        }}>
          <span style={{ fontSize: 18 }}>{toast.type === 'error' ? '✕' : '✓'}</span>
          {toast.message}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        padding: '0 32px', height: 72,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(49,46,129,.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)',
              background: 'rgba(255,255,255,.08)', color: '#e0e7ff',
              cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .2s'
            }}
          >
            <FaArrowLeft size={12} /> Voltar
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
              Programação de Entregas
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: '#a5b4fc', marginTop: 2 }}>
              {filteredProgramacoes.length} registro{filteredProgramacoes.length !== 1 ? 's' : ''}
              {isGeoMar() && <span style={{ marginLeft: 8, padding: '2px 8px', backgroundColor: '#fbbf24', color: '#78350f', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>VISUALIZAÇÃO</span>}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: showFilters ? '1px solid #a5b4fc' : '1px solid rgba(255,255,255,.2)',
              background: showFilters ? 'rgba(165,180,252,.2)' : 'rgba(255,255,255,.08)',
              color: '#e0e7ff', cursor: 'pointer', transition: 'all .2s'
            }}
          >
            <FaFilter size={12} /> Filtros
          </button>

          {!isGeoMar() && (
            <>
              <button
                onClick={handleSyncIcompany}
                disabled={syncLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: '1px solid rgba(255,255,255,.2)',
                  background: syncLoading ? 'rgba(59, 130, 246, 0.2)' : 'rgba(34, 197, 94, 0.15)',
                  color: syncLoading ? '#60a5fa' : '#22c55e',
                  cursor: syncLoading ? 'not-allowed' : 'pointer', 
                  transition: 'all .2s',
                  opacity: syncLoading ? 0.7 : 1
                }}
              >
                <FaSyncAlt size={12} style={{ animation: syncLoading ? 'spin 1s linear infinite' : 'none' }} /> 
                {syncLoading ? 'Sincronizando...' : 'Sincronizar Icompany'}
              </button>

              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: '1px solid rgba(255,255,255,.2)',
                  background: 'rgba(255,255,255,.08)',
                  color: '#e0e7ff', cursor: 'pointer', transition: 'all .2s'
                }}
              >
                <FaFileExcel size={12} /> Importar Excel
              </button>

              <button
                onClick={() => handleOpen()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: 'none', background: '#6366f1', color: '#fff',
                  cursor: 'pointer', transition: 'all .2s',
                  boxShadow: '0 2px 12px rgba(99,102,241,.4)'
                }}
              >
                <FaPlus size={12} /> Nova Programação
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '28px 32px' }}>

        {/* ── Filter Panel ─────────────────────────────────────────── */}
        {showFilters && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: '20px 24px',
            marginBottom: 20, border: '1px solid #e5e7eb',
            boxShadow: '0 2px 12px rgba(0,0,0,.06)'
          }}>
            <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Filtros</p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 13 }} />
                <input
                  type="text" value={filters.search}
                  onChange={e => setFilters({...filters, search: e.target.value})}
                  placeholder={`Buscar processo, ${getRecebedorLabel(city).toLowerCase()}, motorista...`}
                  style={{ ...inputStyle(false), paddingLeft: 36 }}
                />
              </div>
              <select
                value={filters.status}
                onChange={e => setFilters({...filters, status: e.target.value})}
                style={{ ...inputStyle(false), cursor: 'pointer' }}
              >
                <option value="all">Todos os status</option>
                <option value="AGENDADO">Agendado</option>
                <option value="EM_ROTA">Em Rota</option>
                <option value="ENTREGUE">Entregue</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
              <input type="date" value={filters.startDate}
                onChange={e => setFilters({...filters, startDate: e.target.value})}
                style={{ ...inputStyle(false), cursor: 'pointer' }}
              />
              <input type="date" value={filters.endDate}
                onChange={e => setFilters({...filters, endDate: e.target.value})}
                style={{ ...inputStyle(false), cursor: 'pointer' }}
              />
            </div>
          </div>
        )}

        {/* ── Table Card ───────────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 14, overflow: 'hidden',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 16px rgba(0,0,0,.06)'
        }}>
          {loading ? (
            <div style={{ padding: '80px', textAlign: 'center', color: '#9ca3af', fontSize: 15 }}>
              <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
              Carregando programações...
            </div>
          ) : filteredProgramacoes.length === 0 ? (
            <div style={{ padding: '80px', textAlign: 'center', color: '#9ca3af' }}>
              <FaCalendarAlt style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Nenhuma programação encontrada</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                    {[
                      { key: 'processo', label: 'Processo' },
                      { key: 'recebedor', label: getRecebedorLabel(city) },
                      { key: 'container', label: 'Container' },
                      { key: 'dataAgendamento', label: 'Data / Hora' },
                      { key: 'contratado', label: 'Contratado' },
                      { key: 'motorista', label: 'Motorista' },
                      { key: 'status', label: 'Status' },
                    ].map(col => (
                      <th key={col.key}
                        onClick={() => handleSort(col.key)}
                        style={{
                          padding: '14px 16px', textAlign: 'left', fontSize: 11,
                          fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                          letterSpacing: '.7px', cursor: 'pointer', userSelect: 'none',
                          whiteSpace: 'nowrap',
                          borderRight: '1px solid #f1f5f9',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {col.label} <SortIcon col={col.key} />
                        </span>
                      </th>
                    ))}
                    <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', textAlign: 'center' }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProgramacoes.map((prog, idx) => {
                    const st = getStatusStyle(prog.status);
                    const ct = getContratadoStyle(prog.contratado);
                    return (
                      <tr key={prog._id}
                        style={{
                          backgroundColor: idx % 2 === 0 ? '#fff' : '#fafbfc',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background .15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f6ff'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#fafbfc'}
                      >
                        <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>
                          {prog.processo}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prog.recebedor}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151', fontFamily: 'monospace' }}>
                          {prog.container}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                          {(() => {
                            const dateString = getProgramacaoDate(prog);
                            if (!dateString) return '—';

                            const [date, time] = dateString.split(/[T ]/);
                            const [y, m, d] = date.split('-');
                            if (!y || !m || !d) return dateString;

                            return (
                              <span>
                                <span style={{ fontWeight: 600 }}>{d}/{m}/{y}</span>
                                {time && <span style={{ color: '#9ca3af', marginLeft: 6, fontSize: 12 }}>{time}</span>}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            backgroundColor: ct.bg, color: ct.color,
                            border: `1px solid ${ct.color}30`
                          }}>
                            {prog.contratado}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>
                          {prog.motorista || <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            backgroundColor: st.bg, color: st.color,
                            border: `1px solid ${st.color}30`
                          }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => handleOpen(prog)}
                              disabled={false}
                              title={'Editar'}
                              style={{
                                width: 34, height: 34, borderRadius: 8, border: '1.5px solid #e5e7eb',
                                background: '#fff', color: isGeoMar() ? '#d1d5db' : '#6366f1',
                                cursor: isGeoMar() ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, transition: 'all .2s'
                              }}
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDelete(prog._id)}
                              disabled={false}
                              title={'Excluir'}
                              style={{
                                width: 34, height: 34, borderRadius: 8, border: '1.5px solid #e5e7eb',
                                background: '#fff', color: isGeoMar() ? '#d1d5db' : '#ef4444',
                                cursor: isGeoMar() ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, transition: 'all .2s'
                              }}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Form Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(15,15,30,.6)',
            backdropFilter: 'blur(4px)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
              boxShadow: '0 24px 80px rgba(0,0,0,.22)',
              display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '22px 28px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #1e1b4b, #312e81)'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>
                  {editingId ? 'Editar Programação' : 'Nova Programação'}
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: '#a5b4fc', marginTop: 3 }}>
                  Preencha as informações abaixo
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)',
                  color: '#e0e7ff', cursor: 'pointer', fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <FaTimes />
              </button>
            </div>

            {/* View-only banner */}
            {/* Remove banner de visualização para geomar */}

            {/* Modal Body */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Processo <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" disabled={false} value={formData.processo}
                    onChange={e => setFormData({...formData, processo: e.target.value})}
                    placeholder="CAB42196" style={inputStyle(isGeoMar())} />
                </div>
                <div>
                  <label style={labelStyle}>Container</label>
                  <input type="text" disabled={false} value={formData.container}
                    onChange={e => setFormData({...formData, container: e.target.value})}
                    placeholder="UETU6510024" style={inputStyle(isGeoMar())} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>{getRecebedorLabel(city)} <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" disabled={false} value={formData.recebedor}
                  onChange={e => setFormData({...formData, recebedor: e.target.value})}
                  placeholder={getRecebedorPlaceholder(city)} style={inputStyle(isGeoMar())} />
              </div>

              <div>
                <label style={labelStyle}>Data de Agendamento <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="datetime-local" disabled={false} value={formData.dataAgendamento}
                  onChange={e => setFormData({...formData, dataAgendamento: e.target.value})}
                  style={inputStyle(isGeoMar())} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Contratado <span style={{ color: '#ef4444' }}>*</span></label>
                  <select disabled={false} value={formData.contratado}
                    onChange={e => setFormData({...formData, contratado: e.target.value, motorista: ''})}
                    style={{ ...inputStyle(isGeoMar()), cursor: isGeoMar() ? 'not-allowed' : 'pointer' }}>
                    {getContratadosOptions().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select disabled={false} value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    style={{ ...inputStyle(isGeoMar()), cursor: isGeoMar() ? 'not-allowed' : 'pointer' }}>
                    <option value="AGENDADO">Agendado</option>
                    <option value="EM_ROTA">Em Rota</option>
                    <option value="ENTREGUE">Entregue</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Motorista</label>
                <select disabled={false} value={formData.motorista}
                  onChange={e => setFormData({...formData, motorista: e.target.value})}
                  style={{ ...inputStyle(isGeoMar()), cursor: isGeoMar() ? 'not-allowed' : 'pointer' }}>
                  <option value="">— Selecionar motorista —</option>
                  {motoristasList
                    .filter(m => {
                      const t = m.transportadora || '', c = formData.contratado || '';
                      if (!c) return true;
                      const tn = normalize(t), cn = normalize(c);
                      if (tn.includes(cn) || cn.includes(tn)) return true;
                      const tT = tn.split(/\s+/).filter(Boolean), cT = cn.split(/\s+/).filter(Boolean);
                      return tT.some(tok => cT.includes(tok)) || cT.some(tok => tT.includes(tok));
                    })
                    .map(m => (
                      <option key={m._id} value={m.nome}>{m.nome}{m.cpf ? ` (${m.cpf})` : ''}</option>
                    ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Observações</label>
                <textarea disabled={false} value={formData.observacoes}
                  onChange={e => setFormData({...formData, observacoes: e.target.value})}
                  placeholder="Anotações adicionais..."
                  rows={3}
                  style={{ ...inputStyle(isGeoMar()), resize: 'vertical', cursor: isGeoMar() ? 'not-allowed' : 'text' }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '18px 28px', borderTop: '1px solid #f1f5f9',
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              backgroundColor: '#fafafa'
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                  border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151',
                  cursor: 'pointer', transition: 'all .2s'
                }}
              >
                Cancelar
              </button>
              {!isGeoMar() && (
                <button
                  onClick={handleSave}
                  style={{
                    padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff', cursor: 'pointer', transition: 'all .2s',
                    boxShadow: '0 4px 14px rgba(99,102,241,.4)'
                  }}
                >
                  {editingId ? 'Salvar Alterações' : 'Criar Programação'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ─────────────────────────────────────────────── */}
      {showImportModal && (
        <div
          onClick={() => setShowImportModal(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(15,15,30,.6)',
            backdropFilter: 'blur(4px)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
              boxShadow: '0 24px 80px rgba(0,0,0,.22)', overflow: 'hidden'
            }}
          >
            <div style={{
              padding: '22px 28px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #065f46, #059669)'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>Importar via Excel</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#a7f3d0', marginTop: 3 }}>Selecione ou arraste um arquivo .xlsx / .xls / .csv</p>
              </div>
              <button onClick={() => setShowImportModal(false)}
                style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaTimes />
              </button>
            </div>

            <div style={{ padding: '28px 28px 20px' }}>
              {/* Columns guide */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 12, color: '#4b5563', border: '1px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, color: '#374151', fontSize: 13 }}>Colunas esperadas</p>
                {[
                  ['Processo', 'Processo'],
                  [getRecebedorLabel(city), getRecebedorLabel(city)],
                  ['Container', 'Container, Nº container'],
                  ['Data Agendamento', 'Data Agendamento, Dt. Agendamento, Data'],
                  ['Contratado', 'Contratado, Transportadora, Empresa'],
                  ['Motorista', 'Motorista (opcional)'],
                  ['Status', 'Status (opcional)'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, color: '#6366f1', minWidth: 120 }}>{k}</span>
                    <span style={{ color: '#6b7280' }}>{v}</span>
                  </div>
                ))}
              </div>

              <button onClick={downloadTemplate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: '1.5px solid #3b82f6', background: '#eff6ff', color: '#2563eb',
                  cursor: 'pointer', marginBottom: 16, transition: 'all .2s'
                }}>
                <FaFileDownload /> Baixar Template
              </button>

              {/* Drop zone */}
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '32px 20px', border: '2px dashed #a7f3d0', borderRadius: 12,
                background: '#f0fdf4', cursor: importLoading ? 'default' : 'pointer',
                transition: 'all .2s'
              }}>
                <input type="file" accept=".xlsx,.xls,.csv"
                  onChange={handleImportFile} disabled={importLoading} style={{ display: 'none' }} />
                <FaFileExcel style={{ fontSize: 40, color: '#059669', marginBottom: 12 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#059669' }}>
                  {importLoading ? 'Importando...' : 'Clique ou arraste o arquivo aqui'}
                </span>
                <span style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  .xlsx, .xls ou .csv
                </span>
              </label>
            </div>

            <div style={{
              padding: '16px 28px', borderTop: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fafafa'
            }}>
              <button onClick={() => setShowImportModal(false)} disabled={importLoading}
                style={{
                  padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                  border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151',
                  cursor: importLoading ? 'not-allowed' : 'pointer'
                }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        input:focus, select:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
      `}</style>
    </div>
  );
};

export default ProgramacaoManagement;
