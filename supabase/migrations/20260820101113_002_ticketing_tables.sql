/*
# Ticketing Tables for AIV Support Ticket System

## Overview
Creates all ticket-related tables: tickets, SLA snapshots, SLA events, messages,
attachments, relations, status history, assignment history, notifications, and audit logs.

## New Tables
1. **tickets** - Main ticket records with ticket_number (AIV-XXXXXX), priority, status, SLA fields.
2. **ticket_sla_snapshots** - Immutable SLA policy copy per ticket at creation time.
3. **ticket_sla_events** - SLA lifecycle events (START, PAUSE, RESUME, BREACH, etc.).
4. **ticket_messages** - Conversation timeline (customer messages, public replies, internal notes, system events).
5. **ticket_attachments** - File attachments with metadata.
6. **ticket_relations** - Related/duplicate ticket relationships.
7. **ticket_status_history** - Status transition audit trail.
8. **ticket_assignment_history** - Assignment change audit trail.
9. **notifications** - Notification delivery records with retry tracking.
10. **audit_logs** - Append-only security/compliance audit trail.
11. **integration_requests** - AIVHUB integration request log with idempotency.

## Security
- RLS enabled on all tables.
- Customer users can only access tickets/messages within their own account.
- Internal messages (is_internal=true) are never visible to customer users.
- Internal staff have broader access across all accounts.
- Audit logs and integration logs are staff-only.

## Notes
1. Ticket numbers use format AIV-000001 (zero-padded sequence).
2. SLA snapshots are immutable - plan changes don't affect existing tickets.
3. Internal notes have strict RLS isolation from customer queries.
4. Notifications track retry attempts and delivery status.
*/

-- ============================================================
-- TICKETS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  ticket_type_id uuid REFERENCES public.ticket_types(id),
  category_id uuid REFERENCES public.ticket_categories(id),
  subject text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'P3' CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  impact text CHECK (impact IN ('entire_organisation', 'multiple_users', 'single_user', 'minor')),
  urgency text CHECK (urgency IN ('business_stopped', 'major_disruption', 'workaround_available', 'minor')),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN (
    'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER',
    'WAITING_FOR_INTERNAL_TEAM', 'WAITING_FOR_VENDOR',
    'RESOLVED', 'CLOSED', 'CANCELLED'
  )),
  environment text CHECK (environment IN ('Production', 'UAT', 'Test', 'Development', 'Other')),
  aiv_version text,
  assigned_team_id uuid REFERENCES public.support_teams(id),
  assigned_agent_id uuid REFERENCES public.profiles(id),
  account_manager_id_snapshot uuid,
  tags text[] DEFAULT '{}',
  first_human_response_at timestamptz,
  first_response_breached boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_category text,
  root_cause text,
  resolution_summary text,
  resolution_notes text,
  sla_paused boolean NOT NULL DEFAULT false,
  sla_paused_reason text,
  sla_paused_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
CREATE POLICY "tickets_select"
ON public.tickets FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND account_id = public.current_account_id()
    AND (
      created_by_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = tickets.account_id
        AND accounts.customer_ticket_visibility = 'ACCOUNT_WIDE'
      )
    )
  )
);

DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
CREATE POLICY "tickets_insert"
ON public.tickets FOR INSERT
TO authenticated
WITH CHECK (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND account_id = public.current_account_id()
  )
);

DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
CREATE POLICY "tickets_update"
ON public.tickets FOR UPDATE
TO authenticated
USING (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND account_id = public.current_account_id()
    AND status IN ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED')
  )
)
WITH CHECK (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND account_id = public.current_account_id()
  )
);

-- ============================================================
-- TICKET SLA SNAPSHOTS (immutable at creation)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ticket_sla_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  support_plan_code text NOT NULL,
  sla_policy_id uuid REFERENCES public.sla_policies(id),
  priority text NOT NULL,
  first_response_target_minutes integer NOT NULL,
  resolution_target_minutes integer NOT NULL,
  clock_type text NOT NULL,
  business_calendar_id uuid,
  pause_on_customer_wait boolean NOT NULL DEFAULT true,
  pause_on_internal_wait boolean NOT NULL DEFAULT false,
  pause_on_vendor_wait boolean NOT NULL DEFAULT false,
  allow_24x7_override boolean NOT NULL DEFAULT false,
  warning_50 boolean NOT NULL DEFAULT false,
  warning_75 boolean NOT NULL DEFAULT true,
  warning_90 boolean NOT NULL DEFAULT true,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_sla_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_snapshots_select" ON public.ticket_sla_snapshots;
CREATE POLICY "sla_snapshots_select"
ON public.ticket_sla_snapshots FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_sla_snapshots.ticket_id
      AND tickets.account_id = public.current_account_id()
    )
  )
);

DROP POLICY IF EXISTS "sla_snapshots_insert" ON public.ticket_sla_snapshots;
CREATE POLICY "sla_snapshots_insert"
ON public.ticket_sla_snapshots FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================
-- TICKET SLA EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ticket_sla_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'START', 'PAUSE', 'RESUME', 'FIRST_HUMAN_RESPONSE',
    'WARNING_50', 'WARNING_75', 'WARNING_90',
    'FIRST_RESPONSE_BREACH', 'RESOLUTION_BREACH',
    'RESOLVED', 'REOPENED', 'OVERRIDE'
  )),
  reason text,
  actor_user_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_sla_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_events_select" ON public.ticket_sla_events;
