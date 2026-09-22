import { Role, Agent, RolePermissionMatrix } from '@/types/agentRole';
import { dbClient } from '@/lib/dbClient';

const ROLES_STORAGE_KEY = 'aiv_custom_roles_v1';
const AGENTS_STORAGE_KEY = 'aiv_custom_agents_v1';

export const FULL_PERMISSIONS: RolePermissionMatrix = {
  tickets: {
    view: true,
    create: true,
    edit: true,
    delete: true,
    assign: true,
    reply_customer: true,
    add_internal_note: true,
    merge: true,
    export: true,
  },
  solutions: {
    view: true,
    create_draft: true,
    publish: true,
    delete: true,
  },
  customers: {
    view: true,
    create_edit: true,
    delete: true,
  },
  analytics: {
    view_reports: true,
    export_reports: true,
    manage_dashboards: true,
  },
  admin: {
    manage_agents: true,
    manage_roles: true,
    manage_teams: true,
    manage_settings: true,
  },
};

export const STANDARD_AGENT_PERMISSIONS: RolePermissionMatrix = {
  tickets: {
    view: true,
    create: true,
    edit: true,
    delete: false,
    assign: true,
    reply_customer: true,
    add_internal_note: true,
    merge: true,
    export: false,
  },
  solutions: {
    view: true,
    create_draft: true,
    publish: true,
    delete: false,
  },
  customers: {
    view: true,
    create_edit: false,
    delete: false,
  },
  analytics: {
    view_reports: true,
    export_reports: false,
    manage_dashboards: false,
  },
  admin: {
    manage_agents: false,
    manage_roles: false,
    manage_teams: false,
    manage_settings: false,
  },
};

export const SUPERVISOR_PERMISSIONS: RolePermissionMatrix = {
  tickets: {
    view: true,
    create: true,
    edit: true,
    delete: true,
    assign: true,
    reply_customer: true,
    add_internal_note: true,
    merge: true,
    export: true,
  },
  solutions: {
    view: true,
    create_draft: true,
    publish: true,
    delete: true,
  },
  customers: {
    view: true,
    create_edit: true,
    delete: false,
  },
  analytics: {
    view_reports: true,
    export_reports: true,
    manage_dashboards: true,
  },
  admin: {
    manage_agents: true,
    manage_roles: false,
    manage_teams: true,
    manage_settings: false,
  },
};

