import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, ArrowRight, Edit2, Database, Mail, Phone, MapPin,
  Calendar, FileText, ShieldCheck, Users, Layers, CheckCircle2,
  XCircle, Clock, AlertTriangle, Trash2, Copy, ExternalLink, Check
} from 'lucide-react';
import { getTenantByIdAsSuperAdmin, updateTenantAsSuperAdmin, deleteTenantAsSuperAdmin } from '../../lib/tenantStorage';
import { MAIN_FIRESTORE_DB_ID } from '../../lib/firebase';
import type { Tenant, TenantStatus } from '../../types';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

const STATUS_CONFIG: Record<TenantStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active:    { label: 'نشطة',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)',   icon: CheckCircle2 },
  trial:     { label: 'تجريبية', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  icon: Clock },
  suspended: { label: 'معلقة',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: XCircle },
  expired:   { label: 'منتهية',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: AlertTriangle },
};

const PLAN_LABELS: Record<string, string> = {
  basic: 'أساسية', pro: 'احترافية', enterprise: 'مؤسسية'
};

function DetailRow({ icon: Icon, label, value, mono = false, copyable = false }: {
  icon: React.ElementType; label: string; value: string; mono?: boolean; copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(99,102,241,0.1)' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: '#8b5cf6' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold mb-0.5" style={{ color: '#6b6b9a' }}>{label}</p>
        <p className={`text-sm font-semibold text-white truncate ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
      </div>
      {copyable && (
        <button onClick={handleCopy} className="p-1.5 rounded-lg transition-colors flex-shrink-0"
          style={{ color: copied ? '#4ade80' : '#6b6b9a' }}
          title="نسخ">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

export default function TenantDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingStatus, setChangingStatus] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function fetchTenant() {
      const data = await getTenantByIdAsSuperAdmin(id);
      if (data) setTenant(data);
      setLoading(false);
    }
    fetchTenant();
  }, [id]);

  const handleStatusChange = async (newStatus: TenantStatus) => {
    if (!tenant) return;
    setChangingStatus(true);
    try {
      await updateTenantAsSuperAdmin(tenant.id, {
        status: newStatus,
      });
      setTenant((t) => t ? { ...t, status: newStatus } : t);
    } catch (err) {
      console.error(err);
    } finally {
      setChangingStatus(false);
    }
  };

  const tenantAdminUrl = (tenant: Tenant): string => {
    return tenant.dbId === MAIN_FIRESTORE_DB_ID
      ? window.location.origin
      : `${window.location.origin}/?db=${tenant.dbId}`;
  };

  const handleDelete = async () => {
    if (!tenant) return;
    if (!confirm('هل أنت متأكد من حذف هذه النسخة نهائياً؟')) return;
    await deleteTenantAsSuperAdmin(tenant.id);
    navigate('/superadmin/tenants', { replace: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 rounded-full"
          style={{ borderColor: '#8b5cf6', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-24" dir="rtl">
        <p className="text-white font-bold text-lg mb-2">النسخة غير موجودة</p>
        <Link to="/superadmin/tenants" className="text-sm" style={{ color: '#8b5cf6' }}>
          العودة للقائمة
        </Link>
      </div>
    );
  }

  const status = STATUS_CONFIG[tenant.status];
  const StatusIcon = status.icon;
  const daysLeft = differenceInDays(parseISO(tenant.expiresAt), new Date());

  return (
    <div className="max-w-4xl" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)}
            className="p-2.5 rounded-xl transition-colors flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}>
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white">{tenant.name}</h1>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: status.bg, color: status.color }}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </div>
            </div>
            <p className="text-sm mt-1" style={{ color: '#6b6b9a' }}>
              أُنشئت: {format(parseISO(tenant.createdAt), 'dd MMMM yyyy', { locale: ar })}
            </p>
          </div>
        </div>
        <Link to={`/superadmin/tenants/${tenant.id}/edit`}>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
            <Edit2 className="w-3.5 h-3.5" />
            تعديل
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Company Info */}
          <div className="p-6 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <h2 className="font-black text-white text-sm mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              بيانات الشركة
            </h2>
            <DetailRow icon={Mail}  label="البريد الإلكتروني" value={tenant.adminEmail} copyable />
            <DetailRow icon={Phone} label="رقم الهاتف"          value={tenant.contactPhone || '—'} />
            <DetailRow icon={MapPin} label="العنوان"            value={tenant.address || '—'} />
            {tenant.notes && (
              <DetailRow icon={FileText} label="ملاحظات" value={tenant.notes} />
            )}
          </div>

          {/* Database Info */}
          <div className="p-6 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <h2 className="font-black text-white text-sm mb-4 flex items-center gap-2">
              <Database className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              قاعدة البيانات
            </h2>
            <DetailRow icon={Database} label="Database ID" value={tenant.dbId} mono copyable />
            <div className="mt-4 p-3 rounded-xl flex items-center gap-3"
              style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#6366f1' }} />
              <a
                href={`https://console.firebase.google.com/project/_/firestore/databases/${tenant.dbId}/data`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium hover:underline"
                style={{ color: '#818cf8' }}>
                فتح في Firebase Console
              </a>
            </div>
          </div>

          {/* Subscription */}
          <div className="p-6 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <h2 className="font-black text-white text-sm mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              الاشتراك والحدود
            </h2>
            <DetailRow icon={Layers}   label="الخطة"           value={PLAN_LABELS[tenant.plan] || tenant.plan} />
            <DetailRow icon={Calendar} label="تاريخ الانتهاء"  value={format(parseISO(tenant.expiresAt), 'dd/MM/yyyy')} />
            <DetailRow icon={Users}    label="أقصى مستخدمين"   value={String(tenant.maxUsers || '—')} />
            <DetailRow icon={Building2} label="أقصى فروع"      value={String(tenant.maxBranches || '—')} />
          </div>
        </div>

        {/* Right column — actions */}
        <div className="space-y-5">
          {/* Days remaining */}
          <motion.div
            className="p-6 rounded-2xl text-center"
            style={{
              background: daysLeft <= 0 ? 'rgba(107,114,128,0.1)' :
                daysLeft <= 7 ? 'rgba(248,113,113,0.1)' :
                daysLeft <= 30 ? 'rgba(251,191,36,0.1)' :
                'rgba(74,222,128,0.1)',
              border: `1px solid ${daysLeft <= 0 ? 'rgba(107,114,128,0.3)' :
                daysLeft <= 7 ? 'rgba(248,113,113,0.3)' :
                daysLeft <= 30 ? 'rgba(251,191,36,0.3)' :
                'rgba(74,222,128,0.3)'}`
            }}>
            <p className="text-5xl font-black text-white mb-2">
              {daysLeft <= 0 ? '0' : daysLeft}
            </p>
            <p className="text-sm font-bold"
              style={{
                color: daysLeft <= 0 ? '#9ca3af' : daysLeft <= 7 ? '#f87171' :
                  daysLeft <= 30 ? '#fbbf24' : '#4ade80'
              }}>
              {daysLeft <= 0 ? 'انتهى الاشتراك' : 'يوم متبقٍ'}
            </p>
          </motion.div>

          {/* Open Admin Copy */}
          <div className="p-5 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <h3 className="font-black text-xs uppercase tracking-widest mb-3">الوصول للنسخة</h3>
            <p className="text-sm mb-4" style={{ color: '#6b6b9a' }}>افتح واجهة النسخة الإدارية موجهة إلى قاعدة بيانات هذه النسخة.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.open(tenantAdminUrl(tenant), '_blank')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <ExternalLink className="w-4 h-4" /> فتح النسخة الإدارية
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(tenantAdminUrl(tenant)); alert('تم نسخ الرابط'); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.12)', color: '#6b6b9a' }}>
                نسخ رابط الوصول
              </button>
            </div>
          </div>

          {/* Status Actions */}
          <div className="p-5 rounded-2xl space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <h3 className="font-black text-white text-xs uppercase tracking-widest mb-3">
              تغيير الحالة
            </h3>
            {(['active', 'trial', 'suspended', 'expired'] as TenantStatus[]).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={tenant.status === s || changingStatus}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed text-right"
                  style={{
                    background: tenant.status === s ? cfg.bg : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${tenant.status === s ? cfg.color + '40' : 'rgba(139,92,246,0.12)'}`,
                    color: tenant.status === s ? cfg.color : '#6b6b9a'
                  }}>
                  <Icon className="w-4 h-4" />
                  {cfg.label}
                  {tenant.status === s && <span className="mr-auto text-xs">✓ الحالي</span>}
                </button>
              );
            })}
          </div>

          {/* Danger Zone */}
          <div className="p-5 rounded-2xl"
            style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <h3 className="font-black text-xs uppercase tracking-widest mb-3" style={{ color: '#f87171' }}>
              منطقة خطرة
            </h3>
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}>
              <Trash2 className="w-4 h-4" />
              حذف النسخة نهائياً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
