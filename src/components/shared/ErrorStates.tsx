import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  AlertTriangle, 
  WifiOff, 
  ServerCrash, 
  RefreshCw, 
  Home,
  ArrowLeft,
  Bug,
  ShieldX,
  Clock
} from 'lucide-react';

type ErrorType = 'generic' | 'network' | 'server' | 'auth' | 'timeout' | 'notFound';

interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  onGoHome?: () => void;
  className?: string;
  isRetrying?: boolean;
}

const errorConfig: Record<ErrorType, { icon: React.ElementType; title: string; message: string; color: string }> = {
  generic: {
    icon: AlertTriangle,
    title: "Something went wrong",
    message: "We encountered an unexpected error. Please try again.",
    color: "text-destructive",
  },
  network: {
    icon: WifiOff,
    title: "Connection lost",
    message: "Please check your internet connection and try again.",
    color: "text-warning",
  },
  server: {
    icon: ServerCrash,
    title: "Server error",
    message: "Our servers are having trouble. Please try again in a moment.",
    color: "text-destructive",
  },
  auth: {
    icon: ShieldX,
    title: "Access denied",
    message: "You don't have permission to access this resource.",
    color: "text-destructive",
  },
  timeout: {
    icon: Clock,
    title: "Request timeout",
    message: "The request took too long. Please try again.",
    color: "text-warning",
  },
  notFound: {
    icon: Bug,
    title: "Not found",
    message: "The resource you're looking for doesn't exist.",
    color: "text-muted-foreground",
  },
};

export function ErrorState({
  type = 'generic',
  title,
  message,
  onRetry,
  onGoBack,
  onGoHome,
  className,
  isRetrying = false,
}: ErrorStateProps) {
  const config = errorConfig[type];
  const Icon = config.icon;
  const displayTitle = title || config.title;
  const displayMessage = message || config.message;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn("flex flex-col items-center justify-center py-12 px-6 text-center", className)}
    >
      {/* Animated Icon */}
      <motion.div
        initial={{ y: -10 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative mb-6"
      >
        <div className="absolute inset-0 bg-destructive/10 rounded-full blur-xl scale-150" />
        <motion.div
          className={cn(
            "relative w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center",
            type === 'network' && "bg-warning/10",
            type === 'notFound' && "bg-muted"
          )}
          animate={type === 'network' ? { 
            scale: [1, 1.05, 1],
            opacity: [1, 0.8, 1]
          } : {}}
          transition={{ duration: 2, repeat: type === 'network' ? Infinity : 0 }}
        >
          <Icon className={cn("w-10 h-10", config.color)} />
        </motion.div>
      </motion.div>

      {/* Text Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-2 max-w-md mb-6"
      >
        <h3 className="text-xl font-semibold text-foreground">{displayTitle}</h3>
        <p className="text-muted-foreground">{displayMessage}</p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        {onRetry && (
          <Button onClick={onRetry} disabled={isRetrying} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </Button>
        )}
        {onGoBack && (
          <Button variant="outline" onClick={onGoBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        )}
        {onGoHome && (
          <Button variant="ghost" onClick={onGoHome} className="gap-2">
            <Home className="w-4 h-4" />
            Home
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}

// Inline error for form fields or small sections
interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function InlineError({ message, onRetry, className }: InlineErrorProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20",
      className
    )}>
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
      <p className="text-sm text-destructive flex-1">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="shrink-0 h-7 px-2 text-destructive hover:text-destructive">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

// Network status banner
interface NetworkBannerProps {
  isOnline: boolean;
  onRetry?: () => void;
}

export function NetworkBanner({ isOnline, onRetry }: NetworkBannerProps) {
  if (isOnline) return null;

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground px-4 py-2"
    >
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">You're offline. Some features may be unavailable.</span>
        </div>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// Toast-style error notification
interface ErrorToastProps {
  title: string;
  message?: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function ErrorToastContent({ title, message, onDismiss, onRetry }: ErrorToastProps) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">{title}</p>
            {message && <p className="text-sm text-muted-foreground mt-1">{message}</p>}
            {onRetry && (
              <Button variant="ghost" size="sm" onClick={onRetry} className="mt-2 h-7 px-2 text-destructive">
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
