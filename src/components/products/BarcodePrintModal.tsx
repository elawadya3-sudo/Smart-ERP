import React, { useState, useEffect } from 'react';
import { X, Printer, Plus, Minus, Settings2, Trash2, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { Product } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { useMainStoreSettings } from '../../hooks/useMainStoreSettings';
import { productsService } from '../../services/firestore';
import JsBarcode from 'jsbarcode';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Product[];
}

export default function BarcodePrintModal({
  isOpen,
  onClose,
  selectedProducts,
}: BarcodePrintModalProps) {
  const { settings } = useMainStoreSettings();
  const [labelSize, setLabelSize] = useState<'38x25' | '50x30' | 'A4_40'>('38x25');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [storeName, setStoreName] = useState('');
  
  // Dynamic list of products to print
  const [productsToPrint, setProductsToPrint] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  // Search products internally
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load all products for the search dropdown
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await productsService.getAll();
        setAllProducts(data);
      } catch (err) {
        console.error('Failed to load products in modal:', err);
      }
    };
    loadProducts();
  }, []);

  // Sync prop products with local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProductsToPrint(selectedProducts);
      const defaultQtys: Record<string, number> = {};
      selectedProducts.forEach(p => {
        defaultQtys[p.id] = p.quantity > 0 ? Math.min(10, p.quantity) : 1;
      });
      setQuantities(defaultQtys);
    }
  }, [isOpen, selectedProducts]);

  useEffect(() => {
    if (settings) {
      setStoreName(settings.storeName || '');
    }
  }, [settings]);

  // Generate flat array of items for rendering
  const labelsToPrint = React.useMemo(() => {
    return productsToPrint.flatMap(p => {
      const qty = quantities[p.id] || 1;
      return Array.from({ length: qty }).map((_, index) => ({
        product: p,
        index,
        uniqueId: `${p.id}-${index}`,
      }));
    });
  }, [productsToPrint, quantities]);

  // Initialize JsBarcode for preview cards
  useEffect(() => {
    if (!isOpen) return;
    
    const timer = setTimeout(() => {
      labelsToPrint.forEach(item => {
        const elementId = `barcode-preview-${item.uniqueId}`;
        const element = document.getElementById(elementId);
        if (element && item.product.barcode) {
          try {
            JsBarcode(`#${elementId}`, item.product.barcode, {
              format: "CODE128",
              width: labelSize === '38x25' ? 1.0 : 1.3,
              height: labelSize === '38x25' ? 24 : 32,
              displayValue: true,
              fontSize: 9,
              margin: 1,
            });
          } catch (err) {
            console.error("Barcode generation failed for:", item.product.barcode, err);
          }
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [labelsToPrint, labelSize, isOpen, showStoreName, showProductName, showPrice]);

  const updateProductQty = (productId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta),
    }));
  };

  const removeProduct = (productId: string) => {
    setProductsToPrint(prev => prev.filter(p => p.id !== productId));
    setQuantities(prev => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  const addProductToPrint = (product: Product) => {
    // Check if product has barcode
    if (!product.barcode) {
      alert('لا يمكن طباعة باركود لمنتج لا يحتوي على رمز باركود.');
      return;
    }

    setProductsToPrint(prev => {
      if (prev.some(p => p.id === product.id)) {
        // If already exists, just increment quantity
        updateProductQty(product.id, 1);
        return prev;
      }
      // Otherwise add it
      setQuantities(q => ({ ...q, [product.id]: 1 }));
      return [...prev, product];
    });

    setSearchQuery('');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('تم منع النافذة المنبثقة، يرجى تفعيل المنبثقات للطباعة.');
      return;
    }

    let cssStyles = '';

    if (labelSize === '38x25') {
      cssStyles = `
        @page { size: 38mm 25mm; margin: 0; }
        body { margin: 0; padding: 0; width: 38mm; height: 25mm; font-family: system-ui, -apple-system, sans-serif; text-align: center; direction: rtl; }
        .label-card { width: 38mm; height: 25mm; box-sizing: border-box; padding: 1mm 2mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; page-break-after: always; }
        .store-name { font-size: 6px; font-weight: 900; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .product-name { font-size: 7px; font-weight: 700; margin: 0; height: 16px; line-height: 8px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .barcode-svg { max-width: 34mm; max-height: 12mm; }
        .price { font-size: 7px; font-weight: 900; margin: 0; }
      `;
    } else if (labelSize === '50x30') {
      cssStyles = `
        @page { size: 50mm 30mm; margin: 0; }
        body { margin: 0; padding: 0; width: 50mm; height: 30mm; font-family: system-ui, -apple-system, sans-serif; text-align: center; direction: rtl; }
        .label-card { width: 50mm; height: 30mm; box-sizing: border-box; padding: 2mm 3mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; page-break-after: always; }
        .store-name { font-size: 7px; font-weight: 900; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .product-name { font-size: 8px; font-weight: 700; margin: 1px 0; height: 18px; line-height: 9px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .barcode-svg { max-width: 44mm; max-height: 14mm; }
        .price { font-size: 8px; font-weight: 900; margin: 0; }
      `;
    } else {
      cssStyles = `
        @page { size: A4; margin: 10mm; }
        body { font-family: system-ui, -apple-system, sans-serif; direction: rtl; background: white; margin: 0; padding: 0; }
        .grid-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm 3mm; width: 100%; box-sizing: border-box; }
        .label-card { border: 1px dashed #ccc; height: 26mm; box-sizing: border-box; padding: 1.5mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; text-align: center; }
        .store-name { font-size: 8px; font-weight: 900; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .product-name { font-size: 9px; font-weight: 700; margin: 1px 0; height: 20px; line-height: 10px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .barcode-svg { max-width: 40mm; max-height: 11mm; }
        .price { font-size: 9px; font-weight: 900; margin: 0; }
      `;
    }

    const labelsHTML = labelsToPrint.map(item => {
      const barcodeElement = document.getElementById(`barcode-preview-${item.uniqueId}`);
      const svgCode = barcodeElement ? barcodeElement.outerHTML : '';
      
      return `
        <div class="label-card">
          ${showStoreName && storeName ? `<div class="store-name">${storeName}</div>` : ''}
          ${showProductName ? `<div class="product-name">${item.product.name}</div>` : ''}
          ${svgCode ? svgCode.replace('id="barcode-preview-' + item.uniqueId + '"', 'class="barcode-svg"') : ''}
          ${showPrice ? `<div class="price">${formatCurrency(item.product.sellingPrice)}</div>` : ''}
        </div>
      `;
    }).join('');

    const documentContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>طباعة الباركود للمنتجات</title>
        <style>
          ${cssStyles}
        </style>
      </head>
      <body>
        ${labelSize === 'A4_40' ? `<div class="grid-container">${labelsHTML}</div>` : labelsHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(documentContent);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-5xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg">طباعة ملصقات الباركود</h3>
              <p className="text-xs text-slate-400 font-bold">تحديد مقاس الملصق وإدارة المنتجات المراد طباعتها</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left panel: Options (LG: col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Search Input inside Modal */}
            <div className="space-y-2 relative">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">إضافة منتج إضافي لدفعة الطباعة</label>
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو الباركود لإضافته..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {searchQuery.trim() && (
                <div className="absolute top-full right-0 left-0 bg-white border border-slate-100 shadow-xl rounded-2xl mt-2 max-h-48 overflow-y-auto z-20 divide-y divide-slate-50">
                  {allProducts
                    .filter(p => 
                      searchQuery.trim() === '*' ||
                      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (p.barcode && p.barcode.includes(searchQuery))
                    )
                    .map(prod => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => addProductToPrint(prod)}
                        className="w-full text-right px-4 py-3 hover:bg-slate-50 flex justify-between items-center text-sm font-bold text-slate-700"
                      >
                        <span>{prod.name}</span>
                        <span className="text-xs text-slate-400 font-mono">الباركود: {prod.barcode || 'بدون'}</span>
                      </button>
                    ))}
                  {allProducts.filter(p => 
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (p.barcode && p.barcode.includes(searchQuery))
                  ).length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">لا توجد نتائج مطابقة</div>
                  )}
                </div>
              )}
            </div>

            {/* Config Box */}
            <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-indigo-500" />
                خيارات التنسيق والملصق
              </h4>

              {/* Label size choice */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">مقاس ملصق الباركود</label>
                <select
                  value={labelSize}
                  onChange={e => setLabelSize(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none text-sm font-bold focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="38x25">38 × 25 مم (ملصق حراري كاشير)</option>
                  <option value="50x30">50 × 30 مم (ملصق حراري متوسط)</option>
                  <option value="A4_40">ورقة A4 ملصقات (40 ملصق بالصفحة)</option>
                </select>
              </div>

              {/* Custom Store Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">اسم المتجر للملصق</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  placeholder="اسم المتجر"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none text-sm font-bold focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={e => setShowStoreName(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-600">طباعة اسم المتجر</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={e => setShowProductName(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-600">طباعة اسم المنتج</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={e => setShowPrice(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-600">طباعة سعر المنتج</span>
                </label>
              </div>
            </div>

            {/* Selected Products list with remove buttons */}
            <div className="space-y-3 max-h-[30vh] overflow-y-auto">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">المنتجات المختارة للطباعة</label>
              {productsToPrint.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  يرجى إضافة منتجات للطباعة
                </div>
              ) : (
                productsToPrint.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-900 truncate">{p.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 font-bold truncate">الباركود: {p.barcode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateProductQty(p.id, -1)}
                          className="w-6 h-6 bg-white border border-slate-200 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-black text-xs text-slate-900">{quantities[p.id] || 1}</span>
                        <button
                          onClick={() => updateProductQty(p.id, 1)}
                          className="w-6 h-6 bg-white border border-slate-200 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeProduct(p.id)}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all"
                        title="إزالة من القائمة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Live Previews (LG: col-span-7) */}
          <div className="lg:col-span-7 bg-slate-50 rounded-[2rem] p-6 border border-slate-100 flex flex-col max-h-[60vh] lg:max-h-none">
            <h4 className="font-black text-slate-800 text-sm mb-4">معاينة حيّة للملصقات ({labelsToPrint.length})</h4>
            {labelsToPrint.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-20">
                <Printer className="w-12 h-12 mb-3 opacity-30 animate-pulse" />
                <p className="text-sm font-bold">المعاينة فارغة، يرجى إضافة منتجات</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 gap-4">
                {labelsToPrint.map(item => (
                  <div
                    key={item.uniqueId}
                    className={cn(
                      "bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center justify-between p-4 overflow-hidden text-center",
                      labelSize === '38x25' ? "min-h-[140px]" : "min-h-[180px]"
                    )}
                  >
                    {showStoreName && storeName && (
                      <div className="text-[9px] font-black text-slate-800 truncate max-w-full px-1">{storeName}</div>
                    )}
                    {showProductName && (
                      <div className="text-[10px] font-black text-slate-700 leading-tight line-clamp-2 h-7 mt-1">{item.product.name}</div>
                    )}
                    
                    {item.product.barcode ? (
                      <div className="my-2 flex justify-center w-full">
                        <svg id={`barcode-preview-${item.uniqueId}`} className="max-w-full" />
                      </div>
                    ) : (
                      <div className="text-xs text-red-500 font-bold my-4">بدون باركود</div>
                    )}

                    {showPrice && (
                      <div className="text-[11px] font-black text-indigo-600 mt-1">{formatCurrency(item.product.sellingPrice)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="text-xs text-slate-400 font-bold">
            عدد الملصقات الإجمالي: <span className="font-black text-indigo-600 text-sm">{labelsToPrint.length}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm bg-white text-slate-500 hover:bg-slate-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handlePrint}
              disabled={labelsToPrint.length === 0}
              className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              بدء الطباعة
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
