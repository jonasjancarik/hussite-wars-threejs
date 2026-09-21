use super::{
    ai, combat,
    model::*,
    movement, objectives,
    scenario::{Policy, Preset},
};
use bevy::{app::AppExit, platform::time::Instant, prelude::*};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

#[derive(Resource, Default)]
pub struct PerformanceLog {
    pub frames: Vec<f64>,
    pub ticks: Vec<f64>,
    pub effects_enabled: bool,
    pub elapsed: f64,
}
#[derive(Resource)]
pub struct MeasureConfig {
    pub enabled: bool,
    pub warmup: f64,
    pub duration: f64,
}
impl Default for MeasureConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            warmup: 10.0,
            duration: 30.0,
        }
    }
}
#[derive(Resource)]
pub struct EffectsEnabled(pub bool);
impl Default for EffectsEnabled {
    fn default() -> Self {
        Self(true)
    }
}

pub fn sample_frames(
    time: Res<Time>,
    config: Res<MeasureConfig>,
    mut log: ResMut<PerformanceLog>,
    mut exit: MessageWriter<AppExit>,
) {
    if !config.enabled {
        return;
    }
    log.elapsed += time.delta_secs_f64();
    if log.elapsed >= config.warmup && log.frames.len() < 20000 {
        log.frames.push(time.delta_secs_f64() * 1000.0);
    }
    if log.elapsed >= config.warmup + config.duration {
        println!(
            "SUDOMER_MEASURE effects={} frames={} frame_median_ms={:.3} frame_p95_ms={:.3}",
            log.effects_enabled,
            log.frames.len(),
            percentile(&log.frames, 0.5),
            percentile(&log.frames, 0.95)
        );
        exit.write(AppExit::Success);
    }
}
pub fn percentile(values: &[f64], q: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mut v = values.to_vec();
    v.sort_by(f64::total_cmp);
    v[((v.len() - 1) as f64 * q).round() as usize]
}
pub fn digest(world: &BattleWorld) -> u64 {
    let mut h = DefaultHasher::new();
    world.tick.hash(&mut h);
    (world.phase as u8).hash(&mut h);
    for p in &world.scenario.people {
        p.id.hash(&mut h);
        (p.state as u8).hash(&mut h);
        p.health.to_bits().hash(&mut h);
        p.position.x.to_bits().hash(&mut h);
        p.position.y.to_bits().hash(&mut h);
    }
    h.finish()
}
pub struct HeadlessResult {
    pub world: BattleWorld,
    pub tick_ms: Vec<f64>,
}
pub fn run_headless(preset: Preset, policy: Policy, seed: u64) -> HeadlessResult {
    let mut world = BattleWorld::new(preset, policy, seed);
    world.phase = BattlePhase::Running;
    for w in &mut world.scenario.wagons {
        w.state = if policy == Policy::Exposed {
            WagonState::Packed
        } else {
            WagonState::Deployed
        };
    }
    let mut tick_ms = Vec::new();
    let max_ticks =
        (world.scenario.tuning.dusk_seconds * world.scenario.tuning.fixed_hz) as u64 + 100;
    while world.phase == BattlePhase::Running && world.tick < max_ticks {
        let started = Instant::now();
        ai::step(&mut world);
        movement::step(&mut world);
        combat::step(&mut world);
        if let Some(r) = objectives::evaluate(&world) {
            world.phase = r;
        }
        tick_ms.push(started.elapsed().as_secs_f64() * 1000.0);
    }
    HeadlessResult { world, tick_ms }
}
