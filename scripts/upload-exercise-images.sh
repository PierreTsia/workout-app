#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGES_DIR="$PROJECT_ROOT/images"

SUPABASE_URL="${VITE_SUPABASE_URL:-}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$SUPABASE_URL" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "Usage:"
  echo "  VITE_SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... $0"
  echo ""
  echo "Get your service role key from: https://supabase.com/dashboard/project/_/settings/api"
  exit 1
fi

BUCKET="exercise-media"
SUCCESS=0
FAIL=0

for img in "$IMAGES_DIR"/*.png; do
  filename="$(basename "$img")"
  echo -n "Uploading $filename... "

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: image/png" \
    -H "x-upsert: true" \
    --data-binary "@${img}")

  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "OK"
    ((SUCCESS++))
  else
    echo "FAILED (HTTP $HTTP_CODE)"
    ((FAIL++))
  fi
done

echo ""
echo "Done: $SUCCESS uploaded, $FAIL failed"
echo ""
echo "Verify at: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/"
