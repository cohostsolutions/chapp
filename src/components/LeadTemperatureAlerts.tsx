import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface LeadAlert {
  id: string;
  lead_id: string;
  lead_name: string;
  temperature: 'warm' | 'hot';
  timestamp: string;
  read: boolean;
}

// Hook for lead temperature alerts - integrates with CommunicationNotificationBell
export function useLeadTemperatureAlerts() {
  const [alerts, setAlerts] = useState<LeadAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Subscribe to real-time lead temperature changes
    const channel = supabase
      .channel('lead-temperature-alerts')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
        },
        async (payload) => {
          const newLead = payload.new as unknown as { id: string; lead_temperature?: string };
          const oldLead = payload.old as unknown as { lead_temperature?: string };

          // Check if temperature changed to warm or hot
          if (
            (newLead.lead_temperature === 'warm' || newLead.lead_temperature === 'hot') &&
            oldLead.lead_temperature !== newLead.lead_temperature
          ) {
            const newAlert: LeadAlert = {
              id: `${newLead.id}-${Date.now()}`,
              lead_id: newLead.id,
              lead_name: (newLead as { id: string; name: string; lead_temperature?: string }).name,
              temperature: newLead.lead_temperature,
              timestamp: new Date().toISOString(),
              read: false,
            };

            setAlerts((prev) => [newAlert, ...prev.slice(0, 49)]); // Keep last 50 alerts
            setUnreadCount((prev) => prev + 1);

            // Show toast notification
            const isHot = newLead.lead_temperature === 'hot';
            toast({
              title: isHot ? '🔥 Hot Lead Alert!' : '🌡️ Warm Lead Alert!',
              description: `${(newLead as { id: string; name: string; lead_temperature?: string }).name} is now a ${newLead.lead_temperature} lead${isHot ? ' - callback scheduled!' : ''}`,
              duration: isHot ? 10000 : 5000,
            });

            // Play notification sound for hot leads
            if (isHot) {
              try {
                const audio = new Audio('/notification.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => {});
              } catch (_error) {
                // Notification failed, continue
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const markAllAsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnreadCount(0);
  };

  const clearAlerts = () => {
    setAlerts([]);
    setUnreadCount(0);
  };

  return { alerts, unreadCount, markAllAsRead, clearAlerts };
}

// Keep component export for backward compatibility but it's now a no-op
// The alerts are handled by CommunicationNotificationBell
export function LeadTemperatureAlerts() {
  // Hook is called to keep subscriptions active
  useLeadTemperatureAlerts();
  return null;
}
