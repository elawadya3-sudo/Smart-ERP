import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { MainStoreSettings } from '../types/settings';

const MAIN_STORE_PATH = 'settings/main_store';

export const settingsService = {
  async getMainStoreSettings(): Promise<MainStoreSettings | null> {
    try {
      const docRef = doc(db, MAIN_STORE_PATH);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as MainStoreSettings;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, MAIN_STORE_PATH);
      return null;
    }
  },

  async updateMainStoreSettings(settings: Omit<MainStoreSettings, 'updatedAt'>): Promise<void> {
    try {
      const docRef = doc(db, MAIN_STORE_PATH);
      await setDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, MAIN_STORE_PATH);
      throw error;
    }
  }
};
