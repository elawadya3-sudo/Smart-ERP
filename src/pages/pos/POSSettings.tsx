import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Laptop,
  Smartphone,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ShieldAlert,
  Users,
  Search,
  ShoppingCart,
  Building2,
  Layers,
  Coins,
  History,
  FileText,
  Percent,
  TrendingUp,
  Store,
  DollarSign,
  QrCode,
  FileSpreadsheet,
  Clock,
  Eye,
  LogOut,
  RefreshCcw,
  Sparkles,
  Loader2
} from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, addDoc, deleteDoc, updateDoc, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useMainStoreSettings } from '../../hooks/useMainStoreSettings';
import { formatCurrency, cn } from '../../lib/utils';
import PageToolbar from '../../components/ui/PageToolbar';
import { Warehouse, User, Shift, Order, Customer, POSDevice, PrintTemplate, SecurityLog } from '../../types';
import { useDesktop } from '../../context/DesktopIntegrationContext';
import PosNavbar from '../../components/layout/PosNavbar';
import PosBreadcrumbs from '../../components/layout/PosBreadcrumbs';

export default function POSSettings() {
  const { user } = useAuth();
  const { settings, updateSettings, loading: settingsLoading } = useMainStoreSettings();
  const { isElectron, deviceId, deviceName, appVersion, isOnline, wsConnected, isSyncing, systemInfo } = useDesktop();

  // ─── TABS ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'devices' | 'shifts' | 'config' | 'templates' | 'desktop' | 'security'>('devices');

  // ─── DATA STATES ──────────────────────────────────────────────────────────
  const [devices, setDevices] = useState<POSDevice[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [printTemplates, setPrintTemplates] = useState<PrintTemplate[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── MODALS & FORMS STATES ───────────────────────────────────────────────
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<POSDevice | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    name: '',
    deviceNumber: '',
    branchId: '',
    warehouseId: '',
    linkedUserId: '',
    status: 'ACTIVE' as POSDevice['status']
  });

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    branchId: '',
    cashierId: '',
    openingCash: 0
  });
  const [selectedShiftDetails, setSelectedShiftDetails] = useState<Shift | null>(null);

  // Print Template State
  const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    companyName: '',
    logoUrl: '',
    taxNumber: '',
    qrCodeEnabled: true,
    barcodeEnabled: true,
    paperSize: '80mm' as '58mm' | '80mm' | 'A4',
    headerMessage: '',
    footerMessage: '',
    linkedBranchIds: [] as string[]
  });

  // Search terms
  const [deviceSearch, setDeviceSearch] = useState('');
  const [shiftSearch, setShiftSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');

  // Desktop integration activity logs states
  const [selectedDeviceForLogs, setSelectedDeviceForLogs] = useState<POSDevice | null>(null);
  const [deviceLogs, setDeviceLogs] = useState<any[]>([]);

  // Mac warning state
  const [isMacWarningOpen, setIsMacWarningOpen] = useState(false);

  // ─── SYNC DATA FROM FIRESTORE ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDeviceForLogs) {
      setDeviceLogs([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'pos_devices', selectedDeviceForLogs.id, 'activity_logs'), orderBy('timestamp', 'desc')),
      (snap) => {
        setDeviceLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );
    return () => unsub();
  }, [selectedDeviceForLogs]);

  useEffect(() => {
    setLoading(true);

    const unsubDevices = onSnapshot(collection(db, 'pos_devices'), (snap) => {
      setDevices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as POSDevice)));
    });

    const unsubShifts = onSnapshot(query(collection(db, 'shifts'), orderBy('startDate', 'desc')), (snap) => {
      setShifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift)));
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    const unsubWarehouses = onSnapshot(collection(db, 'warehouses'), (snap) => {
      setWarehouses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as User)));
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    const unsubTemplates = onSnapshot(collection(db, 'print_templates'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrintTemplate));
      setPrintTemplates(list);
      if (list.length > 0 && !selectedTemplate) {
        setSelectedTemplate(list[0]);
      }
    });

    const unsubLogs = onSnapshot(query(collection(db, 'security_logs'), orderBy('timestamp', 'desc')), (snap) => {
      setSecurityLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SecurityLog)));
      setLoading(false);
    });

    return () => {
      unsubDevices();
      unsubShifts();
      unsubOrders();
      unsubWarehouses();
      unsubUsers();
      unsubCustomers();
      unsubTemplates();
      unsubLogs();
    };
  }, []);

  // Sync print template form when selected template changes
  useEffect(() => {
    if (selectedTemplate) {
      setTemplateForm({
        name: selectedTemplate.name,
        companyName: selectedTemplate.companyName,
        logoUrl: selectedTemplate.logoUrl || '',
        taxNumber: selectedTemplate.taxNumber || '',
        qrCodeEnabled: selectedTemplate.qrCodeEnabled,
        barcodeEnabled: selectedTemplate.barcodeEnabled,
        paperSize: selectedTemplate.paperSize,
        headerMessage: selectedTemplate.headerMessage || '',
        footerMessage: selectedTemplate.footerMessage || '',
        linkedBranchIds: selectedTemplate.linkedBranchIds || []
      });
    } else {
      setTemplateForm({
        name: '',
        companyName: '',
        logoUrl: '',
        taxNumber: '',
        qrCodeEnabled: true,
        barcodeEnabled: true,
        paperSize: '80mm',
        headerMessage: '',
        footerMessage: '',
        linkedBranchIds: []
      });
    }
  }, [selectedTemplate]);

  // ─── STATS DERIVATIONS ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(todayStr));
    const todaySales = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const activeDevs = devices.filter(d => d.status === 'ACTIVE').length;
    const openShifts = shifts.filter(s => s.status === 'OPEN').length;

    return {
      totalDevices: devices.length,
      activeDevices: activeDevs,
      openShiftsCount: openShifts,
      todaySalesAmount: todaySales,
      todayInvoicesCount: todayOrders.length
    };
  }, [devices, shifts, orders]);

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  const getBranchName = (id: string) => warehouses.find(w => w.id === id)?.name || 'غير محدد';
  const getUserName = (id: string) => users.find(u => u.uid === id)?.name || 'غير محدد';

  // ─── POS DEVICES CRUD ─────────────────────────────────────────────────────
  const handleOpenDeviceModal = (device: POSDevice | null = null) => {
    if (device) {
      setEditingDevice(device);
      setDeviceForm({
        name: device.name,
        deviceNumber: device.deviceNumber,
        branchId: device.branchId,
        warehouseId: device.warehouseId,
        linkedUserId: device.linkedUserId,
        status: device.status
      });
    } else {
      setEditingDevice(null);
      setDeviceForm({
        name: '',
        deviceNumber: `POS-${Math.floor(1000 + Math.random() * 9000)}`,
        branchId: warehouses[0]?.id || '',
        warehouseId: warehouses[0]?.id || '',
        linkedUserId: users[0]?.uid || '',
        status: 'ACTIVE'
      });
    }
    setIsDeviceModalOpen(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceForm.name.trim() || !deviceForm.deviceNumber.trim()) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      if (editingDevice) {
        await updateDoc(doc(db, 'pos_devices', editingDevice.id), {
          ...deviceForm,
          updatedAt: new Date().toISOString()
        });
      } else {
        const newDeviceRef = doc(collection(db, 'pos_devices'));
        await setDoc(newDeviceRef, {
          id: newDeviceRef.id,
          ...deviceForm,
          createdAt: new Date().toISOString()
        });
      }
      setIsDeviceModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الجهاز');
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الجهاز؟')) return;
    try {
      await deleteDoc(doc(db, 'pos_devices', id));
    } catch (err) {
      console.error(err);
      alert('فشل حذف الجهاز');
    }
  };

  // ─── SHIFT OPERATIONS ────────────────────────────────────────────────────
  const handleOpenNewShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const { branchId, cashierId, openingCash } = shiftForm;
    if (!branchId || !cashierId) {
      alert('يرجى اختيار الفرع والموظف');
      return;
    }

    const hasOpenShift = shifts.some(s => s.branchId === branchId && s.status === 'OPEN');
    if (hasOpenShift) {
      alert('يوجد وردية مفتوحة بالفعل لهذا الفرع!');
      return;
    }

    try {
      const id = `SHF-${Date.now().toString(36).toUpperCase()}`;
      const cashierName = getUserName(cashierId);
      const newShift: Shift = {
        id,
        branchId,
        cashierId,
        openingCash: Number(openingCash) || 0,
        closingCash: 0,
        actualCash: 0,
        totalSalesCash: 0,
        totalSalesCard: 0,
        expenses: 0,
        status: 'OPEN',
        startDate: new Date().toISOString(),
        cashierName
      };

      await setDoc(doc(db, 'shifts', id), newShift);
      setIsShiftModalOpen(false);
      setShiftForm({ branchId: '', cashierId: '', openingCash: 0 });
    } catch (err) {
      console.error(err);
      alert('فشل فتح الوردية');
    }
  };

  const handleForceCloseShift = async (shift: Shift) => {
    const actual = prompt('أدخل المبلغ النقدي الفعلي الموجود بالصندوق (Actual Cash):');
    if (actual === null) return;
    const actualCashNum = Number(actual);
    if (isNaN(actualCashNum)) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }

    try {
      // Calculate sales for this shift
      const shiftInvoices = orders.filter(o => o.shiftId === shift.id && o.status !== 'CANCELLED');
      const cashSales = shiftInvoices.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + (o.total || 0), 0);
      const cardSales = shiftInvoices.filter(o => o.paymentMethod !== 'cash' && o.paymentMethod !== 'debt').reduce((sum, o) => sum + (o.total || 0), 0);

      const updateData = {
        status: 'CLOSED' as const,
        endDate: new Date().toISOString(),
        actualCash: actualCashNum,
        totalSalesCash: cashSales,
        totalSalesCard: cardSales,
        closingCash: shift.openingCash + cashSales,
        notes: `تم الإغلاق قسرياً بواسطة المدير (${user?.name || 'مدير'})`
      };

      await updateDoc(doc(db, 'shifts', shift.id), updateData);
      
      // Log Security Action
      await addDoc(collection(db, 'security_logs'), {
        userId: user?.uid || 'unknown',
        userName: user?.name || 'مدير النظام',
        action: 'SHIFT_FORCE_CLOSED',
        details: `إغلاق وردية رقم #${shift.id.slice(-8)} للموظف (${shift.cashierName}) بقيمة نقدية فعلية ${actualCashNum}`,
        timestamp: new Date().toISOString(),
        metadata: { shiftId: shift.id, actualCash: actualCashNum }
      });

      alert('تم إغلاق الوردية وتسجيل العملية بسجلات الأمان.');
    } catch (err) {
      console.error(err);
      alert('فشل إغلاق الوردية');
    }
  };

  // ─── CONFIGURATION SAVE ──────────────────────────────────────────────────
  const handleSaveConfigs = async (key: string, value: any) => {
    if (!settings) return;
    try {
      const updated = { ...settings, [key]: value };
      await updateSettings(updated);
    } catch (err) {
      console.error(err);
      alert('فشل تحديث الإعدادات');
    }
  };

  // ─── PRINT TEMPLATE CRUD ─────────────────────────────────────────────────
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.companyName.trim()) {
      alert('يرجى كتابة اسم القالب واسم الشركة');
      return;
    }

    try {
      if (selectedTemplate) {
        await updateDoc(doc(db, 'print_templates', selectedTemplate.id), {
          ...templateForm
        });
        alert('تم تعديل قالب الطباعة بنجاح.');
      } else {
        const newRef = doc(collection(db, 'print_templates'));
        const newTemp = {
          id: newRef.id,
          ...templateForm,
          createdAt: new Date().toISOString()
        };
        await setDoc(newRef, newTemp);
        setSelectedTemplate(newTemp);
        alert('تم إنشاء قالب الطباعة الجديد.');
      }
    } catch (err) {
      console.error(err);
      alert('فشل حفظ قالب الطباعة');
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    if (!window.confirm(`هل أنت متأكد من حذف قالب الطباعة "${selectedTemplate.name}"؟`)) return;

    try {
      await deleteDoc(doc(db, 'print_templates', selectedTemplate.id));
      setSelectedTemplate(null);
      alert('تم حذف قالب الطباعة.');
    } catch (err) {
      console.error(err);
      alert('فشل حذف قالب الطباعة');
    }
  };

  const handleTestPrint = () => {
    const paperSize = templateForm.paperSize;
    const isThermal = paperSize !== 'A4';
    
    let html = `
      <!DOCTYPE html><html dir="rtl"><head>
      <meta charset="utf-8">
      <title>طباعة تجريبية</title>
      <style>
        body { font-family: system-ui, sans-serif; font-size: ${isThermal ? '11px' : '13px'}; width: ${isThermal ? '78mm' : '100%'}; margin: auto; padding: 10px; }
        .header { text-align: center; margin-bottom: 10px; }
        .store-logo { max-width: 80px; max-height: 80px; margin-bottom: 5px; border-radius: 8px; }
        .company-name { font-size: 16px; font-weight: bold; margin: 3px 0; }
        .tax-number { font-size: 9px; color: #555; }
        .divider { border-top: 1px dashed #666; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { text-align: right; border-bottom: 1px solid #000; padding: 3px 0; }
        td { padding: 4px 0; }
        .footer { text-align: center; font-size: 9px; margin-top: 15px; color: #666; }
      </style></head><body>
      <div class="header">
        ${templateForm.logoUrl ? `<img class="store-logo" src="${templateForm.logoUrl}" alt="Logo" />` : ''}
        <div class="company-name">${templateForm.companyName}</div>
        <div class="tax-number">الرقم الضريبي: ${templateForm.taxNumber || '123456789'}</div>
        ${templateForm.headerMessage ? `<div style="margin: 4px 0;">${templateForm.headerMessage}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div><strong>طباعة تجريبية لقالب:</strong> ${templateForm.name}</div>
      <div>الفرع المرتبط: فرع افتراضي</div>
      <div class="divider"></div>
      <table>
        <thead>
          <tr>
            <th>الصنف</th>
            <th style="text-align: center;">الكمية</th>
            <th style="text-align: left;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>منتج تجريبي 1</td>
            <td style="text-align: center;">2</td>
            <td style="text-align: left;">120.00 ر.س</td>
          </tr>
          <tr>
            <td>منتج تجريبي 2</td>
            <td style="text-align: center;">1</td>
            <td style="text-align: left;">50.00 ر.س</td>
          </tr>
        </tbody>
      </table>
      <div class="divider"></div>
      <div style="display: flex; justify-content: space-between; font-weight: bold;">
        <span>الإجمالي النهائي:</span>
        <span>170.00 ر.س</span>
      </div>
      ${templateForm.qrCodeEnabled ? `
        <div style="text-align: center; margin-top: 10px;">
          <div style="display: inline-block; width: 60px; height: 60px; background: #ddd; line-height: 60px; font-size: 8px;">QR Code</div>
        </div>
      ` : ''}
      <div class="footer">${templateForm.footerMessage || 'شكراً لزيارتكم'}</div>
      <script>window.onload = function() { window.print(); setTimeout(window.close, 500); }</script>
      </body></html>
    `;

    const printWin = window.open('', '_blank', isThermal ? 'width=350,height=500' : 'width=800,height=800');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
    }
  };

  // ─── FILTER LOGICS ───────────────────────────────────────────────────────
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const q = deviceSearch.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.deviceNumber.toLowerCase().includes(q);
    });
  }, [devices, deviceSearch]);

  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
      const q = shiftSearch.toLowerCase();
      return (s.cashierName || '').toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    });
  }, [shifts, shiftSearch]);

  const filteredLogs = useMemo(() => {
    return securityLogs.filter(l => {
      const q = logSearch.toLowerCase();
      return l.userName.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || l.details.toLowerCase().includes(q);
    });
  }, [securityLogs, logSearch]);

  return (
    <div className="space-y-6 text-right pb-16" dir="rtl">
      <PosBreadcrumbs />
      <PosNavbar />
      
      {/* HEADER SECTION */}
      <PageToolbar
        title="إدارة لوحة إعدادات نقاط البيع (POS Settings Panel)"
        subtitle="تهيئة الصلاحيات، الأجهزة المتصلة، الورديات والطباعة المباشرة"
        onRefresh={() => window.location.reload()}
      />

      {/* KPI DASHBOARD SUMMARY PANEL */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* Stat POS Devices */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-all"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">إجمالي أجهزة POS</span>
          <h3 className="text-xl font-black text-slate-900 mt-1 relative z-10">{stats.totalDevices} جهاز</h3>
        </div>

        {/* Stat Active Devices */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-all"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">الأجهزة النشطة حالياً</span>
          <h3 className="text-xl font-black text-emerald-600 mt-1 relative z-10">{stats.activeDevices} نشط</h3>
        </div>

        {/* Stat Open Shifts */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-all"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">الورديات المفتوحة</span>
          <h3 className="text-xl font-black text-purple-600 mt-1 relative z-10">{stats.openShiftsCount} وردية</h3>
        </div>

        {/* Stat Today Invoices */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-all"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">فواتير اليوم</span>
          <h3 className="text-xl font-black text-orange-600 mt-1 relative z-10">{stats.todayInvoicesCount} فاتورة</h3>
        </div>

        {/* Stat Today Sales */}
        <div className="bg-slate-950 p-5 rounded-3xl shadow-lg flex flex-col gap-2 relative overflow-hidden group col-span-2 md:col-span-1">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-all"></div>
          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest relative z-10">مبيعات اليوم</span>
          <h3 className="text-lg font-black text-white mt-1 relative z-10">{formatCurrency(stats.todaySalesAmount)}</h3>
        </div>

      </div>

      {/* TABS SELECTOR */}
      <div className="inline-flex items-center space-x-1 md:space-x-2 space-x-reverse bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-100/80 shadow-sm text-sm font-semibold select-none flex-wrap gap-y-2 mb-6">
        {[
          { id: 'devices', label: 'أجهزة POS', icon: Smartphone },
          { id: 'shifts', label: 'ورديات نقاط البيع', icon: Clock },
          { id: 'config', label: 'التهيئة العامة', icon: Settings },
          { id: 'templates', label: 'قوالب الطباعة', icon: Printer },
          { id: 'desktop', label: 'سطح المكتب', icon: Laptop },
          { id: 'security', label: 'الأمان والصلاحيات', icon: ShieldAlert }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95",
              activeTab === t.id ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* CORE ACTIVE TAB VIEW CONTENT */}
      <div className="bg-white p-6 border border-slate-100 rounded-[2rem] shadow-sm min-h-[400px]">
        {loading || settingsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin" />
            <span className="text-xs text-slate-400 font-bold">جاري مزامنة بيانات النظام...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: POS DEVICES */}
            {activeTab === 'devices' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <div>
                    <h4 className="text-md font-black text-slate-900">إدارة أجهزة نقاط البيع النشطة</h4>
                    <p className="text-[10px] text-slate-400 font-bold">تسجيل وتعديل وربط ماكينات البيع المباشر بالفروع والمستودعات</p>
                  </div>
                  <button
                    onClick={() => handleOpenDeviceModal()}
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl py-2.5 px-4 text-xs font-black flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة جهاز POS جديد
                  </button>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      placeholder="البحث بالاسم أو رقم الجهاز..."
                      value={deviceSearch}
                      onChange={e => setDeviceSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pr-10 pl-4 py-2.5 text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 select-none">
                        <th className="px-5 py-3 text-xs font-black text-slate-400">رقم الجهاز</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400">اسم الجهاز</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400">الفرع المرتبط</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400">المستخدم المسؤول</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400 text-center">الحالة</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      {filteredDevices.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 font-mono font-bold text-blue-600 bg-blue-50/20">{d.deviceNumber}</td>
                          <td className="px-5 py-3.5 font-bold text-slate-900">{d.name}</td>
                          <td className="px-5 py-3.5 text-slate-500">{getBranchName(d.branchId)}</td>
                          <td className="px-5 py-3.5 text-slate-500">{getUserName(d.linkedUserId)}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={cn(
                              "text-[10px] font-black px-2 py-0.5 rounded-full border",
                              d.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"
                            )}>
                              {d.status === 'ACTIVE' ? 'نشط' : 'متوقف'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleOpenDeviceModal(d)}
                                className="bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg p-1.5 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDevice(d.id)}
                                className="bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500 rounded-lg p-1.5 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredDevices.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-slate-400 italic">لا توجد أجهزة مسجلة حالياً.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: POS SHIFTS */}
            {activeTab === 'shifts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <div>
                    <h4 className="text-md font-black text-slate-900">مراقبة وتسوية الورديات (Shifts Management)</h4>
                    <p className="text-[10px] text-slate-400 font-bold">مراجعة تقارير العهدة، فروقات الصناديق وإغلاق الجلسات المعلقة</p>
                  </div>
                  <button
                    onClick={() => setIsShiftModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 px-4 text-xs font-black flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    فتح وردية جديدة لكاشير
                  </button>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      placeholder="البحث باسم الكاشير أو كود الوردية..."
                      value={shiftSearch}
                      onChange={e => setShiftSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pr-10 pl-4 py-2.5 text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 select-none">
                        <th className="px-5 py-3 text-xs font-black text-slate-400">كود الوردية</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400">الكاشير</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400">الفرع</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400 text-left">النقدية الافتتاحية</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400 text-left">المبيعات المتوقعة</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400 text-center">تاريخ البدء</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400 text-center">الحالة</th>
                        <th className="px-5 py-3 text-xs font-black text-slate-400 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      {filteredShifts.map(s => {
                        const shiftInvs = orders.filter(o => o.shiftId === s.id && o.status !== 'CANCELLED');
                        const salesCash = shiftInvs.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + (o.total || 0), 0);
                        const expectedClosing = s.openingCash + salesCash;

                        return (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3.5 font-mono text-[10px] text-slate-400">#{s.id.slice(-8).toUpperCase()}</td>
                            <td className="px-5 py-3.5 font-bold text-slate-800">{s.cashierName || getUserName(s.cashierId)}</td>
                            <td className="px-5 py-3.5 text-slate-500">{getBranchName(s.branchId)}</td>
                            <td className="px-5 py-3.5 text-left font-bold text-slate-900">{formatCurrency(s.openingCash)}</td>
                            <td className="px-5 py-3.5 text-left font-bold text-slate-900">{formatCurrency(expectedClosing)}</td>
                            <td className="px-5 py-3.5 text-center font-mono text-[10px]">{new Date(s.startDate).toLocaleString('ar-EG')}</td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded-full border",
                                s.status === 'OPEN' ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-slate-100 text-slate-600 border-slate-200"
                              )}>
                                {s.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => setSelectedShiftDetails(s)}
                                  className="bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg py-1 px-2.5 text-[10px] font-black transition-colors"
                                >
                                  التقرير
                                </button>
                                {s.status === 'OPEN' && (
                                  <button
                                    onClick={() => handleForceCloseShift(s)}
                                    className="bg-red-50 text-red-600 hover:bg-red-100 rounded-lg py-1 px-2.5 text-[10px] font-black transition-colors"
                                  >
                                    إغلاق
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredShifts.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-5 py-12 text-center text-slate-400 italic">لا توجد ورديات مسجلة.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: POS CONFIGURATIONS */}
            {activeTab === 'config' && (
              <div className="space-y-6">
                <div className="border-b border-slate-50 pb-3">
                  <h4 className="text-md font-black text-slate-900">إعدادات وتهيئة نقاط البيع (POS Configurations)</h4>
                  <p className="text-[10px] text-slate-400 font-bold">تحديد سياسات البيع والضرائب وسياسة المخزون السالب والعملات</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Inventory Settings */}
                  <div className="space-y-4 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <h5 className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      سياسة المخزون والمنتجات
                    </h5>
                    
                    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-xs font-black text-slate-800 block">السماح ببيع المخزون السالب</span>
                        <span className="text-[10px] text-slate-400 font-bold">إتاحة البيع حتى عند عدم توفر كمية كافية بالمخزن الفرعي</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.allowNegativeInventory || false}
                        onChange={e => handleSaveConfigs('allowNegativeInventory', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-xs font-black text-slate-800 block">تفعيل تتبع المخزون في POS</span>
                        <span className="text-[10px] text-slate-400 font-bold">مقارنة الكمية المباعة بالمخزون الفعلي بالمستودع</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.enableStockTracking !== false}
                        onChange={e => handleSaveConfigs('enableStockTracking', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                    </div>
                  </div>

                  {/* Financial & General Policies */}
                  <div className="space-y-4 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <h5 className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-blue-600" />
                      سياسات التسعير والعملاء الافتراضيين
                    </h5>
                    
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 space-y-2">
                      <label className="text-xs font-black text-slate-800 block">العميل الافتراضي للبيع النقدي</label>
                      <select
                        value={settings?.defaultCustomerId || 'WALK-IN'}
                        onChange={e => handleSaveConfigs('defaultCustomerId', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      >
                        <option value="WALK-IN">عميل نقدي افتراضي (Walk-in Customer)</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-xs font-black text-slate-800 block">إنشاء العملاء وتعديلهم أثناء البيع</span>
                        <span className="text-[10px] text-slate-400 font-bold">تفعيل نموذج إضافة عميل سريع بالكاشير</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.allowQuickCustomerCreate !== false}
                        onChange={e => handleSaveConfigs('allowQuickCustomerCreate', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-slate-100 space-y-2">
                      <label className="text-xs font-black text-slate-800 block">أقصى حد خصم مسموح به للكاشير (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={settings?.maxDiscountPercent ?? 10}
                        onChange={e => handleSaveConfigs('maxDiscountPercent', Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      />
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 4: PRINT TEMPLATES */}
            {activeTab === 'templates' && (
              <div className="space-y-6">
                <div className="border-b border-slate-50 pb-3 flex justify-between items-center">
                  <div>
                    <h4 className="text-md font-black text-slate-900">محرر قوالب وتصميم الفواتير (Invoice Layout Designer)</h4>
                    <p className="text-[10px] text-slate-400 font-bold">تصميم شكل الإيصال وتخصيص حجم الورق (A4 / 80mm / 58mm)</p>
                  </div>
                  <div className="flex gap-2">
                    {printTemplates.length > 0 && (
                      <select
                        value={selectedTemplate?.id || ''}
                        onChange={e => setSelectedTemplate(printTemplates.find(t => t.id === e.target.value) || null)}
                        className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer"
                      >
                        {printTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl px-3.5 py-2 text-xs font-black transition-all"
                    >
                      قالب جديد +
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Editor Form */}
                  <form onSubmit={handleSaveTemplate} className="space-y-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                    <h5 className="text-xs font-black text-slate-800">بيانات وتصميم القالب</h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 block mb-1">اسم القالب</label>
                        <input
                          type="text"
                          required
                          value={templateForm.name}
                          onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                          placeholder="مثال: فاتورة كاشير حرارية"
                          className="w-full bg-white border border-slate-150 rounded-xl px-3.5 py-2 text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 block mb-1">اسم الشركة (بالفاتورة)</label>
                        <input
                          type="text"
                          required
                          value={templateForm.companyName}
                          onChange={e => setTemplateForm({ ...templateForm, companyName: e.target.value })}
                          className="w-full bg-white border border-slate-150 rounded-xl px-3.5 py-2 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-black text-slate-400 block">رابط شعار الشركة (Logo URL)</label>
                          {settings?.storeLogoUrl && (
                            <button
                              type="button"
                              onClick={() => setTemplateForm({ ...templateForm, logoUrl: settings.storeLogoUrl || '' })}
                              className="text-[9px] text-blue-600 font-bold hover:underline"
                            >
                              استخدم شعار المتجر الرئيسي
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={templateForm.logoUrl}
                          onChange={e => setTemplateForm({ ...templateForm, logoUrl: e.target.value })}
                          placeholder={settings?.storeLogoUrl ? "مربوط تلقائياً بشعار المتجر" : "أدخل رابط الشعار"}
                          className="w-full bg-white border border-slate-150 rounded-xl px-3.5 py-2 text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 block mb-1">الرقم الضريبي للمنشأة</label>
                        <input
                          type="text"
                          value={templateForm.taxNumber}
                          onChange={e => setTemplateForm({ ...templateForm, taxNumber: e.target.value })}
                          className="w-full bg-white border border-slate-150 rounded-xl px-3.5 py-2 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>

                    {/* Select Linked Branches */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-2">الفروع المرتبطة بهذا القالب (Linked Branches)</label>
                      <div className="grid grid-cols-2 gap-2 bg-white border border-slate-150 rounded-xl p-3.5 max-h-[120px] overflow-y-auto">
                        {warehouses.map(branch => (
                          <label key={branch.id} className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-700 select-none">
                            <input
                              type="checkbox"
                              checked={templateForm.linkedBranchIds?.includes(branch.id) || false}
                              onChange={e => {
                                const checked = e.target.checked;
                                setTemplateForm(prev => {
                                  const list = prev.linkedBranchIds || [];
                                  return {
                                    ...prev,
                                    linkedBranchIds: checked 
                                      ? [...list, branch.id] 
                                      : list.filter(id => id !== branch.id)
                                  };
                                });
                              }}
                              className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                            />
                            {branch.name}
                          </label>
                        ))}
                        {warehouses.length === 0 && (
                          <div className="col-span-2 text-[10px] text-slate-400 italic text-center">لا توجد فروع مسجلة</div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 block mb-1">مقاس ورق الفاتورة</label>
                        <select
                          value={templateForm.paperSize}
                          onChange={e => setTemplateForm({ ...templateForm, paperSize: e.target.value as any })}
                          className="w-full bg-white border border-slate-150 rounded-xl px-3.5 py-2 text-xs font-bold outline-none"
                        >
                          <option value="80mm">طابعة كاشير حرارية 80mm</option>
                          <option value="58mm">طابعة كاشير حرارية 58mm</option>
                          <option value="A4">طابعة مكتبية عادية A4</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          checked={templateForm.qrCodeEnabled}
                          onChange={e => setTemplateForm({ ...templateForm, qrCodeEnabled: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <span className="text-xs font-bold text-slate-800">إظهار QR Code ضريبي</span>
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          checked={templateForm.barcodeEnabled}
                          onChange={e => setTemplateForm({ ...templateForm, barcodeEnabled: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <span className="text-xs font-bold text-slate-800">إظهار باركود الفاتورة</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 block mb-1">رسالة رأس الفاتورة (ترحيبية)</label>
                        <textarea
                          value={templateForm.headerMessage}
                          onChange={e => setTemplateForm({ ...templateForm, headerMessage: e.target.value })}
                          placeholder="مثال: شكراً لزيارتكم"
                          rows={2}
                          className="w-full bg-white border border-slate-150 rounded-xl px-3.5 py-2 text-xs font-bold outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 block mb-1">رسالة تذييل الفاتورة (أسفل الفاتورة)</label>
                        <textarea
                          value={templateForm.footerMessage}
                          onChange={e => setTemplateForm({ ...templateForm, footerMessage: e.target.value })}
                          placeholder="مثال: الفاتورة خاضعة لضريبة القيمة المضافة"
                          rows={2}
                          className="w-full bg-white border border-slate-150 rounded-xl px-3.5 py-2 text-xs font-bold outline-none resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-xs font-black transition-all flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {selectedTemplate ? 'حفظ التعديلات' : 'إنشاء قالب جديد'}
                      </button>
                      <button
                        type="button"
                        onClick={handleTestPrint}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl px-4 py-2.5 text-xs font-black transition-all flex items-center gap-1.5"
                      >
                        <Printer className="w-4 h-4" />
                        طباعة تجريبية
                      </button>
                      {selectedTemplate && (
                        <button
                          type="button"
                          onClick={handleDeleteTemplate}
                          className="bg-red-50 text-red-600 hover:bg-red-100 rounded-xl px-4 py-2.5 text-xs font-black transition-all flex items-center gap-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                          حذف القالب
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Live Preview Column */}
                  <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 flex flex-col justify-between max-w-sm mx-auto w-full shadow-2xl relative">
                    <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block mb-4 border-b border-slate-800 pb-2">معاينة حية وتصميم مباشر للفاتورة</span>
                    
                    <div className="bg-white text-slate-950 p-5 rounded-2xl shadow-inner font-mono text-[9px] space-y-3.5 leading-relaxed overflow-y-auto max-h-[350px]">
                      {/* Store Header */}
                      <div className="text-center space-y-1">
                        {templateForm.logoUrl || settings?.storeLogoUrl ? (
                          <img src={templateForm.logoUrl || settings?.storeLogoUrl} alt="Store Logo" className="w-16 h-16 mx-auto rounded-full mb-1 border object-contain bg-white" />
                        ) : (
                          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full mx-auto flex items-center justify-center mb-1 border font-bold text-[10px]">LOGO</div>
                        )}
                        <h6 className="text-[13px] font-black text-slate-950 m-0 leading-tight">{templateForm.companyName || 'IRON WOOD'}</h6>
                        <div className="text-[10px] font-bold text-slate-700">مدينتي</div>
                        <div className="text-[9px] text-slate-600 font-bold">
                          {templateForm.headerMessage || 'شكراً لزيارتكم'}
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="text-center text-[8px] text-slate-600 space-y-0.5 mt-2">
                        <div>رقم الفاتورة: INV-K53YNI0V1</div>
                        <div>التاريخ: 2026/06/23 12:39:08 م</div>
                        <div>الكاشير: admin</div>
                        {templateForm.taxNumber && <div>الرقم الضريبي: {templateForm.taxNumber}</div>}
                        <div>الهاتف: {settings?.phone || '0100020703'}</div>
                      </div>

                      <div className="border-t border-dashed border-slate-900 my-2"></div>
                      
                      {/* Items Table */}
                      <div className="space-y-2">
                        <div className="flex justify-between font-black text-slate-950 border-b border-dashed border-slate-900 pb-1 mb-1">
                          <span className="w-1/2 text-right">الصنف</span>
                          <span className="w-1/4 text-center">الكمية</span>
                          <span className="w-1/4 text-left">الإجمالي</span>
                        </div>
                        <div className="flex justify-between items-start text-slate-950 font-bold">
                          <div className="w-1/2 text-right">
                            <div className="font-bold text-[9.5px]">شيميز زارا</div>
                            <div className="text-[7.5px] text-slate-500 font-normal">2,000.00 ج.م/حبة</div>
                          </div>
                          <span className="w-1/4 text-center font-bold">1</span>
                          <span className="w-1/4 text-left font-bold">{formatCurrency(2000)}</span>
                        </div>
                      </div>

                      <div className="border-t border-dashed border-slate-900 my-2"></div>
                      
                      {/* Totals */}
                      <div className="space-y-1 font-bold text-slate-950">
                        <div className="flex justify-between text-[9px]">
                          <span>المجموع الفرعي:</span>
                          <span>{formatCurrency(2000)}</span>
                        </div>
                      </div>

                      <div className="border-t border-dashed border-slate-900 my-2"></div>

                      <div className="space-y-1 text-slate-950">
                        <div className="flex justify-between text-[12px] font-black">
                          <span>الإجمالي النهائي:</span>
                          <span>{formatCurrency(2000)}</span>
                        </div>
                        <div className="flex justify-between text-[8px] text-slate-500 font-bold">
                          <span>طريقة الدفع:</span>
                          <span>نقدي</span>
                        </div>
                      </div>

                      {/* Barcode */}
                      {templateForm.barcodeEnabled && (
                        <div className="flex flex-col items-center justify-center py-1 mt-2">
                          <div className="w-48 h-7 bg-[repeating-linear-gradient(90deg,#000,#000_1px,#fff_1px,#fff_3.5px)] opacity-95"></div>
                          <span className="text-[7px] font-mono tracking-widest text-slate-950 mt-0.5">INV-K53YNI0V1</span>
                        </div>
                      )}

                      {/* QR Code */}
                      {templateForm.qrCodeEnabled && (
                        <div className="flex flex-col items-center gap-1 py-1">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('IRON WOOD\nINV-K53YNI0V1\nTotal: 2000')}`}
                            alt="QR Code"
                            className="w-14 h-14 border p-0.5 rounded bg-white"
                          />
                        </div>
                      )}

                      <div className="border-t border-dashed border-slate-900 my-2"></div>

                      {/* Footer Message */}
                      <div className="text-center text-slate-950 font-black text-[8px] leading-tight">
                        سياسة الاسترجاع: الاسترجاع مسموح خلال 10 يوم من تاريخ الشراء
                      </div>

                      <div className="text-center text-slate-500 text-[8px] mt-1">
                        {templateForm.footerMessage || 'الفاتورة خاضعة لضريبة القيمة المضافة'}
                      </div>
                    </div>

                    <div className="text-slate-400 text-[8px] mt-4 text-center select-none">
                      * يظهر هذا المظهر متوافقاً مع حجم ورق ({templateForm.paperSize}) المختار.
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 5: DESKTOP APP */}
            {activeTab === 'desktop' && (
              <div className="space-y-6" dir="rtl">
                <div className="border-b border-slate-50 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-black text-slate-900">تطبيق سطح المكتب والأجهزة النشطة (Desktop POS Integration)</h4>
                    <p className="text-[10px] text-slate-400 font-bold">إدارة ومراقبة أجهزة نقاط البيع المتصلة، سجلات النشاط، التحديثات اللحظية والتزامن</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={cn(
                      "text-[10px] font-black px-2.5 py-1 rounded-xl border flex items-center gap-1.5",
                      isOnline ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"
                    )}>
                      <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500 animate-ping" : "bg-red-500")} />
                      {isOnline ? "متصل بالإنترنت" : "منقطع عن الإنترنت"}
                    </span>
                    <span className={cn(
                      "text-[10px] font-black px-2.5 py-1 rounded-xl border flex items-center gap-1.5",
                      wsConnected ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-slate-50 text-slate-500 border-slate-100"
                    )}>
                      <span className={cn("w-2 h-2 rounded-full", wsConnected ? "bg-blue-500 animate-pulse" : "bg-slate-400")} />
                      {wsConnected ? "WebSocket: نشط" : "WebSocket: غير متصل"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Local App Status & Download */}
                  <div className="space-y-6">
                    {/* Device Status Card */}
                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                      <h5 className="text-xs font-black text-slate-800 flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-blue-600" />
                        حالة الجهاز المحلي الحالي
                      </h5>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3.5 text-xs">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                          <span className="text-slate-400 font-bold">نمط التشغيل:</span>
                          <span className={cn(
                            "font-black px-2 py-0.5 rounded-lg border",
                            isElectron ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-amber-50 text-amber-700 border-amber-100"
                          )}>
                            {isElectron ? "تطبيق سطح المكتب (Electron)" : "متصفح الويب (Web)"}
                          </span>
                        </div>
                        {isElectron && systemInfo && (
                          <>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                              <span className="text-slate-400 font-bold">معرف الجهاز:</span>
                              <span className="font-mono font-bold text-slate-900">{deviceId}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                              <span className="text-slate-400 font-bold">اسم الكمبيوتر:</span>
                              <span className="font-bold text-slate-900">{deviceName}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                              <span className="text-slate-400 font-bold">نظام التشغيل:</span>
                              <span className="font-bold text-slate-900 uppercase">{systemInfo.platform} ({systemInfo.arch})</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                              <span className="text-slate-400 font-bold">المعالج والذاكرة:</span>
                              <span className="font-bold text-slate-900">{systemInfo.cpuCount} Cores | {systemInfo.freeMemoryGB} GB Free</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-bold">إصدار التطبيق:</span>
                          <span className="font-bold text-slate-900">{appVersion}</span>
                        </div>
                      </div>
                    </div>

                    {/* Download Card */}
                    <div className="bg-slate-950 text-white p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col justify-between gap-5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
                      <div className="space-y-1 relative z-10">
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">تنزيل التطبيق</span>
                        <h4 className="text-md font-black text-slate-100">تحميل تطبيق POS لسطح المكتب</h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-2 leading-relaxed">
                          قم بتنزيل النسخة الخاصة بنقاط البيع السريعة التي تعمل بدون متصفح وتدعم طباعة مباشرة بدون حوار الطباعة وتدعم العمل دون انترنت (Offline Mode).
                        </p>
                      </div>
                      <div className="flex gap-2 mt-4 relative z-10">
                        <a
                          href="/installers/nezam-pos-windows.exe"
                          download
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 px-3 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                        >
                          ويندوز (.exe)
                        </a>
                        <button
                          onClick={() => setIsMacWarningOpen(true)}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2 px-3 text-xs font-black flex items-center justify-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
                        >
                          ماك (.dmg)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Middle & Right Column: Connected Devices Grid & Activity Logs */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* POS Devices Table */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 space-y-4">
                      <h5 className="text-xs font-black text-slate-800 flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-blue-600" />
                        لوحة مراقبة الأجهزة النشطة والمسجلة بالخادم
                      </h5>

                      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-right border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 select-none">
                              <th className="px-4 py-3 text-xs font-black text-slate-400">معرف الجهاز</th>
                              <th className="px-4 py-3 text-xs font-black text-slate-400">اسم الجهاز / النظام</th>
                              <th className="px-4 py-3 text-xs font-black text-slate-400">الفرع المرتبط</th>
                              <th className="px-4 py-3 text-xs font-black text-slate-400">المستخدم النشط</th>
                              <th className="px-4 py-3 text-xs font-black text-slate-400">الإصدار</th>
                              <th className="px-4 py-3 text-xs font-black text-slate-400 text-center">آخر نشاط</th>
                              <th className="px-4 py-3 text-xs font-black text-slate-400 text-center">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                            {devices.map(d => {
                              // Check if connected within last 60 seconds
                              const lastSeenDate = new Date(d.lastSeen);
                              const isConnected = (Date.now() - lastSeenDate.getTime()) < 60000 && d.status === 'CONNECTED';
                              
                              return (
                                <tr key={d.id} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3.5 font-mono font-bold text-slate-900 bg-slate-50/40">{d.id}</td>
                                  <td className="px-4 py-3.5">
                                    <div className="font-bold text-slate-900">{d.name}</div>
                                    <div className="text-[9px] text-slate-400 font-bold uppercase">{d.platform || 'web'} ({d.arch || 'x64'})</div>
                                  </td>
                                  <td className="px-4 py-3.5 text-slate-500">{getBranchName(d.branchId)}</td>
                                  <td className="px-4 py-3.5">
                                    <span className="font-bold text-slate-800">{d.linkedUserName || 'غير متصل'}</span>
                                    {d.linkedUserRole && (
                                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded mr-1 font-bold">{d.linkedUserRole}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5 font-mono text-[10px] text-slate-500">{d.version || 'v1.0.0'}</td>
                                  <td className="px-4 py-3.5 text-center">
                                    <span className={cn(
                                      "text-[10px] font-black px-2 py-0.5 rounded-full border",
                                      isConnected ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-600 border-slate-200"
                                    )}>
                                      {isConnected ? 'متصل حالياً' : 'غير متصل'}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-bold block mt-1">{new Date(d.lastSeen).toLocaleTimeString('ar-EG')}</span>
                                  </td>
                                  <td className="px-4 py-3.5 text-center">
                                    <div className="flex gap-1.5 justify-center">
                                      <button
                                        onClick={() => setSelectedDeviceForLogs(d)}
                                        className={cn(
                                          "px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all",
                                          selectedDeviceForLogs?.id === d.id
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                                        )}
                                      >
                                        سجل النشاط
                                      </button>
                                      <button
                                        onClick={() => handleDeleteDevice(d.id)}
                                        className="bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500 rounded-xl p-1.5 transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {devices.length === 0 && (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-slate-400 italic">لا توجد أجهزة مسجلة حالياً.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Device Activity Logs Viewer */}
                    {selectedDeviceForLogs && (
                      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                          <h5 className="text-xs font-black text-slate-800 flex items-center gap-2">
                            <History className="w-4 h-4 text-blue-600" />
                            سجل نشاط الجهاز الحالي: <span className="font-mono text-blue-600">{selectedDeviceForLogs.name} ({selectedDeviceForLogs.id})</span>
                          </h5>
                          <button
                            onClick={() => setSelectedDeviceForLogs(null)}
                            className="text-[10px] font-black text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-lg"
                          >
                            إغلاق السجل
                          </button>
                        </div>

                        <div className="border border-slate-50 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto scrollbar-thin">
                          <table className="w-full text-right border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-100 select-none">
                                <th className="px-4 py-2.5 text-xs font-black text-slate-400">الحدث</th>
                                <th className="px-4 py-2.5 text-xs font-black text-slate-400">التفاصيل</th>
                                <th className="px-4 py-2.5 text-xs font-black text-slate-400">بواسطة</th>
                                <th className="px-4 py-2.5 text-xs font-black text-slate-400 text-center">الوقت</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-700">
                              {deviceLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-2.5 font-bold">
                                    <span className={cn(
                                      "text-[9px] font-black px-2 py-0.5 rounded-md border uppercase",
                                      log.action.includes('STARTUP') ? "bg-blue-50 text-blue-700 border-blue-100" :
                                      log.action.includes('ONLINE') ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                      log.action.includes('OFFLINE') ? "bg-amber-50 text-amber-700 border-amber-100" :
                                      "bg-slate-100 text-slate-600 border-slate-200"
                                    )}>
                                      {log.action}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-500 font-bold">{log.details}</td>
                                  <td className="px-4 py-2.5 font-bold text-slate-800">
                                    {log.userName}
                                    <span className="text-[9px] text-slate-400 block font-mono">ID: {log.userId.slice(0, 6)}</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-mono text-[10px] text-slate-400">
                                    {new Date(log.timestamp).toLocaleString('ar-EG')}
                                  </td>
                                </tr>
                              ))}
                              {deviceLogs.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">لا توجد سجلات نشاط لهذا الجهاز بعد.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: SECURITY LOGS & ROLES */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="border-b border-slate-50 pb-3">
                  <h4 className="text-md font-black text-slate-900">سجل الأمان والعمليات الحساسة (Security Logs & Permissions)</h4>
                  <p className="text-[10px] text-slate-400 font-bold">مراقبة فتح أدراج النقدية، إلغاء الفواتير وتعديل الخصومات مع تعيين صلاحيات الكاشير</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Security Configurations */}
                  <div className="space-y-4 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <h5 className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      سياسات ومراقبة الأمان
                    </h5>
                    
                    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-xs font-black text-slate-800 block">مراقبة وتسجيل فتح الأدراج</span>
                        <span className="text-[10px] text-slate-400 font-bold">تسجيل كل عملية فتح لدرج النقدية بالكاشير</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.drawerMonitoringEnabled || false}
                        onChange={e => handleSaveConfigs('drawerMonitoringEnabled', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-xs font-black text-slate-800 block">مراقبة وإلغاء الفواتير</span>
                        <span className="text-[10px] text-slate-400 font-bold">تسجيل طلبات إلغاء أو حذف الفواتير بالكامل</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.cancelMonitoringEnabled || false}
                        onChange={e => handleSaveConfigs('cancelMonitoringEnabled', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-xs font-black text-slate-800 block">مراقبة وتتبع الخصومات</span>
                        <span className="text-[10px] text-slate-400 font-bold">تسجيل كل فاتورة بها خصومات يدوية</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.discountMonitoringEnabled || false}
                        onChange={e => handleSaveConfigs('discountMonitoringEnabled', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                    </div>
                  </div>

                  {/* Cashier Log viewer */}
                  <div className="space-y-4 col-span-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black text-slate-800 flex items-center gap-2">
                        <History className="w-4 h-4 text-blue-600" />
                        سجلات عمليات الأمان والتنبيهات
                      </h5>
                      <input
                        type="text"
                        placeholder="البحث في العمليات..."
                        value={logSearch}
                        onChange={e => setLogSearch(e.target.value)}
                        className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none max-w-[200px]"
                      />
                    </div>

                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm max-h-[350px] overflow-y-auto">
                      <table className="w-full text-right border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 select-none sticky top-0 z-10">
                            <th className="px-4 py-2 text-slate-400">التاريخ</th>
                            <th className="px-4 py-2 text-slate-400">المسؤول</th>
                            <th className="px-4 py-2 text-slate-400 text-center">العملية</th>
                            <th className="px-4 py-2 text-slate-400">التفاصيل</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                          {filteredLogs.map(l => (
                            <tr key={l.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-mono text-[9px] whitespace-nowrap">{new Date(l.timestamp).toLocaleString('ar-EG')}</td>
                              <td className="px-4 py-2.5 font-bold text-slate-800">{l.userName}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={cn(
                                  "text-[8px] font-black px-2 py-0.5 rounded-full border",
                                  l.action === 'DRAWER_OPENED' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                  l.action === 'INVOICE_CANCELLED' ? "bg-red-50 text-red-700 border-red-100" : "bg-amber-50 text-amber-700 border-amber-100"
                                )}>
                                  {l.action === 'DRAWER_OPENED' ? 'فتح درج' : 
                                   l.action === 'INVOICE_CANCELLED' ? 'إلغاء فاتورة' : 
                                   l.action === 'SHIFT_FORCE_CLOSED' ? 'إغلاق شفت قسري' : 'تطبيق خصم'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-500 font-bold">{l.details}</td>
                            </tr>
                          ))}
                          {filteredLogs.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">لا توجد سجلات أمان مطابقة.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* DEVICE MODAL */}
      {isDeviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4 text-right">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-md">
                {editingDevice ? 'تعديل بيانات جهاز POS' : 'إضافة جهاز POS جديد'}
              </h3>
              <button
                onClick={() => setIsDeviceModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">اسم الجهاز (POS Name)</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: جهاز الكاشير بالطابق الأول"
                  value={deviceForm.name}
                  onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-150 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">الرقم التعريفي للجهاز (POS Number)</label>
                <input
                  type="text"
                  required
                  value={deviceForm.deviceNumber}
                  onChange={e => setDeviceForm({ ...deviceForm, deviceNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-150 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">الفرع المرتبط</label>
                  <select
                    value={deviceForm.branchId}
                    onChange={e => setDeviceForm({ ...deviceForm, branchId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">المستودع الافتراضي</label>
                  <select
                    value={deviceForm.warehouseId}
                    onChange={e => setDeviceForm({ ...deviceForm, warehouseId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">المستخدم المرتبط الافتراضي</label>
                <select
                  value={deviceForm.linkedUserId}
                  onChange={e => setDeviceForm({ ...deviceForm, linkedUserId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="">-- بلا مستخدم مرتبط --</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">الحالة التشغيلية</label>
                <select
                  value={deviceForm.status}
                  onChange={e => setDeviceForm({ ...deviceForm, status: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="ACTIVE">نشط (متاح للعمليات)</option>
                  <option value="INACTIVE">متوقف (محظور مؤقتاً)</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsDeviceModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-500"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 text-white"
                >
                  حفظ البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIFT MODAL */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 text-right">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-md">فتح وردية كاشير جديدة</h3>
              <button
                onClick={() => setIsShiftModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenNewShift} className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">الفرع / المتجر المرتبط</label>
                <select
                  value={shiftForm.branchId}
                  required
                  onChange={e => setShiftForm({ ...shiftForm, branchId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="">-- اختر الفرع --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">الموظف / الكاشير المستلم</label>
                <select
                  value={shiftForm.cashierId}
                  required
                  onChange={e => setShiftForm({ ...shiftForm, cashierId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="">-- اختر الكاشير --</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">مبلغ العهدة / النقدية الافتتاحية</label>
                <input
                  type="number"
                  min="0"
                  value={shiftForm.openingCash}
                  onChange={e => setShiftForm({ ...shiftForm, openingCash: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-150 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-500"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 text-white"
                >
                  بدء الوردية وتوريد العهدة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIFT DETAILS / REPORT MODAL */}
      {selectedShiftDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4 text-right">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-md">تقرير عهدة وتسليم الوردية تفصيلياً</h3>
              <button
                onClick={() => setSelectedShiftDetails(null)}
                className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-2xl">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">كود الوردية</span>
                  <strong className="font-mono text-slate-900">#{selectedShiftDetails.id.slice(-8).toUpperCase()}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">الموظف المسؤول</span>
                  <strong className="text-slate-900">{selectedShiftDetails.cashierName}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">تاريخ البدء</span>
                  <strong className="text-slate-800">{new Date(selectedShiftDetails.startDate).toLocaleString('ar-EG')}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">تاريخ الانتهاء</span>
                  <strong className="text-slate-800">
                    {selectedShiftDetails.endDate ? new Date(selectedShiftDetails.endDate).toLocaleString('ar-EG') : 'الوردية لا زالت نشطة'}
                  </strong>
                </div>
              </div>

              <div className="border border-slate-100 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">عهدة الصندوق الافتتاحية:</span>
                  <span className="font-black text-slate-900">{formatCurrency(selectedShiftDetails.openingCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">المبيعات النقدية المسجلة:</span>
                  <span className="font-black text-slate-900">{formatCurrency(selectedShiftDetails.totalSalesCash)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500 font-bold">المبيعات بالبطاقة/الشبكة:</span>
                  <span className="font-black text-slate-900">{formatCurrency(selectedShiftDetails.totalSalesCard)}</span>
                </div>
                <div className="flex justify-between text-blue-600 font-black pt-1">
                  <span>إجمالي النقدية المتوقعة بالصندوق:</span>
                  <span>{formatCurrency(selectedShiftDetails.openingCash + selectedShiftDetails.totalSalesCash)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-black">
                  <span>المبلغ الفعلي المستلم (Actual Cash):</span>
                  <span>{formatCurrency(selectedShiftDetails.actualCash)}</span>
                </div>
                
                {selectedShiftDetails.status === 'CLOSED' && (
                  <div className="flex justify-between text-red-600 font-black border-t pt-2">
                    <span>فروقات الصندوق (العجز / الزيادة):</span>
                    <span>
                      {selectedShiftDetails.actualCash - (selectedShiftDetails.openingCash + selectedShiftDetails.totalSalesCash) === 0 ? (
                        <span className="text-emerald-600 font-black">متطابق بالكامل (0.00)</span>
                      ) : (
                        formatCurrency(selectedShiftDetails.actualCash - (selectedShiftDetails.openingCash + selectedShiftDetails.totalSalesCash))
                      )}
                    </span>
                  </div>
                )}
              </div>

              {selectedShiftDetails.notes && (
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl text-[11px] text-amber-800">
                  <strong>ملاحظات التسوية:</strong> {selectedShiftDetails.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setSelectedShiftDetails(null)}
                className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAC WARNING MODAL */}
      {isMacWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4 text-right" dir="rtl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-md flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                تحميل نسخة الماك (macOS)
              </h3>
              <button
                onClick={() => setIsMacWarningOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed font-bold">
              <p>
                عذراً، نسخة نظام ماك (.dmg) غير متوفرة للتحميل المباشر حالياً لأن خادم النظام مستضاف على بيئة ويندوز.
              </p>
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-[11px] text-amber-800 space-y-2">
                <strong className="block text-xs">لبناء تطبيق macOS وتثبيته:</strong>
                <ol className="list-decimal list-inside space-y-1">
                  <li>قم بتنزيل المستودع وتشغيله على جهاز macOS.</li>
                  <li>تأكد من تثبيت الحزم باستخدام الأمر <code className="bg-white px-1.5 py-0.5 rounded border font-mono">pnpm install</code>.</li>
                  <li>قم بتشغيل أمر البناء والتحزيم: <code className="bg-white px-1.5 py-0.5 rounded border font-mono">pnpm electron:build</code>.</li>
                  <li>سيقوم النظام تلقائياً بتوليد ملف التثبيت (.dmg) ونقله إلى المجلد العام للمشروع.</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setIsMacWarningOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
