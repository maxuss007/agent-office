// Permission broker: agents may do most everyday things on their own, risky actions are asked about in plain language,
// and really dangerous ones are never allowed. Answers "Allow always" are remembered in permissions.json.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.AGENT_OFFICE_HOME || ROOT;
const HOME = os.homedir();
const FILE = () => path.join(DATA, 'permissions.json');
export const permBus = new EventEmitter();

/** What agents can be allowed to do, in words a non-technical person understands. default: 'always' | 'ask' | 'never' */
export const CATEGORIES = {
  open: { default: 'always', cs: ['Otevírat aplikace, soubory a odkazy', 'Například otevřít hotový web v prohlížeči nebo dokument v Pages.'], en: ['Open apps, files and links', 'For example open the finished website in the browser or a document in Pages.'] },
  find: { default: 'always', cs: ['Hledat soubory na Macu', 'Najít soubor podle názvu nebo obsahu (Spotlight). Nic nemění.'], en: ['Search for files on the Mac', 'Find a file by name or content (Spotlight). Changes nothing.'] },
  web: { default: 'always', cs: ['Číst stránky na internetu', 'Otevřít a přečíst veřejnou webovou stránku kvůli průzkumu.'], en: ['Read web pages', 'Open and read a public web page for research.'] },
  screen: { default: 'ask', cs: ['Vidět obrazovku', 'Udělat snímek obrazovky, aby agent viděl, co je otevřené – třeba když kontroluje aplikaci, kterou postavil.'], en: ['See the screen', 'Take a screenshot so the agent sees what is open – for example when it checks an app it built.'] },
  control: { default: 'ask', cs: ['Ovládat myš a klávesnici', 'Klikat, psát a posouvat jako člověk u počítače. Během toho na Mac raději nesahej.'], en: ['Use the mouse and keyboard', 'Click, type and scroll like a person at the computer. Best not to touch the Mac meanwhile.'] },
  apps: { default: 'ask', cs: ['Ovládat jiné aplikace', 'Říct aplikaci (Safari, Finder, Hudba…), co má udělat – například otevřít panel nebo přečíst text.'], en: ['Control other apps', 'Tell an app (Safari, Finder, Music…) what to do – for example open a tab or read text.'] },
  clipboard: { default: 'ask', cs: ['Číst a měnit schránku', 'Vložit nebo přečíst to, co máš zkopírované (Cmd+C).'], en: ['Read and change the clipboard', 'Paste or read what you copied (Cmd+C).'] },
  shell: { default: 'ask', cs: ['Spouštět další programy', 'Programy v Terminálu, které nejsou v seznamu běžných a bezpečných.'], en: ['Run other programs', 'Terminal programs that are not on the list of common, safe ones.'] },
  install: { default: 'ask', cs: ['Instalovat programy a knihovny', 'Například přes Homebrew nebo pip, když agent potřebuje nástroj, který na Macu chybí.'], en: ['Install programs and libraries', 'For example via Homebrew or pip when the agent needs a tool the Mac lacks.'] },
  files: { default: 'ask', cs: ['Měnit soubory mimo projekt', 'Uvnitř složky projektu agenti pracují sami. Tohle je pro ostatní místa na Macu.'], en: ['Change files outside the project', 'Inside the project folder agents work on their own. This is for other places on the Mac.'] },
  other: { default: 'ask', cs: ['Ostatní akce', 'Cokoli, co nespadá jinam.'], en: ['Other actions', 'Anything that does not fit elsewhere.'] },
};

