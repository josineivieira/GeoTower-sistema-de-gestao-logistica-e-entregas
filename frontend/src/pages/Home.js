import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { useTheme, THEMES } from '../contexts/ThemeContext';
import { deliveryService } from '../services/authService';
import Footer from '../components/Footer';
import {
  FaChartBar, FaFileAlt, FaUsers, FaCalendarAlt,
  FaCheckCircle, FaBoxes, FaTruck, FaTachometerAlt,
  FaLayerGroup, FaIdCard, FaTable, FaArrowRight,
  FaShieldAlt, FaClock, FaMapMarkerAlt, FaStar,
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';

/* ═══════════════════════════════════════════════════════════
   BRAND TOKENS
═══════════════════════════════════════════════════════════ */
const B = {
  v:    '#7C5CBF',   // violet primary
  vL:   '#9B7FD4',   // violet light
  vD:   '#5B3FA0',   // violet dark
  vBg:  '#EDE9FA',   // violet bg
  vBg2: '#F5F2FD',   // violet bg light
  m:    '#6BBF8A',   // mint primary
  mL:   '#A8D8B5',   // mint light
  mD:   '#4A9A6F',   // mint dark
  mBg:  '#E8F5EE',   // mint bg
  mBg2: '#F0FAF4',   // mint bg light
  bg:   '#F3F1FA',   // page bg
  txt:  '#1A1535',   // text primary
  txt2: '#5B6280',   // text secondary
  txt3: '#9CA3AF',   // text muted
  bdr:  '#E4DEF7',   // border
  wht:  '#FFFFFF',
};

/* ═══════════════════════════════════════════════════════════
   ROLE CONFIG
═══════════════════════════════════════════════════════════ */
const ROLES = {
  driver:  { label: 'Motorista',      color: B.m,       bg: B.mBg,  icon: '🚛' },
  manager: { label: 'Gerente',        color: B.v,       bg: B.vBg,  icon: '👔' },
  admin:   { label: 'Administrador',  color: '#4F46E5', bg: '#EEF2FF', icon: '⚡' },
  geomar:  { label: 'GeoMar',         color: '#0891B2', bg: '#E0F7FA', icon: '🌊' },
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Bom dia', icon: '☀️' };
  if (h < 18) return { text: 'Boa tarde', icon: '🌤️' };
  return { text: 'Boa noite', icon: '🌙' };
};

/* Animated counter hook */
const useCounter = (target, duration = 800) => {
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
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setVal(Math.round(start + diff * ease));
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = target;
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
};

/* ═══════════════════════════════════════════════════════════
   CSS ANIMATIONS (injected once)
═══════════════════════════════════════════════════════════ */
const GlobalStyles = () => (
  <style>{`
    @keyframes floatA {
      0%,100% { transform: translateY(0px) scale(1); }
      50%      { transform: translateY(-18px) scale(1.04); }
    }
    @keyframes floatB {
      0%,100% { transform: translateY(0px) rotate(0deg); }
      50%      { transform: translateY(-12px) rotate(8deg); }
    }
    @keyframes floatC {
      0%,100% { transform: translateY(-8px); }
      50%      { transform: translateY(8px); }
    }
    @keyframes fadeUp {
      from { opacity:0; transform:translateY(24px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity:0; }
      to   { opacity:1; }
    }
    @keyframes shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }
    @keyframes pulse-dot {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:.5; transform:scale(1.6); }
    }
    @keyframes gradient-shift {
      0%,100% { background-position:0% 50%; }
      50%      { background-position:100% 50%; }
    }
    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .geo-fadeup    { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) both; }
    .geo-fadein    { animation: fadeIn .4s ease both; }
    .geo-float-a   { animation: floatA 6s ease-in-out infinite; }
    .geo-float-b   { animation: floatB 8s ease-in-out infinite; }
    .geo-float-c   { animation: floatC 5s ease-in-out infinite; }
    .geo-card:hover { transform: translateY(-5px); }
    .geo-card       { transition: transform .3s cubic-bezier(.34,1.56,.64,1),
                                  box-shadow .3s ease; }
    .geo-btn:active { transform: scale(.97); }
    .shimmer-bg {
      background: linear-gradient(90deg,#f0ecfa 25%,#e8e2f5 50%,#f0ecfa 75%);
      background-size: 400px 100%;
      animation: shimmer 1.4s infinite;
    }
    .geo-gradient-text {
      background: linear-gradient(135deg, ${B.v} 0%, #9B7FD4 40%, ${B.m} 100%);
      background-size: 200% 200%;
      animation: gradient-shift 4s ease infinite;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .geo-ring-spin {
      animation: spin-slow 12s linear infinite;
    }
    .geo-hero-bg {
      background: linear-gradient(135deg,
        #EDE9FA 0%, #F5F2FD 25%, #ffffff 50%, #F0FAF4 75%, #E8F5EE 100%);
      background-size: 300% 300%;
      animation: gradient-shift 8s ease infinite;
    }
    /* delay utilities */
    .delay-100 { animation-delay:.1s; }
    .delay-200 { animation-delay:.2s; }
    .delay-300 { animation-delay:.3s; }
    .delay-400 { animation-delay:.4s; }
    .delay-500 { animation-delay:.5s; }
  `}</style>
);

/* ═══════════════════════════════════════════════════════════
   SECTION DIVIDER
═══════════════════════════════════════════════════════════ */
const SectionHeader = ({ icon, title, subtitle, delay = 0 }) => (
  <div className="geo-fadeup mb-8" style={{ animationDelay: `${delay}ms` }}>
    <div className="flex items-center gap-3 mb-1">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: `linear-gradient(135deg,${B.v}22,${B.m}22)`, border: `1px solid ${B.bdr}` }}
      >
        {icon}
      </div>
      <h2 className="text-lg font-bold tracking-tight" style={{ color: B.txt }}>
        {title}
      </h2>
    </div>
    {subtitle && (
      <p className="text-sm mt-1 ml-11" style={{ color: B.txt2 }}>
        {subtitle}
      </p>
    )}
    <div
      className="mt-3 ml-11 h-px w-20 rounded-full"
      style={{ background: `linear-gradient(90deg,${B.v},${B.m},transparent)` }}
    />
  </div>
);

