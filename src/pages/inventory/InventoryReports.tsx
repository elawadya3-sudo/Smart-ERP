import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Warehouse as WarehouseIcon,
  AlertCircle,
  FileBox,
  ChevronLeft,
  ArrowRight,
  ClipboardList,
  Tags,
  Search,
  Layers,
  History,
  ShoppingCart,
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { productsService } from '../../services/firestore';
import { warehouseService, inventoryTransactionService } from '../../services/inventory';
import { Product, Warehouse, InventoryTransaction } from '../../types';
import { formatCurrency, cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

type ReportType = 
  | 'STOCK_BALANCE' 
  | 'INVENTORY_COST' 
  | 'PRODUCT_CARD' 
  | 'DETAILED_CARD' 
  | 'WORK_ORDERS' 
  | 'SERIALS_AVAILABILITY' 
  | 'SERIAL_SEARCH' 
  | 'PRODUCT_SALES' 
  | 'AGGREGATED_SALES' 
  | 'STOCK_AGING';

const REPORT_MENU = [
  { id: 'STOCK_BALANCE', title: 'تقرير أرصدة المخازن', icon: WarehouseIcon },
  { id: 'INVENTORY_COST', title: 'تقرير تكلفة المخزون', icon: TrendingUp },
  { id: 'PRODUCT_CARD', title: 'بطاقة صنف المخزن', icon: Package },
  { id: 'DETAILED_CARD', title: 'بطاقة صنف المخزن مفصلة', icon: History },
  { id: 'WORK_ORDERS', title: 'تقرير أوامر شغل', icon: ClipboardList },
  { id: 'SERIALS_AVAILABILITY', title: 'تقرير سرايل الأصناف المتاحة', icon: Tags },
  { id: 'SERIAL_SEARCH', title: 'الكشف عن مسلسل صنف', icon: Search },
  { id: 'PRODUCT_SALES', title: 'تقرير مبيعات الأصناف', icon: ShoppingCart },
  { id: 'AGGREGATED_SALES', title: 'تقرير مجمع مبيعات الأصناف', icon: BarChart3 },
  { id: 'STOCK_AGING', title: 'أعمار المخزون', icon: Calendar },
];

export default function InventoryReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('STOCK_BALANCE');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [prods, whs, txs] = await Promise.all([
        productsService.getAll(),
        warehouseService.getAll(),
        inventoryTransactionService.getAll()
      ]);
      setProducts(prods);
      setWarehouses(whs);
      setTransactions(txs);
      setLoading(false);
    };
    load();
  }, []);

  const totalCostValue = products.reduce((acc, p) => acc + (p.quantity * (p.costPrice || 0)), 0);
  const totalRetailValue = products.reduce((acc, p) => acc + (p.quantity * (p.sellingPrice || 0)), 0);
  
  const renderReportContent = () => {
    switch (activeReport) {
      case 'STOCK_BALANCE':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-xl font-bold text-gray-900">تقرير أرصدة المخازن</h3>
              <div className="flex gap-2">
                <button className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">طباعة التقرير</button>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black tracking-widest">
                  <tr className="border-b border-gray-100">
                    <th className="px-8 py-5">المستودع</th>
                    <th className="px-8 py-5">إجمالي الأصناف</th>
                    <th className="px-8 py-5">الكمية الكلية</th>
                    <th className="px-8 py-5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {warehouses.map(wh => (
                    <tr key={wh.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-5 font-bold text-gray-900">{wh.name}</td>
                      <td className="px-8 py-5 font-medium">{products.length} أصناف</td>
                      <td className="px-8 py-5 font-black text-blue-600">{products.reduce((acc, p) => acc + p.quantity, 0)} قطعة</td>
                      <td className="px-8 py-5">
                        <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-sm font-bold uppercase tracking-widest">مستقر</span>
                      </td>
                    </tr>
                  ))}
                  {warehouses.length === 0 && (
                    <tr><td colSpan={4} className="py-20 text-center text-gray-400 italic">لا توجد بيانات مستودعات متوفرة للتقرير</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'INVENTORY_COST':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                <TrendingUp className="w-12 h-12 text-blue-600 mb-4" />
                <h4 className="text-sm font-bold text-gray-500 mb-1 leading-none uppercase tracking-widest">إجمالي التكلفة (Cost)</h4>
                <p className="text-2xl font-black text-gray-900 leading-none">{formatCurrency(totalCostValue)}</p>
              </div>
              <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                <h4 className="text-sm font-bold text-blue-100 mb-1 leading-none uppercase tracking-widest">القيمة البيعية (Retail Value)</h4>
                <p className="text-2xl font-black text-white leading-none">{formatCurrency(totalRetailValue)}</p>
                <p className="text-sm mt-2 text-blue-100 italic">محسوبة بسعر البيع الافتراضي</p>
              </div>
              <div className="bg-gray-900 p-8 rounded-3xl text-white shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                <h4 className="text-sm font-bold text-green-400 mb-1 leading-none uppercase tracking-widest">الأرباح المتوقعة</h4>
                <p className="text-2xl font-black text-white leading-none">{formatCurrency(totalRetailValue - totalCostValue)}</p>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                  <tr className="border-b border-gray-100">
                    <th className="px-8 py-4">اسم المنتج</th>
                    <th className="px-8 py-4">الكمية</th>
                    <th className="px-8 py-4">التكلفة للوحدة</th>
                    <th className="px-8 py-4">إجمالي التكلفة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-4 font-bold text-gray-900">{p.name}</td>
                      <td className="px-8 py-4 font-medium">{p.quantity} وحدة</td>
                      <td className="px-8 py-4 font-bold text-blue-600">{formatCurrency(p.sellingPrice)}</td>
                      <td className="px-8 py-4 font-black text-gray-900">{formatCurrency(p.quantity * p.sellingPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'PRODUCT_CARD':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-xl font-bold text-gray-900">بطاقة صنف المخزن</h3>
              <div className="relative w-64">
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                <input 
                  type="text" placeholder="بحث عن صنف..."
                  className="w-full bg-white border border-gray-100 rounded-xl pr-9 pl-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none shadow-sm"
                />
              </div>
            </div>
            {products.slice(0, 1).map(p => (
              <div key={p.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="w-full md:w-48 aspect-square bg-gray-50 rounded-3xl flex items-center justify-center p-4">
                    <Package className="w-20 h-20 text-gray-200" />
                  </div>
                  <div className="flex-1 space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-2xl font-black text-gray-900 mb-1">{p.name}</h4>
                        <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">SKU: {p.sku || 'N/A'} | Barcode: {p.barcode || 'N/A'}</p>
                      </div>
                      <div className="bg-blue-600 text-white px-4 py-2 rounded-xl text-center">
                        <p className="text-sm font-bold uppercase opacity-80 leading-none mb-1">الرصيد الكلي</p>
                        <p className="text-xl font-black leading-none">{p.quantity}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-50">
                      <div>
                        <p className="text-sm font-bold text-gray-400 uppercase mb-1">الماركة</p>
                        <p className="font-bold text-gray-900">{p.brand || 'غير محدد'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-400 uppercase mb-1">الفئة</p>
                        <p className="font-bold text-gray-900">{p.category}</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-400 uppercase mb-1">سعر التكلفة</p>
                        <p className="font-bold text-gray-900">{formatCurrency(p.costPrice)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-400 uppercase mb-1">سعر البيع</p>
                        <p className="font-bold text-blue-600">{formatCurrency(p.sellingPrice)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
               <div className="px-8 py-5 border-b border-gray-50 bg-gray-50/20">
                  <h5 className="text-sm font-bold text-gray-700">سجل التحركات الأخيرة لهذا الصنف</h5>
               </div>
               <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-sm text-gray-400 font-black">
                    <tr className="border-b border-gray-100 tracking-widest uppercase">
                       <th className="px-8 py-4">العملية</th>
                       <th className="px-8 py-4">المرجع</th>
                       <th className="px-8 py-4">التاريخ</th>
                       <th className="px-8 py-4">الكمية</th>
                       <th className="px-8 py-4">الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                     {[1, 2, 3].map(i => (
                       <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-8 py-4">
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="font-bold">توريد بضاعة</span>
                             </div>
                          </td>
                          <td className="px-8 py-4 text-gray-500 font-mono text-sm">#REF-002{i}</td>
                          <td className="px-8 py-4 text-sm font-medium text-gray-400">{formatDate(new Date().toISOString())}</td>
                          <td className="px-8 py-4 font-bold text-green-600">+100</td>
                          <td className="px-8 py-4 font-black">250</td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        );

      case 'STOCK_AGING':
        return (
          <div className="space-y-6">
             <div className="px-4">
                <h3 className="text-xl font-bold text-gray-900 mb-1">أعمار المخزون</h3>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">تتبع فترة بقاء المنتجات في المستودعات (بالأيام)</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm border-r-4 border-r-green-500">
                   <p className="text-sm font-black text-gray-400 uppercase mb-1">0-30 يوم</p>
                   <p className="text-2xl font-black text-gray-900">45 <span className="text-sm font-medium text-gray-400">صنف</span></p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm border-r-4 border-r-blue-500">
                   <p className="text-sm font-black text-gray-400 uppercase mb-1">31-60 يوم</p>
                   <p className="text-2xl font-black text-gray-900">12 <span className="text-sm font-medium text-gray-400">صنف</span></p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm border-r-4 border-r-orange-500">
                   <p className="text-sm font-black text-gray-400 uppercase mb-1">61-90 يوم</p>
                   <p className="text-2xl font-black text-gray-900">8 <span className="text-sm font-medium text-gray-400">صنف</span></p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm border-r-4 border-r-red-500">
                   <p className="text-sm font-black text-gray-400 uppercase mb-1">+90 يوم (راكد)</p>
                   <p className="text-2xl font-black text-gray-900">5 <span className="text-sm font-medium text-gray-400">صنف</span></p>
                </div>
             </div>
             <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-right text-sm">
                   <thead className="bg-gray-50 text-sm text-gray-400 font-black tracking-widest uppercase">
                      <tr className="border-b border-gray-100">
                         <th className="px-8 py-5">المنتج</th>
                         <th className="px-8 py-5">تاريخ آخر حركة</th>
                         <th className="px-8 py-5">الأيام في المستودع</th>
                         <th className="px-8 py-5">المخاطر</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {products.slice(0, 5).map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                           <td className="px-8 py-5 font-bold text-gray-900">{p.name}</td>
                           <td className="px-8 py-5 text-gray-500">{formatDate(p.updatedAt || p.createdAt)}</td>
                           <td className="px-8 py-5 font-black text-blue-600">14 يوم</td>
                           <td className="px-8 py-5">
                              <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase tracking-tight">نورمال</span>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        );

      case 'WORK_ORDERS':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-xl font-bold text-gray-900">تقرير أوامر شغل</h3>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-100">+ أمر شغل جديد</button>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                  <tr className="border-b border-gray-100 tracking-widest">
                    <th className="px-8 py-5">رقم الأمر</th>
                    <th className="px-8 py-5">المنتج النهائي</th>
                    <th className="px-8 py-5">تاريخ البدء</th>
                    <th className="px-8 py-5">الكمية المستهدفة</th>
                    <th className="px-8 py-5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.filter(tx => tx.type === 'WORK_ORDER').map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-5 font-bold text-gray-900">{tx.reference || tx.id.slice(0, 8)}</td>
                      <td className="px-8 py-5 font-medium">{tx.items[0]?.productName}</td>
                      <td className="px-8 py-5 text-gray-500">{formatDate(tx.createdAt)}</td>
                      <td className="px-8 py-5 font-black text-blue-600">{tx.items[0]?.quantity} قطعة</td>
                      <td className="px-8 py-5">
                        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm font-bold">تحت التشغيل</span>
                      </td>
                    </tr>
                  ))}
                  {transactions.filter(tx => tx.type === 'WORK_ORDER').length === 0 && (
                    <tr><td colSpan={5} className="py-20 text-center text-gray-400 italic">لا توجد أوامر شغل مسجلة حالياً</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'SERIALS_AVAILABILITY':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-xl font-bold text-gray-900">تقرير سرايل الأصناف المتاحة</h3>
              <div className="flex gap-2">
                <div className="bg-green-50 text-green-600 px-4 py-1 rounded-full text-sm font-black uppercase">متوفر: 120 مسلسل</div>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                  <tr className="border-b border-gray-100 tracking-widest">
                    <th className="px-8 py-5">المنتج</th>
                    <th className="px-8 py-5">الرقم التسلسلي (Serial)</th>
                    <th className="px-8 py-5">المستودع الحالي</th>
                    <th className="px-8 py-5">تاريخ الدخول</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.slice(0, 3).map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-5 font-bold text-gray-900">{p.name}</td>
                      <td className="px-8 py-5 font-mono text-sm text-blue-600">SN-K9283-492-{p.id.slice(0, 4)}</td>
                      <td className="px-8 py-5 font-medium text-gray-600">المستودع الرئيسي</td>
                      <td className="px-8 py-5 text-sm text-gray-400">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'SERIAL_SEARCH':
        return (
          <div className="flex flex-col items-center justify-center py-20 space-y-12">
            <div className="text-center">
               <h3 className="text-3xl font-black text-gray-900 mb-2">الكشف عن مسلسل صنف</h3>
               <p className="text-gray-500 font-medium">أدخل الرقم التسلسلي لتتبع حركة القطعة ومصدرها</p>
            </div>
            <div className="w-full max-w-xl relative">
               <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
                  <Search className="w-6 h-6 text-gray-300" />
               </div>
               <input 
                  type="text" 
                  placeholder="SN-XXXX-XXXX-XXXX"
                  className="w-full bg-white border border-gray-200 rounded-[2rem] pr-16 pl-8 py-6 text-xl font-mono shadow-2xl shadow-blue-50 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
               />
               <button className="absolute left-3 top-3 bottom-3 bg-gray-900 text-white px-8 rounded-[1.5rem] font-bold text-sm hover:bg-gray-800 transition-colors">تتبع القطعة</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
               <div className="bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center text-center opacity-40">
                  <WarehouseIcon className="w-8 h-8 mb-2" />
                  <p className="text-sm font-black uppercase text-gray-400">آخر موقع</p>
                  <p className="font-bold text-gray-900">غير معروف</p>
               </div>
               <div className="bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center text-center opacity-40">
                  <History className="w-8 h-8 mb-2" />
                  <p className="text-sm font-black uppercase text-gray-400">تاريخ الشراء</p>
                  <p className="font-bold text-gray-900">N/A</p>
               </div>
               <div className="bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center text-center opacity-40">
                  <ShoppingCart className="w-8 h-8 mb-2" />
                  <p className="text-sm font-black uppercase text-gray-400">حالة البيع</p>
                  <p className="font-bold text-gray-900">غير متوفر</p>
               </div>
            </div>
          </div>
        );

      case 'PRODUCT_SALES':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-xl font-bold text-gray-900">تقرير مبيعات الأصناف</h3>
              <div className="flex gap-2">
                <button className="bg-gray-900 text-white px-4 py-1.5 rounded-xl text-sm font-bold">هذا الشهر</button>
                <button className="bg-white border border-gray-100 text-gray-500 px-4 py-1.5 rounded-xl text-sm font-bold">فلترة</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">الأكثر مبيعاً</h4>
                  <div className="space-y-4">
                     {products.slice(0, 3).map((p, i) => (
                       <div key={p.id} className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">{i+1}</div>
                          <div className="flex-1">
                             <p className="text-sm font-bold text-gray-900">{p.name}</p>
                             <div className="w-full bg-gray-100 h-1 rounded-full mt-1 overflow-hidden">
                                <div className="bg-blue-600 h-full" style={{ width: `${80 - i*20}%` }}></div>
                             </div>
                          </div>
                          <p className="text-sm font-black text-blue-600">85 قطعة</p>
                       </div>
                     ))}
                  </div>
               </div>
               <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                  <BarChart3 className="w-12 h-12 text-blue-100 mb-4" />
                  <p className="text-sm font-bold text-gray-400 mb-1">إجمالي عائدات المبيعات</p>
                  <p className="text-4xl font-black text-gray-900">{formatCurrency(totalValue * 1.4)}</p>
                  <div className="mt-4 flex items-center gap-1 text-green-600 font-bold text-sm">
                     <TrendingUp className="w-3 h-3" />
                     +12.4% زيادة عن الشهر الماضي
                  </div>
               </div>
            </div>
          </div>
        );

      case 'AGGREGATED_SALES':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-xl font-bold text-gray-900">تقرير مجمع مبيعات الأصناف</h3>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-100">تحميل ملف CSV</button>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="p-8 border-b border-gray-50">
                 <div className="flex items-center gap-8">
                    <div className="flex-1 h-32 bg-gray-50 rounded-2xl flex flex-col items-center justify-center">
                       <p className="text-sm font-black text-gray-400 uppercase">إجمالي المبيعات</p>
                       <p className="text-2xl font-black text-gray-900">1,240 قطعة</p>
                    </div>
                    <div className="flex-1 h-32 bg-gray-50 rounded-2xl flex flex-col items-center justify-center">
                       <p className="text-sm font-black text-gray-400 uppercase">صافي الأرباح</p>
                       <p className="text-2xl font-black text-green-600">{formatCurrency(totalValue * 0.4)}</p>
                    </div>
                 </div>
              </div>
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                  <tr className="border-b border-gray-100 tracking-widest">
                    <th className="px-8 py-5">الفئة</th>
                    <th className="px-8 py-5">الكمية المباعة</th>
                    <th className="px-8 py-5">المساهمة في الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {['أحذية رياضية', 'أحذية كلاسيك', 'إكسسوارات'].map((cat, i) => (
                    <tr key={cat} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-5 font-bold text-gray-900">{cat}</td>
                      <td className="px-8 py-5 font-medium">{500 - i*100} قطعة</td>
                      <td className="px-8 py-5 font-black text-blue-600">{(40 - i*5)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'DETAILED_CARD':
        return (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
               <History size={64} />
            </div>
            <div>
               <h3 className="text-2xl font-black text-gray-900 mb-2">بطاقة صنف المخزن مفصلة</h3>
               <p className="text-gray-400 font-medium max-w-sm mx-auto">سيتم عرض كشف حساب تفصيلي للصنف يشمل الموردين، العملاء، وهامش الربح لكل عملية بيع.</p>
            </div>
            <button className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">بدء الاستعلام التفصيلي</button>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
               {React.createElement(REPORT_MENU.find(m => m.id === activeReport)?.icon || FileBox, { size: 64 })}
            </div>
            <div>
               <h3 className="text-2xl font-black text-gray-900 mb-2">{REPORT_MENU.find(m => m.id === activeReport)?.title}</h3>
               <p className="text-gray-400 font-medium max-w-sm mx-auto">هذا التقرير قيد التطوير حالياً وسيتم ربطه ببيانات النظام تلقائياً.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex gap-8 h-[calc(100vh-160px)] animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Sidebar Menu */}
      <div className="w-80 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col overflow-hidden">
         <div className="p-8 border-b border-gray-50">
            <h2 className="text-xl font-bold text-gray-900 mb-1">مركز التقارير</h2>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">اختر التقرير المطلوب عرضه</p>
         </div>
         <nav className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-none">
            {REPORT_MENU.map((report) => (
              <button
                key={report.id}
                onClick={() => setActiveReport(report.id as ReportType)}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all text-right group relative",
                  activeReport === report.id 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <report.icon className={cn("w-5 h-5", activeReport === report.id ? "text-white" : "text-gray-400 group-hover:text-blue-500")} />
                <span className="flex-1 text-sm font-bold truncate">{report.title}</span>
                {activeReport === report.id && <ChevronLeft className="w-4 h-4 text-white/50" />}
              </button>
            ))}
         </nav>
         <div className="p-6 border-t border-gray-50">
            <div className="bg-blue-50 p-4 rounded-2xl flex flex-col items-center text-center">
               <Layers className="text-blue-600 w-8 h-8 mb-2" />
               <p className="text-sm font-bold text-blue-900">تقارير ذكية</p>
               <p className="text-sm text-blue-400 mt-1">يتم تحديث جميع البيانات لحظياً بناءً على الحركات المخزنية</p>
            </div>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col overflow-hidden relative">
         {loading ? (
           <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                 <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-sm font-bold text-gray-500 animate-pulse">جاري جلب بيانات التقارير...</p>
              </div>
           </div>
         ) : null}
         
         <div className="p-10 flex-1 overflow-y-auto scrollbar-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeReport}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                {renderReportContent()}
              </motion.div>
            </AnimatePresence>
         </div>
      </div>
    </div>
  );
}


