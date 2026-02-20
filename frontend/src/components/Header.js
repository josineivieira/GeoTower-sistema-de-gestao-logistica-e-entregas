import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { useCity } from '../contexts/CityContext';
import { FaSignOutAlt, FaUser, FaBars, FaHome, FaTimes } from 'react-icons/fa';
import NotificationBell from './NotificationBell';
import { adminService } from '../services/authService';

const Header = () => {

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationList, setNotificationList] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  // Carrega notificações de devolução do vazio e observações
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const response = await adminService.getDeliveries();
        const deliveries = response.data.deliveries || [];
        // Notificações: devolução do vazio e observações relevantes
        const notifications = [];
        deliveries.forEach((d) => {
          // Solicitação de devolução do vazio
          if (d.observations && d.observations.toUpperCase().includes('SOLICITACAO_AGENDAMENTO')) {
            notifications.push({
              type: 'devolucao',
              message: `Solicitação de devolução do vazio: ${d.deliveryNumber} - ${d.driverName}`,
              deliveryNumber: d.deliveryNumber,
              driverName: d.driverName,
              id: d._id
            });
          }
          // Observações do fluxo de entrega
          if (d.observations && d.observations.trim() !== '' && !d.observations.toUpperCase().includes('SOLICITACAO_AGENDAMENTO')) {
            notifications.push({
              type: 'observacao',
              message: `Observação: ${d.deliveryNumber} - ${d.driverName}: ${d.observations}`,
              deliveryNumber: d.deliveryNumber,
              driverName: d.driverName,
              id: d._id
            });
          }
        });
        setNotificationList(notifications);
        setNotificationCount(notifications.length);
      } catch (err) {
        setNotificationList([]);
        setNotificationCount(0);
      }
    }
    fetchNotifications();
    // Atualiza a cada 60s
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  // Fecha menu ao trocar de rota
  React.useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Fecha com ESC
  React.useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-50 text-white shadow-xl bg-gradient-to-r from-purple-700 via-purple-600 to-emerald-600/90 backdrop-blur-sm">
      {/* Top bar - Full width responsivo */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
        {/* Logo + Nome */}
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 sm:gap-3 lg:gap-4 hover:opacity-90 transition duration-200 group"
          aria-label="Ir para início"
        >
          <img
            src="/images/geotransporteslogo.svg"
            alt="GeoTransportes Logo"
            className="h-8 sm:h-10 lg:h-12 w-auto shrink-0 group-hover:scale-110 transition-transform"
            onError={(e) => { e.target.onerror = null; e.target.src = '/images/GeoTransportesLogo.svg'; }}
          />

          <div className="leading-tight text-left">
            <div className="text-base sm:text-lg lg:text-xl font-extrabold tracking-tight">
              GeoTransportes
            </div>
            <div className="text-xs sm:text-sm text-white/80 font-medium">
              Logística Rodoviária
            </div>
          </div>
        </button>

        {/* Ações */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          {/* Sino de notificações */}
          <div className="relative">
            <NotificationBell count={notificationCount} onClick={() => setShowNotifications((v) => !v)} />
            {showNotifications && notificationList.length > 0 && (
              <div className="absolute right-0 mt-2 w-80 max-w-xs bg-white text-gray-900 rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-3 border-b font-bold text-purple-700">Notificações</div>
                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {notificationList.map((n, idx) => (
                    <li key={n.id + idx} className="p-3 text-sm hover:bg-purple-50 cursor-pointer">
                      <span className={n.type === 'devolucao' ? 'text-blue-700 font-semibold' : 'text-yellow-700 font-semibold'}>
                        {n.type === 'devolucao' ? 'Devolução do Vazio' : 'Observação'}:
                      </span>
                      <span className="ml-2">{n.message}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => setShowNotifications(false)} className="w-full py-2 text-center text-xs text-gray-500 hover:text-purple-700">Fechar</button>
              </div>
            )}
          </div>
          {/* Chip do usuário responsivo */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3 text-xs sm:text-sm lg:text-base bg-white/15 border border-white/20 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 rounded-full hover:bg-white/20 transition-colors">
            <FaUser className="text-white/90" />
            <span className="font-semibold truncate">{user?.name}</span>
          </div>

          {/* Chip do usuário mobile */}
          <div className="md:hidden flex items-center gap-2 text-xs bg-white/15 border border-white/20 px-3 py-2 rounded-lg hover:bg-white/20 transition-colors">
            <FaUser className="text-white/90 text-sm" />
            <span className="font-semibold truncate max-w-[100px] sm:max-w-[150px]">{user?.name?.split(' ')[0]}</span>
          </div>

          {/* Botão menu */}
          <button
            onClick={() => setMenuOpen(true)}
            className="h-10 w-10 sm:h-11 sm:w-11 grid place-items-center rounded-xl bg-white/15 border border-white/20 hover:bg-white/25 active:scale-95 transition-all duration-200"
            aria-label="Abrir menu"
          >
            <FaBars className="text-lg sm:text-xl" />
          </button>
        </div>
      </div>

      {/* Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60]">
          {/* overlay */}
          <button
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Fechar menu"
          />

          {/* painel - responsivo */}
          <div className="absolute right-0 top-0 h-full w-80 sm:w-96 max-w-[90vw] bg-white text-gray-900 shadow-2xl border-l border-gray-200 flex flex-col">
            {/* Header do Drawer */}
            <div className="px-6 py-5 border-b-2 flex items-center justify-between bg-gradient-to-r from-purple-50 via-purple-25 to-emerald-50">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-emerald-600 flex items-center justify-center">
                  <FaUser className="text-white text-sm" />
                </div>
                <div className="leading-tight min-w-0">
                  <div className="text-sm font-bold text-gray-900">{user?.name || 'Usuário'}</div>
                  <div className="text-xs text-gray-500 font-medium">Menu Principal</div>
                </div>
              </div>

              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-200 transition duration-200 flex-shrink-0"
                aria-label="Fechar"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>

            {/* Menu Options */}
            <div className="flex-1 p-5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => navigate('/home')}
                  className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl
                             bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200
                             border border-emerald-200
                             transition-all duration-200 font-semibold text-center active:scale-95"
                >
                  <FaHome className="text-emerald-600 text-lg" />
                  <span className="text-xs">Início</span>
                </button>

                <button
                  onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                  className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl
                             bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200
                             border border-purple-200
                             transition-all duration-200 font-semibold text-center active:scale-95"
                >
                  <FaUser className="text-purple-600 text-lg" />
                  <span className="text-xs">Ajustes</span>
                </button>

                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl
                             bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200
                             border border-red-200
                             transition-all duration-200 font-semibold text-center active:scale-95"
                >
                  <FaSignOutAlt className="text-red-600 text-lg" />
                  <span className="text-xs">Sair</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t-2 bg-gray-50 text-center">
              <p className="text-xs text-gray-600 font-medium">
                💡 Pressione <span className="font-bold">Esc</span> para fechar
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

// CityChip removed: selection now happens on login. Kept function removed to avoid rendering.

export default Header;
