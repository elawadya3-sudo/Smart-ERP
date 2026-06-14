import { useState, useEffect, useMemo } from 'react';
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
  ArrowUpRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, Warehouse, User, Product } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Reports() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialView = queryParams.get('view') === 'profit' ? 'profit' : 'sales';

  const [view, setView] = useState<'sales' | 'profit'>(initialView);
  const [orders, setOrders] = useState<Order[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ordersSnap, warehousesSnap, cashiersSnap, productsSnap] = await Promise.all([
          getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
          getDocs(collection(db, 'warehouses')),
          getDocs(query(collection(db, 'users'))),
          getDocs(collection(db, 'products'))
        ]);

        const ordersData = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        const warehousesData = warehousesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
        const cashiersData = cashiersSnap.docs.map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() } as unknown as User));
        const productsData = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

        setOrders(ordersData);
        setWarehouses(warehousesData);
        setCashiers(cashiersData);
        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getBranchName = (id: any) => {
    if (!id || id === 'unknown') return 'غير محدد';
    const warehouse = warehouses.find(w => String(w.id) === String(id));
    if (warehouse) return warehouse.name;
    
    const fallback = warehouses.find(w => (w as any).code === id || w.name === id);
    if (fallback) return fallback.name;

    return `فرع (${id})`;
  };

  const getCashierName = (id: string) => cashiers.find(u => u.uid === id)?.name || 'غير معروف';

  const filteredOrders = useMemo(() => orders.filter(order => {
    // 1. Exclude Expenses (Cash Disbursements)
    if (order.customerId === 'EXPENSE') return false;
    
    // 2. Filter by Branch
    const matchesBranch = selectedBranch === 'ALL' || String(order.branchId) === String(selectedBranch);
    
    // 3. Filter by Date
    const dateObj = new Date(order.createdAt && typeof (order.createdAt as any).toDate === 'function' 
      ? (order.createdAt as any).toDate() 
      : order.createdAt);
    
    const localDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const matchesDate = !selectedDate || localDate === selectedDate;
    
    // 4. Filter by Search
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         order.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // 5. Exclude returned and pending orders from sales reports
    return matchesBranch && matchesDate && matchesSearch && (order.status === 'COMPLETED' || !order.status);
  }), [orders, selectedBranch, selectedDate, searchTerm]);

  const stats = useMemo(() => {
    const branchProfits: Record<string, { id: string, name: string, profit: number, sales: number, ordersCount: number, itemsCount: number }> = {};
    
    // Initialize all branch warehouses
    warehouses
      .filter(w => (w as any).type !== 'MAIN' && w.id !== '1')
      .forEach(w => {
        branchProfits[w.id] = { 
          id: w.id, 
          name: w.name, 
          profit: 0, 
          sales: 0, 
          ordersCount: 0,
          itemsCount: 0
        };
      });

    const productProfits: Record<string, { id: string, name: string, profit: number, quantity: number, sales: number }> = {};

    let globalProfit = 0;
    let globalSales = 0;
    let globalItems = 0;

    filteredOrders.forEach(order => {
      const bId = order.branchId;
      if (!bId || !branchProfits[bId]) return;

      branchProfits[bId].ordersCount += 1;
      globalSales += (order.total || 0);

      order.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const costPrice = Number(product?.costPrice || 0);
        const itemProfit = (item.total || 0) - ((item.quantity || 0) * costPrice);
        
        globalProfit += itemProfit;
        globalItems += (item.quantity || 0);
        
        branchProfits[bId].profit += itemProfit;
        branchProfits[bId].sales += (item.total || 0);
        branchProfits[bId].itemsCount += (item.quantity || 0);

        if (!productProfits[item.productId]) {
          productProfits[item.productId] = { id: item.productId, name: item.name, profit: 0, quantity: 0, sales: 0 };
        }
        productProfits[item.productId].profit += itemProfit;
        productProfits[item.productId].quantity += (item.quantity || 0);
        productProfits[item.productId].sales += (item.total || 0);
      });
    });

    const sortedBranches = Object.values(branchProfits).sort((a, b) => b.profit - a.profit);
    const topBranch = sortedBranches[0]?.profit > 0 ? sortedBranches[0] : null;
    const margin = globalSales > 0 ? (globalProfit / globalSales) * 100 : 0;

    return { 
      totalSales: globalSales, 
      totalItems: globalItems, 
      totalProfit: globalProfit, 
      ordersCount: filteredOrders.length,
      margin: margin.toFixed(1),
      branchStats: sortedBranches, 
      productProfit: Object.values(productProfits).sort((a, b) => b.profit - a.profit).slice(0, 10), 
      topBranch 
    };
  }, [filteredOrders, products, warehouses]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-500 font-bold animate-pulse">جاري تحليل البيانات المالية...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir="rtl">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-20"></div>
        
        <div className="relative z-10">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] mb-4 hover:gap-3 transition-all"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            لوحة التحكم الرئيسية
          </button>
          <div className="flex items-center gap-4 mb-2">
             <h2 className="text-4xl font-black text-gray-900 tracking-tight">التقارير المالية</h2>
             <div className="bg-gray-100 p-1 rounded-2xl flex items-center">
                <button 
                  onClick={() => setView('sales')}
                  className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all", view === 'sales' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400")}
                >
                  المبيعات
                </button>
                <button 
                  onClick={() => setView('profit')}
                  className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all", view === 'profit' ? "bg-white text-green-600 shadow-sm" : "text-gray-400")}
                >
                  الأرباح
                </button>
             </div>
          </div>
          <p className="text-gray-500 font-medium italic">
            {selectedBranch === 'ALL' 
              ? `عرض شامل لجميع الفروع - ${selectedDate || 'جميع الأوقات'}` 
              : `تقرير تفصيلي لفرع ${getBranchName(selectedBranch)} - ${selectedDate || 'جميع الأوقات'}`}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full lg:w-auto relative z-10">
          <div className="relative group flex-1 md:flex-none min-w-[200px]">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text"
              placeholder="بحث في الفواتير..."
              className="w-full bg-gray-50 border border-gray-100 rounded-[1.5rem] pr-10 pl-4 py-4 text-sm font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-100 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative flex-1 md:flex-none min-w-[180px]">
            <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select 
              className="w-full bg-gray-50 border border-gray-100 rounded-[1.5rem] pr-10 pl-8 py-4 text-sm font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="ALL">جميع الفروع</option>
              {warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1').map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 md:flex-none min-w-[160px]">
            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="date"
              className="w-full bg-gray-50 border border-gray-100 rounded-[1.5rem] pr-10 pl-4 py-4 text-sm font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={BarChart3} 
          label="إجمالي المبيعات" 
          value={formatCurrency(stats.totalSales)} 
          subValue="إيرادات صافية"
          color="blue"
        />
        <StatCard 
          icon={Coins} 
          label="صافي الأرباح" 
          value={formatCurrency(stats.totalProfit)} 
          subValue={`${stats.margin}% نسبة الربح`}
          color="green"
          highlight
        />
        <StatCard 
          icon={ShoppingCart} 
          label="عدد الفواتير" 
          value={`${stats.ordersCount} فاتورة`} 
          subValue="مكتملة"
          color="orange"
        />
        <StatCard 
          icon={Package} 
          label="الكمية المباعة" 
          value={`${stats.totalItems} قطعة`} 
          subValue="إجمالي الأصناف"
          color="purple"
        />
      </div>

      {view === 'sales' ? (
        <SalesView 
          orders={filteredOrders} 
          getBranchName={getBranchName} 
          getCashierName={getCashierName} 
          formatCurrency={formatCurrency} 
        />
      ) : (
        <ProfitView 
          branchStats={stats.branchStats} 
          productProfit={stats.productProfit} 
          formatCurrency={formatCurrency}
          selectedBranch={selectedBranch}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subValue, color, highlight }: any) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600"
  };

  if (highlight) {
    return (
      <div className="bg-gray-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-all"></div>
        <div className="relative z-10 flex flex-col gap-4">
           <div className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-900/20">
             <Icon className="w-6 h-6" />
           </div>
           <div>
             <p className="text-green-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{label}</p>
             <h3 className="text-3xl font-black text-white">{value}</h3>
             <p className="text-green-500/80 text-xs font-bold mt-1">{subValue}</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col gap-4 group hover:shadow-md transition-all">
       <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-colors", colors[color as keyof typeof colors])}>
         <Icon className="w-6 h-6" />
       </div>
       <div>
         <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{label}</p>
         <h3 className="text-2xl font-black text-gray-900">{value}</h3>
         <p className="text-gray-400 text-xs font-bold mt-1">{subValue}</p>
       </div>
    </div>
  );
}

