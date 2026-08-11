import subprocess
import os
import random
import shutil
import sys
import argparse
from glob import glob
from pathlib import Path

# Force UTF-8 for console output to handle special characters in filenames
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def _ffmpeg_binary() -> str:
    p = shutil.which("ffmpeg")
    return p if p else "ffmpeg"

def _ffprobe_binary() -> str:
    p = shutil.which("ffprobe")
    return p if p else "ffprobe"

def _get_duration(path) -> float:
    binary = _ffprobe_binary()
    try:
        r = subprocess.run(
            [binary, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=5
        )
        return float(r.stdout.strip())
    except Exception:
        return 0.0

def _has_audio(path) -> bool:
    binary = _ffprobe_binary()
    try:
        r = subprocess.run(
            [binary, "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, timeout=5
        )
        return bool(r.stdout.strip())
    except Exception:
        return False

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
    for enc in ["h264_nvenc", "h264_qsv", "h264_amf"]:
        if _ffmpeg_encoder_available(enc):
            print(f"[concat_pipeline] Using HW encoder: {enc}")
            return enc
    print("[concat_pipeline] No HW encoder found, falling back to libx264")
    return "libx264"

def concat_videos(video1, video2, output_path):
    video1 = Path(video1).resolve()
    video2 = Path(video2).resolve()
    output_path = Path(output_path).resolve()

    has_a1 = _has_audio(video1)
    has_a2 = _has_audio(video2)
    dur1 = _get_duration(video1)
    dur2 = _get_duration(video2)

    cmd = [_ffmpeg_binary(), "-y"]
    
    # Inputs:
    cmd.extend(["-i", str(video1)])
    cmd.extend(["-i", str(video2)])

    filter_complex = []
    
    # Scale both to 1080x1920 (decrease & pad to maintain aspect ratio)
    v0_filter = "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v0]"
    v1_filter = "[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v1]"
    filter_complex.append(v0_filter)
    filter_complex.append(v1_filter)

    extra_inputs_count = 2 # Start indexing extra inputs from 2
    
    a0_label = ""
    a1_label = ""
    
    if not has_a1 and not has_a2:
        # No audio at all
        concat_filter = "[v0][v1]concat=n=2:v=1:a=0[outv]"
        filter_complex.append(concat_filter)
        has_audio_output = False
    else:
        has_audio_output = True
        if has_a1:
            filter_complex.append("[0:a]aresample=async=1[a0]")
            a0_label = "[a0]"
        else:
            cmd.extend(["-f", "lavfi", "-t", str(dur1), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"])
            a0_label = f"[{extra_inputs_count}:a]"
            extra_inputs_count += 1
            
        if has_a2:
            filter_complex.append("[1:a]aresample=async=1[a1]")
            a1_label = "[a1]"
        else:
            cmd.extend(["-f", "lavfi", "-t", str(dur2), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"])
            a1_label = f"[{extra_inputs_count}:a]"
            extra_inputs_count += 1
            
        concat_filter = f"[v0]{a0_label}[v1]{a1_label}concat=n=2:v=1:a=1[outv][outa]"
        filter_complex.append(concat_filter)

    cmd.extend(["-filter_complex", "; ".join(filter_complex)])
    cmd.extend(["-map", "[outv]"])
    if has_audio_output:
        cmd.extend(["-map", "[outa]"])

    vcodec = _resolve_video_codec()
    cmd.extend([
        "-c:v", vcodec,
        "-pix_fmt", "yuv420p",
        "-r", "30",
    ])
    
    if vcodec == "libx264":
        cmd.extend(["-preset", "fast", "-crf", "23"])
    elif "nvenc" in vcodec:
        cmd.extend(["-preset", "p1", "-cq", "28", "-b:v", "2000k"])
    elif "qsv" in vcodec:
        cmd.extend(["-global_quality", "25"])
        
    if has_audio_output:
        cmd.extend([
            "-c:a", "aac",
            "-b:a", "128k"
        ])
        
    cmd.append(str(output_path))
    
    print(f"Running command: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

def main():
    parser = argparse.ArgumentParser(description="Concatenate video with a random video from a folder.")
    parser.add_argument("--video", required=True, help="Path to main downloaded video")
    parser.add_argument("--concat-dir", required=True, help="Folder containing videos to concat with")
    parser.add_argument("--output", required=True, help="Output file path")
    
    args = parser.parse_args()
    
    concat_dir = Path(args.concat_dir).resolve()
    if not concat_dir.exists():
        print(f"Error: Concat directory {concat_dir} does not exist.")
        sys.exit(1)
        
    supported_extensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm']
    files = []
    for ext in supported_extensions:
        files.extend(glob(os.path.join(str(concat_dir), f'*{ext}')))
        files.extend(glob(os.path.join(str(concat_dir), f'*{ext.upper()}')))
        
    if not files:
        print(f"Error: No videos found in {concat_dir}.")
        sys.exit(1)
        
    random_video = random.choice(files)
    print(f"Selected video for concatenation: {random_video}")
    
    concat_videos(args.video, random_video, args.output)
    print("Concatenation finished successfully.")

if __name__ == '__main__':
    main()
