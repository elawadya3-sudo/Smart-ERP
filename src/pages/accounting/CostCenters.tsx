import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  MapPin, 
  User, 
  Plus, 
  Trash2, 
  Settings2,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { CostCenter } from '../../types';
import { cn } from '../../lib/utils';

export default function CostCentersPage() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'cost_centers'), orderBy('code', 'asc'));
      const snapshot = await getDocs(q);
      setCostCenters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CostCenter[]);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">مراكز التكلفة</h2>
          <p className="text-gray-500 mt-1">تتبع المصاريف والإيرادات حسب الأقسام أو المشاريع</p>
        </div>
        <button className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
           <Plus className="w-4 h-4" />
           مركز تكلفة جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {loading ? (
           [1, 2, 3].map(i => <div key={i} className="h-48 bg-white rounded-3xl animate-pulse" />)
         ) : costCenters.length === 0 ? (
           <div className="col-span-full py-24 bg-white rounded-[2.5rem] border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-300 gap-4">
              <LayoutGrid className="w-16 h-16 opacity-10" />
              <p className="font-bold">لم يتم إضافة مراكز تكلفة بعد</p>
           </div>
         ) : costCenters.map(cc => (
           <motion.div 
             key={cc.id}
             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
             className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
           >
              <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Building2 className="w-7 h-7" />
                 </div>
                 <span className={cn("px-3 py-1 rounded-full text-sm font-bold uppercase", cc.isActive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                    {cc.isActive ? 'نشط' : 'متوقف'}
                 </span>
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-1">{cc.name}</h3>
              <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-6">كود المركز: {cc.code}</p>
              
              <div className="flex gap-2">
                 <button className="flex-1 bg-gray-50 text-gray-500 py-3 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors">إعدادات</button>
                 <button className="w-12 h-12 bg-gray-50 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer"><Trash2 className="w-4 h-4" /></button>
              </div>
           </motion.div>
         ))}
      </div>
    </div>
  );
}


