import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanClaudeProjects } from '../claude-bridge.mjs';

test('discovers real cwd independent of folder encoding and retains old sessions', () => {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-bridge-'));
  try {
    const dir = path.join(config, 'projects', 'hashed-or-unicode-folder'); fs.mkdirSync(dir, { recursive: true });
    const cwd = fs.realpathSync(process.cwd());
    const file = path.join(dir, 'history.jsonl');
    const events = [
      { type: 'user', cwd, message: { content: 'Review the pitch' } },
      { type: 'custom-title', customTitle: 'Pitch review' },
      { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'brief.md' } }] } },
      { type: 'assistant', message: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Finished reviewing.' }] } },
    ];
    fs.writeFileSync(file, events.map((e) => JSON.stringify(e, null, 0)).join('\n') + '\n{"partial":');
    const old = new Date(Date.now() - 86400000); fs.utimesSync(file, old, old);
    const result = scanClaudeProjects(config);
    assert.equal(result.problem, null); assert.equal(result.sessions.length, 1);
    const s = result.sessions[0]; assert.equal(s.path, cwd); assert.equal(s.title, 'Pitch review'); assert.equal(s.active, false);
    assert.equal(s.recent[0].tool, 'Read'); assert.equal(s.recent.at(-1).text, 'Finished reviewing.');
    // A final assistant response must never look busy, even with a fresh timestamp.
    fs.utimesSync(file, new Date(), new Date()); assert.equal(scanClaudeProjects(config).sessions[0].active, false);
  } finally { fs.rmSync(config, { recursive: true, force: true }); }
});

test('new tool activity appears without dropping the first transcript line', () => {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-bridge-'));
  try {
    const dir = path.join(config, 'projects', 'arbitrary'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'active.jsonl'), JSON.stringify({ type: 'assistant', cwd: process.cwd(), message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'index.html' } }] } }) + '\n');
    const s = scanClaudeProjects(config).sessions[0]; assert.equal(s.active, true); assert.equal(s.recent[0].tool, 'Edit');
    assert.equal(scanClaudeProjects(path.join(config, 'missing')).problem, 'missing');
  } finally { fs.rmSync(config, { recursive: true, force: true }); }
});
