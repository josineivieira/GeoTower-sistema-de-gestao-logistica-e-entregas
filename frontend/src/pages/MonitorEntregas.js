import React, {
  useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect, lazy, Suspense
} from 'react';
import { useTheme, THEMES } from '../contexts/ThemeContext';
import { useAuth } from '../services/authContext';
import { useCity } from '../contexts/CityContext';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { getStatusColumns } from '../config/statusColumns';
import { MemoizedBadge, MemoizedProgressDots, MemoizedPunctualityCell, MemoizedStatusCheckmark } from '../components/MemoizedTableCells';
import { getProgramacaoDate } from '../utils/programacaoDate';
import { formatarData, formatarDataApenas, formatarHora, formatarAgendamento } from '../utils/date';
import { getDocumentLabel, getDocumentLabels } from '../utils/documentLabels';
import {
  FaArrowLeft, FaEye, FaDownload, FaSync, FaFilter, FaTimes,
  FaTrash, FaEdit, FaExclamationTriangle, FaShareAlt, FaCalendarAlt,
  FaClock, FaBox, FaTruck, FaCheckCircle, FaTimesCircle, FaFilePdf,
  FaUsers, FaDolly, FaSearch, FaExpand, FaPalette, FaCog, FaSlidersH,
  FaPlus, FaMapMarkerAlt, FaRoute, FaShippingFast, FaUndo, FaChevronRight,
  FaUser, FaBoxOpen, FaBuilding, FaLayerGroup, FaSort, FaSortUp, FaSortDown, FaWarehouse
} from 'react-icons/fa';
import { MdLocalShipping, MdDashboard } from 'react-icons/md';
import jsPDF from 'jspdf';
import { getDesovaStatusLabel, getDesovaStepLabel } from '../utils/cityLabels';

const DeliveryModal = lazy(() => import('../components/DeliveryModal'));
const ENABLE_CONTROLE_PROTOCOLOS_LOOKUP = false;

/* ─────────────────────────────────────────────────────────────
   KANBAN - MESMA LÓGICA DO MONITOR DE PROCESSOS
───────────────────────────────────────────────────────────── */
const normalizeKey = (s) => {
  if (!s) return '';
  return String(s).replace(/_/g, ' ').toUpperCase().trim();
};

const getDisplayContainer = (delivery) => {
  const value = delivery?.containerNumero;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return value || delivery?.container || delivery?.deliveryNumber || '';
};

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────────── */
const getStatusConfig = (city = 'manaus') => {
  const desovaLabel = getDesovaStepLabel(city);
  return {
    AGENDADO: {
      label: 'Não Iniciado',
      bg: 'bg-indigo-600', light: 'bg-indigo-50', text: 'text-indigo-700',
      border: 'border-indigo-300',
      badge: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
      icon: <FaCalendarAlt />, gradient: 'from-indigo-500 to-indigo-700',
      ring: 'ring-indigo-400/30', dot: 'bg-indigo-500', hex: '#6366f1'
    },
    'NO PORTO AGUARDANDO MONTAGEM': {
      label: 'No porto aguardando montagem',
      bg: 'bg-blue-600', light: 'bg-blue-50', text: 'text-blue-700',
      border: 'border-blue-300',
      badge: 'bg-blue-100 text-blue-800 border border-blue-300',
      icon: <FaMapMarkerAlt />, gradient: 'from-blue-500 to-indigo-700',
      ring: 'ring-blue-400/30', dot: 'bg-blue-500', hex: '#3b82f6'
    },
    'CONTAINER MONTADO': {
      label: 'Container Montado',
      bg: 'bg-sky-600', light: 'bg-sky-50', text: 'text-sky-700',
      border: 'border-sky-300',
      badge: 'bg-sky-100 text-sky-800 border border-sky-300',
      icon: <FaBox />, gradient: 'from-sky-500 to-sky-700',
      ring: 'ring-sky-400/30', dot: 'bg-sky-500', hex: '#0ea5e9'
    },
    'A CAMINHO DO CLIENTE': {
      label: 'A Caminho do Cliente',
      bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700',
      border: 'border-amber-300',
      badge: 'bg-amber-100 text-amber-800 border border-amber-300',
      icon: <FaTruck />, gradient: 'from-amber-400 to-amber-600',
      ring: 'ring-amber-400/30', dot: 'bg-amber-500', hex: '#f59e0b'
    },
    'AGUARDANDO DESOVA': {
      label: getDesovaStatusLabel('AGUARDANDO_DESOVA', city),
      bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700',
      border: 'border-orange-300',
      badge: 'bg-orange-100 text-orange-800 border border-orange-300',
      icon: <FaExclamationTriangle />, gradient: 'from-orange-400 to-orange-600',
      ring: 'ring-orange-400/30', dot: 'bg-orange-500', hex: '#f97316'
    },
    'EM DESOVA': {
      label: getDesovaStatusLabel('EM_DESOVA', city),
      bg: 'bg-violet-600', light: 'bg-violet-50', text: 'text-violet-700',
      border: 'border-violet-300',
      badge: 'bg-violet-100 text-violet-800 border border-violet-300',
      icon: <FaDolly />, gradient: 'from-violet-500 to-violet-700',
      ring: 'ring-violet-400/30', dot: 'bg-violet-500', hex: '#8b5cf6'
    },
    DESATRELADO: {
      label: 'Desatrelado',
      bg: 'bg-blue-700', light: 'bg-blue-50', text: 'text-blue-700',
      border: 'border-blue-300',
      badge: 'bg-blue-100 text-blue-800 border border-blue-300',
      icon: <FaWarehouse />, gradient: 'from-blue-600 to-slate-700',
      ring: 'ring-blue-400/30', dot: 'bg-blue-500', hex: '#2563eb'
    },
    'DESOVA_FINALIZADA': {
      label: getDesovaStatusLabel('DESOVA_FINALIZADA', city),
      bg: 'bg-purple-600', light: 'bg-purple-50', text: 'text-purple-700',
      border: 'border-purple-300',
      badge: 'bg-purple-100 text-purple-800 border border-purple-300',
      icon: <FaCheckCircle />, gradient: 'from-purple-500 to-purple-700',
      ring: 'ring-purple-400/30', dot: 'bg-purple-500', hex: '#9333ea'
    },
    'ANEXANDO DOCUMENTOS FINAIS': {
      label: 'Op. finalizada',
      bg: 'bg-pink-600', light: 'bg-pink-50', text: 'text-pink-700',
      border: 'border-pink-300',
      badge: 'bg-pink-100 text-pink-800 border border-pink-300',
      icon: <FaFilePdf />, gradient: 'from-pink-500 to-pink-700',
      ring: 'ring-pink-400/30', dot: 'bg-pink-500', hex: '#ec4899'
    },
    'SAINDO CLIENTE': {
      label: 'Saindo do Cliente',
      bg: 'bg-cyan-600', light: 'bg-cyan-50', text: 'text-cyan-700',
      border: 'border-cyan-300',
      badge: 'bg-cyan-100 text-cyan-800 border border-cyan-300',
      icon: <FaRoute />, gradient: 'from-cyan-500 to-sky-700',
      ring: 'ring-cyan-400/30', dot: 'bg-cyan-500', hex: '#06b6d4'
    },
    'CHEGOU PORTO': {
      label: 'Chegou no Porto',
      bg: 'bg-blue-600', light: 'bg-blue-50', text: 'text-blue-700',
      border: 'border-blue-300',
      badge: 'bg-blue-100 text-blue-800 border border-blue-300',
      icon: <FaMapMarkerAlt />, gradient: 'from-blue-500 to-indigo-700',
      ring: 'ring-blue-400/30', dot: 'bg-blue-500', hex: '#3b82f6'
    },
    'RETORNANDO PORTO': {
      label: 'Retornando Porto',
      bg: 'bg-sky-600', light: 'bg-sky-50', text: 'text-sky-700',
      border: 'border-sky-300',
      badge: 'bg-sky-100 text-sky-800 border border-sky-300',
      icon: <FaRoute />, gradient: 'from-sky-500 to-cyan-700',
      ring: 'ring-sky-400/30', dot: 'bg-sky-500', hex: '#0ea5e9'
    },
    ENTREGUE: {
      label: 'Entregue',
      bg: 'bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700',
      border: 'border-emerald-300',
      badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      icon: <FaCheckCircle />, gradient: 'from-emerald-500 to-emerald-700',
      ring: 'ring-emerald-400/30', dot: 'bg-emerald-500', hex: '#10b981'
    },
    'RECUSADO CLIENTE': {
      label: 'Recusado Cliente',
      bg: 'bg-red-600', light: 'bg-red-50', text: 'text-red-700',
      border: 'border-red-300',
      badge: 'bg-red-100 text-red-800 border border-red-300',
      icon: <FaExclamationTriangle />, gradient: 'from-red-500 to-rose-700',
      ring: 'ring-red-400/30', dot: 'bg-red-500', hex: '#dc2626'
    },
    CANCELADO: {
      label: 'Cancelado',
      bg: 'bg-gray-500', light: 'bg-gray-50', text: 'text-gray-600',
      border: 'border-gray-300',
      badge: 'bg-gray-100 text-gray-600 border border-gray-300',
      icon: <FaTimesCircle />, gradient: 'from-gray-400 to-gray-600',
      ring: 'ring-gray-400/30', dot: 'bg-gray-500', hex: '#6b7280'
    }
  };
};

const getResolveConfig = (rawStatus, city = 'manaus') => {
  const statusConfig = getStatusConfig(city);
  const key = normalizeKey(rawStatus);
  if (key === 'ENTREGUE' || key === 'SUBMITTED' || key === 'ENTREGUE COM PENDENCIA CANHOTO') {
    return statusConfig['ENTREGUE'];
  }
  if (key === 'PENDING' || key === 'A CAMINHO DO CLIENTE') {
    return statusConfig['A CAMINHO DO CLIENTE'];
  }
  return statusConfig[key] || null;
};

/* ─────────────────────────────────────────────────────────────
   GLOBAL ANIMATION STYLES
───────────────────────────────────────────────────────────── */
const GLOBAL_STYLES = `
@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
.panel-enter  { animation: slideInRight  0.3s cubic-bezier(0.34,1.2,0.64,1) forwards; }
.panel-exit   { animation: slideOutRight 0.25s ease-in forwards; }
.row-rise { position: relative; z-index: 30; }
.row-glow { position: relative; z-index: 20; }
.monitor-table { grid-auto-rows: minmax(36px, auto); }
.cell-trunc { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

/* ─────────────────────────────────────────────────────────────
   SMALL COMPONENTS
───────────────────────────────────────────────────────────── */
// Badge agora importado como MemoizedBadge
const Badge = MemoizedBadge;

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
    gray: 'bg-gray-800 text-white border-gray-900 shadow-md shadow-gray-200',
    blue: 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-200',
  };
  const off = 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20 hover:bg-white/10 hover:text-white';
  return (
    <button className={`${base} ${active ? on[color] : off}`} onClick={onClick}>
      {children}
    </button>
  );
};

/* ─────────────────────────────────────────────────────────────
   KANBAN UI
───────────────────────────────────────────────────────────── */
const formatBoardDate = (value, city) => {
  if (!value) return '—';
  try {
    return formatarAgendamento(value);
  } catch {
    return value;
  }
};

const getPunctualityStatus = (d, now = new Date(), city = 'manaus') => {
  if (!d) return { label: '-', type: 'unknown', eta: null, lateBy: null };

  const normalizeDateValue = (value, cityCode) => {
    if (!value) return null;

    let raw = String(value).trim();
    if (!raw) return null;

    raw = raw.replace(' ', 'T');

    // Se já tem timezone explícito, usa diretamente
    if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // Se não tem hora, assume meia-noite
    if (!raw.includes('T')) raw += 'T00:00:00';

    const tz = cityCode === 'itajai' ? '-03:00' : '-04:00';
    const parsed = new Date(`${raw}${tz}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const deliveryCity = (d.city || city || 'manaus').toLowerCase();
  const schedStr = getProgramacaoDate(d, deliveryCity);
  if (!schedStr) return { label: 'Sem agendamento', type: 'unknown', eta: null, lateBy: null };

  const scheduled = normalizeDateValue(schedStr, deliveryCity);
  if (!scheduled) return { label: 'Sem agendamento', type: 'unknown', eta: null, lateBy: null };

  const arrival = d.horarioChegada ? normalizeDateValue(d.horarioChegada, deliveryCity) : null;
  const start = d.createdAt ? normalizeDateValue(d.createdAt, deliveryCity) : null;
  const travel = Number(d.estimatedTravelMinutes || d.minimumTravelMinutes || 40);

  const nowInstant = now instanceof Date ? now : new Date(now);

  const computeEta = () => {
    if (!start) return null;
    const expected = new Date(start.getTime() + travel * 60000);
    const diff = Math.round((expected.getTime() - nowInstant.getTime()) / 60000);
    return diff < 0 ? 0 : diff;
  };

  if (arrival) {
    const lateBy = Math.round((arrival.getTime() - scheduled.getTime()) / 60000);
    const isOnTime = arrival.getTime() <= scheduled.getTime();
    return {
      label: isOnTime ? 'Pontual' : 'Atrasado',
      type: isOnTime ? 'ok' : 'late',
      eta: 0,
      lateBy
    };
  }

  const eta = computeEta();
  if (nowInstant.getTime() >= scheduled.getTime()) return { label: 'Atrasado', type: 'late', eta: eta || 0, lateBy: null };
  if (!start) return { label: 'Sem início', type: 'unknown', eta, lateBy: null };
  const timeLeft = Math.round((scheduled.getTime() - nowInstant.getTime()) / 60000);
  if (timeLeft <= travel) return { label: 'Possível atraso', type: 'possible', eta, lateBy: null };
  return { label: 'No prazo', type: 'ok', eta, lateBy: null };
};

const getPartyBySentido = (delivery, sentido = 'DESTINO') => {
  const sentidoKey = String(sentido || '').trim().toUpperCase();
  const remetenteValue = String(delivery?.remetente || '').trim();
  const destinatarioValue = String(delivery?.destinatario || delivery?.recebedor || '').trim();
  if (sentidoKey === 'ORIGEM') return remetenteValue || destinatarioValue || '—';
  return destinatarioValue || remetenteValue || '—';
};

const getPartyLabelBySentido = (sentido = 'DESTINO') =>
  String(sentido || '').trim().toUpperCase() === 'ORIGEM' ? 'Remetente' : 'Recebedor';

