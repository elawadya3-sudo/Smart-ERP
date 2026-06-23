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
  EyeOff,
  Building2,
  ShoppingCart,
  Warehouse as WarehouseIcon,
  Briefcase,
  LayoutDashboard,
  Package,
  Box,
  Layers,
  ArrowDownLeft,
  ArrowRightLeft,
  Database,
  FileText,
  History as HistoryIcon,
  Wallet,
  BarChart3,
  FolderTree,
  Coins,
  ScrollText,
  Percent,
  ChevronDown,
  ChevronRight,
  Settings,
  Users,
  Banknote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, onSnapshot, setDoc, doc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import firebaseConfig from '../../../firebase-applet-config.json';
import { User, UserPermissions, Warehouse, UserRole } from '../../types';
import { INITIAL_WAREHOUSES } from '../../constants';
import { cn, formatDate } from '../../lib/utils';
import { pageGroups } from '../../constants/pageGroups';

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
  adminPos: true,
  inventory: true,
  accounting: true,
  customers: true,
  reports: true,
  settings: true,
  branchManagement: true,
  cashierManagement: true,
  systemReset: true,
  // Granular inventory sub-pages
  inventory_products: true,
  inventory_units: true,
  inventory_itemmap: true,
  inventory_warehouses: true,
  inventory_receipt: true,
  inventory_salesreturns: true,
  inventory_transfer_receipt: true,
  inventory_purchasereturns: true,
  inventory_issue: true,
  inventory_branchtransfer: true,
  inventory_transfers: true,
  inventory_opening: true,
  inventory_stocktaking: true,
  inventory_approval: true,
  inventory_payable: true,
  inventory_reports: true,
  // Granular accounting sub-pages
  accounting_chart: true,
  accounting_costcenters: true,
  accounting_currencies: true,
  accounting_checkstages: true,
  accounting_taxes: true,
  accounting_journal: true,
  accounting_cash: true,
  // Granular reports/system sub-pages
  reports_cash: true,
  reports_history: true,
  reports_center: true,
};

const ROLES = [
  { id: 'ADMIN', label: 'مدير النظام' },
  { id: 'BRANCH_MANAGER', label: 'مدير فرع' },
  { id: 'WAREHOUSE_MANAGER', label: 'مدير مخزن' },
  { id: 'CASHIER', label: 'كاشير' },
  { id: 'SALES', label: 'موظف مبيعات' },
  { id: 'PURCHASES', label: 'موظف مشتريات' },
  { id: 'HR', label: 'موظف HR' },
  { id: 'ACCOUNTANT', label: 'محاسب' },
];

