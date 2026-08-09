import { useState, useEffect, useCallback } from 'react';

// Theme management for the TikTok Manager UI.
// Supports 'dark' (default) and 'light'. The active theme is applied to
// <html data-theme="..."> so CSS variables can switch. The choice persists in
// localStorage and falls back to the OS `prefers-color-scheme` on first load.

const THEME_KEY = 'tiktok-manager-theme';

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch (e) {
    // localStorage unavailable — ignore and fall through
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
};

// Apply the initial theme before the first paint to avoid a flash of the
// wrong theme (runs when the module is first imported).
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', getInitialTheme());
}

const useTheme = () => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      // Ignore persistence errors (e.g. private browsing)
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme, setTheme };
};

export default useTheme;
