// Compatibility entry point for the former experiment.
#[path = "../diorama/mod.rs"]
mod diorama;

fn main() {
    diorama::run(false);
}
