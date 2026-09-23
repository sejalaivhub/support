import { Navigate } from 'react-router-dom';

export function CustomerDashboard() {
  // As per requirements, customers only have the Tickets view
  return <Navigate to="/portal/tickets" replace />;
}
