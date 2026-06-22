import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { productsService, ordersService } from '../../services/firestore';
import { inventoryTransactionService, warehouseService } from '../../services/inventory';
import { Product, Warehouse, InventoryTransaction } from '../../types';
import { Search, Save, ArrowRightLeft, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function BranchTransferRequest() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [items, setItems] = useState<{ productId: string; productName: string; quantity: number }[]>([]);
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transferRequests, setTransferRequests] = useState<InventoryTransaction[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prods, whs] = await Promise.all([productsService.getAll(), warehouseService.getAll()]);
        setProducts(prods);
        setWarehouses(whs);
        if (whs.length > 1) setSelectedWarehouse(whs[1].id);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();

    const q = query(collection(db, 'inventory_transactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransferRequests(snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as InventoryTransaction)));
    });
    return () => unsubscribe();
  }, []);

  const addItem = (product: Product) => {
    setItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, productName: product.name, quantity: 1 }];
    });
  };

  const updateItemQty = (id: string, value: number) => {
    setItems(prev => prev.map(item => item.productId === id ? { ...item, quantity: Math.max(1, value) } : item));
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(item => item.productId !== id));

  const handleSubmit = async () => {
    if (!selectedWarehouse || items.length === 0) {
      alert('يرجى اختيار الجهة وإضافة منتجات.');
      return;
    }
    setSubmitting(true);
    try {
      await inventoryTransactionService.createPendingTransferRequest({
        type: 'TRANSFER',
        status: 'PENDING',
        toWarehouseId: selectedWarehouse,
        items,
        reference: reference.trim(),
        notes: 'طلب تحويل مخزني',
        createdBy: 'system'
      });
      setItems([]);
      setReference('');
      alert('تم إرسال طلب التحويل بنجاح. في انتظار التصديق.');
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">طلب تحويل بضاعة</h2>
          <p className="text-gray-500 mt-1">أنشئ طلب تحويل مخزني بين الفروع ليتم اعتماده لاحقاً.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-400">المستودع الوجهة</label>
            <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}
              className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-sm font-bold outline-none border border-gray-200">
              <option value="">اختر المستودع الوجهة</option>
              {warehouses.filter(wh => wh.id !== selectedWarehouse).map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-400">مرجع الطلب</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="رقم الطلب أو سبب التحويل"
              className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-sm font-bold outline-none border border-gray-200" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-black text-gray-600 uppercase tracking-widest">المنتجات المطلوب تحويلها</p>
            <div className="space-y-3 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {items.length === 0 ? (
                <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-3xl">لم يتم إضافة منتجات بعد</div>
              ) : items.map(item => (
                <div key={item.productId} className="flex items-center justify-between gap-3 p-4 rounded-3xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="font-black text-gray-900">{item.productName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateItemQty(item.productId, item.quantity - 1)} type="button" className="w-9 h-9 rounded-2xl bg-white border border-gray-200 text-gray-700">-</button>
                    <input type="number" value={item.quantity} min={1} onChange={e => updateItemQty(item.productId, Number(e.target.value))}
                      className="w-16 text-center bg-white border border-gray-200 rounded-2xl py-2" />
                    <button onClick={() => updateItemQty(item.productId, item.quantity + 1)} type="button" className="w-9 h-9 rounded-2xl bg-white border border-gray-200 text-gray-700">+</button>
                    <button onClick={() => removeItem(item.productId)} type="button" className="text-red-500 rounded-full p-2 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleSubmit} disabled={submitting || items.length === 0 || !selectedWarehouse}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'جارٍ إرسال الطلب...' : 'إرسال طلب التحويل'}
          </button>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-black text-gray-900">اختر المنتجات</h3>
              <p className="text-gray-500 text-sm">اضغط على منتج لإضافته إلى طلب التحويل.</p>
            </div>
            <div className="text-xs font-black uppercase tracking-widest text-blue-600">{products.length} منتج</div>
          </div>
          <div className="space-y-3 max-h-[520px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {loading ? (
              [1,2,3].map(idx => <div key={idx} className="h-16 rounded-3xl bg-gray-100 animate-pulse" />)
            ) : products.length === 0 ? (
              <div className="text-center py-16 text-gray-400">لا توجد منتجات</div>
            ) : (
              products.map(product => (
                <motion.button key={product.id} type="button" whileTap={{ scale: 0.98 }} onClick={() => addItem(product)}
                  className="w-full text-right p-4 rounded-3xl border border-gray-100 bg-white flex items-center justify-between gap-4 hover:bg-blue-50 transition-all">
                  <div>
                    <p className="font-black text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{product.category} • {product.brand}</p>
                  </div>
                  <span className="text-sm font-black text-blue-600">إضافة</span>
                </motion.button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-gray-900">طلبات التحويل السابقة</h3>
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">{transferRequests.filter(tx => tx.type === 'TRANSFER').length} طلب</span>
        </div>
        {transferRequests.filter(tx => tx.type === 'TRANSFER').length === 0 ? (
          <div className="text-center py-16 text-gray-400">لا توجد طلبات تحويل مسجلة بعد.</div>
        ) : (
          <div className="space-y-3">
            {transferRequests.filter(tx => tx.type === 'TRANSFER').slice(0, 10).map(tx => (
              <div key={tx.id} className="p-4 rounded-3xl border border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-gray-900">{tx.reference || 'طلب تحويل'}</p>
                    <p className="text-sm text-gray-500">{tx.notes || 'طلب تحويل مخزني'}</p>
                  </div>
                  <span className="text-xs font-black text-gray-500">{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
