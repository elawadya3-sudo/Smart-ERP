import {
  FilePlus,
  Save,
  Pencil,
  Trash2,
  Copy,
  Printer,
  FileDown,
  FileSpreadsheet,
  RefreshCw,
  Search,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface PageToolbarProps {
  title?: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onNew?: () => void;
  onSave?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onPrint?: () => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  onRefresh?: () => void;
  compact?: boolean;
}

export default function PageToolbar({
  title,
  subtitle,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'بحث سريع...',
  onNew,
  onSave,
  onEdit,
  onDelete,
  onCopy,
  onPrint,
  onExportPdf,
  onExportExcel,
  onRefresh,
  compact = false,
}: PageToolbarProps) {
  const buttonClass = 'erp-toolbar-btn';

  return (
    <div className="erp-card mb-6 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          {title && <h3 className="text-lg font-bold text-slate-900">{title}</h3>}
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNew && (
            <button className={buttonClass} onClick={onNew}>
              <FilePlus className="h-4 w-4" />
              جديد
            </button>
          )}
          {onSave && (
            <button className={buttonClass} onClick={onSave}>
              <Save className="h-4 w-4" />
              حفظ
            </button>
          )}
          {onEdit && (
            <button className={buttonClass} onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              تعديل
            </button>
          )}
          {onDelete && (
            <button className={cn(buttonClass, 'text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700')} onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              حذف
            </button>
          )}
          {onCopy && (
            <button className={buttonClass} onClick={onCopy}>
              <Copy className="h-4 w-4" />
              نسخ
            </button>
          )}
          {onPrint && (
            <button className={buttonClass} onClick={onPrint}>
              <Printer className="h-4 w-4" />
              طباعة
            </button>
          )}
          {onExportPdf && (
            <button className={buttonClass} onClick={onExportPdf}>
              <FileDown className="h-4 w-4" />
              PDF
            </button>
          )}
          {onExportExcel && (
            <button className={buttonClass} onClick={onExportExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
          )}
          {onRefresh && (
            <button className={buttonClass} onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              تحديث
            </button>
          )}
        </div>
      </div>

      {onSearchChange && (
        <div className="p-4">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="erp-input pr-11"
            />
          </div>
        </div>
      )}
    </div>
  );
}
