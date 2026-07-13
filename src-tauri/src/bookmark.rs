//! macOS security-scoped bookmarks for the Mac App Store (App Sandbox) build.
//!
//! Under the App Sandbox an MAS build may only read/write files the user explicitly
//! grants access to. Ultraprompt writes `.ultraprompt/queue/*.md` into each project's
//! *working directory* (an arbitrary path the user picks). To keep that access across
//! launches we store a **security-scoped bookmark** for each working dir at pick time and
//! re-establish access around the filesystem commands.
//!
//! Outside the sandbox (Developer-ID / `tauri dev` builds) this is transparent: `create`
//! may return `None` and `access` simply runs the closure — the app behaves identically.
//! The sandbox grant itself can only be exercised in a signed, MAS-entitled build.

/// Create a base64 security-scoped bookmark for `path`. `None` if unsupported/failed.
pub fn create(path: &str) -> Option<String> {
    imp::create(path)
}

/// Run `f` with security-scoped access to the bookmarked resource re-established (and
/// released afterwards). If `bookmark` is `None` or resolution fails, `f` still runs —
/// so unsandboxed builds, where access is unrestricted, work unchanged.
pub fn access<T>(bookmark: Option<&str>, f: impl FnOnce() -> T) -> T {
    imp::access(bookmark, f)
}

#[cfg(target_os = "macos")]
mod imp {
    use objc2::runtime::Bool;
    use objc2::AnyThread;
    use objc2_foundation::{
        NSData, NSDataBase64DecodingOptions, NSDataBase64EncodingOptions,
        NSURLBookmarkCreationOptions, NSURLBookmarkResolutionOptions, NSString, NSURL,
    };

    pub fn create(path: &str) -> Option<String> {
        let ns_path = NSString::from_str(path);
        let url = unsafe { NSURL::fileURLWithPath(&ns_path) };
        let data = unsafe {
            url.bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
                NSURLBookmarkCreationOptions::WithSecurityScope,
                None,
                None,
            )
        }
        .ok()?;
        let b64 =
            unsafe { data.base64EncodedStringWithOptions(NSDataBase64EncodingOptions::empty()) };
        Some(b64.to_string())
    }

    pub fn access<T>(bookmark: Option<&str>, f: impl FnOnce() -> T) -> T {
        let Some(b64) = bookmark else { return f() };
        let ns_b64 = NSString::from_str(b64);
        let data = unsafe {
            NSData::initWithBase64EncodedString_options(
                NSData::alloc(),
                &ns_b64,
                NSDataBase64DecodingOptions::empty(),
            )
        };
        let Some(data) = data else { return f() };
        let mut stale = Bool::NO;
        let url = unsafe {
            NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
                &data,
                NSURLBookmarkResolutionOptions::WithSecurityScope,
                None,
                &mut stale,
            )
        };
        let Ok(url) = url else { return f() };
        let started = unsafe { url.startAccessingSecurityScopedResource() };
        let out = f();
        if started {
            unsafe { url.stopAccessingSecurityScopedResource() };
        }
        out
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    pub fn create(_path: &str) -> Option<String> {
        None
    }
    pub fn access<T>(_bookmark: Option<&str>, f: impl FnOnce() -> T) -> T {
        f()
    }
}
