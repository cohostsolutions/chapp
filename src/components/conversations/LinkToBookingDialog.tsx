import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { BedDouble, Calendar, Star, CheckCircle, Link2, CalendarX, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/shared/ResponsiveDialog';
import { usePotentialBookings, useMergeLeadToBooking, BookingForMatching, useSearchBookings } from '@/hooks/useLeadBookingMatcher';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useDebounce } from '@/hooks/useDebounce';

interface LinkToBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  leadName: string;
  conversationDate: string | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-warning/10 text-warning border-warning/30' },
  confirmed: { label: 'Confirmed', color: 'bg-success/10 text-success border-success/30' },
  checked_in: { label: 'Checked In', color: 'bg-primary/10 text-primary border-primary/30' },
  checked_out: { label: 'Checked Out', color: 'bg-muted text-muted-foreground' },
};

export function LinkToBookingDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  conversationDate,
}: LinkToBookingDialogProps) {
  const [selectedBooking, setSelectedBooking] = useState<(BookingForMatching & { matchScore: number }) | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const { data: bookings, isLoading } = usePotentialBookings(leadId, conversationDate);
  const { search, searchResults, isSearching, clearSearch } = useSearchBookings();
  const mergeLeadMutation = useMergeLeadToBooking();

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedSearch.trim().length >= 2) {
      search(debouncedSearch);
    } else {
      clearSearch();
    }
  }, [debouncedSearch, search, clearSearch]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedBooking(null);
      clearSearch();
    }
  }, [open, clearSearch]);

  // Use search results if searching, otherwise use suggested bookings
  const displayedBookings = useMemo(() => {
    if (debouncedSearch.trim().length >= 2 && searchResults.length > 0) {
      return searchResults;
    }
    if (debouncedSearch.trim().length >= 2 && searchResults.length === 0 && !isSearching) {
      return []; // No search results
    }
    return bookings || [];
  }, [bookings, searchResults, debouncedSearch, isSearching]);

  const handleLink = async () => {
    if (!selectedBooking || !leadId) return;

    await mergeLeadMutation.mutateAsync({
      bookingId: selectedBooking.id,
      sourceLeadId: leadId, // Conversation lead (real info)
      targetLeadId: selectedBooking.lead_id, // Booking lead (placeholder)
    });

    onOpenChange(false);
    setSelectedBooking(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 50) return 'text-success';
    if (score >= 30) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          Link to Booking
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>

      <ResponsiveDialogBody>
        <div className="mb-4 p-3 rounded-lg bg-secondary/50">
          <p className="text-sm text-muted-foreground">Linking conversation from:</p>
          <p className="font-medium">{leadName}</p>
          {conversationDate && (
            <p className="text-sm text-muted-foreground">
              Started {format(new Date(conversationDate), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select a booking to link this conversation. The booking will be reassigned to this conversation's guest record without merging or deleting leads.
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by room, guest, status, or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            )}
          </div>

          {searchQuery.trim().length >= 2 && (
            <p className="text-xs text-muted-foreground">
              {isSearching ? 'Searching...' : `Found ${displayedBookings.length} result(s)`}
            </p>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : displayedBookings.length > 0 ? (
            <ScrollArea className="h-[300px] pr-2">
              <div className="space-y-2">
                {displayedBookings.map((booking) => (
                  <Card
                    key={booking.id}
                    className={`cursor-pointer transition-all ${
                      selectedBooking?.id === booking.id
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <BedDouble className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{booking.room_name}</span>
                              <Badge variant="outline" className={`text-xs ${statusConfig[booking.status]?.color || ''}`}>
                                {statusConfig[booking.status]?.label || booking.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Current guest: {booking.lead_name}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(booking.check_in), 'MMM d')} → {format(new Date(booking.check_out), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className={`flex items-center gap-1 font-medium ${getScoreColor(booking.matchScore)}`}>
                            <Star className="w-3 h-3" />
                            {booking.matchScore}%
                          </div>
                          {selectedBooking?.id === booking.id && (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </div>
                      {booking.matchReasons && booking.matchReasons.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {booking.matchReasons.map((reason, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-8 text-center">
              <CalendarX className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No bookings match your search' : 'No matching bookings found'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? 'Try a different search term' : 'There are no pending/confirmed bookings around this conversation\'s timeframe'}
              </p>
            </div>
          )}
        </div>
      </ResponsiveDialogBody>

      <ResponsiveDialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          onClick={handleLink}
          disabled={!selectedBooking || mergeLeadMutation.isPending}
        >
          {mergeLeadMutation.isPending ? 'Linking...' : 'Link to Booking'}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}
