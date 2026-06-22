import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Database,
  Building2,
  Package,
  ArrowRightLeft,
  Search,
  Box,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Warehouse, Product, InventoryTransaction } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { useRecordNavigatorStore } from '../../store/recordNavigatorStore';
import { useBranchFilter } from '../../hooks/useBranchFilter';

export default function WarehouseDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recordNav = useRecordNavigatorStore();
  const restrictedBranchId = useBranchFilter();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransaction[]>([]);
  const [transferReceipts, setTransferReceipts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch All Warehouses for Navigation
        const wSnap = await getDocs(query(collection(db, 'warehouses')));
        let wList = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
        if (!wList.some(w => w.id === '1')) {
          wList.unshift({
            id: '1',
            name: 'المخزن الرئيسي (Main Warehouse)',
            code: 'MAIN',
            isActive: true,
            type: 'MAIN'
          } as any);
        }

        // Filter to restricted branch only if needed
        const allowedWarehouses = restrictedBranchId
          ? wList.filter(w => w.id === restrictedBranchId)
          : wList;
        setWarehouses(allowedWarehouses);

        // 2. If cashier tries to access a warehouse they're not allowed — redirect
        if (restrictedBranchId && id !== restrictedBranchId) {
          navigate(`/inventory/warehouses/${restrictedBranchId}`, { replace: true });
          return;
        }

        // 3. Set Current Warehouse
        const currentWh = wList.find(w => w.id === id);
        if (currentWh) {
          setWarehouse(currentWh);
        } else {
          const wDoc = await getDoc(doc(db, 'warehouses', id!));
          if (wDoc.exists()) {
            setWarehouse({ id: wDoc.id, ...wDoc.data() } as Warehouse);
          }
        }

        // 4. Fetch Products
        const pSnap = await getDocs(query(collection(db, 'products')));
        const pDocs = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        setProducts(pDocs);

        // 5. Fetch Transfers
        const tSnap = await getDocs(query(collection(db, 'inventory_transactions')));
        const tDocs = tSnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryTransaction));
        setTransfers(tDocs);

        // 5b. Fetch Transfer Receipts
        let trList: any[] = [];
        try {
          const trSnap = await getDocs(collection(db, 'transfer_receipts'));
          trList = trSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn("No transfer receipts collection:", e);
        }
        setTransferReceipts(trList);

        // 6. Fetch Orders (Invoices) to deduct sold quantities
        const oSnap = await getDocs(query(collection(db, 'orders')));
        const oDocs = oSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrders(oDocs);

        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'warehouse_details');
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, restrictedBranchId]);

  const selectedIndex = warehouses.findIndex(w => w.id === id);
  const goToWarehouse = (index: number) => {
    const target = warehouses[index];
    if (target) {
      navigate(`/inventory/warehouses/${target.id}`);
    }
  };

  useEffect(() => {
    // Only show navigator if there is more than one warehouse to navigate
    if (warehouse && warehouses.length > 1) {
      recordNav.register({
        currentIndex: selectedIndex >= 0 ? selectedIndex : 0,
        total: warehouses.length,
        label: 'المستودع الحالي',
        onFirst: () => goToWarehouse(0),
        onPrevious: () => goToWarehouse(Math.max(0, selectedIndex - 1)),
        onNext: () => goToWarehouse(Math.min(warehouses.length - 1, selectedIndex + 1)),
        onLast: () => goToWarehouse(warehouses.length - 1)
      });
    } else {
      recordNav.unregister();
    }
    return () => {
      recordNav.unregister();
    };
  }, [warehouse, selectedIndex, warehouses.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Database className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <h2 className="text-2xl font-bold">المستودع غير موجود</h2>
        <Link to="/inventory/warehouses" className="text-blue-600 hover:underline mt-2 inline-block">العودة للمستودعات</Link>
      </div>
    );
  }

  const isMain = (warehouse as any).type === 'MAIN' || warehouse.id === '1';

  // Calculate stock
  const calculateStock = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;

    if (isMain) {
      // Main warehouse: product.quantity is now updated immediately when transfer is created (as PENDING)
      return product.quantity || 0;
    } else {
      // Branch warehouse stock = sum of RECEIVED transfer receipts TO this branch - transfers FROM this branch - Sold quantities + completed adjustments
      const receiptsToBranch = transferReceipts.filter(
        tr => (tr.status === 'RECEIVED' || tr.status === 'PARTIALLY_RECEIVED') && tr.toWarehouseId === warehouse.id
      );
      let incomingStock = 0;
      receiptsToBranch.forEach(tr => {
        const item = tr.items?.find((i: any) => i.productId === productId);
        if (item) incomingStock += Number(item.receivedQty) || 0;
      });

      const transfersFromBranch = transfers.filter(
        t => t.type === 'TRANSFER' && (t.status === 'COMPLETED' || t.status === 'SHIPPED') && t.fromWarehouseId === warehouse.id
      );
      let outgoingTransfers = 0;
      transfersFromBranch.forEach(t => {
        const item = t.items?.find(i => i.productId === productId);
        if (item) outgoingTransfers += item.quantity;
      });

      const outgoingStock = orders
        .filter(inv => inv.branchId === warehouse.id && inv.customerId !== 'EXPENSE' && (inv.status === 'COMPLETED' || !inv.status))
        .reduce((sum, inv) => {
          const item = inv.items?.find((i: any) => i.productId === productId);
          return sum + (item?.quantity || 0);
        }, 0);

      const adjustmentsInBranch = transfers.filter(
        t => t.type === 'ADJUSTMENT' && t.status === 'COMPLETED' && t.fromWarehouseId === warehouse.id
      );
      let adjustmentDelta = 0;
      adjustmentsInBranch.forEach(t => {
        const item = t.items?.find(i => i.productId === productId);
        if (item) adjustmentDelta += item.quantity;
      });

      return Math.max(0, incomingStock - outgoingTransfers - outgoingStock + adjustmentDelta);
    }
  };

  // Filter products that actually have stock in this warehouse
  const productsInStock = products
    .map(p => ({
      ...p,
      currentStock: calculateStock(p.id)
    }))
    .filter(p => isMain || p.currentStock > 0); // Show all for Main (or just >0), but for branch only show >0

  const filteredProducts = productsInStock.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.barcode && String(p.barcode).includes(searchQuery))
  );

  return (
    <div className="space-y-10" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          {/* Only show the "back" link if user can see the warehouses list */}
          {!restrictedBranchId && (
            <Link to="/inventory/warehouses" className="inline-flex items-center gap-2 text-blue-600 font-bold mb-4 hover:underline">
              <ArrowRight className="w-4 h-4" />
              العودة للمستودعات
            </Link>
          )}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              {isMain ? <Database className="w-8 h-8" /> : <Building2 className="w-8 h-8" />}
            </div>
            <div>
              <h2 className="text-4xl font-black text-gray-900 tracking-tight">{warehouse.name}</h2>
              <p className="text-gray-500 mt-1 font-medium flex items-center gap-2">
                <span className="px-2 py-0.5 bg-gray-100 rounded-md text-sm font-bold text-gray-600 uppercase tracking-widest">
                  {isMain ? 'المركز الرئيسي' : 'مخزن فرعي'}
                </span>
                • قائمة المنتجات المتاحة
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <input 
            type="text"
            placeholder="بحث في المنتجات..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full md:w-80 bg-white border border-gray-200 rounded-2xl px-6 py-4 pr-12 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-bold shadow-sm"
          />
          <Search className="w-5 h-5 text-gray-400 absolute right-5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">إجمالي الأصناف</p>
            <p className="text-2xl font-black text-gray-900">{productsInStock.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">إجمالي القطع المتوفرة</p>
            <p className="text-2xl font-black text-gray-900">
              {productsInStock.reduce((acc, curr) => acc + curr.currentStock, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-6 text-sm font-black text-gray-400 uppercase tracking-widest text-right">اسم المنتج</th>
                <th className="px-6 py-6 text-sm font-black text-gray-400 uppercase tracking-widest text-center">الكمية (Stock)</th>
                <th className="px-6 py-6 text-sm font-black text-gray-400 uppercase tracking-widest text-center">سعر البيع (Unit Price)</th>
                <th className="px-6 py-6 text-sm font-black text-gray-400 uppercase tracking-widest text-left">إجمالي القيمة (Value)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-gray-400 font-bold">
                    لا توجد منتجات في هذا المخزن
                  </td>
                </tr>
              ) : filteredProducts.map((product, index) => (
                <motion.tr 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={product.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-4">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-xl object-cover border border-gray-100" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900">{product.name}</p>
                        <p className="text-sm font-bold text-gray-400 tracking-widest uppercase mt-0.5">{product.barcode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg font-black text-gray-900 leading-none">{product.currentStock}</span>
                      <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">قطعة</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className="text-sm font-black text-blue-600">{formatCurrency(product.sellingPrice)}</span>
                  </td>
                  <td className="px-6 py-6 text-left">
                    <span className="text-lg font-black text-gray-900 tracking-tighter">{formatCurrency(product.currentStock * product.sellingPrice)}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


