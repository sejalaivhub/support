import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, Button, Input, Modal, EmptyState } from '@/components/ui';
import { Badge } from '@/components/ui/Badges';
import type { TicketType, TicketCategory } from '@/types';
import { Plus, Pencil, Tag, Folder } from 'lucide-react';

export function CategoriesPage() {
  const [types, setTypes] = useState<TicketType[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'type' | 'category'>('type');
  const [editing, setEditing] = useState<{ id: string; name: string; is_active: boolean } | null>(null);
  const [form, setForm] = useState({ name: '', is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: typeData } = await supabase.from('ticket_types').select('*').order('sort_order');
    if (typeData) setTypes(typeData as TicketType[]);
    const { data: catData } = await supabase.from('ticket_categories').select('*').order('sort_order');
    if (catData) setCategories(catData as TicketCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (modalMode === 'type') {
      if (editing) {
        await supabase.from('ticket_types').update({ name: form.name, is_active: form.is_active, updated_at: new Date().toISOString() }).eq('id', editing.id);
      } else {
        await supabase.from('ticket_types').insert({ name: form.name, is_active: form.is_active, sort_order: types.length + 1 });
      }
    } else {
      if (editing) {
        await supabase.from('ticket_categories').update({ name: form.name, is_active: form.is_active, updated_at: new Date().toISOString() }).eq('id', editing.id);
      } else {
        await supabase.from('ticket_categories').insert({ name: form.name, is_active: form.is_active, sort_order: categories.length + 1 });
      }
    }
    setShowModal(false);
    load();
  };

  if (loading) return <Spinner label="Loading..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Types & Categories</h1>
        <p className="text-sm text-gray-500 mt-1">Manage ticket types and categories</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Ticket Types</h3>
            <Button size="sm" variant="ghost" onClick={() => { setModalMode('type'); setEditing(null); setForm({ name: '', is_active: true }); setShowModal(true); }}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
          <div className="divide-y divide-gray-50">
            {types.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <Tag className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{t.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={t.is_active ? 'green' : 'gray'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                  <button onClick={() => { setModalMode('type'); setEditing({ id: t.id, name: t.name, is_active: t.is_active }); setForm({ name: t.name, is_active: t.is_active }); setShowModal(true); }} className="p-1 text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {types.length === 0 && <EmptyState title="No types" />}
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Ticket Categories</h3>
            <Button size="sm" variant="ghost" onClick={() => { setModalMode('category'); setEditing(null); setForm({ name: '', is_active: true }); setShowModal(true); }}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
          <div className="divide-y divide-gray-50">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <Folder className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{c.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={c.is_active ? 'green' : 'gray'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
                  <button onClick={() => { setModalMode('category'); setEditing({ id: c.id, name: c.name, is_active: c.is_active }); setForm({ name: c.name, is_active: c.is_active }); setShowModal(true); }} className="p-1 text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 && <EmptyState title="No categories" />}
          </div>
        </Card>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={`${editing ? 'Edit' : 'New'} ${modalMode === 'type' ? 'Type' : 'Category'}`}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            <span className="text-gray-700">Active</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
