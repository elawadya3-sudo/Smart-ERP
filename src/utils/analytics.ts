import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  isWithinInterval,
  format,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachHourOfInterval,
  subDays,
  subMonths,
  subYears,
  isSameDay,
  isSameHour,
  isSameMonth
} from 'date-fns';
import { Order, Product } from '../types';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ChartDataPoint {
  name: string;
  sales: number;
}

export const aggregateSalesData = (orders: Order[], period: AnalyticsPeriod): ChartDataPoint[] => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let interval: Date[];
  let formatStr: string;
  let sameFn: (d1: Date, d2: Date) => boolean;

  switch (period) {
    case 'daily':
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      interval = eachHourOfInterval({ start: startDate, end: endDate });
      formatStr = 'HH:00';
      sameFn = isSameHour;
      break;
    case 'weekly':
      startDate = startOfWeek(subDays(now, 6), { weekStartsOn: 0 }); // Last 7 days
      endDate = endOfDay(now);
      interval = eachDayOfInterval({ start: subDays(now, 6), end: endDate });
      formatStr = 'eeee'; // Day name
      sameFn = isSameDay;
      break;
    case 'monthly':
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      interval = eachDayOfInterval({ start: startDate, end: endDate });
      formatStr = 'd'; // Day number
      sameFn = isSameDay;
      break;
    case 'yearly':
      startDate = startOfYear(now);
      endDate = endOfYear(now);
      interval = eachMonthOfInterval({ start: startDate, end: endDate });
      formatStr = 'MMM'; // Month name
      sameFn = isSameMonth;
      break;
    default:
      return [];
  }

  // Arabic Day names mapping for 'weekly'
  const arabicDays: Record<string, string> = {
    'Sunday': 'الأحد',
    'Monday': 'الاثنين',
    'Tuesday': 'الثلاثاء',
    'Wednesday': 'الأربعاء',
    'Thursday': 'الخميس',
    'Friday': 'الجمعة',
    'Saturday': 'السبت'
  };

  return interval.map(date => {
    let name = format(date, formatStr);
    
    // Localize day names if period is weekly
    if (period === 'weekly') {
      const dayName = format(date, 'eeee');
      name = arabicDays[dayName] || name;
    }

    const totalSales = orders.reduce((sum, order) => {
      // Include only completed orders and exclude returned/expense
      if ((order.status && order.status !== 'COMPLETED') || order.customerId === 'EXPENSE') return sum;
      const orderDate = new Date(
        order.createdAt && typeof (order.createdAt as any).toDate === 'function' 
          ? (order.createdAt as any).toDate() 
          : order.createdAt
      );

      if (isWithinInterval(orderDate, { start: startDate, end: endDate }) && sameFn(orderDate, date)) {
        return sum + (order.total || 0);
      }
      return sum;
    }, 0);

    return {
      name,
      sales: totalSales
    };
  });
};

export const calculateDashboardStats = (orders: Order[], products: Product[]) => {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = startOfDay(subDays(now, 1));

  // Filter out returned orders and expenses
  const activeOrders = orders.filter(o => (o.status === 'COMPLETED' || !o.status) && o.customerId !== 'EXPENSE');

  const todayOrders = activeOrders.filter(o => {
    const d = new Date(o.createdAt && typeof (o.createdAt as any).toDate === 'function' ? (o.createdAt as any).toDate() : o.createdAt);
    return isSameDay(d, today);
  });

  const yesterdayOrders = activeOrders.filter(o => {
    const d = new Date(o.createdAt && typeof (o.createdAt as any).toDate === 'function' ? (o.createdAt as any).toDate() : o.createdAt);
    return isSameDay(d, yesterday);
  });

  const calculateProfit = (orderList: Order[]) => {
    return orderList.reduce((acc, inv) => {
      const invoiceProfit = (inv.items || []).reduce((pAcc, item) => {
        const product = products.find(p => p.id === item.productId);
        const cost = product?.costPrice || 0;
        return pAcc + (item.total - (item.quantity * cost));
      }, 0);
      return acc + invoiceProfit;
    }, 0);
  };

  const todaySales = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const yesterdaySales = yesterdayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  
  const todayProfit = calculateProfit(todayOrders);
  const yesterdayProfit = calculateProfit(yesterdayOrders);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const salesChange = calculateChange(todaySales, yesterdaySales);
  const profitChange = calculateChange(todayProfit, yesterdayProfit);
  const ordersChange = calculateChange(todayOrders.length, yesterdayOrders.length);

  return {
    todaySales,
    salesChange: salesChange.toFixed(1),
    todayOrdersCount: todayOrders.length,
    ordersChange: ordersChange.toFixed(1),
    todayProfit,
    profitChange: profitChange.toFixed(1)
  };
};

export const getTopSellingProducts = (orders: Order[]) => {
  const productStats: Record<string, { name: string, sales: number, revenue: number }> = {};

  orders.forEach(order => {
    if ((order.status && order.status !== 'COMPLETED') || order.customerId === 'EXPENSE') return;
    
    order.items.forEach(item => {
      if (!productStats[item.productId]) {
        productStats[item.productId] = { name: item.name, sales: 0, revenue: 0 };
      }
      productStats[item.productId].sales += item.quantity;
      productStats[item.productId].revenue += item.total;
    });
  });

  return Object.values(productStats)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5)
    .map((p, i) => ({
      ...p,
      color: ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'][i % 5]
    }));
};
