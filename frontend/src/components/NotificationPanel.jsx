import React, { useEffect, useMemo, useState } from 'react';
import {
  FaTimes,
  FaCheckCircle,
  FaTrash,
  FaBell,
  FaCheckDouble,
  FaRegClock,
  FaExclamationTriangle,
  FaInfoCircle,
  FaTimesCircle,
  FaSearch,
  FaFilter
} from 'react-icons/fa';
import { AnimatePresence, motion } from 'framer-motion';
import { notificationService } from '../services/authService';

const NotificationPanel = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all | unread
  const [search, setSearch] = useState('');

  const isNotificationRead = (notification) => {
    if (typeof notification?.isRead === 'boolean') return notification.isRead;
    return Array.isArray(notification?.readBy) && notification.readBy.length > 0;
  };

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

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !isNotificationRead(item)).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const matchesFilter =
        filter === 'unread' ? !isNotificationRead(notification) : true;

      const text = `${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [notifications, filter, search]);

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

  const getRelativeDay = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today - target;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    return 'Anteriores';
  };

  const groupedNotifications = useMemo(() => {
    return filteredNotifications.reduce(
      (acc, notification) => {
        const group = getRelativeDay(notification.createdAt);
        acc[group].push(notification);
        return acc;
      },
      { Hoje: [], Ontem: [], Anteriores: [] }
    );
  }, [filteredNotifications]);

  const getTypeConfig = (type) => {
    switch (type) {
      case 'success':
        return {
          line: 'from-emerald-400 to-green-500',
          soft: 'bg-emerald-50/90',
          border: 'border-emerald-100',
          iconBg: 'bg-emerald-100',
          iconColor: 'text-emerald-600',
          icon: <FaCheckCircle size={16} />
        };
      case 'warning':
        return {
          line: 'from-amber-400 to-yellow-500',
          soft: 'bg-amber-50/90',
          border: 'border-amber-100',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
          icon: <FaExclamationTriangle size={16} />
        };
      case 'error':
        return {
          line: 'from-rose-400 to-red-500',
          soft: 'bg-rose-50/90',
          border: 'border-rose-100',
          iconBg: 'bg-rose-100',
          iconColor: 'text-rose-600',
          icon: <FaTimesCircle size={16} />
        };
      default:
        return {
          line: 'from-sky-400 to-blue-500',
          soft: 'bg-sky-50/90',
          border: 'border-sky-100',
          iconBg: 'bg-sky-100',
          iconColor: 'text-sky-600',
          icon: <FaInfoCircle size={16} />
        };
    }
  };

  const getPriorityBadge = (priority) => {
    const map = {
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
      map[priority] || {
        label: 'Normal',
        className: 'bg-slate-100 text-slate-700 border border-slate-200'
      }
    );
  };

  const renderSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[26px] border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-xl"
        >
          <div className="animate-pulse flex gap-4">
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
  );

  const totalVisible = filteredNotifications.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel */}
          <div className="absolute inset-0 flex items-end justify-end sm:p-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Painel de notificações"
              initial={{ x: 80, opacity: 0, scale: 0.98 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 80, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="
                relative flex h-[92dvh] w-full flex-col overflow-hidden
                rounded-t-[30px] border border-white/40 bg-white/75 shadow-[0_20px_80px_rgba(15,23,42,0.35)] backdrop-blur-2xl
                sm:h-full sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-[32px]
                lg:max-w-xl
              "
            >
              {/* brilho decorativo */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
                <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="absolute bottom-0 left-10 h-56 w-56 rounded-full bg-violet-400/10 blur-3xl" />
              </div>

              {/* Header premium */}
              <div className="relative overflow-hidden border-b border-white/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-800 px-5 py-5 text-white sm:px-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_30%)]" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/20 backdrop-blur-xl">
                      <FaBell size={20} />
                    </div>

                    <div>
                      <h2 className="text-xl font-black tracking-tight sm:text-2xl">
                        Notificações
                      </h2>
                      <p className="mt-1 text-sm text-blue-100/90">
                        Seu centro de atualizações em tempo real.
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                          {notifications.length} total
                        </span>

                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                          {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
                        </span>
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

              {/* Área de controle */}
              <div className="relative z-10 border-b border-slate-200/70 bg-white/70 px-4 py-4 backdrop-blur-xl sm:px-5">
                <div className="mb-3 flex flex-col gap-3">
                  <div className="relative">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Buscar notificações..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                        <FaFilter size={12} />
                        Filtrar:
                      </span>

                      <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1">
                        <button
                          onClick={() => setFilter('all')}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            filter === 'all'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Todas
                        </button>
                        <button
                          onClick={() => setFilter('unread')}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            filter === 'unread'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Não lidas
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={fetchNotifications}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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

                <div className="text-sm text-slate-500">
                  Exibindo <span className="font-semibold text-slate-700">{totalVisible}</span>{' '}
                  resultado{totalVisible !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Conteúdo */}
              <div className="relative z-10 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.7),rgba(241,245,249,0.95))] px-4 py-4 sm:px-5">
                {loading ? (
                  renderSkeleton()
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[30px] border border-dashed border-slate-300 bg-white/70 px-6 text-center shadow-sm backdrop-blur-xl">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 shadow-inner">
                      <FaBell size={28} />
                    </div>

                    <h3 className="text-lg font-bold text-slate-800">
                      Nenhuma notificação encontrada
                    </h3>

                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                      Tente ajustar a busca ou o filtro. Quando houver novidades,
                      elas aparecerão aqui com um visual elegante e organizado.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {['Hoje', 'Ontem', 'Anteriores'].map((group) => {
                      if (!groupedNotifications[group]?.length) return null;

                      return (
                        <div key={group}>
                          <div className="sticky top-0 z-10 mb-3 inline-flex rounded-full border border-white/60 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-500 shadow-sm backdrop-blur-xl">
                            {group}
                          </div>

                          <div className="space-y-4">
                            {groupedNotifications[group].map((notification, index) => {
                              const isRead = isNotificationRead(notification);
                              const typeConfig = getTypeConfig(notification.type);
                              const priority = getPriorityBadge(notification.priority);

                              return (
                                <motion.div
                                  key={notification._id}
                                  initial={{ opacity: 0, y: 18 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.03 }}
                                  className={`
                                    group relative overflow-hidden rounded-[26px] border p-4 shadow-[0_10px_35px_rgba(15,23,42,0.06)] transition-all duration-300
                                    hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)]
                                    ${isRead
                                      ? 'border-white/70 bg-white/75 backdrop-blur-xl'
                                      : `${typeConfig.soft} ${typeConfig.border} bg-white/90 backdrop-blur-xl`}
                                  `}
                                >
                                  <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${typeConfig.line}`} />

                                  {!isRead && (
                                    <div className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-sky-500 shadow-[0_0_0_8px_rgba(14,165,233,0.12)]" />
                                  )}

                                  <div className="flex items-start gap-4">
                                    <div
                                      className={`mt-1 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${typeConfig.iconBg} ${typeConfig.iconColor} shadow-sm`}
                                    >
                                      {typeConfig.icon}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="mb-2 flex flex-wrap items-center gap-2 pr-6">
                                        <h3 className="text-[15px] font-bold text-slate-800 sm:text-base">
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
                                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                                            Novo
                                          </span>
                                        )}
                                      </div>

                                      <p className="mb-4 text-sm leading-6 text-slate-600">
                                        {notification.message}
                                      </p>

                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                                          <FaRegClock size={12} />
                                          {formatDate(notification.createdAt)}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                          {!isRead && (
                                            <button
                                              onClick={() => handleMarkAsRead(notification._id)}
                                              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                                            >
                                              <FaCheckCircle size={14} />
                                              <span className="hidden sm:inline">
                                                Marcar como lida
                                              </span>
                                            </button>
                                          )}

                                          <button
                                            onClick={() => handleDeleteNotification(notification._id)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                          >
                                            <FaTrash size={14} />
                                            <span className="hidden sm:inline">Excluir</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationPanel;