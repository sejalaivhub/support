import { useEffect, useState, useCallback } from 'react';
import { dbClient } from '@/lib/dbClient';
import { Card, CardBody, CardHeader, Spinner } from '@/components/ui';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badges';
import { formatRelativeTime, getSlaStatus } from '@/lib/constants';
import type { TicketWithRelations, TicketSlaSnapshot } from '@/types';
import { BarChart3, TrendingUp, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [slaSnapshots, setSlaSnapshots] = useState<Record<string, TicketSlaSnapshot>>({});
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    resolved: 0,
    closed: 0,
    breached: 0,
    avgResolutionHours: 0,
    byPriority: { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<string, number>,
    byStatus: {} as Record<string, number>,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await dbClient
      .from('tickets')
      .select(`
        *,
        accounts(id, company_name, account_code),
        created_by_user:profiles!tickets_created_by_user_id_fkey(id, first_name, last_name),
        assigned_agent:profiles!tickets_assigned_agent_id_fkey(id, first_name, last_name),
        assigned_team:support_teams(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (data) {
      setTickets(data as unknown as TicketWithRelations[]);

      const ids = (data as any[]).map((t: any) => t.id);
      if (ids.length > 0) {
        const { data: slaData } = await dbClient
          .from('ticket_sla_snapshots')
          .select('*')
          .in('ticket_id', ids)
          .order('created_at', { ascending: false });
        if (slaData) {
          const map: Record<string, TicketSlaSnapshot> = {};
          (slaData as any[]).forEach((s: any) => { if (!map[s.ticket_id]) map[s.ticket_id] = s as TicketSlaSnapshot; });
          setSlaSnapshots(map);
        }
      }

      const byPriority = { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<string, number>;
      const byStatus = {} as Record<string, number>;
      let resolvedCount = 0;
      let totalResolutionMs = 0;

      (data as any[]).forEach((t: any) => {
        byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        if (t.status === 'RESOLVED' || t.status === 'CLOSED') {
          resolvedCount++;
          if (t.resolved_at) {
            totalResolutionMs += new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
          }
        }
      });

      setStats({
        total: (data as any[]).length,
        open: (data as any[]).filter((t: any) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length,
        resolved: (data as any[]).filter((t: any) => t.status === 'RESOLVED').length,
        closed: (data as any[]).filter((t: any) => t.status === 'CLOSED').length,
        breached: (data as any[]).filter((t: any) => t.first_response_breached).length,
        avgResolutionHours: resolvedCount > 0 ? (totalResolutionMs / resolvedCount) / (1000 * 60 * 60) : 0,
        byPriority,
        byStatus,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner label="Loading reports..." />;

  const maxPriority = Math.max(...Object.values(stats.byPriority), 1);
  const recentBreached = tickets.filter((t) => t.first_response_breached).slice(0, 10);

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Ticket metrics, SLA performance, and trends</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tickets" value={stats.total} icon={BarChart3} color="text-blue-600 bg-blue-50" />
        <StatCard label="Open" value={stats.open} icon={Clock} color="text-amber-600 bg-amber-50" />
        <StatCard label="SLA Breached" value={stats.breached} icon={AlertTriangle} color="text-red-600 bg-red-50" />
        <StatCard label="Avg Resolution" value={`${stats.avgResolutionHours.toFixed(1)}h`} icon={TrendingUp} color="text-green-600 bg-green-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Tickets by Priority" />
          <CardBody className="space-y-3">
            {Object.entries(stats.byPriority).map(([priority, count]) => (
              <div key={priority} className="flex items-center gap-3">
                <div className="w-16"><PriorityBadge priority={priority as any} /></div>
                <div className="flex-1">
                  <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${priority === 'P1' ? 'bg-red-500' : priority === 'P2' ? 'bg-orange-500' : priority === 'P3' ? 'bg-blue-500' : 'bg-gray-400'}`}
                      style={{ width: `${(count / maxPriority) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 w-8 text-right">{count}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tickets by Status" />
          <CardBody>
            <div className="space-y-2">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <StatusBadge status={status as any} />
                  <span className="text-sm font-semibold text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="SLA Breached Tickets" subtitle={`${recentBreached.length} ticket${recentBreached.length !== 1 ? 's' : ''} with breached first response`} />
        {recentBreached.length === 0 ? (
          <CardBody>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-5 h-5" /> No SLA breaches - all tickets responded to on time.
            </div>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5">Ticket</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden md:table-cell">Account</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Priority</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 hidden lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentBreached.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono text-blue-600">{t.ticket_number}</span>
                      <p className="text-sm text-gray-900 truncate max-w-xs">{t.subject}</p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell text-sm text-gray-700">{t.accounts?.company_name || '—'}</td>
                    <td className="px-3 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-3 py-3 hidden lg:table-cell text-sm text-gray-500">{formatRelativeTime(t.created_at)}</td>
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

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof BarChart3; color: string }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </CardBody>
    </Card>
  );
}
