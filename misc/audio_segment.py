#!/usr/bin/env python3
"""
audio_segment.py

Two-pass audio segmentation for creating one-shot drum hits and FX samples.

Pass 1: Onset/transient detection — finds sharp energy increases (drum hits, percussive attacks)
Pass 2: Max-duration enforcement — subdivides long chunks at energy minima
Post:   Applies fade-in/fade-out to every chunk, trims trailing silence

# Fewer cuts — raise sensitivity (fewer onsets detected)
python3 audio_segment.py foo.wav -s 0.8 -o foo_chunks_sparse

# Even fewer, with larger min gap between hits
python3 audio_segment.py foo.wav -s 0.9 --min-gap 200 -o foo_chunks_minimal

# Shorter max duration for the long-chunk splitter
python3 audio_segment.py foo.wav --max-duration 1.0

# Custom prefix for your samples
python3 audio_segment.py foo.wav -p hit -o my_kit

Key flags:

  ┌────────────────────────┬────────────┬────────────────────────────────────┐
  │          Flag          │  Default   │               Effect               │
  ├────────────────────────┼────────────┼────────────────────────────────────┤
  │ -s / --sensitivity     │ 0.6        │ Higher = fewer onsets detected     │
  ├────────────────────────┼────────────┼────────────────────────────────────┤
  │ --min-gap              │ 50ms       │ Minimum time between detected hits │
  ├────────────────────────┼────────────┼────────────────────────────────────┤
  │ --max-duration         │ 2.0s       │ Force-split anything longer        │
  ├────────────────────────┼────────────┼────────────────────────────────────┤
  │ --min-duration         │ 30ms       │ Discard tiny fragments             │
  ├────────────────────────┼────────────┼────────────────────────────────────┤
  │ --fade-in / --fade-out │ 5ms / 10ms │ Pop-prevention fades               │
  ├────────────────────────┼────────────┼────────────────────────────────────┤
  │ --no-trim              │ off        │ Keep trailing silence              │
  └────────────────────────┴────────────┴────────────────────────────────────┘

"""

import argparse
import os
import sys
import wave
import struct
import numpy as np
from scipy.signal import find_peaks, medfilt
from scipy.ndimage import maximum_filter1d


