import { useEffect, useState, useCallback } from 'react';
import { dbClient } from '@/lib/dbClient';
import { Card, Spinner, EmptyState, Button, Input, Select, Modal } from '@/components/ui';
import { Badge } from '@/components/ui/Badges';
import type { Account, SupportPlan, SupportTeam } from '@/types';
import { Building2, Plus, Search, Pencil } from 'lucide-react';

const DEMO_PLANS: SupportPlan[] = [
  { id: 'plan-1', name: 'Standard Support', code: 'STANDARD', description: 'Business hours support', allow_24x7_p1: false, active: true, support_channels: ['EMAIL', 'WEB'], business_calendar_id: null, max_customer_users: 10, internal_notes: null, sort_order: 1 },
  { id: 'plan-2', name: 'Premium Support', code: 'PREMIUM', description: '24x7 support for critical', allow_24x7_p1: true, active: true, support_channels: ['EMAIL', 'WEB', 'PHONE'], business_calendar_id: null, max_customer_users: 50, internal_notes: null, sort_order: 2 },
  { id: 'plan-3', name: 'Enterprise Support', code: 'ENTERPRISE', description: '15-min response SLA', allow_24x7_p1: true, active: true, support_channels: ['EMAIL', 'WEB', 'PHONE', 'SLACK'], business_calendar_id: null, max_customer_users: null, internal_notes: null, sort_order: 3 },
];

const DEMO_TEAMS: SupportTeam[] = [
  { id: 'team-1', name: 'Tier 1 Support', description: 'Frontline support team', is_active: true },
  { id: 'team-2', name: 'Tier 2 Engineering', description: 'Deep technical engineering team', is_active: true },
  { id: 'team-3', name: 'Account Management', description: 'Customer success & account managers', is_active: true },
];

