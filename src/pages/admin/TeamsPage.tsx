import { useEffect, useState, useCallback } from 'react';
import { dbClient } from '@/lib/dbClient';
import { Card, Spinner, Button, Input, Textarea, Modal, EmptyState } from '@/components/ui';
import { Badge, Avatar } from '@/components/ui/Badges';
import { fullName } from '@/lib/constants';
import type { SupportTeam, Profile } from '@/types';
import { Plus, Pencil, Users, Trash2 } from 'lucide-react';

export function TeamsPage() {
  const [teams, setTeams] = useState<(SupportTeam & { members?: Profile[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SupportTeam | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: teamData } = await dbClient.from('support_teams').select('*').order('name');
    if (teamData) {
      const teamsWithMembers = await Promise.all(
        (teamData as SupportTeam[]).map(async (team) => {
          const { data: members } = await dbClient
            .from('support_team_members')
            .select('user:profiles(*)')
            .eq('team_id', team.id);
          return { ...team, members: (members || []).map((m: any) => m.user) };
        })
      );
      setTeams(teamsWithMembers as any[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await dbClient.from('support_teams').update({ name: form.name, description: form.description || null, is_active: form.is_active, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await dbClient.from('support_teams').insert({ name: form.name, description: form.description || null, is_active: form.is_active });
    }
    setSaving(false);
    setShowModal(false);
    load();
  };

  if (loading) return <Spinner label="Loading teams..." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Teams</h1>
          <p className="text-sm text-gray-500 mt-1">{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: '', description: '', is_active: true }); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> New Team
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <Card key={team.id}>
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={team.is_active ? 'green' : 'gray'}>{team.is_active ? 'Active' : 'Inactive'}</Badge>
                  <button onClick={() => { setEditing(team); setForm({ name: team.name, description: team.description || '', is_active: team.is_active }); setShowModal(true); }} className="p-1 text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-base font-semibold text-gray-900">{team.name}</h3>
              {team.description && <p className="text-sm text-gray-600 mt-1">{team.description}</p>}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">{team.members?.length || 0} member{(team.members?.length || 0) !== 1 ? 's' : ''}</p>
                <div className="flex flex-wrap gap-1.5">
                  {team.members?.slice(0, 5).map((m) => (
                    <div key={m.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full pr-2">
                      <Avatar firstName={m.first_name} lastName={m.last_name} size="sm" />
                      <span className="text-xs text-gray-700">{m.first_name}</span>
                    </div>
                  ))}
                  {(team.members?.length || 0) > 5 && <span className="text-xs text-gray-500 self-center">+{(team.members?.length || 0) - 5} more</span>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Team' : 'New Team'}>
        <div className="space-y-4">
          <Input label="Team Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Textarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={2} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            <span className="text-gray-700">Active</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
