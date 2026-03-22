//! Connected Bluetooth devices on macOS via `system_profiler` (same source as System Settings).
//!
//! ## Why not Core Bluetooth / `bluest` here?
//! - **BLE only**: `CBCentralManager` / Core Bluetooth see **Bluetooth Low Energy** peripherals, not
//!   many classic devices (some keyboards, audio, etc.).
//! - **Threading**: Core Bluetooth expects a stable runloop/queue; calling from arbitrary Tauri
//!   worker threads with `block_on` has caused crashes in the wild.
//! - **API shape**: `retrieveConnectedPeripherals(withServices:)` needs service UUIDs; there is no
//!   supported “list every connected device” BLE API.
//!
//! `system_profiler SPBluetoothDataType -json` aggregates the Bluetooth stack’s view of
//! **connected** devices (paired + active). It does not require app sandbox Bluetooth entitlement
//! for read-only enumeration in typical Developer-ID / DMG builds.

use serde_json::Value;

/// Run `/usr/sbin/system_profiler SPBluetoothDataType -json` and return stdout UTF-8.
pub fn system_profiler_bluetooth_json() -> Result<String, String> {
    let out = std::process::Command::new("/usr/sbin/system_profiler")
        .args(["SPBluetoothDataType", "-json"])
        .output()
        .map_err(|e| format!("Could not run system_profiler: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "system_profiler exited with status {}",
            out.status
        ));
    }
    String::from_utf8(out.stdout).map_err(|e| format!("Invalid UTF-8 from system_profiler: {e}"))
}

fn truthy_connected(v: &Value) -> bool {
    match v {
        Value::Bool(b) => *b,
        Value::String(s) => {
            let t = s.to_lowercase();
            t.contains("yes") || t == "attrib_yes" || t == "on" || t == "true"
        }
        Value::Number(n) => n.as_i64().is_some_and(|i| i != 0),
        _ => false,
    }
}

/// Heuristic: avoid matching empty wrapper objects; still allow entries that only expose name + connected.
fn looks_like_device_record(obj: &serde_json::Map<String, Value>) -> bool {
    obj.contains_key("device_address")
        || obj.contains_key("device_minorType")
        || obj.contains_key("device_vendorID")
        || obj.contains_key("device_productID")
        || obj.contains_key("device_firmwareVersion")
        || obj.contains_key("device_batteryLevelMain")
        || obj.contains_key("device_name")
}

/// Best-effort display name: prefer explicit `device_name`, else the parent map key.
fn device_display_name(key: &str, obj: &serde_json::Map<String, Value>) -> Option<String> {
    if let Some(Value::String(n)) = obj.get("device_name") {
        let n = n.trim();
        if !n.is_empty() {
            return Some(n.to_string());
        }
    }
    let key = key.trim();
    if key.starts_with('_')
        || key == "controller"
        || key == "local_device_title"
        || key.contains("Bluetooth USB Host Controller")
    {
        return None;
    }
    if !key.is_empty() {
        return Some(key.to_string());
    }
    None
}

/// Recursively find connected devices in Apple’s JSON (structure varies by macOS version).
fn walk(value: &Value, out: &mut Vec<(String, String)>) {
    match value {
        Value::Object(map) => {
            for (key, child) in map {
                if let Value::Object(dev) = child {
                    let has_conn = dev
                        .get("device_isconnected")
                        .or_else(|| dev.get("device_connected"))
                        .or_else(|| dev.get("connected"))
                        .is_some();
                    if has_conn {
                        let connected = dev
                            .get("device_isconnected")
                            .or_else(|| dev.get("device_connected"))
                            .or_else(|| dev.get("connected"))
                            .map(truthy_connected)
                            .unwrap_or(false);
                        if connected && looks_like_device_record(dev) {
                            if let Some(name) = device_display_name(key, dev) {
                                let addr = dev
                                    .get("device_address")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                out.push((name, addr));
                            }
                        }
                    }
                    walk(child, out);
                } else {
                    walk(child, out);
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                walk(item, out);
            }
        }
        _ => {}
    }
}

pub fn connected_device_names() -> Result<Vec<String>, String> {
    let json_str = system_profiler_bluetooth_json()?;
    let root: Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
    let mut pairs: Vec<(String, String)> = Vec::new();
    walk(&root, &mut pairs);

    let mut names: Vec<String> = pairs.into_iter().map(|(n, _)| n).collect();
    names.sort();
    names.dedup();
    Ok(names)
}

pub fn connected_devices_detailed() -> Result<Vec<super::DetailedBluetoothDevice>, String> {
    let json_str = system_profiler_bluetooth_json()?;
    let root: Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
    let mut pairs: Vec<(String, String)> = Vec::new();
    walk(&root, &mut pairs);

    let mut results: Vec<super::DetailedBluetoothDevice> = Vec::new();
    for (device_name, device_mac_address) in pairs {
        let device_mac_address = if device_mac_address.is_empty() {
            "unknown".to_string()
        } else {
            device_mac_address
        };
        results.push(super::DetailedBluetoothDevice {
            device_mac_address,
            device_name,
            connection_status: "connected".to_string(),
            signal_strength: None,
        });
    }
    results.sort_by(|a, b| a.device_name.cmp(&b.device_name));
    results.dedup_by(|a, b| a.device_name == b.device_name && a.device_mac_address == b.device_mac_address);
    Ok(results)
}
