use super::model::*;
use super::presentation::BattleCamera;
use bevy::prelude::*;

#[derive(Resource, Default)]
pub struct Selection {
    pub formations: Vec<FormationId>,
    pub pointer_down: Option<Vec2>,
    pub dragged: bool,
    pub ui_consumed: bool,
}
pub fn is_click(down: Vec2, up: Vec2, ui_consumed: bool) -> bool {
    !ui_consumed && down.distance(up) < 7.0
}

pub fn keyboard_controls(
    keys: Res<ButtonInput<KeyCode>>,
    mut world: ResMut<BattleWorld>,
    mut selection: ResMut<Selection>,
) {
    if keys.just_pressed(KeyCode::Space) {
        world.commands.push(BattleCommand::TogglePause)
    }
    if keys.just_pressed(KeyCode::KeyR) {
        world.commands.push(BattleCommand::Reset);
        selection.formations.clear();
    }
    if keys.just_pressed(KeyCode::Enter) {
        world.commands.push(BattleCommand::Begin)
    }
}
pub fn pointer_controls(
    buttons: Res<ButtonInput<MouseButton>>,
    keys: Res<ButtonInput<KeyCode>>,
    window: Single<&Window>,
    camera: Single<(&Camera, &GlobalTransform), With<BattleCamera>>,
    mut selection: ResMut<Selection>,
    mut world: ResMut<BattleWorld>,
) {
    if buttons.just_pressed(MouseButton::Left) {
        selection.pointer_down = window.cursor_position();
        selection.dragged = false;
    }
    if buttons.pressed(MouseButton::Left) {
        if let (Some(a), Some(b)) = (selection.pointer_down, window.cursor_position()) {
            selection.dragged |= a.distance(b) >= 7.0;
        }
    }
    if buttons.just_released(MouseButton::Left) {
        if let (Some(a), Some(b)) = (selection.pointer_down.take(), window.cursor_position()) {
            if is_click(a, b, selection.ui_consumed) && !selection.dragged {
                let (view, transform) = *camera;
                if let Ok(ray) = view.viewport_to_world(transform, b) {
                    let distance = -ray.origin.y / ray.direction.y;
                    let point3 = ray.origin + ray.direction * distance;
                    let point = Vec2::new(point3.x, point3.z);
                    let clicked = world
                        .scenario
                        .formations
                        .iter()
                        .filter(|formation| formation.center.distance(point) < 12.0)
                        .min_by(|left, right| {
                            left.center
                                .distance_squared(point)
                                .total_cmp(&right.center.distance_squared(point))
                        })
                        .map(|formation| (formation.id, formation.side, formation.center));
                    if let Some((id, Side::Defender, _)) = clicked {
                        if !keys.pressed(KeyCode::ShiftLeft) && !keys.pressed(KeyCode::ShiftRight) {
                            selection.formations.clear();
                        }
                        if let Some(index) = selection
                            .formations
                            .iter()
                            .position(|&selected| selected == id)
                        {
                            selection.formations.remove(index);
                        } else {
                            selection.formations.push(id);
                        }
                    } else if let Some((_, Side::Attacker, target)) = clicked {
                        for &id in &selection.formations {
                            world.commands.push(BattleCommand::Order(
                                id,
                                FormationOrder::Attack,
                                Some(target),
                            ));
                        }
                    } else if crate::landscape::contains(point.x, point.y) {
                        for &id in &selection.formations {
                            let role = world.scenario.formations[id.0 as usize].role;
                            let order = if role == PersonRole::Noncombatant {
                                FormationOrder::Withdraw
                            } else {
                                FormationOrder::Move
                            };
                            world
                                .commands
                                .push(BattleCommand::Order(id, order, Some(point)));
                        }
                    }
                }
            }
        }
        selection.ui_consumed = false;
    }
}

pub fn touch_controls(
    touches: Res<Touches>,
    camera: Single<(&Camera, &GlobalTransform), With<BattleCamera>>,
    mut selection: ResMut<Selection>,
    mut world: ResMut<BattleWorld>,
    mut tap: Local<Option<(u64, Vec2, bool)>>,
) {
    let fingers: Vec<_> = touches.iter().collect();
    if fingers.len() > 1 || touches.iter_just_canceled().next().is_some() {
        *tap = None;
    }
    if fingers.len() == 1 {
        let finger = fingers[0];
        if touches.just_pressed(finger.id()) {
            *tap = Some((finger.id(), finger.position(), true));
        }
        if let Some((id, start, valid)) = tap.as_mut() {
            if *id != finger.id() || finger.position().distance(*start) > 7.0 {
                *valid = false;
            }
        }
    }
    let mut cursor = None;
    for finger in touches.iter_just_released() {
        if let Some((id, start, valid)) = *tap {
            if id == finger.id() && valid && start.distance(finger.position()) <= 7.0 {
                cursor = Some(finger.position());
            }
        }
        *tap = None;
    }
    let Some(cursor) = cursor else {
        return;
    };
    if selection.ui_consumed {
        selection.ui_consumed = false;
        return;
    }
    let (view, transform) = *camera;
    let Ok(ray) = view.viewport_to_world(transform, cursor) else {
        return;
    };
    let distance = -ray.origin.y / ray.direction.y;
    let hit = ray.origin + ray.direction * distance;
    let point = Vec2::new(hit.x, hit.z);
    if let Some((id, side, target)) = world
        .scenario
        .formations
        .iter()
        .filter(|formation| formation.center.distance(point) < 12.0)
        .min_by(|left, right| {
            left.center
                .distance_squared(point)
                .total_cmp(&right.center.distance_squared(point))
        })
        .map(|formation| (formation.id, formation.side, formation.center))
    {
        if side == Side::Defender {
            selection.formations.clear();
            selection.formations.push(id);
        } else {
            for &selected in &selection.formations {
                world.commands.push(BattleCommand::Order(
                    selected,
                    FormationOrder::Attack,
                    Some(target),
                ));
            }
        }
    } else if crate::landscape::contains(point.x, point.y) {
        for &selected in &selection.formations {
            let role = world.scenario.formations[selected.0 as usize].role;
            let order = if role == PersonRole::Noncombatant {
                FormationOrder::Withdraw
            } else {
                FormationOrder::Move
            };
            world
                .commands
                .push(BattleCommand::Order(selected, order, Some(point)));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn drag_is_not_click() {
        assert!(!is_click(Vec2::ZERO, Vec2::new(8.0, 0.0), false));
    }
    #[test]
    fn ui_consumes_click() {
        assert!(!is_click(Vec2::ZERO, Vec2::ZERO, true));
    }
    #[test]
    fn short_click_works() {
        assert!(is_click(Vec2::ZERO, Vec2::new(2.0, 1.0), false));
    }
}
