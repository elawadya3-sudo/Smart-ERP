import { useState, useEffect } from 'react';
import { 
  Store, 
  Shield, 
  Printer, 
  Globe, 
  Mail, 
  Phone,
  Save,
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { productsService, systemService } from '../services/firestore';
import { cn } from '../lib/utils';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import { useMainStoreSettings } from '../hooks/useMainStoreSettings';

const schema = z.object({
  storeName: z.string().min(1, 'اسم المتجر مطلوب'),
  mainBranchName: z.string().min(1, 'اسم الفرع الرئيسي مطلوب'),
  currency: z.string().min(1, 'العملة مطلوبة'),
  branchEmail: z.string().email('البريد الإلكتروني غير صحيح').or(z.literal('')),
  phone: z.string().min(1, 'رقم الهاتف مطلوب'),
  taxEnabled: z.boolean().default(true),
  taxRate: z.number().min(0).max(100).default(15),
  allowCrossbranchRequest: z.boolean().default(false),
});

type SettingsFormData = z.infer<typeof schema>;

import SecuritySettings from '../components/settings/SecuritySettings';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isRoot = user?.isRoot === true;
  const [activeTab, setActiveTab] = useState(isRoot ? 'security' : 'general');

  const { settings, loading: settingsLoading, updateSettings } = useMainStoreSettings();
  
  const [isSeeding, setIsSeeding] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      storeName: '',
      mainBranchName: 'فرع القاهرة الرئيسي',
      currency: 'EGP',
      branchEmail: '',
      phone: '',
      taxEnabled: true,
      taxRate: 15,
      allowCrossbranchRequest: false
    }
  });

  useEffect(() => {
    if (settings) {
      reset({
        storeName: settings.storeName || '',
        mainBranchName: settings.mainBranchName || 'فرع القاهرة الرئيسي',
        currency: settings.currency || 'EGP',
        branchEmail: settings.branchEmail || '',
        phone: settings.phone || '',
        taxEnabled: settings.taxEnabled ?? true,
        taxRate: settings.taxRate ?? 15,
        allowCrossbranchRequest: settings.allowCrossbranchRequest ?? false
      });
    }
  }, [settings, reset]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const onSubmit = async (data: any) => {
    if (!isAdmin) return;
    const success = await updateSettings(data as any);
    if (success) {
      showToast('تم حفظ البيانات بنجاح', 'success');
    } else {
      showToast('حدث خطأ أثناء الحفظ', 'error');
    }
  };

  const handleFullReset = async () => {
    if (confirmReset !== 'مسح الكل') {
      showToast('يرجى كتابة "مسح الكل" للتأكيد', 'error');
      return;
    }

    setIsResetting(true);
    try {
      const success = await systemService.resetData();
      if (success) {
        showToast('تمت إعادة تهيئة النظام بنجاح!', 'success');
        setConfirmReset('');
      } else {
        showToast('حدث خطأ أثناء إعادة التهيئة', 'error');
      }
    } finally {
      setIsResetting(false);
    }
  };

  const seedData = async () => {
    setIsSeeding(true);
    try {
      const demoProducts = [
        { name: 'Nike Air Max 270', brand: 'Nike', category: 'SNEAKERS', costPrice: 2000, sellingPrice: 3500, quantity: 25, sku: 'NK-270-W' },
        { name: 'Adidas Ultraboost 22', brand: 'Adidas', category: 'SPORT', costPrice: 2500, sellingPrice: 4200, quantity: 15, sku: 'AD-UB-22' },
        { name: 'Puma RS-X Bold', brand: 'Puma', category: 'SNEAKERS', costPrice: 1500, sellingPrice: 2800, quantity: 8, sku: 'PM-RSX' },
        { name: 'Jordan 1 Retro High', brand: 'Jordan', category: 'SNEAKERS', costPrice: 4000, sellingPrice: 7500, quantity: 3, sku: 'JD-1-RET' },
        { name: 'Classic Leather Brogue', brand: 'Clarks', category: 'CLASSIC', costPrice: 1200, sellingPrice: 2100, quantity: 20, sku: 'CL-BRG' },
      ];

      for (const p of demoProducts) {
        await productsService.add(p as any);
      }
      showToast('تم استيراد بيانات العرض بنجاح!', 'success');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء الاستيراد', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-8 relative pb-20 md:pb-0">
      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold text-sm shadow-xl flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-5",
          toast.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {isRoot ? 'إدارة صلاحيات النسخة' : 'إعدادات النظام'}
          </h2>
          <p className="text-gray-500 mt-1">
            {isRoot ? 'التحكم في الأقسام والصلاحيات المتاحة لهذه النسخة' : 'تخصيص هوية المتجر والخيارات المتقدمة'}
          </p>
        </div>
        {isAdmin && activeTab === 'general' && (
          <button 
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || settingsLoading}
            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all w-full sm:w-auto disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            حفظ التغييرات
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-2">
           {isRoot ? (
             <button 
              type="button" 
              className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm bg-white text-blue-600 shadow-sm border border-blue-50 text-right animate-in fade-in duration-300"
             >
               <Shield className="w-5 h-5 text-blue-600" />
               الأمان والصلاحيات
             </button>
           ) : (
             [
               { id: 'general', label: 'إعدادات عامة', icon: Store },
               { id: 'security', label: 'الأمان والصلاحيات', icon: Shield },
               { id: 'printers', label: 'الطابعات والفواتير', icon: Printer },
               { id: 'localization', label: 'اللغة والعملة', icon: Globe },
             ].map(tab => (
               <button 
                key={tab.id} 
                type="button" 
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all",
                  tab.id === activeTab ? "bg-white text-blue-600 shadow-sm border border-blue-50" : "text-gray-400 hover:text-gray-600 hover:bg-white"
                )}
               >
                 <tab.icon className="w-5 h-5" />
                 {tab.label}
               </button>
             ))
           )}
        </div>

        <div className="lg:col-span-3">
          {activeTab === 'general' && (
            <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">بيانات المتجر الرئيسي</h3>
              {settingsLoading && (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              )}
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              {settingsLoading && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px]"></div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">اسم المتجر</label>
                <input 
                  type="text" 
                  {...register('storeName')}
                  readOnly={!isAdmin}
                  className={cn(
                    "w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 focus:ring-4 outline-none text-sm font-bold transition-all",
                    errors.storeName ? "focus:ring-red-100 border border-red-500" : "focus:ring-blue-100",
                    !isAdmin && "opacity-70 cursor-not-allowed"
                  )} 
                />
                {errors.storeName && <p className="text-xs text-red-500 font-bold px-1">{errors.storeName.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">اسم الفرع الرئيسي</label>
                <input 
                  type="text" 
                  {...register('mainBranchName')}
                  readOnly={!isAdmin}
                  className={cn(
                    "w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 focus:ring-4 outline-none text-sm font-bold transition-all",
                    errors.mainBranchName ? "focus:ring-red-100 border border-red-500" : "focus:ring-blue-100",
                    !isAdmin && "opacity-70 cursor-not-allowed"
                  )} 
                />
                {errors.mainBranchName && <p className="text-xs text-red-500 font-bold px-1">{errors.mainBranchName.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">العملة الافتراضية</label>
                <select 
                  {...register('currency')}
                  disabled={!isAdmin}
                  className={cn(
                    "w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 focus:ring-4 outline-none text-sm font-bold appearance-none transition-all",
                    errors.currency ? "focus:ring-red-100 border border-red-500" : "focus:ring-blue-100",
                    !isAdmin && "opacity-70 cursor-not-allowed"
                  )}
                >
                   <option value="EGP">الجنيه المصري (EGP)</option>
                   <option value="SAR">الريال السعودي (SAR)</option>
                   <option value="USD">الدولار الأمريكي (USD)</option>
                </select>
                {errors.currency && <p className="text-xs text-red-500 font-bold px-1">{errors.currency.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">البريد الإلكتروني للفرع</label>
                <div className="relative">
                  <Mail className="absolute right-4 top-4 w-4 h-4 text-gray-300" />
                  <input 
                    type="email" 
                    {...register('branchEmail')}
                    readOnly={!isAdmin}
                    className={cn(
                      "w-full bg-gray-50 border-none rounded-2xl pr-12 pl-4 py-3.5 focus:ring-4 outline-none text-sm font-bold transition-all",
                      errors.branchEmail ? "focus:ring-red-100 border border-red-500" : "focus:ring-blue-100",
                      !isAdmin && "opacity-70 cursor-not-allowed"
                    )}
                  />
                </div>
                {errors.branchEmail && <p className="text-xs text-red-500 font-bold px-1">{errors.branchEmail.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">رقم الهاتف</label>
                <div className="relative">
                  <Phone className="absolute right-4 top-4 w-4 h-4 text-gray-300" />
                  <input 
                    type="text" 
                    {...register('phone')}
                    readOnly={!isAdmin}
                    className={cn(
                      "w-full bg-gray-50 border-none rounded-2xl pr-12 pl-4 py-3.5 focus:ring-4 outline-none text-sm font-bold transition-all",
                      errors.phone ? "focus:ring-red-100 border border-red-500" : "focus:ring-blue-100",
                      !isAdmin && "opacity-70 cursor-not-allowed"
                    )}
                  />
                </div>
                {errors.phone && <p className="text-xs text-red-500 font-bold px-1">{errors.phone.message}</p>}
              </div>

              {/* Tax Settings Section */}
              <div className="md:col-span-2 mt-4 pt-6 border-t border-gray-50">
                <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  إعدادات الضريبة (VAT)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-transparent hover:border-blue-100 transition-all cursor-pointer">
                    <input 
                      type="checkbox" 
                      id="taxEnabled"
                      {...register('taxEnabled')}
                      disabled={!isAdmin}
                      className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="taxEnabled" className="text-sm font-bold text-gray-700 cursor-pointer">تفعيل الضريبة على كافة الفواتير</label>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">نسبة الضريبة (%)</label>
                    <input 
                      type="number" 
                      {...register('taxRate', { valueAsNumber: true })}
                      readOnly={!isAdmin}
                      placeholder="15"
                      className={cn(
                        "w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-4 outline-none text-sm font-bold transition-all",
                        errors.taxRate ? "focus:ring-red-100 border border-red-500" : "focus:ring-blue-100",
                        !isAdmin && "opacity-70 cursor-not-allowed"
                      )} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cross-Branch Request Feature Section */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">خيارات نقطة البيع المتقدمة</h3>
                <p className="text-sm text-gray-400 font-medium">تحكم في صلاحيات وميزات نقطة البيع</p>
              </div>
            </div>
            <div className="p-8">
              <div className="flex items-center justify-between bg-gradient-to-l from-blue-50/50 to-indigo-50/50 p-6 rounded-2xl border border-blue-100/50">
                <div className="flex-1">
                  <h4 className="text-sm font-black text-gray-900 mb-1">السماح بطلب تحويل مخزون من الفروع الأخرى</h4>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">
                    يتيح للكاشير البحث عن منتجات في الفروع الأخرى وطلب تحويلها — يتطلب موافقة المدير قبل الخصم
                  </p>
                </div>
                <div className="flex items-center gap-4 mr-6">
                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="allowCrossbranchRequest"
                      {...register('allowCrossbranchRequest')}
                      disabled={!isAdmin}
                      className="sr-only peer"
                    />
                    <div className={cn(
                      "w-14 h-7 rounded-full peer transition-all duration-300 peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:right-0.5 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-md",
                      "bg-gray-200 peer-checked:bg-blue-600",
                      !isAdmin && "opacity-60 cursor-not-allowed"
                    )} />
                  </label>
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest min-w-[40px]">
                    {/* Dynamic label placeholder — actual value driven by checkbox */}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {(!user?.permissions || user.permissions.systemReset) && (
            <div className="bg-red-50/50 rounded-[2.5rem] border border-red-100 p-8 space-y-8">
              <div>
                <h3 className="font-bold text-red-600 mb-1 flex items-center gap-2">
                   <Database className="w-5 h-5" />
                   منطقة المطورين / البيانات المتقدمة
                </h3>
                <p className="text-sm text-red-400 font-medium tracking-tight">تحكم في قاعدة البيانات وعمليات التهيئة الشاملة</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button 
                  type="button"
                  onClick={seedData}
                  disabled={isSeeding || isResetting}
                  className="bg-white border border-red-100 text-red-600 px-6 py-4 rounded-2xl font-bold text-sm shadow-sm hover:bg-red-50 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {isSeeding ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                  استيراد بيانات تجريبية (المنتجات)
                </button>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      placeholder='اكتب "مسح الكل" للتأكيد'
                      className="w-full bg-white border border-red-100 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-red-200"
                      value={confirmReset}
                      onChange={(e) => setConfirmReset(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={handleFullReset}
                      disabled={isResetting || isSeeding}
                      className="bg-red-600 text-white px-6 py-4 rounded-2xl font-bold text-sm shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                    >
                      {isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                      مسح كافة بيانات النظام
                    </button>
                  </div>
                  <p className="text-[10px] text-red-400 font-bold text-center">تحذير: هذا الإجراء سيقوم بحذف كافة الفواتير والمنتجات والعمليات نهائياً.</p>
                </div>
              </div>
            </div>
          )}
        </div>
          )}

          {activeTab === 'security' && <SecuritySettings />}
          
          {(activeTab === 'printers' || activeTab === 'localization') && (
            <div className="bg-white rounded-[3rem] p-12 border border-gray-100 shadow-sm text-center">
              <div className="w-20 h-20 bg-gray-50 text-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                 <RefreshCw className="w-10 h-10" />
              </div>
              <h4 className="text-xl font-black text-gray-900 mb-2">قريباً في التحديث القادم</h4>
              <p className="text-gray-400 font-bold">هذه الإعدادات سيتم تفعيلها في الإصدار القادم من النظام.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
