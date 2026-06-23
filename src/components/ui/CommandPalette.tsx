import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  ShoppingCart,
  LayoutDashboard,
  Plus,
  Package, 
  Users, 
  Warehouse, 
  FileText, 
  Building2, 
  Settings, 
  ArrowRightLeft,
  Briefcase,
  UserCheck,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  category: 'إجراءات سريعة' | 'صفحات النظام' | 'المنتجات' | 'العملاء' | 'الموردين' | 'الموظفين' | 'المستودعات' | 'الفواتير';
  icon: any;
  path: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const allowedBranchIds = React.useMemo(() => {
    if (user?.role === 'CASHIER') {
      const uAllowed = (user as any).allowedBranches || [];
      if (uAllowed.length > 0) {
        return uAllowed.includes(user.branchId) ? uAllowed : [...uAllowed, user.branchId].filter(Boolean);
      }
      return user.branchId ? [user.branchId] : [];
    }
    return [];
  }, [user]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Core Static Commands
  const staticCommands: CommandItem[] = [
    { id: 'pos', label: 'شاشة نقطة البيع (POS)', subtitle: 'بيع مباشر وإصدار فواتير كاشير', category: 'صفحات النظام', icon: ShoppingCart, path: '/pos' },
    { id: 'dashboard', label: 'لوحة التحكم العامة', subtitle: 'إحصائيات المبيعات والأداء المالي', category: 'صفحات النظام', icon: LayoutDashboard, path: '/' },
    { id: 'add-product', label: 'إضافة صنف جديد', subtitle: 'إنشاء منتج أو خدمة جديدة في المستودعات', category: 'إجراءات سريعة', icon: Plus, path: '/inventory/products' },
    { id: 'add-transfer', label: 'طلب تحويل بضاعة جديد', subtitle: 'نقل مخزون بين الفروع والمستودعات', category: 'إجراءات سريعة', icon: ArrowRightLeft, path: '/inventory/branch-transfer-request' },
    { id: 'warehouses', label: 'إدارة المستودعات والفروع', subtitle: 'هيكلة المخازن والتحكم في الفروع', category: 'صفحات النظام', icon: Warehouse, path: '/inventory/warehouses' },
    { id: 'sales-history', label: 'سجل المبيعات والفواتير', subtitle: 'البحث وتتبع فواتير البيع الصادرة', category: 'صفحات النظام', icon: FileText, path: '/sales/history' },
    { id: 'accounting-chart', label: 'دليل الحسابات المالي', subtitle: 'تنظيم شجرة الحسابات والقيود اليومية', category: 'صفحات النظام', icon: Briefcase, path: '/accounting/accounts' },
    { id: 'cash-reports', label: 'تقارير الكاش والشفتات', subtitle: 'تتبع حركة النقدية وإغلاق الصناديق', category: 'صفحات النظام', icon: FileText, path: '/cash/reports' },
    { id: 'settings', label: 'إعدادات النظام العامة', subtitle: 'صلاحيات النسخة، الفواتير، والضرائب', category: 'صفحات النظام', icon: Settings, path: '/settings' }
  ];

  // Fetch Firestore entities resiliently for dynamic search
  useEffect(() => {
    if (!isOpen) return;

    const fetchEntities = async () => {
      setLoading(true);
      
      const fetchCollectionSafe = async (collName: string, queryLimit: number): Promise<any[]> => {
        try {
          const snap = await getDocs(query(collection(db, collName), limit(queryLimit)));
          return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        } catch (e) {
          console.warn(`Gracefully handled failed fetch for collection: ${collName}`, e);
          return [];
        }
      };

      try {
        const [prodList, custList, invList, whList, empList, suppList] = await Promise.all([
          fetchCollectionSafe('products', 1000),
          fetchCollectionSafe('customers', 1000),
          fetchCollectionSafe('orders', 200),
          fetchCollectionSafe('warehouses', 100),
          fetchCollectionSafe('users', 100),
          fetchCollectionSafe('suppliers', 1000)
        ]);

        setProducts(prodList);
        setCustomers(custList);
        setInvoices(invList);
        setWarehouses(whList);
        setEmployees(empList.filter(u => !u.isRoot && u.email !== 'master@system.local'));
        setSuppliers(suppList);
      } catch (e) {
        console.error("Error executing command palette fetch:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
    setActiveIndex(0);
    setSearch('');
  }, [isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Map dynamic entities to Command Items
  const dynamicCommands: CommandItem[] = [
    ...(user?.role === 'CASHIER' 
      ? products.filter(p => !p.warehouseId || p.warehouseId === '1' || allowedBranchIds.includes(p.warehouseId))
      : products
    ).map(p => ({
      id: `p-${p.id}`,
      label: p.name,
      subtitle: `سعر البيع: ${p.sellingPrice} - SKU: ${p.sku || ''}`,
      category: 'المنتجات' as const,
      icon: Package,
      path: `/inventory/products`
    })),
    ...(user?.role === 'CASHIER'
      ? customers.filter(c => c.branchId && allowedBranchIds.includes(c.branchId))
      : customers
    ).map(c => ({
      id: `c-${c.id}`,
      label: c.name || c.phone,
      subtitle: `الهاتف: ${c.phone || ''} - الرصيد: ${c.balance || 0}`,
      category: 'العملاء' as const,
      icon: Users,
      path: `/customers`
    })),
    ...(user?.role === 'CASHIER'
      ? [] // Hide suppliers entirely for Cashier
      : suppliers
    ).map(s => ({
      id: `s-${s.id}`,
      label: s.name || s.company,
      subtitle: `الهاتف: ${s.phone || ''} - كود المورد: ${s.code || ''}`,
      category: 'الموردين' as const,
      icon: Building2,
      path: `/inventory/accounts-payable`
    })),
    ...(user?.role === 'CASHIER'
      ? [] // Hide employees entirely for Cashier
      : employees
    ).map(emp => ({
      id: `emp-${emp.uid}`,
      label: emp.name,
      subtitle: `البريد: ${emp.email} - الدور: ${emp.role || ''}`,
      category: 'الموظفين' as const,
      icon: UserCheck,
      path: `/settings`
    })),
    ...(user?.role === 'CASHIER'
      ? invoices.filter(inv => inv.branchId && allowedBranchIds.includes(inv.branchId))
      : invoices
    ).map(inv => ({
      id: `inv-${inv.id}`,
      label: `فاتورة مبيعات #${inv.id.slice(0, 8)}`,
      subtitle: `المبلغ: ${inv.total} - التاريخ: ${new Date(inv.createdAt).toLocaleDateString('ar-EG')}`,
      category: 'الفواتير' as const,
      icon: FileText,
      path: user?.role === 'CASHIER' ? `/pos?invoiceId=${inv.id}` : `/sales/history`
    })),
    ...(user?.role === 'CASHIER'
      ? warehouses.filter(wh => allowedBranchIds.includes(wh.id))
      : warehouses
    ).map(wh => ({
      id: `wh-${wh.id}`,
      label: wh.name,
      subtitle: `النوع: ${wh.type === 'MAIN' ? 'رئيسي' : 'فرعي'} - كود: ${wh.code || ''}`,
      category: 'المستودعات' as const,
      icon: Warehouse,
      path: `/inventory/warehouses/${wh.id}`
    }))
  ];

  const allItems = [...staticCommands, ...dynamicCommands];

  // Filter based on search query
  const getFilteredItems = () => {
    const hasPermission = (path: string) => {
      if (user?.role === 'ADMIN') return true;
      if (!user?.permissions) return false;
      
      if (path === '/pos') return user.permissions.pos;
      if (path === '/') return user.permissions.dashboard;
      if (path === '/inventory/products') return user.permissions.inventory_products || user.permissions.inventory;
      if (path === '/inventory/branch-transfer-request') return user.permissions.inventory_branchtransfer || user.permissions.inventory;
      if (path === '/inventory/warehouses') return user.permissions.inventory_warehouses || user.permissions.inventory;
      if (path === '/sales/history') return user.permissions.reports_history || user.permissions.reports;
      if (path === '/accounting/accounts') return user.permissions.accounting_chart || user.permissions.accounting;
      if (path === '/cash/reports') return user.permissions.reports_cash || user.permissions.reports;
      if (path === '/settings') return user.permissions.settings;
      if (path.startsWith('/inventory/warehouses/')) return user.permissions.inventory_warehouses || user.permissions.inventory;
      
      return true;
    };

    const allowedStatic = staticCommands.filter(cmd => hasPermission(cmd.path));
    const allowedDynamic = user?.role === 'CASHIER' 
      ? dynamicCommands 
      : dynamicCommands.filter(cmd => hasPermission(cmd.path));
    const allAllowed = [...allowedStatic, ...allowedDynamic];

    if (!search.trim()) {
      return allowedStatic;
    }

    if (search.trim() === '*') {
      return allAllowed;
    }

    const cleanQuery = search.toLowerCase().trim();
    return allAllowed.filter(item => 
      item.label.toLowerCase().includes(cleanQuery) || 
      (item.subtitle && item.subtitle.toLowerCase().includes(cleanQuery)) ||
      item.category.toLowerCase().includes(cleanQuery)
    );
  };

  const filtered = getFilteredItems();

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filtered[activeIndex];
        if (selected) {
          navigate(selected.path);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, activeIndex, navigate, onClose]);

  // Adjust active scroll position
  useEffect(() => {
    const activeEl = containerRef.current?.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Search Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -8 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
          dir="rtl"
        >
          {/* Header Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
            <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <input 
              ref={inputRef}
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="اكتب اسم صنف، عميل، مورد، موظف... (أو اكتب * لعرض الكل)"
              className="flex-1 bg-transparent border-none text-slate-800 dark:text-slate-100 outline-none text-sm font-bold placeholder-slate-400"
            />
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-800">
              Esc
            </span>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-md">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results Area */}
          <div 
            ref={containerRef}
            className="flex-1 overflow-y-auto p-2 scrollbar-none"
          >
            {loading && filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold">جاري تحميل سجلات النظام...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Search className="w-10 h-10 opacity-20 mx-auto mb-3" />
                <p className="font-bold text-sm">لم يتم العثور على أي نتائج تطابق البحث</p>
                <p className="text-xs mt-1">تأكد من كتابة الاسم بشكل صحيح أو جرب استخدام الرمز *</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Group items by Category */}
                {Array.from(new Set(filtered.map(i => i.category))).map(cat => (
                  <div key={cat} className="space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg tracking-wider uppercase">
                      {cat}
                    </div>
                    {filtered
                      .map((item, originalIdx) => ({ item, originalIdx }))
                      .filter(pair => pair.item.category === cat)
                      .map(pair => {
                        const itemIdx = filtered.findIndex(i => i.id === pair.item.id);
                        const isActive = itemIdx === activeIndex;
                        const Icon = pair.item.icon;

                        return (
                          <div
                            key={pair.item.id}
                            data-active={isActive}
                            onClick={() => {
                              navigate(pair.item.path);
                              onClose();
                            }}
                            className={cn(
                              "flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150",
                              isActive 
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/10" 
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                isActive ? "bg-white/15 text-white" : "bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-slate-600"
                              )}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate leading-tight">{pair.item.label}</p>
                                {pair.item.subtitle && (
                                  <p className={cn(
                                    "text-[10px] mt-0.5 truncate font-medium",
                                    isActive ? "text-blue-100" : "text-slate-400"
                                  )}>
                                    {pair.item.subtitle}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {isActive && (
                              <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-md">
                                اضغط Enter
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Help Footer */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 flex-shrink-0">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded shadow-sm">↓↑</kbd> للتنقل
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded shadow-sm">Enter</kbd> للاختيار
              </span>
            </div>
            <span className="flex items-center gap-1">
              اكتب <kbd className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded shadow-sm">*</kbd> لعرض جميع السجلات
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
