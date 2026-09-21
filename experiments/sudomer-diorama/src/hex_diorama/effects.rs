use super::{BoardCamera, board, bridge::SnapshotState};
use bevy::{light::NotShadowCaster, prelude::*};
use std::collections::HashSet;

#[derive(Component)]
pub struct Wisp {
    age: f32,
    smoke: bool,
}
pub fn sync(
    mut commands: Commands,
    state: Res<SnapshotState>,
    mut seen: Local<(u32, HashSet<String>)>,
    existing: Query<Entity, With<Wisp>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    if !state.changed {
        return;
    }
    let Some(s) = &state.current else { return };
    if seen.0 != s.generation {
        seen.0 = s.generation;
        seen.1.clear();
        for entity in &existing {
            commands.entity(entity).despawn();
        }
    }
    for e in &s.events {
        if !seen.1.insert(e.id.clone())
            || !(e.r#type == "attack" || e.r#type == "explosion" || e.r#type == "move")
        {
            continue;
        }
        let smoke = e.r#type != "move";
        commands.spawn((
            Wisp { age: 0.0, smoke },
            NotShadowCaster,
            Mesh3d(meshes.add(Rectangle::new(1.0, 1.0))),
            MeshMaterial3d(materials.add(StandardMaterial {
                base_color: if smoke {
                    Color::srgba(0.72, 0.72, 0.68, 0.35)
                } else {
                    Color::srgba(0.52, 0.38, 0.20, 0.25)
                },
                alpha_mode: AlphaMode::Blend,
                unlit: true,
                cull_mode: None,
                ..default()
            })),
            Transform::from_translation(
                board::center(e.col, e.row)
                    + Vec3::Y
                        * (board::height_at_coord(e.col, e.row) + if smoke { 2.5 } else { 0.8 }),
            ),
        ));
    }
    if seen.1.len() > 128 {
        seen.1.clear();
    }
}
pub fn animate(
    mut commands: Commands,
    time: Res<Time>,
    state: Res<SnapshotState>,
    camera: Single<&Transform, With<BoardCamera>>,
    mut wisps: Query<(Entity, &mut Wisp, &mut Transform), Without<BoardCamera>>,
) {
    let paused = state.current.as_ref().is_some_and(|s| s.paused);
    for (e, mut w, mut t) in &mut wisps {
        if !paused {
            w.age += time.delta_secs();
        }
        if w.age > 3.0 {
            commands.entity(e).despawn();
            continue;
        }
        if !paused {
            t.translation += Vec3::new(0.005, if w.smoke { 0.012 } else { 0.002 }, 0.002);
            t.scale = Vec3::splat(2.0 + w.age * if w.smoke { 1.4 } else { 2.0 });
        }
        t.rotation = camera.rotation;
    }
}
