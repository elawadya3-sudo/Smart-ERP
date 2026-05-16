import React, { useState, useEffect } from 'react';
import { 
  ArrowUpLeft, 
  ArrowDownRight, 
  Search, 
  Filter, 
  Plus, 
  Wallet, 
  History,
  Building,
  MoreVertical,
  CircleDollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';

type TxType = 'RECEIPT' | 'PAYMENT';

export default function CashTransactionsPage() {
  const [activeTab, setActiveTab] = useState<TxType>('RECEIPT');
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">العمليات النقدية</h2>
          <p className="text-gray-500 mt-1">إدارة الصيرفة، القبض، والدفع النقدي</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
           <button 
             onClick={() => setActiveTab('RECEIPT')}
             className={cn(
               "px-6 py-2 rounded-xl text-sm font-bold transition-all",
               activeTab === 'RECEIPT' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
             )}
           >
             استلام نقدية
           </button>
           <button 
             onClick={() => setActiveTab('PAYMENT')}
             className={cn(
               "px-6 py-2 rounded-xl text-sm font-bold transition-all",
               activeTab === 'PAYMENT' ? "bg-white text-red-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
             )}
           >
             صرف نقدية
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
               <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                     <Wallet className="w-6 h-6" />
                  </div>
                  <button className="text-gray-400 hover:text-gray-900"><MoreVertical className="w-4 h-4" /></button>
               </div>
               <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">رصيد الصندوق الرئيسي</p>
               <h3 className="text-2xl font-black text-gray-900">{formatCurrency(45000)}</h3>
            </div>

            <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-all"></div>
               <p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-4 relative z-10">إجراء سريع</p>
               <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-blue-900/50 hover:bg-blue-700 transition-all relative z-10 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  {activeTab === 'RECEIPT' ? 'إيصال استلام جديد' : 'أمر صرف جديد'}
               </button>
            </div>
         </div>

         <div className="lg:col-span-3">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
               <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/20">
                  <div className="flex items-center gap-3">
                     <History className="w-5 h-5 text-gray-400" />
                     <h4 className="font-bold text-gray-900">سجل {activeTab === 'RECEIPT' ? 'المقبوضات' : 'المدفوعات'} الأخيرة</h4>
                  </div>
                  <div className="relative w-64">
                     <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                     <input type="text" placeholder="بحث..." className="w-full bg-white border border-gray-100 rounded-xl pr-9 pl-4 py-2 text-sm font-bold outline-none" />
                  </div>
               </div>
               
               <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                     <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                        <tr className="border-b border-gray-100">
                           <th className="px-8 py-5">رقم السند</th>
                           <th className="px-8 py-5">من / إلى</th>
                           <th className="px-8 py-5">البيان</th>
                           <th className="px-8 py-5">المبلغ</th>
                           <th className="px-8 py-5">التاريخ</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {/* Mock data for visualization */}
                        {[1, 2, 3, 4, 5].map(i => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                             <td className="px-8 py-5">
                                <span className="font-mono text-sm font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">#TXN-902{i}</span>
                             </td>
                             <td className="px-8 py-5">
                                <div className="flex items-center gap-2">
                                   <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-black">M</div>
                                   <span className="font-bold text-gray-900">شركة المجد للتوريدات</span>
                                </div>
                             </td>
                             <td className="px-8 py-5 text-gray-500 font-medium">دفعة مقدمة تحت الحساب</td>
                             <td className="px-8 py-5">
                                <span className={cn("font-black", activeTab === 'RECEIPT' ? "text-green-600" : "text-red-600")}>
                                   {activeTab === 'RECEIPT' ? '+' : '-'}{formatCurrency(1250 * i)}
                                </span>
                             </td>
                             <td className="px-8 py-5 text-gray-400 text-sm font-medium">{formatDate(new Date().toISOString())}</td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}


