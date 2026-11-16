// Agent Office orchestrator: a Boss agent (claude -p, subscription login) runs a whole project autonomously.
import { spawn, execFileSync, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { publishReports } from './report.mjs';
import { resetTimeFromText } from './claude-usage.mjs';
import os from 'node:os';
import { claudeSnapshot } from './claude-bridge.mjs';
import { providerEnv } from './provider-auth.mjs';
import { providerCatalog, normalizeModelId, chooseRoute, runCodex, recordLimit, markUnavailable, clearBlocked, routingPreference, recordFeature, ultrareviewPref } from './providers.mjs';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const DATA = process.env.AGENT_OFFICE_HOME || ROOT; // config.json, profile.md, projects/ (the .app keeps them in Application Support)
export const PROJECTS_DIR = path.join(DATA, 'projects');
fs.mkdirSync(DATA, { recursive: true });
export const bus = new EventEmitter();

const DEFAULT_CFG = {
  permissionMode: 'acceptEdits',
  bossModel: 'opus',
  bossEffort: 'high',
  maxQuestions: 3,
  limitBackoffMin: 10,
  limitMaxRetries: 12,
  ntfyTopic: '', // optional: set to get phone pushes via ntfy.sh (sends question text to that service)
  bash: ['git *', 'node *', 'npm *', 'npx *', 'python3 *', 'curl *', 'ls *', 'cat *', 'mkdir *', 'open *', 'kill *', 'lsof *', 'sleep *', '*Google Chrome*'],
  bashDeny: ['git push*', 'rm -rf*', 'sudo*'],
};
export function loadConfig() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf8')); } catch {}
  return { ...DEFAULT_CFG, ...c };
}

// ---------- locating claude / node (GUI apps and some shells lack ~/.local/bin in PATH) ----------
const HOME = os.homedir();
const EXTRA_PATH = [`${HOME}/.local/bin`, '/opt/homebrew/bin', '/usr/local/bin', `${HOME}/.claude/local`, `${HOME}/.npm-global/bin`, `${HOME}/.bun/bin`];
export function findBin(name) {
  if (name === 'claude' && process.env.CLAUDE_BIN) {
    try { fs.accessSync(process.env.CLAUDE_BIN, fs.constants.X_OK); if (fs.statSync(process.env.CLAUDE_BIN).isFile()) return process.env.CLAUDE_BIN; } catch {}
  }
  const dirs = [...EXTRA_PATH, ...(process.env.PATH || '').split(':')];
  if (name === 'claude' && process.env.CLAUDE_BIN) dirs.unshift(path.dirname(process.env.CLAUDE_BIN));
  for (const d of dirs) { const f = path.join(d, name); try { fs.accessSync(f, fs.constants.X_OK); if (fs.statSync(f).isFile()) return f; } catch {} }
  return null;
}
const childEnv = () => providerEnv('claude');
let healthCache = { t: 0, v: null };
export function health(force = false) {
  return new Promise((resolve) => {
    if (!force && Date.now() - healthCache.t < 10000 && healthCache.v) return resolve(healthCache.v);
    const bin = findBin('claude'); const node = findBin('node') || process.execPath;
    const done = (v) => { healthCache = { t: Date.now(), v }; resolve(v); };
    if (!bin) return done({ claude: null, node, loggedIn: false, problem: 'missing', message: 'Nenašel jsem příkaz claude (hledal jsem ~/.local/bin, Homebrew i PATH).' });
    execFile(bin, ['auth', 'status'], { env: childEnv(), timeout: 15000 }, (err, out) => {
      let j = null; try { j = JSON.parse(out); } catch {}
      if (j?.loggedIn) return done({ claude: bin, node, loggedIn: true, problem: null, message: '' });
      done({ claude: bin, node, loggedIn: false, problem: 'login', message: 'Claude není přihlášené. Klikni na Přihlásit a dokonči přihlášení v Terminálu.' });
    });
  });
}
export function openLogin() {
  const bin = findBin('claude'); if (!bin) return false;
  const cmd = `'${bin.replace(/'/g, '')}' auth login`;
  execFile('osascript', ['-e', 'tell application "Terminal"', '-e', 'activate', '-e', `do script ${JSON.stringify(cmd)}`, '-e', 'end tell'], () => {});
  healthCache.t = 0; return true;
}

const MODELS = ['haiku', 'sonnet', 'opus'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']; // 'ultra' exists on Codex models; Claude maps it to 'max'
const BASE_ROLES = ['boss', 'researcher', 'designer', 'tester'];
const BASE_CHAR = { boss: 'harvey', researcher: 'rachel', designer: 'louis', tester: 'mike' };
const BASE_TOOLS = { researcher: ['read', 'write', 'web', 'bash'], designer: ['read', 'write', 'web', 'bash'], tester: ['read', 'write', 'bash', 'web'] };
const READONLY = new Set(['researcher', 'tester']);
// Suits (seasons 1–2) cast for hired roles. Harvey/Rachel/Louis/Mike are the permanent base staff.
export const CAST = { harvey: 'Harvey Specter', mike: 'Mike Ross', louis: 'Louis Litt', rachel: 'Rachel Zane', donna: 'Donna Paulsen', jessica: 'Jessica Pearson', harold: 'Harold Gunderson', norma: 'Norma', kyle: 'Kyle Durant', scottie: 'Dana Scott', hardman: 'Daniel Hardman', jenny: 'Jenny Griffith', trevor: 'Trevor Evans', tanner: 'Travis Tanner', benjamin: 'Benjamin', katrina: 'Katrina Bennett', gretchen: 'Gretchen Bodinski', alex: 'Alex Williams', robert: 'Robert Zane', samantha: 'Samantha Wheeler', edith: 'Edith Ross', stu: 'Stu Buzzini', moore: 'Soudkyně Moore', esther: 'Esther Litt', gallo: 'Frank Gallo', oliver: 'Oliver Grady', logan: 'Logan Sanders', tara: 'Tara Messer', marcus: 'Marcus Specter', sheila: 'Sheila Sazs', ava: 'Ava Hessington', soloff: 'Jack Soloff' };
const CAST_ORDER = ['donna', 'jessica', 'harold', 'norma', 'kyle', 'scottie', 'hardman', 'jenny', 'trevor', 'tanner', 'katrina', 'benjamin', 'alex', 'samantha', 'gretchen', 'robert', 'oliver', 'stu', 'sheila', 'logan', 'tara', 'esther', 'soloff', 'ava', 'marcus', 'edith', 'gallo', 'moore'];
const CAST_PREFS = [
  [/copy|text|content|communicat|people|coordinat|ops|operation|email|social|pr\b|marketing|brand voice|community|komunikac|obsah|lid[ée]|koordin|soci[áa]ln/i, ['donna', 'norma', 'jenny']],
  [/financ|number|budget|complian|account|pricing|tax|audit|detail|[čc][íi]sl|rozpo[čc]|cen[íi]k|[úu][čc]et|dan[ěe]/i, ['kyle', 'hardman', 'norma']],
  [/legal|contract|law|gdpr|pr[áa]vn|smlouv|podm[íi]nk/i, ['hardman', 'jessica', 'norma']],
  [/negoti|pitch|sales|deal|strateg|investor|business dev|partnership|obchod|vyjedn|investo/i, ['jessica', 'scottie', 'hardman', 'tanner']],
  [/review|direction|approv|editor|lead|executive|quality|kontrol|kvalit|veden/i, ['jessica', 'hardman']],
  [/analy|data|generalist|research|learn|investigat|seo|growth|v[ýy]zkum|trh/i, ['harold', 'kyle', 'trevor']],
  [/document|support|paralegal|admin|archive|writer|summary|dokument|shrnut/i, ['norma', 'jenny', 'scottie']],
];
const PERSONALITY = { donna: 'You anticipate what is needed before anyone asks and you are never wrong about people.', jessica: 'You hold the bar for the whole firm: decisive, calm, uncompromising on quality.', harold: 'You are meticulous and eager; you double-check everything.', norma: 'You are quietly exacting and organised; nothing leaves your desk unfinished.', kyle: 'You are sharp with numbers and competitive about precision.', scottie: 'You are a confident closer with strong judgement.', hardman: 'You think in strategy and long-term leverage.', jenny: 'You are warm, clear and practical.', trevor: 'You are resourceful and pragmatic.', tanner: 'You probe for weaknesses like opposing counsel.', harvey: 'You win: confident, direct, never settle.', mike: 'You learn anything fast and remember every detail.', louis: 'You obsess over detail and form.', rachel: 'You are thorough and precise in research.' };
function pickCharacter(st, text) {
  const used = new Set([...Object.values(BASE_CHAR), ...(st.roles || []).map((r) => r.character)]);
  for (const [re, list] of CAST_PREFS) if (re.test(text)) { const c = list.find((k) => !used.has(k)); if (c) return c; }
  const c = CAST_ORDER.find((k) => !used.has(k)); if (c) return c;
  const all = [...CAST_ORDER, 'harvey', 'mike', 'louis', 'rachel']; return all[(st.roles || []).length % all.length]; // reuse, display gets a suffix
}
function displayName(st, character) { const n = (st.roles || []).filter((r) => r.character === character).length + (Object.values(BASE_CHAR).includes(character) ? 1 : 0); return CAST[character] + (n ? ' ' + (['', 'II', 'III', 'IV', 'V'][n] || String(n + 1)) : ''); }
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'role';
/** Register (or update) a role in the office. Prompts are saved to office/roles/<id>.md so the office keeps them. */
function hireRole(p, h, { manual = false } = {}) {
  const st = p.state; st.roles ||= [];
  const id = slug(h.id || h.title);
  if (BASE_ROLES.includes(id)) return id;
  let r = st.roles.find((x) => x.id === id);
  const text = `${h.title} ${h.responsibility || ''}`;
  if (!r) { const character = h.character && CAST[h.character] ? h.character : pickCharacter(st, text); r = { id, character, name: h.name || displayName(st, character), manual, hired: now() }; st.roles.push(r); }
  Object.assign(r, { title: h.title || r.title || id, responsibility: h.responsibility || r.responsibility || '', tools: (h.tools && h.tools.length ? h.tools : r.tools) || ['read', 'write', 'web'], model: h.model && h.model !== 'auto' ? h.model : r.model || null, effort: h.effort && h.effort !== 'auto' ? h.effort : r.effort || null });
  if (h.prompt) r.prompt = h.prompt;
  if (!r.prompt) r.prompt = read(path.join(ROOT, 'roles', `${id}.md`)) || `You are the ${r.title}. Responsibility: ${r.responsibility}. Do excellent, verifiable work for the project goal; write deliverables as files; never invent facts, mark placeholders clearly.`;
  if (p.ctx) { try { fs.mkdirSync(path.join(p.ctx.office, 'roles'), { recursive: true }); fs.writeFileSync(path.join(p.ctx.office, 'roles', `${id}.md`), `# ${r.name} – ${r.title}\n\n${r.prompt}\n`); } catch {} }
  st.agents[id] ||= { status: 'idle', activity: '' };
  return id;
}
function roleOf(st, id) { return BASE_ROLES.includes(id) ? { id, base: true, tools: BASE_TOOLS[id] || ['read'], character: BASE_CHAR[id] } : (st.roles || []).find((r) => r.id === id); }
function teamText(st) {
  const base = 'researcher (Rachel Zane – research with sources), designer (Louis Litt – visual/UX design and building), tester (Mike Ross – verification and evidence)';
  const extra = (st.roles || []).map((r) => `${r.id} (${r.name} – ${r.title}${r.manual ? ', ADDED BY THE USER: you must use this role where relevant' : ''}: ${r.responsibility}${r.model ? `; preferred ${r.model}/${r.effort || 'medium'}` : ''})`).join('; ');
  return `${base}${extra ? '; ' + extra : ''}`;
}
const live = new Map(); // id -> { p, abort, wake }

// ---------- schemas ----------
const S = {
  question: { type: 'object', required: ['id', 'text', 'options', 'default'], properties: { id: { type: 'string' }, text: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, default: { type: 'string' } } },
  route: { model: { type: 'string' }, provider: { type: 'string', enum: ['auto', 'claude', 'codex', 'antigravity', 'gemini', 'ollama'] }, effort: { type: 'string', enum: EFFORTS } },
};
const routeProps = S.route;
const HIRE = { type: 'object', required: ['id', 'title', 'responsibility', 'tools', 'model', 'effort', 'prompt'], properties: { id: { type: 'string' }, title: { type: 'string' }, responsibility: { type: 'string' }, tools: { type: 'array', items: { type: 'string', enum: ['read', 'write', 'web', 'bash'] } }, model: { type: 'string' }, effort: { type: 'string', enum: EFFORTS }, prompt: { type: 'string' } } };
const SCHEMAS = {
  intake: { type: 'object', required: ['summary', 'assumptions', 'questions', 'research', 'complexity', 'deliverable'], properties: {
    summary: { type: 'string' }, complexity: { type: 'string', enum: ['small', 'medium', 'large'] }, deliverable: { type: 'string' }, needs: { type: 'array', items: { type: 'string' } }, installs: { type: 'array', items: { type: 'object', required: ['name', 'why'], properties: { name: { type: 'string' }, repo: { type: 'string' }, why: { type: 'string' } } } }, assumptions: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: S.question },
    research: { type: 'array', items: { type: 'object', required: ['id', 'topic', 'instructions', 'model', 'effort'], properties: { id: { type: 'string' }, topic: { type: 'string' }, instructions: { type: 'string' }, ...routeProps } } } } },
  synth: { type: 'object', required: ['scorecard_items', 'questions'], properties: { scorecard_items: { type: 'number' }, questions: { type: 'array', items: S.question } } },
  plan: { type: 'object', required: ['tasks', 'verify'], properties: {
    scorecard_items: { type: 'number' }, ultrareview: { type: 'boolean' }, installs: { type: 'array', items: { type: 'object', required: ['name', 'why'], properties: { name: { type: 'string' }, repo: { type: 'string' }, why: { type: 'string' } } } },
    hires: { type: 'array', items: HIRE },
    tasks: { type: 'array', items: { type: 'object', required: ['id', 'title', 'role', 'instructions', 'acceptance', 'depends_on', 'model', 'effort', 'question', 'inputs', 'output', 'consumer', 'critical'], properties: { id: { type: 'string' }, title: { type: 'string' }, role: { type: 'string' }, instructions: { type: 'string' }, acceptance: { type: 'array', items: { type: 'string' } }, depends_on: { type: 'array', items: { type: 'string' } }, question: { type: 'string' }, inputs: { type: 'array', items: { type: 'string' } }, output: { type: 'string' }, consumer: { type: 'string' }, critical: { type: 'boolean' }, command: { type: 'string' }, skills: { type: 'array', items: { type: 'string' } }, ...routeProps } } },
    verify: { type: 'object', required: ['instructions', 'model', 'effort'], properties: { instructions: { type: 'string' }, ...routeProps } } } },
  worker: { type: 'object', required: ['status', 'summary', 'conclusion', 'evidence', 'uncertainties', 'open_questions'], properties: { status: { type: 'string', enum: ['done', 'blocked'] }, summary: { type: 'string' }, conclusion: { type: 'string' }, evidence: { type: 'array', items: { type: 'object', required: ['claim', 'source'], properties: { claim: { type: 'string' }, source: { type: 'string' } } } }, uncertainties: { type: 'array', items: { type: 'string' } }, open_questions: { type: 'array', items: { type: 'string' } }, changed_files: { type: 'array', items: { type: 'string' } }, concerns: { type: 'array', items: { type: 'string' } } } },
  advice: { type: 'object', required: ['instructions'], properties: { instructions: { type: 'string' } } },
  judge: { type: 'object', required: ['score', 'passed', 'gaps', 'questions', 'summary', 'criteria', 'full_review_needed'], properties: {
    score: { type: 'number' }, passed: { type: 'boolean' }, summary: { type: 'string' }, full_review_needed: { type: 'boolean' }, lessons: { type: 'array', items: { type: 'string' } },
    criteria: { type: 'array', items: { type: 'object', required: ['id', 'level', 'status', 'evidence'], properties: { id: { type: 'string' }, level: { type: 'string', enum: ['MUST', 'SHOULD', 'NICE'] }, status: { type: 'string', enum: ['PASS', 'FAIL', 'UNVERIFIED'] }, evidence: { type: 'string' } } } },
    questions: { type: 'array', items: S.question },
    gaps: { type: 'array', items: { type: 'object', required: ['id', 'title', 'role', 'instructions', 'acceptance', 'model', 'effort'], properties: { id: { type: 'string' }, title: { type: 'string' }, role: { type: 'string' }, instructions: { type: 'string' }, acceptance: { type: 'array', items: { type: 'string' } }, ...routeProps } } } } },
  final: { type: 'object', required: ['summary', 'remaining'], properties: { summary: { type: 'string' }, remaining: { type: 'array', items: { type: 'string' } } } },
};

