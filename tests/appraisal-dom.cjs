const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const questions=require('../survey-questions.js');
const wait=async predicate=>{for(let n=0;n<100;n++){if(predicate())return;await new Promise(r=>setTimeout(r,10))}throw Error('Timed out waiting for UI')};
(async()=>{
 const dom=new JSDOM(fs.readFileSync('appraisal.html','utf8'),{url:'https://register.test/appraisal.html',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.print=()=>{};w.confirm=()=>true;
 const db={centres:[{id:1,name:'Milimani'}],appraisal_staff:[{user_id:'staff'}],students:[{id:1,full_name:'Test Learner',active:true,centre_id:1,academic_year:2026}],appraisal_records:[],appraisal_history:[],learner_surveys:[],survey_invites:[],survey_responses:[],weekly_reports:[]};
 let serial=0;
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'staff'}}}}),onAuthStateChange:()=>{}},from(table){let filters=[],range=null,action=null,body=null;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},range(a,b){range=[a,b];return q},insert(r){action='insert';body=r;return q},update(r){action='update';body=r;return q},then(resolve){let data=db[table].filter(r=>filters.every(f=>f(r)));if(action==='insert'){const r={...body,id:'r'+(++serial),version:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};db[table].push(r);data=[r]}if(action==='update'){data.forEach(r=>Object.assign(r,body,{version:r.version+1}))}if(range)data=data.slice(range[0],range[1]+1);return Promise.resolve({data,error:null}).then(resolve)}};return q},rpc:async(name,p)=>{if(name==='create_learner_survey'){db.learner_surveys.push({id:'survey1',title:p.p_title,centre_id:p.p_centre,academic_year:p.p_year,closes_at:p.p_closes,is_open:true,token:'token',questions,created_at:new Date().toISOString()});db.survey_invites.push({id:'invite1',survey_id:'survey1',student_id:1,learner_name:'Test Learner',access_code:'code'});return {data:'survey1'}}if(name==='close_learner_survey'){db.learner_surveys[0].is_open=false;return {data:null}}}};
 w.APP_CONFIG={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_test'};w.supabase={createClient:()=>client};w.eval(fs.readFileSync('appraisal-config.js','utf8')+'\n'+fs.readFileSync('appraisal.js','utf8'));
 await wait(()=>!w.document.querySelector('#workspace').hidden&&w.document.querySelector('#content').textContent.includes('Evidence overview'));
 const modules=require('../appraisal-config.js').APPRAISAL_MODULES;
 for(const[kind,config]of Object.entries(modules)){
  w.openRecord(kind);const form=w.document.querySelector('#record-form');form.elements.title.value='Test '+kind;form.elements.record_date.value='2026-11-15';
  if(config.learner)form.elements.student_id.value='1';
  for(const[name,,type]of config.fields){const el=form.elements['detail_'+name];if(type==='number')el.value=name==='maximum'?'10':'5';else if(type==='text'||type==='textarea')el.value='Test evidence';else if(type==='date')el.value='2026-11-15';else if(type==='learners')el.options[0].selected=true;}
  await w.saveRecord({preventDefault(){},target:form});assert.equal(w.document.querySelector('#editor').open,false,kind+' saved');
 }
 assert.equal(db.appraisal_records.length,10);
 const record=db.appraisal_records[0];w.openRecord(record.kind,record);await w.saveRecord({preventDefault(){},target:w.document.querySelector('#record-form')});assert.equal(record.version,2);
 // Enter the real Surveys screen and create a campaign through its form.
 w.document.querySelector('[data-tab="surveys"]').click();await wait(()=>w.document.querySelector('#create-survey'));
 const form=w.document.querySelector('#create-survey');form.elements.title.value='Test survey';form.elements.closes.value='2026-12-31';await form.onsubmit({preventDefault(){},target:form});
 assert.match(w.document.querySelector('#survey-details').textContent,/Test Learner/);
 db.survey_responses.push({id:'response1',survey_id:'survey1',student_id:1,submitted_at:new Date().toISOString(),answers:Object.fromEntries(questions.map(q=>[q.id,q.type==='rating'?4:'More practical time']))});
 await w.loadApp();w.document.querySelector('[data-response]').click();assert.match(w.document.querySelector('#response-view').textContent,/More practical time/);
 w.document.querySelector('#survey-followup').click();assert.equal(w.document.querySelector('#record-form').elements.student_id.value,'1');
 assert.match(w.document.querySelector('#record-form').elements.detail_action.value,/More practical time/);
 w.document.querySelector('#cancel-editor').click();await w.document.querySelector('#close-survey').onclick();assert.equal(db.learner_surveys[0].is_open,false);
 dom.window.close();
 // Learner page: render actual questions, retain entries on error, then submit successfully.
 const surveyDom=new JSDOM(fs.readFileSync('survey.html','utf8'),{url:'https://register.test/survey.html#survey=token&learner=1&code=code',runScripts:'outside-only'}),s=surveyDom.window;
 let fail=true,submitted;
 s.APP_CONFIG={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_test'};s.supabase={createClient:()=>({rpc:async(name,p)=>name==='get_learner_survey'?{data:{title:'Test survey',closes_at:'2026-12-31',questions,learners:[{id:1,name:'Test Learner'}]}}:fail?{error:{message:'Temporary test error'}}:(submitted=p,{data:{submitted:true,already_submitted:false}})})};
 s.eval(fs.readFileSync('survey.js','utf8'));await wait(()=>!s.document.querySelector('#survey-card').hidden);
 assert.equal(s.document.querySelectorAll('.question').length,13);assert.equal(s.document.querySelector('#student').value,'1');
 for(const q of questions){if(q.type==='rating')s.document.querySelector(`input[name="${q.id}"][value="4"]`).checked=true;else s.document.querySelector(`[name="${q.id}"]`).value='Test learner feedback'}
 s.document.querySelector('#survey-form').dispatchEvent(new s.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>s.document.querySelector('#survey-message').textContent.includes('Temporary test error'));
 assert.equal(s.document.querySelector('[name="likes"]').value,'Test learner feedback');
 fail=false;s.document.querySelector('#survey-form').dispatchEvent(new s.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!s.document.querySelector('#survey-success').hidden);
 assert.equal(submitted.p_student,1);assert.equal(submitted.p_answers.netacad,4);assert.equal(submitted.p_code,'code');
 surveyDom.window.close();console.log('PASS: ten module forms, edit version, campaign creation, named responses, follow-up action, closing, learner survey and retry');
})().catch(e=>{console.error(e);process.exit(1)});
