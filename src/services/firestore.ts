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
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Product, Order, Customer } from '../types';

export const productsService = {
  async getAll() {
    const path = 'products';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async add(product: Omit<Product, 'id' | 'createdAt'>) {
    const path = 'products';
    try {
      return await addDoc(collection(db, path), {
        ...product,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async update(id: string, product: Partial<Product>) {
    const path = `products/${id}`;
    try {
      const docRef = doc(db, 'products', id);
      return await updateDoc(docRef, product);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async delete(id: string) {
    const path = `products/${id}`;
    try {
      const docRef = doc(db, 'products', id);
      return await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};

export const ordersService = {
  async getAll() {
    const path = 'orders';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async add(order: Omit<Order, 'id' | 'createdAt'>) {
    const path = 'orders';
    try {
      return await addDoc(collection(db, path), {
        ...order,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
};

export const systemService = {
  async resetData() {
    const collectionsToClear = [
      'orders',
      'products',
      'inventory_transactions',
      'shifts',
      'customers',
      'journal',
      'journalEntries',
      'journal_entries',
      'journal_vouchers',
      'stock_levels',
      'purchase_receipts',
      'purchase_payments',
      'accounts_payable',
    ];

    const errors: string[] = [];
    let clearedCount = 0;

    for (const coll of collectionsToClear) {
      try {
        const snapshot = await getDocs(collection(db, coll));
        for (const d of snapshot.docs) {
          try {
            await deleteDoc(doc(db, coll, d.id));
          } catch (innerErr) {
            // single-doc failure — skip and continue
            console.warn(`Could not delete ${coll}/${d.id}:`, innerErr);
          }
        }
        clearedCount++;
      } catch (error: any) {
        // collection-level error (e.g. no rules) — log and continue
        if (error?.code !== 'permission-denied') {
          console.warn(`Skipping collection "${coll}":`, error?.message || error);
        } else {
          console.warn(`Permission denied for "${coll}" — skipping`);
        }
        errors.push(coll);
      }
    }

    // Consider success if at least core collections were cleared
    const coreCleared = !errors.includes('orders') && !errors.includes('products');
    if (coreCleared) {
      console.log(`Reset complete. Cleared: ${clearedCount}, Skipped: ${errors.length}`);
      return true;
    }
    console.error('Reset failed for core collections:', errors);
    return false;
  }
};


export const notificationsService = {
  async add(notification: any) {
    const path = 'notifications';
    try {
      return await addDoc(collection(db, path), {
        ...notification,
        isRead: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  },

  async markAsRead(id: string) {
    try {
      const docRef = doc(db, 'notifications', id);
      return await updateDoc(docRef, { isRead: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  async delete(id: string) {
    try {
      const docRef = doc(db, 'notifications', id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  },

  async clearAll() {
    try {
      const snapshot = await getDocs(collection(db, 'notifications'));
      for (const d of snapshot.docs) {
        await deleteDoc(doc(db, 'notifications', d.id));
      }
      return true;
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return false;
    }
  }
};

export const auditService = {
  async logActivity(activity: {
    userId: string;
    userName: string;
    userEmail: string;
    action: string;
    details: string;
    referenceId?: string;
  }) {
    try {
      await addDoc(collection(db, 'activity_logs'), {
        ...activity,
        timestamp: new Date().toISOString()
      });
      return true;
    } catch (error) {
      console.error('Error saving activity log:', error);
      return false;
    }
  },

  async getLogsByReference(referenceId: string) {
    try {
      const q = query(
        collection(db, 'activity_logs'),
        where('referenceId', '==', referenceId)
      );
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in-memory in case index is not created yet
      return logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Error loading activity logs:', error);
      return [];
    }
  }
};

export const customersService = {
  async getAll() {
    const path = 'customers';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async add(customer: Omit<Customer, 'id' | 'createdAt'>) {
    const path = 'customers';
    try {
      return await addDoc(collection(db, path), {
        ...customer,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async update(id: string, customer: Partial<Customer>) {
    const path = `customers/${id}`;
    try {
      const docRef = doc(db, 'customers', id);
      return await updateDoc(docRef, customer);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async delete(id: string) {
    const path = `customers/${id}`;
    try {
      const docRef = doc(db, 'customers', id);
      return await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};
