#!/bin/sh
set -u

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
results_dir=${BATTLE_BENCH_RESULTS_DIR:-"$root/benchmark-results/flat-$(date +%Y%m%d-%H%M%S)"}
mkdir -p "$results_dir"

cargo build --release --bin army_benchmark --manifest-path "$root/Cargo.toml" || exit 1

printf '%s\n' "results_dir=$results_dir"
for soldiers in 2000 5000 10000 20000 50000; do
  printf '%s\n' "starting representation=flat soldiers_total=$soldiers"
  BATTLE_BENCH_REPRESENTATION=flat \
    BATTLE_BENCH_SOLDIERS=$soldiers \
    BATTLE_BENCH_OUTPUT="$results_dir/flat-$soldiers.csv" \
    "$root/target/release/army_benchmark" \
    >"$results_dir/flat-$soldiers.log" 2>&1
  status=$?
  printf '%s\n' "finished representation=flat soldiers_total=$soldiers exit_status=$status"
  if [ "$status" -ne 0 ]; then
    printf '%s\n' "representation=flat soldiers_total=$soldiers exit_status=$status" >>"$results_dir/failures.txt"
  fi
done

printf '%s\n' "complete results_dir=$results_dir"
