import React, { useEffect, useState } from 'react';
import {
  FaTimes,
  FaCheckCircle,
  FaTrash,
  FaBell,
  FaCheckDouble,
  FaRegClock,
  FaExclamationTriangle,
  FaInfoCircle,
  FaTimesCircle
} from 'react-icons/fa';
import { notificationService } from '../services/authService';

const NotificationPanel = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const isNotificationRead = (notification) => {
    if (typeof notification?.isRead === 'boolean') return notification.isRead;
    return Array.isArray(notification?.readBy) && notification.readBy.length > 0;
  };

  const unreadCount = notifications.filter(
    (notification) => !isNotificationRead(notification)
  ).length;

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationService.getNotifications();
      setNotifications(response?.data?.notifications || []);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchNotifications();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);

      setNotifications((prev) =>
        prev.map((notification) =>
          notification._id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Erro ao marcar como lido:', error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId);

      setNotifications((prev) =>
        prev.filter((notification) => notification._id !== notificationId)
      );
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();

      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, isRead: true }))
      );
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getTypeConfig = (type) => {
    switch (type) {
      case 'success':
        return {
          line: 'bg-emerald-500',
          soft: 'bg-emerald-50/80',
          border: 'border-emerald-100',
          iconBg: 'bg-emerald-100',
          icon: <FaCheckCircle className="text-emerald-600" size={18} />
        };
      case 'warning':
        return {
          line: 'bg-amber-500',
          soft: 'bg-amber-50/80',
          border: 'border-amber-100',
          iconBg: 'bg-amber-100',
          icon: <FaExclamationTriangle className="text-amber-600" size={18} />
        };
      case 'error':
        return {
          line: 'bg-rose-500',
          soft: 'bg-rose-50/80',
          border: 'border-rose-100',
          iconBg: 'bg-rose-100',
          icon: <FaTimesCircle className="text-rose-600" size={18} />
        };
      default:
        return {
          line: 'bg-sky-500',
          soft: 'bg-sky-50/80',
          border: 'border-sky-100',
          iconBg: 'bg-sky-100',
          icon: <FaInfoCircle className="text-sky-600" size={18} />
        };
    }
  };

  const getPriorityBadge = (priority) => {
    const config = {
      high: {
        label: 'Alta',
        className: 'bg-rose-100 text-rose-700 border border-rose-200'
      },
      medium: {
        label: 'Média',
        className: 'bg-amber-100 text-amber-700 border border-amber-200'
      },
      low: {
        label: 'Baixa',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200'
      }
    };

    return (
      config[priority] || {
        label: 'Média',
        className: 'bg-slate-100 text-slate-700 border border-slate-200'
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div className="flex h-full w-full items-end justify-end sm:items-stretch">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Painel de notificações"
          onClick={(e) => e.stopPropagation()}
          className="
            relative flex w-full flex-col overflow-hidden
            rounded-t-[28px] bg-white shadow-2xl
            sm:h-full sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-[28px]
            md:max-w-xl
            border border-white/60
          "
        >
          {/* Header */}
          <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-indigo-900 to-blue-700 px-5 py-5 text-white sm:px-6">
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,white,transparent_35%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/20">
                  <FaBell size={20} />
                </div>

                <div>
                  <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                    Notificações
                  </h2>
                  <p className="mt-1 text-sm text-blue-100/90">
                    Acompanhe tudo o que aconteceu em tempo real.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15">
                      {notifications.length} total
                    </span>

                    {unreadCount > 0 && (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">
                        {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 active:scale-95"
                aria-label="Fechar notificações"
              >
                <FaTimes size={18} />
              </button>
            </div>
          </div>

          {/* Barra de ações */}
          <div className="border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                {unreadCount > 0
                  ? `Você tem ${unreadCount} notificação${
                      unreadCount > 1 ? 'ões não lidas' : ' não lida'
                    }`
                  : 'Tudo em dia por aqui ✨'}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={fetchNotifications}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Atualizar
                </button>

                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <FaCheckDouble size={14} />
                    Marcar todas
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 py-4 sm:px-5">
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-slate-200" />
                      <div className="flex-1">
                        <div className="mb-3 h-4 w-2/3 rounded bg-slate-200" />
                        <div className="mb-2 h-3 w-full rounded bg-slate-200" />
                        <div className="mb-2 h-3 w-4/5 rounded bg-slate-200" />
                        <div className="h-3 w-1/3 rounded bg-slate-200" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 text-center shadow-sm">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <FaBell size={28} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  Nenhuma notificação
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Quando houver atualizações importantes, elas aparecerão aqui de
                  forma organizada e elegante.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => {
                  const isRead = isNotificationRead(notification);
                  const typeConfig = getTypeConfig(notification.type);
                  const priority = getPriorityBadge(notification.priority);

                  return (
                    <div
                      key={notification._id}
                      className={`
                        group relative overflow-hidden rounded-[24px] border p-4 shadow-sm transition-all duration-300
                        hover:-translate-y-0.5 hover:shadow-xl
                        ${isRead
                          ? 'border-slate-200 bg-white/85'
                          : `${typeConfig.soft} ${typeConfig.border} bg-white`}
                      `}
                    >
                      <div className={`absolute left-0 top-0 h-full w-1 ${typeConfig.line}`} />

                      <div className="flex items-start gap-4">
                        <div
                          className={`mt-1 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${typeConfig.iconBg}`}
                        >
                          {typeConfig.icon}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-800">
                              {notification.title}
                            </h3>

                            {notification.priority && (
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priority.className}`}
                              >
                                {priority.label}
                              </span>
                            )}

                            {!isRead && (
                              <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-[0_0_0_6px_rgba(14,165,233,0.14)]" />
                            )}
                          </div>

                          <p className="mb-3 text-sm leading-6 text-slate-600">
                            {notification.message}
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                              <FaRegClock size={12} />
                              {formatDate(notification.createdAt)}
                            </div>

                            <div className="flex items-center gap-2">
                              {!isRead && (
                                <button
                                  onClick={() => handleMarkAsRead(notification._id)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                                  title="Marcar como lido"
                                >
                                  <FaCheckCircle size={14} />
                                  <span className="hidden sm:inline">
                                    Marcar como lida
                                  </span>
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  handleDeleteNotification(notification._id)
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                title="Deletar notificação"
                              >
                                <FaTrash size={14} />
                                <span className="hidden sm:inline">Excluir</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPanel;
