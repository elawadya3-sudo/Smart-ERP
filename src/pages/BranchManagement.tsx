import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ArrowDownCircle,
  Package,
  History as HistoryIcon,
  Banknote,
  Plus,
  X,
  Store,
  LayoutDashboard,
  Receipt,
  RotateCcw,
  Trash2,
  Edit3,
  Check,
  Coins,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Truck,
  CheckCircle2
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { usePOS } from '../context/POSContext';
import { formatCurrency, cn } from '../lib/utils';
import { Order, Shift, Warehouse } from '../types';
import { useSearchParams } from 'react-router-dom';

export default function BranchManagement() {
  const { user } = useAuth();
  const { getOpenShift, closeShift, addInvoice, updateInvoice, deleteInvoice, invoices: contextInvoices, shifts: contextShifts } = usePOS();

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isCashExpenseModalOpen, setIsCashExpenseModalOpen] = useState(false);
  const [cashExpenseAmount, setCashExpenseAmount] = useState(0);
  const [cashExpenseNote, setCashExpenseNote] = useState('');
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [actualCash, setActualCash] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [products, setProducts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);

  // Fetch Warehouses
  useEffect(() => {
    try {
      const qW = query(collection(db, 'warehouses'));
      const unsubscribe = onSnapshot(qW, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
        setWarehouses(docs);
        setIsLoading(false);
      }, (err) => {
        console.error('Firestore warehouses error:', err);
      });
      return () => unsubscribe();
    } catch (e: any) {
      console.error('Effect error:', e);
    }
  }, []);

  // Fetch Products for profit calculation
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
    } catch (e) { console.error(e); }
  }, []);

  // Fetch Inventory Transfers
  useEffect(() => {
    try {
      const qT = query(collection(db, 'inventory_transactions'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(qT, (snapshot) => {
        setTransfers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
    } catch (e) { console.error(e); }
  }, []);

  // Auto-set branch for cashiers
  useEffect(() => {
    if (user?.role === 'CASHIER' && user.branchId && !selectedBranchId) {
      setSelectedBranchId(user.branchId);
    }
  }, [user, selectedBranchId]);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const invId = searchParams.get('invoiceId');
    const trId = searchParams.get('transferId');

    if (invId && contextInvoices.length > 0) {
      const inv = contextInvoices.find(i => String(i.id) === String(invId));
      if (inv) {
        setSelectedInvoice(inv);
        // Clean up URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('invoiceId');
        setSearchParams(newParams, { replace: true });
      }
    }

    if (trId) {
      const element = document.getElementById('transfers-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        // Clean up URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('transferId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, contextInvoices, transfers]);

  // Wrap calculation in try-catch for debugging
  let stats: any = { totalSales: 0, cashSales: 0, cardSales: 0, expectedCash: 0, branchTodaySales: 0, soldProductsAggregate: {} };
  let currentShift: any = null;
  let branchWarehouse: any = null;
  let shiftInvoices: any[] = [];
  let branchInvoices: any[] = [];

  try {
    currentShift = getOpenShift(selectedBranchId);
    branchWarehouse = warehouses.find(w => w.id === selectedBranchId);

    shiftInvoices = currentShift ? contextInvoices.filter(inv => inv && inv.shiftId === currentShift.id) : [];
    const completedShiftInvoices = shiftInvoices.filter(inv => inv.status === 'COMPLETED' || !inv.status);
    const pendingShiftInvoices = shiftInvoices.filter(inv => inv.status === 'PENDING');

    // Separate Sales and Expenses for the shift (only completed sales should count)
    const salesInvoices = completedShiftInvoices.filter(inv => inv && inv.customerId !== 'EXPENSE');
    const expenseInvoices = completedShiftInvoices.filter(inv => inv && inv.customerId === 'EXPENSE');

    stats.cashSales = salesInvoices.filter(inv => inv && inv.paymentMethod === 'cash').reduce((acc, inv) => acc + (inv.total || 0), 0);
    stats.cardSales = salesInvoices.filter(inv => inv && inv.paymentMethod === 'visa').reduce((acc, inv) => acc + (inv.total || 0), 0);
    stats.totalSales = stats.cashSales + stats.cardSales;

    stats.totalExpenses = expenseInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);

    stats.pendingInvoices = pendingShiftInvoices;

    // Expected Cash = Opening + Cash Sales - Expenses
    stats.expectedCash = currentShift ? (currentShift.openingCash || 0) + stats.cashSales - stats.totalExpenses : 0;

    // Today's Branch Sales (Filtered for specific branch and not including expenses)
    branchInvoices = contextInvoices.filter(inv => inv && inv.branchId === selectedBranchId && (inv.status === 'COMPLETED' || !inv.status) && inv.customerId !== 'EXPENSE');

    stats.branchTodaySales = branchInvoices
      .filter(inv => {
        if (!inv || !inv.createdAt) return false;
        const invDate = new Date(inv.createdAt);
        if (isNaN(invDate.getTime())) return false;
        return invDate.toDateString() === new Date().toDateString();
      })
      .reduce((acc, inv) => acc + (inv.total || 0), 0);

    // Admin Cumulative Stats
    stats.branchAllTimeSales = branchInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);

    stats.branchAllTimeProfit = branchInvoices.reduce((acc, inv) => {
      const invoiceProfit = (inv.items || []).reduce((pAcc: number, item: any) => {
        const product = products.find(p => p.id === item.productId);
        const cost = product?.costPrice || 0;
        return pAcc + (item.total - (item.quantity * cost));
      }, 0);
      return acc + invoiceProfit;
    }, 0);

    stats.allBranchInvoices = [...contextInvoices.filter(inv => inv && inv.branchId === selectedBranchId)]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Shifts History
    const closedShifts = contextShifts.filter(s => s.branchId === selectedBranchId && s.status === 'CLOSED');
    stats.branchShiftsHistory = closedShifts.map(shift => {
      const shiftInvoices = contextInvoices.filter(inv => inv.shiftId === shift.id && (inv.status === 'COMPLETED' || !inv.status));
      const totalSales = shiftInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
      const totalProfit = shiftInvoices.reduce((acc, inv) => {
        const invProfit = (inv.items || []).reduce((pAcc: number, item: any) => {
          const product = products.find(p => p.id === item.productId);
          const cost = product?.costPrice || 0;
          return pAcc + (item.total - (item.quantity * cost));
        }, 0);
        return acc + invProfit;
      }, 0);
      return { ...shift, totalSales, totalProfit };
    }).sort((a, b) => new Date(b.endDate || b.startDate).getTime() - new Date(a.endDate || a.startDate).getTime());

    // Active Shifts (for cleanup)
    stats.openShifts = contextShifts.filter(s => s.branchId === selectedBranchId && s.status === 'OPEN');

    stats.soldProductsAggregate = completedShiftInvoices.reduce((acc: any, inv: any) => {
      if (!inv || !Array.isArray(inv.items)) return acc;
      inv.items.forEach((item: any) => {
        if (!item) return;
        const key = inv.customerId === 'EXPENSE' ? `EXPENSE-${item.name || 'مجهول'}` : (item.productId || 'unknown');
        if (!acc[key]) {
          acc[key] = { name: item.name || 'منتج غير معروف', quantity: 0, total: 0, isExpense: inv.customerId === 'EXPENSE' };
        }
        acc[key].quantity += (item.quantity || 0);
        acc[key].total += (item.total || 0);
      });
      return acc;
    }, {});

    // Process invoices for display with sequential numbers
    stats.detailedInvoices = [...shiftInvoices]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((inv, index) => ({
        ...inv,
        seqNo: index + 1
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err: any) {
    console.error('Calculation error in BranchManagement:', err);
    if (!renderError) setRenderError(err.message);
  }

  const handleCashExpense = async () => {
    if (!currentShift || !cashExpenseAmount || cashExpenseAmount <= 0) return;
    if (!user?.uid) {
      alert('لم يتم تحميل بيانات المستخدم بعد. يرجى تسجيل الدخول أو إعادة تحميل الصفحة.');
      return;
    }

    const expense: Order = {
      id: `EXP-${Date.now().toString(36).toUpperCase()}`,
      items: [{ productId: 'EXPENSE', name: cashExpenseNote || 'صرف نقدي', quantity: 1, price: cashExpenseAmount, total: cashExpenseAmount }],
      subtotal: cashExpenseAmount,
      tax: 0,
      discount: 0,
      total: cashExpenseAmount,
      paymentMethod: 'cash',
      cashierId: user.uid,
      shiftId: currentShift.id,
      branchId: selectedBranchId,
      createdAt: new Date().toISOString(),
      customerId: 'EXPENSE'
    };
    try {
      await addInvoice(expense);
      setIsCashExpenseModalOpen(false);
      setCashExpenseAmount(0);
      setCashExpenseNote('');
    } catch (err: any) { console.error(err); }
  };

  const handleCloseShift = async (specificShiftId?: string) => {
    const shiftIdToClose = specificShiftId || currentShift?.id;
    if (!shiftIdToClose) return;

    try {
      setIsLoading(true);
      await closeShift(shiftIdToClose, actualCash);
      setIsCloseShiftModalOpen(false);
      setIsLoading(false);
      alert('تم إغلاق الوردية بنجاح وتسجيل البيانات');
    } catch (err: any) {
      console.error('Error closing shift:', err);
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`حدث خطأ أثناء إغلاق الوردية:\n${errorMessage}`);
    }
  };

  const handleUpdateItemPrice = async (itemIdx: number, newPrice: number) => {
    if (!selectedInvoice || !selectedInvoice.items) return;

    const updatedItems = [...selectedInvoice.items];
    const item = updatedItems[itemIdx];
    if (!item) return;

    if (item.minSellingPrice && newPrice < item.minSellingPrice) {
      alert(`خطأ: أقل سعر بيع مسموح لهذا المنتج هو ${formatCurrency(item.minSellingPrice)}`);
      return;
    }

    const priceDiff = newPrice - item.price;
    updatedItems[itemIdx] = {
      ...item,
      price: newPrice,
      total: item.quantity * newPrice
    };

    const newTotal = updatedItems.reduce((acc: number, it: any) => acc + (it.total || 0), 0);

    try {
      await updateInvoice(selectedInvoice.id, {
        items: updatedItems,
        total: newTotal,
        subtotal: newTotal
      });
      setSelectedInvoice({ ...selectedInvoice, items: updatedItems, total: newTotal });
      setEditingItemId(null);
    } catch (err: any) { console.error(err); }
  };

  if (renderError) {
    return (
      <div className="p-20 text-center bg-red-50 rounded-[3rem] border-2 border-red-100">
        <h2 className="text-2xl font-black text-red-600 mb-4">حدث خطأ في عرض الصفحة</h2>
        <p className="text-red-400 font-bold mb-6">{renderError}</p>
        <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold">إعادة تحميل</button>
      </div>
    );
  }

  if (!selectedBranchId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-gray-50/50 rounded-[3rem] min-h-[60vh]" dir="rtl">
        <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner">
          <Store className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">إدارة الفرع</h2>
        <p className="text-gray-400 font-medium mb-10 italic">يرجى اختيار الفرع لعرض التقارير والتحكم في الوردية</p>

        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">جاري تحميل الفروع...</p>
          </div>
        ) : (
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
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-20"></div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-900">إدارة فرع {branchWarehouse?.name}</h2>
            <p className="text-gray-400 font-medium">متابعة مبيعات الوردية، الصرف النقدي، وإغلاق اليوم</p>
          </div>
        </div>

        {user?.role === 'ADMIN' && (
          <button onClick={() => setSelectedBranchId('')} className="text-sm font-black text-blue-600 border border-blue-100 px-6 py-3 rounded-xl hover:bg-blue-50 transition-all">تغيير الفرع</button>
        )}
      </div>

      {/* Emergency Shift Cleanup (Only if multiple open shifts exist) */}
      {user?.role === 'ADMIN' && stats.openShifts && stats.openShifts.length > 1 && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-amber-800">
            <X className="w-6 h-6" />
            <div>
              <p className="font-black text-sm">تنبيه: يوجد أكثر من وردية مفتوحة لهذا الفرع!</p>
              <p className="text-sm font-medium">هذا قد يحدث بسبب خطأ تقني. يرجى إغلاق الورديات الزائدة.</p>
            </div>
          </div>
          <div className="flex gap-2">
            {stats.openShifts.map((s: any, idx: number) => (
              <button
                key={s.id}
                onClick={() => handleCloseShift(s.id)}
                className="bg-white border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-sm font-black hover:bg-amber-100 transition-all"
              >
                إغلاق وردية {idx + 1} ({s.id})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Admin Performance Stats */}
      {user?.role === 'ADMIN' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-4 right-4 w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <BarChart3 className="w-5 h-5" />
            </div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">إجمالي مبيعات الفرع (تراكمي)</p>
            <h4 className="text-xl font-black text-gray-900 font-sans">{formatCurrency(stats.branchAllTimeSales)}</h4>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-4 right-4 w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Coins className="w-5 h-5" />
            </div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">إجمالي الأرباح التقديرية</p>
            <h4 className="text-xl font-black text-blue-600 font-sans">{formatCurrency(stats.branchAllTimeProfit)}</h4>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-4 right-4 w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">عدد الفواتير الكلي</p>
            <h4 className="text-xl font-black text-gray-900 font-sans">{branchInvoices.filter(i => i.customerId !== 'EXPENSE').length} فاتورة</h4>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-4 right-4 w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <RotateCcw className="w-5 h-5" />
            </div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">إجمالي المرتجعات</p>
            <h4 className="text-xl font-black text-red-600 font-sans">{formatCurrency(contextInvoices.filter(inv => inv.branchId === selectedBranchId && inv.status === 'RETURNED').reduce((acc, inv) => acc + (inv.total || 0), 0))}</h4>
          </div>
        </div>
      )}

      {!currentShift ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 text-center space-y-4">
          <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto">
            <X className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-gray-900">لا توجد وردية مفتوحة حالياً</h3>
          <p className="text-gray-400 font-medium">يرجى الذهاب إلى صفحة "نقطة البيع" لفتح وردية جديدة للفرع.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Stats Column */}
          <div className="xl:col-span-2 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-4 right-4 w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">إجمالي مبيعات الوردية</p>
                <h4 className="text-3xl font-black text-blue-600 font-sans">{formatCurrency(stats.totalSales)}</h4>
              </div>
              <div className="bg-blue-600 p-8 rounded-[2rem] shadow-xl shadow-blue-100 relative overflow-hidden group text-white">
                <div className="absolute top-4 right-4 w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Store className="w-6 h-6" />
                </div>
                <p className="text-sm font-black text-blue-100 uppercase tracking-widest mb-2">إجمالي مبيعات الفرع اليوم</p>
                <h4 className="text-3xl font-black font-sans">{formatCurrency(stats.branchTodaySales)}</h4>
              </div>
            </div>

            {/* Detailed Products Table */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h5 className="font-black text-gray-900 flex items-center gap-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  سجل فواتير الوردية (المجمعة)
                </h5>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50/30">
                      <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center w-12">م</th>
                      <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">رقم الفاتورة</th>
                      <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">الحالة</th>
                      <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">التاريخ والوقت</th>
                      <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">البيان / المنتجات</th>
                      <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.detailedInvoices.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-bold italic">لا توجد فواتير بعد</td></tr>
                    ) : (
                      stats.detailedInvoices.map((inv: any) => (
                        <tr
                          key={inv.id}
                          onClick={() => setSelectedInvoice(inv)}
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-black text-gray-400 font-sans group-hover:text-blue-600">#{inv.seqNo}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-sans">
                              {inv.id ? String(inv.id).split('-')[1] || String(inv.id) : '---'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-sm font-black px-2 py-1 rounded-full",
                              inv.status === 'RETURNED' ? "bg-red-50 text-red-600"
                                : inv.status === 'PENDING' ? "bg-amber-50 text-amber-600"
                                : inv.status === 'CANCELLED' ? "bg-gray-50 text-gray-600"
                                : "bg-green-50 text-green-600"
                            )}>
                              {inv.status === 'RETURNED' ? 'مرتجع'
                                : inv.status === 'PENDING' ? 'معلقة'
                                : inv.status === 'CANCELLED' ? 'ملغاة'
                                : 'مكتملة'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-gray-900 font-sans tracking-tight">
                                {new Date(inv.createdAt).toLocaleDateString('ar-EG')}
                              </span>
                              <span className="text-sm font-bold text-gray-400 font-sans uppercase">
                                {new Date(inv.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={cn("text-sm font-black", inv.customerId === 'EXPENSE' ? "text-orange-600" : "text-gray-900")}>
                                {inv.customerId === 'EXPENSE' ? (inv.items?.[0]?.name || 'صرف نقدي') : `فاتورة بيع (${inv.items?.length || 0} أصناف)`}
                              </span>
                              {inv.items && inv.items.length > 0 && inv.customerId !== 'EXPENSE' && (
                                <p className="text-sm text-gray-400 font-medium truncate max-w-[200px]">
                                  {inv.items.map((it: any) => it.name).join('، ')}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-left">
                            <span className={cn("text-sm font-black font-sans", inv.customerId === 'EXPENSE' ? "text-orange-600" : "text-blue-600")}>
                              {inv.customerId === 'EXPENSE' ? '-' : ''}{formatCurrency(inv.total)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Cash Management & Actions */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
              <h5 className="text-sm font-black text-gray-900 flex items-center gap-3 mb-4">
                <Banknote className="w-5 h-5 text-orange-500" />
                إدارة الكاش والمصروفات
              </h5>

              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">الكاش المفترض وجوده في الدرج</p>
                <h4 className="text-3xl font-black text-green-600 font-sans">{formatCurrency(stats.expectedCash)}</h4>
                <p className="text-sm text-gray-400 mt-2 italic font-medium">
                  الافتتاحي ({formatCurrency(currentShift?.openingCash || 0)}) + مبيعات الكاش ({formatCurrency(stats.cashSales)})
                  {stats.totalExpenses > 0 && ` - المصروفات (${formatCurrency(stats.totalExpenses)})`}
                </p>
              </div>

              <button
                onClick={() => setIsCashExpenseModalOpen(true)}
                className="w-full flex items-center justify-between p-6 bg-orange-50 text-orange-600 rounded-2xl border-2 border-orange-100 hover:bg-orange-600 hover:text-white transition-all group shadow-sm"
              >
                <span className="font-black">تسجيل صرف نقدي</span>
                <ArrowDownCircle className="w-6 h-6" />
              </button>

              <button
                onClick={() => setIsCloseShiftModalOpen(true)}
                className="w-full bg-red-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-3"
              >
                <X className="w-5 h-5" />
                إغلاق الوردية الحالية
              </button>
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex items-center gap-3">
                <HistoryIcon className="w-5 h-5 text-gray-400" />
                <h5 className="font-black text-gray-900 text-sm">سجل العمليات الأخير</h5>
              </div>
              <div className="p-2 divide-y divide-gray-50">
                {shiftInvoices.length === 0 ? (
                  <div className="p-10 text-center text-gray-300 italic text-sm font-bold">لا توجد عمليات</div>
                ) : (
                  shiftInvoices.slice(0, 10).map((inv: any) => (
                    <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-400 uppercase tracking-widest">#{inv.id ? String(inv.id).split('-')[1] || String(inv.id) : '---'}</span>
                        <span className={cn("text-sm font-black", inv.customerId === 'EXPENSE' ? "text-orange-600" : "text-gray-900")}>
                          {inv.customerId === 'EXPENSE'
                            ? (inv.items?.[0]?.name || 'صرف نقدي')
                            : inv.status === 'PENDING' ? 'فاتورة معلقة' : 'فاتورة بيع'}
                        </span>
                      </div>
                      <span className={cn("text-sm font-black font-sans", inv.customerId === 'EXPENSE' ? "text-orange-600" : "text-blue-600")}>
                        {inv.customerId === 'EXPENSE' ? '-' : '+'}{formatCurrency(inv.total || 0)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recently Received Products Table */}
      {selectedBranchId && (
        <ReceivedProductsTable
          transfers={transfers.filter(t =>
            t.toWarehouseId === selectedBranchId &&
            t.type === 'TRANSFER' &&
            t.status !== 'CANCELLED'
          )}
          formatCurrency={formatCurrency}
          products={products}
        />
      )}
      {/* Full Branch History Table for Admin */}
      {user?.role === 'ADMIN' && (
        <AllBranchSalesTable
          invoices={stats.allBranchInvoices || []}
          setSelectedInvoice={setSelectedInvoice}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Shifts History Table for Admin */}
      {user?.role === 'ADMIN' && (
        <BranchShiftsHistoryTable
          shifts={stats.branchShiftsHistory || []}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Modals copied from POS or shared components */}
      {isCashExpenseModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsCashExpenseModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden" dir="rtl">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
                <ArrowDownCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900">صرف نقدي</h3>
                <p className="text-gray-400 text-sm font-medium">تسجيل مصروف نقدي من الوردية</p>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">المبلغ</label>
                <input type="number" value={cashExpenseAmount || ''} onChange={(e) => setCashExpenseAmount(Number(e.target.value))} placeholder="0.00" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-orange-100 font-black text-2xl text-center" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">البيان / سبب الصرف</label>
                <input type="text" value={cashExpenseNote} onChange={(e) => setCashExpenseNote(e.target.value)} placeholder="مثل: مصاريف شحن، عمولة نظافة..." className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-orange-100 font-bold text-sm" />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setIsCashExpenseModalOpen(false)} className="flex-1 bg-gray-100 text-gray-500 font-black py-4 rounded-2xl hover:bg-gray-200 transition-all">إلغاء</button>
              <button onClick={handleCashExpense} disabled={!cashExpenseAmount || cashExpenseAmount <= 0} className="flex-[2] bg-orange-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-100 hover:bg-orange-700 disabled:opacity-50 transition-all">تأكيد الصرف</button>
            </div>
          </div>
        </div>
      )}

      {isCloseShiftModalOpen && currentShift && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsCloseShiftModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-white rounded-[3rem] p-12 shadow-2xl overflow-hidden" dir="rtl">
            <div className="text-center mb-10">
              <h3 className="text-3xl font-black text-gray-900 mb-2">إغلاق الوردية</h3>
              <p className="text-gray-400 font-medium italic">ملخص مبيعات الوردية وفرز الكاش</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col items-center gap-2">
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest leading-none">مبيعات الكاش</p>
                <p className="text-xl font-black text-green-600">{formatCurrency(stats.cashSales)}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col items-center gap-2">
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest leading-none">مبيعات الفيزا</p>
                <p className="text-xl font-black text-blue-600">{formatCurrency(stats.cardSales)}</p>
              </div>
              <div className="bg-blue-600 p-6 rounded-3xl shadow-xl shadow-blue-100 flex flex-col items-center gap-2 text-white col-span-2">
                <p className="text-sm font-black text-blue-100 uppercase tracking-widest leading-none">الكاش المفترض وجوده (الافتتاحي + المبيعات)</p>
                <p className="text-3xl font-black tracking-tighter">{formatCurrency(stats.expectedCash)}</p>
              </div>
            </div>
            <div className="space-y-3 mb-10">
              <label className="text-sm font-black text-gray-400 uppercase tracking-widest mr-2">الكاش الموجود فعلياً في الدرج (Actual Cash)</label>
              <input type="number" value={actualCash} onChange={(e) => setActualCash(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 outline-none focus:ring-4 focus:ring-blue-100 font-black text-2xl text-center" placeholder="0.00" />
              <div className="flex justify-between items-center px-4 mt-4">
                <span className="text-sm font-bold text-gray-400">العجز / الزيادة (Profit/Loss):</span>
                <span className={cn("text-lg font-black", actualCash === stats.expectedCash ? "text-gray-900" : actualCash > stats.expectedCash ? "text-green-600" : "text-red-600")}>
                  {formatCurrency(actualCash - stats.expectedCash)}
                  {actualCash < stats.expectedCash && <span className="text-sm mr-1">(عجز)</span>}
                  {actualCash > stats.expectedCash && <span className="text-sm mr-1">(زيادة)</span>}
                </span>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsCloseShiftModalOpen(false)} className="flex-1 bg-gray-100 text-gray-400 font-black py-5 rounded-2xl hover:bg-gray-200 transition-all">إلغاء</button>
              <button
                onClick={() => handleCloseShift()}
                className="flex-[2] bg-red-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-3"
              >
                <X className="w-5 h-5" />
                إغلاق الوردية نهائياً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setSelectedInvoice(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Receipt className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">تفاصيل الفاتورة #{selectedInvoice.seqNo}</h3>
                  <p className="text-gray-400 text-sm font-medium">{selectedInvoice.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-3xl border border-gray-100 overflow-x-auto mb-8">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-100/50">
                    <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-200">المنتج</th>
                    <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-center">الكمية</th>
                    <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-center">السعر</th>
                    <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedInvoice.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-white transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-sm text-gray-900">{item.name}</span>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-sm text-gray-500 font-sans">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {user?.role === 'ADMIN' && editingItemId === `${selectedInvoice.id}-${idx}` ? (
                          <div className="flex items-center gap-2 justify-center">
                            <input
                              type="number"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(Number(e.target.value))}
                              className="w-20 px-2 py-1 bg-white border border-blue-200 rounded-lg text-sm font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-100"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateItemPrice(idx, tempPrice)}
                              className="p-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="p-1 bg-gray-200 text-gray-500 rounded-md hover:bg-gray-300 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 group/price">
                            <span className="font-bold text-sm text-gray-400 font-sans">
                              {formatCurrency(item.price)}
                            </span>
                            {user?.role === 'ADMIN' && (
                              <button
                                onClick={() => {
                                  setEditingItemId(`${selectedInvoice.id}-${idx}`);
                                  setTempPrice(item.price);
                                }}
                                className="opacity-0 group-hover/price:opacity-100 p-1 text-blue-400 hover:text-blue-600 transition-all"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-left font-black text-sm text-gray-900 font-sans">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={cn("p-6 rounded-[2rem] text-white", selectedInvoice.status === 'RETURNED' ? "bg-red-600" : "bg-blue-600")}>
                <p className="text-sm font-black text-white/70 uppercase tracking-widest mb-1">إجمالي الفاتورة</p>
                <p className="text-2xl font-black font-sans">{formatCurrency(selectedInvoice.total)}</p>
              </div>
              <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">طريقة الدفع</p>
                <p className="text-xl font-black text-gray-900">{selectedInvoice.paymentMethod === 'cash' ? 'كاش (نقدي)' : 'فيزا (بطاقة)'}</p>
              </div>
            </div>

            {user?.role === 'ADMIN' && selectedInvoice.status !== 'RETURNED' && (
              <div className="grid grid-cols-2 gap-4 mt-8">
                <button
                  onClick={() => handleReturnInvoice(selectedInvoice.id)}
                  className="flex items-center justify-center gap-2 bg-orange-50 text-orange-600 font-black py-5 rounded-2xl border-2 border-orange-100 hover:bg-orange-600 hover:text-white transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  عمل مرتجع (Refund)
                </button>
                <button
                  onClick={() => handleDeleteInvoice(selectedInvoice.id)}
                  className="flex items-center justify-center gap-2 bg-red-50 text-red-600 font-black py-5 rounded-2xl border-2 border-red-100 hover:bg-red-600 hover:text-white transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                  حذف الفاتورة
                </button>
              </div>
            )}

            <button onClick={() => setSelectedInvoice(null)} className="w-full mt-4 bg-gray-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-black transition-all">إغلاق التفاصيل</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AllBranchSalesTable({ invoices, setSelectedInvoice, formatCurrency }: any) {
  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden mt-12">
      <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
        <div>
          <h5 className="font-black text-xl text-gray-900 flex items-center gap-3">
            <HistoryIcon className="w-6 h-6 text-blue-600" />
            سجل مبيعات الفرع الإجمالية (كافة العمليات)
          </h5>
          <p className="text-gray-400 text-sm font-medium mt-1">عرض جميع الفواتير والمصروفات الخاصة بهذا الفرع منذ البداية</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-gray-50/30">
              <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">رقم الفاتورة</th>
              <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">الحالة</th>
              <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">التاريخ والوقت</th>
              <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">البيان والمنتجات</th>
              <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoices.length === 0 ? (
              <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-bold italic">لا توجد سجلات تاريخية بعد</td></tr>
            ) : (
              invoices.map((inv: any) => (
                <tr
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                >
                  <td className="px-8 py-6">
                    <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg font-sans">
                      {inv.id ? String(inv.id).split('-')[1] || String(inv.id) : '---'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={cn(
                      "text-sm font-black px-3 py-1.5 rounded-full",
                      inv.status === 'RETURNED' ? "bg-red-50 text-red-600"
                        : inv.status === 'PENDING' ? "bg-amber-50 text-amber-600"
                        : inv.status === 'CANCELLED' ? "bg-gray-50 text-gray-600"
                        : "bg-green-50 text-green-600"
                    )}>
                      {inv.status === 'RETURNED' ? 'مرتجع'
                        : inv.status === 'PENDING' ? 'معلقة'
                        : inv.status === 'CANCELLED' ? 'ملغاة'
                        : 'مكتملة'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900 font-sans tracking-tight">
                        {new Date(inv.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                      <span className="text-sm font-bold text-gray-400 font-sans uppercase">
                        {new Date(inv.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className={cn("text-sm font-black", inv.customerId === 'EXPENSE' ? "text-orange-600" : "text-gray-900")}>
                        {inv.customerId === 'EXPENSE'
                          ? (inv.items?.[0]?.name || 'صرف نقدي')
                          : inv.status === 'PENDING' ? 'فاتورة معلقة'
                          : inv.status === 'CANCELLED' ? 'فاتورة ملغاة'
                          : `فاتورة بيع (${inv.items?.length || 0} أصناف)`}
                      </span>
                      {inv.items && inv.items.length > 0 && inv.customerId !== 'EXPENSE' && (
                        <p className="text-sm text-gray-400 font-medium truncate max-w-[300px]">
                          {inv.items.map((it: any) => it.name).join('، ')}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-left">
                    <span className={cn("text-sm font-black font-sans", inv.customerId === 'EXPENSE' ? "text-orange-600" : "text-blue-600")}>
                      {inv.customerId === 'EXPENSE' ? '-' : ''}{formatCurrency(inv.total)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BranchShiftsHistoryTable({ shifts, formatCurrency }: any) {
  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden mt-12 mb-20">
      <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
        <div>
          <h5 className="font-black text-xl text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            سجل الورديات المغلقة (Shift History)
          </h5>
          <p className="text-gray-400 text-sm font-medium mt-1">
            متابعة أداء الورديات، المبيعات المحققة، والأرباح
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-right">رقم الوردية</th>
              <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-center">بداية الوردية</th>
              <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-center">نهاية الوردية</th>
              <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-center">الكاشير</th>
              <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-center">إجمالي المبيعات</th>
              <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-left">إجمالي الأرباح</th>
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-8 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
                      <BarChart3 className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-400 font-bold">Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø³Ø¬Ù„ ÙˆØ±Ø¯ÙŠØ§Øª Ù…ØªØ§Ø­ Ø­Ø§Ù„ÙŠØ§Ù‹</p>
                  </div>
                </td>
              </tr>
            ) : (
              shifts.map((s: any) => (
                <tr key={s.id} className="hover:bg-purple-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <span className="text-sm font-black text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg font-sans">
                      {s.id}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900 font-sans tracking-tight">
                        {new Date(s.startDate).toLocaleDateString('ar-EG')}
                      </span>
                      <span className="text-sm font-bold text-gray-400 font-sans uppercase">
                        {new Date(s.startDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900 font-sans tracking-tight">
                        {s.endDate ? new Date(s.endDate).toLocaleDateString('ar-EG') : '---'}
                      </span>
                      <span className="text-sm font-bold text-gray-400 font-sans uppercase">
                        {s.endDate ? new Date(s.endDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '---'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="text-sm font-black font-sans text-gray-900">
                      {s.cashierName || '---'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="text-sm font-black font-sans text-gray-900">
                      {formatCurrency(s.totalSales)}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-left">
                    <span className="text-sm font-black font-sans text-green-600">
                      {formatCurrency(s.totalProfit)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReceivedProductsTable({ transfers, formatCurrency, products }: { transfers: any[], formatCurrency: (val: number) => string, products: any[] }) {
  const [expandedProducts, setExpandedProducts] = React.useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);

  const toggleProduct = (name: string) => {
    setExpandedProducts(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleAcceptTransfer = async (transferId: string) => {
    try {
      setIsUpdating(transferId);
      await updateDoc(doc(db, 'inventory_transactions', transferId), {
        status: 'COMPLETED'
      });
    } catch (error) {
      console.error('Error updating transfer status:', error);
      alert('حدث خطأ أثناء تأكيد الاستلام');
    } finally {
      setIsUpdating(null);
    }
  };

  // Flatten all items from transfers
  const allItems = (transfers || [])
    .flatMap(t => (t.items || []).map((item: any) => ({
      ...item,
      transferId: t.id,
      date: t.createdAt,
      status: t.status
    })))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group items by product name
  const groupedItemsMap = allItems.reduce((acc, item) => {
    const name = item.name || item.productName || 'منتج غير معروف';
    if (!acc[name]) {
      acc[name] = {
        name,
        totalQuantity: 0,
        pendingQuantity: 0,
        latestDate: item.date,
        history: []
      };
    }
    if (item.status === 'COMPLETED') {
      acc[name].totalQuantity += (item.quantity || 0);
    } else if (item.status === 'PENDING') {
      acc[name].pendingQuantity += (item.quantity || 0);
    }
    acc[name].history.push(item);
    return acc;
  }, {} as Record<string, { name: string, totalQuantity: number, pendingQuantity: number, latestDate: any, history: any[] }>);

  const groupedItems = Object.values(groupedItemsMap)
    .sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime())
    .slice(0, 50);

  return (
    <div id="transfers-section" className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-8">
      <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <h5 className="font-black text-gray-900 text-xl tracking-tight">سجل المنتجات المستلمة (وارد الفرع)</h5>
            <p className="text-gray-400 text-sm font-medium">متابعة البضائع المستلمة والواردة من المخزن الرئيسي</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {groupedItems.some(g => g.pendingQuantity > 0) && (
            <div className="bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-black text-amber-600 uppercase tracking-widest">شحنات قادمة</span>
            </div>
          )}
          <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
            <span className="text-sm font-black text-blue-600 uppercase tracking-widest">إجمالي الأصناف: {groupedItems.length}</span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-right">المنتج / الصنف</th>
              <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-right">الكمية بالمخزن</th>
              <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-right">آخر استلام</th>
              <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-center w-24">التفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {groupedItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-8 py-16 text-center text-gray-300 italic text-sm font-bold">لا توجد منتجات مستلمة حالياً</td>
              </tr>
            ) : (
              groupedItems.map((group, idx) => (
                <React.Fragment key={group.name}>
                  <tr
                    className={cn(
                      "hover:bg-blue-50/30 transition-colors group cursor-pointer",
                      expandedProducts[group.name] && "bg-blue-50/20"
                    )}
                    onClick={() => toggleProduct(group.name)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-sm font-black text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900">{group.name}</p>
                          {group.pendingQuantity > 0 && (
                            <span className="text-sm font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                              <Truck className="w-3 h-3" />
                              يوجد {group.pendingQuantity} قطعة قيد النقل
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                          {group.totalQuantity} قطعة
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-900 font-sans">{new Date(group.latestDate).toLocaleDateString('ar-EG')}</span>
                        <span className="text-sm text-gray-400 font-bold">{new Date(group.latestDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                          {expandedProducts[group.name] ? (
                            <ChevronUp className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                  {expandedProducts[group.name] && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={4} className="px-8 py-6">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between mb-1 px-2">
                            <span className="text-sm font-black text-gray-400 uppercase tracking-widest">تاريخ العمليات (History)</span>
                          </div>
                          {group.history.map((item, hIdx) => (
                            <div key={`${item.transferId}-${hIdx}`} className={cn(
                              "bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 transition-all",
                              item.status === 'PENDING' ? "border-amber-200 bg-amber-50/10" : "border-blue-100 hover:border-blue-300"
                            )}>
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black",
                                  item.status === 'PENDING' ? "bg-amber-100 text-amber-600" : "bg-gray-50 text-gray-400"
                                )}>
                                  {hIdx + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-gray-900 flex items-center gap-2">
                                    رقم الشحنة: <span className="font-mono text-blue-600 text-sm bg-blue-50 px-1.5 py-0.5 rounded">{item.transferId}</span>
                                    {item.status === 'PENDING' && (
                                      <span className="bg-amber-100 text-amber-700 text-sm px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                        <Truck className="w-3 h-3" />
                                        قيد النقل
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-sm text-gray-400 font-bold mt-0.5">
                                    تاريخ الإرسال: {new Date(item.date).toLocaleDateString('ar-EG')} | {new Date(item.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-4 md:gap-8 items-center w-full md:w-auto">
                                <div className="text-center">
                                  <p className="text-sm font-black text-gray-400 uppercase tracking-tighter mb-1">الكمية</p>
                                  <span className="text-sm font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{item.quantity} قطعة</span>
                                </div>

                                {item.status === 'PENDING' ? (
                                  <button
                                    disabled={isUpdating === item.transferId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAcceptTransfer(item.transferId);
                                    }}
                                    className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95 disabled:opacity-50"
                                  >
                                    {isUpdating === item.transferId ? (
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    تأكيد الاستلام
                                  </button>
                                ) : (
                                  <>
                                    <div className="text-center">
                                      <p className="text-sm font-black text-gray-400 uppercase tracking-tighter mb-1">سعر الوحدة</p>
                                      <span className="text-sm font-black text-gray-900 font-sans">{formatCurrency(item.price || 0)}</span>
                                    </div>

                                    {(() => {
                                      const product = products.find(p => p.id === item.productId || p.name === (item.name || item.productName));
                                      const sPrice = product?.sellingPrice || (item.price * 1.25);
                                      return (
                                        <>
                                          <div className="text-center">
                                            <p className="text-sm font-black text-blue-400 uppercase tracking-tighter mb-1">سعر البيع</p>
                                            <span className="text-sm font-black text-blue-600 font-sans">{formatCurrency(sPrice)}</span>
                                          </div>
                                          <div className="text-center">
                                            <p className="text-sm font-black text-orange-400 uppercase tracking-tighter mb-1">سعر الربع</p>
                                            <span className="text-sm font-black text-orange-600 font-sans">{formatCurrency(sPrice / 4)}</span>
                                          </div>
                                        </>
                                      );
                                    })()}

                                    <div className="text-left min-w-[100px]">
                                      <p className="text-sm font-black text-gray-400 uppercase tracking-tighter mb-1">الإجمالي</p>
                                      <span className="text-sm font-black text-green-600 font-sans">{formatCurrency((item.price || 0) * (item.quantity || 0))}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


