import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
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
  ShieldCheck,
  FileText,
  Printer,
  Download,
  Upload as UploadIcon,
  Trash2,
  Check,
  X,
  History,
  Info,
  Calendar,
  User,
  Filter,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, getDocs, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, Warehouse, InventoryTransaction, StockTakingDoc, StockTakingItem } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useBranchFilter } from '../../hooks/useBranchFilter';
import { accountingService } from '../../services/accounting';
import { auditService } from '../../services/firestore';

export default function StockTaking() {
  const { user } = useAuth();
  const restrictedBranchId = useBranchFilter();
  
  // Tab states: 'worksheet' | 'reports' | 'history'
  const [activeTab, setActiveTab] = useState<'worksheet' | 'reports' | 'history'>('worksheet');
  
  // Realtime Lists
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [transferReceipts, setTransferReceipts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [dbBrands, setDbBrands] = useState<string[]>([]);
  const [dbSuppliers, setDbSuppliers] = useState<string[]>([]);
  const [pastStockTakes, setPastStockTakes] = useState<StockTakingDoc[]>([]);
  
  // Document State
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState<'DRAFT' | 'PENDING' | 'COMPLETED' | 'CANCELLED'>('DRAFT');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [docNotes, setDocNotes] = useState('');
  const [activeItems, setActiveItems] = useState<StockTakingItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  // Search & Filter Panel States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // UI helpers
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('تم حفظ البيانات بنجاح!');
  const [lastApprovedDate, setLastApprovedDate] = useState<string>('لا يوجد');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch data in realtime
  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, 'products')), (snap) => {
      const prods = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setProducts(prods);
      
      // Extract unique categories and brands dynamically
      const cats = Array.from(new Set(prods.map(p => p.category).filter(Boolean)));
      const brs = Array.from(new Set(prods.map(p => p.brand).filter(Boolean)));
      setDbCategories(cats);
      setDbBrands(brs);
    });

    const unsubW = onSnapshot(query(collection(db, 'warehouses')), (snap) => {
      let whs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
      if (!whs.some(w => w.id === '1')) {
        whs.unshift({
          id: '1',
          name: 'المخزن الرئيسي (Main Warehouse)',
          code: 'MAIN',
          isActive: true,
          type: 'MAIN'
        } as any);
      }
      setWarehouses(whs);
    });

    const unsubT = onSnapshot(query(collection(db, 'inventory_transactions')), (snap) => {
      setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubO = onSnapshot(query(collection(db, 'orders')), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubTR = onSnapshot(query(collection(db, 'transfer_receipts')), (snap) => {
      setTransferReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSupp = onSnapshot(query(collection(db, 'suppliers')), (snap) => {
      setDbSuppliers(snap.docs.map(d => d.data().name).filter(Boolean));
    });

    const unsubStockTakes = onSnapshot(query(collection(db, 'stock_takings')), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockTakingDoc));
      setPastStockTakes(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      
      // Get last approved date for selected warehouse
      const approved = list.filter(s => s.status === 'COMPLETED' && s.warehouseId === selectedWarehouseId);
      if (approved.length > 0) {
        setLastApprovedDate(new Date(approved[0].approvedAt || approved[0].createdAt).toLocaleDateString('ar-EG'));
      } else {
        setLastApprovedDate('لا يوجد');
      }
      setLoading(false);
    });

    return () => {
      unsubP();
      unsubW();
      unsubT();
      unsubO();
      unsubTR();
      unsubSupp();
      unsubStockTakes();
    };
  }, [selectedWarehouseId]);

  // Handle cashiers default branch assignment
  useEffect(() => {
    if (restrictedBranchId) {
      setSelectedWarehouseId(restrictedBranchId);
    } else if (warehouses.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [restrictedBranchId, warehouses, selectedWarehouseId]);

  // Load audit logs when document changes
  useEffect(() => {
    if (currentDocId) {
      auditService.getLogsByReference(currentDocId).then(setAuditLogs);
    } else {
      setAuditLogs([]);
    }
  }, [currentDocId]);

  const selectedWarehouseName = useMemo(() => {
    return warehouses.find(w => w.id === selectedWarehouseId)?.name || 'المستودع';
  }, [warehouses, selectedWarehouseId]);

  // Warehouse specific stock level calculation (matches accounting standard in POS)
  const calculateStock = (productId: string, warehouseId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;

    const currentWh = warehouses.find(w => w.id === warehouseId);
    const isMain = warehouseId === '1' || currentWh?.code === 'MAIN' || (currentWh as any)?.type === 'MAIN';

    if (isMain) {
      return product.quantity || 0;
    } else {
      const receiptsToBranch = transferReceipts.filter(
        tr => (tr.status === 'RECEIVED' || tr.status === 'PARTIALLY_RECEIVED') && tr.toWarehouseId === warehouseId
      );
      let incomingStock = 0;
      receiptsToBranch.forEach(tr => {
        const productQty = tr.items
          ?.filter((i: any) => i.productId === productId)
          .reduce((acc: number, curr: any) => acc + (curr.receivedQty || 0), 0) || 0;
        incomingStock += productQty;
      });

      const transfersFromBranch = transfers.filter(
        t => t.type === 'TRANSFER' && (t.status === 'COMPLETED' || t.status === 'SHIPPED') && t.fromWarehouseId === warehouseId
      );
      let outgoingTransfers = 0;
      transfersFromBranch.forEach(t => {
        const productQty = t.items
          ?.filter((i: any) => i.productId === productId)
          .reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0) || 0;
        outgoingTransfers += productQty;
      });

      const outgoingSales = orders
        .filter(inv => inv && inv.customerId !== 'EXPENSE' && (inv.status === 'COMPLETED' || !inv.status))
        .reduce((sum, inv) => {
          const itemsForWh = inv.items?.filter((i: any) => 
            i && (i.branchId || i.warehouseId || inv.branchId) === warehouseId && i.productId === productId
          ) || [];
          const productQty = itemsForWh.reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);
          return sum + productQty;
        }, 0);

      const adjustmentsInBranch = transfers.filter(
        t => t.type === 'ADJUSTMENT' && t.status === 'COMPLETED' && t.fromWarehouseId === warehouseId
      );
      let adjustmentDelta = 0;
      adjustmentsInBranch.forEach(t => {
        const productQty = t.items
          ?.filter((i: any) => i.productId === productId)
          .reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0) || 0;
        adjustmentDelta += productQty;
      });

      return Math.max(0, incomingStock - outgoingTransfers - outgoingSales + adjustmentDelta);
    }
  };

  const productStockMap = useMemo(() => {
    const stockMap: Record<string, number> = {};
    products.forEach(p => {
      stockMap[p.id] = calculateStock(p.id, selectedWarehouseId);
    });
    return stockMap;
  }, [products, selectedWarehouseId, transfers, orders, transferReceipts, warehouses]);

  const handleWarehouseChange = (whId: string) => {
    setSelectedWarehouseId(whId);
    setActiveItems([]);
    setDocNotes('');
    setCurrentDocId(null);
    setDocStatus('DRAFT');
  };

  // Load items into worksheet based on filters
  const handleLoadItems = () => {
    setLoading(true);
    try {
      const selectedWh = warehouses.find(w => w.id === selectedWarehouseId);
      const isMain = selectedWarehouseId === '1' || selectedWh?.code === 'MAIN' || (selectedWh as any)?.type === 'MAIN';

      const filtered = products.filter(p => {
        const bookQty = productStockMap[p.id] || 0;
        if (!isMain && bookQty <= 0) return false;

        const matchSearch = searchTerm.trim() === '*' 
          ? true 
          : (searchTerm === '' || 
             p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             p.barcode?.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchCat = filterCategory === '' || p.category === filterCategory;
        const matchBrand = filterBrand === '' || p.brand === filterBrand;
        const matchSupplier = filterSupplier === '' || (p.tags && p.tags.includes(filterSupplier));

        return matchSearch && matchCat && matchBrand && matchSupplier;
      });

      const items: StockTakingItem[] = filtered.map(p => {
        const bookQty = productStockMap[p.id] || 0;
        return {
          productId: p.id,
          productName: p.name,
          sku: p.sku || '',
          barcode: p.barcode || '',
          category: p.category || 'غير مصنف',
          brand: p.brand || 'عام',
          unit: 'قطعة',
          bookQty,
          actualQty: bookQty, // default to book qty
          diffQty: 0,
          unitCost: p.costPrice || 0,
          diffValue: 0,
          notes: ''
        };
      });

      setActiveItems(items);
      alert(`تم تحميل ${items.length} صنف في ورقة الجرد.`);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تحميل الأصناف.');
    } finally {
      setLoading(false);
    }
  };

  // Handle cell inputs
  const handleActualQtyChange = (productId: string, val: string) => {
    const num = parseInt(val);
    const actual = isNaN(num) ? 0 : num;

    setActiveItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const diff = actual - item.bookQty;
        return {
          ...item,
          actualQty: actual,
          diffQty: diff,
          diffValue: diff * item.unitCost
        };
      }
      return item;
    }));
  };

  const handleItemNotesChange = (productId: string, notes: string) => {
    setActiveItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, notes };
      }
      return item;
    }));
  };

  // Stats computation for header info bar
  const worksheetStats = useMemo(() => {
    const totalItems = activeItems.length;
    const matching = activeItems.filter(i => i.diffQty === 0).length;
    const deficitItems = activeItems.filter(i => i.diffQty < 0);
    const surplusItems = activeItems.filter(i => i.diffQty > 0);

    const totalDeficitValue = deficitItems.reduce((acc, curr) => acc + curr.diffValue, 0);
    const totalSurplusValue = surplusItems.reduce((acc, curr) => acc + curr.diffValue, 0);
    const netDifferenceValue = totalDeficitValue + totalSurplusValue;

    return {
      totalItems,
      matching,
      deficitCount: deficitItems.length,
      surplusCount: surplusItems.length,
      netDifferenceValue
    };
  }, [activeItems]);

  // Tab filters for live reporting
  const filteredReportItems = useMemo(() => {
    return activeItems;
  }, [activeItems]);

  // Grouped stats by category
  const categoryReportStats = useMemo(() => {
    const stats: Record<string, { bookVal: number; actualVal: number; diffVal: number }> = {};
    activeItems.forEach(item => {
      if (!stats[item.category]) {
        stats[item.category] = { bookVal: 0, actualVal: 0, diffVal: 0 };
      }
      stats[item.category].bookVal += item.bookQty * item.unitCost;
      stats[item.category].actualVal += item.actualQty * item.unitCost;
      stats[item.category].diffVal += item.diffValue;
    });
    return stats;
  }, [activeItems]);

  // Grouped stats by brand
  const brandReportStats = useMemo(() => {
    const stats: Record<string, { bookVal: number; actualVal: number; diffVal: number }> = {};
    activeItems.forEach(item => {
      if (!stats[item.brand]) {
        stats[item.brand] = { bookVal: 0, actualVal: 0, diffVal: 0 };
      }
      stats[item.brand].bookVal += item.bookQty * item.unitCost;
      stats[item.brand].actualVal += item.actualQty * item.unitCost;
      stats[item.brand].diffVal += item.diffValue;
    });
    return stats;
  }, [activeItems]);

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // CSV Export
  const handleExportCSV = () => {
    if (activeItems.length === 0) {
      alert('لا توجد أصناف لتصديرها.');
      return;
    }
    const headers = ['الباركود', 'كود الصنف', 'اسم الصنف', 'المخزن', 'الرصيد الدفتري', 'الرصيد الفعلي', 'ملاحظات'];
    const rows = activeItems.map(item => [
      item.barcode || '',
      item.sku || '',
      item.productName,
      selectedWarehouseName,
      item.bookQty,
      item.actualQty,
      item.notes || ''
    ]);
    
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `جرد_مخزني_${selectedWarehouseName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length < 2) {
          alert('ملف CSV فارغ أو غير صالح.');
          return;
        }

        const separator = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.replace(/^"|"$/g, '').trim());
        
        const barcodeIdx = headers.findIndex(h => h.includes('باركود') || h.includes('الباركود') || h.toLowerCase().includes('barcode'));
        const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('الصنف') || h.toLowerCase().includes('sku'));
        const actualQtyIdx = headers.findIndex(h => h.includes('فعلي') || h.includes('الفعلي') || h.toLowerCase().includes('actual'));

        if (actualQtyIdx === -1) {
          alert('لم يتم العثور على عمود "الرصيد الفعلي" في ملف CSV.');
          return;
        }

        const qtyUpdates: Record<string, number> = {};
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(separator).map(c => c.replace(/^"|"$/g, '').trim());
          const barcode = barcodeIdx !== -1 ? cols[barcodeIdx] : '';
          const sku = skuIdx !== -1 ? cols[skuIdx] : '';
          const actualQty = Number(cols[actualQtyIdx]);

          if (isNaN(actualQty)) continue;

          if (barcode) {
            qtyUpdates[barcode] = actualQty;
          }
          if (sku) {
            qtyUpdates[sku] = actualQty;
          }
        }

        let updatedCount = 0;
        setActiveItems(prev => prev.map(item => {
          let newQty = item.actualQty;
          if (qtyUpdates[item.barcode] !== undefined) {
            newQty = qtyUpdates[item.barcode];
            updatedCount++;
          } else if (qtyUpdates[item.sku] !== undefined) {
            newQty = qtyUpdates[item.sku];
            updatedCount++;
          }
          const diff = newQty - item.bookQty;
          return {
            ...item,
            actualQty: newQty,
            diffQty: diff,
            diffValue: diff * item.unitCost
          };
        }));

        alert(`تم استيراد البيانات بنجاح! تم تحديث ${updatedCount} صنف.`);
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء قراءة ملف CSV. يرجى التأكد من الصيغة الصحيحة.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  // Reset to create a new sheet
  const handleNewStockTake = () => {
    if (activeItems.length > 0 && docStatus === 'DRAFT') {
      const confirmDiscard = window.confirm('هل تريد تجاهل ورقة الجرد الحالية وبدء جرد جديد؟');
      if (!confirmDiscard) return;
    }
    setCurrentDocId(null);
    setDocStatus('DRAFT');
    setActiveItems([]);
    setDocNotes('');
    setSearchTerm('');
    setFilterCategory('');
    setFilterBrand('');
    setFilterSupplier('');
  };

  // General Firestore save handler (Draft or Pending)
  const handleSaveStockTake = async (statusToSet: 'DRAFT' | 'PENDING') => {
    if (activeItems.length === 0) {
      alert('يرجى تحميل وإدخال أصناف أولاً.');
      return;
    }
    setIsSubmitting(true);
    try {
      const docData: Omit<StockTakingDoc, 'id'> = {
        warehouseId: selectedWarehouseId,
        warehouseName: selectedWarehouseName,
        status: statusToSet,
        notes: docNotes,
        items: activeItems,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'unknown',
        createdByName: user?.name || 'مستخدم غير معروف'
      };

      let docId = currentDocId;
      if (currentDocId) {
        const updateData: Partial<StockTakingDoc> = {
          items: activeItems,
          notes: docNotes,
          status: statusToSet,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.uid,
          updatedByName: user?.name
        };
        await updateDoc(doc(db, 'stock_takings', currentDocId), updateData);
        await auditService.logActivity({
          userId: user?.uid || '',
          userName: user?.name || '',
          userEmail: user?.email || '',
          action: statusToSet === 'DRAFT' ? 'تعديل مسودة جرد' : 'تقديم جرد للمراجعة',
          details: `تم تعديل الجرد وحفظه بحالة ${statusToSet === 'DRAFT' ? 'مسودة' : 'معلق للمراجعة'}`,
          referenceId: currentDocId
        });
      } else {
        const docRef = await addDoc(collection(db, 'stock_takings'), docData);
        docId = docRef.id;
        setCurrentDocId(docId);
        await auditService.logActivity({
          userId: user?.uid || '',
          userName: user?.name || '',
          userEmail: user?.email || '',
          action: statusToSet === 'DRAFT' ? 'إنشاء مسودة جرد' : 'إنشاء وتقديم جرد للمراجعة',
          details: `تم إنشاء مستند الجرد بحالة ${statusToSet === 'DRAFT' ? 'مسودة' : 'معلق للمراجعة'}`,
          referenceId: docId
        });
      }

      setDocStatus(statusToSet);
      setSuccessMessage(statusToSet === 'DRAFT' ? 'تم حفظ المسودة بنجاح!' : 'تم تقديم الجرد للمراجعة بنجاح!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حفظ الجرد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Accounting Integration: Post adjustment differences to General Ledger
  const postStockAdjustmentToAccounting = async (docId: string, diffVal: number) => {
    try {
      const accounts = await accountingService.getAccounts();
      let inventoryAccount = accounts.find(a => a.code === '11') || accounts.find(a => a.type === 'ASSET' && a.name.includes('مخزون')) || accounts.find(a => a.type === 'ASSET');
      let contraAccount;

      if (diffVal > 0) {
        contraAccount = accounts.find(a => a.code === '41') || accounts.find(a => a.type === 'REVENUE' && (a.name.includes('أرباح') || a.name.includes('زيادة'))) || accounts.find(a => a.type === 'REVENUE');
      } else {
        contraAccount = accounts.find(a => a.code === '511') || accounts.find(a => a.type === 'EXPENSE' && (a.name.includes('خسائر') || a.name.includes('عجز') || a.name.includes('مصروف'))) || accounts.find(a => a.type === 'EXPENSE');
      }

      if (!inventoryAccount || !contraAccount) {
        console.warn('Could not find accounting accounts for stock adjustment. Skipping journal entry.');
        return;
      }

      const absValue = Math.abs(diffVal);
      const lines = diffVal > 0
        ? [
            {
              accountId: inventoryAccount.id,
              accountName: inventoryAccount.name,
              debit: absValue,
              credit: 0,
              memo: `فائض جرد مخزني - مستودع ${selectedWarehouseName}`
            },
            {
              accountId: contraAccount.id,
              accountName: contraAccount.name,
              debit: 0,
              credit: absValue,
              memo: `أرباح تسوية جرد مخزني`
            }
          ]
        : [
            {
              accountId: contraAccount.id,
              accountName: contraAccount.name,
              debit: absValue,
              credit: 0,
              memo: `خسائر تسوية عجز جرد مخزني`
            },
            {
              accountId: inventoryAccount.id,
              accountName: inventoryAccount.name,
              debit: 0,
              credit: absValue,
              memo: `عجز جرد مخزني - مستودع ${selectedWarehouseName}`
            }
          ];

      await accountingService.postJournalEntry({
        date: new Date().toISOString().split('T')[0],
        reference: docId,
        description: `تسوية جرد مخزني رقم #${docId.slice(0, 8)} للمستودع ${selectedWarehouseName}`,
        status: 'POSTED',
        lines,
        createdBy: 'نظام جرد المخزون ERP'
      });
    } catch (err) {
      console.error('Error posting stock adjustment to accounting:', err);
    }
  };

  // Accounting Integration: Post reversing entries on cancellation
  const postCancellationToAccounting = async (docId: string, diffVal: number) => {
    try {
      const accounts = await accountingService.getAccounts();
      let inventoryAccount = accounts.find(a => a.code === '11') || accounts.find(a => a.type === 'ASSET' && a.name.includes('مخزون')) || accounts.find(a => a.type === 'ASSET');
      let contraAccount;

      if (diffVal > 0) {
        contraAccount = accounts.find(a => a.code === '41') || accounts.find(a => a.type === 'REVENUE' && (a.name.includes('أرباح') || a.name.includes('زيادة'))) || accounts.find(a => a.type === 'REVENUE');
      } else {
        contraAccount = accounts.find(a => a.code === '511') || accounts.find(a => a.type === 'EXPENSE' && (a.name.includes('خسائر') || a.name.includes('عجز') || a.name.includes('مصروف'))) || accounts.find(a => a.type === 'EXPENSE');
      }

      if (!inventoryAccount || !contraAccount) return;

      const absValue = Math.abs(diffVal);
      const lines = diffVal > 0
        ? [
            {
              accountId: contraAccount.id,
              accountName: contraAccount.name,
              debit: absValue,
              credit: 0,
              memo: `عكس أرباح تسوية جرد مخزني ملغى`
            },
            {
              accountId: inventoryAccount.id,
              accountName: inventoryAccount.name,
              debit: 0,
              credit: absValue,
              memo: `عكس فائض جرد مخزني ملغى - مستودع ${selectedWarehouseName}`
            }
          ]
        : [
            {
              accountId: inventoryAccount.id,
              accountName: inventoryAccount.name,
              debit: absValue,
              credit: 0,
              memo: `عكس عجز جرد مخزني ملغى - مستودع ${selectedWarehouseName}`
            },
            {
              accountId: contraAccount.id,
              accountName: contraAccount.name,
              debit: 0,
              credit: absValue,
              memo: `عكس خسائر تسوية عجز جرد مخزني ملغى`
            }
          ];

      await accountingService.postJournalEntry({
        date: new Date().toISOString().split('T')[0],
        reference: `CANCEL-${docId}`,
        description: `إلغاء وعكس قيد تسوية جرد مخزني رقم #${docId.slice(0, 8)}`,
        status: 'POSTED',
        lines,
        createdBy: 'نظام جرد المخزون ERP'
      });
    } catch (err) {
      console.error('Error posting stock adjustment cancellation to accounting:', err);
    }
  };

  // Approve Stock Take (status -> COMPLETED, updates stock & accounting)
  const handleApproveStockTake = async () => {
    if (!currentDocId || activeItems.length === 0) return;
    const confirmApprove = window.confirm('هل أنت متأكد من اعتماد الجرد؟ سيقوم هذا بتسوية فروقات الكميات في المخازن والحسابات العامة نهائياً.');
    if (!confirmApprove) return;

    setIsSubmitting(true);
    try {
      const selectedWh = warehouses.find(w => w.id === selectedWarehouseId);
      const isMain = selectedWarehouseId === '1' || selectedWh?.code === 'MAIN' || (selectedWh as any)?.type === 'MAIN';
      
      const adjustmentItems = activeItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.diffQty, 
        actualQuantity: item.actualQty,
        systemQuantity: item.bookQty,
        cost: item.unitCost,
        sku: item.sku
      })).filter(item => item.quantity !== 0);

      // 1. Update stock_takings status to COMPLETED
      await updateDoc(doc(db, 'stock_takings', currentDocId), {
        status: 'COMPLETED',
        approvedAt: new Date().toISOString(),
        approvedBy: user?.uid,
        approvedByName: user?.name
      });

      // 2. Create ADJUSTMENT Transaction in Firestore for branch stock reconciliation history
      if (adjustmentItems.length > 0) {
        const txData = {
          type: 'ADJUSTMENT',
          status: 'COMPLETED',
          fromWarehouseId: selectedWarehouseId,
          items: adjustmentItems,
          notes: `تسوية جرد معتمد #${currentDocId.slice(0, 8)} - ${selectedWarehouseName}`,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || 'unknown'
        };
        await addDoc(collection(db, 'inventory_transactions'), txData);

        // 3. Only if MAIN Warehouse: update the direct product.quantity field in firestore
        if (isMain) {
          for (const item of adjustmentItems) {
            const prodRef = doc(db, 'products', item.productId);
            await updateDoc(prodRef, {
              quantity: item.actualQuantity
            });
          }
        }

        // 4. Post Journal Entries
        await postStockAdjustmentToAccounting(currentDocId, worksheetStats.netDifferenceValue);
      }

      // 5. Save audit log
      await auditService.logActivity({
        userId: user?.uid || '',
        userName: user?.name || '',
        userEmail: user?.email || '',
        action: 'اعتماد جرد مخزني',
        details: `تم اعتماد مستند الجرد وترحيل التسويات والقيود الحسابية بقيمة فرق ${worksheetStats.netDifferenceValue} EGP`,
        referenceId: currentDocId
      });

      setDocStatus('COMPLETED');
      setSuccessMessage('تم اعتماد الجرد وترحيل القيود والتسويات بنجاح!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء اعتماد الجرد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Approved Stock Take (COMPLETED -> CANCELLED, reverts stock & accounting)
  const handleCancelApproval = async () => {
    if (!currentDocId) return;
    const confirmCancel = window.confirm('تحذير: هل أنت متأكد من إلغاء اعتماد هذا الجرد؟ سيتم عكس قيود الحسابات وإرجاع أرصدة المخزون الدفترية السابقة.');
    if (!confirmCancel) return;

    setIsSubmitting(true);
    try {
      const selectedWh = warehouses.find(w => w.id === selectedWarehouseId);
      const isMain = selectedWarehouseId === '1' || selectedWh?.code === 'MAIN' || (selectedWh as any)?.type === 'MAIN';
      
      const adjustmentItems = activeItems.map(item => ({
        productId: item.productId,
        quantity: -item.diffQty, // Reverse the adjustment
        bookQuantity: item.bookQty
      })).filter(item => item.quantity !== 0);

      // 1. Update stock_takings status to CANCELLED
      await updateDoc(doc(db, 'stock_takings', currentDocId), {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancelledBy: user?.uid,
        cancelledByName: user?.name
      });

      // 2. Create Reversing ADJUSTMENT Transaction in Firestore
      if (adjustmentItems.length > 0) {
        const txData = {
          type: 'ADJUSTMENT',
          status: 'COMPLETED', // transaction completed to apply reversing stock delta
          fromWarehouseId: selectedWarehouseId,
          items: adjustmentItems.map(item => {
            const p = activeItems.find(x => x.productId === item.productId);
            return {
              productId: item.productId,
              productName: p?.productName || 'صنف',
              quantity: item.quantity,
              sku: p?.sku
            };
          }),
          notes: `إلغاء تسوية جرد مخزني معتمد #${currentDocId.slice(0, 8)}`,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || 'unknown'
        };
        await addDoc(collection(db, 'inventory_transactions'), txData);

        // 3. Revert main product quantities in Firestore (if Main)
        if (isMain) {
          for (const item of adjustmentItems) {
            const prodRef = doc(db, 'products', item.productId);
            await updateDoc(prodRef, {
              quantity: item.bookQuantity
            });
          }
        }

        // 4. Reverse Journal Entry
        await postCancellationToAccounting(currentDocId, worksheetStats.netDifferenceValue);
      }

      // 5. Save audit log
      await auditService.logActivity({
        userId: user?.uid || '',
        userName: user?.name || '',
        userEmail: user?.email || '',
        action: 'إلغاء اعتماد جرد مخزني',
        details: `تم إلغاء الجرد المعتمد بالكامل وعكس القيود والتسويات الحسابية`,
        referenceId: currentDocId
      });

      setDocStatus('CANCELLED');
      setSuccessMessage('تم إلغاء اعتماد الجرد وعكس القيود بنجاح!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء إلغاء الجرد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Draft Stock Take
  const handleDeleteStockTake = async (docId: string) => {
    const confirmDel = window.confirm('هل تريد حذف هذه المسودة نهائياً؟');
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'stock_takings', docId));
      if (currentDocId === docId) {
        handleNewStockTake();
      }
      alert('تم حذف مسودة الجرد بنجاح.');
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حذف المسودة.');
    }
  };

  // Load selected stock take from history
  const handleLoadStockTake = (docVal: StockTakingDoc) => {
    setCurrentDocId(docVal.id);
    setDocStatus(docVal.status);
    setSelectedWarehouseId(docVal.warehouseId);
    setDocNotes(docVal.notes || '');
    setActiveItems(docVal.items);
    setActiveTab('worksheet');
  };

  return (
    <div className="space-y-8 pb-32 print:p-0 print:space-y-4" dir="rtl">
      
      {/* ─── Header Section ─── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-50 rounded-full -mr-32 -mt-32 opacity-20"></div>
        
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-100">
                <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">جرد المخزون والرقابة</h2>
                <p className="text-gray-400 text-xs font-bold mt-1">نظام التسويات الذكي (ERP Stock-Taking & Audit)</p>
             </div>
          </div>
        </div>

        {/* Dynamic tabs */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl relative z-10 w-full lg:w-auto">
          {[
            { id: 'worksheet', label: 'ورقة الجرد والتسوية', icon: FileSpreadsheet },
            { id: 'reports', label: 'التقارير والتحليلات', icon: FileText },
            { id: 'history', label: 'أرشيف العمليات والسجل', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black transition-all",
                activeTab === tab.id 
                  ? "bg-white text-purple-600 shadow-sm border border-purple-50" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Bento Dashboard Statistics Info Bar ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 print:grid-cols-3">
        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 print:border-slate-200">
          <div className="w-11 h-11 shrink-0 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
            <Package className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">أصناف الجرد</p>
            <p className="text-base font-black text-gray-900 truncate">{worksheetStats.totalItems} صنف</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 print:border-slate-200">
          <div className="w-11 h-11 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">المطابقة</p>
            <p className="text-base font-black text-blue-600 truncate">{worksheetStats.matching} أصناف</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 print:border-slate-200">
          <div className="w-11 h-11 shrink-0 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
            <TrendingDown className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">الأصناف (عجز)</p>
            <p className="text-base font-black text-red-600 truncate">{worksheetStats.deficitCount} أصناف</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 print:border-slate-200">
          <div className="w-11 h-11 shrink-0 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">الأصناف (زيادة)</p>
            <p className="text-base font-black text-green-600 truncate">{worksheetStats.surplusCount} أصناف</p>
          </div>
        </div>

        <div className={cn(
          "p-5 rounded-[2rem] shadow-md flex items-center gap-4 text-white print:text-slate-900 print:bg-white print:border print:border-slate-200 print:shadow-none",
          worksheetStats.netDifferenceValue >= 0 ? "bg-emerald-600" : "bg-red-600"
        )}>
          <div className="w-11 h-11 shrink-0 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center print:bg-slate-100 print:text-slate-600">
            <RefreshCcw className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-white/70 font-black uppercase tracking-widest leading-none mb-1 print:text-slate-400">إجمالي الفروقات</p>
            <p className="text-sm font-black truncate">{formatCurrency(worksheetStats.netDifferenceValue)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 print:border-slate-200">
          <div className="w-11 h-11 shrink-0 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <Calendar className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1 font-sans">آخر جرد معتمد</p>
            <p className="text-xs font-black text-purple-600 truncate">{lastApprovedDate}</p>
          </div>
        </div>
      </div>

      {/* ─── Tab Content 1: Worksheet ─── */}
      {activeTab === 'worksheet' && (
        <div className="space-y-6">
          
          {/* Filters & Actions Panel */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 space-y-6 print:hidden">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              
              {/* Warehouse selector */}
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative w-full sm:w-64">
                  <WarehouseIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <select 
                    value={selectedWarehouseId}
                    onChange={(e) => handleWarehouseChange(e.target.value)}
                    disabled={!!restrictedBranchId || docStatus !== 'DRAFT'}
                    className="w-full bg-slate-50 border-none rounded-2xl pr-10 pl-4 py-3.5 text-sm font-bold shadow-sm focus:bg-white focus:ring-4 focus:ring-purple-100 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Collapsible search details toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="bg-slate-50 text-slate-600 border border-transparent px-4 py-3.5 rounded-2xl text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  تصفية متقدمة
                  {showFilters ? '▲' : '▼'}
                </button>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-3 w-full lg:w-auto lg:justify-end">
                <span className={cn(
                  "text-xs font-black px-4 py-2.5 rounded-xl border tracking-wide uppercase",
                  docStatus === 'DRAFT' && 'bg-slate-50 text-slate-500 border-slate-200',
                  docStatus === 'PENDING' && 'bg-amber-50 text-amber-600 border-amber-200',
                  docStatus === 'COMPLETED' && 'bg-emerald-50 text-emerald-600 border-emerald-200',
                  docStatus === 'CANCELLED' && 'bg-red-50 text-red-600 border-red-200'
                )}>
                  حالة الجرد: {
                    docStatus === 'DRAFT' ? 'مسودة' :
                    docStatus === 'PENDING' ? 'معلق للمراجعة' :
                    docStatus === 'COMPLETED' ? 'معتمد ومرحل' : 'ملغى'
                  }
                </span>

                {/* Print and Export Tools */}
                <button onClick={handlePrint} className="bg-slate-50 text-slate-600 p-3 rounded-2xl hover:bg-slate-100 transition-all shadow-sm" title="طباعة الورقة"><Printer className="w-4.5 h-4.5" /></button>
                <button onClick={handleExportCSV} className="bg-slate-50 text-slate-600 p-3 rounded-2xl hover:bg-slate-100 transition-all shadow-sm" title="تصدير إلى Excel/CSV"><Download className="w-4.5 h-4.5" /></button>
                
                {docStatus === 'DRAFT' && (
                  <>
                    <input 
                      type="file" 
                      accept=".csv" 
                      ref={fileInputRef} 
                      onChange={handleImportCSV} 
                      className="hidden" 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="bg-slate-50 text-slate-600 p-3 rounded-2xl hover:bg-slate-100 transition-all shadow-sm" 
                      title="استيراد من Excel/CSV"
                    >
                      <UploadIcon className="w-4.5 h-4.5" />
                    </button>
                  </>
                )}
              </div>

            </div>

            {/* Collapsible search card */}
            <AnimatePresence>
              {(showFilters || searchTerm) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-slate-100 pt-5 space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative md:col-span-2">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input 
                        type="text"
                        placeholder="ابحث بالاسم، الكود، أو الباركود... (اكتب * لعرض الكل)"
                        className="w-full bg-slate-50 border-none rounded-2xl pr-10 pl-4 py-3 text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="">كل التصنيفات</option>
                      {dbCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select
                      value={filterBrand}
                      onChange={(e) => setFilterBrand(e.target.value)}
                      className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="">كل العلامات (البراند)</option>
                      {dbBrands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select
                      value={filterSupplier}
                      onChange={(e) => setFilterSupplier(e.target.value)}
                      className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="">كل الموردين (الوسم)</option>
                      {dbSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <div className="md:col-span-3 flex justify-end">
                      {docStatus === 'DRAFT' && (
                        <button
                          onClick={handleLoadItems}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-black px-8 py-3 rounded-xl text-xs transition-all shadow-md active:scale-95"
                        >
                          تحميل الأصناف في الجدول
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Worksheet Spreadsheet Grid */}
          <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col print:border-none print:shadow-none">
            <div className="p-6 border-b border-gray-50 bg-gray-50/20 flex justify-between items-center print:border-b-2 print:border-slate-300">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2 print:text-sm">
                <FileSpreadsheet className="w-5 h-5 text-purple-600 print:hidden" />
                ورقة جرد وتعديل كميات المستودع: <span className="text-purple-600">{selectedWarehouseName}</span>
              </h3>
              <div className="text-xs font-bold text-gray-400 print:hidden">
                عدد الأصناف المحددة: {activeItems.length}
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-black border-b border-slate-100">
                    <th className="px-4 py-4 w-12 text-center">#</th>
                    <th className="px-4 py-4">كود الصنف / الباركود</th>
                    <th className="px-4 py-4">اسم الصنف</th>
                    <th className="px-4 py-4">التصنيف / البراند</th>
                    <th className="px-4 py-4 w-28 text-center">الرصيد الدفتري</th>
                    <th className="px-4 py-4 w-32 text-center">الرصيد الفعلي</th>
                    <th className="px-4 py-4 w-24 text-center">الفارق</th>
                    <th className="px-4 py-4 w-28 text-center">تكلفة الوحدة</th>
                    <th className="px-4 py-4 w-28 text-center">قيمة الفروقات</th>
                    <th className="px-4 py-4 print:hidden">ملاحظات تسوية الصنف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-bold">
                  {activeItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-24 text-center">
                        <Package className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <h4 className="text-slate-400 text-sm font-black">ورقة الجرد فارغة حالياً</h4>
                        <p className="text-slate-400 text-xs mt-1">الرجاء تحديد فلاتر البحث والضغط على زر "تحميل الأصناف" لبدء عملية الجرد.</p>
                      </td>
                    </tr>
                  ) : (
                    activeItems.map((item, idx) => (
                      <tr 
                        key={item.productId} 
                        className={cn(
                          "hover:bg-slate-50/50 transition-colors",
                          item.diffQty !== 0 ? "bg-slate-50/20" : ""
                        )}
                      >
                        <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-slate-900 font-black">{item.sku}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.barcode}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-800 text-sm">{item.productName}</td>
                        <td className="px-4 py-3">
                          <span className="text-slate-500">{item.category}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{item.brand}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600 font-sans">{item.bookQty}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center print:hidden">
                            <input 
                              type="number"
                              disabled={docStatus !== 'DRAFT'}
                              value={item.actualQty}
                              onChange={(e) => handleActualQtyChange(item.productId, e.target.value)}
                              className={cn(
                                "w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-black outline-none transition-all focus:border-purple-600 focus:ring-4 focus:ring-purple-50 disabled:opacity-75 disabled:bg-slate-50",
                                item.diffQty !== 0 ? "border-purple-300 text-purple-600 font-black bg-purple-50/10" : ""
                              )}
                            />
                          </div>
                          <p className="hidden print:block text-center font-black">{item.actualQty}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.diffQty === 0 ? (
                            <span className="text-slate-300 font-medium">مطابق</span>
                          ) : item.diffQty > 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                              <PlusCircle className="w-3.5 h-3.5" />
                              +{item.diffQty}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                              <MinusCircle className="w-3.5 h-3.5" />
                              {item.diffQty}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600 font-sans">{formatCurrency(item.unitCost)}</td>
                        <td className="px-4 py-3 text-center">
                          {item.diffQty === 0 ? (
                            <span className="text-slate-300 font-sans">0.00</span>
                          ) : (
                            <span className={cn(
                              "font-black font-sans",
                              item.diffQty > 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                              {item.diffQty > 0 ? '+' : ''}{formatCurrency(item.diffValue)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 print:hidden">
                          <input 
                            type="text" 
                            disabled={docStatus !== 'DRAFT'}
                            placeholder="سبب الفارق أو ملاحظات..."
                            value={item.notes}
                            onChange={(e) => handleItemNotesChange(item.productId, e.target.value)}
                            className="w-full bg-transparent border-b border-transparent focus:border-slate-300 outline-none text-slate-500 py-1"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Document summary notes on bottom */}
            {activeItems.length > 0 && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">ملاحظات الجرد العامة والتوصيات</label>
                  <textarea
                    disabled={docStatus !== 'DRAFT'}
                    rows={2}
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    placeholder="اكتب ملاحظات كاملة حول أسباب الفروقات وطرق تسويتها..."
                    className="w-full bg-white border border-slate-200/80 rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-50 resize-none"
                  />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-center space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>قيمة الفائض الإجمالي:</span>
                    <span className="text-emerald-600 font-black">+{formatCurrency(activeItems.filter(i => i.diffQty > 0).reduce((s, c) => s + c.diffValue, 0))}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>قيمة العجز الإجمالي:</span>
                    <span className="text-red-600 font-black">{formatCurrency(activeItems.filter(i => i.diffQty < 0).reduce((s, c) => s + c.diffValue, 0))}</span>
                  </div>
                  <div className="h-px bg-slate-100 my-1" />
                  <div className="flex justify-between text-sm font-black text-slate-800">
                    <span>الصافي التقديري:</span>
                    <span className={worksheetStats.netDifferenceValue >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {worksheetStats.netDifferenceValue >= 0 ? '+' : ''}{formatCurrency(worksheetStats.netDifferenceValue)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Floating Control Bar */}
          <div className="bg-white border-t border-slate-100 py-4 px-8 fixed bottom-11 left-0 right-0 z-30 shadow-2xl flex justify-between items-center print:hidden">
            <div className="flex gap-2">
              <button
                onClick={handleNewStockTake}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-5 py-3 rounded-2xl text-xs transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                جرد جديد
              </button>
              {currentDocId && (
                <button
                  onClick={() => handleSaveStockTake(docStatus === 'PENDING' ? 'PENDING' : 'DRAFT')}
                  disabled={isSubmitting || docStatus !== 'DRAFT'}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3 rounded-2xl text-xs transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  حفظ المسودة
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {docStatus === 'DRAFT' && (
                <button
                  onClick={() => handleSaveStockTake('PENDING')}
                  disabled={isSubmitting || activeItems.length === 0}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-black px-6 py-3 rounded-2xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-amber-100 active:scale-95 disabled:opacity-50"
                >
                  <Eye className="w-4.5 h-4.5" />
                  تقديم للمراجعة
                </button>
              )}

              {(docStatus === 'DRAFT' || docStatus === 'PENDING') && (
                <button
                  onClick={handleApproveStockTake}
                  disabled={isSubmitting || activeItems.length === 0 || !currentDocId}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3 rounded-2xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4.5 h-4.5" />
                  اعتماد ترحيل الجرد
                </button>
              )}

              {docStatus === 'COMPLETED' && (
                <button
                  onClick={handleCancelApproval}
                  disabled={isSubmitting}
                  className="bg-red-600 hover:bg-red-700 text-white font-black px-8 py-3 rounded-2xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-red-100 active:scale-95 disabled:opacity-50"
                >
                  <X className="w-4.5 h-4.5" />
                  إلغاء الاعتماد وعكس القيود
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ─── Tab Content 2: Reports & Analytics ─── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Category breakdown report */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-4">
              <h4 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                تحليل الفروقات حسب تصنيف المنتجات
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="pb-3 text-right">التصنيف</th>
                      <th className="pb-3 text-center">تكلفة دفتري</th>
                      <th className="pb-3 text-center">تكلفة فعلي</th>
                      <th className="pb-3 text-left">فارق التكلفة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {(Object.entries(categoryReportStats) as [string, { bookVal: number; actualVal: number; diffVal: number }][]).map(([cat, val]) => (
                      <tr key={cat}>
                        <td className="py-3 text-slate-700">{cat}</td>
                        <td className="py-3 text-center text-slate-500 font-sans">{formatCurrency(val.bookVal)}</td>
                        <td className="py-3 text-center text-slate-900 font-sans">{formatCurrency(val.actualVal)}</td>
                        <td className="py-3 text-left">
                          <span className={cn(
                            "font-sans font-black",
                            val.diffVal > 0 ? "text-green-600" : val.diffVal < 0 ? "text-red-600" : "text-slate-300"
                          )}>
                            {val.diffVal > 0 ? '+' : ''}{formatCurrency(val.diffVal)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Brand breakdown report */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-4">
              <h4 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                تحليل الفروقات حسب العلامة التجارية (البراند)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="pb-3 text-right">الماركة / البراند</th>
                      <th className="pb-3 text-center">تكلفة دفتري</th>
                      <th className="pb-3 text-center">تكلفة فعلي</th>
                      <th className="pb-3 text-left">فارق التكلفة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {(Object.entries(brandReportStats) as [string, { bookVal: number; actualVal: number; diffVal: number }][]).map(([brand, val]) => (
                      <tr key={brand}>
                        <td className="py-3 text-slate-700">{brand}</td>
                        <td className="py-3 text-center text-slate-500 font-sans">{formatCurrency(val.bookVal)}</td>
                        <td className="py-3 text-center text-slate-900 font-sans">{formatCurrency(val.actualVal)}</td>
                        <td className="py-3 text-left">
                          <span className={cn(
                            "font-sans font-black",
                            val.diffVal > 0 ? "text-green-600" : val.diffVal < 0 ? "text-red-600" : "text-slate-300"
                          )}>
                            {val.diffVal > 0 ? '+' : ''}{formatCurrency(val.diffVal)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Variance detailed lists */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-5">
            <h4 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-purple-600" />
              تفاصيل الفروقات والتسويات المطلوبة
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="pb-3">الصنف</th>
                    <th className="pb-3 text-center">نوع الفارق</th>
                    <th className="pb-3 text-center">فرق الكمية</th>
                    <th className="pb-3 text-center">قيمة الفارق</th>
                    <th className="pb-3 text-left">نوع حركة التسوية التلقائية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-bold">
                  {filteredReportItems.filter(i => i.diffQty !== 0).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">لا توجد فروقات مخزنية حالياً</td>
                    </tr>
                  ) : (
                    filteredReportItems.filter(i => i.diffQty !== 0).map(item => (
                      <tr key={item.productId}>
                        <td className="py-3">
                          <p className="text-slate-800 font-black">{item.productName}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
                        </td>
                        <td className="py-3 text-center">
                          <span className={cn(
                            "text-[10px] font-black px-2.5 py-1.5 rounded-xl border whitespace-nowrap",
                            item.diffQty > 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {item.diffQty > 0 ? 'زيادة (فائض)' : 'عجز (خسارة)'}
                          </span>
                        </td>
                        <td className="py-3 text-center font-sans">{item.diffQty > 0 ? `+${item.diffQty}` : item.diffQty}</td>
                        <td className="py-3 text-center font-sans font-black">{formatCurrency(item.diffValue)}</td>
                        <td className="py-3 text-left">
                          <span className={cn(
                            "text-xs font-bold",
                            item.diffQty > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {item.diffQty > 0 ? 'إضافة مخزون تلقائي (Asset Debit)' : 'صرف عجز مخزون تلقائي (Expense Debit)'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ─── Tab Content 3: History & Archives ─── */}
      {activeTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* History stock takes list */}
          <div className="lg:col-span-7 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 space-y-4">
            <h4 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-purple-600" />
              أرشيف مستندات الجرد المخزني
            </h4>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {pastStockTakes.length === 0 ? (
                <p className="text-slate-400 text-center py-12 text-xs font-bold">لا توجد مستندات جرد سابقة.</p>
              ) : (
                pastStockTakes.map(st => (
                  <div 
                    key={st.id}
                    onClick={() => handleLoadStockTake(st)}
                    className={cn(
                      "p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 relative group",
                      currentDocId === st.id 
                        ? "border-purple-600 bg-purple-50/10 shadow-lg shadow-purple-50" 
                        : "border-slate-100 hover:border-slate-200 bg-white"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-black text-sm text-slate-900 flex items-center gap-2">
                          <WarehouseIcon className="w-4 h-4 text-purple-600" />
                          مستودع: {st.warehouseName}
                        </h5>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">المعرف: #{st.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[9px] font-black px-2 py-1 rounded-lg border",
                          st.status === 'DRAFT' && 'bg-slate-50 text-slate-500 border-slate-200',
                          st.status === 'PENDING' && 'bg-amber-50 text-amber-600 border-amber-200',
                          st.status === 'COMPLETED' && 'bg-emerald-50 text-emerald-600 border-emerald-200',
                          st.status === 'CANCELLED' && 'bg-red-50 text-red-600 border-red-200'
                        )}>
                          {
                            st.status === 'DRAFT' ? 'مسودة' :
                            st.status === 'PENDING' ? 'معلق' :
                            st.status === 'COMPLETED' ? 'معتمد' : 'ملغى'
                          }
                        </span>

                        {st.status === 'DRAFT' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStockTake(st.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                            title="حذف المسودة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-t border-slate-50 pt-2">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-300" />
                        <span>المنشئ: {st.createdByName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        <span>التاريخ: {new Date(st.createdAt).toLocaleDateString('ar-EG')}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Audit trail view */}
          <div className="lg:col-span-5 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 space-y-4">
            <h4 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              سجل التدقيق والنشاط (Audit Trail)
            </h4>
            {currentDocId ? (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase">المستند النشط حالياً</p>
                  <p className="text-xs font-black text-slate-700">المعرف: {currentDocId}</p>
                </div>
                {auditLogs.length === 0 ? (
                  <p className="text-slate-400 text-center py-6 text-xs">لا توجد عمليات مسجلة لهذا المستند.</p>
                ) : (
                  <div className="relative border-r border-slate-100 mr-2 space-y-5">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="relative pr-6">
                        {/* Audit dot indicator */}
                        <span className="absolute right-0 top-1 w-2.5 h-2.5 rounded-full bg-purple-600 border-2 border-white translate-x-1.5" />
                        
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span className="font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{log.action}</span>
                            <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString('ar-EG')} - {new Date(log.timestamp).toLocaleDateString('ar-EG')}</span>
                          </div>
                          <p className="text-xs text-slate-700 font-bold leading-relaxed">{log.details}</p>
                          <p className="text-[10px] text-slate-400">المستخدم: {log.userName} ({log.userEmail})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-3">
                <Info className="w-10 h-10 text-slate-300" />
                <p className="text-xs font-bold leading-relaxed">الرجاء اختيار مستند جرد من الأرشيف لعرض سجل التدقيق الخاص به.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Success Notification Alert */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-12 left-12 z-[100] bg-gray-900 border border-gray-800 text-white px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-5"
          >
            <div className="w-11 h-11 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-500/20">
               <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex flex-col text-right">
               <span className="text-base font-black tracking-tight">{successMessage}</span>
               <span className="text-[11px] text-gray-400 font-bold">تم حفظ الجرد بنجاح وتحديث السجلات في قاعدة البيانات.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
