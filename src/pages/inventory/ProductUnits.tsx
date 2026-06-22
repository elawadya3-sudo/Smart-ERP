import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Save, Trash2, Edit2, Database, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ErpPageLayout, ErpPageHeader, ErpCard, ErpInput, ErpButton } from '../../components/ui/ErpUI';

interface ProductUnit {
  id: string;
  name: string;
  abbreviation: string;
  factor: number;
  description?: string;
}

export default function ProductUnitsPage() {
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [factor, setFactor] = useState(1);
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'product_units'));
      setUnits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductUnit)));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const seedAndLoad = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'product_units'));
        const existingUnits = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductUnit));
        
        if (!localStorage.getItem('units_seeded_v2')) {
          const defaultUnits = [
            { name: 'قطعة', abbreviation: 'PCS', factor: 1, description: 'الوحدة القياسية الفردية الأساسية' },
            { name: 'زوج', abbreviation: 'PR', factor: 2, description: 'زوج من قطعتين' },
            { name: 'علبة', abbreviation: 'BOX', factor: 1, description: 'علبة تحتوي على منتجات' },
            { name: 'دسته', abbreviation: 'DZ', factor: 12, description: 'مجموعة من 12 قطعة' },
            { name: 'كرتونة', abbreviation: 'CTN', factor: 1, description: 'كرتونة شحن وتخزين' },
            { name: 'كجم', abbreviation: 'KG', factor: 1, description: 'وحدة قياس الوزن' },
            { name: 'متر', abbreviation: 'M', factor: 1, description: 'وحدة قياس الطول' },
          ];

          // Find which default units are missing
          const missingUnits = defaultUnits.filter(def => 
            !existingUnits.some(ext => ext.name === def.name)
          );

          if (missingUnits.length > 0) {
            const promises = missingUnits.map(unit => 
              addDoc(collection(db, 'product_units'), {
                ...unit,
                createdAt: new Date().toISOString()
              })
            );
            await Promise.all(promises);
            
            // Re-load to get all units
            const newSnap = await getDocs(collection(db, 'product_units'));
            setUnits(newSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductUnit)));
          } else {
            setUnits(existingUnits);
          }
          localStorage.setItem('units_seeded_v2', 'true');
        } else {
          setUnits(existingUnits);
        }
      } catch (error) {
        console.error("Error seeding default units:", error);
        await loadUnits();
      } finally {
        setLoading(false);
      }
    };
    seedAndLoad();
  }, []);

  const handleImportDefaults = async () => {
    setIsImporting(true);
    try {
      const snap = await getDocs(collection(db, 'product_units'));
      const existingUnits = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductUnit));
      
      const defaultUnits = [
        { name: 'قطعة', abbreviation: 'PCS', factor: 1, description: 'الوحدة القياسية الفردية الأساسية' },
        { name: 'زوج', abbreviation: 'PR', factor: 2, description: 'زوج من قطعتين' },
        { name: 'علبة', abbreviation: 'BOX', factor: 1, description: 'علبة تحتوي على منتجات' },
        { name: 'دسته', abbreviation: 'DZ', factor: 12, description: 'مجموعة من 12 قطعة' },
        { name: 'كرتونة', abbreviation: 'CTN', factor: 1, description: 'كرتونة شحن وتخزين' },
        { name: 'كجم', abbreviation: 'KG', factor: 1, description: 'وحدة قياس الوزن' },
        { name: 'متر', abbreviation: 'M', factor: 1, description: 'وحدة قياس الطول' },
      ];

      const missingUnits = defaultUnits.filter(def => 
        !existingUnits.some(ext => ext.name === def.name)
      );

      if (missingUnits.length > 0) {
        const promises = missingUnits.map(unit => 
          addDoc(collection(db, 'product_units'), {
            ...unit,
            createdAt: new Date().toISOString()
          })
        );
        await Promise.all(promises);
        await loadUnits();
        alert('تم استيراد الوحدات الافتراضية بنجاح!');
      } else {
        alert('جميع الوحدات الافتراضية موجودة بالفعل في النظام.');
      }
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء استيراد الوحدات.');
    } finally {
      setIsImporting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setAbbreviation('');
    setFactor(1);
    setDescription('');
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !abbreviation.trim()) return;

    try {
      const payload = {
        name: name.trim(),
        abbreviation: abbreviation.trim(),
        factor: Number(factor) || 1,
        description: description.trim(),
        createdAt: new Date().toISOString(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'product_units', editingId), payload);
      } else {
        await addDoc(collection(db, 'product_units'), payload);
      }
      resetForm();
      await loadUnits();
    } catch (error: any) {
      console.error(error);
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'product_units');
    }
  };

  const editUnit = (unit: ProductUnit) => {
    setEditingId(unit.id);
    setName(unit.name);
    setAbbreviation(unit.abbreviation);
    setFactor(unit.factor);
    setDescription(unit.description || '');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف وحدة القياس؟')) return;
    try {
      await deleteDoc(doc(db, 'product_units', id));
      await loadUnits();
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.DELETE, `product_units/${id}`);
    }
  };

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title="وحدات القياس"
        description="أضف وحدات قياس جديدة وحرّر عوامل التحويل الخاصة بالمنتجات."
        breadcrumbs={[{ label: 'المخازن' }, { label: 'بيانات أساسية' }, { label: 'وحدات القياس' }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
        <form onSubmit={handleSave}>
          <ErpCard title={editingId ? 'تعديل وحدة قياس' : 'إضافة وحدة قياس جديدة'} subtitle="أدخل تفاصيل الوحدة وعامل التحويل">
            <div className="space-y-4">
              <ErpInput 
                label="اسم الوحدة" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="قطعة، زوج، كرتونة..." 
                required 
              />
              <div className="grid grid-cols-2 gap-4">
                <ErpInput 
                  label="الاختصار" 
                  value={abbreviation} 
                  onChange={e => setAbbreviation(e.target.value)} 
                  placeholder="PCS، BOX" 
                  required 
                />
                <ErpInput 
                  label="عامل التحويل" 
                  type="number" 
                  value={factor} 
                  onChange={e => setFactor(Number(e.target.value))} 
                  placeholder="1" 
                  required 
                />
              </div>
              <div className="space-y-1.5 w-full">
                <label className="block text-xs font-extrabold text-slate-400 select-none">الوصف</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  rows={3}
                  className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/40 focus:bg-white text-right"
                  placeholder="أضف وصفاً اختيارياً للوحدة..."
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <ErpButton type="submit" variant="primary" icon={Save}>
                  {editingId ? 'تحديث الوحدة' : 'حفظ الوحدة'}
                </ErpButton>
                {editingId && (
                  <ErpButton type="button" variant="secondary" onClick={() => { setEditingId(null); resetForm(); }}>
                    إلغاء
                  </ErpButton>
                )}
              </div>
            </div>
          </ErpCard>
        </form>

        <ErpCard 
          title="القائمة الحالية" 
          subtitle="وحدات القياس المسجلة في النظام"
          headerActions={
            <div className="flex items-center gap-3">
              <ErpButton
                type="button"
                variant="secondary"
                onClick={handleImportDefaults}
                loading={isImporting}
                icon={Database}
                className="text-xs"
              >
                استيراد الوحدات الافتراضية
              </ErpButton>
              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{units.length} وحدة</span>
            </div>
          }
        >
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-16 rounded-2xl bg-gray-100" />
              <div className="h-16 rounded-2xl bg-gray-100" />
            </div>
          ) : units.length === 0 ? (
            <div className="py-20 text-center text-gray-400 font-bold">لا توجد وحدات حتى الآن.</div>
          ) : (
            <div className="space-y-3">
              {units.map(unit => (
                <motion.div key={unit.id} layout className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{unit.name} ({unit.abbreviation})</p>
                      <p className="text-slate-500 text-xs mt-1.5 font-bold">عامل التحويل إلى الوحدة الأساسية: <span className="text-blue-600 font-extrabold">{unit.factor}</span></p>
                    </div>
                    <div className="flex gap-2">
                      <ErpButton type="button" variant="secondary" onClick={() => editUnit(unit)} icon={Edit2} className="text-xs py-1.5 px-3">
                        تعديل
                      </ErpButton>
                      <ErpButton type="button" variant="danger" onClick={() => handleDelete(unit.id)} icon={Trash2} className="text-xs py-1.5 px-3">
                        حذف
                      </ErpButton>
                    </div>
                  </div>
                  {unit.description && <p className="mt-3 text-xs text-slate-400 font-bold border-t border-slate-200/50 pt-2.5">{unit.description}</p>}
                </motion.div>
              ))}
            </div>
          )}
        </ErpCard>
      </div>
    </ErpPageLayout>
  );
}
