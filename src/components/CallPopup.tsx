import { useState, useEffect } from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
} from '@/components/shared/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  User,
  Clock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useTwilioVoice, formatCallDuration } from '@/hooks/useTwilioVoice';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import { cn } from '@/lib/utils';

interface CallPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName?: string;
  phoneNumber?: string;
  leadId?: string;
}

export function CallPopup({ open, onOpenChange, leadName, phoneNumber: initialPhone, leadId }: CallPopupProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhone || '');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const { phonePlaceholder } = useOrganizationPhone();
  
  const {
    config,
    isLoading,
    callState,
    makeCall,
    endCall,
    toggleMute,
  } = useTwilioVoice();

  useEffect(() => {
    if (initialPhone) {
      setPhoneNumber(initialPhone);
    }
  }, [initialPhone]);

  const handleCall = () => {
    if (!phoneNumber) return;
    makeCall(phoneNumber, leadName, leadId);
  };

  const handleClose = () => {
    if (callState.isConnected || callState.isConnecting) {
      endCall();
    }
    onOpenChange(false);
    setPhoneNumber(initialPhone || '');
  };

  const isInCall = callState.isConnected || callState.isConnecting;

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={handleClose}
      maxWidth="sm:max-w-[400px]"
      maxHeight="max-h-[70vh]"
    >
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary" />
          {isInCall ? 'Call in Progress' : 'Make a Call'}
          {config?.simulationMode && (
            <Badge variant="outline" className="text-xs ml-2">
              <AlertCircle className="w-3 h-3 mr-1" />
              Demo
            </Badge>
          )}
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>

      <ResponsiveDialogBody>
        <div className="space-y-6">
          {!isInCall ? (
            <>
              {leadName && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-semibold text-foreground">{leadName}</p>
                </div>
              )}
              <div className="text-center">
                <Input
                  type="tel"
                  placeholder={phonePlaceholder}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="text-center text-lg font-mono"
                />
              </div>
              <Button 
                variant="glow" 
                size="lg" 
                className="w-full"
                onClick={handleCall}
                disabled={!phoneNumber || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Phone className="w-5 h-5 mr-2" />
                )}
                Start Call
              </Button>
              {config?.simulationMode && (
                <p className="text-center text-xs text-muted-foreground">
                  📞 Calls are simulated until Twilio is configured
                </p>
              )}
            </>
          ) : (
            <div className="text-center space-y-6">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
                callState.isConnecting 
                  ? "bg-warning/20 animate-pulse" 
                  : "bg-success/20 animate-pulse-subtle"
              )}>
                <User className={cn(
                  "w-10 h-10",
                  callState.isConnecting ? "text-warning" : "text-success"
                )} />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {callState.currentLead || leadName || 'Unknown'}
                </p>
                <p className="text-muted-foreground text-sm">{callState.currentNumber || phoneNumber}</p>
                {callState.isConnecting && (
                  <Badge variant="outline" className="mt-2">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Connecting...
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 text-xl font-mono text-primary">
                <Clock className="w-4 h-4" />
                {formatCallDuration(callState.callDuration)}
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant={callState.isMuted ? "destructive" : "secondary"}
                  size="icon"
                  className="w-12 h-12 rounded-full"
                  onClick={toggleMute}
                  disabled={callState.isConnecting}
                >
                  {callState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="w-14 h-14 rounded-full"
                  onClick={endCall}
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
                <Button
                  variant={!isSpeakerOn ? "destructive" : "secondary"}
                  size="icon"
                  className="w-12 h-12 rounded-full"
                  onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                  disabled={callState.isConnecting}
                >
                  {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </ResponsiveDialogBody>
    </ResponsiveDialog>
  );
}
