import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccessibleButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

/**
 * Button with built-in loading state, proper ARIA, and icon support
 */
export function AccessibleButton({
  children,
  isLoading,
  loadingText,
  icon,
  iconPosition = 'left',
  disabled,
  className,
  ...props
}: AccessibleButtonProps) {
  const isDisabled = disabled || isLoading;
  
  return (
    <Button
      disabled={isDisabled}
      aria-busy={isLoading}
      aria-disabled={isDisabled}
      className={cn(className)}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
          <span>{loadingText || 'Loading...'}</span>
          <span className="sr-only">Please wait</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span className="mr-2" aria-hidden="true">{icon}</span>
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <span className="ml-2" aria-hidden="true">{icon}</span>
          )}
        </>
      )}
    </Button>
  );
}

interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: React.ReactNode;
  label: string;
  showLabel?: boolean;
  isLoading?: boolean;
}

/**
 * Icon-only button with required aria-label for accessibility
 */
export function IconButton({
  icon,
  label,
  showLabel = false,
  isLoading,
  disabled,
  className,
  ...props
}: IconButtonProps) {
  const isDisabled = disabled || isLoading;
  
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isDisabled}
      aria-label={label}
      aria-busy={isLoading}
      className={cn("shrink-0", className)}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{icon}</span>
      )}
      {showLabel && <span className="sr-only">{label}</span>}
    </Button>
  );
}
