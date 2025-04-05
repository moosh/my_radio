import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material';
import StationMap from './components/StationMap';
import { Station } from './types/Station';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
  },
});

const MapApp: React.FC = () => {
  const handleStationSelect = async (station: Station) => {
    if (window.electron) {
      await window.electron.addStationFromMap(station);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <StationMap onStationSelect={handleStationSelect} />
      </div>
    </ThemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MapApp />
  </React.StrictMode>
); 