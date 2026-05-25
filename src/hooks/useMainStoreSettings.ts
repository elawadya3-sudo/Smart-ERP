import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../services/settingsService';
import { MainStoreSettings } from '../types/settings';

export function useMainStoreSettings() {
  const [settings, setSettings] = useState<MainStoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getMainStoreSettings();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (newSettings: Omit<MainStoreSettings, 'updatedAt'>) => {
    try {
      await settingsService.updateMainStoreSettings(newSettings);
      setSettings(prev => prev ? { ...prev, ...newSettings } : { ...newSettings } as MainStoreSettings);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update settings'));
      return false;
    }
  };

  return { settings, loading, error, updateSettings, refresh: fetchSettings };
}
