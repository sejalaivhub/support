import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Input, Textarea, Modal, Spinner } from '@/components/ui';
import { Badge, Avatar } from '@/components/ui/Badges';
import {
  Users, UserPlus, Search, Pencil, Trash2, Shield, Mail, Phone,
  Clock, Globe, FileText, Check, Filter, Sparkles, AlertCircle, Building2,
  Eye, Code, RotateCcw, CheckCircle2, MessageSquare
} from 'lucide-react';
import {
  getStoredAgents, saveAgent, deleteAgent, getStoredRoles
} from '@/lib/agentRoleService';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { sendAccountActivationEmail, sendNewAgentAddedNotification } from '@/lib/emailService';
import type { Agent, AgentType, TicketAccessScope, AgentStatus, Role } from '@/types/agentRole';
import type { SupportTeam } from '@/types';

const DEFAULT_TEAMS: SupportTeam[] = [
  { id: 'team-1', name: 'Tier 1 Support', description: 'Frontline customer support team', is_active: true },
  { id: 'team-2', name: 'Tier 2 Engineering', description: 'Technical escalation and bug fixes', is_active: true },
  { id: 'team-3', name: 'Enterprise Billing', description: 'Subscription and payment support', is_active: true },
];

const TIMEZONES = [
  'UTC +00:00 Universal / London',
  'UTC -05:00 Eastern Time (US & Canada)',
  'UTC -06:00 Central Time (US & Canada)',
  'UTC -08:00 Pacific Time (US & Canada)',
  'UTC +01:00 Central European Time',
  'UTC +05:30 India Standard Time',
];

const LANGUAGES = [
  'English (US)',
  'English (UK)',
  'Spanish (Español)',
  'French (Français)',
  'German (Deutsch)',
  'Japanese (日本語)',
];

