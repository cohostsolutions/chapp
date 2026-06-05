import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { User, Calendar, Star, CheckCircle, Link2, Bot, Search, Loader2 } from 'lucide-react';
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
import { usePotentialMatches, useMergeLeadToBooking, BookingForMatching, PotentialMatch, useSearchConversations } from '@/hooks/useLeadBookingMatcher';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useDebounce } from '@/hooks/useDebounce';

interface LinkGuestConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingForMatching | null;
  onLinked?: (leadId: string) => void;
}

export function LinkGuestConversationDialog({
  open,
  onOpenChange,
  booking,
  onLinked,
}: LinkGuestConversationDialogProps) {
  const [selectedMatch, setSelectedMatch] = useState<PotentialMatch | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const { data: matches, isLoading } = usePotentialMatches(booking);
  const { search, searchResults, isSearching, clearSearch } = useSearchConversations();
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
      setSelectedMatch(null);
      clearSearch();
    }
  }, [open, clearSearch]);

  // Use search results if searching, otherwise use suggested matches
  const displayedMatches = useMemo(() => {
    if (debouncedSearch.trim().length >= 2 && searchResults.length > 0) {
      return searchResults;
    }
    if (debouncedSearch.trim().length >= 2 && searchResults.length === 0 && !isSearching) {
      return []; // No search results
    }
    return matches || [];
  }, [matches, searchResults, debouncedSearch, isSearching]);

  const handleLink = async () => {
    if (!selectedMatch || !booking) return;

    const result = await mergeLeadMutation.mutateAsync({
      bookingId: booking.id,
      sourceLeadId: selectedMatch.lead.id,
      targetLeadId: booking.lead_id,
    });

    onLinked?.(result.mergedLeadId);
    onOpenChange(false);
    setSelectedMatch(null);
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'facebook': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'whatsapp': return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'instagram': return 'bg-pink-500/10 text-pink-600 border-pink-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
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
          Link Guest Conversation
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>

      <ResponsiveDialogBody>
        {booking && (
          <div className="mb-4 p-3 rounded-lg bg-secondary/50">
            <p className="text-sm text-muted-foreground">Linking to booking:</p>
            <p className="font-medium">{booking.room_name}</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(booking.check_in), 'MMM d')} → {format(new Date(booking.check_out), 'MMM d, yyyy')}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select a guest conversation to link to this booking. This updates the booking to use the selected guest record without merging or deleting either lead.
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, or platform..."
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
              {isSearching ? 'Searching...' : `Found ${displayedMatches.length} result(s)`}
            </p>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : displayedMatches.length > 0 ? (
            <ScrollArea className="h-[300px] pr-2">
              <div className="space-y-2">
                {displayedMatches.map((match) => (
                  <Card
                    key={match.conversation.id}
                    className={`cursor-pointer transition-all ${
                      selectedMatch?.conversation.id === match.conversation.id
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedMatch(match)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{match.lead.name}</span>
                              <Badge variant="outline" className={`text-xs ${getPlatformColor(match.conversation.platform)}`}>
                                {match.conversation.platform}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {match.lead.email || match.lead.phone || 'No contact info'}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(match.conversation.started_at), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className={`flex items-center gap-1 font-medium ${getScoreColor(match.matchScore)}`}>
                            <Star className="w-3 h-3" />
                            {match.matchScore}%
                          </div>
                          {selectedMatch?.conversation.id === match.conversation.id && (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </div>
                      {match.matchReasons.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {match.matchReasons.map((reason, i) => (
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
              <Bot className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No conversations match your search' : 'No matching conversations found'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? 'Try a different search term' : 'Try adjusting the booking dates or check if conversations exist around the check-in period'}
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
          disabled={!selectedMatch || mergeLeadMutation.isPending}
        >
          {mergeLeadMutation.isPending ? 'Linking...' : 'Link Guest Conversation'}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}
