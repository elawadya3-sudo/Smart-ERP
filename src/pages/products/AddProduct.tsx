import React, { useState, useEffect, useRef } from 'react';
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
  Clock,
  Camera,
  Video,
  Building2,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Printer,
  SlidersHorizontal,
  Star,
  Hash,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn, formatCurrency } from '../../lib/utils';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../../lib/firebase';
import { productsService } from '../../services/firestore';
import { Warehouse } from '../../types';
import JsBarcode from 'jsbarcode';
import BarcodePrintModal from '../../components/products/BarcodePrintModal';

const subUnitSchema = z.object({
  unit: z.string().min(1, 'اسم الوحدة مطلوب'),
  conversionRate: z.number().min(1, 'معدل التحويل يجب أن يكون 1 على الأقل'),
  price: z.number().optional(),
});

const productSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1, 'اسم الصنف مطلوب'),
  descriptionEn: z.string().optional(),
  shortDescription: z.string().optional(),
  modelCode: z.string().optional(),
  barcode: z.string().optional(),
  location: z.string().optional(),
  originNumber: z.string().optional(),
  tags: z.array(z.string()),
  weight: z.union([z.number(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  weightUnit: z.enum(['KG', 'GRAM']),
  gender: z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']),
  costPrice: z.number({ message: 'السعر مطلوب' }).min(0, 'سعر التكلفة يجب أن يكون موجباً'),
  sellingPrice: z.number({ message: 'السعر مطلوب' }).min(0, 'سعر البيع يجب أن يكون موجباً'),
  wholesalePrice: z.union([z.number(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  specialPrice: z.union([z.number(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  minSellingPrice: z.union([z.number(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  discountPrice: z.union([z.number(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  tax: z.number().min(0).max(100).optional(),
  currency: z.string(),
  brand: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
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
  warehouseId: z.string().optional(),
  status: z.enum(['available', 'out_of_stock', 'on_demand']).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoSlug: z.string().optional(),
  videoUrl: z.string().optional(),
  productType: z.enum(['simple', 'variant']).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

// ── Section Header component ────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color = 'blue', children }: {
  icon: React.ElementType;
  title: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-500',
    indigo: 'text-indigo-500',
    orange: 'text-orange-500',
    purple: 'text-purple-600',
    emerald: 'text-emerald-500',
    teal: 'text-teal-600',
    red: 'text-red-500',
    amber: 'text-amber-500',
  };
  return (
    <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
      <div className="flex items-center gap-3">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50')}>
          <Icon className={cn('w-4 h-4', colors[color] || colors.blue)} />
        </div>
        <h3 className="font-black text-gray-900 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Label component ─────────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-black text-gray-500 mb-1.5">
      {children}
      {required && <span className="text-red-500 mr-1">*</span>}
    </label>
  );
}

// ── Input classes ───────────────────────────────────────────────────────────
const inputCls = "w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-200 outline-none transition-all";
const inputErrCls = "border-red-200 bg-red-50/30 focus:ring-red-100 focus:border-red-300";

// ── Card wrapper ────────────────────────────────────────────────────────────
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white rounded-2xl border border-gray-100 shadow-sm p-6", className)}>
      {children}
    </div>
  );
}

export default function AddProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tags, setTags] = useState<string[]>(['أجهزة', 'ملابس', 'طعام', 'خدمة', 'أثاث']);
  const [newTag, setNewTag] = useState('');

  // Media states
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Barcode print modal state
  const [barcodePrintOpen, setBarcodePrintOpen] = useState(false);
  const [printProducts, setPrintProducts] = useState<any[]>([]);

  // Camera live capture states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cartesian Option-Variant states
  const [options, setOptions] = useState<{ name: string; values: string[] }[]>([
    { name: 'المقاس', values: [] },
    { name: 'اللون', values: [] }
  ]);
  const [optionInputs, setOptionInputs] = useState<Record<number, string>>({});
  const [variants, setVariants] = useState<any[]>([]);
  const [customOptionName, setCustomOptionName] = useState('');

  // Dropdowns Database lists
  const [dbBrands, setDbBrands] = useState<{ id: string; name: string }[]>([]);
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string }[]>([]);
  const [dbProductTypes, setDbProductTypes] = useState<{ id: string; name: string }[]>([]);
  const [dbWarehouses, setDbWarehouses] = useState<Warehouse[]>([]);
  const [dbUnits, setDbUnits] = useState<{ id: string; name: string; abbreviation: string }[]>([]);

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
      discountPrice: 0,
      tax: 15,
      currency: 'EGP',
      unitType: 'SINGLE',
      mainUnit: 'قطعة',
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
      status: 'available',
      warehouseId: '',
      productType: 'simple'
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "subUnits" });

  const unitType = watch('unitType');
  const mainUnit = watch('mainUnit');
  const productName = watch('name');
  const barcodeValue = watch('barcode');
  const productType = watch('productType') || 'simple';

  // Auto-generate Slug from product name
  useEffect(() => {
    if (productName && !watch('seoSlug')) {
      const slug = productName
        .toLowerCase().trim()
        .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setValue('seoSlug', slug);
      setValue('seoTitle', productName);
    }
  }, [productName, setValue, watch]);

  // Sync initialQuantity for variant products
  useEffect(() => {
    if (productType === 'variant') {
      const totalVariantsQty = variants.reduce((sum, v) => sum + (Number(v.quantity || v.qty) || 0), 0);
      setValue('initialQuantity', totalVariantsQty);
    }
  }, [variants, productType, setValue]);

  // Sync barcode preview
  useEffect(() => {
    if (barcodeValue) {
      const timer = setTimeout(() => {
        try {
          JsBarcode('#single-product-barcode', barcodeValue, {
            format: "CODE128", width: 1.5, height: 50,
            displayValue: true, fontSize: 12, margin: 2
          });
        } catch (err) { console.warn("JsBarcode error:", err); }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [barcodeValue]);

  const unitOptions = dbUnits.length > 0
    ? dbUnits.map(u => ({ label: u.name, value: u.name }))
    : [
      { label: 'قطعة', value: 'قطعة' },
      { label: 'زوج', value: 'زوج' },
      { label: 'علبة', value: 'علبة' },
      { label: 'دسته', value: 'دسته' },
      { label: 'كرتونة', value: 'كرتونة' },
      { label: 'كجم', value: 'كجم' },
      { label: 'متر', value: 'متر' },
    ];

  // Fetch db lists on mount
  useEffect(() => {
    if (id) {
      const loadProduct = async () => {
        try {
          const docRef = doc(db, 'products', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            let mainUnitVal = data.mainUnit;
            if (mainUnitVal === 'Piece') mainUnitVal = 'قطعة';
            else if (mainUnitVal === 'Pair') mainUnitVal = 'زوج';
            else if (mainUnitVal === 'Box') mainUnitVal = 'علبة';
            else if (mainUnitVal === 'Dozen') mainUnitVal = 'دسته';
            else if (mainUnitVal === 'Carton') mainUnitVal = 'كرتونة';
            else if (mainUnitVal === 'KG') mainUnitVal = 'كجم';
            else if (mainUnitVal === 'Meter') mainUnitVal = 'متر';
            const pType = data.productType || (data.variants && data.variants.length > 0 ? 'variant' : 'simple');
            reset({ ...data, mainUnit: mainUnitVal, productType: pType } as any);
            if (data.tags) setTags(data.tags);
            if (data.variants) setVariants(data.variants);
            if (data.options) setOptions(data.options);
            if (data.images && data.images.length > 0) setPreviews(data.images);
          }
        } catch (error) { console.error("Error loading product:", error); }
      };
      loadProduct();
    }

    const loadPickers = async () => {
      try {
        const [brandsSnap, categoriesSnap, productTypeSnap, warehouseSnap, unitsSnap] = await Promise.all([
          getDocs(collection(db, 'brands')),
          getDocs(collection(db, 'categories')),
          getDocs(collection(db, 'shoe_types')),
          getDocs(collection(db, 'warehouses')),
          getDocs(collection(db, 'product_units')),
        ]);
        setDbBrands(brandsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        setDbCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        setDbProductTypes(productTypeSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        setDbWarehouses(warehouseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Warehouse)));
        setDbUnits(unitsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, abbreviation: doc.data().abbreviation })));
      } catch (e) { console.error("Error loading db assets:", e); }
    };
    loadPickers();

    // Auto-generate barcode for NEW products only (not edit mode)
    if (!id) {
      const randomDigits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
      const sum = randomDigits.split('').map(Number).reverse()
        .reduce((acc, num, index) => acc + num * (index % 2 === 0 ? 3 : 1), 0);
      const remainder = sum % 10;
      const checkDigit = remainder === 0 ? '0' : String(10 - remainder);
      setValue('barcode', `${randomDigits}${checkDigit}`);
    }
  }, [id, reset]);

  // Barcode utilities
  const calculateEAN13CheckDigit = (digits: string) => {
    const sum = digits.split('').map(Number).reverse()
      .reduce((acc, num, index) => acc + num * (index % 2 === 0 ? 3 : 1), 0);
    const remainder = sum % 10;
    return remainder === 0 ? '0' : String(10 - remainder);
  };

  const generateEAN13Barcode = () => {
    const randomDigits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
    const checkDigit = calculateEAN13CheckDigit(randomDigits);
    return `${randomDigits}${checkDigit}`;
  };

  const generateRandomBarcode = () => {
    setValue('barcode', generateEAN13Barcode());
  };

  const handlePrintVariantBarcode = (variant: any) => {
    const printWindow = window.open('', '_blank', 'width=450,height=300');
    if (!printWindow) {
      alert('الرجاء تفعيل النوافذ المنبثقة لطباعة الباركود.');
      return;
    }

    const tempDiv = document.createElement('div');
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgElement.id = 'temp-barcode-print';
    tempDiv.appendChild(svgElement);
    document.body.appendChild(tempDiv);

    try {
      JsBarcode(svgElement, variant.barcode, {
        format: 'CODE128',
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 10,
        margin: 2
      });

      const svgCode = svgElement.outerHTML;
      const productName = watch('name') || 'منتج';
      const variantName = variant.optionCombinationString || '';
      const price = variant.price || watch('sellingPrice') || 0;

      printWindow.document.write(`
        <html>
          <head>
            <title>طباعة باركود المتغير</title>
            <style>
              body {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
                direction: rtl;
              }
              .barcode-container {
                border: 1px dashed #ccc;
                padding: 10px;
                border-radius: 8px;
                max-width: 250px;
              }
              .product-title {
                font-family: system-ui, sans-serif;
                margin: 0 0 2px 0;
                font-size: 11px;
                font-weight: 900;
              }
              .variant-title {
                font-family: system-ui, sans-serif;
                margin: 0 0 6px 0;
                font-size: 10px;
                color: #555;
                font-weight: 700;
              }
              .price-tag {
                font-family: system-ui, sans-serif;
                font-size: 12px;
                font-weight: bold;
                margin-top: 6px;
              }
            </style>
          </head>
          <body>
            <div class="barcode-container">
              <div class="product-title">${productName}</div>
              <div class="variant-title">${variantName}</div>
              ${svgCode}
              <div class="price-tag">السعر: ${formatCurrency(price)}</div>
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 100);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (e) {
      console.error(e);
      alert('خطأ في توليد الباركود للطباعة');
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  // Cartesian Variants Generator
  const handleGenerateVariants = () => {
    // Merge any remaining typed text from optionInputs
    let currentOptions = [...options];
    let updatedAny = false;
    
    Object.entries(optionInputs).forEach(([idxStr, textVal]) => {
      const idx = Number(idxStr);
      const val = textVal.trim();
      if (val && currentOptions[idx]) {
        // Support comma separated values or single values
        const parsedVals = val.split(/[,،]+/).map(v => v.trim()).filter(Boolean);
        parsedVals.forEach(v => {
          if (!currentOptions[idx].values.includes(v)) {
            currentOptions[idx] = {
              ...currentOptions[idx],
              values: [...currentOptions[idx].values, v]
            };
            updatedAny = true;
          }
        });
      }
    });

    if (updatedAny) {
      setOptions(currentOptions);
      setOptionInputs({}); // clear inputs
    }

    const finalOptions = updatedAny ? currentOptions : options;

    const arrays = finalOptions.filter(o => o.values.length > 0).map(o => o.values);
    if (arrays.length === 0) { alert("الرجاء إضافة قيم خيارات أولاً."); return; }
    const cartesian = (arrs: string[][]): string[][] =>
      arrs.reduce<string[][]>((a, b) => a.flatMap(d => b.map(e => [d, e].flat())), [[]]);
    const combinations = cartesian(arrays);
    const activeOpts = finalOptions.filter(o => o.values.length > 0);
    const generated = combinations.map(combo => {
      const optionValues = activeOpts.map((opt, i) => ({ name: opt.name, value: combo[i] }));
      const name = optionValues.map(o => o.value).join(' / ');
      const sizeOpt = optionValues.find(o => o.name === 'المقاس' || o.name === 'Size');
      const colorOpt = optionValues.find(o => o.name === 'اللون' || o.name === 'Color');
      return {
        sku: `${watch('sku') || 'PROD'}-${combo.join('-')}`,
        quantity: 0,
        price: watch('sellingPrice') || 0,
        size: sizeOpt ? (isNaN(Number(sizeOpt.value)) ? sizeOpt.value : Number(sizeOpt.value)) : '',
        color: colorOpt ? colorOpt.value : '',
        barcode: generateEAN13Barcode(),
        attributes: optionValues.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.value }), {}),
        optionCombinationString: name
      };
    });
    setVariants(generated);
  };

  const handleAutoGenerateVariantBarcodes = () => {
    const list = variants.map(v => ({
      ...v,
      barcode: v.barcode || generateEAN13Barcode()
    }));
    setVariants(list);
  };


  // Submit operations
  const onSubmit = async (data: ProductFormData, isDraftSubmit = false) => {
    try {
      const uploadedImageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const storageRef = ref(storage, `products/${data.sku || 'product'}/${Date.now()}-${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        uploadedImageUrls.push(url);
      }
      if (mainImageIndex > 0 && uploadedImageUrls.length > 1) {
        const [mainUrl] = uploadedImageUrls.splice(mainImageIndex, 1);
        uploadedImageUrls.unshift(mainUrl);
      }
      const finalImages = uploadedImageUrls.length > 0 ? uploadedImageUrls : previews.filter(p => p.startsWith('http'));
      
      const processedVariants = productType === 'variant'
        ? variants.map(v => ({
            ...v,
            price: Number(v.price) > 0 ? Number(v.price) : Number(data.sellingPrice || 0)
          }))
        : [];
      const variantQuantity = processedVariants.reduce((sum, v) => sum + (Number(v.quantity || v.qty) || 0), 0);
      const baseQuantity = Number(data.initialQuantity || 0);

      const productData = {
        ...data,
        images: finalImages,
        variants: processedVariants,
        options: productType === 'variant' ? options : [],
        isDraft: isDraftSubmit,
        quantity: productType === 'variant' ? variantQuantity : baseQuantity,
        updatedAt: new Date().toISOString(),
      };
      if (id) {
        await productsService.update(id, productData);
      } else {
        await productsService.add({ ...productData, createdAt: new Date().toISOString() } as any);
      }
      navigate('/inventory/products');
    } catch (error) {
      console.error('Submission error:', error);
      handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  // File handling helpers
  const onImageChange = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let files: File[] = [];
    if ('files' in e.target && e.target.files) files = Array.from(e.target.files);
    else if ('dataTransfer' in e && e.dataTransfer.files) files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const newFiles = files.filter(file => file.type.startsWith('image/'));
      setImages(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
    if (mainImageIndex === index) setMainImageIndex(0);
    else if (mainImageIndex > index) setMainImageIndex(prev => prev - 1);
  };

  // Camera Live webRTC
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
    } catch (e) { alert("تعذر تشغيل الكاميرا."); }
  };

  const stopCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    setCameraStream(null);
    setShowCamera(false);
  };

  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        fetch(dataUrl).then(res => res.blob()).then(blob => {
          const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setImages(prev => [...prev, file]);
          setPreviews(prev => [...prev, dataUrl]);
          stopCamera();
        });
      }
    }
  };

  const currentTags = watch('tags') || [];
  const toggleTag = (tag: string) => {
    const nextTags = currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag];
    setValue('tags', nextTags);
  };

  const handleAddNewTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (!tags.includes(newTag.trim())) setTags([...tags, newTag.trim()]);
      if (!currentTags.includes(newTag.trim())) toggleTag(newTag.trim());
      setNewTag('');
    }
  };

  // Profit calculations
  const costVal = watch('costPrice') || 0;
  const sellVal = watch('sellingPrice') || 0;
  const discountVal = watch('discountPrice') || 0;
  const activeSellPrice = discountVal > 0 && discountVal < sellVal ? discountVal : sellVal;
  const netProfit = activeSellPrice - costVal;
  const profitMargin = activeSellPrice > 0 ? Math.round((netProfit / activeSellPrice) * 100) : 0;
  const markupPercent = costVal > 0 ? Math.round((netProfit / costVal) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50/60 pb-10 rtl text-right" dir="rtl">

      {/* ─── Sticky Top Header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 px-6 py-3.5 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/inventory/products')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-800"
          >
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold mb-0.5">
              <span>إدارة الأصناف</span>
              <ChevronLeft className="w-3 h-3" />
              <span className="text-blue-600">{id ? 'تعديل صنف' : 'إضافة صنف جديد'}</span>
            </div>
            <h1 className="text-base font-black text-gray-900 leading-none">
              {id ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/inventory/products')}
            className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit(val => onSubmit(val, true))}
            disabled={isSubmitting}
            className="bg-gray-100 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-gray-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            حفظ مسودة
          </button>
          <button
            type="button"
            onClick={handleSubmit(val => onSubmit(val, false))}
            disabled={isSubmitting}
            className="bg-blue-600 text-white font-black px-5 py-2 rounded-xl text-xs shadow-sm shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSubmitting ? 'جاري الحفظ...' : 'اعتماد وحفظ'}
          </button>
        </div>
      </div>

      {/* ─── Main 2-Column Layout ───────────────────────────────────────── */}
      <form id="product-form" onSubmit={handleSubmit(val => onSubmit(val, false))}>
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-5 items-start">

          {/* ══════════════════════════════════════════════════════════════
              RIGHT / MAIN COLUMN
          ══════════════════════════════════════════════════════════════ */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* ── نوع المنتج: بسيط أم متعدد الخيارات ── */}
            <Card>
              <SectionHeader icon={SlidersHorizontal} title="نوع الصنف (Product Type)" color="purple" />
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setValue('productType', 'simple')}
                  className={cn(
                    "p-5 rounded-2xl border-2 text-right transition-all flex items-center gap-4",
                    productType === 'simple'
                      ? "bg-blue-50/50 border-blue-600 text-blue-600 shadow-md shadow-blue-50"
                      : "bg-white border-gray-100 text-gray-500 hover:border-gray-300"
                  )}
                >
                  <Package className="w-8 h-8 flex-shrink-0" />
                  <div>
                    <h4 className="font-black text-sm">صنف عادي (Simple Product)</h4>
                    <p className="text-[11px] opacity-70 mt-1">منتج منفرد لا يحتوي على خيارات إضافية كالمقاس واللون</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setValue('productType', 'variant')}
                  className={cn(
                    "p-5 rounded-2xl border-2 text-right transition-all flex items-center gap-4",
                    productType === 'variant'
                      ? "bg-purple-50/50 border-purple-600 text-purple-600 shadow-md shadow-purple-50"
                      : "bg-white border-gray-100 text-gray-500 hover:border-gray-300"
                  )}
                >
                  <Layers className="w-8 h-8 flex-shrink-0" />
                  <div>
                    <h4 className="font-black text-sm">صنف بمتغيرات (Variant Product)</h4>
                    <p className="text-[11px] opacity-70 mt-1">منتج متعدد المقاسات أو الألوان مع إدارة مخزون وسعر منفصل لكل خيار</p>
                  </div>
                </button>
              </div>
            </Card>

            {/* ── 1. تفاصيل الصنف الرئيسية ─────────────────────────────── */}
            <Card>
              <SectionHeader icon={Package} title="تفاصيل الصنف الرئيسية" color="blue" />
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <FieldLabel required>اسم الصنف أو الخدمة</FieldLabel>
                  <input
                    {...register('name')}
                    type="text"
                    placeholder="مثال: حذاء رياضي جري..."
                    className={cn(inputCls, errors.name && inputErrCls)}
                  />
                  {errors.name && <p className="text-xs text-red-500 font-bold mt-1">{errors.name.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>كود الصنف الداخلي (SKU)</FieldLabel>
                    <input {...register('sku')} type="text"
                      className={cn(inputCls, "font-mono text-blue-600 font-bold")} />
                  </div>
                  <div>
                    <FieldLabel>رقم الموديل / المصنعي</FieldLabel>
                    <input {...register('modelCode')} type="text" placeholder="الموديل..."
                      className={inputCls} />
                  </div>
                </div>

                {/* ── الباركود ─────────────────────────────────────────── */}
                <div>
                  <FieldLabel>رمز الباركود (EAN-13)</FieldLabel>
                  <div className="flex gap-2 items-stretch">
                    {/* Input */}
                    <div className="relative flex-1">
                      <Barcode className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                      <input
                        {...register('barcode')}
                        type="text"
                        placeholder="رمز الباركود..."
                        className={cn(inputCls, "pr-10 font-mono tracking-widest text-gray-700 font-bold")}
                      />
                    </div>

                    {/* Re-generate button */}
                    <button
                      type="button"
                      onClick={generateRandomBarcode}
                      title="توليد باركود جديد"
                      className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border border-gray-100 hover:border-blue-200 rounded-xl text-xs font-black text-gray-500 transition-all whitespace-nowrap flex-shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      توليد آلي
                    </button>

                    {/* Quick print link — opens BarcodePrintModal */}
                    {barcodeValue && (
                      <button
                        type="button"
                        title="طباعة ملصق الباركود"
                        onClick={() => {
                          setPrintProducts([{
                            id: id || `temp-${Date.now()}`,
                            name: productName || 'صنف جديد',
                            barcode: barcodeValue || '',
                            sellingPrice: sellVal || 0,
                            costPrice: watch('costPrice') || 0,
                            quantity: watch('initialQuantity') || 0,
                            brand: watch('brand') || '',
                            category: watch('category') || '',
                            sku: watch('sku') || '',
                            sizes: [],
                            colors: [],
                            images: previews.filter(p => p.startsWith('http')),
                            createdAt: new Date().toISOString(),
                          }]);
                          setBarcodePrintOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl text-xs font-black text-indigo-600 transition-all flex-shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        طباعة
                      </button>
                    )}
                  </div>

                  {/* Inline barcode mini-preview */}
                  {barcodeValue && (
                    <div className="mt-2 flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2">
                      <svg
                        id="barcode-inline-preview"
                        ref={el => {
                          if (el && barcodeValue) {
                            setTimeout(() => {
                              try {
                                JsBarcode('#barcode-inline-preview', barcodeValue, {
                                  format: 'CODE128', width: 1.2, height: 30,
                                  displayValue: false, margin: 0
                                });
                              } catch {}
                            }, 50);
                          }
                        }}
                        className="h-8"
                      />
                      <span className="text-xs font-mono font-bold text-gray-500 tracking-widest flex-1 text-center">
                        {barcodeValue}
                      </span>
                      <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">EAN-13</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>نبذة مختصرة</FieldLabel>
                    <input {...register('shortDescription')} type="text"
                      placeholder="نبذة تظهر في فواتير ونقاط البيع..."
                      className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel>المجموعة المستهدفة (الجنس)</FieldLabel>
                    <select {...register('gender')}
                      className={cn(inputCls, "appearance-none cursor-pointer")}>
                      <option value="UNISEX">للجنسين (Unisex)</option>
                      <option value="MEN">رجالي (Men)</option>
                      <option value="WOMEN">حريمي (Women)</option>
                      <option value="KIDS">أطفال (Kids)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel>الوصف التفصيلي</FieldLabel>
                  <textarea {...register('descriptionEn')} rows={3}
                    placeholder="مواصفات الصنف، ميزاته الفنية..."
                    className={cn(inputCls, "resize-none")} />
                </div>

                {/* Tags */}
                <div>
                  <FieldLabel>الوسوم والكلمات الدلالية</FieldLabel>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tags.map(tag => (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                          currentTags.includes(tag)
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                        )}>
                        {tag}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 max-w-sm">
                    <input value={newTag} onChange={e => setNewTag(e.target.value)}
                      onKeyDown={handleAddNewTag}
                      placeholder="أضف وسم واضغط Enter..."
                      className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-medium outline-none" />
                    <button type="button" onClick={() => {
                      if (newTag.trim()) {
                        if (!tags.includes(newTag.trim())) setTags([...tags, newTag.trim()]);
                        if (!currentTags.includes(newTag.trim())) toggleTag(newTag.trim());
                        setNewTag('');
                      }
                    }}
                      className="bg-blue-600 text-white rounded-xl px-4 py-2 text-xs font-black hover:bg-blue-700">
                      إضافة
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── 2. التصنيف والماركة ───────────────────────────────────── */}
            <Card>
              <SectionHeader icon={Tag} title="التصنيف والماركة" color="indigo" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <FieldLabel>البراند أو العلامة التجارية</FieldLabel>
                  <select {...register('brand')}
                    className={cn(inputCls, "appearance-none cursor-pointer")}>
                    <option value="">اختر البراند...</option>
                    {dbBrands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>التصنيف الرئيسي</FieldLabel>
                  <select {...register('category')}
                    className={cn(inputCls, "appearance-none cursor-pointer")}>
                    <option value="">اختر التصنيف...</option>
                    {dbCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>التصنيف الفرعي</FieldLabel>
                  <input {...register('subcategory')} type="text" placeholder="تصنيف فرعي..."
                    className={inputCls} />
                </div>
              </div>
            </Card>

            {/* ── 3. الأسعار والضرائب ──────────────────────────────────── */}
            <Card>
              <SectionHeader icon={DollarSign} title="الأسعار والضرائب" color="emerald">
                <span className="bg-blue-50 text-blue-600 font-black px-3 py-1 rounded-lg text-xs">EGP</span>
              </SectionHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required>سعر التكلفة</FieldLabel>
                    <input {...register('costPrice', { valueAsNumber: true })} type="number" step="0.01"
                      className={cn(inputCls, "font-bold")} />
                    {errors.costPrice && <p className="text-xs text-red-500 font-bold mt-1">{errors.costPrice.message}</p>}
                  </div>
                  <div>
                    <FieldLabel required>سعر البيع</FieldLabel>
                    <input {...register('sellingPrice', { valueAsNumber: true })} type="number" step="0.01"
                      className={cn(inputCls, "font-black text-blue-700 bg-blue-50/60")} />
                    {errors.sellingPrice && <p className="text-xs text-red-500 font-bold mt-1">{errors.sellingPrice.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <FieldLabel>أقل سعر بيع مسموح</FieldLabel>
                    <input {...register('minSellingPrice', { valueAsNumber: true })} type="number"
                      className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel>سعر الخصم / العرض</FieldLabel>
                    <input {...register('discountPrice', { valueAsNumber: true })} type="number"
                      className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel>نسبة الضريبة (%)</FieldLabel>
                    <input {...register('tax', { valueAsNumber: true })} type="number"
                      className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-gray-50">
                  <div>
                    <FieldLabel>سعر الجملة</FieldLabel>
                    <input {...register('wholesalePrice', { valueAsNumber: true })} type="number"
                      className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel>سعر خاص</FieldLabel>
                    <input {...register('specialPrice', { valueAsNumber: true })} type="number"
                      className={inputCls} />
                  </div>
                </div>

                {/* Inline profit summary */}
                {(costVal > 0 || sellVal > 0) && (
                  <div className="grid grid-cols-3 gap-3 bg-gray-900 rounded-xl p-4 mt-2">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-gray-400 mb-1">الربح الصافي</p>
                      <p className={cn("text-lg font-black", netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {netProfit.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center border-r border-l border-gray-700">
                      <p className="text-[10px] font-black text-gray-400 mb-1">هامش الربح</p>
                      <p className={cn("text-lg font-black", profitMargin >= 30 ? "text-emerald-400" : profitMargin > 0 ? "text-yellow-400" : "text-red-400")}>
                        {profitMargin}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-gray-400 mb-1">نسبة الزيادة</p>
                      <p className="text-lg font-black text-white">{markupPercent}%</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* ── 4. المخزون والكميات ───────────────────────────────────── */}
            <Card>
              <SectionHeader icon={Layers} title="المخزون والكميات" color="blue" />
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <FieldLabel>الكمية الافتتاحية</FieldLabel>
                    <input {...register('initialQuantity', { valueAsNumber: true })} type="number"
                      disabled={productType === 'variant'}
                      className={cn(
                        inputCls,
                        "font-black text-center",
                        productType === 'variant' && "bg-gray-100 text-gray-400 cursor-not-allowed border-dashed"
                      )} />
                    {productType === 'variant' && (
                      <p className="text-[10px] text-purple-600 font-bold mt-1">تُحسب تلقائياً من مجموع كميات المتغيرات</p>
                    )}
                  </div>
                  <div>
                    <FieldLabel>حد التنبيه (إعادة الطلب)</FieldLabel>
                    <input {...register('reorderPoint', { valueAsNumber: true })} type="number"
                      className={cn(inputCls, "text-center")} />
                  </div>
                  <div>
                    <FieldLabel>الحد الأدنى للمخزون</FieldLabel>
                    <input {...register('minStock', { valueAsNumber: true })} type="number"
                      className={cn(inputCls, "text-center")} />
                  </div>
                  <div>
                    <FieldLabel>الحد الأقصى للمخزون</FieldLabel>
                    <input {...register('maxStock', { valueAsNumber: true })} type="number"
                      className={cn(inputCls, "text-center")} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>المستودع الرئيسي الافتراضي</FieldLabel>
                    <select {...register('warehouseId')}
                      className={cn(inputCls, "appearance-none cursor-pointer")}>
                      <option value="">لا يوجد مستودع محدد...</option>
                      {dbWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>حالة توفر الصنف</FieldLabel>
                    <select {...register('status')}
                      className={cn(inputCls, "appearance-none cursor-pointer")}>
                      <option value="available">متوفر (Available)</option>
                      <option value="out_of_stock">غير متوفر (Out of Stock)</option>
                      <option value="on_demand">حسب الطلب (On Demand)</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input {...register('trackInventory')} type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                  <span className="text-sm font-bold text-gray-700">تتبع آلي لحركات وصرف المخزون</span>
                </label>
              </div>
            </Card>

            {/* ── 5. وحدات القياس والبيع ───────────────────────────────── */}
            <Card>
              <SectionHeader icon={Box} title="وحدات القياس والبيع" color="orange" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setValue('unitType', 'SINGLE')}
                    className={cn(
                      "p-4 rounded-xl border text-right transition-all flex items-center gap-3",
                      unitType === 'SINGLE' ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    )}>
                    <Box className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <h4 className="font-black text-sm">وحدة منفردة</h4>
                      <p className="text-xs opacity-70 mt-0.5">بيع وتخزين بوحدة رئيسية فقط</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => setValue('unitType', 'MULTIPLE')}
                    className={cn(
                      "p-4 rounded-xl border text-right transition-all flex items-center gap-3",
                      unitType === 'MULTIPLE' ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    )}>
                    <Layers className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <h4 className="font-black text-sm">وحدات متعددة</h4>
                      <p className="text-xs opacity-70 mt-0.5">تحويل من كرتونة لقطع آلياً</p>
                    </div>
                  </button>
                </div>

                <div>
                  <FieldLabel>الوحدة الأساسية</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {unitOptions.map(option => (
                      <button key={option.value} type="button" onClick={() => setValue('mainUnit', option.value)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-xs font-bold border transition-all",
                          mainUnit === option.value
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                            : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                        )}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {unitType === 'MULTIPLE' && (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wider">وحدات فرعية</span>
                      <button type="button" onClick={() => append({ unit: '', conversionRate: 2 })}
                        className="text-xs font-black text-blue-600 hover:underline flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> إضافة وحدة
                      </button>
                    </div>
                    {fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="col-span-5">
                          <select {...register(`subUnits.${index}.unit` as const)}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none">
                            <option value="">الوحدة...</option>
                            {unitOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2 text-center text-xs font-black text-gray-400">تساوي</div>
                        <div className="col-span-4 flex items-center gap-1.5">
                          <input {...register(`subUnits.${index}.conversionRate` as const, { valueAsNumber: true })}
                            type="number"
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-black outline-none text-center" />
                          <span className="text-xs font-bold text-gray-400 whitespace-nowrap">{mainUnit}</span>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button type="button" onClick={() => remove(index)} className="text-red-300 hover:text-red-500 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* ── 6. خيارات ومتغيرات الصنف ─────────────────────────────── */}
            {productType === 'variant' && (
              <Card>
                <SectionHeader icon={Layers} title="خيارات ومتغيرات الصنف (Variants)" color="purple" />
                <div className="space-y-4">
                  {options.map((opt, optIdx) => (
                    <div key={optIdx} className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-gray-700">{opt.name}</span>
                        <button type="button" onClick={() => setOptions(options.filter((_, i) => i !== optIdx))}
                          className="text-red-400 hover:text-red-600 text-xs font-bold">
                          حذف
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {opt.values.map((v, vIdx) => (
                          <span key={vIdx} className="bg-white border border-gray-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5">
                            {v}
                            <button type="button" onClick={() => {
                              const updated = options.map((o, idx) => 
                                idx === optIdx 
                                  ? { ...o, values: o.values.filter((_, i) => i !== vIdx) }
                                  : o
                              );
                              setOptions(updated);
                            }} className="text-gray-400 hover:text-red-500">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input type="text" placeholder="أدخل قيم (مثال: S, M, L) واضغط Enter..."
                          value={optionInputs[optIdx] || ''}
                          onChange={(e) => setOptionInputs(prev => ({ ...prev, [optIdx]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (optionInputs[optIdx] || '').trim();
                              if (val) {
                                const parsedVals = val.split(/[,،]+/).map(v => v.trim()).filter(Boolean);
                                let currentVals = [...opt.values];
                                parsedVals.forEach(v => {
                                  if (!currentVals.includes(v)) {
                                    currentVals.push(v);
                                  }
                                });
                                setOptions(options.map((o, idx) => 
                                  idx === optIdx ? { ...o, values: currentVals } : o
                                ));
                                setOptionInputs(prev => ({ ...prev, [optIdx]: '' }));
                              }
                            }
                          }}
                          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none flex-1" />
                        <button type="button"
                          onClick={() => {
                            const val = (optionInputs[optIdx] || '').trim();
                            if (val) {
                              const parsedVals = val.split(/[,،]+/).map(v => v.trim()).filter(Boolean);
                              let currentVals = [...opt.values];
                              parsedVals.forEach(v => {
                                  if (!currentVals.includes(v)) {
                                    currentVals.push(v);
                                  }
                              });
                              setOptions(options.map((o, idx) => 
                                idx === optIdx ? { ...o, values: currentVals } : o
                              ));
                              setOptionInputs(prev => ({ ...prev, [optIdx]: '' }));
                            }
                          }}
                          className="bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-xl px-4 py-2 text-xs font-black transition-all">
                          إضافة
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 items-center">
                    <input type="text" placeholder="اسم خيار جديد (مقاس، لون، سعة)..."
                      value={customOptionName} onChange={e => setCustomOptionName(e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                    <button type="button"
                      onClick={() => { if (customOptionName.trim()) { setOptions([...options, { name: customOptionName.trim(), values: [] }]); setCustomOptionName(''); } }}
                      className="bg-purple-600 text-white rounded-xl px-4 py-2.5 text-xs font-black hover:bg-purple-700 transition-all">
                      إضافة
                    </button>
                    <button type="button" onClick={handleGenerateVariants}
                      className="bg-indigo-600 text-white font-black px-4 py-2.5 rounded-xl text-xs hover:bg-indigo-700 transition-all flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> توليد المتغيرات
                    </button>
                    {variants.length > 0 && (
                      <button type="button" onClick={handleAutoGenerateVariantBarcodes}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5" /> توليد باركود تلقائي للمتغيرات
                      </button>
                    )}
                  </div>

                  {variants.length > 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-white border-b border-gray-100">
                            <th className="px-4 py-3 font-black text-gray-500">المتغير</th>
                            <th className="px-4 py-3 font-black text-gray-500">SKU</th>
                            <th className="px-4 py-3 font-black text-gray-500 text-center">الباركود</th>
                            <th className="px-4 py-3 font-black text-gray-500 text-center">الكمية</th>
                            <th className="px-4 py-3 font-black text-gray-500 text-center">السعر</th>
                            <th className="px-4 py-3 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {variants.map((v, idx) => (
                            <tr key={idx} className="hover:bg-white transition-colors">
                              <td className="px-4 py-3 font-bold text-gray-900">{v.optionCombinationString}</td>
                              <td className="px-4 py-3">
                                <input type="text" value={v.sku}
                                  onChange={e => { const list = [...variants]; list[idx].sku = e.target.value; setVariants(list); }}
                                  className="bg-transparent border-none font-mono text-blue-600 outline-none w-full font-bold text-xs" />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1 max-w-[200px] mx-auto shadow-sm">
                                  <input type="text" value={v.barcode || ''}
                                    placeholder="الباركود..."
                                    onChange={e => { const list = [...variants]; list[idx].barcode = e.target.value; setVariants(list); }}
                                    className="bg-transparent border-none outline-none font-mono text-gray-800 w-full text-center text-xs" />
                                  <button type="button" onClick={() => {
                                    const list = [...variants];
                                    list[idx].barcode = generateEAN13Barcode();
                                    setVariants(list);
                                  }}
                                    title="توليد باركود تلقائي"
                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1 flex-shrink-0">
                                    <RefreshCw className="w-3.5 h-3.5 animate-none hover:rotate-180 transition-transform duration-300" />
                                  </button>
                                  {v.barcode && (
                                    <button type="button" onClick={() => {
                                      setPrintProducts([{
                                        id: id || `temp-${Date.now()}`,
                                        name: `${productName || 'صنف جديد'} (${v.optionCombinationString})`,
                                        barcode: v.barcode || '',
                                        sellingPrice: v.price || watch('sellingPrice') || 0,
                                        costPrice: watch('costPrice') || 0,
                                        quantity: v.quantity || 0,
                                        brand: watch('brand') || '',
                                        category: watch('category') || '',
                                        sku: v.sku || '',
                                        sizes: [],
                                        colors: [],
                                        images: previews.filter(p => p.startsWith('http')),
                                        createdAt: new Date().toISOString(),
                                      }]);
                                      setBarcodePrintOpen(true);
                                    }}
                                      title="طباعة ملصق الباركود"
                                      className="text-gray-400 hover:text-indigo-600 transition-colors p-1 flex-shrink-0">
                                      <Printer className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input type="number" value={v.quantity ?? v.qty}
                                  onChange={e => { const list = [...variants]; list[idx].quantity = Number(e.target.value); list[idx].qty = Number(e.target.value); setVariants(list); }}
                                  className="bg-transparent border-none outline-none font-black text-gray-800 w-12 text-center text-xs" />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input type="number" value={v.price}
                                  onChange={e => { const list = [...variants]; list[idx].price = Number(e.target.value); setVariants(list); }}
                                  className="bg-transparent border-none outline-none font-black text-indigo-600 w-16 text-center text-xs" />
                              </td>
                              <td className="px-4 py-3">
                                <button type="button" onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                                  className="text-red-300 hover:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* ── 7. الضمان والصلاحية ──────────────────────────────────── */}
            <Card>
              <SectionHeader icon={ShieldCheck} title="الضمان والصلاحية" color="indigo" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <FieldLabel>فترة الضمان</FieldLabel>
                  <div className="flex gap-2">
                    <input {...register('warrantyDuration', { valueAsNumber: true })} type="number"
                      className={cn(inputCls, "flex-1")} />
                    <select {...register('warrantyUnit')}
                      className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                      <option value="DAYS">أيام</option>
                      <option value="MONTHS">شهور</option>
                      <option value="YEARS">سنوات</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input {...register('hasExpiration')} type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                    <span className="text-sm font-bold text-gray-700">الصنف له تاريخ صلاحية</span>
                  </label>
                  {watch('hasExpiration') && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <FieldLabel>أيام الصلاحية</FieldLabel>
                        <input {...register('expirationDays', { valueAsNumber: true })} type="number"
                          className={inputCls} />
                      </div>
                      <div>
                        <FieldLabel>تنبيه قبل (أيام)</FieldLabel>
                        <input {...register('expirationAlertDays', { valueAsNumber: true })} type="number"
                          className={inputCls} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* ── 8. بيانات الشحن والاستيراد ───────────────────────────── */}
            <Card>
              <SectionHeader icon={Globe} title="بيانات الشحن والاستيراد" color="teal" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <FieldLabel>وزن المنتج</FieldLabel>
                  <div className="flex gap-2">
                    <input {...register('weight', { valueAsNumber: true })} type="number" step="0.01" placeholder="0.00"
                      className={cn(inputCls, "flex-1")} />
                    <select {...register('weightUnit')}
                      className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                      <option value="KG">كجم</option>
                      <option value="GRAM">جرام</option>
                    </select>
                  </div>
                </div>
                <div>
                  <FieldLabel>المصنع أو المورد</FieldLabel>
                  <input {...register('originNumber')} type="text" placeholder="الشركة المصنعة..."
                    className={inputCls} />
                </div>
                <div>
                  <FieldLabel>بلد المنشأ</FieldLabel>
                  <input {...register('location')} type="text" placeholder="بلد الاستيراد..."
                    className={inputCls} />
                </div>
              </div>
            </Card>

            {/* ── 9. الباركود ───────────────────────────────────────────── */}
            <Card>
              <SectionHeader icon={Barcode} title="رمز الباركود" color="indigo" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-3">
                  <div>
                    <FieldLabel>رمز الباركود للصنف</FieldLabel>
                    <div className="relative">
                      <Barcode className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input {...register('barcode')} type="text" placeholder="أدخل باركود الصنف..."
                        className={cn(inputCls, "pr-10 pl-24 font-mono")} />
                      <button type="button" onClick={generateRandomBarcode}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-lg px-2.5 py-1 text-[10px] font-black hover:bg-blue-700 transition-all">
                        توليد آلي
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 font-medium mt-1.5">
                      يمكنك كتابة الرمز يدوياً، أو استخدام قارئ الباركود، أو الضغط على توليد آلي لإنشاء كود EAN-13.
                    </p>
                  </div>
                </div>

                <div>
                  {barcodeValue ? (
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 flex flex-col items-center gap-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">معاينة الملصق</p>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center min-w-[180px]">
                        <span className="text-xs font-black text-gray-800 mb-1">{productName || 'اسم الصنف'}</span>
                        <svg id="single-product-barcode" />
                        <span className="text-sm font-black text-blue-600 mt-1">{formatCurrency(sellVal || 0)}</span>
                      </div>
                      <button type="button"
                        onClick={() => {
                          const printWindow = window.open('', '_blank', 'width=450,height=300');
                          if (printWindow) {
                            const svgCode = document.getElementById('single-product-barcode')?.outerHTML || '';
                            printWindow.document.write(`<html><head><title>طباعة باركود</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;direction:rtl;"><div style="border:1px dashed #ccc;padding:10px;border-radius:8px;"><h4 style="font-family:system-ui,sans-serif;margin:0 0 4px 0;font-size:10px;font-weight:900;">${productName || 'صنف'}</h4>${svgCode}<div style="font-family:system-ui,sans-serif;font-size:11px;font-weight:bold;margin-top:4px;">السعر: ${formatCurrency(sellVal || 0)}</div></div><script>window.onload=function(){window.print();window.close();}<\/script></body></html>`);
                            printWindow.document.close();
                          }
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-indigo-600 rounded-xl text-xs font-black transition-all shadow-sm">
                        <Printer className="w-3.5 h-3.5" /> طباعة ملصق
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400 text-xs font-bold bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      أدخل رمز الباركود لمشاهدة المعاينة
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* ── 10. الصور والوسائط والـ SEO ─────────────────────────── */}
            <Card>
              <SectionHeader icon={ImageIcon} title="الصور والوسائط" color="blue">
                <button type="button" onClick={startCamera}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black transition-all">
                  <Camera className="w-3.5 h-3.5" /> التقاط صورة
                </button>
              </SectionHeader>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); onImageChange(e); }}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer",
                  isDragging ? "border-blue-500 bg-blue-50/20" : "border-gray-200 hover:bg-gray-50"
                )}
              >
                <Upload className="w-7 h-7 text-gray-300" />
                <p className="text-sm font-bold text-gray-400 text-center">اسحب الصور وأسقطها هنا</p>
                <input type="file" multiple accept="image/*" onChange={onImageChange} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="text-xs font-black text-blue-600 hover:underline cursor-pointer">
                  تصفح الملفات
                </label>
              </div>

              {previews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3 mt-4">
                  {previews.map((src, i) => (
                    <div key={i} className={cn(
                      "relative aspect-square rounded-xl border-2 overflow-hidden bg-gray-50",
                      mainImageIndex === i ? "border-blue-500 shadow-md" : "border-gray-100"
                    )}>
                      <img src={src} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg hover:bg-red-600">
                        <X className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => setMainImageIndex(i)}
                        className={cn(
                          "absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded font-black",
                          mainImageIndex === i ? "bg-blue-600 text-white" : "bg-white text-gray-700 shadow-sm"
                        )}>
                        {mainImageIndex === i ? '★ رئيسية' : 'تحديد'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-50">
                <FieldLabel>رابط فيديو (YouTube / Vimeo)</FieldLabel>
                <div className="relative">
                  <Video className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input {...register('videoUrl')} type="text" placeholder="https://youtube.com/watch?v=..."
                    className={cn(inputCls, "pr-10 font-mono")} />
                </div>
              </div>
            </Card>

            {/* ── 11. SEO ───────────────────────────────────────────────── */}
            <Card>
              <SectionHeader icon={Globe} title="تحسين محركات البحث (SEO)" color="teal" />
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <FieldLabel>رابط Slug فريد</FieldLabel>
                    <input {...register('seoSlug')} type="text"
                      className={cn(inputCls, "font-mono text-indigo-600 font-bold")} />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>عنوان محرك البحث (Meta Title)</FieldLabel>
                    <input {...register('seoTitle')} type="text" placeholder="العنوان الذي يظهر في جوجل..."
                      className={inputCls} />
                  </div>
                </div>
                <div>
                  <FieldLabel>وصف محرك البحث (Meta Description)</FieldLabel>
                  <textarea {...register('seoDescription')} rows={2}
                    placeholder="نبذة مختصرة تجذب العملاء للضغط على الرابط..."
                    className={cn(inputCls, "resize-none")} />
                </div>
              </div>
            </Card>

          </div>{/* end main column */}

          {/* ══════════════════════════════════════════════════════════════
              LEFT / SIDEBAR COLUMN
          ══════════════════════════════════════════════════════════════ */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4 lg:sticky lg:top-[72px]">

            {/* Save Actions Card */}
            <Card className="p-5">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-4">إجراءات الحفظ</h3>
              <div className="space-y-2.5">
                <button type="button"
                  onClick={handleSubmit(val => onSubmit(val, false))}
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white font-black py-3 rounded-xl text-sm shadow-sm shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'جاري الحفظ...' : 'اعتماد وحفظ الصنف'}
                </button>
                <button type="button"
                  onClick={handleSubmit(val => onSubmit(val, true))}
                  disabled={isSubmitting}
                  className="w-full bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  حفظ كمسودة
                </button>
                <button type="button"
                  onClick={() => navigate('/inventory/products')}
                  className="w-full text-gray-400 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-all">
                  إلغاء والرجوع
                </button>
              </div>

              {/* Form Errors Alert */}
              {Object.keys(errors).length > 0 && (
                <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-red-600">يوجد أخطاء في النموذج</p>
                    <p className="text-xs text-red-400 mt-0.5">يرجى مراجعة الحقول المطلوبة</p>
                  </div>
                </div>
              )}
            </Card>

            {/* Profit Analysis Card */}
            <Card className="bg-gray-900 border-gray-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-wider">تحليل الربحية</h3>
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold">سعر التكلفة</p>
                  <p className="text-sm font-black text-white mt-0.5">{formatCurrency(costVal)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold">سعر البيع</p>
                  <p className="text-sm font-black text-white mt-0.5">{formatCurrency(activeSellPrice)}</p>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <p className="text-[10px] text-gray-500 font-bold">الربح الصافي</p>
                  <p className={cn("text-xl font-black mt-0.5", netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {netProfit.toFixed(2)} EGP
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-gray-500 font-bold">هامش الربح</p>
                    <p className={cn("text-lg font-black", profitMargin >= 30 ? "text-emerald-400" : profitMargin > 0 ? "text-yellow-400" : "text-red-400")}>
                      {profitMargin}%
                    </p>
                    <span className={cn(
                      "text-[9px] font-black px-1.5 py-0.5 rounded-full",
                      profitMargin >= 30 ? "bg-emerald-500/20 text-emerald-400" :
                      profitMargin > 0 ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-red-500/20 text-red-400"
                    )}>
                      {profitMargin >= 30 ? 'ممتاز' : profitMargin > 0 ? 'متوسط' : 'خسارة'}
                    </span>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-gray-500 font-bold">نسبة الزيادة</p>
                    <p className="text-lg font-black text-white">{markupPercent}%</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Info Card */}
            <Card className="p-5">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-4">ملخص سريع</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">وحدة القياس</span>
                  <span className="text-xs font-black text-gray-800">{mainUnit || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">نوع الوحدة</span>
                  <span className="text-xs font-black text-gray-800">
                    {unitType === 'SINGLE' ? 'منفردة' : 'متعددة'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">الكمية المدخلة</span>
                  <span className="text-xs font-black text-blue-600">
                    {watch('initialQuantity') || 0} قطعة
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">المتغيرات</span>
                  <span className="text-xs font-black text-purple-600">{variants.length} متغير</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">الوسوم</span>
                  <span className="text-xs font-black text-gray-800">{currentTags.length} وسم</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">الصور</span>
                  <span className="text-xs font-black text-gray-800">{previews.length} صورة</span>
                </div>
              </div>
            </Card>

          </div>{/* end sidebar */}

        </div>
      </form>

      {/* ─── Live Camera Snapshot Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showCamera && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 text-center"
            >
              <h3 className="text-sm font-black text-gray-900">التقاط صورة من الكاميرا</h3>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="flex gap-2 justify-center">
                <button type="button" onClick={takeSnapshot}
                  className="bg-blue-600 text-white font-black px-5 py-2.5 rounded-xl text-sm hover:bg-blue-700">
                  التقاط صورة
                </button>
                <button type="button" onClick={stopCamera}
                  className="bg-gray-100 text-gray-700 font-black px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200">
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Barcode Print Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {barcodePrintOpen && (
          <BarcodePrintModal
            isOpen={barcodePrintOpen}
            onClose={() => setBarcodePrintOpen(false)}
            selectedProducts={printProducts}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
