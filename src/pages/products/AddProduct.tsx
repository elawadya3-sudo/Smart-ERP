import React, { useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Plus, 
  Save, 
  X, 
  Upload, 
  Barcode, 
  Package, 
  Info, 
  Tag, 
  Globe, 
  Weight, 
  MapPin, 
  Box,
  ChevronLeft,
  DollarSign,
  Layers,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { collection, addDoc, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../../lib/firebase';

const subUnitSchema = z.object({
  unit: z.string().min(1, 'اسم الوحدة مطلوب'),
  conversionRate: z.number().min(1, 'معدل التحويل يجب أن يكون 1 على الأقل'),
  price: z.number().optional(),
});

// Validation Schema
const productSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1, 'اسم الصنف مطلوب'),
  descriptionEn: z.string().optional(),
  modelCode: z.string().optional(),
  barcode: z.string().optional(),
  location: z.string().optional(),
  originNumber: z.string().optional(),
  tags: z.array(z.string()),
  weight: z.number().min(0, 'الوزن يجب أن يكون رقمياً').optional(),
  weightUnit: z.string(),
  gender: z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']),
  costPrice: z.number({ invalid_type_error: 'السعر مطلوب' }).min(0, 'سعر التكلفة يجب أن يكون موجباً'),
  sellingPrice: z.number({ invalid_type_error: 'السعر مطلوب' }).min(0, 'سعر البيع يجب أن يكون موجباً'),
  wholesalePrice: z.union([z.number(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  specialPrice: z.union([z.number(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  minSellingPrice: z.union([z.number(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  referencePrice: z.union([z.number(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  currency: z.string(),
  brand: z.string().optional(),
  category: z.string().optional(),
  shoeType: z.string().optional(),
  unitType: z.enum(['SINGLE', 'MULTIPLE']),
  mainUnit: z.string().optional(),
  subUnits: z.array(subUnitSchema).optional(),
  warrantyDuration: z.number().min(0).optional(),
  warrantyUnit: z.enum(['DAYS', 'MONTHS', 'YEARS']).optional(),
  hasExpiration: z.boolean().optional(),
  expirationDays: z.number().min(0).optional(),
  expirationAlertDays: z.number().min(0).optional(),
  initialQuantity: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  reorderPoint: z.number().min(0).optional(),
  trackInventory: z.boolean().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function AddProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tags, setTags] = useState<string[]>(['Sneakers', 'Running', 'Nike', 'Summer']);
  const [newTag, setNewTag] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [variants, setVariants] = useState<{size: number, color: string, qty: number}[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dbBrands, setDbBrands] = useState<{id: string, name: string}[]>([]);
  const [dbCategories, setDbCategories] = useState<{id: string, name: string}[]>([]);
  const [dbProductTypes, setDbProductTypes] = useState<{id: string, name: string}[]>([]);

  const sections = [
    { id: 'basic', label: 'البيانات الأساسية', icon: Package },
    { id: 'classification', label: 'التصنيف والبراند', icon: Tag },
    { id: 'units', label: 'وحدات القياس', icon: Box },
    { id: 'pricing', label: 'التسعير المتقدم', icon: DollarSign },
    { id: 'inventory', label: 'إعدادات المخزون', icon: Weight },
    { id: 'warranty', label: 'الضمان والصلاحية', icon: ShieldCheck },
    { id: 'variants', label: 'المقاسات والألوان', icon: Layers },
    { id: 'gallery', label: 'معرض الصور', icon: ImageIcon },
  ];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: 'SKU-' + Math.floor(Math.random() * 10000),
      weightUnit: 'KG',
      tags: [],
      costPrice: 0,
      sellingPrice: 0,
      wholesalePrice: 0,
      specialPrice: 0,
      minSellingPrice: 0,
      referencePrice: 0,
      currency: 'EGP',
      unitType: 'SINGLE',
      mainUnit: 'Piece',
      subUnits: [],
      warrantyDuration: 12,
      warrantyUnit: 'MONTHS',
      hasExpiration: false,
      expirationDays: 0,
      expirationAlertDays: 7,
      initialQuantity: 0,
      minStock: 5,
      maxStock: 100,
      reorderPoint: 10,
      trackInventory: true,
      gender: 'UNISEX',
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "subUnits"
  });

  const unitType = watch('unitType');
  const mainUnit = watch('mainUnit');

  const unitOptions = [
    { label: 'قطعة', value: 'Piece' },
    { label: 'زوج', value: 'Pair' },
    { label: 'علبة', value: 'Box' },
    { label: 'دسته', value: 'Dozen' },
    { label: 'كرتونة', value: 'Carton' },
    { label: 'كجم', value: 'KG' },
    { label: 'متر', value: 'Meter' },
  ];

  React.useEffect(() => {
    // Load existing product if editing
    if (id) {
      const loadProduct = async () => {
        try {
          const docRef = doc(db, 'products', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            reset({
              ...data,
            } as ProductFormData);
            if (data.tags) setTags(data.tags);
            if (data.variants) setVariants(data.variants);
            if (data.images && data.images.length > 0) {
              setPreviews(data.images);
            }
          }
        } catch (error) {
          console.error("Error loading product:", error);
        }
      };
      loadProduct();
    }

    // Load Brands, Categories & Product Types
    const loadPickers = async () => {
      const [brandsSnap, categoriesSnap, productTypeSnap] = await Promise.all([
        getDocs(collection(db, 'brands')),
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'shoe_types')),
      ]);
      setDbBrands(brandsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
      setDbCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
      setDbProductTypes(productTypeSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    };

    loadPickers();

  }, [id, reset]);

  const calculateEAN13CheckDigit = (digits: string) => {
    const sum = digits
      .split('')
      .map(Number)
      .reverse()
      .reduce((acc, num, index) => acc + num * (index % 2 === 0 ? 3 : 1), 0);
    const remainder = sum % 10;
    return remainder === 0 ? '0' : String(10 - remainder);
  };

  const generateRandomBarcode = () => {
    const randomDigits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
    const checkDigit = calculateEAN13CheckDigit(randomDigits);
    const barcodeValue = `${randomDigits}${checkDigit}`;
    setValue('barcode', barcodeValue);
  };

  const onSubmit = async (data: ProductFormData) => {
    try {
      const uploadedImageUrls: string[] = [];

      // Upload images to Firebase Storage
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const storageRef = ref(storage, `products/${data.sku}/${Date.now()}-${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        uploadedImageUrls.push(url);
      }

      // Reorder images if main index is not 0
      if (mainImageIndex > 0 && uploadedImageUrls.length > 1) {
        const [mainUrl] = uploadedImageUrls.splice(mainImageIndex, 1);
        uploadedImageUrls.unshift(mainUrl);
      }

      // Combine new image URLs with existing ones if no new ones uploaded
      const finalImages = uploadedImageUrls.length > 0 ? uploadedImageUrls : previews.filter(p => p.startsWith('http'));

      const productData = {
        ...data,
        images: finalImages,
        variants,
        updatedAt: new Date().toISOString(),
        quantity: variants.reduce((sum, v) => sum + v.qty, 0)
      };

      if (id) {
        await updateDoc(doc(db, 'products', id), productData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString(),
        });
      }
      
      navigate('/inventory/products');
    } catch (error) {
      console.error("Submission error:", error);
      handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const currentTags = watch('tags');

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let files: File[] = [];
    if ('files' in e.target && e.target.files) {
      files = Array.from(e.target.files);
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      files = Array.from(e.dataTransfer.files);
    }

    if (files.length > 0) {
      const newFiles = files.filter(file => file.type.startsWith('image/'));
      setImages(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onImageChange(e);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
    if (mainImageIndex === index) {
      setMainImageIndex(0);
    } else if (mainImageIndex > index) {
      setMainImageIndex(prev => prev - 1);
    }
  };

  const addVariant = () => {
    setVariants([...variants, { size: 42, color: 'Black', qty: 0 }]);
  };

  const toggleTag = (tag: string) => {
    const nextTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    setValue('tags', nextTags);
  };

  const handleAddNewTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (!tags.includes(newTag.trim())) {
        setTags([...tags, newTag.trim()]);
      }
      if (!currentTags.includes(newTag.trim())) {
        toggleTag(newTag.trim());
      }
      setNewTag('');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 rtl" dir="rtl">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-900"
          >
            <ChevronLeft className="w-6 h-6 rotate-180" />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">{id ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h1>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-0.5">إدارة المنتجات والأصناف</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-all"
          >
            إلغاء
          </button>
          <button 
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ المنتج'}
          </button>
        </div>
      </div>

      <div className="flex gap-8 max-w-7xl mx-auto px-8 py-12">
        {/* Quick Navigation Sidebar */}
        <aside className="w-64 hidden xl:block sticky top-28 h-fit space-y-2">
           <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm">
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest px-4 mb-4">أقسام الصنف</p>
              {sections.map(section => (
                <a 
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                    <section.icon className="w-4 h-4" />
                  </div>
                  {section.label}
                </a>
              ))}
           </div>
        </aside>

        <main className="flex-1">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-12">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="p-8 space-y-12">
                    {/* البيانات الأساسية */}
                    <section id="basic" className="space-y-6 scroll-mt-28">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-6">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-900 leading-none">البيانات الأساسية</h2>
                          <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-wider">Product core details</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-2 px-1">اسم الصنف (بالعربية) *</label>
                          <input 
                            {...register('name')}
                            type="text" 
                            placeholder="مثال: حذاء نايك اير جوردان"
                            className={cn(
                              "w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all",
                              errors.name && "border-red-200 focus:ring-red-50 bg-white"
                            )}
                          />
                          {errors.name && <p className="text-sm text-red-500 font-bold mt-1.5 mr-2">{errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-2 px-1">كود الصنف (SKU)</label>
                              <input 
                                {...register('sku')}
                                type="text" 
                                className="w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm font-black text-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all font-mono"
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-2 px-1">الرمز التعريفي (الباركود)</label>
                              <div className="relative">
                                <Barcode className="absolute right-5 top-4 w-5 h-5 text-gray-300" />
                                <input 
                                  {...register('barcode')}
                                  type="text" 
                                  placeholder="امسح الباركود..."
                                  className="w-full bg-gray-50 border border-transparent rounded-2xl pr-24 pl-6 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={generateRandomBarcode}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full px-3 py-2 text-xs font-black tracking-wide hover:bg-blue-700 transition-all"
                                >
                                  توليد
                                </button>
                              </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-2 px-1">كود الموديل</label>
                            <input
                              {...register('modelCode')}
                              type="text"
                              placeholder="كود الموديل أو الموديل"
                              className="w-full bg-gray-50 rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-2 px-1">رقم المنشأ</label>
                            <input
                              {...register('originNumber')}
                              type="text"
                              placeholder="رقم المنشأ أو فاتورة المورد"
                              className="w-full bg-gray-50 rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-2 px-1">الموقع</label>
                            <input
                              {...register('location')}
                              type="text"
                              placeholder="موقع التخزين أو الرف"
                              className="w-full bg-gray-50 rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-2 px-1">الوصف</label>
                            <textarea
                              {...register('descriptionEn')}
                              rows={1}
                              placeholder="وصف موجز للصنف"
                              className="w-full bg-gray-50 rounded-3xl px-6 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-2 px-1">الوصف</label>
                          <textarea
                            {...register('descriptionEn')}
                            rows={4}
                            placeholder="اكتب وصفاً موجزاً للصنف"
                            className="w-full bg-gray-50 rounded-3xl px-6 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
                           <div className="space-y-3">
                              <label className="block text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Tag className="w-3 h-3" />
                                الوسوم (Tags)
                              </label>
                              <div className="flex flex-wrap gap-2">
                                  {tags.map(tag => (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => toggleTag(tag)}
                                      className={cn(
                                        "px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                                        currentTags.includes(tag) 
                                          ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" 
                                          : "bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100"
                                      )}
                                    >
                                      {tag}
                                    </button>
                                  ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  value={newTag}
                                  onChange={(e) => setNewTag(e.target.value)}
                                  onKeyDown={handleAddNewTag}
                                  placeholder="إضافة وسم جديد ثم اضغط Enter"
                                  className="flex-1 bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => { if (newTag.trim()) { if (!tags.includes(newTag.trim())) setTags([...tags, newTag.trim()]); if (!currentTags.includes(newTag.trim())) toggleTag(newTag.trim()); setNewTag(''); } }}
                                  className="bg-blue-600 text-white rounded-2xl px-4 py-3 text-sm font-black"
                                >إضافة</button>
                              </div>
                          </div>

                          <div className="space-y-3">
                              <label className="block text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Weight className="w-3 h-3 text-blue-600" />
                                الوزن
                              </label>
                              <div className="flex gap-3">
                                  <input 
                                    {...register('weight', { valueAsNumber: true })}
                                    type="number" 
                                    step="0.01"
                                    placeholder="0.00"
                                    className="flex-1 bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm font-black focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                                  />
                                  <select 
                                    {...register('weightUnit')}
                                    className="bg-gray-100 border-none rounded-2xl px-6 py-4 text-sm font-black text-gray-600 focus:ring-4 focus:ring-blue-100 outline-none"
                                  >
                                    <option value="KG">كجم</option>
                                    <option value="GRAM">جرام</option>
                                  </select>
                              </div>
                          </div>
                        </div>
                      </div>
                    </section>

                  {/* التصنيف والبراند */}
                  <section id="classification" className="space-y-6 scroll-mt-28">
                      <div className="flex items-center gap-3 border-b border-gray-50 pb-6">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                          <Tag className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-900 leading-none">التصنيف والبراند</h2>
                          <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-wider">Category, brand & product classification</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <label className="block text-sm font-black text-gray-500 uppercase tracking-widest px-1">البراند (Brand)</label>
                                  <button
                                    type="button"
                                    onClick={() => navigate('/inventory/products?tab=settings')}
                                    className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-900"
                                  >إدارة البراندات</button>
                                </div>
                                <select 
                                  {...register('brand')}
                                  className={cn(
                                    "w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all appearance-none",
                                    errors.brand && "border-red-200 bg-white"
                                  )}
                                >
                                  <option value="">اختر البراند...</option>
                                  {dbBrands.map(b => (
                                    <option key={b.id} value={b.name}>{b.name}</option>
                                  ))}
                                </select>
                                {errors.brand && <p className="text-sm text-red-500 font-bold mt-1.5 mr-2">{errors.brand.message}</p>}
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <label className="block text-sm font-black text-gray-500 uppercase tracking-widest px-1">القسم الرئيسي</label>
                                  <button
                                    type="button"
                                    onClick={() => navigate('/inventory/products?tab=settings')}
                                    className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-900"
                                  >إدارة الأقسام</button>
                                </div>
                                <select 
                                  {...register('category')}
                                  className={cn(
                                    "w-full bg-gray-50 border border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all appearance-none",
                                    errors.category && "border-red-200 bg-white"
                                  )}
                                >
                                  <option value="">اختر القسم...</option>
                                  {dbCategories.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                  ))}
                                </select>
                                {errors.category && <p className="text-sm text-red-500 font-bold mt-1.5 mr-2">{errors.category.message}</p>}
                              </div>
                          </div>

                          <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="block text-sm font-black text-gray-500 uppercase tracking-widest px-1">الفئة المستهدفة</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['MEN', 'WOMEN', 'KIDS', 'UNISEX'].map(g => (
                                      <button
                                        key={g}
                                        type="button"
                                        onClick={() => setValue('gender', g as any)}
                                        className={cn(
                                          "px-4 py-3 rounded-xl text-sm font-black transition-all border",
                                          watch('gender') === g 
                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                            : "bg-white border-gray-100 text-gray-400 hover:bg-gray-50"
                                        )}
                                      >
                                        {g === 'MEN' ? 'رجالي' : g === 'WOMEN' ? 'حريمي' : g === 'KIDS' ? 'أطفال' : 'للجنسين'}
                                      </button>
                                    ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="block text-sm font-black text-gray-600 uppercase tracking-widest px-1 text-indigo-600">نوع المنتج</label>
                                <select 
                                  {...register('shoeType')}
                                  className="w-full bg-indigo-50 border border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all appearance-none"
                                >
                                  <option value="">اختر النوع...</option>
                                  {dbProductTypes.map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                  ))}
                                </select>
                              </div>
                          </div>
                      </div>
                  </section>

                  {/* وحدات القياس */}
                  <section id="units" className="space-y-8">
                      <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                        <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                          <Box className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-900 leading-none">وحدات القياس</h2>
                          <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-wider">Units & conversion rates</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => setValue('unitType', 'SINGLE')}
                            className={cn(
                              "relative p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center text-center gap-3",
                              unitType === 'SINGLE' 
                                ? "bg-gray-900 border-gray-900 text-white shadow-2xl shadow-gray-200" 
                                : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                            )}
                          >
                             <Box className="w-6 h-6" />
                             <h3 className="text-sm font-black mb-1">وحدة قياس واحدة</h3>
                          </button>

                          <button
                            type="button"
                            onClick={() => setValue('unitType', 'MULTIPLE')}
                            className={cn(
                              "relative p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center text-center gap-3",
                              unitType === 'MULTIPLE' 
                                ? "bg-gray-900 border-gray-900 text-white shadow-2xl shadow-gray-200" 
                                : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                            )}
                          >
                             <Layers className="w-6 h-6" />
                             <h3 className="text-sm font-black mb-1">وحدات قياس متعددة</h3>
                          </button>
                        </div>

                        <div className="bg-gray-50/50 p-8 rounded-[2rem] border border-gray-100 space-y-4">
                          <label className="text-sm font-black text-gray-500 uppercase tracking-widest px-1">الوحدة الأساسية</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {unitOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setValue('mainUnit', option.value)}
                                className={cn(
                                  "px-4 py-3 rounded-2xl text-sm font-bold border transition-all",
                                  mainUnit === option.value
                                    ? "bg-white border-blue-600 text-blue-600 shadow-lg ring-4 ring-blue-50"
                                    : "bg-white border-gray-100 text-gray-400 hover:border-gray-300"
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {unitType === 'MULTIPLE' && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">الوحدات الفرعية</h4>
                                <button type="button" onClick={() => append({ unit: '', conversionRate: 1 })} className="text-sm font-black text-blue-600">+ إضافة</button>
                            </div>
                            {fields.map((field, index) => (
                              <div key={field.id} className="grid grid-cols-12 gap-4 items-center bg-white p-6 rounded-3xl border border-gray-100">
                                <div className="col-span-5">
                                  <input {...register(`subUnits.${index}.unit` as const)} placeholder="الوحدة" className="w-full bg-gray-50 rounded-2xl px-5 py-3 text-sm font-bold outline-none" />
                                </div>
                                <div className="col-span-1 pt-0 text-center font-black">=</div>
                                <div className="col-span-5">
                                  <input {...register(`subUnits.${index}.conversionRate` as const, { valueAsNumber: true })} type="number" className="w-full bg-gray-50 rounded-2xl px-5 py-3 text-sm font-black outline-none" />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  <button type="button" onClick={() => remove(index)} className="text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>

                  {/* التسعير المتقدم */}
                  <section id="pricing" className="space-y-8">
                      <div className="flex items-center justify-between border-b border-gray-50 pb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <h2 className="text-xl font-black text-gray-900 leading-none">التسعير المتقدم</h2>
                            <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-wider">Prices, margins & profit analysis</p>
                          </div>
                        </div>
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                          {['EGP', 'USD', 'SAR'].map(curr => (
                            <button
                              key={curr}
                              type="button"
                              onClick={() => setValue('currency', curr)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-sm font-black transition-all",
                                watch('currency') === curr ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                              )}
                            >
                              {curr}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-gray-500 uppercase tracking-widest px-1">سعر الشراء (Purchase Price) *</label>
                              <div className="relative">
                                <input 
                                  {...register('costPrice', { valueAsNumber: true })} 
                                  type="number" 
                                  className="w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm font-black focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all" 
                                />
                                <span className="absolute left-6 top-4 text-sm font-black text-gray-300">{watch('currency')}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-blue-600 uppercase tracking-widest px-1">سعر البيع الافتراضي *</label>
                              <div className="relative">
                                <input 
                                  {...register('sellingPrice', { valueAsNumber: true })} 
                                  type="number" 
                                  className="w-full bg-blue-50 border border-transparent rounded-2xl px-6 py-4 text-sm font-black text-blue-800 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all" 
                                />
                                <span className="absolute left-6 top-4 text-sm font-black text-blue-200">{watch('currency')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-gray-500 uppercase tracking-widest px-1">سعر الجملة (Wholesale)</label>
                              <input {...register('wholesalePrice', { valueAsNumber: true })} type="number" className="w-full bg-gray-50 rounded-2xl px-6 py-4 text-sm font-bold outline-none" />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-gray-500 uppercase tracking-widest px-1">سعر خاص (Special Price)</label>
                              <input {...register('specialPrice', { valueAsNumber: true })} type="number" className="w-full bg-gray-50 rounded-2xl px-6 py-4 text-sm font-bold outline-none" />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-red-500 uppercase tracking-widest px-1">أقل سعر بيع</label>
                              <input {...register('minSellingPrice', { valueAsNumber: true })} type="number" className="w-full bg-red-50/20 rounded-2xl px-6 py-4 text-sm font-bold outline-none" />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-gray-500 uppercase tracking-widest px-1">السعر المرجعي</label>
                              <input {...register('referencePrice', { valueAsNumber: true })} type="number" className="w-full bg-gray-50 rounded-2xl px-6 py-4 text-sm font-bold outline-none" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-gray-200">
                             <div className="space-y-6">
                                <div>
                                  <p className="text-sm font-black uppercase text-blue-400 mb-1">الربح الصافي</p>
                                  <h3 className="text-3xl font-black">
                                    {((watch('sellingPrice') || 0) - (watch('costPrice') || 0)).toLocaleString()} <span className="text-sm">{watch('currency')}</span>
                                  </h3>
                                </div>
                                <div className="h-px bg-white/10" />
                                <div>
                                  <p className="text-sm font-black uppercase text-green-400 mb-2">هامش الربح</p>
                                  <div className="flex items-end gap-2">
                                    <h3 className="text-4xl font-black">
                                      {watch('sellingPrice') > 0 
                                        ? Math.round(((watch('sellingPrice') - watch('costPrice')) / watch('sellingPrice')) * 100) 
                                        : 0}%
                                    </h3>
                                    <span className="text-sm bg-green-500/20 text-green-400 px-2 py-1 rounded-full mb-1 font-black">PROFITABLE</span>
                                  </div>
                                </div>
                             </div>
                          </div>
                        </div>
                      </div>
                    </section>

                  {/* إعدادات المخزون + المقاسات والألوان */}
                  <section id="inventory" className="space-y-6 scroll-mt-28">
                      <div className="flex items-center gap-3 border-b border-gray-50 pb-6">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                          <Weight className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-gray-900">إعدادات المخزون</h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-black text-gray-500 uppercase mb-2">الكمية الافتتاحية</label>
                          <input {...register('initialQuantity', { valueAsNumber: true })} type="number" className="w-full bg-gray-50 rounded-2xl px-6 py-4 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-black text-gray-500 uppercase mb-2">حد المخزون الأدنى</label>
                          <input {...register('minStock', { valueAsNumber: true })} type="number" className="w-full bg-gray-50 rounded-2xl px-6 py-4 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-black text-gray-500 uppercase mb-2">حد المخزون الأعلى</label>
                          <input {...register('maxStock', { valueAsNumber: true })} type="number" className="w-full bg-gray-50 rounded-2xl px-6 py-4 outline-none" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input {...register('trackInventory')} type="checkbox" className="form-checkbox rounded border-gray-300 text-blue-600" />
                          <span className="text-sm font-black text-gray-700">تتبع المخزون</span>
                        </label>
                      </div>

                      {/* المقاسات والألوان - تفصيلة للكمية */}
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between border-t border-gray-50 pt-6">
                          <div>
                            <h3 className="text-base font-black text-gray-800">تفاصيل المقاسات والألوان</h3>
                            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-0.5">توزيع الكمية على المقاسات</p>
                          </div>
                          <button type="button" onClick={addVariant} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold flex items-center gap-1">
                            <Plus className="w-3 h-3" /> إضافة مقاس
                          </button>
                        </div>

                        <div className="bg-gray-50/50 rounded-[2rem] border border-gray-100 overflow-hidden">
                          <table className="w-full text-right text-sm">
                            <thead>
                              <tr className="bg-white/70 border-b border-gray-50">
                                <th className="px-8 py-5">المقاس</th>
                                <th className="px-8 py-5">اللون</th>
                                <th className="px-8 py-5">الكمية</th>
                                <th className="px-8 py-5"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {variants.length === 0 && (
                                <tr><td colSpan={4} className="px-8 py-6 text-center text-gray-400 text-sm">لا توجد مقاسات - اضغط إضافة مقاس</td></tr>
                              )}
                              {variants.map((v, idx) => (
                                <tr key={idx} className="hover:bg-white group transition-all border-b border-gray-50">
                                  <td className="px-8 py-4">
                                    <input type="number" value={v.size} onChange={e => { const n = [...variants]; n[idx].size = Number(e.target.value); setVariants(n); }} className="w-16 bg-transparent outline-none font-bold" />
                                  </td>
                                  <td className="px-8 py-4">
                                    <input type="text" value={v.color} onChange={e => { const n = [...variants]; n[idx].color = e.target.value; setVariants(n); }} className="w-24 bg-transparent outline-none font-bold" />
                                  </td>
                                  <td className="px-8 py-4">
                                    <input type="number" value={v.qty} onChange={e => { const n = [...variants]; n[idx].qty = Number(e.target.value); setVariants(n); }} className="w-16 bg-transparent outline-none font-black text-blue-600" />
                                  </td>
                                  <td className="px-8 py-4">
                                    <button type="button" onClick={() => setVariants(variants.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4 text-red-300" /></button>
                                  </td>
                                </tr>
                              ))}
                              {variants.length > 0 && (
                                <tr className="bg-emerald-50">
                                  <td colSpan={2} className="px-8 py-3 text-sm font-black text-emerald-700">إجمالي الكمية</td>
                                  <td className="px-8 py-3 text-base font-black text-emerald-700">{variants.reduce((s, v) => s + v.qty, 0)}</td>
                                  <td></td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                  </section>

                  {/* الضمان والصلاحية */}
                  <section id="warranty" className="space-y-8">
                      <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                        <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-gray-900">الضمان والصلاحية</h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                          <div className="space-y-4">
                              <label className="block text-sm font-black text-gray-500 uppercase">مدة الضمان</label>
                              <div className="flex gap-3">
                                  <input {...register('warrantyDuration', { valueAsNumber: true })} type="number" className="flex-1 bg-gray-50 rounded-2xl px-6 py-4 outline-none" />
                                  <select {...register('warrantyUnit')} className="bg-gray-100 rounded-2xl px-4 py-4 outline-none">
                                    <option value="DAYS">يوم</option>
                                    <option value="MONTHS">شهر</option>
                                    <option value="YEARS">سنة</option>
                                  </select>
                              </div>
                          </div>

                          <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <label className="block text-sm font-black text-gray-500 uppercase">تاريخ الصلاحية</label>
                                <button type="button" onClick={() => setValue('hasExpiration', !watch('hasExpiration'))} className={cn("w-10 h-5 rounded-full relative", watch('hasExpiration') ? "bg-orange-500" : "bg-gray-200")}>
                                  <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", watch('hasExpiration') ? "right-1" : "right-6")}></div>
                                </button>
                              </div>
                              {watch('hasExpiration') && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                  <input {...register('expirationDays', { valueAsNumber: true })} type="number" placeholder="مدة الصلاحية" className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none" />
                                  <input {...register('expirationAlertDays', { valueAsNumber: true })} type="number" placeholder="تنبيه قبل" className="w-full bg-gray-50 rounded-2xl px-4 py-3 outline-none" />
                                </div>
                              )}
                          </div>
                      </div>
                  </section>

                  {/* تم نقل المقاسات والألوان تحت إعدادات المخزون أعلاه */}

                  {/* معرض الصور */}
                  <section id="gallery" className="space-y-8">
                      <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                        <h2 className="text-xl font-black text-gray-900">معرض الصور</h2>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
                        {previews.map((src, i) => (
                            <div key={i} className={cn("relative aspect-square rounded-[1.5rem] border-2 overflow-hidden", mainImageIndex === i ? "border-blue-500" : "border-gray-100")}>
                              <img src={src} className="w-full h-full object-cover" alt="" />
                              <button type="button" onClick={() => removeImage(i)} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg shadow-lg"><Trash2 className="w-3 h-3" /></button>
                              <button type="button" onClick={() => setMainImageIndex(i)} className="absolute bottom-2 left-2 text-sm bg-white px-2 py-1 rounded font-black">{mainImageIndex === i ? 'MAIN' : 'SET MAIN'}</button>
                            </div>
                        ))}
                        <label className="aspect-square rounded-[1.5rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
                          <Upload className="w-6 h-6 text-gray-300" />
                          <span className="text-sm font-black text-gray-400 mt-2">رفع صور</span>
                          <input type="file" multiple accept="image/*" onChange={onImageChange} className="hidden" />
                        </label>
                      </div>
                    </section>
                </div>

            <div className="bg-gray-50/50 p-8 border-t border-gray-100 flex justify-end gap-3 px-10">
              <button type="button" onClick={() => navigate(-1)} className="px-8 py-3 text-sm font-bold text-gray-500">إلغاء</button>
              <button type="submit" disabled={isSubmitting} className="bg-gray-900 text-white px-12 py-3 rounded-2xl font-bold text-sm">اعتماد وحفظ الصنف</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  </div>
);
}


