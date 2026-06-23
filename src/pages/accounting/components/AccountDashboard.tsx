import React from 'react';
import { Wallet, TrendingUp, Building2, Layers } from 'lucide-react';
import { Account } from '../../../types';
import { formatCurrency } from '../../../lib/utils';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis } from 'recharts';

interface Props {
  accounts: Account[];
}

export const AccountDashboard: React.FC<Props> = ({ accounts }) => {
  const totalAssets = accounts.filter(a => a.type === 'ASSET').reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === 'LIABILITY').reduce((sum, a) => sum + a.balance, 0);
  const totalRevenue = accounts.filter(a => a.type === 'REVENUE').reduce((sum, a) => sum + a.balance, 0);
  const totalExpenses = accounts.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + a.balance, 0);
  
  const activeCount = accounts.filter(a => a.isActive).length;

  // Mock data for the sparkline chart
  const sparklineData = [
    { name: 'Jan', value: 4000 },
    { name: 'Feb', value: 3000 },
    { name: 'Mar', value: 5000 },
    { name: 'Apr', value: 4500 },
    { name: 'May', value: 6000 },
    { name: 'Jun', value: 5500 },
    { name: 'Jul', value: totalAssets }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
        <div className="flex items-center gap-4 relative z-10 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">إجمالي الأصول</p>
            <h3 className="text-2xl font-black text-gray-900">{formatCurrency(totalAssets)}</h3>
          </div>
        </div>
        <div className="h-12 w-full relative z-10 -mb-2">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 100, height: 48 }}>
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorBlue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-50/50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
        <div className="flex items-center gap-4 relative z-10 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">الالتزامات</p>
            <h3 className="text-2xl font-black text-gray-900">{formatCurrency(totalLiabilities)}</h3>
          </div>
        </div>
        <p className="text-sm text-red-500 font-bold relative z-10 flex items-center gap-1">
          <TrendingUp className="w-4 h-4" />
          مستقر حالياً
        </p>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-50/50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
        <div className="flex items-center gap-4 relative z-10 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">الإيرادات / المصاريف</p>
            <h3 className="text-xl font-black text-green-600">
              {formatCurrency(totalRevenue)} <span className="text-gray-300 text-sm mx-1">/</span> <span className="text-red-500">{formatCurrency(totalExpenses)}</span>
            </h3>
          </div>
        </div>
        <div className="w-full bg-gray-100 h-2 rounded-full mt-6 relative z-10 overflow-hidden flex">
          <div className="bg-green-500 h-full" style={{ width: `${(totalRevenue / ((totalRevenue + totalExpenses) || 1)) * 100}%` }}></div>
          <div className="bg-red-500 h-full" style={{ width: `${(totalExpenses / ((totalRevenue + totalExpenses) || 1)) * 100}%` }}></div>
        </div>
      </div>

      <div className="bg-gray-900 text-white p-6 rounded-[2rem] shadow-2xl relative overflow-hidden group flex flex-col justify-center">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-blue-300 uppercase tracking-widest">إجمالي الحسابات</p>
            <h3 className="text-3xl font-black">{accounts.length}</h3>
          </div>
        </div>
        <p className="text-sm text-gray-400 font-bold relative z-10 mt-4">
          <span className="text-green-400">{activeCount} حساب نشط</span> متاح للعمليات
        </p>
      </div>
    </div>
  );
};
