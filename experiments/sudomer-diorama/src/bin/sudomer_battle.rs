use bevy::{
    asset::AssetPlugin,
    prelude::*,
    window::{PresentMode, WindowPlugin, WindowResolution},
};
#[path = "../battle/mod.rs"]
mod battle;
#[path = "../sudomer/mod.rs"]
mod landscape;
#[path = "../diorama/touch.rs"]
mod touch;
use battle::{
    diagnostics,
    model::{BattlePhase, BattleWorld, WagonState},
    scenario::{Policy, Preset},
};

fn value<'a>(args: &'a [String], name: &str) -> Option<&'a str> {
    args.windows(2)
        .find(|w| w[0] == name)
        .map(|w| w[1].as_str())
}
fn parse_preset(v: Option<&str>) -> Preset {
    match v {
        Some("lower-estimate") => Preset::LowerEstimate,
        _ => Preset::Standard,
    }
}
fn parse_policy(v: Option<&str>) -> Policy {
    match v {
        Some("respond") => Policy::Respond,
        Some("exposed") => Policy::Exposed,
        _ => Policy::Hold,
    }
}

#[cfg(target_arch = "wasm32")]
fn runtime_args() -> Vec<String> {
    let mut args = vec!["sudomer_battle".to_string()];
    let search = web_sys::window()
        .and_then(|window| window.location().search().ok())
        .unwrap_or_default();
    for pair in search
        .trim_start_matches('?')
        .split('&')
        .filter(|pair| !pair.is_empty())
    {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        match key {
            "preset" | "policy" | "seed" => {
                args.push(format!("--{key}"));
                args.push(value.to_string());
            }
            "measure" if value == "1" || value == "true" => args.push("--measure".into()),
            "effects" if value == "0" || value == "false" => args.push("--no-effects".into()),
            _ => {}
        }
    }
    args
}

#[cfg(not(target_arch = "wasm32"))]
fn runtime_args() -> Vec<String> {
    std::env::args().collect()
}

fn main() {
    let args = runtime_args();
    let preset = parse_preset(value(&args, "--preset"));
    let policy = parse_policy(value(&args, "--policy"));
    let seed = value(&args, "--seed")
        .and_then(|v| v.parse().ok())
        .unwrap_or(1420);
    println!(
        "SUDOMER_CONFIG preset={} policy={} seed={} people={} defenders=400 combatants=300 noncombatants=100 wagons=12 mounted_people={}",
        preset.label(),
        policy.label(),
        seed,
        400 + preset.enemy_people(),
        preset.enemy_people() + 9
    );
    if args.iter().any(|a| a == "--headless-check") {
        let result = diagnostics::run_headless(preset, policy, seed);
        let w = &result.world;
        println!(
            "SUDOMER_RESULT preset={} policy={} ticks={} result={:?} defenders_surviving={} noncombatants_surviving={} attackers_surviving={} invalid_positions={} digest={:016x} tick_median_ms={:.4} tick_p95_ms={:.4}",
            preset.label(),
            policy.label(),
            w.tick,
            w.phase,
            w.survivors(battle::model::Side::Defender),
            w.noncombatant_survivors(),
            w.survivors(battle::model::Side::Attacker),
            w.invalid_positions,
            diagnostics::digest(w),
            diagnostics::percentile(&result.tick_ms, 0.5),
            diagnostics::percentile(&result.tick_ms, 0.95)
        );
        if w.phase == battle::model::BattlePhase::Running || w.invalid_positions > 0 {
            std::process::exit(2)
        }
        return;
    }
    let measure = args.iter().any(|a| a == "--measure");
    let effects = !args.iter().any(|a| a == "--no-effects");
    let warmup = std::env::var("SUDOMER_WARMUP_SECONDS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(10.0);
    let duration = std::env::var("SUDOMER_SAMPLE_SECONDS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(30.0);
    let mut initial = BattleWorld::new(preset, policy, seed);
    if measure {
        initial.phase = BattlePhase::Running;
        for wagon in &mut initial.scenario.wagons {
            wagon.state = WagonState::Deployed;
        }
    }
    App::new()
        .insert_resource(ClearColor(Color::srgb(0.38, 0.43, 0.46)))
        .insert_resource(GlobalAmbientLight {
            color: Color::srgb(0.79, 0.84, 0.87),
            brightness: 340.0,
            affects_lightmapped_meshes: true,
        })
        .insert_resource(landscape::SceneryOptions {
            illustrative_wagons: false,
        })
        .insert_resource(initial)
        .insert_resource(diagnostics::MeasureConfig {
            enabled: measure,
            warmup,
            duration,
        })
        .insert_resource(diagnostics::EffectsEnabled(effects))
        .insert_resource(diagnostics::PerformanceLog {
            effects_enabled: effects,
            ..default()
        })
        .insert_resource(Time::<Fixed>::from_hz(20.0))
        .add_plugins(
            DefaultPlugins
                .set(AssetPlugin {
                    file_path: if cfg!(target_arch = "wasm32") {
                        "assets".into()
                    } else {
                        format!("{}/assets", env!("CARGO_MANIFEST_DIR"))
                    },
                    ..default()
                })
                .set(WindowPlugin {
                    primary_window: Some(Window {
                        title: "Sudoměř — playable battle".into(),
                        resolution: WindowResolution::new(1280, 720),
                        present_mode: PresentMode::AutoNoVsync,
                        fit_canvas_to_parent: true,
                        ..default()
                    }),
                    ..default()
                }),
        )
        .add_plugins(battle::BattlePlugin)
        .add_systems(Startup, landscape::spawn)
        .run();
}
