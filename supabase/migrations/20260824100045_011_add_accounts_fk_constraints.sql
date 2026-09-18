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
