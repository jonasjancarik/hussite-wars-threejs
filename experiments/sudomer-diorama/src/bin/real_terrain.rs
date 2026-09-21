use bevy::{
    anti_alias::fxaa::Fxaa,
    app::AppExit,
    asset::AssetPlugin,
    camera::{Exposure, Hdr},
    core_pipeline::tonemapping::Tonemapping,
    input::mouse::{AccumulatedMouseMotion, MouseScrollUnit, MouseWheel},
    light::{
        CascadeShadowConfig, CascadeShadowConfigBuilder, DirectionalLightShadowMap,
        ShadowFilteringMethod,
    },
    post_process::bloom::Bloom,
    prelude::*,
    render::view::screenshot::{Screenshot, save_to_disk},
    window::{WindowPlugin, WindowResolution},
};
#[path = "../sudomer/mod.rs"]
mod landscape;
#[path = "../diorama/touch.rs"]
mod touch;

#[derive(Resource)]
struct Orbit {
    target: Vec3,
    yaw: f32,
    pitch: f32,
    distance: f32,
}
impl Default for Orbit {
    fn default() -> Self {
        Self {
            target: Vec3::new(0.0, landscape::height(0.0, 0.0) + 1.7, 0.0),
            yaw: -0.22,
            pitch: -0.80,
            distance: landscape::SIZE * 1.64,
        }
    }
}
#[derive(Resource)]
struct AutoCapture(bool);
fn main() {
    App::new()
        .insert_resource(ClearColor(Color::srgb(0.38, 0.43, 0.46)))
        .insert_resource(DirectionalLightShadowMap { size: 4096 })
        .insert_resource(GlobalAmbientLight {
            color: Color::srgb(0.79, 0.84, 0.87),
            brightness: 340.0,
            affects_lightmapped_meshes: true,
        })
        .init_resource::<Orbit>()
        .insert_resource(AutoCapture(
            std::env::var("BATTLE_AUTOCAPTURE").is_ok_and(|v| v == "1"),
        ))
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
                        title: "Sudoměř — landscape study".into(),
                        resolution: WindowResolution::new(1672, 941),
                        ..default()
                    }),
                    ..default()
                }),
        )
        .add_systems(Startup, (setup, landscape::spawn))
        .add_systems(
            Update,
            (orbit_input, apply_orbit, capture, automatic_capture).chain(),
        )
        .run();
}
fn setup(mut commands: Commands) {
    commands.spawn((
        DirectionalLight {
            color: Color::srgb(1.0, 0.94, 0.84),
            illuminance: 16500.0,
            shadow_maps_enabled: true,
            shadow_depth_bias: 0.12,
            shadow_normal_bias: 1.1,
            ..default()
        },
        Transform::from_xyz(-100.0, 145.0, 80.0).looking_at(Vec3::ZERO, Vec3::Y),
        CascadeShadowConfigBuilder {
            num_cascades: 1,
            maximum_distance: 6500.0,
            ..default()
        }
        .build(),
    ));
    commands.spawn((
        Camera3d::default(),
        Transform::default(),
        Projection::Perspective(PerspectiveProjection {
            fov: 40.0_f32.to_radians(),
            near: 0.2,
            far: 1800.0,
            ..default()
        }),
        Hdr,
        Msaa::Off,
        Fxaa::default(),
        Exposure { ev100: 11.3 },
        Tonemapping::TonyMcMapface,
        Bloom {
            intensity: 0.09,
            ..Bloom::NATURAL
        },
        ShadowFilteringMethod::Gaussian,
        DistanceFog {
            color: Color::srgb(0.38, 0.43, 0.46),
            directional_light_color: Color::srgba(1.0, 0.83, 0.61, 0.18),
            directional_light_exponent: 18.0,
            falloff: FogFalloff::Linear {
                start: 310.0,
                end: 740.0,
            },
        },
    ));
}
fn orbit_input(
    buttons: Res<ButtonInput<MouseButton>>,
    keys: Res<ButtonInput<KeyCode>>,
    motion: Res<AccumulatedMouseMotion>,
    touches: Res<Touches>,
    window: Single<&Window>,
    camera: Single<(&Camera, &GlobalTransform), With<Camera3d>>,
    mut previous: Local<Vec<(u64, Vec2)>>,
    mut wheel: MessageReader<MouseWheel>,
    mut rig: ResMut<Orbit>,
) {
    if keys.just_pressed(KeyCode::KeyF) {
        *rig = Orbit::default();
    }
    if keys.just_pressed(KeyCode::KeyV) {
        rig.target = Vec3::new(-4.0, landscape::height(-4.0, 30.0) + 1.7, 30.0);
        rig.distance = 80.0;
        rig.pitch = -0.62;
        rig.yaw = -0.3;
    }
    let mut current: Vec<_> = touches.iter().map(|t| (t.id(), t.position())).collect();
    current.sort_by_key(|t| t.0);
    let gesture = touch::gesture(&previous, &current);
    let touching = !current.is_empty();
    rig.yaw -= gesture.orbit.x * 0.006;
    rig.pitch = (rig.pitch - gesture.orbit.y * 0.004).clamp(-1.53, -0.25);
    if !touching && buttons.pressed(MouseButton::Right) {
        rig.yaw -= motion.delta.x * 0.004;
        rig.pitch = (rig.pitch - motion.delta.y * 0.003).clamp(-1.53, -0.25);
    }
    let (camera, camera_transform) = *camera;
    let ground_y = rig.target.y - 1.7;
    let touch_centers = (previous.len() == 2
        && current.len() == 2
        && previous.iter().zip(&current).all(|(a, b)| a.0 == b.0))
    .then(|| {
        (
            (previous[0].1 + previous[1].1) * 0.5,
            (current[0].1 + current[1].1) * 0.5,
        )
    });
    if let Some((old_cursor, cursor)) = touch_centers {
        pan_on_ground(
            &mut rig.target,
            camera,
            camera_transform,
            old_cursor,
            cursor,
            ground_y,
        );
        zoom_at_cursor(
            &mut rig,
            gesture.zoom,
            cursor,
            camera,
            camera_transform,
            ground_y,
        );
    } else if !touching
        && (buttons.pressed(MouseButton::Left) || buttons.pressed(MouseButton::Middle))
    {
        if let Some(cursor) = window.cursor_position() {
            pan_on_ground(
                &mut rig.target,
                camera,
                camera_transform,
                cursor - motion.delta,
                cursor,
                ground_y,
            );
        }
    }
    let mut wheel_exponent = 0.0;
    for event in wheel.read() {
        let sensitivity = match event.unit {
            MouseScrollUnit::Line => 0.10,
            MouseScrollUnit::Pixel => 0.0015,
        };
        wheel_exponent -= event.y * sensitivity;
    }
    if wheel_exponent != 0.0 {
        let factor = wheel_zoom_factor(wheel_exponent);
        if let Some(cursor) = window.cursor_position() {
            zoom_at_cursor(&mut rig, factor, cursor, camera, camera_transform, ground_y);
        } else {
            rig.distance = zoom_distance(rig.distance, factor);
        }
    }
    let edge = landscape::SIZE * 0.49;
    rig.target.x = rig.target.x.clamp(-edge, edge);
    rig.target.z = rig.target.z.clamp(-edge, edge);
    rig.target.y = landscape::height(rig.target.x, rig.target.z) + 1.7;
    *previous = current;
}
fn ground_hit(
    camera: &Camera,
    camera_transform: &GlobalTransform,
    cursor: Vec2,
    ground_y: f32,
) -> Option<Vec3> {
    let ray = camera.viewport_to_world(camera_transform, cursor).ok()?;
    let vertical = ray.direction.y;
    if vertical.abs() < 1e-5 {
        return None;
    }
    let distance = (ground_y - ray.origin.y) / vertical;
    (distance >= 0.0).then(|| ray.origin + ray.direction * distance)
}
fn pan_on_ground(
    target: &mut Vec3,
    camera: &Camera,
    camera_transform: &GlobalTransform,
    old_cursor: Vec2,
    cursor: Vec2,
    ground_y: f32,
) {
    if let (Some(old_point), Some(point)) = (
        ground_hit(camera, camera_transform, old_cursor, ground_y),
        ground_hit(camera, camera_transform, cursor, ground_y),
    ) {
        *target += old_point - point;
    }
}
fn zoom_at_cursor(
    rig: &mut Orbit,
    factor: f32,
    cursor: Vec2,
    camera: &Camera,
    camera_transform: &GlobalTransform,
    ground_y: f32,
) {
    let old_distance = rig.distance;
    let new_distance = zoom_distance(old_distance, factor);
    if let Some(anchor) = ground_hit(camera, camera_transform, cursor, ground_y) {
        let ratio = new_distance / old_distance;
        rig.target = anchored_zoom_target(rig.target, anchor, ratio);
    }
    rig.distance = new_distance;
}
fn anchored_zoom_target(target: Vec3, anchor: Vec3, ratio: f32) -> Vec3 {
    Vec3::new(
        anchor.x + (target.x - anchor.x) * ratio,
        target.y,
        anchor.z + (target.z - anchor.z) * ratio,
    )
}
fn apply_orbit(
    rig: Res<Orbit>,
    window: Single<&Window>,
    camera: Single<(&mut Transform, &mut DistanceFog, &mut Projection), With<Camera3d>>,
    mut shadows: Single<&mut CascadeShadowConfig, With<DirectionalLight>>,
) {
    let distance = rig.distance * (1.25 / (window.width() / window.height().max(1.0))).max(1.0);
    let horizontal = distance * rig.pitch.cos();
    **shadows = CascadeShadowConfigBuilder {
        num_cascades: 1,
        maximum_distance: (distance * 1.5 + 100.0).max(250.0),
        ..default()
    }
    .build();
    let (mut transform, mut fog, mut projection) = camera.into_inner();
    if let Projection::Perspective(p) = &mut *projection {
        p.far = (distance + landscape::SIZE * 4.0).max(1800.0);
        p.near = (distance * 0.0005).clamp(0.01, 0.2);
    }
    *transform = Transform::from_translation(
        rig.target
            + Vec3::new(
                horizontal * rig.yaw.sin(),
                -distance * rig.pitch.sin(),
                horizontal * rig.yaw.cos(),
            ),
    )
    .looking_at(rig.target, Vec3::Y);
    fog.falloff = FogFalloff::Linear {
        start: distance + 350.0,
        end: distance + 4800.0,
    };
}
fn capture(mut commands: Commands, keys: Res<ButtonInput<KeyCode>>) {
    if keys.just_pressed(KeyCode::KeyP) {
        commands
            .spawn(Screenshot::primary_window())
            .observe(save_to_disk("captures/sudomer-real-terrain.png"));
    }
}
fn automatic_capture(
    mut commands: Commands,
    time: Res<Time>,
    settings: Res<AutoCapture>,
    mut state: Local<u8>,
    mut exit: MessageWriter<AppExit>,
) {
    if !settings.0 {
        return;
    }
    if *state == 0 && time.elapsed_secs() >= 12.0 {
        commands
            .spawn(Screenshot::primary_window())
            .observe(save_to_disk("captures/sudomer-real-terrain.png"));
        *state = 1;
    } else if *state == 1 && time.elapsed_secs() >= 20.0 {
        exit.write(AppExit::Success);
        *state = 2;
    }
}

