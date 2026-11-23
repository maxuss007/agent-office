import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { claudeUsage } from './claude-usage.mjs';
import { providerEnv, claudeToken } from './provider-auth.mjs';
import { runLocal } from './local-runner.mjs';
const exec = promisify(execFile);
const home = os.homedir();
const dataDir = () => process.env.AGENT_OFFICE_HOME || path.dirname(new URL(import.meta.url).pathname);
const stateFile = () => path.join(dataDir(), 'provider-state.json');
let cached, pending;
const metric = () => { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; } };
export function locate(name) {
  const explicit = process.env[`${name.toUpperCase()}_BIN`];
  const files = [explicit, ...[path.join(process.env.AGENT_OFFICE_HOME || path.join(home, 'Library/Application Support/Agent Office'), 'runtime/node/bin'), `${home}/.local/bin`, '/opt/homebrew/bin', '/usr/local/bin', ...(process.env.PATH || '').split(':')].filter(Boolean).map((d) => path.join(d, name))];
  if (name === 'codex') files.push('/Applications/Codex.app/Contents/Resources/codex', '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex');
  return files.find((f) => { try { fs.accessSync(f, fs.constants.X_OK); return fs.statSync(f).isFile(); } catch { return false; } }) || null;
}
export const cleanEnv = providerEnv;
export function launchLogin(provider, mode) {
  if (!['claude', 'codex', 'antigravity', 'gemini'].includes(provider)) throw new Error('Neznámá služba.');
  const bin = locate(provider === 'antigravity' ? 'agy' : provider); if (!bin) throw new Error('Příkaz služby není nainstalovaný.');
  // Antigravity CLI (agy) signs in on its first interactive start: browser OAuth, token kept in the Keychain.
  if (provider === 'antigravity') { const all = metric(); if (all.antigravity?.authFailed) { all.antigravity = { ...all.antigravity, authFailed: 0 }; fs.writeFileSync(stateFile(), JSON.stringify(all, null, 2)); cached = null; } }
  const command = `'${bin.replaceAll("'", "'\\''")}'${provider === 'claude' ? (mode === 'token' ? ' setup-token' : ' auth login') : provider === 'codex' ? ' login' : ''}`;
  execFile('osascript', ['-e', 'tell application "Terminal"', '-e', 'activate', '-e', `do script ${JSON.stringify(command)}`, '-e', 'end tell'], () => {}); return true;
}
export function remaining(windows) {
  const valid = (windows || []).filter((w) => Number.isFinite(w.usedPercent) && (!w.resetsAt || w.resetsAt * 1000 > Date.now()));
  return valid.length ? Math.max(0, Math.min(...valid.map((w) => 100 - w.usedPercent))) : null;
}
export function recordLimit(provider, event) {
  const all = metric(), info = event.rate_limit_info || event.rateLimits || event;
  const windows = [];
  for (const [key, value] of Object.entries(info)) if (value && typeof value === 'object') {
    const used = value.usedPercent ?? value.used_percentage ?? (Number.isFinite(value.utilization) ? value.utilization * 100 : null);
    if (Number.isFinite(used)) windows.push({ name: key, usedPercent: Math.min(100, Math.max(0, used)), resetsAt: value.resetsAt || value.resets_at || null });
  }
  const used = info.usedPercent ?? (Number.isFinite(info.utilization) ? info.utilization * 100 : null);
  if (Number.isFinite(used)) windows.push({ name: info.rateLimitType || 'limit', usedPercent: used, resetsAt: info.resetsAt || null });
  all[provider] = { ...(all[provider] || {}), ...(windows.length ? { windows } : {}), updated: new Date().toISOString() };
  if (info.status === 'rejected') all[provider].blockedUntil = (info.resetsAt || Date.now() / 1000 + 900) * 1000;
  try { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(all, null, 2)); } catch {}
  cached = null;
}
export function clearBlocked() { const all = metric(); for (const k of Object.keys(all)) if (all[k]?.blockedUntil) all[k] = { ...all[k], blockedUntil: 0 }; fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(all, null, 2)); cached = null; }
export function markUnavailable(provider, seconds = 900) { const all = metric(); all[provider] = { ...(all[provider] || {}), blockedUntil: Math.max(all[provider]?.blockedUntil || 0, Date.now() + seconds * 1000) }; fs.writeFileSync(stateFile(), JSON.stringify(all, null, 2)); cached = null; }

