export type UserRole = 'ADMIN' | 'BRANCH_MANAGER' | 'WAREHOUSE_MANAGER' | 'CASHIER' | 'SALES' | 'PURCHASES' | 'HR' | 'ACCOUNTANT';

// ─── Super Admin / Multi-Tenant Types ────────────────────────────────────────
export type TenantStatus = 'active' | 'suspended' | 'expired' | 'trial';
export type TenantPlan = 'basic' | 'pro' | 'enterprise';

export interface Tenant {
  id: string;
  name: string;           // اسم الشركة
  dbId: string;           // اسم Firestore Named Database
  adminEmail: string;
  contactPhone?: string;
  address?: string;
  status: TenantStatus;
  plan: TenantPlan;
  maxUsers?: number;
  maxBranches?: number;
  expiresAt: string;      // ISO date string
  createdAt: string;
  updatedAt?: string;
  notes?: string;
  logoUrl?: string;
  allowedModules?: string[];
}

export interface TenantStats {
  totalOrders?: number;
  totalRevenue?: number;
  activeUsers?: number;
  lastActivity?: string;
}

export interface UserPermissions {
  dashboard: boolean;
  pos: boolean;
  adminPos?: boolean;
  inventory: boolean;
  accounting: boolean;
  customers: boolean;
  reports: boolean;
  settings: boolean;
  branchManagement: boolean;
  cashierManagement: boolean;
  systemReset: boolean;
  pos_make_return?: boolean;
  pos_delete_invoice?: boolean;
  // Granular inventory sub-pages
  inventory_products?: boolean;
  inventory_units?: boolean;
  inventory_itemmap?: boolean;
  inventory_warehouses?: boolean;
  inventory_receipt?: boolean;
  inventory_salesreturns?: boolean;
  inventory_purchasereturns?: boolean;
  inventory_issue?: boolean;
  inventory_branchtransfer?: boolean;
  inventory_transfers?: boolean;
  inventory_transfer_receipt?: boolean;
  inventory_opening?: boolean;
  inventory_stocktaking?: boolean;
  inventory_approval?: boolean;
  inventory_payable?: boolean;
  inventory_reports?: boolean;
  // Granular accounting sub-pages
  accounting_chart?: boolean;
  accounting_costcenters?: boolean;
  accounting_currencies?: boolean;
  accounting_checkstages?: boolean;
  accounting_taxes?: boolean;
  accounting_journal?: boolean;
  accounting_cash?: boolean;
  // Granular reports/system sub-pages
  reports_cash?: boolean;
  reports_history?: boolean;
  reports_center?: boolean;
  pos_create_invoice?: boolean;
  pos_edit_invoice?: boolean;
  pos_give_discount?: boolean;
  pos_open_drawer?: boolean;
  pos_close_shift?: boolean;
  pos_reprint_invoice?: boolean;
  // Granular sales sub-pages
  sales?: boolean;
  sales_basic?: boolean;
  sales_config?: boolean;
  sales_docs?: boolean;
  sales_approvals?: boolean;
  sales_reports?: boolean;
}

export interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  branchId?: string; // Assigned branch for cashiers
  allowedBranches?: string[]; // Multiple allowed branches for consolidated POS
  isActive?: boolean; // Whether the user can login
  permissions?: UserPermissions;
  createdAt: string;
  isRoot?: boolean; // المدير المطور الرئيسي المخفي
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  sizes: (string | number)[];
  colors: string[];
  images: string[];
  barcode: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  variants?: ProductVariant[];
  createdAt: string;
  tags?: string[];
  descriptionEn?: string;
  modelCode?: string;
  location?: string;
  originNumber?: string;
  weight?: number;
  weightUnit?: 'KG' | 'GRAM';
  minSellingPrice?: number;
  minQuantity?: number;
  productType?: 'simple' | 'variant';
  trackInventory?: boolean;
  warehouseId?: string;
}

export interface ProductVariant {
  size: string | number;
  color: string;
  quantity: number;
  sku?: string;
  price?: number;
  barcode?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku?: string;
  variant?: {
    size: string | number;
    color: string;
    sku?: string;
  };
  quantity: number;
  price: number; // Final unit price after discount
  originalPrice: number; // Original selling price
  discount: number; // Discount per unit
  minSellingPrice?: number; // Minimum allowed price per unit
  total: number;
  returnedQuantity?: number;
  branchId?: string;
  warehouseId?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number; // Overall invoice discount
  total: number;
  paymentMethod: 'cash' | 'visa' | 'debt' | 'vodafone' | 'instapay';
  customerId?: string;
  branchId: string;
  cashierId: string;
  shiftId: string;
  createdAt: string;
  status: 'COMPLETED' | 'RETURNED' | 'PARTIALLY_RETURNED' | 'PENDING' | 'CANCELLED';
  notes?: string;
}