// Never allowed, whatever anyone answers: system security, passwords, deleting everything, publishing code.
const NEVER = [
  [/(^|[\s;&|(])sudo\b|\bdoas\b/, 'správcovská práva (sudo)'],
  [/\brm\s+(-\w*r\w*f|-\w*f\w*r)\w*\s+(\/|~|\$HOME|\*)(\s|$)/, 'smazání všeho'],
  [/(^|[\s;&|])security\s+(find|dump|delete|export|unlock|set)/, 'klíčenka s hesly'],
  [/\b(csrutil|spctl|tccutil|systemsetup|networksetup|fdesetup|nvram|kextload|pfctl)\b/, 'zabezpečení systému'],
  [/\bdefaults\s+(write|delete)\s+(\/Library|com\.apple\.(security|loginwindow|screensaver|LaunchServices)|-g\b|NSGlobalDomain)/, 'systémová nastavení'],
  [/\bdiskutil\s+(erase|partition|apfs\s+delete)/, 'mazání disku'],
  [/\blaunchctl\s+(load|bootstrap|enable|submit)/, 'automatické spouštění na pozadí'],
  [/\bgit\s+push\b/, 'zveřejnění kódu (git push)'],
  [/\b(curl|wget)\b[^|]*\|\s*(ba|z)?sh\b/, 'spuštění staženého skriptu'],
  [/(~|\$HOME|\/Users\/[^/]+)\/(\.ssh|Library\/Keychains|Library\/Cookies|\.gnupg|\.aws|\.config\/gh)/, 'hesla a přístupové klíče'],
  [/administrator privileges/i, 'správcovská práva'],
  [/System (Settings|Preferences)|com\.apple\.preference\.security|x-apple\.systempreferences/i, 'systémová nastavení'],
];
export function forbidden(text) { const s = String(text || ''); for (const [re, why] of NEVER) if (re.test(s)) return why; return null; }

const loadP = () => { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch { return {}; } };
const saveP = (p) => { try { fs.writeFileSync(FILE(), JSON.stringify(p, null, 2)); } catch {} };
export function getPolicy() {
  const p = loadP(); const categories = {};
  for (const [k, c] of Object.entries(CATEGORIES)) categories[k] = p.categories?.[k] || c.default;
  return { categories, rules: p.rules || {}, macGuideDone: !!p.macGuideDone };
}
export function setPolicy({ category, value, rule, macGuideDone }) {
  const p = loadP();
  if (category) { if (!CATEGORIES[category] || !['always', 'ask', 'never'].includes(value)) throw new Error('Neplatné nastavení.'); (p.categories ||= {})[category] = value; }
  if (rule) { if (value === null || value === 'ask') delete (p.rules ||= {})[rule]; else (p.rules ||= {})[rule] = value; }
  if (macGuideDone !== undefined) p.macGuideDone = !!macGuideDone;
  saveP(p); permBus.emit('changed'); return getPolicy();
}

// ---------- requests waiting for the user ----------
const pending = new Map(); // id -> { req, resolve, timer }
export const pendingList = () => [...pending.values()].map((x) => x.req);
function notifyMac(title, text) {
  if (process.platform !== 'darwin' || process.env.AGENT_OFFICE_NO_NOTIFY) return;
  execFile('osascript', ['-e', `display notification ${JSON.stringify(text.slice(0, 180))} with title ${JSON.stringify(title)} sound name "Glass"`], () => {});
}
/**
 * Ask (or decide from the stored policy). req: { project, projectName, agent, agentName, category, key, cs: [title, detail], en: [...], alwaysAsk }
 * Resolves { allow, message }.
 */
export function request(req) {
  const pol = getPolicy();
  const rule = req.key && pol.rules[req.key];
  const cat = pol.categories[req.category] || 'ask';
  if (!req.alwaysAsk && (rule === 'always' || (!rule && cat === 'always'))) return Promise.resolve({ allow: true, auto: true });
  if (rule === 'never' || cat === 'never') return Promise.resolve({ allow: false, message: 'Uživatel tuto akci v nastavení zakázal. Najdi jiný postup, nebo napiš, proč je nutná.' });
  // the same question from the same agent is asked once; later ones wait for that answer
  for (const x of pending.values()) if (x.req.project === req.project && x.req.agent === req.agent && x.req.key && x.req.key === req.key) return new Promise((ok) => x.waiters.push(ok));
  const id = crypto.randomBytes(6).toString('hex');
  const full = { ...req, id, at: Date.now(), categoryText: { cs: CATEGORIES[req.category]?.cs || CATEGORIES.other.cs, en: CATEGORIES[req.category]?.en || CATEGORIES.other.en } };
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(id, 'timeout'), 20 * 60000);
    pending.set(id, { req: full, resolve, waiters: [], timer });
    permBus.emit('pending', pendingList());
    const lang = req.lang === 'cs' ? 'cs' : 'en';
    notifyMac(lang === 'cs' ? 'Agent Office se ptá na povolení' : 'Agent Office asks for permission', `${req.agentName || req.agent}: ${req[lang]?.[0] || ''}`);
  });
}
function finish(id, choice) {
  const x = pending.get(id); if (!x) return false;
  clearTimeout(x.timer); pending.delete(id);
  if (choice === 'always' && !x.req.alwaysAsk) setPolicy(x.req.key ? { rule: x.req.key, value: 'always' } : { category: x.req.category, value: 'always' });
  const allow = choice === 'once' || choice === 'always';
  const res = allow ? { allow: true } : { allow: false, message: choice === 'timeout' ? 'Uživatel neodpověděl včas. Pokračuj bez této akce, nebo ji navrhni ve výsledku.' : 'Uživatel tuto akci nepovolil. Pokračuj jinou cestou bez ní.' };
  x.resolve(res); for (const w of x.waiters) w(res);
  permBus.emit('pending', pendingList()); return true;
}
export const decide = (id, choice) => { if (!['once', 'always', 'deny'].includes(choice)) throw new Error('once | always | deny'); return finish(id, choice); };
/** Stopping a project answers its open questions with "no". */
export function cancelProject(project) { for (const [id, x] of pending) if (x.req.project === project) finish(id, 'deny'); }

