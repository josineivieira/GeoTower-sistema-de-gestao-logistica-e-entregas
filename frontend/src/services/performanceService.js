// Service para análise de produtividade e capacidade
import api from './api';

export const performanceService = {
  // Buscar dados de performance com filtros opcionais
  async getPerformanceData(filters = {}) {
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      
      const response = await api.get('/admin/performance', { params });
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar dados de performance:', error);
      throw error;
    }
  }
};