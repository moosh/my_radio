#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
import json
import os

def check_flashplayer():
    # Example URL from the playlists
    url = "https://www.wfmu.org/flashplayer.php?version=3&show=151390&archive=269366"
    
    try:
        # Download the page
        response = requests.get(url)
        response.raise_for_status()
        
        # Save the raw HTML for inspection
        with open('flashplayer_content.html', 'w', encoding='utf-8') as f:
            f.write(response.text)
            
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for media URLs in various places
        # Look for embed tags
        embeds = soup.find_all('embed')
        print("\nEmbed tags:")
        for embed in embeds:
            print(f"Embed src: {embed.get('src')}")
            print(f"Embed flashvars: {embed.get('flashvars')}")
            
        # Look for object tags
        objects = soup.find_all('object')
        print("\nObject tags:")
        for obj in objects:
            print(f"Object data: {obj.get('data')}")
            # Look for params inside object
            for param in obj.find_all('param'):
                print(f"Param {param.get('name')}: {param.get('value')}")
                
        # Look for audio tags
        audio = soup.find_all('audio')
        print("\nAudio tags:")
        for a in audio:
            print(f"Audio src: {a.get('src')}")
            
        # Look for source tags
        sources = soup.find_all('source')
        print("\nSource tags:")
        for source in sources:
            print(f"Source src: {source.get('src')}")
            
        # Look for all scripts
        scripts = soup.find_all('script')
        print("\nScripts with URLs:")
        for script in scripts:
            text = script.string
            if text and ('http://' in text or 'https://' in text):
                print(f"Script content: {text}")
                
        print("\nRaw response headers:")
        print(response.headers)
        
        print("\nSaved complete HTML to flashplayer_content.html")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_flashplayer() 