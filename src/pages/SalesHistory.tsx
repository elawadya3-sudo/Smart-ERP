import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Calendar,
  Building2,
  ChevronRight,
  Eye,
  Download,
  CreditCard,
  Banknote,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Order, Warehouse } from '../types';
import { useSearchParams } from 'react-router-dom';
import { INITIAL_WAREHOUSES } from '../constants';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEffect } from 'react';

export default function SalesHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qO = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qO, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(docs);
      setLoading(false);
    });

    const qW = query(collection(db, 'warehouses'));
    const unsubWarehouses = onSnapshot(qW, (snapshot) => {
      setWarehouses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
    });

    return () => {
      unsubOrders();
      unsubWarehouses();
    };
  }, []);

  const branches = warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1');

  const filteredInvoices = orders.filter(inv => {
    // Exclude Expenses from sales history
    if (inv.customerId === 'EXPENSE') return false;

    const matchesSearch = String(inv.id).toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (inv.shiftId && String(inv.shiftId).toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesBranch = selectedBranch === 'ALL' || String(inv.branchId) === String(selectedBranch);
    
    const dateObj = new Date(inv.createdAt && typeof (inv.createdAt as any).toDate === 'function' 
      ? (inv.createdAt as any).toDate() 
      : inv.createdAt);
    const localDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const matchesDate = !selectedDate || localDate === selectedDate;
    
    return matchesSearch && matchesBranch && matchesDate;
  });

  const getBranchName = (id: any) => {
    if (!id) return 'غير محدد';
    return warehouses.find(w => String(w.id) === String(id))?.name || `فرع (${id})`;
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">سجل المبيعات</h2>
          <p className="text-gray-500 mt-2 font-medium">بحث وتتبع فواتير البيع الصادرة من جميع الفروع</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
           <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text"
                placeholder="رقم الفاتورة..."
                className="bg-white border border-gray-100 rounded-2xl pr-10 pl-4 py-3 placeholder:text-gray-300 text-sm font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           
           <div className="relative">
              <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select 
                className="bg-white border border-gray-100 rounded-2xl pr-10 pl-8 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="ALL">جميع الفروع</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
           </div>

           <div className="relative">
              <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="date"
                className="bg-white border border-gray-100 rounded-2xl pr-10 pl-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
           </div>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
             </div>
             <div>
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">إجمالي الفواتير</p>
                <p className="text-xl font-black text-gray-900">{filteredInvoices.length} فاتورة</p>
             </div>
         </div>
         <div className="p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                <Banknote className="w-6 h-6" />
             </div>
             <div>
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">صافي المبيعات</p>
                <p className="text-xl font-black text-gray-900">
                    {formatCurrency(filteredInvoices.reduce((acc, inv) => acc + inv.total, 0))}
                </p>
             </div>
         </div>
         <div className="p-6 bg-blue-600 rounded-[2rem] shadow-xl shadow-blue-100 flex items-center gap-4 text-white">
             <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <Calendar className="w-6 h-6" />
             </div>
             <div>
                <p className="text-sm text-blue-100 font-bold uppercase tracking-widest leading-none mb-1">تاريخ اليوم</p>
                <p className="text-xl font-black">{new Date().toLocaleDateString('ar-EG')}</p>
             </div>
         </div>
      </div>

      {/* Grid List for better visualization */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
               <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">رقم الفاتورة / الوردية</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">الفرع</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">طريقة الدفع</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">إجمالي المبلغ</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">التاريخ والوقت</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                       <td colSpan={6} className="px-8 py-32 text-center">
                          <div className="flex flex-col items-center gap-4 text-gray-300">
                             <FileText className="w-16 h-16 opacity-10" />
                             <p className="font-bold">لا يوجد فواتير مطابقة للبحث</p>
                          </div>
                       </td>
                    </tr>
                  ) : filteredInvoices.map((inv, index) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={inv.id}
                      className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                       <td className="px-8 py-6">
                          <div className="flex flex-col">
                             <span className="font-mono font-bold text-blue-600 text-sm">{inv.id}</span>
                             {inv.shiftId && (
                                <span className="text-sm font-black text-gray-400 font-mono tracking-widest">{inv.shiftId}</span>
                             )}
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                <Building2 className="w-4 h-4" />
                             </div>
                             <span className="font-bold text-gray-700 text-sm">{getBranchName(inv.branchId || '')}</span>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                             {inv.paymentMethod === 'visa' ? (
                               <CreditCard className="w-4 h-4 text-blue-400" />
                             ) : (
                               <Banknote className="w-4 h-4 text-green-400" />
                             )}
                             <span className="text-sm font-bold text-gray-500">
                                {inv.paymentMethod === 'visa' ? 'بطاقة ائتمان' : 'دفع نقدي'}
                             </span>
                          </div>
                       </td>
                       <td className="px-8 py-6 font-black text-gray-900">
                          {formatCurrency(inv.total)}
                       </td>
                       <td className="px-8 py-6">
                          {formatDate(inv.createdAt)}
                       </td>
                       <td className="px-8 py-6 text-left">
                          <button className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                             <Eye className="w-4 h-4" />
                          </button>
                       </td>
                    </motion.tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Invoice Details Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
               onClick={() => setSelectedInvoice(null)}
            />
            <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="relative w-full max-w-2xl bg-white rounded-[3rem] p-12 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-start mb-10">
                 <div>
                    <h3 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">تفاصيل الفاتورة</h3>
                    <p className="text-blue-600 font-mono font-extrabold text-sm tracking-wider uppercase">{selectedInvoice.id}</p>
                 </div>
                 <button onClick={() => setSelectedInvoice(null)} className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm">
                    <ArrowRight className="w-6 h-6 rotate-180" />
                 </button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-10">
                 <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest leading-none mb-3">بيانات الفرع</p>
                    <div className="flex items-center gap-3">
                       <Building2 className="w-5 h-5 text-blue-600" />
                       <span className="font-bold text-gray-800">{getBranchName(selectedInvoice.branchId || '')}</span>
                    </div>
                 </div>
                 <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest leading-none mb-3">طريقة الدفع</p>
                    <div className="flex items-center gap-3">
                       {selectedInvoice.paymentMethod === 'visa' ? <CreditCard className="w-5 h-5 text-blue-400" /> : <Banknote className="w-5 h-5 text-green-500" />}
                       <span className="font-bold text-gray-800">{selectedInvoice.paymentMethod === 'visa' ? 'بطاقة ائتمان' : 'دفع نقدي'}</span>
                    </div>
                 </div>
              </div>

              <div className="space-y-4 mb-10">
                 <p className="text-sm font-black text-gray-400 uppercase tracking-widest px-2">المنتجات المباعة</p>
                 <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-none">
                    {selectedInvoice.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white border border-gray-50 rounded-2xl shadow-sm hover:border-blue-100 transition-colors">
                         <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">{item.quantity}x</span>
                            <span className="font-bold text-gray-800 text-sm">{item.name}</span>
                         </div>
                         <span className="font-bold text-gray-400 text-sm tracking-wider">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white">
                 <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm font-bold text-gray-400 px-1">
                       <span>المجموع الفرعي</span>
                       <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-gray-400 px-1">
                       <span>الضريبة (15%)</span>
                       <span>{formatCurrency(selectedInvoice.tax)}</span>
                    </div>
                 </div>
                 <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                    <span className="text-lg font-black tracking-tight">إجمالي المدفوع</span>
                    <span className="text-3xl font-black tracking-tighter text-blue-400">{formatCurrency(selectedInvoice.total)}</span>
                 </div>
              </div>

              <button className="w-full mt-8 bg-gray-100 text-gray-700 font-bold py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-colors active:scale-95">
                 <Download className="w-5 h-5" />
                 تحميل نسخة الفاتورة (PDF)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


