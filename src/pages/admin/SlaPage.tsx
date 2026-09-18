import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, Button, Input, Select } from '@/components/ui';
import { Badge } from '@/components/ui/Badges';
import { formatDuration } from '@/lib/constants';
import type { SlaPolicy, SupportPlan } from '@/types';
import { Plus, Save, BarChart3 } from 'lucide-react';

const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;

export function SlaPage() {
  const [plans, setPlans] = useState<SupportPlan[]>([]);
  const [policies, setPolicies] = useState<Record<string, SlaPolicy[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: planData } = await supabase.from('support_plans').select('*').order('sort_order');
    if (planData) setPlans(planData as SupportPlan[]);

    const { data: slaData } = await supabase.from('sla_policies').select('*');
    if (slaData) {
      const map: Record<string, SlaPolicy[]> = {};
      slaData.forEach((s) => {
        const p = s as SlaPolicy;
        if (!map[p.support_plan_id]) map[p.support_plan_id] = [];
        map[p.support_plan_id].push(p);
      });
      setPolicies(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (planId: string, priority: string, field: string, value: string) => {
    const planPolicies = policies[planId] || [];
    const existing = planPolicies.find((p) => p.priority === priority);
    if (!existing) return;

    const update: any = { updated_at: new Date().toISOString() };
    update[field] = field.includes('minutes') ? parseInt(value) : value;

    await supabase.from('sla_policies').update(update).eq('id', existing.id);
    const key = `${planId}-${priority}-${field}`;
    setEditing((prev) => { const next = { ...prev }; delete next[key]; return next; });
    load();
  };

  if (loading) return <Spinner label="Loading SLA policies..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SLA Policies</h1>
        <p className="text-sm text-gray-500 mt-1">Configure response and resolution targets per plan and priority</p>
      </div>

      {plans.map((plan) => (
        <Card key={plan.id}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{plan.name}</h3>
              <p className="text-xs text-gray-500">{plan.code}</p>
            </div>
            <Badge color={plan.active ? 'green' : 'gray'}>{plan.active ? 'Active' : 'Inactive'}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5">Priority</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">First Response</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Resolution</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden md:table-cell">Clock</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden lg:table-cell">Pause on Customer Wait</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {PRIORITIES.map((p) => {
                  const policy = (policies[plan.id] || []).find((pol) => pol.priority === p);
                  if (!policy) return (
                    <tr key={p}>
                      <td className="px-5 py-3 text-sm font-medium text-gray-700">{p}</td>
                      <td colSpan={4} className="px-3 py-3 text-sm text-gray-400">No SLA policy configured</td>
                    </tr>
                  );
                  return (
                    <tr key={p}>
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-gray-900">{p}</span>
                      </td>
                      <td className="px-3 py-3">
                        <SlaCell policyId={`${plan.id}-${p}-first_response_target_minutes`} value={policy.first_response_target_minutes} unit="min" onSave={(v) => handleSave(plan.id, p, 'first_response_target_minutes', v)} editing={editing} setEditing={setEditing} />
                      </td>
                      <td className="px-3 py-3">
                        <SlaCell policyId={`${plan.id}-${p}-resolution_target_minutes`} value={policy.resolution_target_minutes} unit="min" onSave={(v) => handleSave(plan.id, p, 'resolution_target_minutes', v)} editing={editing} setEditing={setEditing} />
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <Badge color={policy.clock_type === 'calendar' ? 'purple' : 'blue'}>
                          {policy.clock_type === 'calendar' ? '24x7' : 'Business Hours'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <Badge color={policy.pause_on_customer_wait ? 'green' : 'gray'}>
                          {policy.pause_on_customer_wait ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SlaCell({ policyId, value, unit, onSave, editing, setEditing }: {
  policyId: string;
  value: number;
  unit: string;
  onSave: (v: string) => void;
  editing: Record<string, string>;
  setEditing: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  const isEditing = policyId in editing;
  const displayValue = formatDuration(value);
  return (
    <div className="flex items-center gap-2">
      {isEditing ? (
        <>
          <input
            type="number"
            value={editing[policyId]}
            onChange={(e) => setEditing((prev) => ({ ...prev, [policyId]: e.target.value }))}
            className="w-20 px-2 py-1 rounded border border-gray-300 text-sm"
            autoFocus
          />
          <span className="text-xs text-gray-500">{unit}</span>
          <button onClick={() => onSave(editing[policyId])} className="p-1 text-green-600 hover:bg-green-50 rounded">
            <Save className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="text-sm text-gray-700">{displayValue}</span>
          <button
            onClick={() => setEditing((prev) => ({ ...prev, [policyId]: value.toString() }))}
            className="text-xs text-blue-600 hover:underline"
          >
            Edit
          </button>
        </>
      )}
    </div>
  );
}
