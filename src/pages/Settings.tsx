import React, { useState, useEffect } from 'react';
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
  Loader2,
  Search,
  Upload,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { productsService, systemService } from '../services/firestore';
import { cn } from '../lib/utils';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import { useMainStoreSettings } from '../hooks/useMainStoreSettings';
import BarcodePrintModal from '../components/products/BarcodePrintModal';
import { Product } from '../types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

const schema = z.object({
  storeName: z.string().min(1, 'اسم المتجر مطلوب'),
  mainBranchName: z.string().min(1, 'اسم الفرع الرئيسي مطلوب'),
  currency: z.string().min(1, 'العملة مطلوبة'),
  branchEmail: z.string().email('البريد الإلكتروني غير صحيح').or(z.literal('')),
  phone: z.string().min(1, 'رقم الهاتف مطلوب'),
  taxEnabled: z.boolean().default(true),
  taxRate: z.number().min(0).max(100).default(15),
  allowCrossbranchRequest: z.boolean().default(false),
  allowAddMainWarehouse: z.boolean().default(true),
  returnDaysLimit: z.number().min(0, 'يجب أن يكون عدد الأيام 0 أو أكثر').default(14),
  receiptHeader: z.string().optional(),
  receiptFooter: z.string().optional(),
  showLogoInReceipt: z.boolean().default(true),
  receiptPaperSize: z.enum(['80mm', 'A4']).default('80mm'),
  taxRegistrationNumber: z.string().optional(),
  showTaxDetails: z.boolean().default(true),
  showBranchDetails: z.boolean().default(true),
  storeLogoUrl: z.string().optional(),
});

type SettingsFormData = z.infer<typeof schema>;

