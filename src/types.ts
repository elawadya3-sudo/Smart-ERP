export type UserRole = 'ADMIN' | 'CASHIER';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  branchId?: string; // Assigned branch for cashiers
  isActive?: boolean; // Whether the user can login
  createdAt: string;
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
  status?: 'COMPLETED' | 'RETURNED';
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
  parentAccountId?: string;
  balance: number;
  currency: string;
  isActive: boolean;
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

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}