export const routingPreference = () => metric().routing || { model: 'auto' };
export const ultrareviewPref = () => metric().ultrareviewPref || 'ask';
export function updateRouting({ model, pauseProvider, pauseUntil, fast, ultrareview } = {}) {
  if (ultrareview !== undefined) { if (!['ask', 'auto', 'off'].includes(ultrareview)) throw new Error('Neplatná volba ultrareview.'); const all = metric(); all.ultrareviewPref = ultrareview; fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(all, null, 2)); cached = null; if (model === undefined && pauseProvider === undefined && fast === undefined) return; }
  if (fast !== undefined) { if (!['auto', 'off', 'always'].includes(fast)) throw new Error('Neplatná volba fast mode.'); const all = metric(); all.fastPref = fast; fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(all, null, 2)); cached = null; if (model === undefined && pauseProvider === undefined) return; }
  const all = metric();
  all.routing ||= { model: 'auto' };
  if (model !== undefined) {
    if (typeof model !== 'string' || !/^(auto|claude|codex|antigravity|gemini|ollama)(\/[^\s]{1,160})?$/.test(model)) throw new Error('Neplatná volba modelu.');
    all.routing.model = model;
  }
  if (pauseProvider !== undefined) {
    if (!['claude', 'codex', 'ollama'].includes(pauseProvider) || !Number.isFinite(pauseUntil) || pauseUntil < 0) throw new Error('Neplatné pozastavení služby.');
    all[pauseProvider] = { ...(all[pauseProvider] || {}), pausedUntil: pauseUntil };
  }
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify(all, null, 2)); cached = null;
  return all.routing;
}

// ---------- Claude: models and features straight from the installed CLI ----------
let claudeCli = { key: '', models: [], ultrareview: false };
const CLAUDE_TIER = { fable: 'frontier', opus: 'deep', sonnet: 'balanced', haiku: 'fast' };
export function claudeCapabilities(bin = locate('claude')) {
  if (!bin) return { models: [], ultrareview: false };
  let key = bin; try { key += fs.statSync(fs.realpathSync(bin)).mtimeMs; } catch {}
  if (claudeCli.key === key) return claudeCli;
  let help = ''; try { help = execFileSync(bin, ['--help'], { encoding: 'utf8', timeout: 8000, env: cleanEnv('claude') }); } catch {}
  const modelHelp = (help.match(/--model <model>[\s\S]*?(?=\n\s{2}--)/) || [''])[0];
  const aliases = [...new Set([...modelHelp.matchAll(/'([a-z][a-z0-9.-]*)'/g)].map((m) => m[1]).concat(['opus', 'sonnet', 'haiku']))];
  claudeCli = { key, models: aliases, ultrareview: /\bultrareview\b/.test(help) };
  return claudeCli;
}
export function recordFeature(name, value) { const all = metric(); all.features = { ...(all.features || {}), [name]: { ...value, at: Date.now() } }; fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(all, null, 2)); cached = null; }

export async function codexInfo(bin = locate('codex')) {
  if (!bin) return { available: false, message: 'Codex není nainstalovaný.', models: [], windows: [] };
  const child = spawn(bin, ['app-server', '--stdio', '-c', 'analytics.enabled=false'], { env: cleanEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
  let next = 1, buffer = '', ended = false, stderr = ''; const calls = new Map();
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    if (ended) return reject(new Error('Codex app-server je ukončený.'));
    const id = next++, timer = setTimeout(() => { calls.delete(id); reject(new Error('Codex neodpověděl včas.')); }, 10000);
    calls.set(id, { resolve, reject, timer }); child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
  const fail = e => { ended = true; for (const c of calls.values()) { clearTimeout(c.timer); c.reject(e); } calls.clear(); };
  child.on('error', () => fail(new Error('Codex app-server nelze spustit.')));
  child.stdin.on('error', () => fail(new Error('Spojení s Codex app-server se uzavřelo.')));
  child.on('close', () => fail(new Error(/Operation not permitted|Permission denied/i.test(stderr) ? 'Codex nemá oprávnění ke spuštění nebo svému datovému adresáři.' : 'Codex app-server se ukončil před odpovědí.')));
  child.stdout.on('data', (chunk) => {
    buffer += chunk; let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i); buffer = buffer.slice(i + 1); let msg; try { msg = JSON.parse(line); } catch { continue; }
      const c = calls.get(msg.id); if (c) { clearTimeout(c.timer); calls.delete(msg.id); msg.error ? c.reject(new Error(msg.error.message)) : c.resolve(msg.result); }
    }
  });
  try {
    await request('initialize', { clientInfo: { name: 'agent_office', title: 'Agent Office', version: '2.0.0' } });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    const [account, limits, models] = await Promise.allSettled([request('account/read', { refreshToken: false }), request('account/rateLimits/read'), request('model/list', { limit: 100, includeHidden: false })]);
    const a = account.status === 'fulfilled' ? account.value : null;
    const l = limits.status === 'fulfilled' ? limits.value.rateLimits : null;
    const windows = l ? ['primary', 'secondary'].filter((k) => l[k]).map((k) => ({ name: k, ...l[k] })) : [];
    return { available: !!a?.account && models.status === 'fulfilled', message: a?.account ? '' : 'Přihlas Codex přes ChatGPT.', models: models.status === 'fulfilled' ? models.value.data || [] : [], windows, source: windows.length ? 'account/rateLimits/read' : 'unknown', updated: new Date().toISOString() };
  } catch (e) { return { available: false, message: e.message, models: [], windows: [] }; }
  finally { for (const c of calls.values()) { clearTimeout(c.timer); c.reject(new Error('Connection closed')); } calls.clear(); child.stdin.end(); child.kill('SIGTERM'); }
}
/** Google Antigravity CLI `agy` (optional). It signs in once interactively and keeps the token in the Keychain,
 *  so a headless run is the only reliable check; until then it counts as connected once installed. */
