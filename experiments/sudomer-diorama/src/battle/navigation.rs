use bevy::prelude::*;
use std::{
    cmp::Reverse,
    collections::{BinaryHeap, HashMap},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MovementClass {
    Foot,
    Mounted,
    Wagon,
}

pub fn passable(point: Vec2, class: MovementClass, clearance: f32) -> bool {
    if !crate::landscape::contains(point.x, point.y) {
        return false;
    }
    let cell = crate::landscape::land(point.x, point.y);
    if cell[0] == 1 || (cell[0] == 3 && class == MovementClass::Wagon) {
        return false;
    }
    if crate::landscape::building_footprints()
        .any(|(c, h)| (point - c).abs().cmple(h + Vec2::splat(clearance)).all())
    {
        return false;
    }
    let h = crate::landscape::walkable_height(point.x, point.y);
    let d = crate::landscape::NAV_CELL_SIZE;
    let sx = (crate::landscape::walkable_height(point.x + d, point.y)
        - crate::landscape::walkable_height(point.x - d, point.y))
        / (2.0 * d);
    let sz = (crate::landscape::walkable_height(point.x, point.y + d)
        - crate::landscape::walkable_height(point.x, point.y - d))
        / (2.0 * d);
    h.is_finite() && (sx * sx + sz * sz).sqrt().atan().to_degrees() <= 30.0
}
pub fn terrain_multiplier(point: Vec2, class: MovementClass) -> f32 {
    match (crate::landscape::land(point.x, point.y)[0], class) {
        (2, MovementClass::Foot) => 0.5,
        (2, MovementClass::Mounted) => 0.25,
        (2, MovementClass::Wagon) => 0.35,
        (3, MovementClass::Foot) => 0.7,
        (3, MovementClass::Mounted) => 0.4,
        (3, MovementClass::Wagon) => 0.0,
        _ => 1.0,
    }
}
pub fn segment_clear(a: Vec2, b: Vec2, class: MovementClass, clearance: f32) -> bool {
    let n = ((a.distance(b) / crate::landscape::NAV_CELL_SIZE).ceil() as usize).max(1);
    (0..=n).all(|i| passable(a.lerp(b, i as f32 / n as f32), class, clearance))
}

pub fn next_step(start: Vec2, goal: Vec2, class: MovementClass) -> Option<Vec2> {
    if segment_clear(start, goal, class, 1.0) {
        return Some(goal);
    }
    let d = crate::landscape::NAV_CELL_SIZE;
    let to_cell = |p: Vec2| ((p.x / d).round() as i32, (p.y / d).round() as i32);
    let from_cell = |(x, z): (i32, i32)| Vec2::new(x as f32 * d, z as f32 * d);
    let s = to_cell(start);
    let g = to_cell(goal);
    let mut open = BinaryHeap::new();
    let mut came = HashMap::new();
    let mut cost = HashMap::new();
    open.push((Reverse(0i32), s));
    cost.insert(s, 0i32);
    let dirs = [
        (-1, 0),
        (1, 0),
        (0, -1),
        (0, 1),
        (-1, -1),
        (-1, 1),
        (1, -1),
        (1, 1),
    ];
    let mut found = false;
    let mut visits = 0;
    while let Some((_, cur)) = open.pop() {
        if cur == g {
            found = true;
            break;
        }
        visits += 1;
        if visits > 12000 {
            break;
        }
        for &(dx, dz) in &dirs {
            let n = (cur.0 + dx, cur.1 + dz);
            let p = from_cell(n);
            if !passable(p, class, 1.0) {
                continue;
            }
            if dx != 0
                && dz != 0
                && (!passable(from_cell((cur.0 + dx, cur.1)), class, 1.0)
                    || !passable(from_cell((cur.0, cur.1 + dz)), class, 1.0))
            {
                continue;
            }
            let nc = cost[&cur] + if dx != 0 && dz != 0 { 14 } else { 10 };
            if cost.get(&n).is_none_or(|&v| nc < v) {
                cost.insert(n, nc);
                came.insert(n, cur);
                let h = (n.0 - g.0).abs() + (n.1 - g.1).abs();
                open.push((Reverse(nc + h * 10), n));
            }
        }
    }
    if !found {
        return None;
    }
    let mut cur = g;
    while came.get(&cur).copied().is_some_and(|p| p != s) {
        cur = came[&cur];
    }
    Some(from_cell(cur))
}

pub fn steer_step(start: Vec2, goal: Vec2, class: MovementClass) -> Option<Vec2> {
    if segment_clear(start, goal, class, 1.0) {
        return Some(goal);
    }
    let distance = crate::landscape::NAV_CELL_SIZE;
    let desired = (goal - start).normalize_or_zero();
    [
        0.0_f32,
        0.45,
        -0.45,
        0.9,
        -0.9,
        1.35,
        -1.35,
        std::f32::consts::PI,
    ]
    .into_iter()
    .map(|angle| start + Mat2::from_angle(angle) * desired * distance)
    .find(|&point| passable(point, class, 1.0))
}

pub fn line_obstructed(a: Vec2, b: Vec2) -> bool {
    !segment_clear(a, b, MovementClass::Foot, 0.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn blocks_water_and_outside() {
        assert!(!passable(
            Vec2::new(crate::landscape::SIZE, 0.0),
            MovementClass::Foot,
            0.0
        ));
        assert!(!passable(
            Vec2::new(
                7.99 * crate::landscape::AUTHORED_TO_METRES,
                -36.0 * crate::landscape::AUTHORED_TO_METRES
            ),
            MovementClass::Foot,
            0.0
        ));
    }
    #[test]
    fn buildings_block() {
        let (c, _) = crate::landscape::building_footprints().next().unwrap();
        assert!(!passable(c, MovementClass::Foot, 0.0));
    }
    #[test]
    fn mud_is_slower() {
        let p = Vec2::new(
            25.54 * crate::landscape::AUTHORED_TO_METRES,
            8.22 * crate::landscape::AUTHORED_TO_METRES,
        );
        assert_eq!(terrain_multiplier(p, MovementClass::Mounted), 0.25);
        assert_eq!(terrain_multiplier(p, MovementClass::Foot), 0.5);
    }
    #[test]
    fn unreachable_does_not_hang() {
        let water = Vec2::new(
            7.99 * crate::landscape::AUTHORED_TO_METRES,
            -36.0 * crate::landscape::AUTHORED_TO_METRES,
        );
        assert!(next_step(Vec2::ZERO, water, MovementClass::Foot).is_none());
    }
}
