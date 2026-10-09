export type AssetKind = 'front' | 'spine' | 'back' | 'digital';
export interface BookAsset {
  id: string;
  mime: string;
  filename: string;
}
export interface LibraryShelf {
  id: string;
  name: string;
  position: number;
}
export interface LibraryBook {
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
  'id' | 'position' | 'updatedAt' | 'canRead' | AssetKind
> {
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
  read(book: LibraryBook): Promise<Blob>;
  save(book: LibraryBook): Promise<string>;
  remove(id: string): Promise<void>;
  saveShelf(name: string, id?: string): Promise<void>;
  removeShelf(id: string): Promise<void>;
  reorder(kind: 'books' | 'shelves', ids: string[]): Promise<void>;
  orphanAssets(): Promise<{ id: string; filename: string; bytes: number }[]>;
  removeAsset(id: string): Promise<void>;
}
