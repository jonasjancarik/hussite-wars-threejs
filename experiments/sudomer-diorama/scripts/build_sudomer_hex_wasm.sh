#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"
dist_dir="${SUDOMER_HEX_DIST_DIR:-web/dist}"

cargo build --release --target wasm32-unknown-unknown --bin sudomer_hex
mkdir -p "$dist_dir/hex-diorama" "$dist_dir/assets/models" "$dist_dir/assets/textures"
wasm-bindgen --out-name sudomer_hex --out-dir "$dist_dir" --target web target/wasm32-unknown-unknown/release/sudomer_hex.wasm

cp -R web/hex-diorama/vendor "$dist_dir/hex-diorama/"
cp web/hex-diorama/boot.js web/hex-diorama/bridge.js web/hex-diorama/panels.js web/hex-diorama/view.js web/hex-diorama/style.css web/hex-diorama/refinement.css web/hex-diorama/sudomer-art.json "$dist_dir/hex-diorama/"
for model in banner broadleaf_gold broadleaf_olive cavalry church cypress farmhouse infantry_handgun infantry_polearm infantry_shield stakes war_wagon; do
  cp "assets/models/$model.glb" "$dist_dir/assets/models/$model.glb"
done
cp assets/textures/painted-ground.png "$dist_dir/assets/textures/painted-ground.png"

version="$({ shasum -a 256 "$dist_dir/sudomer_hex_bg.wasm"; find "$dist_dir/hex-diorama" -type f -exec shasum -a 256 {} + | sort; } | shasum -a 256 | cut -c1-12)"
sed "s/SUDOMER_HEX_VERSION/$version/g" web/sudomer-hex-bevy.html > "$dist_dir/sudomer-hex-bevy.html"
echo "Built $dist_dir/sudomer-hex-bevy.html ($version, comparison renderer)"
