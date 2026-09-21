#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"

cargo build --release --target wasm32-unknown-unknown \
  --bin hussite-battlefield-poc \
  --bin real_terrain \
  --bin moving_battlefield \
  --bin diorama \
  --bin army_benchmark \
  --bin sudomer_battle
mkdir -p web/dist/assets
wasm-bindgen \
  --out-name hussite_battlefield \
  --out-dir web/dist \
  --target web \
  target/wasm32-unknown-unknown/release/hussite-battlefield-poc.wasm
wasm-bindgen \
  --out-name real_terrain \
  --out-dir web/dist \
  --target web \
  target/wasm32-unknown-unknown/release/real_terrain.wasm
wasm-bindgen \
  --out-name moving_battlefield \
  --out-dir web/dist \
  --target web \
  target/wasm32-unknown-unknown/release/moving_battlefield.wasm
battlefield_version="$(shasum -a 256 web/dist/hussite_battlefield_bg.wasm | cut -c1-12)"
sed "s/BATTLEFIELD_VERSION/$battlefield_version/g" web/battlefield-study.html > web/dist/battlefield-study.html
legacy_version="$(shasum -a 256 web/dist/moving_battlefield_bg.wasm | cut -c1-12)"
sed "s/BATTLEFIELD_VERSION/$legacy_version/g" web/battlefield.html > web/dist/battlefield.html
wasm-bindgen \
  --out-name diorama \
  --out-dir web/dist \
  --target web \
  target/wasm32-unknown-unknown/release/diorama.wasm
diorama_version="$(shasum -a 256 web/dist/diorama_bg.wasm | cut -c1-12)"
sed "s/DIORAMA_VERSION/$diorama_version/g" web/diorama.html > web/dist/diorama.html
wasm-bindgen \
  --out-name army_benchmark \
  --out-dir web/dist \
  --target web \
  target/wasm32-unknown-unknown/release/army_benchmark.wasm
wasm-bindgen \
  --out-name sudomer_battle \
  --out-dir web/dist \
  --target web \
  target/wasm32-unknown-unknown/release/sudomer_battle.wasm
sudomer_battle_version="$(shasum -a 256 web/dist/sudomer_battle_bg.wasm | cut -c1-12)"
sed "s/SUDOMER_BATTLE_VERSION/$sudomer_battle_version/g" web/sudomer-battle.html > web/dist/sudomer-battle.html
army_benchmark_version="$(shasum -a 256 web/dist/army_benchmark_bg.wasm | cut -c1-12)"
sed "s/ARMY_BENCHMARK_VERSION/$army_benchmark_version/g" web/army-benchmark.html > web/dist/army-benchmark.html
cargo build --release --target wasm32-unknown-unknown \
  --no-default-features \
  --features browser-50k \
  --bin army_benchmark
wasm-bindgen \
  --out-name army_benchmark_webgl_50k \
  --out-dir web/dist \
  --target web \
  target/wasm32-unknown-unknown/release/army_benchmark.wasm
army_benchmark_webgl_50k_version="$(shasum -a 256 web/dist/army_benchmark_webgl_50k_bg.wasm | cut -c1-12)"
sed "s/ARMY_BENCHMARK_WEBGL_50K_VERSION/$army_benchmark_webgl_50k_version/g" web/army-benchmark-webgl-50k.html > web/dist/army-benchmark-webgl-50k.html
cargo build --release --target wasm32-unknown-unknown \
  --features browser-webgpu,browser-50k \
  --bin army_benchmark
wasm-bindgen \
  --out-name army_benchmark_webgpu \
  --out-dir web/dist \
  --target web \
  target/wasm32-unknown-unknown/release/army_benchmark.wasm
army_benchmark_webgpu_version="$(shasum -a 256 web/dist/army_benchmark_webgpu_bg.wasm | cut -c1-12)"
sed "s/ARMY_BENCHMARK_WEBGPU_VERSION/$army_benchmark_webgpu_version/g" web/army-benchmark-webgpu.html > web/dist/army-benchmark-webgpu.html
terrain_version="$(shasum -a 256 web/dist/real_terrain_bg.wasm | cut -c1-12)"
sed "s/TERRAIN_VERSION/$terrain_version/g" web/index.html > web/dist/index.html
cp -R assets/. web/dist/assets/

echo "Built web/dist. Serve with: python3 -m http.server 8082 --bind 0.0.0.0 --directory web/dist"
