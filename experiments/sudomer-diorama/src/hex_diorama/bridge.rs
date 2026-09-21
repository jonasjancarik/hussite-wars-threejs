use bevy::prelude::*;
use serde::Deserialize;

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub protocol_version: u32,
    pub generation: u32,
    pub revision: u64,
    pub scenario: Option<String>,
    pub round: u32,
    pub faction: String,
    pub state: String,
    pub busy: bool,
    pub paused: bool,
    pub tiles: Vec<Tile>,
    pub units: Vec<Unit>,
    pub selected_unit_id: Option<u32>,
    pub legal_moves: Vec<Coord>,
    pub legal_attacks: Vec<AttackTarget>,
    pub march_targets: Vec<Coord>,
    #[serde(default)]
    pub events: Vec<CosmeticEvent>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Tile {
    pub col: i32,
    pub row: i32,
    pub terrain: String,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Deserialize)]
pub struct Coord {
    pub col: i32,
    pub row: i32,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttackTarget {
    pub unit_id: u32,
    pub col: i32,
    pub row: i32,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Unit {
    pub id: u32,
    pub r#type: String,
    pub name: String,
    pub faction: String,
    pub unit_class: String,
    pub col: i32,
    pub row: i32,
    pub health: f32,
    pub max_health: f32,
    pub morale: f32,
    pub max_morale: f32,
    pub formation_closed: bool,
    pub marching: bool,
}
#[derive(Clone, Debug, Deserialize)]
pub struct CosmeticEvent {
    pub id: String,
    pub r#type: String,
    pub col: i32,
    pub row: i32,
}

#[derive(Resource, Default)]
pub struct SnapshotState {
    pub current: Option<Snapshot>,
    pub changed: bool,
    pub error: Option<String>,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
extern "C" {
    #[wasm_bindgen::prelude::wasm_bindgen(js_namespace = SudomerHexBridge, js_name = takeSnapshot)]
    fn take_snapshot() -> String;
    #[wasm_bindgen::prelude::wasm_bindgen(js_namespace = SudomerHexBridge, js_name = sendCommand)]
    pub fn send_command(command: &str) -> String;
}

pub fn poll(mut state: ResMut<SnapshotState>) {
    state.changed = false;
    #[cfg(target_arch = "wasm32")]
    {
        let text = take_snapshot();
        if text.is_empty() {
            return;
        }
        match serde_json::from_str::<Snapshot>(&text) {
            Ok(snapshot) if snapshot.protocol_version == 1 => {
                state.current = Some(snapshot);
                state.changed = true;
                state.error = None;
            }
            Ok(snapshot) => {
                state.error = Some(format!(
                    "Unsupported bridge protocol {}",
                    snapshot.protocol_version
                ))
            }
            Err(error) => state.error = Some(format!("Invalid rules snapshot: {error}")),
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    if state.current.is_none() {
        state.current = Some(fixture());
        state.changed = true;
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn fixture() -> Snapshot {
    let mut tiles = Vec::new();
    for col in 0..20 {
        for row in 0..12 {
            let terrain = if (6..=13).contains(&col) && row <= 4 {
                "water"
            } else if (6..=13).contains(&col) && row >= 7 {
                "mud"
            } else if col == 9 && (row == 5 || row == 6) {
                "dam"
            } else {
                "plains"
            };
            tiles.push(Tile {
                col,
                row,
                terrain: terrain.into(),
            });
        }
    }
    let specs = [
        (1, "VOZOVA_HRADBA", "wagon", 9, 5),
        (2, "VOZOVA_HRADBA", "wagon", 9, 6),
        (3, "VOZOVA_HRADBA", "wagon", 8, 6),
        (4, "KUSINICI_HUSITI", "ranged", 10, 5),
        (5, "RUCNICARI", "ranged", 11, 5),
        (6, "CEPNICI", "infantry", 12, 5),
        (7, "JAN_ZIZKA", "commander", 13, 6),
        (8, "JIZDA_HUSITI", "cavalry", 14, 6),
        (9, "BOHUSLAV_SVAMBERK", "commander", 2, 5),
        (10, "TEZKY_RYTIR", "heavyCavalry", 3, 5),
        (11, "TEZKOODENCI", "cavalry", 5, 6),
        (12, "KOPINICI", "infantry", 2, 6),
        (13, "KUSNICI", "ranged", 0, 5),
    ];
    let units = specs
        .into_iter()
        .map(|(id, t, c, col, row)| Unit {
            id,
            r#type: t.into(),
            name: t.into(),
            faction: if id < 9 { "hussites" } else { "crusaders" }.into(),
            unit_class: c.into(),
            col,
            row,
            health: 80.0,
            max_health: 80.0,
            morale: 70.0,
            max_morale: 70.0,
            formation_closed: false,
            marching: false,
        })
        .collect();
    Snapshot {
        protocol_version: 1,
        generation: 1,
        revision: 1,
        scenario: Some("sudomere_1420".into()),
        round: 1,
        faction: "hussites".into(),
        state: "playing".into(),
        busy: false,
        paused: false,
        tiles,
        units,
        selected_unit_id: None,
        legal_moves: vec![],
        legal_attacks: vec![],
        march_targets: vec![],
        events: vec![],
    }
}

pub fn command(snapshot: &Snapshot, action: &str, extra: &str) {
    #[cfg(target_arch = "wasm32")]
    {
        let json = format!(
            r#"{{"protocolVersion":1,"generation":{},"revision":{},"action":"{}"{}}}"#,
            snapshot.generation, snapshot.revision, action, extra
        );
        let _ = send_command(&json);
    }
    #[cfg(not(target_arch = "wasm32"))]
    let _ = (snapshot, action, extra);
}
