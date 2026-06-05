import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SyncStatus {
  pendingCount: number;
  requests: string[];
}

interface SyncResult {
  success: number;
  failed: number;
}

export function OfflineSyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("You're back online", {
        description: "Syncing pending requests...",
      });
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You're offline", {
        description: "Changes will be synced when you're back online.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Listen for service worker sync messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "SYNC_SUCCESS") {
        toast.success("Request synced", {
          description: `${event.data.method} ${new URL(event.data.url).pathname}`,
        });
        fetchSyncStatus();
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, []);

  // Fetch sync queue status periodically
  const fetchSyncStatus = useCallback(async () => {
    if (!navigator.serviceWorker?.controller) return;

    try {
      const messageChannel = new MessageChannel();
      const statusPromise = new Promise<SyncStatus>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };
      });

      navigator.serviceWorker.controller.postMessage(
        { type: "GET_SYNC_STATUS" },
        [messageChannel.port2]
      );

      const status = await statusPromise;
      setSyncStatus(status);
    } catch (error) {
      console.error("Failed to get sync status:", error);
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  // Trigger manual sync
  const triggerSync = async () => {
    if (!navigator.serviceWorker?.controller || isSyncing) return;

    setIsSyncing(true);
    try {
      const messageChannel = new MessageChannel();
      const resultPromise = new Promise<SyncResult>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };
      });

      navigator.serviceWorker.controller.postMessage(
        { type: "RETRY_SYNC" },
        [messageChannel.port2]
      );

      const result = await resultPromise;
      setLastSyncResult(result);

      if (result.success > 0) {
        toast.success(`Synced ${result.success} request(s)`, {
          description: result.failed > 0 ? `${result.failed} failed` : undefined,
        });
      } else if (result.failed > 0) {
        toast.error(`Failed to sync ${result.failed} request(s)`);
      }

      await fetchSyncStatus();
    } catch (error) {
      console.error("Failed to trigger sync:", error);
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingCount = syncStatus?.pendingCount ?? 0;
  const showIndicator = !isOnline || pendingCount > 0;

  if (!showIndicator) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9",
            !isOnline && "text-destructive",
            pendingCount > 0 && isOnline && "text-warning"
          )}
        >
          {isOnline ? (
            <Wifi className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          {pendingCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center"
            >
              {pendingCount > 9 ? "9+" : pendingCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm font-medium text-foreground">Online</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span className="text-sm font-medium text-destructive">Offline</span>
              </>
            )}
          </div>

          {/* Pending Requests */}
          {pendingCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Pending requests
                </span>
                <Badge variant="secondary">{pendingCount}</Badge>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1">
                {syncStatus?.requests.slice(0, 5).map((url, index) => (
                  <div
                    key={index}
                    className="text-xs text-muted-foreground truncate bg-muted/50 px-2 py-1 rounded"
                  >
                    {url.replace("/sync-queue/", "")}
                  </div>
                ))}
                {(syncStatus?.requests.length ?? 0) > 5 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{(syncStatus?.requests.length ?? 0) - 5} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Last Sync Result */}
          {lastSyncResult && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {lastSyncResult.success > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <Check className="h-3 w-3" />
                  {lastSyncResult.success} synced
                </span>
              )}
              {lastSyncResult.failed > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {lastSyncResult.failed} failed
                </span>
              )}
            </div>
          )}

          {/* Sync Button */}
          {isOnline && pendingCount > 0 && (
            <Button
              onClick={triggerSync}
              disabled={isSyncing}
              className="w-full"
              size="sm"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>
          )}

          {/* Offline Message */}
          {!isOnline && (
            <p className="text-xs text-muted-foreground">
              Your changes will be automatically synced when you're back online.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
