import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, X, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CostCenter } from '../../../types';
import { cn } from '../../../lib/utils';

const costCenterSchema = z.object({
  code: z.string().min(1, 'كود المركز مطلوب'),
  name: z.string().min(1, 'اسم المركز مطلوب'),
  type: z.enum(['MAIN', 'SUB']),
  parentCostCenterId: z.string().nullable().optional(),
  budget: z.coerce.number().min(0, 'الميزانية يجب أن تكون موجبة'),
  isActive: z.boolean(),
  description: z.string().optional(),
});

type CostCenterFormData = z.infer<typeof costCenterSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CostCenterFormData) => Promise<void>;
  initialData: CostCenter | null;
  costCenters: CostCenter[];
}

export const CostCenterModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, costCenters }) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: {
      code: '',
      name: '',
      type: 'SUB',
      parentCostCenterId: null,
      budget: 0,
      isActive: true,
      description: ''
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        name: initialData.name,
        type: initialData.type,
        parentCostCenterId: initialData.parentCostCenterId || null,
        budget: initialData.budget || 0,
        isActive: initialData.isActive ?? true,
        description: initialData.description || ''
      });
    } else {
      reset({
        code: '',
        name: '',
        type: 'SUB',
        parentCostCenterId: null,
        budget: 0,
        isActive: true,
        description: ''
      });
    }
  }, [initialData, isOpen, reset]);

  const onSubmit = async (data: any) => {
    try {
      await onSave(data);
      onClose();
    } catch (error) {
      console.error('Failed to save cost center', error);
      alert('حدث خطأ أثناء حفظ مركز التكلفة');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]"
          >
            <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">{initialData ? 'تعديل مركز التكلفة' : 'إضافة مركز تكلفة جديد'}</h2>
                  <p className="text-sm text-gray-500 font-medium mt-1">قم بتعبئة التفاصيل الخاصة بمركز التكلفة</p>
                </div>
              </div>
              <button onClick={onClose} className="w-10 h-10 bg-white border border-gray-200 text-gray-500 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 md:p-8">
              <form id="costCenterForm" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <h3 className="font-black text-gray-900 border-b border-gray-100 pb-2">البيانات الأساسية</h3>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">كود المركز <span className="text-red-500">*</span></label>
                      <input {...register('code')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" dir="ltr" placeholder="مثال: 1000" />
                      {errors.code && <p className="text-xs text-red-500 font-bold">{errors.code.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">اسم المركز <span className="text-red-500">*</span></label>
                      <input {...register('name')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="مثال: إدارة المبيعات" />
                      {errors.name && <p className="text-xs text-red-500 font-bold">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">النوع <span className="text-red-500">*</span></label>
                      <select {...register('type')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                        <option value="MAIN">رئيسي (تجميعي)</option>
                        <option value="SUB">فرعي (مباشر)</option>
                      </select>
                    </div>
                  </div>

                  {/* Financial & Hierarchy Info */}
                  <div className="space-y-6">
                    <h3 className="font-black text-gray-900 border-b border-gray-100 pb-2">التصنيف والميزانية</h3>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">المركز الرئيسي (إن وجد)</label>
                      <select {...register('parentCostCenterId')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                        <option value="">بدون مركز رئيسي</option>
                        {costCenters.filter(cc => cc.type === 'MAIN' && cc.id !== initialData?.id).map(cc => (
                          <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">الميزانية المخصصة <span className="text-red-500">*</span></label>
                      <input type="number" step="0.01" {...register('budget')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" dir="ltr" />
                      {errors.budget && <p className="text-xs text-red-500 font-bold">{errors.budget.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">الوصف</label>
                      <textarea {...register('description')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24" placeholder="اكتب وصفاً موجزاً لمركز التكلفة..." />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <input type="checkbox" id="isActive" {...register('isActive')} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  <label htmlFor="isActive" className="text-sm font-bold text-gray-900 cursor-pointer">مركز تكلفة نشط ومتاح للاستخدام</label>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-3">
              <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">إلغاء</button>
              <button form="costCenterForm" disabled={isSubmitting} type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> {isSubmitting ? 'جاري الحفظ...' : 'حفظ بيانات المركز'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
