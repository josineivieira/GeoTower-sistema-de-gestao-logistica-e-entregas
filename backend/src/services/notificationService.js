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
      message: `Container ${containerNumber} - ${driverName} solicitou agendamento de devolução`,
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
  static async getUserNotifications(userRole, userCity, userId, options = {}) {
    const { limit = 50, offset = 0, includeRead = false } = options;

    // Buscar notificações que contêm a role do usuário e coincidem com sua cidade
    const query = {
      recipientRoles: { $in: [userRole, 'all'] },
      'deletedBy.userId': { $ne: userId }, // Excluir notificações deletadas pelo usuário
      $or: [
        { city: userCity },
        { city: 'both' }
      ]
    };
    if (!includeRead) query['readBy.userId'] = { $ne: userId };

    return Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();
  }

  // Contar notificações não lidas para um usuário específico
  static async countUnreadNotifications(userRole, userCity, userId) {
    return Notification.countDocuments({
      recipientRoles: { $in: [userRole, 'all'] },
      'deletedBy.userId': { $ne: userId },
      'readBy.userId': { $ne: userId },
      $or: [
        { city: userCity },
        { city: 'both' }
      ]
    });
  }

  // Marcar notificação como lida para um usuário específico
  static async markAsRead(notificationId, userId, userName) {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return null;
    }

    // Verificar se o usuário já marcou como lido
    const alreadyRead = notification.readBy.some(r => r.userId === userId);
    if (!alreadyRead) {
      notification.readBy.push({
        userId,
        userName,
        readAt: new Date()
      });
      await notification.save();
    }

    return notification;
  }

  // Deletar notificação para um usuário específico
  static async deleteNotificationForUser(notificationId, userId, userName) {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return null;
    }

    // Verificar se o usuário já deletou
    const alreadyDeleted = notification.deletedBy.some(d => d.userId === userId);
    if (!alreadyDeleted) {
      notification.deletedBy.push({
        userId,
        userName,
        deletedAt: new Date()
      });
      await notification.save();
    }

    return notification;
  }

  // Marcar todas como lidas para um usuário
  static async markAllAsRead(userRole, userId, userName) {
    // Buscar todas as notificações não lidas do usuário
    const notifications = await Notification.find({
      recipientRoles: { $in: [userRole, 'all'] },
      'readBy.userId': { $ne: userId }
    });

    // Marcar cada uma como lida
    for (const notification of notifications) {
      const alreadyRead = notification.readBy.some(r => r.userId === userId);
      if (!alreadyRead) {
        notification.readBy.push({
          userId,
          userName,
          readAt: new Date()
        });
        await notification.save();
      }
    }

    return { acknowledged: true, updated: notifications.length };
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
