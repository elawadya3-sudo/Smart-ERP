import React from 'react';
import { Building2, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart } from 'lucide-react';
import { CostCenter } from '../../../types';
import { formatCurrency, cn } from '../../../lib/utils';
import { ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface Props {
  costCenters: CostCenter[];
}

export const CostCenterDashboard: React.FC<Props> = ({ costCenters }) => {
  const totalExpenses = costCenters.reduce((sum, cc) => sum + cc.expenses, 0);
  const totalRevenues = costCenters.reduce((sum, cc) => sum + cc.revenues, 0);
  const totalBudget = costCenters.reduce((sum, cc) => sum + cc.budget, 0);
  const netProfit = totalRevenues - totalExpenses;
  const remainingBudget = totalBudget - totalExpenses;

  const highestCostCenter = costCenters.reduce((prev, current) => {
    return (prev.expenses > current.expenses) ? prev : current;
  }, costCenters[0] || { name: 'N/A', expenses: 0 });

  const chartData = costCenters.slice(0, 5).map(cc => ({
    name: cc.name,
    الميزانية: cc.budget,
    المصروفات: cc.expenses,
    الإيرادات: cc.revenues
  }));

  return (
    <div className="space-y-6 mb-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-gray-400 uppercase">المراكز</span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gray-900">{costCenters.length}</h3>
            <p className="text-xs text-gray-500 font-bold mt-1">إجمالي مراكز التكلفة</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-gray-400 uppercase">المصروفات</span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-red-600">{formatCurrency(totalExpenses)}</h3>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2">
              <div className="bg-red-500 h-full rounded-full" style={{ width: `${Math.min((totalExpenses / (totalBudget || 1)) * 100, 100)}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-gray-400 uppercase">الإيرادات</span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-green-600">{formatCurrency(totalRevenues)}</h3>
            <p className="text-xs text-gray-500 font-bold mt-1">إجمالي إيرادات المراكز</p>
          </div>
        </div>

        <div className="bg-gray-900 text-white p-6 rounded-[2rem] shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-gray-400 uppercase">الصافي</span>
          </div>
          <div className="mt-4">
            <h3 className={cn("text-2xl font-black", netProfit >= 0 ? "text-green-400" : "text-red-400")}>
              {formatCurrency(netProfit)}
            </h3>
            <p className="text-xs text-gray-300 font-bold mt-1">صافي الربح / الخسارة</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <PieChart className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-gray-400 uppercase">الأعلى صرفاً</span>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-black text-gray-900 truncate">{highestCostCenter.name}</h3>
            <p className="text-xs text-red-500 font-bold mt-1">{formatCurrency(highestCostCenter.expenses)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
              <BarChart className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-gray-400 uppercase">الميزانية</span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-orange-600">{formatCurrency(remainingBudget)}</h3>
            <p className="text-xs text-gray-500 font-bold mt-1">الميزانية المتبقية</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
        <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2">
          <BarChart className="w-5 h-5 text-blue-600" />
          مقارنة الميزانية والأداء (أعلى 5 مراكز)
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 320 }}>
            <ReBarChart data={chartData} barGap={4}>
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 'bold' }} />
              <Bar dataKey="الميزانية" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
