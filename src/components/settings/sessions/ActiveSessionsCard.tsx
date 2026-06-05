import { useSessionManagement } from '@/hooks/useSessionManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Laptop, Smartphone, Tablet, Monitor, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function getDeviceIcon(deviceType: string | null) {
  if (!deviceType) return <Monitor className="h-5 w-5" />;
  const type = deviceType.toLowerCase();
  if (type.includes('mobile') || type.includes('phone')) return <Smartphone className="h-5 w-5" />;
  if (type.includes('tablet') || type.includes('ipad')) return <Tablet className="h-5 w-5" />;
  if (type.includes('mac') || type.includes('laptop')) return <Laptop className="h-5 w-5" />;
  return <Monitor className="h-5 w-5" />;
}

export function ActiveSessionsCard() {
  const {
    sessions,
    isLoading,
    revokeSession,
    revokeAllOtherSessions,
    isRevoking,
    currentSessionToken,
  } = useSessionManagement();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const otherSessions = sessions?.filter(s => s.session_token !== currentSessionToken) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription className="mt-1.5">
              Manage your active sessions across devices. Revoke access to devices you don't recognize.
            </CardDescription>
          </div>
          {otherSessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => revokeAllOtherSessions()}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign out all other sessions
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!sessions?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active sessions found.
          </p>
        ) : (
          sessions.map((session) => {
            const isCurrentSession = session.session_token === currentSessionToken;
            
            return (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  isCurrentSession ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${isCurrentSession ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                    {getDeviceIcon(session.device_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {session.device_type || 'Unknown Device'}
                      </span>
                      {isCurrentSession && (
                        <Badge variant="default" className="text-xs">
                          Current Session
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>IP: {session.ip_address || 'Unknown'}</p>
                      <p>
                        Last active:{' '}
                        {formatDistanceToNow(new Date(session.last_activity_at), { addSuffix: true })}
                      </p>
                      {session.location && (
                        <p>Timezone: {session.location}</p>
                      )}
                    </div>
                  </div>
                </div>
                {!isCurrentSession && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeSession(session.id)}
                    disabled={isRevoking}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    Revoke
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
