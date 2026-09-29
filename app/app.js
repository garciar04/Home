'use strict';
/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const fmtD=(s,o={weekday:'short',month:'short',day:'numeric'})=>parse(s).toLocaleDateString('en-US',o);
const qd=new URLSearchParams(location.search).get('date');
const TODAY=qd||iso(new Date());
const START=PLAN[0].d,END=PLAN[PLAN.length-1].d,RACE='2027-01-23';
const daysBetween=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
const secs=t=>{if(t===''||t==null)return null;const p=String(t).trim().split(':').map(Number);if(p.some(isNaN))return null;
  if(p.length===1)return p[0]*60;if(p.length===2)return p[0]*60+p[1];return p[0]*3600+p[1]*60+p[2]};
const fmtT=s=>{if(s==null||!isFinite(s))return'–';s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}:${pad(m)}:${pad(s%60)}`:`${m}:${pad(s%60)}`};
const num=v=>{const n=parseFloat(v);return isNaN(n)?null:n};
const r1=n=>Math.round(n*10)/10;
const isRun=e=>/Run|Gate|Ladder|RACE/.test(e.s);

/* ---------- state ---------- */
const KEY='50k-trainer-v1';
let S;
try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
S=Object.assign({log:{},shoePrior:{},gear:{},race:{},gate:{},ladder:{},selfcheck:{},weight:{},strength:[],episodes:[],paces:{},set:{goalH:6.25,carb:60,ml:500}},S||{});
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const byDate={};PLAN.forEach(p=>byDate[p.d]=p);
const clampDate=d=>d<START?START:d>END?END:d;
let tab='today',sel=clampDate(TODAY);

/* ---------- static plan data (from the workbook) ---------- */
const PH=['','Recovery & Gate','Rebuild Base','Build','Ultra-Specific','Peak & Rehearsal','Taper & Race'];
const ZONES={Recovery:['12:30','13:30','<140','Sunday recovery runs, return ladder'],Easy:['11:45','12:45','≤145','Tue/Thu easy runs. Garmin HR alert at 145'],
 'Long run':['12:00','13:00','≤145','Saturday. Walk breaks encouraged'],'Steady / 50K effort':['11:30','12:15','145–152','Middle miles of Thursday steady runs (week 7+)']};
const ZONE_FOR={'Easy Run':'Easy','Recovery Run':'Recovery','Long Run':'Long run','Long Run (B2B)':'Long run','Steady Run':'Steady / 50K effort'};
const SHOES=[['Novablast 6 (old, trusted)','Easy + long runs until next shoe is broken in. Race backup.',0,400],['Novablast 6 (NEW)','Short easy runs only, or retire. Implicated on 25 Sep.',30.2,400],
 ['Gel Nimbus','Recovery runs, treadmill.',8,450],['Next shoe (post gait analysis)','Break in from week 6; race shoe if 100+ easy miles by week 13.',0,400]];
const EX={
A:[['Bench press','4 x 6-8','RPE 7-8'],['Barbell/seated cable row','4 x 8-10','RPE 7'],['Overhead press','3 x 8','RPE 7 (do first if needed)'],['Lat pulldown / pull-up','3 x 8-10','RPE 7'],['Face pulls','3 x 12-15','Light'],
 ['Clamshells','2 x 15/side','Light band, knees stacked'],['Side-lying abduction','2 x 15/side','Leg slightly behind, no swinging'],['Monster walks','2 x 10 each way','Band above knees, stay low']],
BA:[['Glute bridge → single-leg','3 x 12 → 3 x 10/side','Bodyweight'],['Terminal knee extension (band)','3 x 15/side','Squeeze the quad'],['Step-up (6-8 in)','3 x 10/side','Knee over 2nd toe'],
 ['Eccentric calf raise','3 x 12','3-sec lower, straight + bent knee'],['Standing hip hike','2 x 12/side','Trains cambered-road control'],['Single-leg balance','3 x 30 s/side','Progress to eyes closed']],
BB:[['Bulgarian split squat','3 x 8/side','DB, RPE 7 — main lift'],['Step-down (6-8 in)','3 x 10/side','3-sec lower; stop if outer-knee pull'],['DB Romanian deadlift','3 x 10','RPE 6-7'],
 ['Goblet box squat','3 x 10','Pain-free depth only'],['Weighted eccentric calf raise','3 x 12','Anti-cramp lever'],['Copenhagen plank (short)','3 x 20 s/side','Knee on bench'],['Pallof press','3 x 12/side','Loaded-vest base']],
BC:[['Bulgarian split squat','2 x 8/side','RPE 6'],['Step-down','2 x 10/side','Bodyweight'],['DB RDL','2 x 10','RPE 6'],['Eccentric calf raise','2 x 12','Bodyweight'],['Side plank','2 x 30 s/side','Bodyweight']],
CORE:[['Plank','3 x 30-60 s','Build to 60'],['Side plank','2 x 20-30 s/side','Glute med, obliques'],['Dead bug','3 x 10/side','Low back flat'],['Bird dog','3 x 10/side',''],['Pallof press','2 x 12/side','']],
PRE:[['Clamshells','2 x 15/side',''],['Side-lying abduction','2 x 15/side',''],['Terminal knee extension','2 x 15/side','From week 2'],['Foam roll: lateral quad, TFL, glutes','60 s each','Roll around the sore spot, not on it'],['Couch stretch + 90/90','60-90 s + 8/side','Squeeze back glute']]};
const MOB={warm:'5 min dynamic: leg swings 15 each way, hip circles x10, glute bridge x10, ankle circles x10. Lunges from week 5.',
 easy:'5 min static: calf, quad, hamstring, figure-4 glute — 45 s each side.',
 long:'15 min: roll calves, quads, lateral quad/TFL, glutes, hamstrings (60–90 s each), static set, legs up the wall 5–10 min.',
 daily:'Couch stretch 90 s each, 90/90 x10, glute bridge x15 (2-s hold), half-kneeling hip flexor 60 s.'};
function strengthFor(p){const t=p.st;let k=null,title=t;
  if(/^Strength A/.test(t))k='A';else if(/^Strength B/.test(t)){k=/Phase A/.test(t)?'BA':/Phase B/.test(t)?'BB':/Phase C/.test(t)?'BC':null;}
  else if(/^Core/.test(t))k='PRE';else if(/^Mobility|^Roll/.test(t))k='MOBONLY';
  return{k,title}}
const LADDER=[['Easy jog test','5 × (1 min jog / 1 min walk) = 10 min','Wk2 Thu (gate test)'],['','5 × (2 min jog / 1 min walk) = 15 min','Wk2 Sat'],['','4 × (4 min jog / 1 min walk) = 20 min','Wk2 Sat if Step 2 easy'],['','20 min continuous easy','Wk3 Tue'],['','30 min continuous easy','Wk3 Thu → then follow the log']];
const GATE=['30-minute brisk walk with zero pain','Stairs up and down with zero pain','10 single-leg sit-to-stands each side, zero pain, no knee caving in'];
const SELF=['Single-leg squat to chair ×10 each side: pain? knee cave?','Stairs down, normal pace: pain?','Press outer knee + shin BONE: any sharply tender spot?','From week 5: 10 single-leg hops each side: pain?'];
const RED=['Visible swelling, or knee feels puffy/tight when bent','Locking, catching, or giving way','Pain at night/rest getting worse','One sharply tender spot on the shin bone (possible bone stress)','Pain worse this week than last despite following the rules','Limping or changing how you run to avoid it'];
const EPI=[['16 Sep','Heavy squat 225×3 + deadlift 225×5 plus a 4-mi run, 10 days before the race. → Too heavy.'],['19 Sep','Ran 8 of 10 (Gel Nimbus); kneecap "pulled down", discomfort late. → Rest + cross-train.'],['23 Sep','Tender at outer knee above joint line, no swelling. Consistent with ITB/lateral soft tissue.'],
 ['25 Sep','Solo 26.21 mi 5:46:18. New shoe + camber + one-sided carry + outside-heel strike. Knee → shin.'],['26 Sep','Worse after; knee down the shin. Pressing shin bone did NOT reproduce pain.'],['28 Sep','Feels better. Week 1, no running.']];
const GEAR=[['Gait analysis (specialty store) — ask about supination',1,6,'HIGH'],['Next pair of shoes (from fitting)',1,6,'HIGH'],['Loop resistance bands (light + medium)',1,1,'HIGH'],['Long resistance band',1,2,'HIGH'],['Headlamp',1,6,'HIGH'],['Reflective vest / clip-on lights',1,6,'HIGH'],
 ['PF 30 gels','G',8,'HIGH'],['PF Carb Only Drink Mix (bags)','B',8,'MED'],['PH 1500 tablets (tubes of 10)','T',8,'HIGH'],['Hydration vest, balanced front pockets',1,11,'HIGH'],['Soft flasks 500 ml (one insulated)',2,11,'HIGH'],['Thermal tights + base layer',1,9,'MED'],['Wind shell',1,9,'MED'],
 ['Gloves (+ spare) + hat/buff',1,9,'MED'],['Merino socks',3,9,'MED'],['Anti-chafe balm + blister kit',1,8,'HIGH'],['KT tape',1,3,'LOW'],['Foam roller',1,1,'MED'],['Pickle juice shots',3,14,'LOW'],['Phone battery pack',1,14,'MED'],['Insulated jug + base-station bag',1,14,'MED'],['Traction cleats (optional)',1,13,'LOW']];
const HIST=[['Oct 2023','Poznan Marathon','3:58:48','9:07','Marathon PR. Even pacing, no cramps — the blueprint.'],['Nov 2022','Go Nuts For Donuts','Half 1:41:23','7:44','Half PR'],['Mar 2024','Rome Marathon','4:41:09','10:43','Cramp collapse after 35K'],['2025','Bucharest Half','1:47:52','8:14','2nd fastest half'],['Aug 2026','Brooklyn Ice Cream Half','2:09:18','9:52','Current fitness; negative split'],['25 Sep 2026','Solo marathon, Prospect Park','5:46:18','13:13','Injured, shoe swap. A lesson, not a benchmark']];
const RACECHK=[['Mon 18 Jan','Walk or bike the course. Decide loop direction + base-station spot.'],['Wed 20 Jan','Weather check. Buy anything missing.'],['Thu 21 Jan','Final weather call. Charge watch, phone, battery. Share LiveTrack.'],['Fri 22 Jan','Pack base bag, pre-measure carb bags. Dinner + 4 scoops + PH 1500. No alcohol. Early bed.'],['Sat 23 Jan','Wake ~2 h pre-start. PH 1500. Fresh KT tape. Dynamic warm-up only. Flask A on the line.']];
const KEYDATES=[['2026-11-01','Clocks go back — headlamp + reflective'],['2026-11-08','Gait analysis done; next shoe breaking in'],['2026-11-26','Thanksgiving — run in the morning'],['2026-12-26','18 + 8 back-to-back'],['2027-01-02','DRESS REHEARSAL: 22 mi, full race setup'],['2027-01-23','RACE: 50K'],['2027-01-30','Backup race date'],['2027-02-01','El Paso']];
const SEGS=[['Miles 0–10',10,'12:30','Hold back hard. Feels too easy = correct.'],['Miles 10–20',10,'12:15','Settle. Knee check every pass.'],['Miles 20–26.2',6.2,'12:15','Where Rome broke. Fuel on schedule.'],['Miles 26.2–31.1',4.9,'12:30','New territory. Spend what’s left.']];

/* ---------- derived ---------- */
const L=d=>S.log[d]||{};
const actual=d=>num(L(d).mi)||0;
const shoeMiles=n=>Object.entries(S.log).reduce((a,[d,e])=>a+(e.shoe===n?(num(e.mi)||0):0),0);
function stats(){let pl=0,ac=0,lng=0,kn=0;
  PLAN.forEach(p=>{if(p.d<=TODAY)pl+=p.mi;const a=actual(p.d);ac+=a;if(a>lng)lng=a;});
  Object.values(S.log).forEach(e=>{if(num(e.knee)>2)kn++});
  return{pl,ac,lng,kn,total:PLAN.reduce((a,p)=>a+p.mi,0)}}
const wk=()=>{const p=byDate[clampDate(TODAY)];return TODAY<START?0:p.w};
const gatePassed=()=>S.gate.passed||S.ladder[1]?.pass;
function kneeAdvice(k){k=num(k);if(k==null)return null;
  if(k<=2)return['ok','0–2: continue as planned. Confirm baseline tomorrow morning.'];
  if(k===3)return['warn','3: cut the run short, skip the next Strength B, reassess next morning.'];
  return['bad','4+: stop the run. No running tomorrow. If it lasts 48 h, drop one ladder step. Rules on the Knee tab override the log.']}
function lastKnee(){const ds=Object.keys(S.log).filter(d=>S.log[d].knee!==''&&S.log[d].knee!=null&&d<=TODAY).sort();return ds.length?[ds.at(-1),num(S.log[ds.at(-1)].knee)]:null}
function fuel(){const h=S.set.goalH,c=S.set.carb,ml=S.set.ml;const tot=h*c,bot=120,gels=Math.max(0,Math.ceil((tot-bot)/30)),fl=h*ml/1000;
  let runs=0,mi=0,hrs=0;PLAN.forEach(p=>{if((p.s==='Long Run'&&p.mi>=8)||p.s==='Long Run (B2B)'){runs++;mi+=p.mi;hrs+=p.mi*12.25/60}});
  const tg=Math.ceil(Math.max(0,hrs-runs)*c/30),ts=runs*4,tp=Math.ceil(hrs*ml/500);
  return{h,tot,gels,pack:gels+2,fl,ph:Math.ceil(fl/0.5)+2,runs,mi,hrs,tg,ts,tp,G:tg+gels+2,B:Math.ceil((ts+8)/60),T:Math.ceil((tp+Math.ceil(fl/0.5)+2)/10)}}

/* ---------- ui bits ---------- */
const TABS=[['today','🏃','Today'],['plan','📅','Plan'],['progress','📈','Progress'],['knee','🦵','Knee'],['fuel','⛽','Fuel'],['race','🏁','Race'],['more','☰','More']];
function nav(){$('#nav').innerHTML=TABS.map(t=>`<button data-act="tab" data-v="${t[0]}" class="${tab===t[0]?'on':''}"><b>${t[1]}</b>${t[2]}</button>`).join('')}
function hdr(){const dr=daysBetween(TODAY,RACE);$('#hdr').innerHTML=dr>0?`<b style="font-size:16px;color:var(--ac)">${dr}</b> days to race<br>Week ${wk()||'–'} of 17`:dr===0?'<b>RACE DAY</b>':'Race done 🎉'}
function kneeBtns(v){return `<div class="knee">${[0,1,2,3,4,5,6,7,8,9,10].map(i=>`<button type="button" class="k${i} ${String(v)===String(i)?'on':''}" data-act="knee" data-v="${i}">${i}</button>`).join('')}</div>`}
const chk=(id,txt,on,act='tog',extra='')=>`<label class="chk ${on?'done':''}" style="margin:0;color:inherit;font-size:15px"><input type="checkbox" ${on?'checked':''} data-act="${act}" data-id="${esc(id)}" ${extra}><span>${txt}</span></label>`;
function exTable(rows){return `<table><tr><th>Exercise</th><th>Sets×Reps</th><th>Note</th></tr>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td><small>${esc(r[2])}</small></td></tr>`).join('')}</table>`}

