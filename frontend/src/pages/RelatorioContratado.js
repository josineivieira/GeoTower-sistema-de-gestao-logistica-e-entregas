import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCity } from '../contexts/CityContext';
import { formatarAgendamento } from '../utils/date';
import {
  FaArrowLeft, FaDownload, FaFilter, FaSync, FaChartBar,
  FaTruck, FaBoxes, FaCalendarAlt
} from 'react-icons/fa';
import Toast from '../components/Toast';
import api from '../services/api';
import { exportToExcel } from '../services/exportService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const RelatorioContratado = () => {
  const navigate = useNavigate();

  // State
  const { city } = useCity();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [contratados, setContratados] = useState([]);
  const [dados, setDados] = useState([]);
  const [resumo, setResumo] = useState({
    totalEntregas: 0,
    totalContratados: 0
  });

  const getAgendaDate = (d) => {
    if (city === 'itajai') {
      return d.dtColeta || d.dtAgendamentoDescarga || d.dataAgendamento || d.createdAt;
    }
    return d.dtAgendamentoDescarga || d.dataAgendamento || d.createdAt;
  };

  const getAgendaLabel = () => (city === 'itajai' ? 'Dt Coleta' : 'Data Agendamento');
  const [resumoPorContratado, setResumoPorContratado] = useState({});

  const parseDateInput = (value, endOfDay = false) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  };

  const getNumeroProcesso = (d) => {
    return String(
      d.nrProcesso ||
      d['Nr. do processo'] ||
      d['Nr do processo'] ||
      d['Nro. do processo'] ||
      d['Numero do processo'] ||
      d.processo ||
      d.geomaritima ||
      d.codigo ||
      ''
    ).trim();
  };

  const getProcessoKey = (d) => {
    const numeroProcesso = getNumeroProcesso(d).toUpperCase();
    return numeroProcesso || `SEM_PROCESSO_${d._id || d.codigo || Math.random()}`;
  };

  const agruparPorProcesso = (lista) => {
    const grupos = new Map();

    lista.forEach((item) => {
      const key = getProcessoKey(item);
      const existente = grupos.get(key);

      if (!existente) {
        grupos.set(key, {
          ...item,
          numeroProcessoRelatorio: getNumeroProcesso(item),
          linhasAgrupadas: 1
        });
        return;
      }

      const atualDate = getAgendaDate(item) ? new Date(getAgendaDate(item)).getTime() : 0;
      const existenteDate = getAgendaDate(existente) ? new Date(getAgendaDate(existente)).getTime() : 0;
      const base = atualDate > existenteDate ? item : existente;

      grupos.set(key, {
        ...base,
        numeroProcessoRelatorio: getNumeroProcesso(base) || existente.numeroProcessoRelatorio,
        linhasAgrupadas: (existente.linhasAgrupadas || 1) + 1
      });
    });

    return Array.from(grupos.values());
  };

  // Filtros
  const [filtros, setFiltros] = useState({
    contratado: '',
    dataInicio: '',
    dataFim: ''
  });

  // Carrega a lista de contratados ao montar
  useEffect(() => {
    loadContratados();
  }, []);

  const loadContratados = async () => {
    try {
      const response = await api.get('/icompany/contratados-unicos');
      if (response.data.ok) {
        setContratados(response.data.contratados || []);
      }
    } catch (err) {
      console.error('Erro ao carregar contratados:', err);
      showToast('Erro ao carregar lista de contratados', 'error');
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFiltroChange = (field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  };

  // Função para aplicar filtros aos dados
  const aplicarFiltros = (dadosCompletos) => {
    let dadosFiltrados = [...dadosCompletos];

    // Filtro por contratado
    if (filtros.contratado && filtros.contratado.trim()) {
      dadosFiltrados = dadosFiltrados.filter(d => 
        d.contratado && d.contratado.toLowerCase() === filtros.contratado.toLowerCase()
      );
    }

    // Filtro por data início
    if (filtros.dataInicio) {
      const dataInicio = parseDateInput(filtros.dataInicio);
      dadosFiltrados = dadosFiltrados.filter(d => {
        const dataEntrega = new Date(getAgendaDate(d));
        return dataEntrega >= dataInicio;
      });
    }

    // Filtro por data fim
    if (filtros.dataFim) {
      const dataFim = parseDateInput(filtros.dataFim, true);
      dadosFiltrados = dadosFiltrados.filter(d => {
        const dataEntrega = new Date(getAgendaDate(d));
        return dataEntrega <= dataFim;
      });
    }

    return dadosFiltrados;
  };

  const loadRelatorio = async () => {
    try {
      setLoading(true);

      // Busca TODOS os dados do backend (sem filtrar)
      const response = await api.get(`/icompany/relatorio-contratado`);

      if (response.data.ok) {
        const todosOsDados = response.data.dados || [];
        // Aplica filtros no frontend e conta cada Nr. do Processo uma unica vez
        const dadosBase = aplicarFiltros(todosOsDados);
        const dadosFiltrados = agruparPorProcesso(dadosBase);

        // Calcula resumo com dados filtrados
        const totalEntregas = dadosFiltrados.length;
        const totalContratados = new Set(dadosFiltrados.map(d => d.contratado || 'SEM CONTRATADO')).size;

        const resumoPorContratado = {};
        dadosFiltrados.forEach(d => {
          const c = d.contratado || 'SEM CONTRATADO';
          if (!resumoPorContratado[c]) {
            resumoPorContratado[c] = { quantidade: 0 };
          }
          resumoPorContratado[c].quantidade += 1;
        });

        setDados(dadosFiltrados);
        setResumo({
          totalEntregas,
          totalContratados
        });
        setResumoPorContratado(resumoPorContratado);
        
        if (dadosFiltrados.length === 0 && (filtros.dataInicio || filtros.dataFim || filtros.contratado)) {
          showToast('Nenhum resultado encontrado com os filtros aplicados', 'warning');
        } else {
          showToast(`${totalEntregas} entrega(s) encontrada(s)`);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar relatório:', err);
      showToast('Erro ao carregar relatório', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLimparFiltros = () => {
    setFiltros({
      contratado: '',
      dataInicio: '',
      dataFim: ''
    });
    setDados([]);
    setResumo({ totalEntregas: 0, totalContratados: 0 });
    setResumoPorContratado({});
  };

  const exportarExcel = () => {
    if (dados.length === 0) {
      showToast('Nenhum dado para exportar', 'warning');
      return;
    }

    const labelAgenda = getAgendaLabel();
    const exportDados = dados.map(d => ({
      'Nr. do Processo': d.numeroProcessoRelatorio || getNumeroProcesso(d),
      'Contratado': d.contratado,
      'Destinatário': d.destinatario,
      'Container': d.containerNumero || '—',
      [labelAgenda]: getAgendaDate(d) ? formatarAgendamento(getAgendaDate(d)) : '—',
      'Motorista': d.motorista,
    }));

    exportToExcel(exportDados, 'Relatorio_Contratado');
    showToast('Relatório exportado em Excel');
  };

  const exportarPDF = () => {
    if (dados.length === 0) {
      showToast('Nenhum dado para exportar', 'warning');
      return;
    }

    const doc = new jsPDF();
    const margin = 10;

    // Título
    doc.setFontSize(16);
    doc.setFont('arial', 'bold');
    doc.text('Relatório de Contratados', margin, 15);

    // Filtros aplicados
    doc.setFontSize(10);
    doc.setFont('arial', 'normal');
    let yPos = 25;
    if (filtros.contratado) {
      doc.text(`Contratado: ${filtros.contratado}`, margin, yPos);
      yPos += 5;
    }
    if (filtros.dataInicio || filtros.dataFim) {
      const dataStr = `${filtros.dataInicio || 'qualquer'} até ${filtros.dataFim || 'qualquer'}`;
      doc.text(`Período: ${dataStr}`, margin, yPos);
      yPos += 5;
    }
    doc.text(`Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}`, margin, yPos);

    // Tabela de resumo
    yPos += 8;
    doc.setFontSize(12);
    doc.setFont('arial', 'bold');
    doc.text('Resumo Geral', margin, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor']],
      body: [
        ['Processos únicos', resumo.totalEntregas.toString()],
        ['Contratados', resumo.totalContratados.toString()],
      ],
      margin: margin,
      didDrawPage: () => {},
    });

    // Tabela de detalhamento
    yPos = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('arial', 'bold');
    doc.text('Detalhamento de Entregas', margin, yPos);
    yPos += 6;

    const labelAgendaPDF = getAgendaLabel();
    const tableData = dados.map(d => [
      d.numeroProcessoRelatorio || getNumeroProcesso(d),
      d.contratado || '—',
      d.destinatario || '—',
      d.containerNumero || '—',
      getAgendaDate(d) ? formatarAgendamento(getAgendaDate(d)) : '—',
      d.motorista || '—',
    ]);


    autoTable(doc, {
      startY: yPos,
      head: [['Nr. do Processo', 'Contratado', 'Destinatário', 'Container', labelAgendaPDF, 'Motorista']],
      body: tableData,
      margin: margin,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    doc.save(`Relatorio_Contratado_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('Relatório exportado em PDF');
  };

  const formatDate = (date) => {
    if (!date) return '—';
    try {
      return formatarAgendamento(date);
    } catch {
      return '—';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/')}
          className="p-2.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-600 active:scale-95 transition-all shadow-sm"
        >
          <FaArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <FaChartBar className="text-white" size={22} />
            </div>
            Relatório de Contratados
          </h1>
          <p className="text-slate-500 text-sm mt-1">Consulte entregas por contratado com filtros avançados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FaFilter size={18} className="text-amber-500" />
          Filtros
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Contratado */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              <FaTruck size={12} className="inline mr-1" />
              Contratado
            </label>
            <select
              value={filtros.contratado}
              onChange={e => handleFiltroChange('contratado', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition bg-white"
            >
              <option value="">Todos os Contratados</option>
              {contratados.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Data Início */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              <FaCalendarAlt size={12} className="inline mr-1" />
              Data Início
            </label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={e => handleFiltroChange('dataInicio', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
            />
          </div>

          {/* Data Fim */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              <FaCalendarAlt size={12} className="inline mr-1" />
              Data Fim
            </label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={e => handleFiltroChange('dataFim', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
            />
          </div>

        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={loadRelatorio}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FaSync size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Carregando...' : 'Buscar'}
          </button>
          <button
            onClick={handleLimparFiltros}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Resumo */}
      {dados.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Card Total Entregas */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-5 border border-blue-200/50 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <FaBoxes className="text-blue-600" size={18} />
                </div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Processos Únicos</p>
              </div>
              <p className="text-3xl font-bold text-blue-700">{resumo.totalEntregas}</p>
            </div>

            {/* Card Contratados */}
            <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-5 border border-green-200/50 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center">
                  <FaTruck className="text-green-600" size={18} />
                </div>
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Contratados</p>
              </div>
              <p className="text-3xl font-bold text-green-700">{resumo.totalContratados}</p>
            </div>

          </div>

          {/* Resumo por Contratado */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Resumo por Contratado</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Contratado</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Processos Únicos</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(resumoPorContratado).map(([contratado, resumo]) => (
                    <tr key={contratado} className="border-b border-slate-100/50 hover:bg-blue-50/30 transition">
                      <td className="px-4 py-3 font-medium text-slate-900">{contratado}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-semibold">{resumo.quantidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela de Entregas */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-lg font-bold text-slate-900">Detalhamento de Entregas</h3>
              <div className="flex gap-2">
                <button
                  onClick={exportarPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 active:scale-95 transition-all"
                >
                  <FaDownload size={14} />
                  Exportar PDF
                </button>
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 active:scale-95 transition-all"
                >
                  <FaDownload size={14} />
                  Exportar Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nr. do Processo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Contratado</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Destinatário</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Container</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">{getAgendaLabel()}</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Motorista</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.map((d, idx) => (
                    <tr key={idx} className="border-b border-slate-100/50 hover:bg-blue-50/30 transition">
                      <td className="px-4 py-3 font-medium text-slate-900">{d.numeroProcessoRelatorio || getNumeroProcesso(d) || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{d.contratado || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{d.destinatario || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{d.containerNumero || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(getAgendaDate(d))}</td>
                      <td className="px-4 py-3 text-slate-700">{d.motorista || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Vazio */}
      {!loading && dados.length === 0 && (
        <div className="text-center py-16">
          <FaChartBar size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 text-lg font-medium">Nenhum resultado encontrado</p>
          <p className="text-slate-400 text-sm">Clique em "Buscar" para gerar o relatório com os filtros selecionados</p>
        </div>
      )}
    </div>
  );
};

export default RelatorioContratado;
