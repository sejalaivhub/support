import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, EmptyState, Button, Input, Select, Modal } from '@/components/ui';
import { Avatar, Badge } from '@/components/ui/Badges';
import { fullName } from '@/lib/constants';
import type { Profile, Account } from '@/types';
import { Users, Plus, Search, Pencil, Trash2, Mail } from 'lucide-react';
import { sendAccountActivationEmail } from '@/lib/emailService';

const USER_TYPES = [
  { value: 'customer_user', label: 'Customer User' },
  { value: 'customer_admin', label: 'Customer Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'manager', label: 'Manager' },
  { value: 'account_manager', label: 'Account Manager' },
  { value: 'admin', label: 'Admin' },
];

const DEMO_ACCOUNTS: Account[] = [
  { id: 'acc-1', account_code: 'ACME001', company_name: 'Acme Corp', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-1', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: 'team-1', account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'acc-2', account_code: 'GLOB001', company_name: 'Globex Inc', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-2', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: 'team-2', account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'acc-3', account_code: 'INIT001', company_name: 'Initech', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-3', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: 'team-3', account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const DEMO_USERS: (Profile & { accounts?: { company_name: string } })[] = [
  { id: 'user-1', email: 'john.smith@acme.com', auth_uid: null, first_name: 'John', last_name: 'Smith', user_type: 'customer_user', account_id: 'acc-1', status: 'active', phone: '+1 555-0192', mobile: null, job_title: 'IT Lead', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), accounts: { company_name: 'Acme Corp' } },
  { id: 'user-2', email: 'bob@acme.com', auth_uid: null, first_name: 'Bob', last_name: 'Jones', user_type: 'customer_user', account_id: 'acc-1', status: 'active', phone: '+1 555-0144', mobile: null, job_title: 'Developer', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), accounts: { company_name: 'Acme Corp' } },
  { id: 'user-3', email: 'alice@globex.com', auth_uid: null, first_name: 'Alice', last_name: 'Johnson', user_type: 'customer_admin', account_id: 'acc-2', status: 'active', phone: '+1 555-0188', mobile: null, job_title: 'VP Tech', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), accounts: { company_name: 'Globex Inc' } },
  { id: 'user-4', email: 'peter@initech.com', auth_uid: null, first_name: 'Peter', last_name: 'Gibbons', user_type: 'customer_user', account_id: 'acc-3', status: 'active', phone: '+1 555-0122', mobile: null, job_title: 'Engineer', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), accounts: { company_name: 'Initech' } },
  { id: 'user-agent-1', email: 'sarah.connor@aivsupport.com', auth_uid: null, first_name: 'Sarah', last_name: 'Connor', user_type: 'agent', account_id: null, status: 'active', phone: '+1 555-0100', mobile: null, job_title: 'Senior Specialist', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'user-admin-1', email: 'admin@aivsupport.com', auth_uid: null, first_name: 'System', last_name: 'Admin', user_type: 'admin', account_id: null, status: 'active', phone: '+1 555-0101', mobile: null, job_title: 'System Admin', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export function UsersPage() {
  const [users, setUsers] = useState<(Profile & { accounts?: { company_name: string } })[]>(DEMO_USERS);
  const [accounts, setAccounts] = useState<Account[]>(DEMO_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    user_type: 'customer_user',
    account_id: '',
    status: 'active',
    job_title: '',
    phone: ''
  });

  const load = useCallback(async () => {
    setLoading(true);

    let fetchedUsers: (Profile & { accounts?: { company_name: string } })[] = [];

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*, accounts(company_name)')
        .order('created_at', { ascending: false });
      if (data && data.length > 0) {
        fetchedUsers = data as any[];
      }
    } catch (e) {}

    // Local Storage custom users
    let customUsers: any[] = [];
    try {
      customUsers = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
    } catch (e) {}

    let deletedUserIds: string[] = [];
    try {
      deletedUserIds = JSON.parse(localStorage.getItem('deleted_user_ids') || '[]');
    } catch (e) {}

    let combinedUsers = fetchedUsers.length > 0
      ? [...customUsers, ...fetchedUsers]
      : [...customUsers, ...DEMO_USERS];

    combinedUsers = combinedUsers.filter((u) => !deletedUserIds.includes(u.id));
    setUsers(combinedUsers);

    // Load Accounts dropdown
    try {
      const { data: acctData } = await supabase.from('accounts').select('*').eq('status', 'ACTIVE').order('company_name');
      if (acctData && acctData.length > 0) {
        setAccounts(acctData as Account[]);
      } else {
        setAccounts(DEMO_ACCOUNTS);
      }
    } catch (e) {
      setAccounts(DEMO_ACCOUNTS);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      first_name: '',
      last_name: '',
      email: '',
      user_type: 'customer_user',
      account_id: accounts.length > 0 ? accounts[0].id : '',
      status: 'active',
      job_title: '',
      phone: ''
    });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (user: Profile) => {
    setEditing(user);
    setForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      user_type: user.user_type,
      account_id: user.account_id || '',
      status: user.status,
      job_title: user.job_title || '',
      phone: user.phone || ''
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError('First name, last name, and email are required fields.');
      return;
    }

    setSaving(true);
    setError(null);

    const selectedAcct = accounts.find((a) => a.id === form.account_id);

    const newUser: Profile & { accounts?: { company_name: string } } = {
      id: editing ? editing.id : `user-custom-${Date.now()}`,
      auth_uid: null,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      user_type: form.user_type as any,
      account_id: ['customer_user', 'customer_admin'].includes(form.user_type) ? form.account_id || null : null,
      status: form.status as any,
      job_title: form.job_title.trim() || null,
      phone: form.phone.trim() || null,
      mobile: null,
      created_at: editing ? editing.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      accounts: selectedAcct ? { company_name: selectedAcct.company_name } : undefined,
    };

    // Update local React state instantly
    if (editing) {
      setUsers((prev) => prev.map((u) => (u.id === editing.id ? newUser : u)));
    } else {
      setUsers((prev) => [newUser, ...prev]);

      // Save custom user to localStorage
      try {
        const custom = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
        localStorage.setItem('local_custom_users', JSON.stringify([newUser, ...custom]));
      } catch (e) {}
    }

    // Try Supabase insert/update
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        user_type: form.user_type,
        account_id: ['customer_user', 'customer_admin'].includes(form.user_type) ? form.account_id || null : null,
        status: form.status,
        job_title: form.job_title.trim() || null,
        phone: form.phone.trim() || null,
      };

      if (editing) {
        await supabase.from('profiles').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      } else {
        await supabase.from('profiles').insert({ id: newUser.id, ...payload });

        // Dispatch Account Activation Invitation Email
        sendAccountActivationEmail({
          id: newUser.id,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          email: newUser.email,
          user_type: newUser.user_type,
          account_name: selectedAcct?.company_name,
        });
      }
    } catch (e) {}

    setSaving(false);
    setShowModal(false);
  };

  const handleDeleteUser = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this user contact?')) return;

    setUsers((prev) => prev.filter((u) => u.id !== id));

    try {
      const existingDeleted: string[] = JSON.parse(localStorage.getItem('deleted_user_ids') || '[]');
      const updatedDeleted = Array.from(new Set([...existingDeleted, id]));
      localStorage.setItem('deleted_user_ids', JSON.stringify(updatedDeleted));
    } catch (e) {}

    try {
      const custom: any[] = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
      const updatedCustom = custom.filter((u) => u.id !== id);
      localStorage.setItem('local_custom_users', JSON.stringify(updatedCustom));
    } catch (e) {}

    try {
      await supabase.from('profiles').delete().eq('id', id);
    } catch (e) {}
  };

  const filtered = users.filter((u) => {
    if (search) {
      const s = search.toLowerCase();
      if (!`${u.first_name} ${u.last_name}`.toLowerCase().includes(s) && !u.email.toLowerCase().includes(s)) return false;
    }
    if (typeFilter !== 'all' && u.user_type !== typeFilter) return false;
    return true;
  });

  if (loading) return <Spinner label="Loading contacts & users..." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contacts & Users</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} total contact{users.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> New User
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white cursor-pointer"
          >
            <option value="all">All Types</option>
            {USER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Users className="w-12 h-12" />} title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-medium text-gray-500">
                  <th className="px-5 py-2.5">User</th>
                  <th className="px-3 py-2.5 hidden md:table-cell">Type</th>
                  <th className="px-3 py-2.5 hidden lg:table-cell">Company / Account</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar firstName={u.first_name} lastName={u.last_name} size="sm" />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{fullName(u.first_name, u.last_name)}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <Badge color={u.user_type.includes('customer') ? 'blue' : u.user_type === 'admin' ? 'red' : 'purple'}>
                        {u.user_type.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell text-sm font-medium text-gray-700">
                      {u.accounts?.company_name || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Badge color={u.status === 'active' ? 'green' : u.status === 'pending' ? 'amber' : 'gray'}>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit user"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteUser(u.id, e)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit User' : 'New User'} size="lg">
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name *" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} required />
            <Input label="Last Name *" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} required />
          </div>
          <Input label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required disabled={!!editing} />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="User Type"
              value={form.user_type}
              onChange={(v) => setForm({ ...form, user_type: v })}
              options={USER_TYPES}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'pending', label: 'Pending' },
                { value: 'disabled', label: 'Disabled' },
                { value: 'invited', label: 'Invited' }
              ]}
            />
          </div>
          {['customer_user', 'customer_admin'].includes(form.user_type) && (
            <Select
              label="Account / Company"
              value={form.account_id}
              onChange={(v) => setForm({ ...form, account_id: v })}
              placeholder="Select account"
              options={accounts.map((a) => ({ value: a.id, label: a.company_name }))}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Job Title" value={form.job_title} onChange={(v) => setForm({ ...form, job_title: v })} />
            <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name || !form.email}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
