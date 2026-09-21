//! Reproducible Bevy rendering baseline for large infantry formations.
//!
//! This deliberately uses the game's current GLB scene representation: one
//! WorldAssetRoot and one moving Transform per represented soldier. It is a
//! rendering and formation-movement benchmark, not a combat simulation.

use std::{env, path::PathBuf};

#[cfg(not(target_arch = "wasm32"))]
use std::{
    fs::{self, File},
    io::{BufWriter, Write},
    process,
};

use bevy::{
    app::AppExit,
    asset::AssetPlugin,
    camera::Projection,
    platform::time::Instant,
    prelude::*,
    render::{
        renderer::RenderAdapterInfo,
        view::screenshot::{Screenshot, save_to_disk},
    },
    window::{PresentMode, WindowPlugin, WindowResolution},
};

const WIDTH: u32 = 1280;
const HEIGHT: u32 = 720;

fn main() {
    let config = BenchmarkConfig::from_env();
    println!(
        "ARMY_BENCHMARK_CONFIG representation={} soldiers_total={} soldiers_per_side={} resolution={}x{} present_mode=AutoNoVsync static_warmup_s={:.1} moving_warmup_s={:.1} sample_s={:.1} output={}",
        config.representation.label(),
        config.soldiers,
        config.soldiers / 2,
        WIDTH,
        HEIGHT,
        config.static_warmup,
        config.moving_warmup,
        config.sample_duration,
        config.output.display(),
    );

    App::new()
        .insert_resource(config)
        .insert_resource(BenchmarkRun::default())
        .insert_resource(MovementTiming::default())
        .insert_resource(ClearColor(Color::srgb(0.48, 0.51, 0.42)))
        .insert_resource(GlobalAmbientLight {
            color: Color::WHITE,
            brightness: 350.0,
            affects_lightmapped_meshes: true,
        })
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
                        title: "Hussite Army Size Benchmark".into(),
                        resolution: WindowResolution::new(WIDTH, HEIGHT),
                        present_mode: PresentMode::AutoNoVsync,
                        resizable: false,
                        fit_canvas_to_parent: true,
                        ..default()
                    }),
                    ..default()
                }),
        )
        .add_systems(Startup, setup)
        .add_systems(Update, (move_formations, capture_once).chain())
        .add_systems(Last, sample_and_advance)
        .run();
}

#[derive(Resource)]
struct BenchmarkConfig {
    soldiers: usize,
    static_warmup: f64,
    moving_warmup: f64,
    sample_duration: f64,
    output: PathBuf,
    representation: Representation,
    capture: Option<PathBuf>,
}

