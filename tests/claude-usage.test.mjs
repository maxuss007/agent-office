import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUsageScreen, terminalScreen } from '../claude-usage.mjs';
import { chooseRoute } from '../providers.mjs';
test('official usage screen supplies percentage and Prague reset, including split terminal updates',()=>{
 const screen=terminalScreen();screen.push('\x1b[2J\x1b[HCurrent session\r\n0% used\r\nCurrent week (all models)\r\n100% used\r\nResets Nov 10 at 11:59pm (Europe/Prague)\r\n');
 const windows=parseUsageScreen(screen.push(''),new Date('2026-11-09T20:00:00Z'));
 assert.equal(windows[0].usedPercent,0);assert.equal(windows[1].usedPercent,100);assert.equal(new Date(windows[1].resetsAt*1000).toISOString(),'2026-11-10T22:59:00.000Z');
 assert.deepEqual(parseUsageScreen('Loading usage data…'),[]);
});
test('automatic boss prefers Opus high with capacity and switches to strong Codex high at low or exhausted quota',()=>{
 const c={routing:{model:'auto'},providers:[{id:'claude',remainingPercent:70,source:'claude-code-usage'},{id:'codex',remainingPercent:60,source:'account/rateLimits/read'}],models:[{id:'claude/opus',model:'opus',provider:'claude',tier:'deep',available:true},{id:'codex/flagship',model:'flagship',provider:'codex',tier:'balanced',default:true,available:true,efforts:['low','medium','high']},{id:'codex/mini',model:'mini',provider:'codex',tier:'fast',available:true,efforts:['high']}]};
 let r=chooseRoute(c,{role:'boss',effort:'medium'});assert.equal(r.model,'opus');assert.equal(r.effort,'high');
 c.providers[0].remainingPercent=3;r=chooseRoute(c,{role:'boss'});assert.equal(r.model,'flagship');assert.equal(r.effort,'high');
 c.models[0].available=false;r=chooseRoute(c,{role:'boss'});assert.equal(r.provider,'codex');
 c.routing.model='codex/mini';assert.equal(chooseRoute(c,{role:'boss'}).model,'mini');
});

test('a garbled time zone from the terminal never throws', () => {
  const t = 'Current session\n  12% used\n  Resets 5pm (Europm (Europe/Prague)\nCurrent week (all models)\n  40% used\n  Resets Nov 20 at 9am (Nonsense/Zone)\n';
  const w = parseUsageScreen(t, new Date('2026-11-16T15:00:00Z'));
  assert.equal(w.length, 2);
  assert.equal(w[0].resetsAt, Date.parse('2026-11-16T16:00:00Z') / 1000); // 5 pm in Prague
  assert.equal(w[1].usedPercent, 40);
});
