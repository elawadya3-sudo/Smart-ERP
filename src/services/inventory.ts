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
  increment,
  setDoc
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
   * Creates a transaction and updates stock only when status is COMPLETED.
   */
  async createStockMovement(transaction: Omit<InventoryTransaction, 'id' | 'createdAt'>) {
    try {
      console.log("Starting stock movement transaction:", transaction);
      
      const txId = await runTransaction(db, async (firestoreTransaction) => {
        // 1. COLLECT ALL READS FIRST
        const productData: { ref: any, snap: any, item: any }[] = [];
        
        for (const item of transaction.items) {
          if (!item.productId) continue;
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await firestoreTransaction.get(productRef);
          
          if (!productSnap.exists()) {
            throw new Error(`المنتج ${item.productName || item.productId} غير موجود في قاعدة البيانات`);
          }
          
          productData.push({ ref: productRef, snap: productSnap, item });
        }

        // 2. PERFORM ALL WRITES AFTER READS
        const txRef = doc(collection(db, 'inventory_transactions'));
        firestoreTransaction.set(txRef, {
          ...transaction,
          createdAt: new Date().toISOString()
        });

        if (transaction.status === 'COMPLETED') {
          for (const entry of productData) {
            let qtyDelta = Number(entry.item.quantity) || 0;

            if (transaction.type === 'RECEIPT' || transaction.type === 'RETURN') {
              // Addition
            } else if (transaction.type === 'ISSUE' || transaction.type === 'TRANSFER') {
              qtyDelta = -qtyDelta;
            }

            const productDocData = entry.snap.data() as any;
            let variantsUpdate = {};
            if (productDocData.variants && productDocData.variants.length > 0) {
              const updatedVariants = productDocData.variants.map((v: any) => {
                const isSkuMatch = entry.item.sku && v.sku && v.sku === entry.item.sku;
                const isVariantMatch = entry.item.variant && 
                  String(v.size) === String(entry.item.variant.size) && 
                  String(v.color) === String(entry.item.variant.color);
                const generatedSku = `${productDocData.sku || 'PROD'}-${v.size}-${v.color}`;
                const isGeneratedSkuMatch = entry.item.sku === generatedSku;

                if (isSkuMatch || isVariantMatch || isGeneratedSkuMatch) {
                  return { ...v, quantity: (v.quantity || 0) + qtyDelta };
                }
                return v;
              });
              variantsUpdate = { variants: updatedVariants };
            }

            firestoreTransaction.update(entry.ref, {
              quantity: increment(qtyDelta),
              ...variantsUpdate,
              updatedAt: new Date().toISOString()
            });
          }
        }
        return txRef.id;
      });
      return { success: true, id: txId };
    } catch (error: any) {
      console.error("Stock movement failed details:", error);
      throw new Error(error.message || "حدث خطأ غير متوقع أثناء تحديث المخزون");
    }
  },

  async createPendingTransferRequest(transaction: Omit<InventoryTransaction, 'id' | 'createdAt'>) {
    try {
      const txRef = doc(collection(db, 'inventory_transactions'));
      await setDoc(txRef, {
        ...transaction,
        createdAt: new Date().toISOString()
      });
      return true;
    } catch (error: any) {
      console.error('Pending transfer request failed:', error);
      throw new Error(error.message || 'فشل إنشاء طلب تحويل المخزون');
    }
  },

  async approveStockMovement(transaction: InventoryTransaction) {
    try {
      const txRef = doc(db, 'inventory_transactions', transaction.id);
      await runTransaction(db, async (firestoreTransaction) => {
        const txSnap = await firestoreTransaction.get(txRef);
        if (!txSnap.exists()) {
          throw new Error('المعاملة غير موجودة');
        }
        const txData = txSnap.data() as InventoryTransaction;
        if (txData.status !== 'PENDING') {
          throw new Error('المعاملة ليست بإنتظار الموافقة');
        }

        const productMap = new Map<string, { ref: any, snap: any }>();
        for (const item of transaction.items) {
          if (!item.productId) continue;
          const productRef = doc(db, 'products', item.productId);
          const snap = await firestoreTransaction.get(productRef);
          if (!snap.exists()) {
            throw new Error(`المنتج ${item.productName || item.productId} غير موجود`);
          }
          productMap.set(item.productId, { ref: productRef, snap });
        }

        for (const item of transaction.items) {
          const entry = productMap.get(item.productId);
          if (!entry) continue;

          let qtyDelta = Number(item.quantity) || 0;
          if (transaction.type === 'RECEIPT' || transaction.type === 'RETURN') {
            // Addition
          } else if (transaction.type === 'ISSUE' || transaction.type === 'TRANSFER') {
            qtyDelta = -qtyDelta;
          }

          const productDocData = entry.snap.data() as any;
          let variantsUpdate = {};
          if (productDocData.variants && productDocData.variants.length > 0) {
            const updatedVariants = productDocData.variants.map((v: any) => {
              const isSkuMatch = item.sku && v.sku && v.sku === item.sku;
              const isVariantMatch = item.variant && 
                String(v.size) === String(item.variant.size) && 
                String(v.color) === String(item.variant.color);
              const generatedSku = `${productDocData.sku || 'PROD'}-${v.size}-${v.color}`;
              const isGeneratedSkuMatch = item.sku === generatedSku;

              if (isSkuMatch || isVariantMatch || isGeneratedSkuMatch) {
                return { ...v, quantity: (v.quantity || 0) + qtyDelta };
              }
              return v;
            });
            variantsUpdate = { variants: updatedVariants };
          }

          firestoreTransaction.update(entry.ref, {
            quantity: increment(qtyDelta),
            ...variantsUpdate,
            updatedAt: new Date().toISOString()
          });
        }

        firestoreTransaction.update(txRef, {
          status: 'COMPLETED',
          updatedAt: new Date().toISOString()
        });
      });
      return true;
    } catch (error: any) {
      console.error('Approve stock movement failed:', error);
      throw new Error(error.message || 'فشل اعتماد المعاملة');
    }
  },

  async updateStockMovement(id: string, oldTransaction: InventoryTransaction, newTransaction: Omit<InventoryTransaction, 'id' | 'createdAt'>) {
    try {
      await runTransaction(db, async (firestoreTransaction) => {
        // 1. COLLECT ALL PRODUCT REFS AND SNAPS (READS FIRST)
        const productMap = new Map<string, { ref: any, snap: any }>();
        
        // Collect from old transaction
        for (const item of oldTransaction.items) {
          if (!productMap.has(item.productId)) {
            const ref = doc(db, 'products', item.productId);
            const snap = await firestoreTransaction.get(ref);
            productMap.set(item.productId, { ref, snap });
          }
        }

        // Collect from new transaction
        for (const item of newTransaction.items) {
          if (!productMap.has(item.productId)) {
            const ref = doc(db, 'products', item.productId);
            const snap = await firestoreTransaction.get(ref);
            productMap.set(item.productId, { ref, snap });
          }
        }

        // 2. PERFORM ALL WRITES
        
        // Reversing old transaction effects (only if it was COMPLETED)
        if (oldTransaction.status === 'COMPLETED') {
          for (const item of oldTransaction.items) {
            const entry = productMap.get(item.productId);
            if (entry?.snap.exists()) {
              let reverseQty = Number(item.quantity) || 0;
              if (oldTransaction.type === 'RECEIPT' || oldTransaction.type === 'RETURN') {
                reverseQty = -reverseQty;
              }

              const productDocData = entry.snap.data() as any;
              let variantsUpdate = {};
              if (productDocData.variants && productDocData.variants.length > 0) {
                const updatedVariants = productDocData.variants.map((v: any) => {
                  const isSkuMatch = item.sku && v.sku && v.sku === item.sku;
                  const isVariantMatch = item.variant && 
                    String(v.size) === String(item.variant.size) && 
                    String(v.color) === String(item.variant.color);
                  const generatedSku = `${productDocData.sku || 'PROD'}-${v.size}-${v.color}`;
                  const isGeneratedSkuMatch = item.sku === generatedSku;

                  if (isSkuMatch || isVariantMatch || isGeneratedSkuMatch) {
                    return { ...v, quantity: (v.quantity || 0) + reverseQty };
                  }
                  return v;
                });
                variantsUpdate = { variants: updatedVariants };
              }

              firestoreTransaction.update(entry.ref, {
                quantity: increment(reverseQty),
                ...variantsUpdate
              });
            }
          }
        }

        // Applying new transaction effects (only if it is COMPLETED)
        if (newTransaction.status === 'COMPLETED') {
          for (const item of newTransaction.items) {
            const entry = productMap.get(item.productId);
            if (!entry?.snap.exists()) {
              throw new Error(`المنتج ${item.productName || item.productId} غير موجود`);
            }
            let qtyDelta = Number(item.quantity) || 0;
            if (newTransaction.type === 'RECEIPT' || newTransaction.type === 'RETURN') {
              // Addition
            } else if (newTransaction.type === 'ISSUE' || newTransaction.type === 'TRANSFER') {
              qtyDelta = -qtyDelta;
            }

            const productDocData = entry.snap.data() as any;
            let variantsUpdate = {};
            if (productDocData.variants && productDocData.variants.length > 0) {
              const updatedVariants = productDocData.variants.map((v: any) => {
                const isSkuMatch = item.sku && v.sku && v.sku === item.sku;
                const isVariantMatch = item.variant && 
                  String(v.size) === String(item.variant.size) && 
                  String(v.color) === String(item.variant.color);
                const generatedSku = `${productDocData.sku || 'PROD'}-${v.size}-${v.color}`;
                const isGeneratedSkuMatch = item.sku === generatedSku;

                if (isSkuMatch || isVariantMatch || isGeneratedSkuMatch) {
                  return { ...v, quantity: (v.quantity || 0) + qtyDelta };
                }
                return v;
              });
              variantsUpdate = { variants: updatedVariants };
            }

            firestoreTransaction.update(entry.ref, {
              quantity: increment(qtyDelta),
              ...variantsUpdate,
              updatedAt: new Date().toISOString()
            });
          }
        }

        // Update transaction record
        const txRef = doc(db, 'inventory_transactions', id);
        firestoreTransaction.update(txRef, {
          ...newTransaction,
          updatedAt: new Date().toISOString()
        });
      });
      return true;
    } catch (error: any) {
      console.error("Update stock movement failed:", error);
      throw new Error(error.message || "حدث خطأ أثناء تعديل الفاتورة");
    }
  },

  async deleteStockMovement(id: string, transaction: InventoryTransaction) {
    try {
      await runTransaction(db, async (firestoreTransaction) => {
        // 1. COLLECT ALL READS FIRST
        const productMap = new Map<string, { ref: any, snap: any }>();
        for (const item of transaction.items) {
          if (!item.productId) continue;
          if (!productMap.has(item.productId)) {
            const ref = doc(db, 'products', item.productId);
            const snap = await firestoreTransaction.get(ref);
            productMap.set(item.productId, { ref, snap });
          }
        }

        // 2. PERFORM ALL WRITES
        // Reverse transaction effects (only if it was COMPLETED)
        if (transaction.status === 'COMPLETED') {
          for (const item of transaction.items) {
            if (!item.productId) continue;
            const entry = productMap.get(item.productId);
            if (entry?.snap.exists()) {
              let reverseQty = Number(item.quantity) || 0;
              if (transaction.type === 'RECEIPT' || transaction.type === 'RETURN') {
                reverseQty = -reverseQty;
              }

              const productDocData = entry.snap.data() as any;
              let variantsUpdate = {};
              if (productDocData.variants && productDocData.variants.length > 0) {
                const updatedVariants = productDocData.variants.map((v: any) => {
                  const isSkuMatch = item.sku && v.sku && v.sku === item.sku;
                  const isVariantMatch = item.variant && 
                    String(v.size) === String(item.variant.size) && 
                    String(v.color) === String(item.variant.color);
                  const generatedSku = `${productDocData.sku || 'PROD'}-${v.size}-${v.color}`;
                  const isGeneratedSkuMatch = item.sku === generatedSku;

                  if (isSkuMatch || isVariantMatch || isGeneratedSkuMatch) {
                    return { ...v, quantity: (v.quantity || 0) + reverseQty };
                  }
                  return v;
                });
                variantsUpdate = { variants: updatedVariants };
              }

              firestoreTransaction.update(entry.ref, {
                quantity: increment(reverseQty),
                ...variantsUpdate,
                updatedAt: new Date().toISOString()
              });
            }
          }
        }

        // Delete the transaction doc
        const txRef = doc(db, 'inventory_transactions', id);
        firestoreTransaction.delete(txRef);
      });
      return true;
    } catch (error: any) {
      console.error("Delete stock movement failed:", error);
      throw new Error(error.message || "حدث خطأ أثناء حذف العملية");
    }
  }
};
