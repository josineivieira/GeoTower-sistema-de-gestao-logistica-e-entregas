import React, {
  useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect
} from 'react';
import { useTheme, THEMES } from '../contexts/ThemeContext';
import { useAuth } from '../services/authContext';
import { useCity } from '../contexts/CityContext';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { getProgramacaoDate } from '../utils/programacaoDate';
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

/* ─────────────────────────────────────────────────────────────
   KANBAN - MESMA LÓGICA DO MONITOR DE PROCESSOS
───────────────────────────────────────────────────────────── */
const normalizeKey = (s) => {
  if (!s) return '';
  return String(s).replace(/_/g, ' ').toUpperCase().trim();
};

const STATUS_COLUMNS = [
  {
    key: 'NOVO_PROCESSO',
    title: 'Novo Processo',
    description: 'Sem motorista',
    icon: FaPlus,
    gradient: 'from-blue-500 to-blue-600',
    lightBg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    filter: (p) => !p.driverName || p.driverName === '-' || String(p.driverName).trim() === '',
  },
  {
    key: 'PROGRAMADO',
    title: 'Programado',
    description: 'Agendado c/ motorista',
    icon: FaClock,
    gradient: 'from-violet-500 to-purple-600',
    lightBg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    filter: (p) => normalizeKey(p.status) === 'AGENDADO' && p.driverName && p.driverName !== '-',
  },
  {
    key: 'CNTR_COLETADO',
    title: 'CNTR Coletado',
    description: 'Container montado',
    icon: FaBox,
    gradient: 'from-emerald-500 to-green-600',
    lightBg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    filter: (p) => normalizeKey(p.status) === 'CONTAINER MONTADO',
  },
  {
    key: 'INICIAR_VIAGEM',
    title: 'Em Viagem',
    description: 'A caminho do cliente',
    icon: FaTruck,
    gradient: 'from-orange-500 to-amber-600',
    lightBg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700',
    filter: (p) => {
      const s = normalizeKey(p.status);
      return s === 'A CAMINHO DO CLIENTE' || s === 'PENDING';
    },
  },
  {
    key: 'CHEGADA_CLIENTE',
    title: 'No Cliente',
    description: 'Aguardando desova',
    icon: FaMapMarkerAlt,
    gradient: 'from-yellow-500 to-amber-500',
    lightBg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
    filter: (p) => normalizeKey(p.status) === 'AGUARDANDO DESOVA',
  },
  {
    key: 'OPERACAO_INICIADA',
    title: 'Em Desova',
    description: 'Operação iniciada',
    icon: FaShippingFast,
    gradient: 'from-rose-500 to-red-600',
    lightBg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
    filter: (p) => normalizeKey(p.status) === 'EM DESOVA',
  },
  {
    key: 'OPERACAO_FINALIZADA',
    title: 'Op. Finalizada',
    description: 'Desova concluída / anexando canhotos',
    icon: FaCheckCircle,
    gradient: 'from-teal-500 to-emerald-600',
    lightBg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-700',
    filter: (p) => normalizeKey(p.status) === 'ANEXANDO DOCUMENTOS FINAIS',
  },
  {
    key: 'VIAGEM_RETORNO',
    title: 'Retorno',
    description: 'Pend. devolução',
    icon: FaUndo,
    gradient: 'from-cyan-500 to-sky-600',
    lightBg: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-700',
    badge: 'bg-cyan-100 text-cyan-700',
    filter: (p) => {
      const s = normalizeKey(p.status);
      const isPendDevolucao = s === 'PEND. DEVOLUCAO' || s === 'PEND. DEVOLUÇÃO';
      const isFinalizado = s === 'FINALIZADO';
      const semDataDevolucao = !p.dtDevolucaoCNTR && !p.horarioDevolucaoVazio;
      return (isPendDevolucao || isFinalizado) && semDataDevolucao;
    },
  },
  {
    key: 'CNTR_ENTREGUE',
    title: 'CNTR Entregue',
    description: 'Container devolvido',
    icon: FaCheckCircle,
    gradient: 'from-green-600 to-teal-700',
    lightBg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    filter: (p) => {
      // Agora mostra qualquer entrega com horarioDevolucaoVazio ou dtDevolucaoCNTR preenchido
      return (
        !!p.horarioDevolucaoVazio || !!p.dtDevolucaoCNTR || p.containerReturned === true
      );
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
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
    label: 'Aguard. Desova',
    bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700',
    border: 'border-orange-300',
    badge: 'bg-orange-100 text-orange-800 border border-orange-300',
    icon: <FaExclamationTriangle />, gradient: 'from-orange-400 to-orange-600',
    ring: 'ring-orange-400/30', dot: 'bg-orange-500', hex: '#f97316'
  },
  'EM DESOVA': {
    label: 'Em Desova',
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

const resolveConfig = (rawStatus) => {
  const key = normalizeKey(rawStatus);
  if (key === 'ENTREGUE' || key === 'SUBMITTED' || key === 'ENTREGUE COM PENDENCIA CANHOTO') {
    return STATUS_CONFIG['ENTREGUE'];
  }
  if (key === 'PENDING' || key === 'A CAMINHO DO CLIENTE') {
    return STATUS_CONFIG['A CAMINHO DO CLIENTE'];
  }
  return STATUS_CONFIG[key] || null;
};

/* ─────────────────────────────────────────────────────────────
   GLOBAL ANIMATION STYLES
───────────────────────────────────────────────────────────── */
const GLOBAL_STYLES = `
@keyframes riseToTop {
  0%   { opacity: 0.6; transform: translateY(var(--rise-from, 120px)) scale(1.025);
    box-shadow: 0 24px 80px rgba(139,92,246,0.85), 0 0 0 2px rgba(139,92,246,0.7); }
  50%  { opacity: 1; transform: translateY(-12px) scale(1.01);
    box-shadow: 0 12px 50px rgba(139,92,246,0.6), 0 0 0 2px rgba(139,92,246,0.5); }
  100% { opacity: 1; transform: translateY(0) scale(1);
    box-shadow: 0 8px 30px rgba(139,92,246,0.28), 0 0 0 0 rgba(139,92,246,0); }
}
@keyframes glowPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); border-color: rgba(255,255,255,0.08); background: transparent; }
  30% { box-shadow: 0 0 30px rgba(139,92,246,0.45); border-color: rgba(139,92,246,0.55); background: rgba(139,92,246,0.1); }
}
.row-rise { animation: riseToTop 2.5s ease-in-out forwards; position: relative; z-index: 30; }
.row-glow { animation: glowPulse 3.5s ease-in-out forwards; position: relative; z-index: 20; }
@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
.panel-enter  { animation: slideInRight  0.3s cubic-bezier(0.34,1.2,0.64,1) forwards; }
.panel-exit   { animation: slideOutRight 0.25s ease-in forwards; }
@keyframes badgePopIn { 0% { transform: scale(0) rotate(-12deg); opacity: 0; } 70% { transform: scale(1.15) rotate(3deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
.badge-pop { animation: badgePopIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.monitor-table { grid-auto-rows: minmax(36px, auto); }
.cell-trunc { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

/* ─────────────────────────────────────────────────────────────
   SMALL COMPONENTS
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
const formatBoardDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
};

const getPunctualityStatus = (d, now = new Date(), city = 'manaus') => {
  if (!d) return { label: '-', type: 'unknown', eta: null, lateBy: null };
  const schedStr = getProgramacaoDate(d, city);
  if (!schedStr) return { label: 'Sem agendamento', type: 'unknown', eta: null, lateBy: null };
  const scheduled = new Date(schedStr);
  const arrival = d.horarioChegada ? new Date(d.horarioChegada) : null;
  const start = d.createdAt ? new Date(d.createdAt) : null;
  const travel = Number(d.estimatedTravelMinutes || d.minimumTravelMinutes || 40);

  const computeEta = () => {
    if (!start) return null;
    const expected = new Date(start.getTime() + travel * 60000);
    const diff = Math.round((expected - now) / 60000);
    return diff < 0 ? 0 : diff;
  };

  if (arrival) {
    const lateBy = Math.round((arrival - scheduled) / 60000);
    return {
      label: arrival.getTime() <= scheduled.getTime() ? 'Pontual' : 'Atrasado',
      type: arrival.getTime() <= scheduled.getTime() ? 'ok' : 'late',
      eta: 0, lateBy
    };
  }

  const eta = computeEta();
  if (now.getTime() >= scheduled.getTime()) return { label: 'Atrasado', type: 'late', eta: eta || 0, lateBy: null };
  if (!start) return { label: 'Sem início', type: 'unknown', eta, lateBy: null };
  const timeLeft = Math.round((scheduled - now) / 60000);
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
          {/* Exibe placa, buscando da base ycompany se disponível */}
          {delivery.placaYcompany || delivery.vehiclePlate || 'Placa'}
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
          <span className="truncate">{formatBoardDate(getProgramacaoDate(delivery, city))}</span>
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

const ProgressDots = ({ delivery, allModalDocsComplete }) => {
  let p = getProgress(delivery);
  if (normalizeKey(delivery.status) === 'FINALIZADO') {
    p = allModalDocsComplete(delivery) ? 100 : 90;
  }
  const total = 7;
  const filled = Math.ceil((p / 100) * total);
  const colorDot =
    p === 100 ? 'bg-emerald-500 shadow-sm shadow-emerald-400' :
    p >= 66 ? 'bg-amber-400 shadow-sm shadow-amber-300' :
    p >= 33 ? 'bg-indigo-500 shadow-sm shadow-indigo-300' :
    'bg-gray-300';

  return (
    <div className="flex items-center gap-1" title={`${p}%`}>
      <span className="text-[10px] font-bold text-gray-500 w-6 text-right">{p}%</span>
      <div className="flex gap-[3px]">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`block w-2 h-2 rounded-full transition-all ${
              i < filled
                ? `${colorDot} ${p < 100 && i === filled - 1 ? 'animate-pulse' : ''}`
                : 'bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const PunctualityCell = ({ p }) => {
  const styles = {
    ok: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400', ring: 'shadow-emerald-500/20' },
    possible: { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-300', dot: 'bg-amber-400', ring: 'shadow-amber-500/20' },
    late: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-300', dot: 'bg-red-400', ring: 'shadow-red-500/20' },
    unknown: { bg: 'bg-gray-700/30', border: 'border-gray-600/30', text: 'text-gray-400', dot: 'bg-gray-500', ring: '' },
  };
  const s = styles[p.type] || styles.unknown;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[100px]">
      <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${s.bg} ${s.border} ${s.text} shadow-md ${s.ring}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} ${p.type === 'late' ? 'animate-pulse' : ''}`} />
        {p.label}
      </span>

      <div className="flex items-center gap-1.5">
        {p.eta !== null && p.eta > 0 && (
          <span className="text-[9px] text-gray-500 font-mono">ETA {p.eta}m</span>
        )}
        {p.lateBy != null && p.lateBy !== 0 && (
          <span className={`text-[9px] font-bold font-mono ${p.lateBy > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {p.lateBy > 0 ? `+${p.lateBy}m` : `${p.lateBy}m`}
          </span>
        )}
      </div>
    </div>
  );
};

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
                  <option value="AGUARDANDO_DESOVA" className="bg-gray-900">Aguardando Desova</option>
                  <option value="EM_DESOVA" className="bg-gray-900">Em Desova</option>
                  <option value="DESOVA_FINALIZADA" className="bg-gray-900">Desova Finalizada</option>
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
            {getProgramacaoDate(d, city) ? new Date(getProgramacaoDate(d, city)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-600 text-[10px] uppercase font-bold">Chegada</p>
          <p className="text-gray-300 font-mono text-[11px]">
            {d.horarioChegada ? new Date(d.horarioChegada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
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
const getStatusEntryTime = (delivery) => {
  const status = normalizeKey(delivery.status);
  if (status === 'AGENDADO') return delivery.scheduledAt || delivery.dataAgendamento || delivery.createdAt;
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
  const prevStatusRef = useRef({});
  const rowRefs = useRef({});
  const prevPositions = useRef({});
  const RISE_WINDOW = 8000;

  const { theme, setTheme } = useTheme();
  const { city } = useCity();
  const themeConfig = THEMES[theme] || THEMES.dark;

  const statusMapToBackend = {
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
      .theme-light { background-color:#f5f7fa!important;color:#1a1a1a!important; }
      .theme-light .text-white{color:#1a1a1a!important}
      .theme-light .text-gray-300{color:#4b5563!important}
      .theme-light .text-gray-400{color:#6b7280!important}
      .theme-light .bg-white\\/5{background-color:rgba(0,0,0,0.04)!important}
      .theme-light .border-white\\/10{border-color:rgba(0,0,0,0.1)!important}
      .theme-light select,.theme-light input,.theme-light textarea{background-color:#f3f4f6!important;color:#1a1a1a!important}
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
    if (d.horarioInicioDesova) ev.push({ label: 'Início da desova', date: d.horarioInicioDesova });
    if (d.horarioFimDesova) ev.push({ label: 'Fim da desova', date: d.horarioFimDesova });
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

  const getLabelsForDelivery = (d) => {
    if (!d) return defaultDocumentLabels;
    return (d.city || '').toLowerCase() === 'itajai' ? (itajaiConfig.documents || {}) : defaultDocumentLabels;
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

  const formatDT = (v) => v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

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
      return String(label || '').replace(/[^ -]/g, '').trim();
    };

    const dispStatus = delivery.status === 'FINALIZADO' && allModalDocsComplete(delivery)
      ? 'DOCUMENTOS ENTREGUES'
      : delivery.status;

    const cfg = resolveConfig(dispStatus) || resolveConfig(delivery.status);
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
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageW - pdfMargin, 60, { align: 'right' }); // Ajustado de 54 para 60

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
      ['Placa', safe(delivery.placaYcompany || delivery.vehiclePlate)],
      ['Recebedor', safe(delivery.recebedor)],
      ['Status', safe(formatStatus(delivery.status, delivery))],
      ['Agendamento', formatDT(getProgramacaoDate(delivery, city))],
      ['Montagem Container', formatDT(delivery.containerMontadoAt)],
      ['Chegada', formatDT(delivery.horarioChegada)],
      ['Início Desova', formatDT(delivery.horarioInicioDesova)],
      ['Fim Desova', formatDT(delivery.horarioFimDesova)],
      ['Devolução Container Vazio', formatDT(delivery.horarioDevolucaoVazio)],
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
        doc.text(`• ${ev.label}: ${new Date(ev.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`, pdfMargin, y);
        y += 16;
      });
      y += 10;
    }

    // Documents
    const labels = getLabelsForDelivery(delivery);
    const docKeys = Object.keys(delivery.documents || {}).filter(k => !['chegadaCliente', 'inicioDesova', 'fimDesova'].includes(k));
    const fotoFields = [
      { key: 'chegadaCliente', label: 'Chegada no Cliente' },
      { key: 'inicioDesova', label: 'Início da Desova' },
      { key: 'fimDesova', label: 'Finalização da Desova' }
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

      const response = await adminService.getDeliveries(backendFilters, statsPeriod, periodDate);
      const data = response?.data?.deliveries || [];

      const normalized = data.map((d) => {
        if (d.status === 'ENTREGUE_COM_PENDENCIA_CANHOTO') d.status = 'FINALIZADO';
        return d;
      });


      // DEBUG: log entrega CAB43503
      const cab43503 = normalized.find(d => d.deliveryNumber === 'CAB43503' || d.processoCAB === 'CAB43503');
      if (cab43503) {
        // eslint-disable-next-line no-console
        console.log('DEBUG CAB43503:', cab43503);
      }
      setDeliveries(normalized);

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

  useEffect(() => {
    loadDeliveries();
    if (autoRefresh) {
      const t = setInterval(loadDeliveries, refreshInterval * 1000);
      return () => clearInterval(t);
    }
  }, [loadDeliveries, autoRefresh, refreshInterval]);

  useEffect(() => {
    let r = [...deliveries];

    if (statsPeriod === 'general' && filters.status !== 'all') {
      r = r.filter((d) => {
        if (filters.status === 'OPERACAO_FINALIZADA') return d.status === 'ENTREGUE' || d.status === 'submitted' || d.status === 'FINALIZADO';
        if (filters.status === 'A CAMINHO DO CLIENTE') return d.status === 'pending' || d.status === 'PENDING';
        if (filters.status === 'DOCUMENTOS_ENTREGUES') return d.status === 'FINALIZADO' && allModalDocsComplete(d);
        if (filters.status === 'FINALIZADO') return d.status === 'FINALIZADO' && !allModalDocsComplete(d);
        return d.status === filters.status;
      });
    }

    if (filters.searchTerm.trim()) {
      const q = filters.searchTerm.toLowerCase();
      r = r.filter((d) =>
        [d.deliveryNumber, d.driverName, d.userName, d.recebedor, d.vehiclePlate]
          .some((v) => String(v || '').toLowerCase().includes(q))
      );
    }

    const pad = (v) => String(v).padStart(2, '0');
    if (filters.startDate) {
      const sdStr = filters.startDate;
      r = r.filter((d) => {
        const agendDate = getProgramacaoDate(d, city);
        if (!agendDate) return false;
        const dt = new Date(agendDate);
        const dStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        return dStr >= sdStr;
      });
    }

    if (filters.endDate) {
      const edStr = filters.endDate;
      r = r.filter((d) => {
        const agendDate = getProgramacaoDate(d, city);
        if (!agendDate) return false;
        const dt = new Date(agendDate);
        const dStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        return dStr <= edStr;
      });
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
      if (prev !== undefined && prev !== d.status) updates[d._id] = Date.now();
      prevStatusRef.current[d._id] = d.status;
    });

    if (Object.keys(updates).length > 0) {
      prevPositions.current = capturedPositions;
      setRecentlyUpdated((prev) => ({ ...prev, ...updates }));
      setTimeout(() => {
        setRecentlyUpdated((prev) => {
          const next = { ...prev };
          Object.keys(updates).forEach((id) => delete next[id]);
          return next;
        });
      }, RISE_WINDOW + 500);
    }
  }, [filteredDeliveries]);

  // Agrupa entregas por container
  const displayList = useMemo(() => {
    const now = Date.now();
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

    // Ordena por atualização
    return result.sort((a, b) => {
      const aT = recentlyUpdated[a._id];
      const bT = recentlyUpdated[b._id];
      const aActive = aT && (now - aT) < RISE_WINDOW;
      const bActive = bT && (now - bT) < RISE_WINDOW;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      if (aActive && bActive) return bT - aT;
      return 0;
    });
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

  const handleDownload = async (id, type) => {
    try {
      const delivery = deliveries.find((d) => d._id === id);
      const docEntry = delivery?.documents?.[type];
      if (docEntry) {
        const urls = getDocumentUrlsArray(docEntry);
        if (urls.length > 0) {
          urls.forEach((url, i) => {
            const a = document.createElement('a');
            a.href = url;
            a.setAttribute('download', `${delivery.deliveryNumber || 'doc'}_${type}_${i + 1}`);
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
      a.setAttribute('download', `${deliveries.find((d) => d._id === id)?.deliveryNumber || 'doc'}_${type}.${ext}`);
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
      dataAgendamento: d.dataAgendamento?.slice(0, 16) || '',
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
            {currentTime.toLocaleTimeString('pt-BR')}
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
              {STATUS_COLUMNS.map((column) => (
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
                      const docStatus = getDocumentsStatus(d);
                      const isComplete = docStatus.includes('COMPLETO');
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
                                const entryTime = getStatusEntryTime(d);
                                return entryTime ? new Date(entryTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
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
                              const entryTime = getStatusEntryTime(d);
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
                              {getProgramacaoDate(d, city) ? new Date(getProgramacaoDate(d, city)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </span>
                          </div>

                          <div className="px-1 py-3 flex items-center justify-center min-w-0">
                            <PunctualityCell p={getPunctualityStatus(d, currentTime, city)} />
                          </div>

                          <div className="px-1 py-3 flex items-center justify-center min-w-0">
                            {isComplete
                              ? <FaCheckCircle className="text-emerald-400" title={docStatus} size={15} />
                              : <FaTimesCircle className="text-red-400/70" title={docStatus} size={15} />
                            }
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-[#1a1a2e] rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-purple-700/60 to-indigo-700/60 border-b border-white/10 flex-shrink-0">
              <div>
                <p className="text-xs text-purple-300 uppercase tracking-widest font-semibold mb-0.5">Entrega</p>
                <h2 className="text-xl font-black text-white tracking-wide">#{selectedDelivery.deliveryNumber}</h2>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Badge status={(selectedDelivery.status === 'FINALIZADO' && allModalDocsComplete(selectedDelivery)) ? 'DOCUMENTOS ENTREGUES' : selectedDelivery.status} />
                <button
                  onClick={() => setSelectedDelivery(null)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {[
                  ['Contratado', selectedDelivery.userName],
                  ['Motorista', selectedDelivery.driverName || '—'],
                  ['Placa', selectedDelivery.placaYcompany || selectedDelivery.vehiclePlate || '—'],
                  ['Data Devolução Container Vazio', selectedDelivery.horarioDevolucaoVazio ? new Date(selectedDelivery.horarioDevolucaoVazio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
                  ['Recebedor', selectedDelivery.recebedor || '—'],
                  ['Agendamento', getProgramacaoDate(selectedDelivery, city) ? new Date(getProgramacaoDate(selectedDelivery, city)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
                  ['Montagem Container', selectedDelivery.containerMontadoAt ? new Date(selectedDelivery.containerMontadoAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
                  ['Chegada', selectedDelivery.horarioChegada ? new Date(selectedDelivery.horarioChegada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
                  ['Início Desova', selectedDelivery.horarioInicioDesova ? new Date(selectedDelivery.horarioInicioDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
                  ['Fim Desova', selectedDelivery.horarioFimDesova ? new Date(selectedDelivery.horarioFimDesova).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white/5 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-0.5">{label}</p>
                    <p className="text-sm text-gray-100 font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              {flowHistory.length > 0 && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">📍 Histórico do Fluxo</p>
                  <div className="space-y-2">
                    {flowHistory.map((ev, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                        <span className="text-sm text-gray-200 flex-1">{ev.label}</span>
                        <span className="text-xs text-gray-500 font-mono">{new Date(ev.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Documentos e Fotos</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleShareDelivery}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 hover:text-emerald-200 text-xs font-semibold rounded-lg transition border border-emerald-500/20"
                    >
                      <FaShareAlt /> <span className="hidden sm:inline">Compartilhar</span>
                    </button>

                    <button
                      onClick={() => handleDownloadAll(selectedDelivery._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-200 text-xs font-semibold rounded-lg transition border border-blue-500/20"
                    >
                      <FaDownload /> <span className="hidden sm:inline">Baixar Tudo</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const labels = getLabelsForDelivery(selectedDelivery);

                    const docRows = Object.keys(selectedDelivery.documents || {})
                      .filter((k) => !['chegadaCliente', 'inicioDesova', 'fimDesova'].includes(k))
                      .map((k) => {
                        const present = !!selectedDelivery.documents[k];
                        return (
                          <div
                            key={k}
                            className={`flex items-center justify-between px-3 sm:px-4 py-3 rounded-xl border ${present ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-50'}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${present ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                              <span className="text-sm text-gray-300 font-semibold">{labels[k] || k}</span>
                              {!present && <span className="text-xs text-gray-600">Não anexado</span>}
                            </div>

                            {present && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setViewingDocument({ label: labels[k] || k, urls: getDocumentUrlsArray(selectedDelivery.documents[k]) })}
                                  className="w-7 h-7 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 flex items-center justify-center transition"
                                >
                                  <FaEye size={11} />
                                </button>

                                <button
                                  onClick={() => handleDownload(selectedDelivery._id, k)}
                                  className="w-7 h-7 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 flex items-center justify-center transition"
                                >
                                  <FaDownload size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      });

                    const fotoFields = [
                      { key: 'chegadaCliente', label: 'Chegada no Cliente' },
                      { key: 'inicioDesova', label: 'Início da Desova' },
                      { key: 'fimDesova', label: 'Finalização da Desova' }
                    ];

                    const fotosRows = fotoFields.map((f) => {
                      const files = getDocumentUrlsArray(selectedDelivery.documents?.[f.key]);
                      const present = files.length > 0;
                      return (
                        <div
                          key={f.key}
                          className={`flex items-center justify-between px-3 sm:px-4 py-3 rounded-xl border ${present ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-50'}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${present ? 'bg-sky-400' : 'bg-gray-600'}`} />
                            <span className="text-sm text-gray-300 font-semibold">{f.label}</span>
                            {present && <span className="text-xs text-gray-500">{files.length} foto(s)</span>}
                            {!present && <span className="text-xs text-gray-600">Não anexado</span>}
                          </div>

                          {present && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setModalFotos({ label: f.label, files })}
                                className="w-7 h-7 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 flex items-center justify-center transition"
                              >
                                <FaEye size={11} />
                              </button>

                              <button
                                onClick={() => files.forEach((url, i) => {
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.setAttribute('download', `${f.label.replace(/\s+/g, '_')}_${i + 1}.jpg`);
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                })}
                                className="w-7 h-7 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 flex items-center justify-center transition"
                              >
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

              <p className="text-[10px] text-gray-600 text-right border-t border-white/5 pt-4">
                Criado em {selectedDelivery.createdAt ? new Date(selectedDelivery.createdAt).toLocaleString('pt-BR') : '—'}
              </p>
            </div>

            {canEdit() && (
              <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-white/10 bg-white/[0.02] flex justify-end gap-3">
                <button
                  onClick={() => handleEditStart(selectedDelivery)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-200 text-sm font-semibold transition border border-blue-500/20"
                >
                  <FaEdit /> Editar
                </button>

                <button
                  onClick={() => handleDelete(selectedDelivery._id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-200 text-sm font-semibold transition border border-red-500/20"
                >
                  <FaTrash /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>
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
                  <option value="AGUARDANDO_DESOVA" className="bg-gray-900">Aguardando Desova</option>
                  <option value="EM_DESOVA" className="bg-gray-900">Em Desova</option>
                  <option value="DESOVA_FINALIZADA" className="bg-gray-900">Desova Finalizada</option>
                  <option value="ANEXANDO_DOCUMENTOS_FINAIS" className="bg-gray-900">Anexando Docs Finais</option>
                  <option value="CANCELADO" className="bg-gray-900">Cancelado</option>
                </select>
              </div>

              {[
                ['Data Agendamento', 'dataAgendamento'],
                ['Data Devolução Container Vazio', 'horarioDevolucaoVazio'],
                ['Horário Chegada', 'horarioChegada'],
                ['Início Desova', 'horarioInicioDesova'],
                ['Fim Desova', 'horarioFimDesova'],
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
    </div>
  );
};

export default MonitorEntregas;
