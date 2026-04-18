import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from './authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage on mount
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        // Se houver erro ao parsear, limpa
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    setLoading(false);
  }, []);

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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    throw error;
  }
};


  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
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
