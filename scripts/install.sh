#!/bin/bash
# Agent Office – installs the tools it runs on, without Homebrew and without admin rights.
#
#   bash scripts/install.sh --status       one JSON line: what is installed and where
#   bash scripts/install.sh node           Node.js (official LTS build from nodejs.org, checksum verified,
#                                          unpacked into Application Support/Agent Office/runtime/node)
#   bash scripts/install.sh claude         Claude Code (official installer from claude.ai)
#   bash scripts/install.sh codex          Codex CLI (npm package @openai/codex into ~/.local)
#   bash scripts/install.sh gemini         Gemini CLI (npm package @google/gemini-cli into ~/.local)
#   bash scripts/install.sh antigravity    Antigravity CLI (official installer from antigravity.google)
#   bash scripts/install.sh plugins        Claude Code plugins the office uses (autoharness, official marketplace)
#   bash scripts/install.sh skills         general skills from scripts/skill-packs.txt that are missing (copied, never overwritten)
#
# The Mac app runs this from its first-launch screen and from Connections; nothing is installed without a click.
set -uo pipefail
SUP="${AGENT_OFFICE_HOME:-$HOME/Library/Application Support/Agent Office}"
RUNTIME="$SUP/runtime"
NODE_DIR="$RUNTIME/node"
export PATH="$NODE_DIR/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
find_bin() { for d in "$NODE_DIR/bin" "$HOME/.local/bin" /opt/homebrew/bin /usr/local/bin; do [ -x "$d/$1" ] && { echo "$d/$1"; return; }; done; command -v "$1" 2>/dev/null; }
json_str() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
item() { # name path version
  if [ -n "$2" ]; then printf '"%s":{"ok":true,"path":"%s","version":"%s"}' "$1" "$(json_str "$2")" "$(json_str "$3")"; else printf '"%s":{"ok":false}' "$1"; fi
}

