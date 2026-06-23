import {
  Bell,
  LogOut,
  Menu,
  Package,
  CreditCard,
  RotateCcw,
  Check,
  Search,
  ShoppingCart,
  Building2,
  Users,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../../lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Warehouse, AppNotification } from '../../types';
import { useMainStoreSettings } from '../../hooks/useMainStoreSettings';
import { notificationsService } from '../../services/firestore';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  onMenuClick?: () => void;
  onSearchClick?: () => void;
}

export default function Navbar({ onMenuClick, onSearchClick }: NavbarProps) {
  const { user } = useAuth();
  const { settings } = useMainStoreSettings();
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Quick Search States & Refs
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Click outside search container
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = async () => {
    setIsFocused(true);
    if (hasFetched) return;
    setLoading(true);
    try {
      const fetchColl = async (name: string, limitVal: number) => {
        try {
          const snap = await getDocs(query(collection(db, name), limit(limitVal)));
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          return [];
        }
      };
      const [prod, cust, supp] = await Promise.all([
        fetchColl('products', 1000),
        fetchColl('customers', 1000),
        fetchColl('suppliers', 1000),
      ]);
      setProducts(prod);
      setCustomers(cust);
      setSuppliers(supp);
      setHasFetched(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const allowedBranchIds = useMemo(() => {
    if (user?.role === 'CASHIER') {
      const uAllowed = (user as any).allowedBranches || [];
      if (uAllowed.length > 0) {
        return uAllowed.includes(user.branchId) ? uAllowed : [...uAllowed, user.branchId].filter(Boolean);
      }
      return user.branchId ? [user.branchId] : [];
    }
    return [];
  }, [user]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (user?.role === 'CASHIER') {
      list = products.filter(p => !p.warehouseId || p.warehouseId === '1' || allowedBranchIds.includes(p.warehouseId));
    }
    if (searchQuery.trim() === '*') return list;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return list.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || (p.barcode && String(p.barcode).includes(q)));
  }, [products, searchQuery, user, allowedBranchIds]);

  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (user?.role === 'CASHIER') {
      list = customers.filter(c => c.branchId && allowedBranchIds.includes(c.branchId));
    }
    if (searchQuery.trim() === '*') return list;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return list.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q));
  }, [customers, searchQuery, user, allowedBranchIds]);

  const filteredSuppliers = useMemo(() => {
    if (user?.role === 'CASHIER') return [];
    if (searchQuery.trim() === '*') return suppliers;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return suppliers.filter(s => s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.company?.toLowerCase().includes(q));
  }, [suppliers, searchQuery, user]);

  useEffect(() => {
    const qW = query(collection(db, 'warehouses'));
    const unsubscribe = onSnapshot(qW, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Warehouse[];
      setWarehouses(list);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qN = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
    const unsubN = onSnapshot(qN, (snapshot) => {
      const allNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      
      const filtered = allNotifs.filter(n => {
        if (user?.role === 'ADMIN') return true;
        // Cashiers only see transfer notifications
        return n.type === 'TRANSFER';
      });
      
      setNotifications(filtered.slice(0, 20));
    });
    return () => unsubN();
  }, [user]);

  const mainWarehouse = warehouses.find(w => (w as any).type === 'MAIN' || w.id === '1');
  const currentBranch = user?.branchId ? warehouses.find(w => w.id === user.branchId) : warehouses.find(w => (w as any).type !== 'MAIN' && w.id !== '1');

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'INVOICE': return <CreditCard className="w-4 h-4" />;
      case 'RETURN': return <RotateCcw className="w-4 h-4" />;
      case 'TRANSFER': return <Package className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'INVOICE': return 'bg-blue-50 text-blue-600';
      case 'RETURN': return 'bg-red-50 text-red-600';
      case 'TRANSFER': return 'bg-orange-50 text-orange-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.isRead) {
      await notificationsService.markAsRead(n.id);
    }
    setShowNotifications(false);

    if (n.type === 'INVOICE' || n.type === 'RETURN') {
      const invoiceId = n.metadata?.invoiceId || n.metadata?.orderId;
      if (invoiceId) {
        navigate(`/pos?invoiceId=${invoiceId}`);
      }
    } else if (n.type === 'TRANSFER') {
      const transferId = n.metadata?.transferId;
      if (transferId) {
        navigate(`/branch-management?transferId=${transferId}`);
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm flex-shrink-0">
      <div className="w-full flex h-12 items-center gap-2.5 px-3">
        <button
          onClick={onMenuClick}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 transition hover:bg-slate-50"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        {/* Brand Identity Header (ShoppingCart + Name + ERP Badge) */}
        <div className="flex items-center gap-2 mr-1 flex-shrink-0 pl-3 border-l border-slate-200 h-8">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--color-primary)] text-white shadow-none">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex flex-col justify-center text-right">
            <h1 className="text-xs font-black text-slate-950 tracking-tight leading-none truncate">
              {settings?.storeName || 'NEZAM PRO'}
            </h1>
            <div className="flex items-center mt-0.5">
              <span className="text-[7px] font-black bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-1 py-0.5 rounded tracking-wider uppercase leading-none font-mono">
                ERP System
              </span>
            </div>
          </div>
        </div>

        <span className="h-5 w-px bg-slate-200 hidden sm:block mr-1.5" />

        {/* Dynamic Context Header Info */}
        <div className="mr-1.5 hidden sm:flex flex-col justify-center text-right flex-shrink-0">
          <h2 className="text-[11px] font-black text-slate-700 leading-none">
            {currentBranch ? currentBranch.name : 'المستودع الرئيسي'}
          </h2>
          <span className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase">
            {user?.role?.toUpperCase() === 'ADMIN' ? 'لوحة التحكم والتحليلات' : 'شاشة المبيعات والكاشير'}
          </span>
        </div>

        {/* Global Search Bar (Desktop) */}
        <div ref={searchContainerRef} className="mr-3 flex-1 max-w-sm hidden md:block relative">
          <div className="w-full flex items-center bg-slate-50 border border-slate-200 rounded pr-2.5 pl-2 py-1 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={handleFocus}
              placeholder="البحث السريع في الفواتير، الأصناف والعملاء..."
              className="w-full bg-transparent border-none text-slate-800 outline-none text-xs font-bold placeholder-slate-400 text-right py-0"
            />
          </div>
          
          {isFocused && (searchQuery.trim() !== '') && (
            <div className="absolute right-0 top-full mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 max-h-[400px] overflow-y-auto" dir="rtl">
              {loading ? (
                <div className="p-6 text-center text-slate-400 flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] font-bold">جاري البحث في قاعدة البيانات...</span>
                </div>
              ) : (filteredProducts.length === 0 && filteredCustomers.length === 0 && filteredSuppliers.length === 0) ? (
                <div className="p-8 text-center text-slate-400 text-xs font-bold">
                  لا توجد نتائج تطابق البحث
                </div>
              ) : (
                <div className="p-2 space-y-3">
                  {filteredProducts.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-black text-slate-400 bg-slate-50 rounded-lg">المنتجات ({filteredProducts.length})</div>
                      <div className="mt-1 space-y-1">
                        {filteredProducts.slice(0, 15).map(p => (
                          <div 
                            key={p.id} 
                            onClick={() => { navigate('/inventory/products'); setSearchQuery(''); setIsFocused(false); }} 
                            className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-xs font-bold text-slate-700 truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">السعر: {p.sellingPrice} - SKU: {p.sku || ''}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredCustomers.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-black text-slate-400 bg-slate-50 rounded-lg">العملاء ({filteredCustomers.length})</div>
                      <div className="mt-1 space-y-1">
                        {filteredCustomers.slice(0, 15).map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => { navigate('/customers'); setSearchQuery(''); setIsFocused(false); }} 
                            className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-xs font-bold text-slate-700 truncate">{c.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">الهاتف: {c.phone || 'بدون هاتف'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredSuppliers.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-black text-slate-400 bg-slate-50 rounded-lg">الموردين ({filteredSuppliers.length})</div>
                      <div className="mt-1 space-y-1">
                        {filteredSuppliers.slice(0, 15).map(s => (
                          <div 
                            key={s.id} 
                            onClick={() => { navigate('/inventory/accounts-payable'); setSearchQuery(''); setIsFocused(false); }} 
                            className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-xs font-bold text-slate-700 truncate">{s.name || s.company}</p>
                              <p className="text-[10px] text-slate-400 truncate">الهاتف: {s.phone || 'بدون هاتف'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mr-auto flex items-center gap-2">
          {/* Global Search Trigger (Mobile) */}
          <button 
            onClick={onSearchClick}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 md:hidden"
          >
            <Search className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(
                'relative inline-flex h-8 w-8 items-center justify-center rounded border transition-all duration-200',
                showNotifications
                  ? 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setShowNotifications(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    className="absolute left-0 mt-3 w-96 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl z-50"
                    dir="rtl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">التنبيهات</h4>
                        <p className="text-xs text-slate-400">آخر التحديثات والعمليات</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            notifications.filter((n) => !n.isRead).forEach((n) => notificationsService.markAsRead(n.id));
                          }}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />
                          قراءة الكل
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm('هل أنت متأكد من مسح سجل التنبيهات بالكامل؟')) {
                              await notificationsService.clearAll();
                            }
                          }}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          مسح السجل
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[28rem] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-6 py-12 text-center text-slate-400">لا توجد تنبيهات حالياً</div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={cn(
                                'group flex cursor-pointer gap-3 px-5 py-4 transition hover:bg-slate-50',
                                !n.isRead && 'bg-blue-50/30'
                              )}
                            >
                              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', getNotificationColor(n.type))}>
                                {getNotificationIcon(n.type)}
                              </div>
                              <div className="min-w-0 flex-1 text-right">
                                <div className="flex items-start justify-between gap-2">
                                  <h5 className="text-sm font-bold text-slate-900">{n.title}</h5>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-400">
                                      {n.createdAt ? (typeof n.createdAt.toDate === 'function' ? n.createdAt.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : new Date(n.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })) : 'الآن'}
                                    </span>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm('هل تريد حذف هذا التنبيه؟')) {
                                          await notificationsService.delete(n.id);
                                        }
                                      }}
                                      className="opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded-md text-red-500 hover:bg-red-50 transition-all duration-200"
                                      title="حذف التنبيه"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-1 text-sm text-slate-500">{n.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 md:flex">
            <div className="text-left">
              <p className="text-xs font-black text-slate-800 leading-none">{user?.name || 'مدير النظام'}</p>
              <p className="text-[8px] font-extrabold text-[var(--color-primary)] tracking-wider uppercase mt-0.5">
                {user?.role?.toUpperCase() === 'ADMIN' ? 'Administrator' : 'Staff'}
              </p>
            </div>
            <button
              onClick={() => auth.signOut()}
              className="inline-flex h-6.5 w-6.5 items-center justify-center rounded text-slate-400 hover:text-red-500 transition hover:bg-red-50"
              title="تسجيل الخروج"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}


