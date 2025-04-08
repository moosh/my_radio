import { Draggable } from 'react-beautiful-dnd';
import { Card, CardContent, Typography, Box, IconButton, CircularProgress, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, ListItemSecondaryAction } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, DragIndicator as DragIndicatorIcon, PlayArrow as PlayIcon, Pause as PauseIcon, ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { Station } from '../types/Station';
import { useState } from 'react';
import { alpha } from '@mui/material/styles';

interface RadioBrowserStation {
  name: string;
  url: string;
  favicon: string;
  tags: string;
  country: string;
  language: string;
  codec: string;
  bitrate: number;
  geo_lat: number;
  geo_long: number;
}

interface UrlListItemProps {
  item: Station;
  index: number;
  onDelete: (id: string) => void;
  onEdit: (item: Station) => void;
  isPlaying: boolean;
  onPlayPause: (stationId: string) => void;
  onUpdatePlayStats: (stationId: string, playStats: any[]) => void;
}

export function UrlListItem({ item, index, onDelete, onEdit, isPlaying, onPlayPause }: UrlListItemProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternativeStations, setAlternativeStations] = useState<RadioBrowserStation[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Function to search for alternative stations
  const searchAlternativeStations = async () => {
    setSearchLoading(true);
    try {
      // Get a random server from Radio Browser API
      const serversResponse = await fetch('https://all.api.radio-browser.info/json/servers');
      const servers = await serversResponse.json();
      const server = servers[Math.floor(Math.random() * servers.length)].name;

      // Search for stations with similar name
      const searchUrl = `https://${server}/json/stations/search?name=${encodeURIComponent(item.title)}&limit=10`;
      const response = await fetch(searchUrl);
      const stations = await response.json();

      // Also search by tags if available
      let tagStations: RadioBrowserStation[] = [];
      if (item.tags && item.tags.length > 0) {
        const tagSearchUrl = `https://${server}/json/stations/search?tagList=${encodeURIComponent(item.tags.join(','))}&limit=10`;
        const tagResponse = await fetch(tagSearchUrl);
        tagStations = await tagResponse.json();
      }

      // Combine and deduplicate results
      const allStations = [...stations, ...tagStations];
      const uniqueStations = Array.from(new Map(allStations.map(s => [s.url, s])).values());
      
      setAlternativeStations(uniqueStations);
    } catch (error) {
      console.error('Error searching for alternative stations:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle clicking the error icon
  const handleErrorClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setShowAlternatives(true);
    searchAlternativeStations();
  };

  // Handle selecting an alternative station
  const handleSelectAlternative = (station: RadioBrowserStation) => {
    onEdit({
      ...item,
      url: station.url,
      description: `${station.country} - ${station.language}${station.bitrate ? ` - ${station.bitrate}kbps` : ''}`,
      tags: station.tags.split(',').map(tag => tag.trim()),
      lastFailedAt: undefined
    });
    setShowAlternatives(false);
  };

  const handlePlayPause = () => {
    console.log(`Play/Pause button clicked for ${item.title}`);
    onPlayPause(item.id);
  };

  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided) => (
        <>
          <Card
            ref={provided.innerRef}
            {...provided.draggableProps}
            sx={{
              mb: 0.5,
              bgcolor: theme => item.lastFailedAt ? alpha(theme.palette.error.main, 0.1) : 'background.paper',
              transition: 'background-color 0.2s ease',
              '&:hover': {
                bgcolor: theme => item.lastFailedAt 
                  ? alpha(theme.palette.error.main, 0.15)
                  : alpha(theme.palette.action.hover, 0.1)
              },
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: '120px' }}>
                  <Typography variant="body2" noWrap sx={{ fontSize: '0.875rem' }}>
                    {item.title}
                  </Typography>
                  {item.lastFailedAt && (
                    <Tooltip title={`Failed to load at ${new Date(item.lastFailedAt).toLocaleString()}. Click to find alternatives.`}>
                      <IconButton
                        size="small"
                        onClick={handleErrorClick}
                        sx={{ 
                          p: 0,
                          color: 'error.main',
                          animation: 'pulse 2s infinite',
                          '@keyframes pulse': {
                            '0%': { opacity: 0.6 },
                            '50%': { opacity: 1 },
                            '100%': { opacity: 0.6 }
                          }
                        }}
                      >
                        <ErrorIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
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
                  sx={{ 
                    color: isPlaying ? 'primary.main' : 'text.secondary',
                    position: 'relative',
                    p: 0.5,
                    minWidth: 24,
                    height: 24
                  }}
                >
                  {isPlaying ? (
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
                    const playCount = item.playStats?.find(stat => stat.day === index)?.playCount || 0;
                    // Calculate opacity using logarithmic scale
                    const opacity = playCount === 0 ? 0 : Math.min(0.1 + (0.8 * Math.log10(playCount + 1) / Math.log10(100)), 0.9);
                    
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

          <Dialog 
            open={showAlternatives} 
            onClose={() => setShowAlternatives(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              Alternative Stations for {item.title}
              {searchLoading && (
                <CircularProgress 
                  size={20} 
                  sx={{ ml: 2 }}
                />
              )}
            </DialogTitle>
            <DialogContent>
              {alternativeStations.length > 0 ? (
                <List>
                  {alternativeStations.map((station) => (
                    <ListItem 
                      key={station.url}
                      sx={{
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <ListItemText
                        primary={station.name}
                        secondary={
                          <>
                            {station.country} - {station.language}
                            {station.bitrate && ` - ${station.bitrate}kbps`}
                            {station.tags && <Box sx={{ mt: 0.5 }}>Tags: {station.tags}</Box>}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Button
                          startIcon={<RefreshIcon />}
                          onClick={() => handleSelectAlternative(station)}
                          size="small"
                        >
                          Use This
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : !searchLoading ? (
                <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No alternative stations found
                </Typography>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowAlternatives(false)}>
                Close
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Draggable>
  );
} 