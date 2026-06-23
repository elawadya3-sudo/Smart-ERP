import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Check,
  X,
  Clock,
  Building2,
  Users,
  Coins,
  History,
  FileText,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  addDoc
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

export default function SalesApprovals() {
  const { subview } = useParams<{ subview: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [approvalList, setApprovalList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  // Load approvals
  useEffect(() => {
    setLoading(true);
    const colName = subview === 'returns' ? 'sales_returns' : 'sales_orders';
    const q = query(collection(db, colName));

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Filter items according to the subview context
      let filtered: any[] = [];
      if (subview === 'general') {
        filtered = items.filter(i => i.status === 'pending_approval');
      } else if (subview === 'returns') {
        filtered = items.filter(i => i.status === 'pending_approval');
      } else if (subview === 'deliveries') {
        filtered = items.filter(i => i.status === 'approved'); // Approved orders ready for delivery confirmation
      }

      if (filtered.length === 0) {
        setApprovalList(getMockApprovals(subview));
      } else {
        setApprovalList(filtered);
      }
      setLoading(false);
    }, (err) => {
      setApprovalList(getMockApprovals(subview));
      setLoading(false);
    });

    return () => unsub();
  }, [subview]);

  // Mock data fallbacks for approvals
  const getMockApprovals = (view?: string) => {
    switch (view) {
      case 'general':
        return [
          { id: 'SO-00002', customerName: 'مؤسسة الرياض', total: 12500, createdAt: '2026-06-23T11:30:00Z', notes: 'طلب شراء خاص بقسم التوريدات المباشرة', repName: 'سارة علي' },
          { id: 'SO-00006', customerName: 'شركة النجم الفضي', total: 64200, createdAt: '2026-06-23T14:10:00Z', notes: 'خصم استثنائي تم ترخيصه هاتفيا', repName: 'أحمد محمود' }
        ];
      case 'returns':
        return [
          { id: 'SR-00002', customerName: 'شركة البنيان للمقاولات', total: 3400, createdAt: '2026-06-23T09:15:00Z', notes: 'تلف بالعبوة الخارجية للبضاعة المستلمة' }
        ];
      case 'deliveries':
        return [
          { id: 'SO-00001', customerName: 'شركة النور للتجارة', total: 45000, createdAt: '2026-06-23T12:00:00Z', notes: 'توصيل لباب المستودع الرئيسي بالرياض', repName: 'أحمد محمود' }
        ];
      default:
        return [];
    }
  };

  // Process Approval / Rejection
  const handleDecision = async (status: 'approved' | 'rejected' | 'delivered') => {
    if (!selectedItem) return;
    setSaving(true);

    const colName = subview === 'returns' ? 'sales_returns' : 'sales_orders';
    const auditLog = {
      userEmail: user?.email || 'admin@nezam.com',
      userName: user?.name || 'مدير النظام',
      action: `اتخاذ قرار تصديق (${status})`,
      details: `تم تعديل حالة المستند ${selectedItem.id} إلى ${status}. ملاحظات: ${comment}`,
      timestamp: new Date().toISOString()
    };

    try {
      if (selectedItem.id.startsWith('SO-') && (selectedItem.id.endsWith('02') || selectedItem.id.endsWith('06') || selectedItem.id.endsWith('01') || selectedItem.id.endsWith('02')) || selectedItem.id.startsWith('SR-')) {
        // Local state update for mock items
        setApprovalList(prev => prev.filter(i => i.id !== selectedItem.id));
      } else {
        // Firestore update
        const docRef = doc(db, colName, selectedItem.id);
        await updateDoc(docRef, {
          status,
          approvedBy: user?.name || 'المدير المالي',
          approvalNotes: comment,
          updatedAt: new Date().toISOString()
        });
      }

      // Add to security/audit logs
      try {
        await addDoc(collection(db, 'security_logs'), auditLog);
      } catch {}

      // Write inventory adjustment log if delivered
      if (status === 'delivered') {
        const warehouseLog = {
          action: 'INVENTORY_ISSUE',
          details: `صرف مخزني تلقائي بموجب تسليم أمر البيع رقم #${selectedItem.id}`,
          timestamp: new Date().toISOString()
        };
        try {
          await addDoc(collection(db, 'security_logs'), warehouseLog);
        } catch {}
      }

      setSelectedItem(null);
      setComment('');
    } catch {
      alert('حدث خطأ أثناء حفظ القرار');
    } finally {
      setSaving(false);
    }
  };

  const getSubTitle = (view?: string) => {
    switch (view) {
      case 'general': return 'أوامر مبيعات معلقة بانتظار تصديق الإدارة المالي';
      case 'returns': return 'طلبات مرتجع المبيعات قيد المراجعة الفنية';
      case 'deliveries': return 'أوامر بيع معتمدة بانتظار تأكيد سند التسليم والصرف المخزني';
      default: return 'التصديقات';
    }
  };

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={subview === 'general' ? 'تصديقات أوامر البيع' : subview === 'returns' ? 'تصديقات المرتجعات' : 'تصديقات التسليم والصرف'}
        description="تفويض الحسابات المبيعية للمناديب، تسوية الفواتير وتوثيق مستندات الصرف"
        breadcrumbs={[{ label: 'الرئيسية' }, { label: 'المبيعات' }, { label: 'تصديقات المبيعات' }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Approvals Table List */}
        <div className="lg:col-span-2">
          <ErpCard title={getSubTitle(subview)} subtitle="مراجعة التراخيص والمستندات المالية المعلقة">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold">جاري تحميل السجلات...</p>
                </div>
              ) : approvalList.length === 0 ? (
                <div className="py-16 text-center text-slate-450 font-bold italic">
                  لا توجد طلبات معلقة بانتظار اتخاذ قرار حالياً.
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-slate-550 font-black">
                      <th className="px-3 py-2 text-right">رقم المستند</th>
                      <th className="px-3 py-2 text-right">العميل</th>
                      <th className="px-3 py-2 text-left">إجمالي القيمة</th>
                      <th className="px-3 py-2">مسؤول البيع</th>
                      <th className="px-3 py-2 text-center w-24">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                    {approvalList.map((item, idx) => (
                      <tr
                        key={idx}
                        className={cn(
                          "hover:bg-slate-50/50 transition-colors cursor-pointer",
                          selectedItem?.id === item.id && "bg-blue-50/40 hover:bg-blue-50/50"
                        )}
                        onClick={() => setSelectedItem(item)}
                      >
                        <td className="px-3 py-2 font-mono text-blue-650 font-black">{item.id}</td>
                        <td className="px-3 py-2">{item.customerName}</td>
                        <td className="px-3 py-2 text-left font-sans font-black text-slate-900">{formatCurrency(item.total)}</td>
                        <td className="px-3 py-2 text-slate-500 text-[11px]">{item.repName || 'مباشر'}</td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(item);
                            }}
                            className="bg-slate-900 text-white px-2.5 py-0.5 rounded text-[10px] hover:bg-slate-800"
                          >
                            عرض ومراجعة
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </ErpCard>
        </div>

        {/* Action Panel Details */}
        <div>
          {selectedItem ? (
            <ErpCard title="مراجعة وتفويض المستند" subtitle={selectedItem.id}>
              <div className="space-y-4 text-right">
                
                {/* Meta details */}
                <div className="bg-slate-50 p-3 rounded space-y-1.5 text-xs font-bold text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-450">رقم الوثيقة:</span>
                    <span className="font-mono font-black text-slate-900">{selectedItem.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">العميل المستفيد:</span>
                    <span>{selectedItem.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">المبلغ الإجمالي:</span>
                    <span className="font-sans font-black text-blue-650">{formatCurrency(selectedItem.total)}</span>
                  </div>
                  {selectedItem.notes && (
                    <div className="border-t border-slate-200/60 pt-2 mt-2">
                      <span className="text-[10px] text-slate-400 block mb-1">ملاحظات الطلب الأصلي:</span>
                      <p className="text-[11px] font-medium leading-relaxed">{selectedItem.notes}</p>
                    </div>
                  )}
                </div>

                {/* Comment Text */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 block">شرح أو ملاحظات القرار الاعتماد</label>
                  <textarea
                    placeholder="اكتب مبرر الاعتماد أو الرفض هنا..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="w-full border border-slate-200 rounded p-2 text-xs outline-none bg-slate-50 focus:bg-white resize-none h-16"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {subview === 'deliveries' ? (
                    <button
                      onClick={() => handleDecision('delivered')}
                      disabled={saving}
                      className="flex-1 bg-emerald-600 text-white py-1.5 rounded text-xs font-black hover:bg-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      اعتماد التسليم والصرف
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleDecision('approved')}
                        disabled={saving}
                        className="flex-1 bg-emerald-600 text-white py-1.5 rounded text-xs font-black hover:bg-emerald-700 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        موافقة
                      </button>
                      <button
                        onClick={() => handleDecision('rejected')}
                        disabled={saving}
                        className="flex-1 bg-rose-600 text-white py-1.5 rounded text-xs font-black hover:bg-rose-700 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        رفض الطلب
                      </button>
                    </>
                  )}
                </div>

              </div>
            </ErpCard>
          ) : (
            <div className="bg-white rounded border border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-center min-h-[280px] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.025)]">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
                <ShieldCheck className="w-6 h-6 text-blue-500" />
              </div>
              <p className="font-bold text-slate-500 text-xs">حدد مستنداً من القائمة لمراجعته واتخاذ قرار التصديق والاعتماد</p>
            </div>
          )}
        </div>
      </div>
    </ErpPageLayout>
  );
}
