import { Station } from '../types/Station';

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
      const response = await fetch('/stations_list.json');
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
    const rawStations = JSON.parse(data);
    log(`Parsed ${rawStations.length} stations from JSON`);
    // Optionally map/validate fields here
    return rawStations.map((station: any) => ({
      ...station,
      tags: station.tags || [],
      playStats: station.playStats || [],
      createdAt: new Date(),
      id: crypto.randomUUID(),
      lastFailedAt: station.lastFailedAt ? new Date(station.lastFailedAt) : undefined
    }));
  } catch (error) {
    log(`Error parsing stations file: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
} 