use super::{layout::*, noise};
use bevy::{
    asset::RenderAssetUsages,
    image::{ImageAddressMode, ImageLoaderSettings, ImageSampler, ImageSamplerDescriptor},
    mesh::Indices,
    prelude::*,
    render::render_resource::PrimitiveTopology,
};

pub fn spawn(
    mut commands: Commands,
    server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    let texture = server
        .load_builder()
        .with_settings(|s: &mut ImageLoaderSettings| {
            s.sampler = ImageSampler::Descriptor(ImageSamplerDescriptor {
                address_mode_u: ImageAddressMode::Repeat,
                address_mode_v: ImageAddressMode::Repeat,
                ..default()
            });
        })
        .load("textures/painted-ground.png");
    let ground = materials.add(StandardMaterial {
        base_color_texture: Some(texture),
        perceptual_roughness: 1.0,
        reflectance: 0.08,
        ..default()
    });
    commands.spawn((
        Name::new("Terrain colored from traced landscape regions"),
        Mesh3d(meshes.add(surface(0))),
        MeshMaterial3d(ground),
    ));
    commands.spawn((
        Name::new("Pond"),
        Mesh3d(meshes.add(surface(1))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.28, 0.39, 0.39),
            perceptual_roughness: 0.24,
            metallic: 0.12,
            ..default()
        })),
    ));
    commands.spawn((
        Name::new("Exposed miniature soil"),
        Mesh3d(meshes.add(sides())),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::WHITE,
            perceptual_roughness: 1.0,
            ..default()
        })),
    ));
    commands.spawn((
        Name::new("Display plinth"),
        Mesh3d(meshes.add(Cuboid::new(SIZE + 1.2, 1.6, SIZE + 1.2))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.17, 0.16, 0.14),
            perceptual_roughness: 0.62,
            ..default()
        })),
        Transform::from_xyz(0.0, -0.8, 0.0),
    ));
    commands.spawn((
        Name::new("Studio surface"),
        Mesh3d(meshes.add(Plane3d::default().mesh().size(1500.0, 1500.0))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.17, 0.20, 0.22),
            perceptual_roughness: 1.0,
            ..default()
        })),
        Transform::from_xyz(0.0, -1.7, 0.0),
    ));
    commands.spawn((
        Name::new("Traced strip fields"),
        Mesh3d(meshes.add(surface(2))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::WHITE,
            perceptual_roughness: 1.0,
            ..default()
        })),
    ));
    vegetation(&mut commands, &server);
    grass(&mut commands, &mut meshes, &mut materials);
}

