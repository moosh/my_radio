import { Draggable } from 'react-beautiful-dnd';
import { Card, CardContent, Typography, Box, IconButton, CircularProgress, Tooltip } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, DragIndicator as DragIndicatorIcon, PlayArrow as PlayIcon, Pause as PauseIcon } from '@mui/icons-material';
import { Station, DayPlayStats } from '../types/Station';
import { useEffect, useRef, useState } from 'react';

interface UrlListItemProps {
  item: Station;
  index: number;
  onDelete: (id: string) => void;
  onEdit: (item: Station) => void;
  isPlaying: boolean;
  onPlayPause: (stationId: string) => void;
  onUpdatePlayStats: (stationId: string, playStats: DayPlayStats[]) => void;
}

export function UrlListItem({ item, index, onDelete, onEdit, isPlaying, onPlayPause, onUpdatePlayStats }: UrlListItemProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Function to parse M3U file and get the actual stream URL
  const parseM3UFile = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const lines = text.split('\n');
      
      // Find the first non-empty line that doesn't start with # (which is the actual stream URL)
      const streamLine = lines.find(line => line.trim() && !line.trim().startsWith('#'));
      return streamLine ? streamLine.trim() : null;
    } catch (error) {
      console.error('Error parsing M3U file:', error);
      return null;
    }
  };

  // Function to get play count for a specific day
  const getPlayCount = (dayIndex: number) => {
    return item.playStats?.find(stat => stat.day === dayIndex)?.playCount || 0;
  };

  // Function to calculate opacity based on play count using logarithmic scale
  const getOpacity = (playCount: number) => {
    const maxOpacity = 0.9; // Maximum opacity
    const baseOpacity = 0.1; // Starting opacity for 1 play
    const maxPlays = 100; // Number of plays for max opacity
    
    if (playCount === 0) return 0;
    
    // Use logarithmic scale for smoother progression
    const logScale = Math.log10(playCount + 1) / Math.log10(maxPlays + 1);
    return Math.min(baseOpacity + (maxOpacity - baseOpacity) * logScale, maxOpacity);
  };

  // Function to update play count for current day
  const updatePlayCount = () => {
    const today = new Date().getDay();
    const currentPlayStats = item.playStats || [];
    const existingStat = currentPlayStats.find(stat => stat.day === today);
    
    let newPlayStats: DayPlayStats[];
    if (existingStat) {
      newPlayStats = currentPlayStats.map(stat =>
        stat.day === today ? { ...stat, playCount: stat.playCount + 1 } : stat
      );
    } else {
      newPlayStats = [...currentPlayStats, { day: today, playCount: 1 }];
    }
    
    onUpdatePlayStats(item.id, newPlayStats);
  };

  // Handle play/pause and audio element lifecycle
  useEffect(() => {
    const setupAudio = async () => {
      if (isPlaying) {
        try {
          let finalUrl = item.url;
          
          // If URL ends with .m3u, parse it to get the actual stream URL
          if (item.url.toLowerCase().endsWith('.m3u')) {
            setIsLoading(true);
            const parsedUrl = await parseM3UFile(item.url);
            if (!parsedUrl) {
              throw new Error('Could not parse M3U file');
            }
            finalUrl = parsedUrl;
          }

          if (!audioRef.current) {
            console.log(`Creating new audio element for ${item.title}`);
            audioRef.current = new Audio(finalUrl);
            
            audioRef.current.addEventListener('error', (e) => {
              console.error(`Audio error for ${item.url}:`, e);
              setIsLoading(false);
            });
            
            audioRef.current.addEventListener('canplaythrough', () => {
              console.log(`Audio ready to play for ${item.title}`);
              setIsLoading(false);
              // Update play count when playback starts successfully
              updatePlayCount();
            });
          }

          console.log(`Starting playback for ${item.title}`);
          setIsLoading(true);
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log(`Successfully started playing ${item.title}`);
                setIsLoading(false);
              })
              .catch(error => {
                console.error(`Error playing ${item.url}:`, error);
                setIsLoading(false);
              });
          }
        } catch (error) {
          console.error(`Error setting up audio for ${item.url}:`, error);
          setIsLoading(false);
        }
      } else {
        if (audioRef.current) {
          console.log(`Stopping and cleaning up audio for ${item.title}`);
          audioRef.current.pause();
          audioRef.current = null;
          setIsLoading(false);
        }
      }
    };

    setupAudio();

    return () => {
      if (audioRef.current) {
        console.log(`Component unmounting, cleaning up audio for ${item.title}`);
        audioRef.current.pause();
        audioRef.current = null;
        setIsLoading(false);
      }
    };
  }, [isPlaying, item.url, item.title]);

  const handlePlayPause = () => {
    console.log(`Play/Pause button clicked for ${item.title}`);
    onPlayPause(item.id);
  };

  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          sx={{
            mb: 0.5,
            backgroundColor: snapshot.isDragging ? '#2D2D2D' : '#1E1E1E',
            '&:hover': {
              backgroundColor: '#2D2D2D'
            }
          }}
        >
          <CardContent sx={{ py: 0.5, px: 1, display: 'flex', alignItems: 'center', gap: 0.5, height: '32px' }}>
            <IconButton
              {...provided.dragHandleProps}
              size="small"
              sx={{ color: 'text.secondary', p: 0.5, minWidth: 24, height: 24 }}
            >
              <DragIndicatorIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" noWrap sx={{ fontSize: '0.875rem', minWidth: '120px' }}>
                {item.title}
              </Typography>
              {item.description && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.75rem', flex: 1 }}>
                  {item.description}
                </Typography>
              )}
              {item.tags && item.tags.length > 0 && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.75rem', minWidth: '100px' }}>
                  {item.tags.join(', ')}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
              <IconButton 
                size="small" 
                onClick={handlePlayPause}
                disabled={isLoading}
                sx={{ 
                  color: isPlaying ? 'primary.main' : 'text.secondary',
                  position: 'relative',
                  p: 0.5,
                  minWidth: 24,
                  height: 24
                }}
              >
                {isLoading ? (
                  <CircularProgress 
                    size={16} 
                    sx={{ 
                      position: 'absolute',
                      color: 'primary.main'
                    }}
                  />
                ) : isPlaying ? (
                  <PauseIcon sx={{ fontSize: 16 }} />
                ) : (
                  <PlayIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
              <Tooltip title="Edit">
                <IconButton 
                  size="small" 
                  onClick={() => onEdit(item)}
                  sx={{ color: 'text.secondary', p: 0.5, minWidth: 24, height: 24 }}
                >
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton 
                  size="small" 
                  onClick={() => onDelete(item.id)}
                  sx={{ color: 'text.secondary', p: 0.5, minWidth: 24, height: 24 }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Box sx={{ 
                display: 'flex', 
                gap: 0.5, 
                ml: 1, 
                pl: 1, 
                borderLeft: '1px solid',
                borderColor: 'divider',
                alignItems: 'center'
              }}>
                {['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'].map((day, index) => {
                  const playCount = getPlayCount(index);
                  const opacity = getOpacity(playCount);
                  
                  return (
                    <Box key={`${day}-${index}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                        {day}
                      </Typography>
                      <Tooltip title={`Played ${playCount} time${playCount !== 1 ? 's' : ''}`}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: 0.5,
                            bgcolor: 'action.hover',
                            position: 'relative',
                            '&::after': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              borderRadius: 'inherit',
                              bgcolor: 'primary.main',
                              opacity: opacity,
                              transition: 'opacity 0.2s'
                            }
                          }}
                        />
                      </Tooltip>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
} 