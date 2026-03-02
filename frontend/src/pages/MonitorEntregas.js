import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, THEMES } from '../contexts/ThemeContext';
import { useAuth } from '../services/authContext';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import {
  FaArrowLeft, FaEye, FaDownload, FaSync, FaFilter, FaTimes,
  FaTrash, FaEdit, FaExclamationTriangle, FaShareAlt, FaCalendarAlt,
  FaClock, FaBox, FaTruck, FaCheckCircle, FaTimesCircle, FaFilePdf,
  FaUsers, FaDolly, FaSearch, FaChevronDown, FaChevronRight,
  FaExpand, FaBell, FaMapMarkerAlt, FaPalette
} from 'react-icons/fa';
import { MdLocalShipping, MdDashboard } from 'react-icons/md';
import manaConfig from '../config/cities/manaus.json';
import itajaiConfig from '../config/cities/itajai.json';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/* themes are provided by ThemeContext; imported at top of file */

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS
   ───────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  AGENDADO: {
    label: 'Agendado',
    bg: 'bg-indigo-600',
    light: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-300',
    badge: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
    icon: <FaCalendarAlt />,
    gradient: 'from-indigo-500 to-indigo-700',
    ring: 'ring-indigo-400/30',
    dot: 'bg-indigo-500'
  },
  'CONTAINER MONTADO': {
    label: 'Container Montado',
    bg: 'bg-sky-600',
    light: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-300',
    badge: 'bg-sky-100 text-sky-800 border border-sky-300',
    icon: <FaBox />,
    gradient: 'from-sky-500 to-sky-700',
    ring: 'ring-sky-400/30',
    dot: 'bg-sky-500'
  },
  'A CAMINHO DO CLIENTE': {
    label: 'A Caminho',
    bg: 'bg-amber-500',
    light: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
    badge: 'bg-amber-100 text-amber-800 border border-amber-300',
    icon: <FaTruck />,
    gradient: 'from-amber-400 to-amber-600',
    ring: 'ring-amber-400/30',
    dot: 'bg-amber-500'
  },
  'AGUARDANDO DESOVA': {
    label: 'Aguard. Desova',
    bg: 'bg-orange-500',
    light: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-300',
    badge: 'bg-orange-100 text-orange-800 border border-orange-300',
    icon: <FaExclamationTriangle />,
    gradient: 'from-orange-400 to-orange-600',
    ring: 'ring-orange-400/30',
    dot: 'bg-orange-500'
  },
  'EM DESOVA': {
    label: 'Em Desova',
    bg: 'bg-violet-600',
    light: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-300',
    badge: 'bg-violet-100 text-violet-800 border border-violet-300',
    icon: <FaDolly />,
    gradient: 'from-violet-500 to-violet-700',
    ring: 'ring-violet-400/30',
    dot: 'bg-violet-500'
  },
  'ANEXANDO DOCUMENTOS FINAIS': {
    label: 'Anexando Docs',
    bg: 'bg-pink-600',
    light: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-300',
    badge: 'bg-pink-100 text-pink-800 border border-pink-300',
    icon: <FaFilePdf />,
    gradient: 'from-pink-500 to-pink-700',
    ring: 'ring-pink-400/30',
    dot: 'bg-pink-500'
  },
  ENTREGUE: {
    label: 'Entregue',
    bg: 'bg-emerald-600',
    light: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    icon: <FaCheckCircle />,
    gradient: 'from-emerald-500 to-emerald-700',
    ring: 'ring-emerald-400/30',
    dot: 'bg-emerald-500'
  },
  CANCELADO: {
    label: 'Cancelado',
    bg: 'bg-gray-500',
    light: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-300',
    badge: 'bg-gray-100 text-gray-600 border border-gray-300',
    icon: <FaTimesCircle />,
    gradient: 'from-gray-400 to-gray-600',
    ring: 'ring-gray-400/30',
    dot: 'bg-gray-500'
  }
};

const normalizeKey = (s) => {
  if (!s) return '';
  return s.replace(/_/g, ' ').toUpperCase().trim();
};

const resolveConfig = (rawStatus) => {
  const key = normalizeKey(rawStatus);
  if (key === 'ENTREGUE' || key === 'SUBMITTED' || key === 'ENTREGUE COM PENDENCIA CANHOTO')
    return STATUS_CONFIG['ENTREGUE'];
  if (key === 'PENDING' || key === 'A CAMINHO DO CLIENTE')
    return STATUS_CONFIG['A CAMINHO DO CLIENTE'];
  return STATUS_CONFIG[key] || null;
};

/* ─────────────────────────────────────────────────────────────
   SMALL REUSABLE COMPONENTS
   ───────────────────────────────────────────────────────────── */
