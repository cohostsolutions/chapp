import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { devLog } from '@/lib/logger';

interface HealthCheckRecord {
  id: string;
  health_score: number;
  overall_status: string;
  timestamp: string;
}

export const useHealthAlerts = (warningThreshold: number = 80) => {
  const lastNotifiedRef = useRef<string | null>(null);
  const permissionRef = useRef<NotificationPermission>('default');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      permissionRef.current = Notification.permission;
    }
    // Preload notification sound
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      permissionRef.current = permission;
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  };

  const playAlertSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => devLog('Sound play failed:', err));
    }
  };

  const sendNotification = (score: number, status: string) => {
    // Play sound alert
    playAlertSound();

    // Browser notification
    if (permissionRef.current === 'granted') {
      const notification = new Notification('⚠️ Health Score Alert', {
        body: `Database health score dropped to ${score}%. Status: ${status.toUpperCase()}`,
        icon: '/favicon.png',
        tag: 'health-alert',
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }

    toast.warning('Health Score Alert', `Score dropped to ${score}% - ${status}`);
  };

  useEffect(() => {
    const channel = supabase
      .channel('health-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'health_check_history'
        },
        (payload) => {
          const record = payload.new as HealthCheckRecord;
          
          if (record.health_score < warningThreshold && lastNotifiedRef.current !== record.id) {
            lastNotifiedRef.current = record.id;
            sendNotification(record.health_score, record.overall_status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [warningThreshold, soundEnabled]);

  return { requestPermission, soundEnabled, setSoundEnabled };
};
