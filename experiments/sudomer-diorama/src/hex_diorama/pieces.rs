use super::{
    board::{center, height_at_coord},
    bridge::{SnapshotState, Unit},
};
use bevy::prelude::*;
use std::hash::{DefaultHasher, Hash, Hasher};

#[derive(Component)]
pub struct UnitVisual;

fn model_for(unit: &Unit) -> (&'static str, usize, f32) {
    match unit.r#type.as_str() {
        "VOZOVA_HRADBA" => ("war_wagon", 1, 0.90),
        "JIZDA_HUSITI" | "TEZKY_RYTIR" | "TEZKOODENCI" => ("cavalry", 2, 0.85),
        "JAN_ZIZKA" | "BOHUSLAV_SVAMBERK" => ("infantry_shield", 1, 1.0),
        "VACLAV_KORANDA" => ("infantry_handgun", 1, 0.96),
        "RUCNICARI" => ("infantry_handgun", 3, 0.94),
        "KUSINICI_HUSITI" | "KUSNICI" => ("infantry_shield", 3, 0.94),
        "CEPNICI" | "SUDLICNICI" | "KOPINICI" | "HALAPARTNICI" => ("infantry_polearm", 3, 0.94),
        other => panic!("No Sudoměř display mapping for {other}"),
    }
}

