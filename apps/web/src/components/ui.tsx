import { clsx } from 'clsx';
import { ReactNode } from 'react';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white rounded-xl border border-zinc-200 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  color = 'emerald',
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  color?: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple';
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className={clsx('p-3 rounded-lg', colors[color])}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="text-2xl font-bold text-zinc-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export function Badge({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}) {
  const variants = {
    default: 'bg-zinc-100 text-zinc-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-rose-100 text-rose-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variants[variant])}>
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  ...props
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    secondary: 'bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50 shadow-sm',
    ghost: 'text-zinc-600 hover:bg-zinc-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  error,
  className,
  ...props
}: {
  label?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-zinc-700 mb-1.5">{label}</label>}
      <input
        className={clsx(
          'w-full px-3 py-2 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
          error ? 'border-rose-300' : 'border-zinc-300'
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-rose-500">{error}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-zinc-300 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-zinc-900 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-sm">{description}</p>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-zinc-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  );
}
