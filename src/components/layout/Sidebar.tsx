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
  ChevronLeft,
  History as HistoryIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePOS } from '../../context/POSContext';
import { formatCurrency } from '../../lib/utils';
import { AnimatePresence } from 'motion/react';
import { X, CheckCircle2 } from 'lucide-react';
import { useMainStoreSettings } from '../../hooks/useMainStoreSettings';

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

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => void;
}

export default function Sidebar({ isOpen = false, setIsOpen }: SidebarProps) {
  const { signOut, user, tenant } = useAuth();
  const { newTransferAlert, clearTransferAlert } = usePOS();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const { settings } = useMainStoreSettings();

  const isModuleAllowed = (moduleId: string): boolean => {
    if (!tenant) return true;
    if (!tenant.allowedModules) return true;
    return tenant.allowedModules.includes(moduleId);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen?.(false)}
        />
      )}
      <motion.aside
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={cn(
          "w-64 h-screen bg-white border-l border-gray-100 fixed right-0 top-0 flex flex-col z-50 text-right transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
      <div className="p-6 border-b border-gray-50 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-100">
          <ShoppingCart className="text-white w-6 h-6" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">{settings?.storeName || 'رد أثر'}</h1>
          <span className="text-sm text-blue-600 font-bold uppercase tracking-widest leading-none">Smart ERP</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin">
        {user?.isRoot ? (
          // Hidden Master Admin Sidebar Menu
          <SidebarItem to="/settings" icon={Settings} label="صلاحيات النسخة" />
        ) : user?.role?.toUpperCase() === 'ADMIN' ? (
          <>
            {isModuleAllowed('dashboard') && (!user.permissions || user.permissions.dashboard) && (
              <SidebarItem to="/" icon={LayoutDashboard} label="لوحة التحكم" />
            )}

            {((isModuleAllowed('pos') && (!user.permissions || user.permissions.pos)) ||
              (isModuleAllowed('branchManagement') && (!user.permissions || user.permissions.branchManagement)) ||
              (isModuleAllowed('cashierManagement') && (!user.permissions || user.permissions.cashierManagement))) && (
              <SidebarGroup label="نقاط البيع" icon={ShoppingCart} activePathPrefix={['/pos', '/branch-management', '/admin/cashiers']}>
                {isModuleAllowed('pos') && (!user.permissions || user.permissions.pos) && (
                  <SidebarItem to="/pos" icon={ShoppingCart} label="نقطة البيع" />
                )}
                {isModuleAllowed('branchManagement') && (!user.permissions || user.permissions.branchManagement) && (
                  <SidebarItem to="/branch-management" icon={LayoutDashboard} label="إدارة الفرع" />
                )}
                {isModuleAllowed('cashierManagement') && (!user.permissions || user.permissions.cashierManagement) && (
                  <SidebarItem to="/admin/cashiers" icon={Users} label="إدارة الكاشير" />
                )}
              </SidebarGroup>
            )}

            {isModuleAllowed('inventory') && (!user.permissions || user.permissions.inventory) && (
              <SidebarGroup label="إدارة المخازن" icon={Database} activePathPrefix="/inventory">
                <SidebarItem to="/inventory" icon={LayoutDashboard} label="لوحة المخزون" />
                <SidebarItem to="/inventory/products" icon={Package} label="المنتجات والأصناف" />
                <SidebarItem to="/inventory/receipt" icon={ArrowDownLeft} label="توريد بضاعة" />
                <SidebarItem to="/inventory/transfers" icon={ArrowRightLeft} label="نقل مخزون" />
                <SidebarItem to="/inventory/stock-taking" icon={HistoryIcon} label="جرد المخزون" />
                <SidebarItem to="/inventory/warehouses" icon={Database} label="المستودعات" />
                <SidebarItem to="/inventory/reports" icon={BarChart3} label="تقارير المخزون" />
              </SidebarGroup>
            )}

            {isModuleAllowed('accounting') && (!user.permissions || user.permissions.accounting) && (
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
            )}

            {((isModuleAllowed('customers') && (!user.permissions || user.permissions.customers)) ||
              (isModuleAllowed('reports') && (!user.permissions || user.permissions.reports)) ||
              (isModuleAllowed('settings') && (!user.permissions || user.permissions.settings))) && (
              <SidebarGroup
                label="النظام"
                icon={Settings}
                activePathPrefix={['/customers', '/admin', '/sales', '/cash', '/reports', '/settings']}
              >
                {isModuleAllowed('customers') && (!user.permissions || user.permissions.customers) && (
                  <SidebarItem to="/customers" icon={Users} label="العملاء" />
                )}
                {isModuleAllowed('reports') && (!user.permissions || user.permissions.reports) && (
                  <>
                    <SidebarItem to="/sales/history" icon={FileText} label="سجل المبيعات / History" />
                    <SidebarItem to="/cash/reports" icon={Banknote} label="تقارير الكاش والشفتات" />
                    <SidebarItem to="/reports" icon={BarChart3} label="تقارير المبيعات" />
                  </>
                )}
                {isModuleAllowed('settings') && (!user.permissions || user.permissions.settings) && (
                  <SidebarItem to="/settings" icon={Settings} label="الإعدادات" />
                )}
              </SidebarGroup>
            )}
          </>
        ) : (
          <>
            <SidebarItem to="/pos" icon={ShoppingCart} label="نقطة البيع" />
            <SidebarItem
              to="/branch-management"
              icon={LayoutDashboard}
              label="إدارة الفرع"
            />
          </>
        )}
      </nav>


      <div className="p-4 border-t border-gray-50">
        <div className="bg-gray-50 p-4 rounded-xl flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm">
            {user?.name?.[0] || 'أ'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
            <p className="text-sm text-gray-500 truncate">{user?.isRoot ? 'المطور الرئيسي' : user?.role === 'ADMIN' ? 'مدير النظام' : 'كاشير'}</p>
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
    </>
  );
}