pub fn sync(
    mut commands: Commands,
    state: Res<SnapshotState>,
    existing: Query<Entity, With<UnitVisual>>,
    server: Res<AssetServer>,
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
    for unit in &snapshot.units {
        unit.id.hash(&mut hasher);
        unit.col.hash(&mut hasher);
        unit.row.hash(&mut hasher);
        unit.health.to_bits().hash(&mut hasher);
        unit.formation_closed.hash(&mut hasher);
        unit.marching.hash(&mut hasher);
    }
    let signature = hasher.finish();
    if *last_signature == signature {
        return;
    }
    *last_signature = signature;
    for entity in &existing {
        commands.entity(entity).despawn();
    }
    let base_mesh = meshes.add(Cylinder::new(1.64, 0.075));
    let health_back = meshes.add(Cuboid::new(2.45, 0.07, 0.22));
    let health_fill = meshes.add(Cuboid::new(2.35, 0.085, 0.16));
    let dark = materials.add(StandardMaterial {
        base_color: Color::srgb(0.09, 0.075, 0.055),
        perceptual_roughness: 1.0,
        ..default()
    });
    let green = materials.add(StandardMaterial {
        base_color: Color::srgb(0.43, 0.64, 0.24),
        emissive: LinearRgba::new(0.04, 0.06, 0.015, 1.0),
        perceptual_roughness: 0.9,
        ..default()
    });
    let wagon_stakes: Handle<WorldAsset> =
        server.load(GltfAssetLabel::Scene(0).from_asset("models/stakes.glb"));
    let banner: Handle<WorldAsset> =
        server.load(GltfAssetLabel::Scene(0).from_asset("models/banner.glb"));

    for unit in &snapshot.units {
        let (model, count, scale) = model_for(unit);
        let root =
            center(unit.col, unit.row) + Vec3::Y * (height_at_coord(unit.col, unit.row) + 0.14);
        let selected = snapshot.selected_unit_id == Some(unit.id);
        let base_color = match (unit.faction.as_str(), selected) {
            ("hussites", true) => Color::srgba(0.65, 0.54, 0.20, 0.86),
            ("hussites", false) => Color::srgba(0.17, 0.28, 0.13, 0.78),
            (_, true) => Color::srgba(0.70, 0.40, 0.16, 0.86),
            _ => Color::srgba(0.40, 0.13, 0.09, 0.78),
        };
        commands.spawn((
            UnitVisual,
            Name::new(format!("{} group {}", unit.name, unit.id)),
            Mesh3d(base_mesh.clone()),
            MeshMaterial3d(materials.add(StandardMaterial {
                base_color,
                metallic: 0.06,
                perceptual_roughness: 0.88,
                alpha_mode: AlphaMode::Blend,
                ..default()
            })),
            Transform::from_translation(root),
        ));
        let offsets: &[Vec3] = match count {
            1 => &[Vec3::ZERO],
            2 => &[Vec3::new(-0.82, 0.0, -0.20), Vec3::new(0.82, 0.0, 0.20)],
            _ => &[
                Vec3::new(-0.91, 0.0, 0.48),
                Vec3::new(0.0, 0.0, -0.61),
                Vec3::new(0.91, 0.0, 0.48),
            ],
        };
        for (index, offset) in offsets.iter().enumerate() {
            commands.spawn((
                UnitVisual,
                Name::new(format!("{} figure {}", unit.name, index + 1)),
                WorldAssetRoot(
                    server.load(GltfAssetLabel::Scene(0).from_asset(format!("models/{model}.glb"))),
                ),
                Transform::from_translation(root + *offset + Vec3::Y * 0.08)
                    .with_rotation(Quat::from_rotation_y(if unit.faction == "hussites" {
                        -1.57
                    } else {
                        1.57
                    }))
                    .with_scale(Vec3::splat(scale)),
            ));
        }
        if unit.unit_class == "commander" {
            commands.spawn((
                UnitVisual,
                Name::new("Commander banner"),
                WorldAssetRoot(banner.clone()),
                Transform::from_translation(root + Vec3::new(-1.05, 0.08, -0.4))
                    .with_scale(Vec3::splat(0.64)),
            ));
        }
        if unit.r#type == "VOZOVA_HRADBA" && unit.formation_closed {
            commands.spawn((
                UnitVisual,
                Name::new("Closed wagon formation marker"),
                WorldAssetRoot(wagon_stakes.clone()),
                Transform::from_translation(root + Vec3::new(0.0, 0.05, 1.42))
                    .with_scale(Vec3::splat(0.42)),
            ));
        }
        if unit.r#type == "VOZOVA_HRADBA" && unit.marching {
            commands.spawn((
                UnitVisual,
                Name::new("Marching wagon banner"),
                WorldAssetRoot(banner.clone()),
                Transform::from_translation(root + Vec3::new(1.1, 0.08, -0.65))
                    .with_scale(Vec3::splat(0.48)),
            ));
        }
        let ratio = (unit.health / unit.max_health).clamp(0.0, 1.0);
        commands.spawn((
            UnitVisual,
            Name::new("Unit health bar background"),
            Mesh3d(health_back.clone()),
            MeshMaterial3d(dark.clone()),
            Transform::from_translation(root + Vec3::new(0.0, 0.11, 1.82)),
        ));
        commands.spawn((
            UnitVisual,
            Name::new("Unit health bar"),
            Mesh3d(health_fill.clone()),
            MeshMaterial3d(green.clone()),
            Transform::from_translation(root + Vec3::new(-1.175 * (1.0 - ratio), 0.16, 1.82))
                .with_scale(Vec3::new(ratio.max(0.01), 1.0, 1.0)),
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_sudomer_type_has_explicit_mapping() {
        let manifest: serde_json::Value =
            serde_json::from_str(include_str!("../../../../assets/3d/models/manifest.json"))
                .unwrap();
        for unit_type in [
            "VOZOVA_HRADBA",
            "KUSINICI_HUSITI",
            "RUCNICARI",
            "CEPNICI",
            "SUDLICNICI",
            "JAN_ZIZKA",
            "VACLAV_KORANDA",
            "JIZDA_HUSITI",
            "BOHUSLAV_SVAMBERK",
            "TEZKY_RYTIR",
            "TEZKOODENCI",
            "KOPINICI",
            "HALAPARTNICI",
            "KUSNICI",
        ] {
            let unit = Unit {
                id: 1,
                r#type: unit_type.into(),
                name: unit_type.into(),
                faction: "hussites".into(),
                unit_class: "infantry".into(),
                col: 0,
                row: 0,
                health: 1.0,
                max_health: 1.0,
                morale: 1.0,
                max_morale: 1.0,
                formation_closed: false,
                marching: false,
            };
            let (model, count, scale) = model_for(&unit);
            let dimensions = manifest[model]["dimensions_gltf_xyz_m"].as_array().unwrap();
            let half_footprint = dimensions[0]
                .as_f64()
                .unwrap()
                .max(dimensions[2].as_f64().unwrap()) as f32
                * scale
                * 0.5;
            let formation_offset = match count {
                2 => 0.82,
                3 => 0.91,
                _ => 0.0,
            };
            let extent = formation_offset + half_footprint;
            assert!(
                extent < super::super::HEX_RADIUS * 0.866,
                "{unit_type} exceeds hex inradius"
            );
        }
    }
}
