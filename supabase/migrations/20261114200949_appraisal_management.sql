
create schema if not exists private;
create table public.appraisal_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 added_at timestamptz not null default now()
);
-- Preserve the existing staff cohort; new signups receive no appraisal access.
insert into public.appraisal_staff(user_id) select id from auth.users where deleted_at is null and is_anonymous is not true;
alter table public.appraisal_staff enable row level security;
revoke all on public.appraisal_staff from anon,authenticated;
grant select on public.appraisal_staff to authenticated;
create policy staff_self on public.appraisal_staff for select to authenticated using(user_id=(select auth.uid()));

create table public.appraisal_records (
 id uuid primary key default gen_random_uuid(),
 centre_id integer not null references public.centres(id),
 academic_year integer not null check(academic_year between 2026 and 2100),
 kind text not null check(kind in ('equipment','maintenance','assessment','feedback','intervention','teaching','submission','issue','development','task')),
 title text not null check(char_length(btrim(title)) between 2 and 200),
 record_date date not null,
 due_date date,
 student_id integer references public.students(id),
 related_id uuid references public.appraisal_records(id),
 status text not null default 'planned' check(status in ('planned','in_progress','completed','submitted','reviewed','resolved','cancelled')),
 details jsonb not null default '{}' check(jsonb_typeof(details)='object' and octet_length(details::text)<=20000),
 notes text not null default '' check(char_length(notes)<=5000),
 evidence_url text not null default '' check(evidence_url='' or evidence_url ~ '^https://'),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version integer not null default 1,
 check(extract(year from record_date)=academic_year)
);
create index appraisal_records_filter on public.appraisal_records(centre_id,academic_year,kind,record_date);
create index appraisal_records_student on public.appraisal_records(student_id);
create index appraisal_records_related on public.appraisal_records(related_id);
alter table public.appraisal_records enable row level security;
revoke all on public.appraisal_records from anon,authenticated;
grant select,insert,update on public.appraisal_records to authenticated;
create policy staff_records_read on public.appraisal_records for select to authenticated
 using(exists(select 1 from public.appraisal_staff where user_id=(select auth.uid())));
create policy staff_records_create on public.appraisal_records for insert to authenticated
 with check(created_by=(select auth.uid()) and exists(select 1 from public.appraisal_staff where user_id=(select auth.uid())));
create policy staff_records_update on public.appraisal_records for update to authenticated
 using(exists(select 1 from public.appraisal_staff where user_id=(select auth.uid())))
 with check(exists(select 1 from public.appraisal_staff where user_id=(select auth.uid())));

create table public.appraisal_history (
 id bigint generated always as identity primary key,
 record_id uuid not null references public.appraisal_records(id),
 actor_id uuid not null references auth.users(id),
 changed_at timestamptz not null default now(),
 action text not null,
 before_value jsonb,
 after_value jsonb not null
);
alter table public.appraisal_history enable row level security;
revoke all on public.appraisal_history from anon,authenticated;
grant select on public.appraisal_history to authenticated;
create policy staff_history_read on public.appraisal_history for select to authenticated
 using(exists(select 1 from public.appraisal_staff where user_id=(select auth.uid())));
create index appraisal_history_record on public.appraisal_history(record_id,changed_at);

create function private.validate_appraisal_record() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Staff sign-in required'; end if;
 if new.student_id is not null and not exists(select 1 from public.students where id=new.student_id and centre_id=new.centre_id and academic_year=new.academic_year) then
  raise exception 'Learner does not belong to the selected centre and year'; end if;
 if new.related_id is not null and not exists(select 1 from public.appraisal_records where id=new.related_id and centre_id=new.centre_id and academic_year=new.academic_year) then
  raise exception 'Linked record belongs to a different register'; end if;
 if new.kind in ('assessment','feedback') and new.student_id is null then raise exception 'Select a learner'; end if;
 if new.kind='assessment' then
  if not (new.details ?& array['topic','score','maximum','phase']) or length(btrim(new.details->>'topic'))=0 then raise exception 'Assessment topic, score, maximum and phase required'; end if;
  if jsonb_typeof(new.details->'score') is distinct from 'number' or jsonb_typeof(new.details->'maximum') is distinct from 'number' then raise exception 'Numeric assessment scores required'; end if;
  if (new.details->>'maximum')::numeric<=0 or (new.details->>'score')::numeric<0 or (new.details->>'score')::numeric>(new.details->>'maximum')::numeric then raise exception 'Invalid assessment score'; end if;
  if new.details->>'phase' not in ('baseline','follow_up','practice') then raise exception 'Invalid assessment phase'; end if;
 end if;
 if new.kind='maintenance' and coalesce(new.details->>'asset','')='' then raise exception 'Equipment identifier required'; end if;
 if new.kind='intervention' and coalesce(new.details->>'gap','')='' then raise exception 'Learning gap required'; end if;
 if new.kind='feedback' and coalesce(new.details->>'feedback','')='' then raise exception 'Feedback required'; end if;
 if new.kind in ('maintenance','submission') and new.status in ('submitted','reviewed') and coalesce(new.details->>'submitted_on','')='' then raise exception 'Actual submission date required'; end if;
 if new.kind='issue' and new.status='resolved' and (coalesce(new.details->>'discussion_on','')='' or coalesce(new.details->>'resolution','')='') then raise exception 'Discussion date and resolution required'; end if;
 if new.kind='intervention' and new.details ? 'participants' then
  if jsonb_typeof(new.details->'participants')<>'array' then raise exception 'Invalid participants'; end if;
  if exists(select 1 from jsonb_array_elements_text(new.details->'participants') p where not exists(select 1 from public.students where id=p::integer and centre_id=new.centre_id and academic_year=new.academic_year)) then raise exception 'Participant belongs to another register'; end if;
 end if;
 if tg_op='UPDATE' then
  new.id=old.id;new.created_by=old.created_by;new.created_at=old.created_at;new.version=old.version+1;
 else
  new.created_by=auth.uid();new.created_at=now();new.version=1;
 end if;
 new.updated_by=auth.uid();new.updated_at=now();
 return new;
