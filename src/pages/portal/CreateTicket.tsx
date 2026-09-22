import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardBody, Button, Input, Select } from '@/components/ui';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { ArrowLeft, Send } from 'lucide-react';
import type { TicketType, TicketCategory, TicketPriority, TicketWithRelations } from '@/types';
import { sendTicketAcknowledgement } from '@/lib/emailService';

interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  path: string;
}

const PRIORITIES: { value: TicketPriority; label: string; description: string }[] = [
  { value: 'P1', label: 'Critical', description: 'System down, business stopped' },
  { value: 'P2', label: 'High', description: 'Major disruption, workaround available' },
  { value: 'P3', label: 'Medium', description: 'Moderate impact, some disruption' },
  { value: 'P4', label: 'Low', description: 'Minor issue, general questions' },
];

const IMPACTS = [
  { value: 'entire_organisation', label: 'Entire Organisation' },
  { value: 'multiple_users', label: 'Multiple Users' },
  { value: 'single_user', label: 'Single User' },
  { value: 'minor', label: 'Minor' },
];

const URGENCIES = [
  { value: 'business_stopped', label: 'Business Stopped' },
  { value: 'major_disruption', label: 'Major Disruption' },
  { value: 'workaround_available', label: 'Workaround Available' },
  { value: 'minor', label: 'Minor' },
];

const ENVIRONMENTS = ['Production', 'UAT', 'Test', 'Development', 'Other'];

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

export function CreateTicket() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [types, setTypes] = useState<TicketType[]>(DEMO_TYPES);
  const [categories, setCategories] = useState<TicketCategory[]>(DEMO_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('P3');
  const [ticketType, setTicketType] = useState('');
  const [category, setCategory] = useState('');
  const [impact, setImpact] = useState('single_user');
  const [urgency, setUrgency] = useState('workaround_available');
  const [environment, setEnvironment] = useState('Production');
  const [aivVersion, setAivVersion] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    dbClient.from('ticket_types').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data && data.length > 0) setTypes(data as TicketType[]);
    });
    dbClient.from('ticket_categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data && data.length > 0) setCategories(data as TicketCategory[]);
    });
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) { setError('Subject and description are required.'); return; }

    setLoading(true);
    setError(null);

    const activeAccountId = profile?.account_id || 'a0000000-0000-0000-0000-000000000001';
    const selectedType = types.find((t) => t.id === ticketType);



    let dbTicket: any;
    try {
      const { data, error } = await dbClient.from('tickets').insert({
        account_id: activeAccountId,
        created_by_user_id: profile?.id,
        ticket_type_id: ticketType || null,
        category_id: category || null,
        subject: subject.trim(),
        description: description,
        priority,
        impact,
        urgency,
        environment,
        aiv_version: aivVersion || null,
        status: 'NEW',
      }).select().single();

      if (!error && data) {
        dbTicket = data;

        // Automatically send default SMTP ticket creation email acknowledgement
        if (profile?.email) {
          try {
            await sendTicketAcknowledgement(
              {
                ticket_number: dbTicket.ticket_number,
                subject: dbTicket.subject,
                description: dbTicket.description,
                priority: dbTicket.priority,
                created_at: dbTicket.created_at,
              },
              {
                email: profile.email,
                name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Valued Customer',
              }
            );
          } catch (e) {
            console.warn('Could not send email acknowledgement:', e);
          }
        }
      }
    } catch (err: any) {
      console.warn('Database error, using local fallback:', err);
    }

    if (!dbTicket) {
      const localId = `ticket-local-${Date.now()}`;
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const ticketNum = `AIV-${randomNum}`;
      dbTicket = {
        id: localId,
        ticket_number: ticketNum,
        account_id: activeAccountId,
        created_by_user_id: profile?.id || 'demo-user',
        ticket_type_id: ticketType || null,
        category_id: category || null,
        subject: subject.trim(),
        description: description,
        priority,
        customer_priority: priority,
        aiv_priority: priority,
        impact,
        urgency,
        status: 'NEW',
        environment,
        aiv_version: aivVersion || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        accounts: { id: activeAccountId, company_name: 'Acme Corp', account_code: 'ACME001' },
        created_by_user: profile ? { id: profile.id, first_name: profile.first_name, last_name: profile.last_name, email: profile.email } : undefined,
      };

      try {
        const existing = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
        localStorage.setItem('local_custom_tickets', JSON.stringify([dbTicket, ...existing]));
      } catch (e) {
        console.error('Failed to save to local_custom_tickets', e);
      }
    }

    try {
      const { data: msgData } = await dbClient.from('ticket_messages').insert({
        ticket_id: dbTicket.id,
        author_user_id: profile?.id,
        message_type: 'customer_message',
        body: description,
        is_internal: false,
      }).select().single();

      if (msgData && uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          await dbClient.from('ticket_attachments').insert({
            ticket_id: dbTicket.id,
            message_id: msgData.id,
            uploaded_by_user_id: profile?.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            storage_path: file.path,
            is_internal: false,
          });
        }
      }

      await dbClient.from('ticket_status_history').insert({
        ticket_id: dbTicket.id,
        from_status: null,
        to_status: 'NEW',
        changed_by_user_id: profile?.id,
        reason: 'Ticket created',
      });
    } catch (e) {
      console.error(e);
    }

    setLoading(false);
    if (profile && ['agent', 'manager', 'admin'].includes(profile.user_type)) {
      navigate('/agent/inbox');
    } else {
      navigate('/portal/tickets');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in the details below and our team will respond as soon as possible.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardBody className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <Input label="Subject" value={subject} onChange={setSubject} required placeholder="Brief summary of your issue" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Provide a detailed description of your issue, including any error messages, steps to reproduce, and expected behavior. You can format text and insert images or videos."
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      priority === p.value
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{p.value} - {p.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Impact" value={impact} onChange={setImpact}
                options={IMPACTS.map((i) => ({ value: i.value, label: i.label }))} />
              <Select label="Urgency" value={urgency} onChange={setUrgency}
                options={URGENCIES.map((u) => ({ value: u.value, label: u.label }))} />
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
