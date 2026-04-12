import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const VARIANTS = {
  primary: 'bg-blush text-white hover:bg-blush/80',
  dark:    'bg-charcoal text-white hover:bg-charcoal/90',
  ghost:   'border border-beige text-warm-gray hover:bg-ivory',
  danger:  'border border-red-200 text-red-500 hover:bg-red-50',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm min-h-[44px]',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
