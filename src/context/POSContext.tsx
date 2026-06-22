import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { Shift, Order, AppNotification } from '../types';
import { collection, query, onSnapshot, setDoc, doc, orderBy, updateDoc, where, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, cleanUndefined } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { formatCurrency } from '../lib/utils';
import { notificationsService } from '../services/firestore';
import { accountingIntegration } from '../services/accountingIntegration';

interface POSContextType {
  shifts: Shift[];
  openShift: (branchId: string, cashierId: string, openingCash: number, cashierName?: string) => Promise<Shift>;
  closeShift: (shiftId: string, actualCash: number, notes?: string) => Promise<void>;
  getOpenShift: (branchId: string) => Shift | undefined;
  invoices: Order[];
  addInvoice: (invoice: Order) => Promise<void>;
  updateInvoice: (invoiceId: string, updates: Partial<Order>) => Promise<void>;
  deleteInvoice: (invoiceId: string) => Promise<void>;
  newTransferAlert: any;
  clearTransferAlert: () => void;
  requestBranchTransfer: (params: {
    fromBranchId: string;
    fromBranchName: string;
    toBranchId: string;
    toBranchName: string;
    productId: string;
    productName: string;
    quantity: number;
  }) => Promise<boolean>;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [invoices, setInvoices] = useState<Order[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [newTransferAlert, setNewTransferAlert] = useState<any>(null);
  const [lastTransferId, setLastTransferId] = useState<string | null>(null);
  const isFirstLoad = React.useRef(true);

  // Real-time synchronization
  useEffect(() => {
    if (!user) {
      setShifts([]);
      setInvoices([]);
      return;
    }

    // Query shifts: Admins see all, Cashiers see only theirs
    const shiftsRef = collection(db, 'shifts');
    const qS = (user.role === 'ADMIN' || (user.role as string) === 'admin')
      ? query(shiftsRef, orderBy('startDate', 'desc'))
      : query(shiftsRef, where('cashierId', '==', user.uid)); 

    const unsubS = onSnapshot(qS, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift));
      setShifts(docs.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    }, error => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    // Query orders: Admins see all, Cashiers see only theirs
    const ordersRef = collection(db, 'orders');
    const qI = (user.role === 'ADMIN' || (user.role as string) === 'admin')
      ? query(ordersRef, orderBy('createdAt', 'desc'))
      : query(ordersRef, where('cashierId', '==', user.uid)); 

    const unsubI = onSnapshot(qI, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setInvoices(docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, error => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => {
      unsubS();
      unsubI();
    };
  }, [user]);

  // Fetch Transfers
  useEffect(() => {
    if (!user) return;
    const qT = query(collection(db, 'inventory_transactions'), orderBy('createdAt', 'desc'));
    const unsubT = onSnapshot(qT, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransfers(docs);
      
      if (user.branchId) {
        const latestToBranch = docs.find((t: any) => 
          t.toWarehouseId === user.branchId && 
          t.status === 'COMPLETED'
        );

        if (latestToBranch) {
          if (!isFirstLoad.current && lastTransferId && latestToBranch.id !== lastTransferId) {
            setNewTransferAlert(latestToBranch);
            
            // Add Global Notification
            notificationsService.add({
              title: 'استلام منتجات',
              message: `تم وصول بضاعة جديدة للفرع من المستودع الرئيسي (رقم: ${latestToBranch.id.slice(0,8)})`,
              type: 'TRANSFER',
              metadata: { transferId: latestToBranch.id }
            });
          }
          setLastTransferId(latestToBranch.id);
        }
      }
      
      setTimeout(() => { isFirstLoad.current = false; }, 3000);
    });
    return () => unsubT();
  }, [user, lastTransferId]);

  const openShift = async (branchId: string, cashierId: string, openingCash: number, cashierName?: string) => {
    const existingShift = shifts.find(s => s.branchId === branchId && s.status === 'OPEN');
    if (existingShift) {
      throw new Error('يوجد بالفعل وردية مفتوحة لهذا الفرع. يرجى إغلاقها أولاً.');
    }

    const id = `SHF${Date.now().toString(36).toUpperCase()}`;
    const newShift: Shift = {
      id,
      branchId,
      cashierId,
      openingCash,
      closingCash: 0,
      actualCash: 0,
      totalSalesCash: 0,
      totalSalesCard: 0,
      expenses: 0,
      status: 'OPEN',
      startDate: new Date().toISOString(),
      cashierName: cashierName || 'غير معروف'
    };
    
    try {
      await setDoc(doc(db, 'shifts', id), newShift);
      return newShift;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `shifts/${id}`);
      throw error;
    }
  };

