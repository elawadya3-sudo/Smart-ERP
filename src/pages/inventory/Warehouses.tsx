import React, { useState, useEffect } from 'react';
import { 
  Warehouse as WarehouseIcon, 
  Database,
  Building2,
  CheckCircle2,
  XCircle,
  Plus,
  ShieldCheck,
  ChevronRight,
  Store,
  ArrowRightLeft,
  Pencil,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, setDoc, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { cn, formatDate } from '../../lib/utils';
import { Warehouse } from '../../types';
import { getCurrentTenant } from '../../lib/tenantStorage';

const INITIAL_WAREHOUSES: any[] = [
  {
    id: '1',
    name: 'المخزن الرئيسي (Main Warehouse)',
    type: 'MAIN',
    status: 'Active',
    createdAt: '2024-01-01'
  }
];

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newWarehouse, setNewWarehouse] = useState<{name: string, type: 'MAIN' | 'BRANCH'}>({
    name: '',
    type: 'BRANCH'
  });
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'warehouses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Warehouse));
      setWarehouses(docs.length > 0 ? docs : INITIAL_WAREHOUSES as any);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'warehouses');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const mainWarehouse = warehouses.find(w => w.type === 'MAIN' || w.id === '1');
  const branchWarehouses = warehouses.filter(w => (w.type === 'BRANCH' || !w.type) && w.id !== '1');

  const openAddModal = () => {
    setEditingWarehouseId(null);
    setNewWarehouse({ name: '', type: 'BRANCH' });
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, wh: Warehouse) => {
    e.stopPropagation();
    setEditingWarehouseId(wh.id);
    setNewWarehouse({ name: wh.name, type: (wh as any).type || 'BRANCH' });
    setIsModalOpen(true);
  };

  const handleDeleteWarehouse = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    console.log('handleDeleteWarehouse called for id:', id);
    if (window.confirm('هل أنت متأكد من حذف هذا المستودع؟ لا يمكن التراجع عن هذا الإجراء.')) {
      console.log('Confirmed deletion for id:', id);
      deleteDoc(doc(db, 'warehouses', id)).catch((error) => {
        console.error('Error deleting warehouse:', error);
        handleFirestoreError(error, OperationType.DELETE, `warehouses/${id}`);
      });
    }
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarehouse.name) return;

    if (editingWarehouseId) {
      try {
        await updateDoc(doc(db, 'warehouses', editingWarehouseId), {
          name: newWarehouse.name,
          type: newWarehouse.type
        });
        setIsModalOpen(false);
        setEditingWarehouseId(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `warehouses/${editingWarehouseId}`);
      }
    } else {
      // Check tenant limits
      let currentTenant = null;
      try {
        currentTenant = await getCurrentTenant();
      } catch (error) {
        console.warn('Unable to load current tenant data:', error);
      }

      if (currentTenant) {
        const branchCount = warehouses.filter(w => (w.type === 'BRANCH' || !w.type) && w.id !== '1').length;
        if (branchCount >= currentTenant.maxBranches) {
          alert(`عذراً، لقد وصلت للحد الأقصى للفروع المسموح بها (${currentTenant.maxBranches}) في خطتك الحالية.`);
          return;
        }
      }

      const id = Math.random().toString(36).substr(2, 9);
      const warehouse: Warehouse = {
        id,
        name: newWarehouse.name,
        code: newWarehouse.name.slice(0, 3).toUpperCase() + Math.floor(Math.random() * 1000),
        isActive: true,
      } as any; // Cast for now because of extra fields in existing data

      // Add createdAt to data being saved
      const dataToSave = {
        ...warehouse,
        type: newWarehouse.type,
        status: 'Active',
        createdAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'warehouses', id), dataToSave);
        setIsModalOpen(false);
        setNewWarehouse({ name: '', type: 'BRANCH' });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `warehouses/${id}`);
      }
    }
  };

  return (
    <div className="space-y-10" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">إدارة المستودعات</h2>
          <p className="text-gray-500 mt-2 font-medium">الهيكل التنظيمي للمخازن والفروع الحالية</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link 
            to="/inventory/transfers"
            className="bg-white text-blue-600 border border-blue-100 px-8 py-4 rounded-2xl font-bold text-sm shadow-sm hover:shadow-md hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
          >
            <ArrowRightLeft className="w-5 h-5" />
            حركة المخزون (Transfers)
          </Link>
          <button 
            onClick={openAddModal}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            إضافة مستودع جديد
          </button>
        </div>
      </div>

      {/* Main Warehouse Highlight Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-800">المستودع الرئيسي (HQ)</h3>
        </div>
        
        {mainWarehouse ? (
          <Link to={`/inventory/warehouses/${mainWarehouse.id}`} className="block">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 p-10 rounded-[3rem] shadow-2xl shadow-blue-200 group hover:shadow-blue-300 transition-shadow cursor-pointer"
            >
              {/* Background Decorative Element */}
              <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
              
              <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center text-white border border-white/30 shadow-inner group-hover:scale-110 transition-transform">
                    <Database className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white mb-1 group-hover:text-blue-50 transition-colors">{mainWarehouse.name}</h4>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-sm font-bold text-white uppercase tracking-widest">
                         المخزون المركزي
                      </span>
                      <span className="flex items-center gap-1.5 text-blue-100 text-sm font-bold">
                         <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                         نشط بالكامل
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4 w-full md:w-auto">
                  <div className="flex-1 md:flex-none px-6 py-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-4">
                    <div>
                      <p className="text-blue-200 text-sm font-bold uppercase tracking-widest mb-1">تاريخ التأسيس</p>
                      <p className="text-white font-mono font-bold tracking-wider">{formatDate(mainWarehouse.createdAt)}</p>
                    </div>
                    <ChevronRight className="w-6 h-6 text-white opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            </motion.div>
          </Link>
        ) : (
          <div className="p-12 border-2 border-dashed border-gray-200 rounded-[3rem] flex flex-col items-center justify-center text-gray-400 gap-3">
            <Database className="w-12 h-12 opacity-20" />
            <p className="font-bold">لم يتم تحديد مخزن رئيسي بعد</p>
          </div>
        )}
      </section>

      {/* Branch Warehouses Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <Store className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-bold text-gray-800">مستودعات الفروع (Branches)</h3>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">الفرع / المستودع</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">الحالة</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">تاريخ الإضافة</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {branchWarehouses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-gray-400 font-bold">
                       لا توجد مخازن فروع حالياً
                    </td>
                  </tr>
                ) : branchWarehouses.map((wh, index) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={wh.id} 
                    className="hover:bg-gray-50/80 transition-colors group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <button 
                            onClick={() => navigate(`/inventory/warehouses/${wh.id}`)}
                            className="font-bold text-gray-900 hover:text-blue-600 transition-colors text-right block"
                          >
                            {wh.name}
                          </button>
                          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-0.5">Branch Account</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          wh.status === 'Active' ? "bg-green-500 animate-pulse" : "bg-gray-300"
                        )} />
                        <span className={cn(
                          "text-sm font-bold",
                          wh.status === 'Active' ? "text-green-600" : "text-gray-400"
                        )}>
                          {wh.status === 'Active' ? 'نشط' : 'متوقف'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-mono font-bold text-gray-400 tracking-wider">
                      {formatDate(wh.createdAt)}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        {confirmDeleteId === wh.id ? (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteDoc(doc(db, 'warehouses', wh.id)).catch((error) => {
                                  console.error('Error deleting warehouse:', error);
                                  handleFirestoreError(error, OperationType.DELETE, `warehouses/${wh.id}`);
                                });
                                setConfirmDeleteId(null);
                              }}
                              className="text-xs font-bold text-red-600 px-2 py-1 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              حذف
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              className="text-xs font-bold text-gray-500 px-2 py-1 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={(e) => openEditModal(e, wh)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="تعديل"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(wh.id);
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <ChevronRight className="w-5 h-5 text-gray-300 ml-2 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Add/Edit Warehouse Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] p-12 shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleSaveWarehouse} className="space-y-8">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-gray-900 text-center">
                    {editingWarehouseId ? 'تعديل المستودع' : 'إضافة مخزن جديد'}
                  </h3>
                  <p className="text-gray-400 text-sm text-center font-medium italic">أدخل تفاصيل المستودع أو الفرع</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">اسم المستودع</label>
                    <input 
                      required
                      type="text"
                      placeholder="مثال: مخزن فرع الشرقية"
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold transition-all"
                      value={newWarehouse.name}
                      onChange={e => setNewWarehouse({...newWarehouse, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">نوع المستودع</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setNewWarehouse({...newWarehouse, type: 'MAIN'})}
                        className={cn(
                          "flex items-center justify-center gap-3 py-4 rounded-2xl border-2 transition-all font-bold text-sm",
                          newWarehouse.type === 'MAIN' 
                            ? "bg-blue-50 border-blue-600 text-blue-600 shadow-lg shadow-blue-50" 
                            : "border-gray-100 text-gray-400 hover:border-gray-200"
                        )}
                      >
                        <Database className="w-5 h-5" />
                        رئيسي (Main)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewWarehouse({...newWarehouse, type: 'BRANCH'})}
                        className={cn(
                          "flex items-center justify-center gap-3 py-4 rounded-2xl border-2 transition-all font-bold text-sm",
                          newWarehouse.type === 'BRANCH' 
                            ? "bg-blue-50 border-blue-600 text-blue-600 shadow-lg shadow-blue-50" 
                            : "border-gray-100 text-gray-400 hover:border-gray-200"
                        )}
                      >
                        <Building2 className="w-5 h-5" />
                        فرعي (Branch)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    حفظ المستودع
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-500 font-bold py-5 rounded-2xl hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}



