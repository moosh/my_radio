import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { Container, Typography, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, ThemeProvider, createTheme } from '@mui/material';
import { Add as AddIcon, Link as LinkIcon } from '@mui/icons-material';
import { UrlListItem } from './components/UrlListItem';
import { parseStationsFile } from './utils/stationParser';
import { DebugConsole } from './components/DebugConsole';
import { Station, DayPlayStats } from './types/Station';
import { PlayerStatus } from './components/PlayerStatus';
//import { VectorArt } from './components/VectorArt';
import { AudioVisualizer } from './components/AudioVisualizer';
//import { scrapeWfmuPlaylists, WfmuPlaylistResult } from './utils/wfmuParser';
import LinearProgress from '@mui/material/LinearProgress';
import PlaylistCard, { PlaylistShowEntry } from './components/PlaylistCard';

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [openWfmuDialog, setOpenWfmuDialog] = useState(false);
  const [wfmuUrl, setWfmuUrl] = useState('');
  const [wfmuLoading, setWfmuLoading] = useState(false);
  const [wfmuProgress, setWfmuProgress] = useState({ current: 0, total: 0 });
  const [playlistCards, setPlaylistCards] = useState<{ name: string, shows: PlaylistShowEntry[] }[]>([]);
  const [currentlyPlayingPlaylistUrl, setCurrentlyPlayingPlaylistUrl] = useState<string | null>(null);
  const [currentlyPlayingPlaylistShow, setCurrentlyPlayingPlaylistShow] = useState<PlaylistShowEntry | null>(null);

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

    // Listen for new stations from map
    const handleNewStation = (_event: any, station: Station) => {
      setItems(prev => [...prev, station]);
      saveStations([...items, station]);
    };

    if (window.electron) {
      window.electron.on('new-station-from-map', handleNewStation);
      return () => {
        window.electron?.off('new-station-from-map', handleNewStation);
      };
    }
  }, []);

  const saveStations = async (stations: Station[]) => {
    try {
      addDebugMessage('Saving stations...');
      const stationsJson = JSON.stringify(stations, null, 2);
      if (window.electron) {
        const success = await window.electron.saveStationsData(stationsJson, 'stations_list.json');
        if (success) {
          addDebugMessage('Successfully saved stations');
        } else {
          addDebugMessage('Failed to save stations');
        }
      } else {
        addDebugMessage('Electron API not available, cannot save stations');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addDebugMessage(`Error saving stations: ${errorMessage}`);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(source.index, 1);
    newItems.splice(destination.index, 0, reorderedItem);

    setItems(newItems);
    await saveStations(newItems);
  };

  const handleUpdatePlayStats = async (stationId: string, playStats: DayPlayStats[]) => {
    const newItems = items.map(item =>
      item.id === stationId ? { ...item, playStats } : item
    );
    setItems(newItems);
    await saveStations(newItems);
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

  const handleSubmit = async () => {
    const newItem: Station = {
      id: editingItem?.id || crypto.randomUUID(),
      title: formData.title,
      url: formData.url,
      description: formData.description,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      createdAt: editingItem?.createdAt || new Date(),
    };

    const newItems = editingItem 
      ? items.map(item => item.id === editingItem.id ? newItem : item)
      : [...items, newItem];
    
    setItems(newItems);
    await saveStations(newItems);
    handleCloseDialog();
  };

  const handleDelete = async (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    setItems(newItems);
    await saveStations(newItems);
  };

  const handlePlayPause = async (stationId: string) => {
    // If a playlist show is currently playing
    if (currentlyPlayingPlaylistShow && currentlyPlayingPlaylistShow.mp4_listen_url === stationId) {
      const audio = audioRef.current;
      if (!audio) return;
      if (!audio.paused) {
        audio.pause();
        setCurrentlyPlayingPlaylistUrl(null);
        setCurrentlyPlayingPlaylistShow(null);
      } else {
        audio.play();
        setCurrentlyPlayingPlaylistUrl(currentlyPlayingPlaylistShow.mp4_listen_url);
        // No need to setCurrentlyPlayingPlaylistShow again, it's already set
      }
      return;
    }

    const station = items.find(item => item.id === stationId);
    if (!station || !audioRef.current) return;

    try {
      // If this station is currently playing, stop it
      if (currentlyPlayingId === stationId) {
        audioRef.current.pause();
        audioRef.current.src = ''; // Clear the source
        setCurrentlyPlayingId(null);
        return;
      }

      // Stop any currently playing station
      if (currentlyPlayingId) {
        audioRef.current.pause();
        audioRef.current.src = '';
        setCurrentlyPlayingId(null);
      }
      
      // Set new source
      audioRef.current.src = station.url;
      
      try {
        // Wait for the audio to be loaded before playing
        await new Promise((resolve, reject) => {
          if (!audioRef.current) return reject(new Error('No audio element'));
          
          const handleCanPlay = () => {
            audioRef.current?.removeEventListener('canplay', handleCanPlay);
            audioRef.current?.removeEventListener('error', handleError);
            resolve(null);
          };
          
          const handleError = (_: Event) => {
            audioRef.current?.removeEventListener('canplay', handleCanPlay);
            audioRef.current?.removeEventListener('error', handleError);
            reject(new Error('Failed to load audio'));
          };

          audioRef.current.addEventListener('canplay', handleCanPlay);
          audioRef.current.addEventListener('error', handleError);
        });

        // Now that audio is loaded, try to play it
        await audioRef.current.play();
        setCurrentlyPlayingId(stationId);
        setError(null);
        
        // Update both lastFailedAt and play stats in a single update
        const today = new Date().getDay();
        const existingStats = station.playStats || [];
        const todayStats = existingStats.find(stat => stat.day === today);
        const updatedStats = todayStats
          ? existingStats.map(stat => 
              stat.day === today 
                ? { ...stat, playCount: stat.playCount + 1 }
                : stat
            )
          : [...existingStats, { day: today, playCount: 1 }];

        const updatedItems = items.map(item => 
          item.id === stationId 
            ? { 
                ...item, 
                lastFailedAt: undefined,
                playStats: updatedStats
              }
            : item
        );
        setItems(updatedItems);
        await saveStations(updatedItems);
        
      } catch (error) {
        // Clean up if play fails
        if (audioRef.current) {
          audioRef.current.src = '';
        }
        setCurrentlyPlayingId(null);
        
        // Mark station as failed
        const updatedItems = items.map(item => 
          item.id === stationId 
            ? { ...item, lastFailedAt: new Date() }
            : item
        );
        setItems(updatedItems);
        await saveStations(updatedItems);
        
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addDebugMessage(`Error playing station: ${errorMessage}`);
      setError(`Error playing station: ${errorMessage}`);
    }
  };

  const handleWfmuDialogOk = async () => {
    setWfmuLoading(true);
    setWfmuProgress({ current: 0, total: 0 });
    try {
      const result = await window.electron.scrapeWfmuPlaylistsWithProgress(wfmuUrl, (current, total) => {
        setWfmuProgress({ current, total });
      });
      if (window.electron && window.electron.saveStationsData) {
        const json = JSON.stringify(result, null, 2);
        // Extract initials from the wfmuUrl (e.g., LM from https://www.wfmu.org/playlists/LM)
        let initials = '';
        const match = wfmuUrl.match(/playlists\/(\w{2})/i);
        if (match) {
          initials = match[1].toLowerCase();
        } else {
          initials = 'wfmu';
        }
        const filename = `wfmu_shows_${initials}.json`;
        await window.electron.saveStationsData(json, filename);
        console.log(`[WFMU Parser] Saved result to ${filename}`);
      } else {
        console.log('[WFMU Parser] Electron API not available, cannot save file.');
      }
      // Add PlaylistCard to the main list
      if (result && result.playlists && result.playlists.length > 0) {
        setPlaylistCards(prev => [
          ...prev,
          {
            name: result.playlist_name || 'WFMU Playlist',
            shows: result.playlists.map((entry: any) => ({
              date: entry.date,
              title: entry.title,
              mp4_listen_url: entry.mp4_listen_url,
              cue_start: entry.cue_start,
            }))
          }
        ]);
      }
      console.log('[WFMU Parser] Scraping complete.');
    } catch (err) {
      console.log('[WFMU Parser] Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setWfmuLoading(false);
      setWfmuProgress({ current: 0, total: 0 });
    }
    setOpenWfmuDialog(false);
  };

  // Handler to play a show from PlaylistCard
  const handlePlayPlaylistShow = (show: PlaylistShowEntry) => {
    const audio = audioRef.current;
    if (!show.mp4_listen_url || !audio) return;

    // If this show is already playing, pause/stop it
    if (currentlyPlayingPlaylistUrl === show.mp4_listen_url && !audio.paused) {
      audio.pause();
      setCurrentlyPlayingPlaylistUrl(null);
      setCurrentlyPlayingPlaylistShow(null);
      return;
    }

    // Otherwise, play the show from the cue
    audio.src = show.mp4_listen_url;
    let startSeconds = 0;
    if (show.cue_start) {
      const parts = show.cue_start.split(':').map(Number);
      if (parts.length === 3) {
        startSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        startSeconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 1) {
        startSeconds = parts[0];
      }
    }
    audio.currentTime = startSeconds;
    audio.play();
    setCurrentlyPlayingPlaylistUrl(show.mp4_listen_url);
    const playlist = playlistCards.find(card => card.shows.some(s => s.mp4_listen_url === show.mp4_listen_url));
    setCurrentlyPlayingPlaylistShow({ ...show, playlistName: playlist ? playlist.name : undefined });
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioStop = () => {
      setCurrentlyPlayingPlaylistUrl(null);
      setCurrentlyPlayingPlaylistShow(null);
    };

    audio.addEventListener('pause', handleAudioStop);
    audio.addEventListener('ended', handleAudioStop);

    return () => {
      audio.removeEventListener('pause', handleAudioStop);
      audio.removeEventListener('ended', handleAudioStop);
    };
  }, [audioRef]);

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
        <Container maxWidth="md">
          <Box sx={{ 
            mb: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            height: '100px'
          }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Add Station
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<LinkIcon />}
                onClick={() => setOpenWfmuDialog(true)}
              >
                Add Playlist
              </Button>
              <Button
                variant="outlined"
                onClick={() => window.electron?.openMapWindow()}
              >
                Discover Stations
              </Button>
            </Box>
            <Box sx={{ 
              flex: 1,
              height: '100%',
              bgcolor: 'background.paper',
              borderRadius: 1,
              overflow: 'hidden'
            }}>
              <AudioVisualizer audioElement={audioRef.current} />
            </Box>
          </Box>

          {error && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.main', color: 'error.contrastText', borderRadius: 1 }}>
              <Typography>Error: {error}</Typography>
            </Box>
          )}

          <PlayerStatus 
            currentStation={currentlyPlayingPlaylistShow ? {
              id: currentlyPlayingPlaylistShow.mp4_listen_url,
              title: currentlyPlayingPlaylistShow.playlistName
                ? `${currentlyPlayingPlaylistShow.playlistName} — ${currentlyPlayingPlaylistShow.title}`
                : currentlyPlayingPlaylistShow.title,
              url: currentlyPlayingPlaylistShow.mp4_listen_url,
              description: currentlyPlayingPlaylistShow.date + (currentlyPlayingPlaylistShow.cue_start ? ` (Start: ${currentlyPlayingPlaylistShow.cue_start})` : ''),
              tags: [],
              createdAt: new Date(),
            } : items.find(item => item.id === currentlyPlayingId) || null}
            audioElement={audioRef.current}
            onPlayPause={handlePlayPause}
          />

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
                      onUpdatePlayStats={handleUpdatePlayStats}
                    />
                  ))}
                  {provided.placeholder}
                </Box>
              )}
            </Droppable>
          </DragDropContext>

          <audio ref={audioRef} style={{ display: 'none' }} />

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

          <Dialog open={openWfmuDialog} onClose={() => setOpenWfmuDialog(false)}>
            <DialogTitle>Add WFMU Playlist URL</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 480 }}>
                <TextField
                  label="WFMU Playlist URL"
                  value={wfmuUrl}
                  onChange={e => setWfmuUrl(e.target.value)}
                  fullWidth
                  placeholder="https://www.wfmu.org/playlists/LM"
                />
                {wfmuLoading && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress variant={wfmuProgress.total > 0 ? 'determinate' : 'indeterminate'} value={wfmuProgress.total > 0 ? (wfmuProgress.current / wfmuProgress.total) * 100 : undefined} />
                    <Box sx={{ mt: 1, textAlign: 'center' }}>
                      {wfmuProgress.total > 0 ? `Processing ${wfmuProgress.current} of ${wfmuProgress.total}` : 'Starting...'}
                    </Box>
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenWfmuDialog(false)} disabled={wfmuLoading}>Cancel</Button>
              <Button onClick={handleWfmuDialogOk} variant="contained" disabled={wfmuLoading || !wfmuUrl}>OK</Button>
            </DialogActions>
          </Dialog>

          {showDebugConsole && <DebugConsole messages={debugMessages} />}

          {/* Render PlaylistCards after scraping */}
          {playlistCards.map((playlist, idx) => (
            <PlaylistCard
              key={playlist.name + idx}
              playlistName={playlist.name}
              shows={playlist.shows}
              onPlay={handlePlayPlaylistShow}
              currentlyPlayingUrl={currentlyPlayingPlaylistUrl}
            />
          ))}
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
