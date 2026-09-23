import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Input, Textarea, Modal, Spinner } from '@/components/ui';
import { Badge } from '@/components/ui/Badges';
import {
  Shield, ShieldCheck, Plus, Search, Pencil, Trash2, Users, Check, X,
  FileText, BookOpen, UserCheck, BarChart3, Settings, AlertCircle, Info, RefreshCw
} from 'lucide-react';
import {
  getStoredRoles, saveRole, deleteRole, getStoredAgents,
  FULL_PERMISSIONS, STANDARD_AGENT_PERMISSIONS
} from '@/lib/agentRoleService';
import type { Role, TicketAccessScope, RolePermissionMatrix } from '@/types/agentRole';

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [agents, setAgents] = useState(getStoredAgents());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'tickets' | 'solutions' | 'customers' | 'analytics' | 'admin'>('tickets');

  const [form, setForm] = useState<{
    name: string;
    description: string;
    ticket_scope: TicketAccessScope;
    permissions: RolePermissionMatrix;
  }>({
    name: '',
    description: '',
    ticket_scope: 'GROUP',
    permissions: JSON.parse(JSON.stringify(STANDARD_AGENT_PERMISSIONS)),
  });

  const loadData = useCallback(() => {
    setLoading(true);
    const loadedRoles = getStoredRoles();
    const loadedAgents = getStoredAgents();
    setRoles(loadedRoles);
    setAgents(loadedAgents);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingRole(null);
    setForm({
      name: '',
      description: '',
      ticket_scope: 'GROUP',
      permissions: JSON.parse(JSON.stringify(STANDARD_AGENT_PERMISSIONS)),
    });
    setActiveTab('tickets');
    setShowModal(true);
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description,
      ticket_scope: role.ticket_scope,
      permissions: JSON.parse(JSON.stringify(role.permissions)),
    });
    setActiveTab('tickets');
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const roleToSave: Role = {
      id: editingRole ? editingRole.id : `role-custom-${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim(),
      is_system_role: editingRole ? editingRole.is_system_role : false,
      ticket_scope: form.ticket_scope,
      permissions: form.permissions,
      created_at: editingRole ? editingRole.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = saveRole(roleToSave);
    setRoles(updated);
    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = (roleId: string, roleName: string) => {
    if (confirm(`Are you sure you want to delete the custom role "${roleName}"?`)) {
      const updated = deleteRole(roleId);
      setRoles(updated);
    }
  };

  const setAllCategoryPermissions = (category: keyof RolePermissionMatrix, value: boolean) => {
    setForm((prev) => {
      const updatedCat = { ...prev.permissions[category] };
      Object.keys(updatedCat).forEach((k) => {
        (updatedCat as any)[k] = value;
      });
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [category]: updatedCat,
        },
      };
    });
  };

  const setAllPermissionsGlobal = (value: boolean) => {
    setForm((prev) => {
      const newPerms = JSON.parse(JSON.stringify(value ? FULL_PERMISSIONS : prev.permissions));
      if (!value) {
        Object.keys(newPerms).forEach((cat) => {
          Object.keys(newPerms[cat]).forEach((k) => {
            newPerms[cat][k] = false;
          });
        });
      }
      return {
        ...prev,
        permissions: newPerms,
      };
    });
  };

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase())
  );

  const systemRolesCount = roles.filter((r) => r.is_system_role).length;
  const customRolesCount = roles.filter((r) => !r.is_system_role).length;

  if (loading) return <Spinner label="Loading Agent Roles..." />;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Roles & Permissions</h1>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
              Freshworks Governance
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Provide and restrict fine-grained levels of access and administrative privileges for support agents.
          </p>
        </div>
        <Button onClick={openCreateModal} className="shadow-sm">
          <Plus className="w-4 h-4 mr-1.5" /> New Custom Role
        </Button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{roles.length}</div>
            <div className="text-xs font-medium text-slate-500">Total Configured Roles</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{systemRolesCount}</div>
            <div className="text-xs font-medium text-slate-500">Default System Roles</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{customRolesCount}</div>
            <div className="text-xs font-medium text-slate-500">Custom Organization Roles</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles by name or description..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-2xs transition-all"
        />
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRoles.map((role) => {
          const assignedAgents = agents.filter((a) => a.role_ids.includes(role.id));
          const totalPermsCount = Object.values(role.permissions).reduce((acc, cat) => {
            return acc + Object.values(cat).filter(Boolean).length;
          }, 0);

          return (
            <div
              key={role.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Title & Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{role.name}</h3>
                      {role.is_system_role ? (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-2xs font-bold rounded-md border border-slate-200">
                          System Role
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-2xs font-bold rounded-md border border-emerald-200">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{role.description}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditModal(role)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Permissions & Details"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {!role.is_system_role && (
                      <button
                        onClick={() => handleDelete(role.id, role.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Custom Role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Scope & Active Perm Highlights */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-2xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Ticket Scope: {role.ticket_scope}
                  </span>
                  <span className="text-2xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                    {totalPermsCount} Active Permissions
                  </span>
                </div>

                {/* Granular Chips */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Access Capability Overview</div>
                  <div className="flex flex-wrap gap-1 text-2xs">
                    {role.permissions.tickets.view && <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-md">View Tickets</span>}
                    {role.permissions.tickets.reply_customer && <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md">Public Replies</span>}
                    {role.permissions.tickets.add_internal_note && <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md">Internal Notes</span>}
                    {role.permissions.solutions.publish && <span className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-md">Publish Solutions</span>}
                    {role.permissions.analytics.view_reports && <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md">Analytics Access</span>}
                    {role.permissions.admin.manage_agents && <span className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded-md">Manage Agents</span>}
                  </div>
                </div>
              </div>

              {/* Footer Assigned Agents */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600">
                    {assignedAgents.length} assigned agent{assignedAgents.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex -space-x-1.5">
                  {assignedAgents.slice(0, 4).map((agent) => (
                    <div
                      key={agent.id}
                      className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-2xs flex items-center justify-center border-2 border-white shadow-2xs"
                      title={`${agent.first_name} ${agent.last_name}`}
                    >
                      {agent.first_name[0]}{agent.last_name[0]}
                    </div>
                  ))}
                  {assignedAgents.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-2xs flex items-center justify-center border-2 border-white">
                      +{assignedAgents.length - 4}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT ROLE PERMISSION MATRIX MODAL */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Custom Role'}
        size="xl"
      >
        <div className="space-y-5">
          {/* Header Info Banner */}
          <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold">Freshworks Granular Access Control</p>
              <p className="text-blue-700 mt-0.5">
                Configure fine-grained permissions for this role across tickets, knowledge base, customers, analytics, and admin module settings.
              </p>
            </div>
          </div>

          {/* Basic Role Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Role Name *"
              placeholder="e.g. Tier 2 Support Lead"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Default Ticket Access Scope
              </label>
              <select
                value={form.ticket_scope}
                onChange={(e) => setForm({ ...form, ticket_scope: e.target.value as TicketAccessScope })}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-2xs"
              >
                <option value="GLOBAL">Global Access (All tickets across all teams)</option>
                <option value="GROUP">Group Access (Tickets assigned to agent's teams)</option>
                <option value="ASSIGNED_ONLY">Restricted Access (Only tickets assigned to the agent)</option>
              </select>
            </div>
          </div>

          <Textarea
            label="Role Description"
            placeholder="Describe the duties and administrative privileges associated with this role..."
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            rows={2}
          />

          {/* PERMISSION MATRIX SECTION */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            {/* Permission Tabs Header */}
            <div className="bg-slate-100 border-b border-slate-200 flex items-center justify-between px-3 pt-2">
              <div className="flex gap-1 overflow-x-auto">
                {[
                  { id: 'tickets', label: 'Tickets', icon: FileText },
                  { id: 'solutions', label: 'Knowledge Base', icon: BookOpen },
                  { id: 'customers', label: 'Customers', icon: UserCheck },
                  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                  { id: 'admin', label: 'Admin Settings', icon: Settings },
                ].map((tab) => {
                  const IconComp = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-t-xl transition-all ${
                        isActive
                          ? 'bg-white text-blue-700 border-t-2 border-x border-slate-200 border-t-blue-600 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Select All / Clear All */}
              <div className="flex items-center gap-2 py-1">
                <button
                  type="button"
                  onClick={() => setAllCategoryPermissions(activeTab, true)}
                  className="text-2xs font-bold text-blue-600 hover:text-blue-800 hover:underline px-2 py-1"
                >
                  Select Tab All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setAllCategoryPermissions(activeTab, false)}
                  className="text-2xs font-bold text-slate-500 hover:text-slate-700 hover:underline px-2 py-1"
                >
                  Clear Tab
                </button>
              </div>
            </div>

            {/* Permissions Checkbox Grid Content */}
            <div className="p-5">
              {/* TICKETS PERMISSIONS */}
              {activeTab === 'tickets' && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ticket Management Capabilities</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'view', label: 'View Helpdesk Tickets', desc: 'Can browse and read support ticket details' },
                      { key: 'create', label: 'Create New Tickets', desc: 'Can submit new tickets on behalf of customers' },
                      { key: 'edit', label: 'Edit Ticket Fields & Properties', desc: 'Can change priority, status, type, and tags' },
                      { key: 'assign', label: 'Assign & Reassign Tickets', desc: 'Can assign tickets to agents and teams' },
                      { key: 'reply_customer', label: 'Send Public Replies to Customers', desc: 'Can post customer-visible responses' },
                      { key: 'add_internal_note', label: 'Add Private Internal Notes', desc: 'Can communicate internally with team members' },
                      { key: 'merge', label: 'Merge Duplicate Tickets', desc: 'Can merge related tickets into single thread' },
                      { key: 'export', label: 'Export Ticket Data & CSV', desc: 'Can download bulk ticket records' },
                      { key: 'delete', label: 'Delete Tickets', desc: 'Can permanently remove tickets from system' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/50 hover:bg-blue-50/30 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={(form.permissions.tickets as any)[item.key]}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              permissions: {
                                ...form.permissions,
                                tickets: {
                                  ...form.permissions.tickets,
                                  [item.key]: e.target.checked,
                                },
                              },
                            })
                          }
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">{item.label}</div>
                          <div className="text-2xs text-slate-500 leading-tight mt-0.5">{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* SOLUTIONS PERMISSIONS */}
              {activeTab === 'solutions' && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Knowledge Base & Solution Articles</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'view', label: 'View Knowledge Base Articles', desc: 'Can read public and internal solution docs' },
                      { key: 'create_draft', label: 'Create & Edit Draft Articles', desc: 'Can draft solutions for support issues' },
                      { key: 'publish', label: 'Publish Articles Live', desc: 'Can approve and publish KB articles publicly' },
                      { key: 'delete', label: 'Delete KB Solutions', desc: 'Can purge solution documentation' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/50 hover:bg-blue-50/30 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={(form.permissions.solutions as any)[item.key]}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              permissions: {
                                ...form.permissions,
                                solutions: {
                                  ...form.permissions.solutions,
                                  [item.key]: e.target.checked,
                                },
                              },
                            })
                          }
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">{item.label}</div>
                          <div className="text-2xs text-slate-500 leading-tight mt-0.5">{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* CUSTOMERS PERMISSIONS */}
              {activeTab === 'customers' && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Customer & Company Management</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'view', label: 'View Customer Profiles & Accounts', desc: 'Can search contact lists and company accounts' },
                      { key: 'create_edit', label: 'Create & Edit Customer Contacts', desc: 'Can add or modify end-user details' },
                      { key: 'delete', label: 'Delete Customer Profiles', desc: 'Can delete customer accounts from helpdesk' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/50 hover:bg-blue-50/30 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={(form.permissions.customers as any)[item.key]}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              permissions: {
                                ...form.permissions,
                                customers: {
                                  ...form.permissions.customers,
                                  [item.key]: e.target.checked,
                                },
                              },
                            })
                          }
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">{item.label}</div>
                          <div className="text-2xs text-slate-500 leading-tight mt-0.5">{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* ANALYTICS PERMISSIONS */}
              {activeTab === 'analytics' && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Reports & Helpdesk Analytics</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'view_reports', label: 'View Helpdesk Reports', desc: 'Can access SLA, ticket volume, and performance reports' },
                      { key: 'export_reports', label: 'Export Analytics Reports', desc: 'Can download PDF / CSV analytics metrics' },
                      { key: 'manage_dashboards', label: 'Manage Analytics Dashboards', desc: 'Can create and configure custom reporting widgets' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/50 hover:bg-blue-50/30 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={(form.permissions.analytics as any)[item.key]}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              permissions: {
                                ...form.permissions,
                                analytics: {
                                  ...form.permissions.analytics,
                                  [item.key]: e.target.checked,
                                },
                              },
                            })
                          }
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">{item.label}</div>
                          <div className="text-2xs text-slate-500 leading-tight mt-0.5">{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* ADMIN RIGHTS PERMISSIONS */}
              {activeTab === 'admin' && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Helpdesk Administration & Security</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'manage_agents', label: 'Manage Agents & Invites', desc: 'Can create, edit, deactivate, and invite support agents' },
                      { key: 'manage_roles', label: 'Manage Roles & Access Levels', desc: 'Can create and modify role permission matrices' },
                      { key: 'manage_teams', label: 'Manage Support Teams & Groups', desc: 'Can create and assign support groups' },
                      { key: 'manage_settings', label: 'Manage System & Email Settings', desc: 'Can configure SMTP, SLA policies, and business calendars' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/50 hover:bg-blue-50/30 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={(form.permissions.admin as any)[item.key]}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              permissions: {
                                ...form.permissions,
                                admin: {
                                  ...form.permissions.admin,
                                  [item.key]: e.target.checked,
                                },
                              },
                            })
                          }
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">{item.label}</div>
                          <div className="text-2xs text-slate-500 leading-tight mt-0.5">{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllPermissionsGlobal(true)}
                className="text-2xs font-bold text-blue-600 hover:underline"
              >
                Grant Full Administrator Access
              </button>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
