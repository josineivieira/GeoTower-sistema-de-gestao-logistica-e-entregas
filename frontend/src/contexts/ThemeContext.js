import React, { createContext, useContext, useState, useEffect } from 'react';

// Global theme context used by multiple pages.  The tower UI previously
// persisted its own "torreControleTema" key, but having a central context
// makes it easy to expose selection everywhere (Profile, etc) and keeps the
// value reactive.

// theme definitions shared by multiple screens
export const THEMES = {
  dark: {
    name: '🌙 Escuro',
    bg: '#0f0f1a',
    bgSecondary: '#1a1a2e',
    text: '#ffffff',
    textSecondary: '#e0e0e0',
    border: 'border-white/10',
    header: 'bg-[#0f0f1a]/90',
    card: 'bg-white/5',
    cardHover: 'hover:bg-white/10',
    tableRow: 'bg-transparent',
    tableRowAlt: 'bg-white/[0.015]',
    tableRowHover: 'hover:bg-white/[0.04]'
  },
  black: {
    name: '⚫ Preto Puro',
    bg: '#000000',
    bgSecondary: '#0a0a0a',
    text: '#ffffff',
    textSecondary: '#d0d0d0',
    border: 'border-white/[0.08]',
    header: 'bg-black/95',
    card: 'bg-white/[0.03]',
    cardHover: 'hover:bg-white/[0.06]',
    tableRow: 'bg-transparent',
    tableRowAlt: 'bg-white/[0.02]',
    tableRowHover: 'hover:bg-white/[0.05]'
  },

  light: {
    name: '☀️ Claro',
    // softer off-white backgrounds for better contrast with rows
    bg: '#f5f7fa',
    bgSecondary: '#ffffff',
    text: '#1a1a1a',
    textSecondary: '#404040',
    border: 'border-gray-300',
    header: 'bg-white/95',
    // cards and other surfaces slightly gray instead of pure white
    card: 'bg-gray-100',
    cardHover: 'hover:bg-gray-200',
    tableRow: 'bg-gray-100',
    tableRowAlt: 'bg-gray-200',
    tableRowHover: 'hover:bg-gray-300'
  },

  company: {
    name: '🎨 Cores Empresa',
    bg: '#f3e5f5',
    bgSecondary: '#ffffff',
    text: '#1a0033',
    textSecondary: '#4a0080',
    border: 'border-purple-200',
    header: 'bg-gradient-to-r from-purple-700 to-indigo-700',
    card: 'bg-purple-50',
    cardHover: 'hover:bg-purple-100',
    tableRow: 'bg-purple-50',
    tableRowAlt: 'bg-purple-100',
    tableRowHover: 'hover:bg-purple-200'
  },
  sunset: {
    name: '🌅 Pôr do Sol',
    bg: '#fff5f7',
    bgSecondary: '#ffeef0',
    text: '#4b1e3b',
    textSecondary: '#6b2055',
    border: 'border-pink-200',
    header: 'bg-gradient-to-r from-pink-500 to-orange-500',
    card: 'bg-pink-50',
    cardHover: 'hover:bg-pink-100',
    tableRow: 'bg-pink-50',
    tableRowAlt: 'bg-pink-100',
    tableRowHover: 'hover:bg-pink-200',
  },
  ocean: {
    name: '🌊 Oceano',
    bg: '#e0f7fa',
    bgSecondary: '#ffffff',
    text: '#00363a',
    textSecondary: '#005662',
    border: 'border-teal-200',
    header: 'bg-gradient-to-r from-teal-400 to-blue-500',
    card: 'bg-teal-50',
    cardHover: 'hover:bg-teal-100',
    tableRow: 'bg-teal-50',
    tableRowAlt: 'bg-teal-100',
    tableRowHover: 'hover:bg-teal-200',
  },
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // migrate existing key if necessary
  const stored = localStorage.getItem('appTheme');
  const legacy = localStorage.getItem('torreControleTema');
  const initial = stored || legacy || 'dark';
  const [theme, setTheme] = useState(initial);

  useEffect(() => {
    localStorage.setItem('appTheme', theme);
    // keep backward compatibility for the tower page
    localStorage.setItem('torreControleTema', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
