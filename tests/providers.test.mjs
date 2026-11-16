import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chooseRoute, remaining, strictSchema, updateRouting, routingPreference } from '../providers.mjs';
import { localTool } from '../local-runner.mjs';
const catalog = (left = 80) => ({ providers: [{ id: 'claude', remainingPercent: null, source: 'unknown' }, { id: 'codex', remainingPercent: left, source: 'account/rateLimits/read' }, { id: 'ollama', remainingPercent: null, source: 'local' }], models: [{ id: 'claude/opus', model: 'opus', provider: 'claude', tier: 'deep', available: true }, { id: 'codex/worker', model: 'worker', provider: 'codex', tier: 'balanced', available: true, default: true, efforts: ['low', 'medium', 'high'] }, { id: 'ollama/qwen3.5:latest', model: 'qwen3.5:latest', provider: 'ollama', tier: 'local', available: true }] });
test('unknown capacity is not zero; expired windows do not block the provider', () => {
  assert.equal(remaining([]), null); assert.equal(remaining([{ usedPercent: 20 }, { usedPercent: 70 }]), 30);
  assert.equal(remaining([{ usedPercent: 100, resetsAt: Date.now() / 1000 - 60 }]), null);
});
test('routing uses local Qwen for simple work, Codex for code, and avoids depleted quota', () => {
  assert.equal(chooseRoute(catalog(), { role: 'copywriter', task: 'Shrnutí podkladů', effort: 'low' }).provider, 'ollama');
  assert.equal(chooseRoute(catalog(), { role: 'designer', task: 'Implement code', effort: 'high' }).provider, 'codex');
  assert.equal(chooseRoute(catalog(3), { role: 'designer', task: 'Implement code', effort: 'high' }).provider, 'claude');
  assert.notEqual(chooseRoute(catalog(), { role: 'tester', task: 'Run tests', effort: 'low' }).provider, 'ollama');
  assert.notEqual(chooseRoute(catalog(), { role: 'boss', task: 'Právní strategie', effort: 'high' }).provider, 'ollama');
  assert.equal(chooseRoute(catalog(), { pinned: true, model: 'ollama/qwen3.5:latest' }).provider, 'ollama');
  assert.throws(() => chooseRoute({ providers: [], models: [] }, {}), /Žádný model/);
});
test('strict Codex schemas include every field and close object properties', () => {
  const s = strictSchema({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'array', items: { type: 'object', properties: { x: { type: 'number' } } } } } });
  assert.deepEqual(s.required, ['a', 'b']); assert.equal(s.additionalProperties, false); assert.deepEqual(s.properties.b.items.required, ['x']);
});
test('local tools can use project files but cannot escape through paths or symlinks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-tools-')), outside = fs.mkdtempSync(path.join(os.tmpdir(), 'local-outside-'));
  try {
    const options = { cwd: root, tools: ['Read', 'Write'] };
    localTool('write_file', { path: 'deliverables/brief.md', content: 'Verified content' }, options);
    assert.equal(localTool('read_file', { path: 'deliverables/brief.md' }, options), 'Verified content');
    assert.throws(() => localTool('write_file', { path: '../escape.txt', content: 'no' }, options));
    fs.symlinkSync(outside, path.join(root, 'linked'));
    assert.throws(() => localTool('write_file', { path: 'linked/escape.txt', content: 'no' }, options));
    assert.throws(() => localTool('write_file', { path: 'brief.md', content: 'no' }, { cwd: root, tools: ['Read'] }));
  } finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); }
});

