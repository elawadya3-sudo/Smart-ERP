import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../../context/AuthContext';

export default function MainLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Redirect cashiers to POS if they try to access unauthorized pages
  const allowedPaths = ['/pos', '/branch-management'];
  if (user?.role?.toUpperCase() === 'CASHIER' && !allowedPaths.includes(location.pathname)) {
    return <Navigate to="/pos" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-row-reverse" dir="rtl">
      <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />
      <div className="flex-1 mr-0 lg:mr-64 transition-all duration-300 w-full">
        <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="p-4 md:p-6 lg:p-8 pb-24 lg:pb-12 max-w-[1600px] mx-auto w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


