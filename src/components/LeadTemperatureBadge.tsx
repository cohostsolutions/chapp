import { Badge } from "@/components/ui/badge";
import { Flame, Thermometer, Snowflake } from "lucide-react";

interface LeadTemperatureBadgeProps {
  temperature?: 'cold' | 'warm' | 'hot' | null;
  size?: 'sm' | 'md';
}

export function LeadTemperatureBadge({ temperature, size = 'md' }: LeadTemperatureBadgeProps) {
  if (!temperature) return null;

  const config = {
    cold: {
      icon: Snowflake,
      label: 'Cold',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    },
    warm: {
      icon: Thermometer,
      label: 'Warm',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    },
    hot: {
      icon: Flame,
      label: 'Hot',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
  };

  const { icon: Icon, label, className } = config[temperature];
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <Badge variant="outline" className={`${className} gap-1 ${size === 'sm' ? 'text-xs px-1.5 py-0.5' : ''}`}>
      <Icon className="shrink-0" style={{ width: iconSize, height: iconSize }} />
      {label}
    </Badge>
  );
}
