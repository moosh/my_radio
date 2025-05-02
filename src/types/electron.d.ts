export interface ElectronAPI {
  getStationsPath: () => Promise<string>;
  getStationsData: () => Promise<string>;
  saveStationsData: (data: string, filename?: string) => Promise<boolean>;
  openMapWindow: () => Promise<void>;
  addStationFromMap: (station: any) => Promise<void>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
  fetchStreamMetadata: (url: string) => Promise<any>;
  scrapeWfmuPlaylists: (url: string) => Promise<any>;
  scrapeWfmuPlaylistsWithProgress: (url: string, progress: (current: number, total: number) => void) => Promise<any>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {}; 