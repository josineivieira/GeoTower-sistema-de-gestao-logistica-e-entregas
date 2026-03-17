import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { deliveryService } from '../services/authService';
import Footer from '../components/Footer';
import {
  FaChartBar, FaFileAlt, FaUsers, FaCalendarAlt,
  FaCheckCircle, FaBoxes, FaTruck, FaTachometerAlt,
  FaLayerGroup, FaIdCard, FaTable, FaArrowRight,
  FaShieldAlt, FaClock, FaMapMarkerAlt, FaStar,
  FaBell, FaRocket, FaChevronRight, FaBolt,
  // ── novos ──
  FaUserTie, FaWater, FaBullseye, FaSatelliteDish,
  FaCog, FaChartLine, FaDatabase, FaSun, FaMoon,
  FaCloudSun, FaTasks, FaClipboardList,
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';

/* ═══════════════════════════════════════════════════════════
   BRAND TOKENS — Refined Palette
═══════════════════════════════════════════════════════════ */
const B = {
  v:     '#6C4FF8',
  vL:    '#9B7FFF',
  vD:    '#4A30D4',
  vBg:   '#EEE9FF',
  vBg2:  '#F7F5FF',
  m:     '#10B981',
  mL:    '#6EE7B7',
  mD:    '#059669',
  mBg:   '#D1FAE5',
  mBg2:  '#ECFDF5',
  accent:'#F59E0B',
  pink:  '#EC4899',
  blue:  '#3B82F6',
  bg:    '#F4F3FA',
  card:  '#FFFFFF',
  txt:   '#0F0A2E',
  txt2:  '#5B6280',
  txt3:  '#9CA3AF',
  bdr:   '#E4DEF7',
  wht:   '#FFFFFF',
};

/* ═══════════════════════════════════════════════════════════
   ROLE CONFIG
═══════════════════════════════════════════════════════════ */
const ROLES = {
  driver:  { label: 'Motorista',  color: B.m,       bg: B.mBg,    icon: <FaTruck />,   gradient: `linear-gradient(135deg,${B.m},${B.mD})` },
  manager: { label: 'Gerente',    color: B.v,       bg: B.vBg,    icon: <FaUserTie />, gradient: `linear-gradient(135deg,${B.v},${B.vD})` },
  admin:   { label: 'Admin',      color: '#6C4FF8', bg: '#EEE9FF', icon: <FaBolt />,   gradient: 'linear-gradient(135deg,#6C4FF8,#4A30D4)' },
  geomar:  { label: 'GeoMar',     color: '#0891B2', bg: '#E0F7FA', icon: <FaWater />,  gradient: 'linear-gradient(135deg,#0891B2,#0E7490)' },
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Bom dia',   Icon: FaSun,      sub: 'Pronto para um dia produtivo?' };
  if (h < 18) return { text: 'Boa tarde', Icon: FaCloudSun, sub: 'Continue o excelente trabalho!' };
  return             { text: 'Boa noite', Icon: FaMoon,     sub: 'Encerrando o dia com qualidade.' };
};

const useCounter = (target, duration = 900) => {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const start = prev.current;
    const diff = target - start;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(start + diff * ease));
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = target;
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
};

