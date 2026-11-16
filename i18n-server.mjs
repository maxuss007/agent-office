// Language for what the server writes: the same English table as the UI (public/i18n.js), applied to
// generated files (BOARD.md, PLAN.md, BRIEF.md, FINAL.md, DECISIONS.md, the HTML summary) when the
// app language is English. Agent-written text passes through unchanged: only exact strings and the
// table's patterns are translated.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
await import('./public/i18n.js');
const I = globalThis.AO_I18N;

export function lang() {
  try { return JSON.parse(fs.readFileSync(path.join(process.env.AGENT_OFFICE_HOME || ROOT, 'config.json'), 'utf8')).lang === 'cs' ? 'cs' : 'en'; } catch { return 'en'; }
}
export const T = (s) => (lang() === 'cs' ? s : I.tr(s));
export const locale = () => (lang() === 'cs' ? 'cs-CZ' : 'en-GB');

/** Markdown, line by line: headings, table cells, list items, **bold labels** and plain lines. */
export function Tdoc(md) {
  if (lang() === 'cs' || typeof md !== 'string') return md;
  return md.split('\n').map((line) => {
    let m;
    if ((m = line.match(/^(#{1,6} )(.+)$/))) return m[1] + I.tr(m[2]);
    if (/^\|.*\|$/.test(line) && !/^\|[-|\s:]+\|$/.test(line)) return line.split('|').map((c) => { const t = c.trim(); return t ? c.replace(t, I.tr(t)) : c; }).join('|');
    if ((m = line.match(/^(\s*[-*] )\*\*(.+?)\*\*(.*)$/))) return m[1] + '**' + I.tr(m[2]) + '**' + m[3];
    if ((m = line.match(/^(\s*[-*] )(.+)$/))) return m[1] + I.tr(m[2]);
    if ((m = line.match(/^\*\*(.+?)\*\*\s*(.*)$/))) return '**' + I.tr(m[1]) + '** ' + I.tr(m[2]);
    return I.tr(line);
  }).join('\n');
}
