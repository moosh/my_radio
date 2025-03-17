import { Draggable } from 'react-beautiful-dnd';
import { Card, CardContent, Typography, Box, IconButton } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, DragIndicator as DragIndicatorIcon, PlayArrow as PlayIcon } from '@mui/icons-material';
import { Station } from '../types/Station';
import { useState } from 'react';

interface UrlListItemProps {
  item: Station;
  index: number;
  onDelete: (id: string) => void;
  onEdit: (item: Station) => void;
}

export function UrlListItem({ item, index, onDelete, onEdit }: UrlListItemProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(new Audio(item.url));

  const handlePlayPause = () => {
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          sx={{
            mb: 1,
            backgroundColor: snapshot.isDragging ? 'action.hover' : 'background.paper',
            '&:hover': {
              backgroundColor: 'action.hover'
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
              color={isPlaying ? "primary" : "default"}
            >
              <PlayIcon />
            </IconButton>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton size="small" onClick={() => onEdit(item)}>
                <EditIcon />
              </IconButton>
              <IconButton size="small" onClick={() => onDelete(item.id)}>
                <DeleteIcon />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
} 