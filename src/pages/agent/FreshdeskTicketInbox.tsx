import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Badges';
import { formatRelativeTime, fullName, STATUS_LABELS } from '@/lib/constants';
import type { TicketWithRelations, TicketSlaSnapshot, TicketPriority, TicketStatus, Profile, SupportTeam, TicketType } from '@/types';
import {
  Star, Plus, Search, Filter, ChevronLeft, ChevronRight, Download,
  LayoutGrid, List, Mail, Clock, CheckSquare, Square, AlertCircle,
  X, Trash2, SlidersHorizontal, Check, RefreshCw, ChevronDown, Smile, Frown, Meh, Tag, Building2, User
} from 'lucide-react';

type LayoutMode = 'card' | 'inbox' | 'table';

type SortOption = 'created_at' | 'priority' | 'updated_at' | 'sla_due';

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; bgColor: string; dotColor: string }> = {
  P4: { label: 'Low', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200 text-emerald-700', dotColor: 'bg-emerald-500' },
  P3: { label: 'Medium', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200 text-blue-700', dotColor: 'bg-blue-500' },
  P2: { label: 'High', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200 text-amber-700', dotColor: 'bg-amber-500' },
  P1: { label: 'Urgent', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200 text-red-700', dotColor: 'bg-red-500' },
};

const DEMO_AGENTS: Profile[] = [
  { id: '33333333-3333-3333-3333-333333333333', email: 'agent1@aivsupport.com', auth_uid: null, first_name: 'Sarah', last_name: 'Connor', user_type: 'agent', account_id: null, status: 'active', phone: null, mobile: null, job_title: 'Senior Specialist', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444444', email: 'agent2@aivsupport.com', auth_uid: null, first_name: 'Alex', last_name: 'Murphy', user_type: 'agent', account_id: null, status: 'active', phone: null, mobile: null, job_title: 'Support Engineer', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '22222222-2222-2222-2222-222222222222', email: 'manager@aivsupport.com', auth_uid: null, first_name: 'Support', last_name: 'Manager', user_type: 'manager', account_id: null, status: 'active', phone: null, mobile: null, job_title: 'Support Ops Lead', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-1111-1111-1111-111111111111', email: 'admin@aivsupport.com', auth_uid: null, first_name: 'System', last_name: 'Admin', user_type: 'admin', account_id: null, status: 'active', phone: null, mobile: null, job_title: 'System Admin', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const DEMO_TEAMS: SupportTeam[] = [
  { id: 'team-1', name: 'Tier 1 Support', description: 'First line triage', is_active: true },
  { id: 'team-2', name: 'Tier 2 Engineering', description: 'Deep technical support', is_active: true },
  { id: 'team-3', name: 'Account Management', description: 'Customer success', is_active: true },
];

const DEMO_TYPES: TicketType[] = [
  { id: 'type-1', name: 'Incident', is_active: true, sort_order: 1 },
  { id: 'type-2', name: 'Service Request', is_active: true, sort_order: 2 },
  { id: 'type-3', name: 'Question', is_active: true, sort_order: 3 },
  { id: 'type-4', name: 'Change Request', is_active: true, sort_order: 4 },
];

const INITIAL_DEMO_TICKETS: TicketWithRelations[] = [
  {
    id: 't-1',
    ticket_number: 'AIV-000001',
    account_id: 'acc-1',
    created_by_user_id: 'user-1',
    ticket_type_id: 'type-1',
    category_id: 'cat-1',
    subject: 'Application crashes when importing large CSV files (>50MB)',
    description: 'When attempting to import CSV files larger than 50MB, the application crashes with out of memory error.',
    priority: 'P2',
    customer_priority: 'P2',
    aiv_priority: 'P2',
    impact: 'multiple_users',
    urgency: 'high',
    status: 'IN_PROGRESS',
    environment: 'Production',
    aiv_version: 'v4.2.1',
    assigned_team_id: 'team-1',
    assigned_agent_id: '33333333-3333-3333-3333-333333333333',
    tags: ['csv', 'crash', 'performance'],
    first_human_response_at: new Date(Date.now() - 3600000).toISOString(),
    first_response_breached: false,
    resolved_at: null,
    closed_at: null,
    resolution_category: null,
    root_cause: null,
    resolution_summary: null,
    resolution_notes: null,
    sla_paused: false,
    sla_paused_reason: null,
    sla_paused_at: null,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    accounts: { id: 'acc-1', company_name: 'Acme Corp', account_code: 'ACME001' },
    created_by_user: { id: 'user-1', first_name: 'John', last_name: 'Smith', email: 'john.smith@acme.com' },
    assigned_agent: { id: '33333333-3333-3333-3333-333333333333', first_name: 'Sarah', last_name: 'Connor', email: 'agent1@aivsupport.com' },
    assigned_team: { id: 'team-1', name: 'Tier 1 Support' },
    ticket_types: { id: 'type-1', name: 'Incident' },
  },
  {
    id: 't-2',
    ticket_number: 'AIV-000002',
    account_id: 'acc-1',
    created_by_user_id: 'user-2',
    ticket_type_id: 'type-2',
    category_id: 'cat-2',
    subject: 'Request: Additional user licenses for new team onboarding',
    description: 'We have 5 new team members starting next week and need user accounts provisioned for them.',
    priority: 'P3',
    customer_priority: 'P3',
    aiv_priority: 'P3',
    impact: 'single_user',
    urgency: 'minor',
    status: 'NEW',
    environment: 'Production',
    aiv_version: 'v4.2.1',
    assigned_team_id: 'team-1',
    assigned_agent_id: null,
    tags: ['onboarding', 'licensing'],
    first_human_response_at: null,
    first_response_breached: false,
    resolved_at: null,
    closed_at: null,
    resolution_category: null,
    root_cause: null,
    resolution_summary: null,
    resolution_notes: null,
    sla_paused: false,
    sla_paused_reason: null,
    sla_paused_at: null,
    created_at: new Date(Date.now() - 14400000).toISOString(),
    updated_at: new Date(Date.now() - 14400000).toISOString(),
    accounts: { id: 'acc-1', company_name: 'Acme Corp', account_code: 'ACME001' },
    created_by_user: { id: 'user-2', first_name: 'Bob', last_name: 'Jones', email: 'bob@acme.com' },
    assigned_agent: undefined,
    assigned_team: { id: 'team-1', name: 'Tier 1 Support' },
    ticket_types: { id: 'type-2', name: 'Service Request' },
  },
  {
    id: 't-3',
    ticket_number: 'AIV-000003',
    account_id: 'acc-2',
    created_by_user_id: 'user-3',
    ticket_type_id: 'type-1',
    category_id: 'cat-1',
    subject: 'CRITICAL: Production API endpoint returning 500 internal errors',
    description: 'Our entire production system is unable to process orders due to 500 error on /api/v2/orders.',
    priority: 'P1',
    customer_priority: 'P1',
    aiv_priority: 'P1',
    impact: 'entire_organisation',
    urgency: 'critical',
    status: 'OPEN',
    environment: 'Production',
    aiv_version: 'v4.1.0',
    assigned_team_id: 'team-2',
    assigned_agent_id: '44444444-4444-4444-4444-444444444444',
    tags: ['critical', 'api', 'outage'],
    first_human_response_at: new Date(Date.now() - 7200000).toISOString(),
    first_response_breached: true,
    resolved_at: null,
    closed_at: null,
    resolution_category: null,
    root_cause: null,
    resolution_summary: null,
    resolution_notes: null,
    sla_paused: false,
    sla_paused_reason: null,
    sla_paused_at: null,
    created_at: new Date(Date.now() - 10800000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    accounts: { id: 'acc-2', company_name: 'Globex Inc', account_code: 'GLOB001' },
    created_by_user: { id: 'user-3', first_name: 'Alice', last_name: 'Johnson', email: 'alice@globex.com' },
    assigned_agent: { id: '44444444-4444-4444-4444-444444444444', first_name: 'Alex', last_name: 'Murphy', email: 'agent2@aivsupport.com' },
    assigned_team: { id: 'team-2', name: 'Tier 2 Engineering' },
    ticket_types: { id: 'type-1', name: 'Incident' },
  },
  {
    id: 't-4',
    ticket_number: 'AIV-000004',
    account_id: 'acc-3',
    created_by_user_id: 'user-4',
    ticket_type_id: 'type-3',
    category_id: 'cat-3',
    subject: 'Question: How to configure Azure AD SSO integration?',
    description: 'We want to set up single sign-on with Azure AD for our team. Need documentation.',
    priority: 'P4',
    customer_priority: 'P4',
    aiv_priority: 'P4',
    impact: 'minor',
    urgency: 'minor',
    status: 'WAITING_FOR_CUSTOMER',
    environment: 'Production',
    aiv_version: 'v4.2.1',
    assigned_team_id: 'team-3',
    assigned_agent_id: '22222222-2222-2222-2222-222222222222',
    tags: ['sso', 'azure', 'docs'],
    first_human_response_at: new Date(Date.now() - 86400000).toISOString(),
    first_response_breached: false,
    resolved_at: null,
    closed_at: null,
    resolution_category: null,
    root_cause: null,
    resolution_summary: null,
    resolution_notes: null,
    sla_paused: true,
    sla_paused_reason: 'Waiting for customer details',
    sla_paused_at: new Date(Date.now() - 43200000).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 43200000).toISOString(),
    accounts: { id: 'acc-3', company_name: 'Initech', account_code: 'INIT001' },
    created_by_user: { id: 'user-4', first_name: 'Peter', last_name: 'Gibbons', email: 'peter@initech.com' },
    assigned_agent: { id: '22222222-2222-2222-2222-222222222222', first_name: 'Support', last_name: 'Manager', email: 'manager@aivsupport.com' },
    assigned_team: { id: 'team-3', name: 'Account Management' },
    ticket_types: { id: 'type-3', name: 'Question' },
  },
];

const INITIAL_SLA_SNAPSHOTS: Record<string, TicketSlaSnapshot> = {
  't-1': { id: 's-1', ticket_id: 't-1', support_plan_code: 'PREMIUM', priority: 'P2', first_response_target_minutes: 180, resolution_target_minutes: 1440, clock_type: 'business', first_response_due_at: new Date(Date.now() + 3600000 * 4).toISOString(), resolution_due_at: new Date(Date.now() + 3600000 * 20).toISOString(), created_at: new Date().toISOString() },
  't-2': { id: 's-2', ticket_id: 't-2', support_plan_code: 'STANDARD', priority: 'P3', first_response_target_minutes: 720, resolution_target_minutes: 5760, clock_type: 'business', first_response_due_at: new Date(Date.now() + 3600000 * 2).toISOString(), resolution_due_at: new Date(Date.now() + 3600000 * 48).toISOString(), created_at: new Date().toISOString() },
  't-3': { id: 's-3', ticket_id: 't-3', support_plan_code: 'ENTERPRISE', priority: 'P1', first_response_target_minutes: 15, resolution_target_minutes: 240, clock_type: 'calendar', first_response_due_at: new Date(Date.now() - 3600000 * 2).toISOString(), resolution_due_at: new Date(Date.now() + 3600000 * 1).toISOString(), created_at: new Date().toISOString() },
  't-4': { id: 's-4', ticket_id: 't-4', support_plan_code: 'STANDARD', priority: 'P4', first_response_target_minutes: 1440, resolution_target_minutes: 11520, clock_type: 'business', first_response_due_at: new Date(Date.now() + 3600000 * 12).toISOString(), resolution_due_at: new Date(Date.now() + 3600000 * 96).toISOString(), created_at: new Date().toISOString() },
};

export function FreshdeskTicketInbox() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Primary State
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [slaSnapshots, setSlaSnapshots] = useState<Record<string, TicketSlaSnapshot>>({});
  const [agents, setAgents] = useState<Profile[]>(DEMO_AGENTS);
  const [teams, setTeams] = useState<SupportTeam[]>(DEMO_TEAMS);
  const [types, setTypes] = useState<TicketType[]>(DEMO_TYPES);
  const [loading, setLoading] = useState(true);
  const [starredOnly, setStarredOnly] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set(['t-1', 't-3']));
  const [showAppliedModal, setShowAppliedModal] = useState(false);

  // Layout & Toolbar State
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('card');
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [activeInboxTicketId, setActiveInboxTicketId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showFilters, setShowFilters] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<SortOption>('created_at');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldSearch, setFieldSearch] = useState('');

  // ALL FRESHDESK SIDEBAR FILTERS STATE
  const [filterAgent, setFilterAgent] = useState('any');
  const [filterGroup, setFilterGroup] = useState('any');
  const [filterSentiment, setFilterSentiment] = useState('any');
  const [filterCreated, setFilterCreated] = useState('30days');
  const [filterClosedAt, setFilterClosedAt] = useState('any');
  const [filterResolvedAt, setFilterResolvedAt] = useState('any');
  const [filterResolutionDue, setFilterResolutionDue] = useState('any');
  const [filterFirstResponseDue, setFilterFirstResponseDue] = useState('any');
  const [filterNextResponseDue, setFilterNextResponseDue] = useState('any');
  const [filterSkills, setFilterSkills] = useState('any');
  const [filterStatus, setFilterStatus] = useState('any');
  const [filterPriority, setFilterPriority] = useState('any');
  const [filterType, setFilterType] = useState('any');
  const [filterSource, setFilterSource] = useState('any');
  const [filterSourceInfo, setFilterSourceInfo] = useState('any');
  const [filterTags, setFilterTags] = useState('any');
  const [filterCompany, setFilterCompany] = useState('any');
  const [filterContact, setFilterContact] = useState('any');
  const [filterProduct, setFilterProduct] = useState('any');

  // Live timer interval for SLA countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Metadata & Tickets
  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [agentsRes, teamsRes, typesRes, ticketRes] = await Promise.all([
        supabase.from('profiles').select('*').in('user_type', ['agent', 'manager', 'account_manager', 'admin']).order('first_name'),
        supabase.from('support_teams').select('*').eq('is_active', true).order('name'),
        supabase.from('ticket_types').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('tickets').select(`
          *,
          accounts(id, company_name, account_code),
          created_by_user:profiles!tickets_created_by_user_id_fkey(id, first_name, last_name, email),
          assigned_agent:profiles!tickets_assigned_agent_id_fkey(id, first_name, last_name, email),
          assigned_team:support_teams(id, name),
          ticket_types(id, name),
          ticket_categories(id, name)
        `).order('created_at', { ascending: false }),
      ]);

      if (agentsRes.data && agentsRes.data.length > 0) setAgents(agentsRes.data as Profile[]);
      if (teamsRes.data && teamsRes.data.length > 0) setTeams(teamsRes.data as SupportTeam[]);
      if (typesRes.data && typesRes.data.length > 0) setTypes(typesRes.data as TicketType[]);

      let customTickets: TicketWithRelations[] = [];
      try {
        customTickets = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
      } catch (e) {}

      let deletedIds: string[] = [];
      try {
        deletedIds = JSON.parse(localStorage.getItem('deleted_ticket_ids') || '[]');
      } catch (e) {}

      let rawTickets: TicketWithRelations[] = [];
      if (ticketRes.data && ticketRes.data.length > 0) {
        rawTickets = [...customTickets, ...(ticketRes.data as unknown as TicketWithRelations[])];

        const ids = ticketRes.data.map((t) => t.id);
        const { data: slaData } = await supabase
          .from('ticket_sla_snapshots')
          .select('*')
          .in('ticket_id', ids)
          .order('created_at', { ascending: false });

        if (slaData && slaData.length > 0) {
          const map: Record<string, TicketSlaSnapshot> = {};
          slaData.forEach((s) => { if (!map[s.ticket_id]) map[s.ticket_id] = s as TicketSlaSnapshot; });
          setSlaSnapshots(map);
        } else {
          setSlaSnapshots(INITIAL_SLA_SNAPSHOTS);
        }
      } else {
        rawTickets = [...customTickets, ...INITIAL_DEMO_TICKETS];
        setSlaSnapshots(INITIAL_SLA_SNAPSHOTS);
      }

      // Exclude any tickets that were deleted
      const activeTickets = rawTickets.filter((t) => !deletedIds.includes(t.id));
      setTickets(activeTickets);
    } catch (e) {
      let customTickets: TicketWithRelations[] = [];
      let deletedIds: string[] = [];
      try { customTickets = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]'); } catch (err) {}
      try { deletedIds = JSON.parse(localStorage.getItem('deleted_ticket_ids') || '[]'); } catch (err) {}

      const rawTickets = [...customTickets, ...INITIAL_DEMO_TICKETS];
      setTickets(rawTickets.filter((t) => !deletedIds.includes(t.id)));
      setSlaSnapshots(INITIAL_SLA_SNAPSHOTS);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Inline Triage Changes (Optimistic Update)
  const handleUpdateTicket = async (ticketId: string, updates: Partial<TicketWithRelations>) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        let newAgent = t.assigned_agent;
        if (updates.assigned_agent_id !== undefined) {
          const found = agents.find((a) => a.id === updates.assigned_agent_id);
          newAgent = found
            ? { id: found.id, first_name: found.first_name, last_name: found.last_name, email: found.email }
            : undefined;
        }
        return {
          ...t,
          ...updates,
          assigned_agent: newAgent,
          updated_at: new Date().toISOString(),
        };
      })
    );

    try {
      await supabase.from('tickets').update({
        ...updates,
        updated_at: new Date().toISOString(),
      }).eq('id', ticketId);
    } catch (e) {}
  };

  // Toggle Favorite/Star
  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk Selection Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedTickets.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk Actions
  const handleBulkAssign = async (agentId: string | null) => {
    const ids = Array.from(selectedIds);
    const targetAgent = agents.find((a) => a.id === agentId);
    setTickets((prev) =>
      prev.map((t) => (ids.includes(t.id) ? {
        ...t,
        assigned_agent_id: agentId,
        assigned_agent: targetAgent ? { id: targetAgent.id, first_name: targetAgent.first_name, last_name: targetAgent.last_name, email: targetAgent.email } : undefined,
        updated_at: new Date().toISOString()
      } : t))
    );
    setSelectedIds(new Set());


    try {
      await supabase.from('tickets').update({ assigned_agent_id: agentId, updated_at: new Date().toISOString() }).in('id', ids);
    } catch (e) {}
  };

  const handleBulkStatusChange = async (status: TicketStatus) => {
    const ids = Array.from(selectedIds);
    setTickets((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, status, updated_at: new Date().toISOString() } : t))
    );
    setSelectedIds(new Set());

    try {
      await supabase.from('tickets').update({ status, updated_at: new Date().toISOString() }).in('id', ids);
    } catch (e) {}
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${ids.length} ticket(s)?`)) return;

    // Remove from active state immediately
    setTickets((prev) => prev.filter((t) => !ids.includes(t.id)));
    setSelectedIds(new Set());
    setStarredIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

    // Save deleted IDs in localStorage so they never re-appear on page refresh
    try {
      const existingDeleted: string[] = JSON.parse(localStorage.getItem('deleted_ticket_ids') || '[]');
      const updatedDeleted = Array.from(new Set([...existingDeleted, ...ids]));
      localStorage.setItem('deleted_ticket_ids', JSON.stringify(updatedDeleted));
    } catch (e) {}

    // Clean local_custom_tickets
    try {
      const custom: TicketWithRelations[] = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
      const updatedCustom = custom.filter((t) => !ids.includes(t.id));
      localStorage.setItem('local_custom_tickets', JSON.stringify(updatedCustom));
    } catch (e) {}

    try {
      await supabase.from('tickets').delete().in('id', ids);
    } catch (e) {}
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Ticket Number', 'Subject', 'Requester', 'Company', 'Status', 'Priority', 'Agent', 'Created At'];
    const rows = filteredTickets.map((t) => [
      t.ticket_number,
      `"${t.subject.replace(/"/g, '""')}"`,
      t.created_by_user ? fullName(t.created_by_user.first_name, t.created_by_user.last_name) : 'Customer',
      t.accounts?.company_name || 'N/A',
      t.status,
      t.priority,
      t.assigned_agent ? fullName(t.assigned_agent.first_name, t.assigned_agent.last_name) : 'Unassigned',
      new Date(t.created_at).toLocaleString(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tickets_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Active Applied Filters Count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterAgent !== 'any') count++;
    if (filterGroup !== 'any') count++;
    if (filterSentiment !== 'any') count++;
    if (filterCreated !== 'any') count++;
    if (filterClosedAt !== 'any') count++;
    if (filterResolvedAt !== 'any') count++;
    if (filterResolutionDue !== 'any') count++;
    if (filterFirstResponseDue !== 'any') count++;
    if (filterNextResponseDue !== 'any') count++;
    if (filterSkills !== 'any') count++;
    if (filterStatus !== 'any') count++;
    if (filterPriority !== 'any') count++;
    if (filterType !== 'any') count++;
    if (filterSource !== 'any') count++;
    if (filterSourceInfo !== 'any') count++;
    if (filterTags !== 'any') count++;
    if (filterCompany !== 'any') count++;
    if (filterContact !== 'any') count++;
    if (filterProduct !== 'any') count++;
    if (starredOnly) count++;
    return count;
  }, [filterAgent, filterGroup, filterSentiment, filterCreated, filterClosedAt, filterResolvedAt, filterResolutionDue, filterFirstResponseDue, filterNextResponseDue, filterSkills, filterStatus, filterPriority, filterType, filterSource, filterSourceInfo, filterTags, filterCompany, filterContact, filterProduct, starredOnly]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setFieldSearch('');
    setFilterAgent('any');
    setFilterGroup('any');
    setFilterSentiment('any');
    setFilterCreated('any');
    setFilterClosedAt('any');
    setFilterResolvedAt('any');
    setFilterResolutionDue('any');
    setFilterFirstResponseDue('any');
    setFilterNextResponseDue('any');
    setFilterSkills('any');
    setFilterStatus('any');
    setFilterPriority('any');
    setFilterType('any');
    setFilterSource('any');
    setFilterSourceInfo('any');
    setFilterTags('any');
    setFilterCompany('any');
    setFilterContact('any');
    setFilterProduct('any');
    setStarredOnly(false);
  };

  // Filter Computation
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Starred filter
      if (starredOnly && !starredIds.has(t.id)) return false;

      // General Text Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSubject = t.subject.toLowerCase().includes(q);
        const matchesNum = t.ticket_number.toLowerCase().includes(q);
        const matchesCompany = t.accounts?.company_name?.toLowerCase().includes(q);
        const matchesRequester = t.created_by_user && `${t.created_by_user.first_name} ${t.created_by_user.last_name}`.toLowerCase().includes(q);
        if (!matchesSubject && !matchesNum && !matchesCompany && !matchesRequester) return false;
      }

      // Agent Filter
      if (filterAgent !== 'any' && t.assigned_agent_id !== filterAgent) return false;

      // Group Filter
      if (filterGroup !== 'any' && t.assigned_team_id !== filterGroup) return false;

      // Status Filter
      if (filterStatus !== 'any' && t.status !== filterStatus) return false;

      // Priority Filter
      if (filterPriority !== 'any' && t.priority !== filterPriority) return false;

      // Type Filter
      if (filterType !== 'any' && t.ticket_type_id !== filterType) return false;

      // Company Filter
      if (filterCompany !== 'any' && t.account_id !== filterCompany) return false;

      // Date Created Filter
      if (filterCreated !== 'any') {
        const ticketDate = new Date(t.created_at).getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        if (filterCreated === 'today' && now - ticketDate > oneDay) return false;
        if (filterCreated === '7days' && now - ticketDate > 7 * oneDay) return false;
        if (filterCreated === '30days' && now - ticketDate > 30 * oneDay) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'updated_at') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortBy === 'priority') {
        const map: Record<TicketPriority, number> = { P1: 4, P2: 3, P3: 2, P4: 1 };
        return map[b.priority] - map[a.priority];
      }
      if (sortBy === 'sla_due') {
        const slaA = slaSnapshots[a.id]?.resolution_due_at || '9999';
        const slaB = slaSnapshots[b.id]?.resolution_due_at || '9999';
        return slaA.localeCompare(slaB);
      }
      return 0;
    });
  }, [tickets, searchQuery, filterAgent, filterGroup, filterStatus, filterPriority, filterType, filterCompany, filterCreated, sortBy, starredOnly, starredIds, slaSnapshots, now]);

  // Pagination Computation
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTickets.slice(start, start + itemsPerPage);
  }, [filteredTickets, currentPage]);

  const isAllPageSelected = paginatedTickets.length > 0 && paginatedTickets.every((t) => selectedIds.has(t.id));

  // SLA Calculation Helper
  const renderSlaInfo = (ticket: TicketWithRelations) => {
    const sla = slaSnapshots[ticket.id];
    if (!sla) {
      return <span className="text-gray-400 text-xs">—</span>;
    }

    const dueTimeStr = sla.first_response_due_at || sla.resolution_due_at;
    if (!dueTimeStr) return <span className="text-gray-400 text-xs">—</span>;

    const dueTime = new Date(dueTimeStr).getTime();
    const isBreached = ticket.first_response_breached || dueTime < now;
    const diffMs = Math.abs(dueTime - now);
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const timeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const label = !ticket.first_human_response_at
      ? isBreached
        ? `First response overdue by ${timeFormatted}`
        : `First response due in ${timeFormatted}`
      : isBreached
        ? `Resolution overdue by ${timeFormatted}`
        : `Resolution due in ${timeFormatted}`;

    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${isBreached ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
        <Clock className={`w-3.5 h-3.5 ${isBreached ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
        {label}
      </span>
    );
  };

  // Helper to filter sidebar field groups when user types in "Search fields"
  const matchesFieldSearch = (label: string) => {
    if (!fieldSearch) return true;
    return label.toLowerCase().includes(fieldSearch.toLowerCase().trim());
  };

  // Count only saved tickets that actually exist and are not deleted
  const activeStarredCount = useMemo(() => {
    return tickets.filter((t) => starredIds.has(t.id)).length;
  }, [tickets, starredIds]);

  return (
    <div className="space-y-4">
      {/* 1. TOP HEADER BAR */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Title & Saved Star Badge */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">All tickets</h1>

          {/* Starred / Saved Button */}
          <button
            onClick={() => setStarredOnly(!starredOnly)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              starredOnly
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
            }`}
            title="Toggle saved tickets"
          >
            <Star className={`w-3.5 h-3.5 ${starredOnly ? 'fill-white' : 'fill-amber-400 text-amber-500'}`} />
            <span>{activeStarredCount} saved</span>
          </button>
        </div>

        {/* Live Search & Action Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Dynamic Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject, requester, ticket #..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Refresh button */}
          <button onClick={loadData} className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors" title="Refresh list">
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Create New Ticket Button */}
          <button
            onClick={() => navigate('/agent/tickets/new')}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 flex-shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {/* 2. TOOLBAR ROW */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-700 shadow-2xs">
        {/* Left Toolbar Controls */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-gray-700">
            <button
              onClick={() => handleSelectAll(!isAllPageSelected)}
              className="text-gray-400 hover:text-blue-600 focus:outline-none"
            >
              {isAllPageSelected ? (
                <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
              ) : (
                <Square className="w-4.5 h-4.5" />
              )}
            </button>
            <span>Select All</span>
          </label>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-gray-50 border border-gray-300 text-gray-800 text-xs rounded-md px-2.5 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="created_at">Date created</option>
              <option value="priority">Priority</option>
              <option value="updated_at">Last updated</option>
              <option value="sla_due">SLA due</option>
            </select>
          </div>
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex items-center gap-3">
          {/* Freshdesk Layout Dropdown Menu */}
          <div className="relative">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-medium">Layout:</span>
              <button
                onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
                className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-semibold text-gray-800 shadow-2xs transition-colors"
              >
                <span className="capitalize">{layoutMode}</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>

            {showLayoutDropdown && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowLayoutDropdown(false)} />
                <div className="absolute right-0 mt-1.5 w-36 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-30 text-xs animate-in fade-in-50 zoom-in-95 duration-100">
                  <button
                    onClick={() => { setLayoutMode('card'); setShowLayoutDropdown(false); }}
                    className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-blue-50/70 text-gray-800 font-medium text-left"
                  >
                    <span className={layoutMode === 'card' ? 'text-blue-600 font-bold' : ''}>Card</span>
                    {layoutMode === 'card' && <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />}
                  </button>

                  <button
                    onClick={() => { setLayoutMode('inbox'); setShowLayoutDropdown(false); }}
                    className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-blue-50/70 text-gray-800 font-medium text-left"
                  >
                    <span className={layoutMode === 'inbox' ? 'text-blue-600 font-bold' : ''}>Inbox</span>
                    {layoutMode === 'inbox' && <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />}
                  </button>

                  <button
                    onClick={() => { setLayoutMode('table'); setShowLayoutDropdown(false); }}
                    className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-blue-50/70 text-gray-800 font-medium text-left"
                  >
                    <span className={layoutMode === 'table' ? 'text-blue-600 font-bold' : ''}>Table</span>
                    {layoutMode === 'table' && <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />}
                  </button>
                </div>
              </>
            )}
          </div>


          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-semibold text-gray-700 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export</span>
          </button>

          {/* Pagination Indicator */}
          <div className="flex items-center gap-1.5 text-gray-600 border-l border-gray-200 pl-3">
            <span className="font-medium">
              {filteredTickets.length === 0
                ? '0–0 of 0'
                : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredTickets.length)} of ${filteredTickets.length}`}
            </span>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Filters Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors border ${
              showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters ({activeFilterCount})</span>
          </button>
        </div>
      </div>

      {/* FLOATING BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white px-5 py-2.5 rounded-xl flex items-center justify-between shadow-lg border border-slate-800 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-blue-600 text-white px-2.5 py-0.5 rounded-full">
              {selectedIds.size} selected
            </span>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-white underline">
              Deselect all
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Assign agent */}
            <select
              onChange={(e) => handleBulkAssign(e.target.value || null)}
              defaultValue=""
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="" disabled>Assign to agent...</option>
              <option value="">Unassign</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{fullName(a.first_name, a.last_name)}</option>
              ))}
            </select>

            {/* Change Status */}
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as TicketStatus)}
              defaultValue=""
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="" disabled>Change status...</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* Delete */}
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-bold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* SHOW APPLIED FILTERS MODAL */}
      {showAppliedModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAppliedModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-gray-900">Applied Filters ({activeFilterCount})</h3>
              <button onClick={() => setShowAppliedModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-2 text-xs">
              {filterAgent !== 'any' && (
                <div className="flex justify-between bg-gray-50 p-2 rounded border"><span>Agent:</span><span className="font-semibold">{agents.find(a => a.id === filterAgent)?.first_name || filterAgent}</span></div>
              )}
              {filterGroup !== 'any' && (
                <div className="flex justify-between bg-gray-50 p-2 rounded border"><span>Group:</span><span className="font-semibold">{teams.find(t => t.id === filterGroup)?.name || filterGroup}</span></div>
              )}
              {filterStatus !== 'any' && (
                <div className="flex justify-between bg-gray-50 p-2 rounded border"><span>Status:</span><span className="font-semibold">{filterStatus}</span></div>
              )}
              {filterPriority !== 'any' && (
                <div className="flex justify-between bg-gray-50 p-2 rounded border"><span>Priority:</span><span className="font-semibold">{filterPriority}</span></div>
              )}
              {filterCreated !== 'any' && (
                <div className="flex justify-between bg-gray-50 p-2 rounded border"><span>Created:</span><span className="font-semibold">{filterCreated}</span></div>
              )}
              {activeFilterCount === 0 && <p className="text-gray-500">No active filters applied.</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={clearAllFilters} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-semibold">Clear All</button>
              <button onClick={() => setShowAppliedModal(false)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA: TICKET LIST + EXACT FRESHDESK SIDEBAR */}
      <div className="flex flex-col lg:flex-row items-start gap-5">
        {/* TICKET LIST CONTAINER */}
        <div className="flex-1 w-full min-w-0">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse flex gap-4 items-center">
                  <div className="w-4 h-4 bg-gray-200 rounded" />
                  <div className="w-9 h-9 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                  <div className="w-24 h-8 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">No tickets match your filters</h3>
              <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
                {activeFilterCount > 0
                  ? `There are ${activeFilterCount} active filters restricting this view.`
                  : 'No tickets were found in the queue.'}
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : layoutMode === 'card' ? (
            /* FRESHDESK EXACT CARD LAYOUT VIEW */
            <div className="space-y-3">
              {paginatedTickets.map((t) => {
                const isSelected = selectedIds.has(t.id);
                const isStarred = starredIds.has(t.id);
                const isNew = !t.first_human_response_at;
                const requesterName = t.created_by_user
                  ? fullName(t.created_by_user.first_name, t.created_by_user.last_name)
                  : 'Customer';
                const requesterInitials = t.created_by_user
                  ? `${t.created_by_user.first_name[0] || ''}${t.created_by_user.last_name[0] || ''}`.toUpperCase()
                  : 'C';

                return (
                  <div
                    key={t.id}
                    onClick={() => navigate(`/agent/tickets/${t.id}`)}
                    className={`bg-white border rounded-xl p-4 transition-all duration-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:shadow-md hover:border-gray-300 ${
                      isSelected ? 'border-blue-500 bg-blue-50/20' : 'border-gray-200'
                    }`}
                  >
                    {/* Left Details */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Checkbox & Star */}
                      <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleToggleSelect(t.id, e)}
                          className="text-gray-400 hover:text-blue-600 focus:outline-none"
                        >
                          {isSelected ? <CheckSquare className="w-4.5 h-4.5 text-blue-600" /> : <Square className="w-4.5 h-4.5" />}
                        </button>
                        <button
                          onClick={(e) => toggleStar(t.id, e)}
                          className="text-gray-300 hover:text-amber-400 focus:outline-none"
                          title="Star ticket"
                        >
                          <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>
                      </div>

                      {/* Requester Avatar */}
                      <div className="w-9 h-9 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {requesterInitials}
                      </div>

                      {/* Info & Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isNew && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold tracking-wide uppercase">
                              New
                            </span>
                          )}
                          <h2 className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors truncate">
                            {t.subject}
                          </h2>
                          <span className="text-xs font-mono text-gray-400 font-medium">
                            #{t.ticket_number}
                          </span>
                        </div>

                        {/* Metadata line */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            {requesterName} {t.accounts?.company_name ? `(${t.accounts.company_name})` : ''}
                          </span>

                          <span className="text-gray-300">•</span>

                          <span>
                            {t.first_human_response_at
                              ? `Agent responded ${formatRelativeTime(t.first_human_response_at)}`
                              : `Created ${formatRelativeTime(t.created_at)}`}
                          </span>

                          <span className="text-gray-300">•</span>

                          {renderSlaInfo(t)}
                        </div>
                      </div>
                    </div>

                    {/* Right Inline Triage Dropdowns */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 flex-shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto justify-end"
                    >
                      {/* Priority Dropdown */}
                      <div className="relative">
                        <span className={`w-2 h-2 rounded-full absolute left-2.5 top-1/2 -translate-y-1/2 ${PRIORITY_CONFIG[t.priority]?.dotColor || 'bg-gray-400'}`} />
                        <select
                          value={t.priority}
                          onChange={(e) => handleUpdateTicket(t.id, { priority: e.target.value as TicketPriority })}
                          className={`text-xs font-bold rounded-lg pl-6 pr-6 py-1.5 border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${PRIORITY_CONFIG[t.priority]?.bgColor || 'bg-gray-100'}`}
                        >
                          <option value="P4">Low</option>
                          <option value="P3">Medium</option>
                          <option value="P2">High</option>
                          <option value="P1">Urgent</option>
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current text-[10px]">▼</span>
                      </div>

                      {/* Assignee Dropdown */}
                      <div className="relative">
                        <select
                          value={t.assigned_agent_id || ''}
                          onChange={(e) => handleUpdateTicket(t.id, { assigned_agent_id: e.target.value || null })}
                          className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 appearance-none pr-6 cursor-pointer hover:bg-gray-100 focus:outline-none"
                        >
                          <option value="">-- / Unassigned</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {fullName(a.first_name, a.last_name)}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▼</span>
                      </div>

                      {/* Status Dropdown */}
                      <div className="relative">
                        <select
                          value={t.status}
                          onChange={(e) => handleUpdateTicket(t.id, { status: e.target.value as TicketStatus })}
                          className="bg-white border border-gray-300 text-gray-800 text-xs font-bold rounded-lg px-2.5 py-1.5 appearance-none pr-6 cursor-pointer hover:bg-gray-50 focus:outline-none"
                        >
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▼</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : layoutMode === 'inbox' ? (
            /* FRESHDESK INBOX SPLIT LAYOUT VIEW */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
              {/* Left Column: Inbox List */}
              <div className="space-y-2 border-r border-gray-100 pr-2">
                <p className="text-xs font-bold text-gray-500 uppercase px-2 py-1">Tickets ({filteredTickets.length})</p>
                {paginatedTickets.map((t) => {
                  const isActive = (activeInboxTicketId || paginatedTickets[0]?.id) === t.id;
                  const requesterName = t.created_by_user ? fullName(t.created_by_user.first_name, t.created_by_user.last_name) : 'Customer';
                  return (
                    <div
                      key={t.id}
                      onClick={() => setActiveInboxTicketId(t.id)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-50/70 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-gray-900 truncate">{t.subject}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_CONFIG[t.priority]?.bgColor || 'bg-gray-100'}`}>
                          {PRIORITY_CONFIG[t.priority]?.label || t.priority}
                        </span>
                      </div>
                      <p className="text-gray-500 truncate">{requesterName} • #{t.ticket_number}</p>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Quick Ticket Detail Preview */}
              <div className="md:col-span-2 p-3 space-y-4">
                {(() => {
                  const targetTicket = paginatedTickets.find((t) => t.id === (activeInboxTicketId || paginatedTickets[0]?.id)) || paginatedTickets[0];
                  if (!targetTicket) return <p className="text-xs text-gray-400 text-center py-10">Select a ticket to preview</p>;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between border-b pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-blue-600 font-bold">#{targetTicket.ticket_number}</span>
                            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{targetTicket.status}</span>
                          </div>
                          <h3 className="text-base font-bold text-gray-900 mt-1">{targetTicket.subject}</h3>
                        </div>
                        <button
                          onClick={() => navigate(`/agent/tickets/${targetTicket.id}`)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors"
                        >
                          Open Full View →
                        </button>
                      </div>

                      <div className="bg-gray-50 p-3.5 rounded-lg border text-xs text-gray-700 space-y-2">
                        <p className="font-semibold text-gray-900">Description:</p>
                        <p className="whitespace-pre-wrap">{targetTicket.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-gray-50 p-2.5 rounded border"><span className="text-gray-500">Requester:</span> <span className="font-bold">{targetTicket.created_by_user ? fullName(targetTicket.created_by_user.first_name, targetTicket.created_by_user.last_name) : 'Customer'}</span></div>
                        <div className="bg-gray-50 p-2.5 rounded border"><span className="text-gray-500">Company:</span> <span className="font-bold">{targetTicket.accounts?.company_name || 'N/A'}</span></div>
                        <div className="bg-gray-50 p-2.5 rounded border"><span className="text-gray-500">Priority:</span> <span className="font-bold">{targetTicket.priority}</span></div>
                        <div className="bg-gray-50 p-2.5 rounded border"><span className="text-gray-500">Created:</span> <span className="font-bold">{new Date(targetTicket.created_at).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* TABLE LAYOUT VIEW (Dense Table with Horizontal Slide Scroll) */
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-w-full scroll-smooth">
                <table className="w-full text-left text-xs min-w-[950px]">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <button onClick={() => handleSelectAll(!isAllPageSelected)}>
                          {isAllPageSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                        </button>
                      </th>
                      <th className="p-3 min-w-[320px]">Ticket & Requester</th>
                      <th className="p-3 min-w-[180px]">SLA Due</th>
                      <th className="p-3 min-w-[120px]">Priority</th>
                      <th className="p-3 min-w-[160px]">Assignee</th>
                      <th className="p-3 min-w-[160px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedTickets.map((t) => {
                      const isSelected = selectedIds.has(t.id);
                      return (
                        <tr
                          key={t.id}
                          onClick={() => navigate(`/agent/tickets/${t.id}`)}
                          className={`hover:bg-blue-50/30 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => handleToggleSelect(t.id, e)}>
                              {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                            </button>
                          </td>
                          <td className="p-3 min-w-[320px]">
                            <div className="flex items-center gap-2">
                              {!t.first_human_response_at && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="New" />}
                              <span className="font-bold text-gray-900 leading-snug">{t.subject}</span>
                              <span className="text-gray-400 font-mono text-[11px] flex-shrink-0">#{t.ticket_number}</span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {t.created_by_user ? fullName(t.created_by_user.first_name, t.created_by_user.last_name) : 'Customer'}
                              {t.accounts?.company_name ? ` (${t.accounts.company_name})` : ''}
                            </p>
                          </td>
                          <td className="p-3 min-w-[180px]">{renderSlaInfo(t)}</td>
                          <td className="p-3 min-w-[120px]" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={t.priority}
                              onChange={(e) => handleUpdateTicket(t.id, { priority: e.target.value as TicketPriority })}
                              className="bg-gray-50 border border-gray-200 text-xs font-bold rounded px-2.5 py-1 cursor-pointer hover:bg-gray-100"
                            >
                              <option value="P4">Low</option>
                              <option value="P3">Medium</option>
                              <option value="P2">High</option>
                              <option value="P1">Urgent</option>
                            </select>
                          </td>
                          <td className="p-3 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={t.assigned_agent_id || ''}
                              onChange={(e) => handleUpdateTicket(t.id, { assigned_agent_id: e.target.value || null })}
                              className="bg-gray-50 border border-gray-200 text-xs rounded px-2.5 py-1 cursor-pointer hover:bg-gray-100"
                            >
                              <option value="">Unassigned</option>
                              {agents.map((a) => (
                                <option key={a.id} value={a.id}>{fullName(a.first_name, a.last_name)}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={t.status}
                              onChange={(e) => handleUpdateTicket(t.id, { status: e.target.value as TicketStatus })}
                              className="bg-gray-50 border border-gray-200 text-xs font-bold rounded px-2.5 py-1 cursor-pointer hover:bg-gray-100"
                            >
                              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}


        </div>

        {/* 4. EXACT FRESHDESK SIDEBAR FILTERS (25% WIDTH) */}
        {showFilters && (
          <aside className="w-full lg:w-72 bg-white border border-gray-200 rounded-xl p-4 space-y-4 flex-shrink-0 shadow-2xs">
            {/* Header with "Show applied filters" link */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">FILTERS</h3>
              <button onClick={() => setShowAppliedModal(true)} className="text-xs font-semibold text-blue-600 hover:underline">
                Show applied filters
              </button>
            </div>

            {/* Quick Search fields input */}
            <div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields..."
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
              {/* Agents Include */}
              {matchesFieldSearch('Agents Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Agents Include</label>
                  <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any agent</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{fullName(a.first_name, a.last_name)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Groups Include */}
              {matchesFieldSearch('Groups Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Groups Include</label>
                  <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any group</option>
                    {teams.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sentiment */}
              {matchesFieldSearch('Sentiment') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Sentiment</label>
                  <select value={filterSentiment} onChange={(e) => setFilterSentiment(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any</option>
                    <option value="positive">Positive 😀</option>
                    <option value="neutral">Neutral 😐</option>
                    <option value="negative">Negative 😡</option>
                  </select>
                </div>
              )}

              {/* Created */}
              {matchesFieldSearch('Created') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Created</label>
                  <select value={filterCreated} onChange={(e) => setFilterCreated(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 days</option>
                    <option value="30days">Last 30 days</option>
                  </select>
                </div>
              )}

              {/* Closed at */}
              {matchesFieldSearch('Closed at') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Closed at</label>
                  <select value={filterClosedAt} onChange={(e) => setFilterClosedAt(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 days</option>
                    <option value="30days">Last 30 days</option>
                  </select>
                </div>
              )}

              {/* Resolved at */}
              {matchesFieldSearch('Resolved at') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Resolved at</label>
                  <select value={filterResolvedAt} onChange={(e) => setFilterResolvedAt(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 days</option>
                    <option value="30days">Last 30 days</option>
                  </select>
                </div>
              )}

              {/* Resolution due by */}
              {matchesFieldSearch('Resolution due by') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Resolution due by</label>
                  <select value={filterResolutionDue} onChange={(e) => setFilterResolutionDue(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any time</option>
                    <option value="today">Today</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              )}

              {/* First response due by */}
              {matchesFieldSearch('First response due by') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">First response due by</label>
                  <select value={filterFirstResponseDue} onChange={(e) => setFilterFirstResponseDue(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any time</option>
                    <option value="today">Today</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              )}

              {/* Next response due by */}
              {matchesFieldSearch('Next response due by') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Next response due by</label>
                  <select value={filterNextResponseDue} onChange={(e) => setFilterNextResponseDue(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any time</option>
                    <option value="today">Today</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              )}

              {/* Skills Include */}
              {matchesFieldSearch('Skills Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Skills Include</label>
                  <select value={filterSkills} onChange={(e) => setFilterSkills(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any</option>
                  </select>
                </div>
              )}

              {/* Status Include */}
              {matchesFieldSearch('Status Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Status Include</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any status</option>
                    <option value="NEW">New</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              )}

              {/* Priorities Include */}
              {matchesFieldSearch('Priorities Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Priorities Include</label>
                  <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any</option>
                    <option value="P1">P1 - Urgent</option>
                    <option value="P2">P2 - High</option>
                    <option value="P3">P3 - Medium</option>
                    <option value="P4">P4 - Low</option>
                  </select>
                </div>
              )}

              {/* Types Include */}
              {matchesFieldSearch('Types Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Types Include</label>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sources Include */}
              {matchesFieldSearch('Sources Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Sources Include</label>
                  <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any</option>
                    <option value="portal">Portal</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="chat">Chat</option>
                  </select>
                </div>
              )}

              {/* Source Info Include */}
              {matchesFieldSearch('Source Info Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Source Info Include</label>
                  <select value={filterSourceInfo} onChange={(e) => setFilterSourceInfo(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any</option>
                  </select>
                </div>
              )}

              {/* Tags */}
              {matchesFieldSearch('Tags') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Tags</label>
                  <select value={filterTags} onChange={(e) => setFilterTags(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any</option>
                    <option value="critical">critical</option>
                    <option value="csv">csv</option>
                    <option value="api">api</option>
                  </select>
                </div>
              )}

              {/* Companies Include */}
              {matchesFieldSearch('Companies Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Companies Include</label>
                  <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any</option>
                    <option value="acc-1">Acme Corp</option>
                    <option value="acc-2">Globex Inc</option>
                    <option value="acc-3">Initech</option>
                  </select>
                </div>
              )}

              {/* Contacts Include */}
              {matchesFieldSearch('Contacts Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Contacts Include</label>
                  <select value={filterContact} onChange={(e) => setFilterContact(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any</option>
                  </select>
                </div>
              )}

              {/* Products Include */}
              {matchesFieldSearch('Products Include') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Products Include</label>
                  <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer">
                    <option value="any">Any</option>
                  </select>
                </div>
              )}
            </div>

            {/* Sticky Apply Button */}
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={() => setCurrentPage(1)}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
              >
                Apply
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
