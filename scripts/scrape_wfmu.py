#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime
import os
from urllib.parse import urlparse, parse_qs

def get_media_url_from_flashplayer(popup_url):
    """Extract the direct media URL from the flashplayer.php page."""
    if not popup_url:
        return ""
        
    try:
        response = requests.get(popup_url)
        response.raise_for_status()
        
        # Find the playlist-data textarea
        soup = BeautifulSoup(response.text, 'html.parser')
        playlist_data = soup.find('textarea', {'id': 'playlist-data'})
        
        if not playlist_data:
            return ""
            
        # Parse the JSON data
        try:
            data = json.loads(playlist_data.string.strip())
            if data and 'audio' in data and '@attributes' in data['audio']:
                return data['audio']['@attributes']['url']
        except json.JSONDecodeError:
            pass
            
    except Exception as e:
        print(f"Error fetching flashplayer page {popup_url}: {e}")
        
    return ""

def construct_m3u_url(popup_url):
    """Construct M3U URL from popup player URL by extracting show and archive IDs."""
    if not popup_url:
        return ""
        
    try:
        # Parse the URL and get query parameters
        parsed = urlparse(popup_url)
        params = parse_qs(parsed.query)
        
        # Extract show and archive IDs
        show_id = params.get('show', [''])[0]
        archive_id = params.get('archive', [''])[0]
        
        if show_id and archive_id:
            return f"https://www.wfmu.org/listen.m3u?show={show_id}&archive={archive_id}"
    except Exception:
        pass
        
    return ""

def get_mp3_url_from_m3u(m3u_url):
    """Download and parse M3U file to get the actual MP3 stream URL."""
    if not m3u_url:
        return ""
        
    try:
        response = requests.get(m3u_url, timeout=10)
        response.raise_for_status()
        
        # M3U files are typically plain text with one URL per line
        # We'll take the first non-empty, non-comment line
        for line in response.text.splitlines():
            line = line.strip()
            if line and not line.startswith('#'):
                return line
    except Exception as e:
        print(f"Error fetching M3U file {m3u_url}: {e}")
        
    return ""

def scrape_wfmu_playlists():
    # URL to scrape
    url = "https://www.wfmu.org/playlists/LM"
    
    try:
        # Download the webpage
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for bad status codes
        
        # Parse the HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all list items that contain playlist entries
        playlist_items = []
        
        # Regular expression to match the date and title format
        date_pattern = re.compile(r'([A-Za-z]+ \d+,? (\d{4}))')
        
        for li in soup.find_all('li'):
            text = li.get_text(strip=True)
            
            # Skip if this doesn't look like a playlist entry
            if not date_pattern.search(text):
                continue
                
            # Extract the date and title
            date_match = date_pattern.search(text)
            if not date_match:
                continue
                
            date_str = date_match.group(1)
            year = int(date_match.group(2))
            
            # Stop processing if we hit 2024 or earlier
            if year <= 2024:
                break
            
            # Find the title (usually in bold)
            title = ""
            bold = li.find('b')
            if bold:
                title = bold.get_text(strip=True)
            
            # Find the playlist link and listen URLs
            playlist_link = ""
            m3u_url = ""
            popup_listen_url = ""
            
            # Find all links in the list item
            links = li.find_all('a')
            for link in links:
                href = link.get('href', '')
                text = link.get_text(strip=True)
                
                if "See the playlist" in text:
                    playlist_link = "https://www.wfmu.org" + href
                elif text == "MP3 - 128K" and href.endswith('.m3u'):
                    m3u_url = "https://www.wfmu.org" + href
                elif "Pop-up" in text and 'flashplayer.php' in href:
                    popup_listen_url = "https://www.wfmu.org" + href
            
            # If no M3U URL is available but we have a popup URL, construct the M3U URL
            if not m3u_url and popup_listen_url:
                m3u_url = construct_m3u_url(popup_listen_url)
            
            # Get the actual MP3 URL from the M3U file
            mp3_listen_url = get_mp3_url_from_m3u(m3u_url)
            
            # Get the direct media URL from the flashplayer page
            direct_media_url = get_media_url_from_flashplayer(popup_listen_url) if popup_listen_url else ""
            
            # Extract show ID if available
            show_id = ""
            if m3u_url:
                show_id_match = re.search(r'show=(\d+)', m3u_url)
                if show_id_match:
                    show_id = show_id_match.group(1)
            
            # Create playlist entry
            entry = {
                "date": date_str,
                "title": title,
                "show_id": show_id,
                "playlist_link": playlist_link,
                "m3u_url": m3u_url,
                "mp3_listen_url": mp3_listen_url,
                "popup_listen_url": popup_listen_url,
                "direct_media_url": direct_media_url,
                "raw_text": text
            }
            
            playlist_items.append(entry)
        
        # Save to JSON file
        output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "wfmu_playlists.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({
                "last_updated": datetime.now().isoformat(),
                "source_url": url,
                "playlists": playlist_items
            }, f, indent=2, ensure_ascii=False)
            
        print(f"Successfully scraped {len(playlist_items)} playlist entries from 2025")
        print(f"Data saved to: {output_path}")
        
    except requests.RequestException as e:
        print(f"Error downloading webpage: {e}")
    except Exception as e:
        print(f"Error processing data: {e}")

if __name__ == "__main__":
    scrape_wfmu_playlists() 