import SecuritySettings from '../components/settings/SecuritySettings';
import PageToolbar from '../components/ui/PageToolbar';

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

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedBarcodeProducts, setSelectedBarcodeProducts] = useState<Product[]>([]);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeSearchTerm, setBarcodeSearchTerm] = useState('');

  useEffect(() => {
    const loadAllProducts = async () => {
      try {
        const data = await productsService.getAll();
        setAllProducts(data);
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    };
    loadAllProducts();
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
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
      allowCrossbranchRequest: false,
      allowAddMainWarehouse: true,
      returnDaysLimit: 14,
      receiptHeader: 'شكراً لزيارتكم',
      receiptFooter: 'الفاتورة خاضعة لضريبة القيمة المضافة',
      showLogoInReceipt: true,
      receiptPaperSize: '80mm',
      taxRegistrationNumber: '',
      showTaxDetails: true,
      showBranchDetails: true,
      storeLogoUrl: ''
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
        allowCrossbranchRequest: settings.allowCrossbranchRequest ?? false,
        allowAddMainWarehouse: settings.allowAddMainWarehouse ?? true,
        returnDaysLimit: settings.returnDaysLimit ?? 14,
        receiptHeader: settings.receiptHeader || 'شكراً لزيارتكم',
        receiptFooter: settings.receiptFooter || 'الفاتورة خاضعة لضريبة القيمة المضافة',
        showLogoInReceipt: settings.showLogoInReceipt ?? true,
        receiptPaperSize: settings.receiptPaperSize || '80mm',
        taxRegistrationNumber: settings.taxRegistrationNumber || '',
        showTaxDetails: settings.showTaxDetails ?? true,
        showBranchDetails: settings.showBranchDetails ?? true,
        storeLogoUrl: settings.storeLogoUrl || '',
      });
    }
  }, [settings, reset]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('يرجى اختيار ملف صورة صالح', 'error');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const storageRef = ref(storage, `settings/logo/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setValue('storeLogoUrl', url);
      showToast('تم رفع الشعار بنجاح', 'success');
    } catch (error) {
      console.error('Logo upload error:', error);
      showToast('حدث خطأ أثناء رفع الشعار', 'error');
    } finally {
      setIsUploadingLogo(false);
    }
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
    <div className="space-y-6 relative pb-20 md:pb-0">
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

      <PageToolbar
        title={isRoot ? 'إدارة صلاحيات النسخة' : 'إعدادات النظام'}
        subtitle={isRoot ? 'التحكم في الأقسام والصلاحيات المتاحة لهذه النسخة' : 'تخصيص هوية المتجر والخيارات المتقدمة'}
        onSave={isAdmin && (activeTab === 'general' || activeTab === 'printers') ? handleSubmit(onSubmit) : undefined}
        onRefresh={() => {
          if (settings) {
            reset({
              storeName: settings.storeName || '',
              mainBranchName: settings.mainBranchName || 'فرع القاهرة الرئيسي',
              currency: settings.currency || 'EGP',
              branchEmail: settings.branchEmail || '',
              phone: settings.phone || '',
              taxEnabled: settings.taxEnabled ?? true,
              taxRate: settings.taxRate ?? 15,
              allowCrossbranchRequest: settings.allowCrossbranchRequest ?? false,
              allowAddMainWarehouse: settings.allowAddMainWarehouse ?? true,
              returnDaysLimit: settings.returnDaysLimit ?? 14,
              receiptHeader: settings.receiptHeader || 'شكراً لزيارتكم',
              receiptFooter: settings.receiptFooter || 'الفاتورة خاضعة لضريبة القيمة المضافة',
              showLogoInReceipt: settings.showLogoInReceipt ?? true,
              receiptPaperSize: settings.receiptPaperSize || '80mm',
              taxRegistrationNumber: settings.taxRegistrationNumber || '',
              showTaxDetails: settings.showTaxDetails ?? true,
              showBranchDetails: settings.showBranchDetails ?? true,
              storeLogoUrl: settings.storeLogoUrl || '',
            });
          }
        }}
        onPrint={() => window.print()}
      />

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

              {/* Store Logo Section */}
              <div className="md:col-span-2 flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100/80">
                <div className="relative flex-shrink-0">
                  {watch('storeLogoUrl') ? (
                    <div className="relative group w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center shadow-sm">
                      <img 
                        src={watch('storeLogoUrl')} 
                        alt="Store Logo" 
                        className="w-full h-full object-contain p-1"
                      />
                      {isAdmin && (
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setValue('storeLogoUrl', '')}
                            className="p-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                            title="حذف الشعار"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-2xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400">
                      <ImageIcon className="w-8 h-8 text-slate-300 mb-1" />
                      <span className="text-[10px] font-bold">بدون شعار</span>
                    </div>
                  )}
                  {isUploadingLogo && (
                    <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center md:text-right space-y-2">
                  <h4 className="text-sm font-black text-slate-800">شعار المتجر</h4>
                  <p className="text-xs text-slate-400 font-bold leading-relaxed">
                    اختر صورة لشعار متجرك الرئيسي (صيغة PNG أو JPG مفضلة). سيظهر في الفواتير وفي واجهة الكاشير.
                  </p>
                  {isAdmin && (
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-1">
                      <label className="cursor-pointer bg-blue-600 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-1.5 font-bold">
                        <Upload className="w-3.5 h-3.5" />
                        رفع شعار جديد
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                          className="hidden"
                        />
                      </label>
                      {watch('storeLogoUrl') && (
                        <button
                          type="button"
                          onClick={() => setValue('storeLogoUrl', '')}
                          className="bg-white border border-slate-200 text-slate-500 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-50 transition-all"
                        >
                          إزالة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
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
                {errors.storeName && <p className="text-xs text-red-500 font-bold px-1">{(errors.storeName.message as string)}</p>}
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
                {errors.mainBranchName && <p className="text-xs text-red-500 font-bold px-1">{(errors.mainBranchName.message as string)}</p>}
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
                {errors.currency && <p className="text-xs text-red-500 font-bold px-1">{(errors.currency.message as string)}</p>}
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
                {errors.branchEmail && <p className="text-xs text-red-500 font-bold px-1">{(errors.branchEmail.message as string)}</p>}
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
                {errors.phone && <p className="text-xs text-red-500 font-bold px-1">{(errors.phone.message as string)}</p>}
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
                <h3 className="font-bold text-gray-900">خيارات النظام المتقدمة</h3>
                <p className="text-sm text-gray-400 font-medium">تحكم في الصلاحيات والميزات المتقدمة للنظام</p>
              </div>
            </div>
            <div className="p-8 space-y-4">
              {/* Toggle 1: Cross-branch requests */}
              <div className="flex items-center justify-between bg-gradient-to-l from-blue-50/50 to-indigo-50/50 p-6 rounded-2xl border border-blue-100/50">
                <div className="flex-1">
                  <h4 className="text-sm font-black text-gray-900 mb-1">السماح بطلب تحويل مخزون من الفروع الأخرى</h4>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">
                    يتيح للكاشير البحث عن منتجات في الفروع الأخرى وطلب تحويلها — يتطلب موافقة المدير قبل الخصم
                  </p>
                </div>
                <div className="flex items-center gap-4 mr-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="allowCrossbranchRequest"
                      {...register('allowCrossbranchRequest')}
                      disabled={!isAdmin}
                      className="sr-only peer"
                    />
                    <div className={cn(
                      "w-14 h-7 rounded-full peer transition-all duration-300 peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-md",
                      "bg-gray-200 peer-checked:bg-blue-600",
                      !isAdmin && "opacity-60 cursor-not-allowed"
                    )} />
                  </label>
                </div>
              </div>

              {/* Toggle 2: Allow main warehouse creation */}
              <div className="flex items-center justify-between bg-gradient-to-l from-blue-50/50 to-indigo-50/50 p-6 rounded-2xl border border-blue-100/50">
                <div className="flex-1 text-right">
                  <h4 className="text-sm font-black text-gray-900 mb-1">السماح بإضافة مستودع رئيسي جديد</h4>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">
                    تفعيل أو إلغاء إمكانية إضافة مستودع من النوع "رئيسي" (Main) في صفحة إدارة المستودعات
                  </p>
                </div>
                <div className="flex items-center gap-4 mr-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="allowAddMainWarehouse"
                      {...register('allowAddMainWarehouse')}
                      disabled={!isAdmin}
                      className="sr-only peer"
                    />
                    <div className={cn(
                      "w-14 h-7 rounded-full peer transition-all duration-300 peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-md",
                      "bg-gray-200 peer-checked:bg-blue-600",
                      !isAdmin && "opacity-60 cursor-not-allowed"
                    )} />
                  </label>
                </div>
              </div>

              {/* Input for returnDaysLimit */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-l from-blue-50/50 to-indigo-50/50 p-6 rounded-2xl border border-blue-100/50 gap-4">
                <div className="flex-1 text-right">
                  <h4 className="text-sm font-black text-gray-900 mb-1">فترة سماح استرجاع المنتجات بالفواتير (بالأيام)</h4>
                  <p className="text-xs text-gray-400 font-medium leading-relaxed">
                    حدد عدد الأيام المسموح فيها للعميل باسترجاع المنتجات من تاريخ إصدار الفاتورة. (أدخل 0 لتعطيل الاسترجاع نهائياً).
                  </p>
                </div>
                <div className="w-full md:w-32">
                  <input
                    type="number"
                    {...register('returnDaysLimit', { valueAsNumber: true })}
                    readOnly={!isAdmin}
                    className={cn(
                      "w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-center text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none",
                      errors.returnDaysLimit ? "focus:ring-red-100 border-red-500" : "",
                      !isAdmin && "opacity-70 cursor-not-allowed"
                    )}
                  />
                  {errors.returnDaysLimit && <p className="text-[10px] text-red-500 font-bold mt-1 text-center">{(errors.returnDaysLimit.message as string)}</p>}
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
          
          {activeTab === 'printers' && (
            <div className="space-y-6">
              {/* Responsive Grid for Form & Live Preview */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Form side (col-span-7) */}
                <div className="xl:col-span-7 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">إعدادات الفواتير والطباعة</h3>
                    <p className="text-sm text-gray-400 font-medium">قم بتهيئة حجم الفاتورة والمعلومات الافتراضية للطباعة</p>
                  </div>
                  
                  {/* Paper Size Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-700">حجم ورق الطباعة الافتراضي</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 80mm Thermal */}
                      <label className={cn(
                        "relative flex items-center justify-between p-5 bg-slate-50 border-2 rounded-2xl cursor-pointer hover:border-blue-100 transition-all",
                        (watch('receiptPaperSize') || '80mm') === '80mm' ? "border-blue-600 bg-blue-50/20" : "border-gray-100"
                      )}>
                        <input
                          type="radio"
                          value="80mm"
                          {...register('receiptPaperSize')}
                          disabled={!isAdmin}
                          className="sr-only"
                        />
                        <div className="flex items-center gap-3">
                          <Printer className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">طابعة كاشير 80 مم</p>
                            <p className="text-[10px] text-slate-400 font-medium">فواتير حرارية متصلة بنقطة البيع</p>
                          </div>
                        </div>
                      </label>

                      {/* A4 Invoice */}
                      <label className={cn(
                        "relative flex items-center justify-between p-5 bg-slate-50 border-2 rounded-2xl cursor-pointer hover:border-blue-100 transition-all",
                        (watch('receiptPaperSize') || '80mm') === 'A4' ? "border-blue-600 bg-blue-50/20" : "border-gray-100"
                      )}>
                        <input
                          type="radio"
                          value="A4"
                          {...register('receiptPaperSize')}
                          disabled={!isAdmin}
                          className="sr-only"
                        />
                        <div className="flex items-center gap-3">
                          <Store className="w-5 h-5 text-indigo-600" />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">فاتورة A4 عادية</p>
                            <p className="text-[10px] text-slate-400 font-medium">فواتير رسمية للشركات والمخازن</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                    {/* Header text */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500">نص أعلى الفاتورة (الهيدر)</label>
                      <textarea
                        {...register('receiptHeader')}
                        readOnly={!isAdmin}
                        rows={2}
                        placeholder="مرحباً بكم في متجرنا"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold transition-all resize-none"
                      />
                    </div>

                    {/* Footer text */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500">نص أسفل الفاتورة (الفوتير)</label>
                      <textarea
                        {...register('receiptFooter')}
                        readOnly={!isAdmin}
                        rows={2}
                        placeholder="شكراً لزيارتكم"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold transition-all resize-none"
                      />
                    </div>

                    {/* Tax registration number */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500">الرقم الضريبي للمتجر (VAT No.)</label>
                      <input
                        type="text"
                        {...register('taxRegistrationNumber')}
                        readOnly={!isAdmin}
                        placeholder="الرقم الضريبي"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold transition-all"
                      />
                    </div>

                    {/* Logo URL */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500">رابط شعار المتجر</label>
                      <input
                        type="text"
                        {...register('storeLogoUrl')}
                        readOnly={!isAdmin}
                        placeholder="شعار الفاتورة"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold transition-all"
                      />
                    </div>
                  </div>

                  {/* Toggle Options */}
                  <div className="pt-4 border-t border-gray-50 space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">خيارات العرض</h4>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl cursor-pointer hover:bg-gray-100/50 transition-all">
                        <input
                          type="checkbox"
                          {...register('showLogoInReceipt')}
                          disabled={!isAdmin}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-gray-700">إظهار شعار المتجر</span>
                      </label>

                      <label className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl cursor-pointer hover:bg-gray-100/50 transition-all">
                        <input
                          type="checkbox"
                          {...register('showBranchDetails')}
                          disabled={!isAdmin}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-gray-700">إظهار بيانات الفرع (الهاتف/البريد)</span>
                      </label>

                      <label className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl cursor-pointer hover:bg-gray-100/50 transition-all">
                        <input
                          type="checkbox"
                          {...register('showTaxDetails')}
                          disabled={!isAdmin}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-gray-700">تفصيل الضريبة والمجموع الفرعي</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Preview side (col-span-5) */}
                <div className="xl:col-span-5 bg-slate-50 rounded-[2.5rem] border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-start min-h-[500px]">
                  <h4 className="font-bold text-gray-700 mb-4 self-start flex items-center gap-2">
                    <Store className="w-4 h-4 text-blue-600" />
                    معاينة حيّة للفاتورة
                  </h4>

                  {/* Dynamic Template rendering based on paper size */}
                  {(watch('receiptPaperSize') || '80mm') === '80mm' ? (
                    /* 80mm Receipt Preview */
                    <div className="bg-white w-[280px] shadow-md border border-gray-200/50 p-4 rounded-xl text-right text-[10px] text-slate-800 font-sans space-y-2 border-t-4 border-t-blue-600">
                      <div className="text-center space-y-1">
                        {watch('showLogoInReceipt') && watch('storeLogoUrl') ? (
                          <img src={watch('storeLogoUrl')} className="w-10 h-10 object-contain mx-auto rounded-lg" alt="Logo" />
                        ) : watch('showLogoInReceipt') ? (
                          <div className="w-10 h-10 bg-slate-100 rounded-lg mx-auto flex items-center justify-center text-slate-400 font-black">شعار</div>
                        ) : null}
                        <div className="font-black text-sm text-slate-900">{watch('storeName') || settings?.storeName || 'اسم المتجر'}</div>
                        <div className="font-bold text-slate-500">{watch('mainBranchName') || settings?.mainBranchName || 'الفرع الرئيسي'}</div>
                        {watch('receiptHeader') && (
                          <div className="text-[9px] text-slate-400 font-bold leading-relaxed">{watch('receiptHeader')}</div>
                        )}
                      </div>

                      <div className="border-t border-dashed border-slate-300 pt-2 space-y-0.5 text-[8px] text-slate-500">
                        <div>التاريخ: {new Date().toLocaleDateString('ar-EG')}</div>
                        <div>رقم الفاتورة: INV-12345678</div>
                        {watch('taxRegistrationNumber') && <div>الرقم الضريبي: {watch('taxRegistrationNumber')}</div>}
                        {watch('showBranchDetails') && (
                          <>
                            {settings?.phone && <div>الهاتف: {settings.phone}</div>}
                            {settings?.branchEmail && <div>البريد: {settings.branchEmail}</div>}
                          </>
                        )}
                      </div>

                      <div className="border-t border-dashed border-slate-300 pt-2">
                        <table className="w-full text-right text-[8px]">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="pb-1 font-bold">المنتج</th>
                              <th className="pb-1 text-center font-bold">الكمية</th>
                              <th className="pb-1 text-left font-bold">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="py-1">منتج تجريبي أ</td>
                              <td className="py-1 text-center">2</td>
                              <td className="py-1 text-left">40.00 EGP</td>
                            </tr>
                            <tr>
                              <td className="py-1">منتج تجريبي ب</td>
                              <td className="py-1 text-center">1</td>
                              <td className="py-1 text-left">15.00 EGP</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[9px]">
                        {watch('showTaxDetails') ? (
                          <>
                            <div className="flex justify-between">
                              <span>المجموع الفرعي:</span>
                              <span>55.00 EGP</span>
                            </div>
                            <div className="flex justify-between">
                              <span>الضريبة ({watch('taxRate') || 15}%):</span>
                              <span>8.25 EGP</span>
                            </div>
                          </>
                        ) : null}
                        <div className="flex justify-between font-black text-slate-900 text-xs border-t border-dashed border-slate-200 pt-1">
                          <span>الإجمالي النهائي:</span>
                          <span>{watch('showTaxDetails') ? '63.25 EGP' : '55.00 EGP'}</span>
                        </div>
                      </div>

                      <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[8px] text-slate-400 font-bold">
                        {watch('receiptFooter') || 'شكراً لتعاملكم معنا'}
                      </div>
                    </div>
                  ) : (
                    /* A4 Invoice Preview */
                    <div className="bg-white w-full max-w-[360px] shadow-md border border-gray-200/50 p-5 rounded-xl text-right text-[8px] text-slate-800 font-sans space-y-3 border-t-4 border-t-indigo-600">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          {watch('showLogoInReceipt') && watch('storeLogoUrl') ? (
                            <img src={watch('storeLogoUrl')} className="w-8 h-8 object-contain rounded-md" alt="Logo" />
                          ) : watch('showLogoInReceipt') ? (
                            <div className="w-8 h-8 bg-slate-100 rounded-md flex items-center justify-center text-slate-400 font-black">شعار</div>
                          ) : null}
                          <div>
                            <div className="font-black text-[10px] text-slate-900">{watch('storeName') || settings?.storeName || 'اسم المتجر'}</div>
                            <div className="text-[7px] text-slate-400 font-bold">{watch('mainBranchName') || settings?.mainBranchName || 'الفرع الرئيسي'}</div>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="font-black text-xs text-indigo-700">فاتورة ضريبية</div>
                          <div className="text-[6px] text-slate-400">رقم: INV-12345678</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[7px] bg-slate-50 p-2 rounded-lg">
                        <div>
                          <div className="font-bold text-indigo-900 mb-0.5">تفاصيل الفاتورة</div>
                          <div>التاريخ: {new Date().toLocaleDateString('ar-EG')}</div>
                          {watch('taxRegistrationNumber') && <div>الرقم الضريبي: {watch('taxRegistrationNumber')}</div>}
                        </div>
                        <div className="text-left">
                          {watch('showBranchDetails') && (
                            <>
                              {settings?.phone && <div>الهاتف: {settings.phone}</div>}
                              {settings?.branchEmail && <div>البريد: {settings.branchEmail}</div>}
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <table className="w-full text-right text-[7px]">
                          <thead>
                            <tr className="bg-indigo-900 text-white">
                              <th className="p-1 font-bold">#</th>
                              <th className="p-1 font-bold">المنتج</th>
                              <th className="p-1 text-center font-bold">الكمية</th>
                              <th className="p-1 text-left font-bold">سعر الوحدة</th>
                              <th className="p-1 text-left font-bold">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-100">
                              <td className="p-1">1</td>
                              <td className="p-1 font-bold">منتج تجريبي أ</td>
                              <td className="p-1 text-center">2</td>
                              <td className="p-1 text-left">20.00 EGP</td>
                              <td className="p-1 text-left font-bold">40.00 EGP</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="p-1">2</td>
                              <td className="p-1 font-bold">منتج تجريبي ب</td>
                              <td className="p-1 text-center">1</td>
                              <td className="p-1 text-left">15.00 EGP</td>
                              <td className="p-1 text-left font-bold">15.00 EGP</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-between items-start pt-1">
                        <div className="text-[6px] text-slate-400 border border-slate-200 rounded p-1 w-[40%] bg-slate-50">
                          {watch('taxRegistrationNumber') ? 'فاتورة ضريبية إلكترونية معتمدة' : 'فاتورة مبيعات مبسطة'}
                        </div>
                        <div className="w-[50%] text-[7px] space-y-0.5">
                          {watch('showTaxDetails') ? (
                            <>
                              <div className="flex justify-between text-slate-400">
                                <span>المجموع الفرعي:</span>
                                <span>55.00 EGP</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>الضريبة ({watch('taxRate') || 15}%):</span>
                                <span>8.25 EGP</span>
                              </div>
                            </>
                          ) : null}
                          <div className="flex justify-between font-black text-indigo-700 text-[9px] border-t border-slate-200 pt-1">
                            <span>الإجمالي النهائي:</span>
                            <span>{watch('showTaxDetails') ? '63.25 EGP' : '55.00 EGP'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-2 text-center text-[7px] text-slate-400 font-bold">
                        {watch('receiptFooter') || 'شكراً لتعاملكم معنا'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Barcode Quick Printer Panel inside Settings */}
              <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">طباعة باركود المنتجات</h3>
                    <p className="text-sm text-gray-400 font-medium">ابحث عن المنتجات واطبع ملصقات الباركود الخاصة بها مباشرة</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  <div className="space-y-2 relative">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">اختر المنتج لبدء طباعة الباركود</label>
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="ابحث بالاسم أو الباركود..."
                        value={barcodeSearchTerm}
                        onChange={e => setBarcodeSearchTerm(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    {/* Search Results Dropdown */}
                    {barcodeSearchTerm.trim() && (
                      <div className="absolute top-full right-0 left-0 bg-white border border-slate-100 shadow-xl rounded-2xl mt-2 max-h-48 overflow-y-auto z-20 divide-y divide-slate-50">
                        {allProducts
                          .filter(p => 
                            barcodeSearchTerm.trim() === '*' ||
                            p.name.toLowerCase().includes(barcodeSearchTerm.toLowerCase()) || 
                            (p.barcode && p.barcode.includes(barcodeSearchTerm))
                          )
                          .map(prod => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => {
                                setSelectedBarcodeProducts([prod]);
                                setIsBarcodeModalOpen(true);
                                setBarcodeSearchTerm('');
                              }}
                              className="w-full text-right px-4 py-3 hover:bg-slate-50 flex justify-between items-center text-sm font-bold text-slate-700"
                            >
                              <span>{prod.name}</span>
                              <span className="text-xs text-slate-400 font-mono">الباركود: {prod.barcode || 'بدون'}</span>
                            </button>
                          ))}
                        {allProducts.filter(p => 
                          barcodeSearchTerm.trim() === '*' ||
                          p.name.toLowerCase().includes(barcodeSearchTerm.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(barcodeSearchTerm))
                        ).length === 0 && (
                          <div className="p-4 text-center text-xs text-slate-400">لا توجد نتائج مطابقة</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        const productsWithBarcode = allProducts.filter(p => p.barcode);
                        if (productsWithBarcode.length === 0) {
                          alert('لا توجد منتجات تحتوي على باركود.');
                          return;
                        }
                        setSelectedBarcodeProducts(productsWithBarcode);
                        setIsBarcodeModalOpen(true);
                      }}
                      className="w-full md:w-auto px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4 text-slate-500" />
                      طباعة باركود لكافة المنتجات النشطة
                    </button>
                  </div>
                </div>
              </div>

              {/* Barcode print modal integration */}
              <BarcodePrintModal
                isOpen={isBarcodeModalOpen}
                onClose={() => {
                  setIsBarcodeModalOpen(false);
                  setSelectedBarcodeProducts([]);
                }}
                selectedProducts={selectedBarcodeProducts}
              />
            </div>
          )}

          {activeTab === 'localization' && (
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
