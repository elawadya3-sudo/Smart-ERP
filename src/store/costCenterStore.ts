import { create } from 'zustand';
import { CostCenter } from '../types';
import { accountingService } from '../services/accounting';

interface CostCenterStore {
  costCenters: CostCenter[];
  isLoading: boolean;
  loadCostCenters: () => Promise<void>;
  addCostCenter: (costCenter: Omit<CostCenter, 'id'>) => Promise<string>;
  updateCostCenter: (id: string, updates: Partial<CostCenter>) => Promise<boolean>;
  deleteCostCenter: (id: string) => Promise<boolean>;
}

export const useCostCenterStore = create<CostCenterStore>((set, get) => ({
  costCenters: [],
  isLoading: true,
  
  loadCostCenters: async () => {
    set({ isLoading: true });
    try {
      const data = await accountingService.getCostCenters();
      set({ costCenters: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error("Failed to load cost centers", error);
    }
  },

  addCostCenter: async (costCenter) => {
    const id = await accountingService.addCostCenter(costCenter);
    await get().loadCostCenters();
    return id;
  },

  updateCostCenter: async (id, updates) => {
    const success = await accountingService.updateCostCenter(id, updates);
    if (success) await get().loadCostCenters();
    return success;
  },

  deleteCostCenter: async (id) => {
    const success = await accountingService.deleteCostCenter(id);
    if (success) await get().loadCostCenters();
    return success;
  }
}));
