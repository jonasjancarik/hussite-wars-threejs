use super::{
    HEX_RADIUS,
    bridge::{Coord, SnapshotState},
    noise,
};
use bevy::{
    asset::RenderAssetUsages,
    image::{ImageAddressMode, ImageLoaderSettings, ImageSampler, ImageSamplerDescriptor},
    light::NotShadowCaster,
    mesh::Indices,
    prelude::*,
    render::render_resource::PrimitiveTopology,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::hash::{DefaultHasher, Hash, Hasher};

pub const COLS: i32 = 20;
pub const ROWS: i32 = 12;
const ROOT3: f32 = 1.732_050_8;

#[derive(Component)]
pub struct Highlight;
#[derive(Component)]
pub struct GridLine;
#[derive(Component)]
pub struct ScenicProp;
#[derive(Resource, Default)]
pub struct GridState(pub bool);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Art {
    version: u32,
    scenario: String,
    source_revision: String,
    hex_radius: f32,
    palette: HashMap<String, String>,
    tile_overrides: HashMap<String, TileOverride>,
    off_board_props: Vec<OffBoardProp>,
}
#[derive(Debug, Deserialize)]
struct TileOverride {
    decoration: String,
}
#[derive(Debug, Deserialize)]
struct OffBoardProp {
    kind: String,
    side: String,
}

fn art() -> Art {
    serde_json::from_str(include_str!("../../web/hex-diorama/sudomer-art.json"))
        .expect("valid authored Sudomer art file")
}

pub fn center(col: i32, row: i32) -> Vec3 {
    let raw = Vec3::new(
        1.5 * HEX_RADIUS * col as f32,
        0.0,
        ROOT3 * HEX_RADIUS * (row as f32 + 0.5 * (col & 1) as f32),
    );
    let mid = Vec3::new(
        1.5 * HEX_RADIUS * (COLS - 1) as f32 * 0.5,
        0.0,
        ROOT3 * HEX_RADIUS * ((ROWS - 1) as f32 * 0.5 + 0.25),
    );
    raw - mid
}

pub fn terrain_for(col: i32, row: i32) -> &'static str {
    if (6..=13).contains(&col) && row <= 4 {
        "water"
    } else if (6..=13).contains(&col) && row >= 7 {
        "mud"
    } else if col == 9 && (row == 5 || row == 6) {
        "dam"
    } else {
        "plains"
    }
}

pub fn contains(point: Vec2, c: Vec2) -> bool {
    let p = (point - c).abs();
    p.x <= HEX_RADIUS && p.y <= ROOT3 * HEX_RADIUS * 0.5 && ROOT3 * p.x + p.y <= ROOT3 * HEX_RADIUS
}

pub fn coord_at(point: Vec2) -> Option<Coord> {
    let estimated_col = ((point.x - center(0, 0).x) / (1.5 * HEX_RADIUS)).round() as i32;
    for col in (estimated_col - 1).max(0)..=(estimated_col + 1).min(COLS - 1) {
        let row_base = ((point.y - center(col, 0).z) / (ROOT3 * HEX_RADIUS)).round() as i32;
        for row in (row_base - 1).max(0)..=(row_base + 1).min(ROWS - 1) {
            if contains(point, center(col, row).xz()) {
                return Some(Coord { col, row });
            }
        }
    }
    None
}

pub fn height_at(point: Vec2) -> f32 {
    let Some(coord) = coord_at(point) else {
        return -0.48 + 0.18 * (point.x * 0.035).sin() * (point.y * 0.026).cos();
    };
    match terrain_for(coord.col, coord.row) {
        "water" => -0.62,
        "mud" => {
            -0.32
                + 0.06 * (point.x * 0.34).sin() * (point.y * 0.29).cos()
                + 0.025 * (point.x * 0.73 + point.y * 0.41).sin()
        }
        "dam" => 0.16 + 0.05 * (point.y * 0.24).sin(),
        _ => {
            let broad = 1.05 * (point.x * 0.024).sin() * (point.y * 0.018 + 0.7).cos();
            let ridge = 0.62 * ((point.x + point.y * 0.32) * 0.043).sin();
            let edge_hills =
                ((point.x.abs() / 61.0).powi(3) + (point.y.abs() / 43.0).powi(3)) * 1.25;
            broad + ridge + edge_hills
        }
    }
}

