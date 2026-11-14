const APPRAISAL_MODULES = {
 equipment:{label:'Equipment',intro:'Maintain an equipment inventory and link maintenance to its asset tag.',fields:[['asset_tag','Asset tag / inventory number','text',true],['model','Make and model','text'],['serial','Serial number','text'],['location','Room / location','text'],['condition','Condition','select',false,['working','needs_repair','out_of_service']]]},
 maintenance:{label:'Maintenance logs',intro:'Plan daily or weekly checks. Record work, evidence and the actual submission date separately.',fields:[['asset','Equipment / asset tag','text',true],['frequency','Log frequency','select',true,['daily','weekly','preventive','repair']],['diagnosis','Fault or inspection findings','textarea'],['action','Action taken','textarea'],['downtime_hours','Downtime hours','number'],['submitted_on','Date submitted','date'],['recipient','Submitted to','text']]},
 assessment:{label:'Assessments',intro:'Record comparable baseline and follow-up scores against the same topic. Improvement is shown in percentage points.',learner:true,fields:[['topic','NetAcad topic / practical skill','text',true],['phase','Assessment stage','select',true,['baseline','follow_up','practice']],['score','Score achieved','number',true],['maximum','Maximum score','number',true],['practical','Assessment type','select',true,['practical','theory']],['gap','Observed learning gap','textarea']]},
 feedback:{label:'Learner feedback',intro:'Record individual feedback, an agreed action and a review date. Coverage counts distinct learners.',learner:true,fields:[['feedback','Feedback given','textarea',true],['next_step','Agreed next step','textarea',true],['review_on','Follow-up date','date'],['outcome','Follow-up outcome','textarea']]},
 intervention:{label:'Revision & interventions',intro:'Identify the learning gap, plan support, then document participation and the outcome.',fields:[['gap','Learning gap / reason for support','textarea',true],['strategy','Revision or intervention plan','textarea',true],['participants','Learners who attended / will attend','learners'],['hours','Session duration in hours','number'],['outcome','Result and next action','textarea']]},
 teaching:{label:'Teaching impact',intro:'Document the teaching method, supporting data and reflection. Link assessments to this record to measure impact.',fields:[['method','Teaching approach used','textarea',true],['topic','Topic / skill','text',true],['baseline','Starting problem / baseline evidence','textarea'],['engagement','Participation and engagement evidence','textarea'],['reflection','What worked, what did not, and why','textarea'],['next_step','Changes for the next lesson','textarea']]},
 submission:{label:'Management submissions',intro:'Prepare an evidence-backed proposal. Export it, submit it through your normal channel, then record feedback here. Saving does not send it.',fields:[['recipient','Manager / senior officer','text',true],['proposal','Methodology / proposal summary','textarea',true],['submitted_on','Actual submission date','date'],['channel','Submission channel','select',false,['email','meeting','document','other']],['management_feedback','Management feedback','textarea'],['decision','Decision','select',false,['pending','changes_requested','pilot_approved','adopted','declined']]]},
 issue:{label:'Feedback actions',intro:'Turn survey concerns and other feedback into owned actions, discussion records and verified resolutions.',fields:[['source','Source (survey, learner, meeting)','text'],['owner','Person responsible','text',true],['discussion_on','Date discussed','date'],['action','Agreed action','textarea',true],['resolution','Resolution and evidence','textarea']]},
 development:{label:'Skills development',intro:'Track networking practice, professional learning and evidence of competence.',fields:[['topic','Skill / course','text',true],['practice','Practical exercise / configuration','textarea'],['hours','Training hours','number'],['result','Test results / learning outcome','textarea'],['verified_by','Reviewed by','text'],['shared_on','Date shared with team','date']]},
 task:{label:'Planner',intro:'Plan work with deadlines, ownership and completion evidence. Overdue work appears on the overview.',fields:[['owner','Person responsible','text',true],['action','Required action','textarea',true],['completed_on','Actual completion date','date']]}
};
const STATUS_LABELS={planned:'Planned',in_progress:'In progress',completed:'Completed',submitted:'Submitted',reviewed:'Reviewed',resolved:'Resolved',cancelled:'Cancelled'};
function performancePairs(records){
 const groups=new Map();
 records.filter(r=>r.kind==='assessment'&&r.status!=='cancelled').forEach(r=>{
  const key=r.student_id+'|'+String(r.details.topic).trim().toLowerCase();
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
 });
 const pairs=[];
 groups.forEach(rows=>{
  rows.sort((a,b)=>a.record_date.localeCompare(b.record_date)||a.created_at.localeCompare(b.created_at));
  const base=rows.find(r=>r.details.phase==='baseline');
  const follow=rows.filter(r=>r.details.phase==='follow_up'&&base&&r.record_date>=base.record_date).at(-1);
  if(base&&follow&&Number(base.details.maximum)>0&&Number(follow.details.maximum)>0){
   const before=Number(base.details.score)/Number(base.details.maximum)*100,after=Number(follow.details.score)/Number(follow.details.maximum)*100;
   pairs.push({student_id:base.student_id,topic:base.details.topic,before,after,change:after-before});
  }
 });return pairs;
}
function safeCsv(rows){return rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
if(typeof module!=='undefined')module.exports={APPRAISAL_MODULES,performancePairs,safeCsv};
