import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ArrowDownCircle,
  Package,
  History as HistoryIcon,
  Banknote,
  Plus,
  Minus,
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
  CheckCircle2,
  Smartphone,
  QrCode
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { usePOS } from '../context/POSContext';
import { formatCurrency, cn } from '../lib/utils';
import { Order, Shift, Warehouse } from '../types';
import { useSearchParams } from 'react-router-dom';
import { useMainStoreSettings } from '../hooks/useMainStoreSettings';

export default function BranchManagement() {
  const { user } = useAuth();
  const { getOpenShift, closeShift, addInvoice, updateInvoice, deleteInvoice, invoices: contextInvoices, shifts: contextShifts } = usePOS();
  const { settings } = useMainStoreSettings();

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
  const [showReturnPanel, setShowReturnPanel] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [salesReportModal, setSalesReportModal] = useState<{ title: string; invoices: any[] } | null>(null);

  useEffect(() => {
    setShowReturnPanel(false);
    setReturnQuantities({});
  }, [selectedInvoice]);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [products, setProducts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  // Fetch Customers
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
        setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
    } catch (e) { console.error(e); }
  }, []);

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
    const completedShiftInvoices = shiftInvoices.filter(inv => inv.status === 'COMPLETED' || inv.status === 'PARTIALLY_RETURNED' || !inv.status);
    const pendingShiftInvoices = shiftInvoices.filter(inv => inv.status === 'PENDING');

    // Separate Sales and Expenses for the shift (only completed sales should count)
    const salesInvoices = completedShiftInvoices.filter(inv => inv && inv.customerId !== 'EXPENSE');
    stats.salesInvoices = salesInvoices;
    const expenseInvoices = completedShiftInvoices.filter(inv => inv && inv.customerId === 'EXPENSE');

    stats.cashSales = salesInvoices.filter(inv => inv && inv.paymentMethod === 'cash').reduce((acc, inv) => acc + (inv.total || 0), 0);
    stats.cardSales = salesInvoices.filter(inv => inv && (inv.paymentMethod === 'visa' || inv.paymentMethod === 'vodafone' || inv.paymentMethod === 'instapay')).reduce((acc, inv) => acc + (inv.total || 0), 0);
    stats.totalSales = stats.cashSales + stats.cardSales;

    stats.totalExpenses = expenseInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);

    stats.pendingInvoices = pendingShiftInvoices;

    // Expected Cash = Opening + Cash Sales - Expenses
    stats.expectedCash = currentShift ? (currentShift.openingCash || 0) + stats.cashSales - stats.totalExpenses : 0;

    // Today's Branch Sales (Filtered for specific branch and not including expenses)
    branchInvoices = contextInvoices.filter(inv => inv && inv.branchId === selectedBranchId && (inv.status === 'COMPLETED' || inv.status === 'PARTIALLY_RETURNED' || !inv.status) && inv.customerId !== 'EXPENSE');

    const todayBranchInvoices = branchInvoices.filter(inv => {
      if (!inv || !inv.createdAt) return false;
      const invDate = new Date(inv.createdAt);
      if (isNaN(invDate.getTime())) return false;
      return invDate.toDateString() === new Date().toDateString();
    });

    stats.branchTodaySales = todayBranchInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
    stats.todayBranchInvoices = todayBranchInvoices;

    // Admin Cumulative Stats
    stats.branchAllTimeSales = branchInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);

    stats.branchAllTimeProfit = branchInvoices.reduce((acc, inv) => {
      const invoiceProfit = (inv.items || []).reduce((pAcc: number, item: any) => {
        const product = products.find(p => p.id === item.productId);
        const cost = product?.costPrice || 0;
        const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
        const netTotal = (item.price || 0) * netQty;
        return pAcc + (netTotal - (netQty * cost));
      }, 0);
      return acc + invoiceProfit;
    }, 0);

    stats.allBranchInvoices = [...contextInvoices.filter(inv => inv && inv.branchId === selectedBranchId)]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Shifts History
    const closedShifts = contextShifts.filter(s => s.branchId === selectedBranchId && s.status === 'CLOSED');
    stats.branchShiftsHistory = closedShifts.map(shift => {
      const shiftInvoices = contextInvoices.filter(inv => inv.shiftId === shift.id && (inv.status === 'COMPLETED' || inv.status === 'PARTIALLY_RETURNED' || !inv.status));
      const totalSales = shiftInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
      const totalProfit = shiftInvoices.reduce((acc, inv) => {
        const invProfit = (inv.items || []).reduce((pAcc: number, item: any) => {
          const product = products.find(p => p.id === item.productId);
          const cost = product?.costPrice || 0;
          const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
          const netTotal = (item.price || 0) * netQty;
          return pAcc + (netTotal - (netQty * cost));
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
        const qty = (item.quantity || 0) - (item.returnedQuantity || 0);
        const lineTotal = (item.price || 0) * qty;
        acc[key].quantity += qty;
        acc[key].total += lineTotal;
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
      items: [{ productId: 'EXPENSE', name: cashExpenseNote || 'صرف نقدي', quantity: 1, price: cashExpenseAmount, originalPrice: cashExpenseAmount, discount: 0, total: cashExpenseAmount }],
      subtotal: cashExpenseAmount,
      tax: 0,
      discount: 0,
      total: cashExpenseAmount,
      paymentMethod: 'cash',
      cashierId: user.uid,
      shiftId: currentShift.id,
      branchId: selectedBranchId,
      createdAt: new Date().toISOString(),
      customerId: 'EXPENSE',
      status: 'COMPLETED'
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

  const handlePrintReceipt = (inv: Order) => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) {
      alert('تم منع فتح النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة.');
      return;
    }

    const itemsHtml = (inv.items || []).map(item => `
      <tr style="border-bottom: 1px dashed #eee;">
        <td style="padding: 6px 0; text-align: right; font-weight: bold;">${item.name}</td>
        <td style="padding: 6px 0; text-align: center;">${item.quantity}</td>
        <td style="padding: 6px 0; text-align: left;">${formatCurrency(item.price)}</td>
      </tr>
    `).join('');

    const content = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>فاتورة مبسطة - ${inv.id}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { 
            font-family: 'Cairo', system-ui, -apple-system, sans-serif; 
            margin: 0; 
            padding: 8mm 5mm; 
            width: 70mm; 
            font-size: 11px; 
            line-height: 1.4; 
            color: #000;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .header { margin-bottom: 6mm; }
          .store-name { font-size: 16px; font-weight: 900; margin: 0 0 2mm 0; }
          .divider { border-top: 1px dashed #000; margin: 4mm 0; }
          table { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 11px; }
          .total-row { font-size: 12px; font-weight: 900; }
          .barcode-container { display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 6mm; }
          .barcode-container svg { max-width: 60mm; height: auto; }
          .footer-note { font-size: 9px; margin-top: 4mm; text-align: center; }
        </style>
      </head>
      <body>
        <div class="text-center header">
          <h2 class="store-name">${settings?.storeName || 'مؤسسة بصمة'}</h2>
          <div>فرع: ${branchWarehouse?.name || 'الفرع'}</div>
          <div>رقم الفاتورة: ${inv.id}</div>
          <div>التاريخ: ${new Date(inv.createdAt).toLocaleString('ar-EG')}</div>
          <div>الكاشير: ${user?.name || 'نظام البيع'}</div>
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr style="border-bottom: 1px solid #000; font-weight: bold;">
              <th style="text-align: right; padding-bottom: 4px;">الصنف</th>
              <th style="text-align: center; padding-bottom: 4px;">الكمية</th>
              <th style="text-align: left; padding-bottom: 4px;">السعر</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div style="space-y-1.5">
          <div style="display: flex; justify-content: space-between;">
            <span>المجموع الفرعي:</span>
            <span>${formatCurrency(inv.subtotal)}</span>
          </div>
          ${inv.tax ? `
          <div style="display: flex; justify-content: space-between;">
            <span>الضريبة (${settings?.taxRate || 0}%):</span>
            <span>${formatCurrency(inv.tax)}</span>
          </div>
          ` : ''}
          <div class="total-row" style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span>المجموع النهائي:</span>
            <span>${formatCurrency(inv.total)}</span>
          </div>
        </div>

        <div style="margin-top: 4mm; font-size: 10px;">
          <span>طريقة الدفع:</span>
          <span class="bold">${
            inv.paymentMethod === 'cash' ? 'نقداً (كاش)' : 
            inv.paymentMethod === 'visa' ? 'بطاقة (فيزا)' : 
            inv.paymentMethod === 'vodafone' ? 'فودافون كاش' : 
            inv.paymentMethod === 'instapay' ? 'انستا باي' : 
            'آجل (على الحساب)'
          }</span>
        </div>

        <div class="divider"></div>

        <div class="barcode-container" id="printable-barcode-wrapper">
          <svg id="print-barcode-svg"></svg>
        </div>

        <div class="footer-note">
          شكراً لتسوقكم معنا!
        </div>

        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <script>
          window.onload = function() {
            try {
              JsBarcode("#print-barcode-svg", "${inv.id}", {
                format: "CODE128",
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 10,
                margin: 0
              });
            } catch (e) {
              console.error("Barcode generation failed in print window:", e);
            }
            setTimeout(function() {
              window.print();
              window.close();
            }, 350);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const getWhatsAppUrl = (phone: string, invoice: any) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '2' + cleaned;
    } else if (cleaned.length === 10 && !cleaned.startsWith('0') && !cleaned.startsWith('2')) {
      cleaned = '20' + cleaned;
    }
    const storeName = settings?.storeName || 'متجرنا';
    const dateStr = new Date(invoice.createdAt).toLocaleDateString('ar-EG');
    const itemsText = (invoice.items || []).map((item: any) => `- ${item.name} (الكمية: ${item.quantity})`).join('\n');
    const message = `مرحباً ${customers.find(c => c.id === invoice.customerId)?.name || ''}،\nشكراً لتسوقك معنا في ${storeName}.\n\nتفاصيل فاتورتك رقم: ${invoice.id}\nالتاريخ: ${dateStr}\n\nالأصناف:\n${itemsText}\n\nالإجمالي النهائي: ${formatCurrency(invoice.total)}\nطريقة الدفع: ${
      invoice.paymentMethod === 'cash' ? 'نقدي' : 
      invoice.paymentMethod === 'visa' ? 'بطاقة ائتمان' : 
      invoice.paymentMethod === 'vodafone' ? 'فودافون كاش' : 
      invoice.paymentMethod === 'instapay' ? 'انستا باي' : 
      'آجل'
    }\n\nيسعدنا دائماً خدمتكم!`;
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  };

  const handlePartialReturn = async () => {
    if (!selectedInvoice) return;
    if (Object.keys(returnQuantities).length === 0) return;

    if (window.confirm('هل أنت متأكد من إرجاع البنود والكميات المحددة للمخزون؟')) {
      try {
        let returnedSubtotal = 0;
        const updatedItems = selectedInvoice.items.map((item: any) => {
          const retQty = returnQuantities[item.productId] || 0;
          if (retQty > 0) {
            const newRetQty = (item.returnedQuantity || 0) + retQty;
            returnedSubtotal += retQty * (item.price || 0);
            return { ...item, returnedQuantity: newRetQty };
          }
          return item;
        });

        const ratio = selectedInvoice.subtotal > 0 ? (selectedInvoice.tax / selectedInvoice.subtotal) : 0;
        const returnedTax = returnedSubtotal * ratio;
        const returnedTotal = returnedSubtotal + returnedTax;

        const newSubtotal = Math.max(0, selectedInvoice.subtotal - returnedSubtotal);
        const newTax = Math.max(0, selectedInvoice.tax - returnedTax);
        const newTotal = Math.max(0, selectedInvoice.total - returnedTotal);

        const isFullyReturned = updatedItems.every((item: any) => (item.quantity || 0) === (item.returnedQuantity || 0));
        const newStatus = isFullyReturned ? 'RETURNED' : 'PARTIALLY_RETURNED';

        const updates = {
          items: updatedItems,
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal,
          status: newStatus as any
        };

        await updateInvoice(selectedInvoice.id, updates);
        setSelectedInvoice({ ...selectedInvoice, ...updates });
        alert('تم إرجاع البنود المحددة بنجاح وتحديث الفاتورة والمخزون');
        setShowReturnPanel(false);
      } catch (err) {
        console.error("Error making partial return:", err);
        alert("حدث خطأ أثناء معالجة المرتجع الجزئي.");
      }
    }
  };

  const handleReturnInvoice = async (invoiceId: string) => {
    const canReturn = user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_make_return;
    if (!canReturn) {
      alert('عذراً، ليس لديك صلاحية عمل مرتجع للفاتورة.');
      return;
    }
    try {
      await updateInvoice(invoiceId, { status: 'RETURNED' });
      alert('تم إرجاع الفاتورة بنجاح وتحديث الرصيد');
      setSelectedInvoice((prev: any) => prev ? { ...prev, status: 'RETURNED' } : null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء إرجاع الفاتورة');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    const canDelete = user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_delete_invoice;
    if (!canDelete) {
      alert('عذراً، ليس لديك صلاحية حذف الفاتورة.');
      return;
    }
    const confirmCancel = window.confirm('هل أنت متأكد من رغبتك في حذف/إلغاء هذه الفاتورة؟');
    if (!confirmCancel) return;
    try {
      await deleteInvoice(invoiceId);
      alert('تم إلغاء/حذف الفاتورة بنجاح');
      setSelectedInvoice(null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء إلغاء الفاتورة');
    }
  };

  const printSalesReport = (title: string, invoices: any[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('الرجاء السماح بالنوافذ المنبثقة لطباعة التقرير');
      return;
    }

    const totalSales = invoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
    const cashSales = invoices.filter(inv => inv.paymentMethod === 'cash').reduce((acc, inv) => acc + (inv.total || 0), 0);
    const cardSales = invoices.filter(inv => inv.paymentMethod === 'visa' || inv.paymentMethod === 'vodafone' || inv.paymentMethod === 'instapay').reduce((acc, inv) => acc + (inv.total || 0), 0);

    const rows = invoices.map((inv, idx) => `
      <tr>
        <td style="text-align: center; border: 1px solid #e2e8f0; padding: 12px; font-size: 14px;">${idx + 1}</td>
        <td style="text-align: center; border: 1px solid #e2e8f0; padding: 12px; font-size: 14px; font-family: monospace; font-weight: bold; color: #2b6cb0;">
          ${inv.id || '---'}
        </td>
        <td style="border: 1px solid #e2e8f0; padding: 12px; font-size: 14px;">
          ${new Date(inv.createdAt).toLocaleDateString('ar-EG')} - 
          ${new Date(inv.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td style="border: 1px solid #e2e8f0; padding: 12px; font-size: 14px;">
          ${inv.items?.map((it: any) => `${it.name} (${it.quantity})`).join('، ') || '---'}
        </td>
        <td style="text-align: center; border: 1px solid #e2e8f0; padding: 12px; font-size: 14px;">${
          inv.paymentMethod === 'cash' ? 'نقدي' :
          inv.paymentMethod === 'visa' ? 'فيزا' :
          inv.paymentMethod === 'vodafone' ? 'فودافون كاش' :
          inv.paymentMethod === 'instapay' ? 'انستا باي' :
          'آجل'
        }</td>
        <td style="text-align: left; border: 1px solid #e2e8f0; padding: 12px; font-size: 14px; font-weight: bold;">${formatCurrency(inv.total)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          
          @page {
            size: letter;
            margin: 15mm;
          }
          
          body {
            font-family: 'Cairo', sans-serif;
            margin: 0;
            padding: 0;
            color: #1e293b;
            direction: rtl;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .letterhead {
            border-bottom: 3px double #cbd5e1;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          
          .logo-area {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          
          .logo-icon {
            width: 48px;
            height: 48px;
            background-color: #2563eb;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 900;
            font-size: 24px;
          }
          
          .store-details h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 900;
            color: #1e3a8a;
          }
          
          .store-details p {
            margin: 4px 0 0 0;
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
          }
          
          .report-meta {
            text-align: left;
            font-size: 13px;
            color: #475569;
            line-height: 1.6;
          }
          
          .report-title-container {
            text-align: center;
            margin-bottom: 25px;
          }
          
          .report-title-container h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 900;
            color: #1e293b;
            display: inline-block;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 5px;
          }
          
          .stats-flex {
            display: flex;
            gap: 20px;
            margin-bottom: 35px;
            width: 100%;
          }
          
          .stat-card {
            flex: 1;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 15px;
            background-color: #f8fafc;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            text-align: center;
          }
          
          .stat-card-title {
            font-size: 12px;
            font-weight: 700;
            color: #64748b;
            margin-bottom: 6px;
          }
          
          .stat-card-value {
            font-size: 20px;
            font-weight: 900;
            color: #0f172a;
          }
          
          .stat-blue {
            border-top: 4px solid #2563eb;
            background-color: #f0f7ff;
          }
          
          .stat-green {
            border-top: 4px solid #16a34a;
            background-color: #f0fdf4;
          }
          
          .stat-purple {
            border-top: 4px solid #7c3aed;
            background-color: #faf5ff;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          
          th, td {
            border: 1px solid #e2e8f0;
            padding: 10px 12px;
            text-align: right;
            font-size: 12px;
            line-height: 1.5;
          }
          
          th {
            background-color: #f1f5f9;
            color: #1e293b;
            font-weight: 700;
            border-bottom: 2px solid #cbd5e1;
          }
          
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          
          .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            background: white;
          }
          
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="letterhead">
          <div class="logo-area">
            <div class="logo-icon">${settings?.storeName ? settings.storeName.trim().charAt(0).toUpperCase() : 'F'}</div>
            <div class="store-details">
              <h2>${settings?.storeName || 'NEZAM PRO'}</h2>
              <p>نظام إدارة الفروع ونقاط البيع الذكي (NEZAM PRO)</p>
            </div>
          </div>
          <div class="report-meta">
            <div><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
            <div><strong>الوقت:</strong> ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>الفرع:</strong> ${branchWarehouse?.name || '---'}</div>
          </div>
        </div>
      
        <div class="report-title-container">
          <h1>${title}</h1>
        </div>
      
        <div class="stats-flex">
          <div class="stat-card stat-blue">
            <div class="stat-card-title">إجمالي المبيعات</div>
            <div class="stat-card-value">${formatCurrency(totalSales)}</div>
          </div>
          <div class="stat-card stat-green">
            <div class="stat-card-title">المبيعات النقدية (كاش)</div>
            <div class="stat-card-value">${formatCurrency(cashSales)}</div>
          </div>
          <div class="stat-card stat-purple">
            <div class="stat-card-title">مبيعات البطاقة (فيزا)</div>
            <div class="stat-card-value">${formatCurrency(cardSales)}</div>
          </div>
        </div>
      
        <table>
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">م</th>
              <th style="width: 15%; text-align: center;">رقم الفاتورة</th>
              <th style="width: 25%;">التاريخ والوقت</th>
              <th style="width: 35%;">الأصناف</th>
              <th style="width: 10%; text-align: center;">طريقة الدفع</th>
              <th style="width: 10%; text-align: left;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows : '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 30px;">لا توجد مبيعات في هذه الفترة</td></tr>'}
          </tbody>
        </table>
      
        <div class="footer">
          <p>تم توليد هذا التقرير تلقائياً من نظام NEZAM PRO - صفحة إدارة الفروع</p>
        </div>
      
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-shadow">
            <div className="w-12 h-12 shrink-0 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-tight mb-1">إجمالي مبيعات الفرع (تراكمي)</p>
              <h4 className="text-lg font-black text-gray-900 font-sans leading-tight">{formatCurrency(stats.branchAllTimeSales)}</h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-shadow">
            <div className="w-12 h-12 shrink-0 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Coins className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-tight mb-1">إجمالي الأرباح التقديرية</p>
              <h4 className="text-lg font-black text-blue-600 font-sans leading-tight">{formatCurrency(stats.branchAllTimeProfit)}</h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-shadow">
            <div className="w-12 h-12 shrink-0 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-tight mb-1">عدد الفواتير الكلي</p>
              <h4 className="text-lg font-black text-gray-900 font-sans leading-tight">{branchInvoices.filter(i => i.customerId !== 'EXPENSE').length} فاتورة</h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-shadow">
            <div className="w-12 h-12 shrink-0 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-tight mb-1">إجمالي المرتجعات</p>
              <h4 className="text-lg font-black text-red-600 font-sans leading-tight">{formatCurrency(contextInvoices.filter(inv => inv.branchId === selectedBranchId && inv.status === 'RETURNED').reduce((acc, inv) => acc + (inv.total || 0), 0))}</h4>
            </div>
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
              <div
                onClick={() => setSalesReportModal({ title: 'تقرير مبيعات الوردية', invoices: stats.salesInvoices || [] })}
                className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 group hover:shadow-md hover:border-blue-200 cursor-pointer transition-all active:scale-[0.98]"
              >
                <div className="w-14 h-14 shrink-0 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-tight mb-1">إجمالي مبيعات الوردية</p>
                  <h4 className="text-2xl font-black text-blue-600 font-sans leading-tight">{formatCurrency(stats.totalSales)}</h4>
                </div>
              </div>
              <div
                onClick={() => setSalesReportModal({ title: 'تقرير مبيعات الفرع اليوم', invoices: stats.todayBranchInvoices || [] })}
                className="bg-blue-600 p-6 rounded-[2rem] shadow-xl shadow-blue-100 flex items-center gap-4 group text-white hover:bg-blue-700 cursor-pointer transition-all active:scale-[0.98]"
              >
                <div className="w-14 h-14 shrink-0 bg-white/15 text-white rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Store className="w-7 h-7" />
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-xs font-black text-blue-100 uppercase tracking-widest leading-tight mb-1">إجمالي مبيعات الفرع اليوم</p>
                  <h4 className="text-2xl font-black font-sans leading-tight">{formatCurrency(stats.branchTodaySales)}</h4>
                </div>
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
                              {inv.id || '---'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-sm font-black px-2 py-1 rounded-full",
                              inv.status === 'RETURNED' ? "bg-red-50 text-red-600"
                                : inv.status === 'PARTIALLY_RETURNED' ? "bg-orange-50 text-orange-600"
                                : inv.status === 'PENDING' ? "bg-amber-50 text-amber-600"
                                : inv.status === 'CANCELLED' ? "bg-gray-50 text-gray-600"
                                : "bg-green-50 text-green-600"
                            )}>
                              {inv.status === 'RETURNED' ? 'مرتجع كامل'
                                : inv.status === 'PARTIALLY_RETURNED' ? 'مرتجع جزئي'
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
                        <span className="text-sm font-black text-gray-400 uppercase tracking-widest">#{inv.id || '---'}</span>
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
          <div className="erp-modal max-w-md" dir="rtl">
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
          <div className="erp-modal max-w-xl" dir="rtl">
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setSelectedInvoice(null)} />
          <div className="erp-modal max-w-2xl" dir="rtl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Receipt className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">تفاصيل الفاتورة #{selectedInvoice.id}</h3>
                  <p className="text-gray-400 text-sm font-medium">الرمز التعريفي للفاتورة</p>
                </div>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {showReturnPanel ? (
              <div className="space-y-4 border-2 border-red-100 p-5 rounded-[2rem] bg-red-50/20 mb-8" dir="rtl">
                <h5 className="font-black text-red-600 mb-2 flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                  تحديد الأصناف المراد إرجاعها
                </h5>
                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
                  {(selectedInvoice.items || []).map((item: any, idx: number) => {
                    const maxReturn = (item.quantity || 0) - (item.returnedQuantity || 0);
                    const isChecked = returnQuantities[item.productId] !== undefined;
                    const returnQty = returnQuantities[item.productId] || 0;

                    return (
                      <div key={idx} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm" dir="rtl">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            disabled={maxReturn <= 0}
                            checked={isChecked && maxReturn > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setReturnQuantities(prev => ({ ...prev, [item.productId]: 1 }));
                              } else {
                                setReturnQuantities(prev => {
                                  const next = { ...prev };
                                  delete next[item.productId];
                                  return next;
                                });
                              }
                            }}
                            className="w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-100 cursor-pointer disabled:opacity-40"
                          />
                          <div className="text-right">
                            <p className="font-black text-sm text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-400 font-bold">
                              المباع: <span className="font-sans text-gray-900">{item.quantity}</span> 
                              {item.returnedQuantity > 0 && (
                                <> | تم إرجاع: <span className="font-sans text-red-500 font-black">{item.returnedQuantity}</span></>
                              )}
                            </p>
                          </div>
                        </div>
                        {isChecked && maxReturn > 0 ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setReturnQuantities(prev => ({ ...prev, [item.productId]: Math.max(1, returnQty - 1) }))}
                              className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-gray-100 border border-gray-200 active:scale-95"
                            >
                              <Minus className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            <span className="text-base font-black font-sans w-6 text-center">{returnQty}</span>
                            <button
                              type="button"
                              onClick={() => setReturnQuantities(prev => ({ ...prev, [item.productId]: Math.min(maxReturn, returnQty + 1) }))}
                              className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-gray-100 border border-gray-200 active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-gray-400">
                            {maxReturn <= 0 ? 'مسترجع بالكامل' : 'غير محدد'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex gap-3 pt-3 border-t border-gray-100 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const allReturn: Record<string, number> = {};
                      (selectedInvoice.items || []).forEach((item: any) => {
                        const maxReturn = (item.quantity || 0) - (item.returnedQuantity || 0);
                        if (maxReturn > 0) {
                          allReturn[item.productId] = maxReturn;
                        }
                      });
                      setReturnQuantities(allReturn);
                    }}
                    className="text-xs font-black text-red-600 hover:text-red-700 bg-red-50/60 px-3 py-2 rounded-xl border border-red-100 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    تحديد كل المتبقي
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnQuantities({})}
                    className="text-xs font-black text-gray-500 hover:text-gray-600 bg-gray-100 px-3 py-2 rounded-xl border border-gray-200 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowReturnPanel(false)}
                    className="flex-1 bg-gray-100 text-gray-500 font-black py-4 rounded-2xl hover:bg-gray-200 transition-all cursor-pointer text-center text-sm"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    disabled={Object.keys(returnQuantities).length === 0}
                    onClick={handlePartialReturn}
                    className="flex-[2] bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all disabled:opacity-40 disabled:pointer-events-none text-sm cursor-pointer text-center shadow-lg shadow-red-200"
                  >
                    تأكيد إرجاع البنود المحددة
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                            {item.returnedQuantity > 0 && (
                              <span className="block text-xs text-red-500 font-black">
                                (مرتجع: {item.returnedQuantity})
                              </span>
                            )}
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
                            {formatCurrency((item.price || 0) * ((item.quantity || 0) - (item.returnedQuantity || 0)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={cn(
                    "p-6 rounded-[2rem] text-white transition-colors", 
                    selectedInvoice.status === 'RETURNED' ? "bg-red-600" 
                      : selectedInvoice.status === 'PARTIALLY_RETURNED' ? "bg-orange-600" 
                      : "bg-blue-600"
                  )}>
                    <p className="text-sm font-black text-white/70 uppercase tracking-widest mb-1">إجمالي الفاتورة</p>
                    <p className="text-2xl font-black font-sans">{formatCurrency(selectedInvoice.total)}</p>
                  </div>
                  <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">طريقة الدفع</p>
                    <p className="text-xl font-black text-gray-900">
                      {selectedInvoice.paymentMethod === 'cash' ? 'كاش (نقدي)' :
                       selectedInvoice.paymentMethod === 'visa' ? 'فيزا (بطاقة)' :
                       selectedInvoice.paymentMethod === 'vodafone' ? 'فودافون كاش' :
                       selectedInvoice.paymentMethod === 'instapay' ? 'انستا باي' :
                       'آجل (على الحساب)'}
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-between">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handlePrintReceipt(selectedInvoice)}
                      className="px-6 py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/10 active:scale-95 cursor-pointer text-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" rx="1" />
                      </svg>
                      طباعة الفاتورة
                    </button>

                    {/* WhatsApp button */}
                    {(() => {
                      const detailCustomer = customers.find(c => c.id === selectedInvoice.customerId);
                      if (detailCustomer && detailCustomer.phone) {
                        return (
                          <a
                            href={getWhatsAppUrl(detailCustomer.phone, selectedInvoice)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-95 cursor-pointer text-sm"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="w-4 h-4" viewBox="0 0 16 16">
                              <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.949h.004c4.368 0 7.927-3.561 7.928-7.927a7.89 7.89 0 0 0-2.325-5.596l-.001-.005zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.625-4.899c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                            </svg>
                            إرسال WhatsApp
                          </a>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {selectedInvoice.status !== 'RETURNED' && (user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_make_return || user.permissions.pos_delete_invoice) && (
                    <div className="flex gap-3">
                      {(user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_make_return) && (
                        <button
                          onClick={() => {
                            const canReturn = user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_make_return;
                            if (!canReturn) {
                              alert('عذراً، ليس لديك صلاحية عمل مرتجع لهذه الفاتورة.');
                              return;
                            }
                            setShowReturnPanel(true);
                          }}
                          className="flex items-center justify-center gap-2 bg-orange-50 text-orange-600 font-black px-6 py-3 rounded-2xl border-2 border-orange-100 hover:bg-orange-600 hover:text-white transition-all active:scale-[0.98] text-sm"
                        >
                          <RotateCcw className="w-4 h-4" />
                          عمل مرتجع (Refund)
                        </button>
                      )}
                      {(user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_delete_invoice) && (
                        <button
                          onClick={() => handleDeleteInvoice(selectedInvoice.id)}
                          className="flex items-center justify-center gap-2 bg-red-50 text-red-600 font-black px-6 py-3 rounded-2xl border-2 border-red-100 hover:bg-red-600 hover:text-white transition-all active:scale-[0.98] text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          حذف الفاتورة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <button onClick={() => setSelectedInvoice(null)} className="w-full mt-4 bg-gray-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-black transition-all">إغلاق التفاصيل</button>
          </div>
        </div>
      )}

      {/* Sales Report Modal */}
      {salesReportModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setSalesReportModal(null)} />
          <div className="erp-modal max-w-4xl w-full max-h-[85vh] flex flex-col" dir="rtl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Receipt className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">{salesReportModal.title}</h3>
                  <p className="text-gray-400 text-sm font-medium">الفرع: {branchWarehouse?.name || '---'}</p>
                </div>
              </div>
              <button onClick={() => setSalesReportModal(null)} className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl">
                  <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-1">إجمالي المبيعات</p>
                  <h4 className="text-2xl font-black text-blue-700 font-sans">
                    {formatCurrency(salesReportModal.invoices.reduce((acc, inv) => acc + (inv.total || 0), 0))}
                  </h4>
                </div>
                <div className="bg-green-50/50 border border-green-100 p-5 rounded-2xl">
                  <p className="text-xs font-black text-green-500 uppercase tracking-widest mb-1">نقدي (كاش)</p>
                  <h4 className="text-2xl font-black text-green-700 font-sans">
                    {formatCurrency(salesReportModal.invoices.filter(i => i.paymentMethod === 'cash').reduce((acc, inv) => acc + (inv.total || 0), 0))}
                  </h4>
                </div>
                <div className="bg-purple-50/50 border border-purple-100 p-5 rounded-2xl">
                  <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-1">دفع إلكتروني / محافظ</p>
                  <h4 className="text-2xl font-black text-purple-700 font-sans">
                    {formatCurrency(salesReportModal.invoices.filter(i => i.paymentMethod === 'visa' || i.paymentMethod === 'vodafone' || i.paymentMethod === 'instapay').reduce((acc, inv) => acc + (inv.total || 0), 0))}
                  </h4>
                </div>
              </div>

              {/* Invoices List Table */}
              <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[40vh]">
                  <table className="w-full text-right border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b border-gray-100">
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center w-12">م</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">رقم الفاتورة</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">التاريخ والوقت</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">المنتجات / الأصناف</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">طريقة الدفع</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {salesReportModal.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-bold italic">لا توجد مبيعات مسجلة</td>
                        </tr>
                      ) : (
                        salesReportModal.invoices.map((inv, idx) => (
                          <tr
                            key={inv.id || idx}
                            onClick={() => setSelectedInvoice(inv)}
                            className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                          >
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-bold text-gray-400 font-sans group-hover:text-blue-600">{idx + 1}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-sans">
                                {inv.id || '---'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900 font-sans">
                                  {new Date(inv.createdAt).toLocaleDateString('ar-EG')}
                                </span>
                                <span className="text-xs text-gray-400 font-sans">
                                  {new Date(inv.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col max-w-xs">
                                <span className="text-sm font-bold text-gray-900 truncate">
                                  {inv.items?.map((it: any) => it.name).join('، ') || '---'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {inv.items?.length || 0} أصناف
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn(
                                "text-xs font-black px-2.5 py-1 rounded-full",
                                inv.paymentMethod === 'cash' ? "bg-green-50 text-green-600" :
                                inv.paymentMethod === 'visa' ? "bg-blue-50 text-blue-600" :
                                inv.paymentMethod === 'vodafone' ? "bg-red-50 text-red-600" :
                                inv.paymentMethod === 'instapay' ? "bg-pink-50 text-pink-600" :
                                "bg-amber-50 text-amber-600"
                              )}>
                                {inv.paymentMethod === 'cash' ? 'نقدي' :
                                 inv.paymentMethod === 'visa' ? 'فيزا' :
                                 inv.paymentMethod === 'vodafone' ? 'فودافون كاش' :
                                 inv.paymentMethod === 'instapay' ? 'انستا باي' :
                                 'آجل'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-left">
                              <span className="text-sm font-black text-blue-600 font-sans">
                                {formatCurrency(inv.total)}
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

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 flex gap-4 bg-gray-50/50 rounded-b-[2rem]">
              <button
                onClick={() => printSalesReport(salesReportModal.title, salesReportModal.invoices)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98]"
              >
                طباعة تقرير PDF
              </button>
              <button
                onClick={() => setSalesReportModal(null)}
                className="w-1/3 bg-gray-200 text-gray-700 font-black py-4 rounded-2xl hover:bg-gray-300 transition-all active:scale-[0.98]"
              >
                إغلاق
              </button>
            </div>

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
                      {inv.id || '---'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={cn(
                      "text-sm font-black px-3 py-1.5 rounded-full",
                      inv.status === 'RETURNED' ? "bg-red-50 text-red-600"
                        : inv.status === 'PARTIALLY_RETURNED' ? "bg-orange-50 text-orange-600"
                        : inv.status === 'PENDING' ? "bg-amber-50 text-amber-600"
                        : inv.status === 'CANCELLED' ? "bg-gray-50 text-gray-600"
                        : "bg-green-50 text-green-600"
                    )}>
                      {inv.status === 'RETURNED' ? 'مرتجع كامل'
                        : inv.status === 'PARTIALLY_RETURNED' ? 'مرتجع جزئي'
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
    } else if (item.status === 'PENDING' || item.status === 'SHIPPED') {
      acc[name].pendingQuantity += (item.quantity || 0);
    }
    acc[name].history.push(item);
    return acc;
  }, {} as Record<string, { name: string, totalQuantity: number, pendingQuantity: number, latestDate: any, history: any[] }>);

  const groupedItems = (Object.values(groupedItemsMap) as any[])
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
                              (item.status === 'PENDING' || item.status === 'SHIPPED') ? "border-amber-200 bg-amber-50/10" : "border-blue-100 hover:border-blue-300"
                            )}>
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black",
                                  (item.status === 'PENDING' || item.status === 'SHIPPED') ? "bg-amber-100 text-amber-600" : "bg-gray-50 text-gray-400"
                                )}>
                                  {hIdx + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-gray-900 flex items-center gap-2">
                                    رقم الشحنة: <span className="font-mono text-blue-600 text-sm bg-blue-50 px-1.5 py-0.5 rounded">{item.transferId}</span>
                                    {item.status === 'PENDING' && (
                                      <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                                        <Truck className="w-3 h-3 animate-pulse" />
                                        بانتظار موافقة المرسل
                                      </span>
                                    )}
                                    {item.status === 'SHIPPED' && (
                                      <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                                        <Truck className="w-3 h-3" />
                                        قيد النقل (جاهز للاستلام)
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

                                {item.status === 'SHIPPED' ? (
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
                                ) : item.status === 'PENDING' ? (
                                  <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-amber-100">
                                    <Truck className="w-3.5 h-3.5" />
                                    بانتظار موافقة المرسل
                                  </span>
                                ) : (
                                  <>
                                    {(() => {
                                      const product = products.find(p => p.id === item.productId || p.name === (item.name || item.productName));
                                      const sPrice = product?.sellingPrice || (item.price * 1.25);
                                      return (
                                        <div className="text-center">
                                          <p className="text-sm font-black text-blue-400 uppercase tracking-tighter mb-1">سعر البيع</p>
                                          <span className="text-sm font-black text-blue-600 font-sans">{formatCurrency(sPrice)}</span>
                                        </div>
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


