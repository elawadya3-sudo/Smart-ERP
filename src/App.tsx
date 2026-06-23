/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { POSProvider } from './context/POSContext';
import { SuperAdminProvider, useSuperAdmin } from './context/SuperAdminContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import InventoryDashboard from './pages/inventory/InventoryDashboard';
import Warehouses from './pages/inventory/Warehouses';
import WarehouseDetails from './pages/inventory/WarehouseDetails';
import GoodsReceipt from './pages/inventory/GoodsReceipt';
import InventoryReports from './pages/inventory/InventoryReports';
import StockTransfers from './pages/inventory/Transfers';
import StockTaking from './pages/inventory/StockTaking';
import ItemMap from './pages/inventory/ItemMap';
import ProductUnits from './pages/inventory/ProductUnits';
import BulkProductEdit from './pages/inventory/BulkProductEdit';
import SalesReturns from './pages/inventory/SalesReturns';
import PurchaseReturns from './pages/inventory/PurchaseReturns';
import StockIssue from './pages/inventory/StockIssue';
import BranchTransferRequest from './pages/inventory/BranchTransferRequest';
import OpeningBalance from './pages/inventory/OpeningBalance';
import ProductLedger from './pages/inventory/ProductLedger';
import TransferReceipt from './pages/inventory/TransferReceipt';
import InventoryApproval from './pages/inventory/InventoryApproval';
import AddProduct from './pages/products/AddProduct';
import AccountingDashboard from './pages/accounting/AccountingDashboard';
import ChartOfAccounts from './pages/accounting/ChartOfAccounts';
import CostCenters from './pages/accounting/CostCenters';
import JournalEntries from './pages/accounting/JournalEntries';
import CashTransactions from './pages/accounting/CashTransactions';
import Currencies from './pages/accounting/Currencies';
import CheckStages from './pages/accounting/CheckStages';
import Taxes from './pages/accounting/Taxes';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import SalesHistory from './pages/SalesHistory';
import CashReports from './pages/CashReports';
import CashierManagement from './pages/CashierManagement';
import BranchManagement from './pages/BranchManagement';
import Login from './pages/Login';
import { useMainStoreSettings } from './hooks/useMainStoreSettings';
import AdminPOS from './pages/AdminPOS';
import AccountsPayable from './pages/inventory/AccountsPayable';
import ReportsCenter from './pages/reports/ReportsCenter';
import SystemModules from './pages/superadmin/SystemModules';
import PosCustomers from './pages/pos/PosCustomers';
import POSReports from './pages/pos/POSReports';
import POSSettings from './pages/pos/POSSettings';
import SalesDashboard from './pages/sales/SalesDashboard';
import SalesBasicData from './pages/sales/SalesBasicData';
import SalesConfig from './pages/sales/SalesConfig';
import SalesDocuments from './pages/sales/SalesDocuments';
import SalesApprovals from './pages/sales/SalesApprovals';
import SalesReports from './pages/sales/SalesReports';
import { ThemeProvider } from './context/ThemeContext';
import { DesktopIntegrationProvider } from './context/DesktopIntegrationContext';

// ─── Super Admin Imports ──────────────────────────────────────────────────────
import SuperAdminLogin from './pages/superadmin/SuperAdminLogin';
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import TenantsList from './pages/superadmin/TenantsList';
import AddEditTenant from './pages/superadmin/AddEditTenant';
import TenantDetails from './pages/superadmin/TenantDetails';

/** Guard: redirect to /superadmin/login if not authenticated as super admin */
function SuperAdminGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, ready } = useSuperAdmin();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(!ready);
  }, [ready]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/superadmin/login" replace />;
  }

  return <>{children}</>;
}

const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
const Router = isElectron ? HashRouter : BrowserRouter;

