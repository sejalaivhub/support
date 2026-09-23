export type UserType =
  | 'customer_user'
  | 'customer_admin'
  | 'agent'
  | 'manager'
  | 'account_manager'
  | 'admin';

export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketStatus =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'WAITING_FOR_INTERNAL_TEAM'
  | 'WAITING_FOR_VENDOR'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';

export type MessageType =
  | 'customer_message'
  | 'public_reply'
  | 'internal_note'
  | 'system_acknowledgement'
  | 'system_event';

export type AgentStatus = 'AVAILABLE' | 'BUSY' | 'AWAY' | 'ON_LEAVE' | 'INACTIVE';

export interface Profile {
  id: string;
  email: string;
  auth_uid: string | null;
  first_name: string;
  last_name: string;
  user_type: UserType;
  account_id: string | null;
  status: 'pending' | 'active' | 'disabled' | 'invited';
  phone?: string | null;
  mobile?: string | null;
  job_title?: string | null;
  unique_external_id?: string | null;
  social_handle?: string | null;
  social_platform?: string | null;
  address?: string | null;
  timezone?: string | null;
  language?: string | null;
  tags?: string[] | null;
  about?: string | null;
  other_phone?: string | null;
  other_phone_type?: string | null;
  avatar_url?: string | null;
  activated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  account_code: string;
  company_name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'DISABLED';
  country: string | null;
  timezone: string;
  support_plan_id: string | null;
  entitlement_source: 'AIVHUB' | 'MANUAL';
  external_account_id: string | null;
  support_start_date: string | null;
  support_end_date: string | null;
  support_team_id: string | null;
  account_manager_id: string | null;
  support_manager_id: string | null;
  business_calendar_id: string | null;
  customer_ticket_visibility: 'OWN_ONLY' | 'ACCOUNT_WIDE';
  notes_internal: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportPlan {
  id: string;
  code: string;
  name: string;
  active: boolean;
  support_channels: string[];
  business_calendar_id: string | null;
  allow_24x7_p1: boolean;
  max_customer_users: number | null;
  description: string | null;
  internal_notes: string | null;
  sort_order: number;
}

export interface SlaPolicy {
  id: string;
  support_plan_id: string;
  priority: TicketPriority;
  first_response_target_minutes: number;
  resolution_target_minutes: number;
  clock_type: 'business' | 'calendar';
  business_calendar_id: string | null;
  pause_on_customer_wait: boolean;
  pause_on_internal_wait: boolean;
  pause_on_vendor_wait: boolean;
  allow_24x7_override: boolean;
  warning_50: boolean;
  warning_75: boolean;
  warning_90: boolean;
  is_active: boolean;
}

export interface SupportTeam {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface TicketType {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface TicketCategory {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  account_id: string;
  created_by_user_id: string;
  ticket_type_id: string | null;
  category_id: string | null;
  subject: string;
  description: string;
  priority: TicketPriority;
  customer_priority: TicketPriority;
  aiv_priority: TicketPriority;
  impact: string | null;
  urgency: string | null;
  status: TicketStatus;
  environment: string | null;
  aiv_version: string | null;
  assigned_team_id: string | null;
  assigned_agent_id: string | null;
  tags: string[] | null;
  first_human_response_at: string | null;
  first_response_breached: boolean;
  resolved_at: string | null;
  closed_at: string | null;
  resolution_category: string | null;
  root_cause: string | null;
  resolution_summary: string | null;
  resolution_notes: string | null;
  sla_paused: boolean;
  sla_paused_reason: string | null;
  sla_paused_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_user_id: string | null;
  message_type: MessageType;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketSlaSnapshot {
  id: string;
  ticket_id: string;
  support_plan_code: string;
  priority: TicketPriority;
  first_response_target_minutes: number;
  resolution_target_minutes: number;
  clock_type: string;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  created_at: string;
}

export interface TicketStatusHistory {
  id: string;
  ticket_id: string;
  from_status: string | null;
  to_status: TicketStatus;
  changed_by_user_id: string;
  reason: string | null;
  created_at: string;
}

export interface TicketWithRelations extends Ticket {
  accounts?: Pick<Account, 'id' | 'company_name' | 'account_code'>;
  created_by_user?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email'>;
  assigned_agent?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email'>;
  assigned_team?: Pick<SupportTeam, 'id' | 'name'>;
  ticket_types?: Pick<TicketType, 'id' | 'name'>;
  ticket_categories?: Pick<TicketCategory, 'id' | 'name'>;
}


export interface TicketMessageWithAuthor extends TicketMessage {
  author?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email' | 'user_type'>;
}

export interface BusinessCalendar {
  id: string;
  name: string;
  timezone: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessCalendarHour {
  id: string;
  calendar_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface HolidayDate {
  id: string;
  calendar_id: string;
  holiday_date: string;
  name: string;
}
