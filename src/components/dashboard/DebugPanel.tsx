import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bug, 
  RefreshCw,
  Trash2,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle,
  Server,
  Database,
  Globe
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SystemHealth {
  database: 'healthy' | 'degraded' | 'down';
  auth: 'healthy' | 'degraded' | 'down';
  storage: 'healthy' | 'degraded' | 'down';
}

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  source: string;
}

export function DebugPanel() {
  const { user, profile, roles, aiAgentType } = useAuth();
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    database: 'healthy',
    auth: 'healthy',
    storage: 'healthy',
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const addLog = (level: LogEntry['level'], message: string, source: string) => {
    setLogs(prev => [{
      level,
      message,
      timestamp: new Date(),
      source,
    }, ...prev].slice(0, 100));
  };

  const checkSystemHealth = async () => {
    setIsChecking(true);
    const newHealth: SystemHealth = {
      database: 'healthy',
      auth: 'healthy',
      storage: 'healthy',
    };

    // Check database
    try {
      const start = performance.now();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      const duration = performance.now() - start;
      
      if (error) {
        newHealth.database = 'down';
        addLog('error', `Database check failed: ${error.message}`, 'Database');
      } else if (duration > 2000) {
        newHealth.database = 'degraded';
        addLog('warn', `Database response slow: ${Math.round(duration)}ms`, 'Database');
      } else {
        addLog('info', `Database healthy: ${Math.round(duration)}ms`, 'Database');
      }
    } catch (err) {
      newHealth.database = 'down';
      addLog('error', `Database unreachable: ${err}`, 'Database');
    }

    // Check auth
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session) {
        addLog('info', 'Auth session valid', 'Auth');
      } else {
        newHealth.auth = 'degraded';
        addLog('warn', 'No active session', 'Auth');
      }
    } catch (err) {
      newHealth.auth = 'down';
      addLog('error', `Auth check failed: ${err}`, 'Auth');
    }

    // Check storage
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) {
        newHealth.storage = 'degraded';
        addLog('warn', `Storage check: ${error.message}`, 'Storage');
      } else {
        addLog('info', `Storage healthy: ${buckets?.length || 0} buckets`, 'Storage');
      }
    } catch (err) {
      newHealth.storage = 'degraded';
      addLog('warn', `Storage check skipped: ${err}`, 'Storage');
    }

    setSystemHealth(newHealth);
    setIsChecking(false);
  };

  useEffect(() => {
    checkSystemHealth();
  }, []);

  const getHealthIcon = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'down':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
  };

  const getHealthColor = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy':
        return 'bg-success/20 text-success border-success/30';
      case 'degraded':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'down':
        return 'bg-destructive/20 text-destructive border-destructive/30';
    }
  };

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'info':
        return <Info className="w-4 h-4 text-info" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* System Health */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              System Health
            </CardTitle>
            <CardDescription>Real-time service status</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={checkSystemHealth} disabled={isChecking}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            Check
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
              <Database className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Database</p>
              </div>
              <Badge variant="outline" className={getHealthColor(systemHealth.database)}>
                {getHealthIcon(systemHealth.database)}
                <span className="ml-1 capitalize">{systemHealth.database}</span>
              </Badge>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Auth</p>
              </div>
              <Badge variant="outline" className={getHealthColor(systemHealth.auth)}>
                {getHealthIcon(systemHealth.auth)}
                <span className="ml-1 capitalize">{systemHealth.auth}</span>
              </Badge>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
              <Server className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Storage</p>
              </div>
              <Badge variant="outline" className={getHealthColor(systemHealth.storage)}>
                {getHealthIcon(systemHealth.storage)}
                <span className="ml-1 capitalize">{systemHealth.storage}</span>
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Info */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bug className="w-5 h-5 text-primary" />
            Session Debug Info
          </CardTitle>
          <CardDescription>Current user session details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">User ID:</span>
                <span className="font-mono text-xs">{user?.id?.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span>{user?.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Full Name:</span>
                <span>{profile?.full_name || 'N/A'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Organization:</span>
                <span className="font-mono text-xs">{profile?.organization_id?.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Roles:</span>
                <div className="flex gap-1">
                  {roles.map(role => (
                    <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AI Agent:</span>
                <Badge variant="outline">{aiAgentType || 'N/A'}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Logs */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">System Logs</CardTitle>
            <CardDescription>Recent debug messages</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLogs([])}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No logs yet</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 text-sm"
                  >
                    {getLogIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground">{log.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.source} • {log.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
