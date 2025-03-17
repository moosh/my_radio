import { Draggable } from 'react-beautiful-dnd';
import { Card, CardContent, Typography, Box, IconButton, CircularProgress } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, DragIndicator as DragIndicatorIcon, PlayArrow as PlayIcon, Pause as PauseIcon } from '@mui/icons-material';
import { Station } from '../types/Station';
import { useEffect, useRef, useState } from 'react';

interface UrlListItemProps {
  item: Station;
  index: number;
  onDelete: (id: string) => void;
  onEdit: (item: Station) => void;
  isPlaying: boolean;
  onPlayPause: (stationId: string) => void;
}

export function UrlListItem({ item, index, onDelete, onEdit, isPlaying, onPlayPause }: UrlListItemProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle play/pause and audio element lifecycle
  useEffect(() => {
    if (isPlaying) {
      // Create audio element only when starting playback
      if (!audioRef.current) {
        console.log(`Creating new audio element for ${item.title}`);
        audioRef.current = new Audio(item.url);
        
        // Add event listeners
        audioRef.current.addEventListener('error', (e) => {
          console.error(`Audio error for ${item.title}:`, e);
          setIsLoading(false);
        });
        
        audioRef.current.addEventListener('canplaythrough', () => {
          console.log(`Audio ready to play for ${item.title}`);
          setIsLoading(false);
        });
      }

      // Start playback
      console.log(`Starting playback for ${item.title}`);
      setIsLoading(true);
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => console.log(`Successfully started playing ${item.title}`))
          .catch(error => {
            console.error(`Error playing ${item.title}:`, error);
            setIsLoading(false);
          });
      }
    } else {
      // Clean up audio element when stopping
      if (audioRef.current) {
        console.log(`Stopping and cleaning up audio for ${item.title}`);
        audioRef.current.pause();
        audioRef.current = null;
        setIsLoading(false);
      }
    }

    // Cleanup function
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
            mb: 1,
            backgroundColor: snapshot.isDragging ? '#2D2D2D' : '#1E1E1E',
            '&:hover': {
              backgroundColor: '#2D2D2D'
            }
          }}
        >
          <CardContent sx={{ py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              {...provided.dragHandleProps}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <DragIndicatorIcon />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap>
                {item.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {item.description || item.url}
              </Typography>
              {item.tags && item.tags.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {item.tags.join(', ')}
                </Typography>
              )}
            </Box>
            <IconButton 
              size="small" 
              onClick={handlePlayPause}
              disabled={isLoading}
              sx={{ 
                color: isPlaying ? 'primary.main' : 'text.secondary',
                position: 'relative',
                minWidth: 40,
                height: 40
              }}
            >
              {isLoading ? (
                <CircularProgress 
                  size={24} 
                  sx={{ 
                    position: 'absolute',
                    color: 'primary.main'
                  }}
                />
              ) : isPlaying ? (
                <PauseIcon />
              ) : (
                <PlayIcon />
              )}
            </IconButton>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton 
                size="small" 
                onClick={() => onEdit(item)}
                sx={{ color: 'text.secondary' }}
              >
                <EditIcon />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => onDelete(item.id)}
                sx={{ color: 'text.secondary' }}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
} 