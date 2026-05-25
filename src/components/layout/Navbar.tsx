import { Search, Bell, User as UserIcon, LogOut, Menu, Database, Package, CreditCard, RotateCcw, X, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../../lib/firebase';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { Warehouse, AppNotification } from '../../types';
import { useMainStoreSettings } from '../../hooks/useMainStoreSettings';
import { notificationsService } from '../../services/firestore';
import { cn, formatCurrency } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { user } = useAuth();
  const { settings } = useMainStoreSettings();
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

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
    <header className="h-16 bg-white border-b border-gray-100 sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1 lg:w-96 lg:flex-none">
        <button 
          onClick={onMenuClick}
          className="p-2 -mr-2 text-gray-500 hover:bg-gray-50 rounded-xl lg:hidden transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="relative w-full group hidden sm:block max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute right-4 top-2.5 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="بحث عن فاتورة، منتج، أو عميل..." 
            className="w-full bg-gray-50 border border-gray-200 rounded-full py-2 px-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        {/* Dynamic Connection Info */}
        <div className="hidden lg:flex items-center gap-6 text-xs font-black bg-gray-50 py-2.5 px-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-200"></div>
            <span className="text-gray-400 uppercase tracking-widest">متصل بـ:</span>
            <span className="text-blue-600">
              {settings?.storeName || 'نقطة البيع'}
            </span>
          </div>
          <div className="h-5 w-px bg-gray-200 mx-1" />
          <div className="flex items-center gap-2.5">
            <span className="text-gray-400 uppercase tracking-widest">المستودع الرئيسي:</span>
            <span className="text-orange-600">
              {mainWarehouse?.name || 'المستودع الرئيسي'}
            </span>
          </div>
        </div>

        <div className="hidden lg:block h-8 w-px bg-gray-100" />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-left hidden sm:block">
            <p className="text-sm font-black text-gray-900 leading-none">{user?.name || 'مدير النظام'}</p>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">
              {user?.role?.toUpperCase() === 'ADMIN' ? 'Administrator' : 'Staff'}
            </p>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all group flex items-center gap-2 min-h-[44px] min-w-[44px] justify-center"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-bold hidden lg:block">خروج</span>
          </button>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              "relative p-2 text-gray-500 hover:bg-gray-50 rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center",
              showNotifications && "bg-blue-50 text-blue-600"
            )}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 left-2.5 w-4 h-4 bg-red-500 border-2 border-white rounded-full text-[10px] text-white flex items-center justify-center font-black animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setShowNotifications(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-0 mt-4 w-96 bg-white rounded-[2rem] shadow-2xl border border-gray-100 z-50 overflow-hidden"
                  dir="rtl"
                >
                  <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                    <div>
                      <h4 className="text-lg font-black text-gray-900">التنبيهات</h4>
                      <p className="text-xs text-gray-400 font-bold">آخر التحديثات والعمليات</p>
                    </div>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        notifications.filter(n => !n.isRead).forEach(n => notificationsService.markAsRead(n.id)); 
                      }}
                      className="text-xs font-black text-blue-500 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      تحديد الكل كمقروء
                    </button>
                  </div>

                  <div className="max-h-[28rem] overflow-y-auto scrollbar-none">
                    {notifications.length === 0 ? (
                      <div className="p-12 text-center flex flex-col items-center gap-4 text-gray-300">
                        <Bell className="w-12 h-12 opacity-10" />
                        <p className="font-bold text-sm">لا توجد تنبيهات حالياً</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {notifications.map((n) => (
                          <div 
                            key={n.id} 
                            onClick={() => handleNotificationClick(n)}
                            className={cn(
                              "p-5 hover:bg-gray-50 transition-colors flex gap-4 relative group cursor-pointer",
                              !n.isRead && "bg-blue-50/30"
                            )}
                          >
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", getNotificationColor(n.type))}>
                              {getNotificationIcon(n.type)}
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <h5 className="text-sm font-black text-gray-900 leading-tight">{n.title}</h5>
                                <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                                  {n.createdAt ? (typeof n.createdAt.toDate === 'function' ? n.createdAt.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : new Date(n.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })) : 'الآن'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 font-medium line-clamp-2">{n.message}</p>
                              {!n.isRead && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); notificationsService.markAsRead(n.id); }}
                                  className="mt-2 text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  تحديد كمقروء
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                    <button 
                      onClick={() => setShowNotifications(false)}
                      className="text-xs font-black text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      إغلاق القائمة
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}


