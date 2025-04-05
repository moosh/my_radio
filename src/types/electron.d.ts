export interface ElectronAPI {
  getStationsPath: () => Promise<string>;
  getStationsData: () => Promise<string>;
  saveStationsData: (data: string) => Promise<boolean>;
  openMapWindow: () => Promise<void>;
  addStationFromMap: (station: any) => Promise<void>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {}; 