def read_wav(path):
    """Read a wav file and return (samples as float64 mono array, sample_rate, n_channels, sampwidth, raw_frames)."""
    with wave.open(path, "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        sample_rate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    # Decode to numpy array
    if sampwidth == 2:
        dtype = np.int16
        max_val = 32768.0
    elif sampwidth == 3:
        # 24-bit: unpack manually
        n_samples = len(raw) // 3
        samples = np.zeros(n_samples, dtype=np.int32)
        for i in range(n_samples):
            b = raw[i * 3 : i * 3 + 3]
            val = struct.unpack("<i", b + (b"\xff" if b[2] & 0x80 else b"\x00"))[0]
            samples[i] = val
        dtype = None
        max_val = 8388608.0
        float_samples = samples.astype(np.float64) / max_val
        if n_channels > 1:
            float_samples = float_samples.reshape(-1, n_channels)
            mono = float_samples.mean(axis=1)
        else:
            mono = float_samples
        return mono, sample_rate, n_channels, sampwidth, raw
    elif sampwidth == 4:
        dtype = np.int32
        max_val = 2147483648.0
    else:
        raise ValueError(f"Unsupported sample width: {sampwidth}")

    samples = np.frombuffer(raw, dtype=dtype).astype(np.float64) / max_val
    if n_channels > 1:
        samples = samples.reshape(-1, n_channels)
        mono = samples.mean(axis=1)
    else:
        mono = samples
    return mono, sample_rate, n_channels, sampwidth, raw


def extract_raw_segment(raw, start_frame, end_frame, n_channels, sampwidth):
    """Extract raw bytes for a segment."""
    bytes_per_frame = n_channels * sampwidth
    return raw[start_frame * bytes_per_frame : end_frame * bytes_per_frame]


def apply_fade_raw(raw_segment, n_channels, sampwidth, sample_rate, fade_in_ms, fade_out_ms):
    """Apply fade-in and fade-out to raw audio bytes. Returns new raw bytes."""
    bytes_per_frame = n_channels * sampwidth
    n_frames = len(raw_segment) // bytes_per_frame

    if n_frames == 0:
        return raw_segment

    fade_in_frames = min(int(sample_rate * fade_in_ms / 1000), n_frames // 2)
    fade_out_frames = min(int(sample_rate * fade_out_ms / 1000), n_frames // 2)

    # Decode
    if sampwidth == 2:
        samples = np.frombuffer(raw_segment, dtype=np.int16).astype(np.float64).copy()
        max_val = 32768.0
    elif sampwidth == 3:
        n_total = len(raw_segment) // 3
        samples = np.zeros(n_total, dtype=np.float64)
        for i in range(n_total):
            b = raw_segment[i * 3 : i * 3 + 3]
            val = struct.unpack("<i", b + (b"\xff" if b[2] & 0x80 else b"\x00"))[0]
            samples[i] = float(val)
        max_val = 8388608.0
    elif sampwidth == 4:
        samples = np.frombuffer(raw_segment, dtype=np.int32).astype(np.float64).copy()
        max_val = 2147483648.0
    else:
        return raw_segment

    total_samples = len(samples)
    fade_in_samples = fade_in_frames * n_channels
    fade_out_samples = fade_out_frames * n_channels

    # Fade in
    if fade_in_samples > 0:
        env = np.linspace(0.0, 1.0, fade_in_frames)
        env_expanded = np.repeat(env, n_channels)
        samples[:fade_in_samples] *= env_expanded[:fade_in_samples]

    # Fade out
    if fade_out_samples > 0:
        env = np.linspace(1.0, 0.0, fade_out_frames)
        env_expanded = np.repeat(env, n_channels)
        samples[-fade_out_samples:] *= env_expanded[-fade_out_samples:]

    # Re-encode
    if sampwidth == 2:
        return np.clip(samples, -32768, 32767).astype(np.int16).tobytes()
    elif sampwidth == 3:
        out = bytearray()
        for s in samples:
            val = int(np.clip(s, -max_val, max_val - 1))
            packed = struct.pack("<i", val)
            out += packed[:3]
        return bytes(out)
    elif sampwidth == 4:
        return np.clip(samples, -2147483648, 2147483647).astype(np.int32).tobytes()


def compute_rms_envelope(mono, sample_rate, hop_ms=10):
    """Compute RMS energy envelope with given hop size."""
    hop = int(sample_rate * hop_ms / 1000)
    n_hops = len(mono) // hop
    envelope = np.zeros(n_hops)
    for i in range(n_hops):
        frame = mono[i * hop : i * hop + hop]
        envelope[i] = np.sqrt(np.mean(frame ** 2))
    return envelope, hop


def detect_onsets(envelope, sample_rate, hop, sensitivity=0.6, min_gap_ms=50):
    """
    Detect onsets using spectral-flux-like energy derivative.
    Returns onset positions in samples.
    """
    # Smooth the envelope to reduce noise
    kernel_size = max(3, int(0.01 * sample_rate / hop) | 1)  # ~10ms smoothing, ensure odd
    smoothed = medfilt(envelope, kernel_size=kernel_size)

    # Compute onset detection function: half-wave rectified first derivative
    diff = np.diff(smoothed)
    odf = np.maximum(diff, 0)

    # Adaptive threshold: local median + sensitivity * local max
    window = int(0.5 * sample_rate / hop)  # 500ms context window
    if window < 3:
        window = 3

    local_median = medfilt(odf, kernel_size=window if window % 2 == 1 else window + 1)
    local_max = maximum_filter1d(odf, size=window)

    threshold = local_median + sensitivity * (local_max - local_median)

    # Find peaks above threshold
    min_gap_hops = int(min_gap_ms / 1000 * sample_rate / hop)
    peaks, properties = find_peaks(odf, height=0, distance=max(1, min_gap_hops))

    # Filter by adaptive threshold
    onset_hops = []
    for p in peaks:
        if odf[p] > threshold[p] and odf[p] > np.percentile(odf, 20):
            onset_hops.append(p)

    # Convert to sample positions
    onsets = [h * hop for h in onset_hops]
    return onsets


def find_silence_trim_point(mono, end_frame, sample_rate, silence_threshold_db=-50, max_lookback_ms=200):
    """Find where trailing silence begins before end_frame, for tighter cuts."""
    threshold = 10 ** (silence_threshold_db / 20)
    lookback = int(sample_rate * max_lookback_ms / 1000)
    start = max(0, end_frame - lookback)
    segment = np.abs(mono[start:end_frame])

    # Walk backwards from end to find last sample above threshold
    above = np.where(segment > threshold)[0]
    if len(above) == 0:
        return start
    last_loud = start + above[-1]
    # Add a small tail (20ms) after last loud sample
    tail = int(sample_rate * 0.02)
    return min(last_loud + tail, end_frame)


def subdivide_at_energy_minima(mono, start, end, sample_rate, max_duration_s, hop_ms=10):
    """
    Subdivide a long segment at local energy minima.
    Returns list of (start, end) sample positions.
    """
    duration_s = (end - start) / sample_rate
    if duration_s <= max_duration_s:
        return [(start, end)]

    hop = int(sample_rate * hop_ms / 1000)
    segment = mono[start:end]
    n_hops = len(segment) // hop

    if n_hops < 3:
        return [(start, end)]

    # Compute local RMS
    env = np.zeros(n_hops)
    for i in range(n_hops):
        frame = segment[i * hop : i * hop + hop]
        env[i] = np.sqrt(np.mean(frame ** 2))

    # Smooth
    kernel = max(3, int(0.03 * sample_rate / hop) | 1)
    env_smooth = medfilt(env, kernel_size=kernel)

    # Determine how many cuts we need
    n_cuts = int(np.ceil(duration_s / max_duration_s)) - 1
    ideal_chunk_hops = n_hops / (n_cuts + 1)

    cuts = []
    for c in range(1, n_cuts + 1):
        # Search around the ideal cut point for a local minimum
        ideal_pos = int(c * ideal_chunk_hops)
        search_radius = int(ideal_chunk_hops * 0.3)  # search within 30% of chunk size
        lo = max(0, ideal_pos - search_radius)
        hi = min(n_hops - 1, ideal_pos + search_radius)
        region = env_smooth[lo:hi + 1]
        if len(region) > 0:
            min_idx = lo + np.argmin(region)
            cuts.append(start + min_idx * hop)

    # Build segments
    cuts = sorted(set(cuts))
    segments = []
    prev = start
    for cut in cuts:
        if cut > prev and cut < end:
            segments.append((prev, cut))
            prev = cut
    segments.append((prev, end))
    return segments


def find_zero_crossing_near(mono, target, search_radius=256):
    """Find the nearest zero crossing to target sample position."""
    lo = max(0, target - search_radius)
    hi = min(len(mono) - 1, target + search_radius)
    region = mono[lo:hi]
    if len(region) < 2:
        return target

    # Find zero crossings
    signs = np.sign(region)
    crossings = np.where(np.diff(signs) != 0)[0]
    if len(crossings) == 0:
        return target

    # Find closest to target
    closest = crossings[np.argmin(np.abs(crossings - (target - lo)))]
    return lo + closest


def segment_audio(
    input_path,
    output_dir,
    prefix="chunk",
    sensitivity=0.6,
    min_gap_ms=50,
    max_duration_s=2.0,
    min_duration_ms=30,
    fade_in_ms=5,
    fade_out_ms=10,
    silence_threshold_db=-50,
    trim_silence=True,
):
    """Main segmentation pipeline."""
    print(f"Reading {input_path}...")
    mono, sample_rate, n_channels, sampwidth, raw = read_wav(input_path)
    total_samples = len(mono)
    total_duration = total_samples / sample_rate
    print(f"  {total_duration:.1f}s, {sample_rate}Hz, {n_channels}ch, {sampwidth * 8}-bit")

    # --- Pass 1: Onset detection ---
    print(f"\nPass 1: Detecting onsets (sensitivity={sensitivity}, min_gap={min_gap_ms}ms)...")
    envelope, hop = compute_rms_envelope(mono, sample_rate)
    onsets = detect_onsets(envelope, sample_rate, hop, sensitivity=sensitivity, min_gap_ms=min_gap_ms)

    # Always include sample 0 as the first onset
    if not onsets or onsets[0] != 0:
        onsets.insert(0, 0)

    # Snap onsets to nearest zero crossing to avoid clicks
    onsets = [find_zero_crossing_near(mono, o) for o in onsets]
    # Remove duplicates and sort
    onsets = sorted(set(onsets))

    print(f"  Found {len(onsets) - 1} transient onsets")

    # Build initial segments from onsets
    raw_segments = []
    for i in range(len(onsets)):
        seg_start = onsets[i]
        seg_end = onsets[i + 1] if i + 1 < len(onsets) else total_samples
        raw_segments.append((seg_start, seg_end))

    print(f"  {len(raw_segments)} initial segments")

    # --- Pass 2: Max-duration enforcement ---
    print(f"\nPass 2: Enforcing max duration ({max_duration_s}s)...")
    final_segments = []
    split_count = 0
    for seg_start, seg_end in raw_segments:
        duration = (seg_end - seg_start) / sample_rate
        if duration > max_duration_s:
            subs = subdivide_at_energy_minima(mono, seg_start, seg_end, sample_rate, max_duration_s)
            # Snap subdivision points to zero crossings
            snapped = []
            for s, e in subs:
                s2 = find_zero_crossing_near(mono, s) if s > 0 else s
                e2 = find_zero_crossing_near(mono, e) if e < total_samples else e
                if e2 > s2:
                    snapped.append((s2, e2))
            final_segments.extend(snapped)
            split_count += len(snapped) - 1
        else:
            final_segments.append((seg_start, seg_end))

    print(f"  Subdivided {split_count} long segments")

    # --- Filter and trim ---
    min_samples = int(sample_rate * min_duration_ms / 1000)
    trimmed_segments = []
    for seg_start, seg_end in final_segments:
        if trim_silence:
            seg_end = find_silence_trim_point(mono, seg_end, sample_rate, silence_threshold_db)
        if seg_end - seg_start >= min_samples:
            trimmed_segments.append((seg_start, seg_end))

    print(f"\n  {len(trimmed_segments)} final segments (after removing < {min_duration_ms}ms)")

    # --- Export ---
    os.makedirs(output_dir, exist_ok=True)
    digits = len(str(len(trimmed_segments)))

    print(f"\nExporting to {output_dir}/")
    for i, (seg_start, seg_end) in enumerate(trimmed_segments):
        filename = f"{prefix}_{str(i + 1).zfill(digits)}.wav"
        filepath = os.path.join(output_dir, filename)

        raw_segment = extract_raw_segment(raw, seg_start, seg_end, n_channels, sampwidth)
        raw_segment = apply_fade_raw(raw_segment, n_channels, sampwidth, sample_rate, fade_in_ms, fade_out_ms)

        with wave.open(filepath, "wb") as wf:
            wf.setnchannels(n_channels)
            wf.setsampwidth(sampwidth)
            wf.setframerate(sample_rate)
            wf.writeframes(raw_segment)

        duration_s = (seg_end - seg_start) / sample_rate
        print(f"  {filename}  {duration_s:.3f}s  ({seg_start / sample_rate:.2f}s - {seg_end / sample_rate:.2f}s)")

    print(f"\nDone! {len(trimmed_segments)} chunks exported to {output_dir}/")
    return trimmed_segments


def main():
    parser = argparse.ArgumentParser(
        description="audio_segment — two-pass audio segmentation for one-shot samples",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s foo.wav
  %(prog)s foo.wav -o my_hits -p kick --sensitivity 0.4
  %(prog)s foo.wav --max-duration 1.0 --fade-in 3 --fade-out 15
        """,
    )
    parser.add_argument("input", help="Input .wav file")
    parser.add_argument("-o", "--output-dir", default=None, help="Output directory (default: <input>_chunks)")
    parser.add_argument("-p", "--prefix", default="chunk", help="Output filename prefix (default: chunk)")
    parser.add_argument(
        "-s", "--sensitivity", type=float, default=0.6,
        help="Onset detection sensitivity 0.0-1.0, lower = more onsets (default: 0.6)"
    )
    parser.add_argument(
        "--min-gap", type=float, default=50,
        help="Minimum gap between onsets in ms (default: 50)"
    )
    parser.add_argument(
        "--max-duration", type=float, default=2.0,
        help="Max chunk duration in seconds before forced split (default: 2.0)"
    )
    parser.add_argument(
        "--min-duration", type=float, default=30,
        help="Discard chunks shorter than this in ms (default: 30)"
    )
    parser.add_argument("--fade-in", type=float, default=5, help="Fade-in duration in ms (default: 5)")
    parser.add_argument("--fade-out", type=float, default=10, help="Fade-out duration in ms (default: 10)")
    parser.add_argument(
        "--silence-threshold", type=float, default=-50,
        help="Silence threshold in dB for tail trimming (default: -50)"
    )
    parser.add_argument("--no-trim", action="store_true", help="Don't trim trailing silence")

    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: {args.input} not found", file=sys.stderr)
        sys.exit(1)

    output_dir = args.output_dir or os.path.splitext(args.input)[0] + "_chunks"

    segment_audio(
        input_path=args.input,
        output_dir=output_dir,
        prefix=args.prefix,
        sensitivity=args.sensitivity,
        min_gap_ms=args.min_gap,
        max_duration_s=args.max_duration,
        min_duration_ms=args.min_duration,
        fade_in_ms=args.fade_in,
        fade_out_ms=args.fade_out,
        silence_threshold_db=args.silence_threshold,
        trim_silence=not args.no_trim,
    )


if __name__ == "__main__":
    main()
