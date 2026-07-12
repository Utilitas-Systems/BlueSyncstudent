//! Foreground service hooks for classroom sessions on Android.
//!
//! Desktop apps can poll BT (90s) and audio (2s) indefinitely. Android kills background
//! WebViews unless a **foreground service** is running while the student is online.
//!
//! ## Contract (Kotlin, after `tauri android init`)
//! `education.bluesync.student.SessionMonitorService`:
//! - `start(Context)` → startForeground with notification
//!   “BlueSync is monitoring your classroom session”
//! - `stop(Context)` → stopSelf
//!
//! ponytail: Rust side is a thin JNI bridge; notification channel + FGS type must live
//! in Kotlin/AndroidManifest (FOREGROUND_SERVICE + FOREGROUND_SERVICE_SPECIAL_USE or
//! connectedDevice / mediaProjection as appropriate for the Play policy review).

use std::sync::atomic::{AtomicBool, Ordering};

static SESSION_ACTIVE: AtomicBool = AtomicBool::new(false);

fn with_context<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(jni::JNIEnv, jni::objects::JObject) -> Result<T, String>,
{
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }
        .map_err(|e| format!("JavaVM::from_raw: {e}"))?;
    let mut env = vm
        .attach_current_thread()
        .map_err(|e| format!("attach_current_thread: {e}"))?;
    let context = unsafe { jni::objects::JObject::from_raw(ctx.context() as jni::sys::jobject) };
    f(env, context)
}

fn call_service(method: &str) -> Result<(), String> {
    with_context(|mut env, context| {
        let class = match env.find_class("education/bluesync/student/SessionMonitorService") {
            Ok(c) => c,
            Err(_) => {
                // Scaffold before Kotlin lands — mark intent so presence still works.
                eprintln!(
                    "[android_foreground] SessionMonitorService missing; {method} no-op until gen/android Kotlin stub is added"
                );
                return Ok(());
            }
        };
        env.call_static_method(
            class,
            method,
            "(Landroid/content/Context;)V",
            &[(&context).into()],
        )
        .map_err(|e| format!("SessionMonitorService.{method}: {e}"))?;
        Ok(())
    })
}

/// Start persistent notification + FGS while student is online in class.
pub fn start_session_monitoring() -> Result<(), String> {
    call_service("start")?;
    SESSION_ACTIVE.store(true, Ordering::Relaxed);
    Ok(())
}

/// Stop FGS on logout / leave class / go offline.
pub fn stop_session_monitoring() -> Result<(), String> {
    call_service("stop")?;
    SESSION_ACTIVE.store(false, Ordering::Relaxed);
    Ok(())
}

pub fn is_session_monitoring() -> bool {
    SESSION_ACTIVE.load(Ordering::Relaxed)
}
