import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { useCity } from '../contexts/CityContext';
import Toast from '../components/Toast';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaMapMarkerAlt } from 'react-icons/fa';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const { city, setCity } = useCity();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!city) {
      setToast({ message: 'Escolha Manaus ou Itajaí antes de entrar', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      await login(formData.username, formData.password, city);
      setToast({ message: 'Login realizado com sucesso!', type: 'success' });
      setTimeout(() => navigate('/home'), 900);
    } catch (error) {
      console.error('Login error (Login.js):', error);
      const serverMsg = error?.response?.data || error?.message || 'Erro ao fazer login';
      const toastMsg = typeof serverMsg === 'string' ? serverMsg : (serverMsg.message || JSON.stringify(serverMsg));
      setToast({ message: toastMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 w-full overflow-hidden overscroll-none flex"
      style={{ height: '100svh' }}
    >
      {/* ═══════════════════════════════════════════
          PAINEL ESQUERDO — Hero com Logo em destaque
          ═══════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col items-center justify-center w-1/2 relative overflow-hidden bg-gradient-to-br from-purple-900 via-purple-700 to-blue-700">

        {/* Orbs decorativos de fundo */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl pointer-events-none" />

        {/* Grade de pontos decorativa */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Conteúdo Hero */}
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          {/* Halo brilhante atrás do logo */}
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-white/20 blur-2xl scale-110 pointer-events-none" />
            <div className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 shadow-2xl">
              <img
                src="/logo.png"
                alt="GeoTower Logo"
                className="h-36 w-auto drop-shadow-[0_8px_24px_rgba(255,255,255,0.5)]"
              />
            </div>
          </div>

          <h1 className="text-5xl font-black text-white tracking-tight mb-3 drop-shadow-lg">
            GeoTower
          </h1>
          <p className="text-blue-200 text-lg font-medium mb-8 max-w-xs leading-relaxed">
            Logística Rodoviária com Excelência
          </p>

          {/* Badges / pills de destaque */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {[
              { icon: '🚛', text: 'Rastreamento em tempo real' },
              { icon: '📍', text: 'Gestão de frotas inteligente' },
              { icon: '📊', text: 'Relatórios e analytics' },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-medium"
              >
                <span className="text-lg">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          PAINEL DIREITO — Formulário de Login
          ═══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-auto px-4 py-10"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}
      >
        {/* Orbs sutis no fundo do formulário */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">

          {/* Logo + título visível somente em mobile */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-2xl bg-purple-200/60 blur-xl scale-110 pointer-events-none" />
              <div className="relative bg-white rounded-2xl shadow-xl p-4 border border-purple-100">
                <img
                  src="/logo.png"
                  alt="GeoTower Logo"
                  className="h-24 w-auto drop-shadow-md"
                />
              </div>
            </div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-purple-700 to-blue-600 bg-clip-text text-transparent">
              GeoTower
            </h1>
            <p className="text-gray-500 text-sm font-medium mt-1">
              Logística Rodoviária com Excelência
            </p>
          </div>

          {/* Card do formulário */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-100/80 p-8">

            <div className="mb-7">
              <h2 className="text-2xl font-black text-gray-800">Bem-vindo de volta 👋</h2>
              <p className="text-gray-500 text-sm mt-1">Faça login para acessar o sistema</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Campo Usuário */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Usuário ou Email
                </label>
                <div className="relative">
                  <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 text-base transition shadow-sm placeholder:text-gray-400"
                    placeholder="seu.usuario ou email@example.com"
                    disabled={loading}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-11 pr-12 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 text-base transition shadow-sm placeholder:text-gray-400"
                    placeholder="Digite sua senha"
                    disabled={loading}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-2 rounded-lg transition"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* Seletor de Cidade */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                  <FaMapMarkerAlt className="text-purple-500" />
                  Selecione a Cidade
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCity('manaus')}
                    className={`relative flex flex-col items-center justify-center gap-1 py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all duration-200 ${
                      city === 'manaus'
                        ? 'border-purple-600 bg-purple-600 text-white shadow-lg shadow-purple-200 scale-[1.03]'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <span className="text-xl">🏙️</span>
                    Manaus
                    {city === 'manaus' && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCity('itajai')}
                    className={`relative flex flex-col items-center justify-center gap-1 py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all duration-200 ${
                      city === 'itajai'
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-[1.03]'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="text-xl">⚓</span>
                    Itajaí
                    {city === 'itajai' && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full" />
                    )}
                  </button>
                </div>

                {/* Indicador de cidade selecionada */}
                {city && (
                  <p className="text-xs text-center mt-2 font-medium text-gray-400">
                    ✅ Conectando em{' '}
                    <span className={city === 'manaus' ? 'text-purple-600' : 'text-emerald-600'}>
                      {city === 'manaus' ? 'Manaus' : 'Itajaí'}
                    </span>
                  </p>
                )}
              </div>

              {/* Botão Entrar */}
              <button
                type="submit"
                disabled={loading || !city}
                className={`
                  w-full py-3.5 px-4 rounded-xl font-extrabold text-base text-white
                  transition-all duration-200 shadow-lg active:scale-[0.98]
                  ${loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : !city
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500 shadow-none'
                    : 'bg-gradient-to-r from-purple-700 to-blue-600 hover:from-purple-800 hover:to-blue-700 shadow-purple-200 hover:shadow-purple-300 hover:shadow-xl'
                  }
                `}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  'Entrar →'
                )}
              </button>
            </form>

            {/* Rodapé do card */}
            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-gray-500 text-sm mb-2">Ainda não tem cadastro?</p>
              <button
                onClick={() => navigate('/register')}
                className="text-purple-700 hover:text-purple-900 font-bold text-sm transition underline underline-offset-2"
              >
                Criar novo usuário
              </button>
            </div>
          </div>

          {/* Rodapé da página */}
          <p className="text-center text-gray-400 text-xs mt-6">
            © {new Date().getFullYear()} GeoTower · Todos os direitos reservados
          </p>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Login;
