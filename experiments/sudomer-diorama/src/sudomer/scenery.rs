use super::*;

pub fn spawn(
    commands: &mut Commands,
    server: &AssetServer,
    meshes: &mut Assets<Mesh>,
    mats: &mut Assets<StandardMaterial>,
    options: SceneryOptions,
) {
    let model = |name: &str| -> Handle<WorldAsset> {
        server.load(GltfAssetLabel::Scene(0).from_asset(format!("models/{name}.glb")))
    };
    let trees = [
        model("procedural-worlds/pw_deciduous_01"),
        model("procedural-worlds/pw_deciduous_02"),
        model("procedural-worlds/pw_deciduous_03"),
    ];
    let shrub = model("procedural-worlds/pw_shrub_01");
    // Jittered lattice prevents both uniform rows and overlapping random clumps.
    for j in 0..168u32 {
        for i in 0..168u32 {
            let seed = j * 168 + i;
            let x = -SIZE * 0.49 + (i as f32 + noise(seed * 11)) * SIZE * 0.98 / 168.0;
            let z = -SIZE * 0.49 + (j as f32 + noise(seed * 11 + 1)) * SIZE * 0.98 / 168.0;
            let [kind, _, road, _] = land(x, z);
            if road > 0 || matches!(kind, 1 | 2 | 6) {
                continue;
            }
            let shore = [(-7.0, 0.0), (7.0, 0.0), (0.0, -7.0), (0.0, 7.0)]
                .iter()
                .any(|(dx, dz)| matches!(land(x + dx, z + dz)[0], 1 | 2));
            if x.abs() < 25.0 && (z - 30.0).abs() < 12.0 {
                continue;
            }
            let wooded = kind == 3;
            if !wooded && !(shore && noise(seed + 99) < 0.30) {
                continue;
            }
            if noise(seed * 7 + 13) > 0.80 {
                continue;
            }
            let scale = if wooded {
                0.85 + noise(seed + 21) * 0.30
            } else {
                0.55 + noise(seed + 21) * 0.25
            };
            commands.spawn((
                Name::new(if wooded {
                    "Mapped woodland"
                } else {
                    "Pond-side willow study"
                }),
                WorldAssetRoot(trees[(seed % 3) as usize].clone()),
                Transform::from_xyz(x, floor_height(x, z) - 0.03, z)
                    .with_scale(Vec3::new(
                        scale,
                        scale * (0.85 + noise(seed + 23) * 0.35),
                        scale,
                    ))
                    .with_rotation(Quat::from_rotation_y(noise(seed + 25) * 6.2831855)),
            ));
        }
    }
    for i in 0..6500u32 {
        let x = (noise(i * 19 + 9) - 0.5) * (SIZE - 4.0);
        let z = (noise(i * 19 + 10) - 0.5) * (SIZE - 4.0);
        let cell = land(x, z);
        let distance = shore_distance(x, z);
        if matches!(cell[0], 1 | 2 | 6)
            || cell[2] > 0
            || (x.abs() < 25.0 && (z - 30.0).abs() < 12.0)
        {
            continue;
        }
        let edge = cell[0] == 3
            && [(-8.0, 0.0), (8.0, 0.0), (0.0, -8.0), (0.0, 8.0)]
                .iter()
                .any(|(dx, dz)| land(x + dx, z + dz)[0] != 3);
        if !edge && !(distance > 2.0 && distance < 10.0) {
            continue;
        }
        let scale = 0.8 + noise(i + 35) * 0.4;
        commands.spawn((
            Name::new("Broken woodland and bank understory"),
            WorldAssetRoot(shrub.clone()),
            Transform::from_xyz(x, floor_height(x, z), z)
                .with_scale(Vec3::splat(scale))
                .with_rotation(Quat::from_rotation_y(noise(i + 31) * std::f32::consts::TAU)),
        ));
    }
    // The crop contains the southeastern edge of Sudomer. Houses are illustrative,
    // not modern footprint copies or claims about particular medieval buildings.
    let house = model("farmhouse");
    for &(u, v, yaw) in HOUSES {
        let x = u * AUTHORED_TO_METRES;
        let z = v * AUTHORED_TO_METRES;
        commands.spawn((
            Name::new("Sudomer period farmhouse interpretation"),
            WorldAssetRoot(house.clone()),
            Transform::from_xyz(x, height(x, z), z)
                .with_rotation(Quat::from_rotation_y(yaw))
                .with_scale(Vec3::ONE),
        ));
    }
    // Illustrative roadblock across the mapped approach, intentionally spanning the track.
    // This identifies the battlefield without claiming a battle simulation.
    if options.illustrative_wagons {
        let wagon = model("war_wagon");
        let banner = model("banner");
        for i in 0..5 {
            let x = -16.0 + i as f32 * 5.6;
            let z = 31.0 - i as f32 * 0.5;
            commands.spawn((
                Name::new("Illustrative wagon position"),
                WorldAssetRoot(wagon.clone()),
                Transform::from_xyz(x, height(x, z), z)
                    .with_scale(Vec3::ONE)
                    .with_rotation(Quat::from_rotation_y(0.1)),
            ));
        }
        commands.spawn((
            WorldAssetRoot(banner),
            Transform::from_xyz(-4.0, height(-4.0, 26.0), 26.0),
        ));
    }
    ground_details(commands, meshes, mats);
}
fn ground_details(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    mats: &mut Assets<StandardMaterial>,
) {
    let mut p = Vec::new();
    let mut n = Vec::new();
    let mut c = Vec::new();
    for i in 0..78000u32 {
        let x = (noise(i * 7 + 1) - 0.5) * (SIZE - 2.0);
        let z = (noise(i * 7 + 2) - 0.5) * (SIZE - 2.0);
        let [kind, _, road, strip] = land(x, z);
        if road > 0 || matches!(kind, 1 | 3 | 6) {
            continue;
        }
        let distance = shore_distance(x, z);
        let marsh = kind == 2 || (distance > 0.0 && distance < 8.0);

        if kind == 2 && noise(i + 2) > 0.12 {
            continue;
        }
        if !marsh && (kind != 4 || strip % 5 == 2) && noise(i + 3) > 0.13 {
            continue;
        }
        let h = if marsh {
            0.65 + noise(i + 5) * 0.60
        } else {
            0.10 + noise(i + 5) * 0.16
        };
        let width = if marsh { h * 0.055 } else { h * 0.15 };
        let base = Vec3::new(
            x,
            if kind == 2 {
                height(x, z) + 0.015
            } else {
                floor_height(x, z) + 0.02
            },
            z,
        );
        let color = if marsh {
            [0.26, 0.28, 0.12, 1.0]
        } else if strip % 5 == 1 || strip % 5 == 4 {
            [0.26, 0.32, 0.13, 1.0]
        } else {
            [0.47, 0.39, 0.20, 1.0]
        };
        let blades = if marsh { 5 } else { 2 };
        for blade in 0..blades {
            let angle = noise(i * 31 + blade) * std::f32::consts::TAU;
            let offset = Vec3::new(angle.cos(), 0.0, angle.sin()) * if marsh { 0.12 } else { 0.0 };
            let side = Vec3::new(-angle.sin(), 0.0, angle.cos()) * width;
            let tip =
                base + offset + Vec3::Y * h * (0.65 + noise(i * 37 + blade) * 0.6) + offset * 0.5;
            for v in [base + offset - side, base + offset + side, tip] {
                p.push(v.to_array());
                n.push([0.0, 1.0, 0.0]);
                c.push(color);
            }
        }
    }
    let mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, p)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, n)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, c);
    commands.spawn((
        Name::new("Spring shoots, stubble and shoreline reeds"),
        Mesh3d(meshes.add(mesh)),
        MeshMaterial3d(mats.add(StandardMaterial {
            base_color: Color::WHITE,
            perceptual_roughness: 1.0,
            cull_mode: None,
            ..default()
        })),
    ));
}

