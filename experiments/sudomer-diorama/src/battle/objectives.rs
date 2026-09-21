use super::model::*;
use bevy::prelude::*;

pub fn evaluate(world: &BattleWorld) -> Option<BattlePhase> {
    let defenders = world.survivors(Side::Defender);
    let civilians = world.noncombatant_survivors();
    let combatants = world.active_combatants(Side::Defender);
    if defenders < 200 || civilians < 75 || combatants == 0 {
        return Some(BattlePhase::Defeat);
    }
    let enemies_left = world.scenario.people.iter().any(|p| {
        p.side == Side::Attacker
            && !matches!(p.state, PersonState::Incapacitated | PersonState::Escaped)
    });
    if !enemies_left {
        return Some(BattlePhase::Victory);
    }
    if world.elapsed >= world.scenario.tuning.dusk_seconds {
        return Some(BattlePhase::Victory);
    }
    None
}
pub fn update_objectives(mut world: ResMut<BattleWorld>) {
    if world.phase != BattlePhase::Running {
        return;
    }
    if let Some(result) = evaluate(&world) {
        world.phase = result;
    }
}

#[cfg(test)]
mod tests {
    use super::super::scenario::{Policy, Preset};
    use super::*;
    #[test]
    fn routing_enemies_prevent_early_victory() {
        let mut w = BattleWorld::new(Preset::LowerEstimate, Policy::Hold, 1420);
        for p in &mut w.scenario.people {
            if p.side == Side::Attacker {
                p.state = PersonState::Routing;
            }
        }
        assert_ne!(evaluate(&w), Some(BattlePhase::Victory));
    }
    #[test]
    fn defeat_precedes_dusk_victory() {
        let mut w = BattleWorld::default();
        w.elapsed = 600.0;
        for p in w
            .scenario
            .people
            .iter_mut()
            .filter(|p| p.side == Side::Defender)
            .take(201)
        {
            p.state = PersonState::Incapacitated;
        }
        assert_eq!(evaluate(&w), Some(BattlePhase::Defeat));
    }
    #[test]
    fn exact_dusk_thresholds() {
        let mut w = BattleWorld::default();
        w.elapsed = 600.0;
        assert_eq!(evaluate(&w), Some(BattlePhase::Victory));
    }
}
