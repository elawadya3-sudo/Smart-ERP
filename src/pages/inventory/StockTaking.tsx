import React, { useState, useEffect, useMemo } from 'react';
import { 
  History as HistoryIcon, 
  Search, 
  Package, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCcw,
  Warehouse as WarehouseIcon,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  MinusCircle,
  PlusCircle,
  ShieldCheck
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, Warehouse, InventoryTransaction } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';

interface StockAdjustment {
  productId: string;
  productName: string;
  systemQty: number;
  actualQty: number;
  difference: number;
  note?: string;
}

export default function StockTaking() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, 'products')), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });

    const unsubW = onSnapshot(query(collection(db, 'warehouses')), (snap) => {
      const whs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
      setWarehouses(whs);
      if (whs.length > 0) setSelectedWarehouseId(whs[0].id);
    });

    return () => {
      unsubP();
      unsubW();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleQtyChange = (productId: string, val: string) => {
    const num = parseInt(val);
    setAdjustments(prev => ({
      ...prev,
      [productId]: isNaN(num) ? 0 : num
    }));
  };

  const getDifference = (productId: string, systemQty: number) => {
    const actual = adjustments[productId] ?? systemQty;
    return actual - systemQty;
  };

  const hasChanges = Object.keys(adjustments).length > 0;

  const handleSaveAdjustment = async () => {
    if (!hasChanges) return;
    setIsSubmitting(true);

    try {
      const selectedWh = warehouses.find(w => w.id === selectedWarehouseId);
      const adjustmentItems = Object.entries(adjustments).map(([pid, actual]) => {
        const prod = products.find(p => p.id === pid);
        const actualNum = Number(actual);
        return {
          productId: pid,
          productName: prod?.name || 'منتج غير معروف',
          quantity: actualNum - (prod?.quantity || 0), // The adjustment delta
          actualQuantity: actualNum,
          systemQuantity: prod?.quantity || 0
        };
      });

      // 1. Create Inventory Transaction
      if (!user?.uid) {
        alert('لم يتم تحميل بيانات المستخدم بعد. يرجى تسجيل الدخول أو إعادة تحميل الصفحة.');
        return;
      }

      const txData = {
        type: 'ADJUSTMENT',
        status: 'COMPLETED',
        fromWarehouseId: selectedWarehouseId,
        items: adjustmentItems,
        notes: `جرد مخزني - ${selectedWh?.name}`,
        createdAt: new Date().toISOString(),
        createdBy: user.uid
      };

      await addDoc(collection(db, 'inventory_transactions'), txData);

      // 2. Update Product Quantities
      for (const item of adjustmentItems) {
        const prodRef = doc(db, 'products', item.productId);
        await updateDoc(prodRef, {
          quantity: item.actualQuantity
        });
      }

      setShowSuccess(true);
      setAdjustments({});
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving adjustment:", error);
      alert("حدث خطأ أثناء حفظ الجرد");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const diffs = Object.entries(adjustments).map(([pid, actual]) => {
      const prod = products.find(p => p.id === pid);
      return Number(actual) - (prod?.quantity || 0);
    });

    return {
      totalItems: Object.keys(adjustments).length,
      surplus: diffs.filter(d => d > 0).length,
      shortage: diffs.filter(d => d < 0).length,
      totalAdjustment: diffs.reduce((a, b) => a + b, 0)
    };
  }, [adjustments, products]);

  return (
    <div className="space-y-8 pb-20" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-100">
                <ShieldCheck className="w-6 h-6" />
             </div>
             <h2 className="text-4xl font-black text-gray-900 tracking-tight">جرد المخزون</h2>
          </div>
          <p className="text-gray-500 font-medium italic pr-2">مطابقة الكميات الفعلية مع أرصدة النظام وتسوية الفروقات</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <WarehouseIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select 
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-2xl pr-10 pl-4 py-3.5 text-sm font-bold shadow-sm focus:ring-4 focus:ring-purple-100 outline-none transition-all appearance-none cursor-pointer"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={handleSaveAdjustment}
            disabled={!hasChanges || isSubmitting}
            className="bg-purple-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-purple-100 flex items-center gap-3 hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
          >
            {isSubmitting ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            اعتماد الجرد والتسوية
          </button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center">
               <Package className="w-7 h-7" />
            </div>
            <div>
               <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">تم تعديله</p>
               <p className="text-xl font-black text-gray-900">{stats.totalItems} صنف</p>
            </div>
         </div>

         <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
               <TrendingUp className="w-7 h-7" />
            </div>
            <div>
               <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">فائض مخزني</p>
               <p className="text-xl font-black text-green-600">{stats.surplus} أصناف</p>
            </div>
         </div>

         <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
               <TrendingDown className="w-7 h-7" />
            </div>
            <div>
               <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">عجز مخزني</p>
               <p className="text-xl font-black text-red-600">{stats.shortage} أصناف</p>
            </div>
         </div>

         <div className="bg-purple-600 p-6 rounded-[2.5rem] shadow-xl shadow-purple-100 flex items-center gap-4 text-white">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
               <RefreshCcw className="w-7 h-7" />
            </div>
            <div>
               <p className="text-xs text-purple-100 font-black uppercase tracking-widest mb-1">إجمالي التسوية</p>
               <p className="text-xl font-black">{stats.totalAdjustment > 0 ? '+' : ''}{stats.totalAdjustment} قطعة</p>
            </div>
         </div>
      </div>

      {/* Search & List Section */}
      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
        <div className="p-8 border-b border-gray-50 bg-gray-50/20">
           <div className="relative">
              <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="ابحث باسم المنتج، الكود، أو الباركود..."
                className="w-full bg-white border border-gray-100 rounded-2xl pr-14 pl-6 py-5 focus:ring-4 focus:ring-purple-100 outline-none text-sm font-bold shadow-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 text-sm font-black text-gray-400 uppercase tracking-widest">
                <th className="px-10 py-6">المنتج / البيانات</th>
                <th className="px-10 py-6">رصيد النظام</th>
                <th className="px-10 py-6 text-center">الكمية الفعلية (الجرد)</th>
                <th className="px-10 py-6">الفارق</th>
                <th className="px-10 py-6 text-left">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <RefreshCcw className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 font-bold">جاري تحميل المخزون...</p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Package className="w-16 h-16 text-gray-200 mx-auto mb-4 opacity-50" />
                    <p className="text-gray-400 font-bold">لم يتم العثور على منتجات</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => {
                  const actual = adjustments[p.id] ?? p.quantity;
                  const diff = actual - p.quantity;
                  
                  return (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      key={p.id} 
                      className={cn(
                        "group transition-all duration-200 hover:bg-gray-50/50",
                        diff !== 0 ? "bg-gray-50/30" : ""
                      )}
                    >
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center group-hover:bg-white transition-colors">
                              <Package className="w-6 h-6 text-gray-300" />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-gray-900 group-hover:text-purple-600 transition-colors">{p.name}</span>
                              <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-tighter mt-1">{p.sku || 'N/A'}</span>
                           </div>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className="text-sm font-black text-gray-700">{p.quantity} قطعة</span>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex justify-center">
                           <div className="relative w-32 group/input">
                              <input 
                                type="number"
                                value={adjustments[p.id] === undefined ? p.quantity : adjustments[p.id]}
                                onChange={(e) => handleQtyChange(p.id, e.target.value)}
                                className={cn(
                                  "w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-center font-black text-sm outline-none transition-all group-hover/input:border-purple-200 focus:ring-4 focus:ring-purple-100",
                                  diff !== 0 ? "border-purple-200 text-purple-600" : ""
                                )}
                              />
                              <EditAction className="absolute -left-2 top-1/2 -translate-y-1/2" />
                           </div>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-2 font-black text-sm">
                           {diff === 0 ? (
                             <span className="text-gray-300">متطابق</span>
                           ) : diff > 0 ? (
                             <span className="text-green-600 flex items-center gap-1">
                               <PlusCircle className="w-4 h-4" />
                               +{diff}
                             </span>
                           ) : (
                             <span className="text-red-600 flex items-center gap-1">
                               <MinusCircle className="w-4 h-4" />
                               {diff}
                             </span>
                           )}
                        </div>
                      </td>
                      <td className="px-10 py-6 text-left">
                         {diff === 0 ? (
                            <CheckCircle2 className="w-5 h-5 text-gray-100 mx-auto" />
                         ) : (
                            <AlertTriangle className={cn("w-5 h-5 mx-auto", diff > 0 ? "text-green-500" : "text-red-500")} />
                         )}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Success Notification */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-12 left-12 z-[100] bg-gray-900 border border-gray-800 text-white px-10 py-6 rounded-[2.5rem] shadow-2xl flex items-center gap-6"
          >
            <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-500/20">
               <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="flex flex-col">
               <span className="text-lg font-black tracking-tight">تم اعتماد الجرد بنجاح!</span>
               <span className="text-sm font-bold text-gray-400">تم تحديث كميات المخزون وتسوية الفروقات في قاعدة البيانات.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EditAction({ className }: { className?: string }) {
  return (
    <div className={cn("w-6 h-6 bg-purple-600 rounded-lg flex items-center justify-center text-white shadow-sm opacity-0 group-hover/input:opacity-100 transition-opacity", className)}>
       <RefreshCcw className="w-3 h-3" />
    </div>
  );
}