/* ═══════════════════════════════════════════════════════════
   GLOBAL STYLES
═══════════════════════════════════════════════════════════ */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

    * { font-family: 'Inter', sans-serif; }

    @keyframes floatA {
      0%,100% { transform: translateY(0px) scale(1); }
      50%      { transform: translateY(-22px) scale(1.05); }
    }
    @keyframes floatB {
      0%,100% { transform: translateY(0px) rotate(0deg); }
      50%      { transform: translateY(-14px) rotate(10deg); }
    }
    @keyframes floatC {
      0%,100% { transform: translateY(-10px); }
      50%      { transform: translateY(10px); }
    }
    @keyframes fadeSlideUp {
      from { opacity:0; transform:translateY(32px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity:0; }
      to   { opacity:1; }
    }
    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    @keyframes pulse-ring {
      0%   { transform:scale(0.95); box-shadow:0 0 0 0 rgba(108,79,248,.5); }
      70%  { transform:scale(1);    box-shadow:0 0 0 10px rgba(108,79,248,0); }
      100% { transform:scale(0.95); box-shadow:0 0 0 0 rgba(108,79,248,0); }
    }
    @keyframes pulse-dot {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:.4; transform:scale(1.8); }
    }
    @keyframes gradient-x {
      0%,100% { background-position:0% 50%; }
      50%      { background-position:100% 50%; }
    }
    @keyframes spin-slow {
      from { transform:rotate(0deg); }
      to   { transform:rotate(360deg); }
    }
    @keyframes border-flow {
      0%,100% { border-color: rgba(108,79,248,.3); }
      50%      { border-color: rgba(16,185,129,.3); }
    }
    @keyframes count-in {
      from { opacity:0; transform:scale(.7) translateY(8px); }
      to   { opacity:1; transform:scale(1) translateY(0); }
    }
    @keyframes slide-in-right {
      from { opacity:0; transform:translateX(24px); }
      to   { opacity:1; transform:translateX(0); }
    }
    @keyframes glow-pulse {
      0%,100% { opacity:.5; }
      50%      { opacity:1; }
    }

    .g-fade     { animation: fadeSlideUp .6s cubic-bezier(.22,1,.36,1) both; }
    .g-fadein   { animation: fadeIn .5s ease both; }
    .g-float-a  { animation: floatA 7s ease-in-out infinite; }
    .g-float-b  { animation: floatB 9s ease-in-out infinite; }
    .g-float-c  { animation: floatC 5.5s ease-in-out infinite; }

    .g-card {
      transition: transform .35s cubic-bezier(.34,1.56,.64,1),
                  box-shadow .35s ease,
                  border-color .25s ease;
    }
    .g-card:hover { transform: translateY(-6px) !important; }
    .g-btn:active { transform: scale(.96) !important; }

    .shimmer-bg {
      background: linear-gradient(90deg,#ece9f5 25%,#ddd8f0 50%,#ece9f5 75%);
      background-size: 600px 100%;
      animation: shimmer 1.6s infinite linear;
    }

    .geo-gradient-text {
      background: linear-gradient(135deg, ${B.v} 0%, #A78BFA 45%, ${B.m} 100%);
      background-size: 200% 200%;
      animation: gradient-x 4s ease infinite;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero-bg {
      background: linear-gradient(145deg,
        #0F0A2E 0%, #1A1245 30%, #0D2240 60%, #0A2E1F 100%);
    }

    .glass-card {
      background: rgba(255,255,255,.06);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,.12);
    }

    .stat-glow { animation: glow-pulse 3s ease-in-out infinite; }

    .delay-1 { animation-delay:.08s; }
    .delay-2 { animation-delay:.16s; }
    .delay-3 { animation-delay:.24s; }
    .delay-4 { animation-delay:.32s; }
    .delay-5 { animation-delay:.40s; }
    .delay-6 { animation-delay:.48s; }

    .tag-pill {
      display:inline-flex; align-items:center; gap:4px;
      font-size:10px; font-weight:700; letter-spacing:.06em;
      text-transform:uppercase; padding:4px 10px;
      border-radius:999px;
    }

    scrollbar-width: thin;
    ::-webkit-scrollbar { width:5px; }
    ::-webkit-scrollbar-track { background:#F4F3FA; }
    ::-webkit-scrollbar-thumb { background:${B.vBg}; border-radius:99px; }
  `}</style>
);

/* ═══════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════ */
const SkeletonCard = () => (
  <div className="bg-white rounded-3xl p-6 overflow-hidden" style={{ border: `1px solid ${B.bdr}` }}>
    <div className="shimmer-bg h-3 w-20 rounded-full mb-5" />
    <div className="shimmer-bg h-9 w-16 rounded-xl mb-3" />
    <div className="shimmer-bg h-2 w-24 rounded-full mb-1" />
    <div className="shimmer-bg h-1.5 w-full rounded-full mt-4" />
  </div>
);

/* ═══════════════════════════════════════════════════════════
   SECTION HEADER — Refined
═══════════════════════════════════════════════════════════ */
const SectionHeader = ({ icon, title, subtitle, action, delay = 0 }) => (
  <div className="g-fade mb-6" style={{ animationDelay: `${delay}ms` }}>
    <div className="flex items-center justify-between">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
          style={{
            background: `linear-gradient(135deg,${B.v}20,${B.m}15)`,
            border: `1.5px solid ${B.v}25`,
            boxShadow: `0 4px 12px ${B.v}15`,
          }}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-base font-black tracking-tight" style={{ color: B.txt, letterSpacing: '-.02em' }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs mt-0.5 font-medium" style={{ color: B.txt3 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && action}
    </div>
    <div className="mt-3 ml-12 flex items-center gap-2">
      <div
        className="h-[2px] w-12 rounded-full"
        style={{ background: `linear-gradient(90deg,${B.v},${B.m})` }}
      />
      <div
        className="h-[2px] w-4 rounded-full"
        style={{ background: `${B.v}20` }}
      />
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   STAT CARD — Glassmorphism / Premium
═══════════════════════════════════════════════════════════ */
const StatCard = ({ icon, label, value, sub, accent, progressValue, loading, delay = 0 }) => {
  const animated = useCounter(typeof value === 'number' ? value : 0, 1000);
  if (loading) return <SkeletonCard />;
  const display = typeof value === 'string' ? value : (value === 0 ? '0' : animated);

  return (
    <div
      className="g-card g-fade relative overflow-hidden rounded-3xl bg-white flex flex-col cursor-default"
      style={{
        boxShadow: `0 2px 20px ${accent}12, 0 8px 32px ${accent}08`,
        border: `1.5px solid ${accent}18`,
        animationDelay: `${delay}ms`,
        padding: '0',
      }}
    >
      <div
        className="h-1 w-full rounded-t-3xl flex-shrink-0"
        style={{ background: `linear-gradient(90deg,${accent}ee,${accent}44,transparent)` }}
      />

      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between">
          <p className="text-[10px] font-black uppercase tracking-[.12em]" style={{ color: B.txt3 }}>
            {label}
          </p>
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg,${accent}18,${accent}08)`,
              border: `1px solid ${accent}20`,
              boxShadow: `inset 0 1px 0 ${accent}15`,
            }}
          >
            <span style={{ color: accent, fontSize: '0.95rem' }}>{icon}</span>
          </div>
        </div>

        <div>
          <p
            className="text-[2.6rem] font-black leading-none tabular-nums"
            style={{
              color: accent,
              letterSpacing: '-.03em',
              textShadow: `0 2px 12px ${accent}30`,
            }}
          >
            {display}
          </p>
          {sub && (
            <p className="text-[11px] mt-1.5 font-medium" style={{ color: B.txt3 }}>
              {sub}
            </p>
          )}
        </div>

        {progressValue !== undefined && (
          <div className="mt-auto">
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: `${accent}10` }}>
              <div
                className="h-full rounded-full transition-all duration-[1.2s] ease-out"
                style={{
                  width: `${Math.min(progressValue, 100)}%`,
                  background:
                    progressValue >= 90 ? `linear-gradient(90deg,${B.m},#34D399)` :
                    progressValue >= 70 ? 'linear-gradient(90deg,#F59E0B,#FCD34D)' :
                                          'linear-gradient(90deg,#EF4444,#F87171)',
                  boxShadow: progressValue >= 90 ? `0 0 10px ${B.m}60` : 'none',
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] font-semibold" style={{ color: B.txt3 }}>Meta 90%</span>
              <span
                className="text-[10px] font-black"
                style={{
                  color: progressValue >= 90 ? B.mD :
                         progressValue >= 70 ? '#D97706' : '#DC2626',
                }}
              >
                {progressValue}% atingido
              </span>
            </div>
          </div>
        )}
      </div>

      <div
        className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none opacity-[0.04] rounded-full"
        style={{ background: accent, transform: 'translate(30%,30%)' }}
      />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   DRIVER QUICK-ACTION CARD
═══════════════════════════════════════════════════════════ */
const DriverCard = ({ onClick, accentColor, accentDark, icon, title, description, tag, delay = 0 }) => (
  <button
    onClick={onClick}
    className="g-card g-btn g-fade group relative rounded-3xl text-left overflow-hidden w-full bg-white"
    style={{
      boxShadow: `0 4px 24px ${accentColor}14`,
      border: `1.5px solid ${accentColor}20`,
      animationDelay: `${delay}ms`,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = `0 16px 48px ${accentColor}30`;
      e.currentTarget.style.borderColor = `${accentColor}50`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = `0 4px 24px ${accentColor}14`;
      e.currentTarget.style.borderColor = `${accentColor}20`;
    }}
  >
    <div
      className="relative overflow-hidden px-6 pt-6 pb-5"
      style={{
        background: `linear-gradient(135deg,${accentColor}10,${accentDark || accentColor}06)`,
        borderBottom: `1px solid ${accentColor}12`,
      }}
    >
      <div
        className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none opacity-[0.08] g-float-a"
        style={{ background: `radial-gradient(circle,${accentColor},transparent)` }}
      />
      {tag && (
        <span className="tag-pill mb-3 block w-fit" style={{ background: `${accentColor}15`, color: accentColor }}>
          {tag}
        </span>
      )}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-400 group-hover:scale-110 group-hover:-rotate-3"
        style={{
          background: `linear-gradient(135deg,${accentColor},${accentDark || accentColor})`,
          boxShadow: `0 8px 24px ${accentColor}45`,
        }}
      >
        <span className="text-white text-lg">{icon}</span>
      </div>
    </div>

    <div className="px-6 py-5 flex flex-col gap-3">
      <h3 className="text-[15px] font-extrabold leading-tight" style={{ color: B.txt, letterSpacing: '-.02em' }}>
        {title}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: B.txt2 }}>
        {description}
      </p>
      <div
        className="flex items-center gap-2 text-xs font-bold mt-1 transition-all duration-300 group-hover:gap-3"
        style={{ color: accentColor }}
      >
        <span>Acessar agora</span>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1"
          style={{ background: `${accentColor}18` }}
        >
          <FaArrowRight style={{ fontSize: '8px' }} />
        </div>
      </div>
    </div>
  </button>
);

