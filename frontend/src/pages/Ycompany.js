import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft, FaDownload, FaSearch,
  FaChevronLeft, FaChevronRight, FaTimes, FaFilter,
  FaSyncAlt, FaTable, FaColumns
} from 'react-icons/fa';
import { MdAnchor, MdTableChart } from 'react-icons/md';
import { HiSparkles } from 'react-icons/hi';
import api from '../services/api';

/* ─── Mapeamento colunas ────────────────────────────────────────── */
const FIELD_MAP = {
  'Código':                   'codigo',
  'N° GeoMarítima':           'processo',
  'Status':                   'status',
  'Dt. início rota':          'dtInicioRota',
  'Dt. chegada cliente':      'arrivedAt',
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
  'Número':                   'containerNumero',
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

const COLUMNS     = Object.keys(FIELD_MAP);
const STICKY_COLS = 2;

const STATUS_CONFIG = {
  'AGENDADO':      { bg: 'rgba(59,130,246,.10)',  text: '#1d4ed8', dot: '#3b82f6', border: 'rgba(59,130,246,.25)'  },
  'EM EXECUÇÃO':   { bg: 'rgba(245,158,11,.10)',  text: '#92400e', dot: '#f59e0b', border: 'rgba(245,158,11,.25)'  },
  'FINALIZADO':    { bg: 'rgba(16,185,129,.10)',  text: '#065f46', dot: '#10b981', border: 'rgba(16,185,129,.25)'  },
  'CANCELADO':     { bg: 'rgba(239,68,68,.10)',   text: '#991b1b', dot: '#ef4444', border: 'rgba(239,68,68,.25)'   },
  'NEGÓCIO CONF.': { bg: 'rgba(168,85,247,.10)',  text: '#6b21a8', dot: '#a855f7', border: 'rgba(168,85,247,.25)' },
  'OPERAÇÃO EM':   { bg: 'rgba(20,184,166,.10)',  text: '#115e59', dot: '#14b8a6', border: 'rgba(20,184,166,.25)' },
};

const getSituacaoConfig = (value) => {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  for (const key of Object.keys(STATUS_CONFIG)) {
    if (upper.includes(key)) return STATUS_CONFIG[key];
  }
  return { bg: 'rgba(100,116,139,.08)', text: '#475569', dot: '#94a3b8', border: 'rgba(100,116,139,.2)' };
};

const SYNC_DATE_FIELDS = [
  'dtInicioRota', 'dtAgendamentoDescarga', 'arrivedAt',
  'dtInicioDescarga', 'dtFimDescarga', 'dtRetiraPD',
  'dtDevolucaoCNTR', 'dtAverbacaoMDFE', 'dtDescidaCNTRCarga'
];

const calculateSyncStatus = (record) => {
  const issues = [];
  let syncCount = 0;
  let missingCount = 0;
  SYNC_DATE_FIELDS.forEach(field => {
    if (record[field]) { syncCount++; }
    else { missingCount++; issues.push(field); }
  });
  if (missingCount === 0 && syncCount > 0)
    return { status: 'SINCRONIZADO', color: '#10b981', icon: '✓', severity: 'success', issues };
  if (syncCount > 0 && missingCount > 0)
    return { status: 'PARCIAL', color: '#f59e0b', icon: '◑', severity: 'warning', issues };
  return { status: 'VAZIO', color: '#ef4444', icon: '✕', severity: 'error', issues };
};

const CURRENCY_FIELDS = new Set(['vlFreteProcesso','vlPedagio','vlFreteLista','vlAbastecimento']);
const DATE_FIELDS = new Set([
  'dtInicioRota','dtInicioDescarga','dtFimDescarga','dtRetiraPD','dtDevolucaoCNTR',
  'dtInicio','dtSM','dtAgendamentoDescarga','dtDescidaCNTRCarga','dtAverbacaoMDFE','arrivedAt',
]);

const formatCurrency = (val) => {
  const n = parseFloat(String(val).replace(',', '.'));
  if (isNaN(n)) return val || '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const renderCell = (fieldKey, rawValue) => {
  if (!rawValue && rawValue !== 0) return <span className="ic-empty">—</span>;

  if (['situacao','status','situacaoCIOT','situacaoMDFE'].includes(fieldKey)) {
    const cfg = getSituacaoConfig(rawValue);
    if (cfg) return (
      <span className="ic-badge" style={{
        background: cfg.bg, color: cfg.text,
        border: `1px solid ${cfg.border}`
      }}>
        <span className="ic-badge-dot" style={{ background: cfg.dot }} />
        {rawValue}
      </span>
    );
  }

  if (CURRENCY_FIELDS.has(fieldKey))
    return <span className="ic-currency">{formatCurrency(rawValue)}</span>;

  if (DATE_FIELDS.has(fieldKey)) {
    try {
      const date = new Date(rawValue);
      if (!isNaN(date.getTime()))
        return (
          <span className="ic-date">
            {date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        );
    } catch (e) { /* fallback */ }
  }

  return rawValue;
};

/* ─── Skeleton ── */
const SkeletonRow = ({ cols }) => (
  <tr className="ic-skeleton-row">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className={`ic-td ${i < STICKY_COLS ? `ic-td-sticky ic-sticky-${i}` : ''}`}>
        <span className="ic-skeleton-pulse" style={{ width: `${44 + (i * 19) % 80}px` }} />
      </td>
    ))}
  </tr>
);

