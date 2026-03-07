import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft, FaDownload, FaSearch, FaTable,
  FaChevronLeft, FaChevronRight, FaTimes, FaFilter,
  FaDatabase, FaCheckCircle, FaSyncAlt
} from 'react-icons/fa';
import { MdTableChart } from 'react-icons/md';
import api, { API_URL } from '../services/api';

/* ─── Constante legada ──────────────────────────────────────────── */
const API_BASE = API_URL;

/* ─── Mapeamento colunas ────────────────────────────────────────── */
const FIELD_MAP = {
  'Código':                   'codigo',
  'N° GeoMarítima':           'processo',                // show processo field
  'Status':                   'status',
  'Dt. início rota':          'dtInicioRota',            // use dtInicioRota field
  'Dt. chegada cliente':      'dtChegada',
  'Dt. agendamento descarga': 'dtAgendamentoDescarga',
  'Dt. início descarga':      'dtInicioDescarga',
  'Dt. fim descarga':         'dtFimDescarga',
  'Dt. retirada P.D.':        'dtRetiraPD',
  'Situação':                 'situacao',
  'Cliente':                  'cliente',
  'Remetente':                'remetente',
  'Destinatário':             'destinatario',
  'Contratado':               'contratado',
  'Tipo':                     'tipo',
  'Dt. SM':                   'dtSM',
  'Motorista':                'motorista',
  'Tração':                   'tracao',
  'Reboque':                  'reboque',
  'Origem':                   'origem',
  'UF coleta':                'ufColeta',
  'Pagamento':                'pagamento',
  'TAG Pedágio':              'tagPedagio',
  'Vl. frete processo':       'vlFreteProcesso',
  'Vl. pedágio':              'vlPedagio',
  'Vl. frete lista':          'vlFreteLista',
  'Vl. abastecimento':        'vlAbastecimento',
  'Hr. início descarga':      'hrInicioDescarga',
  'Dt. descida CNTR/Carga':   'dtDescidaCNTRCarga',
  'Dt. devolução CNTR':       'dtDevolucaoCNTR',
  'Terminal':                 'terminal',
  'Destino':                  'destino',
  'UF entrega':               'ufEntrega',
  'Estab. CT-e/NFS-e':        'estabCTeNFSe',
  'N° CT-e/NFS-e':            'numCTeNFSe',
  'N° averbação CTE':         'numAverbacaoCTE',
  'N° CIOT':                  'numCIOT',
  'Situação CIOT':            'situacaoCIOT',
  'N° MDFE':                  'numMDFE',
  'Situação MDFE':            'situacaoMDFE',
  'Dt. averbação MDFE':       'dtAverbacaoMDFE',
  'N° booking':               'numBooking',
  'N° booking agendamento':   'numBookingAgendamento',
  'Armador':                  'armador',
  'Navio':                    'navio',
  'Número':                   'containerNumero',        // map to containerNumero
  'Tara':                     'tara',
  'Lacre':                    'lacre',
  'Payload':                  'payload',
  'Temperatura (C°)':         'temperatura',
  'Umidade (%)':              'umidade',
  'Ventilação (Cbm)':         'ventilacao',
  'Peso bruto':               'pesoBruto',
  'Motorista pulmão':         'motoristaPulmao',
  'Motorista retro':          'motoristaRetro',
  'Estab.':                   'estab',
};

const COLUMNS      = Object.keys(FIELD_MAP);
const STICKY_COLS  = 2;               // Código + GeoMarítima ficam fixos
const SITUATION_COLORS = {
  'Finalizado': { bg: '#dcfce7', text: '#15803d', dot: '#16a34a' },
  'Em andamento': { bg: '#fef9c3', text: '#854d0e', dot: '#ca8a04' },
  'Pendente':   { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626' },
  'Cancelado':  { bg: '#f3f4f6', text: '#374151', dot: '#6b7280' },
};

/* ─── Helpers ───────────────────────────────────────────────────── */
const badge = (value, field) => {
  if (field !== 'situacao' && field !== 'situacaoCIOT' && field !== 'situacaoMDFE') return null;
  const cfg = SITUATION_COLORS[value] || SITUATION_COLORS['Cancelado'];
  return cfg;
};

const formatCurrency = (val) => {
  const n = parseFloat(String(val).replace(',', '.'));
  if (isNaN(n)) return val || '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const CURRENCY_FIELDS = new Set([
  'vlFreteProcesso', 'vlPedagio', 'vlFreteLista', 'vlAbastecimento'
]);

