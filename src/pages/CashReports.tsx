import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Calendar,
  Building2,
  Eye,
  Banknote,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Shift, Warehouse } from '../types';
import { INITIAL_WAREHOUSES } from '../constants';
import { usePOS } from '../context/POSContext';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEffect } from 'react';

export default function CashReports() {
  const { shifts } = usePOS();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  useEffect(() => {
    const qW = query(collection(db, 'warehouses'));
    const unsubscribe = onSnapshot(qW, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
      setWarehouses(docs.length > 0 ? docs : INITIAL_WAREHOUSES);
    });
    return () => unsubscribe();
  }, []);

  const branches = warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1');

  const filteredShifts = shifts.filter(s => {
    const matchesBranch = selectedBranch === 'ALL' || s.branchId === selectedBranch;
    const matchesDate = !selectedDate || s.startDate.startsWith(selectedDate);
    const matchesSearch = s.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesBranch && matchesDate && matchesSearch;
  });

  const getBranchName = (id: string) => {
    return warehouses.find(w => w.id === id)?.name || 'غير معروف';
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">تقارير الكاش والشفتات</h2>
          <p className="text-gray-500 mt-2 font-medium">متابعة الأداء المالي لكل فرع وحركة الورديات</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
           <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text"
                placeholder="رقم الوردية..."
                className="bg-white border border-gray-100 rounded-2xl pr-10 pl-4 py-3 text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           
           <div className="relative">
              <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select 
                className="bg-white border border-gray-100 rounded-2xl pr-10 pl-8 py-3 text-sm font-bold shadow-sm appearance-none cursor-pointer outline-none focus:ring-4 focus:ring-blue-100"
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
                className="bg-white border border-gray-100 rounded-2xl pr-10 pl-4 py-3 text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-100"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-5">
             <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-50">
                <Banknote className="w-7 h-7" />
             </div>
             <div>
                <p className="text-sm text-gray-400 font-black uppercase tracking-widest leading-none mb-1">إجمالي الكاش المستلم</p>
                <p className="text-2xl font-black text-gray-900">{formatCurrency(filteredShifts.reduce((acc, s) => acc + s.totalSalesCash, 0))}</p>
             </div>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-5">
             <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-50">
                <TrendingUp className="w-7 h-7" />
             </div>
             <div>
                <p className="text-sm text-gray-400 font-black uppercase tracking-widest leading-none mb-1">متوسط مبيعات الوردية</p>
                <p className="text-2xl font-black text-gray-900">
                    {formatCurrency(filteredShifts.length > 0 ? filteredShifts.reduce((acc, s) => acc + s.totalSalesCash + s.totalSalesCard, 0) / filteredShifts.length : 0)}
                </p>
             </div>
         </div>
         <div className="bg-red-600 p-8 rounded-[2.5rem] shadow-2xl shadow-red-100 flex items-center gap-5 text-white">
             <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg">
                <TrendingDown className="w-7 h-7" />
             </div>
             <div>
                <p className="text-sm text-red-100 font-black uppercase tracking-widest leading-none mb-1">إجمالي العجز المكتشف</p>
                <p className="text-2xl font-black">
                     {formatCurrency(Math.abs(filteredShifts.reduce((acc, s) => {
                         const diff = s.actualCash - s.closingCash;
                         return diff < 0 ? acc + diff : acc;
                     }, 0)))}
                </p>
             </div>
         </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
               <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">المعرف / الفرع</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">الحالة / الوقت</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">الافتتاحي</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">إجمالي المبيعات</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">الفعلي vs المتوقع</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">الفرق</th>
                     <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {filteredShifts.length === 0 ? (
                    <tr>
                       <td colSpan={7} className="px-8 py-32 text-center">
                          <div className="flex flex-col items-center gap-4 text-gray-300">
                             <Clock className="w-16 h-16 opacity-10" />
                             <p className="font-bold">لا توجد ورديات مسجلة لهذا البحث</p>
                          </div>
                       </td>
                    </tr>
                  ) : filteredShifts.map((s, index) => {
                      const diff = s.actualCash - s.closingCash;
                      return (
                        <motion.tr 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          key={s.id}
                          className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                          onClick={() => setSelectedShift(s)}
                        >
                           <td className="px-8 py-6">
                              <div className="flex flex-col">
                                 <span className="font-mono font-black text-blue-600 text-sm tracking-wider uppercase">{s.id}</span>
                                 <span className="text-sm font-bold text-gray-400">{getBranchName(s.branchId)}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <div className="flex flex-col gap-1">
                                 {s.status === 'OPEN' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 text-green-600 text-sm font-black w-fit">
                                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                       SHIFT OPEN
                                    </span>
                                 ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-sm font-black w-fit">
                                       CLOSED
                                    </span>
                                 )}
                                 <span className="text-sm font-bold text-gray-500">{formatDate(s.startDate)}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6 font-bold text-gray-700 text-sm">
                              {formatCurrency(s.openingCash)}
                           </td>
                           <td className="px-8 py-6">
                              <div className="flex flex-col">
                                 <span className="font-black text-gray-900">{formatCurrency(s.totalSalesCash + s.totalSalesCard)}</span>
                                 <span className="text-sm text-gray-400 font-bold uppercase">Cash: {formatCurrency(s.totalSalesCash)}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <div className="flex flex-col">
                                 <span className="text-sm font-bold text-gray-900 italic">الفعلي: {formatCurrency(s.actualCash)}</span>
                                 <span className="text-sm text-gray-300 font-medium">المتوقع: {formatCurrency(s.closingCash)}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <span className={cn(
                                 "font-black text-sm",
                                 diff === 0 ? "text-gray-400" :
                                 diff > 0 ? "text-green-600" : "text-red-600"
                              )}>
                                 {diff === 0 ? '--' : formatCurrency(diff)}
                              </span>
                           </td>
                           <td className="px-8 py-6 text-left">
                              <button className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                                 <Eye className="w-4 h-4" />
                              </button>
                           </td>
                        </motion.tr>
                      );
                  })}
               </tbody>
            </table>
         </div>
      </div>
      
      {/* Modal for detail view */}
      <AnimatePresence>
        {selectedShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
               onClick={() => setSelectedShift(null)}
            />
            <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="relative w-full max-w-2xl bg-white rounded-[3rem] p-12 shadow-2xl overflow-hidden"
            >
                <div className="flex justify-between items-start mb-10">
                   <div>
                      <h3 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">تفاصيل الوردية</h3>
                      <p className="text-blue-600 font-mono font-extrabold text-sm tracking-wider uppercase">{selectedShift.id}</p>
                   </div>
                   <button onClick={() => setSelectedShift(null)} className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm">
                      <ArrowRight className="w-6 h-6 rotate-180" />
                   </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                   <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col items-center gap-1">
                      <p className="text-sm font-black text-gray-400 uppercase tracking-widest leading-none">الكاش الافتتاحي</p>
                      <p className="text-lg font-black text-gray-900">{formatCurrency(selectedShift.openingCash)}</p>
                   </div>
                   <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col items-center gap-1">
                      <p className="text-sm font-black text-gray-400 uppercase tracking-widest leading-none">مبيعات الكاش</p>
                      <p className="text-lg font-black text-green-600">{formatCurrency(selectedShift.totalSalesCash)}</p>
                   </div>
                   <div className="bg-blue-600 p-8 rounded-[2rem] shadow-xl shadow-blue-100 flex flex-col items-center gap-2 text-white col-span-2">
                       <p className="text-sm font-black text-blue-100 uppercase tracking-widest leading-none">إجمالي الكاش المفترض توفره</p>
                       <p className="text-3xl font-black tracking-tighter">{formatCurrency(selectedShift.closingCash)}</p>
                   </div>
                </div>

                <div className="bg-white border-2 border-dashed border-gray-100 p-8 rounded-[2rem] text-center mb-10">
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest leading-none mb-3">الكاش الفعلي كما صرح الكاشير</p>
                    <p className="text-4xl font-black text-gray-900 tracking-tighter mb-4">{formatCurrency(selectedShift.actualCash)}</p>
                    <div className="h-px w-32 bg-gray-100 mx-auto mb-4"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-gray-400">حالة الجرد (Accounting Status):</span>
                        <div className="flex items-center gap-2 mt-2">
                            {selectedShift.actualCash === selectedShift.closingCash ? (
                                <>
                                    <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <span className="font-black text-green-600">مطابق تماماً</span>
                                </>
                            ) : (
                                <>
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", selectedShift.actualCash > selectedShift.closingCash ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                                        {selectedShift.actualCash > selectedShift.closingCash ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                    </div>
                                    <span className={cn("font-black text-lg", selectedShift.actualCash > selectedShift.closingCash ? "text-green-600" : "text-red-600")}>
                                        {formatCurrency(selectedShift.actualCash - selectedShift.closingCash)}
                                        <span className="text-sm mr-1">({selectedShift.actualCash > selectedShift.closingCash ? 'زيادة' : 'عجز'})</span>
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm font-black text-gray-400 uppercase tracking-widest px-4">
                    <span>Cashier ID: {selectedShift.cashierId}</span>
                    <span>Start: {formatDate(selectedShift.startDate)}</span>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


