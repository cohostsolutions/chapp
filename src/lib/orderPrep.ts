export interface ParsedOrderItem {
  name: string;
  quantity: number;
  price: number;
  notes: string | null;
}

export interface PrepTaskStatusMeta {
  label: string;
  tone: string;
}

export const prepTaskStatusConfig: Record<string, PrepTaskStatusMeta> = {
  scheduled: {
    label: 'Scheduled',
    tone: 'bg-info/15 text-info border-info/30',
  },
  in_progress: {
    label: 'In Progress',
    tone: 'bg-primary/15 text-primary border-primary/30',
  },
  ready: {
    label: 'Ready',
    tone: 'bg-success/15 text-success border-success/30',
  },
  completed: {
    label: 'Completed',
    tone: 'bg-muted text-muted-foreground border-muted',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'bg-destructive/15 text-destructive border-destructive/30',
  },
};

export function normalizeMenuItemName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function parseManualOrderItems(input: string): ParsedOrderItem[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const quantityMatch = line.match(/^(\d+)\s*x\s*(.+)$/i);

      if (quantityMatch) {
        return {
          name: quantityMatch[2].trim(),
          quantity: Math.max(1, Number(quantityMatch[1])),
          price: 0,
          notes: null,
        };
      }

      return {
        name: line,
        quantity: 1,
        price: 0,
        notes: null,
      };
    });
}