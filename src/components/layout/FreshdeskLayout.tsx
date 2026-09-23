import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fullName } from '@/lib/constants';
import { FreshdeskSidebar } from './FreshdeskSidebar';
import {
  Plus, Search, ChevronDown, Phone,
  Bell, HelpCircle, Grid, Ticket, MessageSquare, User, Building2, Menu, LogOut, FileText, BarChart, Settings, PlayCircle, FolderOpen, Mail, BookOpen, Minus, X, Check, Sparkles
} from 'lucide-react';
import { saveAgent } from '@/lib/agentRoleService';
import { dbClient } from '@/lib/dbClient';
import { sendAccountActivationEmail } from '@/lib/emailService';
import { AddContactSlideOver } from '@/components/contacts/AddContactSlideOver';
import type { Profile, Account } from '@/types';
import { useEffect } from 'react';

interface FreshdeskLayoutProps {
  children: ReactNode;
}

export function FreshdeskLayout({ children }: FreshdeskLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [showHelpDropdown, setShowHelpDropdown] = useState(false);
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showInviteAgentModal, setShowInviteAgentModal] = useState(false);
  const [showAddContactSlideOver, setShowAddContactSlideOver] = useState(false);
  const [contactSuccessToast, setContactSuccessToast] = useState<string | null>(null);
  const [layoutContacts, setLayoutContacts] = useState<Profile[]>([]);
  const [layoutAccounts, setLayoutAccounts] = useState<Account[]>([]);

  useEffect(() => {
    async function loadContactsAndAccounts() {
      try {
        const { data: pData } = await dbClient.from('profiles').select('*');
        if (pData) setLayoutContacts(pData as Profile[]);
      } catch (e) {}

      try {
        const { data: aData } = await dbClient.from('accounts').select('*');
        if (aData) setLayoutAccounts(aData as Account[]);
      } catch (e) {}
    }
    loadContactsAndAccounts();
  }, [showAddContactSlideOver]);

  useEffect(() => {
    const handleOpen = () => setShowAddContactSlideOver(true);
    window.addEventListener('open-add-contact-panel', handleOpen);
    return () => window.removeEventListener('open-add-contact-panel', handleOpen);
  }, []);

  const handleSignOut = async () => {
    setShowProfileDropdown(false);
    await signOut();
    navigate('/login');
  };
  const [inviteRows, setInviteRows] = useState<{ id: string; email: string; role: string }[]>([
    { id: '1', email: '', role: 'Agent' },
  ]);
  const [inviting, setInviting] = useState(false);
  const [inviteToast, setInviteToast] = useState(false);

  const handleAddInviteRow = () => {
    setInviteRows(prev => [...prev, { id: String(Date.now()), email: '', role: 'Agent' }]);
  };

  const handleRemoveInviteRow = (id: string) => {
    if (inviteRows.length <= 1) return;
    setInviteRows(prev => prev.filter(r => r.id !== id));
  };

  const handleInviteSubmit = async () => {
    const validRows = inviteRows.filter(r => r.email.trim());
    if (validRows.length === 0) return;

    setInviting(true);
    for (const row of validRows) {
      const email = row.email.trim();
      const nameParts = email.split('@')[0].split(/[._-]/);
      const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Agent';
      const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'User';
      const agentId = `agent-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Map Freshdesk role name to internal role ID
      let roleId = 'role-agent';
      if (row.role === 'Account Administrator' || row.role === 'Administrator') roleId = 'role-admin';
      else if (row.role === 'Supervisor') roleId = 'role-supervisor';

      const agentData = {
        id: agentId,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: null,
        mobile: null,
        job_title: row.role,
        agent_type: 'FULL_TIME' as const,
        ticket_scope: 'GLOBAL' as const,
        role_ids: [roleId],
        team_ids: ['team-1'],
        language: 'English (US)',
        timezone: 'UTC +05:30 India Standard Time',
        signature: `--\n${firstName} ${lastName}\n${row.role} | Support Desk`,
        status: 'ACTIVE' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Save to local storage service
      saveAgent(agentData);

      // 2. Persist to profiles DB
      try {
        await dbClient.from('profiles').insert({
          id: agentId,
          email: email,
          auth_uid: null,
          first_name: firstName,
          last_name: lastName,
          user_type: 'agent',
          account_id: null,
          status: 'active',
          job_title: row.role,
        });
      } catch (err) {
        console.warn('DB profile insert notice:', err);
      }

      // 3. Send email invitation
      try {
        await sendAccountActivationEmail({
          id: agentId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          user_type: 'agent',
        });
      } catch (err) {
        console.warn('Email send notice:', err);
      }
    }

    setInviting(false);
    setShowInviteAgentModal(false);
    setInviteRows([{ id: '1', email: '', role: 'Agent' }]);
    setInviteToast(true);
    setTimeout(() => setInviteToast(false), 3500);
  };

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
      <div className="bg-[#ebf4fb] border-b border-[#d8e8f6] px-5 py-2 flex items-center justify-between text-xs text-slate-800 shrink-0 z-40">
        <div className="flex items-center gap-2">
          <span className="text-[#12344d]">
            Hi <span className="font-semibold">{profile ? fullName(profile.first_name, profile.last_name) : 'Sejal prasad'}</span>, you have <strong className="font-bold text-slate-900">14-days left</strong> in your trial.
          </span>
          <button
            onClick={() => alert('Trial setup: Setup profile, email channels, and SLA policies.')}
            className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-white border border-[#bce0fd] text-[#186ade] font-semibold text-[11px] rounded-full hover:bg-blue-50 transition-colors shadow-2xs ml-1"
          >
            <Sparkles className="w-3 h-3 text-[#186ade]" />
            <span>Continue setup</span>
            <span className="w-2.5 h-2.5 rounded-full border border-[#186ade] inline-block ml-0.5 opacity-60" />
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
          <header className="h-14 bg-white border-b border-gray-200 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
            
            {/* Left side: Header Title or Freshdesk Views Selector */}
            <div className="flex items-center gap-3">
              {location.pathname.startsWith('/agent/tickets/') && !location.pathname.includes('/new') ? (
                <div className="flex items-center gap-2">
                  <span
                    onClick={() => navigate('/agent/inbox')}
                    className="text-sm font-bold text-[#12344d] hover:text-blue-600 cursor-pointer"
                  >
                    Tickets
                  </span>
                  <span className="text-gray-400 text-xs">&gt;</span>
                  <span className="text-sm font-semibold text-gray-700">7</span>
                </div>
              ) : location.pathname === '/tickets' || location.pathname === '/agent/inbox' ? (
                <div className="flex items-center gap-2.5">
                  {/* Freshdesk Green Headset Icon */}
                  <div className="w-7 h-7 rounded-full bg-[#10b981] flex items-center justify-center text-white relative shadow-xs shrink-0">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a7 7 0 1 1 14 0h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z"/>
                    </svg>
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#10b981] border border-white rounded-full flex items-center justify-center text-[6px] font-bold leading-none">+</span>
                  </div>

                  {/* Filter / List icon */}
                  <button className="text-gray-400 hover:text-gray-600 p-1">
                    <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button>

                  {/* All tickets title with star and count badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#12344d] cursor-pointer hover:text-blue-600 flex items-center gap-1">
                      All tickets
                    </span>
                    <button className="text-gray-300 hover:text-amber-400">
                      <svg className="w-4 h-4 fill-none stroke-gray-400 stroke-2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                    <span className="w-5 h-5 rounded-full bg-[#12344d] text-white text-[11px] font-bold flex items-center justify-center">
                      5
                    </span>
                  </div>
                </div>
              ) : location.pathname === '/admin' || location.pathname === '/agent' ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-[#12a150] flex items-center justify-center text-white shadow-2xs shrink-0">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a7 7 0 1 1 14 0h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z"/>
                    </svg>
                  </div>
                  <h1 className="text-base font-semibold text-[#12344d] tracking-tight">{headerTitle}</h1>
                </>
              ) : (
                <h1 className="text-base font-semibold text-[#12344d] tracking-tight ml-3">{headerTitle}</h1>
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
                      onClick={() => {
                        setShowNewDropdown(false);
                        setShowAddContactSlideOver(true);
                      }}
                      className="w-full text-left px-3.5 py-1.5 text-[#12344d] hover:bg-slate-50 flex items-center gap-2.5 font-medium"
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
                      onClick={() => { setShowNewDropdown(false); setShowInviteAgentModal(true); }}
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

              {/* Profile Avatar Circle with Initial & Freshdesk Profile Menu */}
              <div className="relative">
                <button
                  type="button"
                  title={profile ? profile.email : 'System Admin'}
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="w-8 h-8 rounded-full bg-[#e9d5ff] text-[#6b21a8] font-bold text-xs flex items-center justify-center cursor-pointer border border-[#d8b4fe] hover:opacity-90 transition-opacity ml-1 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {profile?.first_name ? profile.first_name[0].toUpperCase() : 'S'}
                </button>

                {showProfileDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowProfileDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-3 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-800">
                      {/* User Header */}
                      <div className="px-4 pb-3 border-b border-gray-100">
                        <div className="font-bold text-sm text-[#12344d]">
                          {profile ? fullName(profile.first_name, profile.last_name) : 'System Admin'}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {profile?.email || 'admin@aivsupport.com'}
                        </div>
                      </div>

                      {/* Keyboard shortcuts row */}
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#12344d]">
                            <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="4" width="20" height="16" rx="2" />
                              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
                            </svg>
                            <span>Keyboard shortcuts</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            press <span className="font-bold text-slate-700">?</span> to view shortcuts
                          </div>
                        </div>
                        {/* Toggle switch */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={shortcutsEnabled}
                            onChange={(e) => setShortcutsEnabled(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#186ade]"></div>
                        </label>
                      </div>

                      {/* Menu options */}
                      <div className="py-1 border-b border-gray-100 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileDropdown(false);
                            navigate('/admin/settings');
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-[#12344d]"
                        >
                          <Settings className="w-4 h-4 text-slate-500" />
                          <span>Profile settings</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileDropdown(false);
                            navigate('/admin/settings');
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between text-[#12344d]"
                        >
                          <div className="flex items-center gap-2.5">
                            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span>Theme</span>
                          </div>
                          <span className="text-slate-400">&rsaquo;</span>
                        </button>
                      </div>

                      {/* Customer portal & schedule out of office */}
                      <div className="py-1 border-b border-gray-100 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileDropdown(false);
                            navigate('/portal');
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 text-[#12344d]"
                        >
                          Go to customer portal
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileDropdown(false);
                            alert('Schedule out of office is configured under Admin > Agents settings.');
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-[#12344d]"
                        >
                          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
                            <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/>
                            <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/>
                            <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/>
                          </svg>
                          <span>Schedule out of office</span>
                        </button>
                      </div>

                      {/* Sign out */}
                      <div className="pt-1 text-xs">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2.5 transition-colors"
                        >
                          <LogOut className="w-4 h-4 text-red-500" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 flex flex-col min-h-0 bg-[#f8fafc]">
            {children}
          </main>
        </div>
      </div>

      {/* SUCCESS TOAST */}
      {inviteToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white px-5 py-3 rounded-lg shadow-xl border-t-[3px] border-[#00b27b] animate-in fade-in slide-in-from-top-4">
          <div className="w-5 h-5 rounded-full bg-[#00b27b] text-white flex items-center justify-center">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span className="text-sm font-semibold text-gray-800">Agent invitation(s) sent successfully!</span>
          <button onClick={() => setInviteToast(false)} className="text-gray-400 hover:text-gray-600 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* FRESHDESK INVITE AGENTS MODAL */}
      {showInviteAgentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-7 pt-6 pb-2">
              <div className="flex items-center gap-3 text-gray-900 mb-1">
                <div className="w-6 h-6 text-slate-800">
                  <User className="w-6 h-6 text-[#12344d]" />
                </div>
                <h2 className="text-xl font-bold text-[#12344d] tracking-tight">Invite Agents</h2>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Invite agents and assign roles. Manage your team from{' '}
                <button
                  type="button"
                  onClick={() => { setShowInviteAgentModal(false); navigate('/admin/agents'); }}
                  className="font-bold text-[#186ade] hover:underline"
                >
                  Admin &gt; Agents
                </button>
              </p>
            </div>

            {/* Modal Body: Agent Rows */}
            <div className="px-7 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {inviteRows.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-3">
                  {/* Email Input */}
                  <div className="flex-1">
                    {idx === 0 && (
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                    )}
                    <input
                      type="email"
                      value={row.email}
                      placeholder="agent@company.com"
                      onChange={(e) => {
                        const val = e.target.value;
                        setInviteRows(prev => prev.map(r => r.id === row.id ? { ...r, email: val } : r));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none bg-white"
                    />
                  </div>

                  {/* Role Dropdown */}
                  <div className="w-48">
                    {idx === 0 && (
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Role <span className="text-red-500">*</span>
                      </label>
                    )}
                    <div className="relative">
                      <select
                        value={row.role}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInviteRows(prev => prev.map(r => r.id === row.id ? { ...r, role: val } : r));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none bg-white appearance-none cursor-pointer pr-8"
                      >
                        <option value="Agent">Agent</option>
                        <option value="Account Administrator">Account Administrator</option>
                        <option value="Administrator">Administrator</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Freddy AI Copilot User">Freddy AI Copilot User</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Remove row button */}
                  <div className={idx === 0 ? "pt-5" : ""}>
                    <button
                      type="button"
                      onClick={() => handleRemoveInviteRow(row.id)}
                      disabled={inviteRows.length === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* + Add Row Link/Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAddInviteRow}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#186ade] hover:text-[#1459be] px-1 py-1 rounded"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-7 py-4 bg-[#f9fafb] border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowInviteAgentModal(false);
                  setInviteRows([{ id: '1', email: '', role: 'Agent' }]);
                }}
                className="px-5 py-2 border border-gray-300 text-gray-700 font-semibold text-sm rounded-lg hover:bg-gray-100 transition-colors bg-white shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInviteSubmit}
                disabled={inviting || !inviteRows.some(r => r.email.trim())}
                className="px-5 py-2 bg-[#709cf5] hover:bg-[#5b8bf1] text-white font-semibold text-sm rounded-lg transition-colors shadow-2xs disabled:opacity-50"
              >
                {inviting ? 'Inviting...' : 'Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CONTACT SLIDE-OVER PANEL MATCHING SCREENSHOT 3 */}
      <AddContactSlideOver
        open={showAddContactSlideOver}
        onClose={() => setShowAddContactSlideOver(false)}
        existingContacts={layoutContacts}
        accounts={layoutAccounts}
        onSuccess={(newContact) => {
          setLayoutContacts(prev => [newContact, ...prev.filter(c => c.id !== newContact.id)]);
          setContactSuccessToast(`Contact ${fullName(newContact.first_name, newContact.last_name)} created successfully!`);
          setTimeout(() => setContactSuccessToast(null), 4000);
          window.dispatchEvent(new CustomEvent('contact-created', { detail: newContact }));
          if (!location.pathname.startsWith('/admin/users')) {
            navigate('/admin/users');
          }
        }}
      />

      {/* CONTACT CREATED SUCCESS TOAST */}
      {contactSuccessToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white px-5 py-3 rounded-lg shadow-xl border-t-[3px] border-[#00b27b] animate-in fade-in slide-in-from-top-4">
          <div className="w-5 h-5 rounded-full bg-[#00b27b] text-white flex items-center justify-center">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span className="text-sm font-semibold text-gray-800">{contactSuccessToast}</span>
          <button onClick={() => setContactSuccessToast(null)} className="text-gray-400 hover:text-gray-600 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
