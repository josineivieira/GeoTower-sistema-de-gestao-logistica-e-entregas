import axios from 'axios';

// URL remota de producao (Render). Tambem usada pelo APK se nenhuma outra
// variavel de ambiente for definida.
const DEFAULT_BACKEND = 'https://grupogeobackend.onrender.com/api';

const rawEnvUrl = process.env.REACT_APP_API_URL;

const computeApiUrl = () => {
  let url = rawEnvUrl || '';

  if (!url) {
    url = process.env.NODE_ENV === 'production' ? DEFAULT_BACKEND : '/api';
  }

  if (process.env.NODE_ENV === 'production') {
    if (url.startsWith('/') || url.includes('localhost')) {
      console.warn('api.js: substituindo url invalida em producao', url, '->', DEFAULT_BACKEND);
      url = DEFAULT_BACKEND;
    }
  }

  return url;
};

const API_URL = computeApiUrl();

export { API_URL };

if (process.env.NODE_ENV !== 'production') {
  console.debug('api.js init:', {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_API_URL: rawEnvUrl,
    computedUrl: API_URL,
    DEFAULT_BACKEND,
  });
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

const redirectToLogin = () => {
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const city = localStorage.getItem('city') || 'manaus';

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers['X-City'] = city;

  if (process.env.NODE_ENV !== 'production') {
    try {
      const { Authorization, ...safeHeaders } = config.headers || {};
      console.debug('Outgoing request', {
        method: config.method,
        url: config.baseURL ? config.baseURL + config.url : config.url,
        headers: safeHeaders,
      });
    } catch (e) {}
  }

  return config;
}, (error) => {
  console.error('Request interceptor error', error);
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API response error', error?.response?.status, error?.response?.data || error.message);

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:expired'));
      redirectToLogin();
      return Promise.reject({ ...error, isAuthError: true, handled: true });
    }

    if (!error.response) {
      console.error('Erro de conexao com o servidor');
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
