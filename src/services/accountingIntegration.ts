import { collection, query, getDocs, where, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, InventoryTransaction } from '../types';
import { accountingService } from './accounting';

export const accountingIntegration = {
  /**
   * Helper to ensure basic chart of accounts is generated if empty
   */
  async ensureAccountsExist() {
    try {
      const q = query(collection(db, 'accounts'));
      const snap = await getDocs(q);
      if (snap.empty) {
        console.log('Accounting accounts collection is empty. Generating demo accounts...');
        await accountingService.generateDemoAccounts();
      }
    } catch (err) {
      console.error('Error ensuring accounts exist:', err);
    }
  },

  /**
   * Post a completed POS order to accounting (Journal Entries + Customer loyalty)
   */
  async postInvoiceToAccounting(invoice: Order) {
    if (invoice.status !== 'COMPLETED') {
      console.log(`Invoice ${invoice.id} status is ${invoice.status}, not posting to accounting.`);
      return;
    }

    try {
      // 1. Idempotency Check: check if journal entry already exists for this order
      const jRef = query(collection(db, 'journal_entries'), where('reference', '==', invoice.id));
      const jSnap = await getDocs(jRef);
      if (!jSnap.empty) {
        console.log(`Journal entry for invoice ${invoice.id} already exists. Skipping.`);
        return;
      }

      // 2. Ensure accounts exist
      await this.ensureAccountsExist();

      // 3. Retrieve all accounts to find IDs
      const accounts = await accountingService.getAccounts();
      
      // Find debit account (Cash/Visa)
      let debitAccount = accounts.find(a => a.code === (invoice.paymentMethod === 'visa' ? '1112' : '1111'));
      if (!debitAccount) {
        // Fallback to cash account code 1111
        debitAccount = accounts.find(a => a.code === '1111');
      }
      if (!debitAccount) {
        // Generic fallback to any asset account
        debitAccount = accounts.find(a => a.type === 'ASSET');
      }

      // Find credit account (Sales Revenue)
      let creditAccount = accounts.find(a => a.code === '41');
      if (!creditAccount) {
        creditAccount = accounts.find(a => a.type === 'REVENUE');
      }

      if (!debitAccount || !creditAccount) {
        console.error('Could not find debit (Cash/Visa) or credit (Sales Revenue) accounts in the system.');
        return;
      }

      // 4. Post Journal Entry
      const entryDate = invoice.createdAt
        ? new Date(invoice.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const journalEntry = {
        date: entryDate,
        reference: invoice.id,
        description: `مبيعات نقطة البيع POS - فاتورة رقم #${invoice.id.slice(0, 8)}`,
        status: 'POSTED' as const,
        lines: [
          {
            accountId: debitAccount.id,
            accountName: debitAccount.name,
            debit: invoice.total,
            credit: 0,
            memo: invoice.paymentMethod === 'visa' ? 'مبيعات شبكة/فيزا' : 'مبيعات نقدية'
          },
          {
            accountId: creditAccount.id,
            accountName: creditAccount.name,
            debit: 0,
            credit: invoice.total,
            memo: 'إيرادات مبيعات POS'
          }
        ],
        createdBy: 'نظام المبيعات POS'
      };

      await accountingService.postJournalEntry(journalEntry);
      console.log(`Successfully posted journal entry for invoice ${invoice.id}`);

      // 5. Update Customer loyalty points
      if (invoice.customerId && invoice.customerId !== 'EXPENSE') {
        const customerRef = doc(db, 'customers', invoice.customerId);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          const data = customerSnap.data();
          const currentPoints = data.points || 0;
          const pointsEarned = Math.floor(invoice.total / 10); // 1 point per 10 EGP
          await updateDoc(customerRef, {
            points: currentPoints + pointsEarned
          });
          console.log(`Updated customer ${invoice.customerId} points. Added ${pointsEarned} points.`);
        }
      }
    } catch (err) {
      console.error('Error posting invoice to accounting:', err);
    }
  },

  /**
   * Post Goods Receipt to accounting (Supplier liabilities + Inventory asset)
   */
  async postGoodsReceiptToAccounting(receipt: InventoryTransaction) {
    if (receipt.status !== 'COMPLETED' || receipt.type !== 'RECEIPT') {
      return;
    }

    try {
      // 1. Idempotency Check
      const apRef = query(collection(db, 'accounts_payable'), where('reference', '==', receipt.id));
      const apSnap = await getDocs(apRef);
      if (!apSnap.empty) {
        console.log(`Accounts payable entry for receipt ${receipt.id} already exists. Skipping.`);
        return;
      }

      // Calculate total cost
      const totalCost = receipt.items.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
      if (totalCost <= 0) {
        console.log(`Total cost for receipt ${receipt.id} is 0. Skipping accounting posting.`);
        return;
      }

      // 2. Ensure accounts exist
      await this.ensureAccountsExist();

      // 3. Find accounts
      const accounts = await accountingService.getAccounts();
      
      // Debit: Inventory Asset (code 11 "الأصول المتداولة")
      let inventoryAccount = accounts.find(a => a.code === '11');
      if (!inventoryAccount) {
        inventoryAccount = accounts.find(a => a.type === 'ASSET');
      }

      // Credit: Accounts Payable / Suppliers (code 211 "الموردين")
      let supplierAccount = accounts.find(a => a.code === '211');
      if (!supplierAccount) {
        supplierAccount = accounts.find(a => a.type === 'LIABILITY');
      }

      if (!inventoryAccount || !supplierAccount) {
        console.error('Could not find inventory asset or supplier liability accounts in the system.');
        return;
      }

      // 4. Create Accounts Payable (Liability entry for Supplier)
      const supplierName = receipt.reference ? receipt.reference.trim() : 'مورد غير محدد';
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // Default due date 30 days from now

      const payableInvoice = {
        supplierName,
        reference: receipt.id,
        amount: totalCost,
        paidAmount: 0,
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'UNPAID' as const,
        notes: `فاتورة توريد بضاعة - إذن استلام رقم #${receipt.id.slice(0, 8)}`,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'accounts_payable'), payableInvoice);
      console.log(`Created accounts payable entry for supplier "${supplierName}" invoice total ${totalCost}`);

      // 5. Post Journal Entry
      const entryDate = receipt.createdAt
        ? new Date(receipt.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const journalEntry = {
        date: entryDate,
        reference: receipt.id,
        description: `توريد بضاعة للمخزن - إذن استلام رقم #${receipt.id.slice(0, 8)} للمورد ${supplierName}`,
        status: 'POSTED' as const,
        lines: [
          {
            accountId: inventoryAccount.id,
            accountName: inventoryAccount.name,
            debit: totalCost,
            credit: 0,
            memo: `شراء بضاعة للمستودع`
          },
          {
            accountId: supplierAccount.id,
            accountName: supplierAccount.name,
            debit: 0,
            credit: totalCost,
            memo: `استحقاق للمورد ${supplierName}`
          }
        ],
        createdBy: 'نظام إدارة المستودعات'
      };

      await accountingService.postJournalEntry(journalEntry);
      console.log(`Posted journal entry for goods receipt ${receipt.id}`);
    } catch (err) {
      console.error('Error posting goods receipt to accounting:', err);
    }
  },

  /**
   * Post Cash Receipt or Payment Transaction to accounting
   */
  async postCashTxToAccounting(tx: {
    type: 'RECEIPT' | 'PAYMENT';
    reference: string;
    party: string;
    description: string;
    amount: number;
    accountId: string;
    accountName: string;
    createdAt: string;
  }) {
    try {
      // 1. Idempotency Check
      const jRef = query(collection(db, 'journal_entries'), where('reference', '==', tx.reference));
      const jSnap = await getDocs(jRef);
      if (!jSnap.empty) {
        console.log(`Journal entry for cash tx ${tx.reference} already exists. Skipping.`);
        return;
      }

      // 2. Ensure accounts exist
      await this.ensureAccountsExist();

      // 3. Find accounts
      const accounts = await accountingService.getAccounts();
      const assetAccount = accounts.find(a => a.id === tx.accountId);
      if (!assetAccount) {
        console.error('Selected Cash/Bank asset account not found in database.');
        return;
      }

      let contraAccount;
      if (tx.type === 'RECEIPT') {
        // Receipt: Credit Sales Revenue or generic revenue
        contraAccount = accounts.find(a => a.code === '41');
        if (!contraAccount) {
          contraAccount = accounts.find(a => a.type === 'REVENUE');
        }
      } else {
        // Payment: Debit General Operating Expenses
        contraAccount = accounts.find(a => a.code === '511');
        if (!contraAccount) {
          contraAccount = accounts.find(a => a.type === 'EXPENSE');
        }
      }

      if (!contraAccount) {
        console.error('Could not find corresponding revenue/expense account.');
        return;
      }

      const entryDate = tx.createdAt
        ? tx.createdAt.split('T')[0]
        : new Date().toISOString().split('T')[0];

      const lines = tx.type === 'RECEIPT'
        ? [
            {
              accountId: assetAccount.id,
              accountName: assetAccount.name,
              debit: tx.amount,
              credit: 0,
              memo: tx.description || `استلام مقبوضات من ${tx.party}`
            },
            {
              accountId: contraAccount.id,
              accountName: contraAccount.name,
              debit: 0,
              credit: tx.amount,
              memo: tx.description || `إيداع مقبوضات لـ ${tx.party}`
            }
          ]
        : [
            {
              accountId: contraAccount.id,
              accountName: contraAccount.name,
              debit: tx.amount,
              credit: 0,
              memo: tx.description || `صرف مصروفات لـ ${tx.party}`
            },
            {
              accountId: assetAccount.id,
              accountName: assetAccount.name,
              debit: 0,
              credit: tx.amount,
              memo: tx.description || `صرف نقدية لـ ${tx.party}`
            }
          ];

      const journalEntry = {
        date: entryDate,
        reference: tx.reference,
        description: `حركة نقدية - ${tx.type === 'RECEIPT' ? 'إيصال مقبوضات' : 'أمر صرف'} مرجع ${tx.reference}`,
        status: 'POSTED' as const,
        lines,
        createdBy: 'نظام الصيرفة النقدية'
      };

      await accountingService.postJournalEntry(journalEntry);
      console.log(`Successfully posted cash tx journal entry for ${tx.reference}`);
    } catch (err) {
      console.error('Error posting cash transaction to accounting:', err);
    }
  }
};
