import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { Container, Typography, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { UrlListItem } from './components/UrlListItem';
import { UrlItem } from './types/UrlItem';
import { parseStationsFile } from './utils/stationParser';
import { DebugConsole } from './components/DebugConsole';

interface DebugMessage {
  timestamp: Date;
  message: string;
  type: 'info' | 'error' | 'warning';
}

function App() {
  const [items, setItems] = useState<UrlItem[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<UrlItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugMessages, setDebugMessages] = useState<DebugMessage[]>([]);
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    tags: '',
  });

  const addDebugMessage = (message: string, type: 'info' | 'error' | 'warning' = 'info') => {
    setDebugMessages(prev => [...prev, {
      timestamp: new Date(),
      message,
      type
    }]);
  };

  useEffect(() => {
    addDebugMessage('Application started');
    addDebugMessage('Attempting to load stations file from /etc/stations.txt');
    
    fetch('/etc/stations.txt')
      .then(response => {
        addDebugMessage(`Fetch response received with status: ${response.status}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(content => {
        addDebugMessage(`File content received, length: ${content.length} characters`);
        if (content.length === 0) {
          addDebugMessage('Warning: Empty file content received', 'warning');
          return;
        }
        
        const previewLines = content.split('\n').slice(0, 3);
        addDebugMessage('Content preview:');
        previewLines.forEach((line, index) => {
          addDebugMessage(`Line ${index + 1}: ${line.substring(0, 100)}...`);
        });
        
        const stations = parseStationsFile(content, addDebugMessage);
        addDebugMessage(`Parsed ${stations.length} stations from file`);
        
        if (stations.length === 0) {
          addDebugMessage('Warning: No valid stations found in file', 'warning');
        } else {
          addDebugMessage(`First station: ${stations[0].title} (${stations[0].url})`);
        }
        
        setItems(stations);
      })
      .catch(error => {
        const errorMessage = `Error loading stations: ${error.message}`;
        addDebugMessage(errorMessage, 'error');
        setError(errorMessage);
      });
  }, []);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    setItems(newItems);
  };

  const handleOpenDialog = (item?: UrlItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        url: item.url,
        title: item.title,
        description: item.description,
        tags: item.tags.join(', '),
      });
    } else {
      setEditingItem(null);
      setFormData({
        url: '',
        title: '',
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
    const newItem: UrlItem = {
      id: editingItem?.id || crypto.randomUUID(),
      url: formData.url,
      title: formData.title,
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

  return (
    <>
      <Container maxWidth="md" sx={{ py: 4, mb: '220px' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h4" component="h1">
            Radio Stations
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
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {items.length === 0 && !error && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Loading stations...
          </Alert>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="url-list">
            {(provided) => (
              <Box
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {items.map((item, index) => (
                  <UrlListItem
                    key={item.id}
                    item={item}
                    index={index}
                    onDelete={handleDelete}
                    onEdit={handleOpenDialog}
                  />
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>

        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>{editingItem ? 'Edit Station' : 'Add New Station'}</DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 2 }}>
              <TextField
                label="URL"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
              <TextField
                label="Tags (comma-separated)"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                fullWidth
                helperText="Enter tags separated by commas"
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
      </Container>
      <DebugConsole messages={debugMessages} />
    </>
  );
}

export default App;