test('saved provider choice controls boss and workers, and never silently falls back to Claude', () => {
  const c = catalog(); c.routing = { model: 'codex' };
  for (const role of ['boss', 'researcher', 'designer', 'tester']) assert.equal(chooseRoute(c, { role, model: 'opus', effort: 'high' }).provider, 'codex');
  c.routing.model = 'ollama/qwen3.5:latest';
  assert.equal(chooseRoute(c, { role: 'boss', model: 'opus' }).model, 'qwen3.5:latest');
  c.routing.model = 'codex'; c.models.find(m => m.provider === 'codex').available = false;
  assert.throws(() => chooseRoute(c, { role: 'boss' }), /Vybraný model/);
  c.routing.model = 'auto'; c.models.find(m => m.provider === 'claude').available = false;
  assert.throws(() => chooseRoute(c, { role: 'boss' }), /Žádný model/);
});
test('provider pause and selection persist without erasing recorded quota', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-settings-')), before = process.env.AGENT_OFFICE_HOME;
  process.env.AGENT_OFFICE_HOME = root;
  try {
    fs.writeFileSync(path.join(root, 'provider-state.json'), JSON.stringify({ claude: { windows: [{ usedPercent: 100 }] } }));
    const until = Date.now() + 172800000;
    updateRouting({ model: 'codex', pauseProvider: 'claude', pauseUntil: until });
    const saved = JSON.parse(fs.readFileSync(path.join(root, 'provider-state.json')));
    assert.equal(routingPreference().model, 'codex'); assert.equal(saved.routing.model, 'codex'); assert.equal(saved.claude.pausedUntil, until); assert.equal(saved.claude.windows[0].usedPercent, 100);
    assert.throws(() => updateRouting({ model: 'bad/model' }), /Neplatná/);
    updateRouting({ pauseProvider: 'claude', pauseUntil: 0 });
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'provider-state.json'))).routing.model, 'codex');
  } finally { if (before === undefined) delete process.env.AGENT_OFFICE_HOME; else process.env.AGENT_OFFICE_HOME = before; fs.rmSync(root, { recursive: true, force: true }); }
});

test('per-agent choice beats legacy team selection, accepts colon IDs, and keeps effort independent', () => {
  const c = catalog(); c.routing = { model: 'claude/opus' };
  const r = chooseRoute(c, { role: 'designer', pinned: true, agentOverride: true, model: 'codex:worker', provider: 'claude', effort: 'low', effortOverride: true });
  assert.equal(r.id, 'codex/worker'); assert.equal(r.effort, 'low');
  assert.equal(chooseRoute(c, { role: 'boss', pinned: true, agentOverride: true, model: 'claude:opus', effort: 'medium', effortOverride: true }).effort, 'medium');
  c.models.find(m => m.provider === 'codex').available = false;
  assert.throws(() => chooseRoute(c, { pinned: true, agentOverride: true, model: 'codex:worker' }), /Vybraný model/);
});

test('Ollama Llama adapter uses only localhost, executes a local file tool and returns structured output', async () => {
  const { runLocal } = await import('../local-runner.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llama-adapter-')), original = globalThis.fetch, events = [];
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(options.body); assert.equal(body.model, 'llama3.2:latest');
    assert.equal(options.headers.authorization, undefined);
    const message = calls++ === 0 ? { role: 'assistant', content: '', tool_calls: [{ function: { name: 'write_file', arguments: { path: 'deliverables/test.md', content: 'Local Llama fixture' } } }] } : { role: 'assistant', content: '{"reply":"ok"}' };
    return { ok: true, json: async () => ({ message, prompt_eval_count: 5, eval_count: 2 }) };
  };
  try {
    const result = await runLocal({ dir }, { model: 'llama3.2:latest', effort: 'low', cwd: dir, tools: ['Read', 'Write'], schema: { type: 'object', required: ['reply'] }, system: 'Test', prompt: 'Write the fixture' }, { entry: {}, onEvent: e => events.push(e), onChild: () => {} });
    assert.equal(result.data.reply, 'ok'); assert.equal(result.provider, 'ollama');
    assert.equal(fs.readFileSync(path.join(dir, 'deliverables/test.md'), 'utf8'), 'Local Llama fixture');
    assert.ok(events.some(e => e.tool === 'Write')); assert.equal(result.usage.input_tokens, 10);
  } finally { globalThis.fetch = original; fs.rmSync(dir, { recursive: true, force: true }); }
});
