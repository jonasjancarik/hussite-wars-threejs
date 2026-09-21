pub mod ai;
pub mod combat;
pub mod diagnostics;
pub mod input;
pub mod model;
pub mod movement;
pub mod navigation;
pub mod objectives;
pub mod presentation;
pub mod scenario;
pub mod ui;

use bevy::prelude::*;

pub struct BattlePlugin;

impl Plugin for BattlePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<model::BattleWorld>()
            .init_resource::<input::Selection>()
            .init_resource::<diagnostics::PerformanceLog>()
            .init_resource::<diagnostics::MeasureConfig>()
            .init_resource::<diagnostics::EffectsEnabled>()
            .add_systems(
                Startup,
                (presentation::setup_battle, ui::setup_ui).after(crate::landscape::spawn),
            )
            .add_systems(
                Update,
                (
                    input::keyboard_controls,
                    input::pointer_controls,
                    input::touch_controls,
                    presentation::orbit_camera,
                    presentation::sync_pieces,
                    presentation::update_effects,
                    ui::update_ui,
                    diagnostics::sample_frames,
                ),
            )
            .add_systems(
                FixedUpdate,
                (
                    model::process_commands,
                    ai::update_ai,
                    movement::advance_formations,
                    combat::resolve_combat,
                    objectives::update_objectives,
                )
                    .chain(),
            );
    }
}
