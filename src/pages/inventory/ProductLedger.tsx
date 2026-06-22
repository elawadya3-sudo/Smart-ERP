import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Calendar, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  History, 
  User, 
  Download, 
  Printer, 
  ArrowLeftRight, 
  Layers, 
  Filter, 
  Warehouse as WarehouseIcon, 
  RefreshCcw, 
  FileSpreadsheet, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  ChevronRight,
  Package,
  Clock,
  MapPin
} from 'lucide-react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, Warehouse, Order, InventoryTransaction } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useBranchFilter } from '../../hooks/useBranchFilter';

export default function ProductLedger() {
  const { user } = useAuth();
  const restrictedBranchId = useBranchFilter();

  // Realtime Lists from Firestore
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  
  // State for Filters
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  
  const [isSearched, setIsSearched] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ledger' | 'timeline'>('ledger');
  const [loading, setLoading] = useState<boolean>(true);

  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Load database collections in real-time
  useEffect(() => {
    setLoading(true);
    
    const unsubP = onSnapshot(query(collection(db, 'products')), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubW = onSnapshot(query(collection(db, 'warehouses')), (snap) => {
      let whs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
      if (!whs.some(w => w.id === '1')) {
        whs.unshift({
          id: '1',
          name: 'المخزن الرئيسي (Main Warehouse)',
          code: 'MAIN',
          isActive: true
        } as any);
      }
      setWarehouses(whs);
    });

    const unsubU = onSnapshot(query(collection(db, 'users')), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubO = onSnapshot(query(collection(db, 'orders')), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });

    const unsubT = onSnapshot(query(collection(db, 'inventory_transactions')), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      setLoading(false);
    });

    return () => {
      unsubP();
      unsubW();
      unsubU();
      unsubO();
      unsubT();
    };
  }, []);

  // Handle outside clicks to close product dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync default cashier branch mapping
  useEffect(() => {
    if (restrictedBranchId) {
      setSelectedWarehouseId(restrictedBranchId);
    }
  }, [restrictedBranchId]);

  // Search filter for product selector dropdown
  const filteredProductsDropdown = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(productSearchTerm.toLowerCase()))
    );
  }, [products, productSearchTerm]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Translate movement types to readable Arabic labels
  const getMovementTypeLabel = (type: string, notes?: string) => {
    if (type === 'PRIOR_BALANCE') return 'رصيد سابق';
    if (type === 'SALE') return 'بيع مبيعات';
    if (type === 'SALE_RETURN') return 'مرتجع مبيعات';
    
    if (type === 'RECEIPT') {
      if (notes?.includes('رصيد افتتاحي')) return 'رصيد افتتاحي';
      return 'شراء (توريد)';
    }
    if (type === 'ISSUE') {
      if (notes === 'مردود مشتريات') return 'مرتجع شراء';
      return 'صرف بضاعة';
    }
    if (type === 'RETURN') {
      if (notes === 'مردود مبيعات') return 'مرتجع بيع';
      return 'مرتجع بضاعة';
    }
    if (type === 'TRANSFER') return 'تحويل مخزني';
    if (type === 'ADJUSTMENT') return 'جرد وتسوية';
    
    return type;
  };

  const getMovementTypeBadgeStyle = (type: string, notes?: string) => {
    if (type === 'PRIOR_BALANCE') return 'bg-gray-100 text-gray-600 border-gray-200';
    if (type === 'SALE') return 'bg-blue-50 text-blue-600 border-blue-200';
    if (type === 'SALE_RETURN') return 'bg-orange-50 text-orange-600 border-orange-200';
    
    if (type === 'RECEIPT') {
      if (notes?.includes('رصيد افتتاحي')) return 'bg-slate-100 text-slate-700 border-slate-300';
      return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    }
    if (type === 'ISSUE') {
      if (notes === 'مردود مشتريات') return 'bg-rose-50 text-rose-600 border-rose-200';
      return 'bg-indigo-50 text-indigo-600 border-indigo-200';
    }
    if (type === 'RETURN') {
      return 'bg-amber-50 text-amber-600 border-amber-200';
    }
    if (type === 'TRANSFER') return 'bg-purple-50 text-purple-600 border-purple-200';
    if (type === 'ADJUSTMENT') return 'bg-purple-50 text-purple-700 border-purple-300';
    
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  // Compile and sort all movements chronologically
  const compiledMovements = useMemo(() => {
    if (!selectedProductId || !isSearched) return [];

    const movements: any[] = [];

    // 1. Process inventory_transactions (COMPLETED)
    transactions.forEach(tx => {
      if (tx.status !== 'COMPLETED') return;
      const item = tx.items?.find((i: any) => i.productId === selectedProductId);
      if (!item) return;

      const qty = Number(item.quantity) || 0;
      const date = tx.createdAt;
      const creatorName = users.find(u => u.uid === tx.createdBy || u.id === tx.createdBy)?.name || tx.createdBy || 'نظام البيع';

      // Decide movement rows based on warehouseId filter
      if (selectedWarehouseId) {
        if (tx.fromWarehouseId === selectedWarehouseId) {
          movements.push({
            id: tx.id + '-out',
            date: new Date(date),
            dateString: date,
            type: tx.type,
            notes: tx.notes || '',
            reference: tx.reference || 'بدون مستند',
            warehouseId: tx.fromWarehouseId,
            warehouseName: warehouses.find(w => w.id === tx.fromWarehouseId)?.name || 'مستودع غير معروف',
            incoming: 0,
            outgoing: qty,
            createdBy: creatorName,
            originalDoc: tx
          });
        }
        if (tx.toWarehouseId === selectedWarehouseId) {
          movements.push({
            id: tx.id + '-in',
            date: new Date(date),
            dateString: date,
            type: tx.type,
            notes: tx.notes || '',
            reference: tx.reference || 'بدون مستند',
            warehouseId: tx.toWarehouseId,
            warehouseName: warehouses.find(w => w.id === tx.toWarehouseId)?.name || 'مستودع غير معروف',
            incoming: qty,
            outgoing: 0,
            createdBy: creatorName,
            originalDoc: tx
          });
        }
      } else {
        // All warehouses selected
        if (tx.type === 'TRANSFER') {
          // Out of source
          movements.push({
            id: tx.id + '-out',
            date: new Date(date),
            dateString: date,
            type: tx.type,
            notes: tx.notes || '',
            reference: tx.reference || 'بدون مستند',
            warehouseId: tx.fromWarehouseId,
            warehouseName: warehouses.find(w => w.id === tx.fromWarehouseId)?.name || 'مستودع غير معروف',
            incoming: 0,
            outgoing: qty,
            createdBy: creatorName,
            originalDoc: tx
          });
          // Into target
          movements.push({
            id: tx.id + '-in',
            date: new Date(date),
            dateString: date,
            type: tx.type,
            notes: tx.notes || '',
            reference: tx.reference || 'بدون مستند',
            warehouseId: tx.toWarehouseId,
            warehouseName: warehouses.find(w => w.id === tx.toWarehouseId)?.name || 'مستودع غير معروف',
            incoming: qty,
            outgoing: 0,
            createdBy: creatorName,
            originalDoc: tx
          });
        } else {
          const whId = tx.toWarehouseId || tx.fromWarehouseId;
          const whName = warehouses.find(w => w.id === whId)?.name || 'مستودع غير معروف';
          let incoming = 0;
          let outgoing = 0;

          if (tx.type === 'RECEIPT' || tx.type === 'RETURN') {
            incoming = qty;
          } else if (tx.type === 'ISSUE') {
            outgoing = qty;
          } else if (tx.type === 'ADJUSTMENT') {
            if (qty > 0) incoming = qty;
            else outgoing = Math.abs(qty);
          }

          movements.push({
            id: tx.id,
            date: new Date(date),
            dateString: date,
            type: tx.type,
            notes: tx.notes || '',
            reference: tx.reference || 'بدون مستند',
            warehouseId: whId,
            warehouseName: whName,
            incoming,
            outgoing,
            createdBy: creatorName,
            originalDoc: tx
          });
        }
      }
    });

    // 2. Process orders (Sales invoices)
    orders.forEach(order => {
      if (order.status === 'CANCELLED' || order.status === 'PENDING') return;
      const item = order.items?.find((i: any) => i.productId === selectedProductId);
      if (!item) return;

      const cashierName = users.find(u => u.uid === order.cashierId || u.id === order.cashierId)?.name || 'كاشير';
      const date = order.createdAt;

      // Filter by warehouseId
      if (selectedWarehouseId && order.branchId !== selectedWarehouseId) return;

      const branchName = warehouses.find(w => w.id === order.branchId)?.name || 'فرع غير معروف';
      const soldQty = Number(item.quantity) || 0;

      // 2a. Sale row (Outgoing)
      movements.push({
        id: order.id + '-sale',
        date: new Date(date),
        dateString: date,
        type: 'SALE',
        notes: `فاتورة مبيعات رقم #${order.id}`,
        reference: order.id,
        warehouseId: order.branchId,
        warehouseName: branchName,
        incoming: 0,
        outgoing: soldQty,
        createdBy: cashierName,
        originalDoc: order
      });

      // 2b. Return row (Incoming)
      let returnedQty = 0;
      if (order.status === 'RETURNED') {
        returnedQty = soldQty;
      } else if (order.status === 'PARTIALLY_RETURNED') {
        returnedQty = Number(item.returnedQuantity) || 0;
      }

      if (returnedQty > 0) {
        // Place return exactly 1 second after invoice date for chronological sorting
        const returnDate = new Date(new Date(date).getTime() + 1000);
        movements.push({
          id: order.id + '-return',
          date: returnDate,
          dateString: returnDate.toISOString(),
          type: 'SALE_RETURN',
          notes: `مرتجع مبيعات فاتورة رقم #${order.id}`,
          reference: order.id,
          warehouseId: order.branchId,
          warehouseName: branchName,
          incoming: returnedQty,
          outgoing: 0,
          createdBy: cashierName,
          originalDoc: order
        });
      }
    });

    // 3. Sort chronologically
    movements.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 4. Calculate Prior/Opening Balance before the selected start date
    let priorBalance = 0;
    if (startDate) {
      const start = new Date(startDate);
      const priorMovements = movements.filter(m => m.date < start);
      priorMovements.forEach(m => {
        priorBalance += (m.incoming - m.outgoing);
      });
    }

    // 5. Filter by Date range
    let filteredMovements = movements;
    if (startDate) {
      const start = new Date(startDate);
      filteredMovements = filteredMovements.filter(m => m.date >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filteredMovements = filteredMovements.filter(m => m.date <= end);
    }

    // 6. Build the final ledger list starting with Prior Balance if date is set
    const finalLedger: any[] = [];
    let currentBalance = priorBalance;

    if (startDate) {
      finalLedger.push({
        id: 'prior-balance-row',
        dateString: startDate + 'T00:00:00.000Z',
        type: 'PRIOR_BALANCE',
        notes: 'الرصيد السابق لهذه الفترة المحددة',
        reference: '---',
        warehouseName: '---',
        incoming: 0,
        outgoing: 0,
        balance: priorBalance,
        createdBy: 'النظام'
      });
    }

    filteredMovements.forEach(m => {
      currentBalance += (m.incoming - m.outgoing);
      finalLedger.push({
        ...m,
        balance: currentBalance
      });
    });

    return finalLedger;
  }, [selectedProductId, selectedWarehouseId, startDate, endDate, transactions, orders, users, products, warehouses, isSearched]);

  // Ledger statistics summaries
  const stats = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;
    
    compiledMovements.forEach(m => {
      if (m.type !== 'PRIOR_BALANCE') {
        incoming += m.incoming;
        outgoing += m.outgoing;
      }
    });

    const currentBalance = compiledMovements.length > 0 
      ? compiledMovements[compiledMovements.length - 1].balance 
      : 0;

    return {
      incoming,
      outgoing,
      currentBalance
    };
  }, [compiledMovements]);

  // Export ledger details to Excel (UTF-8 BOM CSV)
  const handleExportCSV = () => {
    if (compiledMovements.length === 0) {
      alert('لا توجد بيانات لتصديرها.');
      return;
    }

    const productName = selectedProduct ? selectedProduct.name : 'منتج';
    const headers = [
      'التاريخ والوقت',
      'نوع الحركة',
      'رقم المستند / الفاتورة',
      'المخزن / الموقع',
      'الوارد',
      'الصادر',
      'الرصيد بعد الحركة',
      'بواسطة المستخدم'
    ];

    const rows = compiledMovements.map(m => [
      m.type === 'PRIOR_BALANCE' ? '---' : new Date(m.dateString).toLocaleString('ar-EG'),
      getMovementTypeLabel(m.type, m.notes),
      m.reference,
      m.warehouseName,
      m.incoming,
      m.outgoing,
      m.balance,
      m.createdBy
    ]);

    let csvContent = '\uFEFF'; // UTF-8 BOM for Arabic compatibility in Excel
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `كشف_حساب_${productName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSearchClick = () => {
    if (!selectedProductId) {
      alert('الرجاء اختيار صنف/منتج للبحث أولاً.');
      return;
    }
    setIsSearched(true);
  };

  return (
    <div className="space-y-8 pb-32 print:p-0 print:space-y-4" dir="rtl">
      
      {/* CSS Print Rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            background-color: transparent !important;
            box-shadow: none !important;
          }
          #printable-ledger-area, #printable-ledger-area * {
            visibility: visible;
          }
          #printable-ledger-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }
          .print-hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* ─── Header Section ─── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-25"></div>
        
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <History className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">كشف حساب منتج</h2>
                <p className="text-gray-400 text-xs font-bold mt-1">تتبع حركة وأرصدة الصنف بالتفصيل والجدول الزمني</p>
             </div>
          </div>
        </div>

        {/* Dynamic tabs */}
        {isSearched && selectedProduct && (
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl relative z-10 w-full lg:w-auto">
            <button
              onClick={() => setActiveTab('ledger')}
              className={cn(
                "flex-1 lg:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all",
                activeTab === 'ledger' 
                  ? "bg-white text-blue-600 shadow-sm border border-blue-50" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <FileSpreadsheet className="w-4 h-4" />
              كشف الحساب التفصيلي
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={cn(
                "flex-1 lg:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all",
                activeTab === 'timeline' 
                  ? "bg-white text-blue-600 shadow-sm border border-blue-50" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Clock className="w-4 h-4" />
              تتبع مسار المنتج
            </button>
          </div>
        )}
      </div>

      {/* ─── Filters Panel ─── */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 space-y-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Custom Searchable Product Dropdown */}
          <div className="relative md:col-span-2" ref={productDropdownRef}>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">اختر المنتج</label>
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
              <input
                type="text"
                placeholder="ابحث عن الصنف بالاسم أو الكود..."
                value={selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku || 'بدون كود'})` : productSearchTerm}
                onFocus={() => {
                  setShowProductDropdown(true);
                  if (selectedProduct) {
                    setProductSearchTerm('');
                    setSelectedProductId('');
                    setIsSearched(false);
                  }
                }}
                onChange={(e) => {
                  setProductSearchTerm(e.target.value);
                  setShowProductDropdown(true);
                  setIsSearched(false);
                }}
                className="w-full bg-slate-50 border-none rounded-2xl pr-11 pl-4 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>
            
            <AnimatePresence>
              {showProductDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-50 w-full mt-2 bg-white rounded-3xl border border-gray-100 shadow-2xl max-h-72 overflow-y-auto pr-1 scrollbar-thin"
                >
                  {filteredProductsDropdown.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400 font-bold">لا يوجد نتائج مطابقة</div>
                  ) : (
                    filteredProductsDropdown.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setProductSearchTerm(`${p.name} (${p.sku || 'بدون كود'})`);
                          setShowProductDropdown(false);
                        }}
                        className="w-full text-right p-4 border-b border-slate-50 hover:bg-blue-50/50 transition-colors flex items-center justify-between gap-4"
                      >
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold mt-1">الماركة: {p.brand || 'عام'} • التصنيف: {p.category}</p>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-mono font-bold">{p.sku || '---'}</span>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Warehouse / Branch Selector */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">المخزن أو الفرع</label>
            <div className="relative">
              <WarehouseIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
              <select
                value={selectedWarehouseId}
                disabled={!!restrictedBranchId}
                onChange={(e) => {
                  setSelectedWarehouseId(e.target.value);
                  setIsSearched(false);
                }}
                className="w-full bg-slate-50 border-none rounded-2xl pr-11 pl-4 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all appearance-none cursor-pointer disabled:opacity-60"
              >
                <option value="">جميع المخازن والفروع</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date range picker */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">من تاريخ</label>
              <div className="relative">
                <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setIsSearched(false);
                  }}
                  className="w-full bg-slate-50 border-none rounded-2xl pr-10 pl-3 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all" 
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">إلى تاريخ</label>
              <div className="relative">
                <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setIsSearched(false);
                  }}
                  className="w-full bg-slate-50 border-none rounded-2xl pr-10 pl-3 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-50">
          <button
            onClick={() => {
              setSelectedProductId('');
              setProductSearchTerm('');
              setStartDate('');
              setEndDate('');
              setSelectedWarehouseId('');
              setIsSearched(false);
            }}
            className="px-6 py-3.5 bg-slate-50 text-slate-500 font-black rounded-2xl hover:bg-slate-100 transition-all active:scale-[0.98] cursor-pointer text-xs"
          >
            تصفير الفلاتر
          </button>
          <button
            onClick={handleSearchClick}
            className="px-8 py-3.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-500/10 active:scale-[0.98] cursor-pointer text-xs flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            جلب البيانات والبحث
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 text-xs font-bold mt-4">جاري تحميل البيانات...</p>
        </div>
      )}

      {/* ─── Search Results Bento & Table printable area ─── */}
      {!loading && isSearched && selectedProduct && (
        <div id="printable-ledger-area" className="space-y-8">
          
          {/* Print specific header */}
          <div className="hidden print:block text-right mb-6 border-b pb-4">
            <h2 className="text-2xl font-black text-gray-900">كشف حساب حركة الصنف</h2>
            <p className="text-xs text-gray-500 mt-1">المنتج: {selectedProduct.name} ({selectedProduct.sku})</p>
            <p className="text-xs text-gray-500 mt-0.5">المستودع: {selectedWarehouseId ? warehouses.find(w => w.id === selectedWarehouseId)?.name : 'كل المستودعات والفروع'}</p>
            {(startDate || endDate) && (
              <p className="text-xs text-gray-500 mt-0.5">الفترة: {startDate || 'من البداية'} - {endDate || 'اليوم'}</p>
            )}
          </div>

          {/* Bento Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            
            <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 opacity-30"></div>
              <div className="w-11 h-11 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center relative z-10">
                <Package className="w-5.5 h-5.5" />
              </div>
              <div className="min-w-0 relative z-10">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">اسم الصنف</p>
                <p className="text-sm font-black text-gray-900 truncate">{selectedProduct.name}</p>
                <p className="text-[9px] text-gray-400 font-black mt-1 uppercase">{selectedProduct.category}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 opacity-30"></div>
              <div className="w-11 h-11 shrink-0 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center relative z-10">
                <Layers className="w-5.5 h-5.5" />
              </div>
              <div className="min-w-0 relative z-10">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1 font-sans">كود الصنف / SKU</p>
                <p className="text-sm font-mono font-black text-slate-800 truncate">{selectedProduct.sku || '---'}</p>
                <p className="text-[9px] text-gray-400 font-black mt-1 uppercase">باركود: {selectedProduct.barcode || '---'}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 opacity-30"></div>
              <div className="w-11 h-11 shrink-0 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center relative z-10">
                <TrendingUp className="w-5.5 h-5.5" />
              </div>
              <div className="min-w-0 relative z-10">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">إجمالي الوارد</p>
                <p className="text-base font-black text-emerald-600 truncate">{stats.incoming} قطعة</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full -mr-12 -mt-12 opacity-30"></div>
              <div className="w-11 h-11 shrink-0 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center relative z-10">
                <TrendingDown className="w-5.5 h-5.5" />
              </div>
              <div className="min-w-0 relative z-10">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">إجمالي الصادر</p>
                <p className="text-base font-black text-rose-600 truncate">{stats.outgoing} قطعة</p>
              </div>
            </div>

            <div className={cn(
              "p-5 rounded-[2rem] shadow-sm flex items-center gap-4 text-white relative overflow-hidden print:border print:text-slate-900 print:bg-white print:shadow-none",
              stats.currentBalance >= 0 ? "bg-gradient-to-tr from-blue-600 to-blue-500 shadow-blue-500/10" : "bg-gradient-to-tr from-rose-600 to-rose-500 shadow-rose-500/10"
            )}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
              <div className="w-11 h-11 shrink-0 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center relative z-10 print:bg-slate-100 print:text-slate-600">
                <RefreshCcw className="w-5.5 h-5.5" />
              </div>
              <div className="min-w-0 relative z-10">
                <p className="text-[10px] text-white/70 font-black uppercase tracking-widest leading-none mb-1 print:text-slate-400">الرصيد المتبقي</p>
                <p className="text-lg font-black truncate">{stats.currentBalance} قطعة</p>
              </div>
            </div>

          </div>

          {/* Tab 1: Ledger Data Grid */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              
              {/* Table Action Bar */}
              <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl border border-gray-100 print-hidden">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse"></span>
                  <span className="text-xs font-black text-slate-700">سجل حركات المنتج ({compiledMovements.filter(m => m.type !== 'PRIOR_BALANCE').length} عملية)</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2.5 bg-white text-slate-600 font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 text-xs cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-400" />
                    طباعة كشف الحساب
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2.5 bg-white text-slate-600 font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 text-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-400" />
                    تصدير إلى Excel
                  </button>
                </div>
              </div>

              {/* Data Grid */}
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-gray-100/50">
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-center print:py-2">التاريخ والوقت</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-center print:py-2">نوع الحركة</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-center print:py-2">رقم المستند / الفاتورة</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-center print:py-2">المستودع / الموقع</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-center print:py-2">الوارد (+)</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-center print:py-2">الصادر (-)</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-center print:py-2">الرصيد بعد الحركة</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-center print:py-2">المستخدم المسؤول</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {compiledMovements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-20 text-center text-gray-400 font-bold">لا يوجد عمليات مسجلة لهذا المنتج ضمن المعايير المحددة</td>
                        </tr>
                      ) : (
                        compiledMovements.map((m, idx) => (
                          <tr key={m.id} className={cn("hover:bg-blue-50/20 transition-colors", m.type === 'PRIOR_BALANCE' && "bg-slate-50/50")}>
                            <td className="px-6 py-4 text-center font-sans text-xs text-gray-500 font-bold print:py-2">
                              {m.type === 'PRIOR_BALANCE' ? '---' : new Date(m.dateString).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-6 py-4 text-center print:py-2">
                              <span className={cn(
                                "text-[10px] font-black px-2.5 py-1 rounded-full border",
                                getMovementTypeBadgeStyle(m.type, m.notes)
                              )}>
                                {getMovementTypeLabel(m.type, m.notes)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center print:py-2">
                              {m.type === 'PRIOR_BALANCE' ? (
                                <span className="text-xs font-bold text-gray-500 font-mono">{m.reference}</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedDoc(m)}
                                  className="text-xs font-black text-blue-600 hover:text-blue-800 hover:underline font-mono focus:outline-none cursor-pointer"
                                >
                                  {m.reference}
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center print:py-2">
                              <span className="text-xs font-bold text-gray-700">{m.warehouseName}</span>
                            </td>
                            <td className="px-6 py-4 text-center font-sans text-sm font-black text-emerald-600 print:py-2">
                              {m.incoming > 0 ? `+${m.incoming}` : '---'}
                            </td>
                            <td className="px-6 py-4 text-center font-sans text-sm font-black text-rose-500 print:py-2">
                              {m.outgoing > 0 ? `-${m.outgoing}` : '---'}
                            </td>
                            <td className="px-6 py-4 text-center font-sans text-sm font-black text-slate-800 print:py-2">
                              {m.balance}
                            </td>
                            <td className="px-6 py-4 text-center print:py-2">
                              <span className="text-xs font-bold text-gray-500">{m.createdBy}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Timeline View */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 print-hidden">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                <h4 className="text-lg font-black text-gray-900">المسار الزمني لتحركات الصنف تاريخياً</h4>
              </div>

              {compiledMovements.filter(m => m.type !== 'PRIOR_BALANCE').length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-bold border border-dashed border-gray-200 rounded-3xl">لا يوجد حركات لعرضها في المخطط الزمني</div>
              ) : (
                <div className="relative border-r-2 border-blue-100 mr-4 space-y-8 pb-10">
                  {compiledMovements.filter(m => m.type !== 'PRIOR_BALANCE').map((m, index) => {
                    const isIncoming = m.incoming > 0;
                    return (
                      <div key={m.id} className="relative pr-8">
                        {/* Timeline Bullet Node */}
                        <div className={cn(
                          "absolute right-0 top-1.5 -mr-[11px] w-5 h-5 rounded-full border-4 border-white shadow flex items-center justify-center",
                          isIncoming ? "bg-emerald-500" : "bg-rose-500"
                        )}></div>

                        {/* Timeline Node Card */}
                        <div className="bg-slate-50/50 border border-slate-100 hover:border-blue-100 rounded-2xl p-5 hover:bg-white transition-all shadow-sm max-w-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded-md border",
                                getMovementTypeBadgeStyle(m.type, m.notes)
                              )}>
                                {getMovementTypeLabel(m.type, m.notes)}
                              </span>
                              <span className="text-xs font-black text-slate-800">{m.notes}</span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-400 text-xs font-bold">
                              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-300" /> {m.warehouseName}</span>
                              <span className="flex items-center gap-1">
                                <Info className="w-3.5 h-3.5 text-gray-300" />
                                مستند:{" "}
                                <button
                                  type="button"
                                  onClick={() => setSelectedDoc(m)}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-bold focus:outline-none cursor-pointer"
                                >
                                  {m.reference}
                                </button>
                              </span>
                              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-gray-300" /> {m.createdBy}</span>
                            </div>
                          </div>

                          <div className="text-left sm:text-right shrink-0">
                            <p className="text-base font-black font-sans leading-none">
                              {isIncoming 
                                ? <span className="text-emerald-600">+{m.incoming} وارد</span> 
                                : <span className="text-rose-500">-{m.outgoing} صادر</span>
                              }
                            </p>
                            <span className="text-[10px] text-gray-400 font-bold block mt-2 font-sans">
                              {new Date(m.dateString).toLocaleString('ar-EG')}
                            </span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ─── Initial State message ─── */}
      {!loading && !isSearched && (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-16 text-center shadow-sm relative overflow-hidden print-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-50/30 rounded-full blur-3xl"></div>
          <div className="max-w-md mx-auto space-y-4 relative z-10">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <History className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-gray-900">ابدأ الفحص واستخراج كشف الحساب</h3>
            <p className="text-slate-400 text-xs font-bold leading-relaxed">الرجاء اختيار المنتج المراد مراجعته وتصفية الفترة والمخزن، ثم اضغط على زر **"جلب البيانات والبحث"** لعرض الحركات التفصيلية والتتبع الزمني.</p>
          </div>
        </div>
      )}

      {/* ─── Document Details Modal ─── */}
      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="text-right">
                  <h3 className="text-xl font-black text-slate-900">
                    {['SALE', 'SALE_RETURN'].includes(selectedDoc.type)
                      ? `تفاصيل الفاتورة: #${selectedDoc.reference}`
                      : `تفاصيل مستند الحركة: #${selectedDoc.reference}`}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                    {getMovementTypeLabel(selectedDoc.type, selectedDoc.notes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors font-bold cursor-pointer focus:outline-none"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8 scrollbar-none text-right space-y-6">
                
                {/* 1. If it's a SALE or SALE_RETURN (Order doc) */}
                {['SALE', 'SALE_RETURN'].includes(selectedDoc.type) && selectedDoc.originalDoc && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-slate-400 mb-1 font-bold">العميل</p>
                        <p className="text-slate-900">
                          {users.find(u => u.uid === selectedDoc.originalDoc.customerId || u.id === selectedDoc.originalDoc.customerId)?.name || selectedDoc.originalDoc.customerName || 'عميل نقدي'}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-slate-400 mb-1 font-bold">طريقة الدفع</p>
                        <p className="text-slate-900">
                          {selectedDoc.originalDoc.paymentMethod === 'cash' || selectedDoc.originalDoc.paymentMethod === 'CASH'
                            ? 'نقدي'
                            : selectedDoc.originalDoc.paymentMethod === 'visa' || selectedDoc.originalDoc.paymentMethod === 'CARD'
                            ? 'بطاقة'
                            : selectedDoc.originalDoc.paymentMethod === 'SPLIT'
                            ? 'مختلط'
                            : 'آجل'}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-slate-400 mb-1 font-bold">الفرع / الموقع</p>
                        <p className="text-slate-900">{selectedDoc.warehouseName}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-slate-400 mb-1 font-bold">تاريخ العملية</p>
                        <p className="text-slate-900 font-sans">
                          {new Date(selectedDoc.dateString).toLocaleString('ar-EG')}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl text-xs">
                      <p className="font-bold text-slate-400 mb-1">الملاحظات</p>
                      <p className="text-slate-700 font-bold">{selectedDoc.originalDoc.notes || 'لا توجد ملاحظات.'}</p>
                    </div>

                    <div className="border border-slate-100 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-sm">
                        <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4">اسم المنتج</th>
                            <th className="px-6 py-4 text-center">الكمية المباعة</th>
                            {selectedDoc.type === 'SALE_RETURN' && (
                              <th className="px-6 py-4 text-center">الكمية المرتجعة</th>
                            )}
                            <th className="px-6 py-4">سعر الوحدة</th>
                            <th className="px-6 py-4 text-left">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-xs">
                          {selectedDoc.originalDoc.items?.map((item: any, idx: number) => (
                            <tr
                              key={idx}
                              className={cn(
                                "hover:bg-slate-50/50",
                                item.productId === selectedProductId && "bg-blue-50/50 font-black"
                              )}
                            >
                              <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                                {item.productName || item.name}
                                {item.productId === selectedProductId && (
                                  <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-md font-bold">الصنف المحدد</span>
                                )}
                              </td>
                              <td className="px-6 py-4 font-sans font-bold text-center text-slate-700">{item.quantity}</td>
                              {selectedDoc.type === 'SALE_RETURN' && (
                                <td className="px-6 py-4 font-sans font-bold text-center text-rose-600">
                                  {item.returnedQuantity || 0}
                                </td>
                              )}
                              <td className="px-6 py-4 font-sans">{formatCurrency(item.price || 0)}</td>
                              <td className="px-6 py-4 font-sans font-black text-left">
                                {formatCurrency(item.total || (item.quantity * (item.price || 0)))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col items-end gap-2 px-6 font-bold text-xs text-slate-600">
                      <div className="font-sans">المجموع الفرعي: {formatCurrency(selectedDoc.originalDoc.subtotal || 0)}</div>
                      {selectedDoc.originalDoc.discount > 0 && (
                        <div className="text-rose-500 font-sans font-bold">الخصم: -{formatCurrency(selectedDoc.originalDoc.discount)}</div>
                      )}
                      <div className="font-sans">الضريبة: {formatCurrency(selectedDoc.originalDoc.tax || 0)}</div>
                      <div className="text-base font-black text-blue-600 mt-2 font-sans">
                        الإجمالي النهائي: {formatCurrency(selectedDoc.originalDoc.total || 0)}
                      </div>
                    </div>
                  </>
                )}

                {/* 2. If it's an Inventory Transaction (Purchases, transfers, adjustments, etc.) */}
                {!['SALE', 'SALE_RETURN'].includes(selectedDoc.type) && selectedDoc.originalDoc && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-slate-400 mb-1 font-bold">المرجع</p>
                        <p className="text-slate-900 font-mono">{selectedDoc.originalDoc.reference || 'بدون مرجع'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-slate-400 mb-1 font-bold">التاريخ</p>
                        <p className="text-slate-900 font-sans">
                          {new Date(selectedDoc.dateString).toLocaleString('ar-EG')}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-slate-400 mb-1 font-bold">المستودع المصدر</p>
                        <p className="text-slate-900 text-rose-600 font-bold">
                          {warehouses.find(w => w.id === selectedDoc.originalDoc.fromWarehouseId)?.name || 'مورد خارجي / تسوية'}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-slate-400 mb-1 font-bold">المستودع المستلم</p>
                        <p className="text-slate-900 text-emerald-600 font-bold">
                          {warehouses.find(w => w.id === selectedDoc.originalDoc.toWarehouseId)?.name || 'عميل خارجي / تسوية'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl text-xs">
                      <p className="font-bold text-slate-400 mb-1">الملاحظات</p>
                      <p className="text-slate-700 font-bold">{selectedDoc.originalDoc.notes || 'لا توجد ملاحظات.'}</p>
                    </div>

                    <div className="border border-slate-100 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-sm">
                        <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4">الصنف</th>
                            <th className="px-6 py-4 text-center">الكمية</th>
                            <th className="px-6 py-4">التكلفة للوحدة</th>
                            <th className="px-6 py-4 text-left">التكلفة الإجمالية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-xs">
                          {selectedDoc.originalDoc.items?.map((item: any, idx: number) => (
                            <tr
                              key={idx}
                              className={cn(
                                "hover:bg-slate-50/50",
                                item.productId === selectedProductId && "bg-blue-50/50 font-black"
                              )}
                            >
                              <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                                {item.productName}
                                {item.productId === selectedProductId && (
                                  <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-md font-bold">الصنف المحدد</span>
                                )}
                              </td>
                              <td className="px-6 py-4 font-sans font-bold text-center text-blue-600">{item.quantity}</td>
                              <td className="px-6 py-4 font-sans">{formatCurrency(item.cost || 0)}</td>
                              <td className="px-6 py-4 font-sans font-black text-left">
                                {formatCurrency(item.quantity * (item.cost || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center font-black text-base px-6">
                      <span>إجمالي القيمة التقديرية:</span>
                      <span className="text-blue-600 font-sans font-black">
                        {formatCurrency(
                          selectedDoc.originalDoc.items?.reduce(
                            (acc: number, i: any) => acc + (i.quantity * (i.cost || 0)),
                            0
                          ) || 0
                        )}
                      </span>
                    </div>
                  </>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
