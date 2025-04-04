import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { Container, Typography, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, ThemeProvider, createTheme } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { UrlListItem } from './components/UrlListItem';
import { parseStationsFile } from './utils/stationParser';
import { DebugConsole } from './components/DebugConsole';
import { Station } from './types/Station';

// Create dark theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
    primary: {
      main: '#90CAF9',
    },
    secondary: {
      main: '#CE93D8',
    },
    error: {
      main: '#EF5350',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0BEC5',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E1E1E',
          '&:hover': {
            backgroundColor: '#2D2D2D',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1E1E1E',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: '#424242',
            },
            '&:hover fieldset': {
              borderColor: '#616161',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#90CAF9',
            },
          },
        },
      },
    },
  },
});

function App() {
  const [items, setItems] = useState<Station[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Station | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    description: '',
    tags: '',
  });
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [showDebugConsole, setShowDebugConsole] = useState(false);

  // Add keyboard shortcut for toggling debug console
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + D to toggle debug console
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
        setShowDebugConsole(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const addDebugMessage = (message: string) => {
    console.log(message); // Also log to browser console
    setDebugMessages(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  useEffect(() => {
    const loadStations = async () => {
      try {
        addDebugMessage('Starting to load stations...');
        addDebugMessage(`Window electron available: ${!!window.electron}`);
        
        const stations = await parseStationsFile({ log: addDebugMessage });
        addDebugMessage(`Parsed ${stations.length} stations from file`);
        
        if (stations.length === 0) {
          addDebugMessage('No stations found in file');
          return;
        }
        
        addDebugMessage(`First station: ${stations[0].title} (${stations[0].url})`);
        setItems(stations);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        addDebugMessage(`Error loading stations: ${errorMessage}`);
        setError(errorMessage);
      }
    };

    loadStations();
  }, []);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(source.index, 1);
    newItems.splice(destination.index, 0, reorderedItem);

    setItems(newItems);

    // Save the updated order to the stations file
    try {
      addDebugMessage('Saving updated station order...');
      const stationsText = newItems.map(station => `
title: ${station.title}
url: ${station.url}${station.description ? `\ndescription: ${station.description}` : ''}${station.tags && station.tags.length > 0 ? `\ntags: ${station.tags.join(', ')}` : ''}
`).join('\n');

      if (window.electron) {
        const success = await window.electron.saveStationsData(stationsText);
        if (success) {
          addDebugMessage('Successfully saved station order');
        } else {
          addDebugMessage('Failed to save station order');
        }
      } else {
        addDebugMessage('Electron API not available, cannot save station order');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addDebugMessage(`Error saving station order: ${errorMessage}`);
    }
  };

  const handleOpenDialog = (item?: Station) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        url: item.url,
        description: item.description || '',
        tags: item.tags?.join(', ') || '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        title: '',
        url: '',
        description: '',
        tags: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingItem(null);
  };

  const handleSubmit = () => {
    const newItem: Station = {
      id: editingItem?.id || crypto.randomUUID(),
      title: formData.title,
      url: formData.url,
      description: formData.description,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      createdAt: editingItem?.createdAt || new Date(),
    };

    if (editingItem) {
      setItems(items.map(item => item.id === editingItem.id ? newItem : item));
    } else {
      setItems([...items, newItem]);
    }

    handleCloseDialog();
  };

  const handleDelete = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handlePlayPause = (stationId: string) => {
    setCurrentlyPlayingId(currentlyPlayingId === stationId ? null : stationId);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ 
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary'
      }}>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" component="h1">
              My Radio
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Station
            </Button>
          </Box>

          {error && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.main', color: 'error.contrastText', borderRadius: 1 }}>
              <Typography>Error: {error}</Typography>
            </Box>
          )}

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="stations">
              {(provided) => (
                <Box
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  sx={{ mb: 4 }}
                >
                  {items.map((item, index) => (
                    <UrlListItem
                      key={item.id}
                      item={item}
                      index={index}
                      onDelete={handleDelete}
                      onEdit={handleOpenDialog}
                      isPlaying={currentlyPlayingId === item.id}
                      onPlayPause={handlePlayPause}
                    />
                  ))}
                  {provided.placeholder}
                </Box>
              )}
            </Droppable>
          </DragDropContext>

          <Dialog open={openDialog} onClose={handleCloseDialog}>
            <DialogTitle>
              {editingItem ? 'Edit Station' : 'Add New Station'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  label="URL"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  fullWidth
                  multiline
                  rows={2}
                />
                <TextField
                  label="Tags (comma-separated)"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  fullWidth
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Cancel</Button>
              <Button onClick={handleSubmit} variant="contained">
                {editingItem ? 'Save' : 'Add'}
              </Button>
            </DialogActions>
          </Dialog>

          {showDebugConsole && <DebugConsole messages={debugMessages} />}
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
