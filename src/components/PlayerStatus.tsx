import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, IconButton } from '@mui/material';
import { PlayArrow as PlayIcon, Pause as PauseIcon } from '@mui/icons-material';
import { Station } from '../types/Station';

interface PlayerStatusProps {
  currentStation: Station | null;
  audioElement: HTMLAudioElement | null;
  onPlayPause?: (stationId: string) => void;
}

interface StreamMetadata {
  title?: string;
  artist?: string;
  name?: string;
  bitrate?: string;
  genre?: string;
  description?: string;
  url?: string;
  currentSong?: string;
  format?: string;
  channels?: string;
  samplerate?: string;
  public?: string;
  streamTitle?: string;
}

export const PlayerStatus: React.FC<PlayerStatusProps> = ({ 
  currentStation, 
  audioElement,
  onPlayPause 
}) => {
  const [metadata, setMetadata] = useState<StreamMetadata>({});
  const [lastPlayedStation, setLastPlayedStation] = useState<Station | null>(null);

  useEffect(() => {
    if (currentStation) {
      setLastPlayedStation(currentStation);
    }
  }, [currentStation]);

  useEffect(() => {
    if (!audioElement) return;

    const handleMetadata = (e: Event) => {
      // No need to store audio in a variable if we're not using it
      const target = e.target as HTMLAudioElement;
      setMetadata({
        name: target.dataset.icyName,
        bitrate: target.dataset.icyBr,
        genre: target.dataset.icyGenre,
        description: target.dataset.icyDescription
      });
    };

    // Function to fetch ICY metadata using IPC
    const fetchIcyMetadata = async () => {
      if (!audioElement.src || !window.electron) return;
      
      try {
        const streamMetadata = await window.electron.fetchStreamMetadata(audioElement.src);
        if (streamMetadata) {
          setMetadata(prev => ({
            ...prev,
            ...streamMetadata
          }));
        }
      } catch (error) {
        console.warn('Could not fetch stream metadata:', error);
      }
    };

    // Handle metadata updates from main process
    const handleMetadataUpdate = (_event: any, newMetadata: StreamMetadata) => {
      setMetadata(prev => ({
        ...prev,
        ...newMetadata
      }));
    };

    // Listen for metadata updates from main process
    window.electron?.on('metadata-update', handleMetadataUpdate);

    audioElement.addEventListener('loadedmetadata', handleMetadata);
    audioElement.addEventListener('play', fetchIcyMetadata);

    // Initial metadata check
    fetchIcyMetadata();

    return () => {
      audioElement.removeEventListener('loadedmetadata', handleMetadata);
      audioElement.removeEventListener('play', fetchIcyMetadata);
      window.electron?.off('metadata-update', handleMetadataUpdate);
    };
  }, [audioElement]);

  // Parse current song into artist and title if possible
  useEffect(() => {
    if (metadata.currentSong) {
      const parts = metadata.currentSong.split(' - ');
      if (parts.length === 2) {
        setMetadata(prev => ({
          ...prev,
          artist: parts[0].trim(),
          title: parts[1].trim()
        }));
      }
    }
  }, [metadata.currentSong]);

  // Clear metadata when no station is playing but keep last played station
  useEffect(() => {
    if (!currentStation) {
      setMetadata({});
    }
  }, [currentStation]);

  const displayStation = currentStation || lastPlayedStation;

  // Handle play/pause button click
  const handlePlayPauseClick = () => {
    if (!displayStation || !onPlayPause) return;
    
    // If this station is currently playing, pause it
    // If it's not playing, it will automatically stop any other playing station
    onPlayPause(displayStation.id);
  };

  if (!displayStation) {
    return (
      <Paper 
        elevation={3}
        sx={{
          p: 2,
          mb: 2,
          backgroundColor: theme => 
            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
        }}
      >
        <Box>
          <Typography variant="h6" gutterBottom>
            Ready to Play
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Select a station to start listening
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, minHeight: '1.5em' }}>
            &nbsp;
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, minHeight: '1.5em' }}>
            &nbsp;
          </Typography>
        </Box>
      </Paper>
    );
  }

  const isPlaying = currentStation?.id === displayStation.id;

  return (
    <Paper 
      elevation={3}
      sx={{
        p: 2,
        mb: 2,
        backgroundColor: theme => 
          theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" gutterBottom>
              {displayStation.title}
            </Typography>
            {onPlayPause && (
              <IconButton
                onClick={handlePlayPauseClick}
                size="small"
                sx={{
                  color: 'primary.main',
                  p: 0.5,
                  mb: 1
                }}
              >
                {!isPlaying ? (
                  <PlayIcon sx={{ fontSize: 20 }} />
                ) : (
                  <PauseIcon sx={{ fontSize: 20 }} />
                )}
              </IconButton>
            )}
          </Box>
          
          <Typography variant="body1" color="text.secondary">
            {isPlaying && (metadata.artist || metadata.title || metadata.currentSong || metadata.streamTitle) ? (
              metadata.artist && metadata.title ? (
                `${metadata.artist} - ${metadata.title}`
              ) : metadata.currentSong ? (
                metadata.currentSong
              ) : metadata.streamTitle ? (
                metadata.streamTitle
              ) : (
                displayStation.description || 'No description available'
              )
            ) : (
              displayStation.description || 'No description available'
            )}
          </Typography>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, minHeight: '1.5em' }}>
            {isPlaying && (metadata.name || metadata.bitrate || metadata.genre || metadata.format) ? (
              <>
                {metadata.name && `Station: ${metadata.name}`}
                {metadata.name && (metadata.bitrate || metadata.genre || metadata.format) && ' • '}
                {metadata.bitrate && `${metadata.bitrate}kbps`}
                {metadata.bitrate && (metadata.format || metadata.genre) && ' • '}
                {metadata.format && `${metadata.format.split('/')[1]?.toUpperCase() || metadata.format}`}
                {metadata.format && metadata.genre && ' • '}
                {metadata.genre && `Genre: ${metadata.genre}`}
              </>
            ) : (
              '\u00A0'
            )}
          </Typography>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, minHeight: '1.5em' }}>
            {isPlaying && (metadata.channels || metadata.samplerate || metadata.url) ? (
              <>
                {metadata.channels && `${metadata.channels}ch`}
                {metadata.channels && metadata.samplerate && ' • '}
                {metadata.samplerate && `${metadata.samplerate}Hz`}
                {(metadata.channels || metadata.samplerate) && metadata.url && ' • '}
                {metadata.url && (
                  <a 
                    href={metadata.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    Station Website
                  </a>
                )}
              </>
            ) : (
              '\u00A0'
            )}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}; 