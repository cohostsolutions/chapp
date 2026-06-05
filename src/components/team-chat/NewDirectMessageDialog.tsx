import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (userId: string) => void;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export function NewDirectMessageDialog({ open, onOpenChange, onSelectUser }: Props) {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!open || !profile?.organization_id) return;
    
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles_safe')
        .select('id, full_name, email, avatar_url')
        .eq('organization_id', profile.organization_id)
        .neq('id', user?.id);
      setUsers(data || []);
    };
    fetchUsers();
  }, [open, profile?.organization_id, user?.id]);

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
        </DialogHeader>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ScrollArea className="h-64">
          <div className="space-y-1">
            {filteredUsers.map(u => (
              <button
                key={u.id}
                onClick={() => onSelectUser(u.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Avatar>
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback>{u.full_name?.charAt(0) || u.email.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
