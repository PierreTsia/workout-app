#!/usr/bin/env sh
# Regenerate the /connect/* Open Graph cards (1200x630).
#
# Requires ImageMagick (`magick`). Client logos are the committed SVGs in
# src/assets/connect/logos/. Hermes and the agent page are text-only (no brand
# logo). Run from anywhere: `sh scripts/generate-connect-og.sh`.
set -eu

cd "$(dirname "$0")/.." # -> web/

BG='#0f0f13'
ACC='#00c9a7'
WHITE='#fafafa'
MUTED='#a1a1aa'
LOGOS='src/assets/connect/logos'
OUT='public/og'
mkdir -p "$OUT"

# Black-on-transparent logo SVG -> white PNG.
white() {
  magick -background none "$1" -resize 150x150 -channel RGB -negate +channel "$2"
}
white "$LOGOS/claude.svg" /tmp/og-claude.png
white "$LOGOS/cursor.svg" /tmp/og-cursor.png
white "$LOGOS/le-chat.svg" /tmp/og-le-chat.png

compose_logo() { # out, logo-png, title
  magick -size 1200x630 xc:"$BG" \
    \( "$2" \) -gravity North -geometry +0+205 -composite \
    -gravity North -fill "$ACC" -font Arial-Bold -pointsize 34 -annotate +0+92 'GymLogic' \
    -gravity North -fill "$WHITE" -font Arial-Bold -pointsize 64 -annotate +0+420 "$3" \
    -gravity North -fill "$MUTED" -font Arial -pointsize 30 -annotate +0+520 'MCP connector setup' \
    "$1"
}

compose_text() { # out, title
  magick -size 1200x630 xc:"$BG" \
    -gravity North -fill "$ACC" -font Arial-Bold -pointsize 34 -annotate +0+92 'GymLogic' \
    -gravity North -fill "$WHITE" -font Arial-Bold -pointsize 72 -annotate +0+300 "$2" \
    -gravity North -fill "$MUTED" -font Arial -pointsize 30 -annotate +0+410 'MCP connector setup' \
    "$1"
}

compose_logo "$OUT/connect-claude.png" /tmp/og-claude.png 'Connect to Claude'
compose_logo "$OUT/connect-cursor.png" /tmp/og-cursor.png 'Connect to Cursor'
compose_logo "$OUT/connect-le-chat.png" /tmp/og-le-chat.png 'Connect to Le Chat'
compose_text "$OUT/connect-hermes.png" 'Connect to Hermes'
compose_text "$OUT/connect-agent.png" 'Connect any agent'

echo "Wrote $OUT/connect-{claude,cursor,le-chat,hermes,agent}.png"
