import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { FaArrowLeft, FaEdit, FaTrash, FaPlus, FaTruck, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';

const MotoristaManagement = () => {
  const navigate = useNavigate();
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMotorista, setEditingMotorista] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    transportadora: '',
    vinculo: '',
    status: '',
    searchTerm: ''
  });
  // Ordenação
  const [sort, setSort] = useState({ column: 'transportadora', direction: 'asc' });
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

  // Format CPF
  const formatCPFData = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 11) return null;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  // Format Telefone
  const formatPhoneData = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 11) return null;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  // Download Template
  const downloadTemplate = () => {
    const template = [
      {
        transportadora: 'GEO TRANSPORTES',
        nome: 'João da Silva',
        cpf: '123.456.789-10',
        vinculo: 'AGREGADO',
        rastreador: 'SASCAR',
        'exp cadastro motorista': '2025-12-31',
        cavalo: 'GES-0001',
        'rastreador cavalo': 'SASCAR',
        'exp cadastro cavalo': '2025-12-31',
        carreta: 'GES-00001',
        'rastreador carreta': 'SASCAR',
        'exp cadastro carreta': '2025-12-31',
        telefone: '92985284321',
        observacoes: 'Observações do motorista'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Motoristas');
    XLSX.writeFile(wb, 'template_motoristas.xlsx');
  };

  // Import Excel
  const handleImportFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // normalizes header text: lowercase, trim, remove dots/spaces, singularize plurals
      const normalize = s => {
        let t = String(s || '').toLowerCase().trim();
        // remove punctuation and extra spaces
        t = t.replace(/[\.\-_]/g, '').replace(/\s+/g, ' ');
        // singularize (naive): drop trailing s if not part of plural word like 'gps'
        if (t.endsWith('s') && !t.endsWith('rs') && !t.endsWith('is')) {
          t = t.slice(0, -1);
        }
        return t;
      };
      const headersMap = {
        transportadora: ['transportadora','transportadoras','empresa','contratado','contratada'],
        nome: ['nome','motorista'],
        cpf: ['cpf','c.p.f'],
        vinculo: ['vínculo','vinculo'],
        rastreador: ['rastreador'],
        expCadastroMotorista: ['exp cadastro motorista','expcadastromotorista','exp cadastro','exp motoristas','exp cadastramento motorista'],
        cavalo: ['cavalo'],
        rastreadorCavalo: ['rastreadorcavalo','rastreador cavalo'],
        expCadastroCavalo: ['exp cadastro cavalo','expcadastrcavalo'],
        carreta: ['carreta'],
        rastreadorCarreta: ['rastreadorcarreta','rastreador carreta'],
        expCadastroCarreta: ['exp cadastro carreta','expcadastrcarreta'],
        telefone: ['telefone','tel'],
        observacoes: ['observacoes','observações','obs','observ']
      };

      // map row keys to form keys
      const mapped = rows.map((r, idx) => {
        const out = { rowIndex: idx + 2 }; // Excel row number
        Object.keys(headersMap).forEach(key => {
          const vals = headersMap[key];
          const found = Object.keys(r).find(h => vals.includes(normalize(h)));
          out[key] = found ? r[found] : '';
        });
        return out;
      });

      // validate and format before sending
      const validVinculos = ['PRÓPRIO', 'AGREGADO', 'TERCEIRO'];
      const errors = [];
      const success = [];

      // send each to backend. update if CPF already exists
      const existing = (await adminService.getMotoristas()).data.motoristas || [];
      const normalizeCpf = s => String(s || '').replace(/\D/g, '');
      
      for (const m of mapped) {
        try {
          // Validate required fields
          if (!m.transportadora || !m.transportadora.toString().trim()) {
            throw new Error('Transportadora obrigatória');
          }
          if (!m.nome || !m.nome.toString().trim()) {
            throw new Error('Nome obrigatório');
          }
          if (!m.cpf) {
            throw new Error('CPF obrigatório');
          }
          if (!m.telefone) {
            throw new Error('Telefone obrigatório');
          }

          // Format CPF
          const cpfFormatted = formatCPFData(m.cpf);
          if (!cpfFormatted) {
            throw new Error(`CPF deve ter 11 dígitos: ${m.cpf}`);
          }

          // Format Telefone
          const telefoneFormatted = formatPhoneData(m.telefone);
          if (!telefoneFormatted) {
            throw new Error(`Telefone deve ter 11 dígitos: ${m.telefone}`);
          }

          // Validate Vinculo
          const vinculo = (m.vinculo || 'AGREGADO').toUpperCase().trim();
          if (!validVinculos.includes(vinculo)) {
            throw new Error(`Vínculo inválido: ${m.vinculo}. Aceitos: ${validVinculos.join(', ')}`);
          }

          const prepared = {
            transportadora: m.transportadora.toString().trim(),
            nome: m.nome.toString().trim(),
            cpf: cpfFormatted,
            vinculo: vinculo,
            rastreador: m.rastreador ? m.rastreador.toString().trim() : '-',
            expCadastroMotorista: m.expCadastroMotorista ? m.expCadastroMotorista : null,
            cavalo: m.cavalo ? m.cavalo.toString().trim() : '',
            rastreadorCavalo: m.rastreadorCavalo ? m.rastreadorCavalo.toString().trim() : '',
            expCadastroCavalo: m.expCadastroCavalo ? m.expCadastroCavalo : null,
            carreta: m.carreta ? m.carreta.toString().trim() : '',
            rastreadorCarreta: m.rastreadorCarreta ? m.rastreadorCarreta.toString().trim() : '',
            expCadastroCarreta: m.expCadastroCarreta ? m.expCadastroCarreta : null,
            telefone: telefoneFormatted,
            observacoes: m.observacoes ? m.observacoes.toString().trim() : ''
          };

          const match = existing.find(e => normalizeCpf(e.cpf) === normalizeCpf(prepared.cpf));
          if (match) {
            await adminService.updateMotorista(match._id, prepared);
          } else {
            await adminService.createMotorista(prepared);
          }
          success.push(`Linha ${m.rowIndex}: OK`);
        } catch (err) {
          const msg = err.response?.data?.message || err.message || 'Erro desconhecido';
          errors.push(`Linha ${m.rowIndex}: ${msg}`);
        }
      }

      // Show results
      if (errors.length === 0) {
        setToast({ message: `✅ Importação completa! ${success.length} motorista(s) importado(s).`, type: 'success' });
      } else {
        setToast({ message: `⚠️ ${success.length} importado(s), ${errors.length} erro(s): ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`, type: 'warning' });
      }
      
      loadMotoristas();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao importar arquivo: ' + (err.message || 'erro desconhecido'), type: 'error' });
    } finally {
      setImportLoading(false);
      event.target.value = '';
    }
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

  // Filtrar e ordenar motoristas
  const getDisplayedMotoristas = () => {
    let display = motoristas.filter(m => {
      const matchTransportadora = !filters.transportadora || m.transportadora.toLowerCase().includes(filters.transportadora.toLowerCase());
      const matchVinculo = !filters.vinculo || m.vinculo === filters.vinculo;
      const matchStatus = !filters.status || m.statusMotorista === filters.status;
      const matchSearch = !filters.searchTerm || 
        m.nome.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        m.cpf.includes(filters.searchTerm);
      return matchTransportadora && matchVinculo && matchStatus && matchSearch;
    });

    // Ordenar
    display.sort((a, b) => {
      let aVal = a[sort.column];
      let bVal = b[sort.column];
      
      // Handle null/undefined
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      
      // String comparison
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
        return sort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      // Number comparison
      return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return display;
  };

  const handleSort = (column) => {
    if (sort.column === column) {
      setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ column, direction: 'asc' });
    }
  };

  const SortIcon = ({ column }) => {
    if (sort.column !== column) return <span className="ml-1 text-gray-400">⇅</span>;
    return <span className="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20 w-full">
      <div className="max-w-screen-2xl mx-auto px-6 py-10">
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              <FaPlus /> Novo Motorista
            </button>
            <label className="relative inline-flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold cursor-pointer">
              <FaFileExcel /> {importLoading ? 'Importando...' : 'Importar Excel'}
              <input
                type="file"
                accept=".xls,.xlsx"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleImportFile}
                disabled={importLoading}
              />
            </label>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-5 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
              title="Baixar template de exemplo"
            >
              <FaFileExcel /> Template
            </button>
          </div>
        </div>

        {/* Fullscreen Form */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-white overflow-auto">
            <div className="max-w-screen-2xl mx-auto px-6 py-8">
              <div className="flex items-center justify-between mb-6 relative">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingMotorista ? 'Editar Motorista' : 'Novo Motorista'}
                </h2>
                <button
                  onClick={handleCloseForm}
                  className="text-gray-500 hover:text-gray-700 text-2xl rounded-full p-2 hover:bg-gray-100 transition absolute right-4 top-4 sm:static sm:top-0 sm:right-0"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-100">
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Transportadora *</label>
                      <input
                        type="text"
                        value={formData.transportadora}
                        onChange={(e) => setFormData({ ...formData, transportadora: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: GEO TRANSPORTES"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Motorista *</label>
                      <input
                        type="text"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: João Silva"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">CPF *</label>
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
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Vínculo *</label>
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
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Rastreador</label>
                      <input
                        type="text"
                        value={formData.rastreador}
                        onChange={(e) => setFormData({ ...formData, rastreador: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: SASCAR"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Exp. cadastro motorista</label>
                      <input
                        type="date"
                        value={formData.expCadastroMotorista}
                        onChange={(e) => setFormData({ ...formData, expCadastroMotorista: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Cavalo</label>
                      <input
                        type="text"
                        value={formData.cavalo}
                        onChange={(e) => setFormData({ ...formData, cavalo: e.target.value })}
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

                <div className="sm:col-span-2 md:col-span-3 lg:col-span-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows="3"
                    placeholder="Digite observações adicionais..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
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
          </div>
        )}

        {/* FILTROS AVANÇADOS */}
        {motoristas.length > 0 && !loading && (
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🔍 FILTROS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Buscar (nome/CPF)</label>
                <input
                  type="text"
                  placeholder="Digite nome ou CPF..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Transportadora</label>
                <input
                  type="text"
                  placeholder="Digite transportadora..."
                  value={filters.transportadora}
                  onChange={(e) => setFilters({ ...filters, transportadora: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Vínculo</label>
                <select
                  value={filters.vinculo}
                  onChange={(e) => setFilters({ ...filters, vinculo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="PRÓPRIO">PRÓPRIO</option>
                  <option value="AGREGADO">AGREGADO</option>
                  <option value="TERCEIRO">TERCEIRO</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="A VENCER">A VENCER</option>
                  <option value="VENCIDO">VENCIDO</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Resultados</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-center">
                  <span className="text-lg font-bold text-blue-600">{getDisplayedMotoristas().length}</span>
                  <p className="text-xs text-gray-600">de {motoristas.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABELA DE MOTORISTAS */}
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
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('transportadora')}>
                      TRANSPORTADORA <SortIcon column="transportadora" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('nome')}>
                      MOTORISTA <SortIcon column="nome" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('cpf')}>
                      CPF <SortIcon column="cpf" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('vinculo')}>
                      VÍNCULO <SortIcon column="vinculo" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('rastreador')}>
                      RASTREADOR <SortIcon column="rastreador" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('expCadastroMotorista')}>
                      EXP. CADASTRO <SortIcon column="expCadastroMotorista" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">STATUS</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('cavalo')}>
                      CAVALO <SortIcon column="cavalo" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('rastreadorCavalo')}>
                      RAST. CAVALO <SortIcon column="rastreadorCavalo" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('expCadastroCavalo')}>
                      EXP. CAVALO <SortIcon column="expCadastroCavalo" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">ST.</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('carreta')}>
                      CARRETA <SortIcon column="carreta" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('rastreadorCarreta')}>
                      RAST. CARRETA <SortIcon column="rastreadorCarreta" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('expCadastroCarreta')}>
                      EXP. CARRETA <SortIcon column="expCadastroCarreta" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">ST.</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort('telefone')}>
                      TELEFONE <SortIcon column="telefone" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {getDisplayedMotoristas().map((motorista) => (
                    <tr key={motorista._id} className="border-b border-gray-100 hover:bg-blue-50 text-sm">
                      <td className="px-3 py-2 font-medium text-gray-900">{motorista.transportadora}</td>
                      <td className="px-3 py-2 text-gray-700">{motorista.nome}</td>
                      <td className="px-3 py-2 text-gray-700 font-mono text-xs">{motorista.cpf}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          motorista.vinculo === 'PRÓPRIO'
                            ? 'bg-green-100 text-green-800'
                            : motorista.vinculo === 'AGREGADO'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {motorista.vinculo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 text-xs">{motorista.rastreador || '-'}</td>
                      <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">
                        {motorista.expCadastroMotorista
                          ? new Date(motorista.expCadastroMotorista).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                          motorista.statusMotorista === 'VENCIDO'
                            ? 'bg-red-100 text-red-800'
                            : motorista.statusMotorista === 'A VENCER'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'text-gray-400'
                        }`}>
                          {motorista.statusMotorista || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 text-xs">{motorista.cavalo || '-'}</td>
                      <td className="px-3 py-2 text-gray-700 text-xs">{motorista.rastreadorCavalo || '-'}</td>
                      <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">
                        {motorista.expCadastroCavalo
                          ? new Date(motorista.expCadastroCavalo).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                          motorista.statusCavalo === 'VENCIDO'
                            ? 'bg-red-100 text-red-800'
                            : motorista.statusCavalo === 'A VENCER'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'text-gray-400'
                        }`}>
                          {motorista.statusCavalo || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 text-xs">{motorista.carreta || '-'}</td>
                      <td className="px-3 py-2 text-gray-700 text-xs">{motorista.rastreadorCarreta || '-'}</td>
                      <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">
                        {motorista.expCadastroCarreta
                          ? new Date(motorista.expCadastroCarreta).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                          motorista.statusCarreta === 'VENCIDO'
                            ? 'bg-red-100 text-red-800'
                            : motorista.statusCarreta === 'A VENCER'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'text-gray-400'
                        }`}>
                          {motorista.statusCarreta || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 text-xs">{motorista.telefone}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleEdit(motorista)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition mr-1"
                        >
                          <FaEdit /> Editar
                        </button>
                        <button
                          onClick={() => handleDelete(motorista._id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
                        >
                          <FaTrash /> Del
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