pub fn height_at_coord(col: i32, row: i32) -> f32 {
    height_at(center(col, row).xz())
}

fn road_distance(point: Vec2) -> f32 {
    let road_z = 0.5 + (point.x * 0.055).sin() * 3.8 + point.x * 0.015;
    (point.y - road_z).abs()
}

fn field_kind(point: Vec2) -> Option<u8> {
    if point.x > 16.0 && point.y > 8.0 {
        Some(0)
    } else if point.x < -23.0 && point.y < -10.0 {
        Some(1)
    } else if point.x > 28.0 && point.y < -12.0 {
        Some(2)
    } else {
        None
    }
}

fn palette_color(palette: &HashMap<String, String>, name: &str) -> Vec3 {
    let value = palette
        .get(name)
        .unwrap_or_else(|| panic!("missing {name} palette color"));
    let hex = value.trim_start_matches('#');
    assert_eq!(hex.len(), 6, "palette colors must use #RRGGBB");
    let channel = |offset| u8::from_str_radix(&hex[offset..offset + 2], 16).unwrap() as f32 / 255.0;
    Vec3::new(channel(0), channel(2), channel(4))
}

fn color_for(point: Vec2, terrain: &str, palette: &HashMap<String, String>) -> [f32; 4] {
    let grain = 0.035 * (point.x * 0.47).sin() * (point.y * 0.39).cos()
        + 0.018 * (point.x * 1.13 + point.y * 0.71).sin();
    let base = match terrain {
        "water" => palette_color(palette, "water"),
        "mud" => palette_color(palette, "mud"),
        "dam" => palette_color(palette, "dam"),
        _ => {
            if let Some(kind) = field_kind(point) {
                let stripe = ((point.x * 0.92 + point.y * 0.31).sin() * 0.5 + 0.5) * 0.12;
                match kind {
                    0 => Vec3::new(0.90 + stripe, 0.70 + stripe * 0.75, 0.34),
                    1 => Vec3::new(0.80 + stripe, 0.58 + stripe * 0.6, 0.28),
                    _ => Vec3::new(0.96 + stripe, 0.77 + stripe * 0.55, 0.39),
                }
            } else {
                palette_color(palette, "plains")
            }
        }
    };
    let mut color = base + Vec3::splat(grain);
    if terrain != "water" && road_distance(point) < 2.25 {
        let blend = (1.0 - road_distance(point) / 2.25).sqrt();
        color = color.lerp(Vec3::new(0.97, 0.73, 0.42), blend * 0.82);
    }
    [color.x, color.y, color.z, 1.0]
}

