import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Mail, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreateActivityDialogProps {
  leadId: string;
  leadName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Dialog for creating a call activity on a sales lead
 */
export function CreateCallDialog({
  leadId,
  leadName,
  isOpen,
  onOpenChange,
  onSuccess,
}: CreateActivityDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    duration: '15',
    outcome: 'pending',
    notes: '',
  });

  const handleCreate = async () => {
    if (!profile?.organization_id) {
      toast({
        title: 'Error',
        description: 'Organization not found',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('calendar_events').insert({
        organization_id: profile.organization_id,
        user_id: profile.id,
        related_lead_id: leadId,
        title: `Call with ${leadName}`,
        description: formData.notes || null,
        event_type: 'call',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + parseInt(formData.duration) * 60000).toISOString(),
        all_day: false,
      });

      if (error) throw error;

      toast({
        title: 'Call Created',
        description: `Call with ${leadName} scheduled for ${formData.duration} minutes`,
      });

      setFormData({ duration: '15', outcome: 'pending', notes: '' });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create call',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Log Call
          </DialogTitle>
          <DialogDescription>
            Record a call with {leadName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              max="480"
              value={formData.duration}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, duration: e.target.value }))
              }
              placeholder="15"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outcome">Call Outcome</Label>
            <Select
              value={formData.outcome}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, outcome: value }))
              }
            >
              <SelectTrigger id="outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending Follow-up</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
                <SelectItem value="voicemail">Left Voicemail</SelectItem>
                <SelectItem value="wrong_number">Wrong Number</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Call Notes</Label>
            <Textarea
              id="notes"
              placeholder="What did you discuss?"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Log Call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog for creating an email activity on a sales lead
 */
export function CreateEmailDialog({
  leadId,
  leadName,
  isOpen,
  onOpenChange,
  onSuccess,
}: CreateActivityDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    followUpIn: '3', // days
  });

  const handleCreate = async () => {
    if (!profile?.organization_id) {
      toast({
        title: 'Error',
        description: 'Organization not found',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.subject.trim() || !formData.message.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in subject and message',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + parseInt(formData.followUpIn));

      const { error } = await supabase.from('calendar_events').insert({
        organization_id: profile.organization_id,
        user_id: profile.id,
        related_lead_id: leadId,
        title: `Email: ${formData.subject}`,
        description: formData.message || null,
        event_type: 'email',
        start_time: new Date().toISOString(),
        end_time: followUpDate.toISOString(),
        all_day: false,
      });

      if (error) throw error;

      toast({
        title: 'Email Logged',
        description: `Email to ${leadName} recorded. Follow-up in ${formData.followUpIn} days`,
      });

      setFormData({ subject: '', message: '', followUpIn: '3' });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to log email',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            Log Email
          </DialogTitle>
          <DialogDescription>
            Record an email sent to {leadName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, subject: e.target.value }))
              }
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="What did you send?"
              value={formData.message}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, message: e.target.value }))
              }
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="followUp">Follow-up in (days)</Label>
            <Select
              value={formData.followUpIn}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, followUpIn: value }))
              }
            >
              <SelectTrigger id="followUp">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">1 week</SelectItem>
                <SelectItem value="14">2 weeks</SelectItem>
                <SelectItem value="30">1 month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Log Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog for scheduling a meeting with a sales lead
 */
export function CreateMeetingDialog({
  leadId,
  leadName,
  isOpen,
  onOpenChange,
  onSuccess,
}: CreateActivityDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: `Meeting with ${leadName}`,
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    duration: '60',
    location: '',
    notes: '',
  });

  const handleCreate = async () => {
    if (!profile?.organization_id) {
      toast({
        title: 'Error',
        description: 'Organization not found',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const startDateTime = new Date(`${formData.date}T${formData.time}`);
      const endDateTime = new Date(
        startDateTime.getTime() + parseInt(formData.duration) * 60000
      );

      const { error } = await supabase.from('calendar_events').insert({
        organization_id: profile.organization_id,
        user_id: profile.id,
        related_lead_id: leadId,
        title: formData.title,
        description: formData.notes || formData.location || null,
        event_type: 'meeting',
        location: formData.location || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        all_day: false,
      });

      if (error) throw error;

      toast({
        title: 'Meeting Scheduled',
        description: `Meeting with ${leadName} on ${formData.date} at ${formData.time}`,
      });

      setFormData({
        title: `Meeting with ${leadName}`,
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
        duration: '60',
        location: '',
        notes: '',
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to schedule meeting',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Schedule Meeting
          </DialogTitle>
          <DialogDescription>
            Schedule a meeting with {leadName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, time: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="15"
              max="480"
              step="15"
              value={formData.duration}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, duration: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location/Video Call</Label>
            <Input
              id="location"
              placeholder="e.g., Zoom, Office, Coffee Shop"
              value={formData.location}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, location: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Meeting Notes</Label>
            <Textarea
              id="notes"
              placeholder="Agenda or additional details"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Schedule Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