export interface Shift {
  id: string;
  branchId: string;
  cashierId: string;
  openingCash: number;
  closingCash: number;
  actualCash: number; // Cash counted by user
  totalSalesCash: number;
  totalSalesCard: number;
  expenses: number;
  status: 'OPEN' | 'CLOSED';
  startDate: string;
  endDate?: string;
  notes?: string;
  cashierName?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  points: number;
  balance: number;
  balanceType?: 'credit' | 'debit';
  address?: string;
  createdAt: string;
  branchId?: string;
  creditLimit?: number;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location?: string;
  manager?: string;
  isActive: boolean;
  type?: string;
  status?: string;
}

export type TransactionType = 'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT';
export type TransactionStatus = 'DRAFT' | 'PENDING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';

export interface InventoryTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    cost?: number;
    sku?: string;
    variant?: {
      size: string | number;
      color: string;
    };
  }[];
  reference?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface StockLevel {
  productId: string;
  warehouseId: string;
  quantity: number;
  lastUpdated: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Brand {
  id: string;
  name: string;
  description?: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  nature: 'DEBIT' | 'CREDIT';
  parentAccountId?: string | null;
  openingBalance: number;
  balance: number;
  currency: string;
  branchId?: string;
  costCenterId?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  type: 'MAIN' | 'SUB'; // MAIN for grouping, SUB for actual tracking
  branchId?: string | null;
  budget: number;
  expenses: number;
  revenues: number;
  isActive: boolean;
  parentCostCenterId?: string | null;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  status: 'DRAFT' | 'POSTED';
  lines: {
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
    costCenterId?: string;
    memo?: string;
  }[];
  createdAt: string;
  createdBy: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'INVOICE' | 'RETURN' | 'TRANSFER' | 'SYSTEM';
  isRead: boolean;
  createdAt: any;
  userId?: string;
  metadata?: any;
}

export interface StockTakingItem {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  bookQty: number;
  actualQty: number;
  diffQty: number;
  unitCost: number;
  diffValue: number;
  notes: string;
}

export interface StockTakingDoc {
  id: string;
  warehouseId: string;
  warehouseName: string;
  status: 'DRAFT' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  items: StockTakingItem[];
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  history?: {
    status: string;
    updatedAt: string;
    updatedBy: string;
    updatedByName: string;
    notes?: string;
  }[];
}

export interface OpeningBalanceItem {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  location?: string;
  notes?: string;
}

export interface OpeningBalanceCustomer {
  customerId: string;
  customerName: string;
  customerPhone: string;
  debit: number;
  credit: number;
  notes?: string;
}

export interface OpeningBalanceSupplier {
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  debit: number;
  credit: number;
  notes?: string;
}

export interface OpeningBalanceAccount {
  accountId: string;
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
  notes?: string;
}

export interface OpeningBalanceDoc {
  id: string;
  docNumber: string;
  date: string;
  branchId?: string;
  branchName?: string;
  warehouseId?: string; // only for ITEMS type
  warehouseName?: string; // only for ITEMS type
  type: 'ITEMS' | 'CUSTOMERS' | 'SUPPLIERS' | 'ACCOUNTS';
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  totalAmount: number;
  items?: OpeningBalanceItem[];
  customers?: OpeningBalanceCustomer[];
  suppliers?: OpeningBalanceSupplier[];
  accounts?: OpeningBalanceAccount[];
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
}

export interface TransferReceiptItem {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  unit: string;
  transferredQty: number;
  receivedQty: number;
  difference: number;
  itemStatus: 'MATCH' | 'DEFICIT' | 'SURPLUS';
  notes?: string;
}

export interface TransferReceiptDoc {
  id: string;
  receiptNumber: string;
  date: string;
  transferId: string;
  transferNumber: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  receiverName: string;
  status: 'DRAFT' | 'REVIEW' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'REJECTED' | 'CANCELLED';
  notes?: string;
  items: TransferReceiptItem[];
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
}

export interface POSDevice {
  id: string;
  name: string;
  deviceNumber?: string;
  branchId: string;
  warehouseId?: string;
  linkedUserId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'CONNECTED' | 'OFFLINE';
  lastLogin?: string;
  createdAt: string;
  lastSeen?: string;
  platform?: string;
  arch?: string;
  linkedUserName?: string;
  linkedUserRole?: string;
  version?: string;
}

export interface PrintTemplate {
  id: string;
  name: string;
  logoUrl?: string;
  companyName: string;
  taxNumber?: string;
  qrCodeEnabled: boolean;
  barcodeEnabled: boolean;
  paperSize: '58mm' | '80mm' | 'A4';
  headerMessage?: string;
  footerMessage?: string;
  linkedBranchIds: string[];
  createdAt: string;
}

export interface SecurityLog {
  id: string;
  userId: string;
  userName: string;
  action: 'DRAWER_OPENED' | 'DISCOUNT_APPLIED' | 'INVOICE_CANCELLED' | 'SHIFT_FORCE_CLOSED';
  details: string;
  timestamp: string;
  metadata?: any;
}

