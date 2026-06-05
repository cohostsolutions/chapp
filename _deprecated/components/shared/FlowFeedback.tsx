import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  ShoppingBag, 
  BedDouble, 
  Users, 
  Calendar,
  ArrowRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';

// Success confirmation after completing an action
interface SuccessConfirmationProps {
  title: string;
  message: string;
  type?: 'lead' | 'order' | 'booking' | 'general';
  details?: { label: string; value: string }[];
  actions?: {
    primary?: { label: string; onClick: () => void };
    secondary?: { label: string; onClick: () => void };
  };
  onDismiss?: () => void;
  className?: string;
}

const typeIcons = {
  lead: Users,
  order: ShoppingBag,
  booking: BedDouble,
  general: CheckCircle2,
};

const typeColors = {
  lead: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  order: 'from-green-500/20 to-green-600/10 border-green-500/30',
  booking: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  general: 'from-primary/20 to-primary/10 border-primary/30',
};

export function SuccessConfirmation({
  title,
  message,
  type = 'general',
  details,
  actions,
  onDismiss,
  className,
}: SuccessConfirmationProps) {
  const Icon = typeIcons[type];
  const colorClass = typeColors[type];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className={className}
    >
      <Card className={cn("bg-gradient-to-br border overflow-hidden", colorClass)}>
        <CardContent className="p-6">
          {/* Confetti effect */}
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            <Sparkles className="w-6 h-6 text-primary" />
          </motion.div>

          <div className="flex flex-col items-center text-center">
            {/* Animated checkmark */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <CheckCircle2 className="w-8 h-8 text-success" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{message}</p>
            </motion.div>

            {/* Details */}
            {details && details.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-4 w-full space-y-2"
              >
                {details.map((detail) => (
                  <div key={detail.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{detail.label}</span>
                    <span className="font-medium text-foreground">{detail.value}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Actions */}
            {actions && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex gap-3 mt-6"
              >
                {actions.secondary && (
                  <Button variant="outline" onClick={actions.secondary.onClick}>
                    {actions.secondary.label}
                  </Button>
                )}
                {actions.primary && (
                  <Button onClick={actions.primary.onClick}>
                    {actions.primary.label}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Order/Booking confirmation card for AI chat
interface OrderConfirmationCardProps {
  type: 'order' | 'booking';
  status: 'pending' | 'confirmed' | 'processing';
  details: {
    id: string;
    items?: { name: string; quantity?: number; price?: number }[];
    total?: number;
    checkIn?: string;
    checkOut?: string;
    roomType?: string;
    guests?: number;
    pickupTime?: string;
    customerName?: string;
  };
  onViewDetails?: () => void;
  className?: string;
}

export function OrderConfirmationCard({
  type,
  status,
  details,
  onViewDetails,
  className,
}: OrderConfirmationCardProps) {
  const isOrder = type === 'order';
  const Icon = isOrder ? ShoppingBag : BedDouble;

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-warning/20 text-warning border-warning/30' },
    confirmed: { label: 'Confirmed', color: 'bg-success/20 text-success border-success/30' },
    processing: { label: 'Processing', color: 'bg-primary/20 text-primary border-primary/30' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card className="glass border-primary/20 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">
                  {isOrder ? 'Order' : 'Booking'} #{details.id.slice(-6).toUpperCase()}
                </p>
                {details.customerName && (
                  <p className="text-xs text-muted-foreground">{details.customerName}</p>
                )}
              </div>
            </div>
            <Badge variant="outline" className={statusConfig[status].color}>
              {statusConfig[status].label}
            </Badge>
          </div>

          {/* Order items */}
          {isOrder && details.items && (
            <div className="space-y-1 mb-3">
              {details.items.slice(0, 3).map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.quantity && `${item.quantity}x `}{item.name}
                  </span>
                  {item.price && (
                    <span className="font-medium">₱{item.price.toLocaleString()}</span>
                  )}
                </div>
              ))}
              {details.items.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{details.items.length - 3} more items
                </p>
              )}
            </div>
          )}

          {/* Booking details */}
          {!isOrder && (
            <div className="space-y-1 mb-3 text-sm">
              {details.roomType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room</span>
                  <span className="font-medium">{details.roomType}</span>
                </div>
              )}
              {details.checkIn && details.checkOut && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dates</span>
                  <span className="font-medium">{details.checkIn} - {details.checkOut}</span>
                </div>
              )}
              {details.guests && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guests</span>
                  <span className="font-medium">{details.guests}</span>
                </div>
              )}
            </div>
          )}

          {/* Total or pickup time */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            {isOrder ? (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {details.pickupTime || 'ASAP'}
                </div>
                {details.total && (
                  <span className="font-semibold text-foreground">
                    ₱{details.total.toLocaleString()}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Confirmation sent to your email
              </span>
            )}
            {onViewDetails && (
              <Button variant="ghost" size="sm" onClick={onViewDetails} className="h-7 text-xs gap-1">
                Details
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Lead capture success animation
interface LeadCapturedProps {
  leadName: string;
  temperature?: 'cold' | 'warm' | 'hot';
  onContinue?: () => void;
}

export function LeadCapturedFeedback({ leadName, temperature = 'warm', onContinue }: LeadCapturedProps) {
  const tempColors = {
    cold: 'text-blue-500',
    warm: 'text-amber-500',
    hot: 'text-red-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 rounded-lg bg-success/10 border border-success/20"
    >
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center"
        >
          <Users className="w-5 h-5 text-success" />
        </motion.div>
        <div className="flex-1">
          <p className="font-medium text-foreground">Lead Captured!</p>
          <p className="text-sm text-muted-foreground">
            <span className={tempColors[temperature]}>●</span> {leadName} added to your pipeline
          </p>
        </div>
        {onContinue && (
          <Button variant="ghost" size="sm" onClick={onContinue}>
            Continue
          </Button>
        )}
      </div>
    </motion.div>
  );
}
