import { providerCatalog, runCodex } from '../providers.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const catalog = await providerCatalog(true);
console.log(JSON.stringify({ providers: catalog.providers.map(({ id, available, remainingPercent, source }) => ({ id, available, remainingPercent, source })), models: catalog.models.map(({ id, available }) => ({ id, available })) }, null, 2));
if (process.argv.includes('--live')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-live-provider-'));
  try {
    for (const provider of ['codex', 'ollama']) {
      if (process.argv.includes('--local-only') && provider !== 'ollama') continue;
      const model = catalog.models.find((m) => m.available && m.provider === provider && (provider === 'codex' ? /luna/.test(m.model) : /^qwen3\.5/.test(m.model)));
      if (!model) { console.log(`${provider}: unavailable`); continue; }
      const files = process.argv.includes('--file-test');
      const result = await runCodex({ dir }, { provider, model: model.model, effort: 'low', system: files ? 'This is a project file tool test. Use write_file to create the requested file, then return the requested JSON.' : 'This is a connectivity test. Do not use tools or change files. Return only the requested JSON.', prompt: files ? 'Create test-file.md containing exactly office-local-smoke. Then reply with {"reply":"ok"}.' : 'Reply with {"reply":"ok"}.', cwd: dir, tools: files ? ['Read', 'Write'] : [], schema: { type: 'object', required: ['reply'], properties: { reply: { type: 'string' } } }, timeoutMs: 120000 }, { entry: {}, onEvent: () => {}, onChild: () => {} });
      if (files && fs.readFileSync(path.join(dir, 'test-file.md'), 'utf8').trim() !== 'office-local-smoke') throw new Error('File tool verification failed');
      console.log(JSON.stringify({ provider, model: model.model, result: result.data, usage: result.usage }));
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
