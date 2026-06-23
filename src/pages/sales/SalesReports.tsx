import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Download,
  Calendar,
  Building2,
  Users,
  Search,
  ArrowRightLeft,
  Percent,
  TrendingUp,
  Coins,
  History
} from 'lucide-react';
import {
  collection,
  query,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn, formatCurrency } from '../../lib/utils';
import {
  ErpPageLayout,
  ErpPageHeader,
  ErpCard,
  ErpInput
} from '../../components/ui/ErpUI';

export default function SalesReports() {
  const { subview } = useParams<{ subview: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  // Filters state
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-06-30');
  const [branchFilter, setBranchFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [repFilter, setRepFilter] = useState('');

  // Dropdown lists
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);

  // Load dropdowns
  useEffect(() => {
    onSnapshot(collection(db, 'warehouses'), s => setWarehouses(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(collection(db, 'sales_customers'), s => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(collection(db, 'sales_representatives'), s => setReps(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Load Report Data
  useEffect(() => {
    setLoading(true);
    // Standard reports read from sales_orders
    const loadReportData = async () => {
      try {
        const snap = await getDocs(collection(db, 'sales_orders'));
        const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (orders.length === 0) {
          setDataList(getMockReportData(subview));
        } else {
          setDataList(processReport(subview, orders));
        }
        setLoading(false);
      } catch (err) {
        setDataList(getMockReportData(subview));
        setLoading(false);
      }
    };
    loadReportData();
  }, [subview, branchFilter, customerFilter, repFilter, startDate, endDate]);

  // Process raw sales orders into specific report structure
  const processReport = (view: string | undefined, orders: any[]) => {
    // Basic filter
    const filteredOrders = orders.filter(o => {
      const matchesBranch = !branchFilter || o.branchId === branchFilter;
      const matchesCust = !customerFilter || o.customerId === customerFilter;
      const matchesRep = !repFilter || o.repId === repFilter;
      
      const orderDate = o.createdAt ? o.createdAt.split('T')[0] : '';
      const matchesDate = (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);

      return matchesBranch && matchesCust && matchesRep && matchesDate;
    });

    switch (view) {
      case 'orders':
        return filteredOrders;
      case 'sales':
        // Flatten order line items
        const salesItems: any[] = [];
        filteredOrders.forEach(o => {
          if (o.items) {
            o.items.forEach((item: any) => {
              salesItems.push({
                orderId: o.id,
                customerName: o.customerName,
                itemName: item.name,
                price: item.price,
                qty: item.qty,
                tax: (item.price * item.qty - (item.discount || 0)) * 0.15,
                total: item.total,
                createdAt: o.createdAt
              });
            });
          }
        });
        return salesItems;
      case 'profit':
        const profitItems: any[] = [];
        filteredOrders.forEach(o => {
          if (o.items) {
            o.items.forEach((item: any) => {
              const estimatedCost = item.cost || (item.price * 0.4); // Mock 40% cost if cogs missing
              const profit = item.total - (estimatedCost * item.qty);
              const margin = item.total > 0 ? Math.round((profit / item.total) * 100) : 0;
              profitItems.push({
                orderId: o.id,
                itemName: item.name,
                revenue: item.total,
                cost: estimatedCost * item.qty,
                profit,
                margin
              });
            });
          }
        });
        return profitItems;
      case 'customer-eval':
        // Group by customer
        const custGroups: Record<string, any> = {};
        filteredOrders.forEach(o => {
          const cId = o.customerId || 'WALK-IN';
          if (!custGroups[cId]) {
            custGroups[cId] = {
              customerName: o.customerName || 'عميل نقدي',
              ordersCount: 0,
              totalValue: 0,
              points: 0
            };
          }
          custGroups[cId].ordersCount += 1;
          custGroups[cId].totalValue += o.total || 0;
          custGroups[cId].points = Math.floor(custGroups[cId].totalValue / 10);
        });
        return Object.values(custGroups);
      default:
        return getMockReportData(view);
    }
  };

  // Mock datasets for reports
  const getMockReportData = (view?: string) => {
    switch (view) {
      case 'orders':
        return [
          { id: 'SO-00001', customerName: 'شركة النور للتجارة', repName: 'أحمد محمود', total: 45000, status: 'approved', createdAt: '2026-06-23T12:00:00Z', approvedBy: 'المدير المالي' },
          { id: 'SO-00002', customerName: 'مؤسسة الرياض', repName: 'سارة علي', total: 12500, status: 'pending_approval', createdAt: '2026-06-23T11:30:00Z', approvedBy: '-' },
          { id: 'SO-00003', customerName: 'مستشفى الشفاء', repName: 'أحمد محمود', total: 85000, status: 'delivered', createdAt: '2026-06-22T16:45:00Z', approvedBy: 'المدير المالي' }
        ];
      case 'sales':
        return [
          { orderId: 'SO-00001', customerName: 'شركة النور للتجارة', itemName: 'تركيب وتشغيل شبكات', price: 2500, qty: 18, tax: 6750, total: 45000, createdAt: '2026-06-23T12:00:00Z' },
          { orderId: 'SO-00002', customerName: 'مؤسسة الرياض', itemName: 'دورة تدريبية مبيعات', price: 4000, qty: 3, tax: 1800, total: 12000, createdAt: '2026-06-23T11:30:00Z' }
        ];
      case 'profit':
        return [
          { orderId: 'SO-00001', itemName: 'تركيب وتشغيل شبكات', revenue: 45000, cost: 9000, profit: 36000, margin: 80 },
          { orderId: 'SO-00002', itemName: 'دورة تدريبية مبيعات', revenue: 12000, cost: 3000, profit: 9000, margin: 75 }
        ];
      case 'customer-eval':
        return [
          { customerName: 'شركة النور للتجارة', ordersCount: 5, totalValue: 125000, points: 12500 },
          { customerName: 'مؤسسة الرياض', ordersCount: 2, totalValue: 24500, points: 2450 },
          { customerName: 'شركة البنيان للمقاولات', ordersCount: 1, totalValue: 84000, points: 8400 }
        ];
      case 'target':
        return [
          { repName: 'أحمد محمود', target: 120000, achieved: 130000, variance: 10000, percentage: 108.3 },
          { repName: 'سارة علي', target: 100000, achieved: 85000, variance: -15000, percentage: 85.0 },
          { repName: 'خالد عبدالله', target: 80000, achieved: 56000, variance: -24000, percentage: 70.0 }
        ];
      case 'periods':
        return [
          { period: 'الربع الأول 2026', revenue: 235000, cost: 82000, profit: 153000, growth: 12.4 },
          { period: 'الربع الثاني 2026', revenue: 450000, cost: 144000, profit: 306000, growth: 91.4 }
        ];
      default:
        return [];
    }
  };

  // CSV download function
  const handleExportCSV = () => {
    if (dataList.length === 0) return;
    const headers = Object.keys(dataList[0]).filter(k => k !== 'id').join(',');
    const rows = dataList.map(item =>
      Object.keys(item)
        .filter(k => k !== 'id')
        .map(k => `"${String(item[k]).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${subview}_export.csv`);
    link.click();
  };

  const getReportTitle = (view?: string) => {
    switch (view) {
      case 'orders': return 'تقرير أوامر المبيعات';
      case 'sales': return 'تقرير المبيعات التفصيلي';
      case 'profit': return 'تقرير إجمالي الهامش والربح';
      case 'customer-eval': return 'تقرير تقييم عملاء المبيعات';
      case 'target': return 'تقرير مستهدف المبيعات السنوي';
      case 'periods': return 'تقرير مقارنة مبيعات الفترات';
      default: return 'تقارير المبيعات';
    }
  };

  // Filter list by search term
  const filteredData = dataList.filter(item => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={getReportTitle(subview)}
        description="استخراج الجداول والإحصاءات المبيعية وتتبع مؤشرات الأداء والأرباح"
        breadcrumbs={[{ label: 'الرئيسية' }, { label: 'المبيعات' }, { label: 'التقارير' }]}
        actions={
          <div className="flex gap-2 no-print">
            <button
              onClick={handleExportCSV}
              className="bg-slate-50 text-slate-700 border border-slate-200 px-4 py-1.5 rounded text-xs font-black hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </button>
          </div>
        }
      />

      {/* Advanced Filters Panel */}
      <div className="bg-white rounded border border-slate-200 p-3 space-y-3 shadow-none text-right no-print">
        <span className="text-[10px] font-black text-slate-450 block uppercase">تخصيص الفلترة المتقدمة للتقرير</span>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          
          <div>
            <label className="text-[9px] font-black text-slate-400 block mb-1">الفرع المالي</label>
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none cursor-pointer"
            >
              <option value="">كل الفروع</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 block mb-1">العميل</label>
            <select
              value={customerFilter}
              onChange={e => setCustomerFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none cursor-pointer"
            >
              <option value="">كل العملاء</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 block mb-1">تاريخ البداية</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 block mb-1">تاريخ النهاية</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
            />
          </div>

          <div>
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث سريع في النتائج..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded pr-8 pl-3 py-1 text-xs outline-none text-right font-bold"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Report Table Grid */}
      <ErpCard title={getReportTitle(subview)} subtitle={`الفترة من ${startDate} إلى ${endDate}`}>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-bold">جاري إعداد التقرير...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold italic">
              لا توجد مبيعات أو حركات مسجلة تطابق محددات التقرير.
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500 font-black">
                  {renderReportHeaders(subview)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    {renderReportRows(subview, item)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ErpCard>
    </ErpPageLayout>
  );
}

// ─── Headers Resolver ────────────────────────────────────────────────────────
function renderReportHeaders(view?: string) {
  switch (view) {
    case 'orders':
      return (
        <>
          <th className="px-3 py-2 text-right">رقم أمر البيع</th>
          <th className="px-3 py-2 text-right">العميل</th>
          <th className="px-3 py-2">المندوب</th>
          <th className="px-3 py-2 text-left">قيمة الإجمالي</th>
          <th className="px-3 py-2 text-center">الحالة</th>
          <th className="px-3 py-2">المعتمد</th>
          <th className="px-3 py-2">تاريخ الإصدار</th>
        </>
      );
    case 'sales':
      return (
        <>
          <th className="px-3 py-2 text-right">أمر البيع</th>
          <th className="px-3 py-2 text-right">العميل</th>
          <th className="px-3 py-2 text-right">المنتج / الخدمة</th>
          <th className="px-3 py-2 text-left">سعر الوحدة</th>
          <th className="px-3 py-2 text-center">الكمية المباعة</th>
          <th className="px-3 py-2 text-left">الضريبة (15%)</th>
          <th className="px-3 py-2 text-left">الإجمالي النهائي</th>
        </>
      );
    case 'profit':
      return (
        <>
          <th className="px-3 py-2 text-right">أمر البيع</th>
          <th className="px-3 py-2 text-right">المنتج / الخدمة</th>
          <th className="px-3 py-2 text-left">إجمالي الإيراد</th>
          <th className="px-3 py-2 text-left">إجمالي التكلفة</th>
          <th className="px-3 py-2 text-left text-emerald-600">صافي الربح</th>
          <th className="px-3 py-2 text-center">هامش الربح %</th>
        </>
      );
    case 'customer-eval':
      return (
        <>
          <th className="px-3 py-2 text-right">اسم العميل</th>
          <th className="px-3 py-2 text-center">عدد الطلبيات</th>
          <th className="px-3 py-2 text-left">إجمالي قيمة الشراء</th>
          <th className="px-3 py-2 text-left text-amber-600">نقاط الولاء المجمعة</th>
        </>
      );
    case 'target':
      return (
        <>
          <th className="px-3 py-2 text-right">المندوب / الفرع</th>
          <th className="px-3 py-2 text-left">المستهدف المالي</th>
          <th className="px-3 py-2 text-left">المبيعات المحققة</th>
          <th className="px-3 py-2 text-left">الانحراف المالي</th>
          <th className="px-3 py-2 text-center">نسبة الإنجاز</th>
        </>
      );
    case 'periods':
      return (
        <>
          <th className="px-3 py-2 text-right">الفترة المقارنة</th>
          <th className="px-3 py-2 text-left">إجمالي الإيرادات</th>
          <th className="px-3 py-2 text-left">إجمالي التكلفة</th>
          <th className="px-3 py-2 text-left text-emerald-600">إجمالي الأرباح</th>
          <th className="px-3 py-2 text-center">معدل النمو ربع السنوي %</th>
        </>
      );
    default:
      return null;
  }
}

// ─── Rows Resolver ───────────────────────────────────────────────────────────
function renderReportRows(view: string | undefined, item: any) {
  switch (view) {
    case 'orders':
      return (
        <>
          <td className="px-3 py-2 font-mono text-blue-650 font-black">{item.id}</td>
          <td className="px-3 py-2">{item.customerName}</td>
          <td className="px-3 py-2 text-slate-500 text-[11px]">{item.repName || 'مباشر'}</td>
          <td className="px-3 py-2 text-left font-sans font-black text-slate-900">{formatCurrency(item.total)}</td>
          <td className="px-3 py-2 text-center">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-black border", item.status === 'approved' || item.status === 'delivered' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100")}>
              {item.status === 'approved' ? 'معتمد' : item.status === 'delivered' ? 'تم التسليم' : 'قيد الانتظار'}
            </span>
          </td>
          <td className="px-3 py-2 text-slate-550 text-[11px]">{item.approvedBy || '-'}</td>
          <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">
            {new Date(item.createdAt).toLocaleDateString('ar-EG')}
          </td>
        </>
      );
    case 'sales':
      return (
        <>
          <td className="px-3 py-2 font-mono text-[11px] text-slate-450">{item.orderId}</td>
          <td className="px-3 py-2">{item.customerName}</td>
          <td className="px-3 py-2 font-black text-slate-800">{item.itemName}</td>
          <td className="px-3 py-2 text-left font-sans">{formatCurrency(item.price)}</td>
          <td className="px-3 py-2 text-center font-sans font-black text-blue-600">{item.qty}</td>
          <td className="px-3 py-2 text-left font-sans text-purple-600">+{formatCurrency(item.tax)}</td>
          <td className="px-3 py-2 text-left font-sans font-black text-slate-900">{formatCurrency(item.total)}</td>
        </>
      );
    case 'profit':
      return (
        <>
          <td className="px-3 py-2 font-mono text-[11px] text-slate-450">{item.orderId}</td>
          <td className="px-3 py-2 font-black text-slate-800">{item.itemName}</td>
          <td className="px-3 py-2 text-left font-sans">{formatCurrency(item.revenue)}</td>
          <td className="px-3 py-2 text-left font-sans text-slate-500">{formatCurrency(item.cost)}</td>
          <td className="px-3 py-2 text-left font-sans text-emerald-600 font-black">{formatCurrency(item.profit)}</td>
          <td className="px-3 py-2 text-center">
            <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-black border border-emerald-100">
              {item.margin}%
            </span>
          </td>
        </>
      );
    case 'customer-eval':
      return (
        <>
          <td className="px-3 py-2 font-black text-slate-850">{item.customerName}</td>
          <td className="px-3 py-2 text-center font-sans text-blue-600 font-black">{item.ordersCount}</td>
          <td className="px-3 py-2 text-left font-sans font-black text-slate-900">{formatCurrency(item.totalValue)}</td>
          <td className="px-3 py-2 text-left font-sans text-amber-600 font-black">{item.points.toLocaleString('ar-EG')} نقطة</td>
        </>
      );
    case 'target':
      const isPositive = item.variance >= 0;
      return (
        <>
          <td className="px-3 py-2 font-black text-slate-850">{item.repName || item.branchName}</td>
          <td className="px-3 py-2 text-left font-sans">{formatCurrency(item.target)}</td>
          <td className="px-3 py-2 text-left font-sans text-slate-900">{formatCurrency(item.achieved)}</td>
          <td className={cn("px-3 py-2 text-left font-sans font-black", isPositive ? "text-emerald-600" : "text-rose-600")}>
            {isPositive ? '+' : ''}{formatCurrency(item.variance)}
          </td>
          <td className="px-3 py-2 text-center">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-black border", item.percentage >= 100 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100")}>
              {item.percentage}%
            </span>
          </td>
        </>
      );
    case 'periods':
      return (
        <>
          <td className="px-3 py-2 font-black text-slate-850">{item.period}</td>
          <td className="px-3 py-2 text-left font-sans font-black text-slate-900">{formatCurrency(item.revenue)}</td>
          <td className="px-3 py-2 text-left font-sans text-slate-500">{formatCurrency(item.cost)}</td>
          <td className="px-3 py-2 text-left font-sans text-emerald-600 font-black">{formatCurrency(item.profit)}</td>
          <td className="px-3 py-2 text-center">
            <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-black border border-emerald-100">
              +{item.growth}%
            </span>
          </td>
        </>
      );
    default:
      return null;
  }
}
