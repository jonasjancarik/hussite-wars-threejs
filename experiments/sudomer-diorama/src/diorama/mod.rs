mod app;
mod game;
#[path = "../vignette.rs"]
mod gameplay;
#[derive(bevy::prelude::Resource)]
pub struct BattleMode(pub bool);
pub use app::run;

mod atmosphere;
mod landscape;
mod layout;
mod pieces;
mod touch;

use bevy::{
    anti_alias::fxaa::Fxaa,
    camera::{Exposure, Hdr},
    core_pipeline::tonemapping::Tonemapping,
    input::mouse::AccumulatedMouseMotion,
    light::{CascadeShadowConfigBuilder, ShadowFilteringMethod},
    post_process::bloom::Bloom,
    prelude::*,
};

pub struct DioramaPlugin;
impl Plugin for DioramaPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<Orbit>()
            .init_resource::<atmosphere::AtmosphereClock>()
            .add_systems(
                Startup,
                (setup, landscape::spawn, pieces::spawn, atmosphere::spawn),
            )
            .add_systems(Update, (orbit, atmosphere::animate).chain());
    }
}

#[derive(Component)]
pub struct DioramaCamera;
#[derive(Resource)]
struct Orbit {
    yaw: f32,
    pitch: f32,
    distance: f32,
    target: Vec3,
}
impl Default for Orbit {
    fn default() -> Self {
        Self {
            yaw: -0.38,
            pitch: -0.63,
            distance: 158.0,
            target: Vec3::new(0.0, 3.0, 0.0),
        }
    }
}
fn setup(mut commands: Commands) {
    commands.spawn((
        DioramaCamera,
        gameplay::OrderCamera,
        Camera3d::default(),
        Projection::Perspective(PerspectiveProjection {
            fov: 40.0_f32.to_radians(),
            near: 0.2,
            far: 600.0,
            ..default()
        }),
        Transform::default(),
        Hdr,
        Msaa::Off,
        Fxaa::default(),
        Exposure { ev100: 11.3 },
        Tonemapping::TonyMcMapface,
        Bloom {
            intensity: 0.10,
            ..Bloom::NATURAL
        },
        ShadowFilteringMethod::Gaussian,
        DistanceFog {
            color: Color::srgb(0.38, 0.43, 0.46),
            directional_light_color: Color::srgba(1.0, 0.83, 0.61, 0.25),
            directional_light_exponent: 18.0,
            falloff: FogFalloff::Linear {
                start: 150.0,
                end: 370.0,
            },
        },
    ));
    commands.spawn((
        Name::new("Warm window light"),
        DirectionalLight {
            color: Color::srgb(1.0, 0.88, 0.69),
            illuminance: 24000.0,
            shadow_maps_enabled: true,
            shadow_depth_bias: 0.008,
            shadow_normal_bias: 0.45,
            ..default()
        },
        Transform::from_xyz(-60.0, 85.0, 45.0).looking_at(Vec3::ZERO, Vec3::Y),
        CascadeShadowConfigBuilder {
            num_cascades: 1,
            maximum_distance: 270.0,
            ..default()
        }
        .build(),
    ));
}
fn orbit(
    buttons: Res<ButtonInput<MouseButton>>,
    keys: Res<ButtonInput<KeyCode>>,
    motion: Res<AccumulatedMouseMotion>,
    touches: Res<Touches>,
    mut previous_touches: Local<Vec<(u64, Vec2)>>,
    mut wheel: MessageReader<bevy::input::mouse::MouseWheel>,
    mut rig: ResMut<Orbit>,
    window: Single<&Window>,
    mut camera: Single<(&mut Transform, &mut DistanceFog), With<DioramaCamera>>,
) {
    if keys.just_pressed(KeyCode::KeyF) {
        *rig = Orbit::default();
    }
    let mut current: Vec<_> = touches.iter().map(|t| (t.id(), t.position())).collect();
    current.sort_by_key(|t| t.0);
    let gesture = touch::gesture(&previous_touches, &current);
    let touching = !current.is_empty();
    *previous_touches = current;
    rig.yaw -= gesture.orbit.x * 0.006;
    rig.pitch = (rig.pitch - gesture.orbit.y * 0.004).clamp(-1.35, -0.30);
    rig.distance = (rig.distance * gesture.zoom).clamp(65.0, 245.0);
    if !touching && buttons.pressed(MouseButton::Right) {
        rig.yaw -= motion.delta.x * 0.004;
        rig.pitch = (rig.pitch - motion.delta.y * 0.003).clamp(-1.35, -0.30);
    }
    let pan = gesture.pan
        + if !touching && buttons.pressed(MouseButton::Middle) {
            motion.delta
        } else {
            Vec2::ZERO
        };
    if pan != Vec2::ZERO {
        let right = Vec3::new(rig.yaw.cos(), 0.0, -rig.yaw.sin());
        let forward = Vec3::new(rig.yaw.sin(), 0.0, rig.yaw.cos());
        let scale = rig.distance * 0.0009;
        rig.target += (-right * pan.x + forward * pan.y) * scale;
        rig.target = rig
            .target
            .clamp(Vec3::new(-35.0, 3.0, -35.0), Vec3::new(35.0, 3.0, 35.0));
    }
    for event in wheel.read() {
        let sensitivity = match event.unit {
            bevy::input::mouse::MouseScrollUnit::Line => 0.07,
            bevy::input::mouse::MouseScrollUnit::Pixel => 0.002,
        };
        rig.distance = (rig.distance * (-event.y * sensitivity).exp()).clamp(65.0, 245.0);
    }
    // Preserve the whole miniature in narrow windows as well as landscape views.
    let aspect = window.width() / window.height().max(1.0);
    let distance = rig.distance * (1.25 / aspect).max(1.0);
    let horizontal = distance * rig.pitch.cos();
    camera.1.falloff = FogFalloff::Linear {
        start: distance - 10.0,
        end: distance + 210.0,
    };
    *camera.0 = Transform::from_translation(
        rig.target
            + Vec3::new(
                horizontal * rig.yaw.sin(),
                -distance * rig.pitch.sin(),
                horizontal * rig.yaw.cos(),
            ),
    )
    .looking_at(rig.target, Vec3::Y);
}

pub fn noise(mut n: u32) -> f32 {
    n = n.wrapping_mul(747796405).wrapping_add(2891336453);
    n = ((n >> ((n >> 28) + 4)) ^ n).wrapping_mul(277803737);
    ((n >> 22) ^ n) as f32 / u32::MAX as f32
}
