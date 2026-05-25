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
  History as HistoryIcon,
  LayoutDashboard,
  Bell,
  RefreshCcw,
  Edit3,
  ArrowRightLeft,
  Building2,
  Send
} from 'lucide-react';
import { productsService, ordersService } from '../services/firestore';
import { Product, OrderItem, StockLevel, Order, Warehouse, InventoryTransaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useAuth } from '../context/AuthContext';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSearchParams } from 'react-router-dom';

import { usePOS } from '../context/POSContext';
import { useMainStoreSettings } from '../hooks/useMainStoreSettings';

export default function POS() {
  const { user } = useAuth();
  const { getOpenShift, openShift, closeShift, addInvoice, updateInvoice, deleteInvoice, invoices: contextInvoices, requestBranchTransfer } = usePOS();
  const { settings } = useMainStoreSettings();
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
  const [holdNote, setHoldNote] = useState('');
  const [editingPendingInvoiceId, setEditingPendingInvoiceId] = useState<string | null>(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'cash' | 'visa'>('cash');
  const [lastTransferId, setLastTransferId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  // Cross-branch tab state
  const [productTab, setProductTab] = useState<'branch' | 'crossbranch'>('branch');
  const [branchSearchTerm, setBranchSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [cameraSupported, setCameraSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const [requestModal, setRequestModal] = useState<{
    product: any;
    fromBranch: Warehouse;
    availableQty: number;
  } | null>(null);
  const [requestQty, setRequestQty] = useState(1);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showIncomingRequestsModal, setShowIncomingRequestsModal] = useState(false);
  const isFirstLoad = React.useRef(true);

  // Incoming transfer requests directed to this branch
  const incomingRequests = React.useMemo(() => {
    return transfers.filter(t => 
      t.type === 'TRANSFER' && 
      t.status === 'PENDING' && 
      t.reference === 'BRANCH_REQUEST' && 
      t.fromWarehouseId === selectedBranchId &&
      !transfers.some(fulfilledTx => fulfilledTx.reference === t.id)
    );
  }, [transfers, selectedBranchId]);

  // Outgoing transfer requests created by this branch
  const outgoingRequests = React.useMemo(() => {
    return transfers.filter(t => 
      t.type === 'TRANSFER' && 
      t.reference === 'BRANCH_REQUEST' && 
      t.toWarehouseId === selectedBranchId
    );
  }, [transfers, selectedBranchId]);

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

  useEffect(() => {
    setCameraSupported(!!(navigator.mediaDevices?.getUserMedia));
  }, []);

  // Sync isFirstLoad
  useEffect(() => {
    if (transfers.length > 0) {
      setTimeout(() => { isFirstLoad.current = false; }, 3000);
    }
  }, [transfers]);

  const currentShift = getOpenShift(selectedBranchId);
  const branchWarehouse = warehouses.find(w => w.id === selectedBranchId);

  const initializeZXingScanner = () => {
    if (!videoRef.current) {
      scanTimeoutRef.current = window.setTimeout(initializeZXingScanner, 200);
      return;
    }

    if (!scannerRef.current) {
      scannerRef.current = new BrowserMultiFormatReader();
    }

    scannerRef.current.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
      if (result) {
        const code = result.getText();
        if (code) {
          setSearchTerm(code);
          stopBarcodeCamera();
          handleBarcodeSearch(code);
        }
      } else if (err) {
        const isNotFound = err?.name === 'NotFoundException' || err?.message?.includes('not found');
        if (!isNotFound) {
          console.warn('ZXing scan error', err);
        }
      }
    }).catch(err => {
      console.error('ZXing init error:', err);
      setScanMessage('فشل تشغيل ماسح الكاميرا. الرجاء المحاولة مرة أخرى.');
      setIsScanning(false);
    });
  };

  const startBarcodeCamera = async () => {
    if (!cameraSupported) {
      alert('الكاميرا غير متاحة في هذا المتصفح. يمكنك استخدام قارئ باركود USB أو إدخال الباركود يدوياً.');
      return;
    }

    setIsScanning(true);
    setScanMessage('جاري تشغيل الكاميرا...');
    initializeZXingScanner();
  };

  const stopBarcodeCamera = () => {
    setIsScanning(false);
    setScanMessage('');
    if (scanTimeoutRef.current) {
      window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    if (scannerRef.current) {
      scannerRef.current.reset();
      scannerRef.current = null;
    }
  };

  const handleBarcodeSearch = (barcode: string) => {
    const normalized = barcode.trim();
    if (!normalized) return;

    const exactMatch = availableProducts.find(p => String(p.barcode) === normalized || p.name === normalized);
    if (exactMatch) {
      addToCart(exactMatch);
      setSearchTerm('');
      return;
    }

    setSearchTerm(normalized);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const normalized = searchTerm.trim();
    if (!normalized) return;

    const exactMatch = availableProducts.find(p => String(p.barcode) === normalized || p.name.toLowerCase() === normalized.toLowerCase());
    if (exactMatch) {
      addToCart(exactMatch);
      setSearchTerm('');
    }
  };

  const pendingInvoices = React.useMemo(() => {
    if (!currentShift || !selectedBranchId) return [];
    return contextInvoices.filter(inv =>
      inv.branchId === selectedBranchId &&
      inv.shiftId === currentShift.id &&
      inv.status === 'PENDING'
    );
  }, [contextInvoices, selectedBranchId, currentShift]);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const invId = searchParams.get('invoiceId');
    if (invId && contextInvoices.length > 0) {
      const inv = contextInvoices.find(i => String(i.id) === String(invId));
      if (inv) {
        setSelectedDetail(inv);
        // Clean up URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('invoiceId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, contextInvoices]);

  // Memoized stock levels for the selected branch to optimize performance
  const branchStockMap = React.useMemo(() => {
    if (!selectedBranchId) return {};
    const stockMap: Record<string, number> = {};

    // 1. Calculate incoming transfers
    transfers
      .filter(t => t.type === 'TRANSFER' && t.status === 'COMPLETED' && t.toWarehouseId === selectedBranchId)
      .forEach(t => {
        t.items?.forEach(item => {
          stockMap[item.productId] = (stockMap[item.productId] || 0) + (item.quantity || 0);
        });
      });

    // 2. Subtract outgoing sales (completed invoices only)
    contextInvoices
      .filter(inv => inv.branchId === selectedBranchId && inv.customerId !== 'EXPENSE' && (inv.status === 'COMPLETED' || !inv.status))
      .forEach(inv => {
        inv.items?.forEach(item => {
          stockMap[item.productId] = (stockMap[item.productId] || 0) - (item.quantity || 0);
        });
      });

    // 3. Subtract outgoing transfers (to other branches)
    transfers
      .filter(t => t.type === 'TRANSFER' && t.status === 'COMPLETED' && t.fromWarehouseId === selectedBranchId)
      .forEach(t => {
        t.items?.forEach(item => {
          stockMap[item.productId] = (stockMap[item.productId] || 0) - (item.quantity || 0);
        });
      });

    return stockMap;
  }, [transfers, contextInvoices, selectedBranchId]);

  // Memoized available products list
  const availableProducts = React.useMemo(() => {
    return products.map(p => ({
      ...p,
      branchStock: Math.max(0, branchStockMap[p.id] || 0)
    })).filter(p => p.branchStock > 0);
  }, [products, branchStockMap]);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Extract unique categories from available products
  const categories = React.useMemo(() => {
    const cats = ['All', ...new Set(availableProducts.map(p => p.category).filter(Boolean))];
    return cats;
  }, [availableProducts]);

  const filteredProducts = React.useMemo(() => {
    return availableProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [availableProducts, searchTerm, selectedCategory]);

  // Cross-branch stock: compute products available in OTHER branches
  const crossBranchProducts = React.useMemo(() => {
    if (!settings?.allowCrossbranchRequest) return [];
    const otherBranches = warehouses.filter(w =>
      w.id !== selectedBranchId && (w as any).type !== 'MAIN' && w.id !== '1'
    );
    const results: { product: Product; branch: Warehouse; availableQty: number }[] = [];
    otherBranches.forEach(branch => {
      products.forEach(product => {
        // received to this branch
        const received = transfers
          .filter(t => t.type === 'TRANSFER' && t.status === 'COMPLETED' && t.toWarehouseId === branch.id)
          .reduce((acc, t) => {
            const item = t.items?.find(i => i.productId === product.id);
            return acc + (item?.quantity || 0);
          }, 0);
        // sold from this branch
        const sold = contextInvoices
          .filter(inv => inv.branchId === branch.id && (inv.status === 'COMPLETED' || !inv.status) && inv.customerId !== 'EXPENSE')
          .reduce((acc, inv) => {
            const item = inv.items?.find(i => i.productId === product.id);
            return acc + (item?.quantity || 0);
          }, 0);
        const availableQty = Math.max(0, received - sold);
        if (availableQty > 0) {
          results.push({ product, branch, availableQty });
        }
      });
    });
    return results.filter(r =>
      r.product.name.toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
      (r.product.barcode && String(r.product.barcode).toLowerCase().includes(branchSearchTerm.toLowerCase()))
    );
  }, [settings, warehouses, selectedBranchId, products, transfers, contextInvoices, branchSearchTerm]);

  // Branch Selection at start
  if (!selectedBranchId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-gray-50/50 rounded-[3rem] min-h-[70vh]" dir="rtl">
        <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner">
          <Store className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">نظام البيع (POS)</h2>
        <p className="text-gray-400 font-medium mb-10 italic">يرجى اختيار الفرع للبدء في عمليات البيع</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-4">
          {warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1').map(branch => (
            <button
              key={branch.id}
              onClick={() => setSelectedBranchId(branch.id)}
              className="group p-10 bg-white border-2 border-gray-100 rounded-[2.5rem] hover:border-blue-600 hover:bg-blue-50/50 hover:-translate-y-1 transition-all shadow-sm hover:shadow-xl flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-blue-600 transition-colors shadow-inner">
                <Store className="w-8 h-8" />
              </div>
              <span className="font-black text-lg text-gray-900">{branch.name}</span>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{(branch as any).code || 'BRANCH'}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Shift Check - if no open shift for this branch
  if (!currentShift) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 bg-gray-50/50 rounded-[3rem] min-h-[70vh]" dir="rtl">
        <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner">
          <CreditCard className="w-12 h-12" />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-gray-900 mb-2">بدء وردية جديدة</h2>
          <p className="text-gray-400 font-medium max-w-md mx-auto">للبدء في عمليات البيع لفرع {branchWarehouse?.name}، يجب فتح وردية جديدة أولاً.</p>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-2xl w-full max-w-md space-y-8">
          <div className="space-y-3">
            <label className="text-sm font-black text-gray-400 uppercase tracking-widest block text-center">مبلغ الكاش الافتتاحي (Opening Cash)</label>
            <input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 outline-none focus:ring-4 focus:ring-blue-100 font-black text-3xl text-center transition-all"
              placeholder="0.00"
              autoFocus
            />
          </div>

          <button
            disabled={isOpeningShift}
            onClick={async () => {
              if (!user?.uid) {
                alert('لم يتم تحميل بيانات المستخدم بعد. يرجى تسجيل الدخول أو إعادة تحميل الصفحة.');
                return;
              }

              try {
                setIsOpeningShift(true);
                await openShift(selectedBranchId, user.uid, openingCash, user.name || 'مدير النظام');
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
                فتح الوردية الآن للبدء
              </>
            )}
          </button>

          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setSelectedBranchId('')}
              className="w-full text-gray-400 font-bold py-2 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              العودة لاختيار فرع آخر
            </button>
          )}
        </div>
      </div>
    );
  }

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
  const taxRate = settings?.taxEnabled ? (settings?.taxRate || 0) : 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const handleCheckout = async (method: 'cash' | 'visa') => {
    if (!user?.uid) {
      alert('لم يتم تحميل بيانات المستخدم بعد. يرجى تسجيل الدخول أو إعادة تحميل الصفحة.');
      return;
    }

    try {
      const newInvoice: Order = {
        id: `INV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        items: cart,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentMethod: method,
        cashierId: user.uid,
        shiftId: currentShift.id,
        branchId: selectedBranchId,
        createdAt: new Date().toISOString(),
        customerId: 'WALK-IN',
        status: 'COMPLETED'
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

  const handleHoldInvoice = async () => {
    if (cart.length === 0) return;
    if (!selectedBranchId) {
      alert('يرجى اختيار الفرع أولاً قبل تعليق الفاتورة.');
      return;
    }
    if (!currentShift) {
      alert('يرجى فتح وردية نشطة قبل تعليق الفاتورة.');
      return;
    }
    if (!user?.uid) {
      alert('لم يتم تحميل بيانات المستخدم بعد. يرجى تسجيل الدخول أو إعادة تحميل الصفحة.');
      return;
    }

    try {
      const heldInvoice: Order = {
        id: `INV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        items: cart,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentMethod: 'cash',
        cashierId: user.uid,
        shiftId: currentShift.id,
        branchId: selectedBranchId,
        createdAt: new Date().toISOString(),
        customerId: 'WALK-IN',
        status: 'PENDING',
        ...(holdNote.trim() ? { notes: holdNote.trim() } : {})
      };

      await addInvoice(heldInvoice);
      setIsSuccess(true);
      setCart([]);
      setHoldNote('');
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error('Hold invoice error:', err);
      alert('حدث خطأ أثناء تعليق الفاتورة. يرجى المحاولة مرة أخرى.');
    }
  };

  const loadPendingInvoice = (invoice: Order) => {
    if (cart.length > 0 && !window.confirm('سيتم استبدال محتويات السلة الحالية بالفاتورة المعلقة. هل تود المتابعة؟')) {
      return;
    }

    setCart(invoice.items || []);
    setHoldNote(invoice.notes || '');
    setEditingPendingInvoiceId(invoice.id || null);
    setPendingPaymentMethod(invoice.paymentMethod === 'visa' ? 'visa' : 'cash');
  };

  const clearPendingEdit = () => {
    setEditingPendingInvoiceId(null);
    setCart([]);
    setHoldNote('');
    setPendingPaymentMethod('cash');
  };

  const completePendingInvoice = async () => {
    if (!editingPendingInvoiceId) return;
    if (cart.length === 0) {
      alert('لا يمكن إنهاء فاتورة فارغة. يرجى إضافة منتجات أولاً.');
      return;
    }
    if (!selectedBranchId) {
      alert('يرجى اختيار الفرع أولاً قبل إتمام الفاتورة.');
      return;
    }
    if (!currentShift) {
      alert('يرجى فتح وردية نشطة قبل إتمام الفاتورة.');
      return;
    }

    try {
      await updateInvoice(editingPendingInvoiceId, {
        items: cart,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentMethod: pendingPaymentMethod,
        status: 'COMPLETED',
        customerId: 'WALK-IN',
        notes: holdNote.trim() ? holdNote.trim() : undefined,
      });
      setIsSuccess(true);
      clearPendingEdit();
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error('Complete pending invoice error:', err);
      alert('حدث خطأ أثناء إتمام الفاتورة المعلقة. يرجى المحاولة مرة أخرى.');
    }
  };

  const deletePendingInvoice = async (invoiceId: string) => {
    if (!invoiceId) {
      alert('لم يتم تحديد الفاتورة لحذفها. يرجى المحاولة مرة أخرى.');
      return;
    }

    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة المعلقة؟ لا يمكن التراجع عن هذا الإجراء.')) return;

    try {
      await deleteInvoice(invoiceId);
      if (editingPendingInvoiceId === invoiceId) {
        clearPendingEdit();
      }
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error('Cancel pending invoice error:', err);
      alert('حدث خطأ أثناء حذف الفاتورة المعلقة. يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <div className="h-full space-y-8" dir="rtl">
      {/* 1. Header Area - Matching Branch Management Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-20"></div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-900">{branchWarehouse?.name || 'نقطة البيع'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn("w-2.5 h-2.5 rounded-full", currentShift ? "bg-green-500 animate-pulse" : "bg-gray-300")}></div>
              <p className="text-gray-400 font-medium">
                {currentShift ? `وردية نشطة (${currentShift.id.slice(0, 8)})` : 'لا توجد وردية نشطة'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          {incomingRequests.length > 0 && (
            <button
               onClick={() => setShowIncomingRequestsModal(true)}
               className="relative px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-black hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 border border-indigo-100"
            >
              <Bell className="w-4 h-4 animate-bounce" />
              طلبات واردة
              <span className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-sans">{incomingRequests.length}</span>
            </button>
          )}
          {currentShift && (
            <button
              onClick={() => { setActualCash(0); setIsCloseShiftModalOpen(true); }}
              className="px-6 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-black hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 border border-red-100"
            >
              <ArrowDownCircle className="w-4 h-4" />
              إغلاق الوردية
            </button>
          )}
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setSelectedBranchId('')}
              className="px-6 py-3 bg-blue-50 text-blue-600 rounded-xl text-sm font-black hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 border border-blue-100"
            >
              <RefreshCcw className="w-4 h-4" />
              تغيير الفرع
            </button>
          )}
        </div>
      </div>

      {pendingInvoices.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[2.5rem] p-6 shadow-sm">
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-black text-gray-900">الفواتير المعلقة</h3>
              <p className="text-sm text-gray-500">يمكنك فتح أي فاتورة لمراجعة محتواها، تعديلها، استكمالها أو حذفها.</p>
            </div>
            {editingPendingInvoiceId && (
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-amber-800 border border-amber-200">
                <span>تحرير فاتورة حالية</span>
                <button onClick={clearPendingEdit} className="text-blue-600 hover:underline">إلغاء</button>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {pendingInvoices.map((inv) => (
              <div key={inv.id} className="bg-white rounded-[2rem] border border-amber-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-900">#{inv.id?.toString().split('-')[1] || inv.id}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(inv.createdAt).toLocaleString('ar-EG')}</p>
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-3 py-1 rounded-full">قيد الانتظار</span>
                </div>

                <div className="mt-4 text-sm text-gray-600 space-y-2">
                  <p>عدد الأصناف: <span className="font-black text-gray-900">{inv.items?.length || 0}</span></p>
                  <p>الإجمالي: <span className="font-black text-gray-900">{formatCurrency(inv.total || 0)}</span></p>
                  {inv.notes && <p>ملاحظة: <span className="font-black text-gray-900">{inv.notes}</span></p>}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => loadPendingInvoice(inv)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 transition-all"
                  >
                    فتح للتعديل
                  </button>
                  <button
                    onClick={() => deletePendingInvoice(inv.id || '')}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-2xl text-sm font-black hover:bg-red-100 transition-all border border-red-100"
                  >
                    إلغاء الفاتورة
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Main Content Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* RIGHT SIDE: Product Catalog & Search (xl:col-span-8) */}
        <div className="xl:col-span-8 space-y-6">

          {/* Tab Navigation (only show if cross-branch feature is enabled) */}
          {settings?.allowCrossbranchRequest && (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-2 flex gap-2">
              <button
                onClick={() => setProductTab('branch')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-3 py-4 rounded-[1.5rem] text-sm font-black transition-all",
                  productTab === 'branch'
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                    : "text-gray-400 hover:bg-gray-50"
                )}
              >
                <Package className="w-5 h-5" />
                المتاح في الفرع
              </button>
              <button
                onClick={() => setProductTab('crossbranch')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-3 py-4 rounded-[1.5rem] text-sm font-black transition-all",
                  productTab === 'crossbranch'
                    ? "bg-gradient-to-l from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-100"
                    : "text-gray-400 hover:bg-gray-50"
                )}
              >
                <ArrowRightLeft className="w-5 h-5" />
                طلب من فرع آخر
              </button>
            </div>
          )}

          {/* ── Tab 1: Current Branch Products ── */}
          {productTab === 'branch' && (
            <>
              <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                <div className="relative group">
                  <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    placeholder="بحث عن منتج بالاسم أو الباركود..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full bg-gray-50 border-none rounded-2xl py-5 pr-14 pl-6 outline-none focus:ring-4 focus:ring-blue-100 text-sm font-bold transition-all"
                  />
                  <button
                    type="button"
                    onClick={startBarcodeCamera}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors"
                    title="مسح باركود بالكاميرا"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                      <path d="M21 7V5a2 2 0 0 0-2-2h-2" />
                      <path d="M3 17v2a2 2 0 0 0 2 2h2" />
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                      <path d="M7 8h.01" />
                      <path d="M7 12h.01" />
                      <path d="M7 16h.01" />
                      <path d="M10 8h4" />
                      <path d="M10 12h4" />
                      <path d="M10 16h4" />
                      <path d="M17 8h.01" />
                      <path d="M17 16h.01" />
                    </svg>
                  </button>
                </div>

                {isScanning && (
                  <div className="bg-slate-900/90 fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-[2rem] w-full max-w-3xl overflow-hidden shadow-2xl">
                      <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <div className="space-y-1">
                          <h3 className="text-lg font-black text-gray-900">مسح الباركود بالكاميرا</h3>
                          <p className="text-sm text-gray-500">{scanMessage}</p>
                        </div>
                        <button
                          type="button"
                          onClick={stopBarcodeCamera}
                          className="text-gray-500 hover:text-gray-900 font-black"
                        >
                          إغلاق
                        </button>
                      </div>
                      <div className="relative bg-black">
                        <video
                          ref={videoRef}
                          className="w-full aspect-video object-cover"
                          playsInline
                          muted
                        />
                        <div className="pointer-events-none absolute inset-0 border-2 border-blue-400/60 rounded-[1.5rem]" />
                      </div>
                      <div className="p-4 text-right">
                        <p className="text-xs text-gray-500">إذا لم يعمل المسح، تأكد من منح المتصفح إذن الوصول للكاميرا أو استخدم إدخال الباركود اليدوي.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "px-8 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap",
                        selectedCategory === cat
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                          : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                      )}
                    >
                      {cat === 'All' ? 'الكل' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-6">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full bg-white rounded-[2.5rem] border border-gray-100 p-20 flex flex-col items-center justify-center text-gray-300 gap-4">
                    <Package className="w-16 h-16 opacity-20" />
                    <p className="font-bold text-gray-400">لا توجد منتجات مطابقة للبحث</p>
                  </div>
                ) : filteredProducts.map((product) => (
                  <motion.button
                    layout
                    whileHover={{ y: -8 }}
                    whileTap={{ scale: 0.98 }}
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white rounded-[2rem] p-4 border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative flex flex-col text-right"
                  >
                    {product.images?.[0] ? (
                      <div className="relative aspect-square rounded-2xl bg-gray-50 mb-4 overflow-hidden flex items-center justify-center">
                        <img src={product.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={product.name} />

                        <div className={cn(
                          "absolute top-3 right-3 px-3 py-1.5 rounded-xl text-xs font-black border backdrop-blur-md",
                          product.branchStock < 5 ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-600 border-green-100"
                        )}>
                          {product.branchStock} قطعة
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 text-right">
                        <div className={cn(
                          "inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-gray-50 text-gray-500 text-xs font-black uppercase tracking-widest",
                          product.branchStock < 5 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                        )}>
                          <Package className="w-4 h-4" />
                          {product.branchStock} قطعة
                        </div>
                      </div>
                    )}

                    <div className="flex-1 space-y-3">
                      <p className="text-xs font-black text-blue-600 uppercase tracking-widest">{product.brand || 'عام'}</p>
                      <h4 className="text-base md:text-lg font-black text-gray-900 line-clamp-2 min-h-[3rem] leading-relaxed">{product.name}</h4>

                      <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                        <span className="text-lg font-black text-blue-600 font-sans tracking-tight">{formatCurrency(product.sellingPrice)}</span>
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                          <Plus className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </>
          )}

          {/* ── Tab 2: Cross-Branch Products ── */}
          {productTab === 'crossbranch' && (
            <>
              <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-sm">البحث في الفروع الأخرى</h3>
                    <p className="text-xs text-gray-400 font-medium">ابحث عن المنتجات المتوفرة في الفروع الأخرى واطلب تحويلها لفرعك</p>
                  </div>
                </div>
                <div className="relative group">
                  <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="text"
                    placeholder="بحث عن منتج في الفروع الأخرى..."
                    value={branchSearchTerm}
                    onChange={(e) => setBranchSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl py-5 pr-14 pl-6 outline-none focus:ring-4 focus:ring-indigo-100 text-sm font-bold transition-all"
                  />
                </div>
              </div>

              {/* Cross-Branch Product Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-6">
                {crossBranchProducts.length === 0 ? (
                  <div className="col-span-full bg-white rounded-[2.5rem] border border-gray-100 p-20 flex flex-col items-center justify-center text-gray-300 gap-4">
                    <Building2 className="w-16 h-16 opacity-20" />
                    <p className="font-bold text-gray-400">لا توجد منتجات متوفرة في الفروع الأخرى</p>
                    <p className="text-xs text-gray-300 font-medium">جرّب البحث باسم مختلف أو تحقق من توفر المنتجات</p>
                  </div>
                ) : crossBranchProducts.map((item, idx) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={`${item.product.id}-${item.branch.id}`}
                    className="bg-white rounded-[2rem] p-4 border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group relative flex flex-col text-right"
                  >
                    <div className="relative aspect-square rounded-2xl bg-gray-50 mb-4 overflow-hidden flex items-center justify-center">
                      {item.product.images?.[0] ? (
                        <img src={item.product.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.product.name} />
                      ) : (
                        <Package className="w-12 h-12 text-gray-200" />
                      )}

                      {/* Branch Badge */}
                      <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-500/90 text-white border border-indigo-400/30 backdrop-blur-md flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" />
                        {item.branch.name}
                      </div>

                      {/* Stock Badge */}
                      <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl text-xs font-black bg-white/90 text-green-600 border border-green-100 backdrop-blur-md">
                        {item.availableQty} قطعة متوفرة
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{item.product.brand || 'عام'}</p>
                      <h4 className="text-sm font-black text-gray-900 line-clamp-2 min-h-[2.5rem] leading-relaxed">{item.product.name}</h4>

                      <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                        <span className="text-lg font-black text-indigo-600 font-sans tracking-tight">{formatCurrency(item.product.sellingPrice)}</span>
                        <button
                          onClick={() => { setRequestModal({ product: item.product, fromBranch: item.branch, availableQty: item.availableQty }); setRequestQty(1); }}
                          className="px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 border border-indigo-100"
                        >
                          <Send className="w-3.5 h-3.5" />
                          طلب تحويل
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Outgoing Requests History Table */}
              <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mt-8">
                <div className="p-6 border-b border-gray-50 flex items-center gap-4 bg-gray-50/30">
                   <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                     <HistoryIcon className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="text-lg font-black text-gray-900">سجل طلبات التحويل</h3>
                     <p className="text-xs font-bold text-gray-400">الطلبات التي قمت بإرسالها للفروع الأخرى</p>
                   </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead className="bg-gray-50/50 text-sm font-black text-gray-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">المنتج</th>
                        <th className="px-6 py-4">الفرع المطلوب منه</th>
                        <th className="px-6 py-4">الكمية</th>
                        <th className="px-6 py-4">الوقت</th>
                        <th className="px-6 py-4">الحالة</th>
                        <th className="px-6 py-4">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                      {outgoingRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-bold">لا توجد طلبات سابقة</td>
                        </tr>
                      ) : outgoingRequests.map(req => {
                        const productInfo = req.items?.[0];
                        const fromBranch = warehouses.find(w => w.id === req.fromWarehouseId);
                        
                        // Check fulfillment
                        const fulfillment = transfers.find(t => t.reference === req.id);
                        let displayStatus = req.status; // typically PENDING, or CANCELLED if user cancelled it
                        if (fulfillment) {
                          displayStatus = fulfillment.status; // COMPLETED or CANCELLED from the other branch
                        }

                        return (
                          <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 font-black text-gray-900">{productInfo?.productName}</td>
                            <td className="px-6 py-4 font-bold text-indigo-600 flex items-center gap-1.5"><Building2 className="w-4 h-4"/> {fromBranch?.name || req.fromWarehouseId}</td>
                            <td className="px-6 py-4 font-sans font-black text-lg">{productInfo?.quantity}</td>
                            <td className="px-6 py-4 font-mono text-gray-400 text-xs">{new Date(req.createdAt).toLocaleString('ar-EG')}</td>
                            <td className="px-6 py-4">
                               {displayStatus === 'PENDING' && <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-lg font-black text-xs">قيد الانتظار</span>}
                               {displayStatus === 'COMPLETED' && <span className="bg-green-50 text-green-600 px-3 py-1 rounded-lg font-black text-xs">تمت الموافقة</span>}
                               {displayStatus === 'CANCELLED' && <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg font-black text-xs">ملغي / مرفوض</span>}
                            </td>
                            <td className="px-6 py-4">
                               {displayStatus === 'PENDING' && (
                                 <div className="flex items-center gap-2">
                                   <button 
                                      onClick={async () => {
                                        const newQty = prompt('أدخل الكمية الجديدة:', productInfo?.quantity);
                                        if(newQty && !isNaN(Number(newQty)) && Number(newQty) > 0) {
                                          try {
                                            const cancelTx = {
                                              id: `BR-CANCEL-${Date.now().toString(36).toUpperCase()}`,
                                              type: 'TRANSFER',
                                              status: 'CANCELLED',
                                              fromWarehouseId: req.fromWarehouseId,
                                              toWarehouseId: req.toWarehouseId,
                                              items: req.items,
                                              reference: req.id,
                                              notes: `تم الإلغاء لتعديل الكمية`,
                                              createdAt: new Date().toISOString(),
                                              createdBy: user?.uid || 'cashier',
                                            };
                                            const newReqTx = {
                                              id: `BR-${Date.now().toString(36).toUpperCase()}`,
                                              type: 'TRANSFER',
                                              status: 'PENDING',
                                              fromWarehouseId: req.fromWarehouseId,
                                              toWarehouseId: req.toWarehouseId,
                                              items: [{...productInfo, quantity: Number(newQty)}],
                                              reference: 'BRANCH_REQUEST',
                                              notes: req.notes,
                                              createdAt: new Date().toISOString(),
                                              createdBy: user?.uid || 'cashier',
                                              requestedByBranch: req.toWarehouseId,
                                            };
                                            await setDoc(doc(db, 'inventory_transactions', cancelTx.id), cancelTx);
                                            await setDoc(doc(db, 'inventory_transactions', newReqTx.id), newReqTx);
                                            setIsSuccess(true); setTimeout(() => setIsSuccess(false), 3000);
                                          } catch(err: any) { 
                                            console.error('Error editing request:', err);
                                            alert('فشل في تعديل الطلب: ' + (err.message || '')); 
                                          }
                                        }
                                      }}
                                      className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"
                                      title="تعديل الكمية"
                                   >
                                     <Edit3 className="w-4 h-4" />
                                   </button>
                                   <button 
                                      onClick={async () => {
                                        if(confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) {
                                          try {
                                            const cancelTx = {
                                              id: `BR-CANCEL-${Date.now().toString(36).toUpperCase()}`,
                                              type: 'TRANSFER',
                                              status: 'CANCELLED',
                                              fromWarehouseId: req.fromWarehouseId,
                                              toWarehouseId: req.toWarehouseId,
                                              items: req.items,
                                              reference: req.id,
                                              notes: (req.notes || '') + ' (تم الإلغاء من قبل الطالب)',
                                              createdAt: new Date().toISOString(),
                                              createdBy: user?.uid || 'cashier',
                                            };
                                            await setDoc(doc(db, 'inventory_transactions', cancelTx.id), cancelTx);
                                          } catch(err: any) { 
                                            console.error('Error cancelling request:', err);
                                            alert('فشل في إلغاء الطلب: ' + (err.message || '')); 
                                          }
                                        }
                                      }}
                                      className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                                      title="إلغاء الطلب"
                                   >
                                     <X className="w-4 h-4" />
                                   </button>
                                 </div>
                               )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* LEFT SIDE: Cart / Sidebar (xl:col-span-4) */}
        <div className="xl:col-span-4">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col min-h-[600px] overflow-hidden sticky top-8">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-none mb-1">سلة المشتريات</h3>
                  <p className="text-sm font-bold text-gray-400">{cart.length} أصناف مختارة</p>
                </div>
              </div>
              <button
                disabled={cart.length === 0}
                onClick={() => setCart([])}
                className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all disabled:opacity-20"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 opacity-50">
                  <ShoppingCart className="w-16 h-16" />
                  <p className="text-sm font-black uppercase tracking-widest">السلة فارغة حالياً</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      key={item.productId}
                      className="group bg-white p-5 rounded-3xl border border-gray-100 hover:border-blue-200 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h5 className="text-sm font-black text-gray-900 mb-1">{item.name}</h5>
                          <span className="text-xs font-bold text-gray-400">سعر الوحدة: {formatCurrency(item.originalPrice)}</span>
                        </div>
                        <span className="text-lg font-black text-blue-600 font-sans tracking-tight">{formatCurrency(item.total)}</span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center bg-gray-50 rounded-2xl p-1 shadow-inner">
                          <button onClick={() => updateQuantity(item.productId, -1)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-white hover:text-red-500 rounded-xl transition-all shadow-sm"><Minus className="w-4 h-4" /></button>
                          <span className="w-12 text-center text-sm font-black text-gray-900 font-sans">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.productId, 1)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-white hover:text-blue-600 rounded-xl transition-all shadow-sm"><Plus className="w-4 h-4" /></button>
                        </div>

                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mr-2 text-right">خصم</label>
                          <input
                            type="number"
                            value={item.discount || ''}
                            onChange={(e) => updateDiscount(item.productId, Number(e.target.value))}
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm font-black text-blue-600 text-center focus:ring-2 focus:ring-blue-100 outline-none"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <div className="p-8 bg-gray-50 border-t border-gray-100 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-black text-gray-400 uppercase tracking-widest px-1">
                  <span>المجموع الفرعي</span>
                  <span className="font-sans">{formatCurrency(subtotal)}</span>
                </div>
                {settings?.taxEnabled && (
                  <div className="flex justify-between text-sm font-black text-gray-400 uppercase tracking-widest px-1">
                    <span>الضريبة ({settings?.taxRate || 0}%)</span>
                    <span className="font-sans">{formatCurrency(tax)}</span>
                  </div>
                )}
                <div className="h-px bg-gray-200 mx-[-2rem]"></div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm font-black text-gray-900 uppercase tracking-widest">المجموع النهائي</span>
                  <span className="text-3xl font-black text-blue-600 font-sans tracking-tighter">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <textarea
                  value={holdNote}
                  onChange={(e) => setHoldNote(e.target.value)}
                  placeholder="ملاحظة تعليق الفاتورة (اختياري)"
                  className="w-full min-h-[100px] resize-none bg-white border border-gray-100 rounded-3xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                />

                {editingPendingInvoiceId && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPendingPaymentMethod('cash')}
                      className={cn(
                        "w-full py-4 rounded-[2rem] font-black text-sm transition-all border",
                        pendingPaymentMethod === 'cash'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      نقداً
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingPaymentMethod('visa')}
                      className={cn(
                        "w-full py-4 rounded-[2rem] font-black text-sm transition-all border",
                        pendingPaymentMethod === 'visa'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      فيزا
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={handleHoldInvoice}
                  className="w-full bg-amber-500 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-amber-100 hover:bg-amber-600 transition-all disabled:opacity-30 disabled:shadow-none"
                >
                  {editingPendingInvoiceId ? 'حفظ التعديلات على الفاتورة المعلقة' : 'تعليق الفاتورة'}
                </button>

                {editingPendingInvoiceId && (
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={completePendingInvoice}
                    className="w-full bg-green-600 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-30 disabled:shadow-none"
                  >
                    إنهاء الفاتورة المعلقة
                  </button>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={cart.length === 0}
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full bg-blue-600 text-white font-black py-6 rounded-[2rem] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-4 text-xl disabled:opacity-30 disabled:shadow-none group"
              >
                <CreditCard className="w-6 h-6 group-hover:scale-110 transition-transform" />
                تأكيد الدفع والطباعة
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Global Success Notification */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-10 left-10 z-[100] bg-slate-900 border border-slate-800 text-white px-8 py-5 rounded-3xl shadow-2xl flex items-center gap-4"
          >
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-black leading-none mb-1">تمت العملية بنجاح!</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">تم ترحيل البيانات وتحديث المخزون</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Modals (Checkout & Shift Close) */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsCheckoutOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <CreditCard className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">إتمام البيع</h3>
                  <p className="text-gray-400 text-sm font-medium">اختر وسيلة الدفع المناسبة للعميل</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-8">
                <button onClick={() => handleCheckout('cash')} className="flex items-center justify-between p-6 rounded-[2rem] border-2 border-gray-50 hover:border-blue-600 hover:bg-blue-50 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><Banknote className="w-6 h-6" /></div>
                    <span className="font-black text-gray-700 text-lg">دفع نقدي (كاش)</span>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-gray-200 group-hover:border-blue-600 group-hover:bg-blue-600 transition-all"></div>
                </button>
                <button onClick={() => handleCheckout('visa')} className="flex items-center justify-between p-6 rounded-[2rem] border-2 border-gray-50 hover:border-blue-600 hover:bg-blue-50 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><CreditCard className="w-6 h-6" /></div>
                    <span className="font-black text-gray-700 text-lg">دفع بالبطاقة (فيزا)</span>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-gray-200 group-hover:border-blue-600 group-hover:bg-blue-600 transition-all"></div>
                </button>
              </div>

              <div className="pt-8 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-black text-gray-400 uppercase tracking-widest">إجمالي المبلغ المطلوب</span>
                <span className="text-3xl font-black text-blue-600 font-sans tracking-tighter">{formatCurrency(total)}</span>
              </div>
            </motion.div>
          </div>
        )}

        {isCloseShiftModalOpen && currentShift && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsCloseShiftModalOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[3rem] p-12 shadow-2xl"
            >
              <div className="text-center mb-10">
                <h3 className="text-3xl font-black text-gray-900 mb-2">إغلاق الوردية</h3>
                <p className="text-gray-400 font-medium">مراجعة رصيد الدرج وترحيل البيانات للفرع</p>
              </div>

              <div className="space-y-4 mb-10 text-right">
                <label className="text-sm font-black text-gray-400 uppercase tracking-widest mr-2 block text-center">المبلغ الفعلي الموجود في الدرج الآن</label>
                <input
                  type="number"
                  value={actualCash}
                  onChange={(e) => setActualCash(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-100 rounded-3xl px-6 py-6 outline-none focus:ring-4 focus:ring-blue-100 font-black text-4xl text-center text-gray-900 shadow-inner"
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setIsCloseShiftModalOpen(false)} className="flex-1 bg-gray-100 text-gray-400 font-black py-5 rounded-2xl hover:bg-gray-200 transition-all">إلغاء</button>
                <button
                  onClick={async () => {
                    try {
                      setIsClosing(true);
                      await closeShift(currentShift.id, actualCash);
                      setIsCloseShiftModalOpen(false);
                      setCart([]);
                      setIsClosing(false);
                      alert('تم إغلاق الوردية بنجاح');
                    } catch (e) {
                      setIsClosing(false);
                      alert('حدث خطأ أثناء الإغلاق');
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

        {selectedDetail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setSelectedDetail(null)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" dir="rtl"
            >
              <div className="p-10 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Package className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900">تفاصيل العملية</h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{selectedDetail.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDetail(null)} className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 overflow-y-auto">
                <div className="grid grid-cols-2 gap-6 mb-10">
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                    <span className="text-xs font-black text-gray-400 uppercase block mb-2 tracking-widest text-center">حالة العملية</span>
                    <span className="text-lg font-black text-blue-600 block text-center">
                      {selectedDetail.status === 'COMPLETED' ? 'مكتملة'
                        : selectedDetail.status === 'PENDING' ? 'معلقة'
                        : selectedDetail.status === 'RETURNED' ? 'مرتجع'
                        : selectedDetail.status === 'CANCELLED' ? 'ملغاة'
                        : selectedDetail.status || 'غير محددة'}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                    <span className="text-xs font-black text-gray-400 uppercase block mb-2 tracking-widest text-center">توقيت العملية</span>
                    <span className="text-sm font-black text-gray-900 font-sans tracking-tight block text-center">{new Date(selectedDetail.createdAt).toLocaleString('ar-EG')}</span>
                  </div>
                </div>

                <h5 className="font-black text-gray-900 mb-6 flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                  الأصناف والمحتويات
                </h5>
                <div className="space-y-4">
                  {(selectedDetail.items || selectedDetail.products || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:border-blue-100 transition-all">
                      <div className="space-y-1">
                        <p className="font-black text-gray-900">{item.name || item.productName}</p>
                        <p className="text-sm text-gray-400 font-bold">
                          الكمية: <span className="text-gray-900 font-sans">{item.quantity}</span> |
                          السعر: <span className="text-gray-900 font-sans">{formatCurrency(item.price || 0)}</span>
                        </p>
                      </div>
                      <span className="text-xl font-black text-blue-600 font-sans tracking-tighter">{formatCurrency((item.price || 0) * (item.quantity || 0))}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-10 pt-10 border-t border-gray-100 flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-sm font-black text-gray-400 uppercase tracking-widest">إجمالي الفاتورة النهائي</span>
                    <p className="text-4xl font-black text-gray-900 font-sans tracking-tighter">{formatCurrency(selectedDetail.total || 0)}</p>
                  </div>
                  {selectedDetail.notes && (
                    <div className="bg-gray-50 border border-gray-200 rounded-3xl p-5 shadow-inner mb-4">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest">ملاحظة الفاتورة</span>
                      <p className="mt-2 text-sm font-bold text-gray-700">{selectedDetail.notes}</p>
                    </div>
                  )}
                  {selectedDetail.paymentMethod && (
                    <div className="bg-blue-600 text-white px-8 py-4 rounded-3xl shadow-xl shadow-blue-100 flex flex-col items-center">
                      <span className="text-xs font-black text-blue-100 uppercase mb-1 tracking-widest">وسيلة الدفع</span>
                      <span className="font-black text-lg">{selectedDetail.paymentMethod === 'cash' ? 'نقداً (كاش)' : 'بطاقة (فيزا)'}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Transfer Request Modal */}
        {requestModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setRequestModal(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden" dir="rtl"
            >
              {/* Decorative Background */}
              <div className="absolute top-0 left-0 w-48 h-48 bg-indigo-50 rounded-full -ml-24 -mt-24 opacity-30"></div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                    <ArrowRightLeft className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900">طلب تحويل مخزون</h3>
                    <p className="text-gray-400 text-sm font-medium">سيتم إرسال الطلب للموافقة من المدير</p>
                  </div>
                </div>

                {/* Product Info */}
                <div className="bg-gray-50 rounded-[2rem] p-6 mb-6 border border-gray-100 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-gray-100 shadow-inner overflow-hidden flex-shrink-0">
                      {requestModal.product.images?.[0] ? (
                        <img src={requestModal.product.images[0]} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-gray-900 text-sm truncate">{requestModal.product.name}</h4>
                      <p className="text-xs font-bold text-gray-400 mt-1">{requestModal.product.brand || 'عام'}</p>
                    </div>
                  </div>

                  <div className="h-px bg-gray-200"></div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">من فرع</span>
                      <span className="text-sm font-black text-indigo-600 flex items-center justify-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {requestModal.fromBranch.name}
                      </span>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">إلى فرعك</span>
                      <span className="text-sm font-black text-blue-600 flex items-center justify-center gap-1.5">
                        <Store className="w-3.5 h-3.5" />
                        {branchWarehouse?.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quantity Selector */}
                <div className="mb-8">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block text-center mb-4">اختر الكمية المطلوبة</label>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={() => setRequestQty(Math.max(1, requestQty - 1))}
                      className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all shadow-inner border border-gray-100"
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                    <div className="text-center">
                      <input
                        type="number"
                        min={1}
                        max={requestModal.availableQty}
                        value={requestQty}
                        onChange={(e) => setRequestQty(Math.min(requestModal.availableQty, Math.max(1, Number(e.target.value))))}
                        className="w-24 text-center bg-gray-50 border border-gray-100 rounded-2xl py-4 text-3xl font-black text-gray-900 outline-none focus:ring-4 focus:ring-indigo-100 shadow-inner"
                      />
                      <p className="text-xs font-bold text-gray-400 mt-2">من أصل <span className="text-indigo-600 font-black">{requestModal.availableQty}</span> قطعة متوفرة</p>
                    </div>
                    <button
                      onClick={() => setRequestQty(Math.min(requestModal.availableQty, requestQty + 1))}
                      className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-inner border border-gray-100"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setRequestModal(null)}
                    className="flex-1 bg-gray-100 text-gray-400 font-black py-5 rounded-2xl hover:bg-gray-200 transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    disabled={isRequesting || requestQty < 1 || requestQty > requestModal.availableQty}
                    onClick={async () => {
                      console.log('🔔 Transfer button clicked!', { requestQty, fromBranch: requestModal.fromBranch.id, product: requestModal.product.id });
                      setIsRequesting(true);
                      const success = await requestBranchTransfer({
                        fromBranchId: requestModal.fromBranch.id,
                        fromBranchName: requestModal.fromBranch.name,
                        toBranchId: selectedBranchId,
                        toBranchName: branchWarehouse?.name || '',
                        productId: requestModal.product.id,
                        productName: requestModal.product.name,
                        quantity: requestQty,
                      });
                      setIsRequesting(false);
                      if (success) {
                        setRequestModal(null);
                        setIsSuccess(true);
                        setTimeout(() => setIsSuccess(false), 3000);
                      } else {
                        alert('فشل في إرسال طلب التحويل. تحقق من الاتصال.');
                      }
                    }}
                    className="flex-[2] bg-gradient-to-l from-indigo-600 to-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-100 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:shadow-none disabled:translate-y-0"
                  >
                    {isRequesting ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        إرسال طلب التحويل
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Incoming Requests Modal */}
        {showIncomingRequestsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setShowIncomingRequestsModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" dir="rtl"
            >
               {/* Modal Header */}
               <div className="flex items-center justify-between mb-8 shrink-0">
                 <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                     <Bell className="w-7 h-7 animate-bounce" />
                   </div>
                   <div>
                     <h3 className="text-2xl font-black text-gray-900">طلبات واردة من الفروع</h3>
                     <p className="text-gray-400 text-sm font-medium">مراجعة طلبات التحويل والموافقة عليها</p>
                   </div>
                 </div>
                 <button onClick={() => setShowIncomingRequestsModal(false)} className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">
                   <X className="w-6 h-6" />
                 </button>
               </div>

               {/* Requests List */}
               <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                 {incomingRequests.length === 0 ? (
                   <div className="text-center py-10 text-gray-400">
                     <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                     <p className="font-bold">لا توجد طلبات واردة حالياً</p>
                   </div>
                 ) : incomingRequests.map(req => {
                   const reqBranch = warehouses.find(w => w.id === req.toWarehouseId);
                   const productInfo = req.items?.[0];
                   return (
                     <div key={req.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                       <div>
                         <p className="text-sm font-black text-indigo-600 mb-1 flex items-center gap-2">
                           <Building2 className="w-4 h-4" />
                           مطلوب لفرع: {reqBranch?.name || req.toWarehouseId}
                         </p>
                         <p className="font-bold text-gray-900 text-lg">{productInfo?.productName}</p>
                         <p className="text-sm text-gray-500 font-bold mt-1">الكمية المطلوبة: <span className="text-indigo-600 font-black">{productInfo?.quantity}</span></p>
                         <p className="text-xs text-gray-400 mt-2 font-mono">{new Date(req.createdAt).toLocaleString('ar-EG')}</p>
                       </div>
                       <div className="flex items-center gap-3 w-full md:w-auto">
                         <button
                           onClick={async () => {
                             try {
                               const newTx = {
                                 id: `BR-FULFILL-${Date.now().toString(36).toUpperCase()}`,
                                 type: 'TRANSFER',
                                 status: 'COMPLETED',
                                 fromWarehouseId: req.fromWarehouseId,
                                 toWarehouseId: req.toWarehouseId,
                                 items: req.items,
                                 reference: req.id,
                                 notes: `تمت الموافقة على الطلب ${req.id}`,
                                 createdAt: new Date().toISOString(),
                                 createdBy: user?.uid || 'cashier',
                               };
                               await setDoc(doc(db, 'inventory_transactions', newTx.id), newTx);
                               setIsSuccess(true);
                               setTimeout(() => setIsSuccess(false), 3000);
                             } catch(err: any) {
                               console.error('Error approving request:', err);
                               alert('فشل في الموافقة على الطلب: ' + (err.message || ''));
                             }
                           }}
                           className="flex-1 md:flex-none px-6 py-3 bg-green-500 text-white rounded-xl font-black text-sm hover:bg-green-600 transition-all shadow-lg shadow-green-200"
                         >
                           موافقة وإرسال
                         </button>
                         <button
                           onClick={async () => {
                             if(confirm('هل أنت متأكد من رفض هذا الطلب؟')) {
                               try {
                                 const newTx = {
                                   id: `BR-REJECT-${Date.now().toString(36).toUpperCase()}`,
                                   type: 'TRANSFER',
                                   status: 'CANCELLED',
                                   fromWarehouseId: req.fromWarehouseId,
                                   toWarehouseId: req.toWarehouseId,
                                   items: req.items,
                                   reference: req.id,
                                   notes: `تم رفض الطلب ${req.id}`,
                                   createdAt: new Date().toISOString(),
                                   createdBy: user?.uid || 'cashier',
                                 };
                                 await setDoc(doc(db, 'inventory_transactions', newTx.id), newTx);
                               } catch(err: any) {
                                 console.error('Error rejecting request:', err);
                                 alert('فشل في رفض الطلب: ' + (err.message || ''));
                               }
                             }
                           }}
                           className="flex-1 md:flex-none px-6 py-3 bg-red-50 text-red-500 rounded-xl font-black text-sm hover:bg-red-500 hover:text-white transition-all"
                         >
                           رفض
                         </button>
                       </div>
                     </div>
                   );
                 })}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}




