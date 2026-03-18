import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft, FaDownload, FaSearch, FaTable,
  FaChevronLeft, FaChevronRight, FaTimes, FaFilter,
  FaDatabase, FaCheckCircle, FaSyncAlt, FaShip,
  FaLayerGroup, FaBolt, FaColumns
} from 'react-icons/fa';
import { MdTableChart, MdAnchor, MdOutlineWaves } from 'react-icons/md';
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
  'Hr. início descarga':      'desovaStartAt',
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
  'AGENDADO':      { bg: 'rgba(59,130,246,.12)', text: '#1d4ed8', dot: '#3b82f6', glow: '0 0 8px rgba(59,130,246,.4)'  },
  'EM EXECUÇÃO':   { bg: 'rgba(234,179,8,.12)',  text: '#92400e', dot: '#f59e0b', glow: '0 0 8px rgba(234,179,8,.4)'   },
  'FINALIZADO':    { bg: 'rgba(16,185,129,.12)', text: '#065f46', dot: '#10b981', glow: '0 0 8px rgba(16,185,129,.4)'  },
  'CANCELADO':     { bg: 'rgba(239,68,68,.12)',  text: '#991b1b', dot: '#ef4444', glow: '0 0 8px rgba(239,68,68,.4)'   },
  'NEGÓCIO CONF.': { bg: 'rgba(168,85,247,.12)', text: '#6b21a8', dot: '#a855f7', glow: '0 0 8px rgba(168,85,247,.4)' },
  'OPERAÇÃO EM':   { bg: 'rgba(20,184,166,.12)', text: '#115e59', dot: '#14b8a6', glow: '0 0 8px rgba(20,184,166,.4)' },
};

const getSituacaoConfig = (value) => {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  for (const key of Object.keys(STATUS_CONFIG)) {
    if (upper.includes(key)) return STATUS_CONFIG[key];
  }
  return { bg: 'rgba(100,116,139,.1)', text: '#475569', dot: '#94a3b8', glow: 'none' };
};

const CURRENCY_FIELDS = new Set(['vlFreteProcesso','vlPedagio','vlFreteLista','vlAbastecimento']);
const DATE_FIELDS = new Set([
  'dtInicioRota','dtInicioDescarga','dtFimDescarga','dtRetiraPD','dtDevolucaoCNTR',
  'dtInicio','dtSM','dtAgendamentoDescarga','dtDescidaCNTRCarga','dtAverbacaoMDFE','arrivedAt','desovaStartAt',
]);

const formatCurrency = (val) => {
  const n = parseFloat(String(val).replace(',', '.'));
  if (isNaN(n)) return val || '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const renderCell = (fieldKey, rawValue) => {
  if (!rawValue && rawValue !== 0) return <span className="ic-empty">—</span>;

  if (fieldKey === 'situacao' || fieldKey === 'status' || fieldKey === 'situacaoCIOT' || fieldKey === 'situacaoMDFE') {
    const cfg = getSituacaoConfig(rawValue);
    if (cfg) return (
      <span className="ic-badge" style={{ background: cfg.bg, color: cfg.text, boxShadow: cfg.glow }}>
        <span className="ic-badge-dot" style={{ background: cfg.dot }} />
        {rawValue}
      </span>
    );
  }

  if (CURRENCY_FIELDS.has(fieldKey)) {
    return <span className="ic-currency">{formatCurrency(rawValue)}</span>;
  }

  if (DATE_FIELDS.has(fieldKey) && rawValue) {
    try {
      const date = new Date(rawValue);
      if (!isNaN(date.getTime())) {
        return (
          <span className="ic-date">
            {date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        );
      }
    } catch (e) { /* fallback */ }
  }

  return rawValue;
};

/* ─── Skeleton Row ── */
const SkeletonRow = ({ cols }) => (
  <tr className="ic-skeleton-row">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className={`ic-td ${i < STICKY_COLS ? `ic-td-sticky ic-sticky-${i}` : ''}`}>
        <span className="ic-skeleton-pulse" style={{ width: `${48 + (i * 23) % 72}px` }} />
      </td>
    ))}
  </tr>
);

