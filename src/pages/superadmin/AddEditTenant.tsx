import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Save, ArrowRight, Database, Mail, Phone, MapPin,
  Calendar, FileText, ShieldCheck, Users, Layers, Info, Sparkles,
  Zap, CheckCircle2
} from 'lucide-react';
import { createTenantAsSuperAdmin, updateTenantAsSuperAdmin, getTenantByIdAsSuperAdmin } from '../../lib/tenantStorage';
import { ensureSuperAdminSession } from '../../lib/superAdminAuth';
import type { Tenant, TenantStatus, TenantPlan } from '../../types';
import { format, addMonths, addYears } from 'date-fns';
import firebaseConfig from '../../../firebase-applet-config.json';

// ─── Current app's Firebase database ID (from config) ────────────────────────
const CURRENT_APP_DB_ID: string = (firebaseConfig as any).firestoreDatabaseId ?? 'default';
const CURRENT_APP_PROJECT: string = (firebaseConfig as any).projectId ?? '';

const AVAILABLE_MODULES = [
  { id: 'dashboard', label: 'لوحة التحكم' },
  { id: 'pos', label: 'نقطة البيع' },
  { id: 'inventory', label: 'إدارة المخازن' },
  { id: 'sales', label: 'المبيعات' },
  { id: 'accounting', label: 'الإدارة المالية' },
  { id: 'customers', label: 'العملاء' },
  { id: 'reports', label: 'التقارير' },
  { id: 'settings', label: 'الإعدادات' },
  { id: 'branchManagement', label: 'إدارة الفروع' },
  { id: 'cashierManagement', label: 'إدارة الكاشير' },
  { id: 'systemReset', label: 'إعادة تهيئة النظام' },
];

interface FormData {
  name: string;
  dbId: string;
  adminEmail: string;
  contactPhone: string;
  address: string;
  status: TenantStatus;
  plan: TenantPlan;
  maxUsers: string;
  maxBranches: string;
  expiresAt: string;
  notes: string;
  allowedModules: string[];
}

const INITIAL: FormData = {
  name: '', dbId: '', adminEmail: '', contactPhone: '', address: '',
  status: 'trial', plan: 'basic',
  maxUsers: '5', maxBranches: '1',
  expiresAt: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
  notes: '',
  allowedModules: AVAILABLE_MODULES.map(m => m.id),
};

/** Pre-filled data for the current running app instance */
const CURRENT_APP_PRESET: FormData = {
  name: 'NEZAM PRO — النسخة الرئيسية',
  dbId: CURRENT_APP_DB_ID,
  adminEmail: 'admin@nezampro.local',
  contactPhone: '',
  address: '',
  status: 'active',
  plan: 'enterprise',
  maxUsers: '999',
  maxBranches: '999',
  expiresAt: format(addYears(new Date(), 10), 'yyyy-MM-dd'),
  notes: `نسخة التطوير الرئيسية للتطبيق\nFirebase Project: ${CURRENT_APP_PROJECT}\nDatabase ID: ${CURRENT_APP_DB_ID}`,
  allowedModules: AVAILABLE_MODULES.map(m => m.id),
};

function FormField({ label, icon: Icon, required, hint, children }: {
  label: string; icon: React.ElementType; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#7c7ca8' }}>
        <Icon className="w-3 h-3" style={{ color: '#6366f1' }} />
        {label}
        {required && <span style={{ color: '#f87171' }}>*</span>}
      </label>
      {children}
      {hint && <p className="text-xs px-1" style={{ color: '#4a4a6a' }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(99,102,241,0.25)',
  color: '#e2e8f0',
};

function StyledInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
      style={{ ...inputStyle, textAlign: 'right' }}
      onFocus={(e) => { e.target.style.borderColor = 'rgba(139,92,246,0.6)'; props.onFocus?.(e); }}
      onBlur={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.25)'; props.onBlur?.(e); }}
    />
  );
}

function StyledSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none appearance-none cursor-pointer"
      style={{ ...inputStyle, textAlign: 'right' }}
    >
      {children}
    </select>
  );
}

function StyledTextarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={3}
      className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none resize-none"
      style={{ ...inputStyle, textAlign: 'right' }}
      onFocus={(e) => { e.target.style.borderColor = 'rgba(139,92,246,0.6)'; }}
      onBlur={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.25)'; }}
    />
  );
}

