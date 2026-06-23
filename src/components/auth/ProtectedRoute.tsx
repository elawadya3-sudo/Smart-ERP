import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, tenant, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check tenant status
  if (tenant && (tenant.status === 'expired' || tenant.status === 'suspended')) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl border border-red-50 text-center space-y-8">
          <div className="w-24 h-24 bg-red-50 rounded-[2rem] flex items-center justify-center text-red-500 mx-auto shadow-inner">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">
              {tenant.status === 'expired' ? 'النسخة منتهية' : 'النسخة معطلة'}
            </h2>
            <p className="text-gray-500 font-bold leading-relaxed">
              {tenant.status === 'expired' 
                ? 'عذراً، انتهت فترة اشتراك هذه النسخة. يرجى التواصل مع الإدارة لتجديد الاشتراك.'
                : 'عذراً، تم إيقاف هذه النسخة مؤقتاً. يرجى التواصل مع الإدارة.'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => signOut()}
              className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-800 transition-all"
            >
              <LogOut className="w-5 h-5" />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if Cashier has an assigned branch
  if (user.role === 'CASHIER' && !user.branchId) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl border border-red-50 text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-red-500 mx-auto">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-gray-900">وصول غير مصرح به</h2>
            <p className="text-gray-500 font-medium">لم يتم تخصيص فرع لحسابك بعد. يرجى مراجعة إدارة النظام لتخصيص فرع لك للتمكن من دخول النظام.</p>
          </div>
          <button 
            onClick={() => signOut()}
            className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-800 transition-all"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  // Check if user has permissions for the current route
  const path = location.pathname;
  
  const getRequiredPermission = (path: string): string | null => {
    if (path === '/') return 'dashboard';
    if (path.startsWith('/pos')) return 'pos';
    if (path.startsWith('/inventory')) return 'inventory';
    if (path.startsWith('/accounting')) return 'accounting';
    if (path.startsWith('/customers')) return 'customers';
    if (path.startsWith('/sales') && path !== '/sales/history') return 'sales';
    if (path.startsWith('/reports') || path.startsWith('/cash') || path === '/sales/history') return 'reports';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/branch-management')) return 'branchManagement';
    if (path.startsWith('/admin/cashiers')) return 'cashierManagement';
    return null;
  };

  const requiredPermission = getRequiredPermission(path);

  // Check if the tenant allows this module/section
  if (tenant && tenant.allowedModules && requiredPermission) {
    if (requiredPermission !== 'sales' && !tenant.allowedModules.includes(requiredPermission)) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6" dir="rtl">
          <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl border border-red-50 text-center space-y-8">
            <div className="w-24 h-24 bg-red-50 rounded-[2rem] flex items-center justify-center text-red-500 mx-auto shadow-inner">
              <ShieldAlert className="w-12 h-12" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">القسم غير متاح</h2>
              <p className="text-gray-500 font-bold leading-relaxed">عذراً، هذا القسم غير متاح في خطة اشتراكك الحالية. يرجى التواصل مع الإدارة لترقية اشتراكك وتفعيل هذا القسم.</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  if (user.role !== 'ADMIN' && !user.isRoot && user.permissions) {
    const permissions = user.permissions as any;

    // 1. Handle auto-redirection from root if dashboard is disabled
    if (path === '/' && !permissions.dashboard) {
      // Include granular sub-keys so cashiers with only sub-permissions get redirected correctly
      const pathMap: Array<[string, string]> = [
        ['pos', '/pos'],
        ['inventory', '/inventory'],
        ['inventory_products', '/inventory/products'],
        ['inventory_receipt', '/inventory/receipt'],
        ['inventory_salesreturns', '/inventory/sales-returns'],
        ['inventory_transfer_receipt', '/inventory/transfer-receipt'],
        ['inventory_purchasereturns', '/inventory/purchase-returns'],
        ['inventory_issue', '/inventory/stock-issue'],
        ['inventory_transfers', '/inventory/transfers'],
        ['inventory_stocktaking', '/inventory/stock-taking'],
        ['inventory_approval', '/inventory/approval'],
        ['inventory_payable', '/inventory/accounts-payable'],
        ['inventory_reports', '/inventory/reports'],
        ['accounting', '/accounting'],
        ['accounting_journal', '/accounting/journal'],
        ['accounting_cash', '/accounting/cash'],
        ['accounting_chart', '/accounting/accounts'],
        ['customers', '/customers'],
        ['reports', '/reports'],
        ['reports_history', '/sales/history'],
        ['reports_cash', '/cash/reports'],
        ['reports_center', '/reports/center'],
        ['settings', '/settings'],
        ['branchManagement', '/branch-management'],
        ['cashierManagement', '/admin/cashiers'],
      ];

      const firstAllowedModule = pathMap.find(([key]) => !!permissions[key]);
      if (firstAllowedModule) {
        return <Navigate to={firstAllowedModule[1]} replace />;
      }
    }

    // 2. Block access if explicitly denied for the current path.
    // Supports both master keys (e.g. `inventory`) and granular sub-keys
    // (e.g. `inventory_products`). A user is allowed if EITHER the master key
    // OR the specific sub-key for the current path is true.
    if (requiredPermission) {
      // Mapping from exact URL path to its granular permission key
      const subKeyMap: Record<string, string> = {
        '/inventory/products':                'inventory_products',
        '/inventory/product-ledger':          'inventory_products',
        '/inventory/product-units':           'inventory_units',
        '/inventory/item-map':                'inventory_itemmap',
        '/inventory/warehouses':              'inventory_warehouses',
        '/inventory/receipt':                 'inventory_receipt',
        '/inventory/sales-returns':           'inventory_salesreturns',
        '/inventory/transfer-receipt':        'inventory_transfer_receipt',
        '/inventory/purchase-returns':        'inventory_purchasereturns',
        '/inventory/stock-issue':             'inventory_issue',
        '/inventory/branch-transfer-request': 'inventory_branchtransfer',
        '/inventory/transfers':               'inventory_transfers',
        '/inventory/opening-balance':         'inventory_opening',
        '/inventory/stock-taking':            'inventory_stocktaking',
        '/inventory/approval':                'inventory_approval',
        '/inventory/accounts-payable':        'inventory_payable',
        '/inventory/reports':                 'inventory_reports',
        '/accounting/accounts':               'accounting_chart',
        '/accounting/cost-centers':           'accounting_costcenters',
        '/accounting/currencies':             'accounting_currencies',
        '/accounting/check-stages':           'accounting_checkstages',
        '/accounting/taxes':                  'accounting_taxes',
        '/accounting/journal':                'accounting_journal',
        '/accounting/cash':                   'accounting_cash',
        '/cash/reports':                      'reports_cash',
        '/sales/history':                     'reports_history',
        '/reports/center':                    'reports_center',
        '/sales/basic/customers':            'sales_basic',
        '/sales/basic/reps':                 'sales_basic',
        '/sales/basic/services':             'sales_basic',
        '/sales/basic/sales-show':           'sales_basic',
        '/sales/basic/branches':             'sales_basic',
        '/sales/basic/quotas':               'sales_basic',
        '/sales/basic/targets':              'sales_basic',
        '/sales/basic/incentives':           'sales_basic',
        '/sales/basic/price-lists':          'sales_basic',
        '/sales/config/customer-settings':   'sales_config',
        '/sales/config/settings':            'sales_config',
        '/sales/docs/order':                 'sales_docs',
        '/sales/docs/return':                'sales_docs',
        '/sales/docs/recurring':             'sales_docs',
        '/sales/docs/quotations':            'sales_docs',
        '/sales/approvals/general':          'sales_approvals',
        '/sales/approvals/returns':          'sales_approvals',
        '/sales/approvals/deliveries':       'sales_approvals',
        '/sales/reports/orders':             'sales_reports',
        '/sales/reports/sales':              'sales_reports',
        '/sales/reports/profit':             'sales_reports',
        '/sales/reports/customer-eval':      'sales_reports',
        '/sales/reports/target':             'sales_reports',
        '/sales/reports/periods':            'sales_reports',
      };

      // All granular sub-keys that belong to each master section
      const sectionSubKeys: Record<string, string[]> = {
        inventory: [
          'inventory', 'inventory_products', 'inventory_units', 'inventory_itemmap',
          'inventory_warehouses', 'inventory_receipt', 'inventory_salesreturns',
          'inventory_transfer_receipt', 'inventory_purchasereturns', 'inventory_issue',
          'inventory_branchtransfer', 'inventory_transfers', 'inventory_opening',
          'inventory_stocktaking', 'inventory_approval', 'inventory_payable', 'inventory_reports',
        ],
        accounting: [
          'accounting', 'accounting_chart', 'accounting_costcenters', 'accounting_currencies',
          'accounting_checkstages', 'accounting_taxes', 'accounting_journal', 'accounting_cash',
        ],
        reports: [
          'reports', 'reports_cash', 'reports_history', 'reports_center',
        ],
        sales: [
          'sales', 'sales_basic', 'sales_config', 'sales_docs', 'sales_approvals', 'sales_reports',
        ],
      };

      const hasAccess = (() => {
        // Master key granted → allow
        if (permissions[requiredPermission]) return true;

        const subKeys = sectionSubKeys[requiredPermission];
        if (subKeys) {
          // Exact sub-path key match
          const exactSubKey = subKeyMap[path];
          if (exactSubKey) return !!permissions[exactSubKey];
          // Section root — allow if any sub-key is enabled
          return subKeys.some(k => !!permissions[k]);
        }
        return false;
      })();

      if (!hasAccess) {
        return (
          <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6" dir="rtl">
            <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl border border-blue-50 text-center space-y-8">
              <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 mx-auto shadow-inner">
                <ShieldAlert className="w-12 h-12" />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">منطقة محظورة</h2>
                <p className="text-gray-500 font-bold leading-relaxed">عذراً، ليس لديك الصلاحيات الكافية للوصول إلى هذا القسم. يرجى مراجعة المسؤول الرئيسي لتعديل صلاحياتك.</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => window.location.href = '/'}
                  className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all"
                >
                  العودة للرئيسية
                </button>
                <button 
                  onClick={() => signOut()}
                  className="w-full bg-gray-50 text-gray-400 font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  تسجيل الخروج
                </button>
              </div>
            </div>
          </div>
        );
      }
    }
  }

  return <>{children}</>;
}
