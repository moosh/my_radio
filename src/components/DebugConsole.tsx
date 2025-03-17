import React, { useEffect, useRef } from 'react';
import { Box, Typography, Paper } from '@mui/material';

interface DebugMessage {
  timestamp: Date;
  message: string;
  type: 'info' | 'error' | 'warning';
}

interface DebugConsoleProps {
  messages: DebugMessage[];
}

export const DebugConsole: React.FC<DebugConsoleProps> = ({ messages }) => {
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '200px',
        bgcolor: '#1a1a1a',
        color: '#fff',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ 
        p: 1, 
        borderBottom: '1px solid #333',
        bgcolor: '#2a2a2a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="subtitle2">Debug Console</Typography>
        <Typography variant="caption">{messages.length} messages</Typography>
      </Box>
      <Box
        ref={consoleRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1,
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          '& > div': {
            marginBottom: 0.5,
          },
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              color: msg.type === 'error' ? '#ff6b6b' : 
                     msg.type === 'warning' ? '#ffd93d' : '#6bff6b',
            }}
          >
            [{msg.timestamp.toLocaleTimeString()}] {msg.message}
          </div>
        ))}
      </Box>
    </Paper>
  );
}; 