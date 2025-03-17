import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Card, CardContent, Typography, Chip, Box, IconButton } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, DragIndicator as DragIndicatorIcon } from '@mui/icons-material';
import { UrlItem } from '../types/UrlItem';

interface UrlListItemProps {
  item: UrlItem;
  index: number;
  onDelete: (id: string) => void;
  onEdit: (item: UrlItem) => void;
}

export const UrlListItem: React.FC<UrlListItemProps> = ({ item, index, onDelete, onEdit }) => {
  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          sx={{ mb: 1, '&:hover': { boxShadow: 6 } }}
        >
          <CardContent sx={{ py: 0.5, px: 2 }}>
            <Box display="flex" alignItems="center" gap={2}>
              <IconButton size="small" {...provided.dragHandleProps}>
                <DragIndicatorIcon />
              </IconButton>
              <Typography 
                variant="subtitle1" 
                component="a" 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                sx={{ 
                  textDecoration: 'none',
                  minWidth: '150px',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {item.tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" sx={{ height: 20 }} />
                ))}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <audio
                  controls
                  style={{ width: '100%', height: '32px' }}
                  src={item.url}
                  preload="none"
                >
                  Your browser does not support the audio element.
                </audio>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" onClick={() => onEdit(item)}>
                  <EditIcon />
                </IconButton>
                <IconButton size="small" onClick={() => onDelete(item.id)}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
}; 