/* ---------- views ---------- */
function vToday(){
  const p=byDate[sel],e=L(sel),z=ZONES[ZONE_FOR[p.s]?.replace('Long Run','Long run')]||null;
  const zn=ZONE_FOR[p.s],zone=zn&&ZONES[zn];
  const pre=TODAY<START?`<div class="alert ok"><b>Plan starts ${fmtD(START)}.</b> ${daysBetween(TODAY,START)} day(s) to go. Below is week 1 day 1.</div>`:'';
  let al='';const lk=lastKnee();
  if(lk&&lk[1]>=3&&daysBetween(lk[0],TODAY)<=2)al+=`<div class="alert ${lk[1]>=4?'bad':''}"><b>Knee ${lk[1]}/10 on ${fmtD(lk[0])}.</b> ${kneeAdvice(lk[1])[1]}</div>`;
  if(isRun(p)&&p.w>=2&&p.mi>0&&!gatePassed()&&p.s!=='RACE: 50K')al+=`<div class="alert bad"><b>Gate not passed yet.</b> No running until the Knee-tab gate is passed (zero pain during AND quiet knee next morning). Swap this for rest or cross-training and let the dates slip.</div>`;
  if(p.s==='Gate Test'||p.s==='Return Ladder')al+=`<div class="alert"><b>Feeling better ≠ clearance.</b> Do this only if the walk / stairs / sit-to-stand gate is clean. PASS = 0–2/10 during AND back to baseline tomorrow morning.</div>`;
  const s=strengthFor(p);let str='';
  if(s.k&&EX[s.k])str=`<details><summary>${esc(p.st)} — exercises</summary>${exTable(EX[s.k])}</details>`;
  if(s.k==='PRE')str+=`<details><summary>Daily hip block</summary><p>${MOB.daily}</p></details>`;
  const shoe=/Long|Steady/.test(p.s)||p.mi>=6?'old trusted Novablast (only shoe cleared for long runs)':'old trusted Novablast, or Gel Nimbus for recovery';
  let run='';
  if(isRun(p)&&p.s!=='RACE: 50K'){
    run=`<h2>Run brief</h2><div class="card">${zone?`<div class="row"><div class="stat"><b>${zone[0]}–${zone[1]}</b><span>pace /mi</span></div><div class="stat"><b>${zone[2]}</b><span>heart rate</span></div><div class="stat"><b>${r1(60/secs(zone[1])*60)}–${r1(60/secs(zone[0])*60)}</b><span>treadmill mph</span></div></div>`:''}
    <p class="sub">HR is the governor, not pace. Log the <b>treadmill display</b>, not the watch (Garmin over-reads).</p>
    <div class="chk"><span>👟 Shoe: ${shoe}</span></div>
    <div class="chk"><span>⌚ HR alert at 145 ON · ${MOB.warm}</span></div>
    ${p.d>='2026-11-01'?'<div class="chk"><span>🔦 Dark evenings: headlamp + reflective.</span></div>':''}
    ${p.mi>=8?'<div class="chk"><span>⛽ Fuel 60 g/hr: carb bottle hour 1, then gel every 30 min. Water with every gel. Nothing new.</span></div>':''}
    <div class="chk"><span>🧊 After: ${/Long/.test(p.s)?MOB.long:MOB.easy}</span></div></div>`}
  if(p.s==='RACE: 50K')run='<div class="alert ok"><b>RACE DAY.</b> See the Race tab for pacing, fuel and stop rules.</div>';
  const a=kneeAdvice(e.knee);
  const shoeOpts=['<option value="">—</option>'].concat(SHOES.map(x=>`<option ${e.shoe===x[0]?'selected':''}>${esc(x[0])}</option>`)).join('');
  const pace=e.mi&&e.time?fmtT(secs(e.time)/num(e.mi)):null;
  return `${pre}
  <div class="row" style="margin-bottom:10px;align-items:center"><button class="btn ghost" style="margin:0;flex:none;min-width:60px;width:auto" data-act="day" data-v="-1">‹</button><div style="text-align:center;flex:2"><b>${fmtD(sel,{weekday:'long',month:'long',day:'numeric'})}</b><br><span class="sub">Week ${p.w} · ${PH[p.ph]}</span></div><button class="btn ghost" style="margin:0;flex:none;min-width:60px;width:auto" data-act="day" data-v="1">›</button></div>
  ${sel!==clampDate(TODAY)?`<button class="btn ghost" style="margin:0 0 10px" data-act="gotoday">Jump to today</button>`:''}
  ${al}
  <div class="card"><span class="tag ${isRun(p)&&p.mi>0?'run':''}">${esc(p.s)}</span>${p.st!=='-'?`<span class="tag">${esc(p.st)}</span>`:''}
   <div class="row" style="margin-top:10px;align-items:end"><div><div class="big">${p.mi}<small> mi</small></div><span class="sub">planned</span></div>${e.mi!=null&&e.mi!==''?`<div><div class="big" style="color:var(--ac)">${esc(e.mi)}<small> mi</small></div><span class="sub">actual${pace?' · '+pace+'/mi':''}</span></div>`:''}</div>
   ${p.n?`<p style="margin:12px 0 0">${esc(p.n)}</p>`:''}${str}</div>
  ${run}
  <h2>Log this day</h2><div class="card"><small>Numbers only in number fields. Knee score every day, even rest days.</small>
   <div class="row"><div><label>Miles (actual)</label><input id="f_mi" type="number" step="0.01" inputmode="decimal" value="${esc(e.mi??'')}"></div><div><label>Time (h:mm:ss or mm:ss)</label><input id="f_time" value="${esc(e.time??'')}" placeholder="45:30"></div><div><label>Avg HR</label><input id="f_hr" type="number" inputmode="numeric" value="${esc(e.hr??'')}"></div></div>
   <label>Knee 0–10 ${e.knee!==''&&e.knee!=null?'':'(not logged)'}</label>${kneeBtns(e.knee)}
   ${a?`<div class="alert ${a[0]==='ok'?'ok':a[0]==='bad'?'bad':''}" style="margin:8px 0 0">${a[1]}</div>`:''}
   ${num(e.hr)>145&&/Easy|Long|Recovery/.test(p.s)?'<div class="alert" style="margin:8px 0 0"><b>HR '+esc(e.hr)+' &gt; 145.</b> Easy drift is the habit most likely to break this block: slow down, walk, or set the treadmill and don’t touch it.</div>':''}
   <label>Shoe</label><select id="f_shoe">${shoeOpts}</select>
   <label>Notes</label><textarea id="f_notes">${esc(e.notes??'')}</textarea>
   <button class="btn" data-act="savelog">Save</button></div>`}

