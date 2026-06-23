import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { LucideIcon, ChevronLeft, X, Search } from 'lucide-react';

/* ─── 1. PAGE ANIMATED LAYOUT WRAPPER ────────────────────────────────────────── */
interface ErpPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function ErpPageLayout({ children, className }: ErpPageLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn("space-y-6 pb-20 w-full text-right", className)}
      dir="rtl"
    >
      {children}
    </motion.div>
  );
}

/* ─── 2. BREADCRUMBS ─────────────────────────────────────────────────────────── */
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ErpBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function ErpBreadcrumbs({ items }: ErpBreadcrumbsProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold mb-1.5 select-none" dir="rtl">
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />}
          {item.href ? (
            <a href={item.href} className="hover:text-blue-600 transition-colors">
              {item.label}
            </a>
          ) : (
            <span className={cn(idx === items.length - 1 ? "text-blue-600 font-extrabold" : "")}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ─── 3. PAGE HEADER (Odoo Control Panel style) ──────────────────────────────── */
interface ErpPageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  stats?: React.ReactNode;
  className?: string;
}

export function ErpPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  stats,
  className
}: ErpPageHeaderProps) {
  return (
    <div className={cn("bg-slate-50 border-b border-slate-200 rounded p-3 sm:px-4 sm:py-2.5 shadow-none select-none", className)} dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="space-y-0.5">
          {breadcrumbs && <ErpBreadcrumbs items={breadcrumbs} />}
          <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
            {title}
          </h1>
          {description && (
            <p className="text-[11px] text-slate-400 font-semibold mt-1">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto shrink-0">
            {actions}
          </div>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-200">
          {stats}
        </div>
      )}
    </div>
  );
}

/* ─── 4. STATISTICS CARD (Dashboard Widget / Stat Card) ─────────────────────── */
export type StatCardColor = 'blue' | 'indigo' | 'purple' | 'emerald' | 'red' | 'amber' | 'slate';

interface ErpStatCardProps {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  color?: StatCardColor;
  change?: string;
  trend?: 'up' | 'down' | 'none';
  onClick?: () => void;
  className?: string;
}

const colorMap: Record<StatCardColor, { bg: string, iconBg: string, iconColor: string, text: string, trendBg?: string }> = {
  blue: { bg: 'bg-blue-50/70 hover:bg-blue-50 border-blue-100/50', iconBg: 'bg-blue-100/80', iconColor: 'text-blue-600', text: 'text-blue-700' },
  indigo: { bg: 'bg-indigo-50/70 hover:bg-indigo-50 border-indigo-100/50', iconBg: 'bg-indigo-100/80', iconColor: 'text-indigo-600', text: 'text-indigo-700' },
  purple: { bg: 'bg-purple-50/70 hover:bg-purple-50 border-purple-100/50', iconBg: 'bg-purple-100/80', iconColor: 'text-purple-600', text: 'text-purple-700' },
  emerald: { bg: 'bg-emerald-50/70 hover:bg-emerald-50 border-emerald-100/50', iconBg: 'bg-emerald-100/80', iconColor: 'text-emerald-600', text: 'text-emerald-700' },
  red: { bg: 'bg-red-50/70 hover:bg-red-50 border-red-100/50', iconBg: 'bg-red-100/80', iconColor: 'text-red-600', text: 'text-red-700' },
  amber: { bg: 'bg-amber-50/70 hover:bg-amber-50 border-amber-100/50', iconBg: 'bg-amber-100/80', iconColor: 'text-amber-600', text: 'text-amber-700' },
  slate: { bg: 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/50', iconBg: 'bg-slate-100/80', iconColor: 'text-slate-500', text: 'text-slate-700' }
};

export function ErpStatCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  change,
  trend,
  onClick,
  className
}: ErpStatCardProps) {
  const styles = colorMap[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded border p-2.5 flex items-center justify-between gap-3 shadow-none bg-white border-slate-200",
        onClick ? "cursor-pointer select-none" : "",
        className
      )}
    >
      <div className="space-y-0.5 text-right">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
          {title}
        </p>
        <p className="text-base font-black text-slate-900 leading-none mt-1">
          {value}
        </p>
        {change && (
          <div className="flex items-center gap-1 mt-1">
            <span className={cn(
              "text-[9px] font-bold px-1 py-0.25 rounded",
              trend === 'up' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
              trend === 'down' ? "bg-red-50 text-red-600 border border-red-100" : "bg-slate-50 text-slate-500"
            )}>
              {change}
            </span>
          </div>
        )}
      </div>

      <div className={cn("w-7.5 h-7.5 rounded flex items-center justify-center shrink-0 shadow-none", styles.iconBg)}>
        <Icon className={cn("w-4 h-4", styles.iconColor)} />
      </div>
    </div>
  );
}

