export type IconName =
  | 'computer'
  | 'folder'
  | 'documents'
  | 'globe'
  | 'terminal'
  | 'recycle'
  | 'notepad'
  | 'calculator'
  | 'settings'
  | 'mail'
  | 'drive'
  | 'user'
  | 'game'
  | 'search'
  | 'file'
  | 'power'
  | 'certificate';
export type AppId =
  | 'explorer'
  | 'notepad'
  | 'browser'
  | 'calculator'
  | 'terminal'
  | 'settings'
  | 'search'
  | 'run'
  | 'game'
  | 'dialog'
  | 'shelf'
  | 'games'
  | 'snake'
  | 'pong'
  | 'minesweeper'
  | 'taskmanager'
  | 'help';
export interface WindowData {
  id: string;
  app: AppId;
  title: string;
  icon: IconName;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  z: number;
  params: Record<string, string>;
}
export interface FileEntry {
  id: string;
  name: string;
  icon: IconName;
  kind: 'folder' | 'text' | 'link' | 'app';
  parent: string;
  content?: string;
  target?: string;
  app?: AppId;
  originalParent?: string;
  params?: Record<string, string>;
}
export interface Settings {
  sound: boolean;
  volume: number;
  crt: boolean;
  wallpaper: 'bliss' | 'night' | 'slate' | 'custom';
  customWallpaper?: string;
  clickSound: boolean;
  ambient: boolean;
  bootSound: boolean;
  reducedMotion: boolean;
  bootTarget: 'windows' | 'linux';
  skipBoot: boolean;
}
