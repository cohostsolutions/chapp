import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { devLog } from '@/lib/logger';

const channelLabels: Record<string, string> = {
  sms: 'SMS',
  call: 'Call',
  email: 'Email',
  whatsapp: 'WhatsApp',
  messenger: 'Facebook Messenger',
  instagram: 'Instagram',
};

export function CommunicationNotifications() {
  const { profile, orgFeatures, user } = useAuth();
  const { toast } = useToast();
  const { preferences } = useNotificationPreferences();
  const initializedRef = useRef(false);
  const auditInitializedRef = useRef(false);

  // Request browser notification permission on mount if enabled
  useEffect(() => {
    if (preferences?.browser_notifications_enabled && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [preferences?.browser_notifications_enabled]);

  useEffect(() => {
    // Only subscribe if user has communications enabled and is logged in
    if (!profile?.organization_id || !orgFeatures?.communications_enabled) {
      return;
    }

    // Prevent duplicate subscriptions
    if (initializedRef.current) return;
    initializedRef.current = true;

    const channel = supabase
      .channel('communications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communications',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        (payload) => {
          const newComm = payload.new as {
            id: string;
            channel: string;
            direction: string;
            content: string | null;
            subject: string | null;
            created_at: string;
          };

          // Only notify for inbound communications
          if (newComm.direction !== 'inbound') return;

          // Check if this channel is enabled in preferences
          const channelKey = `${newComm.channel}_enabled` as keyof typeof preferences;
          if (preferences && preferences[channelKey] === false) return;

          const channelLabel = channelLabels[newComm.channel] || newComm.channel;
          const messagePreview = newComm.subject || newComm.content?.slice(0, 100) || 'New message from lead';

          // Show in-app toast notification
          toast({
            title: `New ${channelLabel} received`,
            description: messagePreview,
            duration: 5000,
          });

          // Show browser notification if enabled and permission granted
          if (
            preferences?.browser_notifications_enabled &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            document.hidden // Only show browser notification when tab is hidden
          ) {
            const notification = new Notification(`New ${channelLabel} received`, {
              body: messagePreview,
              icon: '/pwa-192x192.png',
              tag: `comm-${newComm.id}`,
              requireInteraction: false,
            });

            notification.onclick = () => {
              window.focus();
              notification.close();
            };

            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);
          }

          // Play notification sound if enabled
          if (preferences?.sound_enabled !== false) {
            try {
              const audio = new Audio('/notification.mp3');
              audio.volume = 0.3;
              audio.play().catch(() => {
                // Silently fail if audio can't play (e.g., no user interaction yet)
              });
            } catch {
              // Audio not available
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          devLog('Subscribed to communications realtime');
        }
      });

    return () => {
      initializedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, orgFeatures?.communications_enabled, toast, preferences]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    if (auditInitializedRef.current) return;
    auditInitializedRef.current = true;

    const auditChannel = supabase
      .channel('audit-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_history',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as {
            title?: string | null;
            message?: string | null;
            channel?: string | null;
          };

          if (notification.channel !== 'audit') {
            return;
          }

          toast({
            title: notification.title || 'System issue detected',
            description: notification.message || 'A hidden integration issue was recorded for review.',
            duration: 8000,
          });

          if (
            preferences?.browser_notifications_enabled &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            document.hidden
          ) {
            const browserNotification = new Notification(notification.title || 'System issue detected', {
              body: notification.message || 'A hidden integration issue was recorded for review.',
              icon: '/pwa-192x192.png',
              tag: `audit-${user.id}`,
            });

            setTimeout(() => browserNotification.close(), 8000);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          devLog('Subscribed to audit notifications realtime');
        }
      });

    return () => {
      auditInitializedRef.current = false;
      supabase.removeChannel(auditChannel);
    };
  }, [preferences?.browser_notifications_enabled, toast, user?.id]);

  // This component doesn't render anything
  return null;
}
