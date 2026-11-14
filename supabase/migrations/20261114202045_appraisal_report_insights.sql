alter table public.weekly_reports add column centre_id integer references public.centres(id);
alter table public.weekly_reports add column data_insights text not null default '' check(char_length(data_insights)<=5000);
alter table public.weekly_reports add column intervention_plan text not null default '' check(char_length(intervention_plan)<=5000);
create index weekly_reports_centre_year on public.weekly_reports(centre_id,academic_year);
alter publication supabase_realtime add table public.appraisal_records,public.survey_responses;
