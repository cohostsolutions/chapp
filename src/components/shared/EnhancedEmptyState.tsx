import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Users, 
  ShoppingBag, 
  BedDouble, 
  MessageSquare, 
  FileText,
  Search,
  Plus,
  RefreshCw,
  LucideIcon
} from 'lucide-react';

interface EnhancedEmptyStateProps {
  type?: 'leads' | 'orders' | 'bookings' | 'conversations' | 'reports' | 'search' | 'custom';
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const presets = {
  leads: {
    icon: Users,
    title: "No leads yet",
    description: "Start capturing leads and watch your pipeline grow. Add your first lead to get started.",
  },
  orders: {
    icon: ShoppingBag,
    title: "No orders found",
    description: "Orders will appear here when customers start placing them. Your AI assistant is ready to take orders!",
  },
  bookings: {
    icon: BedDouble,
    title: "No bookings yet",
    description: "Bookings will show up here as guests make reservations. Your AI concierge is ready to help!",
  },
  conversations: {
    icon: MessageSquare,
    title: "No conversations",
    description: "AI conversations will appear here as customers interact with your assistant.",
  },
  reports: {
    icon: FileText,
    title: "No data available",
    description: "Reports will be generated once you have enough data. Keep using the platform!",
  },
  search: {
    icon: Search,
    title: "No results found",
    description: "Try adjusting your search terms or filters to find what you're looking for.",
  },
  custom: {
    icon: RefreshCw,
    title: "Nothing here yet",
    description: "This section is empty. Add some data to get started.",
  },
};

export function EnhancedEmptyState({
  type = 'custom',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
}: EnhancedEmptyStateProps) {
  const preset = presets[type];
  const Icon = icon || preset.icon;
  const displayTitle = title || preset.title;
  const displayDescription = description || preset.description;
  const ActionIcon = action?.icon || Plus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      {/* Animated Icon Container */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className="relative mb-6"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl scale-150" />
        
        {/* Icon circle */}
        <motion.div
          className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10"
          animate={{
            boxShadow: [
              "0 0 0 0 hsl(var(--primary) / 0.1)",
              "0 0 0 20px hsl(var(--primary) / 0)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Icon className="w-12 h-12 text-primary" />
        </motion.div>
      </motion.div>

      {/* Text Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-2 max-w-md"
      >
        <h3 className="text-xl font-semibold text-foreground">{displayTitle}</h3>
        <p className="text-muted-foreground">{displayDescription}</p>
      </motion.div>

      {/* Actions */}
      {(action || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-3 mt-8"
        >
          {action && (
            <Button onClick={action.onClick} className="gap-2">
              <ActionIcon className="w-4 h-4" />
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// Inline empty state for smaller sections
interface InlineEmptyStateProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function InlineEmptyState({ message, action, className }: InlineEmptyStateProps) {
  return (
    <div className={cn(
      "flex items-center justify-center gap-4 py-8 px-4 rounded-lg border border-dashed border-border bg-muted/30",
      className
    )}>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
