import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';
export type SoundType = 'urgent' | 'default' | 'soft' | 'silent';

export interface DeliveryPreference {
  browser: boolean;
  email: boolean;
  sound: boolean;
  priority: NotificationPriority;
}

export interface QuietWindow {
  id: string;
  name: string;
  start: string;
  end: string;
  days: number[]; // 0-6, Sunday-Saturday
  enabled: boolean;
}

export interface CustomPriority {
  bypass_quiet: boolean;
  force_sound: boolean;
  repeat_interval: number; // minutes, 0 = no repeat
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  // Communication channel toggles
  sms_enabled: boolean;
  email_enabled: boolean;
  call_enabled: boolean;
  whatsapp_enabled: boolean;
  // Notification methods
  browser_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  sound_enabled: boolean;
  // Role-specific event toggles
  role_type: string;
  notify_lead_assignment: boolean;
  notify_lead_status_change: boolean;
  notify_new_messages: boolean;
  notify_training_reminders: boolean;
  notify_new_business: boolean;
  notify_agent_performance: boolean;
  notify_system_health: boolean;
  notify_daily_summary: boolean;
  notify_cross_org_alerts: boolean;
  notify_new_organization: boolean;
  notify_security_alerts: boolean;
  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  digest_frequency: string;
  // Priority overrides
  priority_hot_leads: boolean;
  priority_agent_takeover: boolean;
  priority_urgent_business: boolean;
  // Advanced: Per-notification delivery
  delivery_preferences: Record<string, DeliveryPreference>;
  // Advanced: Grouping
  grouping_enabled: boolean;
  grouping_interval_minutes: number;
  // Advanced: Custom sounds
  custom_sounds: Record<NotificationPriority, SoundType>;
  // Advanced: Device preferences
  desktop_enabled: boolean;
  mobile_enabled: boolean;
  mobile_push_enabled: boolean;
  // Advanced: Snooze
  is_snoozed: boolean;
  snooze_until: string | null;
  // Advanced: Multiple quiet windows
  quiet_windows: QuietWindow[];
  // Advanced: Value-based alerts
  value_alerts_enabled: boolean;
  min_order_value: number;
  min_booking_value: number;
  // Advanced: Custom priorities
  custom_priorities: Record<NotificationPriority, CustomPriority>;
  // Timestamps
  created_at: string;
  updated_at: string;
}

const defaultDeliveryPreferences: Record<string, DeliveryPreference> = {
  lead_assignment: { browser: true, email: false, sound: true, priority: 'high' },
  lead_status_change: { browser: true, email: false, sound: false, priority: 'medium' },
  new_message: { browser: true, email: false, sound: true, priority: 'high' },
  training_reminder: { browser: true, email: true, sound: false, priority: 'low' },
  new_business: { browser: true, email: false, sound: true, priority: 'high' },
  agent_takeover: { browser: true, email: true, sound: true, priority: 'critical' },
  agent_handback: { browser: true, email: false, sound: false, priority: 'medium' },
  agent_performance: { browser: true, email: true, sound: false, priority: 'medium' },
  daily_summary: { browser: false, email: true, sound: false, priority: 'low' },
  cross_org_alert: { browser: true, email: true, sound: true, priority: 'critical' },
  new_organization: { browser: true, email: false, sound: false, priority: 'medium' },
  security_alert: { browser: true, email: true, sound: true, priority: 'critical' },
  system_health: { browser: true, email: true, sound: true, priority: 'high' },
};

const defaultCustomSounds: Record<NotificationPriority, SoundType> = {
  critical: 'urgent',
  high: 'default',
  medium: 'soft',
  low: 'silent',
};

const defaultCustomPriorities: Record<NotificationPriority, CustomPriority> = {
  critical: { bypass_quiet: true, force_sound: true, repeat_interval: 0 },
  high: { bypass_quiet: true, force_sound: false, repeat_interval: 0 },
  medium: { bypass_quiet: false, force_sound: false, repeat_interval: 0 },
  low: { bypass_quiet: false, force_sound: false, repeat_interval: 0 },
};

