import registry from '../../../server/src/object-types.json';
import presets from '../../../server/src/presets.json';
import type { LibraryBook, AssetKind } from './types';
export const objectTypes = registry;
export const categories = [
  { id: 'all', label: 'All Collections' },
  { id: 'certificates', label: 'Certificates/Achievements' },
  { id: 'books', label: 'Books' },
  { id: 'games', label: 'Games' },
  { id: 'media', label: 'Movies & Media' },
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
  if (
    geometry === 'certificate' &&
    ['front', 'back'].includes(surface) &&
    item.presentation?.frame !== false
  ) {
    const frame =
      presets.frames.find((p) => p.id === item.presentation?.frameStyle) ||
      presets.frames.find((p) => p.id === 'gold')!;
    const border = Math.min(
      item.presentation?.frameWidth || frame.width,
      Math.min(item.width, item.height) * 0.22,
    );
    return (item.width - border * 2) / (item.height - border * 2);
  }
  if (geometry === 'tape' && surface === 'front') return (item.width * 0.3) / (item.height * 0.36);
  return (
    (surface === 'spine' ? item.thickness + (geometry === 'book' ? 0.035 : 0) : item.width) /
    item.height
  );
}
export function surfaceSize(item: LibraryBook, surface: AssetKind) {
  const preset = presets.cases.find(
    (p) => p.id === (item.presentation?.casePreset || objectType(item).casePreset),
  );
  if (objectType(item).geometry === 'case' && preset) {
    const pixels = surface === 'spine' ? preset.spinePixels : preset.artworkPixels;
    // Custom dimensions use their actual surface ratio, not the preset's recommendation.
    const ratio = surfaceRatio(item, surface);
    if (pixels && Math.abs(ratio - pixels[0] / pixels[1]) < 0.0001) return pixels;
  }
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
