import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  History, 
  UserPlus, 
  UserMinus, 
  RefreshCw,
  Calendar,
  User,
  Shield
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface RoleAuditEntry {
  id: string;
  user_id: string;
  changed_by: string | null;
  old_role: string | null;
  new_role: string | null;
  old_sub_role: string | null;
  new_sub_role: string | null;
  action: 'insert' | 'update' | 'delete';
  reason: string | null;
  created_at: string;
  user_profile?: {
    full_name: string | null;
    email: string;
  } | null;
  changer_profile?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface RoleHistoryViewerProps {
  userId?: string; // If provided, show only this user's history
  className?: string;
}

const roleColors: Record<string, string> = {
  super_admin: 'bg-destructive/20 text-destructive border-destructive/30',
  client_admin: 'bg-primary/20 text-primary border-primary/30',
  agent: 'bg-secondary text-foreground border-border',
  viewer: 'bg-muted text-muted-foreground border-border',
};

const actionIcons = {
  insert: UserPlus,
  update: RefreshCw,
  delete: UserMinus,
};

const actionColors = {
  insert: 'text-green-600',
  update: 'text-blue-600',
  delete: 'text-red-600',
};

export function RoleHistoryViewer({ userId, className }: RoleHistoryViewerProps) {
  const [limit, setLimit] = useState(50);

  const { data: auditEntries, isLoading, error } = useQuery({
    queryKey: ['role-audit', userId, limit],
    queryFn: async () => {
      let query = supabase
        .from('user_role_audit')
        .select(`
          *,
          user_profile:user_id(full_name, email),
          changer_profile:changed_by(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Type assertion needed due to Supabase foreign key resolution
      return data as any as RoleAuditEntry[];
    },
  });

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Role Change History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Error loading audit history: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Role Change History
        </CardTitle>
        <CardDescription>
          {userId ? 'User role change history' : 'Organization-wide role changes'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : auditEntries && auditEntries.length > 0 ? (
            <div className="space-y-4">
              {auditEntries.map((entry) => {
                const ActionIcon = actionIcons[entry.action];
                return (
                  <div
                    key={entry.id}
                    className="flex gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className={`mt-1 ${actionColors[entry.action]}`}>
                      <ActionIcon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      {/* User Info */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {entry.user_profile?.full_name || entry.user_profile?.email || 'Unknown User'}
                        </span>
                        {entry.user_profile?.email && entry.user_profile?.full_name && (
                          <span className="text-xs text-muted-foreground">
                            ({entry.user_profile.email})
                          </span>
                        )}
                      </div>

                      {/* Role Change */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.action === 'insert' && (
                          <>
                            <span className="text-sm text-muted-foreground">Added role:</span>
                            <Badge variant="outline" className={roleColors[entry.new_role || '']}>
                              {entry.new_role}
                            </Badge>
                            {entry.new_sub_role && (
                              <Badge variant="outline" className="text-xs">
                                {entry.new_sub_role}
                              </Badge>
                            )}
                          </>
                        )}
                        
                        {entry.action === 'update' && (
                          <>
                            <Badge variant="outline" className={roleColors[entry.old_role || '']}>
                              {entry.old_role}
                            </Badge>
                            {entry.old_sub_role && (
                              <Badge variant="outline" className="text-xs">
                                {entry.old_sub_role}
                              </Badge>
                            )}
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className={roleColors[entry.new_role || '']}>
                              {entry.new_role}
                            </Badge>
                            {entry.new_sub_role && (
                              <Badge variant="outline" className="text-xs">
                                {entry.new_sub_role}
                              </Badge>
                            )}
                          </>
                        )}
                        
                        {entry.action === 'delete' && (
                          <>
                            <span className="text-sm text-muted-foreground">Removed role:</span>
                            <Badge variant="outline" className={roleColors[entry.old_role || '']}>
                              {entry.old_role}
                            </Badge>
                            {entry.old_sub_role && (
                              <Badge variant="outline" className="text-xs">
                                {entry.old_sub_role}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(parseISO(entry.created_at), { addSuffix: true })}
                        </div>
                        {entry.changer_profile && (
                          <div className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            <span>
                              by {entry.changer_profile.full_name || entry.changer_profile.email}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Reason */}
                      {entry.reason && (
                        <div className="text-sm text-muted-foreground italic">
                          Reason: {entry.reason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {auditEntries.length >= limit && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => setLimit(limit + 50)}
                    className="text-sm text-primary hover:underline"
                  >
                    Load more...
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No role changes recorded yet</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
