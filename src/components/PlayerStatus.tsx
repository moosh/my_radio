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
}

export const PlayerStatus: React.FC<PlayerStatusProps> = ({ 
  currentStation, 
  audioElement,
  onPlayPause 
}) => {
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

  // Clear metadata when no station is playing
  useEffect(() => {
    if (!currentStation) {
      setMetadata({});
    }
  }, [currentStation]);

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
              {currentStation 
                ? `Now Playing: ${currentStation.title}`
                : 'Ready to Play'
              }
            </Typography>
            {currentStation && onPlayPause && (
              <IconButton
                onClick={() => onPlayPause(currentStation.id)}
                size="small"
                sx={{
                  color: 'primary.main',
                  p: 0.5,
                  mb: 1
                }}
              >
                {audioElement?.paused ? (
                  <PlayIcon sx={{ fontSize: 20 }} />
                ) : (
                  <PauseIcon sx={{ fontSize: 20 }} />
                )}
              </IconButton>
            )}
          </Box>
          
          {currentStation ? (
            <>
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
            </>
          ) : (
            <Typography variant="body1" color="text.secondary">
              Select a station to start listening
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}; 