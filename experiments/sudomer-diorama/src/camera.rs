use bevy::{input::mouse::AccumulatedMouseMotion, prelude::*};

pub struct BattleCameraPlugin;

impl Plugin for BattleCameraPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(CameraRig::reference())
            .add_systems(Update, (camera_input, apply_camera_rig).chain());
    }
}

#[derive(Component)]
pub struct BattleCamera;

#[derive(Resource, Clone)]
pub struct CameraRig {
    pub target: Vec3,
    pub yaw: f32,
    pub pitch: f32,
    pub distance: f32,
}

impl CameraRig {
    pub fn reference() -> Self {
        Self {
            target: Vec3::new(-10.0, 13.0, 16.0),
            yaw: -0.28,
            pitch: -0.49,
            distance: 195.0,
        }
    }
}

fn camera_input(
    buttons: Res<ButtonInput<MouseButton>>,
    keys: Res<ButtonInput<KeyCode>>,
    motion: Res<AccumulatedMouseMotion>,
    mut wheel: MessageReader<bevy::input::mouse::MouseWheel>,
    mut rig: ResMut<CameraRig>,
) {
    if keys.just_pressed(KeyCode::KeyF) {
        *rig = CameraRig::reference();
    }

    if buttons.pressed(MouseButton::Right) {
        rig.yaw -= motion.delta.x * 0.004;
        rig.pitch = (rig.pitch - motion.delta.y * 0.003).clamp(-1.20, -0.16);
    }

    if buttons.pressed(MouseButton::Middle) {
        let forward = Vec3::new(rig.yaw.sin(), 0.0, rig.yaw.cos());
        let right = Vec3::new(forward.z, 0.0, -forward.x);
        let scale = rig.distance * 0.0016;
        rig.target += right * -motion.delta.x * scale + forward * motion.delta.y * scale;
        rig.target.x = rig.target.x.clamp(-170.0, 170.0);
        rig.target.z = rig.target.z.clamp(-170.0, 170.0);
    }

    for event in wheel.read() {
        rig.distance = (rig.distance * (1.0 - event.y * 0.08)).clamp(48.0, 390.0);
    }
}

fn apply_camera_rig(rig: Res<CameraRig>, mut camera: Query<&mut Transform, With<BattleCamera>>) {
    if !rig.is_changed() {
        return;
    }
    let Ok(mut transform) = camera.single_mut() else {
        return;
    };
    let horizontal = rig.distance * rig.pitch.cos();
    let offset = Vec3::new(
        horizontal * rig.yaw.sin(),
        -rig.distance * rig.pitch.sin(),
        horizontal * rig.yaw.cos(),
    );
    *transform = Transform::from_translation(rig.target + offset).looking_at(rig.target, Vec3::Y);
}
