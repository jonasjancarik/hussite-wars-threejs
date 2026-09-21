//! Soft ground transitions over the unchanged elevation and geography.
use super::*;

pub(super) fn field_layer(x: f32, z: f32) -> Option<(Vec3, f32, f32)> {
    let mut premultiplied = Vec3::ZERO;
    let mut alpha = 0.0;
    let mut coverage = 0.0;
    for (j, &wy) in SOFT_WEIGHTS.iter().enumerate() {
        for (i, &wx) in SOFT_WEIGHTS.iter().enumerate() {
            let weight = (wx * wy) as f32 / 256.0;
            let sx = x + (i as f32 - 2.0) * MAP_STEP;
            let sz = z + (j as f32 - 2.0) * MAP_STEP;
            let cell = land(sx, sz);
            if cell[0] != 4 {
                continue;
            }
            let d = detail(sx, sz);
            let mut color = match cell[3] % 5 {
                0 => Vec3::new(1.02, 0.90, 0.64),
                2 => Vec3::new(0.62, 0.51, 0.37),
                3 => Vec3::new(0.95, 0.86, 0.64),
                _ => Vec3::new(0.79, 0.84, 0.56),
            };
            let phase = d[2] as f32 / 255.0 * std::f32::consts::TAU;
            color *= 0.94 + phase.sin() * 0.06;
            let mut sample_alpha: f32 = if matches!(cell[3] % 5, 1 | 4) {
                0.23
            } else {
                0.83
            };
            if d[3] < 18 {
                sample_alpha *= d[3] as f32 / 18.0;
            }
            premultiplied += color * sample_alpha * weight;
            alpha += sample_alpha * weight;
            coverage += weight;
        }
    }
    (alpha > 0.0).then_some((premultiplied / alpha, alpha, coverage))
}

pub fn spawn(
    commands: &mut Commands,
    server: &AssetServer,
    meshes: &mut Assets<Mesh>,
    mats: &mut Assets<StandardMaterial>,
) {
    let grain = server
        .load_builder()
        .with_settings(|s: &mut ImageLoaderSettings| {
            s.sampler = ImageSampler::Descriptor(ImageSamplerDescriptor {
                address_mode_u: ImageAddressMode::Repeat,
                address_mode_v: ImageAddressMode::Repeat,
                anisotropy_clamp: 8,
                ..ImageSamplerDescriptor::linear()
            });
        })
        .load("textures/earth-grain.png");
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut colors = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();
    const N: usize = 385;
    for j in 0..N {
        for i in 0..N {
            let x = -SIZE / 2.0 + i as f32 * GROUND_STEP;
            let z = -SIZE / 2.0 + j as f32 * GROUND_STEP;
            let cell = land(x, z);
            let road = road_coverage(x, z);
            let d = detail(x, z);
            let shore = shore_distance(x, z);
            let mut color = Vec3::new(0.65, 0.59, 0.43);
            let mut alpha = 0.0;
            if let Some((field_color, field_alpha, _)) = field_layer(x, z) {
                color = field_color;
                alpha = field_alpha;
            }
            if shore > 0.0 && shore < 12.0 && road < 0.01 {
                let irregular = 9.0 + 2.0 * (x * 0.9 + z * 0.4).sin();
                let wet = (1.0 - shore / irregular).clamp(0.0, 1.0);
                color = color.lerp(Vec3::new(0.57, 0.54, 0.39), wet);
                alpha = alpha.max(wet * 0.92);
            }
            if road > 0.0 {
                color = color.lerp(Vec3::new(1.04, 0.94, 0.73), road);
                alpha = alpha.max(road * 0.86);
            }
            if matches!(cell[0], 1 | 2) {
                alpha = 0.0;
            }
            positions.push([x, floor_height(x, z) + 0.018, z]);
            normals.push(
                Vec3::new(
                    floor_height(x - 0.25, z) - floor_height(x + 0.25, z),
                    0.5,
                    floor_height(x, z - 0.25) - floor_height(x, z + 0.25),
                )
                .normalize()
                .to_array(),
            );
            let angle = d[1] as f32 / 255.0 * std::f32::consts::TAU;
            uvs.push([
                (x * angle.cos() + z * angle.sin()) / 7.0,
                (-x * angle.sin() + z * angle.cos()) / 7.0,
            ]);
            colors.push([color.x, color.y, color.z, alpha]);
        }
    }
    for j in 0..N - 1 {
        for i in 0..N - 1 {
            let a = j * N + i;
            let b = a + 1;
            let c = a + N;
            let d = c + 1;
            if [a, b, c, d].iter().all(|&v| colors[v][3] < 0.01) {
                continue;
            }
            indices
                .extend_from_slice(&[a as u32, c as u32, b as u32, b as u32, c as u32, d as u32]);
        }
    }
    let mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, colors)
    .with_inserted_attribute(Mesh::ATTRIBUTE_UV_0, uvs)
    .with_inserted_indices(Indices::U32(indices));
    commands.spawn((
        Name::new("Fallow fields, worn tracks and damp banks"),
        Mesh3d(meshes.add(mesh)),
        MeshMaterial3d(mats.add(StandardMaterial {
            base_color_texture: Some(grain),
            alpha_mode: AlphaMode::Blend,
            perceptual_roughness: 1.0,
            reflectance: 0.02,
            ..default()
        })),
    ));
}
