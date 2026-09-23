import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { CustomerPortalLayout } from '@/components/layout/CustomerPortalLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ActivateAccountPage } from '@/pages/auth/ActivateAccountPage';
import { CustomerDashboard } from '@/pages/portal/CustomerDashboard';
import { TicketList } from '@/pages/portal/TicketList';
import { CreateTicket } from '@/pages/portal/CreateTicket';
import { TicketDetail } from '@/pages/shared/TicketDetail';
import { AgentDashboard } from '@/pages/agent/AgentDashboard';
import { AgentQueue } from '@/pages/agent/AgentQueue';
import { AgentCreateTicket } from '@/pages/agent/AgentCreateTicket';
import { FreshdeskTicketInbox } from '@/pages/agent/FreshdeskTicketInbox';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';

import { AccountsPage } from '@/pages/admin/AccountsPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { ContactDetailPage } from '@/pages/admin/ContactDetailPage';
import { PlansPage } from '@/pages/admin/PlansPage';
import { SlaPage } from '@/pages/admin/SlaPage';
import { TeamsPage } from '@/pages/admin/TeamsPage';
import { CategoriesPage } from '@/pages/admin/CategoriesPage';
import { CalendarsPage } from '@/pages/admin/CalendarsPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { AgentsPage } from '@/pages/admin/AgentsPage';
import { NewAgentPage } from '@/pages/admin/NewAgentPage';
import { RolesPage } from '@/pages/admin/RolesPage';
import { ReportsPage } from '@/pages/manager/ReportsPage';
import { Spinner } from '@/components/ui';
import type { UserType } from '@/types';

function ProtectedRoute({ children, allowedTypes }: { children: React.ReactNode; allowedTypes?: UserType[] }) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner label="Loading..." /></div>;
  if (!profile) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowedTypes && !allowedTypes.includes(profile.user_type)) return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function CustomerProtectedRoute({ children, allowedTypes }: { children: React.ReactNode; allowedTypes?: UserType[] }) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner label="Loading..." /></div>;
  if (!profile) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowedTypes && !allowedTypes.includes(profile.user_type)) return <Navigate to="/" replace />;
  return <CustomerPortalLayout>{children}</CustomerPortalLayout>;
}

function RootRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner label="Loading..." /></div>;
  if (!profile) return <Navigate to="/login" replace />;

  switch (profile.user_type) {
    case 'customer_user':
    case 'customer_admin':
      return <Navigate to="/portal" replace />;
    case 'agent':
      return <Navigate to="/agent" replace />;
    case 'manager':
      return <Navigate to="/agent" replace />;
    case 'account_manager':
      return <Navigate to="/agent" replace />;
    case 'admin':
      return <Navigate to="/admin" replace />;
    default:
      return <Navigate to="/portal" replace />;
  }
}


function AppRoutes() {
  const { session } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/activate" element={<ActivateAccountPage />} />

      {/* Customer portal */}
      <Route path="/portal" element={<CustomerProtectedRoute allowedTypes={['customer_user', 'customer_admin']}><CustomerDashboard /></CustomerProtectedRoute>} />
      <Route path="/portal/tickets" element={<CustomerProtectedRoute allowedTypes={['customer_user', 'customer_admin']}><TicketList /></CustomerProtectedRoute>} />
      <Route path="/portal/tickets/new" element={<CustomerProtectedRoute allowedTypes={['customer_user', 'customer_admin']}><CreateTicket /></CustomerProtectedRoute>} />
      <Route path="/portal/tickets/:ticketId" element={<CustomerProtectedRoute allowedTypes={['customer_user', 'customer_admin']}><TicketDetail /></CustomerProtectedRoute>} />

      {/* Agent portal */}
      <Route path="/tickets" element={<ProtectedRoute allowedTypes={['agent', 'manager', 'account_manager', 'admin']}><FreshdeskTicketInbox /></ProtectedRoute>} />
      <Route path="/agent/inbox" element={<ProtectedRoute allowedTypes={['agent', 'manager', 'account_manager', 'admin']}><FreshdeskTicketInbox /></ProtectedRoute>} />
      <Route path="/agent" element={<ProtectedRoute allowedTypes={['agent', 'manager', 'account_manager', 'admin']}><AgentDashboard /></ProtectedRoute>} />

      <Route path="/agent/queue" element={<ProtectedRoute allowedTypes={['agent', 'manager', 'account_manager', 'admin']}><AgentQueue /></ProtectedRoute>} />
      <Route path="/agent/tickets/new" element={<ProtectedRoute allowedTypes={['agent', 'manager', 'account_manager', 'admin']}><AgentCreateTicket /></ProtectedRoute>} />
      <Route path="/agent/tickets/:ticketId" element={<ProtectedRoute allowedTypes={['agent', 'manager', 'account_manager', 'admin']}><TicketDetail /></ProtectedRoute>} />

      {/* Manager */}
      <Route path="/manager/reports" element={<ProtectedRoute allowedTypes={['manager', 'admin']}><ReportsPage /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute allowedTypes={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/accounts" element={<ProtectedRoute allowedTypes={['admin']}><AccountsPage /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute allowedTypes={['admin']}><UsersPage /></ProtectedRoute>} />
      <Route path="/admin/contacts/:id" element={<ProtectedRoute allowedTypes={['admin', 'agent', 'manager']}><ContactDetailPage /></ProtectedRoute>} />
      <Route path="/admin/plans" element={<ProtectedRoute allowedTypes={['admin']}><PlansPage /></ProtectedRoute>} />
      <Route path="/admin/sla" element={<ProtectedRoute allowedTypes={['admin']}><SlaPage /></ProtectedRoute>} />
      <Route path="/admin/teams" element={<ProtectedRoute allowedTypes={['admin']}><TeamsPage /></ProtectedRoute>} />
      <Route path="/admin/categories" element={<ProtectedRoute allowedTypes={['admin']}><CategoriesPage /></ProtectedRoute>} />
      <Route path="/admin/calendars" element={<ProtectedRoute allowedTypes={['admin']}><CalendarsPage /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute allowedTypes={['admin']}><SettingsPage /></ProtectedRoute>} />
      <Route path="/admin/agents" element={<ProtectedRoute allowedTypes={['admin']}><AgentsPage /></ProtectedRoute>} />
      <Route path="/admin/agents/new" element={<ProtectedRoute allowedTypes={['admin']}><NewAgentPage /></ProtectedRoute>} />
      <Route path="/admin/roles" element={<ProtectedRoute allowedTypes={['admin']}><RolesPage /></ProtectedRoute>} />

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
