"""FastAPI service: nhận yêu cầu download video từ backend khác."""

from __future__ import annotations

import asyncio
import os
import re
import sys
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from yt_dlp import YoutubeDL

_API_DIR = Path(__file__).resolve().parent
DEFAULT_DOWNLOAD_DIR = _API_DIR / "downloads"
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from render_pipeline import render_vertical_reup

app = FastAPI(title="Video Download API", version="0.1.0")


class DownloadVideoRequest(BaseModel):
    url: HttpUrl = Field(..., description="URL file video cần tải")
    download_folders: str | None = Field(
        default=None,
        description=(
            "Thư mục lưu file gốc sau khi tải. Bỏ qua hoặc để trống → mặc định thư mục "
            "`downloads` cạnh file service (video_download_api/downloads)."
        ),
    )
    render_folders: str = Field(
        ...,
        min_length=1,
        description="Thư mục dùng cho bước render (chuẩn bị sẵn đường dẫn)",
    )


class DownloadVideoResponse(BaseModel):
    ok: bool
    message: str
    saved_path: str | None = None
    rendered_path: str | None = Field(
        default=None,
        description="File MP4 sau bước render (1080x1920, hiệu ứng reup)",
    )
    render_folders: str


def _resolve_download_dir(raw: str | None) -> Path:
    if raw is not None and raw.strip():
        return Path(raw).expanduser().resolve()
    return DEFAULT_DOWNLOAD_DIR.resolve()


def _safe_filename_from_url(url: str) -> str:
    path = unquote(urlparse(url).path)
    name = Path(path).name.strip()
    if not name or name in (".", ".."):
        return f"video_{uuid.uuid4().hex}.bin"
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    return name or f"video_{uuid.uuid4().hex}.bin"


def _is_youtube_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host in (
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
        "www.youtu.be",
    ) or host.endswith(".youtube.com")


def _is_tiktok_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host in (
        "tiktok.com",
        "www.tiktok.com",
        "m.tiktok.com",
        "vm.tiktok.com",
        "vt.tiktok.com",
    ) or host.endswith(".tiktok.com")


def _use_ytdlp(url: str) -> bool:
    """YouTube / TikTok không cho tải file video bằng HTTP GET thuần."""
    return _is_youtube_url(url) or _is_tiktok_url(url)


def _looks_like_html(data: bytes) -> bool:
    if not data:
        return False
    s = data.lstrip()
    if s.startswith(b"\xef\xbb\xbf"):
        s = s[3:]
    return s.startswith((b"<!DOCTYPE", b"<!doctype", b"<html", b"<HTML"))


def _resolve_saved_path_after_ytdlp(info: dict, ydl: YoutubeDL) -> str:
    fp = info.get("filepath")
    if fp and Path(fp).is_file():
        return str(Path(fp).resolve())
    for d in info.get("requested_downloads") or ():
        p = d.get("filepath")
        if p and Path(p).is_file():
            return str(Path(p).resolve())
    cand = ydl.prepare_filename(info)
    if Path(cand).is_file():
        return str(Path(cand).resolve())
    raise RuntimeError("yt-dlp không trả về đường dẫn file sau khi tải")


