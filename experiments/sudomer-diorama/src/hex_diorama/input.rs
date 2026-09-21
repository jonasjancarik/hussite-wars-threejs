use super::{
    BoardCamera, board,
    bridge::{self, Coord, SnapshotState},
};
use bevy::prelude::*;

fn tap_allowed(start: Vec2, end: Vec2, valid: bool) -> bool {
    valid && start.distance(end) <= 7.0
}

#[derive(Resource, Default)]
pub struct PointerState {
    start: Option<Vec2>,
    dragged: bool,
    touch: Option<(u64, Vec2, bool)>,
    last_touch: Option<f32>,
    hover: Option<Coord>,
}
pub fn pick(
    buttons: Res<ButtonInput<MouseButton>>,
    touches: Res<Touches>,
    time: Res<Time>,
    window: Single<&Window>,
    camera: Single<(&Camera, &GlobalTransform), With<BoardCamera>>,
    mut pointer: ResMut<PointerState>,
    state: Res<SnapshotState>,
) {
    if buttons.just_pressed(MouseButton::Left) {
        pointer.start = window.cursor_position();
        pointer.dragged = false;
    }
    if buttons.pressed(MouseButton::Left) {
        if let (Some(a), Some(b)) = (pointer.start, window.cursor_position()) {
            pointer.dragged |= a.distance(b) > 7.0;
        }
    }
    let fingers: Vec<_> = touches.iter().collect();
    if fingers.len() == 1 {
        let finger = fingers[0];
        if touches.just_pressed(finger.id()) {
            pointer.touch = Some((finger.id(), finger.position(), true));
        }
        if let Some((id, start, valid)) = pointer.touch.as_mut() {
            if *id != finger.id() || finger.position().distance(*start) > 7.0 {
                *valid = false;
            }
        }
    }
    let mut cursor = None;
    for finger in touches.iter_just_released() {
        if let Some((id, start, valid)) = pointer.touch {
            if id == finger.id() && tap_allowed(start, finger.position(), valid) {
                cursor = Some(finger.position());
            }
        }
        pointer.touch = None;
        pointer.last_touch = Some(time.elapsed_secs());
    }
    let recent_touch = pointer
        .last_touch
        .is_some_and(|last| time.elapsed_secs() - last < 0.4);
    if buttons.just_released(MouseButton::Left) && !pointer.dragged && !recent_touch {
        cursor = window.cursor_position();
    }
    let is_action = cursor.is_some();
    let Some(cursor) = cursor.or_else(|| {
        (!buttons.any_pressed([MouseButton::Left, MouseButton::Right, MouseButton::Middle])
            && fingers.is_empty())
        .then(|| window.cursor_position())
        .flatten()
    }) else {
        return;
    };
    let (cam, transform) = *camera;
    let Ok(ray) = cam.viewport_to_world(transform, cursor) else {
        return;
    };
    let Some(snapshot) = &state.current else {
        return;
    };
    let Some(hit) = board::pick_terrain(ray.origin, *ray.direction) else {
        return;
    };
    if !is_action {
        if pointer.hover != Some(hit) {
            pointer.hover = Some(hit);
            bridge::command(
                snapshot,
                "inspect",
                &format!(",\"col\":{},\"row\":{}", hit.col, hit.row),
            );
        }
    } else if let Some(unit) = snapshot
        .units
        .iter()
        .find(|u| u.col == hit.col && u.row == hit.row && u.faction == "hussites")
    {
        bridge::command(snapshot, "select", &format!(",\"unitId\":{}", unit.id));
    } else {
        bridge::command(
            snapshot,
            "hex",
            &format!(",\"col\":{},\"row\":{}", hit.col, hit.row),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tap_is_cancelled_after_drag_or_pinch_rebase() {
        assert!(tap_allowed(Vec2::ZERO, Vec2::new(4.0, 3.0), true));
        assert!(!tap_allowed(Vec2::ZERO, Vec2::new(9.0, 0.0), true));
        assert!(!tap_allowed(Vec2::ZERO, Vec2::ZERO, false));
    }
}
