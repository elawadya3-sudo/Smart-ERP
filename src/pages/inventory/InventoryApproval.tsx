import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { inventoryTransactionService } from '../../services/inventory';
import { InventoryTransaction } from '../../types';
import { CheckCircle2, XCircle, ShieldCheck, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDate } from '../../lib/utils';

export default function InventoryApprovalPage() {
  const [pendingRequests, setPendingRequests] = useState<InventoryTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'inventory_transactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryTransaction));
      setPendingRequests(list.filter(item => item.status === 'PENDING'));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filtered = pendingRequests.filter(tx =>
    tx.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.items.some(item => item.productName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAction = async (transaction: InventoryTransaction, approve: boolean) => {
    setApprovingId(transaction.id);
    try {
      if (approve) {
        await inventoryTransactionService.approveStockMovement(transaction);
      } else {
        await updateDoc(doc(db, 'inventory_transactions', transaction.id), { status: 'CANCELLED' });
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'حدث خطأ أثناء تحديث حالة الطلب');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-8 pb-20" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">تصديقات المخازن</h2>
          <p className="text-gray-500 mt-1">اعتمد أو ارفض طلبات المخزون المعلقة قبل تحديث الأرصدة النهائية.</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900">الطلبات المعلقة</h3>
            <p className="text-gray-500 text-sm">التحويلات أو الأوامر التي تحتاج إلى اعتماد قبل التنفيذ.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث بالمرجع أو المنتج..."
              className="w-full bg-gray-50 rounded-2xl px-12 py-4 text-sm outline-none border border-gray-200" />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-20 rounded-3xl bg-gray-100" />
            <div className="h-20 rounded-3xl bg-gray-100" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400">لا توجد طلبات معلقة حالياً.</div>
        ) : (
          <div className="space-y-4">
            {filtered.map(tx => (
              <motion.div key={tx.id} layout className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <ShieldCheck className="w-5 h-5 text-blue-600" />
                      <h4 className="text-lg font-black text-gray-900">{tx.reference || 'طلب مخزون'}</h4>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{tx.notes || 'طلب تحويل أو تعديل مخزون'}</p>
                    <p className="text-sm text-gray-400">تاريخ الإنشاء: {formatDate(tx.createdAt)}</p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                      <div>النوع: <span className="font-black">{tx.type}</span></div>
                      <div>عدد الأصناف: <span className="font-black">{tx.items.length}</span></div>
                      {tx.toWarehouseId && <div>مستودع الوجهة: <span className="font-black">{tx.toWarehouseId}</span></div>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:w-auto">
                    <button onClick={() => handleAction(tx, true)} disabled={approvingId === tx.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 text-white px-4 py-3 font-black text-sm hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      <CheckCircle2 className="w-4 h-4" /> اعتماد
                    </button>
                    <button onClick={() => handleAction(tx, false)} disabled={approvingId === tx.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 text-red-600 px-4 py-3 font-black text-sm hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      <XCircle className="w-4 h-4" /> رفض
                    </button>
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  {tx.items.map(item => (
                    <div key={item.productId} className="rounded-3xl bg-white border border-gray-100 p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.quantity} قطعة</p>
                      </div>
                      <span className="text-xs font-black text-gray-500">{item.productId}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
