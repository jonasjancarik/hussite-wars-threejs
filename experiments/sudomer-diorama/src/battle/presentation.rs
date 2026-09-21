use super::{diagnostics::EffectsEnabled, input::Selection, model::*};
use bevy::{
    input::mouse::{AccumulatedMouseMotion, MouseScrollUnit, MouseWheel},
    prelude::*,
};

#[derive(Component)]
pub struct BattleEntity;
#[derive(Component)]
pub(crate) struct PersonPiece(PersonId);
#[derive(Component)]
pub(crate) struct WagonPiece(WagonId);
#[derive(Component)]
pub struct BattleCamera;
#[derive(Component)]
pub(crate) struct CosmeticParticle {
    origin: Vec3,
    phase: f32,
    kind: u8,
}
#[derive(Resource)]
pub struct Orbit {
    pub target: Vec3,
    pub yaw: f32,
    pub pitch: f32,
    pub distance: f32,
    pub desired_distance: f32,
    pub zoom_anchor: Option<Vec3>,
}

pub fn setup_battle(
    mut commands: Commands,
    server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut mats: ResMut<Assets<StandardMaterial>>,
    world: Res<BattleWorld>,
) {
    commands.insert_resource(Orbit {
        target: Vec3::new(0.0, crate::landscape::height(0.0, 35.0), 35.0),
        yaw: -0.35,
        pitch: -0.72,
        distance: 310.0,
        desired_distance: 310.0,
        zoom_anchor: None,
    });
    let primitive = |path: &'static str| {
        server.load(
            GltfAssetLabel::Primitive {
                mesh: 0,
                primitive: 0,
            }
            .from_asset(path),
        )
    };
    let shield = primitive("models/benchmark/infantry_shield_flat.glb");
    let polearm = primitive("models/benchmark/infantry_polearm_flat.glb");
    let handgun = primitive("models/benchmark/infantry_handgun_flat.glb");
    let unarmed = primitive("models/battle/unarmed_adult_static.glb");
    let horse = primitive("models/battle/horse_rider_static.glb");
    let wagon = primitive("models/battle/war_wagon_crewless.glb");
    let vertex_colors = mats.add(StandardMaterial {
        base_color: Color::WHITE,
        perceptual_roughness: 0.92,
        ..default()
    });
    for p in &world.scenario.people {
        let mesh = match p.role {
            role if role.is_mounted() => horse.clone(),
            PersonRole::Noncombatant => unarmed.clone(),
            PersonRole::Handgunner | PersonRole::WagonCrew => handgun.clone(),
            PersonRole::Infantry => shield.clone(),
            _ => polearm.clone(),
        };
        let y = crate::landscape::walkable_height(p.position.x, p.position.y);
        commands.spawn((
            Name::new("Battle participant"),
            BattleEntity,
            PersonPiece(p.id),
            Mesh3d(mesh),
            MeshMaterial3d(vertex_colors.clone()),
            Transform::from_xyz(p.position.x, y, p.position.y),
        ));
    }
    for w in &world.scenario.wagons {
        commands.spawn((
            Name::new("Crewless battle wagon"),
            BattleEntity,
            WagonPiece(w.id),
            Mesh3d(wagon.clone()),
            MeshMaterial3d(vertex_colors.clone()),
            Transform::from_xyz(
                w.position.x,
                crate::landscape::walkable_height(w.position.x, w.position.y),
                w.position.y,
            ),
        ));
    }
    commands.spawn((
        BattleCamera,
        Camera3d::default(),
        Projection::Perspective(PerspectiveProjection {
            fov: 45f32.to_radians(),
            near: 0.2,
            far: 2500.0,
            ..default()
        }),
        Transform::default(),
    ));
    commands.spawn((
        DirectionalLight {
            illuminance: 17000.0,
            shadow_maps_enabled: false,
            ..default()
        },
        Transform::from_xyz(-100.0, 180.0, 100.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));
    let smoke = meshes.add(Sphere::new(0.55));
    let smoke_mat = mats.add(StandardMaterial {
        base_color: Color::srgba(0.42, 0.40, 0.36, 0.4),
        alpha_mode: AlphaMode::Blend,
        unlit: true,
        ..default()
    });
    for i in 0..48 {
        let origin = Vec3::new(
            -38.0 + (i % 12) as f32 * 6.5,
            crate::landscape::height(0.0, 28.0) + 2.2,
            28.0,
        );
        commands.spawn((
            BattleEntity,
            CosmeticParticle {
                origin,
                phase: i as f32 * 0.37,
                kind: (i % 2) as u8,
            },
            Mesh3d(smoke.clone()),
            MeshMaterial3d(smoke_mat.clone()),
            Transform::from_translation(origin).with_scale(Vec3::splat(0.0)),
        ));
    }
}

