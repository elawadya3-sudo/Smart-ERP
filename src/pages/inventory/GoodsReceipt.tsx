import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowDownLeft, Package, Search, Plus, Trash2, Save, FileText,
  Boxes, History, Edit2, ChevronDown, ChevronUp, X, User,
  Phone, Mail, MapPin, Building2, CreditCard, Banknote, Clock,
  CheckCircle2, AlertCircle, PlusCircle, Percent, Calculator,
  DollarSign, Calendar, ChevronRight, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { productsService } from '../../services/firestore';
import { warehouseService, inventoryTransactionService } from '../../services/inventory';
import { Product, Warehouse, InventoryTransaction, ProductVariant } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import {
  collection, query, where, orderBy, onSnapshot, limit,
  addDoc, updateDoc, doc, getDocs, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { accountingIntegration } from '../../services/accountingIntegration';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  contactPerson?: string;
  notes?: string;
  balance?: number;
  createdAt: string;
}

interface PaymentInstallment {
  id: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  isPaid: boolean;
  method: 'cash' | 'bank' | 'check';
  notes?: string;
}

interface CartItem {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  cost: number;
  discount: number; // per-item discount %
  variant?: {
    size: string | number;
    color: string;
  };
}

const parseVariantFromName = (name: string) => {
  const match = name.match(/\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(' / ');
  let size = '';
  let color = '';
  parts.forEach(part => {
    if (part.includes('مقاس:')) {
      size = part.replace('مقاس:', '').trim();
    } else if (part.includes('لون:')) {
      color = part.replace('لون:', '').trim();
    } else if (part.includes('Size:')) {
      size = part.replace('Size:', '').trim();
    } else if (part.includes('Color:')) {
      color = part.replace('Color:', '').trim();
    } else {
      if (parts.length === 1) {
        size = part.trim();
      } else {
        if (!size) size = part.trim();
        else if (!color) color = part.trim();
      }
    }
  });
  return { size, color };
};

const getCleanName = (name: string) => {
  return name.replace(/\s*\([^)]+\)/, '');
};

// ─── Supplier Modal ───────────────────────────────────────────────────────────
const emptySupplier: Omit<Supplier, 'id' | 'createdAt'> = {
  name: '', phone: '', email: '', address: '', taxNumber: '', contactPerson: '', notes: ''
};

