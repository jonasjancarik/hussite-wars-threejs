#!/usr/bin/env python3
"""Offline sample-based arrangement. Requires NumPy and FFmpeg, never at runtime.

python3 scripts/audio/render-choral.py --samples /tmp/choral-samples --fetch
See audio/README.md for the score, provenance and reproduction instructions.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import quote
from urllib.request import urlopen

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SCORE = json.loads(Path(__file__).with_name("choral-score.json").read_text())
RATE = 44100


def midi(note):
    import re
    match = re.fullmatch(r"([A-G])(b|#)?([0-8])", note)
    if not match:
        raise ValueError(f"Invalid note: {note}")
    name, accidental, octave = match.groups()
    return (int(octave) + 1) * 12 + {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[name] + {None: 0, "b": -1, "#": 1}[accidental]


def load_samples(directory, fetch):
    instruments = {}
    for instrument, entries in SCORE["samples"]["instruments"].items():
        instruments[instrument] = []
        for root_note, relative, checksum in entries:
            local = directory / Path(relative).name
            if not local.exists() and fetch:
                url = f'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/{SCORE["samples"]["revision"]}/{quote(relative)}'
                with urlopen(url, timeout=30) as response:
                    data = response.read()
                if hashlib.sha256(data).hexdigest() != checksum:
                    raise ValueError(f"Sample checksum mismatch: {relative}")
                local.parent.mkdir(parents=True, exist_ok=True)
                local.write_bytes(data)
            data = local.read_bytes()
            if hashlib.sha256(data).hexdigest() != checksum:
                raise ValueError(f"Sample checksum mismatch: {relative}")
            decoded = subprocess.check_output([
                "ffmpeg", "-v", "error", "-i", str(local), "-f", "f32le",
                "-ar", str(RATE), "-ac", "1", "pipe:1"
            ])
            signal = np.frombuffer(decoded, dtype="<f4").copy()
            # Keep the recorded breath/bow attack; trim only leading near-silence.
            blocks = signal[:len(signal) // 256 * 256].reshape(-1, 256)
            energy = np.sqrt(np.mean(blocks ** 2, axis=1))
            onset = max(0, int(np.flatnonzero(energy > energy.max() * .035)[0]) * 256 - 1024)
            signal = signal[onset:]
            body = signal[int(.2 * RATE):int(1.5 * RATE)]
            signal *= .12 / max(.0001, float(np.sqrt(np.mean(body ** 2))))
            instruments[instrument].append((root_note, signal))
    return instruments


def extend_sustain(signal, length):
    """Only long held notes need a loop; crossfade the recorded stable body."""
    if len(signal) >= length:
        return signal[:length].copy()
    body = signal[int(.8 * RATE):int(2.4 * RATE)]
    fade = min(int(.16 * RATE), len(body) // 4)
    result = signal[:int(2.4 * RATE)].copy()
    ramp = np.linspace(0, 1, fade)
    while len(result) < length:
        result[-fade:] = result[-fade:] * (1 - ramp) + body[:fade] * ramp
        result = np.concatenate((result, body[fade:]))
    return result[:length]


def render(instruments):
    rng = np.random.default_rng(SCORE["seed"])
    beat = 60 / SCORE["tempo"]
    # A little breath at each phrase boundary, and a held final cadence.
    boundaries = [12, 23, 35, 44, 62]

    def seconds(position):
        breath = sum(.32 for boundary in boundaries[:-1] if position >= boundary)
        cadence = max(0, position - 58) * .12
        return .45 + position * beat + breath + cadence

    duration = seconds(62) + 3.8
    mix = np.zeros((math.ceil(duration * RATE), 2), dtype=np.float32)

    def add(instrument, pitch, start, sustain, gain, pan=0):
        root_note, sample = min(instruments[instrument], key=lambda entry: abs(entry[0] - pitch))
        # Timing/dynamics vary subtly, without altering the familiar melody.
        ratio = 2 ** ((pitch - root_note + rng.normal(0, .018)) / 12)
        positions = np.arange(0, len(sample) - 1, ratio)
        signal = np.interp(positions, np.arange(len(sample)), sample).astype(np.float32)
        release = .8 if instrument == "cello" else .18
        if instrument == "harp":
            release = 1.2
            length = min(len(signal), int((sustain + release) * RATE))
            signal = signal[:length].copy()
        else:
            length = int((sustain + release) * RATE)
            signal = extend_sustain(signal, length)
        attack = int((.38 if instrument == "cello" else .035 if instrument == "harp" else .065) * RATE)
        signal[:attack] *= np.linspace(0, 1, attack) ** .75
        tail = min(len(signal), int(release * RATE))
        signal[-tail:] *= np.cos(np.linspace(0, np.pi / 2, tail)) ** 2
        if instrument != "harp":
            signal *= 1 + .055 * np.sin(np.linspace(0, np.pi, len(signal)))
        signal *= gain * rng.uniform(.94, 1.06)
        offset = max(0, round((start + rng.uniform(-.009, .009)) * RATE))
        count = min(len(signal), len(mix) - offset)
        angle = (pan + 1) * np.pi / 4
        mix[offset:offset + count, 0] += signal[:count] * np.cos(angle)
        mix[offset:offset + count, 1] += signal[:count] * np.sin(angle)

    position = 0
    for phrase_index, phrase in enumerate(SCORE["phrases"]):
        for index, (note, beats) in enumerate(phrase):
            start = seconds(position)
            last = index == len(phrase) - 1
            length = seconds(position + beats) - start - (.15 if last else .065)
            # The melody stays in front. Bassoon joins as a quiet octave, not a synth choir.
            add("flute", midi(note), start, length, .82 if phrase_index < 2 else .92, -.15)
            if phrase_index != 3:
                add("bassoon", midi(note) - 12, start + .025, length - .04, .18 if phrase_index < 2 else .24, .20)
            position += beats

    for start_beat, beats, root, fifth in SCORE["harmony"]:
        start = max(0, seconds(start_beat) - .16)
        length = seconds(start_beat + beats) - start
        add("cello", midi(root) - 12, start, length, .24, .16)
        add("cello", midi(fifth) - 12, start + .08, length - .08, .10, -.25)
        # Sparse open fifths leave room for the modal melody; no busy ostinato.
        for step in range(0, beats, 2):
            pitch = midi(root if step % 4 == 0 else fifth)
            add("harp", pitch, seconds(start_beat + step) + .06, 1.4, .18 if step == 0 else .12, -.32)

    # Deterministic small-room convolution, with dark diffuse tails instead of slap echoes.
    impulse_length = int(RATE * 1.9)
    time = np.arange(impulse_length) / RATE
    fft_length = 1 << (len(mix) + impulse_length - 1).bit_length()
    mono = mix.mean(axis=1)
    spectrum = np.fft.rfft(mono, fft_length)
    for channel in range(2):
        noise = rng.standard_normal(impulse_length)
        noise = np.convolve(noise, np.ones(12) / 12, "same")
        impulse = noise * np.exp(-time * 4.6)
        impulse[:int(.035 * RATE)] = 0
        impulse /= max(.001, np.sqrt(np.sum(impulse ** 2)))
        wet = np.fft.irfft(spectrum * np.fft.rfft(impulse, fft_length), fft_length)[:len(mix)]
        mix[:, channel] += wet.astype(np.float32) * .14
    # Baked envelopes work on mobile too, even where element.volume is not adjustable.
    fade_in = int(.6 * RATE)
    fade_out = int(3.0 * RATE)
    mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 2
    if not np.isfinite(mix).all():
        raise ValueError("Non-finite audio samples")
    mix *= .75 / max(.001, float(np.max(np.abs(mix))))
    return mix


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", required=True, type=Path, help="Cache of the 16 CC0 WAV samples (outside the repository)")
    parser.add_argument("--fetch", action="store_true", help="Download missing, pinned samples (about 35 MB)")
    parser.add_argument("--output", type=Path, default=ROOT / "audio/ktoz-jsu-bozi-bojovnici-u-ohne.mp3")
    args = parser.parse_args()
    samples = load_samples(args.samples, args.fetch)
    mix = render(samples)
    # Render to a temporary file first; a failed encoder never damages a prior mix.
    with tempfile.TemporaryDirectory(prefix="choral-render-") as directory:
        target = Path(directory) / "choral.mp3"
        subprocess.run([
            "ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(RATE), "-ac", "2", "-i", "pipe:0",
            "-af", "highpass=f=55,lowpass=f=6800,loudnorm=I=-21:TP=-2:LRA=9,afade=t=in:d=0.08,afade=t=out:st=" + str(len(mix) / RATE - .15) + ":d=0.15",
            "-ar", str(RATE), "-c:a", "libmp3lame", "-q:a", "2", "-id3v2_version", "3",
            "-metadata", f'title={SCORE["title"]}',
            "-metadata", "artist=Husitské války — instrumental game arrangement",
            "-metadata", "comment=Traditional melody; VSCO 2 CE samples (CC0), Versilian Studios / Sam Gossner and Ivy Audio / Simon Dalzell. See audio/README.md.",
            str(target)
        ], input=mix.astype("<f4").tobytes(), check=True)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(target.read_bytes())
    print(f"Rendered {len(mix) / RATE:.2f} s, {args.output.stat().st_size / 1024:.0f} KiB: {args.output}")


if __name__ == "__main__":
    main()