function vPlan(){
  let h='',w=0;
  PLAN.forEach(p=>{if(p.w!==w){w=p.w;const wp=PLAN.filter(x=>x.w===w),mi=wp.reduce((a,x)=>a+x.mi,0);h+=`<h2>Wk ${w} · ${PH[p.ph]} · ${r1(mi)} mi</h2>`}
    const e=L(p.d),done=e.mi!==''&&e.mi!=null,kn=num(e.knee);
    h+=`<div class="day ${p.d===TODAY?'today':''}" data-act="open" data-v="${p.d}"><div class="dt">${p.day}<br>${fmtD(p.d,{month:'short',day:'numeric'})}</div><div><b>${esc(p.s)}</b>${p.st!=='-'?`<br><small>${esc(p.st)}</small>`:''}</div><div class="mi">${p.mi?p.mi+' mi':''}${done?`<br><small style="color:var(--ac)">✓ ${esc(e.mi)}</small>`:''}${kn>=3?`<br><small style="color:var(--bad)">knee ${kn}</small>`:''}</div></div>`});
  return `<div class="card"><h3>17-week plan</h3><span class="sub">28 Sep 2026 → race Sat 23 Jan 2027 · ${r1(stats().total)} planned miles. Tap a day to open/log it.</span></div>
  <div class="card"><b>Weekly rhythm</b><p class="sub" style="margin:4px 0">Mon Strength A · Tue easy · Wed Strength B · Thu easy/steady · Fri rest+mobility · Sat long · Sun recovery/B2B. Army drill on a long-run Saturday? Move the long run to Fri/Sun, keep a rest day beside it, never stack against Strength B.</p></div>${h}`}

