import urllib.request
import json
import xml.etree.ElementTree as ET
import datetime
import time
import sqlite3
import sys
import os
import threading

sys.stdout.reconfigure(encoding='utf-8')

# Global variable to track the last successful scan/upload completion time.
# By default, when starting the script, it scans for videos published since 3 hours ago.
LAST_SCAN_COMPLETED_TIME = datetime.datetime.utcnow() - datetime.timedelta(hours=4)

# Path to lock file to prevent overlapping crons
LOCK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scheduler.lock')

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
    cursor.execute("SELECT id, name, channel_ids FROM profiles WHERE name IN ('tips_amaz', 'tips_dta')")
    rows = cursor.fetchall()
    conn.close()
    
    profiles = {}
    for row in rows:
        profile_id, name, channel_ids_str = row
        if channel_ids_str:
            ids = [x.strip() for x in channel_ids_str.split(',') if x.strip()]
            profiles[name] = {
                "id": profile_id,
                "channels": ids
            }
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
            title_el = entry.find('atom:title', ns)
            
            if video_id_el is not None and published_el is not None:
                video_id = video_id_el.text
                published_str = published_el.text
                title = title_el.text if title_el is not None else ""
                
                clean_pub_str = published_str.split('+')[0].split('Z')[0]
                pub_dt = datetime.datetime.strptime(clean_pub_str, "%Y-%m-%dT%H:%M:%S")
                
                if pub_dt >= since_time:
                    videos.append({
                        'video_id': video_id,
                        'published': published_str,
                        'title': title
                    })
        return videos
    except Exception:
        return []

def get_profile_status(profile_id):
    try:
        db_path = get_db_path()
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT status FROM profiles WHERE id = ?", (profile_id,))
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else "unknown"
    except Exception as e:
        print(f"Error checking profile status: {e}")
        return "error"

def trigger_upload_via_api(video_id, channel_id, profile_id=None, profile_name=None):
    url = "http://localhost:3010/api/upload_new_video"
    payload = {
        "video_id": video_id,
        "channel_id": channel_id
    }
    if profile_id:
        payload["profile_id"] = profile_id
    if profile_name:
        payload["profile_name"] = profile_name
        
    data = json.dumps(payload).encode('utf-8')
    
    req = urllib.request.Request(
        url, 
        data=data, 
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=600) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return res_data
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode('utf-8')
            return {"error": f"HTTP {e.code}: {e.reason}", "details": err_body}
        except:
            return {"error": f"HTTP {e.code}: {e.reason}"}
    except Exception as e:
        return {"error": str(e)}


def run_scheduled_job():
    global LAST_SCAN_COMPLETED_TIME
    
    # Check lock file to prevent overlapping runs
    if os.path.exists(LOCK_FILE):
        print(f"[{datetime.datetime.now()}] A scan job is already running or lock file exists. Skipping...")
        return
        
    try:
        # Create lock file
        with open(LOCK_FILE, 'w') as f:
            f.write(str(os.getpid()))
            
        scan_start_time = datetime.datetime.utcnow()
        # Scan from the last completed scan time
        since_time = LAST_SCAN_COMPLETED_TIME
        print(f"\n[{scan_start_time}] Starting automatic scan for videos published since: {since_time} UTC (Local Time)...")
        
        profiles = get_channels_for_profiles()
        pending_tasks = []
        
        for profile_name, info in profiles.items():
            profile_id = info["id"]
            channel_ids = info["channels"]
            print(f"Scanning channels for {profile_name}...")
            for channel_id in channel_ids:
                videos = get_recent_videos_from_rss(channel_id, since_time)
                for v in videos:
                    pending_tasks.append({
                        "profile_name": profile_name,
                        "profile_id": profile_id,
                        "channel_id": channel_id,
                        "video_id": v["video_id"],
                        "title": v["title"]
                    })
                time.sleep(0.5)
                
        print(f"Scan finished. Found {len(pending_tasks)} new videos to process.")
        
        if len(pending_tasks) == 0:
            # If no tasks, update last completed scan time to the time we started scanning
            LAST_SCAN_COMPLETED_TIME = scan_start_time
            print(f"No new videos. Updated last completed scan time to: {LAST_SCAN_COMPLETED_TIME} UTC")
            return

        # Group tasks by profile
        profile_tasks = {}
        for task in pending_tasks:
            p_name = task["profile_name"]
            if p_name not in profile_tasks:
                profile_tasks[p_name] = []
            profile_tasks[p_name].append(task)
            
        def process_profile_queue(p_name, tasks):
            print(f"[{p_name}] Processing queue of {len(tasks)} videos...")
            for idx, task in enumerate(tasks):
                profile_id = task["profile_id"]
                video_id = task["video_id"]
                channel_id = task["channel_id"]
                
                wait_attempts = 0
                while True:
                    status = get_profile_status(profile_id)
                    if status == "idle":
                        break
                    print(f"[{p_name}] Status is '{status}'. Waiting for profile to become 'idle' (Check #{wait_attempts+1})...")
                    wait_attempts += 1
                    time.sleep(15)
                    
                    if wait_attempts > 60:
                        print(f"[{p_name}] Timeout waiting for profile to become idle. Proceeding...")
                        break
                
                print(f"[{p_name}] Triggering video {idx+1}/{len(tasks)}: {task['title']} (ID: {video_id})")
                res = trigger_upload_via_api(video_id, channel_id, profile_id=profile_id, profile_name=p_name)
                print(f"[{p_name}] Response: {json.dumps(res)}")
                
                # Sleep 2 minutes between triggers
                print(f"[{p_name}] Waiting 2 minutes before the next trigger...")
                time.sleep(120)

        # Run profile queues in parallel threads
        threads = []
        for p_name, tasks in profile_tasks.items():
            t = threading.Thread(target=process_profile_queue, args=(p_name, tasks))
            t.start()
            threads.append(t)

        for t in threads:
            t.join()
            
        # Update last completed scan time to the start of this run upon successful completion
        LAST_SCAN_COMPLETED_TIME = scan_start_time
        print(f"All triggered uploads completed successfully. Updated last completed scan time to: {LAST_SCAN_COMPLETED_TIME} UTC")
        
    except Exception as e:
        print(f"Error during scheduled job run: {e}")
    finally:
        # Remove lock file
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)

def main():
    # Remove lock file if it was left from a previous crashed run
    if os.path.exists(LOCK_FILE):
        os.remove(LOCK_FILE)
        
    # Calculate intervals: 30 minutes = 1800 seconds
    interval_seconds = 1800 
    print(f"Starting background scheduler daemon. Runs every 30 minutes (1800s)...")
    
    # First run immediately to capture anything missed since last scan
    run_scheduled_job()
    
    while True:
        print(f"\n[{datetime.datetime.now()}] Sleeping for 30 minutes before the next scheduled scan...")
        time.sleep(interval_seconds)
        run_scheduled_job()

if __name__ == '__main__':
    main()
