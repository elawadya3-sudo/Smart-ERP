import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShoppingCart, Package, Briefcase, BarChart3, Users, Settings,
  Building2, LayoutDashboard, CheckCircle2, XCircle, Shield,
  Loader2, Save, Coins
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SystemModule {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  isCore?: boolean;
}

const SYSTEM_MODULES: SystemModule[] = [
  { id: 'dashboard',         name: 'لوحة التحكم',         description: 'لوحة الإحصاءات والأداء الرئيسية', icon: LayoutDashboard, color: 'blue', isCore: true },
  { id: 'pos',               name: 'نقطة البيع (POS)',      description: 'شاشة البيع المباشر للكاشير',          icon: ShoppingCart, color: 'indigo' },
  { id: 'branchManagement',  name: 'إدارة الفرع',           description: 'إدارة الفروع والعمليات اليومية',       icon: Building2, color: 'purple' },
  { id: 'cashierManagement', name: 'إدارة الكاشيرين',       description: 'إنشاء حسابات الكاشير وإدارتهم',        icon: Users, color: 'violet' },
  { id: 'inventory',         name: 'إدارة المخازن',          description: 'مستودعات، توريد، جرد، تحويلات',        icon: Package, color: 'green' },
  { id: 'sales',             name: 'إدارة المبيعات',         description: 'عروض أسعار، أوامر بيع، مرتجعات، عملاء، تقارير مبيعية', icon: Coins, color: 'blue' },
  { id: 'accounting',        name: 'الإدارة المالية',         description: 'محاسبة، قيود يومية، مراكز تكلفة',      icon: Briefcase, color: 'amber' },
  { id: 'customers',         name: 'إدارة العملاء',           description: 'بيانات العملاء، النقاط، الرصيد',       icon: Users, color: 'pink' },
  { id: 'reports',           name: 'مركز التقارير',          description: 'تقارير المبيعات والمخزون والكاش',      icon: BarChart3, color: 'cyan' },
  { id: 'settings',          name: 'الإعدادات',              description: 'إعدادات المتجر والضرائب والفروع',      icon: Settings, color: 'slate' },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-100' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-100' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-100' },
  pink:   { bg: 'bg-pink-50',   text: 'text-pink-600',   border: 'border-pink-100' },
  cyan:   { bg: 'bg-cyan-50',   text: 'text-cyan-600',   border: 'border-cyan-100' },
  slate:  { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-100' },
};

export default function SystemModules() {
  const [enabled, setEnabled] = useState<Set<string>>(
    new Set(SYSTEM_MODULES.map(m => m.id))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => {
    if (SYSTEM_MODULES.find(m => m.id === id)?.isCore) return; // core modules always on
    setEnabled(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 700));
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900">وحدات النظام</h1>
          </div>
          <p className="text-gray-400 font-medium">تحكم في الوحدات المتاحة للمستأجرين — تفعيل أو تعطيل كل وحدة بشكل مستقل</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-lg',
            saved
              ? 'bg-green-500 text-white shadow-green-100'
              : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'جارٍ الحفظ...' : saved ? 'تم الحفظ!' : 'حفظ الإعدادات'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-black text-blue-600">{SYSTEM_MODULES.length}</p>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">إجمالي الوحدات</p>
        </div>
        <div className="bg-gray-900 rounded-2xl shadow-xl p-5 text-center">
          <p className="text-3xl font-black text-green-400">{enabled.size}</p>
          <p className="text-xs font-black text-green-500 uppercase tracking-widest mt-1">وحدات مفعّلة</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-black text-gray-400">{SYSTEM_MODULES.length - enabled.size}</p>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">وحدات معطّلة</p>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SYSTEM_MODULES.map((module, idx) => {
          const Icon = module.icon;
          const isOn = enabled.has(module.id);
          const c = COLOR_MAP[module.color] ?? COLOR_MAP.blue;
          return (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => toggle(module.id)}
              className={cn(
                'relative bg-white rounded-3xl border-2 p-6 cursor-pointer transition-all duration-200 select-none',
                isOn ? `border-blue-200 shadow-lg shadow-blue-50` : 'border-gray-100 shadow-sm opacity-60',
                module.isCore ? 'cursor-default' : 'hover:shadow-md hover:-translate-y-0.5'
              )}
            >
              {module.isCore && (
                <span className="absolute top-4 left-4 text-[9px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                  أساسي
                </span>
              )}
              <div className="flex items-start justify-between mb-4">
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', c.bg, c.text)}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                  isOn ? 'bg-green-50 text-green-500' : 'bg-gray-100 text-gray-300'
                )}>
                  {isOn ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">{module.name}</h3>
              <p className="text-sm text-gray-400 font-medium leading-relaxed">{module.description}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
