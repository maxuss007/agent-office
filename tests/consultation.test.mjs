import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('a blocked employee actually consults the chief and retries with their guidance', { timeout: 15000 }, async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'office-consult-'));
  process.env.AGENT_OFFICE_TEST_SMOKE = '1'; process.env.AGENT_OFFICE_HOME = home; process.env.CLAUDE_CONFIG_DIR = path.join(home, 'claude'); process.env.AGENT_OFFICE_APP = '1';
  const mock = path.join(home, 'mock-claude'); process.env.CLAUDE_BIN = mock;
  fs.writeFileSync(mock, `#!${process.execPath}
import fs from 'node:fs';
let prompt='';for await(const chunk of process.stdin)prompt+=chunk;
const args=process.argv.slice(2), schema=JSON.parse(args[args.indexOf('--json-schema')+1]), r=schema.required;
let data,phase;
if(r.includes('research')){phase='intake';data={summary:'test',assumptions:[],questions:[],research:[]}}
else if(r.includes('scorecard_items')){phase='synthesis';data={scorecard_items:1,questions:[]}}
else if(r.includes('tasks')){phase='plan';data={tasks:[{id:'T1',title:'Produce a brief',role:'designer',instructions:'Use the test fixture.',acceptance:['brief ready'],depends_on:[],model:'haiku',effort:'low'}],verify:{instructions:'Check the brief.',model:'haiku',effort:'low'}}}
else if(r.includes('instructions')){phase='advice';data={instructions:'SUPERVISOR_MARKER: use the test fixture as the source.'}}
else if(r.includes('status')){const blocked=prompt.includes('TASK T1:')&&!prompt.includes('SUPERVISOR_MARKER');phase=blocked?'blocked':prompt.includes('TASK T1:')?'retry-with-guidance':'verify';data={status:blocked?'blocked':'done',summary:blocked?'Need a source decision.':'Complete',changed_files:[],concerns:[]}}
else if(r.includes('passed')){phase='judge';data={passed:true,score:100,gaps:[],questions:[],summary:'Verified',full_review_needed:false,criteria:[{id:'M1',level:'MUST',status:'PASS',evidence:'report.md line 1'}]}}
else{phase='final';data={summary:'Finished',remaining:[]}}
fs.appendFileSync(process.env.AGENT_OFFICE_HOME+'/trace.jsonl',JSON.stringify({phase})+'\\n');
const flag=args.includes('--resume')?'--resume':'--session-id';
console.log(JSON.stringify({type:'result',subtype:'success',session_id:args[args.indexOf(flag)+1],structured_output:data,result:JSON.stringify(data),total_cost_usd:0}));
`, { mode: 0o700 });
  const office = await import('../orchestrator.mjs'); let sawVisit = false;
  const onUpdate = (s) => { if (s.agents.designer?.needsBoss && s.agents.designer.status === 'waiting') sawVisit = true; };
  office.bus.on('update', onUpdate);
  try {
    const repo = office.createOffice('Consultation fixture');
    const finished = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { office.bus.off('update', watch); reject(new Error('pipeline timed out')); }, 10000);
      function watch(s) { if (['done', 'error', 'budget', 'partial'].includes(s.status)) { clearTimeout(timer); office.bus.off('update', watch); resolve(s); } }
      office.bus.on('update', watch);
    });
    office.startProject({ repoId: repo.id, goal: 'Verify supervisor consultation', preset: 'smoke' });
    const result = await finished; assert.equal(result.status, 'done', JSON.stringify(result.log)); assert.equal(sawVisit, true);
    const phases = fs.readFileSync(path.join(home, 'trace.jsonl'), 'utf8').trim().split('\n').map((s) => JSON.parse(s).phase);
    assert.ok(phases.includes('advice')); assert.ok(phases.includes('retry-with-guidance'));
    assert.ok(phases.indexOf('blocked') < phases.indexOf('advice') && phases.indexOf('advice') < phases.indexOf('retry-with-guidance'));
  } finally {
    office.bus.off('update', onUpdate); office.stopAll(); office.flushRepos();
    // Feed writes are debounced by 500ms. Avoid deleting their parent before they flush.
    await new Promise((resolve) => setTimeout(resolve, 550)); fs.rmSync(home, { recursive: true, force: true });
  }
});
