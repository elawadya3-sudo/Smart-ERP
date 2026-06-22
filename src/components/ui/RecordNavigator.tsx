import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RecordNavigatorProps {
  currentIndex: number;
  total: number;
  label?: string;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
}

export default function RecordNavigator({
  currentIndex,
  total,
  label = 'السجل',
  onFirst,
  onPrevious,
  onNext,
  onLast,
}: RecordNavigatorProps) {
  const safeTotal = Math.max(total, 0);
  const hasRecords = safeTotal > 0;
  const current = hasRecords ? currentIndex + 1 : 0;

  return (
    <div className="erp-card flex items-center justify-between gap-3 p-3">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={onFirst}
          disabled={!hasRecords || current === 1}
          className={cn(
            'erp-nav-btn',
            (!hasRecords || current === 1) && 'opacity-40 cursor-not-allowed'
          )}
          title="أول سجل"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
        <button
          onClick={onPrevious}
          disabled={!hasRecords || current === 1}
          className={cn(
            'erp-nav-btn',
            (!hasRecords || current === 1) && 'opacity-40 cursor-not-allowed'
          )}
          title="السجل السابق"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="min-w-[140px] rounded-xl bg-slate-50 px-4 py-2 text-center text-sm font-semibold text-slate-700">
          {hasRecords ? `${current} / ${safeTotal}` : 'لا توجد سجلات'}
        </div>

        <button
          onClick={onNext}
          disabled={!hasRecords || current === safeTotal}
          className={cn(
            'erp-nav-btn',
            (!hasRecords || current === safeTotal) && 'opacity-40 cursor-not-allowed'
          )}
          title="السجل التالي"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onLast}
          disabled={!hasRecords || current === safeTotal}
          className={cn(
            'erp-nav-btn',
            (!hasRecords || current === safeTotal) && 'opacity-40 cursor-not-allowed'
          )}
          title="آخر سجل"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
