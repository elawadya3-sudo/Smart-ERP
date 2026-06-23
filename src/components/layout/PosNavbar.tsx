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
    { id: 'reports', label: 'تقارير المبيعات والورديات', path: '/pos/reports', icon: BarChart3 },
    { id: 'settings', label: 'إعدادات نقاط البيع', path: '/pos/settings', icon: Settings },
  ];

  const getIsActive = (tabPath: string) => {
    if (tabPath === '/pos') {
      return path === '/pos';
    }
    return path.startsWith(tabPath);
  };

  return (
    <div 
      className="inline-flex items-center space-x-1 md:space-x-2 space-x-reverse bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-100/80 shadow-sm text-sm font-semibold select-none mb-6 w-full flex-wrap gap-y-2 no-print" 
      dir="rtl"
    >
      {tabs.map((tab) => {
        const isActive = getIsActive(tab.path);
        return (
          <Link
            key={tab.id}
            to={tab.path}
            className={cn(
              "px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 text-xs font-black",
              isActive
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-800"
            )}
          >
            <tab.icon className="w-4.5 h-4.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
