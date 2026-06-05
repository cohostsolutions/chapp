import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { devLog } from '@/lib/logger';

// Notification type definitions per role
export type NotificationType = 
  // Agent notifications
  | 'lead_assignment'
  | 'lead_status_change'
  | 'new_message'
  | 'training_reminder'
  // Client Admin notifications
  | 'new_lead'
  | 'new_order'
  | 'new_booking'
  | 'agent_takeover'
  | 'agent_handback'
  | 'agent_performance'
  | 'daily_summary'
  // Super Admin notifications
  | 'cross_org_alert'
  | 'new_organization'
  | 'security_alert'
  | 'system_health';

// Org-type specific labels
const orgTypeLabels = {
  jay: { primary: 'Lead', primaryPlural: 'Leads', action: 'captured' },
  may: { primary: 'Order', primaryPlural: 'Orders', action: 'placed' },
  cece: { primary: 'Booking', primaryPlural: 'Bookings', action: 'created' },
};

interface NotificationConfig {
  title: string;
  icon: string;
  sound: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

const getNotificationConfig = (type: NotificationType, orgType: 'jay' | 'may' | 'cece' = 'jay'): NotificationConfig => {
  const labels = orgTypeLabels[orgType];
  
  const configs: Record<NotificationType, NotificationConfig> = {
    // Agent notifications
    lead_assignment: { title: `New ${labels.primary} Assigned`, icon: '👤', sound: true, priority: 'high' },
    lead_status_change: { title: `${labels.primary} Status Updated`, icon: '📊', sound: false, priority: 'medium' },
    new_message: { title: 'New Message', icon: '💬', sound: true, priority: 'high' },
    training_reminder: { title: 'Training Available', icon: '📚', sound: false, priority: 'low' },
    
    // Client Admin notifications
    new_lead: { title: `New ${labels.primary}`, icon: '🎯', sound: true, priority: 'high' },
    new_order: { title: 'New Order', icon: '🛒', sound: true, priority: 'high' },
    new_booking: { title: 'New Booking', icon: '🏨', sound: true, priority: 'high' },
    agent_takeover: { title: 'Agent Takeover Required', icon: '⚠️', sound: true, priority: 'critical' },
    agent_handback: { title: 'Lead Returned to AI', icon: '🤖', sound: false, priority: 'medium' },
    agent_performance: { title: 'Performance Alert', icon: '📈', sound: false, priority: 'medium' },
    daily_summary: { title: 'Daily Summary', icon: '📋', sound: false, priority: 'low' },
    
    // Super Admin notifications
    cross_org_alert: { title: 'Cross-Organization Alert', icon: '🏢', sound: true, priority: 'critical' },
    new_organization: { title: 'New Organization', icon: '🆕', sound: false, priority: 'medium' },
    security_alert: { title: 'Security Alert', icon: '🔒', sound: true, priority: 'critical' },
    system_health: { title: 'System Health Alert', icon: '⚡', sound: true, priority: 'high' },
  };
  
  return configs[type];
};

export function useRoleNotifications() {
  const { user, profile, orgFeatures, isSuperAdmin, effectiveIsClientAdmin, effectiveIsAgent } = useAuth();
  const { toast } = useToast();
  const { preferences } = useNotificationPreferences();
  const initializedRef = useRef(false);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  // Get org type for customized notifications
  const orgFeaturesData = orgFeatures as unknown as { ai_agent_type?: string } | null;
  const orgType = orgFeaturesData?.ai_agent_type || 'jay';
  const labels = orgTypeLabels[orgType as keyof typeof orgTypeLabels] || orgTypeLabels.jay;

  // Check if notification should be shown based on preferences and quiet hours
  // EXCEPTION: new_booking for Cece orgs is MANDATORY (cannot be disabled)
  const shouldNotify = useCallback((type: NotificationType): boolean => {
    // MANDATORY: new_booking for Cece orgs cannot be turned off
    if (type === 'new_booking' && orgType === 'cece') {
      return true; // Always notify, ignore preferences
    }
    
    if (!preferences) return true;
    
    const prefs = preferences as unknown as Record<string, unknown>;
    
    // Check quiet hours (but not for mandatory Cece booking notifications)
    if (prefs.quiet_hours_enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const startTime = prefs.quiet_hours_start || '22:00';
      const endTime = prefs.quiet_hours_end || '08:00';
      
      // Check if in quiet hours
      const isQuietHours = startTime > endTime
        ? currentTime >= startTime || currentTime < endTime
        : currentTime >= startTime && currentTime < endTime;
      
      if (isQuietHours) {
        // Check priority overrides
        const config = getNotificationConfig(type, orgType as unknown as 'jay' | 'may' | 'cece');
        if (config.priority === 'critical') {
          if (type === 'agent_takeover' && prefs.priority_agent_takeover) return true;
          if ((type === 'new_lead' || type === 'lead_assignment') && prefs.priority_hot_leads) return true;
          if ((type === 'new_order' || type === 'new_booking') && prefs.priority_urgent_business) return true;
        }
        return false;
      }
    }
    
    // Check type-specific preferences
    const prefMap: Record<NotificationType, string> = {
      lead_assignment: 'notify_lead_assignment',
      lead_status_change: 'notify_lead_status_change',
      new_message: 'notify_new_messages',
      training_reminder: 'notify_training_reminders',
      new_lead: 'notify_new_business',
      new_order: 'notify_new_business',
      new_booking: 'notify_new_business',
      agent_takeover: 'notify_agent_performance',
      agent_handback: 'notify_agent_performance',
      agent_performance: 'notify_agent_performance',
      daily_summary: 'notify_daily_summary',
      cross_org_alert: 'notify_cross_org_alerts',
      new_organization: 'notify_new_organization',
      security_alert: 'notify_security_alerts',
      system_health: 'notify_system_health',
    };
    
    const prefKey = prefMap[type];
    return prefKey ? prefs[prefKey] !== false : true;
  }, [preferences, orgType]);

  // Show notification
  const showNotification = useCallback((
    type: NotificationType,
    message: string,
    relatedId?: string
  ) => {
    if (!shouldNotify(type)) return;
    
    const config = getNotificationConfig(type, orgType as unknown as 'jay' | 'may' | 'cece');
    const prefs = preferences as unknown as Record<string, unknown>;
    
    // In-app toast
    toast({
      title: `${config.icon} ${config.title}`,
      description: message,
      variant: config.priority === 'critical' ? 'destructive' : 'default',
    });
    
    // Browser notification
    if (prefs?.browser_notifications_enabled && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      const notification = new Notification(config.title, {
        body: message,
        icon: '/pwa-192x192.png',
        tag: `notification-${type}-${relatedId || Date.now()}`,
        requireInteraction: config.priority === 'critical',
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      if (config.priority !== 'critical') {
        setTimeout(() => notification.close(), 5000);
      }
    }
    
    // Sound
    if (config.sound && prefs?.sound_enabled !== false) {
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = config.priority === 'critical' ? 0.5 : 0.3;
        audio.play().catch(() => {});
      } catch {
        // Audio not available
      }
    }
  }, [toast, preferences, shouldNotify, orgType]);

  // Save notification to history
  const saveNotification = useCallback(async (
    type: NotificationType,
    title: string,
    message: string,
    relatedId?: string
  ) => {
    if (!user?.id) return;
    
    try {
      await supabase.from('notification_history').insert({
        user_id: user.id,
        organization_id: profile?.organization_id || null,
        title,
        message,
        type,
        related_id: relatedId || null,
        is_read: false,
      });
    } catch (error) {
      devLog('Failed to save notification:', error);
    }
  }, [user?.id, profile?.organization_id]);

  // Setup real-time subscriptions based on role
  useEffect(() => {
    if (!user?.id || !profile?.organization_id || initializedRef.current) return;
    
    initializedRef.current = true;
    const orgId = profile.organization_id;

    // Agent-specific subscriptions
    if (effectiveIsAgent) {
      // Lead assignment changes
      const leadChannel = supabase
        .channel('agent-lead-notifications')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: `assigned_agent_id=eq.${user.id}`,
        }, (payload) => {
          const lead = payload.new as unknown as { id: string; name: string; assigned_agent_id?: string; status?: string };
          const oldLead = payload.old as unknown as { assigned_agent_id?: string; status?: string };
          
          // New assignment
          if (!oldLead.assigned_agent_id && lead.assigned_agent_id === user.id) {
            showNotification('lead_assignment', `${lead.name} has been assigned to you`, lead.id);
            saveNotification('lead_assignment', `New ${labels.primary} Assigned`, `${lead.name} has been assigned to you`, lead.id);
          }
          
          // Status change
          if (oldLead.status !== lead.status) {
            showNotification('lead_status_change', `${lead.name} status changed to ${lead.status}`, lead.id);
          }
        })
        .subscribe();
      
      channelsRef.current.push(leadChannel);

      // Training module updates
      const trainingChannel = supabase
        .channel('agent-training-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'training_modules',
          filter: `organization_id=eq.${orgId}`,
        }, (payload) => {
          const module = payload.new as unknown as { id: string; title?: string; difficulty?: string };
          showNotification('training_reminder', `New training module available: ${module.title}`, module.id);
          saveNotification('training_reminder', 'New Training Available', `${module.title} is now available for training`, module.id);
        })
        .subscribe();
      
      channelsRef.current.push(trainingChannel);
    }

    // Client Admin subscriptions
    if (effectiveIsClientAdmin) {
      // New leads/orders/bookings based on org type
      if (orgType === 'jay' || orgType === 'may') {
        const leadsChannel = supabase
          .channel('admin-leads-notifications')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'leads',
            filter: `organization_id=eq.${orgId}`,
          }, (payload) => {
            const lead = payload.new as unknown as { id: string; name: string; source?: string };
            showNotification('new_lead', `New ${labels.primary}: ${lead.name}`, lead.id);
            saveNotification('new_lead', `New ${labels.primary}`, `${lead.name} - ${lead.source || 'Direct'}`, lead.id);
          })
          .subscribe();
        
        channelsRef.current.push(leadsChannel);
      }

