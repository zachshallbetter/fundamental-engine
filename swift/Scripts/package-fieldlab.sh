#!/bin/zsh
# Package FieldLab as a proper macOS app bundle and (re)launch it.
#   swift/Scripts/package-fieldlab.sh [--no-launch]
set -euo pipefail
cd "$(dirname "$0")/.."

swift build -c release --product FieldLab

APP=dist/FieldLab.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .build/release/FieldLab "$APP/Contents/MacOS/FieldLab"
# the SPM resource bundle carries the locked 64-recipe canon (Bundle.module)
cp -R .build/release/FieldUI_FieldUICore.bundle "$APP/Contents/MacOS/"
cp -R .build/release/FieldUI_FieldUICore.bundle "$APP/Contents/Resources/"

cat > "$APP/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>FieldLab</string>
  <key>CFBundleDisplayName</key><string>FieldLab</string>
  <key>CFBundleIdentifier</key><string>com.field-ui.fieldlab</string>
  <key>CFBundleExecutable</key><string>FieldLab</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
EOF

echo "packaged → $APP"
if [[ "${1:-}" != "--no-launch" ]]; then
  pkill -x FieldLab 2>/dev/null || true
  sleep 0.5
  open "$APP"
  echo "launched"
fi
