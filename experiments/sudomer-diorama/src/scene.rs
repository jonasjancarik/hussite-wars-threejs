use std::f32::consts::{FRAC_PI_2, PI};

use bevy::{
    camera::{Exposure, Hdr},
    core_pipeline::tonemapping::Tonemapping,
    image::{ImageAddressMode, ImageLoaderSettings, ImageSampler, ImageSamplerDescriptor},
    light::{CascadeShadowConfigBuilder, NotShadowCaster},
    post_process::bloom::Bloom,
    prelude::*,
    world_serialization::WorldInstanceReady,
};

use crate::{
    camera::BattleCamera,
    terrain::{height_at, patch_mesh, ribbon_mesh, terrain_mesh},
    vignette::{Attacker, SmokePuff},
};

pub struct BattlefieldScenePlugin;

impl Plugin for BattlefieldScenePlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, setup_battlefield);
    }
}

#[derive(Clone)]
struct ModelKit {
    wagon: Handle<WorldAsset>,
    cavalry: Handle<WorldAsset>,
    infantry_polearm: Handle<WorldAsset>,
    infantry_handgun: Handle<WorldAsset>,
    infantry_shield: Handle<WorldAsset>,
    church: Handle<WorldAsset>,
    farmhouse: Handle<WorldAsset>,
    broadleaf_olive: Handle<WorldAsset>,
    broadleaf_gold: Handle<WorldAsset>,
    cypress: Handle<WorldAsset>,
    stakes: Handle<WorldAsset>,
    banner: Handle<WorldAsset>,
    bridge: Handle<WorldAsset>,
    cavalry_animation: Handle<AnimationGraph>,
    cavalry_animation_index: AnimationNodeIndex,
}

impl ModelKit {
    fn load(asset_server: &AssetServer, graphs: &mut Assets<AnimationGraph>) -> Self {
        let scene =
            |path: &'static str| asset_server.load(GltfAssetLabel::Scene(0).from_asset(path));
        let (cavalry_graph, cavalry_animation_index) = AnimationGraph::from_clip(
            asset_server.load(GltfAssetLabel::Animation(0).from_asset("models/cavalry.glb")),
        );
        Self {
            wagon: scene("models/war_wagon.glb"),
            cavalry: scene("models/cavalry.glb"),
            infantry_polearm: scene("models/infantry_polearm.glb"),
            infantry_handgun: scene("models/infantry_handgun.glb"),
            infantry_shield: scene("models/infantry_shield.glb"),
            church: scene("models/church.glb"),
            farmhouse: scene("models/farmhouse.glb"),
            broadleaf_olive: scene("models/broadleaf_olive.glb"),
            broadleaf_gold: scene("models/broadleaf_gold.glb"),
            cypress: scene("models/cypress.glb"),
            stakes: scene("models/stakes.glb"),
            banner: scene("models/banner.glb"),
            bridge: scene("models/bridge.glb"),
            cavalry_animation: graphs.add(cavalry_graph),
            cavalry_animation_index,
        }
    }
}

#[derive(Component)]
struct AnimationToPlay {
    graph: Handle<AnimationGraph>,
    index: AnimationNodeIndex,
    phase: f32,
}

fn setup_battlefield(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut animation_graphs: ResMut<Assets<AnimationGraph>>,
) {
    let kit = ModelKit::load(&asset_server, &mut animation_graphs);

    let asset_mode = std::env::var("BATTLE_ASSET_MODE").unwrap_or_else(|_| "full".to_string());
    spawn_camera(&mut commands);
    spawn_lighting(&mut commands);
    spawn_ground(
        &mut commands,
        &mut meshes,
        &mut materials,
        asset_mode != "none",
        &asset_server,
    );
    if asset_mode == "none" {
        return;
    }
    if asset_mode == "single" {
        spawn_model(
            &mut commands,
            kit.wagon.clone(),
            Vec3::new(0.0, height_at(0.0, 0.0), 0.0),
            0.0,
            2.0,
            "Asset diagnostic wagon",
        );
        return;
    }
    spawn_landscape_details(&mut commands, &mut meshes, &mut materials, &kit);
    crate::dressing::spawn(&mut commands, &mut meshes, &mut materials);
    spawn_village(&mut commands, &kit);
    spawn_wagon_fort(&mut commands, &kit);
    spawn_attackers(&mut commands, &kit);
    spawn_smoke(&mut commands, &mut meshes, &mut materials);
}

