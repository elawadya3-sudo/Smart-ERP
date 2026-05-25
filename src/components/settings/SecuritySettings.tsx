import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Shield, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Lock, 
  Mail, 
  User as UserIcon,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Key,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { collection, query, where, onSnapshot, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import firebaseConfig from '../../../firebase-applet-config.json';
import { User, UserPermissions } from '../../types';
import { cn, formatDate } from '../../lib/utils';

const MODULES = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: Shield },
  { id: 'pos', label: 'نقطة البيع', icon: Shield },
  { id: 'inventory', label: 'إدارة المخازن', icon: Shield },
  { id: 'accounting', label: 'الإدارة المالية', icon: Shield },
  { id: 'customers', label: 'العملاء', icon: Shield },
  { id: 'reports', label: 'التقارير', icon: Shield },
  { id: 'settings', label: 'الإعدادات', icon: Shield },
  { id: 'branchManagement', label: 'إدارة الفروع', icon: Shield },
  { id: 'cashierManagement', label: 'إدارة الكاشير', icon: Shield },
  { id: 'systemReset', label: 'إعادة تهيئة النظام', icon: Shield },
];

const DEFAULT_PERMISSIONS: UserPermissions = {
  dashboard: true,
  pos: true,
  inventory: true,
  accounting: true,
  customers: true,
  reports: true,
  settings: true,
  branchManagement: true,
  cashierManagement: true,
  systemReset: true,
};

