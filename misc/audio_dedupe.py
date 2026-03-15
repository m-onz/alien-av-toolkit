#!/usr/bin/env python3
"""
audio_dedupe.py

Analyzes a folder of audio chunks, extracts audio features, clusters similar sounds,
and exports a curated set of unique/representative samples.

Features extracted per chunk:
  - RMS energy (loudness)
  - Spectral centroid (brightness)
  - Spectral bandwidth (tonal spread)
  - Spectral rolloff (high-frequency content)
  - Zero-crossing rate (noisiness/percussiveness)
  - Duration
  - Spectral flatness (noise vs tone)
  - Crest factor (transient peakiness)
  - MFCCs (timbral fingerprint, 13 coefficients)

Clustering: Agglomerative (scipy) with a tunable distance threshold.
Selection: Picks the chunk closest to each cluster centroid (most representative).
"""

import argparse
import os
import sys
import wave
import struct
import shutil
import numpy as np
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import pdist, cdist
from scipy.fft import rfft, rfftfreq
from scipy.signal import get_window


def read_wav_mono(path):
    """Read wav file, return (mono float64 array, sample_rate)."""
    with wave.open(path, "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        sample_rate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if sampwidth == 2:
        samples = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    elif sampwidth == 3:
        n_samples = len(raw) // 3
        samples = np.zeros(n_samples, dtype=np.float64)
        for i in range(n_samples):
            b = raw[i * 3 : i * 3 + 3]
            val = struct.unpack("<i", b + (b"\xff" if b[2] & 0x80 else b"\x00"))[0]
            samples[i] = val / 8388608.0
    elif sampwidth == 4:
        samples = np.frombuffer(raw, dtype=np.int32).astype(np.float64) / 2147483648.0
    else:
        raise ValueError(f"Unsupported sample width: {sampwidth}")

    if n_channels > 1:
        samples = samples.reshape(-1, n_channels).mean(axis=1)

    return samples, sample_rate


def compute_mel_filterbank(n_fft, sample_rate, n_mels=26):
    """Build a mel-scale filterbank matrix."""
    def hz_to_mel(hz):
        return 2595 * np.log10(1 + hz / 700)

    def mel_to_hz(mel):
        return 700 * (10 ** (mel / 2595) - 1)

    n_freqs = n_fft // 2 + 1
    mel_low = hz_to_mel(0)
    mel_high = hz_to_mel(sample_rate / 2)
    mel_points = np.linspace(mel_low, mel_high, n_mels + 2)
    hz_points = mel_to_hz(mel_points)
    bin_points = np.floor((n_fft + 1) * hz_points / sample_rate).astype(int)

    filterbank = np.zeros((n_mels, n_freqs))
    for m in range(1, n_mels + 1):
        f_left = bin_points[m - 1]
        f_center = bin_points[m]
        f_right = bin_points[m + 1]

        for k in range(f_left, f_center):
            if f_center != f_left:
                filterbank[m - 1, k] = (k - f_left) / (f_center - f_left)
        for k in range(f_center, f_right):
            if f_right != f_center:
                filterbank[m - 1, k] = (f_right - k) / (f_right - f_center)

    return filterbank


def compute_mfccs(mono, sample_rate, n_mfcc=13, n_fft=2048, hop=512, n_mels=26):
    """Compute mean MFCCs across the signal."""
    # Pad if shorter than one FFT window
    if len(mono) < n_fft:
        mono = np.pad(mono, (0, n_fft - len(mono)))

    window = get_window("hann", n_fft)
    filterbank = compute_mel_filterbank(n_fft, sample_rate, n_mels)

    n_frames = max(1, (len(mono) - n_fft) // hop + 1)
    mfcc_frames = []

    for i in range(n_frames):
        frame = mono[i * hop : i * hop + n_fft]
        if len(frame) < n_fft:
            frame = np.pad(frame, (0, n_fft - len(frame)))
        windowed = frame * window
        spectrum = np.abs(rfft(windowed)) ** 2

        # Apply mel filterbank
        mel_spectrum = filterbank @ spectrum
        mel_spectrum = np.maximum(mel_spectrum, 1e-10)
        log_mel = np.log(mel_spectrum)

        # DCT to get MFCCs
        from scipy.fft import dct
        mfcc = dct(log_mel, type=2, norm="ortho")[:n_mfcc]
        mfcc_frames.append(mfcc)

    # Return mean MFCCs across all frames
    return np.mean(mfcc_frames, axis=0)


def extract_features(path):
    """Extract audio features from a single wav file."""
    mono, sr = read_wav_mono(path)

    if len(mono) == 0:
        return None

    duration = len(mono) / sr

    # RMS energy
    rms = np.sqrt(np.mean(mono ** 2))

    # Peak amplitude and crest factor
    peak = np.max(np.abs(mono))
    crest = peak / rms if rms > 1e-10 else 0

    # Zero-crossing rate
    zcr = np.sum(np.abs(np.diff(np.sign(mono)))) / (2 * len(mono))

    # Spectral features from FFT
    n_fft = min(2048, len(mono))
    if len(mono) < n_fft:
        padded = np.pad(mono, (0, n_fft - len(mono)))
    else:
        padded = mono[:n_fft]

    windowed = padded * get_window("hann", n_fft)
    magnitude = np.abs(rfft(windowed))
    freqs = rfftfreq(n_fft, 1.0 / sr)

    mag_sum = np.sum(magnitude)
    if mag_sum < 1e-10:
        centroid = 0
        bandwidth = 0
        rolloff = 0
        flatness = 0
    else:
        # Spectral centroid
        centroid = np.sum(freqs * magnitude) / mag_sum

        # Spectral bandwidth
        bandwidth = np.sqrt(np.sum(((freqs - centroid) ** 2) * magnitude) / mag_sum)

        # Spectral rolloff (85% energy)
        cumulative = np.cumsum(magnitude)
        rolloff_idx = np.searchsorted(cumulative, 0.85 * cumulative[-1])
        rolloff = freqs[min(rolloff_idx, len(freqs) - 1)]

        # Spectral flatness (geometric mean / arithmetic mean of power spectrum)
        power = magnitude ** 2
        power = np.maximum(power, 1e-10)
        geo_mean = np.exp(np.mean(np.log(power)))
        arith_mean = np.mean(power)
        flatness = geo_mean / arith_mean if arith_mean > 1e-10 else 0

    # MFCCs
    mfccs = compute_mfccs(mono, sr)

    features = [duration, rms, crest, zcr, centroid, bandwidth, rolloff, flatness]
    features.extend(mfccs.tolist())
    return np.array(features)


def main():
    parser = argparse.ArgumentParser(
        description="audio_dedupe — cluster audio chunks and extract unique sounds",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s foo_chunks/
  %(prog)s foo_chunks/ -o unique_hits --threshold 0.8
  %(prog)s foo_chunks/ --threshold 0.5 --pick loudest
        """,
    )
    parser.add_argument("input_dir", help="Directory of .wav chunks to analyze")
    parser.add_argument("-o", "--output-dir", default=None, help="Output directory (default: <input_dir>_unique)")
    parser.add_argument(
        "-t", "--threshold", type=float, default=1.0,
        help="Clustering distance threshold. Lower = more clusters = more unique sounds kept (default: 1.0)"
    )
    parser.add_argument(
        "--pick", choices=["centroid", "loudest", "longest"], default="centroid",
        help="How to pick the representative from each cluster (default: centroid)"
    )
    parser.add_argument(
        "--min-cluster", type=int, default=1,
        help="Only keep clusters with at least this many members (default: 1)"
    )
    parser.add_argument(
        "--max-output", type=int, default=0,
        help="Limit output to N sounds, picking from largest clusters first (default: 0 = no limit)"
    )

    args = parser.parse_args()

    if not os.path.isdir(args.input_dir):
        print(f"Error: {args.input_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    output_dir = args.output_dir or args.input_dir.rstrip("/") + "_unique"

    # Find all wav files
    wav_files = sorted([
        f for f in os.listdir(args.input_dir)
        if f.lower().endswith(".wav")
    ])

    if not wav_files:
        print("No .wav files found in input directory", file=sys.stderr)
        sys.exit(1)

    print(f"Analyzing {len(wav_files)} chunks from {args.input_dir}/...")

    # Extract features
    features = []
    valid_files = []
    for i, fname in enumerate(wav_files):
        path = os.path.join(args.input_dir, fname)
        feat = extract_features(path)
        if feat is not None:
            features.append(feat)
            valid_files.append(fname)
        if (i + 1) % 100 == 0 or i == len(wav_files) - 1:
            print(f"  Extracted features: {i + 1}/{len(wav_files)}", end="\r")

    print()

    if len(valid_files) < 2:
        print("Need at least 2 valid files to cluster", file=sys.stderr)
        sys.exit(1)

    feature_matrix = np.array(features)
    n_features = feature_matrix.shape[1]
    print(f"  {len(valid_files)} valid files, {n_features} features each")

    # Normalize features to zero mean, unit variance
    means = feature_matrix.mean(axis=0)
    stds = feature_matrix.std(axis=0)
    stds[stds < 1e-10] = 1.0
    normalized = (feature_matrix - means) / stds

    # Cluster
    print(f"\nClustering (threshold={args.threshold})...")
    distances = pdist(normalized, metric="euclidean")
    Z = linkage(distances, method="ward")
    labels = fcluster(Z, t=args.threshold, criterion="distance")

    n_clusters = len(set(labels))
    print(f"  {n_clusters} clusters found")

    # Analyze clusters
    cluster_map = {}
    for idx, label in enumerate(labels):
        if label not in cluster_map:
            cluster_map[label] = []
        cluster_map[label].append(idx)

    # Sort clusters by size (largest first)
    sorted_clusters = sorted(cluster_map.items(), key=lambda x: len(x[1]), reverse=True)

    # Print cluster distribution
    sizes = [len(members) for _, members in sorted_clusters]
    print(f"  Cluster sizes: min={min(sizes)}, max={max(sizes)}, median={int(np.median(sizes))}")
    print(f"  Singletons: {sizes.count(1)}")

    # Select representatives
    print(f"\nSelecting representatives (method: {args.pick})...")
    selected = []

    for label, members in sorted_clusters:
        if len(members) < args.min_cluster:
            continue

        if args.pick == "centroid":
            # Pick the chunk closest to the cluster centroid in feature space
            cluster_features = normalized[members]
            centroid = cluster_features.mean(axis=0).reshape(1, -1)
            dists = cdist(centroid, cluster_features, metric="euclidean")[0]
            best = members[np.argmin(dists)]
        elif args.pick == "loudest":
            # Pick the chunk with highest RMS (feature index 1)
            rms_values = feature_matrix[members, 1]
            best = members[np.argmax(rms_values)]
        elif args.pick == "longest":
            # Pick the longest chunk (feature index 0)
            durations = feature_matrix[members, 0]
            best = members[np.argmax(durations)]

        selected.append((best, label, len(members)))

    # Apply max output limit
    if args.max_output > 0 and len(selected) > args.max_output:
        # Already sorted by cluster size, so we keep the most common/representative
        selected = selected[:args.max_output]

    print(f"  {len(selected)} unique sounds selected")

    # Export
    os.makedirs(output_dir, exist_ok=True)
    digits = len(str(len(selected)))

    print(f"\nExporting to {output_dir}/")
    for i, (file_idx, label, cluster_size) in enumerate(selected):
        src = os.path.join(args.input_dir, valid_files[file_idx])
        duration = feature_matrix[file_idx, 0]
        dst_name = f"unique_{str(i + 1).zfill(digits)}.wav"
        dst = os.path.join(output_dir, dst_name)
        shutil.copy2(src, dst)
        print(f"  {dst_name}  {duration:.3f}s  (cluster {label}, {cluster_size} similar)")

    # Summary stats
    total_duration = sum(feature_matrix[idx, 0] for idx, _, _ in selected)
    print(f"\nDone! {len(selected)} unique sounds ({total_duration:.1f}s total) exported to {output_dir}/")
    print(f"  Reduction: {len(valid_files)} -> {len(selected)} ({100 * (1 - len(selected) / len(valid_files)):.0f}% deduplication)")


if __name__ == "__main__":
    main()
