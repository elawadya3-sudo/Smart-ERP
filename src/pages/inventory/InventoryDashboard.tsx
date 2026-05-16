import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Package, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  History,
  FileText,
  Warehouse as WarehouseIcon,
  Search,
  Filter,
  MoreVertical,
  ChevronLeft,
  AlertCircle,
  TrendingUp,
  PackagePlus
} from 'lucide-react';
import { motion } from 'motion/react';
import { inventoryTransactionService, warehouseService } from '../../services/inventory';
import { productsService } from '../../services/firestore';
import { InventoryTransaction, Warehouse, Product } from '../../types';
import { cn, formatDate } from '../../lib/utils';

export default function InventoryDashboard() {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">إدارة المخزون</h2>
          <p className="text-gray-500 mt-1">نظام إدارة المستودعات وحركات المخزون المتكاملة</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Link to="/inventory/products" className="bg-white text-blue-600 px-5 py-2.5 rounded-xl border border-blue-100 font-bold text-sm flex items-center gap-2 hover:bg-blue-50 transition-all shadow-sm">
            <Package className="w-4 h-4" />
            إدارة المنتجات
          </Link>
          <Link to="/inventory/products/add" className="bg-white text-blue-600 px-5 py-2.5 rounded-xl border border-blue-100 font-bold text-sm flex items-center gap-2 hover:bg-blue-50 transition-all shadow-sm">
            <PackagePlus className="w-4 h-4" />
            إضافة منتج جديد
          </Link>
          <button className="bg-white text-gray-700 px-5 py-2.5 rounded-xl border border-gray-100 font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm">
            <WarehouseIcon className="w-4 h-4" />
            المستودعات ({warehouses.length})
          </button>
          <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" />
            عملية مخزنية جديدة
          </button>
        </div>
      </div>

      {/* Quick Action Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Link to="/inventory/products" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all">
          <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">كاتالوج المنتجات</h3>
          <p className="text-gray-500 text-sm font-medium leading-relaxed mt-1">إدارة الأصناف، التفاصيل، والأسعار</p>
        </Link>

        <Link to="/inventory/receipt" className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-100 relative overflow-hidden group cursor-pointer hover:-translate-y-1 transition-all">
          <ArrowDownLeft className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform" />
          <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg">توريد بضاعة</h3>
          <p className="text-blue-100 text-sm font-medium leading-relaxed mt-1">استلام شحنات جديدة وتحديث الأرصدة</p>
        </Link>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all">
          <div className="bg-orange-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-orange-600">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">تحويل مخزني</h3>
          <p className="text-gray-500 text-sm font-medium leading-relaxed mt-1">نقل المنتجات بين الفروع والمستودعات بكل سهولة</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all">
          <div className="bg-purple-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-purple-600">
            <History className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">جرد المخزون</h3>
          <p className="text-gray-500 text-sm font-medium leading-relaxed mt-1">مطابقة الكميات الفعلية مع النظام وتسوية الفروقات</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all">
          <div className="bg-green-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-green-600">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">التقارير</h3>
          <p className="text-gray-500 text-sm font-medium leading-relaxed mt-1">تحليلات الأرصدة، معدل الدوران، وقيمة المخزون</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              آخر الحركات المخزنية
            </h3>
            <button className="text-sm font-bold text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-colors">عرض السجل الكامل</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50/50 text-sm text-gray-400 uppercase font-black">
                <tr className="border-b border-gray-100">
                  <th className="px-8 py-4">النوع</th>
                  <th className="px-8 py-4">المرجع</th>
                  <th className="px-8 py-4">الأصناف</th>
                  <th className="px-8 py-4">التاريخ</th>
                  <th className="px-8 py-4">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-gray-400 font-medium italic">
                      لا يوجد حركات مخزنية مسجلة حالياً
                    </td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx.id} className="group hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            tx.type === 'RECEIPT' ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                          )}>
                             {tx.type === 'RECEIPT' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
                          </div>
                          <span className="text-sm font-bold text-gray-900">{getTypeName(tx.type)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-sm font-mono text-gray-500">{tx.reference || `#WH-${tx.id.slice(0, 6)}`}</td>
                      <td className="px-8 py-4 text-sm text-gray-600">{tx.items.length} منتجات</td>
                      <td className="px-8 py-4 text-sm text-gray-400 font-medium">{formatDate(tx.createdAt)}</td>
                      <td className="px-8 py-4">
                        <span className={cn("px-2.5 py-1 rounded-full text-sm font-bold uppercase", getStatusColor(tx.status))}>
                          {tx.status === 'COMPLETED' ? 'مكتمل' : 'قيد المعالجة'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              تنبيهات لإعادة الطلب
            </h3>
            <div className="space-y-4">
               {products.filter(p => p.quantity <= 5).slice(0, 4).map(product => (
                 <div key={product.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl border border-transparent hover:border-gray-100 transition-all group">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-white">
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                      <p className="text-sm text-red-500 font-bold uppercase">المخزون: {product.quantity} قطعة</p>
                    </div>
                    <button className="text-sm font-bold text-blue-600 hover:underline">طلب توريد</button>
                 </div>
               ))}
               {products.filter(p => p.quantity <= 5).length === 0 && (
                 <p className="text-center text-gray-400 text-sm py-10 font-medium italic">المخزون في حالة جيدة حالياً</p>
               )}
            </div>
          </div>

          <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <h3 className="font-bold text-lg mb-2 relative z-10">قيمة المخزون الكلية</h3>
            <p className="text-3xl font-black text-blue-400 relative z-10">
              {new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(
                products.reduce((acc, p) => acc + (p.quantity * p.costPrice), 0)
              )}
            </p>
            <p className="text-gray-400 text-sm font-medium mt-4 border-t border-white/10 pt-4 relative z-10 flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-green-500" />
              زيادة 4.2% عن الشهر الماضي
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


