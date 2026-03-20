"""Text-to-speech service supporting edge-tts (free) and ElevenLabs.

Generates voiceover audio files from text using configurable engines and voices.
"""

import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

VOICES: dict[str, str] = {
    "en_female": "en-US-AriaNeural",
    "en_male": "en-US-GuyNeural",
    "es_female": "es-MX-DaliaNeural",
    "es_male": "es-MX-JorgeNeural",
    "zh_female": "zh-CN-XiaoxiaoNeural",
    "zh_male": "zh-CN-YunxiNeural",
    "pt_female": "pt-BR-FranciscaNeural",
    "ja_female": "ja-JP-NanamiNeural",
    "ko_female": "ko-KR-SunHiNeural",
}


async def generate_voiceover(
    text: str,
    output_path: str,
    voice: str | None = None,
    engine: str | None = None,
) -> str:
    """Generate a voiceover audio file from text.

    Args:
        text: The text to convert to speech.
        output_path: Where to save the audio file.
        voice: Voice identifier (or key from VOICES dict). Defaults to settings.tts_voice.
        engine: TTS engine ("edge-tts" or "elevenlabs"). Defaults to settings.tts_engine.

    Returns:
        Path to the generated audio file.
    """
    engine = engine or settings.tts_engine
    voice = voice or settings.tts_voice

    # Resolve voice alias from VOICES dict
    if voice in VOICES:
        voice = VOICES[voice]

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    if engine == "elevenlabs":
        return await _generate_elevenlabs(text, output_path, voice)
    else:
        return await _generate_edge_tts(text, output_path, voice)


async def _generate_edge_tts(text: str, output_path: str, voice: str) -> str:
    """Generate audio using edge-tts (free Microsoft TTS)."""
    import edge_tts

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)

    logger.info("edge-tts generated voiceover -> %s (voice=%s)", output_path, voice)
    return output_path


async def _generate_elevenlabs(text: str, output_path: str, voice: str) -> str:
    """Generate audio using ElevenLabs API."""
    import httpx

    if not settings.elevenlabs_api_key:
        raise ValueError("ElevenLabs API key not configured (ELEVENLABS_API_KEY)")

    api_url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            api_url,
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json={
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                },
            },
        )
        resp.raise_for_status()

        Path(output_path).write_bytes(resp.content)

    logger.info("ElevenLabs generated voiceover -> %s (voice=%s)", output_path, voice)
    return output_path
