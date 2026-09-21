#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"
cargo build --release --target wasm32-unknown-unknown --bin sudomer_battle
mkdir -p web/dist/assets
wasm-bindgen --out-name sudomer_battle --out-dir web/dist --target web target/wasm32-unknown-unknown/release/sudomer_battle.wasm
version="$(shasum -a 256 web/dist/sudomer_battle_bg.wasm | cut -c1-12)"
sed "s/SUDOMER_BATTLE_VERSION/$version/g" web/sudomer-battle.html > web/dist/sudomer-battle.html
cp -R assets/. web/dist/assets/
echo "Built web/dist/sudomer-battle.html"
