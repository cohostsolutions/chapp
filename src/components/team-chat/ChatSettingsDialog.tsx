import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { TeamChat } from '@/hooks/useTeamChat';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: TeamChat;
}

export function ChatSettingsDialog({ open, onOpenChange, chat }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{chat.name || 'Chat Settings'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {chat.description && (
            <p className="text-sm text-muted-foreground">{chat.description}</p>
          )}
          <div>
            <h4 className="text-sm font-medium mb-2">Members ({chat.members?.length || 0})</h4>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {chat.members?.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profile?.avatar_url || undefined} />
                      <AvatarFallback>{member.profile?.full_name?.charAt(0) || member.profile?.email?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{member.profile?.full_name || member.profile?.email}</p>
                    </div>
                    {member.role === 'admin' && <Badge variant="secondary">Admin</Badge>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
