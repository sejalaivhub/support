import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Spinner, EmptyState, Button, Input, Select } from '@/components/ui';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badges';
import { formatRelativeTime, PRIORITY_LABELS, STATUS_LABELS } from '@/lib/constants';
import type { Ticket, TicketPriority, TicketStatus } from '@/types';
import { Ticket as TicketIcon, Plus, Search } from 'lucide-react';

export function TicketList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const loadTickets = useCallback(async () => {
    setLoading(true);

    let deletedIds: string[] = [];
    try {
      deletedIds = JSON.parse(localStorage.getItem('deleted_ticket_ids') || '[]');
    } catch (e) {}

    let customTickets: Ticket[] = [];
    try {
      customTickets = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
    } catch (e) {}

    if (!profile?.account_id) {
      setTickets(customTickets.filter((t) => !deletedIds.includes(t.id)));
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('tickets')
        .select('*')
        .eq('account_id', profile.account_id)
        .order('created_at', { ascending: false });

      if (profile.user_type === 'customer_user') {
        const { data: account } = await supabase
          .from('accounts')
          .select('customer_ticket_visibility')
          .eq('id', profile.account_id)
          .maybeSingle();

        if (account?.customer_ticket_visibility === 'OWN_ONLY') {
          query = query.eq('created_by_user_id', profile.id);
        }
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const combined = [...customTickets, ...(data as Ticket[])];
        const uniqueMap = new Map();
        combined.forEach(t => uniqueMap.set(t.id, t));
        setTickets(Array.from(uniqueMap.values()).filter((t) => !deletedIds.includes(t.id)));
      } else {
        setTickets(customTickets.filter((t) => !deletedIds.includes(t.id)));
      }
    } catch (e) {
      setTickets(customTickets.filter((t) => !deletedIds.includes(t.id)));
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const filtered = tickets.filter((t) => {
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.ticket_number.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  if (loading) return <Spinner label="Loading tickets..." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => navigate('/portal/tickets/new')}>
          <Plus className="w-4 h-4" /> New Ticket
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket number or subject..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{value} - {label}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<TicketIcon className="w-12 h-12" />}
            title="No tickets found"
            description="Try adjusting your filters or create a new ticket."
            action={<Link to="/portal/tickets/new"><Button size="sm"><Plus className="w-4 h-4" /> Create Ticket</Button></Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5">Ticket</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden md:table-cell">Subject</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Priority</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/portal/tickets/${ticket.id}`)}>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono text-blue-600 font-medium">{ticket.ticket_number}</span>
                      <p className="text-sm text-gray-900 md:hidden mt-0.5">{ticket.subject}</p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <p className="text-sm text-gray-900 truncate max-w-xs">{ticket.subject}</p>
                    </td>
                    <td className="px-3 py-3"><PriorityBadge priority={ticket.customer_priority || ticket.priority} label="Cust" /></td>
                    <td className="px-3 py-3"><StatusBadge status={ticket.status} /></td>
                    <td className="px-3 py-3 hidden lg:table-cell text-sm text-gray-500">{formatRelativeTime(ticket.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
