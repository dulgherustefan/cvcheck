-- Persist the new per-analysis extras on the roasts table so they show up in
-- history: the job-target match (when a job description was pasted) and the Pro
-- deliverables (optimized CV + cover letter).
--
-- Safe to run more than once (IF NOT EXISTS). Run this in the Supabase SQL editor.

alter table public.roasts add column if not exists job_match   jsonb;
alter table public.roasts add column if not exists optimized_cv text;
alter table public.roasts add column if not exists cover_letter text;
