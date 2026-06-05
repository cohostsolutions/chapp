import { useState } from 'react';
import { devError } from '@/lib/logger';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, MessageSquare, Mail, MessageCircle, Facebook, Instagram, Phone, PhoneOff, Mic, MicOff, User, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSendSMS, useSendEmail, useSendSocialMessage } from '@/hooks/useCommunications';
import { useTwilioVoice, formatCallDuration } from '@/hooks/useTwilioVoice';
import { Badge } from '@/components/ui/badge';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
  onMessageSent?: () => void;
}

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  platform_user_id: string | null;
}

const channelOptions = [
  { id: 'sms', label: 'SMS', icon: MessageSquare, requiresPhone: true },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, requiresPhone: true },
  { id: 'email', label: 'Email', icon: Mail, requiresEmail: true },
  { id: 'messenger', label: 'Messenger', icon: Facebook, requiresPhone: false },
  { id: 'instagram', label: 'Instagram', icon: Instagram, requiresPhone: false },
];

export function NewMessageDialog({ open, onOpenChange, organizationId, onMessageSent }: NewMessageDialogProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedChannel, setSelectedChannel] = useState('sms');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'message' | 'call'>('message');
  const [dialerNumber, setDialerNumber] = useState('');
  const { toast } = useToast();
  const { phonePlaceholder } = useOrganizationPhone();

  const sendSMS = useSendSMS();
  const sendEmail = useSendEmail();
  const sendSocialMessage = useSendSocialMessage();

  // Twilio voice for dialer
  const {
    config: twilioConfig,
    isLoading: isTwilioLoading,
    callState,
    makeCall,
    endCall,
    toggleMute,
  } = useTwilioVoice();

  const isInCall = callState.isConnected || callState.isConnecting;

  // Fetch leads without existing conversations
  const { data: leads = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ['leads-for-message', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, email, platform_user_id')
        .eq('organization_id', organizationId)
        .order('name');
      
      if (error) throw error;
      return data as Lead[];
    },
    enabled: open && !!organizationId,
  });

  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone?.includes(searchTerm) ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentChannel = channelOptions.find(c => c.id === selectedChannel);
  const canSend = selectedLead && message.trim() && (
    (currentChannel?.requiresPhone && selectedLead.phone) ||
    (currentChannel?.requiresEmail && selectedLead.email) ||
    ((selectedChannel === 'messenger' || selectedChannel === 'instagram') && selectedLead.platform_user_id) ||
    (!currentChannel?.requiresPhone && !currentChannel?.requiresEmail)
  );

  const handleSend = async () => {
    if (!selectedLead || !message.trim() || !organizationId) return;

    setIsSending(true);
    try {
      if (selectedChannel === 'sms' && selectedLead.phone) {
        await sendSMS.mutateAsync({
          organizationId,
          leadId: selectedLead.id,
          toNumber: selectedLead.phone,
          message,
        });
      } else if (selectedChannel === 'email' && selectedLead.email) {
        await sendEmail.mutateAsync({
          organizationId,
          leadId: selectedLead.id,
          to: selectedLead.email,
          subject: subject || 'Message from AlCor Nexus',
          message,
        });
      } else if (['whatsapp', 'messenger', 'instagram'].includes(selectedChannel)) {
        const recipientId = selectedChannel === 'whatsapp'
          ? selectedLead.phone
          : selectedLead.platform_user_id;

        if (!recipientId) {
          throw new Error(
            selectedChannel === 'whatsapp'
              ? 'Selected lead does not have a phone number for WhatsApp messaging.'
              : `Selected lead does not have a linked ${selectedChannel} recipient ID.`
          );
        }

        await sendSocialMessage.mutateAsync({
          platform: selectedChannel as 'whatsapp' | 'messenger' | 'instagram',
          organizationId,
          leadId: selectedLead.id,
          recipientId,
          message,
        });
      }

      toast({ title: 'Message sent', description: `Your ${currentChannel?.label} message has been sent.` });
      onMessageSent?.();
      handleClose();
    } catch (error) {
      devError('Error sending message:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    // End any active call when closing
    if (isInCall) {
      endCall();
    }
    setSelectedLead(null);
    setMessage('');
    setSubject('');
    setSearchTerm('');
    setSelectedChannel('sms');
    setActiveTab('message');
    setDialerNumber('');
    onOpenChange(false);
  };

  const handleStartCall = () => {
    const numberToCall = selectedLead?.phone || dialerNumber;
    if (!numberToCall) {
      toast({ title: 'Error', description: 'Please enter a phone number or select a lead with a phone number', variant: 'destructive' });
      return;
    }
    makeCall(numberToCall, selectedLead?.name, selectedLead?.id);
  };

  const handleDialerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && dialerNumber) {
      handleStartCall();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Communication</DialogTitle>
          <DialogDescription>
            Send a message or make a call
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'message' | 'call')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="message" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Message
            </TabsTrigger>
            <TabsTrigger value="call" className="gap-2">
              <Phone className="w-4 h-4" />
              Call
            </TabsTrigger>
          </TabsList>

          {/* Call Tab */}
          <TabsContent value="call" className="space-y-4">
            {!isInCall ? (
              <>
                {/* Dialer Input */}
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    type="tel"
                    placeholder={phonePlaceholder}
                    value={selectedLead?.phone || dialerNumber}
                    onChange={(e) => setDialerNumber(e.target.value)}
                    onKeyDown={handleDialerKeyDown}
                    disabled={!!selectedLead?.phone}
                    className="text-center text-lg font-mono"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {selectedLead?.phone ? `Calling ${selectedLead.name}` : 'Enter a number or select a lead below'}
                  </p>
                </div>

                {/* Lead Selection for Call */}
                {!selectedLead && (
                  <div className="space-y-3">
                    <Label>Or select a lead</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search leads..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <ScrollArea className="h-32 border rounded-md">
                      {isLoadingLeads ? (
                        <div className="p-4 text-center text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading...
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredLeads.filter(l => l.phone).map((lead) => (
                            <button
                              key={lead.id}
                              onClick={() => setSelectedLead(lead)}
                              className="w-full p-3 text-left hover:bg-secondary/50 transition-colors"
                            >
                              <p className="font-medium">{lead.name}</p>
                              <p className="text-xs text-muted-foreground">{lead.phone}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}

                {selectedLead && (
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <div>
                      <p className="font-medium">{selectedLead.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedLead.phone}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLead(null)}>
                      Change
                    </Button>
                  </div>
                )}

                <Button 
                  variant="glow" 
                  size="lg" 
                  className="w-full"
                  onClick={handleStartCall}
                  disabled={(!selectedLead?.phone && !dialerNumber) || isTwilioLoading}
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Start Call
                </Button>

                {twilioConfig?.simulationMode && (
                  <p className="text-center text-xs text-muted-foreground">
                    📞 Calls are simulated until Twilio is configured
                  </p>
                )}
              </>
            ) : (
              /* Active Call UI */
              <div className="text-center space-y-6 py-4">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
                  callState.isConnecting 
                    ? "bg-warning/20 animate-pulse" 
                    : "bg-success/20 animate-pulse"
                )}>
                  <User className={cn(
                    "w-10 h-10",
                    callState.isConnecting ? "text-warning" : "text-success"
                  )} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {callState.currentLead || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground">{callState.currentNumber}</p>
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
                <div className="flex items-center justify-center gap-4">
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
                </div>
              </div>
            )}
          </TabsContent>

          {/* Message Tab */}
          <TabsContent value="message" className="space-y-4">
          {/* Lead Selection */}
          {!selectedLead ? (
            <div className="space-y-3">
              <Label>Select a Lead</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <ScrollArea className="h-48 border rounded-md">
                {isLoadingLeads ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading leads...
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No leads found
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredLeads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="w-full p-3 text-left hover:bg-secondary/50 transition-colors"
                      >
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.phone && <span>{lead.phone}</span>}
                          {lead.phone && lead.email && <span> • </span>}
                          {lead.email && <span>{lead.email}</span>}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <>
              {/* Selected Lead Display */}
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="font-medium">{selectedLead.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedLead.phone || selectedLead.email || 'No contact info'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLead(null)}>
                  Change
                </Button>
              </div>

              {/* Channel Selection */}
              <div className="space-y-2">
                <Label>Channel</Label>
                <div className="flex flex-wrap gap-2">
                  {channelOptions.map((channel) => {
                    const Icon = channel.icon;
                    const disabled = 
                      (channel.requiresPhone && !selectedLead.phone) ||
                      (channel.requiresEmail && !selectedLead.email);
                    
                    return (
                      <Button
                        key={channel.id}
                        variant={selectedChannel === channel.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedChannel(channel.id)}
                        disabled={disabled}
                        className="gap-1.5"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {channel.label}
                      </Button>
                    );
                  })}
                </div>
                {!selectedLead.phone && (
                  <p className="text-xs text-muted-foreground">
                    SMS & WhatsApp require a phone number
                  </p>
                )}
                {!selectedLead.email && (
                  <p className="text-xs text-muted-foreground">
                    Email requires an email address
                  </p>
                )}
              </div>

              {/* Subject (for email) */}
              {selectedChannel === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Email subject..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              )}

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Send Button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="glow"
                  onClick={handleSend}
                  disabled={!canSend || isSending}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>Send {currentChannel?.label}</>
                  )}
                </Button>
              </div>
            </>
          )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
