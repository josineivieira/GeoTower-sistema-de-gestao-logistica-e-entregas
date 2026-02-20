import React, { useEffect } from 'react';

const NotificationToast = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-6 right-6 z-[9999] bg-gradient-to-r from-purple-600 to-blue-500 text-white px-6 py-4 rounded-xl shadow-2xl flex flex-col gap-1 animate-slide-in">
      <div className="font-bold text-base flex items-center gap-2">
        <span role="img" aria-label="Caminhão">🚚</span> {notification.title}
      </div>
      <div className="text-xs font-medium">{notification.info}</div>
      <button className="mt-2 text-xs text-white/80 hover:text-white underline self-end" onClick={onClose}>Fechar</button>
    </div>
  );
};

export default NotificationToast;