import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Building2, LogOut, ShieldCheck, Plus, Settings,
  ChevronRight, Zap
} from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext';

const navItems = [
  { to: '/superadmin', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/superadmin/tenants', label: 'النسخ المباعة', icon: Building2, end: false },
  { to: '/superadmin/tenants/new', label: 'إضافة نسخة جديدة', icon: Plus, end: false },
];

export default function SuperAdminLayout() {
  const { logout } = useSuperAdmin();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/superadmin/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex" dir="rtl"
      style={{ background: '#0a0a1a', fontFamily: "'Cairo', 'Segoe UI', sans-serif" }}>

      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col"
        style={{
          background: 'rgba(15,12,41,0.95)',
          borderLeft: '1px solid rgba(139,92,246,0.2)',
          backdropFilter: 'blur(20px)'
        }}>

        {/* Logo */}
        <div className="p-6" style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-black text-white text-sm leading-tight">لوحة التحكم</p>
              <p className="text-xs" style={{ color: '#7c7ca8' }}>Super Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group ${
                  isActive ? 'sa-nav-active' : 'sa-nav-inactive'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))' : 'transparent',
                color: isActive ? '#a78bfa' : '#6b6b9a',
                border: isActive ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
              })}
            >
              {({ isActive }) => (
                <>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer / Logout */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(139,92,246,0.15)' }}>
          <div className="flex items-center gap-2 px-3 py-2 mb-3">
            <Zap className="w-3 h-3" style={{ color: '#6366f1' }} />
            <span className="text-xs font-medium" style={{ color: '#4a4a6a' }}>
              Session نشطة
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all"
            style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
            }}
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-4 flex-shrink-0"
          style={{
            background: 'rgba(15,12,41,0.6)',
            borderBottom: '1px solid rgba(139,92,246,0.1)',
            backdropFilter: 'blur(10px)'
          }}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" style={{ color: '#6366f1' }} />
            <span className="text-xs font-medium" style={{ color: '#6b6b9a' }}>
              Footprint ERP — Super Admin Control Panel
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>
              superadmin
            </span>
          </div>
        </div>

        {/* Page Content */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 p-8"
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 right-64 w-px h-full opacity-5"
          style={{ background: 'linear-gradient(to bottom, transparent, #8b5cf6, transparent)' }} />
        <div className="absolute -top-64 right-0 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
      </div>
    </div>
  );
}
