#!/usr/bin/env bash
# RC-8 assistive-technology pass: Orca (a real screen reader) over Chrome on a virtual display,
# utterances captured from Orca's own debug log. Usage: orca_pass.sh <url> <label> [seconds]
set -u
URL="$1"; LABEL="$2"; SECS="${3:-75}"
OUT=/ai/tmp/fe-a11y/$LABEL; mkdir -p "$OUT"; rm -f "$OUT"/*
export DISPLAY=:99 XAUTHORITY=/ai/tmp/fe-a11y/Xauthority
export GTK_MODULES=gail:atk-bridge ACCESSIBILITY_ENABLED=1 GNOME_ACCESSIBILITY=1 NO_AT_BRIDGE=0
# Orca's speech goes through speech-dispatcher; this host has no audio device and a wedged speechd
# hung Orca's init for the whole run (2026-09-11). Point the SSIP client at a refused port so init
# fails fast — Orca then logs every utterance itself ("SPEECH OUTPUT: '…'"), which is the exact text
# the synthesizer would have spoken.
export SPEECHD_ADDRESS=inet_socket:127.0.0.1:1
pkill -f "/usr/bin/orca" 2>/dev/null; pkill -f "user-data-dir=/ai/tmp/fe-a11y/profile" 2>/dev/null
pkill -x openbox 2>/dev/null; pkill -x Xvfb 2>/dev/null; pkill -x speech-dispatch 2>/dev/null; sleep 1
Xvfb :99 -screen 0 1600x900x24 -nolisten tcp > "$OUT/xvfb.log" 2>&1 &
sleep 1.5
# a window manager: without one nothing owns focus, Chrome never becomes the active window, and Orca has no focus events to follow
openbox > "$OUT/openbox.log" 2>&1 &
sleep 1
eval "$(dbus-launch --sh-syntax)"; export DBUS_SESSION_BUS_ADDRESS
/usr/libexec/at-spi-bus-launcher --launch-immediately > "$OUT/atspi.log" 2>&1 &
sleep 1
orca --replace --disable splash-window,main-window --debug-file="$OUT/orca-debug.log" > "$OUT/orca.log" 2>&1 &
for i in $(seq 1 40); do grep -q "ORCA: Initialized" "$OUT/orca-debug.log" 2>/dev/null && break; sleep 1; done
echo "orca initialized after ${i}s: $(grep -c 'ORCA: Initialized' "$OUT/orca-debug.log")"
# Chrome with the renderer accessibility tree forced on (what a screen reader consumes); launched AFTER Orca is up so Orca sees the window activate
google-chrome --no-sandbox --disable-dev-shm-usage --force-renderer-accessibility --no-first-run --disable-features=TranslateUI --user-data-dir=/ai/tmp/fe-a11y/profile-$LABEL --window-size=1600,900 --window-position=0,0 "$URL" > "$OUT/chrome.log" 2>&1 &
sleep 8
WID=$(xdotool search --onlyvisible --class chrome | head -1)
xdotool windowactivate --sync "$WID" 2>/dev/null; xdotool windowfocus --sync "$WID" 2>/dev/null; xdotool windowraise "$WID" 2>/dev/null
sleep 2
# click into the document so the web content (not the toolbar) owns keyboard focus
xdotool mousemove 800 520 click 1; sleep 1.5
xdotool key --clearmodifiers ctrl+Home; sleep 1
# 1) Orca "Say All" from the top: KP_Add (desktop layout) / Insert+semicolon (laptop layout)
xdotool key --clearmodifiers KP_Add; sleep 2; xdotool key --clearmodifiers Insert+semicolon; sleep $((SECS/2))
# 2) keyboard navigation: Tab through the focus order (what a keyboard/AT user actually travels)
for i in $(seq 1 25); do xdotool key --clearmodifiers Tab; sleep 0.7; done
# 3) browse-mode line reading: Down arrow through content
for i in $(seq 1 25); do xdotool key --clearmodifiers Down; sleep 0.5; done
sleep 3
# the AT-SPI tree as the screen reader sees it (the same bus Orca reads)
python3 /ai/tmp/fe-a11y/atspi_walk.py > "$OUT/atspi-tree.txt" 2> "$OUT/atspi-walk.err" || true
# harvest the utterances (in order)
grep -oE "SPEECH OUTPUT: '.*'" "$OUT/orca-debug.log" | sed -E "s/^SPEECH OUTPUT: '//; s/'$//" > "$OUT/announcements.txt"
echo "announcements: $(wc -l < "$OUT/announcements.txt")  tree lines: $(wc -l < "$OUT/atspi-tree.txt")  window: ${WID:-none}  active-app events: $(grep -c 'window:activate' "$OUT/orca-debug.log")"
pkill -f "user-data-dir=/ai/tmp/fe-a11y/profile" 2>/dev/null; pkill -f "/usr/bin/orca" 2>/dev/null; pkill -x openbox 2>/dev/null; pkill -x Xvfb 2>/dev/null; kill "$DBUS_SESSION_BUS_PID" 2>/dev/null