const DATE_FIELDS = new Set([
  'dtInicioRota', 'dtInicioDescarga', 'dtFimDescarga', 'dtRetiraPD', 'dtDevolucaoCNTR',
  'dtInicio', 'dtSM', 'dtAgendamentoDescarga', 'dtChegada', 'dtDescidaCNTRCarga',
  'dtAverbacaoMDFE', 'dtSM'
]);

const renderCell = (fieldKey, rawValue) => {
  if (!rawValue && rawValue !== 0) return <span className="yc-empty">—</span>;
  const b = badge(rawValue, fieldKey);
  if (b) return (
    <span className="yc-badge" style={{ background: b.bg, color: b.text }}>
      <span className="yc-badge-dot" style={{ background: b.dot }} />
      {rawValue}
    </span>
  );
  if (CURRENCY_FIELDS.has(fieldKey)) return formatCurrency(rawValue);
  if (DATE_FIELDS.has(fieldKey) && rawValue) {
    try {
      const date = new Date(rawValue);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('pt-BR', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        });
      }
    } catch (e) {
      // fallback to raw value
    }
  }
  return rawValue;
};

/* ─── Skeleton Row ──────────────────────────────────────────────── */
const SkeletonRow = ({ cols }) => (
  <tr className="yc-skeleton-row">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className={i < STICKY_COLS ? `yc-td-sticky yc-sticky-col-${i}` : ''}>
        <span className="yc-skeleton-cell" style={{ width: `${60 + (i * 17) % 60}px` }} />
      </td>
    ))}
  </tr>
);

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════════════ */
const Ycompany = () => {
  const navigate    = useNavigate();
  const scrollRef   = useRef(null);
  const searchTimer = useRef(null);

  const [searchTerm,  setSearchTerm]  = useState('');
  const [data,        setData]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [canScrollL,  setCanScrollL]  = useState(false);
  const [canScrollR,  setCanScrollR]  = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  /* ── Fetch ── */
  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get('/ycompany');
      const fetchedData = res.data?.data || [];
      console.log('Ycompany data fetched:', fetchedData.slice(0, 3).map(d => ({ codigo: d.codigo, dtInicioRota: d.dtInicioRota, dtInicioDescarga: d.dtInicioDescarga })));
      setData(fetchedData);
    } catch {
      setError('Falha ao carregar dados da Ycompany');
      setData([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Scroll shadows ── */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollL(el.scrollLeft > 8);
    setCanScrollR(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScroll, data]);

  const scrollBy = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  /* ── Search (debounced) ── */
  const handleSearch = (value) => {
    setSearchTerm(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (!value.trim()) { fetchAll(); return; }
      setLoading(true);
      try {
        const res = await api.get('/ycompany/search', { params: { q: value } });
        setData(res.data?.data || []);
      } catch { setError('Falha ao buscar registros'); }
      finally   { setLoading(false); }
    }, 400);
  };

  /* ── Refresh ── */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setTimeout(() => setRefreshing(false), 600);
  };

  /* ── Export ── */
  const handleExport = async () => {
    try {
      const res = await api.get('/ycompany/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `ycompany-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); a.remove();
    } catch { alert('Falha ao exportar dados'); }
  };

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Estilos inline (sem dependência de CSS externo) ── */}
      <style>{`
        /* ── Reset / base ── */
        .yc-root { min-height:100vh; background:#f0f2f8; font-family:'Inter',sans-serif; }

        /* ── HEADER ── */
        .yc-header {
          background: linear-gradient(135deg,#6c4ff8 0%,#4338ca 60%,#312e81 100%);
          padding: 0;
          position: sticky; top: 0; z-index: 50;
          box-shadow: 0 4px 24px rgba(99,73,255,.35);
        }
        .yc-header-inner {
          max-width: 1600px; margin: 0 auto;
          padding: 20px 32px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .yc-back-btn {
          width:40px; height:40px; border-radius:10px;
          background:rgba(255,255,255,.15); border:none; color:#fff;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:background .2s;
          flex-shrink: 0;
        }
        .yc-back-btn:hover { background:rgba(255,255,255,.28); }

        .yc-title-block { display:flex; flex-direction:column; gap:2px; }
        .yc-title {
          font-size:1.75rem; font-weight:900; color:#fff;
          letter-spacing:-.5px; display:flex; align-items:center; gap:10px;
          margin:0;
        }
        .yc-title-icon {
          width:36px; height:36px; background:rgba(255,255,255,.2);
          border-radius:9px; display:flex; align-items:center; justify-content:center;
          font-size:1rem;
        }
        .yc-subtitle { color:rgba(255,255,255,.65); font-size:.82rem; margin:0; }

        .yc-header-actions { display:flex; align-items:center; gap:10px; }
        .yc-btn-ghost {
          display:flex; align-items:center; gap:7px;
          padding:8px 16px; border-radius:9px;
          background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.2);
          color:#fff; font-size:.84rem; font-weight:600;
          cursor:pointer; transition:all .2s; white-space:nowrap;
        }
        .yc-btn-ghost:hover { background:rgba(255,255,255,.28); }
        .yc-btn-solid {
          display:flex; align-items:center; gap:7px;
          padding:8px 18px; border-radius:9px;
          background:#fff; border:none;
          color:#4338ca; font-size:.84rem; font-weight:700;
          cursor:pointer; transition:all .2s; white-space:nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,.12);
        }
        .yc-btn-solid:hover { background:#eef2ff; }

        /* ── STATS BAR ── */
        .yc-stats-bar {
          background: rgba(255,255,255,.08);
          border-top: 1px solid rgba(255,255,255,.12);
          padding: 12px 32px;
        }
        .yc-stats-bar-inner {
          max-width:1600px; margin:0 auto;
          display:flex; align-items:center; gap:28px; flex-wrap:wrap;
        }
        .yc-stat {
          display:flex; align-items:center; gap:8px;
          color:rgba(255,255,255,.85); font-size:.8rem;
        }
        .yc-stat-icon { opacity:.7; }
        .yc-stat strong { color:#fff; font-weight:700; }
        .yc-stat-divider { width:1px; height:18px; background:rgba(255,255,255,.2); }

        /* ── BODY ── */
        .yc-body { max-width:1600px; margin:0 auto; padding:24px 32px; }

        /* ── TOOLBAR ── */
        .yc-toolbar {
          display:flex; align-items:center; gap:12px;
          background:#fff; border-radius:14px;
          padding:16px 20px; margin-bottom:20px;
          box-shadow:0 1px 4px rgba(0,0,0,.07), 0 4px 16px rgba(99,73,255,.06);
          border:1px solid #e8e8f0;
        }
        .yc-search-wrap {
          flex:1; position:relative; display:flex; align-items:center;
        }
        .yc-search-icon {
          position:absolute; left:13px; color:#9ca3af; font-size:.9rem; pointer-events:none;
        }
        .yc-search {
          width:100%; padding:9px 38px 9px 38px;
          border:1.5px solid #e5e7eb; border-radius:9px;
          font-size:.88rem; outline:none; transition:border .2s;
          background:#f9fafb; color:#111827;
        }
        .yc-search:focus { border-color:#6c4ff8; background:#fff; box-shadow:0 0 0 3px rgba(108,79,248,.12); }
        .yc-search-clear {
          position:absolute; right:10px;
          background:none; border:none; cursor:pointer; color:#9ca3af;
          display:flex; align-items:center; padding:4px;
        }
        .yc-search-clear:hover { color:#ef4444; }
        .yc-divider-v { width:1px; height:32px; background:#e5e7eb; }
        .yc-refresh-btn {
          width:38px; height:38px; border-radius:9px; border:1.5px solid #e5e7eb;
          background:#f9fafb; color:#6b7280; display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:all .2s; flex-shrink:0;
        }
        .yc-refresh-btn:hover { border-color:#6c4ff8; color:#6c4ff8; background:#eef2ff; }
        .yc-spin { animation: spin .7s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* ── TABLE CARD ── */
        .yc-card {
          background:#fff; border-radius:16px; overflow:hidden;
          box-shadow:0 1px 4px rgba(0,0,0,.07), 0 8px 32px rgba(99,73,255,.08);
          border:1px solid #e8e8f0;
          position:relative;
        }

        /* ── SCROLL ARROWS ── */
        .yc-scroll-arrow {
          position:absolute; top:50%; transform:translateY(-50%);
          z-index:20; width:36px; height:36px; border-radius:50%;
          background:#fff; box-shadow:0 2px 12px rgba(0,0,0,.18);
          border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;
          color:#4338ca; transition:all .2s;
        }
        .yc-scroll-arrow:hover { background:#6c4ff8; color:#fff; transform:translateY(-50%) scale(1.1); }
        .yc-scroll-arrow.left  { left:10px; }
        .yc-scroll-arrow.right { right:10px; }
        .yc-scroll-arrow.hidden { opacity:0; pointer-events:none; }

        /* ── SCROLL SHADOWS ── */
        .yc-shadow-left, .yc-shadow-right {
          position:absolute; top:0; bottom:0; width:80px;
          z-index:10; pointer-events:none; transition:opacity .3s;
        }
        .yc-shadow-left  {
          left:0;
          background:linear-gradient(to right,rgba(255,255,255,.95),transparent);
        }
        .yc-shadow-right {
          right:0;
          background:linear-gradient(to left,rgba(255,255,255,.95),transparent);
        }
        .yc-shadow-left.hidden, .yc-shadow-right.hidden { opacity:0; }

        /* ── TABLE SCROLL WRAPPER ── */
        .yc-scroll {
          overflow-x:auto; overflow-y:auto;
          max-height: calc(100vh - 320px);
          scroll-behavior:smooth;
          scrollbar-width:thin; scrollbar-color:#c4b5fd #f3f0ff;
        }
        .yc-scroll::-webkit-scrollbar { height:7px; width:7px; }
        .yc-scroll::-webkit-scrollbar-track { background:#f3f0ff; }
        .yc-scroll::-webkit-scrollbar-thumb { background:#c4b5fd; border-radius:10px; }
        .yc-scroll::-webkit-scrollbar-thumb:hover { background:#a78bfa; }

        /* ── TABLE ── */
        .yc-table { border-collapse:separate; border-spacing:0; width:max-content; min-width:100%; }

        /* THEAD */
        .yc-thead tr { position:sticky; top:0; z-index:15; }
        .yc-th {
          padding:13px 16px; text-align:left;
          background:linear-gradient(180deg,#f5f3ff 0%,#ede9fe 100%);
          font-size:.75rem; font-weight:700; color:#4c1d95;
          letter-spacing:.4px; text-transform:uppercase;
          white-space:nowrap; border-bottom:2px solid #ddd6fe;
          border-right:1px solid #e8e0ff;
          user-select:none;
        }
        .yc-th:last-child { border-right:none; }

        /* Sticky cols header */
        .yc-th-sticky {
          position:sticky; z-index:16;
          background:linear-gradient(180deg,#ede9fe 0%,#ddd6fe 100%);
          border-right:2px solid #c4b5fd !important;
        }
        .yc-th-sticky-0 { left:0; }
        .yc-th-sticky-1 { left:120px; }

        /* TBODY */
        .yc-tr {
          transition:background .15s;
          border-bottom:1px solid #f3f0ff;
        }
        .yc-tr:hover .yc-td { background:#faf9ff !important; }
        .yc-tr:hover .yc-td-sticky { background:#f0ebff !important; }
        .yc-tr:nth-child(even) .yc-td { background:#fdfdff; }

        .yc-td {
          padding:11px 16px; font-size:.82rem; color:#374151;
          white-space:nowrap; background:#fff;
          border-bottom:1px solid #f3f0ff; border-right:1px solid #f5f3ff;
          max-width:260px; overflow:hidden; text-overflow:ellipsis;
        }
        .yc-td:last-child { border-right:none; }

        /* Sticky cols body */
        .yc-td-sticky {
          position:sticky; z-index:10;
          background:#faf8ff; font-weight:600; color:#1e1b4b;
          border-right:2px solid #ddd6fe !important;
        }
        .yc-td-sticky-0 { left:0; min-width:120px; max-width:120px; }
        .yc-td-sticky-1 { left:120px; min-width:140px; max-width:140px; }

        /* col index highlight */
        .yc-th-sticky-0, .yc-td-sticky-0 { box-shadow:2px 0 6px rgba(0,0,0,.04); }

        /* ── BADGE ── */
        .yc-badge {
          display:inline-flex; align-items:center; gap:5px;
          padding:3px 9px; border-radius:20px;
          font-size:.75rem; font-weight:600;
        }
        .yc-badge-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .yc-empty { color:#d1d5db; }

        /* ── SKELETON ── */
        .yc-skeleton-row td { padding:10px 16px; background:#fff; }
        .yc-skeleton-cell {
          display:inline-block; height:13px; border-radius:6px;
          background:linear-gradient(90deg,#f3f0ff 25%,#ede9fe 50%,#f3f0ff 75%);
          background-size:400% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        @keyframes shimmer { to { background-position:-400% 0; } }

        /* ── FOOTER ── */
        .yc-footer {
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;
          padding:14px 24px; background:#f9f8ff;
          border-top:1.5px solid #ede9fe;
          font-size:.82rem; color:#6b7280;
        }
        .yc-footer-left { display:flex; align-items:center; gap:8px; }
        .yc-footer-count {
          font-weight:700; color:#4338ca; font-size:.92rem;
        }
        .yc-col-pill {
          display:inline-flex; align-items:center; gap:4px;
          padding:3px 10px; background:#ede9fe; border-radius:20px;
          color:#6c4ff8; font-weight:600; font-size:.76rem;
        }
        .yc-scroll-hint {
          display:flex; align-items:center; gap:6px;
          color:#9ca3af; font-size:.78rem;
          animation: fadeHint 3s ease forwards 2s;
        }
        @keyframes fadeHint { to { opacity:0; } }

        /* ── EMPTY STATE ── */
        .yc-empty-state {
          display:flex; flex-direction:column; align-items:center;
          justify-content:center; padding:72px 24px; gap:12px;
        }
        .yc-empty-icon {
          width:72px; height:72px; border-radius:20px;
          background:linear-gradient(135deg,#ede9fe,#ddd6fe);
          display:flex; align-items:center; justify-content:center;
          font-size:2rem; color:#7c3aed; margin-bottom:4px;
        }
        .yc-empty-title { font-size:1.1rem; font-weight:700; color:#1e1b4b; }
        .yc-empty-sub   { font-size:.85rem; color:#9ca3af; }

        /* ── ERROR ── */
        .yc-error {
          margin-bottom:20px; padding:14px 18px; border-radius:12px;
          background:#fef2f2; border:1.5px solid #fecaca; color:#991b1b;
          display:flex; align-items:center; gap:10px; font-size:.85rem;
          font-weight:500;
        }

        /* ── RESPONSIVE ── */
        @media (max-width:640px) {
          .yc-header-inner { padding:16px 16px; }
          .yc-body { padding:16px; }
          .yc-title { font-size:1.35rem; }
          .yc-stats-bar { padding:10px 16px; }
        }
      `}</style>

      <div className="yc-root">

        {/* ════════════ HEADER ════════════ */}
        <header className="yc-header">
          <div className="yc-header-inner">
            {/* Esquerda */}
            <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
              <button className="yc-back-btn" onClick={() => navigate('/home')} title="Voltar">
                <FaArrowLeft />
              </button>
              <div className="yc-title-block">
                <h1 className="yc-title">
                  <span className="yc-title-icon"><MdTableChart /></span>
                  Ycompany
                </h1>
                <p className="yc-subtitle">Base de dados operacional marítima</p>
              </div>
            </div>

            {/* Direita */}
            <div className="yc-header-actions">
              <button className="yc-btn-ghost" onClick={handleRefresh}>
                <FaSyncAlt className={refreshing ? 'yc-spin' : ''} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <button className="yc-btn-solid" onClick={handleExport}>
                <FaDownload />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="yc-stats-bar">
            <div className="yc-stats-bar-inner">
              <span className="yc-stat">
                <FaDatabase className="yc-stat-icon" />
                <strong>{data.length.toLocaleString('pt-BR')}</strong> registros
              </span>
              <span className="yc-stat-divider" />
              <span className="yc-stat">
                <FaTable className="yc-stat-icon" />
                <strong>{COLUMNS.length}</strong> colunas
              </span>
              <span className="yc-stat-divider" />
              <span className="yc-stat">
                <FaCheckCircle className="yc-stat-icon" />
                <strong>{STICKY_COLS}</strong> colunas fixas
              </span>
              {searchTerm && (
                <>
                  <span className="yc-stat-divider" />
                  <span className="yc-stat">
                    🔍 Filtro: <strong>"{searchTerm}"</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ════════════ BODY ════════════ */}
        <main className="yc-body">

          {/* Toolbar */}
          <div className="yc-toolbar">
            <div className="yc-search-wrap">
              <FaSearch className="yc-search-icon" />
              <input
                className="yc-search"
                type="text"
                placeholder="Buscar por qualquer campo…"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchTerm && (
                <button className="yc-search-clear" onClick={() => handleSearch('')}>
                  <FaTimes />
                </button>
              )}
            </div>

            <div className="yc-divider-v" />

            <button className="yc-refresh-btn" onClick={handleRefresh} title="Recarregar">
              <FaSyncAlt className={refreshing ? 'yc-spin' : ''} />
            </button>

            <button
              style={{
                display:'flex', alignItems:'center', gap:'7px',
                padding:'8px 14px', borderRadius:'9px',
                border:'1.5px solid #e5e7eb', background:'#f9fafb',
                color:'#374151', fontSize:'.84rem', fontWeight:600,
                cursor:'pointer',
              }}
            >
              <FaFilter style={{ color:'#9ca3af' }} /> Filtros
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="yc-error">
              ⚠️ {error}
              <button
                onClick={fetchAll}
                style={{ marginLeft:'auto', textDecoration:'underline', background:'none', border:'none', cursor:'pointer', color:'#991b1b' }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* ── TABLE CARD ── */}
          <div className="yc-card">

            {/* Sombra esquerda */}
            <div className={`yc-shadow-left ${!canScrollL ? 'hidden' : ''}`} />
            {/* Sombra direita */}
            <div className={`yc-shadow-right ${!canScrollR ? 'hidden' : ''}`} />

            {/* Seta esquerda */}
            <button
              className={`yc-scroll-arrow left ${!canScrollL ? 'hidden' : ''}`}
              onClick={() => scrollBy(-1)}
              title="Rolar para esquerda"
            >
              <FaChevronLeft />
            </button>

            {/* Seta direita */}
            <button
              className={`yc-scroll-arrow right ${!canScrollR ? 'hidden' : ''}`}
              onClick={() => scrollBy(1)}
              title="Rolar para direita"
            >
              <FaChevronRight />
            </button>

            {/* Scroll area */}
            <div className="yc-scroll" ref={scrollRef}>
              {loading ? (
                <table className="yc-table">
                  <thead className="yc-thead">
                    <tr>
                      {COLUMNS.map((col, i) => (
                        <th
                          key={col}
                          className={`yc-th ${i < STICKY_COLS ? `yc-th-sticky yc-th-sticky-${i}` : ''}`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <SkeletonRow key={i} cols={COLUMNS.length} />
                    ))}
                  </tbody>
                </table>
              ) : data.length === 0 ? (
                <div className="yc-empty-state">
                  <div className="yc-empty-icon">🗂️</div>
                  <p className="yc-empty-title">Nenhum registro encontrado</p>
                  <p className="yc-empty-sub">
                    {searchTerm
                      ? `Nenhum resultado para "${searchTerm}"`
                      : 'Nenhum dado disponível no momento'}
                  </p>
                </div>
              ) : (
                <table className="yc-table">
                  <thead className="yc-thead">
                    <tr>
                      {COLUMNS.map((col, i) => (
                        <th
                          key={col}
                          className={`yc-th ${i < STICKY_COLS ? `yc-th-sticky yc-th-sticky-${i}` : ''}`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx} className="yc-tr">
                        {COLUMNS.map((col, ci) => {
                          const fk  = FIELD_MAP[col];
                          const raw = row[fk];
                          return (
                            <td
                              key={`${idx}-${ci}`}
                              className={`yc-td ${ci < STICKY_COLS ? `yc-td-sticky yc-td-sticky-${ci}` : ''}`}
                              title={typeof raw === 'string' ? raw : undefined}
                            >
                              {renderCell(fk, raw)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer da tabela */}
            {!loading && data.length > 0 && (
              <div className="yc-footer">
                <div className="yc-footer-left">
                  <span>Total:</span>
                  <span className="yc-footer-count">{data.length.toLocaleString('pt-BR')}</span>
                  <span>registros</span>
                  <span className="yc-col-pill">
                    <FaTable style={{ fontSize:'.68rem' }} />
                    {COLUMNS.length} colunas
                  </span>
                </div>
                <div className="yc-scroll-hint">
                  <FaChevronLeft style={{ fontSize:'.7rem' }} />
                  <FaChevronRight style={{ fontSize:'.7rem' }} />
                  Role horizontalmente para ver todas as colunas
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default Ycompany;
