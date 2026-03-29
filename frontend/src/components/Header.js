import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { notificationService } from '../services/authService';
import NotificationBell from './NotificationBell';
import {
  FaSignOutAlt, FaUser, FaBars, FaHome,
  FaTimes, FaTruck, FaChevronRight, FaCircle,
  FaUserTie, FaUserShield, FaGlobe
} from 'react-icons/fa';
import { MdDashboard, MdSettings } from 'react-icons/md';

/* ─── helpers ─── */
const getInitials = (name = '') =>
  name.trim().split(' ').filter(Boolean)
    .slice(0, 2).map(n => n[0].toUpperCase()).join('');

const routeLabel = {
  '/home': 'Início',
  '/profile': 'Perfil',
  '/dashboard': 'Dashboard',
};

/* ─── helpers ─── */

const getRoleIcon = (role) => {
  switch (role) {
    case 'manager':
      return <FaUserTie className="text-white/70 text-[10px]" />;
    case 'admin':
      return <FaUserShield className="text-white/70 text-[10px]" />;
    case 'geomar':
      return <FaGlobe className="text-white/70 text-[10px]" />;
    case 'gestor_contratado':
      return <FaUserShield className="text-white/70 text-[10px]" />;
    case 'driver':
    default:
      return <FaTruck className="text-white/70 text-[10px]" />;
  }
};

/* ─── sub-components ─── */

/** Avatar com gradiente + iniciais */
const Avatar = ({ name, size = 'md' }) => {
  const initials = getInitials(name) || <FaUser />;
  const sizeClass = size === 'lg'
    ? 'h-12 w-12 text-base'
    : size === 'sm'
    ? 'h-7 w-7 text-[10px]'
    : 'h-9 w-9 text-xs';

  return (
    <div className={`
      ${sizeClass}
      rounded-full flex items-center justify-center font-bold
      bg-gradient-to-br from-purple-400 via-violet-500 to-emerald-500
      ring-2 ring-white/30 shadow-md select-none shrink-0
    `}>
      {initials}
    </div>
  );
};

/** Pílula do usuário — desktop */
const UserPill = ({ name }) => (
  <div className="hidden md:flex items-center gap-2.5
    bg-white/10 border border-white/20 backdrop-blur-sm
    px-4 py-2 rounded-full text-sm font-semibold
    hover:bg-white/20 transition-all duration-200 cursor-default
    shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
    <Avatar name={name} size="sm" />
    <span className="truncate max-w-[140px] text-white/95">{name}</span>
    <FaCircle className="text-emerald-400 text-[6px] animate-pulse" title="Online" />
  </div>
);

/** Breadcrumb sutil */
const Breadcrumb = ({ pathname }) => {
  const label = routeLabel[pathname];
  if (!label) return null;
  return (
    <div className="hidden lg:flex items-center gap-1.5 text-xs text-white/50 ml-1 mt-0.5">
      <FaTruck className="text-[9px]" />
      <span>GeoTower</span>
      <FaChevronRight className="text-[8px]" />
      <span className="text-white/80 font-medium">{label}</span>
    </div>
  );
};

