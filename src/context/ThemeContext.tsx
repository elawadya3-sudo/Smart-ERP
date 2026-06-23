import React, { createContext, useContext, useState, useEffect } from 'react';

export type SidebarTheme = 'dark' | 'light';
export type Density = 'compact' | 'comfortable';

export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  hover: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'odoo-blue', name: 'أودو الأزرق (Default)', primary: '#2563eb', hover: '#1d4ed8' },
  { id: 'sap-slate', name: 'ساب الرمادي', primary: '#475569', hover: '#334155' },
  { id: 'erpnext-green', name: 'إيرب نيكست الأخضر', primary: '#059669', hover: '#047857' },
  { id: 'amber-classic', name: 'الأمبر الكلاسيكي', primary: '#d97706', hover: '#b45309' },
  { id: 'rose-gold', name: 'الوردي الملكي', primary: '#be123c', hover: '#9f1239' }
];

interface ThemeContextType {
  themeColor: string;
  themeHoverColor: string;
  sidebarTheme: SidebarTheme;
  density: Density;
  setThemeColor: (color: string) => void;
  setThemeHoverColor: (color: string) => void;
  setSidebarTheme: (theme: SidebarTheme) => void;
  setDensity: (density: Density) => void;
  applyPreset: (presetId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeColor, setThemeColorState] = useState(() => localStorage.getItem('erp_theme_color') || '#2563eb');
  const [themeHoverColor, setThemeHoverColorState] = useState(() => localStorage.getItem('erp_theme_hover') || '#1d4ed8');
  const [sidebarTheme, setSidebarThemeState] = useState<SidebarTheme>(() => (localStorage.getItem('erp_sidebar_theme') as SidebarTheme) || 'dark');
  const [density, setDensityState] = useState<Density>(() => (localStorage.getItem('erp_density') as Density) || 'compact');

  useEffect(() => {
    const root = document.documentElement;
    
    // Apply primary colors
    root.style.setProperty('--color-primary', themeColor);
    root.style.setProperty('--color-primary-hover', themeHoverColor);
    
    // Apply sidebar themes
    if (sidebarTheme === 'dark') {
      root.style.setProperty('--color-sidebar', '#0f172a');
      root.style.setProperty('--color-sidebar-text', '#cbd5e1');
      root.style.setProperty('--color-sidebar-hover', '#1e293b');
      root.style.setProperty('--color-sidebar-border', '#1e293b');
    } else {
      root.style.setProperty('--color-sidebar', '#ffffff');
      root.style.setProperty('--color-sidebar-text', '#334155');
      root.style.setProperty('--color-sidebar-hover', '#f1f5f9');
      root.style.setProperty('--color-sidebar-border', '#cbd5e1');
    }
    
    // Apply density properties (padding & font sizing factors)
    if (density === 'compact') {
      root.style.setProperty('--padding-factor', '0.75');
      root.style.setProperty('--font-size-factor', '0.9');
    } else {
      root.style.setProperty('--padding-factor', '1.0');
      root.style.setProperty('--font-size-factor', '1.0');
    }
    
  }, [themeColor, themeHoverColor, sidebarTheme, density]);

  const setThemeColor = (color: string) => {
    setThemeColorState(color);
    localStorage.setItem('erp_theme_color', color);
  };

  const setThemeHoverColor = (color: string) => {
    setThemeHoverColorState(color);
    localStorage.setItem('erp_theme_hover', color);
  };

  const setSidebarTheme = (theme: SidebarTheme) => {
    setSidebarThemeState(theme);
    localStorage.setItem('erp_sidebar_theme', theme);
  };

  const setDensity = (d: Density) => {
    setDensityState(d);
    localStorage.setItem('erp_density', d);
  };

  const applyPreset = (presetId: string) => {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setThemeColor(preset.primary);
      setThemeHoverColor(preset.hover);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        themeColor,
        themeHoverColor,
        sidebarTheme,
        density,
        setThemeColor,
        setThemeHoverColor,
        setSidebarTheme,
        setDensity,
        applyPreset
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