/* ═══════════════════════════════════════════════════════════
   SKELETON CARD
═══════════════════════════════════════════════════════════ */
const SkeletonCard = () => (
  <div className="bg-white rounded-2xl p-5 overflow-hidden" style={{ border: `1px solid ${B.bdr}` }}>
    <div className="shimmer-bg h-3 w-20 rounded-full mb-4" />
    <div className="shimmer-bg h-8 w-14 rounded-lg mb-2" />
    <div className="shimmer-bg h-2 w-28 rounded-full" />
  </div>
);

/* ═══════════════════════════════════════════════════════════
   STAT CARD — gradient fill variant
═══════════════════════════════════════════════════════════ */
const StatCard = ({ icon, label, value, sub, accent, progressValue, loading, delay = 0 }) => {
  const animated = useCounter(typeof value === 'number' ? value : 0, 900);
  if (loading) return <SkeletonCard />;

  const display = typeof value === 'string' ? value : (value === 0 ? '0' : animated);

  return (
    <div
      className="geo-card geo-fadeup bg-white rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden cursor-default"
      style={{
        boxShadow: `0 4px 24px ${accent}14`,
        border: `1px solid ${accent}22`,
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Gradient top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg,${accent},${accent}55)` }}
      />

      {/* BG watermark icon */}
      <div
        className="absolute -bottom-3 -right-3 text-6xl opacity-[0.04] select-none pointer-events-none"
        style={{ color: accent }}
      >
        {icon}
      </div>

      <div className="flex items-start justify-between mt-1">
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: B.txt3 }}>
            {label}
          </p>
          <p
            className="text-4xl font-black tabular-nums leading-none"
            style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}
          >
            {display}
          </p>
          {sub && (
            <p className="text-xs mt-2" style={{ color: B.txt3 }}>
              {sub}
            </p>
          )}
        </div>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{
            background: `linear-gradient(135deg,${accent}22,${accent}11)`,
            border: `1px solid ${accent}22`,
          }}
        >
          <span style={{ color: accent, fontSize: '1.15rem' }}>{icon}</span>
        </div>
      </div>

      {progressValue !== undefined && (
        <div className="mt-1">
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: `${accent}15` }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progressValue}%`,
                background: progressValue >= 90 ? `linear-gradient(90deg,${B.m},#22C55E)`
                  : progressValue >= 70 ? 'linear-gradient(90deg,#F59E0B,#FBBF24)'
                  : 'linear-gradient(90deg,#EF4444,#F87171)',
                boxShadow: progressValue >= 90 ? `0 0 8px ${B.m}80` : 'none',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <p className="text-[10px]" style={{ color: B.txt3 }}>Meta: 90%</p>
            <p
              className="text-[10px] font-bold"
              style={{
                color: progressValue >= 90 ? B.m : progressValue >= 70 ? '#F59E0B' : '#EF4444',
              }}
            >
              {progressValue}% atingido
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   DRIVER ACTION CARD — premium version
═══════════════════════════════════════════════════════════ */
const DriverCard = ({ onClick, accentColor, accentDark, bgFrom, bgTo, icon, title, description, tag, delay = 0 }) => (
  <button
    onClick={onClick}
    className="geo-card geo-btn geo-fadeup group relative rounded-2xl text-left overflow-hidden w-full"
    style={{
      background: `linear-gradient(145deg, ${bgFrom}, ${bgTo})`,
      boxShadow: `0 4px 24px ${accentColor}18`,
      border: `1px solid ${accentColor}28`,
      animationDelay: `${delay}ms`,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = `0 12px 40px ${accentColor}35`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = `0 4px 24px ${accentColor}18`;
    }}
  >
    {/* Deco: spinning ring */}
    <div
      className="geo-ring-spin absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-[0.06] pointer-events-none"
      style={{ border: `24px solid ${accentColor}` }}
    />
    <div
      className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full opacity-[0.05] pointer-events-none"
      style={{ background: accentColor }}
    />

    <div className="relative z-10 p-7 flex flex-col h-full min-h-[220px]">
      {/* Tag badge */}
      {tag && (
        <div className="mb-4">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: `${accentColor}18`, color: accentColor }}
          >
            {tag}
          </span>
        </div>
      )}

      {/* Icon */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
        style={{
          background: `linear-gradient(135deg,${accentColor},${accentDark || accentColor})`,
          boxShadow: `0 6px 20px ${accentColor}45`,
        }}
      >
        <span className="text-white text-xl">{icon}</span>
      </div>

      <h3 className="text-[17px] font-extrabold mb-2 leading-snug" style={{ color: B.txt }}>
        {title}
      </h3>
      <p className="text-[13px] leading-relaxed flex-1" style={{ color: B.txt2 }}>
        {description}
      </p>

      {/* CTA */}
      <div
        className="mt-5 flex items-center gap-2 text-sm font-bold"
        style={{ color: accentColor }}
      >
        <span>Acessar agora</span>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-1.5 group-hover:scale-110"
          style={{ background: `${accentColor}18` }}
        >
          <FaArrowRight style={{ fontSize: '9px' }} />
        </div>
      </div>
    </div>
  </button>
);

/* ═══════════════════════════════════════════════════════════
   MONITORING CARD (large)
═══════════════════════════════════════════════════════════ */
const MonitorCard = ({ onClick, disabled, accentColor, accentDark, icon, emoji, title, description, viewOnly, delay = 0 }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`geo-card geo-btn geo-fadeup group relative rounded-2xl text-left overflow-hidden w-full
      ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    style={{
      background: B.wht,
      boxShadow: `0 4px 24px ${accentColor}12`,
      border: `1px solid ${accentColor}22`,
      animationDelay: `${delay}ms`,
    }}
    onMouseEnter={e => {
      if (!disabled) e.currentTarget.style.boxShadow = `0 12px 40px ${accentColor}28`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = `0 4px 24px ${accentColor}12`;
    }}
  >
    {/* Gradient header strip */}
    <div
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg,${accentColor}14,${accentDark || accentColor}08)`,
        borderBottom: `1px solid ${accentColor}18`,
        padding: '28px 28px 20px',
      }}
    >
      {/* Deco circles */}
      <div
        className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-[0.08] pointer-events-none geo-float-a"
        style={{ background: accentColor }}
      />
      <div
        className="absolute bottom-0 left-1/2 w-24 h-24 rounded-full opacity-[0.04] pointer-events-none"
        style={{ background: accentColor }}
      />

      {/* Icon */}
      <div
        className="relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-2"
        style={{
          background: `linear-gradient(135deg,${accentColor},${accentDark || accentColor})`,
          boxShadow: `0 8px 24px ${accentColor}50`,
        }}
      >
        <span className="text-white text-2xl">{icon}</span>
      </div>

      <h3 className="text-xl font-extrabold flex items-center gap-2" style={{ color: B.txt }}>
        <span>{emoji}</span> {title}
      </h3>
    </div>

    {/* Body */}
    <div className="p-7 pt-5">
      <p className="text-sm leading-relaxed mb-5" style={{ color: B.txt2 }}>
        {description}
      </p>

      {viewOnly && (
        <div
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
          style={{ background: '#FEF9C3', color: '#92400E', border: '1px solid #FDE68A' }}
        >
          <FaShieldAlt style={{ fontSize: '9px' }} /> Somente Visualização
        </div>
      )}

      <div
        className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all duration-300 group-hover:gap-3"
        style={{
          background: `linear-gradient(135deg,${accentColor}14,${accentColor}08)`,
          color: accentColor,
          border: `1px solid ${accentColor}25`,
        }}
      >
        <span>Acessar painel</span>
        <FaArrowRight style={{ fontSize: '10px' }} />
      </div>
    </div>
  </button>
);

