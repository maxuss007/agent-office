#!/usr/bin/env node
// MCP server (stdio) that lets agents use the Mac: see the screen, click and type, open and control apps,
// search files, use the clipboard. Every action goes through the Agent Office permission broker first.
// It also provides `approve`, the tool Claude Code calls (--permission-prompt-tool) before anything not pre-allowed.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { helperPath, forbidden } from './permissions.mjs';

const E = process.env;
const ctx = { project: E.AO_PROJECT || '', projectName: E.AO_PROJECT_NAME || '', agent: E.AO_AGENT || 'agent', agentName: E.AO_AGENT_NAME || E.AO_AGENT || 'agent', cwd: E.AO_CWD || process.cwd(), lang: E.AO_LANG === 'cs' ? 'cs' : 'en' };
const SHOTS = E.AO_SHOTS || path.join(os.tmpdir(), 'agent-office-shots');

function post(route, body) { // no timeout: the user may take a while to answer
  return new Promise((ok) => {
    let u; try { u = new URL(route, E.AO_URL); } catch { return ok({ error: 'Agent Office neběží.' }); }
    const data = JSON.stringify(body);
    const r = http.request(u, { method: 'POST', headers: { 'content-type': 'application/json', 'x-token': E.AO_TOKEN || '', 'content-length': Buffer.byteLength(data) } }, (res) => {
      let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => { try { ok(JSON.parse(b)); } catch { ok({ error: b.slice(0, 200) }); } });
    });
    r.on('error', (e) => ok({ error: e.message })); r.end(data);
  });
}
const ask = (category, key, cs, en, alwaysAsk = false) => post('/api/permissions/request', { ...ctx, category, key, cs, en, alwaysAsk });
const run = (bin, args, opts = {}) => new Promise((ok) => execFile(bin, args, { timeout: 60000, maxBuffer: 32e6, ...opts }, (err, out, errOut) => ok({ err, out: String(out || ''), errOut: String(errOut || '') })));
const text = (t, isError = false) => ({ content: [{ type: 'text', text: String(t) }], isError });
const denied = (r) => text(`Nepovoleno: ${r.message || r.error || 'uživatel akci nepovolil'}`, true);
const helper = async (args) => {
  const h = helperPath(); if (!h) return { err: new Error('Pomocník pro ovládání Macu chybí (nainstaluj aplikaci Agent Office).') };
  const r = await run(h, args, { timeout: 20000 });
  if (/accessibility-denied/.test(r.errOut)) r.err = new Error('macOS zatím nedovolil ovládat myš a klávesnici. Požádej uživatele: Agent Office → Přístup k Macu → Zpřístupnění.');
  return r;
};

