import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Wallet, Edit2, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Account } from '../../../types';
import { formatCurrency, cn } from '../../../lib/utils';

interface TreeItemProps {
  account: Account;
  accounts: Account[];
  level: number;
  onEdit: (account: Account) => void;
  onAddChild: (parentAccountId: string) => void;
}

const getAccountTypeColor = (type: string) => {
  switch (type) {
    case 'ASSET': return 'text-blue-600 bg-blue-50';
    case 'LIABILITY': return 'text-red-600 bg-red-50';
    case 'EQUITY': return 'text-purple-600 bg-purple-50';
    case 'REVENUE': return 'text-green-600 bg-green-50';
    case 'EXPENSE': return 'text-orange-600 bg-orange-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

const TreeItem: React.FC<TreeItemProps> = ({ account, accounts, level, onEdit, onAddChild }) => {
  const [isOpen, setIsOpen] = useState(false);
  const children = accounts.filter(a => a.parentAccountId === account.id).sort((a, b) => a.code.localeCompare(b.code));
  const hasChildren = children.length > 0;

  return (
    <div className="flex flex-col">
      <div 
        className={cn(
          "flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-100",
          isOpen && "bg-gray-50/50"
        )}
      >
        <div className="flex items-center gap-3">
          {/* Indentation Lines */}
          {Array.from({ length: level }).map((_, i) => (
            <div key={i} className="w-6 h-px bg-gray-200" />
          ))}
          
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors",
              !hasChildren && "opacity-0 pointer-events-none"
            )}
          >
            {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          </button>

          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", getAccountTypeColor(account.type))}>
            {hasChildren ? (isOpen ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />) : <Wallet className="w-4 h-4" />}
          </div>

          <div className="flex flex-col">
            <span className="font-bold text-gray-900 flex items-center gap-2">
              {account.code} - {account.name}
              {!account.isActive && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-full uppercase">غير نشط</span>}
            </span>
            <span className="text-xs text-gray-400 font-bold">{account.nature === 'DEBIT' ? 'طبيعة مدينة' : 'طبيعة دائنة'}</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <span className={cn("font-black text-sm", account.balance >= 0 ? "text-gray-900" : "text-red-500")}>
            {formatCurrency(account.balance)}
          </span>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onAddChild(account.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="إضافة حساب فرعي">
              <PlusCircle className="w-4 h-4" />
            </button>
            <button onClick={() => onEdit(account)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="تعديل الحساب">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col relative before:absolute before:right-[1.125rem] before:top-0 before:bottom-6 before:w-px before:bg-gray-200">
              {children.map(child => (
                <TreeItem key={child.id} account={child} accounts={accounts} level={level + 1} onEdit={onEdit} onAddChild={onAddChild} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface AccountTreeViewProps {
  accounts: Account[];
  onEdit: (account: Account) => void;
  onAddChild: (parentAccountId: string) => void;
}

export const AccountTreeView: React.FC<AccountTreeViewProps> = ({ accounts, onEdit, onAddChild }) => {
  const rootAccounts = useMemo(() => {
    return accounts.filter(a => !a.parentAccountId).sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts]);

  if (accounts.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
        <FolderOpen className="w-16 h-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-black text-gray-900 mb-2">لا توجد حسابات حالياً</h3>
        <p className="text-gray-500 max-w-sm">لم يتم إنشاء أي حسابات في شجرة الحسابات حتى الآن. يمكنك البدء بإنشاء حساب رئيسي.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="flex items-center justify-between px-4 pb-4 mb-4 border-b border-gray-100 text-sm font-black text-gray-400 uppercase tracking-widest">
          <span>هيكل الحسابات</span>
          <span>الرصيد / الإجراءات</span>
        </div>
        <div className="flex flex-col gap-1">
          {rootAccounts.map(account => (
            <TreeItem 
              key={account.id} 
              account={account} 
              accounts={accounts} 
              level={0} 
              onEdit={onEdit} 
              onAddChild={onAddChild} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};
