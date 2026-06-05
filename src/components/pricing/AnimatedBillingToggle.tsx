import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedBillingToggleProps {
  billingAnnual: boolean;
  onToggle: (annual: boolean) => void;
}

export function AnimatedBillingToggle({ billingAnnual, onToggle }: AnimatedBillingToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center p-1 rounded-full bg-muted/50 border border-border/50">
        {/* Sliding background */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-full bg-primary"
          initial={false}
          animate={{
            x: billingAnnual ? '100%' : '0%',
            width: billingAnnual ? 'calc(50% - 4px)' : 'calc(50% - 4px)',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          style={{ left: '4px' }}
        />
        
        {/* Monthly Button */}
        <button
          onClick={() => onToggle(false)}
          className={cn(
            "relative z-10 px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200",
            !billingAnnual ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Monthly
        </button>
        
        {/* Annual Button */}
        <button
          onClick={() => onToggle(true)}
          className={cn(
            "relative z-10 px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200",
            billingAnnual ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Annual
        </button>
      </div>
      
      {/* Savings Badge */}
      <AnimatePresence mode="wait">
        {billingAnnual && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20"
          >
            <motion.span
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              className="text-green-500 text-xs font-bold"
            >
              🎉
            </motion.span>
            <span className="text-green-500 text-xs font-semibold">Save 20%</span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
