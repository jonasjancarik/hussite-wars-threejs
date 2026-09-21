#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
repo_dir="$(cd "$project_dir/../.." && pwd)"
renderer_dir="$repo_dir/views/3d"
cd "$project_dir"
dist_dir="${SUDOMER_HEX_DIST_DIR:-web/dist}"
stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/sudomer-hex-three.XXXXXX")"
trap 'trash "$stage_dir" 2>/dev/null || true' EXIT

npm --prefix "$renderer_dir" run build

mkdir -p "$stage_dir/hex-three" "$stage_dir/hex-diorama" "$stage_dir/assets"
cp "$renderer_dir/dist/hex-three.js" "$stage_dir/hex-three/hex-three.js"
cp "$renderer_dir/dist/sudomer-landscape.json" "$stage_dir/hex-three/sudomer-landscape.json"
cp -R web/hex-diorama/vendor "$stage_dir/hex-diorama/vendor"
cp web/hex-diorama/boot.js web/hex-diorama/bridge.js web/hex-diorama/panels.js web/hex-diorama/view.js web/hex-diorama/style.css web/hex-diorama/refinement.css web/hex-diorama/sudomer-art.json "$stage_dir/hex-diorama/"

cp -R "$repo_dir/assets/3d/models" "$repo_dir/assets/3d/textures" "$stage_dir/assets/"

version="$({ shasum -a 256 "$stage_dir/hex-three/hex-three.js" "$stage_dir/hex-three/sudomer-landscape.json"; find "$stage_dir/hex-diorama" "$stage_dir/assets/models" "$stage_dir/assets/textures" -type f -exec shasum -a 256 {} + | sort; } | shasum -a 256 | cut -c1-12)"
sed "s/SUDOMER_HEX_VERSION/$version/g" web/sudomer-hex.html > "$stage_dir/sudomer-hex.html"
cp "$stage_dir/sudomer-hex.html" "$stage_dir/sudomer-hex-three.html"

# Keep the old renderer as a separately named comparison when its existing
# Wasm build is available. This script never invokes Rust or overwrites the new
# default with a Bevy build.
bevy_source="web/dist"
if [[ -f "$bevy_source/sudomer_hex.js" && -f "$bevy_source/sudomer_hex_bg.wasm" ]]; then
  # The retained Bevy build requests the old logical model paths.
  python3 "$project_dir/scripts/prepare_shared_assets.py" --destination "$stage_dir/assets"
  cp "$bevy_source/sudomer_hex.js" "$stage_dir/sudomer_hex.js"
  cp "$bevy_source/sudomer_hex_bg.wasm" "$stage_dir/sudomer_hex_bg.wasm"
  [[ ! -f "$bevy_source/sudomer_hex.d.ts" ]] || cp "$bevy_source/sudomer_hex.d.ts" "$stage_dir/sudomer_hex.d.ts"
  [[ ! -f "$bevy_source/sudomer_hex_bg.wasm.d.ts" ]] || cp "$bevy_source/sudomer_hex_bg.wasm.d.ts" "$stage_dir/sudomer_hex_bg.wasm.d.ts"
  sed "s/SUDOMER_HEX_VERSION/$version/g" web/sudomer-hex-bevy.html > "$stage_dir/sudomer-hex-bevy.html"
fi

mkdir -p "$dist_dir"
cp -R "$stage_dir/." "$dist_dir/"
echo "Built $dist_dir/sudomer-hex.html ($version, Three.js WebGPU target)"
