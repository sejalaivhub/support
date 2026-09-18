/*
# Foundation Tables for AIV Support Ticket System

## Overview
Creates the core foundation tables for a multi-tenant customer support ticketing system.
This migration establishes the data model for customer accounts, support users, support plans,
SLA policies, business calendars, support teams, ticket types/categories, and system settings.

## New Tables
1. **profiles** - Application users (customers + internal staff), linked to auth.users via auth_uid.
2. **accounts** - Customer companies (tenants).
3. **support_plans** - Configurable support plan definitions.
4. **support_entitlements** - Records of support access per account.
5. **support_teams** - Internal support teams.
6. **support_team_members** - Membership linking users to teams.
7. **business_calendars** - Business hours calendars for SLA calculations.
8. **business_calendar_hours** - Per-weekday opening/closing times.
9. **holiday_dates** - Holiday dates per calendar.
10. **ticket_types** - Configurable ticket types.
11. **ticket_categories** - Configurable ticket categories.
12. **sla_policies** - SLA rules by support plan + priority.
13. **app_settings** - Configurable system settings.
14. **email_templates** - Template-driven email notifications.

## Security
- RLS enabled on all tables.
- Helper functions: is_internal_staff(), is_customer(), current_account_id(), current_user_type().
- Customer users can only access data within their own account.
- Internal staff have broader access.
- A trigger on auth.users activates pending profiles when a user signs up.

## Notes
1. All timestamps stored in UTC (timestamptz).
2. Support plans and SLA durations are configurable, never hard-coded in app logic.
3. Account status controls login/ticket creation behavior.
*/

-- ============================================================
-- AUTH SCHEMA & STUB (Required for plain PostgreSQL)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.current_user_id', true)::uuid;
$$;

-- ============================================================
-- PROFILES TABLE (must exist before helper functions)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  auth_uid uuid UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  user_type text NOT NULL DEFAULT 'customer_user'
    CHECK (user_type IN ('customer_user', 'customer_admin', 'agent', 'manager', 'account_manager', 'admin')),
  account_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'disabled', 'invited')),
  activation_token text,
  activation_expires_at timestamptz,
  activated_at timestamptz,
  phone text,
  mobile text,
  job_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS (Security Definer for cross-table checks)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND user_type IN ('agent', 'manager', 'account_manager', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_customer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND user_type IN ('customer_user', 'customer_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT account_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_type()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT user_type FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- PROFILE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON public.profiles;
CREATE POLICY "profiles_select_own_or_staff"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_internal_staff()
  OR (public.is_customer() AND account_id = public.current_account_id())
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_staff" ON public.profiles;
CREATE POLICY "profiles_insert_staff"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "profiles_update_staff" ON public.profiles;
CREATE POLICY "profiles_update_staff"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- Trigger to activate pending profiles when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET auth_uid = NEW.id,
      status = 'active',
      activated_at = now(),
      updated_at = now()
  WHERE email = NEW.email AND status IN ('pending', 'invited');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- ACCOUNTS TABLE (Customer companies / tenants)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code text UNIQUE NOT NULL,
  company_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'DISABLED')),
  country text,
  timezone text NOT NULL DEFAULT 'UTC',
  support_plan_id uuid,
  entitlement_source text NOT NULL DEFAULT 'MANUAL'
    CHECK (entitlement_source IN ('AIVHUB', 'MANUAL')),
  external_account_id text,
  support_start_date date,
  support_end_date date,
  support_team_id uuid,
  account_manager_id uuid,
  support_manager_id uuid,
  business_calendar_id uuid,
  customer_ticket_visibility text NOT NULL DEFAULT 'OWN_ONLY'
    CHECK (customer_ticket_visibility IN ('OWN_ONLY', 'ACCOUNT_WIDE')),
  notes_internal text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounts_select" ON public.accounts;
CREATE POLICY "accounts_select"
ON public.accounts FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR (public.is_customer() AND id = public.current_account_id())
);

