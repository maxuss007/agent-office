#!/bin/bash
# Builds "Agent Office.dmg": opening it shows a window with the app, an arrow and the Applications folder to drag it into,
# and a short note on opening an app that is not notarized. Setup (scripts/setup.sh) runs inside the app on its first launch,
# so macOS asks for approval only once.
# Usage: bash mac/make-dmg.sh            build the app (without installing) and package it
#        bash mac/make-dmg.sh --reuse    package the app already in mac/build/
set -euo pipefail
cd "$(dirname "$0")"
APP="build/Agent Office.app"; VOL="Agent Office"; OUT="build/Agent Office.dmg"
[[ "${1:-}" == "--reuse" && -d "$APP" ]] || AO_SKIP_SETUP=1 bash build.sh --no-install

STAGE=build/dmg; rm -rf "$STAGE"; mkdir -p "$STAGE/.background"
ditto "$APP" "$STAGE/Agent Office.app"
ln -s /Applications "$STAGE/Aplikace"
# the quarantine command as a text file, so it can be copied (the window background is only a picture)
cat > "$STAGE/Příkaz pro Terminál.txt" <<'TXT'
Agent Office se nedá otevřít?

macOS blokuje aplikace stažené z internetu, které nejsou notarizované u Apple.
Stačí to vyřešit jednou, jedním z těchto dvou způsobů.

1) Nastavení systému → Soukromí a zabezpečení → sjeď dolů a u Agent Office klikni na „Přesto otevřít“.
   Potvrď heslem nebo Touch ID.

2) Otevři Terminál (Aplikace → Utility → Terminál), vlož tenhle řádek a stiskni Enter:

xattr -dr com.apple.quarantine "/Applications/Agent Office.app"

Příkaz jen odstraní značku „staženo z internetu“ z aplikace Agent Office. Nic jiného nemění.
Pak Agent Office normálně otevři ze složky Aplikace.
TXT
swiftc -O -swift-version 5 make-dmg-background.swift -o build/make-dmg-background
build/make-dmg-background "$STAGE/.background/bg.png"
sips -s dpiWidth 144 -s dpiHeight 144 "$STAGE/.background/bg.png" >/dev/null

# read-write image, lay out the window in Finder, then compress
rm -f build/rw.dmg "$OUT"
hdiutil detach "/Volumes/$VOL" -force >/dev/null 2>&1 || true
hdiutil create -volname "$VOL" -srcfolder "$STAGE" -ov -fs HFS+ -format UDRW build/rw.dmg >/dev/null
DEV=$(hdiutil attach -readwrite -noverify -noautoopen build/rw.dmg | awk '/Apple_HFS/{print $1; exit}')
sleep 1
osascript <<EOF || echo "Rozložení okna se nepodařilo nastavit (Finder nepovolil automatizaci); DMG funguje i tak."
tell application "Finder"
  tell disk "$VOL"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {200, 120, 860, 700}
    set opts to the icon view options of container window
    set arrangement of opts to not arranged
    set icon size of opts to 96
    set text size of opts to 13
    set background picture of opts to file ".background:bg.png"
    set position of item "Agent Office.app" of container window to {170, 110}
    set position of item "Aplikace" of container window to {490, 110}
    set position of (first item of container window whose name ends with ".txt") to {330, 446}
    update without registering applications
    delay 1
    close
  end tell
end tell
EOF
sync
hdiutil detach "$DEV" >/dev/null || hdiutil detach "$DEV" -force >/dev/null
hdiutil convert build/rw.dmg -format UDZO -imagekey zlib-level=9 -o "$OUT" >/dev/null
rm -f build/rw.dmg; rm -rf "$STAGE"
echo "DMG: $PWD/$OUT"