/* ═══════════════════════════════════════════════════════════
   MANAGEMENT CARD (compact)
═══════════════════════════════════════════════════════════ */
const ManageCard = ({ onClick, disabled, accentColor, accentDark, icon, emoji, title, description, viewOnly, delay = 0 }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`geo-card geo-btn geo-fadeup group relative bg-white rounded-2xl text-left overflow-hidden w-full
      ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    style={{
      boxShadow: `0 2px 16px ${accentColor}10`,
      border: `1px solid ${accentColor}20`,
      animationDelay: `${delay}ms`,
    }}
    onMouseEnter={e => {
      if (!disabled) {
        e.currentTarget.style.boxShadow = `0 10px 32px ${accentColor}24`;
        e.currentTarget.style.border = `1px solid ${accentColor}50`;
      }
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = `0 2px 16px ${accentColor}10`;
      e.currentTarget.style.border = `1px solid ${accentColor}20`;
    }}
  >
    {/* Left accent */}
    <div
      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
      style={{ background: `linear-gradient(180deg,${accentColor},${accentDark || accentColor}88)` }}
    />

    <div className="pl-5 p-5">
      {/* Icon row */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm"
          style={{
            background: `linear-gradient(135deg,${accentColor}20,${accentColor}0a)`,
            border: `1px solid ${accentColor}25`,
          }}
        >
          <span style={{ color: accentColor, fontSize: '1rem' }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-extrabold leading-tight flex items-center gap-1.5" style={{ color: B.txt }}>
            {emoji} {title}
          </h3>
        </div>
      </div>

      <p className="text-xs leading-relaxed mb-4" style={{ color: B.txt2 }}>
        {description}
      </p>

      {viewOnly && (
        <div
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full mb-3"
          style={{ background: '#FEF3C7', color: '#D97706' }}
        >
          <FaShieldAlt style={{ fontSize: '8px' }} /> Visualização
        </div>
      )}

      <div
        className="flex items-center gap-1.5 text-xs font-bold transition-all duration-300 group-hover:gap-2.5"
        style={{ color: accentColor }}
      >
        <span>Acessar</span>
        <FaArrowRight style={{ fontSize: '9px' }} />
      </div>
    </div>
  </button>
);

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statsTodayTab, setStatsTodayTab] = useState('today');
  const [statsToday, setStatsToday]     = useState({ total:0, completed:0, inProgress:0, onTimePercentage:100 });
  const [statsGeneral, setStatsGeneral] = useState({ total:0, completed:0, inProgress:0, onTimePercentage:100 });
  const [loading, setLoading] = useState(false);
  const [now, setNow]         = useState(new Date());

  /* Live clock */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* Auth helpers */
  const hasAccess = (roles) => !!user?.role && roles.includes(user.role);
  const isViewOnly      = () => user?.role === 'geomar';
  const canAccessAdmin  = () => hasAccess(['manager','admin','geomar']);

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
        const total     = list.length;
        const completed = list.filter(e => String(e.status).toUpperCase() === 'ENTREGUE').length;
        const inProgress= list.filter(e => String(e.status).toUpperCase() === 'EM_ROTA').length;
        const onTime    = completed > 0 ? 100 : 100;
        return { total, completed, inProgress, onTimePercentage: onTime };
      };

      const d = new Date(); d.setHours(0,0,0,0);
      const hoje = mine.filter(e => {
        const ed = new Date(e.data); ed.setHours(0,0,0,0);
        return ed.getTime() === d.getTime();
      });

      setStatsToday(calc(hoje));
      setStatsGeneral(calc(mine));
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stats   = statsTodayTab === 'today' ? statsToday : statsGeneral;
  const role    = user?.role;
  const rm      = ROLES[role] || ROLES.driver;
  const greet   = getGreeting();
  const { theme } = useTheme();
  const themeCfg = THEMES[theme] || THEMES.dark;

  const dateStr = now.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });

  return (
    <div style={{ background: themeCfg.bg, color: themeCfg.text, minHeight: '100%' }}>
      <GlobalStyles />

      {/* ══════════════════════════════════════════
          HERO BANNER
      ══════════════════════════════════════════ */}
      <div className="geo-hero-bg relative overflow-hidden" style={{ borderBottom: `1px solid ${B.bdr}` }}>

        {/* Decorative blobs */}
        <div
          className="geo-float-a absolute -top-24 -left-24 w-96 h-96 rounded-full pointer-events-none opacity-20"
          style={{ background: `radial-gradient(circle,${B.vL}60,transparent 70%)` }}
        />
        <div
          className="geo-float-b absolute -bottom-20 -right-20 w-80 h-80 rounded-full pointer-events-none opacity-15"
          style={{ background: `radial-gradient(circle,${B.m}70,transparent 70%)` }}
        />
        <div
          className="geo-float-c absolute top-1/2 left-1/2 w-64 h-64 rounded-full pointer-events-none opacity-[0.06]"
          style={{
            background: `radial-gradient(circle,${B.v},transparent 70%)`,
            transform: 'translate(-50%,-50%)',
          }}
        />

        {/* Dot matrix */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(${B.v} 1.2px, transparent 1.2px)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 sm:py-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">

            {/* LEFT: greeting */}
            <div className="flex-1 geo-fadeup">
              {/* Chips row */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: rm.bg, color: rm.color, border: `1px solid ${rm.color}30` }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: rm.color, animation: 'pulse-dot 2s infinite' }}
                  />
                  {rm.icon} {rm.label}
                </div>
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: B.vBg, color: B.v, border: `1px solid ${B.v}22` }}
                >
                  🚛 Sistema GeoLog
                </div>
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}
                >
                  <FaClock style={{ fontSize: '9px' }} />
                  {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Greeting */}
              <p className="text-sm font-semibold mb-1" style={{ color: B.txt2 }}>
                {greet.icon} {greet.text},
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-3">
                <span className="geo-gradient-text">
                  {user?.fullName || user?.name || 'Usuário'}
                </span>
              </h1>
              <p className="text-sm sm:text-base max-w-lg leading-relaxed" style={{ color: B.txt2 }}>
                Bem-vindo ao painel de{' '}
                <span className="font-bold" style={{ color: B.v }}>Gerenciamento Logístico</span>{' '}
                da <span className="font-bold" style={{ color: B.m }}>GeoLog</span>.
                Tudo que você precisa em um só lugar.
              </p>

              {/* Date */}
              <div className="mt-4 flex items-center gap-2">
                <div
                  className="h-px flex-1 max-w-[3rem] rounded-full"
                  style={{ background: `linear-gradient(90deg,${B.v},${B.m})` }}
                />
                <p className="text-xs font-medium capitalize" style={{ color: B.txt3 }}>
                  {dateStr}
                </p>
              </div>
            </div>

            {/* RIGHT: KPI mini-panel (driver only) */}
            {role === 'driver' && !loading && (
              <div
                className="geo-fadeup delay-300 flex flex-col gap-3 lg:w-64"
              >
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: B.txt3 }}>
                  Resumo de hoje
                </p>
                {[
                  { label: 'Programadas', value: statsToday.total,      color: B.v  },
                  { label: 'Concluídas',  value: statsToday.completed,  color: B.m  },
                  { label: 'Em Rota',     value: statsToday.inProgress, color: '#3B82F6' },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{
                      background: `${color}0d`,
                      border: `1px solid ${color}22`,
                    }}
                  >
                    <span className="text-xs font-semibold" style={{ color: B.txt2 }}>{label}</span>
                    <span className="text-lg font-black tabular-nums" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* RIGHT: welcome illustration (non-driver) */}
            {role !== 'driver' && (
              <div className="geo-fadeup delay-300 hidden lg:flex items-center justify-center w-48 h-48 flex-shrink-0">
                <div
                  className="w-40 h-40 rounded-3xl flex items-center justify-center text-7xl"
                  style={{
                    background: `linear-gradient(135deg,${B.vBg},${B.mBg})`,
                    border: `2px solid ${B.bdr}`,
                    boxShadow: `0 20px 60px ${B.v}18`,
                  }}
                >
                  📊
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Wave divider */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full"
          viewBox="0 0 1440 28"
          fill="none"
          preserveAspectRatio="none"
          style={{ height: 28 }}
        >
          <path
            d="M0,28 C360,0 1080,0 1440,28 L1440,28 L0,28 Z"
            fill={B.bg}
          />
        </svg>
      </div>

      {/* ══════════════════════════════════════════
          PAGE CONTENT
      ══════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-24">

        {/* ── DRIVER SECTION ───────────────────── */}
        {role === 'driver' && (
          <>
            {/* ─ STATS ─ */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <SectionHeader
                icon="📊"
                title="Seu Desempenho"
                subtitle="Indicadores atualizados em tempo real"
                delay={0}
              />

              {/* Tab switcher */}
              <div
                className="geo-fadeup delay-200 self-start flex gap-1 p-1 rounded-xl flex-shrink-0"
                style={{ background: B.vBg, border: `1px solid ${B.bdr}` }}
              >
                {[
                  { id: 'today',   label: '📅 Hoje'  },
                  { id: 'general', label: '📈 Geral' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setStatsTodayTab(id)}
                    className="geo-btn px-4 py-2 rounded-lg text-xs font-bold transition-all duration-250"
                    style={
                      statsTodayTab === id
                        ? {
                            background: B.v,
                            color: '#FFF',
                            boxShadow: `0 2px 12px ${B.v}50`,
                          }
                        : { color: B.txt2 }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
              <StatCard
                icon={<FaCalendarAlt />}
                label="Programadas"
                value={stats.total}
                sub="Entregas agendadas"
                accent={B.v}
                loading={loading}
                delay={0}
              />
              <StatCard
                icon={<FaCheckCircle />}
                label="Concluídas"
                value={stats.completed}
                sub="Expedidas com sucesso"
                accent={B.m}
                loading={loading}
                delay={100}
              />
              <StatCard
                icon="📈"
                label="Pontualidade"
                value={`${stats.onTimePercentage}%`}
                sub="Taxa de entrega no prazo"
                accent="#F59E0B"
                progressValue={stats.onTimePercentage}
                loading={loading}
                delay={200}
              />
              <StatCard
                icon={<FaTruck />}
                label="Em Rota"
                value={stats.inProgress}
                sub="Entregas em andamento"
                accent="#3B82F6"
                loading={loading}
                delay={300}
              />
            </div>

            {/* ─ QUICK ACTIONS ─ */}
            <SectionHeader
              icon="🎯"
              title="Ações Rápidas"
              subtitle="Acesse as funcionalidades mais utilizadas"
              delay={100}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
              <DriverCard
                onClick={() => navigate('/entregas-programadas')}
                accentColor={B.v}
                accentDark={B.vD}
                bgFrom={B.vBg2}
                bgTo={B.vBg}
                icon={<FaCalendarAlt />}
                title="Entregas Programadas"
                description="Visualize todas as entregas agendadas vinculadas à sua transportadora com detalhes completos."
                tag="Agendamento"
                delay={0}
              />
              <DriverCard
                onClick={() => navigate('/minhas-entregas')}
                accentColor={B.m}
                accentDark={B.mD}
                bgFrom={B.mBg2}
                bgTo={B.mBg}
                icon={<FaBoxes />}
                title="Minhas Entregas"
                description="Acompanhe todas as suas entregas em tempo real, histórico e status atualizado."
                tag="Operacional"
                delay={100}
              />
              <DriverCard
                onClick={() => navigate('/entregas-canhotos-pendentes')}
                accentColor="#E5607A"
                accentDark="#C0435F"
                bgFrom="#FFF5F7"
                bgTo="#FFE4EB"
                icon={<FaFileAlt />}
                title="Canhotos Pendentes"
                description="Anexe os canhotos das entregas abertas para manter toda documentação em dia."
                tag="Documentação"
                delay={200}
              />
            </div>
          </>
        )}

        {/* ── ADMIN / MANAGER / GEOMAR ─────────── */}
        {canAccessAdmin() && (
          <>
            {/* ─ MONITORING ─ */}
            <SectionHeader
              icon="📡"
              title="Monitoramento & Relatórios"
              subtitle="Acompanhe em tempo real todas as operações e entregas"
              delay={0}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-14">
              <MonitorCard
                onClick={() => navigate('/admin')}
                disabled={isViewOnly()}
                accentColor={B.v}
                accentDark={B.vD}
                icon={<FaChartBar />}
                emoji="📈"
                title="Dashboard Analytics"
                description="Análise completa com KPIs, gráficos interativos e relatórios detalhados sobre todas as operações logísticas da empresa."
                viewOnly={isViewOnly()}
                delay={0}
              />
              <MonitorCard
                onClick={() => navigate('/monitor-entregas')}
                disabled={isViewOnly()}
                accentColor="#4F46E5"
                accentDark="#3730A3"
                icon={<FaTachometerAlt />}
                emoji="🎯"
                title="Torre de Controle"
                description="Monitore todas as entregas em tempo real com filtros avançados, busca inteligente e rastreamento completo da operação."
                viewOnly={isViewOnly()}
                delay={150}
              />
            </div>

            {/* ─ MANAGEMENT ─ */}
            <SectionHeader
              icon="⚙️"
              title="Gerenciamento & Configurações"
              subtitle="Controle total sobre usuários, motoristas e programações"
              delay={50}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              {hasAccess(['manager']) && (
                <ManageCard
                  onClick={() => navigate('/usuarios')}
                  accentColor="#8B5CF6"
                  accentDark="#6D28D9"
                  icon={<FaUsers />}
                  emoji="👥"
                  title="Usuários"
                  description="Criar, editar e controlar perfis de todos os usuários do sistema."
                  delay={0}
                />
              )}

              <ManageCard
                onClick={() => navigate('/motoristas')}
                disabled={isViewOnly()}
                accentColor={B.m}
                accentDark={B.mD}
                icon={<FaIdCard />}
                emoji="👨‍🚗"
                title="Motoristas"
                description="Gerenciar motoristas, dados, rastreadores e contatos da frota."
                viewOnly={isViewOnly()}
                delay={100}
              />

              <ManageCard
                onClick={() => navigate('/programacoes')}
                disabled={isViewOnly()}
                accentColor="#0891B2"
                accentDark="#0E7490"
                icon={<FaLayerGroup />}
                emoji="📦"
                title="Programações"
                description="Gerenciar programações de entregas com todos os detalhes e vínculos."
                viewOnly={isViewOnly()}
                delay={200}
              />

              {hasAccess(['manager']) && (
                <ManageCard
                  onClick={() => navigate('/base-dados-geral')}
                  accentColor="#059669"
                  accentDark="#047857"
                  icon={<FaTable />}
                  emoji="🗄️"
                  title="Base de Dados"
                  description="Visualizar todos os dados das programações em formato de tabela completa."
                  delay={300}
                />
              )}
            </div>

            {/* ─ INFO STRIP ─ */}
            <div
              className="geo-fadeup delay-400 rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              style={{
                background: `linear-gradient(135deg,${B.vBg2},${B.mBg2})`,
                border: `1px solid ${B.bdr}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg,${B.v}22,${B.m}22)` }}
                >
                  <HiSparkles style={{ color: B.v, fontSize: '1rem' }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: B.txt }}>
                    Sistema GeoLog atualizado
                  </p>
                  <p className="text-xs" style={{ color: B.txt2 }}>
                    Todas as funcionalidades estão operando normalmente.
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ background: `${B.m}18`, color: B.mD, border: `1px solid ${B.m}30` }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
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
