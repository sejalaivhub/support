/*
# Seed Data: Reference Tables and Demo Content

## Overview
Populates reference tables with default configuration and creates demo data for testing.

## Data Created
1. **App Settings**: acknowledgement_delay_minutes=30, reopen_window_days=3, max_file_size_mb=25,
   allowed_file_types, session_timeout_minutes=30, max_reopen_count=3.
2. **Business Calendar**: "Standard Business Hours" (Mon-Fri 8:00-18:00 UTC, weekends closed).
3. **Support Plans**: STANDARD, PREMIUM, ENTERPRISE with channel configs.
4. **SLA Policies**: Per plan x priority (P1-P4) with response/resolution targets.
5. **Support Teams**: Tier 1 Support, Tier 2 Engineering, Account Management.
6. **Ticket Types**: Incident, Service Request, Change Request, Problem, Question.
7. **Ticket Categories**: Software, Hardware, Network, Access, Billing, Other.
8. **Email Templates**: ticket_created, ticket_updated, ticket_resolved, ticket_closed, etc.
9. **Demo Accounts**: Acme Corp (PREMIUM), Globex Inc (STANDARD), Initech (ENTERPRISE).
10. **Demo Users**: Internal staff (admin, manager, agents) + customer users per account.
11. **Demo Tickets**: Several tickets across accounts with messages and SLA snapshots.

## Notes
1. All demo users have status='pending' - they activate when someone signs up with that email.
2. Passwords are NOT set here - users must sign up via the auth flow.
3. SLA targets follow industry-standard tiers.
4. The admin user has full access; demo customer users are scoped to their accounts.
*/

-- ============================================================
-- APP SETTINGS
-- ============================================================

