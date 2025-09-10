import React, { createContext, useContext, useState, useEffect } from 'react';
import { WorkspaceTheme, getThemeById, getDefaultTheme } from '@/lib/themes';

interface ThemeContextType {
  currentTheme: WorkspaceTheme;
  setTheme: (themeId: string) => void;
  getThemeForWorkspace: (workspaceId: string) => WorkspaceTheme;
  setWorkspaceTheme: (workspaceId: string, themeId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  workspaceId?: string;
  initialThemeId?: string;
}

export function ThemeProvider({ children, workspaceId, initialThemeId }: ThemeProviderProps) {
  const [workspaceThemes, setWorkspaceThemes] = useState<Record<string, string>>({});
  const [currentThemeId, setCurrentThemeId] = useState(initialThemeId || 'navy');

  useEffect(() => {
    if (initialThemeId) {
      setCurrentThemeId(initialThemeId);
    }
  }, [initialThemeId]);

  const currentTheme = getThemeById(currentThemeId);

  const setTheme = (themeId: string) => {
    setCurrentThemeId(themeId);
  };

  const getThemeForWorkspace = (workspaceId: string): WorkspaceTheme => {
    const themeId = workspaceThemes[workspaceId] || 'navy';
    return getThemeById(themeId);
  };

  const setWorkspaceTheme = (workspaceId: string, themeId: string) => {
    setWorkspaceThemes(prev => ({
      ...prev,
      [workspaceId]: themeId
    }));
    
    // If this is the current workspace, update the current theme
    if (workspaceId === workspaceId) {
      setCurrentThemeId(themeId);
    }
  };

  const value: ThemeContextType = {
    currentTheme,
    setTheme,
    getThemeForWorkspace,
    setWorkspaceTheme,
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