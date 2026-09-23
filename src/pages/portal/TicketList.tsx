import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui';
import type { Ticket } from '@/types';
import { Search, Download, Globe } from 'lucide-react';

function formatCustomDate(dateString: string) {
  const d = new Date(dateString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[d.getDay()];
  const dateNum = d.getDate();
  const monthName = months[d.getMonth()];
  
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; 
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  
  return `${dayName}, ${dateNum} ${monthName} at ${hours}:${minutesStr} ${ampm}`;
}

export function TicketList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Filter states to match UI
  const [sortBy, setSortBy] = useState('Date Created');
  const [statusFilter, setStatusFilter] = useState('All Tickets');

  const loadTickets = useCallback(async () => {
    setLoading(true);

    if (!profile?.account_id) {
      setLoading(false);
      return;
    }

    try {
      let query = dbClient
        .from('tickets')
        .select('*')
        .eq('account_id', profile.account_id)
        .order('created_at', { ascending: false });

      if (profile.user_type === 'customer_user') {
        // Enforce data security: customer_user can ONLY see their own tickets
        query = query.eq('created_by_user_id', profile.id);
      }

      let customTickets: Ticket[] = [];
      try {
        customTickets = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
      } catch (e) {}

      const { data } = await query;
      
      let allTickets: Ticket[] = [...customTickets];
      if (data) {
        allTickets = [...customTickets, ...(data as Ticket[])];
      }
      
      const uniqueMap = new Map();
      allTickets.forEach(t => uniqueMap.set(t.id, t));
      setTickets(Array.from(uniqueMap.values()));
      
    } catch (e) {
      console.error("Failed to load tickets", e);
      try {
        const customTickets = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
        setTickets(customTickets);
      } catch (err) {}
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const filteredTickets = tickets.filter((t) => {
    // Basic search
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.ticket_number.toLowerCase().includes(search.toLowerCase())) return false;
    
    // Status filter
    if (statusFilter === 'Open or Pending') {
      if (!['OPEN', 'PENDING', 'NEW', 'IN_PROGRESS'].includes(t.status)) return false;
    } else if (statusFilter === 'Resolved or Closed') {
      if (!['RESOLVED', 'CLOSED'].includes(t.status)) return false;
    }
    
    return true;
  });

  // Sort logic
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (sortBy === 'Date Created' || sortBy === 'Descending') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === 'Ascending') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    // Add other sort options if needed
    return 0;
  });

  if (loading) return <Spinner label="Loading tickets..." />;

  return (
    <div className="min-h-screen bg-[#f5f7f9] font-sans">
      
      {/* Blue Header Area */}
      <div className="bg-[#12344d] text-white pt-6 pb-12">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-start mb-8">
            <Link to="/portal" className="text-white hover:underline text-[13px]">
              Home
            </Link>
            
            {/* Search Bar matching screenshot */}
            <div className="relative w-[300px]">
              <input
                type="text"
                placeholder="Search your tickets here..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-4 pr-10 py-2 rounded text-[13px] text-gray-900 focus:outline-none"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          <h1 className="text-[32px] font-bold">Tickets</h1>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 -mt-6 pb-12">
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left Column: Tickets List */}
          <div className="flex-1 bg-white rounded shadow-sm border border-gray-100 p-6 min-h-[400px]">
            {sortedTickets.length === 0 ? (
              <div className="text-center py-12 text-[#475867] text-[14px]">
                No tickets found matching your criteria.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedTickets.map((ticket) => {
                  // Format: "Wed, 23 Sep at 2:39 PM"
                  const createdStr = formatCustomDate(ticket.created_at);
                  
                  // Status badge styling based on freshdesk
                  let statusColor = "text-[#d7500f] border-[#f4c8b2] bg-[#fbf3ef]"; // Default "Open" look
                  let statusText = ticket.status;
                  
                  if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
                    statusColor = "text-[#00824b] border-[#b2e2cd] bg-[#eef8f3]";
                  } else if (ticket.status === 'PENDING') {
                    statusColor = "text-[#2c5cc5] border-[#c0d2f4] bg-[#eff3fc]";
                  }

                  return (
                    <div 
                      key={ticket.id} 
                      className="py-4 flex justify-between items-start hover:bg-gray-50 transition-colors cursor-pointer rounded -mx-4 px-4"
                      onClick={() => navigate(`/portal/tickets/${ticket.id}`)}
                    >
                      <div className="flex items-start gap-3">
                        <Globe className="w-5 h-5 text-[#2c5cc5] mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[15px] font-medium text-[#2c5cc5] hover:underline mb-1">
                            {ticket.subject} <span className="text-[#475867]">#{ticket.ticket_number.replace('AIV-', '')}</span>
                          </div>
                          <div className="text-[13px] text-[#475867]">
                            Created on {createdStr} - via Portal
                          </div>
                        </div>
                      </div>
                      <div className={`px-2.5 py-0.5 rounded border text-[12px] font-medium shrink-0 ${statusColor}`}>
                        {statusText.charAt(0).toUpperCase() + statusText.slice(1).toLowerCase()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Filters Sidebar */}
          <div className="w-full lg:w-[300px] shrink-0 space-y-6">
            
            <button className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white border border-[#cfd7df] text-[#12344d] text-[13px] font-semibold rounded hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> Export Tickets
            </button>
            
            <div className="bg-[#f5f7f9]">
              <div className="space-y-4">
                
                {/* Sort by */}
                <div>
                  <label className="block text-[13px] font-bold text-[#12344d] mb-1.5">Sort by</label>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full p-2 bg-white border border-[#cfd7df] rounded text-[13px] text-[#12344d] focus:outline-none focus:border-[#2c5cc5]"
                  >
                    <option>Date Created</option>
                    <option>Last Modified</option>
                    <option>Priority</option>
                    <option>Status</option>
                    <option>Ascending</option>
                    <option>Descending</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[13px] font-bold text-[#12344d] mb-1.5">Status</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full p-2 bg-white border border-[#cfd7df] rounded text-[13px] text-[#12344d] focus:outline-none focus:border-[#2c5cc5]"
                  >
                    <option>All Tickets</option>
                    <option>Open or Pending</option>
                    <option>Resolved or Closed</option>
                    <option>Archive</option>
                  </select>
                </div>

                {/* Created date */}
                <div>
                  <label className="block text-[13px] font-bold text-[#12344d] mb-1.5">Created date</label>
                  <input 
                    type="text" 
                    placeholder="Select dates"
                    readOnly
                    className="w-full p-2 bg-white border border-[#cfd7df] rounded text-[13px] text-[#475867] cursor-not-allowed focus:outline-none"
                  />
                </div>

                {/* Resolved date */}
                <div>
                  <label className="block text-[13px] font-bold text-[#12344d] mb-1.5">Resolved date</label>
                  <input 
                    type="text" 
                    placeholder="Select dates"
                    readOnly
                    className="w-full p-2 bg-white border border-[#cfd7df] rounded text-[13px] text-[#475867] cursor-not-allowed focus:outline-none"
                  />
                </div>
                
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
