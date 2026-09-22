#!/usr/bin/env bash
# Assemble the static runtime package for Cloudflare Pages direct uploads.
#
# Usage:
#   scripts/prepare-pages-dist.sh [output-directory]
#   scripts/prepare-pages-dist.sh --skip-3d-build [output-directory]
#
# The output intentionally contains only browser runtime files. Do not deploy
# the repository root: it also contains Blender sources, experiments, docs,
# tests, and local dependencies.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
skip_3d_build=false
output_dir=""

for argument in "$@"; do
    case "$argument" in
        --skip-3d-build) skip_3d_build=true ;;
        --help|-h)
            sed -n '2,8p' "$0"
            exit 0
            ;;
        -*)
            printf 'Unknown option: %s\n' "$argument" >&2
            exit 2
            ;;
        *)
            if [[ -n "$output_dir" ]]; then
                printf 'Only one output directory may be specified.\n' >&2
                exit 2
            fi
            output_dir="$argument"
            ;;
    esac
done

output_dir="${output_dir:-$repo_root/pages-dist}"
if [[ "$output_dir" != /* ]]; then
    output_dir="$repo_root/$output_dir"
fi

case "$output_dir" in
    "$repo_root"|"$repo_root"/*)
        ;;
    *)
        printf 'Output directory must be inside the repository: %s\n' "$output_dir" >&2
        exit 2
        ;;
esac

if [[ "$skip_3d_build" == false ]]; then
    npm --prefix "$repo_root/views/3d" run build
fi

for required_file in \
    index.html \
    style.css \
    views/2d/WoodcutRenderer.js \
    views/3d/ThreeBattleMapView.js \
    views/3d/integrated/hex-three.js \
    assets/3d/models/manifest.json; do
    if [[ ! -f "$repo_root/$required_file" ]]; then
        printf 'Required runtime file is missing: %s\n' "$required_file" >&2
        exit 1
    fi
done

# This target is explicitly the generated release directory selected above.
rm -rf "$output_dir"
mkdir -p "$output_dir/views/3d/integrated"

cp "$repo_root/index.html" "$repo_root/style.css" "$output_dir/"
for optional_file in CNAME .nojekyll; do
    if [[ -f "$repo_root/$optional_file" ]]; then
        cp "$repo_root/$optional_file" "$output_dir/"
    fi
done

cp -R "$repo_root/imgs" "$repo_root/audio" "$repo_root/js" \
    "$repo_root/styles" "$repo_root/assets" "$output_dir/"
mkdir -p "$output_dir/views"
cp -R "$repo_root/views/2d" "$output_dir/views/"
cp "$repo_root/views/3d/ThreeBattleMapView.js" "$output_dir/views/3d/"
cp "$repo_root/views/3d/integrated/hex-three.js" "$output_dir/views/3d/integrated/"

file_count="$(find "$output_dir" -type f | wc -l | tr -d ' ')"
package_size="$(du -sh "$output_dir" | awk '{print $1}')"
printf 'Prepared Cloudflare Pages release: %s (%s files, %s)\n' \
    "$output_dir" "$file_count" "$package_size"
