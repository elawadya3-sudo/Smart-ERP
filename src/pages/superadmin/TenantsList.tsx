import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Plus, Search, CheckCircle2, XCircle, Clock, AlertTriangle,
  Edit2, Trash2, MoreVertical, ChevronDown, Filter, RefreshCw
} from 'lucide-react';
import { getAllTenantsAsSuperAdmin, updateTenantAsSuperAdmin, deleteTenantAsSuperAdmin } from '../../lib/tenantStorage';
import type { Tenant, TenantStatus, TenantPlan } from '../../types';
import { format, differenceInDays, parseISO } from 'date-fns';

const STATUS_CONFIG: Record<TenantStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active:    { label: 'نشطة',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: CheckCircle2 },
  trial:     { label: 'تجريبية', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: Clock },
  suspended: { label: 'معلقة',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: XCircle },
  expired:   { label: 'منتهية',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: AlertTriangle },
};

const PLAN_LABELS: Record<TenantPlan, string> = {
  basic: 'أساسية', pro: 'احترافية', enterprise: 'مؤسسية'
};

export default function TenantsList() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TenantStatus | 'all'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => { fetchTenants(); }, []);
  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const list = await getAllTenantsAsSuperAdmin();
      setTenants(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.adminEmail.toLowerCase().includes(search.toLowerCase()) ||
        t.dbId.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || t.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [tenants, search, filterStatus]);

  const handleStatusChange = async (tenant: Tenant, newStatus: TenantStatus) => {
    try {
      await updateTenantAsSuperAdmin(tenant.id, {
        status: newStatus,
      });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenant.id ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error(err);
    }
    setOpenMenuId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه النسخة نهائياً؟ لا يمكن التراجع.')) return;
    setDeletingId(id);
    try {
      await deleteTenantAsSuperAdmin(id);
      setTenants((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">النسخ المباعة</h1>
          <p className="text-sm" style={{ color: '#6b6b9a' }}>
            {tenants.length} نسخة مسجلة
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchTenants}
            className="p-2.5 rounded-xl transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)', color: '#6b6b9a' }}
            title="تحديث">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link to="/superadmin/tenants/new">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Plus className="w-4 h-4" />
              إضافة نسخة
            </button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6b6b9a' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الشركة، البريد، أو قاعدة البيانات..."
            className="w-full pr-10 pl-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(139,92,246,0.2)',
              color: '#e2e8f0',
              textAlign: 'right'
            }}
          />
        </div>
        <div className="relative">
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#6b6b9a' }} />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="pr-10 pl-8 py-3 rounded-xl text-sm outline-none appearance-none cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(139,92,246,0.2)',
              color: '#e2e8f0'
            }}
          >
            <option value="all">كل الحالات</option>
            <option value="active">نشطة</option>
            <option value="trial">تجريبية</option>
            <option value="suspended">معلقة</option>
            <option value="expired">منتهية</option>
          </select>
          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#6b6b9a' }} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold uppercase tracking-widest"
          style={{ background: 'rgba(139,92,246,0.06)', color: '#6b6b9a', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
          <div className="col-span-4">الشركة</div>
          <div className="col-span-2 hidden lg:block">قاعدة البيانات</div>
          <div className="col-span-2">الخطة</div>
          <div className="col-span-2">الحالة</div>
          <div className="col-span-1 hidden md:block">ينتهي</div>
          <div className="col-span-1 text-center">إجراءات</div>
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 rounded-full mx-auto mb-3"
              style={{ borderColor: '#8b5cf6', borderTopColor: 'transparent' }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: '#a78bfa' }} />
            <p className="text-sm font-medium" style={{ color: '#6b6b9a' }}>
              {search || filterStatus !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد نسخ مسجلة'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((tenant, i) => {
              const status = STATUS_CONFIG[tenant.status];
              const StatusIcon = status.icon;
              const daysLeft = differenceInDays(parseISO(tenant.expiresAt), new Date());
              return (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors border-b"
                  style={{
                    borderColor: 'rgba(139,92,246,0.06)',
                    opacity: deletingId === tenant.id ? 0.4 : 1
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Company */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <Building2 className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
                        className="font-bold text-sm text-white hover:underline truncate block text-right">
                        {tenant.name}
                      </button>
                      <p className="text-xs truncate" style={{ color: '#6b6b9a' }}>{tenant.adminEmail}</p>
                    </div>
                  </div>

                  {/* DB ID */}
                  <div className="col-span-2 hidden lg:block">
                    <code className="text-xs px-2 py-1 rounded-lg font-mono"
                      style={{ background: 'rgba(99,102,241,0.1)', color: '#a78bfa' }}>
                      {tenant.dbId}
                    </code>
                  </div>

                  {/* Plan */}
                  <div className="col-span-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{
                        background: tenant.plan === 'enterprise' ? 'rgba(251,191,36,0.1)' :
                          tenant.plan === 'pro' ? 'rgba(167,139,250,0.1)' : 'rgba(96,165,250,0.1)',
                        color: tenant.plan === 'enterprise' ? '#fbbf24' :
                          tenant.plan === 'pro' ? '#a78bfa' : '#60a5fa'
                      }}>
                      {PLAN_LABELS[tenant.plan]}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold w-fit"
                      style={{ background: status.bg, color: status.color }}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </div>
                  </div>

                  {/* Days left */}
                  <div className="col-span-1 hidden md:block">
                    <p className="text-xs font-bold"
                      style={{ color: daysLeft <= 0 ? '#6b7280' : daysLeft <= 7 ? '#f87171' : daysLeft <= 30 ? '#fbbf24' : '#4b5563' }}>
                      {daysLeft <= 0 ? 'منتهية' : `${daysLeft}ي`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex justify-center relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === tenant.id ? null : tenant.id);
                      }}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: '#6b6b9a' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {openMenuId === tenant.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-10 z-50 w-52 rounded-xl overflow-hidden"
                          style={{
                            background: '#1a1a3e',
                            border: '1px solid rgba(139,92,246,0.3)',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                          }}
                        >
                          <button onClick={() => navigate(`/superadmin/tenants/${tenant.id}/edit`)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-right"
                            style={{ color: '#e2e8f0' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.1)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                            <Edit2 className="w-3.5 h-3.5" /> تعديل
                          </button>
                          {tenant.status !== 'active' && (
                            <button onClick={() => handleStatusChange(tenant, 'active')}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-right"
                              style={{ color: '#4ade80' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,222,128,0.08)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> تفعيل
                            </button>
                          )}
                          {tenant.status !== 'suspended' && (
                            <button onClick={() => handleStatusChange(tenant, 'suspended')}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-right"
                              style={{ color: '#fbbf24' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(251,191,36,0.08)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                              <XCircle className="w-3.5 h-3.5" /> تعليق
                            </button>
                          )}
                          <div style={{ height: '1px', background: 'rgba(139,92,246,0.15)', margin: '4px 0' }} />
                          <button onClick={() => handleDelete(tenant.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-right"
                            style={{ color: '#f87171' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                            <Trash2 className="w-3.5 h-3.5" /> حذف نهائي
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