impl BenchmarkConfig {
    fn from_env() -> Self {
        let default_soldiers: usize = if cfg!(all(target_arch = "wasm32", feature = "browser-50k"))
        {
            50_000
        } else {
            2_000
        };
        let soldiers = env_value("BATTLE_BENCH_SOLDIERS", default_soldiers);
        assert!(
            soldiers >= 2 && soldiers.is_multiple_of(2),
            "BATTLE_BENCH_SOLDIERS must be an even number of at least 2"
        );
        Self {
            soldiers,
            static_warmup: env_value(
                "BATTLE_BENCH_STATIC_WARMUP",
                if cfg!(target_arch = "wasm32") {
                    1.0
                } else {
                    4.0
                },
            ),
            moving_warmup: env_value(
                "BATTLE_BENCH_MOVING_WARMUP",
                if cfg!(target_arch = "wasm32") {
                    1.0
                } else {
                    3.0
                },
            ),
            sample_duration: env_value(
                "BATTLE_BENCH_SAMPLE_SECONDS",
                if cfg!(target_arch = "wasm32") {
                    2.0
                } else {
                    8.0
                },
            ),
            output: env::var_os("BATTLE_BENCH_OUTPUT")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("benchmark-results/army-2000.csv")),
            representation: Representation::from_env(),
            capture: env::var_os("BATTLE_BENCH_CAPTURE").map(PathBuf::from),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Representation {
    Scene,
    Flat,
}

impl Representation {
    fn from_env() -> Self {
        #[cfg(target_arch = "wasm32")]
        return Self::Flat;

        #[cfg(not(target_arch = "wasm32"))]
        match env::var("BATTLE_BENCH_REPRESENTATION").as_deref() {
            Ok("flat") => Self::Flat,
            Ok("scene") | Err(_) => Self::Scene,
            Ok(value) => {
                panic!("unsupported BATTLE_BENCH_REPRESENTATION={value:?}; use scene or flat")
            }
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Scene => "scene",
            Self::Flat => "flat",
        }
    }
}

fn env_value<T: std::str::FromStr>(name: &str, default: T) -> T {
    env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

#[derive(Component)]
struct Soldier {
    start: Vec3,
    side: f32,
    phase: f32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Phase {
    Loading,
    StaticWarmup,
    StaticSample,
    MovingWarmup,
    MovingSample,
    Finished,
}

impl Phase {
    fn is_moving(self) -> bool {
        matches!(self, Self::MovingWarmup | Self::MovingSample)
    }

    fn label(self) -> &'static str {
        match self {
            Self::StaticSample => "static",
            Self::MovingSample => "moving",
            _ => "",
        }
    }
}

#[derive(Resource)]
struct BenchmarkRun {
    phase: Phase,
    phase_elapsed: f64,
    ready_frames: u32,
    moving_elapsed: f32,
    samples: Vec<FrameSample>,
    summaries: Vec<PhaseSummary>,
    adapter_name: Option<String>,
    adapter_backend: Option<String>,
}

impl Default for BenchmarkRun {
    fn default() -> Self {
        Self {
            phase: Phase::Loading,
            phase_elapsed: 0.0,
            ready_frames: 0,
            moving_elapsed: 0.0,
            samples: Vec::new(),
            summaries: Vec::new(),
            adapter_name: None,
            adapter_backend: None,
        }
    }
}

#[derive(Resource, Default)]
struct MovementTiming(f64);

#[derive(Clone)]
#[allow(dead_code)]
struct FrameSample {
    phase: &'static str,
    frame: usize,
    frame_ms: f64,
    movement_cpu_ms: f64,
}

struct PhaseSummary {
    phase: &'static str,
    frames: usize,
    median_frame_ms: f64,
    p95_frame_ms: f64,
    median_fps: f64,
    p95_frame_fps: f64,
    median_movement_cpu_ms: f64,
    p95_movement_cpu_ms: f64,
    rss_mb: Option<f64>,
}

fn setup(
    mut commands: Commands,
    config: Res<BenchmarkConfig>,
    server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    let soldier_scenes: Option<[Handle<WorldAsset>; 3]> =
        (config.representation == Representation::Scene).then(|| {
            [
                server.load(GltfAssetLabel::Scene(0).from_asset("models/infantry_shield.glb")),
                server.load(GltfAssetLabel::Scene(0).from_asset("models/infantry_polearm.glb")),
                server.load(GltfAssetLabel::Scene(0).from_asset("models/infantry_handgun.glb")),
            ]
        });
    let flat_meshes: Option<[Handle<Mesh>; 3]> = (config.representation == Representation::Flat)
        .then(|| {
            [
                server.load(
                    GltfAssetLabel::Primitive {
                        mesh: 0,
                        primitive: 0,
                    }
                    .from_asset("models/benchmark/infantry_shield_flat.glb"),
                ),
                server.load(
                    GltfAssetLabel::Primitive {
                        mesh: 0,
                        primitive: 0,
                    }
                    .from_asset("models/benchmark/infantry_polearm_flat.glb"),
                ),
                server.load(
                    GltfAssetLabel::Primitive {
                        mesh: 0,
                        primitive: 0,
                    }
                    .from_asset("models/benchmark/infantry_handgun_flat.glb"),
                ),
            ]
        });
    let flat_material = (config.representation == Representation::Flat).then(|| {
        materials.add(StandardMaterial {
            base_color: Color::WHITE,
            perceptual_roughness: 0.92,
            metallic: 0.0,
            ..default()
        })
    });

    let per_side = config.soldiers / 2;
    let columns = (per_side as f32).sqrt().ceil() as usize;
    let rows = per_side.div_ceil(columns);
    let spacing_x = 1.35;
    let spacing_z = 1.65;
    let formation_width = (columns.saturating_sub(1)) as f32 * spacing_x;
    let formation_depth = (rows.saturating_sub(1)) as f32 * spacing_z;
    let center_offset = formation_depth * 0.5 + 18.0;

    for side_index in 0..2 {
        let side = if side_index == 0 { -1.0 } else { 1.0 };
        for index in 0..per_side {
            let row = index / columns;
            let column = index % columns;
            let x = column as f32 * spacing_x - formation_width * 0.5;
            let z = side * (center_offset + row as f32 * spacing_z);
            let start = Vec3::new(x, 0.0, z);
            let mut entity = commands.spawn((
                Name::new("Benchmark soldier"),
                Soldier {
                    start,
                    side,
                    phase: hash01(index + side_index * per_side) * 6.0,
                },
                Transform::from_translation(start).with_rotation(Quat::from_rotation_y(
                    if side < 0.0 {
                        0.0
                    } else {
                        std::f32::consts::PI
                    },
                )),
            ));
            let variant = (index + side_index) % 3;
            match config.representation {
                Representation::Scene => {
                    entity.insert(WorldAssetRoot(
                        soldier_scenes.as_ref().unwrap()[variant].clone(),
                    ));
                }
                Representation::Flat => {
                    entity.insert((
                        Mesh3d(flat_meshes.as_ref().unwrap()[variant].clone()),
                        MeshMaterial3d(flat_material.as_ref().unwrap().clone()),
                    ));
                }
            }
        }
    }

    let total_depth = total_formation_depth(formation_depth, 18.0);
    let scene_span = formation_width.max(total_depth);
    let camera_height = (scene_span * 0.92).max(120.0);
    let camera_z = (scene_span * 0.72).max(90.0);
    commands.spawn((
        Name::new("Benchmark camera"),
        Camera3d::default(),
        Projection::Perspective(PerspectiveProjection {
            fov: 48.0_f32.to_radians(),
            near: 0.2,
            far: 3_000.0,
            ..default()
        }),
        Msaa::Off,
        Transform::from_xyz(0.0, camera_height, camera_z).looking_at(Vec3::ZERO, Vec3::Y),
    ));
    commands.spawn((
        Name::new("Benchmark sun"),
        DirectionalLight {
            color: Color::srgb(1.0, 0.93, 0.80),
            illuminance: 18_000.0,
            shadow_maps_enabled: false,
            ..default()
        },
        Transform::from_rotation(Quat::from_euler(EulerRot::XYZ, -0.9, -0.6, 0.0)),
    ));
    commands.spawn((
        Name::new("Benchmark ground"),
        Mesh3d(
            meshes.add(
                Plane3d::default()
                    .mesh()
                    .size(scene_span * 1.3, scene_span * 1.3),
            ),
        ),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.30, 0.35, 0.22),
            perceptual_roughness: 1.0,
            ..default()
        })),
    ));
}