export function AgentsPage() {
  const { profile } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teams, setTeams] = useState<SupportTeam[]>(DEFAULT_TEAMS);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | AgentType>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Signature Block State & Helpers
  const [signatureTab, setSignatureTab] = useState<'edit' | 'preview'>('edit');

  const insertSignatureVariable = (variableTag: string) => {
    setForm((prev) => ({
      ...prev,
      signature: prev.signature ? `${prev.signature} ${variableTag}` : variableTag,
    }));
  };

  const applySignaturePreset = (preset: 'corporate' | 'modern' | 'minimal') => {
    if (preset === 'corporate') {
      setForm((prev) => ({
        ...prev,
        signature: `--\n${prev.first_name || '{{first_name}}'} ${prev.last_name || '{{last_name}}'}\n${prev.job_title || '{{job_title}}'} | AIV Support Team\nWork: ${prev.email || '{{email}}'} | Direct: ${prev.phone || '{{phone}}'}`,
      }));
    } else if (preset === 'modern') {
      setForm((prev) => ({
        ...prev,
        signature: `--\nBest regards,\n${prev.first_name || '{{first_name}}'} ${prev.last_name || '{{last_name}}'}\n${prev.job_title || '{{job_title}}'}\nAIV Support Desk • http://aivsupport.com`,
      }));
    } else if (preset === 'minimal') {
      setForm((prev) => ({
        ...prev,
        signature: `-- ${prev.first_name || '{{first_name}}'} ${prev.last_name || '{{last_name}}'} • ${prev.job_title || '{{job_title}}'} • ${prev.email || '{{email}}'}`,
      }));
    }
  };

  const getRenderedSignature = (template: string) => {
    if (!template) return '';
    return template
      .replace(/\{\{first_name\}\}/g, form.first_name || 'Sarah')
      .replace(/\{\{last_name\}\}/g, form.last_name || 'Connor')
      .replace(/\{\{job_title\}\}/g, form.job_title || 'Senior Support Specialist')
      .replace(/\{\{email\}\}/g, form.email || 'sarah.connor@aivsupport.com')
      .replace(/\{\{phone\}\}/g, form.phone || '+1 555-0100')
      .replace(/\{\{mobile\}\}/g, form.mobile || '+1 555-0199');
  };

  const [form, setForm] = useState<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    mobile: string;
    job_title: string;
    agent_type: AgentType;
    ticket_scope: TicketAccessScope;
    role_ids: string[];
    team_ids: string[];
    language: string;
    timezone: string;
    signature: string;
    status: AgentStatus;
  }>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    job_title: '',
    agent_type: 'FULL_TIME',
    ticket_scope: 'GROUP',
    role_ids: ['role-agent'],
    team_ids: ['team-1'],
    language: 'English (US)',
    timezone: 'UTC -05:00 Eastern Time (US & Canada)',
    signature: '',
    status: 'ACTIVE',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const loadedAgents = getStoredAgents();
    const loadedRoles = getStoredRoles();
    setAgents(loadedAgents);
    setRoles(loadedRoles);

    // Fetch live teams from PostgreSQL if available
    try {
      const { data } = await dbClient.from('support_teams').select('*').order('name');
      if (data && data.length > 0) {
        setTeams(data as SupportTeam[]);
      }
    } catch (e) {}

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingAgent(null);
    setFormError(null);
    setForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      mobile: '',
      job_title: '',
      agent_type: 'FULL_TIME',
      ticket_scope: 'GROUP',
      role_ids: roles.length > 0 ? [roles[0].id] : ['role-agent'],
      team_ids: teams.length > 0 ? [teams[0].id] : ['team-1'],
      language: 'English (US)',
      timezone: 'UTC -05:00 Eastern Time (US & Canada)',
      signature: '',
      status: 'ACTIVE',
    });
    setShowModal(true);
  };

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setFormError(null);
    setForm({
      first_name: agent.first_name,
      last_name: agent.last_name,
      email: agent.email,
      phone: agent.phone || '',
      mobile: agent.mobile || '',
      job_title: agent.job_title || '',
      agent_type: agent.agent_type,
      ticket_scope: agent.ticket_scope,
      role_ids: agent.role_ids,
      team_ids: agent.team_ids,
      language: agent.language || 'English (US)',
      timezone: agent.timezone || 'UTC -05:00 Eastern Time (US & Canada)',
      signature: agent.signature || '',
      status: agent.status,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setFormError('First name, last name, and work email are required.');
      return;
    }
    if (form.role_ids.length === 0) {
      setFormError('Please select at least one role for the agent.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const agentToSave: Agent = {
      id: editingAgent ? editingAgent.id : `agent-custom-${Date.now()}`,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      mobile: form.mobile.trim() || null,
      job_title: form.job_title.trim() || 'Support Agent',
      agent_type: form.agent_type,
      ticket_scope: form.ticket_scope,
      role_ids: form.role_ids,
      team_ids: form.team_ids,
      language: form.language,
      timezone: form.timezone,
      signature: form.signature.trim() || null,
      status: form.status,
      created_at: editingAgent ? editingAgent.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = saveAgent(agentToSave);
    setAgents(updated);

    if (!editingAgent) {
      // 1. Send activation email to the newly created agent
      sendAccountActivationEmail({
        id: agentToSave.id,
        first_name: agentToSave.first_name,
        last_name: agentToSave.last_name,
        email: agentToSave.email,
        user_type: 'agent',
      });

      // 2. Send Freshdesk "A new agent was added to your account" notification to Account Administrator
      const roleObj = roles.find(r => r.id === (form.role_ids[0] || ''));
      const roleName = roleObj ? roleObj.name : 'Agent';
      const addedByName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Sejal prasad' : 'Sejal prasad';
      const fullTimeCount = updated.filter(a => a.agent_type === 'FULL_TIME').length;
      const occasionalCount = updated.filter(a => a.agent_type === 'OCCASIONAL').length;

      sendNewAgentAddedNotification({
        newAgentName: `${agentToSave.first_name} ${agentToSave.last_name}`.trim(),
        newAgentEmail: agentToSave.email,
        agentType: agentToSave.agent_type === 'FULL_TIME' ? 'Full time' : 'Occasional',
        roleName: roleName,
        addedByName: addedByName,
        fullTimeCount: fullTimeCount,
        occasionalCount: occasionalCount,
      });
    }

    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = (agentId: string, name: string) => {
    if (confirm(`Are you sure you want to remove agent "${name}" from the helpdesk?`)) {
      const updated = deleteAgent(agentId);
      setAgents(updated);
    }
  };

  const toggleRoleSelection = (roleId: string) => {
    setForm((prev) => {
      const exists = prev.role_ids.includes(roleId);
      if (exists) {
        if (prev.role_ids.length === 1) return prev; // Keep at least one
        return { ...prev, role_ids: prev.role_ids.filter((id) => id !== roleId) };
      } else {
        return { ...prev, role_ids: [...prev.role_ids, roleId] };
      }
    });
  };

  const toggleTeamSelection = (teamId: string) => {
    setForm((prev) => {
      const exists = prev.team_ids.includes(teamId);
      if (exists) {
        return { ...prev, team_ids: prev.team_ids.filter((id) => id !== teamId) };
      } else {
        return { ...prev, team_ids: [...prev.team_ids, teamId] };
      }
    });
  };

  const filteredAgents = agents.filter((agent) => {
    const query = search.toLowerCase().trim();
    const fullNameStr = `${agent.first_name} ${agent.last_name}`.toLowerCase();
    const emailStr = agent.email.toLowerCase();
    const matchesSearch = fullNameStr.includes(query) || emailStr.includes(query);

    const matchesType = typeFilter === 'ALL' || agent.agent_type === typeFilter;
    const matchesRole = roleFilter === 'ALL' || agent.role_ids.includes(roleFilter);
    const matchesStatus = statusFilter === 'ALL' || agent.status === statusFilter;

    return matchesSearch && matchesType && matchesRole && matchesStatus;
  });

  const fullTimeCount = agents.filter((a) => a.agent_type === 'FULL_TIME').length;
  const occasionalCount = agents.filter((a) => a.agent_type === 'OCCASIONAL').length;
  const activeCount = agents.filter((a) => a.status === 'ACTIVE').length;

  if (loading) return <Spinner label="Loading Agents Directory..." />;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Support Agents</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              Freshworks Directory
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Define agents' scope of work, license type, support group assignments, and access privileges.
          </p>
        </div>
        <Button onClick={openCreateModal} className="shadow-sm">
          <UserPlus className="w-4 h-4 mr-1.5" /> New Agent
        </Button>
      </div>

      {/* Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{agents.length}</div>
            <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Total Agents</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{fullTimeCount}</div>
            <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Full-Time Agents</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{occasionalCount}</div>
            <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Occasional Pass</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Check className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{activeCount}</div>
            <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Active Status</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agent name or email..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            >
              <option value="ALL">All Agent Types</option>
              <option value="FULL_TIME">Full-time Agent</option>
              <option value="OCCASIONAL">Occasional Agent</option>
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            >
              <option value="ALL">All Access Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="AWAY">Away</option>
            </select>
          </div>
        </div>
      </div>

      {/* Agents Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {filteredAgents.map((agent) => {
          const assignedRoles = roles.filter((r) => agent.role_ids.includes(r.id));
          const assignedTeams = teams.filter((t) => agent.team_ids.includes(t.id));

          return (
            <div
              key={agent.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Agent Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar firstName={agent.first_name} lastName={agent.last_name} size="md" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {agent.first_name} {agent.last_name}
                        </h3>
                        {agent.agent_type === 'FULL_TIME' ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 font-bold text-2xs rounded-md">
                            Full-time
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 font-bold text-2xs rounded-md">
                            Occasional Pass
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-500">{agent.job_title || 'Support Agent'}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(agent)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Agent Details"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(agent.id, `${agent.first_name} ${agent.last_name}`)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Agent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-800 truncate">{agent.email}</span>
                  </div>
                  {agent.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{agent.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <span className="font-semibold text-slate-700">Scope:</span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-2xs font-bold text-slate-700">
                      {agent.ticket_scope === 'GLOBAL' ? 'Global Access' : agent.ticket_scope === 'GROUP' ? 'Group Access' : 'Restricted (Assigned)'}
                    </span>
                  </div>
                </div>

                {/* Roles & Support Groups Badges */}
                <div className="space-y-2">
                  <div>
                    <div className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned Roles</div>
                    <div className="flex flex-wrap gap-1">
                      {assignedRoles.map((r) => (
                        <span key={r.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold text-2xs rounded-md">
                          {r.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">Support Groups / Teams</div>
                    <div className="flex flex-wrap gap-1">
                      {assignedTeams.length > 0 ? (
                        assignedTeams.map((t) => (
                          <span key={t.id} className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 font-medium text-2xs rounded-md">
                            {t.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-2xs text-slate-400 italic">No groups assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-2xs text-slate-400 font-medium">
                  {agent.timezone ? agent.timezone.split(' ')[0] : 'UTC'}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-2xs font-bold border ${
                    agent.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : agent.status === 'AWAY'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  ● {agent.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT AGENT MODAL */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingAgent ? `Edit Agent: ${editingAgent.first_name} ${editingAgent.last_name}` : 'Create Support Agent'}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Freshworks Agent Type Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Agent License Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setForm({ ...form, agent_type: 'FULL_TIME' })}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  form.agent_type === 'FULL_TIME'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">Full-Time Agent</span>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${form.agent_type === 'FULL_TIME' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                    {form.agent_type === 'FULL_TIME' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </div>
                <p className="text-2xs text-slate-500 leading-tight">
                  Occupies a dedicated helpdesk agent seat for full-time support staff.
                </p>
              </div>

              <div
                onClick={() => setForm({ ...form, agent_type: 'OCCASIONAL' })}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  form.agent_type === 'OCCASIONAL'
                    ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">Occasional Agent</span>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${form.agent_type === 'OCCASIONAL' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'}`}>
                    {form.agent_type === 'OCCASIONAL' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </div>
                <p className="text-2xs text-slate-500 leading-tight">
                  Uses day passes when logging in (ideal for temporary or cross-team staff).
                </p>
              </div>
            </div>
          </div>

          {/* Profile Name & Contact Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name *"
              placeholder="e.g. Sarah"
              value={form.first_name}
              onChange={(v) => setForm({ ...form, first_name: v })}
              required
            />
            <Input
              label="Last Name *"
              placeholder="e.g. Connor"
              value={form.last_name}
              onChange={(v) => setForm({ ...form, last_name: v })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Work Email *"
              type="email"
              placeholder="sarah.connor@company.com"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              required
            />
            <Input
              label="Job Title"
              placeholder="Senior Specialist"
              value={form.job_title}
              onChange={(v) => setForm({ ...form, job_title: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Work Phone"
              placeholder="+1 555-0100"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
            />
            <Input
              label="Mobile Phone"
              placeholder="+1 555-0199"
              value={form.mobile}
              onChange={(v) => setForm({ ...form, mobile: v })}
            />
          </div>

          {/* Scope & Role Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Ticket Access Scope
              </label>
              <select
                value={form.ticket_scope}
                onChange={(e) => setForm({ ...form, ticket_scope: e.target.value as TicketAccessScope })}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-2xs"
              >
                <option value="GLOBAL">Global Access (All tickets across all teams)</option>
                <option value="GROUP">Group Access (Tickets in assigned support groups)</option>
                <option value="ASSIGNED_ONLY">Restricted Access (Only assigned tickets)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Agent Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as AgentStatus })}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-2xs"
              >
                <option value="ACTIVE">Active</option>
                <option value="AWAY">Away / On Break</option>
                <option value="INACTIVE">Inactive / Deactivated</option>
              </select>
            </div>
          </div>

          {/* Role Checkboxes */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Assigned Roles * (Select one or more)
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {roles.map((role) => {
                const isSelected = form.role_ids.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRoleSelection(role.id)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="truncate">{role.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Support Group Checkboxes */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Assigned Support Groups / Teams
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {teams.map((team) => {
                const isSelected = form.team_ids.includes(team.id);
                return (
                  <label
                    key={team.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTeamSelection(team.id)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span className="truncate">{team.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Language & Time Zone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Language
              </label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Time Zone
              </label>
              <select
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ENHANCED AGENT EMAIL SIGNATURE BLOCK UI */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight">Agent Email Signature Block</h4>
                  <p className="text-2xs text-slate-500">Appended to outgoing ticket replies and notification emails</p>
                </div>
              </div>

              {/* Edit / Preview Tabs */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSignatureTab('edit')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-2xs font-bold rounded-lg transition-all ${
                    signatureTab === 'edit'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Code className="w-3 h-3" /> Edit Text
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureTab('preview')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-2xs font-bold rounded-lg transition-all ${
                    signatureTab === 'preview'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Eye className="w-3 h-3" /> Live Email Preview
                </button>
              </div>
            </div>

            {/* Template Presets Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-2xs">
              <span className="font-bold text-slate-600">Quick Templates:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applySignaturePreset('corporate')}
                  className="px-2 py-1 bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700 font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-1"
                >
                  🏢 Standard Corporate
                </button>
                <button
                  type="button"
                  onClick={() => applySignaturePreset('modern')}
                  className="px-2 py-1 bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700 font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-1"
                >
                  ✨ Modern Professional
                </button>
                <button
                  type="button"
                  onClick={() => applySignaturePreset('minimal')}
                  className="px-2 py-1 bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700 font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-1"
                >
                  ⚡ Minimalist
                </button>
              </div>
            </div>

            {/* Dynamic Placeholder Insertion Chips */}
            <div className="space-y-1">
              <div className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Insert Dynamic Placeholder Variables</div>
              <div className="flex flex-wrap gap-1 text-2xs">
                {[
                  { tag: '{{first_name}}', label: 'First Name' },
                  { tag: '{{last_name}}', label: 'Last Name' },
                  { tag: '{{job_title}}', label: 'Job Title' },
                  { tag: '{{email}}', label: 'Email' },
                  { tag: '{{phone}}', label: 'Phone' },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertSignatureVariable(item.tag)}
                    className="px-2 py-0.5 bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-blue-200/80 font-mono font-semibold rounded-md transition-all flex items-center gap-1"
                    title={`Click to append ${item.tag} variable`}
                  >
                    + {item.tag}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB CONTENT */}
            {signatureTab === 'edit' ? (
              <div className="space-y-1">
                <textarea
                  value={form.signature}
                  onChange={(e) => setForm({ ...form, signature: e.target.value })}
                  placeholder="--&#10;{{first_name}} {{last_name}}&#10;{{job_title}} | AIV Support Desk&#10;Email: {{email}}"
                  rows={4}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 leading-relaxed shadow-inner focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
                <div className="flex items-center justify-between text-2xs text-slate-400">
                  <span>Supports plain text formatting and dynamic placeholder tags</span>
                  <span>{form.signature.length} characters</span>
                </div>
              </div>
            ) : (
              /* LIVE PREVIEW TAB */
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-blue-500" /> Outgoing Email Sample Response
                  </span>
                  <span className="text-2xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                    Live Render Preview
                  </span>
                </div>

                {/* Dummy Reply Text */}
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  Hello Customer, thank you for reaching out. We have updated your ticket status and our team is investigating your request.
                </p>

                {/* Rendered Signature Block */}
                <div className="pt-2 border-t-2 border-slate-200 space-y-2">
                  {form.signature ? (
                    <div className="flex items-start gap-3 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                      <Avatar
                        firstName={form.first_name || 'Sarah'}
                        lastName={form.last_name || 'Connor'}
                        size="md"
                      />
                      <div className="space-y-1 text-xs text-slate-800 font-sans">
                        <pre className="font-sans text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {getRenderedSignature(form.signature)}
                        </pre>
                        <div className="pt-1 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" /> Verified Agent
                          </span>
                          <span className="text-2xs text-slate-400">AIV Support Portal</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No signature text entered yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving Agent...' : editingAgent ? 'Update Agent' : 'Create Agent'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
