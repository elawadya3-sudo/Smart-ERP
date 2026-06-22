import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Package, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  History as HistoryIcon,
  FileText,
  Warehouse as WarehouseIcon,
  Search,
  Filter,
  MoreVertical,
  ChevronLeft,
  AlertCircle,
  TrendingUp,
  PackagePlus,
  Pencil,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { inventoryTransactionService, warehouseService } from '../../services/inventory';
import { productsService } from '../../services/firestore';
import { InventoryTransaction, Warehouse, Product } from '../../types';
import { cn, formatDate } from '../../lib/utils';

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedTxIds.length === transactions.length && transactions.length > 0) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(transactions.map(t => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedTxIds.includes(id)) {
      setSelectedTxIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedTxIds(prev => [...prev, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTxIds.length === 0) return;
    const confirmMessage = `هل أنت متأكد من حذف العمليات المحددة (${selectedTxIds.length}) وعكس تأثيرها على المخزون؟`;
    if (window.confirm(confirmMessage)) {
      setLoading(true);
      try {
        let successCount = 0;
        let failCount = 0;
        for (const id of selectedTxIds) {
          const tx = transactions.find(t => t.id === id);
          if (tx) {
            try {
              await inventoryTransactionService.deleteStockMovement(tx.id, tx);
              successCount++;
            } catch (err) {
              console.error(`Failed to delete transaction ${id}:`, err);
              failCount++;
            }
          }
        }
        // reload transactions
        const txs = await inventoryTransactionService.getAll();
        setTransactions(txs);
        setSelectedTxIds([]);
        if (failCount > 0) {
          alert(`تم حذف ${successCount} عمليات بنجاح، وفشل حذف ${failCount} عمليات.`);
        } else {
          alert(`تم حذف ${successCount} عمليات بنجاح وتحديث أرصدة المخزون!`);
        }
      } catch (err: any) {
        console.error("Bulk delete failed:", err);
        alert(err.message || 'حدث خطأ أثناء الحذف الجماعي');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteTransaction = async (tx: InventoryTransaction) => {
    if (window.confirm('هل أنت متأكد من حذف هذه العملية وعكس تأثيرها على المخزون؟')) {
      try {
        await inventoryTransactionService.deleteStockMovement(tx.id, tx);
        setTransactions(prev => prev.filter(item => item.id !== tx.id));
        setSelectedTxIds(prev => prev.filter(id => id !== tx.id));
        alert('تم حذف العملية وتحديث المخزون بنجاح!');
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'حدث خطأ أثناء حذف العملية');
      }
    }
  };

  const handleEditTransaction = (tx: InventoryTransaction) => {
    if (tx.type === 'TRANSFER') {
      navigate(`/inventory/transfers?edit=${tx.id}`);
    } else if (tx.type === 'RECEIPT') {
      navigate(`/inventory/receipt?edit=${tx.id}`);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const [txs, whs, prods] = await Promise.all([
        inventoryTransactionService.getAll(),
        warehouseService.getAll(),
        productsService.getAll()
      ]);
      setTransactions(txs);
      setWarehouses(whs);
      setProducts(prods);
      setLoading(false);
    };
    loadData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-50 text-green-600';
      case 'PENDING': return 'bg-orange-50 text-orange-600';
      case 'CANCELLED': return 'bg-red-50 text-red-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'RECEIPT': return 'توريد بضاعة';
      case 'TRANSFER': return 'تحويل مخزني';
      case 'ISSUE': return 'صرف مخزني';
      case 'RETURN': return 'مرتجع مبيعات';
      default: return type;
    }
  };

  const lowStockProducts = products.filter(product => product.quantity <= 5);
  const totalStockValue = products.reduce((acc, product) => acc + (Number(product.quantity || 0) * Number(product.costPrice || 0)), 0);
  const totalTransactions = transactions.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="erp-card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-blue-700 uppercase">
              <WarehouseIcon className="h-3.5 w-3.5" />
              Inventory Control
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">إدارة المخزون</h2>
            <p className="mt-1 text-sm text-slate-500">نظام متكامل لمتابعة المستودعات، الحركات، والتقارير</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/inventory/products" className="erp-toolbar-btn">
              <Package className="h-4 w-4" />
              إدارة المنتجات
            </Link>
            <Link to="/inventory/products/add" className="erp-toolbar-btn bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800">
              <PackagePlus className="h-4 w-4" />
              إضافة منتج جديد
            </Link>
            <Link to="/inventory/receipt" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              عملية مخزنية جديدة
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="erp-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">إجمالي المنتجات</p>
              <h3 className="mt-1 text-2xl font-black text-slate-900">{products.length}</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Package className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="erp-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">الحركات الأخيرة</p>
              <h3 className="mt-1 text-2xl font-black text-slate-900">{totalTransactions}</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <HistoryIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="erp-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">منتجات تحتاج تجديد</p>
              <h3 className="mt-1 text-2xl font-black text-red-500">{lowStockProducts.length}</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="erp-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">قيمة المخزون</p>
              <h3 className="mt-1 text-xl font-black text-slate-900">
                {new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(totalStockValue)}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Link to="/inventory/products" className="erp-card group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">كاتالوج المنتجات</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">إدارة الأصناف، التفاصيل، والأسعار</p>
        </Link>

        <Link to="/inventory/receipt" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 p-5 text-white shadow-sm transition hover:-translate-y-0.5">
          <ArrowDownLeft className="absolute -bottom-3 -right-3 h-20 w-20 opacity-10 transition group-hover:scale-110" />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <ArrowDownLeft className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold">توريد بضاعة</h3>
          <p className="mt-1 text-sm leading-relaxed text-blue-100">استلام شحنات جديدة وتحديث الأرصدة</p>
        </Link>

        <Link to="/inventory/transfers" className="erp-card group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <ArrowLeftRight className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">تحويل مخزني</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">نقل المنتجات بين الفروع والمستودعات</p>
        </Link>

        <Link to="/inventory/stock-taking" className="erp-card group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
            <HistoryIcon className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">جرد المخزون</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">مطابقة الكميات الفعلية مع النظام</p>
        </Link>

        <Link to="/inventory/reports" className="erp-card group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">التقارير</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">تحليلات الأرصدة ومعدلات الدوران</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_340px]">
        <div className="erp-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <HistoryIcon className="h-5 w-5 text-blue-600" />
              آخر الحركات المخزنية
            </h3>
            {selectedTxIds.length > 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-red-600">
                <span className="text-xs font-bold">تم تحديد {selectedTxIds.length} عملية</span>
                <button 
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف المحدد
                </button>
                <button 
                  onClick={() => setSelectedTxIds([])}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <button className="text-sm font-bold text-slate-400 transition hover:text-blue-600">عرض السجل الكامل</button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="erp-table-header">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input 
                      type="checkbox"
                      checked={transactions.length > 0 && selectedTxIds.length === transactions.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">المرجع</th>
                  <th className="px-4 py-3">الأصناف</th>
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-sm text-slate-400">
                      لا يوجد حركات مخزنية مسجلة حالياً
                    </td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx.id} className={cn(
                      'group transition hover:bg-slate-50',
                      selectedTxIds.includes(tx.id) && 'bg-blue-50/30 hover:bg-blue-50/40'
                    )}>
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox"
                          checked={selectedTxIds.includes(tx.id)}
                          onChange={() => toggleSelectOne(tx.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-xl',
                            tx.type === 'RECEIPT' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                          )}>
                             {tx.type === 'RECEIPT' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowLeftRight className="h-4 w-4" />}
                          </div>
                          <span className="text-sm font-bold text-slate-900">{getTypeName(tx.type)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-500">{tx.reference || `#WH-${tx.id.slice(0, 6)}`}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{tx.items.length} منتجات</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{formatDate(tx.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold', getStatusColor(tx.status))}>
                          {tx.status === 'COMPLETED' ? 'مكتمل' : 'قيد المعالجة'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditTransaction(tx)}
                            className="rounded-lg bg-blue-50 p-1.5 text-blue-600 transition hover:bg-blue-600 hover:text-white"
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(tx)}
                            className="rounded-lg bg-red-50 p-1.5 text-red-600 transition hover:bg-red-600 hover:text-white"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="erp-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                تنبيهات لإعادة الطلب
              </h3>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">{lowStockProducts.length} تحتاج متابعة</span>
            </div>
            <div className="mt-4 space-y-3">
               {lowStockProducts.slice(0, 4).map(product => (
                 <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 transition hover:bg-slate-50">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50">
                      <Package className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{product.name}</p>
                      <p className="text-sm font-bold text-red-500">المخزون: {product.quantity} قطعة</p>
                    </div>
                    <button className="text-sm font-bold text-blue-600 hover:underline">طلب توريد</button>
                 </div>
               ))}
               {lowStockProducts.length === 0 && (
                 <p className="py-8 text-center text-sm text-slate-400">المخزون في حالة جيدة حالياً</p>
               )}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-5 text-white shadow-sm">
            <p className="text-sm text-blue-100">القيمة الإجمالية</p>
            <h3 className="mt-2 text-3xl font-black text-blue-300">
              {new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(totalStockValue)}
            </h3>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2.5 text-sm text-slate-200">
              <TrendingUp className="h-4 w-4 text-green-400" />
              زيادة 4.2% عن الشهر الماضي
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


