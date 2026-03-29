const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const NotificationService = require('../services/notificationService');

// Buscar notificações do usuário logado
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const userRole = req.user.role || 'driver';
    const userCity = req.city || 'manaus';

    const notifications = await NotificationService.getUserNotifications(userRole, userCity, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const unreadCount = await NotificationService.countUnreadNotifications(userRole);

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: notifications.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar notificações', error: error.message });
  }
});

// Contar notificações não lidas
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userRole = req.user.role || 'driver';
    const count = await NotificationService.countUnreadNotifications(userRole);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Erro ao contar notificações:', error);
    res.status(500).json({ success: false, message: 'Erro ao contar notificações', error: error.message });
  }
});

// Marcar notificação como lida
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await NotificationService.markAsRead(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notificação não encontrada' });
    }
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    res.status(500).json({ success: false, message: 'Erro ao marcar notificação como lida', error: error.message });
  }
});

// Marcar todas como lidas
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    const userRole = req.user.role || 'driver';
    const result = await NotificationService.markAllAsRead(userRole);
    res.json({ success: true, acknowledged: result.acknowledged });
  } catch (error) {
    console.error('Erro ao marcar todas como lidas:', error);
    res.status(500).json({ success: false, message: 'Erro ao marcar todas como lidas', error: error.message });
  }
});

// Criar notificação (para solicitações de agendamento, etc.)
router.post('/', auth, async (req, res) => {
  try {
    const { title, message, type = 'info', deliveryId } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Título e mensagem são obrigatórios' });
    }

    // Usar o método notifyScheduleRequest se for uma solicitação de agendamento
    let notifications;
    if (type === 'scheduling_request' && deliveryId) {
      notifications = await NotificationService.notifyScheduleRequest(
        deliveryId,
        req.user.name || req.user.username || 'Motorista',
        req.body.containerNumber || 'N/A',
        req.city || 'manaus'
      );
    } else {
      // Para outros tipos, usar o método genérico
      notifications = await NotificationService.createNotification({
        title,
        message,
        type,
        priority: type === 'warning' ? 'high' : 'medium',
        recipientRoles: ['admin', 'manager'],
        senderId: req.user.id,
        senderName: req.user.name || req.user.username,
        relatedEntity: deliveryId ? { type: 'delivery', id: deliveryId } : undefined,
        metadata: req.body.metadata || {},
        city: req.city || 'manaus'
      });
    }

    res.json({ success: true, notifications: notifications.length });
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar notificação', error: error.message });
  }
});

module.exports = router;