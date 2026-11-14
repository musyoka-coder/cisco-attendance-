const appDb=window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL,window.APP_CONFIG.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi'}).format(new Date());
let appState={centres:[],learners:[],records:[],surveys:[],invites:[],responses:[],tab:'overview',editing:null,user:null,loading:false,selectedSurvey:null,reports:[],context:null};
function notify(text,error=false){$('message').textContent=text;$('message').className=error?'error':'success';}
async function pageAll(makeQuery){const result=[];for(let offset=0;;offset+=1000){const{data,error}=await makeQuery().range(offset,offset+999);if(error)throw error;result.push(...data);if(data.length<1000)return result;}}
const centreId=()=>Number($('centre').value),year=()=>Number($('year').value);
const centreName=()=>appState.centres.find(c=>c.id===centreId())?.name||'';
const learnerName=id=>appState.learners.find(s=>s.id===id)?.full_name||'Group / not linked';
const periodRecords=()=>appState.records.filter(r=>r.record_date>=$('from').value&&r.record_date<=$('to').value);
const completed=r=>['completed','submitted','reviewed','resolved'].includes(r.status);
function safeLink(url,label='Open evidence'){try{const u=new URL(url);return u.protocol==='https:'?`<a href="${h(u.href)}" target="_blank" rel="noopener noreferrer">${h(label)}</a>`:''}catch{return ''}}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>'<tr>'+row.map(value=>`<td>${value}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${headers.length}" class="empty">No records for this selection.</td></tr>`}</tbody></table></div>`;}
function moduleNavigation(){
 $('navigation').innerHTML=[['overview','Overview'],['surveys','Learner surveys'],...Object.entries(APPRAISAL_MODULES).map(([key,value])=>[key,value.label])].map(([key,label])=>`<button data-tab="${key}" class="${appState.tab===key?'active':''}">${h(label)}</button>`).join('');
 $('navigation').querySelectorAll('button').forEach(button=>button.onclick=()=>{appState.tab=button.dataset.tab;if(appState.tab==='surveys')loadApp();else renderApp()});
}
async function loadApp(){
 if(appState.loading)return;appState.loading=true;appState.context=null;$('workspace').inert=true;notify('Loading records…');
 try{
  const c=centreId(),y=year();
  const [learners,records,surveys,reports]=await Promise.all([
   pageAll(()=>appDb.from('students').select('id,full_name,active').eq('centre_id',c).eq('academic_year',y).order('id')),
   pageAll(()=>appDb.from('appraisal_records').select('*').eq('centre_id',c).eq('academic_year',y).order('record_date',{ascending:false}).order('id')),
   pageAll(()=>appDb.from('learner_surveys').select('*').eq('centre_id',c).eq('academic_year',y).order('created_at',{ascending:false}).order('id')),
   pageAll(()=>appDb.from('weekly_reports').select('id,data_insights,intervention_plan').eq('centre_id',c).eq('academic_year',y).order('id'))
  ]);
  const ids=surveys.map(s=>s.id);
  const [invites,responses]=ids.length?await Promise.all([
   pageAll(()=>appDb.from('survey_invites').select('*').in('survey_id',ids).order('id')),
   pageAll(()=>appDb.from('survey_responses').select('*').in('survey_id',ids).order('submitted_at',{ascending:false}).order('id'))
  ]):[[],[]];
  Object.assign(appState,{learners,records,surveys,invites,responses,reports,context:`${c}:${y}`} );
  renderApp();notify('Records loaded.');
 }catch(error){notify('Could not load records: '+error.message,true);$('content').innerHTML='<p class="error">Records are unavailable. Refresh to retry before making changes.</p>';}
 finally{appState.loading=false;$('workspace').inert=false;}
}
function metrics(){
 const records=periodRecords().filter(r=>r.status!=='cancelled'),active=appState.learners.filter(s=>s.active),ids=new Set(active.map(s=>s.id));
 const feedback=new Set(records.filter(r=>r.kind==='feedback'&&completed(r)&&ids.has(r.student_id)).map(r=>r.student_id));
 const maintenance=records.filter(r=>r.kind==='maintenance');
 const submitted=maintenance.filter(r=>r.details.submitted_on&&['submitted','reviewed'].includes(r.status));
 const pairs=performancePairs(records.filter(completed));
 const issues=records.filter(r=>r.kind==='issue');
 const rated=appState.responses.map(r=>r.answers.satisfaction).filter(v=>typeof v==='number');
 return {records,active,feedback,maintenance,submitted,pairs,issues,rated};
}
function renderOverview(){
 const m=metrics();const pct=(n,d)=>d?Math.round(n/d*100)+'%':'No data';
 const average=m.pairs.length?(m.pairs.reduce((s,p)=>s+p.change,0)/m.pairs.length).toFixed(1)+' pp':'No paired scores';
 const cards=[['Reports with data analysis',`${appState.reports.filter(r=>r.data_insights.trim()).length} / ${appState.reports.length}`,'Centre-tagged weekly reports with insights in this academic year'],['Learners',m.active.length,'Active in selected centre/year'],['Feedback coverage',pct(m.feedback.size,m.active.length),'Completed feedback / active learners; target 90%'],['Maintenance logs submitted',`${m.submitted.length} / ${m.maintenance.length}`,'Submitted / planned logs entered; target all required logs'],['Revision sessions',m.records.filter(r=>r.kind==='intervention'&&completed(r)).length,'Completed sessions; appraisal target at least 5'],['Performance change',average,'Mean paired learner-topic change; percentage points'],['Survey response rate',pct(appState.responses.length,appState.invites.length),'Responses / invitations across this year’s campaigns; target 70%'],['Learner satisfaction',pct(m.rated.filter(v=>v>=4).length,m.rated.length),'Agree / strongly agree among numeric satisfaction answers'],['Feedback issues resolved',`${m.issues.filter(r=>r.status==='resolved').length} / ${m.issues.length}`,'Resolution requires recorded action and evidence']];
 const overdue=m.records.filter(r=>r.due_date&&r.due_date<today()&&!completed(r));
 $('content').innerHTML=`<h2>Evidence overview</h2><p class="muted">${h(centreName())} · ${year()} · Records dated ${h($('from').value)} to ${h($('to').value)}. Survey metrics cover all campaigns in the selected academic year.</p><div class="metrics">${cards.map(([label,value,detail])=>`<div class="metric">${h(label)}<strong>${h(value)}</strong><span>${h(detail)}</span></div>`).join('')}</div><p class="small muted">These are evidence indicators, not an automatic appraisal grade. Enter every required maintenance log to make the denominator meaningful. Score comparisons must use comparable assessments.</p>
 <div class="card"><h3>Overdue work</h3>${table(['Task','Module','Due','Action'],overdue.map(r=>[h(r.title),h(APPRAISAL_MODULES[r.kind].label),h(r.due_date),`<button data-edit="${r.id}">Update</button>`]))}</div>
 <div class="card"><h3>Learner progress and learning gaps</h3><p>Baseline and latest follow-up for each learner/topic. Missing pairs remain unmeasured.</p>${table(['Learner','Topic','Baseline','Follow-up','Change','Action'],m.pairs.map(p=>[h(learnerName(p.student_id)),h(p.topic),p.before.toFixed(1)+'%',p.after.toFixed(1)+'%',p.change.toFixed(1)+' pp',`<button data-intervene="${p.student_id}" data-topic="${h(p.topic)}">Plan support</button>`]))}</div>
 <div class="card"><h3>Latest assessments needing attention</h3><p>Practice or assessment results below 60%. This is a review prompt, not a diagnosis.</p>${table(['Learner','Topic','Score','Gap','Action'],m.records.filter(r=>r.kind==='assessment'&&completed(r)&&Number(r.details.score)/Number(r.details.maximum)<.6).slice(0,30).map(r=>[h(learnerName(r.student_id)),h(r.details.topic),h(r.details.score)+' / '+h(r.details.maximum),h(r.details.gap),`<button data-intervene="${r.student_id}" data-topic="${h(r.details.topic)}">Plan support</button>`]))}</div>
 <div class="card"><h3>Evidence workflow</h3><p><a href="index.html">Open the attendance register</a> → Weekly reports to record data insights and intervention plans alongside your report.</p><p>Record assessments and feedback → plan support → record follow-up results → document teaching impact → export a management submission → record the manager’s response.</p><p>Use Skills development for networking practice, and Planner for deadlines. Submitted work and staff review dates remain separate from when a record was entered.</p></div>`;
 bindRecordButtons();
 $('content').querySelectorAll('[data-intervene]').forEach(button=>button.onclick=()=>openRecord('intervention',null,{student_id:Number(button.dataset.intervene),title:'Support: '+button.dataset.topic,details:{gap:button.dataset.topic}}));
}
function renderRecords(kind){
 const config=APPRAISAL_MODULES[kind],rows=periodRecords().filter(r=>r.kind===kind);
 $('content').innerHTML=`<h2>${h(config.label)}</h2><p class="muted">${h(config.intro)}</p><div class="actions"><button id="new-record">Add ${kind==='equipment'?'equipment':'record'}</button><button id="export-records" class="secondary">Download CSV</button></div><div class="card">${table(['Date','Title / learner','Status','Due','Evidence','Actions'],rows.map(r=>[h(r.record_date),`<strong>${h(r.title)}</strong>${r.student_id?'<br>'+h(learnerName(r.student_id)):''}`,`<span class="badge">${h(STATUS_LABELS[r.status])}</span>`,h(r.due_date||'—'),r.evidence_url?safeLink(r.evidence_url):'—',`<button data-edit="${r.id}">Edit</button> <button class="secondary" data-view="${r.id}">View / history</button> <button class="secondary" data-print="${r.id}">Print</button>`]))}</div>`;
 $('new-record').onclick=()=>openRecord(kind);$('export-records').onclick=()=>downloadCsv(kind+'.csv',[['Date','Module','Title','Learner','Status','Due','Details','Notes','Evidence','Created','Updated'],...rows.map(r=>[r.record_date,config.label,r.title,r.student_id?learnerName(r.student_id):'',r.status,r.due_date,JSON.stringify(r.details),r.notes,r.evidence_url,r.created_at,r.updated_at])]);bindRecordButtons();
}
function bindRecordButtons(){
 $('content').querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{const r=appState.records.find(r=>r.id===button.dataset.edit);openRecord(r.kind,r)});
 $('content').querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>viewRecord(button.dataset.view));
 $('content').querySelectorAll('[data-print]').forEach(button=>button.onclick=()=>printRecords([appState.records.find(r=>r.id===button.dataset.print)]));
}
function field(name,label,type,value='',required=false,options=[]){
 const attr=`name="${h(name)}" ${required?'required':''}`;let control;
 if(type==='textarea')control=`<textarea ${attr} maxlength="5000">${h(value)}</textarea>`;
 else if(type==='select')control=`<select ${attr}>${options.map(option=>{const [v,l]=Array.isArray(option)?option:[option,String(option).replace(/_/g,' ')];return `<option value="${h(v)}" ${String(value)===String(v)?'selected':''}>${h(l)}</option>`}).join('')}</select>`;
 else if(type==='learners')control=`<select ${attr} multiple>${appState.learners.filter(s=>s.active).map(s=>`<option value="${s.id}" ${(value||[]).includes(s.id)?'selected':''}>${h(s.full_name)}</option>`).join('')}</select><span class="small muted">Select all learners who participated. On a computer, hold Ctrl / Command for multiple names.</span>`;
 else control=`<input ${attr} type="${h(type)}" value="${h(value)}" ${type==='number'?'min="0" max="100000" step="0.01"':type==='text'?'maxlength="500"':''}>`;
 return `<label class="${type==='textarea'||type==='learners'?'wide':''}">${h(label)}${required?' *':''}${control}</label>`;
}
function openRecord(kind,existing=null,preset={}){
 if(appState.context!==`${centreId()}:${year()}`){notify('Refresh this register before adding or editing evidence.',true);return;}
 const config=APPRAISAL_MODULES[kind],record=existing||{...preset,kind,record_date:year()===Number(today().slice(0,4))?today():`${year()}-01-01`,status:'planned',details:preset.details||{}};
 appState.editing={kind,id:existing?.id,version:existing?.version};$('editor-title').textContent=(existing?'Edit ':'Add ')+config.label.toLowerCase();
 const learners=[['','Group / not linked'],...appState.learners.map(s=>[s.id,s.full_name])];
 const related=[['','None'],...appState.records.filter(r=>r.id!==existing?.id&&r.status!=='cancelled').map(r=>[r.id,APPRAISAL_MODULES[r.kind].label+': '+r.title])];
 $('record-fields').innerHTML=field('title','Title','text',record.title||'',true)+field('record_date','Date of activity','date',record.record_date,true)+field('due_date','Due date','date',record.due_date||'')+field('status','Status','select',record.status,true,Object.entries(STATUS_LABELS))+field('student_id','Learner','select',record.student_id||'',!!config.learner,learners)+field('related_id','Linked evidence / teaching record','select',record.related_id||'',false,related)+config.fields.map(([name,label,type,required,options])=>field('detail_'+name,label,type,record.details[name]??'',required,options)).join('')+field('notes','Additional notes','textarea',record.notes||'')+field('evidence_url','Evidence link (HTTPS document, image or report)','url',record.evidence_url||'');
 $('form-message').textContent='';$('editor').showModal();
}
async function saveRecord(event){
 event.preventDefault();const button=$('save-record');button.disabled=true;$('form-message').textContent='Saving…';
 try{
  const form=new FormData(event.target),edit=appState.editing,config=APPRAISAL_MODULES[edit.kind],details={};
  config.fields.forEach(([name,,type])=>{const value=form.get('detail_'+name);details[name]=type==='learners'?form.getAll('detail_'+name).map(Number):type==='number'?(value===''?null:Number(value)):String(value||'').trim()});
  const record={centre_id:centreId(),academic_year:year(),kind:edit.kind,title:String(form.get('title')).trim(),record_date:form.get('record_date'),due_date:form.get('due_date')||null,status:form.get('status'),student_id:form.get('student_id')?Number(form.get('student_id')):null,related_id:form.get('related_id')||null,details,notes:String(form.get('notes')||'').trim(),evidence_url:String(form.get('evidence_url')||'').trim()};
  if(Number(record.record_date.slice(0,4))!==year())throw Error('The activity date must be in the selected academic year.');
  if(record.evidence_url&&new URL(record.evidence_url).protocol!=='https:')throw Error('Evidence links must use HTTPS.');
  if(edit.kind==='assessment'&&(details.maximum<=0||details.score<0||details.score>details.maximum))throw Error('Score must be between zero and the maximum.');
  if(edit.kind==='maintenance'&&['submitted','reviewed'].includes(record.status)&&!details.submitted_on)throw Error('Record the actual submission date.');
  if(edit.kind==='submission'&&['submitted','reviewed'].includes(record.status)&&!details.submitted_on)throw Error('Record the actual submission date. Saving does not send the proposal.');
  if(edit.kind==='issue'&&record.status==='resolved'&&(!details.discussion_on||!details.resolution))throw Error('Record the discussion date and resolution.');
  const query=edit.id?appDb.from('appraisal_records').update(record).eq('id',edit.id).eq('version',edit.version):appDb.from('appraisal_records').insert(record);
  const{data,error}=await query.select('id');if(error)throw error;if(!data?.length)throw Error('This record changed in another session. Refresh and reopen it before editing.');
  $('editor').close();await loadApp();notify('Record saved with an audit entry.');
 }catch(error){$('form-message').textContent=error.message;}finally{button.disabled=false;}
}
function recordHtml(record){
 const config=APPRAISAL_MODULES[record.kind];return `<article><h2>${h(record.title)}</h2><p>${h(config.label)} · ${h(record.record_date)} · ${h(STATUS_LABELS[record.status])}</p><p>Learner: ${h(record.student_id?learnerName(record.student_id):'Group / not linked')} · Due: ${h(record.due_date||'Not set')}</p>${config.fields.map(([name,label,type])=>`<p><strong>${h(label)}:</strong><br><span class="answer">${h(type==='learners'?(record.details[name]||[]).map(learnerName).join(', '):record.details[name]??'—')}</span></p>`).join('')}<p><strong>Notes:</strong><br><span class="answer">${h(record.notes)}</span></p>${record.evidence_url?'<p>Evidence: '+safeLink(record.evidence_url,record.evidence_url)+'</p>':''}<p class="small">Recorded: ${h(record.created_at)} · Last edited: ${h(record.updated_at)} · Version ${record.version}</p></article>`;
}
async function viewRecord(id){
 const record=appState.records.find(r=>r.id===id);$('viewer-content').innerHTML=recordHtml(record)+'<p id="history-status">Loading history…</p>';$('viewer').showModal();
 try{const history=await pageAll(()=>appDb.from('appraisal_history').select('*').eq('record_id',id).order('changed_at',{ascending:false}).order('id'));$('history-status').outerHTML='<h3>Audit history</h3>'+history.map(row=>`<details><summary>${h(row.changed_at)} · ${h(row.action)} · ${h(row.actor_id)}</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${h(JSON.stringify({before:row.before_value,after:row.after_value},null,2))}</pre></details>`).join('');}catch(error){$('history-status').textContent='History unavailable: '+error.message;}
}
function printRecords(records){$('print-view').innerHTML=`<h1>Cisco training evidence</h1><p>${h(centreName())} · ${year()} · Generated ${h(today())}</p>`+records.map(recordHtml).join('<hr>');window.print();}
function exportAppraisal(){
 const m=metrics();$('print-view').innerHTML=`<h1>Cisco appraisal evidence report</h1><p>${h(centreName())} · ${year()} · ${h($('from').value)} to ${h($('to').value)}</p><p>Generated ${h(today())}. Evidence summary, not an official performance rating.</p><p>Active learners: ${m.active.length}. Learners with completed feedback: ${m.feedback.size}. Submitted maintenance logs: ${m.submitted.length} of ${m.maintenance.length} entered. Completed revision sessions: ${m.records.filter(r=>r.kind==='intervention'&&completed(r)).length}.</p><h2>Performance comparisons</h2>${table(['Learner','Topic','Baseline','Follow-up','Change (percentage points)'],m.pairs.map(p=>[h(learnerName(p.student_id)),h(p.topic),p.before.toFixed(1)+'%',p.after.toFixed(1)+'%',p.change.toFixed(1)]))}<h2>Surveys</h2><p>${appState.responses.length} responses from ${appState.invites.length} invitations across the selected academic year. Raw named responses are excluded from this summary.</p><h2>Evidence records</h2>`+m.records.map(recordHtml).join('<hr>');window.print();
}
function downloadCsv(filename,rows){const blob=new Blob(['\ufeff'+safeCsv(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function surveyLink(survey,invite){const url=new URL('survey.html',location.href);const params=new URLSearchParams({survey:survey.token});if(invite){params.set('learner',invite.student_id);params.set('code',invite.access_code)}url.hash=params.toString();return url.href;}
async function copyValue(value){try{await navigator.clipboard.writeText(value);notify('Link copied.');}catch{$('viewer-content').innerHTML='<h2>Copy this link</h2><textarea readonly id="copy-fallback">'+h(value)+'</textarea>';$('viewer').showModal();$('copy-fallback').select();}}
function renderSurveys(){
 $('content').innerHTML=`<h2>Learner surveys</h2><p>Named feedback on NetAcad, practical work and teaching. Personal links include a learner’s access code. Share each personal link only with that learner. A class link requires name selection and the learner’s separate code.</p><div class="card"><h3>Create a survey</h3><form id="create-survey" class="grid"><label>Survey title<input name="title" required minlength="2" maxlength="150" value="${h(centreName())} Cisco learner feedback"></label><label>Closing date (end of day, Kenya time)<input name="closes" type="date" min="${today()}" required></label><div><button id="create-survey-button">Create survey and learner links</button></div></form><p class="small muted">Snapshots the current active learner list. Add all learners before creating a survey. Questions are fixed for each published survey.</p><details><summary>Preview sample questions</summary><ol><li>Understanding Cisco NetAcad topics</li><li>Confidence performing practical tasks</li><li>Clarity of explanations and teacher competence</li><li>Help when struggling, time to practise and useful feedback</li><li>Fairness, respect and overall satisfaction</li><li>What learners like, dislike, find difficult and want improved</li></ol><p>Ratings are 1–5 with “Not sure / not applicable”. Written questions are optional.</p></details></div><div class="card">${table(['Survey','Closes','Responses','Status','Actions'],appState.surveys.map(s=>{const total=appState.invites.filter(i=>i.survey_id===s.id).length,count=appState.responses.filter(r=>r.survey_id===s.id).length;return [h(s.title),h(new Date(s.closes_at).toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi'})),`${count} / ${total}`,s.is_open&&new Date(s.closes_at)>new Date()?'Open':'Closed',`<button data-survey="${s.id}">View answers & links</button>`]}))}</div><section id="survey-details"></section>`;
 $('create-survey').onsubmit=async event=>{event.preventDefault();const button=$('create-survey-button');button.disabled=true;try{const form=new FormData(event.target);const{data,error}=await appDb.rpc('create_learner_survey',{p_centre:centreId(),p_year:year(),p_title:String(form.get('title')).trim(),p_closes:form.get('closes')+'T23:59:59+03:00'});if(error)throw error;appState.selectedSurvey=data;await loadApp();notify('Survey created. Personal links are ready to share.');}catch(error){notify(error.message,true)}finally{button.disabled=false}};
 $('content').querySelectorAll('[data-survey]').forEach(button=>button.onclick=()=>{appState.selectedSurvey=button.dataset.survey;renderSurveyDetails()});
 if(appState.selectedSurvey)renderSurveyDetails();
}
function renderSurveyDetails(){
 const survey=appState.surveys.find(s=>s.id===appState.selectedSurvey);if(!survey)return;
 const invites=appState.invites.filter(i=>i.survey_id===survey.id),responses=appState.responses.filter(r=>r.survey_id===survey.id),byStudent=new Map(responses.map(r=>[r.student_id,r]));
 const ratingRows=survey.questions.filter(q=>q.type==='rating').map(q=>{const values=responses.map(r=>r.answers[q.id]).filter(v=>typeof v==='number');return [h(q.label),values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2)+' / 5':'No ratings',String(values.length),String(responses.length-values.length)]});
 $('survey-details').innerHTML=`<div class="card"><h3>${h(survey.title)}</h3><div class="actions"><button id="copy-class-link" class="secondary">Copy class link</button><button id="export-invites" class="secondary">Download personal links</button><button id="export-answers" class="secondary">Download responses</button>${survey.is_open?'<button id="close-survey" class="secondary">Close survey</button>':''}</div><p>Personal links are confidential. Response rate: ${responses.length} / ${invites.length}${invites.length?' ('+Math.round(responses.length/invites.length*100)+'%)':''}.</p><h3>Question summary</h3>${table(['Question','Mean rating','Rated','Not sure / not applicable'],ratingRows)}<h3>Learner links and submissions</h3>${table(['Learner','Status','Actions'],invites.map(i=>[h(i.learner_name),byStudent.has(i.student_id)?'Submitted':'Awaiting response',`<button class="secondary" data-copy-invite="${i.id}">Copy personal link</button>${byStudent.has(i.student_id)?` <button data-response="${byStudent.get(i.student_id).id}">Read answers</button>`:''}`]))}<div id="response-view"></div></div>`;
 $('copy-class-link').onclick=()=>copyValue(surveyLink(survey));
 $('export-invites').onclick=()=>downloadCsv('survey-personal-links.csv',[['Learner','Personal survey link','Access code'],...invites.map(i=>[i.learner_name,surveyLink(survey,i),i.access_code])]);
 $('export-answers').onclick=()=>downloadCsv('survey-responses.csv',[['Learner','Submitted',...survey.questions.map(q=>q.label)],...responses.map(r=>[invites.find(i=>i.student_id===r.student_id)?.learner_name,r.submitted_at,...survey.questions.map(q=>r.answers[q.id]??'')])]);
 if($('close-survey'))$('close-survey').onclick=async()=>{if(!confirm('Close this survey? Learners will no longer be able to submit.'))return;try{const{error}=await appDb.rpc('close_learner_survey',{p_survey:survey.id});if(error)throw error;await loadApp();notify('Survey closed. Saved responses remain available.');}catch(error){notify(error.message,true)}};
 $('survey-details').querySelectorAll('[data-copy-invite]').forEach(button=>button.onclick=()=>copyValue(surveyLink(survey,invites.find(i=>i.id===button.dataset.copyInvite))));
 $('survey-details').querySelectorAll('[data-response]').forEach(button=>button.onclick=()=>{
  const response=responses.find(r=>r.id===button.dataset.response),invite=invites.find(i=>i.student_id===response.student_id);
  $('response-view').innerHTML=`<h3>Answers: ${h(invite.learner_name)}</h3><p class="small">Submitted ${h(response.submitted_at)}</p>${survey.questions.map(q=>`<p><strong>${h(q.label)}</strong><br><span class="answer">${h(response.answers[q.id]==='na'?'Not sure / not applicable':response.answers[q.id]??'No answer')}</span></p>`).join('')}<button id="survey-followup">Create follow-up action</button>`;
  $('survey-followup').onclick=()=>openRecord('issue',null,{student_id:response.student_id,title:'Survey follow-up: '+invite.learner_name,details:{source:survey.title+' / response '+response.id,action:[response.answers.improve,response.answers.difficult_topics,response.answers.suggestions].filter(Boolean).join('\n')}});
 });
}
function renderApp(){moduleNavigation();if(appState.tab==='overview')renderOverview();else if(appState.tab==='surveys')renderSurveys();else renderRecords(appState.tab);}
async function startApp(){
 try{
  const{data:{session},error}=await appDb.auth.getSession();if(error)throw error;
  if(!session){$('login').hidden=false;notify('Sign in to manage appraisal evidence and survey responses.');return;}
  appState.user=session.user;
  const{data:staff,error:staffError}=await appDb.from('appraisal_staff').select('user_id').eq('user_id',session.user.id);if(staffError)throw staffError;
  if(!staff?.length)throw Error('This account does not have staff access to appraisal records.');
  appState.centres=await pageAll(()=>appDb.from('centres').select('id,name').order('id'));
  $('centre').innerHTML=appState.centres.map(c=>`<option value="${c.id}">${h(c.name)}</option>`).join('');
  const current=Math.max(2026,Math.min(2100,Number(today().slice(0,4))));
  $('year').innerHTML=Array.from({length:75},(_,i)=>2026+i).map(y=>`<option ${y===current?'selected':''}>${y}</option>`).join('');
  $('from').value=`${current}-01-01`;$('to').value=`${current}-12-31`;
  $('login').hidden=true;$('workspace').hidden=false;await loadApp();
  if(!appState.realtime&&appDb.channel){
   const changed=()=>{notify('New evidence or survey responses received. Refresh to view the latest records.');if(appState.tab==='overview'&&!$('editor').open&&!$('viewer').open)loadApp();};
   appState.realtime=appDb.channel('appraisal-live').on('postgres_changes',{event:'*',schema:'public',table:'appraisal_records'},changed).on('postgres_changes',{event:'INSERT',schema:'public',table:'survey_responses'},changed).subscribe();
  }
 }catch(error){notify(error.message,true);}
}
$('record-form').onsubmit=saveRecord;
$('cancel-editor').onclick=()=>$('editor').close();$('close-viewer').onclick=()=>$('viewer').close();
$('centre').onchange=()=>{appState.selectedSurvey=null;loadApp()};
$('year').onchange=()=>{$('from').value=`${year()}-01-01`;$('to').value=`${year()}-12-31`;appState.selectedSurvey=null;loadApp()};
['from','to'].forEach(id=>$(id).onchange=()=>{if($('from').value>$('to').value){notify('Start date must be before the end date.',true);return}renderApp()});
$('refresh').onclick=loadApp;$('export-all').onclick=exportAppraisal;
$('login-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const data=new FormData(event.target);const{error}=await appDb.auth.signInWithPassword({email:data.get('email'),password:data.get('password')});if(error)throw error;await startApp();}catch(error){notify(error.message,true)}finally{button.disabled=false}};
$('signout').onclick=async()=>{const{error}=await appDb.auth.signOut();if(error){notify(error.message,true);return}location.href='index.html'};
appDb.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){$('workspace').hidden=true;$('login').hidden=false;appState.records=[];appState.responses=[];appState.invites=[];$('content').replaceChildren();notify('Signed out.')}});
startApp();
