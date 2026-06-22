import React, { useState, useEffect } from 'react';
import {
  ArrowUpLeft,
  ArrowDownRight,
  Search,
  Plus,
  Wallet,
  History as HistoryIcon,
  MoreVertical,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Building,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  runTransaction,
  where
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { accountingService } from '../../services/accounting';
import { useAccountingStore } from '../../store/accountingStore';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { accountingIntegration } from '../../services/accountingIntegration';

type TxType = 'RECEIPT' | 'PAYMENT';

interface CashTx {
  id: string;
  type: TxType;
  reference: string;
  party: string;
  description: string;
  amount: number;
  accountId: string;
  accountName: string;
  createdAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────
const cashTxService = {
  async getAll(): Promise<CashTx[]> {
    try {
      const q = query(collection(db, 'cash_transactions'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CashTx[];
    } catch { return []; }
  },
  async add(tx: Omit<CashTx, 'id'>) {
    return addDoc(collection(db, 'cash_transactions'), tx);
  }
};

// ─── Modal ────────────────────────────────────────────────────────────────────
function CashModal({
  isOpen,
  type,
  onClose,
  onSave,
  accounts
}: {
  isOpen: boolean;
  type: TxType;
  onClose: () => void;
  onSave: () => void;
  accounts: any[];
}) {
  const [form, setForm] = useState({
    party: '',
    description: '',
    amount: 0,
    accountId: '',
    reference: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Cash/Bank accounts only for the contra account
  const cashAccounts = accounts.filter(a => a.type === 'ASSET');

  useEffect(() => {
    if (isOpen) {
      setForm({ party: '', description: '', amount: 0, accountId: '', reference: '' });
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.party.trim()) { setError('يجب إدخال اسم الجهة'); return; }
    if (!form.amount || form.amount <= 0) { setError('يجب إدخال مبلغ صحيح'); return; }
    if (!form.accountId) { setError('يجب اختيار الحساب'); return; }

    setSaving(true);
    try {
      const acc = accounts.find(a => a.id === form.accountId);
      const ref = form.reference || `${type === 'RECEIPT' ? 'REC' : 'PAY'}-${Date.now()}`;

      const txData = {
        type,
        reference: ref,
        party: form.party,
        description: form.description,
        amount: form.amount,
        accountId: form.accountId,
        accountName: acc?.name || '',
        createdAt: new Date().toISOString()
      };

      await cashTxService.add(txData);
      await accountingIntegration.postCashTxToAccounting(txData);

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isReceipt = type === 'RECEIPT';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
        >
          <div className={cn(
            "p-8 border-b border-gray-100 flex items-center justify-between",
            isReceipt ? "bg-green-50/40" : "bg-red-50/40"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                isReceipt ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
              )}>
                {isReceipt ? <ArrowUpLeft className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">
                  {isReceipt ? 'إيصال استلام نقدية' : 'أمر صرف نقدية'}
                </h3>
                <p className="text-sm text-gray-400 font-medium mt-0.5">
                  {isReceipt ? 'تسجيل مبلغ مقبوض' : 'تسجيل مبلغ مدفوع'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">
                {isReceipt ? 'المستلَم منه (المورد/العميل) *' : 'المدفوع إليه *'}
              </label>
              <input
                type="text"
                value={form.party}
                onChange={e => setForm(p => ({ ...p, party: e.target.value }))}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                placeholder="اسم الجهة..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2">المبلغ *</label>
                <input
                  type="number"
                  value={form.amount || ''}
                  onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2">رقم المرجع</label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                  placeholder="REC-001"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">
                {isReceipt ? 'يُودَع في الحساب *' : 'يُصرَف من الحساب *'}
              </label>
              <select
                value={form.accountId}
                onChange={e => setForm(p => ({ ...p, accountId: e.target.value }))}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all bg-white"
                required
              >
                <option value="">-- اختر الحساب --</option>
                {cashAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">البيان / الوصف</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                placeholder="وصف العملية..."
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </motion.div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all">
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className={cn(
                  "flex-1 py-3.5 text-white rounded-2xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60",
                  isReceipt ? "bg-green-600 hover:bg-green-700 shadow-green-100" : "bg-red-600 hover:bg-red-700 shadow-red-100"
                )}
              >
                {saving ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> {isReceipt ? 'تسجيل الاستلام' : 'تسجيل الصرف'}</>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CashTransactionsPage() {
  const [activeTab, setActiveTab] = useState<TxType>('RECEIPT');
  const [transactions, setTransactions] = useState<CashTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { accounts, loadAccounts } = useAccountingStore();

  const load = async () => {
    setLoading(true);
    const data = await cashTxService.getAll();
    setTransactions(data);
    setLoading(false);
  };

  useEffect(() => { load(); loadAccounts(); }, []);

  const filtered = transactions.filter(t =>
    t.type === activeTab &&
    (
      t.party.toLowerCase().includes(search.toLowerCase()) ||
      t.reference.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase())
    )
  );

  const totalReceipts = transactions.filter(t => t.type === 'RECEIPT').reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === 'PAYMENT').reduce((s, t) => s + t.amount, 0);
  const netCash = totalReceipts - totalPayments;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">العمليات النقدية</h2>
          <p className="text-gray-500 mt-1">إدارة الصيرفة، القبض، والدفع النقدي</p>
        </div>
        <div className="flex flex-wrap gap-2 bg-gray-100 p-1.5 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('RECEIPT')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'RECEIPT' ? "bg-white text-green-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            استلام نقدية
          </button>
          <button
            onClick={() => setActiveTab('PAYMENT')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'PAYMENT' ? "bg-white text-red-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            صرف نقدية
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Net Cash Card */}
          <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12" />
            <p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1 relative z-10">صافي النقدية</p>
            <h3 className={cn("text-2xl font-black relative z-10", netCash >= 0 ? "text-white" : "text-red-400")}>
              {formatCurrency(netCash)}
            </h3>
            <div className="mt-4 border-t border-white/10 pt-4 space-y-1 relative z-10">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">إجمالي المقبوضات</span>
                <span className="text-green-400 font-bold">{formatCurrency(totalReceipts)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">إجمالي المدفوعات</span>
                <span className="text-red-400 font-bold">{formatCurrency(totalPayments)}</span>
              </div>
            </div>
          </div>

          {/* Quick Action */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">إجراء سريع</p>
            <button
              onClick={() => { setActiveTab('RECEIPT'); setModalOpen(true); }}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-green-100 hover:bg-green-700 transition-all flex items-center justify-center gap-2"
            >
              <ArrowUpLeft className="w-4 h-4" />
              إيصال استلام جديد
            </button>
            <button
              onClick={() => { setActiveTab('PAYMENT'); setModalOpen(true); }}
              className="w-full bg-red-50 text-red-600 py-4 rounded-2xl font-bold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2 border border-red-100"
            >
              <ArrowDownRight className="w-4 h-4" />
              أمر صرف جديد
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
            <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/20">
              <div className="flex items-center gap-3">
                <HistoryIcon className="w-5 h-5 text-gray-400" />
                <h4 className="font-bold text-gray-900">
                  سجل {activeTab === 'RECEIPT' ? 'المقبوضات' : 'المدفوعات'}
                </h4>
                <span className="bg-gray-100 text-gray-500 text-xs font-black px-2.5 py-1 rounded-full">
                  {filtered.length}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-52">
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="بحث..."
                    className="w-full bg-white border border-gray-100 rounded-xl pr-9 pl-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
                <button
                  onClick={() => setModalOpen(true)}
                  className={cn(
                    "px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 text-white transition-all",
                    activeTab === 'RECEIPT' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  )}
                >
                  <Plus className="w-4 h-4" />
                  {activeTab === 'RECEIPT' ? 'استلام' : 'صرف'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-5">رقم السند</th>
                    <th className="px-6 py-5">الجهة</th>
                    <th className="px-6 py-5">الحساب</th>
                    <th className="px-6 py-5">البيان</th>
                    <th className="px-6 py-5">المبلغ</th>
                    <th className="px-6 py-5">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    [1, 2, 3, 4].map(i => (
                      <tr key={i}>
                        <td colSpan={6} className="px-6 py-5">
                          <div className="h-4 bg-gray-100 rounded-full animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                        </td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-gray-400 font-medium italic">
                        لا توجد عمليات {activeTab === 'RECEIPT' ? 'استلام' : 'صرف'} مسجلة
                      </td>
                    </tr>
                  ) : filtered.map(tx => (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <span className="font-mono text-sm font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                          {tx.reference}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-black",
                            activeTab === 'RECEIPT' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                          )}>
                            {tx.party.charAt(0)}
                          </div>
                          <span className="font-bold text-gray-900">{tx.party}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-gray-500 font-medium text-sm">{tx.accountName || '-'}</td>
                      <td className="px-6 py-5 text-gray-500 font-medium">{tx.description || '-'}</td>
                      <td className="px-6 py-5">
                        <span className={cn("font-black", activeTab === 'RECEIPT' ? "text-green-600" : "text-red-600")}>
                          {activeTab === 'RECEIPT' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-gray-400 text-sm font-medium">{formatDate(tx.createdAt)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <CashModal
        isOpen={modalOpen}
        type={activeTab}
        onClose={() => setModalOpen(false)}
        onSave={load}
        accounts={accounts}
      />
    </div>
  );
}
