import { useState } from 'react';
import { 
  Store, 
  Shield, 
  Printer, 
  Globe, 
  Mail, 
  Phone,
  Save,
  Database,
  RefreshCw
} from 'lucide-react';
import { productsService } from '../services/firestore';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function Settings() {
  const [isSeeding, setIsSeeding] = useState(false);

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
      alert('تم استيراد بيانات العرض بنجاح!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">إعدادات النظام</h2>
          <p className="text-gray-500 mt-1">تخصيص هوية المتجر والخيارات المتقدمة</p>
        </div>
        <button className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all w-full sm:w-auto">
          <Save className="w-5 h-5" />
          حفظ التغييرات
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-2">
           {[
             { id: 'general', label: 'إعدادات عامة', icon: Store },
             { id: 'security', label: 'الأمان والصلاحيات', icon: Shield },
             { id: 'printers', label: 'الطابعات والفواتير', icon: Printer },
             { id: 'localization', label: 'اللغة والعملة', icon: Globe },
           ].map(tab => (
             <button key={tab.id} className={cn(
               "w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all",
               tab.id === 'general' ? "bg-white text-blue-600 shadow-sm border border-blue-50" : "text-gray-400 hover:text-gray-600 hover:bg-white"
             )}>
               <tab.icon className="w-5 h-5" />
               {tab.label}
             </button>
           ))}
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50">
              <h3 className="font-bold text-gray-900">بيانات المتجر الرئيسي</h3>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">اسم المتجر</label>
                <input type="text" defaultValue="رد أثر - للأحذية الفاخرة" className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">العملة الافتراضية</label>
                <select className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold appearance-none">
                   <option>الجنيه المصري (EGP)</option>
                   <option>الريال السعودي (SAR)</option>
                   <option>الدولار الأمريكي (USD)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">البريد الإلكتروني للفرع</label>
                <div className="relative">
                  <Mail className="absolute right-4 top-4 w-4 h-4 text-gray-300" />
                  <input type="email" defaultValue="cairo-branch@footprint.me" className="w-full bg-gray-50 border-none rounded-2xl pr-12 pl-4 py-3.5 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">رقم الهاتف</label>
                <div className="relative">
                  <Phone className="absolute right-4 top-4 w-4 h-4 text-gray-300" />
                  <input type="text" defaultValue="+20 123 456 789" className="w-full bg-gray-50 border-none rounded-2xl pr-12 pl-4 py-3.5 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-red-50/50 rounded-[2.5rem] border border-red-100 p-8 space-y-6">
            <div>
              <h3 className="font-bold text-red-600 mb-1 flex items-center gap-2">
                 <Database className="w-5 h-5" />
                 منطقة المطورين / البيانات
              </h3>
              <p className="text-sm text-red-400 font-medium tracking-tight">استخدم هذه الخيارات لتهيئة النظام ببيانات عرض أولية</p>
            </div>
            
            <button 
              onClick={seedData}
              disabled={isSeeding}
              className="bg-white border border-red-100 text-red-600 px-6 py-4 rounded-2xl font-bold text-sm shadow-sm hover:bg-red-50 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {isSeeding ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
              استيراد بيانات تجريبية (المنتجات)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



