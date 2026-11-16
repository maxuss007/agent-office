// Read-only discovery. No transcript or Claude configuration is modified.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const canonical = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const records = (s) => s.split('\n').flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
function chunk(file, tail = false) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size, length = Math.min(size, 196608), start = tail ? size - length : 0;
    const buffer = Buffer.alloc(length); fs.readSync(fd, buffer, 0, length, start);
    const text = buffer.toString('utf8'); return start ? text.slice(text.indexOf('\n') + 1) : text;
  } finally { fs.closeSync(fd); }
}
export function scanClaudeProjects(configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')) {
  const base = path.join(configDir, 'projects'), sessions = [];
  let dirs; try { dirs = fs.readdirSync(base, { withFileTypes: true }); } catch (e) { return { sessions, problem: e.code === 'ENOENT' ? 'missing' : 'unreadable' }; }
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    let files; try { files = fs.readdirSync(path.join(base, dir.name)).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
    for (const file of files) {
      try {
        const full = path.join(base, dir.name, file), stat = fs.statSync(full);
        const head = records(chunk(full));
        const cwd = head.find((e) => typeof e.cwd === 'string' && path.isAbsolute(e.cwd))?.cwd;
        if (!cwd || cwd.includes('/scratch-workspaces/') || cwd.startsWith('/private/tmp/') || cwd.startsWith('/tmp/')) continue;
        const folder = canonical(cwd);
        if (!fs.statSync(folder).isDirectory()) continue;
        const events = records(chunk(full, true));
        const messages = events.filter((e) => ['assistant', 'user'].includes(e.type) && !e.isMeta);
        const custom = [...head, ...events].filter((e) => e.type === 'custom-title').at(-1);
        const prompt = head.find((e) => e.type === 'user' && !e.isMeta && (typeof e.message?.content === 'string' || e.message?.content?.some?.((b) => b.type === 'text')));
        const text = (e) => typeof e?.message?.content === 'string' ? e.message.content : (e?.message?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        const title = custom?.customTitle || custom?.title || text(prompt).replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ').slice(0, 90) || file.slice(0, 8);
        const last = messages.at(-1), ageSec = Math.max(0, Math.round((Date.now() - stat.mtimeMs) / 1000));
        const content = last?.message?.content;
        const finished = last?.type === 'assistant' && (last.message.stop_reason === 'end_turn' || (Array.isArray(content) && !content.some((b) => b.type === 'tool_use')));
        const recent = messages.slice(-30).flatMap((e) => Array.isArray(e.message?.content) ? e.message.content.filter((b) => ['text', 'tool_use'].includes(b.type)).map((b) => b.type === 'tool_use' ? { kind: 'tool', tool: b.name, input: b.input } : { kind: 'text', text: b.text?.slice(0, 1200) }) : []);
        sessions.push({ id: file.slice(0, -6), path: folder, title: String(title).slice(0, 90), active: ageSec < 90 && !finished, ageSec, updated: new Date(stat.mtimeMs).toISOString(), recent: recent.slice(-24) });
      } catch { /* A session can be rotated or deleted while scanning. */ }
    }
  }
  return { sessions: sessions.sort((a, b) => a.ageSec - b.ageSec), problem: null };
}

let cache;
export function claudeSnapshot(force = false) {
  if (!force && cache && Date.now() - cache.time < 5000) return cache.value;
  const value = scanClaudeProjects(); cache = { time: Date.now(), value }; return value;
}
