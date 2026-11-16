#!/bin/bash
# Publishes a new Agent Office version in one step:
#   1. bumps version.json (version, notes; with --shell also the Mac shell version)
#   2. copies the app's files into the public repo's checkout (the share copy), renaming the local bundle id
#   3. refuses to go on if the copy holds anything personal: home paths, your e-mail, tokens, your project names
#   4. runs the tests in the copy, commits and pushes to GitHub, so running apps offer the update
#   5. with --dmg (always with --shell) also builds the DMG and publishes it as a GitHub release
#
# Usage:  bash scripts/release.sh 1.2.0 "Co je nového"            push an update (apps download it themselves)
#         bash scripts/release.sh 1.2.0 "Co je nového" --dmg      also publish a new DMG release
#         bash scripts/release.sh 1.2.0 "Co je nového" --shell    mac/AgentOffice.swift changed: bump shell, new DMG
#         bash scripts/release.sh 1.2.0 "Co je nového" --dry-run  do everything except commit, push and release
# The public repo's checkout: AO_SHARE_DIR (default ../agent-office-sdileni/agent-office next to this folder).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-}"; NOTES="${2:-}"; shift $(( $# >= 2 ? 2 : $# ))
DMG=0; SHELLBUMP=0; DRY=0
for a in "$@"; do case "$a" in --dmg) DMG=1;; --shell) SHELLBUMP=1; DMG=1;; --dry-run) DRY=1;; *) echo "Neznámý přepínač: $a"; exit 2;; esac; done
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Použití: bash scripts/release.sh 1.2.0 \"Co je nového\" [--dmg|--shell|--dry-run]"; exit 2; }
[ -n "$NOTES" ] || { echo "Napiš krátce, co je nového (druhý argument)."; exit 2; }
SHARE="${AO_SHARE_DIR:-$ROOT/../agent-office-sdileni/agent-office}"
[ -d "$SHARE/.git" ] || { echo "Nenašel jsem checkout veřejného repozitáře: $SHARE (nastav AO_SHARE_DIR)"; exit 1; }
SHARE="$(cd "$SHARE" && pwd)"
[ "$SHARE" != "$ROOT" ] || { echo "AO_SHARE_DIR musí být jiná složka než ta, ve které vyvíjíš."; exit 1; }
say() { printf '\n\033[1m%s\033[0m\n' "$1"; }

say "1/5 Verze"
CUR=$(node -p "require('$ROOT/version.json').version")
node --input-type=module -e "import { newer } from '$ROOT/updater.mjs'; process.exit(newer('$VERSION', '$CUR') ? 0 : 1)" || { echo "Verze $VERSION není vyšší než současná $CUR."; exit 1; }
SHELLV=$(node -p "require('$ROOT/version.json').shell")
[ $SHELLBUMP = 1 ] && SHELLV=$((SHELLV + 1))
SWIFTV=$(sed -n 's/.*static let shellVersion = \([0-9]*\).*/\1/p' "$ROOT/mac/AgentOffice.swift")
[ "$SWIFTV" = "$SHELLV" ] || { echo "V mac/AgentOffice.swift je shellVersion = $SWIFTV, ale vydáváš shell $SHELLV. Sjednoť je (při změně Swiftu zvyš obojí a použij --shell)."; exit 1; }
git -C "$SHARE" diff --quiet && git -C "$SHARE" diff --cached --quiet || { echo "Ve $SHARE jsou necommitnuté změny. Nejdřív je vyřeš."; exit 1; }
[ $DRY = 1 ] || git -C "$SHARE" pull --ff-only -q
echo "$CUR → $VERSION (shell $SHELLV)"

say "2/5 Kopíruji soubory do veřejné kopie"
RS=(rsync -a --delete --exclude .DS_Store --exclude 'evidence-*' --exclude '.ledger.jsonl*' --exclude .sidecar.json)
for f in README.md README.cs.md .gitignore boss.md server.mjs orchestrator.mjs providers.mjs provider-auth.mjs claude-bridge.mjs claude-usage.mjs \
         local-runner.mjs project-outputs.mjs report.mjs updater.mjs; do cp "$ROOT/$f" "$SHARE/$f"; done
