use bevy::{
    asset::AssetPlugin,
    diagnostic::{FrameTimeDiagnosticsPlugin, LogDiagnosticsPlugin},
    light::DirectionalLightShadowMap,
    prelude::*,
    window::{PresentMode, WindowResolution},
};

pub fn run(playable: bool) {
    let mut app = App::new();
    app.insert_resource(super::BattleMode(playable))
        .insert_resource(ClearColor(Color::srgb(0.16, 0.19, 0.21)))
        .insert_resource(GlobalAmbientLight {
            color: Color::srgb(0.70, 0.79, 0.92),
            brightness: 260.0,
            ..default()
        })
        .insert_resource(DirectionalLightShadowMap { size: 4096 })
        .add_plugins(
            DefaultPlugins
                .set(AssetPlugin {
                    file_path: if cfg!(target_arch = "wasm32") {
                        "assets".into()
                    } else {
                        format!("{}/assets", env!("CARGO_MANIFEST_DIR"))
                    },
                    ..default()
                })
                .set(WindowPlugin {
                    primary_window: Some(Window {
                        title: "Hussite Battlefield".into(),
                        resolution: WindowResolution::new(1440, 1000),
                        fit_canvas_to_parent: true,
                        prevent_default_event_handling: true,
                        present_mode: PresentMode::AutoVsync,
                        ..default()
                    }),
                    ..default()
                }),
        )
        .add_plugins((
            FrameTimeDiagnosticsPlugin::default(),
            LogDiagnosticsPlugin::default(),
            super::DioramaPlugin,
        ));
    if playable {
        app.insert_resource(super::gameplay::BattleGround {
            height: super::layout::height,
            half_size: super::layout::SIZE / 2.0,
        })
        .add_plugins(super::gameplay::VignettePlugin)
        .add_systems(
            PreUpdate,
            super::game::controls.after(bevy::input::InputSystems),
        );
    }
    app.run();
}
