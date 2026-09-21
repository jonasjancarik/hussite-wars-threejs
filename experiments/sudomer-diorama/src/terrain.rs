use bevy::{
    asset::RenderAssetUsages, mesh::Indices, prelude::*, render::render_resource::PrimitiveTopology,
};

pub const TERRAIN_SIZE: f32 = 1_200.0;
const TERRAIN_RESOLUTION: usize = 601;

pub fn height_at(x: f32, z: f32) -> f32 {
    let broad = (x * 0.018).sin() * 7.0 + (z * 0.015 + 0.8).cos() * 6.0;
    let cross = ((x + z) * 0.010).sin() * 5.0 + ((x - z) * 0.022).cos() * 2.2;
    let village_ridge = gaussian(x, z, -104.0, -74.0, 85.0) * 12.0;
    let wagon_rise = gaussian(x, z, -20.0, -12.0, 95.0) * 5.0;
    let stream_cut = gaussian(x, z, -65.0, 104.0, 25.0) * -8.0;
    (broad + cross + village_ridge + wagon_rise + stream_cut) * 1.42 - 2.0
}

fn gaussian(x: f32, z: f32, cx: f32, cz: f32, radius: f32) -> f32 {
    let d2 = (x - cx).powi(2) + (z - cz).powi(2);
    (-d2 / (2.0 * radius * radius)).exp()
}

pub fn terrain_mesh() -> Mesh {
    let n = TERRAIN_RESOLUTION;
    let step = TERRAIN_SIZE / (n - 1) as f32;
    let half = TERRAIN_SIZE * 0.5;
    let mut positions = Vec::with_capacity(n * n);
    let mut normals = Vec::with_capacity(n * n);
    let mut colors = Vec::with_capacity(n * n);
    let mut uvs = Vec::with_capacity(n * n);

    for zi in 0..n {
        let z = -half + zi as f32 * step;
        for xi in 0..n {
            let x = -half + xi as f32 * step;
            let y = height_at(x, z);
            let dx = height_at(x + 0.7, z) - height_at(x - 0.7, z);
            let dz = height_at(x, z + 0.7) - height_at(x, z - 0.7);
            let normal = Vec3::new(-dx, 1.4, -dz).normalize();
            let variation = ((x * 0.071).sin() * (z * 0.063).cos() * 0.5 + 0.5) * 0.12;
            let dry = ((x + z) * 0.023).sin() * 0.5 + 0.5;
            colors.push([
                0.72 + variation + dry * 0.08,
                0.76 + variation * 0.72,
                0.68 + variation * 0.34,
                1.0,
            ]);
            positions.push([x, y, z]);
            normals.push(normal.to_array());
            uvs.push([x / 32.0, z / 32.0]);
        }
    }

    let mut indices = Vec::with_capacity((n - 1) * (n - 1) * 6);
    for z in 0..(n - 1) {
        for x in 0..(n - 1) {
            let a = (z * n + x) as u32;
            let b = a + 1;
            let c = a + n as u32;
            let d = c + 1;
            indices.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }

    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::MAIN_WORLD | RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, colors)
    .with_inserted_attribute(Mesh::ATTRIBUTE_UV_0, uvs)
    .with_inserted_indices(Indices::U32(indices))
}

