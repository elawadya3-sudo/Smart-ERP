import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, CheckCircle2, XCircle, Clock, AlertTriangle,
  TrendingUp, Plus, ChevronLeft, Activity, Layers
} from 'lucide-react';
import { getAllTenantsAsSuperAdmin } from '../../lib/tenantStorage';
import type { Tenant, TenantStatus } from '../../types';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

const STATUS_CONFIG: Record<TenantStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active:    { label: 'نشطة',     color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   icon: CheckCircle2 },
  trial:     { label: 'تجريبية',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  icon: Clock },
  suspended: { label: 'معلقة',    color: '#f87171', bg: 'rgba(248,113,113,0.1)', icon: XCircle },
  expired:   { label: 'منتهية',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: AlertTriangle },
};

const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
  basic:      { label: 'أساسية',    color: '#60a5fa' },
  pro:        { label: 'احترافية',  color: '#a78bfa' },
  enterprise: { label: 'مؤسسية',   color: '#fbbf24' },
};

function StatCard({ icon: Icon, label, value, color, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="p-6 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(139,92,246,0.15)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)'
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-3xl font-black text-white mb-1">{value}</p>
      <p className="text-sm font-medium" style={{ color: '#6b6b9a' }}>{label}</p>
    </motion.div>
  );
}

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const list = await getAllTenantsAsSuperAdmin();
      setTenants(list);
    } catch (err) {
      console.error('Error fetching tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === 'active').length,
    trial: tenants.filter((t) => t.status === 'trial').length,
    expiringSoon: tenants.filter((t) => {
      const days = differenceInDays(parseISO(t.expiresAt), new Date());
      return days >= 0 && days <= 30 && t.status === 'active';
    }).length,
  };

  const recentTenants = tenants.slice(0, 5);

  return (
    <div className="space-y-8" dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">لوحة التحكم</h1>
          <p className="text-sm" style={{ color: '#6b6b9a' }}>
            إدارة جميع النسخ المباعة من البرنامج
          </p>
        </div>
        <Link to="/superadmin/tenants/new">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Plus className="w-4 h-4" />
            إضافة نسخة جديدة
          </motion.button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Layers}      label="إجمالي النسخ"     value={stats.total}         color="#a78bfa" delay={0} />
        <StatCard icon={CheckCircle2} label="نسخ نشطة"         value={stats.active}        color="#4ade80" delay={0.1} />
        <StatCard icon={Clock}        label="نسخ تجريبية"      value={stats.trial}         color="#fbbf24" delay={0.2} />
        <StatCard icon={AlertTriangle} label="تنتهي قريباً"    value={stats.expiringSoon}  color="#f87171" delay={0.3} />
      </div>

      {/* Recent Tenants */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(139,92,246,0.15)'
        }}
      >
        <div className="flex items-center justify-between p-6"
          style={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5" style={{ color: '#8b5cf6' }} />
            <h2 className="font-black text-white">آخر النسخ المضافة</h2>
          </div>
          <Link
            to="/superadmin/tenants"
            className="flex items-center gap-1 text-xs font-bold transition-colors"
            style={{ color: '#8b5cf6' }}
          >
            عرض الكل
            <ChevronLeft className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3"
            />
            <p className="text-sm" style={{ color: '#6b6b9a' }}>جاري التحميل...</p>
          </div>
        ) : recentTenants.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: '#a78bfa' }} />
            <p className="text-sm font-medium" style={{ color: '#6b6b9a' }}>
              لا توجد نسخ مباعة حتى الآن
            </p>
            <Link to="/superadmin/tenants/new"
              className="inline-flex items-center gap-1 mt-3 text-sm font-bold"
              style={{ color: '#8b5cf6' }}>
              <Plus className="w-3 h-3" /> إضافة أول نسخة
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(139,92,246,0.08)' }}>
            {recentTenants.map((tenant, i) => {
              const status = STATUS_CONFIG[tenant.status];
              const plan = PLAN_CONFIG[tenant.plan] || PLAN_CONFIG.basic;
              const daysLeft = differenceInDays(parseISO(tenant.expiresAt), new Date());
              const StatusIcon = status.icon;
              return (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="flex items-center gap-4 p-4 px-6 transition-colors"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => window.location.href = `/superadmin/tenants/${tenant.id}`}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <Building2 className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{tenant.name}</p>
                    <p className="text-xs truncate" style={{ color: '#6b6b9a' }}>{tenant.adminEmail}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: plan.color + '18', color: plan.color }}>
                    {plan.label}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: status.bg, color: status.color }}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </div>
                  <div className="text-xs font-medium w-20 text-center"
                    style={{ color: daysLeft <= 7 ? '#f87171' : daysLeft <= 30 ? '#fbbf24' : '#6b6b9a' }}>
                    {daysLeft > 0 ? `${daysLeft} يوم` : 'منتهية'}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