export const ANTIGRAVITY_MODELS = [{ model: 'auto', name: 'Antigravity (výchozí model)', tier: 'balanced' }];
export function antigravityInfo(bin = locate('agy')) {
  if (!bin) return { available: false, installed: false, message: 'Antigravity CLI (agy) není nainstalované (volitelné).', windows: [] };
  const failed = metric().antigravity?.authFailed;
  return { available: !failed, installed: true, message: failed ? 'Antigravity není přihlášené. Spusť ho jednou v Terminálu (Připojit znovu) a přihlas se účtem Google.' : 'Šéf mu sám dává programování, u agenta ho můžeš vybrat i ručně.', windows: [], source: 'unknown', updated: new Date().toISOString() };
}
/** Gemini CLI `gemini` (optional): Google account sign-in (~/.gemini/oauth_creds.json) or GEMINI_API_KEY. Good for study and research. */
export const GEMINI_MODELS = [{ model: 'auto', name: 'Gemini (výchozí model)', tier: 'balanced' }];
export function geminiInfo(bin = locate('gemini')) {
  if (!bin) return { available: false, installed: false, message: 'Gemini CLI není nainstalované (volitelné).', windows: [] };
  const signedIn = fs.existsSync(path.join(home, '.gemini', 'oauth_creds.json')) || !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_API_KEY;
  return { available: signedIn, installed: true, message: signedIn ? 'Šéf mu sám dává studium a rešerše, u agenta ho můžeš vybrat i ručně.' : 'Gemini není přihlášené. Klikni na Připojit znovu a přihlas se účtem Google.', windows: [], source: 'unknown', updated: new Date().toISOString() };
}
export async function providerCatalog(force = false) {
  if (!force && cached && Date.now() - cached.time < 60000) return cached.value;
  if (pending) { if (!force) return pending; await pending.catch(() => {}); }   // a forced refresh must not get an older, still-running check
  if (pending) return pending;
  pending = (async () => {
    let history = metric();const claude = locate('claude');
    const [claudeAuth, codex, local, usage] = await Promise.allSettled([
      claude ? exec(claude, ['auth', 'status'], { env: cleanEnv('claude'), timeout: 8000 }).then(({ stdout }) => JSON.parse(stdout).loggedIn) : Promise.resolve(false),
      codexInfo(),
      Promise.reject(new Error('Ollama vypnutá')), // local models removed on purpose: too weak for this work
      claudeUsage(claude, force),
    ]);
    history = metric();
    const c = codex.status === 'fulfilled' ? codex.value : { available: false, models: [], windows: [], message: 'Codex není dostupný.' };
    const u = usage.status === 'fulfilled' ? usage.value : { windows: [], source: 'unknown', message: 'Usage Claude nyní není dostupné.' };
    if (u.windows.length && !u.stale) { const current = metric(); current.claude = { ...current.claude, windows: u.windows, updated: u.updated }; fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(current, null, 2)); }
    const claudeWindows = u.windows.length ? u.windows : history.claude?.windows || [];
    // A block saved after a glitch must not outlive fresh numbers that show capacity left.
    const fresh = { claude: u.windows.length && !u.stale ? u.windows : null, codex: c.windows?.length ? c.windows : null };
    const healed = Object.entries(fresh).filter(([id, w]) => w && (history[id]?.blockedUntil || 0) > Date.now() && w.every((x) => !Number.isFinite(x.usedPercent) || x.usedPercent < 99)).map(([id]) => id);
    if (healed.length) { const current = metric(); for (const id of healed) current[id] = { ...current[id], blockedUntil: 0 }; fs.writeFileSync(stateFile(), JSON.stringify(current, null, 2)); history = current; }
    const providers = [
      { id: 'claude', name: 'Claude', available: claudeAuth.status === 'fulfilled' && !!claudeAuth.value, windows: claudeWindows, source: u.windows.length ? u.source : claudeWindows.length ? 'rate_limit_event' : 'unknown', updated: u.updated || history.claude?.updated || null, stale: !!u.stale, auth: claudeToken() ? 'oauth-token' : 'cli-login', message: !claude ? 'Claude CLI chybí.' : claudeAuth.status !== 'fulfilled' || !claudeAuth.value ? 'Claude není přihlášený. Přihlas účet nebo ulož dlouhodobý token.' : claudeToken() ? 'OAuth token nastavený; platnost ověří první úkol. ' + (u.message || '') : u.message },
      { id: 'codex', name: 'Codex', ...c },
      { id: 'antigravity', name: 'Antigravity', ...antigravityInfo() },
      { id: 'gemini', name: 'Gemini', ...geminiInfo() },
    ].map((p) => ({ ...p, pausedUntil: history[p.id]?.pausedUntil || null, blocked: Math.max(history[p.id]?.blockedUntil || 0, history[p.id]?.pausedUntil || 0) > Date.now() || remaining(p.windows.filter(w => !/^seven_day_/.test(w.name))) === 0, remainingPercent: remaining(p.windows.filter(w => !/^seven_day_/.test(w.name))) }));
    const models = [
      ...claudeCapabilities(claude).models.map((model) => ({ id: `claude/${model}`, provider: 'claude', model, name: `Claude ${model[0].toUpperCase() + model.slice(1)}`, tier: CLAUDE_TIER[model] || 'deep', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] })),
      ...(providers.find((p) => p.id === 'gemini')?.installed ? GEMINI_MODELS.map((m) => ({ id: `gemini/${m.model}`, provider: 'gemini', model: m.model, name: m.name, tier: m.tier, efforts: ['medium'] })) : []),
      ...(providers.find((p) => p.id === 'antigravity')?.installed ? ANTIGRAVITY_MODELS.map((m) => ({ id: `antigravity/${m.model}`, provider: 'antigravity', model: m.model, name: m.name, tier: m.tier, efforts: ['low', 'medium', 'high', 'xhigh', 'max'] })) : []),
      ...c.models.map((m) => ({ id: `codex/${m.model}`, provider: 'codex', model: m.model, name: m.displayName || m.model, default: m.isDefault, efforts: m.supportedReasoningEfforts?.map((e) => e.reasoningEffort), tier: /luna|mini|nano/i.test(m.model) ? 'fast' : /astra|opus|pro/i.test(m.model) ? 'deep' : 'balanced' })),
    ].map((m) => {
      const p = providers.find(p => p.id === m.provider);
      const windows = p.windows.filter(w => !/^seven_day_/.test(w.name) || m.provider === 'claude' && w.name === 'seven_day_' + m.model);
      const left = remaining(windows);
      return { ...m, remainingPercent: left, available: p.available && !p.blocked && left !== 0 };
    });
    const feats = history.features || {}; const caps = claudeCapabilities(claude);
    const features = {
      fast: { available: feats.fast ? feats.fast.available : null, reason: feats.fast?.reason || '', pref: history.fastPref || 'auto', label: 'Claude fast mode' },
      ultrareview: { available: !!caps.ultrareview && providers[0].available, pref: history.ultrareviewPref || 'ask', label: 'Claude ultrareview (cloudová multi-agentní kontrola kódu, účtuje se zvlášť)' },
      codexEfforts: [...new Set(models.filter((m) => m.provider === 'codex').flatMap((m) => m.efforts || []))],
    };
    const value = { routing: history.routing || { model: 'auto' }, providers, models, features, updated: new Date().toISOString(), note: 'Procenta jsou limity služby, nikoli počet zbývajících tokenů. Neznámý limit se neodhaduje.' };
    cached = { time: Date.now(), value }; return value;
  })().finally(() => { pending = null; }); return pending;
}

