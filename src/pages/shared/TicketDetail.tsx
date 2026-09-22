import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner, EmptyState } from '@/components/ui';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { PriorityBadge, StatusBadge, Avatar } from '@/components/ui/Badges';
import {
  formatRelativeTime, formatDateTime, getSlaStatus, fullName,
  STATUS_LABELS, IMPACT_LABELS, URGENCY_LABELS, PRIORITY_LABELS,
} from '@/lib/constants';
import type {
  Ticket, TicketMessage, TicketMessageWithAuthor,
  TicketSlaSnapshot, TicketStatusHistory, Profile,
  TicketStatus, TicketPriority, SupportTeam, TicketType,
} from '@/types';
import {
  ArrowLeft, Send, Clock, CheckCircle, RotateCcw, XCircle,
  AlertCircle, MessageSquare, Lock, User, Tag, Building2, History,
  Paperclip, Download, Phone, Mail, ChevronDown, Check, Sparkles,
  MoreHorizontal, CornerUpLeft, Plus, ExternalLink, ShieldAlert,
  Edit3, Pencil, X
} from 'lucide-react';
import {
  sendAgentReplyNotification,
  sendTicketStatusNotification,
  sendCsatSurveyNotification,
  sendAgentTicketAssignmentNotification,
  sendCustomerReplyToAgentNotification,
} from '@/lib/emailService';
import { getStoredAgents } from '@/lib/agentRoleService';

interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  path: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  storage_path: string;
  is_internal: boolean;
  message_id: string | null;
}

const DEMO_TYPES: TicketType[] = [
  { id: 'type-question', name: 'Question', is_active: true, sort_order: 1 },
  { id: 'type-incident', name: 'Incident', is_active: true, sort_order: 2 },
  { id: 'type-problem', name: 'Problem', is_active: true, sort_order: 3 },
  { id: 'type-feature-request', name: 'Feature Request', is_active: true, sort_order: 4 },
  { id: 'type-refund', name: 'Refund', is_active: true, sort_order: 5 },
];

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; dotColor: string; textColor: string }> = {
  P4: { label: 'Low', dotColor: 'bg-[#22c55e]', textColor: 'text-gray-700' },
  P3: { label: 'Medium', dotColor: 'bg-[#3b82f6]', textColor: 'text-gray-700' },
  P2: { label: 'High', dotColor: 'bg-[#f59e0b]', textColor: 'text-gray-700' },
  P1: { label: 'Urgent', dotColor: 'bg-[#ef4444]', textColor: 'text-gray-700' },
};

function renderHtmlContent(html: string): string {
  const isHtml = /<[a-z][\s\S]*>/i.test(html);
  return isHtml ? html : html.replace(/\n/g, '<br/>');
}

const DEMO_TICKETS_MAP: Record<string, Ticket> = {
  't-1': {
    id: 't-1',
    ticket_number: 'AIV-000001',
    account_id: 'acc-1',
    created_by_user_id: 'user-1',
    ticket_type_id: 'type-1',
    category_id: 'cat-1',
    subject: 'Application crashes when importing large CSV files (>50MB)',
    description: 'When attempting to import CSV files larger than 50MB, the application crashes with an out of memory error. This happens consistently on our production environment.',
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
    tags: ['csv', 'crash'],
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
  },
  't-2': {
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
    tags: [],
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
  },
  't-3': {
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
    tags: ['critical'],
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
  },
};

