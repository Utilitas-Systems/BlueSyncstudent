//! System **output** audio peak on Android via `AudioPlaybackCapture` (API 29+).
//!
//! Analogous to Windows WASAPI render peak and macOS ScreenCaptureKit audio buffers.
//! This is **not** microphone monitoring.
//!
//! ## Permission / consent
//! Android requires a one-time **MediaProjection** user consent dialog (same UX burden
//! as macOS Screen Recording). Capture also needs `RECORD_AUDIO` in the manifest for
//! playback capture on many OEM builds — declare it, but the product intent is
//! system output metering only.
//!
//! ## Chromebook caveat
//! Some managed Chromebooks restrict MediaProjection / playback capture. Prefer
//! teacher-visible `android_meter_error` over crashing.
//!
//! ## Implementation status
//! ponytail: peak meter returns 0 until Kotlin `AudioPlaybackCapture` helper is wired
//! in `src-tauri/gen/android/` after `tauri android init`. JNI entry points below are
//! the contract; `androidMeterError` explains the gap in-app.

use std::sync::{Mutex, OnceLock};

static METER_ERROR: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn meter_error_mutex() -> &'static Mutex<Option<String>> {
    METER_ERROR.get_or_init(|| Mutex::new(None))
}

pub fn clear_android_meter_error() {
    *meter_error_mutex().lock().unwrap() = None;
}

pub fn set_android_meter_error(message: String) {
    *meter_error_mutex().lock().unwrap() = Some(message);
}

pub fn android_meter_error_snapshot() -> Option<String> {
    meter_error_mutex().lock().unwrap().clone()
}

/// Peak amplitude in 0.0..=1.0 when capture is running; 0.0 when unavailable.
pub fn system_audio_peak() -> Result<f32, String> {
    // Try Kotlin helper if present (added post-init). Falls back to documented stub.
    match invoke_playback_capture_peak() {
        Ok(peak) => {
            clear_android_meter_error();
            Ok(peak.clamp(0.0, 1.0))
        }
        Err(e) => {
            set_android_meter_error(e.clone());
            // Non-fatal for classroom: presence/BT still work; teacher sees audio unavailable.
            Ok(0.0)
        }
    }
}

fn invoke_playback_capture_peak() -> Result<f32, String> {
    // Contract: Kotlin class `education.bluesync.student.AudioPeakHelper.getPeak()`
    // returns float 0..1. Until that class ships in gen/android, return a clear error.
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }
        .map_err(|e| format!("JavaVM::from_raw: {e}"))?;
    let mut env = vm
        .attach_current_thread()
        .map_err(|e| format!("attach_current_thread: {e}"))?;

    let class_name = "education/bluesync/student/AudioPeakHelper";
    let class = match env.find_class(class_name) {
        Ok(c) => c,
        Err(_) => {
            return Err(
                "System audio metering needs MediaProjection setup. Tap Allow when Android asks to capture playback, or ask IT if capture is blocked on this Chromebook.".into(),
            );
        }
    };

    let peak = env
        .call_static_method(class, "getPeak", "()F", &[])
        .map_err(|e| {
            format!(
                "Audio capture unavailable ({e}). Allow playback capture when prompted, then reopen BlueSync."
            )
        })?
        .f()
        .map_err(|e| format!("getPeak cast: {e}"))?;

    Ok(peak)
}
