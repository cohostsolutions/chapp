import { Award, BarChart3, BedDouble, Save, Scale, Users, Wallet, type LucideIcon } from 'lucide-react';

export type ReportingAgentType = 'cece' | null | undefined;
export type ReportingTabKey = 'overview' | 'leads' | 'bookings' | 'operations' | 'agents' | 'comparison' | 'saved';
export type SavedReportType = 'leads' | 'revenue' | 'agents' | 'bookings' | 'operations' | 'custom';

export interface ReportingTabDefinition {
  value: ReportingTabKey;
  label: string;
  icon: LucideIcon;
}

export interface SavedReportTypeDefinition {
  label: string;
  description: string;
}

export function getAgentAwareLeadLabel(agentType: ReportingAgentType) {
  return 'Inquiries';
}

export function getAgentAwareLeadNoun(agentType: ReportingAgentType) {
  return 'inquiry';
}

export function getAgentAwareLeadSourceCopy(agentType: ReportingAgentType) {
  return {
    title: 'Inquiry Sources',
    emptyText: 'No guest inquiries yet. Start capturing inquiries to see source distribution.',
    errorText: 'Failed to load inquiry source data.',
  };
}

export function getAgentAwareConversionCopy(agentType: ReportingAgentType) {
  return {
    title: 'Inquiry Conversion Funnel',
    emptyText: 'No inquiries yet. Start adding leads to see conversion data.',
    errorText: 'Failed to load inquiry conversion data.',
    metricLabel: 'Inquiries',
  };
}

export function getAgentAwareTemperatureCopy(agentType: ReportingAgentType) {
  return {
    title: 'Inquiry Temperature',
    emptyText: 'No inquiries yet.',
    errorText: 'Failed to load inquiry temperature data.',
    itemLabel: 'inquiries',
  };
}

export function getAgentAwareOperationsCopy(agentType: ReportingAgentType) {
  return {
    title: 'Property Operations Spend',
    description: 'Property costs, recurring overhead, and pending vendor payments.',
    emptyText: 'No property expenses recorded yet.',
  };
}

export function getAgentAwareAgentPerformanceCopy(agentType: ReportingAgentType) {
  return {
    title: 'Guest Inquiry Performance',
    emptyText: 'No inquiry activity yet. Assign leads to track guest follow-up performance.',
    assignedLabel: 'Assigned',
    completedLabel: 'Converted',
    rateLabel: 'Conversion Rate',
  };
}

export function getAgentAwareReportingTabs(agentType: ReportingAgentType): ReportingTabDefinition[] {
  const leadLabel = getAgentAwareLeadLabel(agentType);
  return [
    { value: 'overview', label: 'Overview', icon: BarChart3 },
    { value: 'leads', label: leadLabel, icon: Users },
    { value: 'bookings', label: 'Bookings', icon: BedDouble },
    { value: 'operations', label: 'Operations', icon: Wallet },
    { value: 'agents', label: 'Team', icon: Award },
    { value: 'comparison', label: 'Compare', icon: Scale },
    { value: 'saved', label: 'Saved', icon: Save },
  ];
}

export function getAgentAwareSavedReportTypes(agentType: ReportingAgentType): SavedReportType[] {
  return ['bookings', 'revenue', 'leads', 'agents', 'operations', 'custom'];
}

export function getAgentAwareSavedReportTypeDefinition(agentType: ReportingAgentType, type: SavedReportType): SavedReportTypeDefinition {
  switch (type) {
    case 'leads':
      return {
        label: 'Inquiry Source Report',
        description: 'Track guest inquiry channels, quality, and conversion flow.',
      };
    case 'revenue':
      return {
        label: 'Booking Revenue Report',
        description: 'Monitor booking revenue trends, stay value, and reservation growth.',
      };
    case 'agents':
      return {
        label: 'Guest Follow-Up Report',
        description: 'Analyze inquiry handling and guest conversion performance by team member.',
      };
    case 'bookings':
      return {
        label: 'Booking Analytics',
        description: 'Track reservation volume, status mix, and occupancy trends.',
      };
    case 'operations':
      return {
        label: 'Property Operations Spend',
        description: 'Review property costs, recurring overhead, and vendor balances.',
      };
    case 'custom':
    default:
      return {
        label: 'Custom Report',
        description: 'Build a custom report around your most important metrics.',
      };
  }
}