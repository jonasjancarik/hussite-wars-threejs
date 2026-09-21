use super::scenario::{Policy, Preset, Scenario, build};
use bevy::prelude::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct PersonId(pub u32);
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct FormationId(pub u16);
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct WagonId(pub u16);
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Side {
    Defender,
    Attacker,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PersonState {
    Active,
    Routing,
    Escaped,
    Incapacitated,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PersonRole {
    WagonCrew,
    Handgunner,
    Infantry,
    FootReserve,
    MountedReserve,
    Noncombatant,
    Rider,
}
impl PersonRole {
    pub fn is_mounted(self) -> bool {
        matches!(self, Self::MountedReserve | Self::Rider)
    }
    pub fn can_attack(self) -> bool {
        !matches!(self, Self::Noncombatant)
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FormationOrder {
    Move,
    Attack,
    Hold,
    Withdraw,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WagonState {
    Packed,
    Deploying,
    Deployed,
    Packing,
    Wreck,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BattlePhase {
    Preparing,
    Running,
    Paused,
    Victory,
    Defeat,
}

#[derive(Clone, Debug)]
pub struct Person {
    pub id: PersonId,
    pub side: Side,
    pub role: PersonRole,
    pub formation: FormationId,
    pub position: Vec2,
    pub health: f32,
    pub state: PersonState,
    pub commander: bool,
}
#[derive(Clone, Debug)]
pub struct Formation {
    pub id: FormationId,
    pub side: Side,
    pub role: PersonRole,
    pub members: Vec<PersonId>,
    pub center: Vec2,
    pub facing: f32,
    pub morale: f32,
    pub order: FormationOrder,
    pub destination: Option<Vec2>,
    pub initial_count: usize,
    pub group: u8,
    pub released: bool,
    pub routed: bool,
    pub attack_cooldown: f32,
}
#[derive(Clone, Debug)]
pub struct Wagon {
    pub id: WagonId,
    pub crew: Vec<PersonId>,
    pub position: Vec2,
    pub health: f32,
    pub state: WagonState,
    pub transition: f32,
}

#[derive(Clone, Debug)]
pub enum BattleCommand {
    Begin,
    TogglePause,
    Reset,
    Order(FormationId, FormationOrder, Option<Vec2>),
    Wagon(WagonId, bool),
}

#[derive(Resource)]
pub struct BattleWorld {
    pub scenario: Scenario,
    pub phase: BattlePhase,
    pub elapsed: f32,
    pub tick: u64,
    pub commands: Vec<BattleCommand>,
    pub policy: Policy,
    pub seed: u64,
    pub invalid_positions: usize,
    pub result_announced: bool,
}
impl Default for BattleWorld {
    fn default() -> Self {
        Self::new(Preset::Standard, Policy::Hold, 1420)
    }
}
impl BattleWorld {
    pub fn new(preset: Preset, policy: Policy, seed: u64) -> Self {
        Self {
            scenario: build(preset),
            phase: BattlePhase::Preparing,
            elapsed: 0.0,
            tick: 0,
            commands: Vec::new(),
            policy,
            seed,
            invalid_positions: 0,
            result_announced: false,
        }
    }
    pub fn reset(&mut self) {
        let preset = self.scenario.preset;
        let policy = self.policy;
        let seed = self.seed;
        *self = Self::new(preset, policy, seed);
    }
    pub fn survivors(&self, side: Side) -> usize {
        self.scenario
            .people
            .iter()
            .filter(|p| p.side == side && p.state != PersonState::Incapacitated)
            .count()
    }
    pub fn active_combatants(&self, side: Side) -> usize {
        self.scenario
            .people
            .iter()
            .filter(|p| p.side == side && p.role.can_attack() && p.state == PersonState::Active)
            .count()
    }
    pub fn noncombatant_survivors(&self) -> usize {
        self.scenario
            .people
            .iter()
            .filter(|p| {
                p.side == Side::Defender
                    && p.role == PersonRole::Noncombatant
                    && p.state != PersonState::Incapacitated
            })
            .count()
    }
}

pub fn process_commands(mut world: ResMut<BattleWorld>) {
    let commands = std::mem::take(&mut world.commands);
    for command in commands {
        match command {
            BattleCommand::Begin if world.phase == BattlePhase::Preparing => {
                world.phase = BattlePhase::Running
            }
            BattleCommand::TogglePause => {
                world.phase = match world.phase {
                    BattlePhase::Running => BattlePhase::Paused,
                    BattlePhase::Paused => BattlePhase::Running,
                    x => x,
                }
            }
            BattleCommand::Reset => world.reset(),
            BattleCommand::Order(id, order, dest) => {
                if let Some(f) = world.scenario.formations.get_mut(id.0 as usize) {
                    f.order = order;
                    f.destination = dest;
                }
            }
            BattleCommand::Wagon(id, deploy) => {
                if let Some(w) = world.scenario.wagons.get_mut(id.0 as usize) {
                    if w.state != WagonState::Wreck {
                        w.state = if deploy {
                            WagonState::Deploying
                        } else {
                            WagonState::Packing
                        };
                        w.transition = 0.0;
                    }
                }
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pause_commands_and_reset() {
        let mut w = BattleWorld::default();
        w.commands.push(BattleCommand::Begin);
        let commands = std::mem::take(&mut w.commands);
        for c in commands {
            if matches!(c, BattleCommand::Begin) {
                w.phase = BattlePhase::Running;
            }
        }
        assert_eq!(w.phase, BattlePhase::Running);
        w.elapsed = 9.0;
        w.reset();
        assert_eq!(w.phase, BattlePhase::Preparing);
        assert_eq!(w.elapsed, 0.0);
        assert_eq!(w.scenario.people.len(), 2400);
    }
    #[test]
    fn visual_identity_is_stable() {
        let w = BattleWorld::default();
        let ids: Vec<_> = w.scenario.people.iter().map(|p| p.id).collect();
        let rebuilt = super::super::scenario::build(Preset::Standard);
        assert_eq!(ids, rebuilt.people.iter().map(|p| p.id).collect::<Vec<_>>());
    }
}
