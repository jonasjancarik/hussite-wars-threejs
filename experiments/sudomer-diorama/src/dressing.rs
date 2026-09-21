//! Deterministic, batched meadow and field dressing for the concept-art scene.
use crate::terrain::height_at;
use bevy::{asset::RenderAssetUsages, prelude::*, render::render_resource::PrimitiveTopology};

fn noise(mut x: u32) -> f32 {
    x = x.wrapping_mul(747796405).wrapping_add(2891336453);
    x = ((x >> ((x >> 28) + 4)) ^ x).wrapping_mul(277803737);
    ((x >> 22) ^ x) as f32 / u32::MAX as f32
}

pub fn spawn(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut colors = Vec::new();
    // A single mesh for thousands of tufts avoids thousands of draw calls on WebGL.
    for i in 0..44_000u32 {
        let x = if i >= 38_000 {
            -8.0 + noise(i * 7 + 1) * 32.0
        } else {
            -180.0 + noise(i * 7 + 1) * 360.0
        };
        let z = if i >= 38_000 {
            68.0 + noise(i * 7 + 2) * 18.0
        } else {
            -125.0 + noise(i * 7 + 2) * 280.0
        };
        let creek = [
            (-111.0, 73.0),
            (-87.0, 64.0),
            (-60.0, 57.0),
            (-45.0, 68.0),
            (-38.0, 92.0),
            (-40.0, 125.0),
            (-25.0, 180.0),
        ];
        if creek.windows(2).any(|segment| {
            let a = Vec2::new(segment[0].0, segment[0].1);
            let b = Vec2::new(segment[1].0, segment[1].1);
            let point = Vec2::new(x, z);
            let t = ((point - a).dot(b - a) / (b - a).length_squared()).clamp(0.0, 1.0);
            point.distance(a.lerp(b, t)) < 4.0
        }) {
            continue;
        }
        let field = x > -8.0 && x < 24.0 && z > 68.0 && z < 86.0;
        let patch = (x * 0.18).sin() * (z * 0.21).cos();
        if !field && (patch < -0.15 || (z - (x * 0.55 - 16.0)).abs() < 6.0) {
            continue;
        }
        let y = height_at(x, z) + 0.05;
        let h = if field {
            0.9 + noise(i + 50) * 0.7
        } else {
            0.25 + noise(i + 50) * 0.55
        };
        let color = if field {
            [0.48, 0.34, 0.12, 1.0]
        } else {
            [0.19 + noise(i) * 0.10, 0.23 + noise(i) * 0.09, 0.09, 1.0]
        };
        for angle in [noise(i + 70) * 6.28, noise(i + 70) * 6.28 + 1.57] {
            let side = Vec3::new(angle.cos(), 0.0, angle.sin()) * h * 0.28;
            let base = Vec3::new(x, y, z);
            positions.extend([
                (base - side).to_array(),
                (base + side).to_array(),
                (base + Vec3::new(0.15, h, 0.05)).to_array(),
            ]);
            normals.extend([[0.0, 1.0, 0.0]; 3]);
            colors.extend([color; 3]);
        }
    }
    let mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, colors);
    commands.spawn((
        Name::new("Meadow tufts and standing grain"),
        Mesh3d(meshes.add(mesh)),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::WHITE,
            cull_mode: None,
            perceptual_roughness: 1.0,
            ..default()
        })),
    ));

    let rock = meshes.add(Sphere::new(1.0).mesh().ico(0).unwrap());
    let stone = materials.add(StandardMaterial {
        base_color: Color::srgb(0.40, 0.42, 0.40),
        perceptual_roughness: 1.0,
        ..default()
    });
    for i in 0..230u32 {
        let x = -145.0 + noise(i * 11 + 10) * 290.0;
        let z = 32.0 + noise(i * 11 + 11) * 105.0;
        if x > -25.0 && x < 120.0 && z < 115.0 {
            continue;
        }
        let scale = 0.4 + noise(i * 11 + 12) * 1.6;
        commands.spawn((
            Name::new("Weathered fieldstone"),
            Mesh3d(rock.clone()),
            MeshMaterial3d(stone.clone()),
            Transform::from_xyz(x, height_at(x, z) + scale * 0.3, z)
                .with_rotation(Quat::from_rotation_y(noise(i) * 6.28))
                .with_scale(Vec3::new(scale * 1.4, scale * 0.85, scale)),
        ));
    }
    let timber = materials.add(StandardMaterial {
        base_color: Color::srgb(0.24, 0.19, 0.12),
        perceptual_roughness: 1.0,
        ..default()
    });
    let post = meshes.add(Cuboid::new(0.22, 1.8, 0.22));
    let rail = meshes.add(Cuboid::new(3.0, 0.16, 0.16));
    for i in 0..18 {
        let x = -18.0 + i as f32 * 3.0;
        let z = 91.0;
        commands.spawn((
            Name::new("Pasture fence post"),
            Mesh3d(post.clone()),
            MeshMaterial3d(timber.clone()),
            Transform::from_xyz(x, height_at(x, z) + 0.85, z),
        ));
        if i < 17 {
            for h in [0.55, 1.25] {
                let rise = height_at(x + 3.0, z) - height_at(x, z);
                commands.spawn((
                    Name::new("Pasture fence rail"),
                    Mesh3d(rail.clone()),
                    MeshMaterial3d(timber.clone()),
                    Transform::from_xyz(x + 1.5, height_at(x + 1.5, z) + h, z)
                        .with_rotation(Quat::from_rotation_z((rise / 3.0).atan())),
                ));
            }
        }
    }
}
