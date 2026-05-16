import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  User,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  X,
  CheckCircle2,
  Package,
  Store,
  TrendingUp,
  ArrowDownCircle,
  BarChart3,
  History,
  LayoutDashboard,
  Bell,
  RefreshCcw,
  Edit3
} from 'lucide-react';
import { productsService, ordersService } from '../services/firestore';
import { Product, OrderItem, StockLevel, Order, Warehouse, InventoryTransaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

import { usePOS } from '../context/POSContext';

export default function POS() {
  const { user } = useAuth();
  const { getOpenShift, openShift, closeShift, addInvoice, invoices: contextInvoices } = usePOS();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransaction[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [openingCash, setOpeningCash] = useState(0);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [actualCash, setActualCash] = useState(0);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [lastTransferId, setLastTransferId] = useState<string | null>(null);
  const isFirstLoad = React.useRef(true);

  // Fetch Warehouses
  useEffect(() => {
    const qW = query(collection(db, 'warehouses'));
    const unsubscribe = onSnapshot(qW, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
      setWarehouses(docs);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Products from Firestore
  useEffect(() => {
    const qP = query(collection(db, 'products'));
    const unsubP = onSnapshot(qP, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return () => unsubP();
  }, []);

  // Fetch completed transfers to calculate branch stock
  useEffect(() => {
    const qT = query(collection(db, 'inventory_transactions'), orderBy('createdAt', 'desc'));
    const unsubT = onSnapshot(qT, (snapshot) => {
      setTransfers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as InventoryTransaction)));
    });
    return () => unsubT();
  }, []);

  // Auto-set branch for cashiers
  useEffect(() => {
    if (user?.role === 'CASHIER' && user.branchId) {
      setSelectedBranchId(user.branchId);
    }
  }, [user]);

  // Sync isFirstLoad
  useEffect(() => {
    if (transfers.length > 0) {
      setTimeout(() => { isFirstLoad.current = false; }, 3000);
    }
  }, [transfers]);

  const currentShift = getOpenShift(selectedBranchId);

  // Branch Selection at start
  if (!selectedBranchId) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-8" dir="rtl">
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black text-gray-900">نظام البيع (POS)</h2>
          <p className="text-gray-500 font-medium italic">يرجى اختيار الفرع للبدء في عمليات البيع</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-6">
          {warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1').map(branch => (
            <button
              key={branch.id}
              onClick={() => setSelectedBranchId(branch.id)}
              className="flex flex-col items-center gap-6 p-10 bg-white rounded-[2.5rem] border-2 border-gray-100 hover:border-blue-600 hover:bg-blue-50/50 hover:-translate-y-2 transition-all group shadow-sm hover:shadow-xl"
            >
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shadow-inner">
                <Store className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h4 className="text-xl font-black text-gray-900">{branch.name}</h4>
                <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-1">{(branch as any).code || 'BRANCH'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Shift Check - if no open shift for this branch
  if (!currentShift) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-8" dir="rtl">
        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 shadow-inner mb-4">
          <CreditCard className="w-12 h-12" />
        </div>
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-black text-gray-900">بدء وردية جديدة</h2>
          <p className="text-gray-400 font-medium max-w-md mx-auto">للبدء في عمليات البيع لفرع {warehouses.find(w => w.id === selectedBranchId)?.name}، يجب فتح وردية جديدة أولاً.</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl w-full max-w-md space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-400 uppercase tracking-widest mr-2">مبلغ الكاش الافتتاحي (Opening Cash)</label>
            <input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-100 font-black text-lg transition-all"
              placeholder="0.00"
            />
          </div>
          <button
            disabled={isOpeningShift}
            onClick={async () => {
              try {
                setIsOpeningShift(true);
                await openShift(selectedBranchId, user?.uid || 'admin', openingCash, user?.name || 'مدير النظام');
              } catch (err) {
                alert('فشل فتح الوردية. يرجى التحقق من الاتصال أو الصلاحيات.');
                console.error(err);
              } finally {
                setIsOpeningShift(false);
              }
            }}
            className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:bg-gray-400 disabled:shadow-none"
          >
            {isOpeningShift ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                فتح الوردية الآن
              </>
            )}
          </button>
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setSelectedBranchId('')}
              className="w-full text-gray-400 font-bold py-2 hover:text-gray-600 transition-colors"
            >
              العودة لاختيار الفرع
            </button>
          )}
        </div>
      </div>
    );
  }

  const branchWarehouse = warehouses.find(w => w.id === selectedBranchId);

  // Calculate branch stock for a product (Incoming Transfers - Sales)
  const getBranchStock = (productId: string, branchId: string): number => {
    const incoming = transfers
      .filter(t => t.type === 'TRANSFER' && t.status === 'COMPLETED' && t.toWarehouseId === branchId)
      .reduce((sum, t) => {
        const item = t.items?.find(i => i.productId === productId);
        return sum + (item?.quantity || 0);
      }, 0);

    const outgoing = contextInvoices
      .filter(inv => inv.branchId === branchId && inv.customerId !== 'EXPENSE')
      .reduce((sum, inv) => {
        const item = inv.items.find(i => i.productId === productId);
        return sum + (item?.quantity || 0);
      }, 0);

    return Math.max(0, incoming - outgoing);
  };

  // Filter products that have stock in selected branch
  const availableProducts = products.map(p => ({
    ...p,
    branchStock: getBranchStock(p.id, selectedBranchId)
  })).filter(p => p.branchStock > 0);

  const filteredProducts = availableProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && String(p.barcode).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addToCart = (product: Product & { branchStock: number }) => {
    const existing = cart.find(item => item.productId === product.id);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + 1 > product.branchStock) {
      alert('عذراً، الكمية المطلوبة تتجاوز المتاح في المخزن الفرعي');
      return;
    }

    if (existing) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.sellingPrice,
        originalPrice: product.sellingPrice,
        discount: 0,
        minSellingPrice: product.minSellingPrice || 0,
        total: product.sellingPrice
      }]);
    }
  };

  const updateDiscount = (productId: string, discount: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        const minPrice = item.minSellingPrice || 0;
        const newPrice = item.originalPrice - discount;

        if (minPrice > 0 && newPrice < minPrice) {
          alert(`عذراً، أقل سعر بيع مسموح لهذا المنتج هو ${formatCurrency(minPrice)}`);
          return item;
        }

        return {
          ...item,
          discount: discount,
          price: newPrice,
          total: newPrice * item.quantity
        };
      }
      return item;
    }));
  };

  const updateQuantity = (productId: string, delta: number) => {
    const product = availableProducts.find(p => p.id === productId);
    if (!product) return;

    setCart(cart.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        if (newQty > product.branchStock) {
          alert('الكمية المتاحة لا تكفي');
          return item;
        }
        return { ...item, quantity: newQty, total: newQty * item.price };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  const tax = subtotal * 0.15; // 15% VAT
  const total = subtotal + tax;

  const handleCheckout = async (method: 'cash' | 'visa') => {
    try {
      const newInvoice: Order = {
        id: `INV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        items: cart,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentMethod: method,
        cashierId: user?.uid || 'admin',
        shiftId: currentShift.id,
        branchId: selectedBranchId,
        createdAt: new Date().toISOString(),
        customerId: selectedBranchId 
      };

      await addInvoice(newInvoice);

      setIsSuccess(true);
      setCart([]);
      setIsCheckoutOpen(false);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] lg:h-[calc(100vh-140px)] flex flex-col gap-4 lg:gap-6" dir="rtl">
      {/* Top Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-30"></div>
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 z-10">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-black uppercase tracking-widest leading-none mb-1">الفرع الحالي</p>
            <h3 className="text-xl font-black text-gray-900">{branchWarehouse?.name}</h3>
          </div>

          <div className="h-10 w-px bg-gray-100 mx-2"></div>

          <div>
            <p className="text-sm text-gray-400 font-black uppercase tracking-widest leading-none mb-1">الوردية الحالية</p>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", currentShift ? "bg-green-500 animate-pulse" : "bg-gray-300")}></div>
              <h3 className="text-sm font-black text-gray-900 tracking-wider font-mono">{currentShift?.id || 'لا توجد وردية'}</h3>
            </div>
          </div>
        </div>

          <div className="flex gap-2">
            {currentShift && (
              <button
                onClick={() => {
                  setActualCash(0);
                  setIsCloseShiftModalOpen(true);
                }}
                className="text-sm font-black text-red-600 uppercase tracking-widest border border-red-100 bg-red-50 px-6 py-3 rounded-xl hover:bg-red-100 transition-all flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                إغلاق الوردية
              </button>
             )}

             {user?.role === 'ADMIN' && (
              <button
                onClick={() => setSelectedBranchId('')}
                className="text-sm font-black text-gray-400 uppercase tracking-widest border border-gray-100 px-6 py-3 rounded-xl hover:bg-gray-50 transition-all"
              >
                تغيير الفرع
              </button>
            )}
          </div>
        </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-8 overflow-hidden">
        {/* Products Selection Section - (Same style as before but with branch specific data) */}
        <div className="flex-1 flex flex-col gap-4 lg:gap-6 overflow-hidden">
          <div className="relative">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 font-bold" />
            <input
              type="text"
              placeholder="ابحث عن منتج متاح في هذا الفرع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-[2rem] pr-14 pl-6 py-5 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold transition-all shadow-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pb-10 pr-2">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-300 gap-4 opacity-50">
                <Package className="w-20 h-20" />
                <p className="font-bold text-lg">لا توجد منتجات متوفرة حالياً في هذا الفرع</p>
                <p className="text-sm">قم بتحويل بضاعة من المخزن الرئيسي أولاً</p>
              </div>
            ) : filteredProducts.map((product) => (
              <motion.button
                whileTap={{ scale: 0.95 }}
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white p-5 rounded-[2.5rem] border border-gray-50 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all text-right group flex flex-col items-center gap-4 text-center"
              >
                <div className="w-full aspect-square rounded-[2rem] bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors shadow-inner relative">
                  <Package className="w-14 h-14 text-gray-200 group-hover:text-blue-300" />
                  <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full border border-gray-100 shadow-sm">
                    <span className="text-sm font-black text-blue-600 uppercase tracking-widest">{product.branchStock} PCS</span>
                  </div>
                </div>
                <div className="w-full">
                  <h4 className="font-black text-gray-900 text-sm line-clamp-1 mb-1">{product.name}</h4>
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-widest leading-none mb-3">{product.brand}</p>
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 flex justify-center items-center">
                    <span className="text-blue-600 font-extrabold text-lg">{formatCurrency(product.sellingPrice)}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Sidebar Section: Cart */}
        <div className="w-full lg:w-96 bg-white rounded-[2rem] lg:rounded-[3rem] border border-gray-100 shadow-sm lg:shadow-[0_20px_50px_rgba(0,0,0,0.05)] flex flex-col flex-1 lg:flex-auto min-h-[40vh] lg:min-h-0 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 leading-none mb-1">فاتورة بيع</h3>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Cart: {cart.length} Items</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-none">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 opacity-50">
                <div className="w-20 h-20 rounded-[2rem] bg-gray-50 flex items-center justify-center">
                  <ShoppingCart className="w-10 h-10" />
                </div>
                <p className="font-bold text-sm">السلة فارغة حالياً</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="bg-white p-5 rounded-3xl relative group border border-gray-50 shadow-sm hover:shadow-md transition-all">
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="absolute -top-2 -left-2 w-8 h-8 bg-white text-red-500 rounded-full border border-gray-100 flex items-center justify-center shadow-sm hover:bg-red-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex flex-col gap-3">
                    <div>
                      <h5 className="text-sm font-black text-gray-900 leading-tight mb-0.5">{item.name}</h5>
                      <p className="text-sm text-gray-400 font-bold font-sans">#ITEM-{item.productId.toUpperCase()}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center bg-gray-50 rounded-2xl p-1 gap-4">
                        <button
                          onClick={() => updateQuantity(item.productId, -1)}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 bg-white rounded-xl shadow-sm"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-black text-gray-900 font-sans">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, 1)}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 bg-white rounded-xl shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-black text-gray-400 uppercase tracking-widest">خصم:</span>
                           <input
                             type="number"
                             value={item.discount || ''}
                             onChange={(e) => updateDiscount(item.productId, Number(e.target.value))}
                             className="w-16 bg-orange-50 border border-orange-100 rounded-lg px-2 py-1 text-sm font-black text-orange-600 outline-none focus:ring-2 focus:ring-orange-200 text-center"
                             placeholder="0"
                           />
                        </div>
                        <span className="text-blue-600 font-black text-sm font-sans">{formatCurrency(item.total)}</span>
                        {item.minSellingPrice && item.minSellingPrice > 0 && (
                          <span className="text-sm text-gray-300 font-bold italic">أقل سعر: {formatCurrency(item.minSellingPrice)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-8 bg-gray-50/50 border-t border-gray-100 space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm font-bold px-1">
                <span className="text-gray-400 uppercase tracking-widest">المجموع الفرعي</span>
                <span className="text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold px-1">
                <span className="text-gray-400 uppercase tracking-widest">الضريبة المضافة (15%)</span>
                <span className="text-gray-900">{formatCurrency(tax)}</span>
              </div>
              <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-xl font-black text-gray-900">المطلوب</span>
                <span className="text-3xl font-black text-blue-600 tracking-tighter">{formatCurrency(total)}</span>
              </div>
            </div>
            <button
              disabled={cart.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-blue-100 hover:bg-blue-700 disabled:bg-gray-200 disabled:shadow-none hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <CreditCard className="w-6 h-6" />
              إصدار فاتورة بيع
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
              onClick={() => setIsCheckoutOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-12 shadow-2xl overflow-hidden text-center"
              dir="rtl"
            >
              <h3 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">طريقة الدفع</h3>
              <p className="text-gray-400 mb-10 font-medium italic">يرجى الاختيار لإتمام عملية الخصم من مخزن الفرع</p>

              <div className="grid grid-cols-2 gap-6">
                <button
                  onClick={() => handleCheckout('cash')}
                  className="flex flex-col items-center gap-6 p-10 rounded-[2.5rem] border-2 border-gray-50 hover:border-blue-600 hover:bg-blue-50/50 transition-all group shadow-sm"
                >
                  <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform shadow-inner">
                    <Banknote className="w-8 h-8" />
                  </div>
                  <span className="font-black text-gray-700">كاش / نقدي</span>
                </button>
                <button
                  onClick={() => handleCheckout('visa')}
                  className="flex flex-col items-center gap-6 p-10 rounded-[2.5rem] border-2 border-gray-50 hover:border-blue-600 hover:bg-blue-50/50 transition-all group shadow-sm"
                >
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shadow-inner">
                    <CreditCard className="w-8 h-8" />
                  </div>
                  <span className="font-black text-gray-700">فيزا / كارت</span>
                </button>
              </div>

              <div className="mt-10 pt-10 border-t border-gray-100 flex justify-between items-center">
                <span className="text-gray-400 font-bold uppercase tracking-widest text-sm">إجمالي الفاتورة</span>
                <span className="text-4xl text-blue-600 font-black tracking-tighter">{formatCurrency(total)}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCloseShiftModalOpen && currentShift && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" 
              onClick={() => setIsCloseShiftModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-12 shadow-2xl overflow-hidden" dir="rtl"
            >
              <div className="text-center mb-10">
                <h3 className="text-3xl font-black text-gray-900 mb-2">إغلاق الوردية الحالية</h3>
                <p className="text-gray-400 font-medium italic">سيتم ترحيل البيانات لسجل مبيعات الفرع</p>
              </div>

              <div className="space-y-3 mb-10">
                <label className="text-sm font-black text-gray-400 uppercase tracking-widest mr-2">الكاش الموجود فعلياً في الدرج (Actual Cash)</label>
                <input 
                  type="number" 
                  value={actualCash} 
                  onChange={(e) => setActualCash(Number(e.target.value))} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 outline-none focus:ring-4 focus:ring-blue-100 font-black text-2xl text-center" 
                  placeholder="0.00" 
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsCloseShiftModalOpen(false)} 
                  className="flex-1 bg-gray-100 text-gray-400 font-black py-5 rounded-2xl hover:bg-gray-200 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  onClick={async () => {
                    try {
                      setIsClosing(true);
                      await closeShift(currentShift.id, actualCash);
                      setIsCloseShiftModalOpen(false);
                      setCart([]); // Clear cart
                      setIsClosing(false);
                      alert('تم إغلاق الوردية بنجاح. يمكنك الآن فتح وردية جديدة.');
                    } catch (e) {
                      console.error(e);
                      setIsClosing(false);
                      alert('حدث خطأ أثناء إغلاق الوردية');
                    }
                  }} 
                  disabled={isClosing}
                  className="flex-[2] bg-red-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isClosing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <X className="w-5 h-5" />}
                  إغلاق الوردية نهائياً
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-12 left-12 z-[60] bg-gray-900 border border-gray-800 text-white px-10 py-6 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-5 font-bold"
          >
            <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-500/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg">تمت عملية البيع بنجاح!</span>
              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">تم خصم الكميات من مخزن {branchWarehouse?.name}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDetail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetail(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              dir="rtl"
            >
              <div className="bg-gray-900 p-8 text-white relative flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                       {selectedDetail.items ? <Package className="w-8 h-8" /> : <ShoppingCart className="w-8 h-8" />}
                    </div>
                    <div>
                       <h3 className="text-2xl font-black">تفاصيل العملية</h3>
                       <p className="text-gray-400 text-sm font-medium">رقم المرجع: {selectedDetail.id}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedDetail(null)} className="absolute top-8 left-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <X className="w-6 h-6" />
                  </button>
              </div>

              <div className="p-8 overflow-y-auto">
                 <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-gray-50 p-4 rounded-2xl">
                       <span className="text-sm font-black text-gray-400 uppercase block mb-1">الحالة</span>
                       <span className={cn(
                          "px-3 py-1 rounded-full text-sm font-black",
                          selectedDetail.status === 'COMPLETED' ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                       )}>{selectedDetail.status}</span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl">
                       <span className="text-sm font-black text-gray-400 uppercase block mb-1">التاريخ</span>
                       <span className="text-sm font-bold text-gray-900">{new Date(selectedDetail.createdAt).toLocaleString('ar-EG')}</span>
                    </div>
                 </div>

                 <h5 className="font-black text-gray-900 mb-4 flex items-center gap-2 text-lg">
                    <Package className="w-5 h-5 text-blue-600" />
                    محتويات العملية:
                 </h5>

                 <div className="space-y-3">
                    {(selectedDetail.items || selectedDetail.products || []).map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg border border-gray-100 flex items-center justify-center text-sm font-black text-gray-400 shadow-sm">
                               {idx + 1}
                            </div>
                            <div>
                               <p className="text-sm font-black text-gray-900">{item.name || item.productName}</p>
                               <p className="text-sm text-gray-400 font-bold">الكمية: {item.quantity} | السعر: {formatCurrency(item.price || 0)}</p>
                            </div>
                         </div>
                         <div className="text-left">
                            <span className="text-sm font-black text-blue-600 font-sans">{formatCurrency((item.price || 0) * (item.quantity || 0))}</span>
                         </div>
                      </div>
                    ))}
                 </div>

                 <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
                    <div className="flex flex-col">
                       <span className="text-sm font-black text-gray-400 uppercase">الإجمالي النهائي</span>
                       <span className="text-3xl font-black text-gray-900 font-sans">{formatCurrency(selectedDetail.total || 0)}</span>
                    </div>
                    {selectedDetail.paymentMethod && (
                      <div className="bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100">
                         <span className="text-sm font-black text-blue-600 uppercase block mb-1">طريقة الدفع</span>
                         <span className="font-black text-blue-900">{selectedDetail.paymentMethod === 'cash' ? 'نقداً' : 'بطاقة'}</span>
                      </div>
                    )}
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}




