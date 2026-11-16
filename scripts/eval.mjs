#!/usr/bin/env node
// Quality bench for Agent Office: run representative jobs, compare outputs blind, track spend per accepted job.
//
//   node scripts/eval.mjs list
//   node scripts/eval.mjs run <case> --label A [--depth fast|std|max] [--share-criteria]
//   node scripts/eval.mjs fixes <runDir> <count>      # how many corrections a human had to ask for
//   node scripts/eval.mjs blind <case> <runDirA> <runDirB>
//   node scripts/eval.mjs report
//
// Talks to the running app (AO_URL, default http://127.0.0.1:4747; AO_TOKEN, default from the Mac app's settings).
// The boss's own score is recorded but is NEVER the measure: the measure is the pre-declared criteria, judged blind,
// plus human corrections and the total spend (failed attempts included) per accepted job.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVALS = path.join(ROOT, 'evals');
const DATA = process.env.AGENT_OFFICE_HOME || path.join(os.homedir(), 'Library', 'Application Support', 'Agent Office');
const URL0 = process.env.AO_URL || 'http://127.0.0.1:4747';
const TOKEN = process.env.AO_TOKEN || (() => { try { return execFileSync('defaults', ['read', 'com.agentoffice.app', 'token'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
const DEPTH = { fast: { maxRounds: 1, maxRuns: 15, targetScore: 75 }, std: { maxRounds: 3, maxRuns: 40, targetScore: 88 }, max: { maxRounds: 5, maxRuns: 80, targetScore: 93 } };

const api = async (p, o = {}) => { const r = await fetch(`${URL0}${p}${p.includes('?') ? '&' : '?'}t=${TOKEN}`, { headers: { 'content-type': 'application/json' }, ...o }); const j = await r.json(); if (j.error) throw new Error(j.error); return j; };
const arg = (name, d) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : d; };
const cases = () => fs.readdirSync(path.join(EVALS, 'cases')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(EVALS, 'cases', f), 'utf8')));
const getCase = (id) => cases().find((c) => c.id === id) || (() => { throw new Error(`Neznámý případ: ${id}`); })();
const copyDir = (a, b) => { if (fs.existsSync(a)) fs.cpSync(a, b, { recursive: true, filter: (s) => !s.includes(`${path.sep}.git`) }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(id) {
  const c = getCase(id), label = arg('--label', 'A'), depth = arg('--depth', c.depth || 'std');
  const office = await api('/api/offices', { method: 'POST', body: JSON.stringify({ name: `Eval ${c.id} ${label} ${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}` }) });
  const notes = process.argv.includes('--share-criteria') ? `Acceptance criteria:\n${c.criteria.map((x) => '- ' + x).join('\n')}` : '';
  const started = await api('/api/start', { method: 'POST', body: JSON.stringify({ repoId: office.id, preset: arg('--preset', c.preset || 'general'), goal: c.goal, notes, settings: DEPTH[depth] }) });
  console.log(`▶ ${c.id} / ${label}: projekt ${started.id} ve složce ${office.path}`);
  const t0 = Date.now(); let st;
  for (;;) {
    await sleep(5000);
    st = (await api('/api/state')).projects.find((p) => p.id === started.id);
    for (const q of st.inbox.filter((q) => q.answer === null)) { await api(`/api/projects/${st.id}/answer`, { method: 'POST', body: JSON.stringify({ qid: q.id, value: q.default }) }); console.log(`  ? ${q.text} → ${q.default} (výchozí)`); }
    if (['done', 'partial', 'error', 'stopped'].includes(st.status)) break;
    process.stdout.write(`\r  ${st.status} · kolo ${st.round} · běhy ${st.stats.runs}   `);
  }
  const usage = await api(`/api/projects/${st.id}/usage`);
  const out = path.join(EVALS, 'runs', c.id, `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(out, { recursive: true });
  copyDir(path.join(office.path, 'deliverables'), path.join(out, 'deliverables'));
  copyDir(path.join(DATA, 'projects', st.id, 'office'), path.join(out, 'office'));
  const metrics = { case: c.id, label, depth, project: st.id, folder: office.path, status: st.status, minutes: Math.round((Date.now() - t0) / 60000), bossScore: st.score, criteriaVerifiedByBoss: st.checkpoint?.judged?.criteria || [], gaps: st.final?.remaining || [], usage: usage.current.total, byPhase: usage.current.byPhase, humanFixes: null, blind: null };
  fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 2));
  console.log(`\n✓ ${st.status} · ${metrics.minutes} min · vstup ${usage.current.total.input} / výstup ${usage.current.total.output} tokenů (neúspěšné: ${usage.current.total.failedTokens})\n  ${out}`);
}

function blind(id, a, b) {
  const c = getCase(id); const dir = path.join(EVALS, 'blind', `${c.id}-${Date.now()}`); fs.mkdirSync(dir, { recursive: true });
  const flip = crypto.randomInt(2) === 1; const map = flip ? { X: b, Y: a } : { X: a, Y: b };
  for (const [k, src] of Object.entries(map)) copyDir(path.join(src, 'deliverables'), path.join(dir, k));
  fs.writeFileSync(path.join(EVALS, 'blind', `.${path.basename(dir)}.key.json`), JSON.stringify(map, null, 2)); // kept out of the reviewer's folder
  fs.writeFileSync(path.join(dir, 'HODNOCENI.md'), `# Slepé hodnocení: ${c.id}\n\nZadání: ${c.goal}\n\nU každého kritéria napiš ANO / NE / ČÁSTEČNĚ zvlášť pro X a Y. Nehledej, která verze je která.\n\n| Kritérium | X | Y |\n|---|---|---|\n${c.criteria.map((k) => `| ${k} | | |`).join('\n')}\n\nCelkově lepší (X/Y/stejné):\n`);
  console.log(`Slepé srovnání připravené: ${dir}\nVyplň HODNOCENI.md, pak spusť: node scripts/eval.mjs report`);
}

function report() {
  const rows = [];
  const runsDir = path.join(EVALS, 'runs');
  for (const c of fs.existsSync(runsDir) ? fs.readdirSync(runsDir) : []) for (const r of fs.readdirSync(path.join(runsDir, c))) {
    try { rows.push({ dir: path.join(runsDir, c, r), ...JSON.parse(fs.readFileSync(path.join(runsDir, c, r, 'metrics.json'), 'utf8')) }); } catch {}
  }
  // blind verdicts
  const blindDir = path.join(EVALS, 'blind');
  for (const b of fs.existsSync(blindDir) ? fs.readdirSync(blindDir).filter((x) => !x.startsWith('.')) : []) {
    try {
      const key = JSON.parse(fs.readFileSync(path.join(blindDir, `.${b}.key.json`), 'utf8')); const md = fs.readFileSync(path.join(blindDir, b, 'HODNOCENI.md'), 'utf8');
      const score = (col) => md.split('\n').filter((l) => l.startsWith('| ') && !l.includes('Kritérium') && !l.includes('---')).reduce((a, l) => { const v = l.split('|')[col]?.trim().toUpperCase(); return a + (v === 'ANO' ? 1 : v?.startsWith('ČÁST') ? 0.5 : 0); }, 0);
      for (const [k, col] of [['X', 2], ['Y', 3]]) { const row = rows.find((r) => r.dir === key[k]); if (row) row.blind = score(col); }
    } catch {}
  }
  const byLabel = {};
  for (const r of rows) (byLabel[`${r.case} · ${r.label}`] ||= []).push(r);
  console.log('Případ · varianta | běhů | převzato* | tokeny/běh | neúspěšné | lidské opravy | slepé kritéria');
  for (const [k, list] of Object.entries(byLabel)) {
    const tok = list.reduce((a, r) => a + r.usage.input + r.usage.output, 0); const ok = list.filter((r) => r.status === 'done').length;
    const avg = (f) => { const v = list.map(f).filter((x) => x != null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'; };
    console.log(`${k} | ${list.length} | ${ok} | ${Math.round(tok / list.length)} | ${list.reduce((a, r) => a + (r.usage.failedTokens || 0), 0)} | ${avg((r) => r.humanFixes)} | ${avg((r) => r.blind)}`);
    if (ok) console.log(`   spotřeba na převzatou zakázku (včetně neúspěchů): ${Math.round(tok / ok)} tokenů`);
  }
  console.log('* převzato = stav done (všechna MUST kritéria ověřená); u reálného převzetí zapiš i lidské opravy příkazem fixes.');
}

const [cmd, a1, a2, a3] = process.argv.slice(2);
try {
  if (cmd === 'list') for (const c of cases()) console.log(`${c.id.padEnd(18)} ${c.goal.slice(0, 90)}…`);
  else if (cmd === 'run') await run(a1);
  else if (cmd === 'fixes') { const f = path.join(a1, 'metrics.json'); const m = JSON.parse(fs.readFileSync(f, 'utf8')); m.humanFixes = Number(a2); fs.writeFileSync(f, JSON.stringify(m, null, 2)); console.log('Uloženo.'); }
  else if (cmd === 'blind') blind(a1, a2, a3);
  else if (cmd === 'report') report();
  else console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).join('\n'));
} catch (e) { console.error('✕ ' + e.message); process.exit(1); }
