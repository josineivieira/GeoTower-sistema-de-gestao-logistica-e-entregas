import React, { memo } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { getDesovaStepLabel } from '../utils/cityLabels';

const normalizeKey = (s) => {
  if (!s) return '';
  return String(s).replace(/_/g, ' ').toUpperCase().trim();
};

const getStatusConfig = (city = 'manaus') => {
  const desovaLabel = getDesovaStepLabel(city);
  return {
    AGENDADO: {
      label: 'Não Iniciado',
      bg: 'bg-indigo-600', light: 'bg-indigo-50', text: 'text-indigo-700',
      border: 'border-indigo-300',
      badge: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
      icon: '📅', gradient: 'from-indigo-500 to-indigo-700',
      ring: 'ring-indigo-400/30', dot: 'bg-indigo-500', hex: '#6366f1'
    },
    'CONTAINER MONTADO': {
      label: 'Container Montado',
      bg: 'bg-sky-600', light: 'bg-sky-50', text: 'text-sky-700',
      border: 'border-sky-300',
      badge: 'bg-sky-100 text-sky-800 border border-sky-300',
      icon: '📦', gradient: 'from-sky-500 to-sky-700',
      ring: 'ring-sky-400/30', dot: 'bg-sky-500', hex: '#0ea5e9'
    },
    'A CAMINHO DO CLIENTE': {
      label: 'A Caminho do Cliente',
      bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700',
      border: 'border-amber-300',
      badge: 'bg-amber-100 text-amber-800 border border-amber-300',
      icon: '🚚', gradient: 'from-amber-400 to-amber-600',
      ring: 'ring-amber-400/30', dot: 'bg-amber-500', hex: '#f59e0b'
    },
    'AGUARDANDO DESOVA': {
      label: `Aguard. ${desovaLabel}`,
      bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700',
      border: 'border-orange-300',
      badge: 'bg-orange-100 text-orange-800 border border-orange-300',
      icon: '⚠️', gradient: 'from-orange-400 to-orange-600',
      ring: 'ring-orange-400/30', dot: 'bg-orange-500', hex: '#f97316'
    },
    'EM DESOVA': {
      label: `Em ${desovaLabel}`,
      bg: 'bg-violet-600', light: 'bg-violet-50', text: 'text-violet-700',
      border: 'border-violet-300',
      badge: 'bg-violet-100 text-violet-800 border border-violet-300',
      icon: '📦', gradient: 'from-violet-500 to-violet-700',
      ring: 'ring-violet-400/30', dot: 'bg-violet-500', hex: '#8b5cf6'
    },
    'ANEXANDO DOCUMENTOS FINAIS': {
      label: 'Anexando Docs',
      bg: 'bg-pink-600', light: 'bg-pink-50', text: 'text-pink-700',
      border: 'border-pink-300',
      badge: 'bg-pink-100 text-pink-800 border border-pink-300',
      icon: '📄', gradient: 'from-pink-500 to-pink-700',
      ring: 'ring-pink-400/30', dot: 'bg-pink-500', hex: '#ec4899'
    },
    ENTREGUE: {
      label: 'Entregue',
      bg: 'bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700',
      border: 'border-emerald-300',
      badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      icon: '✅', gradient: 'from-emerald-500 to-emerald-700',
      ring: 'ring-emerald-400/30', dot: 'bg-emerald-500', hex: '#10b981'
    },
    CANCELADO: {
      label: 'Cancelado',
      bg: 'bg-gray-500', light: 'bg-gray-50', text: 'text-gray-600',
      border: 'border-gray-300',
      badge: 'bg-gray-100 text-gray-600 border border-gray-300',
      icon: '❌', gradient: 'from-gray-400 to-gray-600',
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

// Memoized Badge component
export const MemoizedBadge = memo(({ status, city = 'manaus' }) => {
  const cfg = getResolveConfig(status, city);
  const label = cfg?.label || normalizeKey(status);
  const cls = cfg?.badge || 'bg-gray-100 text-gray-700 border border-gray-300';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}, (prev, next) => prev.status === next.status && prev.city === next.city);

MemoizedBadge.displayName = 'MemoizedBadge';

// Memoized Progress Dots
const progressStatuses = [
  'AGENDADO', 'CONTAINER MONTADO', 'A CAMINHO DO CLIENTE',
  'AGUARDANDO DESOVA', 'EM DESOVA', 'ANEXANDO DOCUMENTOS FINAIS', 'ENTREGUE'
];

const getProgress = (delivery) => {
  const key = normalizeKey(delivery.status);
  const norm =
    key === 'ENTREGUE' || key === 'SUBMITTED' || key === 'ENTREGUE COM PENDENCIA CANHOTO' || key === 'DOCUMENTOS ENTREGUES' ? 'ENTREGUE'
    : key === 'PENDING' || key === 'A CAMINHO DO CLIENTE' ? 'A CAMINHO DO CLIENTE'
    : key;
  if (norm === 'CANCELADO' || !norm) return 0;
  const idx = progressStatuses.indexOf(norm);
  if (idx === -1) return 0;
  return Math.round((idx / (progressStatuses.length - 1)) * 100);
};

export const MemoizedProgressDots = memo(({ delivery, allModalDocsComplete }) => {
  let p = getProgress(delivery);
  const statusKey = normalizeKey(delivery.status);
  if (statusKey === 'FINALIZADO') {
    p = allModalDocsComplete(delivery) ? 100 : 90;
  } else if (statusKey === 'DOCUMENTOS ENTREGUES') {
    p = 100;
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
}, (prev, next) => prev.delivery._id === next.delivery._id && prev.delivery.status === next.delivery.status);

MemoizedProgressDots.displayName = 'MemoizedProgressDots';

// Memoized Punctuality Cell
export const MemoizedPunctualityCell = memo(({ p }) => {
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
}, (prev, next) => {
  return prev.p.label === next.p.label && 
         prev.p.type === next.p.type && 
         prev.p.eta === next.p.eta &&
         prev.p.lateBy === next.p.lateBy;
});

MemoizedPunctualityCell.displayName = 'MemoizedPunctualityCell';

// Status badge com checkmark
export const MemoizedStatusCheckmark = memo(({ status, allModalDocsComplete, delivery }) => {
  const isComplete = status.includes('COMPLETO') || (normalizeKey(delivery.status) === 'FINALIZADO' && allModalDocsComplete(delivery));
  return isComplete
    ? <FaCheckCircle className="text-emerald-400" title={status} size={15} />
    : <span className="text-red-400/70" title={status} size={15}>✗</span>;
}, (prev, next) => {
  return prev.status === next.status && prev.delivery._id === next.delivery._id;
});

MemoizedStatusCheckmark.displayName = 'MemoizedStatusCheckmark';
