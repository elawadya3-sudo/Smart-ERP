import React, { useState } from 'react';
import { ScrollText, Plus, Search, Filter, CheckCircle2, Clock, ShieldAlert, History as HistoryIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export default function CheckStagesPage() {
  const stages = [
    { id: '1', title: 'تحت التحصيل', color: 'bg-orange-50 text-orange-600', description: 'الشيك تم استلامه ولم يتم إيداعه بعد' },
    { id: '2', title: 'تم الإيداع', color: 'bg-blue-50 text-blue-600', description: 'الشيك في البنك بانتظار المقاصة' },
    { id: '3', title: 'تم التحصيل', color: 'bg-green-50 text-green-600', description: 'المبلغ دخل الحساب البنكي فعلياً' },
    { id: '4', title: 'مرفوض / مرتجع', color: 'bg-red-50 text-red-600', description: 'الشيك مرفوض من قبل البنك' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">مراحل الشيكات</h2>
          <p className="text-gray-500 mt-1">تتبع دورة حياة الشيكات (أوراق القبض والدفع)</p>
        </div>
        <button className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg hover:bg-gray-800 transition-all flex items-center gap-2">
           <Plus className="w-4 h-4" />
           إضافة مرحلة مخصصة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stages.map((stage, i) => (
          <motion.div 
            key={stage.id}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-blue-200 transition-all"
          >
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", stage.color)}>
              <ScrollText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">{stage.title}</h3>
            <p className="text-sm text-gray-400 font-medium leading-relaxed">{stage.description}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 bg-gray-50/20">
          <h4 className="font-bold text-gray-900 flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-blue-600" />
            آخر حركات الشيكات
          </h4>
        </div>
        <div className="p-20 text-center text-gray-300 font-medium italic">
           لا توجد عمليات على الشيكات حالياً في النظام
        </div>
      </div>
    </div>
  );
}