export default function AddEditTenant() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [presetApplied, setPresetApplied] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      const fetchTenant = async () => {
        try {
          const data = await getTenantByIdAsSuperAdmin(id);
          if (data) {
            setForm({
              name: data.name,
              dbId: data.dbId,
              adminEmail: data.adminEmail,
              contactPhone: data.contactPhone || '',
              address: data.address || '',
              status: data.status,
              plan: data.plan,
              maxUsers: String(data.maxUsers || 5),
              maxBranches: String(data.maxBranches || 1),
              expiresAt: data.expiresAt.split('T')[0],
              notes: data.notes || '',
              allowedModules: data.allowedModules || AVAILABLE_MODULES.map(m => m.id),
            });
          }
        } catch (err) {
          console.error('Error loading tenant for edit:', err);
        } finally {
          setFetching(false);
        }
      };
      fetchTenant();
    }
  }, [id, isEdit]);

  useEffect(() => {
    ensureSuperAdminSession().catch((err) => {
      console.error('Super admin session initialization failed:', err);
      setError('فشل تهيئة جلسة superadmin. يرجى تسجيل الدخول مرة أخرى أو إعادة تحميل الصفحة.');
    });
  }, []);

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  /** Apply current app preset to form */
  const applyCurrentAppPreset = () => {
    setForm(CURRENT_APP_PRESET);
    setPresetApplied(true);
    setTimeout(() => setPresetApplied(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const dbIdClean = form.dbId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!dbIdClean) {
      setError('معرّف قاعدة البيانات مطلوب');
      setLoading(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      dbId: dbIdClean,
      adminEmail: form.adminEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      address: form.address.trim(),
      status: form.status,
      plan: form.plan,
      maxUsers: parseInt(form.maxUsers) || 5,
      maxBranches: parseInt(form.maxBranches) || 1,
      expiresAt: new Date(form.expiresAt).toISOString(),
      notes: form.notes.trim(),
      updatedAt: new Date().toISOString(),
      allowedModules: form.allowedModules || AVAILABLE_MODULES.map(m => m.id),
    };

    try {
      await ensureSuperAdminSession();

      if (isEdit && id) {
        await updateTenantAsSuperAdmin(id, payload);
      } else {
        await createTenantAsSuperAdmin(payload);
      }
      setSuccess(true);
      setTimeout(() => navigate('/superadmin/tenants'), 1200);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.includes('Missing or insufficient permissions')
          ? 'فشل الوصول إلى Firestore. يرجى التأكد من تسجيل دخول superadmin المجهول وأن المصادقة المجهولة مفعّلة.'
          : 'حدث خطأ أثناء الحفظ: ' + message
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 rounded-full"
          style={{ borderColor: '#8b5cf6', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)}
          className="p-2.5 rounded-xl transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}>
          <ArrowRight className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-white">
            {isEdit ? 'تعديل النسخة' : 'إضافة نسخة جديدة'}
          </h1>
          <p className="text-sm" style={{ color: '#6b6b9a' }}>
            {isEdit ? 'تحديث بيانات النسخة المباعة' : 'تسجيل نسخة جديدة مباعة من البرنامج'}
          </p>
        </div>
      </div>

      {/* ═══ Current App Quick-Register Banner (only in Add mode) ═══ */}
      {!isEdit && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-5 rounded-2xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
            border: '1px solid rgba(139,92,246,0.35)',
          }}
        >
          {/* Glow decoration */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-black text-white text-sm mb-1">
                  تسجيل التطبيق الحالي بضغطة واحدة
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#a78bfa' }}>
                  سيتم تعبئة بيانات النسخة الحالية تلقائياً
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Zap className="w-3 h-3" style={{ color: '#6366f1' }} />
                  <code className="text-xs font-mono px-2 py-0.5 rounded-md"
                    style={{ background: 'rgba(99,102,241,0.2)', color: '#c4b5fd' }}>
                    {CURRENT_APP_DB_ID}
                  </code>
                </div>
              </div>
            </div>
            <AnimatePresence mode="wait">
              {presetApplied ? (
                <motion.div
                  key="applied"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  تم التعبئة!
                </motion.div>
              ) : (
                <motion.button
                  key="btn"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  onClick={applyCurrentAppPreset}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black flex-shrink-0 text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  <Sparkles className="w-3.5 h-3.5" />
                  تعبئة تلقائية
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error / Success */}
        {error && (
          <div className="p-4 rounded-2xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl text-sm text-center font-bold"
            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
            ✅ تم الحفظ بنجاح! جاري الانتقال...
          </motion.div>
        )}

        {/* Section: Basic Info */}
        <div className="p-6 rounded-2xl space-y-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4" style={{ color: '#8b5cf6' }} />
            <h2 className="font-black text-white text-sm">بيانات الشركة</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="اسم الشركة" icon={Building2} required>
              <StyledInput value={form.name} onChange={set('name')} placeholder="شركة ABC للتجزئة" required />
            </FormField>
            <FormField label="البريد الإلكتروني" icon={Mail} required>
              <StyledInput type="email" value={form.adminEmail} onChange={set('adminEmail')} placeholder="admin@company.com" required />
            </FormField>
            <FormField label="رقم الهاتف" icon={Phone}>
              <StyledInput value={form.contactPhone} onChange={set('contactPhone')} placeholder="+20 100 000 0000" />
            </FormField>
            <FormField label="العنوان" icon={MapPin}>
              <StyledInput value={form.address} onChange={set('address')} placeholder="القاهرة، مصر" />
            </FormField>
          </div>
        </div>

        {/* Section: Database */}
        <div className="p-6 rounded-2xl space-y-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4" style={{ color: '#8b5cf6' }} />
            <h2 className="font-black text-white text-sm">إعدادات قاعدة البيانات</h2>
          </div>
          <FormField label="معرّف قاعدة البيانات (Database ID)" icon={Database} required
            hint="يجب أن يكون مطابقاً لاسم Firestore Named Database في Firebase Console (أحرف صغيرة وأرقام وشرطات فقط)">
            <StyledInput
              value={form.dbId}
              onChange={set('dbId')}
              placeholder="company-abc-db"
              pattern="[a-z0-9\-]+"
              required
              style={{ fontFamily: 'monospace', ...inputStyle, textAlign: 'left' }}
            />
          </FormField>
          <div className="flex items-start gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#818cf8' }} />
            <p className="text-xs" style={{ color: '#818cf8', lineHeight: '1.7' }}>
              قم بإنشاء قاعدة البيانات أولاً من <strong>Firebase Console → Firestore → Create Database</strong>،
              ثم أدخل اسمها هنا بالضبط. هذا الاسم سيُستخدم لتوجيه كل عمليات النسخة لقاعدة بياناتها الخاصة.
            </p>
          </div>
        </div>

        {/* Section: Subscription */}
        <div className="p-6 rounded-2xl space-y-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4" style={{ color: '#8b5cf6' }} />
            <h2 className="font-black text-white text-sm">إعدادات الاشتراك</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="الحالة" icon={ShieldCheck}>
              <StyledSelect value={form.status} onChange={set('status')}>
                <option value="trial">تجريبية</option>
                <option value="active">نشطة</option>
                <option value="suspended">معلقة</option>
                <option value="expired">منتهية</option>
              </StyledSelect>
            </FormField>
            <FormField label="الخطة" icon={Layers}>
              <StyledSelect value={form.plan} onChange={set('plan')}>
                <option value="basic">أساسية</option>
                <option value="pro">احترافية</option>
                <option value="enterprise">مؤسسية</option>
              </StyledSelect>
            </FormField>
            <FormField label="تاريخ الانتهاء" icon={Calendar} required>
              <StyledInput type="date" value={form.expiresAt} onChange={set('expiresAt')} required
                style={{ ...inputStyle, textAlign: 'left' }} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="أقصى مستخدمين" icon={Users}>
                <StyledInput type="number" min="1" value={form.maxUsers} onChange={set('maxUsers')} />
              </FormField>
              <FormField label="أقصى فروع" icon={Building2}>
                <StyledInput type="number" min="1" value={form.maxBranches} onChange={set('maxBranches')} />
              </FormField>
            </div>
          </div>
        </div>

        {/* Section: Modules / Permissions */}
        <div className="p-6 rounded-2xl space-y-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4" style={{ color: '#8b5cf6' }} />
            <h2 className="font-black text-white text-sm">الأقسام والوحدات المتاحة لهذه النسخة</h2>
          </div>
          <p className="text-xs" style={{ color: '#6b6b9a' }}>
            اختر الأقسام التي تريد إظهارها وتفعيلها لعميلك. الأقسام غير المحددة سيتم إخفاؤها تماماً من النظام ولن يتمكن مدير النظام للعميل من تعيينها للموظفين.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AVAILABLE_MODULES.map((module) => {
              const isChecked = form.allowedModules?.includes(module.id) ?? false;
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => {
                    const current = form.allowedModules || [];
                    const next = current.includes(module.id)
                      ? current.filter(id => id !== module.id)
                      : [...current, module.id];
                    setForm(f => ({ ...f, allowedModules: next }));
                  }}
                  className="flex items-center justify-between p-3.5 rounded-xl border transition-all text-right font-medium text-xs"
                  style={{
                    background: isChecked ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                    borderColor: isChecked ? '#8b5cf6' : 'rgba(139,92,246,0.12)',
                    color: isChecked ? '#c4b5fd' : '#7c7ca8'
                  }}
                >
                  <span>{module.label}</span>
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center transition-all border"
                    style={{
                      background: isChecked ? '#8b5cf6' : 'transparent',
                      borderColor: isChecked ? '#8b5cf6' : 'rgba(139,92,246,0.3)'
                    }}
                  >
                    {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="p-6 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <FormField label="ملاحظات" icon={FileText}>
            <StyledTextarea value={form.notes} onChange={set('notes')} placeholder="أي ملاحظات خاصة بهذه النسخة..." />
          </FormField>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <motion.button
            type="submit"
            disabled={loading || success}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {loading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'حفظ التعديلات' : 'إنشاء النسخة'}
              </>
            )}
          </motion.button>
          <button type="button" onClick={() => navigate(-1)}
            className="px-6 py-4 rounded-xl font-bold text-sm transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)', color: '#6b6b9a' }}>
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
