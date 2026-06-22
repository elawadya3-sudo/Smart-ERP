import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

const ROUTE_LABELS: Record<string, string> = {
  '': 'الرئيسية',
  'dashboard': 'لوحة التحكم',
  'pos': 'نقطة البيع POS',
  'admin-pos': 'نقطة بيع المدير',
  'products': 'الأصناف',
  'customers': 'العملاء والولاء',
  'reports': 'التقارير والإحصائيات',
  'settings': 'الإعدادات العامة',
  'inventory': 'إدارة المخزون',
  'warehouses': 'المستودعات والفروع',
  'goods-receipt': 'توريد بضاعة',
  'accounts-payable': 'الحسابات الدائنة والموردين',
  'transfers': 'تحويلات المخزون',
  'stock-taking': 'جرد المخزون',
  'accounting': 'المحاسبة العامة',
  'journal-entries': 'قيود اليومية',
  'chart-of-accounts': 'دليل الحسابات',
  'cost-centers': 'مراكز التكلفة',
  'branch-management': 'إدارة الفروع والعمليات',
  'cash-reports': 'تقارير النقدية والورديات'
};

const getLabel = (segment: string): string => {
  const decoded = decodeURIComponent(segment);
  if (ROUTE_LABELS[decoded]) return ROUTE_LABELS[decoded];
  // If segment looks like a Firestore ID (longer alphanumeric string) or contains numbers
  if (decoded.length > 8 || /\d/.test(decoded)) {
    return 'تفاصيل السجل';
  }
  return decoded;
};

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  // Don't show breadcrumbs on login or POS pages
  if (location.pathname === '/login' || location.pathname.includes('/pos') || location.pathname.includes('/admin-pos')) {
    return null;
  }

  return (
    <nav className="flex mb-6" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-2 space-x-reverse bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-100/80 shadow-sm text-sm font-semibold">
        <li className="inline-flex items-center">
          <Link
            to="/"
            className="inline-flex items-center text-slate-500 hover:text-indigo-600 transition-colors gap-1.5"
          >
            <Home className="w-4 h-4" />
            <span>الرئيسية</span>
          </Link>
        </li>
        {pathnames.map((value, index) => {
          const last = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const label = getLabel(value);

          return (
            <li key={to} className="inline-flex items-center">
              <ChevronLeft className="w-4 h-4 text-slate-300 mx-1 md:mx-2" />
              {last ? (
                <span className="text-slate-800 font-bold" aria-current="page">
                  {label}
                </span>
              ) : (
                <Link
                  to={to}
                  className="text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