/* ═══════════════════════════════════════════════════════════
   MONITOR CARD (large — admin panels)
═══════════════════════════════════════════════════════════ */
const MonitorCard = ({ onClick, disabled, accentColor, accentDark, icon, titleIcon, title, description, viewOnly, delay = 0 }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`g-card g-btn g-fade group relative rounded-3xl text-left overflow-hidden w-full bg-white
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    style={{
      boxShadow: `0 4px 24px ${accentColor}10`,
      border: `1.5px solid ${accentColor}18`,
      animationDelay: `${delay}ms`,
      minHeight: 260,
    }}
    onMouseEnter={e => {
      if (!disabled) {
        e.currentTarget.style.boxShadow = `0 20px 56px ${accentColor}28`;
        e.currentTarget.style.borderColor = `${accentColor}45`;
      }
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = `0 4px 24px ${accentColor}10`;
      e.currentTarget.style.borderColor = `${accentColor}18`;
    }}
  >
    <div
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg,${accentColor}16,${accentDark || accentColor}08)`,
        borderBottom: `1px solid ${accentColor}14`,
        padding: '28px 28px 22px',
      }}
    >
      <div
        className="g-float-b absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle,${accentColor}14,transparent 70%)` }}
      />
      <div
        className="absolute bottom-0 left-1/3 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle,${accentColor}08,transparent)` }}
      />

      <div
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl mb-4 transition-all duration-400 group-hover:scale-110 group-hover:-rotate-3"
        style={{
          background: `linear-gradient(135deg,${accentColor},${accentDark || accentColor})`,
          boxShadow: `0 10px 30px ${accentColor}50`,
        }}
      >
        <span className="text-white text-2xl">{icon}</span>
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg,rgba(255,255,255,.25) 0%,transparent 60%)' }}
        />
      </div>

      {/* Título com ícone profissional */}
      <h3
        className="text-xl font-black flex items-center gap-2.5"
        style={{ color: B.txt, letterSpacing: '-.03em' }}
      >
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0"
          style={{
            background: `${accentColor}18`,
            color: accentColor,
            fontSize: '0.75rem',
          }}
        >
          {titleIcon}
        </span>
        {title}
      </h3>
    </div>

    <div className="p-7 pt-5 flex flex-col gap-4">
      <p className="text-sm leading-relaxed" style={{ color: B.txt2 }}>
        {description}
      </p>

      {viewOnly && (
        <span
          className="tag-pill w-fit"
          style={{ background: '#FEF9C3', color: '#92400E', border: '1px solid #FDE68A' }}
        >
          <FaShieldAlt style={{ fontSize: '8px' }} /> Somente Visualização
        </span>
      )}

      <div
        className="inline-flex items-center gap-2 text-[13px] font-bold px-4 py-2.5 rounded-xl w-fit
                   transition-all duration-300 group-hover:gap-3"
        style={{
          background: `linear-gradient(135deg,${accentColor}16,${accentColor}08)`,
          color: accentColor,
          border: `1px solid ${accentColor}22`,
        }}
      >
        <span>Acessar painel</span>
        <FaArrowRight style={{ fontSize: '10px' }} />
      </div>
    </div>
  </button>
);

