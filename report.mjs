// Turns the office's Markdown outputs into polished, self-contained HTML pages. Plain code: no model call, no network.
import { T, locale, lang } from './i18n-server.mjs';
import fs from 'node:fs';
import path from 'node:path';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function inline(t) {
  const code = []; t = esc(t).replace(/`([^`]+)`/g, (_, c) => `\u0000${code.push(c) - 1}\u0000`);
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${code[i]}</code>`);
}
const pill = (cell) => { const m = cell.trim().match(/^(✅|❌|❔|PASS|FAIL|UNVERIFIED|ANO|NE)$/i); if (!m) return inline(cell.trim()); const k = /✅|PASS|ANO/i.test(m[1]) ? 'ok' : /❌|FAIL|NE/i.test(m[1]) ? 'bad' : 'unk'; return `<span class="pill ${k}">${T({ ok: 'Splněno', bad: 'Nesplněno', unk: 'Neověřeno' }[k])}</span>`; };

/** Small, dependable Markdown subset: headings, lists (nested), tables, code fences, quotes, rules, paragraphs. */
export function mdToHtml(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n'); let out = '', i = 0; const toc = [];
  const para = (buf) => { if (buf.length) out += `<p>${inline(buf.join(' '))}</p>\n`; };
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out += `<pre><code>${esc(buf.join('\n'))}</code></pre>\n`; continue; }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const n = h[1].length, id = 's' + (toc.length + 1); if (n === 2) toc.push({ id, text: h[2] }); out += `<h${n}${n === 2 ? ` id="${id}"` : ''}>${inline(h[2])}</h${n}>\n`; i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out += '<hr>\n'; i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const row = (x) => x.trim().replace(/^\||\|$/g, '').split('|'); const head = row(l); i += 2; const body = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
      out += `<div class="tablewrap"><table><thead><tr>${head.map((c) => `<th>${inline(c.trim())}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${pill(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>\n`; continue;
    }
    if (/^\s*>/.test(l)) { const buf = []; while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, '')); out += `<blockquote>${mdToHtml(buf.join('\n')).html}</blockquote>\n`; continue; }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      const stack = []; // [indent, tag]
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && stack.length))) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) { out += ' ' + inline(lines[i].trim()); i++; continue; }
        const ind = m[1].length, tag = /\d/.test(m[2]) ? 'ol' : 'ul';
        while (stack.length && stack[stack.length - 1][0] > ind) out += `</li></${stack.pop()[1]}>`;
        if (!stack.length || stack[stack.length - 1][0] < ind) { out += `<${tag}>`; stack.push([ind, tag]); } else out += '</li>';
        const task = m[3].match(/^\[( |x|X)\]\s+(.*)$/);
        out += task ? `<li class="task ${task[1] === ' ' ? '' : 'done'}">${inline(task[2])}` : `<li>${inline(m[3])}`; i++;
      }
      while (stack.length) out += `</li></${stack.pop()[1]}>`; out += '\n'; continue;
    }
    if (!l.trim()) { i++; continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*>|\s*([-*+]|\d+[.)])\s+|\s*\|.*\|\s*$)/.test(lines[i])) buf.push(lines[i++].trim()); para(buf);
    if (!buf.length) { out += `<p>${inline(l)}</p>\n`; i++; }
  }
  return { html: out, toc };
}

const CSS = `:root{--bg:#f7f5f0;--paper:#fffdf9;--ink:#1d1b18;--mute:#6f6a61;--line:#e5dfd3;--acc:#b7791f;--acc2:#1f3a5f;--ok:#1f8a5b;--bad:#c2413b;--unk:#8a7d4a;--code:#f1ede4}
@media(prefers-color-scheme:dark){:root{--bg:#14161a;--paper:#1b1e24;--ink:#ece8df;--mute:#9a958b;--line:#2c3038;--acc:#e0b062;--acc2:#8fb4e6;--code:#23272f}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.62 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:40px 22px 80px}
header.top{border-bottom:1px solid var(--line);padding-bottom:22px;margin-bottom:28px}
.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);font-weight:700;margin:0 0 8px}
h1{font:700 34px/1.15 Georgia,"Times New Roman",serif;margin:0 0 10px;letter-spacing:-.01em}
.meta{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;color:var(--mute);font-size:14px}
.status{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:3px 12px;font-weight:700;font-size:13px;border:1px solid}
.status.done{color:var(--ok);border-color:var(--ok)}.status.partial{color:var(--acc);border-color:var(--acc)}.status.error{color:var(--bad);border-color:var(--bad)}
.lead{font-size:19px;line-height:1.55;margin:18px 0 0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:26px 0}
.stat{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 16px}.stat b{display:block;font:700 24px/1.1 Georgia,serif}.stat span{display:block;font-size:13px;line-height:1.35;color:var(--mute);margin-top:4px}
nav.toc{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:12px 18px;margin:0 0 26px;font-size:14px}nav.toc a{color:var(--acc2);text-decoration:none;margin-right:14px;white-space:nowrap}
main h2{font:700 24px/1.25 Georgia,serif;margin:38px 0 12px;padding-top:8px}main h3{font-size:18px;margin:26px 0 8px}main h4{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);margin:20px 0 6px}
p{margin:0 0 14px}a{color:var(--acc2)}ul,ol{padding-left:22px;margin:0 0 14px}li{margin:4px 0}li.task{list-style:none;margin-left:-20px}li.task::before{content:"☐ ";color:var(--mute)}li.task.done::before{content:"☑ ";color:var(--ok)}
blockquote{margin:0 0 14px;padding:10px 16px;border-left:3px solid var(--acc);background:var(--paper);border-radius:0 10px 10px 0;color:var(--mute)}
code{background:var(--code);border-radius:5px;padding:1px 5px;font:13.5px/1.4 ui-monospace,Menlo,monospace}pre{background:var(--code);border-radius:12px;padding:14px 16px;overflow:auto}pre code{background:none;padding:0}
.tablewrap{overflow-x:auto;margin:0 0 18px;border:1px solid var(--line);border-radius:14px;background:var(--paper)}table{border-collapse:collapse;width:100%;font-size:15px}th{text-align:left;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);padding:10px 14px;border-bottom:1px solid var(--line)}td{padding:10px 14px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}
.pill{display:inline-block;border-radius:99px;padding:1px 10px;font-size:12.5px;font-weight:700;white-space:nowrap}.pill.ok{background:color-mix(in srgb,var(--ok) 16%,transparent);color:var(--ok)}.pill.bad{background:color-mix(in srgb,var(--bad) 16%,transparent);color:var(--bad)}.pill.unk{background:color-mix(in srgb,var(--unk) 18%,transparent);color:var(--unk)}
img{max-width:100%;border-radius:10px}hr{border:0;border-top:1px solid var(--line);margin:28px 0}
.files a{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:var(--paper);text-decoration:none;color:var(--ink);margin-bottom:8px}.files a span{color:var(--mute);font-size:13px}
footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);color:var(--mute);font-size:13px}
@media(max-width:560px){body{font-size:16px}h1{font-size:27px}.wrap{padding:26px 16px 60px}}
@media print{body{background:#fff}.wrap{max-width:none;padding:0}nav.toc{display:none}.tablewrap,.stat{break-inside:avoid}}`;

export function page({ title, eyebrow = '', status = null, metaLine = '', lead = '', stats = [], body, toc = [], extra = '', footer = '' }) {
  const ST = { done: T('Hotovo – kritéria ověřena'), partial: T('Rozpracováno'), error: T('Chyba') };
  return `<!doctype html>
<html lang="${lang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><div class="wrap">
<header class="top">${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h1>${esc(title)}</h1>
<div class="meta">${status ? `<span class="status ${status}">● ${ST[status] || esc(status)}</span>` : ''}${metaLine ? `<span>${esc(metaLine)}</span>` : ''}</div>
${lead ? `<p class="lead">${inline(lead)}</p>` : ''}</header>
${stats.length ? `<section class="stats">${stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</section>` : ''}
${toc.length > 2 ? `<nav class="toc">${toc.map((t) => `<a href="#${t.id}">${esc(t.text)}</a>`).join('')}</nav>` : ''}
<main>${body}</main>${extra}
<footer>${esc(T(footer || 'Vytvořila kancelář Agent Office'))}</footer>
</div></body></html>`;
}

const k = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' M' : n >= 1e3 ? Math.round(n / 1e3) + ' tis.' : String(n || 0));
const title1 = (md, fallback) => (String(md).match(/^#\s+(.+)$/m) || [])[1] || fallback;

/** Render one Markdown file to a sibling .html (same name). Returns the html path. */
export function renderFile(mdPath, { eyebrow = T('Výstup'), footer = '' } = {}) {
  const md = fs.readFileSync(mdPath, 'utf8'); const name = path.basename(mdPath, path.extname(mdPath));
  const t = title1(md, name); const { html, toc } = mdToHtml(md.replace(/^#\s+.+\n?/, ''));
  const out = mdPath.replace(/\.md$/i, '.html');
  fs.writeFileSync(out, page({ title: t, eyebrow, body: html, toc, footer })); return out;
}

/** After a job: every Markdown deliverable gets an HTML twin, and the office writes one summary page. */
export function publishReports(p, { usage } = {}) {
  const st = p.state, work = p.ctx.work, office = p.ctx.office, outDir = path.join(work, 'deliverables'); fs.mkdirSync(outDir, { recursive: true });
  const made = [];
  const walk = (dir, depth = 0) => { let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch {} for (const e of ents) { const f = path.join(dir, e.name); if (e.name.startsWith('.') || e.isSymbolicLink()) continue; if (e.isDirectory() && depth < 3) walk(f, depth + 1); else if (/\.md$/i.test(e.name)) { try { made.push(renderFile(f, { eyebrow: st.repoName || 'Výstup', footer: `${st.repoName || ''} · Agent Office` })); } catch {} } } };
  walk(outDir);
  const finalMd = fs.existsSync(path.join(office, 'FINAL.md')) ? fs.readFileSync(path.join(office, 'FINAL.md'), 'utf8') : '';
  const { html, toc } = mdToHtml(finalMd.replace(/^#\s+.+\n?/, '').replace(/^\*\*(?:Zadání|Brief):\*\*.*\n?/m, ''));
  const crit = st.checkpoint?.judged?.criteria || []; const must = crit.filter((c) => c.level === 'MUST');
  const t = usage?.current?.total; const human = st.human ? Object.values(st.human).reduce((a, b) => a + (b || 0), 0) : 0;
  const stats = [
    ...(must.length ? [{ value: `${must.filter((c) => c.status === 'PASS').length}/${must.length}`, label: T('povinných kritérií ověřeno') }] : []),
    { value: String((st.tasks || []).filter((x) => x.status === 'done').length), label: T('hotových úkolů') },
    ...(t ? [{ value: k(t.input + t.output), label: T(`tokenů (${k(t.cacheRead)} z cache)`) }, { value: `${Math.max(1, Math.round(t.ms / 60000))} min`, label: T(`práce agentů · ${t.attempts} běhů${t.failed ? `, ${t.failed} neúspěšných` : ''}`) }] : []),
    { value: String(human), label: T('tvých zásahů') },
  ];
  const files = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => !f.startsWith('.') && f !== 'Souhrn.html' && !/\.md$/i.test(f) || (/\.md$/i.test(f) && !fs.existsSync(path.join(outDir, f.replace(/\.md$/i, '.html'))))) : [];
  const extra = files.length ? `<main><h2>${T('Výstupy')}</h2><div class="files">${files.map((f) => `<a href="${encodeURI(f)}"><b>${esc(f.replace(/\.html$/i, ''))}</b><span>${esc(path.extname(f).slice(1).toUpperCase())}</span></a>`).join('')}</div></main>` : '';
  const summary = page({ title: st.repoName || T('Projekt'), eyebrow: T('Souhrn zakázky'), status: st.status === 'done' || st.status === 'running' ? (st.final?.partial ? 'partial' : 'done') : st.status === 'error' ? 'error' : 'partial', metaLine: new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }), lead: st.goal, stats, body: html, toc, extra, footer: T('Souhrn sestavila kancelář Agent Office z ověřených výsledků (bez dalšího volání modelu).') });
  fs.writeFileSync(path.join(outDir, 'Souhrn.html'), summary); fs.writeFileSync(path.join(office, 'FINAL.html'), summary);
  return { summary: path.join(outDir, 'Souhrn.html'), pages: made };
}
