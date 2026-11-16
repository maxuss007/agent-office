import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {runCodex} from '../providers.mjs';
test('Codex progress extends idle deadline; inactivity returns a recoverable timeout',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'office-timeout-')),old=process.env.CODEX_BIN,bin=path.join(dir,'model-fixture');
 fs.writeFileSync(bin,`#!${process.execPath}\nconst args=process.argv.slice(2);process.stdin.resume();if(args.includes('active')){let n=0;const t=setInterval(()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Still working'}}));if(++n===4){clearInterval(t);process.stdout.write('');require('fs').writeFileSync(args[args.indexOf('-o')+1],JSON.stringify({reply:'ok'}));process.exit(0);}},300);}else setTimeout(()=>process.exit(0),5000);`,{mode:0o700});process.env.CODEX_BIN=bin;
 const hooks={entry:{},onEvent:()=>{},onChild:()=>{}},opts={provider:'codex',model:'active',effort:'high',cwd:dir,system:'Test',prompt:'Test',schema:{type:'object',required:['reply'],properties:{reply:{type:'string'}}},idleTimeoutMs:2000,timeoutMs:5000};
 try{const r=await runCodex({dir},opts,hooks);assert.equal(r.data.reply,'ok');await assert.rejects(runCodex({dir},{...opts,model:'silent',idleTimeoutMs:200},hooks),e=>e.timedOut&&/bez nové aktivity/.test(e.message));}
 finally{if(old===undefined)delete process.env.CODEX_BIN;else process.env.CODEX_BIN=old;fs.rmSync(dir,{recursive:true,force:true});}
});

test('Codex discovery returns promptly when app-server cannot start', async () => {
  const { codexInfo } = await import('../providers.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-discovery-')), bin = path.join(dir, 'codex');
  fs.writeFileSync(bin, '#!/bin/sh\necho "Error: Operation not permitted" >&2\nexit 1\n', { mode: 0o700 });
  try {
    const start = Date.now(), result = await codexInfo(bin);
    assert.equal(result.available, false); assert.match(result.message, /oprávnění/); assert.ok(Date.now() - start < 3000);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Codex discovery reads the existing account, dynamic models and subscription limits through JSON RPC', async () => {
  const { codexInfo } = await import('../providers.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-rpc-')), bin = path.join(dir, 'codex');
  fs.writeFileSync(bin, `#!${process.execPath}
const rl=require('readline').createInterface({input:process.stdin});
rl.on('line',line=>{const m=JSON.parse(line);if(!m.id)return;let result={};
if(m.method==='account/read')result={account:{type:'chatgpt'}};
if(m.method==='account/rateLimits/read')result={rateLimits:{primary:{usedPercent:25,resetsAt:9999999999}}};
if(m.method==='model/list')result={data:[{model:'fixture-model',displayName:'Fixture',supportedReasoningEfforts:[{reasoningEffort:'high'}]}]};
console.log(JSON.stringify({id:m.id,result}));});`, { mode: 0o700 });
  try {
    const result = await codexInfo(bin);
    assert.equal(result.available, true); assert.equal(result.models[0].model, 'fixture-model');
    assert.equal(result.windows[0].usedPercent, 25); assert.equal(result.source, 'account/rateLimits/read');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
