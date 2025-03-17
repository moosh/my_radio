import React from 'react';
import './StationCard.css';
import { Station } from '../types/Station';

interface StationCardProps {
  station: Station;
  onPlay: (station: Station) => void;
  onEdit: (station: Station) => void;
  onDelete: (station: Station) => void;
}

const StationCard: React.FC<StationCardProps> = ({ station, onPlay, onEdit, onDelete }) => {
  return (
    <div className="station-card">
      <div className="station-info">
        <h3>{station.title}</h3>
        <p className="url">{station.url}</p>
        <div className="controls">
          <button onClick={() => onPlay(station)}>Play</button>
          <button onClick={() => onEdit(station)}>Edit</button>
          <button onClick={() => onDelete(station)}>Delete</button>
          <div className="schedule-area">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={day} className="schedule-cell">
                <div className="schedule-label">{day}</div>
                <div className={`schedule-indicator ${station.schedule?.some(s => s.day === index) ? 'active' : ''}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StationCard; 