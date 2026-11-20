import { execFile } from 'node:child_process';
import { listOutputs, outputPath, outputPreview } from './project-outputs.mjs';
import http from 'node:http';
import { execFile as _execFile } from 'node:child_process';
import { syncSkillsForCodex } from './providers.mjs';
syncSkillsForCodex(); setInterval(syncSkillsForCodex, 10 * 60000).unref(); // learned skills from ~/.claude/skills reach Codex too
import { locate as _locate, cleanEnv as _cleanEnv } from './providers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { saveClaudeToken } from './provider-auth.mjs';
import { checkUpdate, applyUpdate, readVersion } from './updater.mjs';
import { providerCatalog, launchLogin, updateRouting } from './providers.mjs';
import { fileURLToPath } from 'node:url';
import { permBus, CATEGORIES as PERM_CATEGORIES, getPolicy, setPolicy, pendingList, request as permRequest, decide as permDecide, classify as permClassify, systemAccess, requestSystemAccess } from './permissions.mjs';
import { migrateManagedProjects, userLang, langName, retryNow, pauseProject, autoResume, openOfficeIn, usageReport, acceptProject, resumeProject, bus, setAgentOverride, routingChanged, createOffice, updateOffice, projectOverview, addManualRole, castList, flushRepos, stopAll, repoSummaries, suggestRepos, guestSessions, addRepo, removeRepo, getFeed, sendMessage, health, openLogin, DATA, listProjects, listPresets, startProject, stopProject, answer, getLive } from './orchestrator.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4747);
const HOST = process.env.HOST || '127.0.0.1'; // use HOST=0.0.0.0 to reach it from your phone (same wifi / tailscale)

// token for phone access
const cfgPath = path.join(DATA, 'config.json');
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
if (process.env.AGENT_OFFICE_TOKEN) cfg.token = process.env.AGENT_OFFICE_TOKEN;
if (!cfg.token) { cfg.token = crypto.randomBytes(12).toString('hex'); fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2)); }

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
const clients = new Set();
bus.on('update', (s) => { const m = `data: ${JSON.stringify(s)}\n\n`; for (const c of clients) c.write(m); });
bus.on('feed', (f) => { const m = `event: feed\ndata: ${JSON.stringify(f)}\n\n`; for (const c of clients) c.write(m); });
permBus.on('pending', (list) => { const m = `event: permission\ndata: ${JSON.stringify(list)}\n\n`; for (const c of clients) c.write(m); });
const permInfo = () => ({ pending: pendingList(), policy: getPolicy(), categories: PERM_CATEGORIES, system: systemAccess() });
/** Fill in names for a permission question coming from an agent's Mac tools server. */
function permCtx(b) {
  const st = b.project ? getLive(b.project) : null; const a = st?.agents?.[b.agent];
  return { project: String(b.project || ''), projectName: st?.repoName || b.projectName || '', agent: String(b.agent || ''), agentName: a?.name || b.agentName || b.agent || '', lang: userLang() };
}
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

