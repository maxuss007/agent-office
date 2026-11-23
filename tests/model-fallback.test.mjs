import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRoute, isModelUnavailable } from '../providers.mjs';

const mk = (id, available, extra = {}) => ({ id, provider: 'claude', model: id.split('/')[1], tier: 'deep', available, remainingPercent: 80, ...extra });
const catalog = (routing = 'auto') => ({
  routing: { model: routing }, features: {},
  providers: [{ id: 'claude', available: true, remainingPercent: 80, windows: [] }],
  models: [mk('claude/fable', false, { tier: 'frontier', unavailableReason: 'Fable requires usage credits' }), mk('claude/opus', true), mk('claude/sonnet', true, { tier: 'balanced' })],
});

test('a model the account cannot use is recognised, a glitch is not', () => {
  assert.equal(isModelUnavailable('Fable 5.2 requires usage credits. Switch to another model, or manage usage credits at https://claude.ai/settings/usage'), true);
  assert.equal(isModelUnavailable('claude exited without result: overloaded'), false);
  assert.equal(isModelUnavailable("You've hit your usage limit"), false);
});

test('Fable without access falls back to Opus: auto, pinned and global choice', () => {
  assert.equal(chooseRoute(catalog(), { role: 'boss', task: 'synthesis' }).id, 'claude/opus');
  assert.equal(chooseRoute(catalog(), { role: 'research', task: 'x', model: 'claude/fable', pinned: true }).id, 'claude/opus');
  assert.equal(chooseRoute(catalog('claude/fable'), { role: 'boss', task: 'x' }).id, 'claude/opus');
});
