import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Database, Package, Box, ArrowDownLeft, ArrowRightLeft, History as HistoryIcon, ShieldCheck, Layers, FileText } from 'lucide-react';

const PAGE_CONFIG: Record<string, { title: string; subtitle: string; description: string; icon: React.ReactNode; exampleLink?: { to: string; label: string } }> = {
  '/inventory/item-map': {
    title: 'خريطة الأصناف',
    subtitle: 'تحديد مواقع المنتجات داخل المخازن والرفوف',
    description: 'صفحة لعرض وتعيين مواقع المنتجات داخل الأقسام والرفوف داخل المخازن، لمساعدة موظفي المخازن على إيجاد البضاعة بسرعة ودقة.',
    icon: <Package className="w-10 h-10 text-blue-600" />,
  },
  '/inventory/product-units': {
    title: 'وحدات القياس',
    subtitle: 'إدارة التحويلات بين الوحدات والوحدات الفرعية',
    description: 'هنا يمكن تسجيل وحدات القياس المختلفة للمنتجات، مثل القطعة، الزوج، الكرتونة، التحويلات بينها، والأسعار لكل وحدة.',
    icon: <Box className="w-10 h-10 text-green-600" />,
  },
  '/inventory/bulk-product-edit': {
    title: 'تعديل مجمع للأصناف',
    subtitle: 'تحديث بيانات مجموعة منتجات دفعة واحدة',
    description: 'واجهة لإجراء تعديلات مجمعة على أكثر من منتج في وقت واحد، مثل تحديث الأسعار أو الفئات أو حالة التفعيل.',
    icon: <Layers className="w-10 h-10 text-purple-600" />,
  },
  '/inventory/sales-returns': {
    title: 'مردودات مبيعات',
    subtitle: 'إرجاع المنتجات المباعة وإعادة تسجيلها في المخزون',
    description: 'صفحة لإدارة عمليات رد البضاعة المباعة وتعويض المخزون بها، مع توثيق الفاتورة الأصلية وحالة المنتج.',
    icon: <ArrowRightLeft className="w-10 h-10 text-orange-600" />,
  },
  '/inventory/purchase-returns': {
    title: 'مردودات مشتريات',
    subtitle: 'إرجاع البضاعة للموردين وخصمها من المخزون',
    description: 'تعامل مع إعادة البضاعة غير المرغوب بها أو المطيبة للموردين، وتحديث الأرصدة والتكاليف تلقائياً.',
    icon: <ArrowDownLeft className="w-10 h-10 text-red-600" />,
  },
  '/inventory/stock-issue': {
    title: 'صرف بضاعة',
    subtitle: 'إخراج السلع لأغراض التشغيل الداخلي أو الهدر',
    description: 'واجهة لتسجيل عمليات صرف المخزون من أجل الأنشطة الداخلية أو الاستهلاك، مع تتبع التكاليف والتسويات.',
    icon: <Database className="w-10 h-10 text-yellow-600" />,
  },
  '/inventory/opening-balance': {
    title: 'رصيد افتتاحي',
    subtitle: 'تسجيل الكميات الأولية عند بدء النظام',
    description: 'صفحة لإدخال الرصيد الافتتاحي للمخازن والمنتجات عند إطلاق النظام لأول مرة، بما يضمن حساباً دقيقاً للمخزون.',
    icon: <FileText className="w-10 h-10 text-slate-600" />,
  },
  '/inventory/approval': {
    title: 'تصديقات المخازن',
    subtitle: 'اعتماد ومراجعة عمليات المخزون قبل الترحيل',
    description: 'لوحة لمراجعة واعتماد أو رفض عمليات الجرد، التحويلات، وسندات الصرف قبل اعتمادها محاسبياً ومخزنياً.',
    icon: <ShieldCheck className="w-10 h-10 text-cyan-600" />,
  },
  '/inventory/branch-transfer-request': {
    title: 'طلب تحويل بضاعة',
    subtitle: 'طلب كاشير لتوريد بضائع من فرع آخر',
    description: 'واجهة لطلب تحويل مخزني بين الفروع، توجيه الطلب وإرفاق الكميات المرغوبة مع رصد حالة الطلب.',
    icon: <ArrowRightLeft className="w-10 h-10 text-fuchsia-600" />,
  },
};

export default function InventoryPlaceholderPage() {
  const location = useLocation();
  const config = PAGE_CONFIG[location.pathname] || null;

  if (!config) {
    return (
      <div className="p-10 text-right" dir="rtl">
        <h2 className="text-3xl font-black text-gray-900">الوصول غير موجود</h2>
        <p className="mt-4 text-gray-500">هذه الصفحة لم تُعرف بعد. الرجاء العودة إلى لوحة إدارة المخزون.</p>
        <Link to="/inventory" className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-2xl">العودة إلى لوحة المخزون</Link>
      </div>
    );
  }

  return (
    <div className="space-y-10 p-10" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center shadow-sm">
            {config.icon}
          </div>
          <div>
            <h1 className="text-4xl font-black text-gray-900">{config.title}</h1>
            <p className="text-gray-500 mt-2">{config.subtitle}</p>
          </div>
        </div>
        <Link
          to="/inventory"
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
        >
          العودة إلى اللوحة الرئيسية للمخزون
        </Link>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        <p className="text-gray-600 leading-relaxed text-lg">{config.description}</p>
        {config.exampleLink && (
          <div className="mt-8">
            <Link
              to={config.exampleLink.to}
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all"
            >
              {config.exampleLink.label}
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100">
          <h2 className="text-xl font-black text-blue-900 mb-3">لماذا هذه الصفحة؟</h2>
          <p className="text-gray-600 leading-relaxed">
            تم إعداد هذه الصفحة لتساعد في تنظيم هيكل إدارة المخازن الجديد، وستُحوّل إلى صفحة عملية لاحقاً. الآن يمكنك استخدامها كنقطة انطلاق لتطوير هذه الوحدة.
          </p>
        </div>
        <div className="bg-green-50 rounded-3xl p-6 border border-green-100">
          <h2 className="text-xl font-black text-green-900 mb-3">خطوات التطوير التالية</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-600 leading-relaxed">
            <li>تحديد بيانات Firestore المطلوبة لكل عملية.</li>
            <li>إضافة نماذج إدخال وإجراءات حفظ المخزون.</li>
            <li>ربط الصفحة بخدمات `inventoryTransactionService` أو `productsService`.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
