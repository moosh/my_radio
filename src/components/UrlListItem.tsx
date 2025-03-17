import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Card, CardContent, Typography, Chip, Box, IconButton } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
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
          {...provided.dragHandleProps}
          sx={{ mb: 2, '&:hover': { boxShadow: 6 } }}
        >
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box flex={1}>
                <Typography variant="h6" component="a" href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {item.description}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {item.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Added: {new Date(item.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
              <Box>
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