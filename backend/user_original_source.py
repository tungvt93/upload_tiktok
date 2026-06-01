<USER_REQUEST>
import subprocess
import os
import random
import shutil
import sys
from glob import glob
from pathlib import Path

# Force UTF-8 for console output to handle special characters in filenames
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Constants from render_temp.py
MAX_DURATION = 59
TARGET_W = 1080
TARGET_H = 1920
AUDIO_VOLUME = 0.8

OUTPUT_BITRATE = "2000k"
OUTPUT_CRF = "28"
OUTPUT_AUDIO_BITRATE = "128k"
OUTPUT_PRESET = "faster"
OUTPUT_THREADS = 4

def _ffmpeg_binary() -> str:
    p = shutil.which("ffmpeg")
    if p:
        return p
    return "ffmpeg"

def _ffmpeg_encoder_available(encoder: str) -> bool:
    binary = _ffmpeg_binary()
    try:
        r = subprocess.run(
            [binary, "-hide_banner", "-h", f"encoder={encoder}"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return r.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False

def _resolve_video_codec() -> str:
    """Select the best available encoder, prioritizing hardware acceleration."""
    # Priority: NVIDIA -> Intel -> AMD -> Software
    for enc in ["h264_nvenc", "h264_qsv", "h264_amf"]:
        if _ffmpeg_encoder_available(enc):
            print(f"[render_pipeline] Using HW encoder: {enc}")
            return enc
    print("[render_pipeline] No HW encoder found, falling back to libx264")
    return "libx264"

def _get_duration(path: str | Path) -> float:
    binary = shutil.which("ffprobe") or "ffprobe"
    try:
        r = subprocess.run(
            [binary, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=5
        )
        return float(r.stdout.strip())
    except Exception:
        return 0.0

def _has_audio(path: str | Path)
<truncated 6069 bytes>

            try:
                subprocess.run(clean_cmd, check=True)
            except Exception as e2:
                raise RuntimeError(f"FFmpeg failed even with libx264 fallback: {e2}")
        else:
            raise

def render_all_videos_in_folder(
    input_folder,
    output_folder,
    backgrounds_folder,
    mask_height=10,
    mute=False
):
    os.makedirs(output_folder, exist_ok=True)

    video_files = glob(os.path.join(input_folder, '*.*'))
    background_files = glob(os.path.join(backgrounds_folder, '*.*'))

    if not video_files:
        print("X Khong co video")
        return

    if not background_files:
        print("X Khong co background")
        return

    print(f"Tong video: {len(video_files)}")

    for video_path in video_files:
        filename = os.path.basename(video_path)
        output_path = os.path.join(output_folder, filename)

        background_path = random.choice(background_files)

        print(f"Rendering: {filename}")
        print(f"Background: {os.path.basename(background_path)}")

        try:
            render_static_mask_overlay(
                video_path,
                background_path,
                output_path,
                mask_height,
                mute
            )
            print(f"Done: {output_path}\n")

        except Exception as e:
            print(f"Loi: {filename}")
            print(e)

def main():
    render_all_videos_in_folder(
        input_folder='downloads',
        output_folder='renders',
        backgrounds_folder='backgrounds',
        mask_height=10,
        mute=False
    )

if __name__ == '__main__':
    main()


tham khảo code render video sau
sau khi download về sẽ thực hiện render video theo code tôi gửi trên, video render xong sẽ được lưu vào đúng folder download video về và xóa video download trước đó đi 
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-05-29T21:17:07+07:00.
</ADDITIONAL_METADATA>