import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHelpdeskTickets } from '@/hooks/useTeamChat';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateHelpdeskTicketDialog({ open, onOpenChange }: Props) {
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('normal');
  const { createTicket } = useHelpdeskTickets();

  const handleSubmit = async () => {
    if (!subject.trim()) return;

    try {
      await createTicket.mutateAsync({ subject: subject.trim(), priority });
      setSubject('');
      setPriority('normal');
      onOpenChange(false);
    } catch {
      // Mutation toast already reports the failure.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">What do you need help with?</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Describe your issue" />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!subject.trim() || createTicket.isPending}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