DROP POLICY IF EXISTS "accounts_insert_staff" ON public.accounts;
CREATE POLICY "accounts_insert_staff"
ON public.accounts FOR INSERT
TO authenticated
WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "accounts_update_staff" ON public.accounts;
CREATE POLICY "accounts_update_staff"
ON public.accounts FOR UPDATE
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- SUPPORT PLANS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  support_channels text[] DEFAULT ARRAY['portal'],
  business_calendar_id uuid,
  allow_24x7_p1 boolean NOT NULL DEFAULT false,
  max_customer_users integer,
  description text,
  internal_notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_plans_select" ON public.support_plans;
CREATE POLICY "support_plans_select"
ON public.support_plans FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "support_plans_modify_staff" ON public.support_plans;
CREATE POLICY "support_plans_modify_staff"
ON public.support_plans FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- SUPPORT ENTITLEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  support_plan_id uuid NOT NULL REFERENCES public.support_plans(id),
  source text NOT NULL DEFAULT 'MANUAL'
    CHECK (source IN ('AIVHUB', 'MANUAL')),
  external_reference text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'DISABLED')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entitlements_select" ON public.support_entitlements;
CREATE POLICY "entitlements_select"
ON public.support_entitlements FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR (public.is_customer() AND account_id = public.current_account_id())
);

DROP POLICY IF EXISTS "entitlements_modify_staff" ON public.support_entitlements;
CREATE POLICY "entitlements_modify_staff"
ON public.support_entitlements FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- SUPPORT TEAMS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select" ON public.support_teams;
CREATE POLICY "teams_select"
ON public.support_teams FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "teams_modify_staff" ON public.support_teams;
CREATE POLICY "teams_modify_staff"
ON public.support_teams FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- SUPPORT TEAM MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.support_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_status text NOT NULL DEFAULT 'AVAILABLE'
    CHECK (agent_status IN ('AVAILABLE', 'BUSY', 'AWAY', 'ON_LEAVE', 'INACTIVE')),
  is_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

