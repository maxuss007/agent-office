import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { newer, readVersion, checkUpdate, applyUpdate } from '../updater.mjs';

test('version compare', () => {
  assert.equal(newer('1.2.0', '1.1.9'), true);
  assert.equal(newer('1.10.0', '1.9.0'), true);
  assert.equal(newer('1.1', '1.1.0'), false);
  assert.equal(newer('1.0.0', '1.0.1'), false);
});

// a fake GitHub: version.json plus a tarball shaped like codeload's (one top folder, app in agent-office/)
async function fakeGitHub(version, { shell = 1, broken = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-gh-'));
  const app = path.join(dir, 'repo-main', 'agent-office');
  fs.mkdirSync(path.join(app, 'public'), { recursive: true }); fs.mkdirSync(path.join(app, 'roles'));
  fs.writeFileSync(path.join(app, 'server.mjs'), broken ? 'this is not javascript (' : 'export const ok = 1;\n');
  fs.writeFileSync(path.join(app, 'public', 'index.html'), '<p>new</p>');
  fs.writeFileSync(path.join(app, 'roles', 'x.md'), 'role');
  fs.writeFileSync(path.join(app, 'version.json'), JSON.stringify({ version, shell }));
  execFileSync('/usr/bin/tar', ['-czf', path.join(dir, 'src.tgz'), '-C', dir, 'repo-main']);
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/version.json')) { res.end(JSON.stringify({ version, shell, notes: 'novinky' })); return; }
    if (req.url === '/src.tgz') { res.end(fs.readFileSync(path.join(dir, 'src.tgz'))); return; }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-home-'));
  Object.assign(process.env, { AGENT_OFFICE_HOME: home, AGENT_OFFICE_APP: '1', AGENT_OFFICE_SHELL: '2', AGENT_OFFICE_UPDATE_REPO: 'someone/agent-office',
    AGENT_OFFICE_UPDATE_URL: `${base}/version.json`, AGENT_OFFICE_UPDATE_TARBALL: `${base}/src.tgz` });
  return { home, close: () => srv.close() };
}

test('finds a newer version and installs it next to the app data', async () => {
  const gh = await fakeGitHub('99.0.0');
  try {
    const c = await checkUpdate(true);
    assert.equal(c.current, readVersion().version);
    assert.equal(c.available, true); assert.equal(c.latest, '99.0.0'); assert.equal(c.needsApp, false); assert.equal(c.notes, 'novinky');
    const r = await applyUpdate();
    assert.deepEqual(r, { ok: true, version: '99.0.0', restart: true });
    const cur = JSON.parse(fs.readFileSync(path.join(gh.home, 'app', 'current.json'), 'utf8'));
    assert.equal(cur.version, '99.0.0');
    assert.equal(fs.readFileSync(path.join(cur.dir, 'public', 'index.html'), 'utf8'), '<p>new</p>');
    assert.ok(fs.existsSync(path.join(cur.dir, 'roles', 'x.md')));
    assert.deepEqual(fs.readdirSync(path.join(gh.home, 'app')).sort(), ['99.0.0', 'current.json']);
  } finally { gh.close(); }
});

test('asks for a new app when the update needs a newer Mac shell', async () => {
  const gh = await fakeGitHub('99.0.0', { shell: 3 });
  try {
    const c = await checkUpdate(true);
    assert.equal(c.needsApp, true);
    await assert.rejects(applyUpdate(), /novou aplikaci/);
  } finally { gh.close(); }
});

test('never switches to an update that does not parse', async () => {
  const gh = await fakeGitHub('99.0.0', { broken: true });
  try {
    await assert.rejects(applyUpdate());
    assert.equal(fs.existsSync(path.join(gh.home, 'app', 'current.json')), false);
  } finally { gh.close(); }
});

test('no update when nothing newer is published, and none outside the app', async () => {
  const gh = await fakeGitHub(readVersion().version);
  try {
    assert.equal((await checkUpdate(true)).available, false);
    process.env.AGENT_OFFICE_APP = '';
    await assert.rejects(applyUpdate(), /git pull/);
  } finally { gh.close(); }
});
