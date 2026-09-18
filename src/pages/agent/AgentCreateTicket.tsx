import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardBody, Button, Input, Select } from '@/components/ui';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import type { TicketType, TicketCategory, TicketPriority, Account, Profile, TicketWithRelations } from '@/types';
import { ArrowLeft, Send } from 'lucide-react';
import { sendTicketAcknowledgement } from '@/lib/emailService';

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
  { id: 'type-1', name: 'Incident', is_active: true, sort_order: 1 },
  { id: 'type-2', name: 'Service Request', is_active: true, sort_order: 2 },
  { id: 'type-3', name: 'Question', is_active: true, sort_order: 3 },
  { id: 'type-4', name: 'Change Request', is_active: true, sort_order: 4 },
  { id: 'type-5', name: 'Problem', is_active: true, sort_order: 5 },
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

  const [accountId, setAccountId] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('P3');
  const [aivPriority, setAivPriority] = useState<TicketPriority>('P3');
  const [ticketType, setTicketType] = useState('');
  const [category, setCategory] = useState('');
  const [environment, setEnvironment] = useState('Production');
  const [aivVersion, setAivVersion] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    let customAccounts: Account[] = [];
    try {
      customAccounts = JSON.parse(localStorage.getItem('local_custom_accounts') || '[]');
    } catch (e) {}

    supabase.from('ticket_types').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data && data.length > 0) setTypes(data as TicketType[]);
    });
    supabase.from('ticket_categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data && data.length > 0) setCategories(data as TicketCategory[]);
    });
    supabase.from('accounts').select('*').eq('status', 'ACTIVE').order('company_name').then(({ data }) => {
      if (data && data.length > 0) {
        setAccounts([...customAccounts, ...(data as Account[])]);
      } else {
        setAccounts([...customAccounts, ...DEMO_ACCOUNTS]);
      }
    });
  }, []);

  useEffect(() => {
    if (accountId) {
      let customUsers: Profile[] = [];
      try {
        customUsers = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
      } catch (e) {}

      let deletedUserIds: string[] = [];
      try {
        deletedUserIds = JSON.parse(localStorage.getItem('deleted_user_ids') || '[]');
      } catch (e) {}

      const accountCustom = customUsers.filter(
        (u) => (!u.account_id || u.account_id === accountId) && !deletedUserIds.includes(u.id)
      );

      supabase.from('profiles')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'active')
        .order('first_name')
        .then(({ data }) => {
          if (data && data.length > 0) {
            const combined = [...accountCustom, ...(data as Profile[])].filter((u) => !deletedUserIds.includes(u.id));
            setUsers(combined);
          } else {
            const demoForAcct = (DEMO_USERS[accountId] || []).filter((u) => !deletedUserIds.includes(u.id));
            setUsers([...accountCustom, ...demoForAcct]);
          }
        });
    } else {
      setUsers([]);
      setCreatedBy('');
    }
  }, [accountId]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!accountId || !createdBy || !subject.trim() || !description.trim()) {
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
      const { data: ticket, error } = await supabase.from('tickets').insert({
        account_id: accountId,
        created_by_user_id: createdBy,
        ticket_type_id: ticketType || null,
        category_id: category || null,
        subject: subject.trim(),
        description: description,
        priority: aivPriority,
        environment,
        aiv_version: aivVersion || null,
        status: 'OPEN',
        assigned_agent_id: profile.id,
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

        const { data: msgData } = await supabase.from('ticket_messages').insert({
          ticket_id: ticket.id,
          author_user_id: createdBy,
          message_type: 'customer_message',
          body: description,
          is_internal: false,
        }).select().single();

        if (msgData && uploadedFiles.length > 0) {
          for (const file of uploadedFiles) {
            await supabase.from('ticket_attachments').insert({
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

        await supabase.from('ticket_status_history').insert({
          ticket_id: ticket.id,
          from_status: null,
          to_status: 'OPEN',
          changed_by_user_id: profile.id,
          reason: 'Ticket created by agent',
        });

        if (selectedAcct?.support_plan_id) {
          const { data: sla } = await supabase
            .from('sla_policies')
            .select('*, support_plans(code)')
            .eq('support_plan_id', selectedAcct.support_plan_id)
            .eq('priority', aivPriority)
            .eq('is_active', true)
            .maybeSingle();

          if (sla) {
            const planCode = (sla as any).support_plans?.code || 'STANDARD';
            await supabase.from('ticket_sla_snapshots').insert({
              ticket_id: ticket.id,
              support_plan_code: planCode,
              sla_policy_id: sla.id,
              priority,
              first_response_target_minutes: sla.first_response_target_minutes,
              resolution_target_minutes: sla.resolution_target_minutes,
              clock_type: sla.clock_type,
              business_calendar_id: sla.business_calendar_id,
              pause_on_customer_wait: sla.pause_on_customer_wait,
              warning_75: sla.warning_75,
              warning_90: sla.warning_90,
              first_response_due_at: new Date(Date.now() + sla.first_response_target_minutes * 60000).toISOString(),
              resolution_due_at: new Date(Date.now() + sla.resolution_target_minutes * 60000).toISOString(),
            });
            await supabase.from('ticket_sla_events').insert({
              ticket_id: ticket.id,
              event_type: 'START',
              actor_user_id: profile.id,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('Database connection unavailable, falling back to local persistence:', err);
    }

    if (!dbSuccess) {
      // Local fallback for offline/demo/placeholder mode
      const localId = `ticket-local-${Date.now()}`;
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const ticketNum = `AIV-${randomNum}`;
      createdTicketId = localId;

      const fallbackTicket: TicketWithRelations = {
        id: localId,
        ticket_number: ticketNum,
        account_id: accountId,
        created_by_user_id: createdBy,
        ticket_type_id: ticketType || null,
        category_id: category || null,
        subject: subject.trim(),
        description: description,
        priority: aivPriority,
        customer_priority: priority,
        aiv_priority: aivPriority,
        impact: null,
        urgency: null,
        status: 'OPEN',
        environment,
        aiv_version: aivVersion || null,
        assigned_team_id: selectedAcct?.support_team_id || 'team-1',
        assigned_agent_id: profile.id,
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        accounts: selectedAcct ? { id: selectedAcct.id, company_name: selectedAcct.company_name, account_code: selectedAcct.account_code } : undefined,
        created_by_user: selectedUser ? { id: selectedUser.id, first_name: selectedUser.first_name, last_name: selectedUser.last_name, email: selectedUser.email } : undefined,
        assigned_agent: { id: profile.id, first_name: profile.first_name, last_name: profile.last_name, email: profile.email },
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
            priority: aivPriority,
            created_at: fallbackTicket.created_at,
          },
          { email: recipientEmail, name: recipientName }
        );
      } catch (e) {
        console.warn('Could not send email acknowledgement:', e);
      }
    }

    setLoading(false);
    navigate(`/agent/tickets/${createdTicketId}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Ticket on Behalf of Customer</h1>
        <p className="text-sm text-gray-500 mt-1">Create a ticket for a customer account.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardBody className="space-y-5">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

            <Select label="Customer Account" value={accountId} onChange={setAccountId} required placeholder="Select account"
              options={accounts.map((a) => ({ value: a.id, label: `${a.company_name} (${a.account_code})` }))} />

            {accountId && (
              <Select label="Ticket Creator" value={createdBy} onChange={setCreatedBy} required placeholder="Select user"
                options={users.map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name} (${u.email})` }))} />
            )}

            <Input label="Subject" value={subject} onChange={setSubject} required placeholder="Brief summary of the issue" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Detailed description of the issue... You can format text and insert images or videos."
                minHeight={180}
                userId={profile?.id}
                files={uploadedFiles}
                onFilesChange={setUploadedFiles}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Ticket Type" value={ticketType} onChange={setTicketType} placeholder="Select type"
                options={types.map((t) => ({ value: t.id, label: t.name }))} />
              <Select label="Category" value={category} onChange={setCategory} placeholder="Select category"
                options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm bg-white">
                  <option value="P1">P1 - Critical</option>
                  <option value="P2">P2 - High</option>
                  <option value="P3">P3 - Medium</option>
                  <option value="P4">P4 - Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">AIV Priority</label>
                <select value={aivPriority} onChange={(e) => setAivPriority(e.target.value as TicketPriority)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm bg-white">
                  <option value="P1">P1 - Critical</option>
                  <option value="P2">P2 - High</option>
                  <option value="P3">P3 - Medium</option>
                  <option value="P4">P4 - Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Environment" value={environment} onChange={setEnvironment}
                options={ENVIRONMENTS.map((e) => ({ value: e, label: e }))} />
              <Input label="AIV Version (optional)" value={aivVersion} onChange={setAivVersion} placeholder="e.g. v4.2.1" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                <Send className="w-4 h-4" /> {loading ? 'Creating...' : 'Create Ticket'}
              </Button>
            </div>
          </CardBody>
        </form>
      </Card>
    </div>
  );
}