const DEMO_ACCOUNTS: (Account & { support_plans?: { name: string; code: string } })[] = [
  { id: 'acc-1', account_code: 'ACME001', company_name: 'Acme Corp', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-1', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: 'team-1', account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), support_plans: { name: 'Standard Support', code: 'STANDARD' } },
  { id: 'acc-2', account_code: 'GLOB001', company_name: 'Globex Inc', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-2', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: 'team-2', account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), support_plans: { name: 'Premium Support', code: 'PREMIUM' } },
  { id: 'acc-3', account_code: 'INIT001', company_name: 'Initech', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-3', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: 'team-3', account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), support_plans: { name: 'Enterprise Support', code: 'ENTERPRISE' } },
];

export function AccountsPage() {
  const [accounts, setAccounts] = useState<(Account & { support_plans?: { name: string; code: string } })[]>(DEMO_ACCOUNTS);
  const [plans, setPlans] = useState<SupportPlan[]>(DEMO_PLANS);
  const [teams, setTeams] = useState<SupportTeam[]>(DEMO_TEAMS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    account_code: '',
    company_name: '',
    status: 'ACTIVE',
    country: '',
    timezone: 'UTC',
    support_plan_id: '',
    support_team_id: '',
    customer_ticket_visibility: 'OWN_ONLY',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await dbClient
        .from('accounts')
        .select('*, support_plans(name, code)')
        .order('company_name');
      if (data && data.length > 0) setAccounts(data as any[]);
    } catch (e) {}

    try {
      const { data: planData } = await dbClient.from('support_plans').select('*').eq('active', true).order('sort_order');
      if (planData && planData.length > 0) setPlans(planData as SupportPlan[]);
    } catch (e) {}

    try {
      const { data: teamData } = await dbClient.from('support_teams').select('*').eq('is_active', true).order('name');
      if (teamData && teamData.length > 0) setTeams(teamData as SupportTeam[]);
    } catch (e) {}

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ account_code: '', company_name: '', status: 'ACTIVE', country: '', timezone: 'UTC', support_plan_id: '', support_team_id: '', customer_ticket_visibility: 'OWN_ONLY' });
    setShowModal(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setForm({
      account_code: account.account_code,
      company_name: account.company_name,
      status: account.status,
      country: account.country || '',
      timezone: account.timezone,
      support_plan_id: account.support_plan_id || '',
      support_team_id: account.support_team_id || '',
      customer_ticket_visibility: account.customer_ticket_visibility,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const payload = {
      account_code: form.account_code,
      company_name: form.company_name,
      status: form.status,
      country: form.country || null,
      timezone: form.timezone,
      support_plan_id: form.support_plan_id || null,
      support_team_id: form.support_team_id || null,
      customer_ticket_visibility: form.customer_ticket_visibility,
    };

    const selectedPlan = plans.find((p) => p.id === form.support_plan_id);

    const newAcc: Account & { support_plans?: { name: string; code: string } } = {
      id: editing ? editing.id : `acc-${Date.now()}`,
      account_code: form.account_code,
      company_name: form.company_name,
      status: form.status as any,
      country: form.country || null,
      timezone: form.timezone,
      support_plan_id: form.support_plan_id || null,
      support_team_id: form.support_team_id || null,
      customer_ticket_visibility: form.customer_ticket_visibility as any,
      entitlement_source: 'MANUAL',
      external_account_id: null,
      support_start_date: null,
      support_end_date: null,
      account_manager_id: null,
      support_manager_id: null,
      business_calendar_id: null,
      notes_internal: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      support_plans: selectedPlan ? { name: selectedPlan.name, code: selectedPlan.code } : undefined,
    };

    if (editing) {
      setAccounts((prev) => prev.map((a) => (a.id === editing.id ? newAcc : a)));
    } else {
      setAccounts((prev) => [newAcc, ...prev]);
    }

    try {
      if (editing) {
        await dbClient.from('accounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      } else {
        await dbClient.from('accounts').insert(payload);
      }
    } catch (err) {
      // ignore offline/fetch errors
    }

    setSaving(false);
    setShowModal(false);
  };


  const filtered = accounts.filter((a) =>
    !search || a.company_name.toLowerCase().includes(search.toLowerCase()) || a.account_code.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner label="Loading accounts..." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">{accounts.length} customer account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> New Account</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Building2 className="w-12 h-12" />} title="No accounts found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5">Company</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden md:table-cell">Code</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden lg:table-cell">Plan</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden lg:table-cell">Visibility</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900">{a.company_name}</p>
                      <p className="text-xs text-gray-500">{a.country || '—'}</p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell text-sm font-mono text-gray-600">{a.account_code}</td>
                    <td className="px-3 py-3 hidden lg:table-cell text-sm text-gray-700">{a.support_plans?.name || '—'}</td>
                    <td className="px-3 py-3"><Badge color={a.status === 'ACTIVE' ? 'green' : a.status === 'SUSPENDED' ? 'amber' : 'red'}>{a.status}</Badge></td>
                    <td className="px-3 py-3 hidden lg:table-cell text-xs text-gray-500">{a.customer_ticket_visibility === 'OWN_ONLY' ? 'Own tickets only' : 'Account-wide'}</td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Account' : 'New Account'} size="lg">
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Company Name" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} required />
            <Input label="Account Code" value={form.account_code} onChange={(v) => setForm({ ...form, account_code: v })} required disabled={!!editing} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
            <Input label="Timezone" value={form.timezone} onChange={(v) => setForm({ ...form, timezone: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Support Plan" value={form.support_plan_id} onChange={(v) => setForm({ ...form, support_plan_id: v })} placeholder="Select plan"
              options={plans.map((p) => ({ value: p.id, label: p.name }))} />
            <Select label="Support Team" value={form.support_team_id} onChange={(v) => setForm({ ...form, support_team_id: v })} placeholder="Select team"
              options={teams.map((t) => ({ value: t.id, label: t.name }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })}
              options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'SUSPENDED', label: 'Suspended' }, { value: 'EXPIRED', label: 'Expired' }, { value: 'DISABLED', label: 'Disabled' }]} />
            <Select label="Ticket Visibility" value={form.customer_ticket_visibility} onChange={(v) => setForm({ ...form, customer_ticket_visibility: v })}
              options={[{ value: 'OWN_ONLY', label: 'Own tickets only' }, { value: 'ACCOUNT_WIDE', label: 'Account-wide' }]} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.company_name || !form.account_code}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