/* ═══════════════════════════════════════════════════════════
   MANAGE CARD (compact grid — admin tools)
═══════════════════════════════════════════════════════════ */
const ManageCard = ({ onClick, disabled, accentColor, accentDark, icon, titleIcon, title, description, viewOnly, delay = 0 }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`g-card g-btn g-fade group relative rounded-3xl text-left w-full bg-white overflow-hidden
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    style={{
      boxShadow: `0 2px 16px ${accentColor}08`,
      border: `1.5px solid ${accentColor}16`,
      animationDelay: `${delay}ms`,
    }}
    onMouseEnter={e => {
      if (!disabled) {
        e.currentTarget.style.boxShadow = `0 14px 40px ${accentColor}22`;
        e.currentTarget.style.borderColor = `${accentColor}45`;
      }
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = `0 2px 16px ${accentColor}08`;
      e.currentTarget.style.borderColor = `${accentColor}16`;
    }}
  >
    <div
      className="absolute left-0 top-0 bottom-0 w-[3px]"
      style={{
        background: `linear-gradient(180deg,${accentColor},${accentDark || accentColor}55)`,
        borderRadius: '3px 0 0 3px',
      }}
    />

    <div className="pl-5 pr-5 pt-5 pb-5">
      {/* Ícone principal + título com ícone secundário */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                     transition-all duration-350 group-hover:scale-110 group-hover:rotate-3 shadow-sm"
          style={{
            background: `linear-gradient(135deg,${accentColor}18,${accentColor}08)`,
            border: `1.5px solid ${accentColor}22`,
          }}
        >
          <span style={{ color: accentColor, fontSize: '1rem' }}>{icon}</span>
        </div>
        <h3
          className="text-sm font-extrabold leading-tight flex items-center gap-2"
          style={{ color: B.txt, letterSpacing: '-.015em' }}
        >
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0"
            style={{
              background: `${accentColor}15`,
              color: accentColor,
              fontSize: '0.6rem',
            }}
          >
            {titleIcon}
          </span>
          {title}
        </h3>
      </div>

      <p className="text-[11px] leading-relaxed mb-4" style={{ color: B.txt2 }}>
        {description}
      </p>

      {viewOnly && (
        <span className="tag-pill mb-3 block w-fit" style={{ background: '#FEF3C7', color: '#B45309' }}>
          <FaShieldAlt style={{ fontSize: '8px' }} /> Visualização
        </span>
      )}

      <div
        className="flex items-center gap-1.5 text-xs font-bold transition-all duration-300 group-hover:gap-2.5"
        style={{ color: accentColor }}
      >
        <span>Acessar</span>
        <FaChevronRight style={{ fontSize: '9px' }} />
      </div>
    </div>

    <div
      className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full pointer-events-none opacity-[0.05]"
      style={{ background: accentColor }}
    />
  </button>
);

/* ═══════════════════════════════════════════════════════════
   HERO MINI KPI ROW (driver)
═══════════════════════════════════════════════════════════ */
const HeroKpiRow = ({ statsToday }) => (
  <div className="g-fade delay-4 flex flex-col gap-2.5 w-full lg:w-72">
    <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/50 mb-1">
      Resumo de Hoje
    </p>
    {[
      { label: 'Programadas', value: statsToday.total,      color: '#A78BFA', bg: 'rgba(167,139,250,.12)' },
      { label: 'Concluídas',  value: statsToday.completed,  color: '#34D399', bg: 'rgba(52,211,153,.12)'  },
      { label: 'Em Rota',     value: statsToday.inProgress, color: '#60A5FA', bg: 'rgba(96,165,250,.12)'  },
    ].map(({ label, value, color, bg }) => (
      <div
        key={label}
        className="flex items-center justify-between px-4 py-3 rounded-2xl"
        style={{ background: bg, border: `1px solid ${color}22`, backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-[12px] font-semibold text-white/75">{label}</span>
        </div>
        <span className="text-xl font-black tabular-nums" style={{ color }}>{value}</span>
      </div>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statsTodayTab, setStatsTodayTab] = useState('today');
  const [statsToday,   setStatsToday]     = useState({ total:0, completed:0, inProgress:0, onTimePercentage:100 });
  const [statsGeneral, setStatsGeneral]   = useState({ total:0, completed:0, inProgress:0, onTimePercentage:100 });
  const [loading,  setLoading]  = useState(false);
  const [now,      setNow]      = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const hasAccess      = (roles) => !!user?.role && roles.includes(user.role);
  const isViewOnly     = () => false; // Libera acesso total para geomar
  const canAccessAdmin = () => hasAccess(['manager','admin','geomar']);

  useEffect(() => {
    if (user?.role === 'driver') loadStats();
    // eslint-disable-next-line
  }, [user]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await deliveryService.getProgramacoesAssigned();
      const all = res.data.programacoes || [];
      const nome = (user?.username || user?.name || '').trim().toUpperCase();
      const mine = all.filter(p => String(p.contratado).trim().toUpperCase() === nome);

      const calc = (list) => {
        const total      = list.length;
        const completed  = list.filter(e => String(e.status).toUpperCase() === 'ENTREGUE').length;
        const inProgress = list.filter(e => String(e.status).toUpperCase() === 'EM_ROTA').length;

        // Pontualidade: considera entregas com horário agendado e horário de chegada
        let onTimeCount = 0;
        let punctualTotal = 0;
        list.forEach(e => {
          const sched = e.dataAgendamento || e.data; // suporte a ambas chaves
          const arrival = e.horarioChegada || e.arrivedAt || null;
          if (sched && arrival) {
            punctualTotal += 1;
            const schedDate = new Date(sched);
            const arrivalDate = new Date(arrival);
            if (arrivalDate.getTime() <= schedDate.getTime()) onTimeCount += 1;
          }
        });

        const onTimePercentage = punctualTotal === 0 ? 100 : Math.round((onTimeCount / punctualTotal) * 100);
        return { total, completed, inProgress, onTimePercentage };
      };

      const d = new Date(); d.setHours(0,0,0,0);
      const hoje = mine.filter(e => {
        const dataStr = e.dataAgendamento || e.data;
        if (!dataStr) return false;
        const ed = new Date(dataStr); ed.setHours(0,0,0,0);
        return ed.getTime() === d.getTime();
      });

      setStatsToday(calc(hoje));
      setStatsGeneral(calc(mine));
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stats  = statsTodayTab === 'today' ? statsToday : statsGeneral;
  const role   = user?.role;
  const rm     = ROLES[role] || ROLES.driver;
  const greet  = getGreeting();
  const GreetIcon = greet.Icon;
  const dateStr = now.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

  /* tabs com ícones */
  const TABS = [
    { id:'today',   label:'Hoje',  Icon: FaCalendarAlt },
    { id:'general', label:'Geral', Icon: FaChartLine   },
  ];

  return (
    <div style={{ background: B.bg, minHeight: '100%' }}>
      <GlobalStyles />

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <div className="hero-bg relative overflow-hidden">

        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.018]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px',
          }}
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),
                              linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />

        {/* Glow orbs */}
        <div
          className="g-float-a absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle,${B.v}35 0%,transparent 65%)` }}
        />
        <div
          className="g-float-b absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle,${B.m}30 0%,transparent 65%)` }}
        />
        <div
          className="g-float-c absolute top-1/3 right-1/3 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle,#3B82F625 0%,transparent 65%)` }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-14 sm:py-20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">

            {/* LEFT */}
            <div className="flex-1 g-fade">

              {/* Top badges row */}
              <div className="flex flex-wrap items-center gap-2.5 mb-6">

                {/* Role badge */}
                <div
                  className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[11px] font-black"
                  style={{
                    background: 'rgba(255,255,255,.1)',
                    border: '1px solid rgba(255,255,255,.18)',
                    backdropFilter: 'blur(8px)',
                    color: '#fff',
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: rm.color, animation: 'pulse-dot 2s infinite', boxShadow: `0 0 6px ${rm.color}` }}
                  />
                  <span style={{ color: rm.color, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center' }}>
                    {rm.icon}
                  </span>
                  {rm.label}
                </div>

                {/* System badge */}
                <div
                  className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[11px] font-bold"
                  style={{
                    background: 'rgba(108,79,248,.2)',
                    border: '1px solid rgba(108,79,248,.3)',
                    color: '#C4B5FD',
                  }}
                >
                  <FaTruck style={{ fontSize: '0.7rem' }} /> GeoTower
                </div>

                {/* Clock */}
                <div
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold"
                  style={{
                    background: 'rgba(245,158,11,.12)',
                    border: '1px solid rgba(245,158,11,.25)',
                    color: '#FCD34D',
                  }}
                >
                  <FaClock style={{ fontSize: '9px' }} /> {timeStr}
                </div>
              </div>

              {/* Greeting line */}
              <p className="text-sm font-semibold mb-2 text-white/50 flex items-center gap-2">
                <GreetIcon style={{ fontSize: '0.85rem', opacity: 0.7 }} />
                {greet.text} — {greet.sub}
              </p>

              {/* Name */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.08] mb-4">
                <span className="geo-gradient-text">
                  {user?.fullName || user?.name || 'Usuário'}
                </span>
              </h1>

              {/* Tagline */}
              <p className="text-sm sm:text-base text-white/55 max-w-md leading-relaxed font-medium">
                Bem-vindo ao painel de{' '}
                <span style={{ color: '#C4B5FD' }}>Gerenciamento Logístico</span>{' '}
                da <span style={{ color: '#6EE7B7' }}>GeoTower</span>.
                Tudo em um só lugar.
              </p>

              {/* Date strip */}
              <div className="mt-6 flex items-center gap-3">
                <div
                  className="h-px w-10 rounded-full"
                  style={{ background: 'linear-gradient(90deg,rgba(108,79,248,.6),rgba(16,185,129,.6))' }}
                />
                <span className="capitalize text-xs font-semibold text-white/35">{dateStr}</span>
              </div>
            </div>



            {/* RIGHT: Illustration (non-driver) */}
            {role !== 'driver' && (
              <div className="g-fade delay-4 hidden lg:flex items-center justify-center flex-shrink-0">
                <div className="relative w-44 h-44">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ border: `2px dashed rgba(108,79,248,.3)`, animation: 'spin-slow 20s linear infinite' }}
                  />
                  <div
                    className="absolute inset-4 rounded-full"
                    style={{ border: `1.5px dashed rgba(16,185,129,.2)`, animation: 'spin-slow 14s linear infinite reverse' }}
                  />
                  <div
                    className="absolute inset-10 rounded-3xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg,rgba(108,79,248,.2),rgba(16,185,129,.15))',
                      border: '1.5px solid rgba(255,255,255,.12)',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 20px 60px rgba(108,79,248,.25)',
                    }}
                  >
                    {/* Ícone profissional no lugar do emoji 📊 */}
                    <FaChartBar style={{ fontSize: '2.8rem', color: '#A78BFA', opacity: 0.9 }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Wave divider */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full"
          viewBox="0 0 1440 40" fill="none"
          preserveAspectRatio="none"
          style={{ height: 40 }}
        >
          <path d="M0,40 C480,0 960,0 1440,40 L1440,40 L0,40 Z" fill={B.bg} />
        </svg>
      </div>

      {/* ══════════════════════════════════════════════════════
          PAGE CONTENT
      ══════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-28">

        {/* ─── DRIVER: Ações rápidas e atalho do motorista logado ─── */}
        {role === 'driver' && (
          <>
            <SectionHeader
              icon={<FaBullseye style={{ color: B.v, fontSize: '0.85rem' }} />}
              title="Ações Rápidas"
              subtitle="Acesse as funcionalidades mais utilizadas"
              delay={80}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
              <DriverCard
                onClick={() => navigate(`/entregas-programadas?motorista=${encodeURIComponent(user?.name || user?.username || '')}`)}
                accentColor={B.v}
                accentDark={B.vD}
                icon={<FaCalendarAlt />}
                title="Entregas Programadas"
                description="Visualize todas as entregas agendadas vinculadas ao seu perfil."
                tag="Agendamento"
                delay={0}
              />
              <DriverCard
                onClick={() => navigate('/minhas-entregas')}
                accentColor={B.m}
                accentDark={B.mD}
                icon={<FaBoxes />}
                title="Minhas Entregas"
                description="Acompanhe todas as suas entregas em tempo real, histórico e status atualizado."
                tag="Operacional"
                delay={80}
              />
              <DriverCard
                onClick={() => navigate('/entregas-canhotos-pendentes')}
                accentColor="#EC4899"
                accentDark="#BE185D"
                icon={<FaFileAlt />}
                title="Canhotos Pendentes"
                description="Anexe os canhotos das entregas abertas para manter toda documentação em dia."
                tag="Documentação"
                delay={160}
              />
            </div>
          </>
        )}

        {/* ─── ADMIN / MANAGER / GEOMAR ─── */}
        {canAccessAdmin() && (
          <>
            {/* Monitoring */}
            <SectionHeader
              icon={<FaSatelliteDish style={{ color: B.v, fontSize: '0.85rem' }} />}
              title="Monitoramento & Relatórios"
              subtitle="Acompanhe em tempo real todas as operações e entregas"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-14">
              <MonitorCard
                onClick={() => navigate('/admin')}
                disabled={false}
                accentColor={B.v}
                accentDark={B.vD}
                icon={<FaChartBar />}
                titleIcon={<FaChartLine />}
                title="Dashboard Analytics"
                description="Análise completa com KPIs, gráficos interativos e relatórios detalhados sobre todas as operações logísticas da empresa."
                viewOnly={false}
                delay={0}
              />
              <MonitorCard
                onClick={() => navigate('/monitor-entregas')}
                disabled={false}
                accentColor="#4F46E5"
                accentDark="#3730A3"
                icon={<FaTachometerAlt />}
                titleIcon={<FaBullseye />}
                title="Torre de Controle"
                description="Monitore todas as entregas em tempo real com filtros avançados, busca inteligente e rastreamento completo da operação."
                viewOnly={false}
                delay={120}
              />
            </div>

            {/* Management grid: Oculto para geomar */}
            {role !== 'geomar' && (
              <>
                <SectionHeader
                  icon={<FaCog style={{ color: B.v, fontSize: '0.85rem' }} />}
                  title="Gerenciamento & Configurações"
                  subtitle="Controle total sobre usuários, motoristas e programações"
                  delay={60}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
                  {hasAccess(['manager']) && (
                    <ManageCard
                      onClick={() => navigate('/usuarios')}
                      accentColor="#8B5CF6"
                      accentDark="#6D28D9"
                      icon={<FaUsers />}
                      titleIcon={<FaUsers />}
                      title="Usuários"
                      description="Criar, editar e controlar perfis de todos os usuários do sistema."
                      delay={0}
                    />
                  )}
                  <ManageCard
                    onClick={() => navigate('/motoristas')}
                    disabled={false}
                    accentColor={B.m}
                    accentDark={B.mD}
                    icon={<FaIdCard />}
                    titleIcon={<FaTruck />}
                    title="Motoristas"
                    description="Gerenciar motoristas, dados, rastreadores e contatos da frota."
                    viewOnly={false}
                    delay={80}
                  />
                  <ManageCard
                    onClick={() => navigate('/programacoes')}
                    disabled={false}
                    accentColor="#0891B2"
                    accentDark="#0E7490"
                    icon={<FaLayerGroup />}
                    titleIcon={<FaBoxes />}
                    title="Programações"
                    description="Gerenciar programações de entregas com todos os detalhes e vínculos."
                    viewOnly={false}
                    delay={160}
                  />
                  {hasAccess(['manager','admin']) && (
                    <ManageCard
                      onClick={() => navigate('/base-dados-geral')}
                      accentColor="#059669"
                      accentDark="#047857"
                      icon={<FaTable />}
                      titleIcon={<FaDatabase />}
                      title="Base de Dados"
                      description="Visualizar todos os dados das programações em formato de tabela completa."
                      delay={240}
                    />
                  )}
                  {hasAccess(['manager']) && (
                    <ManageCard
                      onClick={() => navigate('/ycompany')}
                      accentColor="#DC2626"
                      accentDark="#991B1B"
                      icon={<FaTable />}
                      titleIcon={<FaDatabase />}
                      title="Icompany"
                      description="Base de dados com operações marítimas, rastreamento e documentação logística."
                      delay={320}
                    />
                  )}
                </div>
              </>
            )}

            {/* Status strip */}
            <div
              className="g-fade delay-5 rounded-3xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center
                         justify-between gap-4"
              style={{
                background: `linear-gradient(135deg,${B.vBg2},${B.mBg2})`,
                border: `1.5px solid ${B.bdr}`,
                boxShadow: `0 4px 20px ${B.v}08`,
              }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg,${B.v}18,${B.m}12)`,
                    border: `1px solid ${B.v}20`,
                  }}
                >
                  <HiSparkles style={{ color: B.v, fontSize: '1.1rem' }} />
                </div>
                <div>
                  <p className="text-sm font-black" style={{ color: B.txt, letterSpacing: '-.01em' }}>
                    Sistema GeoTower — Operacional
                  </p>
                  <p className="text-xs mt-0.5 font-medium" style={{ color: B.txt2 }}>
                    Todas as funcionalidades estão ativas e funcionando normalmente.
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 text-[11px] font-black px-3.5 py-2 rounded-full flex-shrink-0"
                style={{
                  background: `${B.m}15`,
                  color: B.mD,
                  border: `1.5px solid ${B.m}30`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: B.m, animation: 'pulse-dot 2s infinite' }}
                />
                Todos os sistemas online
              </div>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Home;
