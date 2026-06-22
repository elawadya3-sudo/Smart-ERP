import React, { useState, useEffect } from 'react';
import {
  Warehouse as WarehouseIcon,
  Database,
  Building2,
  Plus,
  ChevronRight,
  ArrowRightLeft,
  Pencil,
  Trash2,
  ArrowDownLeft,
  Search,
  X,
  Package,
  FileText,
  CreditCard,
  Banknote,
  Calendar,
  Eye,
  Filter,
  CheckCircle2,
  Clock,
  User,
  Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, query, setDoc, doc, updateDoc, deleteDoc,
  onSnapshot, orderBy, getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { cn, formatDate, formatCurrency } from '../../lib/utils';
import { Warehouse } from '../../types';
import { getCurrentTenant } from '../../lib/tenantStorage';
import { useBranchFilter } from '../../hooks/useBranchFilter';
import { useMainStoreSettings } from '../../hooks/useMainStoreSettings';

const INITIAL_WAREHOUSES: any[] = [
  { id: '1', name: 'المخزن الرئيسي (Main Warehouse)', type: 'MAIN', status: 'Active', createdAt: '2024-01-01' }
];

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'نقداً',
  bank: 'تحويل بنكي',
  check: 'شيك',
  credit: 'آجل',
};

const PAYMENT_STATUS_COLOR: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  credit: 'bg-amber-50 text-amber-700 border-amber-200',
  partial: 'bg-blue-50 text-blue-700 border-blue-200',
};

