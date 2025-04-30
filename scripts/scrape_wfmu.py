#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime
import os
from urllib.parse import urlparse, parse_qs

def construct_mp3_url(popup_url):
    """Construct MP3 URL from popup player URL by extracting show and archive IDs."""
    if not popup_url:
        return ""
        
    # Parse the URL and get query parameters
    parsed = urlparse(popup_url)
    params = parse_qs(parsed.query)
    
    # Extract show and archive IDs
    show_id = params.get('show', [''])[0]
    archive_id = params.get('archive', [''])[0]
    
    if show_id and archive_id:
        return f"https://www.wfmu.org/listen.m3u?show={show_id}&archive={archive_id}"
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
        date_pattern = re.compile(r'([A-Za-z]+ \d+,? \d{4})')
        
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
            
            # Find the title (usually in bold)
            title = ""
            bold = li.find('b')
            if bold:
                title = bold.get_text(strip=True)
            
            # Find the playlist link and listen URLs
            playlist_link = ""
            mp3_listen_url = ""
            popup_listen_url = ""
            
            # Find all links in the list item
            links = li.find_all('a')
            for link in links:
                href = link.get('href', '')
                text = link.get_text(strip=True)
                
                if "See the playlist" in text:
                    playlist_link = "https://www.wfmu.org" + href
                elif text == "MP3 - 128K" and href.endswith('.m3u'):
                    mp3_listen_url = "https://www.wfmu.org" + href
                elif "Pop-up" in text and 'flashplayer.php' in href:
                    popup_listen_url = "https://www.wfmu.org" + href
            
            # If no MP3 URL is available but we have a popup URL, construct the MP3 URL
            if not mp3_listen_url and popup_listen_url:
                mp3_listen_url = construct_mp3_url(popup_listen_url)
            
            # Extract show ID if available
            show_id = ""
            if mp3_listen_url:
                show_id_match = re.search(r'show=(\d+)', mp3_listen_url)
                if show_id_match:
                    show_id = show_id_match.group(1)
            
            # Create playlist entry
            entry = {
                "date": date_str,
                "title": title,
                "show_id": show_id,
                "playlist_link": playlist_link,
                "mp3_listen_url": mp3_listen_url,
                "popup_listen_url": popup_listen_url,
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
            
        print(f"Successfully scraped {len(playlist_items)} playlist entries")
        print(f"Data saved to: {output_path}")
        
    except requests.RequestException as e:
        print(f"Error downloading webpage: {e}")
    except Exception as e:
        print(f"Error processing data: {e}")

if __name__ == "__main__":
    scrape_wfmu_playlists() 