fn landscape_mesh(authored: &Art) -> Mesh {
    const NX: usize = 183;
    const NZ: usize = 131;
    let (min_x, max_x, min_z, max_z) = (-74.0, 74.0, -55.0, 55.0);
    let mut positions = Vec::with_capacity(NX * NZ);
    let mut normals = Vec::with_capacity(NX * NZ);
    let mut colors = Vec::with_capacity(NX * NZ);
    let mut uvs = Vec::with_capacity(NX * NZ);
    for z_index in 0..NZ {
        for x_index in 0..NX {
            let u = x_index as f32 / (NX - 1) as f32;
            let v = z_index as f32 / (NZ - 1) as f32;
            let point = Vec2::new(min_x + (max_x - min_x) * u, min_z + (max_z - min_z) * v);
            let y = height_at(point);
            let dx =
                height_at(point + Vec2::new(0.18, 0.0)) - height_at(point - Vec2::new(0.18, 0.0));
            let dz =
                height_at(point + Vec2::new(0.0, 0.18)) - height_at(point - Vec2::new(0.0, 0.18));
            let terrain = coord_at(point)
                .map(|c| terrain_for(c.col, c.row))
                .unwrap_or("plains");
            positions.push([point.x, y, point.y]);
            normals.push(Vec3::new(-dx, 0.36, -dz).normalize().to_array());
            colors.push(color_for(point, terrain, &authored.palette));
            uvs.push([point.x / 22.0, point.y / 22.0]);
        }
    }
    let mut indices = Vec::with_capacity((NX - 1) * (NZ - 1) * 6);
    for z_index in 0..NZ - 1 {
        for x_index in 0..NX - 1 {
            let a = (z_index * NX + x_index) as u32;
            let (b, c, d) = (a + 1, a + NX as u32, a + NX as u32 + 1);
            indices.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_attribute(Mesh::ATTRIBUTE_UV_0, uvs)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, colors)
    .with_inserted_indices(Indices::U32(indices))
}

fn ring_mesh() -> Mesh {
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut indices = Vec::new();
    for i in 0..6 {
        for radius in [HEX_RADIUS * 0.98, HEX_RADIUS * 0.91] {
            let angle = std::f32::consts::PI / 3.0 * i as f32;
            positions.push([radius * angle.cos(), 0.0, radius * angle.sin()]);
            normals.push([0.0, 1.0, 0.0]);
        }
    }
    for i in 0..6u32 {
        let next = (i + 1) % 6;
        let (a, b) = (i * 2, next * 2);
        indices.extend_from_slice(&[a, b, a + 1, a + 1, b, b + 1]);
    }
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_indices(Indices::U32(indices))
}

fn terrain_overlay_mesh(kind: &str) -> Mesh {
    const NX: usize = 145;
    const NZ: usize = 105;
    let (min_x, max_x, min_z, max_z) = (-62.0, 62.0, -44.0, 44.0);
    let mut positions = Vec::with_capacity(NX * NZ);
    let mut normals = Vec::with_capacity(NX * NZ);
    for z_index in 0..NZ {
        for x_index in 0..NX {
            let x = min_x + (max_x - min_x) * x_index as f32 / (NX - 1) as f32;
            let z = min_z + (max_z - min_z) * z_index as f32 / (NZ - 1) as f32;
            let point = Vec2::new(x, z);
            let height = if kind == "water" {
                -0.45
            } else {
                height_at(point) + 0.14
            };
            positions.push([x, height, z]);
            normals.push([0.0, 1.0, 0.0]);
        }
    }
    let mut indices = Vec::new();
    for z_index in 0..NZ - 1 {
        for x_index in 0..NX - 1 {
            let x = min_x + (max_x - min_x) * (x_index as f32 + 0.5) / (NX - 1) as f32;
            let z = min_z + (max_z - min_z) * (z_index as f32 + 0.5) / (NZ - 1) as f32;
            if !coord_at(Vec2::new(x, z))
                .is_some_and(|coord| terrain_for(coord.col, coord.row) == kind)
            {
                continue;
            }
            let a = (z_index * NX + x_index) as u32;
            let (b, c, d) = (a + 1, a + NX as u32, a + NX as u32 + 1);
            indices.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_indices(Indices::U32(indices))
}

fn road_mesh() -> Mesh {
    const SEGMENTS: usize = 96;
    let mut positions = Vec::with_capacity((SEGMENTS + 1) * 2);
    let mut normals = Vec::with_capacity((SEGMENTS + 1) * 2);
    let mut indices = Vec::with_capacity(SEGMENTS * 6);
    for index in 0..=SEGMENTS {
        let progress = index as f32 / SEGMENTS as f32;
        let x = -68.0 + progress * 136.0;
        let z = 0.5 + (x * 0.055).sin() * 3.8 + x * 0.015;
        let tangent = Vec2::new(1.0, 0.209 * (x * 0.055).cos() + 0.015).normalize();
        let normal = Vec2::new(-tangent.y, tangent.x);
        for side in [-1.0, 1.0] {
            let point = Vec2::new(x, z) + normal * side * 1.62;
            positions.push([point.x, height_at(point) + 0.055, point.y]);
            normals.push([0.0, 1.0, 0.0]);
        }
    }
    for index in 0..SEGMENTS as u32 {
        let base = index * 2;
        indices.extend_from_slice(&[base, base + 2, base + 1, base + 1, base + 2, base + 3]);
    }
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_indices(Indices::U32(indices))
}

fn place(
    commands: &mut Commands,
    asset: Handle<WorldAsset>,
    point: Vec2,
    yaw: f32,
    scale: f32,
    name: &'static str,
) {
    commands.spawn((
        ScenicProp,
        Name::new(name),
        WorldAssetRoot(asset),
        Transform::from_xyz(point.x, height_at(point), point.y)
            .with_rotation(Quat::from_rotation_y(yaw))
            .with_scale(Vec3::splat(scale)),
    ));
}

fn scenery(
    commands: &mut Commands,
    server: &AssetServer,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    authored: &Art,
) {
    let model = |name: &str| -> Handle<WorldAsset> {
        server.load(GltfAssetLabel::Scene(0).from_asset(format!("models/{name}.glb")))
    };
    let church = model("church");
    let farmhouse = model("farmhouse");
    let olive = model("broadleaf_olive");
    let gold = model("broadleaf_gold");
    let cypress = model("cypress");
    let stakes = model("stakes");

    for prop in &authored.off_board_props {
        match (prop.kind.as_str(), prop.side.as_str()) {
            ("village", "east") => {
                place(
                    commands,
                    church.clone(),
                    Vec2::new(66.0, -39.0),
                    -0.32,
                    1.15,
                    "Sudomer village church",
                );
                for (index, point) in [
                    Vec2::new(58.5, -45.0),
                    Vec2::new(69.5, -48.0),
                    Vec2::new(75.0, -38.0),
                    Vec2::new(61.0, -31.5),
                    Vec2::new(75.5, -27.0),
                    Vec2::new(52.0, -36.0),
                    Vec2::new(70.0, -20.5),
                    Vec2::new(55.0, -48.0),
                ]
                .into_iter()
                .enumerate()
                {
                    place(
                        commands,
                        farmhouse.clone(),
                        point,
                        -0.5 + index as f32 * 0.34,
                        0.70 + (index % 2) as f32 * 0.09,
                        "Sudomer village farmhouse",
                    );
                }
            }
            ("woodland", "northwest") => {}
            _ => {}
        }
    }
    for index in 0..220u32 {
        let side = index % 4;
        let point = match side {
            0 => Vec2::new(
                -72.0 + noise(index * 7 + 1) * 144.0,
                -51.0 + noise(index * 7 + 2) * 11.0,
            ),
            1 => Vec2::new(
                -72.0 + noise(index * 7 + 1) * 144.0,
                44.0 + noise(index * 7 + 2) * 10.0,
            ),
            2 => Vec2::new(
                -72.0 + noise(index * 7 + 1) * 13.0,
                -48.0 + noise(index * 7 + 2) * 94.0,
            ),
            _ => Vec2::new(
                61.0 + noise(index * 7 + 1) * 12.0,
                -23.0 + noise(index * 7 + 2) * 68.0,
            ),
        };
        if point.distance(Vec2::new(66.0, -39.0)) < 12.0 {
            continue;
        }
        let scale = 0.34 + noise(index * 7 + 3) * 0.42;
        let asset = if index % 9 == 0 {
            cypress.clone()
        } else if index % 4 == 0 {
            gold.clone()
        } else {
            olive.clone()
        };
        place(
            commands,
            asset,
            point,
            noise(index * 11) * 6.28,
            scale,
            "Wooded diorama edge",
        );
    }
    for (col, row, yaw) in [(8, 5, 0.2), (8, 6, 0.2), (9, 7, 0.15)] {
        place(
            commands,
            stakes.clone(),
            center(col, row).xz() + Vec2::new(-1.6, 2.2),
            yaw,
            0.55,
            "Causeway defensive stakes",
        );
    }
    let stone_mesh = meshes.add(Sphere::new(0.5).mesh().ico(1).unwrap());
    let stone_material = materials.add(StandardMaterial {
        base_color: Color::srgb(0.33, 0.34, 0.29),
        perceptual_roughness: 1.0,
        ..default()
    });
    for index in 0..86u32 {
        let point = Vec2::new(
            -66.0 + noise(index * 5 + 1) * 132.0,
            -47.0 + noise(index * 5 + 2) * 94.0,
        );
        if road_distance(point) < 3.5
            || coord_at(point).is_some_and(|c| terrain_for(c.col, c.row) == "water")
        {
            continue;
        }
        let scale = 0.25 + noise(index * 5 + 3) * 0.75;
        commands.spawn((
            ScenicProp,
            Name::new("Field stone"),
            Mesh3d(stone_mesh.clone()),
            MeshMaterial3d(stone_material.clone()),
            Transform::from_xyz(point.x, height_at(point) + 0.12 * scale, point.y)
                .with_scale(Vec3::new(scale, scale * 0.65, scale * 0.8)),
        ));
    }
    let crop_mesh = meshes.add(Rectangle::new(0.12, 0.72));
    let crop_material = materials.add(StandardMaterial {
        base_color: Color::srgb(0.68, 0.52, 0.22),
        cull_mode: None,
        alpha_mode: AlphaMode::Mask(0.2),
        perceptual_roughness: 1.0,
        unlit: true,
        ..default()
    });
    // Crop color and row pattern are already painted into the continuous surface.
    // Keep individual cards out of the playable view so formations remain readable.
    for index in 0..0u32 {
        let point = match index % 3 {
            0 => Vec2::new(
                18.0 + noise(index * 3 + 1) * 40.0,
                12.0 + noise(index * 3 + 2) * 24.0,
            ),
            1 => Vec2::new(
                -52.0 + noise(index * 3 + 1) * 27.0,
                -31.0 + noise(index * 3 + 2) * 17.0,
            ),
            _ => Vec2::new(
                31.0 + noise(index * 3 + 1) * 27.0,
                -30.0 + noise(index * 3 + 2) * 14.0,
            ),
        };
        if coord_at(point).is_some_and(|c| matches!(terrain_for(c.col, c.row), "water" | "mud"))
            || road_distance(point) < 3.0
        {
            continue;
        }
        commands.spawn((
            ScenicProp,
            Name::new("Painted field crop"),
            NotShadowCaster,
            Mesh3d(crop_mesh.clone()),
            MeshMaterial3d(crop_material.clone()),
            Transform::from_xyz(point.x, height_at(point) + 0.37, point.y)
                .with_rotation(Quat::from_rotation_y(noise(index * 13) * 0.5 - 0.25)),
        ));
    }
    for (key, value) in &authored.tile_overrides {
        let Some((col, row)) = key.split_once(',') else {
            continue;
        };
        let (Ok(col), Ok(row)) = (col.parse::<i32>(), row.parse::<i32>()) else {
            continue;
        };
        let tile_center = center(col, row).xz();
        if value.decoration == "reeds" {
            for index in 0..9u32 {
                let point = tile_center
                    + Vec2::new(
                        noise(index * 5 + col as u32) * 4.2 - 2.1,
                        noise(index * 7 + row as u32) * 4.2 - 2.1,
                    );
                commands.spawn((
                    ScenicProp,
                    Name::new("Pond reeds"),
                    NotShadowCaster,
                    Mesh3d(crop_mesh.clone()),
                    MeshMaterial3d(crop_material.clone()),
                    Transform::from_xyz(point.x, height_at(point) + 0.34, point.y)
                        .with_scale(Vec3::new(0.7, 1.1, 0.7)),
                ));
            }
        } else if value.decoration == "causeway-stones" {
            for index in 0..5u32 {
                let point = tile_center
                    + Vec2::new(
                        noise(index * 3 + 1) * 4.0 - 2.0,
                        noise(index * 3 + 2) * 4.0 - 2.0,
                    );
                commands.spawn((
                    ScenicProp,
                    Name::new("Causeway stone"),
                    Mesh3d(stone_mesh.clone()),
                    MeshMaterial3d(stone_material.clone()),
                    Transform::from_xyz(point.x, height_at(point) + 0.1, point.y)
                        .with_scale(Vec3::new(0.38, 0.22, 0.55)),
                ));
            }
        }
    }
}

pub fn spawn(
    mut commands: Commands,
    server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    let authored = art();
    debug_assert_eq!(authored.version, 1);
    debug_assert_eq!(authored.scenario, "sudomere_1420");
    debug_assert_eq!(authored.hex_radius, HEX_RADIUS);
    debug_assert_eq!(
        authored.source_revision,
        "dbdf61907212476cda816ff2036a9a8d41bf3572"
    );
    debug_assert!(authored.palette.contains_key("plains"));
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
    commands.spawn((
        Name::new("Continuous painted Sudomer landscape"),
        Mesh3d(meshes.add(landscape_mesh(&authored))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::WHITE,
            base_color_texture: Some(texture),
            perceptual_roughness: 0.96,
            reflectance: 0.07,
            unlit: true,
            ..default()
        })),
    ));
    commands.spawn((
        Name::new("Markovec pond water"),
        NotShadowCaster,
        Mesh3d(meshes.add(terrain_overlay_mesh("water"))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb_from_array(
                palette_color(&authored.palette, "water").to_array(),
            ),
            emissive: LinearRgba::new(0.025, 0.05, 0.052, 1.0),
            unlit: true,
            perceptual_roughness: 0.36,
            metallic: 0.08,
            cull_mode: None,
            ..default()
        })),
    ));
    commands.spawn((
        Name::new("Drained Skaredy pond mud"),
        NotShadowCaster,
        Mesh3d(meshes.add(terrain_overlay_mesh("mud"))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb_from_array(palette_color(&authored.palette, "mud").to_array()),
            emissive: LinearRgba::new(0.035, 0.022, 0.008, 1.0),
            perceptual_roughness: 1.0,
            unlit: true,
            cull_mode: None,
            ..default()
        })),
    ));
    commands.spawn((
        Name::new("Painted causeway road"),
        NotShadowCaster,
        Mesh3d(meshes.add(road_mesh())),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.44, 0.31, 0.17),
            perceptual_roughness: 1.0,
            cull_mode: None,
            ..default()
        })),
    ));
    commands.spawn((
        Name::new("Soil-edged display plinth"),
        Mesh3d(meshes.add(Cuboid::new(151.0, 2.4, 111.0))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb_from_array(palette_color(&authored.palette, "soil").to_array()),
            perceptual_roughness: 1.0,
            ..default()
        })),
        Transform::from_xyz(0.0, -3.20, 0.0),
    ));
    commands.spawn((
        Name::new("Studio surface"),
        Mesh3d(meshes.add(Plane3d::default().mesh().size(800.0, 800.0))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.12, 0.145, 0.145),
            perceptual_roughness: 1.0,
            ..default()
        })),
        Transform::from_xyz(0.0, -4.45, 0.0),
    ));
    scenery(
        &mut commands,
        &server,
        &mut meshes,
        &mut materials,
        &authored,
    );
}