function svgBars(){const W=340,H=130,bw=W/17;const mx=Math.max(...PLAN.map(x=>x.mi)); 
  const wp=Array.from({length:17},(_,i)=>PLAN.filter(x=>x.w===i+1)),pm=wp.map(a=>a.reduce((s,x)=>s+x.mi,0)),am=wp.map(a=>a.reduce((s,x)=>s+actual(x.d),0));
  const m=Math.max(...pm,...am,1);
  return `<svg viewBox="0 0 ${W} ${H+18}" width="100%">${pm.map((v,i)=>{const x=i*bw+2,hh=v/m*H;const ah=am[i]/m*H;
   return `<rect x="${x}" y="${H-hh}" width="${bw-4}" height="${hh}" rx="2" fill="var(--line)"/><rect x="${x+3}" y="${H-ah}" width="${bw-10}" height="${ah}" rx="2" fill="var(--ac)"/><text x="${x+bw/2-2}" y="${H+12}" text-anchor="middle">${i+1}</text>`}).join('')}</svg>`}
function svgKnee(){const pts=PLAN.filter(p=>L(p.d).knee!==''&&L(p.d).knee!=null).map(p=>[daysBetween(START,p.d),num(L(p.d).knee)]);if(!pts.length)return '<p class="sub">No knee scores yet.</p>';
  const W=340,H=90,X=d=>d/118*W,Y=k=>H-k/10*H;
  return `<svg viewBox="0 0 ${W} ${H+14}" width="100%"><rect x="0" y="${Y(2)}" width="${W}" height="${H-Y(2)}" fill="var(--ac)" opacity=".12"/><line x1="0" x2="${W}" y1="${Y(3)}" y2="${Y(3)}" stroke="var(--warn)" stroke-dasharray="3"/><line x1="0" x2="${W}" y1="${Y(4)}" y2="${Y(4)}" stroke="var(--bad)" stroke-dasharray="3"/>
  <polyline fill="none" stroke="var(--blue)" stroke-width="2" points="${pts.map(p=>X(p[0])+','+Y(p[1])).join(' ')}"/>${pts.map(p=>`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3" fill="${p[1]>=4?'var(--bad)':p[1]>=3?'var(--warn)':'var(--ac)'}"/>`).join('')}<text x="2" y="${H+12}">Sep 28</text><text x="${W-30}" y="${H+12}">Jan 24</text></svg>`}
function vProgress(){const st=stats(),pct=st.pl?Math.round(st.ac/st.pl*100):0;
  let rows='';for(let w=1;w<=17;w++){const a=PLAN.filter(x=>x.w===w);const pm=a.reduce((s,x)=>s+x.mi,0),am=a.reduce((s,x)=>s+actual(x.d),0);
    const ks=a.map(x=>num(L(x.d).knee)).filter(k=>k!=null),mk=ks.length?Math.max(...ks):null,ak=ks.length?r1(ks.reduce((s,x)=>s+x,0)/ks.length):null;
    const lp=Math.max(...a.map(x=>x.mi)),ld=Math.max(...a.map(x=>actual(x.d)));
    const flag=mk==null?'':mk>=4?'<span class="tag bad">STOP</span>':mk===3?'<span class="tag warn">BACK OFF</span>':'<span class="tag run">OK</span>';
    rows+=`<tr><td>${w}</td><td>${r1(pm)}</td><td>${r1(am)}</td><td>${lp}/${ld||'–'}</td><td>${ak??'–'}/${mk??'–'}</td><td>${flag}</td><td style="width:70px"><input type="number" step="0.1" data-act="wt" data-id="${w}" value="${esc(S.weight[w]??'')}" placeholder="lb" style="padding:4px"></td></tr>`}
  return `<div class="row"><div class="stat"><b>${st.pl.toFixed(0)}</b><span>planned mi to date</span></div><div class="stat"><b>${r1(st.ac)}</b><span>actual mi (${pct}%)</span></div><div class="stat"><b>${st.lng}</b><span>longest run</span></div><div class="stat"><b style="color:${st.kn?'var(--warn)':'var(--ac)'}">${st.kn}</b><span>days knee &gt;2</span></div></div>
  <h2>Weekly miles — grey planned, green actual</h2><div class="card">${svgBars()}</div>
  <h2>Knee score over time</h2><div class="card">${svgKnee()}<small>Green band 0–2 OK · amber 3 back off · red 4+ stop</small></div>
  <h2>Weekly summary</h2><div class="card" style="overflow-x:auto"><table><tr><th>Wk</th><th>Plan</th><th>Actual</th><th>Long p/a</th><th>Knee avg/max</th><th>Flag</th><th>Wt</th></tr>${rows}</table></div>`}

function vKnee(){
  const g=S.gate,lad=S.ladder;
  return `<div class="alert bad"><b>The knee decides this block, not the calendar.</b> Rules here override the Daily Log every time.</div>
  <div class="card"><h3>Pain rule (knee or shin, 0–10)</h3><table><tr><td><span class="tag run">0–2</span></td><td>Aware, not limiting → continue, log it.</td></tr><tr><td><span class="tag warn">3</span></td><td>Noticeable → cut the run short, skip next Strength B, reassess in the morning.</td></tr><tr><td><span class="tag bad">4+</span></td><td>Changes how you run → stop. No run tomorrow. If it lasts 48 h, drop a ladder step.</td></tr></table><p class="sub">Next-morning rule: knee must be back to baseline by morning or the next run becomes rest/cross-training.</p></div>
  <h2>The gate — all three before Step 1</h2><div class="card">${GATE.map((t,i)=>chk('g'+i,t,g['g'+i],'gate')).join('')}${GATE.every((_,i)=>g['g'+i])?'<div class="alert ok" style="margin-top:10px">Gate cleared — Step 1 is unlocked.</div>':''}</div>
  <h2>Return-to-run ladder</h2><div class="card"><small>One rest day between steps. Advance only on a pass: 0–2/10 during AND baseline next morning. If a step fails, repeat it — dates slip, that’s fine.</small>
  ${LADDER.map((l,i)=>{const n=i+1,d=lad[n];return `<div class="chk"><div style="flex:1"><b>Step ${n}</b> · ${l[1]}<br><small>${l[2]}${d?.pass?` · <span style="color:var(--ac)">passed ${fmtD(d.date)}</span>`:''}</small></div><button class="btn ghost" style="width:auto;margin:0" data-act="ladder" data-id="${n}">${d?.pass?'Undo':'Mark pass'}</button></div>`}).join('')}</div>
  <h2>Weekly self-check (Sundays)</h2><div class="card">${SELF.map((t,i)=>`<div class="chk"><span>${t}</span></div>`).join('')}
   <label>Result this week</label><input id="sc_note" placeholder="e.g. clean / slight cave left side"><button class="btn ghost" data-act="selfcheck">Save self-check</button>
   ${Object.keys(S.selfcheck).sort().reverse().slice(0,5).map(d=>`<p class="sub" style="margin:6px 0 0">${fmtD(d)}: ${esc(S.selfcheck[d])}</p>`).join('')}</div>
  <h2>Red flags — get it looked at, don’t train through</h2><div class="card">${RED.map(t=>`<div class="chk"><span>⚠️ ${t}</span></div>`).join('')}<small>PCP or sick call if on orders. PT referral for hips + outer knee once TRICARE is sorted.</small></div>
  <h2>Episode log</h2><div class="card">${EPI.map(e=>`<p style="margin:0 0 8px"><b>${e[0]}</b> — ${esc(e[1])}</p>`).join('')}${S.episodes.map(e=>`<p style="margin:0 0 8px"><b>${fmtD(e.d)}</b> — ${esc(e.t)} <small>(knee ${esc(e.k)})</small></p>`).join('')}
   <label>New episode</label><input id="ep_t" placeholder="What happened, where, likely trigger"><label>Pain 0–10</label><input id="ep_k" type="number" min="0" max="10"><button class="btn ghost" data-act="episode">Add</button></div>`}

function vFuel(){const f=fuel(),c=S.set;
  const T=[['0:00','Flask A: 4 scoops carb mix + 1 PH 1500 — start sipping on the line'],['0:30','Finish Flask A'],['1:00','PF 30 gel + water'],['1:30','PF 30 gel · knee check at base'],['2:00','PF 30 gel'],['2:30','PF 30 gel'],['3:00','Refill Flask A (carb mix + PH) at base'],['3:30','Finish Flask A'],['4:00','PF 30 gel (caffeinated — test on 2 Jan first)'],['4:30','PF 30 gel'],['5:00','PF 30 gel · pickle juice if anything twitches'],['5:30','PF 30 gel'],['6:00','PF 30 gel'],['6:30','PF 30 gel (only if still going)']];
  return `<div class="card"><h3>Race fuel calculator</h3><div class="row"><div><label>Expected race hours</label><input type="number" step="0.25" data-act="set" data-id="goalH" value="${c.goalH}"></div><div><label>Carbs g/hr</label><input type="number" data-act="set" data-id="carb" value="${c.carb}"></div><div><label>Fluid ml/hr</label><input type="number" data-act="set" data-id="ml" value="${c.ml}"></div></div>
  <div class="row" style="margin-top:10px"><div class="stat"><b>${f.tot}</b><span>g carbs</span></div><div class="stat"><b>${f.pack}</b><span>gels to pack (+2)</span></div><div class="stat"><b>${r1(f.fl)}</b><span>L fluid</span></div><div class="stat"><b>${f.ph}</b><span>PH 1500 tabs</span></div></div><small>Assumes 2 carb-mix bottles (4 scoops = 60 g each), PF 30 gels = 30 g, 1 PH 1500 per 500 ml (750 mg/hr — full strength, salty sweater).</small></div>
  <h2>Race timeline</h2><div class="card">${T.map((t,i)=>`<div class="chk"><b style="width:44px;flex:none">${t[0]}</b><span>${t[1]}</span></div>`).join('')}</div>
  <h2>Training supply (fueled runs = Long 8+ mi and B2B days)</h2><div class="card"><div class="row"><div class="stat"><b>${f.runs}</b><span>fueled runs</span></div><div class="stat"><b>${f.mi}</b><span>miles</span></div></div>
  <table><tr><td>Gels to buy (training + race)</td><td><b>${f.G}</b></td></tr><tr><td>Carb-mix bags (60 scoops)</td><td><b>${f.B}</b></td></tr><tr><td>PH 1500 tubes (10)</td><td><b>${f.T}</b></td></tr></table></div>
  <h2>Winter rules</h2><div class="card">${['NYC Parks fountains are off in winter — assume zero water on course.','Soft flasks/hoses freeze: insulated flask, or carry inside your jacket. Start with warm water.','Gels thicken in cold: keep the next two in an inner pocket.','Cold suppresses thirst: 15-minute watch alert, sip on a timer.','Water with every gel. Nothing new on race day. No alcohol the night before a long run.','Night before: 4 scoops carb mix in 500 ml with dinner.'].map(t=>`<div class="chk"><span>${t}</span></div>`).join('')}</div>`}

function vRace(){const c=S.set;const R=S.paces,segs=SEGS.map((s,i)=>[s[0],s[1],R['s'+i]||s[2],s[3]]);
  let t=0,rows=segs.map(s=>{const sec=(secs(s[2])||0)*s[1];t+=sec;const clk=8*3600+t;return `<tr><td>${s[0]}</td><td><input value="${esc(s[2])}" data-act="segp" data-id="${segs.indexOf(s)}" style="width:64px;padding:4px"></td><td>${fmtT(sec)}</td><td>${fmtT(clk).replace(/^(\d+):(\d+):\d+/,'$1:$2')}</td></tr><tr><td colspan="4"><small>${s[3]}</small></td></tr>`}).join('');
  const loops=Math.floor(31.1/3.35),dl=daysBetween(TODAY,RACE),sunset=17*3600+5*60;
  return `<div class="card"><h3>Sat 23 Jan 2027 · 50K</h3><span class="sub">Self-organized, Prospect Park drive loop · start 8:00 AM · backup Sat 30 Jan</span><div class="row" style="margin-top:10px"><div class="stat"><b>${dl>0?dl:0}</b><span>days to go</span></div><div class="stat"><b>${loops}</b><span>full loops of 3.35 mi</span></div><div class="stat"><b>${r1(31.1-loops*3.35)}</b><span>mi extra, out-and-back</span></div></div>
  <p class="sub">Stop the watch at 31.1+ so GPS drift doesn’t cost the distance. Alternate loop direction where safe to spread the camber load.</p></div>
  <h2>Pacing plan (walk breaks built in)</h2><div class="card"><table><tr><th>Segment</th><th>Pace</th><th>Time</th><th>Clock</th></tr>${rows}</table>
  <div class="alert ${t>=6.5*3600?'':'ok'}" style="margin:10px 0 0"><b>Projected finish ${fmtT(t)}</b> (${fmtT(t/31.1)}/mi) · finish clock ${fmtT(8*3600+t).replace(/:\d+$/,'')} · daylight left ${fmtT(Math.max(0,sunset-8*3600-t)).replace(/:\d+$/,'')}. Goal #1: finish healthy. Goal #2: 6:00–6:30.</div></div>
  <h2>Stop rules — decided now</h2><div class="card">${['Knee 4/10+, or you notice yourself changing stride to protect it: stop. A DNF on your own course costs nothing.','Any sharp pain, locking, or knee giving way: stop immediately.','Can’t keep fluids down, or dizzy/confused: stop and get warm. Hypothermia risk rises fast when you slow to a walk.','Walking is allowed at any point and is not failure.'].map(x=>`<div class="chk"><span>🛑 ${x}</span></div>`).join('')}</div>
  <h2>Race-week checklist</h2><div class="card">${RACECHK.map((r,i)=>chk('r'+i,`<b>${r[0]}</b> — ${r[1]}`,S.race['r'+i],'race')).join('')}</div>
  <h2>Safety (solo, winter)</h2><div class="card">${['Share Garmin LiveTrack / Strava Beacon with someone who knows the loop + expected finish.','Phone charged + battery pack. ID and card on you.','A friend at the base station for the last 2 hours beats any gear.','Vest with balanced front pockets — no one-sided phone.','Race in the shoe with the most easy miles (50+ minimum).'].map(x=>`<div class="chk"><span>${x}</span></div>`).join('')}</div>
  <h2>Base-station bag</h2><div class="card">${['Gels + pre-measured carb-mix bags (4 scoops) + PH 1500 tabs + warm water in insulated jug','Dry base layer, gloves, socks, spare hat','Old trusted shoes as backup','Anti-chafe, blister tape, KT tape, pickle juice, salty snack'].map(x=>`<div class="chk"><span>🎒 ${x}</span></div>`).join('')}</div>
  <div class="card"><b>Weather call (Thu of race week):</b> ice, freezing rain or dangerous wind chill → move to Sun 24 Jan or backup Sat 30 Jan. It’s your race.</div>`}

function vMore(){
  const f=fuel(),tp=[['Marathon target 4:45–5:00',26.22,17550],['16-mi long run 12 Sep',16.05,10654],['Solo marathon 25 Sep',26.21,20778]];
  const proj=tp.map(x=>{const t=x[2]*Math.pow(31.07/x[1],1.06);return `<tr><td>${x[0]}</td><td>${fmtT(t)}</td><td>${fmtT(t/31.07)}</td></tr>`}).join('');
  const shoes=SHOES.map(s=>{const pr=S.shoePrior[s[0]]??s[2],lg=shoeMiles(s[0]);return `<div class="chk" style="display:block"><b>${s[0]}</b><br><small>${s[1]}</small><div class="row" style="margin-top:6px;align-items:center"><div><label>Prior mi</label><input type="number" step="0.1" data-act="shoeprior" data-id="${esc(s[0])}" value="${pr}"></div><div class="stat"><b>${r1(pr+lg)}</b><span>total (+${r1(lg)} logged)</span></div><div class="stat"><b>${r1(s[3]-pr-lg)}</b><span>left of ${s[3]}</span></div></div>${pr+lg<50&&s[0]!==SHOES[0][0]&&s[0]!==SHOES[2][0]?'<small style="color:var(--warn)">Under 50 easy miles — no long runs in this shoe.</small>':''}</div>`}).join('');
  const gear=GEAR.map((g,i)=>{const q=g[1]==='G'?f.G:g[1]==='B'?f.B:g[1]==='T'?f.T:g[1];return chk('gear'+i,`${esc(g[0])} <small>×${q} · by wk ${g[2]} · ${g[3]}</small>`,S.gear['gear'+i],'gear')}).join('');
  const sl=S.strength.slice().reverse().slice(0,15).map(s=>`<tr><td>${fmtD(s.d,{month:'short',day:'numeric'})}</td><td>${esc(s.ex)}</td><td>${esc(s.sets)}×${esc(s.reps)}</td><td>${esc(s.w)}</td><td>${esc(s.k)}</td></tr>`).join('');
  return `<h2>Paces & heart rate</h2><div class="card"><table><tr><th>Zone</th><th>Pace</th><th>mph</th><th>HR</th></tr>${Object.entries(ZONES).map(([k,z])=>`<tr><td><b>${k}</b><br><small>${z[3]}</small></td><td>${z[0]}–${z[1]}</td><td>${r1(3600/secs(z[1]))}–${r1(3600/secs(z[0]))}</td><td>${z[2]}</td></tr>`).join('')}</table>
   <p class="sub">Strides: 4 × 20 s relaxed-fast from week 5, only if knee is clean. Easy means easy — the 10:07 pace at 152 bpm drift is what breaks this block.</p>
   <label>Pace ⇄ treadmill mph</label><div class="row"><input id="cv_p" placeholder="12:00" oninput="conv()"><input id="cv_m" placeholder="5.0" oninput="conv2()"></div></div>
  <h2>Goal-time projection (Riegel)</h2><div class="card"><table><tr><th>Reference</th><th>50K</th><th>Pace</th></tr>${proj}</table><p class="sub">Goal 6:15 (12:04/mi); range 6:00–6:30. Plan on the slower half of each projection: ultra distance, 195 lb, January cold.</p></div>
  <h2>Shoes & gait</h2><div class="card">${shoes}<p class="sub"><b>Book the gait analysis by week 6 (8 Nov):</b> outside-heel strike / possible supination → ask about well-cushioned neutral shoes (Ghost, Bondi, Triumph, 1080). No shoe does a long run until it has 50+ easy miles.</p></div>
  <h2>Strength log</h2><div class="card"><div class="row"><div><label>Session</label><select id="sl_s"><option>A</option><option>B</option></select></div><div><label>Exercise</label><input id="sl_e"></div></div><div class="row"><div><label>Sets</label><input id="sl_sets" type="number"></div><div><label>Reps</label><input id="sl_reps" type="number"></div><div><label>lb</label><input id="sl_w" type="number"></div><div><label>Knee</label><input id="sl_k" type="number" min="0" max="10"></div></div><button class="btn ghost" data-act="strlog">Add set</button>${sl?`<table style="margin-top:10px"><tr><th>Date</th><th>Exercise</th><th>S×R</th><th>lb</th><th>Knee</th></tr>${sl}</table>`:''}
   <p class="sub">Any exercise that reproduces the outer-knee pull: stop it, drop back a phase, retry in a week.</p></div>
  <h2>Gear & shopping</h2><div class="card">${gear}</div>
  <h2>Mobility & IT band</h2><div class="card"><p><b>Before:</b> ${MOB.warm}</p><p><b>After easy:</b> ${MOB.easy}</p><p><b>After long:</b> ${MOB.long}</p><p><b>Daily hip block:</b> ${MOB.daily}</p><p class="sub">The IT band can’t be meaningfully stretched; roll the muscles around it, and let strength do the real work.</p></div>
  <h2>Key dates</h2><div class="card">${KEYDATES.map(k=>`<div class="chk"><b style="width:70px;flex:none">${fmtD(k[0],{month:'short',day:'numeric'})}</b><span>${k[1]} ${daysBetween(TODAY,k[0])>=0?`<small>(in ${daysBetween(TODAY,k[0])} d)</small>`:''}</span></div>`).join('')}</div>
  <h2>Non-negotiables</h2><div class="card">${['Easy means easy: HR 145 alert on, or set the treadmill and don’t touch it.','No shoe does a long run until it has 50+ easy miles.','No alcohol the night before a long run.','Knee rules override the Daily Log, every time.','Weight: modest deficit only in phases 2–3 while mileage is low; not during peak or taper.'].map(x=>`<div class="chk"><span>✅ ${x}</span></div>`).join('')}</div>
  <h2>Race history</h2><div class="card"><table>${HIST.map(h=>`<tr><td><b>${h[0]}</b></td><td>${h[1]}<br><small>${h[4]}</small></td><td>${h[2]}<br><small>${h[3]}/mi</small></td></tr>`).join('')}</table></div>
  <h2>Your data</h2><div class="card"><p class="sub">Everything is stored on this device only. Export a backup now and then.</p><button class="btn" data-act="export">Copy backup (JSON)</button><button class="btn ghost" data-act="import">Import backup</button><textarea id="expbox" hidden readonly style="margin-top:8px"></textarea><input type="file" id="imp" accept=".json" hidden><button class="btn ghost" style="color:var(--bad)" data-act="reset">Erase all logged data</button></div>`}
window.conv=()=>{const s=secs($('#cv_p').value);$('#cv_m').value=s?r1(3600/s):''};
window.conv2=()=>{const m=num($('#cv_m').value);$('#cv_p').value=m?fmtT(3600/m):''};

/* ---------- render + events ---------- */
const V={today:vToday,plan:vPlan,progress:vProgress,knee:vKnee,fuel:vFuel,race:vRace,more:vMore};
function render(keep){const y=scrollY;$('#view').innerHTML=V[tab]();nav();hdr();if(keep)scrollTo(0,y)}
function readForm(){const e=Object.assign({},L(sel));const g=id=>document.getElementById(id);if(!g('f_mi'))return e;
  e.mi=g('f_mi').value;e.time=g('f_time').value;e.hr=g('f_hr').value;e.shoe=g('f_shoe').value;e.notes=g('f_notes').value;return e}
const toggle=(o,k,v)=>{o[k]=v!==undefined?v:!o[k];save();};
document.addEventListener('change',ev=>{const t=ev.target,a=t.dataset.act,id=t.dataset.id;if(!a)return;
  if(a==='tog'||a==='gear'){toggle(S.gear,id,t.checked);render(1)}
  else if(a==='gate'){toggle(S.gate,id,t.checked);if(GATE.every((_,i)=>S.gate['g'+i]))S.gate.passed=true;else S.gate.passed=false;save();render(1)}
  else if(a==='race'){toggle(S.race,id,t.checked);render(1)}
  else if(a==='wt'){S.weight[id]=t.value;save()}
  else if(a==='set'){S.set[id]=num(t.value)??S.set[id];save();render(1)}
  else if(a==='segp'){S.paces['s'+id]=t.value;save();render(1)}
  else if(a==='shoeprior'){S.shoePrior[id]=num(t.value)||0;save();render(1)}
  else if(t.id==='imp'){const f=t.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{S=Object.assign(S,JSON.parse(r.result));save();render();alert('Backup imported.')}catch(e){alert('Not a valid backup file.')}};r.readAsText(f)}
});
document.addEventListener('click',ev=>{const t=ev.target.closest('[data-act]');if(!t||t.tagName==='INPUT')return;const a=t.dataset.act,v=t.dataset.v,id=t.dataset.id;
  if(a==='tab'){tab=v;render();scrollTo(0,0)}
  else if(a==='day'){S.log[sel]=Object.assign({},readForm());save();sel=clampDate(addDays(sel,+v));render();scrollTo(0,0)}
  else if(a==='gotoday'){sel=clampDate(TODAY);render()}
  else if(a==='open'){sel=v;tab='today';render();scrollTo(0,0)}
  else if(a==='knee'){const e=readForm();e.knee=String(e.knee)===v?'':v;S.log[sel]=e;save();render(1)}
  else if(a==='savelog'){S.log[sel]=readForm();save();render(1);toast('Saved')}
  else if(a==='ladder'){const d=S.ladder[id];if(d?.pass)delete S.ladder[id];else S.ladder[id]={pass:true,date:TODAY};save();render(1)}
  else if(a==='selfcheck'){const n=$('#sc_note').value.trim();if(n){S.selfcheck[TODAY]=n;save();render(1)}}
  else if(a==='episode'){const x=$('#ep_t').value.trim();if(x){S.episodes.push({d:TODAY,t:x,k:$('#ep_k').value||'–'});save();render(1)}}
  else if(a==='strlog'){const ex=$('#sl_e').value.trim();if(!ex)return;S.strength.push({d:TODAY,s:$('#sl_s').value,ex,sets:$('#sl_sets').value,reps:$('#sl_reps').value,w:$('#sl_w').value,k:$('#sl_k').value});save();render(1)}
  else if(a==='export'){const j=JSON.stringify(S),box=$('#expbox');box.hidden=false;box.value=j;box.select();try{navigator.clipboard.writeText(j).then(()=>toast('Copied backup'),()=>{})}catch(e){}}
  else if(a==='import')$('#imp').click();
  else if(a==='reset'){if(confirm('Erase ALL logged data on this device?')){localStorage.removeItem(KEY);location.reload()}}
});
function toast(m){const d=document.createElement('div');d.textContent=m;d.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--ac);color:#04231a;padding:8px 18px;border-radius:99px;font-weight:700;z-index:9';document.body.appendChild(d);setTimeout(()=>d.remove(),1200)}
render();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
