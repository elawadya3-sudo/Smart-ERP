import React, { useState } from 'react';
import { Percent, Plus, Search, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../../lib/utils';

export default function TaxesPage() {
  const [taxes, setTaxes] = useState([
    { id: '1', name: 'ضريبة القيمة المضافة', rate: 14, type: 'PERCENT', isActive: true, code: 'VAT' },
    { id: '2', name: 'ضريبة الخصم من المنبع', rate: 1, type: 'PERCENT', isActive: true, code: 'WHT' },
    { id: '3', name: 'ضريبة الأرباح التجارية', rate: 5, type: 'PERCENT', isActive: false, code: 'CIT' },
  ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">إدارة الضرائب</h2>
          <p className="text-gray-500 mt-1">تكوين أنواع الضرائب والنسب المئوية المطبقة</p>
        </div>
        <button className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
           <Plus className="w-4 h-4" />
           تعريف ضريبة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {taxes.map(tax => (
          <motion.div 
            key={tax.id}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
                <Percent className="w-7 h-7" />
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-sm font-black uppercase tracking-widest",
                tax.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"
              )}>
                {tax.isActive ? 'نشط' : 'متوقف'}
              </div>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-1">{tax.name}</h3>
            <p className="text-sm font-bold text-purple-600 uppercase tracking-widest mb-6">كود: {tax.code}</p>
            
            <div className="bg-gray-50 p-4 rounded-2xl mb-6">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400">النسبة</span>
                <span className="text-2xl font-black text-gray-900">{tax.rate}%</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 bg-gray-900 text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors">تعديل الإعدادات</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}


