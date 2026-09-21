//! Authored 3D presentation for the pinned Sudoměř JavaScript rules engine.
mod board;
mod bridge;
mod camera;
mod effects;
mod input;
mod pieces;

use bevy::{
    asset::AssetPlugin,
    camera::{Exposure, Hdr},
    core_pipeline::tonemapping::Tonemapping,
    diagnostic::{FrameTimeDiagnosticsPlugin, LogDiagnosticsPlugin},
    light::{DirectionalLightShadowMap, ShadowFilteringMethod},
    post_process::bloom::Bloom,
    prelude::*,
    window::{PresentMode, WindowResolution},
};

pub const HEX_RADIUS: f32 = 4.0;

pub fn noise(mut value: u32) -> f32 {
    value = value.wrapping_mul(747_796_405).wrapping_add(2_891_336_453);
    value = ((value >> ((value >> 28) + 4)) ^ value).wrapping_mul(277_803_737);
    ((value >> 22) ^ value) as f32 / u32::MAX as f32
}

pub fn run() {
    App::new()
        .insert_resource(ClearColor(Color::srgb(0.20, 0.22, 0.20)))
        .insert_resource(GlobalAmbientLight {
            color: Color::srgb(0.70, 0.79, 0.92),
            brightness: 275.0,
            ..default()
        })
        .insert_resource(DirectionalLightShadowMap { size: 4096 })
        .init_resource::<bridge::SnapshotState>()
        .init_resource::<camera::Orbit>()
        .init_resource::<input::PointerState>()
        .init_resource::<board::GridState>()
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
                        title: "Sudoměř — hex diorama".into(),
                        resolution: WindowResolution::new(1440, 900),
                        fit_canvas_to_parent: true,
                        prevent_default_event_handling: false,
                        present_mode: PresentMode::AutoVsync,
                        canvas: Some("#sudomer-canvas".into()),
                        ..default()
                    }),
                    ..default()
                }),
        )
        .add_plugins((
            FrameTimeDiagnosticsPlugin::default(),
            LogDiagnosticsPlugin::default(),
        ))
        .add_systems(Startup, (setup, board::spawn, camera::initial_pose).chain())
        .add_systems(
            Update,
            (
                bridge::poll,
                board::toggle_grid,
                board::sync_highlights,
                pieces::sync,
                camera::controls,
                input::pick,
                effects::sync,
                effects::animate,
            )
                .chain(),
        )
        .run();
}

#[derive(Component)]
pub struct BoardCamera;

fn setup(mut commands: Commands) {
    commands.spawn((
        BoardCamera,
        Camera3d::default(),
        Projection::Perspective(PerspectiveProjection {
            fov: 38.0_f32.to_radians(),
            near: 0.2,
            far: 600.0,
            ..default()
        }),
        Transform::default(),
        Hdr,
        Msaa::Off,
        Exposure { ev100: 11.3 },
        Tonemapping::TonyMcMapface,
        Bloom {
            intensity: 0.08,
            ..Bloom::NATURAL
        },
        ShadowFilteringMethod::Gaussian,
        DistanceFog {
            color: Color::srgb(0.43, 0.45, 0.39),
            directional_light_color: Color::srgba(1.0, 0.80, 0.55, 0.28),
            directional_light_exponent: 18.0,
            falloff: FogFalloff::Linear {
                start: 215.0,
                end: 470.0,
            },
        },
    ));
    commands.spawn((
        Name::new("Warm window light"),
        DirectionalLight {
            color: Color::srgb(1.0, 0.84, 0.62),
            illuminance: 26000.0,
            shadow_maps_enabled: true,
            shadow_depth_bias: 0.008,
            shadow_normal_bias: 0.45,
            ..default()
        },
        Transform::from_xyz(-60.0, 90.0, 45.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));
}
