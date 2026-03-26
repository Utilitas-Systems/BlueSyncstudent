#[cfg(target_os = "macos")]
mod macos_audio;
#[cfg(target_os = "macos")]
mod macos_bluetooth;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_current_bluetooth_devices,
            get_current_bluetooth_devices_detailed,
            get_bluetooth_devices,
            get_system_audio_peak,
            check_audio_playback,
            get_system_audio_peak_detailed
        ])
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(serde::Serialize)]
struct DetailedBluetoothDevice {
    device_mac_address: String,
    device_name: String,
    connection_status: String,
    signal_strength: Option<i32>,
}

#[tauri::command]
fn get_current_bluetooth_devices() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::core::HSTRING;
        use windows::Devices::Bluetooth::{
            BluetoothConnectionStatus, BluetoothDevice, BluetoothLEDevice,
        };
        use windows::Devices::Enumeration::{DeviceInformation, DeviceInformationCollection};
        use windows::Win32::Devices::Bluetooth::{
            BluetoothFindDeviceClose, BluetoothFindFirstDevice, BluetoothFindFirstRadio,
            BluetoothFindNextDevice, BluetoothFindNextRadio, BluetoothFindRadioClose,
            BLUETOOTH_DEVICE_INFO, BLUETOOTH_DEVICE_SEARCH_PARAMS, BLUETOOTH_FIND_RADIO_PARAMS,
        };
        use windows::Win32::Foundation::CloseHandle;

        // AQS: currently connected Bluetooth Classic or LE devices (paired or not)
        let sel_le = BluetoothLEDevice::GetDeviceSelector()
            .map_err(|e| format!("LE selector error: {e:?}"))?;
        let sel_classic = BluetoothDevice::GetDeviceSelector()
            .map_err(|e| format!("Classic selector error: {e:?}"))?;
        let selector = format!("({}) OR ({})", sel_le, sel_classic);

        let list: DeviceInformationCollection =
            DeviceInformation::FindAllAsyncAqsFilter(&HSTRING::from(selector))
                .map_err(|e| format!("FindAllAsync error: {e:?}"))?
                .get()
                .map_err(|e| format!("get error: {e:?}"))?;

        let mut names: Vec<String> = Vec::new();
        let size = list.Size().map_err(|e| format!("Size error: {e:?}"))?;
        for i in 0..size {
            let item = list.GetAt(i).map_err(|e| format!("GetAt error: {e:?}"))?;
            let id = item.Id().map_err(|e| format!("Id error: {e:?}"))?;
            let mut connected = false;
            let mut fallback_name: Option<String> = None;

            if let Ok(op) = BluetoothLEDevice::FromIdAsync(&id) {
                if let Ok(dev) = op.get() {
                    if let Ok(status) = dev.ConnectionStatus() {
                        connected = status == BluetoothConnectionStatus::Connected;
                    }
                    if let Ok(n) = dev.Name() {
                        let ns = n.to_string_lossy();
                        if !ns.is_empty() {
                            fallback_name = Some(ns);
                        }
                    }
                }
            }

            if !connected {
                if let Ok(op) = BluetoothDevice::FromIdAsync(&id) {
                    if let Ok(dev) = op.get() {
                        if let Ok(status) = dev.ConnectionStatus() {
                            connected = status == BluetoothConnectionStatus::Connected;
                        }
                        if fallback_name.is_none() {
                            if let Ok(n) = dev.Name() {
                                let ns = n.to_string_lossy();
                                if !ns.is_empty() {
                                    fallback_name = Some(ns);
                                }
                            }
                        }
                    }
                }
            }

            if connected {
                let item_name = item.Name().ok();
                let mut s = item_name.map(|n| n.to_string_lossy()).unwrap_or_default();
                if s.is_empty() {
                    if let Some(fb) = &fallback_name {
                        s = fb.clone();
                    }
                }
                if !s.is_empty() {
                    names.push(s);
                }
            }
        }

        // Fallback: enumerate each radio and return only fConnected devices (no remembered/paired-only)
        if names.is_empty() {
            unsafe {
                let mut rp = BLUETOOTH_FIND_RADIO_PARAMS::default();
                rp.dwSize = std::mem::size_of::<BLUETOOTH_FIND_RADIO_PARAMS>() as u32;
                let mut h_radio = std::mem::zeroed();
                if let Ok(h_find_radio) = BluetoothFindFirstRadio(&rp, &mut h_radio) {
                    if h_find_radio.0 != std::ptr::null_mut() {
                        loop {
                            let mut sp = BLUETOOTH_DEVICE_SEARCH_PARAMS::default();
                            sp.dwSize =
                                std::mem::size_of::<BLUETOOTH_DEVICE_SEARCH_PARAMS>() as u32;
                            sp.fIssueInquiry = false.into();
                            sp.fReturnAuthenticated = false.into();
                            sp.fReturnRemembered = false.into();
                            sp.fReturnConnected = true.into();
                            sp.fReturnUnknown = false.into();
                            sp.hRadio = h_radio;
                            sp.cTimeoutMultiplier = 2;

                            let mut info = BLUETOOTH_DEVICE_INFO::default();
                            info.dwSize = std::mem::size_of::<BLUETOOTH_DEVICE_INFO>() as u32;

                            if let Ok(h_find_dev) = BluetoothFindFirstDevice(&sp, &mut info) {
                                if h_find_dev.0 != std::ptr::null_mut() {
                                    loop {
                                        if info.fConnected.as_bool() {
                                            let raw = String::from_utf16_lossy(&info.szName);
                                            let name = raw.trim_matches(char::from(0)).to_string();
                                            if !name.is_empty() {
                                                names.push(name);
                                            }
                                        }
                                        if BluetoothFindNextDevice(h_find_dev, &mut info).is_err() {
                                            break;
                                        }
                                    }
                                    let _ = BluetoothFindDeviceClose(h_find_dev);
                                }
                            }

                            let _ = CloseHandle(h_radio);
                            if BluetoothFindNextRadio(h_find_radio, &mut h_radio).is_err() {
                                break;
                            }
                        }
                        let _ = BluetoothFindRadioClose(h_find_radio);
                    }
                }
            }
        }

        names.sort();
        names.dedup();
        return Ok(names);
    }

    #[cfg(target_os = "macos")]
    {
        return macos_bluetooth::connected_device_names();
    }

    #[allow(unreachable_code)]
    Err("Bluetooth query not supported on this OS".into())
}

