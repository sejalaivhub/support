import { ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Headphones } from 'lucide-react';

interface CustomerPortalLayoutProps {
  children: ReactNode;
}

export function CustomerPortalLayout({ children }: CustomerPortalLayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initial = profile?.first_name ? profile.first_name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="min-h-screen bg-[#f5f7f9] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-[#ebeff3] sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
              <Headphones className="w-5 h-5" />
            </div>
            <span className="font-semibold text-[15px] text-[#12344d]">AIVHUB India Pvt.Ltd</span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center h-full text-[13px] font-medium text-[#475867]">
            {/* 
              Per requirements: 
              "For a particular user, only the Tickets and Submit Ticket options should be visible."
            */}
            
            <NavLink
              to="/portal/tickets"
              className={({ isActive }) =>
                `px-4 h-full flex items-center border-b-2 transition-colors ${
                  isActive ? 'border-[#12344d] bg-[#12344d] text-white' : 'border-transparent hover:text-[#12344d]'
                }`
              }
            >
              Tickets
            </NavLink>
            
            <NavLink
              to="/portal/tickets/new"
              className="px-4 py-1.5 ml-2 border border-[#cfd7df] rounded hover:bg-gray-50 transition-colors"
            >
              Submit a ticket
            </NavLink>

            {/* Profile / Avatar */}
            <div className="ml-6 relative group cursor-pointer">
              <div className="w-7 h-7 bg-[#cfd7df] rounded-full flex items-center justify-center text-white font-bold text-[12px]">
                {initial}
              </div>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#ebeff3] rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="px-4 py-3 border-b border-[#ebeff3]">
                  <p className="text-[13px] font-medium text-[#12344d]">{profile?.first_name} {profile?.last_name}</p>
                  <p className="text-[12px] text-[#475867] truncate">{profile?.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-[13px] text-red-600 hover:bg-gray-50 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto">
        {children}
      </main>
    </div>
  );
}
