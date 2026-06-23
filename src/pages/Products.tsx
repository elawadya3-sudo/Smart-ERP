import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  PackagePlus,
  AlertTriangle,
  Grid3X3,
  List,
  RefreshCw,
  Download,
  ChevronDown,
  X,
  SlidersHorizontal,
  TrendingDown,
  Palette,
  BarChart3,
  Printer,
  QrCode,
  CheckSquare,
  History
} from 'lucide-react';
import { productsService } from '../services/firestore';
import { Product } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import CategoriesAndBrands from './products/CategoriesAndBrands';
import BarcodePrintModal from '../components/products/BarcodePrintModal';
import ProductLedger from './inventory/ProductLedger';

// ─── MEMOIZED PRODUCT ROW (TABLE VIEW) ──────────────────────────────────
const ProductRow = React.memo(({ 
  product, 
  isSelected, 
  onToggle, 
  onDelete, 
  onEdit, 
  onPrintBarcode, 
  formatCurrency 
}: { 
  product: Product; 
  isSelected: boolean; 
  onToggle: () => void; 
  onDelete: () => void; 
  onEdit: () => void; 
  onPrintBarcode: () => void; 
  formatCurrency: (v: number) => string; 
}) => {
  return (
    <tr className={cn("group transition-colors", isSelected ? "bg-blue-50/60" : "hover:bg-gray-50/60")}>
      <td className="px-5 py-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center border border-gray-100 group-hover:border-blue-100 transition-colors flex-shrink-0">
            <Package className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors leading-tight">
              {product.name}
            </p>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider font-mono mt-0.5">
              {product.sku || '—'}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        {product.brand ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
            {product.brand}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-gray-500">
          <Tag className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-xs font-medium">{product.category || '—'}</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-xs font-bold text-gray-500 font-mono tracking-wider">
          {product.barcode || '—'}
        </span>
      </td>
      <td className="px-5 py-4">
        <div>
          <p className="text-sm font-black text-gray-900">{formatCurrency(product.sellingPrice)}</p>
          <p className="text-xs text-gray-300 line-through font-medium">{formatCurrency(product.costPrice)}</p>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-gray-300" />
          <span className={cn(
            "text-sm font-black",
            product.quantity <= 0 ? "text-red-500" :
            product.quantity <= 5 ? "text-amber-500" :
            "text-gray-800"
          )}>
            {product.quantity}
          </span>
          <span className="text-xs text-gray-400 font-medium">قطعة</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className={cn(
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
          product.quantity <= 0
            ? "bg-red-50 text-red-600 border border-red-100"
            : product.quantity <= 5
              ? "bg-amber-50 text-amber-600 border border-amber-100"
              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
        )}>
          {product.quantity <= 0 ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
              نفذ
            </>
          ) : product.quantity <= 5 ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              منخفض
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              متوفر
            </>
          )}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-end gap-1">
          <Link
            to={`/inventory/products?tab=ledger&productId=${product.id}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
            title="كشف الحساب (حركة المنتج)"
          >
            <History className="w-3.5 h-3.5" />
          </Link>
          {product.barcode && (
            <button
              onClick={(e) => { e.preventDefault(); onPrintBarcode(); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              title="طباعة الباركود"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="تعديل"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="حذف"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}, (prev, next) => {
  return prev.isSelected === next.isSelected && 
         prev.product.id === next.product.id &&
         prev.product.name === next.product.name &&
         prev.product.quantity === next.product.quantity &&
         prev.product.sellingPrice === next.product.sellingPrice &&
         prev.product.costPrice === next.product.costPrice &&
         prev.product.brand === next.product.brand &&
         prev.product.category === next.product.category &&
         prev.product.barcode === next.product.barcode &&
         prev.product.sku === next.product.sku;
});

// ─── MEMOIZED PRODUCT CARD (GRID VIEW) ──────────────────────────────────
const ProductCard = React.memo(({ 
  product, 
  isSelected, 
  onToggle, 
  onDelete, 
  onEdit, 
  onPrintBarcode, 
  formatCurrency 
}: { 
  product: Product; 
  isSelected: boolean; 
  onToggle: () => void; 
  onDelete: () => void; 
  onEdit: () => void; 
  onPrintBarcode: () => void; 
  formatCurrency: (v: number) => string; 
}) => {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border shadow-sm hover:shadow-md transition-all group cursor-pointer overflow-hidden",
        isSelected
          ? "border-blue-300 bg-blue-50/30"
          : "border-gray-100 hover:border-blue-100"
      )}
      onClick={onToggle}
    >
      <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative">
        <Package className="w-12 h-12 text-gray-200 group-hover:text-blue-200 transition-colors" />
        <div className="absolute top-2 right-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onToggle(); }}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
        <span className={cn(
          "absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black",
          product.quantity <= 0 ? "bg-red-500 text-white" :
          product.quantity <= 5 ? "bg-amber-500 text-white" :
          "bg-emerald-500 text-white"
        )}>
          {product.quantity <= 0 ? 'نفذ' : product.quantity <= 5 ? 'منخفض' : 'متوفر'}
        </span>
      </div>

      <div className="p-3.5">
        <p className="font-bold text-gray-900 text-sm leading-tight truncate">{product.name}</p>
        <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">{product.brand || '—'}</p>
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-sm font-black text-blue-600">{formatCurrency(product.sellingPrice)}</span>
          <span className="text-xs text-gray-400 font-bold">{product.quantity} ق</span>
        </div>

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
          <div className="flex gap-1">
            <Link
              to={`/inventory/products?tab=ledger&productId=${product.id}`}
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
              title="كشف الحساب (حركة المنتج)"
            >
              <History className="w-3.5 h-3.5" />
            </Link>
            {product.barcode && (
              <button
                onClick={(e) => { e.stopPropagation(); onPrintBarcode(); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                title="طباعة الباركود"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="تعديل"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="حذف"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.isSelected === next.isSelected && 
         prev.product.id === next.product.id &&
         prev.product.name === next.product.name &&
         prev.product.quantity === next.product.quantity &&
         prev.product.sellingPrice === next.product.sellingPrice &&
         prev.product.costPrice === next.product.costPrice &&
         prev.product.brand === next.product.brand &&
         prev.product.category === next.product.category &&
         prev.product.barcode === next.product.barcode &&
         prev.product.sku === next.product.sku;
});

export default function Products() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Performance Tracking Variables
  const renderStartTime = performance.now();
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const startMountTimeRef = useRef(performance.now());
  const dbQueryCountRef = useRef(0);
  const perfContainerRef = useRef<HTMLDivElement>(null);

  const [metrics, setMetrics] = useState({
    mountTime: 0,
    dbFetchTime: 0,
    renderTime: 0,
    filterTime: 0,
    renderCount: 0,
    dbQueryCount: 0
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const initialTab = new URLSearchParams(location.search).get('tab') === 'settings'
    ? 'settings'
    : new URLSearchParams(location.search).get('tab') === 'barcode'
      ? 'barcode'
      : new URLSearchParams(location.search).get('tab') === 'ledger'
        ? 'ledger'
        : 'products';
  const [activeTab, setActiveTab] = useState<'products' | 'settings' | 'barcode' | 'ledger'>(initialTab);
  const [barcodePrintOpen, setBarcodePrintOpen] = useState(false);
  const [barcodePrintProducts, setBarcodePrintProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'out'>('all');
  const [showMoreActions, setShowMoreActions] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  const loadProducts = useCallback(async () => {
    const startFetch = performance.now();
    dbQueryCountRef.current += 1;
    setLoading(true);
    try {
      const data = await productsService.getAll();
      const endFetch = performance.now();
      const fetchDuration = endFetch - startFetch;
      
      setMetrics(prev => ({
        ...prev,
        dbFetchTime: fetchDuration,
        dbQueryCount: dbQueryCountRef.current
      }));
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'products' || activeTab === 'barcode') {
      loadProducts();
    }
    
    // Page mount timer
    const mountDuration = performance.now() - startMountTimeRef.current;
    setMetrics(prev => ({
      ...prev,
      mountTime: mountDuration
    }));
  }, [loadProducts, activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    setActiveTab(
      tab === 'settings' ? 'settings' :
      tab === 'barcode' ? 'barcode' :
      tab === 'ledger' ? 'ledger' :
      'products'
    );
  }, [location.search]);

  // Open barcode print modal with specific products
  const openBarcodePrint = useCallback((productsToUse?: Product[]) => {
    const toPrint = productsToUse ?? (
      selectedProductIds.length > 0
        ? products.filter(p => selectedProductIds.includes(p.id))
        : products
    );
    setBarcodePrintProducts(toPrint);
    setBarcodePrintOpen(true);
  }, [products, selectedProductIds]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(e.target as Node)) {
        setShowMoreActions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDeleteProduct = useCallback(async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.')) {
      try {
        await deleteDoc(doc(db, 'products', id));
        loadProducts();
      } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء الحذف');
      }
    }
  }, [loadProducts]);

  const toggleSelectProduct = useCallback((id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

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

  const { filteredProducts, filterTime } = useMemo(() => {
    const start = performance.now();
    const filtered = products.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && String(p.barcode).includes(searchTerm));
      const matchStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? p.quantity > 0 :
        p.quantity <= 0;
      return matchSearch && matchStatus;
    });
    const end = performance.now();
    return { filteredProducts: filtered, filterTime: end - start };
  }, [products, searchTerm, statusFilter]);

  // Stats derived from products - Memoized
  const { totalProducts, uniqueCategories, uniqueBrands, lowStockCount, outOfStockCount } = useMemo(() => {
    const total = products.length;
    const uniqueCats = new Set(products.map(p => p.category).filter(Boolean)).size;
    const uniqueBrs = new Set(products.map(p => p.brand).filter(Boolean)).size;
    const lowStock = products.filter(p => p.quantity <= 5 && p.quantity > 0).length;
    const outOfStock = products.filter(p => p.quantity <= 0).length;
    return {
      totalProducts: total,
      uniqueCategories: uniqueCats,
      uniqueBrands: uniqueBrs,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock
    };
  }, [products]);

  // Zero-overhead rendering metrics logger using DOM text updates
  useEffect(() => {
    const renderEnd = performance.now();
    const renderDuration = renderEnd - renderStartTime;
    
    if (perfContainerRef.current) {
      const mountSpan = perfContainerRef.current.querySelector('#perf-mount-time');
      const dbSpan = perfContainerRef.current.querySelector('#perf-db-time');
      const renderSpan = perfContainerRef.current.querySelector('#perf-render-time');
      const filterSpan = perfContainerRef.current.querySelector('#perf-filter-time');
      const countSpan = perfContainerRef.current.querySelector('#perf-render-count');
      const querySpan = perfContainerRef.current.querySelector('#perf-query-count');
      
      if (mountSpan) mountSpan.textContent = `${metrics.mountTime.toFixed(1)}ms`;
      if (dbSpan) dbSpan.textContent = `${metrics.dbFetchTime.toFixed(1)}ms`;
      if (renderSpan) renderSpan.textContent = `${renderDuration.toFixed(1)}ms`;
      if (filterSpan) filterSpan.textContent = `${filterTime.toFixed(2)}ms`;
      if (countSpan) countSpan.textContent = String(renderCountRef.current);
      if (querySpan) querySpan.textContent = String(dbQueryCountRef.current);
    }
  });

  return (
    <div className="min-h-screen bg-gray-50/50" dir="rtl">
      
      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-1">
              <span>المخازن</span>
              <ChevronLeft className="w-3 h-3" />
              <span>بيانات أساسية</span>
              <ChevronLeft className="w-3 h-3" />
              <span className="text-blue-600">إدارة الأصناف</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">إدارة الأصناف</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              عرض وإدارة دليل الأصناف، التصنيفات، والعلامات التجارية
            </p>
          </div>

          {activeTab === 'products' && (
            <div className="flex items-center gap-2">
              <button
                onClick={loadProducts}
                title="تحديث"
                className="p-2.5 border border-gray-200 rounded-xl text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <Link
                to="/inventory/products/add"
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <PackagePlus className="w-4 h-4" />
                إضافة صنف جديد
              </Link>
            </div>
          )}
        </div>

        {/* ─── Stats Bar ──────────────────────────────────────────────────── */}
        {activeTab === 'products' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">إجمالي الأصناف</p>
                <p className="text-xl font-black text-blue-700 leading-none mt-0.5">{totalProducts}</p>
              </div>
            </div>
            <div className="bg-indigo-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Tag className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">التصنيفات</p>
                <p className="text-xl font-black text-indigo-700 leading-none mt-0.5">{uniqueCategories}</p>
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                <Palette className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider">البراندات</p>
                <p className="text-xl font-black text-purple-700 leading-none mt-0.5">{uniqueBrands}</p>
              </div>
            </div>
            <div className={cn(
              "rounded-xl px-4 py-3 flex items-center gap-3",
              lowStockCount > 0 || outOfStockCount > 0 ? "bg-red-50" : "bg-emerald-50"
            )}>
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center",
                lowStockCount > 0 || outOfStockCount > 0 ? "bg-red-100" : "bg-emerald-100"
              )}>
                <TrendingDown className={cn(
                  "w-4 h-4",
                  lowStockCount > 0 || outOfStockCount > 0 ? "text-red-600" : "text-emerald-600"
                )} />
              </div>
              <div>
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-wider",
                  lowStockCount > 0 || outOfStockCount > 0 ? "text-red-400" : "text-emerald-400"
                )}>منخفض / نفذ</p>
                <p className={cn(
                  "text-xl font-black leading-none mt-0.5",
                  lowStockCount > 0 || outOfStockCount > 0 ? "text-red-700" : "text-emerald-700"
                )}>
                  {lowStockCount + outOfStockCount}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Main Content ─────────────────────────────────────────────────── */}
      <div className="p-6 space-y-4">

        {/* ─── Performance Profiling Panel ────────────────────────────────── */}
        <div 
          ref={perfContainerRef}
          className="bg-slate-900 text-slate-100 rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
          <div className="flex items-center gap-2.5 relative z-10">
            <div className="w-9 h-9 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30">
              <BarChart3 className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">أدوات قياس الأداء (Performance Profiling)</h3>
              <p className="text-xs text-slate-400">مراقبة حية لسرعة استجابة واستهلاك الموارد لصفحة المنتجات</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex items-center gap-3 md:gap-6 w-full md:w-auto relative z-10">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-right min-w-[100px]">
              <p className="text-[10px] font-bold text-slate-400">تحميل الواجهة</p>
              <p id="perf-mount-time" className="text-sm font-black text-blue-400 font-mono mt-0.5">0.0ms</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-right min-w-[100px]">
              <p className="text-[10px] font-bold text-slate-400">جلب البيانات (DB)</p>
              <p id="perf-db-time" className="text-sm font-black text-amber-400 font-mono mt-0.5">0.0ms</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-right min-w-[100px]">
              <p className="text-[10px] font-bold text-slate-400">Render المكونات</p>
              <p id="perf-render-time" className="text-sm font-black text-emerald-400 font-mono mt-0.5">0.0ms</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-right min-w-[100px]">
              <p className="text-[10px] font-bold text-slate-400">البحث والفلترة</p>
              <p id="perf-filter-time" className="text-sm font-black text-purple-400 font-mono mt-0.5">0.0ms</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-right min-w-[80px]">
              <p className="text-[10px] font-bold text-slate-400">Renders</p>
              <p id="perf-render-count" className="text-sm font-black text-pink-400 font-mono mt-0.5">0</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-right min-w-[80px]">
              <p className="text-[10px] font-bold text-slate-400">استعلامات DB</p>
              <p id="perf-query-count" className="text-sm font-black text-cyan-400 font-mono mt-0.5">0</p>
            </div>
          </div>
        </div>

        {/* ─── Tab Bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit shadow-sm">
          <button
            onClick={() => setActiveTab('products')}
            className={cn(
              "px-5 py-2 text-sm font-bold transition-all rounded-lg flex items-center gap-2",
              activeTab === 'products'
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            )}
          >
            <Package className="w-4 h-4" />
            قائمة الأصناف
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "px-5 py-2 text-sm font-bold transition-all rounded-lg flex items-center gap-2",
              activeTab === 'settings'
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            )}
          >
            <Tag className="w-4 h-4" />
            التصنيفات والبراندات
          </button>
          <button
            onClick={() => setActiveTab('barcode')}
            className={cn(
              "px-5 py-2 text-sm font-bold transition-all rounded-lg flex items-center gap-2 relative",
              activeTab === 'barcode'
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            )}
          >
            <Printer className="w-4 h-4" />
            طباعة الباركود
            {products.filter(p => p.barcode).length > 0 && activeTab !== 'barcode' && (
              <span className="absolute -top-1 -left-1 w-4 h-4 bg-indigo-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {products.filter(p => p.barcode).length > 9 ? '9+' : products.filter(p => p.barcode).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={cn(
              "px-5 py-2 text-sm font-bold transition-all rounded-lg flex items-center gap-2",
              activeTab === 'ledger'
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            )}
          >
            <History className="w-4 h-4" />
            كشف حساب المنتج
          </button>
        </div>

        {activeTab === 'settings' ? (
          <CategoriesAndBrands />
        ) : activeTab === 'barcode' ? (
          /* ─── Barcode Print Full Page Tab ───────────────────────────── */
          <div className="space-y-4">
            {/* Intro banner */}
            <div className="bg-gradient-to-l from-indigo-600 to-indigo-700 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Printer className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black">طباعة ملصقات الباركود</h2>
                  <p className="text-indigo-200 text-sm font-medium mt-0.5">
                    اختر الأصناف، حدد مقاس الملصق، وابدأ الطباعة
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">الأصناف بباركود</p>
                  <p className="text-2xl font-black">{products.filter(p => p.barcode).length}</p>
                </div>
                <button
                  onClick={() => openBarcodePrint(products.filter(p => p.barcode))}
                  className="bg-white text-indigo-700 font-black px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  طباعة الكل
                </button>
              </div>
            </div>

            {/* Products grid for selection */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-gray-800">اختر الأصناف للطباعة</h3>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">حدد الأصناف ثم اضغط "طباعة المحدد"</p>
                </div>
                <AnimatePresence>
                  {selectedProductIds.length > 0 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => openBarcodePrint()}
                      className="bg-indigo-600 text-white font-black px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      طباعة المحدد ({selectedProductIds.length})
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Search bar inside barcode tab */}
              <div className="relative mb-4">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ابحث باسم الصنف أو الباركود..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-50 rounded-lg pr-10 pl-9 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-100 focus:bg-white outline-none transition-all border border-transparent focus:border-indigo-100"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {loading ? (
                  [1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="animate-pulse bg-gray-50 rounded-xl p-4 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-200 rounded w-1/2" />
                      <div className="h-8 bg-gray-200 rounded-lg w-full mt-2" />
                    </div>
                  ))
                ) : filteredProducts.filter(p => p.barcode).length === 0 ? (
                  <div className="col-span-full py-16 text-center">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Printer className="w-7 h-7 text-indigo-300" />
                    </div>
                    <p className="text-sm font-bold text-gray-500">لا توجد أصناف بباركود</p>
                    <p className="text-xs text-gray-400 mt-1">أضف رمز الباركود للأصناف من صفحة تعديل الصنف</p>
                  </div>
                ) : (
                  filteredProducts.filter(p => p.barcode).map(product => (
                    <motion.div
                      key={product.id}
                      layout
                      onClick={() => toggleSelectProduct(product.id)}
                      className={cn(
                        "relative border rounded-xl p-3.5 cursor-pointer transition-all group",
                        selectedProductIds.includes(product.id)
                          ? "border-indigo-400 bg-indigo-50 shadow-sm shadow-indigo-100"
                          : "border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30"
                      )}
                    >
                      {/* Checkbox */}
                      <div className="absolute top-2.5 left-2.5">
                        <div className={cn(
                          "w-5 h-5 rounded flex items-center justify-center border-2 transition-all",
                          selectedProductIds.includes(product.id)
                            ? "bg-indigo-600 border-indigo-600"
                            : "border-gray-300 group-hover:border-indigo-300"
                        )}>
                          {selectedProductIds.includes(product.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Product info */}
                      <p className="font-bold text-sm text-gray-900 truncate pl-7">{product.name}</p>
                      <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">{product.brand || '—'}</p>

                      {/* Barcode preview */}
                      <div className="mt-2.5 bg-white rounded-lg border border-gray-100 p-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-gray-500 font-bold truncate flex-1">{product.barcode}</span>
                        <span className="text-xs font-black text-indigo-600 flex-shrink-0">{formatCurrency(product.sellingPrice)}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openBarcodePrint([product]); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          طباعة الباركود
                        </button>
                        <Link
                          to={`/inventory/products?tab=ledger&productId=${product.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100"
                        >
                          <History className="w-3.5 h-3.5" />
                          كشف الحساب
                        </Link>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Products without barcodes notice */}
              {products.filter(p => !p.barcode).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs font-bold text-amber-600">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {products.filter(p => !p.barcode).length} صنف بدون باركود — لن تظهر في قائمة الطباعة
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'ledger' ? (
          <ProductLedger />
        ) : (
          <>
            {/* ─── Toolbar ──────────────────────────────────────────────────── */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ابحث باسم الصنف، الماركة، أو الباركود..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-50 rounded-lg pr-10 pl-9 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-100 focus:bg-white outline-none transition-all border border-transparent focus:border-blue-100"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex bg-gray-50 p-1 rounded-lg gap-0.5 border border-gray-100">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'active', label: 'متوفر' },
                  { id: 'out', label: 'نفذ' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                      statusFilter === f.id
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* View toggle */}
              <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    viewMode === 'table' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                  title="عرض جدول"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    viewMode === 'grid' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                  title="عرض شبكي"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>

              {/* Bulk Actions (shown when items selected) */}
              <AnimatePresence>
                {selectedProductIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-2 flex-wrap"
                  >
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                      {selectedProductIds.length} محدد
                    </span>
                    <button
                      onClick={() => openBarcodePrint()}
                      className="bg-indigo-50 border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      طباعة باركود
                    </button>
                    <button
                      onClick={handleBulkDeleteProducts}
                      disabled={deleteLoading}
                      className="bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف المحدد
                    </button>
                    <button
                      onClick={() => setSelectedProductIds([])}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* More Actions Dropdown */}
              <div className="relative" ref={moreActionsRef}>
                <button
                  onClick={() => setShowMoreActions(!showMoreActions)}
                  className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 font-bold hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  إجراءات
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showMoreActions && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {showMoreActions && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute left-0 top-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 min-w-[160px] z-20"
                    >
                      <button
                        onClick={() => { navigate('/inventory/products/add'); setShowMoreActions(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-right"
                      >
                        <Plus className="w-4 h-4" />
                        صنف جديد
                      </button>
                      <button
                        onClick={() => { loadProducts(); setShowMoreActions(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors text-right"
                      >
                        <RefreshCw className="w-4 h-4" />
                        تحديث القائمة
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { navigate('/inventory/products?tab=settings'); setShowMoreActions(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors text-right"
                      >
                        <Tag className="w-4 h-4" />
                        إدارة التصنيفات
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Result count */}
            {!loading && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-bold text-gray-400">
                  عرض <span className="text-gray-700">{filteredProducts.length}</span> من أصل <span className="text-gray-700">{totalProducts}</span> صنف
                  {searchTerm && <span className="text-blue-500"> · نتيجة البحث عن "{searchTerm}"</span>}
                </p>
                {lowStockCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {lowStockCount} صنف مخزونه منخفض
                  </div>
                )}
              </div>
            )}

            {/* ─── Table View ─────────────────────────────────────────────── */}
            {viewMode === 'table' && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="px-5 py-3.5 w-10">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            title="اختر الكل"
                          />
                        </th>
                        <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">الصنف</th>
                        <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">الماركة</th>
                        <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">الفئة</th>
                        <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">الباركود</th>
                        <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">السعر</th>
                        <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">المخزون</th>
                        <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">الحالة</th>
                        <th className="px-5 py-3.5 w-40"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading ? (
                        [1, 2, 3, 4, 5].map(i => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-5 py-4"><div className="w-4 h-4 bg-gray-100 rounded" /></td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-100 rounded-lg" />
                                <div className="space-y-1.5">
                                  <div className="h-3 bg-gray-100 rounded w-32" />
                                  <div className="h-2.5 bg-gray-100 rounded w-20" />
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4"><div className="h-6 bg-gray-100 rounded-full w-20" /></td>
                            <td className="px-5 py-4"><div className="h-3 bg-gray-100 rounded w-16" /></td>
                            <td className="px-5 py-4"><div className="h-3 bg-gray-100 rounded w-24 font-mono" /></td>
                            <td className="px-5 py-4"><div className="h-3 bg-gray-100 rounded w-20" /></td>
                            <td className="px-5 py-4"><div className="h-3 bg-gray-100 rounded w-12" /></td>
                            <td className="px-5 py-4"><div className="h-6 bg-gray-100 rounded-full w-16" /></td>
                            <td className="px-5 py-4"><div className="h-6 bg-gray-100 rounded w-16" /></td>
                          </tr>
                        ))
                      ) : filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-3 text-gray-400">
                              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center">
                                <Package className="w-7 h-7 text-gray-300" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-500 text-sm">لا توجد أصناف مطابقة</p>
                                <p className="text-xs mt-0.5">جرّب تغيير مصطلح البحث أو الفلتر</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : filteredProducts.map((product) => (
                        <ProductRow
                          key={product.id}
                          product={product}
                          isSelected={selectedProductIds.includes(product.id)}
                          onToggle={() => toggleSelectProduct(product.id)}
                          onDelete={() => handleDeleteProduct(product.id)}
                          onEdit={() => navigate(`/inventory/products/edit/${product.id}`)}
                          onPrintBarcode={() => openBarcodePrint([product])}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                {!loading && filteredProducts.length > 0 && (
                  <div className="border-t border-gray-50 px-5 py-3 bg-gray-50/30 flex items-center justify-between">
                    <p className="text-xs text-gray-400 font-bold">
                      {selectedProductIds.length > 0
                        ? `${selectedProductIds.length} من ${filteredProducts.length} أصناف محددة`
                        : `${filteredProducts.length} صنف`}
                    </p>
                    {selectedProductIds.length > 0 && (
                      <button
                        onClick={() => setSelectedProductIds([])}
                        className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        إلغاء التحديد
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─── Grid View ──────────────────────────────────────────────── */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {loading ? (
                  [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse space-y-3">
                      <div className="w-full aspect-square bg-gray-100 rounded-xl" />
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                        <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                        <div className="h-4 bg-gray-100 rounded w-1/3" />
                      </div>
                    </div>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-gray-400">
                    <Package className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                    <p className="font-bold">لا توجد أصناف</p>
                  </div>
                ) : filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={selectedProductIds.includes(product.id)}
                    onToggle={() => toggleSelectProduct(product.id)}
                    onDelete={() => handleDeleteProduct(product.id)}
                    onEdit={() => navigate(`/inventory/products/edit/${product.id}`)}
                    onPrintBarcode={() => openBarcodePrint([product])}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Barcode Print Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {barcodePrintOpen && (
          <BarcodePrintModal
            isOpen={barcodePrintOpen}
            onClose={() => setBarcodePrintOpen(false)}
            selectedProducts={barcodePrintProducts}
            allProducts={products}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
