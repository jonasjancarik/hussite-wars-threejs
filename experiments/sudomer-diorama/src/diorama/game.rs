use super::{
    gameplay::{Attacker, BattleClock},
    layout::height,
};
use bevy::{prelude::*, world_serialization::WorldInstanceReady};

#[derive(Component)]
pub struct Cavalry;
#[derive(Component)]
pub struct WalkAnimation {
    pub graph: Handle<AnimationGraph>,
    pub index: AnimationNodeIndex,
    pub phase: f32,
}

pub fn unit(x: f32, z: f32, phase: f32) -> Attacker {
    let advance = Vec3::new(-10.0, 0.0, -12.0);
    Attacker {
        origin: Vec3::new(x, height(x, z), z),
        advance,
        initial_advance: advance,
        phase,
    }
}

pub fn play_when_ready(
    ready: On<WorldInstanceReady>,
    mut commands: Commands,
    children: Query<&Children>,
    clips: Query<&WalkAnimation>,
    mut players: Query<&mut AnimationPlayer>,
) {
    let Ok(clip) = clips.get(ready.entity) else {
        return;
    };
    for child in children.iter_descendants(ready.entity) {
        if let Ok(mut player) = players.get_mut(child) {
            player.play(clip.index).repeat().seek_to(clip.phase);
            commands
                .entity(child)
                .insert(AnimationGraphHandle(clip.graph.clone()));
        }
    }
}

pub fn controls(
    keys: Res<ButtonInput<KeyCode>>,
    mut clock: ResMut<BattleClock>,
    mut players: Query<&mut AnimationPlayer>,
    mut commands: Commands,
) {
    if keys.just_pressed(KeyCode::Space) {
        clock.paused = !clock.paused;
    }
    if keys.just_pressed(KeyCode::KeyR) {
        clock.elapsed = 0.0;
        clock.paused = false;
    }
    if keys.just_pressed(KeyCode::KeyP) {
        commands
            .spawn(bevy::render::view::screenshot::Screenshot::primary_window())
            .observe(bevy::render::view::screenshot::save_to_disk(
                "captures/battlefield-reference.png",
            ));
    }
    for mut player in &mut players {
        if clock.paused {
            player.pause_all();
        } else {
            player.resume_all();
        }
    }
}
