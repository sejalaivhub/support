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
