import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet, Search, Filter, Calendar, Building2, Plus, X,
  Loader2, CheckCircle2, AlertCircle, FileText, Banknote,
  Clock, TrendingDown, Eye
} from 'lucide-react';
import { collection, query, getDocs, addDoc, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn, formatCurrency, formatDate } from '../../lib/utils';

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  balance: number;        // Amount owed to supplier
  totalPurchases: number;
  createdAt: string;
}

interface PayableInvoice {
  id: string;
  supplierId: string;
  supplierName: string;
  reference: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  createdAt: string;
  notes?: string;
}

export default function AccountsPayable() {
  const [invoices, setInvoices] = useState<PayableInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('ALL');
  const [selected, setSelected] = useState<PayableInvoice | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'accounts_payable'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayableInvoice)));
    } catch (err) {
      console.error('AccountsPayable fetch error:', err);
      // Use empty state for now if collection doesn't exist yet
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);

  const filtered = useMemo(() => invoices.filter(inv => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return inv.supplierName?.toLowerCase().includes(s) ||
        inv.reference?.toLowerCase().includes(s);
    }
    return true;
  }), [invoices, statusFilter, search]);

  const totalUnpaid = invoices
    .filter(i => i.status !== 'PAID')
    .reduce((a, i) => a + (i.amount - i.paidAmount), 0);
  const totalPaid = invoices.reduce((a, i) => a + i.paidAmount, 0);
  const overdueCount = invoices.filter(i =>
    i.status !== 'PAID' && new Date(i.dueDate) < new Date()
  ).length;

  const handlePay = async () => {
    if (!selected || !payAmount) return;
    const amount = Number(payAmount);
    if (isNaN(amount) || amount <= 0) return;
    setPaying(true);
    try {
      const newPaid = selected.paidAmount + amount;
      const newStatus: PayableInvoice['status'] =
        newPaid >= selected.amount ? 'PAID' : 'PARTIAL';
      await updateDoc(doc(db, 'accounts_payable', selected.id), {
        paidAmount: newPaid,
        status: newStatus,
      });
      await fetchInvoices();
      setShowPayModal(false);
      setPayAmount('');
      setSelected(null);
    } catch (err) {
      console.error('Payment failed:', err);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900">الحسابات الدائنة</h1>
          </div>
          <p className="text-gray-400 font-medium">تتبع المبالغ المستحقة للموردين وسجل المدفوعات</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-4 h-4" /> إضافة فاتورة مورد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-3xl shadow-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">إجمالي المستحق</p>
            <p className="text-2xl font-black text-white">{formatCurrency(totalUnpaid)}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">إجمالي المدفوع</p>
            <p className="text-2xl font-black text-gray-900">{formatCurrency(totalPaid)}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">متأخرة السداد</p>
            <p className="text-2xl font-black text-red-500">{overdueCount} فاتورة</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder="بحث بالمورد أو المرجع..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pr-10 pl-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'UNPAID', 'PARTIAL', 'PAID'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-4 py-2 rounded-xl text-sm font-bold transition-all',
                statusFilter === s ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
              {s === 'ALL' ? 'الكل' : s === 'UNPAID' ? 'غير مدفوعة' : s === 'PARTIAL' ? 'جزئي' : 'مدفوعة'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">المورد / المرجع</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">تاريخ الاستحقاق</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">المبلغ الكلي</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">المدفوع</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">المتبقي</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">الحالة</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3 text-gray-300">
                      <Wallet className="w-14 h-14 opacity-30" />
                      <p className="font-bold text-lg">لا توجد فواتير موردين</p>
                      <p className="text-sm">اضغط "إضافة فاتورة مورد" للبدء</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((inv, idx) => {
                const remaining = inv.amount - inv.paidAmount;
                const isOverdue = inv.status !== 'PAID' && new Date(inv.dueDate) < new Date();
                return (
                  <motion.tr key={inv.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{inv.supplierName}</p>
                      <p className="text-xs text-gray-400 font-mono">{inv.reference}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn('flex items-center gap-1 text-sm font-bold',
                        isOverdue ? 'text-red-500' : 'text-gray-500')}>
                        {isOverdue && <AlertCircle className="w-4 h-4" />}
                        <Clock className="w-3 h-3" />
                        {formatDate(inv.dueDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-gray-900">{formatCurrency(inv.amount)}</td>
                    <td className="px-6 py-4 font-bold text-green-600">{formatCurrency(inv.paidAmount)}</td>
                    <td className="px-6 py-4 font-black text-red-500">{formatCurrency(remaining)}</td>
                    <td className="px-6 py-4">
                      <span className={cn('px-3 py-1 rounded-full text-xs font-black',
                        inv.status === 'PAID' ? 'bg-green-50 text-green-600' :
                        inv.status === 'PARTIAL' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-500')}>
                        {inv.status === 'PAID' ? 'مدفوعة' : inv.status === 'PARTIAL' ? 'دفع جزئي' : 'غير مدفوعة'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {inv.status !== 'PAID' && (
                        <button
                          onClick={() => { setSelected(inv); setShowPayModal(true); }}
                          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-sm"
                        >
                          <Banknote className="w-3 h-3" /> سداد
                        </button>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Modal */}
      <AnimatePresence>
        {showPayModal && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setShowPayModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-black text-gray-900">تسجيل دفعة</h3>
                  <p className="text-sm text-gray-400 font-bold mt-1">{selected.supplierName}</p>
                </div>
                <button onClick={() => setShowPayModal(false)}
                  className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400 font-bold">المبلغ الكلي</span>
                  <span className="font-black text-gray-900">{formatCurrency(selected.amount)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400 font-bold">المدفوع سابقاً</span>
                  <span className="font-black text-green-600">{formatCurrency(selected.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="text-gray-400 font-bold">المتبقي</span>
                  <span className="font-black text-red-500">{formatCurrency(selected.amount - selected.paidAmount)}</span>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-black text-gray-700 mb-2">مبلغ الدفعة</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder={`أقصى ${formatCurrency(selected.amount - selected.paidAmount)}`}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button
                onClick={handlePay}
                disabled={paying || !payAmount}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {paying ? 'جارٍ التسجيل...' : 'تأكيد الدفعة'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Invoice Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddInvoiceModal onClose={() => setShowAddModal(false)} onSaved={() => { setShowAddModal(false); fetchInvoices(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddInvoiceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    supplierName: '', reference: '', amount: '', dueDate: '', notes: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.supplierName || !form.amount || !form.dueDate) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'accounts_payable'), {
        supplierName: form.supplierName,
        reference: form.reference,
        amount: Number(form.amount),
        paidAmount: 0,
        dueDate: form.dueDate,
        status: 'UNPAID',
        notes: form.notes,
        createdAt: new Date().toISOString(),
      });
      onSaved();
    } catch (err) {
      console.error('Failed to save invoice:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl" dir="rtl">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-black text-gray-900">إضافة فاتورة مورد</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          {[
            { key: 'supplierName', label: 'اسم المورد *', type: 'text', placeholder: 'مثال: شركة الأفق للمواد الغذائية' },
            { key: 'reference', label: 'رقم الفاتورة / المرجع', type: 'text', placeholder: 'INV-2026-001' },
            { key: 'amount', label: 'المبلغ الكلي *', type: 'number', placeholder: '0.00' },
            { key: 'dueDate', label: 'تاريخ الاستحقاق *', type: 'date', placeholder: '' },
            { key: 'notes', label: 'ملاحظات', type: 'text', placeholder: 'اختياري...' },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-sm font-black text-gray-700 mb-1">{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={(form as any)[field.key]}
                onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.supplierName || !form.amount || !form.dueDate}
          className="w-full mt-6 bg-blue-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
        </button>
      </motion.div>
    </div>
  );
}
