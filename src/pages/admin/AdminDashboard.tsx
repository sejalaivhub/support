import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fullName } from '@/lib/constants';
import type { TicketWithRelations } from '@/types';
import {
  Sparkles, Ticket, User, BookOpen, MessageSquare, Bot,
  BarChart2, Settings, ChevronDown, Check, CheckSquare, Square, X, Search
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
  const { profile } = useAuth();

  const [isSampleData, setIsSampleData] = useState(true);
  const [showFloatingBanner, setShowFloatingBanner] = useState(true);

  // Search logic
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

  useEffect(() => {
    localStorage.setItem('freshdesk_todos', JSON.stringify(todos));
  }, [todos]);

  // Live Database stats state
  const [dbStats, setDbStats] = useState({
    unresolved: 0,
    overdue: 0,
    dueToday: 0,
    open: 0,
    onHold: 0,
    unassigned: 0,
    received: 0,
    resolved: 0,
    csatPercent: 0,
    responses: 0,
    groupCounts: [] as { name: string; count: number }[],
  });

  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  // Fetch real stats from Supabase
  const fetchStats = useCallback(async () => {
    try {
      // Unresolved tickets (Open, Pending)
      const { count: unresolvedCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Open', 'Pending']);

      // Open tickets
      const { count: openCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Open');

      // Unassigned tickets
      const { count: unassignedCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .is('assigned_to', null);

      // Resolved tickets
      const { count: resolvedCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Resolved');

      // (Mocked) Groups for unresolved
      const groupCounts = [
        { name: 'Support', count: unresolvedCount || 0 },
        { name: 'Billing', count: 0 },
        { name: 'Escalations', count: 0 },
      ];

      setDbStats({
        unresolved: unresolvedCount || 0,
        overdue: 0, // Mock
        dueToday: 0, // Mock
        open: openCount || 0,
        onHold: 0, // Mock
        unassigned: unassignedCount || 0,
        received: (unresolvedCount || 0) + (resolvedCount || 0),
        resolved: resolvedCount || 0,
        csatPercent: 95,
        responses: resolvedCount || 0,
        groupCounts,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  }, []);

  useEffect(() => {
    if (!isSampleData) {
      fetchStats();
    }
  }, [fetchStats, isSampleData]);

  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    const newTodo: TodoItem = {
      id: `todo-${Date.now()}`,
      text: newTodoText.trim(),
      subtext: 'Added just now',
      due: 'TODAY',
      completed: false
    };
    setTodos([...todos, newTodo]);
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
    unresolved: 17,
    overdue: 5,
    dueToday: 2,
    open: 13,
    onHold: 0,
    unassigned: 6,
    received: 29,
    resolved: 11,
    csatPercent: 98,
    responses: 42,
    groupCounts: [
      { name: 'Support', count: 12 },
      { name: 'Billing', count: 3 },
      { name: 'Escalations', count: 2 },
    ]
  } : dbStats;

  // Chart data setup
  const chartPoints = [
    { hour: 0, val: 0, x: 0, y: 135 },
    { hour: 2, val: 2, x: 65, y: 115 },
    { hour: 4, val: 1, x: 130, y: 125 },
    { hour: 6, val: 5, x: 195, y: 85 },
    { hour: 8, val: 12, x: 260, y: 15 },
    { hour: 10, val: 9, x: 325, y: 45 },
    { hour: 12, val: 15, x: 390, y: 10 },
    { hour: 14, val: 8, x: 455, y: 55 },
    { hour: 16, val: 4, x: 520, y: 95 },
    { hour: 18, val: 2, x: 585, y: 115 },
    { hour: 20, val: 1, x: 650, y: 125 },
    { hour: 22, val: 0, x: 720, y: 135 }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* 1. KEY METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Unresolved */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center justify-center shadow-2xs hover:shadow-md transition-shadow cursor-pointer group">
          <span className="text-gray-500 font-medium text-sm mb-1 group-hover:text-blue-600 transition-colors">Unresolved</span>
          <span className="text-4xl font-light text-slate-800">{metrics.unresolved}</span>
        </div>
        {/* Overdue */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center justify-center shadow-2xs hover:shadow-md transition-shadow cursor-pointer group">
          <span className="text-gray-500 font-medium text-sm mb-1 group-hover:text-blue-600 transition-colors">Overdue</span>
          <span className="text-4xl font-light text-slate-800">{metrics.overdue}</span>
        </div>
        {/* Due today */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center justify-center shadow-2xs hover:shadow-md transition-shadow cursor-pointer group">
          <span className="text-gray-500 font-medium text-sm mb-1 group-hover:text-blue-600 transition-colors">Due today</span>
          <span className="text-4xl font-light text-slate-800">{metrics.dueToday}</span>
        </div>
        {/* Open */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center justify-center shadow-2xs hover:shadow-md transition-shadow cursor-pointer group">
          <span className="text-gray-500 font-medium text-sm mb-1 group-hover:text-blue-600 transition-colors">Open</span>
          <span className="text-4xl font-light text-slate-800">{metrics.open}</span>
        </div>
        {/* On hold */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center justify-center shadow-2xs hover:shadow-md transition-shadow cursor-pointer group">
          <span className="text-gray-500 font-medium text-sm mb-1 group-hover:text-blue-600 transition-colors">On hold</span>
          <span className="text-4xl font-light text-slate-800">{metrics.onHold}</span>
        </div>
        {/* Unassigned */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center justify-center shadow-2xs hover:shadow-md transition-shadow cursor-pointer group">
          <span className="text-gray-500 font-medium text-sm mb-1 group-hover:text-blue-600 transition-colors">Unassigned</span>
          <span className="text-4xl font-light text-slate-800">{metrics.unassigned}</span>
        </div>
      </div>

      {/* Toggle Data Mode Button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setIsSampleData(!isSampleData)}
          className="text-xs px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm"
        >
          {isSampleData ? 'Switch to Live Database Data' : 'Switch to Sample Data (Image 2)'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. TRENDS CHART */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Trends</h2>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span>Today</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="p-5 flex-1 flex flex-col min-h-[300px] relative">
            <div className="flex items-center gap-6 mb-8 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#186ade]"></span>
                <span className="text-gray-600">Received ({metrics.received})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#00b27b]"></span>
                <span className="text-gray-600">Resolved ({metrics.resolved})</span>
              </div>
            </div>
            
            {/* Chart Area */}
            <div className="flex-1 relative mt-4">
              <div className="absolute inset-0 border-l border-b border-gray-200" />
              <svg className="w-full h-full overflow-visible" viewBox="0 0 720 180" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="45" x2="720" y2="45" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="90" x2="720" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="135" x2="720" y2="135" stroke="#f1f5f9" strokeWidth="1" />
                
                {/* Curved Line representing "Received" */}
                <path
                  d={`M ${chartPoints.map(p => `${p.x},${p.y}`).join(' S ')}`}
                  fill="none"
                  stroke="#186ade"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Data points */}
                {chartPoints.map((p, i) => (
                  <g key={i} onMouseEnter={() => setHoveredHour(p.hour)} onMouseLeave={() => setHoveredHour(null)}>
                    <circle cx={p.x} cy={p.y} r="5" fill="white" stroke="#186ade" strokeWidth="2" className="cursor-pointer hover:r-[7px] transition-all duration-200" />
                    {hoveredHour === p.hour && (
                      <g>
                        <rect x={p.x - 20} y={p.y - 35} width="40" height="25" rx="4" fill="#12344d" />
                        <text x={p.x} y={p.y - 18} fill="white" fontSize="11" textAnchor="middle" fontWeight="bold">{p.val}</text>
                      </g>
                    )}
                  </g>
                ))}
              </svg>
              
              {/* X-axis labels */}
              <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] text-gray-400 font-medium px-4">
                <span>0h</span>
                <span>2h</span>
                <span>4h</span>
                <span>6h</span>
                <span>8h</span>
                <span>10h</span>
                <span>12h</span>
                <span>14h</span>
                <span>16h</span>
                <span>18h</span>
                <span>20h</span>
                <span>22h</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. UNRESOLVED TICKETS (Right column) */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Unresolved tickets</h2>
            <Link to="/agent/inbox" className="text-xs text-blue-600 hover:underline font-medium">View details</Link>
          </div>
          <div className="p-5 flex-1 flex items-center justify-center bg-gray-50/50">
            {metrics.unresolved > 0 ? (
              <div className="w-full space-y-3">
                <div className="text-center mb-6">
                  <span className="text-4xl font-light text-slate-800 block">{metrics.unresolved}</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Across {metrics.groupCounts.length} Groups</span>
                </div>
                {metrics.groupCounts.map((g: any) => (
                  <div key={g.name} className="flex items-center justify-between p-3 bg-white rounded border border-gray-100 shadow-sm cursor-pointer hover:border-gray-300 transition-colors">
                    <span className="text-sm font-medium text-gray-700">{g.name}</span>
                    <span className="text-sm font-bold text-gray-900">{g.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No unresolved tickets</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 4. TODAY'S TO-DO */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Today's To-do</h2>
          </div>
          <div className="flex-1 max-h-[300px] overflow-y-auto">
            {todos.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-sm font-medium text-gray-700">All caught up!</p>
                <p className="text-xs mt-1">Add tasks to stay organized.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {todos.map(todo => (
                  <li key={todo.id} className="p-4 hover:bg-gray-50 flex items-start gap-3 group transition-colors">
                    <button onClick={() => toggleTodo(todo.id)} className="mt-0.5 text-gray-400 hover:text-blue-500 transition-colors focus:outline-none">
                      {todo.completed ? (
                        <CheckSquare className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{todo.text}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{todo.subtext}</p>
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 shrink-0 uppercase tracking-wider">{todo.due}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            {isAddingTodo ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="What needs to be done?"
                  className="flex-1 text-sm border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={newTodoText}
                  onChange={e => setNewTodoText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
                />
                <button onClick={handleAddTodo} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors shadow-sm">Add</button>
                <button onClick={() => setIsAddingTodo(false)} className="px-2 py-1.5 text-gray-500 hover:text-gray-700 text-xs font-semibold rounded">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingTodo(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              >
                + Add a new to-do
              </button>
            )}
          </div>
        </div>

        {/* 5. CUSTOMER SATISFACTION */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Customer Satisfaction</h2>
            <Link to="/manager/reports" className="text-xs text-blue-600 hover:underline font-medium">View details</Link>
          </div>
          <div className="p-6 flex-1 flex flex-col items-center justify-center">
            {/* Donut Chart Representation */}
            <div className="relative w-32 h-32 mb-6">
              <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#12a150" strokeWidth="3" strokeDasharray={`${metrics.csatPercent}, 100`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-light text-slate-800">{metrics.csatPercent}<span className="text-lg">%</span></span>
              </div>
            </div>
            
            <div className="w-full max-w-xs space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#12a150]"></span>
                  <span className="text-gray-600 font-medium">Positive</span>
                </div>
                <span className="font-bold text-gray-900">{metrics.responses} responses</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="text-gray-600 font-medium">Negative</span>
                </div>
                <span className="font-bold text-gray-900">{Math.floor(metrics.responses * ((100 - metrics.csatPercent) / 100))} responses</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating Call to Action (like Image 2) */}
      {showFloatingBanner && (
        <div className="fixed bottom-6 right-6 max-w-sm bg-[#11263c] text-white p-4 rounded-xl shadow-2xl z-50 flex items-start gap-4 animate-in slide-in-from-bottom-5">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/30">
            <Sparkles className="w-5 h-5 text-blue-300" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm mb-1">Looking to automate support?</h3>
            <p className="text-xs text-blue-100/70 leading-relaxed mb-3">Try Freddy AI. Set up a bot to resolve up to 40% of queries instantly and free up your agents' time.</p>
            <div className="flex gap-2">
              <button onClick={() => alert('Freddy AI trial started!')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-semibold shadow transition-colors">Start 14-day free trial</button>
            </div>
          </div>
          <button onClick={() => setShowFloatingBanner(false)} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SEARCH MODAL */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Search tickets, contacts, or articles..."
                className="flex-1 border-none focus:ring-0 text-base py-1 outline-none font-medium placeholder:text-gray-400"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
              <button onClick={() => setShowSearchModal(false)} className="p-1 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              {!searchQuery ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  Type to start searching across your portal...
                </div>
              ) : isSearching ? (
                <div className="p-6 text-center text-sm text-gray-500 animate-pulse">
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                <ul className="space-y-1">
                  {searchResults.map(result => (
                    <li key={result.id}>
                      <button onClick={() => { setShowSearchModal(false); navigate(`/agent/tickets/${result.id}`); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 flex flex-col gap-0.5 group">
                        <span className="font-medium text-sm text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-1">{result.subject}</span>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                          <span className="uppercase tracking-wide text-gray-400">{result.ticket_number}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span>{result.status}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center text-sm text-gray-500">
                  No results found for "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