fn surface(kind: u8) -> Mesh {
    let water = kind == 1;
    const N: usize = 193;
    let mut pos = Vec::new();
    let mut normals = Vec::new();
    let mut colors = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();
    for j in 0..N {
        for i in 0..N {
            let u = i as f32 / (N - 1) as f32;
            let v = j as f32 / (N - 1) as f32;
            let p = world(u, v);
            let y = if water {
                3.8
            } else {
                height(p.x, p.y) + if kind == 2 { 0.025 } else { 0.0 }
            };
            let dx = height(p.x + 0.2, p.y) - height(p.x - 0.2, p.y);
            let dz = height(p.x, p.y + 0.2) - height(p.x, p.y - 0.2);
            pos.push([p.x, y, p.y]);
            normals.push(if water {
                [0.0, 1.0, 0.0]
            } else {
                Vec3::new(-dx, 0.4, -dz).normalize().to_array()
            });
            uvs.push([p.x / 18.0, p.y / 18.0]);
            let q = Vec2::new(u, v);
            let variation = (p.x * 0.25).sin() * (p.y * 0.18).cos() * 0.08;
            let mut color = Vec3::new(0.82 + variation, 0.90 + variation, 0.69 + variation);
            if wooded(q) {
                color = Vec3::new(0.45, 0.56, 0.35);
            }
            if let Some(f) = field(q) {
                let row = (p.x * 1.5 + p.y * 3.0).sin() * 0.09;
                color = if f % 3 == 0 {
                    Vec3::new(0.82 + row, 0.66 + row, 0.44 + row)
                } else {
                    Vec3::new(1.32 + row, 1.10 + row, 0.68 + row)
                };
            }
            let road = (1.0 - road_distance(q) / 1.9).clamp(0.0, 1.0);
            color = color.lerp(Vec3::new(1.55, 1.24, 0.86), road.sqrt());
            if kind == 2 {
                let f = field(q).unwrap_or(0);
                let row = (p.x * 0.95 + p.y * 2.0).sin() * 0.022;
                color = if f % 3 == 0 {
                    Vec3::new(0.26 + row, 0.19 + row, 0.095 + row)
                } else {
                    Vec3::new(0.44 + row, 0.34 + row, 0.16 + row)
                };
            }
            if water {
                color = Vec3::splat(0.85 + 0.1 * (p.x * 0.9 + p.y * 0.7).sin());
            }
            colors.push([color.x, color.y, color.z, 1.0]);
        }
    }
    for j in 0..N - 1 {
        for i in 0..N - 1 {
            let q = Vec2::new(
                (i as f32 + 0.5) / (N - 1) as f32,
                (j as f32 + 0.5) / (N - 1) as f32,
            );
            if (water && !inside(q, POND)) || (kind == 2 && field(q).is_none()) {
                continue;
            }
            let a = (j * N + i) as u32;
            let b = a + 1;
            let c = a + N as u32;
            let d = c + 1;
            indices.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, pos)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_attribute(Mesh::ATTRIBUTE_UV_0, uvs)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, colors)
    .with_inserted_indices(Indices::U32(indices))
}
fn sides() -> Mesh {
    let mut p = Vec::new();
    let mut n = Vec::new();
    let mut c = Vec::new();
    for edge in 0..4 {
        for i in 0..96 {
            let a = -SIZE / 2.0 + i as f32;
            let b = a + 1.0;
            let half = SIZE / 2.0;
            let (a, b, normal) = match edge {
                0 => (Vec2::new(a, -half), Vec2::new(b, -half), Vec3::NEG_Z),
                1 => (Vec2::new(half, a), Vec2::new(half, b), Vec3::X),
                2 => (Vec2::new(-a, half), Vec2::new(-b, half), Vec3::Z),
                _ => (Vec2::new(-half, -a), Vec2::new(-half, -b), Vec3::NEG_X),
            };
            let top_a = height(a.x, a.y);
            let top_b = height(b.x, b.y);
            for band in 0..3 {
                let lo = band as f32 / 3.0;
                let hi = (band + 1) as f32 / 3.0;
                let aa = Vec3::new(a.x, top_a * lo, a.y);
                let ab = Vec3::new(b.x, top_b * lo, b.y);
                let ba = Vec3::new(a.x, top_a * hi, a.y);
                let bb = Vec3::new(b.x, top_b * hi, b.y);
                for v in [aa, ba, ab, ab, ba, bb] {
                    p.push(v.to_array());
                    n.push(normal.to_array());
                    let t = 0.08 + band as f32 * 0.025 + noise(i as u32) * 0.012;
                    c.push([t * 1.3, t, t * 0.65, 1.0]);
                }
            }
        }
    }
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, p)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, n)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, c)
}
fn vegetation(commands: &mut Commands, server: &AssetServer) {
    let olive: Handle<WorldAsset> =
        server.load(GltfAssetLabel::Scene(0).from_asset("models/broadleaf_olive.glb"));
    let gold: Handle<WorldAsset> =
        server.load(GltfAssetLabel::Scene(0).from_asset("models/broadleaf_gold.glb"));
    for i in 0..1500u32 {
        let u = 0.015 + noise(i * 7 + 1) * 0.97;
        let v = 0.015 + noise(i * 7 + 2) * 0.97;
        let q = Vec2::new(u, v);
        let p = world(u, v);
        let woods = wooded(q);
        let hedge = FIELDS
            .iter()
            .any(|poly| edge_distance(q, poly) * SIZE < 0.55);
        if (!woods && !hedge) || road_distance(q) < 2.8 || inside(q, POND) {
            continue;
        }
        let scale = if woods {
            0.64 + noise(i * 7 + 3) * 0.42
        } else {
            0.12 + noise(i * 7 + 3) * 0.10
        };
        commands.spawn((
            Name::new(if woods {
                "Traced woodland"
            } else {
                "Field hedge"
            }),
            WorldAssetRoot(if i % 5 == 0 {
                gold.clone()
            } else {
                olive.clone()
            }),
            Transform::from_xyz(p.x, height(p.x, p.y) - 0.05, p.y)
                .with_scale(Vec3::new(scale, scale * (0.92 + noise(i + 9) * 0.3), scale))
                .with_rotation(Quat::from_rotation_y(noise(i) * 6.28)),
        ));
    }
}
fn grass(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let mut p = Vec::new();
    let mut n = Vec::new();
    let mut c = Vec::new();
    for i in 0..22000u32 {
        let q = Vec2::new(
            noise(i * 5 + 1) * 0.98 + 0.01,
            noise(i * 5 + 2) * 0.98 + 0.01,
        );
        if inside(q, POND) || road_distance(q) < 2.0 || wooded(q) {
            continue;
        }
        let point = world(q.x, q.y);
        let crop = field(q).is_some();
        let marsh = edge_distance(q, POND) * SIZE < 2.8;
        if !crop && !marsh && noise(i * 5 + 3) > 0.16 {
            continue;
        }
        let h = if marsh {
            0.65
        } else if crop {
            0.40
        } else {
            0.21
        };
        let width = h * 0.24;
        let base = Vec3::new(point.x, height(point.x, point.y) + 0.02, point.y);
        let color = if marsh {
            [0.18, 0.22, 0.10, 1.0]
        } else if crop {
            [0.43, 0.32, 0.12, 1.0]
        } else {
            [0.22, 0.25, 0.12, 1.0]
        };
        for side in [Vec3::X * width, Vec3::Z * width] {
            for vertex in [base - side, base + side, base + Vec3::Y * h] {
                p.push(vertex.to_array());
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
        Name::new("Batched stubble and reeds"),
        Mesh3d(meshes.add(mesh)),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::WHITE,
            cull_mode: None,
            perceptual_roughness: 1.0,
            ..default()
        })),
    ));
}
