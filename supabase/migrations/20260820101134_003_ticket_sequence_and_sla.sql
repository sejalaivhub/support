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
