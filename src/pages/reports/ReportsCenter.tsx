import { useState, useMemo } from 'react';
import {
  BarChart3, FileText, Banknote, Package, Calendar, Building2,
  Search, Download, CreditCard, Eye, ArrowRight, Loader2,
  TrendingUp, ShoppingCart, Coins, Users, X, RefreshCw, Smartphone, QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { useSearchParams } from 'react-router-dom';
import { useReportData, filterOrders, computeSalesStats } from '../../hooks/useReportData';
import { Order } from '../../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

type TabId = 'sales' | 'sales-history' | 'pos' | 'inventory';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'sales',         label: 'تقارير المبيعات',   icon: BarChart3   },
  { id: 'sales-history', label: 'سجل الفواتير',       icon: FileText    },
  { id: 'pos',           label: 'كاش والشفتات',       icon: Banknote    },
  { id: 'inventory',     label: 'تقارير المخزون',     icon: Package     },
];

export default function ReportsCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId) || 'sales';
  const setTab = (t: TabId) => setSearchParams({ tab: t });

  const { orders, shifts, warehouses, products, loading, error, refresh } = useReportData();

  const getBranchName = (id: any) => {
    if (!id) return 'غير محدد';
    return warehouses.find(w => String(w.id) === String(id))?.name || `فرع (${id})`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" dir="rtl">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-gray-500 font-bold animate-pulse">جاري تحميل بيانات التقارير...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" dir="rtl">
        <p className="text-red-500 font-bold">{error}</p>
        <button onClick={refresh} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold">
          <RefreshCw className="w-4 h-4" /> إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">مركز التقارير</h1>
          <p className="text-gray-400 font-medium mt-1">تقارير شاملة للمبيعات والمخزون والكاش</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-3 rounded-2xl font-bold text-sm transition-all"
        >
          <RefreshCw className="w-4 h-4" /> تحديث البيانات
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-2 flex overflow-x-auto gap-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all',
                isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'sales' && (
            <SalesTab orders={orders} products={products} warehouses={warehouses} getBranchName={getBranchName} />
          )}
          {activeTab === 'sales-history' && (
            <SalesHistoryTab orders={orders} warehouses={warehouses} getBranchName={getBranchName} />
          )}
          {activeTab === 'pos' && (
            <POSTab shifts={shifts} warehouses={warehouses} getBranchName={getBranchName} />
          )}
          {activeTab === 'inventory' && (
            <InventoryTab products={products} warehouses={warehouses} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────── Sales Tab ─────────────────── */
function SalesTab({ orders, products, warehouses, getBranchName }: any) {
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState('ALL');

  const filtered = useMemo(() => filterOrders(orders, {
    dateFrom, dateTo, branchId,
    statuses: ['COMPLETED']
  }), [orders, dateFrom, dateTo, branchId]);

  const stats = useMemo(() => computeSalesStats(filtered, products, warehouses), [filtered, products, warehouses]);

  const chartData = stats.branchStats.map((b: any) => ({ name: b.name, مبيعات: b.sales, أرباح: b.profit }));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
          <span className="text-gray-400 font-bold">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <select value={branchId} onChange={e => setBranchId(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 appearance-none">
            <option value="ALL">جميع الفروع</option>
            {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي المبيعات', value: formatCurrency(stats.totalSales), icon: BarChart3, color: 'blue' },
          { label: 'صافي الأرباح', value: formatCurrency(stats.totalProfit), icon: TrendingUp, color: 'green', highlight: true },
          { label: 'عدد الفواتير', value: `${stats.ordersCount} فاتورة`, icon: ShoppingCart, color: 'orange' },
          { label: 'الكميات المباعة', value: `${stats.totalItems} قطعة`, icon: Package, color: 'purple' },
        ].map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <h3 className="text-xl font-black text-gray-900 mb-6">أداء الفروع</h3>
          <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 280 }}>
            <BarChart data={chartData} margin={{ right: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} />
              <Bar dataKey="مبيعات" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="أرباح" fill="#22c55e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Products */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
        <h3 className="text-xl font-black text-gray-900 mb-6">أكثر المنتجات مبيعاً</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 rounded-xl">
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">#</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">المنتج</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">الكمية</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">المبيعات</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.topProducts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-300 font-bold">لا توجد بيانات</td></tr>
              ) : stats.topProducts.map((p: any, i: number) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4"><span className="text-sm font-black text-gray-400">{i + 1}</span></td>
                  <td className="px-6 py-4 font-bold text-gray-900">{p.name}</td>
                  <td className="px-6 py-4"><span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-black text-sm">{p.quantity} قطعة</span></td>
                  <td className="px-6 py-4 font-bold text-gray-700">{formatCurrency(p.sales)}</td>
                  <td className="px-6 py-4 text-left font-black text-green-600">{formatCurrency(p.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Sales History Tab ─────────────────── */
function SalesHistoryTab({ orders, warehouses, getBranchName }: any) {
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const filtered = useMemo(() => filterOrders(orders, {
    search, branchId, dateFrom, dateTo
  }), [orders, search, branchId, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder="بحث برقم الفاتورة..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pr-10 pl-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <select value={branchId} onChange={e => setBranchId(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none appearance-none">
            <option value="ALL">جميع الفروع</option>
            {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none" />
          <span className="text-gray-400">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none" />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900">
            {filtered.length} فاتورة — إجمالي {formatCurrency(filtered.reduce((a, o) => a + (o.total || 0), 0))}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">رقم الفاتورة</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">الفرع</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">الدفع</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">الحالة</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">الإجمالي</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">التاريخ</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-300 font-bold">لا توجد فواتير</td></tr>
              ) : filtered.map((order, idx) => (
                <motion.tr key={order.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.01 }}
                  className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => setSelected(order)}
                >
                  <td className="px-6 py-4">
                    <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">#{order.id.slice(-8).toUpperCase()}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-700 text-sm">{getBranchName(order.branchId)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm font-bold text-gray-500">
                      {order.paymentMethod === 'visa' ? (
                        <CreditCard className="w-4 h-4 text-blue-400" />
                      ) : order.paymentMethod === 'vodafone' ? (
                        <Smartphone className="w-4 h-4 text-purple-400" />
                      ) : order.paymentMethod === 'instapay' ? (
                        <QrCode className="w-4 h-4 text-pink-400" />
                      ) : (
                        <Banknote className="w-4 h-4 text-green-500" />
                      )}
                      {order.paymentMethod === 'visa' ? 'فيزا' : 
                       order.paymentMethod === 'vodafone' ? 'فودافون كاش' : 
                       order.paymentMethod === 'instapay' ? 'انستا باي' : 
                       order.paymentMethod === 'debt' ? 'آجل' : 'نقدي'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn('px-3 py-1 rounded-full text-xs font-black',
                      order.status === 'COMPLETED' ? 'bg-green-50 text-green-600' :
                      order.status === 'RETURNED' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500')}>
                      {order.status === 'COMPLETED' ? 'مكتملة' : order.status === 'RETURNED' ? 'مرتجعة' : order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black text-gray-900">{formatCurrency(order.total)}</td>
                  <td className="px-6 py-4 text-sm text-gray-400 font-bold">{formatDate(order.createdAt)}</td>
                  <td className="px-6 py-4">
                    <button className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setSelected(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-10 shadow-2xl">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">تفاصيل الفاتورة</h3>
                  <p className="text-blue-600 font-mono text-sm font-bold">#{selected.id.slice(-10).toUpperCase()}</p>
                </div>
                <button onClick={() => setSelected(null)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 mb-6 max-h-52 overflow-y-auto">
                {selected.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-600 font-black px-2 py-0.5 rounded text-xs">{item.quantity}x</span>
                      <span className="font-bold text-sm text-gray-800">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-500 text-sm">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-900 rounded-2xl p-6 text-white">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>المجموع الفرعي</span><span>{formatCurrency(selected.subtotal)}</span>
                </div>
                {selected.tax > 0 && (
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>الضريبة</span><span>{formatCurrency(selected.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-white/10 pt-4 mt-4">
                  <span className="font-black">الإجمالي</span>
                  <span className="text-2xl font-black text-blue-400">{formatCurrency(selected.total)}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────── POS / Cash Tab ─────────────────── */
function POSTab({ shifts, warehouses, getBranchName }: any) {
  const [branchId, setBranchId] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => shifts.filter((s: any) => {
    if (branchId !== 'ALL' && String(s.branchId) !== String(branchId)) return false;
    if (!s.startDate) return true;
    const d = s.startDate.split('T')[0];
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }), [shifts, branchId, dateFrom, dateTo]);

  const totalCash = filtered.reduce((a: number, s: any) => a + (s.totalSalesCash || 0), 0);
  const totalCard = filtered.reduce((a: number, s: any) => a + (s.totalSalesCard || 0), 0);
  const totalExpenses = filtered.reduce((a: number, s: any) => a + (s.expenses || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <select value={branchId} onChange={e => setBranchId(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none appearance-none">
            <option value="ALL">جميع الفروع</option>
            {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none" />
          <span className="text-gray-400">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center"><Banknote className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">مبيعات نقدية</p>
            <p className="text-xl font-black text-gray-900">{formatCurrency(totalCash)}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><CreditCard className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">مبيعات فيزا</p>
            <p className="text-xl font-black text-gray-900">{formatCurrency(totalCard)}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center"><Coins className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">المصروفات</p>
            <p className="text-xl font-black text-gray-900">{formatCurrency(totalExpenses)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <h3 className="text-lg font-black text-gray-900">{filtered.length} وردية / شفت</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">الفرع</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">تاريخ البداية</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">الحالة</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">نقدي</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">فيزا</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">مصروفات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-300 font-bold">لا توجد وردياّت</td></tr>
              ) : filtered.map((shift: any, idx: number) => (
                <tr key={shift.id || idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-700 text-sm">{getBranchName(shift.branchId)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-bold">{shift.startDate ? formatDate(shift.startDate) : '—'}</td>
                  <td className="px-6 py-4">
                    <span className={cn('px-3 py-1 rounded-full text-xs font-black',
                      shift.status === 'OPEN' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500')}>
                      {shift.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-green-600">{formatCurrency(shift.totalSalesCash || 0)}</td>
                  <td className="px-6 py-4 font-bold text-blue-600">{formatCurrency(shift.totalSalesCard || 0)}</td>
                  <td className="px-6 py-4 font-bold text-red-500 text-left">{formatCurrency(shift.expenses || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Inventory Tab ─────────────────── */
function InventoryTab({ products, warehouses }: any) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    products.filter((p: any) => p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const totalValue = filtered.reduce((a: number, p: any) => a + (Number(p.costPrice) || 0) * (Number(p.quantity) || 0), 0);
  const totalQty = filtered.reduce((a: number, p: any) => a + (Number(p.quantity) || 0), 0);
  const lowStock = filtered.filter((p: any) => p.quantity <= 5).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Package className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">إجمالي الأصناف</p>
            <p className="text-xl font-black text-gray-900">{filtered.length} صنف</p>
          </div>
        </div>
        <div className="bg-gray-900 rounded-3xl shadow-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 text-green-400 flex items-center justify-center"><Coins className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-green-400 font-black uppercase tracking-widest mb-1">قيمة المخزون</p>
            <p className="text-xl font-black text-white">{formatCurrency(totalValue)}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center"><Package className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">منتجات منخفضة</p>
            <p className="text-xl font-black text-red-500">{lowStock} صنف</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="بحث في المنتجات..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pr-10 pl-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">المنتج</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">الفئة</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">الكمية</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">سعر التكلفة</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">سعر البيع</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">قيمة المخزون</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-300 font-bold">لا توجد منتجات</td></tr>
              ) : filtered.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                    {p.sku && <p className="text-xs text-gray-400 font-mono">{p.sku}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-bold">{p.category || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={cn('px-3 py-1 rounded-lg font-black text-sm',
                      p.quantity <= 5 ? 'bg-red-50 text-red-500' : p.quantity <= 20 ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600')}>
                      {p.quantity ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-600">{formatCurrency(p.costPrice)}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(p.sellingPrice)}</td>
                  <td className="px-6 py-4 font-black text-blue-600 text-left">{formatCurrency((p.costPrice || 0) * (p.quantity || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Shared StatCard ─────────────────── */
function StatCard({ icon: Icon, label, value, color, highlight }: any) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  if (highlight) {
    return (
      <div className="bg-gray-900 p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full -mr-12 -mt-12" />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="w-10 h-10 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-900/20">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-green-400 text-xs font-black uppercase tracking-widest mb-1">{label}</p>
            <h3 className="text-2xl font-black text-white">{value}</h3>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-3 hover:shadow-md transition-all">
      <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center', colorMap[color] || colorMap.blue)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-2xl font-black text-gray-900">{value}</h3>
      </div>
    </div>
  );
}