pub fn patch_mesh(center: Vec2, size: Vec2, rotation: f32) -> Mesh {
    const X_STEPS: usize = 14;
    const Z_STEPS: usize = 11;
    let mut positions = Vec::with_capacity((X_STEPS + 1) * (Z_STEPS + 1));
    let mut normals = Vec::with_capacity(positions.capacity());
    let mut uvs = Vec::with_capacity(positions.capacity());
    let rotation = Mat2::from_angle(rotation);
    for z_index in 0..=Z_STEPS {
        let z_t = z_index as f32 / Z_STEPS as f32;
        for x_index in 0..=X_STEPS {
            let x_t = x_index as f32 / X_STEPS as f32;
            let local = Vec2::new((x_t - 0.5) * size.x, (z_t - 0.5) * size.y);
            let point = center + rotation * local;
            let y = height_at(point.x, point.y) + 0.16;
            let dx = height_at(point.x + 0.8, point.y) - height_at(point.x - 0.8, point.y);
            let dz = height_at(point.x, point.y + 0.8) - height_at(point.x, point.y - 0.8);
            positions.push([point.x, y, point.y]);
            normals.push(Vec3::new(-dx, 1.6, -dz).normalize().to_array());
            uvs.push([x_t, z_t]);
        }
    }
    let row = X_STEPS + 1;
    let mut indices = Vec::with_capacity(X_STEPS * Z_STEPS * 6);
    for z in 0..Z_STEPS {
        for x in 0..X_STEPS {
            let a = (z * row + x) as u32;
            let b = a + 1;
            let c = a + row as u32;
            let d = c + 1;
            indices.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::MAIN_WORLD | RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_attribute(Mesh::ATTRIBUTE_UV_0, uvs)
    .with_inserted_indices(Indices::U32(indices))
}

pub fn ribbon_mesh(points: &[(f32, f32)], width: f32) -> Mesh {
    let mut samples = Vec::new();
    for index in 0..points.len().saturating_sub(1) {
        let point = |i: usize| Vec2::new(points[i].0, points[i].1);
        let a = point(index);
        let b = point(index + 1);
        let before = if index == 0 {
            a * 2.0 - b
        } else {
            point(index - 1)
        };
        let after = if index + 2 >= points.len() {
            b * 2.0 - a
        } else {
            point(index + 2)
        };
        let divisions = ((b - a).length() / 1.5).ceil().max(1.0) as usize;
        for step in 0..divisions {
            let t = step as f32 / divisions as f32;
            samples.push(
                0.5 * ((2.0 * a)
                    + (-before + b) * t
                    + (2.0 * before - 5.0 * a + 4.0 * b - after) * t * t
                    + (-before + 3.0 * a - 3.0 * b + after) * t * t * t),
            );
        }
    }
    if let Some(last) = points.last() {
        samples.push(Vec2::new(last.0, last.1));
    }

    const COLUMNS: usize = 5;
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut colors = Vec::new();
    for (index, center) in samples.iter().enumerate() {
        let previous = samples[index.saturating_sub(1)];
        let next = samples[(index + 1).min(samples.len() - 1)];
        let tangent = (next - previous).normalize_or(Vec2::Y);
        let irregular = 1.0 + (center.x * 0.73 + center.y * 0.51).sin() * 0.04;
        let side = Vec2::new(-tangent.y, tangent.x) * width * 0.5 * irregular;
        for (column, offset) in [-1.0, -0.82, 0.0, 0.82, 1.0].into_iter().enumerate() {
            let point = *center + side * offset;
            let y = height_at(point.x, point.y) + 0.20;
            let dx = height_at(point.x + 0.7, point.y) - height_at(point.x - 0.7, point.y);
            let dz = height_at(point.x, point.y + 0.7) - height_at(point.x, point.y - 0.7);
            positions.push([point.x, y, point.y]);
            normals.push(Vec3::new(-dx, 1.4, -dz).normalize().to_array());
            uvs.push([point.x / 8.0, point.y / 8.0]);
            colors.push([
                1.0,
                1.0,
                1.0,
                if column == 0 || column == COLUMNS - 1 {
                    0.0
                } else {
                    1.0
                },
            ]);
        }
    }
    let mut indices = Vec::new();
    for index in 0..samples.len() - 1 {
        for column in 0..COLUMNS - 1 {
            let a = (index * COLUMNS + column) as u32;
            let c = a + COLUMNS as u32;
            indices.extend_from_slice(&[a, a + 1, c, a + 1, c + 1, c]);
        }
    }
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::MAIN_WORLD | RenderAssetUsages::RENDER_WORLD,
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_attribute(Mesh::ATTRIBUTE_UV_0, uvs)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, colors)
    .with_inserted_indices(Indices::U32(indices))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ribbons_face_up_so_roads_and_streams_are_visible() {
        let mesh = ribbon_mesh(&[(-20.0, 0.0), (20.0, 0.0), (40.0, 20.0)], 8.0);
        let bevy::mesh::VertexAttributeValues::Float32x3(positions) =
            mesh.attribute(Mesh::ATTRIBUTE_POSITION).unwrap()
        else {
            panic!("positions");
        };
        let Indices::U32(indices) = mesh.indices().unwrap() else {
            panic!("indices");
        };
        for tri in indices.chunks_exact(3) {
            let a = Vec3::from_array(positions[tri[0] as usize]);
            let b = Vec3::from_array(positions[tri[1] as usize]);
            let c = Vec3::from_array(positions[tri[2] as usize]);
            assert!((b - a).cross(c - a).y > 0.0);
        }
    }

    #[test]
    fn height_is_deterministic_and_finite() {
        let samples = [(-230.0, -230.0), (0.0, 0.0), (91.0, -47.0), (230.0, 230.0)];
        for (x, z) in samples {
            let first = height_at(x, z);
            assert!(first.is_finite());
            assert_eq!(first, height_at(x, z));
        }
    }

    #[test]
    fn terrain_has_expected_extent_and_relief() {
        let corners = [
            height_at(-230.0, -230.0),
            height_at(230.0, -230.0),
            height_at(-230.0, 230.0),
            height_at(230.0, 230.0),
        ];
        assert!(corners.iter().all(|value| value.abs() < 40.0));
        assert!(height_at(-104.0, -74.0) > height_at(-65.0, 104.0));
    }
}