// ---------- what Claude asks about through --permission-prompt-tool ----------
const SHELLS = new Set(['bash', 'sh', 'zsh', 'eval', 'exec', 'source', '.', 'osascript', 'env', 'xargs', 'nohup', 'time']);
const INSTALL = /^(brew\s+(install|upgrade|reinstall|tap)|pip3?\s+install|python3?\s+-m\s+pip\s+install|npm\s+(i|install)\s+(-g|--global)|gem\s+install|cargo\s+install|go\s+install|pipx\s+install|uv\s+(tool\s+)?install|mas\s+install)\b/;
const inside = (f, dir) => { try { const a = path.resolve(f), b = path.resolve(dir); return a === b || a.startsWith(b + path.sep); } catch { return false; } };
const shortPath = (f) => String(f || '').replace(HOME, '~');

/** Turn a tool call into a verdict and a plain-language question. ctx: { cwd, project } */
export function classify(tool, input = {}, ctx = {}) {
  const raw = JSON.stringify(input);
  const why = forbidden(tool === 'Bash' ? input.command : raw);
  if (why) return { verdict: 'deny', message: `Tohle Agent Office nikdy nedovolí (${why}). Najdi jinou cestu.` };
  if (tool === 'WebFetch' || tool === 'WebSearch') {
    const host = (() => { try { return new URL(input.url).host; } catch { return input.query || ''; } })();
    return { verdict: 'ask', category: 'web', key: null, cs: [`Přečíst stránku ${host}`, String(input.url || input.query || '').slice(0, 300)], en: [`Read the page ${host}`, String(input.url || input.query || '').slice(0, 300)] };
  }
  if (tool === 'Bash') {
    const cmd = String(input.command || '').trim();
    const desc = String(input.description || '').slice(0, 160);
    if (INSTALL.test(cmd)) {
      const what = cmd.split(/\s+/).slice(2).filter((w) => !w.startsWith('-')).join(', ').slice(0, 80);
      return { verdict: 'ask', category: 'install', key: null, alwaysAsk: false, cs: [`Nainstalovat: ${what || cmd.slice(0, 60)}`, `${desc ? desc + '\n' : ''}Příkaz: ${cmd.slice(0, 400)}`], en: [`Install: ${what || cmd.slice(0, 60)}`, `${desc ? desc + '\n' : ''}Command: ${cmd.slice(0, 400)}`] };
    }
    const prog = path.basename(cmd.split(/\s+/)[0] || '');
    const remember = !SHELLS.has(prog) && !/[;&|`$<>]/.test(cmd) ? `shell:${prog}` : null;
    return { verdict: 'ask', category: 'shell', key: remember, alwaysAsk: !remember, cs: [`Spustit program „${prog}“`, `${desc ? desc + '\n' : ''}Příkaz: ${cmd.slice(0, 500)}`], en: [`Run the program “${prog}”`, `${desc ? desc + '\n' : ''}Command: ${cmd.slice(0, 500)}`] };
  }
  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const f = input.file_path || input.notebook_path || '';
    if (ctx.cwd && inside(f, ctx.cwd)) return { verdict: 'allow' };
    if (/^\/(System|usr|bin|sbin|etc|private|Library)\//.test(path.resolve(f))) return { verdict: 'deny', message: 'Systémové soubory agenti nemění. Pracuj ve složce projektu.' };
    const dot = /\/\.[^/]+$/.test(f) || /\/\.[^/]+\//.test(f.replace(HOME, ''));
    const dir = path.dirname(path.resolve(f));
    return { verdict: 'ask', category: 'files', key: dot ? null : `files:${dir}`, alwaysAsk: dot, cs: [`Změnit soubor mimo projekt`, `${shortPath(f)}${dot ? '\n(skrytý soubor s nastavením)' : ''}`], en: [`Change a file outside the project`, `${shortPath(f)}${dot ? '\n(hidden settings file)' : ''}`] };
  }
  if (tool === 'Read' || tool === 'Glob' || tool === 'Grep' || tool === 'LS' || tool === 'TodoWrite') return { verdict: 'allow' };
  return { verdict: 'ask', category: 'other', key: `tool:${tool}`, cs: [`Použít nástroj ${tool}`, raw.slice(0, 400)], en: [`Use the tool ${tool}`, raw.slice(0, 400)] };
}

// ---------- the Mac helper (screen, mouse, keyboard) and macOS privacy permissions ----------
/** ao-input sits next to the app binary; in development it is compiled once from mac/ao-input.swift. */
export function helperPath() {
  const cands = [process.env.AO_INPUT_HELPER, path.resolve(ROOT, '..', '..', 'MacOS', 'ao-input'), path.join(DATA, 'bin', 'ao-input')].filter(Boolean);
  for (const c of cands) { try { fs.accessSync(c, fs.constants.X_OK); return c; } catch {} }
  const src = path.join(ROOT, 'mac', 'ao-input.swift');
  if (process.platform === 'darwin' && fs.existsSync(src)) {
    try { const out = path.join(DATA, 'bin', 'ao-input'); fs.mkdirSync(path.dirname(out), { recursive: true }); execFileSync('swiftc', ['-O', src, '-o', out], { stdio: 'ignore', timeout: 180000 }); return out; } catch {}
  }
  return null;
}
export function systemAccess() {
  if (process.platform !== 'darwin') return { supported: false };
  const h = helperPath(); if (!h) return { supported: true, helper: false, screen: false, accessibility: false };
  try { return { supported: true, helper: true, files: fullDiskAccess(), ...JSON.parse(execFileSync(h, ['perms'], { encoding: 'utf8', timeout: 5000 })) }; } catch { return { supported: true, helper: true, screen: false, accessibility: false, files: fullDiskAccess() }; }
}
/** Full Disk Access: only then can the app open the macOS privacy database (read nothing, just try to open it). */
function fullDiskAccess() {
  try { fs.closeSync(fs.openSync(path.join(os.homedir(), 'Library', 'Application Support', 'com.apple.TCC', 'TCC.db'), 'r')); return true; } catch { return false; }
}
/** The .app around the helper, or null in development. */
function appBundle(h) { const app = path.resolve(path.dirname(h), '..', '..'); return app.endsWith('.app') ? app : null; }
const PANES = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
  files: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
};
/** Ask macOS for the permission (shows the system dialog once), then open the right page of System Settings. */
/** The app's bundle id (the helper sits in Contents/MacOS next to Info.plist); null outside the app. */
function bundleId(h) {
  try { const plist = path.resolve(path.dirname(h), '..', 'Info.plist'); return execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', plist], { encoding: 'utf8', timeout: 3000 }).trim() || null; } catch { return null; }
}
const TCC_SERVICE = { screen: 'ScreenCapture', accessibility: 'Accessibility' };
export function requestSystemAccess(what, { repair = false } = {}) {
  if (!PANES[what]) throw new Error('screen | accessibility | automation | files');
  const h = helperPath();
  // The switch in System Settings can stay on while macOS no longer accepts it (it was given to an older build).
  // Repair clears only this app's own entry, so macOS asks again and the new answer counts.
  if (repair && h && TCC_SERVICE[what]) { const id = bundleId(h); if (id) { try { execFileSync('/usr/bin/tccutil', ['reset', TCC_SERVICE[what], id], { timeout: 5000, stdio: 'ignore' }); } catch {} } }
  if (h && (what === 'screen' || what === 'accessibility')) { try { execFileSync(h, ['request', what], { timeout: 5000, stdio: 'ignore' }); } catch {} }
  // macOS never adds an app to Full Disk Access by itself: show the app in Finder so it can be dragged into the list
  if (what === 'files' && h && appBundle(h)) setTimeout(() => execFile('/usr/bin/open', ['-R', appBundle(h)], () => {}), 900);
  if (what === 'automation') execFile('osascript', ['-e', 'tell application "Finder" to get name of startup disk'], () => {}); // makes macOS ask once, in the app's name
  setTimeout(() => execFile('/usr/bin/open', [PANES[what]], () => {}), what === 'automation' ? 1200 : 400);
  return { ok: true };
}
