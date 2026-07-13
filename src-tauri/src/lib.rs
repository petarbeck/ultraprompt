use tauri_plugin_sql::{Migration, MigrationKind};

mod pipeline;
mod done;
mod import;
mod bookmark;

/// Create a macOS security-scoped bookmark for a project's working directory (base64),
/// so the pipeline can keep writing to it under the Mac App Store sandbox. Returns null
/// off macOS or when bookmarking isn't available (e.g. an unsandboxed build).
#[tauri::command]
fn create_working_dir_bookmark(path: String) -> Option<String> {
    bookmark::create(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = vec![Migration {
    version: 1,
    description: "create_initial_schema",
    sql: "
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      working_dir TEXT NOT NULL,
      target_subpath TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE lanes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL
    );
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      lane_id INTEGER REFERENCES lanes(id) ON DELETE SET NULL,
      body TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT, sent_path TEXT, archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      text TEXT NOT NULL DEFAULT '',
      is_checked INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL
    );
    INSERT INTO lanes (name, emoji, position) VALUES
      ('Backlog','💡',0),('Selected','',1),('In Progress','',2),('Ready','',3);
    ",
    kind: MigrationKind::Up,
  },
  Migration {
    version: 2,
    description: "add_task_completed_at",
    sql: "ALTER TABLE tasks ADD COLUMN completed_at TEXT;",
    kind: MigrationKind::Up,
  },
  Migration {
    version: 3,
    description: "reseed_lane_emojis",
    // Fill in emojis for the standard seeded lanes without clobbering any the
    // user has set (only touch rows whose emoji is still empty).
    sql: "
    UPDATE lanes SET emoji='💡'   WHERE name='Backlog'     AND emoji='';
    UPDATE lanes SET emoji='☑️'   WHERE name='Selected'    AND emoji='';
    UPDATE lanes SET emoji='👨‍💻' WHERE name='In Progress' AND emoji='';
    UPDATE lanes SET emoji='✅'   WHERE name='Ready'       AND emoji='';
    ",
    kind: MigrationKind::Up,
  },
  Migration {
    version: 4,
    description: "rename_default_lanes_specify_plan",
    // New installations: rename the two middle default lanes to the intended workflow
    // (Backlog / Specify / Plan / Ready). Append-only, so v1-v3 checksums are untouched
    // (NEVER edit an applied migration — it changes its checksum and breaks DB load).
    // A no-op on any DB whose lanes were already renamed/customized (matched by old name).
    sql: "
    UPDATE lanes SET name='Specify' WHERE name='Selected';
    UPDATE lanes SET name='Plan'    WHERE name='In Progress';
    ",
    kind: MigrationKind::Up,
  },
  Migration {
    version: 5,
    description: "add_project_working_dir_bookmark",
    // macOS App Store (sandbox): a base64 security-scoped bookmark for the project's
    // working dir, so the pipeline can keep writing to it across launches. Null/unused
    // for Developer-ID and dev builds. Append-only (v1-v4 checksums untouched).
    sql: "ALTER TABLE projects ADD COLUMN working_dir_bookmark TEXT;",
    kind: MigrationKind::Up,
  }];

  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:ultraprompt.db", migrations)
        .build(),
    )
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .invoke_handler(tauri::generate_handler![
      pipeline::pipeline_task,
      pipeline::revoke_queued,
      done::list_queue_status,
      import::import_markdown_dir,
      create_working_dir_bookmark
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
