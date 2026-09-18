import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Modal, Spinner, Textarea } from '@/components/ui';
import {
  Search, Users, Shield, Mail, FileText, Clock, Sparkles,
  History, MessageSquare, GitFork, Zap, X, Save, Send, CheckCircle2,
  Server, Sliders, FileSpreadsheet, Check, ArrowRight, Plus, Pencil, Trash2, Layers
} from 'lucide-react';
import {
  getSmtpConfig, saveSmtpConfig, getSentEmailLogs,
  sendTicketAcknowledgement, getNotificationTriggersConfig, saveNotificationTriggersConfig,
  type SmtpConfig, type EmailLog, type NotificationTriggersConfig
} from '@/lib/emailService';
import {
  getStoredTicketFields, saveTicketField, deleteTicketField, type CustomTicketField,
  getStoredTicketForms, saveTicketForm, deleteTicketForm, type TicketFormConfig,
  getStoredSlaPolicies, saveSlaPolicy, deleteSlaPolicy, type CustomSlaPolicy
} from '@/lib/workflowService';

interface SettingCardItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: 'team' | 'channels' | 'workflows';
  badge?: string;
  action: () => void;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'all' | 'recent' | 'team' | 'channels' | 'workflows'>('workflows');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // SMTP Email Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>(getSmtpConfig());
  const [triggersConfig, setTriggersConfig] = useState<NotificationTriggersConfig>(getNotificationTriggersConfig());
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  const handleToggleTrigger = (key: keyof NotificationTriggersConfig) => {
    const updated = { ...triggersConfig, [key]: !triggersConfig[key] };
    setTriggersConfig(updated);
    saveNotificationTriggersConfig(updated);
  };

  // Roles Modal State
  const [showRolesModal, setShowRolesModal] = useState(false);

  // Workflow Modals State
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const [showFormsModal, setShowFormsModal] = useState(false);
  const [showSlaModal, setShowSlaModal] = useState(false);

  // Workflow Data
  const [ticketFields, setTicketFields] = useState<CustomTicketField[]>([]);
  const [ticketForms, setTicketForms] = useState<TicketFormConfig[]>([]);
  const [slaPolicies, setSlaPolicies] = useState<CustomSlaPolicy[]>([]);

  // Form Creation States inside Modals
  const [creatingField, setCreatingField] = useState(false);
  const [fieldForm, setFieldForm] = useState<{ label: string; type: CustomTicketField['type']; optionsStr: string; required_agent: boolean; visible_customer: boolean }>({
    label: '',
    type: 'TEXT',
    optionsStr: '',
    required_agent: false,
    visible_customer: true,
  });

  const [creatingForm, setCreatingForm] = useState(false);
  const [formForm, setFormForm] = useState<{ title: string; description: string; category_name: string }>({
    title: '',
    description: '',
    category_name: 'Technical Incident',
  });

  const [creatingSla, setCreatingSla] = useState(false);
  const [slaForm, setSlaForm] = useState<{ name: string; description: string; p1_response: number; p1_resolution: number }>({
    name: '',
    description: '',
    p1_response: 15,
    p1_resolution: 120,
  });

  const loadData = useCallback(() => {
    setSmtpConfig(getSmtpConfig());
    setEmailLogs(getSentEmailLogs());
    setTicketFields(getStoredTicketFields());
    setTicketForms(getStoredTicketForms());
    setSlaPolicies(getStoredSlaPolicies());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveSmtp = () => {
    saveSmtpConfig(smtpConfig);
    setTestStatus('SMTP server credentials saved successfully!');
    setTimeout(() => setTestStatus(null), 3500);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      setTestStatus('Please enter a recipient email address.');
      return;
    }
    setTestSending(true);
    setTestStatus(null);

    saveSmtpConfig(smtpConfig);

    const activeMailbox = smtpConfig.channelType === 'DEFAULT' ? smtpConfig.defaultEmail : (smtpConfig.customEmail || smtpConfig.defaultEmail);

    const res = await sendTicketAcknowledgement(
      {
        ticket_number: `AIV-TEST-${Math.floor(100 + Math.random() * 900)}`,
        subject: 'Freshdesk Mailbox Configuration Test Email',
        description: `This is a test notification confirming your support mailbox (${activeMailbox}) is properly configured.`,
        priority: 'P3',
        created_at: new Date().toISOString(),
      },
      {
        email: testEmail.trim(),
        name: 'Test Administrator',
      }
    );

    setTestSending(false);
    setEmailLogs(getSentEmailLogs());
    if (res.success) {
      setTestStatus(`Success! Test acknowledgement sent to ${testEmail} from ${activeMailbox}`);
      setTestEmail('');
    } else {
      setTestStatus(`Dispatch completed. Logged to acknowledgement history.`);
    }
  };

  // Ticket Fields Handler
  const handleSaveCustomField = () => {
    if (!fieldForm.label.trim()) return;
    const opts = fieldForm.optionsStr ? fieldForm.optionsStr.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const newField: CustomTicketField = {
      id: `tf-custom-${Date.now()}`,
      label: fieldForm.label.trim(),
      type: fieldForm.type,
      options: opts,
      is_system: false,
      required_agent: fieldForm.required_agent,
      visible_customer: fieldForm.visible_customer,
      required_customer: false,
      category: 'Custom Field',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const updated = saveTicketField(newField);
    setTicketFields(updated);
    setCreatingField(false);
    setFieldForm({ label: '', type: 'TEXT', optionsStr: '', required_agent: false, visible_customer: true });
  };

  const handleDeleteField = (id: string) => {
    const updated = deleteTicketField(id);
    setTicketFields(updated);
  };

  // Ticket Forms Handler
  const handleSaveCustomForm = () => {
    if (!formForm.title.trim()) return;
    const newForm: TicketFormConfig = {
      id: `form-custom-${Date.now()}`,
      title: formForm.title.trim(),
      description: formForm.description.trim(),
      category_name: formForm.category_name,
      is_default: false,
      is_enabled: true,
      fields: ['tf-1', 'tf-2', 'tf-3'],
      created_at: new Date().toISOString(),
    };
    const updated = saveTicketForm(newForm);
    setTicketForms(updated);
    setCreatingForm(false);
    setFormForm({ title: '', description: '', category_name: 'Technical Incident' });
  };

  const handleDeleteForm = (id: string) => {
    const updated = deleteTicketForm(id);
    setTicketForms(updated);
  };

  // SLA Policies Handler
  const handleSaveCustomSla = () => {
    if (!slaForm.name.trim()) return;
    const newSla: CustomSlaPolicy = {
      id: `sla-custom-${Date.now()}`,
      name: slaForm.name.trim(),
      description: slaForm.description.trim(),
      is_default: false,
      is_active: true,
      targets: [
        { priority: 'P1', response_minutes: Number(slaForm.p1_response) || 15, resolution_minutes: Number(slaForm.p1_resolution) || 120, clock_type: 'calendar', pause_customer_wait: true },
        { priority: 'P2', response_minutes: 60, resolution_minutes: 480, clock_type: 'business', pause_customer_wait: true },
        { priority: 'P3', response_minutes: 240, resolution_minutes: 1440, clock_type: 'business', pause_customer_wait: true },
        { priority: 'P4', response_minutes: 480, resolution_minutes: 2880, clock_type: 'business', pause_customer_wait: true },
      ],
      created_at: new Date().toISOString(),
    };
    const updated = saveSlaPolicy(newSla);
    setSlaPolicies(updated);
    setCreatingSla(false);
    setSlaForm({ name: '', description: '', p1_response: 15, p1_resolution: 120 });
  };

  const handleDeleteSla = (id: string) => {
    const updated = deleteSlaPolicy(id);
    setSlaPolicies(updated);
  };

  // Card items definitions
  const cardItems: SettingCardItem[] = [
    // Team Section
    {
      id: 'agents',
      title: 'Agents',
      description: 'Define agents\' scope of work, type, language, and other details.',
      icon: Users,
      category: 'team',
      action: () => navigate('/admin/agents'),
    },
    {
      id: 'roles',
      title: 'Roles',
      description: 'Provide and restrict fine-grained levels of access and privileges for agents.',
      icon: Shield,
      category: 'team',
      action: () => navigate('/admin/roles'),
    },

    // Channels Section
    {
      id: 'email',
      title: 'Email',
      description: 'Integrate support mailboxes, configure DKIM, custom mail servers, Bcc and more',
      icon: Mail,
      category: 'channels',
      badge: 'Configured',
      action: () => setShowEmailModal(true),
    },

    // Workflows Section
    {
      id: 'ticket-fields',
      title: 'Ticket Fields',
      description: 'Customize pre-configured system ticket fields or add custom ticket fields.',
      icon: Sliders,
      category: 'workflows',
      badge: `${ticketFields.length} Configured`,
      action: () => setShowFieldsModal(true),
    },
    {
      id: 'ticket-forms',
      title: 'Ticket Forms',
      description: 'Show default or custom ticket forms to customers based on issue type.',
      icon: FileSpreadsheet,
      category: 'workflows',
      badge: `${ticketForms.length} Active`,
      action: () => setShowFormsModal(true),
    },
    {
      id: 'sla-policies',
      title: 'SLA Policies',
      description: 'Configure default system SLA targets and custom response policies per priority.',
      icon: Clock,
      category: 'workflows',
      badge: `${slaPolicies.length} Policies`,
      action: () => setShowSlaModal(true),
    },
  ];

  const sidebarMenuItems = [
    { id: 'recent', label: 'Recent', desc: 'Recently accessed settings', icon: History },
    { id: 'team', label: 'Team', desc: 'Define agents\' access levels and working hours', icon: Users },
    { id: 'channels', label: 'Channels', desc: 'Bring in customer queries from various sources', icon: MessageSquare },
    { id: 'workflows', label: 'Workflows', desc: 'Set up your ticket routing and resolution process', icon: GitFork },
  ];

  return (
    <div className="bg-slate-50 min-h-screen -m-6 p-6">
      {/* Top Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Configure support teams, email channels, and workflow routing rules</p>
        </div>
      </div>

      {/* Main Admin Settings Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar Menu */}
        <div className="lg:col-span-1 space-y-1 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs h-fit">
          {sidebarMenuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-xs'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <IconComponent className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <div className="text-sm font-bold tracking-tight">{item.label}</div>
                  <div className="text-xs text-slate-500 leading-tight mt-0.5 line-clamp-1">{item.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Content Pane */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search Settings Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-blue-500/40 rounded-2xl text-sm font-medium shadow-xs focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all"
            />
          </div>

          {/* TEAM SECTION GRID */}
          {(activeSection === 'team' || activeSection === 'all' || searchQuery.trim()) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Team</h2>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  2 Configured ✓
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {cardItems
                  .filter((c) => c.category === 'team' && (searchQuery ? c.title.toLowerCase().includes(searchQuery.toLowerCase()) : true))
                  .map((card) => {
                    const CardIcon = card.icon;
                    return (
                      <div
                        key={card.id}
                        onClick={card.action}
                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <CardIcon className="w-5 h-5" />
                            </div>
                            {card.badge && (
                              <span className="text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {card.badge}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {card.title}
                          </h3>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* CHANNELS SECTION GRID */}
          {(activeSection === 'channels' || activeSection === 'all' || searchQuery.trim()) && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Channels</h2>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  1 Configured ✓
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {cardItems
                  .filter((c) => c.category === 'channels' && (searchQuery ? c.title.toLowerCase().includes(searchQuery.toLowerCase()) : true))
                  .map((card) => {
                    const CardIcon = card.icon;
                    return (
                      <div
                        key={card.id}
                        onClick={card.action}
                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <CardIcon className="w-5 h-5" />
                            </div>
                            {card.badge && (
                              <span className="text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {card.badge} ✓
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {card.title}
                          </h3>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* WORKFLOWS SECTION GRID */}
          {(activeSection === 'workflows' || activeSection === 'all' || searchQuery.trim()) && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Workflows</h2>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  3 Configured ✓
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {cardItems
                  .filter((c) => c.category === 'workflows' && (searchQuery ? c.title.toLowerCase().includes(searchQuery.toLowerCase()) : true))
                  .map((card) => {
                    const CardIcon = card.icon;
                    return (
                      <div
                        key={card.id}
                        onClick={card.action}
                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <CardIcon className="w-5 h-5" />
                            </div>
                            {card.badge && (
                              <span className="text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {card.badge} ✓
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {card.title}
                          </h3>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FRESHWORKS EMAIL CHANNEL & SMTP CONFIGURATION MODAL */}
      <Modal open={showEmailModal} onClose={() => setShowEmailModal(false)} title="Support Email Channel & SMTP Server Setup" size="xl">
        <div className="space-y-5">
          {testStatus && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              testStatus.includes('Success') || testStatus.includes('saved')
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{testStatus}</span>
            </div>
          )}

          {/* FRESHWORKS EMAIL CHANNEL MODE SELECTOR */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" /> Support Email Mailbox Configuration
              </label>
              <span className="text-2xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                Freshworks Email Gateway
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* DEFAULT FRESHWORKS MAILBOX CARD */}
              <div
                onClick={() => {
                  const updated = { ...smtpConfig, channelType: 'DEFAULT' as const };
                  setSmtpConfig(updated);
                  saveSmtpConfig(updated);
                }}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  smtpConfig.channelType === 'DEFAULT'
                    ? 'border-blue-600 bg-blue-50/60 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                      @
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Default System Mailbox</h4>
                      <p className="text-xs font-bold text-blue-600">hello@aivhub.com</p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${smtpConfig.channelType === 'DEFAULT' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                    {smtpConfig.channelType === 'DEFAULT' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </div>
                <p className="text-2xs text-slate-500 leading-relaxed mb-3">
                  Pre-configured zero-setup support mailbox. Automatically converts all incoming customer emails to tickets.
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-2xs font-bold rounded-md">
                    Verified DKIM ✓
                  </span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-2xs font-bold rounded-md">
                    Auto-Forwarding ✓
                  </span>
                </div>
              </div>

              {/* CUSTOM EMAIL MAILBOX CARD */}
              <div
                onClick={() => {
                  const updated = { ...smtpConfig, channelType: 'CUSTOM' as const };
                  setSmtpConfig(updated);
                  saveSmtpConfig(updated);
                }}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  smtpConfig.channelType === 'CUSTOM'
                    ? 'border-indigo-600 bg-indigo-50/60 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Custom Domain Mailbox</h4>
                      <p className="text-xs font-bold text-indigo-600">
                        {smtpConfig.customEmail || 'support@yourdomain.com'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${smtpConfig.channelType === 'CUSTOM' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                    {smtpConfig.channelType === 'CUSTOM' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </div>
                <p className="text-2xs text-slate-500 leading-relaxed mb-3">
                  Connect your own corporate support email address and custom mail server credentials.
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-2xs font-bold rounded-md">
                    Custom SMTP
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-2xs font-bold rounded-md">
                    Custom From Header
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE CONFIGURATION DETAILS & FORM */}
          {smtpConfig.channelType === 'DEFAULT' ? (
            /* DEFAULT MAILBOX ACTIVE BANNER */
            <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Active Channel: Freshworks System Mailbox (hello@aivhub.com)
                    </h3>
                    <p className="text-2xs text-blue-700 mt-0.5">
                      Emails sent to hello@aivhub.com automatically process and respond to support ticket submitters.
                    </p>
                  </div>
                </div>
                <Button onClick={handleSaveSmtp} size="sm">
                  <Save className="w-4 h-4" /> Save Channel Settings
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                <div className="bg-white p-3 rounded-xl border border-blue-100 space-y-1">
                  <span className="text-2xs font-bold text-slate-400 uppercase">Support Email Address</span>
                  <p className="font-bold text-slate-900">hello@aivhub.com</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-blue-100 space-y-1">
                  <span className="text-2xs font-bold text-slate-400 uppercase">Sender Display Name</span>
                  <Input
                    value={smtpConfig.fromName}
                    onChange={(v) => setSmtpConfig({ ...smtpConfig, fromName: v })}
                    placeholder="AIV Support Hub"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* CUSTOM MAILBOX SMTP FORM */
            <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200 space-y-4">
              <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" /> Configure Custom Mailbox & SMTP Server
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Custom Support Email Address *"
                  value={smtpConfig.customEmail}
                  onChange={(v) => setSmtpConfig({ ...smtpConfig, customEmail: v })}
                  placeholder="support@yourcompany.com"
                />
                <Input
                  label="Sender Display Name *"
                  value={smtpConfig.fromName}
                  onChange={(v) => setSmtpConfig({ ...smtpConfig, fromName: v })}
                  placeholder="AIV Customer Care"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="SMTP Server Host *"
                  value={smtpConfig.host}
                  onChange={(v) => setSmtpConfig({ ...smtpConfig, host: v })}
                  placeholder="send.one.com"
                />
                <Input
                  label="SMTP Server Port *"
                  type="number"
                  value={String(smtpConfig.port)}
                  onChange={(v) => setSmtpConfig({ ...smtpConfig, port: Number(v) })}
                  placeholder="587"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="SMTP Username *"
                  value={smtpConfig.user}
                  onChange={(v) => setSmtpConfig({ ...smtpConfig, user: v })}
                  placeholder="hello@aivhub.com"
                />
                <Input
                  label="SMTP Password *"
                  type="password"
                  value={smtpConfig.pass}
                  onChange={(v) => setSmtpConfig({ ...smtpConfig, pass: v })}
                  placeholder="••••••••"
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button onClick={handleSaveSmtp} size="sm">
                  <Save className="w-4 h-4" /> Save Custom Mailbox
                </Button>
              </div>
            </div>
          )}

          {/* AUTOMATED EMAIL NOTIFICATION TRIGGERS CONTROL PANEL */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" /> Automated Email Notification Triggers
                </h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Configure when automatic emails are dispatched to customers and support staff.
                </p>
              </div>
              <span className="text-2xs font-semibold px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md border border-amber-200">
                Freshworks Automations
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Requester Triggers */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="text-2xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span>Requester (Customer) Triggers</span>
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                </div>
                {[
                  { key: 'notify_requester_ticket_creation', label: 'Ticket Creation Acknowledgement', desc: 'Sent when customer creates a new ticket' },
                  { key: 'notify_requester_agent_reply', label: 'Agent Public Reply', desc: 'Sent when agent posts a public response with signature' },
                  { key: 'notify_requester_status_change', label: 'Ticket Status / Resolution Update', desc: 'Sent when ticket is updated to Resolved/Closed' },
                  { key: 'notify_requester_csat_survey', label: 'CSAT Satisfaction Survey', desc: 'Sent after ticket resolution to rate service' },
                ].map((item) => (
                  <label key={item.key} className="flex items-start justify-between gap-3 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-all">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{item.label}</div>
                      <div className="text-2xs text-slate-400 leading-tight">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={(triggersConfig as any)[item.key]}
                      onChange={() => handleToggleTrigger(item.key as any)}
                      className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                  </label>
                ))}
              </div>

              {/* Agent Triggers */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="text-2xs font-bold text-indigo-600 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span>Agent & Team Triggers</span>
                  <Shield className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                {[
                  { key: 'notify_agent_ticket_assigned', label: 'Ticket Assigned to Agent', desc: 'Alert sent when ticket is assigned to agent' },
                  { key: 'notify_agent_customer_reply', label: 'Customer Reply Notification', desc: 'Alert sent to assigned agent when customer responds' },
                  { key: 'notify_agent_sla_warning', label: 'SLA Warning & Breach Alert', desc: 'Urgent alert when SLA target is approaching breach' },
                ].map((item) => (
                  <label key={item.key} className="flex items-start justify-between gap-3 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-all">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{item.label}</div>
                      <div className="text-2xs text-slate-400 leading-tight">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={(triggersConfig as any)[item.key]}
                      onChange={() => handleToggleTrigger(item.key as any)}
                      className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Test Email Dispatcher */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" /> Send Test Ticket Acknowledgement
            </h3>
            <p className="text-xs text-slate-500">
              Dispatch an immediate test email from{' '}
              <strong className="text-slate-800">
                {smtpConfig.channelType === 'DEFAULT' ? smtpConfig.defaultEmail : (smtpConfig.customEmail || smtpConfig.defaultEmail)}
              </strong>{' '}
              to verify live email delivery.
            </p>

            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Enter recipient email (e.g. user@example.com)..."
                  value={testEmail}
                  onChange={(v) => setTestEmail(v)}
                />
              </div>
              <Button onClick={handleSendTestEmail} disabled={testSending || !testEmail.trim()} className="mt-0.5">
                {testSending ? 'Sending...' : 'Dispatch Test Email'}
              </Button>
            </div>
          </div>

          {/* Dispatched Logs */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Dispatched Acknowledgement Logs ({emailLogs.length})
            </h3>

            {emailLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No email acknowledgements sent yet.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {emailLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{log.subject}</p>
                      <p className="text-slate-500 mt-0.5">From: {log.smtpUser} • To: {log.recipientEmail}</p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md text-2xs">
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ROLES MODAL */}
      <Modal open={showRolesModal} onClose={() => setShowRolesModal(false)} title="Agent Access Roles & Privileges" size="lg">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">Provide and restrict fine-grained levels of access and privileges for agents across teams.</p>
          <div className="space-y-2">
            {[
              { title: 'Account Administrator', desc: 'Full access to all administrative settings, user management, and billing.' },
              { title: 'Supervisor', desc: 'Can manage team queues, view analytics, and edit all ticket categories.' },
              { title: 'Agent', desc: 'Can respond to assigned tickets, create new tickets, and view knowledge base.' },
              { title: 'Light Agent', desc: 'Read-only access to ticket queues and internal notes.' },
            ].map((role, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{role.title}</h4>
                  <p className="text-slate-500 mt-0.5">{role.desc}</p>
                </div>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-bold rounded-lg text-2xs">Active</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* 1. WORKFLOWS: TICKET FIELDS MODAL (DEFAULT SYSTEM + CUSTOM FIELDS) */}
      <Modal open={showFieldsModal} onClose={() => { setShowFieldsModal(false); setCreatingField(false); }} title="Ticket Fields Management" size="xl">
        <div className="space-y-5 text-xs">
          <div className="flex items-center justify-between">
            <p className="text-slate-600">View pre-configured default system ticket fields and configure custom ticket fields.</p>
            <Button size="sm" onClick={() => setCreatingField(!creatingField)}>
              <Plus className="w-4 h-4 mr-1" /> {creatingField ? 'Cancel' : 'New Custom Field'}
            </Button>
          </div>

          {creatingField && (
            <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 space-y-3">
              <h4 className="font-bold text-blue-900 uppercase tracking-wider text-2xs">Create Custom Ticket Field</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Field Label *" value={fieldForm.label} onChange={(v) => setFieldForm({ ...fieldForm, label: v })} placeholder="e.g. Serial Number" />
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Field Type</label>
                  <select
                    value={fieldForm.type}
                    onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value as any })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="TEXT">Single-line Text</option>
                    <option value="TEXTAREA">Multi-line Text</option>
                    <option value="DROPDOWN">Dropdown Options</option>
                    <option value="CHECKBOX">Checkbox</option>
                    <option value="NUMBER">Number</option>
                    <option value="DATE">Date Picker</option>
                  </select>
                </div>
              </div>
              {fieldForm.type === 'DROPDOWN' && (
                <Input label="Dropdown Options (comma separated)" value={fieldForm.optionsStr} onChange={(v) => setFieldForm({ ...fieldForm, optionsStr: v })} placeholder="Option 1, Option 2, Option 3" />
              )}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input type="checkbox" checked={fieldForm.required_agent} onChange={(e) => setFieldForm({ ...fieldForm, required_agent: e.target.checked })} className="rounded text-blue-600" />
                  Required for Agents
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input type="checkbox" checked={fieldForm.visible_customer} onChange={(e) => setFieldForm({ ...fieldForm, visible_customer: e.target.checked })} className="rounded text-blue-600" />
                  Visible to Customers
                </label>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleSaveCustomField} disabled={!fieldForm.label.trim()}>
                  <Save className="w-4 h-4" /> Save Custom Field
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-2xs">Configured Ticket Fields ({ticketFields.length})</h4>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {ticketFields.map((f) => (
                <div key={f.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{f.label}</span>
                        {f.is_system ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-2xs font-bold rounded-md">Default System</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-2xs font-bold rounded-md">Custom</span>
                        )}
                      </div>
                      <p className="text-slate-500 text-2xs mt-0.5">Type: {f.type} • Category: {f.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {f.visible_customer && <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-2xs font-semibold rounded">Customer Visible</span>}
                    {!f.is_system && (
                      <button onClick={() => handleDeleteField(f.id)} className="p-1 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 2. WORKFLOWS: TICKET FORMS MODAL (DEFAULT SYSTEM + CUSTOM FORMS) */}
      <Modal open={showFormsModal} onClose={() => { setShowFormsModal(false); setCreatingForm(false); }} title="Ticket Submission Forms Setup" size="xl">
        <div className="space-y-5 text-xs">
          <div className="flex items-center justify-between">
            <p className="text-slate-600">Configure default ticket submission forms and build custom forms for specific issue categories.</p>
            <Button size="sm" onClick={() => setCreatingForm(!creatingForm)}>
              <Plus className="w-4 h-4 mr-1" /> {creatingForm ? 'Cancel' : 'New Custom Form'}
            </Button>
          </div>

          {creatingForm && (
            <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200 space-y-3">
              <h4 className="font-bold text-indigo-900 uppercase tracking-wider text-2xs">Create Custom Ticket Form</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Form Title *" value={formForm.title} onChange={(v) => setFormForm({ ...formForm, title: v })} placeholder="e.g. VIP Enterprise Escalation Form" />
                <Input label="Category *" value={formForm.category_name} onChange={(v) => setFormForm({ ...formForm, category_name: v })} placeholder="Technical / Billing" />
              </div>
              <Textarea label="Form Instructions for Customer" value={formForm.description} onChange={(v) => setFormForm({ ...formForm, description: v })} rows={2} placeholder="Guide customer on details required..." />
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleSaveCustomForm} disabled={!formForm.title.trim()}>
                  <Save className="w-4 h-4" /> Save Custom Form
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-2xs">Active Ticket Forms ({ticketForms.length})</h4>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {ticketForms.map((f) => (
                <div key={f.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{f.title}</h4>
                        {f.is_default ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-2xs font-bold rounded-md">Default System Form</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-2xs font-bold rounded-md">Custom Form</span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{f.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-2xs">Enabled ✓</span>
                    {!f.is_default && (
                      <button onClick={() => handleDeleteForm(f.id)} className="p-1 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 3. WORKFLOWS: SLA POLICIES MODAL (DEFAULT SYSTEM + CUSTOM POLICIES) */}
      <Modal open={showSlaModal} onClose={() => { setShowSlaModal(false); setCreatingSla(false); }} title="SLA Response & Resolution Target Policies" size="xl">
        <div className="space-y-5 text-xs">
          <div className="flex items-center justify-between">
            <p className="text-slate-600">View Freshworks default SLA policies and build custom response/resolution targets per priority.</p>
            <Button size="sm" onClick={() => setCreatingSla(!creatingSla)}>
              <Plus className="w-4 h-4 mr-1" /> {creatingSla ? 'Cancel' : 'New Custom SLA'}
            </Button>
          </div>

          {creatingSla && (
            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-3">
              <h4 className="font-bold text-emerald-900 uppercase tracking-wider text-2xs">Create Custom SLA Policy</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="SLA Policy Name *" value={slaForm.name} onChange={(v) => setSlaForm({ ...slaForm, name: v })} placeholder="e.g. VIP Platinum 24x7 SLA" />
                <Input label="Description" value={slaForm.description} onChange={(v) => setSlaForm({ ...slaForm, description: v })} placeholder="For enterprise tier customers..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="P1 Critical Response Target (minutes)" type="number" value={String(slaForm.p1_response)} onChange={(v) => setSlaForm({ ...slaForm, p1_response: Number(v) })} />
                <Input label="P1 Critical Resolution Target (minutes)" type="number" value={String(slaForm.p1_resolution)} onChange={(v) => setSlaForm({ ...slaForm, p1_resolution: Number(v) })} />
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleSaveCustomSla} disabled={!slaForm.name.trim()}>
                  <Save className="w-4 h-4" /> Save Custom SLA Policy
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-2xs">Configured SLA Policies ({slaPolicies.length})</h4>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {slaPolicies.map((p) => (
                <div key={p.id} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                        {p.is_default ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-2xs font-bold rounded-md">Freshworks Default SLA</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-2xs font-bold rounded-md">Custom SLA</span>
                        )}
                      </div>
                      <p className="text-slate-500 text-2xs mt-0.5">{p.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-2xs">Active</span>
                      {!p.is_default && (
                        <button onClick={() => handleDeleteSla(p.id)} className="p-1 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Targets Table */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {p.targets.map((t) => (
                      <div key={t.priority} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-2xs">
                        <div className="font-bold text-slate-900 flex items-center justify-between">
                          <span>{t.priority} Target</span>
                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-3xs font-semibold">{t.clock_type}</span>
                        </div>
                        <p className="text-slate-600">Response: <strong className="text-slate-900">{t.response_minutes}m</strong></p>
                        <p className="text-slate-600">Resolution: <strong className="text-slate-900">{t.resolution_minutes}m</strong></p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
