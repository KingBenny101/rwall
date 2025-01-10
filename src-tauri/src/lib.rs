use dirs::picture_dir;
use walkdir::WalkDir;
use std::{thread, vec};
use tauri::{AppHandle, Emitter};
use git2::{RemoteCallbacks, Progress};
use std::path::Path;
use std::sync::{Arc, Mutex};
use wallpaper;
use urlencoding::decode;


#[tauri::command]
fn load(app: AppHandle) {
    println!("Load from Rust");
    let images = get_images();
    if images.len() > 0 {
        app.emit("IMAGES-LOADED", images).unwrap();
        return;
    }

    let pictures_dir = picture_dir().unwrap().join("rwall_temp");

    if pictures_dir.exists(){
        std::fs::remove_dir_all(&pictures_dir).unwrap();
    }

    let url = "https://github.com/Incalculas/wallpapers";
    thread::spawn(move || {
        if let Err(e) = clone_repo_with_progress(&url,pictures_dir.to_str().unwrap(),app.clone()) {
            eprintln!("Clone failed: {}", e);
        }
    app.emit("REPO-CLONED", &url).unwrap();
    move_images(app.clone());
    let images = get_images();
    app.emit("IMAGES-LOADED", images).unwrap();
    }); 
}

#[tauri::command]
fn set(image: &str) {
    println!("Set from Rust");
    set_wallpaper(image);
}

#[tauri::command]
fn erase() {
    println!("Erase from Rust");
    let pictures_dir = picture_dir().unwrap().join("rwall");

    if pictures_dir.exists(){
        std::fs::remove_dir_all(&pictures_dir).unwrap();
    }

}

fn clone_repo_with_progress(url: &str, dest: &str,app: AppHandle) -> Result<(), git2::Error> {
    let path = Path::new(dest);
    let progress = Arc::new(Mutex::new(0));

    let mut callbacks = RemoteCallbacks::new();
    callbacks.transfer_progress({
        let progress = Arc::clone(&progress);
        move |stats: Progress| {
            let percent = if stats.total_objects() > 0 {
                100 * stats.received_objects() / stats.total_objects()
            } else {
                0
            };
            *progress.lock().unwrap() = percent;
            println!("Cloning... {}% ({}/{})", percent, stats.received_objects(), stats.total_objects());
            let _ = app.emit("CLONE-PROGRESS", percent);
            true 
        }
    });

    let mut options = git2::FetchOptions::new();
    options.remote_callbacks(callbacks);

    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(options);

    let repo = builder.clone(url, path)?;
    println!("Clone completed: {}", repo.path().display());

    Ok(())
}

fn move_images(app: AppHandle){
    let pictures_dir = picture_dir().unwrap().join("rwall_temp");

    let new_dir = picture_dir().unwrap().join("rwall");

    if new_dir.exists(){
        std::fs::remove_dir_all(&new_dir).unwrap();
    }
    std::fs::create_dir(&new_dir).unwrap();

    let total_count = WalkDir::new(&pictures_dir).into_iter().filter_map(Result::ok).count();
    let mut count = 0;
    for entry in WalkDir::new(&pictures_dir)
        .into_iter()
        .filter_map(Result::ok) 
    {
        if entry.file_type().is_file() {
            println!("File: {}", entry.path().display());
            let new_path = new_dir.join(entry.file_name());
            std::fs::copy(entry.path(), new_path).unwrap();
            count += 1;
        } 

        app.emit("MOVE-PROGRESS", count*100/total_count).unwrap();
    }

    println!("Moved the repository");
    app.emit("IMAGES-MOVED", count).unwrap();

    std::fs::remove_dir_all(&pictures_dir).unwrap();

}

fn get_images() -> Vec<String> {
    let mut vec = Vec::new();
    let pictures_dir = picture_dir().unwrap().join("rwall");
    
    for entry in WalkDir::new(&pictures_dir)
        .into_iter()
        .filter_map(Result::ok) 
    {
        if entry.file_type().is_file() {
            
            // check if the file is an image
            let ext = entry.path().extension();

            if ext == None {
                continue;
            }

            let ext = ext.unwrap().to_str().unwrap();

            if ext != "jpg" && ext != "jpeg" && ext != "png" {
                continue;
            }
            vec.push(entry.path().display().to_string());
        } 
    }
    vec
}

fn set_wallpaper (image: &str) {
    let image = decode(image).expect("Failed to decode image path");
    println!("Setting wallpaper to {}", image);
    wallpaper::set_from_path(&image).unwrap();
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ load,set,erase])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