export function normalizeModelId(model) { return model.replace(/^(claude|codex|antigravity|gemini|ollama):/, '$1/'); }

export function chooseRoute(catalog, request) {
  const choice = catalog.routing?.model || 'auto';
  const override = choice !== 'auto' && !request.agentOverride && !request.pinned;
  if (override) request = { ...request, provider: choice.split('/')[0], model: choice.includes('/') ? choice : 'auto', pinned: choice.includes('/') };
  const pinned = request.pinned;
  const requested = normalizeModelId(request.model || ''), provider = requested.includes('/') ? requested.split('/')[0] : request.provider || 'auto';
  const nativeModel = requested.includes('/') ? requested.slice(requested.indexOf('/') + 1) : requested;
  const needsExternalTools = request.role === 'tester' || /browser|prohlížeč|verification|ověř|run tests|spusť test|výzkum|research/i.test(request.task || '');
  let candidates = catalog.models.filter((m) => m.available && (!m.manual || pinned || override) && !request.exclude?.includes(m.provider) && !request.excludeModels?.includes(m.id) && (pinned || !needsExternalTools || m.provider !== 'ollama'));
  if (request.role === 'boss' && !override && !pinned) candidates = candidates.filter(m => m.provider === 'claude' ? ['opus', 'fable'].includes(m.model) : m.provider === 'codex' && m.tier !== 'fast');
  if (override) candidates = candidates.filter((m) => m.provider === provider);
  if (pinned && requested !== 'auto') candidates = candidates.filter((m) => (provider === 'auto' || m.provider === provider) && m.model === nativeModel);
  if (!candidates.length) throw new Error(pinned || override ? 'Vybraný model není dostupný nebo vyčerpal limit.' : 'Žádný model není dostupný. Přihlas Claude nebo Codex v okně Připojení.');
  const task = `${request.role || ''} ${request.task || ''}`, coding = /code|coding|program|implement|debug|test|kód|oprav|designér/i.test(task), simple = /summary|shrnutí|rename|mechanic|format|přepi|classif/i.test(task) || request.effort === 'low';
  const research = /výzkum|research|rešerš|studi|study|vysvětl|explain|learn|nauč|zdroj|source|srovn|compare|analý|analys/i.test(task);
  const serious = request.role === 'boss' || /legal|práv|financ|security|architec/i.test(task);
  const rank = (m) => {
    const p = catalog.providers.find((p) => p.id === m.provider), left = m.remainingPercent ?? p.remainingPercent;
    let score = m.provider === 'ollama' ? simple && !serious ? 112 : serious ? 30 : 55 : 75;
    if (request.role === 'boss') {
      if (m.provider === 'claude' && ['opus', 'fable'].includes(m.model)) score += m.model === 'fable' ? 34 : 30;
      if (m.provider === 'codex' && (m.default || m.tier === 'deep')) score += m.default ? 30 : 20;
      if (m.tier === 'fast' || m.provider === 'claude' && !['opus', 'fable'].includes(m.model)) score -= 50;
      if (left === null && m.provider !== 'ollama') score -= 25;
    }
    if (m.provider === 'codex' && coding) score += 14;
    // Google subscriptions join the rotation when they are signed in: Gemini for study and research,
    // Antigravity for code. Elsewhere they rank a little below Claude and Codex.
    if (m.provider === 'gemini') score += research ? 24 : -6;
    if (m.provider === 'antigravity') score += coding ? 10 : -6;
    if (m.provider === 'claude' && !coding) score += 8;
    if (serious && (m.tier === 'deep' || m.tier === 'frontier')) score += m.tier === 'frontier' ? 18 : 15;
    if (!serious && m.tier === 'frontier') score -= 10; // the strongest model is kept for judgement, not routine work
    if (left !== null) score += Math.round(left / 20); // spread work over whichever subscription has the most room
    if (m.default) score += 8;
    if (m.model === nativeModel) score += 8;
    if (provider !== 'auto' && m.provider === provider) score += 12;
    if (simple && m.tier === 'fast') score += 8;
    if (left !== null) score += left > 50 ? 5 : left < 10 ? -40 : left < 25 ? -15 : 0;
    if (m.provider === 'ollama' && !/^qwen3\.5|^llama/i.test(m.model)) score -= 12;
    return score;
  };
  if (request.role === 'boss' && !override && !pinned) {
    // Boss: the strongest Claude model with room (Fable has its own weekly pool, then Opus); Codex's deep model when Claude is low.
    const room = (m) => m ? (m.remainingPercent ?? catalog.providers.find(p => p.id === m.provider)?.remainingPercent) : null;
    const fable = candidates.find(m => m.id === 'claude/fable'), opus = candidates.find(m => m.id === 'claude/opus');
    const codex = candidates.filter(m => m.provider === 'codex');
    const ok = (m) => m && (room(m) == null || room(m) > 20);
    if (ok(fable)) candidates = [fable];
    else if (ok(opus)) candidates = [opus];
    else if (codex.length) { const deep = codex.filter(m => m.tier === 'deep' || m.default); candidates = deep.length ? deep : codex; }
    else candidates = [fable, opus].filter(Boolean).length ? [fable, opus].filter(Boolean) : candidates;
  }
  candidates.sort((a, b) => rank(b) - rank(a)); const selected = candidates[0];
  const p = catalog.providers.find((p) => p.id === selected.provider);
  const desiredEffort = request.role === 'boss' && !request.effortOverride ? 'high' : request.effort;
  // 'ultra' (Codex: maximum reasoning with automatic delegation) only where the model supports it; Claude tops out at 'max'.
  const want = desiredEffort === 'ultra' && !selected.efforts?.includes('ultra') ? 'max' : desiredEffort;
  const effort = selected.efforts?.includes(want) ? want : selected.efforts?.includes('medium') ? 'medium' : selected.efforts?.[0] || want || 'medium';
  // fast mode: only for Claude Opus/Fable, only where the account allows it (it bills extra usage), and only for latency-sensitive calls
  const fast = selected.provider === 'claude' && ['opus', 'fable'].includes(selected.model) && catalog.features?.fast?.available !== false && (catalog.features?.fast?.pref === 'always' || (catalog.features?.fast?.pref !== 'off' && !!request.fast));
  return { ...selected, effort, fast, reason: `${coding ? 'Kód a ověřování' : simple ? 'Krátký rutinní úkol' : serious ? 'Plánování a úsudek' : 'Obsah a analýza'} · ${p.source === 'local' ? 'místní model bez předplatného' : p.remainingPercent === null ? 'limit služby není známý' : `zbývá ${Math.round(p.remainingPercent)} % limitu`} · ${pinned || override ? 'ruční volba' : 'automatický výběr'}` };
}

