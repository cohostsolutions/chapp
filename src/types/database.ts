// Centralized types derived from Supabase schema
import type { Database } from '@/integrations/supabase/types';

// Base types from database
export type Tables = Database['public']['Tables'];
export type Enums = Database['public']['Enums'];

// Lead types
export type LeadRow = Tables['leads']['Row'];
export type LeadInsert = Tables['leads']['Insert'];
export type LeadUpdate = Tables['leads']['Update'];
export type LeadStatus = Enums['lead_status'];
export type LeadTemperature = Enums['lead_temperature'];
export type QualificationStatus = Enums['qualification_status'];

// Organization types
export type OrganizationRow = Tables['organizations']['Row'];
export type AiAgentType = Enums['ai_agent_type'];
export type AgentAssignmentMethod = Enums['agent_assignment_method'];

// Profile types
export type ProfileRow = Tables['profiles']['Row'];
export type AppRole = Enums['app_role'];

// Conversation types
export type AiConversationRow = Tables['ai_conversations']['Row'];
export type CommunicationRow = Tables['communications']['Row'];

// Booking types
export type BookingRow = Tables['bookings']['Row'];
export type RoomUnitRow = Tables['room_units']['Row'];

// Order types
export type OrderRow = Tables['orders']['Row'];

// Extended types with relations
// These include all base row properties plus optional relations
// Use Pick to only include displayable fields for agents (excluding sensitive 2FA data)
export type AgentProfile = Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'avatar_url' | 'is_active' | 'organization_id'>;

export type LeadWithAgent = LeadRow & {
  assigned_agent?: AgentProfile | null;
};

export type ConversationWithMessages = AiConversationRow & {
  messages?: CommunicationRow[];
  lead?: LeadRow | null;
};

export type BookingWithRelations = BookingRow & {
  lead?: Pick<LeadRow, 'id' | 'name' | 'email' | 'phone'> | null;
  room?: Pick<RoomUnitRow, 'id' | 'name' | 'capacity'> | null;
};

export type ConversationWithLead = AiConversationRow & {
  lead?: Pick<LeadRow, 'id' | 'name' | 'email' | 'phone' | 'lead_temperature'> | null;
  messages_count?: number;
};

