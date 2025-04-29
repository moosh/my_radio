import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  IconButton, 
  Collapse, 
  List, 
  ListItem, 
  ListItemText,
  Box,
  Link,
  Tooltip
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';

interface Show {
  description: string;
  url: string;
}

interface PlaylistStationCardProps {
  playlistUrl: string;
  shows: Show[];
  onAddShow: (show: Show) => void;
  onPreviewShow: (url: string) => void;
}

export const PlaylistStationCard = ({ 
  playlistUrl, 
  shows, 
  onAddShow,
  onPreviewShow
}: PlaylistStationCardProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ 
      mb: 2,
      bgcolor: 'background.paper',
      '&:hover': {
        bgcolor: 'action.hover'
      }
    }}>
      <CardContent>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: expanded ? 2 : 0
        }}>
          <Box>
            <Typography variant="h6" component="div">
              Playlist Shows
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {playlistUrl}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {shows.length} shows found
            </Typography>
          </Box>
          <IconButton
            onClick={() => setExpanded(!expanded)}
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s'
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          <List sx={{ 
            width: '100%',
            bgcolor: 'background.paper',
            borderRadius: 1,
            mt: 1
          }}>
            {shows.map((show, index) => (
              <ListItem
                key={index}
                sx={{
                  borderBottom: index < shows.length - 1 ? '1px solid rgba(255, 255, 255, 0.12)' : 'none',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
                secondaryAction={
                  <Box>
                    <Tooltip title="Preview">
                      <IconButton 
                        edge="end" 
                        onClick={() => onPreviewShow(show.url)}
                        sx={{ mr: 1 }}
                      >
                        <PlayArrowIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Add to stations">
                      <IconButton 
                        edge="end" 
                        onClick={() => onAddShow(show)}
                      >
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemText
                  primary={show.description}
                  secondary={
                    <Link 
                      href={show.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      color="inherit"
                      sx={{ 
                        opacity: 0.7,
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline'
                        }
                      }}
                    >
                      {show.url}
                    </Link>
                  }
                  sx={{ pr: 8 }}
                />
              </ListItem>
            ))}
          </List>
        </Collapse>
      </CardContent>
    </Card>
  );
}; 