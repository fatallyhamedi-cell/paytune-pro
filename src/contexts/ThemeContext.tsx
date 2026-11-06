import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  primaryPurple: string;
}

export const PURPLE_COLOR = '#8B5CF6';

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
  primaryPurple: PURPLE_COLOR,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Force default to 'light'
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // Remove any existing dark class on load
    document.documentElement.classList.remove('dark');

    const savedTheme = (localStorage.getItem('theme') || localStorage.getItem('paytune_theme')) as Theme | null;
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setThemeState('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setThemeState('light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    localStorage.setItem('paytune_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    localStorage.setItem('paytune_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        setTheme,
        toggleTheme,
        primaryPurple: PURPLE_COLOR,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