/* ─── 5. CARD WRAPPER ────────────────────────────────────────────────────────── */
interface ErpCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
}

export function ErpCard({
  children,
  title,
  subtitle,
  headerActions,
  className,
  ...props
}: ErpCardProps) {
  return (
    <div
      className={cn(
        "rounded border border-slate-200 bg-white p-3.5 shadow-none text-right",
        className
      )}
      {...props}
    >
      {(title || subtitle || headerActions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 mb-2.5 select-none">
          <div className="space-y-0.5">
            {title && <h3 className="text-xs font-bold text-slate-950">{title}</h3>}
            {subtitle && <p className="text-[10px] text-slate-400 font-semibold">{subtitle}</p>}
          </div>
          {headerActions && <div className="flex items-center gap-1.5">{headerActions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ─── 6. TABLE ───────────────────────────────────────────────────────────────── */
interface ErpTableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export function ErpTable({ headers, children, className }: ErpTableProps) {
  return (
    <div className={cn("overflow-x-auto border border-slate-200 rounded bg-white shadow-none scrollbar-thin", className)}>
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 select-none">
            {headers.map((h, idx) => (
              <th
                key={idx}
                className="py-2 px-3 text-[11px] font-bold text-slate-600 tracking-wider uppercase whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-semibold text-xs text-slate-700">
          {children}
        </tbody>
      </table>
    </div>
  );
}

/* ─── 7. STATUS BADGE ────────────────────────────────────────────────────────── */
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'primary' | 'secondary' | 'indigo' | 'amber';

interface ErpBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const badgeVariants: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-600 border border-emerald-100/60',
  warning: 'bg-amber-50 text-amber-600 border border-amber-100/60',
  danger: 'bg-red-50 text-red-600 border border-red-100/60',
  primary: 'bg-blue-50 text-blue-600 border border-blue-100/60',
  secondary: 'bg-slate-50 text-slate-500 border border-slate-200/60',
  indigo: 'bg-indigo-50 text-indigo-600 border border-indigo-100/60',
  amber: 'bg-orange-50 text-orange-600 border border-orange-100/60'
};

export function ErpBadge({ children, variant = 'primary', className }: ErpBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold tracking-wide select-none",
      badgeVariants[variant],
      className
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full shrink-0",
        variant === 'success' ? "bg-emerald-500" :
        variant === 'warning' ? "bg-amber-500" :
        variant === 'danger' ? "bg-red-500" :
        variant === 'primary' ? "bg-blue-500" :
        variant === 'secondary' ? "bg-slate-400" :
        variant === 'indigo' ? "bg-indigo-500" : "bg-orange-500"
      )} />
      {children}
    </span>
  );
}

/* ─── 8. UNIFIED LABELS & FORM COMPONENTS ─────────────────────────────────────── */
interface ErpLabelProps {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}

export function ErpLabel({ children, required, className }: ErpLabelProps) {
  return (
    <label className={cn("block text-[10px] font-bold text-slate-400 select-none mb-1 text-right", className)}>
      {children}
      {required && <span className="text-red-500 mr-0.5">*</span>}
    </label>
  );
}

interface ErpFormGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function ErpFormGrid({ children, columns = 3, className }: ErpFormGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };
  return (
    <div className={cn("grid gap-3 text-right", gridCols[columns], className)} dir="rtl">
      {children}
    </div>
  );
}

interface ErpInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export const ErpInput = React.forwardRef<HTMLInputElement, ErpInputProps>(
  ({ label, error, required, className, ...props }, ref) => {
    return (
      <div className="space-y-1 w-full text-right">
        {label && <ErpLabel required={required}>{label}</ErpLabel>}
        <input
          ref={ref}
          className={cn(
            "w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white text-right",
            error ? "border-red-300 focus:border-red-500" : "",
            className
          )}
          {...props}
        />
        {error && <p className="text-[10px] text-red-500 font-bold select-none">{error}</p>}
      </div>
    );
  }
);
ErpInput.displayName = 'ErpInput';

interface ErpSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}

export const ErpSelect = React.forwardRef<HTMLSelectElement, ErpSelectProps>(
  ({ label, error, required, options, placeholder, className, ...props }, ref) => {
    return (
      <div className="space-y-1 w-full text-right">
        {label && <ErpLabel required={required}>{label}</ErpLabel>}
        <select
          ref={ref}
          className={cn(
            "w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white text-right appearance-none cursor-pointer",
            error ? "border-red-300 focus:border-red-500" : "",
            className
          )}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt, idx) => (
            <option key={idx} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-[10px] text-red-500 font-bold select-none">{error}</p>}
      </div>
    );
  }
);
ErpSelect.displayName = 'ErpSelect';

interface ErpTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export const ErpTextarea = React.forwardRef<HTMLTextAreaElement, ErpTextareaProps>(
  ({ label, error, required, className, ...props }, ref) => {
    return (
      <div className="space-y-1 w-full text-right">
        {label && <ErpLabel required={required}>{label}</ErpLabel>}
        <textarea
          ref={ref}
          className={cn(
            "w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white text-right min-h-[60px]",
            error ? "border-red-300 focus:border-red-500" : "",
            className
          )}
          {...props}
        />
        {error && <p className="text-[10px] text-red-500 font-bold select-none">{error}</p>}
      </div>
    );
  }
);
ErpTextarea.displayName = 'ErpTextarea';

interface ErpCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const ErpCheckbox = React.forwardRef<HTMLInputElement, ErpCheckboxProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1 text-right">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            ref={ref}
            type="checkbox"
            className={cn(
              "w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer",
              className
            )}
            {...props}
          />
          <span className="text-xs font-bold text-slate-700">{label}</span>
        </label>
        {error && <p className="text-[10px] text-red-500 font-bold select-none">{error}</p>}
      </div>
    );
  }
);
ErpCheckbox.displayName = 'ErpCheckbox';

