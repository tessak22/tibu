"""Generate Tibu voice clips from voice/LINES.json with Kokoro-82M.

Run through `npm run voice` (scripts/voice/generate.ts), which prepares the
virtualenv in scripts/voice/.venv from the pinned requirements.txt.

Only lines whose text, voice, model or encoding changed are regenerated. A hash
of those inputs is kept per clip in voice/<lang>/manifest.json.

Usage:
  python kokoro_generate.py --root <repo> [--lang en] [--force]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

MODEL_REPO = "hexgrad/Kokoro-82M"
# Pinned Hugging Face revision so regenerated clips stay consistent.
MODEL_REVISION = "f3ff3571791e39611d31c381e3a41a3af07b4987"
SAMPLE_RATE = 24000
BITRATE = 32000
CLIP_EXT = "m4a"
# Bump the suffix whenever synthesis input or encoding changes, so every clip regenerates.
ENCODING_ID = f"aac-mono-{BITRATE // 1000}k-v2"

# Single letters are ambiguous for TTS ("A" reads as "uh"), so give Kokoro the
# letter-name phonemes with misaki's inline override syntax.
LETTER_PHONEMES = {
    "A": "ˈA", "B": "bˈi", "C": "sˈi", "D": "dˈi", "E": "ˈi", "F": "ˈɛf",
    "G": "ʤˈi", "H": "ˈAʧ", "I": "ˈI", "J": "ʤˈA", "K": "kˈA", "L": "ˈɛl",
    "M": "ˈɛm", "N": "ˈɛn", "O": "ˈO", "P": "pˈi", "Q": "kjˈu", "R": "ˈɑɹ",
    "S": "ˈɛs", "T": "tˈi", "U": "jˈu", "V": "vˈi", "W": "dˈʌbəlju",
    "X": "ˈɛks", "Y": "wˈI", "Z": "zˈi",
}


def as_sentence(text: str) -> str:
    """Give Kokoro a complete sentence: capitalized, ending in punctuation.

    Bare words without final punctuation ("orange") come out with clipped final
    consonants ("oran-de"); "Orange." is pronounced fully. Only the synthesis
    input changes, never the text in LINES.json.
    """
    stripped = text.strip()
    if not stripped:
        return stripped
    if stripped[0].islower():
        stripped = stripped[0].upper() + stripped[1:]
    if stripped[-1] not in ".!?":
        stripped += "."
    return stripped


def tts_text(text: str, lang: str) -> str:
    """Spell out standalone capital letters ("A", "A B C", "high C") as letter names.

    A leading "A" followed by an ordinary word is an article ("A brand new world!")
    and is left alone.
    """
    if lang != "en":
        return text
    tokens = text.split()
    out = []
    for i, tok in enumerate(tokens):
        core = tok.rstrip("!.?,")
        tail = tok[len(core):]
        nxt = tokens[i + 1].rstrip("!.?,") if i + 1 < len(tokens) else ""
        is_article = core == "A" and len(nxt) > 1
        if len(core) == 1 and core in LETTER_PHONEMES and not is_article:
            out.append(f"[{core}](/{LETTER_PHONEMES[core]}/){tail}")
        else:
            out.append(tok)
    return " ".join(out)


def clip_hash(text: str, voice: str, speed: float) -> str:
    payload = json.dumps(
        {"text": text, "voice": voice, "speed": speed, "model": f"{MODEL_REPO}@{MODEL_REVISION}",
         "encoding": ENCODING_ID},
        sort_keys=True, ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def safe_line_id(line_id: str) -> bool:
    return re.fullmatch(r"[a-z0-9][a-z0-9._-]*", line_id) is not None


def trim_and_normalize(audio: np.ndarray) -> np.ndarray:
    """Trim leading/trailing silence, add short padding, soft fades, peak-normalize."""
    threshold = 0.01
    loud = np.where(np.abs(audio) > threshold)[0]
    if loud.size:
        start = max(0, loud[0] - int(0.02 * SAMPLE_RATE))
        end = min(audio.size, loud[-1] + int(0.08 * SAMPLE_RATE))
        audio = audio[start:end]
    fade = min(int(0.01 * SAMPLE_RATE), audio.size // 2)
    if fade > 0:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
        audio = audio.copy()
        audio[:fade] *= ramp
        audio[-fade:] *= ramp[::-1]
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 0:
        audio = audio * (0.89 / peak)
    pad = np.zeros(int(0.03 * SAMPLE_RATE), dtype=np.float32)
    return np.concatenate([pad, audio.astype(np.float32), pad])


def encode(wav_path: Path, out_path: Path) -> None:
    if shutil.which("ffmpeg"):
        cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav_path), "-ac", "1",
               "-c:a", "aac", "-b:a", str(BITRATE), "-movflags", "+faststart", str(out_path)]
    elif shutil.which("afconvert"):
        cmd = ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(BITRATE), "-c", "1",
               str(wav_path), str(out_path)]
    else:
        raise SystemExit("Need ffmpeg or afconvert (macOS) to encode clips.")
    subprocess.run(cmd, check=True)


def load_json(path: Path, default: dict) -> dict:
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict) -> None:
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)


def make_pipeline(lang_code: str):
    from huggingface_hub import hf_hub_download
    from kokoro import KModel, KPipeline

    config = hf_hub_download(MODEL_REPO, "config.json", revision=MODEL_REVISION)
    weights = hf_hub_download(MODEL_REPO, "kokoro-v1_0.pth", revision=MODEL_REVISION)
    model = KModel(repo_id=MODEL_REPO, config=config, model=weights).eval()
    return KPipeline(lang_code=lang_code, repo_id=MODEL_REPO, model=model)


def voice_path(voice: str) -> str:
    from huggingface_hub import hf_hub_download

    return hf_hub_download(MODEL_REPO, f"voices/{voice}.pt", revision=MODEL_REVISION)


def synthesize(pipeline, text: str, voice: str, speed: float) -> np.ndarray:
    chunks = [r.audio.numpy() for r in pipeline(text, voice=voice, speed=speed) if r.audio is not None]
    if not chunks:
        raise RuntimeError(f"Kokoro produced no audio for {text!r}")
    return trim_and_normalize(np.concatenate(chunks))


def generate_language(root: Path, lines_doc: dict, lang: str, force: bool) -> None:
    meta = lines_doc.get("languages", {}).get(lang)
    if not meta or "kokoro" not in meta:
        print(f"[voice] {lang}: no kokoro settings in LINES.json, skipping")
        return
    kcfg = meta["kokoro"]
    voice, speed, lang_code = kcfg["voice"], float(kcfg.get("speed", 1.0)), kcfg["langCode"]

    out_dir = root / "voice" / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "manifest.json"
    manifest = load_json(manifest_path, {"clips": {}})
    clips: dict = dict(manifest.get("clips", {}))

    wanted = {lid: entry[lang] for lid, entry in lines_doc["lines"].items()
              if isinstance(entry, dict) and isinstance(entry.get(lang), str) and entry[lang].strip()}
    todo = []
    for lid, text in sorted(wanted.items()):
        if not safe_line_id(lid):
            print(f"[voice] skipping unsafe line id {lid!r}")
            continue
        h = clip_hash(text, voice, speed)
        target = out_dir / f"{lid}.{CLIP_EXT}"
        if force or clips.get(lid, {}).get("hash") != h or not target.exists():
            todo.append((lid, text, h, target))

    # Remove clips we generated earlier for lines that no longer exist.
    for lid in [k for k in clips if k not in wanted]:
        (out_dir / clips[lid].get("file", f"{lid}.{CLIP_EXT}")).unlink(missing_ok=True)
        del clips[lid]

    print(f"[voice] {lang}: {len(wanted)} lines, {len(todo)} to generate (voice {voice})")
    if todo:
        pipeline = make_pipeline(lang_code)
        voice_file = voice_path(voice)
        with tempfile.TemporaryDirectory() as tmp:
            for i, (lid, text, h, target) in enumerate(todo, 1):
                audio = synthesize(pipeline, as_sentence(tts_text(text, lang)), voice_file, speed)
                wav = Path(tmp) / "clip.wav"
                sf.write(wav, audio, SAMPLE_RATE, subtype="PCM_16")
                encode(wav, target)
                clips[lid] = {"hash": h, "file": target.name, "text": text}
                print(f"[voice]   {i}/{len(todo)} {lid}: {text}")
                if i % 25 == 0:
                    write_json(manifest_path, {**manifest, "clips": clips})

    write_json(manifest_path, {
        "model": MODEL_REPO, "revision": MODEL_REVISION, "voice": voice, "speed": speed,
        "encoding": ENCODING_ID, "clips": clips,
    })


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="Repository root")
    parser.add_argument("--lang", action="append", help="Language code (repeatable); default all")
    parser.add_argument("--force", action="store_true", help="Regenerate every clip")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    lines_doc = load_json(root / "voice" / "LINES.json", {})
    if "lines" not in lines_doc:
        print("[voice] voice/LINES.json is missing or has no 'lines'", file=sys.stderr)
        return 1
    langs = args.lang or sorted(lines_doc.get("languages", {}).keys())
    for lang in langs:
        generate_language(root, lines_doc, lang, args.force)
    return 0


if __name__ == "__main__":
    sys.exit(main())
