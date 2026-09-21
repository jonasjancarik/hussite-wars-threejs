//! Shared scene pieces; the main game enables movement and cavalry animation.
use super::{BattleMode, game, layout::height, noise};
use bevy::prelude::*;

pub fn spawn(
    mut commands: Commands,
    server: Res<AssetServer>,
    mode: Res<BattleMode>,
    mut graphs: ResMut<Assets<AnimationGraph>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    let model = |name: &str| -> Handle<WorldAsset> {
        server.load(GltfAssetLabel::Scene(0).from_asset(format!("models/{name}.glb")))
    };
    let church = model("church");
    let house = model("farmhouse");
    place(
        &mut commands,
        church,
        -33.0,
        -36.0,
        -0.1,
        1.1,
        "Village church",
    );
    for (x, z, yaw, s) in [
        (-40.0, -39.0, 0.2, 0.8),
        (-41.0, -30.0, 0.1, 0.85),
        (-30.0, -28.0, -0.5, 0.78),
        (-37.0, -23.0, 0.3, 0.7),
    ] {
        place(
            &mut commands,
            house.clone(),
            x,
            z,
            yaw,
            s,
            "Village farmhouse",
        );
    }
    let wagon = model("war_wagon");
    let stakes = model("stakes");
    let banner = model("banner");
    let infantry = [
        model("infantry_polearm"),
        model("infantry_shield"),
        model("infantry_handgun"),
    ];
    for i in 0..8 {
        let x = -25.0 + i as f32 * 6.0;
        let z = -4.0 - i as f32 * 1.45;
        place(
            &mut commands,
            wagon.clone(),
            x,
            z,
            0.237,
            1.12,
            "Stationary wagon defense",
        );
        if i % 2 == 0 {
            place(
                &mut commands,
                stakes.clone(),
                x + 0.5,
                z + 4.6,
                0.237,
                0.9,
                "Defensive stakes",
            );
            place(
                &mut commands,
                banner.clone(),
                x - 0.7,
                z - 0.8,
                0.3,
                1.15,
                "Chalice standard",
            );
        }
        for j in 0..3 {
            place(
                &mut commands,
                infantry[(i + j) % 3].clone(),
                x - 2.0 + j as f32 * 1.8,
                z - 3.1,
                -1.1,
                1.20,
                "Fixed defender",
            );
        }
    }
    let base = meshes.add(Cylinder::new(0.61, 0.10));
    let base_mat = materials.add(StandardMaterial {
        base_color: Color::srgb(0.22, 0.24, 0.14),
        metallic: 0.15,
        perceptual_roughness: 0.75,
        ..default()
    });
    for i in 0..54u32 {
        let group = i / 27;
        let row = (i % 27) / 9;
        let col = i % 9;
        let x = -7.0 + group as f32 * 25.0 + col as f32 * 1.35 + noise(i * 7) * 0.4;
        let z = 10.0 + group as f32 * 10.0 + row as f32 * 1.5 + (col as f32 - 4.0).abs() * 0.22;
        let entity = place(
            &mut commands,
            infantry[i as usize % 3].clone(),
            x,
            z,
            2.05 + noise(i) * 0.2,
            1.4,
            "Tin-soldier infantry",
        );
        if mode.0 {
            commands
                .entity(entity)
                .insert(game::unit(x, z, noise(i * 17) * 1.3));
        } else {
            commands.spawn((
                Name::new("Infantry display base"),
                Mesh3d(base.clone()),
                MeshMaterial3d(base_mat.clone()),
                Transform::from_xyz(x, height(x, z) + 0.035, z),
            ));
        }
    }
    let horse = model("cavalry");
    let walk = if mode.0 {
        let (graph, index) = AnimationGraph::from_clip(
            server.load(GltfAssetLabel::Animation(0).from_asset("models/cavalry.glb")),
        );
        Some((graphs.add(graph), index))
    } else {
        None
    };
    for i in 0..18u32 {
        let group = i / 9;
        let row = (i % 9) / 3;
        let col = i % 3;
        let x = 13.0 + group as f32 * 15.0 + col as f32 * 3.2 + noise(i) * 0.5;
        let z = 0.0 + group as f32 * 3.0 + row as f32 * 3.5 + col as f32 * 0.6;
        let entity = place(
            &mut commands,
            horse.clone(),
            x,
            z,
            2.15 + noise(i) * 0.18,
            1.4,
            "Cavalry formation",
        );
        if let Some((ref graph, index)) = walk {
            commands
                .entity(entity)
                .insert((
                    game::unit(x, z, noise(i * 23) * 1.6),
                    game::Cavalry,
                    game::WalkAnimation {
                        graph: graph.clone(),
                        index,
                        phase: noise(i * 37) * 2.0,
                    },
                ))
                .observe(game::play_when_ready);
        }
    }
    let stone = meshes.add(Sphere::new(1.0).mesh().ico(0).unwrap());
    let stone_mat = materials.add(StandardMaterial {
        base_color: Color::srgb(0.39, 0.40, 0.35),
        perceptual_roughness: 1.0,
        ..default()
    });
    for i in 0..65u32 {
        let x = -42.0 + noise(i * 3 + 1) * 80.0;
        let z = -20.0 + noise(i * 3 + 2) * 57.0;
        if x > -20.0 && x < 35.0 && z < 30.0 {
            continue;
        }
        let s = 0.35 + noise(i * 3 + 3) * 0.55;
        commands.spawn((
            Name::new("Small fieldstone"),
            Mesh3d(stone.clone()),
            MeshMaterial3d(stone_mat.clone()),
            Transform::from_xyz(x, height(x, z) + s * 0.2, z).with_scale(Vec3::new(
                s,
                s * 0.65,
                s * 0.8,
            )),
        ));
    }
}
fn place(
    commands: &mut Commands,
    asset: Handle<WorldAsset>,
    x: f32,
    z: f32,
    yaw: f32,
    scale: f32,
    name: &'static str,
) -> Entity {
    commands
        .spawn((
            Name::new(name),
            WorldAssetRoot(asset),
            Transform::from_xyz(x, height(x, z), z)
                .with_rotation(Quat::from_rotation_y(yaw))
                .with_scale(Vec3::splat(scale)),
        ))
        .id()
}
