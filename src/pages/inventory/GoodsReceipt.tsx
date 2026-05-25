import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  ArrowDownLeft, 
  Package, 
  Search, 
  Plus, 
  Trash2, 
  Save, 
  User, 
  FileText,
  Boxes,
  History,
  Edit2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { productsService } from '../../services/firestore';
import { warehouseService, inventoryTransactionService } from '../../services/inventory';
import { Product, Warehouse, OrderItem, InventoryTransaction } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function GoodsReceiptPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<InventoryTransaction[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [reference, setReference] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    // Load products and warehouses
    const load = async () => {
      const [prods, whs] = await Promise.all([productsService.getAll(), warehouseService.getAll()]);
      setProducts(prods);
      setWarehouses(whs);
      if (whs.length > 0) setSelectedWarehouse(whs[0].id);
    };
    load();

    // Listen to recent receipts
    const q = query(
      collection(db, 'inventory_transactions'), 
      where('type', '==', 'RECEIPT'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryTransaction[];
      setRecentReceipts(list);
    });

    return () => unsubscribe();
  }, []);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { 
        productId: product.id, 
        productName: product.name, 
        quantity: 1, 
        cost: product.costPrice || 0,
        sku: product.sku
      }]);
    }
  };

  const removeFromCart = (id: string) => setCart(cart.filter(i => i.productId !== id));

  const handleEdit = (receipt: InventoryTransaction) => {
    setEditingId(receipt.id);
    setCart(receipt.items);
    setSelectedWarehouse(receipt.toWarehouseId || '');
    setReference(receipt.reference || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const editId = queryParams.get('edit');
    if (editId && recentReceipts.length > 0) {
      const receiptToEdit = recentReceipts.find(r => r.id === editId);
      if (receiptToEdit) {
        handleEdit(receiptToEdit);
      }
    }
  }, [location.search, recentReceipts]);

  const handleDelete = async (receipt: InventoryTransaction) => {
    if (window.confirm('هل أنت متأكد من حذف فاتورة التوريد هذه وعكس تأثيرها على المخزون؟')) {
      try {
        await inventoryTransactionService.deleteStockMovement(receipt.id, receipt);
        alert('تم حذف الفاتورة وعكس تأثير المخزون بنجاح!');
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'حدث خطأ أثناء حذف الفاتورة');
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCart([]);
    setReference('');
  };

  const handleSubmit = async () => {
    if (!selectedWarehouse || cart.length === 0) return;
    setLoading(true);
    try {
      const transactionData = {
        type: 'RECEIPT' as const,
        status: 'COMPLETED' as const,
        toWarehouseId: selectedWarehouse,
        items: cart,
        reference,
        createdBy: user?.uid || 'anonymous'
      };

      if (editingId) {
        const oldTx = recentReceipts.find(r => r.id === editingId);
        if (oldTx) {
          await inventoryTransactionService.updateStockMovement(editingId, oldTx, transactionData);
          alert('تم تعديل الفاتورة وتحديث المخزون بنجاح!');
        }
      } else {
        await inventoryTransactionService.createStockMovement(transactionData);
        alert('تم استلام البضاعة وتحديث المخزون بنجاح!');
      }

      setCart([]);
      setReference('');
      setEditingId(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'حدث خطأ أثناء معالجة الطلب');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 pb-20 rtl" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 px-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">
            {editingId ? 'تعديل فاتورة توريد' : 'توريد بضاعة جديد'}
          </h2>
          <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-widest">
            {editingId ? `تعديل الفاتورة رقم: ${editingId.slice(0, 8)}` : 'استلام شحنات من الموردين وتوجيهها للمستودع'}
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {editingId && (
            <button 
              onClick={cancelEdit}
              className="px-6 py-3 rounded-2xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all"
            >
              إلغاء التعديل
            </button>
          )}
          <button 
            onClick={handleSubmit}
            disabled={loading || cart.length === 0}
            className={cn(
              "flex-1 sm:flex-none px-8 py-3 rounded-2xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2",
              editingId 
                ? "bg-purple-600 text-white shadow-purple-100 hover:bg-purple-700" 
                : "bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700",
              (loading || cart.length === 0) && "bg-gray-300 shadow-none cursor-not-allowed"
            )}
          >
            {loading ? <Plus className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
            {editingId ? 'حفظ التعديلات' : 'تأكيد وحفظ الإذن'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4">
        {/* Sidebar Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm h-fit">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-3 text-lg">
              <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
              تفاصيل الاستلام
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">المستودع المستلم</label>
                <select 
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold appearance-none"
                  value={selectedWarehouse}
                  onChange={e => setSelectedWarehouse(e.target.value)}
                >
                  {warehouses.map(wh => (<option key={wh.id} value={wh.id}>{wh.name}</option>))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">مرجع الفاتورة / المورد</label>
                <div className="relative">
                  <FileText className="absolute right-5 top-4 w-4 h-4 text-gray-300" />
                  <input 
                    type="text" placeholder="رقم الفاتورة، اسم المورد..."
                    className="w-full bg-gray-50 border-none rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-50">
                 <div className="flex items-center justify-between mb-4">
                   <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">الأصناف المختارة ({cart.length})</h4>
                   <span className="text-xs font-black text-blue-600">{formatCurrency(cart.reduce((sum, i) => sum + (i.cost * i.quantity), 0))}</span>
                 </div>
                 <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-none">
                    {cart.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-gray-50 rounded-3xl">
                        <Package className="w-8 h-8 text-gray-100 mx-auto mb-2" />
                        <p className="text-xs text-gray-300 font-bold">لم يتم إضافة منتجات بعد</p>
                      </div>
                    ) : cart.map((item: any) => (
                      <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl group transition-all">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                              <Package className="w-5 h-5" />
                            </div>
                            <div>
                               <p className="text-sm font-black text-gray-900 leading-none">{item.productName}</p>
                               <div className="flex items-center gap-2 mt-1">
                                 <span className="text-xs font-bold text-gray-400">الكمية:</span>
                                 <input 
                                   type="number" 
                                   value={item.quantity}
                                   onChange={(e) => {
                                     const val = parseInt(e.target.value) || 0;
                                     setCart(cart.map(i => i.productId === item.productId ? { ...i, quantity: val } : i));
                                   }}
                                   className="w-12 bg-white border-none rounded-md px-1 text-center text-xs font-black text-blue-600 focus:ring-2 focus:ring-blue-100"
                                 />
                               </div>
                            </div>
                         </div>
                         <button 
                           onClick={() => removeFromCart(item.productId)}
                           className="w-8 h-8 bg-white text-red-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Picker */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 flex flex-col shadow-sm overflow-hidden h-[600px]">
            <div className="p-8 border-b border-gray-50 bg-gray-50/20">
              <div className="relative">
                 <Search className="absolute right-5 top-4 w-5 h-5 text-gray-400" />
                 <input 
                   type="text" placeholder="ابحث عن المنتجات بالاسم أو الكود..."
                   className="w-full bg-white border border-gray-100 rounded-2xl pr-14 pl-6 py-4 focus:ring-4 focus:ring-blue-50 outline-none text-sm font-bold shadow-sm"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-4 scrollbar-none">
                {filteredProducts.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex items-center gap-4 p-4 rounded-3xl border border-gray-100 hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all group text-right active:scale-95 bg-white"
                  >
                     <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                       {p.images?.[0] ? (
                         <img src={p.images[0]} className="w-full h-full object-cover rounded-2xl" alt="" />
                       ) : (
                         <Boxes className="w-8 h-8" />
                       )}
                     </div>
                     <div className="flex-1">
                        <h4 className="font-black text-gray-900 text-sm">{p.name}</h4>
                        <p className="text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-tight">{p.sku} | {p.brand}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{formatCurrency(p.costPrice || 0)}</span>
                          <span className="text-[10px] font-bold text-gray-400">المخزون: {p.quantity || 0}</span>
                        </div>
                     </div>
                     <div className="w-10 h-10 bg-gray-50 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        <Plus className="w-5 h-5" />
                     </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Recent Invoices Table */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                  <History className="w-6 h-6" />
                </div>
                <h3 className="font-black text-gray-900 text-lg">آخر فواتير التوريد</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-gray-50/50 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                    <th className="px-8 py-5">رقم الفاتورة</th>
                    <th className="px-8 py-5">المستودع</th>
                    <th className="px-8 py-5">المرجع</th>
                    <th className="px-8 py-5">التاريخ</th>
                    <th className="px-8 py-5">الإجمالي</th>
                    <th className="px-8 py-5">الأصناف</th>
                    <th className="px-8 py-5">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold divide-y divide-gray-50">
                  {recentReceipts.map(receipt => (
                    <React.Fragment key={receipt.id}>
                      <tr className={cn(
                        "hover:bg-gray-50/50 transition-colors",
                        expandedRow === receipt.id && "bg-blue-50/20"
                      )}>
                        <td className="px-8 py-5 font-mono text-xs text-gray-400">#{receipt.id.slice(0, 8)}</td>
                        <td className="px-8 py-5">{warehouses.find(w => w.id === receipt.toWarehouseId)?.name || '---'}</td>
                        <td className="px-8 py-5">{receipt.reference || 'بدون مرجع'}</td>
                        <td className="px-8 py-5 text-gray-400">{new Date(receipt.createdAt).toLocaleDateString('ar-EG')}</td>
                        <td className="px-8 py-5 font-black text-blue-600">
                          {formatCurrency(receipt.items.reduce((sum, i) => sum + ((i.cost || 0) * i.quantity), 0))}
                        </td>
                        <td className="px-8 py-5">
                          <button 
                            onClick={() => setExpandedRow(expandedRow === receipt.id ? null : receipt.id)}
                            className="flex items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            {receipt.items.length} أصناف
                            {expandedRow === receipt.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEdit(receipt)}
                              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              title="تعديل الفاتورة"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(receipt)}
                              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                              title="حذف الفاتورة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRow === receipt.id && (
                        <tr className="bg-gray-50/30">
                          <td colSpan={7} className="px-8 py-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {receipt.items.map((item, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                                    <Package className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-gray-900">{item.productName}</p>
                                    <p className="text-[10px] font-bold text-gray-400">الكمية: {item.quantity} | السعر: {formatCurrency(item.cost || 0)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {recentReceipts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-8 py-20 text-center text-gray-300 font-bold italic">
                        لا توجد فواتير توريد مسجلة حتى الآن
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


