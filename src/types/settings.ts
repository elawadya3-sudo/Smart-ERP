export interface MainStoreSettings {
  storeName: string;
  mainBranchName: string;
  currency: string;
  branchEmail: string;
  phone: string;
  taxEnabled: boolean;
  taxRate: number;
  allowCrossbranchRequest: boolean;
  allowAddMainWarehouse?: boolean;
  receiptHeader?: string;
  receiptFooter?: string;
  showLogoInReceipt?: boolean;
  receiptPaperSize?: '80mm' | 'A4';
  taxRegistrationNumber?: string;
  showTaxDetails?: boolean;
  showBranchDetails?: boolean;
  storeLogoUrl?: string;
  updatedAt?: any;
}
