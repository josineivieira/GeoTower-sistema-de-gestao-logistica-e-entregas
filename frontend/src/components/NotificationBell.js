import React from 'react';
import { FaBell } from 'react-icons/fa';

const NotificationBell = ({ count = 0, onClick }) => (
  <button
    onClick={onClick}
    className="relative flex items-center justify-center h-10 w-10 rounded-full bg-white/15 border border-white/20 hover:bg-white/25 transition-all duration-200"
    aria-label="Notificações"
  >
    <FaBell className="text-lg text-white" />
    {count > 0 && (
      <span className="absolute top-1 right-1 bg-red-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 shadow">
        {count}
      </span>
    )}
  </button>
);

export default NotificationBell;
