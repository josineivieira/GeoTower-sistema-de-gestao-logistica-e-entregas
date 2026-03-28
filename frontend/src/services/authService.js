import api from './api';

export const authService = {
  register: (data, city) => api.post('/auth/register', data, { headers: { 'X-City': city || localStorage.getItem('city') || 'manaus' }, timeout: 60000 }),
  login: (username, password, city) => {
    try {
      console.debug('🔐 authService.login called', { username, city });
    } catch (e) {}
    // Login pode demorar mais por causa da busca no banco e validações, então aumenta timeout
    return api.post('/auth/login', { username, password }, { headers: { 'X-City': city || localStorage.getItem('city') || 'manaus' }, timeout: 90000 });
  },
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  changePassword: (data) => api.put('/auth/change-password', data)
};



export const adminService = {
  getDeliveries: (filters, statsPeriod, periodDate) => {
    // Normaliza chaves do frontend para os parâmetros que o backend espera
    const params = {};
    if (!filters) return api.get('/admin/deliveries');
    if (filters.status) params.status = filters.status;
    if (filters.searchTerm) params.q = filters.searchTerm;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (statsPeriod && statsPeriod !== 'general') params.period = statsPeriod;
    if (periodDate) params.periodDate = periodDate;
    return api.get('/admin/deliveries', { params });
  },
  getStatistics: (params) => api.get('/admin/statistics', { params }),
  getDeliveryDetails: (id) => api.get(`/admin/deliveries/${id}`),
  updateDelivery: (id, data) => api.put(`/admin/deliveries/${id}`, data),
  downloadDocument: (deliveryId, documentType, index) => {
    const params = index !== undefined ? { params: { index } } : {};
    // Some downloads can be large; allow more time for the server to respond
    return api.get(`/admin/deliveries/${deliveryId}/documents/${documentType}/download`, { responseType: 'blob', timeout: 120000, ...params });
  },
  downloadAllDocuments: (deliveryId) => {
    // ZIP creation can take longer; increase timeout to 120s
    return api.get(`/admin/deliveries/${deliveryId}/documents/zip`, { responseType: 'blob', timeout: 120000 });
  },
  getDriverDetails: (driverId) => api.get(`/admin/drivers/${driverId}`),
  deleteDelivery: (id) => api.delete(`/admin/deliveries/${id}`),
  getUsers: () => api.get('/admin/users'),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  // Motoristas
  getMotoristas: () => api.get('/admin/motoristas'),
  createMotorista: (data) => api.post('/admin/motoristas', data),
  updateMotorista: (id, data) => api.put(`/admin/motoristas/${id}`, data),
  deleteMotorista: (id) => api.delete(`/admin/motoristas/${id}`),
  // Contratados
  getContractors: () => api.get('/admin/contractors'),
  // Programações de Entrega
  getProgramacoes: (statsPeriod, periodDate) => {
    const params = new URLSearchParams();
    if (statsPeriod && statsPeriod !== 'general') params.append('period', statsPeriod);
    if (periodDate) params.append('periodDate', periodDate);
    return api.get('/admin/programacoes' + (params.toString() ? '?' + params.toString() : ''), { timeout: 30000 });
  },
  updateProgramacao: (id, data) => api.put(`/admin/programacoes/${id}`, data),
  deleteProgramacao: (id) => api.delete(`/admin/programacoes/${id}`),
  createProgramacao: (data) => api.post('/admin/programacoes', data),
  importProgramacoes: (data) => api.post('/admin/programacoes/import', data),
  syncProgramacoesIcompany: () => api.get('/admin/programacoes/sync/icompany'),
  // Reconciliação
  uploadReconciliation: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/reconciliation/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  applyReconciliation: (updates) => api.post('/admin/reconciliation/apply', { updates }),
  getPrograms: () => api.get('/admin/programs'),
  createProgram: (data) => api.post('/admin/programs', data),
  importProgramsFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/admin/programs/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  importProgramsText: (text) => api.post('/admin/programs/import', { text })
};

// Adiciona métodos do deliveryService para iniciar entrega
export const deliveryService = {
  createDelivery: (data) => api.post('/deliveries', data),
  getMyDeliveries: (params) => api.get('/deliveries', { params }),
  // Programações atribuídas ao contratado do usuário
  // Note: rota implementada dentro do router de `deliveries`, portanto URL completa será /api/deliveries/programacoes/mine
  getProgramacoesAssigned: () => api.get('/deliveries/programacoes/mine'),
  getDelivery: (id) => api.get(`/deliveries/${id}`),
  uploadDocument: (deliveryId, documentType, files) => {
    const formData = new FormData();
    // files can be a single File, an array of Files or a FileList
    const arr = Array.isArray(files) ? files : files instanceof FileList ? Array.from(files) : [files];
    arr.forEach((f) => formData.append('file', f));
    // Don't set Content-Type manually — let axios handle it for FormData
    // This allows the interceptor to properly set Authorization and X-City headers
    return api.post(`/deliveries/${deliveryId}/documents/${documentType}`, formData);
  },
  deleteDocument: (deliveryId, documentType, index) =>
    api.delete(`/deliveries/${deliveryId}/documents/${documentType}/${index}`),
  submitDelivery: (id, data = {}) => api.post(`/deliveries/${id}/submit`, data),
  deleteDelivery: (id) => api.delete(`/deliveries/${id}`),
  updateDelivery: (id, data) => api.put(`/deliveries/${id}`, data)
};
