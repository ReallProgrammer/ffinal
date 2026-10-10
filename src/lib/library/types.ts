export type AssetKind = 'front' | 'spine' | 'back' | 'digital' | 'model';
export interface BookAsset {
  id: string;
  mime: string;
  filename: string;
  width?: number;
  height?: number;
  crop?: Crop;
  lowResolution?: boolean;
}
export interface LibraryShelf {
  id: string;
  name: string;
  position: number;
}
export interface Crop {
  x: number;
  y: number;
  zoom: number;
  ratio: number;
}
export interface Presentation {
  frame: boolean;
  roughness: number;
  textOverlay: boolean;
  scale: number;
  rotation: [number, number, number];
}
export interface LibraryBook {
  objectType?: string;
  category?: string;
  createdAt?: string;
  details?: Record<string, string>;
  presentation?: Presentation;
  model?: BookAsset | null;
  id: string;
  title: string;
  author: string;
  description: string;
  genre: string;
  year: number | null;
  isbn: string;
  color: string;
  height: number;
  width: number;
  thickness: number;
  shelfId: string;
  position: number;
  published: boolean;
  digitalAccess: 'private' | 'public';
  canRead: boolean;
  updatedAt?: string;
  front: BookAsset | null;
  spine: BookAsset | null;
  back: BookAsset | null;
  digital: BookAsset | null;
}
export interface LibraryData {
  shelves: LibraryShelf[];
  books: LibraryBook[];
}
export interface BookInput extends Omit<
  LibraryBook,
  'id' | 'position' | 'updatedAt' | 'createdAt' | 'category' | 'canRead' | AssetKind
> {
  model: string | null;
  front: string | null;
  spine: string | null;
  back: string | null;
  digital: string | null;
}
export interface LibraryRepository {
  configured: boolean;
  isOwner(): boolean;
  list(owner?: boolean): Promise<LibraryData>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  upload(file: File, kind: AssetKind, progress: (percent: number) => void): Promise<BookAsset>;
  texture(id: string, signal?: AbortSignal): Promise<Blob>;
  original(id: string): Promise<Blob>;
  crop(id: string, crop: Crop): Promise<BookAsset>;
  read(book: LibraryBook): Promise<Blob>;
  save(book: LibraryBook): Promise<string>;
  remove(id: string): Promise<void>;
  saveShelf(name: string, id?: string): Promise<void>;
  removeShelf(id: string): Promise<void>;
  reorder(kind: 'books' | 'shelves', ids: string[]): Promise<void>;
  orphanAssets(): Promise<{ id: string; filename: string; bytes: number }[]>;
  removeAsset(id: string): Promise<void>;
}
