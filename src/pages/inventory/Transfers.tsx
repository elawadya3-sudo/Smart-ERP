import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  ArrowRightLeft, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ArrowRight,
  Database,
  Building2,
  Package,
  ArrowUpRight,
  Trash2,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, setDoc, doc, orderBy, deleteDoc, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { formatDate, cn } from '../../lib/utils';
import { Warehouse, Product, InventoryTransaction, StockLevel } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { inventoryTransactionService } from '../../services/inventory';

export default function StockTransfersPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [transfers, setTransfers] = useState<InventoryTransaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [transferReceipts, setTransferReceipts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [selectedTransferIds, setSelectedTransferIds] = useState<string[]>([]);

  const toggleSelectAllTransfers = () => {
    if (selectedTransferIds.length === transfers.length && transfers.length > 0) {
      setSelectedTransferIds([]);
    } else {
      setSelectedTransferIds(transfers.map(t => t.id));
    }
  };

  const toggleSelectOneTransfer = (id: string) => {
    if (selectedTransferIds.includes(id)) {
      setSelectedTransferIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedTransferIds(prev => [...prev, id]);
    }
  };

  const handleBulkDeleteTransfers = async () => {
    if (selectedTransferIds.length === 0) return;
    const confirmMessage = `هل أنت متأكد من حذف أوامر النقل المحددة (${selectedTransferIds.length}) وعكس تأثيرها على المخزون؟`;
    if (window.confirm(confirmMessage)) {
      setLoading(true);
      try {
        let successCount = 0;
        let failCount = 0;
        
        for (const id of selectedTransferIds) {
          const transfer = transfers.find(t => t && t.id === id);
          if (transfer) {
            try {
              await inventoryTransactionService.deleteStockMovement(id, transfer);
              successCount++;
            } catch (err) {
              console.error(`Failed to delete transfer ${id}:`, err);
              failCount++;
            }
          }
        }
        
        setSelectedTransferIds([]);
        if (failCount > 0) {
          alert(`تم حذف ${successCount} أوامر نقل بنجاح، وفشل حذف ${failCount}.`);
        } else {
          alert(`تم حذف ${successCount} أوامر نقل بنجاح وتحديث أرصدة المخزون!`);
        }
      } catch (err: any) {
        console.error("Bulk delete transfers failed:", err);
        alert(err.message || 'حدث خطأ أثناء حذف العمليات المحددة');
      } finally {
        setLoading(false);
      }
    }
  };
  
  // Form State
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferItems, setTransferItems] = useState<{productId: string, quantity: number}[]>([
    { productId: '', quantity: 1 }
  ]);

  // Compute main and branch warehouses BEFORE useEffect using useMemo to avoid infinite dependency loop
  const mainWarehouse = useMemo(() => 
    warehouses.find(w => (w as any).type === 'MAIN' || w.id === '1'), 
    [warehouses]
  );
  const branchWarehouses = useMemo(() => 
    warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1'), 
    [warehouses]
  );

  useEffect(() => {
    // Fetch Warehouses
    const qW = query(collection(db, 'warehouses'));
    const unsubW = onSnapshot(qW, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
      setWarehouses(docs);
    });

    // Fetch Products
    const unsubP = onSnapshot(query(collection(db, 'products')), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    // Fetch Transfers
    const unsubT = onSnapshot(query(collection(db, 'inventory_transactions'), orderBy('createdAt', 'desc')), (snapshot) => {
      setTransfers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as InventoryTransaction)));
      setLoading(false);
    });

    // Fetch Orders
    const unsubO = onSnapshot(query(collection(db, 'orders')), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Transfer Receipts
    const unsubTR = onSnapshot(query(collection(db, 'transfer_receipts')), (snapshot) => {
      setTransferReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubW();
      unsubP();
      unsubT();
      unsubO();
      unsubTR();
    };
  }, []);

  // Calculate dynamic stock levels for all warehouses
  useEffect(() => {
    if (products.length === 0) return;

    const levels: StockLevel[] = [];

    products.forEach(p => {
      // 1. Main Warehouse (id: '1')
      // p.quantity is the source of truth for Main (already deducted by our new logic)
      levels.push({
        productId: p.id,
        warehouseId: '1',
        quantity: p.quantity || 0,
        lastUpdated: new Date().toISOString()
      });

      // 2. Branch Warehouses
      branchWarehouses.forEach(bw => {
        // Items Received (RECEIVED/PARTIALLY_RECEIVED transfer receipts to this branch)
        const received = transferReceipts
          .filter(tr => tr && (tr.status === 'RECEIVED' || tr.status === 'PARTIALLY_RECEIVED') && tr.toWarehouseId === bw.id)
          .reduce((acc, tr) => {
            const item = (tr.items || []).find((i: any) => i && i.productId === p.id);
            return acc + (item?.receivedQty || 0);
          }, 0);

        // Items Sent (COMPLETED transfers from this branch)
        const sent = transfers
          .filter(t => t && t.status === 'COMPLETED' && t.fromWarehouseId === bw.id)
          .reduce((acc, t) => {
            const item = (t.items || []).find(i => i && i.productId === p.id);
            return acc + (item?.quantity || 0);
          }, 0);

        // Items Sold (Orders from this branch)
        const sold = orders
          .filter(o => o && o.branchId === bw.id && o.status !== 'RETURNED')
          .reduce((acc, o) => {
            const item = (o.items || []).find((i: any) => i && i.productId === p.id);
            return acc + (item?.quantity || 0);
          }, 0);

        levels.push({
          productId: p.id,
          warehouseId: bw.id,
          quantity: Math.max(0, received - sent - sold),
          lastUpdated: new Date().toISOString()
        });
      });
    });

    setStockLevels(levels);
  }, [products, transfers, orders, warehouses]);

  const openAddModal = () => {
    setEditingTransferId(null);
    setToWarehouseId('');
    setTransferItems([{ productId: '', quantity: 1 }]);
    setIsModalOpen(true);
  };

  const openEditModal = (t: InventoryTransaction) => {
    setEditingTransferId(t.id);
    setToWarehouseId(t.toWarehouseId || '');
    setTransferItems((t.items || []).map(i => ({ productId: i.productId || '', quantity: i.quantity || 0 })));
    setIsModalOpen(true);
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const editId = queryParams.get('edit');
    if (editId && transfers.length > 0) {
      const transferToEdit = transfers.find(t => t.id === editId);
      if (transferToEdit) {
        openEditModal(transferToEdit);
      }
    }
  }, [location.search, transfers]);

  const handleDeleteTransfer = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف أمر النقل هذا؟')) {
      try {
        const transfer = transfers.find(t => t && t.id === id);
        if (transfer) {
          await inventoryTransactionService.deleteStockMovement(id, transfer);
        }
        setSelectedTransferIds(prev => prev.filter(item => item !== id));
      } catch (error: any) {
        alert(error.message || 'حدث خطأ أثناء حذف العملية');
      }
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = transferItems.filter(item => item.productId && item.quantity > 0);
    
    if (!toWarehouseId || validItems.length === 0) return;

    if (editingTransferId) {
      try {
        const oldTransfer = transfers.find(t => t.id === editingTransferId);
        if (oldTransfer) {
          const newTx = {
            type: oldTransfer.type,
            status: oldTransfer.status,
            fromWarehouseId: oldTransfer.fromWarehouseId,
            toWarehouseId,
            items: validItems.map(item => ({
              productId: item.productId,
              productName: products.find(p => p.id === item.productId)?.name || '',
              quantity: item.quantity
            })),
            createdBy: oldTransfer.createdBy,
            reference: oldTransfer.reference || '',
            notes: oldTransfer.notes || ''
          };
          await inventoryTransactionService.updateStockMovement(editingTransferId, oldTransfer, newTx);
        }
        setIsModalOpen(false);
        setEditingTransferId(null);
        setToWarehouseId('');
        setTransferItems([{ productId: '', quantity: 1 }]);
      } catch (error: any) {
        alert(error.message || 'حدث خطأ أثناء تعديل المعاملة');
      }
    } else {
      const id = Math.random().toString(36).substr(2, 9);
      if (!user?.uid) {
        alert('لم يتم تحميل بيانات المستخدم بعد. يرجى تسجيل الدخول أو إعادة تحميل الصفحة.');
        return;
      }

      const newTransfer: Omit<InventoryTransaction, 'id' | 'createdAt'> = {
        type: 'TRANSFER',
        status: 'PENDING',
        fromWarehouseId: mainWarehouse?.id || '1',
        toWarehouseId,
        items: validItems.map(item => ({
          productId: item.productId,
          productName: products.find(p => p.id === item.productId)?.name || '',
          quantity: item.quantity
        })),
        createdBy: user.uid,
        reference: '',
        notes: 'تحويل بضاعة'
      };

      try {
        await inventoryTransactionService.createStockMovement(newTransfer);
        setIsModalOpen(false);
        setToWarehouseId('');
        setTransferItems([{ productId: '', quantity: 1 }]);
      } catch (error: any) {
        alert(error.message || 'حدث خطأ أثناء إنشاء عملية التحويل');
      }
    }
  };

  const handleUpdateStatus = async (transferId: string, newStatus: 'COMPLETED' | 'CANCELLED') => {
    const transfer = transfers.find(t => t && t.id === transferId);
    if (!transfer || transfer.status !== 'PENDING') return;

    try {
      if (newStatus === 'COMPLETED') {
        await inventoryTransactionService.approveStockMovement(transfer);
      } else {
        await updateDoc(doc(db, 'inventory_transactions', transferId), { 
          status: 'CANCELLED',
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء تحديث حالة الطلب');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-sm font-bold">مكتمل (Completed)</span>;
      case 'CANCELLED':
        return <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-sm font-bold">مرفوض (Rejected)</span>;
      default:
        return <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-sm font-bold">قيد الانتظار (Pending)</span>;
    }
  };

  const addItem = () => {
    setTransferItems([...transferItems, { productId: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    const newItems = [...transferItems];
    newItems.splice(index, 1);
    setTransferItems(newItems);
  };

  const updateItem = (index: number, field: 'productId' | 'quantity', value: any) => {
    const newItems = [...transferItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setTransferItems(newItems);
  };

  return (
    <div className="space-y-10" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">نقل المخزون (Stock Transfer)</h2>
          <p className="text-gray-500 mt-2 font-medium">تحويل البضاعة بين المخزن الرئيسي ومستودعات الفروع</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <ArrowRightLeft className="w-5 h-5" />
          إنشاء أمر نقل جديد
        </button>
      </div>

      {/* Stock Summary (Brief) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Database className="w-6 h-6" />
             </div>
             <div>
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">المخزن الرئيسي</p>
                <p className="text-xl font-black text-gray-900">
                    {stockLevels.filter(sl => sl.warehouseId === '1').reduce((acc, curr) => acc + curr.quantity, 0)} قطعة
                </p>
             </div>
         </div>
         <div className="p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
             </div>
             <div>
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">مخازن الفروع</p>
                <p className="text-xl font-black text-gray-900">
                    {stockLevels.filter(sl => sl.warehouseId !== '1').reduce((acc, curr) => acc + curr.quantity, 0)} قطعة
                </p>
             </div>
         </div>
         <div className="p-6 bg-blue-600 rounded-[2rem] shadow-xl shadow-blue-100 flex items-center gap-4 text-white">
             <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <Clock className="w-6 h-6" />
             </div>
             <div>
                <p className="text-sm text-white/80 font-bold uppercase tracking-widest leading-none mb-1">أوامر النقل المعلقة</p>
                <p className="text-xl font-black text-white">
                    {transfers.filter(t => t.status === 'PENDING').length} أمر
                </p>
             </div>
         </div>
      </div>

      {/* Transfers Table */}
      <section className="space-y-4">
        {selectedTransferIds.length > 0 && (
          <div className="bg-red-50 text-red-600 p-6 rounded-[2rem] border border-red-100 flex flex-col sm:flex-row justify-between items-center gap-4 animate-in slide-in-from-top-4 duration-300">
            <span className="font-bold text-sm">تم تحديد {selectedTransferIds.length} عمليات نقل</span>
            <div className="flex gap-4">
              <button 
                onClick={handleBulkDeleteTransfers}
                className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-red-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-red-100"
              >
                <Trash2 className="w-4 h-4" />
                حذف العمليات المحددة
              </button>
              <button 
                onClick={() => setSelectedTransferIds([])}
                className="bg-white border border-red-200 text-red-600 px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-red-50 active:scale-95 transition-all"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest w-12">
                    <input 
                      type="checkbox"
                      checked={transfers.length > 0 && selectedTransferIds.length === transfers.length}
                      onChange={toggleSelectAllTransfers}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">تحويل مخزون (ID)</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">من → إلى</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">المنتج والكمية</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">الحالة</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">التاريخ</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-32 text-center">
                       <div className="flex flex-col items-center gap-4 text-gray-300">
                            <ArrowRightLeft className="w-16 h-16 opacity-10" />
                            <p className="font-bold">لا يوجد عمليات نقل حتى الآن</p>
                       </div>
                    </td>
                  </tr>
                ) : transfers.map((t, index) => {
                  const toWh = warehouses.find(w => w.id === t.toWarehouseId);
                  const fromWh = warehouses.find(w => w.id === t.fromWarehouseId) || { name: 'المخزن الرئيسي' };
                  const firstItem = t.items?.[0];
                  const extraItemsCount = t.items?.length ? t.items.length - 1 : 0;
                  return (
                    <motion.tr 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={t.id} 
                      className={cn(
                        "hover:bg-gray-50/50 transition-colors group",
                        selectedTransferIds.includes(t.id) && "bg-blue-50/20 hover:bg-blue-50/30"
                      )}
                    >
                      <td className="px-8 py-6 w-12">
                        <input 
                          type="checkbox"
                          checked={selectedTransferIds.includes(t.id)}
                          onChange={() => toggleSelectOneTransfer(t.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-8 py-6 font-mono font-bold text-sm text-blue-600">#{t.id.toUpperCase()}</td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-bold text-gray-900">{fromWh?.name || 'المخزن الرئيسي'}</span>
                           <ArrowRight className="w-3 h-3 text-gray-400 rotate-180" />
                           <span className="text-sm font-bold text-blue-600">{toWh?.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {firstItem && (
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                               <Package className="w-5 h-5" />
                             </div>
                             <div>
                               <p className="font-bold text-gray-900 text-sm truncate max-w-[200px]">
                                 {firstItem.productName}
                               </p>
                               <p className="text-sm font-black text-blue-600 uppercase tracking-widest">
                                 الكمية: {firstItem.quantity}
                                 {extraItemsCount > 0 && (
                                   <span className="text-gray-400 mr-2 border-r border-gray-300 pr-2">و {extraItemsCount} منتجات أخرى</span>
                                 )}
                               </p>
                             </div>
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        {getStatusBadge(t.status)}
                      </td>
                      <td className="px-8 py-6 text-sm text-gray-400 font-bold font-mono">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="px-8 py-6">
                         {t.status === 'PENDING' && (
                           <div className="flex items-center gap-2">
                             <button 
                                onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                                className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                title="موافقة وإتمام"
                             >
                                <CheckCircle2 className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={() => handleUpdateStatus(t.id, 'CANCELLED')}
                                className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                title="رفض"
                             >
                                <XCircle className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={() => openEditModal(t as any)}
                                className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                title="تعديل"
                             >
                                <Pencil className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={() => handleDeleteTransfer(t.id)}
                                className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-600 hover:text-white transition-all shadow-sm"
                                title="حذف"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                         )}
                         {t.status !== 'PENDING' && (
                           <div className="flex items-center gap-2">
                             <button 
                                onClick={() => handleDeleteTransfer(t.id)}
                                className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-600 hover:text-white transition-all shadow-sm"
                                title="حذف"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                         )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* New Transfer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
               onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="erp-modal max-w-3xl max-h-[90vh] flex flex-col"
            >
              <div className="text-center space-y-2 shrink-0 mb-8">
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                  {editingTransferId ? 'تعديل أمر نقل' : 'نقل بضاعة جديد'}
                </h3>
                <p className="text-gray-400 font-medium italic">تحويل المخزون من الرئيسي إلى الفروع</p>
              </div>

              <form onSubmit={handleCreateTransfer} className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-8">
                <div className="space-y-6">
                  {/* From and To */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 opacity-60">
                      <label className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">مخزن المصدر (Source)</label>
                      <div className="w-full bg-gray-50 rounded-2xl px-6 py-4 flex items-center gap-3 border border-gray-100">
                         <Database className="w-5 h-5 text-gray-400" />
                         <span className="font-bold text-gray-500">المخزن الرئيسي (MAIN)</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">إلى مخزن الفرع (Target)</label>
                      <select 
                        required
                        className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold appearance-none cursor-pointer"
                        value={toWarehouseId}
                        onChange={e => setToWarehouseId(e.target.value)}
                      >
                        <option value="">اختر الفرع...</option>
                        {branchWarehouses.map(bw => (
                          <option key={bw.id} value={bw.id}>{bw.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Products List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                       <label className="text-sm font-black text-gray-400 uppercase tracking-widest">المنتجات (Products)</label>
                       <button
                         type="button"
                         onClick={addItem}
                         className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg"
                       >
                         <Plus className="w-3 h-3" />
                         إضافة منتج آخر
                       </button>
                    </div>
                    
                    <div className="space-y-3">
                      {transferItems.map((item, index) => (
                        <div key={index} className="flex flex-col sm:flex-row items-center gap-3 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                          <div className="flex-1 w-full">
                            <select 
                              required
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold appearance-none cursor-pointer"
                              value={item.productId}
                              onChange={e => updateItem(index, 'productId', e.target.value)}
                            >
                              <option value="">اختر المنتج...</option>
                              {Array.from(new Set(products.map(p => p.category || 'غير مصنف'))).map(cat => (
                                <optgroup key={cat} label={cat}>
                                  {products.filter(p => (p.category || 'غير مصنف') === cat).map(p => {
                                     const stock = stockLevels.find(sl => sl.productId === p.id && sl.warehouseId === '1')?.quantity || 0;
                                     // Disable if stock <= 0, or if this product is already selected in ANOTHER row
                                     const isSelectedElsewhere = transferItems.some((ti, idx) => idx !== index && ti.productId === p.id);
                                     return (
                                       <option key={p.id} value={p.id} disabled={stock <= 0 || isSelectedElsewhere}>
                                         {p.name} ({stock} متاح)
                                       </option>
                                     );
                                  })}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                          
                          <div className="w-full sm:w-32 relative">
                            <input 
                              required
                              type="number"
                              min="1"
                              placeholder="0"
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold text-center"
                              value={item.quantity || ''}
                              onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm uppercase">كمية</div>
                          </div>

                          {transferItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="w-full sm:w-auto h-[46px] px-4 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 shrink-0">
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowUpRight className="w-5 h-5" />
                    تأكيد أمر النقل
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setTransferItems([{ productId: '', quantity: 1 }]);
                      setToWarehouseId('');
                    }}
                    className="flex-1 bg-gray-100 text-gray-500 font-bold py-5 rounded-2xl hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


