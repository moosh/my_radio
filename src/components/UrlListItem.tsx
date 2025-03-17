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
          <CardContent sx={{ py: 1, px: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box flex={1} sx={{ mr: 2 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="subtitle1" component="a" href={item.url} target="_blank" rel="noopener noreferrer" sx={{ textDecoration: 'none' }}>
                    {item.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {item.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" sx={{ height: 20 }} />
                    ))}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    {item.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    • {new Date(item.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box sx={{ mt: 0.5 }}>
                  <audio
                    controls
                    style={{ width: '100%', height: '32px' }}
                    src={item.url}
                    preload="none"
                  >
                    Your browser does not support the audio element.
                  </audio>
                </Box>
              </Box>
              <Box>
                <IconButton size="small" {...provided.dragHandleProps}>
                  <DragIndicatorIcon />
                </IconButton>
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