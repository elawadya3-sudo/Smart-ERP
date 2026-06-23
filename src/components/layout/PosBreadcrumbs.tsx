import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { House, ChevronLeft } from 'lucide-react';

export default function PosBreadcrumbs() {
  const location = useLocation();
  const path = location.pathname;

  let pageName = 'نقاط البيع';
  if (path === '/pos') {
    pageName = 'نقطة البيع والكاشير';
  } else if (path === '/branch-management') {
    pageName = 'إدارة الفروع والعمليات';
  } else if (path === '/pos/customers') {
    pageName = 'إدارة عملاء نقاط البيع';
  } else if (path.startsWith('/pos/reports')) {
    pageName = 'تقرير مبيعات نقاط البيع';
  } else if (path.startsWith('/pos/settings')) {
    pageName = 'إعدادات نقاط البيع';
  }

  return (
    <nav className="flex mb-6 no-print" aria-label="Breadcrumb" dir="rtl">
      <ol className="inline-flex items-center space-x-1 md:space-x-2 space-x-reverse bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-100/80 shadow-sm text-sm font-semibold">
        <li className="inline-flex items-center">
          <Link 
            to="/" 
            className="inline-flex items-center text-slate-500 hover:text-[var(--color-primary)] transition-colors gap-1.5"
          >
            <House className="w-4 h-4" />
            <span>الرئيسية</span>
          </Link>
        </li>
        <li className="inline-flex items-center">
          <ChevronLeft className="w-4 h-4 text-slate-300 mx-1 md:mx-2" />
          <span className="text-slate-800 font-bold" aria-current="page">
            {pageName}
          </span>
        </li>
      </ol>
    </nav>
  );
}
