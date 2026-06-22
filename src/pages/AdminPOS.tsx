/**
 * AdminPOS – نقطة البيع للمدير
 * A streamlined POS that mirrors core functionality of POS.tsx
 * but is accessible to ADMINs without requiring an open shift.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, Banknote,
  X, CheckCircle2, Package, Store, RefreshCcw, Loader2, Building2,
  BarChart3, ArrowLeft, Printer, User, Smartphone, QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, orderBy, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, OrderItem, Warehouse, Order, Customer } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { usePOS } from '../context/POSContext';
import { useMainStoreSettings } from '../hooks/useMainStoreSettings';
import { useNavigate } from 'react-router-dom';

export default function AdminPOS() {
  const { user } = useAuth();
  const { addInvoice, invoices } = usePOS();
  const { settings } = useMainStoreSettings();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [variantSelectorProduct, setVariantSelectorProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Customer Selector State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside for customer dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Customers
  useEffect(() => {
    const qC = query(collection(db, 'customers'));
    const unsubC = onSnapshot(qC, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });
    return () => unsubC();
  }, []);

  // Sync default customer
  useEffect(() => {
    if (customers.length > 0 && selectedBranchId) {
      const defaultCustomerId = localStorage.getItem(`default_pos_customer_id_${selectedBranchId}`);
      if (defaultCustomerId) {
        const found = customers.find(c => c.id === defaultCustomerId && (c.branchId || 'ADMIN') === selectedBranchId);
        if (found) {
          setSelectedCustomer(found);
          setCustomerSearchTerm(`${found.name} (${found.phone})`);
          return;
        }
      }
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
    }
  }, [customers, selectedBranchId]);

  // Fetch warehouses
  useEffect(() => {
    const q = query(collection(db, 'warehouses'));
    return onSnapshot(q, snap => {
      setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
    });
  }, []);

  // Fetch products
  useEffect(() => {
    const q = query(collection(db, 'products'));
    return onSnapshot(q, snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });
  }, []);

  // Fetch completed transfers to calculate branch stock
  useEffect(() => {
    const qT = query(collection(db, 'inventory_transactions'), orderBy('createdAt', 'desc'));
    const unsubT = onSnapshot(qT, (snapshot) => {
      setTransfers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });
    return () => unsubT();
  }, []);

  const branchWarehouses = useMemo(
    () => warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1'),
    [warehouses]
  );

  const selectedBranch = warehouses.find(w => w.id === selectedBranchId);

  // Memoized stock levels for the selected branch to optimize performance
  const branchStockMap = useMemo(() => {
    if (!selectedBranchId) return {};
    const stockMap: Record<string, number> = {};

    // 1. Calculate incoming transfers & receipts
    transfers
      .filter(t => (t.type === 'TRANSFER' || t.type === 'RECEIPT') && t.status === 'COMPLETED' && t.toWarehouseId === selectedBranchId)
      .forEach(t => {
        t.items?.forEach(item => {
          const key = item.sku || item.productId;
          stockMap[key] = (stockMap[key] || 0) + (item.quantity || 0);
          if (item.sku && item.productId) {
            stockMap[item.productId] = (stockMap[item.productId] || 0) + (item.quantity || 0);
          }
        });
      });

    // 2. Subtract outgoing sales (completed and partially returned invoices)
    invoices
      .filter(inv => inv.branchId === selectedBranchId && inv.customerId !== 'EXPENSE' && (inv.status === 'COMPLETED' || inv.status === 'PARTIALLY_RETURNED' || !inv.status))
      .forEach(inv => {
        inv.items?.forEach(item => {
          const qty = (item.quantity || 0) - (item.returnedQuantity || 0);
          const itemSku = item.variant?.sku || item.sku;
          const key = itemSku || item.productId;
          stockMap[key] = (stockMap[key] || 0) - qty;
          if (itemSku && item.productId) {
            stockMap[item.productId] = (stockMap[item.productId] || 0) - qty;
          }
        });
      });

    // 3. Subtract outgoing transfers (to other branches)
    transfers
      .filter(t => t.type === 'TRANSFER' && (t.status === 'COMPLETED' || t.status === 'SHIPPED') && t.fromWarehouseId === selectedBranchId)
      .forEach(t => {
        t.items?.forEach(item => {
          const key = item.sku || item.productId;
          stockMap[key] = (stockMap[key] || 0) - (item.quantity || 0);
          if (item.sku && item.productId) {
            stockMap[item.productId] = (stockMap[item.productId] || 0) - (item.quantity || 0);
          }
        });
      });

    return stockMap;
  }, [transfers, invoices, selectedBranchId]);

  const isMainBranch = selectedBranch?.type === 'MAIN' || selectedBranch?.id === '1' || selectedBranchId === 'ADMIN';

  // Helper to get variant stock for a specific branch
  const getVariantBranchStock = (product: Product, variant: any) => {
    const sku = variant.sku || `${product.sku || 'PROD'}-${variant.size}-${variant.color}`;
    const calculatedStock = branchStockMap[sku] || 0;
    
    // If we are in the main branch, we add the variant's initial quantity as the base
    if (isMainBranch) {
      const initialQty = Number(variant.quantity) || 0;
      return Math.max(0, initialQty + calculatedStock);
    }
    
    return Math.max(0, calculatedStock);
  };

  // Helper to get overall product stock for a specific branch
  const getProductBranchStock = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      // Sum of all its variants' branch stocks
      return product.variants.reduce((sum, v) => sum + getVariantBranchStock(product, v), 0);
    }
    
    const calculatedStock = branchStockMap[product.id] || 0;
    if (isMainBranch) {
      const initialQty = Number(product.quantity || (product as any).initialQuantity || 0);
      return Math.max(0, initialQty + calculatedStock);
    }
    return Math.max(0, calculatedStock);
  };

  const availableProducts = useMemo(() => {
    return products.map(p => ({
      ...p,
      branchStock: getProductBranchStock(p)
    })).filter(p => {
      if ((p as any).isDraft) return false;
      if (selectedBranchId === 'ADMIN') return true;
      if (p.warehouseId === selectedBranchId) return true;

      // Check if product was received or transferred to this branch
      const hasIncoming = transfers.some(t => 
        (t.type === 'TRANSFER' || t.type === 'RECEIPT') && 
        t.status === 'COMPLETED' && 
        t.toWarehouseId === selectedBranchId &&
        t.items?.some(item => {
          const itemSku = item.sku || item.productId;
          if (item.productId === p.id) return true;
          if (p.variants) {
            return p.variants.some(v => v.sku === itemSku || `${p.sku || 'PROD'}-${v.size}-${v.color}` === itemSku);
          }
          return false;
        })
      );
      return hasIncoming;
    });
  }, [products, branchStockMap, selectedBranchId, selectedBranch, transfers]);

  const categories = useMemo(() => {
    const cats = new Set(availableProducts.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [availableProducts]);

  const filteredProducts = useMemo(() =>
    availableProducts.filter(p => {
      const matchesVariant = p.variants?.some(v => 
        (v.sku && v.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.barcode && String(v.barcode).toLowerCase().includes(searchTerm.toLowerCase()))
      );
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(searchTerm.toLowerCase())) ||
        matchesVariant;
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    }),
    [availableProducts, searchTerm, selectedCategory]
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const normalized = searchTerm.trim();
    if (!normalized) return;

    let matchedProduct: Product | undefined = undefined;
    let matchedVariant: any = undefined;

    for (const p of availableProducts) {
      if (String(p.barcode) === normalized || p.name.toLowerCase() === normalized.toLowerCase()) {
        matchedProduct = p;
        break;
      }
      if (p.variants) {
        const foundV = p.variants.find(v => String(v.barcode) === normalized || String(v.sku).toLowerCase() === normalized.toLowerCase());
        if (foundV) {
          matchedProduct = p;
          matchedVariant = foundV;
          break;
        }
      }
    }

    if (matchedProduct) {
      addToCart(matchedProduct, matchedVariant);
      setSearchTerm('');
    }
  };

  const addToCart = (product: Product, selectedVariant?: any) => {
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      setVariantSelectorProduct(product);
      return;
    }

    const sku = selectedVariant
      ? (selectedVariant.sku || `${product.sku || 'PROD'}-${selectedVariant.size}-${selectedVariant.color}`)
      : product.id;

    // Use getVariantBranchStock for variant or productBranchStock
    const availableStock = selectedVariant
      ? getVariantBranchStock(product, selectedVariant)
      : getProductBranchStock(product);

    const existing = cart.find(item => {
      if (selectedVariant) {
        return item.productId === product.id &&
               item.variant?.size === selectedVariant.size &&
               item.variant?.color === selectedVariant.color;
      }
      return item.productId === product.id && !item.variant;
    });

    const currentQty = existing?.quantity ?? 0;
    if (product.trackInventory !== false && currentQty + 1 > availableStock) {
      alert('الكمية المتاحة لا تكفي');
      return;
    }

    const displayName = selectedVariant
      ? `${product.name} (${selectedVariant.size ? `مقاس: ${selectedVariant.size}` : ''}${selectedVariant.size && selectedVariant.color ? ' / ' : ''}${selectedVariant.color ? `لون: ${selectedVariant.color}` : ''})`
      : product.name;

    if (existing) {
      setCart(prev => prev.map(item => {
        const matches = selectedVariant
          ? (item.productId === product.id && item.variant?.size === selectedVariant.size && item.variant?.color === selectedVariant.color)
          : (item.productId === product.id && !item.variant);

        return matches
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item;
      }));
    } else {
      setCart(prev => [...prev, {
        productId: product.id,
        name: displayName,
        sku: sku,
        quantity: 1,
        price: selectedVariant ? (selectedVariant.price || product.sellingPrice) : product.sellingPrice,
        originalPrice: selectedVariant ? (selectedVariant.price || product.sellingPrice) : product.sellingPrice,
        discount: 0,
        total: selectedVariant ? (selectedVariant.price || product.sellingPrice) : product.sellingPrice,
        variant: selectedVariant ? {
          size: selectedVariant.size,
          color: selectedVariant.color,
          sku: sku
        } : undefined
      }]);
    }

    setVariantSelectorProduct(null);
  };

  const updateQty = (itemSkuOrId: string, delta: number) => {
    const item = cart.find(i => (i.sku || i.productId) === itemSkuOrId);
    if (!item) return;

    const product = availableProducts.find(p => p.id === item.productId);
    if (!product) return;

    const availableStock = item.variant
      ? getVariantBranchStock(product, item.variant as any)
      : getProductBranchStock(product);

    setCart(prev => prev.map(i => {
      const currentKey = i.sku || i.productId;
      if (currentKey !== itemSkuOrId) return i;
      const newQty = Math.max(1, i.quantity + delta);
      if (product.trackInventory !== false && newQty > availableStock) {
        alert('الكمية المتاحة لا تكفي');
        return i;
      }
      return { ...i, quantity: newQty, total: newQty * i.price };
    }));
  };

  const removeItem = (itemSkuOrId: string) => setCart(prev => prev.filter(i => (i.sku || i.productId) !== itemSkuOrId));

  const subtotal = cart.reduce((a, i) => a + i.total, 0);
  const taxRate = settings?.taxEnabled ? (settings?.taxRate ?? 0) : 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const printReceipt = (invoice: any) => {
    const branchName = selectedBranch?.name || 'البيع المباشر';
    const dateStr = new Date(invoice.createdAt || new Date()).toLocaleString('ar-EG');
    const storeName = settings?.storeName || 'متجرنا';
    const paperSize = settings?.receiptPaperSize || '80mm';
    const showLogo = settings?.showLogoInReceipt ?? true;
    const logoUrl = settings?.storeLogoUrl || '';
    const taxNumber = settings?.taxRegistrationNumber || '';
    const showTax = settings?.showTaxDetails ?? true;
    const showBranch = settings?.showBranchDetails ?? true;
    const headerMsg = settings?.receiptHeader || '';
    const footerMsg = settings?.receiptFooter || 'شكراً لتعاملكم معنا';

    const phone = settings?.phone || '';
    const email = settings?.branchEmail || '';

    const customer = customers.find(c => c.id === invoice.customerId);

    let html = '';

    if (paperSize === '80mm') {
      html = `
        <!DOCTYPE html><html dir="rtl"><head>
        <meta charset="utf-8">
        <title>فاتورة ${invoice.id}</title>
        <style>
          @page { margin: 0; }
          body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; width: 78mm; margin: 0 auto; padding: 6px; box-sizing: border-box; color: #333; }
          .header { text-align: center; margin-bottom: 8px; }
          .logo { max-width: 60px; max-height: 60px; margin-bottom: 4px; border-radius: 8px; }
          .store-title { font-size: 15px; font-weight: 900; margin: 2px 0; color: #000; }
          .branch-title { font-size: 12px; font-weight: 700; margin: 2px 0; color: #555; }
          .meta-info { text-align: center; color: #666; font-size: 9px; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #999; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 6px 0; }
          th { text-align: right; padding: 3px 2px; border-bottom: 1px solid #000; font-weight: 850; }
          td { padding: 4px 2px; border-bottom: 1px solid #eee; }
          .total-section { margin-top: 8px; font-size: 10px; }
          .total-row { display: flex; justify-content: space-between; padding: 2px 0; }
          .grand-total { font-weight: 900; font-size: 13px; color: #000; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px; }
          .footer-msg { text-align: center; font-size: 9px; color: #777; margin-top: 12px; line-height: 1.4; }
        </style></head><body>
        <div class="header">
          ${showLogo && logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo" />` : ''}
          <div class="store-title">${storeName}</div>
          <div class="branch-title">${branchName}</div>
          ${headerMsg ? `<div style="font-size: 10px; font-weight: 700; color: #666; margin: 4px 0;">${headerMsg}</div>` : ''}
        </div>
        
        <div class="meta-info">
          <div>التاريخ: ${dateStr}</div>
          <div>رقم الفاتورة: ${invoice.id}</div>
          ${taxNumber ? `<div>الرقم الضريبي: ${taxNumber}</div>` : ''}
          ${showBranch && phone ? `<div>الهاتف: ${phone}</div>` : ''}
          ${showBranch && email ? `<div>البريد: ${email}</div>` : ''}
          ${customer ? `
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #bbb; font-weight: bold;">
              <div>العميل: ${customer.name}</div>
              ${customer.phone ? `<div>هاتف: ${customer.phone}</div>` : ''}
              ${customer.address ? `<div>العنوان: ${customer.address}</div>` : ''}
            </div>
          ` : ''}
        </div>
        
        <div class="divider"></div>
        
        <table>
          <thead>
            <tr>
              <th>المنتج</th>
              <th style="text-align: center;">الكمية</th>
              <th style="text-align: left;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.items || []).map((it: any) => `
              <tr>
                <td>
                  <div style="font-weight: 700;">${it.name}</div>
                  <div style="font-size: 9px; color: #777;">${formatCurrency(it.price)}/حبة</div>
                </td>
                <td style="text-align: center; font-weight: 700;">${it.quantity}</td>
                <td style="text-align: left; font-weight: 700;">${formatCurrency(it.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="divider"></div>
        
        <div class="total-section">
          ${showTax ? `
            <div class="total-row">
              <span>المجموع الفرعي:</span>
              <span>${formatCurrency(invoice.subtotal || invoice.total)}</span>
            </div>
            ${invoice.tax > 0 ? `
              <div class="total-row">
                <span>الضريبة (${settings?.taxRate || 15}%):</span>
                <span>${formatCurrency(invoice.tax)}</span>
              </div>
            ` : ''}
          ` : ''}
          <div class="total-row grand-total">
            <span>الإجمالي النهائي:</span>
            <span>${formatCurrency(invoice.total)}</span>
          </div>
          ${invoice.paymentMethod ? `
            <div class="total-row" style="font-size: 9px; color: #666; margin-top: 4px;">
              <span>طريقة الدفع:</span>
              <span>${
                invoice.paymentMethod === 'cash' ? 'نقدي' : 
                invoice.paymentMethod === 'visa' ? 'بطاقة ائتمان' : 
                invoice.paymentMethod === 'vodafone' ? 'فودافون كاش' : 
                invoice.paymentMethod === 'instapay' ? 'انستا باي' : 
                'آجل (على الحساب)'
              }</span>
            </div>
          ` : ''}
        </div>
        
        <div class="divider"></div>
        <div class="footer-msg">${footerMsg}</div>
        </body></html>
      `;
    } else {
      // A4 format
      html = `
        <!DOCTYPE html><html dir="rtl"><head>
        <meta charset="utf-8">
        <title>فاتورة ضريبية مبسطة - ${invoice.id}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; color: #333; font-size: 13px; line-height: 1.5; }
          .invoice-box { max-width: 800px; margin: auto; border: 1px solid #eee; padding: 30px; border-radius: 20px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05); }
          .header-grid { display: grid; grid-template-columns: 1fr 1fr; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
          .logo { max-width: 100px; max-height: 100px; border-radius: 12px; }
          .invoice-details { text-align: left; }
          .invoice-details h1 { margin: 0 0 10px 0; color: #1e3a8a; font-size: 24px; font-weight: 900; }
          .info-grid { display: grid; gap: 20px; margin-bottom: 30px; }
          .info-card { background: #f8fafc; border: 1px solid #f1f5f9; padding: 15px; border-radius: 16px; }
          .info-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #1e3a8a; font-weight: 800; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; text-align: right; }
          th { background: #1e3a8a; color: white; padding: 12px; font-weight: 700; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          .totals-table { width: 250px; margin-right: auto; text-align: left; margin-bottom: 30px; }
          .totals-table td { padding: 8px 12px; border-bottom: none; }
          .totals-table tr.grand-total td { font-weight: 900; font-size: 16px; color: #1e3a8a; border-top: 2px solid #1e3a8a; }
          .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; color: #64748b; font-size: 11px; }
        </style></head><body>
        <div class="invoice-box">
          <div class="header-grid">
            <div style="display: flex; align-items: center; gap: 15px;">
              ${showLogo && logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo" />` : ''}
              <div>
                <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #111;">${storeName}</h2>
                <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #4b5563;">${branchName}</p>
              </div>
            </div>
            <div class="invoice-details">
              <h1>فاتورة ضريبية مبسطة</h1>
              <p style="margin: 2px 0;">رقم الفاتورة: <span style="font-family: monospace; font-weight: bold;">${invoice.id}</span></p>
              <p style="margin: 2px 0;">التاريخ: ${dateStr}</p>
            </div>
          </div>

          <div class="info-grid" style="display: grid; grid-template-columns: ${customer ? '1fr 1fr 1fr' : '1fr 1fr'}; gap: 20px; margin-bottom: 30px;">
            <div class="info-card">
              <h3>معلومات المصدر</h3>
              <p style="margin: 4px 0;"><strong>الجهة:</strong> ${storeName} - ${branchName}</p>
              ${taxNumber ? `<p style="margin: 4px 0;"><strong>الرقم الضريبي:</strong> ${taxNumber}</p>` : ''}
              ${showBranch && phone ? `<p style="margin: 4px 0;"><strong>الهاتف:</strong> ${phone}</p>` : ''}
              ${showBranch && email ? `<p style="margin: 4px 0;"><strong>البريد الإلكتروني:</strong> ${email}</p>` : ''}
            </div>
            ${customer ? `
              <div class="info-card">
                <h3>معلومات العميل</h3>
                <p style="margin: 4px 0;"><strong>الاسم:</strong> ${customer.name}</p>
                ${customer.phone ? `<p style="margin: 4px 0;"><strong>الهاتف:</strong> ${customer.phone}</p>` : ''}
                ${customer.address ? `<p style="margin: 4px 0;"><strong>العنوان:</strong> ${customer.address}</p>` : ''}
              </div>
            ` : ''}
            <div class="info-card">
              <h3>تفاصيل الدفع والمبيعات</h3>
              <p style="margin: 4px 0;"><strong>طريقة الدفع:</strong> ${
                invoice.paymentMethod === 'cash' ? 'نقدي (كاش)' : 
                invoice.paymentMethod === 'visa' ? 'بطاقة ائتمان' : 
                invoice.paymentMethod === 'vodafone' ? 'فودافون كاش' : 
                invoice.paymentMethod === 'instapay' ? 'انستا باي' : 
                'آجل (على الحساب)'
              }</p>
              <p style="margin: 4px 0;"><strong>حالة الدفع:</strong> ${invoice.paymentMethod === 'debt' ? 'آجل (على الحساب)' : 'مدفوعة بالكامل'}</p>
              ${invoice.cashierId ? `<p style="margin: 4px 0;"><strong>الكاشير:</strong> مدير معتمد</p>` : ''}
              ${headerMsg ? `<p style="margin: 4px 0; color: #4b5563; font-style: italic;">"${headerMsg}"</p>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th>المنتج</th>
                <th style="text-align: center; width: 15%;">الكمية</th>
                <th style="text-align: left; width: 20%;">سعر الوحدة</th>
                <th style="text-align: left; width: 20%;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.items || []).map((it: any, index: number) => `
                <tr>
                  <td>${index + 1}</td>
                  <td style="font-weight: 700;">${it.name}</td>
                  <td style="text-align: center;">${it.quantity}</td>
                  <td style="text-align: left;">${formatCurrency(it.price)}</td>
                  <td style="text-align: left; font-weight: 700;">${formatCurrency(it.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="width: 50%;">
              ${taxNumber ? `
                <div style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; background: #fafafa; display: inline-block;">
                  <div style="font-weight: 700; font-size: 11px; margin-bottom: 5px;">فاتورة ضريبية إلكترونية معتمدة</div>
                  <div style="color: #64748b; font-size: 10px; line-height: 1.4;">
                    خاضعة لأنظمة هيئة الزكاة والضريبة والجمارك واللوائح التنفيذية لضريبة القيمة المضافة.
                  </div>
                </div>
              ` : ''}
            </div>
            <div>
              <table class="totals-table">
                ${showTax ? `
                  <tr>
                    <td style="color: #64748b;">المجموع الفرعي</td>
                    <td style="text-align: left; font-weight: 700;">${formatCurrency(invoice.subtotal || invoice.total)}</td>
                  </tr>
                  ${invoice.tax > 0 ? `
                    <tr>
                      <td style="color: #64748b;">ضريبة القيمة المضافة (${settings?.taxRate || 15}%)</td>
                      <td style="text-align: left; font-weight: 700;">${formatCurrency(invoice.tax)}</td>
                    </tr>
                  ` : ''}
                ` : ''}
                <tr class="grand-total">
                  <td>الإجمالي النهائي</td>
                  <td style="text-align: left;">${formatCurrency(invoice.total)}</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="footer">
            <p style="margin: 0; font-weight: 700;">${footerMsg}</p>
            <p style="margin: 5px 0 0 0; color: #94a3b8;">تم إنشاء هذه الفاتورة إلكترونياً عبر نظام نقاط البيع.</p>
          </div>
        </div>
        </body></html>
      `;
    }

    const w = window.open('', '_blank', paperSize === '80mm' ? 'width=400,height=600' : 'width=900,height=900');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); w.close(); }, 400);
    }
  };

  const handleCheckout = async (method: 'cash' | 'visa' | 'debt' | 'vodafone' | 'instapay') => {
    if (isSaving) return;
    if (!user?.uid) { alert('يرجى تسجيل الدخول أولاً'); return; }
    if (cart.length === 0) return;

    if (method === 'debt' && (!selectedCustomer || selectedCustomer.id === 'WALK-IN')) {
      alert('يجب اختيار عميل مسجل لإجراء عملية البيع الآجل.');
      return;
    }

    setIsSaving(true);
    try {
      const order: Order = {
        id: `ADM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        items: cart,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentMethod: method,
        cashierId: user.uid,
        shiftId: 'ADMIN-DIRECT',
        branchId: selectedBranchId || 'ADMIN',
        createdAt: new Date().toISOString(),
        customerId: selectedCustomer ? selectedCustomer.id : 'WALK-IN',
        status: 'COMPLETED',
        notes: noteText.trim() || undefined,
      };
      await addInvoice(order);

      // Update customer balance and loyalty points if a registered customer is selected
      if (selectedCustomer && selectedCustomer.id !== 'WALK-IN') {
        const pointsToAdd = Math.floor(total / 10) || 0;
        let updateData: any = {
          points: (selectedCustomer.points || 0) + pointsToAdd
        };

        if (method === 'debt') {
          let currentBalance = selectedCustomer.balance || 0;
          let currentType = selectedCustomer.balanceType || 'debit';
          let newBalance = 0;
          let newType: 'credit' | 'debit' = 'debit';

          if (currentType === 'credit') {
            if (currentBalance >= total) {
              newBalance = currentBalance - total;
              newType = 'credit';
            } else {
              newBalance = total - currentBalance;
              newType = 'debit';
            }
          } else {
            // debit
            newBalance = currentBalance + total;
            newType = 'debit';
          }

          updateData.balance = newBalance;
          updateData.balanceType = newType;
        }

        await updateDoc(doc(db, 'customers', selectedCustomer.id), updateData);
      }

      printReceipt(order);

      // Delay for 2 seconds to show "تم التحصيل وجاري الطباعة..."
      await new Promise(resolve => setTimeout(resolve, 2000));

      setIsSuccess(true);
      setCart([]);
      setIsCheckoutOpen(false);
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
      setNoteText('');
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  // Branch selection screen
  if (!selectedBranchId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-12" dir="rtl">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
          <Store className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-2">نقطة البيع — إدارة</h2>
        <p className="text-gray-400 font-medium mb-10">اختر الفرع لبدء الجلسة</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-xl">
          <button
            onClick={() => setSelectedBranchId('ADMIN')}
            className="p-8 bg-white border-2 border-gray-100 rounded-3xl hover:border-blue-600 hover:bg-blue-50/30 hover:-translate-y-1 transition-all shadow-sm hover:shadow-lg flex flex-col items-center gap-4"
          >
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
              <BarChart3 className="w-7 h-7" />
            </div>
            <span className="font-black text-gray-900">بيع مباشر (بدون فرع)</span>
          </button>
          {branchWarehouses.map(branch => (
            <button
              key={branch.id}
              onClick={() => setSelectedBranchId(branch.id)}
              className="p-8 bg-white border-2 border-gray-100 rounded-3xl hover:border-blue-600 hover:bg-blue-50/30 hover:-translate-y-1 transition-all shadow-sm hover:shadow-lg flex flex-col items-center gap-4"
            >
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Building2 className="w-7 h-7" />
              </div>
              <span className="font-black text-gray-900">{branch.name}</span>
              <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">{(branch as any).code || 'BRANCH'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]" dir="rtl">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900">
              {selectedBranch?.name || 'بيع مباشر'}
            </h2>
            <p className="text-sm text-gray-400 font-bold">نقطة البيع — المدير</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isSuccess && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="flex items-center gap-2 bg-green-50 text-green-600 px-5 py-2.5 rounded-2xl font-black text-sm border border-green-100">
              <CheckCircle2 className="w-4 h-4" /> تمت العملية بنجاح!
            </motion.div>
          )}
          <button onClick={() => setSelectedBranchId('')}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all">
            <RefreshCcw className="w-4 h-4" /> تغيير الفرع
          </button>
          <button onClick={() => navigate('/')}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all">
            <ArrowLeft className="w-4 h-4" /> الرئيسية
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Products Panel */}
        <div className="xl:col-span-8 space-y-4">
          {/* Search & Filters */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-4">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text" placeholder="بحث بالاسم أو الباركود..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full border border-gray-200 rounded-2xl pr-10 pl-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={cn('px-4 py-1.5 rounded-xl text-xs font-black transition-all',
                    selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                  {cat === 'All' ? 'الكل' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-300">
                <Package className="w-16 h-16 mb-4 opacity-30" />
                <p className="font-bold text-lg">لا توجد منتجات</p>
              </div>
            ) : filteredProducts.map((product) => {
              const inCart = cart.find(i => i.productId === product.id);
              return (
                <motion.div key={product.id}
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                  onClick={() => addToCart(product)}
                  className={cn(
                    'bg-white rounded-3xl border-2 p-4 cursor-pointer transition-all shadow-sm hover:shadow-md relative',
                    inCart ? 'border-blue-400 shadow-blue-50' : 'border-gray-100'
                  )}
                >
                  {inCart && (
                    <span className="absolute top-3 left-3 bg-blue-600 text-white font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                      {inCart.quantity}
                    </span>
                  )}
                  <div className="w-full aspect-square bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name}
                        className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <Package className="w-10 h-10 text-gray-200" />
                    )}
                  </div>
                  <p className="font-black text-gray-900 text-sm mb-1 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400 font-bold mb-2 truncate">{product.category}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-blue-600 text-sm">{formatCurrency(product.sellingPrice)}</span>
                    {product.trackInventory === false ? (
                      <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-green-50 text-green-600">
                        متاح
                      </span>
                    ) : (
                      <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg border',
                        (product.branchStock ?? 0) === 0 ? 'bg-red-50 text-red-500 border-red-200' :
                        (product.branchStock ?? 0) < 5 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'
                      )}>
                        {(product.branchStock ?? 0) === 0 ? "نفذ" : product.branchStock}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="xl:col-span-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
            {/* Cart Header */}
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-gray-900">السلة</h3>
                {cart.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-red-400 font-bold hover:text-red-600 transition-colors">
                  مسح الكل
                </button>
              )}
            </div>

            {/* Cart Items */}
            <div className="max-h-80 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                  <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm font-bold">السلة فارغة</p>
                </div>
              ) : cart.map(item => (
                <div key={item.sku || item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 font-bold">{formatCurrency(item.price)} / قطعة</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.sku || item.productId, -1)}
                      className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-black text-sm text-gray-900">{item.quantity}</span>
                    <button onClick={() => updateQty(item.sku || item.productId, 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-green-50 hover:text-green-600 hover:border-green-100 transition-all">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-left w-20">
                    <p className="font-black text-sm text-gray-900">{formatCurrency(item.total)}</p>
                  </div>
                  <button onClick={() => removeItem(item.sku || item.productId)}
                    className="w-7 h-7 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Totals */}
            {cart.length > 0 && (
              <div className="border-t border-gray-50 p-6 space-y-4">
                {/* Customer Selector */}
                <div className="bg-white rounded-3xl p-4 border border-gray-100/80 space-y-3 relative z-20" ref={customerDropdownRef}>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">العميل</label>
                    <button
                      type="button"
                      onClick={() => setIsNewCustomerModalOpen(true)}
                      className="text-xs font-black text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer focus:outline-none"
                    >
                      + عميل جديد
                    </button>
                  </div>
                  
                  <div className="relative">
                    <div className="relative">
                      <User className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="بحث بالاسم أو رقم الهاتف..."
                        value={selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.phone})` : customerSearchTerm}
                        onFocus={() => {
                          setShowCustomerDropdown(true);
                          if (selectedCustomer) {
                            setCustomerSearchTerm('');
                            setSelectedCustomer(null);
                          }
                        }}
                        onChange={(e) => {
                          setCustomerSearchTerm(e.target.value);
                          setShowCustomerDropdown(true);
                          setSelectedCustomer(null);
                        }}
                        className="w-full bg-slate-50 border-none rounded-2xl pr-10 pl-4 py-3 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-right"
                      />
                      {selectedCustomer && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setCustomerSearchTerm('');
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Customer Dropdown */}
                    <AnimatePresence>
                      {showCustomerDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 w-full mt-2 bg-white rounded-2xl border border-slate-100 shadow-2xl max-h-56 overflow-y-auto scrollbar-thin text-right"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(null);
                              setCustomerSearchTerm('');
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-right p-3 hover:bg-slate-50 border-b border-slate-50 transition-colors flex items-center justify-between text-xs font-black text-slate-500"
                          >
                            <span>عميل نقدي / سفري (سريع)</span>
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-400 font-bold">افتراضي</span>
                          </button>
                          {customers.filter(c =>
                            (c.branchId || 'ADMIN') === selectedBranchId && (
                              c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                              c.phone.includes(customerSearchTerm)
                            )
                          ).length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-400 font-bold">لا يوجد نتائج مطابقة</div>
                          ) : (
                            customers.filter(c =>
                              (c.branchId || 'ADMIN') === selectedBranchId && (
                                c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                                c.phone.includes(customerSearchTerm)
                              )
                            ).map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  setCustomerSearchTerm(`${c.name} (${c.phone})`);
                                  setShowCustomerDropdown(false);
                                }}
                                className="w-full text-right p-3 hover:bg-blue-50/50 border-b border-slate-50 transition-colors flex items-center justify-between gap-2"
                              >
                                <div className="text-right">
                                  <p className="text-xs font-black text-slate-800">{c.name}</p>
                                  <p className="text-[9px] text-gray-400 font-bold mt-0.5">{c.phone}</p>
                                </div>
                                <div className="text-left shrink-0">
                                  {c.balance > 0 ? (
                                    <span className={cn(
                                      "text-[9px] px-2 py-0.5 rounded font-black border",
                                      c.balanceType === 'credit' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                                    )}>
                                      {formatCurrency(c.balance)} {c.balanceType === 'credit' ? 'دائن' : 'مدين'}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-400 font-bold">رصيد: 0.00</span>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Selected Customer Stats & Action */}
                  {selectedCustomer && (
                    <div className="flex items-center justify-between bg-slate-50/60 p-3 rounded-2xl border border-slate-100/50">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold leading-none mb-1">الرصيد المالي الحالي</p>
                        <p className={cn(
                          "text-xs font-black",
                          selectedCustomer.balance === 0
                            ? "text-slate-500"
                            : selectedCustomer.balanceType === 'credit'
                            ? "text-emerald-600"
                            : "text-rose-600"
                        )}>
                          {selectedCustomer.balance > 0
                            ? `${formatCurrency(selectedCustomer.balance)} ${selectedCustomer.balanceType === 'credit' ? 'دائن (له)' : 'مدين (عليه)'}`
                            : '0.00 ج.م'
                          }
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem(`default_pos_customer_id_${selectedBranchId}`, selectedCustomer.id);
                          alert(`تم تعيين العميل "${selectedCustomer.name}" كعميل افتراضي للبيعات بنجاح.`);
                        }}
                        className="px-3 py-1.5 bg-white text-slate-600 font-black border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-[10px] cursor-pointer focus:outline-none"
                      >
                        تعيين كافتراضي
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-400 font-bold">
                    <span>المجموع الفرعي</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm text-gray-400 font-bold">
                      <span>الضريبة ({taxRate}%)</span>
                      <span>{formatCurrency(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-gray-900 text-lg pt-2 border-t border-gray-100">
                    <span>الإجمالي</span>
                    <span className="text-blue-600">{formatCurrency(total)}</span>
                  </div>
                </div>

                <textarea
                  placeholder="ملاحظات (اختياري)..."
                  value={noteText} onChange={e => setNoteText(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                  rows={2}
                />

                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" /> تأكيد وإتمام البيع
                </button>

                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest text-center mb-3">أو طباعة بدون تسجيل</p>
                  <button
                    onClick={() => printReceipt({ id: 'DRAFT', items: cart, total, paymentMethod: 'cash' })}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-black transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة مسودة الفاتورة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
              onClick={() => !isSaving && setIsCheckoutOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl" dir="rtl"
            >
              {isSaving ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner animate-pulse">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                  <h3 className="text-3xl font-black text-gray-900 mb-2">تم التحصيل</h3>
                  <p className="text-gray-500 font-bold text-lg">جاري الطباعة وتحديث البيانات...</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-2xl font-black text-gray-900">طريقة الدفع</h3>
                      <p className="text-blue-600 font-black text-xl mt-1">{formatCurrency(total)}</p>
                    </div>
                    <button onClick={() => setIsCheckoutOpen(false)}
                      className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('cash')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-green-50/50 hover:border-green-600 bg-green-50/30 hover:bg-green-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-100 group-hover:scale-110 transition-transform mb-2">
                        <Banknote className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">نقدي (كاش)</span>
                    </button>

                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('visa')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-blue-50/50 hover:border-blue-600 bg-blue-50/30 hover:bg-blue-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform mb-2">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">بطاقة (فيزا)</span>
                    </button>

                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('vodafone')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-red-50/50 hover:border-red-600 bg-red-50/30 hover:bg-red-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-100 group-hover:scale-110 transition-transform mb-2">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">فودافون كاش</span>
                    </button>

                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('instapay')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-pink-50/50 hover:border-pink-600 bg-pink-50/30 hover:bg-pink-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-100 group-hover:scale-110 transition-transform mb-2">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">انستا باي</span>
                    </button>

                    {selectedCustomer && selectedCustomer.id !== 'WALK-IN' && (
                      <button
                        disabled={isSaving}
                        onClick={() => handleCheckout('debt')}
                        className="col-span-2 flex items-center justify-center gap-4 p-5 rounded-[2rem] border-2 border-amber-50/50 hover:border-amber-600 bg-amber-50/30 hover:bg-amber-50 transition-all group disabled:opacity-50 text-center"
                      >
                        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-100 group-hover:scale-110 transition-transform">
                          <User className="w-5 h-5" />
                        </div>
                        <span className="font-black text-gray-800 text-sm">بيع آجل (على الحساب)</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add Customer Modal */}
      <AnimatePresence>
        {isNewCustomerModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-900">إضافة عميل جديد سريع</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">تجهيز حساب العميل فورياً للربط بالفاتورة الحالية</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors font-bold cursor-pointer focus:outline-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-8 space-y-4 text-right">
                <div>
                  <label className="text-xs font-black text-slate-400 block mb-2">اسم العميل *</label>
                  <input
                    type="text"
                    id="quick-customer-name"
                    placeholder="الاسم الكامل للعميل"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-right"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 block mb-2">رقم الهاتف *</label>
                  <input
                    type="tel"
                    id="quick-customer-phone"
                    placeholder="رقم الهاتف للتواصل والبحث"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-right font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 block mb-2">العنوان</label>
                  <input
                    type="text"
                    id="quick-customer-address"
                    placeholder="عنوان العميل (اختياري)"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-right"
                  />
                </div>
                
                <div className="flex gap-3 pt-6 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerModalOpen(false)}
                    className="flex-1 py-3.5 bg-slate-50 text-slate-500 font-black rounded-2xl hover:bg-slate-100 transition-all text-xs cursor-pointer focus:outline-none"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const nameInput = document.getElementById('quick-customer-name') as HTMLInputElement;
                      const phoneInput = document.getElementById('quick-customer-phone') as HTMLInputElement;
                      const addressInput = document.getElementById('quick-customer-address') as HTMLInputElement;
                      
                      const cName = nameInput?.value?.trim();
                      const cPhone = phoneInput?.value?.trim();
                      const cAddress = addressInput?.value?.trim() || '';
                      
                      if (!cName || !cPhone) {
                        alert('الرجاء إدخال اسم العميل ورقم هاتفه.');
                        return;
                      }
                      
                      try {
                        const newCustomerRef = await addDoc(collection(db, 'customers'), {
                          name: cName,
                          phone: cPhone,
                          address: cAddress,
                          balance: 0,
                          balanceType: 'debit',
                          points: 0,
                          branchId: selectedBranchId || 'ADMIN',
                          createdAt: new Date().toISOString()
                        });
                        
                        const newCust: Customer = {
                          id: newCustomerRef.id,
                          name: cName,
                          phone: cPhone,
                          address: cAddress,
                          balance: 0,
                          balanceType: 'debit',
                          points: 0,
                          branchId: selectedBranchId || 'ADMIN',
                          createdAt: new Date().toISOString()
                        };
                        
                        setSelectedCustomer(newCust);
                        setCustomerSearchTerm(`${cName} (${cPhone})`);
                        setIsNewCustomerModalOpen(false);
                      } catch (err) {
                        console.error('Quick customer add failed:', err);
                        alert('حدث خطأ أثناء إضافة العميل سريعاً.');
                      }
                    }}
                    className="flex-1 py-3.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all text-xs cursor-pointer focus:outline-none"
                  >
                    حفظ واختيار العميل
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Variant Selector Modal */}
      <AnimatePresence>
        {variantSelectorProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-900">اختر المقاس واللون</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">{variantSelectorProduct.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVariantSelectorProduct(null)}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors font-bold cursor-pointer focus:outline-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 gap-3">
                  {variantSelectorProduct.variants?.map((v, index) => {
                    const vStock = getVariantBranchStock(variantSelectorProduct, v);
                    const isOutOfStock = variantSelectorProduct.trackInventory !== false && vStock <= 0;
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => addToCart(variantSelectorProduct, v)}
                        className={cn(
                          "w-full text-right p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-4",
                          isOutOfStock
                            ? "border-gray-50 bg-gray-50/50 opacity-50 cursor-not-allowed"
                            : "border-gray-100 bg-white hover:border-blue-600 hover:bg-blue-50/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-600 shrink-0 font-sans font-black text-sm">
                            {v.size || '-'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-800">{v.color || 'بدون لون'}</span>
                              {v.sku && <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{v.sku}</span>}
                            </div>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">
                              السعر: <span className="text-blue-600 font-sans">{formatCurrency(v.price || variantSelectorProduct.sellingPrice)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          {isOutOfStock ? (
                            <span className="text-xs font-black text-rose-500 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                              نفذ المخزن
                            </span>
                          ) : (
                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                              متوفر: {vStock} قطعة
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
