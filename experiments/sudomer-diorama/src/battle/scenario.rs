use bevy::prelude::*;

use super::model::{
    Formation, FormationId, FormationOrder, Person, PersonId, PersonRole, PersonState, Side, Wagon,
    WagonId, WagonState,
};

pub const DEFENDER_PEOPLE: usize = 400;
pub const DEFENDER_COMBATANTS: usize = 300;
pub const NONCOMBATANTS: usize = 100;
pub const WAGON_COUNT: usize = 12;
pub const WAGON_CREW: usize = 60;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Preset {
    #[default]
    Standard,
    LowerEstimate,
}

impl Preset {
    pub fn enemy_people(self) -> usize {
        match self {
            Self::Standard => 2_000,
            Self::LowerEstimate => 800,
        }
    }
    pub fn enemy_formations(self) -> usize {
        self.enemy_people() / 100
    }
    pub fn label(self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::LowerEstimate => "lower-estimate",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Policy {
    #[default]
    Hold,
    Respond,
    Exposed,
}

impl Policy {
    pub fn label(self) -> &'static str {
        match self {
            Self::Hold => "hold",
            Self::Respond => "respond",
            Self::Exposed => "exposed",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Tuning {
    pub dusk_seconds: f32,
    pub fixed_hz: f32,
    pub foot_speed: f32,
    pub mounted_speed: f32,
    pub wagon_speed: f32,
    pub deploy_seconds: f32,
}

impl Default for Tuning {
    fn default() -> Self {
        Self {
            dusk_seconds: 600.0,
            fixed_hz: 20.0,
            foot_speed: 1.4,
            mounted_speed: 3.0,
            wagon_speed: 0.8,
            deploy_seconds: 15.0,
        }
    }
}

#[derive(Clone)]
pub struct Scenario {
    pub preset: Preset,
    pub people: Vec<Person>,
    pub formations: Vec<Formation>,
    pub wagons: Vec<Wagon>,
    pub tuning: Tuning,
}

fn slots(center: Vec2, count: usize, columns: usize, dx: f32, dz: f32) -> Vec<Vec2> {
    (0..count)
        .map(|i| {
            let row = i / columns;
            let col = i % columns;
            center
                + Vec2::new(
                    (col as f32 - (columns - 1) as f32 * 0.5) * dx,
                    row as f32 * dz,
                )
        })
        .collect()
}

fn add_formation(
    people: &mut Vec<Person>,
    formations: &mut Vec<Formation>,
    next_person: &mut u32,
    next_formation: &mut u16,
    side: Side,
    role: PersonRole,
    count: usize,
    center: Vec2,
    columns: usize,
    group: u8,
) -> FormationId {
    let id = FormationId(*next_formation);
    *next_formation += 1;
    let spacing = if role.is_mounted() {
        (2.0, 3.5)
    } else {
        (1.2, 1.5)
    };
    let valid = |candidate: Vec2| {
        let separation = if role == PersonRole::WagonCrew {
            5.5
        } else if role.is_mounted() {
            42.0
        } else {
            16.0
        };
        if formations
            .iter()
            .any(|formation| formation.center.distance(candidate) < separation)
        {
            return false;
        }
        slots(candidate, count, columns, spacing.0, spacing.1)
            .into_iter()
            .all(|point| {
                crate::landscape::contains(point.x, point.y)
                    && crate::landscape::land(point.x, point.y)[0] != 1
                    && !crate::landscape::building_footprints().any(|(building, half)| {
                        (point - building)
                            .abs()
                            .cmple(half + Vec2::splat(1.0))
                            .all()
                    })
            })
    };
    let center = if valid(center) {
        center
    } else {
        (1..=50)
            .find_map(|ring| {
                let step = 10.0;
                (-ring..=ring)
                    .flat_map(|x| {
                        [
                            Vec2::new(x as f32 * step, ring as f32 * step),
                            Vec2::new(x as f32 * step, -(ring as f32) * step),
                        ]
                    })
                    .chain((-ring + 1..ring).flat_map(|z| {
                        [
                            Vec2::new(ring as f32 * step, z as f32 * step),
                            Vec2::new(-(ring as f32) * step, z as f32 * step),
                        ]
                    }))
                    .map(|offset| center + offset)
                    .find(|&candidate| valid(candidate))
            })
            .unwrap_or(center)
    };
    let mut members = Vec::with_capacity(count);
    for pos in slots(center, count, columns, spacing.0, spacing.1) {
        let pid = PersonId(*next_person);
        *next_person += 1;
        members.push(pid);
        people.push(Person {
            id: pid,
            side,
            role,
            formation: id,
            position: pos,
            health: 100.0,
            state: PersonState::Active,
            commander: false,
        });
    }
    formations.push(Formation {
        id,
        side,
        role,
        members,
        center,
        facing: if side == Side::Defender {
            0.0
        } else {
            std::f32::consts::PI
        },
        morale: 100.0,
        order: FormationOrder::Hold,
        destination: None,
        initial_count: count,
        group,
        released: side == Side::Defender || group == 0,
        routed: false,
        attack_cooldown: 0.0,
    });
    id
}

pub fn build(preset: Preset) -> Scenario {
    let mut people = Vec::with_capacity(DEFENDER_PEOPLE + preset.enemy_people());
    let mut formations = Vec::new();
    let mut wagons = Vec::new();
    let mut next_person = 0u32;
    let mut next_formation = 0u16;
    for i in 0..WAGON_COUNT {
        let center = Vec2::new(-36.0 + i as f32 * 6.5, 26.0 + (i % 2) as f32 * 1.2);
        let formation = add_formation(
            &mut people,
            &mut formations,
            &mut next_person,
            &mut next_formation,
            Side::Defender,
            PersonRole::WagonCrew,
            5,
            center + Vec2::new(0.0, 2.4),
            5,
            0,
        );
        let crew = formations[formation.0 as usize].members.clone();
        wagons.push(Wagon {
            id: WagonId(i as u16),
            crew,
            position: center,
            health: 800.0,
            state: WagonState::Packed,
            transition: 0.0,
        });
    }
    add_formation(
        &mut people,
        &mut formations,
        &mut next_person,
        &mut next_formation,
        Side::Defender,
        PersonRole::Handgunner,
        30,
        Vec2::new(-24.0, 34.0),
        15,
        0,
    );
    add_formation(
        &mut people,
        &mut formations,
        &mut next_person,
        &mut next_formation,
        Side::Defender,
        PersonRole::Handgunner,
        30,
        Vec2::new(22.0, 34.0),
        15,
        0,
    );
    for x in [-32.0, 0.0, 32.0] {
        add_formation(
            &mut people,
            &mut formations,
            &mut next_person,
            &mut next_formation,
            Side::Defender,
            PersonRole::Infantry,
            40,
            Vec2::new(x, 40.0),
            10,
            0,
        );
    }
    let reserve = add_formation(
        &mut people,
        &mut formations,
        &mut next_person,
        &mut next_formation,
        Side::Defender,
        PersonRole::FootReserve,
        51,
        Vec2::new(0.0, 58.0),
        13,
        2,
    );
    people[formations[reserve.0 as usize].members[0].0 as usize].commander = true;
    let mounted = add_formation(
        &mut people,
        &mut formations,
        &mut next_person,
        &mut next_formation,
        Side::Defender,
        PersonRole::MountedReserve,
        9,
        Vec2::new(-42.0, 58.0),
        3,
        2,
    );
    people[formations[mounted.0 as usize].members[0].0 as usize].commander = true;
    for x in [-38.0, -12.0, 14.0, 40.0] {
        add_formation(
            &mut people,
            &mut formations,
            &mut next_person,
            &mut next_formation,
            Side::Defender,
            PersonRole::Noncombatant,
            25,
            Vec2::new(x, 77.0),
            5,
            0,
        );
    }

    let enemy_forms = preset.enemy_formations();
    for i in 0..enemy_forms {
        let group = if preset == Preset::Standard {
            if i < 12 {
                0
            } else if i < 16 {
                1
            } else {
                2
            }
        } else if i < 4 {
            0
        } else if i < 6 {
            1
        } else {
            2
        };
        let row = i / 5;
        let col = i % 5;
        let center = if group == 1 {
            Vec2::new(120.0 + col as f32 * 20.0, -35.0 - row as f32 * 20.0)
        } else {
            Vec2::new(-90.0 + col as f32 * 38.0, -130.0 - row as f32 * 28.0)
        };
        let f = add_formation(
            &mut people,
            &mut formations,
            &mut next_person,
            &mut next_formation,
            Side::Attacker,
            PersonRole::Rider,
            100,
            center,
            10,
            group,
        );
        if i == 0 {
            people[formations[f.0 as usize].members[0].0 as usize].commander = true;
        }
    }
    Scenario {
        preset,
        people,
        formations,
        wagons,
        tuning: Tuning::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    #[test]
    fn exact_roster_accounting() {
        for preset in [Preset::Standard, Preset::LowerEstimate] {
            let s = build(preset);
            assert_eq!(DEFENDER_PEOPLE, DEFENDER_COMBATANTS + NONCOMBATANTS);
            assert_eq!(s.wagons.len(), 12);
            assert_eq!(s.wagons.iter().map(|w| w.crew.len()).sum::<usize>(), 60);
            assert_eq!(
                s.people.iter().filter(|p| p.side == Side::Attacker).count(),
                preset.enemy_people()
            );
            assert_eq!(
                s.people.iter().filter(|p| p.role.is_mounted()).count(),
                preset.enemy_people() + 9
            );
            assert_eq!(
                s.people.iter().map(|p| p.id).collect::<HashSet<_>>().len(),
                s.people.len()
            );
            assert_eq!(
                s.people
                    .iter()
                    .filter(|p| p.commander && p.side == Side::Attacker)
                    .count(),
                1
            );
            assert!(s.people.iter().all(|p| {
                crate::landscape::contains(p.position.x, p.position.y)
                    && crate::landscape::land(p.position.x, p.position.y)[0] != 1
            }));
        }
    }
}