ALTER TABLE public.support_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_select" ON public.support_team_members;
CREATE POLICY "team_members_select"
ON public.support_team_members FOR SELECT
TO authenticated
USING (
  public.is_internal_staff()
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "team_members_modify_staff" ON public.support_team_members;
CREATE POLICY "team_members_modify_staff"
ON public.support_team_members FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- BUSINESS CALENDARS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.business_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendars_select" ON public.business_calendars;
CREATE POLICY "calendars_select"
ON public.business_calendars FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "calendars_modify_staff" ON public.business_calendars;
CREATE POLICY "calendars_modify_staff"
ON public.business_calendars FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- BUSINESS CALENDAR HOURS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.business_calendar_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES public.business_calendars(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time time,
  close_time time,
  is_closed boolean NOT NULL DEFAULT false,
  UNIQUE (calendar_id, day_of_week)
);

ALTER TABLE public.business_calendar_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_hours_select" ON public.business_calendar_hours;
CREATE POLICY "calendar_hours_select"
ON public.business_calendar_hours FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "calendar_hours_modify_staff" ON public.business_calendar_hours;
CREATE POLICY "calendar_hours_modify_staff"
ON public.business_calendar_hours FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- HOLIDAY DATES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.holiday_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES public.business_calendars(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  name text NOT NULL,
  UNIQUE (calendar_id, holiday_date)
);

ALTER TABLE public.holiday_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "holidays_select" ON public.holiday_dates;
CREATE POLICY "holidays_select"
ON public.holiday_dates FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "holidays_modify_staff" ON public.holiday_dates;
CREATE POLICY "holidays_modify_staff"
ON public.holiday_dates FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- SLA POLICIES (by support plan + priority)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_plan_id uuid NOT NULL REFERENCES public.support_plans(id) ON DELETE CASCADE,
  priority text NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  first_response_target_minutes integer NOT NULL,
  resolution_target_minutes integer NOT NULL,
  clock_type text NOT NULL DEFAULT 'business'
    CHECK (clock_type IN ('business', 'calendar')),
  business_calendar_id uuid REFERENCES public.business_calendars(id),
  pause_on_customer_wait boolean NOT NULL DEFAULT true,
  pause_on_internal_wait boolean NOT NULL DEFAULT false,
  pause_on_vendor_wait boolean NOT NULL DEFAULT false,
  allow_24x7_override boolean NOT NULL DEFAULT false,
  warning_50 boolean NOT NULL DEFAULT false,
  warning_75 boolean NOT NULL DEFAULT true,
  warning_90 boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (support_plan_id, priority)
);

ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_policies_select" ON public.sla_policies;
CREATE POLICY "sla_policies_select"
ON public.sla_policies FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "sla_policies_modify_staff" ON public.sla_policies;
CREATE POLICY "sla_policies_modify_staff"
ON public.sla_policies FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- TICKET TYPES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_types_select" ON public.ticket_types;
CREATE POLICY "ticket_types_select"
ON public.ticket_types FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "ticket_types_modify_staff" ON public.ticket_types;
CREATE POLICY "ticket_types_modify_staff"
ON public.ticket_types FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- TICKET CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_categories_select" ON public.ticket_categories;
CREATE POLICY "ticket_categories_select"
ON public.ticket_categories FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "ticket_categories_modify_staff" ON public.ticket_categories;
CREATE POLICY "ticket_categories_modify_staff"
ON public.ticket_categories FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- APP SETTINGS (configurable system settings)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON public.app_settings;
CREATE POLICY "settings_select"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "settings_modify_staff" ON public.app_settings;
CREATE POLICY "settings_modify_staff"
ON public.app_settings FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates_select" ON public.email_templates;
CREATE POLICY "email_templates_select"
ON public.email_templates FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "email_templates_modify_staff" ON public.email_templates;
CREATE POLICY "email_templates_modify_staff"
ON public.email_templates FOR ALL
TO authenticated
USING (public.is_internal_staff())
WITH CHECK (public.is_internal_staff());

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON public.profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_uid ON public.profiles(auth_uid);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts(status);
CREATE INDEX IF NOT EXISTS idx_entitlements_account ON public.support_entitlements(account_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.support_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.support_team_members(team_id);
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
/*
# Ticket Number Sequence and SLA Helper Functions

## Overview
1. Creates a sequence for human-readable ticket numbers (AIV-000001 format).
2. A trigger function that assigns the next ticket number on insert.
3. An SLA due-date calculation function that respects business calendars, holidays, and 24x7 rules.

## New Objects
- **Sequence**: ticket_number_seq - starts at 1, increments by 1.
- **Function**: assign_ticket_number() - trigger BEFORE INSERT on tickets, sets ticket_number.
- **Function**: calculate_sla_due_date() - calculates a due timestamp from a start timestamp
  given target minutes, clock type, and business calendar (honors hours, holidays, 24x7).

## Notes
1. Ticket numbers are zero-padded to 6 digits: AIV-000001.
2. The SLA function handles both 'calendar' (24x7) and 'business' clock types.
3. For business clock, it walks forward day-by-day, adding available business minutes each day.
4. Holidays are skipped entirely; closed days contribute zero minutes.
*/

-- ============================================================
-- TICKET NUMBER SEQUENCE
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq START 1;

-- ============================================================
-- TRIGGER: assign_ticket_number
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num integer;
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    next_num := nextval('public.ticket_number_seq');
    NEW.ticket_number := 'AIV-' || lpad(next_num::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_ticket_number ON public.tickets;
CREATE TRIGGER trg_assign_ticket_number
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.assign_ticket_number();

-- ============================================================
-- FUNCTION: calculate_sla_due_date
-- Calculates a due timestamp from a start time given target minutes
-- and a clock type (business or calendar/24x7).
-- For business clock, respects business_calendar_hours and holiday_dates.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_sla_due_date(
  p_start_at timestamptz,
  p_target_minutes integer,
  p_clock_type text,
  p_business_calendar_id uuid DEFAULT NULL,
  p_allow_24x7 boolean DEFAULT false
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_remaining integer := p_target_minutes;
  v_current timestamptz := p_start_at;
  v_day_of_week smallint;
  v_open_time time;
  v_close_time time;
  v_is_closed boolean;
  v_is_holiday boolean;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_available_minutes integer;
  v_loop_count integer := 0;
  v_cal_tz text;
BEGIN
  -- Calendar clock or 24x7 override: simple addition
  IF p_clock_type = 'calendar' OR p_allow_24x7 = true THEN
    RETURN p_start_at + (p_target_minutes || ' minutes')::interval;
  END IF;

  -- Business clock: walk through days
  IF p_business_calendar_id IS NULL THEN
    -- No calendar, fall back to calendar time
    RETURN p_start_at + (p_target_minutes || ' minutes')::interval;
  END IF;

  SELECT timezone INTO v_cal_tz FROM public.business_calendars WHERE id = p_business_calendar_id;
  IF v_cal_tz IS NULL THEN
    v_cal_tz := 'UTC';
  END IF;

  WHILE v_remaining > 0 AND v_loop_count < 366 LOOP
    v_loop_count := v_loop_count + 1;

    -- Check if this day is a holiday
    SELECT EXISTS (
      SELECT 1 FROM public.holiday_dates
      WHERE calendar_id = p_business_calendar_id
      AND holiday_date = (v_current AT TIME ZONE v_cal_tz)::date
    ) INTO v_is_holiday;

    IF v_is_holiday THEN
      -- Skip to next day at 00:00 in calendar timezone
      v_current := date_trunc('day', v_current AT TIME ZONE v_cal_tz) AT TIME ZONE v_cal_tz + interval '1 day';
      CONTINUE;
    END IF;

    -- Get business hours for this day of week (0=Sunday in PostgreSQL extract)
    v_day_of_week := EXTRACT(dow FROM v_current AT TIME ZONE v_cal_tz)::smallint;

    SELECT open_time, close_time, is_closed INTO v_open_time, v_close_time, v_is_closed
    FROM public.business_calendar_hours
    WHERE calendar_id = p_business_calendar_id AND day_of_week = v_day_of_week;

    IF v_is_closed OR v_open_time IS NULL OR v_close_time IS NULL THEN
      -- Skip to next day
      v_current := date_trunc('day', v_current AT TIME ZONE v_cal_tz) AT TIME ZONE v_cal_tz + interval '1 day';
      CONTINUE;
    END IF;

    -- Calculate the business window for this day in calendar timezone
    v_day_start := (v_current AT TIME ZONE v_cal_tz)::date + v_open_time;
    v_day_end := (v_current AT TIME ZONE v_cal_tz)::date + v_close_time;

    -- Convert to UTC timestamps
    v_day_start := v_day_start AT TIME ZONE v_cal_tz;
    v_day_end := v_day_end AT TIME ZONE v_cal_tz;

    -- If current time is before opening, move to opening
    IF v_current < v_day_start THEN
      v_current := v_day_start;
    END IF;

    -- If current time is at or after closing, skip to next day
    IF v_current >= v_day_end THEN
      v_current := date_trunc('day', v_current AT TIME ZONE v_cal_tz) AT TIME ZONE v_cal_tz + interval '1 day';
      CONTINUE;
    END IF;

    -- Available minutes in the remaining window today
    v_available_minutes := EXTRACT(epoch FROM (v_day_end - v_current))::integer / 60;

    IF v_available_minutes >= v_remaining THEN
      -- We finish today
      RETURN v_current + (v_remaining || ' minutes')::interval;
    ELSE
      -- Use all available minutes today, move to next day
      v_remaining := v_remaining - v_available_minutes;
      v_current := date_trunc('day', v_day_end AT TIME ZONE v_cal_tz) AT TIME ZONE v_cal_tz + interval '1 day';
    END IF;
  END LOOP;

  -- Fallback: if we exhausted the loop, return start + full duration (calendar)
  RETURN p_start_at + (p_target_minutes || ' minutes')::interval;
END;
$$;
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
/*
# Fix: Profile creation for new user sign-ups

## Problem
When a new user signs up via Supabase Auth, the `handle_new_auth_user` trigger
only tried to UPDATE an existing profile matching the email. For brand-new users
(not in the demo seed data), no profile row existed, so nothing happened.
The client-side upsert in AuthContext was also blocked by RLS (profiles_insert_staff
only allows internal staff to insert). This left `profile` null and the app showed a blank page.

## Fix
1. **Trigger updated**: `handle_new_auth_user` now does an INSERT ... ON CONFLICT
   (upsert) so it creates a new profile row for users not in the seed data, with
   default user_type='customer_user' and status='active'.
2. **New RLS policy**: `profiles_insert_self` allows an authenticated user to insert
   a profile row for their own auth_uid (self-registration fallback).
3. **Existing trigger preserved**: still activates pending/invited demo profiles
   by matching email and setting auth_uid + status='active'.

## Notes
1. The trigger runs as SECURITY DEFINER so it bypasses RLS.
2. New users get user_type='customer_user' by default (no account_id, so they
   can't create tickets until an admin assigns them to an account — but they
   can at least see the portal and not get a blank page).
3. The self-insert policy is a belt-and-suspenders fallback; the trigger is the
   primary mechanism.
*/

-- ============================================================
-- Updated trigger: upsert profile on auth user creation
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First, try to activate an existing pending/invited profile matching this email
  UPDATE public.profiles
  SET auth_uid = NEW.id,
      status = 'active',
      activated_at = now(),
      updated_at = now()
  WHERE email = NEW.email AND status IN ('pending', 'invited');

  -- If no row was updated, insert a new profile for this user
  IF NOT FOUND THEN
    INSERT INTO public.profiles (email, auth_uid, first_name, last_name, user_type, status, activated_at)
    VALUES (NEW.email, NEW.id, COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'), COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'), 'customer_user', 'active', now())
    ON CONFLICT (email) DO UPDATE
      SET auth_uid = EXCLUDED.auth_uid,
          status = 'active',
          activated_at = now(),
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- New RLS policy: allow self-registration insert
-- ============================================================

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth_uid = auth.uid());
/*
# Fix: Profile SELECT policy must match on auth_uid, not just id

## Problem
The `profiles_select_own_or_staff` policy checked `id = auth.uid()` to allow users
to read their own profile. But the `id` column is the profile's primary key (a
separate UUID), while the link to the auth user is the `auth_uid` column.
A newly created user whose profile `id` differs from their `auth.uid()` would
get zero rows back from the SELECT, leaving `profile` null and showing a blank page.

## Fix
Updated the SELECT policy to match on `auth_uid = auth.uid()` instead of
`id = auth.uid()`. This correctly identifies the user's own profile row.

## Notes
1. Internal staff still get broad access via `is_internal_staff()`.
2. Customer users still get account-scoped access via `is_customer() AND account_id = current_account_id()`.
*/

DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON public.profiles;
CREATE POLICY "profiles_select_own_or_staff"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth_uid = auth.uid()
  OR public.is_internal_staff()
  OR (public.is_customer() AND account_id = public.current_account_id())
);