fn spawn_camera(commands: &mut Commands) {
    let camera_id = commands
        .spawn((
            Name::new("Reference Camera"),
            BattleCamera,
            crate::vignette::OrderCamera,
            Camera3d::default(),
            Projection::Perspective(PerspectiveProjection {
                fov: 35.0_f32.to_radians(),
                near: 0.2,
                far: 900.0,
                ..default()
            }),
            Transform::from_xyz(-150.0, 140.0, 165.0)
                .looking_at(Vec3::new(-5.0, 3.0, 0.0), Vec3::Y),
            Hdr,
            Msaa::Off,
            Exposure { ev100: 11.5 },
            Bloom::NATURAL,
            Tonemapping::TonyMcMapface,
            DistanceFog {
                color: Color::srgb(0.66, 0.67, 0.65),
                directional_light_color: Color::srgba(0.93, 0.79, 0.58, 0.22),
                directional_light_exponent: 22.0,
                falloff: FogFalloff::Linear {
                    start: 310.0,
                    end: 950.0,
                },
            },
        ))
        .id();
    #[cfg(not(target_arch = "wasm32"))]
    commands
        .entity(camera_id)
        .insert(bevy::pbr::ScreenSpaceAmbientOcclusion::default());
    #[cfg(target_arch = "wasm32")]
    let _ = camera_id;
}

fn spawn_lighting(commands: &mut Commands) {
    commands.spawn((
        Name::new("Late afternoon sun"),
        DirectionalLight {
            color: Color::srgb(1.0, 0.93, 0.80),
            illuminance: 22_000.0,
            shadow_maps_enabled: true,
            shadow_depth_bias: 0.015,
            shadow_normal_bias: 1.2,
            ..default()
        },
        Transform::from_rotation(Quat::from_euler(EulerRot::ZYX, -0.22, -0.66, -0.84)),
        CascadeShadowConfigBuilder {
            first_cascade_far_bound: 55.0,
            maximum_distance: 360.0,
            num_cascades: if cfg!(target_arch = "wasm32") { 1 } else { 4 },
            ..default()
        }
        .build(),
    ));
}

fn spawn_ground(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    include_details: bool,
    asset_server: &AssetServer,
) {
    let ground_texture: Handle<Image> = asset_server
        .load_builder()
        .with_settings(|settings: &mut ImageLoaderSettings| {
            settings.sampler = ImageSampler::Descriptor(ImageSamplerDescriptor {
                address_mode_u: ImageAddressMode::Repeat,
                address_mode_v: ImageAddressMode::Repeat,
                ..default()
            });
        })
        .load("textures/painted-ground.png");
    let terrain_material = materials.add(StandardMaterial {
        base_color_texture: Some(ground_texture.clone()),
        base_color: Color::WHITE,
        perceptual_roughness: 0.98,
        reflectance: 0.08,
        ..default()
    });
    commands.spawn((
        Name::new("Continuous rolling terrain"),
        Mesh3d(meshes.add(terrain_mesh())),
        MeshMaterial3d(terrain_material),
    ));
    if !include_details {
        return;
    }

    let field_material = materials.add(StandardMaterial {
        base_color: Color::srgb(0.54, 0.40, 0.16),
        perceptual_roughness: 1.0,
        ..default()
    });
    for (position, size, rotation) in [
        (Vec2::new(8.0, 77.0), Vec2::new(35.0, 20.0), -0.10),
        (Vec2::new(110.0, -82.0), Vec2::new(48.0, 28.0), 0.12),
    ] {
        commands.spawn((
            Name::new("Golden enclosed field"),
            Mesh3d(meshes.add(patch_mesh(position, size, rotation))),
            MeshMaterial3d(field_material.clone()),
        ));
    }
    let stubble_mesh = meshes.add(Cuboid::new(0.16, 0.9, 0.16));
    let stubble_material = materials.add(StandardMaterial {
        base_color: Color::srgb(0.58, 0.44, 0.17),
        perceptual_roughness: 1.0,
        ..default()
    });
    for index in 0..170 {
        let x = -8.0 + hash01(index * 13 + 2) * 32.0;
        let z = 68.0 + hash01(index * 19 + 4) * 18.0;
        commands.spawn((
            Name::new("Field stubble"),
            Mesh3d(stubble_mesh.clone()),
            MeshMaterial3d(stubble_material.clone()),
            Transform::from_xyz(x, height_at(x, z) + 0.48, z).with_scale(Vec3::new(
                1.0,
                0.7 + hash01(index * 7) * 0.7,
                1.0,
            )),
        ));
    }

    let road_material = materials.add(StandardMaterial {
        base_color: Color::srgb(0.85, 0.72, 0.55),
        base_color_texture: Some(
            asset_server
                .load_builder()
                .with_settings(|settings: &mut ImageLoaderSettings| {
                    settings.sampler = ImageSampler::Descriptor(ImageSamplerDescriptor {
                        address_mode_u: ImageAddressMode::Repeat,
                        address_mode_v: ImageAddressMode::Repeat,
                        ..default()
                    });
                })
                .load("textures/earth-grain.png"),
        ),
        alpha_mode: AlphaMode::Blend,
        perceptual_roughness: 1.0,
        ..default()
    });
    spawn_ribbon(
        commands,
        meshes,
        road_material.clone(),
        &[
            (-166.0, -92.0),
            (-101.0, -58.0),
            (-38.0, -30.0),
            (18.0, -6.0),
            (84.0, 35.0),
            (168.0, 92.0),
        ],
        8.0,
        "Battle road",
    );
    spawn_ribbon(
        commands,
        meshes,
        road_material,
        &[(-150.0, -22.0), (-110.0, -58.0), (-83.0, -94.0)],
        5.0,
        "Village lane",
    );

    let stream_material = materials.add(StandardMaterial {
        base_color: Color::srgba(0.13, 0.24, 0.26, 0.90),
        perceptual_roughness: 0.35,
        metallic: 0.05,
        alpha_mode: AlphaMode::Blend,
        ..default()
    });
    spawn_ribbon(
        commands,
        meshes,
        stream_material,
        &[
            (-111.0, 73.0),
            (-87.0, 64.0),
            (-60.0, 57.0),
            (-45.0, 68.0),
            (-38.0, 92.0),
            (-40.0, 125.0),
            (-25.0, 180.0),
        ],
        5.5,
        "Stream",
    );
}

