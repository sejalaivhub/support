import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Search, ChevronRight, Paperclip } from 'lucide-react';
import type { TicketPriority } from '@/types';

export function CreateTicket() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('P4'); // Default Low
  const [ticketType, setTicketType] = useState('Choose...');
  const [product, setProduct] = useState('Example');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [search, setSearch] = useState('');

  const requesterEmail = profile?.email || 'neel@aivhub.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) { 
      setError('Subject and description are required.'); 
      return; 
    }

    setLoading(true);
    setError(null);

    const activeAccountId = profile?.account_id || '00000000-0000-0000-0000-000000001001';

    let dbTicket: any;
    try {
      const { data, error } = await dbClient.from('tickets').insert({
        account_id: activeAccountId,
        created_by_user_id: profile?.id || 'a88e9f9c-49f2-46cc-ae61-fc9d3282fc20',
        subject: subject.trim(),
        description: description,
        priority,
        status: 'NEW',
        assigned_agent_id: '00000000-0000-0000-0000-000000000a03'
      }).select().single();
      
      if (data && !error) {
        dbTicket = data;
      }
    } catch (e) {
      console.warn('DB insert failed, falling back to local storage', e);
    }

    // Basic local insertion fallback if DB fails
    if (!dbTicket) {
      const localId = `ticket-local-${Date.now()}`;
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const ticketNum = `AIV-${randomNum}`;
      dbTicket = {
        id: localId,
        ticket_number: ticketNum,
        account_id: activeAccountId,
        created_by_user_id: profile?.id || 'a88e9f9c-49f2-46cc-ae61-fc9d3282fc20',
        subject: subject.trim(),
        description: description,
        priority,
        status: 'NEW',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        accounts: { id: activeAccountId, company_name: 'Acme Corp', account_code: 'ACME001' },
        created_by_user: profile ? { id: profile.id, first_name: profile.first_name, last_name: profile.last_name, email: profile.email } : { id: 'a88e9f9c-49f2-46cc-ae61-fc9d3282fc20', first_name: 'Customer', last_name: 'User', email: requesterEmail },
      };

      try {
        const existing = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
        localStorage.setItem('local_custom_tickets', JSON.stringify([dbTicket, ...existing]));
      } catch (err) {
        console.error(err);
      }
    }

    setLoading(false);
    navigate('/portal/tickets');
  };

  return (
    <div className="min-h-screen bg-[#f5f7f9] font-sans pb-12">
      
      {/* Blue Header Area */}
      <div className="bg-[#12344d] text-white pt-4 pb-12">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center text-[13px] text-white/90">
              <Link to="/portal" className="hover:underline">Home</Link>
              <ChevronRight className="w-3.5 h-3.5 mx-1" />
              <span>Submit a ticket</span>
            </div>
            
            {/* Search Bar matching screenshot */}
            <div className="relative w-[300px] flex">
              <input
                type="text"
                placeholder="Enter the search term here...."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-4 pr-10 py-2 rounded-l text-[13px] text-gray-900 border-none focus:outline-none"
              />
              <button className="bg-white border-l border-gray-200 px-3 rounded-r flex items-center justify-center text-gray-500 hover:text-gray-700">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <h1 className="text-[32px] font-bold">Submit a ticket</h1>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 -mt-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-[900px]">
          
          <p className="text-[14px] text-gray-600 font-medium mb-6">
            Fields marked <span className="text-red-500">*</span> are mandatory
          </p>

          {error && (
            <div className="mb-6 p-3 rounded bg-red-50 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Requester */}
            <div>
              <label className="block text-[14px] font-bold text-[#12344d] mb-1.5">
                Requester <span className="text-red-500">*</span>
              </label>
              <input 
                type="email"
                value={requesterEmail}
                readOnly
                className="w-full p-2.5 bg-white border border-[#cfd7df] rounded text-[14px] text-gray-800 focus:outline-none focus:border-[#2c5cc5] focus:ring-1 focus:ring-[#2c5cc5]"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[14px] font-bold text-[#12344d] mb-1.5">
                Subject <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full p-2.5 bg-white border border-[#cfd7df] rounded text-[14px] text-gray-800 focus:outline-none focus:border-[#2c5cc5] focus:ring-1 focus:ring-[#2c5cc5]"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-[14px] font-bold text-[#12344d] mb-1.5">
                Type
              </label>
              <select 
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value)}
                className="w-full p-2.5 bg-white border border-[#cfd7df] rounded text-[14px] text-[#12344d] focus:outline-none focus:border-[#2c5cc5] focus:ring-1 focus:ring-[#2c5cc5] appearance-none"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2312344d%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
              >
                <option value="Choose...">Choose...</option>
                <option value="Question">Question</option>
                <option value="Incident">Incident</option>
                <option value="Problem">Problem</option>
                <option value="Feature Request">Feature Request</option>
                <option value="Refund">Refund</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[14px] font-bold text-[#12344d] mb-1.5">
                Priority
              </label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full p-2.5 bg-white border border-[#cfd7df] rounded text-[14px] text-[#12344d] focus:outline-none focus:border-[#2c5cc5] focus:ring-1 focus:ring-[#2c5cc5] appearance-none"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2312344d%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
              >
                <option value="P4">Low</option>
                <option value="P3">Medium</option>
                <option value="P2">High</option>
                <option value="P1">Urgent</option>
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="block text-[14px] font-bold text-[#12344d] mb-1.5">
                Product
              </label>
              <select 
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full p-2.5 bg-white border border-[#cfd7df] rounded text-[14px] text-[#12344d] focus:outline-none focus:border-[#2c5cc5] focus:ring-1 focus:ring-[#2c5cc5] appearance-none"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2312344d%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
              >
                <option value="Example">Example</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[14px] font-bold text-[#12344d] mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <div className="border border-[#cfd7df] rounded">
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Type something"
                />
              </div>
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-[14px] font-bold text-[#12344d] mb-1.5">
                Reference Number
              </label>
              <input 
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full p-2.5 bg-white border border-[#cfd7df] rounded text-[14px] text-gray-800 focus:outline-none focus:border-[#2c5cc5] focus:ring-1 focus:ring-[#2c5cc5]"
              />
            </div>

            {/* Attach files */}
            <div>
              <button type="button" className="flex items-center gap-1.5 text-[#2c5cc5] text-[14px] font-semibold hover:underline">
                <Paperclip className="w-4 h-4" /> Attach files
              </button>
            </div>



            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => navigate(-1)}
                className="px-6 py-2 bg-white border border-[#cfd7df] rounded text-[#12344d] text-[14px] font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="px-6 py-2 bg-[#12344d] text-white rounded text-[14px] font-semibold hover:bg-[#12344d]/90 transition-colors disabled:opacity-70"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
