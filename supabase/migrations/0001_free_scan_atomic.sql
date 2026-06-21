-- Atomic free-scan limiter.
-- Replaces the read-check-write pattern in /api/roast which had a TOCTOU race:
-- two concurrent requests from the same identifier could both pass the
-- "scan_count < limit" check and each consume a free scan.
--
-- This function performs the check + increment in a single atomic statement.
-- Returns TRUE when the scan is allowed (and was counted), FALSE when the
-- limit is already reached.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create table if not exists public.free_scans (
  identifier  text primary key,
  scan_count  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.increment_free_scan(
  p_identifier text,
  p_limit      int
)
returns boolean
language plpgsql
as $$
declare
  v_count int;
begin
  -- INSERT or atomically increment only when still under the limit.
  insert into public.free_scans (identifier, scan_count)
    values (p_identifier, 1)
  on conflict (identifier) do update
    set scan_count = public.free_scans.scan_count + 1,
        updated_at = now()
    where public.free_scans.scan_count < p_limit
  returning scan_count into v_count;

  -- v_count is NULL when the ON CONFLICT WHERE filtered the row out
  -- (i.e. the limit was already reached and nothing was updated).
  return v_count is not null;
end;
$$;
