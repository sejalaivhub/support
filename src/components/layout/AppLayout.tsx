import { type ReactNode, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Ticket, Plus, Settings, Users, Building2,
  LogOut, Menu, X, Bell, Shield, BarChart3, Calendar, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Badges';
import { fullName } from '@/lib/constants';
import { FreshdeskLayout } from './FreshdeskLayout';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const customerNav: NavItem[] = [
  { to: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/portal/tickets', label: 'My Tickets', icon: Ticket },
  { to: '/portal/tickets/new', label: 'New Ticket', icon: Plus },
];

const agentNav: NavItem[] = [
  { to: '/agent', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agent/inbox', label: 'Ticket Inbox', icon: Ticket },
  { to: '/agent/queue', label: 'Ticket Queue', icon: Ticket },
  { to: '/agent/tickets/new', label: 'Create Ticket', icon: Plus },
];

const managerNav: NavItem[] = [
  { to: '/agent', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agent/inbox', label: 'Ticket Inbox', icon: Ticket },
  { to: '/agent/queue', label: 'Ticket Queue', icon: Ticket },
  { to: '/manager/reports', label: 'Reports', icon: BarChart3 },
];

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agent/inbox', label: 'Ticket Inbox', icon: Ticket },
  { to: '/admin/plans', label: 'Support Plans', icon: Shield },
  { to: '/admin/sla', label: 'SLA Policies', icon: BarChart3 },
  { to: '/admin/teams', label: 'Teams', icon: Users },
  { to: '/admin/categories', label: 'Types & Categories', icon: Settings },
  { to: '/admin/calendars', label: 'Business Calendars', icon: Calendar },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];


function getNavItems(userType: string): NavItem[] {
  switch (userType) {
    case 'customer_user':
    case 'customer_admin':
      return customerNav;
    case 'agent':
      return agentNav;
    case 'manager':
      return managerNav;
    case 'account_manager':
      return [...agentNav, { to: '/manager/reports', label: 'Reports', icon: BarChart3 }];
    case 'admin':
      return adminNav;
    default:
      return customerNav;
  }
}

function getPortalLabel(userType: string): string {
  switch (userType) {
    case 'customer_user':
    case 'customer_admin':
      return 'Customer Portal';
    case 'agent':
      return 'Agent Workspace';
    case 'manager':
      return 'Manager Dashboard';
    case 'account_manager':
      return 'Account Management';
    case 'admin':
      return 'Admin Console';
    default:
      return 'Support Portal';
  }
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  ticketId?: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'New ticket created',
    message: '#AIV-000003: Production API endpoint returning 500 errors',
    time: '5 minutes ago',
    ticketId: 't-3',
    read: false,
  },
  {
    id: 'n-2',
    title: 'Customer replied',
    message: 'John Smith replied on ticket #AIV-000001',
    time: '20 minutes ago',
    ticketId: 't-1',
    read: false,
  },
  {
    id: 'n-3',
    title: 'SLA Warning',
    message: 'Resolution target approaching for #AIV-000002',
    time: '1 hour ago',
    ticketId: 't-2',
    read: false,
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const [teamsHovered, setTeamsHovered] = useState(false);

  if (!profile) return null;

  const navItems = getNavItems(profile.user_type);
  const portalLabel = getPortalLabel(profile.user_type);
  const isCustomer = profile.user_type === 'customer_user' || profile.user_type === 'customer_admin';
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleNotificationClick = (item: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    setShowNotifications(false);
    if (item.ticketId) {
      const targetPath = isCustomer
        ? `/portal/tickets/${item.ticketId}`
        : `/agent/tickets/${item.ticketId}`;
      navigate(targetPath);
    }
  };

  const handleRemoveNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };



  if (!isCustomer) {
    return <FreshdeskLayout>{children}</FreshdeskLayout>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between px-5 h-16 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm">A</div>
            <span className="font-semibold text-sm tracking-tight">AIV Support</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 py-4 border-b border-slate-700/50">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-2 mb-1">{portalLabel}</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {navItems.map((item) => {
            if (item.label === 'Teams') {
              return (
                <div
                  key={item.to}
                  className="relative"
                  onMouseEnter={() => setTeamsHovered(true)}
                  onMouseLeave={() => setTeamsHovered(false)}
                >
                  <div
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-default select-none ${
                      teamsHovered
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${teamsHovered ? 'rotate-90 text-white' : 'text-slate-400'}`} />
                  </div>

                  {/* Submenu on Hover */}
                  {teamsHovered && (
                    <div className="pl-3 pr-1 py-1 space-y-0.5 bg-slate-800/90 rounded-b-lg border-l-2 border-blue-500 my-1 animate-in fade-in-50 duration-150">
                      <NavLink
                        to="/admin/accounts"
                        onClick={() => { setSidebarOpen(false); setTeamsHovered(false); }}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`
                        }
                      >
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Companies</span>
                      </NavLink>

                      <NavLink
                        to="/admin/users"
                        onClick={() => { setSidebarOpen(false); setTeamsHovered(false); }}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`
                        }
                      >
                        <Users className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Contacts</span>
                      </NavLink>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/portal' || item.to === '/agent' || item.to === '/admin' || item.to === '/manager'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-slate-700/50">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar firstName={profile.first_name} lastName={profile.last_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{fullName(profile.first_name, profile.last_name)}</p>
              <p className="text-xs text-slate-400 truncate">{profile.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 mt-1 w-full rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600">
              <Menu className="w-5 h-5" />
            </button>
            {isCustomer && (
              <span className="text-sm text-gray-500 hidden sm:block">
                Welcome back, {profile.first_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden text-xs animate-in fade-in-50 zoom-in-95 duration-100">
                    <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                      <span className="font-bold text-gray-900">
                        Notifications {unreadCount > 0 && <span className="text-blue-600">({unreadCount})</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-[11px] text-blue-600 hover:underline font-semibold"
                          >
                            Mark all as read
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={handleClearAll}
                            className="text-[11px] text-gray-500 hover:text-red-600 hover:underline font-semibold"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>

                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="font-semibold text-gray-700 text-xs">No notifications</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                        {notifications.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            className={`p-3 hover:bg-gray-50 cursor-pointer flex items-start justify-between group transition-colors ${
                              !item.read ? 'bg-blue-50/40' : ''
                            }`}
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                {!item.read && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0" />}
                                <p className={`font-bold truncate ${!item.read ? 'text-blue-950' : 'text-gray-900'}`}>{item.title}</p>
                              </div>
                              <p className="text-gray-600 mt-0.5 text-xs line-clamp-2">{item.message}</p>
                              <span className="text-[10px] text-gray-400 mt-1 block">{item.time}</span>
                            </div>
                            <button
                              onClick={(e) => handleRemoveNotification(e, item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-opacity"
                              title="Dismiss notification"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Avatar firstName={profile.first_name} lastName={profile.last_name} size="sm" />
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900 leading-tight">{fullName(profile.first_name, profile.last_name)}</p>
                <p className="text-xs text-gray-500 capitalize">{profile.user_type.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {children}

        </main>
      </div>
    </div>
  );
}
