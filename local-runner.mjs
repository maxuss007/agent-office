import fs from 'node:fs';
import path from 'node:path';
// Local models use Ollama directly. They never attach to a Codex cloud daemon.
function allowedPath(candidate, roots, cwd, writing = false) {
  const target = path.resolve(cwd, candidate || '.');
  let existing = target;
  while (!fs.existsSync(existing)) { const parent = path.dirname(existing); if (parent === existing) throw new Error('Cesta neexistuje.'); existing = parent; }
  const real = fs.realpathSync(existing), canonical = roots.map((r) => fs.realpathSync(r));
  if (!canonical.some((r) => real === r || real.startsWith(r + path.sep))) throw new Error('Soubor je mimo adresáře projektu.');
  if (!writing && !fs.existsSync(target)) throw new Error('Soubor neexistuje.');
  return target;
}
export function localTool(name, args, options) {
  const roots = [options.cwd, ...(options.addDirs || [])];
  const file = allowedPath(args.path, roots, options.cwd, name === 'write_file');
  if (name === 'list_files') return fs.readdirSync(file, { withFileTypes: true }).slice(0, 200).map((d) => `${d.name}${d.isDirectory() ? '/' : ''}`).join('\n');
  if (name === 'read_file') { if (fs.statSync(file).size > 300000) throw new Error('Soubor je příliš velký pro místní úkol.'); return fs.readFileSync(file, 'utf8').slice(0, 24000); }
  if (name === 'write_file') {
    if (!options.tools?.includes('Write')) throw new Error('Tato role nemá povoleno zapisovat.');
    if (typeof args.content !== 'string' || args.content.length > 300000) throw new Error('Obsah souboru není platný.');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Re-check after creating parents to cover existing symlinks and prevent path escapes.
    allowedPath(file, roots, options.cwd, true); fs.writeFileSync(file, args.content); return `Uloženo: ${file}`;
  }
  throw new Error('Neznámý nástroj.');
}
export async function runLocal(p, o, { entry, onEvent, onChild }) {
  const abort = new AbortController(), child = { kill: () => abort.abort() }; entry.child = child; onChild(child, true);
  let timedOut=false;const timer = setTimeout(() => {timedOut=true;abort.abort();}, o.timeoutMs || 600000);
  const usage = { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 };
  const definitions = [
    { type: 'function', function: { name: 'list_files', description: 'List project files in a directory.', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } } },
    { type: 'function', function: { name: 'read_file', description: 'Read a UTF-8 project file. Large or binary documents need another worker.', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } } },
    ...(o.tools?.includes('Write') ? [{ type: 'function', function: { name: 'write_file', description: 'Write a complete UTF-8 file inside the project or office.', parameters: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' } } } } }] : []),
  ];
  const messages = [{ role: 'system', content: `${o.system}\nYou are a local worker. You can read/list project files${o.tools?.includes('Write') ? ' and write UTF-8 files' : ''}. You cannot run a shell or browse the web. Never claim you executed tests or verified a website. Report blocked or UNVERIFIED when those capabilities are required. Use supplied files as memory. Return JSON matching this schema: ${JSON.stringify(o.schema)}\nWorking directory: ${o.cwd}\nOther allowed directories: ${(o.addDirs || []).join(', ')}` }, { role: 'user', content: o.prompt }];
  async function call(final = false) {
    const response = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: abort.signal, body: JSON.stringify({ model: o.model, messages, stream: false, think: false, options: { num_ctx: 32768, num_predict: o.effort === 'low' ? 2048 : 8192 }, ...(final ? { format: o.schema } : { tools: definitions }) }) });
    if (!response.ok) throw new Error(`Ollama: ${response.status} ${await response.text()}`);
    const result = await response.json(); if (result.error) throw new Error(result.error);
    usage.input_tokens += result.prompt_eval_count || 0; usage.output_tokens += result.eval_count || 0; usage.cached_input_tokens += result.prompt_eval_cached_count || 0;
    return result.message;
  }
  try {
    for (let step = 0; step < 12; step++) {
      const msg = await call(); messages.push(msg);
      if (msg.tool_calls?.length) {
        for (const tool of msg.tool_calls) {
          const name = tool.function.name; let args = tool.function.arguments;
          try { if (typeof args === 'string') args = JSON.parse(args); const result = localTool(name, args || {}, o); onEvent({ kind: 'tool', tool: name === 'write_file' ? 'Write' : 'Read', text: `${name}: ${args.path}`, changed: name === 'write_file' }); messages.push({ role: 'tool', tool_name: name, content: result }); }
          catch (e) { messages.push({ role: 'tool', tool_name: name, content: `ERROR: ${e.message}` }); }
        }
        continue;
      }
      let data; try { data = JSON.parse(msg.content); } catch {
        messages.push({ role: 'user', content: 'Return only the final JSON object matching the schema. Do not call tools now.' });
        data = JSON.parse((await call(true)).content);
      }
      for (const key of o.schema?.required || []) if (!(key in data)) throw new Error(`Místní model vynechal povinné pole ${key}.`);
      onEvent({ kind: 'text', text: data.summary || data.reply || 'Místní úkol dokončen.' });
      return { text: JSON.stringify(data), data, usage, cost: 0, provider: 'ollama', session: null };
    }
    throw new Error('Místní model překročil 12 kroků. Úkol potřebuje silnější model.');
  } catch (e) { if(timedOut)throw Object.assign(new Error('Místní model překročil časový limit kroku; soubory zůstaly zachované.'),{timedOut:true}); if (entry.interrupted) throw Object.assign(new Error('interrupted'), { interrupted: true }); throw e; }
  finally { clearTimeout(timer); onChild(child, false); }
}
