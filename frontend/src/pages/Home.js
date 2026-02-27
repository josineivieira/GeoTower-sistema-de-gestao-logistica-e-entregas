import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { deliveryService } from '../services/authService';
import Footer from '../components/Footer';
import {
  FaChartBar,
  FaFileAlt,
  FaUsers,
  FaDatabase,
  FaCalendarAlt,
  FaCheckCircle,
  FaBoxes,
  FaTruck,
  FaTachometerAlt,
  FaLayerGroup,
  FaIdCard,
  FaTable,
  FaArrowRight,
  FaShieldAlt,
} from 'react-icons/fa';

/* ─────────────────────────────────────────────────────────────
   BRAND TOKENS
   Primary: #7C5CBF (violet)  |  Secondary: #6BBF8A (mint)
───────────────────────────────────────────────────────────── */
const brand = {
  violet:      '#7C5CBF',
  violetLight: '#9B7FD4',
  violetDark:  '#5B3FA0',
  violetBg:    '#EDE9FA',
  violetBg2:   '#F5F2FD',
  mint:        '#6BBF8A',
  mintLight:   '#A8D8B5',
  mintDark:    '#4A9A6F',
  mintBg:      '#E8F5EE',
  mintBg2:     '#F0FAF4',
  pageBg:      '#F4F3FA',
  cardBg:      '#FFFFFF',
  textPrimary: '#1A1535',
  textSecond:  '#6B7280',
  textMuted:   '#9CA3AF',
  border:      '#E9E4F5',
};

/* ─────────────────────────────────────────────────────────────
   ROLE BADGE CONFIG
───────────────────────────────────────────────────────────── */
const roleMeta = {
  driver:  { label: 'Motorista',  color: brand.mint,   bg: brand.mintBg  },
  manager: { label: 'Gerente',    color: brand.violet, bg: brand.violetBg },
  admin:   { label: 'Administrador', color: '#4F46E5', bg: '#EEF2FF'     },
  geomar:  { label: 'GeoMar',     color: '#0891B2',   bg: '#E0F7FA'      },
};

/* ─────────────────────────────────────────────────────────────
   SMALL COMPONENTS
───────────────────────────────────────────────────────────── */

/** Seção com título + subtítulo padronizados */
const SectionHeader = ({ icon, title, subtitle }) => (
  <div className="mb-7">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xl">{icon}</span>
      <h2
        className="text-xl font-bold tracking-tight"
        style={{ color: brand.textPrimary }}
      >
        {title}
      </h2>
    </div>
    {subtitle && (
      <p className="text-sm ml-7" style={{ color: brand.textSecond }}>
        {subtitle}
      </p>
    )}
    <div
      className="mt-3 ml-7 h-0.5 w-16 rounded-full"
      style={{ background: `linear-gradient(90deg, ${brand.violet}, ${brand.mint})` }}
    />
  </div>
);

