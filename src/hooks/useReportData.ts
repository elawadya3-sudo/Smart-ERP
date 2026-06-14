import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, Shift, Warehouse, Product } from '../types';

export interface ReportData {
  orders: Order[];
  shifts: Shift[];
  warehouses: Warehouse[];
  products: Product[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export interface SalesStats {
  totalSales: number;
  totalProfit: number;
  totalItems: number;
  ordersCount: number;
  margin: string;
  cashSales: number;
  cardSales: number;
  returnedCount: number;
  branchStats: BranchStat[];
  topProducts: ProductStat[];
}

export interface BranchStat {
  id: string;
  name: string;
  sales: number;
  profit: number;
  ordersCount: number;
  itemsCount: number;
}

export interface ProductStat {
  id: string;
  name: string;
  quantity: number;
  sales: number;
  profit: number;
}

export function useReportData(): ReportData {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ordersSnap, shiftsSnap, warehousesSnap, productsSnap] = await Promise.all([
          getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'shifts'), orderBy('startDate', 'desc'))),
          getDocs(collection(db, 'warehouses')),
          getDocs(collection(db, 'products')),
        ]);

        setOrders(ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
        setShifts(shiftsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Shift)));
        setWarehouses(warehousesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Warehouse)));
        setProducts(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      } catch (err: any) {
        console.error('useReportData error:', err);
        setError(err?.message || 'حدث خطأ أثناء جلب بيانات التقارير');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [tick]);

  return { orders, shifts, warehouses, products, loading, error, refresh };
}

/**
 * Helper – compute sales / profit statistics for a filtered set of orders
 */
export function computeSalesStats(
  orders: Order[],
  products: Product[],
  warehouses: Warehouse[]
): SalesStats {
  const branchMap: Record<string, BranchStat> = {};
  warehouses.forEach((w) => {
    branchMap[w.id] = { id: w.id, name: w.name, sales: 0, profit: 0, ordersCount: 0, itemsCount: 0 };
  });

  const productMap: Record<string, ProductStat> = {};

  let totalSales = 0;
  let totalProfit = 0;
  let totalItems = 0;
  let cashSales = 0;
  let cardSales = 0;
  let returnedCount = 0;

  for (const order of orders) {
    if (order.customerId === 'EXPENSE') continue;
    if (order.status === 'RETURNED') { returnedCount++; continue; }
    if (order.status === 'CANCELLED' || order.status === 'PENDING') continue;

    const orderTotal = order.total ?? 0;
    totalSales += orderTotal;
    if (order.paymentMethod === 'cash') cashSales += orderTotal;
    else cardSales += orderTotal;

    if (branchMap[order.branchId]) {
      branchMap[order.branchId].ordersCount++;
      branchMap[order.branchId].sales += orderTotal;
    }

    for (const item of order.items) {
      const product = products.find((p) => p.id === item.productId);
      const cost = Number(product?.costPrice ?? 0);
      const itemProfit = (item.total ?? 0) - (item.quantity ?? 0) * cost;

      totalProfit += itemProfit;
      totalItems += item.quantity ?? 0;

      if (branchMap[order.branchId]) {
        branchMap[order.branchId].profit += itemProfit;
        branchMap[order.branchId].itemsCount += item.quantity ?? 0;
      }

      if (!productMap[item.productId]) {
        productMap[item.productId] = { id: item.productId, name: item.name, quantity: 0, sales: 0, profit: 0 };
      }
      productMap[item.productId].quantity += item.quantity ?? 0;
      productMap[item.productId].sales += item.total ?? 0;
      productMap[item.productId].profit += itemProfit;
    }
  }

  const margin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : '0';
  const branchStats = Object.values(branchMap).sort((a, b) => b.sales - a.sales);
  const topProducts = Object.values(productMap).sort((a, b) => b.quantity - a.quantity).slice(0, 20);

  return {
    totalSales,
    totalProfit,
    totalItems,
    ordersCount: orders.filter((o) => o.status === 'COMPLETED' || !o.status).length,
    margin,
    cashSales,
    cardSales,
    returnedCount,
    branchStats,
    topProducts,
  };
}

/**
 * Helper – filter orders by date range and/or branch
 */
export function filterOrders(
  orders: Order[],
  opts: {
    dateFrom?: string;
    dateTo?: string;
    branchId?: string;
    search?: string;
    statuses?: Order['status'][];
  }
): Order[] {
  return orders.filter((order) => {
    if (order.customerId === 'EXPENSE') return false;

    const raw = order.createdAt;
    const dateObj = raw && typeof (raw as any).toDate === 'function' ? (raw as any).toDate() : new Date(raw);
    const localDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

    if (opts.dateFrom && localDate < opts.dateFrom) return false;
    if (opts.dateTo && localDate > opts.dateTo) return false;
    if (opts.branchId && opts.branchId !== 'ALL' && String(order.branchId) !== String(opts.branchId)) return false;
    if (opts.statuses && !opts.statuses.includes(order.status)) return false;
    if (opts.search) {
      const s = opts.search.toLowerCase();
      const match =
        order.id.toLowerCase().includes(s) ||
        order.items.some((i) => i.name.toLowerCase().includes(s));
      if (!match) return false;
    }

    return true;
  });
}