const TOOLS = [
  { name: 'approve', description: 'Internal: Agent Office permission check. Do not call this yourself.', inputSchema: { type: 'object', properties: { tool_name: { type: 'string' }, input: { type: 'object' }, tool_use_id: { type: 'string' } }, required: ['tool_name', 'input'] } },
  { name: 'screenshot', description: 'Take a screenshot of the Mac screen (or a region) to see what is open. Coordinates in the image are screen points usable by click/drag directly (unless a scale factor is stated).', inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' } } } },
  { name: 'click', description: 'Click at screen point x,y (from screenshot). button: left (default), right or double.', inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, button: { type: 'string', enum: ['left', 'right', 'double'] } }, required: ['x', 'y'] } },
  { name: 'drag', description: 'Drag with the mouse from x1,y1 to x2,y2.', inputSchema: { type: 'object', properties: { x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' } }, required: ['x1', 'y1', 'x2', 'y2'] } },
  { name: 'type_text', description: 'Type text into the focused field, like a person typing.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'press_keys', description: 'Press a key or shortcut, e.g. "return", "escape", "cmd+s", "cmd+shift+4", "down".', inputSchema: { type: 'object', properties: { keys: { type: 'string' } }, required: ['keys'] } },
  { name: 'scroll', description: 'Scroll the content under the mouse. dy > 0 scrolls up, dy < 0 down (pixels).', inputSchema: { type: 'object', properties: { dy: { type: 'number' }, dx: { type: 'number' } }, required: ['dy'] } },
  { name: 'open', description: 'Open a file, folder or URL, optionally in a specific app (e.g. app "Safari", "Preview", "Pages"). Also launches an app when only app is given.', inputSchema: { type: 'object', properties: { target: { type: 'string' }, app: { type: 'string' } } } },
  { name: 'list_apps', description: 'List running apps, the frontmost app and visible windows with their positions.', inputSchema: { type: 'object', properties: {} } },
  { name: 'applescript', description: 'Run AppleScript to control an app (Safari tabs, Finder, Music, Notes, Calendar, Keynote…). Prefer this over clicking when the app is scriptable.', inputSchema: { type: 'object', properties: { script: { type: 'string' } }, required: ['script'] } },
  { name: 'find_files', description: 'Search the Mac for files by name or content with Spotlight. Optional folder limits the search.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, folder: { type: 'string' }, by_name: { type: 'boolean' } }, required: ['query'] } },
  { name: 'clipboard', description: 'Read the clipboard, or set it when text is given.', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } },
  { name: 'notify', description: 'Show a macOS notification to the user (e.g. when something long finished).', inputSchema: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['text'] } },
];

const appsIn = (script) => [...new Set([...String(script).matchAll(/(?:tell|application)\s+(?:application\s+)?(?:id\s+)?"([^"]+)"/gi)].map((m) => m[1]))];
const RISKY_SCRIPT = /\b(send|delete|empty trash|move .* to trash|erase|purchase|buy|keystroke|do shell script|quit)\b/i;

async function call(name, a = {}) {
  switch (name) {
    case 'approve': {
      const r = await post('/api/permissions/check', { ...ctx, tool: a.tool_name, input: a.input || {} });
      return text(JSON.stringify(r.behavior ? r : { behavior: 'deny', message: r.error || 'Kontrola povolení selhala.' }));
    }
    case 'screenshot': {
      const r = await ask('screen', 'screen', ['Podívat se na obrazovku', 'Agent si udělá snímek obrazovky, aby viděl, co je otevřené.'], ['Look at the screen', 'The agent takes a screenshot to see what is open.']);
      if (!r.allow) return denied(r);
      fs.mkdirSync(SHOTS, { recursive: true });
      const f = path.join(SHOTS, `shot-${Date.now()}.png`), j = f.replace(/\.png$/, '.jpg');
      const region = a.width && a.height ? ['-R', `${Math.round(a.x || 0)},${Math.round(a.y || 0)},${Math.round(a.width)},${Math.round(a.height)}`] : [];
      const s = await run('/usr/sbin/screencapture', ['-x', '-t', 'png', ...region, f]);
      if (s.err || !fs.existsSync(f)) return text('Snímek se nepovedl. macOS pravděpodobně zatím nedovolil nahrávání obrazovky – požádej uživatele: Agent Office → Přístup k Macu → Nahrávání obrazovky.', true);
      let w = a.width, h = a.height;
      if (!w) { const sc = await helper(['screen']); try { ({ width: w, height: h } = JSON.parse(sc.out)); } catch {} }
      let factor = 1;
      if (w && h) { const max = 1600; if (w > max) { factor = w / max; h = Math.round(h / factor); w = max; } await run('/usr/bin/sips', ['-z', String(Math.round(h)), String(Math.round(w)), f]); }
      await run('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', f, '--out', j]);
      const data = fs.readFileSync(fs.existsSync(j) ? j : f).toString('base64');
      try { fs.unlinkSync(f); } catch {}
      const off = region.length ? ` Region starts at screen point ${a.x || 0},${a.y || 0}: add that offset to image coordinates.` : '';
      return { content: [{ type: 'image', data, mimeType: fs.existsSync(j) ? 'image/jpeg' : 'image/png' }, { type: 'text', text: `Screenshot ${w}×${h}.${factor !== 1 ? ` Multiply image coordinates by ${factor.toFixed(3)} to get screen points.` : ' Image pixels = screen points.'}${off}` }] };
    }
    case 'click': case 'drag': case 'type_text': case 'press_keys': case 'scroll': {
      const what = { click: ['Kliknout myší', 'Click the mouse'], drag: ['Táhnout myší', 'Drag with the mouse'], type_text: ['Napsat text', 'Type text'], press_keys: [`Stisknout ${a.keys}`, `Press ${a.keys}`], scroll: ['Posunout obsah', 'Scroll'] }[name];
      const detail = name === 'type_text' ? String(a.text).slice(0, 200) : name === 'click' ? `${Math.round(a.x)}, ${Math.round(a.y)}` : '';
      if (name === 'type_text' && /password|heslo|passcode/i.test(String(a.text))) return text('Hesla agenti nepíšou. Požádej uživatele, ať se přihlásí sám.', true);
      const r = await ask('control', 'control', [what[0], detail], [what[1], detail]); if (!r.allow) return denied(r);
      const args = name === 'click' ? ['click', a.x, a.y, a.button || 'left'] : name === 'drag' ? ['drag', a.x1, a.y1, a.x2, a.y2] : name === 'type_text' ? ['type', a.text] : name === 'press_keys' ? ['key', a.keys] : ['scroll', a.dy, a.dx || 0];
      const h = await helper(args.map(String)); return h.err ? text(h.err.message, true) : text('OK');
    }
    case 'open': {
      if (!a.target && !a.app) return text('Zadej target nebo app.', true);
      if (forbidden(`${a.target} ${a.app}`)) return text('Tohle Agent Office nedovolí (systémová nastavení / citlivá data).', true);
      const label = [a.app, a.target].filter(Boolean).join(' → ');
      const r = await ask('open', null, ['Otevřít', label], ['Open', label]); if (!r.allow) return denied(r);
      const o = await run('/usr/bin/open', [...(a.app ? ['-a', a.app] : []), ...(a.target ? [a.target] : [])]);
      return o.err ? text(o.errOut || o.err.message, true) : text('Otevřeno.');
    }
    case 'list_apps': {
      const apps = await helper(['apps']), wins = await helper(['windows']);
      return text(`Apps: ${apps.out.trim()}\nWindows: ${wins.out.trim().slice(0, 6000)}`);
    }
    case 'applescript': {
      const script = String(a.script || '');
      const why = forbidden(script); if (why) return text(`Tohle Agent Office nedovolí (${why}).`, true);
      const apps = appsIn(script); const risky = RISKY_SCRIPT.test(script);
      const one = apps.length === 1 ? apps[0] : null;
      const r = await ask('apps', one && !risky ? `apps:${one}` : null,
        [one ? `Ovládat aplikaci ${one}` : `Ovládat aplikace ${apps.join(', ') || ''}`.trim(), `${risky ? '⚠︎ Může něco odeslat, smazat nebo zavřít.\n' : ''}${script.slice(0, 600)}`],
        [one ? `Control the app ${one}` : `Control apps ${apps.join(', ') || ''}`.trim(), `${risky ? '⚠︎ May send, delete or close something.\n' : ''}${script.slice(0, 600)}`], risky || !one);
      if (!r.allow) return denied(r);
      const o = await run('/usr/bin/osascript', ['-e', script], { timeout: 120000 });
      if (o.err && /-1743|not allowed|Not authorized/i.test(o.errOut)) return text('macOS zatím nedovolil ovládat tuto aplikaci. Požádej uživatele: Nastavení systému → Soukromí → Automatizace → Agent Office.', true);
      return o.err ? text(o.errOut || o.err.message, true) : text(o.out.slice(0, 20000) || 'OK');
    }
    case 'find_files': {
      const r = await ask('find', null, ['Hledat soubory', String(a.query)], ['Search files', String(a.query)]); if (!r.allow) return denied(r);
      const args = [...(a.folder ? ['-onlyin', a.folder.replace(/^~/, os.homedir())] : []), ...(a.by_name ? ['-name', a.query] : [a.query])];
      const o = await run('/usr/bin/mdfind', args, { timeout: 30000 });
      const lines = o.out.split('\n').filter((l) => l && !forbidden(l)).slice(0, 60);
      return text(lines.length ? lines.join('\n') : 'Nic nenalezeno.');
    }
    case 'clipboard': {
      const set = typeof a.text === 'string';
      const r = await ask('clipboard', 'clipboard', [set ? 'Vložit text do schránky' : 'Přečíst schránku', set ? a.text.slice(0, 200) : ''], [set ? 'Put text on the clipboard' : 'Read the clipboard', set ? a.text.slice(0, 200) : '']);
      if (!r.allow) return denied(r);
      if (set) { await new Promise((ok) => { const c = execFile('/usr/bin/pbcopy', [], () => ok()); c.stdin.end(a.text); }); return text('OK'); }
      return text((await run('/usr/bin/pbpaste', [])).out.slice(0, 20000));
    }
    case 'notify': {
      await run('/usr/bin/osascript', ['-e', `display notification ${JSON.stringify(String(a.text).slice(0, 200))} with title ${JSON.stringify(String(a.title || 'Agent Office').slice(0, 60))}`]);
      return text('OK');
    }
  }
  return text(`Unknown tool ${name}`, true);
}

// ---------- JSON-RPC over stdio (one message per line) ----------
const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
let buf = '';
process.stdin.on('data', (d) => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    handle(m).catch((e) => m.id !== undefined && send({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: e.message } }));
  }
});
process.stdin.on('end', () => process.exit(0));
async function handle(m) {
  if (m.id === undefined) return; // notifications
  const reply = (result) => send({ jsonrpc: '2.0', id: m.id, result });
  if (m.method === 'initialize') return reply({ protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'agent-office-mac', version: '1.0.0' } });
  if (m.method === 'ping') return reply({});
  if (m.method === 'tools/list') return reply({ tools: E.AO_MAC_TOOLS === '0' ? TOOLS.filter((t) => t.name === 'approve') : TOOLS });
  if (m.method === 'tools/call') return reply(await call(m.params?.name, m.params?.arguments || {}));
  send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'Method not found' } });
}
