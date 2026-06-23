/**
 * AdminPOS – نقطة البيع للمدير
 * A streamlined POS that mirrors core functionality of POS.tsx
 * but is accessible to ADMINs without requiring an open shift.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, Banknote,
  X, CheckCircle2, Package, Store, RefreshCcw, Loader2, Building2,
  BarChart3, ArrowLeft, Printer, User, Smartphone, QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, orderBy, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, OrderItem, Warehouse, Order, Customer, PrintTemplate } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { printReceiptHelper } from '../lib/receiptPrinter';
import { useAuth } from '../context/AuthContext';
import { usePOS } from '../context/POSContext';
import { useDesktop } from '../context/DesktopIntegrationContext';
import { useMainStoreSettings } from '../hooks/useMainStoreSettings';
import { useNavigate } from 'react-router-dom';

export default function AdminPOS() {
  const { user } = useAuth();
  const { addInvoice, invoices } = usePOS();
  const { isOnline, isSyncing, isElectron } = useDesktop();
  const { settings } = useMainStoreSettings();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [variantSelectorProduct, setVariantSelectorProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [printTemplates, setPrintTemplates] = useState<PrintTemplate[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Customer Selector State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [quickCustomerAddress, setQuickCustomerAddress] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside for customer dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Customers
  useEffect(() => {
    const qC = query(collection(db, 'customers'));
    const unsubC = onSnapshot(qC, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });
    return () => unsubC();
  }, []);

  // Sync default customer
  useEffect(() => {
    if (customers.length > 0 && selectedBranchId) {
      const defaultCustomerId = localStorage.getItem(`default_pos_customer_id_${selectedBranchId}`);
      if (defaultCustomerId) {
        const found = customers.find(c => c.id === defaultCustomerId && (c.branchId || 'ADMIN') === selectedBranchId);
        if (found) {
          setSelectedCustomer(found);
          setCustomerSearchTerm(`${found.name} (${found.phone})`);
          return;
        }
      }
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
    }
  }, [customers, selectedBranchId]);

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

  // Fetch Print Templates
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'print_templates'), (snapshot) => {
      setPrintTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrintTemplate)));
    });
    return () => unsub();
  }, []);

  // Fetch completed transfers to calculate branch stock
  useEffect(() => {
    const qT = query(collection(db, 'inventory_transactions'), orderBy('createdAt', 'desc'));
    const unsubT = onSnapshot(qT, (snapshot) => {
      setTransfers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });
    return () => unsubT();
  }, []);

  const branchWarehouses = useMemo(
    () => warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1'),
    [warehouses]
  );

  const selectedBranch = warehouses.find(w => w.id === selectedBranchId);

  // Memoized stock levels for the selected branch to optimize performance
  const branchStockMap = useMemo(() => {
    if (!selectedBranchId) return {};
    const stockMap: Record<string, number> = {};

    // 1. Calculate incoming transfers & receipts
    transfers
      .filter(t => (t.type === 'TRANSFER' || t.type === 'RECEIPT') && t.status === 'COMPLETED' && t.toWarehouseId === selectedBranchId)
      .forEach(t => {
        t.items?.forEach(item => {
          const key = item.sku || item.productId;
          stockMap[key] = (stockMap[key] || 0) + (item.quantity || 0);
          if (item.sku && item.productId) {
            stockMap[item.productId] = (stockMap[item.productId] || 0) + (item.quantity || 0);
          }
        });
      });

    // 2. Subtract outgoing sales (completed and partially returned invoices)
    invoices
      .filter(inv => inv && inv.customerId !== 'EXPENSE' && (inv.status === 'COMPLETED' || inv.status === 'PARTIALLY_RETURNED' || !inv.status))
      .forEach(inv => {
        inv.items?.forEach(item => {
          const itemBranchId = item.branchId || item.warehouseId || inv.branchId;
          if (itemBranchId !== selectedBranchId) return;

          const qty = (item.quantity || 0) - (item.returnedQuantity || 0);
          const itemSku = item.variant?.sku || item.sku;
          const key = itemSku || item.productId;
          stockMap[key] = (stockMap[key] || 0) - qty;
          if (itemSku && item.productId) {
            stockMap[item.productId] = (stockMap[item.productId] || 0) - qty;
          }
        });
      });

    // 3. Subtract outgoing transfers (to other branches)
    transfers
      .filter(t => t.type === 'TRANSFER' && (t.status === 'COMPLETED' || t.status === 'SHIPPED') && t.fromWarehouseId === selectedBranchId)
      .forEach(t => {
        t.items?.forEach(item => {
          const key = item.sku || item.productId;
          stockMap[key] = (stockMap[key] || 0) - (item.quantity || 0);
          if (item.sku && item.productId) {
            stockMap[item.productId] = (stockMap[item.productId] || 0) - (item.quantity || 0);
          }
        });
      });

    return stockMap;
  }, [transfers, invoices, selectedBranchId]);

  const isMainBranch = selectedBranch?.type === 'MAIN' || selectedBranch?.id === '1' || selectedBranchId === 'ADMIN';

  // Helper to get variant stock for a specific branch
  const getVariantBranchStock = (product: Product, variant: any) => {
    const sku = variant.sku || `${product.sku || 'PROD'}-${variant.size}-${variant.color}`;
    const calculatedStock = branchStockMap[sku] || 0;
    
    // If we are in the main branch, we add the variant's initial quantity as the base
    if (isMainBranch) {
      const initialQty = Number(variant.quantity) || 0;
      return Math.max(0, initialQty + calculatedStock);
    }
    
    return Math.max(0, calculatedStock);
  };

  // Helper to get overall product stock for a specific branch
  const getProductBranchStock = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      // Sum of all its variants' branch stocks
      return product.variants.reduce((sum, v) => sum + getVariantBranchStock(product, v), 0);
    }
    
    const calculatedStock = branchStockMap[product.id] || 0;
    if (isMainBranch) {
      const initialQty = Number(product.quantity || (product as any).initialQuantity || 0);
      return Math.max(0, initialQty + calculatedStock);
    }
    return Math.max(0, calculatedStock);
  };

  const availableProducts = useMemo(() => {
    return products.map(p => ({
      ...p,
      branchStock: getProductBranchStock(p)
    })).filter(p => {
      if ((p as any).isDraft) return false;
      if (selectedBranchId === 'ADMIN') return true;
      if (p.warehouseId === selectedBranchId) return true;

      // Check if product was received or transferred to this branch
      const hasIncoming = transfers.some(t => 
        (t.type === 'TRANSFER' || t.type === 'RECEIPT') && 
        t.status === 'COMPLETED' && 
        t.toWarehouseId === selectedBranchId &&
        t.items?.some(item => {
          const itemSku = item.sku || item.productId;
          if (item.productId === p.id) return true;
          if (p.variants) {
            return p.variants.some(v => v.sku === itemSku || `${p.sku || 'PROD'}-${v.size}-${v.color}` === itemSku);
          }
          return false;
        })
      );
      return hasIncoming;
    });
  }, [products, branchStockMap, selectedBranchId, selectedBranch, transfers]);

  const categories = useMemo(() => {
    const cats = new Set(availableProducts.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [availableProducts]);

  const filteredProducts = useMemo(() =>
    availableProducts.filter(p => {
      const matchesVariant = p.variants?.some(v => 
        (v.sku && v.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.barcode && String(v.barcode).toLowerCase().includes(searchTerm.toLowerCase()))
      );
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(searchTerm.toLowerCase())) ||
        matchesVariant;
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    }),
    [availableProducts, searchTerm, selectedCategory]
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const normalized = searchTerm.trim();
    if (!normalized) return;

    let matchedProduct: Product | undefined = undefined;
    let matchedVariant: any = undefined;

    for (const p of availableProducts) {
      if (String(p.barcode) === normalized || p.name.toLowerCase() === normalized.toLowerCase()) {
        matchedProduct = p;
        break;
      }
      if (p.variants) {
        const foundV = p.variants.find(v => String(v.barcode) === normalized || String(v.sku).toLowerCase() === normalized.toLowerCase());
        if (foundV) {
          matchedProduct = p;
          matchedVariant = foundV;
          break;
        }
      }
    }

    if (matchedProduct) {
      addToCart(matchedProduct, matchedVariant);
      setSearchTerm('');
    }
  };

  const addToCart = (product: Product, selectedVariant?: any) => {
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      setVariantSelectorProduct(product);
      return;
    }

    const sku = selectedVariant
      ? (selectedVariant.sku || `${product.sku || 'PROD'}-${selectedVariant.size}-${selectedVariant.color}`)
      : product.id;

    // Use getVariantBranchStock for variant or productBranchStock
    const availableStock = selectedVariant
      ? getVariantBranchStock(product, selectedVariant)
      : getProductBranchStock(product);

    const existing = cart.find(item => {
      if (selectedVariant) {
        return item.productId === product.id &&
               item.variant?.size === selectedVariant.size &&
               item.variant?.color === selectedVariant.color;
      }
      return item.productId === product.id && !item.variant;
    });

    const currentQty = existing?.quantity ?? 0;
    if (product.trackInventory !== false && settings?.allowNegativeInventory !== true && currentQty + 1 > availableStock) {
      alert('الكمية المتاحة لا تكفي');
      return;
    }

    const displayName = selectedVariant
      ? `${product.name} (${selectedVariant.size ? `مقاس: ${selectedVariant.size}` : ''}${selectedVariant.size && selectedVariant.color ? ' / ' : ''}${selectedVariant.color ? `لون: ${selectedVariant.color}` : ''})`
      : product.name;

    if (existing) {
      setCart(prev => prev.map(item => {
        const matches = selectedVariant
          ? (item.productId === product.id && item.variant?.size === selectedVariant.size && item.variant?.color === selectedVariant.color)
          : (item.productId === product.id && !item.variant);

        return matches
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item;
      }));
    } else {
      setCart(prev => [...prev, {
        productId: product.id,
        name: displayName,
        sku: sku,
        quantity: 1,
        price: selectedVariant ? (selectedVariant.price || product.sellingPrice) : product.sellingPrice,
        originalPrice: selectedVariant ? (selectedVariant.price || product.sellingPrice) : product.sellingPrice,
        discount: 0,
        total: selectedVariant ? (selectedVariant.price || product.sellingPrice) : product.sellingPrice,
        variant: selectedVariant ? {
          size: selectedVariant.size,
          color: selectedVariant.color,
          sku: sku
        } : undefined
      }]);
    }

    setVariantSelectorProduct(null);
  };

  const updateQty = (itemSkuOrId: string, delta: number) => {
    const item = cart.find(i => (i.sku || i.productId) === itemSkuOrId);
    if (!item) return;

    const product = availableProducts.find(p => p.id === item.productId);
    if (!product) return;

    const availableStock = item.variant
      ? getVariantBranchStock(product, item.variant as any)
      : getProductBranchStock(product);

    setCart(prev => prev.map(i => {
      const currentKey = i.sku || i.productId;
      if (currentKey !== itemSkuOrId) return i;
      const newQty = Math.max(1, i.quantity + delta);
      if (product.trackInventory !== false && settings?.allowNegativeInventory !== true && newQty > availableStock) {
        alert('الكمية المتاحة لا تكفي');
        return i;
      }
      return { ...i, quantity: newQty, total: newQty * i.price };
    }));
  };

  const removeItem = (itemSkuOrId: string) => setCart(prev => prev.filter(i => (i.sku || i.productId) !== itemSkuOrId));

  const subtotal = cart.reduce((a, i) => a + i.total, 0);
  const taxRate = settings?.taxEnabled ? (settings?.taxRate ?? 0) : 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const printReceipt = (invoice: any) => {
    const customer = customers.find(c => c.id === invoice.customerId);
    const cashierName = user?.name || 'مدير معتمد';
    const electronAPI = (window as any).electronAPI;

    printReceiptHelper({
      invoice,
      templates: printTemplates,
      settings,
      branchName: selectedBranch?.name || 'البيع المباشر',
      customer,
      cashierName,
      isElectron,
      electronAPI
    });
  };

  const handleCheckout = async (method: 'cash' | 'visa' | 'debt' | 'vodafone' | 'instapay') => {
    if (isSaving) return;
    if (!user?.uid) { alert('يرجى تسجيل الدخول أولاً'); return; }
    if (cart.length === 0) return;

    if (method === 'debt') {
      if (!selectedCustomer || selectedCustomer.id === 'WALK-IN') {
        alert('يجب اختيار عميل مسجل لإجراء عملية البيع الآجل.');
        return;
      }
      if (selectedCustomer.creditLimit !== undefined) {
        const currentDebit = selectedCustomer.balanceType === 'debit' ? selectedCustomer.balance : -selectedCustomer.balance;
        const nextDebit = currentDebit + total;
        if (nextDebit > selectedCustomer.creditLimit) {
          alert(`عذراً، العميل تجاوز الحد الائتماني المسموح به (${formatCurrency(selectedCustomer.creditLimit)})`);
          return;
        }
      }
    }

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
        customerId: selectedCustomer ? selectedCustomer.id : 'WALK-IN',
        status: 'COMPLETED',
        notes: noteText.trim() || undefined,
      };
      await addInvoice(order);

      // Security Logs Trigger
      if (settings?.drawerMonitoringEnabled) {
        await addDoc(collection(db, 'security_logs'), {
          userId: user.uid,
          userName: user.name || 'مدير',
          action: 'DRAWER_OPENED',
          details: `فتح درج النقدية لإتمام الفاتورة للمدير رقم #${order.id.slice(-8).toUpperCase()}`,
          timestamp: new Date().toISOString()
        });
      }

      const totalDiscount = cart.reduce((sum, item) => sum + (item.discount * item.quantity), 0);
      if (totalDiscount > 0 && settings?.discountMonitoringEnabled) {
        await addDoc(collection(db, 'security_logs'), {
          userId: user.uid,
          userName: user.name || 'مدير',
          action: 'DISCOUNT_APPLIED',
          details: `تطبيق خصم إجمالي بقيمة ${formatCurrency(totalDiscount)} على الفاتورة للمدير رقم #${order.id.slice(-8).toUpperCase()}`,
          timestamp: new Date().toISOString()
        });
      }

      // Update customer balance and loyalty points if a registered customer is selected
      if (selectedCustomer && selectedCustomer.id !== 'WALK-IN') {
        const pointsToAdd = Math.floor(total / 10) || 0;
        let updateData: any = {
          points: (selectedCustomer.points || 0) + pointsToAdd
        };

        if (method === 'debt') {
          let currentBalance = selectedCustomer.balance || 0;
          let currentType = selectedCustomer.balanceType || 'debit';
          let newBalance = 0;
          let newType: 'credit' | 'debit' = 'debit';

          if (currentType === 'credit') {
            if (currentBalance >= total) {
              newBalance = currentBalance - total;
              newType = 'credit';
            } else {
              newBalance = total - currentBalance;
              newType = 'debit';
            }
          } else {
            // debit
            newBalance = currentBalance + total;
            newType = 'debit';
          }

          updateData.balance = newBalance;
          updateData.balanceType = newType;
        }

        await updateDoc(doc(db, 'customers', selectedCustomer.id), updateData);
      }

      printReceipt(order);

      // Delay for 2 seconds to show "تم التحصيل وجاري الطباعة..."
      await new Promise(resolve => setTimeout(resolve, 2000));

      setIsSuccess(true);
      setCart([]);
      setIsCheckoutOpen(false);
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
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
          {/* Connection & Sync Status Badges */}
          <div className="flex gap-2 ml-2">
            <span className={cn(
              "text-xs font-black px-3.5 py-2 rounded-xl border flex items-center gap-1.5 shadow-sm transition-all",
              isOnline ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100 animate-pulse"
            )}>
              <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500" : "bg-red-500")} />
              {isOnline ? "متصل بالإنترنت" : "دون اتصال (Offline)"}
            </span>
            {isSyncing && (
              <span className="text-xs font-black px-3.5 py-2 rounded-xl border bg-blue-50 text-blue-700 border-blue-100 shadow-sm flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                جاري المزامنة...
              </span>
            )}
          </div>

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
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

        {/* MAIN SIDE: Cart Items Table & Catalog (xl:col-span-8) */}
        <div className="xl:col-span-8 space-y-3">
          
          {/* Search & Filters */}
          <div className="bg-white p-2.5 rounded border border-slate-200 shadow-none space-y-3 select-none">
            <div className="relative group">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input
                type="text"
                placeholder="بحث سريع عن منتج بالاسم أو الباركود..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full bg-slate-50 border border-slate-200 rounded py-1.5 pr-9 pl-4 outline-none text-xs font-bold transition focus:border-blue-500 focus:bg-white text-right"
                autoFocus
              />
            </div>
          </div>

          {/* Cart Items Table */}
          <div className="bg-white rounded border border-slate-200 shadow-none overflow-hidden flex flex-col min-h-[280px]">
            <div className="p-2.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-slate-900">سلة المشتريات ({cart.length} أصناف)</span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer focus:outline-none"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  تفريغ السلة
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto max-h-[300px] scrollbar-thin">
              {cart.length === 0 ? (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-slate-400 gap-2 opacity-60">
                  <ShoppingCart className="w-10 h-10" />
                  <p className="text-xs font-black">السلة فارغة حالياً. استخدم البحث أو اضغط على المنتجات بالأسفل للإضافة.</p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr className="text-slate-500 font-bold">
                      <th className="px-3 py-1.5 text-right">المنتج</th>
                      <th className="px-3 py-1.5 text-center w-24">السعر</th>
                      <th className="px-3 py-1.5 text-center w-32">الكمية</th>
                      <th className="px-3 py-1.5 text-left w-28">الإجمالي</th>
                      <th className="px-3 py-1.5 text-center w-12">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item) => (
                      <tr key={item.sku || item.productId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-1.5">
                          <div className="font-black text-slate-800">{item.name}</div>
                          {item.sku && <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>}
                        </td>
                        <td className="px-3 py-1.5 text-center font-sans font-bold">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="inline-flex items-center border border-slate-200 rounded bg-slate-50 p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQty(item.sku || item.productId, -1)}
                              className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white hover:text-red-600 rounded transition-all focus:outline-none"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-black text-slate-900 font-sans">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(item.sku || item.productId, 1)}
                              className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white hover:text-blue-600 rounded transition-all focus:outline-none"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-left font-sans font-black text-slate-900">
                          {formatCurrency(item.total)}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(item.sku || item.productId)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1 focus:outline-none"
                            title="حذف من السلة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Product Catalog Section */}
          <div className="bg-white rounded border border-slate-200 shadow-none p-3 space-y-2 select-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-black text-slate-800">دليل المنتجات السريع</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin max-w-full">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-2.5 py-0.5 rounded text-[10px] font-bold transition-all whitespace-nowrap border",
                      selectedCategory === cat
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {cat === 'All' ? 'الكل' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredProducts.length === 0 ? (
                <div className="bg-slate-50 rounded border border-slate-100 p-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Package className="w-8 h-8 opacity-40" />
                  <p className="text-xs font-bold">لا توجد منتجات مطابقة للبحث</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-5 gap-2">
                  {filteredProducts.map((product) => {
                    const inCart = cart.find(i => i.productId === product.id);
                    return (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className={cn(
                          "bg-slate-50 hover:bg-slate-100/80 rounded border p-2 transition-all flex flex-col justify-between text-right text-xs group",
                          inCart ? 'border-blue-500 bg-blue-50/20' : 'border-slate-200'
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <p className="text-[9px] font-bold text-blue-600">{product.category}</p>
                            {product.images?.[0] && (
                              <img src={product.images[0]} className="w-5 h-5 object-cover rounded" alt="" />
                            )}
                          </div>
                          <h4 className="font-black text-slate-900 line-clamp-1 leading-snug">{product.name}</h4>
                          
                          {product.trackInventory === false ? (
                            <span className="inline-block mt-1 text-[9px] px-1 bg-green-50 text-green-600 border border-green-100 rounded">متاح</span>
                          ) : (
                            <span className={cn(
                              "inline-block mt-1 text-[9px] px-1 border rounded",
                              (product.branchStock ?? 0) === 0 ? "bg-red-50 text-red-500 border-red-100" :
                              (product.branchStock ?? 0) < 5 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-green-50 text-green-600 border-green-100"
                            )}>
                              {(product.branchStock ?? 0) === 0 ? "نفذ" : `${product.branchStock} ق`}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 pt-1 border-t border-slate-200/50 flex items-center justify-between">
                          <span className="font-sans font-black text-blue-600">{formatCurrency(product.sellingPrice)}</span>
                          <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* LEFT SIDE: Billing, Customer & Checkout (xl:col-span-4) */}
        <div className="xl:col-span-4">
          <div className="bg-white rounded border border-slate-200 p-4 space-y-4 sticky top-4">
            
            {/* Header / Info */}
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                خيارات الفاتورة والعميل
              </h3>
            </div>

            {/* Customer Selector */}
            <div className="space-y-2 relative" ref={customerDropdownRef}>
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">العميل</label>
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(true)}
                  className="text-[10px] font-black text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 cursor-pointer focus:outline-none"
                >
                  + عميل جديد
                </button>
              </div>
              
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو رقم الهاتف..."
                  value={selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.phone})` : customerSearchTerm}
                  onFocus={() => {
                    setShowCustomerDropdown(true);
                    if (selectedCustomer) {
                      setCustomerSearchTerm('');
                      setSelectedCustomer(null);
                    }
                  }}
                  onChange={(e) => {
                    setCustomerSearchTerm(e.target.value);
                    setShowCustomerDropdown(true);
                    setSelectedCustomer(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded pr-9 pl-8 py-1.5 text-xs font-bold outline-none focus:bg-white focus:border-blue-500 transition-all text-right"
                />
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearchTerm('');
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none text-xs"
                  >
                    ✕
                  </button>
                )}

                {/* Customer Dropdown */}
                <AnimatePresence>
                  {showCustomerDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-50 w-full mt-1 bg-white rounded border border-slate-200 shadow-lg max-h-48 overflow-y-auto scrollbar-thin text-right"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearchTerm('');
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-right p-2 hover:bg-slate-50 border-b border-slate-100 transition-colors flex items-center justify-between text-xs font-black text-slate-500"
                      >
                        <span>عميل نقدي (افتراضي)</span>
                        <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-400 font-bold">افتراضي</span>
                      </button>
                      {customers.filter(c =>
                        (c.branchId || 'ADMIN') === selectedBranchId && (
                          c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                          c.phone.includes(customerSearchTerm)
                        )
                      ).length === 0 ? (
                        <div className="p-2.5 text-center text-xs text-gray-400 font-bold">لا يوجد نتائج مطابقة</div>
                      ) : (
                        customers.filter(c =>
                          (c.branchId || 'ADMIN') === selectedBranchId && (
                            c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                            c.phone.includes(customerSearchTerm)
                          )
                        ).map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearchTerm(`${c.name} (${c.phone})`);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-right p-2 hover:bg-blue-50/50 border-b border-slate-100 transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="text-right">
                              <p className="text-xs font-black text-slate-800">{c.name}</p>
                              <p className="text-[9px] text-gray-400 font-bold mt-0.5">{c.phone}</p>
                            </div>
                            <div className="text-left shrink-0">
                              {c.balance > 0 ? (
                                <span className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded font-black border",
                                  c.balanceType === 'credit' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                                )}>
                                  {formatCurrency(c.balance)} {c.balanceType === 'credit' ? 'دائن' : 'مدين'}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-bold">رصيد: 0.00</span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Selected Customer Stats & Action */}
              {selectedCustomer && (
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200/60">
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 font-bold leading-none mb-0.5">الرصيد المالي الحالي</p>
                    <p className={cn(
                      "text-xs font-black",
                      selectedCustomer.balance === 0
                        ? "text-slate-500"
                        : selectedCustomer.balanceType === 'credit'
                        ? "text-emerald-600"
                        : "text-rose-600"
                    )}>
                      {selectedCustomer.balance > 0
                        ? `${formatCurrency(selectedCustomer.balance)} ${selectedCustomer.balanceType === 'credit' ? 'دائن' : 'مدين'}`
                        : '0.00 ج.م'
                      }
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem(`default_pos_customer_id_${selectedBranchId}`, selectedCustomer.id);
                      alert(`تم تعيين العميل "${selectedCustomer.name}" كعميل افتراضي للبيعات بنجاح.`);
                    }}
                    className="px-2 py-1 bg-white text-slate-600 font-black border border-slate-200 rounded hover:bg-slate-50 transition-all text-[9px] cursor-pointer focus:outline-none"
                  >
                    تعيين كافتراضي
                  </button>
                </div>
              )}
            </div>

            {/* Note Area */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ملاحظات الفاتورة</label>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="أضف أي ملاحظات هنا..."
                className="w-full h-12 min-h-[48px] resize-none bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Price Calculations */}
            <div className="border-t border-b border-slate-100 py-3 space-y-1.5">
              <div className="flex justify-between text-xs font-black text-slate-400">
                <span>المجموع الفرعي</span>
                <span className="font-sans">{formatCurrency(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-xs font-black text-slate-400">
                  <span>الضريبة ({taxRate}%)</span>
                  <span className="font-sans">{formatCurrency(tax)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-slate-200">
                <span className="text-xs font-black text-slate-900">المجموع النهائي</span>
                <span className="text-xl font-black text-blue-600 font-sans tracking-tight">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Checkout / Payment Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full bg-blue-600 text-white font-black py-2.5 rounded hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                تأكيد وإتمام البيع
              </button>

              {cart.length > 0 && (
                <div className="border-t border-slate-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => printReceipt({ id: 'DRAFT', items: cart, total, paymentMethod: 'cash' })}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-black transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    طباعة مسودة الفاتورة
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
              onClick={() => !isSaving && setIsCheckoutOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl" dir="rtl"
            >
              {isSaving ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner animate-pulse">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                  <h3 className="text-3xl font-black text-gray-900 mb-2">تم التحصيل</h3>
                  <p className="text-gray-500 font-bold text-lg">جاري الطباعة وتحديث البيانات...</p>
                </div>
              ) : (
                <>
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
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('cash')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-green-50/50 hover:border-green-600 bg-green-50/30 hover:bg-green-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-100 group-hover:scale-110 transition-transform mb-2">
                        <Banknote className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">نقدي (كاش)</span>
                    </button>

                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('visa')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-blue-50/50 hover:border-blue-600 bg-blue-50/30 hover:bg-blue-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform mb-2">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">بطاقة (فيزا)</span>
                    </button>

                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('vodafone')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-red-50/50 hover:border-red-600 bg-red-50/30 hover:bg-red-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-100 group-hover:scale-110 transition-transform mb-2">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">فودافون كاش</span>
                    </button>

                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('instapay')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-pink-50/50 hover:border-pink-600 bg-pink-50/30 hover:bg-pink-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-100 group-hover:scale-110 transition-transform mb-2">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">انستا باي</span>
                    </button>

                    {selectedCustomer && selectedCustomer.id !== 'WALK-IN' && (
                      <button
                        disabled={isSaving}
                        onClick={() => handleCheckout('debt')}
                        className="col-span-2 flex items-center justify-center gap-4 p-5 rounded-[2rem] border-2 border-amber-50/50 hover:border-amber-600 bg-amber-50/30 hover:bg-amber-50 transition-all group disabled:opacity-50 text-center"
                      >
                        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-100 group-hover:scale-110 transition-transform">
                          <User className="w-5 h-5" />
                        </div>
                        <span className="font-black text-gray-800 text-sm">بيع آجل (على الحساب)</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add Customer Modal */}
      <AnimatePresence>
        {isNewCustomerModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-900">إضافة عميل جديد سريع</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">تجهيز حساب العميل فورياً للربط بالفاتورة الحالية</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuickCustomerName('');
                    setQuickCustomerPhone('');
                    setQuickCustomerAddress('');
                    setIsNewCustomerModalOpen(false);
                  }}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors font-bold cursor-pointer focus:outline-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-8 space-y-4 text-right">
                <div>
                  <label className="text-xs font-black text-slate-400 block mb-2">اسم العميل *</label>
                  <input
                    type="text"
                    id="quick-customer-name"
                    value={quickCustomerName}
                    onChange={e => setQuickCustomerName(e.target.value)}
                    placeholder="الاسم الكامل للعميل"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-right"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 block mb-2">رقم الهاتف *</label>
                  <input
                    type="tel"
                    id="quick-customer-phone"
                    value={quickCustomerPhone}
                    onChange={e => setQuickCustomerPhone(e.target.value)}
                    placeholder="رقم الهاتف للتواصل والبحث"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-right font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 block mb-2">العنوان</label>
                  <input
                    type="text"
                    id="quick-customer-address"
                    value={quickCustomerAddress}
                    onChange={e => setQuickCustomerAddress(e.target.value)}
                    placeholder="عنوان العميل (اختياري)"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-right"
                  />
                </div>
                
                <div className="flex gap-3 pt-6 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCustomerName('');
                      setQuickCustomerPhone('');
                      setQuickCustomerAddress('');
                      setIsNewCustomerModalOpen(false);
                    }}
                    className="flex-1 py-3.5 bg-slate-50 text-slate-500 font-black rounded-2xl hover:bg-slate-100 transition-all text-xs cursor-pointer focus:outline-none"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const cName = quickCustomerName.trim();
                      const cPhone = quickCustomerPhone.trim();
                      const cAddress = quickCustomerAddress.trim();
                      
                      if (!cName || !cPhone) {
                        alert('الرجاء إدخال اسم العميل ورقم هاتفه.');
                        return;
                      }
                      
                      try {
                        const newCustomerRef = await addDoc(collection(db, 'customers'), {
                          name: cName,
                          phone: cPhone,
                          address: cAddress,
                          balance: 0,
                          balanceType: 'debit',
                          points: 0,
                          branchId: selectedBranchId || 'ADMIN',
                          createdAt: new Date().toISOString()
                        });
                        
                        const newCust: Customer = {
                          id: newCustomerRef.id,
                          name: cName,
                          phone: cPhone,
                          address: cAddress,
                          balance: 0,
                          balanceType: 'debit',
                          points: 0,
                          branchId: selectedBranchId || 'ADMIN',
                          createdAt: new Date().toISOString()
                        };
                        
                        setSelectedCustomer(newCust);
                        setCustomerSearchTerm(`${cName} (${cPhone})`);
                        setQuickCustomerName('');
                        setQuickCustomerPhone('');
                        setQuickCustomerAddress('');
                        setIsNewCustomerModalOpen(false);
                      } catch (err) {
                        console.error('Quick customer add failed:', err);
                        alert('حدث خطأ أثناء إضافة العميل سريعاً.');
                      }
                    }}
                    className="flex-1 py-3.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all text-xs cursor-pointer focus:outline-none"
                  >
                    حفظ واختيار العميل
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Variant Selector Modal */}
      <AnimatePresence>
        {variantSelectorProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-900">اختر المقاس واللون</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">{variantSelectorProduct.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVariantSelectorProduct(null)}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors font-bold cursor-pointer focus:outline-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 gap-3">
                  {variantSelectorProduct.variants?.map((v, index) => {
                    const vStock = getVariantBranchStock(variantSelectorProduct, v);
                    const isOutOfStock = variantSelectorProduct.trackInventory !== false && vStock <= 0;
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => addToCart(variantSelectorProduct, v)}
                        className={cn(
                          "w-full text-right p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-4",
                          isOutOfStock
                            ? "border-gray-50 bg-gray-50/50 opacity-50 cursor-not-allowed"
                            : "border-gray-100 bg-white hover:border-blue-600 hover:bg-blue-50/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-600 shrink-0 font-sans font-black text-sm">
                            {v.size || '-'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-800">{v.color || 'بدون لون'}</span>
                              {v.sku && <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{v.sku}</span>}
                            </div>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">
                              السعر: <span className="text-blue-600 font-sans">{formatCurrency(v.price || variantSelectorProduct.sellingPrice)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          {isOutOfStock ? (
                            <span className="text-xs font-black text-rose-500 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                              نفذ المخزن
                            </span>
                          ) : (
                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                              متوفر: {vStock} قطعة
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
