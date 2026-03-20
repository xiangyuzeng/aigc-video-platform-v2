"""Speech-to-text service for subtitle generation.

Uses faster-whisper to transcribe audio into timed segments,
and can export to SRT format.
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def transcribe_segments(
    audio_path: str,
    language: str = "en",
    model_size: str = "base",
) -> list[dict]:
    """Transcribe an audio file into timed text segments.

    Args:
        audio_path: Path to an audio or video file.
        language: Language code (e.g. "en", "es", "zh").
        model_size: Whisper model size ("tiny", "base", "small", "medium", "large-v2").

    Returns:
        List of dicts with keys: start (float), end (float), text (str).
    """
    from faster_whisper import WhisperModel

    logger.info("Transcribing %s (lang=%s, model=%s)", audio_path, language, model_size)

    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    segments_iter, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        word_timestamps=False,
    )

    segments: list[dict] = []
    for seg in segments_iter:
        segments.append({
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": seg.text.strip(),
        })

    logger.info(
        "Transcribed %d segments (detected language: %s, probability: %.2f)",
        len(segments),
        info.language,
        info.language_probability,
    )
    return segments


def segments_to_srt(segments: list[dict], output_path: str) -> str:
    """Convert timed segments to an SRT subtitle file.

    Args:
        segments: List of dicts with "start", "end", "text" keys.
        output_path: Where to write the SRT file.

    Returns:
        Path to the SRT file.
    """
    lines: list[str] = []
    for i, seg in enumerate(segments, start=1):
        start_ts = _seconds_to_srt_time(seg["start"])
        end_ts = _seconds_to_srt_time(seg["end"])
        text = seg.get("text", "").strip()
        if not text:
            continue
        lines.append(str(i))
        lines.append(f"{start_ts} --> {end_ts}")
        lines.append(text)
        lines.append("")  # Blank line separator

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")

    logger.info("Wrote SRT file with %d entries -> %s", len(segments), output_path)
    return str(out)


def _seconds_to_srt_time(seconds: float) -> str:
    """Convert seconds to SRT timestamp format (HH:MM:SS,mmm)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
