import { create } from 'zustand';
import { Account } from '../types';
import { accountingService } from '../services/accounting';

interface AccountingStore {
  accounts: Account[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  loadAccounts: () => Promise<void>;
  addAccount: (account: Omit<Account, 'id'>) => Promise<string>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;
}

export const useAccountingStore = create<AccountingStore>((set, get) => ({
  accounts: [],
  isLoading: true,
  searchTerm: '',
  setSearchTerm: (term) => set({ searchTerm: term }),
  
  loadAccounts: async () => {
    set({ isLoading: true });
    try {
      const data = await accountingService.getAccounts();
      set({ accounts: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error("Failed to load accounts", error);
    }
  },

  addAccount: async (account) => {
    const id = await accountingService.addAccount(account);
    await get().loadAccounts();
    return id;
  },

  updateAccount: async (id, updates) => {
    const success = await accountingService.updateAccount(id, updates);
    if (success) await get().loadAccounts();
    return success;
  },

  deleteAccount: async (id) => {
    const success = await accountingService.deleteAccount(id);
    if (success) await get().loadAccounts();
    return success;
  }
}));
