use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct Bridge(Mutex<Option<CommandChild>>);

// why: the webview origin differs per platform (tauri://localhost on macOS/Linux, http://tauri.localhost on Windows)
const ORIGINS: &str = "tauri://localhost,http://tauri.localhost,http://localhost:5173";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Bridge(Mutex::new(None)))
        .setup(|app| {
            // why: a bridge already listening on 4000 (bun run dev) keeps working; the sidecar then fails to bind and the app uses that one
            let (_events, child) = app
                .shell()
                .sidecar("agent-map-bridge")?
                .env("HOST", "127.0.0.1")
                .env("BRIDGE_PORT", "4000")
                .env("WEB_ORIGIN", ORIGINS)
                .env("NODE_ENV", "production")
                .env("AGENT_MAP_EXIT_WITH_STDIN", "1")
                .spawn()?;
            *app.state::<Bridge>().0.lock().unwrap() = Some(child);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building agent-map");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(child) = handle.state::<Bridge>().0.lock().unwrap().take() {
                let _ = child.kill();
            }
        }
    });
}