for d in roles presets scripts public/assets/suits; do mkdir -p "$SHARE/$d"; "${RS[@]}" "$ROOT/$d/" "$SHARE/$d/"; done
"${RS[@]}" --exclude office-motion.test.mjs "$ROOT/tests/" "$SHARE/tests/"
for f in index.html i18n.js pro.css game.css art.js avatars.js office-suits.js; do cp "$ROOT/public/$f" "$SHARE/public/$f"; done
for f in AgentOffice.swift build.sh Info.plist AppIcon.png make-dmg.sh make-dmg-background.swift; do cp "$ROOT/mac/$f" "$SHARE/mac/$f"; done
# files that are no longer part of the app (development leftovers)
rm -rf "$SHARE/art" "$SHARE/evals" "$SHARE/mac/make-icon.swift" "$SHARE/scripts/eval.mjs" "$SHARE/scripts/check-providers.mjs"
# skills for working on the app itself (they live next to the app or one level up in a larger repo)
SK=""; for c in "$ROOT/.claude/skills" "$ROOT/../.claude/skills"; do ls -d "$c"/agent-office-* >/dev/null 2>&1 && { SK="$c"; break; }; done
if [ -n "$SK" ] && [ "$SK" != "$SHARE/.claude/skills" ]; then
  mkdir -p "$SHARE/.claude/skills"
  for s in "$SK"/agent-office-*; do n=$(basename "$s"); [ "$n" = agent-office-share-copy ] && continue; "${RS[@]}" "$s/" "$SHARE/.claude/skills/$n/"; done
  for s in "$SHARE"/.claude/skills/agent-office-*; do [ -d "$SK/$(basename "$s")" ] || rm -rf "$s"; done
