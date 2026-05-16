import { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Database,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ArrowDownLeft,
  ArrowRightLeft,
  Briefcase,
  FolderTree,
  Building2,
  FileText,
  Wallet,
  Coins,
  ScrollText,
  Percent,
  Banknote,
  ChevronLeft
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePOS } from '../../context/POSContext';
import { formatCurrency } from '../../lib/utils';
import { AnimatePresence } from 'motion/react';
import { X, CheckCircle2 } from 'lucide-react';

interface SidebarItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  hasAlert?: boolean;
  alertCount?: number;
  onAlertClick?: () => void;
}

function SidebarItem({ to, icon: Icon, label, hasAlert, alertCount, onAlertClick }: SidebarItemProps) {
  return (
    <div className="relative">
      <NavLink
        to={to}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
            isActive
              ? "bg-blue-50 text-blue-600 font-semibold"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          )
        }
      >
        <Icon className="w-5 h-5" />
        <span className="text-sm flex-1">{label}</span>
        {hasAlert && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-2 h-2 bg-red-500 rounded-full animate-pulse"
          />
        )}
      </NavLink>

      {hasAlert && (
        <button
          onClick={onAlertClick}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-sm font-black px-1.5 py-0.5 rounded-full shadow-lg hover:scale-110 transition-transform z-10"
        >
          {alertCount || '!'}
        </button>
      )}
    </div>
  );
}

interface SidebarGroupProps {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
  activePathPrefix?: string | string[];
}

