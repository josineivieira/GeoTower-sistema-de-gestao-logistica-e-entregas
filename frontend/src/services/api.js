import axios from 'axios';

// URL remota de produção (Render) – também será usada pelo APK se nenhuma outra
// variable de ambiente for definida.
const DEFAULT_BACKEND = process.env.REACT_APP_API_URL || 'https://grupogeobackend.onrender.com/api';

// Em builds de produção (incluindo o APK) queremos sempre apontar para o
// backend remoto. Em desenvolvimento local via `npm start`, o CRA injeta um
// proxy para `/api`, por isso usamos '/api' quando NODE_ENV não é 'production'.
// A variável REACT_APP_API_URL permite sobrescrever isso (por exemplo, testes).
// At runtime we'll pick the correct backend; also log values to help debugging.
const rawEnvUrl = process.env.REACT_APP_API_URL;
const API_URL =
  rawEnvUrl ||
  (process.env.NODE_ENV === 'production' ? DEFAULT_BACKEND : '/api');

console.debug('🌐 api.js init:', {
  NODE_ENV: process.env.NODE_ENV,
  REACT_APP_API_URL: rawEnvUrl,
  computedUrl: API_URL,
  DEFAULT_BACKEND,
});

if (!rawEnvUrl && typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
  console.debug('🔧 Fallback: using backend', DEFAULT_BACKEND);
}




const api = axios.create({
  baseURL: API_URL,
  timeout: 60000  // 60 segundos para redes lentas
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const city = localStorage.getItem('city') || 'manaus';
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Send selected city to backend
  config.headers['X-City'] = city;

  // Debug: log outgoing request to console so we can see if login is fired from browser
  try {
    console.debug('➡️ Outgoing request', { method: config.method, url: config.baseURL ? config.baseURL + config.url : config.url, headers: config.headers, data: config.data });
  } catch (e) {}

  return config;
}, (error) => {
  console.error('❌ Request interceptor error', error);
  return Promise.reject(error);
});

// Log response errors for easier diagnosis
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ API response error', error?.response?.status, error?.response?.data || error.message);
    // Token expirado ou inválido
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Não fazer redirect automático para deixar a UI tratar
      return Promise.reject({ ...error, isAuthError: true });
    }

    // Erro de rede
    if (!error.response) {
      console.error('Erro de conexão com o servidor');
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
