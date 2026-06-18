#!/bin/zsh
# Build, sign, package, notarize, and staple FieldLab as a distributable macOS .dmg.
#
#   swift/Scripts/release-fieldlab.sh
#
# Environment (from CI secrets or your local keychain):
#   FIELDLAB_VERSION   version string stamped into the bundle + dmg name (default 0.1.0)
#   SIGN_IDENTITY      "Developer ID Application: Your Name (TEAMID)" — required to SIGN.
#                      Omit it and you get an UNSIGNED .app/.dmg (dev preview: right-click → Open).
#   Notarization (only runs if SIGN_IDENTITY is set AND one of these is provided):
#     NOTARY_PROFILE   a `notarytool store-credentials` keychain profile name, OR
#     NOTARY_APPLE_ID + NOTARY_PASSWORD (app-specific) + NOTARY_TEAM_ID
#
# Output: dist/FieldLab-<version>.dmg  (+ dist/FieldLab.app)
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${FIELDLAB_VERSION:-0.1.0}"
APP="dist/FieldLab.app"
DMG="dist/FieldLab-${VERSION}.dmg"
mkdir -p dist

# ── 1. build + assemble the .app bundle ──────────────────────────────────────
echo "▸ building FieldLab ($VERSION)…"
swift build -c release --product FieldLab
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .build/release/FieldLab "$APP/Contents/MacOS/FieldLab"
# the SPM resource bundle carries the locked 64-recipe canon (Bundle.module) — next to the
# executable (SPM lookup) and in Resources (app convention).
cp -R .build/release/FieldUI_FieldUICore.bundle "$APP/Contents/MacOS/"
cp -R .build/release/FieldUI_FieldUICore.bundle "$APP/Contents/Resources/"
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>FieldLab</string>
  <key>CFBundleDisplayName</key><string>Field Lab</string>
  <key>CFBundleIdentifier</key><string>com.fundamental-engine.fieldlab</string>
  <key>CFBundleExecutable</key><string>FieldLab</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
EOF
echo "  bundled → $APP"

# ── 2. codesign (hardened runtime + secure timestamp — notarization prerequisites) ──
if [[ -n "${SIGN_IDENTITY:-}" ]]; then
  echo "▸ signing as: $SIGN_IDENTITY"
  codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP"
  codesign --verify --strict --verbose=2 "$APP"
else
  echo "⚠ no SIGN_IDENTITY — UNSIGNED build (dev preview only: right-click → Open to bypass Gatekeeper)"
fi

# ── 3. .dmg ──────────────────────────────────────────────────────────────────
echo "▸ creating $DMG"
rm -f "$DMG"
hdiutil create -volname "Field Lab" -srcfolder "$APP" -ov -format UDZO "$DMG" >/dev/null
[[ -n "${SIGN_IDENTITY:-}" ]] && codesign --force --timestamp --sign "$SIGN_IDENTITY" "$DMG"

# ── 4. notarize + staple ─────────────────────────────────────────────────────
if [[ -n "${SIGN_IDENTITY:-}" && ( -n "${NOTARY_PROFILE:-}" || -n "${NOTARY_APPLE_ID:-}" ) ]]; then
  echo "▸ submitting to Apple notary service (this waits for the verdict)…"
  if [[ -n "${NOTARY_PROFILE:-}" ]]; then
    xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait
  else
    xcrun notarytool submit "$DMG" \
      --apple-id "$NOTARY_APPLE_ID" --password "$NOTARY_PASSWORD" --team-id "$NOTARY_TEAM_ID" --wait
  fi
  xcrun stapler staple "$DMG"
  xcrun stapler validate "$DMG"
  echo "✓ signed + notarized + stapled → $DMG"
else
  echo "✓ packaged → $DMG  (unsigned / un-notarized — set SIGN_IDENTITY + NOTARY_* to ship)"
fi
