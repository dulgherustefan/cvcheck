-- ip_address is referenced by src/app/api/roast/route.ts (anonymous roast
-- persistence + "claim anonymous scans on signup" query) but was never
-- actually added to the table — both code paths have been silently failing.
alter table public.roasts add column if not exists ip_address text;
