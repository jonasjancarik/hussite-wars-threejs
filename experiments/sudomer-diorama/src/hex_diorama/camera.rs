use super::BoardCamera;
use bevy::{
    input::mouse::{AccumulatedMouseMotion, MouseWheel},
    prelude::*,
};

#[derive(Default, Debug, PartialEq)]
struct TouchGesture {
    orbit: Vec2,
    pan: Vec2,
    zoom: f32,
}

fn touch_gesture(previous: &[(u64, Vec2)], current: &[(u64, Vec2)]) -> TouchGesture {
    let mut result = TouchGesture {
        zoom: 1.0,
        ..default()
    };
    if previous.len() != current.len() || !previous.iter().zip(current).all(|(a, b)| a.0 == b.0) {
        return result;
    }
    match current.len() {
        1 => result.orbit = current[0].1 - previous[0].1,
        2 => {
            result.pan = (current[0].1 + current[1].1 - previous[0].1 - previous[1].1) * 0.5;
            let old = previous[0].1.distance(previous[1].1);
            let new = current[0].1.distance(current[1].1);
            if old > 8.0 && new > 8.0 {
                result.zoom = old / new;
            }
        }
        _ => {}
    }
    result
}

#[derive(Resource)]
pub struct Orbit {
    yaw: f32,
    pitch: f32,
    distance: f32,
    target: Vec3,
}
impl Default for Orbit {
    fn default() -> Self {
        Self {
            yaw: -0.58,
            pitch: -0.69,
            distance: 164.0,
            target: Vec3::new(0.0, 0.5, -1.0),
        }
    }
}
pub fn initial_pose(mut q: Single<&mut Transform, With<BoardCamera>>, rig: Res<Orbit>) {
    apply(&mut q, &rig, 1.6);
}
fn apply(t: &mut Transform, r: &Orbit, aspect: f32) {
    let portrait_fit = if aspect < 1.0 { 1.45 / aspect } else { 1.0 };
    let d = r.distance * portrait_fit;
    let h = d * r.pitch.cos();
    *t = Transform::from_translation(
        r.target + Vec3::new(h * r.yaw.sin(), -d * r.pitch.sin(), h * r.yaw.cos()),
    )
    .looking_at(r.target, Vec3::Y);
}
pub fn controls(
    buttons: Res<ButtonInput<MouseButton>>,
    keys: Res<ButtonInput<KeyCode>>,
    motion: Res<AccumulatedMouseMotion>,
    touches: Res<Touches>,
    mut previous_touches: Local<Vec<(u64, Vec2)>>,
    mut wheel: MessageReader<MouseWheel>,
    mut rig: ResMut<Orbit>,
    window: Single<&Window>,
    mut camera: Single<&mut Transform, With<BoardCamera>>,
) {
    if keys.just_pressed(KeyCode::KeyF) {
        *rig = Orbit::default();
    }
    let mut current: Vec<_> = touches
        .iter()
        .map(|touch| (touch.id(), touch.position()))
        .collect();
    current.sort_by_key(|touch| touch.0);
    let gesture = touch_gesture(&previous_touches, &current);
    rig.yaw -= gesture.orbit.x * 0.006;
    rig.pitch = (rig.pitch - gesture.orbit.y * 0.004).clamp(-1.35, -0.28);
    rig.distance = (rig.distance * gesture.zoom).clamp(65.0, 250.0);
    if gesture.pan != Vec2::ZERO {
        let right = Vec3::new(rig.yaw.cos(), 0.0, -rig.yaw.sin());
        let forward = Vec3::new(rig.yaw.sin(), 0.0, rig.yaw.cos());
        let scale = rig.distance * 0.0009;
        rig.target += (-right * gesture.pan.x + forward * gesture.pan.y) * scale;
    }
    let touching = !current.is_empty();
    *previous_touches = current;
    if !touching && buttons.pressed(MouseButton::Right) {
        rig.yaw -= motion.delta.x * 0.004;
        rig.pitch = (rig.pitch - motion.delta.y * 0.003).clamp(-1.35, -0.28);
    }
    if !touching && buttons.pressed(MouseButton::Middle) {
        let right = Vec3::new(rig.yaw.cos(), 0.0, -rig.yaw.sin());
        let forward = Vec3::new(rig.yaw.sin(), 0.0, rig.yaw.cos());
        let scale = rig.distance * 0.0009;
        rig.target += (-right * motion.delta.x + forward * motion.delta.y) * scale;
        rig.target = rig
            .target
            .clamp(Vec3::new(-45.0, 0.0, -35.0), Vec3::new(45.0, 0.0, 35.0));
    }
    for e in wheel.read() {
        rig.distance = (rig.distance * (-e.y * 0.07).exp()).clamp(65.0, 250.0);
    }
    apply(&mut camera, &rig, window.width() / window.height().max(1.0));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_finger_orbits_only() {
        let gesture = touch_gesture(&[(1, Vec2::ZERO)], &[(1, Vec2::new(18.0, -7.0))]);
        assert_eq!(gesture.orbit, Vec2::new(18.0, -7.0));
        assert_eq!(gesture.pan, Vec2::ZERO);
        assert_eq!(gesture.zoom, 1.0);
    }

    #[test]
    fn two_fingers_pan_and_zoom_without_orbit() {
        let gesture = touch_gesture(
            &[(1, Vec2::ZERO), (2, Vec2::new(100.0, 0.0))],
            &[(1, Vec2::new(-20.0, 10.0)), (2, Vec2::new(140.0, 10.0))],
        );
        assert_eq!(gesture.orbit, Vec2::ZERO);
        assert_eq!(gesture.pan, Vec2::new(10.0, 10.0));
        assert_eq!(gesture.zoom, 0.625);
    }

    #[test]
    fn changed_finger_identity_rebases_without_jump() {
        let gesture = touch_gesture(
            &[(1, Vec2::ZERO), (2, Vec2::new(100.0, 0.0))],
            &[(1, Vec2::ZERO), (3, Vec2::new(180.0, 40.0))],
        );
        assert_eq!(
            gesture,
            TouchGesture {
                zoom: 1.0,
                ..default()
            }
        );
    }
}
