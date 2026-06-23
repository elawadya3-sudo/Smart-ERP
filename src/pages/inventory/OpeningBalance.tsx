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
  FileSpreadsheet,
  Building2,
  CreditCard,
  Layers,
  Users
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, getDocs, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Product, 
  Warehouse, 
  Customer, 
  Account, 
  JournalEntry,
  OpeningBalanceDoc,
  OpeningBalanceItem,
  OpeningBalanceCustomer,
  OpeningBalanceSupplier,
  OpeningBalanceAccount
} from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useBranchFilter } from '../../hooks/useBranchFilter';
import { accountingService } from '../../services/accounting';
import { auditService } from '../../services/firestore';

export default function OpeningBalancePage() {
  const { user } = useAuth();
  const restrictedBranchId = useBranchFilter();
  
  // Tab states: 'items' | 'customers' | 'suppliers' | 'accounts' | 'reports' | 'archive'
  const [activeTab, setActiveTab] = useState<'items' | 'customers' | 'suppliers' | 'accounts' | 'reports' | 'archive'>('items');
  
  // Realtime Lists
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [dbSuppliers, setDbSuppliers] = useState<any[]>([]);
  const [dbAccounts, setDbAccounts] = useState<Account[]>([]);
  const [pastDocs, setPastDocs] = useState<OpeningBalanceDoc[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [transferReceipts, setTransferReceipts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  
  // Document State
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [docStatus, setDocStatus] = useState<'DRAFT' | 'COMPLETED' | 'CANCELLED'>('DRAFT');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [docNotes, setDocNotes] = useState('');
  
  // Worksheet Rows States
  const [activeItems, setActiveItems] = useState<OpeningBalanceItem[]>([]);
  const [activeCustomers, setActiveCustomers] = useState<OpeningBalanceCustomer[]>([]);
  const [activeSuppliers, setActiveSuppliers] = useState<OpeningBalanceSupplier[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<OpeningBalanceAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  // Search & Filter Panel States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // UI helpers
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('تم حفظ البيانات بنجاح!');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all database dependencies
  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, 'products')), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
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

    const unsubC = onSnapshot(query(collection(db, 'customers')), (snap) => {
      setDbCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    const unsubS = onSnapshot(query(collection(db, 'suppliers')), (snap) => {
      setDbSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubA = onSnapshot(query(collection(db, 'accounts')), (snap) => {
      setDbAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)).sort((a, b) => a.code.localeCompare(b.code)));
    });

    const unsubDocs = onSnapshot(query(collection(db, 'opening_balances')), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as OpeningBalanceDoc));
      setPastDocs(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
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

    return () => {
      unsubP();
      unsubW();
      unsubC();
      unsubS();
      unsubA();
      unsubDocs();
      unsubT();
      unsubO();
      unsubTR();
    };
  }, []);

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

  // Auto-generate document number on creation
  useEffect(() => {
    if (!currentDocId && pastDocs.length >= 0) {
      const count = pastDocs.length;
      setDocNumber(`OP-${String(count + 1).padStart(5, '0')}`);
    }
  }, [currentDocId, pastDocs]);

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

  const selectedWarehouseName = useMemo(() => {
    return warehouses.find(w => w.id === selectedWarehouseId)?.name || 'المستودع';
  }, [warehouses, selectedWarehouseId]);

  // Unique categories and brands for filtering
  const dbCategories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  }, [products]);

  const dbBrands = useMemo(() => {
    return Array.from(new Set(products.map(p => p.brand).filter(Boolean)));
  }, [products]);

  // Calculations for current worksheet tab
  const worksheetTotals = useMemo(() => {
    if (activeTab === 'items') {
      const totalCount = activeItems.length;
      const totalVal = activeItems.reduce((acc, curr) => acc + curr.totalValue, 0);
      return { totalCount, totalVal, debits: totalVal, credits: 0 };
    } else if (activeTab === 'customers') {
      const totalCount = activeCustomers.length;
      const debits = activeCustomers.reduce((acc, curr) => acc + curr.debit, 0);
      const credits = activeCustomers.reduce((acc, curr) => acc + curr.credit, 0);
      return { totalCount, totalVal: Math.abs(debits - credits), debits, credits };
    } else if (activeTab === 'suppliers') {
      const totalCount = activeSuppliers.length;
      const debits = activeSuppliers.reduce((acc, curr) => acc + curr.debit, 0);
      const credits = activeSuppliers.reduce((acc, curr) => acc + curr.credit, 0);
      return { totalCount, totalVal: Math.abs(credits - debits), debits, credits };
    } else if (activeTab === 'accounts') {
      const totalCount = activeAccounts.length;
      const debits = activeAccounts.reduce((acc, curr) => acc + curr.debit, 0);
      const credits = activeAccounts.reduce((acc, curr) => acc + curr.credit, 0);
      return { totalCount, totalVal: debits, debits, credits };
    }
    return { totalCount: 0, totalVal: 0, debits: 0, credits: 0 };
  }, [activeTab, activeItems, activeCustomers, activeSuppliers, activeAccounts]);

  // Load items into active sheet from products based on search filters
  const handleLoadItems = () => {
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

        return matchSearch && matchCat && matchBrand;
      });

      const loaded: OpeningBalanceItem[] = filtered.map(p => {
        // Look if it's already in active items to keep inputted values, otherwise default
        const existing = activeItems.find(x => x.productId === p.id);
        return existing || {
          productId: p.id,
          productName: p.name,
          sku: p.sku || '',
          barcode: p.barcode || '',
          category: p.category || 'غير مصنف',
          brand: p.brand || 'عام',
          unit: 'قطعة',
          quantity: 0,
          unitCost: p.costPrice || 0,
          totalValue: 0,
          location: '',
          notes: ''
        };
      });

      setActiveItems(loaded);
      alert(`تم تحميل ${loaded.length} صنف في ورقة العمل.`);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تحميل الأصناف.');
    }
  };

  // Load all clients in customer worksheet
  const handleLoadCustomers = () => {
    const loaded: OpeningBalanceCustomer[] = dbCustomers.map(c => {
      const existing = activeCustomers.find(x => x.customerId === c.id);
      return existing || {
        customerId: c.id,
        customerName: c.name,
        customerPhone: c.phone || '',
        debit: 0,
        credit: 0,
        notes: ''
      };
    });
    setActiveCustomers(loaded);
  };

  // Load all suppliers in supplier worksheet
  const handleLoadSuppliers = () => {
    const loaded: OpeningBalanceSupplier[] = dbSuppliers.map(s => {
      const existing = activeSuppliers.find(x => x.supplierId === s.id);
      return existing || {
        supplierId: s.id,
        supplierName: s.name,
        supplierPhone: s.phone || '',
        debit: 0,
        credit: 0,
        notes: ''
      };
    });
    setActiveSuppliers(loaded);
  };

  // Load GL Accounts worksheet
  const handleLoadAccounts = () => {
    const loaded: OpeningBalanceAccount[] = dbAccounts.map(a => {
      const existing = activeAccounts.find(x => x.accountId === a.id);
      return existing || {
        accountId: a.id,
        accountName: a.name,
        accountCode: a.code,
        debit: 0,
        credit: 0,
        notes: ''
      };
    });
    setActiveAccounts(loaded);
  };

  // Handle cell updates for Items
  const handleItemCellChange = (productId: string, field: keyof OpeningBalanceItem, value: any) => {
    setActiveItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitCost') {
          const qty = Math.max(0, Number(updated.quantity) || 0);
          const cost = Math.max(0, Number(updated.unitCost) || 0);
          updated.quantity = qty;
          updated.unitCost = cost;
          updated.totalValue = qty * cost;
        }
        return updated;
      }
      return item;
    }));
  };

  // Handle cell updates for Customers
  const handleCustomerCellChange = (customerId: string, field: 'debit' | 'credit' | 'notes', value: any) => {
    setActiveCustomers(prev => prev.map(c => {
      if (c.customerId === customerId) {
        const updated = { ...c, [field]: value };
        if (field === 'debit' || field === 'credit') {
          updated[field] = Math.max(0, Number(value) || 0);
        }
        return updated;
      }
      return c;
    }));
  };

  // Handle cell updates for Suppliers
  const handleSupplierCellChange = (supplierId: string, field: 'debit' | 'credit' | 'notes', value: any) => {
    setActiveSuppliers(prev => prev.map(s => {
      if (s.supplierId === supplierId) {
        const updated = { ...s, [field]: value };
        if (field === 'debit' || field === 'credit') {
          updated[field] = Math.max(0, Number(value) || 0);
        }
        return updated;
      }
      return s;
    }));
  };

  // Handle cell updates for Accounts
  const handleAccountCellChange = (accountId: string, field: 'debit' | 'credit' | 'notes', value: any) => {
    setActiveAccounts(prev => prev.map(a => {
      if (a.accountId === accountId) {
        const updated = { ...a, [field]: value };
        if (field === 'debit' || field === 'credit') {
          updated[field] = Math.max(0, Number(value) || 0);
        }
        return updated;
      }
      return a;
    }));
  };

  // Clear worksheet and start fresh
  const handleNewDocument = () => {
    if (docStatus === 'DRAFT' && (activeItems.length > 0 || activeCustomers.length > 0 || activeSuppliers.length > 0 || activeAccounts.length > 0)) {
      const confirmDiscard = window.confirm('هل تريد تجاهل ورقة العمل الحالية وبدء مستند جديد؟');
      if (!confirmDiscard) return;
    }
    setCurrentDocId(null);
    setDocStatus('DRAFT');
    setDocDate(new Date().toISOString().split('T')[0]);
    setDocNotes('');
    setActiveItems([]);
    setActiveCustomers([]);
    setActiveSuppliers([]);
    setActiveAccounts([]);
    setSearchTerm('');
    setFilterCategory('');
    setFilterBrand('');
  };

  // Save document to Firestore (Draft only)
  const handleSaveDraft = async () => {
    const hasData = activeItems.some(i => i.quantity > 0) || 
                    activeCustomers.some(c => c.debit > 0 || c.credit > 0) ||
                    activeSuppliers.some(s => s.debit > 0 || s.credit > 0) ||
                    activeAccounts.some(a => a.debit > 0 || a.credit > 0);

    if (!hasData) {
      alert('لا يمكن حفظ مستند فارغ. يرجى إدخال قيم افتتاحية أولاً.');
      return;
    }

    setIsSubmitting(true);
    try {
      const docTypeMap: Record<typeof activeTab, OpeningBalanceDoc['type']> = {
        items: 'ITEMS',
        customers: 'CUSTOMERS',
        suppliers: 'SUPPLIERS',
        accounts: 'ACCOUNTS',
        reports: 'ITEMS', // fallback
        archive: 'ITEMS' // fallback
      };

      const docType = docTypeMap[activeTab] || 'ITEMS';

      const docData: Omit<OpeningBalanceDoc, 'id'> = {
        docNumber,
        date: docDate,
        type: docType,
        status: 'DRAFT',
        notes: docNotes,
        totalAmount: worksheetTotals.totalVal,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'unknown',
        createdByName: user?.name || 'مستخدم غير معروف'
      };

      if (docType === 'ITEMS') {
        docData.warehouseId = selectedWarehouseId;
        docData.warehouseName = selectedWarehouseName;
        docData.items = activeItems.filter(i => i.quantity > 0);
      } else if (docType === 'CUSTOMERS') {
        docData.customers = activeCustomers.filter(c => c.debit > 0 || c.credit > 0);
      } else if (docType === 'SUPPLIERS') {
        docData.suppliers = activeSuppliers.filter(s => s.debit > 0 || s.credit > 0);
      } else if (docType === 'ACCOUNTS') {
        docData.accounts = activeAccounts.filter(a => a.debit > 0 || a.credit > 0);
      }

      if (currentDocId) {
        await updateDoc(doc(db, 'opening_balances', currentDocId), {
          ...docData,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.uid,
          updatedByName: user?.name
        });
        await auditService.logActivity({
          userId: user?.uid || '',
          userName: user?.name || '',
          userEmail: user?.email || '',
          action: 'تعديل مسودة رصيد افتتاحي',
          details: `تم تعديل المسودة رقم ${docNumber} لحسابات الـ ${docType}`,
          referenceId: currentDocId
        });
      } else {
        const ref = await addDoc(collection(db, 'opening_balances'), docData);
        setCurrentDocId(ref.id);
        await auditService.logActivity({
          userId: user?.uid || '',
          userName: user?.name || '',
          userEmail: user?.email || '',
          action: 'إنشاء مسودة رصيد افتتاحي',
          details: `تم إنشاء المسودة رقم ${docNumber} لحسابات الـ ${docType}`,
          referenceId: ref.id
        });
      }

      setSuccessMessage('تم حفظ المسودة بنجاح!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حفظ المسودة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper: Post opening journal entry to GL
  const postOpeningJournalEntry = async (docId: string, docNo: string, type: OpeningBalanceDoc['type'], value: number) => {
    const accounts = await accountingService.getAccounts();
    
    // Find equity account for balancing opening balances
    const equityAccount = accounts.find(a => a.code === '31') || 
                          accounts.find(a => a.type === 'EQUITY' && (a.name.includes('افتتاح') || a.name.includes('رأس'))) ||
                          accounts.find(a => a.type === 'EQUITY');

    if (!equityAccount) {
      throw new Error('لم يتم العثور على حساب رأس المال أو الأرصدة الافتتاحية في شجرة الحسابات لتسوية القيد الحسابي.');
    }

    let description = `قيد افتتاحي رقم #${docNo}`;
    let lines: any[] = [];

    if (type === 'ITEMS') {
      const invAccount = accounts.find(a => a.code === '11') || 
                         accounts.find(a => a.type === 'ASSET' && a.name.includes('مخزون')) ||
                         accounts.find(a => a.type === 'ASSET');
      
      if (!invAccount) throw new Error('حساب المخزون (الأصول) غير معرف في النظام.');

      description = `إثبات رصيد المخزون الافتتاحي مستند رقم #${docNo} - مستودع ${selectedWarehouseName}`;
      lines = [
        {
          accountId: invAccount.id,
          accountName: invAccount.name,
          debit: value,
          credit: 0,
          memo: 'رصيد مخزون أول المدة'
        },
        {
          accountId: equityAccount.id,
          accountName: equityAccount.name,
          debit: 0,
          credit: value,
          memo: 'مقابل رصيد مخزون افتتاحي'
        }
      ];
    } else if (type === 'CUSTOMERS') {
      const arAccount = accounts.find(a => a.code.startsWith('11') && a.name.includes('عملاء')) || 
                        accounts.find(a => a.type === 'ASSET' && a.name.includes('عملاء')) ||
                        accounts.find(a => a.type === 'ASSET');

      if (!arAccount) throw new Error('حساب أستاذ العملاء (أصول متداولة) غير معرف.');

      description = `إثبات الأرصدة الافتتاحية للعملاء مستند رقم #${docNo}`;
      
      const debits = activeCustomers.reduce((acc, curr) => acc + curr.debit, 0);
      const credits = activeCustomers.reduce((acc, curr) => acc + curr.credit, 0);
      const netValue = debits - credits;

      if (netValue > 0) {
        lines = [
          { accountId: arAccount.id, accountName: arAccount.name, debit: netValue, credit: 0, memo: 'صافي أرصدة عملاء مدينة' },
          { accountId: equityAccount.id, accountName: equityAccount.name, debit: 0, credit: netValue, memo: 'إثبات رصيد افتتاحي للعملاء' }
        ];
      } else if (netValue < 0) {
        const absVal = Math.abs(netValue);
        lines = [
          { accountId: equityAccount.id, accountName: equityAccount.name, debit: absVal, credit: 0, memo: 'إثبات رصيد افتتاحي للعملاء' },
          { accountId: arAccount.id, accountName: arAccount.name, debit: 0, credit: absVal, memo: 'صافي أرصدة عملاء دائنة' }
        ];
      }
    } else if (type === 'SUPPLIERS') {
      const apAccount = accounts.find(a => a.code === '211') || 
                        accounts.find(a => a.type === 'LIABILITY' && a.name.includes('مورد')) ||
                        accounts.find(a => a.type === 'LIABILITY');

      if (!apAccount) throw new Error('حساب أستاذ الموردين (خصوم متداولة) غير معرف.');

      description = `إثبات الأرصدة الافتتاحية للموردين مستند رقم #${docNo}`;
      
      const debits = activeSuppliers.reduce((acc, curr) => acc + curr.debit, 0);
      const credits = activeSuppliers.reduce((acc, curr) => acc + curr.credit, 0);
      const netValue = credits - debits;

      if (netValue > 0) {
        lines = [
          { accountId: equityAccount.id, accountName: equityAccount.name, debit: netValue, credit: 0, memo: 'إثبات رصيد افتتاحي للموردين' },
          { accountId: apAccount.id, accountName: apAccount.name, debit: 0, credit: netValue, memo: 'صافي أرصدة موردين دائنة' }
        ];
      } else if (netValue < 0) {
        const absVal = Math.abs(netValue);
        lines = [
          { accountId: apAccount.id, accountName: apAccount.name, debit: absVal, credit: 0, memo: 'صافي أرصدة موردين مدينة' },
          { accountId: equityAccount.id, accountName: equityAccount.name, debit: 0, credit: absVal, memo: 'إثبات رصيد افتتاحي للموردين' }
        ];
      }
    } else if (type === 'ACCOUNTS') {
      description = `إثبات الأرصدة الافتتاحية للحسابات العامة مستند رقم #${docNo}`;
      
      const debits = activeAccounts.reduce((acc, curr) => acc + curr.debit, 0);
      const credits = activeAccounts.reduce((acc, curr) => acc + curr.credit, 0);
      const diff = debits - credits;

      activeAccounts.forEach(a => {
        if (a.debit > 0) {
          lines.push({ accountId: a.accountId, accountName: a.accountName, debit: a.debit, credit: 0, memo: `رصيد افتتاحي مدين - ${a.notes || ''}` });
        }
        if (a.credit > 0) {
          lines.push({ accountId: a.accountId, accountName: a.accountName, debit: 0, credit: a.credit, memo: `رصيد افتتاحي دائن - ${a.notes || ''}` });
        }
      });

      // Balance the entry automatically using Opening Balance Equity
      if (diff > 0) {
        lines.push({ accountId: equityAccount.id, accountName: equityAccount.name, debit: 0, credit: diff, memo: 'تسوية الفارق الحسابي الافتتاحي' });
      } else if (diff < 0) {
        lines.push({ accountId: equityAccount.id, accountName: equityAccount.name, debit: Math.abs(diff), credit: 0, memo: 'تسوية الفارق الحسابي الافتتاحي' });
      }
    }

    if (lines.length > 0) {
      await accountingService.postJournalEntry({
        date: docDate,
        reference: docId,
        description,
        status: 'POSTED',
        lines,
        createdBy: 'أرصدة افتتاحية ERP'
      });
    }
  };

  // Helper: Post reversing journal entry on cancellation
  const postReversingJournalEntry = async (docId: string, docNo: string, type: OpeningBalanceDoc['type'], value: number) => {
    try {
      const q = query(collection(db, 'journal_entries'), where('reference', '==', docId));
      const snap = await getDocs(q);
      if (snap.empty) return;

      const originalEntry = snap.docs[0].data() as JournalEntry;
      const reversedLines = originalEntry.lines.map(line => ({
        accountId: line.accountId,
        accountName: line.accountName,
        debit: line.credit, // swap
        credit: line.debit, // swap
        memo: `عكس قيد: ${line.memo || ''}`
      }));

      await accountingService.postJournalEntry({
        date: new Date().toISOString().split('T')[0],
        reference: `REV-${docId}`,
        description: `إلغاء وعكس قيد الأرصدة الافتتاحية للمستند رقم #${docNo}`,
        status: 'POSTED',
        lines: reversedLines,
        createdBy: 'أرصدة افتتاحية ERP'
      });
    } catch (err) {
      console.error('Error reversing journal entry:', err);
    }
  };

  // Approve Document (Post to Stock, Accounting, and Customers/Suppliers)
  const handleApprove = async () => {
    if (!currentDocId) {
      alert('يرجى حفظ المستند كمسودة أولاً قبل الاعتماد.');
      return;
    }

    const confirmApprove = window.confirm('هل أنت متأكد من اعتماد الرصيد الافتتاحي؟ سيؤدي هذا لتحديث المخزون وأرصدة العملاء والموردين ودفتر الأستاذ العام نهائياً.');
    if (!confirmApprove) return;

    setIsSubmitting(true);
    try {
      const docType = activeTab === 'items' ? 'ITEMS' : activeTab === 'customers' ? 'CUSTOMERS' : activeTab === 'suppliers' ? 'SUPPLIERS' : 'ACCOUNTS';
      
      // 1. DUPLICATE CHECK FOR ITEMS
      if (docType === 'ITEMS') {
        const completedDocs = pastDocs.filter(d => d.status === 'COMPLETED' && d.type === 'ITEMS' && d.warehouseId === selectedWarehouseId);
        
        let foundDuplicate = false;
        let dupName = '';
        for (const item of activeItems.filter(i => i.quantity > 0)) {
          const hasDup = completedDocs.some(d => d.items?.some(x => x.productId === item.productId));
          if (hasDup) {
            foundDuplicate = true;
            dupName = item.productName;
            break;
          }
        }

        if (foundDuplicate) {
          const forceApprove = window.confirm(`تنبيه: الصنف "${dupName}" لديه رصيد افتتاحي معتمد بالفعل في هذا المستودع. هل تريد تجاوز هذا التحذير وإضافة الرصيد مكرراً؟`);
          if (!forceApprove) {
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 2. SUBMIT STOCK MOVEMENTS (If ITEMS type)
      if (docType === 'ITEMS') {
        const selectedWh = warehouses.find(w => w.id === selectedWarehouseId);
        const isMain = selectedWarehouseId === '1' || selectedWh?.code === 'MAIN' || (selectedWh as any)?.type === 'MAIN';
        
        // Post transaction in inventory_transactions
        const txItems = activeItems.filter(i => i.quantity > 0).map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          cost: item.unitCost,
          sku: item.sku
        }));

        if (txItems.length > 0) {
          const txData = {
            type: 'RECEIPT' as const,
            status: 'COMPLETED' as const,
            toWarehouseId: selectedWarehouseId,
            items: txItems,
            reference: `رصيد افتتاحي #${docNumber}`,
            notes: `إثبات رصيد افتتاحي للمستودع: ${selectedWarehouseName}. ${docNotes}`,
            createdAt: new Date().toISOString(),
            createdBy: user?.uid || 'unknown'
          };
          
          await addDoc(collection(db, 'inventory_transactions'), txData);

          // Recalculate moving average cost and direct quantity (only if Main Warehouse)
          if (isMain) {
            for (const item of activeItems.filter(i => i.quantity > 0)) {
              const productRef = doc(db, 'products', item.productId);
              const pDoc = products.find(x => x.id === item.productId);
              if (pDoc) {
                const oldQty = pDoc.quantity || 0;
                const oldCost = pDoc.costPrice || 0;
                const newQty = oldQty + item.quantity;
                const newCost = newQty > 0 ? ((oldQty * oldCost) + (item.quantity * item.unitCost)) / newQty : item.unitCost;
                
                await updateDoc(productRef, {
                  quantity: newQty,
                  costPrice: Number(newCost.toFixed(2)),
                  updatedAt: new Date().toISOString()
                });
              }
            }
          }
        }
      }

      // 3. UPDATE CUSTOMER BALANCES (If CUSTOMERS type)
      if (docType === 'CUSTOMERS') {
        for (const c of activeCustomers.filter(x => x.debit > 0 || x.credit > 0)) {
          const customerRef = doc(db, 'customers', c.customerId);
          const delta = c.debit - c.credit;
          const currentBal = dbCustomers.find(x => x.id === c.customerId)?.balance || 0;
          await updateDoc(customerRef, {
            balance: currentBal + delta
          });
        }
      }

      // 4. UPDATE SUPPLIER BALANCES (If SUPPLIERS type)
      if (docType === 'SUPPLIERS') {
        for (const s of activeSuppliers.filter(x => x.debit > 0 || x.credit > 0)) {
          const supplierRef = doc(db, 'suppliers', s.supplierId);
          const delta = s.credit - s.debit;
          const currentBal = dbSuppliers.find(x => x.id === s.supplierId)?.balance || 0;
          await updateDoc(supplierRef, {
            balance: currentBal + delta
          });
        }
      }

      // 5. UPDATE GL ACCOUNT BALANCES (If ACCOUNTS type)
      if (docType === 'ACCOUNTS') {
        for (const a of activeAccounts.filter(x => x.debit > 0 || x.credit > 0)) {
          const accountRef = doc(db, 'accounts', a.accountId);
          const accountDoc = dbAccounts.find(x => x.id === a.accountId);
          if (accountDoc) {
            const currentBal = accountDoc.balance || 0;
            const delta = a.debit - a.credit; // Balance is Debit nature, adjusted by difference
            const nextBal = currentBal + delta;
            
            await updateDoc(accountRef, {
              openingBalance: a.debit > 0 ? a.debit : -a.credit,
              balance: nextBal,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      // 6. POST JOURNAL ENTRY TO GENERAL LEDGER
      await postOpeningJournalEntry(currentDocId, docNumber, docType, worksheetTotals.totalVal);

      // 7. MARK OP DOC AS COMPLETED
      await updateDoc(doc(db, 'opening_balances', currentDocId), {
        status: 'COMPLETED',
        approvedAt: new Date().toISOString(),
        approvedBy: user?.uid,
        approvedByName: user?.name
      });

      // 8. LOG ACTIVITY
      await auditService.logActivity({
        userId: user?.uid || '',
        userName: user?.name || '',
        userEmail: user?.email || '',
        action: 'اعتماد رصيد افتتاحي',
        details: `تم اعتماد وترحيل قيد الأرصدة الافتتاحية للمستند رقم ${docNumber} لحسابات الـ ${docType} بقيمة إجمالية ${formatCurrency(worksheetTotals.totalVal)}`,
        referenceId: currentDocId
      });

      setDocStatus('COMPLETED');
      setSuccessMessage('تم اعتماد وتفعيل الأرصدة الافتتاحية بنجاح!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      alert(`حدث خطأ أثناء الاعتماد: ${e.message || 'خطأ غير معروف'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revert/Cancel Approved Document
  const handleCancelApproval = async () => {
    if (!currentDocId) return;

    const confirmCancel = window.confirm('⚠️ تحذير: هل أنت متأكد من إلغاء اعتماد هذا المستند؟ سيتم عكس قيود الحسابات وإرجاع أرصدة المخزون والعملاء والموردين لقيمتها الدفترية السابقة.');
    if (!confirmCancel) return;

    setIsSubmitting(true);
    try {
      const docType = activeTab === 'items' ? 'ITEMS' : activeTab === 'customers' ? 'CUSTOMERS' : activeTab === 'suppliers' ? 'SUPPLIERS' : 'ACCOUNTS';

      // 1. REVERT STOCK LEVELS (If ITEMS type)
      if (docType === 'ITEMS') {
        const selectedWh = warehouses.find(w => w.id === selectedWarehouseId);
        const isMain = selectedWarehouseId === '1' || selectedWh?.code === 'MAIN' || (selectedWh as any)?.type === 'MAIN';
        
        // Find and cancel receipt transaction in inventory_transactions
        const q = query(collection(db, 'inventory_transactions'), where('reference', '==', `رصيد افتتاحي #${docNumber}`));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await updateDoc(doc(db, 'inventory_transactions', docSnap.id), {
            status: 'CANCELLED'
          });
        }

        // If Main Warehouse, subtract the quantities from products doc
        if (isMain) {
          for (const item of activeItems.filter(i => i.quantity > 0)) {
            const productRef = doc(db, 'products', item.productId);
            const pDoc = products.find(x => x.id === item.productId);
            if (pDoc) {
              const oldQty = pDoc.quantity || 0;
              const nextQty = Math.max(0, oldQty - item.quantity);
              
              // We won't reverse average cost calculations (too complex and might corrupt current sales), just lower stock levels
              await updateDoc(productRef, {
                quantity: nextQty,
                updatedAt: new Date().toISOString()
              });
            }
          }
        }
      }

      // 2. REVERT CUSTOMER BALANCES (If CUSTOMERS type)
      if (docType === 'CUSTOMERS') {
        for (const c of activeCustomers.filter(x => x.debit > 0 || x.credit > 0)) {
          const customerRef = doc(db, 'customers', c.customerId);
          const delta = c.debit - c.credit;
          const currentBal = dbCustomers.find(x => x.id === c.customerId)?.balance || 0;
          await updateDoc(customerRef, {
            balance: Math.max(0, currentBal - delta)
          });
        }
      }

      // 3. REVERT SUPPLIER BALANCES (If SUPPLIERS type)
      if (docType === 'SUPPLIERS') {
        for (const s of activeSuppliers.filter(x => x.debit > 0 || x.credit > 0)) {
          const supplierRef = doc(db, 'suppliers', s.supplierId);
          const delta = s.credit - s.debit;
          const currentBal = dbSuppliers.find(x => x.id === s.supplierId)?.balance || 0;
          await updateDoc(supplierRef, {
            balance: Math.max(0, currentBal - delta)
          });
        }
      }

      // 4. REVERT GL ACCOUNT BALANCES (If ACCOUNTS type)
      if (docType === 'ACCOUNTS') {
        for (const a of activeAccounts.filter(x => x.debit > 0 || x.credit > 0)) {
          const accountRef = doc(db, 'accounts', a.accountId);
          const accountDoc = dbAccounts.find(x => x.id === a.accountId);
          if (accountDoc) {
            const currentBal = accountDoc.balance || 0;
            const delta = a.debit - a.credit;
            const nextBal = currentBal - delta;
            
            await updateDoc(accountRef, {
              openingBalance: 0,
              balance: nextBal,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      // 5. POST REVERSING JOURNAL ENTRY TO GL
      await postReversingJournalEntry(currentDocId, docNumber, docType, worksheetTotals.totalVal);

      // 6. MARK OP DOC AS CANCELLED
      await updateDoc(doc(db, 'opening_balances', currentDocId), {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancelledBy: user?.uid,
        cancelledByName: user?.name
      });

      // 7. LOG ACTIVITY
      await auditService.logActivity({
        userId: user?.uid || '',
        userName: user?.name || '',
        userEmail: user?.email || '',
        action: 'إلغاء اعتماد رصيد افتتاحي',
        details: `تم إلغاء المستند رقم ${docNumber} بالكامل وعكس القيود والتسويات الحسابية`,
        referenceId: currentDocId
      });

      setDocStatus('CANCELLED');
      setSuccessMessage('تم إلغاء المستند وعكس القيود بنجاح!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      alert(`حدث خطأ أثناء إلغاء الاعتماد: ${e.message || 'خطأ غير معروف'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Draft Document
  const handleDeleteDoc = async (docId: string) => {
    const confirmDel = window.confirm('هل تريد حذف هذه المسودة نهائياً؟');
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'opening_balances', docId));
      if (currentDocId === docId) {
        handleNewDocument();
      }
      alert('تم حذف مسودة المستند بنجاح.');
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حذف المسودة.');
    }
  };

  // Load selected document from Archive
  const handleLoadDocument = (docVal: OpeningBalanceDoc) => {
    setCurrentDocId(docVal.id);
    setDocNumber(docVal.docNumber);
    setDocDate(docVal.date);
    setDocStatus(docVal.status);
    setDocNotes(docVal.notes || '');
    
    const tabMap: Record<OpeningBalanceDoc['type'], typeof activeTab> = {
      ITEMS: 'items',
      CUSTOMERS: 'customers',
      SUPPLIERS: 'suppliers',
      ACCOUNTS: 'accounts'
    };

    const tab = tabMap[docVal.type];
    setActiveTab(tab);

    if (docVal.type === 'ITEMS') {
      setSelectedWarehouseId(docVal.warehouseId || '');
      setActiveItems(docVal.items || []);
    } else if (docVal.type === 'CUSTOMERS') {
      setActiveCustomers(docVal.customers || []);
    } else if (docVal.type === 'SUPPLIERS') {
      setActiveSuppliers(docVal.suppliers || []);
    } else if (docVal.type === 'ACCOUNTS') {
      setActiveAccounts(docVal.accounts || []);
    }
  };

  // Copy Existing Document to new draft
  const handleCopyDocument = () => {
    if (!currentDocId) return;
    setCurrentDocId(null);
    setDocStatus('DRAFT');
    setDocNumber(`OP-${String(pastDocs.length + 1).padStart(5, '0')}`);
    setDocNotes(`نسخة مكررة من المستند السابق #${docNumber}. ${docNotes}`);
    alert('تم نسخ تفاصيل المستند كمسودة جديدة. يمكنك تعديلها وحفظها.');
  };

  // CSV Export Worksheet
  const handleExportCSV = () => {
    if (activeTab === 'items' && activeItems.length === 0) return alert('لا توجد أصناف لتصديرها.');
    if (activeTab === 'customers' && activeCustomers.length === 0) return alert('لا يوجد عملاء لتصديرهم.');
    if (activeTab === 'suppliers' && activeSuppliers.length === 0) return alert('لا يوجد موردين لتصديرهم.');
    if (activeTab === 'accounts' && activeAccounts.length === 0) return alert('لا توجد حسابات لتصديرها.');

    let headers: string[] = [];
    let rows: any[][] = [];
    let fileName = '';

    if (activeTab === 'items') {
      headers = ['الباركود', 'كود الصنف', 'اسم الصنف', 'الكمية الافتتاحية', 'تكلفة الوحدة', 'موقع التخزين', 'ملاحظات'];
      rows = activeItems.map(i => [i.barcode, i.sku, i.productName, i.quantity, i.unitCost, i.location || '', i.notes || '']);
      fileName = `رصيد_افتتاحي_أصناف_${docNumber}`;
    } else if (activeTab === 'customers') {
      headers = ['معرف العميل', 'اسم العميل', 'رقم الهاتف', 'الرصيد المدين', 'الرصيد الدائن', 'ملاحظات'];
      rows = activeCustomers.map(c => [c.customerId, c.customerName, c.customerPhone, c.debit, c.credit, c.notes || '']);
      fileName = `رصيد_افتتاحي_عملاء_${docNumber}`;
    } else if (activeTab === 'suppliers') {
      headers = ['معرف المورد', 'اسم المورد', 'رقم الهاتف', 'الرصيد المدين', 'الرصيد الدائن', 'ملاحظات'];
      rows = activeSuppliers.map(s => [s.supplierId, s.supplierName, s.supplierPhone, s.debit, s.credit, s.notes || '']);
      fileName = `رصيد_افتتاحي_موردين_${docNumber}`;
    } else if (activeTab === 'accounts') {
      headers = ['كود الحساب', 'اسم الحساب', 'الرصيد المدين', 'الرصيد الدائن', 'ملاحظات'];
      rows = activeAccounts.map(a => [a.accountCode, a.accountName, a.debit, a.credit, a.notes || '']);
      fileName = `رصيد_افتتاحي_حسابات_${docNumber}`;
    }

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import Worksheet
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length < 2) return alert('ملف CSV غير صالح أو فارغ.');

        const separator = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.replace(/^"|"$/g, '').trim());

        const getIdx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k)));

        if (activeTab === 'items') {
          const barcodeIdx = getIdx(['باركود', 'barcode']);
          const skuIdx = getIdx(['sku', 'كود']);
          const qtyIdx = getIdx(['كمية', 'quantity', 'الافتتاحية']);
          const costIdx = getIdx(['تكلفة', 'cost', 'سعر']);
          const locIdx = getIdx(['موقع', 'location', 'تخزين']);

          if (qtyIdx === -1) return alert('لم يتم العثور على عمود "الكمية الافتتاحية".');

          const updates: Record<string, { qty: number; cost?: number; loc?: string }> = {};
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(separator).map(c => c.replace(/^"|"$/g, '').trim());
            const barcode = barcodeIdx !== -1 ? cols[barcodeIdx] : '';
            const sku = skuIdx !== -1 ? cols[skuIdx] : '';
            const qty = Number(cols[qtyIdx]) || 0;
            const cost = costIdx !== -1 ? Number(cols[costIdx]) : undefined;
            const loc = locIdx !== -1 ? cols[locIdx] : '';

            const key = barcode || sku;
            if (key) {
              updates[key] = { qty, cost, loc };
            }
          }

          setActiveItems(prev => prev.map(item => {
            const match = updates[item.barcode] || updates[item.sku];
            if (match) {
              const qty = Math.max(0, match.qty);
              const cost = match.cost !== undefined ? Math.max(0, match.cost) : item.unitCost;
              return {
                ...item,
                quantity: qty,
                unitCost: cost,
                totalValue: qty * cost,
                location: match.loc || item.location
              };
            }
            return item;
          }));
          alert('تم استيراد كميات الأصناف وتحديث جدول العمل المفتوح بنجاح!');
        } else if (activeTab === 'customers' || activeTab === 'suppliers') {
          const idIdx = getIdx(['معرف', 'id']);
          const nameIdx = getIdx(['اسم', 'name']);
          const debIdx = getIdx(['مدين', 'debit']);
          const credIdx = getIdx(['دائن', 'credit']);

          if (debIdx === -1 && credIdx === -1) return alert('لم يتم العثور على أعمدة ماليّة (مدين/دائن) بالملف.');

          const updates: Record<string, { deb: number; cred: number }> = {};
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(separator).map(c => c.replace(/^"|"$/g, '').trim());
            const identifier = idIdx !== -1 ? cols[idIdx] : (nameIdx !== -1 ? cols[nameIdx] : '');
            const deb = debIdx !== -1 ? Number(cols[debIdx]) || 0 : 0;
            const cred = credIdx !== -1 ? Number(cols[credIdx]) || 0 : 0;

            if (identifier) {
              updates[identifier] = { deb, cred };
            }
          }

          if (activeTab === 'customers') {
            setActiveCustomers(prev => prev.map(c => {
              const match = updates[c.customerId] || updates[c.customerName];
              if (match) {
                return { ...c, debit: match.deb, credit: match.cred };
              }
              return c;
            }));
          } else {
            setActiveSuppliers(prev => prev.map(s => {
              const match = updates[s.supplierId] || updates[s.supplierName];
              if (match) {
                return { ...s, debit: match.deb, credit: match.cred };
              }
              return s;
            }));
          }
          alert('تم استيراد الأرصدة الافتتاحية للشركاء بنجاح!');
        } else if (activeTab === 'accounts') {
          const codeIdx = getIdx(['كود', 'code', 'رقم']);
          const debIdx = getIdx(['مدين', 'debit']);
          const credIdx = getIdx(['دائن', 'credit']);

          const updates: Record<string, { deb: number; cred: number }> = {};
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(separator).map(c => c.replace(/^"|"$/g, '').trim());
            const code = codeIdx !== -1 ? cols[codeIdx] : '';
            const deb = debIdx !== -1 ? Number(cols[debIdx]) || 0 : 0;
            const cred = credIdx !== -1 ? Number(cols[credIdx]) || 0 : 0;

            if (code) {
              updates[code] = { deb, cred };
            }
          }

          setActiveAccounts(prev => prev.map(a => {
            const match = updates[a.accountCode];
            if (match) {
              return { ...a, debit: match.deb, credit: match.cred };
            }
            return a;
          }));
          alert('تم استيراد ميزان المراجعة والأرصدة الافتتاحية للحسابات بنجاح!');
        }
      } catch (err) {
        console.error(err);
        alert('فشل قراءة ملف CSV. تأكد من تطابق الصيغة وعناوين الأعمدة.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Helper: print page
  const handlePrint = () => {
    window.print();
  };

  // Reports data computations
  const reportSummary = useMemo(() => {
    const itemsTotal = pastDocs
      .filter(d => d.status === 'COMPLETED' && d.type === 'ITEMS')
      .reduce((s, c) => s + c.totalAmount, 0);

    const customersTotalDebit = pastDocs
      .filter(d => d.status === 'COMPLETED' && d.type === 'CUSTOMERS')
      .reduce((s, c) => s + (c.customers?.reduce((sum, curr) => sum + curr.debit, 0) || 0), 0);

    const customersTotalCredit = pastDocs
      .filter(d => d.status === 'COMPLETED' && d.type === 'CUSTOMERS')
      .reduce((s, c) => s + (c.customers?.reduce((sum, curr) => sum + curr.credit, 0) || 0), 0);

    const suppliersTotalDebit = pastDocs
      .filter(d => d.status === 'COMPLETED' && d.type === 'SUPPLIERS')
      .reduce((s, c) => s + (c.suppliers?.reduce((sum, curr) => sum + curr.debit, 0) || 0), 0);

    const suppliersTotalCredit = pastDocs
      .filter(d => d.status === 'COMPLETED' && d.type === 'SUPPLIERS')
      .reduce((s, c) => s + (c.suppliers?.reduce((sum, curr) => sum + curr.credit, 0) || 0), 0);

    const accountsTotalDebit = pastDocs
      .filter(d => d.status === 'COMPLETED' && d.type === 'ACCOUNTS')
      .reduce((s, c) => s + (c.accounts?.reduce((sum, curr) => sum + curr.debit, 0) || 0), 0);

    const accountsTotalCredit = pastDocs
      .filter(d => d.status === 'COMPLETED' && d.type === 'ACCOUNTS')
      .reduce((s, c) => s + (c.accounts?.reduce((sum, curr) => sum + curr.credit, 0) || 0), 0);

    return {
      itemsTotal,
      customersNet: customersTotalDebit - customersTotalCredit,
      suppliersNet: suppliersTotalCredit - suppliersTotalDebit,
      accountsTotalDebit,
      accountsTotalCredit
    };
  }, [pastDocs]);

  return (
    <div className="space-y-8 pb-32 print:p-0 print:space-y-4" dir="rtl">
      
      {/* ─── Header Section ─── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-20"></div>
        
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <Layers className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">الأرصدة الافتتاحية للمؤسسة</h2>
                <p className="text-gray-400 text-xs font-bold mt-1">تهيئة أرصدة المخزون، الحسابات، العملاء، والموردين (ERP Setup)</p>
             </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl relative z-10 w-full lg:w-auto">
          {[
            { id: 'items', label: 'رصيد الأصناف', icon: Package },
            { id: 'customers', label: 'أرصدة العملاء', icon: Users },
            { id: 'suppliers', label: 'أرصدة الموردين', icon: Building2 },
            { id: 'accounts', label: 'أرصدة الحسابات', icon: CreditCard },
            { id: 'reports', label: 'ملخصات وتقارير', icon: FileText },
            { id: 'archive', label: 'السجلات والأرشيف', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === tab.id 
                  ? "bg-white text-indigo-600 shadow-sm border border-indigo-50" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Bento Summary Stats Bar ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 print:grid-cols-3">
        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 shrink-0 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
            <Package className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">الرصيد المفتوح للأصناف</p>
            <p className="text-sm font-black text-gray-900 truncate">{formatCurrency(reportSummary.itemsTotal)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Users className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">صافي أرصدة العملاء</p>
            <p className="text-sm font-black text-blue-600 truncate">{formatCurrency(reportSummary.customersNet)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 shrink-0 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">صافي أرصدة الموردين</p>
            <p className="text-sm font-black text-amber-600 truncate">{formatCurrency(reportSummary.suppliersNet)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 shrink-0 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">إجمالي الحسابات (مدين)</p>
            <p className="text-sm font-black text-green-600 truncate">{formatCurrency(reportSummary.accountsTotalDebit)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 shrink-0 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <TrendingDown className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">إجمالي الحسابات (دائن)</p>
            <p className="text-sm font-black text-purple-600 truncate">{formatCurrency(reportSummary.accountsTotalCredit)}</p>
          </div>
        </div>
      </div>

      {/* ─── Tabs Worksheet Editors ─── */}
      {activeTab !== 'reports' && activeTab !== 'archive' && (
        <div className="space-y-6">
          
          {/* Metadata & Operations Panel */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 space-y-6 print:hidden">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              
              {/* Document Fields */}
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-transparent flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400">رقم السند:</span>
                  <span className="text-xs font-black text-slate-700">{docNumber}</span>
                </div>
                <input 
                  type="date"
                  disabled={docStatus !== 'DRAFT'}
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="bg-slate-50 border-none rounded-2xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all cursor-pointer"
                />
                
                {/* Warehouse picker (only for ITEMS tab) */}
                {activeTab === 'items' && (
                  <div className="relative">
                    <WarehouseIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      disabled={!!restrictedBranchId || docStatus !== 'DRAFT'}
                      className="bg-slate-50 border-none rounded-2xl pr-10 pl-4 py-3 text-xs font-bold outline-none cursor-pointer focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all disabled:opacity-60"
                    >
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Collapsible search panel button */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="bg-slate-50 text-slate-600 px-4 py-3 rounded-2xl text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-2"
                >
                  <Filter className="w-3.5 h-3.5" />
                  خيارات البحث والتصفية
                  {showFilters ? '▲' : '▼'}
                </button>
              </div>

              {/* Status & CSV buttons */}
              <div className="flex items-center gap-2 w-full lg:w-auto lg:justify-end">
                <span className={cn(
                  "text-[10px] font-black px-4 py-2.5 rounded-xl border tracking-wide uppercase",
                  docStatus === 'DRAFT' && 'bg-slate-50 text-slate-500 border-slate-200',
                  docStatus === 'COMPLETED' && 'bg-emerald-50 text-emerald-600 border-emerald-200',
                  docStatus === 'CANCELLED' && 'bg-red-50 text-red-600 border-red-200'
                )}>
                  حالة السند: {docStatus === 'DRAFT' ? 'مسودة' : docStatus === 'COMPLETED' ? 'معتمد ومرحل' : 'ملغى'}
                </span>

                <button onClick={handlePrint} className="bg-slate-50 text-slate-600 p-3 rounded-2xl hover:bg-slate-100 transition-all shadow-sm" title="طباعة الورقة"><Printer className="w-4 h-4" /></button>
                <button onClick={handleExportCSV} className="bg-slate-50 text-slate-600 p-3 rounded-2xl hover:bg-slate-100 transition-all shadow-sm" title="تصدير Excel/CSV"><Download className="w-4 h-4" /></button>
                
                {docStatus === 'DRAFT' && (
                  <>
                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="bg-slate-50 text-slate-600 p-3 rounded-2xl hover:bg-slate-100 transition-all shadow-sm" title="استيراد Excel/CSV"><UploadIcon className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>

            {/* Collapsible search inputs */}
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
                        placeholder="ابحث بالاسم، الكود، أو الباركود... (اكتب * لتحميل كافة البيانات)"
                        className="w-full bg-slate-50 border-none rounded-2xl pr-10 pl-4 py-3 text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    {activeTab === 'items' && (
                      <>
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
                          <option value="">كل الماركات (البراند)</option>
                          {dbBrands.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </>
                    )}
                  </div>

                  {docStatus === 'DRAFT' && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          if (activeTab === 'items') handleLoadItems();
                          else if (activeTab === 'customers') handleLoadCustomers();
                          else if (activeTab === 'suppliers') handleLoadSuppliers();
                          else if (activeTab === 'accounts') handleLoadAccounts();
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-3.5 rounded-2xl text-xs transition-all shadow-md shadow-indigo-100"
                      >
                        تحميل البيانات وتعبئة الجدول
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Worksheet Spreadsheet Grid */}
          <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col print:border-none print:shadow-none">
            <div className="p-6 border-b border-gray-50 bg-gray-50/20 flex justify-between items-center print:border-b-2 print:border-slate-300">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2 print:text-sm">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600 print:hidden" />
                ورقة عمل الأرصدة الافتتاحية: <span className="text-indigo-600">
                  {activeTab === 'items' ? `أرصدة الأصناف بالمخزن (${selectedWarehouseName})` :
                   activeTab === 'customers' ? 'أرصدة حسابات العملاء' :
                   activeTab === 'suppliers' ? 'أرصدة حسابات الموردين' : 'الحسابات المالية والأستاذ العام'}
                </span>
              </h3>
              <div className="text-xs font-bold text-gray-400 print:hidden">
                عدد السجلات: {
                  activeTab === 'items' ? activeItems.length :
                  activeTab === 'customers' ? activeCustomers.length :
                  activeTab === 'suppliers' ? activeSuppliers.length : activeAccounts.length
                }
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              
              {/* Tab 1: ITEMS Table */}
              {activeTab === 'items' && (
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-black border-b border-slate-100">
                      <th className="px-4 py-4 w-12 text-center">#</th>
                      <th className="px-4 py-4">كود الصنف / الباركود</th>
                      <th className="px-4 py-4">اسم الصنف</th>
                      <th className="px-4 py-4">الوحدة / التصنيف</th>
                      <th className="px-4 py-4 w-32 text-center">الكمية الافتتاحية</th>
                      <th className="px-4 py-4 w-32 text-center">تكلفة الوحدة</th>
                      <th className="px-4 py-4 w-32 text-center">إجمالي القيمة</th>
                      <th className="px-4 py-4 w-36">موقع التخزين</th>
                      <th className="px-4 py-4 print:hidden">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {activeItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-24 text-center">
                          <Package className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                          <h4 className="text-slate-400 text-sm font-black">جدول الأصناف فارغ</h4>
                          <p className="text-slate-400 text-xs mt-1">الرجاء فتح خيارات البحث والضغط على "تحميل الأصناف وتعبئة الجدول" لبدء الإدخال.</p>
                        </td>
                      </tr>
                    ) : (
                      activeItems.map((item, idx) => (
                        <tr key={item.productId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="text-slate-900 font-black">{item.sku}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.barcode}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-800 text-sm">{item.productName}</td>
                          <td className="px-4 py-3">
                            <span className="text-slate-500">{item.unit}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{item.category} • {item.brand}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center print:hidden">
                              <input 
                                type="number"
                                min={0}
                                disabled={docStatus !== 'DRAFT'}
                                value={item.quantity || ''}
                                onChange={(e) => handleItemCellChange(item.productId, 'quantity', e.target.value)}
                                className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-black outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50"
                              />
                            </div>
                            <p className="hidden print:block text-center font-black">{item.quantity}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center print:hidden">
                              <input 
                                type="number"
                                min={0}
                                disabled={docStatus !== 'DRAFT'}
                                value={item.unitCost || ''}
                                onChange={(e) => handleItemCellChange(item.productId, 'unitCost', e.target.value)}
                                className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-black outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50"
                              />
                            </div>
                            <p className="hidden print:block text-center font-black">{formatCurrency(item.unitCost)}</p>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-900 font-sans font-black">
                            {formatCurrency(item.totalValue)}
                          </td>
                          <td className="px-4 py-3">
                            <input 
                              type="text"
                              placeholder="موقع الرف..."
                              disabled={docStatus !== 'DRAFT'}
                              value={item.location || ''}
                              onChange={(e) => handleItemCellChange(item.productId, 'location', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent focus:border-slate-300 outline-none py-1"
                            />
                          </td>
                          <td className="px-4 py-3 print:hidden">
                            <input 
                              type="text"
                              placeholder="ملاحظات..."
                              disabled={docStatus !== 'DRAFT'}
                              value={item.notes || ''}
                              onChange={(e) => handleItemCellChange(item.productId, 'notes', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent focus:border-slate-300 outline-none py-1"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* Tab 2: CUSTOMERS Table */}
              {activeTab === 'customers' && (
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-black border-b border-slate-100">
                      <th className="px-4 py-4 w-12 text-center">#</th>
                      <th className="px-4 py-4">اسم العميل</th>
                      <th className="px-4 py-4">رقم الهاتف</th>
                      <th className="px-4 py-4 w-36 text-center">رصيد مدين (له)</th>
                      <th className="px-4 py-4 w-36 text-center">رصيد دائن (عليه)</th>
                      <th className="px-4 py-4 print:hidden">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {activeCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-24 text-center">
                          <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                          <h4 className="text-slate-400 text-sm font-black">جدول العملاء فارغ</h4>
                          <p className="text-slate-400 text-xs mt-1">الرجاء فتح خيارات البحث والضغط على "تحميل البيانات وتعبئة الجدول".</p>
                        </td>
                      </tr>
                    ) : (
                      activeCustomers.map((c, idx) => (
                        <tr key={c.customerId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-slate-900 text-sm">{c.customerName}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono">{c.customerPhone}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center print:hidden">
                              <input 
                                type="number"
                                min={0}
                                disabled={docStatus !== 'DRAFT'}
                                value={c.debit || ''}
                                onChange={(e) => handleCustomerCellChange(c.customerId, 'debit', e.target.value)}
                                className="w-32 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-black outline-none focus:border-indigo-600 focus:ring-4"
                              />
                            </div>
                            <p className="hidden print:block text-center font-black">{formatCurrency(c.debit)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center print:hidden">
                              <input 
                                type="number"
                                min={0}
                                disabled={docStatus !== 'DRAFT'}
                                value={c.credit || ''}
                                onChange={(e) => handleCustomerCellChange(c.customerId, 'credit', e.target.value)}
                                className="w-32 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-black outline-none focus:border-indigo-600 focus:ring-4"
                              />
                            </div>
                            <p className="hidden print:block text-center font-black">{formatCurrency(c.credit)}</p>
                          </td>
                          <td className="px-4 py-3 print:hidden">
                            <input 
                              type="text"
                              placeholder="اكتب ملاحظة..."
                              disabled={docStatus !== 'DRAFT'}
                              value={c.notes || ''}
                              onChange={(e) => handleCustomerCellChange(c.customerId, 'notes', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent focus:border-slate-300 outline-none py-1"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* Tab 3: SUPPLIERS Table */}
              {activeTab === 'suppliers' && (
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-black border-b border-slate-100">
                      <th className="px-4 py-4 w-12 text-center">#</th>
                      <th className="px-4 py-4">اسم المورد</th>
                      <th className="px-4 py-4">رقم الهاتف</th>
                      <th className="px-4 py-4 w-36 text-center">رصيد مدين (له)</th>
                      <th className="px-4 py-4 w-36 text-center">رصيد دائن (عليه)</th>
                      <th className="px-4 py-4 print:hidden">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {activeSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-24 text-center">
                          <Building2 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                          <h4 className="text-slate-400 text-sm font-black">جدول الموردين فارغ</h4>
                          <p className="text-slate-400 text-xs mt-1">الرجاء فتح خيارات البحث والضغط على "تحميل البيانات وتعبئة الجدول".</p>
                        </td>
                      </tr>
                    ) : (
                      activeSuppliers.map((s, idx) => (
                        <tr key={s.supplierId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-slate-900 text-sm">{s.supplierName}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono">{s.supplierPhone || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center print:hidden">
                              <input 
                                type="number"
                                min={0}
                                disabled={docStatus !== 'DRAFT'}
                                value={s.debit || ''}
                                onChange={(e) => handleSupplierCellChange(s.supplierId, 'debit', e.target.value)}
                                className="w-32 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-black outline-none focus:border-indigo-600 focus:ring-4"
                              />
                            </div>
                            <p className="hidden print:block text-center font-black">{formatCurrency(s.debit)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center print:hidden">
                              <input 
                                type="number"
                                min={0}
                                disabled={docStatus !== 'DRAFT'}
                                value={s.credit || ''}
                                onChange={(e) => handleSupplierCellChange(s.supplierId, 'credit', e.target.value)}
                                className="w-32 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-black outline-none focus:border-indigo-600 focus:ring-4"
                              />
                            </div>
                            <p className="hidden print:block text-center font-black">{formatCurrency(s.credit)}</p>
                          </td>
                          <td className="px-4 py-3 print:hidden">
                            <input 
                              type="text"
                              placeholder="اكتب ملاحظة..."
                              disabled={docStatus !== 'DRAFT'}
                              value={s.notes || ''}
                              onChange={(e) => handleSupplierCellChange(s.supplierId, 'notes', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent focus:border-slate-300 outline-none py-1"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* Tab 4: ACCOUNTS Table */}
              {activeTab === 'accounts' && (
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-black border-b border-slate-100">
                      <th className="px-4 py-4 w-12 text-center">#</th>
                      <th className="px-4 py-4 w-28">كود الحساب</th>
                      <th className="px-4 py-4">اسم الحساب</th>
                      <th className="px-4 py-4 w-36 text-center">مدين Debit</th>
                      <th className="px-4 py-4 w-36 text-center">دائن Credit</th>
                      <th className="px-4 py-4 print:hidden">ملاحظات توضيحية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {activeAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-24 text-center">
                          <CreditCard className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                          <h4 className="text-slate-400 text-sm font-black">جدول الحسابات فارغ</h4>
                          <p className="text-slate-400 text-xs mt-1">الرجاء فتح خيارات البحث والضغط على "تحميل البيانات وتعبئة الجدول".</p>
                        </td>
                      </tr>
                    ) : (
                      activeAccounts.map((a, idx) => (
                        <tr key={a.accountId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-indigo-600 font-mono text-xs">{a.accountCode}</td>
                          <td className="px-4 py-3 text-slate-900 text-sm">{a.accountName}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center print:hidden">
                              <input 
                                type="number"
                                min={0}
                                disabled={docStatus !== 'DRAFT'}
                                value={a.debit || ''}
                                onChange={(e) => handleAccountCellChange(a.accountId, 'debit', e.target.value)}
                                className="w-32 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-black outline-none focus:border-indigo-600 focus:ring-4"
                              />
                            </div>
                            <p className="hidden print:block text-center font-black">{formatCurrency(a.debit)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center print:hidden">
                              <input 
                                type="number"
                                min={0}
                                disabled={docStatus !== 'DRAFT'}
                                value={a.credit || ''}
                                onChange={(e) => handleAccountCellChange(a.accountId, 'credit', e.target.value)}
                                className="w-32 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-black outline-none focus:border-indigo-600 focus:ring-4"
                              />
                            </div>
                            <p className="hidden print:block text-center font-black">{formatCurrency(a.credit)}</p>
                          </td>
                          <td className="px-4 py-3 print:hidden">
                            <input 
                              type="text"
                              placeholder="اكتب تفاصيل القيد..."
                              disabled={docStatus !== 'DRAFT'}
                              value={a.notes || ''}
                              onChange={(e) => handleAccountCellChange(a.accountId, 'notes', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent focus:border-slate-300 outline-none py-1"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

            </div>

            {/* Document summary notes on bottom */}
            {(activeItems.length > 0 || activeCustomers.length > 0 || activeSuppliers.length > 0 || activeAccounts.length > 0) && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">ملاحظات عامة حول السند الافتتاحي</label>
                  <textarea
                    disabled={docStatus !== 'DRAFT'}
                    rows={2}
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    placeholder="اكتب تفاصيل إضافية أو مراجع تسوية الأرصدة الافتتاحية للمستند..."
                    className="w-full bg-white border border-slate-200/80 rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 resize-none"
                  />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-center space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>إجمالي القيم المدينة:</span>
                    <span className="text-green-600 font-black">+{formatCurrency(worksheetTotals.debits)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>إجمالي القيم الدائنة:</span>
                    <span className="text-red-600 font-black">-{formatCurrency(worksheetTotals.credits)}</span>
                  </div>
                  <div className="h-px bg-slate-100 my-1" />
                  <div className="flex justify-between text-sm font-black text-slate-800">
                    <span>القيمة الصافية التقديرية:</span>
                    <span className="text-indigo-600 font-black">
                      {formatCurrency(worksheetTotals.totalVal)}
                    </span>
                  </div>

                  {activeTab === 'accounts' && worksheetTotals.debits !== worksheetTotals.credits && (
                    <div className="mt-2 text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>غير متوازن! سيتم تسوية الفرق ({formatCurrency(Math.abs(worksheetTotals.debits - worksheetTotals.credits))}) في حساب الأرصدة الافتتاحية تلقائياً.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Floating Control Bar */}
          <div className="bg-white border-t border-slate-100 py-4 px-8 fixed bottom-11 left-0 right-0 z-30 shadow-2xl flex justify-between items-center print:hidden">
            <div className="flex gap-2">
              <button
                onClick={handleNewDocument}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-5 py-3 rounded-2xl text-xs transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                مستند جديد
              </button>
              
              {currentDocId && (
                <button
                  onClick={handleCopyDocument}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-5 py-3 rounded-2xl text-xs transition-all flex items-center gap-1.5 active:scale-95"
                >
                  نسخ المستند
                </button>
              )}

              {docStatus === 'DRAFT' && (
                <button
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
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
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-3 rounded-2xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4.5 h-4.5" />
                  اعتماد الترحيل النهائي
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

      {/* ─── Tab Content 5: Reports & Analytics ─── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Stock Valuation Summary */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-4">
              <h4 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                تحليل أرصدة المخزون الافتتاحية
              </h4>
              <div className="space-y-3 font-bold text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span>إجمالي قيمة الأصناف:</span>
                  <span className="text-indigo-600 font-black">{formatCurrency(reportSummary.itemsTotal)}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50/50 rounded-xl">
                  <span>عدد الأذونات المعتمدة:</span>
                  <span>{pastDocs.filter(d => d.status === 'COMPLETED' && d.type === 'ITEMS').length} سند جرد</span>
                </div>
              </div>
            </div>

            {/* Financial Balance Summary */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-4">
              <h4 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-green-600" />
                تحليل أرصدة الحسابات وميزان المراجعة
              </h4>
              <div className="space-y-3 font-bold text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span>إجمالي الحسابات المدينة:</span>
                  <span className="text-green-600 font-black">{formatCurrency(reportSummary.accountsTotalDebit)}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span>إجمالي الحسابات الدائنة:</span>
                  <span className="text-purple-600 font-black">{formatCurrency(reportSummary.accountsTotalCredit)}</span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex justify-between p-2 text-slate-500">
                  <span>الفارق الدفتري التراكمي:</span>
                  <span className="font-sans font-black">{formatCurrency(Math.abs(reportSummary.accountsTotalDebit - reportSummary.accountsTotalCredit))}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Past transactions history breakdowns */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-5">
            <h4 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              أحدث الأرصدة المعتمدة
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="pb-3">رقم السند</th>
                    <th className="pb-3 text-center">نوع الرصيد</th>
                    <th className="pb-3 text-center">التاريخ</th>
                    <th className="pb-3 text-center">القيمة الإجمالية</th>
                    <th className="pb-3 text-left">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-bold">
                  {pastDocs.filter(d => d.status === 'COMPLETED').length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">لا توجد أرصدة افتتاحية معتمدة حالياً</td>
                    </tr>
                  ) : (
                    pastDocs.filter(d => d.status === 'COMPLETED').map(doc => (
                      <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 text-indigo-600 font-black">#{doc.docNumber}</td>
                        <td className="py-3 text-center">
                          <span className="bg-slate-50 text-slate-600 px-2.5 py-1 rounded-lg">
                            {doc.type === 'ITEMS' ? 'مخزون وأصناف' :
                             doc.type === 'CUSTOMERS' ? 'عملاء' :
                             doc.type === 'SUPPLIERS' ? 'موردين' : 'أرصدة مالية'}
                          </span>
                        </td>
                        <td className="py-3 text-center text-slate-500 font-mono">{doc.date}</td>
                        <td className="py-3 text-center font-sans font-black">{formatCurrency(doc.totalAmount)}</td>
                        <td className="py-3 text-left text-emerald-600">معتمد ومرحل</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab Content 6: Archive & History ─── */}
      {activeTab === 'archive' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* History stock takes list */}
          <div className="lg:col-span-7 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 space-y-4">
            <h4 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              أرشيف مستندات الأرصدة الافتتاحية
            </h4>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {pastDocs.length === 0 ? (
                <p className="text-slate-400 text-center py-12 text-xs font-bold">لا توجد مستندات سابقة.</p>
              ) : (
                pastDocs.map(st => (
                  <div 
                    key={st.id}
                    onClick={() => handleLoadDocument(st)}
                    className={cn(
                      "p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 relative group",
                      currentDocId === st.id 
                        ? "border-indigo-600 bg-indigo-50/10 shadow-lg shadow-indigo-50" 
                        : "border-slate-100 hover:border-slate-200 bg-white"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-black text-sm text-slate-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          مستند رقم: {st.docNumber}
                        </h5>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">النوع: {
                          st.type === 'ITEMS' ? `مخزون (مستودع ${st.warehouseName})` :
                          st.type === 'CUSTOMERS' ? 'عملاء' :
                          st.type === 'SUPPLIERS' ? 'موردين' : 'أرصدة مالية وحسابات'
                        }</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[9px] font-black px-2 py-1 rounded-lg border",
                          st.status === 'DRAFT' && 'bg-slate-50 text-slate-500 border-slate-200',
                          st.status === 'COMPLETED' && 'bg-emerald-50 text-emerald-600 border-emerald-200',
                          st.status === 'CANCELLED' && 'bg-red-50 text-red-600 border-red-200'
                        )}>
                          {st.status === 'DRAFT' ? 'مسودة' : st.status === 'COMPLETED' ? 'معتمد' : 'ملغى'}
                        </span>

                        {st.status === 'DRAFT' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDoc(st.id);
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
                        <span>التاريخ: {st.date}</span>
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
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
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
                        <span className="absolute right-0 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white translate-x-1.5" />
                        
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{log.action}</span>
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
            <div className="w-11 h-11 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
               <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex flex-col text-right">
               <span className="text-base font-black tracking-tight">{successMessage}</span>
               <span className="text-[11px] text-gray-400 font-bold">تم ترحيل البيانات بنجاح وتحديث السجلات في قاعدة البيانات.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
