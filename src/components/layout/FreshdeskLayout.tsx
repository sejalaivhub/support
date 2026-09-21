import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fullName } from '@/lib/constants';
import { FreshdeskSidebar } from './FreshdeskSidebar';
import {
  Plus, Search, ChevronDown, Phone,
  Bell, HelpCircle, Grid, Ticket, MessageSquare, User, Building2, Menu, LogOut, FileText, BarChart, Settings, PlayCircle, FolderOpen, Mail, BookOpen
} from 'lucide-react';

interface FreshdeskLayoutProps {
  children: ReactNode;
}

export function FreshdeskLayout({ children }: FreshdeskLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const [showHelpDropdown, setShowHelpDropdown] = useState(false);
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Determine the title based on the route
  const getHeaderTitle = () => {
    if (location.pathname === '/agent/tickets/new') return 'New ticket';
    if (location.pathname.startsWith('/agent/tickets/')) return 'Ticket details';
    if (location.pathname === '/admin/users') return 'Contacts';
    if (location.pathname === '/admin/accounts') return 'Companies';
    if (location.pathname === '/admin/settings') return 'Settings';
    if (location.pathname === '/admin' || location.pathname === '/agent') return 'Dashboard';
    return 'Support Desk';
  };

  const headerTitle = getHeaderTitle();

  return (
    <div className="min-h-screen bg-[#f3f5f7] flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-100">
      {/* TOP TRIAL BANNER */}
      <div className="bg-[#ebf4fb] border-b border-[#d8e8f6] px-6 py-2.5 flex items-center justify-between text-xs text-slate-800 shrink-0 z-40">
        <div className="flex items-center gap-2">
          <span>
            Hi <span className="font-semibold">{profile ? fullName(profile.first_name, profile.last_name) : 'System Admin'}</span>, you have <strong className="font-bold text-slate-900">11-days left</strong> in your trial.
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

      <div className="flex flex-1 overflow-hidden">
        {/* FRESHDESK COLLAPSIBLE SIDEBAR */}
        <FreshdeskSidebar />

        {/* 2. MAIN VIEWPORT */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* TOP HEADER / NAVBAR */}
          <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
            
            {/* Left side: Header Title */}
            <div className="flex items-center gap-3">
              {location.pathname === '/admin' || location.pathname === '/agent' ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-[#12a150] flex items-center justify-center text-white shadow-2xs shrink-0">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a7 7 0 1 1 14 0h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z"/>
                    </svg>
                  </div>
                  <h1 className="text-base font-semibold text-[#12344d] tracking-tight">{headerTitle}</h1>
                </>
              ) : (
                <h1 className="text-base font-semibold text-[#12344d] tracking-tight ml-2">{headerTitle}</h1>
              )}
            </div>

            {/* Right: + New, Search, Bell, Help, Apps, User Avatar */}
            <div className="flex items-center gap-4">
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
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1.5 z-40 text-sm">
                    <button
                      onClick={() => { setShowNewDropdown(false); navigate('/agent/tickets/new'); }}
                      className="w-full text-left px-3.5 py-1.5 text-[#12344d] hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <Ticket className="w-4 h-4 text-slate-500" />
                      <span>Ticket</span>
                    </button>
                    <button
                      onClick={() => { setShowNewDropdown(false); }}
                      className="w-full text-left px-3.5 py-1.5 text-[#12344d] hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <Mail className="w-4 h-4 text-slate-500" />
                      <span>Email</span>
                    </button>
                    <button
                      onClick={() => { setShowNewDropdown(false); }}
                      className="w-full text-left px-3.5 py-1.5 text-[#12344d] hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <MessageSquare className="w-4 h-4 text-slate-500" />
                      <span>Message</span>
                    </button>
                    <button
                      onClick={() => { setShowNewDropdown(false); navigate('/admin/users'); }}
                      className="w-full text-left px-3.5 py-1.5 text-[#12344d] hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      <span>Contact</span>
                    </button>
                    <button
                      onClick={() => { setShowNewDropdown(false); navigate('/admin/accounts'); }}
                      className="w-full text-left px-3.5 py-1.5 text-[#12344d] hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <span>Company</span>
                    </button>
                    <button
                      onClick={() => { setShowNewDropdown(false); navigate('/admin/agents'); }}
                      className="w-full text-left px-3.5 py-1.5 text-[#12344d] hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      <span>Agent</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Search Input Bar */}
              <div
                onClick={() => setShowSearchModal(true)}
                className="flex items-center justify-between px-3 py-1.5 bg-white border border-gray-300 hover:border-gray-400 rounded text-xs text-gray-400 cursor-pointer w-48 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  <span>Search</span>
                </div>
              </div>

              {/* Bell Icon */}
              <button className="text-gray-500 hover:text-gray-700 transition-colors">
                <Bell className="w-4 h-4" />
              </button>

              {/* Help Icon */}
              <div className="relative">
                <button className="flex items-center justify-center w-6 h-6 rounded border border-gray-300 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Apps Icon */}
              <button className="flex items-center gap-1.5 text-gray-600 hover:text-gray-800 transition-colors text-xs font-semibold">
                <Grid className="w-4 h-4" />
                <span>Apps</span>
              </button>

              {/* Profile Avatar Circle with Initial */}
              <div
                title={profile ? profile.email : 'System Admin'}
                onClick={() => navigate('/admin/settings')}
                className="w-8 h-8 rounded-full bg-[#e9d5ff] text-[#6b21a8] font-bold text-xs flex items-center justify-center cursor-pointer border border-[#d8b4fe] hover:opacity-90 transition-opacity ml-1 shrink-0"
              >
                {profile?.first_name ? profile.first_name[0].toUpperCase() : 'S'}
              </div>
            </div>
          </header>

          <main className="flex-1 flex flex-col min-h-0 bg-white">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
