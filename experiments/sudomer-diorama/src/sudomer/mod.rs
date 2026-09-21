//! Sourced Sudoměř geography with separately authored miniature dressing.
mod data;
mod scenery;
mod surface;

use bevy::{
    asset::RenderAssetUsages,
    image::{ImageAddressMode, ImageLoaderSettings, ImageSampler, ImageSamplerDescriptor},
    mesh::Indices,
    prelude::*,
    render::render_resource::PrimitiveTopology,
};
pub const SIZE: f32 = data::WORLD_SIZE_METRES;
pub const NAV_CELL_SIZE: f32 = SIZE / (data::MAP_N - 1) as f32;
// Used only to migrate existing authored map positions, never model dimensions.
pub const AUTHORED_TO_METRES: f32 = SIZE / 192.0;
const HEIGHT_SCALE: f32 = 1.0;
const GROUND_STEP: f32 = SIZE / 384.0;
const MAP_STEP: f32 = SIZE / (data::MAP_N - 1) as f32;
const SOFT_WEIGHTS: [u32; 5] = [1, 4, 6, 4, 1];
const HEIGHTS: &[u8] = include_bytes!("../../assets/terrain/sudomer_dmr5g.f32le");

pub fn land(x: f32, z: f32) -> [u8; 4] {
    let u = ((x / SIZE + 0.5) * (data::MAP_N - 1) as f32)
        .round()
        .clamp(0.0, (data::MAP_N - 1) as f32) as usize;
    let v = ((z / SIZE + 0.5) * (data::MAP_N - 1) as f32)
        .round()
        .clamp(0.0, (data::MAP_N - 1) as f32) as usize;
    let i = (v * data::MAP_N + u) * 4;
    data::LAND[i..i + 4].try_into().unwrap()
}
pub fn contains(x: f32, z: f32) -> bool {
    x.abs() <= SIZE * 0.5 && z.abs() <= SIZE * 0.5
}

pub fn building_footprints() -> impl Iterator<Item = (Vec2, Vec2)> {
    scenery::building_footprints()
}
fn road_coverage(x: f32, z: f32) -> f32 {
    // The road mask is deliberately kept binary for placement checks. Render it
    // through a small Gaussian footprint so diagonal tracks do not alternate
    // between whole road and whole grass triangles on the coarser ground mesh.
    let u = ((x / SIZE + 0.5) * (data::MAP_N - 1) as f32).round() as isize;
    let v = ((z / SIZE + 0.5) * (data::MAP_N - 1) as f32).round() as isize;
    let mut covered = 0u32;
    for (j, &wy) in SOFT_WEIGHTS.iter().enumerate() {
        for (i, &wx) in SOFT_WEIGHTS.iter().enumerate() {
            let px = (u + i as isize - 2).clamp(0, (data::MAP_N - 1) as isize) as usize;
            let pz = (v + j as isize - 2).clamp(0, (data::MAP_N - 1) as isize) as usize;
            if data::LAND[(pz * data::MAP_N + px) * 4 + 2] > 0 {
                covered += wx * wy;
            }
        }
    }
    covered as f32 / 256.0
}
pub fn detail(x: f32, z: f32) -> [u8; 4] {
    let u = ((x / SIZE + 0.5) * (data::MAP_N - 1) as f32)
        .round()
        .clamp(0.0, (data::MAP_N - 1) as f32) as usize;
    let v = ((z / SIZE + 0.5) * (data::MAP_N - 1) as f32)
        .round()
        .clamp(0.0, (data::MAP_N - 1) as f32) as usize;
    let i = (v * data::MAP_N + u) * 4;
    data::SURFACE[i..i + 4].try_into().unwrap()
}
pub fn shore_distance(x: f32, z: f32) -> f32 {
    (detail(x, z)[0] as f32 - 128.0) * (SIZE / 768.0)
}
fn raw(x: usize, z: usize) -> f32 {
    let i = (z.min(384) * 385 + x.min(384)) * 4;
    f32::from_le_bytes(HEIGHTS[i..i + 4].try_into().unwrap())
}
pub fn height(x: f32, z: f32) -> f32 {
    let u = ((x / SIZE + 0.5) * 384.0).clamp(0.0, 384.0);
    let v = ((z / SIZE + 0.5) * 384.0).clamp(0.0, 384.0);
    let a = u as usize;
    let b = v as usize;
    let h = raw(a, b)
        .lerp(raw(a + 1, b), u.fract())
        .lerp(raw(a, b + 1).lerp(raw(a + 1, b + 1), u.fract()), v.fract());
    let cell = land(x, z);
    if cell[0] == 1 {
        pond_height(cell[1]) - 0.12
    } else if cell[0] == 2 {
        pond_height(cell[1]) - 0.12
    } else {
        h * HEIGHT_SCALE
    }
}
/// The surface on which battle pieces stand. The drained pond is deliberately
/// sampled at its visible silt surface instead of the lowered terrain below it.
pub fn walkable_height(x: f32, z: f32) -> f32 {
    let cell = land(x, z);
    if cell[0] == 2 {
        pond_height(cell[1]) - 0.12
    } else {
        height(x, z)
    }
}

