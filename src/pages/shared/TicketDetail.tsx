import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardBody, CardHeader, Spinner, Button, EmptyState, Select } from '@/components/ui';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { PriorityBadge, StatusBadge, Avatar } from '@/components/ui/Badges';
import {
  formatRelativeTime, formatDateTime, getSlaStatus, fullName,
  STATUS_LABELS, IMPACT_LABELS, URGENCY_LABELS, PRIORITY_LABELS,
} from '@/lib/constants';
import type {
  Ticket, TicketMessage, TicketMessageWithAuthor,
  TicketSlaSnapshot, TicketStatusHistory, Profile,
  TicketStatus, TicketPriority, SupportTeam,
} from '@/types';
import {
  ArrowLeft, Send, Clock, CheckCircle, RotateCcw, XCircle,
  AlertCircle, MessageSquare, Lock, User, Tag, Building2, History,
  Paperclip, Download,
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
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [replyFiles, setReplyFiles] = useState<UploadedFile[]>([]);
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newStatus, setNewStatus] = useState<TicketStatus>('OPEN');
  const [newPriority, setNewPriority] = useState<TicketPriority>('P3');
  const [newAivPriority, setNewAivPriority] = useState<TicketPriority>('P3');
  const [newTeam, setNewTeam] = useState('');
  const [newAgent, setNewAgent] = useState('');
  const [agents, setAgents] = useState<Profile[]>([]);

  const isStaff = profile?.user_type && ['agent', 'manager', 'account_manager', 'admin'].includes(profile.user_type);
  const isCustomer = profile?.user_type && ['customer_user', 'customer_admin'].includes(profile.user_type);

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);

    let ticketData: Ticket | null = null;
    try {
      let query = supabase.from('tickets').select('*');
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
        const match = localCustoms.find((t) => t.id === ticketId);
        if (match) ticketData = match;
      } catch (e) {}
    }

    if (!ticketData) {
      ticketData = DEMO_TICKETS_MAP[ticketId] || null;
    }

    if (!ticketData) { setLoading(false); return; }
    setTicket(ticketData as Ticket);
    setNewStatus(ticketData.status as TicketStatus);
    setNewPriority(ticketData.priority as TicketPriority);
    setNewAivPriority((ticketData.aiv_priority || ticketData.priority) as TicketPriority);
    setNewTeam(ticketData.assigned_team_id || '');

    try {
      const { data: msgData } = await supabase
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
      const { data: attachData } = await supabase
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', ticketData.id);
      if (attachData) {
        const map: Record<string, Attachment[]> = {};
        const publicUrlMap: Record<string, string> = {};
        for (const a of attachData) {
          const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(a.storage_path);
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
      const { data: slaData } = await supabase
        .from('ticket_sla_snapshots')
        .select('*')
        .eq('ticket_id', ticketData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (slaData) setSlaSnapshot(slaData as TicketSlaSnapshot);
    } catch (e) {}

    try {
      const { data: histData } = await supabase
        .from('ticket_status_history')
        .select('*')
        .eq('ticket_id', ticketData.id)
        .order('created_at', { ascending: false });
      if (histData) setStatusHistory(histData as TicketStatusHistory[]);
    } catch (e) {}

    const userIds = new Set<string>();
    userIds.add(ticketData.created_by_user_id);
    if (ticketData.assigned_agent_id) userIds.add(ticketData.assigned_agent_id);

    if (userIds.size > 0) {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', Array.from(userIds));
        if (profileData) {
          const map: Record<string, Profile> = {};
          profileData.forEach((p) => { map[p.id] = p as Profile; });
          setProfiles(map);
        }
      } catch (e) {}
    }

    try {
      const { data: teamData } = await supabase.from('support_teams').select('*').eq('is_active', true).order('name');
      if (teamData) setTeams(teamData as SupportTeam[]);
    } catch (e) {}

    setLoading(false);
  }, [ticketId, isStaff]);


  useEffect(() => { loadTicket(); }, [loadTicket]);

  const handleSendReply = async () => {
    if (!reply.trim() || !ticket || !profile) return;
    setSending(true);

    const messageType = isStaff ? (isInternal ? 'internal_note' : 'public_reply') : 'customer_message';

    const localNewMsg: TicketMessageWithAuthor = {
      id: `msg-${Date.now()}`,
      ticket_id: ticket.id,
      author_user_id: profile.id,
      message_type: messageType,
      body: reply,
      is_internal: isInternal && !!isStaff,
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
      await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          author_user_id: profile.id,
          message_type: messageType,
          body: reply,
          is_internal: isInternal && !!isStaff,
        });
    } catch (e) {}


    if (isCustomer && ticket) {
      if (ticket.status === 'WAITING_FOR_CUSTOMER') {
        await supabase.from('tickets').update({ status: 'OPEN', updated_at: new Date().toISOString() }).eq('id', ticket.id);
        await supabase.from('ticket_status_history').insert({
          ticket_id: ticket.id,
          from_status: ticket.status,
          to_status: 'OPEN',
          changed_by_user_id: profile.id,
          reason: 'Customer replied',
        });
        setTicket({ ...ticket, status: 'OPEN' });
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

    if (isStaff && !isInternal && ticket) {
      if (!ticket.first_human_response_at) {
        await supabase.from('tickets').update({
          first_human_response_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', ticket.id);
        await supabase.from('ticket_sla_events').insert({
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

  const handleStatusChange = async () => {
    if (!ticket || !profile || newStatus === ticket.status) return;
    await supabase.from('tickets').update({
      status: newStatus,
      resolved_at: newStatus === 'RESOLVED' ? new Date().toISOString() : ticket.resolved_at,
      closed_at: newStatus === 'CLOSED' ? new Date().toISOString() : ticket.closed_at,
      updated_at: new Date().toISOString(),
    }).eq('id', ticket.id);

    await supabase.from('ticket_status_history').insert({
      ticket_id: ticket.id,
      from_status: ticket.status,
      to_status: newStatus,
      changed_by_user_id: profile.id,
    });

    if (newStatus === 'RESOLVED') {
      await supabase.from('ticket_sla_events').insert({
        ticket_id: ticket.id,
        event_type: 'RESOLVED',
        actor_user_id: profile.id,
      });
    }

    // Trigger Status Update Email & CSAT Survey Notifications
    sendTicketStatusNotification(
      { ticket_number: ticket.ticket_number, subject: ticket.subject, status: newStatus },
      { email: creator?.email || 'customer@acme.com', name: creator ? `${creator.first_name} ${creator.last_name}` : 'Customer' }
    );

    if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
      sendCsatSurveyNotification(
        { ticket_number: ticket.ticket_number, subject: ticket.subject },
        { email: creator?.email || 'customer@acme.com', name: creator ? `${creator.first_name} ${creator.last_name}` : 'Customer' }
      );
    }

    setTicket({ ...ticket, status: newStatus });
    loadTicket();
  };

  const handlePriorityChange = async () => {
    if (!ticket || !profile || newPriority === ticket.priority) return;
    await supabase.from('tickets').update({
      priority: newPriority,
      customer_priority: newPriority,
      updated_at: new Date().toISOString(),
    }).eq('id', ticket.id);
    setTicket({ ...ticket, priority: newPriority, customer_priority: newPriority });
  };

  const handleAivPriorityChange = async () => {
    if (!ticket || !profile || newAivPriority === (ticket.aiv_priority || ticket.priority)) return;
    await supabase.from('tickets').update({
      aiv_priority: newAivPriority,
      priority: newAivPriority,
      updated_at: new Date().toISOString(),
    }).eq('id', ticket.id);
    setTicket({ ...ticket, aiv_priority: newAivPriority, priority: newAivPriority });
  };

  const handleAssignmentChange = async () => {
    if (!ticket || !profile) return;
    const updates: any = { updated_at: new Date().toISOString() };
    if (newTeam !== (ticket.assigned_team_id || '')) updates.assigned_team_id = newTeam || null;
    if (newAgent !== (ticket.assigned_agent_id || '')) updates.assigned_agent_id = newAgent || null;

    await supabase.from('tickets').update(updates).eq('id', ticket.id);

    await supabase.from('ticket_assignment_history').insert({
      ticket_id: ticket.id,
      from_agent_id: ticket.assigned_agent_id,
      to_agent_id: newAgent || null,
      from_team_id: ticket.assigned_team_id,
      to_team_id: newTeam || null,
      changed_by_user_id: profile.id,
    });

    if (newAgent) {
      const targetAgent = profiles[newAgent] || getStoredAgents().find((a) => a.id === newAgent);
      if (targetAgent) {
        sendAgentTicketAssignmentNotification(
          { ticket_number: ticket.ticket_number, subject: ticket.subject, priority: ticket.priority, description: ticket.description },
          { email: targetAgent.email, name: `${targetAgent.first_name} ${targetAgent.last_name}` }
        );
      }
    }

    setTicket({ ...ticket, assigned_team_id: newTeam || null, assigned_agent_id: newAgent || null });
  };

  if (loading) return <Spinner label="Loading ticket..." />;
  if (!ticket) return <EmptyState title="Ticket not found" description="This ticket may have been deleted or you may not have access." />;
  if (!profile) return null;

  const creator = profiles[ticket.created_by_user_id];
  const assignedAgent = ticket.assigned_agent_id ? profiles[ticket.assigned_agent_id] : null;
  const slaFirstResponse = getSlaStatus(slaSnapshot?.first_response_due_at ?? null, ticket.first_response_breached);
  const slaResolution = getSlaStatus(slaSnapshot?.resolution_due_at ?? null, false);

  const canReply = !['CLOSED', 'CANCELLED'].includes(ticket.status);
  const customerCanReopen = isCustomer && ticket.status === 'RESOLVED';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-sm font-mono text-blue-600 font-medium">{ticket.ticket_number}</span>
              <PriorityBadge priority={ticket.customer_priority || ticket.priority} label="Customer" />
              <PriorityBadge priority={ticket.aiv_priority || ticket.priority} label="AIV" />
              <StatusBadge status={ticket.status} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
            <p className="text-sm text-gray-500 mt-1">Created {formatRelativeTime(ticket.created_at)} by {creator ? fullName(creator.first_name, creator.last_name) : 'Unknown'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Conversation */}
        <div className="lg:col-span-2 space-y-5">
          {/* SLA bar */}
          {slaSnapshot && (
            <Card>
              <CardBody className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">First Response</p>
                    <p className={`text-sm font-semibold ${slaFirstResponse.color}`}>{slaFirstResponse.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Resolution</p>
                    <p className={`text-sm font-semibold ${slaResolution.color}`}>{slaResolution.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">SLA Plan</p>
                    <p className="text-sm font-semibold text-gray-700">{slaSnapshot.support_plan_code}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Messages */}
          <Card>
            <CardHeader title="Conversation" subtitle={`${messages.length} message${messages.length !== 1 ? 's' : ''}`} />
            <div className="p-5 space-y-4 max-h-[600px] overflow-y-auto">
              {messages.length === 0 ? (
                <EmptyState icon={<MessageSquare className="w-10 h-10" />} title="No messages yet" description="Start the conversation by sending a message below." />
              ) : (
                messages.map((msg) => {
                  const author = msg.author || (msg.author_user_id ? profiles[msg.author_user_id] : null);
                  const isOwn = msg.author_user_id === profile.id;
                  const isInternalMsg = msg.is_internal;
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      {author ? (
                        <Avatar firstName={author.first_name} lastName={author.last_name} size="sm" />
                      ) : (
                        <div className="w-7 h-7 bg-gray-300 rounded-full flex items-center justify-center text-xs text-white font-semibold">SY</div>
                      )}
                      <div className={`flex-1 min-w-0 ${isOwn ? 'text-right' : ''}`}>
                        <div className={`inline-block max-w-full ${isOwn ? 'text-left' : ''}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {author ? fullName(author.first_name, author.last_name) : 'System'}
                            </span>
                            <span className="text-xs text-gray-400">{formatRelativeTime(msg.created_at)}</span>
                            {isInternalMsg && (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                <Lock className="w-3 h-3" /> Internal
                              </span>
                            )}
                          </div>
                          <div className={`inline-block px-3.5 py-2.5 rounded-xl text-sm max-w-full ${
                            isInternalMsg ? 'bg-amber-50 border border-amber-200 text-amber-900'
                            : isOwn ? 'bg-blue-600 text-white'
                            : msg.message_type === 'customer_message' ? 'bg-gray-100 text-gray-900'
                            : 'bg-white border border-gray-200 text-gray-900'
                          }`}>
                            <div className="rich-content" dangerouslySetInnerHTML={{ __html: renderHtmlContent(msg.body) }} />
                          </div>
                          {(attachments[msg.id] || []).length > 0 && (
                            <div className="mt-1.5 space-y-1">
                              {(attachments[msg.id] || []).map((a: any) => (
                                <a key={a.id} href={a._url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${isOwn ? 'bg-blue-500/20 border-blue-400 text-white' : 'bg-gray-50 border-gray-200 text-gray-600'} hover:opacity-80`}>
                                  <Paperclip className="w-3 h-3" /> {a.file_name}
                                  <span className="opacity-60">({(a.file_size / 1024).toFixed(0)} KB)</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply box */}
            {canReply && (
              <div className="border-t border-gray-100 p-4">
                {isStaff && (
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={!isInternal}
                        onChange={() => setIsInternal(false)}
                        className="text-blue-600"
                      />
                      <span className="text-gray-700">Public Reply</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={isInternal}
                        onChange={() => setIsInternal(true)}
                        className="text-blue-600"
                      />
                      <span className="text-gray-700">Internal Note</span>
                    </label>
                  </div>
                )}
                <RichTextEditor
                  value={reply}
                  onChange={setReply}
                  placeholder={isInternal ? "Add an internal note (visible to staff only)..." : "Type your reply..."}
                  minHeight={100}
                  userId={profile?.id}
                  files={replyFiles}
                  onFilesChange={setReplyFiles}
                />
                <div className="flex justify-end mt-3">
                  <Button onClick={handleSendReply} disabled={!reply.trim() || sending}>
                    <Send className="w-4 h-4" /> {sending ? 'Sending...' : isInternal ? 'Add Note' : 'Send Reply'}
                  </Button>
                </div>
              </div>
            )}

            {customerCanReopen && (
              <div className="border-t border-gray-100 p-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">Is this not resolved? You can reopen this ticket.</p>
                <Button variant="outline" onClick={async () => {
                  await supabase.from('tickets').update({ status: 'OPEN', resolved_at: null, updated_at: new Date().toISOString() }).eq('id', ticket.id);
                  await supabase.from('ticket_status_history').insert({
                    ticket_id: ticket.id, from_status: 'RESOLVED', to_status: 'OPEN',
                    changed_by_user_id: profile.id, reason: 'Customer reopened ticket',
                  });
                  setTicket({ ...ticket, status: 'OPEN' });
                  loadTicket();
                }}>
                  <RotateCcw className="w-4 h-4" /> Reopen Ticket
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Ticket info */}
          <Card>
            <CardHeader title="Ticket Details" />
            <CardBody className="space-y-3">
              <InfoRow icon={Building2} label="Account" value={creator ? profiles[ticket.created_by_user_id]?.email || '—' : '—'} />
              <InfoRow icon={User} label="Created By" value={creator ? fullName(creator.first_name, creator.last_name) : '—'} />
              <InfoRow icon={User} label="Assigned Agent" value={assignedAgent ? fullName(assignedAgent.first_name, assignedAgent.last_name) : 'Unassigned'} />
              <InfoRow icon={Clock} label="Created" value={formatDateTime(ticket.created_at)} />
              {ticket.resolved_at && <InfoRow icon={CheckCircle} label="Resolved" value={formatDateTime(ticket.resolved_at)} />}
              {ticket.closed_at && <InfoRow icon={XCircle} label="Closed" value={formatDateTime(ticket.closed_at)} />}
              <InfoRow icon={AlertCircle} label="Customer Priority" value={`${ticket.customer_priority || ticket.priority} - ${PRIORITY_LABELS[ticket.customer_priority || ticket.priority]}`} />
              <InfoRow icon={AlertCircle} label="AIV Priority" value={`${ticket.aiv_priority || ticket.priority} - ${PRIORITY_LABELS[ticket.aiv_priority || ticket.priority]}`} />
              {ticket.impact && <InfoRow icon={AlertCircle} label="Impact" value={IMPACT_LABELS[ticket.impact] || ticket.impact} />}
              {ticket.urgency && <InfoRow icon={AlertCircle} label="Urgency" value={URGENCY_LABELS[ticket.urgency] || ticket.urgency} />}
              {ticket.environment && <InfoRow icon={Tag} label="Environment" value={ticket.environment} />}
              {ticket.aiv_version && <InfoRow icon={Tag} label="AIV Version" value={ticket.aiv_version} />}
            </CardBody>
          </Card>

          {/* Staff controls */}
          {isStaff && (
            <Card>
              <CardHeader title="Agent Controls" />
              <CardBody className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                  <div className="flex gap-2">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white"
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <Button size="sm" onClick={handleStatusChange} disabled={newStatus === ticket.status}>Update</Button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Customer Priority</label>
                  <div className="flex gap-2">
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white"
                    >
                      <option value="P1">P1 - Critical</option>
                      <option value="P2">P2 - High</option>
                      <option value="P3">P3 - Medium</option>
                      <option value="P4">P4 - Low</option>
                    </select>
                    <Button size="sm" onClick={handlePriorityChange} disabled={newPriority === (ticket.customer_priority || ticket.priority)}>Update</Button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">AIV Priority</label>
                  <div className="flex gap-2">
                    <select
                      value={newAivPriority}
                      onChange={(e) => setNewAivPriority(e.target.value as TicketPriority)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white"
                    >
                      <option value="P1">P1 - Critical</option>
                      <option value="P2">P2 - High</option>
                      <option value="P3">P3 - Medium</option>
                      <option value="P4">P4 - Low</option>
                    </select>
                    <Button size="sm" onClick={handleAivPriorityChange} disabled={newAivPriority === (ticket.aiv_priority || ticket.priority)}>Update</Button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Assigned Team</label>
                  <select
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white mb-2"
                  >
                    <option value="">Unassigned</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Assigned Agent</label>
                  <select
                    value={newAgent}
                    onChange={(e) => setNewAgent(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white mb-2"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{fullName(a.first_name, a.last_name)}</option>)}
                  </select>
                </div>
                <Button size="sm" variant="secondary" onClick={handleAssignmentChange} className="w-full">Update Assignment</Button>
              </CardBody>
            </Card>
          )}

          {/* Status history */}
          <Card>
            <CardHeader
              title="Status History"
              action={
                <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-blue-600 hover:underline">
                  {showHistory ? 'Hide' : 'Show'}
                </button>
              }
            />
            {showHistory && (
              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                {statusHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No history available.</p>
                ) : (
                  statusHistory.map((h) => {
                    const actor = profiles[h.changed_by_user_id];
                    return (
                      <div key={h.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                          {statusHistory.indexOf(h) < statusHistory.length - 1 && <div className="w-0.5 flex-1 bg-gray-200" />}
                        </div>
                        <div className="pb-2">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{STATUS_LABELS[h.to_status as TicketStatus] || h.to_status}</span>
                            {h.from_status && <span className="text-gray-500"> from {STATUS_LABELS[h.from_status as TicketStatus] || h.from_status}</span>}
                          </p>
                          {h.reason && <p className="text-xs text-gray-500 mt-0.5">{h.reason}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatRelativeTime(h.created_at)} by {actor ? fullName(actor.first_name, actor.last_name) : '—'}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-900 break-words">{value}</p>
      </div>
    </div>
  );
}
