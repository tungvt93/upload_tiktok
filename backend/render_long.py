import os
import subprocess
import math
import argparse
import textwrap
import sys

# Ensure stdout uses utf-8 encoding to prevent UnicodeEncodeError on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def get_video_duration(input_file):
    """Lay thoi luong video (giay) bang ffprobe."""
    cmd = [
        'ffprobe', 
        '-v', 'error', 
        '-show_entries', 'format=duration', 
        '-of', 'default=noprint_wrappers=1:nokey=1', 
        input_file
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return float(result.stdout.strip())

def process_video_segment(input_file, output_file, start_time, duration, title_text):
    """
    Xu ly mot doan video voi cac yeu cau:
    1. Zoom 180%
    2. Nen mo (blur) tren/duoi cho ty le 9:16
    3. Toc do 1.3x
    4. Lat ngang
    5. Chinh mau nhe
    """
    
    # Xu ly text de tu dong xuong dong (khoang 22 ky tu 1 dong) va can giua
    lines = textwrap.wrap(title_text, width=22)
    max_len = max((len(line) for line in lines), default=0)
    centered_lines = [line.center(max_len) for line in lines]
    wrapped_text = "\n".join(centered_lines)
    
    # Su dung absolute path cho temp file de tranh loi cwd
    temp_title_file = os.path.join(os.path.dirname(os.path.abspath(output_file)), f"temp_title_{os.path.basename(output_file)}.txt")
    with open(temp_title_file, "w", encoding="utf-8") as f:
        f.write(wrapped_text)

    escaped_title_file = temp_title_file.replace('\\', '/')
    escaped_title_file = escaped_title_file.replace(':', '\\:')

    target_width = 1080
    target_height = 1920
    
    video_speed = 1.3
    audio_speed = 1.3
    
    filter_complex = (
        f"[0:v]trim=start={start_time}:duration={duration},setpts=PTS-STARTPTS,setpts=PTS/{video_speed},"
        f"hflip,eq=contrast=1.1:saturation=1.4:brightness=0.06,colorbalance=rm=0.08:gm=0.08:bm=-0.15[v_base]; "
        
        f"[v_base]split=2[v_bg][v_fg]; "
        
        f"[v_bg]scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
        f"crop={target_width}:{target_height},boxblur=luma_radius=25:luma_power=2[bg]; "
        
        f"[v_fg]scale={target_width}:-1,scale=iw*1.8:ih*1.8[fg]; "
        
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2[vid_merged]; "
        
        f"[vid_merged]drawtext=textfile='{escaped_title_file}':fontcolor=#22f158:fontsize=80:line_spacing=15:x=(w-text_w)/2:y=200[outv]; "
        
        f"[0:a]atrim=start={start_time}:duration={duration},asetpts=PTS-STARTPTS,atempo={audio_speed}[outa]"
    )

    cmd = [
        'ffmpeg',
        '-y',
        '-i', input_file,
        '-filter_complex', filter_complex,
        '-map', '[outv]',
        '-map', '[outa]',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        output_file
    ]
    
    print(f"Rendering {output_file} (from {start_time}s, duration {duration}s)...", flush=True)
    try:
        subprocess.run(cmd, check=True)
    finally:
        if os.path.exists(temp_title_file):
            os.remove(temp_title_file)
    print(f"SEGMENT_DONE:{output_file}", flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--output-dir", required=False, default=None)
    parser.add_argument("--title", required=True)
    # Single-segment mode args
    parser.add_argument("--start-time", type=float, default=None)
    parser.add_argument("--duration", type=float, default=None)
    parser.add_argument("--output", default=None, help="Output file path for single-segment mode")
    # Info-only mode: just print duration and segment count
    parser.add_argument("--info-only", action="store_true", help="Print duration info and exit without rendering")
    parser.add_argument("--segment-duration", type=float, default=120.0)
    args = parser.parse_args()

    input_video = args.video
    title_text = args.title
    segment_duration = args.segment_duration

    if not os.path.exists(input_video):
        print(f"File not found: {input_video}", flush=True)
        sys.exit(1)

    total_duration = get_video_duration(input_video)

    # Info-only mode: print duration and segment count for server.js to parse
    if args.info_only:
        num_segments = math.ceil(total_duration / segment_duration) if total_duration > 180 else 1
        print(f"DURATION:{total_duration}", flush=True)
        print(f"NUM_SEGMENTS:{num_segments}", flush=True)
        print(f"SEGMENT_DURATION:{segment_duration}", flush=True)
        return

    # Single-segment mode: render exactly one segment
    if args.start_time is not None and args.duration is not None and args.output:
        process_video_segment(input_video, args.output, args.start_time, args.duration, title_text)
        return

    # Full mode: render all segments (legacy)
    output_dir = args.output_dir
    if not output_dir:
        print("--output-dir is required in full mode", flush=True)
        sys.exit(1)

    base_name = os.path.splitext(os.path.basename(input_video))[0]

    if total_duration > 180:
        num_segments = math.ceil(total_duration / segment_duration)
        print(f"Video is {total_duration:.2f}s (> 3 min). Splitting into {num_segments} parts.", flush=True)
        
        for i in range(num_segments):
            start_time = i * segment_duration
            duration = min(segment_duration, total_duration - start_time)
            output_name = os.path.join(output_dir, f"{base_name}_part{i+1}.mp4")
            process_video_segment(input_video, output_name, start_time, duration, title_text)
    else:
        print(f"Video is {total_duration:.2f}s (<= 3 min). No split needed.", flush=True)
        output_name = os.path.join(output_dir, f"{base_name}_processed.mp4")
        process_video_segment(input_video, output_name, 0, total_duration, title_text)

if __name__ == "__main__":
    main()