// Geographic positions retained in the original authored 192-wide layout.
// Mesh dimensions are metres at scale one; these are not model scale factors.
const HOUSES: &[(f32, f32, f32)] = &[
    (-88.0, -84.0, 0.1),
    (-80.5, -83.0, 0.15),
    (-73.0, -88.5, 0.0),
    (-89.0, -78.0, 1.5),
    (-78.0, -77.0, 0.1),
    (-66.0, -89.0, 0.0),
];
pub(super) fn building_footprints() -> impl Iterator<Item = (Vec2, Vec2)> {
    HOUSES.iter().map(|&(u, v, _)| {
        (
            Vec2::new(u * AUTHORED_TO_METRES, v * AUTHORED_TO_METRES),
            Vec2::new(7.0, 7.0),
        )
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn farmhouse_footprints_clear_roads_and_ponds() {
        for &(u, v, _) in HOUSES {
            let x = u * AUTHORED_TO_METRES;
            let z = v * AUTHORED_TO_METRES;
            for i in -6..=6 {
                for j in -6..=6 {
                    let cell = land(x + i as f32 * 0.6, z + j as f32 * 0.6);
                    assert!(
                        !matches!(cell[0], 1 | 2 | 3),
                        "house at {x},{z} overlaps water or wood"
                    );
                    assert_eq!(cell[2], 0, "house at {x},{z} overlaps road");
                }
            }
        }
    }
}
