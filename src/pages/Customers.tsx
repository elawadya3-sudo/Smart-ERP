import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Star,
  Wallet,
  ShoppingBag,
  Pencil,
  Trash2,
  X,
  ChevronRight,
  Gift,
  TrendingUp,
  Crown,
  Filter,
  MoreVertical,
  RefreshCw
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
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';

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
  initial
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initial: Customer | null;
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', points: 0, balance: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({ name: initial.name, phone: initial.phone, email: initial.email || '', points: initial.points, balance: initial.balance });
    } else {
      setForm({ name: '', phone: '', email: '', points: 0, balance: 0 });
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
        >
          <div className="p-8 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-gray-900">{initial ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h3>
              <p className="text-sm text-gray-400 font-medium mt-0.5">ملف العميل في نظام الولاء</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">اسم العميل *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                placeholder="الاسم الكامل"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">رقم الهاتف *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                placeholder="01xxxxxxxxx"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">البريد الإلكتروني</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                placeholder="email@example.com"
              />
            </div>
            {initial && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">النقاط المتاحة</label>
                  <input
                    type="number"
                    value={form.points}
                    onChange={e => setForm(p => ({ ...p, points: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">الرصيد الائتماني</label>
                  <input
                    type="number"
                    value={form.balance}
                    onChange={e => setForm(p => ({ ...p, balance: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                    min={0}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all">
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                ) : (
                  <>{initial ? 'حفظ التعديلات' : 'إضافة العميل'}</>
                )}
              </button>
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

  const load = async () => {
    setLoading(true);
    const data = await customersService.getAll();
    setCustomers(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">العملاء والولاء</h2>
          <p className="text-gray-500 mt-1">إدارة ملفات العملاء، نقاط الولاء، والرصيد الائتماني</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          إضافة عميل جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-7 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">إجمالي العملاء</p>
          <h3 className="text-3xl font-black text-gray-900 relative z-10">{customers.length}</h3>
          <div className="flex items-center gap-1 mt-2 text-sm text-blue-600 font-bold relative z-10">
            <TrendingUp className="w-3 h-3" /> عميل مسجل
          </div>
        </div>
        <div className="bg-white p-7 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">إجمالي النقاط</p>
          <h3 className="text-3xl font-black text-gray-900 relative z-10">{totalPoints.toLocaleString('ar-EG')}</h3>
          <div className="flex items-center gap-1 mt-2 text-sm text-yellow-600 font-bold relative z-10">
            <Star className="w-3 h-3" /> نقطة ولاء
          </div>
        </div>
        <div className="bg-gray-900 p-7 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1 relative z-10">إجمالي الأرصدة</p>
          <h3 className="text-3xl font-black text-white relative z-10">{formatCurrency(totalBalance)}</h3>
          <div className="flex items-center gap-1 mt-2 text-sm text-gray-400 font-bold relative z-10">
            <Wallet className="w-3 h-3" /> رصيد ائتماني
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer List */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 bg-gray-50/30">
            <div className="relative">
              <Search className="absolute right-4 top-3.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="البحث بالاسم، رقم الهاتف، أو الإيميل..."
                className="w-full bg-white border border-gray-200 rounded-2xl pr-11 pl-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
            {loading ? (
              <div className="p-12 text-center">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-400 font-medium">جاري التحميل...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-400 font-medium italic">
                  {search ? 'لا يوجد عملاء بهذا البحث' : 'لا يوجد عملاء مسجلين بعد'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map(customer => {
                  const tier = getLoyaltyTier(customer.points);
                  const TierIcon = tier.icon;
                  return (
                    <motion.div
                      key={customer.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "p-5 flex items-center gap-4 hover:bg-gray-50 transition-all cursor-pointer group",
                        selected?.id === customer.id && "bg-blue-50/40 hover:bg-blue-50/60"
                      )}
                      onClick={() => setSelected(customer)}
                    >
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-md shadow-blue-100">
                        {customer.name.charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-gray-900 truncate">{customer.name}</p>
                          <span className={cn("text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0", tier.color)}>
                            <TierIcon className="w-2.5 h-2.5" />
                            {tier.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-400 font-medium flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {customer.phone}
                          </span>
                          {customer.email && (
                            <span className="text-sm text-gray-400 font-medium flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3" /> {customer.email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Points & Balance */}
                      <div className="text-left shrink-0">
                        <p className="text-sm font-black text-yellow-600">{customer.points.toLocaleString('ar-EG')} نقطة</p>
                        <p className="text-sm font-bold text-gray-400">{formatCurrency(customer.balance)}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setEditing(customer); setModalOpen(true); }}
                          className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(customer); }}
                          className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
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
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-8 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl shadow-blue-100">
                  <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                  <button
                    onClick={() => setSelected(null)}
                    className="absolute top-4 left-4 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-black mb-4 shadow-inner">
                    {selected.name.charAt(0)}
                  </div>
                  <h3 className="text-2xl font-black">{selected.name}</h3>
                  <p className="text-blue-200 mt-1 flex items-center gap-1.5 text-sm font-medium">
                    <Phone className="w-3.5 h-3.5" /> {selected.phone}
                  </p>
                  {selected.email && (
                    <p className="text-blue-200 mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                      <Mail className="w-3.5 h-3.5" /> {selected.email}
                    </p>
                  )}
                  <p className="text-blue-200 text-xs font-medium mt-3 border-t border-white/20 pt-3">
                    عضو منذ: {formatDate(selected.createdAt)}
                  </p>
                </div>

                {/* Loyalty Stats */}
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 space-y-4">
                  <h4 className="font-black text-gray-900 flex items-center gap-2">
                    <Gift className="w-4 h-4 text-yellow-500" />
                    برنامج الولاء
                  </h4>

                  {(() => {
                    const tier = getLoyaltyTier(selected.points);
                    const TierIcon = tier.icon;
                    return (
                      <div className={cn("p-4 rounded-2xl flex items-center gap-3", tier.color)}>
                        <TierIcon className="w-5 h-5" />
                        <div>
                          <p className="font-black text-sm">مستوى {tier.label}</p>
                          <p className="text-xs opacity-70 font-medium">{selected.points.toLocaleString('ar-EG')} نقطة مجمّعة</p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-4 rounded-2xl">
                      <p className="text-xs text-gray-400 font-black uppercase mb-1">النقاط</p>
                      <p className="text-xl font-black text-yellow-600">{selected.points.toLocaleString('ar-EG')}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl">
                      <p className="text-xs text-gray-400 font-black uppercase mb-1">الرصيد</p>
                      <p className="text-lg font-black text-green-600">{formatCurrency(selected.balance)}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 space-y-3">
                  <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest">إجراءات سريعة</h4>
                  <button
                    onClick={() => { setEditing(selected); setModalOpen(true); }}
                    className="w-full flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-2xl hover:bg-blue-100 transition-colors font-bold text-sm"
                  >
                    <Pencil className="w-4 h-4" />
                    تعديل بيانات العميل
                  </button>
                  <button
                    onClick={() => handleDelete(selected)}
                    className="w-full flex items-center gap-3 p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors font-bold text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    حذف العميل
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-[2.5rem] border border-dashed border-gray-200 p-12 flex flex-col items-center justify-center text-center h-full min-h-[400px]"
              >
                <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
                <p className="font-bold text-gray-500">اختر عميلاً لعرض ملفه الكامل</p>
                <p className="text-sm text-gray-300 font-medium mt-1">انقر على أي عميل في القائمة</p>
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
      />
    </div>
  );
}
