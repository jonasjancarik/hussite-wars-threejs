//! Hand-traced from assets/diorama/landscape-plan.png. Coordinates are image UV:
//! left/top = 0, right/bottom = 1. These are art regions, not historical GIS data.
use bevy::prelude::*;
pub const SIZE: f32 = 96.0;
pub const WOODS: &[&[(f32, f32)]] = &[
    &[
        (0.12, 0.0),
        (0.80, 0.0),
        (0.74, 0.065),
        (0.62, 0.14),
        (0.56, 0.18),
        (0.43, 0.15),
        (0.35, 0.10),
        (0.23, 0.105),
        (0.17, 0.05),
    ],
    &[
        (0.0, 0.24),
        (0.13, 0.25),
        (0.23, 0.30),
        (0.25, 0.38),
        (0.18, 0.42),
        (0.12, 0.50),
        (0.0, 0.56),
    ],
    &[
        (0.0, 0.72),
        (0.09, 0.74),
        (0.11, 0.84),
        (0.20, 0.94),
        (0.28, 1.0),
        (0.0, 1.0),
    ],
    &[
        (0.46, 0.18),
        (0.54, 0.17),
        (0.59, 0.22),
        (0.55, 0.26),
        (0.48, 0.25),
    ],
    &[
        (0.62, 0.33),
        (0.68, 0.32),
        (0.71, 0.37),
        (0.67, 0.40),
        (0.60, 0.37),
    ],
    &[
        (0.36, 0.62),
        (0.41, 0.62),
        (0.43, 0.67),
        (0.38, 0.70),
        (0.34, 0.67),
    ],
    &[
        (0.53, 0.82),
        (0.60, 0.83),
        (0.65, 0.89),
        (0.60, 0.93),
        (0.51, 0.86),
    ],
];
pub const FIELDS: &[&[(f32, f32)]] = &[
    &[(0.63, 0.09), (0.81, 0.025), (0.83, 0.07), (0.68, 0.12)],
    &[(0.62, 0.17), (0.76, 0.14), (0.78, 0.19), (0.61, 0.22)],
    &[
        (0.83, 0.06),
        (0.90, 0.05),
        (0.88, 0.16),
        (0.83, 0.18),
        (0.79, 0.14),
    ],
    &[(0.82, 0.23), (0.91, 0.19), (0.92, 0.23), (0.83, 0.28)],
    &[
        (0.16, 0.53),
        (0.22, 0.52),
        (0.31, 0.56),
        (0.29, 0.59),
        (0.15, 0.56),
    ],
    &[(0.16, 0.60), (0.33, 0.65), (0.31, 0.70), (0.15, 0.66)],
    &[(0.0, 0.57), (0.065, 0.58), (0.025, 0.69), (0.0, 0.70)],
    &[(0.07, 0.59), (0.15, 0.60), (0.11, 0.72), (0.025, 0.74)],
    &[
        (0.14, 0.68),
        (0.31, 0.72),
        (0.46, 0.84),
        (0.40, 0.86),
        (0.13, 0.76),
    ],
    &[
        (0.34, 0.69),
        (0.41, 0.72),
        (0.50, 0.83),
        (0.46, 0.85),
        (0.33, 0.76),
    ],
    &[(0.13, 0.80), (0.40, 0.88), (0.38, 0.93), (0.11, 0.85)],
    &[
        (0.10, 0.88),
        (0.25, 0.93),
        (0.31, 0.99),
        (0.12, 0.94),
        (0.05, 0.91),
    ],
    &[
        (0.51, 0.92),
        (0.57, 0.90),
        (0.64, 0.98),
        (0.62, 1.0),
        (0.43, 1.0),
    ],
];
pub const POND: &[(f32, f32)] = &[
    (1.0, 0.20),
    (1.0, 0.65),
    (0.93, 0.62),
    (0.88, 0.57),
    (0.87, 0.50),
    (0.82, 0.46),
    (0.84, 0.38),
    (0.89, 0.35),
    (0.90, 0.30),
    (0.96, 0.27),
];
pub const ROAD: &[(f32, f32)] = &[
    (0.07, 0.0),
    (0.075, 0.10),
    (0.14, 0.15),
    (0.21, 0.20),
    (0.25, 0.29),
    (0.32, 0.34),
    (0.39, 0.39),
    (0.45, 0.45),
    (0.58, 0.49),
    (0.62, 0.56),
    (0.68, 0.66),
    (0.76, 0.75),
    (0.81, 0.82),
    (1.0, 0.95),
];
pub fn world(u: f32, v: f32) -> Vec2 {
    Vec2::new((u - 0.5) * SIZE, (v - 0.5) * SIZE)
}
pub fn uv(x: f32, z: f32) -> Vec2 {
    Vec2::new(x / SIZE + 0.5, z / SIZE + 0.5)
}
pub fn inside(p: Vec2, polygon: &[(f32, f32)]) -> bool {
    let mut inside = false;
    let mut j = polygon.len() - 1;
    for i in 0..polygon.len() {
        let (xi, yi) = polygon[i];
        let (xj, yj) = polygon[j];
        if (yi > p.y) != (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi {
            inside = !inside;
        }
        j = i;
    }
    inside
}
pub fn edge_distance(p: Vec2, polygon: &[(f32, f32)]) -> f32 {
    polygon
        .iter()
        .zip(polygon.iter().cycle().skip(1))
        .map(|(a, b)| segment_distance(p, Vec2::from(*a), Vec2::from(*b)))
        .fold(f32::INFINITY, f32::min)
}
pub fn road_distance(p: Vec2) -> f32 {
    ROAD.windows(2)
        .map(|s| segment_distance(p, Vec2::from(s[0]), Vec2::from(s[1])))
        .fold(f32::INFINITY, f32::min)
        * SIZE
}
fn segment_distance(p: Vec2, a: Vec2, b: Vec2) -> f32 {
    let t = ((p - a).dot(b - a) / (b - a).length_squared()).clamp(0.0, 1.0);
    p.distance(a.lerp(b, t))
}
pub fn field(p: Vec2) -> Option<usize> {
    FIELDS.iter().position(|poly| inside(p, poly))
}
pub fn wooded(p: Vec2) -> bool {
    WOODS.iter().any(|poly| inside(p, poly))
}
pub fn height(x: f32, z: f32) -> f32 {
    let p = uv(x, z);
    let ridge = 4.2 * (-((x + 13.0).powi(2) / 650.0 + (z + 9.0).powi(2) / 210.0)).exp();
    let village = 2.8 * (-((x + 34.0).powi(2) + (z + 34.0).powi(2)) / 230.0).exp();
    let land = 5.8 + ridge + village + (x * 0.075).sin() * (z * 0.065).cos() * 0.8;
    let distance = if inside(p, POND) {
        0.0
    } else {
        edge_distance(p, POND) * SIZE
    };
    let blend = (distance / 6.0).clamp(0.0, 1.0);
    let blend = blend * blend * (3.0 - 2.0 * blend);
    3.45 + (land - 3.45) * blend
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn plan_coordinates_and_land_uses_agree() {
        assert_eq!(world(0.5, 0.5), Vec2::ZERO);
        assert!(wooded(Vec2::new(0.45, 0.05)));
        assert!(inside(Vec2::new(0.97, 0.46), POND));
        assert!(field(Vec2::new(0.23, 0.64)).is_some());
        assert!(!wooded(Vec2::new(0.5, 0.5)));
        let p = world(0.97, 0.46);
        assert!(height(p.x, p.y) < 3.8);
    }
    #[test]
    fn traced_polygons_are_in_the_tile() {
        for poly in WOODS.iter().chain(FIELDS.iter()).copied().chain([POND]) {
            assert!(poly.len() >= 3);
            for &(u, v) in poly {
                assert!((0.0..=1.0).contains(&u) && (0.0..=1.0).contains(&v));
            }
        }
    }
}
