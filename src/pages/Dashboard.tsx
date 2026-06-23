import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertCircle, 
  Clock, 
  Loader2,
  Calendar,
  Bell,
  CreditCard,
  Wallet,
  Banknote
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { motion } from 'motion/react';
import { collection, onSnapshot, doc, getDoc, setDoc, getDocs, writeBatch, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { pageGroups } from '../constants/pageGroups';
import { 
  aggregateSalesData, 
  calculateDashboardStats, 
  getTopSellingProducts,
  AnalyticsPeriod 
} from '../utils/analytics';
import { useNavigate } from 'react-router-dom';
import { 
  ErpPageLayout, 
  ErpPageHeader, 
  ErpStatCard, 
  ErpCard, 
  ErpButton 
} from '../components/ui/ErpUI';

export default function Dashboard() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;

    const checkAndRegisterNewPages = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'registered_pages');
        const docSnap = await getDoc(docRef);
        
        // Extract all page keys and their details from pageGroups
        const allPages: { key: string; label: string; groupMasterKey: string }[] = [];
        pageGroups.forEach(group => {
          group.pages.forEach(page => {
            allPages.push({
              key: page.key,
              label: page.label,
              groupMasterKey: group.masterKey
            });
          });
        });

        const allKeys = allPages.map(p => p.key);

        if (!docSnap.exists()) {
          // Initial setup: save all current keys
          await setDoc(docRef, { keys: allKeys, updatedAt: new Date().toISOString() });
          return;
        }

        const registeredData = docSnap.data();
        const registeredKeys: string[] = registeredData.keys || [];

        // Find keys in code that are not in Firestore
        const newPages = allPages.filter(p => !registeredKeys.includes(p.key));

        if (newPages.length > 0) {
          console.log('New pages detected:', newPages);

          // 1. Update registered pages list in settings
          const updatedKeys = [...registeredKeys, ...newPages.map(p => p.key)];
          await setDoc(docRef, { keys: updatedKeys, updatedAt: new Date().toISOString() });

          // 2. Fetch all users to update their permissions
          const usersSnap = await getDocs(collection(db, 'users'));
          const batch = writeBatch(db);

          usersSnap.forEach(userDoc => {
            const userData = userDoc.data();
            const currentPermissions = userData.permissions || {};
            const updatedPermissions = { ...currentPermissions };

            let hasUpdates = false;

            newPages.forEach(newPage => {
              // If user is ADMIN, always give access (true)
              // If user has the group's master permission, inherit that value
              if (userData.role === 'ADMIN') {
                updatedPermissions[newPage.key] = true;
                hasUpdates = true;
              } else if (newPage.groupMasterKey in currentPermissions) {
                updatedPermissions[newPage.key] = !!currentPermissions[newPage.groupMasterKey];
                hasUpdates = true;
              } else {
                // Otherwise default to false
                updatedPermissions[newPage.key] = false;
                hasUpdates = true;
              }
            });

            if (hasUpdates) {
              batch.update(userDoc.ref, { permissions: updatedPermissions });
            }
          });

          await batch.commit();

          // 3. Create system notifications for each new page
          for (const newPage of newPages) {
            await addDoc(collection(db, 'notifications'), {
              title: 'تحديث جديد في النظام',
              message: `تم إضافة صفحة "${newPage.label}" إلى النظام.`,
              description: `تم إدراج الصفحة وتفعيل الصلاحيات تلقائياً لكافة المستخدمين المؤهلين.`,
              type: 'SYSTEM',
              isRead: false,
              createdAt: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.error('Error auto-registering new pages:', err);
      }
    };

    checkAndRegisterNewPages();
  }, [currentUser]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<AnalyticsPeriod>('weekly');

  useEffect(() => {
    setLoading(true);
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching orders:', error);
      setLoading(false);
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsData);
    }, (error) => {
      console.error('Error fetching products:', error);
    });

    return () => {
      unsubOrders();
      unsubProducts();
    };
  }, []);

  const [cashTxs, setCashTxs] = useState<any[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    const unsubCash = onSnapshot(collection(db, 'cash_transactions'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCashTxs(data);
    }, (err) => console.error('cash txs error', err));

    const unsubNot = onSnapshot(collection(db, 'notifications'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifs(data.slice(0, 20));
    }, (err) => console.error('notifications error', err));

    return () => { unsubCash(); unsubNot(); };
  }, []);

  const parseDate = (d: any) => (d && typeof d.toDate === 'function') ? d.toDate() : new Date(d);

  const stats = calculateDashboardStats(orders, products);
  const chartData = aggregateSalesData(orders, period);
  const topSelling = getTopSellingProducts(orders.filter(o => (o.status === 'COMPLETED' || !o.status) && o.customerId !== 'EXPENSE'));
  const lowStockCount = products.filter(p => (p.quantity || 0) <= ((p as any).minStock || 5)).length;

  const today = new Date();
  const isSameDay = (d: Date) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  const salesToday = orders
    .filter(o => isSameDay(parseDate(o.createdAt)) && (o.status === 'COMPLETED' || !o.status) && o.customerId !== 'EXPENSE')
    .reduce((s, o) => s + (o.total || 0), 0);

  const salesThisMonth = orders
    .filter(o => {
      const dt = parseDate(o.createdAt);
      return dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth() && (o.status === 'COMPLETED' || !o.status) && o.customerId !== 'EXPENSE';
    })
    .reduce((s, o) => s + (o.total || 0), 0);

  const totalPurchases = cashTxs.filter(t => t.type === 'PAYMENT').reduce((s, t) => s + (t.amount || 0), 0);

  const approxProfit = orders.reduce((acc, o) => {
    const itemsProfit = (o.items || []).reduce((ia, it) => {
      const prod = products.find(p => p.id === it.productId);
      const cost = prod?.costPrice || 0;
      return ia + ((it.price || 0) - cost) * (it.quantity || 0);
    }, 0);
    return acc + itemsProfit;
  }, 0);

  const cashBalance = cashTxs.filter(t => !/bank|بنك/i.test(t.accountName || '')).reduce((s, t) => {
    return s + ((t.type === 'RECEIPT') ? (t.amount || 0) : -(t.amount || 0));
  }, 0);

  const bankBalance = cashTxs.filter(t => /bank|بنك/i.test(t.accountName || '')).reduce((s, t) => {
    return s + ((t.type === 'RECEIPT') ? (t.amount || 0) : -(t.amount || 0));
  }, 0);

  const recentOps = [
    ...orders.map(o => ({ type: 'order', ts: parseDate(o.createdAt), data: o })),
    ...cashTxs.map(c => ({ type: 'cash', ts: parseDate(c.createdAt), data: c }))
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime()).slice(0, 8);

  const periods: { id: AnalyticsPeriod, label: string }[] = [
    { id: 'daily', label: 'يومي' },
    { id: 'weekly', label: 'أسبوعي' },
    { id: 'monthly', label: 'شهري' },
    { id: 'yearly', label: 'سنوي' }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-500 font-bold animate-pulse">جاري تحميل التحليلات...</p>
      </div>
    );
  }

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title="لوحة التحكم"
        description="ملخص شامل للمبيعات، المشتريات، المخزون، والإشعارات."
        breadcrumbs={[{ label: 'الرئيسية' }, { label: 'لوحة التحكم' }]}
        actions={
          <ErpButton variant="primary" icon={Calendar}>
            تصدير التقرير
          </ErpButton>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ErpStatCard title="مبيعات اليوم" value={formatCurrency(salesToday)} icon={BarChart3} trend={salesToday >= 0 ? 'up' : 'down'} change=" " onClick={() => navigate('/reports?view=sales')} color="blue" />
        <ErpStatCard title="مبيعات الشهر" value={formatCurrency(salesThisMonth)} icon={Calendar} trend={salesThisMonth >= 0 ? 'up' : 'down'} change=" " onClick={() => navigate('/reports?view=sales')} color="indigo" />
        <ErpStatCard title="إجمالي المشتريات" value={formatCurrency(totalPurchases)} icon={CreditCard} trend={totalPurchases >= 0 ? 'up' : 'down'} change=" " onClick={() => navigate('/reports')} color="purple" />
        <ErpStatCard title="الأرباح" value={formatCurrency(approxProfit)} icon={TrendingUp} trend={approxProfit >= 0 ? 'up' : 'down'} change=" " onClick={() => navigate('/reports?view=profit')} color="emerald" />
        <ErpStatCard title="أرصدة الصناديق" value={formatCurrency(cashBalance)} icon={Wallet} trend={cashBalance >= 0 ? 'up' : 'down'} change=" " onClick={() => navigate('/cash/reports')} color="slate" />
        <ErpStatCard title="أرصدة البنوك" value={formatCurrency(bankBalance)} icon={Banknote} trend={bankBalance >= 0 ? 'up' : 'down'} change=" " onClick={() => navigate('/cash/reports')} color="blue" />
        <ErpStatCard title="المنتجات منخفضة المخزون" value={`${lowStockCount} منتج`} icon={AlertCircle} trend="down" change=" " onClick={() => navigate('/inventory/reports')} color="red" />
        <ErpStatCard title="إشعارات النظام" value={`${notifs.length} إشعار`} icon={Bell} trend="up" change=" " onClick={() => navigate('/reports')} color="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <ErpCard>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-lg font-bold text-slate-900">ملخص المبيعات</h4>
              <p className="text-sm text-slate-500">عرض تطور المبيعات حسب الفترة التي تختارها.</p>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-slate-50 p-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-bold transition',
                    period === p.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:bg-white hover:text-slate-600'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 360 }}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'bold', marginBottom: 4 }} formatter={(value: any) => [formatCurrency(value), 'المبيعات']} />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ErpCard>

        <ErpCard className="overflow-hidden p-0 sm:p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h4 className="text-base font-bold text-slate-900">إشعارات النظام</h4>
              <p className="text-sm text-slate-500">آخر التنبيهات والإشعارات المرتبطة بالنظام.</p>
            </div>
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto scrollbar-thin">
            {notifs.length > 0 ? notifs.map((notif, idx) => (
              <div key={notif.id || idx} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-gray-900 truncate">{notif.title || notif.message || 'تنبيه جديد'}</p>
                  <span className="text-[11px] uppercase tracking-widest text-gray-400">{new Date(parseDate(notif.createdAt)).toLocaleDateString('ar-EG')}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{notif.description || notif.message || 'تفاصيل الإشعار غير متاحة'}</p>
              </div>
            )) : (
              <div className="px-6 py-10 text-center text-gray-400">لا توجد إشعارات حالياً</div>
            )}
          </div>
        </ErpCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ErpCard className="overflow-hidden p-0 sm:p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h4 className="text-base font-bold text-slate-900">أفضل المنتجات مبيعاً</h4>
              <p className="text-sm text-slate-500">المنتجات الأعلى مبيعاً خلال الفترة الحالية.</p>
            </div>
            <Package className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-3 p-4">
            {topSelling.length > 0 ? topSelling.map((product, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div>
                  <p className="text-sm font-black text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{product.sales} وحدة</p>
                </div>
                <span className="text-sm font-black text-blue-600">{formatCurrency(product.revenue)}</span>
              </div>
            )) : (
              <div className="text-center py-10 text-gray-400">لا توجد بيانات مبيعات</div>
            )}
          </div>
        </ErpCard>

        <ErpCard className="overflow-hidden p-0 sm:p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h4 className="text-base font-bold text-slate-900">آخر العمليات</h4>
              <p className="text-sm text-slate-500">أحدث الفواتير والحركات المالية على النظام.</p>
            </div>
            <Clock className="h-5 w-5 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto scrollbar-thin">
            {recentOps.length > 0 ? recentOps.map((item, idx) => (
              <div key={`${item.type}-${item.data.id || idx}`} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] uppercase tracking-widest text-gray-400">{item.type === 'order' ? 'فاتورة' : 'حركة نقدية'}</span>
                  <span className="text-[11px] text-gray-400">{item.ts.toLocaleDateString('ar-EG')}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.type === 'order' ? `فاتورة ${item.data.id.slice(-6).toUpperCase()}` : item.data.reference || 'عملية نقدية'}</p>
                  <span className="text-sm font-black text-gray-900">{formatCurrency(item.data.total || item.data.amount || 0)}</span>
                </div>
              </div>
            )) : (
              <div className="px-6 py-10 text-center text-gray-400">لا توجد عمليات حديثة</div>
            )}
          </div>
        </ErpCard>
      </div>
    </ErpPageLayout>
  );
}


