import React, { createContext, useContext, useEffect } from 'react';
import { WorkspaceTheme, getThemeById } from '@/lib/themes';

interface ThemeContextType {
  currentTheme: WorkspaceTheme;
  setTheme: (themeId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  themeId: string;
  onThemeChange?: (themeId: string) => void;
}

export function ThemeProvider({ children, themeId, onThemeChange }: ThemeProviderProps) {
  const currentTheme = getThemeById(themeId);

  const setTheme = (newThemeId: string) => {
    onThemeChange?.(newThemeId);
  };

  // Apply theme colors as CSS variables
  useEffect(() => {
    const root = document.documentElement;
    
    // Set CSS variables for the theme
    root.style.setProperty('--theme-primary', currentTheme.colors.primary);
    root.style.setProperty('--theme-secondary', currentTheme.colors.secondary);
    root.style.setProperty('--theme-accent', currentTheme.colors.accent);
    root.style.setProperty('--theme-background', currentTheme.colors.background);
    root.style.setProperty('--theme-surface', currentTheme.colors.surface);
    root.style.setProperty('--theme-border', currentTheme.colors.border);
    root.style.setProperty('--theme-text', currentTheme.colors.text);
    root.style.setProperty('--theme-muted', currentTheme.colors.muted);
    root.style.setProperty('--theme-card', currentTheme.colors.card);
    root.style.setProperty('--theme-card-border', currentTheme.colors.cardBorder);
    root.style.setProperty('--theme-gradient-from', currentTheme.colors.gradient.from);
    root.style.setProperty('--theme-gradient-to', currentTheme.colors.gradient.to);
    
    // Apply theme to body background
    document.body.style.backgroundColor = currentTheme.colors.background;
    document.body.style.color = currentTheme.colors.text;
    
  }, [currentTheme]);

  const value: ThemeContextType = {
    currentTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 