export function strictSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const s = { ...schema };
  if (s.properties) { s.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, strictSchema(v)])); s.required = Object.keys(s.properties); s.additionalProperties = false; }
  if (s.items) s.items = strictSchema(s.items); return s;
}
export function parseResult(text) {
  try { return JSON.parse(text); } catch { const match = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (match) return JSON.parse(match[1]); throw new Error('Model nevrátil požadovaný JSON výsledek.'); }
}
/** Codex reads ~/.agents/skills; expose every skill from ~/.claude/skills there too (symlinks, never deletes or overwrites). */
export function syncSkillsForCodex() {
  const from = path.join(os.homedir(), '.claude', 'skills'), to = path.join(os.homedir(), '.agents', 'skills'); let added = 0;
  try {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      const src = path.join(from, name), dst = path.join(to, name);
      if (!fs.existsSync(path.join(src, 'SKILL.md')) || fs.existsSync(dst)) continue;
      try { fs.symlinkSync(src, dst, 'dir'); added++; } catch {}
    }
  } catch {}
  return added;
}
export async function runCodex(p, o, { entry, onEvent, onChild }) {
  if (o.provider === 'antigravity') return runAntigravity(p, o, { entry, onEvent, onChild });
  if (o.provider === 'gemini') return runGemini(p, o, { entry, onEvent, onChild });
  syncSkillsForCodex();
  if (o.provider === 'ollama') return runLocal(p, o, { entry, onEvent, onChild });
  const bin = locate('codex'); if (!bin) throw new Error('Codex CLI chybí.');
  const dir = path.join(p.dir, '.runtime'); fs.mkdirSync(dir, { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`, schema = path.join(dir, `${id}.schema.json`), resultFile = path.join(dir, `${id}.result.json`);
  fs.writeFileSync(schema, JSON.stringify(strictSchema(o.schema)));
  const args = ['--no-daemon', 'exec', ...(o.agent && o.agent !== 'boss' ? ['--ephemeral'] : []), '--json', '--color', 'never', '--skip-git-repo-check', '--sandbox', o.bash || o.tools?.includes('Write') ? 'workspace-write' : 'read-only', '-C', o.cwd, '--output-schema', schema, '-o', resultFile];
  if (o.provider === 'ollama') args.push('--oss', '--local-provider', 'ollama', '-c', 'model_context_window=65536');
  args.push('--model', o.model);
  if (o.provider === 'codex') args.push('-c', `model_reasoning_effort=${JSON.stringify(o.effort)}`);
  for (const d of o.addDirs || []) args.push('--add-dir', d);
  if (o.mcp && o.provider === 'codex') { // same Mac tools as Claude agents; the server asks the user before acting
    const toml = (v) => Array.isArray(v) ? `[${v.map(toml).join(',')}]` : typeof v === 'object' ? `{${Object.entries(v).map(([k, x]) => `${k}=${toml(x)}`).join(',')}}` : JSON.stringify(String(v));
    args.push('-c', `mcp_servers.mac.command=${toml(o.mcp.command)}`, '-c', `mcp_servers.mac.args=${toml(o.mcp.args)}`, '-c', `mcp_servers.mac.env=${toml(o.mcp.env)}`);
  }
  // Avoid mixing Claude session IDs or a different model/provider's state into this conversation.
  args.push('-');
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: o.cwd, env: cleanEnv(), stdio: ['pipe', 'pipe', 'pipe'] }); entry.child = child; onChild(child, true);
    let buffer = '', error = '', session = '', last = '', usage = {}, timedOut = false, idleTimer, killTimer;
    const began=Date.now(), idleMs=o.idleTimeoutMs || (o.effort === 'high' || o.agent === 'boss' ? 600000 : 300000);
    const terminate = reason => { if(timedOut)return;timedOut=true;error=`${o.model}: ${reason} (${Math.round((Date.now()-began)/1000)} s). Uložené soubory zůstaly zachované.`; child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),3000); };
    const touch=()=>{clearTimeout(idleTimer);idleTimer=setTimeout(()=>terminate('bez nové aktivity příliš dlouho'),idleMs);};touch();
    const timer=setTimeout(()=>terminate('překročen celkový čas kroku'),o.timeoutMs || 1800000);
    const heartbeat=setInterval(()=>onEvent({kind:'sys',text:`${o.model} stále pracuje · ${Math.floor((Date.now()-began)/60000)} min`}),60000);
    const cleanup=()=>{clearTimeout(timer);clearTimeout(idleTimer);clearTimeout(killTimer);clearInterval(heartbeat);};
    child.stdout.on('data', (chunk) => { touch(); buffer += chunk; let i; while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i); buffer = buffer.slice(i + 1); let e; try { e = JSON.parse(line); } catch { continue; }
      if (e.type === 'thread.started') session = e.thread_id;
      if (e.type === 'turn.completed') usage = e.usage || {};
      if (e.type === 'turn.failed' || e.type === 'error') error = e.error?.message || e.message || 'Model selhal.';
      const item = e.item;
      if (item?.type === 'agent_message') { last = item.text || ''; if (e.type === 'item.completed') { try { const data = parseResult(last); if (data.summary || data.reply) onEvent({ kind: 'text', text: data.summary || data.reply }); } catch { onEvent({ kind: 'text', text: last }); } } }
      else if (item?.type === 'command_execution') onEvent({ kind: 'tool', text: `Spouští: ${String(item.command || '').slice(0, 150)}`, tool: 'Bash' });
      else if (item?.type === 'file_change') onEvent({ kind: 'tool', text: `Upravuje: ${(item.changes || []).map((c) => c.path).join(', ')}`, changed: true, tool: 'Edit' });
    } });
    child.stderr.on('data', (chunk) => { error = (error + chunk).slice(-3000); });
    child.on('error', (e) => { cleanup(); onChild(child, false);reject(e); });
    child.on('close', (code) => {
      cleanup();
      onChild(child, false);
      if (entry.interrupted) return reject(Object.assign(new Error('interrupted'), { interrupted: true }));
      try {
        if (timedOut) throw Object.assign(new Error(error), { timedOut: true });
        if (code !== 0) throw Object.assign(new Error(error.slice(-600) || `Model skončil s kódem ${code}.`), { limit: /quota|rate.?limit|usage.limit|hit your|429|try again (in|at)/i.test(error) });
        const text = fs.existsSync(resultFile) ? fs.readFileSync(resultFile, 'utf8') : last;
        resolve({ text, data: parseResult(text), session, cost: 0, usage, provider: o.provider });
      } catch (e) { reject(e); }
      finally { for (const file of [schema, resultFile]) try { fs.unlinkSync(file); } catch {} }
    });
    child.stdin.end(`${o.system}\n\n${o.prompt}\n\nUse the project's saved files as persistent memory. If continuing earlier work, inspect those files before changing them. Return the required structured result.\nDo not publish, push, spend money or delete unrelated files. Stay inside the supplied project/office folders.`);
  });
}

