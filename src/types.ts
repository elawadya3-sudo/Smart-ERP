export type UserRole = 'ADMIN' | 'CASHIER';

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
  inventory: boolean;
  accounting: boolean;
  customers: boolean;
  reports: boolean;
  settings: boolean;
  branchManagement: boolean;
  cashierManagement: boolean;
  systemReset: boolean;
}

export interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  branchId?: string; // Assigned branch for cashiers
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
  sizes: number[];
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
}

export interface ProductVariant {
  size: number;
  color: string;
  quantity: number;
  sku?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  variant?: {
    size: number;
    color: string;
  };
  quantity: number;
  price: number; // Final unit price after discount
  originalPrice: number; // Original selling price
  discount: number; // Discount per unit
  minSellingPrice?: number; // Minimum allowed price per unit
  total: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number; // Overall invoice discount
  total: number;
  paymentMethod: 'cash' | 'visa';
  customerId?: string;
  branchId: string;
  cashierId: string;
  shiftId: string;
  createdAt: string;
  status: 'COMPLETED' | 'RETURNED' | 'PENDING' | 'CANCELLED';
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
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location?: string;
  manager?: string;
  isActive: boolean;
}

export type TransactionType = 'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT';
export type TransactionStatus = 'DRAFT' | 'PENDING' | 'COMPLETED' | 'CANCELLED';

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