fn move_formations(
    time: Res<Time>,
    mut run: ResMut<BenchmarkRun>,
    mut timing: ResMut<MovementTiming>,
    mut soldiers: Query<(&Soldier, &mut Transform)>,
) {
    let started = Instant::now();
    if run.phase.is_moving() {
        run.moving_elapsed += time.delta_secs();
        let advance = (run.moving_elapsed * 0.42).sin() * 14.0 + 14.0;
        for (soldier, mut transform) in &mut soldiers {
            transform.translation = soldier.start
                + Vec3::new(
                    (run.moving_elapsed * 2.2 + soldier.phase).sin() * 0.07,
                    (run.moving_elapsed * 4.4 + soldier.phase).sin().abs() * 0.055,
                    -soldier.side * advance,
                );
        }
    }
    timing.0 = started.elapsed().as_secs_f64() * 1_000.0;
}

fn capture_once(
    mut commands: Commands,
    config: Res<BenchmarkConfig>,
    run: Res<BenchmarkRun>,
    mut captured: Local<bool>,
) {
    if *captured || run.phase != Phase::StaticSample {
        return;
    }
    let Some(path) = config.capture.clone() else {
        return;
    };
    commands
        .spawn(Screenshot::primary_window())
        .observe(save_to_disk(path));
    *captured = true;
}