/** Antigravity CLI in headless mode: `agy -p … --output-format json --json-schema <file>`.
 *  Edits are accepted (`--mode accept-edits`); shell commands stay blocked because nobody can approve them headless. */
export async function runAntigravity(p, o, { entry, onEvent, onChild }) {
  const bin = locate('agy'); if (!bin) throw new Error('Antigravity CLI (agy) chybí.');
  const dir = path.join(p.dir, '.runtime'); fs.mkdirSync(dir, { recursive: true });
  const schema = path.join(dir, `${Date.now()}-${Math.random().toString(16).slice(2)}.agy-schema.json`);
  fs.writeFileSync(schema, JSON.stringify(strictSchema(o.schema)));
  const prompt = `${o.system}\n\n${o.prompt}\n\nUse the project's saved files as persistent memory. Do not publish, push, spend money or delete unrelated files. Stay inside the supplied project/office folders. Return the required structured result.`;
  const args = ['-p', prompt, '--output-format', 'json', '--json-schema', schema, '--disable-slash-commands', '--print-timeout', `${Math.round((o.timeoutMs || 1800000) / 60000)}m`];
  if (o.model && o.model !== 'auto') args.push('--model', o.model);
  if (o.effort && o.effort !== 'auto') args.push('--effort', o.effort === 'ultra' ? 'max' : o.effort);
  if (o.bash || o.tools?.includes('Write')) args.push('--mode', 'accept-edits');
  for (const d of o.addDirs || []) args.push('--add-dir', d);
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: o.cwd, env: cleanEnv('antigravity'), stdio: ['ignore', 'pipe', 'pipe'] }); entry.child = child; onChild(child, true);
    let out = '', error = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { error = (error + c).slice(-3000); });
    child.on('error', (e) => { onChild(child, false); reject(e); });
    child.on('close', (code) => {
      onChild(child, false); try { fs.unlinkSync(schema); } catch {}
      if (entry.interrupted) return reject(Object.assign(new Error('interrupted'), { interrupted: true }));
      try {
        let env = null; try { env = JSON.parse(out.trim().split('\n').pop()); } catch {}
        if (/authentication required/i.test(error + (env?.error || ''))) { const all = metric(); all.antigravity = { ...(all.antigravity || {}), authFailed: Date.now() }; fs.writeFileSync(stateFile(), JSON.stringify(all, null, 2)); cached = null; }
        if (code !== 0 || (env && env.status && env.status !== 'SUCCESS')) throw Object.assign(new Error(env?.error || error.slice(-600) || `Antigravity skončilo s kódem ${code}.`), { limit: /quota|rate.?limit|exhausted|429/i.test(error + (env?.error || '')) });
        if (metric().antigravity?.authFailed) { const all = metric(); all.antigravity = { ...all.antigravity, authFailed: 0 }; fs.writeFileSync(stateFile(), JSON.stringify(all, null, 2)); cached = null; }
        const data = env?.structured_output || parseResult(String(env?.response ?? out).trim());
        const u = env?.usage || {};
        if (data.summary || data.reply) onEvent({ kind: 'text', text: data.summary || data.reply });
        resolve({ text: env?.response ?? out, data, session: env?.conversation_id || '', cost: 0, usage: { input_tokens: u.input_tokens, output_tokens: u.output_tokens, cached_input_tokens: u.cache_read_tokens }, provider: 'antigravity' });
      } catch (e) { reject(e); }
    });
  });
}

