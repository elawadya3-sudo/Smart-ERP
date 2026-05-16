import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  Plus, 
  Search, 
  ChevronRight, 
  Settings2, 
  Trash2, 
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { accountingService } from '../../services/accounting';
import { Account } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const load = async () => {
      const data = await accountingService.getAccounts();
      setAccounts(data);
      setLoading(false);
    };
    load();
  }, []);

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'ASSET': return 'أصول';
      case 'LIABILITY': return 'خصوم';
      case 'EQUITY': return 'حقوق ملكية';
      case 'REVENUE': return 'إيرادات';
      case 'EXPENSE': return 'مصاريف';
      default: return type;
    }
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'ASSET': return 'bg-blue-50 text-blue-600';
      case 'LIABILITY': return 'bg-red-50 text-red-600';
      case 'EQUITY': return 'bg-purple-50 text-purple-600';
      case 'REVENUE': return 'bg-green-50 text-green-600';
      case 'EXPENSE': return 'bg-orange-50 text-orange-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const filteredAccounts = accounts.filter(acc => 
    acc.name.includes(searchTerm) || acc.code.includes(searchTerm)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">دليل الحسابات</h2>
          <p className="text-gray-500 mt-1">هيكلة الحسابات المالية وتصنيفاتها الشجرية</p>
        </div>
        <div className="flex gap-4">
           <button className="bg-white text-gray-700 px-6 py-3 rounded-2xl border border-gray-100 font-bold text-sm shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              تصدير إكسل
           </button>
           <button className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" />
              إضافة حساب
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col overflow-hidden">
         <div className="p-8 border-b border-gray-50 bg-gray-50/20">
            <div className="relative max-w-xl">
               <Search className="absolute right-4 top-3.5 w-5 h-5 text-gray-400" />
               <input 
                  type="text" 
                  placeholder="ابحث عن حساب بالاسم أو الكود..."
                  className="w-full bg-white border border-gray-200 rounded-2xl pr-12 pl-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
         </div>
         
         <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
               <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black tracking-widest">
                  <tr className="border-b border-gray-100">
                     <th className="px-8 py-5">كود الحساب</th>
                     <th className="px-8 py-5">اسم الحساب</th>
                     <th className="px-8 py-5">النوع</th>
                     <th className="px-8 py-5">الرصيد الحالي</th>
                     <th className="px-8 py-5">العملة</th>
                     <th className="px-8 py-5 text-left">إجراءات</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    [1,2,3,4,5].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="px-8 py-6 h-12 bg-gray-50/50"></td>
                      </tr>
                    ))
                  ) : filteredAccounts.length === 0 ? (
                    <tr><td colSpan={6} className="py-24 text-center text-gray-400 italic">لا توجد حسابات مطابقة للبحث</td></tr>
                  ) : filteredAccounts.map(acc => (
                    <tr key={acc.id} className="hover:bg-blue-50/20 transition-colors group">
                       <td className="px-8 py-5 font-mono text-sm text-gray-500">{acc.code}</td>
                       <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <Wallet className="w-4 h-4" />
                             </div>
                             <span className="font-bold text-gray-900">{acc.name}</span>
                          </div>
                       </td>
                       <td className="px-8 py-5">
                          <span className={cn("px-3 py-1 rounded-full text-sm font-bold uppercase tracking-tight", getAccountTypeColor(acc.type))}>
                             {getAccountTypeLabel(acc.type)}
                          </span>
                       </td>
                       <td className="px-8 py-5">
                          <span className={cn("font-black", acc.balance >= 0 ? "text-gray-900" : "text-red-500")}>
                             {formatCurrency(acc.balance)}
                          </span>
                       </td>
                       <td className="px-8 py-5 text-gray-500 font-bold">{acc.currency}</td>
                       <td className="px-8 py-5">
                          <div className="flex justify-start gap-2 opacity-0 group-hover:opacity-100 transition-all">
                             <button className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"><Settings2 className="w-4 h-4" /></button>
                             <button className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
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


