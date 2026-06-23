import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Download,
  Printer,
  Pencil,
  Trash2,
  X,
  Building2,
  Box,
  Layers,
  BarChart3,
  Percent,
  ScrollText,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn, formatCurrency } from '../../lib/utils';
import {
  ErpPageLayout,
  ErpPageHeader,
  ErpCard,
  ErpButton,
  ErpInput
} from '../../components/ui/ErpUI';
import { useAuth } from '../../context/AuthContext';

export default function SalesBasicData() {
  const { subview } = useParams<{ subview: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Dynamic Data Lists
  const [dataList, setDataList] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);

  // Form State
  const [formState, setFormState] = useState<any>({});

  // 1. Resolve collection names
  const getCollectionName = () => {
    switch (subview) {
      case 'customers': return 'sales_customers';
      case 'reps': return 'sales_representatives';
      case 'services': return 'sales_services';
      case 'sales-show': return 'sales_orders';
      case 'branches': return 'sales_branches';
      case 'quotas': return 'sales_quotas';
      case 'targets': return 'sales_targets';
      case 'incentives': return 'sales_incentives';
      case 'price-lists': return 'sales_price_lists';
      default: return 'sales_customers';
    }
  };

  // Fetch branches/warehouses for selections
  useEffect(() => {
    const q = query(collection(db, 'warehouses'));
    const unsub = onSnapshot(q, (snapshot) => {
      setWarehouses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch sales representatives for selections
  useEffect(() => {
    const q = query(collection(db, 'sales_representatives'));
    const unsub = onSnapshot(q, (snapshot) => {
      setSalesReps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Main Data Loading Effect
  useEffect(() => {
    setLoading(true);
    const colName = getCollectionName();
    const q = query(collection(db, colName));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Inject Mock values if firestore is completely empty
      if (items.length === 0) {
        setDataList(getMockData(subview));
      } else {
        setDataList(items);
      }
      setLoading(false);
    }, (err) => {
      console.log('Firebase load error, showing fallback mock data:', err);
      setDataList(getMockData(subview));
      setLoading(false);
    });

    return () => unsub();
  }, [subview]);

  // Get dynamic mock fallback data
  const getMockData = (view?: string) => {
    switch (view) {
      case 'customers':
        return [
          { id: 'c1', name: 'مؤسسة الوفاء للتجارة', phone: '0551234567', email: 'info@wafa.com', address: 'الرياض - الملز', taxNo: '300012345600003', category: 'VIP', creditLimit: 100000, balance: 12500, repId: 'rep1' },
          { id: 'c2', name: 'شركة البنيان للمقاولات', phone: '0569876543', email: 'sales@bunyan.com', address: 'جدة - حي الحمراء', taxNo: '310098765400003', category: 'الشركات', creditLimit: 250000, balance: 84000, repId: 'rep2' },
          { id: 'c3', name: 'مركز مكة الطبي', phone: '0543322110', email: 'medical@makkah.org', address: 'مكة المكرمة', taxNo: '300077665500003', category: 'جهات حكومية', creditLimit: 500000, balance: 0, repId: 'rep1' }
        ];
      case 'reps':
        return [
          { id: 'rep1', name: 'أحمد محمود', branchId: '1', commission: 2.5, target: 120000, status: 'active' },
          { id: 'rep2', name: 'سارة علي', branchId: '2', commission: 3.0, target: 100000, status: 'active' },
          { id: 'rep3', name: 'خالد عبدالله', branchId: '1', commission: 2.0, target: 80000, status: 'inactive' }
        ];
      case 'services':
        return [
          { id: 's1', code: 'SRV-01', name: 'تركيب وتشغيل شبكات', category: 'خدمات تقنية', price: 2500, cost: 500, taxRate: 15 },
          { id: 's2', code: 'SRV-02', name: 'صيانة خوادم سنوية', category: 'عقود صيانة', price: 12000, cost: 3000, taxRate: 15 },
          { id: 's3', code: 'SRV-03', name: 'دورة تدريبية مبيعات', category: 'استشارات', price: 4000, cost: 1000, taxRate: 0 }
        ];
      case 'sales-show':
        return [
          { id: 'SO-00001', customerName: 'شركة النور للتجارة', total: 45000, status: 'approved', createdAt: '2026-06-23T12:00:00Z', branchId: '1' },
          { id: 'SO-00002', customerName: 'مؤسسة الرياض', total: 12500, status: 'pending_approval', createdAt: '2026-06-23T11:30:00Z', branchId: '1' },
          { id: 'SO-00003', customerName: 'مستشفى الشفاء', total: 85000, status: 'delivered', createdAt: '2026-06-22T16:45:00Z', branchId: '2' }
        ];
      case 'branches':
        return [
          { id: 'br1', name: 'الفرع الرئيسي - الرياض', code: 'HQ', region: 'الوسطى', manager: 'أحمد محمود', isActive: true },
          { id: 'br2', name: 'فرع المنطقة الغربية - جدة', code: 'WEST', region: 'الغربية', manager: 'سارة علي', isActive: true }
        ];
      case 'quotas':
        return [
          { id: 'q1', branchId: '1', centerName: 'معرض الملز', period: '2026-Q2', quota: 500000 },
          { id: 'q2', branchId: '2', centerName: 'معرض التحلية', period: '2026-Q2', quota: 350000 }
        ];
      case 'targets':
        return [
          { id: 't1', type: 'employee', repId: 'rep1', period: 'يونيو 2026', targetAmount: 120000, achieved: 130000 },
          { id: 't2', type: 'branch', branchId: '1', period: 'يونيو 2026', targetAmount: 500000, achieved: 430000 }
        ];
      case 'incentives':
        return [
          { id: 'inc1', name: 'حافز تجاوز المستهدف 100%', type: 'percent', value: 1.5, condition: 'تحقيق المبيعات بنسبة 100% فما فوق', status: 'active' },
          { id: 'inc2', name: 'مكافأة العملاء الجدد', type: 'fixed', value: 500, condition: 'تسجيل وإتمام عملية بيع لعميل VIP جديد', status: 'active' }
        ];
      case 'price-lists':
        return [
          { id: 'pl1', name: 'قائمة أسعار الجملة الموحدة', baseType: 'wholesale', discount: 10, isActive: true },
          { id: 'pl2', name: 'قائمة الأسعار المخصصة للموزعين', baseType: 'retail', discount: 15, isActive: true },
          { id: 'pl3', name: 'قائمة أسعار المعارض', baseType: 'retail', discount: 0, isActive: true }
        ];
      default:
        return [];
    }
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const colName = getCollectionName();
    
    // Log user activity
    const auditLog = {
      userEmail: user?.email || 'admin@nezam.com',
      userName: user?.name || 'مدير النظام',
      action: editingItem ? `تعديل في ${getViewTitle(subview)}` : `إضافة في ${getViewTitle(subview)}`,
      details: `تم إجراء تعديلات على مستند/سجل ببيانات: ${JSON.stringify(formState)}`,
      timestamp: new Date().toISOString()
    };

    try {
      if (editingItem) {
        // Edit Mode
        if (editingItem.id.startsWith('c') || editingItem.id.startsWith('rep') || editingItem.id.startsWith('s') || editingItem.id.startsWith('br') || editingItem.id.startsWith('q') || editingItem.id.startsWith('t') || editingItem.id.startsWith('inc') || editingItem.id.startsWith('pl') || editingItem.id.startsWith('SO-')) {
          // Editing Mock item directly in local state list
          setDataList(prev => prev.map(item => item.id === editingItem.id ? { ...item, ...formState } : item));
        } else {
          // Firebase edit
          await updateDoc(doc(db, colName, editingItem.id), formState);
        }
      } else {
        // Create Mode
        const newId = `MOCK-${Math.floor(Math.random() * 10000)}`;
        if (colName.startsWith('sales_')) {
          try {
            await addDoc(collection(db, colName), { ...formState, createdAt: new Date().toISOString() });
          } catch {
            setDataList(prev => [...prev, { id: newId, ...formState, createdAt: new Date().toISOString() }]);
          }
        }
      }
      
      // Log event
      try {
        await addDoc(collection(db, 'security_logs'), auditLog);
      } catch (err) {
        console.log('Logging omitted or not active');
      }

      setModalOpen(false);
      setEditingItem(null);
      setFormState({});
    } catch (err) {
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  // Delete Handler
  const handleDelete = async (item: any) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل نهائياً؟')) return;
    const colName = getCollectionName();

    const auditLog = {
      userEmail: user?.email || 'admin@nezam.com',
      userName: user?.name || 'مدير النظام',
      action: `حذف من ${getViewTitle(subview)}`,
      details: `حذف السجل ذو المعرف ${item.id}`,
      timestamp: new Date().toISOString()
    };

    try {
      if (item.id.startsWith('c') || item.id.startsWith('rep') || item.id.startsWith('s') || item.id.startsWith('br') || item.id.startsWith('q') || item.id.startsWith('t') || item.id.startsWith('inc') || item.id.startsWith('pl') || item.id.startsWith('SO-') || item.id.startsWith('MOCK-')) {
        setDataList(prev => prev.filter(i => i.id !== item.id));
      } else {
        await deleteDoc(doc(db, colName, item.id));
      }

      try {
        await addDoc(collection(db, 'security_logs'), auditLog);
      } catch {}
    } catch {
      alert('حدث خطأ أثناء حذف السجل');
    }
  };

  // Export to CSV/Excel
  const handleExportCSV = () => {
    if (dataList.length === 0) return;
    
    // Create CSV rows
    const headers = Object.keys(dataList[0]).filter(k => k !== 'id').join(',');
    const rows = dataList.map(item => 
      Object.keys(item)
        .filter(k => k !== 'id')
        .map(k => `"${String(item[k]).replace(/"/g, '""')}"`)
        .join(',')
    );
    
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n'); // UTF-8 BOM
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_${subview || 'data'}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormState(getDefaultFormValues(subview));
    setModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormState({ ...item });
    setModalOpen(true);
  };

  // Helper to resolve title
  const getViewTitle = (view?: string) => {
    switch (view) {
      case 'customers': return 'دليل العملاء';
      case 'reps': return 'مسؤولي المبيعات';
      case 'services': return 'تكويد الخدمات المبيعية';
      case 'sales-show': return 'أوامر وعروض البيع';
      case 'branches': return 'فروع وقنوات المبيعات';
      case 'quotas': return 'حصص مراكز البيع';
      case 'targets': return 'مستهدفات البيع';
      case 'incentives': return 'حوافز وعمولات البيع';
      case 'price-lists': return 'قوائم الأسعار المعاصرة';
      default: return 'المبيعات';
    }
  };

  // Default values for Form
  const getDefaultFormValues = (view?: string) => {
    switch (view) {
      case 'customers': return { name: '', phone: '', email: '', address: '', taxNo: '', category: 'Retail', creditLimit: 50000, balance: 0, repId: '' };
      case 'reps': return { name: '', branchId: '1', commission: 2.0, target: 100000, status: 'active' };
      case 'services': return { code: `SRV-0${dataList.length + 1}`, name: '', category: 'عام', price: 100, cost: 10, taxRate: 15 };
      case 'branches': return { name: '', code: '', region: 'الوسطى', manager: '', isActive: true };
      case 'quotas': return { branchId: '1', centerName: '', period: '2026-Q3', quota: 100000 };
      case 'targets': return { type: 'employee', repId: '', branchId: '', period: 'يونيو 2026', targetAmount: 100000, achieved: 0 };
      case 'incentives': return { name: '', type: 'percent', value: 1.0, condition: '', status: 'active' };
      case 'price-lists': return { name: '', baseType: 'wholesale', discount: 10, isActive: true };
      default: return {};
    }
  };

  // Filter logic
  const filteredData = dataList.filter(item => {
    const matchesSearch = Object.values(item).some(val => 
      String(val).toLowerCase().includes(search.toLowerCase())
    );
    const matchesBranch = !selectedBranchFilter || 
      item.branchId === selectedBranchFilter ||
      (subview === 'reps' && item.branchId === selectedBranchFilter);
      
    return matchesSearch && matchesBranch;
  });

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={getViewTitle(subview)}
        description="إدخال وتعديل البيانات الأساسية، وتصدير التقارير وجداول العمليات"
        breadcrumbs={[{ label: 'الرئيسية' }, { label: 'المبيعات' }, { label: getViewTitle(subview) }]}
        actions={
          <div className="flex gap-2">
            <div className="relative w-40">
              <select
                value={selectedBranchFilter}
                onChange={e => setSelectedBranchFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer text-right appearance-none"
              >
                <option value="">كل الفروع</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            
            <div className="relative w-56">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="البحث السريع في القائمة..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded pr-8 pl-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 text-right"
              />
            </div>
            
            <button
              onClick={handleExportCSV}
              title="تصدير إلى Excel"
              className="bg-slate-50 text-slate-700 border border-slate-200 p-1.5 rounded text-xs font-black hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير</span>
            </button>

            {subview !== 'sales-show' && (
              <button
                onClick={openAddModal}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-black hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة جديد</span>
              </button>
            )}
          </div>
        }
      />

      <ErpCard title={`تفاصيل جدول: ${getViewTitle(subview)}`} subtitle="مراجعة الحسابات وتحديث قيم السجلات">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-bold">جاري تحميل البيانات...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold italic">
              لا توجد سجلات مطابقة للبحث أو الفلترة.
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500 font-black">
                  {renderTableHeaders(subview)}
                  <th className="px-3 py-2 text-center w-20">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    {renderTableRows(subview, item, warehouses, salesReps)}
                    <td className="px-3 py-1.5 text-center flex justify-center gap-1">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                        title="تعديل السجل"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {subview !== 'sales-show' && (
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors"
                          title="حذف السجل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ErpCard>

      {/* Dynamic Edit/Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="bg-white rounded border border-slate-200 shadow-2xl w-full max-w-lg z-10 overflow-hidden text-right font-bold" dir="rtl">
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">
                {editingItem ? `تعديل: ${editingItem.name || editingItem.code || editingItem.id}` : 'إنشاء سجل جديد'}
              </span>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
              {renderFormFields(subview, formState, setFormState, warehouses, salesReps)}

              <div className="flex gap-2 pt-2 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="bg-slate-100 text-slate-700 px-4 py-1.5 rounded text-xs font-black hover:bg-slate-200 transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-5 py-1.5 rounded text-xs font-black hover:bg-blue-700 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  حفظ البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ErpPageLayout>
  );
}

// ─── Table Headers Resolver ──────────────────────────────────────────────────
function renderTableHeaders(view?: string) {
  switch (view) {
    case 'customers':
      return (
        <>
          <th className="px-3 py-2 text-right">العميل</th>
          <th className="px-3 py-2">رقم الهاتف</th>
          <th className="px-3 py-2">الرقم الضريبي</th>
          <th className="px-3 py-2">الفئة</th>
          <th className="px-3 py-2 text-left">الحد الائتماني</th>
          <th className="px-3 py-2 text-left">الرصيد المستحق</th>
          <th className="px-3 py-2">مسؤول البيع</th>
        </>
      );
    case 'reps':
      return (
        <>
          <th className="px-3 py-2 text-right">مسؤول البيع</th>
          <th className="px-3 py-2">الفرع</th>
          <th className="px-3 py-2 text-center">العمولة %</th>
          <th className="px-3 py-2 text-left">المستهدف المالي</th>
          <th className="px-3 py-2 text-center">حالة النشاط</th>
        </>
      );
    case 'services':
      return (
        <>
          <th className="px-3 py-2 text-right">كود الخدمة</th>
          <th className="px-3 py-2 text-right">اسم الخدمة</th>
          <th className="px-3 py-2">فئة الخدمة</th>
          <th className="px-3 py-2 text-left">سعر البيع</th>
          <th className="px-3 py-2 text-left">التكلفة القياسية</th>
          <th className="px-3 py-2 text-center">الضريبة %</th>
        </>
      );
    case 'sales-show':
      return (
        <>
          <th className="px-3 py-2 text-right">رقم الفاتورة/الطلب</th>
          <th className="px-3 py-2 text-right">العميل</th>
          <th className="px-3 py-2 text-left">إجمالي القيمة</th>
          <th className="px-3 py-2 text-center">حالة المستند</th>
          <th className="px-3 py-2">تاريخ الإصدار</th>
        </>
      );
    case 'branches':
      return (
        <>
          <th className="px-3 py-2 text-right">كود الفرع</th>
          <th className="px-3 py-2 text-right">اسم الفرع</th>
          <th className="px-3 py-2">المنطقة الجغرافية</th>
          <th className="px-3 py-2">مدير الفرع</th>
          <th className="px-3 py-2 text-center">الحالة</th>
        </>
      );
    case 'quotas':
      return (
        <>
          <th className="px-3 py-2 text-right">مركز التوزيع / المعرض</th>
          <th className="px-3 py-2">الفرع التابع</th>
          <th className="px-3 py-2">الفترة الزمنية</th>
          <th className="px-3 py-2 text-left">الحصة المستهدفة</th>
        </>
      );
    case 'targets':
      return (
        <>
          <th className="px-3 py-2">نوع المستهدف</th>
          <th className="px-3 py-2">المنسوب إليه</th>
          <th className="px-3 py-2">الفترة</th>
          <th className="px-3 py-2 text-left">المبلغ المطلوب</th>
          <th className="px-3 py-2 text-left">المبلغ المحقق</th>
          <th className="px-3 py-2 text-center">نسبة الإنجاز</th>
        </>
      );
    case 'incentives':
      return (
        <>
          <th className="px-3 py-2 text-right">اسم قاعدة الحافز</th>
          <th className="px-3 py-2 text-center">نوع الحافز</th>
          <th className="px-3 py-2 text-left">القيمة المطبقة</th>
          <th className="px-3 py-2 text-right">شروط الاستحقاق</th>
          <th className="px-3 py-2 text-center">الحالة</th>
        </>
      );
    case 'price-lists':
      return (
        <>
          <th className="px-3 py-2 text-right">اسم قائمة الأسعار</th>
          <th className="px-3 py-2">نوع التسعير الأساسي</th>
          <th className="px-3 py-2 text-center">خصم افتراضي %</th>
          <th className="px-3 py-2 text-center">حالة النشاط</th>
        </>
      );
    default:
      return null;
  }
}

// ─── Table Rows Resolver ─────────────────────────────────────────────────────
function renderTableRows(view: string | undefined, item: any, warehouses: any[], salesReps: any[]) {
  const getBranchName = (bId: string) => warehouses.find(w => w.id === bId)?.name || 'غير محدد';
  const getRepName = (rId: string) => salesReps.find(r => r.id === rId)?.name || 'غير محدد';

  switch (view) {
    case 'customers':
      return (
        <>
          <td className="px-3 py-1.5 font-black text-slate-800">{item.name}</td>
          <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500">{item.phone}</td>
          <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500">{item.taxNo || 'لا يوجد'}</td>
          <td className="px-3 py-1.5"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">{item.category}</span></td>
          <td className="px-3 py-1.5 text-left font-sans text-slate-900">{formatCurrency(item.creditLimit)}</td>
          <td className="px-3 py-1.5 text-left font-sans text-slate-900 text-red-600">{formatCurrency(item.balance)}</td>
          <td className="px-3 py-1.5 text-slate-600 text-[11px]">{getRepName(item.repId)}</td>
        </>
      );
    case 'reps':
      return (
        <>
          <td className="px-3 py-1.5 font-black text-slate-800">{item.name}</td>
          <td className="px-3 py-1.5 text-[11px] text-slate-600">{getBranchName(item.branchId)}</td>
          <td className="px-3 py-1.5 text-center font-sans font-black text-blue-600">{item.commission}%</td>
          <td className="px-3 py-1.5 text-left font-sans text-slate-950">{formatCurrency(item.target)}</td>
          <td className="px-3 py-1.5 text-center">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-black border", item.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>
              {item.status === 'active' ? 'نشط' : 'معطل'}
            </span>
          </td>
        </>
      );
    case 'services':
      return (
        <>
          <td className="px-3 py-1.5 font-mono text-slate-900 font-black">{item.code}</td>
          <td className="px-3 py-1.5 font-black text-slate-850">{item.name}</td>
          <td className="px-3 py-1.5 text-slate-500">{item.category}</td>
          <td className="px-3 py-1.5 text-left font-sans text-slate-900">{formatCurrency(item.price)}</td>
          <td className="px-3 py-1.5 text-left font-sans text-slate-500">{formatCurrency(item.cost)}</td>
          <td className="px-3 py-1.5 text-center font-sans text-purple-600">{item.taxRate}%</td>
        </>
      );
    case 'sales-show':
      return (
        <>
          <td className="px-3 py-1.5 font-mono text-blue-650 font-black">{item.id}</td>
          <td className="px-3 py-1.5 font-black">{item.customerName || 'عميل نقدي'}</td>
          <td className="px-3 py-1.5 text-left font-sans font-black text-slate-950">{formatCurrency(item.total)}</td>
          <td className="px-3 py-1.5 text-center">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-black", item.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse')}>
              {item.status === 'approved' ? 'معتمد' : 'مسودة / انتظار'}
            </span>
          </td>
          <td className="px-3 py-1.5 text-[10px] font-mono text-slate-400">{new Date(item.createdAt).toLocaleDateString('ar-EG')}</td>
        </>
      );
    case 'branches':
      return (
        <>
          <td className="px-3 py-1.5 font-mono text-slate-500 font-bold">{item.code}</td>
          <td className="px-3 py-1.5 font-black text-slate-850">{item.name}</td>
          <td className="px-3 py-1.5 text-slate-500">{item.region}</td>
          <td className="px-3 py-1.5 text-slate-600">{item.manager}</td>
          <td className="px-3 py-1.5 text-center">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-black border", item.isActive ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>
              {item.isActive ? 'نشط' : 'مغلق'}
            </span>
          </td>
        </>
      );
    case 'quotas':
      return (
        <>
          <td className="px-3 py-1.5 font-black text-slate-850">{item.centerName}</td>
          <td className="px-3 py-1.5 text-slate-600">{getBranchName(item.branchId)}</td>
          <td className="px-3 py-1.5 font-mono text-slate-500">{item.period}</td>
          <td className="px-3 py-1.5 text-left font-sans text-slate-900">{formatCurrency(item.quota)}</td>
        </>
      );
    case 'targets':
      const targetPercent = item.targetAmount > 0 ? Math.round((item.achieved / item.targetAmount) * 100) : 0;
      return (
        <>
          <td className="px-3 py-1.5 text-slate-550">{item.type === 'employee' ? 'مستهدف مندوب' : 'مستهدف فرع'}</td>
          <td className="px-3 py-1.5 font-black text-slate-800">
            {item.type === 'employee' ? getRepName(item.repId) : getBranchName(item.branchId)}
          </td>
          <td className="px-3 py-1.5 font-mono text-slate-500">{item.period}</td>
          <td className="px-3 py-1.5 text-left font-sans text-slate-900">{formatCurrency(item.targetAmount)}</td>
          <td className="px-3 py-1.5 text-left font-sans text-slate-550">{formatCurrency(item.achieved)}</td>
          <td className="px-3 py-1.5 text-center">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-black", targetPercent >= 100 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100")}>
              {targetPercent}%
            </span>
          </td>
        </>
      );
    case 'incentives':
      return (
        <>
          <td className="px-3 py-1.5 font-black text-slate-850">{item.name}</td>
          <td className="px-3 py-1.5">{item.type === 'percent' ? 'نسبة مئوية' : 'مبلغ ثابت'}</td>
          <td className="px-3 py-1.5 text-left font-sans text-slate-900">
            {item.type === 'percent' ? `${item.value}%` : formatCurrency(item.value)}
          </td>
          <td className="px-3 py-1.5 text-[11px] text-slate-500">{item.condition}</td>
          <td className="px-3 py-1.5 text-center">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-black border", item.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>
              {item.status === 'active' ? 'نشط' : 'معطل'}
            </span>
          </td>
        </>
      );
    case 'price-lists':
      return (
        <>
          <td className="px-3 py-1.5 font-black text-slate-850">{item.name}</td>
          <td className="px-3 py-1.5 text-slate-500">{item.baseType === 'wholesale' ? 'جملة المبيعات' : 'مبيعات تجزئة'}</td>
          <td className="px-3 py-1.5 text-center font-sans font-black text-blue-600">{item.discount}%</td>
          <td className="px-3 py-1.5 text-center">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-black border", item.isActive ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>
              {item.isActive ? 'نشط' : 'معطل'}
            </span>
          </td>
        </>
      );
    default:
      return null;
  }
}

// ─── Dynamic Input Form Resolution ──────────────────────────────────────────
function renderFormFields(view: string | undefined, form: any, setForm: any, warehouses: any[], salesReps: any[]) {
  const updateForm = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));

  switch (view) {
    case 'customers':
      return (
        <>
          <ErpInput label="اسم العميل الكامل *" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <ErpInput label="رقم الهاتف *" value={form.phone || ''} onChange={e => updateForm('phone', e.target.value)} required />
            <ErpInput label="البريد الإلكتروني" value={form.email || ''} onChange={e => updateForm('email', e.target.value)} />
          </div>
          <ErpInput label="العنوان" value={form.address || ''} onChange={e => updateForm('address', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <ErpInput label="الرقم الضريبي" value={form.taxNo || ''} onChange={e => updateForm('taxNo', e.target.value)} />
            <ErpInput label="تصنيف العميل" value={form.category || ''} onChange={e => updateForm('category', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ErpInput label="الحد الائتماني (ريال)" type="number" value={form.creditLimit || 0} onChange={e => updateForm('creditLimit', Number(e.target.value))} />
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">مسؤول المبيعات المسؤول</label>
              <select
                value={form.repId || ''}
                onChange={e => updateForm('repId', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
              >
                <option value="">غير محدد</option>
                {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
        </>
      );
    case 'reps':
      return (
        <>
          <ErpInput label="اسم المندوب كامل *" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">الفرع التابع له</label>
              <select
                value={form.branchId || ''}
                onChange={e => updateForm('branchId', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <ErpInput label="العمولة %" type="number" step="0.1" value={form.commission || 0} onChange={e => updateForm('commission', Number(e.target.value))} />
          </div>
          <ErpInput label="المستهدف المالي للشهر (ريال)" type="number" value={form.target || 0} onChange={e => updateForm('target', Number(e.target.value))} />
          <div>
            <label className="text-[10px] font-black text-slate-400 block mb-1">الحالة</label>
            <select
              value={form.status || 'active'}
              onChange={e => updateForm('status', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
            >
              <option value="active">نشط</option>
              <option value="inactive">معطل</option>
            </select>
          </div>
        </>
      );
    case 'services':
      return (
        <>
          <ErpInput label="كود الخدمة *" value={form.code || ''} onChange={e => updateForm('code', e.target.value)} required />
          <ErpInput label="اسم الخدمة *" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required />
          <ErpInput label="فئة التصنيف" value={form.category || ''} onChange={e => updateForm('category', e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <ErpInput label="سعر البيع" type="number" value={form.price || 0} onChange={e => updateForm('price', Number(e.target.value))} />
            <ErpInput label="التكلفة القياسية" type="number" value={form.cost || 0} onChange={e => updateForm('cost', Number(e.target.value))} />
            <ErpInput label="الضريبة المضافة %" type="number" value={form.taxRate || 15} onChange={e => updateForm('taxRate', Number(e.target.value))} />
          </div>
        </>
      );
    case 'branches':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ErpInput label="كود الفرع" value={form.code || ''} onChange={e => updateForm('code', e.target.value)} />
            <ErpInput label="اسم الفرع *" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ErpInput label="المنطقة الجغرافية" value={form.region || ''} onChange={e => updateForm('region', e.target.value)} />
            <ErpInput label="مدير الفرع" value={form.manager || ''} onChange={e => updateForm('manager', e.target.value)} />
          </div>
          <div>
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.isActive} onChange={e => updateForm('isActive', e.target.checked)} className="rounded" />
              <span className="text-xs text-slate-700">فرع نشط ومفتوح للبيع</span>
            </label>
          </div>
        </>
      );
    case 'quotas':
      return (
        <>
          <ErpInput label="اسم مركز التوزيع / المعرض *" value={form.centerName || ''} onChange={e => updateForm('centerName', e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">الفرع التابع</label>
              <select
                value={form.branchId || ''}
                onChange={e => updateForm('branchId', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <ErpInput label="الفترة الزمنية (مثال: 2026-Q3)" value={form.period || ''} onChange={e => updateForm('period', e.target.value)} />
          </div>
          <ErpInput label="الحصة المستهدفة (ريال)" type="number" value={form.quota || 0} onChange={e => updateForm('quota', Number(e.target.value))} />
        </>
      );
    case 'targets':
      return (
        <>
          <div>
            <label className="text-[10px] font-black text-slate-400 block mb-1">نوع المستهدف</label>
            <select
              value={form.type || 'employee'}
              onChange={e => updateForm('type', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
            >
              <option value="employee">مندوب بيع</option>
              <option value="branch">فرع كامل</option>
            </select>
          </div>
          {form.type === 'employee' ? (
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">مندوب المبيعات</label>
              <select
                value={form.repId || ''}
                onChange={e => updateForm('repId', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
              >
                <option value="">غير محدد</option>
                {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">الفرع المالي</label>
              <select
                value={form.branchId || ''}
                onChange={e => updateForm('branchId', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <ErpInput label="الفترة" value={form.period || ''} onChange={e => updateForm('period', e.target.value)} />
            <ErpInput label="المستهدف المطلوب" type="number" value={form.targetAmount || 0} onChange={e => updateForm('targetAmount', Number(e.target.value))} />
          </div>
        </>
      );
    case 'incentives':
      return (
        <>
          <ErpInput label="اسم قاعدة الحافز *" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">نوع الحافز</label>
              <select
                value={form.type || 'percent'}
                onChange={e => updateForm('type', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
              >
                <option value="percent">نسبة مئوية</option>
                <option value="fixed">مبلغ مالي ثابت</option>
              </select>
            </div>
            <ErpInput label="قيمة الحافز" type="number" step="0.1" value={form.value || 0} onChange={e => updateForm('value', Number(e.target.value))} />
          </div>
          <ErpInput label="شروط استحقاق الحافز والعمولة" value={form.condition || ''} onChange={e => updateForm('condition', e.target.value)} />
        </>
      );
    case 'price-lists':
      return (
        <>
          <ErpInput label="اسم قائمة الأسعار *" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">التسعير الأساسي</label>
              <select
                value={form.baseType || 'wholesale'}
                onChange={e => updateForm('baseType', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
              >
                <option value="wholesale">جملة</option>
                <option value="retail">تجزئة</option>
              </select>
            </div>
            <ErpInput label="نسبة خصم افتراضية للقائمة %" type="number" value={form.discount || 0} onChange={e => updateForm('discount', Number(e.target.value))} />
          </div>
          <div>
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.isActive} onChange={e => updateForm('isActive', e.target.checked)} className="rounded" />
              <span className="text-xs text-slate-700">قائمة أسعار نشطة حالياً</span>
            </label>
          </div>
        </>
      );
    default:
      return null;
  }
}
