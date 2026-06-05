import { useState, useEffect } from "react";
import { devError } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Shield, Search, RefreshCw, User, Key, UserPlus, UserMinus, Edit } from "lucide-react";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
}

const actionConfig: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  google_oauth_issue_detected: { label: 'Google OAuth Issue', icon: <Shield className="h-3 w-3" />, variant: 'destructive' },
  user_created: { label: "User Created", icon: <UserPlus className="h-3 w-3" />, variant: "default" },
  user_updated: { label: "User Updated", icon: <Edit className="h-3 w-3" />, variant: "secondary" },
  user_activated: { label: "User Activated", icon: <User className="h-3 w-3" />, variant: "default" },
  user_deactivated: { label: "User Deactivated", icon: <UserMinus className="h-3 w-3" />, variant: "destructive" },
  password_reset_by_admin: { label: "Password Reset (Admin)", icon: <Key className="h-3 w-3" />, variant: "outline" },
  password_changed: { label: "Password Changed", icon: <Key className="h-3 w-3" />, variant: "secondary" },
};

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;

      if (error) {
        devError("Error fetching audit logs:", error);
        return;
      }

      // Fetch user emails for the logs - use profiles_safe view for security
      const userIds = [...new Set(data?.map(log => log.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles_safe")
        .select("id, email")
        .in("id", userIds);

      const emailMap = new Map(profiles?.map(p => [p.id, p.email]));

      const logsWithEmail = data?.map(log => ({
        ...log,
        user_email: log.user_id ? emailMap.get(log.user_id) : undefined,
      })) || [];

      setLogs(logsWithEmail);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchLower) ||
      log.resource_id?.toLowerCase().includes(searchLower) ||
      log.user_email?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.details).toLowerCase().includes(searchLower)
    );
  });

  const getActionBadge = (action: string) => {
    const config = actionConfig[action] || { label: action, icon: <Shield className="h-3 w-3" />, variant: "outline" as const };
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const formatDetails = (details: Record<string, unknown> | null) => {
    if (!details) return "-";
    
    // Clean up undefined values
    const cleanDetails = Object.fromEntries(
      Object.entries(details).filter(([_, v]) => v !== undefined)
    );
    
    if (Object.keys(cleanDetails).length === 0) return "-";
    
    return (
      <pre className="text-xs bg-muted p-2 rounded max-w-xs overflow-auto">
        {JSON.stringify(cleanDetails, null, 2)}
      </pre>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Audit Logs
        </CardTitle>
        <CardDescription>
          Track sensitive operations like user management and password changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="user_created">User Created</SelectItem>
              <SelectItem value="user_updated">User Updated</SelectItem>
              <SelectItem value="user_activated">User Activated</SelectItem>
              <SelectItem value="user_deactivated">User Deactivated</SelectItem>
              <SelectItem value="password_reset_by_admin">Password Reset (Admin)</SelectItem>
              <SelectItem value="password_changed">Password Changed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <ScrollArea className="h-[400px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="text-sm">
                      {log.user_email || log.user_id?.slice(0, 8) || "-"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {log.resource_type}/{log.resource_id?.slice(0, 8)}
                    </TableCell>
                    <TableCell>{formatDetails(log.details as any)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ip_address || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} logs
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={logs.length < pageSize}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}