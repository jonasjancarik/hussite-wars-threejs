//! Gesture deltas from consecutive frames. Rebase when finger identities change.
use bevy::prelude::*;

#[derive(Default, Debug)]
pub struct Gesture {
    pub orbit: Vec2,
    pub pan: Vec2,
    pub zoom: f32,
}

pub fn gesture(previous: &[(u64, Vec2)], current: &[(u64, Vec2)]) -> Gesture {
    let mut result = Gesture {
        zoom: 1.0,
        ..default()
    };
    if previous.len() != current.len() || !previous.iter().zip(current).all(|(a, b)| a.0 == b.0) {
        return result;
    }
    match current.len() {
        1 => result.orbit = current[0].1 - previous[0].1,
        2 => {
            result.pan = (current[0].1 + current[1].1 - previous[0].1 - previous[1].1) * 0.5;
            let old = previous[0].1.distance(previous[1].1);
            let new = current[0].1.distance(current[1].1);
            if old > 8.0 && new > 8.0 {
                result.zoom = old / new;
            }
        }
        _ => {}
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn one_finger_orbits_without_zooming() {
        let g = gesture(&[(1, Vec2::ZERO)], &[(1, Vec2::new(15.0, -8.0))]);
        assert_eq!(g.orbit, Vec2::new(15.0, -8.0));
        assert_eq!(g.pan, Vec2::ZERO);
        assert_eq!(g.zoom, 1.0);
    }
    #[test]
    fn two_fingers_pan_and_pinch_together() {
        let g = gesture(
            &[(1, Vec2::new(0.0, 0.0)), (2, Vec2::new(100.0, 0.0))],
            &[(1, Vec2::new(-30.0, 10.0)), (2, Vec2::new(170.0, 10.0))],
        );
        assert_eq!(g.orbit, Vec2::ZERO);
        assert_eq!(g.pan, Vec2::new(20.0, 10.0));
        assert_eq!(g.zoom, 0.5);
    }
    #[test]
    fn finger_changes_and_cancel_do_not_jump() {
        let old = [(1, Vec2::ZERO), (2, Vec2::new(100.0, 0.0))];
        for current in [
            vec![],
            vec![(2, Vec2::new(200.0, 50.0))],
            vec![(1, Vec2::ZERO), (3, Vec2::new(200.0, 50.0))],
        ] {
            let g = gesture(&old, &current);
            assert_eq!(g.orbit, Vec2::ZERO);
            assert_eq!(g.pan, Vec2::ZERO);
            assert_eq!(g.zoom, 1.0);
        }
    }
    #[test]
    fn stationary_fingers_do_not_repeat_motion() {
        let p = [(1, Vec2::new(4.0, 5.0))];
        let g = gesture(&p, &p);
        assert_eq!(g.orbit, Vec2::ZERO);
    }
}
