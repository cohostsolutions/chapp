import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { devError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useDeletedRecordArchives } from '@/hooks/useDeletedRecordArchives';
import { useDeletedBookingArchives } from '@/hooks/useDeletedBookingArchives';
import { useDeletedLeadArchives } from '@/hooks/useDeletedLeadArchives';
import { useDeletedRoomArchives } from '@/hooks/useDeletedRoomArchives';
import { getRecoveryWindowLabel } from '@/lib/bookingOperations';
import { supabase } from '@/integrations/supabase/client';

const TABLE_LABELS: Record<string, string> = {
  pricing_market_profiles: 'Pricing Profile',
  booking_templates: 'Booking Template',
  filter_presets: 'Filter Preset',
  maintenance_blocks: 'Maintenance Block',
  message_templates: 'Message Template',
  orders: 'Order',
  reports: 'Report',
  social_platforms: 'Disconnected Social Asset',
  teams: 'Team',
  workflows: 'Workflow',
};

function getArchiveLabel(displayLabel: string | null, recordData: Record<string, unknown>) {
  if (displayLabel) return displayLabel;

  const candidates = [recordData.name, recordData.title, recordData.email, recordData.expense_type];
  const resolved = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
  return typeof resolved === 'string' ? resolved : 'Deleted item';
}

export function DeletedItemsTab() {
  const deletedRecords = useDeletedRecordArchives();
  const deletedBookings = useDeletedBookingArchives();
  const deletedLeads = useDeletedLeadArchives();
  const deletedRooms = useDeletedRoomArchives();

  const handleRestoreBooking = async (archiveId: string, shouldSyncCalendar: boolean) => {
    const restoredBookingId = await deletedBookings.restoreArchive.mutateAsync(archiveId);
    if (shouldSyncCalendar) {
      try {
        await supabase.functions.invoke('sync-booking-calendar', {
          body: { bookingId: restoredBookingId },
        });
      } catch (error) {
        devError('Failed to re-sync restored booking:', error);
      }
    }

    await deletedBookings.refetch();
  };

  const handleRestoreRecord = async (archiveId: string) => {
    await deletedRecords.restoreArchive.mutateAsync(archiveId);
    await deletedRecords.refetch();
  };

  const handleRestoreLead = async (archiveId: string) => {
    await deletedLeads.restoreArchive.mutateAsync(archiveId);
    await deletedLeads.refetch();
  };

  const handleRestoreRoom = async (archiveId: string) => {
    await deletedRooms.restoreArchive.mutateAsync(archiveId);
    await deletedRooms.refetch();
  };

  return (
    <div className="space-y-6">
      <Card className="glass border-warning/30 bg-warning/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-warning" />
            <CardTitle>Deleted Items</CardTitle>
          </div>
          <CardDescription>
            Deleted records stay recoverable for 5 hours. After that window, they are permanently removed.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
          <CardDescription>Booking deletions with related lead recovery when needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deletedBookings.archives.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deleted bookings are currently recoverable.</p>
          ) : (
            deletedBookings.archives.map((archive) => {
              const bookingData = archive.booking_data as { check_in?: string; check_out?: string; calendar_event_id?: string | null };
              const leadData = archive.lead_data as { name?: string | null } | null;

              return (
                <div key={archive.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{leadData?.name || 'Deleted booking'}</p>
                    <p className="text-xs text-muted-foreground">{bookingData.check_in || 'Unknown'} to {bookingData.check_out || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{getRecoveryWindowLabel(archive.expires_at)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deletedBookings.restoreArchive.isPending}
                    onClick={() => handleRestoreBooking(archive.id, Boolean(bookingData.calendar_event_id))}
                  >
                    {deletedBookings.restoreArchive.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Leads</CardTitle>
          <CardDescription>Recover deleted leads with their archived relationship data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deletedLeads.archives.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deleted leads are currently recoverable.</p>
          ) : (
            deletedLeads.archives.map((archive) => {
              const leadData = archive.lead_data as { name?: string | null; email?: string | null };

              return (
                <div key={archive.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{leadData.name || leadData.email || 'Deleted lead'}</p>
                    <p className="text-xs text-muted-foreground">{getRecoveryWindowLabel(archive.expires_at)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deletedLeads.restoreArchive.isPending}
                    onClick={() => handleRestoreLead(archive.id)}
                  >
                    {deletedLeads.restoreArchive.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Rooms</CardTitle>
          <CardDescription>Recover deleted rooms with bookings, maintenance blocks, and sync history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deletedRooms.archives.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deleted rooms are currently recoverable.</p>
          ) : (
            deletedRooms.archives.map((archive) => {
              const roomData = archive.room_data as { name?: string | null };

              return (
                <div key={archive.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{roomData.name || 'Deleted room'}</p>
                    <p className="text-xs text-muted-foreground">{getRecoveryWindowLabel(archive.expires_at)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deletedRooms.restoreArchive.isPending}
                    onClick={() => handleRestoreRoom(archive.id)}
                  >
                    {deletedRooms.restoreArchive.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Other Deleted Records</CardTitle>
          <CardDescription>Recoverable records from supported app sections.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deletedRecords.archives.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deleted records are currently recoverable.</p>
          ) : (
            deletedRecords.archives.map((archive) => (
              <div key={archive.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{getArchiveLabel(archive.display_label, archive.record_data)}</p>
                    <Badge variant="outline">{TABLE_LABELS[archive.table_name] || archive.table_name}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{getRecoveryWindowLabel(archive.expires_at)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={deletedRecords.restoreArchive.isPending}
                  onClick={() => handleRestoreRecord(archive.id)}
                >
                  {deletedRecords.restoreArchive.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}