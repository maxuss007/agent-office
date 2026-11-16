import os from 'node:os';
import { execFileSync } from 'node:child_process';

const service = 'com.agentoffice.app.claude-oauth';
let cachedToken, checkedAt = 0;
export function claudeToken() {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (Date.now() - checkedAt < 60000) return cachedToken;
  checkedAt = Date.now(); cachedToken = undefined;
  if (process.platform === 'darwin') try {
    cachedToken = execFileSync('/usr/bin/security', ['find-generic-password', '-a', os.userInfo().username, '-s', service, '-w'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined;
  } catch {}
  return cachedToken;
}
export function saveClaudeToken(value) {
  if (process.platform !== 'darwin') throw new Error('Uložení tokenu vyžaduje macOS Klíčenku. Jinde nastav CLAUDE_CODE_OAUTH_TOKEN.');
  const token = typeof value === 'string' ? value.trim() : '';
  if (!/^sk-ant-oat\d+-[A-Za-z0-9_-]{20,4096}$/.test(token)) throw new Error('Vlož OAuth token vypsaný příkazem claude setup-token.');
  try {
    execFileSync('/usr/bin/security', ['add-generic-password', '-U', '-a', os.userInfo().username, '-s', service, '-w', token], { timeout: 10000, stdio: 'ignore' });
  } catch { throw new Error('Token se nepodařilo uložit do Klíčenky. Odemkni ji a zkus to znovu.'); }
  cachedToken = token; checkedAt = Date.now();
}
export function providerEnv(provider) {
  const env = { ...process.env };
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY', 'CODEX_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']) delete env[key];
  env.PATH = [`${os.homedir()}/.local/bin`, '/opt/homebrew/bin', '/usr/local/bin', env.PATH].filter(Boolean).join(':');
  if (provider === 'claude') { const token = claudeToken(); if (token) env.CLAUDE_CODE_OAUTH_TOKEN = token; }
  return env;
}