// ---------- state helpers ----------
const read = (f, d = '') => { try { return fs.readFileSync(f, 'utf8'); } catch { return d; } };
const now = () => new Date().toISOString();
function save(p) {
  fs.writeFileSync(path.join(p.dir, 'state.json'), JSON.stringify(p.state, null, 2));
  if (p.state.repoId && ['running', 'waiting_user'].includes(p.state.status)) touchRepo(p.state.repoId);
  bus.emit('update', p.state);
}
function log(p, who, msg) {
  p.state.log.push({ t: now(), who, msg: String(msg).slice(0, 400) });
  if (p.state.log.length > 400) p.state.log.splice(0, p.state.log.length - 400);
  save(p);
}
function agent(p, name, patch) {
  p.state.agents[name] = { status: 'idle', activity: '', ...(p.state.agents[name] || {}), ...patch };
  save(p);
}
function notify(p, title, body) {
  const cfg = loadConfig();
  const esc = (s) => String(s).replace(/["\\]/g, ' ').slice(0, 200);
  if (!process.env.AGENT_OFFICE_APP) execFile('osascript', ['-e', `display notification "${esc(body)}" with title "${esc(title)}"`], () => {});
  if (cfg.ntfyTopic) {
    fetch(`https://ntfy.sh/${encodeURIComponent(cfg.ntfyTopic)}`, { method: 'POST', headers: { Title: esc(title) }, body: String(body).slice(0, 500) }).catch(() => {});
  }
}

// ---------- live feed per agent (what it does right now) ----------
const feedTimers = new Map();
function feedPush(p, agentName, entry) {
  p.feeds ||= {};
  const arr = (p.feeds[agentName] ||= []);
  const e = { t: now(), ...entry };
  if (e.text) e.text = String(e.text).slice(0, 1200);
  arr.push(e); if (arr.length > 300) arr.splice(0, arr.length - 300);
  bus.emit('feed', { id: p.state.id, agent: agentName, entry: e });
  if (!feedTimers.has(p.state.id)) feedTimers.set(p.state.id, setTimeout(() => { feedTimers.delete(p.state.id); try { fs.writeFileSync(path.join(p.dir, 'feeds.json'), JSON.stringify(p.feeds)); } catch {} }, 500));
  return e;
}
export function getFeed(id, agentName) {
  const L = live.get(id);
  let feeds = L?.p.feeds;
  if (!feeds) { try { feeds = JSON.parse(read(path.join(PROJECTS_DIR, id, 'feeds.json'), '{}')); } catch { feeds = {}; } }
  return feeds[agentName] || [];
}
const base = (f) => String(f || '').split('/').slice(-2).join('/');
const host = (u) => { try { return new URL(u).host; } catch { return String(u).slice(0, 60); } };
function describeTool(name, i = {}) {
  const f = i.file_path || i.path || i.notebook_path;
  switch (name) {
    case 'Read': return { text: `čte ${base(f)}`, file: f };
    case 'Edit': case 'MultiEdit': return { text: `edituje ${base(f)}`, file: f, changed: true };
    case 'Write': return { text: `zapisuje ${base(f)}`, file: f, changed: true };
    case 'Glob': return { text: `hledá soubory ${i.pattern || ''}` };
    case 'Grep': return { text: `prohledává kód: ${String(i.pattern || '').slice(0, 50)}` };
    case 'WebFetch': return { text: `otevírá ${host(i.url)}`, url: i.url };
    case 'WebSearch': return { text: `hledá na webu „${String(i.query || '').slice(0, 70)}“` };
    case 'Bash': {
      const c = String(i.command || '');
      if (/screencapture|screenshot|--screenshot/i.test(c)) return { text: 'dělá screenshot' };
      if (/^\s*open\b|google chrome/i.test(c)) return { text: `otevírá v prohlížeči: ${c.slice(0, 70)}` };
      if (/\bgit (commit|add|diff|status|log)/.test(c)) return { text: `git: ${c.slice(0, 60)}` };
      if (/\b(npm|node|npx|python3)\b/.test(c)) return { text: `spouští: ${c.slice(0, 70)}` };
      if (/\bcurl\b/.test(c)) return { text: `stahuje: ${c.slice(0, 70)}` };
      return { text: `příkaz: ${c.slice(0, 70)}` };
    }
    default: return { text: `${name} ${short(i)}` };
  }
}
const IMG = /(\/[^\s"'`]+\.(?:png|jpe?g|webp|gif))/gi;
function collectShots(p, agentName, paths) {
  p.seenShots ||= new Set();
  for (const f of paths) {
    if (p.seenShots.has(f)) continue;
    try { if (fs.statSync(f).isFile()) { p.seenShots.add(f); feedPush(p, agentName, { kind: 'shot', file: f, text: path.basename(f) }); } } catch {}
  }
}
function scanReports(p, agentName, since) {
  const dir = path.join(p.dir, 'office', 'reports'); const found = [];
  const walk = (d, depth) => { let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch {} for (const e of ents) { const f = path.join(d, e.name); if (e.isDirectory() && depth < 3) walk(f, depth + 1); else if (/\.(png|jpe?g|webp)$/i.test(e.name) && fs.statSync(f).mtimeMs >= since - 2000) found.push(f); } };
  walk(dir, 0); collectShots(p, agentName, found);
}
async function withLock(L, fn) {
  const prev = L.lock; let rel; L.lock = new Promise((r) => (rel = r));
  await prev; try { return await fn(); } finally { rel(); }
}

// ---------- claude runner ----------
function tryParse(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
const short = (o) => { const v = o?.file_path || o?.command || o?.pattern || o?.query || o?.url || ''; return String(v).slice(0, 80); };

function runClaude(p, o) {
  return new Promise((resolve, reject) => {
    const cfg = loadConfig();
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', o.model, '--effort', o.effort,
      '--permission-mode', cfg.permissionMode, '--append-system-prompt', o.system];
    if (o.schema) args.push('--json-schema', JSON.stringify(o.schema));
    if (o.fast) args.push('--settings', JSON.stringify({ fastMode: true }));
    if (o.agent === 'boss') { if (o.resume) args.push('--resume', o.resume); else if (o.sessionId) { args.push('--session-id', o.sessionId); if (o.sessionName) args.push('--name', o.sessionName); } }
    else { args.push('--no-session-persistence'); if (o.resume && o.fallbackPrompt) o = { ...o, prompt: o.fallbackPrompt }; } // workers stay out of Claude Code's history
    const tools = [...(o.tools || [])].filter((t) => t !== 'Skill');
    // Lean context: a default session carries ~43k tokens of tools, MCP servers and the full skill list on every call.
    // Only this role's built-in tools are loaded; MCP is off; skills arrive as text in the task (see skillText).
    args.push('--tools', [...new Set([...tools, ...(o.bash ? ['Bash'] : [])])].join(',') || 'Read', '--strict-mcp-config', '--disable-slash-commands');
    if (o.bash) tools.push(...cfg.bash.map((b) => `Bash(${b})`));
    if (tools.length) args.push('--allowedTools', ...tools);
    if (o.bash) args.push('--disallowedTools', ...cfg.bashDeny.map((b) => `Bash(${b})`));
    for (const d of o.addDirs || []) args.push('--add-dir', d);
    const env = childEnv(); // no ANTHROPIC_API_KEY -> subscription login
    const bin = findBin('claude'); if (!bin) return reject(Object.assign(new Error('claude CLI not found'), { fatal: true }));
    const child = spawn(bin, args, { cwd: o.cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const live1 = live.get(p.state.id); live1?.children.add(child);
    if (o.entry) o.entry.child = child;
    const startedAt = Date.now(); const imgs = new Set();
    let buf = '', err = '', result = null;
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'rate_limit_event') recordLimit('claude', ev);
        if (ev.type === 'assistant') {
          for (const b of ev.message?.content || []) {
            if (b.type === 'tool_use') {
              const d = describeTool(b.name, b.input);
              agent(p, o.agent, { activity: d.text });
              feedPush(p, o.agent, { kind: 'tool', tool: b.name, text: d.text, file: d.file, url: d.url, changed: !!d.changed });
              for (const m of JSON.stringify(b.input || {}).matchAll(IMG)) imgs.add(m[1]);
            } else if (b.type === 'text' && !o.quiet) {
              const tx = (b.text || '').trim();
              if (tx && !(tx.startsWith('{') && tryParse(tx))) feedPush(p, o.agent, { kind: 'text', text: tx });
            }
          }
        } else if (ev.type === 'result') result = ev;
      }
    });
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', () => {
      live1?.children.delete(child);
      if (!o.quiet) { collectShots(p, o.agent, imgs); if (o.agent === 'tester') scanReports(p, o.agent, startedAt); }
      if (live1?.stopped) return reject(new Error('stopped'));
      if (o.entry?.interrupted) return reject(Object.assign(new Error('interrupted'), { interrupted: true }));
      if (!result) return reject(Object.assign(new Error('claude exited without result: ' + err.slice(-300)), { limit: /limit|rate|overload|429|quota|usage.*exceed/i.test(err) }));
      if (o.fast && result.fast_mode_state) recordFeature('fast', { available: result.fast_mode_state === 'on', reason: result.fast_mode_disabled_reason || '' });
      if (result.is_error) {
        const e = new Error(String(result.result || err).slice(0, 300));
        e.limit = /hit your|usage limit|session limit|weekly limit|limit reached|rate.?limit|overload|429|quota/i.test(e.message);
        return reject(e);
      }
      resolve({ text: result.result, data: result.structured_output ?? tryParse(result.result), session: result.session_id, cost: result.total_cost_usd || 0, usage: result.usage || {}, provider: 'claude' });
    });
    child.stdin.end(o.prompt);
  });
}

function route(p, r) {
  const f = p.state.settings;
  let model = typeof r.model === 'string' && r.model !== 'auto' ? r.model : 'sonnet';
  let effort = EFFORTS.includes(r.effort) ? r.effort : 'medium';
  if (f.forceModel) model = f.forceModel;
  if (f.forceEffort) effort = f.forceEffort;
  return { model, effort, provider: r.provider || 'auto', pinned: !!r.pinned };
}
// Default Boss preference; the provider router and saved user choice determine the actual model.
function bossRoute(p, effort) {
  const cfg = loadConfig();
  if (process.env.AGENT_OFFICE_TEST_SMOKE === '1' && p.state.settings.allowWeakBoss) return route(p, { model: cfg.bossModel, effort: effort || cfg.bossEffort });
  const want = EFFORTS.indexOf(effort || cfg.bossEffort);
  return { model: 'opus', effort: EFFORTS[Math.max(want, EFFORTS.indexOf('medium'))] };
}
function escalate(r) {
  const effort = EFFORTS[Math.min(EFFORTS.indexOf(r.effort) + 1, EFFORTS.length - 1)];
  const model = ['high', 'xhigh', 'max'].includes(effort) && MODELS.includes(r.model) && r.model !== 'opus' && !r.pinned ? MODELS[MODELS.indexOf(r.model) + 1] : r.model;
  return { ...r, model, effort };
}

