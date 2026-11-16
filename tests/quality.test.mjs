import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// "Done" means verified MUST criteria; budget/round exhaustion returns a partial result with concrete gaps;
// every attempt (also failed ones) is recorded; resuming reuses verified work instead of redoing it.
test('partial result with gaps, attempt ledger, code task without a model, and resume from the last verified state', { timeout: 60000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-quality-'));
  Object.assign(process.env, { AGENT_OFFICE_HOME: dir, AGENT_OFFICE_TEST_SMOKE: '1', AGENT_OFFICE_APP: '1', CLAUDE_CONFIG_DIR: path.join(dir, 'claude'), CLAUDE_BIN: path.join(dir, 'claude') });
  fs.writeFileSync(process.env.CLAUDE_BIN, `#!${process.execPath}
const fs=require('fs'),a=process.argv.slice(2),H=process.env.AGENT_OFFICE_HOME;
if(a[0]==='auth'){console.log(JSON.stringify({loggedIn:true}));process.exit(0)}
if(!a.includes('--json-schema'))process.exit(0);
let prompt='';process.stdin.on('data',d=>prompt+=d).on('end',()=>{
const r=JSON.parse(a[a.indexOf('--json-schema')+1]).required,pass=fs.existsSync(H+'/pass');let data,call;
const m=(re)=>(prompt.match(re)||[])[1];
if(r.includes('research')){call='intake';data={summary:'s',assumptions:['a'],questions:[],research:[{id:'r1',topic:'prices',instructions:'x',model:'haiku',effort:'low'},{id:'r2',topic:'fees',instructions:'x',model:'haiku',effort:'low'}]}}
else if(r.includes('scorecard_items')){call='synthesis';const o=m(/Write (\\S+)\\/TASTE\\.md/);fs.writeFileSync(o+'/TASTE.md','taste '.repeat(10));fs.writeFileSync(o+'/SCORECARD.md','- M1 MUST full price incl. shipping '.repeat(3));data={scorecard_items:1,questions:[]}}
else if(r.includes('tasks')){call='plan';data={hires:[],tasks:[{id:'T1',title:'Table',role:'designer',instructions:'x',acceptance:['a'],depends_on:[],model:'haiku',effort:'low',question:'Which offer is cheapest?',inputs:[],output:'deliverables/table.md',consumer:'boss',critical:false},{id:'T2',title:'Recompute ranking',role:'tester',instructions:'x',acceptance:['a'],depends_on:['T1'],model:'haiku',effort:'low',question:'Is the ranking arithmetic right?',inputs:['deliverables/table.md'],output:'stdout',consumer:'boss',critical:false,command:'node -e console.log(42)'}],verify:{instructions:'check',model:'haiku',effort:'low'}}}
else if(r.includes('conclusion')){
  const out=m(/Write findings to (\\S+)/);const task=m(/\\nTASK (\\S+):/);call='worker:'+task;
  if(task==='R-r2'&&!pass){fs.appendFileSync(H+'/calls.txt',call+'\\n');process.exit(3)}
  if(out)fs.writeFileSync(out,'finding with https://example.com '.repeat(3));
  data={status:'done',summary:'ok',conclusion:'cheapest is A',evidence:[{claim:'price A',source:'https://example.com'}],uncertainties:[],open_questions:[],changed_files:[]}}
else if(r.includes('criteria')){call='judge';data=pass?{passed:true,score:95,gaps:[],questions:[],summary:'ok',full_review_needed:false,criteria:[{id:'M1',level:'MUST',status:'PASS',evidence:'table.md row 2'}]}:{passed:false,score:60,gaps:[],questions:[],summary:'shipping missing',full_review_needed:false,criteria:[{id:'M1',level:'MUST',status:'FAIL',evidence:'shipping not included'}]}}
else{call='final';data={summary:'Finished',remaining:[]}}
fs.appendFileSync(H+'/calls.txt',call+'\\n');
console.log(JSON.stringify({type:'result',structured_output:data,result:JSON.stringify(data),session_id:'s',total_cost_usd:0,usage:{input_tokens:100,output_tokens:10,cache_read_input_tokens:50}}));
});`, { mode: 0o700 });
  const office = await import('../orchestrator.mjs');
  const until = (id) => new Promise((resolve) => { const w = (s) => { if (s.id === id && ['done', 'partial', 'error'].includes(s.status)) { office.bus.off('update', w); resolve(s); } }; office.bus.on('update', w); });
  try {
    const repo = office.createOffice('Quality fixture');
    const started = office.startProject({ repoId: repo.id, preset: 'smoke', goal: 'Cenový průzkum', settings: { maxRounds: 1, maxRuns: 30 } });
    const first = await until(started.id);
    assert.equal(first.status, 'partial', JSON.stringify(first.log.slice(-5)));
    assert.ok(first.final.remaining.some((g) => g.startsWith('M1')), 'concrete gap list names the failing MUST');
    const projDir = path.join(dir, 'projects', started.id);
    assert.match(fs.readFileSync(path.join(projDir, 'office', 'FINAL.md'), 'utf8'), /What is missing/); // English is the default language
    assert.ok(fs.existsSync(path.join(projDir, 'office', 'DECISIONS.md')));
    assert.ok(fs.existsSync(path.join(projDir, 'office', 'handoffs', 'T1.md')));
    const rows = fs.readFileSync(path.join(projDir, 'attempts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.ok(rows.some((r) => r.outcome === 'failed' && r.task.includes('fees')), 'failed attempts are recorded');
    assert.ok(rows.some((r) => r.provider === 'code' && r.taskId === 'T2'), 'code task ran without a model');
    const ok = rows.find((r) => r.outcome === 'ok' && r.provider === 'claude');
    assert.deepEqual([ok.tokens.input, ok.tokens.output, ok.tokens.cacheRead], [100, 10, 50]);
    const usage = office.usageReport(started.id);
    assert.ok(usage.current.byPhase.some((p) => p.key === 'research' && p.failed > 0));

    // resume: research r1 and task T1 are verified/finished and must not run again
    fs.writeFileSync(path.join(dir, 'pass'), '1'); fs.writeFileSync(path.join(dir, 'calls.txt'), '');
    office.resumeProject(started.id);
    const second = await until(started.id);
    assert.equal(second.status, 'done', JSON.stringify(second.log.slice(-5)));
    const calls = fs.readFileSync(path.join(dir, 'calls.txt'), 'utf8').trim().split('\n');
    assert.ok(!calls.includes('worker:R-r1'), 'finished research is reused');
    assert.ok(calls.includes('worker:R-r2'), 'missing research is redone');
    assert.ok(!calls.includes('intake') && !calls.includes('plan'), 'intake and plan are reused');
    assert.ok(!calls.includes('worker:T1'), 'finished task is not redone');
    office.acceptProject(started.id);
    assert.ok(office.usageReport(started.id).perAccepted > 0, 'spend per accepted job includes failed attempts');
  } finally { office.stopAll(); office.flushRepos(); fs.rmSync(dir, { recursive: true, force: true }); }
});
