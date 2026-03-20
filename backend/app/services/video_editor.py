"""MoviePy-based video editor for slideshow creation and text overlays.

All MoviePy operations are synchronous. Callers should wrap calls in
asyncio.loop.run_in_executor() for async usage.
"""

import logging
import random
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class VideoEditor:
    """Create and edit videos using MoviePy."""

    def __init__(self):
        self.width: int = settings.video_resolution_w
        self.height: int = settings.video_resolution_h
        self.fps: int = settings.video_fps
        self.output_dir: Path = Path(settings.output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def create_slideshow(
        self,
        image_paths: list[str],
        audio_path: str | None = None,
        duration_per_image: float = 3.0,
        output_name: str = "slideshow.mp4",
        transition: str = "crossfade",
    ) -> str:
        """Create a slideshow video from images with Ken Burns effect.

        Args:
            image_paths: List of image file paths.
            audio_path: Optional audio file to use as soundtrack.
            duration_per_image: Duration each image is shown (seconds).
            output_name: Output filename.
            transition: Transition type ("crossfade" or "cut").

        Returns:
            Path to the output video file.
        """
        from moviepy import (
            AudioFileClip,
            CompositeVideoClip,
            ImageClip,
            concatenate_videoclips,
        )

        if not image_paths:
            raise ValueError("No image paths provided for slideshow")

        clips = []
        transition_duration = 0.5 if transition == "crossfade" else 0.0

        for img_path in image_paths:
            clip = (
                ImageClip(img_path)
                .with_duration(duration_per_image)
                .resized(height=self.height)
            )

            # Center crop to target dimensions
            if clip.w > self.width:
                clip = clip.crop(
                    x_center=clip.w / 2,
                    width=self.width,
                )

            # Ken Burns effect: slow random zoom
            zoom_start = 1.0
            zoom_end = random.uniform(1.05, 1.15)

            def _make_zoom(clip_inner, z_start, z_end):
                def zoom_fn(get_frame, t):
                    progress = t / clip_inner.duration if clip_inner.duration > 0 else 0
                    scale = z_start + (z_end - z_start) * progress
                    frame = get_frame(t)
                    from PIL import Image
                    import numpy as np

                    img = Image.fromarray(frame)
                    w, h = img.size
                    new_w, new_h = int(w * scale), int(h * scale)
                    img = img.resize((new_w, new_h), Image.LANCZOS)
                    # Center crop back
                    left = (new_w - w) // 2
                    top = (new_h - h) // 2
                    img = img.crop((left, top, left + w, top + h))
                    return np.array(img)
                return clip_inner.fl(zoom_fn)

            clip = _make_zoom(clip, zoom_start, zoom_end)

            if transition == "crossfade" and clips:
                clip = clip.crossfadein(transition_duration)

            clips.append(clip)

        if transition == "crossfade" and len(clips) > 1:
            video = CompositeVideoClip(
                [
                    clip.with_start(i * (duration_per_image - transition_duration))
                    for i, clip in enumerate(clips)
                ]
            )
        else:
            video = concatenate_videoclips(clips, method="compose")

        # Sync with audio duration if provided
        if audio_path and Path(audio_path).exists():
            audio = AudioFileClip(audio_path)
            # Extend or trim video to match audio
            if video.duration < audio.duration:
                video = video.loop(duration=audio.duration)
            else:
                video = video.subclip(0, audio.duration)
            video = video.with_audio(audio)

        output_path = self.output_dir / output_name
        output_path.parent.mkdir(parents=True, exist_ok=True)

        video.write_videofile(
            str(output_path),
            fps=self.fps,
            codec="libx264",
            audio_codec="aac",
            logger=None,
        )

        # Clean up
        video.close()
        for clip in clips:
            clip.close()

        logger.info("Created slideshow -> %s", output_path)
        return str(output_path)

    def add_text_overlay(
        self,
        video_path: str,
        text: str,
        position: str = "bottom",
        font_size: int = 40,
        font_color: str = "white",
        bg_color: str = "black",
        bg_opacity: float = 0.6,
        output_name: str | None = None,
    ) -> str:
        """Add a text overlay to a video.

        Args:
            video_path: Path to the input video.
            text: Text to overlay.
            position: Position ("top", "center", "bottom").
            font_size: Font size in pixels.
            font_color: Text color.
            bg_color: Background color behind text.
            bg_opacity: Background opacity (0-1).
            output_name: Output filename (auto-generated if None).

        Returns:
            Path to the output video file.
        """
        from moviepy import (
            ColorClip,
            CompositeVideoClip,
            TextClip,
            VideoFileClip,
        )

        video = VideoFileClip(video_path)

        txt_clip = TextClip(
            text=text,
            font_size=font_size,
            color=font_color,
            method="caption",
            size=(int(video.w * 0.9), None),
        ).with_duration(video.duration)

        # Create semi-transparent background
        bg_clip = ColorClip(
            size=(video.w, txt_clip.h + 20),
            color=self._hex_to_rgb(bg_color),
        ).with_opacity(bg_opacity).with_duration(video.duration)

        # Position
        pos_map = {
            "top": ("center", 40),
            "center": ("center", "center"),
            "bottom": ("center", video.h - txt_clip.h - 60),
        }
        txt_pos = pos_map.get(position, pos_map["bottom"])
        bg_pos = (0, txt_pos[1] - 10 if isinstance(txt_pos[1], int) else "center")

        txt_clip = txt_clip.with_position(txt_pos)
        bg_clip = bg_clip.with_position(bg_pos)

        final = CompositeVideoClip([video, bg_clip, txt_clip])

        if output_name is None:
            p = Path(video_path)
            output_name = f"{p.stem}_overlay{p.suffix}"

        output_path = self.output_dir / output_name
        output_path.parent.mkdir(parents=True, exist_ok=True)

        final.write_videofile(
            str(output_path),
            fps=self.fps,
            codec="libx264",
            audio_codec="aac",
            logger=None,
        )

        final.close()
        video.close()

        logger.info("Added text overlay -> %s", output_path)
        return str(output_path)

    def add_subtitles(
        self,
        video_path: str,
        segments: list[dict],
        font_size: int = 36,
        font_color: str = "white",
        stroke_color: str = "black",
        stroke_width: int = 2,
        position: str = "bottom",
        output_name: str | None = None,
    ) -> str:
        """Add word-level subtitles to a video.

        Args:
            video_path: Path to the input video.
            segments: List of dicts with "start", "end", "text" keys.
            font_size: Font size in pixels.
            font_color: Text color.
            stroke_color: Text outline color.
            stroke_width: Text outline width.
            position: Vertical position ("top", "center", "bottom").
            output_name: Output filename (auto-generated if None).

        Returns:
            Path to the output video file.
        """
        from moviepy import CompositeVideoClip, TextClip, VideoFileClip

        video = VideoFileClip(video_path)

        subtitle_clips = []
        y_pos = {
            "top": 60,
            "center": int(video.h / 2),
            "bottom": int(video.h * 0.85),
        }.get(position, int(video.h * 0.85))

        for seg in segments:
            start = float(seg.get("start", 0))
            end = float(seg.get("end", start + 1))
            text = seg.get("text", "").strip()
            if not text:
                continue

            txt = TextClip(
                text=text,
                font_size=font_size,
                color=font_color,
                stroke_color=stroke_color,
                stroke_width=stroke_width,
                method="caption",
                size=(int(video.w * 0.85), None),
            )
            txt = (
                txt.with_start(start)
                .with_end(end)
                .with_position(("center", y_pos))
            )
            subtitle_clips.append(txt)

        if not subtitle_clips:
            logger.info("No subtitle segments; returning original video")
            video.close()
            return video_path

        final = CompositeVideoClip([video] + subtitle_clips)

        if output_name is None:
            p = Path(video_path)
            output_name = f"{p.stem}_subtitled{p.suffix}"

        output_path = self.output_dir / output_name
        output_path.parent.mkdir(parents=True, exist_ok=True)

        final.write_videofile(
            str(output_path),
            fps=self.fps,
            codec="libx264",
            audio_codec="aac",
            logger=None,
        )

        final.close()
        video.close()
        for clip in subtitle_clips:
            clip.close()

        logger.info("Added subtitles (%d segments) -> %s", len(segments), output_path)
        return str(output_path)

    @staticmethod
    def _hex_to_rgb(color: str) -> tuple[int, int, int]:
        """Convert a color name or hex to RGB tuple."""
        color_map = {
            "black": (0, 0, 0),
            "white": (255, 255, 255),
            "red": (255, 0, 0),
            "green": (0, 255, 0),
            "blue": (0, 0, 255),
            "yellow": (255, 255, 0),
        }
        if color.lower() in color_map:
            return color_map[color.lower()]
        color = color.lstrip("#")
        if len(color) == 6:
            return (
                int(color[0:2], 16),
                int(color[2:4], 16),
                int(color[4:6], 16),
            )
        return (0, 0, 0)
