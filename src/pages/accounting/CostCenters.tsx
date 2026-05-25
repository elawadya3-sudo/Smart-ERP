import React, { useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw, FileSpreadsheet, Database, Table as TableIcon, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CostCenterDashboard } from './components/CostCenterDashboard';
import { CostCenterDataTable } from './components/CostCenterDataTable';
import { CostCenterModal } from './components/CostCenterModal';
import { useCostCenterStore } from '../../store/costCenterStore';
import { CostCenter } from '../../types';
import { accountingService } from '../../services/accounting';
import { cn } from '../../lib/utils';

export default function CostCentersPage() {
  const { costCenters, isLoading, loadCostCenters, addCostCenter, updateCostCenter, deleteCostCenter } = useCostCenterStore();
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('TABLE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadCostCenters();
  }, [loadCostCenters]);

  const handleOpenModal = (costCenter?: CostCenter) => {
    setEditingCostCenter(costCenter || null);
    setIsModalOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingCostCenter) {
      await updateCostCenter(editingCostCenter.id, { ...data, updatedAt: new Date().toISOString() });
    } else {
      await addCostCenter({
        ...data,
        expenses: 0,
        revenues: 0,
        createdAt: new Date().toISOString(),
        createdBy: 'user',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف مركز التكلفة هذا نهائياً؟')) {
      await deleteCostCenter(id);
    }
  };

  const handleGenerateDemo = async () => {
    if (confirm('سيتم إضافة مراكز تكلفة تجريبية كاملة. هل تود المتابعة؟')) {
      setIsGenerating(true);
      await accountingService.generateDemoCostCenters();
      await loadCostCenters();
      setIsGenerating(false);
    }
  };

  const exportToCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + "الكود,الاسم,النوع,الميزانية,المصروفات,الإيرادات,صافي الربح,الحالة\n"
      + costCenters.map(cc =>
        `${cc.code},${cc.name},${cc.type === 'MAIN' ? 'رئيسي' : 'فرعي'},${cc.budget},${cc.expenses},${cc.revenues},${cc.revenues - cc.expenses},${cc.isActive ? 'نشط' : 'موقوف'}`
      ).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "CostCenters.csv");
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
            <span className="text-blue-600">مراكز التكلفة</span>
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            مراكز التكلفة (Cost Centers)
          </h2>
          <p className="text-gray-500 mt-2 font-medium max-w-2xl leading-relaxed">
            إدارة ومتابعة مراكز التكلفة الخاصة بالشركة لتوزيع المصاريف والإيرادات على الأقسام والمشاريع بدقة تامة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button
            onClick={loadCostCenters}
            className="p-3 text-gray-400 bg-gray-50 hover:bg-gray-100 hover:text-gray-600 rounded-2xl transition-colors border border-gray-200"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportToCSV}
            className="bg-white text-gray-700 px-5 py-3 rounded-2xl border border-gray-200 font-bold text-sm shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <span className="hidden sm:inline">تصدير</span>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            إضافة مركز
          </button>
        </div>
      </div>

      {/* Dashboard */}
      {!isLoading && costCenters.length > 0 && (
        <CostCenterDashboard costCenters={costCenters} />
      )}

      {/* View Toggle & Demo */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-3 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto bg-gray-50 p-1 rounded-2xl border border-gray-100">
          <button
            onClick={() => setViewMode('TABLE')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${viewMode === 'TABLE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <TableIcon className="w-4 h-4" />
            جدول البيانات
          </button>
          <button
            onClick={() => setViewMode('CARDS')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${viewMode === 'CARDS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutGrid className="w-4 h-4" />
            عرض الكروت
          </button>
        </div>

        {costCenters.length === 0 && !isLoading && (
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

      {/* Main Content */}
      {isLoading ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-500 font-bold animate-pulse">جاري تحميل مراكز التكلفة...</p>
        </div>
      ) : costCenters.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-dashed border-gray-200 p-16 flex flex-col items-center justify-center min-h-[350px]">
          <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mb-6">
            <Building2 className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">لا توجد مراكز تكلفة بعد</h3>
          <p className="text-gray-500 font-medium text-center max-w-sm mb-6">
            ابدأ بإضافة مركز تكلفة جديد أو قم بتوليد بيانات تجريبية للمعاينة
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleGenerateDemo}
              disabled={isGenerating}
              className="bg-orange-50 text-orange-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-orange-100 border border-orange-100 transition-all flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              توليد بيانات Demo
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              إضافة مركز
            </button>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'TABLE' ? (
            <motion.div key="table" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <CostCenterDataTable
                costCenters={costCenters}
                onEdit={handleOpenModal}
                onDelete={handleDelete}
              />
            </motion.div>
          ) : (
            <motion.div key="cards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {costCenters.map((cc, i) => (
                  <motion.div
                    key={cc.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
                  >
                    <div className="flex justify-between items-start mb-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110",
                        cc.type === 'MAIN' ? "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white" : "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white"
                      )}>
                        <Building2 className="w-6 h-6" />
                      </div>
                      <span className={cn("px-3 py-1 rounded-full text-xs font-black uppercase", cc.isActive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                        {cc.isActive ? 'نشط' : 'متوقف'}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-gray-900 mb-1">{cc.name}</h3>
                    <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4">كود: {cc.code}</p>

                    {cc.budget > 0 && (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
                          <span>استهلاك الميزانية</span>
                          <span>{Math.round((cc.expenses / cc.budget) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", cc.expenses > cc.budget ? "bg-red-500" : "bg-blue-500")}
                            style={{ width: `${Math.min((cc.expenses / cc.budget) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-red-50 p-3 rounded-xl">
                        <p className="text-[10px] font-black text-red-400 uppercase">المصروفات</p>
                        <p className="font-black text-red-600 text-sm">{cc.expenses.toLocaleString()}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-xl">
                        <p className="text-[10px] font-black text-green-400 uppercase">الإيرادات</p>
                        <p className="font-black text-green-600 text-sm">{cc.revenues.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => handleOpenModal(cc)} className="flex-1 bg-gray-50 text-gray-600 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors">تعديل</button>
                      <button onClick={() => handleDelete(cc.id)} className="w-11 h-11 bg-gray-50 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <CostCenterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingCostCenter}
        costCenters={costCenters}
      />
    </div>
  );
}