// ─── Receipt Detail Modal ──────────────────────────────────────────────────────
function ReceiptDetailModal({ receipt, warehouses, onClose }: {
  receipt: any;
  warehouses: Warehouse[];
  onClose: () => void;
}) {
  const wh = warehouses.find(w => w.id === receipt.toWarehouseId);
  const payStatus = receipt.paymentType === 'paid' ? 'paid' : (receipt.remaining > 0 ? 'credit' : 'paid');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="w-5 h-5 text-blue-200" />
                <p className="text-blue-200 text-sm font-bold">فاتورة توريد بضاعة</p>
              </div>
              <h3 className="text-xl font-black">
                {receipt.invoiceNumber ? `#${receipt.invoiceNumber}` : `REC-${receipt.id?.slice(0, 8)?.toUpperCase()}`}
              </h3>
              <p className="text-blue-200 text-xs mt-1 font-bold">{formatDate(receipt.invoiceDate || receipt.createdAt)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn(
                'text-xs font-black px-3 py-1.5 rounded-xl border',
                payStatus === 'paid' ? 'bg-emerald-400/20 text-emerald-100 border-emerald-400/30' : 'bg-amber-400/20 text-amber-100 border-amber-400/30'
              )}>
                {payStatus === 'paid' ? '✓ مدفوع' : 'آجل'}
              </span>
              <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5 scrollbar-thin" dir="rtl">
          {/* Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: Building2, label: 'المستودع المستلم', value: wh?.name || receipt.toWarehouseId || '—' },
              { icon: User, label: 'المورد', value: receipt.supplierName || '—' },
              { icon: Hash, label: 'رقم الفاتورة', value: receipt.invoiceNumber || '—', mono: true },
              { icon: Calendar, label: 'تاريخ الفاتورة', value: receipt.invoiceDate ? formatDate(receipt.invoiceDate) : '—' },
              { icon: CreditCard, label: 'طريقة الدفع', value: PAYMENT_METHOD_LABEL[receipt.paymentMethod || receipt.paymentType] || '—' },
              { icon: Clock, label: 'تاريخ الإنشاء', value: formatDate(receipt.createdAt) },
            ].map(({ icon: Icon, label, value, mono }) => (
              <div key={label} className="bg-slate-50 rounded-2xl p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
                </div>
                <p className={cn('text-sm font-black text-slate-800 truncate', mono && 'font-mono')}>{value}</p>
              </div>
            ))}
          </div>

          {/* Items Table */}
          {receipt.items?.length > 0 && (
            <div>
              <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                الأصناف المستلمة ({receipt.items.length})
              </h4>
              <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-right px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">الصنف</th>
                      <th className="text-center px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase">الكمية</th>
                      <th className="text-center px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase">سعر الوحدة</th>
                      <th className="text-center px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase">خصم%</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {receipt.items.map((item: any, i: number) => {
                      const lineTotal = item.cost * item.quantity * (1 - (item.discount || 0) / 100);
                      return (
                        <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800 text-sm">{item.productName}</p>
                            {item.sku && <p className="text-[10px] font-mono text-slate-400">{item.sku}</p>}
                          </td>
                          <td className="px-3 py-3 text-center font-black text-blue-600">{item.quantity}</td>
                          <td className="px-3 py-3 text-center font-bold text-slate-600">{formatCurrency(item.cost)}</td>
                          <td className="px-3 py-3 text-center text-slate-400 font-bold">{item.discount || 0}%</td>
                          <td className="px-4 py-3 text-left font-black text-slate-800">{formatCurrency(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Financial Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              الملخص المالي
            </h4>
            <div className="space-y-1.5 text-sm">
              {[
                { label: 'المجموع الفرعي', value: receipt.subtotal },
                { label: `خصم الفاتورة (${receipt.discount || 0}%)`, value: -(receipt.invoiceDiscount || 0) },
                { label: `ضريبة القيمة المضافة (${receipt.tax || 0}%)`, value: receipt.taxAmount },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between font-bold text-slate-600">
                  <span>{label}</span>
                  <span className={value < 0 ? 'text-red-500' : ''}>{formatCurrency(Math.abs(value || 0))}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900 text-base">
                <span>الإجمالي</span>
                <span className="text-blue-600">{formatCurrency(receipt.total || 0)}</span>
              </div>
              {receipt.paymentType === 'credit' && (
                <>
                  <div className="flex justify-between font-bold text-emerald-600">
                    <span>المدفوع</span>
                    <span>{formatCurrency(receipt.paidAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between font-black text-amber-600">
                    <span>المتبقي</span>
                    <span>{formatCurrency(receipt.remaining || 0)}</span>
                  </div>
                  {receipt.dueDate && (
                    <div className="flex justify-between font-bold text-slate-500 text-xs">
                      <span>تاريخ الاستحقاق</span>
                      <span>{formatDate(receipt.dueDate)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {receipt.notes && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
              <p className="text-xs font-black text-amber-700 uppercase tracking-wider mb-1">ملاحظات</p>
              <p className="text-sm text-amber-800 font-bold">{receipt.notes}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WarehousesPage() {
  const { settings } = useMainStoreSettings();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newWarehouse, setNewWarehouse] = useState<{ name: string; type: 'MAIN' | 'BRANCH' }>({ name: '', type: 'BRANCH' });
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [filterWarehouseId, setFilterWarehouseId] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const navigate = useNavigate();
  const restrictedBranchId = useBranchFilter();

  // Sort warehouses so that the Main warehouse is always first
  const sortedWarehouses = [...warehouses].sort((a, b) => {
    const aIsMain = (a as any).type === 'MAIN' || a.id === '1';
    const bIsMain = (b as any).type === 'MAIN' || b.id === '1';
    if (aIsMain && !bIsMain) return -1;
    if (!aIsMain && bIsMain) return 1;
    return 0;
  });

  const visibleWarehouses = restrictedBranchId
    ? sortedWarehouses.filter(w => w.id === restrictedBranchId)
    : sortedWarehouses;

  // Load warehouses — and seed main warehouse to Firestore if it's only a local fallback
  useEffect(() => {
    const q = query(collection(db, 'warehouses'));
    const unsub = onSnapshot(q, async snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Warehouse));
      if (docs.length > 0) {
        setWarehouses(docs);
      } else {
        // No warehouses in Firestore — seed the default main warehouse
        const fallback = INITIAL_WAREHOUSES[0];
        try {
          await setDoc(doc(db, 'warehouses', fallback.id), fallback, { merge: true });
          // onSnapshot will re-fire with the new doc
        } catch {
          // If seeding fails (permissions), just show the fallback locally
          setWarehouses(INITIAL_WAREHOUSES as any);
        }
      }
      setLoading(false);
    }, error => {
      handleFirestoreError(error, OperationType.LIST, 'warehouses');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load purchase_receipts
  useEffect(() => {
    setReceiptsLoading(true);
    const q = query(collection(db, 'purchase_receipts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setReceiptsLoading(false);
    }, err => {
      console.error('Receipts error:', err);
      setReceiptsLoading(false);
    });
    return () => unsub();
  }, []);

  const mainWarehouse = warehouses.find(w => w.type === 'MAIN' || w.id === '1');
  const branchWarehouses = warehouses.filter(w => (w.type === 'BRANCH' || !w.type) && w.id !== '1');

  const openAddModal = () => { setEditingWarehouseId(null); setNewWarehouse({ name: '', type: 'BRANCH' }); setIsModalOpen(true); };
  const openEditModal = (e: React.MouseEvent, wh: Warehouse) => { e.stopPropagation(); setEditingWarehouseId(wh.id); setNewWarehouse({ name: wh.name, type: (wh as any).type || 'BRANCH' }); setIsModalOpen(true); };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarehouse.name.trim()) return;
    if (editingWarehouseId) {
      try {
        // Use setDoc+merge so it works even if the doc doesn't exist yet in Firestore
        await setDoc(doc(db, 'warehouses', editingWarehouseId), {
          name: newWarehouse.name.trim(),
          type: newWarehouse.type,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        setIsModalOpen(false);
        setEditingWarehouseId(null);
      } catch (error: any) {
        console.error('Update warehouse error:', error);
        alert(`حدث خطأ أثناء التعديل: ${error?.message || 'خطأ غير معروف'}`);
      }
    } else {
      // Block creating a MAIN warehouse if disabled in settings
      if (newWarehouse.type === 'MAIN' && settings?.allowAddMainWarehouse === false) {
        alert('إضافة مستودع رئيسي معطلة من إعدادات النظام.');
        return;
      }
      // Block creating a second MAIN warehouse unless explicitly allowed in settings
      const mainExists = warehouses.some(w => w.type === 'MAIN' || w.id === '1');
      if (newWarehouse.type === 'MAIN' && mainExists && settings?.allowAddMainWarehouse === false) {
        alert('يوجد مستودع رئيسي بالفعل. لا يمكن إضافة أكثر من مستودع رئيسي واحد.');
        return;
      }
      let currentTenant = null;
      try { currentTenant = await getCurrentTenant(); } catch { }
      if (currentTenant) {
        const branchCount = warehouses.filter(w => (w.type === 'BRANCH' || !w.type) && w.id !== '1').length;
        if (branchCount >= currentTenant.maxBranches) { alert(`عذراً، لقد وصلت للحد الأقصى للفروع (${currentTenant.maxBranches}).`); return; }
      }
      const id = Math.random().toString(36).substr(2, 9);
      const dataToSave = { id, name: newWarehouse.name, code: newWarehouse.name.slice(0, 3).toUpperCase() + Math.floor(Math.random() * 1000), isActive: true, type: newWarehouse.type, status: 'Active', createdAt: new Date().toISOString() };
      try { await setDoc(doc(db, 'warehouses', id), dataToSave); setIsModalOpen(false); setNewWarehouse({ name: '', type: 'BRANCH' }); }
      catch (error) { handleFirestoreError(error, OperationType.WRITE, `warehouses/${id}`); }
    }
  };

  // Filtered receipts
  const filteredReceipts = receipts.filter(r => {
    const wh = warehouses.find(w => w.id === r.toWarehouseId);
    const matchSearch =
      (r.invoiceNumber || '').toLowerCase().includes(receiptSearch.toLowerCase()) ||
      (r.supplierName || '').toLowerCase().includes(receiptSearch.toLowerCase()) ||
      (wh?.name || '').toLowerCase().includes(receiptSearch.toLowerCase());
    const matchWh = filterWarehouseId ? r.toWarehouseId === filterWarehouseId : true;
    const matchPayment = filterPayment ? r.paymentType === filterPayment : true;
    return matchSearch && matchWh && matchPayment;
  });

  // Stats
  const totalReceipts = receipts.length;
  const totalValue = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
  const totalPending = receipts.filter(r => r.paymentType === 'credit' && (r.remaining || 0) > 0).length;

  return (
    <div className="space-y-8 pb-24" dir="rtl">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">إدارة المستودعات</h2>
          <p className="text-gray-500 mt-1 font-medium text-sm">الهيكل التنظيمي للمخازن وسجل حركات التوريد</p>
        </div>
        {!restrictedBranchId && (
          <div className="flex flex-wrap gap-3">
            <Link to="/inventory/transfers" className="bg-white text-blue-600 border border-blue-100 px-5 py-3 rounded-2xl font-bold text-sm shadow-sm hover:shadow-md hover:bg-blue-50 transition-all flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" /> حركة المخزون
            </Link>
            <button onClick={openAddModal} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" /> مستودع جديد
            </button>
          </div>
        )}
      </div>

      {/* ─── Warehouses Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleWarehouses.map((wh, index) => {
          const isMain = wh.type === 'MAIN' || wh.id === '1';
          const whReceipts = receipts.filter(r => r.toWarehouseId === wh.id);
          return (
            <motion.div
              key={wh.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(`/inventory/warehouses/${wh.id}`)}
              className={cn(
                'group flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden cursor-pointer',
                isMain
                  ? 'border-blue-500 bg-gradient-to-br from-blue-900 to-slate-900 text-white shadow-lg shadow-blue-950/15'
                  : 'border-slate-100 bg-white shadow-sm hover:border-slate-200 hover:shadow-md'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', isMain ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-600')}>
                  {isMain ? <Database className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider', isMain ? 'bg-white/15 text-blue-100' : 'bg-slate-50 text-slate-500')}>
                    {isMain ? 'رئيسي' : 'فرعي'}
                  </span>
                  {whReceipts.length > 0 && (
                    <span className={cn('text-[10px] font-black px-2.5 py-1 rounded-full', isMain ? 'bg-white/10 text-blue-200' : 'bg-blue-50 text-blue-600')}>
                      {whReceipts.length} توريد
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <h4 className={cn('text-lg font-black tracking-tight line-clamp-1', isMain ? 'text-white' : 'text-slate-900')}>{wh.name}</h4>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <div>
                    <p className={isMain ? 'text-blue-200/60' : 'text-slate-400'}>رمز</p>
                    <p className={cn('font-mono mt-0.5', isMain ? 'text-blue-100' : 'text-slate-700')}>{wh.code || `WH-${wh.id.slice(0, 4).toUpperCase()}`}</p>
                  </div>
                  <div className="h-6 w-px bg-slate-100/10" />
                  <div>
                    <p className={isMain ? 'text-blue-200/60' : 'text-slate-400'}>إجمالي التوريد</p>
                    <p className={cn('mt-0.5', isMain ? 'text-blue-100' : 'text-slate-700')}>{formatCurrency(whReceipts.reduce((s, r) => s + (r.total || 0), 0))}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100/10">
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', wh.status === 'Active' ? 'bg-green-500 animate-pulse' : 'bg-slate-300')} />
                  <span className={cn('text-xs font-bold', wh.status === 'Active' ? (isMain ? 'text-green-300' : 'text-green-600') : (isMain ? 'text-blue-200/50' : 'text-slate-400'))}>
                    {wh.status === 'Active' ? 'نشط' : 'متوقف'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  {confirmDeleteId === wh.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={e => { e.stopPropagation(); deleteDoc(doc(db, 'warehouses', wh.id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `warehouses/${wh.id}`)); setConfirmDeleteId(null); }} className="text-[10px] font-black text-white px-2 py-1 bg-red-600 rounded-md hover:bg-red-700">تأكيد</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }} className="text-[10px] font-bold text-slate-500 px-2 py-1 bg-slate-50 rounded-md hover:bg-slate-100">إلغاء</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={e => openEditModal(e, wh)} className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', isMain ? 'text-blue-200 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-50')} title="تعديل"><Pencil className="w-4 h-4" /></button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (isMain) {
                            const confirmed = window.confirm(
                              `⚠️ تحذير: أنت على وشك حذف المستودع الرئيسي "${wh.name}"\n\nهذا الإجراء لا يمكن التراجع عنه وقد يؤثر على بيانات المخزون.\n\nاضغط موافق للمتابعة.`
                            );
                            if (!confirmed) return;
                          }
                          setConfirmDeleteId(wh.id);
                        }}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                          isMain ? 'text-red-300 hover:bg-red-500/20 hover:text-red-200' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                        )}
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <ChevronRight className={cn('w-4 h-4', isMain ? 'text-white/45' : 'text-slate-300')} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ─── Supply Events Table ──────────────────────────────────────────── */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="p-6 border-b border-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-100">
                <ArrowDownLeft className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">سجل توريدات المستودعات</h3>
                <p className="text-xs text-gray-400 font-bold">كل عمليات الاستلام على المستودعات الرئيسية والفرعية</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-50 text-blue-700 text-xs font-black px-3 py-1.5 rounded-xl border border-blue-100">
                {filteredReceipts.length} من {totalReceipts}
              </span>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: 'إجمالي التوريدات', value: totalReceipts, color: 'blue', sub: 'عملية' },
              { label: 'القيمة الإجمالية', value: formatCurrency(totalValue), color: 'emerald', sub: '' },
              { label: 'في انتظار السداد', value: totalPending, color: 'amber', sub: 'فاتورة' },
            ].map(s => (
              <div key={s.label} className={cn('rounded-2xl p-3 border', s.color === 'blue' ? 'bg-blue-50 border-blue-100' : s.color === 'emerald' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100')}>
                <p className={cn('text-lg font-black', s.color === 'blue' ? 'text-blue-700' : s.color === 'emerald' ? 'text-emerald-700' : 'text-amber-700')}>{s.value} <span className="text-xs font-bold opacity-70">{s.sub}</span></p>
                <p className={cn('text-xs font-bold mt-0.5', s.color === 'blue' ? 'text-blue-500' : s.color === 'emerald' ? 'text-emerald-500' : 'text-amber-500')}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={receiptSearch}
                onChange={e => setReceiptSearch(e.target.value)}
                placeholder="ابحث برقم الفاتورة، المورد، المستودع..."
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pr-10 pl-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
              />
              {receiptSearch && <button onClick={() => setReceiptSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <select value={filterWarehouseId} onChange={e => setFilterWarehouseId(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-blue-100 min-w-[160px]">
              <option value="">كل المستودعات</option>
              {sortedWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-blue-100">
              <option value="">كل أنواع الدفع</option>
              <option value="paid">مدفوع</option>
              <option value="credit">آجل</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          {receiptsLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ArrowDownLeft className="w-8 h-8 text-blue-200" />
              </div>
              <h4 className="font-black text-gray-400 text-lg mb-1">لا توجد توريدات</h4>
              <p className="text-gray-400 text-sm">{receiptSearch ? 'لا توجد نتائج مطابقة' : 'لم يتم تسجيل أي توريدات بعد'}</p>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  {['رقم الفاتورة', 'التاريخ', 'المستودع', 'المورد', 'الأصناف', 'الإجمالي', 'حالة الدفع', ''].map(h => (
                    <th key={h} className="text-right px-5 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence>
                  {filteredReceipts.map((r, idx) => {
                    const wh = warehouses.find(w => w.id === r.toWarehouseId);
                    const isMain = wh?.type === 'MAIN' || wh?.id === '1';
                    const isPaid = r.paymentType === 'paid' || (r.remaining || 0) <= 0;
                    return (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                        onClick={() => setSelectedReceipt(r)}
                        className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                      >
                        <td className="px-5 py-4">
                          <span className="font-mono font-black text-blue-600 text-sm">
                            {r.invoiceNumber ? `#${r.invoiceNumber}` : `REC-${r.id?.slice(0, 8)?.toUpperCase()}`}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-600 font-bold whitespace-nowrap">
                          {formatDate(r.invoiceDate || r.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', isMain ? 'bg-blue-100' : 'bg-slate-100')}>
                              {isMain ? <Database className="w-3 h-3 text-blue-600" /> : <Building2 className="w-3 h-3 text-slate-500" />}
                            </div>
                            <span className="font-bold text-gray-800 truncate max-w-[140px]">{wh?.name || r.toWarehouseId || '—'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-700 font-bold truncate max-w-[140px]">
                          {r.supplierName || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-black text-xs px-2.5 py-1 rounded-lg">
                            <Package className="w-3 h-3" />
                            {r.items?.length || 0}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-black text-gray-900 whitespace-nowrap">
                          {formatCurrency(r.total || 0)}
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            'text-[10px] font-black px-2.5 py-1.5 rounded-xl border whitespace-nowrap',
                            isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          )}>
                            {isPaid ? '✓ مدفوع' : `آجل — متبقي ${formatCurrency(r.remaining || 0)}`}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button className="w-8 h-8 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-100">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Receipt Detail Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedReceipt && (
          <ReceiptDetailModal
            receipt={selectedReceipt}
            warehouses={warehouses}
            onClose={() => setSelectedReceipt(null)}
          />
        )}
      </AnimatePresence>

      {/* ─── Add/Edit Warehouse Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="erp-modal max-w-lg">
              <form onSubmit={handleSaveWarehouse} className="space-y-8">
                <div className="space-y-2 text-center">
                  <h3 className="text-2xl font-black text-gray-900">{editingWarehouseId ? 'تعديل المستودع' : 'إضافة مخزن جديد'}</h3>
                  <p className="text-gray-400 text-sm font-medium italic">أدخل تفاصيل المستودع أو الفرع</p>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">اسم المستودع</label>
                    <input required type="text" placeholder="مثال: مخزن فرع الشرقية" className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold" value={newWarehouse.name} onChange={e => setNewWarehouse({ ...newWarehouse, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">نوع المستودع</label>
                    <div className="grid grid-cols-2 gap-4">
                      {([['MAIN', 'رئيسي (Main)', Database], ['BRANCH', 'فرعي (Branch)', Building2]] as const).map(([type, label, Icon]) => {
                        // Disable MAIN option when adding new warehouse and one already exists (unless explicitly allowed in settings), or if disabled in settings
                        const mainExists = warehouses.some(w => w.type === 'MAIN' || w.id === '1');
                        const isMainDisabledBySettings = type === 'MAIN' && settings?.allowAddMainWarehouse === false;
                        const isDisabled = type === 'MAIN' && (
                          isMainDisabledBySettings || 
                          (settings?.allowAddMainWarehouse === false && mainExists && !editingWarehouseId)
                        );
                        return (
                          <div key={type} className="relative">
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => !isDisabled && setNewWarehouse({ ...newWarehouse, type })}
                              className={cn(
                                'w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 transition-all font-bold text-sm',
                                newWarehouse.type === type
                                  ? 'bg-blue-50 border-blue-600 text-blue-600 shadow-lg shadow-blue-50'
                                  : 'border-gray-100 text-gray-400 hover:border-gray-200',
                                isDisabled && 'opacity-40 cursor-not-allowed hover:border-gray-100'
                              )}
                            >
                              <Icon className="w-5 h-5" />{label}
                            </button>
                            {isDisabled && (
                              <div className="absolute -bottom-5 right-0 left-0 text-center">
                                <span className="text-[10px] font-black text-red-500">
                                  {isMainDisabledBySettings ? 'معطل من الإعدادات' : 'يوجد رئيسي بالفعل'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all">حفظ المستودع</button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-100 text-gray-500 font-bold py-5 rounded-2xl hover:bg-gray-200 active:scale-95 transition-all">إلغاء</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