export const LIGHT_AGENT_PERMISSIONS: RolePermissionMatrix = {
  tickets: {
    view: true,
    create: false,
    edit: false,
    delete: false,
    assign: false,
    reply_customer: false,
    add_internal_note: true,
    merge: false,
    export: false,
  },
  solutions: {
    view: true,
    create_draft: true,
    publish: false,
    delete: false,
  },
  customers: {
    view: true,
    create_edit: false,
    delete: false,
  },
  analytics: {
    view_reports: false,
    export_reports: false,
    manage_dashboards: false,
  },
  admin: {
    manage_agents: false,
    manage_roles: false,
    manage_teams: false,
    manage_settings: false,
  },
};

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'role-admin',
    name: 'Account Administrator',
    description: 'Full administrative access to all helpdesk settings, user management, billing, and system configurations.',
    is_system_role: true,
    ticket_scope: 'GLOBAL',
    permissions: FULL_PERMISSIONS,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'role-supervisor',
    name: 'Supervisor',
    description: 'Can manage team ticket queues, reassign tickets, review analytics, and manage support agents.',
    is_system_role: true,
    ticket_scope: 'GLOBAL',
    permissions: SUPERVISOR_PERMISSIONS,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'role-agent',
    name: 'Agent',
    description: 'Can respond to customer queries, resolve assigned tickets, add internal notes, and draft KB articles.',
    is_system_role: true,
    ticket_scope: 'GROUP',
    permissions: STANDARD_AGENT_PERMISSIONS,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'role-light-agent',
    name: 'Light Agent',
    description: 'Read-only access to helpdesk tickets with capability to add private internal notes for collaborative support.',
    is_system_role: true,
    ticket_scope: 'ASSIGNED_ONLY',
    permissions: LIGHT_AGENT_PERMISSIONS,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'role-billing',
    name: 'Billing & Account Specialist',
    description: 'Custom role with access to customer account details, subscription plans, and finance-related tickets.',
    is_system_role: false,
    ticket_scope: 'GROUP',
    permissions: {
      ...STANDARD_AGENT_PERMISSIONS,
      customers: { view: true, create_edit: true, delete: false },
    },
    created_at: '2026-02-15T10:30:00.000Z',
    updated_at: '2026-02-15T10:30:00.000Z',
  },
];

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    first_name: 'Sarah',
    last_name: 'Connor',
    email: 'sarah.connor@aivsupport.com',
    phone: '+1 555-0100',
    mobile: '+1 555-0199',
    job_title: 'Senior Support Specialist',
    agent_type: 'FULL_TIME',
    ticket_scope: 'GLOBAL',
    role_ids: ['role-supervisor'],
    team_ids: ['team-1'],
    language: 'English (US)',
    timezone: 'UTC -05:00 Eastern Time',
    signature: '--\nSarah Connor\nSenior Support Specialist | AIV Support',
    status: 'ACTIVE',
    created_at: '2026-01-10T08:00:00.000Z',
    updated_at: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'agent-2',
    first_name: 'Michael',
    last_name: 'Scott',
    email: 'michael.scott@aivsupport.com',
    phone: '+1 555-0211',
    mobile: null,
    job_title: 'Regional Support Lead',
    agent_type: 'FULL_TIME',
    ticket_scope: 'GROUP',
    role_ids: ['role-agent'],
    team_ids: ['team-1', 'team-2'],
    language: 'English (US)',
    timezone: 'UTC -05:00 Eastern Time',
    signature: '--\nMichael Scott\nRegional Lead | AIV Support Team',
    status: 'ACTIVE',
    created_at: '2026-01-15T09:30:00.000Z',
    updated_at: '2026-01-15T09:30:00.000Z',
  },
  {
    id: 'agent-3',
    first_name: 'Pam',
    last_name: 'Beesly',
    email: 'pam.beesly@aivsupport.com',
    phone: '+1 555-0344',
    mobile: null,
    job_title: 'Part-Time Support Desk',
    agent_type: 'OCCASIONAL',
    ticket_scope: 'ASSIGNED_ONLY',
    role_ids: ['role-light-agent'],
    team_ids: ['team-1'],
    language: 'English (US)',
    timezone: 'UTC -05:00 Eastern Time',
    signature: '--\nPam Beesly\nSupport Representative',
    status: 'ACTIVE',
    created_at: '2026-02-01T11:00:00.000Z',
    updated_at: '2026-02-01T11:00:00.000Z',
  },
  {
    id: 'agent-4',
    first_name: 'System',
    last_name: 'Admin',
    email: 'admin@aivsupport.com',
    phone: '+1 555-0101',
    mobile: null,
    job_title: 'Head of Technical Operations',
    agent_type: 'FULL_TIME',
    ticket_scope: 'GLOBAL',
    role_ids: ['role-admin'],
    team_ids: ['team-1', 'team-3'],
    language: 'English (US)',
    timezone: 'UTC +00:00 Universal',
    signature: '--\nSystem Administrator\nAIV Support Portal Admin',
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

// Helper functions for storage

export function getStoredRoles(): Role[] {
  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  // Default fallback pre-seeded roles
  localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(DEFAULT_ROLES));
  return DEFAULT_ROLES;
}

export function saveRole(role: Role): Role[] {
  const current = getStoredRoles();
  const existingIdx = current.findIndex((r) => r.id === role.id);
  let updated: Role[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...role, updated_at: new Date().toISOString() };
  } else {
    updated = [role, ...current];
  }
  localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteRole(roleId: string): Role[] {
  const current = getStoredRoles();
  const updated = current.filter((r) => r.id !== roleId || r.is_system_role);
  localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function getStoredAgents(): Agent[] {
  try {
    const raw = localStorage.getItem(AGENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  // Default fallback pre-seeded agents
  localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(DEFAULT_AGENTS));
  return DEFAULT_AGENTS;
}

export function saveAgent(agent: Agent): Agent[] {
  const current = getStoredAgents();
  const existingIdx = current.findIndex((a) => a.id === agent.id);
  let updated: Agent[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...agent, updated_at: new Date().toISOString() };
  } else {
    updated = [agent, ...current];
  }
  localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(updated));

  // Sync agent to local custom users if needed for ticket assignments
  try {
    const customUsers = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
    const profileItem = {
      id: agent.id,
      email: agent.email,
      first_name: agent.first_name,
      last_name: agent.last_name,
      user_type: 'agent',
      status: agent.status === 'ACTIVE' ? 'active' : 'disabled',
      phone: agent.phone,
      mobile: agent.mobile,
      job_title: agent.job_title,
      created_at: agent.created_at,
      updated_at: new Date().toISOString(),
    };
    const userIdx = customUsers.findIndex((u: any) => u.id === agent.id);
    if (userIdx >= 0) {
      customUsers[userIdx] = { ...customUsers[userIdx], ...profileItem };
    } else {
      customUsers.unshift(profileItem);
    }
    localStorage.setItem('local_custom_users', JSON.stringify(customUsers));
  } catch (e) {}

  return updated;
}

export function deleteAgent(agentId: string): Agent[] {
  const current = getStoredAgents();
  const updated = current.filter((a) => a.id !== agentId);
  localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
