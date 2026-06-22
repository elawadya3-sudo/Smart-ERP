import React from 'react';
import { LucideIcon } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  ArrowUpRight,
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
  ChevronRight,
  History as HistoryIcon,
  Box,
  Layers,
  ShieldCheck,
  ChevronDown,
  Warehouse,
  PanelLeftClose,
  PanelLeftOpen,
  Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMainStoreSettings } from '../../hooks/useMainStoreSettings';

interface SidebarItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  hasAlert?: boolean;
  alertCount?: number;
  onAlertClick?: () => void;
  collapsed?: boolean;
  end?: boolean;
}

function SidebarItem({ to, icon: Icon, label, hasAlert, alertCount, onAlertClick, collapsed = false, end }: SidebarItemProps) {
  return (
    <div className="relative">
      <NavLink
        to={to}
        end={end}
        title={collapsed ? label : undefined}
        className={({ isActive }) =>
          cn(
            'group flex items-center gap-3 px-3.5 py-2 text-sm font-semibold transition-all duration-200 rounded-xl',
            collapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'w-full',
            isActive
              ? 'bg-blue-50/70 text-blue-600 font-bold border-r-[3px] border-blue-600 rounded-r-none'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn('h-4.5 w-4.5 shrink-0 transition-colors duration-200', isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600')} />
            {!collapsed && <span className="flex-1 text-right truncate">{label}</span>}
            {hasAlert && !collapsed && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="h-2 w-2 rounded-full bg-red-500"
              />
            )}
            {hasAlert && collapsed && (
              <div className="absolute top-1.5 left-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border border-white" />
            )}
          </>
        )}
      </NavLink>

      {hasAlert && !collapsed && (
        <button
          onClick={onAlertClick}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white"
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
  routeTo?: string;
  collapsed?: boolean;
}

function SidebarGroup({ label, icon: Icon, children, activePathPrefix, routeTo, collapsed = false }: SidebarGroupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isGroupActive = activePathPrefix
    ? (Array.isArray(activePathPrefix)
        ? activePathPrefix.some(prefix => location.pathname.startsWith(prefix))
        : location.pathname.startsWith(activePathPrefix))
    : false;

  useEffect(() => {
    if (activePathPrefix && !collapsed) {
      const prefixes = Array.isArray(activePathPrefix) ? activePathPrefix : [activePathPrefix];
      if (prefixes.some(prefix => location.pathname.startsWith(prefix))) {
        setIsOpen(true);
      }
    }
  }, [location.pathname, activePathPrefix, collapsed]);

  return (
    <div className="space-y-1">
      <button
        onClick={() => {
          if (routeTo) {
            navigate(routeTo);
          }
          if (!collapsed) {
            setIsOpen(!isOpen);
          }
        }}
        title={collapsed ? label : undefined}
        className={cn(
          'flex items-center justify-between rounded-xl px-3.5 py-2 text-sm font-bold transition-all duration-200',
          collapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'w-full',
          isOpen || isGroupActive
            ? 'bg-slate-50/70 text-slate-900 font-bold'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className={cn('h-4.5 w-4.5 transition-colors duration-200', (isOpen || isGroupActive) ? 'text-blue-600' : 'text-slate-400')} />
          {!collapsed && <span>{label}</span>}
        </div>
        {!collapsed && (
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', isOpen ? 'rotate-180 text-blue-600' : 'text-slate-400')} />
        )}
      </button>
      {!collapsed && (
        <div className={cn('overflow-hidden transition-all duration-300', isOpen ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0')}>
          <div className="mr-2 mt-1 space-y-1 border-r border-slate-100 pr-1.5 pb-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  // Legacy props (ignored, kept for compatibility)
  isOpen?: boolean;
  setIsOpen?: (v: boolean) => void;
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { signOut, user, tenant } = useAuth();
  const { settings } = useMainStoreSettings();

  const isModuleAllowed = (moduleId: string): boolean => {
    if (!tenant) return true;
    if (!tenant.allowedModules) return true;
    return tenant.allowedModules.includes(moduleId);
  };

  /**
   * Check if a granular permission key is allowed.
   * - If user has no permissions object → allowed (ADMIN default).
   * - If granular key exists on permissions object → use it.
   * - Otherwise fall back to the master key.
   */
  const hasPerm = (granularKey: keyof import('../../types').UserPermissions, masterKey?: keyof import('../../types').UserPermissions): boolean => {
    if (!user?.permissions) return true; // ADMIN / no restrictions
    const perms = user.permissions as any;
    if (granularKey in perms && perms[granularKey] !== undefined) {
      return !!perms[granularKey];
    }
    if (masterKey && masterKey in perms) {
      return !!perms[masterKey];
    }
    return false;
  };

  /** Returns true if ANY of the given keys is enabled (used to decide group visibility) */
  const hasAnyPerm = (...keys: Array<keyof import('../../types').UserPermissions>): boolean => {
    if (!user?.permissions) return true;
    const perms = user.permissions as any;
    return keys.some(k => !!perms[k]);
  };


  return (
    <aside
      className={cn(
        'flex h-full flex-col border-l border-slate-100 bg-white text-right transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-[60px]' : 'w-72'
      )}
    >
      {/* Sidebar Header */}
      <div className={cn(
        'flex items-center border-b border-slate-100 px-3 py-4 flex-shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/15">
              <ShoppingCart className="h-4.5 w-4.5" />
            </div>
            <div className="text-right">
              <h4 className="text-sm font-black text-slate-950 leading-none">
                {settings?.storeName || 'NEZAM PRO'}
              </h4>
              <span className="text-[8px] font-black text-blue-600 mt-1 block uppercase">ERP System</span>
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all"
        >
          {collapsed
            ? <ChevronLeft className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
        {user?.isRoot ? (
          <SidebarItem to="/settings" icon={Settings} label="صلاحيات النسخة" collapsed={collapsed} />
        ) : (user?.permissions || user?.role === 'ADMIN') ? (
          <>
            {isModuleAllowed('dashboard') && (!user.permissions || user.permissions.dashboard) && (
              <SidebarItem to="/" icon={LayoutDashboard} label="لوحة التحكم" collapsed={collapsed} />
            )}

            {((isModuleAllowed('pos') && (!user.permissions || user.permissions.pos)) ||
              (isModuleAllowed('pos') && (!user.permissions || user.permissions.adminPos)) ||
              (isModuleAllowed('branchManagement') && (!user.permissions || user.permissions.branchManagement)) ||
              (isModuleAllowed('cashierManagement') && (!user.permissions || user.permissions.cashierManagement))) && (
              <SidebarGroup label="نقاط البيع" icon={ShoppingCart} activePathPrefix={['/pos', '/pos/customers', '/branch-management', '/admin/cashiers', '/admin/pos']} collapsed={collapsed}>
                {isModuleAllowed('pos') && (!user.permissions || user.permissions.pos) && (
                  <SidebarItem to="/pos" icon={ShoppingCart} label="نقطة البيع" collapsed={collapsed} end />
                )}
                {isModuleAllowed('pos') && (!user.permissions || user.permissions.adminPos) && (
                  <SidebarItem to="/admin/pos" icon={ShoppingCart} label="POS للمدير" collapsed={collapsed} />
                )}
                {isModuleAllowed('branchManagement') && (!user.permissions || user.permissions.branchManagement) && (
                  <SidebarItem to="/branch-management" icon={LayoutDashboard} label="إدارة الفرع" collapsed={collapsed} />
                )}
                {isModuleAllowed('cashierManagement') && (!user.permissions || user.permissions.cashierManagement) && (
                  <SidebarItem to="/admin/cashiers" icon={Users} label="إدارة الكاشير" collapsed={collapsed} />
                )}
                {isModuleAllowed('pos') && (!user.permissions || user.permissions.pos) && (
                  <SidebarItem to="/pos/customers" icon={Users} label="إدارة العملاء" collapsed={collapsed} />
                )}
              </SidebarGroup>
            )}

            {isModuleAllowed('inventory') && hasAnyPerm('inventory', 'inventory_products', 'inventory_units', 'inventory_itemmap', 'inventory_warehouses', 'inventory_receipt', 'inventory_salesreturns', 'inventory_purchasereturns', 'inventory_issue', 'inventory_branchtransfer', 'inventory_transfers', 'inventory_opening', 'inventory_stocktaking', 'inventory_approval', 'inventory_payable', 'inventory_reports') && (
              <SidebarGroup label="المخازن" icon={Warehouse} activePathPrefix="/inventory" routeTo="/inventory" collapsed={collapsed}>
                {hasPerm('inventory', 'inventory') && <SidebarItem to="/inventory" icon={LayoutDashboard} label="لوحة المخزون" collapsed={collapsed} />}
                {(hasPerm('inventory_products', 'inventory') || hasPerm('inventory_units', 'inventory') || hasPerm('inventory_itemmap', 'inventory') || hasPerm('inventory_warehouses', 'inventory')) && (
                  <SidebarGroup label="بيانات أساسية" icon={Package} activePathPrefix={['/inventory/products', '/inventory/product-units', '/inventory/item-map', '/inventory/warehouses', '/inventory/product-ledger']} routeTo="/inventory/products" collapsed={collapsed}>
                    {hasPerm('inventory_products', 'inventory') && <SidebarItem to="/inventory/products" icon={Package} label="الأصناف" collapsed={collapsed} />}
                    {hasPerm('inventory_products', 'inventory') && <SidebarItem to="/inventory/product-ledger" icon={FileText} label="كشف حساب المنتج" collapsed={collapsed} />}
                    {hasPerm('inventory_units', 'inventory') && <SidebarItem to="/inventory/product-units" icon={Box} label="وحدات القياس" collapsed={collapsed} />}
                    {hasPerm('inventory_itemmap', 'inventory') && <SidebarItem to="/inventory/item-map" icon={Layers} label="خريطة الأصناف" collapsed={collapsed} />}
                    {hasPerm('inventory_warehouses', 'inventory') && <SidebarItem to="/inventory/warehouses" icon={Building2} label="المستودعات" collapsed={collapsed} />}
                  </SidebarGroup>
                )}
                {(hasPerm('inventory_receipt', 'inventory') || 
                  hasPerm('inventory_salesreturns', 'inventory') || 
                  hasPerm('inventory_transfers', 'inventory') ||
                  hasPerm('inventory_purchasereturns', 'inventory') ||
                  hasPerm('inventory_issue', 'inventory') ||
                  hasPerm('inventory_branchtransfer', 'inventory')
                ) && (
                  <SidebarGroup 
                    label="أوامر الشغل" 
                    icon={FileText} 
                    activePathPrefix={['/inventory/receipt', '/inventory/sales-returns', '/inventory/transfers', '/inventory/purchase-returns', '/inventory/stock-issue', '/inventory/branch-transfer-request']} 
                    collapsed={collapsed}
                  >
                    {(hasPerm('inventory_receipt', 'inventory') || hasPerm('inventory_salesreturns', 'inventory') || hasPerm('inventory_transfer_receipt', 'inventory')) && (
                      <SidebarGroup label="إستلام" icon={ArrowDownLeft} activePathPrefix={['/inventory/receipt', '/inventory/sales-returns', '/inventory/transfer-receipt']} collapsed={collapsed}>
                        {hasPerm('inventory_receipt', 'inventory') && <SidebarItem to="/inventory/receipt" icon={ArrowDownLeft} label="توريد بضاعة" collapsed={collapsed} />}
                        {hasPerm('inventory_salesreturns', 'inventory') && <SidebarItem to="/inventory/sales-returns" icon={ArrowRightLeft} label="مردودات مبيعات" collapsed={collapsed} />}
                        {hasPerm('inventory_transfer_receipt', 'inventory') && <SidebarItem to="/inventory/transfer-receipt" icon={ArrowDownLeft} label="استلام تحويل بضاعة" collapsed={collapsed} />}
                      </SidebarGroup>
                    )}
                    {(hasPerm('inventory_issue', 'inventory') || 
                      hasPerm('inventory_purchasereturns', 'inventory') || 
                      hasPerm('inventory_transfers', 'inventory') || 
                      hasPerm('inventory_branchtransfer', 'inventory')
                    ) && (
                      <SidebarGroup 
                        label="صرف" 
                        icon={ArrowUpRight} 
                        activePathPrefix={['/inventory/stock-issue', '/inventory/purchase-returns', '/inventory/transfers', '/inventory/branch-transfer-request']} 
                        collapsed={collapsed}
                      >
                        {hasPerm('inventory_issue', 'inventory') && <SidebarItem to="/inventory/stock-issue" icon={Database} label="صرف بضاعة" collapsed={collapsed} />}
                        {hasPerm('inventory_purchasereturns', 'inventory') && <SidebarItem to="/inventory/purchase-returns" icon={ArrowDownLeft} label="مردودات مشتريات" collapsed={collapsed} />}
                        {hasPerm('inventory_transfers', 'inventory') && <SidebarItem to="/inventory/transfers" icon={ArrowRightLeft} label="تحويل بضاعة" collapsed={collapsed} />}
                        {hasPerm('inventory_branchtransfer', 'inventory') && <SidebarItem to="/inventory/branch-transfer-request" icon={ArrowRightLeft} label="طلب تحويل بضاعة" collapsed={collapsed} />}
                      </SidebarGroup>
                    )}
                  </SidebarGroup>
                )}
                {hasPerm('inventory_opening', 'inventory') && <SidebarItem to="/inventory/opening-balance" icon={FileText} label="رصيد افتتاحي" collapsed={collapsed} />}
                {hasPerm('inventory_stocktaking', 'inventory') && <SidebarItem to="/inventory/stock-taking" icon={HistoryIcon} label="جرد المخزون" collapsed={collapsed} />}
                {hasPerm('inventory_approval', 'inventory') && <SidebarItem to="/inventory/approval" icon={ShieldCheck} label="تصديقات المخازن" collapsed={collapsed} />}
                {hasPerm('inventory_payable', 'inventory') && <SidebarItem to="/inventory/accounts-payable" icon={Wallet} label="الحسابات الدائنة" collapsed={collapsed} />}
                {hasPerm('inventory_reports', 'inventory') && <SidebarItem to="/inventory/reports" icon={BarChart3} label="تقارير المخزون" collapsed={collapsed} />}
              </SidebarGroup>
            )}

            {isModuleAllowed('accounting') && hasAnyPerm('accounting', 'accounting_chart', 'accounting_costcenters', 'accounting_currencies', 'accounting_checkstages', 'accounting_taxes', 'accounting_journal', 'accounting_cash') && (
              <SidebarGroup label="الحسابات" icon={Briefcase} activePathPrefix="/accounting" routeTo="/accounting" collapsed={collapsed}>
                {hasPerm('accounting', 'accounting') && <SidebarItem to="/accounting" icon={Briefcase} label="لوحة الحسابات" collapsed={collapsed} />}
                {hasPerm('accounting_chart', 'accounting') && <SidebarItem to="/accounting/accounts" icon={FolderTree} label="دليل الحسابات" collapsed={collapsed} />}
                {hasPerm('accounting_costcenters', 'accounting') && <SidebarItem to="/accounting/cost-centers" icon={Building2} label="مراكز التكلفة" collapsed={collapsed} />}
                {hasPerm('accounting_currencies', 'accounting') && <SidebarItem to="/accounting/currencies" icon={Coins} label="العملات" collapsed={collapsed} />}
                {hasPerm('accounting_checkstages', 'accounting') && <SidebarItem to="/accounting/check-stages" icon={ScrollText} label="مراحل الشيكات" collapsed={collapsed} />}
                {hasPerm('accounting_taxes', 'accounting') && <SidebarItem to="/accounting/taxes" icon={Percent} label="الضرائب" collapsed={collapsed} />}
                {hasPerm('accounting_journal', 'accounting') && <SidebarItem to="/accounting/journal" icon={FileText} label="قيود اليومية" collapsed={collapsed} />}
                {hasPerm('accounting_cash', 'accounting') && <SidebarItem to="/accounting/cash" icon={Wallet} label="النقدية والصيرفة" collapsed={collapsed} />}
              </SidebarGroup>
            )}

            {((isModuleAllowed('customers') && hasPerm('customers')) ||
              (isModuleAllowed('reports') && (hasPerm('reports') || hasPerm('reports_history') || hasPerm('reports_cash') || hasPerm('reports_center'))) ||
              (isModuleAllowed('settings') && hasPerm('settings'))) && (
              <SidebarGroup
                label="النظام"
                icon={Settings}
                activePathPrefix={['/customers', '/admin', '/sales', '/cash', '/reports', '/settings']}
                collapsed={collapsed}
              >
                {isModuleAllowed('customers') && hasPerm('customers') && (
                  <SidebarItem to="/customers" icon={Users} label="العملاء" collapsed={collapsed} />
                )}
                {isModuleAllowed('reports') && hasPerm('reports_history', 'reports') && (
                  <SidebarItem to="/sales/history" icon={FileText} label="سجل المبيعات / History" collapsed={collapsed} />
                )}
                {isModuleAllowed('reports') && hasPerm('reports_cash', 'reports') && (
                  <SidebarItem to="/cash/reports" icon={Banknote} label="تقارير الكاش والشفتات" collapsed={collapsed} />
                )}
                {isModuleAllowed('reports') && hasPerm('reports', 'reports') && (
                  <SidebarItem to="/reports" icon={BarChart3} label="تقارير المبيعات" collapsed={collapsed} />
                )}
                {isModuleAllowed('reports') && hasPerm('reports_center', 'reports') && (
                  <SidebarItem to="/reports/center" icon={BarChart3} label="مركز التقارير الموحد" collapsed={collapsed} />
                )}
                {isModuleAllowed('settings') && hasPerm('settings') && (
                  <SidebarItem to="/settings" icon={Settings} label="الإعدادات" collapsed={collapsed} />
                )}
              </SidebarGroup>
            )}
          </>
        ) : (
          <>
            <SidebarItem to="/pos" icon={ShoppingCart} label="نقطة البيع" collapsed={collapsed} />
            <SidebarItem to="/branch-management" icon={LayoutDashboard} label="إدارة الفرع" collapsed={collapsed} />
          </>
        )}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-slate-100 p-3">
        {!collapsed && (
          <div className="mb-2.5 flex items-center gap-3 rounded-xl bg-slate-50/70 border border-slate-100/50 p-2.5 transition-all duration-200">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-blue-600 text-sm font-bold text-white shadow-sm">
              {user?.name?.[0] || 'أ'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900 leading-tight">{user?.name}</p>
              <p className="truncate text-[10px] text-slate-500 font-bold mt-0.5">
                {user?.isRoot
                  ? 'المطور الرئيسي'
                  : user?.role === 'ADMIN'
                    ? 'مدير النظام'
                    : user?.role === 'BRANCH_MANAGER'
                      ? 'مدير فرع'
                      : user?.role === 'WAREHOUSE_MANAGER'
                        ? 'مدير مخزن'
                        : user?.role === 'CASHIER'
                          ? 'كاشير'
                          : user?.role === 'SALES'
                            ? 'موظف مبيعات'
                            : user?.role === 'PURCHASES'
                              ? 'موظف مشتريات'
                              : user?.role === 'HR'
                                ? 'موظف HR'
                                : user?.role === 'ACCOUNTANT'
                                  ? 'محاسب'
                                  : user?.role}
              </p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="mb-2.5 flex justify-center">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-blue-600 text-sm font-bold text-white shadow-sm" title={user?.name}>
              {user?.name?.[0] || 'أ'}
            </div>
          </div>
        )}

        <button
          onClick={signOut}
          title={collapsed ? 'خروج' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-400 transition hover:bg-red-50 hover:text-red-500 w-full',
            collapsed && 'justify-center px-0 w-11 h-11 mx-auto'
          )}
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span>خروج</span>}
        </button>
      </div>
    </aside>
  );
}