pub fn toggle_grid(
    keys: Res<ButtonInput<KeyCode>>,
    mut state: ResMut<GridState>,
    mut commands: Commands,
    existing: Query<Entity, With<GridLine>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    if !keys.just_pressed(KeyCode::KeyG) {
        return;
    }
    state.0 = !state.0;
    for entity in &existing {
        commands.entity(entity).despawn();
    }
    if !state.0 {
        return;
    }
    let mesh = meshes.add(ring_mesh());
    let material = materials.add(StandardMaterial {
        base_color: Color::srgba(0.10, 0.075, 0.04, 0.48),
        alpha_mode: AlphaMode::Blend,
        unlit: true,
        cull_mode: None,
        ..default()
    });
    for col in 0..COLS {
        for row in 0..ROWS {
            let point = center(col, row);
            commands.spawn((
                GridLine,
                Mesh3d(mesh.clone()),
                MeshMaterial3d(material.clone()),
                Transform::from_xyz(point.x, height_at_coord(col, row) + 0.11, point.z),
            ));
        }
    }
}

pub fn sync_highlights(
    mut commands: Commands,
    state: Res<SnapshotState>,
    existing: Query<Entity, With<Highlight>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut last_signature: Local<u64>,
) {
    if !state.changed {
        return;
    }
    let Some(snapshot) = &state.current else {
        return;
    };
    let mut hasher = DefaultHasher::new();
    snapshot.generation.hash(&mut hasher);
    snapshot.selected_unit_id.hash(&mut hasher);
    for coord in &snapshot.legal_moves {
        coord.col.hash(&mut hasher);
        coord.row.hash(&mut hasher);
    }
    for target in &snapshot.legal_attacks {
        target.unit_id.hash(&mut hasher);
        target.col.hash(&mut hasher);
        target.row.hash(&mut hasher);
    }
    let signature = hasher.finish();
    if *last_signature == signature {
        return;
    }
    *last_signature = signature;
    for entity in &existing {
        commands.entity(entity).despawn();
    }
    let mut add = |coord: Coord, color: Color, radius: f32| {
        let point = center(coord.col, coord.row);
        commands.spawn((
            Highlight,
            Mesh3d(meshes.add(Cylinder::new(HEX_RADIUS * radius, 0.028))),
            MeshMaterial3d(materials.add(StandardMaterial {
                base_color: color,
                alpha_mode: AlphaMode::Blend,
                unlit: true,
                ..default()
            })),
            Transform::from_xyz(
                point.x,
                height_at_coord(coord.col, coord.row) + 0.14,
                point.z,
            ),
        ));
    };
    for &coord in &snapshot.legal_moves {
        add(coord, Color::srgba(0.58, 0.78, 0.36, 0.33), 0.79);
    }
    for target in &snapshot.legal_attacks {
        add(
            Coord {
                col: target.col,
                row: target.row,
            },
            Color::srgba(0.82, 0.22, 0.11, 0.45),
            0.81,
        );
    }
    if let Some(id) = snapshot.selected_unit_id {
        if let Some(unit) = snapshot.units.iter().find(|u| u.id == id) {
            add(
                Coord {
                    col: unit.col,
                    row: unit.row,
                },
                Color::srgba(0.96, 0.72, 0.18, 0.48),
                0.88,
            );
        }
    }
}

