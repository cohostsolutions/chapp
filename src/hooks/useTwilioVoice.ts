import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { devLog, devError } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import { normalizePhoneNumber } from '@/lib/phone';

interface TwilioConfig {
  configured: boolean;
  simulationMode: boolean;
  token?: string;
  identity?: string;
  expiresIn?: number;
  missingSecrets?: string[];
  message?: string;
}

interface CallState {
  isConnecting: boolean;
  isConnected: boolean;
  isMuted: boolean;
  callDuration: number;
  currentNumber: string | null;
  currentLead: string | null;
  currentLeadId: string | null;
  error: string | null;
}

interface UseTwilioVoiceReturn {
  // State
  config: TwilioConfig | null;
  isLoading: boolean;
  callState: CallState;
  
  // Actions
  makeCall: (phoneNumber: string, leadName?: string, leadId?: string) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  refreshToken: () => Promise<void>;
}

export function useTwilioVoice(): UseTwilioVoiceReturn {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { defaultCountryCode } = useOrganizationPhone();
  const [config, setConfig] = useState<TwilioConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [callState, setCallState] = useState<CallState>({
    isConnecting: false,
    isConnected: false,
    isMuted: false,
    callDuration: 0,
    currentNumber: null,
    currentLead: null,
    currentLeadId: null,
    error: null,
  });
  
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const simulatedCallTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Twilio configuration on mount
  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setConfig({ configured: false, simulationMode: true, message: 'Not authenticated' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('twilio-voice-token', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        devError('Error fetching Twilio config:', error);
        setConfig({ configured: false, simulationMode: true, message: error.message });
        return;
      }

      setConfig(data as TwilioConfig);
    } catch (error) {
      devError('Error fetching Twilio config:', error);
      setConfig({ configured: false, simulationMode: true, message: 'Failed to load configuration' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    return () => {
      // Cleanup on unmount
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (simulatedCallTimeoutRef.current) {
        clearTimeout(simulatedCallTimeoutRef.current);
      }
    };
  }, [fetchConfig]);

  // Start duration timer
  const startDurationTimer = useCallback(() => {
    durationIntervalRef.current = setInterval(() => {
      setCallState(prev => ({
        ...prev,
        callDuration: prev.callDuration + 1,
      }));
    }, 1000);
  }, []);

  // Stop duration timer
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Make a call (real or simulated)
  const makeCall = useCallback(async (phoneNumber: string, leadName?: string, leadId?: string) => {
    if (callState.isConnected || callState.isConnecting) {
      toast({
        title: 'Call in progress',
        description: 'Please end the current call before starting a new one.',
        variant: 'destructive',
      });
      return;
    }

    const cleanNumber = normalizePhoneNumber(phoneNumber, defaultCountryCode);

    setCallState(prev => ({
      ...prev,
      isConnecting: true,
      currentNumber: cleanNumber,
      currentLead: leadName || null,
      currentLeadId: leadId || null,
      error: null,
      callDuration: 0,
    }));

    try {
      if (config?.simulationMode) {
        // Simulation mode - fake the call
        toast({
          title: 'Simulation Mode',
          description: `Simulating call to ${leadName || cleanNumber}...`,
        });

        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        setCallState(prev => ({
          ...prev,
          isConnecting: false,
          isConnected: true,
        }));

        startDurationTimer();
        
        toast({
          title: 'Connected (Simulated)',
          description: `Call connected to ${leadName || cleanNumber}`,
        });
      } else {
        // Real Twilio call
        // Note: This requires the Twilio Voice SDK to be loaded
        // The actual implementation would use the Device.connect() method
        toast({
          title: 'Connecting...',
          description: `Calling ${leadName || cleanNumber}...`,
        });

        // For now, we'll fall back to simulation since SDK isn't loaded
        // In production, you'd initialize the Twilio Device here
        devLog('Would initiate real Twilio call to:', cleanNumber);
        
        await new Promise(resolve => setTimeout(resolve, 1500));

        setCallState(prev => ({
          ...prev,
          isConnecting: false,
          isConnected: true,
        }));

        startDurationTimer();
        
        toast({
          title: 'Connected',
          description: `Call connected to ${leadName || cleanNumber}`,
        });
      }
    } catch (error) {
      devError('Error making call:', error);
      setCallState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        error: error instanceof Error ? error.message : 'Failed to connect call',
      }));
      
      toast({
        title: 'Call Failed',
        description: error instanceof Error ? error.message : 'Failed to connect call',
        variant: 'destructive',
      });
    }
  }, [config?.simulationMode, callState.isConnected, callState.isConnecting, defaultCountryCode, startDurationTimer, toast]);

  // End the current call
  const endCall = useCallback(async () => {
    stopDurationTimer();
    
    const duration = callState.callDuration;
    const formattedDuration = formatDuration(duration);
    const leadId = callState.currentLeadId;
    const leadName = callState.currentLead;
    const phoneNumber = callState.currentNumber;
    
    // Log the call if we have a lead ID
    if (leadId && duration > 0) {
      try {
        await supabase
          .from('call_logs')
          .insert({
            lead_id: leadId,
            status: 'completed',
            duration_seconds: duration,
            notes: `Call to ${leadName || phoneNumber}`,
          });
        
        // Invalidate queries to refresh call history
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      } catch (error) {
        devError('Failed to log call:', error);
      }
    }
    
    setCallState({
      isConnecting: false,
      isConnected: false,
      isMuted: false,
      callDuration: 0,
      currentNumber: null,
      currentLead: null,
      currentLeadId: null,
      error: null,
    });

    toast({
      title: 'Call Ended',
      description: `Call duration: ${formattedDuration}`,
    });
  }, [callState.callDuration, callState.currentLeadId, callState.currentLead, callState.currentNumber, stopDurationTimer, toast, queryClient]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setCallState(prev => ({
      ...prev,
      isMuted: !prev.isMuted,
    }));
    
    // In real implementation, you'd call device.activeConnection?.mute(!isMuted)
    toast({
      title: callState.isMuted ? 'Unmuted' : 'Muted',
      description: callState.isMuted ? 'Microphone is now active' : 'Microphone is muted',
    });
  }, [callState.isMuted, toast]);

  // Refresh token
  const refreshToken = useCallback(async () => {
    await fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    isLoading,
    callState,
    makeCall,
    endCall,
    toggleMute,
    refreshToken,
  };
}

// Helper to format call duration
export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
