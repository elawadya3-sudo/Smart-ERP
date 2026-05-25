import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, X, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Account } from '../../../types';
import { cn } from '../../../lib/utils';

const accountSchema = z.object({
  code: z.string().min(1, 'كود الحساب مطلوب'),
  name: z.string().min(1, 'اسم الحساب مطلوب'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  nature: z.enum(['DEBIT', 'CREDIT']),
  parentAccountId: z.string().nullable().optional(),
  openingBalance: z.coerce.number(),
  currency: z.string().min(1, 'العملة مطلوبة'),
  isActive: z.boolean(),
  notes: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AccountFormData) => Promise<void>;
  initialData: Account | null;
  accounts: Account[];
  parentAccountIdPreselected?: string;
}

export const AccountModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, accounts, parentAccountIdPreselected }) => {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: '',
      name: '',
      type: 'ASSET',
      nature: 'DEBIT',
      parentAccountId: parentAccountIdPreselected || null,
      openingBalance: 0,
      currency: 'EGP',
      isActive: true,
      notes: ''
    }
  });

  const selectedType = watch('type');

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        name: initialData.name,
        type: initialData.type,
        nature: initialData.nature,
        parentAccountId: initialData.parentAccountId || null,
        openingBalance: initialData.openingBalance || 0,
        currency: initialData.currency || 'EGP',
        isActive: initialData.isActive ?? true,
        notes: initialData.notes || ''
      });
    } else {
      reset({
        code: '',
        name: '',
        type: 'ASSET',
        nature: 'DEBIT',
        parentAccountId: parentAccountIdPreselected || null,
        openingBalance: 0,
        currency: 'EGP',
        isActive: true,
        notes: ''
      });
    }
  }, [initialData, isOpen, reset, parentAccountIdPreselected]);

  // Auto-set nature based on type
  useEffect(() => {
    if (!initialData) {
      if (selectedType === 'ASSET' || selectedType === 'EXPENSE') {
        reset((form) => ({ ...form, nature: 'DEBIT' }));
      } else {
        reset((form) => ({ ...form, nature: 'CREDIT' }));
      }
    }
  }, [selectedType, initialData, reset]);

  const onSubmit = async (data: AccountFormData) => {
    try {
      await onSave(data);
      onClose();
    } catch (error) {
      console.error('Failed to save account', error);
      alert('حدث خطأ أثناء حفظ الحساب');
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
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">{initialData ? 'تعديل بيانات الحساب' : 'إضافة حساب جديد'}</h2>
                  <p className="text-sm text-gray-500 font-medium mt-1">قم بتعبئة التفاصيل المالية الخاصة بالحساب</p>
                </div>
              </div>
              <button onClick={onClose} className="w-10 h-10 bg-white border border-gray-200 text-gray-500 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 md:p-8">
              <form id="accountForm" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <h3 className="font-black text-gray-900 border-b border-gray-100 pb-2">البيانات الأساسية</h3>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">كود الحساب <span className="text-red-500">*</span></label>
                      <input {...register('code')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" dir="ltr" placeholder="مثال: 10101" />
                      {errors.code && <p className="text-xs text-red-500 font-bold">{errors.code.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">اسم الحساب <span className="text-red-500">*</span></label>
                      <input {...register('name')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="مثال: البنك الأهلي" />
                      {errors.name && <p className="text-xs text-red-500 font-bold">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">الحساب الرئيسي (ارتباط شجري)</label>
                      <select {...register('parentAccountId')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                        <option value="">بدون حساب رئيسي (حساب مستوى أول)</option>
                        {accounts.filter(a => a.id !== initialData?.id).map(a => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Financial Info */}
                  <div className="space-y-6">
                    <h3 className="font-black text-gray-900 border-b border-gray-100 pb-2">التصنيف المالي</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">النوع <span className="text-red-500">*</span></label>
                        <select {...register('type')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                          <option value="ASSET">أصول</option>
                          <option value="LIABILITY">خصوم</option>
                          <option value="EQUITY">حقوق ملكية</option>
                          <option value="REVENUE">إيرادات</option>
                          <option value="EXPENSE">مصاريف</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">الطبيعة <span className="text-red-500">*</span></label>
                        <select {...register('nature')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                          <option value="DEBIT">مدين (Debit)</option>
                          <option value="CREDIT">دائن (Credit)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">الرصيد الافتتاحي <span className="text-red-500">*</span></label>
                        <input type="number" step="0.01" {...register('openingBalance')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" dir="ltr" />
                        {errors.openingBalance && <p className="text-xs text-red-500 font-bold">{errors.openingBalance.message}</p>}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">العملة <span className="text-red-500">*</span></label>
                        <input {...register('currency')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" dir="ltr" placeholder="EGP" />
                        {errors.currency && <p className="text-xs text-red-500 font-bold">{errors.currency.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">ملاحظات إضافية</label>
                      <textarea {...register('notes')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24" placeholder="اكتب أي تفاصيل أخرى عن الحساب..." />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <input type="checkbox" id="isActive" {...register('isActive')} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  <label htmlFor="isActive" className="text-sm font-bold text-gray-900 cursor-pointer">حساب نشط ومتاح للاستخدام في القيود</label>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-3">
              <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">إلغاء</button>
              <button form="accountForm" disabled={isSubmitting} type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> {isSubmitting ? 'جاري الحفظ...' : 'حفظ بيانات الحساب'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