fn spawn_ribbon(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    material: Handle<StandardMaterial>,
    points: &[(f32, f32)],
    width: f32,
    name: &'static str,
) {
    commands.spawn((
        Name::new(name),
        Mesh3d(meshes.add(ribbon_mesh(points, width))),
        MeshMaterial3d(material),
    ));
}

fn spawn_landscape_details(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    kit: &ModelKit,
) {
    for i in 0..440 {
        let angle = hash01(i * 3 + 11) * PI * 2.0;
        let radius = 65.0 + hash01(i * 7 + 5) * 150.0;
        let mut x = angle.cos() * radius + (hash01(i + 90) - 0.5) * 34.0;
        let mut z = angle.sin() * radius + (hash01(i + 190) - 0.5) * 28.0;
        if i < 26 {
            x = -132.0 + hash01(i * 5) * 88.0;
            z = -116.0 + hash01(i * 9) * 73.0;
        }
        if x > -82.0 && x < 140.0 && z > -38.0 && z < 125.0 {
            continue;
        }
        let scene = if i % 9 == 0 {
            kit.cypress.clone()
        } else if i % 3 == 0 {
            kit.broadleaf_gold.clone()
        } else {
            kit.broadleaf_olive.clone()
        };
        let scale = 1.35 + hash01(i * 13) * 1.1;
        spawn_model(
            commands,
            scene,
            Vec3::new(x, height_at(x, z), z),
            angle,
            scale,
            "Autumn tree",
        );
    }

    for i in 0..340 {
        let x = -330.0 + hash01(i * 19 + 3) * 660.0;
        let z = -320.0 + hash01(i * 31 + 7) * 640.0;
        if x.abs() < 120.0 && z.abs() < 110.0 {
            continue;
        }
        spawn_model(
            commands,
            if i % 4 == 0 {
                kit.cypress.clone()
            } else {
                kit.broadleaf_olive.clone()
            },
            Vec3::new(x, height_at(x, z), z),
            hash01(i) * PI,
            1.2 + hash01(i * 5) * 1.1,
            "Distant tree",
        );
    }

    // Foreground creek vegetation frames the battlefield instead of filling it.
    for i in 0..65 {
        let x = -112.0 + hash01(i * 41 + 8) * 82.0;
        let z = 78.0 + hash01(i * 43 + 3) * 40.0;
        spawn_model(
            commands,
            if i % 5 == 0 {
                kit.cypress.clone()
            } else if i % 3 == 0 {
                kit.broadleaf_gold.clone()
            } else {
                kit.broadleaf_olive.clone()
            },
            Vec3::new(x, height_at(x, z), z),
            hash01(i) * PI,
            if i % 4 == 0 {
                0.35
            } else {
                1.3 + hash01(i * 3) * 0.7
            },
            "Creek grove",
        );
    }

    spawn_model(
        commands,
        kit.bridge.clone(),
        Vec3::new(-58.0, height_at(-58.0, 59.0) + 0.55, 59.0),
        0.64,
        1.25,
        "Stone bridge",
    );

    let wall_mesh = meshes.add(Cuboid::new(0.92, 0.52, 0.78));
    let wall_material = materials.add(StandardMaterial {
        base_color: Color::srgb(0.32, 0.30, 0.25),
        perceptual_roughness: 1.0,
        ..default()
    });
    for (x, z, length, yaw) in [
        (-15.0, 64.0, 42.0, -0.09),
        (18.0, 90.0, 32.0, 0.06),
        (-4.0, 77.0, 28.0, FRAC_PI_2 + 0.1),
    ] {
        let count = (length / 1.35) as usize;
        let direction = Vec2::new(yaw.cos(), -yaw.sin());
        for index in 0..count {
            let offset = (index as f32 - count as f32 * 0.5) * 1.32;
            let point = Vec2::new(x, z) + direction * offset;
            commands.spawn((
                Name::new("Field stone wall"),
                Mesh3d(wall_mesh.clone()),
                MeshMaterial3d(wall_material.clone()),
                Transform::from_xyz(point.x, height_at(point.x, point.y) + 0.32, point.y)
                    .with_rotation(Quat::from_rotation_y(yaw + hash01(index * 5) * 0.2)),
            ));
        }
    }
}

