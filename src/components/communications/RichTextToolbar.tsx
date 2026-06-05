import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextToolbarProps {
  onFormat: (format: string) => void;
  activeFormats?: string[];
  disabled?: boolean;
  compact?: boolean;
}

export function RichTextToolbar({ onFormat, activeFormats = [], disabled, compact }: RichTextToolbarProps) {
  const tools = [
    { id: 'bold', icon: Bold, label: 'Bold (Ctrl+B)' },
    { id: 'italic', icon: Italic, label: 'Italic (Ctrl+I)' },
    { id: 'underline', icon: Underline, label: 'Underline (Ctrl+U)' },
    { id: 'list', icon: List, label: 'Bullet List' },
  ];

  return (
    <div className={cn(
      "flex items-center gap-0.5",
      !compact && "border-r border-border pr-2 mr-1"
    )}>
      {tools.map((tool) => (
        <Button
          key={tool.id}
          variant="ghost"
          size="icon"
          className={cn(
            compact ? "h-6 w-6" : "h-7 w-7",
            activeFormats.includes(tool.id) && "bg-secondary text-primary"
          )}
          onClick={() => onFormat(tool.id)}
          disabled={disabled}
          title={tool.label}
          type="button"
        >
          <tool.icon className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
        </Button>
      ))}
    </div>
  );
}