-- Also fix the update_own policy to match on auth_uid
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth_uid = auth.uid())
WITH CHECK (auth_uid = auth.uid());
/*
# Storage bucket policies for attachments

## Overview
Sets up RLS policies on the 'attachments' storage bucket so authenticated
users can upload, read, and manage their own file attachments.

## Policies
1. SELECT - any authenticated user can read attachments (they're public)
2. INSERT - authenticated users can upload files
3. UPDATE - users can update their own files
4. DELETE - users can delete their own files

## Notes
1. The bucket is public so images/videos can be displayed inline in the rich text editor.
2. File paths use the pattern: {user_id}/{timestamp}-{filename}
*/

-- Allow authenticated users to read all attachments
DROP POLICY IF EXISTS "attachments_read" ON storage.objects;
CREATE POLICY "attachments_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'attachments');

-- Allow authenticated users to upload attachments
DROP POLICY IF EXISTS "attachments_insert" ON storage.objects;
CREATE POLICY "attachments_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Allow users to update their own attachments
DROP POLICY IF EXISTS "attachments_update" ON storage.objects;
CREATE POLICY "attachments_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'attachments' AND owner = auth.uid())
WITH CHECK (bucket_id = 'attachments' AND owner = auth.uid());

-- Allow users to delete their own attachments
DROP POLICY IF EXISTS "attachments_delete" ON storage.objects;
CREATE POLICY "attachments_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments' AND owner = auth.uid());
/*
# Fix: Helper functions must match on auth_uid, not id

## Problem
The SECURITY DEFINER helper functions `is_internal_staff()`, `is_customer()`,
`current_account_id()`, and `current_user_type()` all queried `profiles` with
`WHERE id = auth.uid()`. But the profile's `id` is a separate UUID primary key,
not the Supabase auth user's ID. The link is via the `auth_uid` column.
This meant `is_internal_staff()` always returned false for admin users, so
the `profiles_insert_staff` RLS policy blocked all admin-created user inserts.
The admin would click "Save" in the Users page, the insert silently failed,
and no new user appeared.

## Fix
All four helper functions now match on `auth_uid = auth.uid()` instead of
`id = auth.uid()`.

## Notes
1. This is the same root cause as the earlier profiles SELECT fix (migration 006).
2. The `profiles_insert_self` policy (migration 005) already uses the correct
   `auth_uid = auth.uid()` check, so self-registration was unaffected.
*/

CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_uid = auth.uid()
    AND user_type IN ('agent', 'manager', 'account_manager', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_customer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_uid = auth.uid()
    AND user_type IN ('customer_user', 'customer_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT account_id FROM public.profiles WHERE auth_uid = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_type()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT user_type FROM public.profiles WHERE auth_uid = auth.uid();
$$;
/*
# Fix: Add foreign key on profiles.account_id so PostgREST joins work

## Problem
The `profiles.account_id` column had no foreign key constraint to `accounts.id`.
PostgREST (the Supabase data API) requires a declared foreign key to perform
nested reads like `profiles.select('*, accounts(company_name)')`. Without it,
the query returns an error and the Users page shows no users.

## Fix
Add `ALTER TABLE profiles ADD CONSTRAINT profiles_account_id_fkey
FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL`.

## Notes
1. ON DELETE SET NULL so deleting an account doesn't cascade-delete user profiles.
2. The constraint is added with IF NOT EXISTS-style guard (DROP first).
*/

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
/*
# Add customer_priority and aiv_priority columns to tickets

## Overview
Adds two new columns to the tickets table:
- `customer_priority` — the priority the customer perceives/sets (P1–P4)
- `aiv_priority` — the priority AIV support assigns/uses for SLA (P1–P4)

The existing `priority` column is retained as the operational/SLA priority
and is now treated as the AIV priority. `aiv_priority` defaults to the
value of `priority` for existing rows via the UPDATE below.

## New Columns
1. `tickets.customer_priority` (text, P1–P4, default P3)
2. `tickets.aiv_priority` (text, P1–P4, default P3)

## Data Migration
- `aiv_priority` is backfilled from `priority` for all existing rows.
- `customer_priority` is backfilled from `priority` for all existing rows.

## Security
- No RLS policy changes needed; columns are readable/writable under
  existing ticket policies.

## Notes
1. The `priority` column remains the canonical SLA priority used by
   ticket_sla_snapshots and sla_policies lookups. New ticket creation
   should set `priority = aiv_priority` (or `customer_priority` if the
   creator is a customer) so SLA continues to work.
2. Both columns use the same CHECK constraint as `priority`.
*/

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS customer_priority text NOT NULL DEFAULT 'P3'
    CHECK (customer_priority IN ('P1', 'P2', 'P3', 'P4'));

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS aiv_priority text NOT NULL DEFAULT 'P3'
    CHECK (aiv_priority IN ('P1', 'P2', 'P3', 'P4'));

-- Backfill from the existing operational priority
UPDATE public.tickets SET aiv_priority = priority WHERE aiv_priority = 'P3' AND priority != 'P3';
UPDATE public.tickets SET customer_priority = priority WHERE customer_priority = 'P3' AND priority != 'P3';
/*
# Add missing foreign key constraints on accounts table

## Overview
The accounts table has `support_plan_id` and `support_team_id` columns
but no foreign key constraints. Without them, PostgREST cannot resolve
nested joins like `support_plans(name, code)`, causing the Accounts page
query to fail with PGRST200.

## Changes
1. Add FK from `accounts.support_plan_id` -> `support_plans(id)`
2. Add FK from `accounts.support_team_id` -> `support_teams(id)`

## Notes
- Uses `IF NOT EXISTS` via DO block for idempotency.
- No data is lost; existing rows with valid references remain valid.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_support_plan_id_fkey'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_support_plan_id_fkey
      FOREIGN KEY (support_plan_id) REFERENCES public.support_plans(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_support_team_id_fkey'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_support_team_id_fkey
      FOREIGN KEY (support_team_id) REFERENCES public.support_teams(id) ON DELETE SET NULL;
  END IF;
END $$;
