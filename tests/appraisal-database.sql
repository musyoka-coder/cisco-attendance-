begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.appraisal_staff limit 1),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
create temporary table test_survey_fixture(token text,student integer,code text,survey uuid,answers jsonb);
do $$
declare sid uuid; rid uuid; lid integer; k text; d jsonb; t text; a jsonb;
begin
 select id into lid from public.students where centre_id=1 and academic_year=2026 limit 1;
 foreach k in array array['equipment','maintenance','assessment','feedback','intervention','teaching','submission','issue','development','task'] loop
  d=case k when 'maintenance' then '{"asset":"TEST-ASSET"}'::jsonb
    when 'assessment' then '{"topic":"Test networking","score":5,"maximum":10,"phase":"baseline"}'::jsonb
    when 'feedback' then '{"feedback":"Test feedback"}'::jsonb
    when 'intervention' then '{"gap":"Test gap"}'::jsonb else '{}'::jsonb end;
  insert into public.appraisal_records(centre_id,academic_year,kind,title,record_date,student_id,details)
  values(1,2026,k,'TEST rolled-back record','2026-11-15',case when k in ('assessment','feedback') then lid else null end,d) returning id into rid;
  update public.appraisal_records set notes='Test update' where id=rid and version=1;
  if not exists(select 1 from public.appraisal_records where id=rid and version=2) then raise exception 'Version test failed'; end if;
  if (select count(*) from public.appraisal_history where record_id=rid)<>2 then raise exception 'Audit test failed'; end if;
 end loop;
 begin
  insert into public.appraisal_records(centre_id,academic_year,kind,title,record_date,student_id,details)
  values(2,2026,'feedback','Wrong centre','2026-11-15',lid,'{"feedback":"test"}');
  raise exception 'Cross-centre validation failed';
 exception when raise_exception then if SQLERRM <> 'Learner does not belong to the selected centre and year' then raise; end if; end;
 sid=public.create_learner_survey(1,2026,'TEST rolled-back survey',now()+interval '1 day');
 if (select count(*) from public.survey_invites where survey_id=sid)<>(select count(*) from public.students where centre_id=1 and academic_year=2026 and active) then raise exception 'Roster snapshot test failed'; end if;
 select jsonb_object_agg(q->>'id',case when q->>'type'='rating' then '4'::jsonb else '"Test written response"'::jsonb end) into a from public.learner_surveys s,jsonb_array_elements(s.questions) q where s.id=sid;
 insert into test_survey_fixture select s.token,i.student_id,i.access_code,s.id,a from public.learner_surveys s join public.survey_invites i on i.survey_id=s.id where s.id=sid limit 1;
end $$;
grant select on test_survey_fixture to anon;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
do $$ declare f record; result jsonb; begin
 select * into f from test_survey_fixture;
 result=public.get_learner_survey(f.token);
 if jsonb_array_length(result->'learners')=0 or result::text like '%access_code%' then raise exception 'Public survey data test failed'; end if;
 begin perform public.get_learner_survey('invalid'); raise exception 'Invalid token accepted'; exception when raise_exception then if SQLERRM<>'This survey link is invalid or closed' then raise; end if; end;
 begin perform public.submit_learner_survey(f.token,f.student,'wrong',f.answers); raise exception 'Wrong code accepted'; exception when raise_exception then if SQLERRM<>'The selected name and access code do not match' then raise; end if; end;
 begin perform public.submit_learner_survey(f.token,f.student,f.code,'{}'); raise exception 'Missing answers accepted'; exception when raise_exception then if SQLERRM<>'Answer every rating question' then raise; end if; end;
 result=public.submit_learner_survey(f.token,f.student,f.code,f.answers);
 if result->>'already_submitted'<>'false' then raise exception 'Submission failed'; end if;
 result=public.submit_learner_survey(f.token,f.student,f.code,f.answers);
 if result->>'already_submitted'<>'true' then raise exception 'Duplicate submission test failed'; end if;
 begin perform * from public.survey_responses; raise exception 'Anonymous response read allowed'; exception when insufficient_privilege then null; end;
 begin perform * from public.appraisal_records; raise exception 'Anonymous appraisal read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.appraisal_staff limit 1),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare f record; begin
 select * into f from test_survey_fixture;
 if (select count(*) from public.survey_responses where survey_id=f.survey)<>1 then raise exception 'Staff cannot read submitted response'; end if;
 perform public.close_learner_survey(f.survey);
 begin perform public.get_learner_survey(f.token); raise exception 'Closed survey accepted'; exception when raise_exception then if SQLERRM<>'This survey link is invalid or closed' then raise; end if; end;
end $$;
select 'PASS: all modules, audit history, cohort validation, survey roster, submission, duplicates, invalid codes, anonymous access and closing' as result;
rollback;
