export interface WorkspaceTheme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    border: string;
    text: string;
    muted: string;
    card: string;
    cardBorder: string;
    gradient: {
      from: string;
      to: string;
    };
  };
}

export const workspaceThemes: WorkspaceTheme[] = [
  {
    id: 'navy',
    name: 'Navy Blue',
    description: 'Professional and trustworthy',
    colors: {
      primary: '#1e3a8a',
      secondary: '#3b82f6',
      accent: '#60a5fa',
      background: '#ffffff',
      surface: '#f8fafc',
      border: '#e2e8f0',
      text: '#1e293b',
      muted: '#64748b',
      card: '#ffffff',
      cardBorder: '#e2e8f0',
      gradient: {
        from: '#1e3a8a',
        to: '#3b82f6',
      },
    },
  },
  {
    id: 'pink',
    name: 'Pink Dream',
    description: 'Soft and creative',
    colors: {
      primary: '#ec4899',
      secondary: '#f472b6',
      accent: '#f9a8d4',
      background: '#fdf2f8',
      surface: '#fce7f3',
      border: '#fbcfe8',
      text: '#831843',
      muted: '#be185d',
      card: '#ffffff',
      cardBorder: '#fbcfe8',
      gradient: {
        from: '#ec4899',
        to: '#f472b6',
      },
    },
  },
  {
    id: 'cream',
    name: 'Academic Cream',
    description: 'Classic and scholarly',
    colors: {
      primary: '#92400e',
      secondary: '#d97706',
      accent: '#f59e0b',
      background: '#fefce8',
      surface: '#fef3c7',
      border: '#fde68a',
      text: '#451a03',
      muted: '#92400e',
      card: '#ffffff',
      cardBorder: '#fde68a',
      gradient: {
        from: '#92400e',
        to: '#d97706',
      },
    },
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Natural and calming',
    colors: {
      primary: '#059669',
      secondary: '#10b981',
      accent: '#34d399',
      background: '#f0fdf4',
      surface: '#dcfce7',
      border: '#bbf7d0',
      text: '#064e3b',
      muted: '#047857',
      card: '#ffffff',
      cardBorder: '#bbf7d0',
      gradient: {
        from: '#059669',
        to: '#10b981',
      },
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    description: 'Warm and energetic',
    colors: {
      primary: '#ea580c',
      secondary: '#f97316',
      accent: '#fb923c',
      background: '#fff7ed',
      surface: '#fed7aa',
      border: '#fdba74',
      text: '#7c2d12',
      muted: '#c2410c',
      card: '#ffffff',
      cardBorder: '#fdba74',
      gradient: {
        from: '#ea580c',
        to: '#f97316',
      },
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    description: 'Soft and peaceful',
    colors: {
      primary: '#7c3aed',
      secondary: '#a855f7',
      accent: '#c084fc',
      background: '#faf5ff',
      surface: '#f3e8ff',
      border: '#e9d5ff',
      text: '#581c87',
      muted: '#7c3aed',
      card: '#ffffff',
      cardBorder: '#e9d5ff',
      gradient: {
        from: '#7c3aed',
        to: '#a855f7',
      },
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Deep and serene',
    colors: {
      primary: '#0891b2',
      secondary: '#06b6d4',
      accent: '#22d3ee',
      background: '#f0f9ff',
      surface: '#e0f2fe',
      border: '#bae6fd',
      text: '#0e7490',
      muted: '#0891b2',
      card: '#ffffff',
      cardBorder: '#bae6fd',
      gradient: {
        from: '#0891b2',
        to: '#06b6d4',
      },
    },
  },
];

export const getThemeById = (id: string): WorkspaceTheme => {
  return workspaceThemes.find(theme => theme.id === id) || workspaceThemes[0];
};

export const getDefaultTheme = (): WorkspaceTheme => {
  return workspaceThemes[0]; // Navy theme as default
}; 