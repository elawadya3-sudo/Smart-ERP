/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { POSProvider } from './context/POSContext';
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

export default function App() {
  return (
    <AuthProvider>
      <POSProvider>
        <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/branch-management" element={<BranchManagement />} />
            <Route path="/inventory">
              <Route index element={<InventoryDashboard />} />
              <Route path="warehouses" element={<Warehouses />} />
              <Route path="warehouses/:id" element={<WarehouseDetails />} />
              <Route path="products" element={<Products />} />
              <Route path="products/add" element={<AddProduct />} />
              <Route path="products/edit/:id" element={<AddProduct />} />
              <Route path="receipt" element={<GoodsReceipt />} />
              <Route path="transfers" element={<StockTransfers />} />
              <Route path="reports" element={<InventoryReports />} />
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
            <Route path="/customers" element={<Customers />} />
            <Route path="/admin/cashiers" element={<CashierManagement />} />
            <Route path="/sales/history" element={<SalesHistory />} />
            <Route path="/cash/reports" element={<CashReports />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Router>
    </POSProvider>
  </AuthProvider>
  );
}



