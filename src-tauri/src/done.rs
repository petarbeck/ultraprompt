use std::fs;
use std::path::{Path, PathBuf};

fn list_md(dir: &Path) -> Vec<String> {
    match fs::read_dir(dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|n| n.ends_with(".md"))
            .collect(),
        Err(_) => Vec::new(),
    }
}

#[derive(serde::Serialize)]
pub struct QueueStatus {
    pub processing: Vec<String>,
    pub done: Vec<String>,
}

/// List the `.md` filenames the AI harness has moved into
/// `<working_dir>/.ultraprompt/processing/` (picked up, in flight) and
/// `.ultraprompt/done/` (finished). Missing dirs yield empty lists. Used to poll
/// each pipelined task's Queued / Processing / Completed status.
#[tauri::command]
pub fn list_queue_status(working_dir: String, bookmark: Option<String>) -> QueueStatus {
    crate::bookmark::access(bookmark.as_deref(), || {
        let root = PathBuf::from(&working_dir).join(".ultraprompt");
        QueueStatus {
            processing: list_md(&root.join("processing")),
            done: list_md(&root.join("done")),
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lists_only_md_files() {
        let tmp = tempfile::tempdir().unwrap();
        let done = tmp.path().join(".ultraprompt").join("done");
        fs::create_dir_all(&done).unwrap();
        fs::write(done.join("a.md"), "x").unwrap();
        fs::write(done.join("b.txt"), "y").unwrap();
        let s = list_queue_status(tmp.path().to_str().unwrap().to_string(), None);
        assert_eq!(s.done, vec!["a.md".to_string()]);
        assert!(s.processing.is_empty());
    }
    #[test]
    fn reports_processing_and_done_separately() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join(".ultraprompt");
        fs::create_dir_all(root.join("processing")).unwrap();
        fs::create_dir_all(root.join("done")).unwrap();
        fs::write(root.join("processing").join("p.md"), "x").unwrap();
        fs::write(root.join("done").join("d.md"), "y").unwrap();
        let s = list_queue_status(tmp.path().to_str().unwrap().to_string(), None);
        assert_eq!(s.processing, vec!["p.md".to_string()]);
        assert_eq!(s.done, vec!["d.md".to_string()]);
    }
    #[test]
    fn missing_dirs_are_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let s = list_queue_status(tmp.path().to_str().unwrap().to_string(), None);
        assert!(s.processing.is_empty() && s.done.is_empty());
    }
}
