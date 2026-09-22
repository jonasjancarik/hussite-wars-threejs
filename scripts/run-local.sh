#!/usr/bin/env bash
# Serve the game locally so JSON, audio, and 3D assets load over HTTP.
# Usage: scripts/run-local.sh [port]

set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    printf 'Usage: %s [port]\n' "${0##*/}"
    exit 0
fi

port="${1:-8000}"
if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
    printf 'Port must be an integer from 1 to 65535.\n' >&2
    exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
printf 'Serving Husitské války at http://localhost:%s\nPress Ctrl+C to stop.\n' "$port"
exec python3 -m http.server "$port" --directory "$repo_root"
