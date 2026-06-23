export interface FilterTemplate {
  name: string;
  filters: {
    startDate: string;
    endDate: string;
    filterBranch: string;
    filterWarehouse: string;
    filterPOS: string;
    filterShift: string;
    filterCashier: string;
    filterCustomer: string;
    filterProduct: string;
    filterCategory: string;
    filterPaymentMethod: string;
    filterStatus: string;
  };
}

const STORAGE_KEY = 'erp_reports_templates';

export const FilterTemplateManager = {
  getTemplates(): FilterTemplate[] {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  },

  saveTemplate(name: string, filters: FilterTemplate['filters']): FilterTemplate[] {
    const templates = this.getTemplates();
    const newTemplate: FilterTemplate = { name, filters };
    const updated = [...templates, newTemplate];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  },

  deleteTemplates(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
};