INSERT INTO public.app_settings (key, value, description) VALUES
  ('acknowledgement_delay_minutes', '30', 'Grace period before an unacknowledged ticket triggers escalation'),
  ('reopen_window_days', '3', 'Number of days after resolution within which a customer can reopen a ticket'),
  ('max_file_size_mb', '25', 'Maximum file size for attachments in megabytes'),
  ('allowed_file_types', 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,zip,log,json,xml', 'Comma-separated list of allowed file extensions'),
  ('session_timeout_minutes', '30', 'Session inactivity timeout in minutes'),
  ('max_reopen_count', '3', 'Maximum number of times a ticket can be reopened'),
  ('default_support_plan', 'STANDARD', 'Default support plan code for new accounts'),
  ('portal_name', 'AIV Support Portal', 'Display name for the support portal'),
  ('company_name', 'AIV Solutions', 'Internal company name')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- BUSINESS CALENDAR: Standard Business Hours
-- ============================================================

INSERT INTO public.business_calendars (id, name, timezone, description, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Standard Business Hours',
  'UTC',
  'Monday-Friday 08:00-18:00 UTC, weekends closed',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.business_calendar_hours (calendar_id, day_of_week, open_time, close_time, is_closed) VALUES
  ('00000000-0000-0000-0000-000000000001', 0, NULL, NULL, true),
  ('00000000-0000-0000-0000-000000000001', 1, '08:00', '18:00', false),
  ('00000000-0000-0000-0000-000000000001', 2, '08:00', '18:00', false),
  ('00000000-0000-0000-0000-000000000001', 3, '08:00', '18:00', false),
  ('00000000-0000-0000-0000-000000000001', 4, '08:00', '18:00', false),
  ('00000000-0000-0000-0000-000000000001', 5, '08:00', '18:00', false),
  ('00000000-0000-0000-0000-000000000001', 6, NULL, NULL, true)
ON CONFLICT (calendar_id, day_of_week) DO NOTHING;

-- ============================================================
-- SUPPORT PLANS
-- ============================================================

INSERT INTO public.support_plans (id, code, name, active, support_channels, business_calendar_id, allow_24x7_p1, max_customer_users, description, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000010', 'STANDARD', 'Standard Support', true,
   ARRAY['portal', 'email'], '00000000-0000-0000-0000-000000000001', false, 10,
   'Business hours support with standard response times', 1),
  ('00000000-0000-0000-0000-000000000020', 'PREMIUM', 'Premium Support', true,
   ARRAY['portal', 'email', 'phone'], '00000000-0000-0000-0000-000000000001', true, 25,
   'Extended support with faster response times and phone access', 2),
  ('00000000-0000-0000-0000-000000000030', 'ENTERPRISE', 'Enterprise Support', true,
   ARRAY['portal', 'email', 'phone', 'chat'], '00000000-0000-0000-0000-000000000001', true, 100,
   '24x7 P1 support with dedicated account manager', 3)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SLA POLICIES
-- ============================================================

INSERT INTO public.sla_policies (support_plan_id, priority, first_response_target_minutes, resolution_target_minutes, clock_type, business_calendar_id, pause_on_customer_wait, warning_75, warning_90, is_active) VALUES
  ('00000000-0000-0000-0000-000000000010', 'P1', 240, 1440, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000010', 'P2', 480, 2880, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000010', 'P3', 720, 5760, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000010', 'P4', 1440, 11520, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000020', 'P1', 60, 480, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000020', 'P2', 180, 1440, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000020', 'P3', 360, 2880, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000020', 'P4', 720, 5760, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000030', 'P1', 15, 240, 'calendar', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000030', 'P2', 60, 480, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000030', 'P3', 120, 1440, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true),
  ('00000000-0000-0000-0000-000000000030', 'P4', 480, 2880, 'business', '00000000-0000-0000-0000-000000000001', true, true, true, true)
ON CONFLICT (support_plan_id, priority) DO NOTHING;

-- ============================================================
-- SUPPORT TEAMS
-- ============================================================

INSERT INTO public.support_teams (id, name, description, is_active) VALUES
  ('00000000-0000-0000-0000-000000000100', 'Tier 1 Support', 'First-line support team handling initial triage and common issues', true),
  ('00000000-0000-0000-0000-000000000200', 'Tier 2 Engineering', 'Second-line engineering team for complex technical issues', true),
  ('00000000-0000-0000-0000-000000000300', 'Account Management', 'Account managers handling customer relationships and escalations', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TICKET TYPES
-- ============================================================

INSERT INTO public.ticket_types (id, name, is_active, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000501', 'Incident', true, 1),
  ('00000000-0000-0000-0000-000000000502', 'Service Request', true, 2),
  ('00000000-0000-0000-0000-000000000503', 'Change Request', true, 3),
  ('00000000-0000-0000-0000-000000000504', 'Problem', true, 4),
  ('00000000-0000-0000-0000-000000000505', 'Question', true, 5)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TICKET CATEGORIES
-- ============================================================

INSERT INTO public.ticket_categories (id, name, is_active, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000601', 'Software', true, 1),
  ('00000000-0000-0000-0000-000000000602', 'Hardware', true, 2),
  ('00000000-0000-0000-0000-000000000603', 'Network', true, 3),
  ('00000000-0000-0000-0000-000000000604', 'Access', true, 4),
  ('00000000-0000-0000-0000-000000000605', 'Billing', true, 5),
  ('00000000-0000-0000-0000-000000000606', 'Other', true, 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================

INSERT INTO public.email_templates (template_key, name, subject, body, is_active) VALUES
  ('ticket_created', 'Ticket Created', 'Your ticket {{ticket_number}} has been created',
   'Hi {{customer_name}},\n\nYour support ticket has been created.\n\nTicket: {{ticket_number}}\nSubject: {{subject}}\nPriority: {{priority}}\n\nWe will respond shortly.\n\nAIV Support Team', true),
  ('ticket_updated', 'Ticket Updated', 'Update on ticket {{ticket_number}}',
   'Hi {{customer_name}},\n\nYour ticket {{ticket_number}} has been updated.\n\n{{message}}\n\nView the ticket in the support portal.\n\nAIV Support Team', true),
  ('ticket_resolved', 'Ticket Resolved', 'Ticket {{ticket_number}} has been resolved',
   'Hi {{customer_name}},\n\nYour ticket {{ticket_number}} has been marked as resolved.\n\nResolution: {{resolution_summary}}\n\nIf you are not satisfied, you can reopen the ticket within 3 days.\n\nAIV Support Team', true),
  ('ticket_closed', 'Ticket Closed', 'Ticket {{ticket_number}} has been closed',
   'Hi {{customer_name}},\n\nYour ticket {{ticket_number}} has been closed.\n\nAIV Support Team', true),
  ('ticket_assigned', 'Ticket Assigned', 'Ticket {{ticket_number}} assigned to you',
   'Hi {{agent_name}},\n\nTicket {{ticket_number}} has been assigned to you.\n\nSubject: {{subject}}\nPriority: {{priority}}\n\nPlease review and respond.\n\nAIV Support Portal', true),
  ('ticket_escalated', 'Ticket Escalated', 'Ticket {{ticket_number}} SLA escalation',
   'Ticket {{ticket_number}} has breached its SLA target.\n\nSubject: {{subject}}\nPriority: {{priority}}\n\nImmediate attention required.\n\nAIV Support System', true),
  ('user_invitation', 'User Invitation', 'You are invited to AIV Support Portal',
   'Hi {{name}},\n\nYou have been invited to the AIV Support Portal.\n\nPlease use this link to activate your account: {{activation_link}}\n\nAIV Support Team', true)
ON CONFLICT (template_key) DO NOTHING;

-- ============================================================
-- DEMO ACCOUNTS
-- ============================================================

INSERT INTO public.accounts (id, account_code, company_name, status, country, timezone, support_plan_id, entitlement_source, support_start_date, support_end_date, support_team_id, business_calendar_id, customer_ticket_visibility) VALUES
  ('00000000-0000-0000-0000-000000001001', 'ACME001', 'Acme Corporation', 'ACTIVE', 'United States', 'America/New_York',
   '00000000-0000-0000-0000-000000000020', 'MANUAL', '2025-01-01', '2026-12-31',
   '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', 'ACCOUNT_WIDE'),
  ('00000000-0000-0000-0000-000000002001', 'GLOB001', 'Globex Industries', 'ACTIVE', 'United Kingdom', 'Europe/London',
   '00000000-0000-0000-0000-000000000010', 'MANUAL', '2025-03-15', '2026-03-14',
   '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', 'OWN_ONLY'),
  ('00000000-0000-0000-0000-000000003001', 'INIT001', 'Initech LLC', 'ACTIVE', 'United States', 'America/Chicago',
   '00000000-0000-0000-0000-000000000030', 'MANUAL', '2024-06-01', '2026-05-31',
   '00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', 'ACCOUNT_WIDE')
ON CONFLICT (account_code) DO NOTHING;

-- ============================================================
-- DEMO USERS: Internal Staff
-- ============================================================

INSERT INTO public.profiles (id, email, first_name, last_name, user_type, status, job_title) VALUES
  ('00000000-0000-0000-0000-000000000a01', 'admin@aivsupport.com', 'System', 'Administrator', 'admin', 'active', 'System Administrator'),
  ('00000000-0000-0000-0000-000000000a02', 'manager@aivsupport.com', 'Sarah', 'Mitchell', 'manager', 'active', 'Support Manager'),
  ('00000000-0000-0000-0000-000000000a03', 'agent1@aivsupport.com', 'James', 'Park', 'agent', 'active', 'Support Agent'),
  ('00000000-0000-0000-0000-000000000a04', 'agent2@aivsupport.com', 'Emily', 'Chen', 'agent', 'active', 'Support Agent'),
  ('00000000-0000-0000-0000-000000000a05', 'agent3@aivsupport.com', 'Michael', 'OConnor', 'agent', 'active', 'Support Agent'),
  ('00000000-0000-0000-0000-000000000a06', 'am@aivsupport.com', 'David', 'Reynolds', 'account_manager', 'active', 'Account Manager')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- DEMO USERS: Customer Users
-- ============================================================

INSERT INTO public.profiles (id, email, first_name, last_name, user_type, account_id, status, job_title) VALUES
  ('00000000-0000-0000-0000-000000000c01', 'john.smith@acme.com', 'John', 'Smith', 'customer_admin', '00000000-0000-0000-0000-000000001001', 'pending', 'IT Director'),
  ('00000000-0000-0000-0000-000000000c02', 'jane.doe@acme.com', 'Jane', 'Doe', 'customer_user', '00000000-0000-0000-0000-000000001001', 'pending', 'IT Analyst'),
  ('00000000-0000-0000-0000-000000000c03', 'bob.wilson@acme.com', 'Bob', 'Wilson', 'customer_user', '00000000-0000-0000-0000-000000001001', 'pending', 'Operations Manager'),
  ('00000000-0000-0000-0000-000000000c04', 'alice@globex.com', 'Alice', 'Johnson', 'customer_admin', '00000000-0000-0000-0000-000000002001', 'pending', 'CTO'),
  ('00000000-0000-0000-0000-000000000c05', 'mark.taylor@globex.com', 'Mark', 'Taylor', 'customer_user', '00000000-0000-0000-0000-000000002001', 'pending', 'Developer'),
  ('00000000-0000-0000-0000-000000000c06', 'peter@initech.com', 'Peter', 'Gibbons', 'customer_admin', '00000000-0000-0000-0000-000000003001', 'pending', 'Software Engineer'),
  ('00000000-0000-0000-0000-000000000c07', 'michael@initech.com', 'Michael', 'Bolton', 'customer_user', '00000000-0000-0000-0000-000000003001', 'pending', 'QA Engineer')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- TEAM MEMBERS
-- ============================================================

INSERT INTO public.support_team_members (team_id, user_id, agent_status, is_lead) VALUES
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000a03', 'AVAILABLE', false),
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000a04', 'AVAILABLE', false),
  ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000a05', 'AVAILABLE', false),
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000a02', 'AVAILABLE', true),
  ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000a06', 'AVAILABLE', true)
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Update account manager references
UPDATE public.accounts SET
  account_manager_id = '00000000-0000-0000-0000-000000000a06',
  support_manager_id = '00000000-0000-0000-0000-000000000a02'
WHERE account_code IN ('ACME001', 'GLOB001', 'INIT001');

-- ============================================================
-- DEMO TICKETS (using valid hex UUIDs)
-- ============================================================

INSERT INTO public.tickets (id, ticket_number, account_id, created_by_user_id, ticket_type_id, category_id, subject, description, priority, impact, urgency, status, environment, aiv_version, assigned_team_id, assigned_agent_id, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'AIV-000001',
   '00000000-0000-0000-0000-000000001001',
   '00000000-0000-0000-0000-000000000c01',
   '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000601',
   'Application crashes when importing large CSV files',
   'When attempting to import CSV files larger than 50MB, the application crashes with an out of memory error. This happens consistently on our production environment. We have 200+ users affected and need an urgent fix.',
   'P2', 'multiple_users', 'workaround_available', 'IN_PROGRESS', 'Production', 'v4.2.1',
   '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000a03',
   now() - interval '2 days', now() - interval '1 hour'),

  ('00000000-0000-0000-0000-000000000002', 'AIV-000002',
   '00000000-0000-0000-0000-000000001001',
   '00000000-0000-0000-0000-000000000c02',
   '00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000604',
   'Request: Additional user accounts for new team members',
   'We have 5 new team members starting next week and need user accounts provisioned for them. Please provide instructions or create the accounts.',
   'P3', 'single_user', 'minor', 'OPEN', 'Production', 'v4.2.1',
   '00000000-0000-0000-0000-000000000100', NULL,
   now() - interval '1 day', now() - interval '1 day'),

  ('00000000-0000-0000-0000-000000000003', 'AIV-000003',
   '00000000-0000-0000-0000-000000002001',
   '00000000-0000-0000-0000-000000000c04',
   '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000603',
   'PRODUCTION DOWN - Complete system outage',
   'Our entire production system is down. All users are unable to access the application. This is a critical business impact as we cannot process any orders. Please respond immediately.',
   'P1', 'entire_organisation', 'business_stopped', 'IN_PROGRESS', 'Production', 'v4.1.0',
   '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000a04',
   now() - interval '3 hours', now() - interval '30 minutes'),

  ('00000000-0000-0000-0000-000000000004', 'AIV-000004',
   '00000000-0000-0000-0000-000000003001',
   '00000000-0000-0000-0000-000000000c06',
   '00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-000000000601',
   'How to configure SSO with Azure AD?',
   'We want to set up single sign-on with Azure AD for our team. Can you provide documentation or guidance on the configuration steps?',
   'P4', 'minor', 'minor', 'RESOLVED', 'Production', 'v4.2.1',
   '00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000a05',
   now() - interval '5 days', now() - interval '2 days'),

  ('00000000-0000-0000-0000-000000000005', 'AIV-000005',
   '00000000-0000-0000-0000-000000001001',
   '00000000-0000-0000-0000-000000000c03',
   '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000602',
   'Printer not connecting to network',
   'One of our office printers is not connecting to the network. We have tried restarting it multiple times but it still shows offline.',
   'P3', 'single_user', 'workaround_available', 'CLOSED', 'Production', 'v4.2.1',
   '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000a03',
   now() - interval '10 days', now() - interval '7 days'),

  ('00000000-0000-0000-0000-000000000006', 'AIV-000006',
   '00000000-0000-0000-0000-000000002001',
   '00000000-0000-0000-0000-000000000c05',
   '00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000605',
   'Request: Invoice copy for March 2025',
   'Could you please provide a copy of our March 2025 invoice? We need it for our accounting records.',
   'P3', 'single_user', 'minor', 'WAITING_FOR_CUSTOMER', 'Production', 'v4.1.0',
   '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000a04',
   now() - interval '4 days', now() - interval '12 hours')
ON CONFLICT (ticket_number) DO NOTHING;

-- Update resolved/closed timestamps
UPDATE public.tickets SET resolved_at = now() - interval '2 days', resolution_summary = 'Provided SSO configuration documentation and guided through setup process.', resolution_notes = 'Customer confirmed SSO is working. Issue resolved.', resolution_category = 'Configuration' WHERE ticket_number = 'AIV-000004';
UPDATE public.tickets SET closed_at = now() - interval '7 days', resolved_at = now() - interval '8 days', resolution_summary = 'Printer was configured with incorrect IP address. Reconfigured with correct network settings.', resolution_notes = 'Updated printer IP configuration and verified connectivity.', resolution_category = 'Configuration' WHERE ticket_number = 'AIV-000005';
UPDATE public.tickets SET first_human_response_at = now() - interval '1 day 23 hours' WHERE ticket_number = 'AIV-000001';
UPDATE public.tickets SET first_human_response_at = now() - interval '2 hours' WHERE ticket_number = 'AIV-000003';
UPDATE public.tickets SET first_human_response_at = now() - interval '4 days' WHERE ticket_number = 'AIV-000004';
UPDATE public.tickets SET first_human_response_at = now() - interval '9 days' WHERE ticket_number = 'AIV-000005';
UPDATE public.tickets SET first_human_response_at = now() - interval '3 days' WHERE ticket_number = 'AIV-000006';

-- ============================================================
-- DEMO MESSAGES
-- ============================================================

INSERT INTO public.ticket_messages (ticket_id, author_user_id, message_type, body, is_internal, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000c01', 'customer_message',
   'When attempting to import CSV files larger than 50MB, the application crashes with an out of memory error. This happens consistently on our production environment. We have 200+ users affected and need an urgent fix.', false, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000a03', 'public_reply',
   'Hi John, thank you for reporting this. I have reproduced the issue in our test environment and can confirm the crash. We are investigating the root cause and will provide an update shortly.', false, now() - interval '1 day 23 hours'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000a03', 'internal_note',
   'Initial investigation shows memory leak in CSV parser module. Escalating to Tier 2 for code review. May need a patch release.', true, now() - interval '1 day 22 hours'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000a03', 'public_reply',
   'We have identified the issue as a memory leak in the CSV parsing module. Our engineering team is working on a patch. In the meantime, as a workaround, you can split large files into smaller chunks under 50MB. We expect to have a fix ready within 48 hours.', false, now() - interval '1 day'),

  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000c02', 'customer_message',
   'We have 5 new team members starting next week and need user accounts provisioned for them. Please provide instructions or create the accounts.', false, now() - interval '1 day'),

  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000c04', 'customer_message',
   'Our entire production system is down. All users are unable to access the application. This is a critical business impact as we cannot process any orders. Please respond immediately.', false, now() - interval '3 hours'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000a04', 'public_reply',
   'Hi Alice, we have received your critical report and are investigating immediately. Our engineering team has been mobilized. We will provide updates every 30 minutes until the issue is resolved.', false, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000a04', 'internal_note',
   'Database connectivity issue confirmed. Primary database node appears to be down. Checking with infrastructure team. Escalating to Tier 2.', true, now() - interval '1 hour 45 minutes'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000a04', 'public_reply',
   'Update: We have identified the issue as a database connectivity problem. Our infrastructure team is working on restoring the database. Current ETA for restoration is 1-2 hours. We will keep you updated.', false, now() - interval '30 minutes'),

  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000c06', 'customer_message',
   'We want to set up single sign-on with Azure AD for our team. Can you provide documentation or guidance on the configuration steps?', false, now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000a05', 'public_reply',
   'Hi Peter, I would be happy to help you configure SSO with Azure AD. I have attached our SSO configuration guide to this ticket. The key steps are: 1) Register your application in Azure AD, 2) Configure the SAML endpoints, 3) Map user attributes. Let me know if you need any clarification.', false, now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000c06', 'customer_message',
   'Thank you for the documentation. We have followed the steps and SSO is now working perfectly. You can close this ticket.', false, now() - interval '2 days'),

  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000c03', 'customer_message',
   'One of our office printers is not connecting to the network. We have tried restarting it multiple times but it still shows offline.', false, now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000a03', 'public_reply',
   'Hi Bob, can you provide the printer model and IP address so I can check the network configuration?', false, now() - interval '9 days'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000c03', 'customer_message',
   'Its an HP LaserJet Pro M404n, IP was supposed to be 192.168.1.105 but I cannot ping it.', false, now() - interval '8 days'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000a03', 'public_reply',
   'I checked the DHCP logs and the printer was assigned a different IP (192.168.1.178). I have updated the printer configuration to use a static IP. Please try printing now.', false, now() - interval '8 days'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000c03', 'customer_message',
   'That worked! The printer is back online. Thank you for the quick resolution.', false, now() - interval '7 days'),

  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000c05', 'customer_message',
   'Could you please provide a copy of our March 2025 invoice? We need it for our accounting records.', false, now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000a04', 'public_reply',
   'Hi Mark, I can help with that. Can you confirm the billing contact email address so I can send the invoice copy to the right person?', false, now() - interval '3 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SLA SNAPSHOTS for demo tickets
-- ============================================================

INSERT INTO public.ticket_sla_snapshots (ticket_id, support_plan_code, sla_policy_id, priority, first_response_target_minutes, resolution_target_minutes, clock_type, business_calendar_id, pause_on_customer_wait, warning_75, warning_90, first_response_due_at, resolution_due_at, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'PREMIUM', NULL, 'P2', 180, 1440, 'business', '00000000-0000-0000-0000-000000000001', true, true, true,
   now() - interval '2 days' + interval '180 minutes', now() - interval '2 days' + interval '1440 minutes', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000002', 'PREMIUM', NULL, 'P3', 360, 2880, 'business', '00000000-0000-0000-0000-000000000001', true, true, true,
   now() - interval '1 day' + interval '360 minutes', now() - interval '1 day' + interval '2880 minutes', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000003', 'STANDARD', NULL, 'P1', 240, 1440, 'business', '00000000-0000-0000-0000-000000000001', true, true, true,
   now() - interval '3 hours' + interval '240 minutes', now() - interval '3 hours' + interval '1440 minutes', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-000000000004', 'ENTERPRISE', NULL, 'P4', 480, 2880, 'business', '00000000-0000-0000-0000-000000000001', true, true, true,
   now() - interval '5 days' + interval '480 minutes', now() - interval '5 days' + interval '2880 minutes', now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000005', 'PREMIUM', NULL, 'P3', 360, 2880, 'business', '00000000-0000-0000-0000-000000000001', true, true, true,
   now() - interval '10 days' + interval '360 minutes', now() - interval '10 days' + interval '2880 minutes', now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000006', 'STANDARD', NULL, 'P3', 720, 5760, 'business', '00000000-0000-0000-0000-000000000001', true, true, true,
   now() - interval '4 days' + interval '720 minutes', now() - interval '4 days' + interval '5760 minutes', now() - interval '4 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STATUS HISTORY for demo tickets
-- ============================================================

INSERT INTO public.ticket_status_history (ticket_id, from_status, to_status, changed_by_user_id, reason, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'NEW', '00000000-0000-0000-0000-000000000c01', 'Ticket created', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'NEW', 'OPEN', '00000000-0000-0000-0000-000000000a03', 'Ticket acknowledged', now() - interval '1 day 23 hours'),
  ('00000000-0000-0000-0000-000000000001', 'OPEN', 'IN_PROGRESS', '00000000-0000-0000-0000-000000000a03', 'Investigation started', now() - interval '1 day 22 hours'),
  ('00000000-0000-0000-0000-000000000003', NULL, 'NEW', '00000000-0000-0000-0000-000000000c04', 'Ticket created', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-000000000003', 'NEW', 'OPEN', '00000000-0000-0000-0000-000000000a04', 'Ticket acknowledged', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000003', 'OPEN', 'IN_PROGRESS', '00000000-0000-0000-0000-000000000a04', 'Investigation started', now() - interval '1 hour 45 minutes'),
  ('00000000-0000-0000-0000-000000000004', NULL, 'NEW', '00000000-0000-0000-0000-000000000c06', 'Ticket created', now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000004', 'NEW', 'OPEN', '00000000-0000-0000-0000-000000000a05', 'Ticket acknowledged', now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000004', 'OPEN', 'RESOLVED', '00000000-0000-0000-0000-000000000a05', 'SSO configured successfully', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000005', NULL, 'NEW', '00000000-0000-0000-0000-000000000c03', 'Ticket created', now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000005', 'NEW', 'OPEN', '00000000-0000-0000-0000-000000000a03', 'Ticket acknowledged', now() - interval '9 days'),
  ('00000000-0000-0000-0000-000000000005', 'OPEN', 'RESOLVED', '00000000-0000-0000-0000-000000000a03', 'Printer reconfigured', now() - interval '8 days'),
  ('00000000-0000-0000-0000-000000000005', 'RESOLVED', 'CLOSED', '00000000-0000-0000-0000-000000000a03', 'Auto-closed after resolution window', now() - interval '7 days'),
  ('00000000-0000-0000-0000-000000000006', NULL, 'NEW', '00000000-0000-0000-0000-000000000c05', 'Ticket created', now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000006', 'NEW', 'OPEN', '00000000-0000-0000-0000-000000000a04', 'Ticket acknowledged', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000006', 'OPEN', 'WAITING_FOR_CUSTOMER', '00000000-0000-0000-0000-000000000a04', 'Awaiting billing email confirmation', now() - interval '12 hours')
ON CONFLICT DO NOTHING;