#[allow(unused_mut, unused_variables)]
fn sample_and_advance(
    time: Res<Time>,
    config: Res<BenchmarkConfig>,
    mut run: ResMut<BenchmarkRun>,
    movement: Res<MovementTiming>,
    adapter: Res<RenderAdapterInfo>,
    soldier_entities: Query<Entity, With<Soldier>>,
    soldiers_with_children: Query<&Children, With<Soldier>>,
    flat_soldiers: Query<&Mesh3d, With<Soldier>>,
    mesh_assets: Res<Assets<Mesh>>,
    all_entities: Query<Entity>,
    mut exit: MessageWriter<AppExit>,
) {
    let dt = time.delta_secs_f64();
    run.phase_elapsed += dt;

    if run.phase == Phase::Loading {
        let ready = match config.representation {
            Representation::Scene => soldiers_with_children.iter().count() == config.soldiers,
            Representation::Flat => {
                soldier_entities.iter().count() == config.soldiers
                    && flat_soldiers
                        .iter()
                        .all(|mesh| mesh_assets.get(&mesh.0).is_some())
            }
        };
        if ready {
            run.ready_frames += 1;
        } else {
            run.ready_frames = 0;
        }
        if run.ready_frames >= 30 {
            run.adapter_name = Some(adapter.name.clone());
            run.adapter_backend = Some(format!("{:?}", adapter.backend));
            println!(
                "ARMY_BENCHMARK_READY soldiers={} world_entities={} load_elapsed_s={:.3} adapter={} backend={:?}",
                config.soldiers,
                all_entities.iter().count(),
                run.phase_elapsed,
                adapter.name,
                adapter.backend,
            );
            #[cfg(target_arch = "wasm32")]
            bevy::log::info!(
                "ARMY_BENCHMARK_READY soldiers={} world_entities={} load_elapsed_s={:.3} backend={:?}",
                config.soldiers,
                all_entities.iter().count(),
                run.phase_elapsed,
                adapter.backend,
            );
            set_phase(&mut run, Phase::StaticWarmup);
        }
        return;
    }

    if matches!(run.phase, Phase::StaticSample | Phase::MovingSample) {
        let phase = run.phase.label();
        let frame = run
            .samples
            .iter()
            .filter(|sample| sample.phase == phase)
            .count();
        run.samples.push(FrameSample {
            phase,
            frame,
            frame_ms: dt * 1_000.0,
            movement_cpu_ms: movement.0,
        });
    }

    let next = match run.phase {
        Phase::StaticWarmup if run.phase_elapsed >= config.static_warmup => {
            Some(Phase::StaticSample)
        }
        Phase::StaticSample if run.phase_elapsed >= config.sample_duration => {
            finish_phase(&mut run, Phase::StaticSample);
            Some(Phase::MovingWarmup)
        }
        Phase::MovingWarmup if run.phase_elapsed >= config.moving_warmup => {
            Some(Phase::MovingSample)
        }
        Phase::MovingSample if run.phase_elapsed >= config.sample_duration => {
            finish_phase(&mut run, Phase::MovingSample);
            Some(Phase::Finished)
        }
        _ => None,
    };

    if let Some(next) = next {
        set_phase(&mut run, next);
        if next == Phase::Finished {
            for summary in &run.summaries {
                println!(
                    "ARMY_BENCHMARK_RESULT soldiers_total={} phase={} frames={} median_frame_ms={:.3} p95_frame_ms={:.3} median_fps={:.2} p95_frame_fps={:.2} median_movement_cpu_ms={:.4} p95_movement_cpu_ms={:.4} rss_mb={}",
                    config.soldiers,
                    summary.phase,
                    summary.frames,
                    summary.median_frame_ms,
                    summary.p95_frame_ms,
                    summary.median_fps,
                    summary.p95_frame_fps,
                    summary.median_movement_cpu_ms,
                    summary.p95_movement_cpu_ms,
                    summary
                        .rss_mb
                        .map(|value| format!("{value:.1}"))
                        .unwrap_or_else(|| "unavailable".into()),
                );
                #[cfg(target_arch = "wasm32")]
                bevy::log::info!(
                    "ARMY_BENCHMARK_RESULT soldiers_total={} phase={} frames={} median_frame_ms={:.3} p95_frame_ms={:.3} median_fps={:.2} p95_frame_fps={:.2} median_movement_cpu_ms={:.4} p95_movement_cpu_ms={:.4}",
                    config.soldiers,
                    summary.phase,
                    summary.frames,
                    summary.median_frame_ms,
                    summary.p95_frame_ms,
                    summary.median_fps,
                    summary.p95_frame_fps,
                    summary.median_movement_cpu_ms,
                    summary.p95_movement_cpu_ms,
                );
            }

            #[cfg(target_arch = "wasm32")]
            {
                run.samples.clear();
                run.summaries.clear();
                run.moving_elapsed = 0.0;
                set_phase(&mut run, Phase::MovingWarmup);
            }

            #[cfg(not(target_arch = "wasm32"))]
            if let Err(error) = write_results(&config, &run, all_entities.iter().count()) {
                eprintln!("ARMY_BENCHMARK_ERROR failed_to_write_results={error}");
                exit.write(AppExit::error());
            } else {
                exit.write(AppExit::Success);
            }
        }
    }
}

