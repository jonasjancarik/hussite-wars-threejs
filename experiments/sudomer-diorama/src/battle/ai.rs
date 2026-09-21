use super::model::*;
use bevy::prelude::*;

pub fn update_ai(mut world: ResMut<BattleWorld>) {
    step(&mut world);
}
pub fn step(world: &mut BattleWorld) {
    if world.phase != BattlePhase::Running || world.tick % 10 != 0 {
        return;
    }
    let elapsed = world.elapsed;
    let policy = world.policy;
    let attacker_start = world
        .scenario
        .formations
        .iter()
        .position(|f| f.side == Side::Attacker)
        .unwrap_or(0);
    for f in &mut world.scenario.formations {
        if f.side == Side::Attacker {
            let due = match f.group {
                0 => 0.0,
                1 => 90.0,
                _ => 180.0,
            };
            f.released = elapsed >= due;
            if f.released && !f.routed {
                f.order = FormationOrder::Attack;
                let column = (f.id.0 as usize - attacker_start) % 5;
                f.destination = Some(if policy == super::scenario::Policy::Exposed {
                    Vec2::new(-38.0 + column as f32 * 19.0, 77.0)
                } else if f.group == 1 {
                    Vec2::new(18.0 + column as f32 * 10.0, 42.0)
                } else {
                    Vec2::new(-42.0 + column as f32 * 21.0, 38.0)
                });
            }
        }
    }
    if policy == super::scenario::Policy::Respond && elapsed >= 90.0 {
        if let Some(f) = world
            .scenario
            .formations
            .iter_mut()
            .find(|f| f.role == PersonRole::FootReserve)
        {
            f.order = FormationOrder::Move;
            f.destination = Some(Vec2::new(28.0, 42.0));
        }
    }
    if policy == super::scenario::Policy::Exposed {
        for w in &mut world.scenario.wagons {
            w.state = WagonState::Packed;
        }
        if let Some(f) = world
            .scenario
            .formations
            .iter_mut()
            .find(|f| f.role == PersonRole::FootReserve)
        {
            f.destination = Some(Vec2::new(-120.0, 120.0));
            f.order = FormationOrder::Move;
        }
    }
    let enemies: Vec<Vec2> = world
        .scenario
        .people
        .iter()
        .filter(|p| p.side == Side::Attacker && p.state == PersonState::Active)
        .map(|p| p.position)
        .collect();
    for f in &mut world.scenario.formations {
        if f.role == PersonRole::Noncombatant
            && !f.routed
            && enemies.iter().any(|p| p.distance(f.center) < 40.0)
        {
            f.order = FormationOrder::Withdraw;
            f.destination = Some(Vec2::new(-180.0, 120.0));
        }
    }
}
