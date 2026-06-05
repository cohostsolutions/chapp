import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

const gapClasses = {
  sm: 'gap-2 lg:gap-3',
  md: 'gap-3 lg:gap-4',
  lg: 'gap-4 lg:gap-6',
};

/**
 * Responsive grid component for consistent layouts across breakpoints
 */
export function ResponsiveGrid({
  children,
  columns = { default: 1, sm: 2, lg: 3, xl: 4 },
  gap = 'md',
  className,
}: ResponsiveGridProps) {
  const gridCols = [
    columns.default && `grid-cols-${columns.default}`,
    columns.sm && `sm:grid-cols-${columns.sm}`,
    columns.md && `md:grid-cols-${columns.md}`,
    columns.lg && `lg:grid-cols-${columns.lg}`,
    columns.xl && `xl:grid-cols-${columns.xl}`,
  ].filter(Boolean).join(' ');

  return (
    <div className={cn('grid', gridCols, gapClasses[gap], className)}>
      {children}
    </div>
  );
}

interface ResponsiveStackProps {
  children: React.ReactNode;
  direction?: 'vertical' | 'horizontal' | 'responsive';
  gap?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  className?: string;
}

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyClasses = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
};

/**
 * Responsive stack (flex) component for consistent spacing and alignment
 */
export function ResponsiveStack({
  children,
  direction = 'vertical',
  gap = 'md',
  align = 'stretch',
  justify = 'start',
  className,
}: ResponsiveStackProps) {
  const directionClass = direction === 'vertical' 
    ? 'flex-col'
    : direction === 'horizontal'
    ? 'flex-row'
    : 'flex-col sm:flex-row';

  return (
    <div 
      className={cn(
        'flex',
        directionClass,
        gapClasses[gap],
        alignClasses[align],
        justifyClasses[justify],
        className
      )}
    >
      {children}
    </div>
  );
}

interface MobileHiddenProps {
  children: React.ReactNode;
  breakpoint?: 'sm' | 'md' | 'lg';
}

/**
 * Hide content on mobile devices
 */
export function MobileHidden({ children, breakpoint = 'md' }: MobileHiddenProps) {
  const classes = {
    sm: 'hidden sm:block',
    md: 'hidden md:block',
    lg: 'hidden lg:block',
  };
  
  return <div className={classes[breakpoint]}>{children}</div>;
}

/**
 * Show content only on mobile devices
 */
export function MobileOnly({ children, breakpoint = 'md' }: MobileHiddenProps) {
  const classes = {
    sm: 'block sm:hidden',
    md: 'block md:hidden',
    lg: 'block lg:hidden',
  };
  
  return <div className={classes[breakpoint]}>{children}</div>;
}
