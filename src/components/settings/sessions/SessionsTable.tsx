import { useAllUserSessions, type UserSessionWithProfile } from '@/hooks/useSessionManagement';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, LogOut, Laptop, Smartphone, Monitor } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function getDeviceIcon(deviceType: string | null) {
  if (!deviceType) return <Monitor className="h-4 w-4" />;
  const type = deviceType.toLowerCase();
  if (type.includes('mobile') || type.includes('phone')) return <Smartphone className="h-4 w-4" />;
  return <Laptop className="h-4 w-4" />;
}

export function SessionsTable() {
  const { sessions, isLoading, revokeUserSessions, isRevoking } = useAllUserSessions();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sessions?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No active sessions found.
      </div>
    );
  }

  // Group sessions by user
  const sessionsByUser = sessions.reduce<Record<string, { user: UserSessionWithProfile['profiles']; sessions: UserSessionWithProfile[] }>>((acc, session) => {
    const userId = session.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        user: session.profiles,
        sessions: [],
      };
    }
    acc[userId].sessions.push(session);
    return acc;
  }, {});

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Device</TableHead>
          <TableHead>IP Address</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Last Active</TableHead>
          <TableHead>Sessions</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(sessionsByUser).map(([userId, { user, sessions: userSessions }]) => (
          <TableRow key={userId}>
            <TableCell>
              <div>
                <p className="font-medium">{user?.full_name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getDeviceIcon(userSessions[0]?.device_type)}
                <span className="text-sm">{userSessions[0]?.device_type || 'Unknown'}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm">{userSessions[0]?.ip_address || 'Unknown'}</TableCell>
            <TableCell className="text-sm">{userSessions[0]?.location || '-'}</TableCell>
            <TableCell className="text-sm">
              {formatDistanceToNow(new Date(userSessions[0]?.last_activity_at), { addSuffix: true })}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{userSessions.length} active</Badge>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revokeUserSessions(userId)}
                disabled={isRevoking}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isRevoking ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <LogOut className="h-4 w-4 mr-1" />
                )}
                Revoke All
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