http.createServer({ requestTimeout: 0 }, async (req, res) => { // no timeout: permission questions wait for the user
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(ROOT, 'public', 'index.html')));
  }
  if (url.pathname === '/art.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' }); return res.end(fs.readFileSync(path.join(ROOT, 'public', 'art.js'))); }
    if (/^\/assets\/suits\/(face\/|back\/|stand\/|walk\/|seat\/|front\/)?[a-z-]+\.png$/.test(url.pathname) || ['/avatars.js', '/office-suits.js', '/game.css', '/pro.css', '/i18n.js', '/icons.js'].includes(url.pathname)) {
      if (!fs.existsSync(path.join(ROOT, 'public', url.pathname.slice(1)))) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': url.pathname.endsWith('.png') ? 'image/png' : url.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', url.pathname.slice(1))));
    }
  const token = url.searchParams.get('t') || req.headers['x-token'];
  if (token !== cfg.token) return json(res, 401, { error: 'bad token' });
  try {
    if (url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      clients.add(res); req.on('close', () => clients.delete(res));
      return res.write(': hi\n\n');
    }
    if (url.pathname === '/api/state') return json(res, 200, { lang: userLang(), version: readVersion().version || '', cast: castList(), repos: repoSummaries(), projects: listProjects(), presets: listPresets(), cwd: process.env.AGENT_OFFICE_CWD || path.resolve(ROOT, '..') });
    if (url.pathname === '/api/settings' && req.method === 'POST') { // UI language for the app, agents and the Mac menu
      const b = await body(req); if (!['en', 'cs'].includes(b.lang)) return json(res, 400, { error: 'lang: en | cs' });
      let c = {}; try { c = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
      c.lang = b.lang; cfg.lang = b.lang; fs.writeFileSync(cfgPath, JSON.stringify(c, null, 2)); return json(res, 200, { lang: b.lang });
    }
    if (url.pathname === '/api/permissions' && req.method === 'GET') return json(res, 200, permInfo());
    if (url.pathname === '/api/permissions/request' && req.method === 'POST') { // from mac-mcp.mjs: waits until the user answers
      const b = await body(req); return json(res, 200, await permRequest({ ...permCtx(b), category: b.category, key: b.key || null, cs: b.cs, en: b.en, alwaysAsk: !!b.alwaysAsk }));
    }
    if (url.pathname === '/api/permissions/check' && req.method === 'POST') { // Claude's --permission-prompt-tool
      const b = await body(req); const v = permClassify(b.tool, b.input || {}, { cwd: b.cwd });
      if (v.verdict === 'allow') return json(res, 200, { behavior: 'allow', updatedInput: b.input || {} });
      if (v.verdict === 'deny') return json(res, 200, { behavior: 'deny', message: v.message });
      const r = await permRequest({ ...permCtx(b), category: v.category, key: v.key, cs: v.cs, en: v.en, alwaysAsk: !!v.alwaysAsk });
      return json(res, 200, r.allow ? { behavior: 'allow', updatedInput: b.input || {} } : { behavior: 'deny', message: r.message });
    }
    if (url.pathname === '/api/permissions/decide' && req.method === 'POST') { const b = await body(req); return json(res, 200, { ok: permDecide(b.id, b.choice) }); }
    if (url.pathname === '/api/permissions/policy' && req.method === 'POST') { setPolicy(await body(req)); return json(res, 200, permInfo()); }
    if (url.pathname === '/api/permissions/system' && req.method === 'POST') return json(res, 200, requestSystemAccess((await body(req)).what));
    if (url.pathname === '/api/install' && req.method === 'GET') { // what is installed (tools, plugins, recommended skills)
      const out = await new Promise((ok) => _execFile('/bin/bash', [path.join(ROOT, 'scripts', 'install.sh'), '--status'], { timeout: 30000, env: { ...process.env, PATH: [path.join(DATA, 'runtime', 'node', 'bin'), path.join(os.homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH].join(':') } }, (err, so) => ok(String(so || '{}'))));
      try { return json(res, 200, JSON.parse(out)); } catch { return json(res, 200, {}); }
    }
    if (url.pathname === '/api/install' && req.method === 'POST') { // one-click install of a missing tool (scripts/install.sh)
      const item = (await body(req)).item; if (!['node', 'claude', 'codex', 'gemini', 'antigravity', 'plugins', 'skills'].includes(item)) return json(res, 400, { error: 'unknown item' });
      const out = await new Promise((ok) => _execFile('/bin/bash', [path.join(ROOT, 'scripts', 'install.sh'), item], { timeout: 600000, maxBuffer: 1 << 22, env: { ...process.env, PATH: [path.join(DATA, 'runtime', 'node', 'bin'), path.join(os.homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH].join(':') } }, (err, so, se) => ok({ ok: !err, log: String(so || '') + String(se || '') })));
      const status = await new Promise((ok) => _execFile('/bin/bash', [path.join(ROOT, 'scripts', 'install.sh'), '--status'], { timeout: 30000, env: { ...process.env, PATH: [path.join(DATA, 'runtime', 'node', 'bin'), path.join(os.homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH].join(':') } }, (err, so) => { try { ok(JSON.parse(String(so))); } catch { ok(null); } }));
      providerCatalog(true).catch(() => {});   // refresh the provider list in the background (sign-in state, models)
      return json(res, 200, { ...out, status, log: out.log.split('\n').filter(Boolean).slice(-12).join('\n') });
    }
    if (url.pathname === '/api/update' && req.method === 'POST') { try { return json(res, 200, await applyUpdate()); } catch (e) { return json(res, 200, { error: e.message }); } }
    if (url.pathname === '/api/update') return json(res, 200, await checkUpdate(url.searchParams.has('force')));
    if (url.pathname === '/api/health') return json(res, 200, await health(url.searchParams.has('force')));
    if (url.pathname === '/api/providers/routing' && req.method === 'POST') { updateRouting(await body(req)); routingChanged(); return json(res, 200, await providerCatalog(true)); }
    const providerHealth = url.pathname.match(/^\/api\/providers\/(claude|codex|antigravity|gemini|ollama)\/health$/);
    if (providerHealth && req.method === 'GET') return json(res, 200, (await providerCatalog(url.searchParams.has('force'))).providers.find(p => p.id === providerHealth[1]));
    if (url.pathname === '/api/providers') return json(res, 200, await providerCatalog(url.searchParams.has('force')));
    if (url.pathname === '/api/login' && req.method === 'POST') { const b = await body(req); return json(res, 200, { ok: launchLogin(b.provider || 'claude', b.mode) }); }
    if (url.pathname === '/api/providers/claude/token' && req.method === 'POST') { saveClaudeToken((await body(req)).token); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/start' && req.method === 'POST') {
      if (!process.env.AGENT_OFFICE_SKIP_AUTH) { const c = await providerCatalog(); if (!c.models.some((m) => m.available)) return json(res, 400, { error: 'Není dostupný žádný model. Přihlas Claude nebo Codex, případně spusť Ollamu.' }); }
      return json(res, 200, startProject(await body(req)));
    }
    if (url.pathname === '/api/repos' && req.method === 'POST') { const b = await body(req); return json(res, 200, addRepo(b.path)); }
    if (url.pathname === '/api/offices' && req.method === 'POST') return json(res, 200, createOffice((await body(req)).name));
    if (url.pathname === '/api/repos/suggestions') return json(res, 200, { suggestions: suggestRepos() });
    const agentRoute = url.pathname.match(/^\/api\/repos\/([^/]+)\/agents\/([a-z0-9-]+)\/routing$/);
    if (agentRoute && req.method === 'PATCH') return json(res, 200, setAgentOverride(agentRoute[1], agentRoute[2], await body(req)));
    let m2 = url.pathname.match(/^\/api\/repos\/([^/]+)\/roles$/);
    if (m2 && req.method === 'POST') return json(res, 200, addManualRole(m2[1], await body(req)));
    m2 = url.pathname.match(/^\/api\/offices\/([^/]+)\/(outputs|output|open-output)$/);
    if(m2) {
      const overview=projectOverview(m2[1]);
      if(m2[2]==='outputs')return json(res,200,{files:listOutputs(overview)});
      const id=url.searchParams.get('file')||'';
      if(m2[2]==='open-output'&&req.method==='POST'){const file=outputPath(overview,id);if(process.platform!=='darwin')throw new Error('Otevření souboru vyžaduje Mac.');execFile('/usr/bin/open',[file],()=>{});return json(res,200,{ok:true});}
      if(m2[2]==='output') {
        if(url.searchParams.has('image')){const file=outputPath(overview,id),ext=path.extname(file).toLowerCase();if(!['.png','.jpg','.jpeg','.webp'].includes(ext))throw new Error('Není obrázek.');res.writeHead(200,{'content-type':MIME[ext],'x-content-type-options':'nosniff'});return res.end(fs.readFileSync(file));}
        return json(res,200,outputPreview(overview,id));
      }
    }
    m2 = url.pathname.match(/^\/api\/offices\/([^/]+)$/);
    if (m2 && req.method === 'PATCH') return json(res, 200, updateOffice(m2[1], await body(req)));
    if (m2 && req.method === 'GET') return json(res, 200, projectOverview(m2[1]));
    m2 = url.pathname.match(/^\/api\/repos\/([^/]+)\/(guests|remove)$/);
    if (m2) return json(res, 200, m2[2] === 'guests' ? { guests: guestSessions(m2[1]) } : { ok: removeRepo(m2[1]) });
    const m = url.pathname.match(/^\/api\/projects\/([^/]+)\/(answer|stop)$/);
    if (m && req.method === 'POST') {
      if (m[2] === 'stop') return json(res, 200, { ok: stopProject(m[1]) });
      const b = await body(req); return json(res, 200, { ok: answer(m[1], b.qid, b.value) });
    }
    m2 = url.pathname.match(/^\/api\/projects\/([^/]+)\/feed\/([a-z0-9-]+)$/);
    if (m2) return json(res, 200, { entries: getFeed(m2[1], m2[2]) });
    m2 = url.pathname.match(/^\/api\/offices\/([^/]+)\/open-in$/);
    if (m2 && req.method === 'POST') return json(res, 200, openOfficeIn(m2[1], (await body(req)).app));
    m2 = url.pathname.match(/^\/api\/projects\/([^/]+)\/(usage|accept|resume|pause|retry)$/);
    if (m2) { if (m2[2] === 'usage') return json(res, 200, usageReport(m2[1])); if (req.method !== 'POST') return json(res, 405, { error: 'POST' }); const b = await body(req); return json(res, 200, m2[2] === 'retry' ? retryNow(m2[1]) : m2[2] === 'pause' ? { ok: pauseProject(m2[1]) } : m2[2] === 'accept' ? acceptProject(m2[1], b) : resumeProject(m2[1], b)); }
    m2 = url.pathname.match(/^\/api\/projects\/([^/]+)\/agents\/([a-z0-9-]+)\/summary$/);
    if (m2 && req.method === 'POST') { // costs tokens -> only when the user asks for it
      const entries = getFeed(m2[1], m2[2]).slice(-80).map((e) => `${e.kind}: ${e.text || ''}`).join('\n').slice(-12000);
      if (!entries.trim()) return json(res, 200, { text: 'Zatím není co shrnout.' });
      const bin = _locate('claude'); if (!bin) return json(res, 400, { error: 'Claude není dostupný.' });
      const prompt = `Tohle je záznam práce jednoho agenta. Shrň ${langName() === 'Czech' ? 'česky' : 'anglicky (in English)'}, lidskou řečí a bez technických detailů (žádné názvy nástrojů, příkazů ani cest), ve 2–4 krátkých větách: na čem pracuje, co už udělal a co ho čeká. Záznam:\n${entries}`;
      const text = await new Promise((ok) => { const c = _execFile(bin, ['-p', '--model', 'haiku', '--output-format', 'text'], { env: _cleanEnv('claude'), timeout: 90000, maxBuffer: 1e6 }, (err, out) => ok(err ? null : String(out).trim())); c.stdin.end(prompt); });
      return text ? json(res, 200, { text }) : json(res, 500, { error: 'Shrnutí se nepovedlo.' });
    }
    m2 = url.pathname.match(/^\/api\/projects\/([^/]+)\/agents\/([a-z0-9-]+)\/message$/);
    if (m2 && req.method === 'POST') return json(res, 200, await sendMessage(m2[1], m2[2], (await body(req)).text));
    m2 = url.pathname.match(/^\/api\/projects\/([^/]+)\/file$/);
    if (m2) {
      const st = getLive(m2[1]); const f = fs.existsSync(url.searchParams.get('path') || '') ? fs.realpathSync(url.searchParams.get('path')) : null;
      const roots = st ? [path.join(DATA, 'projects', st.id), st.cwd].map((r) => { try { return fs.realpathSync(r); } catch { return r; } }) : [];
      if (!f || !MIME[path.extname(f).toLowerCase()] || !roots.some((r) => f.startsWith(r + path.sep))) return json(res, 403, { error: 'forbidden' });
      res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()], 'cache-control': 'max-age=60' }); return res.end(fs.readFileSync(f));
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) { return json(res, 400, { error: e.message }); }
}).listen(PORT, HOST, () => {
  process.env.AO_URL = `http://127.0.0.1:${PORT}`; process.env.AO_TOKEN = cfg.token; // agents' Mac tools ask this server for permission
  try { const m = migrateManagedProjects().filter((x) => x.files); if (m.length) console.log('Výstupy přesunuty do viditelných složek: ' + m.map((x) => `${x.name} (${x.files})`).join(', ')); } catch (e) { console.error(e.message); }
  if (!process.env.AGENT_OFFICE_NO_AUTORESUME) setTimeout(() => { try { const r = autoResume(); if (r.length) console.log('Pokračuji v projektech: ' + r.join(', ')); } catch (e) { console.error(e.message); } }, 1500);
  console.log(`Agent Office: http://localhost:${PORT}/?t=${cfg.token}`);
  if (HOST !== '127.0.0.1') for (const l of Object.values(os.networkInterfaces()).flat()) if (l && l.family === 'IPv4' && !l.internal) console.log(`  telefon: http://${l.address}:${PORT}/?t=${cfg.token}`);
});

for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => { flushRepos(); stopAll(); process.exit(0); });
