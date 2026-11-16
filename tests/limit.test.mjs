import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A usage limit must never lose work: the project parks in "limit", keeps its budget, continues by itself or on "Zkusit znovu".
test('usage limit parks the project, keeps the run budget and continues after retry', { timeout: 60000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-limit-'));
  Object.assign(process.env, { AGENT_OFFICE_HOME: dir, AGENT_OFFICE_TEST_SMOKE: '1', AGENT_OFFICE_APP: '1', AGENT_OFFICE_NO_INSTALL: '1', AGENT_OFFICE_SKILLS: path.join(dir, 'none'), CLAUDE_CONFIG_DIR: path.join(dir, 'claude'), CLAUDE_BIN: path.join(dir, 'claude') });
  fs.writeFileSync(process.env.CLAUDE_BIN, `#!${process.execPath}
const fs=require('fs'),a=process.argv.slice(2),H=process.env.AGENT_OFFICE_HOME;
if(a[0]==='auth'){console.log(JSON.stringify({loggedIn:true}));process.exit(0)}
if(!a.includes('--json-schema'))process.exit(0);
let prompt='';process.stdin.on('data',d=>prompt+=d).on('end',()=>{
const r=JSON.parse(a[a.indexOf('--json-schema')+1]).required;let data,call;
if(r.includes('research')){call='intake';
  if(!fs.existsSync(H+'/reset')){fs.appendFileSync(H+'/calls.txt','limit\\n');console.log(JSON.stringify({type:'result',is_error:true,result:"You've hit your 5-hour limit · resets in 30 minutes",session_id:'s'}));return}
  data={summary:'s',deliverable:'x',complexity:'small',assumptions:[],questions:[],research:[]}}
else if(r.includes('tasks')){call='plan';const o=(prompt.match(/first write (\\S+)\\/SCORECARD\\.md/)||[])[1];if(o)fs.writeFileSync(o+'/SCORECARD.md','- M1 MUST done '.repeat(4));data={hires:[],scorecard_items:1,tasks:[{id:'T1',title:'Work',role:'designer',instructions:'x',acceptance:['a'],depends_on:[],model:'haiku',effort:'low',question:'q',inputs:[],output:'deliverables/x.md',consumer:'boss',critical:false}],verify:{instructions:'check',model:'haiku',effort:'low'}}}
else if(r.includes('conclusion')){call='worker';data={status:'done',summary:'ok',conclusion:'ok',evidence:[{claim:'c',source:'x.md'}],uncertainties:[],open_questions:[],changed_files:[]}}
else if(r.includes('criteria')){call='judge';data={passed:true,score:95,gaps:[],questions:[],summary:'Hotovo.',full_review_needed:false,lessons:[],criteria:[{id:'M1',level:'MUST',status:'PASS',evidence:'x.md'}]}}
else{call='other';data={}}
fs.appendFileSync(H+'/calls.txt',call+'\\n');
console.log(JSON.stringify({type:'result',structured_output:data,result:JSON.stringify(data),session_id:'s',total_cost_usd:0,usage:{input_tokens:1,output_tokens:1}}));
});`, { mode: 0o700 });
  const office = await import('../orchestrator.mjs');
  const until = (id, states) => new Promise((resolve) => { const w = (s) => { if (s.id === id && states.includes(s.status)) { office.bus.off('update', w); resolve(s); } }; office.bus.on('update', w); });
  try {
    const repo = office.createOffice('Limit fixture');
    const started = office.startProject({ repoId: repo.id, preset: 'smoke', goal: 'Test limitu', settings: { maxRounds: 1, maxRuns: 6 } });
    const parked = await until(started.id, ['limit', 'error', 'partial', 'done']);
    assert.equal(parked.status, 'limit', JSON.stringify(parked.log.slice(-4)));
    assert.ok(parked.limit.until > Date.now() + 25 * 60000, 'reset time read from the message');
    assert.equal(parked.stats.runs, 0, 'a refused call does not eat the budget');
    assert.match(parked.agents.boss.activity, /Došel limit/);
    fs.writeFileSync(path.join(dir, 'reset'), '1'); // the limit is back
    const done = until(started.id, ['done', 'partial', 'error']);
    assert.equal(office.retryNow(started.id).mode, 'wake');
    const st = await done;
    assert.equal(st.status, 'done', JSON.stringify(st.log.slice(-5)));
    assert.equal(st.limit, null);
    const calls = fs.readFileSync(path.join(dir, 'calls.txt'), 'utf8').trim().split('\n');
    assert.deepEqual(calls, ['limit', 'intake', 'plan', 'worker', 'worker', 'judge']);
  } finally { office.stopAll(); office.flushRepos(); fs.rmSync(dir, { recursive: true, force: true }); }
});
