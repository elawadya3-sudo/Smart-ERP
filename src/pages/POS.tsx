import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  User,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  X,
  CheckCircle2,
  Package,
  Store,
  TrendingUp,
  ArrowDownCircle,
  BarChart3,
  History as HistoryIcon,
  LayoutDashboard,
  Bell,
  RefreshCcw,
  Edit3,
  ArrowRightLeft,
  Building2,
  Send,
  Wallet,
  Smartphone,
  QrCode,
  Loader2
} from 'lucide-react';
import { productsService, ordersService } from '../services/firestore';
import { Product, OrderItem, StockLevel, Order, Warehouse, InventoryTransaction, Customer, ProductVariant, PrintTemplate } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { printReceiptHelper } from '../lib/receiptPrinter';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useAuth } from '../context/AuthContext';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSearchParams } from 'react-router-dom';

import { usePOS } from '../context/POSContext';
import PosNavbar from '../components/layout/PosNavbar';
import PosBreadcrumbs from '../components/layout/PosBreadcrumbs';
import { useDesktop } from '../context/DesktopIntegrationContext';
import { useMainStoreSettings } from '../hooks/useMainStoreSettings';
import JsBarcode from 'jsbarcode';

export default function POS() {
  const { user } = useAuth();
  const { getOpenShift, openShift, closeShift, addInvoice, updateInvoice, deleteInvoice, invoices: contextInvoices, requestBranchTransfer } = usePOS();
  const { isOnline, isSyncing, isElectron } = useDesktop();
  const { settings } = useMainStoreSettings();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [activeBranchIds, setActiveBranchIds] = useState<string[]>([]);

  // Memoize allowed branch IDs for cashiers (consolidated mode)
  const allowedBranchIds = React.useMemo(() => {
    if (user?.role === 'CASHIER') {
      const uAllowed = (user as any).allowedBranches || [];
      if (uAllowed.length > 0) {
        return uAllowed.includes(user.branchId) ? uAllowed : [...uAllowed, user.branchId].filter(Boolean);
      }
      return user.branchId ? [user.branchId] : [];
    }
    return selectedBranchId ? [selectedBranchId] : [];
  }, [user, selectedBranchId]);

  // Sync activeBranchIds when allowedBranchIds or selectedBranchId changes
  useEffect(() => {
    if (allowedBranchIds.length > 0) {
      setActiveBranchIds(allowedBranchIds);
    } else if (selectedBranchId) {
      setActiveBranchIds([selectedBranchId]);
    } else {
      setActiveBranchIds([]);
    }
  }, [allowedBranchIds, selectedBranchId]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransaction[]>([]);
  const [variantSelectorProduct, setVariantSelectorProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [openingCash, setOpeningCash] = useState(0);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [actualCash, setActualCash] = useState(0);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [showReturnPanel, setShowReturnPanel] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [holdNote, setHoldNote] = useState('');
  const [editingPendingInvoiceId, setEditingPendingInvoiceId] = useState<string | null>(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'cash' | 'visa' | 'debt' | 'vodafone' | 'instapay'>('cash');
  const [lastTransferId, setLastTransferId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  // Cross-branch tab state
  const [productTab, setProductTab] = useState<'branch' | 'crossbranch'>('branch');
  const [branchSearchTerm, setBranchSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [cameraSupported, setCameraSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const [requestModal, setRequestModal] = useState<{
    product: any;
    fromBranch: Warehouse;
    availableQty: number;
  } | null>(null);
  const [requestQty, setRequestQty] = useState(1);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showIncomingRequestsModal, setShowIncomingRequestsModal] = useState(false);
  const isFirstLoad = React.useRef(true);
  const [printTemplates, setPrintTemplates] = useState<PrintTemplate[]>([]);

  // Customer Selector State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [quickCustomerAddress, setQuickCustomerAddress] = useState('');
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

  // Fetch Print Templates
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'print_templates'), (snapshot) => {
      setPrintTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrintTemplate)));
    });
    return () => unsub();
  }, []);

  // Sync default customer
  useEffect(() => {
    if (customers.length > 0 && selectedBranchId) {
      const defaultCustomerId = localStorage.getItem(`default_pos_customer_id_${selectedBranchId}`);
      if (defaultCustomerId) {
        const found = customers.find(c => c.id === defaultCustomerId && c.branchId === selectedBranchId);
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

  // Generate barcode when selectedDetail changes
  useEffect(() => {
    setShowReturnPanel(false);
    setReturnQuantities({});
    if (selectedDetail && selectedDetail.id) {
      const timer = setTimeout(() => {
        try {
          JsBarcode('#invoice-barcode-svg', selectedDetail.id, {
            format: 'CODE128',
            width: 1.6,
            height: 45,
            displayValue: true,
            fontSize: 12,
            margin: 2
          });
        } catch (err) {
          console.warn("JsBarcode invoice error:", err);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedDetail]);

  const handlePrintReceipt = (inv: Order) => {
    const customer = customers.find(c => c.id === inv.customerId);
    const cashierName = user?.name || 'نظام البيع';
    const electronAPI = (window as any).electronAPI;

    printReceiptHelper({
      invoice: inv,
      templates: printTemplates,
      settings,
      branchName: branchWarehouse?.name || 'الفرع',
      customer,
      cashierName,
      isElectron,
      electronAPI
    });
  };

  const getWhatsAppUrl = (phone: string, invoice: any) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '2' + cleaned;
    } else if (cleaned.length === 10 && !cleaned.startsWith('0') && !cleaned.startsWith('2')) {
      cleaned = '20' + cleaned;
    }
    const storeName = settings?.storeName || 'متجرنا';
    const dateStr = new Date(invoice.createdAt).toLocaleDateString('ar-EG');
    const itemsText = (invoice.items || []).map((item: any) => `- ${item.name} (الكمية: ${item.quantity})`).join('\n');
    const message = `مرحباً ${customers.find(c => c.id === invoice.customerId)?.name || ''}،\nشكراً لتسوقك معنا في ${storeName}.\n\nتفاصيل فاتورتك رقم: ${invoice.id}\nالتاريخ: ${dateStr}\n\nالأصناف:\n${itemsText}\n\nالإجمالي النهائي: ${formatCurrency(invoice.total)}\nطريقة الدفع: ${
      invoice.paymentMethod === 'cash' ? 'نقدي' : 
      invoice.paymentMethod === 'visa' ? 'بطاقة ائتمان' : 
      invoice.paymentMethod === 'vodafone' ? 'فودافون كاش' : 
      invoice.paymentMethod === 'instapay' ? 'انستا باي' : 
      'آجل'
    }\n\nيسعدنا دائماً خدمتكم!`;
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  };

  // Incoming transfer requests directed to this branch
  const incomingRequests = React.useMemo(() => {
    return transfers.filter(t => 
      t.type === 'TRANSFER' && 
      t.status === 'PENDING' && 
      t.reference === 'BRANCH_REQUEST' && 
      t.fromWarehouseId === selectedBranchId &&
      !transfers.some(fulfilledTx => fulfilledTx.reference === t.id)
    );
  }, [transfers, selectedBranchId]);

  // Outgoing transfer requests created by this branch
  const outgoingRequests = React.useMemo(() => {
    return transfers.filter(t => 
      t.type === 'TRANSFER' && 
      t.reference === 'BRANCH_REQUEST' && 
      t.toWarehouseId === selectedBranchId
    );
  }, [transfers, selectedBranchId]);

  // Fetch Warehouses
  useEffect(() => {
    const qW = query(collection(db, 'warehouses'));
    const unsubscribe = onSnapshot(qW, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
      setWarehouses(docs);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Products from Firestore
  useEffect(() => {
    const qP = query(collection(db, 'products'));
    const unsubP = onSnapshot(qP, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return () => unsubP();
  }, []);

  // Fetch completed transfers to calculate branch stock
  useEffect(() => {
    const qT = query(collection(db, 'inventory_transactions'), orderBy('createdAt', 'desc'));
    const unsubT = onSnapshot(qT, (snapshot) => {
      setTransfers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as InventoryTransaction)));
    });
    return () => unsubT();
  }, []);

  // Auto-set branch for cashiers
  useEffect(() => {
    if (user?.role === 'CASHIER' && user.branchId) {
      setSelectedBranchId(user.branchId);
      const allowed = (user as any).allowedBranches || [];
      setActiveBranchIds(allowed.length > 0 ? (allowed.includes(user.branchId) ? allowed : [...allowed, user.branchId].filter(Boolean)) : [user.branchId]);
    }
  }, [user]);

  useEffect(() => {
    setCameraSupported(!!(navigator.mediaDevices?.getUserMedia));
  }, []);

  // Sync isFirstLoad
  useEffect(() => {
    if (transfers.length > 0) {
      setTimeout(() => { isFirstLoad.current = false; }, 3000);
    }
  }, [transfers]);

  const currentShift = getOpenShift(selectedBranchId);
  const branchWarehouse = warehouses.find(w => w.id === selectedBranchId);

  const initializeZXingScanner = () => {
    if (!videoRef.current) {
      scanTimeoutRef.current = window.setTimeout(initializeZXingScanner, 200);
      return;
    }

    if (!scannerRef.current) {
      scannerRef.current = new BrowserMultiFormatReader();
    }

    scannerRef.current.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
      if (result) {
        const code = result.getText();
        if (code) {
          setSearchTerm(code);
          stopBarcodeCamera();
          handleBarcodeSearch(code);
        }
      } else if (err) {
        const isNotFound = err?.name === 'NotFoundException' || err?.message?.includes('not found');
        if (!isNotFound) {
          console.warn('ZXing scan error', err);
        }
      }
    }).catch(err => {
      console.error('ZXing init error:', err);
      setScanMessage('فشل تشغيل ماسح الكاميرا. الرجاء المحاولة مرة أخرى.');
      setIsScanning(false);
    });
  };

  const startBarcodeCamera = async () => {
    if (!cameraSupported) {
      alert('الكاميرا غير متاحة في هذا المتصفح. يمكنك استخدام قارئ باركود USB أو إدخال الباركود يدوياً.');
      return;
    }

    setIsScanning(true);
    setScanMessage('جاري تشغيل الكاميرا...');
    initializeZXingScanner();
  };

  const stopBarcodeCamera = () => {
    setIsScanning(false);
    setScanMessage('');
    if (scanTimeoutRef.current) {
      window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    if (scannerRef.current) {
      scannerRef.current = null;
    }
  };

  const handleBarcodeSearch = (barcode: string) => {
    const normalized = barcode.trim();
    if (!normalized) return;

    // Check if barcode represents an invoice
    const matchedInvoice = contextInvoices.find(inv => 
      inv.id === normalized || 
      inv.id === `INV-${normalized.toUpperCase()}` || 
      (inv.id && inv.id.endsWith(normalized.toUpperCase()))
    );
    if (matchedInvoice) {
      setSelectedDetail(matchedInvoice);
      setSearchTerm('');
      return;
    }

    let matchedProduct: Product | undefined = undefined;
    let matchedVariant: ProductVariant | undefined = undefined;

    for (const p of availableProducts) {
      if (String(p.barcode) === normalized || p.name === normalized) {
        matchedProduct = p;
        break;
      }
      if (p.variants) {
        const foundV = p.variants.find(v => String(v.barcode) === normalized || String(v.sku) === normalized);
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
      return;
    }

    setSearchTerm(normalized);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const normalized = searchTerm.trim();
    if (!normalized) return;

    // Check if barcode represents an invoice
    const matchedInvoice = contextInvoices.find(inv => 
      inv.id === normalized || 
      inv.id === `INV-${normalized.toUpperCase()}` || 
      (inv.id && inv.id.endsWith(normalized.toUpperCase()))
    );
    if (matchedInvoice) {
      setSelectedDetail(matchedInvoice);
      setSearchTerm('');
      return;
    }

    let matchedProduct: Product | undefined = undefined;
    let matchedVariant: ProductVariant | undefined = undefined;

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

  const pendingInvoices = React.useMemo(() => {
    if (!currentShift || !selectedBranchId) return [];
    return contextInvoices.filter(inv =>
      inv.branchId === selectedBranchId &&
      inv.shiftId === currentShift.id &&
      inv.status === 'PENDING'
    );
  }, [contextInvoices, selectedBranchId, currentShift]);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const invId = searchParams.get('invoiceId');
    if (invId && contextInvoices.length > 0) {
      const inv = contextInvoices.find(i => String(i.id) === String(invId));
      if (inv) {
        setSelectedDetail(inv);
        // Clean up URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('invoiceId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, contextInvoices]);

  // Memoized stock levels for all active branches to optimize performance
  const consolidatedStockMap = React.useMemo(() => {
    const stockMap: Record<string, Record<string, number>> = {}; // branchId -> { sku -> qty }

    activeBranchIds.forEach(bId => {
      stockMap[bId] = {};
      
      // 1. Calculate incoming transfers & receipts
      transfers
        .filter(t => t && (t.type === 'TRANSFER' || t.type === 'RECEIPT') && t.status === 'COMPLETED' && t.toWarehouseId === bId)
        .forEach(t => {
          t.items?.forEach(item => {
            const key = item.sku || item.productId;
            stockMap[bId][key] = (stockMap[bId][key] || 0) + (item.quantity || 0);
            if (item.sku && item.productId) {
              stockMap[bId][item.productId] = (stockMap[bId][item.productId] || 0) + (item.quantity || 0);
            }
          });
        });

      // 2. Subtract outgoing sales (completed and partially returned invoices)
      contextInvoices
        .filter(inv => inv && inv.customerId !== 'EXPENSE' && (inv.status === 'COMPLETED' || inv.status === 'PARTIALLY_RETURNED' || !inv.status))
        .forEach(inv => {
          inv.items?.forEach(item => {
            const itemBranchId = item.branchId || item.warehouseId || inv.branchId;
            if (itemBranchId !== bId) return;

            const qty = (item.quantity || 0) - (item.returnedQuantity || 0);
            const itemSku = item.variant?.sku || item.sku;
            const key = itemSku || item.productId;
            stockMap[bId][key] = (stockMap[bId][key] || 0) - qty;
            if (itemSku && item.productId) {
              stockMap[bId][item.productId] = (stockMap[bId][item.productId] || 0) - qty;
            }
          });
        });

      // 3. Subtract outgoing transfers (to other branches)
      transfers
        .filter(t => t && t.type === 'TRANSFER' && (t.status === 'COMPLETED' || t.status === 'SHIPPED') && t.fromWarehouseId === bId)
        .forEach(t => {
          t.items?.forEach(item => {
            const key = item.sku || item.productId;
            stockMap[bId][key] = (stockMap[bId][key] || 0) - (item.quantity || 0);
            if (item.sku && item.productId) {
              stockMap[bId][item.productId] = (stockMap[bId][item.productId] || 0) - (item.quantity || 0);
            }
          });
        });
    });

    return stockMap;
  }, [transfers, contextInvoices, activeBranchIds]);

  const isMainBranch = branchWarehouse?.type === 'MAIN' || branchWarehouse?.id === '1';

  // Helper to get variant stock for a specific branch ID
  const getVariantBranchStock = (product: Product, variant: ProductVariant, bId: string = selectedBranchId) => {
    const sku = variant.sku || `${product.sku || 'PROD'}-${variant.size}-${variant.color}`;
    const branchStock = consolidatedStockMap[bId]?.[sku] || 0;
    
    const isMain = bId === '1' || warehouses.find(w => w.id === bId)?.type === 'MAIN';
    if (isMain) {
      const initialQty = Number(variant.quantity) || 0;
      return Math.max(0, initialQty + branchStock);
    }
    
    return Math.max(0, branchStock);
  };

  // Helper to get overall product stock for a specific branch ID
  const getProductBranchStock = (product: Product, bId: string = selectedBranchId) => {
    if (product.variants && product.variants.length > 0) {
      return product.variants.reduce((sum, v) => sum + getVariantBranchStock(product, v, bId), 0);
    }
    
    const branchStock = consolidatedStockMap[bId]?.[product.id] || 0;
    const isMain = bId === '1' || warehouses.find(w => w.id === bId)?.type === 'MAIN';
    if (isMain) {
      const initialQty = Number(product.quantity || (product as any).initialQuantity || 0);
      return Math.max(0, initialQty + branchStock);
    }
    return Math.max(0, branchStock);
  };

  // Helper to get consolidated variant stock across all active branches
  const getVariantConsolidatedStock = (product: Product, variant: ProductVariant) => {
    return activeBranchIds.reduce((sum, bId) => sum + getVariantBranchStock(product, variant, bId), 0);
  };

  // Helper to get consolidated product stock across all active branches
  const getProductConsolidatedStock = (product: Product) => {
    return activeBranchIds.reduce((sum, bId) => sum + getProductBranchStock(product, bId), 0);
  };

  // Memoized available products list
  const availableProducts = React.useMemo(() => {
    return products.map(p => ({
      ...p,
      branchStock: getProductConsolidatedStock(p)
    })).filter(p => {
      if ((p as any).isDraft) return false;
      
      // If product belongs to any of the active branches, it is available
      if (p.warehouseId && activeBranchIds.includes(p.warehouseId)) return true;

      // Or if product has had incoming transfers/receipts to any of the active branches
      const hasIncoming = transfers.some(t => 
        (t.type === 'TRANSFER' || t.type === 'RECEIPT') && 
        t.status === 'COMPLETED' && 
        activeBranchIds.includes(t.toWarehouseId) &&
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
  }, [products, consolidatedStockMap, activeBranchIds, warehouses, transfers]);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Extract unique categories from available products
  const categories = React.useMemo(() => {
    const cats = ['All', ...new Set(availableProducts.map(p => p.category).filter(Boolean))];
    return cats;
  }, [availableProducts]);

  const filteredProducts = React.useMemo(() => {
    return availableProducts.filter(p => {
      const matchesVariant = p.variants?.some(v => 
        (v.sku && v.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.barcode && String(v.barcode).toLowerCase().includes(searchTerm.toLowerCase()))
      );
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(searchTerm.toLowerCase())) ||
        matchesVariant;
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [availableProducts, searchTerm, selectedCategory]);

  // Cross-branch stock: compute products available in OTHER branches
  const crossBranchProducts = React.useMemo(() => {
    if (!settings?.allowCrossbranchRequest) return [];
    const otherBranches = warehouses.filter(w =>
      w.id !== selectedBranchId && (w as any).type !== 'MAIN' && w.id !== '1'
    );
    const results: { product: Product; branch: Warehouse; availableQty: number }[] = [];
    otherBranches.forEach(branch => {
      products.forEach(product => {
        // received to this branch
        const received = transfers
          .filter(t => t.type === 'TRANSFER' && t.status === 'COMPLETED' && t.toWarehouseId === branch.id)
          .reduce((acc, t) => {
            const item = t.items?.find(i => i.productId === product.id);
            return acc + (item?.quantity || 0);
          }, 0);
        // sold from this branch
        const sold = contextInvoices
          .filter(inv => inv.branchId === branch.id && (inv.status === 'COMPLETED' || !inv.status) && inv.customerId !== 'EXPENSE')
          .reduce((acc, inv) => {
            const item = inv.items?.find(i => i.productId === product.id);
            return acc + (item?.quantity || 0);
          }, 0);
        const availableQty = Math.max(0, received - sold);
        if (availableQty > 0) {
          results.push({ product, branch, availableQty });
        }
      });
    });
    return results.filter(r =>
      r.product.name.toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
      (r.product.barcode && String(r.product.barcode).toLowerCase().includes(branchSearchTerm.toLowerCase()))
    );
  }, [settings, warehouses, selectedBranchId, products, transfers, contextInvoices, branchSearchTerm]);

  // Branch Selection at start
  if (!selectedBranchId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-gray-50/50 rounded-[3rem] min-h-[70vh]" dir="rtl">
        <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner">
          <Store className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">نظام البيع (POS)</h2>
        <p className="text-gray-400 font-medium mb-10 italic">يرجى اختيار الفرع للبدء في عمليات البيع</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-4">
          {warehouses.filter(w => (w as any).type !== 'MAIN' && w.id !== '1').map(branch => (
            <button
              key={branch.id}
              onClick={() => setSelectedBranchId(branch.id)}
              className="group p-10 bg-white border-2 border-gray-100 rounded-[2.5rem] hover:border-blue-600 hover:bg-blue-50/50 hover:-translate-y-1 transition-all shadow-sm hover:shadow-xl flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-blue-600 transition-colors shadow-inner">
                <Store className="w-8 h-8" />
              </div>
              <span className="font-black text-lg text-gray-900">{branch.name}</span>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{(branch as any).code || 'BRANCH'}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Shift Check - if no open shift for this branch
  if (!currentShift) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 bg-gray-50/50 rounded-[3rem] min-h-[70vh]" dir="rtl">
        <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner">
          <CreditCard className="w-12 h-12" />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-gray-900 mb-2">بدء وردية جديدة</h2>
          <p className="text-gray-400 font-medium max-w-md mx-auto">للبدء في عمليات البيع لفرع {branchWarehouse?.name}، يجب فتح وردية جديدة أولاً.</p>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-2xl w-full max-w-md space-y-8">
          <div className="space-y-3">
            <label className="text-sm font-black text-gray-400 uppercase tracking-widest block text-center">مبلغ الكاش الافتتاحي (Opening Cash)</label>
            <input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 outline-none focus:ring-4 focus:ring-blue-100 font-black text-3xl text-center transition-all"
              placeholder="0.00"
              autoFocus
            />
          </div>

          <button
            disabled={isOpeningShift}
            onClick={async () => {
              if (!user?.uid) {
                alert('لم يتم تحميل بيانات المستخدم بعد. يرجى تسجيل الدخول أو إعادة تحميل الصفحة.');
                return;
              }

              try {
                setIsOpeningShift(true);
                await openShift(selectedBranchId, user.uid, openingCash, user.name || 'مدير النظام');
              } catch (err) {
                alert('فشل فتح الوردية. يرجى التحقق من الاتصال أو الصلاحيات.');
                console.error(err);
              } finally {
                setIsOpeningShift(false);
              }
            }}
            className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:bg-gray-400 disabled:shadow-none"
          >
            {isOpeningShift ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                فتح الوردية الآن للبدء
              </>
            )}
          </button>

          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setSelectedBranchId('')}
              className="w-full text-gray-400 font-bold py-2 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              العودة لاختيار فرع آخر
            </button>
          )}
        </div>
      </div>
    );
  }

  const addToCart = (product: Product & { branchStock?: number }, selectedVariant?: ProductVariant) => {
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      setVariantSelectorProduct(product);
      return;
    }

    const sku = selectedVariant
      ? (selectedVariant.sku || `${product.sku || 'PROD'}-${selectedVariant.size}-${selectedVariant.color}`)
      : product.id;

    const availableStock = selectedVariant
      ? getVariantConsolidatedStock(product, selectedVariant)
      : (product.branchStock ?? getProductConsolidatedStock(product));

    const existing = cart.find(item => {
      if (selectedVariant) {
        return item.productId === product.id &&
               item.variant?.size === selectedVariant.size &&
               item.variant?.color === selectedVariant.color;
      }
      return item.productId === product.id && !item.variant;
    });

    const currentQty = existing ? existing.quantity : 0;
    if (product.trackInventory !== false && settings?.allowNegativeInventory !== true && currentQty + 1 > availableStock) {
      alert('عذراً، الكمية المطلوبة تتجاوز المتاح في المخزن الفرعي');
      return;
    }

    const displayName = selectedVariant
      ? `${product.name} (${selectedVariant.size ? `مقاس: ${selectedVariant.size}` : ''}${selectedVariant.size && selectedVariant.color ? ' / ' : ''}${selectedVariant.color ? `لون: ${selectedVariant.color}` : ''})`
      : product.name;

    if (existing) {
      setCart(cart.map(item => {
        const matches = selectedVariant
          ? (item.productId === product.id && item.variant?.size === selectedVariant.size && item.variant?.color === selectedVariant.color)
          : (item.productId === product.id && !item.variant);

        return matches
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item;
      }));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: displayName,
        sku: sku,
        quantity: 1,
        price: selectedVariant ? (selectedVariant.price || product.sellingPrice) : product.sellingPrice,
        originalPrice: selectedVariant ? (selectedVariant.price || product.sellingPrice) : product.sellingPrice,
        discount: 0,
        minSellingPrice: product.minSellingPrice || 0,
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

  const updateDiscount = (itemSkuOrId: string, discount: number) => {
    const canGiveDiscount = user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_give_discount;
    if (!canGiveDiscount && discount > 0) {
      alert('عذراً، ليس لديك صلاحية منح خصومات.');
      return;
    }

    setCart(cart.map(item => {
      const currentKey = item.sku || item.productId;
      if (currentKey === itemSkuOrId) {
        const maxDiscountPercent = settings?.maxDiscountPercent ?? 100;
        const discountPercent = item.originalPrice > 0 ? (discount / item.originalPrice) * 100 : 0;
        if (discountPercent > maxDiscountPercent) {
          alert(`الخصم تجاوز الحد الأقصى المسموح به في الإعدادات (${maxDiscountPercent}%)`);
          return item;
        }

        const minPrice = item.minSellingPrice || 0;
        const newPrice = item.originalPrice - discount;

        if (minPrice > 0 && newPrice < minPrice) {
          alert(`عذراً، أقل سعر بيع مسموح لهذا المنتج هو ${formatCurrency(minPrice)}`);
          return item;
        }

        return {
          ...item,
          discount: discount,
          price: newPrice,
          total: newPrice * item.quantity
        };
      }
      return item;
    }));
  };

  const updateQuantity = (itemSkuOrId: string, delta: number) => {
    const item = cart.find(i => (i.sku || i.productId) === itemSkuOrId);
    if (!item) return;

    const product = availableProducts.find(p => p.id === item.productId);
    if (!product) return;

    const availableStock = item.variant
      ? getVariantConsolidatedStock(product, item.variant as any)
      : getProductConsolidatedStock(product);

    setCart(cart.map(i => {
      const currentKey = i.sku || i.productId;
      if (currentKey === itemSkuOrId) {
        const newQty = Math.max(1, i.quantity + delta);
        if (product.trackInventory !== false && settings?.allowNegativeInventory !== true && newQty > availableStock) {
          alert('الكمية المتاحة لا تكفي');
          return i;
        }
        return { ...i, quantity: newQty, total: newQty * i.price };
      }
      return i;
    }));
  };

  const removeFromCart = (itemSkuOrId: string) => {
    setCart(cart.filter(item => (item.sku || item.productId) !== itemSkuOrId));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  const taxRate = settings?.taxEnabled ? (settings?.taxRate || 0) : 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const handleCheckout = async (method: 'cash' | 'visa' | 'debt' | 'vodafone' | 'instapay') => {
    if (isSaving) return;
    if (!user?.uid) {
      alert('لم يتم تحميل بيانات المستخدم بعد. يرجى تسجيل الدخول أو إعادة تحميل الصفحة.');
      return;
    }

    const canCreate = user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_create_invoice;
    if (!canCreate) {
      alert('عذراً، ليس لديك صلاحية إنشاء فواتير جديدة.');
      return;
    }

    if (method === 'debt') {
      if (!selectedCustomer || selectedCustomer.id === 'WALK-IN') {
        alert('يجب اختيار عميل مسجل لإجراء عملية البيع الآجل.');
        return;
      }
      if (selectedCustomer.creditLimit !== undefined) {
        const currentDebit = selectedCustomer.balanceType === 'debit' ? selectedCustomer.balance : -selectedCustomer.balance;
        const nextDebit = currentDebit + total;
        if (nextDebit > selectedCustomer.creditLimit) {
          alert(`عذراً، العميل تجاوز الحد الائتماني المسموح به (${formatCurrency(selectedCustomer.creditLimit)})`);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      // Distribute cart items across active branches based on stock availability
      const distributedItems: OrderItem[] = [];

      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (!product || product.trackInventory === false) {
          // If not tracked or product not found, assign to the main selectedBranchId
          distributedItems.push({
            ...item,
            branchId: selectedBranchId
          } as any);
          continue;
        }

        let remainingQty = item.quantity;
        
        // Find stock in each active branch for this product/variant
        const branchStocks = activeBranchIds.map(bId => {
          const stock = item.variant
            ? getVariantBranchStock(product, item.variant as any, bId)
            : getProductBranchStock(product, bId);
          return { branchId: bId, stock };
        });

        // Sort active branches: prefer the primary selectedBranchId first, then others
        const sortedBranches = [
          ...branchStocks.filter(b => b.branchId === selectedBranchId),
          ...branchStocks.filter(b => b.branchId !== selectedBranchId)
        ];

        for (const bStock of sortedBranches) {
          if (remainingQty <= 0) break;
          if (bStock.stock <= 0) continue;

          const take = Math.min(remainingQty, bStock.stock);
          distributedItems.push({
            ...item,
            quantity: take,
            total: take * item.price,
            branchId: bStock.branchId
          } as any);
          remainingQty -= take;
        }

        // If there's still remaining quantity (fallback), assign the rest to the primary branch
        if (remainingQty > 0) {
          distributedItems.push({
            ...item,
            quantity: remainingQty,
            total: remainingQty * item.price,
            branchId: selectedBranchId
          } as any);
        }
      }

      const newInvoice: Order = {
        id: `INV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        items: distributedItems,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentMethod: method,
        cashierId: user.uid,
        shiftId: currentShift.id,
        branchId: selectedBranchId,
        createdAt: new Date().toISOString(),
        customerId: selectedCustomer ? selectedCustomer.id : 'WALK-IN',
        status: 'COMPLETED'
      };

      await addInvoice(newInvoice);

      // Security Logs Trigger
      if (settings?.drawerMonitoringEnabled) {
        await addDoc(collection(db, 'security_logs'), {
          userId: user.uid,
          userName: user.name || 'كاشير',
          action: 'DRAWER_OPENED',
          details: `فتح درج النقدية لإتمام الفاتورة رقم #${newInvoice.id.slice(-8).toUpperCase()}`,
          timestamp: new Date().toISOString()
        });
      }

      const totalDiscount = cart.reduce((sum, item) => sum + (item.discount * item.quantity), 0);
      if (totalDiscount > 0 && settings?.discountMonitoringEnabled) {
        await addDoc(collection(db, 'security_logs'), {
          userId: user.uid,
          userName: user.name || 'كاشير',
          action: 'DISCOUNT_APPLIED',
          details: `تطبيق خصم إجمالي بقيمة ${formatCurrency(totalDiscount)} على الفاتورة رقم #${newInvoice.id.slice(-8).toUpperCase()}`,
          timestamp: new Date().toISOString()
        });
      }

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

      // Automatically trigger thermal receipt printing
      handlePrintReceipt(newInvoice);

      // Show "تم التحصيل وجاري الطباعة..." for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      setIsSuccess(true);
      setCart([]);
      setIsCheckoutOpen(false);
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
      setSelectedDetail(newInvoice);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الفاتورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHoldInvoice = async () => {
    if (cart.length === 0) return;
    if (!selectedBranchId) {
      alert('يرجى اختيار الفرع أولاً قبل تعليق الفاتورة.');
      return;
    }
    if (!currentShift) {
      alert('يرجى فتح وردية نشطة قبل تعليق الفاتورة.');
      return;
    }
    if (!user?.uid) {
      alert('لم يتم تحميل بيانات المستخدم بعد. يرجى تسجيل الدخول أو إعادة تحميل الصفحة.');
      return;
    }

    try {
      const heldInvoice: Order = {
        id: `INV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        items: cart,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentMethod: 'cash',
        cashierId: user.uid,
        shiftId: currentShift.id,
        branchId: selectedBranchId,
        createdAt: new Date().toISOString(),
        customerId: 'WALK-IN',
        status: 'PENDING',
        ...(holdNote.trim() ? { notes: holdNote.trim() } : {})
      };

      await addInvoice(heldInvoice);
      setIsSuccess(true);
      setCart([]);
      setHoldNote('');
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error('Hold invoice error:', err);
      alert('حدث خطأ أثناء تعليق الفاتورة. يرجى المحاولة مرة أخرى.');
    }
  };

  const loadPendingInvoice = (invoice: Order) => {
    if (cart.length > 0 && !window.confirm('سيتم استبدال محتويات السلة الحالية بالفاتورة المعلقة. هل تود المتابعة؟')) {
      return;
    }

    setCart(invoice.items || []);
    setHoldNote(invoice.notes || '');
    setEditingPendingInvoiceId(invoice.id || null);
    setPendingPaymentMethod(invoice.paymentMethod === 'visa' ? 'visa' : 'cash');
  };

  const clearPendingEdit = () => {
    setEditingPendingInvoiceId(null);
    setCart([]);
    setHoldNote('');
    setPendingPaymentMethod('cash');
  };

  const completePendingInvoice = async () => {
    if (!editingPendingInvoiceId) return;
    if (cart.length === 0) {
      alert('لا يمكن إنهاء فاتورة فارغة. يرجى إضافة منتجات أولاً.');
      return;
    }
    if (!selectedBranchId) {
      alert('يرجى اختيار الفرع أولاً قبل إتمام الفاتورة.');
      return;
    }
    if (!currentShift) {
      alert('يرجى فتح وردية نشطة قبل إتمام الفاتورة.');
      return;
    }

    try {
      // Distribute cart items across active branches based on stock availability
      const distributedItems: OrderItem[] = [];

      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (!product || product.trackInventory === false) {
          distributedItems.push({
            ...item,
            branchId: selectedBranchId
          } as any);
          continue;
        }

        let remainingQty = item.quantity;
        
        const branchStocks = activeBranchIds.map(bId => {
          const stock = item.variant
            ? getVariantBranchStock(product, item.variant as any, bId)
            : getProductBranchStock(product, bId);
          return { branchId: bId, stock };
        });

        const sortedBranches = [
          ...branchStocks.filter(b => b.branchId === selectedBranchId),
          ...branchStocks.filter(b => b.branchId !== selectedBranchId)
        ];

        for (const bStock of sortedBranches) {
          if (remainingQty <= 0) break;
          if (bStock.stock <= 0) continue;

          const take = Math.min(remainingQty, bStock.stock);
          distributedItems.push({
            ...item,
            quantity: take,
            total: take * item.price,
            branchId: bStock.branchId
          } as any);
          remainingQty -= take;
        }

        if (remainingQty > 0) {
          distributedItems.push({
            ...item,
            quantity: remainingQty,
            total: remainingQty * item.price,
            branchId: selectedBranchId
          } as any);
        }
      }

      await updateInvoice(editingPendingInvoiceId, {
        items: distributedItems,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentMethod: pendingPaymentMethod,
        status: 'COMPLETED',
        customerId: 'WALK-IN',
        notes: holdNote.trim() ? holdNote.trim() : undefined,
      });
      setIsSuccess(true);
      clearPendingEdit();
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error('Complete pending invoice error:', err);
      alert('حدث خطأ أثناء إتمام الفاتورة المعلقة. يرجى المحاولة مرة أخرى.');
    }
  };

  const deletePendingInvoice = async (invoiceId: string) => {
    if (!invoiceId) {
      alert('لم يتم تحديد الفاتورة لحذفها. يرجى المحاولة مرة أخرى.');
      return;
    }

    const canDelete = user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_delete_invoice;
    if (!canDelete) {
      alert('عذراً، ليس لديك صلاحية إلغاء/حذف الفواتير المعلقة.');
      return;
    }

    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة المعلقة؟ لا يمكن التراجع عن هذا الإجراء.')) return;

    try {
      await deleteInvoice(invoiceId);
      
      // Log Security Action
      if (settings?.cancelMonitoringEnabled) {
        await addDoc(collection(db, 'security_logs'), {
          userId: user?.uid || 'unknown',
          userName: user?.name || 'كاشير',
          action: 'INVOICE_CANCELLED',
          details: `حذف/إلغاء فاتورة معلقة رقم #${invoiceId.slice(-8).toUpperCase()}`,
          timestamp: new Date().toISOString()
        });
      }

      if (editingPendingInvoiceId === invoiceId) {
        clearPendingEdit();
      }
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error('Cancel pending invoice error:', err);
      alert('حدث خطأ أثناء حذف الفاتورة المعلقة. يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <div className="h-full space-y-4" dir="rtl">
      <PosBreadcrumbs />
      <PosNavbar />
      {/* 1. Header Area - Matching Branch Management Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-20"></div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-3xl font-black text-gray-900">{branchWarehouse?.name || 'نقطة البيع'}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={cn("w-2.5 h-2.5 rounded-full", currentShift ? "bg-green-500 animate-pulse" : "bg-gray-300")}></div>
              <p className="text-gray-400 font-medium">
                {currentShift ? `وردية نشطة (${currentShift.id.slice(0, 8)})` : 'لا توجد وردية نشطة'}
              </p>
            </div>
            
            {/* Consolidated POS Branch Toggles */}
            {allowedBranchIds.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100/50">
                <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-wider">نقاط البيع المجمعة:</span>
                {allowedBranchIds.map(bId => {
                  const bName = warehouses.find(w => w.id === bId)?.name || bId;
                  const isActive = activeBranchIds.includes(bId);
                  const isPrimary = bId === selectedBranchId;
                  
                  return (
                    <button
                      key={bId}
                      type="button"
                      disabled={isPrimary}
                      onClick={() => {
                        setActiveBranchIds(prev => 
                          isActive 
                            ? prev.filter(id => id !== bId) 
                            : [...prev, bId]
                        );
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border",
                        isActive
                          ? "bg-white text-blue-600 border-blue-100 shadow-sm"
                          : "bg-transparent text-slate-400 border-transparent hover:bg-slate-100/50 hover:text-slate-600"
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full", isActive ? "bg-blue-600" : "bg-slate-300")}></div>
                      {bName}
                      {isPrimary && <span className="text-[9px] text-slate-400 font-medium">(أساسي)</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          {/* Connection & Sync Status Badges */}
          <div className="flex gap-2 ml-2">
            <span className={cn(
              "text-xs font-black px-3.5 py-2 rounded-xl border flex items-center gap-1.5 shadow-sm transition-all",
              isOnline ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100 animate-pulse"
            )}>
              <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500" : "bg-red-500")} />
              {isOnline ? "متصل بالإنترنت" : "دون اتصال (Offline)"}
            </span>
            {isSyncing && (
              <span className="text-xs font-black px-3.5 py-2 rounded-xl border bg-blue-50 text-blue-700 border-blue-100 shadow-sm flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                جاري المزامنة...
              </span>
            )}
          </div>

          {incomingRequests.length > 0 && (
            <button
               onClick={() => setShowIncomingRequestsModal(true)}
               className="relative px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-black hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 border border-indigo-100"
            >
              <Bell className="w-4 h-4 animate-bounce" />
              طلبات واردة
              <span className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-sans">{incomingRequests.length}</span>
            </button>
          )}
          {currentShift && (
            <button
              onClick={() => { setActualCash(0); setIsCloseShiftModalOpen(true); }}
              className="px-6 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-black hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 border border-red-100"
            >
              <ArrowDownCircle className="w-4 h-4" />
              إغلاق الوردية
            </button>
          )}
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => { setSelectedBranchId(''); setActiveBranchIds([]); }}
              className="px-6 py-3 bg-blue-50 text-blue-600 rounded-xl text-sm font-black hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 border border-blue-100"
            >
              <RefreshCcw className="w-4 h-4" />
              تغيير الفرع
            </button>
          )}
        </div>
      </div>

      {pendingInvoices.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[2.5rem] p-6 shadow-sm">
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-black text-gray-900">الفواتير المعلقة</h3>
              <p className="text-sm text-gray-500">يمكنك فتح أي فاتورة لمراجعة محتواها، تعديلها، استكمالها أو حذفها.</p>
            </div>
            {editingPendingInvoiceId && (
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-amber-800 border border-amber-200">
                <span>تحرير فاتورة حالية</span>
                <button onClick={clearPendingEdit} className="text-blue-600 hover:underline">إلغاء</button>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {pendingInvoices.map((inv) => (
              <div key={inv.id} className="bg-white rounded-[2rem] border border-amber-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-900">#{inv.id}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(inv.createdAt).toLocaleString('ar-EG')}</p>
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-3 py-1 rounded-full">قيد الانتظار</span>
                </div>

                <div className="mt-4 text-sm text-gray-600 space-y-2">
                  <p>عدد الأصناف: <span className="font-black text-gray-900">{inv.items?.length || 0}</span></p>
                  <p>الإجمالي: <span className="font-black text-gray-900">{formatCurrency(inv.total || 0)}</span></p>
                  {inv.notes && <p>ملاحظة: <span className="font-black text-gray-900">{inv.notes}</span></p>}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => loadPendingInvoice(inv)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 transition-all"
                  >
                    فتح للتعديل
                  </button>
                  {(user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_delete_invoice) && (
                    <button
                      onClick={() => deletePendingInvoice(inv.id || '')}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-2xl text-sm font-black hover:bg-red-100 transition-all border border-red-100"
                    >
                      إلغاء الفاتورة
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Main Content Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

        {/* MAIN SIDE: Fast Search, Cart Items Table & Catalog (xl:col-span-8) */}
        <div className="xl:col-span-8 space-y-3">

          {/* Tab Navigation (only show if cross-branch feature is enabled) */}
          {settings?.allowCrossbranchRequest && (
            <div className="bg-white rounded border border-slate-200 p-0.5 flex gap-1 shadow-none w-fit select-none">
              <button
                onClick={() => setProductTab('branch')}
                className={cn(
                  "px-3.5 py-1 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  productTab === 'branch'
                    ? "bg-blue-600 text-white font-extrabold"
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <Package className="w-4 h-4" />
                المتاح في الفرع
              </button>
              <button
                onClick={() => setProductTab('crossbranch')}
                className={cn(
                  "px-3.5 py-1 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  productTab === 'crossbranch'
                    ? "bg-blue-600 text-white font-extrabold"
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <ArrowRightLeft className="w-4 h-4" />
                طلب من فرع آخر
              </button>
            </div>
          )}

          {/* ── Tab 1: Current Branch Products ── */}
          {productTab === 'branch' && (
            <>
              <div className="bg-white p-2.5 rounded border border-slate-200 shadow-none space-y-3 select-none">
                <div className="relative group">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    placeholder="بحث سريع عن منتج بالاسم أو الباركود..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full bg-slate-50 border border-slate-200 rounded py-1.5 pr-9 pl-10 outline-none text-xs font-bold transition focus:border-blue-500 focus:bg-white text-right"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={startBarcodeCamera}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded w-7 h-7 flex items-center justify-center hover:bg-blue-700 transition-colors shadow-none"
                    title="مسح باركود بالكاميرا"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                      <path d="M21 7V5a2 2 0 0 0-2-2h-2" />
                      <path d="M3 17v2a2 2 0 0 0 2 2h2" />
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                      <path d="M7 8h.01" />
                      <path d="M7 12h.01" />
                      <path d="M7 16h.01" />
                      <path d="M10 8h4" />
                      <path d="M10 12h4" />
                      <path d="M10 16h4" />
                      <path d="M17 8h.01" />
                      <path d="M17 16h.01" />
                    </svg>
                  </button>
                </div>

                {isScanning && (
                  <div className="bg-slate-900/90 fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded border border-slate-200 w-full max-w-xl overflow-hidden shadow-lg">
                      <div className="flex items-center justify-between p-3 border-b border-slate-200">
                        <div className="text-right">
                          <h3 className="text-xs font-bold text-slate-950">مسح الباركود بالكاميرا</h3>
                          <p className="text-[10px] text-slate-400">{scanMessage}</p>
                        </div>
                        <button
                          type="button"
                          onClick={stopBarcodeCamera}
                          className="text-xs font-bold text-slate-500 hover:text-slate-950"
                        >
                          إغلاق
                        </button>
                      </div>
                      <div className="relative bg-black">
                        <video
                          ref={videoRef}
                          className="w-full aspect-video object-cover"
                          playsInline
                          muted
                        />
                        <div className="pointer-events-none absolute inset-4 border border-blue-500/50 rounded" />
                      </div>
                      <div className="p-3 text-right bg-slate-50 border-t border-slate-200">
                        <p className="text-[10px] text-slate-400">إذا لم يعمل المسح، تأكد من منح المتصفح إذن الوصول للكاميرا أو استخدم إدخال الباركود اليدوي.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Cart Items Table */}
              <div className="bg-white rounded border border-slate-200 shadow-none overflow-hidden flex flex-col min-h-[280px]">
                <div className="p-2.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black text-slate-900">سلة المشتريات ({cart.length} أصناف)</span>
                  </div>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer focus:outline-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      تفريغ السلة
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto max-h-[300px] scrollbar-thin">
                  {cart.length === 0 ? (
                    <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-slate-400 gap-2 opacity-60">
                      <ShoppingCart className="w-10 h-10" />
                      <p className="text-xs font-black">السلة فارغة حالياً. استخدم البحث أو اضغط على المنتجات بالأسفل للإضافة.</p>
                    </div>
                  ) : (
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr className="text-slate-500 font-bold">
                          <th className="px-3 py-1.5 text-right">المنتج</th>
                          <th className="px-3 py-1.5 text-center w-24">السعر</th>
                          <th className="px-3 py-1.5 text-center w-32">الكمية</th>
                          <th className="px-3 py-1.5 text-center w-24">الخصم</th>
                          <th className="px-3 py-1.5 text-left w-28">الإجمالي</th>
                          <th className="px-3 py-1.5 text-center w-12">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cart.map((item) => (
                          <tr key={item.sku || item.productId} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-1.5">
                              <div className="font-black text-slate-800">{item.name}</div>
                              {item.sku && <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>}
                            </td>
                            <td className="px-3 py-1.5 text-center font-sans font-bold">
                              {formatCurrency(item.originalPrice)}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <div className="inline-flex items-center border border-slate-200 rounded bg-slate-50 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.sku || item.productId, -1)}
                                  className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white hover:text-red-600 rounded transition-all focus:outline-none"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-8 text-center text-xs font-black text-slate-900 font-sans">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.sku || item.productId, 1)}
                                  className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white hover:text-blue-600 rounded transition-all focus:outline-none"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <input
                                type="number"
                                value={item.discount || ''}
                                onChange={(e) => updateDiscount(item.sku || item.productId, Number(e.target.value))}
                                className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center text-xs font-black text-blue-600 focus:ring-1 focus:ring-blue-500 outline-none"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-left font-sans font-black text-slate-900">
                              {formatCurrency(item.total)}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.sku || item.productId)}
                                className="text-slate-400 hover:text-red-500 transition-colors p-1 focus:outline-none"
                                title="حذف من السلة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Product Catalog Section */}
              <div className="bg-white rounded border border-slate-200 shadow-none p-3 space-y-2 select-none">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-black text-slate-800">دليل المنتجات السريع</span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin max-w-full">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "px-2.5 py-0.5 rounded text-[10px] font-bold transition-all whitespace-nowrap border",
                          selectedCategory === cat
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {cat === 'All' ? 'الكل' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                  {filteredProducts.length === 0 ? (
                    <div className="bg-slate-50 rounded border border-slate-100 p-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Package className="w-8 h-8 opacity-40" />
                      <p className="text-xs font-bold">لا توجد منتجات مطابقة للبحث</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-5 gap-2">
                      {filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addToCart(product)}
                          className="bg-slate-50 hover:bg-slate-100/80 rounded border border-slate-200 p-2 transition-all flex flex-col justify-between text-right text-xs group hover:border-blue-500"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <p className="text-[9px] font-bold text-blue-600">{product.brand || 'عام'}</p>
                              {product.images?.[0] && (
                                <img src={product.images[0]} className="w-5 h-5 object-cover rounded" alt="" />
                              )}
                            </div>
                            <h4 className="font-black text-slate-900 line-clamp-1 leading-snug">{product.name}</h4>
                            
                            {product.trackInventory === false ? (
                              <span className="inline-block mt-1 text-[9px] px-1 bg-green-50 text-green-600 border border-green-100 rounded">متاح</span>
                            ) : (
                              <span className={cn(
                                "inline-block mt-1 text-[9px] px-1 border rounded",
                                product.branchStock === 0 ? "bg-red-50 text-red-500 border-red-100" :
                                product.branchStock < 5 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-green-50 text-green-600 border-green-100"
                              )}>
                                {product.branchStock === 0 ? "نفذ" : `${product.branchStock} ق`}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 pt-1 border-t border-slate-200/50 flex items-center justify-between">
                            <span className="font-sans font-black text-blue-600">{formatCurrency(product.sellingPrice)}</span>
                            <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Tab 2: Cross-Branch Products ── */}
          {productTab === 'crossbranch' && (
            <>
              <div className="bg-white p-3 rounded border border-slate-200 shadow-none space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-50 rounded flex items-center justify-center">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-xs">البحث في الفروع الأخرى</h3>
                    <p className="text-[10px] text-slate-400 font-medium">ابحث عن المنتجات المتوفرة في الفروع الأخرى واطلب تحويلها لفرعك</p>
                  </div>
                </div>
                <div className="relative group">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="text"
                    placeholder="بحث عن منتج في الفروع الأخرى..."
                    value={branchSearchTerm}
                    onChange={(e) => setBranchSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded py-1.5 pr-9 pl-4 outline-none focus:border-indigo-500 focus:bg-white text-xs font-bold transition-all text-right"
                  />
                </div>
              </div>

              {/* Cross-Branch Product Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-5 gap-2">
                {crossBranchProducts.length === 0 ? (
                  <div className="col-span-full bg-white rounded border border-slate-200 p-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Building2 className="w-8 h-8 opacity-40" />
                    <p className="font-bold text-xs">لا توجد منتجات متوفرة في الفروع الأخرى</p>
                  </div>
                ) : crossBranchProducts.map((item, idx) => (
                  <div
                    key={`${item.product.id}-${item.branch.id}`}
                    className="bg-white rounded border border-slate-200 p-2 hover:border-indigo-500 transition-all flex flex-col justify-between text-right text-xs"
                  >
                    <div>
                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-500 text-white mb-1.5">
                        {item.branch.name}
                      </span>
                      <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{item.product.brand || 'عام'}</p>
                      <h4 className="font-black text-slate-900 line-clamp-2 leading-relaxed">{item.product.name}</h4>
                      <p className="text-[9px] text-green-600 font-bold mt-1 bg-green-50/50 px-1 rounded border border-green-100/50 w-fit">{item.availableQty} قطعة متوفرة</p>
                    </div>

                    <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-sans font-black text-indigo-600">{formatCurrency(item.product.sellingPrice)}</span>
                      <button
                        onClick={() => { setRequestModal({ product: item.product, fromBranch: item.branch, availableQty: item.availableQty }); setRequestQty(1); }}
                        className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1 border border-indigo-100"
                      >
                        <Send className="w-3 h-3" />
                        طلب تحويل
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Outgoing Requests History Table */}
              <div className="bg-white rounded border border-slate-200 shadow-none overflow-hidden">
                <div className="p-3 border-b border-slate-200 flex items-center gap-2 bg-slate-50">
                   <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center">
                     <HistoryIcon className="w-3.5 h-3.5" />
                   </div>
                   <div>
                     <h3 className="text-xs font-black text-slate-900">سجل طلبات التحويل المرسلة</h3>
                   </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr>
                        <th className="px-3 py-2">المنتج</th>
                        <th className="px-3 py-2">الفرع المطلوب منه</th>
                        <th className="px-3 py-2">الكمية</th>
                        <th className="px-3 py-2">الوقت</th>
                        <th className="px-3 py-2">الحالة</th>
                        <th className="px-3 py-2">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {outgoingRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-slate-400 font-bold">لا توجد طلبات سابقة</td>
                        </tr>
                      ) : outgoingRequests.map(req => {
                        const productInfo = req.items?.[0];
                        const fromBranch = warehouses.find(w => w.id === req.fromWarehouseId);
                        const fulfillment = transfers.find(t => t.reference === req.id);
                        let displayStatus = req.status;
                        if (fulfillment) {
                          displayStatus = fulfillment.status;
                        }

                        return (
                          <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 font-black text-slate-900">{productInfo?.productName}</td>
                            <td className="px-3 py-2 font-bold text-indigo-600">{fromBranch?.name || req.fromWarehouseId}</td>
                            <td className="px-3 py-2 font-sans font-black">{productInfo?.quantity}</td>
                            <td className="px-3 py-2 text-slate-400 text-[10px]">{new Date(req.createdAt).toLocaleString('ar-EG')}</td>
                            <td className="px-3 py-2">
                               {displayStatus === 'PENDING' && <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-black text-[10px] border border-amber-100">قيد الانتظار</span>}
                               {displayStatus === 'SHIPPED' && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black text-[10px] border border-blue-100">قيد النقل</span>}
                               {displayStatus === 'COMPLETED' && <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-black text-[10px] border border-green-100">مقبول ومستلم</span>}
                               {displayStatus === 'CANCELLED' && <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-black text-[10px] border border-red-100">ملغي / مرفوض</span>}
                            </td>
                            <td className="px-3 py-2">
                               {displayStatus === 'PENDING' && (
                                 <div className="flex items-center gap-1.5">
                                   <button 
                                      onClick={async () => {
                                        const newQty = prompt('أدخل الكمية الجديدة:', productInfo?.quantity ? String(productInfo.quantity) : '');
                                        if(newQty && !isNaN(Number(newQty)) && Number(newQty) > 0) {
                                          try {
                                            const cancelTx = {
                                              id: `BR-CANCEL-${Date.now().toString(36).toUpperCase()}`,
                                              type: 'TRANSFER',
                                              status: 'CANCELLED',
                                              fromWarehouseId: req.fromWarehouseId,
                                              toWarehouseId: req.toWarehouseId,
                                              items: req.items,
                                              reference: req.id,
                                              notes: `تم الإلغاء لتعديل الكمية`,
                                              createdAt: new Date().toISOString(),
                                              createdBy: user?.uid || 'cashier',
                                            };
                                            const newReqTx = {
                                              id: `BR-${Date.now().toString(36).toUpperCase()}`,
                                              type: 'TRANSFER',
                                              status: 'PENDING',
                                              fromWarehouseId: req.fromWarehouseId,
                                              toWarehouseId: req.toWarehouseId,
                                              items: [{...productInfo, quantity: Number(newQty)}],
                                              reference: 'BRANCH_REQUEST',
                                              notes: req.notes,
                                              createdAt: new Date().toISOString(),
                                              createdBy: user?.uid || 'cashier',
                                              requestedByBranch: req.toWarehouseId,
                                            };
                                            await setDoc(doc(db, 'inventory_transactions', cancelTx.id), cancelTx);
                                            await setDoc(doc(db, 'inventory_transactions', newReqTx.id), newReqTx);
                                            setIsSuccess(true); setTimeout(() => setIsSuccess(false), 3000);
                                          } catch(err: any) { 
                                            console.error('Error editing request:', err);
                                            alert('فشل في تعديل الطلب: ' + (err.message || '')); 
                                          }
                                        }
                                      }}
                                      className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"
                                      title="تعديل الكمية"
                                   >
                                     <Edit3 className="w-3.5 h-3.5" />
                                   </button>
                                   <button 
                                      onClick={async () => {
                                        if(confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) {
                                          try {
                                            const cancelTx = {
                                              id: `BR-CANCEL-${Date.now().toString(36).toUpperCase()}`,
                                              type: 'TRANSFER',
                                              status: 'CANCELLED',
                                              fromWarehouseId: req.fromWarehouseId,
                                              toWarehouseId: req.toWarehouseId,
                                              items: req.items,
                                              reference: req.id,
                                              notes: (req.notes || '') + ' (تم الإلغاء من قبل الطالب)',
                                              createdAt: new Date().toISOString(),
                                              createdBy: user?.uid || 'cashier',
                                            };
                                            await setDoc(doc(db, 'inventory_transactions', cancelTx.id), cancelTx);
                                          } catch(err: any) { 
                                            console.error('Error cancelling request:', err);
                                            alert('فشل في إلغاء الطلب: ' + (err.message || '')); 
                                          }
                                        }
                                      }}
                                      className="w-6 h-6 rounded bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                                      title="إلغاء الطلب"
                                   >
                                     <X className="w-3.5 h-3.5" />
                                   </button>
                                 </div>
                               )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* LEFT SIDE: Billing, Customer & Checkout (xl:col-span-4) */}
        <div className="xl:col-span-4">
          <div className="bg-white rounded border border-slate-200 p-4 space-y-4 sticky top-4">
            
            {/* Header / Info */}
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                خيارات الفاتورة والعميل
              </h3>
              {editingPendingInvoiceId && (
                <span className="text-[10px] font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  تعديل معلقة
                </span>
              )}
            </div>

            {/* Customer Selector */}
            <div className="space-y-2 relative" ref={customerDropdownRef}>
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">العميل</label>
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(true)}
                  className="text-[10px] font-black text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 cursor-pointer focus:outline-none"
                >
                  + عميل جديد
                </button>
              </div>
              
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
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
                  className="w-full bg-slate-50 border border-slate-200 rounded pr-9 pl-8 py-1.5 text-xs font-bold outline-none focus:bg-white focus:border-blue-500 transition-all text-right"
                />
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearchTerm('');
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none text-xs"
                  >
                    ✕
                  </button>
                )}

                {/* Customer Dropdown */}
                <AnimatePresence>
                  {showCustomerDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-50 w-full mt-1 bg-white rounded border border-slate-200 shadow-lg max-h-48 overflow-y-auto scrollbar-thin text-right"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearchTerm('');
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-right p-2 hover:bg-slate-50 border-b border-slate-100 transition-colors flex items-center justify-between text-xs font-black text-slate-500"
                      >
                        <span>عميل نقدي (افتراضي)</span>
                        <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-400 font-bold">افتراضي</span>
                      </button>
                      {customers.filter(c =>
                        c.branchId === selectedBranchId && (
                          c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                          c.phone.includes(customerSearchTerm)
                        )
                      ).length === 0 ? (
                        <div className="p-2.5 text-center text-xs text-gray-400 font-bold">لا يوجد نتائج مطابقة</div>
                      ) : (
                        customers.filter(c =>
                          c.branchId === selectedBranchId && (
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
                            className="w-full text-right p-2 hover:bg-blue-50/50 border-b border-slate-100 transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="text-right">
                              <p className="text-xs font-black text-slate-800">{c.name}</p>
                              <p className="text-[9px] text-gray-400 font-bold mt-0.5">{c.phone}</p>
                            </div>
                            <div className="text-left shrink-0">
                              {c.balance > 0 ? (
                                <span className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded font-black border",
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
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200/60">
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 font-bold leading-none mb-0.5">الرصيد المالي الحالي</p>
                    <p className={cn(
                      "text-xs font-black",
                      selectedCustomer.balance === 0
                        ? "text-slate-500"
                        : selectedCustomer.balanceType === 'credit'
                        ? "text-emerald-600"
                        : "text-rose-600"
                    )}>
                      {selectedCustomer.balance > 0
                        ? `${formatCurrency(selectedCustomer.balance)} ${selectedCustomer.balanceType === 'credit' ? 'دائن' : 'مدين'}`
                        : '0.00 ج.م'
                      }
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('default_pos_customer_id', selectedCustomer.id);
                      alert(`تم تعيين العميل "${selectedCustomer.name}" كعميل افتراضي للبيعات بنجاح.`);
                    }}
                    className="px-2 py-1 bg-white text-slate-600 font-black border border-slate-200 rounded hover:bg-slate-50 transition-all text-[9px] cursor-pointer focus:outline-none"
                  >
                    تعيين كافتراضي
                  </button>
                </div>
              )}
            </div>

            {/* Note Area */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ملاحظات الفاتورة</label>
              <textarea
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
                placeholder="أضف أي ملاحظات هنا..."
                className="w-full h-12 min-h-[48px] resize-none bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Price Calculations */}
            <div className="border-t border-b border-slate-100 py-3 space-y-1.5">
              <div className="flex justify-between text-xs font-black text-slate-400">
                <span>المجموع الفرعي</span>
                <span className="font-sans">{formatCurrency(subtotal)}</span>
              </div>
              {settings?.taxEnabled && (
                <div className="flex justify-between text-xs font-black text-slate-400">
                  <span>الضريبة ({settings?.taxRate || 0}%)</span>
                  <span className="font-sans">{formatCurrency(tax)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-slate-200">
                <span className="text-xs font-black text-slate-900">المجموع النهائي</span>
                <span className="text-xl font-black text-blue-600 font-sans tracking-tight">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Checkout / Payment Buttons */}
            <div className="space-y-2">
              {editingPendingInvoiceId && (
                <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1.5 rounded border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPendingPaymentMethod('cash')}
                    className={cn(
                      "py-1 rounded font-black text-[10px] transition-all border",
                      pendingPaymentMethod === 'cash'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    كاش
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPaymentMethod('visa')}
                    className={cn(
                      "py-1 rounded font-black text-[10px] transition-all border",
                      pendingPaymentMethod === 'visa'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    فيزا
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPaymentMethod('vodafone')}
                    className={cn(
                      "py-1 rounded font-black text-[10px] transition-all border",
                      pendingPaymentMethod === 'vodafone'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    فودافون كاش
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPaymentMethod('instapay')}
                    className={cn(
                      "py-1 rounded font-black text-[10px] transition-all border",
                      pendingPaymentMethod === 'instapay'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    انستا باي
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={handleHoldInvoice}
                  className="flex-1 bg-amber-500 text-white font-black py-2 rounded text-xs hover:bg-amber-600 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  {editingPendingInvoiceId ? 'حفظ المعلقة' : 'تعليق الفاتورة'}
                </button>

                {editingPendingInvoiceId && (
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={completePendingInvoice}
                    className="flex-1 bg-green-600 text-white font-black py-2 rounded text-xs hover:bg-green-700 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    إنهاء المعلقة
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full bg-blue-600 text-white font-black py-2.5 rounded hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                تأكيد الدفع والطباعة
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 3. Global Success Notification */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-10 left-10 z-[100] bg-slate-900 border border-slate-800 text-white px-8 py-5 rounded-3xl shadow-2xl flex items-center gap-4"
          >
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-black leading-none mb-1">تمت العملية بنجاح!</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">تم ترحيل البيانات وتحديث المخزون</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Modals (Checkout & Shift Close) */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => !isSaving && setIsCheckoutOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden"
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
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <CreditCard className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-900">إتمام البيع</h3>
                      <p className="text-gray-400 text-sm font-medium">اختر وسيلة الدفع المناسبة للعميل</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-8">
                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('cash')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-gray-50 hover:border-emerald-600 hover:bg-emerald-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
                        <Banknote className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">نقدي (كاش)</span>
                    </button>

                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('visa')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-gray-50 hover:border-blue-600 hover:bg-blue-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">بطاقة (فيزا)</span>
                    </button>

                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('vodafone')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-gray-50 hover:border-red-600 hover:bg-red-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">فودافون كاش</span>
                    </button>

                    <button
                      disabled={isSaving}
                      onClick={() => handleCheckout('instapay')}
                      className="flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 border-gray-50 hover:border-pink-600 hover:bg-pink-50 transition-all group disabled:opacity-50 text-center"
                    >
                      <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <span className="font-black text-gray-800 text-sm">انستا باي</span>
                    </button>

                    {selectedCustomer && selectedCustomer.id !== 'WALK-IN' && (
                      <button
                        disabled={isSaving}
                        onClick={() => handleCheckout('debt')}
                        className="col-span-2 flex items-center justify-center gap-4 p-5 rounded-[2rem] border-2 border-gray-50 hover:border-rose-600 hover:bg-rose-50 transition-all group disabled:opacity-50 text-center"
                      >
                        <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <span className="font-black text-gray-800 text-sm">بيع آجل (على الحساب)</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-8 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-sm font-black text-gray-400 uppercase tracking-widest">إجمالي المبلغ المطلوب</span>
                    <span className="text-3xl font-black text-blue-600 font-sans tracking-tighter">{formatCurrency(total)}</span>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}

        {isCloseShiftModalOpen && currentShift && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsCloseShiftModalOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[3rem] p-12 shadow-2xl"
            >
              <div className="text-center mb-10">
                <h3 className="text-3xl font-black text-gray-900 mb-2">إغلاق الوردية</h3>
                <p className="text-gray-400 font-medium">مراجعة رصيد الدرج وترحيل البيانات للفرع</p>
              </div>

              <div className="space-y-4 mb-10 text-right">
                <label className="text-sm font-black text-gray-400 uppercase tracking-widest mr-2 block text-center">المبلغ الفعلي الموجود في الدرج الآن</label>
                <input
                  type="number"
                  value={actualCash}
                  onChange={(e) => setActualCash(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-100 rounded-3xl px-6 py-6 outline-none focus:ring-4 focus:ring-blue-100 font-black text-4xl text-center text-gray-900 shadow-inner"
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setIsCloseShiftModalOpen(false)} className="flex-1 bg-gray-100 text-gray-400 font-black py-5 rounded-2xl hover:bg-gray-200 transition-all">إلغاء</button>
                <button
                  onClick={async () => {
                    try {
                      setIsClosing(true);
                      await closeShift(currentShift.id, actualCash);
                      setIsCloseShiftModalOpen(false);
                      setCart([]);
                      setIsClosing(false);
                      alert('تم إغلاق الوردية بنجاح');
                    } catch (e) {
                      setIsClosing(false);
                      alert('حدث خطأ أثناء الإغلاق');
                    }
                  }}
                  disabled={isClosing}
                  className="flex-[2] bg-red-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isClosing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <X className="w-5 h-5" />}
                  إغلاق الوردية نهائياً
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {selectedDetail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setSelectedDetail(null)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" dir="rtl"
            >
              <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Package className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">تفاصيل العملية</h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{selectedDetail.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDetail(null)} className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-1 tracking-widest text-center">حالة العملية</span>
                    <span className={cn(
                      "text-base font-black block text-center",
                      selectedDetail.status === 'COMPLETED' ? 'text-green-600' :
                      selectedDetail.status === 'RETURNED' ? 'text-red-500' :
                      selectedDetail.status === 'PENDING' ? 'text-amber-500' : 'text-slate-600'
                    )}>
                      {selectedDetail.status === 'COMPLETED' ? '✓ مكتملة'
                        : selectedDetail.status === 'PENDING' ? 'معلقة'
                        : selectedDetail.status === 'RETURNED' ? '↺ مرتجع'
                        : selectedDetail.status === 'CANCELLED' ? '✕ ملغاة'
                        : selectedDetail.status || 'غير محددة'}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-1 tracking-widest text-center">توقيت العملية</span>
                    <span className="text-xs font-black text-slate-800 font-sans tracking-tight block text-center">{new Date(selectedDetail.createdAt).toLocaleString('ar-EG')}</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner flex flex-col items-center justify-center overflow-hidden">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-1 tracking-widest text-center">باركود الفاتورة</span>
                    <div className="flex justify-center items-center w-full max-h-[35px]">
                      <svg id="invoice-barcode-svg" className="max-w-full h-auto"></svg>
                    </div>
                  </div>
                </div>

                {/* Return Policy Eligibility Alert Badge */}
                {(selectedDetail.status === 'COMPLETED' || selectedDetail.status === 'PARTIALLY_RETURNED') && settings?.returnDaysLimit !== undefined && (
                  (() => {
                    const returnDays = settings.returnDaysLimit;
                    if (returnDays === 0) {
                      return (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-2">
                          <span>⚠️ الاسترجاع معطل تماماً في إعدادات النظام.</span>
                        </div>
                      );
                    }
                    const invoiceDate = new Date(selectedDetail.createdAt);
                    const diffTime = Math.abs(new Date().getTime() - invoiceDate.getTime());
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const isExpired = diffDays > returnDays;
                    const remainingDays = returnDays - diffDays;
                    
                    if (isExpired) {
                      return (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-2">
                          <span>⚠️ فترة الاسترجاع المسموحة انتهت (الحد الأقصى: {returnDays} أيام، مرّ {diffDays} أيام).</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-2">
                          <span>✓ مسموح بالاسترجاع (متبقي {remainingDays} يوم/أيام من أصل {returnDays} يوم).</span>
                        </div>
                      );
                    }
                  })()
                )}

                {showReturnPanel ? (
                  <div className="space-y-4 border-2 border-red-100 p-5 rounded-[2rem] bg-red-50/20">
                    <h5 className="font-black text-red-600 mb-2 flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                      تحديد الأصناف المراد إرجاعها
                    </h5>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                      {(selectedDetail.items || []).map((item: any, idx: number) => {
                        const maxReturn = (item.quantity || 0) - (item.returnedQuantity || 0);
                        const isChecked = returnQuantities[idx] !== undefined;
                        const returnQty = returnQuantities[idx] || 0;

                        return (
                          <div key={idx} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm" dir="rtl">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                disabled={maxReturn <= 0}
                                checked={isChecked && maxReturn > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setReturnQuantities(prev => ({ ...prev, [idx]: 1 }));
                                  } else {
                                    setReturnQuantities(prev => {
                                      const next = { ...prev };
                                      delete next[idx];
                                      return next;
                                    });
                                  }
                                }}
                                className="w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-100 cursor-pointer disabled:opacity-40"
                              />
                              <div className="text-right">
                                <p className="font-black text-sm text-gray-900">{item.name}</p>
                                <p className="text-xs text-gray-400 font-bold">
                                  المباع: <span className="font-sans text-gray-900">{item.quantity}</span> 
                                  {item.returnedQuantity > 0 && (
                                    <> | تم إرجاع: <span className="font-sans text-red-500 font-black">{item.returnedQuantity}</span></>
                                  )}
                                </p>
                              </div>
                            </div>
                            {isChecked && maxReturn > 0 ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReturnQuantities(prev => ({ ...prev, [idx]: Math.max(1, returnQty - 1) }))}
                                  className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-gray-100 border border-gray-200 active:scale-95"
                                >
                                  <Minus className="w-3.5 h-3.5 text-gray-500" />
                                </button>
                                <span className="text-base font-black font-sans w-6 text-center">{returnQty}</span>
                                <button
                                  type="button"
                                  onClick={() => setReturnQuantities(prev => ({ ...prev, [idx]: Math.min(maxReturn, returnQty + 1) }))}
                                  className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-gray-100 border border-gray-200 active:scale-95"
                                >
                                  <Plus className="w-3.5 h-3.5 text-gray-500" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-gray-400">
                                {maxReturn <= 0 ? 'مسترجع بالكامل' : 'غير محدد'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="flex gap-3 pt-3 border-t border-gray-100 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const allReturn: Record<string | number, number> = {};
                          (selectedDetail.items || []).forEach((item: any, idx: number) => {
                            const maxReturn = (item.quantity || 0) - (item.returnedQuantity || 0);
                            if (maxReturn > 0) {
                              allReturn[idx] = maxReturn;
                            }
                          });
                          setReturnQuantities(allReturn);
                        }}
                        className="text-xs font-black text-red-600 hover:text-red-700 bg-red-50/60 px-3 py-2 rounded-xl border border-red-100 transition-all active:scale-[0.98] cursor-pointer"
                      >
                        تحديد كل المتبقي
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnQuantities({})}
                        className="text-xs font-black text-gray-500 hover:text-gray-600 bg-gray-100 px-3 py-2 rounded-xl border border-gray-200 transition-all active:scale-[0.98] cursor-pointer"
                      >
                        إلغاء التحديد
                      </button>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setShowReturnPanel(false)}
                        className="flex-1 bg-gray-100 text-gray-500 font-black py-4 rounded-2xl hover:bg-gray-200 transition-all cursor-pointer text-center text-sm"
                      >
                        تراجع
                      </button>
                      <button
                        type="button"
                        disabled={Object.keys(returnQuantities).length === 0}
                        onClick={async () => {
                          if (window.confirm('هل أنت متأكد من إرجاع البنود والكميات المحددة للمخزون؟')) {
                            try {
                              let returnedSubtotal = 0;
                              const updatedItems = selectedDetail.items.map((item: any, idx: number) => {
                                const retQty = returnQuantities[idx] || 0;
                                if (retQty > 0) {
                                  const newRetQty = (item.returnedQuantity || 0) + retQty;
                                  returnedSubtotal += retQty * (item.price || 0);
                                  return { ...item, returnedQuantity: newRetQty };
                                }
                                return item;
                              });

                              const ratio = selectedDetail.subtotal > 0 ? (selectedDetail.tax / selectedDetail.subtotal) : 0;
                              const returnedTax = returnedSubtotal * ratio;
                              const returnedTotal = returnedSubtotal + returnedTax;

                              const newSubtotal = Math.max(0, selectedDetail.subtotal - returnedSubtotal);
                              const newTax = Math.max(0, selectedDetail.tax - returnedTax);
                              const newTotal = Math.max(0, selectedDetail.total - returnedTotal);

                              const isFullyReturned = updatedItems.every((item: any) => (item.quantity || 0) === (item.returnedQuantity || 0));
                              const newStatus = isFullyReturned ? 'RETURNED' : 'PARTIALLY_RETURNED';

                              const updates = {
                                items: updatedItems,
                                subtotal: newSubtotal,
                                tax: newTax,
                                total: newTotal,
                                status: newStatus as any
                              };

                              await updateInvoice(selectedDetail.id, updates);
                              setSelectedDetail({ ...selectedDetail, ...updates });
                              setIsSuccess(true);
                              setShowReturnPanel(false);
                              setTimeout(() => setIsSuccess(false), 3000);
                            } catch (err) {
                              console.error("Error making partial return:", err);
                              alert("حدث خطأ أثناء معالجة المرتجع الجزئي.");
                            }
                          }
                        }}
                        className="flex-[2] bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all disabled:opacity-40 disabled:pointer-events-none text-sm cursor-pointer shadow-lg shadow-red-200"
                      >
                        تأكيد إرجاع البنود المحددة
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h5 className="font-black text-gray-900 mb-4 flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                      الأصناف والمحتويات
                    </h5>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                      {(selectedDetail.items || selectedDetail.products || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-blue-100 transition-all">
                          <div className="space-y-1 text-right">
                            <p className="font-black text-sm text-gray-900">
                              {item.name || item.productName}
                              {item.branchId && item.branchId !== selectedDetail.branchId && (
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold mr-2 border border-slate-200/50">
                                  من: {warehouses.find(w => w.id === item.branchId)?.name || item.branchId}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 font-bold">
                              الكمية: <span className="text-gray-900 font-sans font-black">{item.quantity}</span> 
                              {item.returnedQuantity > 0 && (
                                <> | المرتجع: <span className="text-red-500 font-black">{item.returnedQuantity}</span></>
                              )} | 
                              السعر: <span className="text-gray-900 font-sans">{formatCurrency(item.price || 0)}</span>
                            </p>
                          </div>
                          <span className="text-lg font-black text-blue-600 font-sans tracking-tighter">{formatCurrency((item.price || 0) * ((item.quantity || 0) - (item.returnedQuantity || 0)))}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-8 pt-8 border-t border-gray-100 flex justify-between items-center">
                  <div className="space-y-1 text-right">
                    <span className="text-sm font-black text-gray-400 uppercase tracking-widest">إجمالي الفاتورة النهائي</span>
                    <p className="text-3xl font-black text-gray-900 font-sans tracking-tighter">{formatCurrency(selectedDetail.total || 0)}</p>
                  </div>
                  {selectedDetail.notes && (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 shadow-inner mb-4">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">ملاحظة الفاتورة</span>
                      <p className="mt-1 text-sm font-bold text-slate-700">{selectedDetail.notes}</p>
                    </div>
                  )}
                  {selectedDetail.paymentMethod && (
                    <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-xl shadow-blue-100 flex flex-col items-center">
                      <span className="text-[10px] font-black text-blue-100 uppercase mb-1 tracking-widest">وسيلة الدفع</span>
                      <span className="font-black text-base">
                        {selectedDetail.paymentMethod === 'cash' ? 'نقداً (كاش)' : 
                         selectedDetail.paymentMethod === 'visa' ? 'بطاقة (فيزا)' : 
                         selectedDetail.paymentMethod === 'vodafone' ? 'فودافون كاش' : 
                         selectedDetail.paymentMethod === 'instapay' ? 'انستا باي' : 
                         'آجل (على الحساب)'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-end">
                  {/* Print receipt button */}
                  <button
                    type="button"
                    onClick={() => handlePrintReceipt(selectedDetail)}
                    className="px-6 py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/10 active:scale-95 cursor-pointer text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" rx="1" />
                    </svg>
                    طباعة الفاتورة
                  </button>

                  {/* WhatsApp button */}
                  {(() => {
                    const detailCustomer = customers.find(c => c.id === selectedDetail.customerId);
                    if (detailCustomer && detailCustomer.phone) {
                      return (
                        <a
                          href={getWhatsAppUrl(detailCustomer.phone, selectedDetail)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-95 cursor-pointer text-sm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="w-4 h-4" viewBox="0 0 16 16">
                            <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.949h.004c4.368 0 7.927-3.561 7.928-7.927a7.89 7.89 0 0 0-2.325-5.596l-.001-.005zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.625-4.899c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                          </svg>
                          إرسال WhatsApp
                        </a>
                      );
                    }
                    return null;
                  })()}

                  {/* Return invoice button - only for completed or partially returned invoices */}
                  {(selectedDetail.status === 'COMPLETED' || selectedDetail.status === 'PARTIALLY_RETURNED') && (user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_make_return) && !showReturnPanel && (
                    <button
                      type="button"
                      onClick={() => {
                        const canReturn = user?.role === 'ADMIN' || !user?.permissions || user.permissions.pos_make_return;
                        if (!canReturn) {
                          alert('عذراً، ليس لديك صلاحية عمل مرتجع لهذه الفاتورة.');
                          return;
                        }

                        const returnDays = settings?.returnDaysLimit;
                        if (returnDays !== undefined) {
                          if (returnDays === 0) {
                            alert('عذراً، الاسترجاع معطل تماماً في إعدادات النظام.');
                            return;
                          }
                          const invoiceDate = new Date(selectedDetail.createdAt);
                          const diffTime = Math.abs(new Date().getTime() - invoiceDate.getTime());
                          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                          if (diffDays > returnDays) {
                            alert(`عذراً، تجاوزت هذه الفاتورة فترة الاسترجاع المسموحة (${returnDays} يوم/أيام). تم إصدارها منذ ${diffDays} يوم.`);
                            return;
                          }
                        }

                        setShowReturnPanel(true);
                      }}
                      className="px-6 py-3 bg-red-50 text-red-600 font-black rounded-2xl hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 border border-red-100 active:scale-95 cursor-pointer text-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      إرجاع الفاتورة (مرتجع)
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Transfer Request Modal */}
        {requestModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setRequestModal(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden" dir="rtl"
            >
              {/* Decorative Background */}
              <div className="absolute top-0 left-0 w-48 h-48 bg-indigo-50 rounded-full -ml-24 -mt-24 opacity-30"></div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                    <ArrowRightLeft className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900">طلب تحويل مخزون</h3>
                    <p className="text-gray-400 text-sm font-medium">سيتم إرسال الطلب للموافقة من المدير</p>
                  </div>
                </div>

                {/* Product Info */}
                <div className="bg-gray-50 rounded-[2rem] p-6 mb-6 border border-gray-100 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-gray-100 shadow-inner overflow-hidden flex-shrink-0">
                      {requestModal.product.images?.[0] ? (
                        <img src={requestModal.product.images[0]} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-gray-900 text-sm truncate">{requestModal.product.name}</h4>
                      <p className="text-xs font-bold text-gray-400 mt-1">{requestModal.product.brand || 'عام'}</p>
                    </div>
                  </div>

                  <div className="h-px bg-gray-200"></div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">من فرع</span>
                      <span className="text-sm font-black text-indigo-600 flex items-center justify-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {requestModal.fromBranch.name}
                      </span>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">إلى فرعك</span>
                      <span className="text-sm font-black text-blue-600 flex items-center justify-center gap-1.5">
                        <Store className="w-3.5 h-3.5" />
                        {branchWarehouse?.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quantity Selector */}
                <div className="mb-8">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block text-center mb-4">اختر الكمية المطلوبة</label>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={() => setRequestQty(Math.max(1, requestQty - 1))}
                      className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all shadow-inner border border-gray-100"
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                    <div className="text-center">
                      <input
                        type="number"
                        min={1}
                        max={requestModal.availableQty}
                        value={requestQty}
                        onChange={(e) => setRequestQty(Math.min(requestModal.availableQty, Math.max(1, Number(e.target.value))))}
                        className="w-24 text-center bg-gray-50 border border-gray-100 rounded-2xl py-4 text-3xl font-black text-gray-900 outline-none focus:ring-4 focus:ring-indigo-100 shadow-inner"
                      />
                      <p className="text-xs font-bold text-gray-400 mt-2">من أصل <span className="text-indigo-600 font-black">{requestModal.availableQty}</span> قطعة متوفرة</p>
                    </div>
                    <button
                      onClick={() => setRequestQty(Math.min(requestModal.availableQty, requestQty + 1))}
                      className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-inner border border-gray-100"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setRequestModal(null)}
                    className="flex-1 bg-gray-100 text-gray-400 font-black py-5 rounded-2xl hover:bg-gray-200 transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    disabled={isRequesting || requestQty < 1 || requestQty > requestModal.availableQty}
                    onClick={async () => {
                      console.log('🔔 Transfer button clicked!', { requestQty, fromBranch: requestModal.fromBranch.id, product: requestModal.product.id });
                      setIsRequesting(true);
                      const success = await requestBranchTransfer({
                        fromBranchId: requestModal.fromBranch.id,
                        fromBranchName: requestModal.fromBranch.name,
                        toBranchId: selectedBranchId,
                        toBranchName: branchWarehouse?.name || '',
                        productId: requestModal.product.id,
                        productName: requestModal.product.name,
                        quantity: requestQty,
                      });
                      setIsRequesting(false);
                      if (success) {
                        setRequestModal(null);
                        setIsSuccess(true);
                        setTimeout(() => setIsSuccess(false), 3000);
                      } else {
                        alert('فشل في إرسال طلب التحويل. تحقق من الاتصال.');
                      }
                    }}
                    className="flex-[2] bg-gradient-to-l from-indigo-600 to-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-100 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:shadow-none disabled:translate-y-0"
                  >
                    {isRequesting ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        إرسال طلب التحويل
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Incoming Requests Modal */}
        {showIncomingRequestsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setShowIncomingRequestsModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" dir="rtl"
            >
               {/* Modal Header */}
               <div className="flex items-center justify-between mb-8 shrink-0">
                 <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                     <Bell className="w-7 h-7 animate-bounce" />
                   </div>
                   <div>
                     <h3 className="text-2xl font-black text-gray-900">طلبات واردة من الفروع</h3>
                     <p className="text-gray-400 text-sm font-medium">مراجعة طلبات التحويل والموافقة عليها</p>
                   </div>
                 </div>
                 <button onClick={() => setShowIncomingRequestsModal(false)} className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">
                   <X className="w-6 h-6" />
                 </button>
               </div>

               {/* Requests List */}
               <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                 {incomingRequests.length === 0 ? (
                   <div className="text-center py-10 text-gray-400">
                     <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                     <p className="font-bold">لا توجد طلبات واردة حالياً</p>
                   </div>
                 ) : incomingRequests.map(req => {
                   const reqBranch = warehouses.find(w => w.id === req.toWarehouseId);
                   const productInfo = req.items?.[0];
                   return (
                     <div key={req.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                       <div>
                         <p className="text-sm font-black text-indigo-600 mb-1 flex items-center gap-2">
                           <Building2 className="w-4 h-4" />
                           مطلوب لفرع: {reqBranch?.name || req.toWarehouseId}
                         </p>
                         <p className="font-bold text-gray-900 text-lg">{productInfo?.productName}</p>
                         <p className="text-sm text-gray-500 font-bold mt-1">الكمية المطلوبة: <span className="text-indigo-600 font-black">{productInfo?.quantity}</span></p>
                         <p className="text-xs text-gray-400 mt-2 font-mono">{new Date(req.createdAt).toLocaleString('ar-EG')}</p>
                       </div>
                       <div className="flex items-center gap-3 w-full md:w-auto">
                         <button
                           onClick={async () => {
                             try {
                               await updateDoc(doc(db, 'inventory_transactions', req.id), {
                                 status: 'SHIPPED',
                                 notes: `تمت الموافقة والإرسال بواسطة ${user?.name || 'الكاشير'}`,
                                 updatedAt: new Date().toISOString(),
                                 updatedBy: user?.uid || 'cashier'
                               });
                               setIsSuccess(true);
                               setTimeout(() => setIsSuccess(false), 3000);
                             } catch(err: any) {
                               console.error('Error approving request:', err);
                               alert('فشل في الموافقة على الطلب: ' + (err.message || ''));
                             }
                           }}
                           className="flex-1 md:flex-none px-6 py-3 bg-green-500 text-white rounded-xl font-black text-sm hover:bg-green-600 transition-all shadow-lg shadow-green-200"
                         >
                           موافقة وإرسال
                         </button>
                         <button
                           onClick={async () => {
                             if(confirm('هل أنت متأكد من رفض هذا الطلب؟')) {
                               try {
                                 await updateDoc(doc(db, 'inventory_transactions', req.id), {
                                   status: 'CANCELLED',
                                   notes: `تم رفض الطلب بواسطة ${user?.name || 'الكاشير'}`,
                                   updatedAt: new Date().toISOString(),
                                   updatedBy: user?.uid || 'cashier'
                                 });
                               } catch(err: any) {
                                 console.error('Error rejecting request:', err);
                                 alert('فشل في رفض الطلب: ' + (err.message || ''));
                               }
                             }
                           }}
                           className="flex-1 md:flex-none px-6 py-3 bg-red-50 text-red-500 rounded-xl font-black text-sm hover:bg-red-500 hover:text-white transition-all"
                         >
                           رفض
                         </button>
                       </div>
                     </div>
                   );
                 })}
               </div>
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
                  onClick={() => {
                    setQuickCustomerName('');
                    setQuickCustomerPhone('');
                    setQuickCustomerAddress('');
                    setIsNewCustomerModalOpen(false);
                  }}
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
                    value={quickCustomerName}
                    onChange={e => setQuickCustomerName(e.target.value)}
                    placeholder="الاسم الكامل للعميل"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-right"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 block mb-2">رقم الهاتف *</label>
                  <input
                    type="tel"
                    id="quick-customer-phone"
                    value={quickCustomerPhone}
                    onChange={e => setQuickCustomerPhone(e.target.value)}
                    placeholder="رقم الهاتف للتواصل والبحث"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-right font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 block mb-2">العنوان</label>
                  <input
                    type="text"
                    id="quick-customer-address"
                    value={quickCustomerAddress}
                    onChange={e => setQuickCustomerAddress(e.target.value)}
                    placeholder="عنوان العميل (اختياري)"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-right"
                  />
                </div>
                
                <div className="flex gap-3 pt-6 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCustomerName('');
                      setQuickCustomerPhone('');
                      setQuickCustomerAddress('');
                      setIsNewCustomerModalOpen(false);
                    }}
                    className="flex-1 py-3.5 bg-slate-50 text-slate-500 font-black rounded-2xl hover:bg-slate-100 transition-all text-xs cursor-pointer focus:outline-none"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const cName = quickCustomerName.trim();
                      const cPhone = quickCustomerPhone.trim();
                      const cAddress = quickCustomerAddress.trim();
                      
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
                          branchId: selectedBranchId,
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
                          branchId: selectedBranchId,
                          createdAt: new Date().toISOString()
                        };
                        
                        setSelectedCustomer(newCust);
                        setCustomerSearchTerm(`${cName} (${cPhone})`);
                        setQuickCustomerName('');
                        setQuickCustomerPhone('');
                        setQuickCustomerAddress('');
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




