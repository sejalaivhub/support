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