pub fn sync_pieces(
    world: Res<BattleWorld>,
    mut people: Query<(&PersonPiece, &mut Transform)>,
    mut wagons: Query<(&WagonPiece, &mut Transform), Without<PersonPiece>>,
) {
    for (piece, mut t) in &mut people {
        let p = &world.scenario.people[piece.0.0 as usize];
        t.translation.x = p.position.x;
        t.translation.z = p.position.y;
        t.translation.y = crate::landscape::walkable_height(p.position.x, p.position.y)
            + if p.state == PersonState::Incapacitated {
                0.18
            } else {
                0.0
            };
        if p.state == PersonState::Incapacitated {
            t.rotation = Quat::from_rotation_x(std::f32::consts::FRAC_PI_2);
        }
    }
    for (piece, mut t) in &mut wagons {
        let w = &world.scenario.wagons[piece.0.0 as usize];
        t.translation.x = w.position.x;
        t.translation.z = w.position.y;
        t.scale.y = if w.state == WagonState::Wreck {
            0.35
        } else {
            1.0
        };
    }
}
pub fn update_effects(
    time: Res<Time>,
    world: Res<BattleWorld>,
    effects: Res<EffectsEnabled>,
    mut q: Query<(&CosmeticParticle, &mut Transform)>,
) {
    if world.phase == BattlePhase::Preparing || !effects.0 {
        for (_, mut transform) in &mut q {
            transform.scale = Vec3::ZERO;
        }
        return;
    }
    if world.phase != BattlePhase::Running {
        return;
    }
    for (p, mut t) in &mut q {
        let age = (world.elapsed * 0.32 + p.phase) % 4.0;
        t.translation = p.origin
            + Vec3::new(
                (p.phase * 2.1).sin() * age * 0.18,
                age * 0.75,
                (p.phase * 1.3).cos() * age * 0.12,
            );
        t.scale = Vec3::splat(
            (age * (1.0 - age / 4.0)).max(0.0)
                * (if p.kind == 0 { 0.55 } else { 0.35 })
                * if time.delta_secs() > 0.0 { 1.0 } else { 0.0 },
        );
    }
}
pub fn orbit_camera(
    buttons: Res<ButtonInput<MouseButton>>,
    motion: Res<AccumulatedMouseMotion>,
    mut wheel: MessageReader<MouseWheel>,
    keys: Res<ButtonInput<KeyCode>>,
    mut orbit: ResMut<Orbit>,
    camera: Single<(&Camera, &GlobalTransform, &mut Transform), With<BattleCamera>>,
    window: Single<&Window>,
    selection: Res<Selection>,
    touches: Res<Touches>,
    time: Res<Time>,
    mut previous_touches: Local<Vec<(u64, Vec2)>>,
) {
    let (camera_view, camera_global, mut camera_transform) = camera.into_inner();
    if keys.just_pressed(KeyCode::KeyF) {
        orbit.target = Vec3::new(0.0, crate::landscape::height(0.0, 25.0), 25.0);
        orbit.distance = 380.0;
        orbit.desired_distance = 380.0;
        orbit.zoom_anchor = None;
    }
    if buttons.pressed(MouseButton::Right) {
        orbit.yaw -= motion.delta.x * 0.004;
        orbit.pitch = (orbit.pitch - motion.delta.y * 0.003).clamp(-1.45, -0.2);
        orbit.zoom_anchor = None;
    }
    if buttons.pressed(MouseButton::Middle) {
        let scale = orbit.distance * 0.0015;
        orbit.target += Vec3::new(-motion.delta.x * scale, 0.0, -motion.delta.y * scale);
        orbit.zoom_anchor = None;
    }
    let mut current: Vec<_> = touches
        .iter()
        .map(|touch| (touch.id(), touch.position()))
        .collect();
    current.sort_by_key(|touch| touch.0);
    let gesture = crate::touch::gesture(&previous_touches, &current);
    orbit.yaw -= gesture.orbit.x * 0.006;
    orbit.pitch = (orbit.pitch - gesture.orbit.y * 0.004).clamp(-1.45, -0.2);
    if current.len() == 2 {
        let scale = orbit.distance * 0.0015;
        orbit.target += Vec3::new(-gesture.pan.x * scale, 0.0, -gesture.pan.y * scale);
        if gesture.zoom != 1.0 {
            let midpoint = (current[0].1 + current[1].1) * 0.5;
            orbit.zoom_anchor = ground_hit(camera_view, camera_global, midpoint, orbit.target.y);
        }
        orbit.desired_distance = zoom_distance(orbit.desired_distance, gesture.zoom.ln());
    }
    let mut wheel_exponent = 0.0;
    for e in wheel.read() {
        let sensitivity = match e.unit {
            MouseScrollUnit::Line => 0.10,
            MouseScrollUnit::Pixel => 0.0015,
        };
        wheel_exponent -= e.y * sensitivity;
    }
    if wheel_exponent != 0.0 {
        orbit.zoom_anchor = window
            .cursor_position()
            .and_then(|cursor| ground_hit(camera_view, camera_global, cursor, orbit.target.y));
        orbit.desired_distance = zoom_distance(orbit.desired_distance, wheel_exponent);
    }
    let smoothing = 1.0 - (-12.0 * time.delta_secs()).exp();
    let old_distance = orbit.distance;
    let new_distance = old_distance.lerp(orbit.desired_distance, smoothing);
    if let Some(anchor) = orbit.zoom_anchor {
        orbit.target = anchored_zoom_target(orbit.target, anchor, new_distance / old_distance);
    }
    orbit.distance = new_distance;
    if (orbit.distance - orbit.desired_distance).abs() < 0.01 {
        orbit.distance = orbit.desired_distance;
        orbit.zoom_anchor = None;
    }
    let _ = &selection;
    let dir = Vec3::new(
        orbit.yaw.sin() * orbit.pitch.cos(),
        -orbit.pitch.sin(),
        orbit.yaw.cos() * orbit.pitch.cos(),
    );
    *camera_transform = Transform::from_translation(orbit.target + dir * orbit.distance)
        .looking_at(orbit.target, Vec3::Y);
    *previous_touches = current;
}

