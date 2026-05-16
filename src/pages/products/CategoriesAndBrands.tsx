import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Plus, Trash2, Edit2, Tag, Briefcase } from 'lucide-react';
import { motion } from 'motion/react';

interface Item {
  id: string;
  name: string;
}

export default function CategoriesAndBrands() {
  const [categories, setCategories] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Item[]>([]);
  const [shoeTypes, setShoeTypes] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newShoeType, setNewShoeType] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const catSnap = await getDocs(collection(db, 'categories'));
      setCategories(catSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));

      const brandSnap = await getDocs(collection(db, 'brands'));
      setBrands(brandSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));

      const shoeSnap = await getDocs(collection(db, 'shoe_types'));
      setShoeTypes(shoeSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleAddCategory called with:', newCategory);
    if (!newCategory.trim()) {
      console.log('Category name is empty, skipping');
      return;
    }
    try {
      console.log('Attempting to add to Firestore...');
      await addDoc(collection(db, 'categories'), { name: newCategory.trim(), createdAt: new Date().toISOString() });
      setNewCategory('');
      loadData();
    } catch (error: any) {
      console.error(error);
      alert(`حدث خطأ أثناء الإضافة: ${error.code || 'unknown'} - ${error.message}`);
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا القسم؟')) {
      try {
        await deleteDoc(doc(db, 'categories', id));
        loadData();
      } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء الحذف.');
      }
    }
  };

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleAddBrand called with:', newBrand);
    if (!newBrand.trim()) {
      console.log('Brand name is empty, skipping');
      return;
    }
    try {
      console.log('Attempting to add to Firestore...');
      await addDoc(collection(db, 'brands'), { name: newBrand.trim(), createdAt: new Date().toISOString() });
      setNewBrand('');
      loadData();
    } catch (error: any) {
      console.error(error);
      alert(`حدث خطأ أثناء الإضافة: ${error.code || 'unknown'} - ${error.message}`);
      handleFirestoreError(error, OperationType.CREATE, 'brands');
    }
  };

  const handleDeleteBrand = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا البراند؟')) {
      try {
        await deleteDoc(doc(db, 'brands', id));
        loadData();
      } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء الحذف.');
      }
    }
  };

  const handleAddShoeType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShoeType.trim()) return;
    try {
      await addDoc(collection(db, 'shoe_types'), { name: newShoeType.trim(), createdAt: new Date().toISOString() });
      setNewShoeType('');
      loadData();
    } catch (error: any) {
      console.error(error);
      alert(`حدث خطأ: ${error.code} - ${error.message}`);
    }
  };

  const handleDeleteShoeType = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا النوع؟')) {
      try {
        await deleteDoc(doc(db, 'shoe_types', id));
        loadData();
      } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء الحذف.');
      }
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Categories Section */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">الأقسام (Categories)</h2>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">إدارة أقسام المنتجات</p>
          </div>
        </div>

        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="اسم القسم الجديد..."
            className="flex-1 bg-gray-50 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="space-y-2">
          {categories.map(category => (
            <div key={category.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl group hover:bg-indigo-50/50 transition-colors">
              <span className="font-bold text-gray-700">{category.name}</span>
              <button
                onClick={() => handleDeleteCategory(category.id)}
                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-4">لا توجد أقسام مسجلة</p>
          )}
        </div>
      </div>

      {/* Brands Section */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">البراندات (Brands)</h2>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">إدارة الماركات التجارية</p>
          </div>
        </div>

        <form onSubmit={handleAddBrand} className="flex gap-2">
          <input
            type="text"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            placeholder="اسم البراند الجديد..."
            className="flex-1 bg-gray-50 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="space-y-2">
          {brands.map(brand => (
            <div key={brand.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl group hover:bg-blue-50/50 transition-colors">
              <span className="font-bold text-gray-700">{brand.name}</span>
              <button
                onClick={() => handleDeleteBrand(brand.id)}
                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {brands.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-4">لا توجد ماركات مسجلة</p>
          )}
        </div>
      </div>
      </div>

      {/* Shoe Types Section */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">أنواع الأحذية (Shoe Types)</h2>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">إدارة أنواع الأحذية</p>
          </div>
        </div>

        <form onSubmit={handleAddShoeType} className="flex gap-2">
          <input
            type="text"
            value={newShoeType}
            onChange={(e) => setNewShoeType(e.target.value)}
            placeholder="اسم النوع الجديد..."
            className="flex-1 bg-gray-50 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-100"
          />
          <button
            type="submit"
            className="bg-purple-600 text-white px-4 py-2 rounded-xl flex items-center justify-center hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="space-y-2">
          {shoeTypes.map(st => (
            <div key={st.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl group hover:bg-purple-50/50 transition-colors">
              <span className="font-bold text-gray-700">{st.name}</span>
              <button
                onClick={() => handleDeleteShoeType(st.id)}
                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {shoeTypes.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-4">لا توجد أنواع مسجلة</p>
          )}
        </div>
      </div>
    </div>
  );
}



