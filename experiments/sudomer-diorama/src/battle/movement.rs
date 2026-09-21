use super::{
    model::*,
    navigation::{self, MovementClass},
};
use bevy::prelude::*;

fn class(role: PersonRole) -> MovementClass {
    if role.is_mounted() {
        MovementClass::Mounted
    } else {
        MovementClass::Foot
    }
}
fn speed(role: PersonRole, w: &BattleWorld) -> f32 {
    if role.is_mounted() {
        w.scenario.tuning.mounted_speed
    } else {
        w.scenario.tuning.foot_speed
    }
}

pub fn advance_formations(mut world: ResMut<BattleWorld>) {
    step(&mut world);
}
pub fn step(world: &mut BattleWorld) {
    if world.phase != BattlePhase::Running {
        return;
    }
    let dt = 1.0 / world.scenario.tuning.fixed_hz;
    world.elapsed += dt;
    world.tick += 1;
    let exits = (Vec2::new(-180.0, 120.0), Vec2::new(0.0, -220.0));
    for wi in 0..world.scenario.wagons.len() {
        let state = world.scenario.wagons[wi].state;
        if matches!(state, WagonState::Deploying | WagonState::Packing) {
            world.scenario.wagons[wi].transition += dt;
            if world.scenario.wagons[wi].transition >= world.scenario.tuning.deploy_seconds {
                world.scenario.wagons[wi].state = if state == WagonState::Deploying {
                    WagonState::Deployed
                } else {
                    WagonState::Packed
                };
            }
        }
    }
    for fi in 0..world.scenario.formations.len() {
        if !world.scenario.formations[fi].released {
            continue;
        }
        let role = world.scenario.formations[fi].role;
        let side = world.scenario.formations[fi].side;
        let order = world.scenario.formations[fi].order;
        let routing = world.scenario.formations[fi].routed;
        let dest = if routing || order == FormationOrder::Withdraw {
            Some(if side == Side::Defender {
                exits.0
            } else {
                exits.1
            })
        } else {
            world.scenario.formations[fi].destination
        };
        let Some(dest) = dest else { continue };
        let center = world.scenario.formations[fi].center;
        let class = class(role);
        let Some(next) = navigation::steer_step(center, dest, class) else {
            continue;
        };
        let dir = (next - center).normalize_or_zero();
        let step = speed(role, &world) * navigation::terrain_multiplier(center, class) * dt;
        let new = center + dir * step.min(center.distance(next));
        if !navigation::passable(new, class, 0.8) {
            continue;
        }
        let delta = new - center;
        world.scenario.formations[fi].center = new;
        world.scenario.formations[fi].facing = dir.y.atan2(dir.x);
        let members = world.scenario.formations[fi].members.clone();
        for id in members {
            let p = &mut world.scenario.people[id.0 as usize];
            if matches!(p.state, PersonState::Active | PersonState::Routing) {
                p.position += delta;
                if routing {
                    p.state = PersonState::Routing
                }
                if p.position.distance(dest) < 3.0 {
                    p.state = PersonState::Escaped;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn foot_and_mounted_speeds_differ() {
        let w = BattleWorld::default();
        assert!(speed(PersonRole::Rider, &w) > speed(PersonRole::Infantry, &w));
    }
    #[test]
    fn queueing_keeps_distinct_centres() {
        let w = BattleWorld::default();
        assert_ne!(
            w.scenario.formations[12].center,
            w.scenario.formations[13].center
        );
    }
}
