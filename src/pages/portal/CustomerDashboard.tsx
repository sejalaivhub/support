import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardBody, Spinner, EmptyState, Button } from '@/components/ui';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badges';
import { formatRelativeTime } from '@/lib/constants';
import type { Ticket } from '@/types';
import { Ticket as TicketIcon, Plus, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export function CustomerDashboard() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ open: 0, resolved: 0, waiting: 0, total: 0 });

  const loadTickets = useCallback(async () => {
    if (!profile?.account_id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let query = supabase
      .from('tickets')
      .select('*')
      .eq('account_id', profile.account_id)
      .order('created_at', { ascending: false })
      .limit(10);

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
    if (data) {
      setTickets(data as Ticket[]);
      setStats({
        open: data.filter((t) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length,
        resolved: data.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length,
        waiting: data.filter((t) => ['WAITING_FOR_CUSTOMER'].includes(t.status)).length,
        total: data.length,
      });
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  if (loading) return <Spinner label="Loading your dashboard..." />;

  const statCards = [
    { label: 'Open Tickets', value: stats.open, icon: TicketIcon, color: 'text-blue-600 bg-blue-50' },
    { label: 'Waiting for You', value: stats.waiting, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Total', value: stats.total, icon: AlertTriangle, color: 'text-gray-600 bg-gray-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your support tickets</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Recent Tickets</h3>
          <Link to="/portal/tickets/new">
            <Button size="sm" variant="primary">
              <Plus className="w-4 h-4" /> New Ticket
            </Button>
          </Link>
        </div>
        {tickets.length === 0 ? (
          <EmptyState
            icon={<TicketIcon className="w-12 h-12" />}
            title="No tickets yet"
            description="Create your first support ticket to get started."
            action={<Link to="/portal/tickets/new"><Button size="sm"><Plus className="w-4 h-4" /> Create Ticket</Button></Link>}
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <Link key={ticket.id} to={`/portal/tickets/${ticket.id}`} className="block px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">{ticket.ticket_number}</span>
                      <PriorityBadge priority={ticket.priority} />
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatRelativeTime(ticket.created_at)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