fn set_phase(run: &mut BenchmarkRun, phase: Phase) {
    run.phase = phase;
    run.phase_elapsed = 0.0;
    println!("ARMY_BENCHMARK_PHASE {phase:?}");
}

fn finish_phase(run: &mut BenchmarkRun, phase: Phase) {
    let label = phase.label();
    let phase_samples: Vec<_> = run
        .samples
        .iter()
        .filter(|sample| sample.phase == label)
        .collect();
    let mut frame_ms: Vec<_> = phase_samples.iter().map(|sample| sample.frame_ms).collect();
    let mut movement_ms: Vec<_> = phase_samples
        .iter()
        .map(|sample| sample.movement_cpu_ms)
        .collect();
    let median_frame_ms = percentile(&mut frame_ms, 0.50);
    let p95_frame_ms = percentile(&mut frame_ms, 0.95);
    let median_movement_cpu_ms = percentile(&mut movement_ms, 0.50);
    let p95_movement_cpu_ms = percentile(&mut movement_ms, 0.95);
    run.summaries.push(PhaseSummary {
        phase: label,
        frames: phase_samples.len(),
        median_frame_ms,
        p95_frame_ms,
        median_fps: 1_000.0 / median_frame_ms,
        p95_frame_fps: 1_000.0 / p95_frame_ms,
        median_movement_cpu_ms,
        p95_movement_cpu_ms,
        rss_mb: current_rss_mb(),
    });
}

fn percentile(values: &mut [f64], percentile: f64) -> f64 {
    if values.is_empty() {
        return f64::NAN;
    }
    values.sort_by(f64::total_cmp);
    let index = ((values.len() - 1) as f64 * percentile).ceil() as usize;
    values[index]
}

#[cfg(not(target_arch = "wasm32"))]
fn current_rss_mb() -> Option<f64> {
    let output = process::Command::new("ps")
        .args(["-o", "rss=", "-p", &process::id().to_string()])
        .output()
        .ok()?;
    let kib = String::from_utf8(output.stdout)
        .ok()?
        .trim()
        .parse::<f64>()
        .ok()?;
    Some(kib / 1024.0)
}

