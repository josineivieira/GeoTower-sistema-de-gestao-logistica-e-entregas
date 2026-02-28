import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import {
  FiArrowLeft, FiEdit2, FiTrash2, FiPlus, FiTruck,
  FiUploadCloud, FiDownload, FiSearch, FiFilter,
  FiChevronUp, FiChevronDown, FiChevronsUpDown, FiX,
  FiUser, FiPhone, FiCpu, FiCalendar, FiAlertCircle
} from 'react-icons/fi';
import * as XLSX from 'xlsx';

/* ─── Badge de Vínculo ─── */
const VinculoBadge = ({ vinculo }) => {
  const map = {
    'PRÓPRIO':   'bg-emerald-50 text-emerald-700 border-emerald-200',
    'AGREGADO':  'bg-amber-50 text-amber-700 border-amber-200',
    'TERCEIRO':  'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[vinculo] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {vinculo}
    </span>
  );
};

/* ─── Badge de Status ─── */
const StatusBadge = ({ status }) => {
  if (!status) return <span className="text-slate-300 text-xs">—</span>;
  const map = {
    'VENCIDO':   'bg-red-50 text-red-700 border-red-200',
    'A VENCER':  'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${map[status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
      {status}
    </span>
  );
};

/* ─── Sort Icon ─── */
const SortIcon = ({ column, sort }) => {
  if (sort.column !== column) return <FiChevronsUpDown size={12} className="text-slate-400 ml-1 inline" />;
  return sort.direction === 'asc'
    ? <FiChevronUp size={12} className="text-indigo-500 ml-1 inline" />
    : <FiChevronDown size={12} className="text-indigo-500 ml-1 inline" />;
};

