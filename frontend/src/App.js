import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/authContext';
import PrivateRoute from './components/PrivateRoute';
import AppLayout from './components/AppLayout';
import { CityProvider, useCity } from './contexts/CityContext';
import CitySelector from './components/CitySelector';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import NovaEntrega from './pages/NovaEntrega';
import MinhasEntregas from './pages/MinhasEntregas';
import AdminDashboard from './pages/AdminDashboard';
import MonitorEntregas from './pages/MonitorEntregas';
import UserManagement from './pages/UserManagement';
import Reconciliation from './pages/Reconciliation';
import Profile from './pages/Profile';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const { city } = useCity();


  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/home" /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/home" /> : <Register />} />

      <Route
        path="/home"
        element={
          <PrivateRoute>
            <AppLayout>
              <Home />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <AppLayout>
              <Profile />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/nova-entrega"
        element={
          <PrivateRoute>
            <AppLayout>
              <NovaEntrega />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/nova-entrega/:id"
        element={
          <PrivateRoute>
            <AppLayout>
              <NovaEntrega />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/minhas-entregas"
        element={
          <PrivateRoute>
            <AppLayout>
              <MinhasEntregas />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <PrivateRoute adminOnly>
            <AppLayout>
              <AdminDashboard />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/monitor-entregas"
        element={
          <PrivateRoute adminOnly>
            <AppLayout>
              <MonitorEntregas />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/usuarios"
        element={
          <PrivateRoute adminOnly>
            <AppLayout>
              <UserManagement />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/reconciliacao"
        element={
          <PrivateRoute adminOnly>
            <AppLayout>
              <Reconciliation />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route path="/" element={<Navigate to="/home" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <CityProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </CityProvider>
    </Router>
  );
}

export default App;
