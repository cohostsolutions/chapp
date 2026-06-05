import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ShoppingBag } from 'lucide-react';

export function useOrderNotifications() {
  const { toast } = useToast();
  const notificationSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create a simple notification sound effect
    notificationSound.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleDoAAABZqN/TqsyM');

    const channel = supabase
      .channel('order-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          // Play notification sound
          notificationSound.current?.play().catch(() => {});
          
          // Show toast notification
          toast({
            title: "🛎️ New Order!",
            description: `A new order has been placed`,
            duration: 5000,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const newStatus = (payload.new as unknown as { status?: string })?.status;
          if (newStatus === 'confirmed') {
            toast({
              title: "Order Confirmed",
              description: "An order has been confirmed",
            });
          } else if (newStatus === 'ready') {
            toast({
              title: "Order Ready",
              description: "An order is ready for pickup",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);
}

export function OrderNotificationBell({ pendingCount }: { pendingCount: number }) {
  return (
    <div className="relative">
      <ShoppingBag className="w-5 h-5" />
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-pulse">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </div>
  );
}
