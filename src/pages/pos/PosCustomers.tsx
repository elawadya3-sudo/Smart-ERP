import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Wallet,
  Pencil,
  Trash2,
  X,
  CreditCard
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Customer, Warehouse } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { cn, formatCurrency } from '../../lib/utils';
import {
  ErpPageLayout,
  ErpPageHeader,
  ErpCard,
  ErpButton,
  ErpInput
} from '../../components/ui/ErpUI';
import { motion, AnimatePresence } from 'motion/react';

export default function PosCustomers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState<number>(0);
  const [balanceType, setBalanceType] = useState<'credit' | 'debit'>('debit');

  // Initialize selectedBranchId based on user branch
  useEffect(() => {
    if (user?.branchId) {
      setSelectedBranchId(user.branchId);
    } else {
      setSelectedBranchId('ADMIN');
    }
  }, [user]);

  // Fetch warehouses
  useEffect(() => {
    const q = query(collection(db, 'warehouses'));
    const unsub = onSnapshot(q, (snapshot) => {
      setWarehouses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
    });
    return () => unsub();
  }, []);

  // Real-time synchronization of customers
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error loading customers:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Filter customers by selected branch and search term (name or phone)
  const filteredCustomers = customers.filter(c => {
    const matchesBranch = (c.branchId || 'ADMIN') === selectedBranchId;
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.phone.includes(searchTerm);
    return matchesBranch && matchesSearch;
  });

  // Open modal for add or edit
  const openModal = (customer: Customer | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setPhone(customer.phone);
      setAddress(customer.address || '');
      setBalance(Math.abs(customer.balance) || 0);
      setBalanceType(customer.balanceType || 'debit');
    } else {
      setEditingCustomer(null);
      setName('');
      setPhone('');
      setAddress('');
      setBalance(0);
      setBalanceType('debit');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('الرجاء إدخال الاسم ورقم الهاتف.');
      return;
    }

    const customerData = {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      balance: Number(balance) || 0,
      balanceType: balanceType,
      points: editingCustomer ? editingCustomer.points : 0,
      branchId: selectedBranchId
    };

    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), customerData);
      } else {
        await addDoc(collection(db, 'customers'), {
          ...customerData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving customer:", error);
      alert('حدث خطأ أثناء حفظ بيانات العميل.');
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (window.confirm(`هل أنت متأكد من حذف العميل "${customer.name}"؟`)) {
      try {
        await deleteDoc(doc(db, 'customers', customer.id));
      } catch (error) {
        console.error("Error deleting customer:", error);
        alert('حدث خطأ أثناء حذف العميل.');
      }
    }
  };

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title="إدارة عملاء نقاط البيع"
        description="إضافة وتعديل وحذف العملاء، وتحديث الأرصدة المدنية والدائنة للبيع الآجل."
        breadcrumbs={[{ label: 'الرئيسية' }, { label: 'نقاط البيع' }, { label: 'إدارة العملاء' }]}
        actions={
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
            {/* Branch Selector for Admin */}
            {!user?.branchId ? (
              <div className="relative w-full sm:w-48">
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all text-right appearance-none cursor-pointer"
                >
                  <option value="ADMIN">البيع المباشر (الأدمن)</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
              </div>
            ) : (
              <div className="bg-slate-100 text-slate-600 px-3.5 py-2 rounded-xl text-xs font-black select-none border border-slate-200/45 shrink-0 text-center">
                الفرع الحالي: {warehouses.find(w => w.id === user.branchId)?.name || 'غير معروف'}
              </div>
            )}

            <div className="relative flex-1 sm:w-64">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث بالاسم أو رقم الهاتف..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pr-10 pl-4 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all text-right"
              />
            </div>
            <ErpButton
              variant="primary"
              icon={Plus}
              onClick={() => openModal()}
              className="font-bold text-xs w-full sm:w-auto"
            >
              إضافة عميل
            </ErpButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6" dir="rtl">
        <ErpCard title="قائمة العملاء" subtitle="سجل بكافة العملاء المسجلين بالفرع وحالتهم المالية">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">الاسم</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">الهاتف</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">العنوان</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الرصيد المالي</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">نقاط الولاء</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-left">التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                      جاري تحميل بيانات العملاء...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400 italic">
                      لا يوجد نتائج مطابقة للبحث أو لم يتم تسجيل عملاء بعد.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(customer => (
                    <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">
                            {customer.name[0]}
                          </div>
                          <div>
                            <p className="font-black text-slate-900">{customer.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600">{customer.phone}</td>
                      <td className="px-6 py-4 text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-300" />
                          {customer.address || 'بدون عنوان'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {customer.balance > 0 ? (
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-black border",
                            customer.balanceType === 'credit'
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : "bg-rose-50 text-rose-600 border-rose-200"
                          )}>
                            {formatCurrency(customer.balance)} - {customer.balanceType === 'credit' ? 'دائن (له)' : 'مدين (عليه)'}
                          </span>
                        ) : (
                          <span className="text-slate-400">0.00 ج.م</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-amber-600 font-mono">
                        {customer.points || 0} نقطة
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openModal(customer)}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-blue-600 transition-colors"
                            title="تعديل"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(customer)}
                            className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-600 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ErpCard>
      </div>

      {/* Add / Edit Customer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="text-right">
                  <h3 className="text-xl font-black text-slate-900">
                    {editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">
                    إدارة حساب العميل، العناوين، والأرصدة في نقاط البيع
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-4 text-right">
                <ErpInput
                  label="اسم العميل *"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: محمد أحمد"
                  required
                />
                <ErpInput
                  label="رقم الهاتف *"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="مثال: 01023456789"
                  required
                />
                <ErpInput
                  label="العنوان"
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="مثال: القاهرة، مصر الجديدة"
                />

                <div className="grid grid-cols-2 gap-4">
                  <ErpInput
                    label="الرصيد المالي"
                    type="number"
                    value={balance}
                    onChange={e => setBalance(Number(e.target.value))}
                    min={0}
                    placeholder="0.00"
                  />
                  <div>
                    <label className="text-xs font-black text-slate-400 block mb-2">نوع الرصيد</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setBalanceType('debit')}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold transition-all",
                          balanceType === 'debit'
                            ? "bg-white text-rose-600 shadow-sm font-black border border-rose-100"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        مدين (عليه)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBalanceType('credit')}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold transition-all",
                          balanceType === 'credit'
                            ? "bg-white text-emerald-600 shadow-sm font-black border border-emerald-100"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        دائن (له)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 border-t border-slate-50">
                  <ErpButton
                    type="button"
                    variant="secondary"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 font-bold text-xs"
                  >
                    إلغاء
                  </ErpButton>
                  <ErpButton
                    type="submit"
                    variant="primary"
                    className="flex-1 font-bold text-xs"
                  >
                    حفظ العميل
                  </ErpButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ErpPageLayout>
  );
}
