#!/usr/bin/env bash
# Packages the extension.
#   ./build.sh            -> dist/moolchand-backlink-builder-<version>.zip
#   ./build.sh --crx      -> also builds a signed .crx (needs Chrome/Chromium)
#
# The signing key is written to dist/key.pem on first run. Keep that file:
# it fixes the extension ID for every future .crx you build. Never commit it.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(grep -o '"version": *"[^"]*"' manifest.json | head -1 | cut -d'"' -f4)
NAME="moolchand-backlink-builder-${VERSION}"
DIST="dist"
STAGE="${DIST}/${NAME}"

rm -rf "$STAGE" "${DIST}/${NAME}.zip"
mkdir -p "$STAGE"

# Only ship runtime files.
cp manifest.json popup.html popup.css popup.js options.html options.js background.js "$STAGE/"
cp -r data lib icons "$STAGE/"
rm -f "$STAGE/icons/icon.svg"

( cd "$STAGE" && zip -qr "../${NAME}.zip" . -x '.*' )
echo "built ${DIST}/${NAME}.zip"

if [[ "${1:-}" == "--crx" ]]; then
  CHROME=""
  for c in "${CHROME_BIN:-}" /opt/pw-browsers/chromium google-chrome chromium chromium-browser \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
    if [[ -n "$c" ]] && command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
  done
  if [[ -z "$CHROME" ]]; then
    echo "No Chrome/Chromium binary found - skipping .crx (set CHROME_BIN=/path/to/chrome)" >&2
    exit 0
  fi
  if [[ -f "${DIST}/key.pem" ]]; then
    "$CHROME" --pack-extension="$PWD/$STAGE" --pack-extension-key="$PWD/${DIST}/key.pem" --no-sandbox >/dev/null 2>&1 || true
  else
    "$CHROME" --pack-extension="$PWD/$STAGE" --no-sandbox >/dev/null 2>&1 || true
    [[ -f "${STAGE}.pem" ]] && mv -f "${STAGE}.pem" "${DIST}/key.pem"
  fi
  if [[ -f "${STAGE}.crx" ]]; then
    [[ "${STAGE}.crx" != "${DIST}/${NAME}.crx" ]] && mv "${STAGE}.crx" "${DIST}/${NAME}.crx"
    echo "built ${DIST}/${NAME}.crx (key: ${DIST}/key.pem)"
  else
    echo "crx packing failed - use the .zip instead" >&2
  fi
fi
