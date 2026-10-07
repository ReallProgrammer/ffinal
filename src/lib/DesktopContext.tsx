import { createContext, useContext } from 'react';
import type { AppId, FileEntry, Settings, WindowData } from '../types';
export interface DesktopContextType {
  launch: (app: AppId, params?: Record<string, string>) => void;
  openFile: (file: FileEntry) => void;
  close: (id: string) => void;
  updateWindow: (id: string, patch: Partial<WindowData>) => void;
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  beep: (kind: 'click' | 'open' | 'close' | 'boot' | 'error' | 'type') => void;
  bsod: () => void;
  restart: () => void;
  notify: (message: string) => void;
}
export const DesktopContext = createContext<DesktopContextType>(null!);
export const useDesktop = () => useContext(DesktopContext);
