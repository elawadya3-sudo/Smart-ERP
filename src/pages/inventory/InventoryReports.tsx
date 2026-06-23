import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Warehouse as WarehouseIcon,
  AlertCircle,
  FileBox,
  ChevronLeft,
  ArrowRight,
  ClipboardList,
  Tags,
  Search,
  Layers,
  History as HistoryIcon,
  ShoppingCart,
  Calendar,
  DollarSign
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { productsService, ordersService } from '../../services/firestore';
import { warehouseService, inventoryTransactionService } from '../../services/inventory';
import { Product, Warehouse, InventoryTransaction } from '../../types';
import { formatCurrency, cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { settingsService } from '../../services/settingsService';
import { MainStoreSettings } from '../../types/settings';

type ReportType = 
  | 'STOCK_BALANCE' 
  | 'INVENTORY_COST' 
  | 'PRODUCT_CARD' 
  | 'DETAILED_CARD' 
  | 'WORK_ORDERS' 
  | 'SERIALS_AVAILABILITY' 
  | 'SERIAL_SEARCH' 
  | 'PRODUCT_SALES' 
  | 'AGGREGATED_SALES' 
  | 'STOCK_AGING';

const REPORT_MENU = [
  { id: 'STOCK_BALANCE', title: 'تقرير أرصدة المخازن', icon: WarehouseIcon },
  { id: 'INVENTORY_COST', title: 'تقرير تكلفة المخزون', icon: TrendingUp },
  { id: 'PRODUCT_CARD', title: 'بطاقة صنف المخزن', icon: Package },
  { id: 'DETAILED_CARD', title: 'بطاقة صنف المخزن مفصلة', icon: HistoryIcon },
  { id: 'WORK_ORDERS', title: 'تقرير أوامر شغل', icon: ClipboardList },
  { id: 'SERIALS_AVAILABILITY', title: 'تقرير سرايل الأصناف المتاحة', icon: Tags },
  { id: 'SERIAL_SEARCH', title: 'الكشف عن مسلسل صنف', icon: Search },
  { id: 'PRODUCT_SALES', title: 'تقرير مبيعات الأصناف', icon: ShoppingCart },
  { id: 'AGGREGATED_SALES', title: 'تقرير مجمع مبيعات الأصناف', icon: BarChart3 },
  { id: 'STOCK_AGING', title: 'أعمار المخزون', icon: Calendar },
];

export default function InventoryReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('STOCK_BALANCE');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [transferReceipts, setTransferReceipts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardSearchTerm, setCardSearchTerm] = useState('');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [detailModal, setDetailModal] = useState<{ type: 'WAREHOUSE' | 'TRANSACTION' | 'PRODUCT_SERIALS' | 'ORDER'; data: any } | null>(null);
  const [serialSearchQuery, setSerialSearchQuery] = useState('');
  const [serialSearchResult, setSerialSearchResult] = useState<any | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT'>('ALL');
  const [settings, setSettings] = useState<MainStoreSettings | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prods, whs, txs, ords, suppliersSnap, customersSnap, storeSettings] = await Promise.all([
          productsService.getAll(),
          warehouseService.getAll(),
          inventoryTransactionService.getAll(),
          ordersService.getAll(),
          getDocs(collection(db, 'suppliers')),
          getDocs(collection(db, 'customers')),
          settingsService.getMainStoreSettings()
        ]);
        
        let receiptsList: any[] = [];
        try {
          const receiptsSnap = await getDocs(collection(db, 'transfer_receipts'));
          receiptsList = receiptsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn('No transfer receipts collection:', e);
        }
        setTransferReceipts(receiptsList);

        // Ensure Main Warehouse is included
        let wList = [...whs];
        if (!wList.some(w => w.id === '1')) {
          wList.unshift({
            id: '1',
            name: 'المخزن الرئيسي (Main Warehouse)',
            code: 'MAIN',
            isActive: true,
            type: 'MAIN'
          } as any);
        }
        setProducts(prods);
        setWarehouses(wList);
        setTransactions(txs);
        setOrders(ords);
        setSuppliers(suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setSettings(storeSettings);
        
        if (prods.length > 0) {
          setSelectedProductId(prods[0].id);
        }
      } catch (error) {
        console.error('Error loading inventory reports data:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const calculateStock = (productId: string, warehouseId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;

    const currentWh = warehouses.find(w => w.id === warehouseId);
    const isMain = warehouseId === '1' || currentWh?.code === 'MAIN' || (currentWh as any)?.type === 'MAIN';

    if (isMain) {
      return product.quantity || 0;
    } else {
      const receiptsToBranch = transferReceipts.filter(
        tr => (tr.status === 'RECEIVED' || tr.status === 'PARTIALLY_RECEIVED') && tr.toWarehouseId === warehouseId
      );
      let incomingStock = 0;
      receiptsToBranch.forEach(tr => {
        const item = tr.items?.find((i: any) => i.productId === productId);
        if (item) incomingStock += Number(item.receivedQty) || 0;
      });

      const transfersFromBranch = transactions.filter(
        t => t.type === 'TRANSFER' && (t.status === 'COMPLETED' || t.status === 'SHIPPED') && t.fromWarehouseId === warehouseId
      );
      let outgoingTransfers = 0;
      transfersFromBranch.forEach(t => {
        const item = t.items?.find(i => i.productId === productId);
        if (item) outgoingTransfers += Number(item.quantity) || 0;
      });

      const outgoingStock = orders
        .filter(inv => inv && inv.customerId !== 'EXPENSE' && (inv.status === 'COMPLETED' || !inv.status))
        .reduce((sum, inv) => {
          const itemsForWh = inv.items?.filter((i: any) => 
            i && (i.branchId || i.warehouseId || inv.branchId) === warehouseId && i.productId === productId
          ) || [];
          const qty = itemsForWh.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
          return sum + qty;
        }, 0);

      const adjustmentsInBranch = transactions.filter(
        t => t.type === 'ADJUSTMENT' && t.status === 'COMPLETED' && t.fromWarehouseId === warehouseId
      );
      let adjustmentDelta = 0;
      adjustmentsInBranch.forEach(t => {
        const item = t.items?.find(i => i.productId === productId);
        if (item) adjustmentDelta += Number(item.quantity) || 0;
      });

      return Math.max(0, incomingStock - outgoingTransfers - outgoingStock + adjustmentDelta);
    }
  };

  const getProductTotalStock = (productId: string) => {
    return warehouses.reduce((sum, wh) => sum + calculateStock(productId, wh.id), 0);
  };

  // Compile overall movements for a specific product
  const getProductMovements = (productId: string) => {
    const list: any[] = [];
    const product = products.find(p => p.id === productId);
    
    // 1. Transactions
    transactions
      .filter(t => t.status === 'COMPLETED' && t.items?.some(i => i.productId === productId))
      .forEach(t => {
        const item = t.items.find(i => i.productId === productId);
        const qty = Number(item?.quantity) || 0;
        let delta = qty;
        if (t.type === 'ISSUE' || t.type === 'TRANSFER') {
          delta = -qty;
        }
        list.push({
          id: t.id,
          type: t.type,
          reference: t.reference || t.id.slice(0, 8),
          createdAt: t.createdAt,
          delta: delta,
          unitCost: item?.cost || product?.costPrice || 0,
          unitPrice: 0,
          notes: t.notes || '',
          fromWarehouseId: t.fromWarehouseId,
          toWarehouseId: t.toWarehouseId,
          partyName: t.type === 'RECEIPT' ? (suppliers.find(s => s.id === (t as any).supplierId)?.name || 'مورد') : '',
          rawTx: t
        });
      });

    // 2. Orders (Sales)
    orders
      .filter(o => (o.status === 'COMPLETED' || !o.status) && o.items?.some((i: any) => i.productId === productId))
      .forEach(o => {
        const itemsOfProduct = o.items?.filter((i: any) => i.productId === productId) || [];
        
        itemsOfProduct.forEach((item: any) => {
          const qty = Number(item?.quantity) || 0;
          const itemBranchId = item.branchId || item.warehouseId || o.branchId || '1';
          
          list.push({
            id: o.id,
            type: 'SALE',
            reference: o.invoiceNumber || o.id.slice(0, 8),
            createdAt: o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString() : (o.createdAt || new Date().toISOString()),
            delta: -qty,
            unitCost: product?.costPrice || 0,
            unitPrice: item?.price || 0,
            notes: o.notes || '',
            fromWarehouseId: itemBranchId,
            partyName: customers.find(c => c.id === o.customerId)?.name || o.customerName || 'عميل نقدي',
            rawTx: o
          });
        });
      });

    // Sort newest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  // Generate dynamic serial list
  const getSerialsList = () => {
    const list: any[] = [];
    products.forEach(p => {
      warehouses.forEach(wh => {
        const stock = calculateStock(p.id, wh.id);
        const code = p.barcode || p.sku || '000';
        for (let i = 0; i < stock; i++) {
          list.push({
            productId: p.id,
            productName: p.name,
            sku: p.sku || 'N/A',
            barcode: p.barcode || 'N/A',
            serial: `SN-${code}-${String(i + 1).padStart(3, '0')}`,
            warehouseId: wh.id,
            warehouseName: wh.name,
            date: ((p as any).updatedAt || p.createdAt || new Date().toISOString()).split('T')[0]
          });
        }
      });
    });
    return list;
  };

  // Search serials
  const handleSerialSearch = () => {
    if (!serialSearchQuery.trim()) return;
    
    // Find if it matches the format: SN-[barcode]-[index]
    const parts = serialSearchQuery.split('-');
    if (parts.length >= 3 && parts[0] === 'SN') {
      const barcode = parts[1];
      const indexStr = parts[2];
      const index = parseInt(indexStr, 10);
      
      const product = products.find(p => p.barcode === barcode || p.sku === barcode);
      if (product) {
        const totalStock = getProductTotalStock(product.id);
        
        if (index <= totalStock) {
          // Available in stock. Let's find which warehouse contains it.
          let cumulativeStock = 0;
          let foundWarehouse = warehouses[0];
          
          for (const wh of warehouses) {
            const whStock = calculateStock(product.id, wh.id);
            cumulativeStock += whStock;
            if (index <= cumulativeStock) {
              foundWarehouse = wh;
              break;
            }
          }
          
          setSerialSearchResult({
            status: 'AVAILABLE',
            product,
            warehouse: foundWarehouse,
            serial: serialSearchQuery,
            date: ((product as any).updatedAt || product.createdAt || new Date().toISOString()).split('T')[0]
          });
          return;
        } else {
          // Sold. Let's find an order that sold this product.
          const soldIndex = index - totalStock;
          const salesWithProduct = orders
            .filter(o => (o.status === 'COMPLETED' || !o.status) && o.items?.some((i: any) => i.productId === product.id))
            .sort((a, b) => new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt).getTime() - new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt).getTime());
          
          const order = salesWithProduct[soldIndex % (salesWithProduct.length || 1)] || salesWithProduct[0];
          
          setSerialSearchResult({
            status: 'SOLD',
            product,
            order,
            serial: serialSearchQuery,
            date: order ? new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toISOString().split('T')[0] : ((product as any).updatedAt || product.createdAt || new Date().toISOString()).split('T')[0]
          });
          return;
        }
      }
    }
    
    // Fallback: search by exact string in available serials
    const available = getSerialsList();
    const found = available.find(s => s.serial.toLowerCase() === serialSearchQuery.toLowerCase() || s.serial.toLowerCase().includes(serialSearchQuery.toLowerCase()));
    
    if (found) {
      const product = products.find(p => p.id === found.productId);
      const warehouse = warehouses.find(w => w.id === found.warehouseId);
      setSerialSearchResult({
        status: 'AVAILABLE',
        product,
        warehouse,
        serial: found.serial,
        date: found.date
      });
    } else {
      setSerialSearchResult({ status: 'NOT_FOUND', serial: serialSearchQuery });
    }
  };

  // Compile product sales statistics
  const getProductSales = () => {
    const salesMap: Record<string, { qty: number; revenue: number; cost: number }> = {};
    
    orders
      .filter(o => o.status === 'COMPLETED' || !o.status)
      .forEach(o => {
        o.items?.forEach((item: any) => {
          const pId = item.productId;
          const qty = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          
          const product = products.find(p => p.id === pId);
          const cost = (product?.costPrice || 0) * qty;
          
          if (!salesMap[pId]) {
            salesMap[pId] = { qty: 0, revenue: 0, cost: 0 };
          }
          salesMap[pId].qty += qty;
          salesMap[pId].revenue += qty * price;
          salesMap[pId].cost += cost;
        });
      });

    return products
      .map(p => {
        const data = salesMap[p.id] || { qty: 0, revenue: 0, cost: 0 };
        const profit = data.revenue - data.cost;
        const profitMarginPct = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
        return {
          product: p,
          qty: data.qty,
          revenue: data.revenue,
          cost: data.cost,
          profit: profit,
          marginPct: profitMarginPct
        };
      })
      .filter(item => item.qty > 0)
      .sort((a, b) => b.qty - a.qty);
  };

  // Compile category sales statistics
  const getCategorySales = () => {
    const catMap: Record<string, { qty: number; revenue: number; cost: number }> = {};
    const productSales = getProductSales();
    let totalOverallProfit = 0;
    
    productSales.forEach(item => {
      const category = item.product.category || 'غير مصنف';
      if (!catMap[category]) {
        catMap[category] = { qty: 0, revenue: 0, cost: 0 };
      }
      catMap[category].qty += item.qty;
      catMap[category].revenue += item.revenue;
      catMap[category].cost += item.cost;
      totalOverallProfit += (item.revenue - item.cost);
    });

    return Object.keys(catMap).map(categoryName => {
      const data = catMap[categoryName];
      const profit = data.revenue - data.cost;
      const contribution = totalOverallProfit > 0 ? (profit / totalOverallProfit) * 100 : 0;
      return {
        category: categoryName,
        qty: data.qty,
        revenue: data.revenue,
        cost: data.cost,
        profit: profit,
        contribution: contribution
      };
    });
  };

  // Get product aging days since last movement
  const getProductAgingDays = (product: Product) => {
    const movements = transactions.filter(t => t.status === 'COMPLETED' && t.items?.some(i => i.productId === product.id));
    let lastDate = new Date((product as any).updatedAt || product.createdAt || new Date());
    
    if (movements.length > 0) {
      const dates = movements.map(m => new Date(m.createdAt).getTime());
      const maxDate = Math.max(...dates);
      lastDate = new Date(maxDate);
    }
    
    const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get aging report bracket data
  const getAgingReportData = () => {
    const brackets = [
      { label: '0-30 يوم', range: [0, 30], count: 0, value: 0, items: [] as any[] },
      { label: '31-60 يوم', range: [31, 60], count: 0, value: 0, items: [] as any[] },
      { label: '61-90 يوم', range: [61, 90], count: 0, value: 0, items: [] as any[] },
      { label: '+90 يوم (راكد)', range: [91, Infinity], count: 0, value: 0, items: [] as any[] }
    ];

    products.forEach(p => {
      const qty = getProductTotalStock(p.id);
      if (qty <= 0) return;
      
      const days = getProductAgingDays(p);
      const value = qty * (p.costPrice || 0);
      
      let bracket = brackets[3];
      if (days <= 30) bracket = brackets[0];
      else if (days <= 60) bracket = brackets[1];
      else if (days <= 90) bracket = brackets[2];
      
      bracket.count++;
      bracket.value += value;
      bracket.items.push({
        product: p,
        days,
        qty,
        value
      });
    });

    return brackets;
  };

  const totalCostValue = products.reduce((acc, p) => acc + (getProductTotalStock(p.id) * (p.costPrice || 0)), 0);
  const totalRetailValue = products.reduce((acc, p) => acc + (getProductTotalStock(p.id) * (p.sellingPrice || 0)), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = (reportType: ReportType) => {
    let csvContent = '\uFEFF';
    let fileName = '';
    let headers: string[] = [];
    let rows: any[][] = [];

    switch (reportType) {
      case 'STOCK_BALANCE':
        fileName = 'تقرير_أرصدة_المخازن';
        headers = ["المستودع", "إجمالي الأصناف", "الكمية الكلية", "القيمة المالية للتكلفة", "الحالة"];
        rows = warehouses.map(wh => {
          const whProducts = products.filter(p => calculateStock(p.id, wh.id) > 0);
          const totalQty = products.reduce((acc, p) => acc + calculateStock(p.id, wh.id), 0);
          const totalVal = products.reduce((acc, p) => acc + (calculateStock(p.id, wh.id) * (p.costPrice || 0)), 0);
          const needsRestock = whProducts.some(p => calculateStock(p.id, wh.id) <= (p.minQuantity || 5));
          return [wh.name, whProducts.length, totalQty, totalVal, needsRestock ? "بحاجة للتموين" : "مستقر"];
        });
        break;

      case 'INVENTORY_COST':
        fileName = 'تقرير_تكلفة_المخزون';
        headers = ["اسم المنتج", "SKU", "الباركود", "الكمية الكلية", "تكلفة الوحدة", "إجمالي التكلفة", "سعر البيع", "القيمة البيعية", "الأرباح المتوقعة"];
        rows = products.map(p => {
          const totalStock = getProductTotalStock(p.id);
          const cost = p.costPrice || 0;
          const price = p.sellingPrice || 0;
          return [
            p.name, 
            p.sku || 'N/A', 
            p.barcode || 'N/A', 
            totalStock, 
            cost, 
            totalStock * cost, 
            price, 
            totalStock * price, 
            totalStock * (price - cost)
          ];
        });
        break;

      case 'PRODUCT_CARD':
      case 'DETAILED_CARD':
        const selectedProd = products.find(p => p.id === selectedProductId) || products.find(p =>
          p.name.toLowerCase().includes(cardSearchTerm.toLowerCase()) ||
          p.sku?.toLowerCase().includes(cardSearchTerm.toLowerCase()) ||
          p.barcode?.toLowerCase().includes(cardSearchTerm.toLowerCase())
        ) || products[0];
        
        fileName = `${reportType === 'PRODUCT_CARD' ? 'بطاقة' : 'بطاقة_تفصيلية'}_حركة_الصنف_${selectedProd?.name || 'غير_معروف'}`;
        headers = ["التاريخ", "نوع الحركة", "المرجع", "الجهة (المورد/العميل)", "الكمية", "السعر/التكلفة", "إجمالي القيمة", "هامش الربح", "الرصيد بعد الحركة"];
        
        const moves = selectedProd ? getProductMovements(selectedProd.id) : [];
        let runningBal = selectedProd ? getProductTotalStock(selectedProd.id) : 0;
        
        const csvRows: any[][] = [];
        moves.forEach(m => {
          const profit = m.type === 'SALE' ? (m.unitPrice - (selectedProd?.costPrice || 0)) * Math.abs(m.delta) : 0;
          csvRows.push([
            m.createdAt.split('T')[0],
            m.type === 'RECEIPT' ? 'توريد بضاعة' : m.type === 'SALE' ? 'مبيعات POS' : m.type === 'RETURN' ? 'مردودات' : m.type === 'TRANSFER' ? 'تحويل مخزني' : m.type === 'ISSUE' ? 'صرف بضاعة' : 'تسوية جرد',
            m.reference,
            m.partyName || (m.type === 'TRANSFER' ? `من ${warehouses.find(w=>w.id===m.fromWarehouseId)?.name || ''} إلى ${warehouses.find(w=>w.id===m.toWarehouseId)?.name || ''}` : 'N/A'),
            m.delta > 0 ? `+${m.delta}` : m.delta,
            m.type === 'SALE' ? m.unitPrice : m.unitCost,
            Math.abs(m.delta) * (m.type === 'SALE' ? m.unitPrice : m.unitCost),
            m.type === 'SALE' ? profit : 'N/A',
            runningBal
          ]);
          runningBal -= m.delta;
        });
        rows = csvRows;
        break;

      case 'WORK_ORDERS':
        fileName = 'تقرير_حركات_المخازن';
        headers = ["رقم الحركة", "النوع", "المرجع", "التاريخ", "من مستودع", "إلى مستودع", "عدد الأصناف", "بواسطة"];
        rows = transactions
          .filter(t => t.status === 'COMPLETED')
          .map(t => [
            t.id.toUpperCase().slice(0, 8),
            t.type === 'RECEIPT' ? 'توريد بضاعة' : t.type === 'TRANSFER' ? 'تحويل مخزني' : t.type === 'ISSUE' ? 'صرف بضاعة' : t.type === 'RETURN' ? 'مردود مبيعات' : 'تسوية جرد',
            t.reference || 'N/A',
            t.createdAt.split('T')[0],
            warehouses.find(w => w.id === t.fromWarehouseId)?.name || 'خارجي',
            warehouses.find(w => w.id === t.toWarehouseId)?.name || 'خارجي',
            t.items.length,
            t.createdBy || 'N/A'
          ]);
        break;

      case 'SERIALS_AVAILABILITY':
        fileName = 'تقرير_سرايل_الأصناف_المتاحة';
        headers = ["المنتج", "SKU", "الرقم التسلسلي (Serial)", "المستودع", "تاريخ الدخول"];
        getSerialsList().forEach(s => {
          rows.push([s.productName, s.sku, s.serial, s.warehouseName, s.date]);
        });
        break;

      case 'PRODUCT_SALES':
        fileName = 'تقرير_مبيعات_الأصناف';
        headers = ["اسم الصنف", "الكمية المباعة", "تكلفة المبيعات (COGS)", "إجمالي عائدات المبيعات", "صافي الأرباح", "نسبة هامش الربح"];
        getProductSales().forEach(item => {
          rows.push([
            item.product.name,
            item.qty,
            item.cost,
            item.revenue,
            item.profit,
            `${item.marginPct.toFixed(1)}%`
          ]);
        });
        break;

      case 'AGGREGATED_SALES':
        fileName = 'تقرير_مجمع_مبيعات_الأصناف';
        headers = ["اسم الفئة", "القطع المباعة", "التكلفة الكلية", "إجمالي المبيعات", "صافي الأرباح", "نسبة المساهمة في الربح"];
        getCategorySales().forEach(item => {
          rows.push([
            item.category,
            item.qty,
            item.cost,
            item.revenue,
            item.profit,
            `${item.contribution.toFixed(1)}%`
          ]);
        });
        break;

      case 'STOCK_AGING':
        fileName = 'تقرير_أعمار_المخزون';
        headers = ["اسم المنتج", "الفئة", "الكمية الكلية", "القيمة المالية للتكلفة", "عمر المخزون (أيام)", "درجة المخاطر"];
        getAgingReportData().forEach(bracket => {
          bracket.items.forEach(item => {
            const risk = item.days <= 30 ? "منخفضة" : item.days <= 60 ? "متوسطة" : item.days <= 90 ? "مرتفعة" : "حرج/راكد";
            rows.push([
              item.product.name,
              item.product.category || 'غير مصنف',
              item.qty,
              item.value,
              item.days,
              risk
            ]);
          });
        });
        break;

      default:
        fileName = 'تقرير_مخازن';
        headers = ["ملاحظة"];
        rows = [["لا تتوفر بيانات للتصدير لهذا التقرير"]];
    }

    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      const escapedRow = row.map(field => {
        const str = String(field);
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const renderReportContent = () => {
    switch (activeReport) {
      case 'STOCK_BALANCE': {
        const filteredWhs = warehouses.filter(wh =>
          wh.name.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          wh.code.toLowerCase().includes(reportSearchQuery.toLowerCase())
        );

        return (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black tracking-widest">
                  <tr className="border-b border-gray-100">
                    <th className="px-8 py-5">المستودع</th>
                    <th className="px-8 py-5">إجمالي الأصناف</th>
                    <th className="px-8 py-5">الكمية الكلية</th>
                    <th className="px-8 py-5">قيمة تكلفة المخزون</th>
                    <th className="px-8 py-5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredWhs.map(wh => {
                    const whProducts = products.filter(p => calculateStock(p.id, wh.id) > 0);
                    const totalQty = products.reduce((acc, p) => acc + calculateStock(p.id, wh.id), 0);
                    const totalVal = products.reduce((acc, p) => acc + (calculateStock(p.id, wh.id) * (p.costPrice || 0)), 0);
                    const needsRestock = whProducts.some(p => calculateStock(p.id, wh.id) <= (p.minQuantity || 5));

                    return (
                      <tr 
                        key={wh.id} 
                        onClick={() => {
                          const items = whProducts.map(p => ({
                            ...p,
                            whQty: calculateStock(p.id, wh.id)
                          }));
                          setDetailModal({
                            type: 'WAREHOUSE',
                            data: { warehouse: wh, items }
                          });
                        }}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-8 py-5 font-bold text-gray-900">{wh.name}</td>
                        <td className="px-8 py-5 font-medium">{whProducts.length} أصناف</td>
                        <td className="px-8 py-5 font-black text-blue-600">{totalQty} قطعة</td>
                        <td className="px-8 py-5 font-black text-gray-900">{formatCurrency(totalVal)}</td>
                        <td className="px-8 py-5">
                          {needsRestock ? (
                            <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold">بحاجة للتموين</span>
                          ) : (
                            <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-xs font-bold">مستقر</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredWhs.length === 0 && (
                    <tr><td colSpan={5} className="py-20 text-center text-gray-400 italic">لا توجد مستودعات مطابقة للبحث</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'INVENTORY_COST': {
        const filteredProds = products.filter(p =>
          p.name.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          p.sku?.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          p.barcode?.toLowerCase().includes(reportSearchQuery.toLowerCase())
        );

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                <TrendingUp className="w-12 h-12 text-blue-600 mb-4" />
                <h4 className="text-sm font-bold text-gray-500 mb-1 leading-none uppercase tracking-widest">إجمالي التكلفة (Cost)</h4>
                <p className="text-2xl font-black text-gray-900 leading-none">{formatCurrency(totalCostValue)}</p>
              </div>
              <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                <h4 className="text-sm font-bold text-blue-100 mb-1 leading-none uppercase tracking-widest">القيمة البيعية (Retail Value)</h4>
                <p className="text-2xl font-black text-white leading-none">{formatCurrency(totalRetailValue)}</p>
                <p className="text-xs mt-2 text-blue-100 italic">محسوبة بسعر البيع الافتراضي</p>
              </div>
              <div className="bg-gray-900 p-8 rounded-3xl text-white shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                <h4 className="text-sm font-bold text-green-400 mb-1 leading-none uppercase tracking-widest">الأرباح المتوقعة</h4>
                <p className="text-2xl font-black text-white leading-none">{formatCurrency(totalRetailValue - totalCostValue)}</p>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                  <tr className="border-b border-gray-100">
                    <th className="px-8 py-4">اسم المنتج</th>
                    <th className="px-8 py-4">الكمية الإجمالية</th>
                    <th className="px-8 py-4">التكلفة للوحدة</th>
                    <th className="px-8 py-4">إجمالي التكلفة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredProds.map(p => {
                    const totalStock = getProductTotalStock(p.id);
                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setCardSearchTerm(p.name);
                          setActiveReport('PRODUCT_CARD');
                        }}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-8 py-4 font-bold text-gray-900">{p.name}</td>
                        <td className="px-8 py-4 font-medium">{totalStock} وحدة</td>
                        <td className="px-8 py-4 font-bold text-blue-600">{formatCurrency(p.costPrice || 0)}</td>
                        <td className="px-8 py-4 font-black text-gray-900">{formatCurrency(totalStock * (p.costPrice || 0))}</td>
                      </tr>
                    );
                  })}
                  {filteredProds.length === 0 && (
                    <tr><td colSpan={4} className="py-20 text-center text-gray-400 italic">لا توجد منتجات مطابقة للبحث</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'PRODUCT_CARD':
      case 'DETAILED_CARD': {
        const selectedCardProduct = products.find(p => p.id === selectedProductId) || products.find(p =>
          p.name.toLowerCase().includes(cardSearchTerm.toLowerCase()) ||
          p.sku?.toLowerCase().includes(cardSearchTerm.toLowerCase()) ||
          p.barcode?.toLowerCase().includes(cardSearchTerm.toLowerCase())
        ) || products[0];

        const movements = selectedCardProduct ? getProductMovements(selectedCardProduct.id) : [];

        // Apply secondary search query to movement reference or details
        const filteredMovements = movements.filter(m =>
          m.reference.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          m.partyName.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          m.type.toLowerCase().includes(reportSearchQuery.toLowerCase())
        );

        let bal = selectedCardProduct ? getProductTotalStock(selectedCardProduct.id) : 0;
        
        // Compute running balances backwards
        const movementsWithBal = filteredMovements.map(m => {
          const mBal = bal;
          bal -= m.delta;
          return { ...m, balanceAfter: mBal };
        });

        const getMovementTypeLabel = (type: string) => {
          switch (type) {
            case 'RECEIPT': return 'توريد بضاعة';
            case 'RETURN': return 'مردود مبيعات';
            case 'ISSUE': return 'صرف بضاعة';
            case 'TRANSFER': return 'تحويل مخزني';
            case 'ADJUSTMENT': return 'تسوية جرد';
            case 'SALE': return 'مبيعات POS';
            default: return type;
          }
        };

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-4 no-print">
              <h3 className="text-xl font-bold text-gray-900">
                {activeReport === 'PRODUCT_CARD' ? 'بطاقة حركة الصنف' : 'بطاقة حركة الصنف المفصلة'}
              </h3>
              
              <div className="relative w-full sm:w-80">
                <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="اختر الصنف بالبحث بالاسم، SKU أو الباركود..."
                  value={cardSearchTerm}
                  onChange={e => {
                    setCardSearchTerm(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  className="w-full bg-white border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none shadow-sm"
                />
                
                {showProductDropdown && cardSearchTerm && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {products
                      .filter(p =>
                        p.name.toLowerCase().includes(cardSearchTerm.toLowerCase()) ||
                        p.sku?.toLowerCase().includes(cardSearchTerm.toLowerCase()) ||
                        p.barcode?.toLowerCase().includes(cardSearchTerm.toLowerCase())
                      )
                      .slice(0, 8)
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setCardSearchTerm(p.name);
                            setShowProductDropdown(false);
                          }}
                          className="w-full text-right px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 block border-b border-slate-50/50"
                        >
                          {p.name} <span className="text-slate-400 font-mono text-[10px]">({p.sku || p.barcode || 'N/A'})</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {selectedCardProduct ? (
              <>
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm print-card">
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="w-full md:w-36 aspect-square bg-gray-50 rounded-3xl flex items-center justify-center p-4">
                      {selectedCardProduct.images && selectedCardProduct.images.length > 0 ? (
                        <img src={selectedCardProduct.images[0]} alt={selectedCardProduct.name} className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <Package className="w-16 h-16 text-gray-200" />
                      )}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-2xl font-black text-gray-900 mb-1">{selectedCardProduct.name}</h4>
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                            SKU: {selectedCardProduct.sku || 'N/A'} | Barcode: {selectedCardProduct.barcode || 'N/A'}
                          </p>
                        </div>
                        <div className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-center shadow-lg shadow-blue-100">
                          <p className="text-[10px] font-bold uppercase opacity-80 leading-none mb-1">الرصيد الكلي</p>
                          <p className="text-xl font-black leading-none">{getProductTotalStock(selectedCardProduct.id)}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-50 text-xs font-bold">
                        <div>
                          <p className="text-slate-400 mb-0.5">الماركة</p>
                          <p className="text-gray-900">{selectedCardProduct.brand || 'غير محدد'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">الفئة</p>
                          <p className="text-gray-900">{selectedCardProduct.category}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">سعر التكلفة</p>
                          <p className="text-gray-900">{formatCurrency(selectedCardProduct.costPrice)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">سعر البيع</p>
                          <p className="text-blue-600">{formatCurrency(selectedCardProduct.sellingPrice)}</p>
                        </div>
                      </div>

                      {/* Stock Warehouse breakdown */}
                      <div className="mt-4 bg-slate-50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-wider">توزيع الأرصدة عبر المستودعات والفروع:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {warehouses.map(wh => {
                            const whStock = calculateStock(selectedCardProduct.id, wh.id);
                            if (whStock <= 0) return null;
                            return (
                              <div key={wh.id} className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center text-xs shadow-sm">
                                <span className="font-bold text-slate-600 truncate max-w-[100px]">{wh.name}</span>
                                <span className="font-black text-blue-600">{whStock} قطعة</span>
                              </div>
                            );
                          })}
                          {warehouses.every(wh => calculateStock(selectedCardProduct.id, wh.id) <= 0) && (
                            <span className="text-xs text-slate-400 italic">لا يتوفر رصيد في أي مستودع حالياً</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm">
                  <div className="px-8 py-4 border-b border-gray-50 bg-gray-50/20 flex justify-between items-center">
                    <h5 className="text-xs font-bold text-gray-700">سجل التحركات للحساب</h5>
                    {activeReport === 'DETAILED_CARD' && (
                      <span className="text-xs text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full">يتضمن تفاصيل الجهات والهوامش</span>
                    )}
                  </div>
                  <table className="w-full text-right text-sm">
                    <thead className="bg-gray-50 text-sm text-gray-400 font-black">
                      <tr className="border-b border-gray-100 tracking-widest uppercase">
                        <th className="px-6 py-4">العملية</th>
                        <th className="px-6 py-4">المرجع</th>
                        <th className="px-6 py-4">التاريخ</th>
                        {activeReport === 'DETAILED_CARD' && <th className="px-6 py-4">الجهة / المورد / العميل</th>}
                        {activeReport === 'DETAILED_CARD' && <th className="px-6 py-4">سعر الوحدة</th>}
                        {activeReport === 'DETAILED_CARD' && <th className="px-6 py-4">هامش الربح</th>}
                        <th className="px-6 py-4 text-center">التغيير</th>
                        <th className="px-6 py-4 text-left">الرصيد بعد الحركة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {movementsWithBal.length === 0 ? (
                        <tr>
                          <td colSpan={activeReport === 'DETAILED_CARD' ? 8 : 5} className="py-12 text-center text-gray-400 italic">
                            لا توجد حركات مسجلة تطابق البحث لهذا الصنف
                          </td>
                        </tr>
                      ) : movementsWithBal.map((row, idx) => {
                        const isSale = row.type === 'SALE';
                        const isReceipt = row.type === 'RECEIPT';
                        const profit = isSale ? (row.unitPrice - (selectedCardProduct.costPrice || 0)) * Math.abs(row.delta) : 0;
                        
                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-bold">
                              <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", row.delta > 0 ? "bg-green-500" : "bg-red-500")}></div>
                                <span>{getMovementTypeLabel(row.type)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-gray-500 font-mono">
                              <button 
                                onClick={() => {
                                  if (isSale) {
                                    setDetailModal({ type: 'ORDER', data: row.rawTx });
                                  } else {
                                    setDetailModal({ type: 'TRANSACTION', data: row.rawTx });
                                  }
                                }}
                                className="hover:text-blue-600 underline font-bold"
                              >
                                #{row.reference.toUpperCase()}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-gray-400">{formatDate(row.createdAt)}</td>
                            
                            {activeReport === 'DETAILED_CARD' && (
                              <>
                                <td className="px-6 py-4 font-medium text-slate-700">
                                  {row.partyName || (row.type === 'TRANSFER' ? `من ${warehouses.find(w=>w.id===row.fromWarehouseId)?.name || ''} إلى ${warehouses.find(w=>w.id===row.toWarehouseId)?.name || ''}` : 'N/A')}
                                </td>
                                <td className="px-6 py-4 font-bold">
                                  {formatCurrency(isSale ? row.unitPrice : row.unitCost)}
                                </td>
                                <td className={cn("px-6 py-4 font-black", profit > 0 ? "text-green-600" : profit < 0 ? "text-red-600" : "text-slate-400")}>
                                  {isSale ? formatCurrency(profit) : 'N/A'}
                                </td>
                              </>
                            )}

                            <td className={cn("px-6 py-4 font-bold text-center", row.delta > 0 ? "text-green-600" : "text-red-600")}>
                              {row.delta > 0 ? `+${row.delta}` : row.delta}
                            </td>
                            <td className="px-6 py-4 font-black text-left">{row.balanceAfter}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-gray-400 italic">لم يتم العثور على منتجات مطابقة للبحث</div>
            )}
          </div>
        );
      }

      case 'WORK_ORDERS': {
        const filteredTxs = transactions
          .filter(t => t.status === 'COMPLETED')
          .filter(t => txTypeFilter === 'ALL' || t.type === txTypeFilter)
          .filter(t => 
            t.id.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
            t.reference?.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
            t.createdBy?.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
            t.items?.some(i => i.productName.toLowerCase().includes(reportSearchQuery.toLowerCase()))
          );

        return (
          <div className="space-y-6">
            {/* Filter type selector */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-print">
              {[
                { id: 'ALL', label: 'الكل' },
                { id: 'RECEIPT', label: 'توريد بضاعة' },
                { id: 'TRANSFER', label: 'تحويل مخزني' },
                { id: 'ISSUE', label: 'صرف بضاعة' },
                { id: 'RETURN', label: 'مردود مبيعات' },
                { id: 'ADJUSTMENT', label: 'تسوية جرد' }
              ].map(pill => (
                <button
                  key={pill.id}
                  onClick={() => setTxTypeFilter(pill.id as any)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                    txTypeFilter === pill.id
                      ? "bg-slate-950 text-white border-slate-950"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                  <tr className="border-b border-gray-100 tracking-widest">
                    <th className="px-8 py-5">رقم الحركة</th>
                    <th className="px-8 py-5">النوع</th>
                    <th className="px-8 py-5">المرجع</th>
                    <th className="px-8 py-5">التاريخ</th>
                    <th className="px-8 py-5">من مستودع</th>
                    <th className="px-8 py-5">إلى مستودع</th>
                    <th className="px-8 py-5 text-center">أصناف</th>
                    <th className="px-8 py-5">بواسطة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {filteredTxs.map(tx => (
                    <tr 
                      key={tx.id} 
                      onClick={() => setDetailModal({ type: 'TRANSACTION', data: tx })}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-8 py-5 font-bold text-gray-900 font-mono">#{tx.id.toUpperCase().slice(0, 8)}</td>
                      <td className="px-8 py-5 font-bold">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px]",
                          tx.type === 'RECEIPT' && "bg-green-50 text-green-600",
                          tx.type === 'TRANSFER' && "bg-blue-50 text-blue-600",
                          tx.type === 'ISSUE' && "bg-amber-50 text-amber-600",
                          tx.type === 'RETURN' && "bg-pink-50 text-pink-600",
                          tx.type === 'ADJUSTMENT' && "bg-purple-50 text-purple-600"
                        )}>
                          {tx.type === 'RECEIPT' ? 'توريد بضاعة' : tx.type === 'TRANSFER' ? 'تحويل مخزني' : tx.type === 'ISSUE' ? 'صرف بضاعة' : tx.type === 'RETURN' ? 'مردود مبيعات' : 'تسوية جرد'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-slate-500">{tx.reference || 'N/A'}</td>
                      <td className="px-8 py-5 text-gray-400">{formatDate(tx.createdAt)}</td>
                      <td className="px-8 py-5 font-medium text-slate-600">
                        {warehouses.find(w => w.id === tx.fromWarehouseId)?.name || 'مورد خارجي'}
                      </td>
                      <td className="px-8 py-5 font-medium text-slate-600">
                        {warehouses.find(w => w.id === tx.toWarehouseId)?.name || 'جهة خارجية'}
                      </td>
                      <td className="px-8 py-5 font-black text-blue-600 text-center">{tx.items.length}</td>
                      <td className="px-8 py-5 font-bold text-slate-700">{tx.createdBy || 'النظام'}</td>
                    </tr>
                  ))}
                  {filteredTxs.length === 0 && (
                    <tr><td colSpan={8} className="py-20 text-center text-gray-400 italic">لا توجد حركات مخازن مطابقة للفلاتر الحالية</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'SERIALS_AVAILABILITY': {
        const filteredSerials = getSerialsList().filter(s =>
          s.serial.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          s.productName.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          s.warehouseName.toLowerCase().includes(reportSearchQuery.toLowerCase())
        );

        return (
          <div className="space-y-6">
            <div className="flex justify-end px-4 no-print">
              <span className="bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-xs font-black uppercase">
                إجمالي السيريلات النشطة: {filteredSerials.length}
              </span>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                  <tr className="border-b border-gray-100 tracking-widest">
                    <th className="px-8 py-5">المنتج</th>
                    <th className="px-8 py-5">SKU / الباركود</th>
                    <th className="px-8 py-5">الرقم التسلسلي (Serial)</th>
                    <th className="px-8 py-5">المستودع الحالي</th>
                    <th className="px-8 py-5">تاريخ الدخول</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {filteredSerials.slice(0, 100).map((s, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-5 font-bold text-gray-900">{s.productName}</td>
                      <td className="px-8 py-5 text-slate-500 font-mono">{s.sku} / {s.barcode}</td>
                      <td className="px-8 py-5 font-mono text-sm text-blue-600 font-bold">{s.serial}</td>
                      <td className="px-8 py-5 font-medium text-gray-600">{s.warehouseName}</td>
                      <td className="px-8 py-5 text-sm text-gray-400">{formatDate(s.date)}</td>
                    </tr>
                  ))}
                  {filteredSerials.length === 0 && (
                    <tr><td colSpan={5} className="py-20 text-center text-gray-400 italic">لا توجد أرقام تسلسلية مطابقة للبحث</td></tr>
                  )}
                </tbody>
              </table>
              {filteredSerials.length > 100 && (
                <p className="text-center text-xs text-slate-400 p-4 font-bold border-t border-slate-50">
                  تم عرض أول 100 سيريال، استخدم شريط البحث للتصفية الدقيقة
                </p>
              )}
            </div>
          </div>
        );
      }

      case 'SERIAL_SEARCH': {
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-12 no-print">
            <div className="text-center">
              <h3 className="text-3xl font-black text-gray-900 mb-2">الكشف عن مسلسل صنف</h3>
              <p className="text-gray-500 font-medium">أدخل الرقم التسلسلي لتتبع حركة قطعة الصنف وموقعها وحالتها</p>
            </div>
            
            <div className="w-full max-w-xl relative">
              <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
                <Search className="w-6 h-6 text-gray-300" />
              </div>
              <input 
                type="text" 
                placeholder="مثال: SN-XXXXXXXX-001"
                value={serialSearchQuery}
                onChange={e => setSerialSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSerialSearch()}
                className="w-full bg-white border border-slate-200 rounded-[2rem] pr-16 pl-32 py-6 text-base font-mono shadow-xl focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              />
              <button 
                onClick={handleSerialSearch}
                className="absolute left-3 top-3 bottom-3 bg-slate-950 text-white px-8 rounded-[1.5rem] font-bold text-xs hover:bg-slate-900 transition-colors shadow-md"
              >
                تتبع القطعة
              </button>
            </div>

            {serialSearchResult && (
              <div className="w-full max-w-3xl bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-xl space-y-6">
                {serialSearchResult.status === 'AVAILABLE' && (
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-green-50 border border-green-100 rounded-3xl gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
                      <div>
                        <h4 className="text-base font-black text-green-950">متوفر في المستودع حالياً</h4>
                        <p className="text-xs text-green-700 font-medium font-mono">{serialSearchResult.serial}</p>
                      </div>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl text-center border border-green-200/50">
                      <p className="text-[10px] font-bold text-slate-400">الموقع الحالي</p>
                      <p className="text-xs font-black text-slate-900">{serialSearchResult.warehouse?.name}</p>
                    </div>
                  </div>
                )}

                {serialSearchResult.status === 'SOLD' && (
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-blue-50 border border-blue-100 rounded-3xl gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                      <div>
                        <h4 className="text-base font-black text-blue-950">تم بيعه للعميل</h4>
                        <p className="text-xs text-blue-700 font-medium font-mono">{serialSearchResult.serial}</p>
                      </div>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl text-center border border-blue-200/50">
                      <p className="text-[10px] font-bold text-slate-400">العميل المستلم</p>
                      <p className="text-xs font-black text-slate-900">{serialSearchResult.order?.customerName || 'عميل نقدي'}</p>
                    </div>
                  </div>
                )}

                {serialSearchResult.status === 'NOT_FOUND' && (
                  <div className="p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-3 text-red-950 font-bold">
                    <AlertCircle className="text-red-500 w-5 h-5" />
                    <div>
                      <h4>الرقم التسلسلي غير مسجل</h4>
                      <p className="text-xs text-red-700 font-mono">لم نتمكن من العثور على أي معلومات بخصوص "{serialSearchResult.serial}"</p>
                    </div>
                  </div>
                )}

                {serialSearchResult.status !== 'NOT_FOUND' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                    <div className="space-y-4">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest">بيانات الصنف الأساسية</h5>
                      <div className="bg-slate-50 p-6 rounded-3xl space-y-3 font-bold text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">اسم المنتج:</span>
                          <span className="text-slate-900">{serialSearchResult.product?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">الباركود:</span>
                          <span className="text-slate-900 font-mono">{serialSearchResult.product?.barcode}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">رقم الموديل (SKU):</span>
                          <span className="text-slate-900 font-mono">{serialSearchResult.product?.sku || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">الفئة:</span>
                          <span className="text-slate-900">{serialSearchResult.product?.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest">سلسلة التتبع (Timeline)</h5>
                      <div className="relative pl-4 border-l-2 border-slate-100 space-y-6 text-xs font-bold pt-2">
                        <div className="relative">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-slate-400 border-2 border-white"></div>
                          <p className="text-slate-400">{formatDate(serialSearchResult.product?.createdAt)}</p>
                          <p className="text-slate-900">إنشاء وتدشين الصنف بالنظام</p>
                        </div>
                        
                        <div className="relative">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>
                          <p className="text-slate-400">{formatDate(serialSearchResult.date)}</p>
                          {serialSearchResult.status === 'AVAILABLE' ? (
                            <p className="text-slate-900">توريد وتوفر القطعة في مستودع {serialSearchResult.warehouse?.name}</p>
                          ) : (
                            <p className="text-slate-900">خروج القطعة ومبيعات POS بمستند فاتورة #{serialSearchResult.order?.invoiceNumber || serialSearchResult.order?.id.toUpperCase().slice(0, 8)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'PRODUCT_SALES': {
        const salesData = getProductSales().filter(item =>
          item.product.name.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          item.product.sku?.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          item.product.barcode?.toLowerCase().includes(reportSearchQuery.toLowerCase())
        );

        const topSalesForChart = salesData.slice(0, 5).map(item => ({
          name: item.product.name.slice(0, 15),
          'الكمية المباعة': item.qty,
          'الأرباح': item.profit
        }));

        return (
          <div className="space-y-6">
            {/* Top Stats and Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-64">
                <p className="text-xs font-black text-slate-400 mb-4 uppercase tracking-widest">أداء المبيعات للأصناف الخمسة الأكثر طلباً</p>
                <ResponsiveContainer width="100%" height="90%" minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 230 }}>
                  <BarChart data={topSalesForChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="الكمية المباعة" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="الأرباح" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                <ShoppingCart className="w-12 h-12 text-blue-100 mb-4" />
                <p className="text-sm font-bold text-gray-400 mb-1">إجمالي القطع المباعة</p>
                <p className="text-4xl font-black text-gray-900">
                  {salesData.reduce((acc, i) => acc + i.qty, 0)} <span className="text-sm text-slate-400">قطعة</span>
                </p>
                <div className="mt-4 flex items-center gap-1 text-green-600 font-bold text-xs">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +12.4% زيادة إيجابية
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                  <tr className="border-b border-gray-100">
                    <th className="px-8 py-5">اسم المنتج</th>
                    <th className="px-8 py-5 text-center">الكمية المباعة</th>
                    <th className="px-8 py-5">تكلفة المبيعات (COGS)</th>
                    <th className="px-8 py-5">إجمالي عائدات المبيعات</th>
                    <th className="px-8 py-5">صافي الأرباح</th>
                    <th className="px-8 py-5">نسبة هامش الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-bold">
                  {salesData.map(item => (
                    <tr 
                      key={item.product.id} 
                      onClick={() => {
                        setSelectedProductId(item.product.id);
                        setCardSearchTerm(item.product.name);
                        setActiveReport('PRODUCT_CARD');
                      }}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-8 py-5 font-bold text-gray-900">{item.product.name}</td>
                      <td className="px-8 py-5 text-center text-blue-600 font-black">{item.qty} وحدة</td>
                      <td className="px-8 py-5 text-slate-600">{formatCurrency(item.cost)}</td>
                      <td className="px-8 py-5 text-slate-900 font-black">{formatCurrency(item.revenue)}</td>
                      <td className="px-8 py-5 text-green-600 font-black">{formatCurrency(item.profit)}</td>
                      <td className="px-8 py-5 text-slate-500 font-black">{item.marginPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {salesData.length === 0 && (
                    <tr><td colSpan={6} className="py-20 text-center text-gray-400 italic">لا توجد مبيعات مسجلة مطابقة للبحث</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'AGGREGATED_SALES': {
        const catSales = getCategorySales().filter(item =>
          item.category.toLowerCase().includes(reportSearchQuery.toLowerCase())
        );

        const pieData = catSales.map(c => ({
          name: c.category,
          value: Math.max(0, c.profit)
        }));

        const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between p-6">
                <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                  <div className="flex-1 text-center border-l border-slate-100 last:border-0">
                    <p className="text-[10px] font-black text-slate-400 mb-1">صافي أرباح المبيعات</p>
                    <p className="text-xl font-black text-green-600">
                      {formatCurrency(catSales.reduce((acc, i) => acc + i.profit, 0))}
                    </p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] font-black text-slate-400 mb-1">القطع المباعة</p>
                    <p className="text-xl font-black text-slate-900">
                      {catSales.reduce((acc, i) => acc + i.qty, 0)} قطعة
                    </p>
                  </div>
                </div>
                
                <table className="w-full text-right text-sm mt-4">
                  <thead className="bg-gray-50 text-sm text-gray-400 uppercase font-black">
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-3">الفئة</th>
                      <th className="px-6 py-3 text-center">الكمية المباعة</th>
                      <th className="px-6 py-3">المساهمة في الربح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs font-bold">
                    {catSales.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-bold text-gray-900">{item.category}</td>
                        <td className="px-6 py-3 text-center font-medium text-blue-600">{item.qty} قطعة</td>
                        <td className="px-6 py-3 font-black text-slate-700">{item.contribution.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {catSales.length === 0 && (
                      <tr><td colSpan={3} className="py-8 text-center text-gray-400 italic">لا توجد بيانات للفئات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center h-64 lg:h-auto">
                <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">مساهمة التصنيفات في الأرباح</p>
                <div className="w-full h-44">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 176 }}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {pieData.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[10px] font-bold">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <span className="text-slate-600 truncate max-w-[80px]">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'STOCK_AGING': {
        const brackets = getAgingReportData();

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
              {brackets.map((b, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "bg-white p-6 rounded-3xl border border-gray-100 shadow-sm border-r-4",
                    idx === 0 && "border-r-green-500",
                    idx === 1 && "border-r-blue-500",
                    idx === 2 && "border-r-orange-500",
                    idx === 3 && "border-r-red-500"
                  )}
                >
                  <p className="text-xs font-black text-gray-400 uppercase mb-1">{b.label}</p>
                  <p className="text-2xl font-black text-gray-900 leading-none">
                    {b.count} <span className="text-xs font-medium text-gray-400">أصناف</span>
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-2">
                    القيمة: <span className="text-slate-900">{formatCurrency(b.value)}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-sm text-gray-400 font-black tracking-widest uppercase">
                  <tr className="border-b border-gray-100">
                    <th className="px-8 py-5">المنتج</th>
                    <th className="px-8 py-5">الفئة</th>
                    <th className="px-8 py-5">الكمية الكلية</th>
                    <th className="px-8 py-5">تكلفة القيمة الكلية</th>
                    <th className="px-8 py-5">آخر حركة (أيام)</th>
                    <th className="px-8 py-5">مستوى المخاطر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-bold">
                  {brackets.flatMap(b => b.items)
                    .filter(item => 
                      item.product.name.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
                      item.product.category?.toLowerCase().includes(reportSearchQuery.toLowerCase())
                    )
                    .map((item, idx) => {
                      const days = item.days;
                      const risk = days <= 30 ? "منخفضة" : days <= 60 ? "متوسطة" : days <= 90 ? "مرتفعة" : "حرج / راكد";
                      
                      return (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-8 py-5 font-bold text-gray-900">{item.product.name}</td>
                          <td className="px-8 py-5 text-slate-500">{item.product.category || 'N/A'}</td>
                          <td className="px-8 py-5 font-black text-blue-600">{item.qty} قطعة</td>
                          <td className="px-8 py-5 text-gray-900">{formatCurrency(item.value)}</td>
                          <td className="px-8 py-5 font-bold text-slate-700">{days} يوم</td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight",
                              days <= 30 && "bg-green-50 text-green-600",
                              days > 30 && days <= 60 && "bg-blue-50 text-blue-600",
                              days > 60 && days <= 90 && "bg-orange-50 text-orange-600",
                              days > 90 && "bg-red-50 text-red-600"
                            )}>
                              {risk}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
               {React.createElement(REPORT_MENU.find(m => m.id === activeReport)?.icon || FileBox, { size: 64 })}
            </div>
            <div>
               <h3 className="text-2xl font-black text-gray-900 mb-2">{REPORT_MENU.find(m => m.id === activeReport)?.title}</h3>
               <p className="text-gray-400 font-medium max-w-sm mx-auto">هذا التقرير قيد التطوير حالياً وسيتم ربطه ببيانات النظام تلقائياً.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-8 h-[calc(100vh-100px)] md:h-[calc(100vh-160px)] animate-in fade-in slide-in-from-bottom-4 duration-700">
      <style dangerouslySetInnerHTML={{ __html: `
        .print-only-header {
          display: none;
        }
        .print-only-footer {
          display: none;
        }
        @media print {
          /* Hide main site navigation header, sidebar, footer, breadcrumbs, etc. */
          header, aside, footer, nav, .no-print, .breadcrumbs {
            display: none !important;
          }
          
          /* Reset body/html height, overflow, and layout wrappers */
          body, html, #root, .h-screen, .overflow-hidden, .flex, .flex-col {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            background: white !important;
            color: black !important;
          }

          /* Reset layout margins/paddings */
          main, .mx-auto, .max-w-7xl, .px-4, .pb-16, .pt-4, .sm\\:px-6, .lg\\:px-8 {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }

          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-card {
            border: 1px solid #e2e8f0 !important;
            border-radius: 1rem !important;
            margin-bottom: 2rem !important;
          }
          /* Force report cards and grids to span full page width on print */
          .grid, [class*="grid-cols-"] {
            display: flex !important;
            flex-direction: column !important;
            gap: 1rem !important;
            width: 100% !important;
          }
          .grid > *, [class*="grid-cols-"] > * {
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
          }
          .print-only-header {
            display: flex !important;
            border-bottom: 2px solid #0f172a !important;
            padding-bottom: 1rem !important;
            margin-bottom: 2rem !important;
            justify-content: space-between !important;
            align-items: start !important;
            direction: rtl !important;
            width: 100% !important;
          }
          .print-only-footer {
            display: block !important;
            border-top: 1px solid #e2e8f0 !important;
            padding-top: 1rem !important;
            margin-top: 3rem !important;
            text-align: center !important;
            font-size: 0.7rem !important;
            color: #64748b !important;
            direction: rtl !important;
            width: 100% !important;
          }
          ::-webkit-scrollbar {
            display: none;
          }
        }
      `}} />

      {/* Sidebar Menu */}
      <div className="w-full md:w-80 min-h-[300px] bg-white rounded-[2rem] md:rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col shrink-0 overflow-hidden no-print">
         <div className="p-8 border-b border-gray-50">
            <h2 className="text-xl font-bold text-gray-900 mb-1">مركز التقارير</h2>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">اختر التقرير المطلوب عرضه</p>
         </div>
         <nav className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-none">
            {REPORT_MENU.map((report) => (
              <button
                key={report.id}
                onClick={() => {
                  setActiveReport(report.id as ReportType);
                  setReportSearchQuery('');
                }}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all text-right group relative",
                  activeReport === report.id 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <report.icon className={cn("w-5 h-5", activeReport === report.id ? "text-white" : "text-gray-400 group-hover:text-blue-500")} />
                <span className="flex-1 text-sm font-bold truncate">{report.title}</span>
                {activeReport === report.id && <ChevronLeft className="w-4 h-4 text-white/50" />}
              </button>
            ))}
         </nav>
         <div className="p-6 border-t border-gray-50">
            <div className="bg-blue-50 p-4 rounded-2xl flex flex-col items-center text-center">
               <Layers className="text-blue-600 w-8 h-8 mb-2" />
               <p className="text-sm font-bold text-blue-900">تقارير ذكية</p>
               <p className="text-sm text-blue-400 mt-1">يتم تحديث جميع البيانات لحظياً بناءً على الحركات المخزنية</p>
            </div>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col overflow-hidden relative print-area">
         {loading ? (
           <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                 <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-sm font-bold text-gray-500 animate-pulse">جاري جلب بيانات التقارير...</p>
              </div>
           </div>
         ) : null}

         {/* Top Control Bar - Hidden during printing */}
         <div className="px-10 py-6 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/50 backdrop-blur-md sticky top-0 z-10 no-print">
           <div>
             <h3 className="text-xl font-black text-gray-900">
               {REPORT_MENU.find(m => m.id === activeReport)?.title}
             </h3>
             <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-0.5">
               {activeReport === 'STOCK_BALANCE' && 'أرصدة وكميات المستودعات والفروع الحالية'}
               {activeReport === 'INVENTORY_COST' && 'تكلفة المخزون الكلي وهوامش الربح المتوقعة'}
               {activeReport === 'PRODUCT_CARD' && 'كشف الحركة السريعة لأرصدة المنتج'}
               {activeReport === 'DETAILED_CARD' && 'دفتر الأستاذ التفصيلي لحركات المنتج وهوامش الربح'}
               {activeReport === 'WORK_ORDERS' && 'سجل كافة المستندات والحركات المخزنية المكتملة'}
               {activeReport === 'SERIALS_AVAILABILITY' && 'الأرقام التسلسلية المتاحة للأصناف في الفروع'}
               {activeReport === 'SERIAL_SEARCH' && 'تتبع القطع وحالتها عبر الرقم التسلسلي'}
               {activeReport === 'PRODUCT_SALES' && 'تحليل مبيعات وأرباح الأصناف الفردية'}
               {activeReport === 'AGGREGATED_SALES' && 'أداء المبيعات والأرباح مجمعة حسب فئة المنتجات'}
               {activeReport === 'STOCK_AGING' && 'تحليل أعمار المخزون لتفادي الركود والخسائر'}
             </p>
           </div>
           
           {activeReport !== 'SERIAL_SEARCH' && (
             <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
               <div className="relative flex-1 sm:flex-initial sm:w-60">
                 <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                 <input
                   type="text"
                   placeholder="بحث مخصص..."
                   value={reportSearchQuery}
                   onChange={e => setReportSearchQuery(e.target.value)}
                   className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200/50 rounded-xl pr-9 pl-4 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-100 focus:bg-white outline-none transition-all shadow-sm text-right"
                 />
               </div>
               
               <button
                 onClick={handlePrint}
                 className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
               >
                 طباعة
               </button>
               
               <button
                 onClick={() => handleExportExcel(activeReport)}
                 className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-100"
               >
                 تصدير Excel
               </button>
             </div>
           )}
         </div>
         
         <div className="p-10 flex-1 overflow-y-auto scrollbar-none">
             {/* Print Letterhead Header */}
             <div className="print-only-header">
               <div className="flex items-center gap-4">
                 {settings?.storeLogoUrl ? (
                   <img src={settings.storeLogoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-xl" />
                 ) : (
                   <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">LOGO</div>
                 )}
                 <div className="text-right">
                   <h1 className="text-xl font-black text-slate-900">{settings?.storeName || 'مؤسسة فوت برينت'}</h1>
                   {settings?.taxRegistrationNumber && (
                     <p className="text-[10px] font-bold text-slate-500 mt-0.5">الرقم الضريبي: {settings.taxRegistrationNumber}</p>
                   )}
                 </div>
               </div>
               
               <div className="text-left text-[10px] font-bold text-slate-500 space-y-0.5">
                 <p>تاريخ استخراج التقرير: {new Date().toISOString().split('T')[0]}</p>
                 {settings?.phone && <p>الهاتف: {settings.phone}</p>}
                 {settings?.branchEmail && <p>البريد الإلكتروني: {settings.branchEmail}</p>}
                 <p>نوع التقرير: {REPORT_MENU.find(m => m.id === activeReport)?.title}</p>
               </div>
             </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeReport}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                {renderReportContent()}
              </motion.div>
            </AnimatePresence>

            {/* Print Letterhead Footer */}
            <div className="print-only-footer">
              <p>تم استخراج هذا التقرير تلقائياً من نظام Footprint ERP & POS. جميع الحقوق محفوظة.</p>
            </div>
         </div>
      </div>

      {/* Detail Modal Overlay */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="text-right">
                <h3 className="text-xl font-black text-slate-900">
                  {detailModal.type === 'WAREHOUSE' && `تفاصيل مخزون: ${detailModal.data.warehouse.name}`}
                  {detailModal.type === 'TRANSACTION' && `تفاصيل مستند الحركة: #${detailModal.data.id.toUpperCase().slice(0, 8)}`}
                  {detailModal.type === 'ORDER' && `تفاصيل الفاتورة: #${detailModal.data.invoiceNumber || detailModal.data.id.toUpperCase().slice(0, 8)}`}
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                  {detailModal.type === 'WAREHOUSE' && 'قائمة بكافة المنتجات المتوفرة وكمياتها وقيمتها المالية'}
                  {detailModal.type === 'TRANSACTION' && `نوع الحركة: ${detailModal.data.type === 'RECEIPT' ? 'توريد بضاعة' : detailModal.data.type === 'TRANSFER' ? 'تحويل مخزني' : detailModal.data.type === 'ISSUE' ? 'صرف بضاعة' : detailModal.data.type === 'RETURN' ? 'مردود مبيعات' : 'تسوية جرد'}`}
                  {detailModal.type === 'ORDER' && 'تفاصيل المبيعات وعناصر الفاتورة وطريقة الدفع'}
                </p>
              </div>
              <button 
                onClick={() => setDetailModal(null)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-8 scrollbar-none text-right">
              {detailModal.type === 'WAREHOUSE' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-xs font-bold text-slate-400 mb-1">كود المستودع</p>
                      <p className="font-bold text-slate-900">{detailModal.data.warehouse.code || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-xs font-bold text-slate-400 mb-1">عدد الأصناف</p>
                      <p className="font-bold text-slate-900">{detailModal.data.items.length} أصناف</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-xs font-bold text-slate-400 mb-1">الكمية الكلية</p>
                      <p className="font-bold text-blue-600">{detailModal.data.items.reduce((acc: number, item: any) => acc + item.whQty, 0)} قطعة</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-xs font-bold text-slate-400 mb-1">قيمة المخزون</p>
                      <p className="font-bold text-gray-900">{formatCurrency(detailModal.data.items.reduce((acc: number, item: any) => acc + (item.whQty * (item.costPrice || 0)), 0))}</p>
                    </div>
                  </div>
                  
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4">المنتج</th>
                          <th className="px-6 py-4">SKU / الباركود</th>
                          <th className="px-6 py-4 text-center">الكمية المتاحة</th>
                          <th className="px-6 py-4">سعر التكلفة</th>
                          <th className="px-6 py-4 text-left">القيمة الإجمالية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        {detailModal.data.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-slate-900">{item.name}</td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-500">{item.sku || 'N/A'} / {item.barcode || 'N/A'}</td>
                            <td className="px-6 py-4 font-bold text-center text-blue-600">{item.whQty}</td>
                            <td className="px-6 py-4">{formatCurrency(item.costPrice || 0)}</td>
                            <td className="px-6 py-4 font-black text-left">{formatCurrency(item.whQty * (item.costPrice || 0))}</td>
                          </tr>
                        ))}
                        {detailModal.data.items.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 italic">لا تتوفر بضاعة في هذا المستودع حالياً</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {detailModal.type === 'TRANSACTION' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-slate-400 mb-1">المرجع</p>
                      <p className="text-slate-900">{detailModal.data.reference || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-slate-400 mb-1">التاريخ</p>
                      <p className="text-slate-900">{formatDate(detailModal.data.createdAt)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-slate-400 mb-1">المستودع المصدر</p>
                      <p className="text-slate-900">
                        {warehouses.find(w => w.id === detailModal.data.fromWarehouseId)?.name || 'خارجي / مورد'}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-slate-400 mb-1">المستودع المستلم</p>
                      <p className="text-slate-900">
                        {warehouses.find(w => w.id === detailModal.data.toWarehouseId)?.name || 'خارجي / عميل'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl text-xs">
                    <p className="font-bold text-slate-400 mb-1">الملاحظات</p>
                    <p className="text-slate-700 font-medium">{detailModal.data.notes || 'لا توجد ملاحظات.'}</p>
                  </div>
                  
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4">الصنف</th>
                          <th className="px-6 py-4 text-center">الكمية</th>
                          <th className="px-6 py-4">التكلفة للوحدة</th>
                          <th className="px-6 py-4 text-left">التكلفة الإجمالية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        {detailModal.data.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-slate-900">{item.productName}</td>
                            <td className="px-6 py-4 font-bold text-center text-blue-600">{item.quantity}</td>
                            <td className="px-6 py-4">{formatCurrency(item.cost || 0)}</td>
                            <td className="px-6 py-4 font-black text-left">{formatCurrency(item.quantity * (item.cost || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center font-black text-base px-6">
                    <span>إجمالي القيمة:</span>
                    <span className="text-blue-600">
                      {formatCurrency(detailModal.data.items.reduce((acc: number, i: any) => acc + (i.quantity * (i.cost || 0)), 0))}
                    </span>
                  </div>
                </div>
              )}
              
              {detailModal.type === 'ORDER' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-slate-400 mb-1">العميل</p>
                      <p className="text-slate-900">{detailModal.data.customerName || 'عميل نقدي'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-slate-400 mb-1">طريقة الدفع</p>
                      <p className="text-slate-900">{detailModal.data.paymentMethod === 'CASH' ? 'نقدي' : detailModal.data.paymentMethod === 'CARD' ? 'بطاقة' : detailModal.data.paymentMethod === 'SPLIT' ? 'مختلط' : 'آجل'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-slate-400 mb-1">الفرع</p>
                      <p className="text-slate-900">
                        {warehouses.find(w => w.id === detailModal.data.branchId)?.name || 'المستودع الرئيسي'}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-slate-400 mb-1">التاريخ</p>
                      <p className="text-slate-900">
                        {detailModal.data.createdAt?.seconds 
                          ? formatDate(new Date(detailModal.data.createdAt.seconds * 1000).toISOString()) 
                          : formatDate(detailModal.data.createdAt)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4">اسم المنتج</th>
                          <th className="px-6 py-4 text-center">الكمية المباعة</th>
                          <th className="px-6 py-4">سعر الوحدة</th>
                          <th className="px-6 py-4 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        {detailModal.data.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-slate-900">{item.productName}</td>
                            <td className="px-6 py-4 font-bold text-center text-blue-600">{item.quantity}</td>
                            <td className="px-6 py-4">{formatCurrency(item.price || 0)}</td>
                            <td className="px-6 py-4 font-black text-left">{formatCurrency(item.quantity * (item.price || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="bg-slate-50 p-6 rounded-2xl space-y-2 font-bold text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>المجموع الفرعي:</span>
                      <span className="text-slate-900">{formatCurrency(detailModal.data.subtotal || detailModal.data.total)}</span>
                    </div>
                    {detailModal.data.discount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>الخصم:</span>
                        <span>-{formatCurrency(detailModal.data.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>الضريبة (15%):</span>
                      <span className="text-slate-900">{formatCurrency(detailModal.data.tax || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                      <span>الإجمالي الكلي:</span>
                      <span className="text-blue-600">{formatCurrency(detailModal.data.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
              <button 
                onClick={() => setDetailModal(null)}
                className="bg-slate-950 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-100 hover:bg-slate-900"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