CREATE POLICY "sla_events_select"
ON public.ticket_sla_events FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_sla_events.ticket_id
      AND tickets.account_id = public.current_account_id()
    )
  )
);

DROP POLICY IF EXISTS "sla_events_insert" ON public.ticket_sla_events;
CREATE POLICY "sla_events_insert"
ON public.ticket_sla_events FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================
-- TICKET MESSAGES (conversation timeline)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES public.profiles(id),
  message_type text NOT NULL CHECK (message_type IN (
    'customer_message', 'public_reply', 'internal_note',
    'system_acknowledgement', 'system_event'
  )),
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Customers can see non-internal messages on their account's tickets
DROP POLICY IF EXISTS "messages_select" ON public.ticket_messages;
CREATE POLICY "messages_select"
ON public.ticket_messages FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND NOT is_internal
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_messages.ticket_id
      AND tickets.account_id = public.current_account_id()
    )
  )
);

DROP POLICY IF EXISTS "messages_insert" ON public.ticket_messages;
CREATE POLICY "messages_insert"
ON public.ticket_messages FOR INSERT
TO authenticated
WITH CHECK (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND NOT is_internal
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_messages.ticket_id
      AND tickets.account_id = public.current_account_id()
    )
  )
);

-- ============================================================
-- TICKET ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.ticket_messages(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text,
  storage_path text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_select" ON public.ticket_attachments;
CREATE POLICY "attachments_select"
ON public.ticket_attachments FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND NOT is_internal
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_attachments.ticket_id
      AND tickets.account_id = public.current_account_id()
    )
  )
);

DROP POLICY IF EXISTS "attachments_insert" ON public.ticket_attachments;
CREATE POLICY "attachments_insert"
ON public.ticket_attachments FOR INSERT
TO authenticated
WITH CHECK (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND NOT is_internal
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_attachments.ticket_id
      AND tickets.account_id = public.current_account_id()
    )
  )
);

-- ============================================================
-- TICKET RELATIONS (related/duplicate)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ticket_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  related_ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('RELATED_TO', 'DUPLICATE_OF', 'PARENT_OF', 'CHILD_OF')),
  created_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, related_ticket_id, relation_type)
);

ALTER TABLE public.ticket_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "relations_select" ON public.ticket_relations;
CREATE POLICY "relations_select"
ON public.ticket_relations FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND EXISTS (
      SELECT 1 FROM public.tickets t1
      WHERE t1.id = ticket_relations.ticket_id
      AND t1.account_id = public.current_account_id()
    )
  )
);

DROP POLICY IF EXISTS "relations_insert" ON public.ticket_relations;
CREATE POLICY "relations_insert"
ON public.ticket_relations FOR INSERT
TO authenticated
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- TICKET STATUS HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ticket_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_history_select" ON public.ticket_status_history;
CREATE POLICY "status_history_select"
ON public.ticket_status_history FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR (
    public.is_customer()
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_status_history.ticket_id
      AND tickets.account_id = public.current_account_id()
    )
  )
);

DROP POLICY IF EXISTS "status_history_insert" ON public.ticket_status_history;
CREATE POLICY "status_history_insert"
ON public.ticket_status_history FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================
-- TICKET ASSIGNMENT HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ticket_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_agent_id uuid,
  to_agent_id uuid,
  from_team_id uuid,
  to_team_id uuid,
  changed_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignment_history_select" ON public.ticket_assignment_history;
CREATE POLICY "assignment_history_select"
ON public.ticket_assignment_history FOR SELECT
TO authenticated
USING (public.is_internal_staff());

DROP POLICY IF EXISTS "assignment_history_insert" ON public.ticket_assignment_history;
CREATE POLICY "assignment_history_insert"
ON public.ticket_assignment_history FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================
-- NOTIFICATIONS (delivery records)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  recipient_user_id uuid REFERENCES public.profiles(id),
  recipient_email text,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'in_app')),
  template_key text,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  related_ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  related_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select"
ON public.notifications FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR recipient_user_id = auth.uid()
);

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update"
ON public.notifications FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- AUDIT LOGS (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'integration')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.is_internal_staff());

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================
-- INTEGRATION REQUESTS (AIVHUB provisioning log)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.integration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE,
  source_system text NOT NULL DEFAULT 'AIVHUB',
  request_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status text,
  response_body jsonb,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed', 'duplicate')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_requests_select" ON public.integration_requests;
CREATE POLICY "integration_requests_select"
ON public.integration_requests FOR SELECT
TO authenticated
USING (public.is_internal_staff());

DROP POLICY IF EXISTS "integration_requests_insert" ON public.integration_requests;
CREATE POLICY "integration_requests_insert"
ON public.integration_requests FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "integration_requests_update" ON public.integration_requests;
CREATE POLICY "integration_requests_update"
ON public.integration_requests FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tickets_account ON public.tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_agent ON public.tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_team ON public.tickets(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON public.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_events_ticket ON public.ticket_sla_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_integration_idempotency ON public.integration_requests(idempotency_key);
