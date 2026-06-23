import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Coins,
  Percent,
  Clock,
  FileText,
  Target,
  ShoppingCart,
  Users,
  Building2,
  ChevronLeft
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useMainStoreSettings } from '../../hooks/useMainStoreSettings';
import { cn, formatCurrency } from '../../lib/utils';
import {
  ErpPageLayout,
  ErpPageHeader,
  ErpStatCard,
  ErpCard
} from '../../components/ui/ErpUI';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  totalSales: number;
  totalProfit: number;
  profitMargin: number;
  pendingApprovals: number;
  activeQuotations: number;
  targetAchievement: number;
}

export default function SalesDashboard() {
  const navigate = useNavigate();
  const { settings } = useMainStoreSettings();
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 450000,
    totalProfit: 98000,
    profitMargin: 21.7,
    pendingApprovals: 5,
    activeQuotations: 12,
    targetAchievement: 84.5
  });

  const [recentOrders, setRecentOrders] = useState<any[]>([
    { id: 'SO-00001', customerName: 'شركة النور للتجارة', total: 45000, status: 'approved', date: '2026-06-23T12:00:00Z', rep: 'أحمد محمود' },
    { id: 'SO-00002', customerName: 'مؤسسة الرياض', total: 12500, status: 'pending_approval', date: '2026-06-23T11:30:00Z', rep: 'سارة علي' },
    { id: 'SO-00003', customerName: 'معتز شريف', total: 6200, status: 'draft', date: '2026-06-23T10:15:00Z', rep: 'خالد عبدالله' },
    { id: 'SO-00004', customerName: 'مستشفى الشفاء', total: 85000, status: 'delivered', date: '2026-06-22T16:45:00Z', rep: 'أحمد محمود' },
    { id: 'SO-00005', customerName: 'عمر القحطاني', total: 3400, status: 'rejected', date: '2026-06-22T14:20:00Z', rep: 'سارة علي' }
  ]);

  const [repPerformance, setRepPerformance] = useState<any[]>([
    { name: 'أحمد محمود', target: 120000, achieved: 130000, sales: 130000, percentage: 108.3 },
    { name: 'سارة علي', target: 100000, achieved: 85000, sales: 85000, percentage: 85.0 },
    { name: 'خالد عبدالله', target: 80000, achieved: 56000, sales: 56000, percentage: 70.0 }
  ]);

  const [salesByBranch, setSalesByBranch] = useState<any[]>([
    { name: 'فرع الرياض الرئيسي', value: 240000, percentage: 53.3 },
    { name: 'فرع جدة', value: 130000, percentage: 28.9 },
    { name: 'فرع الدمام', value: 80000, percentage: 17.8 }
  ]);

  const [periodSales, setPeriodSales] = useState<any[]>([
    { label: 'يناير', value: 32000 },
    { label: 'فبراير', value: 45000 },
    { label: 'مارس', value: 58000 },
    { label: 'أبريل', value: 72000 },
    { label: 'مايو', value: 95000 },
    { label: 'يونيو', value: 148000 }
  ]);

  // Try to load real data count from Firestore if collections exist
  useEffect(() => {
    const fetchRealCounts = async () => {
      try {
        const ordersSnap = await getDocs(collection(db, 'sales_orders'));
        if (!ordersSnap.empty) {
          const orders = ordersSnap.docs.map(doc => doc.data());
          const totalSalesVal = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
          const approvedCount = orders.filter((o: any) => o.status === 'approved').length;
          const pendingCount = orders.filter((o: any) => o.status === 'pending_approval').length;
          
          setStats(prev => ({
            ...prev,
            totalSales: totalSalesVal || prev.totalSales,
            pendingApprovals: pendingCount || prev.pendingApprovals
          }));
        }
      } catch (err) {
        console.log('Using default mock values for sales stats');
      }
    };
    fetchRealCounts();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-black border border-emerald-100">معتمد</span>;
      case 'pending_approval':
        return <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-[10px] font-black border border-amber-100 animate-pulse">قيد التصديق</span>;
      case 'rejected':
        return <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[10px] font-black border border-rose-100">مرفوض</span>;
      case 'delivered':
        return <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black border border-blue-100">تم التسليم</span>;
      case 'cancelled':
        return <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black">ملغي</span>;
      default:
        return <span className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black border border-slate-200">مسودة</span>;
    }
  };

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title="لوحة تحكم المبيعات"
        description="نظرة عامة على أداء المبيعات والمستهدف ومؤشرات الأداء الرئيسية"
        breadcrumbs={[{ label: 'الرئيسية' }, { label: 'المبيعات' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/sales/docs/order')}
              className="bg-[var(--color-primary)] text-white px-4 py-1.5 rounded text-xs font-black hover:brightness-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              أمر بيع جديد
            </button>
            <button
              onClick={() => navigate('/sales/docs/quotations')}
              className="bg-slate-100 text-slate-800 border border-slate-200 px-4 py-1.5 rounded text-xs font-black hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              عرض سعر جديد
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <ErpStatCard title="إجمالي المبيعات" value={formatCurrency(stats.totalSales)} icon={Coins} color="blue" trend="up" change="هذا الشهر" />
        <ErpStatCard title="صافي الأرباح" value={formatCurrency(stats.totalProfit)} icon={TrendingUp} color="emerald" trend="up" change="مبيعات - تكلفة" />
        <ErpStatCard title="هامش الربح" value={`${stats.profitMargin}%`} icon={Percent} color="purple" trend="up" change="متوسط الهامش" />
        <ErpStatCard title="أوامر قيد الموافقة" value={stats.pendingApprovals} icon={Clock} color="amber" change="تحتاج تصديق" />
        <ErpStatCard title="عروض أسعار نشطة" value={stats.activeQuotations} icon={FileText} color="indigo" change="عروض سارية" />
        <ErpStatCard title="نسبة تحقيق الهدف" value={`${stats.targetAchievement}%`} icon={Target} color="red" trend="up" change="المستهدف العام" />
      </div>

      {/* Analytics Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales by Period Chart */}
        <div className="lg:col-span-2">
          <ErpCard title="مخطط المبيعات الدورية" subtitle="تتبع تطور المبيعات الشهرية خلال النصف الأول من العام">
            <div className="h-64 flex items-end justify-between gap-4 pt-8 px-2 font-sans">
              {periodSales.map((item, idx) => {
                const maxVal = Math.max(...periodSales.map(i => i.value));
                const barHeight = (item.value / maxVal) * 80; // Scale to max 80%
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group">
                    <div className="text-[10px] font-black text-slate-800 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white px-1.5 py-0.5 rounded shadow">
                      {formatCurrency(item.value)}
                    </div>
                    <div
                      className="w-full bg-blue-600/80 group-hover:bg-blue-600 rounded-t transition-all duration-300"
                      style={{ height: `${barHeight}%`, minHeight: '4px' }}
                    />
                    <div className="text-[11px] font-black text-slate-500 mt-2 truncate w-full text-center">
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </ErpCard>
        </div>

        {/* Sales by Branch */}
        <ErpCard title="المبيعات حسب الفروع" subtitle="توزيع المبيعات الإجمالية على الفروع النشطة">
          <div className="space-y-4 pt-3">
            {salesByBranch.map((branch, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-xs font-black text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{branch.name}</span>
                  </div>
                  <span>{formatCurrency(branch.value)} ({branch.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded transition-all duration-500"
                    style={{ width: `${branch.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ErpCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <ErpCard title="آخر مستندات المبيعات" subtitle="ملخص لأوامر المبيعات التي تم إدخالها حديثاً بالنظام">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-slate-500 font-bold border-b border-slate-100 bg-slate-50/50">
                    <th className="px-3 py-2">رقم المستند</th>
                    <th className="px-3 py-2">العميل</th>
                    <th className="px-3 py-2">مسؤول البيع</th>
                    <th className="px-3 py-2 text-left">القيمة الإجمالية</th>
                    <th className="px-3 py-2 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {recentOrders.map((order, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2 font-mono text-slate-900">{order.id}</td>
                      <td className="px-3 py-2">{order.customerName}</td>
                      <td className="px-3 py-2 text-slate-500 text-[11px]">{order.rep}</td>
                      <td className="px-3 py-2 text-left font-sans font-black text-slate-950">{formatCurrency(order.total)}</td>
                      <td className="px-3 py-2 text-center">{getStatusBadge(order.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ErpCard>
        </div>

        {/* Rep Leaderboard */}
        <ErpCard title="لوحة أداء مناديب البيع" subtitle="مستويات تحقيق مستهدف المبيعات شهرياً">
          <div className="space-y-4 pt-2">
            {repPerformance.map((rep, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50/80 rounded border border-slate-100/50">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-800">{rep.name}</span>
                    <span className="text-[10px] font-black text-slate-400">التحقيق: {rep.percentage}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium mt-1">
                    <span>الهدف: {formatCurrency(rep.target)}</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(rep.achieved)}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        rep.percentage >= 100 ? "bg-emerald-500" : rep.percentage >= 80 ? "bg-blue-500" : "bg-amber-500"
                      )}
                      style={{ width: `${Math.min(100, rep.percentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ErpCard>
      </div>
    </ErpPageLayout>
  );
}
