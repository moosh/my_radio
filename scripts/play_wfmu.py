#!/usr/bin/env python3
import json
import vlc
import time
import sys
import os
import logging
import requests
import re
import subprocess
import tempfile
import select
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from bs4 import BeautifulSoup

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_playlists():
    """Load the playlists from the JSON file."""
    try:
        json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "wfmu_playlists.json")
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data['playlists']
    except Exception as e:
        logging.error(f"Error loading playlists: {e}")
        return []

def list_shows(playlists):
    """Display available shows."""
    print("\nAvailable shows:")
    for i, show in enumerate(playlists, 1):
        print(f"{i}. {show['date']} - {show['title']}")
    print()

def is_rtmp_url(url):
    """Check if URL is an RTMP stream."""
    return url.startswith(('rtmp://', 'rtmpt://', 'rtmps://'))

def get_mp3_url_from_m3u(m3u_url):
    """Fetch the MP3 URL from the M3U file."""
    try:
        if not m3u_url:
            return None
            
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.wfmu.org/'
        }
        
        response = requests.get(m3u_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Log the response for debugging
        logging.info(f"M3U Response: {response.text}")
        
        # M3U files are simple text files with URLs
        lines = response.text.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#'):
                return line
                
        return None
    except Exception as e:
        logging.error(f"Error fetching M3U file: {e}")
        return None

def get_stream_url_from_flashplayer(popup_url):
    """Extract the stream URL from the Flash player page."""
    try:
        # First try to construct direct S3 URL
        if 'flashplayer.php' in popup_url:
            logger.info(f"\nProcessing Flash player URL: {popup_url}")
            parsed = urlparse(popup_url)
            params = parse_qs(parsed.query)
            show_id = params.get('show', [''])[0]
            archive_id = params.get('archive', [''])[0]
            logger.info(f"Extracted show_id: {show_id}, archive_id: {archive_id}")
            
            # Extract date from the page to construct filename
            logger.info("Fetching Flash player page content...")
            response = requests.get(popup_url)
            
            # Save the raw HTML content for inspection
            debug_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "debug_flashplayer.html")
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(response.text)
            logger.info(f"Saved raw HTML content to: {debug_file}")
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                # Look for the audio source
                audio_source = soup.find('source')
                logger.info(f"Found audio source tag: {audio_source}")
                
                if audio_source and 'src' in audio_source.attrs:
                    rtmp_url = audio_source['src']
                    logger.info(f"Extracted RTMP URL: {rtmp_url}")
                    
                    # Extract filename from RTMP URL (e.g., lm250424.mp4)
                    filename_match = re.search(r'mp4:LM/([^"]+)', rtmp_url)
                    if filename_match:
                        filename = filename_match.group(1)
                        logger.info(f"Extracted filename: {filename}")
                        # Construct S3 URL
                        s3_url = f"https://s3.amazonaws.com/arch.wfmu.org/LM/{filename}"
                        logger.info(f"Constructed S3 URL: {s3_url}")
                        return s3_url
                    else:
                        logger.error("Could not extract filename from RTMP URL")
                else:
                    logger.error("No audio source tag found or missing src attribute")
            else:
                logger.error(f"Failed to fetch Flash player page: {response.status_code}")

        return None
    except Exception as e:
        logger.error(f"Error getting stream URL from archive player: {str(e)}")
        return None

def play_stream(url, title):
    """Play a media stream."""
    try:
        # Create a VLC instance without verbose logging
        instance = vlc.Instance('--quiet')
        
        # Create a media player
        player = instance.media_player_new()
        
        # Create the media
        media = instance.media_new(url)
        
        # Set the media to the player
        player.set_media(media)
        
        # Print info
        print(f"\nAttempting to play: {title}")
        print(f"URL: {url}")
        print("\nControls:")
        print("  q: Quit")
        print("  p: Play/Pause")
        print("  s: Stop")
        
        # Start playing
        player.play()
        
        # Wait a bit to check if playback started
        time.sleep(2)
        
        # Main control loop
        while True:
            # Get user input without blocking
            if sys.stdin in select.select([sys.stdin], [], [], 0)[0]:
                cmd = sys.stdin.read(1)
                
                if cmd == 'q':
                    print("\nQuitting...")
                    player.stop()
                    break
                elif cmd == 'p':
                    if player.is_playing():
                        player.pause()
                        print("Paused")
                    else:
                        player.play()
                        print("Playing")
                elif cmd == 's':
                    player.stop()
                    print("Stopped")
            
            # Check if media is playing
            state = player.get_state()
            if state == vlc.State.Error:
                print("\nError playing stream.")
                break
            
            # Sleep a bit to prevent high CPU usage
            time.sleep(0.1)
            
    except Exception as e:
        logging.error(f"Error playing stream: {e}")

def main():
    try:
        # Import select here since it's only used in this function
        import select
        
        # Load playlists
        playlists = load_playlists()
        if not playlists:
            print("No playlists found.")
            return
            
        while True:
            # Show available shows
            list_shows(playlists)
            
            # Get user choice
            try:
                choice = input("\nEnter show number (or 'q' to quit): ")
                if choice.lower() == 'q':
                    break
                    
                idx = int(choice) - 1
                if 0 <= idx < len(playlists):
                    show = playlists[idx]
                    
                    # Try to get direct S3 URL first
                    stream_url = get_stream_url_from_flashplayer(show['popup_listen_url'])
                    
                    if not stream_url:
                        # Try to get MP3 URL from M3U file as fallback
                        stream_url = get_mp3_url_from_m3u(show['m3u_url'])
                    
                    if not stream_url:
                        print("No playable URL found for this show.")
                        continue
                    
                    # Play the stream
                    play_stream(stream_url, f"{show['date']} - {show['title']}")
                else:
                    print("Invalid show number.")
            except ValueError:
                print("Please enter a valid number.")
            except KeyboardInterrupt:
                print("\nQuitting...")
                break
                
    except Exception as e:
        logging.error(f"Error in main: {e}")

if __name__ == "__main__":
    main() 