/* ─── Label de campo ─── */
const FieldLabel = ({ children, required }) => (
  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
    {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
  </label>
);

/* ─── Input padrão ─── */
const FormInput = ({ icon: Icon, ...props }) => (
  <div className="relative">
    {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
    <input
      {...props}
      className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition placeholder:text-slate-400`}
    />
  </div>
);

/* ─── Select padrão ─── */
const FormSelect = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition appearance-none"
  >
    {children}
  </select>
);

/* ════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════ */
const MotoristaManagement = () => {
  const navigate = useNavigate();
  const [motoristas,      setMotoristas]      = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [toast,           setToast]           = useState(null);
  const [showForm,        setShowForm]        = useState(false);
  const [editingMotorista,setEditingMotorista]= useState(null);
  const [importLoading,   setImportLoading]   = useState(false);

  const [filters, setFilters] = useState({ transportadora: '', vinculo: '', status: '', searchTerm: '' });
  const [sort,    setSort]    = useState({ column: 'transportadora', direction: 'asc' });
  const [formData, setFormData] = useState({
    transportadora: '', nome: '', cpf: '', vinculo: 'AGREGADO',
    rastreador: '', expCadastroMotorista: '',
    cavalo: '', rastreadorCavalo: '', expCadastroCavalo: '',
    carreta: '', rastreadorCarreta: '', expCadastroCarreta: '',
    telefone: '', observacoes: ''
  });

  const EMPTY_FORM = {
    transportadora: '', nome: '', cpf: '', vinculo: 'AGREGADO',
    rastreador: '', expCadastroMotorista: '',
    cavalo: '', rastreadorCavalo: '', expCadastroCavalo: '',
    carreta: '', rastreadorCarreta: '', expCadastroCarreta: '',
    telefone: '', observacoes: ''
  };

  useEffect(() => { loadMotoristas(); }, []);

  const loadMotoristas = async () => {
    try {
      setLoading(true);
      const response = await adminService.getMotoristas();
      const data = response.data.motoristas || [];
      const computeStatus = (exp) => {
        if (!exp) return '';
        return new Date(exp) >= new Date() ? 'A VENCER' : 'VENCIDO';
      };
      setMotoristas(data.map(m => ({
        ...m,
        statusMotorista: computeStatus(m.expCadastroMotorista),
        statusCavalo:    computeStatus(m.expCadastroCavalo),
        statusCarreta:   computeStatus(m.expCadastroCarreta),
      })));
    } catch {
      setToast({ message: 'Erro ao carregar motoristas', type: 'error' });
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
      handleCloseForm();
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
      observacoes: motorista.observacoes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este motorista?')) return;
    try {
      await adminService.deleteMotorista(id);
      setToast({ message: 'Motorista excluído com sucesso', type: 'success' });
      loadMotoristas();
    } catch {
      setToast({ message: 'Erro ao excluir motorista', type: 'error' });
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingMotorista(null);
    setFormData(EMPTY_FORM);
  };

  const formatCPF = (v) => {
    const d = v.replace(/\D/g, '');
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
  };

  const formatPhone = (v) => {
    const d = v.replace(/\D/g, '');
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
  };

  const formatCPFData = (v) => {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length !== 11) return null;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
  };

  const formatPhoneData = (v) => {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length !== 11) return null;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
  };

  const excelDateToString = (val) => {
    if (!val) return null;
    if (typeof val === 'string') {
      if (val.includes('/')) {
        const p = val.split('/');
        return `${p[2]}-${p[1]}-${p[0]}`;
      }
      return val;
    }
    if (typeof val === 'number') {
      const base = new Date(1900, 0, 1);
      const date = new Date(base.getTime() + (val - 1) * 86400000);
      return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    }
    if (val instanceof Date) {
      return `${val.getFullYear()}-${String(val.getMonth()+1).padStart(2,'0')}-${String(val.getDate()).padStart(2,'0')}`;
    }
    return null;
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'TRANSPORTADORA': 'GEO TRANSPORTES', 'MOTORISTA': 'João da Silva',
      'CPF': '123.456.789-10', 'VÍNCULO': 'AGREGADO', 'RASTREADOR': 'SASCAR',
      'EXP. CADASTRO': '2025-12-31', 'STATUS': '', 'CAVALO': 'GES-0001',
      'RAST. CAVALO': 'SASCAR', 'EXP. CAVALO': '2025-12-31', 'ST.': '',
      'CARRETA': 'GES-00001', 'RAST. CARRETA': 'SASCAR', 'EXP. CARRETA': '2025-12-31',
      'ST.2': '', 'TELEFONE': '92985284321', 'OBSERVAÇÕES': ''
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Motoristas');
    XLSX.writeFile(wb, 'template_motoristas.xlsx');
  };

  const handleImportFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (raw.length < 2) throw new Error('Planilha vazia');

      const headerRow = raw[0];
      const normalize = s => String(s||'').toLowerCase().trim().replace(/[\.\-_]/g,'').replace(/\s+/g,' ');
      const normalizedHeaders = headerRow.map(normalize);
      const colToField = normalizedHeaders.map(h => {
        if (h.includes('transportadora')) return 'transportadora';
        if (h.includes('nome') || h.includes('motorista')) return 'nome';
        if (h === 'cpf') return 'cpf';
        if (h.includes('vinculo')) return 'vinculo';
        if (h.includes('carreta') && h.includes('rastreador')) return 'rastreadorCarreta';
        if (h.includes('carreta') && h.includes('exp')) return 'expCadastroCarreta';
        if (h.includes('carreta')) return 'carreta';
        if (h.includes('cavalo') && h.includes('rastreador')) return 'rastreadorCavalo';
        if (h.includes('cavalo') && h.includes('exp')) return 'expCadastroCavalo';
        if (h.includes('cavalo')) return 'cavalo';
        if (h.includes('rastreador')) return 'rastreador';
        if (h.includes('exp') && h.includes('cadastro')) return 'expCadastroMotorista';
        if (h.includes('telefone')) return 'telefone';
        if (h.includes('observ')) return 'observacoes';
        return null;
      });

      const mapped = raw.slice(1).map((row, idx) => {
        const out = { rowIndex: idx + 2 };
        row.forEach((cell, col) => {
          const field = colToField[col];
          if (!field) return;
          out[field] = ['expCadastroMotorista','expCadastroCavalo','expCadastroCarreta'].includes(field)
            ? excelDateToString(cell) : cell;
        });
        return out;
      });

      const vinculoMap = { proprio:'PRÓPRIO', agregado:'AGREGADO', terceiro:'TERCEIRO', frota:'PRÓPRIO' };
      const existing = (await adminService.getMotoristas()).data.motoristas || [];
      const normCpf = s => String(s||'').replace(/\D/g,'');
      const errors = [], success = [];

      for (const m of mapped) {
        try {
          if (!m.transportadora?.toString().trim()) throw new Error('Transportadora obrigatória');
          if (!m.nome?.toString().trim()) throw new Error('Nome obrigatório');
          if (!m.cpf) throw new Error('CPF obrigatório');
          if (!m.telefone) throw new Error('Telefone obrigatório');
          const cpfFmt = formatCPFData(m.cpf);
          if (!cpfFmt) throw new Error(`CPF inválido: ${m.cpf}`);
          const telFmt = formatPhoneData(m.telefone);
          if (!telFmt) throw new Error(`Telefone inválido: ${m.telefone}`);
          const vinculo = vinculoMap[(m.vinculo||'AGREGADO').toString().toLowerCase().trim()];
          if (!vinculo) throw new Error(`Vínculo inválido: ${m.vinculo}`);
          const prepared = {
            transportadora: m.transportadora.toString().trim(), nome: m.nome.toString().trim(),
            cpf: cpfFmt, vinculo, rastreador: m.rastreador?.toString().trim() || '-',
            expCadastroMotorista: m.expCadastroMotorista || null,
            cavalo: m.cavalo?.toString().trim() || '', rastreadorCavalo: m.rastreadorCavalo?.toString().trim() || '',
            expCadastroCavalo: m.expCadastroCavalo || null, carreta: m.carreta?.toString().trim() || '',
            rastreadorCarreta: m.rastreadorCarreta?.toString().trim() || '', expCadastroCarreta: m.expCadastroCarreta || null,
            telefone: telFmt, observacoes: m.observacoes?.toString().trim() || '',
          };
          const match = existing.find(e => normCpf(e.cpf) === normCpf(prepared.cpf));
          if (match) await adminService.updateMotorista(match._id, prepared);
          else await adminService.createMotorista(prepared);
          success.push(`Linha ${m.rowIndex}: OK`);
        } catch (err) {
          errors.push(`Linha ${m.rowIndex}: ${err.response?.data?.message || err.message}`);
        }
      }
      setToast(errors.length === 0
        ? { message: `Importação concluída: ${success.length} motorista(s) importado(s).`, type: 'success' }
        : { message: `${success.length} importado(s), ${errors.length} erro(s): ${errors.slice(0,3).join('; ')}`, type: 'warning' }
      );
      loadMotoristas();
    } catch (err) {
      setToast({ message: 'Erro ao importar: ' + (err.message || 'erro desconhecido'), type: 'error' });
    } finally {
      setImportLoading(false);
      event.target.value = '';
    }
  };

  const getDisplayedMotoristas = () => {
    let list = motoristas.filter(m => {
      const matchT = !filters.transportadora || m.transportadora.toLowerCase().includes(filters.transportadora.toLowerCase());
      const matchV = !filters.vinculo || m.vinculo === filters.vinculo;
      const matchS = !filters.status || m.statusMotorista === filters.status;
      const matchQ = !filters.searchTerm ||
        m.nome.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        m.cpf.includes(filters.searchTerm);
      return matchT && matchV && matchS && matchQ;
    });
    list.sort((a, b) => {
      let av = a[sort.column] ?? '', bv = b[sort.column] ?? '';
      if (typeof av === 'string') {
        return sort.direction === 'asc' ? av.toLowerCase().localeCompare(bv.toLowerCase()) : bv.toLowerCase().localeCompare(av.toLowerCase());
      }
      return sort.direction === 'asc' ? av - bv : bv - av;
    });
    return list;
  };

  const handleSort = (col) => {
    setSort(s => s.column === col
      ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' }
      : { column: col, direction: 'asc' }
    );
  };

  const Th = ({ col, children }) => (
    <th
      onClick={() => handleSort(col)}
      className="px-3 py-3.5 text-left text-xs font-bold text-white uppercase tracking-wide cursor-pointer select-none hover:bg-indigo-700/50 transition-colors whitespace-nowrap"
    >
      {children}
      <SortIcon column={col} sort={sort} />
    </th>
  );

  const displayed = getDisplayedMotoristas();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-indigo-50/30 font-sans">

      {/* ══════ HEADER ══════ */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl border-b border-slate-700">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/home')}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all"
              >
                <FiArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <FiTruck size={17} className="text-indigo-400" />
                  <h1 className="text-lg font-bold tracking-tight">Cadastro de Motoristas</h1>
                </div>
                <p className="text-slate-400 text-xs mt-0.5 pl-6">Gerencie os motoristas da sua frota</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold border border-indigo-600/50 shadow-sm shadow-indigo-500/20 transition-all"
              >
                <FiPlus size={14} /> Novo Motorista
              </button>
              <label className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 text-white text-xs font-bold border border-emerald-600/50 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer">
                {importLoading
                  ? <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Importando...</>
                  : <><FiUploadCloud size={14} /> Importar Excel</>
                }
                <input type="file" accept=".xls,.xlsx" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={handleImportFile} disabled={importLoading} />
              </label>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold transition-all"
              >
                <FiDownload size={13} /> Template
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-5">

        {/* ══════ FORM FULLSCREEN ══════ */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-auto flex items-start justify-center pt-8 pb-12">
            <div className="w-full max-w-5xl mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

              {/* Form Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                    <FiUser size={15} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">{editingMotorista ? 'Editar Motorista' : 'Novo Motorista'}</h2>
                    <p className="text-slate-400 text-xs">Preencha os dados do motorista e equipamentos</p>
                  </div>
                </div>
                <button onClick={handleCloseForm} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition">
                  <FiX size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Seção: Dados Pessoais */}
                <div>
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                    <div className="w-1.5 h-5 rounded-full bg-indigo-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Dados Pessoais</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <FieldLabel required>Transportadora</FieldLabel>
                      <FormInput icon={FiTruck} type="text" value={formData.transportadora}
                        onChange={e => setFormData({...formData, transportadora: e.target.value})}
                        placeholder="Ex: GEO TRANSPORTES" />
                    </div>
                    <div>
                      <FieldLabel required>Nome do Motorista</FieldLabel>
                      <FormInput icon={FiUser} type="text" value={formData.nome}
                        onChange={e => setFormData({...formData, nome: e.target.value})}
                        placeholder="Nome completo" />
                    </div>
                    <div>
                      <FieldLabel required>CPF</FieldLabel>
                      <FormInput type="text" value={formData.cpf}
                        onChange={e => setFormData({...formData, cpf: formatCPF(e.target.value)})}
                        placeholder="000.000.000-00" maxLength={14} />
                    </div>
                    <div>
                      <FieldLabel required>Vínculo</FieldLabel>
                      <FormSelect value={formData.vinculo} onChange={e => setFormData({...formData, vinculo: e.target.value})}>
                        <option>PRÓPRIO</option>
                        <option>AGREGADO</option>
                        <option>TERCEIRO</option>
                      </FormSelect>
                    </div>
                    <div>
                      <FieldLabel required>Telefone</FieldLabel>
                      <FormInput icon={FiPhone} type="text" value={formData.telefone}
                        onChange={e => setFormData({...formData, telefone: formatPhone(e.target.value)})}
                        placeholder="(00) 00000-0000" maxLength={15} />
                    </div>
                    <div>
                      <FieldLabel>Rastreador</FieldLabel>
                      <FormInput icon={FiCpu} type="text" value={formData.rastreador}
                        onChange={e => setFormData({...formData, rastreador: e.target.value})}
                        placeholder="Ex: SASCAR" />
                    </div>
                    <div>
                      <FieldLabel>Exp. Cadastro Motorista</FieldLabel>
                      <FormInput icon={FiCalendar} type="date" value={formData.expCadastroMotorista}
                        onChange={e => setFormData({...formData, expCadastroMotorista: e.target.value})} />
                    </div>
                  </div>
                </div>

                {/* Seção: Equipamentos */}
                <div>
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                    <div className="w-1.5 h-5 rounded-full bg-cyan-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Equipamentos</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label:'Cavalo', field:'cavalo', rastr:'rastreadorCavalo', exp:'expCadastroCavalo' },
                      { label:'Carreta', field:'carreta', rastr:'rastreadorCarreta', exp:'expCadastroCarreta' },
                    ].map(({ label, field, rastr, exp }) => (
                      <div key={field} className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</p>
                        <div>
                          <FieldLabel>Placa / ID</FieldLabel>
                          <FormInput type="text" value={formData[field]}
                            onChange={e => setFormData({...formData, [field]: e.target.value})}
                            placeholder={`Placa do ${label.toLowerCase()}`} />
                        </div>
                        <div>
                          <FieldLabel>Rastreador</FieldLabel>
                          <FormInput type="text" value={formData[rastr]}
                            onChange={e => setFormData({...formData, [rastr]: e.target.value})}
                            placeholder="Ex: SASCAR" />
                        </div>
                        <div>
                          <FieldLabel>Exp. Cadastro</FieldLabel>
                          <FormInput type="date" value={formData[exp]}
                            onChange={e => setFormData({...formData, [exp]: e.target.value})} />
                        </div>
                      </div>
                    ))}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Observações</p>
                      <textarea
                        value={formData.observacoes}
                        onChange={e => setFormData({...formData, observacoes: e.target.value})}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none placeholder:text-slate-400"
                        rows={5} placeholder="Observações adicionais..." />
                    </div>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition">
                    {editingMotorista ? 'Atualizar Motorista' : 'Criar Motorista'}
                  </button>
                  <button type="button" onClick={() => setFormData(EMPTY_FORM)}
                    className="px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-sm font-bold transition">
                    Limpar
                  </button>
                  <button type="button" onClick={handleCloseForm}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════ FILTROS ══════ */}
        {motoristas.length > 0 && !loading && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <FiFilter size={14} className="text-indigo-500" />
                </div>
                <span className="text-sm font-bold text-slate-700">Filtros</span>
                {(filters.searchTerm || filters.transportadora || filters.vinculo || filters.status) && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Ativo</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  <span className="font-bold text-slate-800">{displayed.length}</span> de {motoristas.length} registros
                </span>
                <button
                  onClick={() => setFilters({ transportadora: '', vinculo: '', status: '', searchTerm: '' })}
                  className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 rounded-lg font-semibold text-slate-500 transition-all"
                >
                  Limpar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Buscar nome ou CPF..."
                  value={filters.searchTerm}
                  onChange={e => setFilters({...filters, searchTerm: e.target.value})}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition" />
              </div>
              <div className="relative">
                <FiTruck size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Filtrar transportadora..."
                  value={filters.transportadora}
                  onChange={e => setFilters({...filters, transportadora: e.target.value})}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition" />
              </div>
              <select value={filters.vinculo} onChange={e => setFilters({...filters, vinculo: e.target.value})}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition">
                <option value="">Todos os vínculos</option>
                <option>PRÓPRIO</option><option>AGREGADO</option><option>TERCEIRO</option>
              </select>
              <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition">
                <option value="">Todos os status</option>
                <option>A VENCER</option><option>VENCIDO</option>
              </select>
            </div>
          </div>
        )}

        {/* ══════ TABELA ══════ */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-500 animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Carregando motoristas...</p>
          </div>
        ) : motoristas.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FiTruck size={28} className="text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">Nenhum motorista cadastrado</h3>
            <p className="text-sm text-slate-400">Clique em "Novo Motorista" para começar</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-600 to-indigo-700 sticky top-0">
                    <Th col="transportadora">Transportadora</Th>
                    <Th col="nome">Motorista</Th>
                    <Th col="cpf">CPF</Th>
                    <Th col="vinculo">Vínculo</Th>
                    <Th col="rastreador">Rastreador</Th>
                    <Th col="expCadastroMotorista">Exp. Cadastro</Th>
                    <th className="px-3 py-3.5 text-center text-xs font-bold text-white uppercase tracking-wide">Status</th>
                    <Th col="cavalo">Cavalo</Th>
                    <Th col="rastreadorCavalo">Rast. Cavalo</Th>
                    <Th col="expCadastroCavalo">Exp. Cavalo</Th>
                    <th className="px-3 py-3.5 text-center text-xs font-bold text-white uppercase tracking-wide">St.</th>
                    <Th col="carreta">Carreta</Th>
                    <Th col="rastreadorCarreta">Rast. Carreta</Th>
                    <Th col="expCadastroCarreta">Exp. Carreta</Th>
                    <th className="px-3 py-3.5 text-center text-xs font-bold text-white uppercase tracking-wide">St.</th>
                    <Th col="telefone">Telefone</Th>
                    <th className="px-3 py-3.5 text-center text-xs font-bold text-white uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayed.map((m, idx) => (
                    <tr key={m._id} className={`hover:bg-indigo-50/40 transition-colors duration-150 ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                      <td className="px-3 py-3 font-semibold text-slate-800 whitespace-nowrap">{m.transportadora}</td>
                      <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{m.nome}</td>
                      <td className="px-3 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">{m.cpf}</td>
                      <td className="px-3 py-3"><VinculoBadge vinculo={m.vinculo} /></td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{m.rastreador || '—'}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {m.expCadastroMotorista ? new Date(m.expCadastroMotorista).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-3 text-center"><StatusBadge status={m.statusMotorista} /></td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{m.cavalo || '—'}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{m.rastreadorCavalo || '—'}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {m.expCadastroCavalo ? new Date(m.expCadastroCavalo).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-3 text-center"><StatusBadge status={m.statusCavalo} /></td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{m.carreta || '—'}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{m.rastreadorCarreta || '—'}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {m.expCadastroCarreta ? new Date(m.expCadastroCarreta).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-3 text-center"><StatusBadge status={m.statusCarreta} /></td>
                      <td className="px-3 py-3 text-slate-600 text-xs whitespace-nowrap">{m.telefone}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => handleEdit(m)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-100 transition">
                            <FiEdit2 size={11} /> Editar
                          </button>
                          <button onClick={() => handleDelete(m._id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-100 transition">
                            <FiTrash2 size={11} /> Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
              <span>Exibindo <span className="font-semibold text-slate-600">{displayed.length}</span> de <span className="font-semibold text-slate-600">{motoristas.length}</span> motoristas</span>
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default MotoristaManagement;