#[tauri::command]
fn get_current_bluetooth_devices_detailed() -> Result<Vec<DetailedBluetoothDevice>, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Devices::Bluetooth::{
            BluetoothFindDeviceClose, BluetoothFindFirstDevice, BluetoothFindFirstRadio,
            BluetoothFindNextDevice, BluetoothFindNextRadio, BluetoothFindRadioClose,
            BLUETOOTH_DEVICE_INFO, BLUETOOTH_DEVICE_SEARCH_PARAMS, BLUETOOTH_FIND_RADIO_PARAMS,
        };
        use windows::Win32::Foundation::CloseHandle;

        fn mac_from_bytes(bytes: [u8; 6]) -> String {
            format!(
                "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
                bytes[5], bytes[4], bytes[3], bytes[2], bytes[1], bytes[0]
            )
        }

        let mut results: Vec<DetailedBluetoothDevice> = Vec::new();
        unsafe {
            let mut rp = BLUETOOTH_FIND_RADIO_PARAMS::default();
            rp.dwSize = std::mem::size_of::<BLUETOOTH_FIND_RADIO_PARAMS>() as u32;
            let mut h_radio = std::mem::zeroed();
            if let Ok(h_find_radio) = BluetoothFindFirstRadio(&rp, &mut h_radio) {
                if h_find_radio.0 != std::ptr::null_mut() {
                    loop {
                        let mut sp = BLUETOOTH_DEVICE_SEARCH_PARAMS::default();
                        sp.dwSize = std::mem::size_of::<BLUETOOTH_DEVICE_SEARCH_PARAMS>() as u32;
                        sp.fIssueInquiry = false.into();
                        sp.fReturnAuthenticated = false.into();
                        sp.fReturnRemembered = false.into();
                        sp.fReturnConnected = true.into();
                        sp.fReturnUnknown = false.into();
                        sp.hRadio = h_radio;
                        sp.cTimeoutMultiplier = 2;

                        let mut info = BLUETOOTH_DEVICE_INFO::default();
                        info.dwSize = std::mem::size_of::<BLUETOOTH_DEVICE_INFO>() as u32;

                        if let Ok(h_find_dev) = BluetoothFindFirstDevice(&sp, &mut info) {
                            if h_find_dev.0 != std::ptr::null_mut() {
                                loop {
                                    if info.fConnected.as_bool() {
                                        let raw = String::from_utf16_lossy(&info.szName);
                                        let name = raw.trim_matches(char::from(0)).to_string();
                                        let mac = mac_from_bytes(std::mem::transmute(
                                            info.Address.Anonymous.rgBytes,
                                        ));
                                        results.push(DetailedBluetoothDevice {
                                            device_mac_address: mac,
                                            device_name: name,
                                            connection_status: "connected".to_string(),
                                            signal_strength: None,
                                        });
                                    }
                                    if BluetoothFindNextDevice(h_find_dev, &mut info).is_err() {
                                        break;
                                    }
                                }
                                let _ = BluetoothFindDeviceClose(h_find_dev);
                            }
                        }

                        let _ = CloseHandle(h_radio);
                        if BluetoothFindNextRadio(h_find_radio, &mut h_radio).is_err() {
                            break;
                        }
                    }
                    let _ = BluetoothFindRadioClose(h_find_radio);
                }
            }
        }

        return Ok(results);
    }

    #[cfg(target_os = "macos")]
    {
        return macos_bluetooth::connected_devices_detailed();
    }

    #[allow(unreachable_code)]
    Err("Bluetooth query not supported on this OS".into())
}