fn spawn_village(commands: &mut Commands, kit: &ModelKit) {
    spawn_model(
        commands,
        kit.church.clone(),
        Vec3::new(-64.0, height_at(-64.0, -72.0), -72.0),
        -0.20,
        2.5,
        "Village church",
    );
    let houses = [
        (-91.0, -78.0, 0.08, 1.18),
        (-88.0, -54.0, -0.21, 1.05),
        (-53.0, -52.0, 0.16, 1.12),
        (-35.0, -76.0, -0.12, 1.20),
        (-25.0, -57.0, 0.09, 0.98),
        (-79.0, -99.0, 0.25, 1.08),
        (-46.0, -99.0, -0.30, 0.94),
    ];
    for (x, z, yaw, scale) in houses {
        spawn_model(
            commands,
            kit.farmhouse.clone(),
            Vec3::new(x, height_at(x, z), z),
            yaw,
            scale * 1.7,
            "Village farmhouse",
        );
    }
}

fn spawn_wagon_fort(commands: &mut Commands, kit: &ModelKit) {
    let start = Vec2::new(-64.0, 18.0);
    let direction = Vec2::new(1.0, -0.28).normalize();
    let yaw = -direction.y.atan2(direction.x);
    for i in 0..13 {
        let p = start + direction * (i as f32 * 9.3);
        spawn_model(
            commands,
            kit.wagon.clone(),
            Vec3::new(p.x, height_at(p.x, p.y), p.y),
            yaw,
            1.85,
            "Hussite war wagon",
        );
        if i % 2 == 0 {
            let stake = p + Vec2::new(-direction.y, direction.x) * 8.0;
            spawn_model(
                commands,
                kit.stakes.clone(),
                Vec3::new(stake.x, height_at(stake.x, stake.y), stake.y),
                yaw,
                1.65,
                "Defensive stakes",
            );
        }
        for row in 0..2 {
            let side = p + Vec2::new(direction.y, -direction.x) * (5.5 + row as f32 * 3.2);
            let scene = if (i + row) % 3 == 0 {
                kit.infantry_handgun.clone()
            } else {
                kit.infantry_polearm.clone()
            };
            spawn_model(
                commands,
                scene,
                Vec3::new(side.x, height_at(side.x, side.y), side.y),
                yaw - FRAC_PI_2,
                1.55,
                "Wagon infantry",
            );
        }
    }
    for i in [1, 6, 10] {
        let p = start + direction * (i as f32 * 9.3) + Vec2::new(direction.y, -direction.x) * 1.5;
        spawn_model(
            commands,
            kit.banner.clone(),
            Vec3::new(p.x, height_at(p.x, p.y), p.y),
            yaw,
            1.8,
            "Chalice banner",
        );
    }
}

