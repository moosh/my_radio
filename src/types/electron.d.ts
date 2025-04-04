export interface ElectronAPI {
  getStationsPath: () => Promise<string>;
  getStationsData: () => Promise<string>;
  saveStationsData: (data: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {}; 