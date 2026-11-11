-- Required by learner enrollment in the Cisco attendance register.
-- Existing learners remain in the 2026 attendance cohort.
alter table public.students
  add column if not exists academic_year integer;

update public.students
set academic_year = 2026
where academic_year is null;

alter table public.students
  alter column academic_year set default 2026,
  alter column academic_year set not null;

create index if not exists students_centre_academic_year_active_idx
  on public.students (centre_id, academic_year)
  where active = true;
