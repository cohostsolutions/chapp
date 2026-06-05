import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, MessageSquare, ShoppingBag, BedDouble, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div 
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        aria-hidden="true"
      >
        <Loader2 className={cn(sizeClasses[size], "text-primary")} />
      </motion.div>
      <p className={cn("text-sm text-muted-foreground", text ? "animate-pulse" : "sr-only")}>
        {text || 'Loading...'}
      </p>
    </div>
  );
}

// Animated dots for typing/processing indicator
export function TypingDots({ className }: { className?: string }) {
  return (
    <div 
      className={cn("flex items-center gap-1", className)}
      role="status"
      aria-label="Processing"
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-primary"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.2,
          }}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Processing...</span>
    </div>
  );
}

// Full page loading state with animated icon
interface PageLoadingProps {
  type?: 'default' | 'leads' | 'orders' | 'bookings' | 'chat';
  message?: string;
}

export function PageLoading({ type = 'default', message }: PageLoadingProps) {
  const icons = {
    default: Loader2,
    leads: Users,
    orders: ShoppingBag,
    bookings: BedDouble,
    chat: MessageSquare,
  };
  
  const Icon = icons[type];
  const defaultMessages = {
    default: 'Loading...',
    leads: 'Loading leads...',
    orders: 'Loading orders...',
    bookings: 'Loading bookings...',
    chat: 'Connecting to AI...',
  };

  return (
    <div 
      className="min-h-[400px] flex flex-col items-center justify-center gap-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative"
        aria-hidden="true"
      >
        <motion.div
          className="absolute inset-0 bg-primary/20 rounded-full blur-xl"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <motion.div
            animate={type === 'default' ? { rotate: 360 } : { scale: [1, 1.1, 1] }}
            transition={{ duration: type === 'default' ? 1 : 1.5, repeat: Infinity, ease: 'linear' }}
          >
            <Icon className="w-10 h-10 text-primary" />
          </motion.div>
        </div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <p className="text-lg font-medium text-foreground">{message || defaultMessages[type]}</p>
        <TypingDots className="mt-3 justify-center" />
      </motion.div>
    </div>
  );
}

// Inline loading state for buttons and small elements
interface ButtonLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
}

export function ButtonLoading({ isLoading, children, loadingText }: ButtonLoadingProps) {
  if (isLoading) {
    return (
      <span className="flex items-center gap-2" role="status" aria-live="polite">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        <span>{loadingText || 'Loading...'}</span>
      </span>
    );
  }
  return <>{children}</>;
}

// Skeleton pulse animation wrapper
export function SkeletonPulse({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <motion.div
      className={cn("rounded-lg bg-muted", className)}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}

// Progress bar for multi-step processes
interface ProgressStepsProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-2">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center">
            <motion.div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                index < currentStep
                  ? "bg-primary text-primary-foreground"
                  : index === currentStep
                  ? "bg-primary/20 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground"
              )}
              initial={false}
              animate={index === currentStep ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              {index < currentStep ? '✓' : index + 1}
            </motion.div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-1 w-12 sm:w-24 mx-2 rounded transition-colors",
                  index < currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <span
            key={step}
            className={cn(
              "text-xs text-center max-w-[80px]",
              index <= currentStep ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}
