#!/usr/bin/env bash
# Deploy slayentertainment.co, with a guard against the wrong Cloudflare account.
#
# Why this script exists rather than a plain `wrangler pages deploy`: Pages
# configs do not support "account_id", so the normal pin is not available. And a
# wrong-account deploy does not fail loudly. Wrangler creates a fresh project on
# whatever account the active login owns, reports success, and leaves the real
# site untouched. The active login drifts, it changed accounts mid-session on
# 21 Jul 2026 because another terminal logged in.

set -euo pipefail

EXPECTED_ACCOUNT="b79e5ffc7dea03372b7653560c04a6c4"
PROJECT="slay-entertainment"
CREDS="$HOME/.config/slay-cf.env"

cd "$(dirname "$0")"

if [ ! -f "$CREDS" ]; then
  echo "No credentials at $CREDS."
  echo "Create an API token on the Slayentertainmentco Cloudflare account with"
  echo "Cloudflare Pages: Edit plus Account Settings: Read, then save it there as"
  echo "CLOUDFLARE_API_TOKEN= and CLOUDFLARE_ACCOUNT_ID=, chmod 600."
  exit 1
fi

set -a; . "$CREDS"; set +a

if [ "${CLOUDFLARE_ACCOUNT_ID:-}" != "$EXPECTED_ACCOUNT" ]; then
  echo "REFUSING TO DEPLOY."
  echo "  $CREDS points at account ${CLOUDFLARE_ACCOUNT_ID:-<unset>}"
  echo "  this project belongs to      $EXPECTED_ACCOUNT"
  exit 1
fi

# Confirm the token actually reaches that account, not just that the file says so.
# Parsed as JSON on purpose. The first version grepped for '"success":true' and
# always failed, because Cloudflare pretty-prints the response as
# '"success": true' with a space. A grep that cannot match is indistinguishable
# from a real failure, so gate on a parser, never on a string match.
reachable=$(curl -s -m 15 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$EXPECTED_ACCOUNT/pages/projects/$PROJECT" \
  | python3 -c "
import json,sys
try:
    d = json.load(sys.stdin)
    print('1' if d.get('success') and (d.get('result') or {}).get('name') == '$PROJECT' else '0')
except Exception:
    print('0')
")

if [ "$reachable" != "1" ]; then
  echo "REFUSING TO DEPLOY: the token cannot see project '$PROJECT' on $EXPECTED_ACCOUNT."
  echo "Either the token lacks Cloudflare Pages access or it belongs to another account."
  exit 1
fi

echo "Account verified: $EXPECTED_ACCOUNT, project $PROJECT reachable."
npx wrangler pages deploy . --project-name "$PROJECT" --branch main --commit-dirty=true

echo
echo "Deployed. Now VERIFY THE CHANGED BEHAVIOUR, not just that the site loads:"
echo "  node scripts/verify-live-spam-guard.mjs"