function SidebarGroup({ label, icon: Icon, children, activePathPrefix }: SidebarGroupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (activePathPrefix) {
      const prefixes = Array.isArray(activePathPrefix) ? activePathPrefix : [activePathPrefix];
      if (prefixes.some(prefix => location.pathname.startsWith(prefix))) {
        setIsOpen(true);
      }
    }
  }, [location.pathname, activePathPrefix]);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
          isOpen ? "bg-gray-50 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className={cn("w-5 h-5", isOpen ? "text-blue-600" : "text-gray-400 group-hover:text-blue-600")} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <ChevronLeft
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform duration-200",
            isOpen ? "-rotate-90" : "rotate-0"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          isOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="pt-1 pb-2 pr-4 space-y-1 border-r-2 border-gray-100 mr-6 mt-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { signOut, user } = useAuth();
  const { newTransferAlert, clearTransferAlert } = usePOS();
  const [showTransferModal, setShowTransferModal] = useState(false);

  return (
    <motion.aside
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-64 h-screen bg-white border-l border-gray-100 fixed right-0 top-0 flex flex-col z-50 text-right"
    >
      <div className="p-6 border-b border-gray-50 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-100">
          <ShoppingCart className="text-white w-6 h-6" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">رد أثر</h1>
          <span className="text-sm text-blue-600 font-bold uppercase tracking-widest leading-none">Smart ERP</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin">
        {user?.role?.toUpperCase() === 'ADMIN' ? (
          <>
            <SidebarItem to="/" icon={LayoutDashboard} label="لوحة التحكم" />
            <SidebarItem to="/pos" icon={ShoppingCart} label="نقطة البيع" />
            <SidebarItem to="/branch-management" icon={LayoutDashboard} label="إدارة الفرع" />

            <SidebarGroup label="إدارة المخازن" icon={Database} activePathPrefix="/inventory">
              <SidebarItem to="/inventory" icon={LayoutDashboard} label="لوحة المخزون" />
              <SidebarItem to="/inventory/products" icon={Package} label="المنتجات والأصناف" />
              <SidebarItem to="/inventory/receipt" icon={ArrowDownLeft} label="توريد بضاعة" />
              <SidebarItem to="/inventory/transfers" icon={ArrowRightLeft} label="نقل مخزون / Transfers" />
              <SidebarItem to="/inventory/warehouses" icon={Database} label="Warehouses / المستودعات" />
              <SidebarItem to="/inventory/reports" icon={BarChart3} label="تقارير المخزون" />
            </SidebarGroup>

            <SidebarGroup label="الإدارة المالية" icon={Briefcase} activePathPrefix="/accounting">
              <SidebarItem to="/accounting" icon={Briefcase} label="لوحة الحسابات" />
              <SidebarItem to="/accounting/accounts" icon={FolderTree} label="دليل الحسابات" />
              <SidebarItem to="/accounting/cost-centers" icon={Building2} label="مراكز التكلفة" />
              <SidebarItem to="/accounting/currencies" icon={Coins} label="العملات" />
              <SidebarItem to="/accounting/check-stages" icon={ScrollText} label="مراحل الشيكات" />
              <SidebarItem to="/accounting/taxes" icon={Percent} label="الضرائب" />
              <SidebarItem to="/accounting/journal" icon={FileText} label="قيود اليومية" />
              <SidebarItem to="/accounting/cash" icon={Wallet} label="النقدية والصيرفة" />
            </SidebarGroup>

            <SidebarGroup
              label="النظام"
              icon={Settings}
              activePathPrefix={['/customers', '/admin', '/sales', '/cash', '/reports', '/settings']}
            >
              <SidebarItem to="/customers" icon={Users} label="العملاء" />
              <SidebarItem to="/admin/cashiers" icon={Users} label="إدارة الكاشير" />
              <SidebarItem to="/sales/history" icon={FileText} label="سجل المبيعات / History" />
              <SidebarItem to="/cash/reports" icon={Banknote} label="تقارير الكاش والشفتات" />
              <SidebarItem to="/reports" icon={BarChart3} label="تقارير المبيعات" />
              <SidebarItem to="/settings" icon={Settings} label="الإعدادات" />
            </SidebarGroup>
          </>
        ) : (
          <>
            <SidebarItem to="/pos" icon={ShoppingCart} label="نقطة البيع" />
            <SidebarItem
              to="/branch-management"
              icon={LayoutDashboard}
              label="إدارة الفرع"
              hasAlert={!!newTransferAlert}
              onAlertClick={() => setShowTransferModal(true)}
            />
          </>
        )}
      </nav>

      {/* New Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && newTransferAlert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTransferModal(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
              dir="rtl"
            >
              <div className="bg-blue-600 p-8 text-white relative">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Package className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">منتجات جديدة وصلت!</h3>
                    <p className="text-blue-100 text-sm font-medium">تم تحويل مخزون جديد لفرعك من المستودع الرئيسي</p>
                  </div>
                </div>
                <button onClick={() => setShowTransferModal(false)} className="absolute top-8 left-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8">
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                    <span className="text-sm font-black text-gray-400 uppercase tracking-widest">رقم الشحنة</span>
                    <span className="font-mono text-blue-600 font-bold">{newTransferAlert.id}</span>
                  </div>

                  <div className="space-y-4">
                    <h5 className="font-black text-gray-900 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      قائمة المنتجات المستلمة:
                    </h5>
                    <div className="max-h-60 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                      {newTransferAlert.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-3 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-all group">
                           <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 bg-white rounded-xl border border-gray-100 flex items-center justify-center text-sm font-black text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    {idx + 1}
                                 </div>
                                 <div>
                                    <p className="text-sm font-black text-gray-900 leading-tight">{item.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                       <span className="text-sm font-black text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">Barcode:</span>
                                       <span className="text-sm font-mono font-bold text-gray-600">{item.barcode || 'N/A'}</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="text-left">
                                 <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">السعر</p>
                                 <p className="text-sm font-black text-gray-900 font-sans">{formatCurrency(item.price || 0)}</p>
                              </div>
                           </div>
                           <div className="h-px bg-gray-200/50 w-full" />
                           <div className="flex justify-between items-center px-1">
                              <div className="flex items-center gap-4">
                                 <div className="flex flex-col">
                                    <span className="text-sm font-black text-gray-400 uppercase">الكمية</span>
                                    <span className="text-sm font-black text-blue-600 font-sans">{item.quantity} PCS</span>
                                 </div>
                              </div>
                              <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm text-left">
                                 <span className="text-sm font-black text-gray-400 uppercase block mb-0.5">الإجمالي الفرعي</span>
                                 <span className="text-sm font-black text-green-600 font-sans">{formatCurrency((item.price || 0) * (item.quantity || 0))}</span>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-400 uppercase">إجمالي الشحنة</span>
                      <span className="text-xl font-black text-gray-900 font-sans">{formatCurrency(newTransferAlert.total || 0)}</span>
                    </div>
                    <button
                      onClick={() => {
                        setShowTransferModal(false);
                        clearTransferAlert();
                      }}
                      className="bg-blue-600 text-white font-black px-10 py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                    >
                      حسناً، تم الاطلاع
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="p-4 border-t border-gray-50">
        <div className="bg-gray-50 p-4 rounded-xl flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm">
            {user?.name?.[0] || 'أ'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
            <p className="text-sm text-gray-500 truncate">{user?.role === 'ADMIN' ? 'مدير النظام' : 'كاشير'}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-2 w-full text-gray-400 hover:text-red-500 rounded-xl transition-colors group text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>خروج</span>
        </button>
      </div>
    </motion.aside>
  );
}


