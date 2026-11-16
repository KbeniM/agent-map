// why: release builds on Windows must not open a console window next to the app
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    agent_map_lib::run()
}
