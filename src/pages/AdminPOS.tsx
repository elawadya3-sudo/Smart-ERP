/**
 * AdminPOS – نقطة البيع للمدير
 * A streamlined POS that mirrors core functionality of POS.tsx
 * but is accessible to ADMINs without requiring an open shift.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, Banknote,
  X, CheckCircle2, Package, Store, RefreshCcw, Loader2, Building2,
  BarChart3, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, OrderItem, Warehouse, Order } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { usePOS } from '../context/POSContext';
import { useMainStoreSettings } from '../hooks/useMainStoreSettings';
import { useNavigate } from 'react-router-dom';

export default function AdminPOS() {
  const { user } = useAuth();
  const { addInvoice } = usePOS();
  const { settings } = useMainStoreSettings();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Fetch warehouses
  useEffect(() => {
    const q = query(collection(db, 'warehouses'));
    return onSnapshot(q, snap => {
      setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
    });
  }, []);

  // Fetch products
  useEffect(() => {
    const q = query(collection(db, 'products'));
    return onSnapshot(q, snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });
  }, []);

  const branchWarehouses = useMemo(
    () => warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1'),
    [warehouses]
  );

  const availableProducts = useMemo(() =>
    products.filter(p => (p.quantity ?? 0) > 0),
    [products]
  );

  const categories = useMemo(() => {
    const cats = new Set(availableProducts.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [availableProducts]);

  const filteredProducts = useMemo(() =>
    availableProducts.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      return matchSearch && matchCat;
    }),
    [availableProducts, searchTerm, selectedCategory]
  );

  const addToCart = (product: Product) => {
    const existing = cart.find(i => i.productId === product.id);
    const currentQty = existing?.quantity ?? 0;
    if (currentQty + 1 > (product.quantity ?? 0)) {
      alert('الكمية المتاحة لا تكفي');
      return;
    }
    if (existing) {
      setCart(prev => prev.map(i =>
        i.productId === product.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price }
          : i
      ));
    } else {
      setCart(prev => [...prev, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.sellingPrice,
        originalPrice: product.sellingPrice,
        discount: 0,
        total: product.sellingPrice,
      }]);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, total: newQty * i.price };
    }).filter(i => i.quantity > 0));
  };

  const removeItem = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId));

  const subtotal = cart.reduce((a, i) => a + i.total, 0);
  const taxRate = settings?.taxEnabled ? (settings?.taxRate ?? 0) : 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const handleCheckout = async (method: 'cash' | 'visa') => {
    if (!user?.uid) { alert('يرجى تسجيل الدخول أولاً'); return; }
    if (cart.length === 0) return;
    setIsSaving(true);
    try {
      const order: Order = {
        id: `ADM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        items: cart,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentMethod: method,
        cashierId: user.uid,
        shiftId: 'ADMIN-DIRECT',
        branchId: selectedBranchId || 'ADMIN',
        createdAt: new Date().toISOString(),
        customerId: 'ADMIN-SALE',
        status: 'COMPLETED',
        notes: noteText.trim() || undefined,
      };
      await addInvoice(order);
      setIsSuccess(true);
      setCart([]);
      setIsCheckoutOpen(false);
      setNoteText('');
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  // Branch selection screen
  if (!selectedBranchId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-12" dir="rtl">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
          <Store className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-2">نقطة البيع — إدارة</h2>
        <p className="text-gray-400 font-medium mb-10">اختر الفرع لبدء الجلسة</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-xl">
          <button
            onClick={() => setSelectedBranchId('ADMIN')}
            className="p-8 bg-white border-2 border-gray-100 rounded-3xl hover:border-blue-600 hover:bg-blue-50/30 hover:-translate-y-1 transition-all shadow-sm hover:shadow-lg flex flex-col items-center gap-4"
          >
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
              <BarChart3 className="w-7 h-7" />
            </div>
            <span className="font-black text-gray-900">بيع مباشر (بدون فرع)</span>
          </button>
          {branchWarehouses.map(branch => (
            <button
              key={branch.id}
              onClick={() => setSelectedBranchId(branch.id)}
              className="p-8 bg-white border-2 border-gray-100 rounded-3xl hover:border-blue-600 hover:bg-blue-50/30 hover:-translate-y-1 transition-all shadow-sm hover:shadow-lg flex flex-col items-center gap-4"
            >
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Building2 className="w-7 h-7" />
              </div>
              <span className="font-black text-gray-900">{branch.name}</span>
              <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">{(branch as any).code || 'BRANCH'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]" dir="rtl">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  const selectedBranch = warehouses.find(w => w.id === selectedBranchId);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900">
              {selectedBranch?.name || 'بيع مباشر'}
            </h2>
            <p className="text-sm text-gray-400 font-bold">نقطة البيع — المدير</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isSuccess && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="flex items-center gap-2 bg-green-50 text-green-600 px-5 py-2.5 rounded-2xl font-black text-sm border border-green-100">
              <CheckCircle2 className="w-4 h-4" /> تمت العملية بنجاح!
            </motion.div>
          )}
          <button onClick={() => setSelectedBranchId('')}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all">
            <RefreshCcw className="w-4 h-4" /> تغيير الفرع
          </button>
          <button onClick={() => navigate('/')}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all">
            <ArrowLeft className="w-4 h-4" /> الرئيسية
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Products Panel */}
        <div className="xl:col-span-8 space-y-4">
          {/* Search & Filters */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-4">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text" placeholder="بحث بالاسم أو الباركود..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl pr-10 pl-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={cn('px-4 py-1.5 rounded-xl text-xs font-black transition-all',
                    selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                  {cat === 'All' ? 'الكل' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-300">
                <Package className="w-16 h-16 mb-4 opacity-30" />
                <p className="font-bold text-lg">لا توجد منتجات</p>
              </div>
            ) : filteredProducts.map((product) => {
              const inCart = cart.find(i => i.productId === product.id);
              return (
                <motion.div key={product.id}
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                  onClick={() => addToCart(product)}
                  className={cn(
                    'bg-white rounded-3xl border-2 p-4 cursor-pointer transition-all shadow-sm hover:shadow-md relative',
                    inCart ? 'border-blue-400 shadow-blue-50' : 'border-gray-100'
                  )}
                >
                  {inCart && (
                    <span className="absolute top-3 left-3 bg-blue-600 text-white font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                      {inCart.quantity}
                    </span>
                  )}
                  <div className="w-full aspect-square bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name}
                        className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <Package className="w-10 h-10 text-gray-200" />
                    )}
                  </div>
                  <p className="font-black text-gray-900 text-sm mb-1 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400 font-bold mb-2 truncate">{product.category}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-blue-600 text-sm">{formatCurrency(product.sellingPrice)}</span>
                    <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg',
                      (product.quantity ?? 0) > 10 ? 'bg-green-50 text-green-600' :
                      (product.quantity ?? 0) > 0 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-500')}>
                      {product.quantity ?? 0}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="xl:col-span-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
            {/* Cart Header */}
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-gray-900">السلة</h3>
                {cart.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-red-400 font-bold hover:text-red-600 transition-colors">
                  مسح الكل
                </button>
              )}
            </div>

            {/* Cart Items */}
            <div className="max-h-80 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                  <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm font-bold">السلة فارغة</p>
                </div>
              ) : cart.map(item => (
                <div key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 font-bold">{formatCurrency(item.price)} / قطعة</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.productId, -1)}
                      className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-black text-sm text-gray-900">{item.quantity}</span>
                    <button onClick={() => updateQty(item.productId, 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-green-50 hover:text-green-600 hover:border-green-100 transition-all">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-left w-20">
                    <p className="font-black text-sm text-gray-900">{formatCurrency(item.total)}</p>
                  </div>
                  <button onClick={() => removeItem(item.productId)}
                    className="w-7 h-7 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Totals */}
            {cart.length > 0 && (
              <div className="border-t border-gray-50 p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-400 font-bold">
                    <span>المجموع الفرعي</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm text-gray-400 font-bold">
                      <span>الضريبة ({taxRate}%)</span>
                      <span>{formatCurrency(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-gray-900 text-lg pt-2 border-t border-gray-100">
                    <span>الإجمالي</span>
                    <span className="text-blue-600">{formatCurrency(total)}</span>
                  </div>
                </div>

                <textarea
                  placeholder="ملاحظات (اختياري)..."
                  value={noteText} onChange={e => setNoteText(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                  rows={2}
                />

                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" /> تأكيد وإتمام البيع
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
              onClick={() => setIsCheckoutOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl" dir="rtl"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">طريقة الدفع</h3>
                  <p className="text-blue-600 font-black text-xl mt-1">{formatCurrency(total)}</p>
                </div>
                <button onClick={() => setIsCheckoutOpen(false)}
                  className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => handleCheckout('cash')}
                  disabled={isSaving}
                  className="w-full flex items-center gap-4 p-5 bg-green-50 hover:bg-green-100 border-2 border-green-100 rounded-2xl transition-all group disabled:opacity-50"
                >
                  <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-100 group-hover:scale-110 transition-transform">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <p className="font-black text-gray-900">نقدي</p>
                    <p className="text-sm text-gray-400 font-bold">Cash Payment</p>
                  </div>
                </button>
                <button
                  onClick={() => handleCheckout('visa')}
                  disabled={isSaving}
                  className="w-full flex items-center gap-4 p-5 bg-blue-50 hover:bg-blue-100 border-2 border-blue-100 rounded-2xl transition-all group disabled:opacity-50"
                >
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <p className="font-black text-gray-900">بطاقة ائتمان</p>
                    <p className="text-sm text-gray-400 font-bold">Visa / Mastercard</p>
                  </div>
                </button>
              </div>
              {isSaving && (
                <div className="flex items-center justify-center gap-2 mt-6 text-gray-500 font-bold">
                  <Loader2 className="w-4 h-4 animate-spin" /> جارٍ الحفظ...
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
