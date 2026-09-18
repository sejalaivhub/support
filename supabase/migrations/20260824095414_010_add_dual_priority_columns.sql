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
