import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Users, BarChart3, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PosNavbar() {
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { id: 'pos', label: 'شاشة الكاشير والبيع', path: '/pos', icon: ShoppingCart },
    { id: 'customers', label: 'إدارة العملاء', path: '/pos/customers', icon: Users },
    { id: 'reports', label: 'تقارير المبيعات والورديات', path: '/pos/reports', icon: /^\/pos\/reports/.test(path) ? BarChart3 : BarChart3 },
    { id: 'settings', label: 'إعدادات نقاط البيع', path: '/pos/settings', icon: Settings },
  ];

  // Also match exact paths or sub-paths
  const getIsActive = (tabPath: string) => {
    if (tabPath === '/pos') {
      return path === '/pos';
    }
    return path.startsWith(tabPath);
  };

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-xl p-1 mb-6 flex flex-wrap gap-1 shadow-sm select-none" dir="rtl">
      {tabs.map((tab) => {
        const isActive = getIsActive(tab.path);
        return (
          <Link
            key={tab.id}
            to={tab.path}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition-all active:scale-95",
              isActive
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
