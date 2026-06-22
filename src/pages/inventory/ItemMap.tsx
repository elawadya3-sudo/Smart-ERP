import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { productsService } from '../../services/firestore';
import { warehouseService } from '../../services/inventory';
import { Product, Warehouse } from '../../types';
import {
  MapPin, Trash2, Edit2, Save, Search, X, Plus,
  Package, Building2, Layers, AlertTriangle,
  ChevronLeft, Hash, Loader2, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface StockLevel {
  productId: string;
  warehouseId: string;
  quantity: number;
}

interface ItemMapEntry {
  id: string;
  productId: string;
  productName: string;
  productSku?: string;
  warehouseId: string;
  warehouseName?: string;
  zone?: string;
  aisle?: string;
  location: string;
  shelf: string;
  notes?: string;
  createdAt: string;
}

const ZONE_COLORS: Record<string, string> = {
  A: 'bg-blue-100 text-blue-700 border-blue-200',
  B: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  C: 'bg-amber-100 text-amber-700 border-amber-200',
  D: 'bg-purple-100 text-purple-700 border-purple-200',
  E: 'bg-red-100 text-red-700 border-red-200',
};

export default function ItemMapPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [entries, setEntries] = useState<ItemMapEntry[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [zone, setZone] = useState('');
  const [aisle, setAisle] = useState('');
  const [location, setLocation] = useState('');
  const [shelf, setShelf] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        productInputRef.current && !productInputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Load warehouses
        const whs = await warehouseService.getAll();
        setWarehouses(whs);
        if (whs.length > 0) setSelectedWarehouseId(whs[0].id);

        // Load all products — use getDocs directly without orderBy to avoid index issues
        try {
          const prodSnap = await getDocs(collection(db, 'products'));
          const prods = prodSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
          // Sort client-side by name
          prods.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
          setProducts(prods);
        } catch {
          // Fallback to service
          const prods = await productsService.getAll();
          setProducts(prods);
        }

        // Load stock levels (best-effort — ignore if collection missing)
        try {
          const slSnap = await getDocs(collection(db, 'stock_levels'));
          setStockLevels(
            slSnap.docs
              .map(d => ({
                productId: String((d.data() as any).productId || ''),
                warehouseId: String((d.data() as any).warehouseId || ''),
                quantity: Number((d.data() as any).quantity || 0),
              }))
              .filter(sl => sl.productId && sl.warehouseId)
          );
        } catch {
          // stock_levels optional — ignore
        }
      } catch (error) {
        console.error('ItemMap load error:', error);
      } finally {
        setLoading(false);
      }
    };

    const q = query(collection(db, 'item_maps'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      snapshot => setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ItemMapEntry))),
      error => console.error('ItemMap listener error:', error)
    );

    load();
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setSelectedProductId('');
    setProductSearch('');
    setZone('');
    setAisle('');
    setLocation('');
    setShelf('');
    setNotes('');
    setEditingId(null);
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedWarehouseId || !location.trim()) return;
    if (!selectedProduct) return;

    setSaving(true);
    const payload = {
      productId: selectedProductId,
      productName: selectedProduct.name,
      productSku: (selectedProduct as any).sku || '',
      warehouseId: selectedWarehouseId,
      warehouseName: selectedWarehouse?.name || '',
      zone: zone.trim().toUpperCase(),
      aisle: aisle.trim().toUpperCase(),
      location: location.trim(),
      shelf: shelf.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'item_maps', editingId), payload);
      } else {
        await addDoc(collection(db, 'item_maps'), payload);
      }
      resetForm();
    } catch (error: any) {
      console.error(error);
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'item_maps');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry: ItemMapEntry) => {
    setEditingId(entry.id);
    setSelectedProductId(entry.productId);
    setProductSearch(entry.productName);
    setSelectedWarehouseId(entry.warehouseId);
    setZone(entry.zone || '');
    setAisle(entry.aisle || '');
    setLocation(entry.location);
    setShelf(entry.shelf);
    setNotes(entry.notes || '');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف عنصر خريطة الصنف؟')) return;
    try {
      await deleteDoc(doc(db, 'item_maps', id));
      if (editingId === id) resetForm();
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.DELETE, `item_maps/${id}`);
    }
  };

  // Products in selected warehouse (used only when * is typed)
  const warehouseProductIds = selectedWarehouseId && stockLevels.length > 0
    ? new Set(stockLevels.filter(sl => sl.warehouseId === selectedWarehouseId && sl.quantity > 0).map(sl => sl.productId))
    : null;

  const isWildcard = productSearch.trim() === '*';

  const filteredProducts = products.filter(p => {
    // * → show only products that exist in the selected warehouse (or all if no stock data)
    if (isWildcard) {
      if (warehouseProductIds && warehouseProductIds.size > 0) {
        return warehouseProductIds.has(p.id);
      }
      return true; // no stock_levels data → show all
    }
    // Empty search → show ALL products (let user browse freely)
    if (!productSearch.trim()) return true;
    // Text search → match name or SKU across all products
    return (
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p as any).sku?.toLowerCase().includes(productSearch.toLowerCase())
    );
  });

  const filteredEntries = entries.filter(entry => {
    const matchSearch =
      entry.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.shelf.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.productSku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.zone || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchWarehouse = filterWarehouse ? entry.warehouseId === filterWarehouse : true;
    const matchZone = filterZone ? (entry.zone || '') === filterZone : true;
    return matchSearch && matchWarehouse && matchZone;
  });

  const uniqueZones = [...new Set(entries.map(e => e.zone).filter(Boolean))] as string[];

  const statCards = [
    { label: 'إجمالي الأصناف المحددة', value: entries.length, icon: MapPin, color: 'blue' },
    { label: 'المستودعات النشطة', value: new Set(entries.map(e => e.warehouseId)).size, icon: Building2, color: 'emerald' },
    { label: 'المناطق المستخدمة', value: uniqueZones.length, icon: Layers, color: 'violet' },
    { label: 'نتائج البحث', value: filteredEntries.length, icon: Search, color: 'amber' },
  ];

  return (
    <div className="space-y-6 pb-24" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-200">
              <MapPin className="w-4.5 h-4.5 text-white" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">خريطة الأصناف</h2>
          </div>
          <p className="text-gray-500 text-sm pr-12">حدد أماكن تخزين المنتجات داخل المستودعات والرفوف لتسريع عمليات الجرد والتجهيز.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              s.color === 'blue' ? 'bg-blue-50' : s.color === 'emerald' ? 'bg-emerald-50' : s.color === 'violet' ? 'bg-violet-50' : 'bg-amber-50'
            )}>
              <s.icon className={cn('w-5 h-5', s.color === 'blue' ? 'text-blue-600' : s.color === 'emerald' ? 'text-emerald-600' : s.color === 'violet' ? 'text-violet-600' : 'text-amber-600')} />
            </div>
            <div>
              <p className="text-xl font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 font-bold leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                {editingId ? <Edit2 className="w-4 h-4 text-violet-600" /> : <Plus className="w-4 h-4 text-violet-600" />}
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-sm">{editingId ? 'تعديل الموقع' : 'تسجيل موقع صنف'}</h3>
                <p className="text-xs text-gray-400 font-medium">حدد الصنف وموقع تخزينه بدقة</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Product Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> الصنف
              </label>
              <div className="relative">
                <input
                  ref={productInputRef}
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); if (selectedProductId) setSelectedProductId(''); }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="اكتب للبحث، أو * لعرض كل أصناف المستودع"
                  className={cn(
                    'w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none border transition-all',
                    selectedProductId
                      ? 'border-emerald-300 bg-emerald-50/40 focus:ring-2 focus:ring-emerald-100'
                      : 'border-gray-200 focus:ring-2 focus:ring-violet-100 focus:border-violet-300'
                  )}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {selectedProductId && <span className="w-2 h-2 bg-emerald-500 rounded-full" />}
                  {productSearch && !selectedProductId && (
                    <button type="button" onClick={() => { setProductSearch(''); setSelectedProductId(''); setShowProductDropdown(false); }} className="text-gray-400 hover:text-gray-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {showProductDropdown && filteredProducts.length > 0 && (
                    <motion.div
                      ref={dropdownRef}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 left-0 bg-white border border-gray-100 shadow-xl rounded-2xl mt-1 max-h-56 overflow-y-auto z-30"
                    >
                      {/* Header showing context */}
                      <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                          {isWildcard || !productSearch.trim()
                            ? `أصناف المستودع المحدد (${filteredProducts.length})`
                            : `نتائج البحث (${filteredProducts.length})`
                          }
                        </span>
                        {isWildcard && <Star className="w-3 h-3 text-amber-500" />}
                      </div>
                      <div className="divide-y divide-gray-50">
                        {filteredProducts.slice(0, 15).map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setProductSearch(p.name);
                              setShowProductDropdown(false);
                            }}
                            className="w-full text-right px-4 py-2.5 hover:bg-violet-50 flex justify-between items-center transition-colors"
                          >
                            <span className="text-sm font-bold text-gray-800 truncate flex-1">{p.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0 mr-2">
                              {(p as any).sku && <span className="text-xs text-gray-400 font-mono">{(p as any).sku}</span>}
                              {warehouseProductIds?.has(p.id) && (
                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-lg">في المخزن</span>
                              )}
                            </div>
                          </button>
                        ))}
                        {filteredProducts.length > 15 && (
                          <div className="px-4 py-2 text-center text-xs text-gray-400 font-bold">
                            +{filteredProducts.length - 15} نتيجة إضافية — اكتب للتضييق
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                  {showProductDropdown && !productSearch.trim() && filteredProducts.length === 0 && products.length > 0 && (
                    <motion.div
                      ref={dropdownRef}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-full right-0 left-0 bg-white border border-gray-100 shadow-xl rounded-2xl mt-1 z-30"
                    >
                      <div className="px-4 py-3 text-center">
                        <p className="text-xs font-bold text-gray-400">لا توجد أصناف مسجلة في هذا المستودع</p>
                        <button type="button" onClick={() => setProductSearch('')} className="text-xs font-black text-violet-600 mt-1 hover:underline">
                          عرض كل الأصناف
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Warehouse */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> المستودع
              </label>
              <select
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
                className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none border border-gray-200 focus:ring-2 focus:ring-violet-100 focus:border-violet-300 transition-all appearance-none"
              >
                <option value="">اختر مستودعاً</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Zone / Aisle grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> المنطقة (Zone)
                </label>
                <input
                  value={zone}
                  onChange={e => setZone(e.target.value)}
                  placeholder="مثال: A، B، C"
                  maxLength={3}
                  className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm font-black outline-none border border-gray-200 focus:ring-2 focus:ring-violet-100 focus:border-violet-300 transition-all uppercase text-center"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <ChevronLeft className="w-3.5 h-3.5" /> الممر (Aisle)
                </label>
                <input
                  value={aisle}
                  onChange={e => setAisle(e.target.value)}
                  placeholder="مثال: 01، 02"
                  maxLength={4}
                  className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm font-black outline-none border border-gray-200 focus:ring-2 focus:ring-violet-100 focus:border-violet-300 transition-all uppercase text-center"
                />
              </div>
            </div>

            {/* Location / Shelf grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> الموقع *
                </label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="القسم / الصف"
                  required
                  className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none border border-gray-200 focus:ring-2 focus:ring-violet-100 focus:border-violet-300 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" /> الرف (Shelf)
                </label>
                <input
                  value={shelf}
                  onChange={e => setShelf(e.target.value)}
                  placeholder="رقم الرف"
                  className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none border border-gray-200 focus:ring-2 focus:ring-violet-100 focus:border-violet-300 transition-all"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">ملاحظات إضافية</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="أي تفاصيل إضافية عن الموقع..."
                className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none border border-gray-200 focus:ring-2 focus:ring-violet-100 focus:border-violet-300 transition-all resize-none"
              />
            </div>

            {/* Location Preview Badge */}
            {(zone || aisle || location) && (
              <div className="bg-violet-50 rounded-2xl p-3 border border-violet-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-violet-600 flex-shrink-0" />
                <p className="text-sm font-black text-violet-800">
                  {[zone, aisle, location, shelf].filter(Boolean).join(' / ')}
                </p>
              </div>
            )}

            {(!selectedProductId || !selectedWarehouseId) && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-3 py-2 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {!selectedProductId ? 'يرجى اختيار الصنف' : 'يرجى اختيار المستودع'}
              </div>
            )}
          </div>

          <div className="px-6 pb-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || !selectedProductId || !selectedWarehouseId || !location.trim()}
              className="flex-1 bg-violet-600 text-white py-3 rounded-2xl font-black shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'حفظ التعديلات' : 'تسجيل الموقع'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all font-bold flex items-center gap-2"
              >
                <X className="w-4 h-4" /> إلغاء
              </button>
            )}
          </div>
        </form>

        {/* Entries List */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          {/* Search & Filters */}
          <div className="p-6 border-b border-gray-50 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-black text-gray-900">سجل خريطة الأصناف</h3>
              <span className="bg-violet-50 text-violet-700 text-xs font-black px-3 py-1.5 rounded-xl border border-violet-100">
                {filteredEntries.length} من {entries.length} عنصر
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="ابحث بالمنتج، الموقع، الرف، المنطقة..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pr-11 pl-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-100 font-bold"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={filterWarehouse}
                onChange={e => setFilterWarehouse(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-violet-100"
              >
                <option value="">كل المستودعات</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              {uniqueZones.length > 0 && (
                <select
                  value={filterZone}
                  onChange={e => setFilterZone(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">كل المناطق</option>
                  {uniqueZones.map(z => (
                    <option key={z} value={z}>المنطقة {z}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-violet-300" />
                </div>
                <h4 className="font-black text-gray-400 text-lg mb-1">لا توجد نتائج</h4>
                <p className="text-gray-400 text-sm">
                  {searchTerm ? 'لم يتم العثور على نتائج مطابقة للبحث' : 'لم يتم تسجيل أي مواقع بعد. استخدم النموذج لإضافة أول موقع.'}
                </p>
              </div>
            ) : (
              <AnimatePresence>
                <div className="space-y-3">
                  {filteredEntries.map((entry, idx) => {
                    const zoneColor = ZONE_COLORS[entry.zone || ''] || 'bg-slate-100 text-slate-600 border-slate-200';
                    const locationString = [entry.zone, entry.aisle, entry.location, entry.shelf].filter(Boolean).join(' / ');
                    const wh = warehouses.find(w => w.id === entry.warehouseId);
                    return (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ delay: idx * 0.03 }}
                        className={cn(
                          'group p-4 rounded-2xl border transition-all',
                          editingId === entry.id
                            ? 'border-violet-300 bg-violet-50/50 shadow-md shadow-violet-50'
                            : 'border-gray-100 bg-gray-50/60 hover:border-gray-200 hover:bg-white hover:shadow-sm'
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                              <Package className="w-4 h-4 text-violet-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-gray-900 truncate">{entry.productName}</p>
                              {entry.productSku && (
                                <p className="text-[10px] font-mono text-gray-400 mt-0.5">{entry.productSku}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {entry.zone && (
                                  <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg border', zoneColor)}>
                                    Zone {entry.zone}
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-xs text-gray-600 font-bold bg-white border border-gray-200 px-2.5 py-1 rounded-xl">
                                  <MapPin className="w-3 h-3 text-violet-500" />
                                  {locationString || entry.location}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-gray-500 font-bold">
                                  <Building2 className="w-3 h-3 text-gray-400" />
                                  {wh?.name || entry.warehouseName || 'غير محدد'}
                                </span>
                              </div>
                              {entry.notes && (
                                <p className="text-xs text-gray-400 mt-1.5 font-medium">{entry.notes}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className={cn(
                                'px-3.5 py-2 rounded-xl text-xs font-black transition-all inline-flex items-center gap-1.5',
                                editingId === entry.id
                                  ? 'bg-violet-600 text-white shadow-md shadow-violet-100'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700'
                              )}
                            >
                              <Edit2 className="w-3.5 h-3.5" /> تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id)}
                              className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-red-400 text-xs font-black hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all inline-flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
