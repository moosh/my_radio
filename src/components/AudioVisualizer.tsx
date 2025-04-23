import React, { useState } from 'react';
import { IconButton } from '@mui/material';
import { SwapHoriz } from '@mui/icons-material';
import { VectorArt } from './VectorArt';
import { VectorArt2 } from './VectorArt2';

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioElement }) => {
  const [useAlternateViz, setUseAlternateViz] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {useAlternateViz ? (
        <VectorArt2 audioElement={audioElement} />
      ) : (
        <VectorArt audioElement={audioElement} />
      )}
      
      <IconButton
        onClick={() => setUseAlternateViz(!useAlternateViz)}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(4px)',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          },
          padding: '4px',
          color: 'white',
        }}
        size="small"
      >
        <SwapHoriz fontSize="small" />
      </IconButton>
    </div>
  );
}; 