export default function SecuritySettings() {
  const { user: currentUser, tenant } = useAuth();
  const [admins, setAdmins] = useState<User[]>([]);

  const activeModules = MODULES.filter(m => {
    if (!tenant) return true;
    if (!tenant.allowedModules) return true;
    return tenant.allowedModules.includes(m.id);
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    permissions: { ...DEFAULT_PERMISSIONS } as UserPermissions
  });

  const [formError, setFormError] = useState<string | null>(null);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 6) strength += 1;
    if (/[A-Z]/.test(pass)) strength += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) strength += 1;
    return strength;
  };

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'ADMIN'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({
          ...(doc.data() as User),
          uid: doc.id
        }))
        .filter(admin => !admin.isRoot && admin.email !== 'master@system.local');
      setAdmins(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleTogglePermission = (moduleId: keyof UserPermissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleId]: !prev.permissions[moduleId]
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (selectedAdmin && (selectedAdmin.isRoot || selectedAdmin.email === 'master@system.local')) {
      setFormError('لا يمكن تعديل صلاحيات المدير الرئيسي للنظام');
      return;
    }

    if (!selectedAdmin) {
      if (formData.password.length < 6) {
        setFormError('يجب أن تكون كلمة المرور 6 أحرف على الأقل');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setFormError('كلمات المرور غير متطابقة');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let uid = selectedAdmin?.uid;

      if (!uid) {
        // Create new Admin User using secondary auth to avoid logout
        const secondaryAppName = 'AdminCreationApp';
        let secondaryApp;
        try {
          secondaryApp = getApps().find(app => app.name === secondaryAppName) || initializeApp(firebaseConfig, secondaryAppName);
        } catch (e) {
          secondaryApp = getApp(secondaryAppName);
        }
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const finalEmail = formData.email.includes('@') ? formData.email : `${formData.email}@admin.local`;
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, formData.password);
          uid = userCredential.user.uid;
          await secondaryAuth.signOut();
        } catch (authError: any) {
          setFormError(`خطأ في إنشاء حساب الأدمن: ${authError.message}`);
          setIsSubmitting(false);
          return;
        }
      }

      const adminData = {
        uid,
        name: formData.name,
        email: formData.email.includes('@') ? formData.email : `${formData.email}@admin.local`,
        role: 'ADMIN' as const,
        permissions: formData.permissions,
        isActive: true,
        createdAt: selectedAdmin?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), adminData);
      
      setIsModalOpen(false);
      setSelectedAdmin(null);
      setFormData({ name: '', email: '', password: '', confirmPassword: '', permissions: { ...DEFAULT_PERMISSIONS } });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (uid: string) => {
    const adminToDelete = admins.find(a => a.uid === uid);
    if (adminToDelete?.isRoot || adminToDelete?.email === 'master@system.local') {
      alert('لا يمكن حذف أو تعديل صلاحيات المدير الرئيسي للنظام.');
      return;
    }
    if (window.confirm('هل أنت متأكد من حذف هذا المدير؟')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const filteredAdmins = admins.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">إدارة المديرين والصلاحيات</h3>
          <p className="text-gray-500 font-medium italic">إضافة مسؤولين جدد وتخصيص صلاحيات الوصول لكل قسم</p>
        </div>
        
        <button 
          onClick={() => {
            setSelectedAdmin(null);
            
            const initialPerms = { ...DEFAULT_PERMISSIONS };
            if (!currentUser?.isRoot) {
              Object.keys(initialPerms).forEach((key) => {
                if (currentUser?.permissions?.[key as keyof UserPermissions] === false) {
                  initialPerms[key as keyof UserPermissions] = false;
                }
              });
            }

            setFormData({ 
              name: '', 
              email: '', 
              password: '', 
              confirmPassword: '', 
              permissions: initialPerms 
            });
            setIsModalOpen(true);
          }}
          className="bg-gray-900 text-white font-black px-8 py-4 rounded-2xl shadow-xl hover:bg-black hover:-translate-y-1 transition-all flex items-center gap-3"
        >
          <Plus className="w-5 h-5" />
          إضافة مدير جديد
        </button>
      </div>

      {/* Admins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm animate-pulse space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
              <div className="h-20 bg-gray-50 rounded-2xl" />
            </div>
          ))
        ) : filteredAdmins.map((admin) => (
          <motion.div 
            layout
            key={admin.uid}
            className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xl">
                  {admin.name[0]}
                </div>
                <div>
                  <h4 className="font-black text-gray-900">{admin.name}</h4>
                  <p className="text-xs text-gray-400 font-bold">{admin.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setSelectedAdmin(admin);
                    setFormData({
                      name: admin.name,
                      email: admin.email,
                      password: '*****',
                      permissions: admin.permissions || { ...DEFAULT_PERMISSIONS }
                    });
                    setIsModalOpen(true);
                  }}
                  className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(admin.uid)}
                  className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                 <span className="text-xs font-black text-gray-400 uppercase tracking-widest">تاريخ الانضمام</span>
                 <span className="text-xs font-bold text-gray-600">{formatDate(admin.createdAt)}</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {activeModules.map(m => {
                  const hasAccess = admin.permissions?.[m.id as keyof UserPermissions] ?? true;
                  if (!hasAccess) return null;
                  return (
                    <span key={m.id} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-tight">
                      {m.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[3rem] p-12 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto scrollbar-none"
              dir="rtl"
            >
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                  {selectedAdmin ? 'تعديل صلاحيات المدير' : 'إضافة مدير جديد للنظام'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h4 className="text-lg font-black text-gray-900 border-r-4 border-blue-600 pr-4">البيانات الأساسية</h4>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <UserIcon className="w-3 h-3" /> الاسم بالكامل
                    </label>
                    <input 
                      type="text" required
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-black text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                      value={formData.name}
                      onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="أدخل اسم المدير..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Mail className="w-3 h-3" /> البريد الإلكتروني
                    </label>
                    <input 
                      type="text" required
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-black text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                      value={formData.email}
                      onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                      placeholder="admin@system.local"
                      readOnly={!!selectedAdmin}
                    />
                  </div>

                  {!selectedAdmin && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Lock className="w-3 h-3" /> كلمة المرور
                        </label>
                        <div className="relative">
                          <input 
                            type={showPassword ? 'text' : 'password'} required
                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-black text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                            value={formData.password}
                            onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                            placeholder="••••••"
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {/* Strength Indicator */}
                        {formData.password && (
                          <div className="flex gap-1 h-1 mt-2">
                            {[1, 2, 3].map(i => (
                              <div 
                                key={i}
                                className={cn(
                                  "flex-1 rounded-full transition-all duration-500",
                                  getPasswordStrength(formData.password) >= i 
                                    ? (getPasswordStrength(formData.password) === 1 ? 'bg-red-500' : getPasswordStrength(formData.password) === 2 ? 'bg-yellow-500' : 'bg-green-500')
                                    : 'bg-gray-100'
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Lock className="w-3 h-3" /> تأكيد كلمة المرور
                        </label>
                        <input 
                          type={showPassword ? 'text' : 'password'} required
                          className={cn(
                            "w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-black text-sm focus:ring-4 outline-none transition-all",
                            formData.confirmPassword && formData.password !== formData.confirmPassword ? "focus:ring-red-100 border-red-200" : "focus:ring-blue-100"
                          )}
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData(p => ({ ...p, confirmPassword: e.target.value }))}
                          placeholder="••••••"
                        />
                      </div>

                      {formError && (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-xs font-bold flex items-center gap-3"
                        >
                          <XCircle className="w-4 h-4 shrink-0" />
                          {formError}
                        </motion.div>
                      )}
                    </div>
                  )}

                  {selectedAdmin && (
                    <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                      <p className="text-xs font-bold text-blue-600 leading-relaxed">لتعديل كلمة المرور، يرجى استخدام لوحة التحكم الرئيسية لحسابات المستخدمين أو تواصل مع الدعم الفني لتغييرها يدوياً.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <h4 className="text-lg font-black text-gray-900 border-r-4 border-blue-600 pr-4">صلاحيات الوصول</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeModules.filter(module => {
                      if (currentUser?.isRoot) return true;
                      return currentUser?.permissions?.[module.id as keyof UserPermissions] !== false;
                    }).map((module) => (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => handleTogglePermission(module.id as keyof UserPermissions)}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all text-right",
                          formData.permissions[module.id as keyof UserPermissions]
                            ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100"
                            : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                        )}
                      >
                        <span className="text-xs font-black">{module.label}</span>
                        {formData.permissions[module.id as keyof UserPermissions] ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4 opacity-20" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-4 pt-8 border-t border-gray-50 mt-12">
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
                      {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : (selectedAdmin ? 'حفظ الصلاحيات' : 'إضافة المسؤول')}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
