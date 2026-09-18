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