      if (orgType === 'may') {
        const ordersChannel = supabase
          .channel('admin-orders-notifications')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: `organization_id=eq.${orgId}`,
          }, (payload) => {
            const order = payload.new as unknown as { id: string; reference_number?: string; total_amount?: number };
            showNotification('new_order', `New order placed - $${order.total_amount?.toFixed(2) || '0.00'}`, order.id);
            saveNotification('new_order', 'New Order', `Order total: $${order.total_amount?.toFixed(2) || '0.00'}`, order.id);
          })
          .subscribe();
        
        channelsRef.current.push(ordersChannel);
      }

      if (orgType === 'cece') {
        const bookingsChannel = supabase
          .channel('admin-bookings-notifications')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'bookings',
            filter: `organization_id=eq.${orgId}`,
          }, (payload) => {
            const booking = payload.new as unknown as { id: string; reference_number?: string; room_name?: string; check_in?: string };
            showNotification('new_booking', `New booking received`, booking.id);
            saveNotification('new_booking', 'New Booking', `Check-in: ${booking.check_in || 'N/A'}`, booking.id);
          })
          .subscribe();
        
        channelsRef.current.push(bookingsChannel);
      }

      // Agent takeover/handback
      const aiConversationsChannel = supabase
        .channel('admin-ai-notifications')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_conversations',
          filter: `organization_id=eq.${orgId}`,
        }, (payload) => {
          const conv = payload.new as unknown as { id: string; status?: string };
          const oldConv = payload.old as unknown as { status?: string };
          
          if (oldConv.status !== 'agent_takeover' && conv.status === 'agent_takeover') {
            showNotification('agent_takeover', 'AI has requested human intervention', conv.id);
            saveNotification('agent_takeover', 'Agent Takeover Required', 'AI conversation needs human assistance', conv.id);
          }
          
          if (oldConv.status === 'agent_takeover' && conv.status === 'active') {
            showNotification('agent_handback', 'Conversation returned to AI', conv.id);
          }
        })
        .subscribe();
      
      channelsRef.current.push(aiConversationsChannel);

      // Low training scores
      const trainingScoresChannel = supabase
        .channel('admin-training-scores')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'training_sessions',
          filter: `organization_id=eq.${orgId}`,
        }, (payload) => {
          const session = payload.new as unknown as { id: string; user_id?: string; score?: number | null };
          if (session.score !== undefined && session.score !== null && session.score < 60) {
            showNotification('agent_performance', `Agent training score below threshold: ${session.score}%`, session.id);
            saveNotification('agent_performance', 'Low Training Score', `An agent scored ${session.score}% on a training session`, session.id);
          }
        })
        .subscribe();
      
      channelsRef.current.push(trainingScoresChannel);
    }

    // Super Admin subscriptions (only when not impersonating)
    if (isSuperAdmin && !effectiveIsClientAdmin && !effectiveIsAgent) {
      // Security: failed login attempts
      const securityChannel = supabase
        .channel('superadmin-security')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'login_attempts',
        }, (payload) => {
          const attempt = payload.new as unknown as { id: string; email?: string; was_successful?: boolean };
          // Alert on multiple failed attempts (checked elsewhere, but can trigger here too)
          if (!attempt.was_successful) {
            // We'll batch these - just log for now
            devLog('Failed login attempt detected:', attempt.email);
          }
        })
        .subscribe();
      
      channelsRef.current.push(securityChannel);

      // New organizations
      const orgsChannel = supabase
        .channel('superadmin-orgs')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'organizations',
        }, (payload) => {
          const org = payload.new as unknown as { id: string; name?: string; ai_agent_type?: string };
          showNotification('new_organization', `New organization created: ${org.name}`, org.id);
          saveNotification('new_organization', 'New Organization', `${org.name} (${org.ai_agent_type || 'Unknown'})`, org.id);
        })
        .subscribe();
      
      channelsRef.current.push(orgsChannel);

      // Webhook health issues across all orgs
      const webhookChannel = supabase
        .channel('superadmin-webhooks')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'webhook_health',
        }, (payload) => {
          const health = payload.new as unknown as { id: string; status?: string; errors_24h?: number; platform?: string };
          if (health.status === 'error' || (health.errors_24h && health.errors_24h > 10)) {
            showNotification('system_health', `Webhook issues detected for ${health.platform || 'Unknown'}`, health.id);
            saveNotification('system_health', 'Webhook Health Alert', `${health.platform || 'Unknown'}: ${health.errors_24h || 0} errors in 24h`, health.id);
          }
        })
        .subscribe();
      
      channelsRef.current.push(webhookChannel);
    }

    return () => {
      initializedRef.current = false;
      channelsRef.current.forEach(channel => supabase.removeChannel(channel));
      channelsRef.current = [];
    };
  }, [user?.id, profile?.organization_id, effectiveIsAgent, effectiveIsClientAdmin, isSuperAdmin, orgType, labels, showNotification, saveNotification]);

  return {
    showNotification,
    saveNotification,
    shouldNotify,
    orgType,
    labels,
  };
}