#[cfg(target_arch = "wasm32")]
fn current_rss_mb() -> Option<f64> {
    None
}

#[cfg(not(target_arch = "wasm32"))]
fn write_results(
    config: &BenchmarkConfig,
    run: &BenchmarkRun,
    world_entities: usize,
) -> std::io::Result<()> {
    if let Some(parent) = config.output.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut output = BufWriter::new(File::create(&config.output)?);
    writeln!(output, "# benchmark=hussite_army_native_rendering")?;
    writeln!(output, "# representation={}", config.representation.label())?;
    writeln!(output, "# soldiers_total={}", config.soldiers)?;
    writeln!(output, "# soldiers_per_side={}", config.soldiers / 2)?;
    writeln!(output, "# world_entities={world_entities}")?;
    writeln!(output, "# resolution={}x{}", WIDTH, HEIGHT)?;
    writeln!(output, "# present_mode=AutoNoVsync")?;
    writeln!(output, "# renderer=Bevy_0.19.1_wgpu_native")?;
    writeln!(
        output,
        "# adapter={}",
        run.adapter_name.as_deref().unwrap_or("unavailable")
    )?;
    writeln!(
        output,
        "# backend={}",
        run.adapter_backend.as_deref().unwrap_or("unavailable")
    )?;
    writeln!(
        output,
        "# assets=infantry_shield,infantry_polearm,infantry_handgun"
    )?;
    writeln!(output, "# camera=all_soldiers_framed")?;
    writeln!(output, "# msaa=off")?;
    writeln!(output, "# shadows=off")?;
    writeln!(output, "# static_warmup_s={:.3}", config.static_warmup)?;
    writeln!(output, "# moving_warmup_s={:.3}", config.moving_warmup)?;
    writeln!(output, "# sample_s={:.3}", config.sample_duration)?;
    for summary in &run.summaries {
        writeln!(
            output,
            "# summary phase={} frames={} median_frame_ms={:.6} p95_frame_ms={:.6} median_fps={:.6} p95_frame_fps={:.6} median_movement_cpu_ms={:.6} p95_movement_cpu_ms={:.6} rss_mb={}",
            summary.phase,
            summary.frames,
            summary.median_frame_ms,
            summary.p95_frame_ms,
            summary.median_fps,
            summary.p95_frame_fps,
            summary.median_movement_cpu_ms,
            summary.p95_movement_cpu_ms,
            summary
                .rss_mb
                .map(|value| format!("{value:.3}"))
                .unwrap_or_else(|| "unavailable".into()),
        )?;
    }
    writeln!(output, "phase,frame,frame_ms,movement_cpu_ms")?;
    for sample in &run.samples {
        writeln!(
            output,
            "{},{},{:.6},{:.6}",
            sample.phase, sample.frame, sample.frame_ms, sample.movement_cpu_ms
        )?;
    }
    Ok(())
}

fn hash01(value: usize) -> f32 {
    let mut x = value as u32;
    x = x.wrapping_mul(0x45d9f3b);
    x ^= x >> 16;
    x = x.wrapping_mul(0x45d9f3b);
    x ^= x >> 16;
    x as f32 / u32::MAX as f32
}

fn total_formation_depth(formation_depth: f32, half_gap: f32) -> f32 {
    // Each side starts half a formation-depth beyond the central gap, then
    // extends by another full formation-depth away from the center.
    formation_depth * 3.0 + half_gap * 2.0
}

#[cfg(test)]
mod tests {
    use super::total_formation_depth;

    #[test]
    fn camera_depth_covers_both_complete_formations() {
        let formation_depth = 51.15;
        let half_gap = 18.0;
        let center_offset = formation_depth * 0.5 + half_gap;
        let furthest_soldier = center_offset + formation_depth;

        assert_eq!(
            total_formation_depth(formation_depth, half_gap),
            furthest_soldier * 2.0
        );
    }
}
