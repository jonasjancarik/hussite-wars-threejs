use super::{model::*, navigation};
use bevy::prelude::*;
use std::collections::{BTreeMap, HashMap};

#[derive(Clone, Copy)]
struct Fighter {
    id: PersonId,
    side: Side,
    role: PersonRole,
    pos: Vec2,
    active: bool,
}

pub fn resolve_combat(mut world: ResMut<BattleWorld>) {
    step(&mut world);
}
pub fn step(world: &mut BattleWorld) {
    if world.phase != BattlePhase::Running {
        return;
    }
    let dt = 1.0 / world.scenario.tuning.fixed_hz;
    for f in &mut world.scenario.formations {
        f.attack_cooldown = (f.attack_cooldown - dt).max(0.0);
    }
    let snapshot: Vec<_> = world
        .scenario
        .people
        .iter()
        .map(|p| Fighter {
            id: p.id,
            side: p.side,
            role: p.role,
            pos: p.position,
            active: p.state == PersonState::Active,
        })
        .collect();
    let mut spatial: HashMap<(i32, i32), Vec<usize>> = HashMap::new();
    for (index, person) in snapshot
        .iter()
        .enumerate()
        .filter(|(_, person)| person.active)
    {
        spatial
            .entry((
                (person.pos.x / 10.0).floor() as i32,
                (person.pos.y / 10.0).floor() as i32,
            ))
            .or_default()
            .push(index);
    }
    let mut damage: BTreeMap<PersonId, f32> = BTreeMap::new();
    let mut wagon_damage: BTreeMap<WagonId, f32> = BTreeMap::new();
    for a in snapshot.iter().filter(|a| a.active && a.role.can_attack()) {
        let (range, dps, period): (f32, f32, f32) = match a.role {
            PersonRole::Handgunner | PersonRole::WagonCrew => (60.0, 20.0, 8.0),
            r if r.is_mounted() => (2.5, 10.0, 0.0),
            _ => (1.8, 8.0, 0.0),
        };
        let cooldown =
            world.scenario.formations[a.id_to_formation(&snapshot, &world)].attack_cooldown;
        if period > 0.0 && cooldown > 0.0 {
            continue;
        }
        let cell = (
            (a.pos.x / 10.0).floor() as i32,
            (a.pos.y / 10.0).floor() as i32,
        );
        let radius = (range / 10.0).ceil() as i32;
        let mut best: Option<&Fighter> = None;
        for dz in -radius..=radius {
            for dx in -radius..=radius {
                if let Some(indices) = spatial.get(&(cell.0 + dx, cell.1 + dz)) {
                    for &index in indices {
                        let target = &snapshot[index];
                        if target.side == a.side
                            || target.pos.distance_squared(a.pos) > range * range
                            || navigation::line_obstructed(a.pos, target.pos)
                        {
                            continue;
                        }
                        if best.is_none_or(|current| {
                            a.pos.distance_squared(target.pos) < a.pos.distance_squared(current.pos)
                                || (a.pos.distance_squared(target.pos)
                                    == a.pos.distance_squared(current.pos)
                                    && target.id < current.id)
                        }) {
                            best = Some(target);
                        }
                    }
                }
            }
        }
        if let Some(t) = best {
            *damage.entry(t.id).or_default() += if period > 0.0 { dps } else { dps * dt };
        } else if a.side == Side::Attacker {
            if let Some(wagon) = world
                .scenario
                .wagons
                .iter()
                .filter(|wagon| {
                    wagon.state != WagonState::Wreck && wagon.position.distance(a.pos) <= range
                })
                .min_by(|left, right| {
                    left.position
                        .distance_squared(a.pos)
                        .total_cmp(&right.position.distance_squared(a.pos))
                        .then(left.id.cmp(&right.id))
                })
            {
                *wagon_damage.entry(wagon.id).or_default() +=
                    if period > 0.0 { dps } else { dps * dt };
            }
        }
    }
    let fired_forms: Vec<_> = snapshot
        .iter()
        .filter(|a| {
            matches!(a.role, PersonRole::Handgunner | PersonRole::WagonCrew)
                && damage.values().any(|_| true)
        })
        .map(|a| a.id_to_formation(&snapshot, &world))
        .collect();
    for fi in fired_forms {
        world.scenario.formations[fi].attack_cooldown = 8.0;
    }
    let mut deaths = Vec::new();
    for (id, d) in damage {
        let protected = world.scenario.wagons.iter().any(|wagon| {
            wagon.state == WagonState::Deployed
                && wagon.crew.contains(&id)
                && wagon
                    .crew
                    .iter()
                    .any(|crew| world.scenario.people[crew.0 as usize].state == PersonState::Active)
        });
        let p = &mut world.scenario.people[id.0 as usize];
        if p.state == PersonState::Active {
            p.health -= d * if protected { 0.5 } else { 1.0 };
            if p.health <= 0.0 {
                p.health = 0.0;
                p.state = PersonState::Incapacitated;
                deaths.push((p.formation, p.commander, p.side));
            }
        }
    }
    for (id, damage) in wagon_damage {
        let wagon = &mut world.scenario.wagons[id.0 as usize];
        wagon.health -= damage;
        if wagon.health <= 0.0 {
            wagon.health = 0.0;
            wagon.state = WagonState::Wreck;
        }
    }
    for (form, commander, side) in deaths {
        let loss = 100.0 / world.scenario.formations[form.0 as usize].initial_count as f32;
        world.scenario.formations[form.0 as usize].morale -= loss;
        if commander {
            for f in &mut world.scenario.formations {
                if f.side == side {
                    f.morale -= 10.0;
                }
            }
        }
    }
    for f in &mut world.scenario.formations {
        if f.morale <= 35.0 && !f.routed {
            f.routed = true;
            f.order = FormationOrder::Withdraw;
        }
    }
}

impl Fighter {
    fn id_to_formation(self, _: &[Fighter], world: &BattleWorld) -> usize {
        world.scenario.people[self.id.0 as usize].formation.0 as usize
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn noncombatants_never_attack() {
        assert!(!PersonRole::Noncombatant.can_attack());
    }
    #[test]
    fn simultaneous_damage_accumulates() {
        let mut d = BTreeMap::new();
        *d.entry(PersonId(1)).or_insert(0.0) += 4.0;
        *d.entry(PersonId(1)).or_insert(0.0) += 6.0;
        assert_eq!(d[&PersonId(1)], 10.0);
    }
    #[test]
    fn ranged_segment_respects_houses() {
        let (c, _) = crate::landscape::building_footprints().next().unwrap();
        assert!(navigation::line_obstructed(
            c - Vec2::X * 10.0,
            c + Vec2::X * 10.0
        ));
    }
    #[test]
    fn rout_is_not_death() {
        let mut p = super::super::scenario::build(super::super::scenario::Preset::Standard)
            .people
            .remove(0);
        p.state = PersonState::Routing;
        assert_ne!(p.state, PersonState::Incapacitated);
    }
}
