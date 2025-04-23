import React, { useState } from 'react';
import { IconButton } from '@mui/material';
import { SwapHoriz } from '@mui/icons-material';
import { VectorArt } from './VectorArt';
import { VectorArt2 } from './VectorArt2';
import { VectorArt3 } from './VectorArt3';

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioElement }) => {
  const [currentViz, setCurrentViz] = useState(0);

  const nextViz = () => {
    setCurrentViz((prev) => (prev + 1) % 3);
  };

  const renderCurrentViz = () => {
    switch (currentViz) {
      case 0:
        return <VectorArt audioElement={audioElement} />;
      case 1:
        return <VectorArt2 audioElement={audioElement} />;
      case 2:
        return <VectorArt3 audioElement={audioElement} />;
      default:
        return <VectorArt audioElement={audioElement} />;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {renderCurrentViz()}
      
      <IconButton
        onClick={nextViz}
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