#!/bin/sh
#
# Renders public/og-image.jpg from og-image.html — the Open Graph card that
# WhatsApp, Facebook, iMessage and X show when a chammastore.com link is
# shared. The card is written as HTML because text laid out in CSS is the
# only way to typeset the tagline without shipping a font just for one
# image; headless Chrome turns it into a screenshot at exactly 1200x630.
#
# One image, one ratio: 1200x630 is what every renderer above crops from,
# and WhatsApp ignores previews whose file is much over ~300 KB, so the
# screenshot is flattened to JPEG and the size is asserted at the end.
#
# Run: frontend/scripts/make-og-image.sh   (after editing og-image.html)
#
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
FRONTEND=$(dirname "$SCRIPT_DIR")
OUT="$FRONTEND/public/og-image.jpg"

CHROME=""
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "$(command -v google-chrome 2>/dev/null || true)"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    CHROME="$candidate"
    break
  fi
done
[ -n "$CHROME" ] || { echo "No Chrome found — install Google Chrome to render the card." >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# --virtual-time-budget lets the hero photograph and the logo finish
# loading before the screenshot is taken; without it the card can render
# with an empty photo layer.
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --hide-scrollbars \
  --force-device-scale-factor=1 \
  --window-size=1200,630 \
  --virtual-time-budget=6000 \
  --screenshot="$TMP/og.png" \
  "file://$SCRIPT_DIR/og-image.html" 2>/dev/null

# formatOptions takes a 0-100 quality; 84 keeps the marble and the gold
# hairlines clean while staying under WhatsApp's weight ceiling.
sips -s format jpeg -s formatOptions 84 "$TMP/og.png" --out "$OUT" >/dev/null 2>&1

WIDTH=$(sips -g pixelWidth "$OUT" | awk '/pixelWidth/ {print $2}')
SIZE=$(stat -f%z "$OUT")
echo "og-image.jpg: ${WIDTH}px wide, $SIZE bytes"
[ "$WIDTH" = "1200" ] || { echo "wrong width — og-image.html changed size?" >&2; exit 1; }
[ "$SIZE" -lt 300000 ] || { echo "over 300 KB — lower formatOptions" >&2; exit 1; }
