import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Spinner, EmptyState, Button } from '@/components/ui';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badges';
import { formatRelativeTime, getSlaStatus, PRIORITY_LABELS, STATUS_LABELS } from '@/lib/constants';
import type { TicketWithRelations, TicketSlaSnapshot, TicketPriority, TicketStatus } from '@/types';
import { Ticket as TicketIcon, Search, Inbox } from 'lucide-react';

export function AgentQueue() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') || 'all';
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [slaSnapshots, setSlaSnapshots] = useState<Record<string, TicketSlaSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    let query = supabase
      .from('tickets')
      .select(`
        *,
        accounts(id, company_name, account_code),
        created_by_user:profiles!tickets_created_by_user_id_fkey(id, first_name, last_name, email),
        assigned_agent:profiles!tickets_assigned_agent_id_fkey(id, first_name, last_name),
        assigned_team:support_teams(id, name),
        ticket_types(id, name),
        ticket_categories(id, name)
      `)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (filter === 'mine') {
      query = query.eq('assigned_agent_id', profile.id).not('status', 'in', '("CLOSED","CANCELLED")');
    } else if (filter === 'unassigned') {
      query = query.is('assigned_agent_id', null).not('status', 'in', '("CLOSED","CANCELLED","RESOLVED")');
    } else if (filter === 'breached') {
      query = query.eq('first_response_breached', true).not('status', 'in', '("CLOSED","CANCELLED","RESOLVED")');
    } else {
      query = query.not('status', 'in', '("CLOSED","CANCELLED")');
    }

    const { data } = await query;
    if (data) {
      setTickets(data as unknown as TicketWithRelations[]);
      const ids = data.map((t) => t.id);
      if (ids.length > 0) {
        const { data: slaData } = await supabase
          .from('ticket_sla_snapshots')
          .select('*')
          .in('ticket_id', ids)
          .order('created_at', { ascending: false });
        if (slaData) {
          const map: Record<string, TicketSlaSnapshot> = {};
          slaData.forEach((s) => { if (!map[s.ticket_id]) map[s.ticket_id] = s as TicketSlaSnapshot; });
          setSlaSnapshots(map);
        }
      }
    }
    setLoading(false);
  }, [profile, filter]);

  useEffect(() => { load(); }, [load]);

  const filtered = tickets.filter((t) => {
    if (search) {
      const s = search.toLowerCase();
      if (!t.subject.toLowerCase().includes(s) && !t.ticket_number.toLowerCase().includes(s) && !(t.accounts?.company_name?.toLowerCase().includes(s))) return false;
    }
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const filterLabel = filter === 'mine' ? 'My Tickets' : filter === 'unassigned' ? 'Unassigned' : filter === 'breached' ? 'SLA Breached' : 'All Open';

  if (loading) return <Spinner label="Loading ticket queue..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ticket Queue</h1>
        <p className="text-sm text-gray-500 mt-1">{filterLabel} - {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white">
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white">
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{v} - {l}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Inbox className="w-12 h-12" />} title="No tickets in queue" description="Try adjusting your filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Ticket</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden md:table-cell">Account</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Priority</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden lg:table-cell">SLA</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden lg:table-cell">Agent</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden xl:table-cell">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((t) => {
                  const sla = slaSnapshots[t.id];
                  const slaStatus = getSlaStatus(sla?.resolution_due_at ?? null, t.first_response_breached);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/agent/tickets/${t.id}`)}>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-blue-600 font-medium">{t.ticket_number}</span>
                        <p className="text-sm text-gray-900 truncate max-w-xs mt-0.5">{t.subject}</p>
                        <p className="text-xs text-gray-500 md:hidden mt-0.5">{t.accounts?.company_name}</p>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <p className="text-sm text-gray-700">{t.accounts?.company_name || '—'}</p>
                        <p className="text-xs text-gray-400">{t.accounts?.account_code}</p>
                      </td>
                      <td className="px-3 py-3"><PriorityBadge priority={t.aiv_priority || t.priority} label="AIV" /></td>
                      <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        {sla ? <span className={`text-xs font-medium ${slaStatus.color}`}>{slaStatus.label}</span> : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <p className="text-sm text-gray-700">{t.assigned_agent ? `${t.assigned_agent.first_name} ${t.assigned_agent.last_name}` : 'Unassigned'}</p>
                      </td>
                      <td className="px-3 py-3 hidden xl:table-cell text-sm text-gray-500">{formatRelativeTime(t.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
