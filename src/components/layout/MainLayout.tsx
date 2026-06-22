import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import CommandPalette from '../ui/CommandPalette';
import { useAuth } from '../../context/AuthContext';
import { useRecordNavigatorStore } from '../../store/recordNavigatorStore';
import RecordNavigator from '../ui/RecordNavigator';
import Breadcrumbs from '../ui/Breadcrumbs';
import { ShieldCheck, Cloud, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function MainLayout() {
  const { user, tenant } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const recordNav = useRecordNavigatorStore();
  const location = useLocation();

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[var(--color-background)] overflow-hidden" dir="rtl">
      {/* 1. Navbar - full width at top */}
      <Navbar
        onMenuClick={() => setIsSidebarCollapsed(prev => !prev)}
        onSearchClick={() => setIsCommandPaletteOpen(true)}
      />

      {/* 2. Body: Persistent Sidebar + Page Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar - always visible, shrinks to icon-only when collapsed */}
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(prev => !prev)}
        />

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto min-w-0 flex flex-col justify-between">
          <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
            <Breadcrumbs />
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
            {recordNav.visible && recordNav.total > 0 && (
              <div className="mt-8 border-t border-slate-100 pt-6">
                <RecordNavigator
                  currentIndex={recordNav.currentIndex}
                  total={recordNav.total}
                  label={recordNav.label}
                  onFirst={recordNav.onFirst || (() => {})}
                  onPrevious={recordNav.onPrevious || (() => {})}
                  onNext={recordNav.onNext || (() => {})}
                  onLast={recordNav.onLast || (() => {})}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* 3. Status Footer */}
      <footer className="h-11 flex-shrink-0 z-40 border-t border-slate-100 bg-white px-5 flex items-center justify-between text-[11px] font-bold text-slate-400 select-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>نظام البصمة الذكية ERP</span>
          </span>
          <span className="h-3.5 w-px bg-slate-100" />
          <span className="font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-slate-500 text-[10px]">
            v2.4.1-stable
          </span>
        </div>
        <div className="hidden md:flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>قاعدة البيانات: متصلة</span>
          </span>
          <span className="h-3 w-px bg-slate-200" />
          <span className="flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-slate-400" />
            <span>الخدمات السحابية: متزامنة</span>
          </span>
          <span className="h-3 w-px bg-slate-200" />
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>وقت الاستجابة: 24ms</span>
          </span>
        </div>
        <div>
          <span>© {new Date().getFullYear()} NEZAM PRO. جميع الحقوق محفوظة.</span>
        </div>
      </footer>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
