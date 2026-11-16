#!/bin/bash
# Agent Office – one-time setup on a new Mac.
# Checks the tools the office needs and installs the Claude Code plugins it relies on:
#   - autoharness (tigerless-labs/autoharness): learns new skills from finished work, needs Python 3.11+
#   - the official Claude plugin marketplace, so the boss can install official plugins by itself
# Runs by itself on the app's first launch (and from mac/build.sh on a first build).
# Usage: bash scripts/setup.sh          check and install what is missing
#        bash scripts/setup.sh --check  only report, change nothing
set -uo pipefail
CHECK=0; [ "${1:-}" = "--check" ] && CHECK=1
if [ -t 1 ]; then G=$'\033[32m' Y=$'\033[33m' R=$'\033[31m' N=$'\033[0m'; else G='' Y='' R='' N=''; fi   # plain text when not in a terminal (installer button)
ok()   { printf '  %s✓%s %s\n' "$G" "$N" "$1"; }
warn() { printf '  %s!%s %s\n' "$Y" "$N" "$1"; }
bad()  { printf '  %s✗%s %s\n' "$R" "$N" "$1"; FAILED=1; }
FAILED=0
find_bin() { for d in "$HOME/.local/bin" /opt/homebrew/bin /usr/local/bin; do [ -x "$d/$1" ] && { echo "$d/$1"; return; }; done; command -v "$1" 2>/dev/null; }

echo "Agent Office – checking this Mac"
NODE=$(find_bin node)
if [ -n "$NODE" ] && "$NODE" -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)'; then ok "Node $("$NODE" -v)"; else bad "Node.js 20+ is missing: brew install node"; fi
PY=$(find_bin python3)
if [ -n "$PY" ] && "$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then ok "Python $("$PY" -V 2>&1 | cut -d' ' -f2) (for autoharness)"; else warn "Python 3.11+ is missing (autoharness needs it): brew install python"; fi
xcode-select -p >/dev/null 2>&1 && ok "Xcode Command Line Tools (for the Mac app)" || warn "Xcode Command Line Tools are missing: xcode-select --install"

CLAUDE=$(find_bin claude)
if [ -n "$CLAUDE" ]; then ok "Claude Code $("$CLAUDE" --version 2>/dev/null | head -1)"; else bad "Claude Code is missing: curl -fsSL https://claude.ai/install.sh | bash"; fi
CODEX=$(find_bin codex); [ -z "$CODEX" ] && [ -x /Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex ] && CODEX=/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex
[ -n "$CODEX" ] && ok "Codex" || warn "Codex is missing (optional): npm install -g @openai/codex"
[ -n "$(find_bin agy)" ] && ok "Antigravity (agy)" || warn "Antigravity is missing (optional): curl -fsSL https://antigravity.google/cli/install.sh | bash"
[ -n "$(find_bin gemini)" ] && ok "Gemini CLI" || warn "Gemini CLI is missing (optional, study and research): npm install -g @google/gemini-cli"

echo
echo "Claude Code plugins"
if [ -z "$CLAUDE" ]; then bad "Plugins cannot be installed without Claude Code."; exit 1; fi
PLUGINS=$("$CLAUDE" plugin list 2>/dev/null || true)
MARKETS=$("$CLAUDE" plugin marketplace list 2>/dev/null || true)
need_market() { # name repo
  if grep -q "$1" <<<"$MARKETS"; then ok "marketplace $1"; elif [ $CHECK = 1 ]; then warn "marketplace $1 is missing"; else "$CLAUDE" plugin marketplace add "$2" && ok "added marketplace $1" || bad "could not add marketplace $1"; fi
}
need_market claude-plugins-official anthropics/claude-plugins-official
need_market autoharness tigerless-labs/autoharness
if grep -q "autoharness@autoharness" <<<"$PLUGINS"; then ok "autoharness installed"
elif [ $CHECK = 1 ]; then warn "autoharness is missing"
else "$CLAUDE" plugin install autoharness@autoharness --scope user && ok "installed autoharness" || bad "could not install autoharness"; fi

[ $CHECK = 0 ] && [ $FAILED = 0 ] && { mkdir -p "$HOME/Library/Application Support/Agent Office"; touch "$HOME/Library/Application Support/Agent Office/.setup-done"; }
echo
if [ "${AO_FROM_BUILD:-}" = "1" ]; then echo "Done, building the app next."; elif [ "${AO_FROM_APP:-}" = "1" ]; then echo "Done."; else echo "Done. Next: bash mac/build.sh (Mac app) or node server.mjs. Sign in to the services in the app under Connections."; fi
exit $FAILED
