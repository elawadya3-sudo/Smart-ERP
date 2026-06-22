import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { LucideIcon, ChevronLeft } from 'lucide-react';

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

/* ─── 2. BREADCRUMBS (STANDARDIZED INTEGRATED OR GENERAL) ────────────────────── */
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ErpBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function ErpBreadcrumbs({ items }: ErpBreadcrumbsProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold mb-1.5 select-none">
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

/* ─── 3. PAGE HEADER ─────────────────────────────────────────────────────────── */
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
    <div className={cn("bg-white border-b border-slate-100 rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.02)]", className)}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div className="space-y-0.5">
          {breadcrumbs && <ErpBreadcrumbs items={breadcrumbs} />}
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-slate-400 font-bold mt-1">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0">
            {actions}
          </div>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100/80">
          {stats}
        </div>
      )}
    </div>
  );
}

/* ─── 4. STATISTICS CARD ─────────────────────────────────────────────────────── */
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
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 sm:p-5 flex items-center justify-between gap-4 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.01)]",
        styles.bg,
        onClick ? "cursor-pointer select-none" : "",
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none">
          {title}
        </p>
        <p className="text-xl sm:text-2xl font-black text-slate-900 leading-none mt-1">
          {value}
        </p>
        {change && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded",
              trend === 'up' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
              trend === 'down' ? "bg-red-50 text-red-600 border border-red-100" : "bg-slate-50 text-slate-500"
            )}>
              {change}
            </span>
          </div>
        )}
      </div>

      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", styles.iconBg)}>
        <Icon className={cn("w-5 h-5", styles.iconColor)} />
      </div>
    </motion.div>
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
        "rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.025)] transition-all duration-300",
        className
      )}
      {...props}
    >
      {(title || subtitle || headerActions) && (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4 select-none">
          <div className="space-y-0.5">
            {title && <h3 className="text-base font-black text-slate-950">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 font-bold">{subtitle}</p>}
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
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
    <div className={cn("overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-sm scrollbar-thin", className)}>
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-100/90 select-none">
            {headers.map((h, idx) => (
              <th
                key={idx}
                className="py-4 px-5 text-xs font-black text-slate-400 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 font-medium text-sm text-slate-700">
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

/* ─── 8. INPUT AND SELECT ────────────────────────────────────────────────────── */
interface ErpInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const ErpInput = React.forwardRef<HTMLInputElement, ErpInputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label className="block text-xs font-extrabold text-slate-400 select-none">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/40 focus:bg-white text-right",
            error ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500 font-bold select-none">{error}</p>}
      </div>
    );
  }
);
ErpInput.displayName = 'ErpInput';

interface ErpSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}

export const ErpSelect = React.forwardRef<HTMLSelectElement, ErpSelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label className="block text-xs font-extrabold text-slate-400 select-none">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            "w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/40 focus:bg-white text-right appearance-none cursor-pointer",
            error ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "",
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
        {error && <p className="text-xs text-red-500 font-bold select-none">{error}</p>}
      </div>
    );
  }
);
ErpSelect.displayName = 'ErpSelect';

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
  const baseClass = "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-extrabold select-none transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-blue-600 text-white px-5 py-2.5 shadow-sm shadow-blue-200 hover:bg-blue-700",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 px-4 py-2.5",
    tertiary: "bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100 hover:text-slate-700 px-4 py-2.5",
    danger: "bg-red-50 text-red-600 border border-red-100/60 hover:bg-red-100/80 hover:text-red-700 px-4 py-2.5",
    indigo: "bg-indigo-600 text-white px-5 py-2.5 shadow-sm shadow-indigo-200 hover:bg-indigo-700"
  };

  return (
    <button
      className={cn(baseClass, variants[variant], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
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
    <div className={cn("flex items-center gap-1 bg-white border border-slate-100 rounded-2xl p-1 w-fit shadow-sm select-none", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-5 py-2 text-sm font-bold transition-all rounded-xl flex items-center gap-2",
              isActive
                ? "bg-blue-600 text-white shadow-sm font-extrabold"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
