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
