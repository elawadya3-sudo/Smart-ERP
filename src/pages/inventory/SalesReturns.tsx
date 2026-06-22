import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { productsService } from '../../services/firestore';
import { inventoryTransactionService } from '../../services/inventory';
import { Product, InventoryTransaction } from '../../types';
import { Search, Plus, Save, Package, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function SalesReturnsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<{ productId: string; productName: string; quantity: number }[]>([]);
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recentReturns, setRecentReturns] = useState<InventoryTransaction[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await productsService.getAll();
        setProducts(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();

    const q = query(collection(db, 'inventory_transactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryTransaction));
      setRecentReturns(list.filter(tx => tx.type === 'RETURN').slice(0, 10));
    });
    return () => unsubscribe();
  }, []);

  const filteredProducts = useMemo(() => products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  ), [products, searchTerm]);

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

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = async () => {
    if (items.length === 0) {
      alert('يرجى إضافة منتجات مرتجعة.');
      return;
    }
    setSubmitting(true);
    try {
      await inventoryTransactionService.createStockMovement({
        type: 'RETURN',
        status: 'COMPLETED',
        items,
        reference: reference.trim(),
        notes: 'مردود مبيعات',
        createdBy: 'system'
      });
      setItems([]);
      setReference('');
      alert('تم تسجيل المردود وإعادة المنتجات للمخزون.');
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'حدث خطأ أثناء تسجيل المردود');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">مردودات مبيعات</h2>
          <p className="text-gray-500 mt-1">قم باسترجاع البضاعة المباعة وإعادة إضافتها إلى المخزون.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-400">مرجع الفاتورة أو العميل</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="رقم الفاتورة أو اسم العميل"
              className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-sm font-bold outline-none border border-gray-200" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-black text-gray-600 uppercase tracking-widest">المنتجات المرتجعة</p>
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

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">إجمالي الكمية المرتجعة</p>
              <p className="text-2xl font-black text-gray-900">{totalQuantity} قطعة</p>
            </div>
            <button onClick={handleSubmit} disabled={submitting || items.length === 0}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'جارٍ الحفظ...' : 'تأكيد المردود'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-black text-gray-900">اختر المنتجات</h3>
              <p className="text-gray-500 text-sm">اضغط على منتج لإضافته إلى الفاتورة المرتجعة.</p>
            </div>
            <div className="text-xs font-black uppercase tracking-widest text-blue-600">{filteredProducts.length} نتيجة</div>
          </div>
          <div className="relative mb-4">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث عن المنتج..."
              className="w-full bg-gray-50 rounded-2xl px-12 py-4 text-sm outline-none border border-gray-200" />
          </div>
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-16 rounded-3xl bg-gray-100" />
              <div className="h-16 rounded-3xl bg-gray-100" />
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {filteredProducts.map(product => (
                <motion.button key={product.id} type="button" whileTap={{ scale: 0.98 }} onClick={() => addItem(product)}
                  className="w-full text-right p-4 rounded-3xl border border-gray-100 bg-white flex items-center justify-between gap-4 hover:bg-blue-50 transition-all">
                  <div>
                    <p className="font-black text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{product.category} • {product.brand}</p>
                  </div>
                  <span className="text-sm font-black text-blue-600">إضافة</span>
                </motion.button>
              ))}
              {filteredProducts.length === 0 && <div className="text-center py-16 text-gray-400">لا يوجد منتجات مطابقة</div>}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-gray-900">آخر 10 مرتجعات</h3>
        </div>
        {recentReturns.length === 0 ? (
          <div className="text-center py-16 text-gray-400">لا توجد مرتجعات سابقة.</div>
        ) : (
          <div className="space-y-3">
            {recentReturns.map(returnTx => (
              <div key={returnTx.id} className="p-4 rounded-3xl border border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-gray-900">{returnTx.reference || 'مرتجع غير معرف'}</p>
                    <p className="text-sm text-gray-500">{returnTx.notes || 'مردود مبيعات'}</p>
                  </div>
                  <span className="text-xs font-black text-gray-500">{returnTx.items.length} صنف</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