def _ytdlp_download_sync(url: str, download_dir: Path) -> str:
    """
    Tải qua yt-dlp (YouTube, TikTok, ...). Thử format linh hoạt rồi fallback `best`
    vì Shorts / một số kênh không có bản mp4+m4a đúng như chuỗi format cũ.
    """
    download_dir = download_dir.resolve()
    outtmpl = str(download_dir / "%(id)s.%(ext)s")
    base: dict = {
        "outtmpl": outtmpl,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }
    cookies_file = (os.getenv("YTDLP_COOKIES_FILE") or "").strip()
    print(f"cookies_file: {cookies_file}")
    cookies_from_browser = (os.getenv("YTDLP_COOKIES_FROM_BROWSER") or "").strip()
    if cookies_file:
        base["cookiefile"] = cookies_file
    if cookies_from_browser:
        # Định dạng yt-dlp: "chrome", "firefox", "safari", ...
        base["cookiesfrombrowser"] = (cookies_from_browser,)
    # bv*+ba/b: video+audio tách hoặc một file; merge -> mp4 nếu có ffmpeg
    format_attempts: list[dict] = [
        {
            "format": "bv*+ba/best",
            "merge_output_format": "mp4",
        },
        {
            "format": "bestvideo+bestaudio/best",
            "merge_output_format": "mp4",
        },
        {
            "format": "best",
        },
        {
            # Fallback cuối: để yt-dlp tự chọn format mặc định.
        },
    ]
    last_err: Exception | None = None
    for fmt_opts in format_attempts:
        opts = {**base, **fmt_opts}
        try:
            with YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if not isinstance(info, dict):
                    raise RuntimeError("yt-dlp: không lấy được metadata")
                return _resolve_saved_path_after_ytdlp(info, ydl)
        except Exception as e:
            last_err = e
            continue
    assert last_err is not None
    raise last_err


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/download/video", response_model=DownloadVideoResponse)
async def download_video(body: DownloadVideoRequest) -> DownloadVideoResponse:
    """
    Tải video từ `url` vào `download_folders` (mặc định thư mục `downloads` của service nếu không gửi),
    sau đó render (moviepy, giống tiktok_beta.py) và ghi MP4 vào `render_folders`.
    """
    download_dir = _resolve_download_dir(body.download_folders)
    render_dir = Path(body.render_folders).expanduser().resolve()

    try:
        download_dir.mkdir(parents=True, exist_ok=True)
        render_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise HTTPException(status_code=400, detail=f"Không tạo được thư mục: {e}") from e

    url_str = str(body.url)
    saved_path_str: str

    if _use_ytdlp(url_str):
        try:
            saved_path_str = await asyncio.to_thread(_ytdlp_download_sync, url_str, download_dir)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=(
                    "yt-dlp không tải được (kiểm tra URL; gộp video+audio thường cần ffmpeg: "
                    f"brew install ffmpeg). Chi tiết: {e}"
                ),
            ) from e
        src = "YouTube" if _is_youtube_url(url_str) else "TikTok"
        dl_msg = f"Đã tải ({src} qua yt-dlp)"
    else:
        dest_name = _safe_filename_from_url(url_str)
        dest_path = download_dir / dest_name
        head_checked = False

        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(600.0)) as client:
                async with client.stream("GET", url_str) as resp:
                    if resp.status_code >= 400:
                        raise HTTPException(
                            status_code=502,
                            detail=f"URL trả về HTTP {resp.status_code}",
                        )
                    with dest_path.open("wb") as f:
                        async for chunk in resp.aiter_bytes():
                            if not head_checked and chunk:
                                head_checked = True
                                if _looks_like_html(chunk[:2048]):
                                    raise HTTPException(
                                        status_code=400,
                                        detail=(
                                            "Phản hồi là HTML (trang web), không phải file video. "
                                            "YouTube/Shorts và TikTok do API tải qua yt-dlp; "
                                            "chỉ dùng URL trực tiếp tới file .mp4 khi tải bằng HTTP."
                                        ),
                                    )
                            f.write(chunk)
        except httpx.RequestError as e:
            if dest_path.exists():
                dest_path.unlink(missing_ok=True)
            raise HTTPException(status_code=502, detail=f"Lỗi kết nối/tải: {e}") from e
        except HTTPException:
            if dest_path.exists():
                dest_path.unlink(missing_ok=True)
            raise

        if dest_path.exists() and dest_path.stat().st_size == 0:
            dest_path.unlink(missing_ok=True)
            raise HTTPException(status_code=502, detail="File tải về rỗng")

        saved_path_str = str(dest_path.resolve())
        dl_msg = "Đã tải (HTTP)"

    try:
        rendered = await asyncio.to_thread(render_vertical_reup, saved_path_str, render_dir)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Render thất bại (file gốc: {saved_path_str}): {e}",
        ) from e

    return DownloadVideoResponse(
        ok=True,
        message=f"{dl_msg} và render xong",
        saved_path=saved_path_str,
        rendered_path=str(rendered),
        render_folders=str(render_dir),
    )
