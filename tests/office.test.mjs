import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-test-'));
process.env.AGENT_OFFICE_HOME = home;
process.env.CLAUDE_CONFIG_DIR = path.join(home, 'claude');
const office = await import('../orchestrator.mjs');

test('one folder keeps one office and rejects duplicate or reserved roles', () => {
  const folder = path.join(home, 'client'); fs.mkdirSync(folder);
  const repo = office.addRepo(folder);
  assert.equal(office.addRepo(folder).id, repo.id);
  const first = office.addManualRole(repo.id, { title: 'Finance', character: 'donna' });
  assert.equal(first.manual, true);
  assert.throws(() => office.addManualRole(repo.id, { title: ' Finance ' }), /už/);
  assert.throws(() => office.addManualRole(repo.id, { title: 'boss' }), /už/);
  assert.throws(() => office.addManualRole(repo.id, { title: '   ' }), /název/);
  assert.throws(() => office.addManualRole(repo.id, { title: 'Other', model: 'invalid' }), /model/);
  for (let i = 0; i < 7; i++) office.addManualRole(repo.id, { title: `Writer ${i}`, character: 'donna' });
  const roles = office.repoSummaries().find((r) => r.id === repo.id).roles;
  assert.equal(roles.length, 8);
  assert.equal(new Set(roles.map((r) => r.name)).size, 8);
  assert.ok(roles.every((r) => !r.name.includes('undefined')));
  office.flushRepos();
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'repos.json')))[0].roles.length, 8);
});

test('manual hiring respects roles already hired by the Boss, after restart', () => {
  const folder = path.join(home, 'strategy'); fs.mkdirSync(folder);
  const repo = office.addRepo(folder);
  const dir = path.join(home, 'projects', 'seed'); fs.mkdirSync(dir, { recursive: true });
  repo.projectId = 'seed';
  const state = { id: 'seed', repoId: repo.id, cwd: folder, status: 'running', agents: {}, inbox: [], log: [], roles: [{ id: 'analyst', character: 'donna', name: 'Donna Paulsen', title: 'Analyst' }] };
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
  assert.equal(office.repoSummaries().find((r) => r.id === repo.id).status, 'interrupted');
  assert.throws(() => office.addManualRole(repo.id, { title: 'Analyst' }), /už/);
  const role = office.addManualRole(repo.id, { title: 'Coordinator', character: 'donna' });
  assert.equal(role.name, 'Donna Paulsen II');
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'state.json')));
  assert.ok(saved.roles.some((r) => r.id === role.id && r.manual));
  assert.equal(saved.directives.length, 1);
});

test('explicit CLI path supports custom executable filenames', () => {
  const bin = path.join(home, 'custom-claude'); fs.writeFileSync(bin, '#!/bin/sh\n'); fs.chmodSync(bin, 0o700);
  process.env.CLAUDE_BIN = bin;
  assert.equal(office.findBin('claude'), bin);
  delete process.env.CLAUDE_BIN;
});

test('creating an office creates its own committed git repository without global git configuration', () => {
  const a = office.createOffice('Pitch pro klienta');
  const b = office.createOffice('Průzkum trhu');
  assert.notEqual(a.id, b.id); assert.notEqual(a.path, b.path);
  assert.equal(a.name, 'Pitch pro klienta');
  assert.equal(office.addRepo(a.path).id, a.id);
  assert.equal(execFileSync('git', ['-C', a.path, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(), fs.realpathSync(a.path));
  assert.equal(execFileSync('git', ['-C', a.path, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim(), '1');
  assert.ok(fs.existsSync(path.join(a.path, 'deliverables'))); assert.ok(fs.existsSync(path.join(a.path, 'references')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(a.path, '.agent-office/project.json'))).id, a.id);
  office.updateOffice(a.id, { name: 'Klientský pitch', description: 'Srozumitelnější přehled', archived: true });
  assert.equal(office.projectOverview(a.id).name, 'Klientský pitch'); assert.equal(office.projectOverview(a.id).archived, true);
  assert.equal(office.projectOverview(a.id).repository, a.path);
  office.updateOffice(a.id, { archived: false }); assert.equal(office.projectOverview(a.id).archived, false);
  assert.throws(() => office.createOffice('Pitch pro klienta'), /už existuje/);
  for (const name of ['', '../escape', '..', 'a/b', 'a\\b']) assert.throws(() => office.createOffice(name));
});

test('office layout expands to 4, 6, 9, 12 and 20 employees on desktop and mobile', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../public/art.js', import.meta.url), 'utf8'), ctx);
  for (const count of [4, 6, 9, 12, 20]) for (const kind of ['wide', 'tall']) {
    const people = Array.from({ length: count - 1 }, (_, i) => ({ id: `role-${i}`, char: 'donna', name: `Member ${i}`, title: 'Analyst' }));
    const layout = ctx.officeLayout(kind, people, true);
    const places = Object.values(layout.spots);
    assert.equal(places.length, count + 2);
    assert.equal(new Set(places.map(([x, y]) => `${x},${y}`)).size, places.length);
    assert.ok(places.every(([x, y]) => x > 0 && x < layout.W && y > 0 && y < layout.H));
    ctx.layout = layout;
    const svg = vm.runInContext('sceneSvg(layout, THEMES.day, {guestTitle:"Guest"})', ctx);
    assert.ok(!/undefined|NaN/.test(svg));
    assert.equal((svg.match(/data-role=/g) || []).length, count + 2);
  }
});

test.after(() => { office.flushRepos(); fs.rmSync(home, { recursive: true, force: true }); });

test('agent overrides persist per office for base and hired agents, including before the first goal', () => {
  const a = office.createOffice('Routing A'), b = office.createOffice('Routing B');
  office.addManualRole(a.id, { title: 'Editor', model: 'opus', effort: 'high' });
  assert.deepEqual(office.setAgentOverride(a.id, 'boss', { model: 'codex:worker', effort: 'low' }), { model: 'codex/worker', effort: 'low' });
  office.setAgentOverride(a.id, 'designer', { model: 'ollama:llama3.2:latest' });
  office.setAgentOverride(a.id, 'editor', { model: 'auto', effort: 'auto' });
  office.setAgentOverride(a.id, 'boss', { effort: 'high' });
  const repos = JSON.parse(fs.readFileSync(path.join(home, 'repos.json')));
  assert.equal(repos.find(r => r.id === a.id).agentOverrides.boss.model, 'codex/worker');
  assert.equal(repos.find(r => r.id === a.id).agentOverrides.boss.effort, 'high');
  assert.equal(repos.find(r => r.id === a.id).roles[0].model, 'auto');
  assert.equal(repos.find(r => r.id === b.id).agentOverrides, undefined);
  assert.equal(office.repoSummaries().find(r => r.id === a.id).agentOverrides.designer.model, 'ollama/llama3.2:latest');
  assert.throws(() => office.setAgentOverride(a.id, 'nobody', { model: 'auto' }), /agent/);
  assert.equal(office.setAgentOverride(a.id, 'boss', { effort: 'ultra' }).effort, 'ultra'); office.setAgentOverride(a.id, 'boss', { effort: 'high' });
  for (const change of [{ model: 'bad' }, { model: 42 }, { effort: 'turbo' }]) assert.throws(() => office.setAgentOverride(a.id, 'boss', change));
});
