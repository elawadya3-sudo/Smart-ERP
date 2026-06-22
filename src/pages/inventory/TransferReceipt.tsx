import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowDownLeft, 
  Package, 
  Search, 
  Plus, 
  Trash2, 
  Save, 
  FileText,
  CheckCircle2, 
  AlertCircle, 
  X, 
  User, 
  Building2, 
  Clock, 
  RefreshCw, 
  Printer, 
  Download, 
  ArrowRightLeft, 
  AlertTriangle,
  FileSpreadsheet,
  Lock,
  Eye,
  Check,
  TrendingDown,
  TrendingUp,
  History as HistoryIcon,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, setDoc, doc, getDocs, runTransaction, increment, addDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { cn, formatDate } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useBranchFilter } from '../../hooks/useBranchFilter';
import { Product, Warehouse, InventoryTransaction, TransferReceiptDoc, TransferReceiptItem } from '../../types';
import { auditService, notificationsService } from '../../services/firestore';

type TabType = 'NEW' | 'ARCHIVE' | 'AUDIT' | 'REPORTS';

export default function TransferReceiptPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const restrictedBranchId = useBranchFilter();

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('NEW');

  // Static Lists
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransaction[]>([]);
  const [receipts, setReceipts] = useState<TransferReceiptDoc[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search/Filters
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [selectedTransferId, setSelectedTransferId] = useState<string>('');

  // Active Worksheet Document State
  const [receiptId, setReceiptId] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiverName, setReceiverName] = useState(user?.name || '');
  const [notes, setNotes] = useState('');
  const [worksheetItems, setWorksheetItems] = useState<TransferReceiptItem[]>([]);
  const [docStatus, setDocStatus] = useState<TransferReceiptDoc['status']>('DRAFT');

  // Detailed Modal View
  const [viewingReceipt, setViewingReceipt] = useState<TransferReceiptDoc | null>(null);
  const [viewingAuditLogs, setViewingAuditLogs] = useState<any[]>([]);

  // Admin Override Trigger
  const [isAdminOverrideRequired, setIsAdminOverrideRequired] = useState(false);

  // ─── Realtime Subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    // 1. Fetch Warehouses
    const unsubW = onSnapshot(query(collection(db, 'warehouses')), snap => {
      const whList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
      if (!whList.some(w => w.id === '1')) {
        whList.unshift({
          id: '1',
          name: 'المخزن الرئيسي (Main Warehouse)',
          code: 'MAIN',
          isActive: true,
          type: 'MAIN'
        } as any);
      }
      setWarehouses(whList);
    });

    // 2. Fetch Products
    const unsubP = onSnapshot(query(collection(db, 'products')), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    // 3. Fetch Transfers
    const unsubT = onSnapshot(query(collection(db, 'inventory_transactions'), where('type', '==', 'TRANSFER')), snap => {
      setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as InventoryTransaction)));
    });

    // 4. Fetch Receipts
    const unsubR = onSnapshot(query(collection(db, 'transfer_receipts'), orderBy('createdAt', 'desc')), snap => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() } as TransferReceiptDoc)));
      setLoading(false);
    });

    // 5. Fetch Global Logs (limit for performance)
    const unsubL = onSnapshot(query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc')), snap => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(log => log.referenceId || log.action?.includes('تحويل')));
    });

    return () => {
      unsubW();
      unsubP();
      unsubT();
      unsubR();
      unsubL();
    };
  }, []);

  // Sync Receiver Name with logged-in user
  useEffect(() => {
    if (user?.name && !receiverName) {
      setReceiverName(user.name);
    }
  }, [user, receiverName]);

  // Load audit logs of viewing document
  useEffect(() => {
    if (viewingReceipt) {
      auditService.getLogsByReference(viewingReceipt.id).then(setViewingAuditLogs);
    }
  }, [viewingReceipt]);

  // ─── Calculations ─────────────────────────────────────────────────────────
  
  // Calculate received totals per TransferId
  const transferReceivedTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = {};
    
    receipts
      .filter(r => r.status === 'RECEIVED' || r.status === 'PARTIALLY_RECEIVED')
      .forEach(r => {
        if (!totals[r.transferId]) {
          totals[r.transferId] = {};
        }
        r.items.forEach(item => {
          totals[r.transferId][item.productId] = (totals[r.transferId][item.productId] || 0) + item.receivedQty;
        });
      });
      
    return totals;
  }, [receipts]);

  // Helper to check if a transfer is fully received
  const isTransferFullyReceived = (transfer: InventoryTransaction) => {
    const receivedMap = transferReceivedTotals[transfer.id] || {};
    return (transfer.items || []).every(item => {
      const receivedQty = receivedMap[item.productId] || 0;
      return receivedQty >= item.quantity;
    });
  };

  // Filter transfers for selector
  const availableTransfers = useMemo(() => {
    return transfers.filter(t => {
      // Must be approved/completed
      if (t.status !== 'COMPLETED') return false;
      
      // If branch-restricted, user must be the receiver
      if (restrictedBranchId && t.toWarehouseId !== restrictedBranchId) return false;
      
      // Exclude fully received transfers
      if (isTransferFullyReceived(t)) return false;

      // Filter by search terms
      const whFrom = warehouses.find(w => w.id === t.fromWarehouseId)?.name || '';
      const queryMatch = 
        t.id.toLowerCase().includes(transferSearchQuery.toLowerCase()) ||
        (t.reference || '').toLowerCase().includes(transferSearchQuery.toLowerCase()) ||
        whFrom.toLowerCase().includes(transferSearchQuery.toLowerCase());
      
      return queryMatch;
    });
  }, [transfers, warehouses, restrictedBranchId, transferReceivedTotals, transferSearchQuery]);

  // Load selected transfer into worksheet
  const handleSelectTransfer = (transferId: string) => {
    const t = transfers.find(item => item.id === transferId);
    if (!t) return;
    
    setSelectedTransferId(t.id);
    
    // Auto-create document metadata
    if (!receiptId) {
      setReceiptId(Math.random().toString(36).substr(2, 9));
    }
    
    // Generate sequential receipt number TR-XXXXX
    const count = receipts.length;
    setReceiptNumber(`TR-${String(count + 1).padStart(5, '0')}`);
    
    // Map items
    const receivedMap = transferReceivedTotals[t.id] || {};
    const mappedItems: TransferReceiptItem[] = (t.items || []).map(item => {
      const prod = products.find(p => p.id === item.productId);
      const previouslyReceived = receivedMap[item.productId] || 0;
      const remaining = Math.max(0, item.quantity - previouslyReceived);
      
      return {
        productId: item.productId,
        productName: item.productName || prod?.name || 'صنف غير معروف',
        sku: prod?.sku || '',
        barcode: prod?.barcode || '',
        unit: (prod as any)?.weightUnit || 'وحدة',
        transferredQty: item.quantity,
        receivedQty: remaining, // defaults to remaining
        difference: remaining - item.quantity,
        itemStatus: remaining === item.quantity ? 'MATCH' : 'DEFICIT',
        notes: ''
      };
    });
    
    setWorksheetItems(mappedItems);
    setDocStatus('DRAFT');
  };

  // Update quantity in worksheet
  const handleUpdateItemQty = (productId: string, qty: number) => {
    setWorksheetItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const diff = qty - item.transferredQty;
        let itemStatus: TransferReceiptItem['itemStatus'] = 'MATCH';
        if (qty < item.transferredQty) itemStatus = 'DEFICIT';
        if (qty > item.transferredQty) itemStatus = 'SURPLUS';
        
        return {
          ...item,
          receivedQty: qty,
          difference: diff,
          itemStatus
        };
      }
      return item;
    }));
  };

  // Update item notes in worksheet
  const handleUpdateItemNotes = (productId: string, val: string) => {
    setWorksheetItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, notes: val };
      }
      return item;
    }));
  };

  // Check if worksheet contains deficits or surpluses
  const hasDeficit = worksheetItems.some(i => i.itemStatus === 'DEFICIT');
  const hasSurplus = worksheetItems.some(i => i.itemStatus === 'SURPLUS');

  // Enforce Admin credentials check for surplus
  const isAdminUser = user?.role === 'ADMIN' || user?.isRoot;

  // ─── Actions ─────────────────────────────────────────────────────────────
  
  // Clear/Reset Worksheet
  const handleNewDoc = () => {
    setReceiptId('');
    setReceiptNumber('');
    setSelectedTransferId('');
    setNotes('');
    setWorksheetItems([]);
    setDocStatus('DRAFT');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setIsAdminOverrideRequired(false);
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    if (!selectedTransferId || worksheetItems.length === 0) return;
    setSubmitting(true);
    
    const transfer = transfers.find(t => t.id === selectedTransferId)!;
    
    const docData: TransferReceiptDoc = {
      id: receiptId || Math.random().toString(36).substr(2, 9),
      receiptNumber: receiptNumber || `TR-DRAFT-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      date: receiptDate,
      transferId: selectedTransferId,
      transferNumber: transfer.reference || transfer.id.slice(0, 8),
      fromWarehouseId: transfer.fromWarehouseId || '1',
      fromWarehouseName: warehouses.find(w => w.id === transfer.fromWarehouseId)?.name || 'المخزن الرئيسي',
      toWarehouseId: transfer.toWarehouseId || '',
      toWarehouseName: warehouses.find(w => w.id === transfer.toWarehouseId)?.name || 'مخزن الفرع',
      receiverName,
      status: 'DRAFT',
      notes,
      items: worksheetItems,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'unknown',
      createdByName: user?.name || 'مستخدم النظام'
    };

    try {
      await setDoc(doc(db, 'transfer_receipts', docData.id), docData);
      setReceiptId(docData.id);
      setReceiptNumber(docData.receiptNumber);
      alert('تم حفظ المسودة بنجاح!');
      
      // Log audit
      await auditService.logActivity({
        userId: user?.uid || '',
        userName: user?.name || '',
        userEmail: user?.email || '',
        action: 'حفظ مسودة استلام تحويل',
        details: `حفظ مسودة الاستلام رقم ${docData.receiptNumber} للتحويل ${docData.transferNumber}`,
        referenceId: docData.id
      });
    } catch (e: any) {
      console.error(e);
      alert('فشل حفظ المسودة: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Save / Approve Receipt & Commit Stock
  const handleApproveReceipt = async () => {
    if (!selectedTransferId || worksheetItems.length === 0) return;
    
    // Check surplus restrictions
    if (hasSurplus && !isAdminUser) {
      setIsAdminOverrideRequired(true);
      return;
    }

    setSubmitting(true);
    const transfer = transfers.find(t => t.id === selectedTransferId)!;
    const finalId = receiptId || Math.random().toString(36).substr(2, 9);
    
    // Auto-calculate final receipt status
    const matchedAll = worksheetItems.every(i => i.itemStatus === 'MATCH');
    const finalStatus: TransferReceiptDoc['status'] = matchedAll ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

    const docData: TransferReceiptDoc = {
      id: finalId,
      receiptNumber: receiptNumber || `TR-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      date: receiptDate,
      transferId: selectedTransferId,
      transferNumber: transfer.reference || transfer.id.slice(0, 8),
      fromWarehouseId: transfer.fromWarehouseId || '1',
      fromWarehouseName: warehouses.find(w => w.id === transfer.fromWarehouseId)?.name || 'المخزن الرئيسي',
      toWarehouseId: transfer.toWarehouseId || '',
      toWarehouseName: warehouses.find(w => w.id === transfer.toWarehouseId)?.name || 'مخزن الفرع',
      receiverName,
      status: finalStatus,
      notes,
      items: worksheetItems,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'unknown',
      createdByName: user?.name || 'مستخدم النظام',
      approvedAt: new Date().toISOString(),
      approvedBy: user?.uid || '',
      approvedByName: user?.name || ''
    };

    try {
      await runTransaction(db, async (firestoreTransaction) => {
        // Increment stock ONLY if receiving warehouse is MAIN ('1')
        if (docData.toWarehouseId === '1') {
          for (const item of docData.items) {
            const productRef = doc(db, 'products', item.productId);
            firestoreTransaction.update(productRef, {
              quantity: increment(item.receivedQty),
              updatedAt: new Date().toISOString()
            });
          }
        }
        
        // Write transfer receipt doc
        const receiptRef = doc(db, 'transfer_receipts', finalId);
        firestoreTransaction.set(receiptRef, docData);

        // Update original transfer receiving status
        const transferRef = doc(db, 'inventory_transactions', selectedTransferId);
        firestoreTransaction.update(transferRef, {
          receiptStatus: finalStatus,
          updatedAt: new Date().toISOString()
        });
      });

      // Deficit Notification & Log
      if (hasDeficit) {
        const deficits = worksheetItems.filter(i => i.itemStatus === 'DEFICIT');
        const deficitDetails = deficits.map(d => `${d.productName} (عجز: ${d.transferredQty - d.receivedQty})`).join(', ');
        
        // Create Admin Notification
        await notificationsService.add({
          title: 'عجز في استلام تحويل بضاعة',
          message: `تم تسجيل عجز في الاستلام رقم ${docData.receiptNumber} للتحويل رقم ${docData.transferNumber}. الأصناف: ${deficitDetails}`,
          type: 'TRANSFER',
          metadata: { receiptId: docData.id, transferId: docData.transferId }
        });
      }

      // Log activity
      await auditService.logActivity({
        userId: user?.uid || '',
        userName: user?.name || '',
        userEmail: user?.email || '',
        action: 'اعتماد استلام تحويل بضاعة',
        details: `اعتماد الاستلام رقم ${docData.receiptNumber} للتحويل ${docData.transferNumber}. الحالة: ${finalStatus === 'RECEIVED' ? 'مستلم بالكامل' : 'مستلم جزئياً'}. ${hasDeficit ? 'تم تسجيل عجز.' : ''} ${hasSurplus ? 'تم اعتماد كمية زائدة بصلاحية المدير.' : ''}`,
        referenceId: docData.id
      });

      alert('تم اعتماد الاستلام وتحديث المخزون بنجاح!');
      handleNewDoc();
    } catch (e: any) {
      console.error(e);
      alert('فشل اعتماد الاستلام: ' + e.message);
    } finally {
      setSubmitting(false);
      setIsAdminOverrideRequired(false);
    }
  };

  // Reject / Cancel Receipt
  const handleRejectReceipt = async () => {
    if (!selectedTransferId) return;
    if (!window.confirm('هل أنت متأكد من رفض هذا الاستلام وإبقاء حركات التحويل مفتوحة؟')) return;
    
    setSubmitting(true);
    const transfer = transfers.find(t => t.id === selectedTransferId)!;
    const finalId = receiptId || Math.random().toString(36).substr(2, 9);
    
    const docData: TransferReceiptDoc = {
      id: finalId,
      receiptNumber: receiptNumber || `TR-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      date: receiptDate,
      transferId: selectedTransferId,
      transferNumber: transfer.reference || transfer.id.slice(0, 8),
      fromWarehouseId: transfer.fromWarehouseId || '1',
      fromWarehouseName: warehouses.find(w => w.id === transfer.fromWarehouseId)?.name || 'المخزن الرئيسي',
      toWarehouseId: transfer.toWarehouseId || '',
      toWarehouseName: warehouses.find(w => w.id === transfer.toWarehouseId)?.name || 'مخزن الفرع',
      receiverName,
      status: 'REJECTED',
      notes,
      items: worksheetItems,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'unknown',
      createdByName: user?.name || 'مستخدم النظام',
      rejectedAt: new Date().toISOString(),
      rejectedBy: user?.uid || '',
      rejectedByName: user?.name || ''
    };

    try {
      await setDoc(doc(db, 'transfer_receipts', finalId), docData);
      
      // Update transfer status
      await updateDoc(doc(db, 'inventory_transactions', selectedTransferId), {
        receiptStatus: 'REJECTED',
        updatedAt: new Date().toISOString()
      });

      // Audit Log
      await auditService.logActivity({
        userId: user?.uid || '',
        userName: user?.name || '',
        userEmail: user?.email || '',
        action: 'رفض استلام تحويل بضاعة',
        details: `رفض استلام التحويل رقم ${docData.transferNumber} بموجب المستند رقم ${docData.receiptNumber}`,
        referenceId: docData.id
      });

      alert('تم رفض استلام التحويل.');
      handleNewDoc();
    } catch (e: any) {
      alert('فشل رفض المستند: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Revert / Cancel approved Receipt
  const handleCancelReceipt = async (receiptDoc: TransferReceiptDoc) => {
    if (!window.confirm(`⚠️ تحذير: هل أنت متأكد من إلغاء اعتماد مستند الاستلام ${receiptDoc.receiptNumber}؟ سيتم خصم الكميات المستلمة من أرصدة المستودع.`)) return;
    
    setSubmitting(true);
    try {
      await runTransaction(db, async (firestoreTransaction) => {
        // If target warehouse is MAIN ('1'), deduct stock
        if (receiptDoc.toWarehouseId === '1') {
          for (const item of receiptDoc.items) {
            const productRef = doc(db, 'products', item.productId);
            firestoreTransaction.update(productRef, {
              quantity: increment(-item.receivedQty),
              updatedAt: new Date().toISOString()
            });
          }
        }

        // Set status to CANCELLED
        const receiptRef = doc(db, 'transfer_receipts', receiptDoc.id);
        firestoreTransaction.update(receiptRef, {
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          cancelledBy: user?.uid || '',
          cancelledByName: user?.name || ''
        });

        // Recalculate original transfer receiptStatus
        const transferRef = doc(db, 'inventory_transactions', receiptDoc.transferId);
        firestoreTransaction.update(transferRef, {
          receiptStatus: 'CANCELLED',
          updatedAt: new Date().toISOString()
        });
      });

      // Log activity
      await auditService.logActivity({
        userId: user?.uid || '',
        userName: user?.name || '',
        userEmail: user?.email || '',
        action: 'إلغاء اعتماد استلام تحويل بضاعة',
        details: `إلغاء اعتماد الاستلام رقم ${receiptDoc.receiptNumber} للتحويل ${receiptDoc.transferNumber} وعكس كمياته من المستودع.`,
        referenceId: receiptDoc.id
      });

      alert('تم إلغاء اعتماد مستند الاستلام وعكس الحركات بنجاح.');
      setViewingReceipt(null);
    } catch (e: any) {
      console.error(e);
      alert('فشل إلغاء الاعتماد: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // CSV Export Worksheet
  const handleExportCSV = () => {
    if (worksheetItems.length === 0) return;
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'كود الصنف,الباركود,اسم الصنف,الوحدة,الكمية المحولة,الكمية المستلمة,الفرق,الحالة,ملاحظات\n';
    
    worksheetItems.forEach(i => {
      const statusLabel = i.itemStatus === 'MATCH' ? 'مطابق' : i.itemStatus === 'DEFICIT' ? 'عجز' : 'زيادة';
      csv += `${i.sku},${i.barcode},"${i.productName}",${i.unit},${i.transferredQty},${i.receivedQty},${i.difference},${statusLabel},"${i.notes || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `كشف_استلام_تحويل_${receiptNumber || 'جديد'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load a Draft into Worksheet
  const handleLoadDraft = (draft: TransferReceiptDoc) => {
    setReceiptId(draft.id);
    setReceiptNumber(draft.receiptNumber);
    setReceiptDate(draft.date);
    setSelectedTransferId(draft.transferId);
    setNotes(draft.notes || '');
    setReceiverName(draft.receiverName);
    setWorksheetItems(draft.items);
    setDocStatus('DRAFT');
    setActiveTab('NEW');
  };

  // Print Window Layout helper
  const handlePrint = (divId: string) => {
    const printContent = document.getElementById(divId);
    if (!printContent) return;
    const win = window.open('', '', 'width=900,height=650');
    win?.document.write(`
      <html dir="rtl" lang="ar">
      <head>
        <title>طباعة مستند استلام تحويل</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Cairo', sans-serif; padding: 40px; color: #1e293b; background: #fff; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
          .title { font-size: 24px; font-weight: 900; color: #0f172a; }
          .meta-grid { display: grid; grid-cols-2; display: flex; flex-wrap: wrap; justify-content: space-between; margin-bottom: 30px; }
          .meta-item { width: 45%; margin-bottom: 12px; font-size: 14px; font-weight: bold; }
          .meta-label { color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-size: 13px; }
          th { background: #f8fafc; font-weight: 900; }
          .status { font-weight: bold; padding: 4px 8px; rounded: 4px; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; }
          .signature { border-top: 1px dashed #cbd5e1; width: 150px; text-align: center; margin-top: 40px; padding-top: 10px; }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    win?.document.close();
    win?.focus();
    setTimeout(() => {
      win?.print();
      win?.close();
    }, 250);
  };

  // ─── Reports Tab Data ────────────────────────────────────────────────────
  const reportsData = useMemo(() => {
    const totalReceivedDocs = receipts.filter(r => r.status === 'RECEIVED').length;
    const totalPartialDocs = receipts.filter(r => r.status === 'PARTIALLY_RECEIVED').length;
    const totalCancelledDocs = receipts.filter(r => r.status === 'CANCELLED').length;
    const totalDeficits = receipts.reduce((acc, curr) => {
      const deficitCount = curr.items.filter(i => i.itemStatus === 'DEFICIT').reduce((sum, item) => sum + (item.transferredQty - item.receivedQty), 0);
      return acc + deficitCount;
    }, 0);

    const pendingTransfersCount = transfers.filter(t => t.status === 'COMPLETED' && !isTransferFullyReceived(t)).length;

    return {
      totalReceivedDocs,
      totalPartialDocs,
      totalCancelledDocs,
      totalDeficits,
      pendingTransfersCount
    };
  }, [receipts, transfers, isTransferFullyReceived]);

  const filteredArchiveReceipts = useMemo(() => {
    return receipts.filter(r => {
      const whFrom = r.fromWarehouseName || '';
      const whTo = r.toWarehouseName || '';
      const matchSearch = 
        r.receiptNumber.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
        r.transferNumber.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
        whFrom.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
        whTo.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
        r.receiverName.toLowerCase().includes(archiveSearchQuery.toLowerCase());
      
      return matchSearch;
    });
  }, [receipts, archiveSearchQuery]);

  const getStatusBadge = (status: TransferReceiptDoc['status']) => {
    switch (status) {
      case 'RECEIVED':
        return <span className="bg-green-50 text-green-600 border border-green-200 px-3 py-1 rounded-xl text-xs font-black">مستلم بالكامل</span>;
      case 'PARTIALLY_RECEIVED':
        return <span className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-xl text-xs font-black">مستلم جزئياً</span>;
      case 'DRAFT':
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-xl text-xs font-black">مسودة</span>;
      case 'REVIEW':
        return <span className="bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 rounded-xl text-xs font-black">قيد المراجعة</span>;
      case 'REJECTED':
        return <span className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-xl text-xs font-black">مرفوض</span>;
      case 'CANCELLED':
        return <span className="bg-gray-150 text-gray-500 border border-gray-200 px-3 py-1 rounded-xl text-xs font-black">ملغي</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 pb-20 rtl" dir="rtl">
      {/* ─── Page Title Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-100">
              <ArrowDownLeft className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">استلام تحويل بضاعة</h2>
          </div>
          <p className="text-slate-500 text-sm mt-1 pr-14">مراجعة وتأكيد استلام الشحنات المحولة بين الفروع والمستودعات وتعديل المخزون</p>
        </div>

        {/* Global Toolbar buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={() => { setLoading(true); handleNewDoc(); }}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-all shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleNewDoc}
            className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-150 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> مستند جديد
          </button>
        </div>
      </div>

      {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-100 gap-2 overflow-x-auto pb-px">
        {([
          { id: 'NEW', title: 'دفتر استلام جديد', icon: ArrowDownLeft },
          { id: 'ARCHIVE', title: 'الأرشيف والسجلات', icon: FileText },
          { id: 'AUDIT', title: 'سجل النشاط والتدقيق', icon: HistoryIcon },
          { id: 'REPORTS', title: 'تقارير وتحليلات', icon: TrendingUp }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-3.5 text-xs font-black transition-all border-b-2 rounded-t-xl -mb-px whitespace-nowrap",
              activeTab === tab.id 
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/20" 
                : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.title}
          </button>
        ))}
      </div>

      {/* ─── Tabs View Render ─────────────────────────────────────────────── */}
      <div className="min-h-[500px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold text-sm">جاري تحميل حركات المخازن...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {/* TAB 1: NEW WORKSHEET */}
              {activeTab === 'NEW' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  
                  {/* Left Side: Worksheet Form */}
                  <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-50 pb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <FileText className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-900 text-sm">ورقة عمل الاستلام</h3>
                            <p className="text-xs text-slate-400 font-medium">قم بمراجعة الكميات وتأكيد صحتها</p>
                          </div>
                        </div>
                        
                        {receiptNumber && (
                          <span className="font-mono text-sm font-black text-indigo-600 bg-indigo-50 border border-indigo-150 px-3 py-1 rounded-lg">
                            {receiptNumber}
                          </span>
                        )}
                      </div>

                      {/* Header Inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">تاريخ الاستلام</label>
                          <input 
                            type="date" 
                            className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-indigo-100"
                            value={receiptDate}
                            onChange={e => setReceiptDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">اسم المستلم المستند</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-indigo-100"
                            value={receiverName}
                            onChange={e => setReceiverName(e.target.value)}
                            placeholder="اسم مستلم الشحنة..."
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">حالة المستند</label>
                          <div className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm font-black text-slate-500">
                            {docStatus === 'DRAFT' ? 'مسودة' : 'معتمد'}
                          </div>
                        </div>
                      </div>

                      {/* Item details */}
                      {selectedTransferId ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">جدول الأصناف المحولة</h4>
                            <button
                              onClick={handleExportCSV}
                              className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" /> تصدير Excel
                            </button>
                          </div>

                          <div className="border border-slate-100 rounded-2xl overflow-hidden overflow-x-auto">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                  <th className="px-4 py-3.5">الصنف</th>
                                  <th className="px-4 py-3.5 text-center">الكمية المحولة</th>
                                  <th className="px-4 py-3.5 text-center">الكمية المستلمة</th>
                                  <th className="px-4 py-3.5 text-center">الفرق</th>
                                  <th className="px-4 py-3.5 text-center">حالة الصنف</th>
                                  <th className="px-4 py-3.5">ملاحظات الفروقات</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {worksheetItems.map(item => (
                                  <tr key={item.productId} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3">
                                      <p className="font-bold text-slate-800">{item.productName}</p>
                                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{item.sku || item.barcode || 'لا يوجد كود'}</p>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-slate-600">
                                      {item.transferredQty}
                                    </td>
                                    <td className="px-4 py-3 text-center w-28">
                                      <input 
                                        type="number"
                                        min={0}
                                        className="w-20 text-center font-black text-indigo-600 bg-slate-50 focus:bg-white rounded-lg px-2 py-1.5 border-none outline-none focus:ring-2 focus:ring-indigo-100"
                                        value={item.receivedQty}
                                        onChange={e => handleUpdateItemQty(item.productId, parseInt(e.target.value) || 0)}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={cn(
                                        "font-black",
                                        item.difference === 0 ? "text-slate-400" : item.difference < 0 ? "text-red-500" : "text-emerald-500"
                                      )}>
                                        {item.difference > 0 ? `+${item.difference}` : item.difference}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {item.itemStatus === 'MATCH' && (
                                        <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-lg font-bold">مطابق</span>
                                      )}
                                      {item.itemStatus === 'DEFICIT' && (
                                        <span className="bg-red-50 text-red-500 px-2 py-0.5 rounded-lg font-bold">عجز</span>
                                      )}
                                      {item.itemStatus === 'SURPLUS' && (
                                        <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg font-bold">زيادة</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <input 
                                        type="text"
                                        placeholder="اكتب هنا..."
                                        className="bg-transparent border-b border-transparent focus:border-slate-200 py-1 outline-none text-slate-600 w-full"
                                        value={item.notes || ''}
                                        onChange={e => handleUpdateItemNotes(item.productId, e.target.value)}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Variance Warnings */}
                          {hasDeficit && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 flex items-center gap-3">
                              <AlertCircle className="w-5 h-5 flex-shrink-0" />
                              <div className="text-xs">
                                <p className="font-black">تم رصد عجز في كميات استلام البضائع</p>
                                <p className="opacity-85 mt-0.5">سيتم تسجيل الواقعة كعجز نقل في سجل التدقيق وإرسال إشعار فوري لإدارة النظام.</p>
                              </div>
                            </div>
                          )}

                          {hasSurplus && (
                            <div className="bg-amber-50 text-amber-700 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
                              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                              <div className="text-xs">
                                <p className="font-black">تم اكتشاف كميات مستلمة زائدة</p>
                                <p className="opacity-85 mt-0.5">
                                  {isAdminUser 
                                    ? "سيتم تسجيل فائض الاستلام في سجل التدقيق ومراجعة الفروقات." 
                                    : "اعتماد الكميات الزائدة محظور لموظفي الكاشير والفروع. يتطلب موافقة وإشراف مدير النظام."
                                  }
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[2rem]">
                          <ArrowRightLeft className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                          <h4 className="font-black text-slate-400 text-sm">لم يتم اختيار أي تحويل مرتبط</h4>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            الرجاء تصفح قائمة التحويلات المرسلة والمعلقة في اللوحة الجانبية واختيار الحركة للبدء في جردها.
                          </p>
                        </div>
                      )}

                      {/* General Notes */}
                      {selectedTransferId && (
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">ملاحظات عامة على الاستلام</label>
                          <textarea 
                            rows={3} 
                            placeholder="ملاحظات المستلم، عيوب التعبئة والتغليف، أو أي تعليق إداري..."
                            className="w-full bg-slate-50 focus:bg-white rounded-2xl px-4 py-3 text-sm font-bold border border-transparent focus:border-slate-150 outline-none resize-none transition-all"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                          />
                        </div>
                      )}

                      {/* Action buttons */}
                      {selectedTransferId && (
                        <div className="flex gap-3 pt-4 border-t border-slate-50 flex-wrap">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={handleSaveDraft}
                            className="flex-1 min-w-[120px] py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2"
                          >
                            <Save className="w-4 h-4" /> حفظ مسودة
                          </button>

                          <button
                            type="button"
                            disabled={submitting || (hasSurplus && !isAdminUser)}
                            onClick={handleApproveReceipt}
                            className={cn(
                              "flex-[2] min-w-[200px] py-4 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg",
                              hasSurplus && !isAdminUser 
                                ? "bg-slate-300 shadow-none cursor-not-allowed" 
                                : "bg-indigo-600 hover:bg-indigo-750 shadow-indigo-100"
                            )}
                          >
                            {submitting ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            اعتماد الاستلام وتعديل المخازن
                          </button>

                          <button
                            type="button"
                            disabled={submitting}
                            onClick={handleRejectReceipt}
                            className="flex-1 min-w-[120px] py-4 border border-red-100 text-red-500 hover:bg-red-50 rounded-2xl text-xs font-black transition-all"
                          >
                            رفض الاستلام
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Transfers List & Info Panel */}
                  <div className="space-y-6">
                    {/* Transfer Document Selector panel */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                          <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
                          التحويلات المعلقة
                        </h3>
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-lg">
                          {availableTransfers.length} تحويل
                        </span>
                      </div>

                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="ابحث برقم التحويل، أو المخزن المرسل..."
                          className="w-full bg-slate-50 border-none rounded-xl pr-10 pl-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                          value={transferSearchQuery}
                          onChange={e => setTransferSearchQuery(e.target.value)}
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      </div>

                      {/* Scrollable list */}
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto scrollbar-none">
                        {availableTransfers.length === 0 ? (
                          <div className="text-center py-10">
                            <Check className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-xs text-slate-400 font-bold">لا يوجد تحويلات معلقة للمطابقة</p>
                          </div>
                        ) : availableTransfers.map(t => {
                          const whFrom = warehouses.find(w => w.id === t.fromWarehouseId)?.name || 'الرئيسي';
                          const whTo = warehouses.find(w => w.id === t.toWarehouseId)?.name || 'مستودع الفرع';
                          const isSelected = selectedTransferId === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleSelectTransfer(t.id)}
                              className={cn(
                                "w-full text-right p-3.5 rounded-2xl border transition-all text-xs flex flex-col gap-1.5",
                                isSelected 
                                  ? "border-indigo-300 bg-indigo-50/40 shadow-sm" 
                                  : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                              )}
                            >
                              <div className="flex justify-between items-center w-full">
                                <span className="font-mono font-black text-indigo-600 text-sm">#{t.reference || t.id.slice(0, 8).toUpperCase()}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{formatDate(t.createdAt)}</span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                                <span className="truncate">{whFrom}</span>
                                <span>←</span>
                                <span className="text-indigo-600 truncate">{whTo}</span>
                              </div>

                              <div className="flex justify-between items-center text-[10px] font-black text-slate-400 pt-1 border-t border-dashed border-slate-100 w-full">
                                <span>الأصناف: {t.items?.length || 0}</span>
                                <span className="text-indigo-500 font-black">تحميل البيانات ←</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Transfer Original Info Card */}
                    {selectedTransferId && (
                      <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-4 shadow-xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">التحويل الأصلي</h4>
                          <button
                            onClick={() => navigate(`/inventory/transfers?edit=${selectedTransferId}`)}
                            className="text-[10px] font-black text-indigo-300 hover:text-indigo-200 hover:underline"
                          >
                            عرض الصفحة الأصلية ←
                          </button>
                        </div>

                        {(() => {
                          const t = transfers.find(item => item.id === selectedTransferId)!;
                          const whFrom = warehouses.find(w => w.id === t.fromWarehouseId)?.name || 'الرئيسي';
                          const whTo = warehouses.find(w => w.id === t.toWarehouseId)?.name || 'مستودع الفرع';
                          return (
                            <div className="space-y-3 text-xs font-bold">
                              <div>
                                <p className="text-slate-400 text-[10px]">الفرع المرسل (المصدر)</p>
                                <p className="text-slate-200 text-sm font-black mt-0.5">{whFrom}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-[10px]">الفرع المستلم (الهدف)</p>
                                <p className="text-indigo-300 text-sm font-black mt-0.5">{whTo}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-[10px]">التاريخ الأصلي للتحويل</p>
                                <p className="text-slate-200 mt-0.5">{formatDate(t.createdAt)}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-[10px]">ملاحظات الشحن</p>
                                <p className="text-slate-300 italic mt-0.5">"{t.notes || 'لا يوجد'}"</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: ARCHIVE */}
              {activeTab === 'ARCHIVE' && (
                <div className="space-y-6">
                  {/* Filters Bar */}
                  <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                      <input 
                        type="text" 
                        placeholder="ابحث برقم الاستلام، رقم التحويل، الفرع..."
                        className="w-full bg-slate-50 border-none rounded-xl pr-10 pl-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                        value={archiveSearchQuery}
                        onChange={e => setArchiveSearchQuery(e.target.value)}
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>

                    <div className="flex gap-2 text-xs font-black text-slate-400">
                      <span>إجمالي المستندات المؤرشفة:</span>
                      <span className="text-slate-800">{receipts.length} مستند</span>
                    </div>
                  </div>

                  {/* Datagrid */}
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr className="border-b border-slate-100">
                          <th className="px-6 py-4">رقم الاستلام</th>
                          <th className="px-6 py-4">رقم التحويل</th>
                          <th className="px-6 py-4">تاريخ الاستلام</th>
                          <th className="px-6 py-4">من مستودع</th>
                          <th className="px-6 py-4">إلى مستودع</th>
                          <th className="px-6 py-4">المستلم</th>
                          <th className="px-6 py-4 text-center">الأصناف</th>
                          <th className="px-6 py-4 text-center">الحالة</th>
                          <th className="px-6 py-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredArchiveReceipts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-20 text-center text-slate-400 italic font-bold">
                              لا يوجد مستندات استلام مطابقة للبحث
                            </td>
                          </tr>
                        ) : filteredArchiveReceipts.map(r => (
                          <tr 
                            key={r.id}
                            onClick={() => setViewingReceipt(r)}
                            className="hover:bg-slate-50/50 cursor-pointer transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <span className="font-mono font-black text-indigo-600">{r.receiptNumber}</span>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-slate-500">
                              #{r.transferNumber}
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-bold">{r.date}</td>
                            <td className="px-6 py-4 font-bold text-slate-700">{r.fromWarehouseName}</td>
                            <td className="px-6 py-4 font-bold text-indigo-600">{r.toWarehouseName}</td>
                            <td className="px-6 py-4 text-slate-600 font-bold">{r.receiverName}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-black">{r.items.length} أصناف</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {getStatusBadge(r.status)}
                            </td>
                            <td className="px-6 py-4 text-left">
                              <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                {r.status === 'DRAFT' && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleLoadDraft(r); }}
                                    className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-[10px] font-black"
                                    title="تعديل المسودة"
                                  >
                                    تعديل
                                  </button>
                                )}
                                <button
                                  onClick={e => { e.stopPropagation(); setViewingReceipt(r); }}
                                  className="p-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: AUDIT TRAIL */}
              {activeTab === 'AUDIT' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-2 border-b border-slate-50 pb-3">
                      <HistoryIcon className="w-4.5 h-4.5 text-indigo-500" />
                      سجل التدقيق والمراجعة للحركات
                    </h3>

                    {/* Timeline logs list */}
                    <div className="divide-y divide-slate-100">
                      {auditLogs.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 italic">
                          لا يوجد حركات مسجلة للتدقيق بعد.
                        </div>
                      ) : auditLogs.map(log => (
                        <div key={log.id} className="py-4 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 text-slate-400">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-black text-slate-800">{log.action}</p>
                              <p className="text-slate-500 font-medium leading-relaxed">{log.details}</p>
                              <div className="flex gap-2 items-center text-[10px] font-black text-slate-400">
                                <span>المنفذ: {log.userName}</span>
                                <span>•</span>
                                <span>{log.userEmail}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-left font-mono font-bold text-slate-400 shrink-0">
                            {formatDate(log.timestamp)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: REPORTS */}
              {activeTab === 'REPORTS' && (
                <div className="space-y-8">
                  {/* Analytics Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'استلام بالكامل', value: reportsData.totalReceivedDocs, color: 'indigo', icon: CheckCircle2 },
                      { label: 'استلام جزئي', value: reportsData.totalPartialDocs, color: 'blue', icon: ArrowRightLeft },
                      { label: 'إجمالي عجز النقل', value: `${reportsData.totalDeficits} وحدة`, color: 'red', icon: TrendingDown },
                      { label: 'تحويلات معلقة بالكامل', value: reportsData.pendingTransfersCount, color: 'amber', icon: Clock }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center",
                          stat.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                          stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                          stat.color === 'red' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                        )}>
                          <stat.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5 leading-none">{stat.label}</p>
                          <p className="text-xl font-black text-slate-900 leading-none mt-1">{stat.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary reports by warehouses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Deficit variance list */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
                        <TrendingDown className="w-4.5 h-4.5 text-red-500" />
                        الأصناف الأكثر تأثراً بعجز النقل
                      </h3>
                      
                      <div className="divide-y divide-slate-50 text-xs">
                        {receipts.filter(r => r.status === 'RECEIVED' || r.status === 'PARTIALLY_RECEIVED')
                          .flatMap(r => r.items.filter(i => i.itemStatus === 'DEFICIT'))
                          .slice(0, 5)
                          .map((item, idx) => (
                            <div key={idx} className="py-3 flex justify-between items-center font-bold">
                              <div>
                                <p className="text-slate-800">{item.productName}</p>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">SKU: {item.sku}</p>
                              </div>
                              <div className="text-left">
                                <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-lg font-black text-[10px]">
                                  عجز: {item.transferredQty - item.receivedQty}
                                </span>
                              </div>
                            </div>
                          ))}
                        {receipts.flatMap(r => r.items.filter(i => i.itemStatus === 'DEFICIT')).length === 0 && (
                          <p className="text-slate-400 text-center py-10 italic">لا توجد حركات عجز مسجلة</p>
                        )}
                      </div>
                    </div>

                    {/* Pending Transfers list details */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
                        <Clock className="w-4.5 h-4.5 text-amber-500" />
                        أعلى التحويلات المعلقة شحناً
                      </h3>

                      <div className="space-y-3">
                        {transfers.filter(t => t.status === 'COMPLETED' && !isTransferFullyReceived(t)).slice(0, 4).map(t => {
                          const whFrom = warehouses.find(w => w.id === t.fromWarehouseId)?.name || 'الرئيسي';
                          const whTo = warehouses.find(w => w.id === t.toWarehouseId)?.name || 'الفرع';
                          return (
                            <div key={t.id} className="p-3 bg-slate-50 rounded-2xl flex justify-between items-center text-xs font-bold">
                              <div>
                                <p className="font-mono font-black text-indigo-600">#{t.reference || t.id.slice(0, 8).toUpperCase()}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{whFrom} ← {whTo}</p>
                              </div>
                              <div className="text-left font-black text-slate-700">
                                {t.items?.length} أصناف
                              </div>
                            </div>
                          );
                        })}
                        {transfers.filter(t => t.status === 'COMPLETED' && !isTransferFullyReceived(t)).length === 0 && (
                          <p className="text-slate-400 text-center py-10 italic">كل التحويلات مستلمة بالكامل!</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ─── Archive Detail Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {viewingReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewingReceipt(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Printable Area Wrapper */}
              <div id="print-area" className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin">
                {/* Modal Header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-5">
                  <div className="space-y-1.5 text-right">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-lg">مستند استلام تحويل</span>
                    <h3 className="text-2xl font-black text-slate-900 mt-2">{viewingReceipt.receiptNumber}</h3>
                    <p className="text-xs text-slate-400 font-bold">تاريخ الحركة: {viewingReceipt.date}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(viewingReceipt.status)}
                    <button 
                      onClick={() => setViewingReceipt(null)}
                      className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Metadata Information Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs font-bold">
                  {[
                    { icon: ArrowRightLeft, label: 'رقم التحويل المرتبط', value: `#${viewingReceipt.transferNumber}` },
                    { icon: Building2, label: 'مستودع الشحن (المصدر)', value: viewingReceipt.fromWarehouseName },
                    { icon: Building2, label: 'مستودع الاستلام (الهدف)', value: viewingReceipt.toWarehouseName },
                    { icon: User, label: 'اسم المستلم', value: viewingReceipt.receiverName },
                    { icon: Clock, label: 'تاريخ الإدخال بالنظام', value: formatDate(viewingReceipt.createdAt) },
                    { icon: User, label: 'مدخل البيانات', value: viewingReceipt.createdByName }
                  ].map((info, idx) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded-2xl">
                      <div className="flex items-center gap-1 text-slate-400 mb-1">
                        <info.icon className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">{info.label}</span>
                      </div>
                      <p className="text-slate-800 font-black truncate">{info.value}</p>
                    </div>
                  ))}
                </div>

                {/* Items list table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">الأصناف المستلمة</h4>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3">الصنف</th>
                          <th className="px-4 py-3 text-center">الكمية المحولة</th>
                          <th className="px-4 py-3 text-center">الكمية المستلمة</th>
                          <th className="px-4 py-3 text-center">الفرق</th>
                          <th className="px-4 py-3 text-center">حالة الصنف</th>
                          <th className="px-4 py-3">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {viewingReceipt.items.map(item => (
                          <tr key={item.productId} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800">{item.productName}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{item.sku || item.barcode || 'N/A'}</p>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-500">{item.transferredQty}</td>
                            <td className="px-4 py-3 text-center font-black text-indigo-600">{item.receivedQty}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn(
                                "font-black",
                                item.difference === 0 ? "text-slate-400" : item.difference < 0 ? "text-red-500" : "text-emerald-500"
                              )}>
                                {item.difference > 0 ? `+${item.difference}` : item.difference}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.itemStatus === 'MATCH' && <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-lg">مطابق</span>}
                              {item.itemStatus === 'DEFICIT' && <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-lg">عجز</span>}
                              {item.itemStatus === 'SURPLUS' && <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">زيادة</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-400 italic">{item.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* General notes display */}
                {viewingReceipt.notes && (
                  <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100/50">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">الملاحظات والتعليمات</p>
                    <p className="text-xs text-amber-800 font-bold">{viewingReceipt.notes}</p>
                  </div>
                )}

                {/* Audit trail details for this document */}
                {viewingAuditLogs.length > 0 && (
                  <div className="border-t border-slate-100 pt-5 space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> تاريخ وتعديلات المستند
                    </h4>
                    <div className="bg-slate-50 rounded-2xl p-4 divide-y divide-slate-100 max-h-[160px] overflow-y-auto scrollbar-thin space-y-2">
                      {viewingAuditLogs.map(log => (
                        <div key={log.id} className="py-2 text-[10px] text-slate-500 font-bold flex justify-between gap-3">
                          <span>{log.action} ({log.details}) - بواسطة {log.userName}</span>
                          <span className="font-mono text-slate-400">{formatDate(log.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal footer Actions */}
              <div className="bg-slate-50 px-8 py-5 flex justify-between items-center border-t border-slate-100 flex-shrink-0 flex-wrap gap-3">
                <button
                  onClick={() => handlePrint('print-area')}
                  className="px-5 py-3 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> طباعة المستند
                </button>

                <div className="flex gap-2">
                  {viewingReceipt.status === 'DRAFT' && (
                    <button
                      onClick={() => handleLoadDraft(viewingReceipt)}
                      className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all"
                    >
                      تعديل المسودة
                    </button>
                  )}

                  {(viewingReceipt.status === 'RECEIVED' || viewingReceipt.status === 'PARTIALLY_RECEIVED') && (
                    <button
                      onClick={() => handleCancelReceipt(viewingReceipt)}
                      className="px-5 py-3 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs font-black transition-all"
                    >
                      إلغاء الاعتماد (عكس Stock)
                    </button>
                  )}
                  
                  <button
                    onClick={() => setViewingReceipt(null)}
                    className="px-5 py-3 bg-slate-200 hover:bg-slate-350 text-slate-700 rounded-xl text-xs font-black transition-all"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Admin override Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isAdminOverrideRequired && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6"
            >
              <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-black text-slate-800">صلاحية المدير مطلوبة</h4>
                <p className="text-xs text-slate-500 font-bold leading-relaxed">
                  تم رصد كمية زائدة (فائض) في هذا الاستلام. اعتماد كمية زائدة يتطلب صلاحية مدير النظام أو المطور المسؤول.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleApproveReceipt}
                  className="w-full py-4 bg-indigo-650 text-white rounded-xl text-xs font-black hover:bg-indigo-750 transition-all"
                >
                  نعم، أنا مدير النظام (اعتماد)
                </button>
                <button
                  onClick={() => setIsAdminOverrideRequired(false)}
                  className="w-full py-3.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-black hover:bg-slate-200 transition-all"
                >
                  إلغاء وتعديل الكميات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
