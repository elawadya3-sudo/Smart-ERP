import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Wallet, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText,
  Building2,
  Users2,
  TrendingUp,
  History as HistoryIcon,
  Scale,
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, cn } from '../../lib/utils';
import { accountingService } from '../../services/accounting';
import { Account, JournalEntry } from '../../types';

export default function AccountingDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [accs, entryData] = await Promise.all([
        accountingService.getAccounts(),
        accountingService.getJournalEntries()
      ]);
      setAccounts(accs);
      setEntries(entryData);
      setLoading(false);
    };
    load();
  }, []);

  const totalAssets = accounts.filter(a => a.type === 'ASSET').reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === 'LIABILITY').reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">النظام المحاسبي</h2>
          <p className="text-gray-500 mt-1">الإدارة المالية، القيود اليومية، والتقارير الختامية</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <button className="bg-white text-gray-700 px-6 py-3 rounded-2xl border border-gray-100 font-bold text-sm shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-600" />
            ميزان المراجعة
          </button>
          <button className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" />
            قيد يومية جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
           <p className="text-sm font-black text-gray-400 uppercase tracking-widest relative z-10 mb-1">إجمالي الأصول</p>
           <h3 className="text-2xl font-black text-gray-900 relative z-10">{formatCurrency(totalAssets)}</h3>
           <p className="text-sm text-green-600 font-bold mt-2 flex items-center gap-1">
             <TrendingUp className="w-3 h-3" />
             +12.5% عن الشهر الماضي
           </p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
           <p className="text-sm font-black text-gray-400 uppercase tracking-widest relative z-10 mb-1">إجمالي الالتزامات</p>
           <h3 className="text-2xl font-black text-gray-900 relative z-10">{formatCurrency(totalLiabilities)}</h3>
           <p className="text-sm text-gray-400 font-medium mt-2">مستقر</p>
        </div>
        <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
           <p className="text-sm font-black text-blue-400 uppercase tracking-widest relative z-10 mb-1">صافي الربح / الخسارة</p>
           <h3 className="text-2xl font-black text-white relative z-10">{formatCurrency(totalAssets - totalLiabilities)}</h3>
           <div className="w-full bg-white/10 h-1 rounded-full mt-4 relative z-10 overflow-hidden">
             <div className="bg-blue-400 h-full w-[65%]"></div>
           </div>
        </div>
        <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-100 flex flex-col justify-center">
           <p className="text-sm font-black text-blue-100 uppercase tracking-widest mb-1">السيولة النقدية</p>
           <h3 className="text-2xl font-black">{formatCurrency(totalAssets * 0.4)}</h3>
           <button className="mt-4 text-sm font-black uppercase text-white/80 hover:text-white transition-colors underline text-right">تحويل نقدي</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                 <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <HistoryIcon className="w-5 h-5 text-blue-600" />
                    أحدث القيود المحاسبية
                 </h3>
                 <button className="text-sm font-bold text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-colors">عرض دفتر اليومية</button>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-right">
                    <thead className="bg-gray-50/50 text-sm text-gray-400 uppercase font-black">
                       <tr className="border-b border-gray-100">
                          <th className="px-8 py-4">رقم القيد</th>
                          <th className="px-8 py-4">البيان</th>
                          <th className="px-8 py-4">التاريخ</th>
                          <th className="px-8 py-4">المبلغ</th>
                          <th className="px-8 py-4">الحالة</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {entries.length === 0 ? (
                         <tr><td colSpan={5} className="py-20 text-center text-gray-400 font-medium italic">لا توجد قيود مسجلة حالياً</td></tr>
                       ) : entries.map(entry => (
                         <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-8 py-4 font-mono text-sm text-gray-500">{entry.reference || entry.id.slice(0, 8)}</td>
                            <td className="px-8 py-4 font-bold text-gray-900 text-sm truncate max-w-[200px]">{entry.description}</td>
                            <td className="px-8 py-4 text-sm text-gray-400">{entry.date}</td>
                            <td className="px-8 py-4 font-black text-blue-600">{formatCurrency(entry.lines.reduce((sum, l) => sum + l.debit, 0))}</td>
                            <td className="px-8 py-5">
                               <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-sm font-bold uppercase">مرحل</span>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                 <Briefcase className="w-5 h-5 text-blue-600" />
                 دليل الحسابات السريع
              </h3>
              <div className="space-y-4">
                 {accounts.slice(0, 5).map(acc => (
                   <div key={acc.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-all cursor-pointer group">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600">
                           <Wallet className="w-4 h-4" />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-gray-900">{acc.name}</p>
                            <p className="text-sm text-gray-400">{acc.code}</p>
                         </div>
                      </div>
                      <p className={cn("text-sm font-black", acc.balance >= 0 ? "text-green-600" : "text-red-600")}>
                        {formatCurrency(acc.balance)}
                      </p>
                   </div>
                 ))}
                 <button className="w-full py-3 bg-gray-50 text-gray-400 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-gray-100 transition-all mt-4">إضافة حساب جديد</button>
              </div>
           </div>

           <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
              <div className="flex items-start gap-4">
                 <div className="bg-white w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                    <FileText className="w-5 h-5" />
                 </div>
                 <div>
                    <h4 className="font-bold text-blue-900 text-sm">الإقرار الضريبي</h4>
                    <p className="text-sm text-blue-500 mt-1 leading-relaxed">تذكير: موعد تقديم الإقرار الضريبي للربع الحالي ينتهي خلال 15 يوماً.</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}