fn spawn_attackers(commands: &mut Commands, kit: &ModelKit) {
    for i in 0..52 {
        let column = (i % 13) as f32;
        let row = (i / 13) as f32;
        let jitter_x = (hash01(i * 9 + 2) - 0.5) * 3.0;
        let jitter_z = (hash01(i * 11 + 4) - 0.5) * 3.0;
        let x = 28.0 + column * 5.0 + jitter_x + row * 4.0;
        let z = 58.0 + row * 10.0 + jitter_z - column * 0.55;
        let origin = Vec3::new(x, height_at(x, z), z);
        let mut entity = commands.spawn((
            Name::new("Approaching cavalry"),
            WorldAssetRoot(kit.cavalry.clone()),
            Transform::from_translation(origin)
                .with_rotation(Quat::from_rotation_y(-2.22))
                .with_scale(Vec3::splat(1.95 + hash01(i * 17) * 0.18)),
            Attacker {
                origin,
                advance: Vec3::new(-34.0 - row * 2.0, 0.0, -32.0),
                initial_advance: Vec3::new(-34.0 - row * 2.0, 0.0, -32.0),
                phase: hash01(i * 23) * 1.6,
            },
            AnimationToPlay {
                graph: kit.cavalry_animation.clone(),
                index: kit.cavalry_animation_index,
                phase: hash01(i * 37) * 2.0,
            },
        ));
        entity.observe(play_animation_when_ready);
        if i % 9 == 0 {
            entity.with_child((
                Name::new("Cavalry banner"),
                WorldAssetRoot(kit.banner.clone()),
                Transform::from_xyz(0.0, 0.0, 0.0).with_scale(Vec3::splat(0.9)),
            ));
        }
    }

    for i in 0..112 {
        let column = (i % 16) as f32;
        let row = (i / 16) as f32;
        let x = -14.0 + column * 2.4 + (hash01(i * 7) - 0.5) * 1.5;
        let z = 49.0 + row * 3.1 + (hash01(i * 13) - 0.5) * 1.6;
        let origin = Vec3::new(x, height_at(x, z), z);
        let scene = match i % 3 {
            0 => kit.infantry_shield.clone(),
            1 => kit.infantry_polearm.clone(),
            _ => kit.infantry_handgun.clone(),
        };
        commands.spawn((
            Name::new("Approaching infantry"),
            WorldAssetRoot(scene),
            Transform::from_translation(origin)
                .with_rotation(Quat::from_rotation_y(-2.32))
                .with_scale(Vec3::splat(1.55 + hash01(i * 31) * 0.12)),
            Attacker {
                origin,
                advance: Vec3::new(-22.0, 0.0, -18.0),
                initial_advance: Vec3::new(-22.0, 0.0, -18.0),
                phase: hash01(i * 29) * 1.3,
            },
        ));
    }
}

fn play_animation_when_ready(
    scene_ready: On<WorldInstanceReady>,
    mut commands: Commands,
    children: Query<&Children>,
    animations: Query<&AnimationToPlay>,
    mut players: Query<&mut AnimationPlayer>,
) {
    let Ok(animation) = animations.get(scene_ready.entity) else {
        return;
    };
    for child in children.iter_descendants(scene_ready.entity) {
        if let Ok(mut player) = players.get_mut(child) {
            player
                .play(animation.index)
                .repeat()
                .seek_to(animation.phase);
            commands
                .entity(child)
                .insert(AnimationGraphHandle(animation.graph.clone()));
        }
    }
}

fn spawn_smoke(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let mesh = meshes.add(Sphere::new(1.0).mesh().ico(2).expect("valid smoke sphere"));
    let material = materials.add(StandardMaterial {
        base_color: Color::srgba(0.70, 0.67, 0.61, 0.18),
        perceptual_roughness: 1.0,
        alpha_mode: AlphaMode::Blend,
        unlit: true,
        ..default()
    });
    for i in 0..28 {
        let line = Vec2::new(
            -64.0 + (i % 14) as f32 * 8.96,
            18.0 - (i % 14) as f32 * 2.51,
        );
        let origin = Vec3::new(
            line.x + (hash01(i * 3) - 0.5) * 2.0,
            height_at(line.x, line.y) + 3.0,
            line.y + (hash01(i * 5) - 0.5) * 1.5,
        );
        commands.spawn((
            Name::new("Handgun smoke"),
            NotShadowCaster,
            Mesh3d(mesh.clone()),
            MeshMaterial3d(material.clone()),
            Transform::from_translation(origin),
            SmokePuff {
                origin,
                phase: (i / 2) as f32 * 0.17,
            },
        ));
    }
}

fn spawn_model(
    commands: &mut Commands,
    scene: Handle<WorldAsset>,
    position: Vec3,
    yaw: f32,
    scale: f32,
    name: &'static str,
) {
    commands.spawn((
        Name::new(name),
        WorldAssetRoot(scene),
        Transform::from_translation(position)
            .with_rotation(Quat::from_rotation_y(yaw))
            .with_scale(Vec3::splat(scale)),
    ));
}

fn hash01(value: usize) -> f32 {
    let mut x = value as u32;
    x = x.wrapping_mul(0x45d9f3b);
    x ^= x >> 16;
    x = x.wrapping_mul(0x45d9f3b);
    x ^= x >> 16;
    (x as f32) / (u32::MAX as f32)
}
