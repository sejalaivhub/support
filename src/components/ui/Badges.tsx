import type { ReactNode } from 'react';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants';
import type { TicketPriority, TicketStatus } from '@/types';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';

export function PriorityBadge({ priority, label }: { priority: TicketPriority; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${PRIORITY_COLORS[priority]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${priority === 'P1' ? 'bg-red-500' : priority === 'P2' ? 'bg-orange-500' : priority === 'P3' ? 'bg-blue-500' : 'bg-gray-400'}`} />
      {label ? `${label}: ${priority}` : `${priority} - ${PRIORITY_LABELS[priority]}`}
    </span>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colors[color] ?? colors.gray}`}>
      {children}
    </span>
  );
}

export function Avatar({ firstName, lastName, size = 'md' }: { firstName: string; lastName: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };
  const hash = (firstName + lastName).charCodeAt(0) + (firstName + lastName).charCodeAt(1) || 0;
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500',
    'bg-teal-500', 'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500',
  ];
  const color = colors[hash % colors.length];
  return (
    <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}
