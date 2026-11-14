-- Existing learner IDs and attendance remain intact; all legacy cohorts belong to 2026.
alter table public.students add column academic_year integer not null default 2026
  check (academic_year between 2026 and 2100);
alter table public.students add column normalized_name text generated always as
  (lower(regexp_replace(btrim(full_name), '\s+', ' ', 'g'))) stored;
alter table public.students drop constraint students_name_centre_unique;
alter table public.students add constraint students_cohort_name_unique
  unique (centre_id, academic_year, normalized_name);
alter table public.week_notes add column academic_year integer not null default 2026
  check (academic_year between 2026 and 2100);
alter table public.week_notes drop constraint week_notes_centre_week_unique;
alter table public.week_notes add constraint week_notes_centre_year_week_unique
  unique (centre_id, academic_year, week_number);
alter table public.weekly_reports add column academic_year integer not null default 2026
  check (academic_year between 2026 and 2100);

-- Invoker rights retain existing authenticated trainer access and table RLS.
-- One transaction per batch: retries skip existing names without overwriting learners.
create or replace function public.enrol_learners(p_centre_id integer, p_academic_year integer, p_names text[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare added integer;
begin
  if auth.uid() is null then raise exception 'Sign in before adding learners'; end if;
  if p_academic_year is null or p_academic_year not between 2026 and 2100 then
    raise exception 'Academic year must be between 2026 and 2100'; end if;
  if p_names is null or cardinality(p_names) not between 1 and 1000 then
    raise exception 'Submit between 1 and 1000 learner names'; end if;
  if not exists (select 1 from public.centres where id=p_centre_id) then
    raise exception 'Centre not found or not accessible'; end if;
  if exists (select 1 from unnest(p_names) n where n is null
    or char_length(regexp_replace(btrim(n),'\s+',' ','g')) not between 2 and 120
    or n ~ '[<>|[:cntrl:]]' or btrim(n) ~ '^[=+@]') then
    raise exception 'Invalid learner name in batch'; end if;
  insert into public.students(full_name,centre_id,academic_year,active)
    select regexp_replace(btrim(n),'\s+',' ','g'),p_centre_id,p_academic_year,true
    from unnest(p_names) n
    on conflict (centre_id,academic_year,normalized_name) do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object('inserted',added,'skipped',cardinality(p_names)-added);
end;
$$;
revoke all on function public.enrol_learners(integer,integer,text[]) from public, anon;
grant execute on function public.enrol_learners(integer,integer,text[]) to authenticated;
