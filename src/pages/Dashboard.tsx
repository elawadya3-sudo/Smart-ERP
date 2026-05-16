import { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertCircle, 
  Clock, 
  ChevronLeft,
  ShoppingCart
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { motion } from 'motion/react';

const salesData = [
  { name: 'الأحد', sales: 4000 },
  { name: 'الاثنين', sales: 3000 },
  { name: 'الثلاثاء', sales: 2000 },
  { name: 'الأربعاء', sales: 2780 },
  { name: 'الخميس', sales: 1890 },
  { name: 'الجمعة', sales: 2390 },
  { name: 'السبت', sales: 3490 },
];

const topProducts = [
  { name: 'Nike Air Max', sales: 120, revenue: 45000, color: '#3b82f6' },
  { name: 'Adidas Ultraboost', sales: 98, revenue: 38000, color: '#8b5cf6' },
  { name: 'Puma RS-X', sales: 85, revenue: 22000, color: '#f59e0b' },
  { name: 'Jordan 1 Retro', sales: 72, revenue: 64000, color: '#ef4444' },
  { name: 'New Balance 550', sales: 65, revenue: 19000, color: '#10b981' },
];

function StatCard({ title, value, change, trend, icon: Icon, color }: any) {
  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"
    >
      <div className="flex flex-col">
        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-1">{title}</p>
        <div className="flex items-end justify-between">
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">{value}</h3>
          <span className={cn(
            "text-sm font-bold px-2 py-1 rounded",
            trend === 'up' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          )}>
            {trend === 'up' ? '+' : ''}{change}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">لوحة التحكم</h2>
          <p className="text-gray-500 mt-1">مرحباً بك، إليك ملخص مبيعات اليوم</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 font-medium text-sm flex items-center gap-2 hover:bg-gray-50 shadow-sm transition-all">
            <Clock className="w-4 h-4" />
            آخر 7 أيام
          </button>
          <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
            تصدير تقرير
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="مبيعات اليوم" 
          value={formatCurrency(12450)} 
          change="+12.5%" 
          trend="up"
          icon={BarChart3}
          color="bg-blue-600"
        />
        <StatCard 
          title="طلبات جديدة" 
          value="48" 
          change="+8.2%" 
          trend="up"
          icon={ShoppingCart}
          color="bg-purple-600"
        />
        <StatCard 
          title="متوسط قيمة السلة" 
          value={formatCurrency(260)} 
          change="-2.4%" 
          trend="down"
          icon={TrendingUp}
          color="bg-orange-600"
        />
        <StatCard 
          title="مخزون منخفض" 
          value="12 منتج" 
          change="تنبيه" 
          trend="down"
          icon={AlertCircle}
          color="bg-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col"
        >
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold text-gray-900">تحليلات المبيعات الأسبوعية</h4>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                هذا الأسبوع
              </span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#6b7280' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(val) => `${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-bold text-gray-800">الأكثر مبيعاً</h4>
            <button className="text-blue-600 text-sm font-black hover:underline uppercase tracking-widest">عرض الكل</button>
          </div>
          <div className="space-y-4 flex-1">
            {topProducts.map((product, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-all cursor-pointer group">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center p-2 group-hover:bg-white transition-colors">
                  <Package className="text-gray-400 w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <h4 className="text-sm font-bold text-gray-900 truncate">{product.name}</h4>
                  <p className="text-sm text-gray-500 font-bold uppercase tracking-tight">{product.sales} وحدة مباعة</p>
                </div>
                <div className="text-left">
                  <span className="text-sm font-black text-blue-600 block">{formatCurrency(product.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-3 mt-4 text-sm font-bold text-blue-600 border border-blue-50 rounded-xl hover:bg-blue-50 transition-colors uppercase tracking-widest">عرض تقرير المبيعات كاملاً</button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
        >
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
             <h4 className="text-sm font-bold">آخر الفواتير الصادرة</h4>
             <button className="text-sm font-bold text-gray-400 hover:text-blue-600 uppercase tracking-widest">شاهد الكل</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 tracking-widest">الفاتورة</th>
                  <th className="px-6 py-3 tracking-widest">العميل</th>
                  <th className="px-6 py-3 tracking-widest text-left">القيمة</th>
                  <th className="px-6 py-3 tracking-widest text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="group hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-mono font-medium text-gray-900">#INV-882{i}</td>
                    <td className="px-6 py-3 text-gray-600">عميل نقدي</td>
                    <td className="px-6 py-3 text-left font-black text-blue-600">{formatCurrency(750)}</td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-block px-3 py-1 rounded-full bg-green-50 text-green-600 text-sm font-bold">مدفوع</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <h4 className="text-lg font-bold mb-6">التحليل حسب الفئة</h4>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  width={100}
                />
                <Tooltip 
                   cursor={{ fill: 'transparent' }}
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]}>
                  {topProducts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


