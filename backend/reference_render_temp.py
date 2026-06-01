import os
import random
import subprocess
import shutil
from pathlib import Path

# Constants
MAX_DURATION = 59
TARGET_W = 1080
TARGET_H = 1920
AUDIO_VOLUME = 0.8

OUTPUT_BITRATE = "2000k"
OUTPUT_CRF = "28"
OUTPUT_AUDIO_BITRATE = "96k"
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

def _has_audio(path: str | Path) -> bool:
    """Check if the video file has an audio stream."""
    binary = shutil.which("ffprobe") or "ffprobe"
    try:
        r = subprocess.run(
            [binary, "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, timeout=5
        )
        return bool(r.stdout.strip())
    except Exception:
        return False

def _random_string(length: int = 14) -> str:
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(random.choices(alphabet, k=length))

def _generate_segments(duration: float) -> list[tuple[float, float]]:
    """Generate segments for random skip logic (similar to moviepy loop)."""
    segments = []
    current_t = 0.0
    flip_interval = 2.5
    while current_t < duration:
        # Random skip 1s (25% chance)
        if random.random() < 0.25:
            current_t += 1.0
        
        if current_t >= duration:
            break
            
        end_t = min(current_t + flip_interval, duration)
        if end_t - current_t > 0.1: # Avoid too tiny segments
            segments.append((current_t, end_t))
        current_t = end_t
    return segments

def render_vertical_reup(video_path: str | Path, output_dir: str | Path) -> Path:
    """
    Render video using pure FFmpeg for maximum speed.
    Includes: Zoom, Tilt, Color, Periodic Flip, Speedup, Central Line, and Random Skips.
    """
    video_path = Path(video_path).resolve()
    output_dir = Path(output_dir).expanduser().resolve()
    if not video_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file video: {video_path}")
    output_dir.mkdir(parents=True, exist_ok=True)

    vcodec = _resolve_video_codec()
    output_name = f"{_random_string()}.mp4"
    output_path = output_dir / output_name

    duration = _get_duration(video_path)
    if duration > MAX_DURATION:
        duration = MAX_DURATION
    
    has_audio = _has_audio(video_path)
    
    segments = _generate_segments(duration)
    if not segments:
        segments = [(0, duration)]

    # 1. Build Segment Trimming and Concatenation Filters
    v_trims = []
    a_trims = []
    for i, (start, end) in enumerate(segments):
        v_trims.append(f"[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]")
        if has_audio:
            a_trims.append(f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{i}]")
    
    v_concat_inputs = "".join([f"[v{i}]" for i in range(len(segments))])
    concat_filter = f"{v_concat_inputs}concat=n={len(segments)}:v=1:a=0[vconcat]"
    
    if has_audio:
        a_concat_inputs = "".join([f"[a{i}]" for i in range(len(segments))])
        concat_filter += f"; {a_concat_inputs}concat=n={len(segments)}:v=0:a=1[aconcat]"

    # 2. Build Effect Filters
    angle = random.uniform(-1.5, 1.5)
    
    v_effects = (
        "[vconcat]scale=1668:2966:force_original_aspect_ratio=increase,crop=1668:2966,"
        f"rotate={angle}*PI/180:fillcolor=black@0,crop=1080:1920,"
        "eq=saturation=1.3:contrast=1.1,"
        "hflip=enable='between(mod(t,5),2.5,5)',"
        "drawbox=y=(ih-20)/2:w=iw:h=20:color=white@0.85:t=fill,"
        "setpts=PTS/1.05[vfinal]"
    )
    
    filters = v_trims + a_trims + [concat_filter, v_effects]
    if has_audio:
        a_effects = f"[aconcat]atempo=1.05,volume={AUDIO_VOLUME}[afinal]"
        filters.append(a_effects)

    filter_complex = "; ".join(filters)

    # 3. Construct FFmpeg Command
    cmd = [
        _ffmpeg_binary(), "-y",
        "-i", str(video_path),
        "-filter_complex", filter_complex,
        "-map", "[vfinal]",
    ]
    if has_audio:
        cmd.extend(["-map", "[afinal]"])

    cmd.extend([
        "-c:v", vcodec,
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-threads", str(OUTPUT_THREADS),
    ])

    # Encoder specific params
    if "nvenc" in vcodec:
        cmd.extend(["-preset", "p1", "-cq", "28", "-b:v", OUTPUT_BITRATE])
    elif "qsv" in vcodec:
        cmd.extend(["-global_quality", "25"])
    elif vcodec == "libx264":
        cmd.extend(["-preset", OUTPUT_PRESET, "-crf", OUTPUT_CRF])
    
    if has_audio:
        cmd.extend([
            "-c:a", "aac",
            "-b:a", OUTPUT_AUDIO_BITRATE,
        ])
    
    cmd.append(str(output_path))

    print(f"[render_pipeline] Rendering using FFmpeg Pure Pipeline ({vcodec})...")
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return output_path.resolve()
    except subprocess.CalledProcessError as e:
        print(f"[render_pipeline] FFmpeg error: {e.stderr}")
        # Fallback to libx264 if HW encoder fails
        if vcodec != "libx264":
            print("[render_pipeline] Retrying with libx264...")
            cmd[cmd.index("-c:v") + 1] = "libx264"
            # Clean up HW specific flags
            try:
                subprocess.run(cmd, check=True)
                return output_path.resolve()
            except Exception as e2:
                raise RuntimeError(f"FFmpeg failed even with libx264 fallback: {e2}")
        raise RuntimeError(f"FFmpeg render failed: {e.stderr}")

if __name__ == "__main__":
    # Test
    import sys
    if len(sys.argv) > 1:
        render_vertical_reup(sys.argv[1], "test_renders")