export function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessageWithAuthor[]>([]);
  const [slaSnapshot, setSlaSnapshot] = useState<TicketSlaSnapshot | null>(null);
  const [statusHistory, setStatusHistory] = useState<TicketStatusHistory[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [teams, setTeams] = useState<SupportTeam[]>([]);
  const [types, setTypes] = useState<TicketType[]>(DEMO_TYPES);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [replyFiles, setReplyFiles] = useState<UploadedFile[]>([]);
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [activeReplyTab, setActiveReplyTab] = useState<'reply' | 'note'>('reply');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState('');
  const [updatingProperties, setUpdatingProperties] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Editable Properties
  const [propTags, setPropTags] = useState<string>('');
  const [propType, setPropType] = useState<string>('');
  const [propStatus, setPropStatus] = useState<TicketStatus>('OPEN');
  const [propPriority, setPropPriority] = useState<TicketPriority>('P3');
  const [propGroup, setPropGroup] = useState<string>('');
  const [propAgent, setPropAgent] = useState<string>('');
  const [propProduct, setPropProduct] = useState<string>('AIV Enterprise');
  const [propRefNum, setPropRefNum] = useState<string>('');
  const [agents, setAgents] = useState<Profile[]>([]);

  // Type dropdown in properties
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Edit Ticket Modal State (Freshdesk Edit button)
  const [showEditTicketModal, setShowEditTicketModal] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editContactId, setEditContactId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [allContacts, setAllContacts] = useState<Profile[]>([]);

  const replyBoxRef = useRef<HTMLDivElement>(null);

  const isStaff = profile?.user_type && ['agent', 'manager', 'account_manager', 'admin'].includes(profile.user_type);
  const isCustomer = profile?.user_type && ['customer_user', 'customer_admin'].includes(profile.user_type);

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);

    let ticketData: Ticket | null = null;
    try {
      let query = dbClient.from('tickets').select('*');
      if (ticketId.startsWith('AIV-')) {
        query = query.eq('ticket_number', ticketId);
      } else {
        query = query.eq('id', ticketId);
      }
      const { data } = await query.maybeSingle();
      if (data) ticketData = data as Ticket;
    } catch (e) {}

    if (!ticketData) {
      try {
        const localCustoms: Ticket[] = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
        const match = localCustoms.find((t) => t.id === ticketId || t.ticket_number === ticketId);
        if (match) ticketData = match;
      } catch (e) {}
    }

    if (!ticketData) {
      ticketData = DEMO_TICKETS_MAP[ticketId] || null;
    }

    if (!ticketData) { setLoading(false); return; }
    setTicket(ticketData as Ticket);

    // Initialize properties panel
    setPropTags((ticketData.tags || []).join(', '));
    setPropType(ticketData.ticket_type_id || '');
    setPropStatus((ticketData.status as TicketStatus) || 'OPEN');
    setPropPriority((ticketData.priority as TicketPriority) || 'P3');
    setPropGroup(ticketData.assigned_team_id || '');
    setPropAgent(ticketData.assigned_agent_id || '');
    setPropRefNum((ticketData as any).reference_number || (ticketData as any).aiv_version || '');

    try {
      const { data: msgData } = await dbClient
        .from('ticket_messages')
        .select('*, author:profiles(*)')
        .eq('ticket_id', ticketData.id)
        .order('created_at', { ascending: true });
      if (msgData && msgData.length > 0) {
        setMessages(msgData as unknown as TicketMessageWithAuthor[]);
      } else {
        setMessages([
          {
            id: `msg-init-${ticketData.id}`,
            ticket_id: ticketData.id,
            author_user_id: ticketData.created_by_user_id,
            message_type: 'customer_message',
            body: ticketData.description || 'No description provided.',
            is_internal: false,
            created_at: ticketData.created_at,
            author: {
              id: ticketData.created_by_user_id,
              first_name: 'Customer',
              last_name: 'User',
              email: 'customer@company.com',
              user_type: 'customer_user',
            },
          },
        ] as TicketMessageWithAuthor[]);
      }
    } catch (e) {
      setMessages([
        {
          id: `msg-init-${ticketData.id}`,
          ticket_id: ticketData.id,
          author_user_id: ticketData.created_by_user_id,
          message_type: 'customer_message',
          body: ticketData.description || 'No description provided.',
          is_internal: false,
          created_at: ticketData.created_at,
          author: {
            id: ticketData.created_by_user_id,
            first_name: 'Customer',
            last_name: 'User',
            email: 'customer@company.com',
            user_type: 'customer_user',
          },
        },
      ] as TicketMessageWithAuthor[]);
    }

    try {
      const { data: attachData } = await dbClient
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', ticketData.id);
      if (attachData) {
        const map: Record<string, Attachment[]> = {};
        const publicUrlMap: Record<string, string> = {};
        for (const a of attachData) {
          const { data: urlData } = dbClient.storage.from('attachments').getPublicUrl(a.storage_path);
          publicUrlMap[a.storage_path] = urlData.publicUrl;
        }
        for (const a of attachData) {
          const key = a.message_id || '_root';
          if (!map[key]) map[key] = [];
          (map[key] as any).push({
            ...a,
            _url: publicUrlMap[a.storage_path] || '',
          });
        }
        setAttachments(map);
      }
    } catch (e) {}

    try {
      const { data: slaData } = await dbClient
        .from('ticket_sla_snapshots')
        .select('*')
        .eq('ticket_id', ticketData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (slaData) setSlaSnapshot(slaData as TicketSlaSnapshot);
    } catch (e) {}

    try {
      const { data: histData } = await dbClient
        .from('ticket_status_history')
        .select('*')
        .eq('ticket_id', ticketData.id)
        .order('created_at', { ascending: false });
      if (histData) setStatusHistory(histData as TicketStatusHistory[]);
    } catch (e) {}

    const userIds = new Set<string>();
    if (ticketData.created_by_user_id) userIds.add(ticketData.created_by_user_id);
    if (ticketData.assigned_agent_id) userIds.add(ticketData.assigned_agent_id);

    const map: Record<string, Profile> = {};

    // 1. Check local_custom_users
    try {
      const customUsers: Profile[] = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
      customUsers.forEach(u => { map[u.id] = u; });
    } catch (e) {}

    // 2. Check stored agents
    try {
      const stored = getStoredAgents();
      stored.forEach(a => {
        map[a.id] = {
          id: a.id,
          first_name: a.first_name,
          last_name: a.last_name,
          email: a.email,
          user_type: 'agent',
          account_id: null,
          status: a.status === 'ACTIVE' ? 'active' : 'inactive',
          phone: a.phone,
          mobile: a.mobile,
          job_title: a.job_title,
          auth_uid: null,
          created_at: a.created_at,
          updated_at: a.updated_at,
        };
      });
    } catch (e) {}

    // 3. Query PostgreSQL profiles
    if (userIds.size > 0) {
      try {
        const { data: profileData } = await dbClient
          .from('profiles')
          .select('*')
          .in('id', Array.from(userIds));
        if (profileData) {
          (profileData as any[]).forEach((p: any) => { map[p.id] = p as Profile; });
        }
      } catch (e) {}
    }
    setProfiles(map);

    // 4. Load all agents for the staff Reassign select
    try {
      const { data: agData } = await dbClient.from('profiles').select('*').in('user_type', ['agent', 'manager', 'account_manager', 'admin']).order('first_name');
      const allAgentsMap = new Map<string, Profile>();
      if (agData) (agData as Profile[]).forEach(a => allAgentsMap.set(a.id, a));
      const stored = getStoredAgents();
      stored.forEach(a => {
        if (!allAgentsMap.has(a.id)) {
          allAgentsMap.set(a.id, {
            id: a.id,
            first_name: a.first_name,
            last_name: a.last_name,
            email: a.email,
            user_type: 'agent',
            account_id: null,
            status: a.status === 'ACTIVE' ? 'active' : 'inactive',
            phone: a.phone,
            mobile: a.mobile,
            job_title: a.job_title,
            auth_uid: null,
            created_at: a.created_at,
            updated_at: a.updated_at,
          });
        }
      });
      setAgents(Array.from(allAgentsMap.values()));
    } catch (e) {}

    try {
      const { data: teamData } = await dbClient.from('support_teams').select('*').eq('is_active', true).order('name');
      if (teamData && teamData.length > 0) setTeams(teamData as SupportTeam[]);
    } catch (e) {}

    try {
      const { data: ctData } = await dbClient.from('profiles').select('*').order('first_name');
      const contactsList: Profile[] = ctData ? (ctData as Profile[]) : [];
      // Also add local custom users if any
      try {
        const customUsers: Profile[] = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
        customUsers.forEach((cu) => {
          if (!contactsList.find((c) => c.id === cu.id || c.email === cu.email)) {
            contactsList.push(cu);
          }
        });
      } catch (e) {}

      // Add default sejal if not present
      if (!contactsList.find((c) => c.email === 'sejal@aivhub.com')) {
        contactsList.unshift({
          id: 'contact-sejal',
          first_name: 'Sejal',
          last_name: 'prasad',
          email: 'sejal@aivhub.com',
          user_type: 'customer_user',
          account_id: null,
          status: 'active',
          phone: '+1 234 567 890',
          mobile: null,
          job_title: 'Account Administrator',
          auth_uid: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      setAllContacts(contactsList);
    } catch (e) {}

    try {
      const { data: typeData } = await dbClient.from('ticket_types').select('*').eq('is_active', true).order('sort_order');
      if (typeData && typeData.length > 0) setTypes(typeData as TicketType[]);
    } catch (e) {}

    setLoading(false);
  }, [ticketId, isStaff]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  const handleSendReply = async () => {
    if (!reply.trim() || !ticket || !profile) return;
    setSending(true);

    const isInternalMsg = activeReplyTab === 'note' && !!isStaff;
    const messageType = isStaff ? (isInternalMsg ? 'internal_note' : 'public_reply') : 'customer_message';

    const localNewMsg: TicketMessageWithAuthor = {
      id: `msg-${Date.now()}`,
      ticket_id: ticket.id,
      author_user_id: profile.id,
      message_type: messageType,
      body: reply,
      is_internal: isInternalMsg,
      created_at: new Date().toISOString(),
      author: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        user_type: profile.user_type,
      },
    };

    setMessages((prev) => [...prev, localNewMsg]);
    setReply('');
    setReplyFiles([]);

    try {
      await dbClient
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          author_user_id: profile.id,
          message_type: messageType,
          body: reply,
          is_internal: isInternalMsg,
        });
    } catch (e) {}

    const creator = profiles[ticket.created_by_user_id];
    let assignedAgent = ticket.assigned_agent_id ? profiles[ticket.assigned_agent_id] : null;

    if (isCustomer && ticket) {
      if (ticket.status === 'WAITING_FOR_CUSTOMER') {
        await dbClient.from('tickets').update({ status: 'OPEN', updated_at: new Date().toISOString() }).eq('id', ticket.id);
        await dbClient.from('ticket_status_history').insert({
          ticket_id: ticket.id,
          from_status: ticket.status,
          to_status: 'OPEN',
          changed_by_user_id: profile.id,
          reason: 'Customer replied',
        });
        setTicket({ ...ticket, status: 'OPEN' });
        setPropStatus('OPEN');
      }

      // Dispatch alert to assigned agent when customer replies
      if (assignedAgent) {
        sendCustomerReplyToAgentNotification(
          { ticket_number: ticket.ticket_number, subject: ticket.subject },
          reply,
          `${profile.first_name} ${profile.last_name}`,
          { email: assignedAgent.email, name: `${assignedAgent.first_name} ${assignedAgent.last_name}` }
        );
      }
    }

    if (isStaff && !isInternalMsg && ticket) {
      if (!ticket.first_human_response_at) {
        await dbClient.from('tickets').update({
          first_human_response_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', ticket.id);
        await dbClient.from('ticket_sla_events').insert({
          ticket_id: ticket.id,
          event_type: 'FIRST_HUMAN_RESPONSE',
          actor_user_id: profile.id,
        });
      }

      // Dispatch agent reply notification to customer with signature block
      const currentAgent = getStoredAgents().find((a) => a.id === profile.id || a.email === profile.email);
      sendAgentReplyNotification(
        { ticket_number: ticket.ticket_number, subject: ticket.subject },
        reply,
        {
          name: `${profile.first_name} ${profile.last_name}`,
          email: profile.email,
          signature: currentAgent?.signature || undefined,
        },
        {
          email: creator?.email || 'customer@acme.com',
          name: creator ? `${creator.first_name} ${creator.last_name}` : 'Valued Customer',
        }
      );
    }

    setSending(false);
  };

  // Freshdesk Sidebar "Update" Button Click Handler
  const handleUpdateProperties = async () => {
    if (!ticket || !profile) return;
    setUpdatingProperties(true);

    const tagsArray = propTags.split(',').map(s => s.trim()).filter(Boolean);
    const updates: any = {
      status: propStatus,
      priority: propPriority,
      customer_priority: propPriority,
      aiv_priority: propPriority,
      ticket_type_id: propType || null,
      assigned_team_id: propGroup || null,
      assigned_agent_id: propAgent || null,
      tags: tagsArray,
      updated_at: new Date().toISOString(),
    };

    if (propStatus === 'RESOLVED') {
      updates.resolved_at = new Date().toISOString();
    } else if (propStatus === 'CLOSED') {
      updates.closed_at = new Date().toISOString();
    }

    try {
      await dbClient.from('tickets').update(updates).eq('id', ticket.id);
    } catch (err) {
      console.warn('DB update properties notice:', err);
    }

    // Update local_custom_tickets if present
    try {
      const localCustoms: any[] = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
      const idx = localCustoms.findIndex((t) => t.id === ticket.id || t.ticket_number === ticket.ticket_number);
      if (idx !== -1) {
        localCustoms[idx] = { ...localCustoms[idx], ...updates };
        localStorage.setItem('local_custom_tickets', JSON.stringify(localCustoms));
      }
    } catch (e) {}

    // Check status change
    const creator = profiles[ticket.created_by_user_id];
    if (propStatus !== ticket.status) {
      try {
        await dbClient.from('ticket_status_history').insert({
          ticket_id: ticket.id,
          from_status: ticket.status,
          to_status: propStatus,
          changed_by_user_id: profile.id,
        });
      } catch (e) {}

      if (propStatus === 'RESOLVED') {
        try {
          await dbClient.from('ticket_sla_events').insert({
            ticket_id: ticket.id,
            event_type: 'RESOLVED',
            actor_user_id: profile.id,
          });
        } catch (e) {}
      }

      sendTicketStatusNotification(
        { ticket_number: ticket.ticket_number, subject: ticket.subject, status: propStatus },
        { email: creator?.email || 'customer@acme.com', name: creator ? `${creator.first_name} ${creator.last_name}` : 'Customer' }
      );

      if (propStatus === 'RESOLVED' || propStatus === 'CLOSED') {
        sendCsatSurveyNotification(
          { ticket_number: ticket.ticket_number, subject: ticket.subject },
          { email: creator?.email || 'customer@acme.com', name: creator ? `${creator.first_name} ${creator.last_name}` : 'Customer' }
        );
      }
    }

    // Check assignment change
    if (propAgent !== ticket.assigned_agent_id || propGroup !== ticket.assigned_team_id) {
      try {
        await dbClient.from('ticket_assignment_history').insert({
          ticket_id: ticket.id,
          from_agent_id: ticket.assigned_agent_id,
          to_agent_id: propAgent || null,
          from_team_id: ticket.assigned_team_id,
          to_team_id: propGroup || null,
          changed_by_user_id: profile.id,
        });
      } catch (e) {}

      if (propAgent && propAgent !== ticket.assigned_agent_id) {
        const targetAgent = profiles[propAgent] || getStoredAgents().find((a) => a.id === propAgent);
        if (targetAgent) {
          sendAgentTicketAssignmentNotification(
            { ticket_number: ticket.ticket_number, subject: ticket.subject, priority: propPriority, description: ticket.description },
            { email: targetAgent.email, name: `${targetAgent.first_name} ${targetAgent.last_name}` }
          );
        }
      }
    }

    setTicket({
      ...ticket,
      ...updates,
    });

    setUpdatingProperties(false);
    setUpdateSuccess(true);
    setTimeout(() => setUpdateSuccess(false), 2500);
  };

  const handleGenerateAiSummary = () => {
    setShowAiSummary(true);
    setAiSummaryText(
      `Ticket #${ticket?.ticket_number || 'AIV-000001'} Summary:\n• Issue: ${ticket?.subject || 'Customer reported inquiry'}\n• Core problem: ${ticket?.description ? ticket.description.slice(0, 160) + '...' : 'Details provided in conversation'}\n• Current Status: ${propStatus}, Priority: ${PRIORITY_CONFIG[propPriority]?.label || propPriority}\n• Assigned: ${propAgent ? (agents.find(a => a.id === propAgent)?.first_name || 'Agent') : 'Unassigned'}\n• SLA: ${slaSnapshot ? 'Active (' + slaSnapshot.support_plan_code + ')' : 'Standard response time'}`
    );
  };

  const openEditTicketModal = () => {
    if (!ticket) return;
    setEditSubject(ticket.subject || '');
    setEditDescription(ticket.description || '');
    setEditContactId(ticket.created_by_user_id || '');
    setShowEditTicketModal(true);
  };

  const handleSaveEditTicket = async () => {
    if (!ticket || !editSubject.trim()) return;
    setSavingEdit(true);

    const updates: Partial<Ticket> = {
      subject: editSubject.trim(),
      description: editDescription.trim(),
      created_by_user_id: editContactId || ticket.created_by_user_id,
      updated_at: new Date().toISOString(),
    };

    try {
      await dbClient.from('tickets').update(updates).eq('id', ticket.id);
    } catch (e) {
      console.warn('DB ticket edit notice:', e);
    }

    // Update in local storage
    try {
      const localCustoms: Ticket[] = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
      const idx = localCustoms.findIndex((t) => t.id === ticket.id || t.ticket_number === ticket.ticket_number);
      if (idx !== -1) {
        localCustoms[idx] = { ...localCustoms[idx], ...updates };
        localStorage.setItem('local_custom_tickets', JSON.stringify(localCustoms));
      }
    } catch (e) {}

    // Update first message if it's the root description message
    setMessages((prev) => {
      if (prev.length > 0 && prev[0].id.startsWith('msg-init-')) {
        const copy = [...prev];
        copy[0] = {
          ...copy[0],
          body: editDescription.trim(),
          author_user_id: editContactId || copy[0].author_user_id,
        };
        return copy;
      }
      return prev;
    });

    setTicket((prev) => (prev ? { ...prev, ...updates } : null));

    // Also update in inboxTickets list
    setInboxTickets((prev) =>
      prev.map((t) => (t.id === ticket.id ? { ...t, ...updates } : t))
    );

    setSavingEdit(false);
    setShowEditTicketModal(false);
  };

  const scrollToReply = (tab: 'reply' | 'note') => {
    setActiveReplyTab(tab);
    replyBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Fetch tickets for left split pane
  const [inboxTickets, setInboxTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    async function loadInboxTickets() {
      try {
        let list: Ticket[] = [];
        const { data } = await dbClient.from('tickets').select('*').order('created_at', { ascending: false }).limit(20);
        if (data && data.length > 0) {
          list = data as Ticket[];
        }

        // Merge with local customs
        try {
          const customs: Ticket[] = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
          customs.forEach((ct) => {
            if (!list.find((x) => x.id === ct.id || x.ticket_number === ct.ticket_number)) {
              list.unshift(ct);
            }
          });
        } catch (e) {}

        // If still empty or few, add demo tickets
        Object.values(DEMO_TICKETS_MAP).forEach((dt) => {
          if (!list.find((x) => x.id === dt.id || x.ticket_number === dt.ticket_number)) {
            list.push(dt);
          }
        });

        setInboxTickets(list);
      } catch (err) {
        setInboxTickets(Object.values(DEMO_TICKETS_MAP));
      }
    }
    loadInboxTickets();
  }, [ticketId]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner label="Loading ticket details..." />
    </div>
  );

  if (!ticket) return (
    <div className="p-8">
      <EmptyState title="Ticket not found" description="This ticket may have been deleted or you may not have access." />
    </div>
  );

  if (!profile) return null;

  const creator = profiles[ticket.created_by_user_id];
  let assignedAgent = ticket.assigned_agent_id ? profiles[ticket.assigned_agent_id] : null;
  if (!assignedAgent && ticket.assigned_agent_id) {
    const storedAgents = getStoredAgents();
    const match = storedAgents.find(a => a.id === ticket.assigned_agent_id || a.email === ticket.assigned_agent_id);
    if (match) {
      assignedAgent = {
        id: match.id,
        first_name: match.first_name,
        last_name: match.last_name,
        email: match.email,
        user_type: 'agent',
        account_id: null,
        status: match.status === 'ACTIVE' ? 'active' : 'inactive',
        phone: match.phone,
        mobile: match.mobile,
        job_title: match.job_title,
        auth_uid: null,
        created_at: match.created_at,
        updated_at: match.updated_at,
      };
    }
  }

  const requesterDisplayName = creator
    ? fullName(creator.first_name, creator.last_name)
    : 'Sejal prasad';

  const canReply = !['CLOSED', 'CANCELLED'].includes(ticket.status);

  // Customer Portal fallback view
  if (!isStaff) {
    return (
      <div className="max-w-5xl mx-auto space-y-5 p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to My Tickets
        </button>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono font-bold text-blue-600">#{ticket.ticket_number}</span>
            <StatusBadge status={ticket.status} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
          <p className="text-xs text-gray-500 mt-1">Created {formatRelativeTime(ticket.created_at)}</p>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {ticket.description}
          </div>
        </div>

        {/* Customer Reply */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-gray-900">Conversation</h3>
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`p-4 rounded-xl border text-sm ${msg.author_user_id === profile.id ? 'bg-blue-50 border-blue-100 ml-8' : 'bg-gray-50 border-gray-200 mr-8'}`}>
                <div className="flex justify-between items-center mb-1 text-xs text-gray-500">
                  <span className="font-semibold text-gray-800">{msg.author ? fullName(msg.author.first_name, msg.author.last_name) : 'Support Agent'}</span>
                  <span>{formatRelativeTime(msg.created_at)}</span>
                </div>
                <div className="rich-content text-gray-800" dangerouslySetInnerHTML={{ __html: renderHtmlContent(msg.body) }} />
              </div>
            ))}
          </div>

          {canReply && (
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <RichTextEditor
                value={reply}
                onChange={setReply}
                placeholder="Type your reply to support..."
                minHeight={100}
                userId={profile.id}
                files={replyFiles}
                onFilesChange={setReplyFiles}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSendReply}
                  disabled={!reply.trim() || sending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // FRESHDESK EXACT 3-COLUMN SPLIT LAYOUT (MATCHING IMAGE 2)
  // =========================================================================
  return (
    <div className="flex flex-col h-[calc(100vh-6.75rem)] bg-white text-[#12344d] overflow-hidden">
      {/* 1. FRESHDESK TOP ACTION TOOLBAR (Matching Image 2) */}
      <div className="h-12 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0 z-20">
        {/* Left Toolbar actions: Star, Reply, Note, Forward, Close, ⋮ */}
        <div className="flex items-center gap-2">
          {/* Favorite Star */}
          <button
            title="Star ticket"
            className="p-1.5 text-gray-400 hover:text-amber-500 rounded hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>

          {/* Reply Pill Button */}
          <button
            onClick={() => scrollToReply('reply')}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-white hover:bg-gray-50 border border-gray-300 rounded-md text-[#12344d] transition-colors"
          >
            <CornerUpLeft className="w-3.5 h-3.5 text-gray-600" />
            <span>Reply</span>
          </button>

          {/* Note Pill Button */}
          <button
            onClick={() => scrollToReply('note')}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-white hover:bg-gray-50 border border-gray-300 rounded-md text-[#12344d] transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-gray-600" />
            <span>Note</span>
          </button>

          {/* Forward Pill Button */}
          <button
            onClick={() => alert('Forwarding ticket...')}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-white hover:bg-gray-50 border border-gray-300 rounded-md text-[#12344d] transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-gray-600" />
            <span>Forward</span>
          </button>

          {/* Close Pill Button */}
          <button
            onClick={() => {
              setPropStatus('CLOSED');
              handleUpdateProperties();
            }}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-white hover:bg-gray-50 border border-gray-300 rounded-md text-[#12344d] transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5 text-gray-600" />
            <span>Close</span>
          </button>

          {/* More Ellipsis */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            title="More Options / History"
            className="p-1.5 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-100 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Right Toolbar: Threads +, Activities, < >, Split Screen */}
        <div className="flex items-center gap-3 text-xs text-gray-600">
          {updateSuccess && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <Check className="w-3 h-3" /> Updated
            </span>
          )}

          <div className="flex items-center gap-1 hover:text-gray-900 cursor-pointer font-medium">
            <span>Threads</span>
            <Plus className="w-3.5 h-3.5" />
          </div>

          <div className="h-3.5 w-px bg-gray-200" />

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 font-medium hover:text-gray-900"
          >
            <History className="w-3.5 h-3.5 text-gray-500" />
            <span>Activities</span>
          </button>

          <div className="h-3.5 w-px bg-gray-200" />

          {/* Pagination < > */}
          <div className="flex items-center gap-0.5 text-gray-400">
            <button
              onClick={() => {
                const currentIdx = inboxTickets.findIndex(t => t.id === ticket.id || t.ticket_number === ticket.ticket_number);
                if (currentIdx > 0) {
                  navigate(`/agent/tickets/${inboxTickets[currentIdx - 1].id || inboxTickets[currentIdx - 1].ticket_number}`);
                }
              }}
              className="p-1 hover:text-gray-800 hover:bg-gray-100 rounded"
              title="Previous Ticket"
            >
              &lt;
            </button>
            <button
              onClick={() => {
                const currentIdx = inboxTickets.findIndex(t => t.id === ticket.id || t.ticket_number === ticket.ticket_number);
                if (currentIdx !== -1 && currentIdx < inboxTickets.length - 1) {
                  navigate(`/agent/tickets/${inboxTickets[currentIdx + 1].id || inboxTickets[currentIdx + 1].ticket_number}`);
                }
              }}
              className="p-1 hover:text-gray-800 hover:bg-gray-100 rounded"
              title="Next Ticket"
            >
              &gt;
            </button>
          </div>

          {/* Split Screen Icon */}
          <button className="p-1 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-100" title="Split view">
            <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. BODY 3-COLUMN SPLIT CONTAINER */}
      <div className="flex-1 flex overflow-hidden">
        {/* COLUMN 1: LEFT TICKET INBOX LIST (Matching Image 2) */}
        <aside className="w-72 border-r border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden">
          {/* Header of left column: Date created v, and layout button */}
          <div className="px-3.5 py-2.5 border-b border-gray-200 flex items-center justify-between text-xs text-gray-600 bg-white">
            <div className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-gray-900">
              <svg className="w-3.5 h-3.5 text-gray-500 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
              <span>Date created</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </div>

            <button className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          </div>

          {/* Ticket list items */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {inboxTickets.map((t, idx) => {
              const isActive = t.id === ticket.id || t.ticket_number === ticket.ticket_number;
              const creatorProfile = profiles[t.created_by_user_id];
              const authorInitial = creatorProfile?.first_name?.[0] || t.subject?.[0] || 'S';
              const timeDisplay = idx === 0 ? '17h' : idx === 1 ? '16h' : idx === 2 ? '5m' : idx === 3 ? '2h' : '3d';

              return (
                <div
                  key={t.id}
                  onClick={() => navigate(`/agent/tickets/${t.id || t.ticket_number}`)}
                  className={`p-3 cursor-pointer transition-colors relative flex items-start gap-2.5 ${
                    isActive ? 'bg-[#f4f7fa] border-l-[3px] border-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Requester Avatar Circle */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 mt-0.5 ${
                    idx % 3 === 0
                      ? 'bg-purple-100 text-purple-700'
                      : idx % 3 === 1
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {authorInitial}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {creatorProfile ? fullName(creatorProfile.first_name, creatorProfile.last_name) : 'Sejal prasad'}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                        <CornerUpLeft className="w-3 h-3" />
                        <span>{timeDisplay}</span>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {t.subject}
                    </p>

                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                      {t.description || 'Customer reported an issue...'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* COLUMN 2: CENTER CONVERSATION PANE (Matching Image 2) */}
        <main className="flex-1 bg-white overflow-y-auto px-8 py-6 space-y-6">
          {/* Header Title Section: Phone Icon + Title + New badge + Add AI summary */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Channel Phone Icon */}
                <div className="pt-0.5 text-gray-600 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>

                <div className="space-y-2 flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-[#12344d] tracking-tight leading-snug">
                    {ticket.subject}
                  </h1>

                  {/* Green "New" badge */}
                  <div>
                    <span className="inline-block px-2 py-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
                      {ticket.status === 'NEW' || ticket.status === 'OPEN' ? 'New' : ticket.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* + Add AI Summary Button */}
              <button
                onClick={handleGenerateAiSummary}
                className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-50 text-[#186ade] border border-[#d0e5ff] rounded text-xs font-semibold transition-colors shrink-0 shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#186ade]" />
                <span>+ Add AI summary</span>
              </button>
            </div>

            {/* AI Summary Box */}
            {showAiSummary && (
              <div className="mt-3 p-3.5 bg-[#f8fbff] border border-blue-200 rounded-lg text-xs text-[#12344d] space-y-2 relative animate-fadeIn">
                <div className="flex items-center justify-between font-bold text-blue-800">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" /> AI Ticket Summary
                  </span>
                  <button onClick={() => setShowAiSummary(false)} className="text-gray-400 hover:text-gray-600">
                    ✕
                  </button>
                </div>
                <p className="whitespace-pre-line text-gray-700 leading-relaxed font-sans">{aiSummaryText}</p>
              </div>
            )}
          </div>

          {/* Activities / History drawer if opened */}
          {showHistory && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Activities & History</h3>
              {statusHistory.length === 0 ? (
                <p className="text-xs text-gray-400">No previous status history logged.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {statusHistory.map((h) => {
                    const actor = profiles[h.changed_by_user_id];
                    return (
                      <div key={h.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span className="font-semibold text-gray-900">{STATUS_LABELS[h.to_status as TicketStatus] || h.to_status}</span>
                        {h.from_status && <span className="text-gray-400">from {STATUS_LABELS[h.from_status as TicketStatus] || h.from_status}</span>}
                        <span className="text-gray-400">• {formatRelativeTime(h.created_at)}</span>
                        {actor && <span className="text-gray-500 font-medium">by {fullName(actor.first_name, actor.last_name)}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Conversation Thread: Requester avatar on left + message text */}
          <div className="space-y-5 pt-2">
            {messages.map((msg, index) => {
              const author = msg.author || (msg.author_user_id ? profiles[msg.author_user_id] : null);
              const authorName = author ? fullName(author.first_name, author.last_name) : requesterDisplayName;
              const authorInitial = authorName[0] || 'S';
              const isInternalMsg = msg.is_internal;

              return (
                <div key={msg.id || index} className="flex items-start gap-3.5 group relative">
                  {/* Round Requester Avatar Circle */}
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                    {authorInitial}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Author line: Name reported via phone • time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs flex-wrap">
                        <span className="font-bold text-[#186ade]">{authorName}</span>
                        <span className="text-gray-500">reported via phone</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500 italic">
                          {formatRelativeTime(msg.created_at)} ({formatDateTime(msg.created_at)})
                        </span>
                        {isInternalMsg && (
                          <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            <Lock className="w-3 h-3" /> Note
                          </span>
                        )}
                      </div>

                      {/* Freshdesk Hover Action Buttons: Edit & Forward */}
                      {isStaff && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {/* Edit button with tooltip */}
                          <div className="relative group/edit">
                            <button
                              type="button"
                              onClick={openEditTicketModal}
                              className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                              title="Edit ticket"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#12344d] text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow pointer-events-none opacity-0 group-hover/edit:opacity-100 transition-opacity">
                              Edit
                            </span>
                          </div>

                          {/* Forward / Reply quick icon */}
                          <button
                            type="button"
                            onClick={() => alert('Forward message...')}
                            className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                            title="Forward"
                          >
                            <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                              <polyline points="15 14 20 9 15 4" />
                              <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Message Body Content (Clean, natural text flow) */}
                    <div className="text-xs text-gray-800 leading-relaxed font-sans pr-4">
                      <div
                        className="rich-content"
                        dangerouslySetInnerHTML={{ __html: renderHtmlContent(msg.body) }}
                      />

                      {/* Attachments */}
                      {(attachments[msg.id] || []).length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {(attachments[msg.id] || []).map((a: any) => (
                            <a
                              key={a.id}
                              href={a._url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-50 border border-gray-200 rounded text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                              <span>{a.file_name}</span>
                              <span className="text-gray-400 text-[10px]">({(a.file_size / 1024).toFixed(0)} KB)</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* FRESHDESK COMPOSER (Matching Image 2 rounded card with Reply / Note pills & paper airplane) */}
          {canReply && (
            <div ref={replyBoxRef} className="flex items-start gap-3.5 pt-2">
              {/* User Avatar Circle */}
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                {profile?.first_name ? profile.first_name[0] : 'S'}
              </div>

              {/* Composer Box */}
              <div className="flex-1 border border-blue-200 rounded-xl bg-white p-3.5 shadow-2xs space-y-3">
                {/* Pill Tab Switcher: Reply / Note */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveReplyTab('reply')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      activeReplyTab === 'reply'
                        ? 'bg-blue-50 text-[#186ade] border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Reply</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveReplyTab('note')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      activeReplyTab === 'note'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Note</span>
                  </button>
                </div>

                {activeReplyTab === 'note' && (
                  <div className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-100">
                    This note is private and visible only to agents.
                  </div>
                )}

                {/* Textarea Area */}
                <div className="relative">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your response here..."
                    rows={3}
                    className="w-full text-xs text-gray-800 placeholder-gray-400 focus:outline-none resize-y border-none p-1"
                  />

                  {/* Send Button at bottom right with paper airplane */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSendReply}
                      disabled={!reply.trim() || sending}
                      className="w-8 h-8 rounded-lg bg-[#5c9df5] hover:bg-[#3d85ea] text-white flex items-center justify-center transition-colors disabled:opacity-40 shadow-xs"
                      title="Send Response"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* COLUMN 3: RIGHT PROPERTIES & SLA SIDEBAR (Matching Image 2) */}
        <aside className="w-72 border-l border-gray-200 bg-white flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Top Status & SLA Section (Matching Image 2) */}
            <div className="border-b border-gray-200 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">
                  {propStatus === 'OPEN' ? 'Open' : propStatus}
                </span>
                <button className="text-gray-400 hover:text-gray-600 p-0.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* SLA Due Dates */}
              <div className="space-y-2 text-xs">
                {/* First response due */}
                <div className="flex items-start gap-2 text-gray-600">
                  <Clock className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-gray-600 font-medium">
                      First response due in <span className="font-semibold text-gray-900">17 hours</span>
                    </p>
                    <p className="text-[10px] text-gray-400">Wed 23 Sep 2026, 09:01 am</p>
                  </div>
                </div>

                {/* Resolution due */}
                <div className="flex items-start justify-between gap-1 text-gray-600 pt-1">
                  <div className="flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-gray-600 font-medium">
                        Resolution due in <span className="font-semibold text-gray-900">6 days</span>
                      </p>
                      <p className="text-[10px] text-gray-400">Mon 28 Sep 2026, 12:01 pm</p>
                    </div>
                  </div>

                  <button className="text-blue-500 hover:text-blue-700 p-1" title="Edit SLA">
                    <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Section: PROPERTIES Header */}
            <div>
              <h2 className="text-[11px] font-bold tracking-wider text-gray-500 uppercase mb-3">
                Properties
              </h2>

              <div className="space-y-3.5">
                {/* Tags */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Tags</label>
                  <input
                    type="text"
                    value={propTags}
                    onChange={(e) => setPropTags(e.target.value)}
                    placeholder="Search tags to add"
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Type */}
                <div className="space-y-1 relative">
                  <label className="text-xs font-semibold text-gray-700">Type</label>
                  <div
                    onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 border rounded-md text-xs cursor-pointer transition-all bg-white ${
                      showTypeDropdown ? 'border-[#2c7be5] ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className={propType ? 'font-medium text-gray-900' : 'text-gray-500'}>
                      {types.find(t => t.id === propType)?.name || propType || 'Problem'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
                  </div>

                  {showTypeDropdown && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setShowTypeDropdown(false)} />
                      <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-md shadow-xl py-1 max-h-48 overflow-y-auto">
                        {types.map((t) => {
                          const isSelected = propType === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setPropType(t.id);
                                setShowTypeDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                                isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <span>{t.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#2c7be5]" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Status * */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={propStatus}
                    onChange={(e) => setPropStatus(e.target.value as TicketStatus)}
                    className="w-full bg-white border border-gray-200 text-xs rounded-md px-3 py-1.5 text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="OPEN">Open</option>
                    <option value="PENDING">Pending</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                    <option value="WAITING_FOR_CUSTOMER">Waiting on Customer</option>
                    <option value="WAITING_FOR_THIRD_PARTY">Waiting on Third Party</option>
                  </select>
                </div>

                {/* Priority with colored dot */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Priority</label>
                  <div className="relative flex items-center">
                    <span
                      className={`absolute left-3 w-2 h-2 rounded-full pointer-events-none ${
                        PRIORITY_CONFIG[propPriority]?.dotColor || 'bg-blue-500'
                      }`}
                    />
                    <select
                      value={propPriority}
                      onChange={(e) => setPropPriority(e.target.value as TicketPriority)}
                      className="w-full bg-white border border-gray-200 text-xs rounded-md pl-7 pr-3 py-1.5 text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="P4">Low</option>
                      <option value="P3">Medium</option>
                      <option value="P2">High</option>
                      <option value="P1">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Group */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Group</label>
                  <select
                    value={propGroup}
                    disabled={teams.length === 0}
                    onChange={(e) => setPropGroup(e.target.value)}
                    className={`w-full text-xs rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                      teams.length === 0
                        ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed select-none'
                        : 'bg-white border border-gray-200 text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500'
                    }`}
                  >
                    <option value="">{teams.length === 0 ? 'No groups found' : '-- Select Group --'}</option>
                    {teams.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                {/* Agent + "+ Add Agent" button */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Agent</label>
                  <select
                    value={propAgent}
                    onChange={(e) => setPropAgent(e.target.value)}
                    className="w-full bg-white border border-gray-200 text-xs rounded-md px-3 py-1.5 text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">-- / Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {fullName(a.first_name, a.last_name)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => navigate('/admin/agents')}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#186ade] hover:underline pt-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Agent</span>
                  </button>
                </div>

                {/* Product */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Product</label>
                  <select
                    value={propProduct}
                    onChange={(e) => setPropProduct(e.target.value)}
                    className="w-full bg-white border border-gray-200 text-xs rounded-md px-3 py-1.5 text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="Example">Example</option>
                    <option value="AIV Analytics">AIV Analytics</option>
                    <option value="AIV Enterprise">AIV Enterprise</option>
                    <option value="AIV Cloud Hub">AIV Cloud Hub</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Full-Width Blue Update Button (Matching Image 2) */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <button
              onClick={handleUpdateProperties}
              disabled={updatingProperties}
              className="w-full py-2 px-4 bg-[#5c9df5] hover:bg-[#3d85ea] text-white font-semibold text-xs rounded-md shadow-2xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {updatingProperties ? (
                <>
                  <Spinner size="xs" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update</span>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* FRESHDESK "EDIT TICKET" MODAL (Matching Image 2) */}
      {showEditTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button top right */}
            <button
              type="button"
              onClick={() => setShowEditTicketModal(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="px-7 pt-6 pb-2">
              <div className="flex items-center gap-2.5 text-[#12344d]">
                <div className="text-gray-700">
                  <svg className="w-5 h-5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[#12344d] tracking-tight">Edit ticket</h2>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-7 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Field 1: Contact * */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">
                    Contact <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/users')}
                    className="text-xs font-medium text-[#186ade] hover:underline"
                  >
                    Add new contact
                  </button>
                </div>

                <select
                  value={editContactId}
                  onChange={(e) => setEditContactId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white cursor-pointer"
                >
                  {allContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {fullName(c.first_name, c.last_name)} &lt;{c.email}&gt;
                    </option>
                  ))}
                  {allContacts.length === 0 && (
                    <option value={ticket.created_by_user_id || 'contact-default'}>
                      {requesterDisplayName} &lt;sejal@aivhub.com&gt;
                    </option>
                  )}
                </select>
              </div>

              {/* Field 2: Subject * */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="Enter ticket subject"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-md text-sm text-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-medium"
                />
              </div>

              {/* Field 3: Description * */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  Description <span className="text-red-500">*</span>
                </label>
                <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Provide detailed description..."
                    rows={6}
                    className="w-full p-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none resize-y"
                  />

                  {/* Formatting toolbar footer */}
                  <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 flex items-center justify-between text-gray-500 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-bold cursor-pointer hover:text-gray-800">B</span>
                      <span className="italic cursor-pointer hover:text-gray-800 font-serif">I</span>
                      <span className="underline cursor-pointer hover:text-gray-800">U</span>
                      <span className="cursor-pointer hover:text-gray-800 font-semibold">H₁</span>
                      <span className="cursor-pointer hover:text-gray-800 font-semibold">H₂</span>
                      <span className="cursor-pointer hover:text-gray-800">A̲</span>
                      <span className="cursor-pointer hover:text-gray-800">≡</span>
                      <span className="cursor-pointer hover:text-gray-800">⋮≡</span>
                      <Paperclip className="w-3.5 h-3.5 cursor-pointer hover:text-gray-800" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-7 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditTicketModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveEditTicket}
                disabled={savingEdit || !editSubject.trim()}
                className="px-5 py-2 bg-[#2c7be5] hover:bg-[#1a68d1] text-white text-xs font-bold rounded-md shadow-2xs transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingEdit ? (
                  <>
                    <Spinner size="xs" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

