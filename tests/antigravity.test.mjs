import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chooseRoute, runAntigravity } from '../providers.mjs';

const catalog = {
  routing: { model: 'auto' },
  providers: [{ id: 'claude', remainingPercent: 80 }, { id: 'antigravity', remainingPercent: null }],
  models: [
    { id: 'claude/sonnet', provider: 'claude', model: 'sonnet', tier: 'balanced', available: true, efforts: ['medium'] },
    { id: 'antigravity/auto', provider: 'antigravity', model: 'auto', tier: 'balanced', available: true, manual: true, efforts: ['medium'] },
  ],
};

test('Antigravity is never picked automatically, only when chosen for an agent', () => {
  assert.equal(chooseRoute(catalog, { role: 'designer', task: 'copy' }).provider, 'claude');
  assert.equal(chooseRoute(catalog, { role: 'designer', task: 'copy', model: 'antigravity/auto', pinned: true }).provider, 'antigravity');
});

test('Antigravity runner reads structured_output from the agy JSON result', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-agy-')), bin = path.join(dir, 'agy'), argsFile = path.join(dir, 'args');
  fs.writeFileSync(bin, `#!/bin/sh\nprintf '%s\\n' "$@" > '${argsFile}'\necho '{"status":"SUCCESS","response":"x","structured_output":{"summary":"hotovo"},"usage":{"input_tokens":10,"output_tokens":5}}'\n`); fs.chmodSync(bin, 0o755);
  const old = process.env.AGY_BIN; process.env.AGY_BIN = bin;
  try {
    const events = [];
    const r = await runAntigravity({ dir }, { model: 'auto', effort: 'high', system: 's', prompt: 'p', tools: ['Write'], schema: { type: 'object', properties: { summary: { type: 'string' } } }, cwd: dir }, { entry: {}, onEvent: (e) => events.push(e), onChild: () => {} });
    assert.equal(r.data.summary, 'hotovo');
    assert.equal(events[0].text, 'hotovo');
    const args = fs.readFileSync(argsFile, 'utf8').split('\n');
    assert.ok(args.includes('--json-schema') && args.includes('accept-edits') && args.includes('high'));
    assert.ok(!args.includes('--dangerously-skip-permissions'));
  } finally { if (old === undefined) delete process.env.AGY_BIN; else process.env.AGY_BIN = old; }
});

test('a failed Antigravity run reports its error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-agy-')), bin = path.join(dir, 'agy');
  fs.writeFileSync(bin, `#!/bin/sh\necho '{"status":"ERROR","error":"unknown model"}'\nexit 1\n`); fs.chmodSync(bin, 0o755);
  const old = process.env.AGY_BIN, home = process.env.AGENT_OFFICE_HOME; process.env.AGY_BIN = bin; process.env.AGENT_OFFICE_HOME = dir;
  try {
    await assert.rejects(runAntigravity({ dir }, { model: 'x', system: 's', prompt: 'p', schema: { type: 'object', properties: {} }, cwd: dir }, { entry: {}, onEvent: () => {}, onChild: () => {} }), /unknown model/);
  } finally { if (old === undefined) delete process.env.AGY_BIN; else process.env.AGY_BIN = old; if (home === undefined) delete process.env.AGENT_OFFICE_HOME; else process.env.AGENT_OFFICE_HOME = home; }
});
