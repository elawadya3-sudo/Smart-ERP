import React, { useState, useEffect, useMemo } from 'react';
import { productsService } from '../../services/firestore';
import { Product } from '../../types';
import { collection, getDocs, query, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Search, Plus, Save, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export default function BulkProductEditPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceUpdate, setPriceUpdate] = useState('');
  const [costUpdate, setCostUpdate] = useState('');
  const [categoryUpdate, setCategoryUpdate] = useState('');
  const [brandUpdate, setBrandUpdate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => console.error('Products listener error:', error));

    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  ), [products, searchTerm]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const applyBulkUpdate = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    try {
      const updates: Partial<Product> = {};
      if (priceUpdate.trim() !== '') updates.sellingPrice = Number(priceUpdate);
      if (costUpdate.trim() !== '') updates.costPrice = Number(costUpdate);
      if (categoryUpdate.trim() !== '') updates.category = categoryUpdate.trim();
      if (brandUpdate.trim() !== '') updates.brand = brandUpdate.trim();

      if (Object.keys(updates).length === 0) {
        alert('يرجى تحديد قيمة واحدة على الأقل للتحديث.');
        return;
      }

      await Promise.all(selectedIds.map(id => productsService.update(id, updates)));
      alert('تم تحديث المنتجات المحددة بنجاح');
      setSelectedIds([]);
      setPriceUpdate('');
      setCostUpdate('');
      setCategoryUpdate('');
      setBrandUpdate('');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تحديث المنتجات');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selectedIds.length;

  return (
    <div className="space-y-8 pb-20" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">تعديل مجمع للأصناف</h2>
          <p className="text-gray-500 mt-1">قم بتحديث سمات مجموعة منتجات مرة واحدة بدلاً من تحرير كل منتج على حدة.</p>
        </div>
        <div className="w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="ابحث باسم المنتج أو الباركود أو الماركة..."
              className="w-full bg-white border border-gray-200 rounded-2xl pr-12 pl-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-gray-900">تحديث مجمع</h3>
              <p className="text-gray-500 text-sm">تطبيق تغييرات على المنتجات المحددة دفعة واحدة.</p>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-600">{selectedCount} منتج محدد</span>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">السعر النهائي</label>
              <input type="number" value={priceUpdate} onChange={e => setPriceUpdate(e.target.value)} placeholder="ادخل سعر جديد"
                className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-sm font-bold outline-none border border-gray-200" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">سعر التكلفة</label>
              <input type="number" value={costUpdate} onChange={e => setCostUpdate(e.target.value)} placeholder="ادخل سعر تكلفة جديد"
                className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-sm font-bold outline-none border border-gray-200" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">الفئة</label>
              <input value={categoryUpdate} onChange={e => setCategoryUpdate(e.target.value)} placeholder="تغيير الفئة"
                className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-sm font-bold outline-none border border-gray-200" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">البراند</label>
              <input value={brandUpdate} onChange={e => setBrandUpdate(e.target.value)} placeholder="تغيير الماركة"
                className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-sm font-bold outline-none border border-gray-200" />
            </div>
          </div>
          <button onClick={applyBulkUpdate} disabled={selectedCount === 0 || saving}
            className={cn('w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all',
              selectedCount === 0 || saving ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100')}
          >
            <Save className="w-4 h-4" /> تطبيق التحديثات
          </button>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-xl font-black text-gray-900">قائمة المنتجات</h3>
              <p className="text-gray-500 text-sm">اختر المنتجات التي تريد تعديلها دفعة واحدة.</p>
            </div>
            <button onClick={() => setSelectedIds(filtered.map(p => p.id))} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-2xl text-xs font-black hover:bg-blue-100">تحديد الكل</button>
          </div>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-16 rounded-3xl bg-gray-100" />
              <div className="h-16 rounded-3xl bg-gray-100" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">لا توجد منتجات مطابقة.</div>
          ) : (
            <div className="space-y-4">
              {filtered.map(product => (
                <motion.div key={product.id} layout className={cn('p-4 rounded-3xl border border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
                  selectedIds.includes(product.id) ? 'bg-blue-50 border-blue-100' : 'bg-white')}>
                  <div>
                    <p className="font-black text-gray-900">{product.name}</p>
                    <p className="text-gray-500 text-sm">{product.brand} • {product.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" className="px-3 py-2 rounded-2xl bg-white border border-gray-200 text-xs font-black hover:bg-gray-50" onClick={() => toggleSelect(product.id)}>
                      {selectedIds.includes(product.id) ? 'تم التحديد' : 'تحديد'}
                    </button>
                    <span className="text-xs text-gray-500">{product.quantity} قطعة</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
