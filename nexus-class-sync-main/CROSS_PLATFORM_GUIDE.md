# Cross-Platform Guide: Converting Monere to Mac, Android, and iPhone

## Overview
This guide covers converting your Tauri application to work on macOS, Android, and iOS platforms.

## Current Status
- ✅ **Windows**: Fully supported with WinRT/Win32 Bluetooth APIs
- ⚠️ **macOS**: Needs Core Bluetooth implementation
- ⚠️ **Android**: Needs Android Bluetooth API implementation
- ⚠️ **iOS**: Needs Core Bluetooth implementation

## Step 1: Update Tauri Configuration

### 1.1 Update `tauri.conf.json`
Add platform-specific configurations:

```json
{
  "app": {
    "macOSPrivateApi": true,
    "windows": [...],
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.13",
      "exceptionDomain": "",
      "signingIdentity": null
    }
  },
  "bundle": {
    "targets": ["all"],
    "identifier": "com.monere.studentportal",
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.13"
    },
    "android": {
      "package": "com.monere.studentportal",
      "targetSdkVersion": 33,
      "minSdkVersion": 21
    },
    "ios": {
      "bundleVersion": "1.0.0",
      "developmentTeam": "YOUR_TEAM_ID"
    }
  }
}
```

## Step 2: Platform-Specific Bluetooth Implementation

### 2.1 macOS - Core Bluetooth

Add to `Cargo.toml`:
```toml
[target.'cfg(target_os = "macos")'.dependencies]
core-bluetooth = "0.1"
objc = "0.2"
```

Update `src-tauri/src/main.rs`:
```rust
#[cfg(target_os = "macos")]
async fn get_bluetooth_devices_macos() -> Result<Vec<BluetoothDevice>, String> {
    use core_bluetooth::*;
    // Implement Core Bluetooth scanning
    // This requires Objective-C bindings
    Ok(Vec::new())
}
```

### 2.2 Android - Android Bluetooth API

Add to `Cargo.toml`:
```toml
[target.'cfg(target_os = "android")'.dependencies]
jni = "0.21"
```

You'll need to:
1. Create Android native module using JNI
2. Use Android BluetoothAdapter API
3. Request Bluetooth permissions in AndroidManifest.xml

### 2.3 iOS - Core Bluetooth

Similar to macOS, but requires:
1. iOS-specific permissions in Info.plist
2. Core Bluetooth framework
3. Objective-C/Swift bridge

## Step 3: Update Rust Code for Cross-Platform

### 3.1 Conditional Compilation

```rust
#[tauri::command]
async fn get_current_bluetooth_devices() -> Result<Vec<BluetoothDevice>, String> {
    #[cfg(target_os = "windows")]
    {
        // Windows implementation (already done)
        get_bluetooth_devices_windows().await
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS implementation
        get_bluetooth_devices_macos().await
    }
    
    #[cfg(target_os = "android")]
    {
        // Android implementation
        get_bluetooth_devices_android().await
    }
    
    #[cfg(target_os = "ios")]
    {
        // iOS implementation
        get_bluetooth_devices_ios().await
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "android", target_os = "ios")))]
    {
        Ok(Vec::new())
    }
}
```

## Step 4: Platform-Specific Permissions

### 4.1 macOS - Info.plist
Add to `src-tauri/Info.plist`:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Monere needs Bluetooth access to detect connected devices</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Monere needs Bluetooth access to detect connected devices</string>
```

### 4.2 Android - AndroidManifest.xml
Add permissions:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

### 4.3 iOS - Info.plist
Add to `src-tauri/Info.plist`:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Monere needs Bluetooth access to detect connected devices</string>
```

## Step 5: Alternative Approach - Use Cross-Platform Bluetooth Crate

Consider using a cross-platform Bluetooth crate instead:

### Option A: `bluest` (Recommended for BLE)
```toml
[dependencies]
bluest = "0.1"
```

### Option B: `btleplug` (BLE only, no Classic)
```toml
[dependencies]
btleplug = "0.9"
```

### Option C: Platform-specific implementations
Keep current approach but add macOS/Android/iOS implementations.

## Step 6: Build Commands

### macOS
```bash
npm run tauri build -- --target x86_64-apple-darwin
# or for Apple Silicon
npm run tauri build -- --target aarch64-apple-darwin
```

### Android
```bash
npm run tauri android build
npm run tauri android run
```

### iOS
```bash
npm run tauri ios build
npm run tauri ios run
```

## Step 7: Testing Strategy

1. **Windows**: Test with current implementation ✅
2. **macOS**: Test on Mac with Core Bluetooth
3. **Android**: Test on Android device/emulator
4. **iOS**: Test on iOS simulator/device

## Step 8: Recommended Implementation Order

1. **macOS first** - Similar to Windows, desktop platform
2. **Android second** - More complex but well-documented
3. **iOS last** - Requires Apple Developer account for testing

## Step 9: Dependencies to Add

Update `Cargo.toml`:
```toml
[dependencies]
# Windows (already have)
windows = { version = "0.58", features = [...], optional = true }
windows-sys = { version = "0.52", features = [...], optional = true }

# macOS/iOS
core-bluetooth = { version = "0.1", optional = true }

# Android
jni = { version = "0.21", optional = true }

[features]
default = []
windows = ["windows", "windows-sys"]
macos = ["core-bluetooth"]
ios = ["core-bluetooth"]
android = ["jni"]
```

## Step 10: Frontend Updates

The frontend code should already work, but you may want to add platform detection:

```typescript
const getPlatform = () => {
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    // Tauri environment
    return 'tauri';
  }
  return 'web';
};
```

## Important Notes

1. **Bluetooth APIs differ significantly** between platforms
2. **Permissions** must be requested at runtime on mobile
3. **Testing** requires physical devices for Bluetooth
4. **App Store requirements** differ for each platform
5. **Code signing** required for iOS and macOS distribution

## Next Steps

1. Start with macOS implementation (easiest desktop platform)
2. Test thoroughly on each platform
3. Handle platform-specific edge cases
4. Update documentation for each platform

## Resources

- [Tauri Mobile Guide](https://v2.tauri.app/develop/mobile/)
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Core Bluetooth Documentation](https://developer.apple.com/documentation/corebluetooth)
- [Android Bluetooth Guide](https://developer.android.com/guide/topics/connectivity/bluetooth)