/* ════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════ */
const Icompany = () => {
  const navigate    = useNavigate();
  const scrollRef   = useRef(null);
  const searchTimer = useRef(null);

  const [searchTerm,    setSearchTerm]    = useState('');
  const [data,          setData]          = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [canScrollL,    setCanScrollL]    = useState(false);
  const [canScrollR,    setCanScrollR]    = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [syncFilter,    setSyncFilter]    = useState('all');
  const [excelComparison, setExcelComparison] = useState({});

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get('/ycompany');
      setData(res.data?.data || []);
    } catch {
      setError('Falha ao carregar dados da Icompany');
      setData([]);
    } finally { setLoading(false); }
  }, []);

  const fetchComparison = useCallback(async () => {
    try {
      const res = await api.get('/ycompany/compare');
      const compMap = {};
      res.data?.data?.forEach(comp => {
        if (comp.processo) compMap[comp.processo] = comp.analysis;
      });
      setExcelComparison(compMap);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchAll(); fetchComparison(); }, [fetchAll, fetchComparison]);

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

  const scrollBy = (dir) => scrollRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });

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
      finally { setLoading(false); }
    }, 400);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    await fetchComparison();
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/ycompany/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href = url; a.download = `icompany-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); a.remove();
    } catch { alert('Falha ao exportar dados'); }
  };

  /* ── Análise sync ── */
  const syncAnalysi = data.map(record => {
    const syncStatus = calculateSyncStatus(record);
    const lookupKey  = record.geomaritima || record.processo || record.codigo;
    const excelData  = excelComparison[lookupKey] || {};
    let hasDesync = false, desyncFields = [];
    Object.entries(excelData).forEach(([colName, comparison]) => {
      if ((comparison.geoTower === 'V' && comparison.icompany === 'X') ||
          (comparison.geoTower === 'X' && comparison.icompany === 'V')) {
        hasDesync = true; desyncFields.push(colName);
      }
    });
    return { ...record, syncStatus, excelSync: { hasDesync, desyncFields, excelData } };
  });

  const problemRecords = syncAnalysi.filter(r => r.syncStatus.severity !== 'success');
  const partialRecords = syncAnalysi.filter(r => r.syncStatus.severity === 'warning');
  const emptyRecords   = syncAnalysi.filter(r => r.syncStatus.severity === 'error');
  const desyncRecords  = syncAnalysi.filter(r => r.excelSync?.hasDesync);

  const filteredData =
    syncFilter === 'problems' ? problemRecords :
    syncFilter === 'partial'  ? partialRecords :
    syncFilter === 'empty'    ? emptyRecords   :
    syncFilter === 'desync'   ? desyncRecords  :
    syncAnalysi;

  const syncOk = syncAnalysi.filter(r => r.syncStatus.severity === 'success').length;

  return (
    <>
      <style>{`
        /* ════ TOKENS ════ */
        :root {
          --ic-ink:        #0a0e1a;
          --ic-ink-2:      #1e2540;
          --ic-ink-3:      #334155;
          --ic-muted:      #64748b;
          --ic-muted-2:    #94a3b8;
          --ic-border:     #e8edf5;
          --ic-border-2:   #dde3ef;
          --ic-surface:    #ffffff;
          --ic-surface-2:  #f7f8fc;
          --ic-surface-3:  #f0f2f9;
          --ic-primary:    #4f46e5;
          --ic-primary-lt: #eef2ff;
          --ic-accent:     #06b6d4;
          --ic-accent-lt:  #ecfeff;
          --ic-success:    #10b981;
          --ic-warning:    #f59e0b;
          --ic-danger:     #ef4444;
          --ic-r:          12px;
          --ic-r-sm:       8px;
          --ic-sh-xs:      0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
          --ic-sh-sm:      0 2px 8px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04);
          --ic-sh-md:      0 8px 24px rgba(15,20,40,.08), 0 2px 6px rgba(0,0,0,.05);
          --ic-sh-lg:      0 24px 64px rgba(15,20,40,.12), 0 8px 24px rgba(0,0,0,.07);

          /* ✅ painel responsivo */
          --ic-panel:      clamp(320px, 34vw, 620px);
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ════ LAYOUT ROOT ════ */
        .ic-root {
          min-height: 100vh;
          background: #f0f2f9;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          color: var(--ic-ink);
        }

        /* ════════════════════════════════
           HEADER — Ultra Premium
        ════════════════════════════════ */
        .ic-header {
          position: sticky; top: 0; z-index: 200;
          background: linear-gradient(160deg, #09090f 0%, #0d0d2b 35%, #0a1628 65%, #0d1f3c 100%);
          border-bottom: 1px solid rgba(255,255,255,.055);
        }

        /* Noise texture overlay */
        .ic-header::after {
          content: '';
          position: absolute; inset: 0; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.025'/%3E%3C/svg%3E");
          opacity: .4;
        }

        /* Ambient glows */
        .ic-header-glow-a {
          position: absolute; top: -80px; right: 8%;
          width: 400px; height: 300px; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(79,70,229,.22) 0%, transparent 70%);
          pointer-events: none;
        }
        .ic-header-glow-b {
          position: absolute; bottom: -60px; left: 20%;
          width: 320px; height: 240px; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(6,182,212,.14) 0%, transparent 70%);
          pointer-events: none;
        }
        .ic-header-glow-c {
          position: absolute; top: -40px; left: -60px;
          width: 260px; height: 200px; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(139,92,246,.12) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ── Top bar ── */
        .ic-header-top {
          position: relative; z-index: 2;
          max-width: 1720px; margin: 0 auto;
          padding: 0 36px;
          height: 68px;
          display: flex; align-items: center; justify-content: space-between; gap: 24px;
        }

        .ic-header-left  { display: flex; align-items: center; gap: 18px; }
        .ic-header-right { display: flex; align-items: center; gap: 10px; }

        /* Back button */
        .ic-back-btn {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.1);
          color: rgba(255,255,255,.75); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .2s ease; font-size: .82rem;
        }
        .ic-back-btn:hover {
          background: rgba(255,255,255,.13); border-color: rgba(255,255,255,.2);
          color: #fff; transform: translateX(-2px);
        }

        /* Separator line */
        .ic-header-vsep {
          width: 1px; height: 32px; flex-shrink: 0;
          background: rgba(255,255,255,.1);
        }

        /* Brand */
        .ic-brand { display: flex; align-items: center; gap: 13px; }

        .ic-brand-icon {
          width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
          background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.15rem;
          box-shadow: 0 0 0 1px rgba(255,255,255,.1), 0 4px 16px rgba(79,70,229,.5);
        }

        .ic-brand-name {
          font-size: 1.38rem; font-weight: 800;
          letter-spacing: -.7px; line-height: 1;
          background: linear-gradient(135deg, #ffffff 20%, #a5b4fc 60%, #67e8f9 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ic-brand-sub {
          font-size: .7rem; font-weight: 400;
          color: rgba(255,255,255,.38); letter-spacing: .2px; margin-top: 3px;
          display: flex; align-items: center; gap: 6px;
        }
        .ic-brand-pulse {
          width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
          background: #06b6d4; box-shadow: 0 0 8px #06b6d4;
          animation: ic-pulse 2.4s ease-in-out infinite;
        }
        @keyframes ic-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.65)} }

        /* Header meta pills */
        .ic-header-meta { display: flex; align-items: center; gap: 8px; }
        .ic-meta-chip {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 20px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.1);
          font-size: .73rem; font-weight: 600; color: rgba(255,255,255,.6);
          backdrop-filter: blur(6px);
        }
        .ic-meta-chip b { color: rgba(255,255,255,.9); }

        /* Header action buttons */
        .ic-hbtn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 9px; cursor: pointer;
          font-size: .8rem; font-weight: 600; border: 1px solid transparent;
          transition: all .2s ease; white-space: nowrap;
          font-family: inherit; letter-spacing: .2px;
        }
        .ic-hbtn-ghost {
          background: rgba(255,255,255,.07);
          border-color: rgba(255,255,255,.1);
          color: rgba(255,255,255,.75);
        }
        .ic-hbtn-ghost:hover {
          background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.18); color: #fff;
        }
        .ic-hbtn-primary {
          background: linear-gradient(135deg, #4f46e5, #6d28d9);
          border-color: rgba(255,255,255,.12); color: #fff;
          box-shadow: 0 2px 12px rgba(79,70,229,.45);
        }
        .ic-hbtn-primary:hover {
          background: linear-gradient(135deg, #4338ca, #5b21b6);
          box-shadow: 0 4px 20px rgba(79,70,229,.6); transform: translateY(-1px);
        }
        .ic-hbtn-teal {
          background: linear-gradient(135deg, #0891b2, #0e7490);
          border-color: rgba(255,255,255,.1); color: #fff;
          box-shadow: 0 2px 12px rgba(6,182,212,.3);
        }
        .ic-hbtn-teal:hover {
          background: linear-gradient(135deg, #0e7490, #155e75);
          box-shadow: 0 4px 20px rgba(6,182,212,.45); transform: translateY(-1px);
        }

        /* Divider strip */
        .ic-header-strip {
          position: relative; z-index: 2;
          background: rgba(0,0,0,.25); backdrop-filter: blur(8px);
          border-top: 1px solid rgba(255,255,255,.045);
        }
        .ic-strip-inner {
          max-width: 1720px; margin: 0 auto;
          padding: 0 36px; height: 40px;
          display: flex; align-items: center; gap: 0;
        }
        .ic-strip-item {
          display: flex; align-items: center; gap: 8px;
          padding: 0 20px 0 0; margin-right: 20px;
          border-right: 1px solid rgba(255,255,255,.07);
          color: rgba(255,255,255,.45); font-size: .72rem;
        }
        .ic-strip-item:last-child { border-right: none; margin-right: 0; }
        .ic-strip-icon {
          width: 22px; height: 22px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: .65rem;
        }
        .ic-strip-val { color: rgba(255,255,255,.85); font-weight: 700; font-size: .8rem; }

        /* ════════════════════════════════
           MAIN BODY
        ════════════════════════════════ */
        .ic-body {
          max-width: 1720px; margin: 0 auto;
          padding: 28px 36px;
          display: flex; flex-direction: column; gap: 18px;
        }

        /* ════════════════════════════════
           TOOLBAR
        ════════════════════════════════ */
        .ic-toolbar {
          display: flex; align-items: center; gap: 10px;
          background: var(--ic-surface); border-radius: var(--ic-r);
          padding: 10px 14px;
          border: 1px solid var(--ic-border);
          box-shadow: var(--ic-sh-sm);
        }

        .ic-search-wrap { flex: 1; position: relative; display: flex; align-items: center; min-width: 0; }
        .ic-search-icon {
          position: absolute; left: 13px; color: var(--ic-muted-2);
          font-size: .82rem; pointer-events: none; z-index: 1;
        }
        .ic-search {
          width: 100%; height: 40px; padding: 0 38px;
          border: 1.5px solid var(--ic-border-2); border-radius: var(--ic-r-sm);
          font-size: .84rem; outline: none;
          background: var(--ic-surface-2); color: var(--ic-ink);
          transition: all .18s ease; font-family: inherit;
        }
        .ic-search::placeholder { color: var(--ic-muted-2); }
        .ic-search:focus {
          border-color: var(--ic-primary); background: #fff;
          box-shadow: 0 0 0 3px rgba(79,70,229,.08);
        }
        .ic-search-clear {
          position: absolute; right: 10px;
          background: none; border: none; cursor: pointer;
          color: var(--ic-muted-2); display: flex; align-items: center;
          padding: 5px; border-radius: 6px; transition: all .15s;
        }
        .ic-search-clear:hover { color: var(--ic-danger); background: #fee2e2; }

        .ic-tb-sep { width: 1px; height: 28px; background: var(--ic-border); flex-shrink: 0; margin: 0 2px; }

        .ic-tb-btn {
          height: 40px; display: flex; align-items: center; gap: 7px;
          padding: 0 14px; border-radius: var(--ic-r-sm);
          border: 1.5px solid var(--ic-border-2);
          background: var(--ic-surface-2); color: var(--ic-muted);
          font-size: .81rem; font-weight: 600; cursor: pointer;
          transition: all .18s ease; white-space: nowrap; font-family: inherit;
          flex-shrink: 0;
        }
        .ic-tb-btn:hover {
          border-color: var(--ic-primary); color: var(--ic-primary);
          background: var(--ic-primary-lt); box-shadow: 0 0 0 3px rgba(79,70,229,.07);
        }
        .ic-tb-btn svg { font-size: .78rem; }

        .ic-tb-btn-icon {
          width: 40px; padding: 0; justify-content: center;
        }

        /* Sync alert button */
        .ic-sync-btn {
          height: 40px; display: flex; align-items: center; gap: 8px;
          padding: 0 14px; border-radius: var(--ic-r-sm);
          font-size: .8rem; font-weight: 700; cursor: pointer;
          font-family: inherit; flex-shrink: 0;
          transition: all .18s ease;
        }
        .ic-sync-btn-warn {
          background: rgba(239,68,68,.07);
          border: 1.5px solid rgba(239,68,68,.3);
          color: #dc2626;
        }
        .ic-sync-btn-warn:hover {
          background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.5);
          box-shadow: 0 0 0 3px rgba(239,68,68,.08);
        }
        .ic-sync-btn-ok {
          background: rgba(16,185,129,.07);
          border: 1.5px solid rgba(16,185,129,.3);
          color: #059669;
        }
        .ic-sync-btn-ok:hover {
          background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.5);
        }
        .ic-sync-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
          font-size: .7rem; font-weight: 800; background: #dc2626; color: #fff;
        }

        /* ════════════════════════════════
           TABLE CARD
        ════════════════════════════════ */
        .ic-card {
          background: var(--ic-surface);
          border-radius: var(--ic-r);
          border: 1px solid var(--ic-border);
          box-shadow: var(--ic-sh-md);
          overflow: hidden;
          position: relative;
        }

        /* Card header */
        .ic-card-top {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px;
          background: var(--ic-surface);
          border-bottom: 1px solid var(--ic-border);
        }
        .ic-card-top-left  { display: flex; align-items: center; gap: 10px; }
        .ic-card-top-right { display: flex; align-items: center; gap: 8px; }

        .ic-card-eyebrow {
          width: 6px; height: 24px; border-radius: 3px; flex-shrink: 0;
          background: linear-gradient(180deg, #4f46e5, #06b6d4);
        }
        .ic-card-title-wrap {}
        .ic-card-title {
          font-size: .88rem; font-weight: 700; color: var(--ic-ink-2); line-height: 1.2;
        }
        .ic-card-subtitle { font-size: .72rem; color: var(--ic-muted); margin-top: 1px; }

        .ic-tag {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 20px;
          font-size: .71rem; font-weight: 600; letter-spacing: .1px;
        }
        .ic-tag-indigo { background: var(--ic-primary-lt); color: var(--ic-primary); }
        .ic-tag-teal   { background: var(--ic-accent-lt);  color: #0891b2; }
        .ic-tag-slate  { background: #f1f5f9; color: #475569; }
        .ic-tag-live {
          background: rgba(16,185,129,.08); color: #059669;
          border: 1px solid rgba(16,185,129,.2);
        }

        .ic-tag-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
        }
        .ic-tag-dot-live {
          background: #10b981; box-shadow: 0 0 5px #10b981;
          animation: ic-pulse 2s ease-in-out infinite;
        }

        /* ════ SCROLL CHROME ════ */
        .ic-scroll-chrome {
          position: relative; overflow: hidden;
        }

        .ic-fade-l, .ic-fade-r {
          position: absolute; top: 0; bottom: 0; width: 80px;
          z-index: 12; pointer-events: none; transition: opacity .25s;
        }
        .ic-fade-l { left: 0; background: linear-gradient(to right, rgba(255,255,255,.95) 0%, transparent 100%); }
        .ic-fade-r { right: 0; background: linear-gradient(to left, rgba(255,255,255,.95) 0%, transparent 100%); }
        .ic-fade-l.off, .ic-fade-r.off { opacity: 0; }

        .ic-scroll-btn {
          position: absolute; top: 50%; transform: translateY(-50%);
          z-index: 14; width: 34px; height: 34px; border-radius: 50%;
          background: #fff; border: 1px solid var(--ic-border-2);
          box-shadow: 0 4px 14px rgba(0,0,0,.12);
          color: var(--ic-primary); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: .75rem; transition: all .2s ease;
        }
        .ic-scroll-btn:hover {
          background: var(--ic-primary); color: #fff;
          transform: translateY(-50%) scale(1.1);
          box-shadow: 0 6px 20px rgba(79,70,229,.35);
        }
        .ic-scroll-btn.l { left: 10px; }
        .ic-scroll-btn.r { right: 10px; }
        .ic-scroll-btn.off { opacity: 0; pointer-events: none; }

        /* ════ SCROLL AREA ════ */
        .ic-scroll {
          overflow-x: auto; overflow-y: auto;
          max-height: calc(100vh - 340px);
          scrollbar-width: thin;
          scrollbar-color: #c7d2fe #f5f3ff;
        }
        .ic-scroll::-webkit-scrollbar { height: 5px; width: 5px; }
        .ic-scroll::-webkit-scrollbar-track { background: #f5f3ff; }
        .ic-scroll::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 99px; }
        .ic-scroll::-webkit-scrollbar-thumb:hover { background: #a5b4fc; }

        /* ════ TABLE ════ */
        .ic-table {
          border-collapse: separate; border-spacing: 0;
          width: max-content; min-width: 100%;
          font-size: .82rem;
        }

        /* THEAD */
        .ic-thead tr {
          position: sticky; top: 0; z-index: 16;
        }
        .ic-th {
          padding: 10px 16px;
          background: #f7f8fc;
          font-size: .68rem; font-weight: 700;
          color: #6366f1; letter-spacing: .7px; text-transform: uppercase;
          white-space: nowrap; border-bottom: 1.5px solid #dde3ef;
          border-right: 1px solid #eaecf7; user-select: none;
        }
        .ic-th:last-child { border-right: none; }

        /* Sticky TH */
        .ic-th-sticky {
          position: sticky; z-index: 17;
          background: #eef0fa !important;
          border-right: 1.5px solid #d1d5f0 !important;
        }
        .ic-th-sticky-0 { left: 0; min-width: 100px; }
        .ic-th-sticky-1 { left: 100px; min-width: 148px; }

        /* TBODY rows */
        .ic-tr { transition: background .1s; }
        .ic-tr:hover .ic-td        { background: #f9f8ff !important; }
        .ic-tr:hover .ic-td-sticky { background: #f0eeff !important; }
        .ic-tr:nth-child(even) .ic-td { background: #fdfcff; }
        .ic-tr:nth-child(even) .ic-td-sticky { background: #f8f7fe; }

        .ic-td {
          padding: 10px 16px;
          color: var(--ic-ink-3); background: #fff;
          white-space: nowrap; vertical-align: middle;
          border-bottom: 1px solid #f1f3fa;
          border-right: 1px solid #f5f3ff;
          max-width: 240px; overflow: hidden; text-overflow: ellipsis;
          transition: background .1s;
        }
        .ic-td:last-child { border-right: none; }

        /* Sticky TD */
        .ic-td-sticky {
          position: sticky; z-index: 10;
          background: #faf9fe; font-weight: 600; color: var(--ic-ink-2);
          border-right: 1.5px solid #e4e1f5 !important;
          transition: background .1s;
        }
        .ic-sticky-0 { left: 0; min-width: 100px; max-width: 100px; }
        .ic-sticky-1 { left: 100px; min-width: 148px; max-width: 148px; }

        /* codigo chip */
        .ic-codigo {
          display: inline-flex; align-items: center;
          padding: 3px 9px; border-radius: 6px;
          background: linear-gradient(135deg, #eef2ff, #e0e7ff);
          color: #3730a3; font-weight: 700; font-size: .77rem; letter-spacing: .3px;
        }
        .ic-processo {
          color: #4f46e5; font-weight: 700; font-size: .82rem; letter-spacing: .15px;
        }

        /* BADGE */
        .ic-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 99px;
          font-size: .72rem; font-weight: 600; letter-spacing: .1px;
          transition: opacity .15s;
        }
        .ic-badge-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }

        /* CURRENCY */
        .ic-currency { font-weight: 600; color: #047857; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: .8rem; }

        /* DATE */
        .ic-date { color: var(--ic-muted); font-size: .79rem; }

        /* EMPTY */
        .ic-empty { color: #d1d5db; font-size: .78rem; }

        /* SYNC CELL */
        .ic-sync-cell {
          display: flex; align-items: center; gap: 6px;
        }
        .ic-sync-icon {
          width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: .8rem; font-weight: 800;
        }
        .ic-sync-label {
          font-size: .72rem; font-weight: 700; letter-spacing: .3px; text-transform: uppercase;
        }

        /* SKELETON */
        .ic-skeleton-row td { background: #fff !important; }
        .ic-skeleton-pulse {
          display: inline-block; height: 11px; border-radius: 5px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e8ecf4 50%, #f1f5f9 75%);
          background-size: 400% 100%;
          animation: ic-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes ic-shimmer { to { background-position: -400% 0; } }

        /* TABLE FOOTER */
        .ic-card-footer {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 10px;
          padding: 11px 20px;
          background: var(--ic-surface-2);
          border-top: 1px solid var(--ic-border);
        }
        .ic-footer-left  { display: flex; align-items: center; gap: 8px; font-size: .8rem; color: var(--ic-muted); }
        .ic-footer-right { display: flex; align-items: center; gap: 6px; color: var(--ic-muted-2); font-size: .73rem; }
        .ic-count { font-weight: 800; color: var(--ic-primary); font-size: .9rem; }

        .ic-scroll-hint { display: flex; align-items: center; gap: 4px; animation: ic-fadeout 3s ease forwards 5s; }
        @keyframes ic-fadeout { to { opacity: 0; } }

        /* ════ EMPTY STATE ════ */
        .ic-empty-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 72px 24px; gap: 12px; text-align: center;
        }
        .ic-empty-icon {
          width: 72px; height: 72px; border-radius: 20px;
          background: linear-gradient(135deg, #eef2ff, #e0e7ff);
          display: flex; align-items: center; justify-content: center;
          font-size: 2rem; margin-bottom: 4px;
          box-shadow: 0 6px 24px rgba(79,70,229,.15);
        }
        .ic-empty-title { font-size: 1rem; font-weight: 700; color: var(--ic-ink-2); }
        .ic-empty-sub   { font-size: .82rem; color: var(--ic-muted); max-width: 280px; line-height: 1.5; }

        /* ════ ERROR BAR ════ */
        .ic-error-bar {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: var(--ic-r-sm);
          background: #fef2f2; border: 1px solid #fecaca;
          color: #991b1b; font-size: .82rem; font-weight: 500;
        }
        .ic-error-bar button {
          margin-left: auto; background: none; border: none; cursor: pointer;
          color: #b91c1c; font-weight: 700; font-size: .82rem;
          text-decoration: underline; font-family: inherit;
        }

        /* ════ SPINNER ════ */
        .ic-spin { animation: ic-spin .65s linear infinite; }
        @keyframes ic-spin { to { transform: rotate(360deg); } }

        /* ════════════════════════════════
           SIDE PANEL — Sync Inspector (RESPONSIVO + SEM CORTE)
        ════════════════════════════════ */
        .ic-panel{
          position: fixed; right: 0; top: 0; bottom: 0;
          width: min(var(--ic-panel), 100vw);
          z-index: 500;

          background: #fff;
          border-left: 1px solid var(--ic-border);
          box-shadow: -8px 0 40px rgba(0,0,0,.1);

          display: flex;
          flex-direction: column;

          /* IMPORTANTÍSSIMO: altura real do viewport + evita corte no rodapé */
          height: 100dvh;
          max-height: 100dvh;
          padding-bottom: env(safe-area-inset-bottom);

          animation: ic-slide-in .28s cubic-bezier(.16,1,.3,1) both;
        }
        @keyframes ic-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }

        .ic-panel-head{
          padding: 18px 18px 14px;
          background: linear-gradient(135deg, #0f0c29, #302b63);
          flex-shrink: 0;
        }

        .ic-panel-head-row{
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .ic-panel-title{ font-size: 1rem; font-weight: 800; color: #fff; }
        .ic-panel-sub{ font-size: .74rem; color: rgba(255,255,255,.45); margin-top: 3px; }

        .ic-panel-close{
          width: 30px; height: 30px; border-radius: 8px;
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(255,255,255,.15);
          color: rgba(255,255,255,.7);
          cursor: pointer;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: .88rem;
          transition: all .15s;
          font-family: inherit;
        }
        .ic-panel-close:hover{ background: rgba(255,255,255,.2); color: #fff; }

        /* Tabs responsivas: quebram linha e não estouram largura */
        .ic-panel-filters{
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .ic-pf-tab{
          flex: 1 1 120px;
          min-width: 120px;
          padding: 7px 10px;
          border-radius: 8px;
          font-size: .68rem;
          font-weight: 800;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all .15s;
          font-family: inherit;
          text-align: center;
          white-space: nowrap;
        }
        .ic-pf-tab-default{
          background: rgba(255,255,255,.08);
          border-color: rgba(255,255,255,.12);
          color: rgba(255,255,255,.65);
        }
        .ic-pf-tab-default:hover{
          background: rgba(255,255,255,.14);
          color: rgba(255,255,255,.92);
        }
        .ic-pf-tab-active-all{ background: #4f46e5; color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,.4); }
        .ic-pf-tab-active-desync{ background: #dc2626; color: #fff; box-shadow: 0 2px 8px rgba(220,38,38,.4); }
        .ic-pf-tab-active-partial{ background: #d97706; color: #fff; box-shadow: 0 2px 8px rgba(217,119,6,.4); }
        .ic-pf-tab-active-empty{ background: #dc2626; color: #fff; box-shadow: 0 2px 8px rgba(220,38,38,.4); }

        /* ✅ ESSENCIAL: scroll funcionar dentro de flex column (sem “corte”) */
        .ic-panel-list{
          flex: 1 1 auto;
          min-height: 0;                 /* <- isso resolve o truncamento */
          overflow-y: auto;
          overflow-x: hidden;

          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;

          scrollbar-width: thin;
          scrollbar-color: #e0e7ff #fafbff;
        }
        .ic-panel-list::-webkit-scrollbar{ width: 4px; }
        .ic-panel-list::-webkit-scrollbar-track{ background: #fafbff; }
        .ic-panel-list::-webkit-scrollbar-thumb{ background: #c7d2fe; border-radius: 99px; }

        /* Cards */
        .ic-prec{
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--ic-border);
          background: var(--ic-surface);
          transition: box-shadow .15s;
        }
        .ic-prec:hover{ box-shadow: var(--ic-sh-sm); }

        .ic-prec-head{
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          gap: 10px;
        }
        .ic-prec-id{
          font-size: .84rem;
          font-weight: 800;
          color: var(--ic-ink-2);

          /* evita quebrar layout em ids grandes */
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ic-prec-badges{
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .ic-prec-badge{
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 7px;
          font-size: .68rem;
          font-weight: 900;
          letter-spacing: .3px;
          text-transform: uppercase;
        }

        /* Comparação: sempre visível */
        .ic-comp{
          margin: 0 12px 12px;
          border-radius: 8px;
          overflow-x: auto;                 /* <- permite ver tudo em telas pequenas */
          border: 1px solid var(--ic-border-2);
          -webkit-overflow-scrolling: touch;
        }
        .ic-comp-head{
          padding: 7px 10px;
          background: #f7f8fc;
          border-bottom: 1px solid var(--ic-border-2);
          font-size: .68rem;
          font-weight: 800;
          color: var(--ic-muted);
          letter-spacing: .5px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* tabela não “espreme” conteúdo */
        .ic-comp-table{
          width: max-content;
          min-width: 100%;
          border-collapse: collapse;
          font-size: .72rem;
        }
        .ic-comp-table th{
          padding: 6px 8px;
          text-align: center;
          background: #f7f8fc;
          font-size: .64rem;
          font-weight: 900;
          color: var(--ic-muted);
          letter-spacing: .4px;
          text-transform: uppercase;
          border-bottom: 1px solid var(--ic-border-2);
        }
        .ic-comp-table th:first-child{ text-align: left; }

        .ic-comp-table td{
          padding: 6px 8px;
          border-bottom: 1px solid #f5f3ff;
          color: var(--ic-ink-3);
          vertical-align: top;
        }
        .ic-comp-table tr:last-child td{ border-bottom: none; }

        .ic-comp-table td:first-child{
          white-space: normal;              /* <- “Campo” quebra linha */
          word-break: break-word;
          max-width: 240px;
        }

        .ic-comp-v{ color: #059669; font-weight: 900; }
        .ic-comp-x{ color: #dc2626; font-weight: 900; }
        .ic-comp-row-err{ background: rgba(239,68,68,.03); }

        /* Empty state do painel */
        .ic-panel-empty{
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 16px;
          gap: 8px;
          color: var(--ic-muted);
          text-align: center;
        }
        .ic-panel-empty-icon{ font-size: 2rem; margin-bottom: 4px; }
        .ic-panel-empty-title{ font-size: .9rem; font-weight: 800; color: var(--ic-ink-2); }
        .ic-panel-empty-sub{ font-size: .78rem; }

        /* ════ RESPONSIVE ════ */
        @media (max-width: 900px) {
          .ic-header-top  { padding: 0 18px; }
          .ic-strip-inner { padding: 0 18px; }
          .ic-body        { padding: 16px 18px; gap: 14px; }
          .ic-header-meta { display: none; }

          /* ✅ override correto da variável em breakpoint */
          :root { --ic-panel: clamp(280px, 70vw, 520px); }
        }
        @media (max-width: 600px) {
          .ic-brand-name { font-size: 1.1rem; }
          .ic-toolbar    { flex-wrap: wrap; }
        }

        /* ✅ Mobile pequeno: painel ocupa a tela inteira */
        @media (max-width: 520px){
          .ic-panel{
            width: 100vw;
            border-left: none;
            box-shadow: 0 0 0 9999px rgba(0,0,0,.25);
          }
          .ic-pf-tab{
            flex: 1 1 calc(50% - 6px);
            min-width: 0;
          }
          .ic-comp-table td:first-child{
            max-width: 180px;
          }
        }
      `}</style>

      <div className="ic-root">

        {/* ══════════════════════════════════════
            HEADER
        ══════════════════════════════════════ */}
        <header className="ic-header">
          <div className="ic-header-glow-a" />
          <div className="ic-header-glow-b" />
          <div className="ic-header-glow-c" />

          {/* Top bar */}
          <div className="ic-header-top">
            {/* Left */}
            <div className="ic-header-left">
              <button className="ic-back-btn" onClick={() => navigate('/home')} title="Voltar">
                <FaArrowLeft />
              </button>
              <div className="ic-header-vsep" />
              <div className="ic-brand">
                <div className="ic-brand-icon">
                  <MdAnchor style={{ color: '#fff', filter: 'drop-shadow(0 0 8px rgba(255,255,255,.35))' }} />
                </div>
                <div>
                  <div className="ic-brand-name">Icompany</div>
                  <div className="ic-brand-sub">
                    <span className="ic-brand-pulse" />
                    Base de dados operacional marítima
                  </div>
                </div>
              </div>

              {/* Meta chips */}
              <div className="ic-header-meta">
                <div className="ic-meta-chip">
                  <span>Registros</span>
                  <b>{loading ? '—' : data.length.toLocaleString('pt-BR')}</b>
                </div>
                <div className="ic-meta-chip">
                  <span>Colunas</span>
                  <b>{COLUMNS.length}</b>
                </div>
                {problemRecords.length > 0 && (
                  <div className="ic-meta-chip" style={{ borderColor: 'rgba(239,68,68,.3)', color: '#fca5a5' }}>
                    <span>⚠</span>
                    <b style={{ color: '#fca5a5' }}>{problemRecords.length} inconsistências</b>
                  </div>
                )}
              </div>
            </div>

            {/* Right */}
            <div className="ic-header-right">
              <button
                className={`ic-hbtn ic-hbtn-ghost`}
                onClick={handleRefresh}
                title="Atualizar dados"
              >
                <FaSyncAlt className={refreshing ? 'ic-spin' : ''} style={{ fontSize: '.78rem' }} />
                <span>Atualizar</span>
              </button>
              <button className="ic-hbtn ic-hbtn-teal" onClick={handleExport}>
                <FaDownload style={{ fontSize: '.78rem' }} />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Strip */}
          <div className="ic-header-strip">
            <div className="ic-strip-inner">
              <div className="ic-strip-item">
                <div className="ic-strip-icon" style={{ background: 'rgba(99,102,241,.15)', color: '#818cf8' }}>
                  <FaTable />
                </div>
                <span>Total</span>
                <span className="ic-strip-val">{data.length.toLocaleString('pt-BR')}</span>
              </div>
              <div className="ic-strip-item">
                <div className="ic-strip-icon" style={{ background: 'rgba(16,185,129,.15)', color: '#34d399' }}>
                  ✓
                </div>
                <span>Sincronizados</span>
                <span className="ic-strip-val" style={{ color: '#34d399' }}>
                  {loading ? '—' : syncAnalysi.filter(r => r.syncStatus.severity === 'success').length.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="ic-strip-item">
                <div className="ic-strip-icon" style={{ background: 'rgba(245,158,11,.15)', color: '#fbbf24' }}>
                  ◑
                </div>
                <span>Parciais</span>
                <span className="ic-strip-val" style={{ color: '#fbbf24' }}>
                  {loading ? '—' : partialRecords.length.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="ic-strip-item">
                <div className="ic-strip-icon" style={{ background: 'rgba(239,68,68,.15)', color: '#f87171' }}>
                  ✕
                </div>
                <span>Sem dados</span>
                <span className="ic-strip-val" style={{ color: '#f87171' }}>
                  {loading ? '—' : emptyRecords.length.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="ic-strip-item">
                <div className="ic-strip-icon" style={{ background: 'rgba(239,68,68,.15)', color: '#f87171' }}>
                  ⚡
                </div>
                <span>Divergências</span>
                <span className="ic-strip-val" style={{ color: '#f87171' }}>
                  {loading ? '—' : desyncRecords.length.toLocaleString('pt-BR')}
                </span>
              </div>
              {searchTerm && (
                <div className="ic-strip-item">
                  <span style={{ color: 'rgba(255,255,255,.55)', fontSize: '.72rem' }}>
                    🔍 <b style={{ color: 'rgba(255,255,255,.9)' }}>&ldquo;{searchTerm}&rdquo;</b>
                    &nbsp;—&nbsp;{data.length} resultado(s)
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ══════════════════════════════════════
            BODY
        ══════════════════════════════════════ */}
        <main className="ic-body">

          {/* Error */}
          {error && (
            <div className="ic-error-bar">
              <span>⚠️</span>
              <span>{error}</span>
              <button onClick={fetchAll}>Tentar novamente</button>
            </div>
          )}

          {/* ── TOOLBAR ── */}
          <div className="ic-toolbar">
            {/* Search */}
            <div className="ic-search-wrap">
              <FaSearch className="ic-search-icon" />
              <input
                className="ic-search"
                type="text"
                placeholder="Buscar por qualquer campo…"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchTerm && (
                <button className="ic-search-clear" onClick={() => handleSearch('')}>
                  <FaTimes style={{ fontSize: '.78rem' }} />
                </button>
              )}
            </div>

            <div className="ic-tb-sep" />

            <button className="ic-tb-btn ic-tb-btn-icon" onClick={handleRefresh} title="Recarregar">
              <FaSyncAlt className={refreshing ? 'ic-spin' : ''} />
            </button>

            <button className="ic-tb-btn">
              <FaFilter style={{ color: '#94a3b8', fontSize: '.75rem' }} />
              <span>Filtros</span>
            </button>

            <button className="ic-tb-btn">
              <FaColumns style={{ color: '#94a3b8', fontSize: '.75rem' }} />
              <span>Colunas</span>
            </button>

            <div className="ic-tb-sep" />

            {/* Sync button */}
            <button
              className={`ic-sync-btn ${problemRecords.length > 0 ? 'ic-sync-btn-warn' : 'ic-sync-btn-ok'}`}
              onClick={() => setShowSyncPanel(!showSyncPanel)}
              title="Painel de Sincronização"
            >
              {problemRecords.length > 0 ? (
                <>
                  <span>⚠</span>
                  <span>Inconsistências</span>
                  <span className="ic-sync-count">{problemRecords.length}</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>Tudo sincronizado</span>
                </>
              )}
            </button>
          </div>

          {/* ══ TABLE CARD ══ */}
          <div className="ic-card">

            {/* Card top */}
            <div className="ic-card-top">
              <div className="ic-card-top-left">
                <div className="ic-card-eyebrow" />
                <div className="ic-card-title-wrap">
                  <div className="ic-card-title">Dados Operacionais</div>
                  <div className="ic-card-subtitle">
                    {COLUMNS.length} campos · {STICKY_COLS} colunas fixas
                  </div>
                </div>
                <span className="ic-tag ic-tag-indigo">
                  <MdTableChart style={{ fontSize: '.73rem' }} />
                  {COLUMNS.length} colunas
                </span>
                {searchTerm && (
                  <span className="ic-tag ic-tag-slate">
                    🔍 &ldquo;{searchTerm}&rdquo; — {data.length} item(s)
                  </span>
                )}
              </div>
              <div className="ic-card-top-right">
                <span className="ic-tag ic-tag-live">
                  <span className="ic-tag-dot ic-tag-dot-live" />
                  {loading ? 'Carregando…' : `${filteredData.length.toLocaleString('pt-BR')} registros`}
                </span>
              </div>
            </div>

            {/* Scroll chrome */}
            <div className="ic-scroll-chrome">
              <div className={`ic-fade-l ${!canScrollL ? 'off' : ''}`} />
              <div className={`ic-fade-r ${!canScrollR ? 'off' : ''}`} />
              <button className={`ic-scroll-btn l ${!canScrollL ? 'off' : ''}`} onClick={() => scrollBy(-1)}>
                <FaChevronLeft />
              </button>
              <button className={`ic-scroll-btn r ${!canScrollR ? 'off' : ''}`} onClick={() => scrollBy(1)}>
                <FaChevronRight />
              </button>

              <div className="ic-scroll" ref={scrollRef}>
                {loading ? (
                  /* ── LOADING ── */
                  <table className="ic-table">
                    <thead className="ic-thead">
                      <tr>
                        <th className="ic-th ic-th-sticky ic-th-sticky-0">SYNC</th>
                        {COLUMNS.map((col, i) => (
                          <th key={col} className={`ic-th ${i < STICKY_COLS ? `ic-th-sticky ic-th-sticky-${i}` : ''}`}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SkeletonRow key={i} cols={COLUMNS.length + 1} />
                      ))}
                    </tbody>
                  </table>

                ) : data.length === 0 ? (
                  /* ── EMPTY ── */
                  <div className="ic-empty-state">
                    <div className="ic-empty-icon">🗂️</div>
                    <p className="ic-empty-title">Nenhum registro encontrado</p>
                    <p className="ic-empty-sub">
                      {searchTerm
                        ? `Nenhum resultado para "${searchTerm}". Tente outro termo de busca.`
                        : 'Nenhum dado disponível no momento.'}
                    </p>
                  </div>

                ) : (
                  /* ── TABLE ── */
                  <table className="ic-table">
                    <thead className="ic-thead">
                      <tr>
                        <th className="ic-th ic-th-sticky ic-th-sticky-0">SYNC</th>
                        {COLUMNS.map((col, i) => (
                          <th
                            key={col}
                            className={`ic-th ${i < STICKY_COLS ? `ic-th-sticky ic-th-sticky-${i}` : ''}`}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row, idx) => {
                        const s = row.syncStatus;
                        return (
                          <tr key={idx} className="ic-tr">
                            {/* SYNC cell */}
                            <td
                              className="ic-td ic-td-sticky ic-sticky-0"
                              style={{
                                background: s.color + '14',
                                borderRight: `2px solid ${s.color}55`,
                              }}
                            >
                              <div className="ic-sync-cell">
                                <div
                                  className="ic-sync-icon"
                                  style={{ background: s.color + '20', color: s.color }}
                                >
                                  {s.icon}
                                </div>
                                <span className="ic-sync-label" style={{ color: s.color }}>
                                  {s.status}
                                </span>
                              </div>
                            </td>

                            {/* Data cells */}
                            {COLUMNS.map((col, ci) => {
                              const fk  = FIELD_MAP[col];
                              const raw = row[fk];
                              return (
                                <td
                                  key={`${idx}-${ci}`}
                                  className={`ic-td ${ci < STICKY_COLS ? `ic-td-sticky ic-sticky-${ci}` : ''}`}
                                  title={typeof raw === 'string' ? raw : undefined}
                                >
                                  {ci === 0 ? (
                                    <span className="ic-codigo">{raw || '—'}</span>
                                  ) : ci === 1 ? (
                                    <span className="ic-processo">{raw || '—'}</span>
                                  ) : (
                                    renderCell(fk, raw)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Footer */}
            {!loading && data.length > 0 && (
              <div className="ic-card-footer">
                <div className="ic-footer-left">
                  <span>Exibindo</span>
                  <span className="ic-count">{filteredData.length.toLocaleString('pt-BR')}</span>
                  <span>de {data.length.toLocaleString('pt-BR')} registros</span>
                  <span className="ic-tag ic-tag-indigo" style={{ fontSize: '.68rem', padding: '2px 8px' }}>
                    {COLUMNS.length} cols
                  </span>
                  <span className="ic-tag ic-tag-slate" style={{ fontSize: '.68rem', padding: '2px 8px' }}>
                    {STICKY_COLS} fixas
                  </span>
                </div>
                <div className="ic-footer-right ic-scroll-hint">
                  <FaChevronLeft style={{ fontSize: '.6rem' }} />
                  <FaChevronRight style={{ fontSize: '.6rem' }} />
                  <span>Role para ver todas as colunas</span>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ══════════════════════════════════════
            SIDE PANEL — Sync Inspector
        ══════════════════════════════════════ */}
        {showSyncPanel && (
          <aside className="ic-panel">
            {/* Panel head */}
            <div className="ic-panel-head">
              <div className="ic-panel-head-row">
                <div>
                  <div className="ic-panel-title">Inspetor de Sincronização</div>
                  <div className="ic-panel-sub">
                    {problemRecords.length} inconsistência(s) detectada(s)
                  </div>
                </div>
                <button className="ic-panel-close" onClick={() => setShowSyncPanel(false)}>
                  <FaTimes />
                </button>
              </div>

              {/* Filter tabs */}
              <div className="ic-panel-filters">
                {[
                  { key: 'all',     label: `Todos`,           count: syncAnalysi.length,    active: 'ic-pf-tab-active-all'     },
                  { key: 'desync',  label: `Divergências`,    count: desyncRecords.length,  active: 'ic-pf-tab-active-desync'  },
                  { key: 'partial', label: `Parciais`,        count: partialRecords.length, active: 'ic-pf-tab-active-partial' },
                  { key: 'empty',   label: `Sem dados`,       count: emptyRecords.length,   active: 'ic-pf-tab-active-empty'   },
                ].map(tab => (
                  <button
                    key={tab.key}
                    className={`ic-pf-tab ${syncFilter === tab.key ? tab.active : 'ic-pf-tab-default'}`}
                    onClick={() => setSyncFilter(tab.key)}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Panel list */}
            <div className="ic-panel-list">
              {filteredData.length === 0 ? (
                <div className="ic-panel-empty">
                  <div className="ic-panel-empty-icon">✓</div>
                  <div className="ic-panel-empty-title">Tudo certo!</div>
                  <div className="ic-panel-empty-sub">Nenhum registro encontrado nesta categoria.</div>
                </div>
              ) : (
                filteredData.map((rec, i) => {
                  const s = rec.syncStatus;
                  const hasDesync = rec.excelSync?.hasDesync;
                  const compData  = rec.excelSync?.excelData || {};
                  const hasComp   = Object.keys(compData).length > 0;
                  return (
                    <div key={i} className="ic-prec">
                      {/* Record head */}
                      <div
                        className="ic-prec-head"
                        style={{
                          background: hasDesync
                            ? 'rgba(239,68,68,.04)'
                            : s.color + '08',
                          borderBottom: hasComp ? `1px solid ${hasDesync ? 'rgba(239,68,68,.12)' : s.color + '22'}` : 'none',
                        }}
                      >
                        <div className="ic-prec-id">
                          {rec.codigo || rec.processo || `Registro #${i + 1}`}
                        </div>
                        <div className="ic-prec-badges">
                          {hasDesync && (
                            <span
                              className="ic-prec-badge"
                              style={{ background: 'rgba(239,68,68,.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,.25)' }}
                            >
                              ⚡ DESYNC
                            </span>
                          )}
                          <span
                            className="ic-prec-badge"
                            style={{ background: s.color + '15', color: s.color, border: `1px solid ${s.color}40` }}
                          >
                            {s.icon} {s.status}
                          </span>
                        </div>
                      </div>

                      {/* Comparison table */}
                      {hasComp && (
                        <div className="ic-comp">
                          <div className="ic-comp-head">
                            📊 Comparação entre sistemas
                          </div>
                          <table className="ic-comp-table">
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Campo</th>
                                <th>GEO TOWER</th>
                                <th>ICOMPANY</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(compData).map(([colName, comparison], j) => {
                                const isErr =
                                  (comparison.geoTower === 'V' && comparison.icompany === 'X') ||
                                  (comparison.geoTower === 'X' && comparison.icompany === 'V');
                                return (
                                  <tr key={j} className={isErr ? 'ic-comp-row-err' : ''}>
                                    <td style={{ fontWeight: isErr ? '600' : '400', color: isErr ? '#dc2626' : undefined }}>
                                      {colName}
                                    </td>
                                    <td className={comparison.geoTower === 'V' ? 'ic-comp-v' : 'ic-comp-x'} style={{ textAlign: 'center' }}>
                                      {comparison.geoTower}
                                    </td>
                                    <td className={comparison.icompany === 'V' ? 'ic-comp-v' : 'ic-comp-x'} style={{ textAlign: 'center' }}>
                                      {comparison.icompany}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>
    </>
  );
};

export default Icompany;
