export type Surface =
  'front' | 'spine' | 'back' | 'disc' | 'interior' | 'booklet' | 'card' | 'insert';
export type AssetKind = Surface | 'digital' | 'model' | 'wrap' | 'decal' | 'manual';
export type ArtworkRole = 'disc' | 'interior' | 'booklet' | 'card' | 'insert' | 'wrap' | 'manual';
export interface CoverLayer {
  id: string;
  type: 'image' | 'text';
  assetId?: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  color: string;
  font: 'sans-serif' | 'serif' | 'monospace';
}
export interface Genre {
  id: string;
  name: string;
}
export interface ShelfAppearance {
  width: number;
  depth: number;
  spacing: number;
  color: string;
}
export interface Placement {
  beforeId: string | null;
  expectedIds?: string[];
}
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
  appearance?: Partial<ShelfAppearance>;
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
  frameStyle?: string;
  frameWidth?: number;
  frameColor?: string;
  backingColor?: string;
  glass?: boolean;
  casePreset?: string;
  caseColor?: string;
  plasticOpacity?: number;
  plasticRoughness?: number;
  openAngle?: number;
  includeDisc?: boolean;
  offset?: [number, number, number];
  roughness: number;
  textOverlay: boolean;
  scale: number;
  rotation: [number, number, number];
}
export interface LibraryBook {
  artwork?: Partial<Record<ArtworkRole, BookAsset | null>>;
  layers?: Partial<Record<Surface, CoverLayer[]>>;
  layerAssets?: Record<string, BookAsset>;
  genreIds?: string[];
  tags?: string[];
  bookNumber?: string;
  bookOrder?: number | null;
  placement?: Placement;
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
  genres?: Genre[];
  shelves: LibraryShelf[];
  books: LibraryBook[];
}
export interface BookInput extends Omit<
  LibraryBook,
  | 'id'
  | 'position'
  | 'updatedAt'
  | 'createdAt'
  | 'category'
  | 'canRead'
  | 'artwork'
  | 'layerAssets'
  | AssetKind
> {
  artwork?: Partial<Record<ArtworkRole, string | null>>;
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
  upload(
    file: File,
    kind: AssetKind,
    progress: (percent: number) => void,
    signal?: AbortSignal,
  ): Promise<BookAsset>;
  texture(id: string, signal?: AbortSignal, quality?: 'overview' | 'detail'): Promise<Blob>;
  original(id: string): Promise<Blob>;
  crop(id: string, crop: Crop): Promise<BookAsset>;
  read(book: LibraryBook, role?: 'manual'): Promise<Blob>;
  save(book: LibraryBook): Promise<string>;
  remove(id: string): Promise<void>;
  saveShelf(name: string, id?: string, appearance?: Partial<ShelfAppearance>): Promise<void>;
  removeShelf(id: string, moveTo?: string): Promise<void>;
  reorder(kind: 'books' | 'shelves', ids: string[]): Promise<void>;
  place(id: string, shelfId: string, placement: Placement, expectedShelfId?: string): Promise<void>;
  saveGenre(name: string, id?: string): Promise<Genre>;
  removeGenre(id: string): Promise<void>;
  split(
    id: string,
    panels: { role: string; start: number; end: number }[],
  ): Promise<Record<'front' | 'spine' | 'back', BookAsset>>;
  orphanAssets(): Promise<{ id: string; filename: string; bytes: number }[]>;
  removeAsset(id: string): Promise<void>;
}

export function artworkAsset(item: LibraryBook, kind: AssetKind): BookAsset | null | undefined {
  return ['front', 'spine', 'back', 'digital', 'model'].includes(kind)
    ? item[kind as 'front']
    : item.artwork?.[kind as ArtworkRole];
}
export function withArtwork(
  item: LibraryBook,
  kind: AssetKind,
  asset: BookAsset | null,
): LibraryBook {
  return ['front', 'spine', 'back', 'digital', 'model'].includes(kind)
    ? { ...item, [kind]: asset }
    : { ...item, artwork: { ...item.artwork, [kind]: asset } };
}
