import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mdToHtml } from '../report.mjs';

test('markdown renderer handles headings, nested lists, tables with status pills, code and links', () => {
  const { html, toc } = mdToHtml('## Ceny\n\n| | Kritérium |\n|---|---|\n| ✅ | M1 |\n| ❌ | M2 |\n\n- a\n  - b\n- [x] hotovo\n\n```\n<x>\n```\nViz [zdroj](https://example.com) a `kód`.');
  assert.equal(toc[0].text, 'Ceny');
  assert.match(html, /<span class="pill ok">Splněno<\/span>/); assert.match(html, /<span class="pill bad">Nesplněno<\/span>/);
  assert.match(html, /<ul><li>a<ul><li>b<\/li><\/ul><\/li><li class="task done">hotovo<\/li><\/ul>/);
  assert.match(html, /&lt;x&gt;/); assert.match(html, /<a href="https:\/\/example.com">zdroj<\/a>/); assert.match(html, /<code>kód<\/code>/);
});

test('lean calls, small-job fast path, skills on demand, task board, HTML summary and automatic resume', { timeout: 60000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-polish-'));
  fs.mkdirSync(path.join(dir, 'skills', 'pricing-table'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skills', 'pricing-table', 'SKILL.md'), '---\nname: pricing-table\ndescription: Build comparable price tables.\n---\nALWAYS-INCLUDE-SHIPPING-MARKER');
  Object.assign(process.env, { AGENT_OFFICE_HOME: dir, AGENT_OFFICE_TEST_SMOKE: '1', AGENT_OFFICE_APP: '1', AGENT_OFFICE_SKILLS: path.join(dir, 'skills'), CLAUDE_CONFIG_DIR: path.join(dir, 'claude'), CLAUDE_BIN: path.join(dir, 'claude') });
  fs.writeFileSync(process.env.CLAUDE_BIN, `#!${process.execPath}
const fs=require('fs'),a=process.argv.slice(2),H=process.env.AGENT_OFFICE_HOME;
if(a[0]==='auth'){console.log(JSON.stringify({loggedIn:true}));process.exit(0)}
if(!a.includes('--json-schema'))process.exit(0);
let prompt='';process.stdin.on('data',d=>prompt+=d).on('end',()=>{
const r=JSON.parse(a[a.indexOf('--json-schema')+1]).required;let data,call;const m=(re)=>(prompt.match(re)||[])[1];
if(r.includes('research')){call='intake';data={summary:'s',deliverable:'deliverables/table.md',complexity:'small',assumptions:['a'],questions:[],research:[]}}
else if(r.includes('scorecard_items')&&!r.includes('tasks')){call='synthesis';data={scorecard_items:1,questions:[]}}
else if(r.includes('tasks')){call='plan';const o=m(/first write (\\S+)\\/SCORECARD\\.md/);if(o)fs.writeFileSync(o+'/SCORECARD.md','- M1 MUST full price incl. shipping '.repeat(3));
  data={hires:[],scorecard_items:1,tasks:[{id:'T1',title:'Table',role:'designer',instructions:'x',acceptance:['a'],depends_on:[],model:'haiku',effort:'low',question:'Cheapest?',inputs:[],output:'deliverables/table.md',consumer:'boss',critical:false,skills:['pricing-table']}],verify:{instructions:'check',model:'haiku',effort:'low'},sawCatalog:prompt.includes('pricing-table')};fs.writeFileSync(H+'/catalog.txt',String(prompt.includes('pricing-table – Build comparable')))}
else if(r.includes('conclusion')){const task=m(/\\nTASK (\\S+):/);call='worker:'+task;
  if(task==='T1'){fs.writeFileSync(H+'/skill.txt',String(prompt.includes('ALWAYS-INCLUDE-SHIPPING-MARKER')));const w=m(/Working dir \\(project files\\): (.+)/);fs.mkdirSync(w+'/deliverables',{recursive:true});fs.writeFileSync(w+'/deliverables/table.md','# Srovnání\\n\\n| Obchod | Cena |\\n|---|---|\\n| A | 9 990 Kč |\\n')}
  if(task==='T1'&&fs.existsSync(H+'/hang')){fs.appendFileSync(H+'/calls.txt',call+':hang\\n');setTimeout(()=>{},600000);return}
  data={status:'done',summary:'ok',conclusion:'A is cheapest',evidence:[{claim:'price',source:'deliverables/table.md'}],uncertainties:[],open_questions:[],changed_files:[]}}
else if(r.includes('criteria')){call='judge';data={passed:true,score:95,gaps:[],questions:[],summary:'Nejlevnější je A.',full_review_needed:false,lessons:['Vždy počítej dopravu.'],criteria:[{id:'M1',level:'MUST',status:'PASS',evidence:'table.md row 1'},{id:'S1',level:'SHOULD',status:'FAIL',evidence:'no chart'}]}}
else{call='final';data={summary:'x',remaining:[]}}
fs.appendFileSync(H+'/calls.txt',call+'\\n');fs.appendFileSync(H+'/args.txt',JSON.stringify(a.filter(x=>x.startsWith('--')))+'\\n');
console.log(JSON.stringify({type:'result',structured_output:data,result:JSON.stringify(data),session_id:'s',total_cost_usd:0,usage:{input_tokens:100,output_tokens:10}}));
});`, { mode: 0o700 });
  const until = (office, id, states = ['done', 'partial', 'error']) => new Promise((resolve) => { const w = (s) => { if (s.id === id && states.includes(s.status)) { office.bus.off('update', w); resolve(s); } }; office.bus.on('update', w); });
  const office = await import('../orchestrator.mjs');
  try {
    const repo = office.createOffice('Polish fixture');
    const started = office.startProject({ repoId: repo.id, preset: 'smoke', goal: 'Cenový průzkum', settings: { maxRounds: 1, maxRuns: 30 } });
    const st = await until(office, started.id);
    assert.equal(st.status, 'done', JSON.stringify(st.log.slice(-5)));
    const calls = fs.readFileSync(path.join(dir, 'calls.txt'), 'utf8').trim().split('\n');
    assert.deepEqual(calls, ['intake', 'plan', 'worker:T1', 'worker:V-1', 'judge'], 'small job: no synthesis call, no final call');
    const args = fs.readFileSync(path.join(dir, 'args.txt'), 'utf8');
    assert.match(args, /--tools/); assert.match(args, /--strict-mcp-config/); assert.match(args, /--disable-slash-commands/);
    assert.equal(fs.readFileSync(path.join(dir, 'catalog.txt'), 'utf8'), 'true', 'boss sees the compact skills catalog');
    assert.equal(fs.readFileSync(path.join(dir, 'skill.txt'), 'utf8'), 'true', 'the assigned skill text reaches the worker');
    const projDir = path.join(dir, 'projects', started.id), officeDir = path.join(projDir, 'office');
    for (const f of ['BRIEF.md', 'PLAN.md', 'BOARD.md', 'DECISIONS.md', 'FINAL.md', 'FINAL.html', 'LESSONS.md', 'board/tasks.json']) assert.ok(fs.existsSync(path.join(officeDir, f)), f);
    assert.match(fs.readFileSync(path.join(officeDir, 'BOARD.md'), 'utf8'), /● \| T1 Table/);
    assert.deepEqual(fs.readdirSync(path.join(officeDir, 'board', 'claims')), [], 'claims are released');
    const html = fs.readFileSync(path.join(st.workDir, 'deliverables', 'Souhrn.html'), 'utf8');
    assert.match(html, /Hotovo – kritéria ověřena/); assert.match(html, /1\/1<\/b><span>povinných kritérií ověřeno/); assert.match(html, /Nejlevnější je A\./);
    assert.match(fs.readFileSync(path.join(st.workDir, 'deliverables', 'table.html'), 'utf8'), /<td>9 990 Kč<\/td>/, 'markdown deliverable got an HTML twin');
    assert.match(fs.readFileSync(path.join(dir, 'profile.md'), 'utf8'), /Vždy počítej dopravu/);
    assert.deepEqual(st.final.remaining, ['S1 (SHOULD): no chart']);

    // crash in the middle of a task, then a fresh process: the project continues by itself and does not redo the plan
    fs.writeFileSync(path.join(dir, 'hang'), '1'); fs.writeFileSync(path.join(dir, 'calls.txt'), '');
    const second = office.startProject({ repoId: repo.id, preset: 'smoke', goal: 'Druhý průzkum', settings: { maxRounds: 1, maxRuns: 30 } });
    await new Promise((resolve) => { const t = setInterval(() => { if (fs.readFileSync(path.join(dir, 'calls.txt'), 'utf8').includes('worker:T1:hang')) { clearInterval(t); resolve(); } }, 100); });
    office.stopAll(); office.flushRepos(); // the "crash": children die, state on disk still says running
    const raw = JSON.parse(fs.readFileSync(path.join(projDir, 'state.json'), 'utf8')); raw.status = 'running'; fs.writeFileSync(path.join(projDir, 'state.json'), JSON.stringify(raw));
    fs.rmSync(path.join(dir, 'hang')); fs.writeFileSync(path.join(dir, 'calls.txt'), '');
    assert.ok(fs.existsSync(path.join(officeDir, 'board', 'claims', 'T1.lock')), 'the crashed run left its claim behind');
    const fresh = await import('../orchestrator.mjs?restart=1');
    const wait = until(fresh, second.id);
    assert.deepEqual(fresh.autoResume(), ['Polish fixture']);
    const resumed = await wait;
    assert.equal(resumed.status, 'done', JSON.stringify(resumed.log.slice(-5)));
    const after = fs.readFileSync(path.join(dir, 'calls.txt'), 'utf8').trim().split('\n');
    assert.ok(!after.includes('intake') && !after.includes('plan'), 'restart reuses intake and plan: ' + after);
    assert.ok(after.includes('worker:T1'), 'stale claim was taken over and the task finished');
    fresh.stopAll(); fresh.flushRepos();
  } finally { office.stopAll(); office.flushRepos(); fs.rmSync(dir, { recursive: true, force: true }); }
});
