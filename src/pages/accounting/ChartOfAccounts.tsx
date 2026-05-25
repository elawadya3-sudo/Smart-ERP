import React, { useEffect, useState } from 'react';
import { 
  FolderTree, 
  Plus, 
  Settings2, 
  FileSpreadsheet,
  RefreshCw,
  Database,
  Table as TableIcon
} from 'lucide-react';
import { AccountDashboard } from './components/AccountDashboard';
import { AccountTreeView } from './components/AccountTreeView';
import { AccountDataTable } from './components/AccountDataTable';
import { AccountModal } from './components/AccountModal';
import { useAccountingStore } from '../../store/accountingStore';
import { Account } from '../../types';
import { getAccountTypeLabel } from '../../lib/utils';
import { accountingService } from '../../services/accounting';

export default function ChartOfAccountsPage() {
  const { accounts, isLoading, loadAccounts, addAccount, updateAccount, deleteAccount } = useAccountingStore();
  const [viewMode, setViewMode] = useState<'TREE' | 'TABLE'>('TREE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [parentAccountIdPreselected, setParentAccountIdPreselected] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleOpenModal = (account?: Account, parentId?: string) => {
    if (account) {
      setEditingAccount(account);
      setParentAccountIdPreselected('');
    } else {
      setEditingAccount(null);
      setParentAccountIdPreselected(parentId || '');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingAccount) {
      await updateAccount(editingAccount.id, data);
    } else {
      await addAccount({
        ...data,
        balance: data.openingBalance, // Initial balance equals opening balance
        createdAt: new Date().toISOString(),
        createdBy: 'user', // should get from auth but keeping it simple
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الحساب نهائياً؟')) {
      await deleteAccount(id);
    }
  };

  const handleGenerateDemo = async () => {
    if (confirm('هذا الإجراء سيقوم بإضافة شجرة حسابات تجريبية كاملة. هل تود المتابعة؟')) {
      setIsGenerating(true);
      await accountingService.generateDemoAccounts();
      await loadAccounts();
      setIsGenerating(false);
    }
  };

  const exportToExcel = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + "الكود,اسم الحساب,النوع,الطبيعة,الرصيد الافتتاحي,الرصيد الحالي,العملة,الحالة\n"
      + accounts.map(a => `${a.code},${a.name},${a.type},${a.nature === 'DEBIT' ? 'مدين' : 'دائن'},${a.openingBalance},${a.balance},${a.currency},${a.isActive ? 'نشط' : 'موقوف'}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ChartOfAccounts_Enterprise.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      {/* Enterprise Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-gray-400 mb-2">
            <span>النظام المالي</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-blue-600">دليل الحسابات</span>
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <FolderTree className="w-8 h-8 text-blue-600" />
            دليل الحسابات (Chart of Accounts)
          </h2>
          <p className="text-gray-500 mt-2 font-medium max-w-2xl leading-relaxed">
            هيكلة مالية احترافية لإدارة شجرة الحسابات الخاصة بالشركة، تصنيف الأصول والخصوم والمصروفات بدقة لضمان تقارير مالية صحيحة.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={loadAccounts} 
            className="p-3 text-gray-400 bg-gray-50 hover:bg-gray-100 hover:text-gray-600 rounded-2xl transition-colors border border-gray-200"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          
          <button 
            onClick={exportToExcel} 
            className="bg-white text-gray-700 px-5 py-3 rounded-2xl border border-gray-200 font-bold text-sm shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <span className="hidden sm:inline">تصدير إكسل</span>
          </button>

          <button 
            onClick={() => handleOpenModal()} 
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            إضافة حساب
          </button>
        </div>
      </div>

      {/* Dashboard Statistics */}
      <AccountDashboard accounts={accounts} />

      {/* View Toggles & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-3 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto bg-gray-50 p-1 rounded-2xl border border-gray-100">
          <button 
            onClick={() => setViewMode('TREE')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${viewMode === 'TREE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FolderTree className="w-4 h-4" />
            العرض الشجري
          </button>
          <button 
            onClick={() => setViewMode('TABLE')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${viewMode === 'TABLE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <TableIcon className="w-4 h-4" />
            جدول البيانات
          </button>
        </div>

        {accounts.length === 0 && (
          <button 
            onClick={handleGenerateDemo}
            disabled={isGenerating}
            className="w-full sm:w-auto bg-orange-50 text-orange-600 px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-orange-100 transition-all flex items-center justify-center gap-2 border border-orange-100 disabled:opacity-50"
          >
            <Database className={`w-4 h-4 ${isGenerating ? 'animate-bounce' : ''}`} />
            {isGenerating ? 'جاري التوليد...' : 'توليد بيانات تجريبية (Demo)'}
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-bold animate-pulse">جاري تحميل دليل الحسابات...</p>
        </div>
      ) : (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          {viewMode === 'TREE' ? (
            <AccountTreeView 
              accounts={accounts} 
              onEdit={(acc) => handleOpenModal(acc)} 
              onAddChild={(parentId) => handleOpenModal(undefined, parentId)} 
            />
          ) : (
            <AccountDataTable 
              accounts={accounts} 
              onEdit={(acc) => handleOpenModal(acc)} 
              onDelete={handleDelete} 
            />
          )}
        </div>
      )}

      {/* Account Modal */}
      <AccountModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave} 
        initialData={editingAccount} 
        accounts={accounts}
        parentAccountIdPreselected={parentAccountIdPreselected}
      />
    </div>
  );
}


