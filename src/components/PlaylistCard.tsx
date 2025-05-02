import React, { useState } from 'react';
import { Card, CardContent, Typography, IconButton, Collapse, List, ListItem, ListItemText, ListItemSecondaryAction, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

export interface PlaylistShowEntry {
  date: string;
  title: string;
  mp4_listen_url: string;
  cue_start?: string | null;
  playlistName?: string;
}

export interface PlaylistCardProps {
  playlistName: string;
  shows: PlaylistShowEntry[];
  onPlay: (show: PlaylistShowEntry) => void;
  currentlyPlayingUrl?: string | null;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({ playlistName, shows, onPlay, currentlyPlayingUrl }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">{playlistName}</Typography>
        <IconButton onClick={() => setExpanded(e => !e)}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </CardContent>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ px: 2, pb: 2 }}>
          <List dense>
            {shows.map((show, idx) => {
              const isPlaying = currentlyPlayingUrl === show.mp4_listen_url;
              return (
                <ListItem key={idx} divider>
                  <ListItemText
                    primary={show.title || show.date}
                    secondary={show.date + (show.cue_start ? ` (Start: ${show.cue_start})` : '')}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label={isPlaying ? 'pause' : 'play'}
                      onClick={() => onPlay(show)}
                      disabled={!show.mp4_listen_url}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Collapse>
    </Card>
  );
};

export default PlaylistCard; 