/** Card de estatística */
const StatCard = ({ icon, label, value, sub, accent, progressValue }) => (
  <div
    className="bg-white rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden"
    style={{
      boxShadow: '0 2px 16px rgba(124,92,191,0.08)',
      border: `1px solid ${brand.border}`,
    }}
  >
    {/* Top accent bar */}
    <div
      className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
      style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }}
    />

    <div className="flex items-start justify-between mt-1">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: brand.textMuted }}>
          {label}
        </p>
        <p className="text-3xl font-extrabold" style={{ color: accent }}>
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-1" style={{ color: brand.textMuted }}>
            {sub}
          </p>
        )}
      </div>
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}18` }}
      >
        <span style={{ color: accent, fontSize: '1.1rem' }}>{icon}</span>
      </div>
    </div>

    {/* Optional progress bar */}
    {progressValue !== undefined && (
      <div>
        <div className="w-full h-1.5 rounded-full" style={{ background: '#EEE' }}>
          <div
            className="h-1.5 rounded-full transition-all duration-700"
            style={{
              width: `${progressValue}%`,
              background:
                progressValue >= 90
                  ? '#22C55E'
                  : progressValue >= 70
                  ? '#F59E0B'
                  : '#EF4444',
            }}
          />
        </div>
        <p className="text-xs mt-1 text-right font-medium" style={{ color: brand.textMuted }}>
          {progressValue}% no prazo
        </p>
      </div>
    )}
  </div>
);

/** Card de ação para motoristas */
const DriverActionCard = ({ onClick, gradient, accentColor, icon, title, description }) => (
  <button
    onClick={onClick}
    className="group relative rounded-2xl text-left overflow-hidden transition-all duration-300 hover:-translate-y-1"
    style={{
      background: gradient,
      boxShadow: '0 4px 20px rgba(124,92,191,0.10)',
      border: `1px solid ${accentColor}30`,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = `0 8px 32px ${accentColor}30`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,92,191,0.10)';
    }}
  >
    {/* Decorative circle */}
    <div
      className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300"
      style={{ background: accentColor }}
    />
    <div
      className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full opacity-5 group-hover:opacity-10 transition-opacity duration-300"
      style={{ background: accentColor }}
    />

    <div className="relative z-10 p-7">
      {/* Icon */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 shadow-md transition-transform duration-300 group-hover:scale-110"
        style={{ background: accentColor }}
      >
        <span className="text-white text-2xl">{icon}</span>
      </div>

      <h3
        className="text-lg font-bold mb-2"
        style={{ color: brand.textPrimary }}
      >
        {title}
      </h3>
      <p className="text-sm leading-relaxed mb-5" style={{ color: '#6B7280' }}>
        {description}
      </p>

      <div
        className="inline-flex items-center gap-2 text-sm font-bold"
        style={{ color: accentColor }}
      >
        <span>Acessar</span>
        <FaArrowRight className="text-xs transition-transform duration-300 group-hover:translate-x-1.5" />
      </div>
    </div>
  </button>
);

/** Card de ação para admin/gerente (maior) */
const AdminActionCard = ({
  onClick,
  disabled,
  accentColor,
  accentDark,
  icon,
  emoji,
  title,
  description,
  viewOnly,
  size = 'normal',
}) => {
  const isLarge = size === 'large';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative rounded-2xl text-left overflow-hidden transition-all duration-300 w-full
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-1'}`}
      style={{
        background: '#FFFFFF',
        boxShadow: '0 2px 16px rgba(124,92,191,0.08)',
        border: `1px solid ${accentColor}25`,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = `0 8px 32px ${accentColor}28`;
          e.currentTarget.style.border = `1px solid ${accentColor}60`;
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 2px 16px rgba(124,92,191,0.08)';
        e.currentTarget.style.border = `1px solid ${accentColor}25`;
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: `linear-gradient(180deg, ${accentColor}, ${accentDark || accentColor})` }}
      />

      {/* Decorative bg shape */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-0 group-hover:opacity-5 transition-opacity duration-500"
        style={{ background: accentColor }}
      />

      <div className={`pl-6 ${isLarge ? 'p-8' : 'p-6'}`}>
        {/* Icon */}
        <div
          className={`${isLarge ? 'w-16 h-16' : 'w-12 h-12'} rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-sm`}
          style={{ background: `${accentColor}18` }}
        >
          <span style={{ color: accentColor, fontSize: isLarge ? '1.5rem' : '1.1rem' }}>
            {icon}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3
              className={`${isLarge ? 'text-xl' : 'text-base'} font-bold mb-2 flex items-center gap-2`}
              style={{ color: brand.textPrimary }}
            >
              <span>{emoji}</span> {title}
            </h3>
            <p
              className={`${isLarge ? 'text-sm' : 'text-xs'} leading-relaxed mb-4`}
              style={{ color: brand.textSecond }}
            >
              {description}
            </p>

            {viewOnly && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mb-3"
                style={{ background: '#FEF3C7', color: '#D97706' }}
              >
                <FaShieldAlt className="text-[10px]" /> Apenas Visualização
              </span>
            )}

            <div
              className="inline-flex items-center gap-2 text-sm font-bold"
              style={{ color: accentColor }}
            >
              <span>Acessar</span>
              <FaArrowRight className="text-xs transition-transform duration-300 group-hover:translate-x-1.5" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statsTodayTab, setStatsTodayTab] = useState('today');

  const hasAccess = (requiredRoles) => {
    if (!user?.role) return false;
    return requiredRoles.includes(user.role);
  };
  const isViewOnly = () => user?.role === 'geomar';
  const canAccessAdminPanel = () => hasAccess(['manager', 'admin', 'geomar']);

  const [statsToday, setStatsToday] = useState({ total: 0, completed: 0, inProgress: 0, pending: 0, onTimePercentage: 100 });
  const [statsGeneral, setStatsGeneral] = useState({ total: 0, completed: 0, inProgress: 0, pending: 0, onTimePercentage: 100 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'driver') loadDeliveryStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadDeliveryStats = async () => {
    setLoading(true);
    try {
      const res = await deliveryService.getProgramacoesAssigned();
      const programacoes = res.data.programacoes || [];
      const nomeFiltro = (user?.username || user?.name || '').trim().toUpperCase();
      const minhasEntregas = programacoes.filter(
        p => String(p.contratado).trim().toUpperCase() === nomeFiltro
      );

      const calcularStats = (entregas) => {
        const total = entregas.length;
        const completed = entregas.filter(e => String(e.status).toUpperCase() === 'ENTREGUE').length;
        const inProgress = entregas.filter(e => String(e.status).toUpperCase() === 'EM_ROTA').length;
        const pending = entregas.filter(
          e => !['ENTREGUE', 'EM_ROTA'].includes(String(e.status).toUpperCase())
        ).length;
        const onTimePercentage = completed > 0 ? Math.round((completed / completed) * 100) : 100;
        return { total, completed, inProgress, pending, onTimePercentage };
      };

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const entregasHoje = minhasEntregas.filter(entrega => {
        const d = new Date(entrega.data); d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });

      setStatsToday(calcularStats(entregasHoje));
      setStatsGeneral(calcularStats(minhasEntregas));
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeStats = statsTodayTab === 'today' ? statsToday : statsGeneral;
  const role = user?.role;
  const rm = roleMeta[role] || roleMeta.driver;

  return (
    <div style={{ background: brand.pageBg, minHeight: '100%' }}>
      {/* ── HERO BANNER ─────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${brand.violetBg} 0%, #FFFFFF 50%, ${brand.mintBg} 100%)`,
          borderBottom: `1px solid ${brand.border}`,
        }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-30 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${brand.violetLight}40, transparent 70%)` }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${brand.mint}50, transparent 70%)` }}
        />

        {/* Dot grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(${brand.violet} 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
          {/* Role badge */}
          <div className="mb-5 inline-flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: rm.bg, color: rm.color, border: `1px solid ${rm.color}30` }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: rm.color }} />
              {rm.label}
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: brand.violetBg, color: brand.violet, border: `1px solid ${brand.violet}20` }}
            >
              🚛 Sistema GeoLog
            </div>
          </div>

          {/* Greeting */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3">
            <span style={{ color: brand.textPrimary }}>Olá, </span>
            <span
              style={{
                background: `linear-gradient(135deg, ${brand.violet}, ${brand.mint})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {user?.fullName || user?.name || 'Usuário'}
            </span>
            <span style={{ color: brand.textPrimary }}> 👋</span>
          </h1>

          <p className="text-base sm:text-lg max-w-xl" style={{ color: brand.textSecond }}>
            Bem-vindo ao painel de{' '}
            <span className="font-semibold" style={{ color: brand.violet }}>
              Gerenciamento Logístico
            </span>{' '}
            da GeoLog. Tudo que você precisa em um só lugar.
          </p>

          {/* Accent line */}
          <div
            className="mt-6 h-1 w-24 rounded-full"
            style={{ background: `linear-gradient(90deg, ${brand.violet}, ${brand.mint})` }}
          />
        </div>
      </div>

      {/* ── PAGE CONTENT ────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-20">

        {/* ── DRIVER: STATS + ACTIONS ─────────────────────── */}
        {role === 'driver' && (
          <>
            {/* Stats Tabs */}
            <div className="mb-3 flex items-center justify-between">
              <SectionHeader icon="📊" title="Seu Desempenho" subtitle="Acompanhe seus indicadores em tempo real" />

              {/* Tab switcher */}
              <div
                className="flex gap-1 p-1 rounded-xl"
                style={{ background: brand.violetBg, border: `1px solid ${brand.border}` }}
              >
                {['today', 'general'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatsTodayTab(tab)}
                    className="px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200"
                    style={
                      statsTodayTab === tab
                        ? { background: brand.violet, color: '#FFF', boxShadow: `0 2px 8px ${brand.violet}40` }
                        : { color: brand.textSecond }
                    }
                  >
                    {tab === 'today' ? '📅 Hoje' : '📈 Geral'}
                  </button>
                ))}
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              <StatCard
                icon={<FaCalendarAlt />}
                label="Programadas"
                value={loading ? '…' : activeStats.total}
                sub="Entregas agendadas"
                accent={brand.violet}
              />
              <StatCard
                icon={<FaCheckCircle />}
                label="Concluídas"
                value={loading ? '…' : activeStats.completed}
                sub="Expedidas com sucesso"
                accent={brand.mint}
              />
              <StatCard
                icon="📈"
                label="Pontualidade"
                value={loading ? '…' : `${activeStats.onTimePercentage}%`}
                sub="Taxa no prazo"
                accent="#F59E0B"
                progressValue={activeStats.onTimePercentage}
              />
              <StatCard
                icon={<FaTruck />}
                label="Em Rota"
                value={loading ? '…' : activeStats.inProgress}
                sub="Entregas em andamento"
                accent="#3B82F6"
              />
            </div>

            {/* Quick Actions */}
            <div className="mb-12">
              <SectionHeader
                icon="🎯"
                title="Ações Rápidas"
                subtitle="Gerencie suas atividades do dia"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <DriverActionCard
                  onClick={() => navigate('/entregas-programadas')}
                  gradient={`linear-gradient(135deg, ${brand.violetBg2}, ${brand.violetBg})`}
                  accentColor={brand.violet}
                  icon={<FaCalendarAlt />}
                  title="Entregas Programadas"
                  description="Veja todas as entregas agendadas vinculadas à sua transportadora."
                />
                <DriverActionCard
                  onClick={() => navigate('/minhas-entregas')}
                  gradient={`linear-gradient(135deg, ${brand.mintBg2}, ${brand.mintBg})`}
                  accentColor={brand.mint}
                  icon={<FaBoxes />}
                  title="Minhas Entregas"
                  description="Acompanhe todas as suas entregas em tempo real e histórico completo."
                />
                <DriverActionCard
                  onClick={() => navigate('/entregas-canhotos-pendentes')}
                  gradient="linear-gradient(135deg, #FFF5F7, #FFE4EB)"
                  accentColor="#E5607A"
                  icon={<FaFileAlt />}
                  title="Canhotos Pendentes"
                  description="Anexe os canhotos pendentes das entregas que ficaram abertas."
                />
              </div>
            </div>
          </>
        )}

        {/* ── ADMIN / MANAGER / GEOMAR PANEL ──────────────── */}
        {canAccessAdminPanel() && (
          <>
            {/* ── MONITORING ── */}
            <div className="mb-3">
              <SectionHeader
                icon="📡"
                title="Monitoramento & Relatórios"
                subtitle="Acompanhe em tempo real todas as operações e entregas"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
              {/* Dashboard Analytics */}
              <AdminActionCard
                onClick={() => navigate('/admin')}
                disabled={isViewOnly()}
                accentColor={brand.violet}
                accentDark={brand.violetDark}
                icon={<FaChartBar />}
                emoji="📈"
                title="Dashboard Analytics"
                description="Análise completa com estatísticas, gráficos e relatórios detalhados sobre todas as operações logísticas."
                viewOnly={isViewOnly()}
                size="large"
              />

              {/* Torre de Controle */}
              <AdminActionCard
                onClick={() => navigate('/monitor-entregas')}
                disabled={isViewOnly()}
                accentColor="#4F46E5"
                accentDark="#3730A3"
                icon={<FaTachometerAlt />}
                emoji="🎯"
                title="Torre de Controle"
                description="Monitore todas as entregas em tempo real com filtros avançados, busca e rastreamento completo."
                viewOnly={isViewOnly()}
                size="large"
              />
            </div>

            {/* ── MANAGEMENT ── */}
            <div className="mb-3">
              <SectionHeader
                icon="⚙️"
                title="Gerenciamento & Configurações"
                subtitle="Controle total sobre usuários, motoristas e programações"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
              {/* Gerenciar Usuários — apenas manager */}
              {hasAccess(['manager']) && (
                <AdminActionCard
                  onClick={() => navigate('/usuarios')}
                  accentColor="#8B5CF6"
                  accentDark="#6D28D9"
                  icon={<FaUsers />}
                  emoji="👥"
                  title="Usuários"
                  description="Criar, editar e controlar perfis de todos os usuários do sistema."
                />
              )}

              {/* Motoristas */}
              <AdminActionCard
                onClick={() => navigate('/motoristas')}
                disabled={isViewOnly()}
                accentColor={brand.mint}
                accentDark={brand.mintDark}
                icon={<FaIdCard />}
                emoji="👨‍🚗"
                title="Motoristas"
                description="Gerenciar motoristas, dados, rastreadores e contatos."
                viewOnly={isViewOnly()}
              />

              {/* Programações */}
              <AdminActionCard
                onClick={() => navigate('/programacoes')}
                disabled={isViewOnly()}
                accentColor="#0891B2"
                accentDark="#0E7490"
                icon={<FaLayerGroup />}
                emoji="📦"
                title="Programações"
                description="Gerenciar programações de entregas com todos os detalhes."
                viewOnly={isViewOnly()}
              />

              {/* Base de Dados Geral — apenas manager */}
              {hasAccess(['manager']) && (
                <AdminActionCard
                  onClick={() => navigate('/base-dados-geral')}
                  accentColor="#059669"
                  accentDark="#047857"
                  icon={<FaTable />}
                  emoji="🗄️"
                  title="Base de Dados"
                  description="Visualizar todos os dados das programações em formato de tabela."
                />
              )}
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Home;
