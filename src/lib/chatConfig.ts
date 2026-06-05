import { Flame, Thermometer, Snowflake, type LucideIcon } from 'lucide-react';

export type AgentType = 'jay' | 'may' | 'cece' | string;

export interface AvailableNumber {
  id: string;
  number: string;
  label: string;
}

export const availableChatNumbers: AvailableNumber[] = [
  { id: '1', number: '+12015550123', label: 'Primary' },
];

export function getAgentDisplayName(type: AgentType): string {
  switch (type) {
    case 'jay': return 'Jay';
    case 'may': return 'May';
    case 'cece': return 'Cece';
    default: return 'AI';
  }
}

export interface TemperatureDisplay {
  icon: LucideIcon;
  color: string;
  bg: string;
}

export function getTemperatureDisplay(temp: string | null | undefined): TemperatureDisplay | null {
  switch (temp) {
    case 'hot': return { icon: Flame, color: 'text-red-500', bg: 'bg-red-500/10' };
    case 'warm': return { icon: Thermometer, color: 'text-amber-500', bg: 'bg-amber-500/10' };
    case 'cold': return { icon: Snowflake, color: 'text-blue-500', bg: 'bg-blue-500/10' };
    default: return null;
  }
}

// Attachment policy
export const maxAttachmentSizeBytes = 10 * 1024 * 1024; // 10MB
export const allowedAttachmentTypes = new Set<string>([
  'image/jpeg', 'image/png', 'image/gif',
  'application/pdf',
]);
