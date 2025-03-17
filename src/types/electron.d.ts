export interface ElectronAPI {
  getStationsPath: () => Promise<string>;
  getStationsData: () => Promise<string>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {}; 