import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardBody, Button, Input, Select } from '@/components/ui';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import type { TicketType, TicketCategory, TicketPriority, Account, Profile, TicketWithRelations, SupportTeam } from '@/types';
import { ArrowLeft, Send, BookOpen, User, BarChart2, Bot, ChevronDown, X, Plus, Trash2, Settings as SettingsIcon, Ticket, Mail, Phone, Copy, ExternalLink, CheckCircle2, Check } from 'lucide-react';
import { sendTicketAcknowledgement } from '@/lib/emailService';
import { getStoredAgents } from '@/lib/agentRoleService';

interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  path: string;
}

const ENVIRONMENTS = ['Production', 'UAT', 'Test', 'Development', 'Other'];

const DEMO_ACCOUNTS: Account[] = [
  { id: 'acc-1', account_code: 'ACME001', company_name: 'Acme Corp', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-1', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: 'team-1', account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'acc-2', account_code: 'GLOB001', company_name: 'Globex Inc', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-2', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: 'team-2', account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'acc-3', account_code: 'INIT001', company_name: 'Initech', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-3', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: 'team-3', account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const DEMO_TYPES: TicketType[] = [
  { id: 'type-question', name: 'Question', is_active: true, sort_order: 1 },
  { id: 'type-incident', name: 'Incident', is_active: true, sort_order: 2 },
  { id: 'type-problem', name: 'Problem', is_active: true, sort_order: 3 },
  { id: 'type-feature-request', name: 'Feature Request', is_active: true, sort_order: 4 },
  { id: 'type-refund', name: 'Refund', is_active: true, sort_order: 5 },
];

const DEMO_CATEGORIES: TicketCategory[] = [
  { id: 'cat-1', name: 'Software', is_active: true, sort_order: 1 },
  { id: 'cat-2', name: 'Hardware', is_active: true, sort_order: 2 },
  { id: 'cat-3', name: 'Network', is_active: true, sort_order: 3 },
  { id: 'cat-4', name: 'Access', is_active: true, sort_order: 4 },
  { id: 'cat-5', name: 'Billing', is_active: true, sort_order: 5 },
  { id: 'cat-6', name: 'Other', is_active: true, sort_order: 6 },
];

const DEMO_USERS: Record<string, Profile[]> = {
  'acc-1': [
    { id: 'user-1', email: 'john.smith@acme.com', auth_uid: null, first_name: 'John', last_name: 'Smith', user_type: 'customer_user', account_id: 'acc-1', status: 'active', phone: null, mobile: null, job_title: 'IT Lead', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'user-2', email: 'bob@acme.com', auth_uid: null, first_name: 'Bob', last_name: 'Jones', user_type: 'customer_user', account_id: 'acc-1', status: 'active', phone: null, mobile: null, job_title: 'Developer', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ],
  'acc-2': [
    { id: 'user-3', email: 'alice@globex.com', auth_uid: null, first_name: 'Alice', last_name: 'Johnson', user_type: 'customer_admin', account_id: 'acc-2', status: 'active', phone: null, mobile: null, job_title: 'VP Tech', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ],
  'acc-3': [
    { id: 'user-4', email: 'peter@initech.com', auth_uid: null, first_name: 'Peter', last_name: 'Gibbons', user_type: 'customer_user', account_id: 'acc-3', status: 'active', phone: null, mobile: null, job_title: 'Engineer', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ],
};

export function AgentCreateTicket() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [types, setTypes] = useState<TicketType[]>(DEMO_TYPES);
  const [categories, setCategories] = useState<TicketCategory[]>(DEMO_CATEGORIES);
  const [accounts, setAccounts] = useState<Account[]>(DEMO_ACCOUNTS);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drawer state
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactFirst, setNewContactFirst] = useState('');
  const [newContactLast, setNewContactLast] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactTitle, setNewContactTitle] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [showContactToast, setShowContactToast] = useState(false);

  const handleCreateContactMock = async () => {
    try {
      // Default to the first account if none is selected, to mimic existing app logic
      const targetAccountId = accountId || (accounts.length > 0 ? accounts[0].id : null);
      const nameParts = (newContactFirst || 'New Contact').trim().split(' ');
      const fName = nameParts[0] || 'New';
      const lName = nameParts.slice(1).join(' ') || '';

      const newId = `user-${Date.now()}`;
      const newProfile: Profile = {
        id: newId,
        email: newContactEmail.trim() || 'new@example.com',
        auth_uid: null,
        first_name: fName,
        last_name: lName,
        user_type: 'customer_user',
        account_id: targetAccountId,
        status: 'active',
        phone: newContactPhone.trim() || null,
        mobile: newContactPhone.trim() || null,
        job_title: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Save to local_custom_users immediately for instant persistence
      try {
        const customUsers = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
        const updatedCustom = [newProfile, ...customUsers.filter((u: any) => u.id !== newProfile.id && u.email !== newProfile.email)];
        localStorage.setItem('local_custom_users', JSON.stringify(updatedCustom));
      } catch (err) { }

      // 2. Persist to PostgreSQL via API/PostgreSQL bridge
      try {
        await dbClient.from('profiles').insert({
          id: newProfile.id,
          email: newProfile.email,
          auth_uid: null,
          first_name: newProfile.first_name,
          last_name: newProfile.last_name,
          user_type: newProfile.user_type,
          account_id: newProfile.account_id,
          status: 'active',
          phone: newProfile.phone,
          mobile: newProfile.mobile,
          job_title: null,
        });
      } catch (err) {
        console.warn("DB insert notice:", err);
      }

      setUsers(prev => [newProfile, ...prev.filter(u => u.id !== newProfile.id)]);
      setCreatedBy(newProfile.id);
      if (newProfile.account_id) {
        setAccountId(newProfile.account_id);
      }
      setContactSearchTerm('');
      setShowAddContact(false);
      setShowContactToast(true);
      setTimeout(() => setShowContactToast(false), 3500);
      setNewContactFirst('');
      setNewContactEmail('');
      setNewContactPhone('');
    } catch (e) {
      console.error("Exception creating contact:", e);
    }
  };

  const [accountId, setAccountId] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('P3');
  const [aivPriority, setAivPriority] = useState<TicketPriority>('P3');
  const [ticketType, setTicketType] = useState('');
  const [category, setCategory] = useState('');
  const [environment, setEnvironment] = useState('Production');
  const [aivVersion, setAivVersion] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [teams, setTeams] = useState<SupportTeam[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [assignedTeamId, setAssignedTeamId] = useState('');
  const [assignedAgentId, setAssignedAgentId] = useState('');
  const [product, setProduct] = useState('Example');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [createAnother, setCreateAnother] = useState(false);
  const [ticketStatus, setTicketStatus] = useState('Open');
  const [ticketSource, setTicketSource] = useState('Phone');

  const loadContacts = async (filterAccountId?: string) => {
    let customUsers: Profile[] = [];
    try {
      customUsers = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
    } catch (e) { }

    let deletedUserIds: string[] = [];
    try {
      deletedUserIds = JSON.parse(localStorage.getItem('deleted_user_ids') || '[]');
    } catch (e) { }

    try {
      let query = dbClient.from('profiles').select('*').eq('status', 'active').order('first_name');
      if (filterAccountId) {
        query = query.eq('account_id', filterAccountId);
      }
      const { data } = await query;

      const filteredCustom = filterAccountId
        ? customUsers.filter(u => (!u.account_id || u.account_id === filterAccountId) && !deletedUserIds.includes(u.id))
        : customUsers.filter(u => !deletedUserIds.includes(u.id));

      const deduplicateProfiles = (list: Profile[]) => {
        const emailMap = new Map<string, Profile>();
        for (const u of list) {
          if (deletedUserIds.includes(u.id)) continue;
          const key = (u.email || '').trim().toLowerCase() || u.id;
          if (!emailMap.has(key)) {
            emailMap.set(key, u);
          }
        }
        return Array.from(emailMap.values());
      };

      if (data && data.length > 0) {
        setUsers(deduplicateProfiles([...filteredCustom, ...(data as Profile[])]));
      } else {
        const fallbackDemo = filterAccountId
          ? (DEMO_USERS[filterAccountId] || []).filter(u => !deletedUserIds.includes(u.id))
          : Object.values(DEMO_USERS).flat().filter(u => !deletedUserIds.includes(u.id));

        setUsers(deduplicateProfiles([...filteredCustom, ...fallbackDemo]));
      }
    } catch (err) {
      const fallbackDemo = filterAccountId
        ? (DEMO_USERS[filterAccountId] || []).filter(u => !deletedUserIds.includes(u.id))
        : Object.values(DEMO_USERS).flat().filter(u => !deletedUserIds.includes(u.id));
      const emailMap = new Map<string, Profile>();
      for (const u of [...customUsers, ...fallbackDemo]) {
        const key = (u.email || '').trim().toLowerCase() || u.id;
        if (!emailMap.has(key)) emailMap.set(key, u);
      }
      setUsers(Array.from(emailMap.values()));
    }
  };

  useEffect(() => {
    let customAccounts: Account[] = [];
    try {
      customAccounts = JSON.parse(localStorage.getItem('local_custom_accounts') || '[]');
    } catch (e) { }

    dbClient.from('ticket_types').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data && data.length > 0) setTypes(data as TicketType[]);
    });
    dbClient.from('ticket_categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data && data.length > 0) setCategories(data as TicketCategory[]);
    });
    dbClient.from('accounts').select('*').eq('status', 'ACTIVE').order('company_name').then(({ data }) => {
      if (data && data.length > 0) {
        setAccounts([...customAccounts, ...(data as Account[])]);
      } else {
        setAccounts([...customAccounts, ...DEMO_ACCOUNTS]);
      }
    });

    dbClient.from('support_teams').select('*').eq('is_active', true).order('name').then(({ data }) => {
      if (data && data.length > 0) {
        setTeams(data as SupportTeam[]);
      }
    });

    const syncAgents = async () => {
      let loaded: Profile[] = [];
      try {
        const { data } = await dbClient.from('profiles').select('*').in('user_type', ['agent', 'manager', 'account_manager', 'admin']).order('first_name');
        if (data && data.length > 0) {
          loaded = data as Profile[];
        }
      } catch (e) {}

      // Also merge custom stored agents
      const stored = getStoredAgents();
      const map = new Map<string, Profile>();
      loaded.forEach(p => map.set(p.id, p));
      stored.forEach(a => {
        if (!map.has(a.id)) {
          map.set(a.id, {
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
      setAgents(Array.from(map.values()));
    };

    syncAgents();

    if (profile?.id) {
      setAssignedAgentId(profile.id);
    }

    loadContacts();
  }, [profile?.id]);

  useEffect(() => {
    if (accountId) {
      loadContacts(accountId);
    }
  }, [accountId]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    let finalAccountId = accountId;
    if (!finalAccountId && createdBy) {
      const selectedUser = users.find(u => u.id === createdBy);
      if (selectedUser?.account_id) {
        finalAccountId = selectedUser.account_id;
      } else {
        finalAccountId = 'acc-1'; // fallback
      }
    }

    if (!finalAccountId || !createdBy || !subject.trim() || !description.trim()) {
      setError('Account, user, subject, and description are all required.');
      return;
    }

    setLoading(true);
    setError(null);

    // Construct ticket object for local persistence / fallback
    const selectedAcct = accounts.find((a) => a.id === accountId);
    const selectedUser = users.find((u) => u.id === createdBy);
    const selectedType = types.find((t) => t.id === ticketType);
    const selectedCat = categories.find((c) => c.id === category);

    let createdTicketId = '';
    let dbSuccess = false;

    try {
      const tagsArray = tagsInput.split(',').map(s => s.trim()).filter(Boolean);
      const { data: ticket, error } = await dbClient.from('tickets').insert({
        account_id: finalAccountId,
        created_by_user_id: createdBy,
        ticket_type_id: ticketType || null,
        category_id: category || null,
        subject: subject.trim(),
        description: description,
        priority: priority,
        customer_priority: priority,
        aiv_priority: priority,
        environment,
        aiv_version: aivVersion || null,
        status: ticketStatus.toUpperCase() as any,
        assigned_team_id: assignedTeamId || null,
        assigned_agent_id: assignedAgentId || profile.id,
        tags: tagsArray,
      }).select().single();

      if (!error && ticket) {
        dbSuccess = true;
        createdTicketId = ticket.id;

        const recipientEmail = selectedUser?.email || profile.email;
        const recipientName = selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : `${profile.first_name} ${profile.last_name}`;
        try {
          await sendTicketAcknowledgement(
            {
              ticket_number: ticket.ticket_number,
              subject: ticket.subject,
              description: description,
              priority: ticket.priority,
              created_at: ticket.created_at,
            },
            { email: recipientEmail, name: recipientName }
          );
        } catch (e) {
          console.warn('Could not send email acknowledgement:', e);
        }

        const { data: msgData } = await dbClient.from('ticket_messages').insert({
          ticket_id: ticket.id,
          author_user_id: createdBy,
          message_type: 'customer_message',
          body: description,
          is_internal: false,
        }).select().single();

        if (msgData && uploadedFiles.length > 0) {
          for (const file of uploadedFiles) {
            await dbClient.from('ticket_attachments').insert({
              ticket_id: ticket.id,
              message_id: msgData.id,
              uploaded_by_user_id: profile.id,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              storage_path: file.path,
              is_internal: false,
            });
          }
        }

        await dbClient.from('ticket_status_history').insert({
          ticket_id: ticket.id,
          from_status: null,
          to_status: 'OPEN',
          changed_by_user_id: profile.id,
          reason: 'Ticket created by agent',
        });

        if (selectedAcct?.support_plan_id) {
          const { data: sla } = await dbClient
            .from('sla_policies')
            .select('*, support_plans(code)')
            .eq('support_plan_id', selectedAcct.support_plan_id)
            .eq('priority', aivPriority)
            .eq('is_active', true)
            .maybeSingle();

          if (sla) {
            const now = new Date();
            const firstDue = new Date(now.getTime() + (sla.first_response_target_minutes || 60) * 60000);
            const resDue = new Date(now.getTime() + (sla.resolution_target_minutes || 240) * 60000);

            await dbClient.from('ticket_sla_snapshots').insert({
              ticket_id: ticket.id,
              support_plan_code: sla.support_plans?.code || 'STANDARD',
              priority: aivPriority,
              first_response_target_minutes: sla.first_response_target_minutes,
              resolution_target_minutes: sla.resolution_target_minutes,
              clock_type: sla.business_hours_only ? 'business' : 'calendar',
              first_response_due_at: firstDue.toISOString(),
              resolution_due_at: resDue.toISOString(),
            });
          }
        }
      }
    } catch (err) {
      console.warn('DB ticket insert error:', err);
    }

    if (!dbSuccess) {
      // Fallback
      createdTicketId = `ticket-${Date.now()}`;
      const ticketNum = `AIV-${String(Math.floor(100000 + Math.random() * 900000))}`;
      const tagsArray = tagsInput.split(',').map(s => s.trim()).filter(Boolean);

      const assignedAgentObj = agents.find(a => a.id === assignedAgentId) || profile;
      const assignedTeamObj = teams.find(t => t.id === assignedTeamId);

      const fallbackTicket: TicketWithRelations = {
        id: createdTicketId,
        ticket_number: ticketNum,
        account_id: finalAccountId,
        created_by_user_id: createdBy,
        ticket_type_id: ticketType || null,
        category_id: category || null,
        subject: subject.trim(),
        description: description,
        priority: priority,
        customer_priority: priority,
        aiv_priority: priority,
        impact: null,
        urgency: null,
        status: ticketStatus.toUpperCase() as any,
        environment,
        aiv_version: aivVersion || null,
        assigned_team_id: assignedTeamId || selectedAcct?.support_team_id || 'team-1',
        assigned_agent_id: assignedAgentId || profile.id,
        tags: tagsArray,
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        accounts: selectedAcct ? { id: selectedAcct.id, company_name: selectedAcct.company_name, account_code: selectedAcct.account_code } : undefined,
        created_by_user: selectedUser ? { id: selectedUser.id, first_name: selectedUser.first_name, last_name: selectedUser.last_name, email: selectedUser.email } : undefined,
        assigned_agent: assignedAgentObj ? { id: assignedAgentObj.id, first_name: assignedAgentObj.first_name, last_name: assignedAgentObj.last_name, email: assignedAgentObj.email } : undefined,
        assigned_team: assignedTeamObj ? { id: assignedTeamObj.id, name: assignedTeamObj.name } : undefined,
        ticket_types: selectedType ? { id: selectedType.id, name: selectedType.name } : undefined,
        ticket_categories: selectedCat ? { id: selectedCat.id, name: selectedCat.name } : undefined,
      };

      try {
        const existing: TicketWithRelations[] = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
        localStorage.setItem('local_custom_tickets', JSON.stringify([fallbackTicket, ...existing]));
      } catch (e) {
        console.error('Failed to save to local_custom_tickets', e);
      }

      const recipientEmail = selectedUser?.email || profile.email;
      const recipientName = selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : `${profile.first_name} ${profile.last_name}`;
      try {
        await sendTicketAcknowledgement(
          {
            ticket_number: ticketNum,
            subject: subject.trim(),
            description: description,
            priority: priority,
            created_at: fallbackTicket.created_at,
          },
          { email: recipientEmail, name: recipientName }
        );
      } catch (e) {
        console.warn('Could not send email acknowledgement:', e);
      }
    }

    setLoading(false);
    if (createAnother) {
      setSubject('');
      setDescription('');
      setReferenceNumber('');
      setTagsInput('');
      setUploadedFiles([]);
      setShowContactToast(true);
      setTimeout(() => setShowContactToast(false), 3000);
    } else {
      navigate(`/agent/tickets/${createdTicketId}`);
    }
  };

  return (
    <div className="flex w-full h-full bg-white relative overflow-hidden">
      {/* Toast */}
      {showContactToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-white px-4 py-2.5 rounded shadow-lg border-t-[3px] border-[#00b27b] min-w-[350px] animate-in slide-in-from-top-4 fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#00b27b]" />
          <span className="text-sm font-semibold text-gray-800 flex-1">Contact created</span>
          <button onClick={() => setShowContactToast(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* LEFT COLUMN: Form Area */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10 flex justify-center">
        <div className="w-full max-w-4xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="p-3 rounded bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}

            {/* Contact Field */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-500">
                Contact <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                {(() => {
                  const selectedUser = users.find(u => u.id === createdBy);
                  return (
                    <div
                      className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-sm bg-white cursor-text transition-all ${
                        isContactDropdownOpen
                          ? 'border-blue-600 ring-[3px] ring-blue-500/20'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => {
                        if (!isContactDropdownOpen) {
                          setContactSearchTerm('');
                          setIsContactDropdownOpen(true);
                        }
                      }}
                    >
                      {selectedUser && !isContactDropdownOpen ? (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-1.5 overflow-hidden">
                            <span className="font-medium text-gray-900 truncate">
                              {selectedUser.first_name} {selectedUser.last_name}
                            </span>
                            <span className="text-gray-500 text-xs truncate">
                              &lt;{selectedUser.email}&gt;
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreatedBy('');
                              setContactSearchTerm('');
                              setIsContactDropdownOpen(false);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors ml-2"
                            title="Clear contact"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <input
                            type="text"
                            autoFocus={isContactDropdownOpen}
                            className="w-full outline-none bg-transparent text-gray-900 placeholder-gray-400"
                            placeholder={selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : 'Search contacts...'}
                            value={contactSearchTerm}
                            onChange={(e) => {
                              setContactSearchTerm(e.target.value);
                              setIsContactDropdownOpen(true);
                            }}
                            onFocus={() => {
                              setIsContactDropdownOpen(true);
                            }}
                          />
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-1 ${isContactDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {isContactDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => {
                        setIsContactDropdownOpen(false);
                        // If nothing is selected yet and the search matches exactly 1 contact, auto-select it
                        if (!createdBy && contactSearchTerm.trim()) {
                          const matches = users.filter(u =>
                            (u.first_name + ' ' + u.last_name).toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
                            u.email.toLowerCase().includes(contactSearchTerm.toLowerCase())
                          );
                          if (matches.length === 1) {
                            setCreatedBy(matches[0].id);
                            if (matches[0].account_id) setAccountId(matches[0].account_id);
                          }
                        }
                      }}
                    />
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto py-1">
                      {users.filter(u =>
                        !contactSearchTerm.trim() ||
                        (u.first_name + ' ' + u.last_name).toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
                        u.email.toLowerCase().includes(contactSearchTerm.toLowerCase())
                      ).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-[#e6f0ff] focus:bg-[#e6f0ff] focus:outline-none rounded mx-1 mb-0.5 flex items-center justify-between ${
                            createdBy === u.id ? 'bg-blue-50 font-medium' : ''
                          }`}
                          style={{ width: 'calc(100% - 8px)' }}
                          onMouseDown={(e) => {
                            // onMouseDown fires before blur/clickaway
                            e.preventDefault();
                            setCreatedBy(u.id);
                            if (u.account_id) setAccountId(u.account_id);
                            setContactSearchTerm('');
                            setIsContactDropdownOpen(false);
                          }}
                        >
                          <div className="truncate">
                            <span className="font-medium text-gray-800">{u.first_name} {u.last_name}</span>
                            <span className="text-gray-500 ml-1.5 text-xs">&lt;{u.email}&gt;</span>
                          </div>
                          {createdBy === u.id && (
                            <span className="text-blue-600 text-xs ml-2 font-medium">Selected</span>
                          )}
                        </button>
                      ))}

                      {users.filter(u =>
                        !contactSearchTerm.trim() ||
                        (u.first_name + ' ' + u.last_name).toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
                        u.email.toLowerCase().includes(contactSearchTerm.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-3 text-sm text-gray-500 text-center">
                          No contacts found for "{contactSearchTerm}"
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end mt-1 text-xs text-blue-600">
                <button type="button" onClick={() => setShowAddContact(true)} className="hover:underline">Add new contact</button>
                <span className="mx-2 text-gray-300">|</span>
                <button type="button" className="hover:underline">Add Cc</button>
              </div>
            </div>

            {/* Subject Field */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-500">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              />
            </div>

            {/* Type Field */}
            <div className="space-y-1.5 relative">
              <label className="block text-xs text-gray-500">
                Type
              </label>
              <div
                onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-sm bg-white cursor-pointer transition-all ${isTypeDropdownOpen
                  ? 'border-[#2c7be5] ring-[3px] ring-blue-500/20'
                  : 'border-gray-300 hover:border-gray-400'
                  }`}
              >
                <span className={ticketType ? 'text-gray-800' : 'text-gray-400'}>
                  {types.find(t => t.id === ticketType)?.name || '--'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isTypeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsTypeDropdownOpen(false)} />
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setTicketType('');
                        setIsTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-sm transition-colors flex items-center justify-between ${ticketType === ''
                        ? 'bg-[#e9f2ff] text-[#12344d] font-semibold'
                        : 'text-gray-700 hover:bg-[#f3f7fe]'
                        }`}
                    >
                      <span>--</span>
                    </button>
                    {types.map((t) => {
                      const isSelected = ticketType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTicketType(t.id);
                            setIsTypeDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-sm transition-colors flex items-center justify-between ${isSelected
                            ? 'bg-[#e9f2ff] text-[#12344d] font-semibold'
                            : 'text-gray-700 hover:bg-[#f3f7fe]'
                            }`}
                        >
                          <span>{t.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-[#2c7be5]" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Source Field */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-500">
                Source
              </label>
              <select
                value={ticketSource}
                onChange={(e) => setTicketSource(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              >
                <option value="Phone">Phone</option>
              </select>
            </div>

            {/* Status Field */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-500">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={ticketStatus}
                onChange={(e) => setTicketStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                required
              >
                <option value="Open">Open</option>
                <option value="Pending">Pending</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
                <option value="Waiting on Customer">Waiting on Customer</option>
                <option value="Waiting on Third Party">Waiting on Third Party</option>
              </select>
            </div>

            {/* Priority Field */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-500">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => {
                  const val = e.target.value as TicketPriority;
                  setPriority(val);
                  setAivPriority(val);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                required
              >
                <option value="P4">Low</option>
                <option value="P3">Medium</option>
                <option value="P2">High</option>
                <option value="P1">Urgent</option>
              </select>
            </div>

            {/* Group Field */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-500">
                Group
              </label>
              <select
                value={assignedTeamId}
                disabled={teams.length === 0}
                onChange={(e) => setAssignedTeamId(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md text-sm transition-colors ${
                  teams.length === 0
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed select-none'
                    : 'bg-white border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="">{teams.length === 0 ? 'No groups found' : '-- None / Select Group --'}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            {/* Agent Field */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-500">
                Agent
              </label>
              <select
                value={assignedAgentId}
                onChange={(e) => setAssignedAgentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              >
                <option value="">-- / Unassigned</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.first_name} {ag.last_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Field */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-500">
                Product
              </label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              >
                <option value="Example">Example</option>
                <option value="AIV Analytics">AIV Analytics</option>
                <option value="AIV Enterprise">AIV Enterprise</option>
              </select>
            </div>

            {/* Description (Rich Text Editor) */}
            <div className="space-y-1.5 mt-8">
              <label className="block text-xs text-gray-500 pt-2">
                Description <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder=""
                minHeight={250}
                userId={profile?.id}
                files={uploadedFiles}
                onFilesChange={setUploadedFiles}
              />
            </div>

            {/* Reference Number Field */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-500">
                Reference Number
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                placeholder=""
              />
            </div>

            {/* Tags Field */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-500">
                Tags
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                placeholder=""
              />
            </div>

            {/* Hidden fields for other internal states so it still submits correctly */}
            <div className="hidden">
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.company_name}</option>)}
              </select>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createAnother}
                  onChange={(e) => setCreateAnother(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                Create another
              </label>

              <div className="flex gap-3 items-center">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-4 py-1.5 border border-gray-300 text-gray-700 font-semibold text-sm rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <div className="inline-flex rounded shadow-sm">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-1.5 bg-[#186ade] text-white font-semibold text-sm rounded-l hover:bg-[#1459be] transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    className="px-2 py-1.5 bg-[#186ade] text-white border-l border-blue-600 rounded-r hover:bg-[#1459be] transition-colors disabled:opacity-50"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: Side Panel */}
      <div className="w-72 lg:w-80 border-l border-gray-200 bg-[#f9fafb] shrink-0 flex flex-col hidden md:flex h-[calc(100vh-120px)] sticky top-0">

        {/* Ticket Templates */}
        <div className="p-4 border-b border-gray-200">
          <button className="flex items-center justify-between w-full text-sm font-semibold text-gray-800 mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gray-500" />
              <span>Ticket Templates</span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          <select className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-500 bg-white">
            <option>Pick a template</option>
          </select>
        </div>

        {/* Contact Info */}
        <div className="p-4 border-b border-gray-200">
          <button className="flex items-center justify-between w-full text-sm font-semibold text-gray-800 mb-6">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <span>Contact info</span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {(() => {
            const selected = users.find(u => u.id === createdBy);
            if (!selected) {
              return (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mb-3">
                    <User className="w-8 h-8 text-gray-300" />
                  </div>
                  <h4 className="font-semibold text-gray-800 text-sm">Pick a contact</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                    Their details and recent conversations will appear here
                  </p>
                </div>
              );
            }
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#fde8d7] text-[#e06634] flex items-center justify-center font-semibold text-sm shrink-0 uppercase">
                    {selected.first_name?.[0] || 'U'}
                  </div>
                  <div className="font-bold text-blue-700 text-sm">
                    {selected.first_name} {selected.last_name}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] text-gray-500 font-medium">Email</div>
                  <div className="flex items-center gap-2 text-[13px] text-gray-900 font-medium break-all">
                    {selected.email}
                    <button className="text-gray-400 hover:text-gray-600 shrink-0">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {selected.mobile && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500 font-medium">Mobile Phone</div>
                    <div className="flex items-center gap-2 text-[13px] text-gray-900 font-medium">
                      {selected.mobile}
                      <button className="text-gray-400 hover:text-gray-600 shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <button className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline pt-2">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View more info
                </button>
              </div>
            );
          })()}
        </div>

        {/* Recent Timeline */}
        <div className="p-4 flex-1">
          <button className="flex items-center justify-between w-full text-sm font-semibold text-gray-800 mb-6">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-gray-500" />
              <span>Recent timeline</span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          <div className="text-center text-xs text-gray-400 mt-4">
            No conversations. It's pretty quiet here!
          </div>
        </div>

        {/* Bottom Right Floating Button */}
        <div className="absolute bottom-4 right-4">
          <button className="w-10 h-10 bg-[#00a886] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#009275] transition-colors relative">
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white">
              1
            </div>
            <Bot className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Add Contact Drawer */}
      {showAddContact && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 z-40 transition-opacity" onClick={() => setShowAddContact(false)} />
          <div className="fixed inset-y-0 right-0 w-[450px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform translate-x-0">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold text-[#12344d]">Add Contact</h2>
              <button
                onClick={() => setShowAddContact(false)}
                className="absolute -left-10 top-4 w-8 h-8 bg-[#12344d] rounded flex items-center justify-center text-white hover:bg-slate-800 shadow-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Email */}
              <div className="relative border-l-2 border-dotted border-gray-200 pl-4 ml-2 space-y-3 pb-2">
                <div className="absolute -left-[5px] top-0 w-2 h-2 bg-gray-200 rounded-full"></div>
                <label className="block text-xs font-semibold text-gray-700">Email</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Enter an email address"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      autoComplete="new-contact-email"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800">
                      <SettingsIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <button className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded bg-gray-50 hover:bg-gray-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600">
                  <Plus className="w-3.5 h-3.5" /> Add email
                </button>
              </div>

              {/* Mobile Phone */}
              <div className="relative border-l-2 border-dotted border-gray-200 pl-4 ml-2 space-y-3 pb-2">
                <div className="absolute -left-[5px] top-0 w-2 h-2 bg-gray-200 rounded-full"></div>
                <label className="block text-xs font-semibold text-gray-700">Mobile Phone</label>
                <input
                  type="text"
                  placeholder="Enter a Mobile Phone"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Work Phone */}
              <div className="relative border-l-2 border-dotted border-gray-200 pl-4 ml-2 space-y-3 pb-2">
                <div className="absolute -left-[5px] top-0 w-2 h-2 bg-gray-200 rounded-full"></div>
                <label className="block text-xs font-semibold text-gray-700">Work Phone</label>
                <input type="text" placeholder="Enter a Work Phone" autoComplete="off" className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>

              {/* Unique External ID */}
              <div className="relative border-l-2 border-dotted border-gray-200 pl-4 ml-2 space-y-3 pb-2">
                <div className="absolute -left-[5px] top-0 w-2 h-2 bg-gray-200 rounded-full"></div>
                <label className="block text-xs font-semibold text-gray-700">Unique External ID</label>
                <input type="text" placeholder="Enter a Unique External ID" autoComplete="off" className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>

              {/* Social Handle */}
              <div className="relative border-l-2 border-dotted border-gray-200 pl-4 ml-2 space-y-3 pb-2">
                <div className="absolute -left-[5px] top-0 w-2 h-2 bg-gray-200 rounded-full"></div>
                <label className="block text-xs font-semibold text-gray-700">Social Handle</label>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="ID goes here" className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  <select className="w-32 px-3 py-2 text-sm border border-gray-300 rounded bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                    <option>WhatsApp</option>
                    <option>Twitter</option>
                    <option>Facebook</option>
                  </select>
                  <button className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded bg-gray-50 hover:bg-gray-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600">
                  <Plus className="w-3.5 h-3.5" /> Add new ID
                </button>
              </div>

              {/* Duplicate Contact Warning (simulated on exact match) */}
              {(newContactEmail.toLowerCase() === 'sejalprasad36@gmail.com' || newContactPhone === '7575063401') && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h3 className="text-[13px] font-medium text-gray-500 mb-4">Contact already exists</h3>

                  {/* Duplicate Card 1 */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Duplicate contact found for the below fields</p>
                    <p className="text-xs text-gray-600 mb-0.5">Email: <span className="font-medium">sejalprasad36@gmail.com</span></p>
                    <p className="text-xs text-gray-600 mb-2">Mobile phone: <span className="font-medium">7575063401</span></p>

                    <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-400 flex items-center justify-center font-semibold text-lg shrink-0">
                        S
                      </div>
                      <div className="space-y-1.5">
                        <div className="font-bold text-blue-700 text-sm">Sejal prasad</div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <span>sejalprasad36@gmail.com</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>7575063401</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Duplicate Card 2 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">Duplicate contact found for the below fields</p>
                    <p className="text-xs text-gray-600 mb-0.5">Email: <span className="font-medium">sejalprasad36@gmail.com</span></p>
                    <p className="text-xs text-gray-600 mb-2">Mobile phone: <span className="font-medium">7575063401</span></p>

                    <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-400 flex items-center justify-center font-semibold text-lg shrink-0">
                        S
                      </div>
                      <div className="space-y-1.5">
                        <div className="font-bold text-blue-700 text-sm">Sejal prasad</div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <span>sejalprasad36@gmail.com</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>7575063401</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Form fields toggle */}
              <div className="flex items-center gap-4 mt-8">
                <div className="flex bg-gray-100 rounded-full p-1">
                  <button className="flex items-center gap-2 px-4 py-1.5 bg-white rounded-full text-xs font-semibold text-gray-700 shadow-sm border border-gray-200">
                    <div className="w-3 h-3 rounded-full border-[3px] border-blue-600"></div>
                    Quick-add fields
                  </button>
                  <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs text-gray-600 hover:text-gray-800">
                    <div className="w-3 h-3 rounded-full border border-gray-400 bg-white"></div>
                    All fields
                  </button>
                </div>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter a Full Name"
                  value={newContactFirst}
                  onChange={(e) => setNewContactFirst(e.target.value)}
                  autoComplete="new-contact-name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Company */}
              <div className="space-y-1.5 pb-8">
                <label className="block text-xs font-semibold text-gray-700">Company</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input type="text" autoComplete="off" className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-20" />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button className="p-1 text-blue-600 hover:text-blue-800 rounded bg-blue-50 hover:bg-blue-100 border border-blue-100">
                        <SettingsIcon className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 text-gray-600 hover:text-gray-800 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200">
                        <Ticket className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <button className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded bg-gray-50 hover:bg-gray-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 mt-2 pointer-events-none">
                  <Plus className="w-3.5 h-3.5" /> Associate another company
                </button>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50 shrink-0">
              <button onClick={() => setShowAddContact(false)} className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateContactMock} className="px-4 py-2 text-sm font-semibold text-white bg-[#5b8af0] rounded shadow-sm hover:bg-blue-600 transition-colors">
                Create contact
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
