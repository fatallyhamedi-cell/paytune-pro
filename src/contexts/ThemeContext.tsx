import React, { createContext, useContext, useState, useEffect } from "react";

export type Theme = "light" | "dark";

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  primaryAmber: string;
}

export const AMBER_COLOR = "#FFB300";

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("paytune_theme");
    return (saved as Theme) || "dark";
  });

  useEffect(() => {
    try {
      localStorage.setItem("paytune_theme", theme);
      const root = document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    } catch (e) {
      // safe fallback
    }
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === "dark",
        setTheme,
        toggleTheme,
        primaryAmber: AMBER_COLOR,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export default ThemeContext;
