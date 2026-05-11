import React, { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = {
  black: {
    name: 'Preto Puro',
    bg: '#000000',
    bgSecondary: '#0a0a0a',
    surface: '#0f0f0f',
    surfaceAlt: '#171717',
    text: '#ffffff',
    textSecondary: '#d4d4d4',
    muted: '#a3a3a3',
    accent: '#22c55e',
    accentSoft: 'rgba(34, 197, 94, 0.14)',
    headerGradient: 'linear-gradient(135deg, #000000 0%, #111827 58%, #064e3b 100%)',
    preview: 'linear-gradient(135deg, #000000 0%, #262626 52%, #064e3b 100%)',
    border: 'border-white/[0.08]',
    borderColor: 'rgba(255,255,255,0.10)',
    header: 'bg-black/95',
    card: 'bg-white/[0.03]',
    cardHover: 'hover:bg-white/[0.06]',
    tableRow: 'bg-transparent',
    tableRowAlt: 'bg-white/[0.02]',
    tableRowHover: 'hover:bg-white/[0.05]',
  },
  light: {
    name: 'Neutro',
    bg: '#f8fafc',
    bgSecondary: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#f1f5f9',
    text: '#111827',
    textSecondary: '#334155',
    muted: '#64748b',
    accent: '#0f766e',
    accentSoft: 'rgba(15, 118, 110, 0.12)',
    headerGradient: 'linear-gradient(135deg, #f8fafc 0%, #dbeafe 52%, #ccfbf1 100%)',
    preview: 'linear-gradient(135deg, #f8fafc 0%, #dbeafe 52%, #ccfbf1 100%)',
    border: 'border-gray-300',
    borderColor: 'rgba(15,23,42,0.14)',
    header: 'bg-white/95',
    card: 'bg-gray-100',
    cardHover: 'hover:bg-gray-200',
    tableRow: 'bg-gray-100',
    tableRowAlt: 'bg-gray-200',
    tableRowHover: 'hover:bg-gray-300',
  },
  company: {
    name: 'Violeta',
    bg: '#f5f3ff',
    bgSecondary: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#ede9fe',
    text: '#1e1b4b',
    textSecondary: '#4c1d95',
    muted: '#6d5e9c',
    accent: '#7c3aed',
    accentSoft: 'rgba(124, 58, 237, 0.14)',
    headerGradient: 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 48%, #0f766e 100%)',
    preview: 'linear-gradient(135deg, #ede9fe 0%, #c4b5fd 50%, #99f6e4 100%)',
    border: 'border-purple-200',
    borderColor: 'rgba(109,40,217,0.18)',
    header: 'bg-gradient-to-r from-purple-700 to-indigo-700',
    card: 'bg-purple-50',
    cardHover: 'hover:bg-purple-100',
    tableRow: 'bg-purple-50',
    tableRowAlt: 'bg-purple-100',
    tableRowHover: 'hover:bg-purple-200',
  },
  sunset: {
    name: 'Aurora',
    bg: '#fff7ed',
    bgSecondary: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#ffedd5',
    text: '#431407',
    textSecondary: '#7c2d12',
    muted: '#9a3412',
    accent: '#f97316',
    accentSoft: 'rgba(249, 115, 22, 0.14)',
    headerGradient: 'linear-gradient(135deg, #be123c 0%, #f97316 52%, #7c3aed 100%)',
    preview: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 48%, #fecdd3 100%)',
    border: 'border-pink-200',
    borderColor: 'rgba(249,115,22,0.18)',
    header: 'bg-gradient-to-r from-pink-500 to-orange-500',
    card: 'bg-orange-50',
    cardHover: 'hover:bg-orange-100',
    tableRow: 'bg-orange-50',
    tableRowAlt: 'bg-orange-100',
    tableRowHover: 'hover:bg-orange-200',
  },
  ocean: {
    name: 'Oceano',
    bg: '#ecfeff',
    bgSecondary: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#cffafe',
    text: '#083344',
    textSecondary: '#155e75',
    muted: '#0e7490',
    accent: '#0891b2',
    accentSoft: 'rgba(8, 145, 178, 0.14)',
    headerGradient: 'linear-gradient(135deg, #0e7490 0%, #2563eb 52%, #0f766e 100%)',
    preview: 'linear-gradient(135deg, #ecfeff 0%, #a5f3fc 48%, #bfdbfe 100%)',
    border: 'border-teal-200',
    borderColor: 'rgba(8,145,178,0.18)',
    header: 'bg-gradient-to-r from-teal-400 to-blue-500',
    card: 'bg-cyan-50',
    cardHover: 'hover:bg-cyan-100',
    tableRow: 'bg-cyan-50',
    tableRowAlt: 'bg-cyan-100',
    tableRowHover: 'hover:bg-cyan-200',
  },
  slate: {
    name: 'Grafite',
    bg: '#f1f5f9',
    bgSecondary: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#334155',
    muted: '#64748b',
    accent: '#475569',
    accentSoft: 'rgba(71, 85, 105, 0.12)',
    headerGradient: 'linear-gradient(135deg, #334155 0%, #475569 52%, #64748b 100%)',
    preview: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 52%, #94a3b8 100%)',
    border: 'border-slate-300',
    borderColor: 'rgba(15,23,42,0.14)',
    header: 'bg-slate-800',
    card: 'bg-slate-50',
    cardHover: 'hover:bg-slate-100',
    tableRow: 'bg-slate-50',
    tableRowAlt: 'bg-slate-100',
    tableRowHover: 'hover:bg-slate-200',
  },
};

const ThemeContext = createContext();

const getInitialTheme = () => {
  const stored = localStorage.getItem('appTheme');
  const legacy = localStorage.getItem('torreControleTema');
  return THEMES[stored] ? stored : THEMES[legacy] ? legacy : 'black';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme);
  const safeTheme = THEMES[theme] ? theme : 'black';
  const themeConfig = THEMES[safeTheme];

  const setTheme = (nextTheme) => {
    setThemeState(THEMES[nextTheme] ? nextTheme : 'black');
  };

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    [root, body].forEach((el) => {
      Array.from(el.classList)
        .filter((className) => className.startsWith('theme-'))
        .forEach((className) => el.classList.remove(className));
      el.classList.add(`theme-${safeTheme}`);
    });

    root.dataset.theme = safeTheme;
    root.style.setProperty('--app-bg', themeConfig.bg);
    root.style.setProperty('--app-bg-secondary', themeConfig.bgSecondary);
    root.style.setProperty('--app-surface', themeConfig.surface);
    root.style.setProperty('--app-surface-alt', themeConfig.surfaceAlt);
    root.style.setProperty('--app-text', themeConfig.text);
    root.style.setProperty('--app-text-secondary', themeConfig.textSecondary);
    root.style.setProperty('--app-muted', themeConfig.muted);
    root.style.setProperty('--app-accent', themeConfig.accent);
    root.style.setProperty('--app-accent-soft', themeConfig.accentSoft);
    root.style.setProperty('--app-border', themeConfig.borderColor);
    localStorage.setItem('appTheme', safeTheme);
    localStorage.setItem('torreControleTema', safeTheme);
  }, [safeTheme, themeConfig]);

  return (
    <ThemeContext.Provider value={{ theme: safeTheme, setTheme, themeConfig, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
