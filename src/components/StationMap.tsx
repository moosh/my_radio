import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Station } from '../types/Station';

interface StationMapProps {
  onStationSelect?: (station: Station) => void;
}

interface RadioBrowserStation {
  name: string;
  url: string;
  favicon: string;
  tags: string;
  country: string;
  language: string;
  codec: string;
  bitrate: number;
  geo_lat: number;
  geo_long: number;
}

const StationMap: React.FC<StationMapProps> = ({ onStationSelect }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  useEffect(() => {
    // Initialize audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous'; // Enable CORS
    }
    const audio = audioRef.current;
    
    if (!audio) return;

    const handlePlay = () => {
      console.log('Play event fired');
      if (audio.src) {
        const playingUrl = new URL(audio.src).toString();
        console.log('Setting currently playing to:', playingUrl);
        setCurrentlyPlaying(playingUrl);
        updateAllPopups();
      }
    };

    const handlePause = () => {
      console.log('Pause event fired');
      setCurrentlyPlaying(null);
      updateAllPopups();
    };

    const handleError = (e: Event) => {
      console.error('Audio playback error:', e);
      setCurrentlyPlaying(null);
      updateAllPopups();
    };

    const handlePlaying = () => {
      console.log('Playing event fired');
      if (audio.src) {
        const playingUrl = new URL(audio.src).toString();
        console.log('Setting currently playing to:', playingUrl);
        setCurrentlyPlaying(playingUrl);
        updateAllPopups();
      }
    };

    const handleLoadStart = () => {
      console.log('LoadStart event fired for:', audio.src);
    };

    const handleCanPlay = () => {
      console.log('CanPlay event fired for:', audio.src);
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([20, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current);
      markersRef.current = L.layerGroup().addTo(mapRef.current);
    }

    // Load stations
    fetchStations();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (audio) {
        audio.removeEventListener('loadstart', handleLoadStart);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('playing', handlePlaying);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('error', handleError);
        audio.pause();
      }
    };
  }, []);

  const updateAllPopups = () => {
    if (!markersRef.current) return;
    console.log('Updating all popups, currentlyPlaying:', (window as any).currentlyPlaying);
    
    markersRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        const popup = layer.getPopup();
        if (popup) {
          const content = popup.getContent();
          if (typeof content !== 'string') return;
          
          const match = content.match(/window\.handleStationPlay\('([^']+)'\)/);
          if (!match) return;
          
          try {
            const station: RadioBrowserStation = JSON.parse(decodeURIComponent(match[1]));
            const stationUrl = new URL(station.url).toString();
            console.log('Comparing URLs:', { stationUrl, currentlyPlaying: (window as any).currentlyPlaying });
            const isPlaying = (window as any).currentlyPlaying === stationUrl;
            console.log('Is playing:', isPlaying);
            
            popup.setContent(
              `<div>
                <h3>${station.name}</h3>
                <p>${station.country} - ${station.language}</p>
                <p>${station.tags}</p>
                <p>${station.bitrate}kbps ${station.codec}</p>
                <div style="display: flex; gap: 8px;">
                  <button onclick="window.handleStationPlay('${encodeURIComponent(JSON.stringify(station))}')">
                    ${isPlaying ? 'Stop' : 'Play'}
                  </button>
                  <button onclick="window.addStation('${encodeURIComponent(JSON.stringify(station))}')">
                    Add to My Radio
                  </button>
                </div>
              </div>`
            );
            popup.options.autoClose = false;
            popup.options.closeOnClick = false;
            popup.options.closeButton = true;
          } catch (err) {
            console.error('Failed to parse popup station data:', err);
          }
        }
      }
    });
  };

  const handlePlay = async (stationJson: string) => {
    try {
      const station: RadioBrowserStation = JSON.parse(decodeURIComponent(stationJson));
      const stationUrl = new URL(station.url).toString();
      console.log('handlePlay called with URL:', stationUrl);
      console.log('Current playing:', (window as any).currentlyPlaying);
      
      if ((window as any).currentlyPlaying === stationUrl) {
        // Stop playing
        console.log('Stopping playback');
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = ''; // Clear the source
          setCurrentlyPlaying(null);
          (window as any).currentlyPlaying = null;
        }
      } else {
        // Start playing new station
        if (audioRef.current) {
          console.log('Starting new station');
          // Set initial state immediately for better UX
          setCurrentlyPlaying(stationUrl);
          (window as any).currentlyPlaying = stationUrl;
          
          // Reset the audio element
          audioRef.current.pause();
          audioRef.current.src = stationUrl;
          
          try {
            await audioRef.current.play();
            console.log('Play command issued successfully');
          } catch (err) {
            console.error('Error during play():', err);
            setCurrentlyPlaying(null);
            (window as any).currentlyPlaying = null;
          }
        }
      }
      updateAllPopups();
    } catch (err) {
      console.error('Error playing station:', err);
      setCurrentlyPlaying(null);
      (window as any).currentlyPlaying = null;
      updateAllPopups();
    }
  };

  const fetchStations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get a random API server
      const response = await fetch('https://all.api.radio-browser.info/json/servers');
      const servers = await response.json();
      const server = servers[Math.floor(Math.random() * servers.length)].name;

      // Fetch stations with coordinates
      const stationsResponse = await fetch(
        `https://${server}/json/stations/search?has_geo_info=true&limit=500`
      );
      const stations: RadioBrowserStation[] = await stationsResponse.json();

      // Clear existing markers
      if (markersRef.current) {
        markersRef.current.clearLayers();
      }

      // Add markers for each station
      stations.forEach(station => {
        if (station.geo_lat && station.geo_long && markersRef.current) {
          const stationUrl = new URL(station.url).toString();
          const isPlaying = currentlyPlaying === stationUrl;
          
          const marker = L.marker([station.geo_lat, station.geo_long])
            .bindPopup(
              `<div>
                <h3>${station.name}</h3>
                <p>${station.country} - ${station.language}</p>
                <p>${station.tags}</p>
                <p>${station.bitrate}kbps ${station.codec}</p>
                <div style="display: flex; gap: 8px;">
                  <button onclick="window.handleStationPlay('${encodeURIComponent(JSON.stringify(station))}')">
                    ${isPlaying ? 'Stop' : 'Play'}
                  </button>
                  <button onclick="window.addStation('${encodeURIComponent(JSON.stringify(station))}')">
                    Add to My Radio
                  </button>
                </div>
              </div>`,
              {
                closeButton: true,
                autoClose: false,
                closeOnClick: false
              }
            );
          markersRef.current.addLayer(marker);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stations');
    } finally {
      setLoading(false);
    }
  };

  // Add station to the main app
  const addStation = (stationJson: string) => {
    try {
      const radioStation: RadioBrowserStation = JSON.parse(decodeURIComponent(stationJson));
      const newStation: Station = {
        id: crypto.randomUUID(),
        title: radioStation.name,
        url: radioStation.url,
        description: `${radioStation.country} - ${radioStation.language}`,
        tags: radioStation.tags.split(',').map(tag => tag.trim()),
        createdAt: new Date()
      };
      onStationSelect?.(newStation);
    } catch (err) {
      console.error('Failed to add station:', err);
    }
  };

  // Handle play/pause from popup button
  const handleStationPlay = (stationJson: string) => {
    try {
      handlePlay(stationJson);
    } catch (err) {
      console.error('Failed to play station:', err);
      setCurrentlyPlaying(null);
      (window as any).currentlyPlaying = null;
    }
  };

  // Expose functions to window for the popup buttons
  useEffect(() => {
    (window as any).addStation = addStation;
    (window as any).handleStationPlay = handleStationPlay;
    (window as any).currentlyPlaying = currentlyPlaying;
    return () => {
      delete (window as any).addStation;
      delete (window as any).handleStationPlay;
      delete (window as any).currentlyPlaying;
    };
  }, [currentlyPlaying]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div id="map" style={{ width: '100%', height: '100%' }}></div>
      {loading && (
        <div style={{ 
          position: 'absolute', 
          top: 10, 
          right: 10, 
          background: 'white', 
          padding: '8px', 
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          Loading stations...
        </div>
      )}
      {error && (
        <div style={{ 
          position: 'absolute', 
          top: 10, 
          right: 10, 
          background: '#ff4444', 
          color: 'white',
          padding: '8px', 
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          Error: {error}
        </div>
      )}
      {currentlyPlaying && (
        <div style={{ 
          position: 'absolute', 
          bottom: 10, 
          left: 10, 
          right: 10,
          background: 'rgba(0,0,0,0.8)', 
          color: 'white',
          padding: '12px', 
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Now Playing</span>
          <button onClick={() => handlePlay(JSON.stringify({ url: currentlyPlaying } as RadioBrowserStation))}>
            Stop
          </button>
        </div>
      )}
    </div>
  );
};

export default StationMap; 