#!/usr/bin/env bash
# Build the 3D renderer, prepare pages-dist/, and publish it to Cloudflare Pages.
#
# Usage:
#   CLOUDFLARE_ACCOUNT_ID=<account-id> scripts/build-and-deploy-pages.sh
#   CLOUDFLARE_ACCOUNT_ID=<account-id> scripts/build-and-deploy-pages.sh --skip-3d-build

set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    sed -n '2,6p' "$0"
    exit 0
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
project_name="${CLOUDFLARE_PAGES_PROJECT:-hussite-wars-3d}"
: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID to the Cloudflare account that owns ${project_name}.}"

"$repo_root/scripts/prepare-pages-dist.sh" "$@"

exec npx --yes wrangler@latest pages deploy "$repo_root/pages-dist" \
    --project-name="$project_name" \
    --commit-dirty=true
