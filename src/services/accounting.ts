import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy,
  runTransaction,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Account, JournalEntry, CostCenter } from '../types';

export const accountingService = {
  async getAccounts() {
    const path = 'accounts';
    try {
      const q = query(collection(db, path), orderBy('code', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Account[];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async addAccount(account: Omit<Account, 'id'>) {
    const path = 'accounts';
    try {
      const docRef = await addDoc(collection(db, path), account);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async updateAccount(accountId: string, updates: Partial<Account>) {
    const path = `accounts/${accountId}`;
    try {
      await updateDoc(doc(db, 'accounts', accountId), updates);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async deleteAccount(accountId: string) {
    const path = `accounts/${accountId}`;
    try {
      await deleteDoc(doc(db, 'accounts', accountId));
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async generateDemoAccounts() {
    const demoAccounts = [
      { code: '1', name: 'الأصول', type: 'ASSET', nature: 'DEBIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system', parentAccountId: null },
      { code: '11', name: 'الأصول المتداولة', type: 'ASSET', nature: 'DEBIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      { code: '111', name: 'النقدية بالخزينة والبنوك', type: 'ASSET', nature: 'DEBIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      { code: '1111', name: 'الخزينة الرئيسية', type: 'ASSET', nature: 'DEBIT', openingBalance: 50000, balance: 50000, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      { code: '1112', name: 'البنك الأهلي', type: 'ASSET', nature: 'DEBIT', openingBalance: 200000, balance: 200000, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      
      { code: '2', name: 'الخصوم', type: 'LIABILITY', nature: 'CREDIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system', parentAccountId: null },
      { code: '21', name: 'الخصوم المتداولة', type: 'LIABILITY', nature: 'CREDIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      { code: '211', name: 'الموردين', type: 'LIABILITY', nature: 'CREDIT', openingBalance: 15000, balance: 15000, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      
      { code: '3', name: 'حقوق الملكية', type: 'EQUITY', nature: 'CREDIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system', parentAccountId: null },
      { code: '31', name: 'رأس المال', type: 'EQUITY', nature: 'CREDIT', openingBalance: 235000, balance: 235000, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      
      { code: '4', name: 'الإيرادات', type: 'REVENUE', nature: 'CREDIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system', parentAccountId: null },
      { code: '41', name: 'إيرادات المبيعات', type: 'REVENUE', nature: 'CREDIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      
      { code: '5', name: 'المصروفات', type: 'EXPENSE', nature: 'DEBIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system', parentAccountId: null },
      { code: '51', name: 'مصروفات تشغيلية', type: 'EXPENSE', nature: 'DEBIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      { code: '511', name: 'رواتب وأجور', type: 'EXPENSE', nature: 'DEBIT', openingBalance: 0, balance: 0, currency: 'EGP', isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
    ];

    try {
      // Create root accounts first
      const roots = demoAccounts.filter(a => a.code.length === 1);
      const level2 = demoAccounts.filter(a => a.code.length === 2);
      const level3 = demoAccounts.filter(a => a.code.length === 3);
      const level4 = demoAccounts.filter(a => a.code.length === 4);

      const rootIds: Record<string, string> = {};
      for (const r of roots) {
        const ref = await addDoc(collection(db, 'accounts'), r);
        rootIds[r.code] = ref.id;
      }

      const l2Ids: Record<string, string> = {};
      for (const l2 of level2) {
        const parentId = rootIds[l2.code.charAt(0)];
        const ref = await addDoc(collection(db, 'accounts'), { ...l2, parentAccountId: parentId });
        l2Ids[l2.code] = ref.id;
      }

      const l3Ids: Record<string, string> = {};
      for (const l3 of level3) {
        const parentId = l2Ids[l3.code.substring(0, 2)];
        const ref = await addDoc(collection(db, 'accounts'), { ...l3, parentAccountId: parentId });
        l3Ids[l3.code] = ref.id;
      }

      for (const l4 of level4) {
        const parentId = l3Ids[l4.code.substring(0, 3)];
        await addDoc(collection(db, 'accounts'), { ...l4, parentAccountId: parentId });
      }

      return true;
    } catch (error) {
      console.error("Demo data generation failed", error);
      return false;
    }
  },

  async getJournalEntries() {
    const path = 'journal_entries';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as JournalEntry[];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  // --- COST CENTERS ---
  
  async getCostCenters() {
    const path = 'cost_centers';
    try {
      const q = query(collection(db, path), orderBy('code', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CostCenter[];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async addCostCenter(costCenter: Omit<CostCenter, 'id'>) {
    const path = 'cost_centers';
    try {
      const docRef = await addDoc(collection(db, path), costCenter);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async updateCostCenter(costCenterId: string, updates: Partial<CostCenter>) {
    const path = `cost_centers/${costCenterId}`;
    try {
      await updateDoc(doc(db, 'cost_centers', costCenterId), updates);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async deleteCostCenter(costCenterId: string) {
    const path = `cost_centers/${costCenterId}`;
    try {
      await deleteDoc(doc(db, 'cost_centers', costCenterId));
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async generateDemoCostCenters() {
    const demoData = [
      { code: '1000', name: 'الإدارة العامة', type: 'MAIN', branchId: null, budget: 500000, expenses: 150000, revenues: 0, isActive: true, createdAt: new Date().toISOString(), createdBy: 'system', parentCostCenterId: null, description: 'مركز التكلفة الرئيسي للإدارة' },
      { code: '1001', name: 'الموارد البشرية', type: 'SUB', branchId: null, budget: 100000, expenses: 45000, revenues: 0, isActive: true, createdAt: new Date().toISOString(), createdBy: 'system', description: 'إدارة شؤون الموظفين' },
      { code: '1002', name: 'تكنولوجيا المعلومات', type: 'SUB', branchId: null, budget: 200000, expenses: 80000, revenues: 0, isActive: true, createdAt: new Date().toISOString(), createdBy: 'system', description: 'مصاريف التقنية والسيرفرات' },
      { code: '2000', name: 'قطاع المبيعات', type: 'MAIN', branchId: null, budget: 300000, expenses: 50000, revenues: 1200000, isActive: true, createdAt: new Date().toISOString(), createdBy: 'system', parentCostCenterId: null },
      { code: '2001', name: 'مبيعات الجملة', type: 'SUB', branchId: null, budget: 150000, expenses: 20000, revenues: 800000, isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      { code: '2002', name: 'مبيعات التجزئة', type: 'SUB', branchId: null, budget: 150000, expenses: 30000, revenues: 400000, isActive: true, createdAt: new Date().toISOString(), createdBy: 'system' },
      { code: '3000', name: 'فروع الشركة', type: 'MAIN', branchId: null, budget: 800000, expenses: 200000, revenues: 950000, isActive: true, createdAt: new Date().toISOString(), createdBy: 'system', parentCostCenterId: null },
    ];

    try {
      const roots = demoData.filter(d => d.type === 'MAIN');
      const subs = demoData.filter(d => d.type === 'SUB');
      
      const rootIds: Record<string, string> = {};
      for (const r of roots) {
        const ref = await addDoc(collection(db, 'cost_centers'), r);
        rootIds[r.code] = ref.id;
      }

      for (const s of subs) {
        // Simple mock logic: HR and IT under Admin (1000), Wholesale/Retail under Sales (2000)
        let parentCode = s.code.substring(0, 1) + '000';
        const parentId = rootIds[parentCode] || null;
        await addDoc(collection(db, 'cost_centers'), { ...s, parentCostCenterId: parentId });
      }
      return true;
    } catch (error) {
      console.error("Demo cost centers generation failed", error);
      return false;
    }
  },

  async postJournalEntry(entry: Omit<JournalEntry, 'id' | 'createdAt'>) {
    try {
      await runTransaction(db, async (transaction) => {
        const entryRef = doc(collection(db, 'journal_entries'));
        transaction.set(entryRef, {
          ...entry,
          createdAt: new Date().toISOString(),
          status: 'POSTED'
        });

        // Update account balances
        for (const line of entry.lines) {
          const accountRef = doc(db, 'accounts', line.accountId);
          const accountSnap = await transaction.get(accountRef);
          if (accountSnap.exists()) {
            const currentBalance = accountSnap.data().balance || 0;
            const delta = line.debit - line.credit;
            transaction.update(accountRef, {
              balance: currentBalance + delta
            });
          }
        }
      });
      return true;
    } catch (error) {
      console.error("Journal entry posting failed", error);
      throw error;
    }
  }
};
