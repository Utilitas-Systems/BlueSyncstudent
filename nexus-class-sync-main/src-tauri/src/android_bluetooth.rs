//! Android Bluetooth enumeration via JNI → `BluetoothAdapter.getBondedDevices()`.
//!
//! ## Chromebook notes
//! - Many school Chromebooks expose fewer BT profiles than phones; bonded list may be
//!   sparse even when headphones work for media.
//! - Prefer graceful empty lists over errors so the teacher UI shows “no devices”
//!   instead of a hard failure.
//! - Runtime permissions (`BLUETOOTH_CONNECT` / `BLUETOOTH_SCAN` on API 31+) must be
//!   granted by the user or MDM policy — see MD/Student/Release/Chromebook/.
//!
//! ## JNI ceiling
//! ponytail: bonded-device snapshot only (no live ACL connection probe beyond
//! `BluetoothDevice.getBondState`). Upgrade path: `BluetoothProfile` proxies
//! (A2DP/HEADSET/GATT) after `tauri android init` + Kotlin helper.

use super::DetailedBluetoothDevice;

fn with_jni<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(jni::JNIEnv, jni::objects::JObject) -> Result<T, String>,
{
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }
        .map_err(|e| format!("JavaVM::from_raw: {e}"))?;
    let mut env = vm
        .attach_current_thread()
        .map_err(|e| format!("attach_current_thread: {e}"))?;
    // SAFETY: context is the Android Context jobject held by ndk-context for the process.
    let context = unsafe { jni::objects::JObject::from_raw(ctx.context() as jni::sys::jobject) };
    f(env, context)
}

fn bonded_devices_jni() -> Result<Vec<DetailedBluetoothDevice>, String> {
    with_jni(|mut env, context| {
        let bluetooth_service = env
            .new_string("bluetooth")
            .map_err(|e| format!("new_string bluetooth: {e}"))?;

        let system_service = env
            .call_method(
                &context,
                "getSystemService",
                "(Ljava/lang/String;)Ljava/lang/Object;",
                &[(&bluetooth_service).into()],
            )
            .map_err(|e| format!("getSystemService: {e}"))?
            .l()
            .map_err(|e| format!("getSystemService cast: {e}"))?;

        if system_service.is_null() {
            return Ok(Vec::new());
        }

        let adapter = env
            .call_method(&system_service, "getAdapter", "()Landroid/bluetooth/BluetoothAdapter;", &[])
            .map_err(|e| format!("getAdapter: {e}"))?
            .l()
            .map_err(|e| format!("getAdapter cast: {e}"))?;

        if adapter.is_null() {
            return Ok(Vec::new());
        }

        let enabled = env
            .call_method(&adapter, "isEnabled", "()Z", &[])
            .map_err(|e| format!("isEnabled: {e}"))?
            .z()
            .unwrap_or(false);
        if !enabled {
            return Ok(Vec::new());
        }

        let bonded = env
            .call_method(&adapter, "getBondedDevices", "()Ljava/util/Set;", &[])
            .map_err(|e| format!("getBondedDevices: {e}"))?
            .l()
            .map_err(|e| format!("getBondedDevices cast: {e}"))?;

        if bonded.is_null() {
            return Ok(Vec::new());
        }

        let arr = env
            .call_method(&bonded, "toArray", "()[Ljava/lang/Object;", &[])
            .map_err(|e| format!("toArray: {e}"))?
            .l()
            .map_err(|e| format!("toArray cast: {e}"))?;

        let arr_obj = jni::objects::JObjectArray::from(arr);
        let len = env
            .get_array_length(&arr_obj)
            .map_err(|e| format!("get_array_length: {e}"))?;

        let mut out = Vec::with_capacity(len as usize);
        for i in 0..len {
            let device = env
                .get_object_array_element(&arr_obj, i)
                .map_err(|e| format!("get_object_array_element: {e}"))?;
            if device.is_null() {
                continue;
            }

            let name = env
                .call_method(&device, "getName", "()Ljava/lang/String;", &[])
                .ok()
                .and_then(|v| v.l().ok())
                .and_then(|s| {
                    if s.is_null() {
                        None
                    } else {
                        env.get_string(&jni::objects::JString::from(s))
                            .ok()
                            .map(|js| js.to_string_lossy().into_owned())
                    }
                })
                .unwrap_or_default();

            let address = env
                .call_method(&device, "getAddress", "()Ljava/lang/String;", &[])
                .ok()
                .and_then(|v| v.l().ok())
                .and_then(|s| {
                    if s.is_null() {
                        None
                    } else {
                        env.get_string(&jni::objects::JString::from(s))
                            .ok()
                            .map(|js| js.to_string_lossy().into_owned())
                    }
                })
                .unwrap_or_default();

            let bond = env
                .call_method(&device, "getBondState", "()I", &[])
                .ok()
                .and_then(|v| v.i().ok())
                .unwrap_or(0);
            // BOND_BONDED = 12
            let connection_status = if bond == 12 {
                "connected".to_string()
            } else {
                "paired".to_string()
            };

            if name.is_empty() && address.is_empty() {
                continue;
            }

            out.push(DetailedBluetoothDevice {
                device_mac_address: address,
                device_name: if name.is_empty() {
                    "Bluetooth device".into()
                } else {
                    name
                },
                connection_status,
                signal_strength: None,
            });
        }

        Ok(out)
    })
}

/// Names of bonded devices (best-effort “connected” for teacher list).
pub fn connected_device_names() -> Result<Vec<String>, String> {
    match bonded_devices_jni() {
        Ok(devices) => {
            let mut names: Vec<String> = devices
                .iter()
                .filter(|d| d.connection_status == "connected")
                .map(|d| d.device_name.clone())
                .collect();
            if names.is_empty() {
                // Chromebook caveat: fall back to all bonded so the teacher still sees something.
                names = devices.into_iter().map(|d| d.device_name).collect();
            }
            names.sort();
            names.dedup();
            Ok(names)
        }
        Err(e) => {
            eprintln!("[android_bluetooth] bonded list failed: {e}");
            Ok(Vec::new())
        }
    }
}

pub fn connected_devices_detailed() -> Result<Vec<DetailedBluetoothDevice>, String> {
    match bonded_devices_jni() {
        Ok(devices) => Ok(devices),
        Err(e) => {
            eprintln!("[android_bluetooth] detailed list failed: {e}");
            Ok(Vec::new())
        }
    }
}
