import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Star,
  Wallet,
  Pencil,
  Trash2,
  X,
  Gift,
  TrendingUp,
  Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer, Warehouse } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { useRecordNavigatorStore } from '../store/recordNavigatorStore';
import {
  ErpPageLayout,
  ErpPageHeader,
  ErpStatCard,
  ErpCard,
  ErpButton,
  ErpInput,
  ErpBadge
} from '../components/ui/ErpUI';

// ─── Customer Service ─────────────────────────────────────────────────────────
const customersService = {
  async getAll(): Promise<Customer[]> {
    try {
      const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[];
    } catch {
      return [];
    }
  },
  async add(c: Omit<Customer, 'id' | 'createdAt'>) {
    return addDoc(collection(db, 'customers'), { ...c, points: 0, balance: 0, createdAt: new Date().toISOString() });
  },
  async update(id: string, data: Partial<Customer>) {
    return updateDoc(doc(db, 'customers', id), data);
  },
  async delete(id: string) {
    return deleteDoc(doc(db, 'customers', id));
  }
};

// ─── Customer Modal ───────────────────────────────────────────────────────────
function CustomerModal({
  isOpen,
  onClose,
  onSave,
  initial,
  warehouses
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initial: Customer | null;
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', points: 0, balance: 0, branchId: 'ADMIN' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        phone: initial.phone,
        email: initial.email || '',
        points: initial.points,
        balance: initial.balance,
        branchId: initial.branchId || 'ADMIN'
      });
    } else {
      setForm({ name: '', phone: '', email: '', points: 0, balance: 0, branchId: 'ADMIN' });
    }
  }, [initial, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="text-right">
              <h3 className="text-lg font-black text-slate-900">{initial ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">ملف العميل في نظام الولاء وتحديد الفرع</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-right">
            <ErpInput
              label="اسم العميل *"
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="الاسم الكامل"
              required
            />
            <ErpInput
              label="رقم الهاتف *"
              type="tel"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="01xxxxxxxxx"
              required
            />
            <ErpInput
              label="البريد الإلكتروني"
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="email@example.com"
            />
            
            {/* Branch / Warehouse selector */}
            <div className="text-right">
              <label className="text-xs font-black text-slate-400 block mb-2">الفرع التابع له العميل</label>
              <div className="relative">
                <select
                  value={form.branchId}
                  onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all text-right appearance-none cursor-pointer"
                >
                  <option value="ADMIN">البيع المباشر (الأدمن)</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
              </div>
            </div>

            {initial && (
              <div className="grid grid-cols-2 gap-4">
                <ErpInput
                  label="النقاط المتاحة"
                  type="number"
                  value={form.points}
                  onChange={e => setForm(p => ({ ...p, points: Number(e.target.value) }))}
                  min={0}
                />
                <ErpInput
                  label="الرصيد الائتماني"
                  type="number"
                  value={form.balance}
                  onChange={e => setForm(p => ({ ...p, balance: Number(e.target.value) }))}
                  min={0}
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <ErpButton type="button" variant="secondary" onClick={onClose} className="flex-1">
                إلغاء
              </ErpButton>
              <ErpButton
                type="submit"
                variant="primary"
                loading={saving}
                className="flex-1"
              >
                {initial ? 'حفظ التعديلات' : 'إضافة العميل'}
              </ErpButton>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Loyalty Tier ─────────────────────────────────────────────────────────────
function getLoyaltyTier(points: number) {
  if (points >= 5000) return { label: 'بلاتيني', color: 'text-purple-600 bg-purple-50', icon: Crown };
  if (points >= 2000) return { label: 'ذهبي', color: 'text-yellow-600 bg-yellow-50', icon: Star };
  if (points >= 500) return { label: 'فضي', color: 'text-gray-500 bg-gray-100', icon: Gift };
  return { label: 'عادي', color: 'text-blue-600 bg-blue-50', icon: Users };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Fetch warehouses
  useEffect(() => {
    const q = query(collection(db, 'warehouses'));
    const unsub = onSnapshot(q, (snapshot) => {
      setWarehouses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
    });
    return () => unsub();
  }, []);

  const load = async () => {
    setLoading(true);
    const data = await customersService.getAll();
    setCustomers(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c => {
    const matchesBranch = selectedBranchId === '' || (c.branchId || 'ADMIN') === selectedBranchId;
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.phone.includes(search) ||
                          (c.email || '').toLowerCase().includes(search.toLowerCase());
    return matchesBranch && matchesSearch;
  });

  const handleSave = async (data: any) => {
    if (editing) {
      await customersService.update(editing.id, data);
    } else {
      await customersService.add(data);
    }
    await load();
  };

  const handleDelete = async (c: Customer) => {
    if (window.confirm(`هل أنت متأكد من حذف العميل "${c.name}"؟`)) {
      await customersService.delete(c.id);
      if (selected?.id === c.id) setSelected(null);
      await load();
    }
  };

  const totalPoints = customers.reduce((s, c) => s + c.points, 0);
  const totalBalance = customers.reduce((s, c) => s + c.balance, 0);

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title="العملاء والولاء"
        description="إدارة ملفات العملاء، نقاط الولاء، والرصيد الائتماني"
        breadcrumbs={[{ label: 'الرئيسية' }, { label: 'العملاء والولاء' }]}
        actions={
          <>
            {/* Branch selector dropdown */}
            <div className="relative w-full sm:w-48">
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all text-right appearance-none cursor-pointer"
              >
                <option value="">كل الفروع</option>
                <option value="ADMIN">البيع المباشر (الأدمن)</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="البحث بالاسم، رقم الهاتف..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pr-10 pl-4 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all text-right"
              />
            </div>
            <ErpButton variant="primary" icon={Plus} onClick={() => { setEditing(null); setModalOpen(true); }}>
              إضافة عميل جديد
            </ErpButton>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ErpStatCard title="إجمالي العملاء" value={customers.length} icon={Users} color="blue" change="عميل مسجل" trend="up" />
        <ErpStatCard title="إجمالي النقاط" value={totalPoints.toLocaleString('ar-EG')} icon={Star} color="indigo" change="نقطة ولاء" trend="up" />
        <ErpStatCard title="إجمالي الأرصدة" value={formatCurrency(totalBalance)} icon={Wallet} color="purple" change="رصيد ائتماني" trend="up" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Customer List */}
        <div className="lg:col-span-2">
          <ErpCard title="قائمة العملاء المسجلين" subtitle="عرض وتعديل ملفات العملاء وتعديل نقاط الولاء">
            <div className="overflow-y-auto max-h-[calc(100vh-340px)] scrollbar-thin divide-y divide-slate-50 pr-1">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 font-bold">جاري تحميل العملاء...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-bold italic">
                    {search ? 'لا يوجد عملاء بهذا البحث' : 'لا يوجد عملاء مسجلين بعد'}
                  </p>
                </div>
              ) : (
                filtered.map(customer => {
                  const tier = getLoyaltyTier(customer.points);
                  const TierIcon = tier.icon;
                  const isSelected = selected?.id === customer.id;
                  return (
                    <motion.div
                      key={customer.id}
                      layout
                      className={cn(
                        "py-3.5 px-4 rounded-2xl flex items-center gap-4 hover:bg-slate-50/80 transition-all cursor-pointer group mt-2 first:mt-0 border border-transparent",
                        isSelected && "bg-blue-50/50 hover:bg-blue-50/60 border-blue-100/50 shadow-sm"
                      )}
                      onClick={() => setSelected(customer)}
                    >
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-base shrink-0 shadow-sm">
                        {customer.name.charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-slate-900 text-sm truncate">{customer.name}</p>
                          <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0", tier.color)}>
                            <TierIcon className="w-2.5 h-2.5" />
                            {tier.label}
                          </span>
                          <span className="bg-slate-100/80 text-slate-500 text-[9px] px-2 py-0.5 rounded-md shrink-0 font-black border border-slate-200/30">
                            الفرع: {customer.branchId === 'ADMIN' || !customer.branchId ? 'البيع المباشر' : (warehouses.find(w => w.id === customer.branchId)?.name || 'غير معروف')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-bold">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-300" /> {customer.phone}
                          </span>
                          {customer.email && (
                            <span className="flex items-center gap-1 truncate max-w-[150px]">
                              <Mail className="w-3.5 h-3.5 text-slate-300" /> {customer.email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Points & Balance */}
                      <div className="text-left shrink-0 pl-2">
                        <p className="text-xs font-black text-amber-600">{customer.points.toLocaleString('ar-EG')} نقطة</p>
                        <p className="text-xs font-extrabold text-slate-500 mt-1">{formatCurrency(customer.balance)}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <ErpButton type="button" variant="secondary" onClick={e => { e.stopPropagation(); setEditing(customer); setModalOpen(true); }} icon={Pencil} className="py-1 px-2 text-xs" />
                        <ErpButton type="button" variant="danger" onClick={e => { e.stopPropagation(); handleDelete(customer); }} icon={Trash2} className="py-1 px-2 text-xs" />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </ErpCard>
        </div>

        {/* Customer Profile Panel */}
        <div>
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {/* Profile Card */}
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-6 rounded-[2rem] text-white relative overflow-hidden shadow-lg shadow-blue-100">
                  <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                  <button
                    onClick={() => setSelected(null)}
                    className="absolute top-4 left-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-black mb-3 shadow-inner">
                    {selected.name.charAt(0)}
                  </div>
                  <h3 className="text-xl font-black truncate">{selected.name}</h3>
                  <p className="text-blue-100 mt-1 flex items-center gap-1.5 text-xs font-bold">
                    <Phone className="w-3.5 h-3.5" /> {selected.phone}
                  </p>
                  {selected.email && (
                    <p className="text-blue-100 mt-0.5 flex items-center gap-1.5 text-xs font-bold truncate">
                      <Mail className="w-3.5 h-3.5" /> {selected.email}
                    </p>
                  )}
                  <p className="text-blue-200 text-[10px] font-bold mt-4 border-t border-white/20 pt-3 select-none">
                    عضو منذ: {formatDate(selected.createdAt)}
                  </p>
                </div>

                {/* Loyalty Stats */}
                <ErpCard title="برنامج الولاء" subtitle="تفاصيل التقييم والنقاط للعميل الحالي">
                  <div className="space-y-4">
                    {(() => {
                      const tier = getLoyaltyTier(selected.points);
                      const TierIcon = tier.icon;
                      return (
                        <div className={cn("p-3.5 rounded-xl flex items-center gap-3", tier.color)}>
                          <TierIcon className="w-5 h-5 shrink-0" />
                          <div>
                            <p className="font-black text-sm">مستوى {tier.label}</p>
                            <p className="text-xs opacity-80 font-bold mt-0.5">{selected.points.toLocaleString('ar-EG')} نقطة مجمّعة</p>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100/50">
                        <p className="text-[10px] text-slate-400 font-black uppercase mb-1">النقاط</p>
                        <p className="text-lg font-black text-amber-600">{selected.points.toLocaleString('ar-EG')}</p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100/50">
                        <p className="text-[10px] text-slate-400 font-black uppercase mb-1">الرصيد</p>
                        <p className="text-lg font-black text-green-600">{formatCurrency(selected.balance)}</p>
                      </div>
                    </div>
                  </div>
                </ErpCard>

                {/* Quick Actions */}
                <ErpCard title="إجراءات سريعة">
                  <div className="space-y-2">
                    <ErpButton
                      variant="secondary"
                      onClick={() => { setEditing(selected); setModalOpen(true); }}
                      icon={Pencil}
                      className="w-full justify-start text-xs"
                    >
                      تعديل بيانات العميل
                    </ErpButton>
                    <ErpButton
                      variant="danger"
                      onClick={() => handleDelete(selected)}
                      icon={Trash2}
                      className="w-full justify-start text-xs"
                    >
                      حذف العميل من النظام
                    </ErpButton>
                  </div>
                </ErpCard>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-[2rem] border border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-center min-h-[350px] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.025)]"
              >
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
                <p className="font-bold text-slate-500">اختر عميلاً لعرض ملفه الكامل</p>
                <p className="text-sm text-slate-300 font-medium mt-1">انقر على أي عميل في القائمة</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal */}
      <CustomerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editing}
        warehouses={warehouses}
      />
      </ErpPageLayout>
  );
}
