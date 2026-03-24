//! System **output** audio level on macOS via ScreenCaptureKit (macOS 13+).
//!
//! This is **not** the microphone. We subscribe only to `SCStreamOutputType::Audio` (desktop
//! / app / browser / video playback). Windows uses WASAPI **render** peak; Apple has no public
//! equivalent, so we attach system audio to a minimal display stream (low-res, 1 fps) and read
//! levels from those buffers.
//!
//! Users must allow **Screen Recording** for BlueSync (System Settings → Privacy & Security).

use screencapturekit::dispatch_queue::{DispatchQueue, DispatchQoS};
use screencapturekit::prelude::*;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

static METER: OnceLock<Arc<AtomicU32>> = OnceLock::new();
static METER_ERROR: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn meter_error_mutex() -> &'static Mutex<Option<String>> {
    METER_ERROR.get_or_init(|| Mutex::new(None))
}

pub fn clear_macos_meter_error() {
    *meter_error_mutex().lock().unwrap() = None;
}

pub fn set_macos_meter_error(message: String) {
    *meter_error_mutex().lock().unwrap() = Some(message);
}

pub fn macos_meter_error_snapshot() -> Option<String> {
    meter_error_mutex().lock().unwrap().clone()
}

/// Smoothed peak amplitude in 0.0..=1.0, roughly comparable to Windows `get_system_audio_peak`.
pub fn system_audio_peak() -> Result<f32, String> {
    let peak = METER.get_or_init(|| {
        let arc = Arc::new(AtomicU32::new(0));
        let for_thread = arc.clone();
        thread::spawn(move || {
            let _ = run_capture_thread(for_thread);
        });
        arc
    });

    let v = f32::from_bits(peak.load(Ordering::Relaxed));
    Ok(if v.is_finite() {
        v.clamp(0.0, 1.0)
    } else {
        0.0
    })
}

fn run_capture_thread(peak: Arc<AtomicU32>) -> Result<(), String> {
    clear_macos_meter_error();
    let result = capture_thread_main(peak);
    if let Err(ref e) = result {
        set_macos_meter_error(e.clone());
    }
    result
}

fn capture_thread_main(peak: Arc<AtomicU32>) -> Result<(), String> {
    let content = SCShareableContent::get().map_err(|e| {
        format!(
            "Screen/audio access failed ({e:?}). Enable Screen Recording for BlueSync in System Settings → Privacy & Security → Screen Recording."
        )
    })?;

    let displays = content.displays();
    let display = displays
        .first()
        .ok_or_else(|| "No displays found.".to_string())?;

    let filter = SCContentFilter::create()
        .with_display(display)
        .with_excluding_windows(&[])
        .build();

    let min_interval = CMTime::new(1, 1);
    let config = SCStreamConfiguration::new()
        .with_width(320)
        .with_height(240)
        .with_pixel_format(PixelFormat::BGRA)
        .with_shows_cursor(false)
        .with_minimum_frame_interval(&min_interval)
        .with_captures_audio(true)
        .with_sample_rate(48_000)
        .with_channel_count(2);

    let mut stream = SCStream::new(&filter, &config);

    let queue = DispatchQueue::new("com.bluesync.sck", DispatchQoS::UserInteractive);

    let screen_ok = stream
        .add_output_handler_with_queue(
            |_sample: CMSampleBuffer, _output_type: SCStreamOutputType| {},
            SCStreamOutputType::Screen,
            Some(&queue),
        )
        .is_some();

    let peak_audio = peak.clone();
    let audio_ok = stream
        .add_output_handler_with_queue(
            move |sample: CMSampleBuffer, _output_type: SCStreamOutputType| {
                update_peak_from_sample(&peak_audio, sample);
            },
            SCStreamOutputType::Audio,
            Some(&queue),
        )
        .is_some();

    if !screen_ok || !audio_ok {
        return Err(
            "ScreenCaptureKit refused output handlers (screen or system audio).".to_string(),
        );
    }

    stream
        .start_capture()
        .map_err(|e| format!("Could not start capture for audio metering ({e:?})."))?;

    loop {
        thread::sleep(Duration::from_secs(3600));
    }
}

fn update_peak_from_sample(peak_atomic: &AtomicU32, sample: CMSampleBuffer) {
    let Some(list) = sample.audio_buffer_list() else {
        return;
    };

    let fd = sample.format_description();
    let is_float = fd.as_ref().map(|f| f.audio_is_float()).unwrap_or(true);
    let bits = fd.as_ref().and_then(|f| f.audio_bits_per_channel()).unwrap_or(32);
    let big_endian = fd.as_ref().map(|f| f.audio_is_big_endian()).unwrap_or(false);

    let mut max_abs = 0.0f32;
    for buf in list.iter() {
        let d = buf.data();
        if is_float && bits == 32 {
            for chunk in d.chunks_exact(4) {
                let v = if big_endian {
                    f32::from_be_bytes([chunk[0], chunk[1], chunk[2], chunk[3]])
                } else {
                    f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]])
                };
                if v.is_finite() {
                    max_abs = max_abs.max(v.abs());
                }
            }
        } else if bits == 16 {
            let scale = 1.0 / (i16::MAX as f32);
            for chunk in d.chunks_exact(2) {
                let raw = if big_endian {
                    i16::from_be_bytes([chunk[0], chunk[1]])
                } else {
                    i16::from_le_bytes([chunk[0], chunk[1]])
                };
                max_abs = max_abs.max((raw as f32 * scale).abs());
            }
        }
    }

    let prev = f32::from_bits(peak_atomic.load(Ordering::Relaxed));
    let mut next = prev * 0.82 + max_abs * 0.18;
    if !next.is_finite() {
        next = 0.0;
    }
    next = next.clamp(0.0, 1.0);
    peak_atomic.store(next.to_bits(), Ordering::Relaxed);
}
