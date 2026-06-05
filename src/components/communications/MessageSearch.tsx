import { useEffect, useMemo, useState } from 'react';
import { Search, X, Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';

interface Message {
  id: string;
  content: string;
  timestamp: string;
  role: string;
}

interface MessageSearchProps {
  messages: Message[];
  onResultClick: (messageId: string) => void;
  onSearchActiveChange?: (isActive: boolean) => void;
}

export function MessageSearch({ messages, onResultClick, onSearchActiveChange }: MessageSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() && !dateRange.from) return [];

    return messages.filter((message) => {
      // Text search
      const matchesText = searchQuery.trim()
        ? message.content.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      // Date range filter
      let matchesDate = true;
      if (dateRange.from) {
        try {
          // Parse the timestamp - handle various formats
          const messageDate = message.timestamp.includes('T') 
            ? parseISO(message.timestamp)
            : new Date(message.timestamp);
          
          if (dateRange.to) {
            matchesDate = isWithinInterval(messageDate, {
              start: startOfDay(dateRange.from),
              end: endOfDay(dateRange.to),
            });
          } else {
            matchesDate = isWithinInterval(messageDate, {
              start: startOfDay(dateRange.from),
              end: endOfDay(dateRange.from),
            });
          }
        } catch {
          matchesDate = true;
        }
      }

      return matchesText && matchesDate;
    });
  }, [messages, searchQuery, dateRange]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onSearchActiveChange?.(newState);
    if (!newState) {
      setSearchQuery('');
      setDateRange({});
      setCurrentResultIndex(0);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setDateRange({});
    setCurrentResultIndex(0);
  };

  const navigateResults = (direction: 'up' | 'down') => {
    if (searchResults.length === 0) return;

    let newIndex = currentResultIndex;
    if (direction === 'down') {
      newIndex = (currentResultIndex + 1) % searchResults.length;
    } else {
      newIndex = currentResultIndex === 0 ? searchResults.length - 1 : currentResultIndex - 1;
    }

    setCurrentResultIndex(newIndex);
    onResultClick(searchResults[newIndex].id);
  };

  const hasFilters = searchQuery.trim() || dateRange.from;

  // When user types NEW text, automatically jump to the first match.
  // Only trigger when the query actually changes, not on every render.
  useEffect(() => {
    if (!isOpen) return;
    if (!searchQuery.trim()) return;
    if (searchQuery === lastSearchQuery) return;
    if (searchResults.length === 0) return;

    setLastSearchQuery(searchQuery);
    setCurrentResultIndex(0);
    onResultClick(searchResults[0].id);
  }, [isOpen, searchQuery, lastSearchQuery, searchResults, onResultClick]);

  return (
    <div className={cn(
      "flex items-center gap-2 transition-all duration-200",
      isOpen ? "flex-1" : ""
    )}>
      {isOpen ? (
        <div className="flex items-center gap-2 flex-1 bg-secondary/50 rounded-lg px-2 py-1">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentResultIndex(0);
            }}
            className="flex-1 border-0 bg-transparent h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
          
          {/* Date filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-7 w-7", dateRange.from && "text-primary")}
                title="Filter by date"
              >
                <Calendar className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover border shadow-lg z-50" align="end">
              <CalendarPicker
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                numberOfMonths={1}
              />
              {dateRange.from && (
                <div className="p-2 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setDateRange({})}
                    className="w-full"
                  >
                    Clear dates
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Results */}
          {hasFilters && (
            <div className="flex items-center gap-1 border-l border-border pl-2">
              {searchResults.length > 0 ? (
                <>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {currentResultIndex + 1}/{searchResults.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => navigateResults('up')}
                    title="Previous result"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => navigateResults('down')}
                    title="Next result"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground whitespace-nowrap">0 results</span>
              )}
            </div>
          )}

          {/* Single close button - clears and closes */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => {
              handleClear();
              handleToggle();
            }}
            title="Close search"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleToggle}
          title="Search messages"
        >
          <Search className="w-4 h-4" />
        </Button>
      )}

      {/* Active filters badge */}
      {!isOpen && hasFilters && (
        <Badge variant="secondary" className="text-xs">
          {searchResults.length} results
        </Badge>
      )}
    </div>
  );
}