const getDesovaLabelBySentido = (sentido = 'DESTINO') =>
  String(sentido || '').trim().toUpperCase() === 'ORIGEM' ? 'Ovação' : 'Desova';

const getFinalDocumentKeysBySentido = (sentido = 'DESTINO') => (
  String(sentido || '').trim().toUpperCase() === 'ORIGEM'
    ? ['canhotCTE', 'canhotNF', 'diarioBordo']
    : ['canhotCTE', 'canhotNF', 'diarioBordo']
);

const DeliveryKanbanCard = ({ delivery, column, onOpen, currentTime, city = 'manaus', sentido = 'DESTINO' }) => (
    <button
      type="button"
      onClick={() => onOpen(delivery)}
      className={`group relative w-full text-left rounded-lg border ${column.border} shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden ${(() => {
        const punct = getPunctualityStatus(delivery, currentTime, city);
        let bgClass = 'bg-white';
        let shadowClass = '';
        if (punct.label === 'Atrasado') {
          bgClass = 'bg-red-50';
          shadowClass = 'shadow-red-500/50';
        } else if (punct.label === 'Pontual' || punct.label === 'No prazo') {
          bgClass = 'bg-green-50';
          shadowClass = 'shadow-green-500/50';
        } else if (punct.label === 'Possível atraso') {
          bgClass = 'bg-yellow-50';
          shadowClass = 'shadow-yellow-500/50';
        }
        return `${bgClass} ${shadowClass}`;
      })()}`}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${(() => {
          const punct = getPunctualityStatus(delivery, currentTime, city);
          if (punct.label === 'Atrasado') return 'from-red-400 to-red-600';
          if (punct.label === 'Pontual' || punct.label === 'No prazo') return 'from-green-400 to-green-600';
          if (punct.label === 'Possível atraso') return 'from-yellow-400 to-yellow-600';
          return column.gradient;
        })()}`}
      />
      <div className="pl-2.5 pr-2 pt-2 pb-2">
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
          <span className="font-bold text-gray-800 text-xs leading-tight truncate">
            {/* sempre mostrar o processo CAB, não o número do container */}
            {delivery.processoCAB || '—'}
          </span>
          <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${column.badge} border ${column.border}`}>
            {/* Exibe placa, buscando da base icompany se disponível */}
            {delivery.placaIcompany || delivery.vehiclePlate || 'Placa'}
          </span>
        </div>

        <div className="space-y-0.5">
          {getPartyBySentido(delivery, sentido) && (
            <div className="flex items-center gap-1 text-[9px] text-gray-500">
              <FaBuilding className="text-gray-400 shrink-0 text-[8px]" />
              <span className="truncate">{getPartyBySentido(delivery, sentido)}</span>
            </div>
          )}

          {delivery.userName && (
            <div className="flex items-center gap-1 text-[9px] text-gray-500">
              <FaBoxOpen className="text-gray-400 shrink-0 text-[8px]" />
              <span className="truncate">{delivery.userName}</span>
            </div>
          )}

          {/* mostramos número do container no lugar do motorista */}
          {getDisplayContainer(delivery) && (
            <div className={`flex items-center gap-1 text-[9px] font-medium ${column.text}`}>
              <FaBoxOpen className="shrink-0 text-[8px]" />
              <span className="truncate">{getDisplayContainer(delivery)}</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-[9px] text-gray-400">
            <FaCalendarAlt className="shrink-0 text-[8px]" />
            <span className="truncate">{formatBoardDate(getProgramacaoDate(delivery, city), city)}</span>
          </div>
        </div>
      </div>
    </button>
);

const KanbanColumnHeader = ({ column, count }) => {
  const Icon = column.icon;
  return (
    <div className={`px-2.5 py-2 ${column.lightBg} border-b ${column.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${column.gradient} flex items-center justify-center shadow-sm`}>
            <Icon className="text-white text-xs" />
          </div>
          <div>
            <p className={`text-xs font-bold ${column.text} leading-tight`}>{column.title}</p>
            <p className="text-[8px] text-gray-500 leading-tight">{column.description}</p>
          </div>
        </div>
        <span className={`min-w-[22px] h-5 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-gradient-to-br ${column.gradient} text-white shadow-sm`}>
          {count}
        </span>
      </div>
    </div>
  );
};

const DeliveryKanbanColumn = ({ column, deliveries, onOpen, currentTime, city = 'manaus', sentido = 'DESTINO' }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? deliveries : deliveries.slice(0, 4);

  return (
    <div className={`flex flex-col rounded-lg border ${column.border} bg-white shadow-sm overflow-hidden flex-1 min-w-[140px] max-w-[220px]`}>
      <KanbanColumnHeader column={column} count={deliveries.length} />

      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[430px]">
        {deliveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-300">
            <column.icon className="text-2xl mb-1" />
            <p className="text-[8px] font-medium">Nenhuma</p>
          </div>
        ) : (
          <>
            {visible.map((delivery) => (
              <DeliveryKanbanCard
                key={delivery._id || delivery.deliveryNumber}
                delivery={delivery}
                column={column}
                onOpen={onOpen}
                currentTime={currentTime}
                city={city}
                sentido={sentido}
              />
            ))}

            {deliveries.length > 4 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className={`w-full text-[8px] font-semibold py-1.5 rounded-lg ${column.lightBg} ${column.text} border ${column.border} hover:opacity-80 transition-opacity flex items-center justify-center gap-1`}
              >
                {expanded ? 'Menos' : `+${deliveries.length - 4}`}
                <FaChevronRight className={`transition-transform duration-200 text-[9px] ${expanded ? 'rotate-90' : ''}`} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   PROGRESS
───────────────────────────────────────────────────────────── */
const progressByStatus = {
  AGENDADO: 0,
  PENDING: 0,
  'NO PORTO AGUARDANDO MONTAGEM': 12,
  'CONTAINER MONTADO': 24,
  'A CAMINHO DO CLIENTE': 36,
  'AGUARDANDO DESOVA': 48,
  'EM DESOVA': 60,
  DESATRELADO: 60,
  'DESOVA FINALIZADA': 72,
  'AGUARDANDO ANEXO': 72,
  'ANEXANDO DOCUMENTOS FINAIS': 72,
  'SAINDO CLIENTE': 80,
  'RETORNANDO PORTO': 88,
  'CHEGOU PORTO': 94,
  ENTREGUE: 100,
  SUBMITTED: 100,
  'ENTREGUE COM PENDENCIA CANHOTO': 100,
  'DOCUMENTOS ENTREGUES': 100,
  'RECUSADO CLIENTE': 100,
};

const getProgress = (delivery) => {
  const key = normalizeKey(delivery.status);
  const norm =
    key === 'ENTREGUE' || key === 'SUBMITTED' || key === 'ENTREGUE COM PENDENCIA CANHOTO' ? 'ENTREGUE'
    : key === 'PENDING' || key === 'A CAMINHO DO CLIENTE' ? 'A CAMINHO DO CLIENTE'
    : key;
  if (norm === 'CANCELADO' || !norm) return 0;
  return progressByStatus[norm] ?? 0;
};

// ProgressDots agora importado como MemoizedProgressDots
const ProgressDots = MemoizedProgressDots;

// PunctualityCell agora importado como MemoizedPunctualityCell
const PunctualityCell = MemoizedPunctualityCell;

const DEFAULT_COL_TEMPLATE = 'repeat(15, minmax(0, 1fr))';
const sharedInputCls = `w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-600`;

/* ─────────────────────────────────────────────────────────────
   SETTINGS PANEL
───────────────────────────────────────────────────────────── */
const SettingsPanel = ({
  open, onClose, theme, setTheme,
  autoRefresh, setAutoRefresh, refreshInterval, setRefreshInterval,
  filters, setFilters
}) => {
  const [visible, setVisible] = useState(false);
  const selectedStatuses = Array.isArray(filters.status)
    ? filters.status
    : (filters.status && filters.status !== 'all' ? [filters.status] : []);
  const statusOptions = [
    { value: "OPERACAO_FINALIZADA", label: "Operação Finalizada" },
    { value: "DOCUMENTOS_ENTREGUES", label: "Documentos Entregues" },
    { value: "FINALIZADO", label: "Finalizado (sem docs)" },
    { value: "A CAMINHO DO CLIENTE", label: "A Caminho do Cliente" },
    { value: "AGENDADO", label: "Agendado" },
    { value: "NO_PORTO_AGUARDANDO_MONTAGEM", label: "No porto aguardando montagem" },
    { value: "AGUARDANDO_DESOVA", label: "Aguardando Desova/Ovação" },
    { value: "EM_DESOVA", label: "Em Desova/Ovação" },
    { value: "DESATRELADO", label: "Desatrelado" },
    { value: "RECUSADO_CLIENTE", label: "Recusado Cliente" },
    { value: "DESOVA_FINALIZADA", label: "Desova/Ovação Finalizada" },
    { value: "ANEXANDO_DOCUMENTOS_FINAIS", label: "Anexando Docs Finais" },
    { value: "SAINDO_CLIENTE", label: "Saindo do Cliente" },
    { value: "RETORNANDO_PORTO", label: "Retornando Porto" },
    { value: "CHEGOU_PORTO", label: "Chegou no Porto" },
    { value: "CANCELADO", label: "Cancelado" }
  ];
  const toggleStatusFilter = (status) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((item) => item !== status)
      : [...selectedStatuses, status];
    setFilters({ ...filters, status: next });
  };

  useEffect(() => {
    if (open) setVisible(true);
    else {
      const t = setTimeout(() => setVisible(false), 280);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible) return null;

  const hasAnyFilters = () => (
    filters.searchTerm.trim() !== '' ||
    selectedStatuses.length > 0 ||
    filters.processo?.trim() !== '' ||
    filters.container?.trim() !== '' ||
    filters.recebedor?.trim() !== '' ||
    filters.pontualidade !== 'all' ||
    filters.startDate ||
    filters.endDate ||
    filters.horaStatusFrom ||
    filters.horaStatusTo ||
    filters.tempoStatusMin ||
    filters.tempoStatusMax
  );

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity"
        style={{ opacity: open ? 1 : 0 }}
        onClick={onClose}
      />

      <div
        className={`fixed right-0 top-0 h-full w-full max-w-sm z-50 flex flex-col shadow-2xl ${open ? 'panel-enter' : 'panel-exit'}`}
        style={{ backgroundColor: '#13131f', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-purple-600/30 flex items-center justify-center">
              <FaSlidersH className="text-purple-400 text-sm" />
            </span>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Configurações</h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <FaTimes size={12} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          <section>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <FaPalette className="text-purple-400" /> Tema
            </p>

            <div className="grid grid-cols-1 gap-2">
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    theme === key
                      ? 'bg-purple-600/30 border-purple-500/60 text-purple-200 shadow-md shadow-purple-900/30'
                      : 'bg-white/[0.03] border-white/8 text-gray-400 hover:bg-white/8 hover:text-gray-200'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full border-2 flex-shrink-0 ${theme === key ? 'border-purple-400' : 'border-gray-600'}`}
                    style={{ background: t.preview || t.headerGradient || t.bg }}
                  />
                  {t.name}
                  {theme === key && <FaCheckCircle className="ml-auto text-purple-400 text-xs" />}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <FaSync className="text-emerald-400" /> Auto-Refresh
            </p>

            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-4">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <div>
                  <p className="text-sm font-semibold text-gray-200">Atualização automática</p>
                  <p className="text-xs text-gray-500 mt-0.5">Recarrega dados periodicamente</p>
                </div>

                <span
                  onClick={() => setAutoRefresh((v) => !v)}
                  className={`w-11 h-6 rounded-full relative transition-colors duration-300 flex-shrink-0 cursor-pointer ${autoRefresh ? 'bg-emerald-500' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${autoRefresh ? 'translate-x-5' : ''}`} />
                </span>
              </label>

              {autoRefresh && (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Intervalo (segundos)</label>
                  <div className="flex items-center gap-3">
                    {[10, 30, 60, 120].map((v) => (
                      <button
                        key={v}
                        onClick={() => setRefreshInterval(v)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          refreshInterval === v ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {v}s
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="5"
                    max="300"
                    step="5"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="w-full mt-3 accent-emerald-500"
                  />
                  <p className="text-center text-xs text-gray-400 mt-1">{refreshInterval} seg</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <FaFilter className="text-purple-400" /> Filtros
              </p>

              {hasAnyFilters() && (
                <button
                  onClick={() => setFilters({
                    status: [], searchTerm: '', startDate: '', endDate: '',
                    processo: '', container: '', recebedor: '',
                    sentido: filters.sentido || 'DESTINO',
                    pontualidade: 'all', horaStatusFrom: '', horaStatusTo: '',
                    tempoStatusMin: '', tempoStatusMax: ''
                  })}
                  className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 font-semibold transition"
                >
                  <FaTimes size={10} /> Limpar
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-2 space-y-1">
                  {statusOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs text-gray-200">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(option.value)}
                        onChange={() => toggleStatusFilter(option.value)}
                        className="accent-purple-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Buscar</label>
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
                  <input
                    type="text"
                    placeholder="Número, motorista, placa…"
                    value={filters.searchTerm}
                    onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                    className={`${sharedInputCls} pl-8`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Data Inicial</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className={sharedInputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Data Final</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className={sharedInputCls}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

/* ─────────────────────────────────────────────────────────────
   MOBILE CARD
───────────────────────────────────────────────────────────── */
const MobileDeliveryCard = ({
  d, currentTime, allModalDocsComplete, getDocumentsStatus,
  getPunctualityStatus, recentlyUpdated, RISE_WINDOW, setSelectedDelivery, city, sentido = 'DESTINO'
}) => {
  const now = Date.now();
  const updatedAt = recentlyUpdated[d._id];
  const isActive = updatedAt && (now - updatedAt) < RISE_WINDOW;
  const docStatus = getDocumentsStatus(d);
  const isComplete = docStatus.includes('COMPLETO');
  const punct = getPunctualityStatus(d, currentTime, city);
  const dispStatus = d.status === 'FINALIZADO' && allModalDocsComplete(d) ? 'DOCUMENTOS ENTREGUES' : d.status;

  return (
    <div
      className={`relative rounded-2xl border p-4 space-y-3 transition-all ${isActive ? 'row-rise border-purple-500/60 bg-purple-900/10' : 'border-white/10 bg-white/[0.02]'}`}
      style={isActive ? { '--rise-from': '80px' } : {}}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-black text-purple-300 text-base">#{d.deliveryNumber}</span>
          {isActive && (
            <span className="badge-pop px-1.5 py-0.5 rounded-full bg-purple-600/80 text-white text-[9px] font-black">UP</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge status={dispStatus} />
          <button
            onClick={() => setSelectedDelivery(d)}
            className="w-8 h-8 rounded-lg bg-purple-600/20 hover:bg-purple-600/50 text-purple-400 hover:text-white flex items-center justify-center transition"
          >
            <FaEye size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-gray-600 text-[10px] uppercase font-bold">{getPartyLabelBySentido(sentido)}</p>
          <p className="text-gray-200 font-semibold truncate">{getPartyBySentido(d, sentido)}</p>
        </div>
        <div>
          <p className="text-gray-600 text-[10px] uppercase font-bold">Motorista</p>
          <p className="text-gray-200 font-semibold truncate">{d.driverName || '—'}</p>
        </div>
        <div>
          <p className="text-gray-600 text-[10px] uppercase font-bold">Agendamento</p>
          <p className="text-gray-300 font-mono text-[11px]">
            {getProgramacaoDate(d, city) ? formatarAgendamento(getProgramacaoDate(d, city)) : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-600 text-[10px] uppercase font-bold">Chegada</p>
          <p className="text-gray-300 font-mono text-[11px]">
            {d.horarioChegada ? formatarData(d.horarioChegada, city) : '—'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <ProgressDots delivery={d} allModalDocsComplete={allModalDocsComplete} />
        <PunctualityCell p={punct} />
        <div className="flex items-center gap-2">
          {isComplete ? <FaCheckCircle className="text-emerald-400" /> : <FaTimesCircle className="text-red-400/70" />}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   FUNÇÃO PARA OBTER HORA DE ENTRADA NO STATUS ATUAL
───────────────────────────────────────────────────────────── */
const getStatusEntryTime = (delivery, city) => {
  const status = normalizeKey(delivery.status);
  if (status === 'AGENDADO') {
    // Usar getProgramacaoDate para considerar a cidade (Itajaí = dtColeta, Manaus = dataAgendamento)
    const progDate = getProgramacaoDate(delivery, city);
    return progDate || delivery.scheduledAt || delivery.dataAgendamento || delivery.createdAt;
  }
  if (status === 'NO PORTO AGUARDANDO MONTAGEM') return delivery.chegadaMontagemAt || delivery.createdAt;
  if (status === 'CONTAINER MONTADO') return delivery.containerMontadoAt;
  if (status === 'A CAMINHO DO CLIENTE' || status === 'PENDING') return delivery.tripStartedAt || delivery.createdAt; // fallback para createdAt se tripStartedAt não existir
  if (status === 'AGUARDANDO DESOVA') return delivery.arrivedAt || delivery.horarioChegada;
  if (status === 'EM DESOVA') return delivery.desovaStartedAt || delivery.horarioInicioDesova;
  if (status === 'DESATRELADO') return delivery.desatreladoAt || delivery.desovaStartAt || delivery.horarioInicioDesova;
  if (status === 'ANEXANDO DOCUMENTOS FINAIS') return delivery.docsStartedAt || delivery.horarioFimDesova;
  if (status === 'SAINDO CLIENTE') return delivery.horarioSaidaCliente || delivery.horarioFimDesova;
  if (status === 'RETORNANDO PORTO') return delivery.horarioSaidaCliente || delivery.horarioFimDesova;
  if (status === 'CHEGOU PORTO') return delivery.horarioChegadaPorto || delivery.horarioSaidaCliente;
  if (status === 'RECUSADO CLIENTE') return delivery.recusadoClienteAt || delivery.horarioChegada;
  if (status === 'FINALIZADO' || status === 'ENTREGUE' || status === 'DOCUMENTOS ENTREGUES') return delivery.finalizedAt || delivery.horarioFimDesova || delivery.horarioChegada;
  if (status === 'CANCELADO') return delivery.cancelledAt || delivery.createdAt;
  return null;
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
const MonitorEntregas = () => {
  const { user } = useAuth();
  const { city, setCity } = useCity();
  const isGeoMar = () => false; // Libera edição para geomar
  const canEdit = () => user?.role === 'manager' || user?.role === 'geomar';
  const currentCity = city || 'manaus';
  const getStatusOptions = () => [
    { value: "all", label: "Todos" },
    { value: "OPERACAO_FINALIZADA", label: "Operação Finalizada" },
    { value: "DOCUMENTOS_ENTREGUES", label: "Documentos Entregues" },
    { value: "FINALIZADO", label: "Finalizado (sem docs)" },
    { value: "A CAMINHO DO CLIENTE", label: "A Caminho do Cliente" },
    { value: "AGENDADO", label: "Agendado" },
    { value: "NO_PORTO_AGUARDANDO_MONTAGEM", label: "No porto aguardando montagem" },
    { value: "AGUARDANDO_DESOVA", label: `Aguardando ${getDesovaStepLabel(currentCity)}` },
    { value: "EM_DESOVA", label: `Em ${getDesovaStepLabel(currentCity)}` },
    { value: "DESATRELADO", label: "Desatrelado" },
    { value: "RECUSADO_CLIENTE", label: "Recusado Cliente" },
    { value: "DESOVA_FINALIZADA", label: getDesovaStatusLabel('DESOVA_FINALIZADA', currentCity) },
    { value: "ANEXANDO_DOCUMENTOS_FINAIS", label: "Anexando Docs Finais" },
    { value: "SAINDO_CLIENTE", label: "Saindo do Cliente" },
    { value: "RETORNANDO_PORTO", label: "Retornando Porto" },
    { value: "CHEGOU_PORTO", label: "Chegou no Porto" },
    { value: "CANCELADO", label: "Cancelado" }
  ];
  const getEditStatusOptions = () => [
    { value: "", label: "Selecione…" },
    { value: "ENTREGUE", label: "Operação Finalizada" },
    { value: "NO_PORTO_AGUARDANDO_MONTAGEM", label: "No porto aguardando montagem" },
    { value: "pending", label: "A Caminho do Cliente" },
    { value: "AGUARDANDO_DESOVA", label: `Aguardando ${getDesovaStepLabel(currentCity)}` },
    { value: "EM_DESOVA", label: `Em ${getDesovaStepLabel(currentCity)}` },
    { value: "DESATRELADO", label: "Desatrelado" },
    { value: "DESOVA_FINALIZADA", label: getDesovaStatusLabel('DESOVA_FINALIZADA', currentCity) },
    { value: "ANEXANDO_DOCUMENTOS_FINAIS", label: "Anexando Docs Finais" },
    { value: "SAINDO_CLIENTE", label: "Saindo do Cliente" },
    { value: "RETORNANDO_PORTO", label: "Retornando Porto" },
    { value: "CHEGOU_PORTO", label: "Chegou no Porto" },
    { value: "CANCELADO", label: "Cancelado" }
  ];

  const navigate = useNavigate();
  const allowCitySwitcher = user?.city === 'both' || user?.role === 'manager';

  const [viewingDocument, setViewingDocument] = useState(null);
  const [modalFotos, setModalFotos] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [editForm, setEditForm] = useState({
    deliveryNumber: '', userName: '', driverName: '', vehiclePlate: '',
    recebedor: '', status: '', dataAgendamento: '', horarioDevolucaoVazio: '',
    horarioChegada: '', horarioInicioDesova: '', horarioFimDesova: '',
    horarioSaidaCliente: '', horarioChegadaPorto: '', observations: ''
  });
  const [filters, setFilters] = useState({
    status: [], searchTerm: '', startDate: '', endDate: '',
    processo: '', container: '', recebedor: '',
    sentido: 'DESTINO',
    pontualidade: 'all', horaStatusFrom: '', horaStatusTo: '',
    tempoStatusMin: '', tempoStatusMax: ''
  });
  const [openFilterKey, setOpenFilterKey] = useState(null);
  const [sortConfig, setSortConfig] = useState({ column: null, direction: 'asc' }); // 'asc', 'desc', null
  const filterHeaderRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [statsPeriod, setStatsPeriod] = useState('today');
  const [stats, setStats] = useState({ total: 0, statusCounts: {}, byDriver: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [icompanyVerified, setIcompanyVerified] = useState({});
  const [confirmRemoveVerification, setConfirmRemoveVerification] = useState(false);
  const [deliveryToUnverify, setDeliveryToUnverify] = useState(null);
  const [icompanyData, setIcompanyData] = useState([]);
  const [icompanyComparisons, setIcompanyComparisons] = useState({});
  const [icompanyRemoteRecord, setIcompanyRemoteRecord] = useState(null);
  const [icompanyLookupStatus, setIcompanyLookupStatus] = useState('idle');
  const [controleProtocolosRecord, setControleProtocolosRecord] = useState(null);
  const [controleProtocolosLookupStatus, setControleProtocolosLookupStatus] = useState('idle');
  const lastIcompanyQueryRef = useRef('');
  const lastControleProtocolosQueryRef = useRef('');
  // Novo template para expandir a tabela e mostrar colunas completas
  const EXPANDED_COL_TEMPLATE = [
    'minmax(200px, 2.5fr)',   // Processo
    'minmax(200px, 2.5fr)',   // Container
    'minmax(220px, 3fr)',     // Recebedor
    'minmax(160px, 1.5fr)',   // Status
    'minmax(140px, 1fr)',     // Hora Status
    'minmax(120px, 1fr)',     // Tempo Status
    'minmax(160px, 1.2fr)',   // Progresso
    'minmax(180px, 1.5fr)',   // Agendamento
    'minmax(180px, 1.5fr)',   // Pontualidade
    'minmax(90px, 0.7fr)',    // Check
    'minmax(80px, 0.5fr)'     // Detalhes
  ].join(' ');
  const [colTemplate, setColTemplate] = useState(EXPANDED_COL_TEMPLATE);

  const [recentlyUpdated, setRecentlyUpdated] = useState({});
  const [updateCounter, setUpdateCounter] = useState(0);
  const prevStatusRef = useRef({});
  const rowRefs = useRef({});
  const prevPositions = useRef({});
  const RISE_WINDOW = 8000;

  const { theme, setTheme } = useTheme();
  const themeConfig = THEMES[theme] || THEMES.black;
  const userName = user?.name || 'Usuário Desconhecido';

  const statusMapToBackend = {
    OPERACAO_FINALIZADA: ['ENTREGUE', 'submitted', 'FINALIZADO', 'SAINDO_CLIENTE'],
    'A CAMINHO DO CLIENTE': ['A_CAMINHO_DO_CLIENTE', 'pending', 'PENDING'],
    DOCUMENTOS_ENTREGUES: ['FINALIZADO'],
    FINALIZADO: ['FINALIZADO'],
    AGUARDANDO_DESOVA: ['AGUARDANDO_DESOVA'],
    EM_DESOVA: ['EM_DESOVA'],
    DESATRELADO: ['DESATRELADO'],
    RECUSADO_CLIENTE: ['RECUSADO_CLIENTE'],
    DESOVA_FINALIZADA: ['DESOVA_FINALIZADA'],
    ANEXANDO_DOCUMENTOS_FINAIS: ['ANEXANDO_DOCUMENTOS_FINAIS'],
    SAINDO_CLIENTE: ['SAINDO_CLIENTE'],
    RETORNANDO_PORTO: ['RETORNANDO_PORTO'],
    CHEGOU_PORTO: ['CHEGOU_PORTO'],
    AGENDADO: ['AGENDADO'],
    NO_PORTO_AGUARDANDO_MONTAGEM: ['NO_PORTO_AGUARDANDO_MONTAGEM'],
    CANCELADO: ['CANCELADO']
  };

  const inputCls = `w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-600`;

  const getSelectedStatuses = () => (
    Array.isArray(filters.status)
      ? filters.status.filter((status) => status && status !== 'all')
      : (filters.status && filters.status !== 'all' ? [filters.status] : [])
  );

  const matchesStatusFilter = (delivery, selectedStatuses = getSelectedStatuses()) => {
    if (!selectedStatuses.length) return true;
    return selectedStatuses.some((status) => {
      if (status === 'DOCUMENTOS_ENTREGUES') {
        return delivery.status === 'FINALIZADO' && allModalDocsComplete(delivery);
      }
      if (status === 'FINALIZADO') {
        return delivery.status === 'FINALIZADO' && !allModalDocsComplete(delivery);
      }
      const mappedStatuses = statusMapToBackend[status];
      return mappedStatuses ? mappedStatuses.includes(delivery.status) : delivery.status === status;
    });
  };

  const punctualityOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'ok', label: 'No prazo' },
    { value: 'late', label: 'Atrasado' },
    { value: 'sem_agendamento', label: 'Sem agendamento' },
    { value: 'no_start', label: 'Sem início' },
    { value: 'possible', label: 'Possível atraso' }
  ];

  const isFilterActive = (key) => {
    switch (key) {
      case 'processo': return filters.processo.trim() !== '';
      case 'container': return filters.container.trim() !== '';
      case 'recebedor': return filters.recebedor.trim() !== '';
      case 'status': return getSelectedStatuses().length > 0;
      case 'agendamento': return Boolean(filters.startDate || filters.endDate);
      case 'horaStatus': return Boolean(filters.horaStatusFrom || filters.horaStatusTo);
      case 'pontualidade': return filters.pontualidade !== 'all';
      case 'tempoStatus': return Boolean(filters.tempoStatusMin || filters.tempoStatusMax);
      default: return false;
    }
  };

  const clearColumnFilter = (key) => {
    const next = { ...filters };
    switch (key) {
      case 'processo': next.processo = ''; break;
      case 'container': next.container = ''; break;
      case 'recebedor': next.recebedor = ''; break;
      case 'status': next.status = []; break;
      case 'agendamento': next.startDate = ''; next.endDate = ''; break;
      case 'horaStatus': next.horaStatusFrom = ''; next.horaStatusTo = ''; break;
      case 'pontualidade': next.pontualidade = 'all'; break;
      case 'tempoStatus': next.tempoStatusMin = ''; next.tempoStatusMax = ''; break;
      default: break;
    }
    setFilters(next);
  };

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!openFilterKey) return;
      if (filterHeaderRef.current && !filterHeaderRef.current.contains(event.target)) {
        setOpenFilterKey(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFilterKey]);

  /* Handle Sort */
  const handleSort = useCallback((colKey) => {
    setSortConfig((prev) => {
      if (prev.column === colKey) {
        // Cycle: asc → desc → null
        if (prev.direction === 'asc') {
          return { column: colKey, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { column: null, direction: 'asc' };
        }
      }
      // First click on new column
      return { column: colKey, direction: 'asc' };
    });
  }, []);

  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'monitor-anim-styles';
    el.textContent = GLOBAL_STYLES;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  // Sincronizar verificações com o servidor ao carregar
  useEffect(() => {
    const syncVerificationsFromServer = async () => {
      try {
        const response = await adminService.getVerificationsList();
        const payload = response?.data;
        if (payload?.success && payload?.data) {
          setIcompanyVerified(payload.data);
          // Também salvamos no localStorage como backup
          localStorage.setItem('icompanyVerified', JSON.stringify(payload.data));
          // Trigger para outras abas/navegadores
          localStorage.setItem('icompanyVerifiedRefresh', Date.now().toString());
        }
      } catch (e) {
        console.warn('Aviso ao sincronizar verificações do servidor:', e);
        // Se falhar, carregar do localStorage como fallback
        try {
          const saved = localStorage.getItem('icompanyVerified');
          if (saved) {
            setIcompanyVerified(JSON.parse(saved));
          }
        } catch (e2) {
          console.error('Erro ao carregar verificações do localStorage:', e2);
        }
      }
    };

    const handleStorage = (event) => {
      if (event.key === 'icompanyVerifiedRefresh') {
        syncVerificationsFromServer();
      }
    };

    window.addEventListener('storage', handleStorage);

    syncVerificationsFromServer();

    // Polling a cada 30 segundos para sincronizar mudanças (otimizado de 10s)
    const syncInterval = setInterval(syncVerificationsFromServer, 30000);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Função para atualizar verificação no servidor
  const updateVerificationWithServer = async (deliveryId, verified, notes = '') => {
    try {
      const response = await adminService.updateDeliveryVerification(deliveryId, { verified, notes });
      const data = response?.data;
      if (data?.success) {
        console.log(`✅ Verificação do servidor atualizada para entrega ${deliveryId}`);
        return data.verification;
      }

      const message = data?.message || 'Resposta inesperada do servidor';
      console.error('❌ updateVerificationWithServer inesperado:', data);
      throw new Error(message);
    } catch (e) {
      console.error('Erro ao atualizar verificação no servidor:', e);
      setToast({
        type: 'error',
        message: 'Erro ao sincronizar com servidor. Tente novamente.',
        duration: 3000
      });
      throw e;
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try { await document.documentElement.requestFullscreen(); } catch {}
    } else {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const calculateCliTime = (delivery, now = new Date()) => {
    if (!delivery.horarioChegada) return { tempo: null, isActive: false };
    const chegada = new Date(delivery.horarioChegada);
    const isActive = !delivery.horarioFimDesova;
    const ref = isActive ? now : new Date(delivery.horarioFimDesova);
    const diffMs = ref - chegada;
    if (diffMs < 0) return { tempo: null, isActive };
    const totalMin = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return { tempo: h > 0 ? `${h}h ${m}m` : `${m}m`, isActive };
  };

  const getFlowHistory = (d) => {
    const ev = [];
    const desovaLabel = getDesovaLabelBySentido(d?.sentido || filters.sentido).toLowerCase();
    if (d.chegadaMontagemAt) ev.push({ label: 'Chegada no porto para montagem', date: d.chegadaMontagemAt });
    if (d.containerMontadoAt) ev.push({ label: 'Montagem do container', date: d.containerMontadoAt });
    if (d.horarioChegada) ev.push({ label: 'Chegada', date: d.horarioChegada });
    if (d.horarioInicioDesova) ev.push({ label: `Início da ${desovaLabel}`, date: d.horarioInicioDesova });
    if (d.desatreladoAt) ev.push({ label: 'Container desatrelado', date: d.desatreladoAt });
    if (d.recusadoClienteAt) ev.push({ label: 'Carga recusada pelo cliente', date: d.recusadoClienteAt });
    if (d.horarioFimDesova) ev.push({ label: `Fim da ${desovaLabel}`, date: d.horarioFimDesova });
    if (d.horarioSaidaCliente) ev.push({ label: 'Saida do cliente', date: d.horarioSaidaCliente });
    if (d.horarioChegadaPorto) ev.push({ label: 'Chegada no porto', date: d.horarioChegadaPorto });
    if (d.horarioDevolucaoVazio) ev.push({ label: 'Devolucao CNTR Porto', date: d.horarioDevolucaoVazio });
    return ev.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const getDocumentUrlsArray = (docData) => {
    if (!docData) return [];
    const normalizeItem = (i) => {
      if (typeof i === 'string') {
        const text = i.trim();
        if (!text) return null;
        if (text.startsWith('[') || text.startsWith('{')) {
          try {
            const parsed = JSON.parse(text);
            return Array.isArray(parsed)
              ? parsed.map(normalizeItem).filter(Boolean)
              : normalizeItem(parsed);
          } catch (_) {}
        }
        return text;
      }
      if (typeof i === 'object' && i) {
        // Prefer stored path over potentially shortened/obfuscated URL
        const pathUrl = i.path ? `/uploads/${i.path}` : null;
        const url = (typeof i.url === 'string' && i.url.includes('...') && pathUrl) ? pathUrl : i.url;
        return url || pathUrl || i.link || i.webViewLink || null;
      }
      return null;
    };

    let urls = [];
    if (Array.isArray(docData)) {
      urls = docData.flatMap(item => {
        const normalized = normalizeItem(item);
        return Array.isArray(normalized) ? normalized : [normalized];
      }).filter(Boolean);
    } else if (typeof docData === 'object') {
      urls = [normalizeItem(docData)].filter(Boolean);
    } else if (typeof docData === 'string') {
      const normalized = normalizeItem(docData);
      urls = (Array.isArray(normalized) ? normalized : [normalized]).filter(Boolean);
    }

    // Deduplicate by removing identical URLs
    const seen = new Set();
    return urls.filter(url => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  };

  const allModalDocsComplete = (d) => {
    if (!d) return false;
    const finalKeys = getFinalDocumentKeysBySentido(d.sentido || filters.sentido);
    const keys = ['retiradaCheio', ...finalKeys, 'devolucaoVazio', 'chegadaCliente', 'inicioDesova', 'fimDesova'];
    const newFlowStarted = !!(
      d.horarioSaidaCliente ||
      d.horarioChegadaPorto ||
      getDocumentUrlsArray(d.documents?.saidaCliente).length ||
      getDocumentUrlsArray(d.documents?.chegadaPorto).length ||
      ['SAINDO_CLIENTE', 'RETORNANDO_PORTO', 'CHEGOU_PORTO'].includes(String(d.status || '').toUpperCase())
    );
    if (newFlowStarted) keys.push('saidaCliente', 'chegadaPorto');
    return keys.every((k) => getDocumentUrlsArray(d.documents?.[k]).length > 0);
  };

  const formatStatus = (s, delivery) => {
    if (!s) return '-';
    if (s === 'ENTREGUE_COM_PENDENCIA_CANHOTO') s = 'FINALIZADO';
    if (s === 'FINALIZADO') {
      if (allModalDocsComplete(delivery)) return 'DOCUMENTOS ENTREGUES';
      return 'FINALIZADO';
    }
    if (s === 'RECUSADO_CLIENTE') return 'RECUSADO CLIENTE';
    if (s === 'DESATRELADO') return 'DESATRELADO';
    if (s === 'ENTREGUE' || s === 'submitted') return 'OPERAÇÃO FINALIZADA';
    if (s === 'pending' || s === 'PENDING') return 'A CAMINHO DO CLIENTE';
    return String(s).replace(/_/g, ' ');
  };

  const getDocumentsStatus = (delivery) => {
    if (!delivery) return 'PENDENTE';
    const finalRequired = getFinalDocumentKeysBySentido(delivery.sentido || filters.sentido);
    const required = [...finalRequired, 'devolucaoVazio'];
    const docs = delivery.documents || {};
    if (required.every((k) => docs[k])) return 'COMPLETO';
    const pending = required.filter((k) => !docs[k]).map((k) => getDocumentLabel(k, city)).join(' + ');
    return `PENDENTE ${pending}`;
  };

  const defaultDocumentLabels = getDocumentLabels('manaus');

  const itajaiDocumentLabels = getDocumentLabels('itajai');

  const getIcompanyDocumentMap = (sentido = 'DESTINO') => {
    const sentidoKey = String(sentido || '').trim().toUpperCase();
    if (sentidoKey === 'ORIGEM') {
      return {
        retiradaCheio: ['ricPorto', 'RIC PORTO'],
        diarioBordo: ['diarioBordo', 'DIARIO DE BORDO'],
        devolucaoVazio: ['ricDepot', 'RIC DEPOT']
      };
    }

    return {
      retiradaCheio: ['ricPortoDestino', 'RIC PORTO DESTINO'],
      devolucaoVazio: ['ricDepotDestino', 'RIC DEPOT DESTINO'],
      canhotCTE: ['comprovanteDesova', 'COMPROVANTE DE DESOVA'],
      diarioBordo: ['diarioBordo', 'DIARIO DE BORDO'],
      canhotNF: ['canhotoDanfe', 'CANHOTO DE DANFE']
    };
  };

  const isIcompanyDocumentPresent = (record, fields = []) => {
    if (!record) return false;
    return fields.some((field) => {
      const value = record[field];
      if (value === true) return true;
      if (typeof value === 'number') return value > 0;
      if (value instanceof Date) return true;
      if (typeof value === 'string') {
        const text = value.trim();
        if (!text) return false;
        const numeric = Number(text.replace(',', '.'));
        if (!Number.isNaN(numeric)) return numeric > 0;
        return !['NAO', 'NÃO', 'NO', 'FALSE', 'X', '0'].includes(text.toUpperCase());
      }
      return Boolean(value);
    });
  };

  const getLabelsForDelivery = (d) => {
    if (!d) return defaultDocumentLabels;
    const sentido = String(d.sentido || '').trim().toUpperCase();
    if (sentido === 'ORIGEM') {
      return {
        ...defaultDocumentLabels,
        canhotCTE: itajaiDocumentLabels.canhotCTE,
        canhotNF: itajaiDocumentLabels.canhotNF,
        diarioBordo: itajaiDocumentLabels.diarioBordo,
        inicioDesova: 'Inicio da Ovacao',
        fimDesova: 'Finalizacao da Ovacao',
      };
    }
    return defaultDocumentLabels;
  };

  const removeProgramacaoInfo = (obs) => obs ? obs.replace(/Criada a partir da Programação [A-Z0-9]+/g, '').trim() : '';

  const urlToDataUrl = async (url) => {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const hexToRgb = (hex) => {
    if (!hex) return { r: 88, g: 28, b: 135 };
    const h = String(hex).replace('#', '').trim();
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };

  const formatDT = (v) => v ? formatarData(v, city) : '—';

  const generateDeliveryReceiptPdf = async (delivery) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    if (typeof doc.autoTable !== 'function') {
      try {
        const atModule = await import('jspdf-autotable');
        const atFunc = atModule && (atModule.default || atModule);
        if (typeof atFunc === 'function') atFunc(jsPDF);
      } catch {}
    }

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const pdfMargin = 40;
    const safe = (v) => (v == null || v === '' ? '—' : String(v));

    const normalizeUrl = (u) => {
      if (!u) return u;
      if (u.startsWith('http://') || u.startsWith('https://')) return u;
      if (u.startsWith('//')) return window.location.protocol + u;
      if (u.startsWith('/')) return `${window.location.origin}${u}`;
      return u;
    };

    const cleanLabel = (label) => {
      // Keep only printable ASCII (no emojis, no weird chars)
      return String(label || '').replace(/[^ -]/g, '').trim();
    };

    const dispStatus = delivery.status === 'FINALIZADO' && allModalDocsComplete(delivery)
      ? 'DOCUMENTOS ENTREGUES'
      : delivery.status;

    const cfg = getResolveConfig(dispStatus, city) || getResolveConfig(delivery.status, city);
    const rgb = hexToRgb(cfg?.hex);

    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(0, 0, pageW, 100, 'F'); // Aumentado de 92 para 100 para acomodar logo maior

    const logoDataUrl = await urlToDataUrl('/logo.png');
    if (logoDataUrl) {
      try {
        const imgProps = doc.getImageProperties(logoDataUrl);
        const targetH = 50; // Aumentado de 34 para 50 para destacar mais
        const targetW = (imgProps.width * targetH) / imgProps.height;
        doc.addImage(logoDataUrl, 'PNG', pdfMargin, 21, targetW, targetH); // Ajustado posição Y de 26 para 21
      } catch {}
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('COMPROVANTE DE ENTREGA', pageW - pdfMargin, 42, { align: 'right' }); // Ajustado de 36 para 42

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Gerado em: ${formatarData(new Date(), city)}`, pageW - pdfMargin, 60, { align: 'right' }); // Ajustado de 54 para 60

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Entrega #${delivery.deliveryNumber || '—'}`, pageW - pdfMargin, 80, { align: 'right' }); // Ajustado de 74 para 80

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);

    let y = 130; // Ajustado de 120 para 130 para compensar cabeçalho maior

    // Basic Information
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('INFORMAÇÕES GERAIS', pdfMargin, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    [
      ['Contratado', safe(delivery.userName)],
      ['Motorista', safe(delivery.driverName)],
      ['Placa', safe(delivery.placaIcompany || delivery.vehiclePlate)],
      [getPartyLabelBySentido(filters.sentido), safe(getPartyBySentido(delivery, filters.sentido))],
      ['Status', safe(formatStatus(delivery.status, delivery))],
      ['Agendamento', formatDT(getProgramacaoDate(delivery, city))],
      ['Chegada Porto Montagem', formatDT(delivery.chegadaMontagemAt)],
      ['Montagem Container', formatDT(delivery.containerMontadoAt)],
      ['Chegada', formatDT(delivery.horarioChegada)],
      [`Início ${getDesovaStepLabel(city)}`, formatDT(delivery.horarioInicioDesova)],
      [`Fim ${getDesovaStepLabel(city)}`, formatDT(delivery.horarioFimDesova)],
      ['Saida do Cliente', formatDT(delivery.horarioSaidaCliente)],
      ['Chegada no Porto', formatDT(delivery.horarioChegadaPorto)],
      ['Entrega CNTR Porto', formatDT(delivery.horarioDevolucaoVazio)],
    ].forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, pdfMargin, y);
      y += 16;
    });

    y += 10;

    // Flow History
    const flowHistory = getFlowHistory(delivery);
    if (flowHistory.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('HISTÓRICO DO FLUXO', pdfMargin, y);
      y += 20;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      flowHistory.forEach((ev) => {
        doc.text(`• ${ev.label}: ${formatarData(ev.date, city)}`, pdfMargin, y);
        y += 16;
      });
      y += 10;
    }

    // Documents
    const labels = getLabelsForDelivery(delivery);
    const expectedDocKeys = ['retiradaCheio', ...getFinalDocumentKeysBySentido(delivery.sentido || filters.sentido), 'devolucaoVazio'];
    const hiddenPhotoKeys = ['chegadaMontagem', 'chegadaCliente', 'inicioDesova', 'fimDesova', 'saidaCliente', 'chegadaPorto'];
    const extraDocKeys = Object.keys(delivery.documents || {})
      .filter(k => !hiddenPhotoKeys.includes(k) && !expectedDocKeys.includes(k));
    const docKeys = [...expectedDocKeys, ...extraDocKeys];
    const desovaLabel = getDesovaLabelBySentido(delivery.sentido || filters.sentido);
    const fotoFields = [
      { key: 'chegadaMontagem', label: 'Chegada no Porto para Montagem' },
      { key: 'chegadaCliente', label: 'Chegada no Cliente' },
      { key: 'inicioDesova', label: `Início da ${desovaLabel}` },
      { key: 'fimDesova', label: `Finalização da ${desovaLabel}` },
      { key: 'saidaCliente', label: 'Saida do Cliente' },
      { key: 'chegadaPorto', label: 'Chegada no Porto' }
    ];
    const allDocKeys = [...docKeys, ...fotoFields.map(f => f.key)];

    if (allDocKeys.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('DOCUMENTOS E FOTOS', pdfMargin, y);
      y += 20;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      allDocKeys.forEach((k) => {
        const urls = getDocumentUrlsArray(delivery.documents?.[k]);
        const label = cleanLabel(labels[k] || fotoFields.find(f => f.key === k)?.label || k);

        if (urls.length > 0) {
          doc.text(`${label}:`, pdfMargin, y);
          y += 16;

          urls.forEach((url) => {
            const fullUrl = normalizeUrl(url);
            const urlLines = doc.splitTextToSize(fullUrl, pageW - pdfMargin * 2 - 20);
            doc.text(urlLines, pdfMargin + 10, y);
            y += urlLines.length * 12;
          });
          y += 4;
        } else {
          doc.text(`${label}: Não anexado`, pdfMargin, y);
          y += 16;
        }
      });
    }

    const footerY = pageH - 42;
    doc.setDrawColor(230);
    doc.line(pdfMargin, footerY - 14, pageW - pdfMargin, footerY - 14);
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text('Este comprovante foi gerado automaticamente pela Torre de Controle.', pdfMargin, footerY);
    doc.text(`ID interno: ${delivery._id || '—'} • Criado em: ${formatDT(delivery.createdAt)}`, pdfMargin, footerY + 14);

    const fileName = `Comprovante_Entrega_${delivery.deliveryNumber || delivery._id || 'sem_numero'}.pdf`;
    const blob = doc.output('blob');
    return { blob, fileName };
  };

  const loadDeliveries = useCallback(async () => {
    try {
      setLoading(true);

      let backendFilters = { ...filters };
      const selectedStatuses = getSelectedStatuses();
      if (selectedStatuses.length === 1 && selectedStatuses[0] === 'CANCELADO') {
        backendFilters.status = 'CANCELADO';
      } else {
        delete backendFilters.status;
      }

      let periodDate = '';
      if (statsPeriod && statsPeriod !== 'general') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (statsPeriod === 'yesterday') today.setDate(today.getDate() - 1);
        if (statsPeriod === 'tomorrow') today.setDate(today.getDate() + 1);
        periodDate = today.toLocaleDateString('pt-BR');
      }

      // Backend ja devolve entregas e programacoes combinadas.
      const delivRes = await adminService.getDeliveries(backendFilters, statsPeriod, periodDate);
      const enrichedDeliveries = delivRes?.data?.deliveries || [];
      const normalized = enrichedDeliveries.map((d) => {
        if (d.status === 'ENTREGUE_COM_PENDENCIA_CANHOTO') d.status = 'FINALIZADO';
        return d;
      });

      // DEBUG: log entrega de amostra e verificar city
      const sampleDelivery = normalized[0];
      if (sampleDelivery) {
        // eslint-disable-next-line no-console
        console.log('DEBUG Sample Delivery (1a):', { 
          deliveryNumber: sampleDelivery.deliveryNumber,
          city: sampleDelivery.city,
          documents: Object.keys(sampleDelivery.documents || {})
        });
      }
      // Enriquecer com city do contexto se não houver
      const enrichedWithCity = normalized.map(d => ({
        ...d,
        city: d.city || city // Adiciona city do contexto se não tiver
      }));
      setDeliveries(enrichedWithCity);

      const sc = {};
      normalized.forEach((d) => {
        const s = normalizeKey(d.status) || 'UNKNOWN';
        sc[s] = (sc[s] || 0) + 1;
      });

      const drivers = new Set(normalized.map((d) => d.driverName).filter(Boolean));
      setStats({ total: normalized.length, statusCounts: sc, byDriver: drivers.size });
      setToast(null);
    } catch (err) {
      if (err?.response?.status === 401) {
        setToast({ message: 'Sessão expirada. Faça login novamente.', type: 'error' });
        setTimeout(() => { window.location.href = '/login'; }, 1200);
      } else {
        setToast({ message: 'Erro ao carregar entregas.', type: 'error' });
        setTimeout(() => setToast(null), 5000);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, statsPeriod, city]);

  useEffect(() => {
    setSelectedDelivery(null);
  }, [city]);

  // Carregar dados da Icompany para comparações
  const loadIcompanyData = useCallback(async () => {
    try {
      const response = await adminService.getIcompanyData();
      if (response.data?.success) {
        setIcompanyData(response.data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados Icompany:', error);
    }
  }, []);

  const findIcompanyInCache = useCallback((delivery) => {
    if (!delivery || !icompanyData.length) return null;

    const getClean = (value) => {
      if (value === null || value === undefined) return '';
      return value.toString().replace(/^#/, '').trim().toUpperCase();
    };

    const targets = [
      delivery.processoCAB,
      delivery.processo,
      delivery.codigo,
      delivery.processoLog,
      delivery.deliveryNumber,
      delivery.container,
      Array.isArray(delivery.containerNumero) ? delivery.containerNumero[0] : delivery.containerNumero
    ].map(getClean).filter(Boolean);
    if (!targets.length) return null;

    const keys = ['geomaritima', 'processo', 'codigo', 'nrProcesso', 'numero', 'NUMERO', 'NÚMERO', 'container', 'containerNumero'];

    const expectedParty = getClean(getPartyBySentido(delivery, delivery.sentido || filters.sentido));
    const expectedSentido = getClean(delivery.sentido || filters.sentido);

    const candidates = icompanyData.filter((record) => {
      return keys.some((k) => {
        const val = getClean(record[k]);
        return val && targets.includes(val);
      });
    });

    if (!candidates.length) return null;
    return candidates
      .map((record) => {
        let score = 0;
        if (getClean(record.nrProcesso || record['Nr. do processo'] || record['Nr do processo']) && targets.includes(getClean(record.nrProcesso || record['Nr. do processo'] || record['Nr do processo']))) score += 40;
        if (getClean(record.processo) && targets.includes(getClean(record.processo))) score += 25;
        if (getClean(record.codigo) && targets.includes(getClean(record.codigo))) score += 20;
        if (expectedSentido && getClean(record.sentido || record.SENTIDO) === expectedSentido) score += 20;
        if (expectedParty && getClean(getPartyBySentido(record, expectedSentido || record.sentido || record.SENTIDO)) === expectedParty) score += 20;
        if (getClean(record.numero || record.NUMERO || record['NÚMERO'] || record.containerNumero) && targets.includes(getClean(record.numero || record.NUMERO || record['NÚMERO'] || record.containerNumero))) score += 5;
        return { record, score };
      })
      .sort((a, b) => b.score - a.score)[0].record;
  }, [icompanyData, filters.sentido]);

  // Função para comparar dados do delivery com Icompany
  const compareWithIcompany = useCallback((delivery, icompanyMatch) => {
    if (!delivery) return {};

    let recordToUse = icompanyMatch || findIcompanyInCache(delivery);
    if (!recordToUse) {
      return { __notFound: true, mensagem: `Nenhum registro iCompany encontrado para ${delivery.deliveryNumber || delivery.processo || delivery.codigo || 'N/D'}` };
    }

    const getClienteBySentido = (record) => {
      const sentidoValue = String(record?.sentido || record?.SENTIDO || '').trim().toUpperCase();
      const remetenteValue = String(record?.remetente || '').trim();
      const destinatarioValue = String(record?.destinatario || record?.recebedor || '').trim();
      if (sentidoValue === 'ORIGEM') return remetenteValue || destinatarioValue;
      if (sentidoValue === 'DESTINO') return destinatarioValue || remetenteValue;
      return destinatarioValue || remetenteValue;
    };

    const sentidoComparacao = String(delivery.sentido || recordToUse.sentido || recordToUse.SENTIDO || filters.sentido || 'DESTINO').trim().toUpperCase();
    const partyLabel = getPartyLabelBySentido(sentidoComparacao);
    const origemMapping = {
      'Contratado': { deliveryField: 'userName', icompanyField: 'contratado' },
      'Agendamento': { deliveryField: 'dataAgendamento', icompanyField: 'dtColeta' },
      [partyLabel]: { deliveryField: 'recebedor', icompanyField: 'clientePorSentido' },
      'Montagem Container': { deliveryField: 'containerMontadoAt', icompanyField: 'dtRetiraPD' },
      'Chegada': { deliveryField: 'horarioChegada', icompanyField: 'dtChegadaPlanta' },
      'Saindo do Cliente': { deliveryField: 'horarioSaidaCliente', icompanyField: 'dtSaidaPlanta' },
      [`Início ${getDesovaStepLabel(city)}`]: { deliveryField: 'horarioInicioDesova', icompanyField: 'dtInicioCarregamento' },
      [`Fim ${getDesovaStepLabel(city)}`]: { deliveryField: 'horarioFimDesova', icompanyField: 'dtFimCarregamento' },
      'Entrega CNTR Porto': { deliveryField: 'horarioDevolucaoVazio', icompanyField: 'dtFimAgendamento' }
    };
    const destinoMapping = {
      'Contratado': { deliveryField: 'userName', icompanyField: 'contratado' },
      'Agendamento': { deliveryField: 'dataAgendamento', icompanyField: 'dtAgendamentoDescarga' },
      [partyLabel]: { deliveryField: 'recebedor', icompanyField: 'clientePorSentido' },
      'Montagem Container': { deliveryField: 'containerMontadoAt', icompanyField: 'dtRetiraPD' },
      'Chegada': { deliveryField: 'horarioChegada', icompanyField: 'dtInicioDescarga' },
      'Saindo do Cliente': { deliveryField: 'horarioSaidaCliente', icompanyField: 'dtFimDescarga' }
    };
    const fieldMapping = sentidoComparacao === 'ORIGEM' ? origemMapping : destinoMapping;

    // Procurar registro correspondente na Icompany
    const normalizeRecordKey = (value) => {
      if (!value && value !== 0) return '';
      const str = value.toString();
      return str.replace(/^#/, '').trim().toUpperCase();
    };

    const processoKeys = [
      delivery.processoCAB,
      delivery.processo,
      delivery.codigo,
      delivery.processoLog,
      delivery.deliveryNumber,
      delivery.container,
      Array.isArray(delivery.containerNumero) ? delivery.containerNumero[0] : delivery.containerNumero
    ].map(normalizeRecordKey).filter(Boolean);

    const lookupKeys = ['geomaritima', 'processo', 'codigo', 'nrProcesso', 'numero', 'NUMERO', 'NÚMERO', 'container', 'containerNumero'];
    const icompanyRecord = recordToUse || icompanyData.find((record) => {
      return lookupKeys.some((key) => {
        const v = normalizeRecordKey(record[key]);
        return v && processoKeys.includes(v);
      });
    });


    if (!icompanyRecord) {
      // DEBUG: não encontrado; pode ser que esteja em outro formato no iCompany
      console.debug('[Icompany compare] no match for', { deliveryKeys: processoKeys, rowCount: icompanyData.length });
      return { __notFound: true, mensagem: `Nenhum registro iCompany encontrado para ${processoKeys[0] || 'N/D'}` };
    }

    const comparisons = {};

    const parseDateValue = (val) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    };

    const normalizeValue = (val) => {
      if (val === null || val === undefined || val === '') return '';
      const date = parseDateValue(val);
      if (date) return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
      return val.toString().trim().toUpperCase();
    };

    const formatDisplay = (val) => {
      if (val === null || val === undefined || val === '') return '—';
      const date = parseDateValue(val);
      if (date) return formatarData(date, city);
      return val.toString();
    };

    const compareDateOnly = (a, b) => {
      const da = parseDateValue(a);
      const db = parseDateValue(b);
      if (!da || !db) return false;
      return da.getFullYear() === db.getFullYear()
        && da.getMonth() === db.getMonth()
        && da.getDate() === db.getDate();
    };

    Object.entries(fieldMapping).forEach(([displayName, mapping]) => {
      const deliveryValue = mapping.icompanyField === 'clientePorSentido'
        ? getPartyBySentido(delivery, sentidoComparacao)
        : delivery[mapping.deliveryField];
      const icompanyValue = mapping.icompanyField === 'clientePorSentido'
        ? getClienteBySentido(icompanyRecord)
        : icompanyRecord[mapping.icompanyField];

      const normalizedDelivery = normalizeValue(deliveryValue);
      const normalizedIcompany = normalizeValue(icompanyValue);

      let isInconsistent = false;
      if (displayName === 'Montagem Container' || displayName === 'Entrega CNTR Porto') {
        isInconsistent = !compareDateOnly(deliveryValue, icompanyValue) && (deliveryValue || icompanyValue);
      } else {
        isInconsistent = normalizedDelivery !== normalizedIcompany && (normalizedDelivery || normalizedIcompany);
      }

      comparisons[displayName] = {
        deliveryValue,
        icompanyValue,
        isInconsistent,
        displayDelivery: formatDisplay(deliveryValue),
        displayIcompany: formatDisplay(icompanyValue)
      };
    });

    return comparisons;
  }, [icompanyData, city, filters.sentido]);

  const getIcompanyDocumentsMismatchCount = (delivery) => {
    if (!delivery) return 0;
    if (!icompanyData.length) return 0;

    const icompanyRecord = findIcompanyInCache(delivery);
    const docMap = getIcompanyDocumentMap(delivery.sentido || filters.sentido);

    return Object.keys(delivery.documents || {})
      .filter((key) => !['chegadaCliente', 'inicioDesova', 'fimDesova'].includes(key))
      .reduce((count, deliveryKey) => {
        const deliveryPresent = !!delivery.documents?.[deliveryKey];
        const icompanyFields = docMap[deliveryKey] || [];
        const icompanyPresent = isIcompanyDocumentPresent(icompanyRecord, icompanyFields);
        return count + (deliveryPresent && icompanyFields.length > 0 && !icompanyPresent ? 1 : 0);
    }, 0);
  };

  const getDocsComparisonSummary = (delivery) => {
    const icompanyResult = compareWithIcompany(delivery);
    const icompanyMismatchCount = icompanyData.length === 0
      ? 0
      : icompanyResult.__notFound
        ? 1
        : Object.values(icompanyResult).filter((item) => item.isInconsistent).length;
    const documentMismatchCount = getIcompanyDocumentsMismatchCount(delivery);

    return {
      total: icompanyMismatchCount + documentMismatchCount,
      icompanyMismatchCount,
      documentMismatchCount
    };
  };

  useEffect(() => {
    loadDeliveries();
    loadIcompanyData(); // Carregar dados da Icompany na inicialização
    if (autoRefresh) {
      const t = setInterval(() => {
        // eslint-disable-next-line no-console
        console.log('DEBUG autoRefresh triggered, filters:', filters);
        loadDeliveries();
      }, refreshInterval * 1000);
      return () => clearInterval(t);
    }
  }, [loadDeliveries, loadIcompanyData, autoRefresh, refreshInterval, city]);

  useEffect(() => {
    if (!selectedDelivery) {
      setIcompanyRemoteRecord(null);
      setIcompanyLookupStatus('idle');
      lastIcompanyQueryRef.current = '';
      return;
    }

    const local = findIcompanyInCache(selectedDelivery);
    if (local) {
      setIcompanyRemoteRecord(local);
      setIcompanyLookupStatus('found');
      lastIcompanyQueryRef.current = '';
      return;
    }

    const query = (selectedDelivery.codigo || selectedDelivery.processoCAB || selectedDelivery.deliveryNumber || selectedDelivery.processo || '').toString().replace(/^#/, '').trim();
    if (!query) {
      setIcompanyRemoteRecord(null);
      setIcompanyLookupStatus('notfound');
      lastIcompanyQueryRef.current = '';
      return;
    }

    if (query === lastIcompanyQueryRef.current && icompanyLookupStatus !== 'idle') {
      return;
    }

    lastIcompanyQueryRef.current = query;
    setIcompanyLookupStatus('searching');
    adminService.searchIcompanyByProcess(query)
      .then((res) => {
        const isOk = res.data?.success || res.data?.ok;
        if (isOk && res.data.data?.length > 0) {
          setIcompanyRemoteRecord(res.data.data[0]);
          setIcompanyLookupStatus('found');
        } else {
          setIcompanyRemoteRecord(null);
          setIcompanyLookupStatus('notfound');
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar Icompany via endpoint search:', err);
        setIcompanyRemoteRecord(null);
        setIcompanyLookupStatus('error');
      });
  }, [selectedDelivery, findIcompanyInCache, icompanyLookupStatus]);

  useEffect(() => {
    if (!ENABLE_CONTROLE_PROTOCOLOS_LOOKUP) {
      setControleProtocolosRecord(null);
      setControleProtocolosLookupStatus('idle');
      lastControleProtocolosQueryRef.current = '';
      return;
    }

    if (!selectedDelivery) {
      setControleProtocolosRecord(null);
      setControleProtocolosLookupStatus('idle');
      lastControleProtocolosQueryRef.current = '';
      return;
    }

    const modalCodigo = (icompanyRemoteRecord?.codigo || findIcompanyInCache(selectedDelivery)?.codigo || selectedDelivery.codigo || selectedDelivery.processoCAB || selectedDelivery.processo || '').toString().replace(/^#/, '').trim();
    if (!modalCodigo) {
      setControleProtocolosRecord(null);
      setControleProtocolosLookupStatus('notfound');
      lastControleProtocolosQueryRef.current = '';
      return;
    }

    if (modalCodigo === lastControleProtocolosQueryRef.current && controleProtocolosLookupStatus !== 'idle') {
      return;
    }

    lastControleProtocolosQueryRef.current = modalCodigo;
    setControleProtocolosLookupStatus('searching');
    adminService.getControleProtocolos(modalCodigo)
      .then((res) => {
        const records = res.data?.data || [];
        if (records.length > 0) {
          const exactMatch = records.find((record) => {
            const proc = (record.processo || '').toString().replace(/^#/, '').trim().toUpperCase();
            return proc === modalCodigo.toUpperCase();
          });
          setControleProtocolosRecord(exactMatch || records[0]);
          setControleProtocolosLookupStatus('found');
        } else {
          setControleProtocolosRecord(null);
          setControleProtocolosLookupStatus('notfound');
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar controle de protocolos:', err);
        setControleProtocolosRecord(null);
        setControleProtocolosLookupStatus('error');
      });
  }, [selectedDelivery, icompanyRemoteRecord, findIcompanyInCache, controleProtocolosLookupStatus]);

  useEffect(() => {
    let r = [...deliveries];
    const selectedStatuses = getSelectedStatuses();

    if (selectedStatuses.length > 0) {
      r = r.filter((delivery) => matchesStatusFilter(delivery, selectedStatuses));
    }

    // Busca adicional por campos que o backend não filtra
    if (filters.searchTerm.trim()) {
      const q = filters.searchTerm.toLowerCase();
      r = r.filter((d) =>
        [
          d.processoCAB,
          d.processo,
          d.containerNumero,
          d.container,
          d.processNumber
        ]
          .some((v) => String(v || '').toLowerCase().includes(q))
      );
    }

    setFilteredDeliveries(r);
  }, [deliveries, filters, statsPeriod]);

  useEffect(() => {
    if (filteredDeliveries.length === 0) return;

    const capturedPositions = {};
    filteredDeliveries.forEach((d) => {
      const el = rowRefs.current[d._id];
      if (el) capturedPositions[d._id] = el.getBoundingClientRect().top;
    });

    const updates = {};
    filteredDeliveries.forEach((d) => {
      const prev = prevStatusRef.current[d._id];
      if (prev !== undefined && prev !== d.status) {
        // Usa um contador incremental para garantir ordenação determinística
        updates[d._id] = updateCounter + Object.keys(updates).length + 1;
        // eslint-disable-next-line no-console
        console.log('DEBUG status changed:', {
          id: d._id,
          processo: d.processoCAB,
          from: prev,
          to: d.status,
          ordem: updates[d._id]
        });
      }
      prevStatusRef.current[d._id] = d.status;
    });

    if (Object.keys(updates).length > 0) {
      prevPositions.current = capturedPositions;
      // Incrementa o contador para próximas atualizações
      setUpdateCounter((prev) => prev + Object.keys(updates).length);
      setRecentlyUpdated((prev) => {
        const next = { ...prev, ...updates };
        // eslint-disable-next-line no-console
        console.log('DEBUG recentlyUpdated state:', next);
        return next;
      });
      
      // Remove apenas a animação visual após RISE_WINDOW, mas mantém no topo via recentlyUpdated
      // setTimeout(() => {
      //   setRecentlyUpdated((prev) => {
      //     const next = { ...prev };
      //     Object.keys(updates).forEach((id) => delete next[id]);
      //     return next;
      //   });
      // }, RISE_WINDOW + 500);
    }
  }, [filteredDeliveries, sortConfig, city, statsPeriod, recentlyUpdated]);

  const displayList = useMemo(() => {
    let sorted = [...filteredDeliveries];
    if (sortConfig.column) {
      sorted = sorted.sort((a, b) => {
        let aVal, bVal;

        switch (sortConfig.column) {
          case 'processo':
            aVal = (a.processoCAB || '').toLowerCase();
            bVal = (b.processoCAB || '').toLowerCase();
            break;
          case 'container':
            aVal = (getDisplayContainer(a) || '').toLowerCase();
            bVal = (getDisplayContainer(b) || '').toLowerCase();
            break;
          case 'recebedor':
            aVal = getPartyBySentido(a, filters.sentido).toLowerCase();
            bVal = getPartyBySentido(b, filters.sentido).toLowerCase();
            break;
          case 'status':
            aVal = (a.status || '').toLowerCase();
            bVal = (b.status || '').toLowerCase();
            break;
          case 'horaStatus':
            aVal = new Date(getStatusEntryTime(a, city) || 0).getTime();
            bVal = new Date(getStatusEntryTime(b, city) || 0).getTime();
            break;
          case 'tempoStatus':
            aVal = a.tempoStatusMinutos || 0;
            bVal = b.tempoStatusMinutos || 0;
            break;
          case 'agendamento':
            aVal = new Date(getProgramacaoDate(a, city) || 0).getTime();
            bVal = new Date(getProgramacaoDate(b, city) || 0).getTime();
            break;
          case 'pontualidade':
            aVal = (a.pontualidade || '').toLowerCase();
            bVal = (b.pontualidade || '').toLowerCase();
            break;
          default:
            return 0;
        }

        // Compare
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const cmp = aVal.localeCompare(bVal);
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        }
        const cmp = aVal - bVal;
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
    } else if (statsPeriod === 'general') {
      // Default sort for "Geral": HORA STATUS (descendente)
      sorted = sorted.sort((a, b) => {
        const aTime = getStatusEntryTime(a, city);
        const bTime = getStatusEntryTime(b, city);
        
        // Converter para timestamp para comparação
        const aTs = aTime ? new Date(aTime).getTime() : 0;
        const bTs = bTime ? new Date(bTime).getTime() : 0;
        
        // Ordenar descendente (maior para menor)
        return bTs - aTs;
      });

      return sorted;
    } else {
      // Para outros períodos, ordena por atualização
      sorted = sorted.sort((a, b) => {
        const aT = recentlyUpdated[a._id];
        const bT = recentlyUpdated[b._id];
        
        if (aT && bT) {
          return bT - aT;
        }
        
        if (aT && !bT) return -1;
        if (!aT && bT) return 1;
        
        return 0;
      });
    }

    return sorted;
  }, [filteredDeliveries, sortConfig, recentlyUpdated, statsPeriod, city, filters.sentido]);

  useLayoutEffect(() => {
    if (!prevPositions.current || Object.keys(prevPositions.current).length === 0) return;
    displayList.forEach((d) => {
      const el = rowRefs.current[d._id];
      if (!el) return;
      const oldTop = prevPositions.current[d._id];
      if (oldTop === undefined) return;
      const newTop = el.getBoundingClientRect().top;
      const delta = oldTop - newTop;
      if (Math.abs(delta) < 2) return;
      el.style.setProperty('--rise-from', `${delta}px`);
    });
    prevPositions.current = {};
  }, [displayList]);

  const handleDownload = async (id, type, label) => {
    try {
      const delivery = deliveries.find((d) => d._id === id);
      const docEntry = delivery?.documents?.[type];
      if (docEntry) {
        const urls = getDocumentUrlsArray(docEntry);
        if (urls.length > 0) {
          urls.forEach((url, i) => {
            const a = document.createElement('a');
            a.href = url;
            a.setAttribute('download', `${delivery.deliveryNumber || 'doc'}_${label || type}_${i + 1}`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          });
          setToast({ message: 'Documento(s) baixado(s)', type: 'success' });
          return;
        }
      }

      const res = await adminService.downloadDocument(id, type);
      const contentType = res.headers?.['content-type'] || '';
      const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : contentType.includes('png') ? 'png' : 'bin';
      const blob = new Blob([res.data], { type: contentType || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `${deliveries.find((d) => d._id === id)?.deliveryNumber || 'doc'}_${label || type}.${ext}`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `${deliveries.find((d) => d._id === id)?.deliveryNumber || 'documents'}.zip`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setToast({ message: 'ZIP baixado', type: 'success' });
    } catch (e) {
      setToast({ message: 'Erro ao baixar ZIP: ' + (e.response?.data?.message || e.message), type: 'error' });
    }
  };

  const handleShareDelivery = async () => {
    if (!selectedDelivery) return;
    try {
      setToast({ type: 'success', message: 'Gerando comprovante…' });
      const { blob, fileName } = await generateDeliveryReceiptPdf(selectedDelivery);

      // Download direto do PDF
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', fileName);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setToast({
        type: 'success',
        message: 'Comprovante baixado com sucesso!'
      });
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setToast({ type: 'error', message: 'Falha ao gerar comprovante: ' + (err?.message || 'erro desconhecido') });
      setTimeout(() => setToast(null), 4500);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deletar esta entrega? Ação irreversível.')) return;
    try {
      await adminService.deleteDelivery(id);
      setToast({ message: 'Entrega deletada', type: 'success' });
      setSelectedDelivery(null);
      loadDeliveries();
    } catch {
      setToast({ message: 'Erro ao deletar', type: 'error' });
    }
  };

  const handleRemoveDocument = async (deliveryId, documentType) => {
    if (!window.confirm('Remover este documento e marcá-lo como pendência para correção?')) return;
    try {
      setToast({ message: 'Removendo documento...', type: 'info' });
      const res = await adminService.removeInvalidDocument(deliveryId, documentType, 'Documento inválido removido pelo ADM');
      const updatedDelivery = res.data.delivery;
      setSelectedDelivery(updatedDelivery);
      setToast({ message: 'Documento removido e pendência registrada', type: 'success' });
      loadDeliveries();
    } catch (err) {
      setToast({ message: err.response?.data?.message || err.message || 'Erro ao remover documento', type: 'error' });
    }
  };

  const handleEditStart = (d) => {
    // Libera edição para geomar

    // Some data sources may not include an _id field; try fallback to deliveryNumber/id.
    const editId = d._id || d.id || d.deliveryNumber;
    setEditingDelivery(editId);
    setEditForm({
      deliveryNumber: d.deliveryNumber || '',
      userName: d.userName || '',
      driverName: d.driverName || '',
      vehiclePlate: d.vehiclePlate || '',
      recebedor: d.recebedor || '',
      status: d.status || '',
      dataAgendamento: getProgramacaoDate(d, city)?.slice(0, 16) || d.dataAgendamento?.slice(0, 16) || '',
      horarioDevolucaoVazio: d.horarioDevolucaoVazio?.slice(0, 16) || '',
      horarioChegada: d.horarioChegada?.slice(0, 16) || '',
      horarioInicioDesova: d.horarioInicioDesova?.slice(0, 16) || '',
      horarioFimDesova: d.horarioFimDesova?.slice(0, 16) || '',
      horarioSaidaCliente: d.horarioSaidaCliente?.slice(0, 16) || '',
      horarioChegadaPorto: d.horarioChegadaPorto?.slice(0, 16) || '',
      observations: removeProgramacaoInfo(d.observations)
    });
  };

  const handleEditSave = async () => {
    if (!editForm.observations?.trim()) {
      setToast({ message: 'Motivo da edição obrigatório', type: 'error' });
      return;
    }

    const motivo = editForm.observations.replace(/Criada a partir da Programação [A-Z0-9]+/g, '').trim();
    const prog = (editForm.observations.match(/Criada a partir da Programação [A-Z0-9]+/) || []).join(' ');

    const payload = {
      ...editForm,
      observations: prog ? `${motivo}\n${prog}` : motivo,
      editedBy: user?.name || user?.username || user?.email || 'Desconhecido',
      editedAt: new Date().toISOString()
    };

    const deliveryId = editingDelivery || selectedDelivery?._id || selectedDelivery?.deliveryNumber;
    if (!deliveryId) {
      setToast({ message: 'ID da entrega inválido para atualização', type: 'error' });
      return;
    }

    try {
      await adminService.updateDelivery(deliveryId, payload);
      setToast({ message: 'Entrega atualizada', type: 'success' });
      setEditingDelivery(null);
      if (selectedDelivery && (selectedDelivery._id === deliveryId || selectedDelivery.deliveryNumber === deliveryId)) {
        setSelectedDelivery({ ...selectedDelivery, ...editForm });
      }
      loadDeliveries();
    } catch (err) {
      const serverMessage = err?.response?.data?.message;
      const status = err?.response?.status;
      setToast({
        message: serverMessage
          ? `Erro ao atualizar: ${serverMessage}`
          : status === 404
            ? 'Entrega não encontrada (404) ao tentar atualizar.'
            : 'Erro ao atualizar',
        type: 'error'
      });
    }
  };

  const activeFilterCount = [
    getSelectedStatuses().length > 0,
    !!filters.searchTerm,
    !!filters.startDate,
    !!filters.endDate
  ].filter(Boolean).length;

  const HEADER_CONFIGS = [
    { key: 'processo', name: 'Processo', type: 'text', placeholder: 'Buscar processo...', sortable: true },
    { key: 'container', name: 'Container', type: 'text', placeholder: 'Buscar container...', sortable: true },
    { key: 'recebedor', name: getPartyLabelBySentido(filters.sentido), type: 'text', placeholder: `Buscar ${getPartyLabelBySentido(filters.sentido).toLowerCase()}...`, sortable: true },
    { key: 'status', name: 'Status', type: 'multiSelect', options: getStatusOptions().filter((option) => option.value !== 'all'), sortable: true },
    { key: 'horaStatus', name: 'Hora Status', type: 'dateRange', startKey: 'horaStatusFrom', endKey: 'horaStatusTo', sortable: true },
    { key: 'tempoStatus', name: 'Tempo Status', type: 'range', minKey: 'tempoStatusMin', maxKey: 'tempoStatusMax', sortable: true },
    { key: 'progresso', name: 'Progresso', type: 'none', sortable: false },
    { key: 'agendamento', name: 'Agendamento', type: 'dateRange', startKey: 'startDate', endKey: 'endDate', sortable: true },
    { key: 'pontualidade', name: 'Pontualidade', type: 'select', options: punctualityOptions, sortable: true },
    { key: 'check', name: 'Check', type: 'none', sortable: false },
    { key: 'detalhes', name: 'Detalhes', type: 'none', sortable: false }
  ];

  return (
    <div
      style={{ backgroundColor: themeConfig.bg, color: themeConfig.text }}
      className={`min-h-screen font-sans transition-colors duration-300 theme-${theme}`}
    >
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        refreshInterval={refreshInterval}
        setRefreshInterval={setRefreshInterval}
        filters={filters}
        setFilters={setFilters}
      />

      <header className={`sticky top-0 z-40 ${themeConfig.header} backdrop-blur-md border-b ${themeConfig.border}`}>
        <div className="w-full px-4 lg:px-8 h-16 flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white transition flex-shrink-0"
          >
            <FaArrowLeft className="text-purple-400" />
            <span className="hidden sm:inline">Voltar</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
              <MdDashboard className="text-white text-base" />
            </div>
            <h1 className="text-xs sm:text-base md:text-lg font-black tracking-[0.1em] sm:tracking-[0.15em] uppercase truncate" style={{ color: themeConfig.text }}>
              Torre de Controle
            </h1>
          </div>

            {allowCitySwitcher && (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="uppercase tracking-[0.2em] text-gray-400">Cidade</span>
                <button
                  type="button"
                  onClick={() => setCity('manaus')}
                  className={`rounded-xl px-3 py-1 font-semibold transition ${city === 'manaus' ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
                >
                  Manaus
                </button>
                <button
                  type="button"
                  onClick={() => setCity('itajai')}
                  className={`rounded-xl px-3 py-1 font-semibold transition ${city === 'itajai' ? 'bg-emerald-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
                >
                  Itajaí
                </button>
              </div>
            )}

          <div className="flex-1" />

          <span className="hidden lg:flex items-center gap-1.5 text-sm font-mono font-semibold text-gray-400 tabular-nums">
            <FaClock className="text-purple-400" size={12} />
            {formatarHora(currentTime, city)}
          </span>

          {autoRefresh && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE · {refreshInterval}s
            </span>
          )}

          <button
            onClick={toggleFullscreen}
            title="Fullscreen (Ctrl+Shift+F)"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:bg-white/10 text-gray-400 hover:text-white"
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

          <button
            onClick={() => setSettingsOpen((v) => !v)}
            title="Configurações, Filtros & Tema"
            className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition ${settingsOpen ? 'bg-purple-600 text-white' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`}
          >
            <FaCog size={15} className={settingsOpen ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="w-full px-3 sm:px-4 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill active={statsPeriod === 'general'} onClick={() => setStatsPeriod('general')} color="indigo">
            <MdDashboard className="text-xs" /> <span>Geral</span>
          </Pill>

          <Pill active={statsPeriod === 'yesterday'} onClick={() => setStatsPeriod('yesterday')} color="gray">
            <FaCalendarAlt className="text-xs" /> <span>Ontem</span>
          </Pill>

          <Pill active={statsPeriod === 'today'} onClick={() => setStatsPeriod('today')} color="purple">
            <FaClock className="text-xs" /> Hoje
          </Pill>

          <Pill active={statsPeriod === 'tomorrow'} onClick={() => setStatsPeriod('tomorrow')} color="blue">
            <FaCalendarAlt className="text-xs" /> <span>Amanhã</span>
          </Pill>

          <div className="h-7 w-px bg-white/10 mx-1" />

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <span className="uppercase tracking-[0.2em] text-gray-400">Sentido</span>
            <button
              type="button"
              onClick={() => setFilters({ ...filters, sentido: 'ORIGEM' })}
              className={`rounded-xl px-3 py-1 font-semibold transition ${filters.sentido === 'ORIGEM' ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
            >
              Origem
            </button>
            <button
              type="button"
              onClick={() => setFilters({ ...filters, sentido: 'DESTINO' })}
              className={`rounded-xl px-3 py-1 font-semibold transition ${filters.sentido === 'DESTINO' ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
            >
              Destino
            </button>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold transition hover:bg-amber-500/25"
            >
              <FaFilter size={10} />
              {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}
            </button>
          )}

          <div className="ml-auto text-xs text-gray-500 font-semibold">
            {filteredDeliveries.length} / {stats.total}
          </div>
        </div>

        {/* KANBAN NO LUGAR DOS CARDS */}
        <div>
          <SectionTitle sub="Acompanhe o andamento de cada entrega em tempo real através de cada etapa do processo">
            Fluxo de Entregas
          </SectionTitle>

          <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-purple-400 scrollbar-track-gray-200 w-full">
            <div className="flex gap-2 w-full">
              {getStatusColumns(city).map((column) => (
                <DeliveryKanbanColumn
                  key={column.key}
                  column={column}
                  deliveries={displayList.filter(column.filter)}
                  onOpen={setSelectedDelivery}
                  currentTime={currentTime}
                  city={city}
                  sentido={filters.sentido}
                />
              ))}
            </div>
          </div>
        </div>

        {displayList.length === 0 ? (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-12 sm:p-16 text-center">
            <MdLocalShipping className="mx-auto text-5xl text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg font-semibold">Nenhuma entrega encontrada</p>
            <p className="text-gray-600 text-sm mt-1">Ajuste os filtros ou período nas configurações</p>
          </div>
        ) : (
          <div>
            <SectionTitle>
              Monitor Tático
            </SectionTitle>

            <div className="md:hidden space-y-3">
              {displayList.map((d) => (
                <MobileDeliveryCard
                  key={d._id}
                  d={d}
                  currentTime={currentTime}
                  allModalDocsComplete={allModalDocsComplete}
                  getDocumentsStatus={getDocumentsStatus}
                  getPunctualityStatus={getPunctualityStatus}
                  recentlyUpdated={recentlyUpdated}
                  RISE_WINDOW={RISE_WINDOW}
                  setSelectedDelivery={setSelectedDelivery}
                  city={city}
                  sentido={filters.sentido}
                />
              ))}
            </div>

            <div className="hidden md:block rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-black/20">
              <div className="overflow-x-auto">
                <div style={{ width: '100%' }} className="monitor-table min-w-full">
                  <div
                    ref={filterHeaderRef}
                    className="grid text-[11px] font-bold uppercase tracking-wider bg-white/[0.04] border-b border-white/10"
                    style={{ gridTemplateColumns: colTemplate, color: themeConfig.textSecondary }}
                  >
                    {HEADER_CONFIGS.map((col, ci) => (
                      <div
                        key={col.key}
                        className={`${ci >= 6 ? 'px-2 py-3.5' : 'px-4 py-3.5'} relative flex items-center min-w-0 select-none ${ci >= 2 ? 'justify-center' : ''}`}
                        style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenFilterKey((current) => current === col.key ? null : col.key)}
                          className="inline-flex items-center gap-2 text-left text-[11px] font-bold uppercase tracking-wider"
                        >
                          <span>{col.name}</span>
                          {col.sortable && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSort(col.key);
                              }}
                              className="p-0.5 rounded hover:bg-white/10 transition"
                              title="Ordenar A-Z/Z-A"
                            >
                              {sortConfig.column === col.key ? (
                                sortConfig.direction === 'asc' ? (
                                  <FaSortUp className="text-xs text-emerald-400" />
                                ) : (
                                  <FaSortDown className="text-xs text-emerald-400" />
                                )
                              ) : (
                                <FaSort className="text-xs text-gray-400 hover:text-white" />
                              )}
                            </button>
                          )}
                          {col.type !== 'none' && (
                            <FaFilter
                              className={`text-xs transition-colors duration-200 ${isFilterActive(col.key) ? 'text-emerald-300' : 'text-gray-400 hover:text-white'}`}
                            />
                          )}
                        </button>

                        {openFilterKey === col.key && col.type !== 'none' && (
                          <div className="absolute top-full left-0 z-50 mt-1 min-w-[220px] max-w-[320px] rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl">
                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 mb-2">
                              <span className="text-xs font-semibold text-white">Filtro de {col.name}</span>
                              <button
                                type="button"
                                onClick={() => clearColumnFilter(col.key)}
                                className="text-xs text-gray-400 hover:text-white"
                              >
                                Limpar
                              </button>
                            </div>

                            {col.type === 'text' && (
                              <input
                                type="text"
                                placeholder={col.placeholder}
                                value={filters[col.key]}
                                onChange={(e) => setFilters({ ...filters, [col.key]: e.target.value })}
                                className={`${inputCls} w-full text-xs`}
                              />
                            )}

                            {col.type === 'select' && (
                              <select
                                value={filters[col.key]}
                                onChange={(e) => setFilters({ ...filters, [col.key]: e.target.value })}
                                className={`${inputCls} w-full text-xs`}
                              >
                                {(col.options || []).map((option) => (
                                  <option key={option.value} value={option.value} className="bg-slate-950">
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}

                            {col.type === 'multiSelect' && (
                              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                                {(col.options || []).map((option) => {
                                  const selectedStatuses = getSelectedStatuses();
                                  const checked = selectedStatuses.includes(option.value);
                                  return (
                                    <label
                                      key={option.value}
                                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition ${
                                        checked ? 'bg-purple-500/20 text-white' : 'text-gray-300 hover:bg-white/5'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          const next = checked
                                            ? selectedStatuses.filter((item) => item !== option.value)
                                            : [...selectedStatuses, option.value];
                                          setFilters({ ...filters, [col.key]: next });
                                        }}
                                        className="accent-purple-500"
                                      />
                                      <span>{option.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {col.type === 'dateRange' && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] text-gray-400 mb-1">De</label>
                                  <input
                                    type="date"
                                    value={filters[col.startKey]}
                                    onChange={(e) => setFilters({ ...filters, [col.startKey]: e.target.value })}
                                    className={`${inputCls} w-full text-xs`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-gray-400 mb-1">Até</label>
                                  <input
                                    type="date"
                                    value={filters[col.endKey]}
                                    onChange={(e) => setFilters({ ...filters, [col.endKey]: e.target.value })}
                                    className={`${inputCls} w-full text-xs`}
                                  />
                                </div>
                              </div>
                            )}

                            {col.type === 'range' && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] text-gray-400 mb-1">Min</label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={filters[col.minKey]}
                                    onChange={(e) => setFilters({ ...filters, [col.minKey]: e.target.value })}
                                    className={`${inputCls} w-full text-xs`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-gray-400 mb-1">Max</label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="999"
                                    value={filters[col.maxKey]}
                                    onChange={(e) => setFilters({ ...filters, [col.maxKey]: e.target.value })}
                                    className={`${inputCls} w-full text-xs`}
                                  />
                                </div>
                              </div>
                            )}

                            <div className="mt-3 text-right">
                              <button
                                type="button"
                                onClick={() => setOpenFilterKey(null)}
                                className="text-xs text-gray-400 hover:text-white"
                              >
                                Fechar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="relative">
                    {displayList.map((d, i) => {
                      const cliTime = calculateCliTime(d, currentTime);
                      const docsComparison = getDocsComparisonSummary(d);
                      const docsOk = docsComparison.total === 0;
                      const now = Date.now();
                      const updatedAt = recentlyUpdated[d._id];
                      const isRising = updatedAt && (now - updatedAt) < 900;
                      const isGlowing = updatedAt && (now - updatedAt) >= 900 && (now - updatedAt) < RISE_WINDOW;

                      return (
                        <div
                          key={d._id}
                          ref={(el) => { rowRefs.current[d._id] = el; }}
                          className={`grid text-xs border-b border-white/[0.06] transition-colors ${i % 2 === 0 ? themeConfig.tableRow : themeConfig.tableRowAlt} ${themeConfig.tableRowHover} ${isRising ? 'row-rise' : ''} ${isGlowing ? 'row-glow' : ''}`}
                          style={{ gridTemplateColumns: colTemplate, '--rise-from': '120px' }}
                        >

                          {/* PROCESSO */}
                          <div className="px-4 py-3 flex items-center gap-1.5 min-w-0" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}>
                            <span className="font-black text-blue-300 text-[13px] leading-tight" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                              {d.processoCAB || '—'}
                            </span>
                          </div>

                          {/* CONTAINER */}
                          <div className="px-4 py-3 flex items-center min-w-0" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}>
                            <span className="text-gray-300 text-[11px]" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }} title={getDisplayContainer(d) || d.deliveryNumber}>
                              {getDisplayContainer(d) || '—'}
                            </span>
                          </div>

                          {/* RECEBEDOR */}
                          <div className="px-4 py-3 flex items-center min-w-0" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}>
                            <span className="text-gray-300 text-[11px]" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }} title={getPartyBySentido(d, filters.sentido)}>
                              {getPartyBySentido(d, filters.sentido)}
                            </span>
                          </div>

                          {/* STATUS */}
                          <div className="px-2 py-3 flex items-center justify-center min-w-0">
                            {(() => {
                              const disp = d.status === 'FINALIZADO' && allModalDocsComplete(d)
                                ? 'DOCUMENTOS ENTREGUES'
                                : d.status;
                              return <Badge status={disp} />;
                            })()}
                          </div>

                          {/* HORA STATUS */}
                          <div className="px-2 py-3 flex items-center justify-center min-w-0">
                            <span className="text-gray-400 text-[11px] tabular-nums" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                              {(() => {
                                const entryTime = getStatusEntryTime(d, city);
                                return entryTime ? formatarData(entryTime, city) : '—';
                              })()}
                            </span>
                          </div>

                          {/* TEMPO STATUS */}
                          <div className="px-2 py-3 flex items-center justify-center min-w-0">
                            {(() => {
                              const status = normalizeKey(d.status);
                              if (status === 'FINALIZADO' || status === 'DOCUMENTOS ENTREGUES') {
                                return <FaCheckCircle className="text-emerald-400" size={15} title="Status finalizado" />;
                              }
                              const entryTime = getStatusEntryTime(d, city);
                              if (!entryTime) return <span className="text-gray-400 text-[11px]">—</span>;
                              const now = currentTime;
                              const diffMs = now - new Date(entryTime);
                              if (diffMs < 0) return <span className="text-gray-400 text-[11px]">—</span>;
                              const totalMin = Math.floor(diffMs / 60000);
                              const h = Math.floor(totalMin / 60);
                              const m = totalMin % 60;
                              return <span className="text-gray-400 text-[11px] tabular-nums" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                                {h > 0 ? `${h}h ${m}m` : `${m}m`}
                              </span>;
                            })()}
                          </div>

                          <div className="px-2 py-3 flex items-center justify-center min-w-0">
                            <ProgressDots delivery={d} allModalDocsComplete={allModalDocsComplete} />
                          </div>

                          <div className="px-2 py-3 flex items-center justify-center min-w-0">
                            <span className="text-gray-400 text-[11px] tabular-nums" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                              {getProgramacaoDate(d, city) ? formatarAgendamento(getProgramacaoDate(d, city)) : '—'}
                            </span>
                          </div>

                          <div className="px-1 py-3 flex items-center justify-center min-w-0">
                            <PunctualityCell p={getPunctualityStatus(d, currentTime, city)} />
                          </div>

                          <div className="px-1 py-3 flex items-center justify-center min-w-0">
                            {docsOk || icompanyVerified?.[d._id]?.verified ? (
                              <FaCheckCircle
                                className="text-emerald-400"
                                title={icompanyVerified?.[d._id]?.verified ? "Inconsistências verificadas" : "Comparação de dados OK"}
                                size={15}
                              />
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-rose-400"
                                title={`Inconsistências: ${docsComparison.total}`}
                              >
                                <FaTimesCircle size={15} />
                                <span className="text-[10px] font-semibold">{docsComparison.total}</span>
                              </span>
                            )}
                          </div>

                          <div className="px-1 py-3 flex items-center justify-center min-w-0">
                            <button
                              onClick={() => setSelectedDelivery(d)}
                              title="Visualizar"
                              className="w-7 h-7 rounded-lg bg-purple-600/20 hover:bg-purple-600/50 text-purple-400 hover:text-white flex items-center justify-center transition"
                            >
                              <FaEye size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {toast && (
        <Toast
          toast={toast}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          setToast={setToast}
        />
      )}

      {selectedDelivery && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"><div className="text-white">Carregando modal...</div></div>}>
          <DeliveryModal
            selectedDelivery={selectedDelivery}
            onClose={() => setSelectedDelivery(null)}
            city={city}
            selectedSentido={filters.sentido}
            icompanyVerified={icompanyVerified}
            setIcompanyVerified={setIcompanyVerified}
            icompanyRemoteRecord={icompanyRemoteRecord}
            icompanyLookupStatus={icompanyLookupStatus}
            controleProtocolosRecord={controleProtocolosRecord}
            controleProtocolosLookupStatus={controleProtocolosLookupStatus}
            findIcompanyInCache={findIcompanyInCache}
            compareWithIcompany={compareWithIcompany}
            allModalDocsComplete={allModalDocsComplete}
            getFlowHistory={getFlowHistory}
            getDocumentUrlsArray={getDocumentUrlsArray}
            getLabelsForDelivery={getLabelsForDelivery}
            removeProgramacaoInfo={removeProgramacaoInfo}
            getProgramacaoDate={getProgramacaoDate}
            handleDownload={handleDownload}
            handleDownloadAll={handleDownloadAll}
            handleShareDelivery={handleShareDelivery}
            handleEditStart={handleEditStart}
            handleDelete={handleDelete}
            onRemoveDocument={handleRemoveDocument}
            canRemoveDocument={user?.role === 'admin' || user?.role === 'manager'}
            updateVerificationWithServer={updateVerificationWithServer}
            setToast={setToast}
            setViewingDocument={setViewingDocument}
            setModalFotos={setModalFotos}
            editingDelivery={editingDelivery}
            editForm={editForm}
            setEditingDelivery={setEditingDelivery}
            setEditForm={setEditForm}
            handleEditSave={handleEditSave}
            userName={user?.name || user?.username || user?.email}
            currentTime={currentTime}
            deliveryToUnverify={deliveryToUnverify}
            setDeliveryToUnverify={setDeliveryToUnverify}
            confirmRemoveVerification={confirmRemoveVerification}
            setConfirmRemoveVerification={setConfirmRemoveVerification}
          />
        </Suspense>
      )}

      {modalFotos && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-3 sm:p-4">
          <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white">{modalFotos.label}</h2>
              <button
                onClick={() => setModalFotos(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {modalFotos.files.map((url, i) => (
                  <img key={i} src={url} alt={`Foto ${i + 1}`} className="w-full h-44 object-cover rounded-xl shadow-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingDocument && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-3 sm:p-4">
          <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-base font-bold text-white">{viewingDocument.label}</h2>
              <button
                onClick={() => setViewingDocument(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <FaTimes />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 bg-gray-950/50">
              {viewingDocument.urls?.length > 0 ? (
                <div className="space-y-4">
                  {viewingDocument.urls.map((url, i) => (
                    <div key={i} className="rounded-xl overflow-hidden">
                      {url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={url} alt={`${viewingDocument.label} ${i + 1}`} className="w-full h-auto rounded-xl" />
                      ) : (
                        <div className="p-8 text-center">
                          <FaFilePdf className="mx-auto text-4xl text-red-400 mb-4" />
                          <p className="text-gray-400 mb-4 text-sm">{viewingDocument.label}</p>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
                          >
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

      {editingDelivery && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-[#1a1a2e] rounded-3xl w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 flex-shrink-0">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Edição</p>
                <h2 className="text-lg font-black text-white">Editar Entrega</h2>
              </div>
              <button
                onClick={() => setEditingDelivery(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* Remove banner de visualização para geomar */}

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {[
                ['Número do Container', 'deliveryNumber', 'text', true],
                ['Contratado', 'userName', 'text', false],
                ['Motorista', 'driverName', 'text', false],
                ['Recebedor', 'recebedor', 'text', false],
              ].map(([label, field, type, upper]) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">{label}</label>
                  <input
                    type={type}
                    disabled={isGeoMar()}
                    value={editForm[field]}
                    onChange={(e) => setEditForm({ ...editForm, [field]: upper ? e.target.value.toUpperCase() : e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Status</label>
                <select
                  disabled={isGeoMar()}
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="" className="bg-gray-900">Selecione…</option>
                  <option value="ENTREGUE" className="bg-gray-900">Operação Finalizada</option>
                  <option value="NO_PORTO_AGUARDANDO_MONTAGEM" className="bg-gray-900">No porto aguardando montagem</option>
                  <option value="pending" className="bg-gray-900">A Caminho do Cliente</option>
                  <option value="AGUARDANDO_DESOVA" className="bg-gray-900">Aguardando Desova/Ovação</option>
                  <option value="EM_DESOVA" className="bg-gray-900">Em Desova/Ovação</option>
                  <option value="DESATRELADO" className="bg-gray-900">Desatrelado</option>
                  <option value="RECUSADO_CLIENTE" className="bg-gray-900">Recusado Cliente</option>
                  <option value="DESOVA_FINALIZADA" className="bg-gray-900">Desova/Ovação Finalizada</option>
                  <option value="ANEXANDO_DOCUMENTOS_FINAIS" className="bg-gray-900">Anexando Docs Finais</option>
                  <option value="SAINDO_CLIENTE" className="bg-gray-900">Saindo do Cliente</option>
                  <option value="RETORNANDO_PORTO" className="bg-gray-900">Retornando Porto</option>
                  <option value="CHEGOU_PORTO" className="bg-gray-900">Chegou no Porto</option>
                  <option value="CANCELADO" className="bg-gray-900">Cancelado</option>
                </select>
              </div>

              {[
                ['Data Agendamento', 'dataAgendamento'],
                ['Data Devolução Container Vazio', 'horarioDevolucaoVazio'],
                ['Horário Chegada', 'horarioChegada'],
                [`Horário Início ${getDesovaStepLabel(city)}`, 'horarioInicioDesova'],
                [`Horário Fim ${getDesovaStepLabel(city)}`, 'horarioFimDesova'],
                ['Saida do Cliente', 'horarioSaidaCliente'],
                ['Chegada no Porto', 'horarioChegadaPorto'],
              ].map(([label, field]) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">{label}</label>
                  <input
                    type="datetime-local"
                    disabled={isGeoMar()}
                    value={editForm[field]}
                    onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                  Motivo da Edição <span className="text-red-400">*</span>
                </label>
                <textarea
                  disabled={isGeoMar()}
                  value={editForm.observations}
                  onChange={(e) => setEditForm({ ...editForm, observations: e.target.value })}
                  rows={3}
                  placeholder="Explique o motivo da edição (obrigatório)"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none placeholder-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 bg-white/[0.02] flex gap-3">
              <button
                onClick={handleEditSave}
                disabled={isGeoMar()}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Salvar Alterações
              </button>

              <button
                onClick={() => setEditingDelivery(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-sm transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Remover Verificação Icompany */}
      {confirmRemoveVerification && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-3">
          <div className="bg-[#1a1a2e] rounded-2xl border border-amber-500/30 shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-amber-900/40 to-orange-900/40 border-b border-amber-500/30">
              <h3 className="text-lg font-bold text-amber-200 flex items-center gap-2">
                <FaExclamationTriangle className="text-amber-400" /> Remover Verificação?
              </h3>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-300">
                Você tem certeza que deseja <strong>remover a confirmação de verificação</strong> desta entrega?
              </p>
              
              {icompanyVerified?.[deliveryToUnverify] && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                  <p>
                    <strong>Verificado por:</strong> {icompanyVerified[deliveryToUnverify].verifiedBy || icompanyVerified[deliveryToUnverify].user || userName}
                  </p>
                  <p>
                    <strong>Em:</strong> {new Date(icompanyVerified[deliveryToUnverify].verifiedAt || icompanyVerified[deliveryToUnverify].timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}

              <p className="text-xs text-amber-300">
                ⚠️ Esta ação não pode ser desfeita rapidamente. A próxima sincronização poderá recriar este status.
              </p>
            </div>

            <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setConfirmRemoveVerification(false);
                  setDeliveryToUnverify(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-semibold text-sm transition"
              >
                Cancelar
              </button>

              <button
                onClick={async () => {
                  try {
                    // Remover do servidor primeiro
                    await updateVerificationWithServer(deliveryToUnverify, false, '');
                    
                    // Atualizar estado local
                    const newState = { ...icompanyVerified };
                    delete newState[deliveryToUnverify];
                    setIcompanyVerified(newState);
                    
                    // Fechar modal
                    setConfirmRemoveVerification(false);
                    setDeliveryToUnverify(null);
                    
                    setToast({
                      type: 'success',
                      message: '✓ Verificação removida',
                      duration: 3000
                    });
                  } catch (err) {
                    // Erro já foi tratado em updateVerificationWithServer
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-red-600/30 hover:bg-red-600/50 text-red-300 hover:text-red-200 font-semibold text-sm transition border border-red-500/30"
              >
                Remover Confirmação
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MonitorEntregas;