interface ErpToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function ErpToggle({ checked, onChange, label, className }: ErpToggleProps) {
  return (
    <div className={cn("flex items-center gap-2 text-right select-none", className)}>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
          checked ? "bg-blue-600" : "bg-slate-200"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
            checked ? "-translate-x-4" : "translate-x-0"
          )}
        />
      </button>
      {label && <span className="text-xs font-bold text-slate-700">{label}</span>}
    </div>
  );
}

/* ─── 9. BUTTONS ─────────────────────────────────────────────────────────────── */
interface ErpButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'indigo';
  icon?: LucideIcon;
  loading?: boolean;
}

export function ErpButton({
  children,
  variant = 'primary',
  icon: Icon,
  loading = false,
  className,
  ...props
}: ErpButtonProps) {
  const baseClass = "inline-flex items-center justify-center gap-1.5 rounded text-xs font-bold select-none transition active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  
  const variants = {
    primary: "bg-blue-600 text-white px-3 py-1.5 hover:bg-blue-700",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-950 hover:border-slate-300 px-3 py-1.5",
    tertiary: "bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100 hover:text-slate-700 px-3 py-1.5",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:text-red-700 px-3 py-1.5",
    indigo: "bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700"
  };

  return (
    <button
      className={cn(baseClass, variants[variant], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 shrink-0" />
      ) : null}
      {children}
    </button>
  );
}

