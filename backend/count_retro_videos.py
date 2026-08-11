import urllib.request
import xml.etree.ElementTree as ET
import datetime
import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

def get_db_path():
    possible_paths = [
        '../data/tiktok.db',
        'data/tiktok.db',
        './data/tiktok.db',
        'D:/TIKTOK/upload_tiktok/data/tiktok.db'
    ]
    for p in possible_paths:
        if os.path.exists(p):
            return p
    return 'D:/TIKTOK/upload_tiktok/data/tiktok.db'

def get_channels_for_profiles():
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name, channel_ids FROM profiles WHERE name IN ('tips_amaz', 'tips_dta')")
    rows = cursor.fetchall()
    conn.close()
    
    profiles = {}
    for row in rows:
        name, channel_ids_str = row
        if channel_ids_str:
            ids = [x.strip() for x in channel_ids_str.split(',') if x.strip()]
            profiles[name] = ids
    return profiles

def get_recent_videos_from_rss(channel_id, since_time):
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        ns = {
            'atom': 'http://www.w3.org/2005/Atom',
            'yt': 'http://www.youtube.com/xml/schemas/2015'
        }
        
        videos = []
        for entry in root.findall('atom:entry', ns):
            video_id_el = entry.find('yt:videoId', ns)
            published_el = entry.find('atom:published', ns)
            
            if video_id_el is not None and published_el is not None:
                video_id = video_id_el.text
                published_str = published_el.text
                
                clean_pub_str = published_str.split('+')[0].split('Z')[0]
                pub_dt = datetime.datetime.strptime(clean_pub_str, "%Y-%m-%dT%H:%M:%S")
                
                if pub_dt >= since_time:
                    videos.append(video_id)
        return videos
    except Exception:
        return []

def main():
    since_time = datetime.datetime(2026, 6, 18, 0, 20, 0)
    print(f"Scanning from: {since_time} UTC")
    
    profiles = get_channels_for_profiles()
    
    for p_name, channel_ids in profiles.items():
        total_videos = 0
        for channel_id in channel_ids:
            videos = get_recent_videos_from_rss(channel_id, since_time)
            total_videos += len(videos)
        print(f"[{p_name}] Found total new videos: {total_videos}")

if __name__ == '__main__':
    main()