#[derive(Resource, Clone, Copy)]
pub struct SceneryOptions {
    pub illustrative_wagons: bool,
}

impl Default for SceneryOptions {
    fn default() -> Self {
        Self {
            illustrative_wagons: true,
        }
    }
}
fn pond_height(id: u8) -> f32 {
    data::POND_HEIGHTS[id as usize] * HEIGHT_SCALE + 0.035
}
pub fn noise(mut n: u32) -> f32 {
    n = n.wrapping_mul(747796405).wrapping_add(2891336453);
    n = ((n >> ((n >> 28) + 4)) ^ n).wrapping_mul(277803737);
    ((n >> 22) ^ n) as f32 / u32::MAX as f32
}
fn hard_pigment(x: f32, z: f32) -> Vec3 {
    let [kind, _, _, strip] = land(x, z);
    let mut c = match kind {
        1 => Vec3::new(0.40, 0.51, 0.40),
        2 => Vec3::new(0.61, 0.51, 0.37),
        3 => Vec3::new(0.51, 0.65, 0.42),
        4 => match strip % 5 {
            0 => Vec3::new(1.12, 1.06, 0.71),
            1 => Vec3::new(0.75, 0.87, 0.55),
            2 => Vec3::new(0.86, 0.73, 0.48),
            3 => Vec3::new(1.21, 1.13, 0.82),
            _ => Vec3::new(0.66, 0.79, 0.49),
        },
        6 => Vec3::new(1.06, 0.97, 0.71),
        _ => Vec3::new(0.81, 0.91, 0.62),
    };
    let variation = (x * 0.17).sin() * (z * 0.23).cos() * 0.04;
    c += Vec3::splat(variation);
    if kind == 4 {
        let d = detail(x, z);
        let row = (d[2] as f32 / 255.0 * std::f32::consts::TAU).sin() * 0.025;
        c += Vec3::splat(row);
        if d[3] < 15 {
            c = Vec3::new(0.64, 0.77, 0.52);
        }
    }
    c
}
fn pigment(x: f32, z: f32) -> [f32; 4] {
    let mut c = Vec3::ZERO;
    for (j, &wy) in SOFT_WEIGHTS.iter().enumerate() {
        for (i, &wx) in SOFT_WEIGHTS.iter().enumerate() {
            let dx = (i as f32 - 2.0) * MAP_STEP;
            let dz = (j as f32 - 2.0) * MAP_STEP;
            c += hard_pigment(x + dx, z + dz) * (wx * wy) as f32;
        }
    }
    c /= 256.0;
    c = c.lerp(Vec3::new(1.35, 1.22, 0.87), road_coverage(x, z));
    [c.x, c.y, c.z, 1.0]
}
fn floor_height(x: f32, z: f32) -> f32 {
    let mut y = height(x, z);
    // Lower all vertices touching a shoreline cell, so the continuous terrain
    // remains beneath the exact vector surface and cannot protrude through it.
    for dx in [-GROUND_STEP * 1.3, 0.0, GROUND_STEP * 1.3] {
        for dz in [-GROUND_STEP * 1.3, 0.0, GROUND_STEP * 1.3] {
            let cell = land(x + dx, z + dz);
            if matches!(cell[0], 1 | 2) {
                y = y.min(pond_height(cell[1]) - 0.36);
            }
        }
    }
    y
}
fn terrain_mesh() -> Mesh {
    const N: usize = 385;
    let mut p = Vec::with_capacity(N * N);
    let mut n = Vec::with_capacity(N * N);
    let mut c = Vec::with_capacity(N * N);
    let mut uv = Vec::with_capacity(N * N);
    let mut idx = Vec::new();
    for j in 0..N {
        for i in 0..N {
            let x = (i as f32 / (N - 1) as f32 - 0.5) * SIZE;
            let z = (j as f32 / (N - 1) as f32 - 0.5) * SIZE;
            p.push([x, floor_height(x, z), z]);
            n.push(
                Vec3::new(
                    floor_height(x - 0.25, z) - floor_height(x + 0.25, z),
                    0.5,
                    floor_height(x, z - 0.25) - floor_height(x, z + 0.25),
                )
                .normalize()
                .to_array(),
            );
            uv.push([x / 14.0, z / 14.0]);
            c.push(pigment(x, z));
        }
    }
    for j in 0..N - 1 {
        for i in 0..N - 1 {
            let a = (j * N + i) as u32;
            let b = a + 1;
            let cc = a + N as u32;
            let d = cc + 1;
            idx.extend_from_slice(&[a, cc, b, b, cc, d]);
        }
    }
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, p)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, n)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, c)
    .with_inserted_attribute(Mesh::ATTRIBUTE_UV_0, uv)
    .with_inserted_indices(Indices::U32(idx))
}
fn pond_mesh(mud: bool) -> Mesh {
    let mut p = Vec::new();
    let mut n = Vec::new();
    let mut uv = Vec::new();
    let mut colors = Vec::new();
    for triangle in data::POND_TRIANGLES.chunks_exact(36) {
        let read = |i: usize| f32::from_le_bytes(triangle[i..i + 4].try_into().unwrap());
        let id = read(8) as u8;
        if data::POND_DRAINED[id as usize] != mud {
            continue;
        }
        let mut stack = vec![[
            Vec2::new(read(0), read(4)),
            Vec2::new(read(12), read(16)),
            Vec2::new(read(24), read(28)),
        ]];
        while let Some(t) = stack.pop() {
            let lengths = [
                t[0].distance_squared(t[1]),
                t[1].distance_squared(t[2]),
                t[2].distance_squared(t[0]),
            ];
            let e = if lengths[0] > lengths[1] && lengths[0] > lengths[2] {
                0
            } else if lengths[1] > lengths[2] {
                1
            } else {
                2
            };
            if !mud && lengths[e] > 900.0 {
                let a = t[e];
                let b = t[(e + 1) % 3];
                let c = t[(e + 2) % 3];
                let m = (a + b) * 0.5;
                stack.push([a, m, c]);
                stack.push([m, b, c]);
                continue;
            }
            for q in t {
                let x = q.x;
                let z = q.y;
                p.push([x, pond_height(id) + if mud { -0.12 } else { 0.025 }, z]);
                let wave = (x * 2.3 + z * 1.1).sin() * 0.018 + (z * 3.1 - x * 0.7).cos() * 0.009;
                n.push(if mud {
                    [0.0, 1.0, 0.0]
                } else {
                    Vec3::new(wave, 1.0, wave * 0.55).normalize().to_array()
                });
                uv.push([x / 6.0, z / 6.0]);
                let depth = (-shore_distance(x, z) / 25.0).clamp(0.0, 1.0);
                let c = if mud {
                    Vec3::ONE
                } else {
                    Vec3::new(0.075, 0.115, 0.086).lerp(Vec3::new(0.023, 0.060, 0.072), depth)
                };
                colors.push([c.x, c.y, c.z, 1.0]);
            }
        }
    }
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, p)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, n)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, colors)
    .with_inserted_attribute(Mesh::ATTRIBUTE_UV_0, uv)
}