fi
# a personal bundle id (com.<name>.agentoffice) becomes the neutral one in the copy
LOCALID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$ROOT/mac/Info.plist")
if [ "$LOCALID" != com.agentoffice.app ]; then grep -rlIF "$LOCALID" "$SHARE" --exclude-dir=.git | while read -r f; do sed -i '' "s/${LOCALID//./\\.}/com.agentoffice.app/g" "$f"; done; fi
# version.json: the source of truth for updates (written to the copy, then back to this folder)
node -e '
const fs=require("fs");for(const p of process.argv.slice(1,3)){const v=JSON.parse(fs.readFileSync(p,"utf8"));
v.version=process.argv[3];v.shell=Number(process.argv[4]);v.notes=process.argv[5];fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n")}' \
  "$SHARE/version.json" "$SHARE/version.json" "$VERSION" "$SHELLV" "$NOTES"
[ $DRY = 1 ] || cp "$SHARE/version.json" "$ROOT/version.json"   # a dry run leaves your own version.json alone
[ -n "$(node -p "require('$SHARE/version.json').repo")" ] || { echo "Ve version.json chybí repo (jmeno/agent-office)."; exit 1; }
git -C "$SHARE" status --short | sed 's/^/  /'

say "3/5 Kontrola osobních údajů"
python3 -I - "$SHARE" "$LOCALID" "$(git config --global user.email 2>/dev/null || true)" <<'PY'
import json, os, re, sys, glob
share, localid, email = sys.argv[1], sys.argv[2], sys.argv[3]
home = os.path.expanduser('~'); sup = home + '/Library/Application Support/Agent Office'
pats = [re.escape(home + '/'), r'sk-ant-(?!oat\\d)[A-Za-z0-9_-]{8,}', r'sk-[A-Za-z0-9]{24,}', r'gh[pousr]_[A-Za-z0-9]{20,}', r'github_pat_\w{20,}',
        r'AIza[0-9A-Za-z_-]{30,}', r'ya29\.[\w-]{20,}', r'xox[abpr]-[\w-]{10,}', r'-----BEGIN [A-Z ]*PRIVATE KEY', r'eyJ[\w-]{20,}\.[\w-]{10,}\.']
if localid != 'com.agentoffice.app': pats.append(re.escape(localid))
if email: pats.append(re.escape(email))
# names of your own projects and offices: they must never reach the public copy
names = set()
def add(n):
    n = (n or '').strip()
    if len(n) >= 5: names.add(n)
try:
    r = json.load(open(sup + '/repos.json')); r = r if isinstance(r, list) else r.get('repos', [])
    for x in r: add(os.path.basename((x.get('path') or '').rstrip('/'))); add(x.get('name'))
except Exception: pass
for f in glob.glob(sup + '/projects/*/state.json'):
    try: add((json.load(open(f)).get('goal') or '')[:40])
    except Exception: pass
for d in (home + '/Agent Office',):
    if os.path.isdir(d): [add(n) for n in os.listdir(d)]
generic = {'office', 'server', 'skills', 'agent-office', 'tests', 'public', 'scripts', 'roles', 'presets', 'evals', 'claude', 'Projects', 'projekty', 'work', 'info'}
names = {n for n in names if n not in generic and not n.startswith('.')}
rx = re.compile('|'.join(pats))
hits = []
for root, dirs, files in os.walk(share):
    dirs[:] = [d for d in dirs if d != '.git']
    for fn in files:
        p = os.path.join(root, fn)
        if fn.endswith(('.png', '.jpg', '.icns', '.dmg', '.zip')): continue
        try: text = open(p, encoding='utf8').read()
        except Exception: continue
        rel = os.path.relpath(p, share)
        for m in rx.finditer(text): hits.append(f'{rel}: {m.group(0)[:40]}')
        low = text.lower()
        for n in names:
            if n.lower() in low: hits.append(f'{rel}: název tvého projektu „{n}“')
if hits:
    print('Ve veřejné kopii je něco osobního, nic jsem neodeslal:'); [print('  ' + h) for h in sorted(set(hits))[:40]]; sys.exit(1)
print(f'  čisté (prohledáno i {len(names)} názvů tvých projektů)')
PY

say "4/5 Testy"
(cd "$SHARE" && node --test tests/ 2>&1 | grep -E "^ℹ (pass|fail)") ; (cd "$SHARE" && node --test tests/ >/dev/null 2>&1) || { echo "Testy ve veřejné kopii neprošly, nic jsem neodeslal."; exit 1; }

say "5/5 Vydání"
if [ $DRY = 1 ]; then echo "Zkouška nanečisto: nic se necommitlo ani neodeslalo. Změny ve $SHARE vrátíš: git -C \"$SHARE\" checkout -- . && git -C \"$SHARE\" clean -fd"; exit 0; fi
git -C "$SHARE" add -A
git -C "$SHARE" commit -q -m "Agent Office $VERSION" -m "$NOTES" ${AO_COMMIT_TRAILER:+-m "$AO_COMMIT_TRAILER"}   # optional trailer, e.g. Co-Authored-By
git -C "$SHARE" push -q
echo "  pushnuto: běžící aplikace nabídnou aktualizaci do 6 hodin nebo po dalším spuštění"
if [ $DMG = 1 ]; then
  (cd "$SHARE" && bash mac/make-dmg.sh >/dev/null)
  REPO=$(node -p "require('$SHARE/version.json').repo")
  gh release create "v$VERSION" "$SHARE/mac/build/Agent Office.dmg#Agent Office.dmg (Mac, macOS 13+)" --repo "$REPO" --title "Agent Office $VERSION" \
    --notes "$NOTES"$'\n\n'"Stáhni \`Agent.Office.dmg\` níže, otevři ho a přetáhni Agent Office do složky Aplikace. Když macOS napíše, že aplikaci nemůže ověřit: Nastavení systému → Soukromí a zabezpečení → Přesto otevřít, nebo v Terminálu \`xattr -dr com.apple.quarantine \"/Applications/Agent Office.app\"\`."
  OUT="$(dirname "$SHARE")"; mv -f "$SHARE/mac/build/Agent Office.dmg" "$OUT/Agent Office.dmg"; rm -rf "$SHARE/mac/build"
  echo "  DMG vydané: https://github.com/$REPO/releases/tag/v$VERSION"
fi
OUT="$(dirname "$SHARE")"; (cd "$OUT" && rm -f agent-office.zip && zip -qr agent-office.zip "$(basename "$SHARE")" -x '*.DS_Store' "$(basename "$SHARE")/.git/*")
echo "Hotovo: Agent Office $VERSION."
