import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Download,
  Printer,
  Pencil,
  Trash2,
  X,
  Building2,
  Users,
  Coins,
  Save,
  CheckCircle2,
  Play,
  RotateCcw,
  ArrowRightLeft,
  Calendar,
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

export default function SalesDocuments() {
  const { subview } = useParams<{ subview: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  // Core Entity States
  const [documents, setDocuments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  // Editor Form States
  const [docHeader, setDocHeader] = useState({
    customerId: '',
    repId: '',
    branchId: '',
    notes: '',
    recurrence: 'monthly',
    originalOrderId: ''
  });
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ itemId: '', qty: 1, discount: 0 });

  // Load Helpers
  const getCollectionName = () => {
    switch (subview) {
      case 'order': return 'sales_orders';
      case 'return': return 'sales_returns';
      case 'recurring': return 'sales_recurring_orders';
      case 'quotations': return 'sales_quotations';
      default: return 'sales_orders';
    }
  };

  const getPrefix = () => {
    switch (subview) {
      case 'order': return 'SO';
      case 'return': return 'SR';
      case 'recurring': return 'RSO';
      case 'quotations': return 'QT';
      default: return 'DOC';
    }
  };

  // Load Firestore Dependencies
  useEffect(() => {
    const unsubCust = onSnapshot(collection(db, 'sales_customers'), s => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubReps = onSnapshot(collection(db, 'sales_representatives'), s => setReps(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubWare = onSnapshot(collection(db, 'warehouses'), s => setWarehouses(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubProd = onSnapshot(collection(db, 'products'), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubServ = onSnapshot(collection(db, 'sales_services'), s => setServices(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => {
      unsubCust();
      unsubReps();
      unsubWare();
      unsubProd();
      unsubServ();
    };
  }, []);

  // Load documents
  useEffect(() => {
    setLoading(true);
    const colName = getCollectionName();
    const q = query(collection(db, colName));

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (items.length === 0) {
        setDocuments(getMockDocs(subview));
      } else {
        setDocuments(items);
      }
      setLoading(false);
    }, (err) => {
      setDocuments(getMockDocs(subview));
      setLoading(false);
    });

    return () => unsub();
  }, [subview]);

  // Mock fallbacks
  const getMockDocs = (view?: string) => {
    switch (view) {
      case 'order':
        return [
          { id: 'SO-00001', customerName: 'شركة النور للتجارة', customerId: 'c1', total: 45000, subtotal: 39130, tax: 5870, status: 'approved', createdAt: '2026-06-23T12:00:00Z', repId: 'rep1', branchId: '1', items: [{ name: 'تركيب وتشغيل شبكات', price: 2500, qty: 18, discount: 0, total: 45000 }] },
          { id: 'SO-00002', customerName: 'مؤسسة الرياض', customerId: 'c2', total: 12500, subtotal: 10870, tax: 1630, status: 'pending_approval', createdAt: '2026-06-23T11:30:00Z', repId: 'rep2', branchId: '1', items: [{ name: 'دورة تدريبية مبيعات', price: 4000, qty: 3, discount: 0, total: 12000 }] }
        ];
      case 'return':
        return [
          { id: 'SR-00001', customerName: 'شركة النور للتجارة', total: 5000, originalOrderId: 'SO-00001', status: 'approved', createdAt: '2026-06-23T10:00:00Z', branchId: '1' }
        ];
      case 'recurring':
        return [
          { id: 'RSO-00001', customerName: 'مؤسسة الوفاء للتجارة', total: 12000, recurrence: 'monthly', status: 'active', createdAt: '2026-06-22T09:00:00Z', branchId: '1' }
        ];
      case 'quotations':
        return [
          { id: 'QT-00001', customerName: 'مستشفى الشفاء', total: 85000, status: 'converted', createdAt: '2026-06-21T14:00:00Z', branchId: '2' },
          { id: 'QT-00002', customerName: 'شركة البنيان للمقاولات', total: 14000, status: 'draft', createdAt: '2026-06-23T08:30:00Z', branchId: '1' }
        ];
      default:
        return [];
    }
  };

  // Calculations for totals
  const subtotalSum = lineItems.reduce((s, item) => s + (item.price * item.qty - item.discount), 0);
  const taxSum = lineItems.reduce((s, item) => s + ((item.price * item.qty - item.discount) * (item.taxRate / 100)), 0);
  const totalSum = subtotalSum + taxSum;

  // Add Item to editor rows
  const handleAddLineItem = () => {
    if (!newItem.itemId) return;
    
    // Check if it's a product or service
    const product = products.find(p => p.id === newItem.itemId);
    const service = services.find(s => s.id === newItem.itemId);
    
    if (product) {
      // Check branch stock levels
      const branchId = docHeader.branchId || '1';
      const availableStock = product.branchStockMap?.[branchId] ?? 10; // Default mock fallback
      
      if (product.trackInventory !== false && newItem.qty > availableStock) {
        alert(`الكمية المتاحة في المستودع لا تكفي (المتاح: ${availableStock})`);
        return;
      }

      setLineItems(prev => [...prev, {
        id: product.id,
        name: product.name,
        price: product.sellingPrice || 100,
        qty: newItem.qty,
        discount: newItem.discount,
        taxRate: 15,
        total: (product.sellingPrice || 100) * newItem.qty - newItem.discount
      }]);
    } else if (service) {
      setLineItems(prev => [...prev, {
        id: service.id,
        name: service.name,
        price: service.price || 100,
        qty: newItem.qty,
        discount: newItem.discount,
        taxRate: service.taxRate || 15,
        total: (service.price || 100) * newItem.qty - newItem.discount
      }]);
    }

    setNewItem({ itemId: '', qty: 1, discount: 0 });
  };

  // Form Submit (Save Document)
  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      alert('يجب إضافة صنف واحد على الأقل للمستند');
      return;
    }

    const colName = getCollectionName();
    const customer = customers.find(c => c.id === docHeader.customerId);
    const rep = reps.find(r => r.id === docHeader.repId);
    
    const docId = `${getPrefix()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const newDoc = {
      id: docId,
      customerId: docHeader.customerId,
      customerName: customer ? customer.name : 'عميل مبيعات عام',
      repId: docHeader.repId,
      repName: rep ? rep.name : 'مباشر',
      branchId: docHeader.branchId || '1',
      notes: docHeader.notes,
      items: lineItems,
      subtotal: subtotalSum,
      tax: taxSum,
      total: totalSum,
      status: subview === 'quotations' ? 'draft' : 'pending_approval',
      createdAt: new Date().toISOString()
    };

    // Accounting Entry integration setup
    const accountingLogs = {
      action: 'JOURNAL_ENTRY_DRAFT',
      details: `إنشاء قيد مبيعات مسودة للمستند رقم #${docId} بقيمة ${formatCurrency(totalSum)}`,
      timestamp: new Date().toISOString()
    };

    // Audit logs
    const auditLog = {
      userEmail: user?.email || 'admin@nezam.com',
      userName: user?.name || 'مدير النظام',
      action: `إنشاء مستند ${subview}`,
      details: `تم إضافة مستند رقم ${docId} بقيمة إجمالية ${totalSum}`,
      timestamp: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, colName), newDoc);
      try {
        await addDoc(collection(db, 'security_logs'), auditLog);
        await addDoc(collection(db, 'security_logs'), accountingLogs);
      } catch {}
      
      // Update customer balance locally/firebase if it is a Sales Return (SR) or Sales Order Approved
      if (subview === 'return' && customer) {
        const customerRef = doc(db, 'sales_customers', customer.id);
        const newBalance = Math.max(0, (customer.balance || 0) - totalSum);
        try {
          await updateDoc(customerRef, { balance: newBalance });
        } catch {}
      }

      setModalOpen(false);
      setDocHeader({ customerId: '', repId: '', branchId: '', notes: '', recurrence: 'monthly', originalOrderId: '' });
      setLineItems([]);
    } catch (err) {
      // Local list append fallback
      setDocuments(prev => [newDoc, ...prev]);
      setModalOpen(false);
    }
  };

  // Convert Quotation to Sales Order
  const handleConvertToSO = async (quotation: any) => {
    const auditLog = {
      userEmail: user?.email || 'admin@nezam.com',
      userName: user?.name || 'مدير النظام',
      action: 'تحويل عرض سعر لأمر بيع',
      details: `تحويل عرض السعر ${quotation.id} لأمر بيع`,
      timestamp: new Date().toISOString()
    };

    try {
      // Create Sales Order
      const newSOId = `SO-${Math.floor(10000 + Math.random() * 90000)}`;
      await addDoc(collection(db, 'sales_orders'), {
        ...quotation,
        id: newSOId,
        status: 'approved',
        createdAt: new Date().toISOString()
      });

      // Update Quotation Status
      if (!quotation.id.startsWith('MOCK-') && !quotation.id.startsWith('QT-')) {
        await updateDoc(doc(db, 'sales_quotations', quotation.id), { status: 'converted' });
      } else {
        setDocuments(prev => prev.map(q => q.id === quotation.id ? { ...q, status: 'converted' } : q));
      }

      try {
        await addDoc(collection(db, 'security_logs'), auditLog);
      } catch {}

      alert(`تم تحويل عرض السعر بنجاح إلى أمر البيع رقم: ${newSOId}`);
    } catch {
      alert('حدث خطأ أثناء تحويل عرض السعر');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (documents.length === 0) return;
    const headers = 'رقم المستند,العميل,القيمة الإجمالية,الحالة,تاريخ الإنشاء';
    const rows = documents.map(d => `"${d.id}","${d.customerName}","${d.total}","${d.status}","${d.createdAt}"`);
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `documents_${subview}_export.csv`);
    link.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-black border border-emerald-100">معتمد</span>;
      case 'pending_approval': return <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-[10px] font-black border border-amber-100 animate-pulse">قيد المراجعة</span>;
      case 'rejected': return <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[10px] font-black border border-rose-100">مرفوض</span>;
      case 'delivered': return <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black border border-blue-100">تم التسليم</span>;
      case 'converted': return <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-[10px] font-black border border-purple-100">محول لأمر بيع</span>;
      default: return <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black">مسودة</span>;
    }
  };

  const openPrint = (doc: any) => {
    setSelectedDoc(doc);
    setPrintModalOpen(true);
  };

  const triggerPrintContent = () => {
    window.print();
  };

  const filteredDocs = documents.filter(d => 
    String(d.id).toLowerCase().includes(search.toLowerCase()) ||
    String(d.customerName).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={subview === 'order' ? 'أوامر البيع والطلبيات' : subview === 'return' ? 'مرتجع المبيعات والفواتير' : subview === 'recurring' ? 'أوامر البيع الدورية المنتظمة' : 'عروض أسعار العملاء'}
        description="تسجيل وإصدار المستندات، تفويض المخزن وطباعة الفواتير المعتمدة"
        breadcrumbs={[{ label: 'الرئيسية' }, { label: 'المبيعات' }, { label: 'المستندات' }]}
        actions={
          <div className="flex gap-2 no-print">
            <div className="relative w-56">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="البحث برقم المستند أو العميل..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded pr-8 pl-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 text-right"
              />
            </div>

            <button
              onClick={handleExportCSV}
              className="bg-slate-50 text-slate-700 border border-slate-200 p-1.5 rounded text-xs font-black hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير</span>
            </button>

            <button
              onClick={() => {
                setLineItems([]);
                setModalOpen(true);
              }}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-black hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer animate-pulse"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إصدار جديد</span>
            </button>
          </div>
        }
      />

      <ErpCard title="سجل الوثائق والمستندات" subtitle="تفاصيل العمليات والربط المخزني">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-bold">جاري تحميل المستندات...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold italic">
              لا توجد مستندات مسجلة بعد.
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500 font-black">
                  <th className="px-3 py-2 text-right">رقم المستند</th>
                  <th className="px-3 py-2 text-right">العميل</th>
                  <th className="px-3 py-2 text-left">قيمة الإجمالي</th>
                  <th className="px-3 py-2 text-center">حالة المستند</th>
                  <th className="px-3 py-2">تاريخ الإصدار</th>
                  <th className="px-3 py-2 text-center w-36">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {filteredDocs.map((doc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2 font-mono text-blue-650 font-black">{doc.id}</td>
                    <td className="px-3 py-2">{doc.customerName}</td>
                    <td className="px-3 py-2 text-left font-sans font-black text-slate-900">{formatCurrency(doc.total)}</td>
                    <td className="px-3 py-2 text-center">{getStatusBadge(doc.status)}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                      {new Date(doc.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-3 py-1.5 text-center flex justify-center gap-1.5">
                      <button
                        onClick={() => openPrint(doc)}
                        className="p-1 hover:bg-slate-100 text-slate-600 rounded transition-colors"
                        title="طباعة ومعاينة"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {subview === 'quotations' && doc.status !== 'converted' && (
                        <button
                          onClick={() => handleConvertToSO(doc)}
                          className="px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-100 rounded text-[10px] font-black hover:bg-purple-100"
                        >
                          تحويل لأمر بيع
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

      {/* Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="bg-white rounded border border-slate-200 shadow-2xl w-full max-w-2xl z-10 overflow-hidden text-right font-bold flex flex-col max-h-[90vh]" dir="rtl">
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">
                إصدار مستند مبيعات جديد: {getViewLabel(subview)}
              </span>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSaveDoc} className="p-4 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              {/* Document Header */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">العميل *</label>
                  <select
                    value={docHeader.customerId}
                    onChange={e => setDocHeader(p => ({ ...p, customerId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
                    required
                  >
                    <option value="">اختر عميل مبيعات...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">مسؤول المبيعات (المندوب) *</label>
                  <select
                    value={docHeader.repId}
                    onChange={e => setDocHeader(p => ({ ...p, repId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
                    required
                  >
                    <option value="">مبيعات مباشرة</option>
                    {reps.map(r => <option key={r.id} value={r.id}>{r.name} - عمولة {r.commission}%</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">الفرع المالي *</label>
                  <select
                    value={docHeader.branchId}
                    onChange={e => setDocHeader(p => ({ ...p, branchId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
                    required
                  >
                    <option value="">اختر فرع...</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>

                {subview === 'recurring' ? (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-1">دورية التكرار</label>
                    <select
                      value={docHeader.recurrence}
                      onChange={e => setDocHeader(p => ({ ...p, recurrence: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:bg-white text-right cursor-pointer"
                    >
                      <option value="daily">يومي</option>
                      <option value="weekly">أسبوعي</option>
                      <option value="monthly">شهري</option>
                    </select>
                  </div>
                ) : subview === 'return' ? (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-1">رقم أمر البيع الأصلي *</label>
                    <input
                      type="text"
                      placeholder="SO-00001"
                      value={docHeader.originalOrderId}
                      onChange={e => setDocHeader(p => ({ ...p, originalOrderId: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-right outline-none"
                      required
                    />
                  </div>
                ) : null}
              </div>

              {/* Items Line Add Panel */}
              <div className="bg-slate-50/50 border border-slate-150 p-3 rounded">
                <span className="text-[10px] font-black text-slate-500 block mb-2">إدراج الصنف أو الخدمة</span>
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <label className="text-[9px] text-slate-400 block mb-1">المنتج / الخدمة</label>
                    <select
                      value={newItem.itemId}
                      onChange={e => setNewItem(p => ({ ...p, itemId: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-right cursor-pointer"
                    >
                      <option value="">اختر...</option>
                      <optgroup label="المنتجات بالمستودع">
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sellingPrice} ريال)</option>)}
                      </optgroup>
                      <optgroup label="الخدمات">
                        {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.price} ريال)</option>)}
                      </optgroup>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <ErpInput
                      label="الكمية"
                      type="number"
                      min={1}
                      value={newItem.qty}
                      onChange={e => setNewItem(p => ({ ...p, qty: Number(e.target.value) }))}
                    />
                  </div>

                  <div className="col-span-2">
                    <ErpInput
                      label="خصم (ريال)"
                      type="number"
                      min={0}
                      value={newItem.discount}
                      onChange={e => setNewItem(p => ({ ...p, discount: Number(e.target.value) }))}
                    />
                  </div>

                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="w-full bg-slate-900 text-white py-1 rounded text-xs font-black hover:bg-slate-800"
                    >
                      إدراج
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-150 rounded overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr className="text-slate-500 font-bold">
                      <th className="px-3 py-1.5">الصنف</th>
                      <th className="px-3 py-1.5 text-center">السعر</th>
                      <th className="px-3 py-1.5 text-center">الكمية</th>
                      <th className="px-3 py-1.5 text-center">الخصم</th>
                      <th className="px-3 py-1.5 text-center">الضريبة</th>
                      <th className="px-3 py-1.5 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="px-3 py-1.5 font-bold">{item.name}</td>
                        <td className="px-3 py-1.5 text-center font-sans">{formatCurrency(item.price)}</td>
                        <td className="px-3 py-1.5 text-center font-sans">{item.qty}</td>
                        <td className="px-3 py-1.5 text-center text-rose-600 font-sans">{formatCurrency(item.discount)}</td>
                        <td className="px-3 py-1.5 text-center font-sans">{item.taxRate}%</td>
                        <td className="px-3 py-1.5 text-left font-sans font-black">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Subtotals & Comments */}
              <div className="grid grid-cols-2 gap-4 items-start border-t border-slate-100 pt-3">
                <textarea
                  placeholder="ملاحظات وشروط إضافية للمستند..."
                  value={docHeader.notes}
                  onChange={e => setDocHeader(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-slate-200 rounded p-2 text-xs text-right outline-none bg-slate-50 focus:bg-white resize-none h-20"
                />

                <div className="space-y-1.5 text-xs font-black text-slate-800 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-450">المجموع قبل الضريبة:</span>
                    <span className="font-sans">{formatCurrency(subtotalSum)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">ضريبة القيمة المضافة (15%):</span>
                    <span className="font-sans text-purple-600">+{formatCurrency(taxSum)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 text-sm">
                    <span>إجمالي المستند المالي:</span>
                    <span className="font-sans text-blue-650 font-black">{formatCurrency(totalSum)}</span>
                  </div>
                </div>
              </div>

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
                  className="bg-blue-600 text-white px-6 py-1.5 rounded text-xs font-black hover:bg-blue-700 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  حفظ المستند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print View Modal */}
      {printModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs no-print" onClick={() => setPrintModalOpen(false)} />
          <div className="bg-white rounded border border-slate-200 shadow-2xl w-full max-w-xl z-10 overflow-hidden text-right font-bold flex flex-col max-h-[90vh]" dir="rtl">
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between no-print">
              <span className="text-xs font-black text-slate-800">
                معاينة الطباعة: {selectedDoc.id}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={triggerPrintContent}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-[11px] font-black hover:bg-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الفاتورة</span>
                </button>
                <button onClick={() => setPrintModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Invoice Print Template */}
            <div className="p-8 overflow-y-auto flex-1 font-sans text-slate-800 bg-white" id="invoice-print-area">
              {/* Header */}
              <div className="text-center border-b border-slate-200 pb-4">
                <h2 className="text-lg font-black text-slate-900">نظام المبيعات المتكامل - NEZAM ERP</h2>
                <p className="text-xs text-slate-400 mt-1">سند مالي رسمي لعملية مبيعات تجارية</p>
              </div>

              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 text-xs mt-6 border-b border-slate-100 pb-4 font-bold">
                <div className="space-y-1">
                  <p><span className="text-slate-400 font-black">رقم المستند: </span><span className="font-mono text-slate-900 font-black">{selectedDoc.id}</span></p>
                  <p><span className="text-slate-400 font-black">التاريخ: </span><span>{new Date(selectedDoc.createdAt).toLocaleDateString('ar-EG')}</span></p>
                  <p><span className="text-slate-400 font-black">مسؤول البيع: </span><span>{selectedDoc.repName || 'مباشر'}</span></p>
                </div>
                <div className="space-y-1 text-left">
                  <p><span className="text-slate-400 font-black">العميل: </span><span>{selectedDoc.customerName}</span></p>
                  <p><span className="text-slate-400 font-black">حالة الاعتماد: </span><span>{selectedDoc.status === 'approved' ? 'معتمد رسمياً' : 'انتظار الموافقة'}</span></p>
                </div>
              </div>

              {/* Items list */}
              <table className="w-full text-right text-xs mt-6">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-slate-550 font-black">
                    <th className="px-2 py-1.5">الصنف/الخدمة</th>
                    <th className="px-2 py-1.5 text-center">السعر</th>
                    <th className="px-2 py-1.5 text-center">الكمية</th>
                    <th className="px-2 py-1.5 text-center">الخصم</th>
                    <th className="px-2 py-1.5 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {selectedDoc.items && selectedDoc.items.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-2 py-2 font-bold text-slate-900">{item.name}</td>
                      <td className="px-2 py-2 text-center font-mono">{formatCurrency(item.price)}</td>
                      <td className="px-2 py-2 text-center font-mono">{item.qty}</td>
                      <td className="px-2 py-2 text-center text-rose-500 font-mono">{formatCurrency(item.discount)}</td>
                      <td className="px-2 py-2 text-left font-mono font-bold text-slate-900">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="w-1/2 mr-auto text-xs font-black space-y-1.5 border-t border-slate-150 pt-4 mt-6">
                <div className="flex justify-between text-slate-450">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono">{formatCurrency(selectedDoc.subtotal || selectedDoc.total)}</span>
                </div>
                <div className="flex justify-between text-slate-450">
                  <span>الضريبة (15%):</span>
                  <span className="font-mono">+{formatCurrency(selectedDoc.tax || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-900 border-t border-slate-100 pt-1.5 text-sm">
                  <span>الإجمالي النهائي:</span>
                  <span className="font-mono text-blue-650 font-black">{formatCurrency(selectedDoc.total)}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedDoc.notes && (
                <div className="mt-8 p-3 bg-slate-50 border border-slate-150 rounded text-[11px] text-slate-500 font-bold">
                  <span className="block font-black text-slate-700 mb-1">ملاحظات وشروط:</span>
                  <p>{selectedDoc.notes}</p>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 text-xs font-black text-center mt-12 pt-8 border-t border-slate-100">
                <div>
                  <p className="text-slate-450">توقيع المسؤول المالي</p>
                  <p className="mt-8 text-slate-300">----------------------</p>
                </div>
                <div>
                  <p className="text-slate-450">توقيع المستلم (العميل)</p>
                  <p className="mt-8 text-slate-300">----------------------</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </ErpPageLayout>
  );
}

// Helper Labels
function getViewLabel(view?: string) {
  switch (view) {
    case 'order': return 'أمر مبيعات';
    case 'return': return 'مرتجع مبيعات';
    case 'recurring': return 'أمر بيع دوري';
    case 'quotations': return 'عرض أسعار عملاء';
    default: return 'مستند';
  }
}
