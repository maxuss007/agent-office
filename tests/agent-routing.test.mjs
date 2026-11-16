import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('manual agent model and effort reach CLI, survive next goal, and auto restores Boss routing', { timeout: 45000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-routing-'));
  Object.assign(process.env, { AGENT_OFFICE_HOME: dir, AGENT_OFFICE_TEST_SMOKE: '1', AGENT_OFFICE_APP: '1', CLAUDE_CONFIG_DIR: path.join(dir, 'claude'), CLAUDE_BIN: path.join(dir, 'claude') });
  fs.writeFileSync(process.env.CLAUDE_BIN, `#!${process.execPath}
const fs=require('fs'),a=process.argv.slice(2);
if(a[0]==='auth'){console.log(JSON.stringify({loggedIn:true}));process.exit(0)}
if(!a.includes('--json-schema'))process.exit(0);
let prompt='';process.stdin.on('data',d=>prompt+=d).on('end',()=>{
const schema=JSON.parse(a[a.indexOf('--json-schema')+1]),r=schema.required;let data,phase;
if(r.includes('research')){phase='intake';data={summary:'test',assumptions:[],questions:[],research:[]}}
else if(r.includes('scorecard_items')){phase='synthesis';data={scorecard_items:1,questions:[]}}
else if(r.includes('tasks')){phase='plan';data={tasks:[{id:'T1',title:'Write brief',role:'designer',instructions:'Fixture',acceptance:['done'],depends_on:[],model:'haiku',effort:'low'}],verify:{instructions:'Check brief',model:'haiku',effort:'low'}}}
else if(r.includes('status')){phase=prompt.includes('TASK T1:')?'worker':'verify';data={status:'done',summary:'Complete',changed_files:[],concerns:[]}}
else if(r.includes('passed')){phase='judge';data={passed:true,score:100,gaps:[],questions:[],summary:'Verified',full_review_needed:false,criteria:[{id:'M1',level:'MUST',status:'PASS',evidence:'report.md line 1'}]}}
else{phase='final';data={summary:'Finished',remaining:[]}}
fs.appendFileSync(process.env.AGENT_OFFICE_HOME+'/trace.jsonl',JSON.stringify({phase,model:a[a.indexOf('--model')+1],effort:a[a.indexOf('--effort')+1]})+'\\n');
console.log(JSON.stringify({type:'result',structured_output:data,result:JSON.stringify(data),session_id:a[a.indexOf('--session-id')+1],total_cost_usd:0}));
});`, { mode: 0o700 });
  const office = await import('../orchestrator.mjs');
  try {
    const repo = office.createOffice('Agent override fixture');
    office.setAgentOverride(repo.id, 'boss', { model: 'claude:opus', effort: 'medium' });
    office.setAgentOverride(repo.id, 'designer', { model: 'claude:sonnet', effort: 'high' });
    async function run() {
      const done = new Promise(resolve => {
        const watch = s => { if (['done', 'error', 'budget', 'partial'].includes(s.status)) { office.bus.off('update', watch); resolve(s); } };
        office.bus.on('update', watch);
      });
      office.startProject({ repoId: repo.id, preset: 'smoke', goal: 'Verify override', settings: { maxRounds: 1, maxRuns: 24 } });
      const state = await done; assert.equal(state.status, 'done', JSON.stringify(state.log)); return state;
    }
    await run();
    let trace = fs.readFileSync(path.join(dir, 'trace.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(trace.find(t => t.phase === 'intake').model, 'opus');
    assert.equal(trace.find(t => t.phase === 'intake').effort, 'medium');
    assert.deepEqual(trace.find(t => t.phase === 'worker'), { phase: 'worker', model: 'sonnet', effort: 'high' });
    office.setAgentOverride(repo.id, 'designer', { model: 'auto', effort: 'auto' });
    fs.writeFileSync(path.join(dir, 'trace.jsonl'), '');
    const second = await run();
    assert.equal(second.agentOverrides.boss.model, 'claude/opus');
    trace = fs.readFileSync(path.join(dir, 'trace.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(trace.find(t => t.phase === 'worker').model, 'haiku');
    assert.equal(trace.find(t => t.phase === 'worker').effort, 'low');
  } finally { office.stopAll(); office.flushRepos(); fs.rmSync(dir, { recursive: true, force: true }); }
});
