import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { useCity } from '../contexts/CityContext';
import Toast from '../components/Toast';
import { FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';

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

    // Require city selection before attempting login to ensure header is sent
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
      setToast({
        message: error.response?.data?.message || 'Erro ao fazer login',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 w-full overflow-hidden overscroll-none bg-gradient-to-br from-purple-700 via-blue-600 to-emerald-600 flex items-center justify-center px-4 py-10"
      style={{
        height: '100svh',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)'
      }}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full -ml-48 -mb-48 blur-2xl pointer-events-none" />

      {/* Card (se precisar rolar em telas pequenas, ele rola sem “balançar” a página) */}
      <div className="w-full max-w-md max-h-[90svh] overflow-auto bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 relative z-10 border border-white/40">
        <div className="text-center mb-8">
          <img
            src="/images/geotransporteslogo.svg"
            alt="GeoTransportes Logo"
            className="h-20 w-auto mx-auto mb-4"
            onError={(e) => {
              // Fallback to alternate filename (case differences on server)
              console.warn('Logo failed to load from /images/geotransporteslogo.svg; trying alternate path');
              e.target.onerror = null;
              e.target.src = '/images/GeoTransportesLogo.svg';
            }}
            onLoad={() => console.debug('Logo loaded successfully')}
          />
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-700 to-blue-700 bg-clip-text text-transparent mb-2">
            GeoTransportes
          </h1>
          <p className="text-gray-700 font-semibold">
            Logística Rodoviária com Excelência
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FaUser className="inline mr-2" />
              Usuário ou Email
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 text-base transition shadow-sm"
              placeholder="seu.usuario ou email@example.com"
              disabled={loading}
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FaLock className="inline mr-2" />
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 text-base transition pr-12 shadow-sm"
                placeholder="Digite sua senha"
                disabled={loading}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800 p-2 rounded-lg"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {/* City selector (Manaus / Itajaí) */}
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cidade</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCity('manaus')}
                className={`px-4 py-2 rounded-xl border ${city === 'manaus' ? 'bg-purple-700 text-white' : 'bg-white text-gray-700'} hover:opacity-90 transition`}
              >
                Manaus
              </button>

              <button
                type="button"
                onClick={() => setCity('itajai')}
                className={`px-4 py-2 rounded-xl border ${city === 'itajai' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700'} hover:opacity-90 transition`}
              >
                Itajaí
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !city}
            className={`w-full ${!city ? 'opacity-60 cursor-not-allowed' : ''} bg-gradient-to-r from-purple-700 to-emerald-600 hover:from-purple-800 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-extrabold py-3 px-4 rounded-xl transition text-lg shadow-md active:scale-[0.99]`}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200/70 text-center">
          <p className="text-gray-600 text-sm mb-4">Não tem cadastro?</p>
          <button
            onClick={() => navigate('/register')}
            className="text-emerald-700 hover:text-emerald-800 font-semibold text-base transition"
          >
            Criar novo usuário
          </button>
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
