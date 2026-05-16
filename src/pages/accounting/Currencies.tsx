import React, { useState } from 'react';
import { Coins, Plus, Search, Trash2, Settings2, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState([
    { id: '1', code: 'EGP', name: 'الجنيه المصري', rate: 1.0, isDefault: true },
    { id: '2', code: 'USD', name: 'الدولار الأمريكي', rate: 48.5, isDefault: false },
    { id: '3', code: 'SAR', name: 'الريال السعودي', rate: 12.9, isDefault: false },
  ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">العملات</h2>
          <p className="text-gray-500 mt-1">إدارة العملات وأسعار الصرف الرسمية للنظام</p>
        </div>
        <button className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
           <Plus className="w-4 h-4" />
           إضافة عملة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currencies.map(curr => (
          <motion.div 
            key={curr.id}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={cn(
              "bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all group relative overflow-hidden",
              curr.isDefault ? "border-blue-600 ring-4 ring-blue-50" : "border-gray-100"
            )}
          >
            {curr.isDefault && (
              <div className="absolute top-0 left-0 bg-blue-600 text-white px-4 py-1 text-sm font-black uppercase tracking-widest rounded-br-2xl">الافتراضية</div>
            )}
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                <Coins className="w-7 h-7" />
              </div>
              <span className="text-2xl font-black text-gray-200">{curr.code}</span>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-1">{curr.name}</h3>
            <p className="text-sm font-bold text-blue-600 mb-6">سعر الصرف: {curr.rate}</p>
            
            <div className="flex gap-2">
              <button className="flex-1 bg-gray-50 text-gray-500 py-3 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors">تحديث السعر</button>
              <button disabled={curr.isDefault} className="w-12 h-12 bg-gray-50 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}


