#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            // Sidecar management will be added once PyInstaller bundle is ready.
            // For development, the backend runs separately via uvicorn.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