const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  ADMIN: {
    dashboard: true,
    pos: true,
    adminPos: true,
    inventory: true,
    accounting: true,
    customers: true,
    reports: true,
    settings: true,
    branchManagement: true,
    cashierManagement: true,
    systemReset: true,
    inventory_products: true,
    inventory_units: true,
    inventory_itemmap: true,
    inventory_warehouses: true,
    inventory_receipt: true,
    inventory_salesreturns: true,
    inventory_transfer_receipt: true,
    inventory_purchasereturns: true,
    inventory_issue: true,
    inventory_branchtransfer: true,
    inventory_transfers: true,
    inventory_opening: true,
    inventory_stocktaking: true,
    inventory_approval: true,
    inventory_payable: true,
    inventory_reports: true,
    accounting_chart: true,
    accounting_costcenters: true,
    accounting_currencies: true,
    accounting_checkstages: true,
    accounting_taxes: true,
    accounting_journal: true,
    accounting_cash: true,
    reports_cash: true,
    reports_history: true,
    reports_center: true,
  },
  BRANCH_MANAGER: {
    dashboard: true,
    pos: true,
    adminPos: true,
    inventory: false,
    accounting: false,
    customers: true,
    reports: true,
    settings: false,
    branchManagement: true,
    cashierManagement: false,
    systemReset: false,
    reports_cash: true,
    reports_history: true,
    reports_center: true,
  },
  WAREHOUSE_MANAGER: {
    dashboard: true,
    pos: false,
    inventory: true,
    accounting: false,
    customers: false,
    reports: true,
    settings: false,
    branchManagement: false,
    cashierManagement: false,
    systemReset: false,
    inventory_products: true,
    inventory_units: true,
    inventory_itemmap: true,
    inventory_warehouses: true,
    inventory_receipt: true,
    inventory_salesreturns: true,
    inventory_transfer_receipt: true,
    inventory_purchasereturns: true,
    inventory_issue: true,
    inventory_branchtransfer: true,
    inventory_transfers: true,
    inventory_opening: true,
    inventory_stocktaking: true,
    inventory_approval: true,
    inventory_payable: true,
    inventory_reports: true,
    reports_center: true,
  },
  CASHIER: {
    dashboard: false,
    pos: true,
    inventory: false,
    accounting: false,
    customers: false,
    reports: false,
    settings: false,
    branchManagement: false,
    cashierManagement: false,
    systemReset: false,
  },
  SALES: {
    dashboard: false,
    pos: true,
    inventory: false,
    accounting: false,
    customers: true,
    reports: true,
    settings: false,
    branchManagement: false,
    cashierManagement: false,
    systemReset: false,
    reports_history: true,
  },
  PURCHASES: {
    dashboard: false,
    pos: false,
    inventory: true,
    accounting: false,
    customers: false,
    reports: true,
    settings: false,
    branchManagement: false,
    cashierManagement: false,
    systemReset: false,
    inventory_products: true,
    inventory_units: true,
    inventory_itemmap: true,
    inventory_warehouses: true,
    inventory_receipt: true,
    inventory_salesreturns: true,
    inventory_transfer_receipt: true,
    inventory_purchasereturns: true,
    inventory_issue: true,
    inventory_branchtransfer: true,
    inventory_transfers: true,
    inventory_opening: true,
    inventory_stocktaking: true,
    inventory_approval: true,
    inventory_payable: true,
    inventory_reports: true,
  },
  HR: {
    dashboard: true,
    pos: false,
    inventory: false,
    accounting: false,
    customers: false,
    reports: false,
    settings: true,
    branchManagement: false,
    cashierManagement: true,
    systemReset: false,
  },
  ACCOUNTANT: {
    dashboard: true,
    pos: false,
    inventory: false,
    accounting: true,
    customers: false,
    reports: true,
    settings: false,
    branchManagement: false,
    cashierManagement: false,
    systemReset: false,
    accounting_chart: true,
    accounting_costcenters: true,
    accounting_currencies: true,
    accounting_checkstages: true,
    accounting_taxes: true,
    accounting_journal: true,
    accounting_cash: true,
    reports_center: true,
  },
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
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    pos: true,
    inventory: false,
    accounting: false,
    system: false,
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'ADMIN' as UserRole,
    branchId: '',
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
    // Fetch warehouses for branch assignment
    const fetchWarehouses = async () => {
      try {
        const qW = query(collection(db, 'warehouses'));
        const snap = await getDocs(qW);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Warehouse);
        setWarehouses(list.length > 0 ? list : INITIAL_WAREHOUSES);
      } catch (err) {
        setWarehouses(INITIAL_WAREHOUSES);
      }
    };
    fetchWarehouses();

    const q = query(collection(db, 'users'));
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
          const finalEmail = formData.email.includes('@') ? formData.email : `${formData.email}@system.local`;
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, formData.password);
          uid = userCredential.user.uid;
          await secondaryAuth.signOut();
        } catch (authError: any) {
          setFormError(`خطأ في إنشاء حساب الموظف: ${authError.message}`);
          setIsSubmitting(false);
          return;
        }
      }

      const adminData: any = {
        uid,
        name: formData.name,
        email: formData.email.includes('@') ? formData.email : `${formData.email}@system.local`,
        role: formData.role,
        permissions: formData.permissions,
        isActive: true,
        createdAt: selectedAdmin?.createdAt || new Date().toISOString()
      };

      if (formData.branchId) {
        adminData.branchId = formData.branchId;
      }

      await setDoc(doc(db, 'users', uid), adminData);
      
      setIsModalOpen(false);
      setSelectedAdmin(null);
      setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        confirmPassword: '', 
        role: 'ADMIN' as UserRole,
        branchId: '',
        permissions: { ...DEFAULT_PERMISSIONS } 
      });
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
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">إدارة المستخدمين والصلاحيات</h3>
          <p className="text-gray-500 font-medium italic">إضافة موظفين ومسؤولين وتخصيص صلاحيات الوصول لكل قسم</p>
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
              role: 'ADMIN' as UserRole,
              branchId: '',
              permissions: initialPerms 
            });
            setIsModalOpen(true);
          }}
          className="bg-gray-900 text-white font-black px-8 py-4 rounded-2xl shadow-xl hover:bg-black hover:-translate-y-1 transition-all flex items-center gap-3"
        >
          <Plus className="w-5 h-5" />
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Admins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-gray-100 shadow-sm animate-pulse space-y-4">
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
            className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xl">
                  {admin.name[0]}
                </div>
                <div>
                  <h4 className="font-black text-gray-900">{admin.name}</h4>
                  <p className="text-xs text-gray-400 font-bold">{admin.email}</p>
                  <div className="flex flex-wrap gap-1.5 items-center mt-1">
                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                      {ROLES.find(r => r.id === admin.role)?.label || admin.role}
                    </span>
                    {admin.branchId && (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5" />
                        {warehouses.find(w => w.id === admin.branchId)?.name || admin.branchId}
                      </span>
                    )}
                  </div>
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
                      confirmPassword: '*****',
                      role: admin.role || 'ADMIN',
                      branchId: admin.branchId || '',
                      permissions: admin.permissions || { ...DEFAULT_PERMISSIONS }
                    });
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                ><Edit2 className="w-4 h-4" /></button>
                <button 
                  onClick={() => handleDelete(admin.uid)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                ><Trash2 className="w-4 h-4" /></button>
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
              className="erp-modal max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-none"
              dir="rtl"
            >
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                  {selectedAdmin ? 'تعديل صلاحيات المستخدم' : 'إضافة مستخدم جديد للنظام'}
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
                      placeholder="أدخل اسم الموظف..."
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

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Shield className="w-3 h-3" /> الدور الوظيفي
                    </label>
                    <select
                      required
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-black text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all appearance-none"
                      value={formData.role}
                      onChange={(e) => {
                        const newRole = e.target.value as UserRole;
                        setFormData(p => ({
                          ...p,
                          role: newRole,
                          permissions: { ...ROLE_DEFAULT_PERMISSIONS[newRole] }
                        }));
                      }}
                    >
                      {ROLES.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Building2 className="w-3 h-3" /> الفرع / المستودع المخصص
                    </label>
                    <select
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-black text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all appearance-none"
                      value={formData.branchId}
                      onChange={(e) => setFormData(p => ({ ...p, branchId: e.target.value }))}
                    >
                      <option value="">لا يوجد فرع مخصص (عام)</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
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
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                     <label className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        صلاحيات صفحات النظام
                     </label>
                     <div className="flex items-center gap-2">
                       <button
                         type="button"
                         onClick={() => setExpandedGroups({ pos: true, inventory: true, accounting: true, system: true })}
                         className="text-[10px] font-black text-slate-500 hover:text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer"
                       >
                         توسيع الكل
                       </button>
                       <button
                         type="button"
                         onClick={() => {
                           // Toggle all permissions
                           const allKeys = [
                             'dashboard', 'pos', 'adminPos', 'inventory', 'accounting', 'customers', 'reports', 'settings', 'branchManagement', 'cashierManagement', 'systemReset',
                             'inventory_products', 'inventory_units', 'inventory_itemmap', 'inventory_warehouses', 'inventory_receipt', 'inventory_salesreturns', 'inventory_purchasereturns', 'inventory_issue', 'inventory_branchtransfer', 'inventory_transfers', 'inventory_opening', 'inventory_stocktaking', 'inventory_approval', 'inventory_payable', 'inventory_reports',
                             'accounting_chart', 'accounting_costcenters', 'accounting_currencies', 'accounting_checkstages', 'accounting_taxes', 'accounting_journal', 'accounting_cash',
                             'reports_cash', 'reports_history', 'reports_center'
                           ];
                           const anyTrue = allKeys.some(k => (formData.permissions as any)[k]);
                           const nextVal = !anyTrue;
                           const updates: any = {};
                           allKeys.forEach(k => {
                             if (k === 'systemReset') {
                               updates[k] = false; // Safety for system reset
                             } else {
                               updates[k] = nextVal;
                             }
                           });
                           setFormData(prev => ({
                             ...prev,
                             permissions: { ...prev.permissions, ...updates }
                           }));
                         }}
                         className="text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 cursor-pointer"
                       >
                         {Object.keys(DEFAULT_PERMISSIONS).filter(k => k !== 'systemReset').every(k => (formData.permissions as any)[k]) ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                       </button>
                     </div>
                  </div>

                  {/* Page Groups */}
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5 scrollbar-thin">
                    {pageGroups.map(group => {
                      const GroupIcon = group.icon;
                      const isExpanded = expandedGroups[group.id];
                      const groupPages = group.pages;
                      const allGroupChecked = groupPages.every(p => (formData.permissions as any)[p.key]);
                      const someGroupChecked = groupPages.some(p => (formData.permissions as any)[p.key]);

                      const colorMap: Record<string, { bg: string; text: string; border: string; check: string; headerBg: string }> = {
                        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', check: 'text-blue-600', headerBg: 'bg-blue-50/70' },
                        orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', check: 'text-orange-600', headerBg: 'bg-orange-50/70' },
                        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', check: 'text-purple-600', headerBg: 'bg-purple-50/70' },
                        slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', check: 'text-slate-600', headerBg: 'bg-slate-100/70' },
                      };
                      const colors = colorMap[group.color] || colorMap.blue;

                      return (
                        <div key={group.id} className={cn('rounded-xl border overflow-hidden', colors.border)}>
                          {/* Group Header */}
                          <div className={cn('flex items-center justify-between px-3 py-2.5', colors.headerBg)}>
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.id)}
                              className="flex items-center gap-2 flex-1 text-right"
                            >
                              <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center', colors.bg)}>
                                <GroupIcon className={cn('w-3.5 h-3.5', colors.text)} />
                              </div>
                              <span className="text-xs font-black text-slate-800">{group.label}</span>
                              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', colors.bg, colors.text)}>
                                {groupPages.filter(p => (formData.permissions as any)[p.key]).length}/{groupPages.length}
                              </span>
                              {isExpanded 
                                ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-auto" /> 
                                : <ChevronRight className="w-3.5 h-3.5 text-slate-400 mr-auto" />
                              }
                            </button>
                            {/* Group Select All Toggle */}
                            <label className="flex items-center gap-1.5 cursor-pointer mr-2">
                              <input
                                type="checkbox"
                                className="rounded cursor-pointer"
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
                            <div className="p-2 grid grid-cols-1 gap-1.5 bg-white">
                              {groupPages.map(page => {
                                const PageIcon = page.icon;
                                const isChecked = !!(formData.permissions as any)[page.key];
                                return (
                                  <label
                                    key={page.key}
                                    className={cn(
                                      'flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-pointer select-none',
                                      isChecked
                                        ? cn('border-opacity-60', colors.border, colors.bg + '/30')
                                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className="rounded cursor-pointer shrink-0"
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
                                    <div className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0', isChecked ? colors.bg : 'bg-slate-50')}>
                                      <PageIcon className={cn('w-3.5 h-3.5', isChecked ? colors.text : 'text-slate-400')} />
                                    </div>
                                    <div className="flex flex-col text-right flex-1 min-w-0">
                                      <span className={cn('text-[11px] font-black truncate', isChecked ? 'text-slate-900' : 'text-slate-600')}>{page.label}</span>
                                      <span className="text-[9px] font-medium text-slate-400 leading-tight">{page.desc}</span>
                                    </div>
                                    {isChecked && (
                                      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', colors.text.replace('text-', 'bg-'))} />
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                      {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : (selectedAdmin ? 'حفظ التعديلات' : 'إضافة مستخدم جديد')}
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
