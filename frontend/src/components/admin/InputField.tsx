import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const BASE =
  'w-full rounded-[5px] border border-gray-200 bg-white text-sm text-charcoal placeholder:text-warm-gray outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:border-charcoal focus:shadow-[0_0_0_3px_rgba(0,0,0,0.05)]';

// ---------------------------------------------------------------------------
// InputField
// ---------------------------------------------------------------------------

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(({ className, ...props }, ref) => {
  return <input ref={ref} className={cn(BASE, 'px-3 py-2', className)} {...props} />;
});

InputField.displayName = 'InputField';

// ---------------------------------------------------------------------------
// TextareaField
// ---------------------------------------------------------------------------

export interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(({ className, ...props }, ref) => {
  return <textarea ref={ref} className={cn(BASE, 'px-3 py-2 resize-none', className)} {...props} />;
});

TextareaField.displayName = 'TextareaField';

// ---------------------------------------------------------------------------
// SelectField
// ---------------------------------------------------------------------------

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(({ className, children, ...props }, ref) => {
  return (
    <select ref={ref} className={cn(BASE, 'px-3 py-2', className)} {...props}>
      {children}
    </select>
  );
});

SelectField.displayName = 'SelectField';