pub fn pick_terrain(origin: Vec3, direction: Vec3) -> Option<Coord> {
    let mut previous = origin;
    for step in 1..=900 {
        let point = origin + direction * (step as f32 * 0.35);
        let world = point.xz();
        if coord_at(world).is_some()
            && point.y <= height_at(world)
            && previous.y > height_at(previous.xz())
        {
            let (mut above, mut below) = (previous, point);
            for _ in 0..10 {
                let middle = (above + below) * 0.5;
                if middle.y > height_at(middle.xz()) {
                    above = middle;
                } else {
                    below = middle;
                }
            }
            return coord_at(((above + below) * 0.5).xz());
        }
        previous = point;
    }
    None
}

#[cfg(test)]
pub fn pick_on_plane(origin: Vec3, dir: Vec3, heights: &[(Coord, f32)]) -> Option<Coord> {
    heights
        .iter()
        .filter_map(|(coord, height)| {
            if dir.y.abs() < 1e-5 {
                return None;
            }
            let distance = (height - origin.y) / dir.y;
            if distance < 0.0 {
                return None;
            }
            let point = origin + dir * distance;
            contains(point.xz(), center(coord.col, coord.row).xz()).then_some((*coord, distance))
        })
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .map(|v| v.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn centres_follow_odd_q() {
        assert!((center(1, 0).z - center(0, 0).z - ROOT3 * HEX_RADIUS * 0.5).abs() < 0.001);
        assert!((center(2, 0).z - center(0, 0).z).abs() < 0.001);
    }
    #[test]
    fn all_centres_round_trip() {
        for col in 0..COLS {
            for row in 0..ROWS {
                assert_eq!(coord_at(center(col, row).xz()), Some(Coord { col, row }));
            }
        }
    }
    #[test]
    fn rejects_outside_edges() {
        assert!(!contains(Vec2::new(HEX_RADIUS, HEX_RADIUS), Vec2::ZERO));
        assert_eq!(coord_at(Vec2::new(90.0, 90.0)), None);
    }
    #[test]
    fn raised_tile_wins() {
        let coord = Coord { col: 0, row: 0 };
        assert_eq!(
            pick_on_plane(center(0, 0) + Vec3::Y * 10.0, Vec3::NEG_Y, &[(coord, 0.8)]),
            Some(coord)
        );
        assert_eq!(
            pick_terrain(center(0, 0) + Vec3::Y * 10.0, Vec3::NEG_Y),
            Some(coord)
        );
    }
    #[test]
    fn odd_even_neighbors() {
        let n = |c: i32, r: i32| {
            if c & 1 == 1 {
                [
                    (c, r - 1),
                    (c + 1, r),
                    (c + 1, r + 1),
                    (c, r + 1),
                    (c - 1, r + 1),
                    (c - 1, r),
                ]
            } else {
                [
                    (c, r - 1),
                    (c + 1, r - 1),
                    (c + 1, r),
                    (c, r + 1),
                    (c - 1, r),
                    (c - 1, r - 1),
                ]
            }
        };
        assert_eq!(n(2, 3)[1], (3, 2));
        assert_eq!(n(3, 3)[1], (4, 3));
    }
    #[test]
    fn authored_overrides_are_versioned_and_on_board() {
        let authored = art();
        assert_eq!(authored.version, 1);
        assert_eq!(authored.scenario, "sudomere_1420");
        assert_eq!(
            authored.source_revision,
            "dbdf61907212476cda816ff2036a9a8d41bf3572"
        );
        assert_eq!(authored.hex_radius, HEX_RADIUS);
        for (key, value) in authored.tile_overrides {
            let parts: Vec<i32> = key.split(',').map(|v| v.parse().unwrap()).collect();
            assert!(parts[0] >= 0 && parts[0] < COLS && parts[1] >= 0 && parts[1] < ROWS);
            assert!(!value.decoration.is_empty());
        }
        assert!(authored.off_board_props.iter().any(|p| p.kind == "village"));
    }
    #[test]
    fn logical_terrain_counts_match_source() {
        let mut counts = HashMap::new();
        for col in 0..COLS {
            for row in 0..ROWS {
                *counts.entry(terrain_for(col, row)).or_insert(0) += 1;
            }
        }
        assert_eq!(counts["water"], 40);
        assert_eq!(counts["mud"], 40);
        assert_eq!(counts["dam"], 2);
        assert_eq!(counts["plains"], 158);
    }
}
