import registry from '../../../server/src/object-types.json';
import type { LibraryBook, AssetKind } from './types';
export const objectTypes = registry;
export const categories = [
  { id: 'certificates', label: 'Certificates & Achievements' },
  { id: 'all', label: 'All Collections' },
  { id: 'games', label: 'Games' },
  { id: 'media', label: 'Movies & Media' },
  { id: 'books', label: 'Books' },
  { id: 'objects', label: '3D Objects' },
];
export function objectType(item: Pick<LibraryBook, 'objectType'>) {
  return (
    objectTypes.find((t) => t.id === item.objectType) || objectTypes.find((t) => t.id === 'book')!
  );
}
export function surfaceRatio(item: LibraryBook, surface: AssetKind) {
  const geometry = objectType(item).geometry;
  if (surface !== 'spine' && ['case', 'vhs'].includes(geometry)) {
    const band = ['ps5', 'xbox', 'bluray'].includes(item.objectType || '') ? 0.13 : 0.025;
    return (item.width - 0.06) / (item.height - band - 0.05);
  }
  if (geometry === 'tape' && surface === 'front') return (item.width * 0.3) / (item.height * 0.36);
  return (surface === 'spine' ? item.thickness : item.width) / item.height;
}
export function surfaceSize(item: LibraryBook, surface: AssetKind) {
  const r = surfaceRatio(item, surface);
  return [Math.round(Math.min(1536, 1536 * r)), Math.round(Math.min(1536, 1536 / r))];
}
export function footprint(item: LibraryBook) {
  const spine = objectType(item).geometry === 'book';
  const scale = item.presentation?.scale || 1;
  return {
    width: (spine ? item.thickness : item.width) * scale,
    height: item.height * scale,
    depth: (spine ? item.width : item.thickness) * scale,
    rotation: spine ? Math.PI / 2 : 0,
  };
}
