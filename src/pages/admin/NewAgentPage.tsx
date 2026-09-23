import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Spinner } from '@/components/ui';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { getStoredRoles, saveAgent } from '@/lib/agentRoleService';
import { dbClient } from '@/lib/dbClient';
import { sendAccountActivationEmail, sendNewAgentAddedNotification } from '@/lib/emailService';
import { useAuth } from '@/contexts/AuthContext';
import type { Agent, AgentType, TicketAccessScope, Role, AgentStatus } from '@/types/agentRole';
import type { SupportTeam } from '@/types';
import { ChevronRight, HelpCircle, Upload, Search, X } from 'lucide-react';

const TIMEZONES = [
  '(GMT+05:30) Chennai',
  'UTC +00:00 Universal / London',
  'UTC -05:00 Eastern Time (US & Canada)',
  'UTC -06:00 Central Time (US & Canada)',
  'UTC -08:00 Pacific Time (US & Canada)',
  'UTC +01:00 Central European Time',
  'UTC +05:30 India Standard Time',
];

const LANGUAGES = [
  'English',
  'English (US)',
  'English (UK)',
  'Spanish (Español)',
  'French (Français)',
];

export function NewAgentPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teams, setTeams] = useState<SupportTeam[]>([]);
  
  const [form, setForm] = useState<{
    email: string;
    timezone: string;
    language: string;
    signature: string;
    agent_type: AgentType;
    ticket_scope: TicketAccessScope;
    role_ids: string[];
    team_ids: string[];
    job_title: string;
  }>({
    email: '',
    timezone: '(GMT+05:30) Chennai',
    language: 'English',
    signature: '',
    agent_type: 'FULL_TIME',
    ticket_scope: 'ALL',
    role_ids: [],
    team_ids: [],
    job_title: 'Support agent',
  });

  const [apiKeyAccess, setApiKeyAccess] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const loadedRoles = getStoredRoles();
    setRoles(loadedRoles);
    
    // Automatically select the 'Agent' role if available
    const defaultRole = loadedRoles.find(r => r.name.toLowerCase() === 'agent');
    if (defaultRole) {
      setForm(prev => ({ ...prev, role_ids: [defaultRole.id] }));
    }

    try {
      const { data } = await dbClient.from('support_teams').select('*').order('name');
      if (data && data.length > 0) {
        setTeams(data as SupportTeam[]);
      }
    } catch (e) {
      // Ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleRole = (roleId: string) => {
    setForm(prev => {
      const exists = prev.role_ids.includes(roleId);
      if (exists) {
        return { ...prev, role_ids: prev.role_ids.filter(id => id !== roleId) };
      } else {
        return { ...prev, role_ids: [...prev.role_ids, roleId] };
      }
    });
    setRoleSearch('');
  };

  const toggleTeam = (teamId: string) => {
    setForm(prev => {
      const exists = prev.team_ids.includes(teamId);
      if (exists) {
        return { ...prev, team_ids: prev.team_ids.filter(id => id !== teamId) };
      } else {
        return { ...prev, team_ids: [...prev.team_ids, teamId] };
      }
    });
    setTeamSearch('');
  };

  const handleCreate = () => {
    if (!form.email.trim()) {
      alert('Email address is required.');
      return;
    }
    
    if (form.role_ids.length === 0) {
      alert('Please add at least one role.');
      return;
    }

    setSaving(true);
    
    // Parse email for first/last name since it's not in the UI
    const emailPrefix = form.email.split('@')[0];
    const parts = emailPrefix.split(/[\.\-_]/);
    const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Agent';
    const lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';

    const agentToSave: Agent = {
      id: `agent-custom-${Date.now()}`,
      first_name: firstName,
      last_name: lastName,
      email: form.email.trim(),
      phone: null,
      mobile: null,
      job_title: form.job_title,
      agent_type: form.agent_type,
      ticket_scope: form.ticket_scope,
      role_ids: form.role_ids,
      team_ids: form.team_ids,
      language: form.language,
      timezone: form.timezone,
      signature: form.signature.trim() || null,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveAgent(agentToSave);

    // Send emails
    try {
      sendAccountActivationEmail({
        id: agentToSave.id,
        first_name: agentToSave.first_name,
        last_name: agentToSave.last_name,
        email: agentToSave.email,
        user_type: 'agent',
      });

      const roleObj = roles.find(r => r.id === (form.role_ids[0] || ''));
      const roleName = roleObj ? roleObj.name : 'Agent';
      const addedByName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'System Admin';

      sendNewAgentAddedNotification({
        newAgentName: `${agentToSave.first_name} ${agentToSave.last_name}`.trim(),
        newAgentEmail: agentToSave.email,
        agentType: agentToSave.agent_type === 'FULL_TIME' ? 'Full time' : 'Occasional',
        roleName: roleName,
        addedByName: addedByName,
        fullTimeCount: 1, 
        occasionalCount: 0, 
      });
    } catch (e) {
      console.error(e);
    }

    setSaving(false);
    navigate('/admin/agents');
  };

  if (loading) return <Spinner label="Loading..." />;

  const filteredRoles = roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase()) && !form.role_ids.includes(r.id));
  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()) && !form.team_ids.includes(t.id));

  return (
    <div className="flex h-full bg-[#f5f7f9] overflow-hidden relative">
      <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar relative pb-20">
        <div className="max-w-[1200px] w-full mx-auto p-4 md:p-6 lg:p-8 flex gap-8">
          
          {/* MAIN FORM AREA */}
          <div className="flex-1 max-w-[800px] bg-white rounded-md border border-[#ebeff3] shadow-sm relative">
            <div className="p-6 border-b border-[#ebeff3]">
              <h1 className="text-xl font-bold text-[#12344d]">New agent</h1>
            </div>

            <div className="p-6 space-y-8">
              
              {/* Agent Type */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#12344d] mb-1">Agent type</label>
                  <select 
                    className="w-full max-w-[300px] px-3 py-2 border border-[#cfd7df] rounded bg-white text-[13px] text-[#12344d] focus:border-[#2c5cc5] focus:outline-none focus:ring-1 focus:ring-[#2c5cc5]"
                    value={form.job_title}
                    onChange={(e) => setForm(prev => ({ ...prev, job_title: e.target.value }))}
                  >
                    <option value="Support agent">Support agent</option>
                    <option value="Field agent">Field agent</option>
                    <option value="Collaborator">Collaborator</option>
                  </select>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="agent_type" 
                      checked={form.agent_type === 'FULL_TIME'}
                      onChange={() => setForm(prev => ({ ...prev, agent_type: 'FULL_TIME' }))}
                      className="mt-1 text-[#2c5cc5] focus:ring-[#2c5cc5]"
                    />
                    <div>
                      <div className="text-[14px] text-[#12344d] font-medium leading-none mt-1">Full time</div>
                      <div className="text-[12px] text-[#475867] mt-1">(7 seats available)</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="agent_type" 
                      checked={form.agent_type === 'OCCASIONAL'}
                      onChange={() => setForm(prev => ({ ...prev, agent_type: 'OCCASIONAL' }))}
                      className="mt-1 text-[#2c5cc5] focus:ring-[#2c5cc5]"
                    />
                    <div>
                      <div className="text-[14px] text-[#12344d] font-medium leading-none mt-1">Occasional</div>
                      <div className="text-[12px] text-[#475867] mt-1">(3 day passes available)</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Agent details */}
              <div>
                <h2 className="text-[14px] font-bold text-[#12344d] mb-4">Agent details</h2>
                
                <div className="space-y-6 max-w-[600px]">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#12344d] mb-1">
                      Email address <span className="text-[#d72d30]">*</span>
                    </label>
                    <input 
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cfd7df] rounded bg-white text-[13px] focus:border-[#2c5cc5] focus:outline-none focus:ring-1 focus:ring-[#2c5cc5]"
                    />
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full border border-dashed border-[#cfd7df] flex items-center justify-center bg-[#f5f7f9] overflow-hidden">
                      <div className="text-[#cfd7df] grid grid-cols-4 grid-rows-4 gap-0.5 opacity-50 p-2">
                         {/* Placeholder checkerboard pattern */}
                         {Array.from({length: 16}).map((_, i) => (
                           <div key={i} className={`w-full h-full rounded-[1px] ${i % 2 === 0 ? 'bg-[#cfd7df]' : 'bg-transparent'}`}></div>
                         ))}
                      </div>
                    </div>
                    <div className="pt-2">
                      <button className="text-[#2c5cc5] text-[13px] font-semibold hover:underline">Upload photo</button>
                      <p className="text-[12px] text-[#475867] mt-1 max-w-[250px] leading-tight">
                        An image of the person, it's best if it has the same length and height
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] text-[#475867] mb-1">Time zone</label>
                    <select 
                      className="w-full px-3 py-2 border border-[#cfd7df] rounded bg-white text-[13px] text-[#12344d] focus:border-[#2c5cc5] focus:outline-none"
                      value={form.timezone}
                      onChange={(e) => setForm(prev => ({ ...prev, timezone: e.target.value }))}
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[13px] text-[#475867] mb-1">Language</label>
                    <select 
                      className="w-full px-3 py-2 border border-[#cfd7df] rounded bg-white text-[13px] text-[#12344d] focus:border-[#2c5cc5] focus:outline-none"
                      value={form.language}
                      onChange={(e) => setForm(prev => ({ ...prev, language: e.target.value }))}
                    >
                      {LANGUAGES.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[13px] text-[#475867] mb-1">Signature</label>
                    <div className="border border-[#cfd7df] rounded overflow-hidden">
                      <RichTextEditor
                        value={form.signature}
                        onChange={(val) => setForm(prev => ({ ...prev, signature: val }))}
                        placeholder="Signature"
                        minHeight={150}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div>
                <h2 className="text-[14px] font-bold text-[#12344d] mb-1">Settings</h2>
                
                <div className="space-y-6 mt-4">
                  
                  {/* Roles */}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <label className="text-[13px] font-bold text-[#12344d]">Roles</label>
                    </div>
                    <p className="text-[12px] text-[#475867] mb-2">Determines the features that an agent can access</p>
                    
                    <div className="relative border border-[#cfd7df] rounded p-1.5 flex flex-wrap gap-1.5 items-center bg-white min-h-[38px] max-w-[600px]">
                      {form.role_ids.map(roleId => {
                        const role = roles.find(r => r.id === roleId);
                        if (!role) return null;
                        return (
                          <div key={role.id} className="flex items-center gap-1 bg-[#ebeff3] text-[#12344d] px-2 py-1 rounded text-[13px]">
                            {role.name}
                            <button onClick={() => toggleRole(role.id)} className="text-[#475867] hover:text-[#12344d]">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex-1 min-w-[120px]">
                        <input
                          type="text"
                          placeholder={form.role_ids.length === 0 ? "Add roles" : ""}
                          value={roleSearch}
                          onChange={(e) => setRoleSearch(e.target.value)}
                          className="w-full text-[13px] border-none focus:ring-0 p-1 bg-transparent"
                        />
                      </div>
                      
                      {roleSearch && filteredRoles.length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white border border-[#cfd7df] shadow-lg rounded mt-1 z-10 max-h-48 overflow-y-auto">
                          {filteredRoles.map(r => (
                            <div 
                              key={r.id} 
                              className="px-3 py-2 text-[13px] text-[#12344d] hover:bg-[#f5f7f9] cursor-pointer"
                              onClick={() => toggleRole(r.id)}
                            >
                              {r.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scope for ticket visibility */}
                  <div>
                    <label className="block text-[13px] font-semibold text-[#12344d] mb-3">Scope for ticket visibility:</label>
                    <div className="space-y-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="ticket_scope" 
                          checked={form.ticket_scope === 'ALL'}
                          onChange={() => setForm(prev => ({ ...prev, ticket_scope: 'ALL' }))}
                          className="mt-1 text-[#2c5cc5] focus:ring-[#2c5cc5]"
                        />
                        <div>
                          <div className="text-[13px] text-[#12344d] font-medium leading-none mt-1">All tickets</div>
                          <div className="text-[12px] text-[#475867] mt-0.5">Can view and edit all tickets</div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="ticket_scope" 
                          checked={form.ticket_scope === 'GROUP'}
                          onChange={() => setForm(prev => ({ ...prev, ticket_scope: 'GROUP' }))}
                          className="mt-1 text-[#2c5cc5] focus:ring-[#2c5cc5]"
                        />
                        <div>
                          <div className="text-[13px] text-[#12344d] font-medium leading-none mt-1">Tickets in a group</div>
                          <div className="text-[12px] text-[#475867] mt-0.5">Can view and edit tickets in their group(s) and tickets assigned to them</div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="ticket_scope" 
                          checked={form.ticket_scope === 'ASSIGNED'}
                          onChange={() => setForm(prev => ({ ...prev, ticket_scope: 'ASSIGNED' }))}
                          className="mt-1 text-[#2c5cc5] focus:ring-[#2c5cc5]"
                        />
                        <div>
                          <div className="text-[13px] text-[#12344d] font-medium leading-none mt-1">Assigned tickets</div>
                          <div className="text-[12px] text-[#475867] mt-0.5">Can view and edit tickets assigned to them</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Groups */}
                  <div>
                    <label className="block text-[13px] font-semibold text-[#12344d] mb-1">Organize agents into groups:</label>
                    <p className="text-[12px] text-[#475867] mb-2">Add to groups</p>
                    <div className="relative border border-[#cfd7df] rounded p-1.5 flex flex-wrap gap-1.5 items-center bg-white min-h-[38px] max-w-[600px]">
                      {form.team_ids.map(teamId => {
                        const team = teams.find(t => t.id === teamId);
                        if (!team) return null;
                        return (
                          <div key={team.id} className="flex items-center gap-1 bg-[#ebeff3] text-[#12344d] px-2 py-1 rounded text-[13px]">
                            {team.name}
                            <button onClick={() => toggleTeam(team.id)} className="text-[#475867] hover:text-[#12344d]">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex-1 min-w-[120px]">
                        <input
                          type="text"
                          placeholder={form.team_ids.length === 0 ? "Choose groups" : ""}
                          value={teamSearch}
                          onChange={(e) => setTeamSearch(e.target.value)}
                          className="w-full text-[13px] border-none focus:ring-0 p-1 bg-transparent"
                        />
                      </div>
                      
                      {teamSearch && filteredTeams.length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white border border-[#cfd7df] shadow-lg rounded mt-1 z-10 max-h-48 overflow-y-auto">
                          {filteredTeams.map(t => (
                            <div 
                              key={t.id} 
                              className="px-3 py-2 text-[13px] text-[#12344d] hover:bg-[#f5f7f9] cursor-pointer"
                              onClick={() => toggleTeam(t.id)}
                            >
                              {t.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Security and permission */}
              <div>
                <h2 className="text-[14px] font-bold text-[#12344d] mb-3 mt-4">Security and permission</h2>
                <div className="border border-[#cfd7df] rounded p-4 flex items-center justify-between bg-white max-w-[600px]">
                  <div>
                    <div className="text-[14px] font-bold text-[#12344d]">API Key access</div>
                    <div className="text-[13px] text-[#475867]">Grant API key access to the agent</div>
                  </div>
                  <button 
                    onClick={() => setApiKeyAccess(!apiKeyAccess)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${apiKeyAccess ? 'bg-[#2c5cc5]' : 'bg-[#cfd7df]'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${apiKeyAccess ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT SIDEBAR (Help text) */}
          <div className="hidden lg:block w-[280px] shrink-0">
            <div className="sticky top-6 space-y-6">
              <div>
                <h3 className="text-[14px] font-bold text-[#12344d] mb-2">Agents</h3>
                <p className="text-[13px] text-[#475867] leading-relaxed mb-3">
                  Full time agents are those in your support team who will login to your help desk every day.
                </p>
                <p className="text-[13px] text-[#475867] leading-relaxed">
                  Occasional agents are those who would need to use your Freshdesk infrequently. You will need to purchase a day pass for their access to Freshdesk. <a href="#" className="text-[#2c5cc5] hover:underline">Learn more</a>
                </p>
              </div>
              
              <div>
                <h3 className="text-[14px] font-bold text-[#12344d] mb-2">Collaborators</h3>
                <p className="text-[13px] text-[#475867] leading-relaxed mb-3">
                  Collaborators can be people in your organization or third party contacts whose input is needed to resolve a customer ticket. They will have restricted access to Freshdesk.
                </p>
                <p className="text-[13px] text-[#475867] leading-relaxed mb-3">
                  Ticket collaborators can be assigned/tagged to tickets, and can add or edit private notes, update ticket status, modify their time entries, and view related customer information. <a href="#" className="text-[#2c5cc5] hover:underline">Learn more</a>
                </p>
                <p className="text-[13px] text-[#475867] leading-relaxed">
                  Analytics collaborators can view reports in the Analytics module.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      {/* Sticky footer for action buttons attached to the bottom of the form area */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#ebeff3] p-4 flex gap-3 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-[1200px] w-full mx-auto px-4 flex gap-3">
          <Button onClick={handleCreate} disabled={saving} className="bg-[#2c5cc5] hover:bg-[#1f4287] text-white font-medium rounded h-8 px-4 text-[13px]">
            {saving ? 'Creating...' : 'Create agent'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/agents')} disabled={saving} className="h-8 px-4 text-[13px] font-medium border-[#cfd7df] text-[#12344d] hover:bg-[#f5f7f9] rounded">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
