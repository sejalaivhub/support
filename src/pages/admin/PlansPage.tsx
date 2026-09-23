import { useEffect, useState, useCallback } from 'react';
import { dbClient } from '@/lib/dbClient';
import { Card, Spinner, Button, Input, Textarea, Select, Modal } from '@/components/ui';
import { Badge } from '@/components/ui/Badges';
import type { SupportPlan } from '@/types';
import { Plus, Pencil, Shield } from 'lucide-react';

export function PlansPage() {
  const [plans, setPlans] = useState<SupportPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SupportPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '', max_customer_users: '10', allow_24x7_p1: false, sort_order: '1', active: true });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await dbClient.from('support_plans').select('*').order('sort_order');
    if (data) setPlans(data as SupportPlan[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', description: '', max_customer_users: '10', allow_24x7_p1: false, sort_order: '1', active: true });
    setShowModal(true);
  };

  const openEdit = (plan: SupportPlan) => {
    setEditing(plan);
    setForm({
      code: plan.code, name: plan.name, description: plan.description || '',
      max_customer_users: plan.max_customer_users?.toString() || '10',
      allow_24x7_p1: plan.allow_24x7_p1, sort_order: plan.sort_order.toString(), active: plan.active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      code: form.code.toUpperCase(),
      name: form.name,
      description: form.description || null,
      max_customer_users: parseInt(form.max_customer_users) || null,
      allow_24x7_p1: form.allow_24x7_p1,
      sort_order: parseInt(form.sort_order) || 0,
      active: form.active,
    };
    if (editing) {
      await dbClient.from('support_plans').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await dbClient.from('support_plans').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    load();
  };

  if (loading) return <Spinner label="Loading plans..." />;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Plans</h1>
          <p className="text-sm text-gray-500 mt-1">{plans.length} plan{plans.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> New Plan</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className="hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={plan.active ? 'green' : 'gray'}>{plan.active ? 'Active' : 'Inactive'}</Badge>
                  <button onClick={() => openEdit(plan)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
              <p className="text-xs font-mono text-gray-500 mt-0.5">{plan.code}</p>
              {plan.description && <p className="text-sm text-gray-600 mt-2">{plan.description}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {plan.support_channels?.map((ch) => <Badge key={ch} color="blue">{ch}</Badge>)}
                {plan.allow_24x7_p1 && <Badge color="red">24x7 P1</Badge>}
                {plan.max_customer_users && <Badge>{plan.max_customer_users} users</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Plan' : 'New Plan'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Input label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} required disabled={!!editing} placeholder="PREMIUM" />
          </div>
          <Textarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={2} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Max Customer Users" type="number" value={form.max_customer_users} onChange={(v) => setForm({ ...form, max_customer_users: v })} />
            <Input label="Sort Order" type="number" value={form.sort_order} onChange={(v) => setForm({ ...form, sort_order: v })} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.allow_24x7_p1} onChange={(e) => setForm({ ...form, allow_24x7_p1: e.target.checked })} className="rounded" />
              <span className="text-gray-700">Allow 24x7 P1 support</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded" />
              <span className="text-gray-700">Active</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.code}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
