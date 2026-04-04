import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaSearch,
  FaSync,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaTable,
  FaDownload,
  FaFileAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaBoxes,
  FaChartPie
} from 'react-icons/fa';
import { adminService } from '../services/authService';
import Toast from '../components/Toast';
import '../styles/ControleProtocolos.css';

/* ─────────────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────────────── */
const FIXED_COLUMNS = ['processo', 'container', 'embarcador', 'destinatario'];

const DOCUMENT_COLUMNS = [
  'CANHOTO DE DANFE',
  'COMPROVANTE DE DESOVA',
  'DIARIO DE BORDO',
  'DISCO/ARQUIVO TACOGRAFO',
  'NOSHOW',
  'RIC DE ABASTECIMENTO',
  'RIC DEPOT DESTINO',
  'RIC PORTO DESTINO',
  'SOLICITAÇÃO DE MONITORAMENTO',
  'VALE PALLET',
  'FOTOS',
  'RIC DEPOT',
  'RIC PORTO',
  'RIC RETROAREA'
];

const ALL_COLUMNS = [...FIXED_COLUMNS, ...DOCUMENT_COLUMNS];

/* ─────────────────────────────────────────────────────────────
   CELULA COM STATUS DE DOCUMENTO
───────────────────────────────────────────────────────────── */
const DocumentCell = ({ value }) => {
  const isPresent =
    value === true || value === 1 || value === '1' || value === 'true';

  return (
    <div className="cp-doc-cell">
      {isPresent ? (
        <span className="cp-status-icon cp-status-success" title="Documento presente">
          <FaCheckCircle />
        </span>
      ) : (
        <span className="cp-status-icon cp-status-error" title="Documento faltando">
          <FaExclamationCircle />
        </span>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   LINHA SKELETON
───────────────────────────────────────────────────────────── */
const SkeletonRow = ({ numCols }) => (
  <tr className="cp-skeleton-row">
    {Array.from({ length: numCols }).map((_, i) => (
      <td
        key={i}
        className={`cp-td ${i < FIXED_COLUMNS.length ? 'cp-td-sticky' : ''}`}
        data-sticky-index={i < FIXED_COLUMNS.length ? i : undefined}
      >
        <div className="cp-skeleton-pulse" />
      </td>
    ))}
  </tr>
);

/* ─────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────────────────────── */
const ControleProtocolos = () => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const searchTimer = useRef(null);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [toast, setToast] = useState(null);

  /* ───────────────────────────────────────────────────────────
     BUSCAR DADOS
  ─────────────────────────────────────────────────────────── */
  const fetchData = useCallback(async (term = '') => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminService.getControleProtocolos(term);

      if (response?.data?.success) {
        setData(response.data.data || []);
      } else {
        throw new Error(response?.data?.message || 'Erro ao buscar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar protocolos:', err);
      setError(err.message || 'Erro ao carregar dados');
      setToast({
        type: 'error',
        title: 'Erro',
        message: err.message || 'Erro ao carregar dados'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  /* ───────────────────────────────────────────────────────────
     EFEITO INICIAL
  ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetchData();

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [fetchData]);

  /* ───────────────────────────────────────────────────────────
     BUSCA COM DEBOUNCE
  ─────────────────────────────────────────────────────────── */
  const handleSearchChange = useCallback(
    (value) => {
      setSearchTerm(value);
      clearTimeout(searchTimer.current);

      searchTimer.current = setTimeout(() => {
        fetchData(value);
      }, 500);
    },
    [fetchData]
  );

  /* ───────────────────────────────────────────────────────────
     REFRESH
  ─────────────────────────────────────────────────────────── */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData(searchTerm);
      setToast({
        type: 'success',
        title: 'Sucesso',
        message: 'Dados atualizados com sucesso'
      });
    } finally {
      setRefreshing(false);
    }
  }, [fetchData, searchTerm]);

  /* ───────────────────────────────────────────────────────────
     CONTROLE DE SCROLL HORIZONTAL
  ─────────────────────────────────────────────────────────── */
  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();

    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);

      return () => {
        scrollElement.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [checkScroll, data]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  /* ───────────────────────────────────────────────────────────
     AUXILIAR DOCUMENTOS
  ─────────────────────────────────────────────────────────── */
  const getDocumentValue = useCallback((record, docName) => {
    if (!record?.documentos) return false;
    return record.documentos[docName] || false;
  }, []);

  /* ───────────────────────────────────────────────────────────
     MÉTRICAS
  ─────────────────────────────────────────────────────────── */
  const metrics = useMemo(() => {
    const totalProtocolos = data.length;
    const totalDocumentosEsperados = totalProtocolos * DOCUMENT_COLUMNS.length;

    let totalPresentes = 0;
    let protocolosComPendencia = 0;

    data.forEach((record) => {
      let hasMissing = false;

      DOCUMENT_COLUMNS.forEach((docName) => {
        const present = !!getDocumentValue(record, docName);
        if (present) {
          totalPresentes += 1;
        } else {
          hasMissing = true;
        }
      });

      if (hasMissing) protocolosComPendencia += 1;
    });

    const totalPendentes = totalDocumentosEsperados - totalPresentes;
    const percentualConclusao =
      totalDocumentosEsperados > 0
        ? Math.round((totalPresentes / totalDocumentosEsperados) * 100)
        : 0;

    return {
      totalProtocolos,
      totalPresentes,
      totalPendentes,
      protocolosComPendencia,
      percentualConclusao
    };
  }, [data, getDocumentValue]);

  /* ───────────────────────────────────────────────────────────
     RENDER CÉLULAS
  ─────────────────────────────────────────────────────────── */
  const renderFixedCell = (record, columnKey) => {
    const value = record[columnKey];

    return (
      <td
        key={columnKey}
        className="cp-td cp-td-sticky"
        data-sticky-index={FIXED_COLUMNS.indexOf(columnKey)}
      >
        <div className="cp-cell-content cp-cell-fixed">{value || '—'}</div>
      </td>
    );
  };

  const renderDocumentCell = (record, docName) => {
    const value = getDocumentValue(record, docName);

    return (
      <td key={docName} className="cp-td cp-td-doc">
        <DocumentCell value={value} />
      </td>
    );
  };

  /* ───────────────────────────────────────────────────────────
     EXPORTAR CSV
  ─────────────────────────────────────────────────────────── */
  const handleExportCSV = useCallback(() => {
    if (data.length === 0) {
      setToast({
        type: 'warning',
        title: 'Aviso',
        message: 'Nenhum dado para exportar'
      });
      return;
    }

    try {
      const headers = ALL_COLUMNS.map((col) => `"${col}"`).join(',');

      const rows = data.map((record) => {
        const values = [];

        FIXED_COLUMNS.forEach((col) => {
          const val = record[col] || '';
          values.push(`"${String(val).replace(/"/g, '""')}"`);
        });

        DOCUMENT_COLUMNS.forEach((docName) => {
          const val = getDocumentValue(record, docName) ? 'SIM' : 'NÃO';
          values.push(`"${val}"`);
        });

        return values.join(',');
      });

      const csv = [headers, ...rows].join('\n');

      const blob = new Blob(['\uFEFF' + csv], {
        type: 'text/csv;charset=utf-8;'
      });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `controle-protocolos-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToast({
        type: 'success',
        title: 'Sucesso',
        message: 'Arquivo exportado com sucesso'
      });
    } catch (err) {
      console.error('Erro ao exportar:', err);
      setToast({
        type: 'error',
        title: 'Erro',
        message: 'Erro ao exportar dados'
      });
    }
  }, [data, getDocumentValue]);

  return (
    <div className="cp-page-bg">
      <div className="cp-container">
        {/* HERO */}
        <div className="cp-hero">
          <div className="cp-hero-left">
            <button
              onClick={() => navigate('/admin')}
              className="cp-btn cp-btn-back"
              title="Voltar"
            >
              <FaArrowLeft size={16} />
            </button>

            <div className="cp-title-block">
              <span className="cp-eyebrow">Painel Administrativo</span>
              <h1 className="cp-title">Controle de Protocolos</h1>
              <p className="cp-subtitle">
                Gerencie a presença documental por processo com uma visualização
                moderna, elegante e profissional.
              </p>
            </div>
          </div>

          <div className="cp-hero-actions">
            <button
              onClick={handleExportCSV}
              className="cp-btn cp-btn-primary"
              title="Exportar CSV"
              disabled={data.length === 0}
            >
              <FaDownload size={15} />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={handleRefresh}
              className={`cp-btn cp-btn-secondary ${refreshing ? 'cp-loading' : ''}`}
              title="Atualizar"
              disabled={refreshing || loading}
            >
              <FaSync size={15} />
              <span>{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          </div>
        </div>

        {/* CARDS */}
        <div className="cp-stats-grid">
          <div className="cp-stat-card">
            <div className="cp-stat-icon cp-stat-blue">
              <FaBoxes />
            </div>
            <div>
              <span className="cp-stat-label">Protocolos</span>
              <strong className="cp-stat-value">{metrics.totalProtocolos}</strong>
            </div>
          </div>

          <div className="cp-stat-card">
            <div className="cp-stat-icon cp-stat-green">
              <FaCheckCircle />
            </div>
            <div>
              <span className="cp-stat-label">Documentos presentes</span>
              <strong className="cp-stat-value">{metrics.totalPresentes}</strong>
            </div>
          </div>

          <div className="cp-stat-card">
            <div className="cp-stat-icon cp-stat-red">
              <FaExclamationCircle />
            </div>
            <div>
              <span className="cp-stat-label">Pendências</span>
              <strong className="cp-stat-value">{metrics.totalPendentes}</strong>
            </div>
          </div>

          <div className="cp-stat-card">
            <div className="cp-stat-icon cp-stat-purple">
              <FaChartPie />
            </div>
            <div>
              <span className="cp-stat-label">Cobertura documental</span>
              <strong className="cp-stat-value">{metrics.percentualConclusao}%</strong>
            </div>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="cp-toolbar">
          <div className="cp-search-wrapper">
            <div className="cp-search-input-container">
              <FaSearch className="cp-search-icon" />
              <input
                type="text"
                placeholder="Buscar por processo, container, embarcador ou destinatário..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="cp-search-input"
              />
              {searchTerm && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="cp-search-clear"
                  title="Limpar busca"
                >
                  <FaTimes size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="cp-toolbar-side">
            <div className="cp-chip cp-chip-neutral">
              <FaFileAlt />
              <span>
                {loading
                  ? 'Carregando...'
                  : `${data.length} protocolo${data.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            <div className="cp-legend">
              <span className="cp-legend-item">
                <FaCheckCircle className="cp-legend-success" />
                Presente
              </span>
              <span className="cp-legend-item">
                <FaExclamationCircle className="cp-legend-error" />
                Faltando
              </span>
            </div>
          </div>
        </div>

        {/* ERRO */}
        {error && (
          <div className="cp-error-message">
            <FaExclamationCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* TABELA */}
        <div className="cp-table-card">
          <div className="cp-table-card-header">
            <div>
              <h2 className="cp-section-title">Visão detalhada dos documentos</h2>
              <p className="cp-section-subtitle">
                Role horizontalmente para visualizar todas as categorias documentais.
              </p>
            </div>
          </div>

          <div className="cp-table-wrapper">
            {canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                className="cp-scroll-btn cp-scroll-btn-left"
                title="Scroll esquerda"
              >
                <FaChevronLeft size={16} />
              </button>
            )}

            {canScrollRight && (
              <button
                onClick={() => scroll('right')}
                className="cp-scroll-btn cp-scroll-btn-right"
                title="Scroll direita"
              >
                <FaChevronRight size={16} />
              </button>
            )}

            <div className="cp-table-scroll" ref={scrollRef}>
              <table className="cp-table">
                <thead className="cp-thead">
                  <tr className="cp-tr-header">
                    {FIXED_COLUMNS.map((col, idx) => (
                      <th
                        key={col}
                        className="cp-th cp-th-sticky"
                        data-sticky-index={idx}
                      >
                        <span className="cp-th-label">{col}</span>
                      </th>
                    ))}

                    {DOCUMENT_COLUMNS.map((docName) => (
                      <th key={docName} className="cp-th cp-th-doc">
                        <span className="cp-th-label">{docName}</span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="cp-tbody">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <SkeletonRow key={`skeleton-${i}`} numCols={ALL_COLUMNS.length} />
                    ))
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={ALL_COLUMNS.length} className="cp-empty-state">
                        <div className="cp-empty-box">
                          <FaTable size={42} className="cp-empty-icon" />
                          <h3>Nenhum protocolo encontrado</h3>
                          <p>
                            Tente ajustar sua busca ou limpar os filtros para visualizar
                            os registros disponíveis.
                          </p>
                          {searchTerm && (
                            <button
                              onClick={() => handleSearchChange('')}
                              className="cp-btn cp-btn-secondary"
                            >
                              Limpar filtros
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.map((record, idx) => (
                      <tr key={record._id || idx} className="cp-tr-data">
                        {FIXED_COLUMNS.map((col) => renderFixedCell(record, col))}
                        {DOCUMENT_COLUMNS.map((docName) =>
                          renderDocumentCell(record, docName)
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* TOAST */}
        {toast && (
          <Toast
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
};

export default ControleProtocolos;
