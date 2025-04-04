import { Station, DayPlayStats } from '../types/Station';

interface ParseOptions {
  log?: (message: string) => void;
}

const defaultLog = (message: string) => console.log(message);

export async function parseStationsFile({ log = defaultLog }: ParseOptions = {}): Promise<Station[]> {
  try {
    log('Starting to parse stations file...');
    
    let data: string;
    if (window.electron) {
      log('Using Electron API to get stations data');
      data = await window.electron.getStationsData();
      log(`Received ${data.length} bytes of data from Electron`);
    } else {
      log('Using fetch to get stations data');
      const response = await fetch('/stations.txt');
      if (!response.ok) {
        throw new Error(`Failed to fetch stations file: ${response.status} ${response.statusText}`);
      }
      data = await response.text();
      log(`Received ${data.length} bytes of data from fetch`);
    }

    if (!data || data.trim().length === 0) {
      log('No stations data found');
      return [];
    }

    const lines = data.split('\n').filter(line => line.trim());
    log(`Found ${lines.length} non-empty lines in file`);

    const stations: Station[] = [];
    let currentStation: Partial<Station> = {};

    for (const line of lines) {
      if (line.startsWith('#')) {
        // Comment line, skip
        continue;
      }

      if (line.trim() === '') {
        // Empty line, process current station if complete
        if (currentStation.title && currentStation.url) {
          stations.push({
            ...currentStation,
            id: crypto.randomUUID(),
            createdAt: new Date()
          } as Station);
          currentStation = {};
        }
        continue;
      }

      const [key, ...values] = line.split(':').map(s => s.trim());
      const value = values.join(':').trim();

      switch (key.toLowerCase()) {
        case 'title':
          // If we already have a complete station, save it before starting a new one
          if (currentStation.title && currentStation.url) {
            stations.push({
              ...currentStation,
              id: crypto.randomUUID(),
              createdAt: new Date()
            } as Station);
            currentStation = {};
          }
          currentStation.title = value;
          break;
        case 'url':
          currentStation.url = value;
          break;
        case 'tags':
          currentStation.tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
          break;
        case 'description':
          currentStation.description = value;
          break;
        case 'playstats':
          try {
            currentStation.playStats = JSON.parse(value) as DayPlayStats[];
          } catch (error) {
            log(`Error parsing play stats for station ${currentStation.title}: ${error}`);
          }
          break;
        default:
          log(`Unknown key in stations file: ${key}`);
      }
    }

    // Add the last station if it exists
    if (currentStation.title && currentStation.url) {
      stations.push({
        ...currentStation,
        id: crypto.randomUUID(),
        createdAt: new Date()
      } as Station);
    }

    log(`Successfully parsed ${stations.length} stations`);
    return stations;
  } catch (error) {
    log(`Error parsing stations file: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
} 