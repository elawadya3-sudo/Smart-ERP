import { Warehouse, Product, StockLevel } from './types';

export const INITIAL_WAREHOUSES: Warehouse[] = [
  { id: '1', name: 'المخزن الرئيسي (Main Warehouse)', code: 'MAIN', isActive: true },
  { id: '2', name: 'مخزن فرع الرياض (Riyadh Branch)', code: 'BRANCH-RUH', isActive: true },
  { id: '3', name: 'مخزن فرع جدة (Jeddah Branch)', code: 'BRANCH-JED', isActive: true }
];

export const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', name: 'آيفون 15 برو', quantity: 100, costPrice: 4000, sellingPrice: 5000, brand: 'Apple', category: 'Phones', barcode: '123', sku: 'IP15P', createdAt: '', sizes: [], colors: [], images: [] },
  { id: 'p2', name: 'سامسونج S24', quantity: 50, costPrice: 3500, sellingPrice: 4500, brand: 'Samsung', category: 'Phones', barcode: '456', sku: 'S24U', createdAt: '', sizes: [], colors: [], images: [] },
  { id: 'p3', name: 'ماك بوك اير', quantity: 30, costPrice: 5000, sellingPrice: 6000, brand: 'Apple', category: 'Laptops', barcode: '789', sku: 'MBA', createdAt: '', sizes: [], colors: [], images: [] }
];

export const INITIAL_STOCK_LEVELS: StockLevel[] = [
  { productId: 'p1', warehouseId: '1', quantity: 100, lastUpdated: '2024-01-01' },
  { productId: 'p2', warehouseId: '1', quantity: 50, lastUpdated: '2024-01-01' },
  { productId: 'p3', warehouseId: '1', quantity: 30, lastUpdated: '2024-01-01' },
  { productId: 'p1', warehouseId: '2', quantity: 10, lastUpdated: '2024-01-01' },
  { productId: 'p2', warehouseId: '2', quantity: 5, lastUpdated: '2024-01-01' },
  { productId: 'p1', warehouseId: '3', quantity: 8, lastUpdated: '2024-01-01' }
];