// Keep the old function name for backward compatibility
#[tauri::command]
fn get_bluetooth_devices() -> Result<Vec<String>, String> {
    get_current_bluetooth_devices()
}

// Windows: WASAPI default render peak 0.0–1.0 (master volume/mute).
// macOS: ScreenCaptureKit system-audio buffers only (not microphone)—see `macos_audio`.
#[tauri::command]
fn get_system_audio_peak() -> Result<f32, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
        use windows::Win32::Media::Audio::{
            eConsole, eRender, EDataFlow, ERole, Endpoints::IAudioMeterInformation, IMMDevice,
            IMMDeviceEnumerator, MMDeviceEnumerator,
        };
        use windows::Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
        };

        // Initialize COM (ignore result if already initialized)
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        // Create enumerator
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                .map_err(|e| format!("CoCreateInstance: {e:?}"))?;

        // Default render device
        let device: IMMDevice = enumerator
            .GetDefaultAudioEndpoint(EDataFlow(eRender.0), ERole(eConsole.0))
            .map_err(|e| format!("GetDefaultAudioEndpoint: {e:?}"))?;

        // Activate IAudioMeterInformation and IAudioEndpointVolume
        let meter: IAudioMeterInformation = device
            .Activate::<IAudioMeterInformation>(CLSCTX_ALL, None)
            .map_err(|e| format!("Activate IAudioMeterInformation: {e:?}"))?;
        let endpoint_vol: IAudioEndpointVolume = device
            .Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
            .map_err(|e| format!("Activate IAudioEndpointVolume: {e:?}"))?;

        let peak = meter
            .GetPeakValue()
            .map_err(|e| format!("GetPeakValue: {e:?}"))?;
        let muted = endpoint_vol
            .GetMute()
            .map_err(|e| format!("GetMute: {e:?}"))?;
        let vol = endpoint_vol
            .GetMasterVolumeLevelScalar()
            .map_err(|e| format!("GetMasterVolumeLevelScalar: {e:?}"))?;

        if muted.as_bool() || vol <= 0.02 {
            // treat very low volume as silence
            return Ok(0.0);
        }

        let adjusted = (peak * vol).max(0.0).min(1.0);
        Ok(adjusted)
    }
    #[cfg(target_os = "macos")]
    {
        macos_audio::system_audio_peak()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(0.0)
    }
}

/// Boolean playback state used by teacher UI (`is_talking`).
#[tauri::command]
fn check_audio_playback() -> Result<bool, String> {
    let peak = get_system_audio_peak()?;
    // Keep threshold conservative so quiet playback still counts as active.
    Ok(peak >= 0.01)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemAudioPeakDetails {
    peak: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    macos_meter_error: Option<String>,
    is_macos: bool,
}

/// Peak plus macOS ScreenCaptureKit error (for in-app setup help). Non-mac: `is_macos` false, error none.
#[tauri::command]
fn get_system_audio_peak_detailed() -> SystemAudioPeakDetails {
    let peak = get_system_audio_peak().unwrap_or(0.0);
    #[cfg(target_os = "macos")]
    {
        SystemAudioPeakDetails {
            peak,
            macos_meter_error: macos_audio::macos_meter_error_snapshot(),
            is_macos: true,
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        SystemAudioPeakDetails {
            peak,
            macos_meter_error: None,
            is_macos: false,
        }
    }
}
