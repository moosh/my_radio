import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Station } from '../types/Station';

interface PlayerStatusProps {
  currentStation: Station | null;
  audioElement: HTMLAudioElement | null;
}

interface StreamMetadata {
  title?: string;
  artist?: string;
  name?: string;
  bitrate?: string;
  genre?: string;
  description?: string;
}

export const PlayerStatus: React.FC<PlayerStatusProps> = ({ currentStation, audioElement }) => {
  const [metadata, setMetadata] = useState<StreamMetadata>({});

  useEffect(() => {
    if (!audioElement) return;

    const handleMetadata = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      
      // Try to get metadata from MediaSession API
      if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
        const { title, artist } = navigator.mediaSession.metadata;
        setMetadata(prev => ({
          ...prev,
          title: title || prev.title,
          artist: artist || prev.artist
        }));
      }
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

    audioElement.addEventListener('loadedmetadata', handleMetadata);
    audioElement.addEventListener('play', fetchIcyMetadata);

    // Initial metadata check
    fetchIcyMetadata();

    return () => {
      audioElement.removeEventListener('loadedmetadata', handleMetadata);
      audioElement.removeEventListener('play', fetchIcyMetadata);
    };
  }, [audioElement]);

  if (!currentStation) return null;

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
          Now Playing: {currentStation.title}
        </Typography>
        
        {metadata.artist || metadata.title ? (
          <Typography variant="body1" color="text.secondary">
            {metadata.artist && `Artist: ${metadata.artist}`}
            {metadata.artist && metadata.title && ' • '}
            {metadata.title && `Title: ${metadata.title}`}
          </Typography>
        ) : (
          <Typography variant="body1" color="text.secondary">
            {metadata.description || currentStation.description || 'No metadata available'}
          </Typography>
        )}

        {(metadata.name || metadata.bitrate || metadata.genre) && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {metadata.name && `Station: ${metadata.name}`}
            {metadata.name && (metadata.bitrate || metadata.genre) && ' • '}
            {metadata.bitrate && `Quality: ${metadata.bitrate}kbps`}
            {metadata.bitrate && metadata.genre && ' • '}
            {metadata.genre && `Genre: ${metadata.genre}`}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}; 