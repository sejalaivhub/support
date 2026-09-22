import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Headphones, Sparkles, Gauge, Ticket, User, BookOpen,
  MessageSquare, Bot, BarChart2, Settings, PanelLeftClose,
  PanelLeftOpen, LogOut
} from 'lucide-react';

interface FreshdeskSidebarProps {
  className?: string;
  onCollapseChange?: (collapsed: boolean) => void;
}

export function FreshdeskSidebar({ className = '', onCollapseChange }: FreshdeskSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('freshdesk_sidebar_collapsed');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('freshdesk_sidebar_collapsed', String(next));
      } catch (e) {}
      if (onCollapseChange) onCollapseChange(next);
      return next;
    });
  };

  useEffect(() => {
    if (onCollapseChange) onCollapseChange(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  const navItems = [
    {
      id: 'freddy',
      label: 'Freddy AI Insights',
      icon: Sparkles,
      path: '/admin',
      isAi: true,
      onClick: () => {
        alert('Freddy AI Insights: Analyzed 24 tickets today. Top inquiry category: API Integration (38%). Overall sentiment: Positive (88%).');
      }
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Gauge,
      path: '/admin',
      isActive: location.pathname === '/admin' || location.pathname === '/agent',
    },
    {
      id: 'tickets',
      label: 'Tickets',
      icon: Ticket,
      path: '/tickets',
      isActive: location.pathname.startsWith('/tickets') || location.pathname.startsWith('/agent/inbox'),
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: User,
      path: '/admin/users',
      isActive: location.pathname.startsWith('/admin/users') || location.pathname.startsWith('/admin/accounts'),
    },
    {
      id: 'solutions',
      label: 'Solutions',
      icon: BookOpen,
      path: '/tickets',
      isActive: false,
      onClick: () => {
        navigate('/tickets');
      }
    },
    {
      id: 'forums',
      label: 'Forums',
      icon: MessageSquare,
      path: '/tickets',
      isActive: false,
      onClick: () => {
        navigate('/tickets');
      }
    },
    {
      id: 'ai-agent-studio',
      label: 'AI Agent Studio',
      icon: Bot,
      path: '/admin/sla',
      isActive: location.pathname === '/admin/sla',
      onClick: () => {
        navigate('/admin/sla');
      }
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart2,
      path: '/manager/reports',
      isActive: location.pathname.startsWith('/manager'),
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: Settings,
      path: '/admin/settings',
      isActive: location.pathname === '/admin/settings' || location.pathname === '/admin/roles' || location.pathname === '/admin/plans',
    },
  ];

  return (
    <aside
      className={`bg-white border-r border-gray-200 flex flex-col justify-between transition-all duration-200 ease-in-out select-none flex-shrink-0 z-30 ${
        isCollapsed ? 'w-14' : 'w-56'
      } ${className}`}
    >
      {/* Top Header & Nav Items */}
      <div className="flex flex-col w-full">
        {/* Header with Freshdesk Logo */}
        <div className={`h-12 flex items-center ${isCollapsed ? 'justify-center' : 'px-3.5 gap-2.5'} border-b border-gray-100`}>
          {/* Green Circle Headset Logo with white + badge */}
          <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white relative flex-shrink-0 shadow-xs cursor-pointer" onClick={() => navigate('/tickets')}>
            <Headphones className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#10b981] border-2 border-white rounded-full flex items-center justify-center text-[7px] font-extrabold leading-none">+</span>
          </div>

          {!isCollapsed && (
            <span className="font-bold text-[#12344d] text-sm tracking-tight truncate">
              Support Desk
            </span>
          )}
        </div>

        {/* Navigation List */}
        <nav className="p-1.5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive;

            return (
              <button
                key={item.id}
                onClick={item.onClick || (() => navigate(item.path))}
                title={item.label}
                className={`w-full flex items-center rounded-lg text-xs font-medium transition-colors ${
                  isCollapsed ? 'h-9 justify-center' : 'h-9 px-3 gap-3'
                } ${
                  active
                    ? 'bg-[#11263c] text-white shadow-xs'
                    : 'text-[#475569] hover:text-[#12344d] hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white stroke-[2.2]' : 'text-slate-600'}`} />
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap text-xs font-medium">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions: Collapse / Expand & Freshworks Logo */}
      <div className="flex flex-col items-center pb-3 gap-2">
        {/* Sign Out Button */}
        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          title="Sign out"
          className={`w-full flex items-center rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors ${
            isCollapsed ? 'h-9 justify-center' : 'h-9 px-3 gap-3'
          }`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && (
            <span className="truncate whitespace-nowrap text-xs font-medium">
              Sign out
            </span>
          )}
        </button>

        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={toggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        {/* Freshworks 9-dots logo */}
        <div className="grid grid-cols-3 gap-0.5 p-1 cursor-pointer opacity-70 hover:opacity-100 transition-opacity" title="Freshworks 360">
          <div className="bg-[#e11d48] rounded-full w-1.5 h-1.5"></div>
          <div className="bg-[#f97316] rounded-full w-1.5 h-1.5"></div>
          <div className="bg-[#eab308] rounded-full w-1.5 h-1.5"></div>
          <div className="bg-[#22c55e] rounded-full w-1.5 h-1.5"></div>
          <div className="bg-[#06b6d4] rounded-full w-1.5 h-1.5"></div>
          <div className="bg-[#3b82f6] rounded-full w-1.5 h-1.5"></div>
          <div className="bg-[#8b5cf6] rounded-full w-1.5 h-1.5"></div>
          <div className="bg-[#ec4899] rounded-full w-1.5 h-1.5"></div>
          <div className="bg-[#14b8a6] rounded-full w-1.5 h-1.5"></div>
        </div>
      </div>
    </aside>
  );
}
