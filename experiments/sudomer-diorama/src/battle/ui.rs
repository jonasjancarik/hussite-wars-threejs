use super::{input::Selection, model::*};
use bevy::prelude::*;

#[derive(Component)]
pub struct BattleHud;
#[derive(Component)]
pub(crate) struct HudText;
#[derive(Component, Clone, Copy)]
pub(crate) enum Action {
    Begin,
    Pause,
    Hold,
    Withdraw,
    Deploy,
    Reset,
}
pub fn setup_ui(mut commands: Commands) {
    commands.spawn((BattleHud,Node{position_type:PositionType::Absolute,left:Val::Px(18.0),top:Val::Px(18.0),width:Val::Px(330.0),padding:UiRect::all(Val::Px(14.0)),flex_direction:FlexDirection::Column,row_gap:Val::Px(8.0),..default()},BackgroundColor(Color::srgba(0.07,0.08,0.07,0.88)))).with_children(|p|{p.spawn((HudText,Text::new("Sudomer - Preparing"),TextFont{font_size:FontSize::Px(22.0),..default()}));p.spawn((Text::new("400 people - 12 wagons\n300 combatants - 100 noncombatants\nScenario estimate; historical numbers are uncertain."),TextFont{font_size:FontSize::Px(13.0),..default()}));p.spawn((Node{display:Display::Flex,flex_wrap:FlexWrap::Wrap,column_gap:Val::Px(6.0),row_gap:Val::Px(6.0),..default()},)).with_children(|r|{for(label,action)in[("Begin battle",Action::Begin),("Pause / Resume",Action::Pause),("Hold",Action::Hold),("Withdraw",Action::Withdraw),("Deploy / Pack",Action::Deploy),("Reset",Action::Reset)]{r.spawn((Button,action,Node{padding:UiRect::axes(Val::Px(9.0),Val::Px(7.0)),..default()},BackgroundColor(Color::srgb(0.18,0.20,0.17)))).with_child((Text::new(label),TextFont{font_size:FontSize::Px(12.0),..default()}));}});});
}
pub fn update_ui(
    mut interactions: Query<(&Interaction, &Action), (Changed<Interaction>, With<Button>)>,
    mut world: ResMut<BattleWorld>,
    mut selection: ResMut<Selection>,
    mut texts: Query<&mut Text, With<HudText>>,
) {
    for (i, a) in &mut interactions {
        if *i != Interaction::Pressed {
            continue;
        }
        selection.ui_consumed = true;
        match a {
            Action::Begin => world.commands.push(BattleCommand::Begin),
            Action::Pause => world.commands.push(BattleCommand::TogglePause),
            Action::Hold => {
                for &id in &selection.formations {
                    world
                        .commands
                        .push(BattleCommand::Order(id, FormationOrder::Hold, None))
                }
            }
            Action::Withdraw => {
                for &id in &selection.formations {
                    world
                        .commands
                        .push(BattleCommand::Order(id, FormationOrder::Withdraw, None))
                }
            }
            Action::Deploy => {
                for i in 0..world.scenario.wagons.len() {
                    let deploy = world.scenario.wagons[i].state == WagonState::Packed;
                    world
                        .commands
                        .push(BattleCommand::Wagon(WagonId(i as u16), deploy));
                }
            }
            Action::Reset => world.commands.push(BattleCommand::Reset),
        }
    }
    if let Some(mut t) = texts.iter_mut().next() {
        let left = (world.scenario.tuning.dusk_seconds - world.elapsed).max(0.0);
        **t = format!(
            "Sudomer - {:?}\n{} people remain - {} noncombatants\n{} selected - dusk in {:02}:{:02}",
            world.phase,
            world.survivors(Side::Defender),
            world.noncombatant_survivors(),
            selection.formations.len(),
            left as u32 / 60,
            left as u32 % 60
        );
    }
}
