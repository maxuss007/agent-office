#!/bin/bash
# Builds "Agent Office.app" (SwiftUI-free AppKit + WKWebView shell around the bundled node server).
# Usage: ./build.sh               build, install to /Applications (or ~/Applications) and launch
#        ./build.sh --no-install  only build into mac/build/
set -euo pipefail
cd "$(dirname "$0")"
ROOT=..
APP="build/Agent Office.app"

# --- first install: check the tools and install the Claude Code plugins the office needs (once per Mac)
SETUP_MARK="$HOME/Library/Application Support/Agent Office/.setup-done"
if [ ! -f "$SETUP_MARK" ] && [ "${AO_SKIP_SETUP:-}" != "1" ]; then
  echo "First install: checking tools and installing plugins (scripts/setup.sh)…"
  if AO_FROM_BUILD=1 bash "$ROOT/scripts/setup.sh"; then mkdir -p "$(dirname "$SETUP_MARK")"; touch "$SETUP_MARK"; else echo "Setup did not finish; building anyway. Run it later: bash scripts/setup.sh"; fi
  echo
fi
rm -rf "$APP"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/server"
# universal binary (Apple silicon + Intel) that runs on macOS 13 Ventura and newer; without -target swiftc
# builds for the macOS it runs on, and the app then refuses to start on older systems
MINOS=13.0
swiftc -O -swift-version 5 -target arm64-apple-macos$MINOS AgentOffice.swift -o build/AgentOffice-arm64
swiftc -O -swift-version 5 -target x86_64-apple-macos$MINOS AgentOffice.swift -o build/AgentOffice-x86_64
lipo -create build/AgentOffice-arm64 build/AgentOffice-x86_64 -output "$APP/Contents/MacOS/AgentOffice"; rm -f build/AgentOffice-arm64 build/AgentOffice-x86_64
cp Info.plist "$APP/Contents/"
cp setup.html "$APP/Contents/Resources/"   # first-launch screen that installs the tools
/usr/libexec/PlistBuddy -c "Set :LSMinimumSystemVersion $MINOS" "$APP/Contents/Info.plist"
# icon
rm -rf build/AppIcon.iconset
[ -f AppIcon.png ] || { echo "mac/AppIcon.png is missing"; exit 1; }
# the app icon: every size macOS asks for, then one .icns
mkdir -p build/AppIcon.iconset
for sz in 16 32 64 128 256 512 1024; do sips -z $sz $sz AppIcon.png --out "build/AppIcon.iconset/icon_${sz}x${sz}.png" >/dev/null; done
for sz in 16 32 128 256 512; do cp "build/AppIcon.iconset/icon_$((sz*2))x$((sz*2)).png" "build/AppIcon.iconset/icon_${sz}x${sz}@2x.png"; done
rm -f build/AppIcon.iconset/icon_64x64.png build/AppIcon.iconset/icon_1024x1024.png
iconutil -c icns build/AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"
# bundled server (no dependencies)
for f in server.mjs orchestrator.mjs claude-bridge.mjs providers.mjs provider-auth.mjs project-outputs.mjs claude-usage.mjs local-runner.mjs report.mjs updater.mjs i18n-server.mjs boss.md version.json; do cp "$ROOT/$f" "$APP/Contents/Resources/server/"; done
mkdir -p "$APP/Contents/Resources/server/scripts"
cp "$ROOT/scripts/claude-usage-pty.py" "$APP/Contents/Resources/server/scripts/"
cp "$ROOT/scripts/setup.sh" "$APP/Contents/Resources/server/scripts/"
cp "$ROOT/scripts/install.sh" "$ROOT/scripts/skill-packs.txt" "$APP/Contents/Resources/server/scripts/"
cp -R "$ROOT/roles" "$ROOT/presets" "$ROOT/public" "$APP/Contents/Resources/server/"
codesign --force --deep --sign - "$APP"
echo "Built: $PWD/$APP"
[[ "${1:-}" == "--no-install" ]] && exit 0

# --- install: /Applications (fallback ~/Applications), replace the old version, relaunch
DEST=/Applications
if ! ( [ -w "$DEST" ] && touch "$DEST/.ao-write-test" 2>/dev/null && rm -f "$DEST/.ao-write-test" ); then DEST="$HOME/Applications"; mkdir -p "$DEST"; fi
osascript -e 'tell application id "com.agentoffice.app" to quit' >/dev/null 2>&1 || true
for i in 1 2 3 4 5 6 7 8 9 10; do pgrep -x AgentOffice >/dev/null || break; sleep 0.5; done
pkill -x AgentOffice 2>/dev/null || true
rm -rf "$DEST/Agent Office.app"
ditto "$APP" "$DEST/Agent Office.app"
xattr -dr com.apple.quarantine "$DEST/Agent Office.app" 2>/dev/null || true   # built locally: nothing to quarantine, but be safe

# --- move user data that still lives in the repo into Application Support (never overwrites)
SUP="$HOME/Library/Application Support/Agent Office"; mkdir -p "$SUP/projects"
for f in profile.md; do [ -f "$ROOT/$f" ] && [ ! -f "$SUP/$f" ] && cp "$ROOT/$f" "$SUP/$f"; done
if [ -d "$ROOT/projects" ]; then for d in "$ROOT"/projects/*/; do [ -d "$d" ] || continue; n=$(basename "$d"); [ -e "$SUP/projects/$n" ] || cp -R "$d" "$SUP/projects/$n"; done; fi

/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$DEST/Agent Office.app" >/dev/null 2>&1 || true
# macOS caches app icons: touch the bundle and restart the Dock so a new icon shows up right away
touch "$DEST/Agent Office.app" "$DEST/Agent Office.app/Contents/Info.plist"
killall Dock >/dev/null 2>&1 || true
echo "Installed: $DEST/Agent Office.app"
open "$DEST/Agent Office.app"
