import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  Package, 
  Tag, 
  Layers,
  ChevronRight,
  ChevronLeft,
  PackagePlus
} from 'lucide-react';
import { productsService } from '../services/firestore';
import { Product } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import CategoriesAndBrands from './products/CategoriesAndBrands';

export default function Products() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const initialTab = new URLSearchParams(location.search).get('tab') === 'settings' ? 'settings' : 'products';
  const [activeTab, setActiveTab] = useState<'products' | 'settings'>(initialTab);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await productsService.getAll();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setActiveTab(params.get('tab') === 'settings' ? 'settings' : 'products');
  }, [location.search]);

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.')) {
      try {
        await deleteDoc(doc(db, 'products', id));
        loadProducts();
      } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء الحذف');
      }
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const handleBulkDeleteProducts = async () => {
    if (selectedProductIds.length === 0) return;
    const confirmMessage = `هل أنت متأكد من حذف ${selectedProductIds.length} منتج(ات)؟ لا يمكن التراجع عن هذا الإجراء.`;
    if (window.confirm(confirmMessage)) {
      setDeleteLoading(true);
      try {
        for (const id of selectedProductIds) {
          await deleteDoc(doc(db, 'products', id));
        }
        setSelectedProductIds([]);
        loadProducts();
        alert(`تم حذف ${selectedProductIds.length} منتج(ات) بنجاح!`);
      } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء حذف المنتجات المحددة');
      } finally {
        setDeleteLoading(false);
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && String(p.barcode).includes(searchTerm))
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">إدارة المنتجات والأصناف</h2>
          <p className="text-gray-500 mt-1">عرض وإدارة مخزونك من الأحذية والماركات والتصنيفات</p>
        </div>
        {activeTab === 'products' && (
          <Link 
            to="/inventory/products/add"
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <PackagePlus className="w-5 h-5" />
            إضافة منتج جديد
          </Link>
        )}
      </div>

      <div className="flex items-center gap-4 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('products')}
          className={cn(
            "px-6 py-3 text-sm font-bold transition-all relative",
            activeTab === 'products' ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
          )}
        >
          قائمة المنتجات
          {activeTab === 'products' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-[-8px] left-0 right-0 h-1 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "px-6 py-3 text-sm font-bold transition-all relative",
            activeTab === 'settings' ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"
          )}
        >
          إعدادات التصنيفات والبراندات
          {activeTab === 'settings' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-[-8px] left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'settings' ? (
        <CategoriesAndBrands />
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex-1 w-full relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="ابحث بالاسم، الماركة، أو الباركود..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl pr-12 pl-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button className="bg-white border border-gray-100 p-3 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <div className="h-10 w-[1px] bg-gray-100 mx-2"></div>
          <div className="flex bg-gray-50 p-1 rounded-xl">
            <button className="bg-white px-4 py-2 rounded-lg text-sm font-bold text-blue-600 shadow-sm">الكل</button>
            <button className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600">نشط</button>
            <button className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600">منتهي</button>
          </div>
          {selectedProductIds.length > 0 && (
            <div className="h-10 w-[1px] bg-gray-100 mx-2"></div>
          )}
          {selectedProductIds.length > 0 && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleBulkDeleteProducts}
              disabled={deleteLoading}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              حذف {selectedProductIds.length}
            </motion.button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-gray-50 text-sm text-gray-400 uppercase font-black border-b border-gray-100">
              <th className="px-8 py-4 w-12">
                <input
                  type="checkbox"
                  checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="اختر الكل"
                />
              </th>
              <th className="px-8 py-4 tracking-widest">اسم المنتج</th>
              <th className="px-8 py-4 tracking-widest">الماركة</th>
              <th className="px-8 py-4 tracking-widest">الباركود</th>
              <th className="px-8 py-4 tracking-widest">الفئة</th>
              <th className="px-8 py-4 tracking-widest">السعر</th>
              <th className="px-8 py-4 tracking-widest">الكمية</th>
              <th className="px-8 py-4 tracking-widest">الحالة</th>
              <th className="px-8 py-4 tracking-widest"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              [1, 2, 3, 4].map(i => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={8} className="px-8 py-6 h-20 bg-gray-50/50 rounded-lg m-2"></td>
                </tr>
              ))
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-8 py-20 text-center text-gray-400 font-medium">
                  لا توجد منتجات مطابقة للبحث
                </td>
              </tr>
            ) : filteredProducts.map((product) => (
              <tr key={product.id} className={cn("group transition-colors", selectedProductIds.includes(product.id) ? "bg-blue-50/50 hover:bg-blue-50/70" : "hover:bg-blue-50/30")}>
                <td className="px-8 py-6 w-12">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(product.id)}
                    onChange={() => toggleSelectProduct(product.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center p-2 group-hover:bg-white transition-colors">
                      <Package className="w-8 h-8 text-gray-300 group-hover:text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{product.name}</span>
                      <span className="text-sm text-gray-400 font-bold uppercase tracking-wider">{product.sku || 'N/A'}</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">{product.brand}</span>
                </td>
                <td className="px-8 py-6">
                  <span className="text-sm font-bold text-gray-700">{product.barcode || 'N/A'}</span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Tag className="w-4 h-4" />
                    <span className="text-sm">{product.category}</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(product.sellingPrice)}</span>
                    <span className="text-sm text-gray-400 line-through">{formatCurrency(product.costPrice)}</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-gray-400" />
                    <span className={cn("text-sm font-bold", product.quantity <= 5 ? "text-red-500" : "text-gray-700")}>
                      {product.quantity} قطعة
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6">
                   <span className={cn(
                     "px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider",
                     product.quantity > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                   )}>
                     {product.quantity > 0 ? 'متوفر' : 'نفذ'}
                   </span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => navigate(`/inventory/products/edit/${product.id}`)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title="تعديل"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(product.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}

    </div>
  );
}



