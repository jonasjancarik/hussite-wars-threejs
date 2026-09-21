// Earlier moving battlefield, retained for comparison.
#[path = "../camera.rs"]
mod camera;
#[path = "../dressing.rs"]
mod dressing;
#[path = "../scene.rs"]
mod scene;
#[path = "../terrain.rs"]
mod terrain;
#[path = "../vignette.rs"]
mod vignette;

use bevy::{
    app::AppExit,
    asset::AssetPlugin,
    diagnostic::{DiagnosticsStore, FrameTimeDiagnosticsPlugin, LogDiagnosticsPlugin},
    light::DirectionalLightShadowMap,
    prelude::*,
    render::view::screenshot::{Screenshot, save_to_disk},
    window::{PresentMode, WindowPlugin, WindowResolution},
};

use camera::BattleCameraPlugin;
use scene::BattlefieldScenePlugin;
use vignette::{BattleClock, VignettePlugin};

fn main() {
    App::new()
        .insert_resource(vignette::BattleGround {
            height: terrain::height_at,
            half_size: 220.0,
        })
        .insert_resource(ClearColor(Color::srgb(0.66, 0.67, 0.65)))
        .insert_resource(GlobalAmbientLight {
            color: Color::srgb(0.72, 0.79, 0.88),
            brightness: 180.0,
            affects_lightmapped_meshes: true,
        })
        .insert_resource(DirectionalLightShadowMap { size: 4096 })
        .add_plugins(
            DefaultPlugins
                .set(AssetPlugin {
                    file_path: asset_directory(),
                    ..default()
                })
                .set(WindowPlugin {
                    primary_window: Some(Window {
                        title: "Hussite Battlefield — Visual POC".into(),
                        resolution: WindowResolution::new(1672, 941),
                        present_mode: PresentMode::AutoVsync,
                        resizable: true,
                        fit_canvas_to_parent: true,
                        prevent_default_event_handling: false,
                        ..default()
                    }),
                    ..default()
                }),
        )
        .add_plugins(FrameTimeDiagnosticsPlugin::default())
        .add_plugins(LogDiagnosticsPlugin {
            wait_duration: std::time::Duration::from_secs(10),
            ..default()
        })
        .add_plugins((BattlefieldScenePlugin, BattleCameraPlugin, VignettePlugin))
        .insert_resource(CaptureSettings {
            automatic: std::env::var("BATTLE_AUTOCAPTURE").is_ok_and(|value| value == "1"),
        })
        .add_systems(Startup, setup_hud)
        .add_systems(Update, (keyboard_controls, update_hud, automatic_capture))
        .run();
}

fn asset_directory() -> String {
    if cfg!(target_arch = "wasm32") {
        "assets".to_string()
    } else {
        format!("{}/assets", env!("CARGO_MANIFEST_DIR"))
    }
}

#[derive(Component)]
struct HudText;

#[derive(Resource)]
struct CaptureSettings {
    automatic: bool,
}

fn setup_hud(mut commands: Commands) {
    commands.spawn((
        HudText,
        Text::new(""),
        TextFont {
            font_size: FontSize::Px(15.0),
            ..default()
        },
        TextColor(Color::srgba(0.94, 0.91, 0.82, 0.92)),
        Node {
            position_type: PositionType::Absolute,
            left: px(18),
            bottom: px(16),
            padding: UiRect::all(px(10)),
            ..default()
        },
        BackgroundColor(Color::srgba(0.06, 0.055, 0.045, 0.58)),
    ));
}

fn keyboard_controls(
    mut commands: Commands,
    keys: Res<ButtonInput<KeyCode>>,
    mut clock: ResMut<BattleClock>,
) {
    if keys.just_pressed(KeyCode::Space) {
        clock.paused = !clock.paused;
    }
    if keys.just_pressed(KeyCode::KeyR) {
        clock.elapsed = 0.0;
        clock.paused = false;
    }
    if keys.just_pressed(KeyCode::KeyP) {
        commands
            .spawn(Screenshot::primary_window())
            .observe(save_to_disk("captures/battlefield-reference.png"));
    }
}

fn automatic_capture(
    mut commands: Commands,
    time: Res<Time>,
    settings: Res<CaptureSettings>,
    mut state: Local<u8>,
    mut exit: MessageWriter<AppExit>,
) {
    if !settings.automatic {
        return;
    }
    if *state == 0 && time.elapsed_secs() >= 8.0 {
        commands
            .spawn(Screenshot::primary_window())
            .observe(save_to_disk("captures/battlefield-reference.png"));
        *state = 1;
    } else if *state == 1 && time.elapsed_secs() >= 30.0 {
        exit.write(AppExit::Success);
        *state = 2;
    }
}

fn update_hud(
    clock: Res<BattleClock>,
    diagnostics: Res<DiagnosticsStore>,
    mut hud: Single<&mut Text, With<HudText>>,
) {
    let fps = diagnostics
        .get(&FrameTimeDiagnosticsPlugin::FPS)
        .and_then(|value| value.smoothed())
        .map(|value| format!("{value:3.0} fps"))
        .unwrap_or_else(|| "warming up".to_string());
    hud.0 = format!(
        "Battlefield study  |  Inspired by the concept artwork\n{state}  {time:04.1}s  |  {fps}   |   LMB order | RMB orbit | MMB pan | wheel zoom | F reference | Space pause | R reset | P capture",
        state = if clock.paused { "PAUSED" } else { "PLAYING" },
        time = clock.elapsed,
    );
}
