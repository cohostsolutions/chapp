import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface FilterTogglePanelProps {
  children: React.ReactNode;
  activeFilterCount?: number;
  onClearAll?: () => void;
  className?: string;
}

export function FilterTogglePanel({ 
  children, 
  activeFilterCount = 0,
  onClearAll,
  className 
}: FilterTogglePanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={cn(
              "gap-2",
              activeFilterCount > 0 && "border-primary text-primary"
            )}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Badge 
                variant="secondary" 
                className="h-5 w-5 p-0 flex items-center justify-center text-xs bg-primary text-primary-foreground"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-80 p-3 space-y-2 bg-popover border shadow-lg z-50"
          sideOffset={8}
        >
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      {activeFilterCount > 0 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <X className="h-3 w-3" />
          Clear all
        </Button>
      )}
    </div>
  );
}
