import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { Shift, Order } from '../types';
import { collection, query, onSnapshot, setDoc, doc, orderBy, updateDoc, where, getDoc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { formatCurrency } from '../lib/utils';

interface POSContextType {
  shifts: Shift[];
  openShift: (branchId: string, cashierId: string, openingCash: number) => Promise<Shift>;
  closeShift: (shiftId: string, actualCash: number, notes?: string) => Promise<void>;
  getOpenShift: (branchId: string) => Shift | undefined;
  invoices: Order[];
  addInvoice: (invoice: Order) => Promise<void>;
  updateInvoice: (invoiceId: string, updates: Partial<Order>) => Promise<void>;
  deleteInvoice: (invoiceId: string) => Promise<void>;
  newTransferAlert: any;
  clearTransferAlert: () => void;
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
    const qS = (user.role === 'ADMIN' || user.role === 'admin')
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
    const qI = (user.role === 'ADMIN' || user.role === 'admin')
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

      const shiftInvoices = (invoices || []).filter(inv => inv && inv.shiftId === shiftId && inv.status !== 'RETURNED');
      const cashSales = shiftInvoices.filter(inv => inv.paymentMethod === 'cash').reduce((acc, inv) => acc + (inv.total || 0), 0);
      const cardSales = shiftInvoices.filter(inv => inv.paymentMethod === 'visa').reduce((acc, inv) => acc + (inv.total || 0), 0);

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
      await setDoc(doc(db, 'orders', invoice.id), { ...invoice, status: invoice.status || 'COMPLETED' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orders/${invoice.id}`);
    }
  };

  const updateInvoice = async (invoiceId: string, updates: Partial<Order>) => {
    try {
      await updateDoc(doc(db, 'orders', invoiceId), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orders/${invoiceId}`);
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'orders', invoiceId));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orders/${invoiceId}`);
    }
  };

  return (
    <POSContext.Provider value={{ 
      shifts, openShift, closeShift, getOpenShift, 
      invoices, addInvoice, updateInvoice, deleteInvoice,
      newTransferAlert, clearTransferAlert: () => setNewTransferAlert(null)
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


