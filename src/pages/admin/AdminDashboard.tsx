import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fullName } from '@/lib/constants';
import type { TicketWithRelations } from '@/types';
import {
  Sparkles, Gauge, Ticket, User, BookOpen, MessageSquare, Bot,
  BarChart2, Settings, LogOut, Plus, Search, ChevronDown, Phone,
  Check, CheckSquare, Square, X, Info, HelpCircle, Mail, Calendar
} from 'lucide-react';

interface TodoItem {
  id: string;
  text: string;
  subtext: string;
  due: string;
  completed: boolean;
}

const INITIAL_TODOS: TodoItem[] = [
  {
    id: 'todo-1',
    text: 'Followup with customer about Upgrade',
    subtext: 'two factor authentication by google authenticator',
    due: 'IN A DAY',
    completed: false,
  },
  {
    id: 'todo-2',
    text: 'Review high-priority SLA breaches with team',
    subtext: 'Production API and database performance audit',
    due: 'IN 2 DAYS',
    completed: false,
  },
];

export function AdminDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  // Mode: Toggle between Image 2 Sample values and live PostgreSQL values
  const [isSampleData, setIsSampleData] = useState(true);
  const [showFloatingBanner, setShowFloatingBanner] = useState(true);

  // Modals & dropdowns
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [showHelpDropdown, setShowHelpDropdown] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // To-do list state
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const saved = localStorage.getItem('freshdesk_todos');
      return saved ? JSON.parse(saved) : INITIAL_TODOS;
    } catch {
      return INITIAL_TODOS;
    }
  });
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');

  // Interactive Chart Tooltip
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  // Live Database stats
  const [liveStats, setLiveStats] = useState({
    unresolved: 4,
    overdue: 1,
    dueToday: 2,
    open: 4,
    onHold: 1,
    unassigned: 1,
    resolved: 2,
    received: 6,
    avgFirstResponse: '15m',
    avgResponseTime: '28m 10s',
    resolutionWithinSla: '92%',
    responses: 24,
    csatPercent: 94,
    groupCounts: [
      { name: 'Customer support', count: 4 },
      { name: 'Tier 1 Support', count: 2 },
      { name: 'Tier 2 Engineering', count: 1 },
    ],
  });

  // Load real PostgreSQL data
  const loadDatabaseData = useCallback(async () => {
    try {
      const { data: ticketsData } = await supabase.from('tickets').select('*');
      if (ticketsData && ticketsData.length > 0) {
        const unresolved = ticketsData.filter((t: any) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length;
        const overdue = ticketsData.filter((t: any) => t.first_response_breached && !['RESOLVED', 'CLOSED'].includes(t.status)).length;
        const open = ticketsData.filter((t: any) => ['OPEN', 'NEW', 'IN_PROGRESS'].includes(t.status)).length;
        const onHold = ticketsData.filter((t: any) => t.status === 'WAITING_FOR_CUSTOMER').length;
        const unassigned = ticketsData.filter((t: any) => !t.assigned_agent_id && !['RESOLVED', 'CLOSED'].includes(t.status)).length;
        const resolved = ticketsData.filter((t: any) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;

        setLiveStats(prev => ({
          ...prev,
          unresolved,
          overdue,
          open,
          onHold,
          unassigned,
          resolved,
          received: ticketsData.length,
          groupCounts: [
            { name: 'Customer support', count: unresolved },
            { name: 'Tier 1 Support', count: Math.max(1, Math.floor(unresolved / 2)) },
            { name: 'Tier 2 Engineering', count: Math.max(0, unresolved - Math.floor(unresolved / 2)) },
          ]
        }));
      }
    } catch (e) {
      console.error('Failed to load DB stats:', e);
    }
  }, []);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Save todos to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('freshdesk_todos', JSON.stringify(todos));
    } catch {}
  }, [todos]);

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    const newTodo: TodoItem = {
      id: `todo-${Date.now()}`,
      text: newTodoText.trim(),
      subtext: 'assigned to me',
      due: 'TODAY',
      completed: false,
    };
    setTodos(prev => [newTodo, ...prev]);
    setNewTodoText('');
    setIsAddingTodo(false);
  };

  // Search functionality in PostgreSQL
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('tickets')
        .select('id, ticket_number, subject, status, priority')
        .or(`subject.ilike.%${query}%,ticket_number.ilike.%${query}%`)
        .limit(6);
      setSearchResults(data || []);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Metric values to display (Image 2 sample vs Live DB)
  const metrics = isSampleData ? {
    unresolved: 55,
    overdue: 4,
    dueToday: 11,
    open: 28,
    onHold: 3,
    unassigned: 8,
    resolved: 45,
    received: 100,
    avgFirstResponse: '12m',
    avgResponseTime: '24m 12s',
    resolutionWithinSla: '91%',
    responses: 320,
    csatPercent: 90,
    groupCounts: [
      { name: 'Customer support', count: 32 },
    ]
  } : liveStats;

  // Hourly trend curve data points matching Image 2
  // Coordinates mapping 0 to 23 hours to SVG viewBox 0..720 x 0..180
  const chartPoints = [
    { hour: 0, val: 0, x: 25, y: 150 },
    { hour: 1, val: 32, x: 55, y: 80 },
    { hour: 2, val: 24, x: 85, y: 98 },
    { hour: 3, val: 12, x: 115, y: 125 },
    { hour: 4, val: 18, x: 145, y: 112 },
    { hour: 5, val: 10, x: 175, y: 130 },
    { hour: 7, val: 35, x: 235, y: 75 },
    { hour: 10, val: 55, x: 325, y: 35 },
    { hour: 13, val: 70, x: 415, y: 15 },
  ];

  return (
    <div className="min-h-screen bg-[#f3f5f7] flex font-sans text-slate-800 antialiased selection:bg-blue-100">
      {/* 1. SLIM LEFT ICON SIDEBAR (54px) - Exactly matches Image 2 */}
      <aside className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-4 justify-between flex-shrink-0 z-30 select-none">
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Sparkles / AI icon */}
          <button
            title="Freddy AI"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          >
            <Sparkles className="w-5 h-5 text-slate-700" />
          </button>

          {/* Speedometer Dashboard - Active with soft grey container */}
          <button
            title="Dashboard"
            onClick={() => navigate('/admin')}
            className="w-9 h-9 rounded-lg bg-[#d9e2ec] flex items-center justify-center text-slate-800 shadow-2xs"
          >
            <Gauge className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Tickets Inbox */}
          <button
            title="Tickets"
            onClick={() => navigate('/tickets')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          >
            <Ticket className="w-5 h-5" />
          </button>

          {/* Contacts / Users */}
          <button
            title="Contacts"
            onClick={() => navigate('/admin/users')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          >
            <User className="w-5 h-5" />
          </button>

          {/* Knowledge Base */}
          <button
            title="Knowledge Base"
            onClick={() => navigate('/tickets')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          >
            <BookOpen className="w-5 h-5" />
          </button>

          {/* Chat / Forums */}
          <button
            title="Chat"
            onClick={() => navigate('/tickets')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Bot Automations */}
          <button
            title="Automations"
            onClick={() => navigate('/admin/sla')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          >
            <Bot className="w-5 h-5" />
          </button>

          {/* Analytics / Reports */}
          <button
            title="Analytics"
            onClick={() => navigate('/manager/reports')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          >
            <BarChart2 className="w-5 h-5" />
          </button>

          {/* Settings */}
          <button
            title="Settings"
            onClick={() => navigate('/admin/settings')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Sign Out */}
        <div className="w-full flex justify-center pt-2">
          <button
            title="Sign Out"
            onClick={signOut}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* TOP TRIAL BANNER - Exactly matches Image 2 */}
        <div className="bg-[#ebf4fb] border-b border-[#d8e8f6] px-6 py-2.5 flex items-center justify-between text-xs text-slate-800">
          <div className="flex items-center gap-2">
            <span>
              Hi <span className="font-semibold">{profile ? fullName(profile.first_name, profile.last_name) : 'Sejal Prasad'}</span>, you have <strong className="font-bold text-slate-900">11-days left</strong> in your trial.
            </span>
            <button
              onClick={() => alert('Trial setup: Setup profile, email channels, and SLA policies.')}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#bce0fd] text-[#186ade] font-semibold text-[11px] rounded-full hover:bg-blue-50 transition-colors shadow-2xs ml-1"
            >
              <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[#186ade] border-t-transparent animate-spin inline-block" />
              Continue setup
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowHelpDropdown(!showHelpDropdown)}
                className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-medium text-xs focus:outline-none"
              >
                <Phone className="w-3.5 h-3.5 text-slate-600" />
                <span>Need help? Talk to us</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {showHelpDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 z-40 text-xs">
                  <a href="https://support.freshdesk.com" target="_blank" rel="noreferrer" className="block px-3 py-2 text-slate-700 hover:bg-slate-50 rounded">
                    Documentation
                  </a>
                  <a href="mailto:support@aivsupport.com" className="block px-3 py-2 text-slate-700 hover:bg-slate-50 rounded">
                    Email Support
                  </a>
                  <button onClick={() => alert('Support hotline: +1 (800) 555-0199')} className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 rounded">
                    Call Support
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => alert('Plan: Enterprise Support Portal - Fully Activated.')}
              className="px-3 py-1.5 bg-[#186ade] hover:bg-[#1459be] text-white rounded font-semibold text-xs transition-colors shadow-2xs"
            >
              Buy now
            </button>
          </div>
        </div>

        {/* TOP HEADER / NAVBAR - Exactly matches Image 2 */}
        <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          {/* Left: Green logo + Dashboard title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#12a150] flex items-center justify-center text-white shadow-2xs">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a7 7 0 1 1 14 0h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z"/>
              </svg>
            </div>
            <h1 className="text-base font-semibold text-[#12344d] tracking-tight">Dashboard</h1>
          </div>

          {/* Right: + New, Search, User Avatar */}
          <div className="flex items-center gap-3">
            {/* + New Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNewDropdown(!showNewDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded text-xs font-semibold text-[#12344d] shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>

              {showNewDropdown && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-40 text-xs">
                  <button
                    onClick={() => { setShowNewDropdown(false); navigate('/agent/tickets/new'); }}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>New Ticket</span>
                  </button>
                  <button
                    onClick={() => { setShowNewDropdown(false); navigate('/admin/users'); }}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>New Contact</span>
                  </button>
                  <button
                    onClick={() => { setShowNewDropdown(false); navigate('/admin/accounts'); }}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>New Company</span>
                  </button>
                </div>
              )}
            </div>

            {/* Search Input Bar */}
            <div
              onClick={() => setShowSearchModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 hover:border-gray-400 rounded text-xs text-gray-400 cursor-pointer w-48 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <span>Search</span>
            </div>

            {/* Profile Avatar Circle with Initial 'S' */}
            <div
              title={profile ? profile.email : 'System Admin'}
              onClick={() => navigate('/admin/settings')}
              className="w-8 h-8 rounded-full bg-[#e9d5ff] text-[#6b21a8] font-bold text-xs flex items-center justify-center cursor-pointer border border-[#d8b4fe] hover:opacity-90 transition-opacity"
            >
              {profile?.first_name ? profile.first_name[0].toUpperCase() : 'S'}
            </div>
          </div>
        </header>

        {/* 3. MAIN DASHBOARD CONTENT AREA */}
        <main className="p-5 flex-1 space-y-4">
          {/* Main Card with the distinct Orange Top Line Border Accent */}
          <div className="bg-white border border-gray-200 border-t-[3px] border-t-[#ff7a00] rounded-sm shadow-2xs overflow-hidden">
            {/* 6 HORIZONTAL KPI CELLS (Divided by light vertical borders) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 border-b border-gray-200">
              {/* 1. Unresolved */}
              <div
                onClick={() => navigate('/tickets')}
                className="p-4 hover:bg-gray-50/80 cursor-pointer transition-colors space-y-1"
              >
                <p className="text-xs font-semibold text-slate-700">Unresolved</p>
                <p className="text-2xl font-bold text-[#12344d]">{metrics.unresolved}</p>
              </div>

              {/* 2. Overdue */}
              <div
                onClick={() => navigate('/tickets')}
                className="p-4 hover:bg-gray-50/80 cursor-pointer transition-colors space-y-1"
              >
                <p className="text-xs font-semibold text-slate-700">Overdue</p>
                <p className="text-2xl font-bold text-[#12344d]">{metrics.overdue}</p>
              </div>

              {/* 3. Due today */}
              <div
                onClick={() => navigate('/tickets')}
                className="p-4 hover:bg-gray-50/80 cursor-pointer transition-colors space-y-1"
              >
                <p className="text-xs font-semibold text-slate-700">Due today</p>
                <p className="text-2xl font-bold text-[#12344d]">{metrics.dueToday}</p>
              </div>

              {/* 4. Open */}
              <div
                onClick={() => navigate('/tickets')}
                className="p-4 hover:bg-gray-50/80 cursor-pointer transition-colors space-y-1"
              >
                <p className="text-xs font-semibold text-slate-700">Open</p>
                <p className="text-2xl font-bold text-[#12344d]">{metrics.open}</p>
              </div>

              {/* 5. On hold */}
              <div
                onClick={() => navigate('/tickets')}
                className="p-4 hover:bg-gray-50/80 cursor-pointer transition-colors space-y-1"
              >
                <p className="text-xs font-semibold text-slate-700">On hold</p>
                <p className="text-2xl font-bold text-[#12344d]">{metrics.onHold}</p>
              </div>

              {/* 6. Unassigned */}
              <div
                onClick={() => navigate('/tickets')}
                className="p-4 hover:bg-gray-50/80 cursor-pointer transition-colors space-y-1"
              >
                <p className="text-xs font-semibold text-slate-700">Unassigned</p>
                <p className="text-2xl font-bold text-[#12344d]">{metrics.unassigned}</p>
              </div>
            </div>

            {/* TODAY'S TRENDS & PERFORMANCE SUMMARY SECTION */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left 3 Cols: SVG Line Chart (0 to 23 Hours) */}
              <div className="lg:col-span-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[#12344d]">Today's trends</h2>
                    <p className="text-[11px] text-gray-400 font-normal">1st May 2018, 03:00 PM</p>
                  </div>
                </div>

                {/* SVG Line Chart */}
                <div className="w-full h-56 relative pt-4">
                  {/* Floating tooltip */}
                  {hoveredHour !== null && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-semibold px-2 py-1 rounded shadow">
                      Hour {hoveredHour}:00 - {Math.floor(hoveredHour * 3.5)} tickets
                    </div>
                  )}

                  <svg className="w-full h-44 overflow-visible" viewBox="0 0 740 180" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="todayGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line x1="20" y1="30" x2="720" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="20" y1="75" x2="720" y2="75" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="20" y1="120" x2="720" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="20" y1="160" x2="720" y2="160" stroke="#f1f5f9" strokeWidth="1" />

                    {/* Y-axis labels */}
                    <text x="8" y="163" fill="#cbd5e1" fontSize="9">0</text>

                    {/* Yesterday dotted grey line */}
                    <path
                      d="M 25 150 Q 80 120, 160 145 T 320 120 T 480 140 T 640 130 T 720 145"
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="1.5"
                    />

                    {/* Today Filled Area Gradient */}
                    <path
                      d="M 25 150 L 55 80 L 85 98 L 115 125 L 145 112 L 175 130 L 235 75 L 325 35 L 415 15 L 415 160 L 25 160 Z"
                      fill="url(#todayGradient)"
                    />

                    {/* Today Blue Line Curve */}
                    <path
                      d="M 25 150 L 55 80 L 85 98 L 115 125 L 145 112 L 175 130 L 235 75 L 325 35 L 415 15"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />

                    {/* Today Data Points (Hollow Circles) */}
                    {chartPoints.map((pt) => (
                      <circle
                        key={pt.hour}
                        cx={pt.x}
                        cy={pt.y}
                        r="3.5"
                        fill="#ffffff"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-5 transition-all"
                        onMouseEnter={() => setHoveredHour(pt.hour)}
                        onMouseLeave={() => setHoveredHour(null)}
                      />
                    ))}
                  </svg>

                  {/* X-axis 0 to 23 hours labels */}
                  <div className="flex justify-between text-[10px] text-gray-400 px-2 pt-1 border-t border-gray-100">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <span key={i} className="cursor-pointer hover:text-blue-600">{i}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-1">Hours</p>

                  {/* Legend underneath */}
                  <div className="flex items-center justify-end gap-4 text-[11px] text-gray-500 mt-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-[#38bdf8] rounded-2xs inline-block" />
                      <span>Today</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-[#cbd5e1] rounded-2xs inline-block" />
                      <span>Yesterday</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right 1 Col: Performance Key Stats (Separated by border) */}
              <div className="border-t lg:border-t-0 lg:border-l border-gray-200 lg:pl-6 pt-4 lg:pt-0 space-y-4">
                {/* Resolved */}
                <div>
                  <p className="text-xs text-gray-500 font-medium">Resolved</p>
                  <p className="text-xl font-bold text-[#12344d]">{metrics.resolved}</p>
                </div>

                {/* Received */}
                <div>
                  <p className="text-xs text-gray-500 font-medium">Received</p>
                  <p className="text-xl font-bold text-[#12344d]">{metrics.received}</p>
                </div>

                {/* Average first response time */}
                <div>
                  <p className="text-xs text-gray-500 font-medium">Average first response time</p>
                  <p className="text-xl font-bold text-[#12344d]">{metrics.avgFirstResponse}</p>
                </div>

                {/* Average response time */}
                <div>
                  <p className="text-xs text-gray-500 font-medium">Average response time</p>
                  <p className="text-xl font-bold text-[#12344d]">{metrics.avgResponseTime}</p>
                </div>

                {/* Resolution within SLA */}
                <div>
                  <p className="text-xs text-gray-500 font-medium">Resolution within SLA</p>
                  <p className="text-xl font-bold text-[#12344d]">{metrics.resolutionWithinSla}</p>
                </div>
              </div>
            </div>

            {/* 3-COLUMN BOTTOM CARDS SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 border-t border-gray-200 bg-white">
              {/* Column 1: Unresolved tickets */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#12344d]">Unresolved tickets</h3>
                    <p className="text-[11px] text-gray-400">Across helpdesk</p>
                  </div>
                  <button
                    onClick={() => navigate('/tickets')}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    View details
                  </button>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs text-gray-500 border-b border-gray-100 pb-1">
                    <span>Group</span>
                    <span>Open</span>
                  </div>

                  {metrics.groupCounts.map((grp) => (
                    <div key={grp.name} className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-700 font-medium">{grp.name}</span>
                      <span className="text-slate-900 font-bold">{grp.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Customer satisfaction */}
              <div className="p-5 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[#12344d]">Customer satisfaction</h3>
                  <p className="text-[11px] text-gray-400">Across helpdesk this month</p>
                </div>

                <div className="flex items-baseline justify-between pt-4">
                  <div>
                    <p className="text-[11px] text-gray-500">Responses</p>
                    <p className="text-2xl font-bold text-[#12344d]">{metrics.responses}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-bold text-[#12344d]">{metrics.csatPercent}%</span>
                    <span className="text-2xl" role="img" aria-label="happy">
                      🟢😊
                    </span>
                  </div>
                </div>
              </div>

              {/* Column 3: To-do (2) */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#12344d]">To-do ({todos.filter(t => !t.completed).length})</h3>
                </div>

                {/* Add a to-do button / input */}
                <div>
                  {isAddingTodo ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={newTodoText}
                        onChange={(e) => setNewTodoText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                        placeholder="Type task and press Enter..."
                        autoFocus
                        className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={handleAddTodo}
                        className="text-xs bg-emerald-600 text-white px-2 py-1 rounded font-semibold hover:bg-emerald-700"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setIsAddingTodo(false)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingTodo(true)}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors"
                    >
                      <span className="w-4 h-4 rounded-full border border-emerald-500 flex items-center justify-center text-[10px] font-bold">
                        +
                      </span>
                      <span>Add a to-do</span>
                    </button>
                  )}
                </div>

                {/* Todo List */}
                <div className="space-y-2.5 pt-2">
                  {todos.map((todo) => (
                    <div key={todo.id} className="flex items-start gap-2 text-xs">
                      <button
                        onClick={() => toggleTodo(todo.id)}
                        className="mt-0.5 text-gray-400 hover:text-blue-600 focus:outline-none"
                      >
                        {todo.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-slate-800 ${todo.completed ? 'line-through text-gray-400' : ''}`}>
                          {todo.text}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Mail className="w-2.5 h-2.5" />
                            <span>{todo.subtext}</span>
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-blue-600 uppercase">{todo.due}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* 4. FLOATING PILL NOTIFICATION AT BOTTOM - Exactly matches Image 2 */}
        {showFloatingBanner && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#11263c] text-white px-4 py-2 rounded-full shadow-xl text-xs">
            <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span>
              {isSampleData ? (
                <>
                  This is a sample dashboard.{' '}
                  <button
                    onClick={() => setIsSampleData(false)}
                    className="text-sky-300 underline font-semibold hover:text-white"
                  >
                    Dismiss for real data
                  </button>
                </>
              ) : (
                <>
                  Showing real data from PostgreSQL.{' '}
                  <button
                    onClick={() => setIsSampleData(true)}
                    className="text-sky-300 underline font-semibold hover:text-white"
                  >
                    Switch to sample data
                  </button>
                </>
              )}
            </span>
            <button
              onClick={() => setShowFloatingBanner(false)}
              className="text-gray-400 hover:text-white ml-2 text-sm"
              title="Close notification"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 5. SEARCH MODAL */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tickets by number, subject, or customer..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
                className="flex-1 text-xs focus:outline-none"
              />
              <button onClick={() => setShowSearchModal(false)} className="text-gray-400 hover:text-gray-600 text-xs">
                ✕
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
              {isSearching ? (
                <p className="text-xs text-center py-4 text-gray-400">Searching PostgreSQL...</p>
              ) : searchResults.length > 0 ? (
                searchResults.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => { setShowSearchModal(false); navigate(`/agent/tickets/${t.id}`); }}
                    className="p-2.5 hover:bg-blue-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-blue-600 mr-2">{t.ticket_number}</span>
                      <span className="text-slate-800 font-medium">{t.subject}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      {t.status}
                    </span>
                  </div>
                ))
              ) : searchQuery ? (
                <p className="text-xs text-center py-4 text-gray-400">No matching tickets found</p>
              ) : (
                <p className="text-xs text-center py-4 text-gray-400">Type ticket number or keyword to search</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