function SalesView({ orders, getBranchName, getCashierName, formatCurrency }: any) {
  return (
    <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-10 border-b border-gray-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-gray-50/30">
        <div>
          <h4 className="text-2xl font-black text-gray-900">سجل المبيعات التفصيلي</h4>
          <p className="text-gray-400 font-medium text-sm mt-1">تتبع كافة العمليات والطلبات الصادرة من الفروع</p>
        </div>
        <button className="flex items-center gap-3 bg-gray-900 text-white px-8 py-4 rounded-[1.5rem] text-sm font-black hover:bg-black transition-all shadow-xl shadow-gray-200">
          <Download className="w-5 h-5" />
          تصدير التقرير
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-gray-100/50">
              <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">رقم الفاتورة</th>
              <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">الفرع</th>
              <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">الكاشير</th>
              <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">الأصناف</th>
              <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-widest text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.length === 0 ? (
              <tr><td colSpan={5} className="px-10 py-20 text-center text-gray-400 font-bold italic">لا توجد مبيعات تطابق البحث</td></tr>
            ) : (
              orders.map((order: any, idx: number) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: idx * 0.02 }} 
                  key={order.id} 
                  className="hover:bg-gray-50/50 transition-colors group"
                >
                  <td className="px-10 py-6">
                    <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">#{order.id.slice(-8).toUpperCase()}</span>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                       <span className="font-black text-sm text-gray-900">{getBranchName(order.branchId)}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2 text-gray-500 font-bold text-sm">
                       <Users className="w-4 h-4" />
                       {getCashierName(order.cashierId)}
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex flex-wrap gap-2">
                      {order.items.slice(0, 3).map((item: any, i: number) => (
                        <span key={i} className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-black text-gray-500">
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                      {order.items.length > 3 && <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-full">+{order.items.length - 3} أصناف أخرى</span>}
                    </div>
                  </td>
                  <td className="px-10 py-6 text-left font-black text-lg text-gray-900">{formatCurrency(order.total)}</td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProfitView({ branchStats, productProfit, formatCurrency, selectedBranch }: any) {
  const isSpecificBranch = selectedBranch !== 'ALL';
  const displayBranches = isSpecificBranch ? branchStats.filter((b: any) => b.id === selectedBranch) : branchStats;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
      {/* Branch Stats Table */}
      <div className="lg:col-span-2 bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-10 border-b border-gray-50 bg-green-50/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-600 shadow-sm border border-green-50">
                <Building2 className="w-6 h-6" />
             </div>
             <div>
                <h4 className="text-2xl font-black text-gray-900">أداء مستودعات الفروع</h4>
                <p className="text-gray-400 text-xs font-bold mt-1">تحليل الأرباح والمبيعات لكل فرع</p>
             </div>
          </div>
          <span className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em] bg-white px-4 py-2 rounded-full border border-green-100 shadow-sm">تحديث مباشر</span>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">المستودع</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">الفواتير</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">المبيعات</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">صافي الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayBranches.map((branch: any, idx: number) => {
                const margin = branch.sales > 0 ? (branch.profit / branch.sales) * 100 : 0;
                return (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-all group">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-sm", idx === 0 && !isSpecificBranch ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-gray-400")}>
                          {isSpecificBranch ? <Store className="w-5 h-5" /> : idx + 1}
                        </div>
                        <div>
                           <span className="font-black text-gray-900 block text-lg">{branch.name}</span>
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{branch.itemsCount} قطعة مباعة</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-center">
                       <span className="font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-lg text-sm">{branch.ordersCount}</span>
                    </td>
                    <td className="px-10 py-8">
                       <span className="font-black text-gray-700">{formatCurrency(branch.sales)}</span>
                       <div className="w-32 h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (branch.sales / 100000) * 100)}%` }}></div>
                       </div>
                    </td>
                    <td className="px-10 py-8 text-left">
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn(
                          "font-black px-4 py-2 rounded-2xl text-lg",
                          branch.profit > 0 ? "text-green-600 bg-green-50" : "text-gray-400 bg-gray-50"
                        )}>
                          {formatCurrency(branch.profit)}
                        </span>
                        <span className="text-[10px] font-black text-green-500 mr-2">{margin.toFixed(1)}% هامش ربح</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayBranches.length === 0 && (
                <tr><td colSpan={4} className="px-10 py-20 text-center text-gray-400 font-bold italic">لا توجد بيانات لهذا الفرع في الفترة المحددة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Most Profitable Products */}
      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-10 border-b border-gray-50 bg-blue-50/10 flex items-center gap-4">
           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-50">
              <TrendingUp className="w-6 h-6" />
           </div>
           <div>
              <h4 className="text-2xl font-black text-gray-900">الأكثر ربحية</h4>
              <p className="text-gray-400 text-xs font-bold mt-1">{isSpecificBranch ? 'تحليل الفرع الحالي' : 'على مستوى جميع الفروع'}</p>
           </div>
        </div>
        <div className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[700px] scrollbar-none bg-gray-50/20">
          {productProfit.length === 0 ? (
             <div className="p-20 text-center text-gray-300 italic font-bold">لا توجد بيانات</div>
          ) : (
            productProfit.map((product: any, idx: number) => {
              const productMargin = product.sales > 0 ? (product.profit / product.sales) * 100 : 0;
              return (
                <div key={idx} className="p-6 bg-white rounded-[2rem] border border-gray-100 flex flex-col gap-4 hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="font-black text-gray-900 text-md mb-1">{product.name}</h5>
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-1 rounded-lg">الترتيب {idx + 1}</span>
                        <span className="text-[10px] text-gray-400 font-bold">ID: {product.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                    <div>
                       <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">الكمية المباعة</p>
                       <span className="font-black text-gray-900 text-sm">{product.quantity} قطعة</span>
                    </div>
                    <div className="text-left">
                       <p className="text-[10px] text-green-600 font-black uppercase tracking-widest mb-1">صافي الربح</p>
                       <span className="font-black text-green-600 text-lg">{formatCurrency(product.profit)}</span>
                       <p className="text-[9px] font-bold text-green-400">{productMargin.toFixed(1)}% هامش</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
