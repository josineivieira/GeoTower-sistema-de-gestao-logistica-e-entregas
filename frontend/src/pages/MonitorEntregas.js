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
import {
  FaArrowLeft, FaEye, FaDownload, FaSync, FaFilter, FaTimes,
  FaTrash, FaEdit, FaExclamationTriangle, FaShareAlt, FaCalendarAlt,
  FaClock, FaBox, FaTruck, FaCheckCircle, FaTimesCircle, FaFilePdf,
  FaUsers, FaDolly, FaSearch, FaExpand, FaPalette, FaCog, FaSlidersH,
  FaPlus, FaMapMarkerAlt, FaShippingFast, FaUndo, FaChevronRight,
  FaUser, FaBoxOpen, FaBuilding, FaLayerGroup
} from 'react-icons/fa';
import { MdLocalShipping, MdDashboard } from 'react-icons/md';
import manaConfig from '../config/cities/manaus.json';
import itajaiConfig from '../config/cities/itajai.json';
import jsPDF from 'jspdf';
import { getDesovaStatusLabel, getDesovaStepLabel } from '../utils/cityLabels';

const DeliveryModal = lazy(() => import('../components/DeliveryModal'));

/* ─────────────────────────────────────────────────────────────
   KANBAN - MESMA LÓGICA DO MONITOR DE PROCESSOS
───────────────────────────────────────────────────────────── */
const normalizeKey = (s) => {
  if (!s) return '';
  return String(s).replace(/_/g, ' ').toUpperCase().trim();
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
      label: `Aguard. ${desovaLabel}`,
      bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700',
      border: 'border-orange-300',
      badge: 'bg-orange-100 text-orange-800 border border-orange-300',
      icon: <FaExclamationTriangle />, gradient: 'from-orange-400 to-orange-600',
      ring: 'ring-orange-400/30', dot: 'bg-orange-500', hex: '#f97316'
    },
    'EM DESOVA': {
      label: `Em ${desovaLabel}`,
      bg: 'bg-violet-600', light: 'bg-violet-50', text: 'text-violet-700',
      border: 'border-violet-300',
      badge: 'bg-violet-100 text-violet-800 border border-violet-300',
      icon: <FaDolly />, gradient: 'from-violet-500 to-violet-700',
      ring: 'ring-violet-400/30', dot: 'bg-violet-500', hex: '#8b5cf6'
    },
    'ANEXANDO DOCUMENTOS FINAIS': {
      label: 'Anexando Docs',
      bg: 'bg-pink-600', light: 'bg-pink-50', text: 'text-pink-700',
      border: 'border-pink-300',
      badge: 'bg-pink-100 text-pink-800 border border-pink-300',
      icon: <FaFilePdf />, gradient: 'from-pink-500 to-pink-700',
      ring: 'ring-pink-400/30', dot: 'bg-pink-500', hex: '#ec4899'
    },
    ENTREGUE: {
      label: 'Entregue',
      bg: 'bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700',
      border: 'border-emerald-300',
      badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      icon: <FaCheckCircle />, gradient: 'from-emerald-500 to-emerald-700',
      ring: 'ring-emerald-400/30', dot: 'bg-emerald-500', hex: '#10b981'
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

const DeliveryKanbanCard = ({ delivery, column, onOpen, currentTime, city = 'manaus' }) => (
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
          {delivery.recebedor && (
            <div className="flex items-center gap-1 text-[9px] text-gray-500">
              <FaBuilding className="text-gray-400 shrink-0 text-[8px]" />
              <span className="truncate">{delivery.recebedor}</span>
            </div>
          )}

          {delivery.userName && (
            <div className="flex items-center gap-1 text-[9px] text-gray-500">
              <FaBoxOpen className="text-gray-400 shrink-0 text-[8px]" />
              <span className="truncate">{delivery.userName}</span>
            </div>
          )}

          {/* mostramos número do container no lugar do motorista */}
          {delivery.containerNumero && (
            <div className={`flex items-center gap-1 text-[9px] font-medium ${column.text}`}>
              <FaBoxOpen className="shrink-0 text-[8px]" />
              <span className="truncate">{delivery.containerNumero}</span>
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

const DeliveryKanbanColumn = ({ column, deliveries, onOpen, currentTime, city = 'manaus' }) => {
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
const progressStatuses = [
  'AGENDADO', 'CONTAINER MONTADO', 'A CAMINHO DO CLIENTE',
  'AGUARDANDO DESOVA', 'EM DESOVA', 'ANEXANDO DOCUMENTOS FINAIS', 'ENTREGUE'
];

const getProgress = (delivery) => {
  const key = normalizeKey(delivery.status);
  const norm =
    key === 'ENTREGUE' || key === 'SUBMITTED' || key === 'ENTREGUE COM PENDENCIA CANHOTO' ? 'ENTREGUE'
    : key === 'PENDING' || key === 'A CAMINHO DO CLIENTE' ? 'A CAMINHO DO CLIENTE'
    : key;
  if (norm === 'CANCELADO' || !norm) return 0;
  const idx = progressStatuses.indexOf(norm);
  if (idx === -1) return 0;
  return Math.round((idx / (progressStatuses.length - 1)) * 100);
};

// ProgressDots agora importado como MemoizedProgressDots
const ProgressDots = MemoizedProgressDots;

// PunctualityCell agora importado como MemoizedPunctualityCell
const PunctualityCell = MemoizedPunctualityCell;

const DEFAULT_COL_TEMPLATE = 'repeat(15, minmax(0, 1fr))';

/* ─────────────────────────────────────────────────────────────
   SETTINGS PANEL
───────────────────────────────────────────────────────────── */
const SettingsPanel = ({
  open, onClose, theme, setTheme,
  autoRefresh, setAutoRefresh, refreshInterval, setRefreshInterval,
  filters, setFilters
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) setVisible(true);
    else {
      const t = setTimeout(() => setVisible(false), 280);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible) return null;

  const inputCls = `w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm
    focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-600`;

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
                    style={{ background: t.bg }}
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

              {(filters.status !== 'all' || filters.searchTerm || filters.startDate || filters.endDate) && (
                <button
                  onClick={() => setFilters({ status: 'all', searchTerm: '', startDate: '', endDate: '' })}
                  className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 font-semibold transition"
                >
                  <FaTimes size={10} /> Limpar
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className={inputCls}
                >
                  <option value="all" className="bg-gray-900">Todos</option>
                  <option value="OPERACAO_FINALIZADA" className="bg-gray-900">Operação Finalizada</option>
                  <option value="DOCUMENTOS_ENTREGUES" className="bg-gray-900">Documentos Entregues</option>
                  <option value="FINALIZADO" className="bg-gray-900">Finalizado (sem docs)</option>
                  <option value="A CAMINHO DO CLIENTE" className="bg-gray-900">A Caminho do Cliente</option>
                  <option value="AGENDADO" className="bg-gray-900">Agendado</option>
                  <option value="AGUARDANDO_DESOVA" className="bg-gray-900">Aguardando Desova/Ovação</option>
                  <option value="EM_DESOVA" className="bg-gray-900">Em Desova/Ovação</option>
                  <option value="DESOVA_FINALIZADA" className="bg-gray-900">Desova/Ovação Finalizada</option>
                  <option value="ANEXANDO_DOCUMENTOS_FINAIS" className="bg-gray-900">Anexando Docs Finais</option>
                  <option value="CANCELADO" className="bg-gray-900">Cancelado</option>
                </select>
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
                    className={`${inputCls} pl-8`}
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
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Data Final</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className={inputCls}
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
  getPunctualityStatus, recentlyUpdated, RISE_WINDOW, setSelectedDelivery, city
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
          <p className="text-gray-600 text-[10px] uppercase font-bold">Contratado</p>
          <p className="text-gray-200 font-semibold truncate">{d.userName || '—'}</p>
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
  if (status === 'CONTAINER MONTADO') return delivery.containerMontadoAt;
  if (status === 'A CAMINHO DO CLIENTE' || status === 'PENDING') return delivery.tripStartedAt || delivery.createdAt; // fallback para createdAt se tripStartedAt não existir
  if (status === 'AGUARDANDO DESOVA') return delivery.arrivedAt || delivery.horarioChegada;
  if (status === 'EM DESOVA') return delivery.desovaStartedAt || delivery.horarioInicioDesova;
  if (status === 'ANEXANDO DOCUMENTOS FINAIS') return delivery.docsStartedAt || delivery.horarioFimDesova;
  if (status === 'FINALIZADO' || status === 'ENTREGUE' || status === 'DOCUMENTOS ENTREGUES') return delivery.finalizedAt || delivery.horarioFimDesova || delivery.horarioChegada;
  if (status === 'CANCELADO') return delivery.cancelledAt || delivery.createdAt;
  return null;
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
const MonitorEntregas = () => {
  const { user } = useAuth();
  const { city } = useCity();
  const isGeoMar = () => false; // Libera edição para geomar
  const canEdit = () => user?.role === 'manager' || user?.role === 'geomar';
  const navigate = useNavigate();

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
    horarioChegada: '', horarioInicioDesova: '', horarioFimDesova: '', observations: ''
  });
  const [filters, setFilters] = useState({ status: 'all', searchTerm: '', startDate: '', endDate: '' });
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
  const [controleProtocolosData, setControleProtocolosData] = useState([]);
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
    'minmax(90px, 0.7fr)',    // Docs
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
  const themeConfig = THEMES[theme] || THEMES.dark;
  const userName = user?.name || 'Usuário Desconhecido';

  const statusMapToBackend = {
    OPERACAO_FINALIZADA: ['ENTREGUE', 'submitted', 'FINALIZADO'],
    'A CAMINHO DO CLIENTE': ['A_CAMINHO_DO_CLIENTE', 'pending', 'PENDING'],
    DOCUMENTOS_ENTREGUES: ['FINALIZADO'],
    FINALIZADO: ['FINALIZADO'],
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

  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'monitor-anim-styles';
    el.textContent = GLOBAL_STYLES;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

    useEffect(() => {
    const el = document.createElement('style');
    el.id = 'theme-overrides';
    el.textContent = `
      .theme-light { background-color:#f5f7fa!important; color:#1a1a1a!important; }
      .theme-light * { color:#1a1a1a!important; }
      .theme-light .bg-white\/5{background-color:rgba(245,247,250,0.95)!important}
      .theme-light .border-white\/10{border-color:rgba(75,85,99,0.2)!important}
      .theme-light select,.theme-light input,.theme-light textarea{background-color:#ffffff!important;color:#1a1a1a!important;border-color:#d1d5db!important}

      .theme-company { background-color:#f3e5f5!important; color:#1a0033!important; }
      .theme-company * { color:#1a0033!important; }
      .theme-company .bg-white\/5{background-color:rgba(243,229,245,0.95)!important}
      .theme-company .border-white\/10{border-color:rgba(107,33,168,0.3)!important}
      .theme-company select,.theme-company input,.theme-company textarea{background-color:#fff6ff!important;color:#1a0033!important;border-color:#b78ada!important}

      .theme-sunset { background-color:#fff5f7!important; color:#4b1e3b!important; }
      .theme-sunset * { color:#4b1e3b!important; }
      .theme-sunset .bg-white\/5{background-color:rgba(255,245,247,0.95)!important}
      .theme-sunset .border-white\/10{border-color:rgba(159,42,102,0.3)!important}
      .theme-sunset select,.theme-sunset input,.theme-sunset textarea{background-color:#fff7f9!important;color:#4b1e3b!important;border-color:#f9acc6!important}

      .theme-ocean { background-color:#e0f7fa!important; color:#00363a!important; }
      .theme-ocean * { color:#00363a!important; }
      .theme-ocean .bg-white\/5{background-color:rgba(224,247,250,0.95)!important}
      .theme-ocean .border-white\/10{border-color:rgba(0,118,132,0.3)!important}
      .theme-ocean select,.theme-ocean input,.theme-ocean textarea{background-color:#ecfdff!important;color:#00363a!important;border-color:#70d8e4!important}

      .theme-dark { background-color:#0f0f1a!important;color:#ffffff!important; }
      .theme-dark * { color:#ffffff!important; }
      .theme-dark .text-gray-300{color:#d1d5db!important}
      .theme-dark .text-gray-400{color:#cbd5e1!important}

      .theme-black, .theme-black * { color: inherit !important; background: inherit !important; }
    `;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  // light theme row tweaks
  useEffect(() => {
    const el2 = document.createElement('style');
    el2.id = 'theme-row-overrides';
    el2.textContent = `
      .theme-light .bg-white\/[0\.015]{background-color:rgba(0,0,0,0.02)!important}
      .theme-light .hover\:bg-white\/[0\.04]:hover{background-color:rgba(0,0,0,0.025)!important}
    `;
    document.head.appendChild(el2);
    return () => document.head.removeChild(el2);
  }, []);

  // dynamic overrides for gray text utilities based on theme
  useEffect(() => {
    const el3 = document.createElement('style');
    el3.id = 'theme-text-overrides';
    const primary = themeConfig.text || '#000';
    const secondary = themeConfig.textSecondary || primary;
    el3.textContent = `
      .theme-light .text-gray-300, .theme-dark .text-gray-300, .theme-company .text-gray-300, .theme-sunset .text-gray-300, .theme-ocean .text-gray-300,
      .theme-light .text-gray-400, .theme-dark .text-gray-400, .theme-company .text-gray-400, .theme-sunset .text-gray-400, .theme-ocean .text-gray-400,
      .theme-light .text-gray-500, .theme-dark .text-gray-500, .theme-company .text-gray-500, .theme-sunset .text-gray-500, .theme-ocean .text-gray-500,
      .theme-light .text-gray-600, .theme-dark .text-gray-600, .theme-company .text-gray-600, .theme-sunset .text-gray-600, .theme-ocean .text-gray-600 {
        color: ${secondary}!important;
      }
    `;
    document.head.appendChild(el3);
    return () => document.head.removeChild(el3);
  }, [themeConfig]);

  useEffect(() => {
    const el4 = document.createElement('style');
    el4.id = 'theme-color-overrides';
    el4.textContent = `
      .theme-light, .theme-light * { color: #1a1a1a !important; }
      .theme-company, .theme-company * { color: #1a0033 !important; }
      .theme-sunset, .theme-sunset * { color: #4b1e3b !important; }
      .theme-ocean, .theme-ocean * { color: #00363a !important; }
      .theme-dark, .theme-dark * { color: #ffffff !important; }

      .theme-light { background-color: #eaf2ff !important; }
      .theme-company { background-color: #e3ebff !important; }
      .theme-sunset { background-color: #f8f3ff !important; }
      .theme-ocean { background-color: #def4ff !important; }
      .theme-dark { background-color: #0a0d1d !important; }

      /* preserve pure black theme behavior */
      .theme-black, .theme-black * { color: inherit !important; background: inherit !important; }

      .theme-light body, .theme-company body, .theme-sunset body, .theme-ocean body, .theme-dark body { font-family: 'Inter', sans-serif !important; }

      .theme-light .monitor-modal, .theme-company .monitor-modal, .theme-sunset .monitor-modal, .theme-ocean .monitor-modal { color: inherit !important; }
    `;
    document.head.appendChild(el4);
    return () => document.head.removeChild(el4);
  }, [theme]);

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
    if (d.containerMontadoAt) ev.push({ label: 'Montagem do container', date: d.containerMontadoAt });
    if (d.horarioChegada) ev.push({ label: 'Chegada', date: d.horarioChegada });
    if (d.horarioInicioDesova) ev.push({ label: city === 'itajai' ? 'Inicio da ovação' : 'Início da desova', date: d.horarioInicioDesova });
    if (d.horarioFimDesova) ev.push({ label: city === 'itajai' ? 'Fim da ovação' : 'Fim da desova', date: d.horarioFimDesova });
    return ev.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const getDocumentUrlsArray = (docData) => {
    if (!docData) return [];
    const normalizeItem = (i) => {
      if (typeof i === 'string') return i;
      if (typeof i === 'object' && i) {
        // Prefer stored path over potentially shortened/obfuscated URL
        const pathUrl = i.path ? `/uploads/${i.path}` : null;
        const url = (typeof i.url === 'string' && i.url.includes('...') && pathUrl) ? pathUrl : i.url;
        return url || pathUrl || i.link || i.webViewLink || null;
      }
      return null;
    };

    if (Array.isArray(docData)) {
      return docData.map(normalizeItem).filter(Boolean);
    }

    if (typeof docData === 'object') {
      return [normalizeItem(docData)].filter(Boolean);
    }

    return [];
  };

  const allModalDocsComplete = (d) => {
    if (!d) return false;
    const keys = ['retiradaCheio', 'canhotCTE', 'diarioBordo', 'canhotNF', 'devolucaoVazio', 'chegadaCliente', 'inicioDesova', 'fimDesova'];
    return keys.every((k) => getDocumentUrlsArray(d.documents?.[k]).length > 0);
  };

  const formatStatus = (s, delivery) => {
    if (!s) return '-';
    if (s === 'ENTREGUE_COM_PENDENCIA_CANHOTO') s = 'FINALIZADO';
    if (s === 'FINALIZADO') {
      if (allModalDocsComplete(delivery)) return 'DOCUMENTOS ENTREGUES';
      return 'FINALIZADO';
    }
    if (s === 'ENTREGUE' || s === 'submitted') return 'OPERAÇÃO FINALIZADA';
    if (s === 'pending' || s === 'PENDING') return 'A CAMINHO DO CLIENTE';
    return String(s).replace(/_/g, ' ');
  };

  const getDocumentsStatus = (delivery) => {
    if (!delivery) return 'PENDENTE';
    const required = ['canhotCTE', 'diarioBordo', 'canhotNF', 'devolucaoVazio'];
    const docs = delivery.documents || {};
    if (required.every((k) => docs[k])) return 'COMPLETO';
    const pending = required.filter((k) => !docs[k]).map((k) =>
      ({ canhotCTE: 'CTE', canhotNF: 'NF', diarioBordo: 'DIÁRIO', devolucaoVazio: 'RIC' }[k] || k)
    ).join(' + ');
    return `PENDENTE ${pending}`;
  };

  const defaultDocumentLabels = manaConfig.documents || {
    canhotNF: 'NF', canhotCTE: 'CTE', diarioBordo: 'Diário', devolucaoVazio: 'Vazio', retiradaCheio: 'Cheio'
  };

  const itajaiDocumentLabels = {
    ...itajaiConfig.documents,
    retiradaCheio: 'Retirada Porto',
    canhotCTE: 'CONTRATO',
    canhotNF: 'TACOGRAFO/RIC ABASTECIMENTO',
    diarioBordo: 'Diario de Bordo',
    devolucaoVazio: 'Baixa no Porto',
    chegadaCliente: 'Chegada no Cliente'
  };

  const controleProtocolosDocumentMap = {
    retiradaCheio: 'RIC PORTO DESTINO',
    canhotCTE: 'COMPROVANTE DE DESOVA',
    diarioBordo: 'DIARIO DE BORDO',
    canhotNF: 'CANHOTO DE DANFE',
    devolucaoVazio: 'RIC DEPOT DESTINO'
  };

  const isControleDocumentoPresent = (value) => {
    return value === true;
  };

  const getLabelsForDelivery = (d) => {
    if (!d) return defaultDocumentLabels;
    // Usar city do contexto se o delivery não tiver, ou verificar ambos
    const deliveryCity = (d.city || city || '').toLowerCase();
    // eslint-disable-next-line no-console
    console.log('DEBUG getLabelsForDelivery:', { d_city: d.city, context_city: city, deliveryCity, isItajai: deliveryCity === 'itajai' });
    return deliveryCity === 'itajai' ? itajaiDocumentLabels : defaultDocumentLabels;
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
      ['Recebedor', safe(delivery.recebedor)],
      ['Status', safe(formatStatus(delivery.status, delivery))],
      ['Agendamento', formatDT(getProgramacaoDate(delivery, city))],
      ['Montagem Container', formatDT(delivery.containerMontadoAt)],
      ['Chegada', formatDT(delivery.horarioChegada)],
      [`Início ${getDesovaStepLabel(city)}`, formatDT(delivery.horarioInicioDesova)],
      [`Fim ${getDesovaStepLabel(city)}`, formatDT(delivery.horarioFimDesova)],
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
    const docKeys = Object.keys(delivery.documents || {}).filter(k => !['chegadaCliente', 'inicioDesova', 'fimDesova'].includes(k));
    const fotoFields = [
      { key: 'chegadaCliente', label: 'Chegada no Cliente' },
      { key: 'inicioDesova', label: `Início da ${getDesovaStepLabel(city)}` },
      { key: 'fimDesova', label: `Finalização da ${getDesovaStepLabel(city)}` }
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
      if (filters.status && filters.status !== 'all') {
        const bs = statusMapToBackend[filters.status];
        if (bs) backendFilters.status = bs[0];
      }

      let periodDate = '';
      if (statsPeriod && statsPeriod !== 'general') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (statsPeriod === 'yesterday') today.setDate(today.getDate() - 1);
        if (statsPeriod === 'tomorrow') today.setDate(today.getDate() + 1);
        periodDate = today.toLocaleDateString('pt-BR');
      }

      // Carregar programações E entregas, depois fazer merge
      const [progRes, delivRes] = await Promise.all([
        adminService.getProgramacoes(statsPeriod, periodDate),
        adminService.getDeliveries(backendFilters, statsPeriod, periodDate)
      ]);

      const programacoes = progRes?.data?.programacoes || [];
      const deliveries = delivRes?.data?.deliveries || [];

      // Criar mapa de programações por número/container
      const mapProgramacoes = {};
      programacoes.forEach(prog => {
        const chaveProc = (prog.processo || '').toUpperCase().trim();
        const chaveCont = (prog.container || '').toUpperCase().trim();
        if (chaveProc) mapProgramacoes[chaveProc] = prog;
        if (chaveCont) mapProgramacoes[chaveCont] = prog;
      });

      // Enriquecer entregas com dados de programações (especialmente dtColeta)
      const enrichedDeliveries = deliveries.map(d => {
        const chaveDeliv = (d.deliveryNumber || '').toUpperCase().trim();
        const programacao = mapProgramacoes[chaveDeliv];
        
        // Se encontrou programação, adiciona dtColeta
        if (programacao && programacao.dtColeta) {
          return { ...d, dtColeta: programacao.dtColeta };
        }
        return d;
      });

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
  }, [filters, statsPeriod]);

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

  const loadControleProtocolosData = useCallback(async () => {
    try {
      const response = await adminService.getControleProtocolos();
      if (response.data?.success) {
        setControleProtocolosData(response.data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de controle de protocolos:', error);
    }
  }, []);

  const findIcompanyInCache = useCallback((delivery) => {
    if (!delivery || !icompanyData.length) return null;

    const getClean = (value) => {
      if (value === null || value === undefined) return '';
      return value.toString().replace(/^#/, '').trim().toUpperCase();
    };

    const target = getClean(delivery.deliveryNumber || delivery.processo || delivery.codigo || '');
    if (!target) return null;

    const keys = ['geomaritima', 'processo', 'codigo', 'numero', 'NUMERO', 'NÚMERO', 'container', 'containerNumero'];

    return icompanyData.find((record) => {
      return keys.some((k) => {
        const val = getClean(record[k]);
        return val && val === target;
      });
    }) || null;
  }, [icompanyData]);

  // Função para comparar dados do delivery com Icompany
  const compareWithIcompany = useCallback((delivery, icompanyMatch) => {
    if (!delivery) return {};

    let recordToUse = icompanyMatch || findIcompanyInCache(delivery);
    if (!recordToUse) {
      return { __notFound: true, mensagem: `Nenhum registro iCompany encontrado para ${delivery.deliveryNumber || delivery.processo || delivery.codigo || 'N/D'}` };
    }

    // Mapeamento dos campos conforme o modelo Icompany (var nomes reais do banco)
    // Ajuste baseado na cidade: Itajaí tem mapeamentos diferentes
    const isItajai = city.toLowerCase() === 'itajai';
    const fieldMapping = isItajai ? {
      'Contratado': { deliveryField: 'userName', icompanyField: 'contratado' },
      'Entrega CNTR Porto': { deliveryField: 'horarioDevolucaoVazio', icompanyField: 'entradaDistrito' },
      'Agendamento': { deliveryField: 'dataAgendamento', icompanyField: 'dtColeta' },
      'Recebedor': { deliveryField: 'recebedor', icompanyField: 'remetente' },
      'Montagem Container': { deliveryField: 'containerMontadoAt', icompanyField: 'dtRetiraPD' },
      'Chegada': { deliveryField: 'horarioChegada', icompanyField: 'dtChegadaPlanta' },
      'Fim Desova': { deliveryField: 'horarioFimDesova', icompanyField: 'dtFimDescarga' }
    } : {
      'Contratado': { deliveryField: 'userName', icompanyField: 'contratado' },
      'Entrega CNTR Porto': { deliveryField: 'horarioDevolucaoVazio', icompanyField: 'dtDevolucaoCNTR' },
      'Agendamento': { deliveryField: 'dataAgendamento', icompanyField: 'dtAgendamentoDescarga' },
      'Recebedor': { deliveryField: 'recebedor', icompanyField: 'destinatario' },
      'Montagem Container': { deliveryField: 'containerMontadoAt', icompanyField: 'dtRetiraPD' },
      'Chegada': { deliveryField: 'horarioChegada', icompanyField: 'dtInicioDescarga' },
      'Fim Desova': { deliveryField: 'horarioFimDesova', icompanyField: 'dtFimDescarga' }
    };

    // Procurar registro correspondente na Icompany
    const processoRaw = (delivery.deliveryNumber || delivery.processo || delivery.codigo || '').toString();
    const processoClean = processoRaw.replace(/^#/, '').toUpperCase().trim();

    const normalizeRecordKey = (value) => {
      if (!value && value !== 0) return '';
      const str = value.toString();
      return str.replace(/^#/, '').trim().toUpperCase();
    };

    const lookupKeys = ['geomaritima', 'processo', 'codigo', 'numero', 'NUMERO', 'NÚMERO', 'container', 'containerNumero'];

    const icompanyRecord = icompanyData.find((record) => {
      return lookupKeys.some((key) => {
        const v = normalizeRecordKey(record[key]);
        return v && v === processoClean;
      });
    });


    if (!icompanyRecord) {
      // DEBUG: não encontrado; pode ser que esteja em outro formato no iCompany
      console.debug('[Icompany compare] no match for', { deliveryNumber: processoClean, rowCount: icompanyData.length });
      return { __notFound: true, mensagem: `Nenhum registro iCompany encontrado para ${processoClean}` };
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
      const deliveryValue = delivery[mapping.deliveryField];
      const icompanyValue = icompanyRecord[mapping.icompanyField];

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
  }, [icompanyData, city]);

  const findControleProtocolosInCache = useCallback((delivery) => {
    if (!delivery || !controleProtocolosData.length) return null;

    const getClean = (value) => {
      if (value === null || value === undefined) return '';
      return value.toString().replace(/^#/, '').trim().toUpperCase();
    };

    const target = getClean(delivery.codigo || delivery.processoCAB || delivery.deliveryNumber || delivery.processo || delivery.container || '');
    if (!target) return null;

    const lookupKeys = ['processo', 'container', 'destinatario', 'embarcador'];

    return controleProtocolosData.find((record) => {
      return lookupKeys.some((key) => {
        const val = getClean(record[key]);
        return val && val === target;
      });
    }) || null;
  }, [controleProtocolosData]);

  const getControleProtocolosMismatchCount = (delivery) => {
    if (!delivery) return 0;
    if (!controleProtocolosData.length) return 0;

    const controleRecord = findControleProtocolosInCache(delivery);
    if (!controleRecord) return 1;
    if (!controleRecord.documentos) return 1;

    return Object.entries(controleProtocolosDocumentMap).reduce((count, [deliveryKey, protocoloKey]) => {
      const deliveryPresent = !!delivery.documents?.[deliveryKey];
      const controlePresent = isControleDocumentoPresent(controleRecord.documentos[protocoloKey]);
      return count + (deliveryPresent !== controlePresent ? 1 : 0);
    }, 0);
  };

  const getDocsComparisonSummary = (delivery) => {
    const icompanyResult = compareWithIcompany(delivery);
    const icompanyMismatchCount = icompanyData.length === 0
      ? 0
      : icompanyResult.__notFound
        ? 1
        : Object.values(icompanyResult).filter((item) => item.isInconsistent).length;
    const controleMismatchCount = getControleProtocolosMismatchCount(delivery);

    return {
      total: icompanyMismatchCount + controleMismatchCount,
      icompanyMismatchCount,
      controleMismatchCount
    };
  };

  useEffect(() => {
    loadDeliveries();
    loadIcompanyData(); // Carregar dados da Icompany na inicialização
    loadControleProtocolosData();
    if (autoRefresh) {
      const t = setInterval(() => {
        // eslint-disable-next-line no-console
        console.log('DEBUG autoRefresh triggered, filters:', filters);
        loadDeliveries();
        loadControleProtocolosData();
      }, refreshInterval * 1000);
      return () => clearInterval(t);
    }
  }, [loadDeliveries, loadIcompanyData, loadControleProtocolosData, autoRefresh, refreshInterval]);

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

    // Aplicar apenas filtros que o backend não consegue fazer
    if (statsPeriod === 'general' && filters.status !== 'all') {
      // Filtros especiais que dependem de lógica do frontend
      if (filters.status === 'DOCUMENTOS_ENTREGUES') {
        r = r.filter(d => d.status === 'FINALIZADO' && allModalDocsComplete(d));
      } else if (filters.status === 'FINALIZADO') {
        r = r.filter(d => d.status === 'FINALIZADO' && !allModalDocsComplete(d));
      }
      // Outros status já são filtrados pelo backend
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
  }, [filteredDeliveries]);

  // Agrupa entregas por container
  const displayList = useMemo(() => {
    // Agrupamento por container
    const grouped = {};
    filteredDeliveries.forEach((d) => {
      const key = d.containerNumero || d.container || d.deliveryNumber;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d);
    });

    // Para cada grupo, pega a entrega principal (primeira) e adiciona os recebedores
    const result = Object.values(grouped).map((group) => {
      const main = group[0];
      main.fracionadas = group;
      return main;
    });

    // Ordena por atualização - sempre coloca entregas atualizadas no topo
    const sorted = result.sort((a, b) => {
      const aT = recentlyUpdated[a._id];
      const bT = recentlyUpdated[b._id];
      
      // Ambas foram atualizadas: ordena por timestamp (mais recente no topo)
      if (aT && bT) {
        const cmp = bT - aT;
        // eslint-disable-next-line no-console
        console.log('DEBUG sort ambas atualizadas:', {
          a_id: a._id,
          b_id: b._id,
          aT,
          bT,
          cmp,
          resultado: cmp > 0 ? 'b primeiro' : 'a primeiro'
        });
        return cmp;
      }
      
      // Só uma foi atualizada: coloca no topo
      if (aT && !bT) return -1;
      if (!aT && bT) return 1;
      
      // Nenhuma foi atualizada: mantém ordem original
      return 0;
    });
    
    // eslint-disable-next-line no-console
    console.log('DEBUG sorted displayList:', sorted.map(d => ({
      id: d._id,
      processNumber: d.processoCAB,
      timestamp: recentlyUpdated[d._id]
    })));
    
    return sorted;
  }, [filteredDeliveries, recentlyUpdated]);

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
    filters.status !== 'all',
    !!filters.searchTerm,
    !!filters.startDate,
    !!filters.endDate
  ].filter(Boolean).length;

  const flowHistory = selectedDelivery ? getFlowHistory(selectedDelivery) : [];
  const HEADERS = [
    'Processo', // NOVA COLUNA
    'Container', 'Recebedor',
    'Status',
    'Hora Status',
    'Tempo Status',
    'Progresso', 'Agendamento',
    'Pontualidade', 'Docs', 'Detalhes'
  ];

  const computeTemplate = () => {
    // Espaçamento máximo para melhor visibilidade
    return [
      'minmax(180px, 2.5fr)',   // Processo
      'minmax(180px, 2.5fr)',   // Container
      'minmax(180px, 2.5fr)',   // Recebedor
      'minmax(140px, 1.5fr)',   // Status
      'minmax(120px, 1fr)',     // Hora Status
      'minmax(120px, 1fr)',     // Tempo Status
      'minmax(140px, 1.2fr)',   // Progresso
      'minmax(160px, 1.5fr)',   // Agendamento
      'minmax(160px, 1.5fr)',   // Pontualidade
      'minmax(70px, 0.5fr)',    // Docs
      'minmax(60px, 0.4fr)'     // Detalhes
    ].join(' ');
  };

  return (
    <div
      style={{ backgroundColor: themeConfig.bg, color: themeConfig.text }}
      className={`min-h-screen font-sans transition-colors duration-300 ${theme === 'light' ? 'theme-light' : ''}`}
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
                />
              ))}
            </div>

            <div className="hidden md:block rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-black/20">
              <div className="overflow-x-auto">
                <div style={{ width: '100%' }} className="monitor-table min-w-full">
                  <div
                    className="grid text-[11px] font-bold uppercase tracking-wider bg-white/[0.04] border-b border-white/10"
                    style={{ gridTemplateColumns: colTemplate, color: themeConfig.textSecondary }}
                  >
                    {HEADERS.map((col, ci) => (
                      <div
                        key={col}
                        className={`${ci >= 6 ? 'px-2 py-3.5' : 'px-4 py-3.5'} flex items-center min-w-0 select-none ${ci >= 2 ? 'justify-center' : ''}`}
                        style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}
                      >
                        {col}
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
                            <span className="text-gray-300 text-[11px]" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }} title={d.containerNumero || d.container || d.deliveryNumber}>
                              {Array.isArray(d.containerNumero)
                                ? d.containerNumero.join(', ')
                                : (d.containerNumero || d.container || d.deliveryNumber || '—')}
                            </span>
                          </div>

                          {/* RECEBEDOR */}
                          <div className="px-4 py-3 flex items-center min-w-0" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}>
                            <span className="text-gray-300 text-[11px]" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }} title={d.recebedor}>
                              {d.recebedor || '—'}
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
                            {docsOk ? (
                              <FaCheckCircle
                                className="text-emerald-400"
                                title="Comparação de dados OK"
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
                  <option value="pending" className="bg-gray-900">A Caminho do Cliente</option>
                  <option value="AGUARDANDO_DESOVA" className="bg-gray-900">Aguardando Desova/Ovação</option>
                  <option value="EM_DESOVA" className="bg-gray-900">Em Desova/Ovação</option>
                  <option value="DESOVA_FINALIZADA" className="bg-gray-900">Desova/Ovação Finalizada</option>
                  <option value="ANEXANDO_DOCUMENTOS_FINAIS" className="bg-gray-900">Anexando Docs Finais</option>
                  <option value="CANCELADO" className="bg-gray-900">Cancelado</option>
                </select>
              </div>

              {[
                ['Data Agendamento', 'dataAgendamento'],
                ['Data Devolução Container Vazio', 'horarioDevolucaoVazio'],
                ['Horário Chegada', 'horarioChegada'],
                [`Horário Início ${getDesovaStepLabel(city)}`, 'horarioInicioDesova'],
                [`Horário Fim ${getDesovaStepLabel(city)}`, 'horarioFimDesova'],
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
