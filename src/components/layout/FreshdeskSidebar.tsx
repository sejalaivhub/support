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
      return localStorage.getItem('freshdesk_sidebar_collapsed') === 'true';
    } catch {
      return false;
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
      className={`bg-white border-r border-gray-200 flex flex-col justify-between transition-all duration-300 ease-in-out select-none flex-shrink-0 z-30 ${
        isCollapsed ? 'w-16' : 'w-60'
      } ${className}`}
    >
      {/* Top Header & Nav Items */}
      <div className="flex flex-col w-full">
        {/* Header with Freshdesk Logo */}
        <div className={`h-14 flex items-center border-b border-gray-100 ${isCollapsed ? 'justify-center px-2' : 'px-4 gap-2.5'}`}>
          {/* Green Circle Headset Logo */}
          <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white relative flex-shrink-0 shadow-xs">
            <Headphones className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#10b981] border-2 border-white rounded-full flex items-center justify-center text-[8px] font-extrabold leading-none">+</span>
          </div>

          {!isCollapsed && (
            <span className="font-bold text-slate-900 text-base tracking-tight truncate animate-in fade-in duration-200">
              Support Desk
            </span>
          )}
        </div>

        {/* Navigation List */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive;

            return (
              <button
                key={item.id}
                onClick={item.onClick || (() => navigate(item.path))}
                title={item.label}
                className={`w-full flex items-center rounded-lg text-xs font-medium transition-all ${
                  isCollapsed ? 'h-10 justify-center' : 'h-10 px-3 gap-3.5'
                } ${
                  active
                    ? 'bg-[#11263c] text-white font-semibold shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white stroke-[2.2]' : 'text-slate-600'}`} />
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap text-slate-800 text-xs font-medium animate-in fade-in duration-200">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions: Collapse / Expand & Freshworks Logo */}
      <div className="flex flex-col items-center pb-4">
        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={toggleCollapse}
          title={isCollapsed ? 'Expand' : 'Collapse'}
          className="w-8 h-8 flex items-center justify-center rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors mb-4"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </button>

        {/* Freshworks 9-dots logo */}
        <div className="grid grid-cols-3 gap-0.5 w-4 h-4 opacity-80 cursor-pointer hover:opacity-100 transition-opacity">
          <div className="bg-red-500 rounded-full w-1 h-1"></div>
          <div className="bg-orange-500 rounded-full w-1 h-1"></div>
          <div className="bg-yellow-500 rounded-full w-1 h-1"></div>
          <div className="bg-green-500 rounded-full w-1 h-1"></div>
          <div className="bg-blue-500 rounded-full w-1 h-1"></div>
          <div className="bg-indigo-500 rounded-full w-1 h-1"></div>
          <div className="bg-purple-500 rounded-full w-1 h-1"></div>
          <div className="bg-pink-500 rounded-full w-1 h-1"></div>
          <div className="bg-cyan-500 rounded-full w-1 h-1"></div>
        </div>
      </div>
    </aside>
  );
}