PACKS="$(dirname "$0")/skill-packs.txt"
skill_dirs() { echo "$HOME/.claude/skills"; echo "$HOME/.agents/skills"; }
has_skill() { local sd; for sd in "$HOME/.claude/skills" "$HOME/.agents/skills"; do [ -f "$sd/$1/SKILL.md" ] && return 0; done; return 1; }
missing_packs() { grep -vE '^\s*(#|$)' "$PACKS" 2>/dev/null | while read -r repo sub marker rootname; do has_skill "$marker" || echo "$repo $sub $marker $rootname"; done; }
install_skills() {
  local dest="$HOME/.claude/skills" tmp added=0; tmp=$(mktemp -d); mkdir -p "$dest"
  local list; list=$(missing_packs)
  [ -n "$list" ] || { echo "All recommended skills are already installed."; rm -rf "$tmp"; return 0; }
  while read -r repo sub marker rootname; do
    [ -n "$repo" ] || continue
    local key; key=$(echo "$repo" | tr '/' '_')
    if [ ! -d "$tmp/$key" ]; then
      echo "Downloading $repo…"
      mkdir -p "$tmp/$key" && curl -fsSL "https://codeload.github.com/$repo/tar.gz/HEAD" | tar -xz -C "$tmp/$key" --strip-components 1 || { echo "  could not download $repo"; continue; }
    fi
    local base="$tmp/$key/$sub"
    if [ -n "$rootname" ]; then   # a single skill at the folder root
      if [ -f "$base/SKILL.md" ] && [ ! -e "$dest/$rootname" ]; then cp -R "$base" "$dest/$rootname"; rm -rf "$dest/$rootname/.git"; added=$((added + 1)); echo "  + $rootname"; fi
      continue
    fi
    for d in "$base"/*/; do
      local n; n=$(basename "$d")
      [ -f "$d/SKILL.md" ] || continue
      has_skill "$n" && continue
      cp -R "$d" "$dest/$n" && added=$((added + 1)) && echo "  + $n"
    done
  done <<< "$list"
  rm -rf "$tmp"; echo "Added $added skills to ~/.claude/skills."
}

status() {
  local node claude codex gemini agy py nodev="" pyv="" plug=false
  node=$(find_bin node); [ -n "$node" ] && nodev=$("$node" -v 2>/dev/null)
  [ -n "$node" ] && ! "$node" -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)' 2>/dev/null && node=""   # too old
  claude=$(find_bin claude)
  codex=$(find_bin codex); [ -z "$codex" ] && [ -x /Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex ] && codex=/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex
  gemini=$(find_bin gemini); agy=$(find_bin agy)
  py=$(find_bin python3); [ -n "$py" ] && pyv=$("$py" -c 'import sys;print("%d.%d"%sys.version_info[:2])' 2>/dev/null)
  [ -n "$py" ] && ! "$py" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null && py=""
  [ -n "$claude" ] && "$claude" plugin list 2>/dev/null | grep -q "autoharness@autoharness" && plug=true
  local miss; miss=$(missing_packs | awk '{print $1}' | sort -u | wc -l | tr -d ' ')
  printf '{%s,%s,%s,%s,%s,%s,"plugins":{"ok":%s},"skills":{"ok":%s,"missing":%s}}\n' "$(item node "$node" "$nodev")" "$(item claude "$claude" "")" "$(item codex "$codex" "")" \
    "$(item gemini "$gemini" "")" "$(item antigravity "$agy" "")" "$(item python "$py" "$pyv")" "$plug" "$([ "$miss" = 0 ] && echo true || echo false)" "$miss"
}

install_node() {
  local arch; arch=$(uname -m); [ "$arch" = arm64 ] || arch=x64
  echo "Finding the current Node.js LTS release…"
  local ver; ver=$(curl -fsSL https://nodejs.org/dist/index.json | /usr/bin/python3 -c 'import json,sys; print(next(x["version"] for x in json.load(sys.stdin) if x["lts"]))' 2>/dev/null)
  [ -n "$ver" ] || { echo "Could not reach nodejs.org."; return 1; }
  local name="node-$ver-darwin-$arch.tar.gz" tmp; tmp=$(mktemp -d)
  echo "Downloading $name…"
  curl -fsSL "https://nodejs.org/dist/$ver/$name" -o "$tmp/$name" && curl -fsSL "https://nodejs.org/dist/$ver/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt" || { echo "Download failed."; rm -rf "$tmp"; return 1; }
  (cd "$tmp" && grep " $name\$" SHASUMS256.txt | shasum -a 256 -c - >/dev/null) || { echo "Checksum does not match, nothing installed."; rm -rf "$tmp"; return 1; }
  mkdir -p "$RUNTIME" && rm -rf "$NODE_DIR.new" && mkdir -p "$NODE_DIR.new" && tar -xzf "$tmp/$name" -C "$NODE_DIR.new" --strip-components 1 || { echo "Unpacking failed."; rm -rf "$tmp" "$NODE_DIR.new"; return 1; }
  rm -rf "$NODE_DIR" && mv "$NODE_DIR.new" "$NODE_DIR"; rm -rf "$tmp"
  echo "Node.js $("$NODE_DIR/bin/node" -v) installed in $NODE_DIR"
}
npm_global() { # package
  local npm; npm=$(find_bin npm); [ -n "$npm" ] || { echo "Node.js is needed first."; return 1; }
  mkdir -p "$HOME/.local"
  echo "Installing $1 with npm into ~/.local…"
  "$npm" install -g --prefix "$HOME/.local" "$1" --no-fund --no-audit --no-update-notifier --loglevel=error 2>&1 | tail -5
  return "${PIPESTATUS[0]}"
}

case "${1:-}" in
  --status) status ;;
  node) install_node ;;
  claude) echo "Running the official Claude Code installer (claude.ai/install.sh)…"; curl -fsSL https://claude.ai/install.sh | bash ;;
  codex) npm_global @openai/codex ;;
  gemini) npm_global @google/gemini-cli ;;
  antigravity) echo "Running the official Antigravity installer (antigravity.google/cli/install.sh)…"; curl -fsSL https://antigravity.google/cli/install.sh | bash ;;
  plugins) AO_FROM_APP=1 bash "$(dirname "$0")/setup.sh" ;;
  skills) install_skills ;;
  *) sed -n '2,14p' "$0"; exit 2 ;;
esac