/* ─── 10. TABS WRAPPER ────────────────────────────────────────────────────────── */
interface ErpTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface ErpTabsProps {
  tabs: ErpTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function ErpTabs({ tabs, activeTab, onChange, className }: ErpTabsProps) {
  return (
    <div className={cn("flex items-center gap-0.5 bg-white border border-slate-200 rounded p-0.5 w-fit shadow-none select-none", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-3 py-1 text-xs font-bold transition rounded-sm flex items-center gap-1.5",
              isActive
                ? "bg-blue-600 text-white font-extrabold"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── 11. MODAL / DIALOG SYSTEM ──────────────────────────────────────────────── */
interface ErpModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ErpModal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'md'
}: ErpModalProps) {
  if (!isOpen) return null;
  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
      
      {/* Modal Card */}
      <div className={cn("relative w-full bg-white rounded border border-slate-200 shadow-xl flex flex-col max-h-[90vh] overflow-hidden", sizeClass[size])} dir="rtl">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 select-none">
          <h3 className="text-xs font-black text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 text-right scrollbar-thin">
          {children}
        </div>
        {actions && (
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex justify-end gap-1.5 shrink-0 select-none">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 12. SEARCH INPUT ───────────────────────────────────────────────────────── */
interface ErpSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export function ErpSearch({ onClear, className, ...props }: ErpSearchProps) {
  return (
    <div className="relative w-full text-right" dir="rtl">
      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      <input
        type="text"
        className={cn(
          "w-full bg-slate-50 border border-slate-200 rounded pr-8 pl-8 py-1.5 text-xs font-semibold outline-none transition focus:border-blue-500 focus:bg-white text-right",
          className
        )}
        {...props}
      />
      {props.value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold focus:outline-none cursor-pointer"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ─── 13. FILTER BAR ─────────────────────────────────────────────────────────── */
interface ErpFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function ErpFilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'البحث...',
  filters,
  actions,
  className
}: ErpFilterBarProps) {
  return (
    <div className={cn("bg-white border border-slate-200 rounded p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-none select-none", className)} dir="rtl">
      <div className="flex flex-1 flex-col sm:flex-row items-center gap-2 w-full md:max-w-2xl">
        <div className="w-full sm:max-w-xs">
          <ErpSearch
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onClear={() => onSearchChange('')}
            placeholder={searchPlaceholder}
          />
        </div>
        {filters && (
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {filters}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 shrink-0 w-full md:w-auto justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

/* ─── 14. REPORT LAYOUT ──────────────────────────────────────────────────────── */
export function ErpReportLayout({
  title,
  description,
  breadcrumbs,
  filterBar,
  stats,
  children,
  footerSummaries,
  className
}: {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  filterBar?: React.ReactNode;
  stats?: React.ReactNode;
  children: React.ReactNode;
  footerSummaries?: React.ReactNode;
  className?: string;
}) {
  return (
    <ErpPageLayout className={cn("space-y-4", className)}>
      <ErpPageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        stats={stats}
      />
      {filterBar}
      <div className="bg-white border border-slate-200 rounded shadow-none overflow-hidden text-right">
        {children}
        {footerSummaries && (
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-4 text-xs font-black text-slate-700 select-none">
            {footerSummaries}
          </div>
        )}
      </div>
    </ErpPageLayout>
  );
}

/* ─── 15. CHART CARD CONTAINER (Dashboard Widget) ───────────────────────────── */
interface ErpChartCardProps {
  title: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string;
}

export function ErpChartCard({ title, children, headerActions, className }: ErpChartCardProps) {
  return (
    <div className={cn("rounded border border-slate-200 bg-white p-3.5 shadow-none flex flex-col min-h-[300px] text-right", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 mb-3 select-none">
        <h3 className="text-xs font-black text-slate-900">{title}</h3>
        {headerActions && <div className="flex items-center gap-1.5">{headerActions}</div>}
      </div>
      <div className="flex-1 flex items-center justify-center min-h-0">
        {children}
      </div>
    </div>
  );
}