export default function App() {
  const { settings } = useMainStoreSettings();
  
  // Update document title dynamically based on store name
  useEffect(() => {
    if (settings?.storeName) {
      document.title = settings.storeName;
    } else {
      document.title = 'NEZAM PRO';
    }
  }, [settings]);

  return (
    <ThemeProvider>
      <SuperAdminProvider>
        <AuthProvider>
          <DesktopIntegrationProvider>
            <POSProvider>
              <Router>
          <Routes>
            {/* ── Super Admin Routes (fully isolated) ── */}
            <Route path="/superadmin/login" element={<SuperAdminLogin />} />
            <Route path="/superadmin" element={
              <SuperAdminGuard>
                <SuperAdminLayout />
              </SuperAdminGuard>
            }>
              <Route index element={<SuperAdminDashboard />} />
              <Route path="tenants" element={<TenantsList />} />
              <Route path="tenants/new" element={<AddEditTenant />} />
              <Route path="tenants/:id" element={<TenantDetails />} />
              <Route path="tenants/:id/edit" element={<AddEditTenant />} />
              <Route path="modules" element={<SystemModules />} />
            </Route>

            {/* ── Main ERP App Routes ── */}
            <Route path="/login" element={<Login />} />
            
            <Route element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/pos/customers" element={<PosCustomers />} />
              <Route path="/pos/reports" element={<POSReports />} />
              <Route path="/pos/settings" element={<POSSettings />} />
              <Route path="/branch-management" element={<BranchManagement />} />
              <Route path="/inventory">
                <Route index element={<InventoryDashboard />} />
                <Route path="warehouses" element={<Warehouses />} />
                <Route path="warehouses/:id" element={<WarehouseDetails />} />
                <Route path="products" element={<Products />} />
                <Route path="products/add" element={<AddProduct />} />
                <Route path="products/edit/:id" element={<AddProduct />} />
                <Route path="item-map" element={<ItemMap />} />
                <Route path="product-ledger" element={<ProductLedger />} />
                <Route path="product-units" element={<ProductUnits />} />
                <Route path="bulk-product-edit" element={<BulkProductEdit />} />
                <Route path="receipt" element={<GoodsReceipt />} />
                <Route path="sales-returns" element={<SalesReturns />} />
                <Route path="transfer-receipt" element={<TransferReceipt />} />
                <Route path="purchase-returns" element={<PurchaseReturns />} />
                <Route path="stock-issue" element={<StockIssue />} />
                <Route path="branch-transfer-request" element={<BranchTransferRequest />} />
                <Route path="transfers" element={<StockTransfers />} />
                <Route path="opening-balance" element={<OpeningBalance />} />
                <Route path="stock-taking" element={<StockTaking />} />
                <Route path="approval" element={<InventoryApproval />} />
                <Route path="reports" element={<InventoryReports />} />
                <Route path="accounts-payable" element={<AccountsPayable />} />
              </Route>
              <Route path="/accounting">
                <Route index element={<AccountingDashboard />} />
                <Route path="accounts" element={<ChartOfAccounts />} />
                <Route path="cost-centers" element={<CostCenters />} />
                <Route path="journal" element={<JournalEntries />} />
                <Route path="cash" element={<CashTransactions />} />
                <Route path="currencies" element={<Currencies />} />
                <Route path="check-stages" element={<CheckStages />} />
                <Route path="taxes" element={<Taxes />} />
              </Route>
              <Route path="/sales">
                <Route index element={<SalesDashboard />} />
                <Route path="basic/:subview" element={<SalesBasicData />} />
                <Route path="config/:subview" element={<SalesConfig />} />
                <Route path="docs/:subview" element={<SalesDocuments />} />
                <Route path="approvals/:subview" element={<SalesApprovals />} />
                <Route path="reports/:subview" element={<SalesReports />} />
              </Route>
              <Route path="/customers" element={<Customers />} />
              <Route path="/admin/cashiers" element={<CashierManagement />} />
              <Route path="/admin/pos" element={<AdminPOS />} />
              <Route path="/sales/history" element={<SalesHistory />} />
              <Route path="/cash/reports" element={<CashReports />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/center" element={<ReportsCenter />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </POSProvider>
        </DesktopIntegrationProvider>
      </AuthProvider>
    </SuperAdminProvider>
    </ThemeProvider>
  );
}
