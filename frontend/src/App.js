import EntregasEmAndamento from './pages/EntregasEmAndamento';
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/authContext';
import PrivateRoute from './components/PrivateRoute';
import AppLayout from './components/AppLayout';
import { CityProvider, useCity } from './contexts/CityContext';
import { ThemeProvider } from './contexts/ThemeContext';
import CitySelector from './components/CitySelector';
import PoliticaPrivacidade from './pages/PoliticaPrivacidade';
import TermosUso from './pages/TermosUso';
import Suporte from './pages/Suporte';
import BaseDadosGeral from './pages/BaseDadosGeral';
import Ycompany from './pages/Ycompany';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import NovaEntrega from './pages/NovaEntrega';
import MinhasEntregas from './pages/MinhasEntregas';
import AdminDashboard from './pages/AdminDashboard';
import MonitorEntregas from './pages/MonitorEntregas';
import UserManagement from './pages/UserManagement';
import MotoristaManagement from './pages/MotoristaManagement';
import ProgramacaoManagement from './pages/ProgramacaoManagement';
import ProgramadasEntregas from './pages/ProgramadasEntregas';
import EntregasCanhotosPendentes from './pages/EntregasCanhotosPendentes';
import Reconciliation from './pages/Reconciliation';
import Profile from './pages/Profile';
import EntregaEmRota from './pages/EntregaEmRota';

function AppContent() {

        <Route
          path="/entregas-em-andamento"
          element={
            <PrivateRoute>
              <AppLayout>
                <EntregasEmAndamento />
              </AppLayout>
            </PrivateRoute>
          }
        />
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
        path="/entrega/:id"
        element={
          <PrivateRoute>
            <AppLayout>
              <EntregaEmRota />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/entregas-programadas"
        element={
          <PrivateRoute>
            <AppLayout>
              <ProgramadasEntregas />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/entregas-canhotos-pendentes"
        element={
          <PrivateRoute>
            <AppLayout>
              <EntregasCanhotosPendentes />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <PrivateRoute allowedRoles={[ 'admin', 'manager', 'geomar' ]}>
            <AppLayout>
              <AdminDashboard />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/monitor-entregas"
        element={
          <PrivateRoute allowedRoles={[ 'admin', 'manager', 'geomar' ]}>
            <AppLayout>
              <MonitorEntregas />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/usuarios"
        element={
          <PrivateRoute allowedRoles={[ 'admin', 'manager', 'geomar' ]}>
            <AppLayout>
              <UserManagement />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/motoristas"
        element={
          <PrivateRoute allowedRoles={[ 'admin', 'manager', 'geomar' ]}>
            <AppLayout>
              <MotoristaManagement />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/programacoes"
        element={
          <PrivateRoute allowedRoles={[ 'admin', 'manager', 'geomar' ]}>
            <AppLayout>
              <ProgramacaoManagement />
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

      <Route
        path="/politica-privacidade"
        element={<AppLayout><PoliticaPrivacidade /></AppLayout>}
      />
      <Route
        path="/termos-uso"
        element={<AppLayout><TermosUso /></AppLayout>}
      />
      <Route
        path="/suporte"
        element={<AppLayout><Suporte /></AppLayout>}
      />
      <Route
        path="/base-dados-geral"
        element={<AppLayout><BaseDadosGeral /></AppLayout>}
      />
      <Route
        path="/ycompany"
        element={
          <PrivateRoute allowedRoles={['admin', 'manager', 'geomar']}>
            <AppLayout>
              <Ycompany />
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
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </AuthProvider>
      </CityProvider>
    </Router>
  );
}

export default App;
