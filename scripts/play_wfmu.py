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
        # Convert flashplayer URL to archive player URL if needed
        if 'flashplayer.php' in popup_url:
            parsed = urlparse(popup_url)
            params = parse_qs(parsed.query)
            show_id = params.get('show', [''])[0]
            archive_id = params.get('archive', [''])[0]
            if show_id and archive_id:
                popup_url = f"https://www.wfmu.org/archiveplayer/?show={show_id}&archive={archive_id}"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.wfmu.org/'
        }
        response = requests.get(popup_url, headers=headers)
        logger.info(f"Archive player response: {response.text[:1000]}...")  # Log first 1000 chars
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Try different potential sources for the stream URL
            sources = []
            
            # Check textarea elements (sometimes contains stream URL)
            for textarea in soup.find_all('textarea'):
                if textarea.string and ('http://' in textarea.string or 'https://' in textarea.string):
                    sources.append(textarea.string.strip())
            
            # Check source elements
            for source in soup.find_all(['source', 'audio', 'video']):
                if source.get('src'):
                    sources.append(source['src'])
                if source.get('data-url'):
                    sources.append(source['data-url'])
            
            # Return first valid URL found
            for url in sources:
                if url.startswith(('http://', 'https://', 'rtmp://', 'rtmpt://')):
                    return url.strip()
                    
        return None
    except Exception as e:
        logger.error(f"Error getting stream URL from archive player: {str(e)}")
        return None

def play_rtmp_stream(url, title):
    """Play an RTMP stream using ffmpeg and VLC."""
    try:
        # Create a temporary file for the stream
        temp_file = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
        temp_file.close()
        
        logger.info(f"\nAttempting to play: {title}")
        logger.info(f"URL: {url}")
        
        # Construct ffmpeg command with more detailed options
        ffmpeg_cmd = [
            'ffmpeg',
            '-v', 'debug',  # Verbose debug output
            '-rtmp_live', 'live',  # Specify RTMP live mode
            '-i', url,
            '-c', 'copy',  # Copy streams without re-encoding
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov',  # Enable streaming-friendly MP4
            temp_file.name
        ]
        
        logger.info(f"Running ffmpeg command: {' '.join(ffmpeg_cmd)}")
        
        # Start ffmpeg process
        print("\nStarting ffmpeg to process RTMP stream...")
        ffmpeg_process = subprocess.Popen(
            ffmpeg_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True
        )
        
        # Wait a bit for ffmpeg to start processing
        time.sleep(2)
        
        # Create a VLC instance
        instance = vlc.Instance()
        player = instance.media_player_new()
        media = instance.media_new(temp_file.name)
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
        
        try:
            # Main control loop
            while True:
                # Get user input without blocking
                if sys.stdin in select.select([sys.stdin], [], [], 0)[0]:
                    cmd = sys.stdin.read(1)
                    
                    if cmd == 'q':
                        print("\nQuitting...")
                        player.stop()
                        ffmpeg_process.terminate()
                        os.unlink(temp_file.name)
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
                
        finally:
            # Clean up
            player.stop()
            ffmpeg_process.terminate()
            try:
                os.unlink(temp_file.name)
            except:
                pass
            
    except Exception as e:
        logger.error(f"Error playing stream: {str(e)}")
        if 'ffmpeg_process' in locals():
            ffmpeg_process.terminate()
        if 'temp_file' in locals():
            os.unlink(temp_file.name)

def play_stream(url, title):
    """Play a media stream."""
    if is_rtmp_url(url):
        play_rtmp_stream(url, title)
    else:
        try:
            # Create a VLC instance with logging
            instance = vlc.Instance('--verbose=2')
            
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
        # First make sure VLC is installed
        import vlc
    except ImportError:
        print("Error: python-vlc is not installed.")
        print("Please install it with: pip install python-vlc")
        print("Note: You also need VLC media player installed on your system.")
        return
        
    # Check if ffmpeg is installed
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: ffmpeg is not installed.")
        print("Please install it with: brew install ffmpeg")
        return

    # Load playlists
    playlists = load_playlists()
    if not playlists:
        print("No playlists found. Please run scrape_wfmu.py first.")
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
                
                # Try to get stream URL from Flash player first
                stream_url = get_stream_url_from_flashplayer(show['popup_listen_url'])
                if not stream_url:
                    # Try to get MP3 URL from M3U file as fallback
                    stream_url = get_mp3_url_from_m3u(show['m3u_url'])
                
                if not stream_url:
                    # Use RTMP URL as last resort
                    stream_url = show['direct_media_url']
                
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

if __name__ == "__main__":
    import select
    main() 