export type OrderWithLead = OrderRow & {
  lead?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

// Pagination types
export interface PaginationParams {
  page: number;
  pageSize: number;
}

// ============================================
// NEW FEATURE TYPES
// ============================================

// Lead Scoring
export interface LeadScoringConfig {
  id: string;
  organization_id: string;
  criteria: Record<string, unknown>;
  weights: Record<string, number>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface LeadScore {
  id: string;
  lead_id: string;
  score: number;
  prediction_data: Record<string, unknown> | null;
  calculated_at: string;
}

export interface LeadPrediction {
  id: string;
  lead_id: string;
  conversion_probability: number | null;
  predicted_value: number | null;
  predicted_close_date: string | null;
  confidence_level: 'low' | 'medium' | 'high' | null;
  factors: Record<string, unknown> | null;
  created_at: string;
}

// Communications
export type CommunicationType = 'sms' | 'whatsapp' | 'messenger' | 'instagram' | 'call' | 'email';
export type CommunicationDirection = 'inbound' | 'outbound';
export type CommunicationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'completed' | 'missed';

export interface Communication {
  id: string;
  organization_id: string;
  lead_id: string | null;
  type: CommunicationType;
  direction: CommunicationDirection;
  from_number: string | null;
  to_number: string | null;
  content: string | null;
  duration: number | null; // seconds for calls
  status: CommunicationStatus | null;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: string;
  organization_id: string;
  name: string;
  type: 'sms' | 'whatsapp' | 'email' | null;
  subject: string | null;
  content: string;
  variables: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

// Reporting
export type ReportType = 'leads' | 'orders' | 'revenue' | 'agents' | 'custom';

export interface Report {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  type: ReportType | null;
  config: Record<string, unknown>;
  schedule: Record<string, unknown> | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSchedule {
  id: string;
  report_id: string;
  frequency: 'daily' | 'weekly' | 'monthly' | null;
  recipients: string[];
  last_sent_at: string | null;
  next_send_at: string | null;
  is_active: boolean;
}

// Calendar
export type EventType = 'meeting' | 'call' | 'demo' | 'follow_up' | 'other';
export type EventStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface CalendarEvent {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  event_type: EventType | null;
  lead_id: string | null;
  assigned_to: string | null;
  google_event_id: string | null;
  meeting_link: string | null;
  attendees: Record<string, unknown> | null;
  reminders: Record<string, unknown> | null;
  status: EventStatus | null;
  created_at: string;
  updated_at: string;
}

// Documents
export interface Document {
  id: string;
  organization_id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  folder_id: string | null;
  lead_id: string | null;
  order_id: string | null;
  uploaded_by: string | null;
  version: number;
  is_template: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentFolder {
  id: string;
  organization_id: string;
  name: string;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DocumentSignature {
  id: string;
  document_id: string;
  signer_email: string;
  signer_name: string;
  status: 'pending' | 'signed' | 'declined' | 'expired' | null;
  signed_at: string | null;
  ip_address: string | null;
  signature_data: string | null;
  created_at: string;
}

// Workflows
export type WorkflowTriggerType = 'lead_created' | 'lead_updated' | 'status_changed' | 'order_created' | 'time_based' | 'manual';
export type WorkflowExecutionStatus = 'success' | 'failed' | 'partial';

export interface Workflow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  trigger_type: WorkflowTriggerType | null;
  trigger_config: Record<string, unknown>;
  actions: Record<string, unknown>;
  conditions: Record<string, unknown> | null;
  is_active: boolean;
  execution_count: number;
  last_executed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  lead_id: string | null;
  status: WorkflowExecutionStatus | null;
  actions_executed: Record<string, unknown> | null;
  error_message: string | null;
  executed_at: string;
}

// Customer Portal
export interface PortalAccess {
  id: string;
  lead_id: string;
  email: string;
  access_token: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  organization_id: string;
  lead_id: string | null;
  portal_access_id: string | null;
  subject: string;
  description: string;
  status: TicketStatus | null;
  priority: TicketPriority | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_email: string | null;
  message: string;
  is_internal: boolean;
  attachments: Record<string, unknown> | null;
  created_at: string;
}

// Multi-Currency
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
  is_active: boolean;
  updated_at: string;
}

// Dashboards
export interface Dashboard {
  id: string;
  organization_id: string;
  user_id: string | null;
  name: string;
  is_default: boolean;
  layout: Record<string, unknown>;
  widgets: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Security
export interface TwoFactorAuth {
  id: string;
  user_id: string;
  secret: string;
  is_enabled: boolean;
  backup_codes: string[];
  created_at: string;
  enabled_at: string | null;
}

export interface SecurityAuditLog {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: 'success' | 'failed' | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// GDPR
export interface DataExportRequest {
  id: string;
  lead_id: string;
  email: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  file_path: string | null;
  requested_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

export interface ConsentLog {
  id: string;
  lead_id: string | null;
  email: string;
  consent_type: string;
  is_granted: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Permissions
export interface PermissionSet {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  permissions: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission_set_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  granted_by: string | null;
  created_at: string;
}

// Onboarding
export interface OnboardingProgress {
  id: string;
  user_id: string;
  completed_steps: string[];
  current_step: string | null;
  is_completed: boolean;
  started_at: string;
  completed_at: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Filter types
export interface LeadFilters {
  search?: string;
  status?: LeadStatus | 'all';
  source?: string | 'all';
  temperature?: LeadTemperature | 'all';
  assignedAgentId?: string | 'all' | 'unassigned';
  organizationId?: string;
}

// Stats types
export interface DashboardStats {
  totalLeads: number;
  totalLeadsChange: number;
  activeConversations: number;
  activeConversationsChange: number;
  callsToday: number;
  callsTodayChange: number;
  conversionRate: number;
  conversionRateChange: number;
}

export interface TemperatureStats {
  cold: number;
  warm: number;
  hot: number;
}
