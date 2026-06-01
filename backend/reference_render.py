import subprocess
import os
import random
from glob import glob
from concurrent.futures import ProcessPoolExecutor
import requests


TELEGRAM_TOKEN = "7952619216:AAFO_cgfDyV1TRism4j7shaaTIgGdtxF6pU"
TELEGRAM_CHAT_ID = "1370074402"
def send_telegram_message(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown"
    }
    try:
        requests.post(url, data=payload)
    except Exception as e:
        print(f"❌ Lỗi gửi Telegram: {e}")

def render_static_mask_overlay(video_path, background_path, output_path, mask_height=4, mute=False, sparkle_effect_path=None):
    cmd = [
        'ffmpeg', "-y",
        '-loglevel', 'error',
        '-i', video_path,
        '-loop', '1', '-i', background_path,
    ]

    if sparkle_effect_path:
        cmd += ['-stream_loop', '-1', '-i', sparkle_effect_path]

    filter_complex = (
        "[0:v] setpts=PTS/1, scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920 [vid]; "
        f"[1:v] scale=1080:1920, crop=1080:{mask_height}:0:(in_h-{mask_height})/2, format=rgba [img]; "
    )

    if sparkle_effect_path:
        sparkle_filter = (
            "[2:v] scale=1080:1920:force_original_aspect_ratio=decrease,"
            "pad=1080:1920:(ow-iw)/2:(oh-ih)/2,"
            "colorkey=0x000000:0.1:0.1, format=rgba, lut=a=val*0.4 [spark]; "
            f"[vid][img] overlay=0:(main_h-{mask_height})/2:shortest=1 [tmp]; "
            f"[tmp][spark] overlay=0:0:format=auto:shortest=1 [out]"
        )
        filter_complex += sparkle_filter
    else:
        filter_complex += f"[vid][img] overlay=0:(main_h-{mask_height})/2:shortest=1 [out]"

    cmd += ['-filter_complex', filter_complex, '-map', '[out]']

    if not mute:
        cmd += ['-map', '0:a?', '-filter:a', 'atempo=1.1', '-c:a', 'aac', '-b:a', '128k']
    else:
        print(f"🔇 [{os.path.basename(video_path)}] Tắt tiếng video.")

    # Chỉ dùng CPU (libx264)
    cmd += [
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-threads', '1',
        output_path
    ]

    print(f"▶️ Đang render: {os.path.basename(video_path)}")
    subprocess.run(cmd, check=True)
    print(f"✅ Hoàn tất: {output_path}")


def render_video_task(video_path, backgrounds_folder, effects_folder, output_folder, mask_height, mute):
    try:
        background_files = glob(os.path.join(backgrounds_folder, '*.*'))
        sparkle_files = glob(os.path.join(effects_folder, '*.*')) if effects_folder else []

        if not background_files:
            raise Exception("Không tìm thấy background nào.")

        filename = os.path.basename(video_path)
        output_path = os.path.join(output_folder, filename)
        background_path = random.choice(background_files)
        sparkle_effect_path = random.choice(sparkle_files) if sparkle_files else None

        render_static_mask_overlay(
            video_path, background_path, output_path,
            mask_height, mute, sparkle_effect_path
        )
    except Exception as e:
        print(f"❌ Lỗi render {video_path}: {e}")


def render_all_videos_in_folder(input_folder, output_folder, backgrounds_folder, effects_folder=None, mask_height=4, mute=False, max_workers=1):
    os.makedirs(output_folder, exist_ok=True)
    video_files = glob(os.path.join(input_folder, '*.*'))

    if not video_files:
        print("❌ Không tìm thấy video trong thư mục đầu vào.")
        return

    print(f"🚀 Bắt đầu render {len(video_files)} video với {max_workers} luồng (CPU)...\n")
    message = f"*🎬 Downloaded *\n📌 *{video_files}*"
    send_telegram_message(message)
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        for video_path in video_files:
            executor.submit(
                render_video_task,
                video_path,
                backgrounds_folder,
                effects_folder,
                output_folder,
                mask_height,
                mute
            )


def main():
    render_all_videos_in_folder(
        input_folder='downloads',
        output_folder='output',
        backgrounds_folder='backgrounds',
        effects_folder='effects',
        mute=False,
        max_workers=1
    )


if __name__ == '__main__':
    main()
