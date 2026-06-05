import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTeamChats } from '@/hooks/useTeamChat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
}

export function CreateGroupChatDialog({ open, onOpenChange }: Props) {
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const { createGroupChat } = useTeamChats();

  useEffect(() => {
    if (!open || !profile?.organization_id) return;

    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles_safe')
        .select('id, full_name, email')
        .eq('organization_id', profile.organization_id)
        .neq('id', user?.id);

      setUsers((data || []) as UserProfile[]);
    };

    fetchUsers();
  }, [open, profile?.organization_id, user?.id]);

  const selectedCount = useMemo(() => selectedMemberIds.length, [selectedMemberIds]);

  const toggleMember = (memberId: string, checked: boolean) => {
    setSelectedMemberIds((previous) => {
      if (checked) {
        return previous.includes(memberId) ? previous : [...previous, memberId];
      }

      return previous.filter((id) => id !== memberId);
    });
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    createGroupChat.mutate({ name, description, memberIds: selectedMemberIds });
    setName('');
    setDescription('');
    setSelectedMemberIds([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter group name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group about?" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Add members</Label>
              <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
            </div>
            <ScrollArea className="h-48 rounded-md border p-2">
              <div className="space-y-2">
                {users.map((member) => {
                  const checked = selectedMemberIds.includes(member.id);

                  return (
                    <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
                      <Checkbox checked={checked} onCheckedChange={(value) => toggleMember(member.id, value === true)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{member.full_name || member.email}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </label>
                  );
                })}
                {users.length === 0 ? <p className="px-2 py-4 text-sm text-muted-foreground">No other organization users are available.</p> : null}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || createGroupChat.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
