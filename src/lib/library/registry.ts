import registry from '../../../server/src/object-types.json';
import presets from '../../../server/src/presets.json';
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
  if (surface === 'disc') return 1;
  if (surface === 'booklet' || surface === 'card' || surface === 'insert')
    return surface === 'card' ? 1.6 : item.width / item.height;
  const geometry = objectType(item).geometry;
  if (geometry === 'case' && surface !== 'spine') {
    const preset = presets.cases.find(
      (p) => p.id === (item.presentation?.casePreset || objectType(item).casePreset),
    );
    const band = preset?.band || 0.035;
    return (item.width - 0.09) / (item.height - band - 0.075);
  }
  if (geometry === 'certificate' && surface === 'front' && item.presentation?.frame !== false) {
    const border = item.presentation?.frameWidth || 0.075;
    return (item.width - border * 2) / (item.height - border * 2);
  }
  if (geometry === 'tape' && surface === 'front') return (item.width * 0.3) / (item.height * 0.36);
  return (surface === 'spine' ? item.thickness : item.width) / item.height;
}
export function surfaceSize(item: LibraryBook, surface: AssetKind) {
  const r = surfaceRatio(item, surface);
  return [Math.round(Math.min(3072, 3072 * r)), Math.round(Math.min(3072, 3072 / r))];
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
