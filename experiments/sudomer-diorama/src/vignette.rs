use std::f32::consts::FRAC_PI_2;

use bevy::prelude::*;

#[derive(Component)]
pub struct OrderCamera;

#[derive(Resource)]
pub struct BattleGround {
    pub height: fn(f32, f32) -> f32,
    pub half_size: f32,
}

pub struct VignettePlugin;

impl Plugin for VignettePlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(BattleClock::default())
            .insert_resource(RallyPoint::default())
            .add_systems(
                Update,
                (
                    advance_clock,
                    issue_formation_order,
                    reset_orders,
                    move_attackers,
                    animate_smoke,
                    draw_rally_point,
                ),
            );
    }
}

#[derive(Resource, Default)]
pub struct BattleClock {
    pub elapsed: f32,
    pub paused: bool,
}

#[derive(Component)]
pub struct Attacker {
    pub origin: Vec3,
    pub advance: Vec3,
    pub initial_advance: Vec3,
    pub phase: f32,
}

#[derive(Component)]
pub struct SmokePuff {
    pub origin: Vec3,
    pub phase: f32,
}

#[derive(Resource, Default)]
struct RallyPoint(Option<Vec3>);

fn advance_clock(time: Res<Time>, mut clock: ResMut<BattleClock>) {
    if !clock.paused {
        clock.elapsed = (clock.elapsed + time.delta_secs()) % 24.0;
    }
}

fn move_attackers(
    clock: Res<BattleClock>,
    ground: Res<BattleGround>,
    mut attackers: Query<(&Attacker, &mut Transform)>,
) {
    for (attacker, mut transform) in &mut attackers {
        let local = ((clock.elapsed + attacker.phase) / 24.0).fract();
        let charge = smoothstep(0.0, 0.72, local);
        let retreat = smoothstep(0.78, 1.0, local);
        let progress = (charge - retreat * 0.22).clamp(0.0, 1.0);
        let position = attacker.origin + attacker.advance * progress;
        transform.translation.x = position.x;
        transform.translation.z = position.z;
        transform.translation.y =
            (ground.height)(position.x, position.z) + (local * 42.0).sin().abs() * 0.10;
    }
}

fn issue_formation_order(
    buttons: Res<ButtonInput<MouseButton>>,
    touches: Res<Touches>,
    time: Res<Time>,
    window: Single<&Window>,
    camera: Single<(&Camera, &GlobalTransform), With<OrderCamera>>,
    ground: Res<BattleGround>,
    mut attackers: Query<&mut Attacker>,
    mut rally: ResMut<RallyPoint>,
    mut tap: Local<Option<(u64, Vec2, bool)>>,
    mut last_touch: Local<Option<f32>>,
) {
    let fingers: Vec<_> = touches.iter().collect();
    if !fingers.is_empty() {
        *last_touch = Some(time.elapsed_secs());
    }
    if fingers.len() > 1 || touches.iter_just_canceled().next().is_some() {
        *tap = None;
    }
    if fingers.len() == 1 {
        let finger = fingers[0];
        if touches.just_pressed(finger.id()) {
            *tap = Some((finger.id(), finger.position(), true));
        }
        if let Some((id, start, valid)) = tap.as_mut() {
            if *id != finger.id() || finger.position().distance(*start) > 8.0 {
                *valid = false;
            }
        }
    }
    let mut cursor = None;
    for finger in touches.iter_just_released() {
        if let Some((id, start, valid)) = *tap {
            if id == finger.id() && valid && start.distance(finger.position()) <= 8.0 {
                cursor = Some(finger.position());
            }
        }
        *tap = None;
        *last_touch = Some(time.elapsed_secs());
    }
    let recent_touch = last_touch.is_some_and(|t| time.elapsed_secs() - t < 0.4);
    if buttons.just_pressed(MouseButton::Left) && !recent_touch {
        cursor = window.cursor_position();
    }
    let Some(cursor) = cursor else {
        return;
    };
    let (camera, transform) = *camera;
    let Ok(ray) = camera.viewport_to_world(transform, cursor) else {
        return;
    };
    let Some(target) = terrain_hit(ray, &ground) else {
        return;
    };
    rally.0 = Some(target);
    let spread = ground.half_size / 220.0;
    for mut attacker in &mut attackers {
        let offset = Vec3::new(
            (attacker.origin.x * 0.17).sin() * 14.0 * spread,
            0.0,
            (attacker.origin.z * 0.19).cos() * 11.0 * spread,
        );
        let mut destination = target + offset;
        destination.x = destination
            .x
            .clamp(-ground.half_size + 2.0, ground.half_size - 2.0);
        destination.z = destination
            .z
            .clamp(-ground.half_size + 2.0, ground.half_size - 2.0);
        attacker.advance = destination - attacker.origin;
    }
}

