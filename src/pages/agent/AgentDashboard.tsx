import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { fullName } from '@/lib/constants';
import type { TicketWithRelations } from '@/types';
import {
  Check, Plus, Clock, Filter, ChevronDown, BarChart2, TrendingUp,
  Inbox, AlertCircle, RefreshCw, Users, LineChart, Sparkles, X, Info,
  ArrowDown, Activity, BookOpen, UserCheck, Award, Layers, HelpCircle
} from 'lucide-react';

interface ActivityItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  ticketId: string;
}

const DEMO_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    title: 'New ticket created',
    desc: '#AIV-000003: Production API endpoint returning 500 errors',
    time: '5 minutes ago',
    ticketId: 't-3',
  },
  {
    id: 'act-2',
    title: 'Customer replied',
    desc: 'John Smith replied on ticket #AIV-000001',
    time: '20 minutes ago',
    ticketId: 't-1',
  },
  {
    id: 'act-3',
    title: 'SLA Warning',
    desc: 'Resolution target approaching for #AIV-000002',
    time: '1 hour ago',
    ticketId: 't-2',
  },
  {
    id: 'act-4',
    title: 'Agent assigned',
    desc: 'Alex Murphy assigned to ticket #AIV-000003',
    time: '2 hours ago',
    ticketId: 't-3',
  },
];

