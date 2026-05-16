import React, { useState, useEffect } from 'react';
import { 
  ArrowDownLeft, 
  Package, 
  Search, 
  Plus, 
  Trash2, 
  Save, 
  User, 
  FileText,
  Boxes
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { productsService } from '../../services/firestore';
import { warehouseService, inventoryTransactionService } from '../../services/inventory';
import { Product, Warehouse, OrderItem } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export default function GoodsReceiptPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [reference, setReference] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [prods, whs] = await Promise.all([productsService.getAll(), warehouseService.getAll()]);
      setProducts(prods);
      setWarehouses(whs);
      if (whs.length > 0) setSelectedWarehouse(whs[0].id);
    };
    load();
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

  const handleSubmit = async () => {
    if (!selectedWarehouse || cart.length === 0) return;
    setLoading(true);
    try {
      await inventoryTransactionService.createStockMovement({
        type: 'RECEIPT',
        status: 'COMPLETED',
        toWarehouseId: selectedWarehouse,
        items: cart,
        reference,
        createdBy: user?.uid || 'anonymous'
      });
      alert('تم استلام البضاعة وتحديث المخزون بنجاح!');
      setCart([]);
      setReference('');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء معالجة الطلب');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">توريد بضاعة جديد</h2>
          <p className="text-gray-500 mt-1">استلام شحنات من الموردين وتوجيهها للمستودع</p>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={loading || cart.length === 0}
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:bg-gray-300 transition-all flex items-center gap-2"
        >
          {loading ? <Plus className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
          تأكيد وحفظ الإذن
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-280px)]">
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-gray-100 p-8 flex flex-col shadow-sm">
           <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 text-lg">
             <ArrowDownLeft className="w-5 h-5 text-green-600" />
             تفاصيل الاستلام
           </h3>
           
           <div className="space-y-6 flex-1">
             <div className="space-y-2 text-right">
               <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">المستودع المستلم</label>
               <select 
                 className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold appearance-none"
                 value={selectedWarehouse}
                 onChange={e => setSelectedWarehouse(e.target.value)}
               >
                 {warehouses.map(wh => (<option key={wh.id} value={wh.id}>{wh.name} (كود: {wh.code})</option>))}
               </select>
             </div>

             <div className="space-y-2 text-right">
               <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">مرجع الفاتورة / المورد</label>
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

             <div className="pt-6 mt-6 border-t border-gray-50">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">ملخص الأصناف</h4>
                <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-none pr-1">
                   {cart.length === 0 ? (
                     <p className="text-sm text-gray-400 italic text-center py-10 font-medium">لم يتم إضافة منتجات بعد</p>
                   ) : cart.map((item: any) => (
                     <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group relative">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                             <Package className="w-4 h-4" />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-gray-900 leading-none">{item.productName}</p>
                              <p className="text-sm text-gray-500 font-bold mt-1">الكمية: {item.quantity}</p>
                           </div>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.productId)}
                          className="w-7 h-7 bg-white text-red-400 rounded-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all font-bold"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                     </div>
                   ))}
                </div>
             </div>
           </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 flex flex-col shadow-sm overflow-hidden">
           <div className="p-8 border-b border-gray-50 bg-gray-50/20">
             <div className="relative">
                <Search className="absolute right-4 top-3.5 w-5 h-5 text-gray-400" />
                <input 
                  type="text" placeholder="ابحث عن المنتجات لإضافتها للإذن..."
                  className="w-full bg-white border border-gray-100 rounded-2xl pr-12 pl-4 py-3.5 focus:ring-4 focus:ring-blue-50 outline-none text-sm font-bold shadow-sm"
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
                  className="flex items-center gap-4 p-4 rounded-3xl border border-gray-100 hover:border-blue-500 hover:shadow-lg transition-all group text-right active:scale-95"
                >
                   <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                     <Boxes className="w-8 h-8" />
                   </div>
                   <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-sm">{p.name}</h4>
                      <p className="text-sm text-gray-400 font-bold uppercase tracking-tight">{p.brand} | المخزون: {p.quantity} قطعة</p>
                      <span className="text-sm font-black text-blue-600 block mt-1">{formatCurrency(p.costPrice || 0)} <span className="text-sm text-gray-400 font-medium">سعر التكلفة</span></span>
                   </div>
                   <div className="w-10 h-10 bg-gray-50 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                      <Plus className="w-5 h-5" />
                   </div>
                </button>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}


