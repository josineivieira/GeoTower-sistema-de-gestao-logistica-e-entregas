import axios from 'axios';

// URL remota de produção (Render) – também será usada pelo APK se nenhuma outra
// variável de ambiente for definida.
const DEFAULT_BACKEND = 'https://grupogeobackend.onrender.com/api';

// Normalizamos o endereço base do backend com algumas regras:
// 1. Se o dev definiu REACT_APP_API_URL, usamos isso.
// 2. Em produção, nunca retornamos um caminho relativo como '/api' ou um
//    endereço 'localhost' – nesses casos o frontend estaria apontando para
//    si próprio, o que funciona apenas quando ambos estão no mesmo container.
//    Para deployments no Render os serviços são separados, portanto usamos o
//    DEFAULT_BACKEND quando não há outra opção válida.
// 3. Em desenvolvimento local, é conveniente usar '/api' para tirar proveito
//    do proxy do CRA, mas apenas se a app estiver rodando em localhost.

// manter esta variável globalmente para os logs posteriores
const rawEnvUrl = process.env.REACT_APP_API_URL;

const computeApiUrl = () => {
  let url = rawEnvUrl || '';

  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      url = DEFAULT_BACKEND;
    } else {
      // dev server proxy
      url = '/api';
    }
  }

  // corrigir situações onde um build de produção foi gerado com '/api' ou
  // com localhost. Isso pode acontecer se a variável de ambiente estava
  // incorreta na hora do build. Garantimos que no Render usemos o backend
  // remoto.
  if (process.env.NODE_ENV === 'production') {
    if (url.startsWith('/') || url.includes('localhost')) {
      console.warn('🔧 api.js: substituindo url inválida em produção', url, '->', DEFAULT_BACKEND);
      url = DEFAULT_BACKEND;
    }
  }

  return url;
};

const API_URL = computeApiUrl();

export { API_URL };

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
    // Token expirado ou inválido - redirecionar automaticamente para login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirecionar para login sem mostrar erro
      window.location.href = '/login';
      return Promise.reject({ ...error, isAuthError: true, handled: true });
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