/** Gemini CLI in headless mode (`gemini -p … --output-format json`). It has no schema flag, so the JSON shape goes into the prompt.
 *  File edits are auto-approved (`--approval-mode auto_edit`); shell commands stay blocked. */
export async function runGemini(p, o, { entry, onEvent, onChild }) {
  const bin = locate('gemini'); if (!bin) throw new Error('Gemini CLI chybí.');
  const args = ['--output-format', 'json'];
  if (o.model && o.model !== 'auto') args.push('-m', o.model);
  if (o.bash || o.tools?.includes('Write')) args.push('--approval-mode', 'auto_edit');
  for (const d of o.addDirs || []) args.push('--include-directories', d);
  const prompt = `${o.system}\n\n${o.prompt}\n\nUse the project's saved files as persistent memory. Do not publish, push, spend money or delete unrelated files. Stay inside the supplied project/office folders.\nReturn ONLY one JSON object (no prose, no code fence) matching this JSON schema:\n${JSON.stringify(strictSchema(o.schema))}`;
  args.push('-p', prompt);
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: o.cwd, env: cleanEnv('gemini'), stdio: ['ignore', 'pipe', 'pipe'] }); entry.child = child; onChild(child, true);
    let out = '', error = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, o.timeoutMs || 1800000);
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { error = (error + c).slice(-3000); });
    child.on('error', (e) => { clearTimeout(timer); onChild(child, false); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer); onChild(child, false);
      if (entry.interrupted) return reject(Object.assign(new Error('interrupted'), { interrupted: true }));
      try {
        if (timedOut) throw Object.assign(new Error(`${o.model}: překročen celkový čas kroku.`), { timedOut: true });
        let env = null; try { env = JSON.parse(out); } catch {}
        if (code !== 0 || env?.error) throw Object.assign(new Error((env?.error?.message || env?.error) || error.slice(-600) || `Gemini skončilo s kódem ${code}.`), { limit: /quota|rate.?limit|exhausted|429/i.test(error) });
        const text = env?.response ?? out, data = parseResult(String(text).trim());
        if (data.summary || data.reply) onEvent({ kind: 'text', text: data.summary || data.reply });
        resolve({ text, data, session: '', cost: 0, usage: {}, provider: 'gemini' });
      } catch (e) { reject(e); }
    });
  });
}
