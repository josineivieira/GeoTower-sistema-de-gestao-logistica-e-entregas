const Notification = require('../models/Notification');

class NotificationService {
  // Criar notificação para usuários específicos
  static async createNotification({
    title,
    message,
    type = 'info',
    priority = 'medium',
    recipientRoles = ['admin', 'manager'],
    senderId,
    senderName,
    relatedEntity,
    metadata = {},
    city = 'manaus',
    expiresAt
  }) {
    try {
      // Criar notificação simples sem filtrar recipients aqui
      // As notificações serão filtradas quando o usuário as buscar
      const notification = new Notification({
        title,
        message,
        type,
        priority,
        recipientRoles: Array.isArray(recipientRoles) ? recipientRoles : [recipientRoles],
        senderId,
        senderName,
        relatedEntity,
        metadata,
        city,
        expiresAt,
        createdAt: new Date()
      });

      const saved = await notification.save();
      console.log(`✅ Notificação criada: ${title} (ID: ${saved._id})`);

      return [saved];
    } catch (error) {
      console.error('❌ Erro ao criar notificação:', error);
      throw error;
    }
  }

  // Criar notificação para agendamento solicitado
  static async notifyScheduleRequest(deliveryId, driverName, containerNumber, city = 'manaus') {
    return this.createNotification({
      title: 'Solicitação de Agendamento',
      message: `${driverName} solicitou agendamento de devolução para o container ${containerNumber}`,
      type: 'info',
      priority: 'medium',
      recipientRoles: ['admin', 'manager'],
      relatedEntity: {
        type: 'delivery',
        id: deliveryId,
        number: containerNumber
      },
      metadata: {
        action: 'schedule_request',
        driverName,
        containerNumber
      },
      city
    });
  }

  // Criar notificação para canhotos retidos
  static async notifyCanhotoRetido(deliveryId, containerNumber, observations, city = 'manaus') {
    return this.createNotification({
      title: 'Canhoto Retido',
      message: `Container ${containerNumber} finalizado com canhotos retidos. Observações: ${observations}`,
      type: 'warning',
      priority: 'high',
      recipientRoles: ['admin', 'manager'],
      relatedEntity: {
        type: 'delivery',
        id: deliveryId,
        number: containerNumber
      },
      metadata: {
        action: 'canhoto_retido',
        containerNumber,
        observations
      },
      city
    });
  }

  // Buscar notificações de um usuário baseado em sua role e cidade
  static async getUserNotifications(userRole, userCity, options = {}) {
    const { limit = 50, offset = 0 } = options;

    // Buscar notificações que contêm a role do usuário e coincidem com sua cidade
    const query = {
      recipientRoles: { $in: [userRole, 'all'] },
      $or: [
        { city: userCity },
        { city: 'both' }
      ]
    };

    return Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();
  }

  // Contar notificações para um role
  static async countUnreadNotifications(userRole) {
    return Notification.countDocuments({
      recipientRoles: { $in: [userRole, 'all'] }
    });
  }

  // Marcar notificação como lida (placeholder - não implementado no modelo atual)
  static async markAsRead(notificationId) {
    return Notification.findById(notificationId).lean();
  }

  // Marcar todas como lidas para um usuário (placeholder)
  static async markAllAsRead(userRole) {
    return { acknowledged: true };
  }

  // Limpar notificações antigas (mais de 30 dias)
  static async cleanupOldNotifications() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Notification.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
      read: true
    });

    console.log(`🧹 Limpeza: ${result.deletedCount} notificações antigas removidas`);
    return result;
  }
}

module.exports = NotificationService;