import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  Users, 
  ShoppingCart, 
  Package,
  ArrowRight,
  Loader2,
  Download,
  TrendingUp,
  Coins,
  Medal,
  Store,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Clock,
  Briefcase,
  FileText,
  Percent,
  TrendingDown,
  Info,
  CalendarCheck,
  AlertTriangle,
  RefreshCcw,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Sparkles,
  Bookmark,
  Plus,
  Trash2,
  Lock,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order, Warehouse, User, Product, Shift, Customer } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import PageToolbar from '../../components/ui/PageToolbar';
import PosNavbar from '../../components/layout/PosNavbar';
import { useBranchFilter } from '../../hooks/useBranchFilter';
import { useAuth } from '../../context/AuthContext';
import { FilterTemplateManager } from '../../utils/FilterTemplateManager';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

// ─── SPARKLINE CHART COMPONENT ───────────────────────────────────────────
function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  return (
    <div className="w-16 h-8 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={`${color}15`} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function POSReports() {
  const { user } = useAuth();
  const restrictedBranchId = useBranchFilter();
  const navigate = useNavigate();

  // ─── FIRESTORE COLLECTIONS STATE ──────────────────────────────────────────
  const [orders, setOrders] = useState<Order[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── DYNAMIC FILTERS STATE ────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(() => {
    const past = new Date();
    past.setDate(past.getDate() - 30);
    return past.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [filterBranch, setFilterBranch] = useState(() => restrictedBranchId || 'ALL');
  const [filterWarehouse, setFilterWarehouse] = useState('ALL');
  const [filterPOS, setFilterPOS] = useState('ALL');
  const [filterShift, setFilterShift] = useState('ALL');
  const [filterCashier, setFilterCashier] = useState('ALL');
  const [filterCustomer, setFilterCustomer] = useState('ALL');
  const [filterProduct, setFilterProduct] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // ─── FILTER TEMPLATE STATE ────────────────────────────────────────────────
  const [templates, setTemplates] = useState<{ name: string; filters: any }[]>(() => {
    return FilterTemplateManager.getTemplates();
  });
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);

  // ─── TABLE CONTROLS STATE ─────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    id: true,
    createdAt: true,
    cashierName: true,
    type: true,
    paymentMethod: true,
    amount: true,
    category: true,
    qtySold: true,
    sales: true,
    cost: true,
    profit: true,
    margin: true,
    status: true
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [groupBy, setGroupBy] = useState<'NONE' | 'category' | 'paymentMethod' | 'branchId'>('NONE');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // ─── TAB MANAGEMENT ───────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'sales' | 'profits'>('sales');
  const [salesSubTab, setSalesSubTab] = useState<'categories' | 'products' | 'shifts' | 'transactions'>('categories');
  const [profitsSubTab, setProfitsSubTab] = useState<'shifts_profit' | 'categories_profit' | 'products_profit'>('shifts_profit');

  // ─── DRILL DOWN STATE ─────────────────────────────────────────────────────
  const [drillDownType, setDrillDownType] = useState<'sales' | 'net_sales' | 'profit' | 'invoices' | 'avg_invoice' | 'returns' | 'items_sold' | 'customers' | null>(null);

  // ─── EXPORT & PREVIEW STATE ────────────────────────────────────────────────
  const [isPrintPreview, setIsPrintPreview] = useState(false);

  // ─── CHART THEME COLORS ────────────────────────────────────────────────────
  const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#f43f5e'];

  // ─── PERMISSIONS CHECK ────────────────────────────────────────────────────
  const hasPermission = (perm: 'view_reports' | 'view_profits' | 'print' | 'export' | 'view_cost' | 'view_margins') => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;

    const permissions = (user.permissions || {}) as any;

    if (perm === 'view_reports') return !!permissions.reports;
    if (perm === 'view_profits') {
      return permissions.reports_profits !== undefined 
        ? !!permissions.reports_profits 
        : (user.role === 'ACCOUNTANT' || user.role === 'BRANCH_MANAGER');
    }
    if (perm === 'print') return !!permissions.reports;
    if (perm === 'export') return !!permissions.reports;
    if (perm === 'view_cost') {
      return permissions.reports_cost !== undefined 
        ? !!permissions.reports_cost 
        : (user.role === 'ACCOUNTANT' || user.role === 'BRANCH_MANAGER');
    }
    if (perm === 'view_margins') {
      return permissions.reports_margins !== undefined 
        ? !!permissions.reports_margins 
        : (user.role === 'ACCOUNTANT' || user.role === 'BRANCH_MANAGER');
    }
    return false;
  };

  // ─── DATABASE SYNC EFFECT ────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    const unsubShifts = onSnapshot(query(collection(db, 'shifts'), orderBy('startDate', 'desc')), (snap) => {
      setShifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift)));
    });

    const unsubWarehouses = onSnapshot(collection(db, 'warehouses'), (snap) => {
      setWarehouses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as User)));
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setLoading(false);
    });

    return () => {
      unsubOrders();
      unsubShifts();
      unsubWarehouses();
      unsubProducts();
      unsubUsers();
      unsubCustomers();
    };
  }, []);

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRowIds([]);
  }, [startDate, endDate, filterBranch, filterWarehouse, filterPOS, filterShift, filterCashier, filterCustomer, filterProduct, filterCategory, filterPaymentMethod, filterStatus, searchTerm]);

  // ─── HELPERS & LOOKUPS ────────────────────────────────────────────────────
  const getBranchName = (id: string) => {
    if (!id || id === '1') return 'المستودع الرئيسي';
    return warehouses.find(w => w.id === id)?.name || `فرع (${id})`;
  };

  const productCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach(p => {
      map[p.id] = p.category || 'غير مصنف';
    });
    return map;
  }, [products]);

  const productCostMap = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      map[p.id] = Number(p.costPrice || 0);
    });
    return map;
  }, [products]);

  // ─── DATE RANGE COMPUTATIONS ─────────────────────────────────────────────
  const durationDays = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [startDate, endDate]);

  const previousPeriod = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - diff - 24 * 60 * 60 * 1000);
    const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    return {
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    };
  }, [startDate, endDate]);

  // ─── CORE CALCULATION ENGINE ─────────────────────────────────────────────
  const getStatsForPeriod = (start: string, end: string) => {
    const periodOrders = orders.filter(o => {
      if (!o.createdAt) return false;
      const datePart = o.createdAt.split('T')[0];
      if (datePart < start || datePart > end) return false;

      // Apply Filters
      if (filterBranch !== 'ALL' && String(o.branchId) !== String(filterBranch)) return false;
      if (filterWarehouse !== 'ALL' && String(o.branchId) !== String(filterWarehouse)) return false;
      if (filterShift !== 'ALL' && String(o.shiftId) !== String(filterShift)) return false;
      if (filterCashier !== 'ALL' && String(o.cashierId) !== String(filterCashier)) return false;
      if (filterCustomer !== 'ALL' && String(o.customerId) !== String(filterCustomer)) return false;
      if (filterPaymentMethod !== 'ALL' && o.paymentMethod !== filterPaymentMethod) return false;
      if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;

      // Product / Category Filters
      if (filterProduct !== 'ALL' && !o.items.some(item => item.productId === filterProduct)) return false;
      if (filterCategory !== 'ALL' && !o.items.some(item => productCategoryMap[item.productId] === filterCategory)) return false;

      return true;
    });

    let totalSales = 0;
    let returnsAmount = 0;
    let totalCost = 0;
    let invoicesCount = 0;
    let itemsSold = 0;
    const customerIds = new Set<string>();

    periodOrders.forEach(o => {
      if (o.status === 'CANCELLED') return;
      if (o.customerId === 'EXPENSE') return;

      totalSales += o.total || 0;
      invoicesCount += 1;
      if (o.customerId) customerIds.add(o.customerId);

      o.items.forEach(item => {
        if (filterProduct !== 'ALL' && item.productId !== filterProduct) return;
        if (filterCategory !== 'ALL' && productCategoryMap[item.productId] !== filterCategory) return;

        const qty = item.quantity || 0;
        const retQty = item.returnedQuantity || 0;
        const netQty = qty - retQty;
        const cost = productCostMap[item.productId] || 0;

        returnsAmount += retQty * (item.price || 0);
        itemsSold += netQty;
        totalCost += netQty * cost;
      });

      // Overall returned check
      if (o.status === 'RETURNED') {
        const itemsReturnedValue = o.items.reduce((s, it) => s + (it.returnedQuantity || 0) * (it.price || 0), 0);
        if (itemsReturnedValue === 0) {
          returnsAmount += o.total || 0;
        }
      }
    });

    const netSales = totalSales - returnsAmount;
    const totalProfit = netSales - totalCost;
    const avgInvoiceValue = invoicesCount > 0 ? netSales / invoicesCount : 0;

    return {
      orders: periodOrders,
      totalSales,
      returnsAmount,
      netSales,
      totalCost,
      totalProfit,
      invoicesCount,
      avgInvoiceValue,
      itemsSold,
      customersCount: customerIds.size
    };
  };

  const currentStats = useMemo(() => {
    return getStatsForPeriod(startDate, endDate);
  }, [orders, products, startDate, endDate, filterBranch, filterWarehouse, filterShift, filterCashier, filterCustomer, filterProduct, filterCategory, filterPaymentMethod, filterStatus]);

  const previousStats = useMemo(() => {
    return getStatsForPeriod(previousPeriod.start, previousPeriod.end);
  }, [orders, products, previousPeriod, filterBranch, filterWarehouse, filterShift, filterCashier, filterCustomer, filterProduct, filterCategory, filterPaymentMethod, filterStatus]);

  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // ─── FILTER TEMPLATES LOGIC ──────────────────────────────────────────────
  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) return;
    const filters = {
      startDate,
      endDate,
      filterBranch,
      filterWarehouse,
      filterPOS,
      filterShift,
      filterCashier,
      filterCustomer,
      filterProduct,
      filterCategory,
      filterPaymentMethod,
      filterStatus
    };
    const updated = FilterTemplateManager.saveTemplate(newTemplateName.trim(), filters);
    setTemplates(updated);
    setNewTemplateName('');
    setShowSaveTemplateModal(false);
  };

  const handleExcelExport = (exportSelected = false) => {
    if (!hasPermission('export')) {
      alert('ليس لديك صلاحية لتصدير التقارير.');
      return;
    }

    const list = exportSelected ? sortedDataList.filter((r: any) => selectedRowIds.includes(r.id || r.productId || r.category)) : sortedDataList;
    if (list.length === 0) {
      alert('لا توجد سجلات لتصديرها.');
      return;
    }

    const headers = [
      'الرمز / المعرف',
      'الاسم / الفئة / الموظف',
      'الكمية المباعة',
      'إجمالي المبيعات',
      'التكلفة',
      'صافي الربح',
      'الهامش %'
    ];

    const rows = list.map((item: any) => [
      item.id || item.productId || item.category || '---',
      item.name || item.category || item.cashierName || '---',
      item.qtySold || 0,
      item.totalSales || item.amount || 0,
      item.totalCost || item.cost || 0,
      item.profit || 0,
      item.margin ? `${item.margin.toFixed(1)}%` : '---'
    ]);

    let xml = `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>Nezam Pro ERP</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#3b82f6" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Data">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="ERP Report">
    <Table>
      <Row ss:Height="25">
        ${headers.map(h => `<Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>`).join('\n        ')}
      </Row>
`;

    rows.forEach(r => {
      xml += `      <Row ss:Height="20">
        <Cell ss:StyleID="Data"><Data ss:Type="String">${r[0]}</Data></Cell>
        <Cell ss:StyleID="Data"><Data ss:Type="String">${r[1]}</Data></Cell>
        <Cell ss:StyleID="Data"><Data ss:Type="Number">${r[2]}</Data></Cell>
        <Cell ss:StyleID="Data"><Data ss:Type="Number">${r[3]}</Data></Cell>
        <Cell ss:StyleID="Data"><Data ss:Type="Number">${r[4]}</Data></Cell>
        <Cell ss:StyleID="Data"><Data ss:Type="Number">${r[5]}</Data></Cell>
        <Cell ss:StyleID="Data"><Data ss:Type="String">${r[6]}</Data></Cell>
      </Row>\n`;
    });

    xml += `    </Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `تقرير_ERP_${mainTab}_${new Date().toISOString().split('T')[0]}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadTemplate = (filters: any) => {
    if (filters.startDate) setStartDate(filters.startDate);
    if (filters.endDate) setEndDate(filters.endDate);
    if (filters.filterBranch) setFilterBranch(filters.filterBranch);
    if (filters.filterWarehouse) setFilterWarehouse(filters.filterWarehouse);
    if (filters.filterPOS) setFilterPOS(filters.filterPOS);
    if (filters.filterShift) setFilterShift(filters.filterShift);
    if (filters.filterCashier) setFilterCashier(filters.filterCashier);
    if (filters.filterCustomer) setFilterCustomer(filters.filterCustomer);
    if (filters.filterProduct) setFilterProduct(filters.filterProduct);
    if (filters.filterCategory) setFilterCategory(filters.filterCategory);
    if (filters.filterPaymentMethod) setFilterPaymentMethod(filters.filterPaymentMethod);
    if (filters.filterStatus) setFilterStatus(filters.filterStatus);
  };

  // ─── CHARTS & INSIGHTS DERIVATIONS ───────────────────────────────────────
  const sparklineData = useMemo(() => {
    const datesMap: Record<string, { sales: number; profit: number; returns: number; invoices: number; items: number }> = {};
    
    // Fill all dates in range
    const curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      const datePart = curr.toISOString().split('T')[0];
      datesMap[datePart] = { sales: 0, profit: 0, returns: 0, invoices: 0, items: 0 };
      curr.setDate(curr.getDate() + 1);
    }

    currentStats.orders.forEach(o => {
      if (o.status === 'CANCELLED' || o.customerId === 'EXPENSE') return;
      const datePart = o.createdAt.split('T')[0];
      if (datesMap[datePart]) {
        datesMap[datePart].sales += o.total || 0;
        datesMap[datePart].invoices += 1;
        
        let orderCost = 0;
        let orderReturns = 0;
        o.items.forEach(item => {
          const qty = item.quantity || 0;
          const retQty = item.returnedQuantity || 0;
          const netQty = qty - retQty;
          orderCost += netQty * (productCostMap[item.productId] || 0);
          orderReturns += retQty * (item.price || 0);
          datesMap[datePart].items += netQty;
        });

        if (o.status === 'RETURNED') {
          const itemsReturnedValue = o.items.reduce((s, it) => s + (it.returnedQuantity || 0) * (it.price || 0), 0);
          if (itemsReturnedValue === 0) {
            orderReturns += o.total || 0;
          }
        }
        
        datesMap[datePart].returns += orderReturns;
        datesMap[datePart].profit += (o.total - orderReturns) - orderCost;
      }
    });

    return Object.entries(datesMap).map(([date, values]) => ({
      date: date.substring(5), // MM-DD format
      ...values
    }));
  }, [currentStats.orders, startDate, endDate, productCostMap]);

  // Hourly Sales
  const hourlySalesData = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;

    currentStats.orders.forEach(o => {
      if (o.status === 'CANCELLED' || !o.createdAt) return;
      const hour = new Date(o.createdAt).getHours();
      hours[hour] += o.total || 0;
    });

    return Object.entries(hours).map(([hour, value]) => ({
      hour: `${hour}:00`,
      sales: value
    }));
  }, [currentStats.orders]);

  // Weekday Sales
  const weekdaySalesData = useMemo(() => {
    const weekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const map: Record<number, number> = {};
    for (let i = 0; i < 7; i++) map[i] = 0;

    currentStats.orders.forEach(o => {
      if (o.status === 'CANCELLED' || !o.createdAt) return;
      const day = new Date(o.createdAt).getDay();
      map[day] += o.total || 0;
    });

    return Object.entries(map).map(([dayIdx, value]) => ({
      day: weekdays[Number(dayIdx)],
      sales: value
    }));
  }, [currentStats.orders]);

  // Pie Chart Category distribution
  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    currentStats.orders.forEach(o => {
      if (o.status === 'CANCELLED') return;
      o.items.forEach(item => {
        const cat = productCategoryMap[item.productId] || 'غير مصنف';
        const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
        map[cat] = (map[cat] || 0) + (netQty * (item.price || 0));
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [currentStats.orders, productCategoryMap]);

  // Bar Chart Top Products
  const topProductsChartData = useMemo(() => {
    const map: Record<string, { name: string; sales: number; qty: number }> = {};
    currentStats.orders.forEach(o => {
      if (o.status === 'CANCELLED') return;
      o.items.forEach(item => {
        const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
        const total = netQty * (item.price || 0);
        if (netQty <= 0) return;

        if (!map[item.productId]) {
          map[item.productId] = { name: item.name, sales: 0, qty: 0 };
        }
        map[item.productId].sales += total;
        map[item.productId].qty += netQty;
      });
    });
    return Object.values(map).sort((a, b) => b.sales - a.sales).slice(0, 10);
  }, [currentStats.orders]);

  // Slowest Products (Bottom 5)
  const slowestProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number }> = {};
    products.forEach(p => {
      map[p.id] = { name: p.name, qty: 0 };
    });

    currentStats.orders.forEach(o => {
      if (o.status === 'CANCELLED') return;
      o.items.forEach(item => {
        const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
        if (map[item.productId]) {
          map[item.productId].qty += netQty;
        }
      });
    });
    return Object.values(map).sort((a, b) => a.qty - b.qty).slice(0, 5);
  }, [currentStats.orders, products]);

  // Executive Summary Dynamic Computations
  const executiveInsights = useMemo(() => {
    const salesChange = (((currentStats.totalSales - previousStats.totalSales) / (previousStats.totalSales || 1)) * 100).toFixed(1);
    const topCat = categoryChartData[0]?.name || 'غير معروف';
    const topProd = topProductsChartData[0]?.name || 'غير معروف';
    
    // Top Cashier
    const cashierMap: Record<string, number> = {};
    currentStats.orders.forEach(o => {
      const cName = users.find(u => u.uid === o.cashierId)?.name || o.cashierId || 'كاشير';
      cashierMap[cName] = (cashierMap[cName] || 0) + (o.total || 0);
    });
    const topCashierName = Object.entries(cashierMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'غير معروف';

    // Busiest hour range
    const busiestHour = [...hourlySalesData].sort((a, b) => b.sales - a.sales)[0]?.hour || '---';

    return {
      salesChange: Number(salesChange),
      topCat,
      topProd,
      topCashierName,
      busiestHour
    };
  }, [currentStats, previousStats, categoryChartData, topProductsChartData, hourlySalesData, users]);

  // ─── SUB-TAB DATA COMPUTATION ────────────────────────────────────────────
  // Category Sales (إجمالي مبيعات التصنيفات)
  const categorySales = useMemo(() => {
    const map: Record<string, { category: string, totalSales: number, qtySold: number }> = {};
    currentStats.orders.forEach(order => {
      order.items.forEach(item => {
        const categoryName = productCategoryMap[item.productId] || 'غير مصنف';
        const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
        const netTotal = (item.price || 0) * netQty;
        if (netQty <= 0) return;
        
        if (!map[categoryName]) {
          map[categoryName] = { category: categoryName, totalSales: 0, qtySold: 0 };
        }
        map[categoryName].totalSales += netTotal;
        map[categoryName].qtySold += netQty;
      });
    });
    return Object.values(map);
  }, [currentStats.orders, productCategoryMap]);

  // Product Sales (إجمالي مبيعات المنتجات)
  const productSales = useMemo(() => {
    const map: Record<string, { productId: string, name: string, sku: string, category: string, totalSales: number, qtySold: number }> = {};
    currentStats.orders.forEach(order => {
      order.items.forEach(item => {
        const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
        const netTotal = (item.price || 0) * netQty;
        if (netQty <= 0) return;

        if (!map[item.productId]) {
          const categoryName = productCategoryMap[item.productId] || 'غير مصنف';
          map[item.productId] = {
            productId: item.productId,
            name: item.name,
            sku: item.sku || '',
            category: categoryName,
            totalSales: 0,
            qtySold: 0
          };
        }
        map[item.productId].totalSales += netTotal;
        map[item.productId].qtySold += netQty;
      });
    });
    return Object.values(map);
  }, [currentStats.orders, productCategoryMap]);

  // Shift Sales (مبيعات الورديات)
  const shiftSalesData = useMemo(() => {
    const matchingShiftIds = new Set(currentStats.orders.map(o => o.shiftId));
    const list = shifts.filter(s => matchingShiftIds.has(s.id));
    
    return list.map(shift => {
      const shiftInvoices = orders.filter(o => o.shiftId === shift.id && o.status !== 'CANCELLED');
      const salesInvoices = shiftInvoices.filter(o => o.customerId !== 'EXPENSE');
      const expenseInvoices = shiftInvoices.filter(o => o.customerId === 'EXPENSE');
      
      const cashSales = salesInvoices
        .filter(o => o.paymentMethod === 'cash')
        .reduce((sum, o) => sum + (o.total || 0), 0);
        
      const cardSales = salesInvoices
        .filter(o => o.paymentMethod !== 'cash' && o.paymentMethod !== 'debt')
        .reduce((sum, o) => sum + (o.total || 0), 0);
        
      const expenses = expenseInvoices.reduce((sum, o) => sum + (o.total || 0), 0);
      const totalSales = cashSales + cardSales;
      const expectedCash = Number(shift.openingCash || 0) + cashSales - expenses;
      const difference = shift.status === 'CLOSED' ? (shift.actualCash - expectedCash) : 0;
      
      return {
        ...shift,
        cashSales,
        cardSales,
        totalSales,
        expenses,
        expectedCash,
        difference
      };
    });
  }, [currentStats.orders, shifts, orders]);

  // Detailed Transactions
  const detailedTransactions = useMemo(() => {
    return currentStats.orders.map(order => {
      let typeLabel = 'مبيعات';
      let typeColor = 'bg-blue-50 text-blue-700 border-blue-100/50 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      
      if (order.customerId === 'EXPENSE') {
        typeLabel = 'مصروف';
        typeColor = 'bg-amber-50 text-amber-700 border-amber-100/50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
      } else if (order.status === 'RETURNED') {
        typeLabel = 'مرتجع كلي';
        typeColor = 'bg-red-50 text-red-700 border-red-100/50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      } else if (order.status === 'PARTIALLY_RETURNED') {
        typeLabel = 'مرتجع جزئي';
        typeColor = 'bg-rose-50 text-rose-700 border-rose-100/50 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800';
      }

      const cashierName = users.find(u => u.uid === order.cashierId)?.name || order.cashierId || 'كاشير';

      return {
        id: order.id,
        createdAt: order.createdAt,
        shiftId: order.shiftId,
        cashierName,
        type: typeLabel,
        typeColor,
        amount: order.total,
        paymentMethod: order.paymentMethod,
        items: order.items || [],
        status: order.status,
        branchId: order.branchId
      };
    });
  }, [currentStats.orders, users]);

  // ─── PROFITABILITY TAB COMPUTATIONS ──────────────────────────────────────
  // Shift Profit
  const shiftProfitability = useMemo(() => {
    return shiftSalesData.map(shift => {
      const shiftInvoices = orders.filter(o => o.shiftId === shift.id && o.status !== 'CANCELLED' && o.customerId !== 'EXPENSE');
      let totalSales = 0;
      let totalCost = 0;

      shiftInvoices.forEach(order => {
        order.items.forEach(item => {
          const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
          totalSales += netQty * (item.price || 0);
          totalCost += netQty * (productCostMap[item.productId] || 0);
        });
      });

      const profit = totalSales - totalCost;
      const margin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

      return {
        id: shift.id,
        shiftId: shift.id,
        cashierName: shift.cashierName || 'غير معروف',
        totalSales,
        totalCost,
        profit,
        margin
      };
    });
  }, [shiftSalesData, orders, productCostMap]);

  // Category Profit
  const categoryProfitability = useMemo(() => {
    return categorySales.map(c => {
      let cost = 0;
      currentStats.orders.forEach(o => {
        o.items.forEach(item => {
          if (productCategoryMap[item.productId] === c.category) {
            const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
            cost += netQty * (productCostMap[item.productId] || 0);
          }
        });
      });
      const profit = c.totalSales - cost;
      const margin = c.totalSales > 0 ? (profit / c.totalSales) * 100 : 0;
      return {
        id: c.category,
        category: c.category,
        totalSales: c.totalSales,
        totalCost: cost,
        profit,
        margin
      };
    });
  }, [categorySales, currentStats.orders, productCategoryMap, productCostMap]);

  // Product Profit
  const productProfitability = useMemo(() => {
    return productSales.map(p => {
      const cost = p.qtySold * (productCostMap[p.productId] || 0);
      const profit = p.totalSales - cost;
      const margin = p.totalSales > 0 ? (profit / p.totalSales) * 100 : 0;
      return {
        id: p.productId,
        productId: p.productId,
        name: p.name,
        sku: p.sku,
        category: p.category,
        totalSales: p.totalSales,
        totalCost: cost,
        profit,
        margin
      };
    });
  }, [productSales, productCostMap]);

  // Branch Profitability
  const branchProfitability = useMemo(() => {
    const map: Record<string, { branchId: string; totalSales: number; totalCost: number }> = {};
    currentStats.orders.forEach(o => {
      if (o.status === 'CANCELLED' || o.customerId === 'EXPENSE') return;
      if (!map[o.branchId]) map[o.branchId] = { branchId: o.branchId, totalSales: 0, totalCost: 0 };
      
      map[o.branchId].totalSales += o.total || 0;
      o.items.forEach(item => {
        const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
        map[o.branchId].totalCost += netQty * (productCostMap[item.productId] || 0);
      });
    });
    return Object.values(map).map(b => {
      const profit = b.totalSales - b.totalCost;
      const margin = b.totalSales > 0 ? (profit / b.totalSales) * 100 : 0;
      return {
        id: b.branchId,
        branchName: getBranchName(b.branchId),
        totalSales: b.totalSales,
        totalCost: b.totalCost,
        profit,
        margin
      };
    });
  }, [currentStats.orders, productCostMap]);

  // Profit highlights
  const profitHighlights = useMemo(() => {
    const sorted = [...productProfitability].filter(p => p.totalSales > 0).sort((a, b) => b.margin - a.margin);
    return {
      highest: sorted[0] || null,
      lowest: sorted[sorted.length - 1] || null
    };
  }, [productProfitability]);

  // ─── ACTIVE DATA SELECTOR ────────────────────────────────────────────────
  const activeDataList = useMemo(() => {
    if (mainTab === 'sales') {
      if (salesSubTab === 'categories') return categorySales;
      if (salesSubTab === 'products') return productSales;
      if (salesSubTab === 'shifts') return shiftSalesData;
      return detailedTransactions;
    } else {
      if (profitsSubTab === 'shifts_profit') return shiftProfitability;
      if (profitsSubTab === 'categories_profit') return categoryProfitability;
      return productProfitability;
    }
  }, [mainTab, salesSubTab, profitsSubTab, categorySales, productSales, shiftSalesData, detailedTransactions, shiftProfitability, categoryProfitability, productProfitability]);

  // Apply searching to active list
  const searchedDataList = useMemo(() => {
    return activeDataList.filter((item: any) => {
      const text = searchTerm.toLowerCase();
      if (!text) return true;
      
      const searchFields = [
        item.category,
        item.name,
        item.sku,
        item.cashierName,
        item.id,
        item.type,
        item.paymentMethod
      ];
      return searchFields.some(f => f && String(f).toLowerCase().includes(text));
    });
  }, [activeDataList, searchTerm]);

  // Grouping logic
  const groupedDataList = useMemo(() => {
    if (groupBy === 'NONE') return { isGrouped: false, data: searchedDataList };

    const groups: Record<string, any[]> = {};
    searchedDataList.forEach((item: any) => {
      const key = String(item[groupBy] || 'غير محدد');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return {
      isGrouped: true,
      groups: Object.entries(groups).map(([groupKey, rows]) => {
        const totalSales = rows.reduce((sum, r) => sum + (r.totalSales || r.amount || 0), 0);
        const totalCost = rows.reduce((sum, r) => sum + (r.totalCost || r.cost || 0), 0);
        const qtySold = rows.reduce((sum, r) => sum + (r.qtySold || 0), 0);
        
        return {
          groupKey,
          displayKey: groupBy === 'branchId' ? getBranchName(groupKey) : groupKey,
          rows,
          totals: {
            totalSales,
            totalCost,
            totalProfit: totalSales - totalCost,
            qtySold
          }
        };
      })
    };
  }, [searchedDataList, groupBy]);

  // Apply Sorting
  const sortedDataList = useMemo(() => {
    if (!sortColumn) return searchedDataList;
    
    return [...searchedDataList].sort((a: any, b: any) => {
      const valA = a[sortColumn] ?? '';
      const valB = b[sortColumn] ?? '';
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return sortDirection === 'asc' 
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [searchedDataList, sortColumn, sortDirection]);

  // Paginated Data
  const paginatedDataList = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedDataList.slice(start, start + rowsPerPage);
  }, [sortedDataList, currentPage, rowsPerPage]);

  // Total sums of active columns
  const tableFooterTotals = useMemo(() => {
    let salesSum = 0;
    let costSum = 0;
    let profitSum = 0;
    let qtySum = 0;

    sortedDataList.forEach((r: any) => {
      salesSum += (r.totalSales || r.amount || 0);
      costSum += (r.totalCost || r.cost || 0);
      profitSum += (r.profit || 0);
      qtySum += (r.qtySold || 0);
    });

    const marginAvg = salesSum > 0 ? (profitSum / salesSum) * 100 : 0;

    return {
      salesSum,
      costSum,
      profitSum,
      qtySum,
      marginAvg
    };
  }, [sortedDataList]);

  // ─── DRILL DOWN SELECTION FINDER ─────────────────────────────────────────
  const drillDownOrders = useMemo(() => {
    if (!drillDownType) return [];
    const ords = currentStats.orders;
    if (drillDownType === 'returns') {
      return ords.filter(o => o.status === 'RETURNED' || o.status === 'PARTIALLY_RETURNED');
    }
    return ords;
  }, [drillDownType, currentStats]);

  // ─── EXPORTS DOWLOAD LOGICS ──────────────────────────────────────────────
  const handleExportCSV = (exportSelected = false) => {
    if (!hasPermission('export')) {
      alert('ليس لديك صلاحية لتصدير التقارير.');
      return;
    }

    const list = exportSelected ? sortedDataList.filter((r: any) => selectedRowIds.includes(r.id)) : sortedDataList;
    if (list.length === 0) {
      alert('لا توجد صفوف محددة للتصدير.');
      return;
    }

    const headers = [
      'الرمز / المعرف',
      'الاسم / الفئة / الكاشير',
      'إجمالي المبيعات',
      'التكلفة',
      'صافي الربح',
      'الهامش %'
    ];

    const rows = list.map((item: any) => [
      item.id || item.productId || '---',
      item.name || item.category || item.cashierName || '---',
      item.totalSales || item.amount || 0,
      item.totalCost || item.cost || 0,
      item.profit || 0,
      item.margin ? `${item.margin.toFixed(1)}%` : '---'
    ]);

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headers.join(',') + '\n';
    rows.forEach(r => {
      csvContent += r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `تقرير_ERP_${mainTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [col]: !prev[col]
    }));
  };

  const handleSelectRow = (id: string) => {
    setSelectedRowIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllRows = () => {
    if (selectedRowIds.length === paginatedDataList.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(paginatedDataList.map((r: any) => r.id || r.productId || r.category));
    }
  };

  return (
    <div className={cn("space-y-5 text-right pb-16 transition-all duration-300", isPrintPreview && "print:bg-white print:p-0")} dir="rtl">
      <div className="no-print">
        <PosNavbar />
      </div>
      
      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            background-color: transparent !important;
            box-shadow: none !important;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* FLOATING PRINT PREVIEW HEADER */}
      {isPrintPreview && (
        <div className="fixed top-0 left-0 right-0 bg-slate-900 text-white py-3 px-6 flex items-center justify-between z-50 shadow-2xl no-print animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-black">وضع معاينة الطباعة الاحترافية</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-4 h-4" />
              ابدأ الطباعة الآن
            </button>
            <button
              onClick={() => setIsPrintPreview(false)}
              className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            >
              إلغاء المعاينة
            </button>
          </div>
        </div>
      )}

      {/* HEADER PAGE */}
      <div className={cn("no-print", isPrintPreview && "hidden")}>
        <PageToolbar 
          title="تقارير مركز الإدارة والتحليل المالي (ERP Reports)"
          subtitle={filterBranch === 'ALL' ? 'التحليلات الموحدة لجميع المستودعات ونقاط البيع' : `المستودع: ${getBranchName(filterBranch)}`}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="البحث الذكي في السجلات..."
          onRefresh={() => window.location.reload()}
          onPrint={() => setIsPrintPreview(true)}
        />
      </div>

      <div id="print-area" className={cn("space-y-5", isPrintPreview && "pt-6 px-4")}>
        
        {/* EXECUTIVE SUMMARY INSIGHTS BANNER */}
        <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-950 text-white rounded-[2rem] p-6 border border-slate-800/80 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest">
                <Sparkles className="w-4 h-4 text-amber-400" />
                ملخص تنفيذي ذكي للنشاط الحالي (Executive Summary)
              </div>
              <h2 className="text-xl font-black text-slate-100 leading-tight">الرؤى والتحليلات الآلية للنظام</h2>
              
              {/* Insight sentences block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 pt-3.5 border-t border-slate-800/50">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>
                    {executiveInsights.salesChange >= 0 ? '📈 ' : '📉 '}
                    {executiveInsights.salesChange >= 0 
                      ? `ارتفعت المبيعات بنسبة ${executiveInsights.salesChange.toFixed(1)}% مقارنة بالفترة السابقة.`
                      : `انخفضت المبيعات بنسبة ${Math.abs(executiveInsights.salesChange).toFixed(1)}% مقارنة بالفترة السابقة.`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>👜 أكثر التصنيفات مبيعاً للفترة هو <strong className="text-white">"{executiveInsights.topCat}"</strong>.</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>🥇 المنتج الأعلى مبيعاً هو <strong className="text-white">"{executiveInsights.topProd}"</strong>.</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  <span>👤 الموظف الأعلى إنتاجية مبيعات هو <strong className="text-white">"{executiveInsights.topCashierName}"</strong>.</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 col-span-1 md:col-span-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>⚡ ساعات الذروة والأكثر نشاطاً في المبيعات هي حوالي الساعة <strong className="text-white">"{executiveInsights.busiestHour}"</strong>.</span>
                </div>
              </div>
            </div>

            {/* TEMPLATE SAVE / LOAD CONTROLS */}
            <div className="no-print bg-slate-800/40 border border-slate-700/60 p-4 rounded-2xl flex flex-col gap-3 min-w-[240px] w-full md:w-auto">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">قوالب فلاتر البحث المخصصة</span>
              {templates.length > 0 && (
                <div className="relative">
                  <select
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      if (!isNaN(idx)) handleLoadTemplate(templates[idx].filters);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none"
                  >
                    <option value="">-- اختر قالب محفوظ لتطبيقه --</option>
                    {templates.map((t, idx) => (
                      <option key={idx} value={idx}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSaveTemplateModal(true)}
                  className="flex-1 bg-blue-600/85 hover:bg-blue-600 text-white rounded-xl py-2 px-3 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  حفظ الفلاتر كقالب
                </button>
                {templates.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('هل تريد مسح جميع القوالب المحفوظة؟')) {
                        setTemplates([]);
                        localStorage.removeItem('erp_reports_templates');
                      }
                    }}
                    className="bg-slate-900 text-red-400 hover:text-red-500 rounded-xl p-2 text-xs font-bold border border-slate-700"
                    title="حذف القوالب"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TEMPLATE SAVE MODAL */}
        <AnimatePresence>
          {showSaveTemplateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 text-right"
              >
                <div>
                  <h3 className="font-black text-slate-900 text-md">حفظ قالب فلاتر التقارير</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">أدخل اسماً لحفظ توليفة الفلاتر النشطة حالياً ليسهل استدعاؤها لاحقاً.</p>
                </div>
                <input
                  type="text"
                  placeholder="مثال: فرع القاهرة - نقدي مبيعات"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowSaveTemplateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-500"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!newTemplateName.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 text-white disabled:opacity-50"
                  >
                    حفظ القالب
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ADVANCED MULTI-SELECT FILTER PANEL */}
        <div className="bg-white p-5 border border-slate-100 rounded-[2rem] shadow-sm space-y-4 no-print">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Filter className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm text-slate-900">أدوات الفلترة المتقدمة (ERP Analytics Filters)</h3>
            </div>
            
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setFilterBranch('ALL');
                setFilterWarehouse('ALL');
                setFilterPOS('ALL');
                setFilterShift('ALL');
                setFilterCashier('ALL');
                setFilterCustomer('ALL');
                setFilterProduct('ALL');
                setFilterCategory('ALL');
                setFilterPaymentMethod('ALL');
                setFilterStatus('ALL');
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold"
            >
              تصفير كافة الفلاتر
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {/* Start Date */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">من تاريخ</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              />
            </div>

            {/* Branch */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">الفرع / المتجر</label>
              <select
                value={filterBranch}
                disabled={!!restrictedBranchId}
                onChange={e => setFilterBranch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="ALL">جميع الفروع</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Warehouse */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">المستودع</label>
              <select
                value={filterWarehouse}
                onChange={e => setFilterWarehouse(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="ALL">جميع المستودعات</option>
                <option value="1">المستودع الرئيسي (Main)</option>
                {warehouses.filter(w => w.id !== '1').map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Cashier */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">الموظف / الكاشير</label>
              <select
                value={filterCashier}
                onChange={e => setFilterCashier(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="ALL">جميع الموظفين</option>
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* Customer */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">العميل</label>
              <select
                value={filterCustomer}
                onChange={e => setFilterCustomer(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="ALL">جميع العملاء</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Shift */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">الوردية</label>
              <select
                value={filterShift}
                onChange={e => setFilterShift(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="ALL">جميع الورديات</option>
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>#{s.id.slice(-8).toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">المنتج المحدد</label>
              <select
                value={filterProduct}
                onChange={e => setFilterProduct(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="ALL">جميع المنتجات</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">الفئة / التصنيف</label>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="ALL">جميع الأقسام</option>
                {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">طريقة السداد</label>
              <select
                value={filterPaymentMethod}
                onChange={e => setFilterPaymentMethod(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="ALL">الكل</option>
                <option value="cash">نقداً (كاش)</option>
                <option value="visa">شبكة (بطاقة)</option>
                <option value="debt">آجل</option>
                <option value="vodafone">فودافون كاش</option>
                <option value="instapay">انستا باي</option>
              </select>
            </div>

            {/* Invoice Status */}
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">حالة الفاتورة</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="ALL">الكل</option>
                <option value="COMPLETED">مكتملة</option>
                <option value="RETURNED">مرتجعة بالكامل</option>
                <option value="PARTIALLY_RETURNED">مرتجعة جزئياً</option>
                <option value="PENDING">معلقة</option>
              </select>
            </div>
          </div>
        </div>

        {/* MAIN ERP CORE KPI CARDS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Total Sales Card */}
          <div 
            onClick={() => setDrillDownType('sales')}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-all"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي المبيعات (ERP)</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex items-end justify-between mt-1 relative z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900">{formatCurrency(currentStats.totalSales)}</h3>
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold">
                  {currentStats.totalSales >= previousStats.totalSales ? (
                    <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse">
                      <ArrowUpRight className="w-3 h-3" />
                      +{getChangePercent(currentStats.totalSales, previousStats.totalSales).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowDownLeft className="w-3 h-3" />
                      {getChangePercent(currentStats.totalSales, previousStats.totalSales).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              
              <Sparkline data={sparklineData} dataKey="sales" color="#3b82f6" />
            </div>
          </div>

          {/* Net Sales Card */}
          <div 
            onClick={() => setDrillDownType('net_sales')}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-all"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">صافي المبيعات</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex items-end justify-between mt-1 relative z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900">{formatCurrency(currentStats.netSales)}</h3>
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold">
                  {currentStats.netSales >= previousStats.netSales ? (
                    <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      +{getChangePercent(currentStats.netSales, previousStats.netSales).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowDownLeft className="w-3 h-3" />
                      {getChangePercent(currentStats.netSales, previousStats.netSales).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              
              <Sparkline data={sparklineData} dataKey="sales" color="#6366f1" />
            </div>
          </div>

          {/* Total Profit Card */}
          <div 
            onClick={() => hasPermission('view_profits') ? setDrillDownType('profit') : alert('لا تمتلك صلاحية عرض الأرباح')}
            className="bg-slate-950 p-5 rounded-3xl shadow-lg flex flex-col gap-2.5 cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-all"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">إجمالي الأرباح</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex items-end justify-between mt-1 relative z-10">
              <div>
                {hasPermission('view_profits') ? (
                  <>
                    <h3 className="text-lg font-black text-white">{formatCurrency(currentStats.totalProfit)}</h3>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold">
                      {currentStats.totalProfit >= previousStats.totalProfit ? (
                        <span className="text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <ArrowUpRight className="w-3 h-3" />
                          +{getChangePercent(currentStats.totalProfit, previousStats.totalProfit).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-red-400 bg-red-950 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <ArrowDownLeft className="w-3 h-3" />
                          {getChangePercent(currentStats.totalProfit, previousStats.totalProfit).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1 text-slate-500 text-xs py-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>مغلق بالصلاحيات</span>
                  </div>
                )}
              </div>
              
              {hasPermission('view_profits') && <Sparkline data={sparklineData} dataKey="profit" color="#10b981" />}
            </div>
          </div>

          {/* Invoices Count Card */}
          <div 
            onClick={() => setDrillDownType('invoices')}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-all"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">عدد فواتير البيع</span>
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex items-end justify-between mt-1 relative z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900">{currentStats.invoicesCount} فاتورة</h3>
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold">
                  {currentStats.invoicesCount >= previousStats.invoicesCount ? (
                    <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      +{getChangePercent(currentStats.invoicesCount, previousStats.invoicesCount).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowDownLeft className="w-3 h-3" />
                      {getChangePercent(currentStats.invoicesCount, previousStats.invoicesCount).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              
              <Sparkline data={sparklineData} dataKey="invoices" color="#f97316" />
            </div>
          </div>

          {/* Average Invoice Value */}
          <div 
            onClick={() => setDrillDownType('avg_invoice')}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-all"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">متوسط قيمة الفاتورة</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Store className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex items-end justify-between mt-1 relative z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900">{formatCurrency(currentStats.avgInvoiceValue)}</h3>
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold">
                  {currentStats.avgInvoiceValue >= previousStats.avgInvoiceValue ? (
                    <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      +{getChangePercent(currentStats.avgInvoiceValue, previousStats.avgInvoiceValue).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowDownLeft className="w-3 h-3" />
                      {getChangePercent(currentStats.avgInvoiceValue, previousStats.avgInvoiceValue).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              
              <Sparkline data={sparklineData} dataKey="sales" color="#a855f7" />
            </div>
          </div>

          {/* Total Returns Card */}
          <div 
            onClick={() => setDrillDownType('returns')}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-all"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي المرتجعات</span>
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex items-end justify-between mt-1 relative z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900">{formatCurrency(currentStats.returnsAmount)}</h3>
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold">
                  {currentStats.returnsAmount <= previousStats.returnsAmount ? (
                    <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowDownLeft className="w-3 h-3" />
                      {getChangePercent(currentStats.returnsAmount, previousStats.returnsAmount).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      +{getChangePercent(currentStats.returnsAmount, previousStats.returnsAmount).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              
              <Sparkline data={sparklineData} dataKey="returns" color="#ef4444" />
            </div>
          </div>

          {/* Items Sold Card */}
          <div 
            onClick={() => setDrillDownType('items_sold')}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-all"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">عدد القطع المباعة</span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex items-end justify-between mt-1 relative z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900">{currentStats.itemsSold} قطعة</h3>
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold">
                  {currentStats.itemsSold >= previousStats.itemsSold ? (
                    <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      +{getChangePercent(currentStats.itemsSold, previousStats.itemsSold).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowDownLeft className="w-3 h-3" />
                      {getChangePercent(currentStats.itemsSold, previousStats.itemsSold).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              
              <Sparkline data={sparklineData} dataKey="items" color="#14b8a6" />
            </div>
          </div>

          {/* Customers Count Card */}
          <div 
            onClick={() => setDrillDownType('customers')}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-all"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">عدد العملاء المشترين</span>
              <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex items-end justify-between mt-1 relative z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900">{currentStats.customersCount} عميل</h3>
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold">
                  {currentStats.customersCount >= previousStats.customersCount ? (
                    <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      +{getChangePercent(currentStats.customersCount, previousStats.customersCount).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowDownLeft className="w-3 h-3" />
                      {getChangePercent(currentStats.customersCount, previousStats.customersCount).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              
              <Sparkline data={sparklineData} dataKey="invoices" color="#ec4899" />
            </div>
          </div>

        </div>

        {/* ─── CHARTS SECTION ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Line & Area Chart: Daily Sales & profit */}
          <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm lg:col-span-2 flex flex-col min-w-0">
            <div className="mb-4">
              <h4 className="text-sm font-black text-slate-900">مخطط المبيعات اليومية والأرباح الصافية</h4>
              <p className="text-[10px] text-slate-400 font-bold">تتبع الرسم البياني الزمني للمبيعات والربح</p>
            </div>
            
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} />
                  <YAxis stroke="#94a3b8" fontSize={9} />
                  <RechartsTooltip />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" name="إجمالي المبيعات" dataKey="sales" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
                  {hasPermission('view_profits') && (
                    <Area type="monotone" name="الأرباح الصافية" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart: Categories distribution */}
          <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm flex flex-col min-w-0">
            <div className="mb-4">
              <h4 className="text-sm font-black text-slate-900">مبيعات التصنيفات الكبرى</h4>
              <p className="text-[10px] text-slate-400 font-bold">توزيع حجم المبيعات على الأقسام المختلفة</p>
            </div>

            <div className="h-72 w-full flex items-center justify-center min-w-0 relative">
              {categoryChartData.length === 0 ? (
                <div className="text-slate-300 text-xs font-bold">لا توجد بيانات للفترة المحددة</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Bar Chart: Best 10 selling products */}
          <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm lg:col-span-2 flex flex-col min-w-0">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h4 className="text-sm font-black text-slate-900">المنتجات الـ 10 الأعلى مبيعاً</h4>
                <p className="text-[10px] text-slate-400 font-bold">ترتيب المنتجات الأكثر مبيعاً حسب المبالغ النقدية</p>
              </div>
              <Medal className="w-5 h-5 text-amber-500" />
            </div>

            <div className="h-72 w-full min-w-0">
              {topProductsChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-300 text-xs font-bold">لا توجد مبيعات منتجات</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={8} interval={0} tickFormatter={(v) => v.length > 10 ? v.substring(0, 10) + '..' : v} />
                    <YAxis stroke="#94a3b8" fontSize={9} />
                    <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar name="إجمالي الإيراد" dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      {topProductsChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Sales by Hour */}
          <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm flex flex-col min-w-0">
            <div className="mb-4">
              <h4 className="text-sm font-black text-slate-900">ساعات العمل والتحليل الزمني</h4>
              <p className="text-[10px] text-slate-400 font-bold">حجم المبيعات لكل ساعة على مدار اليوم</p>
            </div>

            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlySalesData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={8} />
                  <YAxis stroke="#94a3b8" fontSize={8} />
                  <RechartsTooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar name="المبيعات" dataKey="sales" fill="#a855f7" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* INTELLIGENT ANALYTICS BENTO SECTION */}
        <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200/50 pb-3">
            <Medal className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-sm text-slate-900">تحليلات الأداء الذكية (Bento Intelligence Insights)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <Medal className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase">المنتج البطل (أعلى مبيعاً)</p>
                <p className="font-black text-xs text-slate-900 truncate mt-0.5">{executiveInsights.topProd}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase">أعلى قسم مبيعات</p>
                <p className="font-black text-xs text-slate-900 truncate mt-0.5">{executiveInsights.topCat}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase">الموظف الأكثر كفاءة</p>
                <p className="font-black text-xs text-slate-900 truncate mt-0.5">{executiveInsights.topCashierName}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase">ساعة الذروة اليومية</p>
                <p className="font-black text-xs text-slate-900 truncate mt-0.5">{executiveInsights.busiestHour}</p>
              </div>
            </div>

          </div>

          {/* Bottom section showing slow items */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100">
            <h4 className="text-xs font-black text-red-500 flex items-center gap-1.5 mb-3">
              <AlertTriangle className="w-4 h-4" />
              الأصناف الخاملة والأقل حركة (الأكثر حاجة للترويج)
            </h4>
            <div className="flex flex-wrap gap-2.5">
              {slowestProducts.map((p, idx) => (
                <span key={idx} className="bg-red-50 text-red-700 text-xs font-black px-3.5 py-1.5 rounded-xl border border-red-100/50">
                  {p.name} ({p.qty} قطعة مباعة)
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* EXPORT & ACTION BAR */}
        <div className="bg-white border border-slate-100 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-1.5 bg-slate-100/60 p-1 rounded-xl">
            <button
              onClick={() => { setMainTab('sales'); setGroupBy('NONE'); }}
              className={cn(
                "px-5 py-2.5 rounded-lg text-xs font-black transition-all active:scale-95",
                mainTab === 'sales' ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              عرض المبيعات والحركات
            </button>
            <button
              onClick={() => { setMainTab('profits'); setGroupBy('NONE'); }}
              className={cn(
                "px-5 py-2.5 rounded-lg text-xs font-black transition-all active:scale-95",
                mainTab === 'profits' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              عرض تحليل الأرباح والربحية
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Column Visibility Control */}
            <div className="relative group">
              <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-50 transition-all flex items-center gap-1">
                إظهار الأعمدة
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <div className="absolute left-0 bottom-full mb-2 bg-white border border-slate-100 shadow-2xl rounded-2xl p-3 space-y-1.5 hidden group-hover:block z-30 min-w-[150px] text-right">
                {Object.keys(visibleColumns).map(col => (
                  <label key={col} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col]}
                      onChange={() => toggleColumn(col)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                    />
                    {col === 'id' ? 'المعرف' : 
                     col === 'createdAt' ? 'التاريخ' : 
                     col === 'cashierName' ? 'الموظف' : 
                     col === 'type' ? 'الحركة' : 
                     col === 'paymentMethod' ? 'السداد' : 
                     col === 'amount' ? 'القيمة' : 
                     col === 'category' ? 'التصنيف' : 
                     col === 'qtySold' ? 'الكمية' : 
                     col === 'sales' ? 'المبيعات' : 
                     col === 'cost' ? 'التكلفة' : 
                     col === 'profit' ? 'الربح' : 
                     col === 'margin' ? 'الهامش' : 'الحالة'}
                  </label>
                ))}
              </div>
            </div>

            {/* Grouping Selection */}
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold outline-none cursor-pointer"
            >
              <option value="NONE">بدون تجميع البيانات</option>
              <option value="category">تجميع حسب التصنيف</option>
              <option value="paymentMethod">تجميع حسب طريقة السداد</option>
              <option value="branchId">تجميع حسب الفرع</option>
            </select>

            <button
              onClick={() => handleExcelExport(selectedRowIds.length > 0)}
              className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-emerald-100/60 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تصدير Excel
            </button>
            <button
              onClick={() => setIsPrintPreview(true)}
              className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-[var(--color-primary)]/20 transition-all"
            >
              <Printer className="w-4 h-4" />
              طباعة / PDF
            </button>
          </div>
        </div>

        {/* SUB-TABS NAVIGATION CONTROLS */}
        <div className="no-print">
          {mainTab === 'sales' ? (
            <div className="bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/40 inline-flex flex-wrap gap-1.5">
              {[
                { id: 'categories', label: 'مبيعات التصنيفات' },
                { id: 'products', label: 'مبيعات المنتجات' },
                { id: 'shifts', label: 'مبيعات الورديات' },
                { id: 'transactions', label: 'حركات الورديات تفصيلي' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSalesSubTab(sub.id as any)}
                  className={cn(
                    'px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95',
                    salesSubTab === sub.id ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-slate-500 hover:bg-white/40'
                  )}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/40 inline-flex flex-wrap gap-1.5">
              {[
                { id: 'shifts_profit', label: 'ربحية الورديات' },
                { id: 'categories_profit', label: 'ربحية التصنيفات' },
                { id: 'products_profit', label: 'ربحية المنتجات' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setProfitsSubTab(sub.id as any)}
                  className={cn(
                    'px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95',
                    profitsSubTab === sub.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:bg-white/40'
                  )}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CORE DATA REPORT TABLE */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden min-h-[250px] relative">
          
          {/* SEARCH SUMMARY BAR */}
          <div className="p-4 border-b border-slate-50 bg-slate-50/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-slate-900">
                {mainTab === 'sales' ? 'كشف حركات ومبيعات المبيعات الموحد' : 'كشف حساب الأرباح وهوامش الربحية'}
              </h4>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded">
                إجمالي السجلات: {searchedDataList.length}
              </span>
            </div>
            
            {selectedRowIds.length > 0 && (
              <span className="text-xs text-blue-600 font-black bg-blue-50 border border-blue-100 px-3 py-1 rounded-xl">
                تم تحديد {selectedRowIds.length} صف للتصدير
              </span>
            )}
          </div>

          {/* TABLE MARKUP */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 select-none sticky top-0 z-20">
                  <th className="px-5 py-3.5 w-10 no-print">
                    <input
                      type="checkbox"
                      checked={selectedRowIds.length === paginatedDataList.length && paginatedDataList.length > 0}
                      onChange={handleSelectAllRows}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                    />
                  </th>
                  {visibleColumns.id && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400">الرمز المعرف</th>
                  )}
                  {visibleColumns.createdAt && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400">التاريخ</th>
                  )}
                  {visibleColumns.cashierName && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400">الموظف / الاسم</th>
                  )}
                  {visibleColumns.category && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400">التصنيف</th>
                  )}
                  {visibleColumns.type && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400 text-center">نوع المعاملة</th>
                  )}
                  {visibleColumns.paymentMethod && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400 text-center">طريقة السداد</th>
                  )}
                  {visibleColumns.qtySold && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400 text-center">الكمية المباعة</th>
                  )}
                  {visibleColumns.amount && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400 text-left">القيمة / المبيعات</th>
                  )}
                  {visibleColumns.cost && hasPermission('view_cost') && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400 text-left">التكلفة</th>
                  )}
                  {visibleColumns.profit && hasPermission('view_profits') && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400 text-left">صافي الربح</th>
                  )}
                  {visibleColumns.margin && hasPermission('view_margins') && (
                    <th className="px-5 py-3.5 text-xs font-black text-slate-400 text-left">الهامش %</th>
                  )}
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                {groupedDataList.isGrouped ? (
                  // Grouped rendering
                  groupedDataList.groups?.map((group: any) => {
                    const isCollapsed = collapsedGroups[group.groupKey];
                    return (
                      <React.Fragment key={group.groupKey}>
                        {/* Group Header Row */}
                        <tr className="bg-slate-100/50 font-black text-slate-800">
                          <td className="px-5 py-3.5 w-10 no-print"></td>
                          <td colSpan={6} className="px-5 py-3.5 text-right font-black">
                            <button
                              onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.groupKey]: !prev[group.groupKey] }))}
                              className="flex items-center gap-1 hover:text-blue-600"
                            >
                              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                              تجميع البيانات حسب: {group.displayKey} ({group.rows.length} سجل)
                            </button>
                          </td>
                          {visibleColumns.qtySold && (
                            <td className="px-5 py-3.5 text-center font-black">{group.totals.qtySold} قطعة</td>
                          )}
                          {visibleColumns.amount && (
                            <td className="px-5 py-3.5 text-left font-black text-slate-900">{formatCurrency(group.totals.totalSales)}</td>
                          )}
                          {visibleColumns.cost && hasPermission('view_cost') && (
                            <td className="px-5 py-3.5 text-left font-black text-slate-500">{formatCurrency(group.totals.totalCost)}</td>
                          )}
                          {visibleColumns.profit && hasPermission('view_profits') && (
                            <td className="px-5 py-3.5 text-left font-black text-emerald-600">{formatCurrency(group.totals.totalProfit)}</td>
                          )}
                          {visibleColumns.margin && hasPermission('view_margins') && (
                            <td className="px-5 py-3.5 text-left font-black text-emerald-600">
                              {(group.totals.totalSales > 0 ? (group.totals.totalProfit / group.totals.totalSales) * 100 : 0).toFixed(1)}%
                            </td>
                          )}
                        </tr>

                        {/* Collapsible Rows */}
                        {!isCollapsed && group.rows.map((row: any, idx: number) => {
                          const rowId = row.id || row.productId || row.category;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3.5 w-10 no-print">
                                <input
                                  type="checkbox"
                                  checked={selectedRowIds.includes(rowId)}
                                  onChange={() => handleSelectRow(rowId)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                />
                              </td>
                              {visibleColumns.id && (
                                <td className="px-5 py-3.5 font-mono text-[10px] text-slate-400">
                                  {row.id ? `#${row.id.slice(-8).toUpperCase()}` : row.productId ? `#${row.productId.slice(0, 6)}` : '---'}
                                </td>
                              )}
                              {visibleColumns.createdAt && (
                                <td className="px-5 py-3.5 font-mono text-[10px]">
                                  {row.createdAt ? new Date(row.createdAt).toLocaleString('ar-EG', { dateStyle: 'short' }) : '---'}
                                </td>
                              )}
                              {visibleColumns.cashierName && (
                                <td className="px-5 py-3.5 font-bold text-slate-800">
                                  {row.cashierName || row.name || '---'}
                                </td>
                              )}
                              {visibleColumns.category && (
                                <td className="px-5 py-3.5 text-slate-500 font-bold">{row.category || '---'}</td>
                              )}
                              {visibleColumns.type && (
                                <td className="px-5 py-3.5 text-center">
                                  {row.type ? (
                                    <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full border", row.typeColor)}>
                                      {row.type}
                                    </span>
                                  ) : '---'}
                                </td>
                              )}
                              {visibleColumns.paymentMethod && (
                                <td className="px-5 py-3.5 text-center font-bold text-slate-500">
                                  {row.paymentMethod ? (
                                    row.paymentMethod === 'cash' ? 'نقدي' : 
                                    row.paymentMethod === 'visa' ? 'بطاقة' : 
                                    row.paymentMethod === 'debt' ? 'آجل' : 'آخر'
                                  ) : '---'}
                                </td>
                              )}
                              {visibleColumns.qtySold && (
                                <td className="px-5 py-3.5 text-center font-black">{row.qtySold || '---'}</td>
                              )}
                              {visibleColumns.amount && (
                                <td className="px-5 py-3.5 text-left font-black text-slate-900">
                                  {formatCurrency(row.totalSales || row.amount || 0)}
                                </td>
                              )}
                              {visibleColumns.cost && hasPermission('view_cost') && (
                                <td className="px-5 py-3.5 text-left font-bold text-slate-400">
                                  {formatCurrency(row.totalCost || row.cost || 0)}
                                </td>
                              )}
                              {visibleColumns.profit && hasPermission('view_profits') && (
                                <td className="px-5 py-3.5 text-left font-black text-emerald-600">
                                  {formatCurrency(row.profit || 0)}
                                </td>
                              )}
                              {visibleColumns.margin && hasPermission('view_margins') && (
                                <td className="px-5 py-3.5 text-left">
                                  {row.margin ? (
                                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black">
                                      {row.margin.toFixed(1)}%
                                    </span>
                                  ) : '---'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                ) : (
                  // Plain paginated rendering
                  paginatedDataList.map((row: any, idx: number) => {
                    const rowId = row.id || row.productId || row.category;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 w-10 no-print">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.includes(rowId)}
                            onChange={() => handleSelectRow(rowId)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                        </td>
                        {visibleColumns.id && (
                          <td className="px-5 py-3.5 font-mono text-[10px] text-slate-400">
                            {row.id ? `#${row.id.slice(-8).toUpperCase()}` : row.productId ? `#${row.productId.slice(0, 6)}` : '---'}
                          </td>
                        )}
                        {visibleColumns.createdAt && (
                          <td className="px-5 py-3.5 font-mono text-[10px]">
                            {row.createdAt ? new Date(row.createdAt).toLocaleString('ar-EG', { dateStyle: 'short' }) : '---'}
                          </td>
                        )}
                        {visibleColumns.cashierName && (
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {row.cashierName || row.name || '---'}
                          </td>
                        )}
                        {visibleColumns.category && (
                          <td className="px-5 py-3.5 text-slate-500 font-bold">{row.category || '---'}</td>
                        )}
                        {visibleColumns.type && (
                          <td className="px-5 py-3.5 text-center">
                            {row.type ? (
                              <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full border", row.typeColor)}>
                                {row.type}
                              </span>
                            ) : '---'}
                          </td>
                        )}
                        {visibleColumns.paymentMethod && (
                          <td className="px-5 py-3.5 text-center font-bold text-slate-500">
                            {row.paymentMethod ? (
                              row.paymentMethod === 'cash' ? 'نقدي' : 
                              row.paymentMethod === 'visa' ? 'بطاقة' : 
                              row.paymentMethod === 'debt' ? 'آجل' : 'آخر'
                            ) : '---'}
                          </td>
                        )}
                        {visibleColumns.qtySold && (
                          <td className="px-5 py-3.5 text-center font-black">{row.qtySold || '---'}</td>
                        )}
                        {visibleColumns.amount && (
                          <td className="px-5 py-3.5 text-left font-black text-slate-900">
                            {formatCurrency(row.totalSales || row.amount || 0)}
                          </td>
                        )}
                        {visibleColumns.cost && hasPermission('view_cost') && (
                          <td className="px-5 py-3.5 text-left font-bold text-slate-400">
                            {formatCurrency(row.totalCost || row.cost || 0)}
                          </td>
                        )}
                        {visibleColumns.profit && hasPermission('view_profits') && (
                          <td className="px-5 py-3.5 text-left font-black text-emerald-600">
                            {formatCurrency(row.profit || 0)}
                          </td>
                        )}
                        {visibleColumns.margin && hasPermission('view_margins') && (
                          <td className="px-5 py-3.5 text-left">
                            {row.margin ? (
                              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black">
                                {row.margin.toFixed(1)}%
                              </span>
                            ) : '---'}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
                {searchedDataList.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-5 py-16 text-center text-slate-400 italic">لا توجد سجلات تطابق عوامل التصفية الحالية.</td>
                  </tr>
                )}
              </tbody>

              {/* TABLE FOOTER SUM TOTALS */}
              {!groupedDataList.isGrouped && searchedDataList.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-black text-slate-800 border-t-2 border-slate-200">
                    <td className="px-5 py-4 w-10 no-print"></td>
                    <td colSpan={3} className="px-5 py-4 text-right font-black text-slate-900">إجمالي الفترة المحدد (Summary)</td>
                    <td colSpan={2} className="px-5 py-4"></td>
                    {visibleColumns.qtySold && (
                      <td className="px-5 py-4 text-center font-black text-slate-900">{tableFooterTotals.qtySum} قطعة</td>
                    )}
                    {visibleColumns.amount && (
                      <td className="px-5 py-4 text-left font-black text-slate-900">{formatCurrency(tableFooterTotals.salesSum)}</td>
                    )}
                    {visibleColumns.cost && hasPermission('view_cost') && (
                      <td className="px-5 py-4 text-left font-black text-slate-500">{formatCurrency(tableFooterTotals.costSum)}</td>
                    )}
                    {visibleColumns.profit && hasPermission('view_profits') && (
                      <td className="px-5 py-4 text-left font-black text-emerald-700">{formatCurrency(tableFooterTotals.profitSum)}</td>
                    )}
                    {visibleColumns.margin && hasPermission('view_margins') && (
                      <td className="px-5 py-4 text-left">
                        <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-xl text-xs font-black">
                          {tableFooterTotals.marginAvg.toFixed(1)}%
                        </span>
                      </td>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* TABLE PAGINATION */}
          {!groupedDataList.isGrouped && sortedDataList.length > rowsPerPage && (
            <div className="p-4 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between no-print select-none">
              <span className="text-xs text-slate-400 font-bold">
                عرض {Math.min(sortedDataList.length, (currentPage - 1) * rowsPerPage + 1)} إلى {Math.min(sortedDataList.length, currentPage * rowsPerPage)} من أصل {sortedDataList.length} سجل
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-black bg-white disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(sortedDataList.length / rowsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(sortedDataList.length / rowsPerPage)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-black bg-white disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          )}

        </div>

        {/* DETAILED PROFITABILITY HIGHLIGHT CARDS */}
        {mainTab === 'profits' && hasPermission('view_profits') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* Highest profit margin */}
            <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-3xl flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0">
                <Medal className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">أعلى المنتجات تحقيقاً لهامش الربح</h5>
                {profitHighlights.highest ? (
                  <>
                    <p className="font-black text-sm text-slate-900 mt-1 truncate">{profitHighlights.highest.name}</p>
                    <p className="text-xs text-emerald-700 font-bold mt-0.5">
                      هامش ربح بلغت نسبته <strong className="text-md font-black">{profitHighlights.highest.margin.toFixed(1)}%</strong>
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic">لا توجد بيانات كافية</p>
                )}
              </div>
            </div>

            {/* Lowest profit margin */}
            <div className="bg-red-50/50 border border-red-100 p-5 rounded-3xl flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 text-red-700 rounded-2xl flex items-center justify-center shrink-0">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-[10px] font-black text-red-600 uppercase tracking-widest">أقل المنتجات تحقيقاً لهامش الربح</h5>
                {profitHighlights.lowest ? (
                  <>
                    <p className="font-black text-sm text-slate-900 mt-1 truncate">{profitHighlights.lowest.name}</p>
                    <p className="text-xs text-red-700 font-bold mt-0.5">
                      هامش ربح منخفض بلغت نسبته <strong className="text-md font-black">{profitHighlights.lowest.margin.toFixed(1)}%</strong>
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic">لا توجد بيانات كافية</p>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* DRILL DOWN DETAILED MODAL OVERLAY */}
      <AnimatePresence>
        {drillDownType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md no-print">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col border border-slate-100 shadow-2xl"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-md">سجل حركة الفواتير والتحليل التفصيلي</h3>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {drillDownType === 'returns' ? 'جميع معاملات المرتجعات الكاملة والجزئية للفترة' : 'جميع فواتير ومعاملات البيع النشطة'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDrillDownType(null)}
                  className="w-9 h-9 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 rounded-xl flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Body table */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 select-none">
                        <th className="px-5 py-3 text-xs font-black text-slate-400">رقم الفاتورة</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400">التاريخ</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400">الفرع</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400 text-center">طريقة الدفع</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400 text-center">الحالة</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400 text-left">القيمة الكلية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-xs text-slate-700">
                      {drillDownOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-mono font-bold text-blue-600 bg-blue-50/30">
                            #{o.id.slice(-8).toUpperCase()}
                          </td>
                          <td className="px-5 py-3 text-slate-400 font-mono">
                            {new Date(o.createdAt).toLocaleString('ar-EG')}
                          </td>
                          <td className="px-5 py-3 font-bold text-slate-800">
                            {getBranchName(o.branchId)}
                          </td>
                          <td className="px-5 py-3 text-center font-bold text-slate-500">
                            {o.paymentMethod === 'cash' ? 'نقدي' : o.paymentMethod === 'visa' ? 'بطاقة' : 'آجل'}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={cn(
                              "text-[9px] font-black px-2 py-0.5 rounded-full border",
                              o.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                              o.status === 'RETURNED' ? "bg-red-50 text-red-700 border-red-100" : "bg-amber-50 text-amber-700 border-amber-100"
                            )}>
                              {o.status === 'COMPLETED' ? 'مكتملة' : o.status === 'RETURNED' ? 'مرتجعة' : 'مرتجع جزئي'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-left font-black text-slate-900">
                            {formatCurrency(o.total)}
                          </td>
                        </tr>
                      ))}
                      {drillDownOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-slate-400 italic">لا توجد فواتير مطابقة</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">
                  إجمالي قيمة الفواتير المعروضة: <strong className="text-slate-900 font-black text-sm">{formatCurrency(drillDownOrders.reduce((s, o) => s + (o.total || 0), 0))}</strong>
                </span>
                <button
                  onClick={() => setDrillDownType(null)}
                  className="bg-slate-900 hover:bg-slate-850 text-white rounded-xl py-2 px-5 text-xs font-black"
                >
                  إغلاق نافذة التفاصيل
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
