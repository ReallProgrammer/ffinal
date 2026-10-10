import definitions from '../../../server/src/presets.json';
import type { LibraryBook } from './types';
import { objectType } from './registry';
export const casePresets = definitions.cases;
export const framePresets = definitions.frames;
export function casePreset(item: LibraryBook) {
  return (
    casePresets.find(
      (p) => p.id === (item.presentation?.casePreset || objectType(item).casePreset),
    ) || casePresets.find((p) => p.id === 'dvd')!
  );
}
export function framePreset(item: LibraryBook) {
  return (
    framePresets.find((p) => p.id === item.presentation?.frameStyle) ||
    framePresets.find((p) => p.id === 'gold')!
  );
}
export function presetPresentation(id: string) {
  const preset = casePresets.find((p) => p.id === id)!;
  return {
    casePreset: id,
    caseColor: preset.color,
    plasticOpacity: preset.opacity,
    plasticRoughness: preset.roughness,
  };
}
