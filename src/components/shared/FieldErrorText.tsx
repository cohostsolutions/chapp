import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldErrorTextProps {
  id?: string;
  message?: string;
  className?: string;
}

export function FieldErrorText({ id, message, className }: FieldErrorTextProps) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={cn('flex items-start gap-1.5 text-sm text-destructive', className)}
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}