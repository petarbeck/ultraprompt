use std::fs;
use std::path::PathBuf;

/// Read every `.md` file (non-recursive) in `dir` and return their contents,
/// sorted by filename. Used to bulk-import tasks into a project's first lane.
#[tauri::command]
pub fn import_markdown_dir(dir: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(PathBuf::from(&dir)).map_err(|e| e.to_string())?;
    let mut files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file() && p.extension().and_then(|s| s.to_str()) == Some("md"))
        .collect();
    files.sort();
    let mut bodies = Vec::new();
    for f in files {
        match fs::read_to_string(&f) {
            Ok(c) => bodies.push(c),
            Err(e) => return Err(format!("failed to read {}: {e}", f.display())),
        }
    }
    Ok(bodies)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_only_md_sorted_by_name() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("b.md"), "second").unwrap();
        fs::write(tmp.path().join("a.md"), "first").unwrap();
        fs::write(tmp.path().join("note.txt"), "ignored").unwrap();
        let got = import_markdown_dir(tmp.path().to_str().unwrap().to_string()).unwrap();
        assert_eq!(got, vec!["first".to_string(), "second".to_string()]);
    }
    #[test]
    fn missing_dir_errors() {
        assert!(import_markdown_dir("/no/such/dir/xyz".to_string()).is_err());
    }
}
