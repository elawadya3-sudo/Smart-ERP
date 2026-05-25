import React, { useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
} from '@tanstack/react-table';
import { Account } from '../../../types';
import { formatCurrency, cn } from '../../../lib/utils';
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Edit2, Trash2 } from 'lucide-react';

interface Props {
  accounts: Account[];
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
}

const columnHelper = createColumnHelper<Account>();

export const AccountDataTable: React.FC<Props> = ({ accounts, onEdit, onDelete }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = [
    columnHelper.accessor('code', {
      header: 'كود الحساب',
      cell: info => <span className="font-mono text-sm text-gray-500 font-bold">{info.getValue()}</span>,
    }),
    columnHelper.accessor('name', {
      header: 'اسم الحساب',
      cell: info => <span className="font-bold text-gray-900">{info.getValue()}</span>,
    }),
    columnHelper.accessor('type', {
      header: 'النوع',
      cell: info => {
        const val = info.getValue();
        const colors: Record<string, string> = {
          ASSET: 'text-blue-600 bg-blue-50',
          LIABILITY: 'text-red-600 bg-red-50',
          EQUITY: 'text-purple-600 bg-purple-50',
          REVENUE: 'text-green-600 bg-green-50',
          EXPENSE: 'text-orange-600 bg-orange-50',
        };
        const labels: Record<string, string> = {
          ASSET: 'أصول',
          LIABILITY: 'خصوم',
          EQUITY: 'حقوق ملكية',
          REVENUE: 'إيرادات',
          EXPENSE: 'مصاريف',
        };
        return (
          <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", colors[val] || 'text-gray-600 bg-gray-50')}>
            {labels[val] || val}
          </span>
        );
      },
    }),
    columnHelper.accessor('nature', {
      header: 'الطبيعة',
      cell: info => (
        <span className="text-xs font-bold text-gray-500">
          {info.getValue() === 'DEBIT' ? 'مدين' : 'دائن'}
        </span>
      ),
    }),
    columnHelper.accessor('balance', {
      header: 'الرصيد',
      cell: info => (
        <span className={cn("font-black", info.getValue() >= 0 ? "text-gray-900" : "text-red-500")}>
          {formatCurrency(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('isActive', {
      header: 'الحالة',
      cell: info => (
        info.getValue() 
          ? <span className="text-green-600 flex items-center gap-1.5 text-sm font-bold"><span className="w-2 h-2 rounded-full bg-green-500"></span> نشط</span>
          : <span className="text-gray-400 flex items-center gap-1.5 text-sm font-bold"><span className="w-2 h-2 rounded-full bg-gray-300"></span> موقوف</span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'الإجراءات',
      cell: props => (
        <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(props.row.original)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(props.row.original.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: accounts,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute right-4 top-3.5 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="البحث في جميع الحسابات..."
            className="w-full bg-white border border-gray-200 rounded-xl pr-12 pl-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-gray-50/80 text-sm text-gray-400 uppercase font-black tracking-widest border-b border-gray-100">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    className="px-6 py-5 cursor-pointer hover:bg-gray-100 transition-colors select-none group/header"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="text-gray-300 group-hover/header:text-gray-400 transition-colors">
                        {{
                          asc: <ChevronUp className="w-4 h-4" />,
                          desc: <ChevronDown className="w-4 h-4" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-50">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-blue-50/30 transition-colors group">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400 font-bold">
                  لا توجد نتائج مطابقة للبحث
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="text-sm font-bold text-gray-500">
          عرض {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} إلى {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} من أصل {table.getFilteredRowModel().rows.length} حساب
        </div>
        <div className="flex gap-2">
          <button
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