fn ground_hit(
    camera: &Camera,
    camera_transform: &GlobalTransform,
    cursor: Vec2,
    ground_y: f32,
) -> Option<Vec3> {
    let ray = camera.viewport_to_world(camera_transform, cursor).ok()?;
    if ray.direction.y.abs() < 1e-5 {
        return None;
    }
    let distance = (ground_y - ray.origin.y) / ray.direction.y;
    (distance >= 0.0).then(|| ray.origin + ray.direction * distance)
}

fn anchored_zoom_target(target: Vec3, anchor: Vec3, ratio: f32) -> Vec3 {
    Vec3::new(
        anchor.x + (target.x - anchor.x) * ratio,
        target.y,
        anchor.z + (target.z - anchor.z) * ratio,
    )
}

fn zoom_distance(distance: f32, exponent: f32) -> f32 {
    (distance * exponent.clamp(-0.35, 0.35).exp()).clamp(25.0, 900.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn static_presentation_has_no_animation_component() {
        assert_ne!(
            std::any::TypeId::of::<PersonPiece>(),
            std::any::TypeId::of::<bevy::animation::AnimationPlayer>()
        );
    }
    #[test]
    fn reset_marker_is_scoped() {
        assert_ne!(
            std::any::TypeId::of::<BattleEntity>(),
            std::any::TypeId::of::<BattleCamera>()
        );
    }
    #[test]
    fn pixel_wheel_bursts_are_bounded() {
        assert!((zoom_distance(310.0, -10.0) - 218.45).abs() < 0.1);
        assert!((zoom_distance(310.0, 10.0) - 439.98).abs() < 0.1);
    }
    #[test]
    fn zoom_distance_respects_limits() {
        assert_eq!(zoom_distance(25.0, -0.2), 25.0);
        assert_eq!(zoom_distance(900.0, 0.2), 900.0);
    }
    #[test]
    fn cursor_anchor_moves_target_by_zoom_ratio() {
        let target = Vec3::new(10.0, 3.0, 20.0);
        let anchor = Vec3::new(30.0, 0.0, 50.0);
        assert_eq!(
            anchored_zoom_target(target, anchor, 0.5),
            Vec3::new(20.0, 3.0, 35.0)
        );
    }
}
