import axios from 'axios';

const DEFAULT_BACKEND = process.env.REACT_APP_API_URL || 'https://grupogeobackend.onrender.com/api';
const API_URL = process.env.REACT_APP_API_URL || (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com') ? DEFAULT_BACKEND : '/api');

if (!process.env.REACT_APP_API_URL && typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
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
