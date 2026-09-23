import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Spinner } from '@/components/ui';
import { getStoredAgents, getStoredRoles } from '@/lib/agentRoleService';
import { dbClient } from '@/lib/dbClient';
import type { Agent, AgentType, Role } from '@/types/agentRole';
import type { SupportTeam } from '@/types';
import { Search, Download, Plus, Settings, ChevronDown, CheckCircle2, ChevronRight } from 'lucide-react';

export function AgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teams, setTeams] = useState<SupportTeam[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'support' | 'collaborator' | 'deactivated'>('support');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const loadedAgents = getStoredAgents();
    const loadedRoles = getStoredRoles();
    setAgents(loadedAgents);
    setRoles(loadedRoles);

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

  if (loading) return <Spinner label="Loading..." />;

  // Filter based on tabs
  let filteredAgents = agents;
  if (activeTab === 'support') {
    filteredAgents = agents.filter(a => a.job_title !== 'Collaborator' && a.status === 'ACTIVE');
  } else if (activeTab === 'collaborator') {
    filteredAgents = agents.filter(a => a.job_title === 'Collaborator' && a.status === 'ACTIVE');
  } else if (activeTab === 'deactivated') {
    filteredAgents = agents.filter(a => a.status === 'INACTIVE');
  }

  // Filter based on search
  if (search) {
    const q = search.toLowerCase();
    filteredAgents = filteredAgents.filter(a => 
      `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) || 
      a.email.toLowerCase().includes(q)
    );
  }

  const supportAgentsCount = agents.filter(a => a.job_title !== 'Collaborator' && a.status === 'ACTIVE').length;
  const collaboratorsCount = agents.filter(a => a.job_title === 'Collaborator' && a.status === 'ACTIVE').length;
  const deactivatedCount = agents.filter(a => a.status === 'INACTIVE').length;

  return (
    <div className="flex h-full bg-[#f5f7f9] overflow-hidden">
      <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar relative">
        <div className="max-w-[1400px] w-full mx-auto p-4 md:p-6 lg:p-8 flex gap-8">
          
          {/* MAIN CONTENT AREA */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-[24px] font-bold text-[#12344d]">Agents</h1>
              
              <div className="flex items-center gap-3 text-[13px]">
                <div className="text-[#475867] flex items-center gap-1.5">
                  Seats Available <span className="bg-[#12344d] text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold">7</span>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#cfd7df] text-[#12344d] font-semibold rounded bg-white hover:bg-[#f5f7f9]">
                  <Download className="w-4 h-4" /> Export
                </button>
                <button 
                  onClick={() => navigate('/admin/agents/new')}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2c5cc5] hover:bg-[#1f4287] text-white font-medium rounded"
                >
                  <Plus className="w-4 h-4" /> New agent
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-6 w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475867]" />
              <input
                type="text"
                placeholder="Search for agents"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-[#cfd7df] rounded bg-white text-[13px] focus:border-[#2c5cc5] focus:outline-none focus:ring-1 focus:ring-[#2c5cc5]"
              />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#cfd7df] mb-4 text-[14px]">
              <button 
                onClick={() => setActiveTab('support')}
                className={`px-4 py-2 flex items-center gap-2 border-b-2 font-medium ${activeTab === 'support' ? 'border-[#2c5cc5] text-[#2c5cc5]' : 'border-transparent text-[#475867] hover:text-[#12344d]'}`}
              >
                Support Agents <span className="bg-[#ebeff3] text-[#2c5cc5] px-1.5 rounded-full text-[12px]">{supportAgentsCount}</span>
              </button>
              <button 
                onClick={() => setActiveTab('collaborator')}
                className={`px-4 py-2 flex items-center gap-2 border-b-2 font-medium ${activeTab === 'collaborator' ? 'border-[#2c5cc5] text-[#2c5cc5]' : 'border-transparent text-[#475867] hover:text-[#12344d]'}`}
              >
                Collaborators <span className="text-[#475867] text-[12px]">{collaboratorsCount}</span>
              </button>
              <button 
                onClick={() => setActiveTab('deactivated')}
                className={`px-4 py-2 flex items-center gap-2 border-b-2 font-medium ${activeTab === 'deactivated' ? 'border-[#2c5cc5] text-[#2c5cc5]' : 'border-transparent text-[#475867] hover:text-[#12344d]'}`}
              >
                Deactivated Agents <span className="text-[#475867] text-[12px]">{deactivatedCount}</span>
              </button>
            </div>

            {/* Filters bar */}
            <div className="flex items-center justify-between mb-4 text-[13px]">
              <div className="flex items-center gap-2 text-[#475867]">
                Sort by: <button className="font-semibold text-[#12344d] flex items-center gap-1">Name <ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
              <div>
                <button className="flex items-center gap-2 px-3 py-1.5 border border-[#cfd7df] rounded bg-white text-[#12344d]">
                  All agents ({filteredAgents.length}) <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-[#ebeff3] rounded overflow-hidden shadow-sm">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-[#f5f7f9] border-b border-[#ebeff3] text-[#475867] font-semibold">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Add-on access</th>
                    <th className="px-4 py-3 font-semibold">Roles</th>
                    <th className="px-4 py-3 font-semibold">Groups</th>
                    <th className="px-4 py-3 font-semibold">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[#475867]">
                        No agents found.
                      </td>
                    </tr>
                  ) : (
                    filteredAgents.map(agent => {
                      const agentRoles = roles.filter(r => agent.role_ids.includes(r.id));
                      const agentTeams = teams.filter(t => agent.team_ids.includes(t.id));
                      
                      // Handle the case where we just created an agent or want to show initials
                      const initials = `${agent.first_name.charAt(0)}${agent.last_name ? agent.last_name.charAt(0) : ''}`.toUpperCase();
                      
                      // For Freddy AI Copilot logic, let's just randomly assign it to the first user or based on email if requested
                      const isSejal = agent.first_name.toLowerCase() === 'sejal';

                      return (
                        <tr key={agent.id} className="border-b border-[#ebeff3] hover:bg-[#fcfdfd] group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold ${isSejal ? 'bg-[#9281f2]' : 'bg-[#f4d160] text-yellow-900'}`}>
                                {initials}
                              </div>
                              <div>
                                <div className="font-semibold text-[#12344d] cursor-pointer group-hover:text-[#2c5cc5]">{agent.first_name} {agent.last_name}</div>
                                <div className="text-[#475867] text-[12px]">{agent.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#475867]">
                            {isSejal ? 'Freddy AI copilot' : '--'}
                          </td>
                          <td className="px-4 py-3 text-[#475867]">
                            {agentRoles.length > 0 ? (
                              <div>
                                {agentRoles[0].name}
                                {agentRoles.length > 1 && <span className="text-[#2c5cc5] ml-1">+{agentRoles.length - 1}</span>}
                              </div>
                            ) : (
                              '--'
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#475867]">
                            {agentTeams.length > 0 ? (
                              <div>
                                {agentTeams[0].name}
                                {agentTeams.length > 1 && <span className="text-[#2c5cc5] ml-1">+{agentTeams.length - 1}</span>}
                              </div>
                            ) : (
                              '--'
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#475867] italic text-[12px]">
                            {isSejal ? '43 minutes ago' : 'No recent activity'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
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
    </div>
  );
}
