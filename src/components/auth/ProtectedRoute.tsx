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
    if (path.startsWith('/reports') || path.startsWith('/sales') || path.startsWith('/cash')) return 'reports';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/branch-management')) return 'branchManagement';
    if (path.startsWith('/admin/cashiers')) return 'cashierManagement';
    return null;
  };

  const requiredPermission = getRequiredPermission(path);

  // Check if the tenant allows this module/section
  if (tenant && tenant.allowedModules && requiredPermission) {
    if (!tenant.allowedModules.includes(requiredPermission)) {
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

  if (user.role === 'ADMIN' && user.permissions) {
    const permissions = user.permissions as any;

    // 1. Handle auto-redirection from root if dashboard is disabled
    if (path === '/' && !permissions.dashboard) {
      const pathMap: Record<string, string> = {
        pos: '/pos',
        inventory: '/inventory',
        accounting: '/accounting',
        customers: '/customers',
        reports: '/reports',
        settings: '/settings',
        branchManagement: '/branch-management',
        cashierManagement: '/admin/cashiers'
      };

      // Find the first module the user HAS permission for
      const firstAllowedModule = Object.entries(pathMap).find(([key]) => permissions[key]);
      
      if (firstAllowedModule) {
        return <Navigate to={firstAllowedModule[1]} replace />;
      }
    }

    // 2. Block access if explicitly denied for the current module
    if (requiredPermission && !permissions[requiredPermission]) {
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

  return <>{children}</>;
}
