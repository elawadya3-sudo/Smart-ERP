import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CircleCheck, 
  Clock,
  FileText,
  Calendar,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { accountingService } from '../../services/accounting';
import { JournalEntry } from '../../types';
import { cn, formatCurrency, formatDate } from '../../lib/utils';

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await accountingService.getJournalEntries();
      setEntries(data);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">قيود اليومية</h2>
          <p className="text-gray-500 mt-1">إدارة واعتماد جميع العمليات المالية والمحاسبية</p>
        </div>
        <button className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
           <Plus className="w-4 h-4" />
           قيد يدوي جديد
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[600px]">
         <div className="p-8 border-b border-gray-50 bg-gray-50/20 flex gap-4">
            <div className="relative flex-1">
               <Search className="absolute right-4 top-3.5 w-5 h-5 text-gray-400" />
               <input 
                  type="text" 
                  placeholder="البحث بالمرجع أو البيان..."
                  className="w-full bg-white border border-gray-200 rounded-2xl pr-12 pl-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
               />
            </div>
            <button className="bg-white border border-gray-200 px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
               <Filter className="w-4 h-4 text-gray-400" />
               تصفية متقدمة
            </button>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
               <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black tracking-widest">
                  <tr className="border-b border-gray-100">
                     <th className="px-8 py-5">رقم القيد</th>
                     <th className="px-8 py-5">التاريخ</th>
                     <th className="px-8 py-5">البيان والشرح</th>
                     <th className="px-8 py-5">إجمالي المبلغ</th>
                     <th className="px-8 py-5">الحالة</th>
                     <th className="px-8 py-5 text-left"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    [1,2,3].map(i => <tr key={i} className="animate-pulse h-20 bg-gray-50/20" />)
                  ) : entries.length === 0 ? (
                    <tr><td colSpan={6} className="py-24 text-center text-gray-400 font-medium italic">لا توجد قيود مسجلة</td></tr>
                  ) : entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-blue-50/20 transition-all group">
                       <td className="px-8 py-6">
                          <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                             #{entry.reference || entry.id.slice(0, 8)}
                          </span>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-2 text-gray-400">
                             <Calendar className="w-3.5 h-3.5" />
                             <span className="font-medium text-sm">{formatDate(entry.date)}</span>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex flex-col">
                             <span className="font-bold text-gray-900 mb-0.5">{entry.description}</span>
                             <span className="text-sm text-gray-400 font-medium">بواسطة: {entry.createdBy || 'النظام'}</span>
                          </div>
                       </td>
                       <td className="px-8 py-6 font-black text-gray-900">
                          {formatCurrency(entry.lines.reduce((sum, l) => sum + l.debit, 0))}
                       </td>
                       <td className="px-8 py-6">
                          <div className={cn(
                            "px-3 py-1 rounded-full w-fit text-sm font-bold uppercase flex items-center gap-1.5 shadow-sm",
                            entry.status === 'POSTED' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
                          )}>
                             {entry.status === 'POSTED' ? <CircleCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                             {entry.status === 'POSTED' ? 'مرحل' : 'مسودة'}
                          </div>
                       </td>
                       <td className="px-8 py-6 text-left">
                          <button className="p-2 text-gray-300 hover:text-gray-900 transition-colors"><MoreVertical className="w-5 h-5" /></button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}


