export type AgentType = 'FULL_TIME' | 'OCCASIONAL';
export type TicketAccessScope = 'GLOBAL' | 'GROUP' | 'ASSIGNED_ONLY';
export type AgentStatus = 'ACTIVE' | 'INACTIVE' | 'AWAY';

export interface TicketPermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  assign: boolean;
  reply_customer: boolean;
  add_internal_note: boolean;
  merge: boolean;
  export: boolean;
}

export interface SolutionPermissions {
  view: boolean;
  create_draft: boolean;
  publish: boolean;
  delete: boolean;
}

export interface CustomerPermissions {
  view: boolean;
  create_edit: boolean;
  delete: boolean;
}

export interface AnalyticsPermissions {
  view_reports: boolean;
  export_reports: boolean;
  manage_dashboards: boolean;
}

export interface AdminPermissions {
  manage_agents: boolean;
  manage_roles: boolean;
  manage_teams: boolean;
  manage_settings: boolean;
}

export interface RolePermissionMatrix {
  tickets: TicketPermissions;
  solutions: SolutionPermissions;
  customers: CustomerPermissions;
  analytics: AnalyticsPermissions;
  admin: AdminPermissions;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  is_system_role: boolean;
  ticket_scope: TicketAccessScope;
  permissions: RolePermissionMatrix;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  agent_type: AgentType;
  ticket_scope: TicketAccessScope;
  role_ids: string[];
  team_ids: string[];
  language: string;
  timezone: string;
  signature: string | null;
  status: AgentStatus;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}
