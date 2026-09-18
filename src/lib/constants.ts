import type { TicketPriority, TicketStatus } from '@/types';

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  P1: 'Critical',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  P1: 'bg-red-100 text-red-700 border-red-200',
  P2: 'bg-orange-100 text-orange-700 border-orange-200',
  P3: 'bg-blue-100 text-blue-700 border-blue-200',
  P4: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const PRIORITY_DOT: Record<TicketPriority, string> = {
  P1: 'bg-red-500',
  P2: 'bg-orange-500',
  P3: 'bg-blue-500',
  P4: 'bg-gray-400',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'New',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_FOR_CUSTOMER: 'Waiting for Customer',
  WAITING_FOR_INTERNAL_TEAM: 'Waiting for Internal Team',
  WAITING_FOR_VENDOR: 'Waiting for Vendor',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  NEW: 'bg-purple-100 text-purple-700 border-purple-200',
  OPEN: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  WAITING_FOR_CUSTOMER: 'bg-amber-100 text-amber-700 border-amber-200',
  WAITING_FOR_INTERNAL_TEAM: 'bg-amber-100 text-amber-700 border-amber-200',
  WAITING_FOR_VENDOR: 'bg-amber-100 text-amber-700 border-amber-200',
  RESOLVED: 'bg-green-100 text-green-700 border-green-200',
  CLOSED: 'bg-gray-100 text-gray-600 border-gray-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
};

export const IMPACT_LABELS: Record<string, string> = {
  entire_organisation: 'Entire Organisation',
  multiple_users: 'Multiple Users',
  single_user: 'Single User',
  minor: 'Minor',
};

export const URGENCY_LABELS: Record<string, string> = {
  business_stopped: 'Business Stopped',
  major_disruption: 'Major Disruption',
  workaround_available: 'Workaround Available',
  minor: 'Minor',
};

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const hrs = hours % 24;
  return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
}

export function getSlaStatus(
  dueAt: string | null,
  breached: boolean
): { label: string; color: string } {
  if (breached) return { label: 'Breached', color: 'text-red-600' };
  if (!dueAt) return { label: '—', color: 'text-gray-400' };
  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  if (diffMs < 0) return { label: 'Breached', color: 'text-red-600' };
  const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay > 1) return { label: `${diffDay}d left`, color: 'text-green-600' };
  if (diffHr > 0) return { label: `${diffHr}h left`, color: 'text-amber-600' };
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin > 0) return { label: `${diffMin}m left`, color: 'text-red-600' };
  return { label: 'Overdue', color: 'text-red-600' };
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}