function SupplierModal({
  supplier,
  onClose,
  onSave
}: {
  supplier?: Supplier | null;
  onClose: () => void;
  onSave: (data: Omit<Supplier, 'id' | 'createdAt'>) => Promise<void>;
}) {
  const [form, setForm] = useState<Omit<Supplier, 'id' | 'createdAt'>>(
    supplier ? {
      name: supplier.name, phone: supplier.phone || '', email: supplier.email || '',
      address: supplier.address || '', taxNumber: supplier.taxNumber || '',
      contactPerson: supplier.contactPerson || '', notes: supplier.notes || ''
    } : { ...emptySupplier }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-8 space-y-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">{supplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</h3>
              <p className="text-xs text-slate-400 font-bold">بيانات المورد في سجلات النظام</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">اسم المورد / الشركة *</label>
            <div className="relative">
              <Building2 className="absolute right-4 top-3.5 w-4 h-4 text-slate-300" />
              <input
                type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: شركة الرياض للتوريد"
                className="w-full bg-slate-50 rounded-xl pr-10 pl-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">رقم الجوال</label>
            <div className="relative">
              <Phone className="absolute right-4 top-3.5 w-4 h-4 text-slate-300" />
              <input
                type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="05XXXXXXXX"
                className="w-full bg-slate-50 rounded-xl pr-10 pl-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-4 top-3.5 w-4 h-4 text-slate-300" />
              <input
                type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="supplier@example.com"
                className="w-full bg-slate-50 rounded-xl pr-10 pl-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">الرقم الضريبي</label>
            <input
              type="text" value={form.taxNumber} onChange={e => setForm({ ...form, taxNumber: e.target.value })}
              placeholder="3001234567890003"
              className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">مسؤول التواصل</label>
            <div className="relative">
              <User className="absolute right-4 top-3.5 w-4 h-4 text-slate-300" />
              <input
                type="text" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="اسم مندوب المبيعات"
                className="w-full bg-slate-50 rounded-xl pr-10 pl-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">العنوان</label>
            <div className="relative">
              <MapPin className="absolute right-4 top-3.5 w-4 h-4 text-slate-300" />
              <input
                type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="الرياض، حي العليا، شارع التحلية..."
                className="w-full bg-slate-50 rounded-xl pr-10 pl-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">ملاحظات</label>
            <textarea
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2} placeholder="أي ملاحظات إضافية..."
              className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all">
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'جاري الحفظ...' : supplier ? 'حفظ التعديلات' : 'إضافة المورد'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Payment Installment Modal ────────────────────────────────────────────────
function AddPaymentModal({
  receiptId,
  remaining,
  onClose,
  onSaved
}: {
  receiptId: string;
  remaining: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(remaining);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<'cash' | 'bank' | 'check'>('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (amount <= 0) return;
    setSaving(true);
    try {
      const ref = collection(db, 'purchase_payments');
      await addDoc(ref, {
        receiptId,
        amount,
        dueDate,
        isPaid: true,
        paidDate: new Date().toISOString(),
        method,
        notes,
        createdAt: serverTimestamp()
      });
      // Update receipt remaining balance
      const receiptRef = doc(db, 'purchase_receipts', receiptId);
      await updateDoc(receiptRef, { lastPaymentAt: new Date().toISOString() });

      // 1. Sync payment to accounts_payable record
      const apQuery = query(collection(db, 'accounts_payable'), where('purchaseReceiptId', '==', receiptId));
      const apSnap = await getDocs(apQuery);
      if (!apSnap.empty) {
        const apDoc = apSnap.docs[0];
        const apData = apDoc.data();
        const newPaid = (apData.paidAmount || 0) + amount;
        const newStatus = newPaid >= apData.amount ? 'PAID' : 'PARTIAL';
        await updateDoc(doc(db, 'accounts_payable', apDoc.id), {
          paidAmount: newPaid,
          status: newStatus
        });
      }

      // 2. Sync payment to supplier balance (decrease balance owed)
      const receiptSnap = await getDoc(receiptRef);
      if (receiptSnap.exists()) {
        const receiptData = receiptSnap.data();
        const suppId = receiptData.supplierId;
        if (suppId) {
          const suppRef = doc(db, 'suppliers', suppId);
          const suppSnap = await getDoc(suppRef);
          if (suppSnap.exists()) {
            const currentBalance = suppSnap.data().balance || 0;
            await updateDoc(suppRef, {
              balance: Math.max(0, currentBalance - amount)
            });
          }
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("Installment payment sync failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900">تسجيل دفعة</h3>
            <p className="text-xs text-slate-400 font-bold">المبلغ المتبقي: {formatCurrency(remaining)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">المبلغ</label>
            <input
              type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} max={remaining}
              className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">تاريخ الدفع</label>
            <input
              type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">طريقة الدفع</label>
            <div className="grid grid-cols-3 gap-2">
              {([['cash', 'نقداً', Banknote], ['bank', 'تحويل بنكي', Building2], ['check', 'شيك', FileText]] as const).map(([v, label, Icon]) => (
                <button
                  key={v} type="button" onClick={() => setMethod(v)}
                  className={cn(
                    "py-2 rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all border",
                    method === v ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">ملاحظات</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري..."
              className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">إلغاء</button>
          <button
            onClick={handleSave} disabled={saving || amount <= 0}
            className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-black hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'جاري...' : 'تأكيد الدفع'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GoodsReceiptPage() {
  const { user } = useAuth();
  const location = useLocation();

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0); // invoice-level discount %
  const [tax, setTax] = useState(15); // VAT %
  const [paymentType, setPaymentType] = useState<'paid' | 'credit'>('paid');
  const [dueDate, setDueDate] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'check'>('cash');

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Modals
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [variantSelectorProduct, setVariantSelectorProduct] = useState<Product | null>(null);
  const [localVariantQuantities, setLocalVariantQuantities] = useState<Record<number, number>>({});
  const [localVariantCosts, setLocalVariantCosts] = useState<Record<number, number>>({});

  useEffect(() => {
    if (variantSelectorProduct) {
      const initialQtys: Record<number, number> = {};
      const initialCosts: Record<number, number> = {};
      variantSelectorProduct.variants?.forEach((v, idx) => {
        initialQtys[idx] = 0;
        initialCosts[idx] = v.price || variantSelectorProduct.costPrice || 0;
      });
      setLocalVariantQuantities(initialQtys);
      setLocalVariantCosts(initialCosts);
    }
  }, [variantSelectorProduct]);

  // ── Load Data ────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadStatic = async () => {
      const [prods, whs] = await Promise.all([productsService.getAll(), warehouseService.getAll()]);
      setProducts(prods);
      setWarehouses(whs);
      if (whs.length > 0) setSelectedWarehouse(whs[0].id);
    };
    loadStatic();

    // Suppliers realtime
    const supQ = query(collection(db, 'suppliers'), orderBy('createdAt', 'desc'));
    const unsubSup = onSnapshot(supQ, snap => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    });

    // Receipts realtime (purchase_receipts collection)
    const recQ = query(collection(db, 'purchase_receipts'), orderBy('createdAt', 'desc'), limit(20));
    const unsubRec = onSnapshot(recQ, snap => {
      setRecentReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Payments realtime
    const payQ = query(collection(db, 'purchase_payments'), orderBy('createdAt', 'desc'));
    const unsubPay = onSnapshot(payQ, snap => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubSup(); unsubRec(); unsubPay(); };
  }, []);

  // ── Invoice Calculations ─────────────────────────────────────────────────
  const subtotal = cart.reduce((sum, i) => {
    const itemTotal = i.cost * i.quantity;
    const itemDiscount = itemTotal * (i.discount / 100);
    return sum + itemTotal - itemDiscount;
  }, 0);
  const invoiceDiscount = subtotal * (discount / 100);
  const afterDiscount = subtotal - invoiceDiscount;
  const taxAmount = afterDiscount * (tax / 100);
  const total = afterDiscount + taxAmount;
  const remaining = Math.max(0, total - paidAmount);

  // ── Cart Helpers ─────────────────────────────────────────────────────────
  const addToCart = async (product: Product, selectedVariant?: ProductVariant) => {
    let matchedVariant = selectedVariant;
    const term = searchTerm.trim().toLowerCase();
    
    // Check if the search term matches a variant's barcode or SKU directly
    if (!matchedVariant && term && product.variants && product.variants.length > 0) {
      matchedVariant = product.variants.find(v =>
        v.barcode?.toLowerCase() === term ||
        v.sku?.toLowerCase() === term
      );
    }

    // Detect if this is a variant product
    const isVariantProduct = product.productType === 'variant' ||
      (product.variants && product.variants.length > 0);

    if (isVariantProduct && !matchedVariant) {
      // Fetch the freshest version of this product from Firestore
      // to guarantee we have the latest variants data
      try {
        const freshSnap = await getDoc(doc(db, 'products', product.id));
        if (freshSnap.exists()) {
          const freshProduct = { id: freshSnap.id, ...freshSnap.data() } as Product;
          
          // Re-check with fresh variants data if we have an exact scan match
          if (term && freshProduct.variants) {
            const freshMatched = freshProduct.variants.find(v =>
              v.barcode?.toLowerCase() === term ||
              v.sku?.toLowerCase() === term
            );
            if (freshMatched) {
              // Bypasses the modal entirely since we matched the specific variant!
              addToCart(freshProduct, freshMatched);
              setSearchTerm('');
              return;
            }
          }
          setVariantSelectorProduct(freshProduct);
        } else {
          setVariantSelectorProduct(product);
        }
      } catch {
        setVariantSelectorProduct(product);
      }
      return;
    }

    const sku = matchedVariant
      ? (matchedVariant.sku || `${product.sku || 'PROD'}-${matchedVariant.size}-${matchedVariant.color}`)
      : product.sku;
    const displayName = matchedVariant
      ? `${product.name} (${matchedVariant.size ? `مقاس: ${matchedVariant.size}` : ''}${matchedVariant.size && matchedVariant.color ? ' / ' : ''}${matchedVariant.color ? `لون: ${matchedVariant.color}` : ''})`
      : product.name;
    const cost = product.costPrice || 0;

    const key = sku || product.id;
    const existing = cart.find(item => (item.sku || item.productId) === key);
    if (existing) {
      setCart(cart.map(item => (item.sku || item.productId) === key ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: displayName,
          quantity: 1,
          cost: cost,
          sku: sku,
          discount: 0,
          variant: matchedVariant ? { size: matchedVariant.size, color: matchedVariant.color } : undefined
        }
      ]);
    }
    setVariantSelectorProduct(null);
    setSearchTerm(''); // Clear search term after successful add
  };

  const handleAddMultipleVariants = () => {
    if (!variantSelectorProduct) return;
    
    const newItems: CartItem[] = [];
    variantSelectorProduct.variants?.forEach((v, index) => {
      const qty = localVariantQuantities[index] || 0;
      const cost = localVariantCosts[index] !== undefined ? localVariantCosts[index] : (variantSelectorProduct.costPrice || 0);
      if (qty > 0) {
        const sku = v.sku || `${variantSelectorProduct.sku || 'PROD'}-${v.size}-${v.color}`;
        const displayName = `${variantSelectorProduct.name} (${v.size ? `مقاس: ${v.size}` : ''}${v.size && v.color ? ' / ' : ''}${v.color ? `لون: ${v.color}` : ''})`;
        newItems.push({
          productId: variantSelectorProduct.id,
          productName: displayName,
          quantity: qty,
          cost: cost,
          sku: sku,
          discount: 0,
          variant: { size: v.size, color: v.color }
        });
      }
    });

    if (newItems.length > 0) {
      const updatedCart = [...cart];
      newItems.forEach(newItem => {
        const key = newItem.sku || newItem.productId;
        const existingIdx = updatedCart.findIndex(item => (item.sku || item.productId) === key);
        if (existingIdx > -1) {
          updatedCart[existingIdx].quantity += newItem.quantity;
          updatedCart[existingIdx].cost = newItem.cost;
        } else {
          updatedCart.push(newItem);
        }
      });
      setCart(updatedCart);
    }
    setVariantSelectorProduct(null);
  };

  const updateCartItem = (itemKey: string, field: keyof CartItem, value: number) => {
    setCart(cart.map(i => (i.sku || i.productId) === itemKey ? { ...i, [field]: value } : i));
  };

  const removeFromCart = (itemKey: string) => setCart(cart.filter(i => (i.sku || i.productId) !== itemKey));

  // ── Supplier Actions ─────────────────────────────────────────────────────
  const handleSaveSupplier = async (data: Omit<Supplier, 'id' | 'createdAt'>) => {
    if (editingSupplier) {
      await updateDoc(doc(db, 'suppliers', editingSupplier.id), { ...data, updatedAt: new Date().toISOString() });
    } else {
      const ref = await addDoc(collection(db, 'suppliers'), { ...data, balance: 0, createdAt: new Date().toISOString() });
      setSelectedSupplierId(ref.id);
    }
    setShowSupplierModal(false);
    setEditingSupplier(null);
  };

  // ── Submit Receipt ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedWarehouse || cart.length === 0) return;
    setLoading(true);
    try {
      // Helper: remove undefined values (Firestore rejects them)
      const cleanObj = (obj: Record<string, any>) =>
        Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

      const receiptData = cleanObj({
        type: 'RECEIPT',
        status: 'COMPLETED',
        supplierId: selectedSupplierId || null,
        supplierName: suppliers.find(s => s.id === selectedSupplierId)?.name || '',
        toWarehouseId: selectedWarehouse,
        items: cart.map(({ productId, productName, sku, quantity, cost, discount, variant }) =>
          cleanObj({ productId, productName, sku: sku || null, quantity, cost, discount, variant: variant || null })
        ),
        invoiceNumber: invoiceNumber || null,
        invoiceDate,
        notes: notes || null,
        discount,
        tax,
        subtotal,
        invoiceDiscount,
        taxAmount,
        total,
        paymentType,
        paidAmount: paymentType === 'paid' ? total : paidAmount,
        remaining: paymentType === 'paid' ? 0 : remaining,
        paymentMethod: paymentType === 'paid' ? paymentMethod : null,
        dueDate: paymentType === 'credit' && dueDate ? dueDate : null,
        createdBy: user?.uid || 'anonymous',
        createdAt: new Date().toISOString()
      });

      if (editingId) {
        await updateDoc(doc(db, 'purchase_receipts', editingId), { ...receiptData, updatedAt: new Date().toISOString() });
        // Also update inventory
        const oldTx = recentReceipts.find(r => r.id === editingId);
        if (oldTx?.inventoryTxId) {
          await inventoryTransactionService.updateStockMovement(oldTx.inventoryTxId, oldTx, {
            type: 'RECEIPT', status: 'COMPLETED', toWarehouseId: selectedWarehouse,
            items: cart.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, cost: i.cost, sku: i.sku, variant: i.variant || null })),
            reference: invoiceNumber, createdBy: user?.uid || ''
          });
        }
        alert('تم تعديل فاتورة التوريد بنجاح!');
      } else {
        // Create inventory transaction for stock update
        const invTx = await inventoryTransactionService.createStockMovement({
          type: 'RECEIPT', status: 'COMPLETED', toWarehouseId: selectedWarehouse,
          items: cart.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, cost: i.cost, sku: i.sku, variant: i.variant || null })),
          reference: invoiceNumber, createdBy: user?.uid || ''
        });

        const ref = await addDoc(collection(db, 'purchase_receipts'), {
          ...receiptData,
          inventoryTxId: invTx?.id || null
        });

        // If credit, create accounts_payable record and update supplier balance
        if (paymentType === 'credit') {
          // 1. Create accounts_payable invoice
          await addDoc(collection(db, 'accounts_payable'), {
            supplierId: selectedSupplierId || '',
            supplierName: suppliers.find(s => s.id === selectedSupplierId)?.name || 'مورد غير محدد',
            reference: invoiceNumber || `REC-${ref.id.slice(0, 8)}`,
            amount: total,
            paidAmount: paidAmount || 0,
            dueDate: dueDate || new Date().toISOString().split('T')[0],
            status: paidAmount >= total ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
            notes: notes || `فاتورة توريد بضاعة رقم ${invoiceNumber || ''}`,
            purchaseReceiptId: ref.id,
            createdAt: new Date().toISOString()
          });

          // 2. Update supplier balance (increase by remaining debt)
          if (selectedSupplierId) {
            const supplierRef = doc(db, 'suppliers', selectedSupplierId);
            const suppSnap = await getDoc(supplierRef);
            if (suppSnap.exists()) {
              const currentBalance = suppSnap.data().balance || 0;
              await updateDoc(supplierRef, {
                balance: currentBalance + remaining
              });
            }
          }
        }

        // If first payment already recorded
        if (paymentType === 'credit' && paidAmount > 0) {
          await addDoc(collection(db, 'purchase_payments'), {
            receiptId: ref.id, amount: paidAmount, isPaid: true,
            paidDate: new Date().toISOString(), method: paymentMethod,
            notes: 'دفعة أولى عند الاستلام', createdAt: serverTimestamp()
          });
        }

        alert('تم حفظ فاتورة التوريد وتحديث المخزون بنجاح!');
      }

      // Reset form
      setCart([]); setInvoiceNumber(''); setNotes(''); setDiscount(0); setTax(15);
      setPaymentType('paid'); setPaidAmount(0); setDueDate(''); setEditingId(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'حدث خطأ أثناء معالجة الطلب');
    } finally {
      setLoading(false);
    }
  };

  // ── Edit Receipt ─────────────────────────────────────────────────────────
  const handleEdit = (receipt: any) => {
    setEditingId(receipt.id);
    setCart(receipt.items || []);
    setSelectedWarehouse(receipt.toWarehouseId || '');
    setSelectedSupplierId(receipt.supplierId || '');
    setInvoiceNumber(receipt.invoiceNumber || '');
    setInvoiceDate(receipt.invoiceDate || new Date().toISOString().split('T')[0]);
    setNotes(receipt.notes || '');
    setDiscount(receipt.discount || 0);
    setTax(receipt.tax || 15);
    setPaymentType(receipt.paymentType || 'paid');
    setPaidAmount(receipt.paidAmount || 0);
    setDueDate(receipt.dueDate || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null); setCart([]); setInvoiceNumber(''); setNotes('');
    setDiscount(0); setTax(15); setPaymentType('paid'); setPaidAmount(0);
  };

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const nameMatch = p.name.toLowerCase().includes(term);
    const skuMatch = p.sku?.toLowerCase().includes(term);
    const barcodeMatch = p.barcode?.toLowerCase().includes(term);
    const variantMatch = p.variants?.some(v => 
      v.sku?.toLowerCase().includes(term) || 
      v.barcode?.toLowerCase().includes(term)
    );
    return nameMatch || skuMatch || barcodeMatch || variantMatch;
  });

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
  const getReceiptPayments = (receiptId: string) => payments.filter(p => p.receiptId === receiptId);

  return (
    <div className="space-y-8 pb-20 rtl" dir="rtl">
      {/* ─── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 px-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">
            {editingId ? 'تعديل فاتورة توريد' : 'توريد بضاعة جديد'}
          </h2>
          <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-widest">
            {editingId ? `تعديل الفاتورة: ${editingId.slice(0, 8)}` : 'استلام شحنات من الموردين وتسجيل الفاتورة المالية'}
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {editingId && (
            <button onClick={cancelEdit} className="px-5 py-3 rounded-2xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all flex items-center gap-2">
              <X className="w-4 h-4" /> إلغاء التعديل
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || cart.length === 0}
            className={cn(
              "flex-1 sm:flex-none px-8 py-3 rounded-2xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2",
              editingId ? "bg-amber-500 text-white shadow-amber-100 hover:bg-amber-600" : "bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700",
              (loading || cart.length === 0) && "opacity-50 cursor-not-allowed"
            )}
          >
            {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
            {editingId ? 'حفظ التعديلات' : 'تأكيد وحفظ الفاتورة'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 px-4">

        {/* ─── Left Panel: Form + Cart + Calculations ──────────────────────── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Supplier Card */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 flex items-center gap-2 text-base">
                <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                المورد
              </h3>
              <div className="flex gap-2">
                {selectedSupplier && (
                  <button
                    onClick={() => { setEditingSupplier(selectedSupplier); setShowSupplierModal(true); }}
                    className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"
                    title="تعديل بيانات المورد"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => { setEditingSupplier(null); setShowSupplierModal(true); }}
                  className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                  title="إضافة مورد جديد"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <select
              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 focus:ring-4 focus:ring-blue-50 outline-none text-sm font-bold appearance-none"
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
            >
              <option value="">-- اختر المورد --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {selectedSupplier && (
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs font-bold">
                {selectedSupplier.phone && <div className="flex items-center gap-2 text-slate-500"><Phone className="w-3.5 h-3.5" /> {selectedSupplier.phone}</div>}
                {selectedSupplier.email && <div className="flex items-center gap-2 text-slate-500"><Mail className="w-3.5 h-3.5" /> {selectedSupplier.email}</div>}
                {selectedSupplier.contactPerson && <div className="flex items-center gap-2 text-slate-500"><User className="w-3.5 h-3.5" /> {selectedSupplier.contactPerson}</div>}
                {selectedSupplier.taxNumber && <div className="flex items-center gap-2 text-slate-400"><FileText className="w-3.5 h-3.5" /> الرقم الضريبي: {selectedSupplier.taxNumber}</div>}
              </div>
            )}
          </div>

          {/* Invoice Details */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="font-black text-slate-900 flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              بيانات الفاتورة
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">رقم الفاتورة</label>
                <input
                  type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="INV-2024-001"
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">تاريخ الفاتورة</label>
                <input
                  type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المستودع المستلم</label>
              <select
                className="w-full bg-slate-50 border-none rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold appearance-none"
                value={selectedWarehouse}
                onChange={e => setSelectedWarehouse(e.target.value)}
              >
                {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ملاحظات</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="ملاحظات على الفاتورة..."
                className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>
          </div>

          {/* Cart */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 flex items-center gap-2 text-base">
                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                الأصناف ({cart.length})
              </h3>
              <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{formatCurrency(subtotal)}</span>
            </div>

            <div className="space-y-3 max-h-[280px] overflow-y-auto scrollbar-none">
              {cart.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
                  <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-300 font-bold">اختر الأصناف من القائمة على اليمين</p>
                </div>
              ) : cart.map(item => {
                const itemKey = item.sku || item.productId;
                return (
                  <div key={itemKey} className="bg-slate-50 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{getCleanName(item.productName)}</p>
                        {(() => {
                          const variantInfo = item.variant || parseVariantFromName(item.productName);
                          if (variantInfo) {
                            return (
                              <div className="flex gap-2 mt-1">
                                {variantInfo.size && (
                                  <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-lg font-bold">
                                    مقاس: {variantInfo.size}
                                  </span>
                                )}
                                {variantInfo.color && (
                                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg font-bold">
                                    لون: {variantInfo.color}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <button onClick={() => removeFromCart(itemKey)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors ml-2 flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">الكمية</label>
                        <input
                          type="number" value={item.quantity} min={1}
                          onChange={e => updateCartItem(itemKey, 'quantity', Number(e.target.value))}
                          className="w-full bg-white rounded-lg px-2 py-1.5 text-center text-xs font-black text-blue-600 outline-none border border-slate-100 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">السعر</label>
                        <input
                          type="number" value={item.cost} min={0}
                          onChange={e => updateCartItem(itemKey, 'cost', Number(e.target.value))}
                          className="w-full bg-white rounded-lg px-2 py-1.5 text-center text-xs font-black outline-none border border-slate-100 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">خصم %</label>
                        <input
                          type="number" value={item.discount} min={0} max={100}
                          onChange={e => updateCartItem(itemKey, 'discount', Number(e.target.value))}
                          className="w-full bg-white rounded-lg px-2 py-1.5 text-center text-xs font-black outline-none border border-slate-100 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] font-black">
                      <span className="text-slate-400">إجمالي الصنف</span>
                      <span className="text-blue-600">{formatCurrency(item.cost * item.quantity * (1 - item.discount / 100))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invoice Calculations */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="font-black text-slate-900 flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                <Calculator className="w-4 h-4" />
              </div>
              حسابات الفاتورة
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">خصم الفاتورة %</label>
                <div className="relative">
                  <Percent className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-300" />
                  <input
                    type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} min={0} max={100}
                    className="w-full bg-slate-50 rounded-xl pr-8 pl-3 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الضريبة %</label>
                <div className="relative">
                  <Percent className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-300" />
                  <input
                    type="number" value={tax} onChange={e => setTax(Number(e.target.value))} min={0} max={100}
                    className="w-full bg-slate-50 rounded-xl pr-8 pl-3 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 text-sm">
              <div className="flex justify-between font-bold text-slate-500">
                <span>الإجمالي قبل الخصم</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between font-bold text-red-500">
                  <span>الخصم ({discount}%)</span>
                  <span>- {formatCurrency(invoiceDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-500">
                <span>بعد الخصم</span>
                <span>{formatCurrency(afterDiscount)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between font-bold text-amber-500">
                  <span>ضريبة القيمة المضافة ({tax}%)</span>
                  <span>+ {formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between font-black text-slate-900 text-base">
                <span>الإجمالي النهائي</span>
                <span className="text-blue-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="font-black text-slate-900 flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              طريقة السداد
            </h3>

            {/* Payment Type Toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType('paid')}
                className={cn(
                  "py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all border-2",
                  paymentType === 'paid'
                    ? "bg-green-600 text-white border-green-600 shadow-lg shadow-green-100"
                    : "bg-slate-50 text-slate-400 border-transparent hover:border-slate-200"
                )}
              >
                <CheckCircle2 className="w-4 h-4" /> مدفوع
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('credit')}
                className={cn(
                  "py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all border-2",
                  paymentType === 'credit'
                    ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-100"
                    : "bg-slate-50 text-slate-400 border-transparent hover:border-slate-200"
                )}
              >
                <Clock className="w-4 h-4" /> آجل
              </button>
            </div>

            {paymentType === 'paid' ? (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">وسيلة الدفع</label>
                <div className="grid grid-cols-3 gap-2">
                  {([['cash', 'نقداً', Banknote], ['bank', 'تحويل', Building2], ['check', 'شيك', FileText]] as const).map(([v, label, Icon]) => (
                    <button
                      key={v} type="button" onClick={() => setPaymentMethod(v)}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all border",
                        paymentMethod === v ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 bg-green-50 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-black text-green-600">✓ مدفوع بالكامل</span>
                  <span className="text-sm font-black text-green-600">{formatCurrency(total)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">تاريخ الاستحقاق</label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-slate-300" />
                    <input
                      type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                      className="w-full bg-slate-50 rounded-xl pr-10 pl-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">دفعة مقدمة (اختياري)</label>
                  <input
                    type="number" value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value))} min={0} max={total}
                    placeholder="0"
                    className="w-full bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 bg-amber-50 rounded-2xl p-3">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-amber-600 uppercase">دفعة مقدمة</p>
                    <p className="text-sm font-black text-amber-700">{formatCurrency(paidAmount)}</p>
                  </div>
                  <div className="text-center border-r border-amber-200">
                    <p className="text-[10px] font-black text-amber-600 uppercase">المتبقي</p>
                    <p className="text-sm font-black text-amber-700">{formatCurrency(remaining)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Right Panel: Product Picker ─────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[640px]">
            <div className="p-6 border-b border-slate-50">
              <div className="relative">
                <Search className="absolute right-5 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredProducts.length === 1) {
                        addToCart(filteredProducts[0]);
                      }
                    }
                  }}
                  placeholder="ابحث بالاسم أو الكود أو الباركود..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl pr-14 pl-6 py-3.5 focus:ring-4 focus:ring-blue-50 outline-none text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 scrollbar-none content-start">
              {filteredProducts.length === 0 ? (
                <div className="col-span-2 text-center py-20 text-slate-300">
                  <Package className="w-10 h-10 mx-auto mb-3" />
                  <p className="text-sm font-bold">لا توجد منتجات مطابقة</p>
                </div>
              ) : filteredProducts.map(p => {
                const inCart = cart.find(c => c.productId === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border transition-all group text-right active:scale-95",
                      inCart
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-100 bg-white hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                      inCart ? "bg-blue-100 text-blue-600" : "bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500"
                    )}>
                      {p.images?.[0] ? (
                        <img src={p.images[0]} className="w-full h-full object-cover rounded-xl" alt="" />
                      ) : (
                        <Boxes className="w-7 h-7" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-900 text-sm truncate">{p.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase truncate">{p.sku} · {p.brand}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{formatCurrency(p.costPrice || 0)}</span>
                        <span className="text-[10px] font-bold text-slate-400">مخزون: {p.quantity || 0}</span>
                        {(p.productType === 'variant' || (p.variants && p.variants.length > 0)) && (
                          <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg">
                            متغيرات ({p.variants?.length || 0})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                      inCart ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white"
                    )}>
                      {inCart ? <span className="text-xs font-black">{inCart.quantity}</span> : <Plus className="w-4 h-4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Receipts */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <h3 className="font-black text-slate-900">سجل فواتير التوريد</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <th className="px-6 py-4">الفاتورة</th>
                    <th className="px-6 py-4">المورد</th>
                    <th className="px-6 py-4">الإجمالي</th>
                    <th className="px-6 py-4">الحالة</th>
                    <th className="px-6 py-4">المتبقي</th>
                    <th className="px-6 py-4">التاريخ</th>
                    <th className="px-6 py-4">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-50">
                  {recentReceipts.map(receipt => {
                    const receiptPayments = getReceiptPayments(receipt.id);
                    const totalPaid = receiptPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0) + (receipt.paidAmount || 0);
                    const receiptRemaining = Math.max(0, (receipt.total || 0) - totalPaid);
                    const isFullyPaid = receiptRemaining <= 0 || receipt.paymentType === 'paid';
                    return (
                      <React.Fragment key={receipt.id}>
                        <tr className={cn("hover:bg-slate-50/50 transition-colors", expandedRow === receipt.id && "bg-blue-50/20")}>
                          <td className="px-6 py-4">
                            <p className="font-mono text-xs text-slate-400">#{receipt.id.slice(0, 8)}</p>
                            {receipt.invoiceNumber && <p className="text-xs font-bold text-slate-600">{receipt.invoiceNumber}</p>}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">{receipt.supplierName || '—'}</td>
                          <td className="px-6 py-4 font-black text-blue-600">{formatCurrency(receipt.total || 0)}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-black",
                              receipt.paymentType === 'paid' || isFullyPaid
                                ? "bg-green-50 text-green-600"
                                : "bg-amber-50 text-amber-600"
                            )}>
                              {receipt.paymentType === 'paid' || isFullyPaid ? '✓ مدفوع' : '⏳ آجل'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {receiptRemaining > 0 && receipt.paymentType === 'credit' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-red-500">{formatCurrency(receiptRemaining)}</span>
                                <button
                                  onClick={() => setShowPaymentModal(receipt.id)}
                                  className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                  title="تسجيل دفعة"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs">{receipt.invoiceDate || new Date(receipt.createdAt).toLocaleDateString('ar-EG')}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setExpandedRow(expandedRow === receipt.id ? null : receipt.id)}
                                className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 transition-all"
                                title="عرض التفاصيل"
                              >
                                {expandedRow === receipt.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleEdit(receipt)}
                                className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                                title="تعديل"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Row: Items + Payments */}
                        <AnimatePresence>
                          {expandedRow === receipt.id && (
                            <tr className="bg-slate-50/30">
                              <td colSpan={7} className="px-6 py-5">
                                <div className="space-y-4">
                                  {/* Items */}
                                  <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">الأصناف</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                      {(receipt.items || []).map((item: any, idx: number) => (
                                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                                          <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 flex-shrink-0">
                                            <Package className="w-4 h-4" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-black text-slate-900 truncate">{getCleanName(item.productName)}</p>
                                            <p className="text-[10px] font-bold text-slate-400">الكمية: {item.quantity} × {formatCurrency(item.cost || 0)}</p>
                                            {(() => {
                                              const variantInfo = item.variant || parseVariantFromName(item.productName);
                                              if (variantInfo) {
                                                return (
                                                  <div className="flex gap-1.5 mt-1">
                                                    {variantInfo.size && (
                                                      <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-bold">
                                                        مقاس: {variantInfo.size}
                                                      </span>
                                                    )}
                                                    {variantInfo.color && (
                                                      <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                                                        لون: {variantInfo.color}
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })()}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Payments log */}
                                  {receipt.paymentType === 'credit' && (
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">سجل الدفعات</p>
                                        <button
                                          onClick={() => setShowPaymentModal(receipt.id)}
                                          className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-full hover:bg-green-100 transition-colors flex items-center gap-1"
                                        >
                                          <Plus className="w-3 h-3" /> إضافة دفعة
                                        </button>
                                      </div>
                                      {receiptPayments.length === 0 ? (
                                        <p className="text-xs text-slate-300 font-bold italic">لا توجد دفعات مسجلة</p>
                                      ) : (
                                        <div className="space-y-2">
                                          {receiptPayments.map((pay: any) => (
                                            <div key={pay.id} className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-100">
                                              <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                <span className="text-xs font-bold text-slate-600">{pay.method === 'cash' ? 'نقداً' : pay.method === 'bank' ? 'تحويل' : 'شيك'}</span>
                                                {pay.notes && <span className="text-[10px] text-slate-400">{pay.notes}</span>}
                                              </div>
                                              <div className="flex items-center gap-3">
                                                <span className="text-[10px] text-slate-400">{pay.paidDate ? new Date(pay.paidDate).toLocaleDateString('ar-EG') : '—'}</span>
                                                <span className="text-sm font-black text-green-600">{formatCurrency(pay.amount)}</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {/* Summary */}
                                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-white rounded-xl p-2 border border-slate-100">
                                          <p className="text-[10px] font-black text-slate-400">الإجمالي</p>
                                          <p className="text-xs font-black text-blue-600">{formatCurrency(receipt.total || 0)}</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-2 border border-slate-100">
                                          <p className="text-[10px] font-black text-slate-400">مدفوع</p>
                                          <p className="text-xs font-black text-green-600">{formatCurrency(totalPaid)}</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-2 border border-slate-100">
                                          <p className="text-[10px] font-black text-slate-400">متبقي</p>
                                          <p className={cn("text-xs font-black", receiptRemaining > 0 ? "text-red-500" : "text-green-600")}>{formatCurrency(receiptRemaining)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                  {recentReceipts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-slate-300 font-bold italic text-sm">لا توجد فواتير توريد مسجلة حتى الآن</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSupplierModal && (
          <SupplierModal
            supplier={editingSupplier}
            onClose={() => { setShowSupplierModal(false); setEditingSupplier(null); }}
            onSave={handleSaveSupplier}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentModal && (
          <AddPaymentModal
            receiptId={showPaymentModal}
            remaining={
              (() => {
                const rec = recentReceipts.find(r => r.id === showPaymentModal);
                if (!rec) return 0;
                const paid = getReceiptPayments(showPaymentModal).reduce((s: number, p: any) => s + (p.amount || 0), 0) + (rec.paidAmount || 0);
                return Math.max(0, (rec.total || 0) - paid);
              })()
            }
            onClose={() => setShowPaymentModal(null)}
            onSaved={() => { /* data auto-refreshes via onSnapshot */ }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {variantSelectorProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-900">توريد خيارات ومتغيرات الصنف</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">{variantSelectorProduct.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVariantSelectorProduct(null)}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors font-bold cursor-pointer focus:outline-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
                {(!variantSelectorProduct.variants || variantSelectorProduct.variants.length === 0) ? (
                  <div className="text-center py-12 px-6">
                    <div className="w-16 h-16 bg-amber-50 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-black text-slate-800 mb-2">لم يتم إضافة المتغيرات بعد</h4>
                    <p className="text-sm text-slate-400 font-bold leading-relaxed">
                      هذا الصنف محدد كـ «صنف بمتغيرات» ولكن لم يتم إضافة المقاسات والألوان له بعد.<br />
                      يرجى الذهاب إلى <strong className="text-blue-600">إدارة المنتجات → تعديل الصنف</strong> وإضافة المتغيرات أولاً.
                    </p>
                    <button
                      type="button"
                      onClick={() => setVariantSelectorProduct(null)}
                      className="mt-6 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-all"
                    >
                      حسناً، سأعود لإضافة المتغيرات
                    </button>
                  </div>
                ) : (
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-4 py-3">المقاس / اللون</th>
                        <th className="px-4 py-3 text-center">المخزون الحالي</th>
                        <th className="px-4 py-3 text-center">سعر التكلفة</th>
                        <th className="px-4 py-3 text-center">الكمية الموردة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {variantSelectorProduct.variants?.map((v, index) => {
                        return (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-mono">{v.size || '-'}</span>
                                <span className="text-slate-800">{v.color || 'بدون لون'}</span>
                              </div>
                              {v.sku && <div className="text-[9px] text-slate-400 font-mono mt-0.5">{v.sku}</div>}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-500 font-mono">
                              {v.quantity || 0}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                value={localVariantCosts[index] !== undefined ? localVariantCosts[index] : (variantSelectorProduct.costPrice || 0)}
                                onChange={e => setLocalVariantCosts({ ...localVariantCosts, [index]: Number(e.target.value) })}
                                className="w-20 text-center font-bold bg-white border border-slate-200 rounded-lg py-1 px-1.5 focus:ring-2 focus:ring-blue-100 outline-none text-xs"
                                min={0}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                value={localVariantQuantities[index] !== undefined ? localVariantQuantities[index] : 0}
                                onChange={e => setLocalVariantQuantities({ ...localVariantQuantities, [index]: Number(e.target.value) })}
                                className="w-16 text-center font-black bg-white border border-slate-200 rounded-lg py-1 px-1.5 focus:ring-2 focus:ring-blue-100 outline-none text-blue-600 text-xs"
                                min={0}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>

              <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setVariantSelectorProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all"
                >
                  إلغاء
                </button>
                {variantSelectorProduct.variants && variantSelectorProduct.variants.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddMultipleVariants}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                  >
                    تأكيد وإضافة الأصناف
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
