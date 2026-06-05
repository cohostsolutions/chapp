import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 lg:py-4">
      <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground">
        <span className="hidden sm:inline">Showing</span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger className="h-7 lg:h-8 w-[60px] lg:w-[70px] text-xs lg:text-sm">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden sm:inline">of {totalCount} results</span>
        <span className="sm:hidden">{totalCount} total</span>
      </div>
      
      <div className="flex items-center gap-1.5 lg:gap-2">
        <span className="text-xs lg:text-sm text-muted-foreground hidden lg:inline">
          {startItem}-{endItem} of {totalCount}
        </span>
        
        <div className="flex items-center gap-0.5 lg:gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 lg:h-8 lg:w-8"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 lg:h-8 lg:w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          </Button>
          
          <span className="px-2 lg:px-3 text-xs lg:text-sm font-medium whitespace-nowrap">
            {currentPage}/{totalPages || 1}
          </span>
          
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 lg:h-8 lg:w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 lg:h-8 lg:w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
          >
            <ChevronsRight className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