// ---------- skills: compact catalog for the boss, full text only for the task that needs it ----------
let skillCache = { t: 0, list: [] };
const PLUGINS = path.join(os.homedir(), '.claude', 'plugins');
const OFFICIAL = 'claude-plugins-official';
function skillRoots() { // [dir containing <skill>/SKILL.md, prefix]
  if (process.env.AGENT_OFFICE_SKILLS) return process.env.AGENT_OFFICE_SKILLS.split(':').map((d) => [d, '']);
  const roots = [[path.join(os.homedir(), '.claude', 'skills'), ''], [path.join(os.homedir(), '.agents', 'skills'), '']];
  const sub = (d) => { try { return fs.readdirSync(d).filter((n) => !n.startsWith('.')).map((n) => path.join(d, n)); } catch { return []; } };
  for (const mk of sub(path.join(PLUGINS, 'cache'))) for (const pl of sub(mk)) for (const ver of sub(pl).slice(-1)) roots.push([path.join(ver, 'skills'), path.basename(pl) + ':']); // installed plugins
  for (const pl of sub(path.join(PLUGINS, 'marketplaces', OFFICIAL, 'plugins'))) roots.push([path.join(pl, 'skills'), path.basename(pl) + ':']); // official marketplace: already on disk, readable without installing
  return roots;
}
export function skillsCatalog(force = false) {
  if (!force && Date.now() - skillCache.t < 5 * 60000) return skillCache.list;
  const list = []; const seen = new Set();
  for (const [root, prefix] of skillRoots()) {
    let names = []; try { names = fs.readdirSync(root); } catch {}
    for (const n of names) {
      const key = prefix && n !== prefix.slice(0, -1) ? prefix + n : n; if (seen.has(key) || seen.has(n)) continue;
      const head = read(path.join(root, n, 'SKILL.md')).slice(0, 1500); if (!head) continue;
      const desc = ((head.match(/^description:\s*["']?([\s\S]*?)["']?\s*$/m) || [])[1] || '').replace(/\s+/g, ' ').slice(0, 110);
      seen.add(key); list.push({ name: key, desc, dir: path.join(root, n) });
    }
  }
  skillCache = { t: Date.now(), list }; return list;
}
function skillText(names) {
  const cat = skillsCatalog(); let out = '';
  for (const n of (names || []).slice(0, 3)) {
    const sk = cat.find((x) => x.name === n) || cat.find((x) => x.name.endsWith(':' + n)); if (!sk) continue;
    const body = read(path.join(sk.dir, 'SKILL.md')).replace(/^---[\s\S]*?---\s*/, '').slice(0, 7000);
    out += `\n\nSKILL "${sk.name}" – follow it for this task (its reference files, if it mentions any, are in ${sk.dir}; you may Read them):\n${body}`;
  }
  return out;
}
/** When the boss assigned no skill, pick the obviously matching one by name/description overlap (plain code, no model). */
function autoSkills(t) {
  const words = new Set(`${t.title} ${t.question || ''} ${String(t.instructions || '').slice(0, 400)}`.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []);
  const scored = skillsCatalog().map((k) => { const kw = `${k.name} ${k.desc}`.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []; const nameHit = k.name.toLowerCase().split(/[:-]/).filter((w) => w.length > 3 && words.has(w)).length; return { k, score: nameHit * 3 + kw.filter((w) => words.has(w)).length }; }).filter((x) => x.score >= 5).sort((a, b) => b.score - a.score);
  return scored.slice(0, 1).map((x) => x.k.name);
}
function writeSkillsIndex(p) { // workers may open any skill themselves
  try { fs.writeFileSync(path.join(p.ctx.office, 'SKILLS.md'), `# Skills library\n\nOpen <dir>/SKILL.md of any skill that fits your task and follow it.\n\n${skillsCatalog().map((k) => `- **${k.name}** – ${k.desc} → \`${k.dir}\``).join('\n')}\n`); } catch {}
}

// ---------- plugins: the office can extend itself ----------
function officialPlugins() {
  try { const m = JSON.parse(read(path.join(PLUGINS, 'marketplaces', OFFICIAL, '.claude-plugin', 'marketplace.json'))); return (m.plugins || []).map((x) => ({ name: x.name, desc: String(x.description || '').replace(/\s+/g, ' ').slice(0, 90) })); } catch { return []; }
}
function installedPlugins() { try { return Object.keys(JSON.parse(read(path.join(PLUGINS, 'installed_plugins.json'))).plugins || {}); } catch { return []; } }
export function searchCommunityPlugins(needs = []) {
  let listings = []; try { listings = JSON.parse(read(path.join(PLUGINS, 'plugin-directory-cache-v2.json'))).listings || []; } catch {}
  const out = [];
  for (const need of needs.slice(0, 4)) {
    const w = String(need).toLowerCase().match(/[a-z0-9]{3,}/g) || []; if (!w.length) continue;
    const hits = listings.map((l) => { const t = `${l.name} ${l.summary}`.toLowerCase(); return { l, score: w.filter((x) => t.includes(x)).length }; }).filter((x) => x.score >= Math.min(2, w.length)).sort((a, b) => b.score - a.score).slice(0, 3);
    for (const { l } of hits) { const repo = (l.source?.repository?.url || '').replace('https://github.com/', ''); if (repo && !out.some((o) => o.repo === repo)) out.push({ name: l.name, repo, desc: String(l.summary || '').slice(0, 110) }); }
  }
  return out.slice(0, 8);
}
const runCli = (args, timeout = 180000) => new Promise((ok) => execFile(findBin('claude'), args, { env: childEnv(), timeout, maxBuffer: 4e6 }, (err, out, errOut) => ok({ ok: !err, text: String(out) + String(errOut) })));
/** Official marketplace plugins install on the boss's decision. Anything from another repository needs the user's one-tap yes. */
async function installPlugins(p, installs) {
  const st = p.state; if (process.env.AGENT_OFFICE_NO_INSTALL) return;
  for (const it of (installs || []).slice(0, 3)) {
    const have = installedPlugins();
    if (!it?.name || have.some((k) => k.startsWith(it.name + '@'))) continue;
    if (!it.repo || it.repo === OFFICIAL) {
      if (!officialPlugins().some((x) => x.name === it.name)) continue;
      log(p, 'boss', `Instaluji oficiální plugin ${it.name}: ${String(it.why || '').slice(0, 100)}`);
      const r = await runCli(['plugin', 'install', `${it.name}@${OFFICIAL}`]);
      decide(p, 'Plugin', [`${it.name}@${OFFICIAL}: ${r.ok ? 'nainstalován' : 'instalace selhala'} – ${it.why || ''}`]);
    } else {
      if (!/^[\w.-]+\/[\w.-]+$/.test(it.repo)) continue;
      const q = `Šéf chce nainstalovat plugin „${it.name}“ z GitHubu (${it.repo}). Důvod: ${String(it.why || '').slice(0, 140)}. Plugin poběží i v tvém Claude Code. Povolit?`;
      const ans = await askUser(p, [{ id: 'plugin-' + slug(it.name), text: q, options: ['Nainstalovat', 'Neinstalovat'], default: 'Neinstalovat' }]);
      if (!String(Object.values(ans)[0] || '').startsWith('Nainstalovat')) { decide(p, 'Plugin', [`${it.name} (${it.repo}): uživatel nepovolil.`]); continue; }
      const before = (() => { try { return Object.keys(JSON.parse(read(path.join(PLUGINS, 'known_marketplaces.json')))); } catch { return []; } })();
      await runCli(['plugin', 'marketplace', 'add', it.repo]);
      let mk = null; try { mk = Object.keys(JSON.parse(read(path.join(PLUGINS, 'known_marketplaces.json')))).find((k) => !before.includes(k)); } catch {}
      let ok = false;
      if (mk) { let names = []; try { names = (JSON.parse(read(path.join(PLUGINS, 'marketplaces', mk, '.claude-plugin', 'marketplace.json'))).plugins || []).map((x) => x.name); } catch {} const pick = names.find((n) => slug(n) === slug(it.name)) || (names.length === 1 ? names[0] : null); if (pick) ok = (await runCli(['plugin', 'install', `${pick}@${mk}`])).ok; }
      log(p, 'boss', ok ? `Plugin ${it.name} nainstalován.` : `Plugin ${it.name} se nepodařilo nainstalovat.`); decide(p, 'Plugin', [`${it.name} (${it.repo}): ${ok ? 'nainstalován se souhlasem uživatele' : 'instalace selhala'}`]);
    }
  }
  skillsCatalog(true); writeSkillsIndex(p);
}

// ---------- attempt ledger: every model call, including failed ones ----------
function tokensOf(provider, u = {}) {
  const cacheRead = u.cache_read_input_tokens || u.cached_input_tokens || 0;
  const cacheWrite = u.cache_creation_input_tokens || 0;
  // Claude reports input without cache; Codex/OpenAI reports cached tokens as a subset of input.
  const input = provider === 'claude' ? (u.input_tokens || 0) : Math.max(0, (u.input_tokens || 0) - cacheRead);
  return { input, output: u.output_tokens || 0, cacheRead, cacheWrite, known: !!(u.input_tokens || u.output_tokens) };
}
function recordAttempt(p, rec) {
  const st = p.state;
  const row = { t: now(), goal: (st.history || []).length + 1, phase: st.phase || 'other', round: st.round || 0, ...rec };
  try { fs.appendFileSync(path.join(p.dir, 'attempts.jsonl'), JSON.stringify(row) + '\n'); } catch {}
  return row;
}
export function usageReport(id) {
  const dir = path.join(PROJECTS_DIR, id); const st = readState(id); if (!st) throw new Error('Projekt neexistuje.');
  const rows = read(path.join(dir, 'attempts.jsonl')).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const goal = (st.history || []).length + 1;
  const sum = (list) => list.reduce((a, r) => { a.attempts++; if (r.outcome !== 'ok') a.failed++; a.ms += r.ms || 0; for (const k of ['input', 'output', 'cacheRead', 'cacheWrite']) a[k] += r.tokens?.[k] || 0; if (r.outcome !== 'ok') a.failedTokens += (r.tokens?.input || 0) + (r.tokens?.output || 0); if (!r.tokens?.known) a.unknown++; return a; }, { attempts: 0, failed: 0, ms: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, failedTokens: 0, unknown: 0 });
  const group = (list, key) => Object.entries(list.reduce((m, r) => ((m[r[key] || '?'] ||= []).push(r), m), {})).map(([k, v]) => ({ key: k, ...sum(v) }));
  const cur = rows.filter((r) => r.goal === goal);
  const jobs = [...(st.history || []).map((h, i) => ({ goal: h.goal, status: h.status, accepted: !!h.accepted, human: h.human || null, ...sum(rows.filter((r) => r.goal === i + 1)) })), { goal: st.goal, status: st.status, accepted: !!st.accepted, human: st.human || null, ...sum(cur) }];
  const accepted = jobs.filter((j) => j.accepted);
  const perAccepted = accepted.length ? Math.round(jobs.reduce((a, j) => a + j.input + j.output, 0) / accepted.length) : null; // all spend (incl. failed & rejected jobs) per accepted job
  return { current: { total: sum(cur), byPhase: group(cur, 'phase'), byRole: group(cur, 'role'), byModel: group(cur, 'model') }, jobs, perAccepted, human: st.human || {}, attempts: cur.slice(-200) };
}
export function acceptProject(id, { accepted = true, note = '' } = {}) {
  const L = live.get(id); const st = L ? L.p.state : readState(id); if (!st) throw new Error('Projekt neexistuje.');
  if (['running', 'waiting_user'].includes(st.status)) throw new Error('Projekt ještě běží.');
  st.accepted = accepted ? { at: now(), note: String(note).slice(0, 500), human: { ...(st.human || {}) } } : null;
  fs.writeFileSync(path.join(PROJECTS_DIR, id, 'state.json'), JSON.stringify(st, null, 2)); bus.emit('update', st); return st;
}
function bumpHuman(st, kind) { st.human ||= { answers: 0, messages: 0, directives: 0, roles: 0 }; st.human[kind] = (st.human[kind] || 0) + 1; }

// ---------- usage limits: wait without losing anything, continue by itself when the limit resets ----------
const fmtTime = (ms) => new Date(ms).toLocaleString('cs-CZ', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
function limitUntil(provider, message, catalog) {
  const fromText = resetTimeFromText(message);
  if (fromText && fromText > Date.now()) return fromText;
  const prov = catalog?.providers?.find((x) => x.id === provider);
  const resets = (prov?.windows || []).filter((w) => (w.usedPercent ?? 0) >= 99 && w.resetsAt).map((w) => w.resetsAt * 1000).filter((x) => x > Date.now());
  return resets.length ? Math.max(...resets) : Date.now() + 15 * 60000;
}
/** Park this agent until the provider's limit resets (or the user presses "Zkusit znovu"). Nothing is counted against the run budget. */
async function waitForCapacity(p, name, entry, provider, until, message) {
  const st = p.state, L = live.get(st.id);
  const first = st.status !== 'limit';
  st.limit = { provider: provider || 'claude', until, message: String(message || '').slice(0, 200), since: st.limit?.since || now() };
  st.status = 'limit';
  agent(p, name, { status: 'waiting', activity: `Došel limit · pokračuji ${fmtTime(until)}` });
  if (first) { log(p, 'boss', `Došel limit (${provider || 'Claude'}). Nic se neztratilo – pokračuji sám ${fmtTime(until)}, nebo hned po „Zkusit znovu“.`); notify(p, 'Došel limit', `Pokračuji ${fmtTime(until)}.`); }
  save(p);
  for (;;) {
    entry.retryNow = false;
    const wait = Math.max(1000, Math.min(until - Date.now() + 30000, 5 * 60000));
    await new Promise((res) => { const finish = () => { clearTimeout(timer); if (entry.wakeRetry === finish) entry.wakeRetry = null; res(); }; const timer = setTimeout(finish, wait); entry.wakeRetry = finish; });
    if (L?.stopped) throw new Error('stopped');
    if (entry.retryNow || Date.now() >= until) break;
    try { const c = await providerCatalog(true); if (c.models.some((m) => m.available && (m.provider !== provider || !c.providers.find((x) => x.id === provider)?.blocked))) { const prov = c.providers.find((x) => x.id === provider); if (prov && !prov.blocked && (prov.remainingPercent == null || prov.remainingPercent > 0)) break; } } catch {}
  }
  if ([...(L?.running.values() || [])].every((e) => e === entry || !e.waitingLimit)) { st.limit = null; if (st.status === 'limit') st.status = 'running'; }
  agent(p, name, { status: 'working', activity: 'pokračuji po limitu' }); save(p);
}
/** "Zkusit znovu": wake every agent parked on a limit now; a project that is not running is resumed. */
export function retryNow(id) {
  const L = live.get(id);
  if (L) {
    clearBlocked();
    for (const e of L.running.values()) { e.retryNow = true; e.wakeRetry?.(); }
    log(L.p, 'boss', 'Zkouším to znovu hned.'); return { ok: true, mode: 'wake' };
  }
  clearBlocked(); const st = resumeProject(id, { extraRuns: 1 }); return { ok: true, mode: 'resume', status: st.status };
}

async function ask(p, name, o0) {
  const cfg = loadConfig();
  const st = p.state; const L = live.get(st.id);
  let o = { ...o0 };
  if (!o.resume && !o.sessionId) o.sessionId = crypto.randomUUID();
  const entry = { agent: name, child: null, sessionId: o.resume || o.sessionId, inject: null, interrupted: false };
  const rid = crypto.randomUUID(); L.running.set(rid, entry);
  st.agents[name] = { ...(st.agents[name] || {}), task: o.label || st.agents[name]?.task || '' };
  if (!o.quiet) feedPush(p, name, { kind: 'task', text: o.label || 'úkol', model: o.model, effort: o.effort });
  let attempt = 0, timeoutRetries = 0;
  try {
    for (;;) {
      if (L.stopped) throw new Error('stopped');
      if (st.stats.runs >= st.settings.maxRuns) { const e = new Error('budget'); e.budget = true; throw e; }
      agent(p, name, { status: 'working', activity: '…', needsBoss: false, model: o.model, effort: o.effort });
      entry.interrupted = false; const t0 = Date.now();
      const manual = st.agentOverrides?.[name] || {};
      const modelOverride = manual.model && manual.model !== 'auto';
      const effortOverride = manual.effort && manual.effort !== 'auto';
      const smoke = process.env.AGENT_OFFICE_TEST_SMOKE === '1' && st.settings.allowWeakBoss && st.settings.forceModel && routingPreference().model === 'auto' && !modelOverride && !effortOverride;
      try {
        const catalog = smoke ? null : await providerCatalog();
        if (catalog && !catalog.models.some(m=>m.available) && catalog.providers.some((x) => x.available || x.blocked)) {
          const blocked = catalog.providers.filter((x) => x.blocked || (x.remainingPercent === 0));
          const until = blocked.length ? Math.min(...blocked.map((x) => limitUntil(x.id, '', catalog))) : Date.now() + 15 * 60000;
          entry.waitingLimit = true; try { await waitForCapacity(p, name, entry, blocked[0]?.id || 'claude', until, 'Žádný model teď nemá volnou kapacitu.'); } finally { entry.waitingLimit = false; }
          continue;
        }
        const selected = smoke ? { provider: 'claude', model: o.model, effort: o.effort, reason: 'Pevně nastavený smoke test' } : chooseRoute(catalog, { role: name, task: o.label, fast: !!o.interactive, model: o.model, provider: o.provider, effort: o.effort, pinned: modelOverride || o.pinned, agentOverride: !!modelOverride, effortOverride: !!effortOverride, excludeModels: modelOverride ? [] : o.excludeModels, ...(modelOverride ? { model: manual.model } : {}), ...(effortOverride ? { effort: manual.effort } : {}) });
        if(st.stats.runs>=st.settings.maxRuns) throw Object.assign(new Error('budget'),{budget:true});
        st.stats.runs++;
        entry.provider = selected.provider; entry.model = selected.id;
        agent(p, name, { provider: selected.provider, model: selected.model, effort: selected.effort, routeReason: selected.reason });
        feedPush(p, name, { kind: 'sys', text: `${selected.provider} / ${selected.model}: ${selected.reason}` });
        const opts = { ...o, ...selected, agent: name, entry };
        if(name==='boss' && (selected.provider==='codex' || st.lastProvider?.boss==='codex')) opts.prompt += '\nRecover the project goal and decisions before proceeding: '+st.goal+'\nRead '+path.join(p.dir,'office','DECISIONS.md')+' and use existing artifacts.';
        if (selected.provider === 'claude' && st.lastProvider?.[name] && st.lastProvider[name] !== 'claude') { delete opts.resume; opts.sessionId = crypto.randomUUID(); }
        const r = selected.provider === 'claude' ? await runClaude(p, opts) : await runCodex(p, opts, {
          entry,
          onEvent: (e) => { feedPush(p, name, e); if (e.kind === 'tool') agent(p, name, { activity: e.text }); },
          onChild: (child, add) => add ? L.children.add(child) : L.children.delete(child),
        });
        if (L.stopped) throw new Error('stopped');
        if (selected.provider !== 'claude') scanReports(p, name, Date.now() - 300000);
        if (name === 'boss' && selected.provider === 'claude' && r.session) st.bossSession = r.session;
        st.lastProvider ||= {}; st.lastProvider[name] = selected.provider;
        st.stats.tokens ||= {};
        const tokens = st.stats.tokens[selected.provider] ||= { input: 0, output: 0, cached: 0 };
        tokens.input += r.usage?.input_tokens || 0; tokens.output += r.usage?.output_tokens || 0; tokens.cached += r.usage?.cached_input_tokens || r.usage?.cache_read_input_tokens || 0;
        st.stats.cost += r.cost; agent(p, name, { status: 'idle', activity: '' });
        recordAttempt(p, { role: name, task: o.label || '', taskId: o.taskId || null, provider: selected.provider, model: selected.model, effort: selected.effort, ms: Date.now() - t0, outcome: 'ok', tokens: tokensOf(selected.provider, r.usage), cost: r.cost || 0 });
        if (r.session) { st.agentSession ||= {}; st.agentSession[name] = r.session; (st.ownSessions ||= []).push(r.session); if (st.ownSessions.length > 200) st.ownSessions.shift(); }
        return r;
      } catch (e) {
        recordAttempt(p, { role: name, task: o.label || '', taskId: o.taskId || null, provider: entry.provider || null, model: entry.model || o.model, effort: o.effort, ms: Date.now() - t0, outcome: L.stopped ? 'stopped' : e.interrupted ? 'interrupted' : e.timedOut ? 'timeout' : e.limit ? 'limit' : 'failed', error: String(e.message || '').slice(0, 200), tokens: tokensOf(entry.provider, e.usage) });
        if (L.stopped) throw new Error('stopped');
        if (e.interrupted) { // user message injected: resume the same session with it
          const msg = entry.inject; entry.inject = null; entry.interrupted = false;
          const wrap = `USER MESSAGE (sent while you were working): "${msg}"\nAnswer it in 1-3 sentences of plain text first. Then continue your current task (if the message changes direction, update the relevant files/plan) and finish with the required JSON result.\n\nORIGINAL TASK:\n${o0.prompt}`;
          o = { ...o, resume: entry.sessionId, sessionId: undefined, prompt: wrap, fallbackPrompt: `${wrap}\n\n(Your earlier session could not be resumed; this was the original task:)\n${o0.prompt}` };
          continue;
        }
        if (o.resume && o.fallbackPrompt && /no conversation|session/i.test(e.message)) { o = { ...o, resume: undefined, sessionId: crypto.randomUUID(), prompt: o.fallbackPrompt, fallbackPrompt: null }; entry.sessionId = o.sessionId; continue; }
        if (e.message === 'stopped') throw e;
        if(e.timedOut && timeoutRetries++ < 1) {
          const choice=routingPreference().model||'auto', fixed=choice.includes('/')||o.pinned||st.agentOverrides?.[name]?.model && st.agentOverrides[name].model !== 'auto';
          const c=await providerCatalog();
          const alternatives=c.models.filter(m=>m.available&&m.id!==entry.model&&(!['codex','claude','ollama'].includes(choice)||m.provider===choice));
          if(!fixed&&alternatives.length)o.excludeModels=[...(o.excludeModels||[]),entry.model];
          o={...o,prompt:`Previous attempt timed out. Inspect existing task files first; preserve completed work and finish only what is missing. Keep this retry focused and return the required JSON.\n\n${o0.prompt}`};
          log(p,name,'Model překročil časový limit. Jeden opakovaný pokus naváže na uložené soubory.');
          feedPush(p,name,{kind:'sys',text:'Obnovuji krok po timeoutu; hotové soubory zůstávají.'});continue;
        }

        if (e.limit) {
          st.stats.runs = Math.max(0, st.stats.runs - 1); // a refused call is not work: it does not eat the run budget
          let refreshed = null; try { refreshed = smoke ? null : await providerCatalog(true); } catch {}
          const until = limitUntil(entry.provider || 'claude', e.message, refreshed);
          if (!smoke) markUnavailable(entry.provider || 'claude', Math.max(60, Math.round((until - Date.now()) / 1000)));
          const free = !smoke && !o.pinned && !modelOverride && refreshed?.routing?.model === 'auto' && refreshed.models.some((m) => m.available && m.provider !== entry.provider);
          if (free) { log(p, name, 'Limit služby – předávám úkol jinému dostupnému modelu.'); continue; }
          entry.waitingLimit = true; try { await waitForCapacity(p, name, entry, entry.provider || 'claude', until, e.message); } finally { entry.waitingLimit = false; }
          continue;
        }
        agent(p, name, { status: 'blocked', activity: e.message.slice(0, 80) });
        feedPush(p, name, { kind: 'error', text: e.message });
        throw e;
      }
    }
  } finally { L.running.delete(rid); }
}

// ---------- talking to agents ----------
const CHAT_SCHEMA = { type: 'object', required: ['reply', 'changed'], properties: { reply: { type: 'string' }, changed: { type: 'boolean' } } };
export async function sendMessage(id, agentName, text) {
  { const L0 = live.get(id); if (L0) bumpHuman(L0.p.state, agentName === 'boss' ? 'directives' : 'messages'); }
  const L = live.get(id); if (!L) return { ok: false, error: 'Projekt neběží (po restartu serveru ho nelze oslovit).' };
  const p = L.p, st = p.state;
  if (!roleOf(st, agentName) && agentName !== 'boss') return { ok: false, error: 'neznámý agent' };
  text = String(text || '').trim().slice(0, 2000); if (!text) return { ok: false, error: 'prázdná zpráva' };
  feedPush(p, agentName, { kind: 'user', text });
  if (agentName === 'boss') { (st.directives ||= []).push({ t: now(), text, ack: false }); log(p, 'boss', `Nový pokyn od uživatele: ${text.slice(0, 80)}`); }
  const runs = [...L.running.values()].filter((r) => r.agent === agentName);
  if (runs.length) {
    for (const r of runs) { r.inject = text; r.interrupted = true; try { r.child?.kill('SIGTERM'); } catch {} }
    return { ok: true, mode: 'interrupt' };
  }
  chatIdle(p, agentName, text).catch((e) => feedPush(p, agentName, { kind: 'error', text: e.message }));
  return { ok: true, mode: 'idle' };
}
async function chatIdle(p, agentName, text) {
  const st = p.state, L = live.get(st.id);
  const session = agentName === 'boss' ? st.bossSession : st.agentSession?.[agentName];
  const ctx = p.ctx;
  if (!session || !ctx) {
    feedPush(p, agentName, { kind: 'reply', text: agentName === 'boss' ? 'Zapsal jsem si to – zohledním to hned, jak začnu plánovat.' : 'Zatím jsem nedostal žádný úkol. Předávám zprávu Bossovi.' });
    if (agentName !== 'boss') { (st.directives ||= []).push({ t: now(), text: `(pro ${agentName}) ${text}`, ack: false }); }
    return;
  }
  const route0 = { model: st.agents[agentName]?.model || (agentName === 'boss' ? loadConfig().bossModel : 'sonnet'), effort: st.agents[agentName]?.effort || 'low' };
  const isBoss = agentName === 'boss';
  const r = isBoss ? bossRoute(p, 'medium') : route(p, route0);
  const prompt = isBoss
    ? `USER MESSAGE TO THE BOSS (outside a phase): "${text}"\nReply conversationally in Czech (1-4 sentences). If it changes direction, taste or scope, update ${ctx.office}/TASTE.md and ${ctx.office}/SCORECARD.md now and set changed=true. Do NOT start or redo project phases.`
    : `USER MESSAGE: "${text}"\nReply in Czech, briefly. If the user asks for a change in your work, do it in ${ctx.work} and mention what you changed. Set changed=true only if you edited files.`;
  const run = () => ask(p, agentName, { ...r, system: isBoss ? bossSys() : (roleOf(st, agentName)?.base ? roleSys(agentName) : roleOf(st, agentName)?.prompt || ''), prompt, cwd: isBoss ? ctx.work : (agentName === 'researcher' ? ctx.office : ctx.work), addDirs: [ctx.office, ctx.work], tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'WebFetch', 'Skill'], bash: !isBoss, schema: CHAT_SCHEMA, resume: session, quiet: true, interactive: true, label: 'rozhovor' });
  const out = await (isBoss ? withLock(L, run) : run());
  feedPush(p, agentName, { kind: 'reply', text: out.data?.reply || out.text || '(bez odpovědi)' });
  if (isBoss && out.data?.changed) { (st.directives ||= []).forEach((d) => (d.ack = true)); log(p, 'boss', 'Boss upravil vkus/scorecard podle tvé zprávy.'); }
}

// ---------- user questions ----------
async function askUser(p, qs) {
  qs = (qs || []).slice(0, loadConfig().maxQuestions);
  if (!qs.length) return {};
  const st = p.state;
  const items = qs.map((q) => ({ ...q, id: `${Date.now().toString(36)}-${q.id}`, answer: null, auto: false, asked: now() }));
  st.inbox.push(...items); st.status = 'waiting_user'; agent(p, 'boss', { status: 'waiting', activity: 'čeká na tebe' });
  log(p, 'boss', `Mám ${items.length} otázky.`); notify(p, 'Boss se ptá', items.map((i) => i.text).join(' | '));
  await new Promise((resolve) => {
    const done = () => items.every((i) => i.answer !== null);
    const timer = setTimeout(() => { items.forEach((i) => { if (i.answer === null) { i.answer = i.default; i.auto = true; } }); resolve(); }, st.settings.answerTimeoutMin * 60000);
    live.get(st.id).wake = () => { if (done()) { clearTimeout(timer); resolve(); } };
  });
  st.status = 'running'; agent(p, 'boss', { status: 'idle', activity: '' }); save(p);
  return Object.fromEntries(items.map((i) => [i.text, i.auto ? `${i.answer} (auto-default, user did not answer)` : i.answer]));
}
export function answer(id, qid, value) {
  { const L0 = live.get(id); if (L0) bumpHuman(L0.p.state, 'answers'); }
  const L = live.get(id); if (!L) return false;
  const q = L.p.state.inbox.find((i) => i.id === qid); if (!q) return false;
  q.answer = String(value); save(L.p); L.wake?.(); return true;
}

// ---------- git worktree ----------
/** Skills learned for this project (autoharness writes <project>/.claude/skills) are also visible to Codex via .agents/skills. */
function shareProjectSkills(work) {
  try {
    const claudeSkills = path.join(work, '.claude', 'skills'), agents = path.join(work, '.agents'), link = path.join(agents, 'skills');
    fs.mkdirSync(claudeSkills, { recursive: true }); fs.mkdirSync(agents, { recursive: true });
    if (!fs.existsSync(link)) fs.symlinkSync(path.join('..', '.claude', 'skills'), link, 'dir');
    const top = execFileSync('git', ['-C', work, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim();
    const ex = path.resolve(work, top, 'info', 'exclude'); const cur = read(ex);
    const want = ['.agents/', '.claude/autoharness/'].filter((l) => !cur.split('\n').includes(l));
    if (want.length) { fs.mkdirSync(path.dirname(ex), { recursive: true }); fs.appendFileSync(ex, (cur.endsWith('\n') || !cur ? '' : '\n') + want.join('\n') + '\n'); }
  } catch {}
}
function setupWork(p) {
  const st = p.state;
  try {
    const top = execFileSync('git', ['-C', st.cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const rel = path.relative(top, st.cwd);
    const wt = path.join(p.dir, 'work');
    const branch = `office/${st.id}`;
    if (st.git && st.branch && fs.existsSync(wt)) return path.join(wt, rel); // continuing the same office: same worktree/branch
    execFileSync('git', ['-C', top, 'worktree', 'add', '-b', branch, wt], { stdio: 'ignore' });
    st.branch = branch; st.git = true; return path.join(wt, rel);
  } catch { st.git = false; log(p, 'boss', 'Cíl není git repo – pracuji přímo v něm (bez větve).'); return st.cwd; }
}
function commit(p, msg) {
  if (!p.state.git) return;
  try {
    const wt = path.join(p.dir, 'work');
    execFileSync('git', ['-C', wt, 'add', '-A']);
    execFileSync('git', ['-C', wt, 'commit', '-m', msg, '--allow-empty-message', '-q'], { stdio: 'ignore' });
  } catch {}
}

// ---------- phases ----------
const bossSys = () => read(path.join(ROOT, 'boss.md'));
const roleSys = (r) => read(path.join(ROOT, 'roles', `${r}.md`)) || '';

const CMD_OK = /^(node|python3|npm (test|run [\w:-]+)|npx [\w@./-]+)(\s|$)/;
async function commandTask(p, t, ctx) { // deterministic work without a model call
  const cmd = String(t.command || '').trim(); const cfg = loadConfig();
  if (!CMD_OK.test(cmd) || /[;&|`$<>]/.test(cmd) || cfg.bashDeny.some((d) => cmd.startsWith(d.replace('*', '')))) return null; // not safe/simple enough -> use a model
  log(p, t.role, `${t.title} [kód, bez modelu]`); const t0 = Date.now();
  const [bin, ...args] = cmd.split(/\s+/);
  const res = await new Promise((ok) => execFile(findBin(bin) || bin, args, { cwd: ctx.work, env: childEnv(), timeout: 10 * 60000, maxBuffer: 8e6 }, (err, out, errOut) => ok({ err, out: String(out), errOut: String(errOut) })));
  recordAttempt(p, { role: t.role, task: t.title, taskId: t.id, provider: 'code', model: 'code', effort: '-', ms: Date.now() - t0, outcome: res.err ? 'failed' : 'ok', tokens: tokensOf('code', {}) });
  const d = { status: res.err ? 'blocked' : 'done', summary: res.err ? `Příkaz selhal: ${String(res.err.message).slice(0, 200)}` : `Příkaz proběhl: ${cmd}`, conclusion: (res.out || res.errOut).slice(-1500), evidence: [{ claim: 'output of ' + cmd, source: `handoffs/${t.id}.md` }], uncertainties: [], open_questions: [] };
  return d;
}
function writeHandoff(p, t, d) {
  const f = path.join(p.ctx.office, 'handoffs', `${t.id}.md`); fs.mkdirSync(path.dirname(f), { recursive: true });
  const md = `# ${t.id} – ${t.title}\nRole: ${t.role} · Status: ${d.status}\nQuestion: ${t.question || '-'}\nOutput: ${t.output || '-'} · Used by: ${t.consumer || '-'}${t.critical ? ' · CRITICAL' : ''}\n\n## Conclusion\n${d.conclusion || d.summary || ''}\n\n## Evidence\n${(d.evidence || []).map((e) => `- ${e.claim} → ${e.source}`).join('\n') || '- (none given)'}\n\n## Uncertainties\n${(d.uncertainties || []).map((x) => '- ' + x).join('\n') || '- none'}\n\n## Open questions\n${(d.open_questions || []).map((x) => '- ' + x).join('\n') || '- none'}\n`;
  fs.writeFileSync(f, md); return f;
}
function handoffIndex(p, tasks) {
  return tasks.filter((t) => t.status === 'done' || t.status === 'failed').map((t) => `- ${t.id} [${t.role}${t.critical ? ', CRITICAL' : ''}] ${t.status}: ${String(t.conclusion || t.summary || '').replace(/\s+/g, ' ').slice(0, 220)}${t.uncertain ? ' ⚠ uncertain' : ''} → ${p.ctx.office}/handoffs/${t.id}.md`).join('\n');
}
function decide(p, title, lines) { // short running decision log: keeps continuity across new processes and model switches
  try { fs.appendFileSync(path.join(p.ctx.office, 'DECISIONS.md'), `\n## ${now().slice(0, 16).replace('T', ' ')} · ${title}\n${[].concat(lines).filter(Boolean).map((l) => '- ' + String(l).replace(/\s+/g, ' ').slice(0, 300)).join('\n')}\n`); } catch {}
}

async function worker(p, t, ctx) {
  const st = p.state;
  if (t.command) { const d = await commandTask(p, t, ctx); if (d) { Object.assign(t, { status: d.status === 'done' ? 'done' : 'failed', summary: d.summary, conclusion: d.conclusion }); writeHandoff(p, t, d); save(p); return; } }
  let role = roleOf(st, t.role);
  if (!role) { hireRole(p, { id: t.role, title: t.role, responsibility: t.title }); role = roleOf(st, slug(t.role)); t.role = role.id; save(p); }
  const r0 = route(p, { ...t, model: role.manual && role.model && role.model !== 'auto' ? role.model : t.model || role.model, effort: role.manual && role.effort && role.effort !== 'auto' ? role.effort : t.effort || role.effort, pinned: !!(role.manual && role.model && role.model !== 'auto') });
  const tl = role.tools || ['read'];
  const isRO = role.base ? READONLY.has(t.role) : !tl.includes('write');
  const cwd = t.role === 'researcher' || isRO ? ctx.office : ctx.work;
  const system = `${role.base ? roleSys(t.role) : `${role.prompt}\n\nYou are ${role.name}, ${role.title}. ${PERSONALITY[role.character] || ''} (flavour only; never at the cost of quality)`}\n\n${roleSys('_contract')}`;
  if (!(t.skills || []).length && !t.command) t.skills = autoSkills(t);
  const skillDirs = [...new Set(skillRoots().map(([d]) => d))];
  const prompt = `Office files (read only what you need): ${ctx.office}/BRIEF.md (goal, assumptions, answers) · SCORECARD.md (definition of done) · TASTE.md · DECISIONS.md · SKILLS.md (library of expert skills: open and follow any that fits your task – prefer a skill over improvising).\nWorking dir (project files): ${ctx.work}\n\nTASK ${t.id}: ${t.title}\n${t.question ? `Question it answers: ${t.question}\nInputs that already exist (reuse, do not redo): ${(t.inputs || []).join('; ') || '-'}\nOutput to create: ${t.output || '-'}\nUsed by: ${t.consumer || '-'}\n` : ''}${t.instructions}\n\nACCEPTANCE:\n${(t.acceptance || []).map((a) => '- ' + a).join('\n')}${skillText(t.skills)}`;
  const tools = [...new Set(['Read', 'Glob', 'Grep', 'Write', ...(tl.includes('write') ? ['Edit'] : []), ...(tl.includes('web') ? ['WebSearch', 'WebFetch'] : [])])];
  let r = r0, guidance = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    log(p, t.role, `${t.title} [${r.model}/${r.effort}]`);
    try {
      const out = await ask(p, t.role, { ...r, label: t.title, taskId: t.id, system, prompt: prompt + guidance, cwd, addDirs: [ctx.office, ctx.work, ...skillDirs], tools, bash: tl.includes('bash'), schema: SCHEMAS.worker });
      const d = out.data || { status: 'done', summary: out.text?.slice(0, 200) || '' };
      writeHandoff(p, t, d);
      if (d.status === 'done') { t.status = 'done'; t.summary = d.summary; t.conclusion = d.conclusion || d.summary; t.uncertain = !!(d.uncertainties || []).length || !(d.evidence || []).length; t.concerns = d.concerns || []; feedPush(p, t.role, { kind: 'taskend', text: `${t.title}: ${d.summary}`, files: d.changed_files || [] }); if (!isRO) commit(p, `office: ${t.title}`); save(p); return; }
      log(p, t.role, `Blokováno: ${d.summary}`);
      agent(p, t.role, { status: 'waiting', activity: 'Konzultuji problém se šéfem', needsBoss: true });
      if (attempt === 0) {
        const advice = await bossCall(p, ctx, SCHEMAS.advice, `EMPLOYEE CONSULTATION. ${t.role} needs your decision on task ${t.id}: ${t.title}. Blocker: ${d.summary}. Concerns: ${JSON.stringify(d.concerns || [])}. Read the relevant rules and files if needed. Give concrete instructions to unblock this employee. Choose safe assumptions yourself where possible; do not claim unavailable facts or that a missing tool is available. Return instructions for the next attempt.`);
        guidance = `\n\nYOUR SUPERVISOR'S DECISION:\n${advice.instructions}`;
        feedPush(p, t.role, { kind: 'sys', text: `Šéf: ${advice.instructions}` });
      }
    } catch (e) { if (e.budget || e.message === 'stopped') throw e; log(p, t.role, `Chyba: ${e.message}`); }
    r = escalate(r);
  }
  t.status = 'failed'; save(p);
}

// ---------- shared task board ----------
// The boss only plans and decomposes. Tasks sit on a board in the office; free workers CLAIM the next ready task with an
// atomic lock file (open 'wx' – two workers can never hold the same task), and mark it done. The board survives crashes.
const RUN_ID = crypto.randomUUID().slice(0, 8);
const boardDir = (p) => path.join(p.ctx.office, 'board');
function claim(p, t, who) {
  const f = path.join(boardDir(p), 'claims', `${t.id}.lock`); fs.mkdirSync(path.dirname(f), { recursive: true });
  try { const fd = fs.openSync(f, 'wx'); fs.writeSync(fd, JSON.stringify({ by: who, run: RUN_ID, at: now() })); fs.closeSync(fd); return true; }
  catch { // a lock left behind by a crashed run is stale and may be taken over
    try { const old = JSON.parse(read(f) || '{}'); if (old.run !== RUN_ID) { fs.writeFileSync(f, JSON.stringify({ by: who, run: RUN_ID, at: now(), tookOver: old.by || true })); return true; } } catch {}
    return false;
  }
}
const release = (p, t) => { try { fs.unlinkSync(path.join(boardDir(p), 'claims', `${t.id}.lock`)); } catch {} };
function writeBoard(p) {
  const st = p.state; const icon = { pending: '○', running: '◐', done: '●', failed: '✕' };
  try {
    fs.mkdirSync(boardDir(p), { recursive: true });
    fs.writeFileSync(path.join(boardDir(p), 'tasks.json'), JSON.stringify(st.tasks.map(({ id, title, role, status, depends_on, output, critical, claimedBy }) => ({ id, title, role, status, depends_on, output, critical, claimedBy })), null, 2));
    fs.writeFileSync(path.join(p.ctx.office, 'BOARD.md'), `# Tabule úkolů\n\n| | Úkol | Kdo | Čeká na | Výstup |\n|---|---|---|---|---|\n${st.tasks.map((t) => `| ${icon[t.status] || '?'} | ${t.id} ${t.title}${t.critical ? ' ⚑' : ''} | ${t.claimedBy || t.role} | ${(t.depends_on || []).join(', ') || '–'} | ${t.output || '–'} |`).join('\n')}\n\n○ čeká · ◐ rozpracováno · ● hotovo · ✕ nepovedlo se · ⚑ kritické (dvojí ověření)\n`);
  } catch {}
}
const isReader = (st, t) => { const r = roleOf(st, t.role); return !!r && (r.base ? READONLY.has(t.role) : !(r.tools || []).includes('write')); };
async function runTasks(p, tasks, ctx) {
  const st = p.state; const conc = Math.max(1, st.settings.concurrency || 2);
  for (const t of tasks) { t.status = 'pending'; t.claimedBy = null; const i = st.tasks.findIndex((x) => x.id === t.id); if (i >= 0) st.tasks[i] = t; else st.tasks.push(t); }
  writeBoard(p); save(p);
  const depsDone = (t) => (t.depends_on || []).every((d) => { const x = st.tasks.find((y) => y.id === d); return !x || x.status === 'done' || x.status === 'failed'; });
  let writerBusy = false;
  const slot = async () => {
    for (;;) {
      // a free worker looks at the board and takes the first ready task it is allowed to do (one writer at a time: shared working copy)
      const t = tasks.find((x) => x.status === 'pending' && depsDone(x) && (isReader(st, x) || !writerBusy) && claim(p, x, x.role));
      if (!t) {
        if (live.get(st.id)?.stopped || !tasks.some((x) => x.status === 'running')) return; // stopped, or nothing running and nothing claimable
        await new Promise((r) => setTimeout(r, 150)); continue;
      }
      const writer = !isReader(st, t); if (writer) writerBusy = true;
      t.status = 'running'; t.claimedBy = t.role; writeBoard(p); save(p);
      try { await worker(p, t, ctx); } catch (e) { if (t.status === 'running') t.status = 'pending'; throw e; } finally { if (writer) writerBusy = false; if (t.status !== 'pending') release(p, t); writeBoard(p); }
    }
  };
  await Promise.all(Array.from({ length: conc }, slot));
  for (const t of tasks) if (t.status === 'pending') { t.status = 'failed'; t.summary = 'Závislosti se nedokončily.'; }
  writeBoard(p); save(p);
}

async function bossCall(p, ctx, schema, prompt) {
  const label = { INTAKE: 'Průzkum zadání', SYNTHESIS: 'Vkus a scorecard', PLAN: 'Plán', JUDGE: 'Soudím výsledek', FINISH: 'Závěr' }[(prompt.match(/PHASE \d – (\w+)/) || [])[1]] || 'Boss';
  const st = p.state; const L = live.get(st.id);
  // Opus always; effort scales with the phase (xhigh when a later round is still scoring badly)
  const r = bossRoute(p, label === 'Závěr' ? 'medium' : label === 'Soudím výsledek' && st.round >= 2 && (st.score ?? 100) < 70 ? 'xhigh' : 'high');
  return withLock(L, async () => {
    if (st.bossSession && st.bossCwd && st.bossCwd !== ctx.work) { st.bossSession = null; decide(p, 'Nová relace šéfa', ['Pracovní složka se změnila; navazuji přes DECISIONS.md.']); }
    const first = !st.bossSession;
    if (first) { st.bossSession = crypto.randomUUID(); st.bossCwd = ctx.work; }
    const pending = (st.directives || []).filter((d) => !d.ack);
    let pre = pending.length ? `USER DIRECTIVES (they override earlier assumptions; update TASTE.md/SCORECARD.md and the plan accordingly):\n${pending.map((d) => '- ' + d.text).join('\n')}\n\n` : '';
    if (!(process.env.AGENT_OFFICE_TEST_SMOKE === '1' && st.settings.allowWeakBoss && st.settings.forceModel)) {
      const catalog = await providerCatalog();
      if (['Plán', 'Soudím výsledek', 'Průzkum zadání'].includes(label)) pre += `MODELS YOU MAY ROUTE TO (id · tier${catalog.providers.some((x) => x.blocked) ? '; skip blocked providers' : ''}): ${catalog.models.filter((m) => m.available).map(({ id, tier }) => `${id}·${tier}`).join(', ')}. Tiers: fast < balanced < deep < frontier (Claude Fable – the strongest; it has its own weekly pool). Cheaper tier for checkable work; deep/frontier only for hard judgement, architecture and contradictions. Codex models also accept effort 'ultra' (maximum reasoning with automatic delegation) – only for a genuinely hard, multi-step coding task.\n\n`;
    }
    const out = await ask(p, 'boss', { ...r, label, taskId: 'boss-' + (st.phase || 'x'), system: bossSys(), prompt: pre + prompt, cwd: ctx.work, tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Skill'], addDirs: [ctx.office], sessionName: `${st.repoName || path.basename(st.cwd)} · Šéf`, schema, ...(first ? { sessionId: st.bossSession } : { resume: st.bossSession }) });
    pending.forEach((d) => (d.ack = true));
    if (!out.data) throw new Error('Boss nevrátil strukturovaný výstup');
    return out.data;
  });
}

const phase = (p, name) => { p.state.phase = name; save(p); };
const fileOk = (f) => { try { return fs.statSync(f).size > 20; } catch { return false; } };
/** MUST criteria are the definition of done: every MUST needs PASS with evidence. */
function verifiedDone(judged) {
  const must = (judged?.criteria || []).filter((c) => c.level === 'MUST');
  return must.length > 0 && must.every((c) => c.status === 'PASS' && String(c.evidence || '').trim().length > 3);
}
function openGaps(st, judged) {
  const failing = (judged?.criteria || []).filter((c) => c.level === 'MUST' && c.status !== 'PASS').map((c) => `${c.id}: ${c.status === 'FAIL' ? 'nesplněno' : 'neověřeno'}${c.evidence ? ' – ' + c.evidence : ''}`);
  const gaps = (judged?.gaps || []).map((g) => g.title);
  const failedTasks = (st.tasks || []).filter((t) => t.status === 'failed').map((t) => `Úkol se nepodařil: ${t.title}`);
  return [...new Set([...failing, ...gaps, ...failedTasks])];
}
/** Without any model call: an honest FINAL.md with what exists and what is missing. */
function writePartialFinal(p, reason) {
  const st = p.state; const gaps = openGaps(st, st.checkpoint?.judged);
  const done = (st.tasks || []).filter((t) => t.status === 'done').map((t) => `- ${t.title}${t.conclusion ? ': ' + String(t.conclusion).replace(/\s+/g, ' ').slice(0, 200) : ''}`);
  const md = `# Rozpracovaný výsledek\n\n**Proč není hotovo:** ${reason}\n\n## Co je hotové\n${done.join('\n') || '- zatím nic ověřeného'}\n\n## Co chybí (konkrétně)\n${gaps.map((g) => '- ' + g).join('\n') || '- poslední kontrola neproběhla, kritéria nejsou ověřená'}\n\n## Kde to najdeš\n- Výstupy: ${p.ctx?.work || st.cwd}/deliverables\n- Předávky a důkazy: ${p.ctx?.office}/handoffs\n- Rozhodnutí: ${p.ctx?.office}/DECISIONS.md\n\nPokračovat lze tlačítkem „Pokračovat“ – navážu na poslední ověřený stav.\n`;
  try { fs.writeFileSync(path.join(p.ctx.office, 'FINAL.md'), md); } catch {}
  st.final = { summary: `Rozpracováno: ${reason}`, remaining: gaps, partial: true };
}

async function runUltrareview(p, ctx) {
  const st = p.state, cp = st.checkpoint;
  // Preference from Connections → Claude: 'ask' (default), 'auto' (run without asking) or 'off'.
  const pref = ultrareviewPref();
  if (pref === 'off') { cp.ultrareviewDone = true; decide(p, 'Ultrareview', ['Vypnuto v nastavení Připojení.']); return; }
  const ans = pref === 'auto' ? { ultrareview: 'Pustit' } : await askUser(p, [{ id: 'ultrareview', text: 'Šéf chce pustit Claude ultrareview – cloudovou kontrolu kódu více agenty (účtuje se zvlášť, trvá až 45 min). Pustit?', options: ['Pustit', 'Přeskočit'], default: 'Přeskočit' }]);
  cp.ultrareviewDone = true;
  if (!String(Object.values(ans)[0] || '').startsWith('Pustit')) { decide(p, 'Ultrareview', ['Uživatel nepovolil.']); return; }
  commit(p, 'office: před ultrareview'); log(p, 'tester', 'Spouštím Claude ultrareview (cloud).'); agent(p, 'tester', { status: 'working', activity: 'Claude ultrareview v cloudu' });
  const t0 = Date.now();
  const r = await new Promise((ok) => execFile(findBin('claude'), ['ultrareview', '--json', '--trust-workspace', '--timeout', '45'], { cwd: ctx.work, env: childEnv(), timeout: 50 * 60000, maxBuffer: 16e6 }, (err, out, errOut) => ok({ err, out: String(out), errOut: String(errOut) })));
  recordAttempt(p, { role: 'tester', task: 'Claude ultrareview', provider: 'claude', model: 'ultrareview', effort: '-', ms: Date.now() - t0, outcome: r.err ? 'failed' : 'ok', tokens: tokensOf('claude', {}) });
  let md = `# Claude ultrareview\n\n`;
  try { const j = JSON.parse(r.out); const bugs = j.bugs || j.findings || j; md += (Array.isArray(bugs) ? bugs : []).map((b, i) => `## ${i + 1}. ${b.title || b.summary || 'Nález'}\n- Soubor: ${b.file || b.path || '-'}${b.line ? ':' + b.line : ''}\n- Závažnost: ${b.severity || '-'}\n\n${b.description || b.body || ''}\n`).join('\n') || 'Žádné nálezy.'; }
  catch { md += r.err ? `Kontrola selhala: ${String(r.errOut || r.err.message).slice(-600)}` : r.out.slice(0, 20000); }
  try { fs.writeFileSync(path.join(ctx.office, 'reports', 'ultrareview.md'), md); } catch {}
  agent(p, 'tester', { status: 'idle', activity: '' }); decide(p, 'Ultrareview', [r.err ? 'Selhalo.' : 'Hotovo – nálezy v reports/ultrareview.md.']);
}
function writeBrief(p) {
  const st = p.state, cp = st.checkpoint || {}, it = cp.intake || {};
  try { fs.writeFileSync(path.join(p.ctx.office, 'BRIEF.md'), `# Zadání\n\n${st.goal}\n\n${st.notes ? `## Poznámky a podklady od zadavatele\n${st.notes}\n\n` : ''}## Co má na konci existovat\n${it.deliverable || '-'}\n\n## Jak tomu šéf rozumí\n${it.summary || '-'}\n\n## Předpoklady (zadavatel je může vetovat)\n${(it.assumptions || []).map((a) => '- ' + a).join('\n') || '- žádné'}\n\n## Odpovědi zadavatele\n${Object.entries({ ...(cp.a1 || {}), ...(cp.a2 || {}) }).map(([q, a]) => `- ${q} → ${a}`).join('\n') || '- zatím žádné'}\n`); } catch {}
}
function writePlan(p) {
  const cp = p.state.checkpoint || {};
  try { fs.writeFileSync(path.join(p.ctx.office, 'PLAN.md'), `# Plán\n\n| Úkol | Role | Otázka | Výstup | Kdo to použije | Čeká na |\n|---|---|---|---|---|---|\n${(cp.tasks || []).map((t) => `| ${t.id} ${t.title}${t.critical ? ' ⚑' : ''}${t.command ? ' (kód)' : ''} | ${t.role} | ${t.question || '–'} | ${t.output || '–'} | ${t.consumer || '–'} | ${(t.depends_on || []).join(', ') || '–'} |`).join('\n')}\n\n## Kontrola\n${cp.verify?.instructions || '-'}\n`); } catch {}
}
function finalMarkdown(p, judged) {
  const st = p.state; const c = judged.criteria || []; const ic = { PASS: '✅', FAIL: '❌', UNVERIFIED: '❔' };
  return `# ${st.repoName || 'Projekt'} – výsledek\n\n**Zadání:** ${st.goal}\n\n## Shrnutí\n${judged.summary}\n\n## Kritéria\n| | Kritérium | Úroveň | Důkaz |\n|---|---|---|---|\n${c.map((x) => `| ${ic[x.status]} | ${x.id} | ${x.level} | ${String(x.evidence || '').replace(/\|/g, '/').replace(/\s+/g, ' ')} |`).join('\n')}\n\n## Co se udělalo\n${st.tasks.filter((t) => t.status === 'done' && !/^V-|^R-/.test(t.id)).map((t) => `- **${t.title}** – ${String(t.conclusion || t.summary || '').replace(/\s+/g, ' ').slice(0, 260)}`).join('\n') || '-'}\n\n## Předpoklady\n${(st.assumptions || []).map((a) => '- ' + a).join('\n') || '- žádné'}\n\n## Co zbývá\n${(st.final?.remaining || []).map((r) => '- ' + r).join('\n') || '- nic povinného'}\n\n## Kde to najdeš\n- Výstupy: \`${p.ctx.work}/deliverables\`${st.branch ? `\n- Větev: \`${st.branch}\`` : ''}\n`;
}
/** What the office learned: taste goes to the user's profile, working lessons stay with this office. */
function learn(p) {
  const st = p.state, cp = st.checkpoint || {}; const lessons = cp.lessons || []; if (!lessons.length) return;
  const block = `\n## ${now().slice(0, 10)} · ${String(st.goal).replace(/\s+/g, ' ').slice(0, 80)}\n${lessons.map((l) => '- ' + l).join('\n')}\n`;
  try { fs.appendFileSync(path.join(p.ctx.office, 'LESSONS.md'), block); fs.appendFileSync(path.join(DATA, 'profile.md'), block); } catch {}
}
function publishHtml(p) { try { publishReports(p, { usage: usageReport(p.state.id) }); } catch (e) { log(p, 'boss', `HTML souhrn se nepodařilo vytvořit: ${e.message}`); } }

async function pipeline(p, { resume = false } = {}) {
  const st = p.state; const cfg = loadConfig();
  const office = path.join(p.dir, 'office'); for (const d of ['research', 'reports', 'handoffs']) fs.mkdirSync(path.join(office, d), { recursive: true });
  const preset = JSON.parse(read(path.join(ROOT, 'presets', `${st.preset}.json`), '{"focus":""}'));
  const work = setupWork(p); const ctx = { office, work }; p.ctx = ctx; st.workDir = work;
  shareProjectSkills(work);
  for (const r of st.roles || []) hireRole(p, r);
  const cp = st.checkpoint = resume ? (st.checkpoint || {}) : {};
  if (resume) { log(p, 'boss', 'Navazuji na poslední ověřený stav – hotové a zkontrolované části znovu nedělám.'); decide(p, 'Pokračování', ['Pokračuji od posledního ověřeného výsledku.']); }
  const profilePath = path.join(DATA, 'profile.md');
  const cont = (st.history && st.history.length) ? `\n\nCONTINUING THIS REPO'S OFFICE (not a fresh start). Earlier goals: ${st.history.map((h) => `"${String(h.goal).slice(0, 120)}" (${h.status}, score ${h.score ?? '-'})`).join('; ')}. TASTE.md and SCORECARD.md already exist in ${office}: read and UPDATE them for the new goal instead of redoing all research; research only the gaps.` : '';
  const head = `PRESET FOCUS:\n${preset.focus}\n\nGOAL:\n${st.goal}\n\nUSER NOTES:\n${st.notes || '-'}\n\nTarget project dir: ${work}\nOffice dir (write TASTE.md, SCORECARD.md, FINAL.md here): ${office}\nDecision log (read first, it carries continuity between phases): ${office}/DECISIONS.md\nLessons from earlier jobs in this office (apply them): ${office}/LESSONS.md (may not exist)\nUser profile (learned taste): ${profilePath} (may not exist yet)\nTarget score: ${st.settings.targetScore}. Round limit: ${st.settings.maxRounds}. Run budget: ${st.settings.maxRuns} model runs total.${cont}`;

  // 1) intake
  if (!cp.intake) {
    phase(p, 'intake'); log(p, 'boss', 'Zkoumám zadání a projekt…');
    cp.intake = await bossCall(p, ctx, SCHEMAS.intake, `${head}\n\nPHASE 1 – INTAKE. Inspect the target project and the profile. Output: summary, the deliverable (what exactly will exist at the end and in which files), complexity (small = one person could do it in an hour, no research needed; medium; large), your assumptions, at most ${cfg.maxQuestions} truly blocking questions (usually none), and the research tasks with model+effort each. Research only what changes the result: none for small jobs, at most 3 otherwise; each answers a different question; tell researchers to open at most ~8 pages.\nEXTENDING THE OFFICE: if a capability would clearly improve this job, list it in \`needs\` (2–4 keywords each; the office then searches the plugin directory for you) and/or put an official plugin in \`installs\` (name + why). Official plugins not installed yet: ${officialPlugins().filter((x) => !installedPlugins().some((k) => k.startsWith(x.name + '@'))).map((x) => `${x.name} – ${x.desc}`).join(' | ') || 'none'}.`);
    await installPlugins(p, cp.intake.installs); cp.community = searchCommunityPlugins(cp.intake.needs); writeSkillsIndex(p);
    st.assumptions = cp.intake.assumptions; decide(p, 'Zadání', [cp.intake.summary, `Rozsah: ${cp.intake.complexity} · výstup: ${cp.intake.deliverable}`, ...(cp.intake.assumptions || []).map((a) => 'Předpoklad: ' + a)]); save(p);
    cp.a1 = await askUser(p, cp.intake.questions); if (Object.keys(cp.a1 || {}).length) decide(p, 'Odpovědi uživatele', Object.entries(cp.a1).map(([q, a]) => `${q} → ${a}`));
    writeBrief(p);
  }
  // 2) research: reuse finished research files after a failure
  phase(p, 'research');
  const rtasks = cp.intake.research.map((r,index) => ({ id: `R-${r.id}`, title: `Research: ${r.topic}`, role: hireRole(p,{id:'research-'+(index+1),title:r.topic,tools:['read','web','bash'],prompt:roleSys('researcher')}), question: r.topic, output: `${office}/research/${r.id}.md`, consumer: 'boss (synthesis)', instructions: `${r.instructions}\nWrite findings to ${office}/research/${r.id}.md`, acceptance: ['Every finding has a source URL'], depends_on: [], model: r.model, effort: r.effort }));
  const todoR = rtasks.filter((t) => !fileOk(t.output));
  if (todoR.length < rtasks.length) log(p, 'boss', `Používám ${rtasks.length - todoR.length} hotové rešerše z minula.`);
  await runTasks(p, todoR, ctx);
  // 3) synthesis (small jobs skip this call: the plan call writes the scorecard too)
  const small = cp.intake.complexity === 'small';
  if (!small && (!cp.synth || !fileOk(path.join(office, 'SCORECARD.md')))) {
    phase(p, 'synthesis'); log(p, 'boss', 'Syntetizuji vkus a scorecard…');
    cp.synth = await bossCall(p, ctx, SCHEMAS.synth, `PHASE 2 – SYNTHESIS. User answers so far: ${JSON.stringify(cp.a1 || {})}.\nRead ${office}/research/*.md and the handoffs in ${office}/handoffs/. Write ${office}/TASTE.md and ${office}/SCORECARD.md. SCORECARD items must be tagged MUST/SHOULD/NICE with stable ids (M1, M2, S1…), each objectively verifiable, written BEFORE any work so it cannot be bent to fit the result. Ask questions only if still truly blocking.`);
    decide(p, 'Vkus a kritéria', [`Scorecard: ${cp.synth.scorecard_items} položek (MUST/SHOULD/NICE) – jediná definice „hotovo“.`]);
    cp.a2 = await askUser(p, cp.synth.questions); save(p);
  }
  // 4) plan: non-overlapping tasks with explicit question / inputs / output / consumer
  if (!cp.plan) {
    phase(p, 'plan');
    const cat = skillsCatalog();
    cp.plan = await bossCall(p, ctx, SCHEMAS.plan, `PHASE 3 – PLAN. Answers: ${JSON.stringify(cp.a2 || cp.a1 || {})}.\n${small ? `This is a SMALL job: first write ${office}/SCORECARD.md yourself (3–7 MUST/SHOULD items with stable ids M1, S1…, each objectively checkable; TASTE.md only if tone/visual taste matters), then plan the minimum number of tasks (often 1–2).\n` : ''}${(cp.community || []).length ? `COMMUNITY PLUGINS matching your needs (put one in \`installs\` with its repo only if it clearly earns it; the user is asked to approve): ${cp.community.map((c) => `${c.name} [repo ${c.repo}] – ${c.desc}`).join(' | ')}\n` : ''}SKILLS LIBRARY – use it generously: give every task the skills that fit it (up to 3 in \`skills\`; the worker then gets their full text). A task in a domain that has a skill should have that skill. ${cat.map((k) => `${k.name}${k.desc ? ' – ' + k.desc.slice(0, 70) : ''}`).join(' | ')}\nCURRENT TEAM (role ids you can assign tasks to): ${teamText(st)}.\nThe project can be ANY kind of work. Decide which roles it really needs; hire missing ones in \`hires\` (id, title, responsibility, tools ⊂ read/write/web/bash, default model/effort, precise role prompt).\nYou are responsible for a division of work WITHOUT OVERLAPS. For every task state: question (what it answers), inputs (materials that already exist and must be reused), output (the exact file/artifact it creates), consumer (who uses it). Two tasks must never produce the same output or answer the same question. Mark critical=true when an error in that task would change the recommendation to the customer – the office then has it independently re-verified.\nWhere a result can be produced by plain code (calculation, deduplication, schema validation, running tests, assembling a table from verified data), set \`command\` (a single node/python3/npm test/npx command run in the project dir) instead of using a model.\nModel choice: strong models only for architecture, unclear decisions, resolving contradictions and final expert judgement; cheaper models for anything with an unambiguously checkable result.\nFor a code job you may set \`ultrareview\`=true to request Claude's cloud multi-agent code review of the branch (billed separately; the user is asked first) – only when correctness really matters.\nAlso give verification instructions for the tester that fit the deliverable (UI: serve it, desktop+mobile screenshots; documents: check each SCORECARD id with quotes/pages; code: run tests + usability scenarios).`);
    for (const h of cp.plan.hires || []) hireRole(p, h);
    await installPlugins(p, cp.plan.installs);
    const outs = {}; for (const t of cp.plan.tasks) { if (t.output && outs[t.output]) log(p, 'boss', `Pozor: úkoly ${outs[t.output]} a ${t.id} mají stejný výstup.`); outs[t.output] = t.id; }
    decide(p, 'Plán', [...(cp.plan.hires || []).map((h) => `Najímám: ${h.title}`), ...cp.plan.tasks.map((t) => `${t.id} ${t.role}${t.critical ? ' (kritické, dvojí ověření)' : ''}${t.command ? ' (kód)' : ''}: ${t.question || t.title} → ${t.output || '?'}`)]);
    if ((cp.plan.hires || []).length) log(p, 'boss', `Najímám: ${(cp.plan.hires || []).map((h) => h.title).join(', ')}`);
    cp.tasks = cp.plan.tasks; cp.verify = cp.plan.verify; cp.round = 0; cp.ultrareview = !!cp.plan.ultrareview; writePlan(p); save(p);
  }
  // 5) execute → verify → judge, resumable per round
  let judged = cp.judged || null;
  for (let round = (cp.round || 0) + 1; round <= st.settings.maxRounds; round++) {
    st.round = round; log(p, 'boss', `Kolo ${round}/${st.settings.maxRounds}`);
    phase(p, 'execute');
    const prior = new Map((st.tasks || []).map((t) => [t.id, t]));
    const tasks = cp.tasks.map((t) => prior.get(t.id)?.status === 'done' && (!t.output || fileOk(t.output) || !t.output.startsWith('/')) ? null : t).filter(Boolean);
    if (tasks.length < cp.tasks.length) log(p, 'boss', `${cp.tasks.length - tasks.length} úkolů je hotových z minula – nedělám je znovu.`);
    // independent double check for conclusions that would change the recommendation
    const checks = tasks.filter((t) => t.critical && !t.id.endsWith('-check')).map((t) => ({ id: `${t.id}-check`, title: `Nezávislé ověření: ${t.title}`, role: 'tester', question: `Is the conclusion of ${t.id} correct?`, inputs: [t.output || ''], output: `${office}/handoffs/${t.id}-check.md`, consumer: 'boss', depends_on: [t.id], critical: false, instructions: `Independently re-derive the result of task ${t.id} ("${t.question || t.title}") from the ORIGINAL sources (recompute numbers, re-open the sources, re-run checks). Do it before reading ${t.id}'s conclusion; then compare and list every discrepancy.`, acceptance: ['Own derivation documented', 'Every discrepancy listed with source'], model: t.model, effort: t.effort }));
    await runTasks(p, [...tasks, ...checks], ctx);
    phase(p, 'verify');
    const report = path.join(office, 'reports', `round-${round}.md`);
    if (cp.ultrareview && !cp.ultrareviewDone && st.git) await runUltrareview(p, ctx);
    const focused = round > 1 && judged && !judged.full_review_needed;
    const vInstr = focused ? `FOCUSED RE-VERIFICATION. The previous round failed only on: ${openGaps(st, judged).join('; ')}. Verify that each fix works AND check its likely side effects (anything those changes could have broken). Do not redo the full review; carry over previous PASS results for untouched areas from ${office}/reports/round-${round - 1}.md.` : cp.verify.instructions;
    await runTasks(p, [{ id: `V-${round}`, title: `Test kolo ${round}${focused ? ' (cílené)' : ''}`, role: 'tester', question: 'Which SCORECARD items pass, with evidence?', output: report, consumer: 'boss (judge)', instructions: `${vInstr}\nWalk ${office}/SCORECARD.md item by item by id: PASS / FAIL / UNVERIFIED with concrete evidence (screenshot path, file:line, quote, command output). Write the report to ${report} and screenshots to ${office}/reports/shots-${round}/`, acceptance: ['Every MUST id has PASS/FAIL/UNVERIFIED with evidence', 'Section "Visible problems"'], depends_on: [], model: cp.verify.model, effort: cp.verify.effort }], ctx);
    phase(p, 'judge');
    judged = await bossCall(p, ctx, SCHEMAS.judge, `PHASE 4 – JUDGE round ${round}. Read ${report}${cp.ultrareviewDone ? `, the independent cloud code review in ${office}/reports/ultrareview.md` : ''}, the screenshots in ${office}/reports/shots-${round}/ and this handoff index (short results with paths to full evidence):\n${handoffIndex(p, st.tasks)}\nVerify in the ORIGINAL material every conclusion that is contested, critical or weakly sourced (⚠). Return \`criteria\`: every SCORECARD id with level, PASS/FAIL/UNVERIFIED and the evidence you checked. A MUST without real evidence is UNVERIFIED, never PASS. Your score is secondary; the office decides "done" only from MUST criteria. If not passed, emit concrete gap tasks (role = one of: ${teamText(st)}) with question/inputs/output/consumer. Set full_review_needed=true only if a core assumption or the solution as a whole changed. In \`lessons\` give 0–3 short, reusable lessons (about this user's taste or about what worked/failed), not a recap. Round ${round} of ${st.settings.maxRounds}.`);
    st.score = judged.score; cp.judged = judged; cp.round = round;
    const failingNow = (judged.criteria || []).filter((c) => c.level === 'MUST' && c.status !== 'PASS').map((c) => c.id);
    const stuck = failingNow.filter((id) => (cp.failedBefore || []).includes(id)); cp.failedBefore = failingNow;
    if ((judged.lessons || []).length) { cp.lessons = [...new Set([...(cp.lessons || []), ...judged.lessons])].slice(-12); }
    const ok = verifiedDone(judged);
    decide(p, `Hodnocení kola ${round}`, [`Skóre ${judged.score}/100, MUST ověřeno: ${ok ? 'ano' : 'ne'}`, ...openGaps(st, judged).map((g) => 'Chybí: ' + g)]);
    log(p, 'boss', `Skóre ${judged.score}/100 – ${ok ? 'všechna povinná kritéria ověřena' : 'chybí ' + openGaps(st, judged).length + ' věcí'}`);
    save(p);
    if (ok && judged.score >= st.settings.targetScore) break;
    if (judged.questions?.length) await askUser(p, judged.questions);
    cp.tasks = judged.gaps.map((g) => ({ ...g, depends_on: [], id: `${g.id}-r${round}` }));
    if (stuck.length) { // the same MUST failed twice: do not repeat the same attempt
      log(p, 'boss', `Kritéria ${stuck.join(', ')} neprošla dvakrát – měním přístup a posiluji model.`); decide(p, 'Změna přístupu', [`${stuck.join(', ')} selhalo ve dvou kolech po sobě.`]);
      cp.tasks = cp.tasks.map((t) => ({ ...t, ...escalate(route(p, t)), instructions: `${t.instructions}\n\nNOTE: criteria ${stuck.join(', ')} failed in two consecutive rounds. The previous approach does not work – read ${office}/reports/round-${round}.md and ${office}/handoffs/, find the ROOT cause and solve it differently. Do not repeat the earlier attempt.` }));
    }
    if (!cp.tasks.length) break;
  }

  // 6) finish: "done" only when every MUST is verified; otherwise an honest partial result with concrete gaps
  phase(p, 'finish');
  const verified = verifiedDone(judged);
  if (!verified) {
    writePartialFinal(p, judged ? 'došel počet kol a povinná kritéria nejsou všechna ověřená' : 'kontrola neproběhla'); learn(p); publishHtml(p);
    st.status = 'partial'; agent(p, 'boss', { status: 'idle', activity: 'rozpracováno' }); save(p);
    log(p, 'boss', `Rozpracováno – chybí: ${st.final.remaining.slice(0, 4).join('; ')}`); notify(p, 'Projekt rozpracovaný', st.final.remaining.slice(0, 3).join(' | ')); return;
  }
  // No model call for the final report: everything it needs is already verified and on disk.
  const leftovers = (judged.criteria || []).filter((c) => c.level !== 'MUST' && c.status !== 'PASS').map((c) => `${c.id} (${c.level}): ${c.evidence || 'nesplněno'}`);
  st.final = { summary: judged.summary, remaining: leftovers };
  try { fs.writeFileSync(path.join(office, 'FINAL.md'), finalMarkdown(p, judged)); } catch {}
  learn(p);
  st.status = 'done'; agent(p, 'boss', { status: 'done', activity: 'hotovo' }); publishHtml(p); save(p);
  log(p, 'boss', `Hotovo. ${judged.summary}`); notify(p, 'Projekt hotov', judged.summary);
}

// ---------- public API ----------
export function listProjects() {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  return fs.readdirSync(PROJECTS_DIR).map((d) => { try { const s = JSON.parse(read(path.join(PROJECTS_DIR, d, 'state.json'))); if (!live.has(s.id) && ['running', 'waiting_user'].includes(s.status)) s.status = 'interrupted'; return s.archived ? null : s; } catch { return null; } }).filter(Boolean).sort((a, b) => b.created.localeCompare(a.created));
}
export function listPresets() {
  return fs.readdirSync(path.join(ROOT, 'presets')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(read(path.join(ROOT, 'presets', f))));
}
export function routingChanged() { for (const L of live.values()) for (const entry of L.running.values()) entry.wakeRetry?.(); }
export function getLive(id) { return live.get(id)?.p.state || listProjects().find((s) => s.id === id); }

// ---------- repos: one repo = one office = one project ----------
const REPOS_FILE = path.join(DATA, 'repos.json');
let repos = null;
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const rid = (p) => crypto.createHash('sha1').update(p).digest('hex').slice(0, 8);
export function isGit(p) { try { execFileSync('git', ['-C', p, 'rev-parse', '--show-toplevel'], { stdio: 'ignore' }); return true; } catch { return false; } }
let repoTimer = null;
export function flushRepos() { if (repos) { clearTimeout(repoTimer); repoTimer = null; try { fs.writeFileSync(REPOS_FILE, JSON.stringify(repos, null, 2)); } catch {} } }
function saveRepos(now = false) { if (now) return flushRepos(); if (repoTimer) return; repoTimer = setTimeout(() => { repoTimer = null; try { fs.writeFileSync(REPOS_FILE, JSON.stringify(repos, null, 2)); } catch {} }, 1500); }
function readState(id) { if (live.has(id)) return live.get(id).p.state; try { const s = JSON.parse(read(path.join(PROJECTS_DIR, id, 'state.json'))); if (['running', 'waiting_user'].includes(s.status)) s.status = 'interrupted'; return s; } catch { return null; } }
function loadRepos() {
  if (repos) return repos;
  try { repos = JSON.parse(fs.readFileSync(REPOS_FILE, 'utf8')); return repos; } catch { repos = []; }
  // migration: per-project state -> per-repo. Newest project of a folder becomes the repo's office, older ones are archived.
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  const states = fs.readdirSync(PROJECTS_DIR).map((d) => { try { return { d, s: JSON.parse(read(path.join(PROJECTS_DIR, d, 'state.json'))) }; } catch { return null; } }).filter(Boolean).sort((a, b) => b.s.created.localeCompare(a.s.created));
  for (const { d, s } of states) {
    const abs = real(s.cwd); let r = repos.find((x) => x.path === abs);
    if (!r) { r = { id: rid(abs), path: abs, name: path.basename(abs), added: s.created, lastActive: s.created, projectId: s.id, git: isGit(abs) }; repos.push(r); s.archived = false; }
    else s.archived = true;
    s.repoId = r.id; s.repoName = r.name; s.history ||= [];
    fs.writeFileSync(path.join(PROJECTS_DIR, d, 'state.json'), JSON.stringify(s, null, 2));
  }
  try { fs.writeFileSync(REPOS_FILE, JSON.stringify(repos, null, 2)); } catch {}
  return repos;
}
function touchRepo(id) { const r = loadRepos().find((x) => x.id === id); if (r) { r.lastActive = now(); saveRepos(); } }
export function addRepo(p) {
  const abs = real(p);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new Error('Složka neexistuje.');
  loadRepos(); let r = repos.find((x) => x.path === abs);
  if (!r) { r = { id: rid(abs), path: abs, name: path.basename(abs), added: now(), lastActive: now(), projectId: null, git: isGit(abs) }; repos.push(r); saveRepos(true); }
  return r;
}
export function createOffice(name) {
  const title = String(name || '').trim();
  if (!title || title.length > 80 || /[\\/\x00-\x1f]/.test(title) || /^\.+$/.test(title)) throw new Error('Napiš název projektu (nejvýše 80 znaků, bez lomítek).');
  const root = process.env.AGENT_OFFICE_PROJECTS || path.join(DATA, 'workspaces'); fs.mkdirSync(root, { recursive: true }); // the Mac app sets ~/Agent Office
  const folder = path.join(root, title.replace(/[:]/g, '-'));
  if (fs.existsSync(folder)) throw new Error('Projekt s tímto názvem už existuje. Otevři jeho kancelář nebo zvol jiný název.');
  fs.mkdirSync(folder);
  try {
    execFileSync('git', ['-C', folder, 'init', '--initial-branch=main'], { stdio: 'ignore' });
    fs.writeFileSync(path.join(folder, 'README.md'), `# ${title}\n\nProjekt spravovaný vlastní kanceláří Agent Office.\n`);
    for (const dir of ['deliverables', 'references', '.agent-office']) fs.mkdirSync(path.join(folder, dir));
    fs.writeFileSync(path.join(folder, 'deliverables', '.gitkeep'), ''); fs.writeFileSync(path.join(folder, 'references', '.gitkeep'), '');
    fs.writeFileSync(path.join(folder, '.agent-office', 'project.json'), JSON.stringify({ version: 1, id: rid(real(folder)), name: title, created: now(), outputs: 'deliverables', sources: 'references' }, null, 2));
    execFileSync('git', ['-C', folder, 'add', 'README.md', 'deliverables', 'references', '.agent-office'], { stdio: 'ignore' });
    execFileSync('git', ['-C', folder, '-c', 'user.name=Agent Office', '-c', 'user.email=agent-office@localhost', 'commit', '-m', 'Založení projektu'], { stdio: 'ignore' });
  } catch (e) {
    // Only remove the new, isolated folder that this operation just created.
    fs.rmSync(folder, { recursive: true, force: true }); throw new Error(`Repozitář se nepodařilo založit: ${e.message}`);
  }
  const repo = addRepo(folder); repo.name = title; repo.managed = true; saveRepos(true);
  return repo;
}
export function updateOffice(id, changes) {
  const repo = loadRepos().find((r) => r.id === id); if (!repo) throw new Error('Projekt neexistuje.');
  const state = repo.projectId && readState(repo.projectId);
  if (changes.archived && state && ['running', 'waiting_user'].includes(state.status)) throw new Error('Nejdřív zastav práci na projektu.');
  if (changes.name !== undefined) { const name = String(changes.name).trim(); if (!name || name.length > 80) throw new Error('Název musí mít 1–80 znaků.'); repo.name = name; }
  if (changes.description !== undefined) repo.description = String(changes.description).trim().slice(0, 400);
  if (changes.archived !== undefined) repo.archived = !!changes.archived;
  saveRepos(true); return repo;
}
export function projectOverview(id) {
  const repo = loadRepos().find((r) => r.id === id); if (!repo) throw new Error('Projekt neexistuje.');
  const state = repo.projectId && readState(repo.projectId);
  const workingCopy = state?.git ? path.join(PROJECTS_DIR, state.id, 'work') : repo.path;
  return { id: repo.id, name: repo.name, description: repo.description || '', archived: !!repo.archived, repository: repo.path, workingCopy, outputs: path.join(workingCopy, 'deliverables'), office: state ? path.join(PROJECTS_DIR, state.id, 'office') : null, branch: state?.branch || 'main', goals: state?.history?.length || 0, tokens: state?.stats?.tokens || {} };
}
export function removeRepo(id) {
  loadRepos(); const r = repos.find((x) => x.id === id); if (!r) return false;
  const s = r.projectId && readState(r.projectId);
  if (s && ['running', 'waiting_user'].includes(s.status)) throw new Error('Kancelář právě pracuje – nejdřív ji zastav.');
  repos = repos.filter((x) => x.id !== id); try { fs.writeFileSync(REPOS_FILE, JSON.stringify(repos, null, 2)); } catch {} return true;
}
export function repoSummaries() {
  loadRepos();
  // Existing Claude Code workspaces appear as real offices without manual import.
  for (const session of claudeSnapshot().sessions) if (!repos.some((r) => r.path === session.path)) {
    const repo = addRepo(session.path); repo.lastActive = session.updated; repo.source = 'claude'; saveRepos();
  }
  return loadRepos().map((r) => {
    const s = r.projectId ? readState(r.projectId) : null;
    const waiting = s ? s.inbox.filter((i) => i.answer === null).length : 0;
    const external = guestSessions(r.id);
    const light = external.some((g) => g.active) && !s ? 'working' : waiting > 0 ? 'question' : !s ? 'idle' : s.status === 'limit' ? 'partial' : ['running'].includes(s.status) ? 'working' : s.status === 'done' ? 'done' : s.status === 'partial' ? 'partial' : ['error', 'budget'].includes(s.status) ? 'error' : 'idle';
    return { id: r.id, name: r.name, description: r.description || '', archived: !!r.archived, managed: !!r.managed, path: r.path, git: r.git, projectId: r.projectId, lastActive: r.lastActive, light, waiting, status: s?.status || null, goal: s?.goal || null, roles: r.roles || [], agentOverrides: r.agentOverrides || {}, sessions: external.length, source: r.source || 'local', completedTasks: s?.tasks?.filter((t) => t.status === 'done').length || 0, totalTasks: s?.tasks?.length || 0 };
  }).sort((a, b) => String(b.lastActive).localeCompare(String(a.lastActive)));
}
/** Folders you recently used Claude Code in (from ~/.claude/projects transcripts), minus repos already added. */
export function suggestRepos() {
  const have = new Set(loadRepos().map((r) => r.path));
  return [...new Map(claudeSnapshot().sessions.filter((s) => !have.has(s.path)).map((s) => [s.path, { path: s.path, name: path.basename(s.path), git: isGit(s.path), last: s.updated }])).values()].slice(0, 30);
}
/** Claude Code sessions currently working in this repo (read-only, from local transcripts). */
export function guestSessions(repoId) {
  const r = loadRepos().find((x) => x.id === repoId); if (!r) return [];
  const own = new Set(); const st = r.projectId && readState(r.projectId);
  if (st) { Object.values(st.agentSession || {}).forEach((x) => own.add(x)); if (st.bossSession) own.add(st.bossSession); (st.ownSessions || []).forEach((x) => own.add(x)); }
  return claudeSnapshot().sessions.filter((s) => s.path === r.path && !own.has(s.id)).slice(0, 30).map((s) => {
    const recent = s.recent.map((e) => e.kind === 'tool' ? { kind: 'tool', text: describeTool(e.tool, e.input).text } : e);
    return { ...s, recent, now: recent.at(-1)?.text || '' };
  });
}

export function setAgentOverride(repoId, name, change = {}) {
  const repo = loadRepos().find(r => r.id === repoId);
  if (!repo) throw new Error('Neznámý repozitář.');
  const st = repo.projectId && readState(repo.projectId);
  if (![...BASE_ROLES, ...(repo.roles || []).map(r => r.id), ...(st?.roles || []).map(r => r.id)].includes(name)) throw new Error('Neznámý agent.');
  const previous = repo.agentOverrides?.[name] || {};
  let model = change.model ?? previous.model ?? 'auto';
  const effort = change.effort ?? previous.effort ?? 'auto';
  if (typeof model !== 'string') throw new Error('Neznámý model.');
  model = normalizeModelId(model);
  if (MODELS.includes(model)) model = 'claude/' + model;
  if (model !== 'auto' && !/^(claude|codex|antigravity|gemini|ollama)\/[a-zA-Z0-9._:/-]{1,160}$/.test(model)) throw new Error('Neznámý model.');
  if (effort !== 'auto' && !EFFORTS.includes(effort)) throw new Error('Neznámá intenzita práce.');
  const value = { model, effort };
  (repo.agentOverrides ||= {})[name] = value;
  // Retire legacy hire-time manual settings when switching this agent back to auto.
  for (const role of [...(repo.roles || []), ...(st?.roles || [])]) if (role.id === name) { role.model = 'auto'; role.effort = 'auto'; }
  if (st) {
    (st.agentOverrides ||= {})[name] = value;
    const p = live.get(st.id)?.p || { state: st, dir: path.join(PROJECTS_DIR, st.id) };
    save(p);
  }
  flushRepos();
  if (st) for (const entry of live.get(st.id)?.running.values() || []) if (entry.agent === name) entry.wakeRetry?.();
  return value;
}

export function addManualRole(repoId, h) {
  { const r0 = loadRepos().find((r) => r.id === repoId); const L0 = r0?.projectId && live.get(r0.projectId); if (L0) bumpHuman(L0.p.state, 'roles'); }
  loadRepos(); const repo = repos.find((r) => r.id === repoId); if (!repo) throw new Error('Neznámý repozitář.');
  const title = String(h.title || '').trim();
  if (!title) throw new Error('Napiš název role.');
  if (h.model && h.model !== 'auto' && !MODELS.includes(h.model) && !/^(claude|codex|antigravity|gemini|ollama)\/[a-zA-Z0-9._:/-]{1,100}$/.test(h.model)) throw new Error('Neznámý model.');
  if (h.effort && h.effort !== 'auto' && !EFFORTS.includes(h.effort)) throw new Error('Neznámá intenzita práce.');
  const current = repo.projectId && readState(repo.projectId);
  const team = new Map([...(repo.roles || []), ...(current?.roles || [])].map((r) => [r.id, r]));
  const id = slug(h.id || title);
  if (BASE_ROLES.includes(id) || team.has(id)) throw new Error('Tahle role už v kanceláři je. Zvol jiný název.');
  const pseudo = { roles: [...team.values()] }; const character = h.character && CAST[h.character] ? h.character : pickCharacter(pseudo, `${title} ${h.responsibility || ''}`);
  const role = { id, title, responsibility: String(h.responsibility || '').trim(), character, name: h.name || displayName(pseudo, character), manual: true, model: h.model || 'auto', effort: h.effort || 'auto', tools: h.tools || ['read', 'write', 'web'] };
  const L = repo.projectId && live.get(repo.projectId);
  const st = L ? L.p.state : repo.projectId ? readState(repo.projectId) : null;
  if (st) {
    const p = L ? L.p : { state: st, dir: path.join(PROJECTS_DIR, st.id) };
    const id = hireRole(p, role, { manual: true }); if (role.name) st.roles.find((r) => r.id === id).name = role.name;
    (st.directives ||= []).push({ t: now(), text: `The user added a new team member: ${role.title} (${role.responsibility}). Use this role (id "${id}") in your plan where relevant.`, ack: false });
    save(p);
  }
  (repo.roles ||= []).push(role); flushRepos();
  return role;
}
export function castList() { return Object.entries(CAST).map(([key, name]) => ({ key, name, base: Object.values(BASE_CHAR).includes(key) })); }

function runPipeline(p, opts = {}) {
  const state = p.state;
  live.set(state.id, { p, children: new Set(), stopped: false, running: new Map(), lock: Promise.resolve() });
  save(p);
  pipeline(p, opts).catch((e) => {
    if (e.message === 'stopped') { state.limit = null; state.status = live.get(state.id)?.paused ? 'paused' : 'stopped'; if (state.status === 'paused') log(p, 'boss', 'Pozastaveno. Až budeš chtít, navážu přesně tady.'); }
    else if (e.budget) { if (p.ctx) writePartialFinal(p, 'vyčerpal se rozpočet běhů'); state.status = 'partial'; log(p, 'boss', 'Vyčerpán rozpočet běhů – vracím rozpracovaný výsledek se seznamem mezer.'); }
    else { if (p.ctx) writePartialFinal(p, `chyba: ${String(e.message).slice(0, 160)}`); state.status = 'error'; log(p, 'boss', `Chyba: ${e.message}`); }
    save(p); notify(p, `Projekt ${state.status}`, e.message);
  });
  return state;
}
export function startProject({ repoId, preset = 'general', goal, cwd, notes = '', settings = {} }) {
  if (!goal) throw new Error('Napiš cíl.');
  loadRepos();
  const repo = repoId ? repos.find((r) => r.id === repoId) : cwd ? addRepo(cwd) : null;
  if (!repo) throw new Error('Neznámý repozitář.');
  if (repo.archived) throw new Error('Projekt je v archivu. Nejdřív ho obnov.');
  const pr = JSON.parse(read(path.join(ROOT, 'presets', `${preset}.json`), 'null'));
  if (!pr) throw new Error('unknown preset');
  const old = repo.projectId ? readState(repo.projectId) : null;
  if (old && live.has(old.id) && ['running', 'waiting_user'].includes(old.status)) throw new Error('Tahle kancelář právě pracuje na cíli – počkej, nebo ji zastav.');
  if (old) { // same repo, new goal: continue the SAME office (taste, profile, boss memory, worktree, feed history)
    const dir = path.join(PROJECTS_DIR, old.id); const st = old;
    (st.history ||= []).push({ goal: st.goal, finished: now(), status: st.status, score: st.score, summary: st.final?.summary || '' });
    (st.history[st.history.length - 1]).human = st.human || null; (st.history[st.history.length - 1]).accepted = !!st.accepted;
    Object.assign(st, { goal, notes, preset, status: 'running', round: 0, score: null, final: null, tasks: [], inbox: [], assumptions: [], checkpoint: {}, human: { answers: 0, messages: 0, directives: 0, roles: 0 }, accepted: null, settings: { ...pr.defaults, ...settings }, stats: { runs: 0, cost: st.stats?.cost || 0, tokens: st.stats?.tokens || {} }, cwd: repo.path, repoId: repo.id, repoName: repo.name, archived: false });
    for (const k of Object.keys(st.agents)) st.agents[k] = { ...st.agents[k], status: 'idle', activity: '' };
    st.agents.boss = { ...st.agents.boss, status: 'working', activity: 'start' };
    const p = { state: st, dir, feeds: (() => { try { return JSON.parse(read(path.join(dir, 'feeds.json'), '{}')); } catch { return {}; } })() };
    feedPush(p, 'boss', { kind: 'sys', text: `Nový cíl: ${goal}` });
    st.agentOverrides = repo.agentOverrides || st.agentOverrides || {};
    for (const mr of repo.roles || []) if (!(st.roles || []).some((r) => r.id === mr.id)) { const id = hireRole(p, mr, { manual: true }); if (mr.name) st.roles.find((r) => r.id === id).name = mr.name; }
    return runPipeline(p);
  }
  const id = `${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '')}-${crypto.randomBytes(2).toString('hex')}`;
  const dir = path.join(PROJECTS_DIR, id); fs.mkdirSync(dir, { recursive: true });
  const state = { id, repoId: repo.id, repoName: repo.name, created: now(), preset, goal, notes, cwd: repo.path, status: 'running', round: 0, score: null, settings: { ...pr.defaults, ...settings }, agentOverrides: repo.agentOverrides || {}, agents: { boss: { status: 'working', activity: 'start' } }, directives: [], agentSession: {}, ownSessions: [], history: [], roles: [], tasks: [], inbox: [], log: [], assumptions: [], stats: { runs: 0, cost: 0 } };
  repo.projectId = id; repo.lastActive = now(); try { fs.writeFileSync(REPOS_FILE, JSON.stringify(repos, null, 2)); } catch {}
  const np = { state, dir };
  for (const mr of repo.roles || []) { const rid2 = hireRole(np, mr, { manual: true }); if (mr.name) state.roles.find((r) => r.id === rid2).name = mr.name; }
  return runPipeline(np);
}
/** Continue after an error / stop / partial result from the last verified checkpoint. */
export function resumeProject(id, { extraRuns = 0, extraRounds = 0 } = {}) {
  if (live.has(id) && ['running', 'waiting_user'].includes(live.get(id).p.state.status)) throw new Error('Projekt právě běží.');
  const st = readState(id); if (!st) throw new Error('Projekt neexistuje.');
  if (!['error', 'stopped', 'paused', 'partial', 'budget', 'interrupted', 'limit'].includes(st.status)) throw new Error('Pokračovat jde jen u nedokončeného projektu.');
  st.limit = null;
  const dir = path.join(PROJECTS_DIR, id);
  st.status = 'running'; st.final = null;
  st.settings.maxRuns = (st.settings.maxRuns || 40) + (extraRuns || Math.ceil((st.settings.maxRuns || 40) / 2));
  if (st.checkpoint && (st.checkpoint.round || 0) >= st.settings.maxRounds) st.settings.maxRounds = st.checkpoint.round + (extraRounds || 1);
  for (const k of Object.keys(st.agents || {})) st.agents[k] = { ...st.agents[k], status: 'idle', activity: '' };
  const p = { state: st, dir, feeds: (() => { try { return JSON.parse(read(path.join(dir, 'feeds.json'), '{}')); } catch { return {}; } })() };
  feedPush(p, 'boss', { kind: 'sys', text: 'Pokračuji od posledního ověřeného stavu.' });
  return runPipeline(p, { resume: true });
}
/** One office = one working folder = one Codex project + one named Claude Code session. Opening never costs a model call. */
export function officeWorkDir(repoId) {
  const repo = loadRepos().find((r) => r.id === repoId); if (!repo) throw new Error('Projekt neexistuje.');
  const st = repo.projectId ? readState(repo.projectId) : null;
  const dir = st?.workDir && fs.existsSync(st.workDir) ? st.workDir : repo.path;
  return { repo, st, dir };
}
export function openOfficeIn(repoId, app) {
  const { repo, st, dir } = officeWorkDir(repoId);
  const q = (x) => `'${String(x).replaceAll("'", "'\\''")}'`;
  if (app === 'codex') {
    import('./providers.mjs').then(({ locate, cleanEnv }) => { const bin = locate('codex'); if (!bin) return; const c = spawn(bin, ['app', dir], { env: cleanEnv(), detached: true, stdio: 'ignore' }); c.on('error', () => {}); c.unref(); });
    return { ok: true, dir };
  }
  if (app === 'claude') {
    const bin = findBin('claude'); if (!bin) throw new Error('Claude CLI chybí.');
    const canResume = st?.bossSession && st.bossCwd === dir && fs.existsSync(path.join(os.homedir(), '.claude', 'projects', dir.replace(/[^a-zA-Z0-9]/g, '-'), `${st.bossSession}.jsonl`));
    const cmd = `cd ${q(dir)} && ${q(bin)} ${canResume ? `--resume ${st.bossSession}` : `--name ${q(`${repo.name} · Šéf`)}`}`;
    execFile('osascript', ['-e', 'tell application "Terminal"', '-e', 'activate', '-e', `do script ${JSON.stringify(cmd)}`, '-e', 'end tell'], () => {});
    return { ok: true, dir, resumed: !!canResume };
  }
  throw new Error('Neznámá aplikace.');
}
/** After a server restart: projects that were mid-flight continue by themselves from their last verified state.
 *  Each run starts with a clean context and reads its state from the office files, so a crash stops nothing.
 *  A project that keeps dying is left alone after 3 automatic restarts within an hour. */
export function autoResume() {
  const resumed = [];
  for (const r of loadRepos()) {
    if (!r.projectId || r.archived || live.has(r.projectId)) continue;
    let raw; try { raw = JSON.parse(read(path.join(PROJECTS_DIR, r.projectId, 'state.json'))); } catch { continue; }
    if (raw.status === 'limit') { scheduleLimitResume(r.projectId, raw.limit?.until || Date.now()); resumed.push(r.name + ' (po limitu)'); continue; } // waits for the reset, not 3 failed attempts
    if (raw.status !== 'running') continue; // waiting_user, stopped, paused, error, partial: the user decides
    const recent = (raw.autoResumes || []).filter((t) => Date.now() - Date.parse(t) < 3600e3);
    if (recent.length >= 3) { raw.status = 'error'; (raw.log ||= []).push({ t: now(), who: 'boss', msg: 'Projekt se třikrát za hodinu přerušil – nepokračuji automaticky. Použij „Pokračovat“.' }); fs.writeFileSync(path.join(PROJECTS_DIR, r.projectId, 'state.json'), JSON.stringify(raw, null, 2)); continue; }
    raw.autoResumes = [...recent, now()]; raw.status = 'interrupted';
    fs.writeFileSync(path.join(PROJECTS_DIR, r.projectId, 'state.json'), JSON.stringify(raw, null, 2));
    try { const st = resumeProject(r.projectId, { extraRuns: 1 }); log(live.get(st.id).p, 'boss', 'Aplikace se restartovala – pokračuji sám od posledního ověřeného stavu.'); resumed.push(r.name); } catch {}
  }
  return resumed;
}
const limitTimers = new Map();
function scheduleLimitResume(id, until) {
  clearTimeout(limitTimers.get(id));
  const t = setTimeout(() => { limitTimers.delete(id); if (live.has(id)) return; try { clearBlocked(); resumeProject(id, { extraRuns: 1 }); } catch {} }, Math.max(1000, until - Date.now() + 30000));
  t.unref?.(); limitTimers.set(id, t);
}
export function stopAll() { for (const L of live.values()) { L.stopped = true; for (const entry of L.running.values()) entry.wakeRetry?.(); for (const c of L.children) try { c.kill(); } catch {} } }
/** Pause = stop the running agents now, keep everything; "Pokračovat" resumes from the last verified state. */
export function pauseProject(id) { const L = live.get(id); if (!L) return false; L.paused = true; return stopProject(id); }
export function stopProject(id) {
  const L = live.get(id); if (!L) return false;
  L.stopped = true; for (const entry of L.running.values()) entry.wakeRetry?.(); for (const c of L.children) c.kill();
  return true;
}
