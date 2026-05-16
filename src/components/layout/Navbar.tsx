import { Search, Bell, User as UserIcon, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { auth } from '../../lib/firebase';

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-100 sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1 lg:w-96 lg:flex-none">
        <button 
          onClick={onMenuClick}
          className="p-2 -mr-2 text-gray-500 hover:bg-gray-50 rounded-xl lg:hidden transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="relative w-full group hidden sm:block max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute right-4 top-2.5 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="بحث عن فاتورة، منتج، أو عميل..." 
            className="w-full bg-gray-50 border border-gray-200 rounded-full py-2 px-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        <div className="hidden lg:flex items-center gap-2 text-sm font-bold text-gray-500 bg-gray-50 py-1.5 px-3 rounded-lg border border-gray-100">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>متصل بـ فرع القاهرة الرئيسي</span>
        </div>

        <div className="hidden lg:block h-8 w-px bg-gray-100" />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-left hidden sm:block">
            <p className="text-sm font-black text-gray-900 leading-none">{user?.name || 'مدير النظام'}</p>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">
              {user?.role?.toUpperCase() === 'ADMIN' ? 'Administrator' : 'Staff'}
            </p>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all group flex items-center gap-2 min-h-[44px] min-w-[44px] justify-center"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-bold hidden lg:block">خروج</span>
          </button>
        </div>

        <button className="relative p-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 left-2.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
        </button>

        <button className="hidden sm:block bg-blue-600 text-white px-4 lg:px-5 py-2 rounded-lg font-bold text-sm shadow-sm shadow-blue-100 hover:bg-blue-700 transition-colors min-h-[44px]">
          عملية بيع سريعة +
        </button>
      </div>
    </header>
  );
}


