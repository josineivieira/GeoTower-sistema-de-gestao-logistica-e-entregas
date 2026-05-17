import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from './authService';

const AuthContext = createContext();
const LOGIN_PATH = '/login';

const getTokenExpiration = (token) => {
  try {
    const payload = token?.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    const decoded = JSON.parse(atob(padded));

    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch (error) {
    return null;
  }
};

const redirectToLogin = () => {
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.replace(LOGIN_PATH);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback((redirect = false) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);

    if (redirect) {
      redirectToLogin();
    }
  }, []);

  useEffect(() => {
    // Load from localStorage on mount
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        const expiresAt = getTokenExpiration(savedToken);
        if (expiresAt && expiresAt <= Date.now()) {
          clearSession(true);
          setLoading(false);
          return;
        }

        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        // Se houver erro ao parsear, limpa
        clearSession();
      }
    }

    setLoading(false);
  }, [clearSession]);

  useEffect(() => {
    const handleAuthExpired = () => clearSession(true);
    window.addEventListener('auth:expired', handleAuthExpired);

    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [clearSession]);

  useEffect(() => {
    if (!token) return undefined;

    const expiresAt = getTokenExpiration(token);
    if (!expiresAt) return undefined;

    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      clearSession(true);
      return undefined;
    }

    const timer = window.setTimeout(() => clearSession(true), Math.min(delay, 2147483647));

    return () => window.clearTimeout(timer);
  }, [token, clearSession]);

  const login = async (username, password, city) => {
  try {
    const response = await authService.login(username, password, city);

    // response.data é o JSON que o backend retornou
    const data = response.data;

    const token = data.token;
    const driver = data.driver;

    // Se o backend retornar outro formato, isso vai te avisar
    if (!token || !driver) {
      throw new Error(data?.message || 'Resposta de login inválida');
    }

    const userCity = driver.city || 'manaus';
    const isManager = driver.role === 'manager';

    // Se a cidade for fixa no perfil, usamos essa cidade automaticamente.
    if (!isManager && userCity !== 'both') {
      if (city && userCity !== city) {
        throw new Error(`Acesso negado. Seu usuário tem permissão apenas para ${userCity === 'manaus' ? 'Manaus' : 'Itajaí'}`);
      }
      localStorage.setItem('city', userCity);
    }

    // Usuário com acesso às duas cidades mantém a seleção anterior ou usa Manaus por padrão.
    if (!isManager && userCity === 'both') {
      const storedCity = localStorage.getItem('city');
      if (!storedCity || !['manaus', 'itajai'].includes(storedCity)) {
        localStorage.setItem('city', 'manaus');
      }
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(driver));

    setToken(token);
    setUser(driver);

    return data;
  } catch (error) {
    clearSession();
    throw error;
  }
};


  const register = async (data) => {
  try {
    const response = await authService.register(data);

    const resData = response.data;
    const token = resData.token;
    const driver = resData.driver;

    if (!token || !driver) {
      throw new Error(resData?.message || 'Resposta de cadastro inválida');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(driver));

    setToken(token);
    setUser(driver);

    return resData;
  } catch (error) {
    clearSession();
    throw error;
  }
};


  const logout = () => {
    clearSession();
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
