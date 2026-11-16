import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chooseRoute, runGemini } from '../providers.mjs';

const catalog = {
  routing: { model: 'auto' },
  providers: [{ id: 'claude', remainingPercent: 80 }, { id: 'gemini', remainingPercent: null }],
  models: [
    { id: 'claude/sonnet', provider: 'claude', model: 'sonnet', tier: 'balanced', available: true, efforts: ['medium'] },
    { id: 'gemini/auto', provider: 'gemini', model: 'auto', tier: 'balanced', available: true, manual: true, efforts: ['medium'] },
  ],
};

test('Gemini is never picked automatically, only when chosen for an agent', () => {
  assert.equal(chooseRoute(catalog, { role: 'researcher', task: 'study' }).provider, 'claude');
  assert.equal(chooseRoute(catalog, { role: 'researcher', task: 'study', model: 'gemini/auto', pinned: true }).provider, 'gemini');
});

test('Gemini runner reads the JSON envelope and never enables yolo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-gemini-')), bin = path.join(dir, 'gemini'), argsFile = path.join(dir, 'args');
  fs.writeFileSync(bin, `#!/bin/sh\nprintf '%s\\n' "$@" > '${argsFile}'\necho '{"response":"{\\\\"summary\\\\":\\\\"hotovo\\\\"}","stats":{}}'\n`); fs.chmodSync(bin, 0o755);
  const old = process.env.GEMINI_BIN; process.env.GEMINI_BIN = bin;
  try {
    const events = [];
    const r = await runGemini({ dir }, { model: 'auto', system: 's', prompt: 'p', bash: true, tools: ['Write'], schema: { type: 'object', properties: { summary: { type: 'string' } } }, cwd: dir }, { entry: {}, onEvent: (e) => events.push(e), onChild: () => {} });
    assert.equal(r.data.summary, 'hotovo');
    assert.equal(events[0].text, 'hotovo');
    const args = fs.readFileSync(argsFile, 'utf8').split('\n');
    assert.ok(args.includes('auto_edit') && !args.includes('--yolo'));
  } finally { if (old === undefined) delete process.env.GEMINI_BIN; else process.env.GEMINI_BIN = old; }
});
