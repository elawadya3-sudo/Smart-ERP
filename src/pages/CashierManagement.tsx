import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Shield, 
  Building2, 
  Mail, 
  Lock,
  CheckCircle2,
  XCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, Warehouse } from '../types';
import { INITIAL_WAREHOUSES } from '../constants';
import { cn, formatDate } from '../lib/utils';

export default function CashierManagement() {
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    branchId: '',
    role: 'CASHIER' as const,
    isActive: true
  });

  const branches = warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1');

  useEffect(() => {
    fetchCashiers();
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const q = query(collection(db, 'warehouses'));
      const querySnapshot = await getDocs(q);
      const list: Warehouse[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Warehouse);
      });
      setWarehouses(list.length > 0 ? list : INITIAL_WAREHOUSES);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
    }
  };

  const fetchCashiers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'CASHIER'));
      const querySnapshot = await getDocs(q);
      const cashierList: User[] = [];
      querySnapshot.forEach((doc) => {
        cashierList.push(doc.data() as User);
      });
      setCashiers(cashierList);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let uid = selectedCashier?.uid;

      if (!uid) {
        // Create new Auth User using a secondary app instance to preserve current session
        const secondaryAppName = 'SecondaryApp';
        let secondaryApp;
        try {
          secondaryApp = getApps().find(app => app.name === secondaryAppName) || initializeApp(firebaseConfig, secondaryAppName);
        } catch (e) {
          secondaryApp = getApp(secondaryAppName);
        }
        
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const finalEmail = formData.email.includes('@') ? formData.email : `${formData.email}@system.local`;
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, formData.password);
          uid = userCredential.user.uid;
          
          // Sign out of the secondary auth so it doesn't persist
          await secondaryAuth.signOut();
        } catch (authError: any) {
          console.error("Auth Creation Error:", authError);
          let msg = authError.message;
          if (authError.code === 'auth/email-already-in-use') msg = 'هذا البريد الإلكتروني مستخدم بالفعل.';
          if (authError.code === 'auth/weak-password') msg = 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).';
          if (authError.code === 'auth/invalid-email') msg = 'البريد الإلكتروني غير صالح.';
          
          alert(`خطأ في إنشاء حساب المصادقة: ${msg}`);
          setIsSubmitting(false);
          return;
        }
      }

      const cashierData = {
        uid,
        name: formData.name,
        email: formData.email.includes('@') ? formData.email : `${formData.email}@system.local`,
        role: 'CASHIER' as const,
        branchId: formData.branchId,
        isActive: formData.isActive,
        createdAt: selectedCashier?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), cashierData);
      
      setIsModalOpen(false);
      setSelectedCashier(null);
      setFormData({ name: '', email: '', password: '', branchId: '', role: 'CASHIER', isActive: true });
      fetchCashiers();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الكاشير؟')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        fetchCashiers();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const filteredCashiers = cashiers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getBranchName = (id: string) => {
    return warehouses.find(w => w.id === id)?.name || 'غير محدد';
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-none mb-3">إدارة الكاشير</h2>
          <p className="text-gray-500 font-medium italic">إدارة موظفي المبيعات وتوزيعهم على الفروع</p>
        </div>
        
        <button 
          onClick={() => {
            setSelectedCashier(null);
            setFormData({ name: '', email: '', password: '', branchId: '', role: 'CASHIER' });
            setIsModalOpen(true);
          }}
          className="bg-blue-600 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center gap-3"
        >
          <Plus className="w-5 h-5" />
          إضافة كاشير جديد
        </button>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="md:col-span-2 relative group">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors w-5 h-5" />
            <input 
              type="text"
              placeholder="البحث باسم الكاشير أو البريد الإلكتروني..."
              className="w-full bg-white border border-gray-100 rounded-[2rem] pr-14 pl-6 py-5 text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
         
         <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
               <Users className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm text-gray-400 font-black uppercase tracking-widest leading-none mb-1">إجمالي الكاشير</p>
               <p className="text-xl font-black text-gray-900">{cashiers.length}</p>
            </div>
         </div>

         <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
               <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm text-gray-400 font-black uppercase tracking-widest leading-none mb-1">الفروع المغطاة</p>
               <p className="text-xl font-black text-gray-900">{new Set(cashiers.map(c => c.branchId)).size}</p>
            </div>
         </div>
      </div>

      {/* Cashiers List */}
      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
         <div className="overflow-x-auto">
            <table className="w-full text-right">
               <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                     <th className="px-10 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">الكاشير / البيانات</th>
                     <th className="px-10 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">الفرع الموكل إليه</th>
                     <th className="px-10 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">تاريخ البدء</th>
                     <th className="px-10 py-6 text-sm font-black text-gray-400 uppercase tracking-widest text-left">الإجراءات</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                       <td colSpan={4} className="text-center py-20">
                          <div className="flex flex-col items-center gap-4">
                             <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                             <p className="text-gray-400 font-bold">جاري تحميل البيانات...</p>
                          </div>
                       </td>
                    </tr>
                  ) : filteredCashiers.length === 0 ? (
                    <tr>
                       <td colSpan={4} className="text-center py-20 text-gray-400 font-bold italic">لا يوجد كاشير مضاف حالياً</td>
                    </tr>
                  ) : filteredCashiers.map((c, index) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={c.uid} 
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                       <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                                {c.name[0]}
                             </div>
                             <div className="flex flex-col">
                                <span className="text-sm font-black text-gray-900">{c.name}</span>
                                <span className="text-sm text-gray-400 font-medium">{c.email}</span>
                             </div>
                          </div>
                       </td>
                       <td className="px-10 py-6">
                          <div className="flex items-center gap-2 text-gray-700">
                             <Building2 className="w-4 h-4 text-gray-400" />
                             <span className="text-sm font-bold">{getBranchName(c.branchId || '')}</span>
                          </div>
                       </td>
                       <td className="px-10 py-6 text-sm text-gray-400 font-medium">
                          {formatDate(c.createdAt)}
                       </td>
                       <td className="px-10 py-6">
                          <div className="flex justify-end gap-2">
                             <button 
                               onClick={() => {
                                 setSelectedCashier(c);
                                 setFormData({
                                   name: c.name,
                                   email: c.email,
                                   password: '',
                                   branchId: c.branchId || '',
                                   role: 'CASHIER',
                                   isActive: c.isActive !== false
                                 });
                                 setIsModalOpen(true);
                               }}
                               className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                             >
                                <Edit2 className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => handleDelete(c.uid)}
                               className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       </td>
                    </motion.tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
               onClick={() => setIsModalOpen(false)}
             />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="relative w-full max-w-xl bg-white rounded-[3rem] p-12 shadow-2xl overflow-hidden"
             >
                <div className="text-center mb-10">
                   <h3 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">
                      {selectedCashier ? 'تعديل بيانات كاشير' : 'إضافة كاشير جديد'}
                   </h3>
                   <p className="text-gray-400 font-medium italic">ادخل البيانات المطلوبة لتحديد صلاحيات الكاشير</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-sm font-black text-gray-400 uppercase tracking-widest mr-2 flex items-center gap-2">
                         <Users className="w-3 h-3" />
                         الاسم الكامل
                      </label>
                      <input 
                        type="text"
                        required
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-100 font-black text-sm transition-all"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="أدخل اسم الموظف..."
                      />
                   </div>

                   <div className="space-y-2">
                      <label className="text-sm font-black text-gray-400 uppercase tracking-widest mr-2 flex items-center gap-2">
                         <Mail className="w-3 h-3" />
                         البريد الإلكتروني
                      </label>
                      <input 
                        type="email"
                        required
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-100 font-black text-sm transition-all"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@example.com"
                      />
                   </div>

                   {!selectedCashier && (
                     <div className="space-y-2">
                        <label className="text-sm font-black text-gray-400 uppercase tracking-widest mr-2 flex items-center gap-2">
                           <Lock className="w-3 h-3" />
                           كلمة المرور المؤقتة
                        </label>
                        <input 
                          type="password"
                          required={!selectedCashier}
                          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-100 font-black text-sm transition-all"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="••••••••"
                        />
                     </div>
                   )}

                   <div className="space-y-2">
                      <label className="text-sm font-black text-gray-400 uppercase tracking-widest mr-2 flex items-center gap-2">
                         <Building2 className="w-3 h-3" />
                         تخصيص الفرع
                      </label>
                      <select 
                        required
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-100 font-black text-sm transition-all appearance-none"
                        value={formData.branchId}
                        onChange={(e) => setFormData(prev => ({ ...prev, branchId: e.target.value }))}
                      >
                         <option value="">اختر الفرع...</option>
                         {branches.map(b => (
                           <option key={b.id} value={b.id}>{b.name}</option>
                         ))}
                      </select>
                   </div>

                   <div className="flex items-center gap-3 px-2">
                      <input 
                        type="checkbox"
                        id="isActive"
                        className="w-5 h-5 rounded-lg border-gray-100 text-blue-600 focus:ring-blue-100"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      />
                      <label htmlFor="isActive" className="text-sm font-bold text-gray-700">تفعيل الحساب (Active)</label>
                   </div>

                   <div className="flex gap-4 pt-6">
                      <button 
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 bg-gray-100 text-gray-400 font-black py-5 rounded-2xl hover:bg-gray-200 transition-all"
                      >
                         إلغاء
                      </button>
                      <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-[2] bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                         {isSubmitting ? 'جاري التنفيذ...' : (selectedCashier ? 'تحديث البيانات' : 'إضافة وتفعيل الحساب')}
                      </button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


