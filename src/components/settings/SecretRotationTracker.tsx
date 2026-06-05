import { useState, useEffect } from "react";
import { devError } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, addDays } from "date-fns";
import { Key, AlertTriangle, CheckCircle, Clock, RefreshCw } from "lucide-react";

interface SecretRotation {
  id: string;
  secret_name: string;
  last_rotated_at: string | null;
  rotation_interval_days: number;
  created_at: string;
  updated_at: string;
}

export function SecretRotationTracker() {
  const [secrets, setSecrets] = useState<SecretRotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSecrets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("secret_rotation_tracking")
        .select("*")
        .order("secret_name");

      if (error) {
        devError("Error fetching secrets:", error);
        return;
      }

      setSecrets(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, []);

  const markAsRotated = async (secretId: string) => {
    setUpdating(secretId);
    try {
      const { error } = await supabase
        .from("secret_rotation_tracking")
        .update({ last_rotated_at: new Date().toISOString() })
        .eq("id", secretId);

      if (error) throw error;

      toast({
        title: "Secret marked as rotated",
        description: "Remember to update the actual secret value in your secret management system.",
      });

      fetchSecrets();
    } catch (error) {
      devError("Error updating secret rotation:", error);
      toast({
        title: "Error",
        description: "Failed to update rotation status",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const getRotationStatus = (secret: SecretRotation) => {
    if (!secret.last_rotated_at) {
      return { status: "never", daysOverdue: null, nextRotation: null };
    }

    const lastRotated = new Date(secret.last_rotated_at);
    const nextRotation = addDays(lastRotated, secret.rotation_interval_days);
    const today = new Date();
    const daysUntilRotation = differenceInDays(nextRotation, today);

    if (daysUntilRotation < 0) {
      return { status: "overdue", daysOverdue: Math.abs(daysUntilRotation), nextRotation };
    } else if (daysUntilRotation <= 14) {
      return { status: "due_soon", daysOverdue: null, nextRotation };
    }
    return { status: "ok", daysOverdue: null, nextRotation };
  };

  const getStatusBadge = (secret: SecretRotation) => {
    const { status, daysOverdue } = getRotationStatus(secret);

    switch (status) {
      case "never":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Never rotated
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Overdue by {daysOverdue} days
          </Badge>
        );
      case "due_soon":
        return (
          <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
            <Clock className="h-3 w-3" />
            Due soon
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            OK
          </Badge>
        );
    }
  };

  const formatSecretName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const overdueCount = secrets.filter(s => getRotationStatus(s).status === "overdue").length;
  const dueSoonCount = secrets.filter(s => getRotationStatus(s).status === "due_soon").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Secret Rotation Tracking
        </CardTitle>
        <CardDescription>
          Monitor and track API key rotation schedules for security compliance
        </CardDescription>
        {(overdueCount > 0 || dueSoonCount > 0) && (
          <div className="flex gap-2 pt-2">
            {overdueCount > 0 && (
              <Badge variant="destructive">{overdueCount} overdue</Badge>
            )}
            {dueSoonCount > 0 && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">
                {dueSoonCount} due soon
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Secret</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Rotated</TableHead>
              <TableHead>Interval</TableHead>
              <TableHead>Next Rotation</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                </TableRow>
              ))
            ) : secrets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No secrets being tracked
                </TableCell>
              </TableRow>
            ) : (
              secrets.map((secret) => {
                const { nextRotation } = getRotationStatus(secret);
                return (
                  <TableRow key={secret.id}>
                    <TableCell className="font-medium">
                      {formatSecretName(secret.secret_name)}
                    </TableCell>
                    <TableCell>{getStatusBadge(secret)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {secret.last_rotated_at
                        ? format(new Date(secret.last_rotated_at), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {secret.rotation_interval_days} days
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {nextRotation
                        ? format(nextRotation, "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAsRotated(secret.id)}
                        disabled={updating === secret.id}
                      >
                        {updating === secret.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Rotated
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="font-medium text-sm mb-2">How to rotate secrets:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Generate a new API key/secret in the external service (Twilio, Meta, Google, etc.)</li>
            <li>Update the secret value in your backend secret management</li>
            <li>Click "Mark Rotated" to update the tracking record</li>
            <li>Verify the integration still works with the new secret</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}