  const closeShift = async (shiftId: string, actualCash: number, notes?: string) => {
    try {
      if (!shiftId || typeof shiftId !== 'string') {
        throw new Error(`Invalid shiftId: ${shiftId}`);
      }

      let shift = shifts.find(s => s.id === shiftId);
      
      if (!shift) {
        const shiftSnap = await getDoc(doc(db, 'shifts', shiftId));
        if (shiftSnap.exists()) {
          shift = { id: shiftSnap.id, ...shiftSnap.data() } as Shift;
        }
      }

      if (!shift) {
        throw new Error('Shift not found anywhere.');
      }

      const shiftInvoices = (invoices || []).filter(inv => inv && inv.shiftId === shiftId && (inv.status === 'COMPLETED' || inv.status === 'PARTIALLY_RETURNED' || !inv.status));
      const cashSales = shiftInvoices.filter(inv => inv.paymentMethod === 'cash').reduce((acc, inv) => acc + (inv.total || 0), 0);
      const cardSales = shiftInvoices.filter(inv => inv.paymentMethod === 'visa' || inv.paymentMethod === 'vodafone' || inv.paymentMethod === 'instapay').reduce((acc, inv) => acc + (inv.total || 0), 0);

      const updateData = {
        status: 'CLOSED' as const,
        endDate: new Date().toISOString(),
        actualCash: Number(actualCash) || 0,
        totalSalesCash: Number(cashSales) || 0,
        totalSalesCard: Number(cardSales) || 0,
        closingCash: (Number(shift.openingCash) || 0) + (Number(cashSales) || 0),
        notes: String(notes || '')
      };
      
      const shiftRef = doc(db, 'shifts', String(shiftId));
      await updateDoc(shiftRef, updateData);

      setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, ...updateData } as Shift : s));
    } catch (error: any) {
      console.error('CRITICAL ERROR in closeShift:', error);
      throw error;
    }
  };

  const getOpenShift = (branchId: string) => {
    const openShifts = shifts.filter(s => s.branchId === branchId && s.status === 'OPEN');
    return openShifts[0]; 
  };

  const addInvoice = async (invoice: Order) => {
    try {
      const invoiceData = { ...invoice, status: invoice.status || 'COMPLETED' } as any;
      if (!invoiceData.cashierId) {
        invoiceData.cashierId = auth.currentUser?.uid || invoiceData.cashierId;
      }

      if (!invoiceData.cashierId) {
        throw new Error('Missing cashierId for invoice creation.');
      }

      const cleanedData = cleanUndefined(invoiceData);
      await setDoc(doc(db, 'orders', invoice.id), cleanedData);
      
      if (invoiceData.status === 'COMPLETED') {
        await accountingIntegration.postInvoiceToAccounting(invoiceData);
      }

      // Add Notification
      notificationsService.add({
        title: invoice.status === 'PENDING' ? 'فاتورة معلقة' : 'فاتورة بيع جديدة',
        message: invoice.status === 'PENDING'
          ? `تم تعليق الفاتورة برقم ${invoice.id.slice(0, 8)}`
          : `تم إصدار فاتورة جديدة بقيمة ${formatCurrency(invoice.total)}`,
        type: 'INVOICE',
        metadata: { invoiceId: invoice.id }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orders/${invoice.id}`);
    }
  };

  const updateInvoice = async (invoiceId: string, updates: Partial<Order>) => {
    try {
      const updateData = cleanUndefined(updates);

      if (Object.keys(updateData).length === 0) {
        return;
      }

      await updateDoc(doc(db, 'orders', invoiceId), updateData);

      if (updateData.status === 'COMPLETED') {
        const docSnap = await getDoc(doc(db, 'orders', invoiceId));
        if (docSnap.exists()) {
          const fullInvoice = { id: docSnap.id, ...docSnap.data() } as Order;
          await accountingIntegration.postInvoiceToAccounting(fullInvoice);
        }
      }
      
      // Add Notification
      const isReturn = updateData.status === 'RETURNED';
      notificationsService.add({
        title: isReturn ? 'عملية إرجاع' : 'تعديل فاتورة',
        message: isReturn 
          ? `تم عمل إرجاع للفاتورة رقم ${invoiceId.slice(0,8)}` 
          : `تم تعديل بيانات الفاتورة رقم ${invoiceId.slice(0,8)} بواسطة المدير`,
        type: isReturn ? 'RETURN' : 'INVOICE',
        metadata: { invoiceId }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orders/${invoiceId}`);
    }
  };

  const cancelInvoice = async (invoiceId: string, reason?: string) => {
    if (!invoiceId) {
      throw new Error('Invalid invoiceId for cancelInvoice');
    }

    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      throw new Error('Cannot cancel invoice: no authenticated user.');
    }

    try {
      const cancelData: any = {
        status: 'CANCELLED',
        cancelledBy: currentUserId,
        cancelledAt: new Date().toISOString()
      };
      if (reason) {
        cancelData.notes = reason;
      }

      await updateDoc(doc(db, 'orders', invoiceId), cancelData);
      notificationsService.add({
        title: 'فاتورة ملغاة',
        message: `تم إلغاء الفاتورة رقم ${invoiceId.slice(0,8)}`,
        type: 'INVOICE',
        metadata: { invoiceId }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orders/${invoiceId}`);
    }
  };

  const deleteInvoice = async (invoiceId: string, reason?: string) => {
    await cancelInvoice(invoiceId, reason || 'تم إلغاء الفاتورة بواسطة المستخدم.');
  };

  const requestBranchTransfer = async (params: {
    fromBranchId: string;
    fromBranchName: string;
    toBranchId: string;
    toBranchName: string;
    productId: string;
    productName: string;
    quantity: number;
  }): Promise<boolean> => {
    try {
      const id = `BR-${Date.now().toString(36).toUpperCase()}`;
      const transactionData = {
        id,
        type: 'TRANSFER',
        status: 'PENDING',
        fromWarehouseId: params.fromBranchId,
        toWarehouseId: params.toBranchId,
        items: [{
          productId: params.productId,
          productName: params.productName,
          quantity: params.quantity,
        }],
        reference: 'BRANCH_REQUEST',
        notes: `طلب تحويل من ${params.fromBranchName} → ${params.toBranchName} بواسطة الكاشير`,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'cashier',
        requestedByBranch: params.toBranchId,
      };

      console.log('Submitting branch transfer request:', transactionData);
      await setDoc(doc(db, 'inventory_transactions', id), transactionData);
      console.log('Transfer request saved to Firestore successfully');

      // Send admin notification
      await notificationsService.add({
        title: 'طلب تحويل مخزون',
        message: `الفرع "${params.toBranchName}" يطلب ${params.quantity} قطعة من "${params.productName}" من فرع "${params.fromBranchName}"`,
        type: 'TRANSFER',
        metadata: { transferId: id, fromBranchId: params.fromBranchId, toBranchId: params.toBranchId },
      });
      console.log('Notification sent successfully');

      return true;
    } catch (error: any) {
      console.error('Error requesting branch transfer:', error);
      alert(`خطأ في إرسال الطلب: ${error?.message || 'خطأ غير معروف'}`);
      return false;
    }
  };

  return (
    <POSContext.Provider value={{ 
      shifts, openShift, closeShift, getOpenShift, 
      invoices, addInvoice, updateInvoice, deleteInvoice,
      newTransferAlert, clearTransferAlert: () => setNewTransferAlert(null),
      requestBranchTransfer,
    }}>
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) throw new Error('usePOS must be used within a POSProvider');
  return context;
};


