import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  runTransaction,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Warehouse, InventoryTransaction, Product } from '../types';

export const warehouseService = {
  async getAll() {
    const path = 'warehouses';
    try {
      const q = query(collection(db, path), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Warehouse[];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async add(warehouse: Omit<Warehouse, 'id'>) {
    const path = 'warehouses';
    try {
      return await addDoc(collection(db, path), {
        ...warehouse,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
};

export const inventoryTransactionService = {
  async getAll() {
    const path = 'inventory_transactions';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryTransaction[];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  /**
   * Complex operation: Creates a transaction AND updates product stock levels atomically
   */
  async createStockMovement(transaction: Omit<InventoryTransaction, 'id' | 'createdAt'>) {
    try {
      await runTransaction(db, async (firestoreTransaction) => {
        // 1. Create the activity record
        const txRef = doc(collection(db, 'inventory_transactions'));
        firestoreTransaction.set(txRef, {
          ...transaction,
          createdAt: new Date().toISOString()
        });

        // 2. Update Product quantities based on type
        for (const item of transaction.items) {
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await firestoreTransaction.get(productRef);
          
          if (!productSnap.exists()) throw new Error(`Product ${item.productId} not found`);
          
          let qtyDelta = 0;
          if (transaction.type === 'RECEIPT' || transaction.type === 'RETURN') {
            qtyDelta = item.quantity;
          } else if (transaction.type === 'ISSUE' || transaction.type === 'TRANSFER') {
            qtyDelta = -item.quantity;
          }

          firestoreTransaction.update(productRef, {
            quantity: increment(qtyDelta),
            updatedAt: new Date().toISOString()
          });
        }
      });
      return true;
    } catch (error) {
      console.error("Stock movement failed", error);
      throw error;
    }
  }
};
