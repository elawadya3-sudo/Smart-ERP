import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../../context/AuthContext';

export default function MainLayout() {
  const { user } = useAuth();
  const location = useLocation();

  // Redirect cashiers to POS if they try to access unauthorized pages
  const allowedPaths = ['/pos', '/branch-management'];
  if (user?.role?.toUpperCase() === 'CASHIER' && !allowedPaths.includes(location.pathname)) {
    return <Navigate to="/pos" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-row-reverse" dir="rtl">
      <Sidebar />
      <div className="flex-1 mr-64">
        <Navbar />
        <main className="p-8 pb-12 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