const Badge = ({ status }) => {
  const cfg = resolveConfig(status);
  const label = cfg?.label || normalizeKey(status);
  const cls = cfg?.badge || 'bg-gray-100 text-gray-700 border border-gray-300';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${cls}`}>
      {cfg?.icon && <span className="text-[10px]">{cfg.icon}</span>}
      {label}
    </span>
  );
};

const StatCard = ({ label, value, icon, gradient, ring, onClick, pulse }) => (
  <button
    onClick={onClick}
    className={`
      relative overflow-hidden rounded-2xl p-5 flex flex-col items-start justify-between
      bg-gradient-to-br ${gradient}
      shadow-lg hover:shadow-2xl
      ring-2 ${ring}
      hover:-translate-y-1 hover:scale-[1.02]
      transition-all duration-300 ease-out
      text-white w-full group
    `}
  >
    {/* glassmorphism sheen */}
    <span className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
    <span className="absolute -bottom-8 -left-4 w-20 h-20 bg-white/5 rounded-full" />

    <div className="relative flex w-full items-start justify-between">
      <span className="text-[11px] font-bold uppercase tracking-widest text-white/80 leading-tight max-w-[80%]">
        {label}
      </span>
      <span className="text-white/70 text-xl">{icon}</span>
    </div>
    <div className="relative mt-3 flex items-end gap-1">
      <span className={`text-4xl font-black tabular-nums ${pulse ? 'animate-pulse' : ''}`}>{value}</span>
    </div>
  </button>
);

const SectionTitle = ({ children, sub }) => (
  <div className="mb-4">
    <h2 className="text-sm font-extrabold text-gray-400 uppercase tracking-[0.2em]">{children}</h2>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const Pill = ({ active, onClick, children, color = 'purple' }) => {
  const base = 'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 border';
  const on = {
    purple: 'bg-purple-600 text-white border-purple-700 shadow-md shadow-purple-200',
    indigo: 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-200',
    gray:   'bg-gray-800 text-white border-gray-900 shadow-md shadow-gray-200',
    blue:   'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-200',
  };
  const off = 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50';
  return (
    <button className={`${base} ${active ? on[color] : off}`} onClick={onClick}>
      {children}
    </button>
  );
};

/* ─────────────────────────────────────────────────────────────
   PROGRESS DOTS
   ───────────────────────────────────────────────────────────── */
const progressStatuses = [
  'AGENDADO', 'CONTAINER MONTADO', 'A CAMINHO DO CLIENTE',
  'AGUARDANDO DESOVA', 'EM DESOVA', 'ANEXANDO DOCUMENTOS FINAIS', 'ENTREGUE'
];

const getProgress = (delivery) => {
  const key = normalizeKey(delivery.status);
  const norm =
    key === 'ENTREGUE' || key === 'SUBMITTED' || key === 'ENTREGUE COM PENDENCIA CANHOTO'
      ? 'ENTREGUE'
      : key === 'PENDING' || key === 'A CAMINHO DO CLIENTE'
      ? 'A CAMINHO DO CLIENTE'
      : key;
  if (norm === 'CANCELADO' || !norm) return 0;
  const idx = progressStatuses.indexOf(norm);
  if (idx === -1) return 0;
  return Math.round((idx / (progressStatuses.length - 1)) * 100);
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────────── */
const MonitorEntregas = () => {
  const { user } = useAuth();
  const isGeoMar = () => user?.role === 'geomar';
  // only users with "manager" profile should be allowed to modify
  // programações from the control tower modal. admins no longer get the
  // buttons so they can only view.
  const canEdit = () => user?.role === 'manager';

  const [viewingDocument, setViewingDocument] = useState(null);
  const [modalFotos, setModalFotos] = useState(null);
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [editForm, setEditForm] = useState({
    deliveryNumber: '', userName: '', driverName: '', vehiclePlate: '',
    recebedor: '', status: '', dataAgendamento: '', horarioChegada: '',
    horarioInicioDesova: '', horarioFimDesova: '', observations: ''
  });
  const [filters, setFilters] = useState({ status: 'all', searchTerm: '', startDate: '', endDate: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [statsPeriod, setStatsPeriod] = useState('today');
  const [stats, setStats] = useState({ total: 0, statusCounts: {}, byDriver: 0 });
  // theme comes from context so it's globally available
  const { theme, setTheme } = useTheme();
  const themeConfig = THEMES[theme] || THEMES.dark;

  const statusMapToBackend = {
    // 'Operação finalizada' should include any delivery that reached a terminal state
    // final status is now either ENTREGUE or FINALIZADO (we converted legacy pendência
    // records to FINALIZADO during load), so we don't send the old status anymore.
    OPERACAO_FINALIZADA: ['ENTREGUE', 'submitted', 'FINALIZADO'],
    'A CAMINHO DO CLIENTE': ['pending', 'PENDING'],
    AGUARDANDO_DESOVA: ['AGUARDANDO_DESOVA'],
    EM_DESOVA: ['EM_DESOVA'],
    DESOVA_FINALIZADA: ['DESOVA_FINALIZADA'],
    ANEXANDO_DOCUMENTOS_FINAIS: ['ANEXANDO_DOCUMENTOS_FINAIS'],
    AGENDADO: ['AGENDADO'],
    CANCELADO: ['CANCELADO']
  };

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try { await document.documentElement.requestFullscreen(); } catch {}
    } else {
      await document.exitFullscreen();
    }
  };
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault(); toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* helpers */
  const calculateCliTime = (delivery, now = new Date()) => {
    if (!delivery.horarioChegada) return { tempo: null, isActive: false };
    const chegada = new Date(delivery.horarioChegada);
    const isActive = !delivery.horarioFimDesova;
    const ref = isActive ? now : new Date(delivery.horarioFimDesova);
    const diffMs = ref - chegada;
    if (diffMs < 0) return { tempo: null, isActive };
    const totalMin = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    return { tempo: h > 0 ? `${h}h ${m}m` : `${m}m`, isActive };
  };

  const getFlowHistory = (d) => {
    const ev = [];
    if (d.containerMontadoAt) ev.push({ label: 'Montagem do container', date: d.containerMontadoAt });
    if (d.horarioChegada)       ev.push({ label: 'Chegada', date: d.horarioChegada });
    if (d.horarioInicioDesova)  ev.push({ label: 'Início da desova', date: d.horarioInicioDesova });
    if (d.horarioFimDesova)     ev.push({ label: 'Fim da desova', date: d.horarioFimDesova });
    return ev.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const flowHistory = selectedDelivery ? getFlowHistory(selectedDelivery) : [];

  const formatStatus = (s, delivery) => {
    if (!s) return '-';
    // legacy values are treated as finalizados with missing docs
    if (s === 'ENTREGUE_COM_PENDENCIA_CANHOTO') {
      s = 'FINALIZADO';
    }
    if (s === 'FINALIZADO') {
      if (allModalDocsComplete(delivery)) return 'DOCUMENTOS ENTREGUES';
      return 'FINALIZADO';
    }
    if (s === 'ENTREGUE' || s === 'submitted') return 'OPERAÇÃO FINALIZADA';
    if (s === 'pending' || s === 'PENDING') return 'A CAMINHO DO CLIENTE';
    return s.replace(/_/g, ' ');
  };

  const getDocumentsStatus = (delivery) => {
    if (!delivery) return 'PENDENTE';
    const required = ['canhotCTE', 'diarioBordo', 'canhotNF', 'devolucaoVazio'];
    const docs = delivery.documents || {};
    if (required.every(k => docs[k])) return 'COMPLETO';
    const pending = required.filter(k => !docs[k]).map(k =>
      ({ canhotCTE: 'CTE', canhotNF: 'NF', diarioBordo: 'DIÁRIO', devolucaoVazio: 'RIC' }[k] || k)
    ).join(' + ');
    return `PENDENTE ${pending}`;
  };

  const defaultDocumentLabels = manaConfig.documents || {
    canhotNF: 'NF', canhotCTE: 'CTE', diarioBordo: 'Diário', devolucaoVazio: 'Vazio', retiradaCheio: 'Cheio'
  };

  const getLabelsForDelivery = (d) => {
    if (!d) return defaultDocumentLabels;
    return (d.city || '').toLowerCase() === 'itajai' ? itajaiConfig.documents || {} : defaultDocumentLabels;
  };

  const getDocumentUrlsArray = (docData) => {
    if (!docData) return [];
    if (typeof docData === 'string') return [docData];
    if (Array.isArray(docData)) return docData.map(i => {
      if (typeof i === 'string') return i;
      if (typeof i === 'object' && i) return i.url || (i.path && `/uploads/${i.path}`) || i.link || i.webViewLink || null;
      return null;
    }).filter(Boolean);
    if (typeof docData === 'object') return [docData.url || (docData.path && `/uploads/${docData.path}`) || docData.link || docData.webViewLink].filter(Boolean);
    return [];
  };

  // verifica se todos os documentos/fotos do modal foram anexados
  const allModalDocsComplete = (d) => {
    if (!d) return false;
    const keys = ['retiradaCheio','canhotCTE','diarioBordo','canhotNF','devolucaoVazio','chegadaCliente','inicioDesova','fimDesova'];
    return keys.every(k => getDocumentUrlsArray(d.documents?.[k]).length > 0);
  };

  // Progress indicator component with document completion check
  const ProgressDots = ({ delivery }) => {
    let p = getProgress(delivery);
    // override for finalizado / docs delivered
    if (normalizeKey(delivery.status) === 'FINALIZADO') {
      if (allModalDocsComplete(delivery)) p = 100;
      else p = 90;
    }
    const total = 7;
    const filled = Math.ceil((p / 100) * total);
    const colorDot =
      p === 100 ? 'bg-emerald-500 shadow-sm shadow-emerald-400' :
      p >= 66   ? 'bg-amber-400 shadow-sm shadow-amber-300' :
      p >= 33   ? 'bg-indigo-500 shadow-sm shadow-indigo-300' :
                  'bg-gray-300';
    return (
      <div className="flex items-center gap-1" title={`${p}%`}>
        <span className="text-[10px] font-bold text-gray-500 w-6 text-right">{p}%</span>
        <div className="flex gap-[3px]">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`block w-2.5 h-2.5 rounded-full transition-all ${
                i < filled
                  ? `${colorDot} ${p < 100 && i === filled - 1 ? 'animate-pulse' : ''}`
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  const removeProgramacaoInfo = (obs) => obs ? obs.replace(/Criada a partir da Programação [A-Z0-9]+/g, '').trim() : '';

  /* ── Data loading ── */
  const loadDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      let backendFilters = { ...filters };
      if (filters.status && filters.status !== 'all') {
        const bs = statusMapToBackend[filters.status];
        if (bs) backendFilters.status = bs[0];
      }
      let periodDate = '';
      if (statsPeriod && statsPeriod !== 'general') {
        const today = new Date(); today.setHours(0,0,0,0);
        if (statsPeriod === 'yesterday') today.setDate(today.getDate() - 1);
        if (statsPeriod === 'tomorrow')  today.setDate(today.getDate() + 1);
        periodDate = today.toLocaleDateString('pt-BR');
      }
      const response = await adminService.getDeliveries(backendFilters, statsPeriod, periodDate);
      const data = response.data.deliveries || [];
      // Normalize legacy pendência status so it never surfaces separately in the UI
      const normalized = data.map(d => {
        if (d.status === 'ENTREGUE_COM_PENDENCIA_CANHOTO') d.status = 'FINALIZADO';
        return d;
      });
      setDeliveries(normalized);
      const sc = {};
      normalized.forEach(d => { const s = normalizeKey(d.status) || 'UNKNOWN'; sc[s] = (sc[s] || 0) + 1; });
      const drivers = new Set(normalized.map(d => d.driverName).filter(Boolean));
      setStats({ total: normalized.length, statusCounts: sc, byDriver: drivers.size });
      setToast({ message: `${data.length} entregas carregadas`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast({ message: 'Erro ao carregar entregas', type: 'error' });
    } finally { setLoading(false); }
  }, [filters, statsPeriod]);

  useEffect(() => {
    loadDeliveries();
    if (autoRefresh) {
      const t = setInterval(loadDeliveries, refreshInterval * 1000);
      return () => clearInterval(t);
    }
  }, [loadDeliveries, autoRefresh, refreshInterval]);

  useEffect(() => {
    let r = [...deliveries];
    if (sortBy) {
      r.sort((a, b) => {
        if (sortBy === 'createdAt') {
          const diff = new Date(a[sortBy]) - new Date(b[sortBy]);
          return sortDir === 'asc' ? diff : -diff;
        }
        const sa = String(a[sortBy] || '').toLowerCase();
        const sb = String(b[sortBy] || '').toLowerCase();
        return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }
    if (statsPeriod === 'general' && filters.status !== 'all') {
      r = r.filter(d => {
        if (filters.status === 'OPERACAO_FINALIZADA') return d.status === 'ENTREGUE' || d.status === 'submitted' || d.status === 'FINALIZADO';
        if (filters.status === 'A CAMINHO DO CLIENTE') return d.status === 'pending' || d.status === 'PENDING';
        if (filters.status === 'DOCUMENTOS_ENTREGUES') return d.status === 'FINALIZADO' && allModalDocsComplete(d);
        if (filters.status === 'FINALIZADO') return d.status === 'FINALIZADO' && !allModalDocsComplete(d);
        return d.status === filters.status;
      });
    }
    if (filters.searchTerm.trim()) {
      const q = filters.searchTerm.toLowerCase();
      r = r.filter(d =>
        [d.deliveryNumber, d.driverName, d.userName, d.recebedor, d.vehiclePlate]
          .some(v => (v || '').toLowerCase().includes(q))
      );
    }
    if (filters.startDate) {
      const sd = new Date(filters.startDate); sd.setHours(0,0,0,0);
      r = r.filter(d => d.dataAgendamento && new Date(d.dataAgendamento) >= sd);
    }
    if (filters.endDate) {
      const ed = new Date(filters.endDate); ed.setHours(23,59,59,999);
      r = r.filter(d => d.dataAgendamento && new Date(d.dataAgendamento) <= ed);
    }
    setFilteredDeliveries(r);
  }, [deliveries, filters, sortBy, sortDir, statsPeriod]);

  /* ── Actions ── */
  const handleDownload = async (id, type) => {
    try {
      // if delivery already contains direct URLs for this document, download them directly
      const delivery = deliveries.find(d => d._id === id);
      const docEntry = delivery?.documents?.[type];
      if (docEntry) {
        // docEntry can be a single URL or array of URLs or an object with urls
        if (typeof docEntry === 'string' && docEntry.startsWith('http')) {
          const a = document.createElement('a'); a.href = docEntry;
          a.setAttribute('download', `${delivery.deliveryNumber||'doc'}_${type}`);
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setToast({ message: 'Documento baixado', type: 'success' });
          return;
        }
        if (Array.isArray(docEntry)) {
          docEntry.forEach((url, i) => {
            const a = document.createElement('a'); a.href = url;
            a.setAttribute('download', `${delivery.deliveryNumber||'doc'}_${type}_${i+1}`);
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
          });
          setToast({ message: 'Documento(s) baixado(s)', type: 'success' });
          return;
        }
        // If docEntry is an object with urls array
        if (docEntry.urls && Array.isArray(docEntry.urls)) {
          docEntry.urls.forEach((url, i) => {
            const a = document.createElement('a'); a.href = url;
            a.setAttribute('download', `${delivery.deliveryNumber||'doc'}_${type}_${i+1}`);
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
          });
          setToast({ message: 'Documento(s) baixado(s)', type: 'success' });
          return;
        }
      }

      const res = await adminService.downloadDocument(id, type);
      const contentType = res.headers?.['content-type'] || res.headers?.['Content-Type'] || '';
      const ext = contentType.includes('pdf') ? 'pdf' : (contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : (contentType.includes('png') ? 'png' : 'bin'));
      const blob = new Blob([res.data], { type: contentType || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.setAttribute('download', `${deliveries.find(d=>d._id===id)?.deliveryNumber||'doc'}_${type}.${ext}`);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setToast({ message: 'Documento baixado', type: 'success' });
    } catch (e) {
      setToast({ message: 'Erro ao baixar: ' + (e.response?.data?.message || e.message), type: 'error' });
    }
  };

  const handleDownloadAll = async (id) => {
    try {
      const res = await adminService.downloadAllDocuments(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a'); a.href = url;
      a.setAttribute('download', `${deliveries.find(d=>d._id===id)?.deliveryNumber||'documents'}.zip`);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setToast({ message: 'ZIP baixado', type: 'success' });
    } catch (e) { setToast({ message: 'Erro ao baixar ZIP: ' + (e.response?.data?.message || e.message), type: 'error' }); }
  };

  const handleShareDelivery = async () => {
    if (!selectedDelivery) return;
    try {
      const doc = new jsPDF({ unit: 'pt' });
      const loadImage = (url) => new Promise(resolve => {
        const img = new Image(); img.crossOrigin = 'Anonymous';
        img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img,0,0); resolve(c.toDataURL('image/png')); };
        img.onerror = () => resolve(null); img.src = url;
      });
      const logo = await loadImage('/images/geotransporteslogo.png');
      if (logo) {
        const ip = doc.getImageProperties(logo); const w=100, h=(ip.height*w)/ip.width;
        doc.addImage(logo,'PNG',(doc.internal.pageSize.getWidth()-w)/2,20,w,h);
      }
      doc.setFontSize(16);
      doc.text('Detalhes da Entrega', doc.internal.pageSize.getWidth()/2, 60, { align: 'center' });
      const rows = [];
      const add = (l,v) => rows.push([l, v||'-']);
      add('Número', selectedDelivery.deliveryNumber);
      add('Contratado', selectedDelivery.userName);
      add('Motorista', selectedDelivery.driverName);
      add('Placa', selectedDelivery.vehiclePlate);
      add('Status', formatStatus(selectedDelivery.status, selectedDelivery));
      add('Agendamento', selectedDelivery.dataAgendamento ? new Date(selectedDelivery.dataAgendamento).toLocaleString('pt-BR') : '-');
      add('Chegada', selectedDelivery.horarioChegada ? new Date(selectedDelivery.horarioChegada).toLocaleString('pt-BR') : '-');
      add('Início desova', selectedDelivery.horarioInicioDesova ? new Date(selectedDelivery.horarioInicioDesova).toLocaleString('pt-BR') : '-');
      add('Fim desova', selectedDelivery.horarioFimDesova ? new Date(selectedDelivery.horarioFimDesova).toLocaleString('pt-BR') : '-');
      getFlowHistory(selectedDelivery).forEach(ev => add(ev.label, new Date(ev.date).toLocaleString('pt-BR')));
      if (selectedDelivery.observations) add('Observações', selectedDelivery.observations);
      doc.autoTable({ startY: logo ? 100 : 80, head: [['Campo','Valor']], body: rows, styles:{fontSize:10}, headStyles:{fillColor:[88,28,135]} });
      doc.save(`Entrega_${selectedDelivery.deliveryNumber}.pdf`);
      setToast({ type:'success', message:'PDF gerado' });
    } catch (err) { setToast({ type:'error', message:'Falha ao gerar PDF: '+err.message }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deletar esta entrega? Ação irreversível.')) return;
    try {
      await adminService.deleteDelivery(id);
      setToast({ message: 'Entrega deletada', type: 'success' });
      setSelectedDelivery(null); loadDeliveries();
    } catch { setToast({ message: 'Erro ao deletar', type: 'error' }); }
  };

  const handleEditStart = (d) => {
    if (isGeoMar()) { setToast({ type:'error', message:'Modo Visualização: sem permissão de edição' }); return; }
    setEditingDelivery(d._id);
    setEditForm({
      deliveryNumber: d.deliveryNumber||'', userName: d.userName||'',
      driverName: d.driverName||'', vehiclePlate: d.vehiclePlate||'',
      recebedor: d.recebedor||'', status: d.status||'',
      dataAgendamento: d.dataAgendamento?.slice(0,16)||'',
      horarioChegada: d.horarioChegada?.slice(0,16)||'',
      horarioInicioDesova: d.horarioInicioDesova?.slice(0,16)||'',
      horarioFimDesova: d.horarioFimDesova?.slice(0,16)||'',
      observations: removeProgramacaoInfo(d.observations)
    });
  };

  const handleEditSave = async () => {
    if (!editForm.observations?.trim()) { setToast({ message:'Motivo da edição obrigatório', type:'error' }); return; }
    const motivo = editForm.observations.replace(/Criada a partir da Programação [A-Z0-9]+/g,'').trim();
    const prog = (editForm.observations.match(/Criada a partir da Programação [A-Z0-9]+/)||[]).join(' ');
    const payload = {
      ...editForm,
      observations: prog ? `${motivo}\n${prog}` : motivo,
      editedBy: user?.name || user?.username || user?.email || 'Desconhecido',
      editedAt: new Date().toISOString()
    };
    try {
      await adminService.updateDelivery(editingDelivery, payload);
      setToast({ message:'Entrega atualizada', type:'success' });
      setEditingDelivery(null); loadDeliveries();
    } catch { setToast({ message:'Erro ao atualizar', type:'error' }); }
  };

  /* ─────────── stat cards order ─────────── */
  const CARD_ORDER = [
    'AGENDADO','CONTAINER MONTADO','A CAMINHO DO CLIENTE',
    'AGUARDANDO DESOVA','EM DESOVA','ANEXANDO DOCUMENTOS FINAIS',
    'ENTREGUE','CANCELADO'
  ];

  const sortedStatusEntries = Object.entries(stats.statusCounts).sort(([a],[b]) => {
    const ia = CARD_ORDER.indexOf(a), ib = CARD_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1; if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  /* ────────────────────────────────────────
     RENDER
     ──────────────────────────────────────── */
  // inject light-theme overrides for better text visibility
  React.useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.id = 'theme-overrides';
    styleEl.textContent = `
      .theme-light {
        background-color: #eef2f6 !important;
        color: #1a1a1a !important;
      }
      .theme-light .text-white { color: #1a1a1a !important; }
      .theme-light .text-white\/20 { color: rgba(26,26,26,0.5) !important; }
      .theme-light .text-white\/40 { color: rgba(26,26,26,0.7) !important; }
      .theme-light .text-gray-300 { color: #4b5563 !important; }
      .theme-light .text-gray-400 { color: #6b7280 !important; }
      .theme-light .text-gray-500 { color: #9ca3af !important; }
      .theme-light .text-gray-600 { color: #9ca3af !important; }
      .theme-light .text-purple-400 { color: #a855f7 !important; }
      .theme-light .text-emerald-400 { color: #10b981 !important; }
      .theme-light .bg-white\/5 { background-color: rgba(255,255,255,0.3) !important; }
      .theme-light .bg-white\/10 { background-color: rgba(255,255,255,0.4) !important; }
      .theme-light .bg-white\/60 { background-color: rgba(255,255,255,0.8) !important; }
      .theme-light .bg-purple-600\/80 { background-color: rgba(147,51,234,0.6) !important; }
      .theme-light .border-white\/10 { border-color: rgba(26,26,26,0.1) !important; }
      .theme-light .placeholder-gray-500::placeholder { color: #9ca3af !important; }
      .theme-light select {
        background-color: #f3f4f6 !important;
        color: #1a1a1a !important;
      }
      .theme-light input {
        background-color: #f3f4f6 !important;
        color: #1a1a1a !important;
      }
    `;
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

  return (
    <div
      style={{ backgroundColor: themeConfig.bg, color: themeConfig.text }}
      className={`min-h-screen font-sans transition-colors duration-300 ${theme === 'light' ? 'theme-light' : ''}`}
    >
      {/* Header com Seletor de Tema */}
      <header className={`sticky top-0 z-40 ${themeConfig.header} backdrop-blur-md border-b ${themeConfig.border}`}>
        <div className="w-full px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white transition"
          >
            <FaArrowLeft className="text-purple-400" />
            <span className="hidden sm:inline">Voltar</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
              <MdDashboard className="text-white text-base" />
            </div>
            <h1 className="text-base sm:text-lg font-black tracking-[0.15em] uppercase" style={{ color: themeConfig.text }}>
              Torre de Controle
            </h1>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Theme Selector */}
            <div className="hidden sm:flex items-center gap-1 rounded-xl p-1 border" style={{ backgroundColor: `${themeConfig.bgSecondary}33`, borderColor: themeConfig.border }}>
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  title={t.name}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    theme === key
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'hover:bg-white/10'
                  }`}
                  style={{ color: theme === key ? '#fff' : themeConfig.text }}
                >
                  {t.name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Mobile Theme Menu */}
            <div className="sm:hidden relative group">
              <button className="w-9 h-9 rounded-xl flex items-center justify-center transition" style={{ backgroundColor: `${themeConfig.card}` }}>
                <FaPalette size={14} />
              </button>
              <div className="absolute right-0 mt-2 w-44 rounded-lg shadow-2xl hidden group-hover:block z-50" style={{ backgroundColor: themeConfig.bgSecondary, borderColor: themeConfig.border, border: '1px solid' }}>
                {Object.entries(THEMES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-all transition-all ${
                      theme === key ? 'bg-purple-600 text-white' : 'hover:bg-white/5'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {autoRefresh && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
            <button
              onClick={() => toggleFullscreen()}
              title="Fullscreen (Ctrl+Shift+F)"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition" style={{ backgroundColor: `${themeConfig.card}` }}
            >
              <FaExpand size={14} />
            </button>
            <button
              onClick={loadDeliveries}
              disabled={loading}
              title="Atualizar"
              className="w-9 h-9 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white flex items-center justify-center transition disabled:opacity-40"
            >
              <FaSync size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width */}
      <main className="w-full px-4 lg:px-8 py-8 space-y-8">

        {/* ── PERIOD SELECTOR ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <Pill active={statsPeriod==='general'} onClick={()=>setStatsPeriod('general')} color="indigo">
            <MdDashboard /> Geral
          </Pill>
          <Pill active={statsPeriod==='yesterday'} onClick={()=>setStatsPeriod('yesterday')} color="gray">
            <FaCalendarAlt /> Ontem
          </Pill>
          <Pill active={statsPeriod==='today'} onClick={()=>setStatsPeriod('today')} color="purple">
            <FaClock /> Hoje
          </Pill>
          <Pill active={statsPeriod==='tomorrow'} onClick={()=>setStatsPeriod('tomorrow')} color="blue">
            <FaCalendarAlt /> Amanhã
          </Pill>

          {/* auto-refresh controls inline */}
          <div className="ml-auto flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/10">
            <label className="flex items-center gap-2 text-sm text-gray-300 font-semibold cursor-pointer select-none">
              <span className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${autoRefresh ? 'bg-purple-600' : 'bg-gray-600'}`}
                onClick={() => setAutoRefresh(v => !v)}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${autoRefresh ? 'translate-x-5' : ''}`} />
              </span>
              Auto-refresh
            </label>
            {autoRefresh && (
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <input
                  type="number" min="5" max="300" step="5"
                  value={refreshInterval}
                  onChange={e => setRefreshInterval(Number(e.target.value))}
                  className="w-14 px-2 py-0.5 bg-white/10 border border-white/10 rounded-lg text-white text-center focus:outline-none"
                />
                <span>seg</span>
              </div>
            )}
          </div>
        </div>

        {/* ── STATS CARDS ── */}
        <div>
          <SectionTitle sub={`${stats.total} programações encontradas`}>Resumo Operacional</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-10 gap-3">

            {/* TOTAL */}
            <StatCard
              label="Programadas"
              value={stats.total}
              icon={<FaCalendarAlt />}
              gradient="from-purple-600 to-indigo-700"
              ring="ring-purple-500/30"
              pulse={loading}
            />

            {/* STATUS CARDS */}
            {sortedStatusEntries.map(([status, count]) => {
              const cfg = STATUS_CONFIG[status] || null;
              return (
                <StatCard
                  key={status}
                  label={cfg?.label || status.replace(/_/g,' ')}
                  value={count}
                  icon={cfg?.icon || <FaBox />}
                  gradient={cfg?.gradient || 'from-gray-500 to-gray-700'}
                  ring={cfg?.ring || 'ring-gray-400/30'}
                />
              );
            })}

            {/* MOTORISTAS */}
            <StatCard
              label="Motoristas"
              value={stats.byDriver}
              icon={<FaUsers />}
              gradient="from-teal-500 to-cyan-700"
              ring="ring-teal-400/30"
            />
          </div>
        </div>

        {/* ── FILTERS ── */}
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setShowFilters(v => !v)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <FaFilter className="text-purple-400 text-sm" />
              </span>
              <span className="font-bold text-sm uppercase tracking-widest text-gray-300">Filtros</span>
              {(filters.status !== 'all' || filters.searchTerm || filters.startDate || filters.endDate) && (
                <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-xs font-bold">Ativo</span>
              )}
            </div>
            {showFilters ? <FaChevronDown className="text-gray-400" /> : <FaChevronRight className="text-gray-400" />}
          </button>

          {showFilters && (
            <div className="border-t border-white/10 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={e => setFilters({...filters, status: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all" className="bg-gray-900">Todos</option>
                  <option value="OPERACAO_FINALIZADA" className="bg-gray-900">Operação Finalizada</option>
                  <option value="DOCUMENTOS_ENTREGUES" className="bg-gray-900">Documentos Entregues</option>
                  <option value="FINALIZADO" className="bg-gray-900">Finalizado (sem docs)</option>
                  <option value="A CAMINHO DO CLIENTE" className="bg-gray-900">A Caminho do Cliente</option>
                  <option value="AGENDADO" className="bg-gray-900">Agendado</option>
                  <option value="AGUARDANDO_DESOVA" className="bg-gray-900">Aguardando Desova</option>
                  <option value="EM_DESOVA" className="bg-gray-900">Em Desova</option>
                  <option value="DESOVA_FINALIZADA" className="bg-gray-900">Desova Finalizada</option>
                  <option value="ANEXANDO_DOCUMENTOS_FINAIS" className="bg-gray-900">Anexando Docs Finais</option>
                  <option value="CANCELADO" className="bg-gray-900">Cancelado</option>
                </select>
              </div>
              {/* Search */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Buscar</label>
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
                  <input
                    type="text"
                    placeholder="Número, motorista, placa…"
                    value={filters.searchTerm}
                    onChange={e => setFilters({...filters, searchTerm: e.target.value})}
                    className="w-full pl-8 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              {/* Start date */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Data Inicial</label>
                <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              {/* End date */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Data Final</label>
                <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              {/* Clear filters */}
              {(filters.status !== 'all' || filters.searchTerm || filters.startDate || filters.endDate) && (
                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <button
                    onClick={() => setFilters({ status:'all', searchTerm:'', startDate:'', endDate:'' })}
                    className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 font-semibold transition"
                  >
                    <FaTimes /> Limpar filtros
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── TABLE ── */}
        {filteredDeliveries.length === 0 ? (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-16 text-center">
            <MdLocalShipping className="mx-auto text-5xl text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg font-semibold">Nenhuma entrega encontrada</p>
            <p className="text-gray-600 text-sm mt-1">Tente ajustar os filtros ou período selecionado</p>
          </div>
        ) : (
          <div>
            <SectionTitle sub={`${filteredDeliveries.length} resultado(s)`}>Entregas</SectionTitle>
            <div className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-gray-400 uppercase tracking-wider">
                      {[
                        ['Nº','deliveryNumber'],['Contratado','userName'],['Motorista','driverName'],
                        ['Recebedor','recebedor'],['Status',null],['Progresso',null],
                        ['DT Retirada','containerMontadoAt'],['Agendamento','dataAgendamento'],
                        ['Chegada','horarioChegada'],['Início','horarioInicioDesova'],
                        ['Fim','horarioFimDesova']
                      ].map(([col, field]) => (
                        <th
                          key={col}
                          className={`px-3 py-3.5 text-left font-bold whitespace-nowrap ${field ? 'cursor-pointer hover:text-white transition' : ''}`}
                          onClick={() => {
                            if (!field) return;
                            if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                            else { setSortBy(field); setSortDir('asc'); }
                          }}
                        >
                          <span className="flex items-center gap-1">
                            {col}
                            {sortBy === field && <span className="text-purple-400">{sortDir==='asc'?'↑':'↓'}</span>}
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-3.5 text-center font-bold whitespace-nowrap bg-amber-900/20 text-amber-400">
                        ⏱ Tempo
                      </th>
                      <th className="px-3 py-3.5 text-center font-bold whitespace-nowrap">Docs</th>
                      <th className="px-3 py-3.5 text-center font-bold whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredDeliveries.map((d, i) => {
                      const cliTime = calculateCliTime(d, currentTime);
                      const docStatus = getDocumentsStatus(d);
                      const isComplete = docStatus.includes('COMPLETO');
                      const cfg = resolveConfig(d.status);
                      return (
                        <tr
                          key={d._id}
                          className={`transition-colors hover:bg-white/5 ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}`}
                        >
                          <td className="px-3 py-3 font-bold text-purple-300 whitespace-nowrap">{d.deliveryNumber}</td>
                          <td className="px-3 py-3 text-gray-300 max-w-[120px] truncate" title={d.userName}>{d.userName}</td>
                          <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{d.driverName || '—'}</td>
                          <td className="px-3 py-3 text-gray-400">{d.recebedor || '—'}</td>
                          <td className="px-3 py-3">
                            {(() => {
                              const disp = d.status === 'FINALIZADO' && allModalDocsComplete(d) ? 'DOCUMENTOS ENTREGUES' : d.status;
                              return <Badge status={disp} />;
                            })()}
                          </td>
                          <td className="px-3 py-3"><ProgressDots delivery={d} /></td>
                          {/* DT Retirada */}
                          <td className="px-3 py-3 text-sky-400 whitespace-nowrap text-center font-semibold">
                            {d.containerMontadoAt ? new Date(d.containerMontadoAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'}
                          </td>
                          <td className="px-3 py-3 text-gray-400 whitespace-nowrap text-center">
                            {d.dataAgendamento ? new Date(d.dataAgendamento).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'}
                          </td>
                          <td className="px-3 py-3 text-gray-300 whitespace-nowrap text-center">
                            {d.horarioChegada ? new Date(d.horarioChegada).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'}
                          </td>
                          <td className="px-3 py-3 text-gray-400 whitespace-nowrap text-center">
                            {d.horarioInicioDesova ? new Date(d.horarioInicioDesova).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'}
                          </td>
                          <td className="px-3 py-3 text-gray-400 whitespace-nowrap text-center">
                            {d.horarioFimDesova ? new Date(d.horarioFimDesova).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'}
                          </td>
                          {/* Tempo CLI */}
                          <td className="px-3 py-3 text-center bg-amber-900/10">
                            {cliTime.tempo ? (
                              <span className={`font-bold tabular-nums ${cliTime.isActive ? 'text-amber-400' : 'text-amber-600'}`}>
                                {cliTime.tempo}
                                {cliTime.isActive && <span className="ml-1 animate-pulse">⏱</span>}
                              </span>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                          {/* Docs */}
                          <td className="px-3 py-3 text-center">
                            {isComplete ? (
                              <FaCheckCircle className="text-emerald-400" title={docStatus} size={18} />
                            ) : (
                              <FaTimesCircle className="text-red-400" title={docStatus} size={18} />
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedDelivery(d)}
                                title="Visualizar"
                                className="w-7 h-7 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 hover:text-purple-200 flex items-center justify-center transition"
                              >
                                <FaEye size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── TOAST ── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ═══════════════════════════════════════
          MODAL: DETALHES DA ENTREGA
          ═══════════════════════════════════════ */}
      {selectedDelivery && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-white/10 flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-purple-700/60 to-indigo-700/60 border-b border-white/10 flex-shrink-0">
              <div>
                <p className="text-xs text-purple-300 uppercase tracking-widest font-semibold mb-0.5">Entrega</p>
                <h2 className="text-xl font-black text-white tracking-wide">
                  #{selectedDelivery.deliveryNumber}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <Badge status={(selectedDelivery.status === 'FINALIZADO' && allModalDocsComplete(selectedDelivery)) ? 'DOCUMENTOS ENTREGUES' : selectedDelivery.status} />
                <button
                  onClick={() => setSelectedDelivery(null)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Contratado', selectedDelivery.userName],
                  ['Motorista', selectedDelivery.driverName || '—'],
                  ['Placa', selectedDelivery.vehiclePlate || '—'],
                  ['Recebedor', selectedDelivery.recebedor || '—'],
                  ['Agendamento', selectedDelivery.dataAgendamento ? new Date(selectedDelivery.dataAgendamento).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'],
                  ['Montagem Container', selectedDelivery.containerMontadoAt ? new Date(selectedDelivery.containerMontadoAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'],
                  ['Chegada', selectedDelivery.horarioChegada ? new Date(selectedDelivery.horarioChegada).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'],
                  ['Início Desova', selectedDelivery.horarioInicioDesova ? new Date(selectedDelivery.horarioInicioDesova).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'],
                  ['Fim Desova', selectedDelivery.horarioFimDesova ? new Date(selectedDelivery.horarioFimDesova).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-0.5">{label}</p>
                    <p className="text-sm text-gray-100 font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar visual */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Progresso da Entrega</p>
                <div className="flex items-center gap-1.5">
                  {progressStatuses.map((s, i) => {
                    let p = getProgress(selectedDelivery);
                    if (normalizeKey(selectedDelivery.status) === 'FINALIZADO') {
                      if (allModalDocsComplete(selectedDelivery)) p = 100;
                      else p = 90;
                    }
                    const filled = Math.ceil((p / 100) * progressStatuses.length);
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <React.Fragment key={s}>
                        <div className={`flex flex-col items-center gap-1 flex-1 ${i <= filled - 1 ? '' : 'opacity-30'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] ${i <= filled - 1 ? (cfg?.bg || 'bg-purple-600') : 'bg-gray-700'} transition-all`}>
                            {cfg?.icon}
                          </div>
                          <p className="text-[7px] text-center text-gray-500 leading-tight hidden sm:block">{cfg?.label || s}</p>
                        </div>
                        {i < progressStatuses.length - 1 && (
                          <div className={`h-0.5 flex-1 rounded-full transition-colors ${i < filled - 1 ? 'bg-purple-500' : 'bg-gray-700'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Flow history */}
              {flowHistory.length > 0 && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">📍 Histórico do Fluxo</p>
                  <div className="space-y-2">
                    {flowHistory.map((ev, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                        <span className="text-sm text-gray-200 flex-1">{ev.label}</span>
                        <span className="text-xs text-gray-500 font-mono">{new Date(ev.date).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observations */}
              {(selectedDelivery.observations || selectedDelivery.observacoes || selectedDelivery.documentsJustification || selectedDelivery.submissionObservation) && (
                <div className="space-y-3">
                  {(selectedDelivery.observations || selectedDelivery.observacoes) && (
                    <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-4">
                      <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold mb-2">📝 Observações</p>
                      {selectedDelivery.observations && <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedDelivery.observations}</p>}
                      {selectedDelivery.observacoes && <p className="text-sm text-gray-300 whitespace-pre-wrap mt-1">{selectedDelivery.observacoes}</p>}
                    </div>
                  )}
                  {selectedDelivery.documentsJustification && (
                    <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl p-4">
                      <p className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-2">⚠️ Justificativa de Documentos</p>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedDelivery.documentsJustification}</p>
                    </div>
                  )}
                  {selectedDelivery.submissionObservation && (
                    <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-4">
                      <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold mb-2">ℹ️ Observação de Submissão</p>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedDelivery.submissionObservation}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Documents */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Documentos e Fotos</p>
                  <div className="flex gap-2">
                    <button onClick={handleShareDelivery}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 hover:text-emerald-200 text-xs font-semibold rounded-lg transition border border-emerald-500/20">
                      <FaShareAlt /> Compartilhar
                    </button>
                    <button onClick={() => handleDownloadAll(selectedDelivery._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-200 text-xs font-semibold rounded-lg transition border border-blue-500/20">
                      <FaDownload /> Baixar Tudo
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const labels = getLabelsForDelivery(selectedDelivery);
                    const docRows = Object.keys(selectedDelivery.documents || {})
                      .filter(k => !['chegadaCliente','inicioDesova','fimDesova'].includes(k))
                      .map(k => {
                        const present = !!selectedDelivery.documents[k];
                        return (
                          <div key={k} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${present ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-50'}`}>
                            <div className="flex items-center gap-3">
                              <span className={`w-2 h-2 rounded-full ${present ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                              <span className="text-sm text-gray-300 font-semibold">{labels[k] || k}</span>
                              {!present && <span className="text-xs text-gray-600">Não anexado</span>}
                            </div>
                            {present && (
                              <div className="flex gap-2">
                                <button onClick={() => setViewingDocument({ label: labels[k]||k, urls: getDocumentUrlsArray(selectedDelivery.documents[k]) })}
                                  className="w-7 h-7 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 flex items-center justify-center transition">
                                  <FaEye size={11} />
                                </button>
                                <button onClick={() => handleDownload(selectedDelivery._id, k)}
                                  className="w-7 h-7 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 flex items-center justify-center transition">
                                  <FaDownload size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      });

                    const fotoFields = [
                      { key:'chegadaCliente', label:'Chegada no Cliente' },
                      { key:'inicioDesova',   label:'Início da Desova' },
                      { key:'fimDesova',      label:'Finalização da Desova' }
                    ];
                    const fotosRows = fotoFields.map(f => {
                      const files = getDocumentUrlsArray(selectedDelivery.documents?.[f.key]);
                      const present = files.length > 0;
                      return (
                        <div key={f.key} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${present ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-50'}`}>
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${present ? 'bg-sky-400' : 'bg-gray-600'}`} />
                            <span className="text-sm text-gray-300 font-semibold">{f.label}</span>
                            {present && <span className="text-xs text-gray-500">{files.length} foto(s)</span>}
                            {!present && <span className="text-xs text-gray-600">Não anexado</span>}
                          </div>
                          {present && (
                            <div className="flex gap-2">
                              <button onClick={() => setModalFotos({ label:f.label, files })}
                                className="w-7 h-7 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 flex items-center justify-center transition">
                                <FaEye size={11} />
                              </button>
                              <button onClick={() => files.forEach((url,i) => {
                                const a = document.createElement('a'); a.href=url;
                                a.setAttribute('download',`${f.label.replace(/\s+/g,'_')}_${i+1}.jpg`);
                                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                              })}
                                className="w-7 h-7 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 flex items-center justify-center transition">
                                <FaDownload size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    });
                    return [...docRows, ...fotosRows];
                  })()}
                </div>
              </div>

              {/* Footer */}
              <p className="text-[10px] text-gray-600 text-right border-t border-white/5 pt-4">
                Criado em {new Date(selectedDelivery.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>

            {/* Actions footer */}
            {canEdit() && (
              <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 bg-white/[0.02] flex justify-end gap-3">
                <button onClick={() => handleEditStart(selectedDelivery)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-200 text-sm font-semibold transition border border-blue-500/20">
                  <FaEdit /> Editar
                </button>
                <button onClick={() => handleDelete(selectedDelivery._id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-200 text-sm font-semibold transition border border-red-500/20">
                  <FaTrash /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: FOTOS DO FLUXO
          ═══════════════════════════════════════ */}
      {modalFotos && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white">{modalFotos.label}</h2>
              <button onClick={() => setModalFotos(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
                <FaTimes />
              </button>
            </div>
            <div className="p-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {modalFotos.files.map((url, i) => (
                  <img key={i} src={url} alt={`Foto ${i+1}`} className="w-full h-44 object-cover rounded-xl shadow-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: VISUALIZAR DOCUMENTO
          ═══════════════════════════════════════ */}
      {viewingDocument && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-base font-bold text-white">{viewingDocument.label}</h2>
              <button onClick={() => setViewingDocument(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
                <FaTimes />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 bg-gray-950/50">
              {viewingDocument.urls?.length > 0 ? (
                <div className="space-y-4">
                  {viewingDocument.urls.map((url, i) => (
                    <div key={i} className="rounded-xl overflow-hidden">
                      {url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                        ? <img src={url} alt={`${viewingDocument.label} ${i+1}`} className="w-full h-auto rounded-xl" />
                        : (
                          <div className="p-8 text-center">
                            <FaFilePdf className="mx-auto text-4xl text-red-400 mb-4" />
                            <p className="text-gray-400 mb-4 text-sm">{viewingDocument.label}</p>
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
                              <FaDownload /> Abrir documento
                            </a>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">Nenhum documento disponível</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: EDIÇÃO
          ═══════════════════════════════════════ */}
      {editingDelivery && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] rounded-3xl w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 flex-shrink-0">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Edição</p>
                <h2 className="text-lg font-black text-white">Editar Entrega</h2>
              </div>
              <button onClick={() => setEditingDelivery(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
                <FaTimes />
              </button>
            </div>

            {isGeoMar() && (
              <div className="mx-6 mt-4 p-3 bg-amber-900/30 border border-amber-500/20 rounded-xl">
                <p className="text-sm text-amber-300 font-semibold flex items-center gap-2">
                  <FaEye /> Modo Visualização – sem permissão de edição
                </p>
              </div>
            )}

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {[
                ['Número do Container', 'deliveryNumber', 'text', true],
                ['Contratado', 'userName', 'text', false],
                ['Motorista', 'driverName', 'text', false],
                ['Placa', 'vehiclePlate', 'text', true],
                ['Recebedor', 'recebedor', 'text', false],
              ].map(([label, field, type, upper]) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">{label}</label>
                  <input type={type} disabled={isGeoMar()} value={editForm[field]}
                    onChange={e => setEditForm({...editForm, [field]: upper ? e.target.value.toUpperCase() : e.target.value})}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed" />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Status</label>
                <select disabled={isGeoMar()} value={editForm.status}
                  onChange={e => setEditForm({...editForm, status: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed">
                  <option value="" className="bg-gray-900">Selecione…</option>
                  <option value="ENTREGUE" className="bg-gray-900">Operação Finalizada</option>
                  <option value="pending" className="bg-gray-900">A Caminho do Cliente</option>
                  <option value="AGUARDANDO_DESOVA" className="bg-gray-900">Aguardando Desova</option>
                  <option value="EM_DESOVA" className="bg-gray-900">Em Desova</option>
                  <option value="DESOVA_FINALIZADA" className="bg-gray-900">Desova Finalizada</option>
                  <option value="ANEXANDO_DOCUMENTOS_FINAIS" className="bg-gray-900">Anexando Docs Finais</option>
                  <option value="CANCELADO" className="bg-gray-900">Cancelado</option>
                </select>
              </div>

              {[
                ['Data Agendamento', 'dataAgendamento'],
                ['Horário Chegada', 'horarioChegada'],
                ['Início Desova', 'horarioInicioDesova'],
                ['Fim Desova', 'horarioFimDesova'],
              ].map(([label, field]) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">{label}</label>
                  <input type="datetime-local" disabled={isGeoMar()} value={editForm[field]}
                    onChange={e => setEditForm({...editForm, [field]: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed" />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                  Motivo da Edição <span className="text-red-400">*</span>
                </label>
                <textarea disabled={isGeoMar()} value={editForm.observations}
                  onChange={e => setEditForm({...editForm, observations: e.target.value})}
                  rows={3}
                  placeholder="Explique o motivo da edição (obrigatório)"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none placeholder-gray-600 disabled:opacity-40 disabled:cursor-not-allowed" />
              </div>
            </div>

            <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 bg-white/[0.02] flex gap-3">
              <button onClick={handleEditSave} disabled={isGeoMar()}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed">
                Salvar Alterações
              </button>
              <button onClick={() => setEditingDelivery(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-sm transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitorEntregas;
