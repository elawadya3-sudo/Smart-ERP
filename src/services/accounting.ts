import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy,
  runTransaction,
  doc,
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

  async getJournalEntries() {
    const path = 'journal_entries';
    try {
      const q = query(collection(db, path), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as JournalEntry[];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
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