export function AgentDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // State for Switcher & Filters
  const [activeDashboard, setActiveDashboard] = useState<'my' | 'operations' | 'kb' | 'availability' | 'performance'>('my');
  const [selectedProduct, setSelectedProduct] = useState('All products');
  const [selectedSource, setSelectedSource] = useState('All sources');

  // Modals & Drawers
  const [showRecentActivities, setShowRecentActivities] = useState(false);
  const [showNewDashboardModal, setShowNewDashboardModal] = useState(false);
  const [customDashboards, setCustomDashboards] = useState<string[]>([]);
  const [newDashboardName, setNewDashboardName] = useState('');

  // Interactive Chart Tooltip State
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; label: string; count: number } | null>(null);

  // Live Metrics State
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [counts, setCounts] = useState({
    unresolved: 3,
    overdue: 2,
    dueToday: 2,
    open: 3,
    onHold: 0,
    unassigned: 0,
    resolved: 0,
    received: 0,
    avgResponseTime: '0m',
    avgResolutionTime: '0m',
  });

  const loadDashboardData = useCallback(async () => {
    setLoading(true);

    let allTickets: TicketWithRelations[] = [];

    try {
      const { data } = await dbClient.from('tickets').select(`
        *,
        accounts(id, company_name, account_code),
        created_by_user:profiles!tickets_created_by_user_id_fkey(id, first_name, last_name, email),
        assigned_agent:profiles!tickets_assigned_agent_id_fkey(id, first_name, last_name, email)
      `).order('created_at', { ascending: false });

      if (data && data.length > 0) {
        allTickets = data as unknown as TicketWithRelations[];
      }
    } catch (e) {}

    // Merge localStorage tickets for full accuracy
    try {
      const localTickets: TicketWithRelations[] = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
      allTickets = [...localTickets, ...allTickets];
    } catch (e) {}

    let deletedIds: string[] = [];
    try {
      deletedIds = JSON.parse(localStorage.getItem('deleted_ticket_ids') || '[]');
    } catch (e) {}

    if (allTickets.length === 0) {
      // Fallback demo dataset matching the Freshdesk UI
      allTickets = [
        { id: 't-1', ticket_number: 'AIV-000001', status: 'IN_PROGRESS', priority: 'P2', first_response_breached: false, assigned_agent_id: 'agent-1', created_at: new Date().toISOString() } as any,
        { id: 't-2', ticket_number: 'AIV-000002', status: 'NEW', priority: 'P3', first_response_breached: false, assigned_agent_id: null, created_at: new Date().toISOString() } as any,
        { id: 't-3', ticket_number: 'AIV-000003', status: 'OPEN', priority: 'P1', first_response_breached: true, assigned_agent_id: 'agent-2', created_at: new Date().toISOString() } as any,
      ];
    }

    allTickets = allTickets.filter((t) => !deletedIds.includes(t.id));
    setTickets(allTickets);

    // Compute metrics
    const unresolvedCount = allTickets.filter((t) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length;
    const openCount = allTickets.filter((t) => ['OPEN', 'NEW', 'IN_PROGRESS'].includes(t.status)).length;
    const overdueCount = allTickets.filter((t) => t.first_response_breached && !['RESOLVED', 'CLOSED'].includes(t.status)).length;
    const unassignedCount = allTickets.filter((t) => !t.assigned_agent_id && !['RESOLVED', 'CLOSED'].includes(t.status)).length;
    const onHoldCount = allTickets.filter((t) => t.status === 'WAITING_FOR_CUSTOMER').length;
    const resolvedCount = allTickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;

    setCounts({
      unresolved: unresolvedCount,
      overdue: overdueCount,
      dueToday: 0,
      open: openCount,
      onHold: onHoldCount,
      unassigned: unassignedCount,
      resolved: resolvedCount,
      received: 0,
      avgResponseTime: '0m',
      avgResolutionTime: '0m',
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleCreateCustomDashboard = () => {
    if (!newDashboardName.trim()) return;
    setCustomDashboards((prev) => [...prev, newDashboardName.trim()]);
    setNewDashboardName('');
    setShowNewDashboardModal(false);
  };

  // SVG Chart Hourly Data Points for Today & Yesterday
  const todayPoints = [
    { hour: '00:00', val: 0, x: 40, y: 180 },
    { hour: '04:00', val: 0, x: 120, y: 180 },
    { hour: '08:00', val: 1, x: 200, y: 130 },
    { hour: '12:00', val: 3, x: 280, y: 30 },
    { hour: '16:00', val: 1, x: 360, y: 130 },
    { hour: '20:00', val: 0, x: 440, y: 180 },
  ];

  const yesterdayPoints = [
    { hour: '00:00', val: 0, x: 40, y: 180 },
    { hour: '04:00', val: 0, x: 120, y: 180 },
    { hour: '08:00', val: 0, x: 200, y: 180 },
    { hour: '12:00', val: 1, x: 280, y: 130 },
    { hour: '16:00', val: 0, x: 360, y: 180 },
    { hour: '20:00', val: 0, x: 440, y: 180 },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* 1. TOP TRIAL & SETUP BANNER (Matching Freshdesk screenshot) */}
      <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border border-blue-100 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-blue-950 font-medium">
          <span>
            Hi <strong className="font-bold">{profile ? fullName(profile.first_name, profile.last_name) : 'User'}</strong>, you have <strong className="font-extrabold text-blue-700">14-days left</strong> in your trial.
          </span>
          <button className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 text-blue-700 rounded-full font-bold text-[11px] hover:bg-blue-100/50 transition-colors shadow-2xs">
            <Sparkles className="w-3 h-3 text-blue-600" />
            Continue setup
            <span className="w-2 h-2 bg-blue-500 rounded-full ml-1" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold">
            <HelpCircle className="w-4 h-4 text-slate-500" />
            Need help? Talk to us
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          <button className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-colors">
            Buy now
          </button>
        </div>
      </div>

      {/* 2. MAIN DASHBOARD CONTENT AREA */}
      <div className="flex flex-col lg:flex-row items-start gap-5">
        {/* LEFT DASHBOARD SWITCHER SIDEBAR (240px) */}
        <aside className="w-full lg:w-60 bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-6 flex-shrink-0">
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Default dashboards
            </h3>
            <nav className="space-y-1 text-xs font-medium">
              <button
                onClick={() => setActiveDashboard('my')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left ${
                  activeDashboard === 'my'
                    ? 'bg-blue-50 text-blue-600 font-bold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>My Dashboard</span>
                {activeDashboard === 'my' && <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />}
              </button>

              <button
                onClick={() => setActiveDashboard('operations')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left ${
                  activeDashboard === 'operations'
                    ? 'bg-blue-50 text-blue-600 font-bold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Operations Dashboard</span>
                {activeDashboard === 'operations' && <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />}
              </button>

              <button
                onClick={() => setActiveDashboard('kb')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left ${
                  activeDashboard === 'kb'
                    ? 'bg-blue-50 text-blue-600 font-bold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Knowledge Base Dashboard</span>
                {activeDashboard === 'kb' && <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />}
              </button>

              <button
                onClick={() => setActiveDashboard('availability')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left ${
                  activeDashboard === 'availability'
                    ? 'bg-blue-50 text-blue-600 font-bold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Agent Availability</span>
                {activeDashboard === 'availability' && <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />}
              </button>

              <button
                onClick={() => setActiveDashboard('performance')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left ${
                  activeDashboard === 'performance'
                    ? 'bg-blue-50 text-blue-600 font-bold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Agent Performance Report</span>
                {activeDashboard === 'performance' && <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />}
              </button>

              {customDashboards.map((dashName) => (
                <button
                  key={dashName}
                  onClick={() => setActiveDashboard('my')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 text-left"
                >
                  <span className="truncate">{dashName}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* New Custom Dashboard button */}
          <div className="pt-4 border-t border-gray-100 space-y-1">
            <button
              onClick={() => setShowNewDashboardModal(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New custom dashboard</span>
            </button>
            <p className="text-[11px] text-gray-400 pl-5">
              {15 - customDashboards.length} more to go before you use them all
            </p>
          </div>
        </aside>

        {/* RIGHT MAIN VIEW AREA */}
        <main className="flex-1 w-full min-w-0 space-y-5">
          {/* Top Header & Toolbar Filter Bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Dashboard Title & Product/Source Filters */}
            <div className="flex items-center gap-6 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                {activeDashboard === 'my' && 'My Dashboard'}
                {activeDashboard === 'operations' && 'Operations Dashboard'}
                {activeDashboard === 'kb' && 'Knowledge Base Dashboard'}
                {activeDashboard === 'availability' && 'Agent Availability'}
                {activeDashboard === 'performance' && 'Agent Performance Report'}
              </h1>

              {/* Filter Controls */}
              <div className="flex items-center gap-3 text-xs text-gray-600 border-l border-gray-200 pl-4">
                <Filter className="w-3.5 h-3.5 text-gray-400" />

                {/* Product Filter */}
                <div className="flex items-center gap-1">
                  <span>Product:</span>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded px-2 py-1 font-semibold text-gray-800 cursor-pointer focus:outline-none"
                  >
                    <option value="All products">All products</option>
                    <option value="AIV Analytics">AIV Analytics</option>
                    <option value="AIV Core Portal">AIV Core Portal</option>
                  </select>
                </div>

                <span className="text-gray-300">•</span>

                {/* Source Filter */}
                <div className="flex items-center gap-1">
                  <span>Source:</span>
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded px-2 py-1 font-semibold text-gray-800 cursor-pointer focus:outline-none"
                  >
                    <option value="All sources">All sources</option>
                    <option value="Portal">Portal</option>
                    <option value="Email">Email</option>
                    <option value="Chat">Chat</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Recent Activities Button */}
            <button
              onClick={() => setShowRecentActivities(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 shadow-2xs transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span>Recent activities</span>
            </button>
          </div>

          {/* MY DASHBOARD VIEW */}
          {activeDashboard === 'my' && (
            <>
              {/* 6 METRIC STAT CARDS ROW (Exact match to Freshdesk screenshot) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Unresolved */}
                <div
                  onClick={() => navigate('/agent/inbox')}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all cursor-pointer space-y-1"
                >
                  <p className="text-xs font-semibold text-gray-500">Unresolved</p>
                  <p className="text-3xl font-extrabold text-gray-900">{counts.unresolved}</p>
                </div>

                {/* Overdue */}
                <div
                  onClick={() => navigate('/agent/inbox')}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all cursor-pointer space-y-1"
                >
                  <p className="text-xs font-semibold text-gray-500">Overdue</p>
                  <p className="text-3xl font-extrabold text-gray-900">{counts.overdue}</p>
                </div>

                {/* Due today */}
                <div
                  onClick={() => navigate('/agent/inbox')}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all cursor-pointer space-y-1"
                >
                  <p className="text-xs font-semibold text-gray-500">Due today</p>
                  <p className="text-3xl font-extrabold text-gray-900">{counts.dueToday}</p>
                </div>

                {/* Open */}
                <div
                  onClick={() => navigate('/agent/inbox')}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all cursor-pointer space-y-1"
                >
                  <p className="text-xs font-semibold text-gray-500">Open</p>
                  <p className="text-3xl font-extrabold text-gray-900">{counts.open}</p>
                </div>

                {/* On hold */}
                <div
                  onClick={() => navigate('/agent/inbox')}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all cursor-pointer space-y-1"
                >
                  <p className="text-xs font-semibold text-gray-500">On hold</p>
                  <p className="text-3xl font-extrabold text-gray-900">{counts.onHold}</p>
                </div>

                {/* Unassigned */}
                <div
                  onClick={() => navigate('/agent/inbox')}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all cursor-pointer space-y-1"
                >
                  <p className="text-xs font-semibold text-gray-500">Unassigned</p>
                  <p className="text-3xl font-extrabold text-gray-900">{counts.unassigned}</p>
                </div>
              </div>

              {/* "TODAY'S TRENDS" CHARTS & STATS SECTION */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-2xs grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[380px]">
                {/* Left Chart Visualization Pane (Line Chart for Volume Trends) */}
                <div className="lg:col-span-3 space-y-4 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-gray-100 lg:pr-6 pb-6 lg:pb-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-900 tracking-tight">Today's trends</h2>
                    <div className="flex items-center gap-5 text-xs font-medium text-gray-600">
                      <span className="flex items-center gap-1.5 cursor-pointer">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <span className="font-semibold text-gray-800">Today</span>
                      </span>
                      <span className="flex items-center gap-1.5 cursor-pointer">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <span className="text-gray-500">Yesterday</span>
                      </span>
                    </div>
                  </div>

                  {/* SVG Line Graph matching screenshot spikes (0 to 3) */}
                  <div className="w-full h-64 relative">
                    {/* Floating Tooltip */}
                    {hoveredPoint && (
                      <div
                        className="absolute z-10 bg-slate-900 text-white px-2.5 py-1 rounded text-[11px] font-semibold shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2"
                        style={{ left: `${(hoveredPoint.x / 500) * 100}%`, top: `${(hoveredPoint.y / 200) * 100}%` }}
                      >
                        {hoveredPoint.label}: {hoveredPoint.count} tickets
                      </div>
                    )}

                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                      {/* Horizontal Grid lines */}
                      <line x1="40" y1="30" x2="480" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                      <line x1="40" y1="80" x2="480" y2="80" stroke="#f1f5f9" strokeWidth="1" />
                      <line x1="40" y1="130" x2="480" y2="130" stroke="#f1f5f9" strokeWidth="1" />
                      <line x1="40" y1="180" x2="480" y2="180" stroke="#f1f5f9" strokeWidth="1" />

                      {/* Y-Axis Labels */}
                      <text x="15" y="34" fill="#94a3b8" fontSize="11" fontWeight="500">3</text>
                      <text x="15" y="84" fill="#94a3b8" fontSize="11" fontWeight="500">2</text>
                      <text x="15" y="134" fill="#94a3b8" fontSize="11" fontWeight="500">1</text>
                      <text x="15" y="184" fill="#94a3b8" fontSize="11" fontWeight="500">0</text>

                      {/* Yesterday Trend Line (Dashed Grey) */}
                      <path
                        d="M 40 180 L 120 180 L 200 180 L 280 130 L 360 180 L 440 180"
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />

                      {/* Today Trend Line (Solid Blue Spike to 3 and 1) */}
                      <path
                        d="M 40 180 L 120 180 L 200 130 L 280 30 L 360 130 L 440 180"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2.5"
                      />

                      {/* Data Points - Today */}
                      {todayPoints.map((pt, idx) => (
                        <g key={idx}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={pt.val > 0 ? "5" : "3"}
                            fill="#2563eb"
                            className="cursor-pointer hover:r-7 transition-all"
                            onMouseEnter={() => setHoveredPoint({ x: pt.x, y: pt.y, label: pt.hour, count: pt.val })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          {pt.val > 0 && (
                            <text
                              x={pt.x}
                              y={pt.y - 10}
                              textAnchor="middle"
                              fill="#2563eb"
                              fontSize="11"
                              fontWeight="bold"
                            >
                              {pt.val}
                            </text>
                          )}
                        </g>
                      ))}

                      {/* Data Points - Yesterday */}
                      {yesterdayPoints.map((pt, idx) => (
                        <circle
                          key={`yest-${idx}`}
                          cx={pt.x}
                          cy={pt.y}
                          r="3"
                          fill="#94a3b8"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ x: pt.x, y: pt.y, label: `Yesterday ${pt.hour}`, count: pt.val })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      ))}
                    </svg>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-100 pt-2 px-6">
                    <span>12 am</span>
                    <span>4 am</span>
                    <span>8 am</span>
                    <span>12 pm</span>
                    <span>4 pm</span>
                    <span>8 pm</span>
                  </div>
                </div>

                {/* Right Summary Statistics Column (Exact layout to screenshot) */}
                <div className="flex flex-col justify-between space-y-6 pl-0 lg:pl-4">
                  {/* Resolved */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500">Resolved</p>
                    <p className="text-3xl font-extrabold text-gray-900">{counts.resolved}</p>
                  </div>

                  {/* Received */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500">Received</p>
                    <div className="flex items-baseline gap-3">
                      <p className="text-3xl font-extrabold text-gray-900">{counts.received}</p>
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        <ArrowDown className="w-3 h-3" />
                        100%
                      </span>
                    </div>
                  </div>

                  {/* Average First Response Time */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                      <span>Average First response time</span>
                      <Info className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div className="flex items-baseline gap-3">
                      <p className="text-3xl font-extrabold text-gray-900">{counts.avgResponseTime}</p>
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        <ArrowDown className="w-3 h-3" />
                        100%
                      </span>
                    </div>
                  </div>

                  {/* Average Resolution Time */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                      <span>Average Resolution time</span>
                      <Info className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900">{counts.avgResolutionTime}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* OPERATIONS DASHBOARD VIEW */}
          {activeDashboard === 'operations' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Tickets by Priority Bar Chart */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-gray-900">Tickets by Priority</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span className="text-red-700">P1 - Urgent</span>
                        <span>1 ticket (25%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-red-500 h-3 rounded-full" style={{ width: '25%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span className="text-amber-700">P2 - High</span>
                        <span>1 ticket (25%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-amber-500 h-3 rounded-full" style={{ width: '25%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span className="text-blue-700">P3 - Medium</span>
                        <span>1 ticket (25%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-blue-500 h-3 rounded-full" style={{ width: '25%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span className="text-emerald-700">P4 - Low</span>
                        <span>1 ticket (25%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-emerald-500 h-3 rounded-full" style={{ width: '25%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tickets by Source */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-gray-900">Tickets by Source</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span>Portal</span>
                        <span>3 tickets (75%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-blue-600 h-3 rounded-full" style={{ width: '75%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span>Email</span>
                        <span>1 ticket (25%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-indigo-500 h-3 rounded-full" style={{ width: '25%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span>Chat</span>
                        <span>0 tickets (0%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-slate-300 h-3 rounded-full" style={{ width: '0%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KNOWLEDGE BASE DASHBOARD VIEW */}
          {activeDashboard === 'kb' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-2">
                <p className="text-xs font-semibold text-gray-500">Total Published Articles</p>
                <p className="text-3xl font-extrabold text-gray-900">24</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-2">
                <p className="text-xs font-semibold text-gray-500">Total Article Views</p>
                <p className="text-3xl font-extrabold text-blue-600">1,420</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-2">
                <p className="text-xs font-semibold text-gray-500">Positive Feedback</p>
                <p className="text-3xl font-extrabold text-emerald-600">94.8%</p>
              </div>
            </div>
          )}

          {/* AGENT AVAILABILITY VIEW */}
          {activeDashboard === 'availability' && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Agent Status & Active Capacity</h3>
              <div className="divide-y divide-gray-100 text-xs">
                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    <div>
                      <p className="font-bold text-gray-900">Sarah Connor</p>
                      <p className="text-gray-500">Senior Specialist</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full">Available (2 active)</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    <div>
                      <p className="font-bold text-gray-900">Alex Murphy</p>
                      <p className="text-gray-500">Support Engineer</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full">Available (1 active)</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                    <div>
                      <p className="font-bold text-gray-900">Support Manager</p>
                      <p className="text-gray-500">Support Ops Lead</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-bold rounded-full">Away (0 active)</span>
                </div>
              </div>
            </div>
          )}

          {/* AGENT PERFORMANCE VIEW */}
          {activeDashboard === 'performance' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-2">
                <p className="text-xs font-semibold text-gray-500">First Response SLA %</p>
                <p className="text-3xl font-extrabold text-blue-600">96.4%</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-2">
                <p className="text-xs font-semibold text-gray-500">Resolution SLA %</p>
                <p className="text-3xl font-extrabold text-emerald-600">91.2%</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-2">
                <p className="text-xs font-semibold text-gray-500">Average CSAT Rating</p>
                <p className="text-3xl font-extrabold text-amber-500">4.9 / 5.0</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* RECENT ACTIVITIES SLIDE-OVER DRAWER */}
      {showRecentActivities && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setShowRecentActivities(false)}>
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-gray-900">Recent Activities</h2>
              </div>
              <button onClick={() => setShowRecentActivities(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="divide-y divide-gray-100 space-y-3">
              {DEMO_ACTIVITIES.map((act) => (
                <div
                  key={act.id}
                  onClick={() => { setShowRecentActivities(false); navigate(`/agent/tickets/${act.ticketId}`); }}
                  className="pt-3 hover:bg-gray-50 p-2 rounded-lg cursor-pointer transition-colors"
                >
                  <p className="text-xs font-bold text-gray-900">{act.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{act.desc}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">{act.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NEW CUSTOM DASHBOARD MODAL */}
      {showNewDashboardModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowNewDashboardModal(false)}>
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Create Custom Dashboard</h3>
              <button onClick={() => setShowNewDashboardModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Dashboard Name</label>
              <input
                type="text"
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder="e.g. Tier 1 Support Metrics"
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewDashboardModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomDashboard}
                disabled={!newDashboardName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                Create Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
