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
      'stock_levels'
    ];

    try {
      for (const coll of collectionsToClear) {
        const snapshot = await getDocs(collection(db, coll));
        for (const d of snapshot.docs) {
          await deleteDoc(doc(db, coll, d.id));
        }
      }
      return true;
    } catch (error) {
      console.error('Error resetting system data:', error);
      return false;
    }
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
