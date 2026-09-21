//! Soft camera-facing smoke and dust, optionally following playable cavalry.
use super::{DioramaCamera, layout::height, noise};
use bevy::{
    asset::RenderAssetUsages,
    light::NotShadowCaster,
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat},
};

#[derive(Resource)]
pub struct AtmosphereClock {
    elapsed: f32,
    paused: bool,
}
impl Default for AtmosphereClock {
    fn default() -> Self {
        Self {
            elapsed: 4.0,
            paused: false,
        }
    }
}
#[derive(Component)]
pub struct Wisp {
    origin: Vec3,
    cavalry_slot: Option<usize>,
    phase: f32,
    scale: Vec2,
    drift: Vec3,
    opacity: f32,
    tint: Vec3,
    period: f32,
}

pub fn spawn(
    mut commands: Commands,
    mut images: ResMut<Assets<Image>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    const N: u32 = 128;
    let mut rgba = Vec::with_capacity((N * N * 4) as usize);
    for y in 0..N {
        for x in 0..N {
            let u = x as f32 / (N - 1) as f32 * 2.0 - 1.0;
            let v = y as f32 / (N - 1) as f32 * 2.0 - 1.0;
            let r2 = u * u + v * v;
            let turbulence = 0.80
                + 0.12 * (u * 13.0 + v * 7.0).sin() * (v * 17.0 - u * 4.0).cos()
                + 0.08 * (u * 27.0 + v * 19.0).sin();
            let a = ((1.0 - r2).max(0.0).powi(3) * turbulence * 255.0) as u8;
            rgba.extend_from_slice(&[255, 255, 255, a]);
        }
    }
    let image = images.add(Image::new(
        Extent3d {
            width: N,
            height: N,
            depth_or_array_layers: 1,
        },
        TextureDimension::D2,
        rgba,
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::RENDER_WORLD,
    ));
    let mesh = meshes.add(Rectangle::new(1.0, 1.0));
    for i in 0..36u32 {
        let (origin, scale, drift, opacity, tint, period) = if i < 16 {
            let wagon = (i / 4) * 2;
            let x = -25.0 + wagon as f32 * 6.0;
            let z = -4.0 - wagon as f32 * 1.45;
            (
                Vec3::new(x, height(x, z) + 2.8, z + 0.8),
                Vec2::new(3.8, 4.8),
                Vec3::new(3.0, 3.0, 0.3),
                0.38,
                Vec3::new(0.86, 0.85, 0.80),
                9.0,
            )
        } else if i < 30 {
            let x = 10.0 + noise(i * 3) * 24.0;
            let z = 11.0 + noise(i * 3 + 1) * 14.0;
            (
                Vec3::new(x, height(x, z) + 0.5, z),
                Vec2::new(6.0, 2.3),
                Vec3::new(2.5, 0.35, 0.7),
                0.22,
                Vec3::new(0.66, 0.55, 0.36),
                14.0,
            )
        } else {
            let x = -32.0 + (i - 30) as f32 * 11.0;
            let z = -27.0;
            (
                Vec3::new(x, height(x, z) + 2.0, z),
                Vec2::new(21.0, 5.0),
                Vec3::new(3.0, 0.3, 0.0),
                0.08,
                Vec3::new(0.76, 0.79, 0.78),
                30.0,
            )
        };
        let material = materials.add(StandardMaterial {
            base_color: Color::srgba(tint.x, tint.y, tint.z, 0.0),
            base_color_texture: Some(image.clone()),
            alpha_mode: AlphaMode::Blend,
            unlit: true,
            cull_mode: None,
            ..default()
        });
        commands.spawn((
            Name::new(if i < 16 {
                "Gun smoke"
            } else if i < 30 {
                "Suspended cavalry dust"
            } else {
                "Woodland haze"
            }),
            NotShadowCaster,
            Mesh3d(mesh.clone()),
            MeshMaterial3d(material),
            Transform::from_translation(origin),
            Wisp {
                origin,
                cavalry_slot: if (16..30).contains(&i) {
                    Some((i - 16) as usize)
                } else {
                    None
                },
                phase: noise(i * 17 + 5),
                scale,
                drift,
                opacity,
                tint,
                period,
            },
        ));
    }
}
pub fn animate(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    mut clock: ResMut<AtmosphereClock>,
    camera: Single<&Transform, (With<DioramaCamera>, Without<Wisp>)>,
    mut wisps: Query<
        (&Wisp, &mut Transform, &MeshMaterial3d<StandardMaterial>),
        Without<DioramaCamera>,
    >,
    mut materials: ResMut<Assets<StandardMaterial>>,
    cavalry: Query<&Transform, (With<super::game::Cavalry>, Without<Wisp>)>,
) {
    if keys.just_pressed(KeyCode::Space) {
        clock.paused = !clock.paused;
    }
    if keys.just_pressed(KeyCode::KeyR) {
        *clock = AtmosphereClock::default();
    }
    if !clock.paused {
        clock.elapsed += time.delta_secs();
    }
    for (w, mut transform, material) in &mut wisps {
        let t = (clock.elapsed / w.period + w.phase).fract();
        let fade = (std::f32::consts::PI * t).sin().powi(2);
        let origin = w
            .cavalry_slot
            .and_then(|slot| cavalry.iter().nth(slot))
            .map(|pose| pose.translation + Vec3::new(0.0, 0.5, 1.5))
            .unwrap_or(w.origin);
        transform.translation = origin + w.drift * t;
        transform.rotation = camera.rotation;
        transform.scale = Vec3::new(
            w.scale.x * (0.7 + t * 0.65),
            w.scale.y * (0.7 + t * 0.65),
            1.0,
        );
        if let Some(mut m) = materials.get_mut(&material.0) {
            m.base_color = Color::srgba(w.tint.x, w.tint.y, w.tint.z, w.opacity * fade);
        }
    }
}
