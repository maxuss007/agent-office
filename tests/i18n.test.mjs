import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-i18n-'));
process.env.AGENT_OFFICE_HOME = home;
const { Tdoc, T } = await import('../i18n-server.mjs');
const { tr } = globalThis.AO_I18N;

test('English is the default: labels, dynamic messages and generated files are translated', () => {
  assert.equal(tr('Nepovedlo se'), 'Failed');
  assert.equal(tr('Git repozitář · 6/12 úkolů'), 'Git repository · 6/12 tasks');
  assert.equal(tr('Plánování a úsudek · zbývá 8 % limitu · automatický výběr'), 'Planning and judgement · 8% of the limit left · automatic choice');
  assert.equal(T('Projekt'), 'Project');
  assert.equal(Tdoc('# Tabule úkolů\n| | Úkol | Kdo |\n- Výstupy: /x'), '# Task board\n| | Task | Who |\n- Outputs: /x');
});

test('agent and user text is never changed', () => {
  for (const s of ['Používám dovednost pro odpovědi', 'Rozumím. Appka bude sama vyhledávat', 'udělej web pro klienta']) assert.equal(tr(s), s);
});

test('Czech leaves generated files as they are', () => {
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ lang: 'cs' }));
  assert.equal(Tdoc('# Tabule úkolů'), '# Tabule úkolů');
  assert.equal(T('Projekt'), 'Projekt');
});