// No map-scale zoom ceiling; only protect the orbit from zero or invalid input.
fn zoom_distance(distance: f32, factor: f32) -> f32 {
    let next = distance * factor;
    if next.is_finite() && factor > 0.0 {
        next.max(0.05)
    } else {
        distance
    }
}
fn wheel_zoom_factor(exponent: f32) -> f32 {
    exponent.clamp(-0.35, 0.35).exp()
}
#[cfg(test)]
mod zoom_tests {
    use super::*;
    #[test]
    fn zoom_can_cross_both_previous_limits() {
        assert_eq!(zoom_distance(55.0, 0.1), 5.5);
        assert_eq!(zoom_distance(460.0, 10.0), 4600.0);
        assert_eq!(zoom_distance(0.05, 0.5), 0.05);
        assert_eq!(zoom_distance(55.0, f32::INFINITY), 55.0);
    }
    #[test]
    fn cursor_anchor_stays_fixed_during_zoom() {
        let target = Vec3::new(20.0, 5.0, -10.0);
        let anchor = Vec3::new(80.0, 0.0, 30.0);
        let camera_offset = Vec3::new(40.0, 70.0, 100.0);
        let ratio = 0.35;
        let next_target = anchored_zoom_target(target, anchor, ratio);
        let old_camera = target + camera_offset;
        let next_camera = next_target + camera_offset * ratio;
        let old_xz = Vec2::new(old_camera.x - anchor.x, old_camera.z - anchor.z);
        let next_xz = Vec2::new(next_camera.x - anchor.x, next_camera.z - anchor.z);
        assert!(next_xz.abs_diff_eq(old_xz * ratio, 1e-5));
    }
    #[test]
    fn wheel_bursts_are_limited_to_progressive_steps() {
        assert!((wheel_zoom_factor(-100.0) - (-0.35_f32).exp()).abs() < 1e-6);
        assert!((wheel_zoom_factor(100.0) - 0.35_f32.exp()).abs() < 1e-6);
        assert!((wheel_zoom_factor(0.1) - 0.1_f32.exp()).abs() < 1e-6);
    }
}
