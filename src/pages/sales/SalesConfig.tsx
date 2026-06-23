import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Settings,
  Users,
  Save,
  CheckCircle2,
  FileText,
  Building2,
  Percent,
  Wallet,
  Coins,
  History as HistoryIcon
} from 'lucide-react';
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  ErpPageLayout,
  ErpPageHeader,
  ErpCard,
  ErpButton,
  ErpInput
} from '../../components/ui/ErpUI';
import { useAuth } from '../../context/AuthContext';

export default function SalesConfig() {
  const { subview } = useParams<{ subview: string }>();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Customer Settings States
  const [custSettings, setCustSettings] = useState({
    defaultCreditLimit: 50000,
    pointsPerSar: 1,
    tierGoldMin: 2000,
    tierPlatinumMin: 5000,
    allowDirectInvoicingWithoutRep: true,
    requireTaxNoForCorporate: true
  });

  // 2. Sales Module Settings States
  const [salesSettings, setSalesSettings] = useState({
    orderPrefix: 'SO-',
    returnPrefix: 'SR-',
    quotationPrefix: 'QT-',
    requireApprovalForOrdersOver: 50000,
    autoDecreaseInventoryOnDelivery: true,
    accountingSalesAccount: '410101', // Sales Revenue
    accountingReceivableAccount: '120101', // Customers Debit
    accountingTaxAccount: '220201', // VAT Liability
    accountingDiscountAccount: '410201', // Sales Discounts
    accountingCostAccount: '510101' // COGS
  });

  // Load Configurations
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const docRef = doc(db, 'settings', subview === 'settings' ? 'sales_module_configs' : 'sales_customer_configs');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          if (subview === 'settings') {
            setSalesSettings(prev => ({ ...prev, ...snap.data() }));
          } else {
            setCustSettings(prev => ({ ...prev, ...snap.data() }));
          }
        }
      } catch (err) {
        console.log('Using default client configurations');
      }
    };
    loadConfigs();
  }, [subview]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    const targetDoc = subview === 'settings' ? 'sales_module_configs' : 'sales_customer_configs';
    const payload = subview === 'settings' ? salesSettings : custSettings;

    // Activity Log
    const auditLog = {
      userEmail: user?.email || 'admin@nezam.com',
      userName: user?.name || 'مدير النظام',
      action: `تحديث إعدادات ${subview === 'settings' ? 'المبيعات العامة' : 'بيانات العملاء'}`,
      details: `حفظ إعدادات التهيئة للقسم: ${JSON.stringify(payload)}`,
      timestamp: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'settings', targetDoc), payload);
      try {
        await addDoc(collection(db, 'security_logs'), auditLog);
      } catch {}

      setSuccessMsg('تم حفظ الإعدادات بنجاح في النظام');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const updateCust = (key: string, val: any) => setCustSettings(p => ({ ...p, [key]: val }));
  const updateSales = (key: string, val: any) => setSalesSettings(p => ({ ...p, [key]: val }));

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={subview === 'settings' ? 'إعدادات المبيعات والربط المالي' : 'تهيئة بيانات العملاء ونظام الولاء'}
        description="ضبط معاملات الربط المحاسبي، الأرقام الافتتاحية للمستندات ونسب خصم نقاط الولاء"
        breadcrumbs={[{ label: 'الرئيسية' }, { label: 'المبيعات' }, { label: 'الضبط' }]}
      />

      <div className="max-w-3xl">
        <form onSubmit={handleSave} className="space-y-4">
          
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-250 text-emerald-700 px-4 py-2.5 rounded text-xs font-black flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {subview === 'customer-settings' ? (
            <ErpCard title="إعدادات العملاء ونظام الولاء" subtitle="تحديد الأرصدة الافتتاحية والحدود الائتمانية للعملاء">
              <div className="space-y-4 text-right">
                <div className="grid grid-cols-2 gap-4">
                  <ErpInput
                    label="الحد الائتماني الافتراضي للعملاء الجدد (ريال)"
                    type="number"
                    value={custSettings.defaultCreditLimit}
                    onChange={e => updateCust('defaultCreditLimit', Number(e.target.value))}
                  />
                  <ErpInput
                    label="معامل اكتساب النقاط مقابل الريال الواحد"
                    type="number"
                    step="0.1"
                    value={custSettings.pointsPerSar}
                    onChange={e => updateCust('pointsPerSar', Number(e.target.value))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <ErpInput
                    label="الحد الأدنى لنقاط الفئة الذهبية"
                    type="number"
                    value={custSettings.tierGoldMin}
                    onChange={e => updateCust('tierGoldMin', Number(e.target.value))}
                  />
                  <ErpInput
                    label="الحد الأدنى لنقاط الفئة البلاتينية"
                    type="number"
                    value={custSettings.tierPlatinumMin}
                    onChange={e => updateCust('tierPlatinumMin', Number(e.target.value))}
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={custSettings.allowDirectInvoicingWithoutRep}
                      onChange={e => updateCust('allowDirectInvoicingWithoutRep', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs text-slate-700 font-bold">السماح بإصدار فواتير مباشرة بدون تحديد مسؤول بيع</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={custSettings.requireTaxNoForCorporate}
                      onChange={e => updateCust('requireTaxNoForCorporate', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs text-slate-700 font-bold">إلزام إدخال الرقم الضريبي عند تسجيل عملاء الشركات</span>
                  </label>
                </div>
              </div>
            </ErpCard>
          ) : (
            <div className="space-y-4">
              <ErpCard title="تنسيق ترقيم مستندات المبيعات" subtitle="تخصيص البادئات التلقائية لأوامر البيع والمرتجع وعروض الأسعار">
                <div className="grid grid-cols-3 gap-3 text-right">
                  <ErpInput
                    label="بادئة أمر البيع (Sales Order)"
                    value={salesSettings.orderPrefix}
                    onChange={e => updateSales('orderPrefix', e.target.value)}
                  />
                  <ErpInput
                    label="بادئة مرتجع البيع (Return)"
                    value={salesSettings.returnPrefix}
                    onChange={e => updateSales('returnPrefix', e.target.value)}
                  />
                  <ErpInput
                    label="بادئة عرض السعر (Quotation)"
                    value={salesSettings.quotationPrefix}
                    onChange={e => updateSales('quotationPrefix', e.target.value)}
                  />
                </div>
              </ErpCard>

              <ErpCard title="إعدادات الربط المحاسبي (دليل الحسابات)" subtitle="تحديد الحسابات الدائنة والمدينة الافتراضية لقيود اليومية">
                <div className="space-y-3 text-right">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">حساب إيرادات المبيعات الرئيسي</label>
                      <select
                        value={salesSettings.accountingSalesAccount}
                        onChange={e => updateSales('accountingSalesAccount', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer font-bold"
                      >
                        <option value="410101">410101 - إيرادات مبيعات البضائع</option>
                        <option value="410102">410102 - إيرادات تقديم الخدمات</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">حساب ذمم العملاء المدينين</label>
                      <select
                        value={salesSettings.accountingReceivableAccount}
                        onChange={e => updateSales('accountingReceivableAccount', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer font-bold"
                      >
                        <option value="120101">120101 - العملاء المحليين</option>
                        <option value="120102">120102 - العملاء الخارجيين</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">حساب ضريبة المبيعات</label>
                      <select
                        value={salesSettings.accountingTaxAccount}
                        onChange={e => updateSales('accountingTaxAccount', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer font-bold"
                      >
                        <option value="220201">220201 - ضريبة القيمة المضافة المستحقة</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">حساب خصومات المبيعات</label>
                      <select
                        value={salesSettings.accountingDiscountAccount}
                        onChange={e => updateSales('accountingDiscountAccount', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer font-bold"
                      >
                        <option value="410201">410201 - الخصومات المسموح بها</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">حساب تكلفة البضاعة المباعة</label>
                      <select
                        value={salesSettings.accountingCostAccount}
                        onChange={e => updateSales('accountingCostAccount', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer font-bold"
                      >
                        <option value="510101">510101 - تكلفة البضاعة المباعة - مخازن</option>
                      </select>
                    </div>
                  </div>
                </div>
              </ErpCard>

              <ErpCard title="إعدادات المخزون والتفويض" subtitle="معاملات تفويض المبيعات وتأثيرها على المخزن">
                <div className="space-y-3 text-right">
                  <ErpInput
                    label="الحد الأقصى لقيمة أمر البيع قبل طلب تصديق المدير (ريال)"
                    type="number"
                    value={salesSettings.requireApprovalForOrdersOver}
                    onChange={e => updateSales('requireApprovalForOrdersOver', Number(e.target.value))}
                  />

                  <label className="flex items-center gap-2 cursor-pointer select-none pt-2">
                    <input
                      type="checkbox"
                      checked={salesSettings.autoDecreaseInventoryOnDelivery}
                      onChange={e => updateSales('autoDecreaseInventoryOnDelivery', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs text-slate-700 font-bold">صرف وتخفيض الكمية من المستودعات تلقائياً عند تأكيد تسليم أمر البيع</span>
                  </label>
                </div>
              </ErpCard>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-1.5 rounded text-xs font-black hover:bg-blue-700 transition-all cursor-pointer flex items-center gap-1.5 shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ الإعدادات</span>
            </button>
          </div>

        </form>
      </div>
    </ErpPageLayout>
  );
}