/* ════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — ICOMPANY
════════════════════════════════════════════════ */
const Icompany = () => {
  const navigate    = useNavigate();
  const scrollRef   = useRef(null);
  const searchTimer = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [canScrollL, setCanScrollL] = useState(false);
  const [canScrollR, setCanScrollR] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
      finally   { setLoading(false); }
    }, 400);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
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

  /* ── Stats rápidas ── */
  const agendados   = data.filter(r => String(r.status||'').toUpperCase().includes('AGENDADO')).length;
  const finalizados = data.filter(r => String(r.situacao||'').toUpperCase().includes('FINALIZADO')).length;
  const emExecucao  = data.filter(r => String(r.situacao||'').toUpperCase().includes('OPERAÇÃO')).length;

  return (
    <>
      <style>{`
        /* ════════ DESIGN SYSTEM ════════ */
        :root {
          --ic-primary:      #4f46e5;
          --ic-primary-dark: #3730a3;
          --ic-primary-deep: #1e1b4b;
          --ic-accent:       #06b6d4;
          --ic-accent2:      #8b5cf6;
          --ic-surface:      #ffffff;
          --ic-bg:           #f1f5f9;
          --ic-border:       #e2e8f0;
          --ic-text:         #0f172a;
          --ic-muted:        #64748b;
          --ic-radius:       14px;
          --ic-radius-sm:    9px;
          --ic-shadow-sm:    0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
          --ic-shadow-md:    0 4px 16px rgba(79,70,229,.10), 0 1px 4px rgba(0,0,0,.06);
          --ic-shadow-lg:    0 20px 60px rgba(79,70,229,.14), 0 4px 16px rgba(0,0,0,.08);
          --ic-glow:         0 0 40px rgba(79,70,229,.18);
        }

        /* ════ RESET ════ */
        *, *::before, *::after { box-sizing: border-box; }
        .ic-root {
          min-height: 100vh;
          background: var(--ic-bg);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* ════ HEADER ════ */
        .ic-header {
          position: sticky; top: 0; z-index: 100;
          background: linear-gradient(135deg, #0f0c29 0%, #302b63 40%, #24243e 100%);
          border-bottom: 1px solid rgba(255,255,255,.06);
        }
        .ic-header-bg-pattern {
          position: absolute; inset: 0; overflow: hidden; pointer-events: none;
        }
        .ic-header-bg-pattern::before {
          content: '';
          position: absolute; top: -60px; right: -40px;
          width: 320px; height: 320px; border-radius: 50%;
          background: radial-gradient(circle, rgba(79,70,229,.3) 0%, transparent 70%);
        }
        .ic-header-bg-pattern::after {
          content: '';
          position: absolute; bottom: -80px; left: 30%;
          width: 280px; height: 280px; border-radius: 50%;
          background: radial-gradient(circle, rgba(6,182,212,.2) 0%, transparent 70%);
        }

        .ic-header-top {
          position: relative; z-index: 1;
          max-width: 1680px; margin: 0 auto;
          padding: 18px 32px;
          display: flex; align-items: center; justify-content: space-between; gap: 20px;
        }

        .ic-header-left { display: flex; align-items: center; gap: 16px; }

        .ic-back-btn {
          width: 42px; height: 42px; border-radius: 12px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.9); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .2s; flex-shrink: 0; font-size: .9rem;
          backdrop-filter: blur(8px);
        }
        .ic-back-btn:hover {
          background: rgba(255,255,255,.16);
          border-color: rgba(255,255,255,.25);
          transform: translateX(-2px);
        }

        .ic-logo-wrap {
          display: flex; align-items: center; gap: 14px;
        }
        .ic-logo-icon {
          width: 48px; height: 48px; border-radius: 14px;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem; box-shadow: 0 4px 20px rgba(79,70,229,.5);
          flex-shrink: 0;
        }
        .ic-logo-text {}
        .ic-logo-title {
          font-size: 1.65rem; font-weight: 900; color: #fff;
          letter-spacing: -.8px; line-height: 1;
          background: linear-gradient(135deg, #fff 30%, #a5b4fc);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .ic-logo-sub {
          font-size: .74rem; color: rgba(255,255,255,.45);
          font-weight: 500; letter-spacing: .3px; margin-top: 2px;
          display: flex; align-items: center; gap: 5px;
        }
        .ic-logo-sub-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #06b6d4; flex-shrink: 0;
          box-shadow: 0 0 6px #06b6d4;
          animation: pulseDot 2s ease-in-out infinite;
        }
        @keyframes pulseDot {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.5; transform:scale(.7); }
        }

        .ic-header-right { display: flex; align-items: center; gap: 10px; }

        .ic-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 18px; border-radius: 10px;
          font-size: .83rem; font-weight: 600; cursor: pointer;
          transition: all .2s; white-space: nowrap;
          backdrop-filter: blur(8px);
        }
        .ic-btn-ghost {
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.85);
        }
        .ic-btn-ghost:hover {
          background: rgba(255,255,255,.14);
          border-color: rgba(255,255,255,.22);
        }
        .ic-btn-primary {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border: 1px solid rgba(255,255,255,.15);
          color: #fff;
          box-shadow: 0 4px 16px rgba(79,70,229,.4);
        }
        .ic-btn-primary:hover {
          background: linear-gradient(135deg, #4338ca, #6d28d9);
          box-shadow: 0 6px 24px rgba(79,70,229,.55);
          transform: translateY(-1px);
        }
        .ic-btn-export {
          background: linear-gradient(135deg, #06b6d4, #0891b2);
          border: 1px solid rgba(255,255,255,.15);
          color: #fff;
          box-shadow: 0 4px 16px rgba(6,182,212,.35);
        }
        .ic-btn-export:hover {
          background: linear-gradient(135deg, #0891b2, #0e7490);
          box-shadow: 0 6px 24px rgba(6,182,212,.5);
          transform: translateY(-1px);
        }

        /* ── STATS STRIP ── */
        .ic-stats-strip {
          position: relative; z-index: 1;
          border-top: 1px solid rgba(255,255,255,.06);
          background: rgba(0,0,0,.2);
          backdrop-filter: blur(8px);
        }
        .ic-stats-inner {
          max-width: 1680px; margin: 0 auto;
          padding: 12px 32px;
          display: flex; align-items: center; gap: 0; flex-wrap: wrap;
        }
        .ic-stat-item {
          display: flex; align-items: center; gap: 9px;
          padding: 6px 20px 6px 0; margin-right: 20px;
          border-right: 1px solid rgba(255,255,255,.08);
          color: rgba(255,255,255,.6); font-size: .78rem;
        }
        .ic-stat-item:last-child { border-right: none; margin-right: 0; }
        .ic-stat-icon-wrap {
          width: 28px; height: 28px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: .75rem;
        }
        .ic-stat-icon-blue  { background: rgba(59,130,246,.2); color: #60a5fa; }
        .ic-stat-icon-teal  { background: rgba(20,184,166,.2); color: #2dd4bf; }
        .ic-stat-icon-green { background: rgba(16,185,129,.2); color: #34d399; }
        .ic-stat-icon-indigo{ background: rgba(99,102,241,.2); color: #818cf8; }
        .ic-stat-icon-amber { background: rgba(245,158,11,.2); color: #fbbf24; }
        .ic-stat-label { font-size: .72rem; }
        .ic-stat-value { color: #fff; font-weight: 700; font-size: .88rem; }

        /* ════ BODY ════ */
        .ic-body {
          max-width: 1680px; margin: 0 auto; padding: 28px 32px;
        }

        /* ── KPI CARDS ── */
        .ic-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .ic-kpi {
          background: var(--ic-surface); border-radius: var(--ic-radius);
          padding: 20px 22px; position: relative; overflow: hidden;
          border: 1px solid var(--ic-border);
          box-shadow: var(--ic-shadow-sm);
          transition: transform .2s, box-shadow .2s;
        }
        .ic-kpi:hover { transform: translateY(-3px); box-shadow: var(--ic-shadow-md); }
        .ic-kpi-accent {
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          border-radius: var(--ic-radius) var(--ic-radius) 0 0;
        }
        .ic-kpi-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; margin-bottom: 14px;
        }
        .ic-kpi-value { font-size: 1.9rem; font-weight: 900; color: var(--ic-text); line-height: 1; }
        .ic-kpi-label { font-size: .78rem; color: var(--ic-muted); font-weight: 500; margin-top: 5px; }
        .ic-kpi-glow {
          position: absolute; bottom: -20px; right: -20px;
          width: 80px; height: 80px; border-radius: 50%; opacity: .07;
        }

        /* ── TOOLBAR ── */
        .ic-toolbar {
          display: flex; align-items: center; gap: 12px;
          background: var(--ic-surface); border-radius: var(--ic-radius);
          padding: 14px 18px; margin-bottom: 20px;
          border: 1px solid var(--ic-border);
          box-shadow: var(--ic-shadow-sm);
        }
        .ic-search-wrap { flex: 1; position: relative; display: flex; align-items: center; }
        .ic-search-icon {
          position: absolute; left: 14px; color: #94a3b8;
          font-size: .88rem; pointer-events: none;
        }
        .ic-search {
          width: 100%; padding: 10px 40px;
          border: 1.5px solid var(--ic-border); border-radius: 10px;
          font-size: .86rem; outline: none; background: #f8fafc; color: var(--ic-text);
          transition: all .2s;
        }
        .ic-search::placeholder { color: #94a3b8; }
        .ic-search:focus {
          border-color: var(--ic-primary); background: #fff;
          box-shadow: 0 0 0 3px rgba(79,70,229,.1);
        }
        .ic-search-clear {
          position: absolute; right: 11px;
          background: none; border: none; cursor: pointer;
          color: #94a3b8; display: flex; align-items: center; padding: 4px;
          border-radius: 6px; transition: all .2s;
        }
        .ic-search-clear:hover { color: #ef4444; background: #fee2e2; }

        .ic-sep { width: 1px; height: 30px; background: var(--ic-border); flex-shrink: 0; }

        .ic-icon-btn {
          width: 40px; height: 40px; border-radius: 10px;
          border: 1.5px solid var(--ic-border);
          background: #f8fafc; color: var(--ic-muted);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .2s; flex-shrink: 0;
          font-size: .88rem;
        }
        .ic-icon-btn:hover {
          border-color: var(--ic-primary); color: var(--ic-primary);
          background: #eef2ff; box-shadow: 0 0 0 3px rgba(79,70,229,.08);
        }

        .ic-filter-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 16px; border-radius: 10px;
          border: 1.5px solid var(--ic-border);
          background: #f8fafc; color: var(--ic-muted);
          font-size: .84rem; font-weight: 600; cursor: pointer;
          transition: all .2s; white-space: nowrap;
        }
        .ic-filter-btn:hover {
          border-color: var(--ic-primary); color: var(--ic-primary); background: #eef2ff;
        }
        .ic-filter-icon { color: #94a3b8; transition: color .2s; }
        .ic-filter-btn:hover .ic-filter-icon { color: var(--ic-primary); }

        .ic-spin { animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ════ TABLE CARD ════ */
        .ic-card {
          background: var(--ic-surface);
          border-radius: var(--ic-radius);
          border: 1px solid var(--ic-border);
          overflow: hidden;
          box-shadow: var(--ic-shadow-md);
          position: relative;
        }

        /* ── CARD HEADER ── */
        .ic-card-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 22px;
          border-bottom: 1px solid var(--ic-border);
          background: linear-gradient(135deg, #fafbff 0%, #f5f3ff 100%);
        }
        .ic-card-header-left { display: flex; align-items: center; gap: 10px; }
        .ic-card-title {
          font-size: .88rem; font-weight: 700; color: var(--ic-primary-deep);
          display: flex; align-items: center; gap: 8px;
        }
        .ic-card-title-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: linear-gradient(135deg, var(--ic-primary), var(--ic-accent));
          box-shadow: 0 0 6px rgba(79,70,229,.5);
        }
        .ic-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 20px;
          font-size: .72rem; font-weight: 600;
        }
        .ic-pill-blue  { background: #eff6ff; color: #1d4ed8; }
        .ic-pill-indigo{ background: #eef2ff; color: var(--ic-primary); }
        .ic-pill-teal  { background: #f0fdfa; color: #0f766e; }

        /* ── SCROLL ARROWS ── */
        .ic-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          z-index: 20; width: 38px; height: 38px; border-radius: 50%;
          background: #fff;
          box-shadow: 0 4px 16px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.05);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--ic-primary); transition: all .25s;
          font-size: .8rem;
        }
        .ic-arrow:hover {
          background: var(--ic-primary); color: #fff;
          transform: translateY(-50%) scale(1.1);
          box-shadow: 0 6px 20px rgba(79,70,229,.4);
        }
        .ic-arrow.left  { left: 12px; }
        .ic-arrow.right { right: 12px; }
        .ic-arrow.hidden { opacity: 0; pointer-events: none; }

        /* ── SCROLL SHADOWS ── */
        .ic-shadow-l, .ic-shadow-r {
          position: absolute; top: 0; bottom: 0; width: 100px;
          z-index: 10; pointer-events: none; transition: opacity .3s;
        }
        .ic-shadow-l { left:  0; background: linear-gradient(to right,  #fff 0%, transparent 100%); }
        .ic-shadow-r { right: 0; background: linear-gradient(to left,   #fff 0%, transparent 100%); }
        .ic-shadow-l.hidden, .ic-shadow-r.hidden { opacity: 0; }

        /* ── SCROLL WRAPPER ── */
        .ic-scroll {
          overflow-x: auto; overflow-y: auto;
          max-height: calc(100vh - 380px);
          scrollbar-width: thin; scrollbar-color: #c7d2fe #f5f3ff;
        }
        .ic-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .ic-scroll::-webkit-scrollbar-track { background: #f5f3ff; }
        .ic-scroll::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 99px; }
        .ic-scroll::-webkit-scrollbar-thumb:hover { background: #a5b4fc; }

        /* ════ TABLE ════ */
        .ic-table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; }

        /* THEAD */
        .ic-thead tr { position: sticky; top: 0; z-index: 15; }
        .ic-th {
          padding: 12px 18px; text-align: left;
          background: linear-gradient(180deg, #f8f7ff 0%, #f0ebff 100%);
          font-size: .71rem; font-weight: 700; color: #4c1d95;
          letter-spacing: .6px; text-transform: uppercase;
          white-space: nowrap;
          border-bottom: 2px solid #ddd6fe;
          border-right: 1px solid #ede9fe;
          user-select: none;
        }
        .ic-th:last-child { border-right: none; }

        /* Sticky TH */
        .ic-th-sticky {
          position: sticky; z-index: 16;
          background: linear-gradient(180deg, #ede9fe 0%, #ddd6fe 100%);
          border-right: 2px solid #c4b5fd !important;
        }
        .ic-th-sticky-0 { left: 0; min-width: 120px; }
        .ic-th-sticky-1 { left: 120px; min-width: 148px; }

        /* TBODY */
        .ic-tr { transition: background .12s; }
        .ic-tr:hover .ic-td         { background: #faf8ff !important; }
        .ic-tr:hover .ic-td-sticky  { background: #f0ebff !important; }
        .ic-tr:nth-child(even) .ic-td { background: #fdfcff; }

        .ic-td {
          padding: 11px 18px; font-size: .82rem; color: #334155;
          white-space: nowrap; background: #fff;
          border-bottom: 1px solid #f1f5f9;
          border-right: 1px solid #f5f3ff;
          max-width: 260px; overflow: hidden; text-overflow: ellipsis;
          transition: background .12s;
        }
        .ic-td:last-child { border-right: none; }

        /* Sticky TD */
        .ic-td-sticky {
          position: sticky; z-index: 10;
          background: #faf8ff; font-weight: 600; color: #1e1b4b;
          border-right: 2px solid #e0d9ff !important;
          transition: background .12s;
        }
        .ic-sticky-0 { left: 0;    min-width: 120px; max-width: 120px; box-shadow: 2px 0 8px rgba(0,0,0,.05); }
        .ic-sticky-1 { left: 120px; min-width: 148px; max-width: 148px; }

        /* codigo cell chip */
        .ic-td-sticky:first-child .ic-codigo {
          display: inline-flex; align-items: center;
          padding: 3px 10px; border-radius: 8px;
          background: linear-gradient(135deg, #ede9fe, #ddd6fe);
          color: #4c1d95; font-weight: 700; font-size: .8rem;
          letter-spacing: .3px;
        }

        /* processo cell */
        .ic-processo {
          color: var(--ic-primary); font-weight: 700; font-size: .82rem;
          letter-spacing: .2px;
        }

        /* ── BADGE ── */
        .ic-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 11px; border-radius: 99px;
          font-size: .74rem; font-weight: 600; letter-spacing: .1px;
          border: 1px solid transparent;
          transition: all .2s;
        }
        .ic-badge-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        /* ── CURRENCY ── */
        .ic-currency { font-weight: 600; color: #065f46; font-size: .82rem; }

        /* ── DATE ── */
        .ic-date { color: #475569; font-size: .81rem; }

        /* ── EMPTY ── */
        .ic-empty { color: #cbd5e1; font-size: .8rem; }

        /* ── SKELETON ── */
        .ic-skeleton-row td { background: #fff !important; }
        .ic-skeleton-pulse {
          display: inline-block; height: 12px; border-radius: 6px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 400% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
        @keyframes shimmer { to { background-position: -400% 0; } }

        /* ── FOOTER ── */
        .ic-footer {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 12px;
          padding: 14px 22px;
          background: linear-gradient(135deg, #fafbff, #f5f3ff);
          border-top: 1px solid #ede9fe;
        }
        .ic-footer-left { display: flex; align-items: center; gap: 10px; font-size: .82rem; color: var(--ic-muted); }
        .ic-count { font-weight: 800; color: var(--ic-primary); font-size: .95rem; }
        .ic-scroll-hint {
          display: flex; align-items: center; gap: 5px;
          color: #94a3b8; font-size: .75rem;
          animation: fadeOut 3s ease forwards 4s;
        }
        @keyframes fadeOut { to { opacity: 0; } }

        /* ── EMPTY STATE ── */
        .ic-empty-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 80px 24px; gap: 14px;
          text-align: center;
        }
        .ic-empty-icon {
          width: 80px; height: 80px; border-radius: 24px;
          background: linear-gradient(135deg, #ede9fe, #ddd6fe);
          display: flex; align-items: center; justify-content: center;
          font-size: 2.2rem; margin-bottom: 6px;
          box-shadow: 0 8px 32px rgba(139,92,246,.2);
        }
        .ic-empty-title { font-size: 1.1rem; font-weight: 800; color: #1e1b4b; }
        .ic-empty-sub   { font-size: .85rem; color: #94a3b8; max-width: 300px; }

        /* ── ERROR ── */
        .ic-error {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 18px; border-radius: 12px;
          background: #fef2f2; border: 1.5px solid #fecaca;
          color: #991b1b; font-size: .84rem; font-weight: 500;
          margin-bottom: 20px;
        }

        /* ── SEARCH HIGHLIGHT ── */
        .ic-search-tag {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 8px;
          background: linear-gradient(135deg, #ede9fe, #ddd6fe);
          color: var(--ic-primary); font-size: .75rem; font-weight: 600;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 768px) {
          .ic-header-top { padding: 14px 16px; }
          .ic-body { padding: 16px; }
          .ic-stats-inner { padding: 10px 16px; gap: 0; }
          .ic-kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .ic-kpi-grid { grid-template-columns: 1fr 1fr; }
          .ic-logo-title { font-size: 1.3rem; }
        }
      `}</style>

      <div className="ic-root">

        {/* ══════════════ HEADER ══════════════ */}
        <header className="ic-header">
          <div className="ic-header-bg-pattern" />

          <div className="ic-header-top">
            {/* Esquerda */}
            <div className="ic-header-left">
              <button className="ic-back-btn" onClick={() => navigate('/home')} title="Voltar">
                <FaArrowLeft />
              </button>
              <div className="ic-logo-wrap">
                <div className="ic-logo-icon">
                  <MdAnchor style={{ color: '#fff', filter: 'drop-shadow(0 0 6px rgba(255,255,255,.4))' }} />
                </div>
                <div className="ic-logo-text">
                  <div className="ic-logo-title">Icompany</div>
                  <div className="ic-logo-sub">
                    <span className="ic-logo-sub-dot" />
                    Base de dados operacional marítima
                  </div>
                </div>
              </div>
            </div>

            {/* Direita */}
            <div className="ic-header-right">
              <button className={`ic-btn ic-btn-ghost`} onClick={handleRefresh}>
                <FaSyncAlt className={refreshing ? 'ic-spin' : ''} style={{ fontSize: '.85rem' }} />
                <span>Atualizar</span>
              </button>
              <button className="ic-btn ic-btn-export" onClick={handleExport}>
                <FaDownload style={{ fontSize: '.85rem' }} />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="ic-stats-strip">
            <div className="ic-stats-inner">
              <div className="ic-stat-item">
                <div className="ic-stat-icon-wrap ic-stat-icon-blue"><FaDatabase /></div>
                <span className="ic-stat-label">Registros</span>
                <span className="ic-stat-value">{data.length.toLocaleString('pt-BR')}</span>
              </div>
              <div className="ic-stat-item">
                <div className="ic-stat-icon-wrap ic-stat-icon-indigo"><FaColumns /></div>
                <span className="ic-stat-label">Colunas</span>
                <span className="ic-stat-value">{COLUMNS.length}</span>
              </div>
              <div className="ic-stat-item">
                <div className="ic-stat-icon-wrap ic-stat-icon-teal"><FaCheckCircle /></div>
                <span className="ic-stat-label">Colunas fixas</span>
                <span className="ic-stat-value">{STICKY_COLS}</span>
              </div>
              {searchTerm && (
                <div className="ic-stat-item">
                  <span className="ic-search-tag">
                    🔍 &ldquo;{searchTerm}&rdquo;
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ══════════════ BODY ══════════════ */}
        <main className="ic-body">

          {/* ── KPI CARDS ── */}
          <div className="ic-kpi-grid">
            {/* Total */}
            <div className="ic-kpi">
              <div className="ic-kpi-accent" style={{ background: 'linear-gradient(90deg,#4f46e5,#7c3aed)' }} />
              <div className="ic-kpi-icon" style={{ background: '#eef2ff' }}>
                <FaDatabase style={{ color: '#4f46e5' }} />
              </div>
              <div className="ic-kpi-value">{loading ? '—' : data.length.toLocaleString('pt-BR')}</div>
              <div className="ic-kpi-label">Total de registros</div>
              <div className="ic-kpi-glow" style={{ background: '#4f46e5' }} />
            </div>

            {/* Agendados */}
            <div className="ic-kpi">
              <div className="ic-kpi-accent" style={{ background: 'linear-gradient(90deg,#3b82f6,#06b6d4)' }} />
              <div className="ic-kpi-icon" style={{ background: '#eff6ff' }}>
                <FaShip style={{ color: '#3b82f6' }} />
              </div>
              <div className="ic-kpi-value">{loading ? '—' : agendados.toLocaleString('pt-BR')}</div>
              <div className="ic-kpi-label">Agendados</div>
              <div className="ic-kpi-glow" style={{ background: '#3b82f6' }} />
            </div>

            {/* Em operação */}
            <div className="ic-kpi">
              <div className="ic-kpi-accent" style={{ background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
              <div className="ic-kpi-icon" style={{ background: '#fffbeb' }}>
                <FaBolt style={{ color: '#f59e0b' }} />
              </div>
              <div className="ic-kpi-value">{loading ? '—' : emExecucao.toLocaleString('pt-BR')}</div>
              <div className="ic-kpi-label">Em operação</div>
              <div className="ic-kpi-glow" style={{ background: '#f59e0b' }} />
            </div>

            {/* Finalizados */}
            <div className="ic-kpi">
              <div className="ic-kpi-accent" style={{ background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
              <div className="ic-kpi-icon" style={{ background: '#f0fdf4' }}>
                <FaCheckCircle style={{ color: '#10b981' }} />
              </div>
              <div className="ic-kpi-value">{loading ? '—' : finalizados.toLocaleString('pt-BR')}</div>
              <div className="ic-kpi-label">Finalizados</div>
              <div className="ic-kpi-glow" style={{ background: '#10b981' }} />
            </div>

            {/* Colunas */}
            <div className="ic-kpi">
              <div className="ic-kpi-accent" style={{ background: 'linear-gradient(90deg,#8b5cf6,#ec4899)' }} />
              <div className="ic-kpi-icon" style={{ background: '#fdf4ff' }}>
                <FaLayerGroup style={{ color: '#8b5cf6' }} />
              </div>
              <div className="ic-kpi-value">{COLUMNS.length}</div>
              <div className="ic-kpi-label">Campos disponíveis</div>
              <div className="ic-kpi-glow" style={{ background: '#8b5cf6' }} />
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="ic-error">
              ⚠️ {error}
              <button
                onClick={fetchAll}
                style={{ marginLeft: 'auto', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 600 }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* ── TOOLBAR ── */}
          <div className="ic-toolbar">
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
                  <FaTimes />
                </button>
              )}
            </div>
            <div className="ic-sep" />
            <button className="ic-icon-btn" onClick={handleRefresh} title="Recarregar dados">
              <FaSyncAlt className={refreshing ? 'ic-spin' : ''} />
            </button>
            <button className="ic-filter-btn">
              <FaFilter className="ic-filter-icon" />
              Filtros
            </button>
          </div>

          {/* ══ TABLE CARD ══ */}
          <div className="ic-card">

            {/* Card header */}
            <div className="ic-card-header">
              <div className="ic-card-header-left">
                <div className="ic-card-title">
                  <div className="ic-card-title-dot" />
                  Dados Operacionais
                </div>
                <span className="ic-pill ic-pill-indigo">
                  <MdTableChart style={{ fontSize: '.75rem' }} />
                  {COLUMNS.length} colunas
                </span>
                {searchTerm && (
                  <span className="ic-pill ic-pill-blue">
                    🔍 &ldquo;{searchTerm}&rdquo; — {data.length} resultado(s)
                  </span>
                )}
              </div>
              <span className="ic-pill ic-pill-teal">
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 5px #10b981' }} />
                {loading ? 'Carregando…' : `${data.length.toLocaleString('pt-BR')} registros`}
              </span>
            </div>

            {/* Sombras */}
            <div className={`ic-shadow-l ${!canScrollL ? 'hidden' : ''}`} />
            <div className={`ic-shadow-r ${!canScrollR ? 'hidden' : ''}`} />

            {/* Setas */}
            <button className={`ic-arrow left ${!canScrollL ? 'hidden' : ''}`} onClick={() => scrollBy(-1)}>
              <FaChevronLeft />
            </button>
            <button className={`ic-arrow right ${!canScrollR ? 'hidden' : ''}`} onClick={() => scrollBy(1)}>
              <FaChevronRight />
            </button>

            {/* Área de scroll */}
            <div className="ic-scroll" ref={scrollRef}>
              {loading ? (
                <table className="ic-table">
                  <thead className="ic-thead">
                    <tr>
                      {COLUMNS.map((col, i) => (
                        <th key={col} className={`ic-th ${i < STICKY_COLS ? `ic-th-sticky ic-th-sticky-${i}` : ''}`}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <SkeletonRow key={i} cols={COLUMNS.length} />
                    ))}
                  </tbody>
                </table>
              ) : data.length === 0 ? (
                <div className="ic-empty-state">
                  <div className="ic-empty-icon">🗂️</div>
                  <p className="ic-empty-title">Nenhum registro encontrado</p>
                  <p className="ic-empty-sub">
                    {searchTerm
                      ? `Nenhum resultado para "${searchTerm}". Tente outro termo.`
                      : 'Nenhum dado disponível no momento.'}
                  </p>
                </div>
              ) : (
                <table className="ic-table">
                  <thead className="ic-thead">
                    <tr>
                      {COLUMNS.map((col, i) => (
                        <th key={col} className={`ic-th ${i < STICKY_COLS ? `ic-th-sticky ic-th-sticky-${i}` : ''}`}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx} className="ic-tr">
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
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer da tabela */}
            {!loading && data.length > 0 && (
              <div className="ic-footer">
                <div className="ic-footer-left">
                  <span>Exibindo</span>
                  <span className="ic-count">{data.length.toLocaleString('pt-BR')}</span>
                  <span>registros</span>
                  <span className="ic-pill ic-pill-indigo">
                    <FaTable style={{ fontSize: '.68rem' }} />
                    {COLUMNS.length} colunas
                  </span>
                  <span className="ic-pill ic-pill-teal">
                    {STICKY_COLS} fixas
                  </span>
                </div>
                <div className="ic-scroll-hint">
                  <FaChevronLeft style={{ fontSize: '.65rem' }} />
                  <FaChevronRight style={{ fontSize: '.65rem' }} />
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

export default Icompany;