fn terrain_hit(ray: Ray3d, ground: &BattleGround) -> Option<Vec3> {
    // Intersect the actual hills, not a y=0 plane: orders must land under the cursor.
    let mut previous = ray.origin;
    for step in 1..=1200 {
        let p = ray.get_point(step as f32);
        if p.x.abs() <= ground.half_size
            && p.z.abs() <= ground.half_size
            && p.y <= (ground.height)(p.x, p.z)
            && previous.y > (ground.height)(previous.x, previous.z)
        {
            let mut a = previous;
            let mut b = p;
            for _ in 0..12 {
                let m = (a + b) * 0.5;
                if m.y > (ground.height)(m.x, m.z) {
                    a = m;
                } else {
                    b = m;
                }
            }
            let p = (a + b) * 0.5;
            return Some(Vec3::new(p.x, (ground.height)(p.x, p.z), p.z));
        }
        previous = p;
    }
    None
}

fn reset_orders(
    keys: Res<ButtonInput<KeyCode>>,
    mut attackers: Query<&mut Attacker>,
    mut rally: ResMut<RallyPoint>,
) {
    if !keys.just_pressed(KeyCode::KeyR) {
        return;
    }
    rally.0 = None;
    for mut attacker in &mut attackers {
        attacker.advance = attacker.initial_advance;
    }
}

fn draw_rally_point(rally: Res<RallyPoint>, ground: Res<BattleGround>, mut gizmos: Gizmos) {
    if let Some(point) = rally.0 {
        gizmos.circle(
            Isometry3d::new(point + Vec3::Y * 0.35, Quat::from_rotation_x(FRAC_PI_2)),
            8.0 * ground.half_size / 220.0,
            Color::srgb(0.78, 0.19, 0.12),
        );
    }
}

fn animate_smoke(
    clock: Res<BattleClock>,
    mut smoke: Query<(&SmokePuff, &mut Transform, &mut Visibility)>,
) {
    for (puff, mut transform, mut visibility) in &mut smoke {
        let t = ((clock.elapsed - 7.0 + puff.phase) / 8.0).rem_euclid(1.0);
        *visibility = if clock.elapsed > 5.0 {
            Visibility::Visible
        } else {
            Visibility::Hidden
        };
        transform.translation = puff.origin + Vec3::new(t * 5.5, t * 3.4, -t * 1.5);
        transform.scale = Vec3::splat(0.55 + t * 2.15);
    }
}

fn smoothstep(a: f32, b: f32, value: f32) -> f32 {
    let t = ((value - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn orders_intersect_raised_ground() {
        let ground = BattleGround {
            height: |x, _| 5.0 + x * 0.1,
            half_size: 48.0,
        };
        let hit =
            terrain_hit(Ray3d::new(Vec3::new(10.0, 50.0, 3.0), Dir3::NEG_Y), &ground).unwrap();
        assert!((hit - Vec3::new(10.0, 6.0, 3.0)).length() < 0.001);
        assert!(
            terrain_hit(Ray3d::new(Vec3::new(60.0, 50.0, 3.0), Dir3::NEG_Y), &ground).is_none()
        );
    }
}
