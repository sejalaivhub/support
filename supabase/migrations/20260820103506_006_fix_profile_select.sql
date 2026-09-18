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
