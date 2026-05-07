"""
Pipeline render dọc 1080x1920 + hiệu ứng reup, tách từ tiktok_beta.py (moviepy).
"""

from __future__ import annotations

import random
from pathlib import Path

# Pillow 10+ gỡ Image.ANTIALIAS; moviepy 1.x vẫn dùng (tránh ghim pillow<10 — không có wheel Py3.12).
try:
    from PIL import Image as _PILImage

    if not hasattr(_PILImage, "ANTIALIAS"):
        _Resampling = getattr(_PILImage, "Resampling", _PILImage)
        _PILImage.ANTIALIAS = getattr(_Resampling, "LANCZOS", getattr(_PILImage, "LANCZOS", 1))
except ImportError:
    pass

from moviepy.editor import ColorClip, CompositeVideoClip, VideoFileClip, vfx

MAX_DURATION = 59
TARGET_W = 1080
TARGET_H = 1920
AUDIO_VOLUME = 0.8

OUTPUT_BITRATE = "2000k"
OUTPUT_CRF = "28"
OUTPUT_AUDIO_BITRATE = "96k"
OUTPUT_PRESET = "faster"
OUTPUT_THREADS = 2


def _random_string(length: int = 12) -> str:
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(random.choices(alphabet, k=length))


def _close_clip(clip) -> None:
    try:
        if clip:
            clip.close()
    except Exception:
        pass


def fit_to_vertical(clip):
    """Resize + crop về 1080x1920."""
    clip = clip.resize(height=TARGET_H)
    if clip.w < TARGET_W:
        clip = clip.resize(width=TARGET_W)
    clip = clip.crop(
        x_center=clip.w / 2,
        y_center=clip.h / 2,
        width=TARGET_W,
        height=TARGET_H,
    )
    return clip


import random
from moviepy.editor import *
from moviepy.video.fx import all as vfx
import numpy as np
from moviepy.editor import *
from moviepy.video.fx import all as vfx

def apply_reup_effects(clip):
    """Style edit: zoom, crop, color, speed, flip đều, line ngang, grain nhẹ."""

    # Zoom nhẹ
    clip = clip.fx(vfx.resize, 1.03)

    # Crop về đúng size
    clip = clip.crop(
        x_center=clip.w / 2,
        y_center=clip.h / 2,
        width=TARGET_W,
        height=TARGET_H,
    )

    # Chỉnh màu nhẹ
    clip = clip.fx(vfx.colorx, 1.08)

    # Zoom thêm
    clip = clip.fx(vfx.resize, 1.22)

    # Tăng speed nhẹ
    clip = clip.fx(vfx.speedx, 1.05)

    # Cứ mỗi 2.5 giây lật 1 lần
    segments = []
    current_t = 0
    flip_interval = 2.5
    flip = False

    while current_t < clip.duration:
        end_t = min(current_t + flip_interval, clip.duration)
        sub = clip.subclip(current_t, end_t)

        if flip:
            sub = sub.fx(vfx.mirror_x)

        segments.append(sub)

        flip = not flip
        current_t = end_t

    clip = concatenate_videoclips(segments)

    # Line ngang to hơn
    line_y = TARGET_H // 2

    line = (
        ColorClip(size=(TARGET_W, 20), color=(255, 255, 255))
        .set_opacity(0.85)
        .set_duration(clip.duration)
        .set_position(("center", line_y))
    )

    final_clip = CompositeVideoClip([clip, line], size=(TARGET_W, TARGET_H))
    final_clip = final_clip.set_duration(clip.duration)

    if clip.audio is not None:
        final_clip = final_clip.set_audio(clip.audio)

    return final_clip

def render_vertical_reup(video_path: str | Path, output_dir: str | Path) -> Path:
    """
    Đọc video đã tải, áp dụng fit dọc + hiệu ứng reup, ghi MP4 vào output_dir.
    Trả về đường dẫn file đã render.
    """
    video_path = Path(video_path).resolve()
    output_dir = Path(output_dir).expanduser().resolve()
    if not video_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file video: {video_path}")
    output_dir.mkdir(parents=True, exist_ok=True)

    raw_clip = None
    final_clip = None
    try:
        raw_clip = VideoFileClip(str(video_path), audio=True)
        duration = min(raw_clip.duration, MAX_DURATION)
        processed_clip = raw_clip.subclip(0, duration)
        processed_clip = fit_to_vertical(processed_clip)
        final_clip = apply_reup_effects(processed_clip)
        if final_clip.audio is not None:
            final_clip = final_clip.set_audio(final_clip.audio.volumex(AUDIO_VOLUME))

        output_name = f"{_random_string(14)}.mp4"
        output_path = output_dir / output_name

        final_clip.write_videofile(
            str(output_path),
            codec="libx264",
            fps=30,
            bitrate=OUTPUT_BITRATE,
            preset=OUTPUT_PRESET,
            audio=final_clip.audio is not None,
            audio_codec="aac",
            audio_bitrate=OUTPUT_AUDIO_BITRATE,
            ffmpeg_params=["-crf", OUTPUT_CRF],
            verbose=False,
            logger=None,
            threads=OUTPUT_THREADS,
        )
        return output_path.resolve()
    finally:
        _close_clip(raw_clip)
        _close_clip(final_clip)