fn sides() -> Mesh {
    let mut p = Vec::new();
    let mut n = Vec::new();
    let mut colors = Vec::new();
    for edge in 0..4 {
        for i in 0..384 {
            let a = -SIZE / 2.0 + i as f32 * SIZE / 384.0;
            let b = a + SIZE / 384.0;
            let s = SIZE / 2.0;
            let (a, b, normal) = match edge {
                0 => (Vec2::new(a, -s), Vec2::new(b, -s), Vec3::NEG_Z),
                1 => (Vec2::new(s, a), Vec2::new(s, b), Vec3::X),
                2 => (Vec2::new(-a, s), Vec2::new(-b, s), Vec3::Z),
                _ => (Vec2::new(-s, -a), Vec2::new(-s, -b), Vec3::NEG_X),
            };
            for band in 0..3 {
                let lo = band as f32 / 3.0;
                let hi = (band + 1) as f32 / 3.0;
                let aa = Vec3::new(a.x, (-2.2).lerp(height(a.x, a.y), lo), a.y);
                let ab = Vec3::new(b.x, (-2.2).lerp(height(b.x, b.y), lo), b.y);
                let ba = Vec3::new(a.x, (-2.2).lerp(height(a.x, a.y), hi), a.y);
                let bb = Vec3::new(b.x, (-2.2).lerp(height(b.x, b.y), hi), b.y);
                let tone = 0.11 + band as f32 * 0.028;
                for v in [aa, ba, ab, ab, ba, bb] {
                    p.push(v.to_array());
                    n.push(normal.to_array());
                    colors.push([tone * 1.3, tone, tone * 0.68, 1.0]);
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
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, colors)
}
pub fn spawn(
    mut commands: Commands,
    server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut mats: ResMut<Assets<StandardMaterial>>,
    options: Option<Res<SceneryOptions>>,
) {
    let texture = server
        .load_builder()
        .with_settings(|s: &mut ImageLoaderSettings| {
            s.sampler = ImageSampler::Descriptor(ImageSamplerDescriptor {
                address_mode_u: ImageAddressMode::Repeat,
                address_mode_v: ImageAddressMode::Repeat,
                anisotropy_clamp: 8,
                ..ImageSamplerDescriptor::linear()
            });
        })
        .load("textures/sudomer-meadow.png");
    commands.spawn((
        Name::new("Georeferenced painted landscape"),
        Mesh3d(meshes.add(terrain_mesh())),
        MeshMaterial3d(mats.add(StandardMaterial {
            base_color_texture: Some(texture),
            perceptual_roughness: 1.0,
            reflectance: 0.06,
            ..default()
        })),
    ));
    let mud_texture = server
        .load_builder()
        .with_settings(|s: &mut ImageLoaderSettings| {
            s.sampler = ImageSampler::Descriptor(ImageSamplerDescriptor {
                address_mode_u: ImageAddressMode::Repeat,
                address_mode_v: ImageAddressMode::Repeat,
                anisotropy_clamp: 8,
                ..ImageSamplerDescriptor::linear()
            });
        })
        .load("textures/sudomer-pond-mud.png");
    commands.spawn((
        Name::new("Drained Skaredy silt"),
        Mesh3d(meshes.add(pond_mesh(true))),
        MeshMaterial3d(mats.add(StandardMaterial {
            base_color_texture: Some(mud_texture),
            base_color: Color::srgb(0.85, 0.82, 0.75),
            perceptual_roughness: 0.91,
            reflectance: 0.12,
            ..default()
        })),
    ));
    commands.spawn((
        Name::new("Mapped ponds; Skaredy is drained"),
        Mesh3d(meshes.add(pond_mesh(false))),
        MeshMaterial3d(mats.add(StandardMaterial {
            base_color: Color::WHITE,
            perceptual_roughness: 0.38,
            metallic: 0.20,
            ..default()
        })),
    ));
    commands.spawn((
        Name::new("Cut earth"),
        Mesh3d(meshes.add(sides())),
        MeshMaterial3d(mats.add(StandardMaterial {
            base_color: Color::WHITE,
            perceptual_roughness: 1.0,
            ..default()
        })),
    ));
    commands.spawn((
        Name::new("Display plinth"),
        Mesh3d(meshes.add(Cuboid::new(SIZE + 0.8, 1.2, SIZE + 0.8))),
        MeshMaterial3d(mats.add(StandardMaterial {
            base_color: Color::srgb(0.14, 0.15, 0.14),
            ..default()
        })),
        Transform::from_xyz(0.0, -2.8, 0.0),
    ));
    commands.spawn((
        Name::new("Studio floor"),
        Mesh3d(meshes.add(Plane3d::default().mesh().size(SIZE * 10.0, SIZE * 10.0))),
        MeshMaterial3d(mats.add(StandardMaterial {
            base_color: Color::srgb(0.16, 0.19, 0.21),
            perceptual_roughness: 1.0,
            ..default()
        })),
        Transform::from_xyz(0.0, -3.5, 0.0),
    ));
    surface::spawn(&mut commands, &server, &mut meshes, &mut mats);
    scenery::spawn(
        &mut commands,
        &server,
        &mut meshes,
        &mut mats,
        options.as_deref().copied().unwrap_or_default(),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn retained_map_has_exact_dimensions_and_valid_pond_ids() {
        assert_eq!(data::LAND.len(), data::MAP_N * data::MAP_N * 4);
        assert_eq!(data::SURFACE.len(), data::LAND.len());
        assert!(shore_distance(7.99 * AUTHORED_TO_METRES, -36.0 * AUTHORED_TO_METRES) < 0.0);
        assert!(
            data::SURFACE
                .chunks_exact(4)
                .all(|p| (104..=152).contains(&p[0]))
        );
        for pixel in data::LAND.chunks_exact(4) {
            assert!((pixel[1] as usize) < data::POND_HEIGHTS.len());
        }
    }
    #[test]
    fn road_rendering_has_feathered_edges() {
        let mut soft_samples = 0;
        let mut strongest: f32 = 0.0;
        for j in 0..385 {
            for i in 0..385 {
                let x = (i as f32 / 384.0 - 0.5) * SIZE;
                let z = (j as f32 / 384.0 - 0.5) * SIZE;
                let coverage = road_coverage(x, z);
                assert!((0.0..=1.0).contains(&coverage));
                strongest = strongest.max(coverage);
                if coverage > 0.0 && coverage < 1.0 {
                    soft_samples += 1;
                }
            }
        }
        assert!(strongest > 0.8);
        assert!(soft_samples > 100);
    }
    #[test]
    fn field_rendering_has_feathered_edges() {
        let mut soft_samples = 0;
        for j in 0..385 {
            for i in 0..385 {
                let x = (i as f32 / 384.0 - 0.5) * SIZE;
                let z = (j as f32 / 384.0 - 0.5) * SIZE;
                if let Some((_, _, coverage)) = surface::field_layer(x, z) {
                    if coverage > 0.0 && coverage < 1.0 {
                        soft_samples += 1;
                    }
                }
            }
        }
        assert!(soft_samples > 500);
    }
    #[test]
    fn battlefield_geography_and_drained_pond_are_preserved() {
        assert_eq!(
            land(7.99 * AUTHORED_TO_METRES, -36.00 * AUTHORED_TO_METRES)[0],
            1
        ); // Markovec centre
        assert_eq!(
            land(25.54 * AUTHORED_TO_METRES, 8.22 * AUTHORED_TO_METRES)[0],
            2
        ); // Skaredy centre
        assert_eq!(
            land(-88.0 * AUTHORED_TO_METRES, -86.5 * AUTHORED_TO_METRES)[0],
            6
        ); // village
        assert!(height(25.54, 8.22).is_finite());
        assert!(height(0.0, 0.0).abs() < 50.0);
        assert!((SIZE - 2228.2449).abs() < 0.001);
        assert_eq!(HEIGHT_SCALE, 1.0);
    }
}