end $$;
create trigger validate_appraisal before insert or update on public.appraisal_records
 for each row execute function private.validate_appraisal_record();

create function private.audit_appraisal_record() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.appraisal_staff where user_id=auth.uid()) then raise exception 'Staff sign-in required'; end if;
 insert into public.appraisal_history(record_id,actor_id,action,before_value,after_value)
 values(new.id,auth.uid(),tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function private.audit_appraisal_record() from public,anon,authenticated;
create trigger audit_appraisal after insert or update on public.appraisal_records
 for each row execute function private.audit_appraisal_record();

create table public.learner_surveys (
 id uuid primary key default gen_random_uuid(),
 centre_id integer not null references public.centres(id),
 academic_year integer not null check(academic_year between 2026 and 2100),
 title text not null check(char_length(btrim(title)) between 2 and 150),
 token text not null unique default encode(extensions.gen_random_bytes(24),'hex'),
 questions jsonb not null default '[{"id": "netacad", "type": "rating", "label": "I understand the topics taught on Cisco NetAcad.", "required": true}, {"id": "practical", "type": "rating", "label": "I can carry out the practical tasks after the lesson.", "required": true}, {"id": "explanations", "type": "rating", "label": "My teacher explains difficult topics clearly.", "required": true}, {"id": "knowledge", "type": "rating", "label": "My teacher demonstrates the skills needed to teach the course.", "required": true}, {"id": "support", "type": "rating", "label": "I receive help when I struggle or ask a question.", "required": true}, {"id": "practice_time", "type": "rating", "label": "I get enough time and equipment to practise.", "required": true}, {"id": "feedback", "type": "rating", "label": "The feedback I receive helps me improve.", "required": true}, {"id": "respect", "type": "rating", "label": "My teacher treats learners fairly and respectfully.", "required": true}, {"id": "satisfaction", "type": "rating", "label": "Overall, I am satisfied with my Cisco training.", "required": true}, {"id": "likes", "type": "text", "label": "What do you like most about your teacher or the lessons?", "required": false}, {"id": "improve", "type": "text", "label": "What do you dislike, or what should the teacher do differently?", "required": false}, {"id": "difficult_topics", "type": "text", "label": "Which NetAcad topics or practical tasks do you find difficult?", "required": false}, {"id": "suggestions", "type": "text", "label": "What changes would help you learn better?", "required": false}]'::jsonb,
 closes_at timestamptz not null,
 is_open boolean not null default true,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.survey_invites (
 id uuid primary key default gen_random_uuid(),
 survey_id uuid not null references public.learner_surveys(id) on delete cascade,
 student_id integer not null references public.students(id),
 learner_name text not null,
 access_code text not null default encode(extensions.gen_random_bytes(16),'hex'),
 unique(survey_id,student_id)
);
create table public.survey_responses (
 id uuid primary key default gen_random_uuid(),
 survey_id uuid not null references public.learner_surveys(id),
 invite_id uuid not null unique references public.survey_invites(id),
 student_id integer not null references public.students(id),
 answers jsonb not null check(jsonb_typeof(answers)='object'),
 submitted_at timestamptz not null default now()
);
create index learner_surveys_filter on public.learner_surveys(centre_id,academic_year);
create index survey_responses_survey on public.survey_responses(survey_id);
create index survey_responses_student on public.survey_responses(student_id);
do $$ declare t text; begin
 foreach t in array array['learner_surveys','survey_invites','survey_responses'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy staff_read on public.%I for select to authenticated using(exists(select 1 from public.appraisal_staff where user_id=(select auth.uid())))',t);
 end loop;
end $$;

-- Staff-only creation snapshots the eligible roster and immutable question set.
create function private.create_learner_survey(p_centre integer,p_year integer,p_title text,p_closes timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.appraisal_staff where user_id=auth.uid()) then raise exception 'Staff access required'; end if;
 if p_closes<=now() or p_closes>now()+interval '1 year' then raise exception 'Choose a closing date within the next year'; end if;
 if not exists(select 1 from public.students where centre_id=p_centre and academic_year=p_year and active) then raise exception 'Add learners before creating a survey'; end if;
 insert into public.learner_surveys(centre_id,academic_year,title,closes_at) values(p_centre,p_year,btrim(p_title),p_closes) returning id into sid;
 insert into public.survey_invites(survey_id,student_id,learner_name)
 select sid,id,full_name from public.students where centre_id=p_centre and academic_year=p_year and active;
 return sid;
end $$;
create function public.create_learner_survey(p_centre integer,p_year integer,p_title text,p_closes timestamptz)
returns uuid language sql security invoker set search_path='' as $$ select private.create_learner_survey(p_centre,p_year,p_title,p_closes) $$;

create function private.close_learner_survey(p_survey uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.appraisal_staff where user_id=auth.uid()) then raise exception 'Staff access required'; end if;
 update public.learner_surveys set is_open=false where id=p_survey;
 if not found then raise exception 'Survey not found'; end if;
end $$;
create function public.close_learner_survey(p_survey uuid) returns void language sql security invoker set search_path='' as $$ select private.close_learner_survey(p_survey) $$;

-- Anonymous access is capability-scoped: only a valid survey token reveals its roster.
-- Individual responses require the matching per-learner secret, not merely a chosen name.
create function private.get_learner_survey(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.learner_surveys;
begin
 select * into s from public.learner_surveys where token=p_token and is_open and closes_at>now();
 if not found then raise exception 'This survey link is invalid or closed'; end if;
 return jsonb_build_object('title',s.title,'questions',s.questions,'closes_at',s.closes_at,
 'learners',(select jsonb_agg(jsonb_build_object('id',student_id,'name',learner_name) order by learner_name) from public.survey_invites where survey_id=s.id));
end $$;
create function public.get_learner_survey(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select private.get_learner_survey(p_token) $$;

create function private.submit_learner_survey(p_token text,p_student integer,p_code text,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.learner_surveys; i public.survey_invites; q jsonb; v jsonb; rid uuid;
begin
 select * into s from public.learner_surveys where token=p_token and is_open and closes_at>now() for share;
 if not found then raise exception 'This survey link is invalid or closed'; end if;
 select * into i from public.survey_invites where survey_id=s.id and student_id=p_student and access_code=p_code;
 if not found then raise exception 'The selected name and access code do not match'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>20000 then raise exception 'Invalid survey answers'; end if;
 if exists(select 1 from jsonb_object_keys(p_answers) k where not exists(select 1 from jsonb_array_elements(s.questions) x where x->>'id'=k)) then raise exception 'Unknown survey question'; end if;
 for q in select * from jsonb_array_elements(s.questions) loop
  v=p_answers->(q->>'id');
  if q->>'type'='rating' then
   if v is null or v::text not in ('1','2','3','4','5','"na"') then raise exception 'Answer every rating question'; end if;
  elsif v is not null and (jsonb_typeof(v)<>'string' or char_length(v#>>'{}')>2000) then raise exception 'Written answers must be text under 2000 characters';
  end if;
 end loop;
 insert into public.survey_responses(survey_id,invite_id,student_id,answers) values(s.id,i.id,i.student_id,p_answers)
 on conflict(invite_id) do nothing returning id into rid;
 return jsonb_build_object('submitted',true,'already_submitted',rid is null);
end $$;
create function public.submit_learner_survey(p_token text,p_student integer,p_code text,p_answers jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.submit_learner_survey(p_token,p_student,p_code,p_answers) $$;

grant usage on schema private to anon,authenticated;
revoke all on function private.validate_appraisal_record() from public,anon,authenticated;
do $$ declare f text; begin
 foreach f in array array['create_learner_survey(integer,integer,text,timestamptz)','close_learner_survey(uuid)'] loop
  execute 'revoke all on function private.'||f||' from public,anon,authenticated';
  execute 'revoke all on function public.'||f||' from public,anon,authenticated';
  execute 'grant execute on function private.'||f||' to authenticated';
  execute 'grant execute on function public.'||f||' to authenticated';
 end loop;
 foreach f in array array['get_learner_survey(text)','submit_learner_survey(text,integer,text,jsonb)'] loop
  execute 'revoke all on function private.'||f||' from public,anon,authenticated';
  execute 'revoke all on function public.'||f||' from public,anon,authenticated';
  execute 'grant execute on function private.'||f||' to anon,authenticated';
  execute 'grant execute on function public.'||f||' to anon,authenticated';
 end loop;
end $$;
