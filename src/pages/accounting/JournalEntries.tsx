import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  CircleCheck,
  Clock,
  FileText,
  Calendar,
  MoreVertical,
  X,
  Trash2,
  RefreshCw,
  ChevronDown,
  Equal,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { accountingService } from '../../services/accounting';
import { useAccountingStore } from '../../store/accountingStore';
import { JournalEntry } from '../../types';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { useRecordNavigatorStore } from '../../store/recordNavigatorStore';

// ─── Journal Line ─────────────────────────────────────────────────────────────
interface JournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function JournalModal({
  isOpen,
  onClose,
  onSave,
  accounts
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  accounts: any[];
}) {
  const today = new Date().toISOString().split('T')[0];
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
    { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

  const addLine = () => setLines(prev => [...prev, { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' }]);

  const removeLine = (i: number) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, field: keyof JournalLine, value: any) => {
    setLines(prev => {
      const next = [...prev];
      if (field === 'accountId') {
        const acc = accounts.find(a => a.id === value);
        next[i] = { ...next[i], accountId: value, accountName: acc?.name || '' };
      } else {
        next[i] = { ...next[i], [field]: value };
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!description.trim()) { setError('يجب إدخال البيان'); return; }
    if (lines.some(l => !l.accountId)) { setError('يجب اختيار حساب لكل سطر'); return; }
    if (!isBalanced) { setError('القيد غير متوازن - يجب أن يكون إجمالي المدين مساوياً للدائن'); return; }

    setSaving(true);
    try {
      await accountingService.postJournalEntry({
        date,
        reference: reference || `JE-${Date.now()}`,
        description,
        status: 'POSTED',
        lines: lines.filter(l => l.accountId && (l.debit > 0 || l.credit > 0)),
        createdBy: 'المستخدم'
      });
      onSave();
      onClose();
      setDescription(''); setReference(''); setDate(today);
      setLines([
        { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
        { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
      ]);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ القيد');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
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
          className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl my-8 overflow-hidden"
        >
          {/* Header */}
          <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
            <div>
              <h3 className="text-xl font-black text-gray-900">قيد يومية جديد</h3>
              <p className="text-sm text-gray-400 font-medium mt-0.5">إدخال قيد محاسبي مزدوج القيد</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-8 space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-black text-gray-700 mb-2">البيان / الوصف *</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                    placeholder="وصف القيد المحاسبي..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">التاريخ *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2">رقم المرجع (اختياري)</label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                  placeholder="JE-001"
                />
              </div>

              {/* Lines Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-black text-gray-700">سطور القيد</label>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> إضافة سطر
                  </button>
                </div>

                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-4 py-3">الحساب</th>
                        <th className="px-4 py-3">البيان</th>
                        <th className="px-4 py-3 text-center">مدين</th>
                        <th className="px-4 py-3 text-center">دائن</th>
                        <th className="px-4 py-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lines.map((line, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-2">
                            <select
                              value={line.accountId}
                              onChange={e => updateLine(i, 'accountId', e.target.value)}
                              className="w-full border-0 bg-transparent text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-200 rounded-xl outline-none py-1 pr-2 min-w-[160px]"
                            >
                              <option value="">-- اختر الحساب --</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={line.memo || ''}
                              onChange={e => updateLine(i, 'memo', e.target.value)}
                              placeholder="بيان..."
                              className="w-full border-0 bg-transparent text-sm font-medium text-gray-500 focus:ring-2 focus:ring-blue-100 rounded-xl outline-none py-1 min-w-[120px]"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={line.debit || ''}
                              onChange={e => updateLine(i, 'debit', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              min={0}
                              className="w-24 border border-gray-200 rounded-xl px-2 py-1.5 text-sm font-black text-center focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={line.credit || ''}
                              onChange={e => updateLine(i, 'credit', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              min={0}
                              className="w-24 border border-gray-200 rounded-xl px-2 py-1.5 text-sm font-black text-center focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => removeLine(i)}
                              disabled={lines.length <= 2}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-200">
                      <tr className="bg-gray-50">
                        <td colSpan={2} className="px-4 py-3">
                          <div className={cn(
                            "flex items-center gap-2 text-sm font-black",
                            isBalanced ? "text-green-600" : totalDebit > 0 || totalCredit > 0 ? "text-red-500" : "text-gray-400"
                          )}>
                            {isBalanced ? (
                              <><CircleCheck className="w-4 h-4" /> القيد متوازن</>
                            ) : totalDebit > 0 || totalCredit > 0 ? (
                              <><AlertCircle className="w-4 h-4" /> القيد غير متوازن (فرق: {formatCurrency(Math.abs(totalDebit - totalCredit))})</>
                            ) : (
                              <><Equal className="w-4 h-4" /> أدخل مبالغ القيد</>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-black text-blue-600 text-sm">{formatCurrency(totalDebit)}</td>
                        <td className="px-4 py-3 text-center font-black text-green-600 text-sm">{formatCurrency(totalCredit)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
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
            </div>

            {/* Footer */}
            <div className="px-8 pb-8 flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all">
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving || !isBalanced}
                className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> جاري الترحيل...</>
                ) : (
                  <><CircleCheck className="w-4 h-4" /> ترحيل القيد</>
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
export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { accounts, loadAccounts } = useAccountingStore();
  const recordNav = useRecordNavigatorStore();

  const load = async () => {
    setLoading(true);
    const data = await accountingService.getJournalEntries();
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadAccounts();
  }, []);

  const filtered = entries.filter(e =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    (e.reference || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedIndex = filtered.findIndex(e => e.id === expanded);
  const goToEntry = (index: number) => {
    const target = filtered[index];
    if (target) setExpanded(target.id);
  };

  useEffect(() => {
    if (expanded) {
      recordNav.register({
        currentIndex: selectedIndex >= 0 ? selectedIndex : 0,
        total: filtered.length,
        label: 'القيد المالي الحالي',
        onFirst: () => goToEntry(0),
        onPrevious: () => goToEntry(Math.max(0, selectedIndex - 1)),
        onNext: () => goToEntry(Math.min(filtered.length - 1, selectedIndex + 1)),
        onLast: () => goToEntry(filtered.length - 1)
      });
    } else {
      recordNav.unregister();
    }
    return () => {
      recordNav.unregister();
    };
  }, [expanded, selectedIndex, filtered.length]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">قيود اليومية</h2>
          <p className="text-gray-500 mt-1">إدارة واعتماد جميع العمليات المالية والمحاسبية</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={load}
            className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-gray-600 rounded-2xl hover:bg-gray-50 transition-all"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            قيد يدوي جديد
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[600px]">
        <div className="p-8 border-b border-gray-50 bg-gray-50/20 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-3.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="البحث بالمرجع أو البيان..."
              className="w-full bg-white border border-gray-200 rounded-2xl pr-12 pl-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
            />
          </div>
          <button className="bg-white border border-gray-200 px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-400" />
            تصفية
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black tracking-widest">
              <tr className="border-b border-gray-100">
                <th className="px-8 py-5 w-8"></th>
                <th className="px-8 py-5">رقم القيد</th>
                <th className="px-8 py-5">التاريخ</th>
                <th className="px-8 py-5">البيان والشرح</th>
                <th className="px-8 py-5">إجمالي المبلغ</th>
                <th className="px-8 py-5">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td colSpan={6} className="px-8 py-5">
                      <div className="h-4 bg-gray-100 rounded-full animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center text-gray-400 font-medium italic">
                    {search ? 'لا توجد قيود بهذا البحث' : 'لا توجد قيود مسجلة - أضف قيداً جديداً'}
                  </td>
                </tr>
              ) : filtered.map(entry => (
                <React.Fragment key={entry.id}>
                  <tr
                    className="hover:bg-blue-50/20 transition-all group cursor-pointer"
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-6">
                      <ChevronDown className={cn(
                        "w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-all",
                        expanded === entry.id && "rotate-180"
                      )} />
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                        #{entry.reference || entry.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="font-medium text-sm">{formatDate(entry.date)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 mb-0.5">{entry.description}</span>
                        <span className="text-sm text-gray-400 font-medium">بواسطة: {entry.createdBy || 'النظام'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 font-black text-gray-900">
                      {formatCurrency(entry.lines.reduce((sum, l) => sum + l.debit, 0))}
                    </td>
                    <td className="px-8 py-6">
                      <div className={cn(
                        "px-3 py-1 rounded-full w-fit text-sm font-bold uppercase flex items-center gap-1.5 shadow-sm",
                        entry.status === 'POSTED' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
                      )}>
                        {entry.status === 'POSTED' ? <CircleCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {entry.status === 'POSTED' ? 'مرحل' : 'مسودة'}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Lines */}
                  <AnimatePresence>
                    {expanded === entry.id && (
                      <tr>
                        <td colSpan={6} className="px-8 py-0 bg-blue-50/20">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="py-4">
                              <table className="w-full text-sm text-right border border-gray-200 rounded-2xl overflow-hidden">
                                <thead className="bg-gray-100 text-xs font-black text-gray-500 uppercase">
                                  <tr>
                                    <th className="px-4 py-2">الحساب</th>
                                    <th className="px-4 py-2">البيان</th>
                                    <th className="px-4 py-2 text-center">مدين</th>
                                    <th className="px-4 py-2 text-center">دائن</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                  {entry.lines.map((line, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-2 font-bold text-gray-800">{line.accountName}</td>
                                      <td className="px-4 py-2 text-gray-500">{line.memo || '-'}</td>
                                      <td className="px-4 py-2 text-center font-black text-blue-600">
                                        {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                                      </td>
                                      <td className="px-4 py-2 text-center font-black text-green-600">
                                        {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <JournalModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={load}
        accounts={accounts}
      />
    </div>
  );
}