/* ─── Drawer ─── */
const NAV_ITEMS = [
  {
    icon: <FaHome className="text-lg" />,
    label: 'Início',
    path: '/home',
    color: 'emerald',
    gradient: 'from-emerald-50 to-teal-100',
    hover: 'hover:from-emerald-100 hover:to-teal-200',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  {
    icon: <MdDashboard className="text-lg" />,
    label: 'Dashboard',
    path: '/dashboard',
    color: 'blue',
    gradient: 'from-sky-50 to-blue-100',
    hover: 'hover:from-sky-100 hover:to-blue-200',
    border: 'border-sky-200',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
  },
  {
    icon: <MdSettings className="text-lg" />,
    label: 'Ajustes',
    path: '/profile',
    color: 'purple',
    gradient: 'from-violet-50 to-purple-100',
    hover: 'hover:from-violet-100 hover:to-purple-200',
    border: 'border-violet-200',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
  },
];

const Drawer = ({ open, onClose, user, onLogout, navigate }) => {
  return (
    <>
      {/* ── Overlay animado ── */}
      <div
        onClick={onClose}
        className={`
          fixed inset-0 z-[60] bg-black/60 backdrop-blur-[3px]
          transition-opacity duration-300
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        aria-hidden="true"
      />

      {/* ── Painel ── */}
      <div className={`
        fixed right-0 top-0 h-full z-[70]
        w-[min(360px,92vw)]
        flex flex-col
        bg-white
        shadow-[−8px_0_40px_rgba(0,0,0,0.18)]
        border-l border-gray-100
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>

        {/* ── Header do painel ── */}
        <div className="relative overflow-hidden px-6 pt-6 pb-7
          bg-gradient-to-br from-purple-700 via-violet-600 to-emerald-600">

          {/* círculos decorativos */}
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full
            bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full
            bg-emerald-400/20 blur-xl pointer-events-none" />

          {/* fechar */}
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              <Avatar name={user?.name} size="lg" />
              <div className="leading-tight">
                <p className="text-white font-bold text-sm truncate max-w-[180px]">
                  {user?.name || 'Usuário'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <FaCircle className="text-emerald-400 text-[7px] animate-pulse" />
                  <span className="text-white/70 text-xs font-medium">Online agora</span>
                </div>
                {user?.email && (
                  <p className="text-white/50 text-[11px] mt-0.5 truncate max-w-[180px]">
                    {user.email}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25
                border border-white/20 transition-all duration-200
                active:scale-95 text-white mt-0.5 shrink-0"
              aria-label="Fechar menu"
            >
              <FaTimes className="text-base" />
            </button>
          </div>

          {/* badge de papel / role — opcional */}
          {user?.role && (
            <div className="relative z-10 mt-4 inline-flex items-center gap-1.5
              bg-white/15 border border-white/20 rounded-full px-3 py-1">
              {getRoleIcon(user.role)}
              <span className="text-white/90 text-xs font-semibold capitalize">
                {user.role}
              </span>
            </div>
          )}
        </div>

        {/* ── Navegação ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest
            mb-3 px-1">
            Navegação
          </p>

          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => { onClose(); navigate(item.path); }}
              className={`
                w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl
                bg-gradient-to-r ${item.gradient} ${item.hover}
                border ${item.border}
                transition-all duration-200 group active:scale-[0.98]
              `}
            >
              <div className={`
                h-9 w-9 rounded-xl flex items-center justify-center shrink-0
                bg-white shadow-sm ${item.text}
                group-hover:shadow-md transition-shadow
              `}>
                {item.icon}
              </div>
              <div className="flex-1 text-left leading-tight">
                <p className={`text-sm font-bold ${item.text}`}>{item.label}</p>
              </div>
              <FaChevronRight className={`text-xs ${item.text} opacity-40
                group-hover:opacity-80 group-hover:translate-x-0.5 transition-all`} />
            </button>
          ))}

          {/* Divider */}
          <div className="pt-2 pb-1">
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl
              bg-gradient-to-r from-red-50 to-rose-100
              hover:from-red-100 hover:to-rose-200
              border border-red-200
              transition-all duration-200 group active:scale-[0.98]"
          >
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0
              bg-white shadow-sm text-red-600 group-hover:shadow-md transition-shadow">
              <FaSignOutAlt className="text-lg" />
            </div>
            <div className="flex-1 text-left leading-tight">
              <p className="text-sm font-bold text-red-700">Sair da conta</p>
              <p className="text-[11px] text-red-400 font-medium">Encerrar sessão</p>
            </div>
            <FaChevronRight className="text-xs text-red-400 opacity-40
              group-hover:opacity-80 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaTruck className="text-purple-400 text-xs" />
              <span className="text-[11px] text-gray-400 font-semibold">
                GeoTower
              </span>
            </div>
            <kbd className="text-[10px] text-gray-400 bg-white border border-gray-200
              rounded px-1.5 py-0.5 font-mono shadow-sm">
              ESC
            </kbd>
          </div>
          <p className="text-[10px] text-gray-300 mt-0.5">
            v2.0 · Logística Rodoviária
          </p>
        </div>
      </div>
    </>
  );
};

/* ─── Header principal ─── */
const Header = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  // Buscar contagem de notificações
  useEffect(() => {
    const fetchNotificationCount = async () => {
      if (user && (user.role === 'admin' || user.role === 'manager')) {
        try {
          const response = await notificationService.getNotifications();
          setNotificationCount(response.data.unreadCount || 0);
        } catch (error) {
          console.warn('Erro ao buscar notificações:', error);
          setNotificationCount(0);
        }
      }
    };

    fetchNotificationCount();
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleNotificationClick = () => {
    // TODO: Abrir modal/página de notificações
    console.log('Notificações clicadas');
  };

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 text-white
        bg-gradient-to-r from-purple-800 via-violet-700 to-emerald-700
        shadow-[0_4px_24px_rgba(109,40,217,0.35)]">

        {/* linha decorativa superior */}
        <div className="h-[2px] w-full
          bg-gradient-to-r from-purple-400 via-violet-300 to-emerald-400 opacity-60" />

        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5
          flex flex-wrap items-center justify-between gap-2 sm:gap-4">

          {/* ── Logo + nome + breadcrumb ── */}
          <button
            onClick={() => navigate('/home')}
            className="flex items-start gap-2 sm:gap-3 hover:opacity-90
              transition-all duration-200 group min-w-0"
            aria-label="Ir para início"
          >
            <div className="relative shrink-0">
              <img
                src="/logo.png"
                alt="GeoTower"
                className="h-10 sm:h-13 lg:h-14 w-auto group-hover:scale-105
                  transition-transform duration-300 drop-shadow-md"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/GeoTower.svg';
                }}
              />
            </div>

            <div className="leading-tight text-left min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs sm:text-base lg:text-lg font-extrabold tracking-tight
                  text-white drop-shadow-sm truncate">
                  GeoTower
                </span>
              </div>
              <Breadcrumb pathname={location.pathname} />
            </div>
          </button>

          {/* ── Ações ── */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0">

            {/* Pílula desktop */}
            <UserPill name={user?.name} />

            {/* Avatar mobile */}
            <div className="md:hidden">
              <Avatar name={user?.name} size="sm" />
            </div>

            {/* Separador vertical */}
            <div className="hidden sm:block h-7 w-px bg-white/20 rounded-full" />

            {/* Notificações - apenas para admin/manager */}
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <NotificationBell
                count={notificationCount}
                onClick={handleNotificationClick}
              />
            )}

            {/* Botão hamburger */}
            <button
              onClick={() => setMenuOpen(true)}
              className="relative h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 grid place-items-center
                rounded-xl bg-white/10 border border-white/20
                hover:bg-white/20 active:scale-95
                transition-all duration-200 group
                shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              aria-label="Abrir menu"
            >
              <FaBars className="text-sm sm:text-base lg:text-lg
                group-hover:rotate-90 transition-transform duration-300" />
              {/* ping de notificação — remova se não usar */}
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full
                bg-emerald-400 ring-2 ring-purple-700 animate-pulse" />
            </button>
          </div>
        </div>

        {/* linha decorativa inferior — glassmorphism glow */}
        <div className="h-px w-full
          bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </header>

      {/* Drawer fora do <header> para evitar overflow */}
      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        onLogout={handleLogout}
        navigate={navigate}
      />
    </>
  );
};

export default Header;