// Helper to safely parse JSON fields
function parseJsonField<T>(value: Json | null | undefined, defaultValue: T): T {
  if (!value || typeof value !== 'object') return defaultValue;
  return value as unknown as T;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Parse and merge with defaults
        const deliveryPrefs = parseJsonField(data.delivery_preferences, defaultDeliveryPreferences);
        const customSounds = parseJsonField(data.custom_sounds, defaultCustomSounds);
        const customPriorities = parseJsonField(data.custom_priorities, defaultCustomPriorities);
        const quietWindows = parseJsonField<QuietWindow[]>(data.quiet_windows, []);

        return {
          ...data,
          delivery_preferences: { ...defaultDeliveryPreferences, ...deliveryPrefs },
          custom_sounds: { ...defaultCustomSounds, ...customSounds },
          custom_priorities: { ...defaultCustomPriorities, ...customPriorities },
          quiet_windows: quietWindows,
        } as NotificationPreferences;
      }
      
      // Create default preferences if none exist
      const insertData = {
        user_id: user.id,
        sms_enabled: true,
        email_enabled: true,
        call_enabled: true,
        whatsapp_enabled: true,
        browser_notifications_enabled: true,
        email_notifications_enabled: false,
        sound_enabled: true,
      };

      const { data: newPrefs, error: insertError } = await supabase
        .from('notification_preferences')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      // Return with defaults
      return {
        ...newPrefs,
        delivery_preferences: defaultDeliveryPreferences,
        custom_sounds: defaultCustomSounds,
        custom_priorities: defaultCustomPriorities,
        quiet_windows: [],
      } as NotificationPreferences;
    },
    enabled: !!user?.id,
  });

  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Convert complex types to JSON for Supabase
      const dbUpdates: Record<string, unknown> = { ...updates };
      
      if (updates.delivery_preferences) {
        dbUpdates.delivery_preferences = updates.delivery_preferences as unknown as Json;
      }
      if (updates.custom_sounds) {
        dbUpdates.custom_sounds = updates.custom_sounds as unknown as Json;
      }
      if (updates.custom_priorities) {
        dbUpdates.custom_priorities = updates.custom_priorities as unknown as Json;
      }
      if (updates.quiet_windows) {
        dbUpdates.quiet_windows = updates.quiet_windows as unknown as Json;
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .update(dbUpdates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving preferences',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Snooze mutations
  const snoozeNotifications = useMutation({
    mutationFn: async (minutes: number) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('notification_preferences')
        .update({ is_snoozed: true, snooze_until: snoozeUntil })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast({
        title: 'Notifications snoozed',
        description: 'You won\'t receive notifications until the snooze period ends.',
      });
    },
  });

  const unsnoozeNotifications = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('notification_preferences')
        .update({ is_snoozed: false, snooze_until: null })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast({
        title: 'Notifications resumed',
        description: 'You will now receive notifications again.',
      });
    },
  });

  // Update single delivery preference
  const updateDeliveryPreference = useMutation({
    mutationFn: async ({ type, updates }: { type: string; updates: Partial<DeliveryPreference> }) => {
      if (!user?.id || !preferences) throw new Error('Not authenticated');
      
      const newDeliveryPrefs = {
        ...preferences.delivery_preferences,
        [type]: { ...preferences.delivery_preferences[type], ...updates },
      };
      
      const { error } = await supabase
        .from('notification_preferences')
        .update({ delivery_preferences: newDeliveryPrefs as unknown as Json })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  // Check if currently snoozed
  const isSnoozed = preferences?.is_snoozed && 
    (!preferences.snooze_until || new Date(preferences.snooze_until) > new Date());

  const snoozeRemaining = isSnoozed && preferences?.snooze_until
    ? Math.max(0, Math.ceil((new Date(preferences.snooze_until).getTime() - Date.now()) / 60000))
    : 0;

  return {
    preferences: preferences ?? null,
    isLoading,
    updatePreferences: updatePreferences.mutate,
    isUpdating: updatePreferences.isPending,
    snoozeNotifications: snoozeNotifications.mutate,
    unsnoozeNotifications: unsnoozeNotifications.mutate,
    updateDeliveryPreference: updateDeliveryPreference.mutate,
    isSnoozed,
    snoozeRemaining,
  };
}
