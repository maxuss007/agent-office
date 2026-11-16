import test from 'node:test';
import assert from 'node:assert/strict';
import { providerEnv, saveClaudeToken } from '../provider-auth.mjs';

test('subscription auth reaches Claude only and never spills into Codex environments', () => {
  const keys = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY', 'CODEX_API_KEY'];
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const k of keys) process.env[k] = 'fixture-secret';
    const claude = providerEnv('claude'), codex = providerEnv('codex');
    assert.equal(claude.CLAUDE_CODE_OAUTH_TOKEN, 'fixture-secret');
    for (const k of keys) { assert.equal(codex[k], undefined); if (k !== 'CLAUDE_CODE_OAUTH_TOKEN') assert.equal(claude[k], undefined); }
    assert.equal(process.env.ANTHROPIC_API_KEY, 'fixture-secret');
    assert.throws(() => saveClaudeToken('invalid'), /OAuth|macOS/);
  } finally { for (const k of keys) if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; }
});
