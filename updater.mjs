// Updates without a new download of the app: the Mac app keeps its signed shell, and the server + web UI
// (everything in this folder) can be replaced by a newer copy from GitHub.
//
// version.json (repo root) says which version this is and where updates come from:
//   { "version": "1.1.0", "shell": 1, "repo": "owner/name", "branch": "main", "notes": "…" }
//   version  version of the server and UI; bump it whenever you push something people should get
//   shell    version of the Mac app shell this code needs; bump it only when mac/AgentOffice.swift changes,
//            people then have to download the new DMG (the app shows a link to the latest release)
//   repo     GitHub repository "owner/name"; empty turns update checks off
//
// A downloaded update goes to <AGENT_OFFICE_HOME>/app/<version>/ and app/current.json points at it.
// The Mac app starts the server from there when it is newer than the copy inside the app.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const home = () => process.env.AGENT_OFFICE_HOME || ROOT;
const CHECK_EVERY = 6 * 3600e3;
const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,100}$/;
// what an update replaces: the same things mac/build.sh copies into the app's server folder
const FILES = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.mjs') || f === 'boss.md' || f === 'version.json');
const DIRS = ['public', 'roles', 'presets', 'scripts'];

export function readVersion(dir = ROOT) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8')); } catch { return { version: '0.0.0', shell: 1 }; } }
export function newer(a, b) { // is version a newer than b?
  const pa = String(a || '0').split('.').map((x) => parseInt(x, 10) || 0), pb = String(b || '0').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}
const source = () => { const v = readVersion(); const repo = String(process.env.AGENT_OFFICE_UPDATE_REPO || v.repo || ''); const branch = String(v.branch || 'main');
  return REPO_RE.test(repo) && BRANCH_RE.test(branch) ? { repo, branch } : null; };
const shellVersion = () => Number(process.env.AGENT_OFFICE_SHELL || 0);

let cache = null, busy = null;
async function fetchText(url, ms = 10000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'user-agent': 'agent-office-updater' } });
  if (!r.ok) throw new Error(`GitHub odpověděl ${r.status}`);
  return r;
}

export async function checkUpdate(force = false) {
  const cur = readVersion(), src = source();
  const base = { current: cur.version, app: process.env.AGENT_OFFICE_APP === '1', configured: !!src };
  if (!src) return { ...base, available: false };
  if (!force && cache && Date.now() - cache.at < CHECK_EVERY && cache.current === cur.version) return cache;
  try {
    const raw = process.env.AGENT_OFFICE_UPDATE_URL || `https://raw.githubusercontent.com/${src.repo}/${src.branch}/version.json`;
    const latest = await (await fetchText(`${raw}?t=${Date.now()}`)).json();
    const available = newer(latest.version, cur.version);
    const needsApp = available && shellVersion() > 0 && Number(latest.shell || 1) > shellVersion();
    cache = { ...base, at: Date.now(), latest: String(latest.version || ''), notes: String(latest.notes || '').slice(0, 2000), available, needsApp,
      download: `https://github.com/${src.repo}/releases/latest` };
  } catch (e) { cache = { ...base, at: Date.now(), available: false, error: `Novou verzi se nepodařilo zjistit: ${e.message}` }; }
  return cache;
}

const run = (cmd, args, opts = {}) => new Promise((ok, bad) => execFile(cmd, args, { maxBuffer: 1 << 24, ...opts }, (e, so, se) => (e ? bad(new Error(String(se || e.message).trim().slice(0, 300))) : ok(so))));

export function applyUpdate() { busy ||= doApply().finally(() => { busy = null; }); return busy; }
async function doApply() {
  if (process.env.AGENT_OFFICE_APP !== '1') throw new Error('Aktualizace jde jen v Mac aplikaci. Ve složce s kódem použij git pull.');
  const info = await checkUpdate(true);
  if (!info.available) throw new Error(info.error || 'Už máš nejnovější verzi.');
  if (info.needsApp) throw new Error('Tahle verze potřebuje novou aplikaci. Stáhni ji z GitHubu.');
  const src = source(), appDir = path.join(home(), 'app'), stage = path.join(appDir, `.stage-${Date.now()}`);
  fs.mkdirSync(stage, { recursive: true });
  try {
    const tgz = path.join(stage, 'src.tar.gz');
    const url = process.env.AGENT_OFFICE_UPDATE_TARBALL || `https://codeload.github.com/${src.repo}/tar.gz/refs/heads/${src.branch}`;
    fs.writeFileSync(tgz, Buffer.from(await (await fetchText(url, 120000)).arrayBuffer()));
    const out = path.join(stage, 'x'); fs.mkdirSync(out);
    await run('/usr/bin/tar', ['-xzf', tgz, '-C', out]);
    // GitHub wraps everything in one top folder; the app may live at its root or in an agent-office/ subfolder
    const top = fs.readdirSync(out).map((d) => path.join(out, d)).find((d) => fs.statSync(d).isDirectory());
    const srcDir = [top, top && path.join(top, 'agent-office')].find((d) => d && fs.existsSync(path.join(d, 'server.mjs')) && fs.existsSync(path.join(d, 'public', 'index.html')));
    if (!srcDir) throw new Error('Stažený balík neobsahuje Agent Office.');
    const got = readVersion(srcDir);
    if (!newer(got.version, readVersion().version)) throw new Error('Stažená verze není novější.');
    const dest = path.join(appDir, got.version.replace(/[^0-9A-Za-z.-]/g, '_')), tmp = `${dest}.new`;
    fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    for (const f of FILES(srcDir)) fs.copyFileSync(path.join(srcDir, f), path.join(tmp, f));
    for (const d of DIRS) if (fs.existsSync(path.join(srcDir, d))) fs.cpSync(path.join(srcDir, d), path.join(tmp, d), { recursive: true });
    await run(process.execPath, ['--check', path.join(tmp, 'server.mjs')]);   // never switch to code that does not even parse
    fs.rmSync(dest, { recursive: true, force: true }); fs.renameSync(tmp, dest);
    fs.writeFileSync(path.join(appDir, 'current.json'), JSON.stringify({ version: got.version, dir: dest, at: new Date().toISOString() }, null, 2));
    // keep the new version and the one running now, drop older downloads
    const keep = new Set([dest, ROOT]);
    for (const d of fs.readdirSync(appDir).map((x) => path.join(appDir, x)).filter((x) => !x.endsWith('.json') && !keep.has(x) && !path.basename(x).startsWith('.stage'))) {
      if (fs.statSync(d).mtimeMs < Date.now() - 60e3) fs.rmSync(d, { recursive: true, force: true });
    }
    cache = null;
    return { ok: true, version: got.version, restart: true };
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
