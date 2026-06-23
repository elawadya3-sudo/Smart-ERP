import React, { useState, useEffect } from 'react';
import { pageGroups } from '../constants/pageGroups';
import { 
  Users, 
  Edit2, 
  Trash2, 
  Shield, 
  Building2, 
  Mail, 
  Lock,
  CheckCircle2,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Briefcase,
  BarChart3,
  Settings,
  ShieldCheck,
  Database,
  ArrowDownLeft,
  ArrowRightLeft,
  FileText,
  Wallet,
  Coins,
  ScrollText,
  Percent,
  Banknote,
  Box,
  Layers,
  History as HistoryIcon,
  Warehouse as WarehouseIcon,
  FolderTree,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, Warehouse, UserPermissions } from '../types';
import { INITIAL_WAREHOUSES } from '../constants';
import { cn, formatDate } from '../lib/utils';
import PageToolbar from '../components/ui/PageToolbar';

export default function CashierManagement() {
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultPermissions: UserPermissions = {
    dashboard: false,
    pos: true,
    adminPos: false,
    inventory: false,
    accounting: false,
    customers: false,
    reports: false,
    settings: false,
    branchManagement: false,
    cashierManagement: false,
    systemReset: false,
    pos_make_return: true,
    pos_delete_invoice: true
  };

  // Form state - must be before pageGroups
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    branchId: '',
    allowedBranches: [] as string[],
    role: 'CASHIER' as const,
    isActive: true,
    permissions: { ...defaultPermissions }
  });


  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    pos: true,
    inventory: false,
    accounting: false,
    system: false,
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const getAvatarGradient = (name: string) => {
    const colors = [
      'from-blue-500 to-indigo-600 text-white',
      'from-purple-500 to-pink-600 text-white',
      'from-emerald-500 to-teal-600 text-white',
      'from-amber-500 to-orange-600 text-white',
      'from-rose-500 to-red-600 text-white',
      'from-cyan-500 to-blue-600 text-white',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

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
        allowedBranches: formData.allowedBranches || [],
        isActive: formData.isActive,
        permissions: formData.permissions,
        createdAt: selectedCashier?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), cashierData);
      
      setIsModalOpen(false);
      setSelectedCashier(null);
      setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        branchId: '', 
        allowedBranches: [],
        role: 'CASHIER', 
        isActive: true, 
        permissions: { ...defaultPermissions } 
      });
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

  // Stats calculation
  const totalCashiers = cashiers.length;
  const activeCashiers = cashiers.filter(c => c.isActive !== false).length;
  const inactiveCashiers = totalCashiers - activeCashiers;
  const branchesCovered = new Set(cashiers.map(c => c.branchId).filter(Boolean)).size;

  return (
    <div className="space-y-6" dir="rtl">
      <PageToolbar
        title="إدارة الكاشير"
        subtitle="إدارة موظفي المبيعات وتوزيعهم على الفروع"
        onNew={() => {
          setSelectedCashier(null);
          setFormData({ 
            name: '', 
            email: '', 
            password: '', 
            branchId: '', 
            allowedBranches: [],
            role: 'CASHIER', 
            isActive: true, 
            permissions: { ...defaultPermissions } 
          });
          setIsModalOpen(true);
        }}
        searchValue={searchTerm}
        onSearchChange={searchTerm => setSearchTerm(searchTerm)}
        searchPlaceholder="البحث باسم الكاشير أو البريد الإلكتروني..."
        onRefresh={fetchCashiers}
        onPrint={() => window.print()}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />

      {/* Search & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Card 1: Total Cashiers */}
         <div className="bg-gradient-to-br from-white to-blue-50/20 p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5 relative overflow-hidden group">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all" />
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
               <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
               <p className="text-xs text-slate-400 font-black uppercase tracking-wider">إجمالي الكاشير</p>
               <p className="text-2xl font-black text-slate-800">{totalCashiers}</p>
               <p className="text-[11px] font-bold text-slate-400">
                 <span className="text-green-500">{activeCashiers} نشط</span>
                 <span className="mx-1.5">•</span>
                 <span className="text-red-400">{inactiveCashiers} معطل</span>
               </p>
            </div>
         </div>

         {/* Card 2: Branches Covered */}
         <div className="bg-gradient-to-br from-white to-emerald-50/20 p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5 relative overflow-hidden group">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all" />
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
               <Building2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
               <p className="text-xs text-slate-400 font-black uppercase tracking-wider">الفروع المغطاة</p>
               <p className="text-2xl font-black text-slate-800">{branchesCovered}</p>
               <p className="text-[11px] font-bold text-slate-400">من أصل {branches.length} فروع مسجلة</p>
            </div>
         </div>

         {/* Card 3: Active Account Ratio */}
         <div className="bg-gradient-to-br from-white to-violet-50/20 p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5 relative overflow-hidden group">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-violet-500/5 rounded-full blur-xl group-hover:bg-violet-500/10 transition-all" />
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform duration-300">
               <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
               <p className="text-xs text-slate-400 font-black uppercase tracking-wider">معدل الفاعلية</p>
               <p className="text-2xl font-black text-slate-800">
                 {totalCashiers > 0 ? Math.round((activeCashiers / totalCashiers) * 100) : 0}%
               </p>
               <p className="text-[11px] font-bold text-slate-400">حسابات نشطة وصالحة للعمل</p>
            </div>
         </div>
      </div>

      {/* Cashiers List */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
         <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
               <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100/80">
                     <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-wider">الكاشير / البيانات</th>
                     <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-wider">الفرع الموكل إليه</th>
                     <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-wider">الصلاحيات</th>
                     <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-wider">تاريخ البدء</th>
                     <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-wider text-left">الإجراءات</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                       <td colSpan={5} className="text-center py-20">
                          <div className="flex flex-col items-center gap-4">
                             <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                             <p className="text-gray-400 font-bold">جاري تحميل البيانات...</p>
                          </div>
                       </td>
                    </tr>
                  ) : filteredCashiers.length === 0 ? (
                    <tr>
                       <td colSpan={5} className="text-center py-20 text-slate-400 font-bold italic">لا يوجد كاشير مضاف حالياً</td>
                    </tr>
                  ) : filteredCashiers.map((c, index) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={c.uid} 
                      className="hover:bg-slate-50/40 transition-all duration-200 group"
                    >
                       <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                             <div className="relative shrink-0">
                                <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center font-black shadow-inner uppercase text-base", getAvatarGradient(c.name))}>
                                   {c.name[0]}
                                </div>
                                <div className={cn(
                                  "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center shadow-sm",
                                  c.isActive !== false ? "bg-green-500" : "bg-slate-300"
                                )}>
                                  {c.isActive !== false && <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />}
                                </div>
                             </div>
                             <div className="flex flex-col text-right">
                                <span className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">{c.name}</span>
                                <span className="text-xs text-slate-400 font-medium">{c.email}</span>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-5">
                          <div className="flex flex-col gap-1 text-right">
                             <div className="flex items-center gap-2 text-slate-700">
                                <Building2 className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-black">{getBranchName(c.branchId || '')}</span>
                             </div>
                             {c.allowedBranches && c.allowedBranches.filter((id: string) => id !== c.branchId).length > 0 && (
                               <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                 <span className="text-[9px] text-slate-400 font-black">إضافي:</span>
                                 {c.allowedBranches
                                   .filter((id: string) => id !== c.branchId)
                                   .map((id: string) => (
                                     <span key={id} className="text-[9px] bg-slate-50 text-slate-500 border border-slate-200/50 px-1.5 py-0.5 rounded font-bold">
                                       {getBranchName(id)}
                                     </span>
                                   ))
                                 }
                               </div>
                             )}
                          </div>
                       </td>
                       <td className="px-6 py-5">
                            <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                              {(!c.permissions || Object.values(c.permissions).every(v => !v)) ? (
                                <span className="text-[10px] font-black px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg">بلا صلاحيات</span>
                              ) : (
                                <>
                                  {c.permissions?.dashboard && <span className="text-[10px] font-black px-2.5 py-1 bg-blue-50/50 text-blue-600 border border-blue-100/50 rounded-lg">الرئيسية</span>}
                                  {c.permissions?.pos && <span className="text-[10px] font-black px-2.5 py-1 bg-emerald-50/50 text-emerald-600 border border-emerald-100/50 rounded-lg">البيع</span>}
                                  {c.permissions?.inventory && <span className="text-[10px] font-black px-2.5 py-1 bg-orange-50/50 text-orange-600 border border-orange-100/50 rounded-lg">المخازن</span>}
                                  {c.permissions?.accounting && <span className="text-[10px] font-black px-2.5 py-1 bg-purple-50/50 text-purple-600 border border-purple-100/50 rounded-lg">الحسابات</span>}
                                  {c.permissions?.customers && <span className="text-[10px] font-black px-2.5 py-1 bg-indigo-50/50 text-indigo-600 border border-indigo-100/50 rounded-lg">العملاء</span>}
                                  {c.permissions?.reports && <span className="text-[10px] font-black px-2.5 py-1 bg-amber-50/50 text-amber-700 border border-amber-100/50 rounded-lg">التقارير</span>}
                                  {c.permissions?.settings && <span className="text-[10px] font-black px-2.5 py-1 bg-rose-50/50 text-rose-600 border border-rose-100/50 rounded-lg">الإعدادات</span>}
                                  {c.permissions?.branchManagement && <span className="text-[10px] font-black px-2.5 py-1 bg-teal-50/50 text-teal-600 border border-teal-100/50 rounded-lg">الفرع</span>}
                                  {c.permissions?.cashierManagement && <span className="text-[10px] font-black px-2.5 py-1 bg-slate-100/50 text-slate-700 border border-slate-200/50 rounded-lg">الموظفين</span>}
                                </>
                              )}
                            </div>
                         </td>
                       <td className="px-6 py-5 text-xs text-slate-400 font-bold">
                          {formatDate(c.createdAt)}
                       </td>
                       <td className="px-6 py-5">
                          <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                             <button 
                               onClick={() => {
                                 setSelectedCashier(c);
                                 setFormData({
                                   name: c.name,
                                   email: c.email,
                                   password: '',
                                   branchId: c.branchId || '',
                                   allowedBranches: c.allowedBranches || [],
                                   role: 'CASHIER',
                                   isActive: c.isActive !== false,
                                   permissions: c.permissions ? { ...defaultPermissions, ...c.permissions } : { ...defaultPermissions }
                                 });
                                 setIsModalOpen(true);
                               }}
                               className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              ><Edit2 className="w-4 h-4" /></button>
                             <button 
                               onClick={() => handleDelete(c.uid)}
                               className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                              ><Trash2 className="w-4 h-4" /></button>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
               onClick={() => setIsModalOpen(false)}
             />
             <motion.div 
               initial={{ scale: 0.96, opacity: 0, y: 15 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.96, opacity: 0, y: 15 }}
               transition={{ type: "spring", duration: 0.4 }}
               className="erp-modal max-w-2xl w-full max-h-[92vh] flex flex-col p-6 sm:p-8 overflow-hidden bg-white/95 backdrop-blur-md"
             >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5 relative flex-shrink-0">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                         <Users className="w-5 h-5" />
                      </div>
                      <div className="text-right">
                         <h3 className="text-lg font-black text-slate-800">
                            {selectedCashier ? 'تعديل بيانات كاشير' : 'إضافة كاشير جديد'}
                         </h3>
                         <p className="text-xs text-slate-400 font-bold mt-0.5">ادخل البيانات المطلوبة لتحديد صلاحيات الكاشير</p>
                      </div>
                   </div>
                   <button 
                     type="button"
                     onClick={() => setIsModalOpen(false)}
                     className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-slate-100"
                   >
                     <X className="w-4.5 h-4.5" />
                   </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-5 pr-0.5 scrollbar-thin pb-4">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="space-y-2">
                         <label className="text-xs font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-blue-500" />
                            الاسم الكامل
                         </label>
                         <input 
                           type="text"
                           required
                           className="erp-input px-5 py-3.5 rounded-2xl font-bold"
                           value={formData.name}
                           onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                           placeholder="أدخل اسم الموظف..."
                         />
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                         <label className="text-xs font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-blue-500" />
                            البريد الإلكتروني
                         </label>
                         <input 
                           type="email"
                           required
                           className="erp-input px-5 py-3.5 rounded-2xl font-bold"
                           value={formData.email}
                           onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                           placeholder="email@example.com"
                         />
                      </div>

                      {/* Password */}
                      {!selectedCashier && (
                        <div className="space-y-2">
                           <label className="text-xs font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-blue-500" />
                              كلمة المرور المؤقتة
                           </label>
                           <input 
                             type="password"
                             required={!selectedCashier}
                             className="erp-input px-5 py-3.5 rounded-2xl font-bold"
                             value={formData.password}
                             onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                             placeholder="••••••••"
                           />
                        </div>
                      )}

                      {/* Branch */}
                      <div className={cn("space-y-2", selectedCashier && "sm:col-span-2")}>
                         <label className="text-xs font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-500" />
                            تخصيص الفرع
                         </label>
                         <div className="relative">
                           <select 
                             required
                             className="erp-input px-5 py-3.5 rounded-2xl font-bold appearance-none bg-no-repeat bg-[left_1.25rem_center]"
                             value={formData.branchId}
                             onChange={(e) => setFormData(prev => ({ ...prev, branchId: e.target.value }))}
                           >
                              <option value="">اختر الفرع...</option>
                              {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                           </select>
                           <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-slate-400">
                             <ChevronDown className="w-4 h-4" />
                           </div>
                         </div>
                      </div>

                      {/* Additional Allowed Branches */}
                      <div className="space-y-2 sm:col-span-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/80">
                         <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-500" />
                            نقاط البيع والمستودعات الإضافية المتاحة للكاشير
                         </label>
                         <p className="text-[10px] text-slate-400 font-bold mb-2">
                           يستطيع الكاشير البيع من مخزون هذه الفروع بشكل مجمع في فاتورة واحدة
                         </p>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                           {branches.map(b => {
                             const isPrimary = b.id === formData.branchId;
                             const isChecked = formData.allowedBranches?.includes(b.id) || isPrimary;
                             
                             return (
                               <label
                                 key={b.id}
                                 className={cn(
                                   "flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all select-none cursor-pointer text-xs font-bold",
                                   isChecked 
                                     ? "bg-white border-blue-100 shadow-sm text-blue-600"
                                     : "bg-white/40 border-transparent text-slate-600 hover:border-slate-200"
                                 )}
                               >
                                 <input
                                   type="checkbox"
                                   disabled={isPrimary}
                                   checked={isChecked}
                                   onChange={(e) => {
                                     const checked = e.target.checked;
                                     setFormData(prev => {
                                       const allowed = prev.allowedBranches || [];
                                       const updated = checked 
                                         ? [...allowed, b.id]
                                         : allowed.filter(id => id !== b.id);
                                       return { ...prev, allowedBranches: updated };
                                     });
                                   }}
                                   className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-100 cursor-pointer disabled:opacity-50"
                                 />
                                 <span>
                                   {b.name}
                                   {isPrimary && <span className="text-[10px] text-slate-400 mr-1.5">(الفرع الأساسي)</span>}
                                 </span>
                               </label>
                             );
                           })}
                         </div>
                      </div>
                   </div>

                   {/* Permissions Box */}
                   <div className="space-y-4 bg-slate-50/60 p-4 sm:p-5 rounded-3xl border border-slate-100/80">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/50 pb-3 gap-2">
                         <label className="text-sm font-black text-slate-800 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-600" />
                            صلاحيات صفحات النظام للكاشير
                         </label>
                         <div className="flex items-center gap-2 self-end sm:self-auto">
                           <button
                             type="button"
                             onClick={() => setExpandedGroups({ pos: true, inventory: true, accounting: true, system: true })}
                             className="text-[10px] font-black text-slate-500 hover:text-blue-600 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer active:scale-95"
                           >
                             توسيع الكل
                           </button>
                           <button
                             type="button"
                             onClick={() => {
                               const mainKeys = ['pos', 'inventory', 'accounting', 'customers', 'reports', 'settings', 'dashboard', 'branchManagement', 'cashierManagement'];
                               const anyTrue = mainKeys.some(k => (formData.permissions as any)[k]);
                               const nextVal = !anyTrue;
                               setFormData(prev => ({
                                 ...prev,
                                 permissions: {
                                   dashboard: nextVal,
                                   pos: nextVal,
                                   inventory: nextVal,
                                   accounting: nextVal,
                                   customers: nextVal,
                                   reports: nextVal,
                                   settings: nextVal,
                                   branchManagement: nextVal,
                                   cashierManagement: nextVal,
                                   systemReset: false
                                 }
                               }));
                             }}
                             className="text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50/60 px-3 py-1.5 rounded-xl border border-blue-100 transition-all cursor-pointer active:scale-95"
                           >
                             {['pos', 'inventory', 'accounting', 'customers', 'reports', 'settings', 'dashboard', 'branchManagement', 'cashierManagement'].every(k => (formData.permissions as any)[k]) ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                           </button>
                         </div>
                      </div>

                      {/* Page Groups */}
                      <div className="space-y-3 max-h-[340px] overflow-y-auto pr-0.5 scrollbar-thin">
                        {pageGroups.map(group => {
                          const GroupIcon = group.icon;
                          const isExpanded = expandedGroups[group.id];
                          const groupPages = group.pages;
                          const allGroupChecked = groupPages.every(p => (formData.permissions as any)[p.key]);
                          const someGroupChecked = groupPages.some(p => (formData.permissions as any)[p.key]);

                          const colorMap: Record<string, { bg: string; text: string; border: string; check: string; headerBg: string }> = {
                            blue: { bg: 'bg-blue-50/70', text: 'text-blue-600', border: 'border-blue-100/70', check: 'text-blue-600', headerBg: 'bg-blue-50/40' },
                            orange: { bg: 'bg-orange-50/70', text: 'text-orange-600', border: 'border-orange-100/70', check: 'text-orange-600', headerBg: 'bg-orange-50/40' },
                            purple: { bg: 'bg-purple-50/70', text: 'text-purple-600', border: 'border-purple-100/70', check: 'text-purple-600', headerBg: 'bg-purple-50/40' },
                            slate: { bg: 'bg-slate-100/80', text: 'text-slate-600', border: 'border-slate-200/70', check: 'text-slate-600', headerBg: 'bg-slate-50/50' },
                          };
                          const colors = colorMap[group.color] || colorMap.blue;

                          return (
                            <div key={group.id} className={cn('rounded-2xl border overflow-hidden bg-white transition-all duration-200', colors.border, isExpanded && 'shadow-sm')}>
                              {/* Group Header */}
                              <div className={cn('flex items-center justify-between px-3.5 py-2.5', colors.headerBg)}>
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(group.id)}
                                  className="flex items-center gap-3 flex-1 text-right cursor-pointer"
                                >
                                  <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center shadow-inner', colors.bg)}>
                                    <GroupIcon className={cn('w-4 h-4', colors.text)} />
                                  </div>
                                  <span className="text-xs font-black text-slate-800">{group.label}</span>
                                  <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-lg border', colors.bg, colors.border, colors.text)}>
                                    {groupPages.filter(p => (formData.permissions as any)[p.key]).length} من {groupPages.length}
                                  </span>
                                  {isExpanded 
                                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-auto transition-transform" /> 
                                    : <ChevronRight className="w-3.5 h-3.5 text-slate-400 mr-auto transition-transform" />
                                  }
                                </button>
                                {/* Group Select All Toggle */}
                                <label className="flex items-center gap-1.5 cursor-pointer mr-3 select-none">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-100 cursor-pointer"
                                    checked={allGroupChecked}
                                    ref={el => { if (el) el.indeterminate = !allGroupChecked && someGroupChecked; }}
                                    onChange={(e) => {
                                      const val = e.target.checked;
                                      const updates: any = {};
                                      groupPages.forEach(p => { updates[p.key] = val; });
                                      setFormData(prev => ({
                                        ...prev,
                                        permissions: { ...prev.permissions, ...updates }
                                      }));
                                    }}
                                  />
                                  <span className="text-[10px] font-black text-slate-500">{allGroupChecked ? 'إلغاء الكل' : 'تحديد الكل'}</span>
                                </label>
                              </div>

                              {/* Pages inside group */}
                              {isExpanded && (
                                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/20 border-t border-slate-100">
                                  {groupPages.map(page => {
                                    const PageIcon = page.icon;
                                    const isChecked = !!(formData.permissions as any)[page.key];
                                    return (
                                      <label
                                        key={page.key}
                                        className={cn(
                                          'flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer select-none',
                                          isChecked
                                            ? cn('bg-white shadow-sm', colors.border)
                                            : 'border-transparent bg-white/40 hover:border-slate-200/60'
                                        )}
                                      >
                                        <input
                                          type="checkbox"
                                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-100 cursor-pointer shrink-0"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            setFormData(prev => ({
                                              ...prev,
                                              permissions: {
                                                ...prev.permissions,
                                                [page.key]: e.target.checked
                                              }
                                            }));
                                          }}
                                        />
                                        <div className={cn('w-6.5 h-6.5 rounded-lg flex items-center justify-center shrink-0 shadow-inner', isChecked ? colors.bg : 'bg-slate-50')}>
                                          <PageIcon className={cn('w-3.5 h-3.5', isChecked ? colors.text : 'text-slate-400')} />
                                        </div>
                                        <div className="flex flex-col text-right flex-1 min-w-0">
                                          <span className={cn('text-[11px] font-black truncate', isChecked ? 'text-slate-800' : 'text-slate-500')}>{page.label}</span>
                                          <span className="text-[9px] font-medium text-slate-400 leading-tight mt-0.5">{page.desc}</span>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                   </div>

                   {/* Active Status */}
                   <div className="flex items-center gap-3 px-1 select-none">
                      <input 
                        type="checkbox"
                        id="isActive"
                        className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-100 cursor-pointer"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      />
                      <label htmlFor="isActive" className="text-sm font-black text-slate-700 cursor-pointer">تفعيل هذا الحساب للعمل في النظام (Active)</label>
                   </div>

                   {/* Footer Actions */}
                   <div className="flex gap-3 pt-3 flex-shrink-0">
                      <button 
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all cursor-pointer active:scale-95"
                      >
                         إلغاء
                      </button>
                      <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
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


