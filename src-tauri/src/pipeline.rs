use std::fs;
use std::path::{Path, PathBuf};

/// Pick a `<base>.md` filename inside `queue_dir` that collides with neither an
/// existing queue file NOR an already-processed file of the same name in
/// `done_dir`. Because the harness only ever *moves* files queue→done (never
/// deletes), `done/` accumulates; deduping against it guarantees a filename that
/// appears in `done/` uniquely identifies the pipeline that produced it, so
/// completion polling can never mistake a fresh task for a previously-done one.
fn unique_queue_path(queue_dir: &Path, done_dir: &Path, base_name: &str) -> PathBuf {
    let safe = if base_name.is_empty() { "task" } else { base_name };
    let taken = |c: &Path| {
        c.exists() || c.file_name().is_some_and(|n| done_dir.join(n).exists())
    };
    let mut candidate = queue_dir.join(format!("{safe}.md"));
    let mut n = 2;
    while taken(&candidate) {
        candidate = queue_dir.join(format!("{safe}-{n}.md"));
        n += 1;
    }
    candidate
}

/// Pipeline a task's body to the project's global queue: `<working_dir>/.ultraprompt/queue/`.
/// The AI harness consumes files from there and moves finished ones to `.ultraprompt/done/`.
#[tauri::command]
pub fn pipeline_task(
    working_dir: String,
    base_name: String,
    body: String,
    bookmark: Option<String>,
) -> Result<String, String> {
    // `bookmark` re-establishes sandbox access to the (user-picked) working dir on MAS
    // builds; it's a no-op when None (unsandboxed builds). See bookmark.rs.
    crate::bookmark::access(bookmark.as_deref(), || {
        let root = PathBuf::from(&working_dir).join(".ultraprompt");
        let queue = root.join("queue");
        let done = root.join("done");
        fs::create_dir_all(&queue).map_err(|e| e.to_string())?;
        let path = unique_queue_path(&queue, &done, &base_name);
        fs::write(&path, &body).map_err(|e| e.to_string())?;
        path.to_str().map(str::to_string).ok_or_else(|| "invalid path".into())
    })
}

/// Revoke a still-queued task by deleting its file from `.ultraprompt/queue/`.
/// Only ever touches `queue/` (never `processing/` or `done/`), and only the
/// file's basename is used, so a caller can't escape the queue dir. A missing
/// file is a no-op (the harness may have already picked it up).
#[tauri::command]
pub fn revoke_queued(
    working_dir: String,
    base_name: String,
    bookmark: Option<String>,
) -> Result<(), String> {
    crate::bookmark::access(bookmark.as_deref(), || {
        let queue = PathBuf::from(&working_dir).join(".ultraprompt").join("queue");
        let name = Path::new(&base_name)
            .file_name()
            .ok_or_else(|| "invalid file name".to_string())?;
        let path = queue.join(name);
        if path.exists() {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn dirs(tmp: &Path) -> (PathBuf, PathBuf) {
        let queue = tmp.join(".ultraprompt").join("queue");
        let done = tmp.join(".ultraprompt").join("done");
        fs::create_dir_all(&queue).unwrap();
        fs::create_dir_all(&done).unwrap();
        (queue, done)
    }

    #[test]
    fn dedupes_within_the_queue() {
        let tmp = tempfile::tempdir().unwrap();
        let (q, d) = dirs(tmp.path());
        let p1 = unique_queue_path(&q, &d, "my-task");
        fs::write(&p1, "a").unwrap();
        let p2 = unique_queue_path(&q, &d, "my-task");
        assert!(p1.ends_with("my-task.md"));
        assert!(p2.ends_with("my-task-2.md"));
    }

    #[test]
    fn dedupes_against_already_done_files() {
        // Regression: a completed file lingering in done/ must not let a fresh
        // task reuse its name (which would flip it "completed" instantly).
        let tmp = tempfile::tempdir().unwrap();
        let (q, d) = dirs(tmp.path());
        fs::write(d.join("fix-login-bug.md"), "old").unwrap(); // already processed
        let p = unique_queue_path(&q, &d, "fix-login-bug");
        assert!(p.ends_with("fix-login-bug-2.md"), "got {p:?}");
    }

    #[test]
    fn empty_name_falls_back() {
        let tmp = tempfile::tempdir().unwrap();
        let (q, d) = dirs(tmp.path());
        let p = unique_queue_path(&q, &d, "");
        assert!(p.ends_with("task.md"));
    }

    #[test]
    fn revoke_removes_only_the_queue_file() {
        let tmp = tempfile::tempdir().unwrap();
        let (q, _d) = dirs(tmp.path());
        let f = q.join("revoke-me.md");
        fs::write(&f, "x").unwrap();
        let wd = tmp.path().to_str().unwrap().to_string();
        revoke_queued(wd.clone(), "revoke-me.md".to_string(), None).unwrap();
        assert!(!f.exists());
        // A missing file is a no-op (harness may already have moved it).
        revoke_queued(wd, "gone.md".to_string(), None).unwrap();
    }

    #[test]
    fn revoke_ignores_path_traversal() {
        let tmp = tempfile::tempdir().unwrap();
        let (_q, _d) = dirs(tmp.path());
        let outside = tmp.path().join("secret.md");
        fs::write(&outside, "keep").unwrap();
        // Only the basename is used, so this targets queue/secret.md (absent), not the file above.
        revoke_queued(tmp.path().to_str().unwrap().to_string(), "../secret.md".to_string(), None).unwrap();
        assert!(outside.exists(), "traversal must not delete files outside queue/");
    }

    #[test]
    fn pipeline_task_writes_into_ultraprompt_queue() {
        let tmp = tempfile::tempdir().unwrap();
        let p = pipeline_task(
            tmp.path().to_str().unwrap().to_string(),
            "my-task".to_string(),
            "hi".to_string(),
            None,
        )
        .unwrap();
        assert!(p.replace('\\', "/").ends_with(".ultraprompt/queue/my-task.md"), "got {p}");
        assert_eq!(fs::read_to_string(&p).unwrap(), "hi");
    }
}
