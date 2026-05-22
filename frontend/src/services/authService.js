import api from './api';

export const authService = {
  register: (data, city) => api.post('/auth/register', data, { headers: { 'X-City': city || localStorage.getItem('city') || 'manaus' }, timeout: 60000 }),
  login: (username, password, city) => {
    // Login pode demorar mais por causa da busca no banco e validações, então aumenta timeout
    return api.post('/auth/login', { username, password }, { headers: { 'X-City': city || localStorage.getItem('city') || 'manaus' }, timeout: 90000 });
  },
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  changePassword: (data) => api.put('/auth/change-password', data)
};



export const adminService = {
  getDeliveries: (filters, statsPeriod, periodDate) => {
    const params = {};
    if (!filters) return api.get('/admin/deliveries');
    if (filters.status) params.status = filters.status;
    if (filters.searchTerm) params.q = filters.searchTerm;
    if (filters.processo) params.processo = filters.processo;
    if (filters.container) params.container = filters.container;
    if (filters.recebedor) params.recebedor = filters.recebedor;
    if (filters.sentido && filters.sentido !== 'all') params.sentido = filters.sentido;
    if (filters.pontualidade) params.pontualidade = filters.pontualidade;
    if (filters.horaStatusFrom) params.horaStatusStart = filters.horaStatusFrom;
    if (filters.horaStatusTo) params.horaStatusEnd = filters.horaStatusTo;
    if (filters.startDate) params.agendamentoStart = filters.startDate;
    if (filters.endDate) params.agendamentoEnd = filters.endDate;
    if (filters.tempoStatusMin) params.tempoStatusMin = filters.tempoStatusMin;
    if (filters.tempoStatusMax) params.tempoStatusMax = filters.tempoStatusMax;
    if (filters._refresh) params._refresh = filters._refresh;
    if (statsPeriod && statsPeriod !== 'general') params.period = statsPeriod;
    if (periodDate) params.periodDate = periodDate;
    return api.get('/admin/deliveries', { params });
  },
  getStatistics: (params) => api.get('/admin/statistics', { params }),
  getDeliveryDetails: (id) => api.get(`/admin/deliveries/${id}`),
  updateDelivery: (id, data) => api.put(`/admin/deliveries/${id}`, data),
  getCanhotosPendentes: () => api.get('/admin/canhotos-pendentes'),
  updateCanhotoRetornos: (id, data) => api.put(`/admin/canhotos-pendentes/${id}/retornos`, data),
  concluirCanhotoPendencia: (id, data) => api.put(`/admin/canhotos-pendentes/${id}/concluir`, data),
  uploadCanhotoDocumento: (id, documentType, files) => {
    const formData = new FormData();
    const arr = Array.isArray(files) ? files : files instanceof FileList ? Array.from(files) : [files];
    arr.forEach((file) => formData.append('file', file));
    return api.post(`/admin/canhotos-pendentes/${id}/documentos/${documentType}`, formData);
  },
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
  getProgramacoes: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.period && filters.period !== 'general') params.append('period', filters.period);
    if (filters.periodDate) params.append('periodDate', filters.periodDate);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters._refresh) params.append('_refresh', filters._refresh);
    return api.get('/admin/programacoes' + (params.toString() ? '?' + params.toString() : ''), { timeout: 30000 });
  },
  updateProgramacao: (id, data) => api.put(`/admin/programacoes/${id}`, data),
  deleteProgramacao: (id) => api.delete(`/admin/programacoes/${id}`),
  createProgramacao: (data) => api.post('/admin/programacoes', data),
  importProgramacoes: (data) => api.post('/admin/programacoes/import', data),
  removeInvalidDocument: (deliveryId, documentType, reason) =>
    api.post(`/admin/deliveries/${deliveryId}/documents/${documentType}/remove`, { reason }),
  syncProgramacoesIcompany: (params = {}) => api.get('/admin/programacoes/sync/icompany', { params }),
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
  importProgramsText: (text) => api.post('/admin/programs/import', { text }),
  // Verificação de Arquivos (Arquivos Verificados / Icompany)
  getVerification: (deliveryId) => api.get(`/deliveries/${deliveryId}/verification`),
  updateDeliveryVerification: (deliveryId, data) => api.post(`/deliveries/${deliveryId}/verification`, data),
  getVerificationsList: () => api.get('/deliveries/verifications/list'),
  // Icompany
  getIcompanyData: () => api.get('/icompany'),
  searchIcompanyByProcess: (processo) => api.get(`/icompany/search?q=${encodeURIComponent(processo)}`),
  
  // Controle de Protocolos
  getControleProtocolos: (searchTerm) => {
    const params = {};
    if (searchTerm) params.q = searchTerm;
    return api.get('/controle-protocolos', { params });
  },
  getControleProtocoloById: (id) => api.get(`/controle-protocolos/${id}`)
};

// Adiciona métodos do deliveryService para iniciar entrega
export const deliveryService = {
  createDelivery: (data) => api.post('/deliveries', data),
  getMyDeliveries: (params) => {
    const query = { ...params };
    if (query.includeCanceled === true) {
      query.includeCanceled = 'true';
    }
    return api.get('/deliveries', { params: query });
  },
  // Programações atribuídas ao contratado do usuário
  // Note: rota implementada dentro do router de `deliveries`, portanto URL completa será /api/deliveries/programacoes/mine
  getProgramacoesAssigned: (params) => api.get('/deliveries/programacoes/mine', { params }),
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
  uploadDocumentAndUpdate: (deliveryId, documentType, files, statusUpdate) => {
    const formData = new FormData();
    const arr = Array.isArray(files) ? files : files instanceof FileList ? Array.from(files) : [files];
    arr.forEach((f) => formData.append('file', f));
    formData.append('documentType', documentType);
    if (statusUpdate.status) formData.append('status', statusUpdate.status);
    if (statusUpdate.currentStep) formData.append('currentStep', statusUpdate.currentStep);
    // add other fields
    for (const [key, value] of Object.entries(statusUpdate)) {
      if (key !== 'status' && key !== 'currentStep') {
        formData.append(key, value);
      }
    }
    return api.post(`/deliveries/${deliveryId}/upload-and-update`, formData);
  },
  deleteDocument: (deliveryId, documentType, index) =>
    api.delete(`/deliveries/${deliveryId}/documents/${documentType}/${index}`),
  submitDelivery: (id, data = {}) => api.post(`/deliveries/${id}/submit`, data),
  deleteDelivery: (id) => api.delete(`/deliveries/${id}`),
  updateDelivery: (id, data) => api.put(`/deliveries/${id}`, data)
};

// Serviço de notificações
export const notificationService = {
  getNotifications: (params = {}) => api.get('/notifications', { params }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
  createNotification: (data) => api.post('/notifications', data)
};
